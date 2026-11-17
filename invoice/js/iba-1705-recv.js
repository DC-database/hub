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
  // ---- 18.0.0 patch 60 (martin): ONE no-duplicate rule for Reception, Invoice Entry and Batch Entry ----
  // PO first (reads only invoice_entries/<PO>, a few KB), then the INVOICE NO. among that PO's invoices.
  // Never the Inv Entry ID. "INV-001", "inv 001", "INV001" are the same. Blocked for everyone; the Super
  // Admin may "Save anyway" (written to system_logs/dup_override with the name).
  // martin: a vendor's repeated number gets "-2" / "-B" (second one), so a short ending after - / or a space stays its own part:
  // "123-2" and "123-B" are NOT "123" (and "123-2" is not "1232"); "INV-001" = "INV001" = "inv 001"
  function normNo(v) {
    var t = String(v == null ? '' : v).toUpperCase().trim();
    var m = t.match(/^(.*?[A-Z0-9])\s*[-\/ ]\s*([A-Z0-9]{1,2})$/);
    var core = (m ? m[1] : t).replace(/[^A-Z0-9]/g, '');
    return m ? core + '|' + m[2] : core;
  }
  async function poInvoices(po) {
    po = String(po || '').trim().toUpperCase();
    if (!po) return {};
    var snap = await invoiceDb.ref('invoice_entries/' + po).once('value');
    return snap.val() || {};
  }
  function openJobsOf(po, no, exceptJobKey) {
    try {
      return (Array.isArray(allSystemEntries) ? allSystemEntries : []).filter(function (e) {
        if (!e || e.key === exceptJobKey) return false;
        if (String(e.po || '').trim().toUpperCase() !== po || normNo(e.ref) !== no) return false;
        if (e.for !== 'Invoice' || e.convertedToInvoice || e.archived) return false;
        return !/^(removed|cancelled|completed|converted to invoice)$/i.test(String(e.remarks || ''));
      });
    } catch (_) { return []; }
  }
  // o: { po, no, exceptJobKey, exceptInvKey, invs (already read), jobs: false to skip Reception }
  async function findDup(o) {
    var po = String(o.po || '').trim().toUpperCase(), no = normNo(o.no);
    var out = { po: po, no: no, invs: [], jobs: [] };
    if (!po || !no) return out;
    var all = o.invs;
    if (!all) { try { all = await poInvoices(po); } catch (e) { console.warn('[no-dup] PO read failed', e); all = {}; } }
    Object.keys(all || {}).forEach(function (k) {
      var inv = all[k];
      if (k === o.exceptInvKey || !inv || typeof inv !== 'object') return;
      if (normNo(inv.invNumber) === no) out.invs.push({ key: k, inv: inv });
    });
    if (o.jobs !== false) out.jobs = openJobsOf(po, no, o.exceptJobKey);
    return out;
  }
  function choose(o) {
    return new Promise(function (done) {
      var old = document.getElementById('iba-recv-pop'); if (old) old.remove();
      var w = document.createElement('div');
      w.id = 'iba-recv-pop'; w.className = 'iba-pb-layer';
      w.innerHTML = '<div class="iba-pb-box" role="alertdialog" aria-modal="true" aria-labelledby="iba-recv-t" style="width:min(520px,100%)">' +
        '<div class="iba-pb-head"><b id="iba-recv-t"><i class="fa-solid ' + (o.icon || 'fa-clone') + '"></i> ' + esc(o.title) + '</b></div>' +
        '<div class="iba-pb-sub">' + o.html + '</div>' +
        '<div class="iba-pb-foot"><span></span>' + o.btns.map(function (b) {
          return '<button type="button" data-v="' + esc(b.v) + '"' + (b.main ? ' class="is-main"' : '') + '>' + esc(b.t) + '</button>';
        }).join('') + '</div></div>';
      document.body.appendChild(w);
      var end = function (v) { w.remove(); done(v); };
      w.addEventListener('click', function (e) {
        if (e.target === w) return end('no');
        var b = e.target.closest('button'); if (b) end(b.getAttribute('data-v'));
      });
      w.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); end('no'); } });
      setTimeout(function () { var n = w.querySelector('[data-v="no"]'); if (n) n.focus(); }, 0);
    });
  }
  function hitLines(d) {
    var l = [];
    d.invs.forEach(function (h) {
      var i = h.inv;
      l.push('In Invoice Records as <b>' + esc(i.invEntryID || h.key) + '</b>' + (i.invNumber ? ' (invoice no. ' + esc(i.invNumber) + ')' : '') +
        (i.status ? ' · ' + esc(i.status) : '') + (i.attention ? ' · with ' + esc(i.attention) : ''));
    });
    d.jobs.forEach(function (e) {
      l.push('Open at Reception (New Entries)' + (e.enteredBy ? ', entered by ' + esc(e.enteredBy) : '') + (e.date ? ' on ' + esc(e.date) : '') + (e.ref ? ' · invoice no. ' + esc(e.ref) : ''));
    });
    return l;
  }
  function logOverride(d, where) {
    try { db.ref('system_logs/dup_override').push({ by: me(), at: firebase.database.ServerValue.TIMESTAMP, po: d.po, invNo: d.no, where: where || '' }); } catch (_) {}
  }
  // shows the block message; true = go ahead (no duplicate, or the Super Admin pressed Save anyway)
  async function guard(o) {
    var d = o.found || await findDup(o);
    if (!d.invs.length && !d.jobs.length) return true;
    var sup = isSuper();
    var canClose = sup && d.invs.length && d.jobs.length;   // a leftover Reception entry of an invoice that is already entered
    var btns = [{ v: 'no', t: 'Go back' }];
    if (canClose) btns.push({ v: 'close', t: 'Close the open entry' });
    if (sup) btns.push({ v: 'yes', t: 'Save anyway', main: true });
    var html = 'Invoice No. <b>' + esc(o.no) + '</b> is already on PO <b>' + esc(d.po) + '</b>:' +
      '<ul style="margin:8px 0 0 18px;padding:0">' + hitLines(d).map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul><br>' +
      (sup ? 'It is not saved. Use <b>Save anyway</b> only for a real exception (your name is kept).' : 'It is not saved, so the same invoice is not entered twice. Check the invoice no.') +
      (canClose ? '<br><b>Close the open entry</b> closes the old Reception entry and links it to the invoice that is already entered.' : '');
    var v = await choose({ title: 'This invoice is already in the system', html: html, btns: btns });
    if (v === 'close') {
      var inv = d.invs[0];
      for (var i = 0; i < d.jobs.length; i++) {
        try { await closeJob(d.jobs[i].key, { po: d.po, linkKey: inv.key, linkStatus: inv.inv.status || '', linkEntry: inv.inv.invEntryID || '' }); }
        catch (e) { console.error('[no-dup] close failed', e); }
      }
      alert('Done. The open Reception entry is closed and linked to ' + (inv.inv.invEntryID || 'the existing invoice') + '. Nothing new was saved.');
      return false;
    }
    if (v === 'yes' && sup) { logOverride(d, o.where); return true; }
    return false;
  }

  // 3. Reception Job Entry (Add or Edit of an Invoice job): same invoice no. on this PO? (called from app.js)
  async function checkNewJob(job) {
    if (!job || !String(job.po || '').trim() || !normNo(job.ref)) return true;
    return guard({ po: job.po, no: job.ref, exceptJobKey: job.key || '', where: job.key ? 'reception edit' : 'reception new' });
  }

  window.ibaReception = { offerAlreadyEntered: offerAlreadyEntered, checkNewJob: checkNewJob, paint: paint, normNo: normNo, poInvoices: poInvoices, findDup: findDup, guard: guard, closeJob: closeJob };
})();
