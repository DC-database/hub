/* ==========================================================================
   iba-1705-fit.js — 17.0.5 patch 3
   Fit to the screen. When a button's words do not fit its box, it is kept
   whole and its row may wrap; if that is not enough it gets a little tighter, then shows only its icon (or one line with "…"),
   with the full words as a tooltip. Long help notes fold to two lines with
   a "more" chip. Everything comes back when there is room again (resize).
   Runs after a click, a resize and every 4 s while the page is visible;
   it only writes to the page when something changes (no observers).
   ========================================================================== */
(function () {
  'use strict';
  if (window.ibaFit) return;

  var BTN = 'button, .btn, a.iba-ai-mini, a[class*="btn"], [role="button"]';
  var NOTE = 'p, small, .hint, .help, .note, [class*="-hint"], [class*="-help"], [class*="-note"], [class*="-desc"], [class*="-sub"], .iba-ai-foot';
  // never touch: print layouts, the chat answers, typed fields, tables
  var SKIP = '#sn-c, .iba-ai-msg, .iba-ai-bubble, [contenteditable], td, th, .modal-print, .iba-esn-sheet, .iba-lpo-card, #iba-recv-pop';
  var FIT = ['iba-fit-tight', 'iba-fit-icon', 'iba-fit-cut', 'iba-fit-keep'];

  function visible(el) {
    if (!el.isConnected || !el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > -200 && r.top < innerHeight + 400;
  }
  function words(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  // an icon that really shows (icon font loaded), so the button is not left empty
  function hasIcon(el) {
    var i = el.querySelector(':scope > i, :scope > svg, :scope > img, :scope > .fa-solid, :scope > .fa-regular');
    return !!i && i.getBoundingClientRect().width >= 8;
  }
  // a card-like button: a title plus a small line under it (tiles, the
  // Track Invoices / Inventory switch) is two lines on purpose
  function isCard(el) { return el.offsetHeight > 58 || el.querySelector('div, p, ul, table, h1, h2, h3, h4, small, br') || el.querySelectorAll(':scope > span, :scope > b, :scope > strong').length > 1; }

  function overflows(el) {
    if (el.scrollWidth > el.clientWidth + 2) return true;
    var r = el.getBoundingClientRect();
    var rg = document.createRange(); rg.selectNodeContents(el);
    var t = rg.getBoundingClientRect();
    if (!t.width) return false;
    if (t.right > r.right + 2 || t.left < r.left - 2) return true;
    // words broke onto lines below a one-line button
    // words broke onto a 2nd line of a one-line button (nowrap was meant)
    var fs = parseFloat(getComputedStyle(el).fontSize) || 13;
    return t.height > r.height + 4 || (getComputedStyle(el).whiteSpace === 'nowrap' && t.height > fs * 2.1);
  }
  function setTitle(el) {
    if (el.hasAttribute('title') || el.dataset.ibaFitTitle) return;
    var w = words(el); if (!w) return;
    el.setAttribute('title', w); el.dataset.ibaFitTitle = '1';
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', w);
  }

  function fitButton(el) {
    if (el.closest(SKIP) || isCard(el) || !words(el)) return;
    if (!overflows(el)) return;
    // squeezed by its row: keep the button whole and let the row wrap
    var par = el.parentElement, ps = par && getComputedStyle(par);
    if (ps && /flex/.test(ps.display) && ps.flexWrap === 'nowrap' && /row/.test(ps.flexDirection) && !el.classList.contains('iba-fit-keep') && !par.closest('.iba-ai-ttab, .iba-ai-wide-bar')) {
      el.classList.add('iba-fit-keep');
      if (!par.classList.contains('iba-fit-wrap')) par.classList.add('iba-fit-wrap');
      if (!overflows(el)) return;
    }
    if (!el.classList.contains('iba-fit-tight')) {
      el.classList.add('iba-fit-tight');
      if (!overflows(el)) return;
    }
    setTitle(el);
    if (hasIcon(el)) { if (!el.classList.contains('iba-fit-icon')) el.classList.add('iba-fit-icon'); }
    else if (!el.classList.contains('iba-fit-cut')) el.classList.add('iba-fit-cut');
  }

  function fitNote(el) {
    if (el.classList.contains('iba-fit-note') || el.closest(SKIP) || el.closest(BTN) || el.closest('label') && el.closest('label').querySelector('input')) return;
    if (el.querySelector('p, div, ul, ol, table, input, select, textarea, button')) return;
    var w = words(el);
    if (w.length < 110) return;
    var lh = parseFloat(getComputedStyle(el).lineHeight) || 18;
    if (el.getBoundingClientRect().height < lh * 2.6) return; // two lines or less: leave it
    el.classList.add('iba-fit-note');
    if (!el.hasAttribute('title')) el.setAttribute('title', w.slice(0, 400));
    var m = document.createElement('span');
    m.className = 'iba-fit-more'; m.textContent = 'more';
    el.appendChild(m);
  }

  var busy = false;
  function run() {
    busy = false;
    if (document.hidden) return;
    var list = document.querySelectorAll(BTN);
    for (var i = 0; i < list.length; i++) { var b = list[i]; if (visible(b)) { try { fitButton(b); } catch (_) {} } }
    var notes = document.querySelectorAll(NOTE);
    for (var j = 0; j < notes.length; j++) { var n = notes[j]; if (visible(n)) { try { fitNote(n); } catch (_) {} } }
  }
  function soon(ms) { if (busy) return; busy = true; setTimeout(function () { (window.requestIdleCallback || setTimeout)(run); }, ms || 250); }

  // more room again: undo, then check again
  var lastW = innerWidth;
  function reset() {
    document.querySelectorAll('.iba-fit-wrap').forEach(function (el) { el.classList.remove('iba-fit-wrap'); });
    document.querySelectorAll('.iba-fit-tight, .iba-fit-icon, .iba-fit-cut, .iba-fit-keep').forEach(function (el) {
      el.classList.remove.apply(el.classList, FIT);
      if (el.dataset.ibaFitTitle) { el.removeAttribute('title'); el.removeAttribute('aria-label'); delete el.dataset.ibaFitTitle; }
    });
  }
  var rt = 0;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (innerWidth > lastW + 20) reset(); lastW = innerWidth; soon(50); }, 300);
  });

  document.addEventListener('click', function (e) {
    var more = e.target.closest && e.target.closest('.iba-fit-note');
    if (more && (e.target.classList.contains('iba-fit-more') || !more.classList.contains('is-fit-open'))) {
      var open = !more.classList.contains('is-fit-open');
      more.classList.toggle('is-fit-open', open);
      var chip = more.querySelector(':scope > .iba-fit-more'); if (chip) chip.textContent = open ? 'less' : 'more';
      e.preventDefault(); e.stopPropagation();
      return;
    }
    soon(400); setTimeout(function () { soon(50); }, 1500);
  }, true);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) soon(200); });
  setInterval(function () { soon(0); }, 4000);
  soon(1500);

  window.ibaFit = { run: run, reset: function () { reset(); soon(0); } };
})();
