/* 18.0.0 patch 6 (martin picked sample A, mock-up https://claude.ai/artifact/JCu6jK7Jo7Mdvbu3DShwHV):
   MENU BOOKMARK + NEW PIN.
   - When the left side menu is NOT pinned, a slim see-through tab sits half-way down the left edge
     (menu sign + arrow; hover = a bit wider + "Menu"). Click = slide the menu out (body.iba-sidebar-peek,
     the same class the old edge hover uses); the tab rides on the menu edge, click again or click
     outside to close. PC / tablet desktop only (hidden on the phone shell and when pinned).
   - The old grey edge strip (#iba-sidebar-hotspot) stays as a hover area but is see-through now.
   - Pin button (#iba-sidebar-pin): pushpin + word. Not pinned = tilted pin, "Pin"; pinned = gold pin
     standing up, "Pinned".  */
(function () {
    'use strict';
    if (window.__ibaMenuBm) return;
    window.__ibaMenuBm = 1;
    const PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="hd" cx="12" cy="7" r="4.6"/><path class="nk" d="M12 11.6v2.4"/><path class="bs" d="M8.2 14h7.6"/><path class="nd" d="M12 14v7.2"/></svg>';
    const CSS = [
        '@layer iba-ui {',
        /* the tab */
        '#iba-menu-bm { display: none; }',
        'html body.iba-shell-on:not(.iba-sidebar-pinned):not(.iba-mobile-ui) #iba-menu-bm { display: flex !important; position: fixed !important; left: 0 !important; top: calc(var(--iba-shell-header-h, 64px) + (100vh - var(--iba-shell-header-h, 64px)) / 2) !important; transform: translateY(-50%) !important; z-index: 99995 !important; width: 16px !important; min-width: 0 !important; height: 74px !important; margin: 0 !important; padding: 0 !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 6px !important; border: 1px solid rgba(232,197,71,.5) !important; border-left: 0 !important; border-radius: 0 10px 10px 0 !important; background: rgba(12,14,17,.5) !important; color: #e8c547 !important; -webkit-text-fill-color: #e8c547 !important; box-shadow: 4px 4px 14px rgba(0,0,0,.25) !important; cursor: pointer !important; overflow: hidden !important; transition: width .18s ease, height .18s ease, left .26s ease, background .15s !important; }',
        'html body.iba-shell-on:not(.iba-sidebar-pinned):not(.iba-mobile-ui) #iba-menu-bm:hover, html body.iba-shell-on:not(.iba-sidebar-pinned):not(.iba-mobile-ui) #iba-menu-bm:focus-visible { width: 24px !important; height: 100px !important; background: rgba(18,21,26,.92) !important; }',
        'html body.iba-shell-on:not(.iba-sidebar-pinned):not(.iba-mobile-ui):is(.iba-sidebar-peek, .iba-shell-nav-open) #iba-menu-bm { left: var(--iba-mbm-x, 248px) !important; background: rgba(18,21,26,.9) !important; }',
        '#iba-menu-bm svg { width: 12px !important; height: 12px !important; flex: none !important; fill: none !important; stroke: currentColor !important; stroke-width: 2.2 !important; stroke-linecap: round !important; stroke-linejoin: round !important; transition: transform .2s ease !important; }',
        'html body:is(.iba-sidebar-peek, .iba-shell-nav-open) #iba-menu-bm .chev { transform: rotate(180deg) !important; }',
        '#iba-menu-bm .lbl { writing-mode: vertical-rl !important; transform: rotate(180deg) !important; font: 700 10px/1 inherit !important; letter-spacing: .06em !important; color: #F3EAD3 !important; -webkit-text-fill-color: #F3EAD3 !important; opacity: 0 !important; max-height: 0 !important; overflow: hidden !important; transition: opacity .15s !important; }',
        '#iba-menu-bm:hover .lbl, #iba-menu-bm:focus-visible .lbl { opacity: 1 !important; max-height: 60px !important; }',
        /* old edge strip: keep the hover area, drop the grey band */
        'html body.iba-shell-on:not(.iba-sidebar-pinned) #iba-sidebar-hotspot { background: transparent !important; width: 10px !important; }',
        /* new pin */
        'html body.iba-shell-on #iba-sidebar-pin { display: inline-flex !important; align-items: center !important; gap: 5px !important; padding: 4px 9px 4px 6px !important; border-radius: 999px !important; border: 1px solid rgba(255,255,255,.12) !important; background: rgba(255,255,255,.04) !important; color: #c9d1db !important; -webkit-text-fill-color: #c9d1db !important; font: 600 11.5px/1 inherit !important; opacity: 1 !important; transition: background .15s, border-color .15s, color .15s !important; }',
        'html body.iba-shell-on #iba-sidebar-pin:hover { background: rgba(232,197,71,.10) !important; border-color: rgba(232,197,71,.45) !important; opacity: 1 !important; }',
        'html body.iba-shell-on #iba-sidebar-pin > i { display: none !important; }',
        'html body.iba-shell-on #iba-sidebar-pin svg { width: 17px !important; height: 17px !important; flex: none !important; transform: rotate(40deg) !important; transform-origin: 50% 60% !important; transition: transform .22s ease !important; overflow: visible !important; }',
        '#iba-sidebar-pin svg .hd { fill: #e5484d !important; stroke: #ff8a8d !important; stroke-width: 1 !important; }',
        '#iba-sidebar-pin svg .nk, #iba-sidebar-pin svg .bs { stroke: #e5484d !important; stroke-width: 2.2 !important; stroke-linecap: round !important; }',
        '#iba-sidebar-pin svg .nd { stroke: #c9d1db !important; stroke-width: 1.6 !important; stroke-linecap: round !important; }',
        'html body.iba-shell-on.iba-sidebar-pinned #iba-sidebar-pin { background: rgba(232,197,71,.14) !important; border-color: rgba(232,197,71,.6) !important; color: #e8c547 !important; -webkit-text-fill-color: #e8c547 !important; }',
        'html body.iba-shell-on.iba-sidebar-pinned #iba-sidebar-pin svg { transform: rotate(0deg) !important; }',
        'html body.iba-sidebar-pinned #iba-sidebar-pin svg .hd { fill: #e8c547 !important; stroke: #f6dd84 !important; }',
        'html body.iba-sidebar-pinned #iba-sidebar-pin svg .nk, html body.iba-sidebar-pinned #iba-sidebar-pin svg .bs { stroke: #e8c547 !important; }',
        '}',
        '@media print { #iba-menu-bm { display: none !important; } }'
    ].join('\n');

    function paintPin() {
        const b = document.getElementById('iba-sidebar-pin');
        if (!b) return;
        if (!b.querySelector('svg')) b.insertAdjacentHTML('afterbegin', PIN_SVG + '<span class="iba-pin-lbl"></span>');
        const on = document.body.classList.contains('iba-sidebar-pinned');
        const l = b.querySelector('.iba-pin-lbl');
        const t = on ? 'Pinned' : 'Pin';
        if (l && l.textContent !== t) l.textContent = t;
    }

    function setup() {
        if (!document.getElementById('iba-menu-bm-css')) {
            const st = document.createElement('style');
            st.id = 'iba-menu-bm-css';
            st.textContent = CSS;
            document.head.appendChild(st);
        }
        if (!document.getElementById('iba-menu-bm')) {
            const bm = document.createElement('button');
            bm.type = 'button';
            bm.id = 'iba-menu-bm';
            bm.title = 'Open menu';
            bm.setAttribute('aria-label', 'Open menu');
            bm.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span class="lbl">Menu</span><svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>';
            bm.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const c = document.body.classList;
                if (c.contains('iba-sidebar-pinned')) return;
                const open = c.contains('iba-sidebar-peek') || c.contains('iba-shell-nav-open');
                c.remove('iba-shell-nav-open');
                sideW();
                c.toggle('iba-sidebar-peek', !open);
                bm.title = open ? 'Open menu' : 'Close menu';
            });
            document.body.appendChild(bm);
        }
        paintPin();
        sideW();
    }

    // the tab rides on the real menu edge (the menu is wider than 248 px in some themes)
    let lastW = -1;
    // patch 9: measured every time the menu opens (the menu is not drawn yet when the page loads, so the
    // first measure fell back to 248 px and the tab sat INSIDE a wider menu). Once the slide ends, the real
    // right edge on screen is used.
    function sideW() {
        const s = document.getElementById('iba-shell-sidebar');
        if (!s) return;
        const c = document.body.classList;
        const open = c.contains('iba-sidebar-peek') || c.contains('iba-shell-nav-open');
        const r = s.getBoundingClientRect();
        const w = Math.round(open && r.left > -2 ? r.right : (s.offsetWidth || r.width));
        if (w > 0 && w !== lastW) { lastW = w; document.documentElement.style.setProperty('--iba-mbm-x', w + 'px'); }
    }
    window.addEventListener('resize', sideW);
    function hookSide() {
        const s = document.getElementById('iba-shell-sidebar');
        if (!s || s.__mbm) return;
        s.__mbm = 1;
        s.addEventListener('transitionend', function (e) { if (e.target === s) sideW(); });
    }

    // click outside the menu closes a menu opened from the tab
    document.addEventListener('click', function (e) {
        const c = document.body.classList;
        if (!c.contains('iba-sidebar-peek') || c.contains('iba-sidebar-pinned')) return;
        const t = e.target;
        if (t && t.closest && (t.closest('#iba-shell-sidebar') || t.closest('#iba-menu-bm') || t.closest('#iba-sidebar-hotspot'))) return;
        c.remove('iba-sidebar-peek');
        const bm = document.getElementById('iba-menu-bm');
        if (bm) bm.title = 'Open menu';
    }, true);

    // keep the pin word right when pinning changes (only touches the DOM when the word changes)
    let last = null;
    new MutationObserver(function () {
        hookSide(); sideW();
        const on = document.body.classList.contains('iba-sidebar-pinned');
        if (on === last) return;
        last = on;
        paintPin();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();
