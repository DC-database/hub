/* 17.0.5 patch 199 (martin): one black glass look everywhere.
   Tables, pop-ups and cards used a navy-blue glass while the header and side panels are a
   neutral black glass. Instead of editing ~15 style files, this turns every dark NAVY
   background colour in the app's own style sheets into the same tone of neutral black
   (same see-through amount, same lightness steps). Borders, text, teal/gold/blue buttons
   and status colours are not touched. Print styles are not touched.
   Turn off for a test: localStorage 'iba-black-off' = '1' (then reload). */
(function () {
    'use strict';
    if (window.ibaBlack) return;
    try { if (localStorage.getItem('iba-black-off') === '1') return; } catch (_) {}

    const done = new WeakSet();
    // dark navy only: blue clearly above red, dark, and not teal/cyan (green stays low)
    function isNavy(r, g, b) { return b - r > 18 && b >= g && r < 60 && g < 80 && b < 115; }
    function black(r, g, b) { const k = Math.round(((r + g + b) / 3) * 0.32); return [k, k + 2, k + 5]; }
    const RX = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)|#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi;
    function recolor(v) {
        return v.replace(RX, (m, r, g, b, a, hex) => {
            let al = a;
            if (hex) {
                let h = hex;
                if (h.length === 3) h = h.split('').map((c) => c + c).join('');
                r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
                al = h.length === 8 ? (parseInt(h.slice(6, 8), 16) / 255).toFixed(3) : undefined;
            } else { r = +r; g = +g; b = +b; }
            if (!isNavy(r, g, b)) return m;
            const n = black(r, g, b);
            return al === undefined ? 'rgb(' + n.join(', ') + ')' : 'rgba(' + n.join(', ') + ', ' + al + ')';
        });
    }
    const PROPS = ['background-color', 'background-image'];
    function fixStyle(st) {
        const names = [];
        for (let i = 0; i < st.length; i++) names.push(st[i]);
        names.forEach((p) => {
            if (!(PROPS.includes(p) || p.startsWith('--ui-'))) return;
            const v = st.getPropertyValue(p);
            if (!v || !/rgb|#/i.test(v)) return;
            const n = recolor(v);
            if (n !== v) st.setProperty(p, n, st.getPropertyPriority(p));
        });
    }
    function walk(rules) {
        for (let i = 0; i < rules.length; i++) {
            const r = rules[i];
            if (r.media && /^\s*print\s*$/i.test(r.media.mediaText || '')) continue;
            if (r.style) fixStyle(r.style);
            if (r.cssRules) walk(r.cssRules);
        }
    }
    function sheet(s) {
        if (!s || done.has(s)) return;
        let rules;
        try { rules = s.cssRules; } catch (_) { return; }   // other sites (fonts, icons)
        if (!rules) return;
        if (s.media && s.media.mediaText && /^\s*print\s*$/i.test(s.media.mediaText)) return;
        done.add(s);
        try { walk(rules); } catch (_) {}
    }
    function all() { for (const s of Array.from(document.styleSheets)) sheet(s); }

    all();
    document.addEventListener('DOMContentLoaded', all);
    window.addEventListener('load', all);
    // style sheets added later (pop-ups, the assistant ...)
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
    window.ibaBlack = { run: all, recolor };
})();
