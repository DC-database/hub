/* 18.0.0 patch 94 (martin): "Stuck too long" - Super Admin review of invoices that have not moved.
   One list of open invoices that have been in the same status longer than N days (default 7, you can set the
   days per status; saved in invoice db iba_settings/stuck_days so it is the same on every PC). Oldest first.
   Each row: PO, entry / Inv No., vendor, site, value, status, days in that status, who holds it, and
     Open   - Invoice Entry with that invoice open (update it or finish it there)
     Remind - a reminder to a person (same inbox as IRIS reminders); never for the CEO (CEO Approval or a CEO holder)
     Remove - the invoice goes to the Recycle Bin (Invoice tab), where it can be restored
   Days in status = start of the current status in the invoice's history, else statusChangedAt, else entry date,
   else invoice date. Data comes from window.ibaInvoiceEntriesLoad() (the saved copy + changes, no full read).
   Paid, CLOSED, Cancelled, Original PO and Retention are never "stuck". Open from IRIS ("Stuck too long" chip)
   or Job Records > More tools. PC only. */
(function () {
  'use strict';
  if (window.ibaStuck) return;
  var DONE = /^(paid|closed|cancelled|canceled|original po|retention)$/i;
  var DEF = 7;
  var st = null; // { rows, days, filter, busy, msg, ask, rem, set }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function me() { try { return (currentApprover && currentApprover.Name) || ''; } catch (_) { return ''; } }
  function isSuper() {
    try {
      var n = String(me()).trim().toLowerCase();
      var s = (typeof SUPER_ADMIN_NAME !== 'undefined' ? String(SUPER_ADMIN_NAME) : 'Irwin').trim().toLowerCase();
      return !!n && n === s;
    } catch (_) { return false; }
  }
  function phone() { return !!(document.body && document.body.classList.contains('iba-mobile-ui')); }
  function allowed() { return isSuper() && !phone(); }
  function idb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb) ? invoiceDb : null; } catch (_) { return null; } }
  function mdb() { try { return (typeof db !== 'undefined' && db) ? db : firebase.database(); } catch (_) { return null; } }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : NaN; }
  function money(v) { var n = num(v); return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : esc(v || ''); }
  function ts(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v > 1e12 ? v : v > 1e9 ? v * 1000 : 0;
    var s = String(v).trim(); if (/^\d{10,13}$/.test(s)) return ts(Number(s));
    var t = Date.parse(s); return isFinite(t) ? t : 0;
  }
  function norm(s) { return String(s || '').trim().toLowerCase(); }

  // when did the invoice get its CURRENT status?
  function since(inv) {
    var cur = norm(inv.status), h = inv.history, list = [];
    if (h && typeof h === 'object') Object.keys(h).forEach(function (k) { var e = h[k]; if (e && e.status) list.push({ s: norm(e.status), t: ts(e.timestamp || e.at || e.date) }); });
    list = list.filter(function (x) { return x.t; }).sort(function (a, b) { return a.t - b.t; });
    if (list.length && list[list.length - 1].s === cur) {
      var i = list.length - 1; while (i > 0 && list[i - 1].s === cur) i--;
      return { t: list[i].t, how: 'history' };
    }
    var t = ts(inv.statusChangedAt) || ts(inv.statusUpdatedAt);
    if (t) return { t: t, how: 'status change' };
    t = ts(inv.enteredAt) || ts(inv.createdAt) || ts(inv.timestamp);
    if (t) return { t: t, how: 'entered' };
    t = ts(inv.invoiceDate);
    return t ? { t: t, how: 'invoice date' } : null;
  }
  function holder(inv) { return String(inv.attention || '').trim(); }
  function people() { try { return typeof ibaAllAttentionNames === 'function' ? (ibaAllAttentionNames() || []) : []; } catch (_) { return []; } }
  function isCeoName(n) {
    var w = norm(String(n || '').split(/\s*(?:,|;|\/|&|\band\b)\s*/i)[0]); if (!w) return false;
    return people().some(function (p) { return norm(p.value) === w && /\bceo\b/i.test(String(p.position || '')); });
  }
  function noRemind(r) { return /\bceo approval\b/i.test(r.status) || isCeoName(r.holder); }
  function limit(status) { var d = st && st.days && st.days[norm(status)]; d = Number(d); return d > 0 ? d : DEF; }
  function siteOf(po, inv) {
    var s = inv.site || inv.site_name || inv.siteName || '';
    if (!s) { try { var p = allPOData && allPOData[po]; if (p) s = p['Project ID'] || ''; } catch (_) {} }
    return String(s || '');
  }
  function vendorOf(po, inv) {
    var v = inv.vendorName || inv.vendor_name || inv.vendor || '';
    if (!v) { try { var p = allPOData && allPOData[po]; if (p) v = p['Supplier Name'] || ''; } catch (_) {} }
    return String(v || '');
  }

  async function loadDays() {
    var d = idb(); if (!d) return {};
    try { return (await d.ref('iba_settings/stuck_days').once('value')).val() || {}; } catch (_) { return {}; }
  }
  async function loadRows() {
    var data = {};
    if (typeof window.ibaInvoiceEntriesLoad === 'function') { var r = await window.ibaInvoiceEntriesLoad(); data = (r && r.data) || {}; }
    else { try { data = allInvoiceData || {}; } catch (_) { data = {}; } }
    var now = Date.now(), out = [];
    Object.keys(data).forEach(function (po) {
      var invs = data[po]; if (!invs || typeof invs !== 'object') return;
      Object.keys(invs).forEach(function (key) {
        var inv = invs[key]; if (!inv || typeof inv !== 'object') return;
        var status = String(inv.status || '').trim();
        if (!status || DONE.test(status)) return;
        var s = since(inv); if (!s) return;
        var days = Math.floor((now - s.t) / 86400000); if (days < 0) days = 0;
        out.push({ id: po + '~' + key, po: po, key: key, inv: inv, status: status, days: days, how: s.how, at: s.t,
          entry: inv.invEntryID || '', no: inv.invNumber || '', value: inv.invValue, vendor: vendorOf(po, inv), site: siteOf(po, inv), holder: holder(inv) });
      });
    });
    return out;
  }
  function stuckRows() {
    return (st.rows || []).filter(function (r) { return r.days > limit(r.status); })
      .sort(function (a, b) { return b.days - a.days || String(a.po).localeCompare(String(b.po)); });
  }

  function chip(days, lim) {
    var tone = days >= lim * 4 ? 'critical' : days >= lim * 2 ? 'alert' : 'watch';
    return '<span class="iba-stk-age is-' + tone + '">' + days + ' days</span>';
  }
  function remBox(r) {
    var to = noRemind(r) ? '' : (String(r.holder).split(/\s*(?:,|;|\/|&|\band\b)\s*/i)[0] || '');
    if (/^accounts$/i.test(to)) to = '';
    var text = 'Reminder: PO ' + r.po + ' invoice ' + (r.no || r.entry) + (r.entry && r.no ? ' (' + r.entry + ')' : '') + (r.vendor ? ', ' + r.vendor : '') +
      ', has been "' + r.status + '" for ' + r.days + ' days. Please check it. - ' + (me() || 'IBA');
    return '<tr class="iba-stk-rem"><td colspan="10"><div class="iba-stk-rembox">' +
      '<label><span>To</span><input type="text" list="iba-stk-people" data-stk-to value="' + esc(to) + '" placeholder="Pick a name"></label>' +
      '<textarea rows="2" data-stk-text>' + esc(text) + '</textarea>' +
      '<div class="iba-stk-remacts"><button type="button" data-stk-send="' + esc(r.id) + '"' + (st.busy ? ' disabled' : '') + '><i class="fa-solid fa-paper-plane"></i> Send reminder</button>' +
      '<button type="button" class="is-plain" data-stk-remx>Cancel</button></div></div></td></tr>';
  }
  function paint() {
    var w = document.getElementById('iba-stuck-pop');
    if (!w) {
      w = document.createElement('div'); w.id = 'iba-stuck-pop'; w.className = 'iba-pb-layer'; document.body.appendChild(w);
      w.addEventListener('click', click);
      w.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st && !st.busy) { e.stopPropagation(); close(); } });
    }
    var body;
    if (!st.rows) body = '<div class="iba-pb-sub">Loading invoices…</div>';
    else {
      var all = stuckRows(), counts = {};
      all.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
      var sts = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
      if (st.filter && !counts[st.filter]) st.filter = '';
      var rows = st.filter ? all.filter(function (r) { return r.status === st.filter; }) : all;
      var chips = '<div class="iba-bin-tabs iba-stk-chips"><button type="button" data-stk-f="" class="' + (!st.filter ? 'is-on' : '') + '">All (' + all.length + ')</button>' +
        sts.map(function (s) { return '<button type="button" data-stk-f="' + esc(s) + '" class="' + (st.filter === s ? 'is-on' : '') + '">' + esc(s) + ' (' + counts[s] + ')</button>'; }).join('') +
        '<button type="button" class="iba-stk-setbtn" data-stk-set><i class="fa-solid fa-sliders"></i> Days per status</button></div>';
      var set = '';
      if (st.set) {
        var open = {}; (st.rows || []).forEach(function (r) { open[r.status] = 1; });
        set = '<div class="iba-stk-set"><b>Stuck after how many days?</b><div class="iba-stk-setgrid">' +
          Object.keys(open).sort().map(function (s) { return '<label><span>' + esc(s) + '</span><input type="number" min="1" max="365" data-stk-day="' + esc(norm(s)) + '" value="' + limit(s) + '"></label>'; }).join('') +
          '</div><div class="iba-stk-remacts"><button type="button" data-stk-saveset><i class="fa-solid fa-check"></i> Save</button><button type="button" class="is-plain" data-stk-set>Cancel</button></div></div>';
      }
      body = chips + set + (rows.length ? '<div class="iba-tidy-tblwrap"><table class="iba-tidy-tbl iba-stk-tbl"><thead><tr><th>PO</th><th>Entry / Inv No.</th><th>Vendor</th><th>Site</th><th class="r">Value</th><th>Status</th><th>In status</th><th>With</th><th></th></tr></thead><tbody>' +
        rows.map(function (r) {
          var lim = limit(r.status), act;
          if (st.ask === r.id) act = '<span class="iba-tidy-warn">Move to the Recycle Bin?</span> <button type="button" class="is-danger" data-stk-del2="' + esc(r.id) + '"' + (st.busy ? ' disabled' : '') + '>Yes, remove</button> <button type="button" data-stk-no>No</button>';
          else act = '<button type="button" data-stk-open="' + esc(r.id) + '" title="Open in Invoice Entry to update or finish it"><i class="fa-solid fa-pen-to-square"></i> Open</button>' +
            (noRemind(r) ? '' : ' <button type="button" data-stk-rem="' + esc(r.id) + '" title="Send a reminder"><i class="fa-solid fa-bell"></i> Remind</button>') +
            ' <button type="button" class="is-danger" data-stk-del="' + esc(r.id) + '" title="Move to the Recycle Bin (can be restored)"><i class="fa-solid fa-trash"></i> Remove</button>';
          return '<tr><td class="m">' + esc(r.po) + '</td><td>' + esc(r.entry) + (r.no ? '<br><small class="m">' + esc(r.no) + '</small>' : '') + '</td><td>' + esc(r.vendor) + '</td><td>' + esc(r.site) + '</td><td class="r">' + money(r.value) + '</td><td>' + esc(r.status) + '</td>' +
            '<td title="Since ' + esc(new Date(r.at).toDateString()) + ' (' + esc(r.how) + ')">' + chip(r.days, lim) + '</td><td>' + esc(r.holder || '—') + '</td><td class="iba-bin-act">' + act + '</td></tr>' +
            (st.rem === r.id ? remBox(r) : '');
        }).join('') + '</tbody></table></div>'
        : '<div class="iba-pb-sub">Nothing is stuck. Every open invoice moved within its days.</div>');
    }
    var dl = '<datalist id="iba-stk-people">' + people().map(function (p) { return '<option value="' + esc(p.value) + '">' + esc([p.position, p.site].filter(Boolean).join(' · ')) + '</option>'; }).join('') + '</datalist>';
    w.innerHTML = '<div class="iba-pb-box iba-tidy-box iba-stk-box" role="dialog" aria-modal="true"><div class="iba-pb-head"><b><i class="fa-solid fa-hourglass-half"></i> Stuck too long</b><button type="button" data-stk-x aria-label="Close">✕</button></div>' +
      (st.msg ? '<div class="iba-pb-sub iba-tidy-msg">' + st.msg + '</div>' : '') + body + dl +
      '<div class="iba-pb-foot"><span><small>Open invoices in the same status longer than their days (' + DEF + ' unless you set another number). Oldest first. Paid, Closed, Cancelled, Original PO and Retention are left out. Nobody reminds the CEO.</small></span><button type="button" data-stk-x>Close</button></div></div>';
  }
  function close() { var w = document.getElementById('iba-stuck-pop'); if (w) w.remove(); st = null; }
  function find(id) { var r = (st && st.rows) || []; for (var i = 0; i < r.length; i++) if (r[i].id === id) return r[i]; return null; }

  async function openInvoice(r) {
    close();
    try {
      if (typeof window.ibaOpenShellPage === 'function') await window.ibaOpenShellPage('im-invoice-entry');
      if (typeof handlePOSearch === 'function') await handlePOSearch(r.po);
      setTimeout(function () { try { if (typeof populateInvoiceFormForEditing === 'function') populateInvoiceFormForEditing(r.key); } catch (e) { console.warn('[stuck] open invoice', e); } }, 600);
    } catch (e) { alert('Could not open PO ' + r.po + ': ' + ((e && e.message) || e)); }
  }
  async function remove(r) {
    var d = idb(); if (!d) throw new Error('no connection to the invoice database');
    if (typeof window.ibaInvoiceToBin !== 'function') throw new Error('the Recycle Bin is not loaded');
    await window.ibaInvoiceToBin(r.po, r.key, r.inv);
    await d.ref('invoice_entries/' + r.po + '/' + r.key).remove();
    try { if (typeof removeInvoiceTaskFromUser === 'function') await removeInvoiceTaskFromUser(r.key, r.inv); } catch (_) {}
    try { if (typeof window.removeInvoicePaymentReadyIndex === 'function') await window.removeInvoicePaymentReadyIndex(r.po, r.key); } catch (_) {}
    try { if (typeof removeFromLocalInvoiceCache === 'function') removeFromLocalInvoiceCache(r.po, r.key); } catch (_) {}
  }
  function safe(n) { return String(n || '').trim().replace(/[.#$\[\]\/\\]/g, '_').replace(/\s+/g, '_'); }
  async function sendRem(r, to, text) {
    var d = window.ibaChatDb || mdb(); if (!d) throw new Error('no connection'); // p162: reminders live in the chat database
    var ref = d.ref('iba_assistant/reminders/' + safe(to)).push();
    var sentPath = 'iba_assistant/reminders_sent/' + safe(me()) + '/' + ref.key;
    var TS = firebase.database.ServerValue.TIMESTAMP;
    await Promise.all([ref.set({ from: me(), to: to, text: text, po: r.po, control: '', at: TS, sentPath: sentPath }), d.ref(sentPath).set({ to: to, text: text, po: r.po, control: '', at: TS })]);
  }

  async function click(e) {
    var w = document.getElementById('iba-stuck-pop');
    if (e.target === w) { if (!st.busy) close(); return; }
    var b = e.target.closest('button'); if (!b || b.disabled || !st) return;
    if (b.hasAttribute('data-stk-x')) return close();
    if (b.hasAttribute('data-stk-f')) { st.filter = b.getAttribute('data-stk-f'); st.ask = ''; st.rem = ''; return paint(); }
    if (b.hasAttribute('data-stk-set')) { st.set = !st.set; return paint(); }
    if (b.hasAttribute('data-stk-saveset')) {
      var days = {}; w.querySelectorAll('[data-stk-day]').forEach(function (i) { var n = Math.round(Number(i.value)); if (n > 0 && n !== DEF) days[i.getAttribute('data-stk-day').replace(/[.#$\[\]\/]/g, '_')] = n; });
      st.days = days; st.set = false;
      try { await idb().ref('iba_settings/stuck_days').set(days); st.msg = 'Days saved.'; } catch (err) { st.msg = '<b class="iba-tidy-warn">Days not saved online:</b> ' + esc((err && err.message) || err) + ' (used on this screen only)'; }
      return paint();
    }
    if (b.hasAttribute('data-stk-no')) { st.ask = ''; return paint(); }
    if (b.hasAttribute('data-stk-remx')) { st.rem = ''; return paint(); }
    var id = b.getAttribute('data-stk-open') || b.getAttribute('data-stk-rem') || b.getAttribute('data-stk-del') || b.getAttribute('data-stk-del2') || b.getAttribute('data-stk-send');
    var r = id && find(id); if (!r) return;
    if (b.hasAttribute('data-stk-open')) return openInvoice(r);
    if (b.hasAttribute('data-stk-rem')) { st.rem = st.rem === id ? '' : id; st.ask = ''; paint(); var t = w.querySelector('[data-stk-to]'); if (t) t.focus(); return; }
    if (b.hasAttribute('data-stk-del')) { st.ask = id; st.rem = ''; return paint(); }
    if (b.hasAttribute('data-stk-del2')) {
      st.busy = true; paint();
      try { await remove(r); st.rows = st.rows.filter(function (x) { return x.id !== id; }); st.msg = 'Removed: PO ' + esc(r.po) + ' ' + esc(r.entry) + (r.no ? ' (' + esc(r.no) + ')' : '') + '. It is in the Recycle Bin (Invoice tab).'; }
      catch (err) { st.msg = '<b class="iba-tidy-warn">Not removed:</b> ' + esc((err && err.message) || err); }
      st.busy = false; st.ask = ''; return paint();
    }
    if (b.hasAttribute('data-stk-send')) {
      var typed = String((w.querySelector('[data-stk-to]') || {}).value || '').trim();
      var p = people().find(function (x) { return norm(x.value) === norm(typed); });
      var text = String((w.querySelector('[data-stk-text]') || {}).value || '').trim();
      if (!p) { st.msg = '<b class="iba-tidy-warn">Pick a name from the list.</b>'; return paint(); }
      if (/\bceo\b/i.test(String(p.position || ''))) { st.msg = '<b class="iba-tidy-warn">Nobody reminds the CEO.</b>'; return paint(); }
      if (!text) { st.msg = '<b class="iba-tidy-warn">Write a message.</b>'; return paint(); }
      st.busy = true; paint();
      try { await sendRem(r, p.value, text); st.msg = 'Reminder sent to ' + esc(p.value) + '. It shows in their assistant until they mark it seen.'; st.rem = ''; }
      catch (err) { st.msg = '<b class="iba-tidy-warn">Not sent:</b> ' + esc((err && err.message) || err); }
      st.busy = false; return paint();
    }
  }

  async function open() {
    if (!allowed()) return false;
    st = { rows: null, days: {}, filter: '', busy: false, msg: '', ask: '', rem: '', set: false };
    paint();
    try {
      var res = await Promise.all([loadRows(), loadDays()]);
      if (!st) return true;
      st.rows = res[0]; st.days = res[1];
    } catch (err) { if (!st) return true; st.rows = []; st.msg = '<b class="iba-tidy-warn">Could not read the invoices:</b> ' + esc((err && err.message) || err); }
    paint();
    return true;
  }

  // Job Records > More tools gets a "Stuck too long" entry (the menu is built by iba-1800-tidy.js)
  setInterval(function () {
    var m = document.getElementById('iba-jr-tools-menu');
    if (!m || m.querySelector('[data-jr-stuck]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem'); b.setAttribute('data-jr-stuck', '');
    b.innerHTML = '<i class="fa-solid fa-hourglass-half"></i><span><b>Stuck too long</b><small>Invoices that have not moved: open, remind or remove</small></span>';
    b.addEventListener('click', function (e) { e.preventDefault(); m.hidden = true; open(); });
    m.appendChild(b);
  }, 2500);

  window.ibaStuck = { open: open, allowed: allowed, _since: since };
})();
