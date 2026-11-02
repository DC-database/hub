/* ==========================================================================
   js/iba-1705-pdfwin.js — 17.0.5 patch 65
   Side PDF viewer: on a PC, invoice / SRV PDFs (OneDrive / SharePoint) open
   in ONE separate window docked on the right half of the screen instead of
   a new tab. The next PDF reuses the same window (no pile of tabs). Move or
   resize it once and it stays there.
   SharePoint does not allow its files inside our page (frame-ancestors),
   so a separate window is the closest thing that works for everyone.
   - Ctrl / Shift / middle click = the normal new tab, as before.
   - Phones and tablets: unchanged.
   - Window blocked by the browser -> opens a normal tab, as before.
   ========================================================================== */
(function () {
    'use strict';

    const NAME = 'iba-pdf-viewer';
    const PDF_RE = /^https:\/\/[a-z0-9-]+\.sharepoint\.com\/.+\.pdf(\?|#|$)/i;
    let win = null;

    function isPc() {
        try {
            if (document.body && document.body.classList.contains('iba-mobile-ui')) return false;
            return window.matchMedia('(pointer: fine)').matches && (window.screen.availWidth || 0) >= 1000;
        } catch (_) { return false; }
    }
    const isPdf = (u) => PDF_RE.test(String(u || ''));

    function features() {
        const s = window.screen;
        const aw = s.availWidth || 1280, ah = s.availHeight || 800;
        const left = (s.availLeft || 0) + Math.round(aw / 2);
        const top = s.availTop || 0;
        const w = Math.round(aw / 2), h = ah;
        return 'popup=yes,width=' + w + ',height=' + h + ',left=' + left + ',top=' + top;
    }

    // returns true when the side window took it
    function show(url) {
        if (!isPc() || !isPdf(url)) return false;
        let w = null;
        // same window name: an open viewer just loads the new PDF and keeps where the user put it
        try { w = origOpen.call(window, url, NAME, features()); } catch (_) { w = null; }
        if (!w) return false;
        win = w;
        try { w.focus(); } catch (_) {}
        return true;
    }

    // links (<a href="...pdf" target="_blank">)
    document.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a || !isPdf(a.href)) return;
        if (show(a.href)) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // buttons that call window.open(pdfUrl, '_blank')
    const origOpen = window.open;
    window.open = function (url, target) {
        try {
            if ((!target || target === '_blank') && isPdf(url) && show(String(url))) return win;
        } catch (_) {}
        return origOpen.apply(window, arguments);
    };

    window.ibaPdfWin = { show: show, isPdf: isPdf };
})();
