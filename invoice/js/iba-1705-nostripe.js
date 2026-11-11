/* 17.0.5 patch 204 (martin): no coloured side stripe on cards and rows.
   The thick left line (border-left 3-6px, or an "inset 3px 0 0" shadow) is a common template
   look; martin wants his own. This goes through the app's own style sheets once and:
   MODE 'a' : removes the stripe (the card keeps its normal border)
   MODE 'b' : the stripe colour becomes a soft outline all around the card instead
   Print styles are not touched. Off for a test: localStorage 'iba-stripe-off' = '1'. */
(function () {
    'use strict';
    if (window.ibaNoStripe) return;
    try { if (localStorage.getItem('iba-stripe-off') === '1') return; } catch (_) {}
    let MODE = 'a';
    try { const m = localStorage.getItem('iba-stripe-mode'); if (m === 'a' || m === 'b') MODE = m; } catch (_) {}
    const done = new WeakSet();
    // split a box-shadow list at top-level commas
    function parts(v) { const out = []; let d = 0, cur = ''; for (const ch of v) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
    // "inset 3px 0 0 X" / "X inset 3px 0px 0px" / "inset 5px 0 0 0 X": a left stripe
    const STRIPE = /^(?:inset\s+)?(?:(.+?)\s+)?(?:inset\s+)?([2-8](?:\.\d+)?)px\s+0(?:px)?\s+0(?:px)?(?:\s+0(?:px)?)?(?:\s+(.+?))?(?:\s+inset)?$/i;
    function stripeColor(p) {
        if (!/inset/i.test(p)) return null;
        const m = p.replace(/\s+/g, ' ').match(STRIPE);
        if (!m) return null;
        return (m[1] && !/inset/i.test(m[1]) ? m[1] : m[3]) || 'currentColor';
    }
    function fixRule(st) {
        let col = null;
        const bs = st.getPropertyValue('box-shadow');
        if (bs && /inset/i.test(bs)) {
            const ps = parts(bs), keep = [];
            ps.forEach((p) => { const c = stripeColor(p); if (c && !col) col = c; else if (!c) keep.push(p); });
            if (col) st.setProperty('box-shadow', keep.length ? keep.join(', ') : 'none', st.getPropertyPriority('box-shadow'));
        }
        const lw = parseFloat(st.getPropertyValue('border-left-width'));
        const tw = st.getPropertyValue('border-top-width');
        const rw = st.getPropertyValue('border-right-width');
        if (lw >= 3 && (!tw || parseFloat(tw) < lw - 1) && (!rw || parseFloat(rw) < lw - 1)) {
            const pr = st.getPropertyPriority('border-left-width');
            const c = st.getPropertyValue('border-left-color');
            if (c && !col) col = c;
            if (tw && parseFloat(tw) > 0) {
                st.setProperty('border-left-width', tw, pr);
                const tc = st.getPropertyValue('border-top-color'); if (tc) st.setProperty('border-left-color', tc, st.getPropertyPriority('border-top-color'));
            } else {
                // only the left side was set here: drop it, the element's normal border applies
                ['border-left-width', 'border-left-style', 'border-left-color'].forEach((p) => st.removeProperty(p));
            }
        }
        if (col && MODE === 'b' && !/transparent/i.test(col)) {
            st.setProperty('border-color', 'color-mix(in srgb, ' + col + ' 55%, transparent)', 'important');
            if (!st.getPropertyValue('border-style')) st.setProperty('border-style', 'solid', 'important');
            const w = parseFloat(st.getPropertyValue('border-top-width'));
            if (!(w > 0)) st.setProperty('border-width', '1px', 'important');
        }
    }
    function walk(rules) {
        for (let i = 0; i < rules.length; i++) {
            const r = rules[i];
            if (r.media && /^\s*print\s*$/i.test(r.media.mediaText || '')) continue;
            if (r.style) { try { fixRule(r.style); } catch (_) {} }
            if (r.cssRules) walk(r.cssRules);
        }
    }
    function sheet(s) {
        if (!s || done.has(s)) return;
        let rules; try { rules = s.cssRules; } catch (_) { return; }
        if (!rules) return;
        done.add(s);
        walk(rules);
    }
    function all() { for (const s of Array.from(document.styleSheets)) sheet(s); }
    all();
    document.addEventListener('DOMContentLoaded', all);
    window.addEventListener('load', all);
    try {
        new MutationObserver((ms) => {
            let hit = false;
            ms.forEach((m) => {
                if (m.target && m.target.nodeName === 'STYLE') hit = true;
                m.addedNodes.forEach((n) => { if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') { hit = true; if (n.nodeName === 'LINK') n.addEventListener('load', all, { once: true }); } });
            });
            if (hit) setTimeout(all, 0);
        }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    window.ibaNoStripe = { run: all, mode: () => MODE };
})();
