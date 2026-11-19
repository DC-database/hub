/* 18.0.0 patch 59 (martin, mock-up https://claude.ai/artifact/Q1J6ojtair82mnnKAdbxGv): FIND LPO.
   Search the LPO PDFs in the "Proc - LPO" folder (dc@iba.com.qa OneDrive) by PO, vendor, site or type of work,
   then Open / Email / WhatsApp / Copy link. The list of file NAMES is read from the folder synced on this PC
   (OneDrive - IBA\Proc - LPO, picked once; Chrome remembers it) and kept in this browser (IndexedDB).
   Nothing goes to Firebase, the PDFs are never read or uploaded.
   File names: "LPO# 67036-Noor Al Khaleej Tyre-Tyres-100.pdf" = PO first, site number last; vendor and site
   names come from POVALUE2 (allPOData) and Site.csv. Who may use it: assistant skill "Find LPO"
   (Super Admin as built; Skill access can give it to others). PC only (folder picking needs a PC browser).
   window.ibaFindLpo.open() */
(function () {
  'use strict';
  if (window.ibaFindLpo) return;
  var BASE = 'https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/Proc%20-%20LPO/';
  var DBN = 'iba-lpo-v1', ST = 'kv';
  var STALE = 6 * 3600000;          // re-read the folder by itself when the list is older than 6 h
  var MAXSHOW = 60;
  var $ = function (id) { return document.getElementById(id); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  // ---------- tiny IndexedDB key/value (the folder handle and the names) ----------
  function idb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no indexedDB'));
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function kv(mode, fn) {
    return idb().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(ST, mode), s = t.objectStore(ST), out;
        var q = fn(s); if (q) q.onsuccess = function () { out = q.result; };
        t.oncomplete = function () { res(out); }; t.onerror = function () { rej(t.error); };
      });
    });
  }
  function get(k) { return kv('readonly', function (s) { return s.get(k); }).catch(function () { return null; }); }
  function put(k, v) { return kv('readwrite', function (s) { s.put(v, k); }).catch(function () {}); }

  // ---------- reading the names ----------
  var S = { names: null, at: 0, handle: null, q: '', busy: '', msg: '', copied: '', ready: false };
  async function loadSaved() {
    if (S.ready) return;
    var v = await get('names');
    if (v && v.list) { S.names = v.list; S.at = v.at || 0; }
    S.handle = await get('handle');
    S.ready = true;
  }
  async function permitted(h, ask) {
    if (!h || !h.queryPermission) return false;
    try {
      var o = { mode: 'read' };
      if ((await h.queryPermission(o)) === 'granted') return true;
      if (ask && (await h.requestPermission(o)) === 'granted') return true;
    } catch (_) {}
    return false;
  }
  // patch 83: also the sub-folders (e.g. one per year), 3 levels deep; names keep their folder ("2025/LPO# 1-x.pdf")
  async function readFolder(h, pre, depth) {
    var list = []; pre = pre || ''; depth = depth || 0;
    for await (var e of h.values()) {
      if (e.kind === 'file' && /\.pdf$/i.test(e.name)) list.push(pre + e.name);
      else if (e.kind === 'directory' && depth < 3 && !/^\./.test(e.name)) { try { list = list.concat(await readFolder(e, pre + e.name + '/', depth + 1)); } catch (_) {} }
    }
    return list;
  }
  // patch 83: the other way to pick (works when Chrome will not open the folder): a folder input; the browser
  // lists the files (Chrome asks "upload"? but nothing is sent anywhere: only the names are kept here)
  function pickByInput() {
    var i = document.createElement('input');
    i.type = 'file'; i.multiple = true; i.setAttribute('webkitdirectory', ''); i.style.display = 'none';
    i.addEventListener('change', async function () {
      var files = Array.from(i.files || []); i.remove();
      if (!files.length) { S.msg = 'No folder was picked.'; return paint(); }
      var list = files.filter(function (f) { return /\.pdf$/i.test(f.name); }).map(function (f) {
        var rel = String(f.webkitRelativePath || f.name); var cut = rel.indexOf('/'); return cut > -1 ? rel.slice(cut + 1) : rel;
      });
      var top = String(files[0].webkitRelativePath || '').split('/')[0];
      if (!list.length) { S.msg = 'No PDF files in "' + top + '". Pick the "Proc - LPO" folder (OneDrive - IBA › Proc - LPO).'; return paint(); }
      S.names = list; S.at = Date.now(); S.parsed = null; S.msg = ''; S.byInput = true;
      await put('names', { list: list, at: S.at });
      paint();
    });
    document.body.appendChild(i); i.click();
  }
  async function refresh(ask, pick) {
    if (S.busy) return;
    var h = S.handle;
    try {
      if (pick || !h) {
        if (!window.showDirectoryPicker) { S.msg = 'This browser cannot open a folder. Use Chrome or Edge on the PC.'; return paint(); }
        h = await window.showDirectoryPicker({ id: 'iba-proc-lpo', mode: 'read' });
      } else if (!(await permitted(h, ask))) { S.msg = 'Chrome did not allow the folder. Press “Pick the folder” again, or use “Other way to pick”.'; return paint(); }
      S.busy = 'Reading the LPO names…'; paint();
      var list = await readFolder(h);
      if (!list.length) { S.busy = ''; S.msg = 'No PDF files in "' + h.name + '". Pick the "Proc - LPO" folder (OneDrive - IBA › Proc - LPO).'; return paint(); }
      S.handle = h; S.names = list; S.at = Date.now(); S.parsed = null; S.msg = '';
      await put('handle', h); await put('names', { list: list, at: S.at });
    } catch (e) {
      if (e && e.name === 'AbortError') S.msg = 'No folder was picked. If Chrome would not open it, use “Other way to pick”.';
      else { S.msg = 'Chrome could not read the folder (' + ((e && e.name) || '') + ': ' + ((e && e.message) || e) + '). Try “Other way to pick”.'; console.warn('[find lpo]', e); }
    }
    S.busy = ''; paint();
  }

  // ---------- understanding a file name ----------
  // "LPO# 67036-Noor Al Khaleej Tyre-Tyres-100.pdf" -> po 67036, site 100, parts ["Noor Al Khaleej Tyre", "Tyres"]
  function parse(path) {
    var name = String(path).split('/').pop();
    var base = name.replace(/\.pdf$/i, '');
    var m = base.match(/(\d{5,6})\s*-\s*(.*)$/);
    var po = m ? m[1] : '', rest = m ? m[2] : base;
    var bits = rest.split(/\s*-\s*/).filter(Boolean);
    var site = '';
    if (bits.length && /^\d{1,4}$/.test(bits[bits.length - 1])) site = bits.pop();
    var req = '';
    if (bits.length && /^\d{5}$/.test(bits[0])) req = bits.shift();
    return { name: name, path: path, po: po, site: site, req: req, bits: bits };
  }
  function poRec(po) { try { return (typeof allPOData !== 'undefined' && allPOData && allPOData[po]) || null; } catch (_) { return null; } }
  var siteMap = null;
  function loadSites() {
    if (siteMap || !window.ibaLpoMail || !window.ibaLpoMail.siteNames) return;
    siteMap = {};
    window.ibaLpoMail.siteNames().then(function (m) { siteMap = m || {}; S.parsed = null; paint(); }).catch(function () {});
  }
  function loadPOs() {
    try {
      if (typeof allPOData !== 'undefined' && allPOData && Object.keys(allPOData).length) return;
      if (typeof ensureInvoicePOBaseDataFetched === 'function') ensureInvoicePOBaseDataFetched(false).then(function () { S.parsed = null; paint(); }).catch(function () {});
    } catch (_) {}
  }
  function enrich(p) {
    var r = poRec(p.po) || {};
    var vendor = String(r['Supplier Name'] || r['Supplier Name:'] || r['Supplier'] || r['Supplier:'] || '').replace(/\s+/g, ' ').trim();
    var proj = String(r['Project ID'] || r['Project ID:'] || '').trim();
    var siteNo = p.site || (proj.match(/^\d{1,4}/) || [''])[0];
    var siteName = (siteMap && siteNo && siteMap[siteNo]) || (proj && !/^\d+$/.test(proj) ? proj : '');
    var cash = p.bits.length && /^cash$/i.test(p.bits[0]);
    var who = vendor || (cash ? 'Cash purchase' : (p.bits[0] || ''));
    var work = p.bits.slice(1).join(' · ');           // bits[0] = vendor (or "Cash"), the rest = type of work
    if (p.bits.length === 1 && !cash && vendor && norm(p.bits[0]) !== norm(vendor)) work = p.bits[0];
    p.vendor = who; p.work = work; p.siteNo = siteNo; p.siteName = siteName;
    p.hay = norm([p.po, p.name, who, vendor, work, siteNo ? 'site ' + siteNo : '', siteNo, siteName, p.req, p.req ? 'req ' + p.req : ''].join(' '));
    return p;
  }
  function parsedAll() {
    if (S.parsed) return S.parsed;
    S.parsed = (S.names || []).map(function (n) { return enrich(parse(n)); })
      .sort(function (a, b) { return (Number(b.po) || 0) - (Number(a.po) || 0) || a.name.localeCompare(b.name); });
    return S.parsed;
  }
  function search(q) {
    var words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    return parsedAll().filter(function (p) {
      return words.every(function (w) { return /^\d+$/.test(w) ? (' ' + p.hay + ' ').indexOf(' ' + w) !== -1 : p.hay.indexOf(w) !== -1; });
    });
  }

  // ---------- links and messages ----------
  function urlOf(p) { return BASE + String(p.path || p.name).split('/').map(encodeURIComponent).join('/'); }
  function lineOf(p) { return 'LPO ' + (p.po || '') + (p.vendor ? ' · ' + p.vendor : '') + (p.siteNo ? ' · Site ' + p.siteNo : '') + (p.siteName ? ' ' + p.siteName : ''); }
  function textOf(p) { return lineOf(p) + '\n' + urlOf(p); }
  function emailUrl(p) {
    var mailto = 'mailto:?subject=' + encodeURIComponent(lineOf(p)) + '&body=' + encodeURIComponent((textOf(p) + '\n').replace(/\r?\n/g, '\r\n'));
    return 'https://outlook.office.com/mail/deeplink/compose?mailtouri=' + encodeURIComponent(mailto);
  }
  function waUrl(p) { return 'https://wa.me/?text=' + encodeURIComponent(textOf(p)); }
  function copy(text, then) {
    var done = function () { then && then(); };
    try { navigator.clipboard.writeText(text).then(done, function () { fallback(); done(); }); } catch (_) { fallback(); done(); }
    function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove(); }
  }

  // ---------- the pop-up ----------
  function ago(t) {
    if (!t) return '';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return Math.round(h / 24) + ' days ago';
  }
  function mark(text, words) {
    var out = esc(text);
    words.filter(function (w) { return w.length > 1; }).forEach(function (w) {
      out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return out;
  }
  function rowHtml(p, words, i) {
    var sub = [p.work, p.siteNo ? 'Site ' + p.siteNo + (p.siteName ? ' · ' + p.siteName : '') : '', p.req ? 'Req ' + p.req : ''].filter(Boolean).join(' · ');
    return '<div class="iba-lpo-row' + (i === 0 ? ' is-top' : '') + '">' +
      '<span class="iba-lpo-po">' + esc(p.po || '—') + '</span>' +
      '<div class="iba-lpo-mid"><b>' + mark(p.vendor || 'LPO', words) + '</b>' +
      (sub ? '<span>' + mark(sub, words) + '</span>' : '') +
      '<code>' + esc(p.name) + '</code></div>' +
      '<div class="iba-lpo-acts">' +
      '<button type="button" data-lpo-open="' + i + '">Open</button>' +
      '<button type="button" class="is-mail" data-lpo-mail="' + i + '">Email</button>' +
      '<button type="button" class="is-wa" data-lpo-wa="' + i + '">WhatsApp</button>' +
      '<button type="button" class="is-copy" data-lpo-copy="' + i + '" aria-label="Copy link" title="Copy link"><i class="fa-solid ' + (S.copied === p.name ? 'fa-check' : 'fa-copy') + '"></i></button>' +
      '</div></div>';
  }
  var shown = [];
  function bodyHtml() {
    if (S.busy) return '<p class="iba-lpo-note">' + esc(S.busy) + '</p>';
    if (!S.names) {
      return '<div class="iba-lpo-first"><p>Pick the <b>Proc - LPO</b> folder once. It is the OneDrive folder on this PC:<br><code>OneDrive - IBA › Proc - LPO</code></p>' +
        '<p class="iba-lpo-note">Only the file names are read. Nothing is uploaded.</p>' +
        '<div class="iba-lpo-picks"><button type="button" class="iba-lpo-main" data-lpo-pick>Pick the folder</button>' +
        '<button type="button" class="iba-lpo-ghost" data-lpo-pick2 title="Use this when Pick the folder does not work">Other way to pick</button></div></div>';
    }
    var q = S.q.trim();
    if (!q) return '<p class="iba-lpo-note">Type a PO, vendor, site or type of work.</p>';
    var all = search(q); shown = all.slice(0, MAXSHOW);
    var words = norm(q).split(' ').filter(Boolean);
    if (!all.length) return '<p class="iba-lpo-note">No LPO matches “' + esc(q) + '”.</p>';
    return '<div class="iba-lpo-count">' + all.length + ' found' + (all.length > MAXSHOW ? ' · showing the newest ' + MAXSHOW : '') + '</div>' +
      shown.map(function (p, i) { return rowHtml(p, words, i); }).join('');
  }
  function sub() {
    if (!S.names) return 'Search the LPO PDFs by PO, vendor or site';
    return S.names.length.toLocaleString('en-US') + ' LPOs · read ' + ago(S.at);
  }
  function paint() {
    var w = $('iba-lpo-pop'); if (!w) return;
    var s = w.querySelector('[data-lpo-sub]'); if (s) s.textContent = sub();
    var re = w.querySelector('[data-lpo-reread]'); if (re) re.hidden = !S.names;
    var m = w.querySelector('[data-lpo-msg]'); if (m) { m.textContent = S.msg || ''; m.hidden = !S.msg; }
    var ask = w.querySelector('[data-lpo-allow]');
    if (ask) ask.hidden = !(S.names && S.handle && S.needAllow);
    var b = w.querySelector('[data-lpo-body]'); if (b) b.innerHTML = bodyHtml();
  }
  function close() { var w = $('iba-lpo-pop'); if (w) w.remove(); document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape' && $('iba-lpo-pop')) { e.stopPropagation(); close(); } }
  function isPhone() { return !!(document.body && document.body.classList.contains('iba-mobile-ui')); }

  async function open() {
    if (isPhone()) { alert('Find LPO works on the PC (it reads the synced Proc - LPO folder).'); return; }
    close();
    var w = document.createElement('div');
    w.id = 'iba-lpo-pop'; w.className = 'iba-lpo-pop';
    w.innerHTML = '<div class="iba-lpo-box" role="dialog" aria-label="Find LPO">' +
      '<div class="iba-lpo-head"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i>' +
      '<div class="iba-lpo-title"><h3>Find LPO</h3><small data-lpo-sub></small></div>' +
      '<button type="button" class="iba-lpo-ghost" data-lpo-allow hidden>Allow folder</button>' +
      '<button type="button" class="iba-lpo-ghost" data-lpo-reread hidden title="Read the folder again (new LPOs)"><i class="fa-solid fa-rotate"></i> Re-read folder</button>' +
      '<button type="button" class="iba-lpo-x" data-lpo-close aria-label="Close">✕</button></div>' +
      '<label class="iba-lpo-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
      '<input type="text" data-lpo-q autocomplete="off" placeholder="PO, vendor, site or type of work" aria-label="Search LPO"></label>' +
      '<p class="iba-lpo-msg" data-lpo-msg hidden></p>' +
      '<div class="iba-lpo-body" data-lpo-body></div></div>';
    document.body.appendChild(w);
    document.addEventListener('keydown', onKey, true);
    var inp = w.querySelector('[data-lpo-q]');
    inp.value = S.q;
    inp.addEventListener('input', function () { S.q = inp.value; S.copied = ''; var b = w.querySelector('[data-lpo-body]'); if (b) b.innerHTML = bodyHtml(); });
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (_) {} }, 30);
    paint();
    loadPOs(); loadSites();
    await loadSaved();
    S.needAllow = false;
    if (S.handle && (!S.names || Date.now() - S.at > STALE)) {
      if (await permitted(S.handle, false)) refresh(false, false);
      else S.needAllow = true;   // Chrome asks again after a restart: one click on "Allow folder"
    }
    paint();
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var w = $('iba-lpo-pop'); if (!w || !w.contains(t)) return;
    if (t === w) return close();
    var b = t.closest('button'); if (!b) return;
    if (b.hasAttribute('data-lpo-close')) return close();
    if (b.hasAttribute('data-lpo-pick')) return refresh(true, true);
    if (b.hasAttribute('data-lpo-pick2')) return pickByInput();
    if (b.hasAttribute('data-lpo-allow')) { S.needAllow = false; return refresh(true, false); }
    if (b.hasAttribute('data-lpo-reread')) { return S.handle ? refresh(true, false) : (S.byInput || !window.showDirectoryPicker ? pickByInput() : refresh(true, true)); }
    var i, p;
    if ((i = b.getAttribute('data-lpo-open')) != null && (p = shown[+i])) return void window.open(urlOf(p), '_blank');
    if ((i = b.getAttribute('data-lpo-mail')) != null && (p = shown[+i])) return void window.open(emailUrl(p), '_blank');
    if ((i = b.getAttribute('data-lpo-wa')) != null && (p = shown[+i])) return void window.open(waUrl(p), '_blank');
    if ((i = b.getAttribute('data-lpo-copy')) != null && (p = shown[+i])) return copy(textOf(p), function () { S.copied = p.name; paint(); });
  });

  // patch 83 (martin): the window can be moved by its title bar
  document.addEventListener('pointerdown', function (e) {
    var head = e.target && e.target.closest && e.target.closest('#iba-lpo-pop .iba-lpo-head');
    if (!head || e.button !== 0 || e.target.closest('button')) return;
    var box = head.closest('.iba-lpo-box'); var r = box.getBoundingClientRect();
    var dx = e.clientX - r.left, dy = e.clientY - r.top;
    e.preventDefault();
    function mv(ev) {
      var x = Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - dx)), y = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - dy));
      box.style.setProperty('position', 'fixed', 'important'); box.style.setProperty('left', x + 'px', 'important'); box.style.setProperty('top', y + 'px', 'important'); box.style.setProperty('margin', '0', 'important');
    }
    function up() { document.removeEventListener('pointermove', mv, true); document.removeEventListener('pointerup', up, true); }
    document.addEventListener('pointermove', mv, true); document.addEventListener('pointerup', up, true);
  }, true);

  window.ibaFindLpo = { open: open, close: close, _parse: parse, _search: search, _url: urlOf, _state: S };
})();
