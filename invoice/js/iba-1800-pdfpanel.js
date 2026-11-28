/* ==========================================================================
   js/iba-1800-pdfpanel.js — 18.0.0 patch 163 (martin)
   One PDF preview panel on the right side of the screen, with Print, used by the
   info robot search window (IBA Office) and by the INV / SRV buttons in Invoice Records.
   - On a PC with the Ready to Print helper (Irwin's PC: localhost:47123, the helper key
     in localStorage iba-print-helper-token-v1), the PDF is read through the helper and drawn
     here page by page (pdf.js, already on the page): INV from DC Files\INVOICE, SRV from
     DC Files\SRV, LPO (by PO number) from Proc - LPO (helper 18.0.0-p163 or newer).
     Print = the browser's own print window for that PDF (any printer, all pages).
   - Everyone else: the PDF opens in the docked PDF window on the right half of the screen
     (js/iba-1705-pdfwin.js), exactly like before. SharePoint does not allow its files inside our page.
   No Firebase reads.
   18.0.0 patch 172 (martin): every PC user can see INV / SRV in this side panel WITHOUT the helper.
     Everyone has the shared DC Files folder synced on their own PC (OneDrive). The first time, the panel asks
     "Pick your DC Files folder" (browser folder picker, Chrome/Edge); the choice is kept in this browser
     (IndexedDB iba-pdfp / h / dc). INV is read from <DC Files>\INVOICE, SRV from <DC Files>\SRV (sub-folders too).
     Irwin's PC keeps the helper (it also prints automatically); if the helper is off there, the folder is used.
     Nothing is uploaded and nothing is read from Firebase.
   ========================================================================== */
(function () {
'use strict';
if (window.ibaPdfPanel) return;
const HELPER = 'http://localhost:47123', TOKEN_KEY = 'iba-print-helper-token-v1', MAX_PAGES = 8;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = `
#iba-pdfp{position:fixed;top:0;right:0;bottom:0;width:min(46vw,760px);z-index:2147480060;display:flex;flex-direction:column;background:rgba(18,23,36,.97);color:#EEF2FA;border-left:1px solid rgba(255,255,255,.14);box-shadow:-18px 0 50px rgba(0,0,0,.45);font:14px/1.45 Inter,"Segoe UI",Arial,sans-serif;animation:pdfpIn .2s ease-out both}
#iba-pdfp[hidden]{display:none}
@keyframes pdfpIn{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
#iba-pdfp .h{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.12)}
#iba-pdfp .h b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:700 14px "Space Grotesk",Inter,sans-serif}
#iba-pdfp .h button{border:0;border-radius:9px;padding:7px 12px;font:800 12px Inter,sans-serif;cursor:pointer;background:rgba(255,255,255,.1);color:#EEF2FA}
#iba-pdfp .h button.pr{background:#3FB8C8;color:#05201C}
#iba-pdfp .h button:disabled{opacity:.4;cursor:default}
#iba-pdfp .h .x{width:32px;padding:7px 0}
#iba-pdfp .b{flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;align-items:center;gap:12px;background:#2A3040}
#iba-pdfp .b canvas{max-width:100%;height:auto;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.45);border-radius:3px}
#iba-pdfp .m{margin:auto;max-width:44ch;text-align:center;color:#C7CFDD;font-size:13px}
#iba-pdfp .m.bad{color:#FFB3B5}
#iba-pdfp .m button{border:0;border-radius:10px;padding:9px 16px;margin:4px;font:800 13px Inter,sans-serif;cursor:pointer;background:rgba(255,255,255,.12);color:#EEF2FA}
#iba-pdfp .m button.pk{background:#3FB8C8;color:#05201C;padding:11px 20px}
#iba-pdfp .f{padding:6px 12px;color:#9DA8BD;font-size:11.5px;border-top:1px solid rgba(255,255,255,.1)}
body.iba-pdfp-on #iba-oinfo{padding-right:calc(min(46vw,760px) + 14px)}
body.iba-pdfp-on #iba-office .iba-off-pop{padding-right:calc(min(46vw,760px) + 14px)}
#iba-office .iba-off-acts{white-space:nowrap}
#iba-office .iba-off-pdf{padding:4px 8px;margin-right:4px;border-radius:7px;font:800 11px Inter,sans-serif;border:1px solid rgba(63,184,200,.6);background:rgba(63,184,200,.1);color:#9FE8F0;cursor:pointer}
#iba-office .iba-off-pdf:disabled{opacity:.35;cursor:default}
@media (max-width:900px){#iba-pdfp{width:100vw}}
`;
let el = null, cur = null, blobUrl = '';
function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } }
function base(name) { const f = window.getSharePointPdfBaseName; if (typeof f === 'function') return f(name); return String(name || '').replace(/\s*\.pdf\s*$/i, '').replace(/\s+/g, ' ').trim(); }
function spUrl(kind, name) {
  const b = base(name); if (!b || /^nil$/i.test(b)) return '';
  let root = ''; try { root = kind === 'SRV' ? SRV_BASE_PATH : kind === 'RPT' ? REPORT_BASE_PATH : kind === 'LPO' ? LPO_BASE : PDF_BASE_PATH; } catch (_) { return ''; }
  try { if (typeof buildSharePointPdfUrl === 'function') return buildSharePointPdfUrl(root, b) || ''; } catch (_) {}
  return root + encodeURIComponent(b) + '.pdf';
}
const LPO_BASE = 'https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/Proc%20-%20LPO/';
const KINDS = { INV: { k: 'inv', dir: 'DC Files\\INVOICE' }, SRV: { k: 'srv', dir: 'DC Files\\SRV' }, LPO: { k: 'lpo', dir: 'Proc - LPO' } };
function isPc() { try { return !(document.body && document.body.classList.contains('iba-mobile-ui')) && window.matchMedia('(pointer: fine)').matches; } catch (_) { return false; } }
// p172: the panel works with the helper (Irwin) OR with the user's own DC Files folder (everyone on a PC with Chrome/Edge)
function folderOk() { return typeof window.showDirectoryPicker === 'function'; }
function canPanel(kind) { return kind !== 'LPO' && !!KINDS[kind] && (!!token() || folderOk()) && isPc() && !!window.pdfjsLib; }
// Invoice Records keeps its old behaviour until this PC has the helper or a picked folder (no new step for anyone)
function readyPanel(kind) { return canPanel(kind) && (!!token() || !!dcSaved); }

// ---- p172: the user's own DC Files folder (File System Access API) ----
const SUB = { INV: 'INVOICE', SRV: 'SRV' };
let dcHandle = null, dcSaved = false; const dcList = {};
function idb(mode, fn) {
  return new Promise((res) => {
    let rq; try { rq = indexedDB.open('iba-pdfp', 1); } catch (_) { res(null); return; }
    rq.onupgradeneeded = () => { try { rq.result.createObjectStore('h'); } catch (_) {} };
    rq.onerror = () => res(null);
    rq.onsuccess = () => { try { const tx = rq.result.transaction('h', mode); const r = fn(tx.objectStore('h')); tx.oncomplete = () => res(r && 'result' in r ? r.result : null); tx.onerror = () => res(null); } catch (_) { res(null); } };
  });
}
async function dcLoad() { if (dcHandle) return dcHandle; const h = await idb('readonly', (st) => st.get('dc')); if (h) { dcHandle = h; dcSaved = true; } return dcHandle; }
dcLoad().catch(() => {});
async function dcPerm(ask) {
  const h = await dcLoad(); if (!h) return 'none';
  try { let p = await h.queryPermission({ mode: 'read' }); if (p !== 'granted' && ask) p = await h.requestPermission({ mode: 'read' }); return p; } catch (_) { return 'prompt'; }
}
async function dcPick() {
  const h = await window.showDirectoryPicker({ id: 'iba-dc-files', mode: 'read' });
  let ok = false; for (const n of ['INVOICE', 'SRV']) { try { await h.getDirectoryHandle(n); ok = true; } catch (_) {} }
  if (!ok) throw new Error('That folder has no INVOICE or SRV folder inside. Pick the "DC Files" folder itself (OneDrive - IBA \\ DC Files).');
  dcHandle = h; dcSaved = true; Object.keys(dcList).forEach((k) => delete dcList[k]);
  await idb('readwrite', (st) => st.put(h, 'dc')); return h;
}
async function dcForget() { dcHandle = null; dcSaved = false; Object.keys(dcList).forEach((k) => delete dcList[k]); await idb('readwrite', (st) => st.delete('dc')); }
const norm = (x) => String(x || '').replace(/\s*\.pdf\s*$/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
const loose = (x) => norm(x).replace(/[^a-z0-9]/g, '');
async function dcFiles(kind) {
  const c = dcList[kind]; if (c && Date.now() - c.at < 60000) return c.files;
  const root = await dcHandle.getDirectoryHandle(SUB[kind]); const files = [];
  async function walk(dir, path, depth) {
    for await (const [n, h] of dir.entries()) {
      if (h.kind === 'file') { if (/\.pdf$/i.test(n)) files.push({ rel: path + n, h }); }
      else if (depth < 3) await walk(h, path + n + '\\', depth + 1);
      if (files.length > 60000) return;
    }
  }
  await walk(root, '', 0); dcList[kind] = { at: Date.now(), files }; return files;
}
// same rules as the helper: exact, then other spaces/capitals; never guess (similar names are only listed)
async function dcFind(kind, name, prefix) {
  const file = name + '.pdf';
  try { const root = await dcHandle.getDirectoryHandle(SUB[kind]); const h = await root.getFileHandle(file); return { found: file, h, candidates: [] }; } catch (e) { if (e && e.name === 'NotAllowedError') throw e; }
  const all = await dcFiles(kind); const leaf = (f) => f.rel.split('\\').pop();
  let hit = all.filter((f) => leaf(f) === file); if (hit.length === 1) return { found: hit[0].rel, h: hit[0].h, candidates: [] };
  const n = norm(name); hit = all.filter((f) => norm(leaf(f)) === n); if (hit.length === 1) return { found: hit[0].rel, h: hit[0].h, candidates: [] };
  const l = loose(name); let near = all.filter((f) => loose(leaf(f)) === l);
  if (prefix) { const p = loose(prefix); if (p.length >= 6) near = near.concat(all.filter((f) => loose(leaf(f)).startsWith(p))); }
  return { found: null, candidates: [...new Set(near.map((f) => f.rel))].slice(0, 10) };
}
async function dcBytes(h) { const f = await h.getFile(); return new Uint8Array(await f.arrayBuffer()); }
function outside(url) {
  if (!url) return false;
  if (window.ibaPdfWin && window.ibaPdfWin.show(url)) return true;
  try { window.open(url, '_blank', 'noopener'); return true; } catch (_) { return false; }
}
async function helper(path, bytes) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), bytes ? 45000 : 12000);
  try {
    const res = await fetch(HELPER + path, { signal: ctl.signal, headers: { 'X-IBA-Token': token() } });
    if (bytes) { if (!res.ok) throw new Error((await res.text()) || 'helper error ' + res.status); return new Uint8Array(await res.arrayBuffer()); }
    const j = await res.json(); if (!res.ok || j.ok === false) throw new Error(j.error || 'helper error ' + res.status); return j;
  } catch (e) { if (e.name === 'AbortError') throw new Error('The print helper did not answer in time.'); if (e instanceof TypeError) throw new Error('The print helper is not running on this PC.'); throw e; }
  finally { clearTimeout(t); }
}
function build() {
  if (el && el.isConnected) return el;
  if (!document.getElementById('iba-pdfp-css')) { const s = document.createElement('style'); s.id = 'iba-pdfp-css'; s.textContent = CSS; document.head.appendChild(s); }
  el = document.createElement('aside'); el.id = 'iba-pdfp'; el.hidden = true; el.setAttribute('aria-label', 'PDF preview');
  el.innerHTML = '<div class="h"><b></b><button type="button" class="pr" disabled>Print</button><button type="button" class="full">Open full size</button><button type="button" class="x" aria-label="Close preview">✕</button></div><div class="b"></div><div class="f"></div>';
  document.body.appendChild(el);
  el.querySelector('.x').addEventListener('click', close);
  el.querySelector('.full').addEventListener('click', () => { if (cur && cur.url) outside(cur.url); });
  el.querySelector('.pr').addEventListener('click', print);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el && !el.hidden && !document.getElementById('iba-oinfo')) close(); });
  return el;
}
function msg(html, bad) { el.querySelector('.b').innerHTML = `<p class="m${bad ? ' bad' : ''}">${html}</p>`; }
async function open(o) {
  o = o || {}; const kind = String(o.kind || 'INV').toUpperCase();
  const url = o.url || (kind === 'LPO' ? '' : spUrl(kind, o.name));
  if (!url && !o.name && !o.po) return false;
  // p167 (martin): file names in Proc - LPO are too mixed to guess one PDF (a CVS invoice opened for Khalifa),
  // so LPO always opens the Find LPO window (invoice skill) already searching this PO; you pick the right file there.
  if (kind === 'LPO') { if (window.ibaFindLpo && window.ibaFindLpo.open) { window.ibaFindLpo.open(String(o.po || '')); return true; } return false; }
  if (!canPanel(kind)) return outside(url); // everyone else + SRV: the docked PDF window, as before
  build(); const K = KINDS[kind]; const me = cur = { kind, url, name: base(o.name), title: o.title || kind, o };
  el.hidden = false; document.body.classList.add('iba-pdfp-on');
  el.querySelector('.h b').textContent = me.title; el.querySelector('.pr').disabled = true;
  el.querySelector('.f').textContent = K.dir + ' · ' + me.name + '.pdf';
  msg('Opening the PDF…');
  if (!me.name || /^nil$/i.test(me.name)) { msg(kind === 'SRV' ? 'This invoice has no SRV file name yet.' : 'This invoice has no PDF name yet.', true); return true; }
  try {
    // p170 (martin): INVOICE and SRV are named differently in the invoice system, never mix them:
    //   INV = Site-PO-INVID-Vendor(21)            (DC Files\INVOICE)
    //   SRV = YYYYMMDD-PO-INVID-Site-Vendor(21)   (DC Files\SRV, getSrvName in app.js)
    // The SRV file is looked up ONLY by the invoice's own SRV name (srvName); the invoice-style "Site-PO-INVID" guess
    // is used for INV only (an SRV starts with a date, so that guess listed wrong files).
    const prefix = kind === 'INV' ? [o.site, o.po, o.invEntryID].filter(Boolean).join('-') : '';
    let bytes = null, where = '';
    // 1) the helper (Irwin's PC). If it is off and this PC also has a picked folder, the folder is used.
    if (token()) {
      try {
        const f = await helper('/find?kind=' + K.k + '&name=' + encodeURIComponent(me.name + '.pdf') + '&prefix=' + encodeURIComponent(prefix));
        if (cur !== me) return true;
        if (!f.found) { notFound(me, K, f.candidates); return true; }
        bytes = await helper('/pdf?kind=' + K.k + '&file=' + encodeURIComponent(f.found), true); where = K.dir + '\\' + f.found;
      } catch (e) { if (!folderOk() || !(await dcLoad())) throw e; }
    }
    // 2) p172: the user's own DC Files folder
    if (!bytes) {
      if (!folderOk()) throw new Error('This browser cannot open your folder. Use Chrome or Edge.');
      if (!(await dcLoad())) { if (cur === me) askFolder(me, 'pick'); return true; }
      const perm = await dcPerm(true);
      if (cur !== me) return true;
      if (perm !== 'granted') { askFolder(me, 'allow'); return true; }
      const f = await dcFind(kind, me.name, prefix);
      if (cur !== me) return true;
      if (!f.found) { notFound(me, K, f.candidates); return true; }
      bytes = await dcBytes(f.h); where = (dcHandle.name || 'DC Files') + '\\' + SUB[kind] + '\\' + f.found;
    }
    if (cur !== me) return true;
    el.querySelector('.f').textContent = where;
    me.bytes = bytes;
    const doc = await window.pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const box = el.querySelector('.b'); box.innerHTML = '';
    const n = Math.min(doc.numPages, MAX_PAGES), W = Math.max(320, box.clientWidth - 28);
    for (let p = 1; p <= n; p++) {
      if (cur !== me) return true;
      const pg = await doc.getPage(p); const v0 = pg.getViewport({ scale: 1 }); const v = pg.getViewport({ scale: Math.min(2.2, (W / v0.width) * (window.devicePixelRatio || 1)) });
      const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height); c.style.width = Math.round(v.width / (window.devicePixelRatio || 1)) + 'px'; box.appendChild(c);
      await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
    }
    if (doc.numPages > n) box.insertAdjacentHTML('beforeend', `<p class="m">${doc.numPages - n} more page(s): Print prints them all, or Open full size.</p>`);
    el.querySelector('.pr').disabled = false;
  } catch (e) {
    if (cur !== me) return true;
    msg(esc((e && e.message) || e) + '<br><br>Opening it in the PDF window instead.', true);
    setTimeout(() => { if (cur === me && me.url) { outside(me.url); } }, 900);
  }
  return true;
}
function notFound(me, K, cand) {
  msg(`No PDF called <b>${esc(me.name)}.pdf</b> in ${esc(K.dir)}${(cand || []).length ? ' (similar: ' + esc(cand.slice(0, 3).join(', ')) + ')' : ''}.` + (me.url ? ' Try <b>Open full size</b>.' : ''), true);
}
// p172: first time on this PC (pick) or a new browser session (allow): one click, then the PDF opens
function askFolder(me, why) {
  const box = el.querySelector('.b');
  box.innerHTML = why === 'pick'
    ? `<div class="m"><p>To see invoices and SRVs here, pick your <b>DC Files</b> folder once.<br><small>It is the shared OneDrive folder on your PC: OneDrive - IBA \\ DC Files. Nothing is uploaded, the PDF is only read on your PC.</small></p><p><button type="button" class="pk">Pick my DC Files folder</button></p><p><button type="button" class="ow">Open in the PDF window instead</button></p></div>`
    : `<div class="m"><p>Allow the page to read your <b>${esc((dcHandle && dcHandle.name) || 'DC Files')}</b> folder again (the browser asks once each time it restarts).</p><p><button type="button" class="pk">Allow folder</button></p><p><button type="button" class="ow">Open in the PDF window instead</button> <button type="button" class="ch">Pick another folder</button></p></div>`;
  const go = async (pick) => {
    try {
      if (pick) await dcPick(); else if ((await dcPerm(true)) !== 'granted') throw new Error('The folder was not allowed.');
      if (cur === me) open(me.o);
    } catch (e) { if (e && e.name === 'AbortError') return; msg(esc((e && e.message) || e), true); setTimeout(() => { if (cur === me) askFolder(me, dcSaved ? 'allow' : 'pick'); }, 2600); }
  };
  box.querySelector('.pk').onclick = () => go(why === 'pick');
  box.querySelector('.ow').onclick = () => { if (me.url) outside(me.url); close(); };
  const ch = box.querySelector('.ch'); if (ch) ch.onclick = () => go(true);
}
function print() {
  if (!cur || !cur.bytes) return;
  try { if (blobUrl) URL.revokeObjectURL(blobUrl); } catch (_) {}
  blobUrl = URL.createObjectURL(new Blob([cur.bytes], { type: 'application/pdf' }));
  let f = document.getElementById('iba-pdfp-print');
  if (f) f.remove();
  f = document.createElement('iframe'); f.id = 'iba-pdfp-print'; f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
  f.onload = () => { setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { console.warn('[pdf panel] print', e); window.open(blobUrl, '_blank'); } }, 250); };
  f.src = blobUrl; document.body.appendChild(f);
}
function close() { cur = null; if (el) el.hidden = true; document.body.classList.remove('iba-pdfp-on'); }

// Invoice Records: INV / SRV buttons open in this panel on a PC with the helper (Irwin) or with a picked DC Files folder (p172).
// Others: unchanged (docked window).
window.addEventListener('click', (e) => {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('#im-reporting-content a.invoice-pdf-btn[href], #im-reporting-content a.srv-pdf-btn[href]');
  const kind = a && a.classList.contains('srv-pdf-btn') ? 'SRV' : 'INV';
  if (!a || !readyPanel(kind)) return;
  let name = ''; try { name = decodeURIComponent(a.href.split('?')[0].split('/').pop()).replace(/\.pdf$/i, ''); } catch (_) { return; }
  if (!name) return;
  e.preventDefault(); e.stopPropagation();
  const row = a.closest('tr'); const no = row && row.children[1] ? row.children[1].textContent.trim() : '';
  open({ kind, name, url: a.href, title: kind + (no ? ' · ' + no : '') });
}, true);

window.ibaPdfPanel = { open, close, url: spUrl, inPanel: canPanel, pickFolder: dcPick, forgetFolder: dcForget, folderName: () => (dcHandle && dcHandle.name) || '' };
})();
