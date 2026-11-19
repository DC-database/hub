/* 18.0.0 patch 61 (martin): Batch Entry "Search PO" also lists that PO's Reception New Entries.
   Under the existing invoices (or "No existing invoices") a "New Entries (Reception)" block shows each open
   reception entry of the searched PO: invoice no., date, amount, who entered it. "Add to batch" makes a card
   already filled from the entry and linked to it (ibaReceptionBatch.addJob), so Save closes the entry as
   Converted to Invoice. Carded ones say "In batch"; an invoice no. already saved on the PO says "Already entered"
   (patch 60 rule) and cannot be added. Data: the reception list the app keeps (no extra download) and the
   invoices the search just read for this PO (allInvoiceData[po]). */
(function () {
  'use strict';
  if (window.ibaBatchRecv) return;
  var $ = function (id) { return document.getElementById(id); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) && String(v).trim() !== '' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
  function poNow() { var i = $('im-batch-modal-po-input'); return String((i && i.value) || '').trim().toUpperCase(); }
  function normNo(v) { return window.ibaReception && window.ibaReception.normNo ? window.ibaReception.normNo(v) : String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function carded() {
    var set = {}, body = $('im-batch-table-body');
    if (body) body.querySelectorAll('.batch-invoice-card').forEach(function (c) { if (c.dataset.jobKey) set[c.dataset.jobKey] = 1; });
    return set;
  }
  function isOpenJob(j) {
    if (!j || j.source && j.source !== 'job_entry') return false;
    if (j.for && j.for !== 'Invoice') return false;
    if (j.convertedToInvoice || j.archived) return false;
    return !/^(removed|cancelled|completed|converted to invoice)$/i.test(String(j.remarks || ''));
  }
  async function jobsOf(po) {
    var list = [];
    try { if (typeof fetchInvoiceEntrySidePanelJobs === 'function') list = await fetchInvoiceEntrySidePanelJobs(false) || []; } catch (_) {}
    if (!list.length) { try { list = Array.isArray(allSystemEntries) ? allSystemEntries : []; } catch (_) {} }
    return list.filter(function (j) { return isOpenJob(j) && String(j.po || '').trim().toUpperCase() === po; });
  }
  function savedNos(po) {
    var set = {};
    try {
      var all = (typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[po]) || {};
      Object.keys(all).forEach(function (k) { var i = all[k]; if (i && i.invNumber) set[normNo(i.invNumber)] = i.invEntryID || k; });
    } catch (_) {}
    return set;
  }

  var last = { po: '', jobs: [] }, busy = false;
  async function paint(poArg) {
    var box = $('im-batch-modal-results'); if (!box || busy) return;
    var po = poArg || poNow();
    if (!po || /Searching/i.test(box.textContent || '') && !box.querySelector('.batch-modal-result-summary, .batch-modal-empty')) return;
    if (!box.querySelector('.batch-modal-result-summary, .batch-modal-empty')) return;   // only after a search result
    busy = true;
    try {
      var jobs = await jobsOf(po);
      last = { po: po, jobs: jobs };
      var old = box.querySelector('#iba-brv'); if (old) old.remove();
      if (!jobs.length) return;
      var inB = carded(), saved = savedNos(po);
      var rows = jobs.map(function (j, i) {
        var dup = saved[normNo(j.ref)];
        var state = inB[j.key] ? 'in' : dup ? 'dup' : '';
        return '<div class="iba-brv-row' + (state ? ' is-' + state : '') + '">' +
          '<div class="iba-brv-main"><b>' + esc(j.ref || '(no invoice no.)') + '</b>' +
          '<span>' + [j.invoiceDate || '', money(j.amount) ? 'QAR ' + money(j.amount) : '', j.enteredBy ? 'by ' + esc(j.enteredBy) : '', j.date ? esc(j.date) : ''].filter(Boolean).join(' · ') + '</span></div>' +
          (state === 'in' ? '<span class="iba-brv-tag"><i class="fa-solid fa-check"></i> In batch</span>'
            : state === 'dup' ? '<span class="iba-brv-tag is-dup" title="This invoice no. is already saved on the PO">Already entered · ' + esc(dup) + '</span>'
              : '<button type="button" data-brv-add="' + i + '"><i class="fa-solid fa-plus"></i> Add to batch</button>') +
          '</div>';
      }).join('');
      var sec = document.createElement('div');
      sec.id = 'iba-brv';
      sec.innerHTML = '<div class="iba-brv-head"><i class="fa-solid fa-inbox"></i> New Entries (Reception) on PO ' + esc(po) + ' <em>' + jobs.length + '</em></div>' + rows;
      box.appendChild(sec);
    } finally { busy = false; }
  }
  async function add(i, btn) {
    var j = last.jobs[i]; if (!j || !window.ibaReceptionBatch || !window.ibaReceptionBatch.addJob) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
    var r = { ok: false };
    try { r = await window.ibaReceptionBatch.addJob(j); } catch (e) { r = { ok: false, reason: String((e && e.message) || e) }; }
    if (!r.ok && !r.already) alert('Could not add it to the batch: ' + (r.reason || 'unknown reason'));
    paint(last.po);
  }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-brv-add]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    add(Number(b.getAttribute('data-brv-add')), b);
  }, true);

  function watch() {
    var box = $('im-batch-modal-results');
    if (!box) return false;
    new MutationObserver(function (m) {
      if (m.every(function (x) { return x.target && x.target.closest && x.target.closest('#iba-brv'); })) return;
      if (box.querySelector('#iba-brv')) return;
      clearTimeout(watch.t); watch.t = setTimeout(paint, 80);
    }).observe(box, { childList: true, subtree: true });
    var body = $('im-batch-table-body');
    if (body) new MutationObserver(function () { if (box.querySelector('#iba-brv')) { clearTimeout(watch.u); watch.u = setTimeout(function () { paint(last.po); }, 120); } }).observe(body, { childList: true });
    return true;
  }
  (function boot(n) { if (!watch() && n < 60) setTimeout(function () { boot(n + 1); }, 500); })(0);
  window.ibaBatchRecv = { paint: paint };
})();
