/* ==========================================================================
   iba-1717-slide.js — 18.0.0 patch 117 (martin)
   IRIS windows slide out BESIDE the assistant instead of covering it.
   - IRIS on the right half of the screen -> windows slide out to the left;
     IRIS on the left half -> they slide out to the right.
   - The invoice detail (tracking receipt) is window 1. What it opens
     (Remind, Mark urgent) slides out next to it as window 2, and so on.
     Something opened from the chat itself starts a new row at window 1.
   - x closes that window and every window after it; Esc closes the last.
   - Phone, IRIS big window, or not enough room: the old way (over IRIS).
   The windows stay inside #iba-ai-panel (its click handlers and styles keep
   working); the panel only lets them show outside its edge.
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaSlide) return;
    var VERSION = '18.0.0-p118';
    var GAP = 12, W_MAX = 420, W_MIN = 330;
    var SUB = '.iba-ai-remind, .iba-ai-urg-mini';
    var TITLES = { 'iba-ai-remind': ['fa-bell', 'Remind'], 'iba-ai-urg-mini': ['fa-bolt', 'Mark urgent'] };

    function panel() { return document.getElementById('iba-ai-panel'); }
    function phone() { return document.body.classList.contains('iba-mobile-ui') || document.body.classList.contains('iba-phone'); }
    function imp(el, k, v) { el.style.setProperty(k, v, 'important'); }
    function wins() {
        var p = panel();
        if (!p) return [];
        return Array.prototype.filter.call(p.children, function (c) { return c.classList && c.classList.contains('iba-sl-win'); })
            .sort(function (a, b) { return (a.__lvl || 0) - (b.__lvl || 0); });
    }
    // where is there room? null = no room -> old overlay
    function sideInfo() {
        var p = panel();
        if (!p || p.hidden || phone() || p.classList.contains('is-wide')) return null;
        var r = p.getBoundingClientRect();
        if (!r.width) return null;
        var vw = window.innerWidth || document.documentElement.clientWidth;
        var left = (r.left + r.width / 2) > vw / 2;
        var room = (left ? r.left : vw - r.right) - GAP - 8;
        if (room < W_MIN) return null;
        return { left: left, room: room, w: Math.min(W_MAX, room) };
    }

    var STYLE_KEYS = ['position', 'inset', 'top', 'bottom', 'left', 'right', 'width', 'height', 'max-height', 'border-radius', 'box-shadow', 'z-index', 'border', 'background', 'transform', 'opacity', 'transition'];
    function plain(el) { STYLE_KEYS.forEach(function (k) { el.style.removeProperty(k); }); el.classList.remove('is-sl-left', 'is-sl-right', 'is-sl-in'); }

    function layout() { layout0(); if (attrObs) attrObs.takeRecords(); }
    function layout0() {
        var p = panel();
        if (!p) return;
        var list = wins();
        var si = list.length ? sideInfo() : null;
        if (!si) {
            list.forEach(plain);
            p.style.removeProperty('overflow');
            corners(p, false);
            p.classList.remove('iba-sl-on');
            // sub windows have no overlay of their own: put their box back in place
            list.forEach(function (w) { if (w.__sub) unwrap(w); });
            return;
        }
        imp(p, 'overflow', 'visible');
        p.classList.add('iba-sl-on');
        corners(p, true);
        list.forEach(function (w, i) {
            var off = Math.min(i * (si.w + GAP), Math.max(0, si.room - si.w));
            imp(w, 'position', 'absolute');
            imp(w, 'inset', 'auto');
            imp(w, 'top', (w.__sub ? 28 + i * 10 : 0) + 'px');
            imp(w, 'width', si.w + 'px');
            if (w.__sub) { imp(w, 'height', 'auto'); imp(w, 'max-height', 'calc(100% - ' + (56 + i * 20) + 'px)'); }
            else { imp(w, 'height', '100%'); imp(w, 'max-height', '100%'); }
            imp(w, si.left ? 'right' : 'left', 'calc(100% + ' + (GAP + off) + 'px)');
            imp(w, 'z-index', String(70 - i));
            imp(w, 'border-radius', '14px');
            imp(w, 'border', '1px solid rgba(255,255,255,.09)');
            imp(w, 'box-shadow', '0 18px 50px rgba(0,0,0,.55)');
            w.classList.toggle('is-sl-left', si.left);
            w.classList.toggle('is-sl-right', !si.left);
            if (!w.classList.contains('is-sl-in')) {
                imp(w, 'transform', 'translateX(' + (si.left ? 28 : -28) + 'px)');
                imp(w, 'opacity', '0');
                void w.offsetWidth;
                imp(w, 'transition', 'transform .22s ease, opacity .22s ease');
                w.classList.add('is-sl-in');
                requestAnimationFrame(function () { imp(w, 'transform', 'none'); imp(w, 'opacity', '1'); });
            }
        });
    }

    // overflow is visible while windows are out, so round the panel's own top and bottom parts
    function corners(p, on) {
        Array.prototype.forEach.call(p.children, function (c) {
            if (c.classList.contains('iba-sl-win')) return;
            ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'].forEach(function (k) { c.style.removeProperty(k); });
        });
        if (!on) return;
        var vis = Array.prototype.filter.call(p.children, function (c) { return !c.classList.contains('iba-sl-win') && getComputedStyle(c).display !== 'none'; });
        if (!vis.length) return;
        var r = getComputedStyle(p).borderTopLeftRadius || '18px';
        imp(vis[0], 'border-top-left-radius', r); imp(vis[0], 'border-top-right-radius', r);
        var last = vis[vis.length - 1];
        imp(last, 'border-bottom-left-radius', r); imp(last, 'border-bottom-right-radius', r);
    }

    function closeFrom(lvl) {
        wins().forEach(function (w) {
            if ((w.__lvl || 0) < lvl) return;
            if (w.__sub) { mute = true; w.remove(); mute = false; }
            else if (w.id === 'iba-trk-rcpt') { w.remove(); }
        });
        layout();
    }
    function lvlOf(el) {
        var w = el && el.closest && el.closest('.iba-sl-win');
        return w ? (w.__lvl || 1) : 0;
    }

    // a small box (Remind / Mark urgent) -> its own window next to where it came from
    function wrap(box, fromLvl) {
        var p = panel();
        var cls = box.classList.contains('iba-ai-remind') ? 'iba-ai-remind' : 'iba-ai-urg-mini';
        var t = TITLES[cls];
        closeFrom(fromLvl + 1);
        var w = document.createElement('div');
        w.className = 'iba-sl-win iba-sl-sub';
        w.setAttribute('role', 'dialog');
        w.setAttribute('aria-label', t[1]);
        w.__lvl = fromLvl + 1; w.__sub = true; w.__home = box.parentNode; w.__next = box.nextSibling;
        w.innerHTML = '<div class="iba-sl-head"><button type="button" class="iba-trk-r-x iba-sl-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><span><i class="fa-solid ' + t[0] + '"></i> ' + t[1] + '</span></div><div class="iba-sl-body"></div>';
        mute = true;
        w.querySelector('.iba-sl-body').appendChild(box);
        p.appendChild(w);
        mute = false;
        w.querySelector('.iba-sl-x').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); closeFrom(w.__lvl); });
        layout();
        var f = box.querySelector('input, textarea');
        if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (_) {} }, 30);
    }
    // no room any more: the box goes back where IRIS put it
    function unwrap(w) {
        var box = w.querySelector('.iba-sl-body > *');
        mute = true;
        try { if (box && w.__home && w.__home.isConnected) w.__home.insertBefore(box, w.__next && w.__next.parentNode === w.__home ? w.__next : null); } catch (_) {}
        w.remove();
        mute = false;
    }

    var mute = false, attrObs = null;
    function onMut(recs) {
        if (mute) return;
        var p = panel();
        var need = false;
        recs.forEach(function (r) {
            Array.prototype.forEach.call(r.addedNodes, function (n) {
                if (n.nodeType !== 1) return;
                if (n.id === 'iba-trk-rcpt' && n.parentNode === p && !n.classList.contains('is-aph-detail')) {
                    if (!sideInfo()) return;
                    // a new invoice from the chat: start the row again
                    closeFrom(1);
                    n.classList.add('iba-sl-win');
                    n.__lvl = 1;
                    need = true;
                    return;
                }
                if (n.matches && n.matches(SUB) && !n.closest('.iba-sl-body') && sideInfo()) {
                    wrap(n, lvlOf(r.target));
                }
            });
            Array.prototype.forEach.call(r.removedNodes, function (n) {
                if (n.nodeType !== 1) return;
                // receipt closed by its own x: close what it opened
                if (n.classList && n.classList.contains('iba-sl-win')) { closeFrom((n.__lvl || 1) + 1); need = true; }
                // Cancel inside a Remind / urgent box removes the box: close its window too
                if (r.target.classList && r.target.classList.contains('iba-sl-body')) {
                    var w = r.target.closest('.iba-sl-win');
                    if (w && !r.target.firstElementChild) closeFrom(w.__lvl);
                }
            });
        });
        if (need) layout();
    }

    function hook() {
        var p = panel();
        if (!p || p.__ibaSlide) return !!p;
        p.__ibaSlide = true;
        new MutationObserver(onMut).observe(p, { childList: true, subtree: true });
        attrObs = new MutationObserver(function () { if (wins().length) layout(); });
        attrObs.observe(p, { attributes: true, attributeFilter: ['class', 'hidden'] });
        return true;
    }
    if (!hook()) {
        var tries = 0;
        var t = setInterval(function () { if (hook() || ++tries > 600) clearInterval(t); }, 1000);
    }
    var rz = 0;
    window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (wins().length) layout(); }, 120); });
    // Esc closes the last slide-out window first (IRIS's own Esc then closes the invoice)
    window.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var list = wins();
        if (!list.length) return;
        if (document.querySelector('.modal-overlay:not(.hidden) .modal-container:focus-within')) return;
        var last = list[list.length - 1];
        if (!last.__sub) return; // the invoice itself: IRIS closes it
        e.preventDefault(); e.stopImmediatePropagation();
        closeFrom(last.__lvl);
    }, true);

    window.ibaSlide = { VERSION: VERSION, layout: layout, close: closeFrom, list: wins };
})();
