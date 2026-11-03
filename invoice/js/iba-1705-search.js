/* ==========================================================================
   js/iba-1705-search.js — 17.0.5 patch 81
   Search boxes: Chrome must not offer / auto-fill old entries. When it did,
   it painted the box light blue while our dark theme kept the text white
   (unreadable). Every search-type box gets autocomplete="off" (also stops
   the "[DOM] Input elements should have autocomplete" console lines); the
   CSS fallback in iba-1705-fit.css keeps an autofilled box dark.
   ========================================================================== */
(function () {
    'use strict';
    const SEL = 'input[type="search"], input[id*="search" i], input[name*="search" i], input[placeholder*="search" i], input[id*="-q" i], input[data-pull-q], #ms-search-input';
    function off(el) {
        if (!el || el.tagName !== 'INPUT' || el.__ibaAcOff) return;
        const t = (el.type || 'text').toLowerCase();
        if (t !== 'text' && t !== 'search') return;
        el.__ibaAcOff = true;
        el.setAttribute('autocomplete', 'off');
        el.setAttribute('autocorrect', 'off');
        el.setAttribute('spellcheck', 'false');
    }
    function all() { try { document.querySelectorAll(SEL).forEach(off); } catch (_) {} }
    // boxes drawn later (assistant, pop-ups) are caught the moment they get focus
    document.addEventListener('focusin', (e) => { const el = e.target; try { if (el && el.matches && el.matches(SEL)) off(el); } catch (_) {} }, true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
    setTimeout(all, 3000);
})();
