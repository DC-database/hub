/* 18.0.0 patch 88 (martin): move Summary Note rows by hand before printing.
   Only the Super Admin (or the active vacation replacement, until the return date: isVacationDelegateUser).
   Each row gets small up/down buttons (icons only, so the print text is unchanged) and the table gets
   "Reset order". The order is remembered per note on this PC (localStorage iba-sn-order-v1).
   The print (#sn-c) and the Per PO box read the rows from the screen, so they follow this order.
   18.0.0 patch 93: the order is also saved in the invoice db (summary_note_order/<note>), so it is the same
   on every PC; this PC's copy is only the fallback when there is no connection. */
(function () {
  var KEY = 'iba-sn-order-v1';
  var busy = false;
  function $(id) { return document.getElementById(id); }
  function allowed() {
    try {
      var me = (typeof currentApprover !== 'undefined' && currentApprover) ? String(currentApprover.Name || '').trim().toLowerCase() : '';
      var sa = (typeof SUPER_ADMIN_NAME !== 'undefined') ? String(SUPER_ADMIN_NAME).trim().toLowerCase() : 'irwin';
      if (me && me === sa) return true;
      return typeof isVacationDelegateUser === 'function' && !!isVacationDelegateUser();
    } catch (_) { return false; }
  }
  function noteKey() { var i = $('summary-note-current-input'); return String((i && i.value) || '').trim().toLowerCase(); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } }
  function store(o) {
    try {
      var ks = Object.keys(o); if (ks.length > 200) ks.slice(0, ks.length - 200).forEach(function (k) { delete o[k]; });
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (_) {}
  }
  function rows() { var b = $('sn-table-body'); return b ? Array.prototype.slice.call(b.querySelectorAll(':scope > tr')) : []; }
  function saved() { var n = noteKey(); return n ? load()[n] || null : null; }
  function save() {
    var n = noteKey(); if (!n) return;
    var o = load(); o[n] = rows().map(function (tr) { return tr.getAttribute('data-key') || ''; }); store(o);
    push(n, o[n]);
  }
  function reset() { var n = noteKey(); var o = load(); delete o[n]; store(o); var r = dbRef(n); if (r) r.remove().catch(function () {}); }

  // p93: shared copy in the invoice db. Read once per note per page (a few bytes), written on every move.
  var fetched = {};
  function dbRef(n) {
    try {
      var d = (typeof invoiceDb !== 'undefined' && invoiceDb) ? invoiceDb : null;
      if (!d || !n) return null;
      return d.ref('summary_note_order/' + n.replace(/[.#$\[\]\/]/g, '_').slice(0, 300));
    } catch (_) { return null; }
  }
  function me() { try { return (currentApprover && currentApprover.Name) || ''; } catch (_) { return ''; } }
  function push(n, keys) {
    var r = dbRef(n); if (!r) return;
    r.set({ keys: keys, by: me(), at: firebase.database.ServerValue.TIMESTAMP }).catch(function (e) { console.warn('[sn order] not saved online', e); });
  }
  function pull(n) {
    if (!n || fetched[n]) return; fetched[n] = 1;
    var r = dbRef(n); if (!r) return;
    r.once('value').then(function (snap) {
      var v = snap && snap.val ? snap.val() : null, o = load();
      if (v && Array.isArray(v.keys)) {
        if (JSON.stringify(o[n] || null) === JSON.stringify(v.keys)) return;
        o[n] = v.keys; store(o);
      } else if (o[n]) { push(n, o[n]); return; } // order made on this PC before p93: share it
      else return;
      if (noteKey() === n) setTimeout(run, 30);
    }).catch(function () { fetched[n] = 0; });
  }

  // put rows in the saved order; rows not in the saved list (new on this note) go after the last row of the same PO
  function applySaved() {
    var list = saved(), body = $('sn-table-body'); if (!list || !body) return;
    var rs = rows(), byKey = {}; rs.forEach(function (tr) { byKey[tr.getAttribute('data-key') || ''] = tr; });
    var out = [], used = {};
    list.forEach(function (k) { if (byKey[k] && !used[k]) { out.push(byKey[k]); used[k] = 1; } });
    rs.forEach(function (tr) {
      var k = tr.getAttribute('data-key') || ''; if (used[k]) return;
      var po = tr.getAttribute('data-po'), at = -1;
      out.forEach(function (x, i) { if (x.getAttribute('data-po') === po) at = i; });
      if (at < 0) out.push(tr); else out.splice(at + 1, 0, tr);
      used[k] = 1;
    });
    var same = out.every(function (tr, i) { return tr === rs[i]; });
    if (!same) out.forEach(function (tr) { body.appendChild(tr); });
  }
  function paint() {
    var body = $('sn-table-body'); if (!body) return;
    var ok = allowed() && rows().length > 1;
    rows().forEach(function (tr) {
      var td = tr.children[0]; if (!td) return;
      var have = td.querySelector('.iba-sno-mv');
      if (!ok) { if (have) have.remove(); return; }
      if (have) return;
      var s = document.createElement('span');
      s.className = 'iba-sno-mv no-print';
      s.innerHTML = '<button type="button" data-sno="up" title="Move up" aria-label="Move up"><i class="fa-solid fa-caret-up"></i></button>' +
        '<button type="button" data-sno="down" title="Move down" aria-label="Move down"><i class="fa-solid fa-caret-down"></i></button>';
      td.appendChild(s);
    });
    var table = body.closest('table'), bar = $('iba-sno-bar');
    var show = ok && !!saved();
    if (!show) { if (bar) bar.remove(); return; }
    if (!bar && table) {
      bar = document.createElement('div'); bar.id = 'iba-sno-bar'; bar.className = 'no-print';
      bar.innerHTML = '<span><i class="fa-solid fa-hand"></i> Your own order</span><button type="button" data-sno="reset"><i class="fa-solid fa-rotate-left"></i> Reset order</button>';
      table.parentNode.insertBefore(bar, table);
    }
  }
  function run() {
    if (busy) return; busy = true;
    try { if (allowed()) { pull(noteKey()); applySaved(); } paint(); } finally { setTimeout(function () { busy = false; }, 0); }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sno]'); if (!b) return;
    if (!allowed()) return;
    e.preventDefault(); e.stopPropagation();
    var act = b.getAttribute('data-sno'), body = $('sn-table-body'); if (!body) return;
    if (act === 'reset') {
      reset();
      // put back the automatic order: the order the summary was built in is kept in data-sno-auto
      var rs = rows().slice().sort(function (a, c) { return (+a.getAttribute('data-sno-auto') || 0) - (+c.getAttribute('data-sno-auto') || 0); });
      busy = true; rs.forEach(function (tr) { body.appendChild(tr); }); setTimeout(function () { busy = false; paint(); }, 0);
      return;
    }
    var tr = b.closest('tr'); if (!tr) return;
    busy = true;
    if (act === 'up' && tr.previousElementSibling) body.insertBefore(tr, tr.previousElementSibling);
    else if (act === 'down' && tr.nextElementSibling) body.insertBefore(tr.nextElementSibling, tr);
    save();
    setTimeout(function () { busy = false; paint(); }, 0);
    tr.classList.add('iba-sno-moved'); setTimeout(function () { tr.classList.remove('iba-sno-moved'); }, 600);
  }, true);
  (function boot(n) {
    var body = $('sn-table-body');
    if (!body) { if (n < 60) setTimeout(function () { boot(n + 1); }, 500); return; }
    new MutationObserver(function () {
      if (busy) return;
      // a fresh build: remember the automatic order for "Reset order"
      rows().forEach(function (tr, i) { if (!tr.hasAttribute('data-sno-auto')) tr.setAttribute('data-sno-auto', String(i)); });
      run();
    }).observe(body, { childList: true });
  })(0);
  window.ibaSnOrder = { refresh: run, allowed: allowed };
})();
