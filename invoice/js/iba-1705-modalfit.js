/* ==========================================================================
   js/iba-1705-modalfit.js — 17.0.5 patch 35
   Pop-ups fit tablet and 17" screens.
   A pop-up (.modal-overlay or the glass .iba-pb-layer) is checked each time
   it opens and when the window size changes. Only when it does NOT fit the
   free area (under the pinned side menu, under the assistant side panel,
   or past the screen edge) it gets class
   "iba-fit": the box then sits in the free area, is never wider or taller
   than it, the body scrolls inside with the title and Save/Close always
   showing, and wide form grids drop to 2 / 1 columns
   (css/iba-1705-fit.css, inside @layer iba-ui).
   A pop-up that already fits is left exactly as it was (PC unchanged).
   Phones (phone workspace, or narrower than 600 px) are not touched.
   17.0.5 patch 36: a narrow desktop window (601-900 px, which the app also
   marks iba-mobile-ui) is fitted too.
   ========================================================================== */
(function () {
    'use strict';
    const SEL = '.modal-overlay, .iba-pb-layer';
    const root = document.documentElement;

    function visible(el) {
        if (!el || el.classList.contains('hidden')) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }
    // the free area: right of the pinned side menu, left of the assistant
    // side panel (when it is docked on the right and not running a page window)
    function freeArea() {
        const vw = window.innerWidth, vh = window.innerHeight;
        let L = 0, R = 0;
        const body = document.body;
        const side = document.getElementById('iba-shell-sidebar');
        if (side && body.classList.contains('iba-shell-on') && body.classList.contains('iba-sidebar-pinned') && visible(side)) {
            const r = side.getBoundingClientRect();
            if (r.right > 0 && r.right < vw * 0.6) L = Math.round(r.right);
        }
        const ai = document.getElementById('iba-ai-panel');
        if (ai && !ai.classList.contains('is-wide') && !body.classList.contains('iba-ai-acting') && visible(ai)) {
            const r = ai.getBoundingClientRect();
            if (r.left > vw * 0.45 && r.height > vh * 0.5) R = Math.round(vw - r.left);
        }
        // the top bar stays above pop-ups on the desktop (css/iba-ui-popups.css 21.8b)
        const T = (body.classList.contains('iba-shell-on') && vw > 600) ? 80 : 12;
        return { L, R, T, vw, vh };
    }
    function boxOf(ov) {
        const kids = Array.from(ov.children).filter((c) => c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE');
        let best = null, area = 0;
        kids.forEach((c) => { const r = c.getBoundingClientRect(); if (r.width * r.height > area) { area = r.width * r.height; best = c; } });
        return best;
    }
    // change the class only when it really changes (a class write always
    // wakes the page's other observers)
    function setFit(ov, on) { if (ov.classList.contains('iba-fit') !== on) ov.classList.toggle('iba-fit', on); }
    function setVar(k, v) { if (root.style.getPropertyValue(k) !== v) root.style.setProperty(k, v); }
    function check(ov) {
        if (!ov || !ov.isConnected) return;
        // phones keep their own full-screen pop-ups
        if (!visible(ov) || document.body.classList.contains('iba-phone') || window.innerWidth < 600) { setFit(ov, false); return; }
        const f = freeArea();
        setVar('--iba-free-l', f.L + 'px');
        setVar('--iba-free-r', f.R + 'px');
        setVar('--iba-free-t', f.T + 'px');
        // measure the pop-up as it is drawn without the fit rules
        const had = ov.classList.contains('iba-fit');
        if (had) ov.classList.remove('iba-fit');
        const box = boxOf(ov);
        if (!box) return;
        const r = box.getBoundingClientRect();
        // (wide tables already scroll inside their box: that alone is no reason)
        const need = r.left < f.L + 4 || r.right > f.vw - f.R - 4 || r.top < f.T - 20 || r.bottom > f.vh + 1;
        if (need) {
            // keep the pop-up's own width when there is room for it
            const w = Math.round(r.width) + 'px';
            if (box.style.getPropertyValue('--iba-fit-w') !== w) box.style.setProperty('--iba-fit-w', w);
            ov.classList.add('iba-fit');
        }
    }
    const strip = (c) => String(c || '').split(/\s+/).filter((x) => x && x !== 'iba-fit').sort().join(' ');
    function checkAll() { document.querySelectorAll(SEL).forEach(check); }

    // the content of a pop-up often arrives a moment after it opens
    function later(ov) { [450, 1500].forEach((ms) => setTimeout(() => { if (visible(ov) && !ov.classList.contains('iba-fit')) check(ov); }, ms)); }

    let queued = false;
    function queue() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; checkAll(); }); }

    function start() {
        // a pop-up opens: class "hidden" removed, display changed, or a glass layer added
        try {
            new MutationObserver((list) => {
                for (const m of list) {
                    const t = m.target;
                    if (m.type === 'attributes') {
                        if (!t.matches || !t.matches(SEL)) continue;
                        // our own iba-fit switch is not an opening
                        if (m.attributeName === 'class' && strip(m.oldValue) === strip(t.getAttribute('class'))) continue;
                        check(t);
                        later(t);
                        continue;
                    }
                    if (m.type === 'childList') {
                        for (const n of m.addedNodes) if (n.nodeType === 1 && n.matches && n.matches(SEL)) { check(n); later(n); }
                    }
                }
            }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style'] });
        } catch (_) {}
        // the side menu pinned / unpinned, the assistant opened or closed
        try {
            new MutationObserver((list) => {
                // only the side menu pin and the assistant's page-window mode move the free area
                const key = (c) => /\biba-sidebar-pinned\b/.test(c) + '|' + /\biba-ai-acting\b/.test(c);
                if (list.some((m) => key(String(m.oldValue || '')) !== key(document.body.className))) queue();
            }).observe(document.body, { attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
        } catch (_) {}
        window.addEventListener('resize', queue);
        window.addEventListener('orientationchange', queue);
        queue();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaModalFit = { check, checkAll, freeArea };
})();
