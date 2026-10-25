/* 17.0.3 patch 4/5: WhatsApp Business first on Android.
   Every WhatsApp link / window.open to wa.me or api.whatsapp.com becomes an
   Android intent for WhatsApp Business (com.whatsapp.w4b). If Business is not
   installed, Android falls back to the normal wa.me link. iPhone and PC are
   unchanged (iOS does not let a web page choose which WhatsApp opens).
   (Patch 5 took the Outlook email part out again: martin only asked whether it
   was possible and will say where he wants email first.) */
(function () {
    'use strict';
    if (window.ibaWaBusiness) return;

    const ANDROID = /Android/i.test(navigator.userAgent || '');
    if (!ANDROID) { window.ibaWaBusiness = { VERSION: '17.0.3-p5', active: false }; return; }
    const WA_RX = /^https?:\/\/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//i;

    function waParts(url) {
        try {
            const u = new URL(url);
            let phone = '';
            if (/wa\.me$/i.test(u.hostname)) phone = u.pathname.replace(/\D+/g, '');
            else phone = String(u.searchParams.get('phone') || '').replace(/\D+/g, '');
            return { phone: phone, text: u.searchParams.get('text') || '' };
        } catch (_) { return null; }
    }
    function businessIntent(url) {
        const p = waParts(url);
        if (!p) return '';
        const q = [];
        if (p.phone) q.push('phone=' + p.phone);
        if (p.text) q.push('text=' + encodeURIComponent(p.text));
        return 'intent://send' + (q.length ? '?' + q.join('&') : '') +
            '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
    }
    function openWa(url) {
        const it = businessIntent(url);
        if (!it) return false;
        window.location.href = it;
        return true;
    }

    // window.open('https://wa.me/...') from any file
    const origOpen = window.open;
    window.open = function (url) {
        const s = String(url || '');
        if (WA_RX.test(s) && openWa(s)) return { closed: false, close() {}, focus() {} };
        return origOpen.apply(window, arguments);
    };

    // plain WhatsApp links
    document.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0) return;
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (WA_RX.test(href)) { e.preventDefault(); openWa(href); }
    }, true);

    window.ibaWaBusiness = { VERSION: '17.0.3-p5', active: true, businessIntent };
})();
