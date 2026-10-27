/* ==========================================================================
   iba-1705-away.js — 17.0.5 patch 14
   Nobody on vacation can be picked as Attention. Invoice Entry and the
   Batch Entry cards already stop it (js/iba-attention-picker.js); this does
   the same for every other place a person is picked:
     - WorkDesk Job Entry (Add / edit a job)       #job-attention
     - Active Task "Modify"                        #modify-task-attention
     - Batch Entry "Set Attention for all"         #im-batch-global-attention
     - the Attention pop-up list                   #im-attention-picker-select
     - Dashboard "Forward" (Send to)               #wd-forward-recipient
     - any other <select name="attention">
   Picking someone away is undone and a pop-up says who is away, until when,
   and offers the person covering (the replacement in their profile, else the
   fallback), with one "Use <name>" button.
   Who is away follows the automatic hand-over rule exactly
   (window.ibaVacationHandover.away()): Vacation = Yes, return date not
   passed, and not signed in during the last 12 hours.
   Saving still moves a task to the replacement as before (safety net).
   ========================================================================== */
(function () {
  'use strict';
  if (window.ibaAwayGuard) return;

  var SEL = '#job-attention, #modify-task-attention, #im-batch-global-attention, #im-attention-picker-select, #wd-forward-recipient, select[name="attention"]';

  function norm(v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function awayOf(name) {
    var n = norm(name);
    if (!n || n === 'none' || n === 'all') return null;
    try {
      var h = window.ibaVacationHandover;
      var list = (h && typeof h.away === 'function') ? (h.away() || []) : [];
      for (var i = 0; i < list.length; i++) if (list[i] && norm(list[i].name) === n) return list[i];
    } catch (_) {}
    return null;
  }
  function returnDate(name) {
    try {
      var map = (typeof ibaApproverMap === 'function') ? (ibaApproverMap() || {}) : {};
      var vals = Object.keys(map).map(function (k) { return map[k]; });
      for (var i = 0; i < vals.length; i++) {
        var a = vals[i];
        if (a && norm(a.Name) === norm(name) && String(a.DateReturn || '').trim()) return String(a.DateReturn).trim();
      }
    } catch (_) {}
    return '';
  }

  // the Choices.js box drawn over some of these lists
  function choicesFor(el) {
    if (!el.closest || !el.closest('.choices')) return null;
    var list = [];
    try { list.push(attentionSelectChoices); } catch (_) {}
    try { list.push(modifyTaskAttentionChoices); } catch (_) {}
    try { list.push(imBatchGlobalAttentionChoices); } catch (_) {}
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c && c.passedElement && c.passedElement.element === el) return c;
    }
    return null;
  }
  function hasOption(el, v) {
    for (var i = 0; i < el.options.length; i++) if (norm(el.options[i].value) === norm(v)) return el.options[i].value;
    return '';
  }
  function setValue(el, v) {
    var c = choicesFor(el);
    el.__ibaAwaySkip = true;
    try {
      if (c) {
        if (v) c.setChoiceByValue(hasOption(el, v) || v);
        else { try { c.removeActiveItems(); } catch (_) {} }
      } else {
        var have = v ? hasOption(el, v) : '';
        if (v && !have) { var o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); have = v; }
        el.value = have || '';
      }
    } finally { el.__ibaAwaySkip = false; }
  }

  function show(away, onUse) {
    var old = document.getElementById('iba-away-pop');
    if (old) old.remove();
    var back = returnDate(away.name);
    var w = document.createElement('div');
    w.id = 'iba-away-pop';
    w.className = 'iba-pb-layer';
    w.innerHTML = '<div class="iba-pb-box" role="alertdialog" aria-modal="true" aria-labelledby="iba-away-t" style="width:min(460px,100%)">' +
      '<div class="iba-pb-head"><b id="iba-away-t"><i class="fa-solid fa-umbrella-beach"></i> ' + esc(away.name) + ' is on vacation</b><span>' + (back ? 'Back on ' + esc(back) : 'No return date set') + '</span></div>' +
      '<p class="iba-pb-sub">' + esc(away.name) + ' cannot be picked while away. ' + (away.noReplacement
        ? 'No replacement is set in ' + esc(away.name) + '\'s profile, so <b>' + esc(away.target) + '</b> covers.'
        : 'Please give this to the replacement, <b>' + esc(away.target) + '</b>.') + '</p>' +
      '<div class="iba-pb-foot"><span></span><button type="button" data-x>Cancel</button><button type="button" data-use class="is-main">Use ' + esc(away.target) + '</button></div></div>';
    document.body.appendChild(w);
    var close = function () { w.remove(); };
    w.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (e.target === w) return close();
      if (!b) return;
      close();
      if (b.hasAttribute('data-use')) onUse(away.target);
    });
    w.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    var use = w.querySelector('[data-use]');
    if (use) setTimeout(function () { use.focus(); }, 0);
  }

  function target(e) {
    var el = e.target;
    return (el && el.matches && el.tagName === 'SELECT' && el.matches(SEL)) ? el : null;
  }
  // remember the last good value, to go back to it
  function remember(el) { if (!awayOf(el.value)) el.__ibaAwayGood = el.value; }
  document.addEventListener('focusin', function (e) { var el = target(e); if (el) remember(el); }, true);
  document.addEventListener('mousedown', function (e) {
    var box = e.target.closest && e.target.closest('.choices');
    var el = box && box.querySelector('select');
    if (el && el.matches(SEL)) remember(el);
  }, true);

  // Choices.js tells its own "on vacation" box first: this pop-up replaces it
  document.addEventListener('choice', function (e) {
    var el = target(e);
    var v = e.detail && (e.detail.value != null ? e.detail.value : (e.detail.choice && e.detail.choice.value));
    if (el && !el.__ibaAwaySkip && awayOf(v)) e.stopImmediatePropagation();
  }, true);

  document.addEventListener('change', function (e) {
    var el = target(e);
    if (!el || el.__ibaAwaySkip) return;
    var away = awayOf(el.value);
    if (!away) { el.__ibaAwayGood = el.value; return; }
    e.stopImmediatePropagation();
    var good = el.__ibaAwayGood && !awayOf(el.__ibaAwayGood) ? el.__ibaAwayGood : '';
    setTimeout(function () {
      setValue(el, good);
      show(away, function (to) {
        setValue(el, to);
        el.__ibaAwayGood = to;
        el.__ibaAwaySkip = true;
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } finally { el.__ibaAwaySkip = false; }
      });
    }, 0);
  }, true);

  window.ibaAwayGuard = { awayOf: awayOf };
})();
