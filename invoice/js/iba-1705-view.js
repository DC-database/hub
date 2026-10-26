/* ==========================================================================
   iba-1705-view.js — 17.0.5 patch 2
   Desktop view on a tablet. A 7" tablet is about 600 px wide in portrait
   and got the phone screen, although the desktop pages fit it in landscape.
   - On the phone screen of a tablet (short side 540 px or more) the header
     has a desktop icon: it switches THIS device to the desktop view.
   - The desktop view lays the page out 1200 px wide and lets the browser
     scale it to the screen (like Chrome's "Desktop site"); the choice is
     kept in this browser (localStorage iba-view-mode-v1). The early part
     runs in index.html <head>; js/app-mobile.js then answers "not mobile".
   - In the desktop view the top bar has a phone icon to go back.
   Real phones never see the button.
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaViewMode) return;
    const KEY = 'iba-view-mode-v1';

    function isTablet() {
        const sw = Number(screen && screen.width) || 0, sh = Number(screen && screen.height) || 0;
        const short = Math.min(sw, sh);
        let touch = false;
        try { touch = (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches; } catch (_) {}
        return touch && short >= 540;
    }
    function set(mode) {
        try {
            if (mode === 'desktop') localStorage.setItem(KEY, 'desktop');
            else localStorage.removeItem(KEY);
        } catch (_) {}
        // a fresh load (not reload): a reload keeps the old zoom
        try {
            const u = new URL(location.href);
            u.searchParams.set('iba_view', Date.now().toString(36));
            location.replace(u.toString());
        } catch (_) { location.reload(); }
    }
    function paint() {
        // phone screen: the desktop icon (tablets only)
        document.querySelectorAll('[data-iba-view="desktop"]').forEach((b) => {
            const show = isTablet() && !window.IBA_FORCE_DESKTOP;
            if (b.hidden === show) b.hidden = !show;
        });
        // desktop view on a tablet: a way back to the phone screen
        if (window.IBA_FORCE_DESKTOP && !document.getElementById('iba-view-phone-btn')) {
            const right = document.querySelector('.iba-shell-right');
            if (right) {
                const b = document.createElement('button');
                b.type = 'button';
                b.id = 'iba-view-phone-btn';
                b.className = 'iba-shell-icon-btn';
                b.title = 'Phone view (this device)';
                b.setAttribute('aria-label', 'Phone view');
                b.setAttribute('data-iba-view', 'phone');
                b.innerHTML = '<i class="fa-solid fa-mobile-screen"></i>';
                right.insertBefore(b, right.firstChild);
            }
        }
    }
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-iba-view]');
        if (!b) return;
        e.preventDefault();
        const to = b.getAttribute('data-iba-view');
        if (to === 'desktop' && !confirm('Use the desktop view on this device? (You can switch back with the phone icon at the top.)')) return;
        set(to);
    }, true);
    function start() {
        paint();
        // the phone screen and the top bar are drawn after sign-in (cheap
        // check: it only writes when something has to change)
        setInterval(paint, 3000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
    window.ibaViewMode = { get: () => (window.IBA_FORCE_DESKTOP ? 'desktop' : 'auto'), set, isTablet };
})();
