/* 18.0.0 patch 62 (martin picked B): Summary Note "Per PO" box under the total.
   One line for every PO on the note: PO · PO value | Previous | This note | Total (amount to pay).
   Previous = amount to pay of that PO's other invoices that are already With Accounts or Paid
   (read fresh: only invoice_entries/<PO>, a few KB per PO). This note = the rows on screen.
   "Show previous" switch (remembered) hides Previous + Total when the records may be incomplete
   (some invoices go straight to Accounts without being saved). Previous can be typed by hand
   (the figure the boss wrote on the paper PO): kept per note + PO, "edited" mark on screen only.
   The print (#sn-c, iba-17-p27.js) takes the same box through window.ibaSnPo.printHtml(). */
(function () {
  'use strict';
  if (window.ibaSnPo) return;
  var SW_KEY = 'iba-snpo-prev-v1', OV_KEY = 'iba-snpo-ov-v1', ON_KEY = 'iba-snpo-on-v2';
  var $ = function (id) { return document.getElementById(id); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { return null; } }
  function showPrev() { return ls(SW_KEY) !== '0'; }
  // p68: tick to turn the WHOLE Per PO box on/off (martin: not needed for one-time invoices); remembered on this PC
  function boxOn() { return ls(ON_KEY) === '1'; }   // patch 78/80 (martin): hidden by default; v2 key so PCs that had it ticked under the old default start hidden too
  function noteKey() { var i = $('summary-note-current-input'); return String((i && i.value) || '').trim().toLowerCase(); }
  function overrides() { try { return JSON.parse(ls(OV_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function setOverride(po, v) {
    var o = overrides(), k = noteKey() + '|' + po;
    if (v == null) delete o[k]; else o[k] = v;
    var keys = Object.keys(o); if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(function (x) { delete o[x]; });
    ls(OV_KEY, JSON.stringify(o));
  }
  function overrideOf(po) { var o = overrides(), k = noteKey() + '|' + po; return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null; }
  function toPay(inv) {
    if (!inv) return 0;
    var c = [inv.amountPaid, inv.amtPaid, inv.paidAmount, inv.amount_paid, inv.paymentAmount, inv.actualPaid];
    for (var i = 0; i < c.length; i++) { var n = num(c[i]); if (n > 0) return n; }
    return 0;
  }
  function counted(inv) {
    var s = String((inv && inv.status) || '').toLowerCase();
    return /with accounts/.test(s) || (/\bpaid\b/.test(s) && !/unpaid/.test(s));
  }
  function poValue(po) {
    try { var d = (allPOData && (allPOData[po] || allPOData[String(po).toUpperCase()])) || null; return d ? num(d.Amount) : 0; } catch (_) { return 0; }
  }
  async function readPo(po) {
    try { if (typeof invoiceDb !== 'undefined' && invoiceDb) { var s = await invoiceDb.ref('invoice_entries/' + po).once('value'); var v = s.val(); if (v) return v; } } catch (_) {}
    try { return (allInvoiceData && allInvoiceData[po]) || {}; } catch (_) { return {}; }
  }

  var data = [], seq = 0, cache = {};
  function rowsOnScreen() {
    var list = [];
    document.querySelectorAll('#sn-table-body tr').forEach(function (tr) {
      var td = tr.children;
      list.push({ po: String(tr.getAttribute('data-po') || (td[1] && td[1].textContent) || '').trim(), key: tr.getAttribute('data-key') || '', amt: num(td[5] && td[5].textContent) });
    });
    return list;
  }
  async function compute() {
    var my = ++seq, rows = rowsOnScreen(), order = [], by = {}, keys = {};
    rows.forEach(function (r) { if (!r.po) return; keys[r.key] = 1; if (!by[r.po]) { by[r.po] = { po: r.po, note: 0, n: 0 }; order.push(r.po); } by[r.po].note += r.amt; by[r.po].n++; });
    var out = [];
    for (var i = 0; i < order.length; i++) {
      var po = order[i], invs = cache[po];
      if (!invs) { invs = await readPo(po); cache[po] = invs; }
      if (my !== seq) return null;
      var prev = 0, pn = 0;
      Object.keys(invs || {}).forEach(function (k) { var v = invs[k]; if (!v || keys[k] || !counted(v)) return; prev += toPay(v); pn++; });
      out.push({ po: po, poValue: poValue(po), note: by[po].note, n: by[po].n, prev: prev, pn: pn });
    }
    return out;
  }
  // patch 86 (martin): a PO this note pays off completely (previous + this note reaches the PO value) has no next
  // payment, so it is left out of the print; on screen it stays, faded, marked "fully paid · not printed"
  function done(d) { return d.poValue > 0 && (prevOf(d).v + d.note) >= d.poValue - 0.01; }
  function prevOf(d) { var o = overrideOf(d.po); return o != null ? { v: num(o), edited: true } : { v: d.prev, edited: false }; }

  function screenHtml() {
    if (!boxOn()) return '<div class="iba-snpo-hd"><label class="iba-snpo-sw"><input type="checkbox" data-snpo-on><span></span> <b><i class="fa-solid fa-layer-group"></i> Per PO reference</b></label><small>Off: not shown and not printed</small></div>';
    var on = showPrev(), tn = 0, tp = 0;
    var body = data.map(function (d) {
      var p = prevOf(d); tn += d.note; tp += p.v;
      var fin = done(d);
      return '<tr' + (fin ? ' class="is-done iba-snpo-fin" title="Fully paid with this note: not printed"' : '') + '><td><b>PO ' + esc(d.po) + '</b>' + (d.poValue ? '<small>PO value ' + money(d.poValue) + '</small>' : '') + (fin ? '<small class="iba-snpo-done">Fully paid · not printed</small>' : '') + '</td>' +
        (on ? '<td class="r"><input type="text" inputmode="decimal" data-snpo-prev="' + esc(d.po) + '" value="' + (p.v ? money(p.v) : '') + '" placeholder="0.00" title="Type the previous total from the paper PO if the system missed an invoice">' +
          (p.edited ? '<button type="button" class="iba-snpo-ed" data-snpo-reset="' + esc(d.po) + '" title="Typed by you. Click to go back to the system figure (' + money(d.prev) + ')">edited ×</button>' : '<small>' + d.pn + ' invoice' + (d.pn === 1 ? '' : 's') + '</small>') + '</td>' : '') +
        '<td class="r">' + money(d.note) + '<small>' + d.n + ' invoice' + (d.n === 1 ? '' : 's') + '</small></td>' +
        (on ? '<td class="r t">' + money(p.v + d.note) + '</td>' : '') + '</tr>';
    }).join('');
    return '<div class="iba-snpo-hd"><label class="iba-snpo-sw"><input type="checkbox" data-snpo-on checked><span></span> <b><i class="fa-solid fa-layer-group"></i> Per PO (amount to pay) · for reference</b></label>' +
      '<label class="iba-snpo-sw no-print"><input type="checkbox" data-snpo-sw' + (on ? ' checked' : '') + '><span></span> Show previous</label></div>' +
      '<table><thead><tr><th>PO</th>' + (on ? '<th class="r">Previous</th>' : '') + '<th class="r">This note</th>' + (on ? '<th class="r">Total</th>' : '') + '</tr></thead><tbody>' + body + '</tbody></table>';
  }
  function printHtml() {
    if (!data.length || !boxOn()) return '';
    var rows = data.filter(function (d) { return !done(d); });
    if (!rows.length) return '';
    var on = showPrev();
    // p64/p66: under Prepared By (left side); a long list may run onto the next page (rows never split, header repeats)
    var st = '<style>.pobw{margin-top:12mm;break-inside:auto}.pobt{font-size:8pt;letter-spacing:1.2px;text-transform:uppercase;color:#617180;font-weight:700;margin:0 0 1.6mm;text-align:left;break-after:avoid}' +
      '.pob{margin:0 auto 0 0;width:' + (on ? '128mm' : '80mm') + ';border:.4mm solid #9fb3c2;border-radius:2.6mm;break-inside:auto;font-size:9.5pt}.pob thead{display:table-header-group}.pob tr{break-inside:avoid}' +
      '.pob table{margin:0;font-size:9.5pt}.pob th{font-size:7.5pt;padding:1.6mm 2.4mm;background:#e9f2f8;color:#0e4d7a;border-radius:0!important}' +
      '.pob td{padding:1.5mm 2.4mm;border-bottom:.25mm solid #cfe0ec}.pob tbody tr:last-child td{border-bottom:0}.pob td small{display:block;font-size:7.5pt;color:#617180}.pob td.t{font-weight:800}</style>';
    var body = rows.map(function (d) {
      var p = prevOf(d);
      return '<tr><td><b>PO ' + esc(d.po) + '</b>' + (d.poValue ? '<small>PO value ' + money(d.poValue) + '</small>' : '') + '</td>' +
        (on ? '<td class="r">' + money(p.v) + '</td>' : '') + '<td class="r">' + money(d.note) + '</td>' + (on ? '<td class="r t">' + money(p.v + d.note) + '</td>' : '') + '</tr>';
    }).join('');
    return st + '<div class="pobw"><div class="pobt">For reference only · not part of the payment</div><div class="pob"><table><thead><tr><th>Per PO · QAR</th>' + (on ? '<th class="r">Previous</th>' : '') + '<th class="r">This note</th>' + (on ? '<th class="r">Total</th>' : '') + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }
  function paint() {
    var area = $('summary-note-printable-area'), foot = area && (area.querySelector('.sn-signatures') || area.querySelector('.sn-footer')); // p64: under the signatures
    var box = $('iba-snpo');
    if (!foot || !data.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.id = 'iba-snpo'; }
    box.classList.toggle('is-off', !boxOn());
    if (box.previousElementSibling !== foot) foot.after(box);
    var f = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-snpo-prev');
    box.innerHTML = screenHtml();
    if (f) { var i = box.querySelector('[data-snpo-prev="' + f + '"]'); if (i) { i.focus(); i.select(); } }
  }
  var t = 0;
  function refresh(fresh) {
    if (fresh) cache = {};
    clearTimeout(t);
    t = setTimeout(async function () {
      var d = await compute();
      if (!d) return;
      data = d; paint();
    }, 150);
  }

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.matches && el.matches('[data-snpo-sw]')) { ls(SW_KEY, el.checked ? '1' : '0'); paint(); return; }
    if (el && el.matches && el.matches('[data-snpo-on]')) { ls(ON_KEY, el.checked ? '1' : '0'); paint(); return; }
    if (el && el.matches && el.matches('[data-snpo-prev]')) {
      var po = el.getAttribute('data-snpo-prev'), d = data.filter(function (x) { return x.po === po; })[0];
      var v = String(el.value || '').trim();
      if (!d) return;
      if (v === '' || Math.abs(num(v) - d.prev) < 0.005) setOverride(po, null); else setOverride(po, num(v));
      paint();
    }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('[data-snpo-prev]')) { e.preventDefault(); e.target.blur(); }
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-snpo-reset]');
    if (!b) return;
    setOverride(b.getAttribute('data-snpo-reset'), null); paint();
  }, true);

  (function boot(n) {
    var body = $('sn-table-body');
    if (!body) { if (n < 60) setTimeout(function () { boot(n + 1); }, 500); return; }
    new MutationObserver(function () { refresh(true); }).observe(body, { childList: true });
    if (body.children.length) refresh(true);
  })(0);
  window.ibaSnPo = { printHtml: printHtml, refresh: refresh, data: function () { return data; } };
})();
