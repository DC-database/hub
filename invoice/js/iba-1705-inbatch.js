/* ==========================================================================
   iba-1705-inbatch.js — 17.0.5 patch 4
   Batch Entry "Search PO": invoices that already have a card in the batch
   are greyed out with an "In batch" tag and cannot be picked again (also
   not by "select all"). Removing the card makes the invoice pickable again.
   The summary line says how many of this PO are already in the batch.
   Watches only the search results box and the batch card list.
   ========================================================================== */
(function () {
  'use strict';
  if (window.ibaInBatch) return;

  function results() { return document.getElementById('im-batch-modal-results'); }
  function cards() { return document.getElementById('im-batch-table-body'); }

  function rowInfo(tr) {
    var cb = tr.querySelector('.modal-inv-checkbox');
    if (!cb || !cb.dataset.invoice) return null;
    try { var d = JSON.parse(decodeURIComponent(cb.dataset.invoice)); return { cb: cb, key: String(d.key || ''), po: String(d.po || '').toUpperCase(), no: d.invNumber || d.invEntryID || '' }; } catch (_) { return null; }
  }
  function inBatchSet() {
    var set = {}, body = cards();
    if (!body) return set;
    body.querySelectorAll('.batch-invoice-card[data-key]').forEach(function (c) {
      set[String(c.getAttribute('data-po') || '').toUpperCase() + '|' + c.getAttribute('data-key')] = 1;
    });
    return set;
  }

  var painting = false;
  function paint() {
    var box = results();
    if (!box) return;
    var rows = box.querySelectorAll('.batch-modal-result-row');
    if (!rows.length) return;
    painting = true;
    try {
      var set = inBatchSet(), names = [];
      rows.forEach(function (tr) {
        var r = rowInfo(tr);
        if (!r) return;
        var on = !!set[r.po + '|' + r.key];
        if (on) names.push(r.no);
        if (tr.classList.contains('is-in-batch') === on) return; // nothing changed
        tr.classList.toggle('is-in-batch', on);
        r.cb.disabled = on;
        if (on) { r.cb.checked = false; tr.classList.remove('is-selected'); }
        tr.setAttribute('aria-disabled', on ? 'true' : 'false');
        if (on) { tr.dataset.ibaTitle = tr.getAttribute('title') || ''; tr.setAttribute('title', 'Already in this batch'); tr.setAttribute('tabindex', '-1'); }
        else { tr.setAttribute('title', tr.dataset.ibaTitle || 'Click to select this invoice'); tr.setAttribute('tabindex', '0'); }
        var chip = tr.querySelector('.batch-modal-status-chip');
        var tag = tr.querySelector('.iba-inbatch-tag');
        if (on && !tag && chip) { tag = document.createElement('span'); tag.className = 'iba-inbatch-tag'; tag.innerHTML = '<i class="fa-solid fa-check"></i> In batch'; chip.parentNode.appendChild(tag); }
        if (!on && tag) tag.remove();
      });
      var sum = box.querySelector('.batch-modal-result-summary');
      if (sum) {
        var line = sum.querySelector('.iba-inbatch-line');
        var txt = names.length ? names.length + ' already in batch' + (names.length <= 6 ? ' (' + names.join(', ') + ')' : '') + (names.length === rows.length ? ' · all of this PO is in the batch' : '') : '';
        if (txt && !line) { line = document.createElement('span'); line.className = 'iba-inbatch-line'; sum.appendChild(line); }
        if (line && !txt) line.remove();
        else if (line && line.textContent !== txt) line.textContent = txt;
      }
    } finally { painting = false; }
  }

  // greyed rows cannot be clicked or picked; "select all" skips them
  document.addEventListener('click', function (e) {
    var tr = e.target.closest && e.target.closest('#im-batch-modal-results .batch-modal-result-row.is-in-batch');
    if (!tr) return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  document.addEventListener('keydown', function (e) {
    var tr = e.target.closest && e.target.closest('#im-batch-modal-results .batch-modal-result-row.is-in-batch');
    if (tr && (e.key === ' ' || e.key === 'Spacebar')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('change', function (e) {
    if (!e.target || e.target.id !== 'modal-select-all') return;
    setTimeout(function () {
      var box = results(); if (!box) return;
      box.querySelectorAll('.batch-modal-result-row.is-in-batch').forEach(function (tr) {
        var cb = tr.querySelector('.modal-inv-checkbox'); if (cb && cb.checked) cb.checked = false;
        if (tr.classList.contains('is-selected')) tr.classList.remove('is-selected');
      });
    }, 0);
  });

  // new search results, or a card added / removed
  var t = 0;
  function soon() { if (painting) return; clearTimeout(t); t = setTimeout(paint, 30); }
  var watched = {};
  function watch(id) {
    var el = document.getElementById(id);
    if (!el || watched[id] === el) return;
    watched[id] = el;
    new MutationObserver(soon).observe(el, { childList: true, subtree: id === 'im-batch-modal-results' });
  }
  function hook() { watch('im-batch-modal-results'); watch('im-batch-table-body'); }
  hook();
  document.addEventListener('DOMContentLoaded', hook);
  // the Batch Entry page may be built later: look again when it is opened
  document.addEventListener('click', function () { setTimeout(hook, 300); }, true);

  window.ibaInBatch = { paint: paint };
})();
