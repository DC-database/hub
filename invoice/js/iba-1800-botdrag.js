/* 18.0.0 patch 74 (martin): the IRIS robot (#iba-ai-fab) can be DRAGGED anywhere on the screen (PC only),
   e.g. to the empty space under the side menu, so it no longer covers the table. Hold it and move;
   a plain click still opens IRIS. The place is remembered on this PC (localStorage iba-fab-pos-v1, as a share
   of the screen so it stays in place when the window size changes). Drop it back in the bottom-right corner
   (or double-click it) to put it back where it was. Its speech bubbles follow it. Phone is not touched. */
(function () {
    'use strict';
    if (window.ibaBotDrag) return;
    const KEY = 'iba-fab-pos-v1', SIZE_PAD = 6, MOVE = 6;
    const $ = (id) => document.getElementById(id);
    function pc() {
        // 18.0.0 patch 91 (martin): also a tablet in "Desktop view" (touch, no mouse): any wide screen that is not the phone layout
        try { return window.innerWidth >= 900 && !document.body.classList.contains('iba-phone') && !document.body.classList.contains('iba-mobile-ui'); } catch (_) { return false; }
    }
    function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && isFinite(o.x) && isFinite(o.y) ? o : null; } catch (_) { return null; } }
    function save(o) { try { if (o) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch (_) {} }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function place(fab, left, top) {
        const w = fab.offsetWidth || 64, h = fab.offsetHeight || 64;
        left = clamp(left, SIZE_PAD, window.innerWidth - w - SIZE_PAD);
        top = clamp(top, SIZE_PAD, window.innerHeight - h - SIZE_PAD);
        fab.style.setProperty('left', left + 'px', 'important');
        fab.style.setProperty('top', top + 'px', 'important');
        fab.style.setProperty('right', 'auto', 'important');
        fab.style.setProperty('bottom', 'auto', 'important');
        fab.classList.add('iba-fab-moved');
        document.body.classList.add('iba-fab-is-moved');   // patch 76: css lifts it (and its bubbles) in front of the side menu
        follow();
        return { left, top };
    }
    function unplace(fab) {
        ['left', 'top', 'right', 'bottom'].forEach((p) => fab.style.removeProperty(p));
        fab.classList.remove('iba-fab-moved');
        document.body.classList.remove('iba-fab-is-moved');
        follow();
    }
    function apply() {
        const fab = $('iba-ai-fab');
        if (!fab) return;
        const o = pc() ? load() : null;
        if (!o) { if (fab.classList.contains('iba-fab-moved')) unplace(fab); return; }
        const w = fab.offsetWidth || 64, h = fab.offsetHeight || 64;
        place(fab, o.x * (window.innerWidth - w), o.y * (window.innerHeight - h));
    }
    // the speech bubbles sit next to the robot wherever it is
    function follow() {
        const fab = $('iba-ai-fab');
        const moved = fab && fab.classList.contains('iba-fab-moved');
        // patch 79 (martin): everything opens toward the free side of the screen. body.iba-fab-L = robot on the left half,
        // iba-fab-T = top half (css flips the bubble tail, the laptop scene and the IRIS window); --iba-fab-pl = where
        // the window starts on the left, clear of a pinned side menu
        const b = document.body;
        if (b) {
            let L = false, T = false;
            if (moved) { const r = fab.getBoundingClientRect(); L = r.left + r.width / 2 < window.innerWidth / 2; T = r.top + r.height / 2 < window.innerHeight / 2; }
            b.classList.toggle('iba-fab-L', L); b.classList.toggle('iba-fab-T', T);
            let pl = 16;
            try { const sb = $('iba-shell-sidebar'); if (sb && b.classList.contains('iba-sidebar-pinned')) { const sr = sb.getBoundingClientRect(); if (sr.width > 0 && sr.left < 40) pl = Math.max(pl, Math.round(sr.right + 12)); } } catch (_) {}
            b.style.setProperty('--iba-fab-pl', pl + 'px');
        }
        ['iba-ai-tip', 'iba-ai-bubble'].forEach((id) => {
            const el = $(id);
            if (!el) return;
            const props = ['left', 'right', 'top', 'bottom', 'transform-origin'];
            if (!moved) { props.forEach((p) => el.style.removeProperty(p)); return; }
            const r = fab.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
            const leftSide = r.left + r.width / 2 < W / 2, topSide = r.top + r.height / 2 < H / 2;
            el.style.setProperty(leftSide ? 'left' : 'right', (leftSide ? Math.max(8, r.left) : Math.max(8, W - r.right)) + 'px', 'important');
            el.style.setProperty(leftSide ? 'right' : 'left', 'auto', 'important');
            el.style.setProperty(topSide ? 'top' : 'bottom', (topSide ? r.bottom + 10 : H - r.top + 10) + 'px', 'important');
            el.style.setProperty(topSide ? 'bottom' : 'top', 'auto', 'important');
            el.style.setProperty('transform-origin', (topSide ? 'top ' : 'bottom ') + (leftSide ? 'left' : 'right'), 'important');
        });
    }

    let drag = null, swallow = false;
    document.addEventListener('pointerdown', (e) => {
        const fab = e.target && e.target.closest && e.target.closest('#iba-ai-fab');
        if (!fab || e.button !== 0 || !pc()) return;
        const r = fab.getBoundingClientRect();
        drag = { fab, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moving: false };
    }, true);
    document.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moving) {
            if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < MOVE) return;
            drag.moving = true;
            drag.fab.classList.add('iba-fab-dragging');
            try { drag.fab.setPointerCapture(e.pointerId); } catch (_) {}
        }
        e.preventDefault();
        place(drag.fab, e.clientX - drag.dx, e.clientY - drag.dy);
    }, true);
    function end(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        const d = drag; drag = null;
        if (!d.moving) return;
        d.fab.classList.remove('iba-fab-dragging');
        swallow = true; setTimeout(() => { swallow = false; }, 350);   // the drop is not a click
        const r = d.fab.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
        if (W - r.right < 70 && H - r.bottom < 70) { save(null); unplace(d.fab); return; }   // back in its corner
        save({ x: r.left / Math.max(1, W - r.width), y: r.top / Math.max(1, H - r.height) });
    }
    document.addEventListener('pointerup', end, true);
    document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#iba-ai-fab')) follow(); }, true);
    document.addEventListener('pointercancel', end, true);
    document.addEventListener('click', (e) => {
        if (swallow && e.target && e.target.closest && e.target.closest('#iba-ai-fab')) { e.preventDefault(); e.stopImmediatePropagation(); swallow = false; }
    }, true);
    document.addEventListener('dblclick', (e) => {
        const fab = e.target && e.target.closest && e.target.closest('#iba-ai-fab.iba-fab-moved');
        if (!fab) return;
        save(null); unplace(fab);
    }, true);
    window.addEventListener('resize', () => { clearTimeout(apply.t); apply.t = setTimeout(apply, 120); });

    // bubbles appear later: keep them next to the robot
    new MutationObserver(() => { clearTimeout(follow.t); follow.t = setTimeout(follow, 0); })
        .observe(document.body, { childList: true });
    (function boot(n) {
        const fab = $('iba-ai-fab');
        if (!fab) { if (n < 120) setTimeout(() => boot(n + 1), 500); return; }
        fab.style.touchAction = 'none';
        if (!fab.title) fab.title = 'IRIS · drag to move me';
        apply();
        new MutationObserver(() => { if (fab.classList.contains('iba-fab-moved') && !fab.style.getPropertyValue('left')) apply(); })
            .observe(fab, { attributes: true, attributeFilter: ['style'] });
    })(0);
    // 18.0.0 patch 130: "is a pop-up open?" is now checked here (every 0.4 s, only while the robot is moved) and set as
    // body.iba-fab-under-modal. It used to be a css :has() rule that looked at every element's style attribute, which made
    // the browser recheck the WHOLE page each time anything moved (clock hand, counters) and slowed Material Stock scrolling.
    setInterval(() => {
        const b = document.body;
        if (!b || !b.classList.contains('iba-fab-is-moved')) { if (b && b.classList.contains('iba-fab-under-modal')) b.classList.remove('iba-fab-under-modal'); return; }
        let up = !!document.querySelector('.modal-overlay:not(.hidden)');
        if (!up) { const ms = document.querySelectorAll('.modal:not(.hidden)'); for (let i = 0; i < ms.length && !up; i++) { const d = ms[i].style.display; up = d === 'flex' || d === 'block'; } }
        if (b.classList.contains('iba-fab-under-modal') !== up) b.classList.toggle('iba-fab-under-modal', up);
    }, 400);
    window.ibaBotDrag = { reset: () => { save(null); const f = $('iba-ai-fab'); if (f) unplace(f); }, apply };
})();
