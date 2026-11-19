/* 18.0.0 patch 62 (martin picked A): Invoice Entry in the tracker style.
   - Pop-up PO strip: PO No. | Site | Vendor on top, then PO value | Invoiced (n) | Paid | Balance with lines
     between them and a coloured bar (Paid green, With Accounts pink, in progress blue, not invoiced grey).
   - Page (after Search PO): the same figures + bar under the PO strip, and the Existing Invoices table with
     a status dot, invoice no. in mono and a clear Total line. No name for With Accounts / Paid.
   Numbers come from the PO's invoices already in memory (currentPOInvoices / allInvoiceData): no Firebase read.
   People who cannot see amounts (the table shows ---) get no figures. */
(function () {
  'use strict';
  if (window.ibaIeStyle) return;
  var $ = function (id) { return document.getElementById(id); };
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function toneOf(s) {
    s = String(s || '').toLowerCase();
    if (/^paid|\bpaid\b/.test(s) && !/unpaid/.test(s)) return 'paid';
    if (/with accounts/.test(s)) return 'acc';
    if (/hold|reject|cancel|return/.test(s)) return 'stop';
    if (/approv|ceo|management/.test(s)) return 'apv';
    return 'proc';
  }
  function invsOf(po) {
    var v = null;
    try { v = (typeof currentPOInvoices !== 'undefined' && currentPOInvoices && Object.keys(currentPOInvoices).length) ? currentPOInvoices : null; } catch (_) {}
    if (!v) { try { v = (allInvoiceData && allInvoiceData[po]) || null; } catch (_) {} }
    return v || {};
  }
  function figs(po, poValue) {
    var o = { n: 0, inv: 0, paid: 0, acc: 0, prog: 0 };
    var invs = invsOf(po);
    Object.keys(invs).forEach(function (k) {
      var x = invs[k]; if (!x || typeof x !== 'object' || /cancel/i.test(String(x.status || ''))) return;
      var v = num(x.invValue), p = num(x.amountPaid) || v, t = toneOf(x.status);
      o.n++; o.inv += v;
      if (t === 'paid') o.paid += p; else if (t === 'acc') o.acc += p; else o.prog += v;
    });
    o.po = poValue; o.bal = poValue - o.inv;
    return o;
  }
  function barHtml(o) {
    var base = Math.max(o.po, o.inv, 1), pc = function (v) { return Math.max(0, Math.min(100, v / base * 100)).toFixed(2) + '%'; };
    return '<div class="iba-ie2-bar"><i class="p" style="width:' + pc(o.paid) + '"></i><i class="a" style="width:' + pc(o.acc) + '"></i><i class="o" style="width:' + pc(o.prog) + '"></i></div>' +
      '<div class="iba-ie2-leg"><span><i class="p"></i>Paid ' + money(o.paid) + '</span><span><i class="a"></i>With Accounts ' + money(o.acc) + '</span><span><i class="o"></i>In progress ' + money(o.prog) + '</span>' +
      (o.bal > 0.005 ? '<span><i></i>Not invoiced ' + money(o.bal) + '</span>' : '') + '</div>';
  }
  function figsHtml(o) {
    return '<div class="iba-ie2-figs"><div><span class="l">PO value</span><b>' + money(o.po) + '</b></div>' +
      '<div><span class="l">Invoiced (' + o.n + ')</span><b>' + money(o.inv) + '</b></div>' +
      '<div class="is-ok"><span class="l">Paid</span><b>' + money(o.paid) + '</b></div>' +
      '<div class="is-bal' + (o.bal < -0.005 ? ' is-neg' : '') + '"><span class="l">Balance</span><b>' + money(o.bal) + '</b></div></div>';
  }
  function canSee() {
    var t = $('im-invoices-total-value');
    return !(t && /---/.test(t.textContent || ''));
  }

  // ---------- page ----------
  function paintPage() {
    var det = $('im-modal-po-details');
    var box = $('iba-ie2-page');
    var poEl = det && det.querySelector('.im-po-no'), po = String((poEl && poEl.textContent) || '').trim();
    if (!det || det.classList.contains('hidden') || !po || po === '---' || !canSee()) { if (box) box.remove(); paintTable(); return; }
    var pv = num((det.querySelector('.im-po-value') || {}).textContent);
    if (!box) { box = document.createElement('div'); box.id = 'iba-ie2-page'; box.className = 'iba-ie2'; }
    if (det.nextElementSibling !== box) det.after(box);
    var o = figs(po, pv);
    box.innerHTML = figsHtml(o) + barHtml(o);
    paintTable();
  }
  function paintTable() {
    var body = $('im-invoices-table-body');
    if (!body) return;
    var tbl = body.closest('table'); if (tbl) { tbl.classList.add('iba-ie2-tbl'); tbl.querySelectorAll('thead th').forEach(function (th) { if (/^amount to paid$/i.test(th.textContent.trim())) th.textContent = 'Amount to pay'; }); }
    body.querySelectorAll('tr').forEach(function (tr) {
      var td = tr.children; if (td.length < 7) return;
      var st = td[5];
      if (st && !st.querySelector('.iba-ie2-st')) {
        var s = String(st.textContent || '').trim();
        if (s) st.innerHTML = '<span class="iba-ie2-st is-' + toneOf(s) + '"><i></i>' + s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</span>';
      }
      if (td[1]) td[1].classList.add('iba-ie2-no');
      if (td[3]) td[3].classList.add('iba-ie2-n');
      if (td[4]) td[4].classList.add('iba-ie2-n');
    });
    var f = $('im-invoices-table-footer');
    if (f) { f.classList.add('iba-ie2-foot'); var c = f.querySelector('td'); if (c && /total:/i.test(c.textContent)) c.textContent = 'Total'; }
    var tv = $('im-invoices-total-value'), tp = $('im-invoices-total-paid');
    if (tv) tv.classList.add('iba-ie2-n'); if (tp) tp.classList.add('iba-ie2-n');
  }

  // ---------- pop-up strip ----------
  function shapeModal() {
    var strip = document.querySelector('#im-invoice-entry-modal .iba-ie-po');
    if (!strip || strip.classList.contains('iba-ie2-po')) return strip;
    var noCell = strip.querySelector('.iba-ie-po-no'), vCell = strip.querySelector('.iba-ie-po-v'), site = strip.querySelector('.iba-ie-site');
    var figsEls = Array.prototype.slice.call(strip.querySelectorAll(':scope > .iba-ie-fig'));
    if (!noCell || !vCell || figsEls.length < 3) return strip;
    strip.classList.add('iba-ie2-po');
    var top = document.createElement('div'); top.className = 'iba-ie2-top';
    var sCell = document.createElement('div'); sCell.className = 'iba-ie2-site';
    sCell.innerHTML = '<span class="l">Site</span>';
    var sSpan = site && site.querySelector('.im-po-site');
    if (sSpan) sCell.appendChild(sSpan);
    if (site) site.remove();
    top.appendChild(noCell); top.appendChild(sCell); top.appendChild(vCell);
    var fig = document.createElement('div'); fig.className = 'iba-ie2-figs';
    var paid = document.createElement('div'); paid.className = 'iba-ie-fig is-ok'; paid.innerHTML = '<span class="l">Paid</span><b data-ie2-paid>---</b>';
    figsEls[0].after(paid);
    fig.appendChild(figsEls[0]); fig.appendChild(figsEls[1]); fig.appendChild(paid); fig.appendChild(figsEls[2]);
    var bar = document.createElement('div'); bar.className = 'iba-ie2-barw';
    strip.innerHTML = '';
    strip.appendChild(top); strip.appendChild(fig); strip.appendChild(bar);
    var iv = strip.querySelector('[data-ie-invoiced]');
    if (iv) new MutationObserver(function () { setTimeout(paintModal, 0); }).observe(iv, { childList: true, characterData: true, subtree: true });
    return strip;
  }
  function paintModal() {
    var strip = shapeModal();
    if (!strip) return;
    var po = String((strip.querySelector('.im-po-no') || {}).textContent || '').trim();
    var pvEl = strip.querySelector('.im-po-value'), see = pvEl && /\d/.test(pvEl.textContent);
    var o = figs(po, num(pvEl && pvEl.textContent));
    var pd = strip.querySelector('[data-ie2-paid]'); if (pd) pd.textContent = see ? money(o.paid) : '---';
    var lbl = strip.querySelector('[data-ie-invoiced]'); lbl = lbl && lbl.parentElement && lbl.parentElement.querySelector('.l');
    if (lbl) lbl.textContent = see && o.n ? 'Invoiced (' + o.n + ')' : 'Invoiced';
    var bal = strip.querySelector('[data-ie-balance]'); if (bal && bal.parentElement) bal.parentElement.classList.toggle('is-neg', see && o.bal < -0.005);
    var bw = strip.querySelector('.iba-ie2-barw'); if (bw) bw.innerHTML = see && po && po !== '---' ? barHtml(o) : '';
  }

  // run after the app fills the PO and its invoices
  function wrap(name, after) {
    var f = window[name];
    if (typeof f !== 'function' || f.__ie2) return !!(f && f.__ie2);
    var w = function () { var r = f.apply(this, arguments); try { setTimeout(after, 0); } catch (_) {} return r; };
    w.__ie2 = true; window[name] = w;
    return true;
  }
  (function boot(n) {
    var ok = wrap('fetchAndDisplayInvoices', function () { paintPage(); paintModal(); });
    var body = $('im-invoices-table-body'), det = $('im-modal-po-details');
    if (body && !body.__ie2) { body.__ie2 = 1; new MutationObserver(function () { clearTimeout(boot.t); boot.t = setTimeout(paintPage, 60); }).observe(body, { childList: true }); }
    if (det && !det.__ie2) { det.__ie2 = 1; new MutationObserver(function () { clearTimeout(boot.t); boot.t = setTimeout(paintPage, 60); }).observe(det, { attributes: true, attributeFilter: ['class'] }); }
    var modal = $('im-invoice-entry-modal');
    if (modal && !modal.__ie2) { modal.__ie2 = 1; new MutationObserver(function () { if (!modal.classList.contains('hidden')) setTimeout(paintModal, 30); }).observe(modal, { attributes: true, attributeFilter: ['class'] }); }
    if ((!ok || !body || !modal) && n < 60) setTimeout(function () { boot(n + 1); }, 500);
  })(0);
  window.ibaIeStyle = { paintPage: paintPage, paintModal: paintModal, figs: figs, toneOf: toneOf, barHtml: barHtml, figsHtml: figsHtml };
})();
