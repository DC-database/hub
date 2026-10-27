/* ==========================================================================
   iba-1705-recv.js — 17.0.5 patch 20
   Reception entries (WorkDesk Job Entry, For = Invoice, "New Entry"):
   1. Invoice Entry: when the invoice pop-up was opened from a Reception
      entry and Add finds the same invoice number already on that PO, it
      offers "Already entered: close the Reception entry" instead of only
      "Duplicate". The entry is closed exactly like a normal Add does
      (Converted to Invoice, archived) and linked to the invoice that is
      already there. No extra invoice, nothing deleted.
   2. Same pop-up: its Delete button becomes "Remove reception entry" (Super
      Admin) for an entry that should not become an invoice at all. Asks
      "Are you sure?" first.
      The entry is closed (archived, "Removed"), not wiped, so the record
      stays in Job Records history.
   3. Reception Job Entry: before saving an Invoice job, the invoice number
      is checked against that one PO's invoices (one small read) and the
      open Reception entries. If it is already there: "Save anyway?".
   ========================================================================== */
(function () {
  'use strict';
  if (window.ibaReception) return;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function me() { try { return (currentApprover && currentApprover.Name) || 'System'; } catch (_) { return 'System'; } }
  function isSuper() { try { return !!currentApprover && currentApprover.Name === 'Irwin'; } catch (_) { return false; } }
  function jobKeyNow() { try { return jobEntryToUpdateAfterInvoice || null; } catch (_) { return null; } }
  function editingKey() { try { return currentlyEditingInvoiceKey || null; } catch (_) { return null; } }
  function poNow() { try { return currentPO || ''; } catch (_) { return ''; } }
  function findJob(key) {
    try { return (Array.isArray(allSystemEntries) ? allSystemEntries.find(function (e) { return e && e.key === key; }) : null) || null; } catch (_) { return null; }
  }

  // ---- one pop-up for all three questions -------------------------------
  function ask(o) {
    return new Promise(function (done) {
      var old = document.getElementById('iba-recv-pop');
      if (old) old.remove();
      var w = document.createElement('div');
      w.id = 'iba-recv-pop';
      w.className = 'iba-pb-layer';
      w.innerHTML = '<div class="iba-pb-box" role="alertdialog" aria-modal="true" aria-labelledby="iba-recv-t" style="width:min(480px,100%)">' +
        '<div class="iba-pb-head"><b id="iba-recv-t"><i class="fa-solid ' + (o.icon || 'fa-circle-question') + '"></i> ' + esc(o.title) + '</b></div>' +
        '<div class="iba-pb-sub">' + o.html + '</div>' +
        '<div class="iba-pb-foot"><span></span><button type="button" data-no>' + esc(o.no || 'Cancel') + '</button>' +
        '<button type="button" data-yes class="is-main"' + (o.danger ? ' style="background:rgba(220,53,69,.6) !important;border-color:rgba(255,107,107,.85) !important;color:#fff !important"' : '') + '>' + esc(o.yes) + '</button></div></div>';
      document.body.appendChild(w);
      var end = function (v) { w.remove(); done(v); };
      w.addEventListener('click', function (e) {
        if (e.target === w) return end(false);
        var b = e.target.closest('button');
        if (!b) return;
        end(b.hasAttribute('data-yes'));
      });
      w.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); end(false); } });
      // focus Cancel, so Enter never confirms by mistake
      setTimeout(function () { var n = w.querySelector('[data-no]'); if (n) n.focus(); }, 0);
    });
  }

  // ---- close a Reception entry (same fields as the normal Add) ------------
  async function closeJob(jobKey, how) {
    var src = findJob(jobKey) || {};
    var TS = firebase.database.ServerValue.TIMESTAMP;
    var updates = {
      status: 'Completed', archived: true, updatedAt: TS, updatedBy: me(),
      dateResponded: (typeof formatDate === 'function') ? formatDate(new Date()) : '',
      statusChangedAt: TS, statusQueueAt: TS
    };
    var note;
    if (how.linkKey) {
      Object.assign(updates, {
        for: 'Invoice', remarks: 'Converted to Invoice', convertedToInvoice: true,
        convertedFromFor: src.for || src.type || 'Invoice',
        linkedInvoiceKey: how.linkKey, linkedInvoicePO: how.po,
        invoiceWorkflowStatus: how.linkStatus || '', linkedInvoiceStatus: how.linkStatus || '',
        invoiceConvertedFrom: src.for || src.type || 'Job Entry',
        invoiceConvertedBy: me(), invoiceConvertedAt: TS,
        alreadyEntered: true
      });
      note = 'Already entered: linked to the existing invoice ' + (how.linkEntry || how.linkKey) + ' / PO ' + how.po + ' (no new invoice made).';
    } else {
      Object.assign(updates, { remarks: 'Removed', removedBy: me(), removedAt: TS, removedReason: how.reason || '' });
      note = 'Reception entry removed from Invoice Entry' + (how.reason ? ': ' + how.reason : '') + '.';
    }
    await db.ref('job_entries/' + jobKey).update(updates);
    try {
      await db.ref('job_entries/' + jobKey + '/history').push({ action: how.linkKey ? 'Already entered' : 'Removed', by: me(), timestamp: TS, note: note });
    } catch (e) { console.warn('[reception] history note not added', e); }
    try {
      var local = Object.assign({}, src, updates, { key: jobKey, source: 'job_entry', updatedAt: Date.now() });
      if (typeof wdUpsertLocalWorkdeskJobEntryCache === 'function') wdUpsertLocalWorkdeskJobEntryCache(jobKey, local);
      if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await Promise.resolve(wdWriteWorkdeskJobRecentMarker(jobKey, local, 'updated')).catch(function () {});
    } catch (_) {}
    try { jobEntryToUpdateAfterInvoice = null; } catch (_) {}
    try { pendingJobEntryDataForInvoice = null; } catch (_) {}
    try { if (typeof imInvalidateActiveJobsSidebarCache === 'function') imInvalidateActiveJobsSidebarCache(); } catch (_) {}
    try { Promise.resolve(populateActiveJobsSidebar(true)).catch(function () {}); } catch (_) {}
    try {
      if (typeof closeIMInvoiceEntryModal === 'function') closeIMInvoiceEntryModal();
      else { var modal = document.getElementById('im-invoice-entry-modal'); if (modal) modal.classList.add('hidden'); }
    } catch (_) {}
    paint();
  }

  // 1. Add found the same invoice number on this PO (called from app.js)
  async function offerAlreadyEntered(o) {
    var jobKey = jobKeyNow();
    if (!jobKey) return false;
    var inv = o.inv || {};
    var yes = await ask({
      icon: 'fa-clone', title: 'This invoice is already entered',
      html: 'Invoice No. <b>' + esc(o.invNumber) + '</b> is already on PO <b>' + esc(o.po) + '</b>' +
        (inv.invEntryID ? ' as <b>' + esc(inv.invEntryID) + '</b>' : '') + (inv.status ? ' (status: ' + esc(inv.status) + ')' : '') + '.' +
        '<br><br>Close this Reception entry and link it to that invoice? No new invoice is made and nothing is deleted.',
      yes: 'Close the Reception entry', no: 'Go back'
    });
    if (!yes) return true;
    try {
      await closeJob(jobKey, { po: o.po, linkKey: o.key, linkStatus: inv.status || '', linkEntry: inv.invEntryID || '' });
      alert('Done. The Reception entry is closed and linked to ' + (inv.invEntryID || 'the existing invoice') + '.');
    } catch (e) {
      console.error('[reception] close failed', e);
      alert('Could not close the Reception entry. Please try again.');
    }
    return true;
  }

  // 2. The pop-up's own Delete button: opened from a Reception entry (no
  //    saved invoice yet) it removes that Reception entry instead of saying
  //    "No invoice selected". Its label says so.
  var DEL_HTML = null;
  function receptionMode() { return !!jobKeyNow() && !editingKey(); }
  function paint() {
    var del = document.getElementById('im-delete-invoice-btn');
    if (!del) return;
    if (DEL_HTML === null) DEL_HTML = del.innerHTML;
    var on = receptionMode();
    // not Super Admin: no removing, so no button (a new entry has no Delete)
    if (on && !isSuper()) del.style.setProperty('display', 'none', 'important');
    else if (del.style.display === 'none') del.style.removeProperty('display');
    if (on && !del.dataset.ibaRecv) {
      del.dataset.ibaRecv = '1';
      del.innerHTML = '<i class="fa-solid fa-inbox"></i> Remove reception entry';
      del.title = 'This Reception entry should not become an invoice: remove it from New Entries';
    } else if (!on && del.dataset.ibaRecv) {
      delete del.dataset.ibaRecv;
      del.innerHTML = DEL_HTML;
      del.title = '';
    }
  }
  document.addEventListener('click', function (e) {
    var del = e.target.closest && e.target.closest('#im-delete-invoice-btn');
    if (!del || !receptionMode()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    onRemove();
  }, true);
  async function onRemove() {
    var jobKey = jobKeyNow();
    if (!jobKey || editingKey()) return;
    if (!isSuper()) { alert('Only the Super Admin can remove a Reception entry.'); return; }
    var job = findJob(jobKey) || {};
    var pend = {};
    try { pend = pendingJobEntryDataForInvoice || {}; } catch (_) {}
    var po = job.po || pend.po || poNow();
    var ref = job.ref || pend.ref || '';
    var yes = await ask({
      icon: 'fa-triangle-exclamation', title: 'Remove this Reception entry?', danger: true,
      html: 'Are you sure? This removes the Reception entry <b>PO ' + esc(po) + (ref ? ' / ' + esc(ref) : '') + '</b>' +
        (job.enteredBy ? ' (entered by ' + esc(job.enteredBy) + ')' : '') + ' from New Entries.' +
        '<br><br>No invoice is made or deleted. The entry stays in Job Records as "Removed" with your name.',
      yes: 'Yes, remove it', no: 'Cancel'
    });
    if (!yes) return;
    try {
      await closeJob(jobKey, { po: po, reason: 'not needed / duplicate' });
      alert('The Reception entry is removed from New Entries.');
    } catch (e) {
      console.error('[reception] remove failed', e);
      alert('Could not remove the Reception entry. Please try again.');
    }
  }
  function watchModal() {
    var m = document.getElementById('im-invoice-entry-modal');
    if (!m) return false;
    new MutationObserver(function () { paint(); }).observe(m, { attributes: true, attributeFilter: ['class'] });
    // the form switches between new / editing without closing the pop-up
    var t = document.getElementById('im-form-title') || m;
    new MutationObserver(function () { paint(); }).observe(t, { childList: true, characterData: true, subtree: true });
    paint();
    return true;
  }
  if (!watchModal()) document.addEventListener('DOMContentLoaded', watchModal);

  // 3. Reception Job Entry: same invoice number already there? (called from app.js)
  async function checkNewJob(job) {
    var po = String(job.po || '').trim().toUpperCase();
    var ref = norm(job.ref);
    if (!po || !ref) return true;
    var hits = [];
    try {
      // only this one PO (a few KB), never the whole invoice list
      var snap = await invoiceDb.ref('invoice_entries/' + po).once('value');
      var all = snap.val() || {};
      Object.keys(all).forEach(function (k) {
        var inv = all[k];
        if (inv && typeof inv === 'object' && norm(inv.invNumber) === ref) {
          hits.push('In Invoice Records as <b>' + esc(inv.invEntryID || k) + '</b>' + (inv.status ? ' · ' + esc(inv.status) : '') + (inv.attention ? ' · with ' + esc(inv.attention) : ''));
        }
      });
    } catch (e) { console.warn('[reception] invoice check skipped', e); }
    try {
      (Array.isArray(allSystemEntries) ? allSystemEntries : []).forEach(function (e) {
        if (!e || String(e.po || '').trim().toUpperCase() !== po || norm(e.ref) !== ref) return;
        if (e.for !== 'Invoice' || e.convertedToInvoice || e.archived) return;
        hits.push('Already at Reception (New Entries)' + (e.enteredBy ? ', entered by ' + esc(e.enteredBy) : '') + (e.date ? ' on ' + esc(e.date) : ''));
      });
    } catch (_) {}
    if (!hits.length) return true;
    return ask({
      icon: 'fa-clone', title: 'This invoice may already be in the system',
      html: 'Invoice No. <b>' + esc(job.ref) + '</b> for PO <b>' + esc(po) + '</b>:<ul style="margin:8px 0 0 18px;padding:0">' +
        hits.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul><br>Save it again anyway?',
      yes: 'Save anyway', no: 'Don\'t save'
    });
  }

  window.ibaReception = { offerAlreadyEntered: offerAlreadyEntered, checkNewJob: checkNewJob, paint: paint };
})();
