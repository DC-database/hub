/* 18.0.0 patch 62 (martin picked A): Invoice Records as PO cards, like the tracker.
   Each PO: PO No. | Site | Vendor + "N open · M invoices" on top, then PO value | Invoiced | Paid | Balance
   with lines between them and the coloured bar. Click the top to open / close its invoices (same as before).
   The invoice table keeps ALL its columns (Entry, Inv no., Inv date, Inv value, To pay, Release, Status, Note,
   Action) with a coloured status dot and the Total line. Built from what the page already drew (no new reads),
   so people who see "---" for amounts see no figures. Phone Invoice Records is not touched. */
(function () {
  'use strict';
  if (window.ibaRecCards) return;
  var $ = function (id) { return document.getElementById(id); };
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function has(v) { return /\d/.test(String(v || '')); }
  function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toneOf(s) { return window.ibaIeStyle ? window.ibaIeStyle.toneOf(s) : 'proc'; }
  function firstNum(el) { if (!el) return ''; var t = el.cloneNode(true); t.querySelectorAll('.iba-pofile-upd, small, sup').forEach(function (x) { x.remove(); }); return t.textContent.trim(); }

  function shape(card) {
    if (card.classList.contains('iba-rc')) return;
    var row = card.querySelector(':scope > .master-grid-row');
    if (!row) return;
    var c = row.querySelectorAll(':scope > .grid-cell');
    if (c.length < 7) return;
    var po = c[1].textContent.trim(), site = c[2].textContent.trim(), vendor = c[3].textContent.trim();
    var pvT = firstNum(c[4]), ivT = c[5].textContent.trim(), bT = c[6].textContent.trim();
    var see = has(pvT) || has(ivT);
    var rows = Array.prototype.slice.call(card.querySelectorAll('tr.nested-invoice-row'));
    var n = rows.length, open = 0, paid = 0, acc = 0, prog = 0;
    rows.forEach(function (tr) {
      var td = tr.children; if (td.length < 7) return;
      var badge = td[6].querySelector('.status-badge') || td[6];
      var st = badge.textContent.trim(), t = toneOf(st);
      if (badge.classList) { badge.classList.add('iba-rc-st', 'is-' + t); }
      td[1].classList.add('iba-rc-no');
      var v = num(td[3].textContent), p = num(td[4].textContent) || v;
      if (t === 'paid') paid += p; else { open++; if (t === 'acc') acc += p; else prog += v; }
    });
    card.querySelectorAll('.im-nested-invoice-table thead th').forEach(function (th) { if (/^amt\.?\s*paid$/i.test(th.textContent.trim())) th.textContent = 'To pay'; });
    // p63: see-through glass (martin): the app paints the header solid inline, so tint it here
    card.querySelectorAll('.im-nested-invoice-table thead th').forEach(function (th) { th.style.removeProperty('background'); /* p73: the app's inline solid colour is dropped; frosted glass comes from the CSS */ });
    var pv = num(pvT), iv = num(ivT), bal = num(bT);
    var chip = n ? (open ? '<span class="iba-rc-chip is-open"><i></i>' + open + ' open · ' + n + ' invoice' + (n === 1 ? '' : 's') + '</span>'
      : '<span class="iba-rc-chip is-done"><i class="fa-solid fa-check"></i> all paid · ' + n + ' invoice' + (n === 1 ? '' : 's') + '</span>') : '<span class="iba-rc-chip">no invoices</span>';
    var head = document.createElement('div');
    head.className = 'iba-rc-head';
    head.setAttribute('role', 'button'); head.tabIndex = 0;
    head.title = 'Open / close the invoices of PO ' + po;
    var o = { po: pv, inv: iv, paid: paid, acc: acc, prog: prog, bal: pv - iv };
    head.innerHTML = '<div class="iba-rc-top"><div class="iba-ie2-top"><div><span class="l">PO No.</span><span class="iba-rc-pono">' + esc(po) + '</span></div>' +
      '<div><span class="l">Site</span><span class="iba-rc-site">' + esc(site) + '</span></div>' +
      '<div class="iba-rc-ven-w"><span class="l">Vendor</span><span class="iba-rc-ven">' + esc(vendor) + '</span></div></div>' + chip +
      '<i class="fa-solid fa-chevron-down iba-rc-chev"></i></div>' +
      (see ? '<div class="iba-ie2-figs"><div><span class="l">PO value</span><b>' + money(pv) + '</b></div><div><span class="l">Invoiced</span><b>' + money(iv) + '</b></div>' +
        '<div class="is-ok"><span class="l">Paid</span><b>' + money(paid) + '</b></div><div class="is-bal' + (bal < -0.005 ? ' is-neg' : '') + '"><span class="l">Balance</span><b>' + money(bal) + '</b></div></div>' +
        (window.ibaIeStyle ? window.ibaIeStyle.barHtml(o).replace(/<div class="iba-ie2-leg">[\s\S]*$/, '') : '') : '');
    row.before(head);
    card.classList.add('iba-rc');
    // p69: PO details stay fixed while the rows scroll; the column header sticks right under them
    try { new ResizeObserver(function () { card.style.setProperty('--rch', head.offsetHeight + 'px'); }).observe(head); } catch (_) { card.style.setProperty('--rch', head.offsetHeight + 'px'); }
  }
  function paint() {
    var area = $('im-reporting-content');
    if (!area) return;
    var cards = area.querySelectorAll('.invoice-card');
    cards.forEach(shape);
    // "Total SRV" is the sum of the invoice values: say Invoiced (martin)
    var g = $('im-reporting-grand-total-container');
    if (g) g.querySelectorAll('span').forEach(function (sp) { if (sp.children.length === 0 && /^(grand\s+)?total srv:?$/i.test(sp.textContent.trim())) sp.textContent = sp.textContent.replace(/srv/i, 'Invoiced'); });
    var sheet = area.closest('.iba-records-sheet');
    if (sheet) sheet.classList.toggle('iba-rc-on', !!area.querySelector('.invoice-card.iba-rc'));
  }
  function toggleCard(head) {
    var row = head.parentElement && head.parentElement.querySelector(':scope > .master-grid-row');
    if (row) row.click();
  }
  document.addEventListener('click', function (e) {
    var h = e.target && e.target.closest && e.target.closest('.iba-rc-head');
    if (!h || e.target.closest('a, button:not(.iba-rc-head)')) return;
    toggleCard(h);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('iba-rc-head')) { e.preventDefault(); toggleCard(e.target); }
  });
  (function boot(n) {
    var area = $('im-reporting-content');
    if (!area) { if (n < 60) setTimeout(function () { boot(n + 1); }, 500); return; }
    new MutationObserver(function () { clearTimeout(boot.t); boot.t = setTimeout(paint, 30); }).observe(area, { childList: true });
    var g = $('im-reporting-grand-total-container'); if (g) new MutationObserver(function () { clearTimeout(boot.g); boot.g = setTimeout(paint, 30); }).observe(g, { childList: true });
    paint();
  })(0);
  window.ibaRecCards = { paint: paint };
})();
