/* ==========================================================================
   iba-1800-tidy.js — 18.0.0 patch 56 (martin)
   "Tidy old jobs" (Super Admin, Job Records). Old Invoice jobs from before
   WorkDesk and Invoice Entry were linked stayed "Under Review" for months,
   although the invoice was entered (often Paid or With Accounts already).
   1. Pick a date: open Invoice jobs entered before it are checked.
   2. For each PO, ONE small read of invoice_entries/<po> (never the full tree).
   3. Found (same invoice no., or the only invoice with the same amount):
      the job is closed as "Converted to Invoice" and linked, exactly like a
      normal Add. Not found: listed, and you choose Cancel / Remove / Leave.
   4. Nothing is written until you press Confirm.
   window.ibaTidyJobs() opens it.
   ========================================================================== */
(function () {
  'use strict';
  if (window.ibaTidyJobs) return;
  var DONE = /^(?:cancel+ed|closed|paid|converted to invoice|completed|removed|done)$/i;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function me() { try { return (currentApprover && currentApprover.Name) || 'System'; } catch (_) { return 'System'; } }
  function isSuper() {
    try {
      var n = String((currentApprover && currentApprover.Name) || '').trim().toLowerCase();
      var s = (typeof SUPER_ADMIN_NAME !== 'undefined' ? String(SUPER_ADMIN_NAME) : 'Irwin').trim().toLowerCase();
      return !!n && n === s;
    } catch (_) { return false; }
  }
  function phone() { return !!(document.body && document.body.classList.contains('iba-mobile-ui')); }
  function mainDb() { try { return (typeof db !== 'undefined' && db) ? db : firebase.database(); } catch (_) { return null; } }
  function invDb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb) ? invoiceDb : null; } catch (_) { return null; } }
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function when(e) {
    var d = String(e.date || '').trim(), m;
    if ((m = d.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/](\d{4})$/)) && MON[m[2].toLowerCase()] !== undefined) return new Date(+m[3], MON[m[2].toLowerCase()], +m[1]).getTime();
    if ((m = d.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    var t = Number(e.timestamp || e.enteredAt || e.createdAt || 0);
    return t > 0 ? t : 0;
  }
  function norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : NaN; }
  function money(v) { var n = num(v); return isFinite(n) && String(v).trim() ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : esc(v || ''); }
  function jobs() {
    var list = [];
    try { list = Array.isArray(allSystemEntries) ? allSystemEntries : []; } catch (_) {}
    return list.filter(function (e) {
      if (!e || !e.key || e.source && e.source !== 'job_entry') return false;
      var type = String(e.for || e.type || '').trim();
      if (!/^invoice$/i.test(type)) return false;
      var st = String(e.remarks || e.status || '').trim();
      return !DONE.test(st) && !e.convertedToInvoice && !e.archived;
    });
  }

  var state = null;
  function layer() {
    var w = document.getElementById('iba-tidy-pop');
    if (w) return w;
    w = document.createElement('div');
    w.id = 'iba-tidy-pop';
    w.className = 'iba-pb-layer';
    document.body.appendChild(w);
    w.addEventListener('click', onClick);
    w.addEventListener('change', onChange);
    w.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !(state && state.busy)) { e.stopPropagation(); close(); } });
    return w;
  }
  function close() { var w = document.getElementById('iba-tidy-pop'); if (w) w.remove(); state = null; }
  function defDate() { return '2026-08-01'; }
  function paint() {
    var w = layer(), s = state;
    var head = '<div class="iba-pb-head"><b><i class="fa-solid fa-broom"></i> Tidy old jobs</b><button type="button" data-tx aria-label="Close"' + (s.busy ? ' disabled' : '') + '>✕</button></div>';
    var pick = '<div class="iba-pb-sub iba-tidy-pick">Open <b>Invoice</b> jobs entered before <input type="date" data-tdate value="' + esc(s.date) + '"' + (s.busy ? ' disabled' : '') + '> ' +
      '<button type="button" data-tcheck' + (s.busy ? ' disabled' : '') + '><i class="fa-solid fa-magnifying-glass"></i> Check</button>' +
      '<br><small>Each PO is checked in Invoice Entry one by one (small reads). Nothing changes until you press Confirm.</small></div>';
    var body = '';
    if (s.msg) body += '<div class="iba-pb-sub iba-tidy-msg">' + s.msg + '</div>';
    if (s.found || s.lost) {
      var f = s.found || [], l = s.lost || [];
      body += '<div class="iba-pb-sub"><b>' + s.checked + '</b> old jobs checked · <b class="iba-tidy-ok">' + f.length + '</b> found in Invoice Entry (will be marked <b>Converted to Invoice</b>) · <b class="iba-tidy-warn">' + l.length + '</b> not found (choose below)</div>';
      if (l.length) {
        body += '<div class="iba-tidy-tblwrap"><table class="iba-tidy-tbl"><thead><tr><th>PO</th><th>Invoice / Ref</th><th>Vendor</th><th class="r">Amount</th><th>Date</th><th>Status</th><th>Why</th><th>Do</th></tr></thead><tbody>' +
          l.map(function (x, i) {
            return '<tr><td class="m">' + esc(x.job.po) + '</td><td>' + esc(x.job.ref || '—') + '</td><td>' + esc(x.job.vendorName || '') + '</td><td class="r">' + money(x.job.amount) + '</td><td>' + esc(x.job.date || '') + '</td><td>' + esc(x.job.remarks || '') + '</td><td><small>' + esc(x.why) + '</small></td>' +
              '<td><select data-tdo="' + i + '"' + (s.busy ? ' disabled' : '') + '><option value="leave"' + (x.do === 'leave' ? ' selected' : '') + '>Leave</option><option value="cancel"' + (x.do === 'cancel' ? ' selected' : '') + '>Cancel</option><option value="remove"' + (x.do === 'remove' ? ' selected' : '') + '>Remove</option></select></td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="iba-pb-sub"><small>Set all not found to: <button type="button" data-tall="leave">Leave</button> <button type="button" data-tall="cancel">Cancel</button> <button type="button" data-tall="remove">Remove</button></small></div>';
      }
      if (f.length) {
        body += '<details class="iba-tidy-found"><summary>Show the ' + f.length + ' found</summary><div class="iba-tidy-tblwrap"><table class="iba-tidy-tbl"><thead><tr><th>PO</th><th>Job ref</th><th class="r">Amount</th><th>Date</th><th>Invoice found</th><th>Its status</th></tr></thead><tbody>' +
          f.map(function (x) { return '<tr><td class="m">' + esc(x.job.po) + '</td><td>' + esc(x.job.ref || '—') + '</td><td class="r">' + money(x.job.amount) + '</td><td>' + esc(x.job.date || '') + '</td><td>' + esc(x.inv.invNumber || x.inv.invEntryID || x.key) + '</td><td>' + esc(x.inv.status || '') + '</td></tr>'; }).join('') +
          '</tbody></table></div></details>';
      }
    }
    var nC = (s.lost || []).filter(function (x) { return x.do === 'cancel'; }).length, nR = (s.lost || []).filter(function (x) { return x.do === 'remove'; }).length, nF = (s.found || []).length;
    var total = nF + nC + nR;
    var foot = '<div class="iba-pb-foot"><span>' + (s.progress || '') + '</span><button type="button" data-tx' + (s.busy ? ' disabled' : '') + '>' + (s.doneAll ? 'Close' : 'Cancel') + '</button>' +
      (s.found || s.lost ? '<button type="button" data-tgo class="is-main"' + (!total || s.busy || s.doneAll ? ' disabled' : '') + '>Confirm (' + [nF ? nF + ' converted' : '', nC ? nC + ' cancelled' : '', nR ? nR + ' removed' : ''].filter(Boolean).join(', ') + (total ? '' : 'nothing to do') + ')</button>' : '') + '</div>';
    w.innerHTML = '<div class="iba-pb-box iba-tidy-box" role="dialog" aria-modal="true">' + head + pick + body + foot + '</div>';
  }
  function onChange(e) {
    var t = e.target;
    if (t.hasAttribute('data-tdate')) { state.date = t.value; }
    if (t.hasAttribute('data-tdo')) { var x = state.lost[+t.getAttribute('data-tdo')]; if (x) x.do = t.value; paint(); }
  }
  function onClick(e) {
    var w = document.getElementById('iba-tidy-pop');
    if (e.target === w) { if (!state.busy) close(); return; }
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-tx')) return close();
    if (b.hasAttribute('data-tcheck')) return check();
    if (b.hasAttribute('data-tall')) { (state.lost || []).forEach(function (x) { x.do = b.getAttribute('data-tall'); }); return paint(); }
    if (b.hasAttribute('data-tgo')) return apply();
  }

  async function check() {
    var s = state;
    var cut = new Date(s.date + 'T00:00:00').getTime();
    if (!isFinite(cut)) { s.msg = 'Pick a date first.'; return paint(); }
    var all = jobs();
    if (!all.length) { s.msg = 'Job Records is not loaded yet. Open Job Records, wait for the list, then press Check again.'; s.found = s.lost = null; return paint(); }
    var old = all.filter(function (j) { var t = when(j); return t && t < cut; });
    s.msg = ''; s.found = null; s.lost = null; s.checked = old.length; s.busy = true; s.doneAll = false;
    if (!old.length) { s.busy = false; s.msg = 'No open Invoice jobs before ' + esc(s.date) + '. Nothing to tidy.'; return paint(); }
    var pos = []; old.forEach(function (j) { var p = String(j.po || '').trim(); if (p && pos.indexOf(p) < 0) pos.push(p); });
    var d = invDb(); if (!d) { s.busy = false; s.msg = 'Invoice database not ready. Try again in a moment.'; return paint(); }
    var data = {}, n = 0;
    s.progress = 'Checking 0 / ' + pos.length + ' POs…'; paint();
    var q = pos.slice();
    async function worker() {
      while (q.length) {
        var po = q.shift();
        try { data[po] = (await d.ref('invoice_entries/' + po).once('value')).val() || {}; } catch (err) { data[po] = null; }
        n++; if (n % 5 === 0 || n === pos.length) { s.progress = 'Checking ' + n + ' / ' + pos.length + ' POs…'; var sp = document.querySelector('#iba-tidy-pop .iba-pb-foot span'); if (sp) sp.textContent = s.progress; }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    var found = [], lost = [], usedInv = {};
    old.forEach(function (j) {
      var po = String(j.po || '').trim(), invs = po ? data[po] : null;
      if (!po) { lost.push({ job: j, why: 'No PO on the job', do: 'leave' }); return; }
      if (invs === null) { lost.push({ job: j, why: 'Could not read this PO', do: 'leave' }); return; }
      var keys = Object.keys(invs || {}).filter(function (k) { return invs[k] && typeof invs[k] === 'object' && !usedInv[po + '/' + k]; });
      if (!keys.length) { lost.push({ job: j, why: 'PO has no invoices in Invoice Entry', do: 'leave' }); return; }
      var ref = norm(j.ref), hit = null;
      if (ref) hit = keys.find(function (k) { return norm(invs[k].invNumber) === ref || norm(invs[k].invoiceNo) === ref; }) || null;
      if (!hit && ref) hit = keys.find(function (k) { var a = norm(invs[k].invNumber); return a && ref.length >= 4 && (a.endsWith(ref) || ref.endsWith(a)); }) || null;
      if (!hit) {
        var amt = num(j.amount);
        if (isFinite(amt) && amt > 0) {
          var same = keys.filter(function (k) { return Math.abs(num(invs[k].invValue) - amt) < 0.01; });
          if (same.length === 1) hit = same[0];
          else if (same.length > 1) { lost.push({ job: j, why: same.length + ' invoices with this amount, can’t tell which', do: 'leave' }); return; }
        }
      }
      if (hit) { usedInv[po + '/' + hit] = true; found.push({ job: j, po: po, key: hit, inv: invs[hit] }); }
      else lost.push({ job: j, why: ref ? 'Invoice no. ' + j.ref + ' not on this PO' : 'No invoice no. and no amount match', do: 'leave' });
    });
    s.found = found; s.lost = lost; s.busy = false; s.progress = '';
    paint();
  }

  async function apply() {
    var s = state, d = mainDb(); if (!d) return;
    var TS = firebase.database.ServerValue.TIMESTAMP, today = (typeof formatDate === 'function') ? formatDate(new Date()) : '';
    var todo = (s.found || []).map(function (x) { return { t: 'conv', x: x }; })
      .concat((s.lost || []).filter(function (x) { return x.do !== 'leave'; }).map(function (x) { return { t: x.do, x: x }; }));
    if (!todo.length) return;
    s.busy = true; paint();
    var ok = 0, bad = 0;
    for (var i = 0; i < todo.length; i++) {
      var it = todo[i], j = it.x.job, up, note, action;
      if (it.t === 'conv') {
        var inv = it.x.inv || {};
        up = { status: 'Completed', archived: true, updatedAt: TS, updatedBy: me(), dateResponded: today, statusChangedAt: TS, statusQueueAt: TS,
          for: 'Invoice', remarks: 'Converted to Invoice', convertedToInvoice: true, convertedFromFor: j.for || 'Invoice',
          linkedInvoiceKey: it.x.key, linkedInvoicePO: it.x.po, invoiceWorkflowStatus: inv.status || '', linkedInvoiceStatus: inv.status || '',
          invoiceConvertedFrom: j.for || 'Job Entry', invoiceConvertedBy: me(), invoiceConvertedAt: TS, alreadyEntered: true, tidiedAt: TS };
        action = 'Already entered'; note = 'Tidy old jobs: linked to the existing invoice ' + (inv.invNumber || inv.invEntryID || it.x.key) + ' / PO ' + it.x.po + (inv.status ? ' (' + inv.status + ')' : '') + '.';
      } else if (it.t === 'cancel') {
        up = { remarks: 'Cancelled', status: 'Cancelled', attention: '', cancelledBy: me(), cancelledAt: TS, cancelReason: 'Old job (tidy)', updatedAt: TS, updatedBy: me(), dateResponded: today, statusChangedAt: TS, statusQueueAt: TS, tidiedAt: TS };
        action = 'Cancelled'; note = 'Tidy old jobs: cancelled (old job, invoice not found in Invoice Entry).';
      } else {
        up = { remarks: 'Removed', status: 'Completed', archived: true, removedBy: me(), removedAt: TS, removedReason: 'Old job (tidy)', updatedAt: TS, updatedBy: me(), dateResponded: today, statusChangedAt: TS, statusQueueAt: TS, tidiedAt: TS };
        action = 'Removed'; note = 'Tidy old jobs: removed (old job, invoice not found in Invoice Entry).';
      }
      try {
        await d.ref('job_entries/' + j.key).update(up);
        try { await d.ref('job_entries/' + j.key + '/history').push({ action: action, by: me(), timestamp: TS, note: note }); } catch (_) {}
        try {
          var local = Object.assign({}, j, up, { key: j.key, source: 'job_entry', updatedAt: Date.now(), tidiedAt: Date.now(), statusChangedAt: Date.now(), statusQueueAt: Date.now(), invoiceConvertedAt: Date.now(), cancelledAt: Date.now(), removedAt: Date.now() });
          Object.assign(j, local);
          if (typeof wdUpsertLocalWorkdeskJobEntryCache === 'function') wdUpsertLocalWorkdeskJobEntryCache(j.key, local);
          if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await Promise.resolve(wdWriteWorkdeskJobRecentMarker(j.key, local, 'updated')).catch(function () {});
        } catch (_) {}
        ok++;
      } catch (err) { bad++; console.warn('[tidy] not saved', j.key, err); }
      if (i % 5 === 4 || i === todo.length - 1) { var sp = document.querySelector('#iba-tidy-pop .iba-pb-foot span'); if (sp) sp.textContent = 'Saving ' + (i + 1) + ' / ' + todo.length + '…'; }
    }
    s.busy = false; s.doneAll = true; s.progress = '';
    s.msg = '<b>Done.</b> ' + ok + ' job' + (ok === 1 ? '' : 's') + ' updated' + (bad ? ', <b class="iba-tidy-warn">' + bad + ' could not be saved</b> (check the internet and run again)' : '') + '. Each one has a line in its History.';
    s.found = null; s.lost = null;
    paint();
    try { if (typeof imInvalidateActiveJobsSidebarCache === 'function') imInvalidateActiveJobsSidebarCache(); } catch (_) {}
    try { if (typeof handleReportingSearch === 'function') handleReportingSearch({ reason: 'tidy' }); } catch (_) {}
  }

  function open() {
    if (!isSuper()) return;
    state = { date: defDate(), found: null, lost: null, msg: '', checked: 0, busy: false };
    paint();
  }
  // a small button next to Clear on Job Records (Super Admin, PC)
  function addButton() {
    var clear = document.getElementById('reporting-clear-button');
    var b = document.getElementById('iba-tidy-btn');
    var inv = false; try { inv = typeof wdReportIsInventoryMode === 'function' && wdReportIsInventoryMode(); } catch (_) {}
    var want = clear && isSuper() && !phone() && !inv;
    if (!want) { if (b) b.remove(); return; }
    if (b) return;
    b = document.createElement('button');
    b.type = 'button'; b.id = 'iba-tidy-btn'; b.className = 'secondary-btn wd-clear-chip';
    b.title = 'Close old Invoice jobs that are already in Invoice Entry';
    b.innerHTML = '<i class="fa-solid fa-broom"></i> Tidy old jobs';
    b.addEventListener('click', open);
    clear.insertAdjacentElement('afterend', b);
  }
  setInterval(addButton, 2500);
  window.ibaTidyJobs = open;
  window.ibaTidyJobs._when = when;
})();
