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
        up = { remarks: 'Removed', status: 'Completed', archived: true, removedBy: me(), removedAt: TS, removedReason: 'Old job (tidy)', removedPrevRemarks: String(j.remarks || ''), removedPrevStatus: String(j.status || ''), removedPrevArchived: !!j.archived, updatedAt: TS, updatedBy: me(), dateResponded: today, statusChangedAt: TS, statusQueueAt: TS, tidiedAt: TS };
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
  // ======================================================================
  // 18.0.0 patch 57 (martin): Recycle Bin. Removed WorkDesk jobs (by IRIS voice, Tidy old jobs, "Remove reception
  // entry") are listed with who/when; Restore puts a job back, Delete forever erases it.
  // 18.0.0 patch 91 (martin): Inventory tab = Material Stock cards deleted by the Super Admin (copy kept in
  // inventory db recycle_bin/inventory/<key> with the transactions deleted with it, materialStock.js).
  // Tick boxes + Select all + Restore selected / Delete selected forever on both tabs. Invoice tab still "soon".
  // ======================================================================
  var bin = null;
  function removedJobs() {
    var list = [];
    try { list = Array.isArray(allSystemEntries) ? allSystemEntries : []; } catch (_) {}
    return list.filter(function (e) { return e && e.key && (!e.source || e.source === 'job_entry') && /^removed$/i.test(String(e.remarks || '').trim()); })
      .sort(function (a, b) { return (Number(b.removedAt) || 0) - (Number(a.removedAt) || 0); });
  }
  function stockDb() { try { return (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : (typeof getInventoryDatabase === 'function' ? getInventoryDatabase() : null); } catch (_) { return null; } }
  async function loadInv() {
    var d = stockDb(); if (!d) { bin.inv = []; return; }
    try {
      var v = (await d.ref('recycle_bin/inventory').once('value')).val() || {};
      bin.inv = Object.keys(v).map(function (k) { return Object.assign({ key: k }, v[k]); }).sort(function (a, b) { return (Number(b.deletedAt) || 0) - (Number(a.deletedAt) || 0); });
    } catch (err) { bin.inv = []; bin.msg = '<b class="iba-tidy-warn">Could not read the Inventory bin:</b> ' + esc((err && err.message) || err); }
  }
  function fmtAt(t) { t = Number(t); if (!t) return ''; var d = new Date(t); return (typeof formatDate === 'function' ? formatDate(d) : d.toDateString()) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function curRows() { return bin.tab === 'inv' ? (bin.inv || []) : removedJobs(); }
  function selKeys() { var have = {}; curRows().forEach(function (r) { have[r.key] = 1; }); return Object.keys(bin.sel).filter(function (k) { return bin.sel[k] && have[k]; }); }
  function actCell(key, s) {
    if (s.ask === key) return '<span class="iba-tidy-warn">Erase for good?</span> <button type="button" data-bin-del2="' + esc(key) + '" class="is-danger">Yes, delete</button> <button type="button" data-bin-no>No</button>';
    return '<button type="button" data-bin-res="' + esc(key) + '"' + (s.busy ? ' disabled' : '') + '><i class="fa-solid fa-rotate-left"></i> Restore</button> <button type="button" data-bin-del="' + esc(key) + '" class="is-danger"' + (s.busy ? ' disabled' : '') + '><i class="fa-solid fa-trash"></i> Delete forever</button>';
  }
  function tick(key) { return '<td class="iba-bin-ck"><input type="checkbox" data-bin-sel="' + esc(key) + '"' + (bin.sel[key] ? ' checked' : '') + (bin.busy ? ' disabled' : '') + ' aria-label="Select"></td>'; }
  function binPaint() {
    var w = document.getElementById('iba-bin-pop');
    if (!w) {
      w = document.createElement('div'); w.id = 'iba-bin-pop'; w.className = 'iba-pb-layer'; document.body.appendChild(w);
      w.addEventListener('click', binClick);
      w.addEventListener('change', function (e) {
        var c = e.target; if (!c || c.type !== 'checkbox' || !bin) return;
        if (c.hasAttribute('data-bin-all')) { curRows().forEach(function (r) { bin.sel[r.key] = c.checked; }); }
        else if (c.hasAttribute('data-bin-sel')) { bin.sel[c.getAttribute('data-bin-sel')] = c.checked; }
        bin.ask = ''; binPaint();
      });
      w.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bin.busy) { e.stopPropagation(); binClose(); } });
    }
    var s = bin, jobs = removedJobs(), inv = s.inv, rows = curRows(), sel = selKeys(), n = sel.length;
    var tabs = '<div class="iba-bin-tabs"><button type="button" data-bin-tab="wd" class="' + (s.tab === 'wd' ? 'is-on' : '') + '">WorkDesk (' + jobs.length + ')</button>' +
      '<button type="button" disabled title="Coming in a later update">Invoice · soon</button>' +
      '<button type="button" data-bin-tab="inv" class="' + (s.tab === 'inv' ? 'is-on' : '') + '">Inventory' + (inv ? ' (' + inv.length + ')' : '') + '</button></div>';
    var all = rows.length && n === rows.length;
    var bar = rows.length ? '<div class="iba-bin-bulk">' + (n
      ? (s.ask === '__bulk'
        ? '<span class="iba-tidy-warn">Erase ' + n + ' for good? This cannot be undone.</span> <button type="button" data-bin-bdel2 class="is-danger">Yes, delete ' + n + '</button> <button type="button" data-bin-no>No</button>'
        : '<b>' + n + ' selected</b> <button type="button" data-bin-bres' + (s.busy ? ' disabled' : '') + '><i class="fa-solid fa-rotate-left"></i> Restore selected (' + n + ')</button> <button type="button" data-bin-bdel class="is-danger"' + (s.busy ? ' disabled' : '') + '><i class="fa-solid fa-trash"></i> Delete selected forever (' + n + ')</button> <button type="button" data-bin-clr class="is-plain">Clear</button>')
      : '<small>Tick the boxes to restore or delete several at once.</small>') + '</div>' : '';
    var head = '<th class="iba-bin-ck"><input type="checkbox" data-bin-all' + (all ? ' checked' : '') + (s.busy ? ' disabled' : '') + ' aria-label="Select all" title="Select all"></th>';
    var body;
    if (s.tab === 'inv') {
      body = !inv ? '<div class="iba-pb-sub">Loading the Inventory bin…</div>' : inv.length ? '<div class="iba-tidy-tblwrap"><table class="iba-tidy-tbl"><thead><tr>' + head + '<th>Product ID</th><th>Item</th><th>Details</th><th class="r">Balance</th><th class="r">History</th><th>Deleted by</th><th>When</th><th></th></tr></thead><tbody>' +
        inv.map(function (e) {
          var it = e.item || {};
          return '<tr>' + tick(e.key) + '<td class="m">' + esc(e.productID || it.productID || it.productId || '') + '</td><td>' + esc(e.productName || it.productName || '') + '</td><td><small>' + esc(it.details || '') + '</small></td><td class="r">' + esc(it.balanceQty != null ? it.balanceQty : '') + (it.unit ? ' ' + esc(it.unit) : '') + '</td><td class="r">' + (Number(e.txCount) || 0) + ' moves</td><td>' + esc(e.deletedBy || '') + '</td><td>' + esc(fmtAt(e.deletedAt)) + '</td><td class="iba-bin-act">' + actCell(e.key, s) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="iba-pb-sub">The Inventory bin is empty. Material Stock items you delete show here.</div>';
    } else {
      body = jobs.length ? '<div class="iba-tidy-tblwrap"><table class="iba-tidy-tbl"><thead><tr>' + head + '<th>Type</th><th>PO</th><th>Ref</th><th>Vendor</th><th class="r">Amount</th><th>Entered</th><th>Removed by</th><th>When</th><th>Why</th><th></th></tr></thead><tbody>' +
        jobs.map(function (e) {
          return '<tr>' + tick(e.key) + '<td>' + esc(e.for || 'Job') + '</td><td class="m">' + esc(e.po || '') + '</td><td>' + esc(e.ref || '—') + '</td><td>' + esc(e.vendorName || '') + '</td><td class="r">' + money(e.amount) + '</td><td>' + esc(e.date || '') + '</td><td>' + esc(e.removedBy || e.updatedBy || '') + '</td><td>' + esc(fmtAt(e.removedAt)) + '</td><td><small>' + esc(e.removedReason || '') + '</small></td><td class="iba-bin-act">' + actCell(e.key, s) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="iba-pb-sub">The bin is empty. Removed jobs show here (if Job Records is not loaded yet, open it first).</div>';
    }
    var foot = s.tab === 'inv' ? 'Restore puts the item card (and its history) back in Material Stock. Delete forever cannot be undone.' : 'Restore puts a job back where it was. Delete forever cannot be undone.';
    w.innerHTML = '<div class="iba-pb-box iba-tidy-box" role="dialog" aria-modal="true"><div class="iba-pb-head"><b><i class="fa-solid fa-trash-can-arrow-up"></i> Recycle Bin</b><button type="button" data-bin-x aria-label="Close">✕</button></div>' + tabs +
      (s.msg ? '<div class="iba-pb-sub iba-tidy-msg">' + s.msg + '</div>' : '') + bar + body + '<div class="iba-pb-foot"><span><small>' + foot + '</small></span><button type="button" data-bin-x>Close</button></div></div>';
  }
  function binClose() { var w = document.getElementById('iba-bin-pop'); if (w) w.remove(); bin = null; }
  function findJob(key) { var r = removedJobs(); for (var i = 0; i < r.length; i++) if (r[i].key === key) return r[i]; return null; }
  function findInv(key) { var r = bin.inv || []; for (var i = 0; i < r.length; i++) if (r[i].key === key) return r[i]; return null; }
  function label(x) { return bin.tab === 'inv' ? esc(x.productName || (x.item && x.item.productName) || x.productID || 'item') : esc((x.for || 'Job') + (x.po ? ' · PO ' + x.po : '')); }

  async function restoreJob(j) {
    var d = mainDb(); var TS = firebase.database.ServerValue.TIMESTAMP;
    var back = String(j.removedPrevRemarks || '').trim();
    if (!back || /^removed$/i.test(back)) back = /^invoice$/i.test(String(j.for || '')) ? 'Under Review' : 'Pending';
    var up = { remarks: back, status: String(j.removedPrevStatus || '') || null, archived: j.removedPrevArchived === true ? true : null, removedBy: null, removedAt: null, removedReason: null,
      removedPrevRemarks: null, removedPrevStatus: null, removedPrevArchived: null, restoredBy: me(), restoredAt: TS, updatedAt: TS, updatedBy: me(), statusChangedAt: TS, statusQueueAt: TS };
    await d.ref('job_entries/' + j.key).update(up);
    try { await d.ref('job_entries/' + j.key + '/history').push({ action: 'Restored', by: me(), timestamp: TS, note: 'Restored from the Recycle Bin (back to ' + back + ').' }); } catch (_) {}
    var local = Object.assign({}, j, { remarks: back, status: up.status || '', archived: up.archived === true, restoredBy: me(), restoredAt: Date.now(), updatedAt: Date.now() });
    ['removedBy', 'removedAt', 'removedReason', 'removedPrevRemarks', 'removedPrevStatus', 'removedPrevArchived'].forEach(function (k) { delete local[k]; delete j[k]; });
    Object.assign(j, local);
    try { if (typeof wdUpsertLocalWorkdeskJobEntryCache === 'function') wdUpsertLocalWorkdeskJobEntryCache(j.key, local); if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await Promise.resolve(wdWriteWorkdeskJobRecentMarker(j.key, local, 'updated')).catch(function () {}); } catch (_) {}
    return back;
  }
  async function deleteJob(j) {
    var d = mainDb();
    await d.ref('job_entries/' + j.key).remove();
    try { if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await wdWriteWorkdeskJobRecentMarker(j.key, j, 'deleted'); } catch (_) {}
    try { if (typeof wdRemoveLocalWorkdeskJobEntryCache === 'function') wdRemoveLocalWorkdeskJobEntryCache(j.key); } catch (_) {}
    try { var i = allSystemEntries.indexOf(j); if (i >= 0) allSystemEntries.splice(i, 1); } catch (_) {}
  }
  async function restoreInv(e) {
    var d = stockDb(); var TS = firebase.database.ServerValue.TIMESTAMP;
    if (!e.item) throw new Error('no saved copy of the card');
    if ((await d.ref('material_stock/' + e.key).once('value')).exists()) throw new Error('a card with the same key is already in Material Stock');
    var up = {};
    up['material_stock/' + e.key] = Object.assign({}, e.item, { restoredBy: me(), restoredAt: TS });
    up['material_stock_meta/count'] = firebase.database.ServerValue.increment(1);
    up['material_stock_meta/updatedAt'] = TS;
    Object.keys(e.transfers || {}).forEach(function (k) { up['transfer_entries/' + k] = e.transfers[k]; });
    up['recycle_bin/inventory/' + e.key] = null;
    await d.ref().update(up);
    try { if (window.inventoryPocket && window.inventoryPocket.publishMaterialByKey) await window.inventoryPocket.publishMaterialByKey(e.key); } catch (_) {}
    stockChanged();
  }
  async function deleteInv(e) { await stockDb().ref('recycle_bin/inventory/' + e.key).remove(); }
  function stockChanged() {
    try { localStorage.removeItem('cached_MATERIAL_STOCK'); } catch (_) {}
    clearTimeout(stockChanged.t);
    stockChanged.t = setTimeout(function () { try { if (typeof populateMaterialStock === 'function') populateMaterialStock(true); } catch (_) {} }, 400);
  }
  function after() {
    if (bin && bin.tab !== 'inv') { try { if (typeof handleReportingSearch === 'function') handleReportingSearch({ reason: 'bin' }); } catch (_) {} }
  }
  async function run(list, fn) {
    var ok = 0, bad = [];
    for (var i = 0; i < list.length; i++) {
      try { await fn(list[i]); ok++; delete bin.sel[list[i].key]; } catch (err) { bad.push(label(list[i]) + ': ' + esc((err && err.message) || err)); }
    }
    return { ok: ok, bad: bad };
  }
  async function binClick(e) {
    var w = document.getElementById('iba-bin-pop');
    if (e.target === w) { if (!bin.busy) binClose(); return; }
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-bin-x')) return binClose();
    if (b.hasAttribute('data-bin-tab')) {
      bin.tab = b.getAttribute('data-bin-tab'); bin.sel = {}; bin.ask = ''; bin.msg = ''; binPaint();
      if (bin.tab === 'inv' && !bin.inv) { await loadInv(); if (bin) binPaint(); }
      return;
    }
    if (b.hasAttribute('data-bin-no')) { bin.ask = ''; return binPaint(); }
    if (b.hasAttribute('data-bin-clr')) { bin.sel = {}; bin.ask = ''; return binPaint(); }
    if (b.hasAttribute('data-bin-del')) { bin.ask = b.getAttribute('data-bin-del'); return binPaint(); }
    if (b.hasAttribute('data-bin-bdel')) { bin.ask = '__bulk'; return binPaint(); }
    var inv = bin.tab === 'inv', find = inv ? findInv : findJob;
    var res = inv ? restoreInv : restoreJob, del = inv ? deleteInv : deleteJob, list = null, mode = '';
    if (b.hasAttribute('data-bin-res')) { list = [find(b.getAttribute('data-bin-res'))]; mode = 'res'; }
    else if (b.hasAttribute('data-bin-del2')) { list = [find(b.getAttribute('data-bin-del2'))]; mode = 'del'; }
    else if (b.hasAttribute('data-bin-bres')) { list = selKeys().map(find); mode = 'res'; }
    else if (b.hasAttribute('data-bin-bdel2')) { list = selKeys().map(find); mode = 'del'; }
    if (!mode) return;
    list = list.filter(Boolean); if (!list.length) return;
    if (!(inv ? stockDb() : mainDb())) return;
    bin.busy = true; bin.ask = ''; bin.msg = (mode === 'res' ? 'Restoring ' : 'Deleting ') + list.length + '…'; binPaint();
    var r = await run(list, mode === 'res' ? res : del);
    if (inv) await loadInv();
    if (!bin) return;
    var what = list.length === 1 ? label(list[0]) : r.ok + ' of ' + list.length;
    bin.msg = r.ok ? (mode === 'res' ? 'Restored: ' : 'Deleted forever: ') + what + (mode === 'res' && !inv && list.length === 1 ? ' (back to <b>' + esc(list[0].remarks || '') + '</b>)' : '') + '.' : '';
    if (r.bad.length) bin.msg += (bin.msg ? '<br>' : '') + '<b class="iba-tidy-warn">Not ' + (mode === 'res' ? 'restored' : 'deleted') + ':</b> ' + r.bad.join('; ');
    bin.busy = false; binPaint(); after();
  }
  function openBin(tab) {
    if (!isSuper()) return;
    bin = { tab: tab === 'inv' ? 'inv' : 'wd', sel: {}, inv: null, ask: '', msg: '', busy: false }; binPaint();
    loadInv().then(function () { if (bin) binPaint(); });
  }

  // 18.0.0 patch 60 (martin): ONE "More tools" button next to Clear on Job Records (Super Admin, PC);
  // Tidy old jobs and Recycle Bin are inside its little menu
  function closeMenu() { var m = document.getElementById('iba-jr-tools-menu'); if (m) m.hidden = true; }
  function addButton() {
    var clear = document.getElementById('reporting-clear-button');
    var w = document.getElementById('iba-jr-tools');
    ['iba-tidy-btn', 'iba-bin-btn'].forEach(function (id) { var o = document.getElementById(id); if (o) o.remove(); });
    var inv = false; try { inv = typeof wdReportIsInventoryMode === 'function' && wdReportIsInventoryMode(); } catch (_) {}
    var want = clear && isSuper() && !phone() && !inv;
    if (!want) { if (w) w.remove(); return; }
    if (w) return;
    w = document.createElement('span');
    w.id = 'iba-jr-tools'; w.className = 'iba-jr-tools';
    w.innerHTML = '<button type="button" class="secondary-btn wd-clear-chip" data-jr-tools aria-haspopup="true" title="More tools"><i class="fa-solid fa-toolbox"></i> More tools <i class="fa-solid fa-chevron-down iba-jr-caret"></i></button>' +
      '<span class="iba-jr-tools-menu" id="iba-jr-tools-menu" role="menu" hidden>' +
      '<button type="button" role="menuitem" data-jr-tidy><i class="fa-solid fa-broom"></i><span><b>Tidy old jobs</b><small>Close old Invoice jobs already in Invoice Entry</small></span></button>' +
      '<button type="button" role="menuitem" data-jr-bin><i class="fa-solid fa-trash-can-arrow-up"></i><span><b>Recycle Bin</b><small>Removed jobs: restore or delete forever</small></span></button>' +
      '</span>';
    clear.insertAdjacentElement('afterend', w);
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    var w = document.getElementById('iba-jr-tools');
    if (!w) return;
    if (!t || !w.contains(t)) return closeMenu();
    if (t.closest('[data-jr-tools]')) { var m = document.getElementById('iba-jr-tools-menu'); if (m) m.hidden = !m.hidden; return; }
    if (t.closest('[data-jr-tidy]')) { closeMenu(); return open(); }
    if (t.closest('[data-jr-bin]')) { closeMenu(); return openBin('wd'); }
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  // 18.0.0 patch 91 (martin): Material Stock gets its own "Recycle Bin" button (Super Admin, PC), opens the Inventory tab
  function addMsButton() {
    var anchor = document.getElementById('ms-open-report-modal-btn');
    var btn = document.getElementById('iba-ms-bin-btn');
    var want = anchor && isSuper() && !phone();
    if (!want) { if (btn) btn.remove(); return; }
    if (btn) return;
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'iba-ms-bin-btn'; btn.className = 'secondary-btn'; btn.title = 'Deleted stock items: restore or delete forever';
    btn.innerHTML = '<i class="fa-solid fa-trash-can-arrow-up"></i> Recycle Bin';
    btn.addEventListener('click', function (e) { e.preventDefault(); openBin('inv'); });
    anchor.insertAdjacentElement('afterend', btn);
  }
  window.ibaRecycleBin = openBin;
  setInterval(function () { addButton(); addMsButton(); }, 2500);
  window.ibaTidyJobs = open;
  window.ibaTidyJobs._when = when;
})();
