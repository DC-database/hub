/* js/iba-office-boot.js — 18.0.0 patch 132: "Office" menu button for the Super Admin only.
   Tiny: every 2 s it checks if the signed-in user is the Super Admin and shows/hides the button.
   The office itself (js/iba-office.js + css/iba-office.css) is downloaded only on the first click,
   so nothing of the office runs for anyone else. Open from the console: window.ibaOfficeOpen() */
(function () {
    'use strict';
    var V = '18.0.0-p158', loading = null;
    function isSuper() {
        try { if (window.ibaTestAs) return false; return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; }
    }
    function load() {
        if (window.ibaOffice && window.ibaOffice.ready) return Promise.resolve();
        if (loading) return loading;
        loading = new Promise(function (res, rej) {
            var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/iba-office.css?v=' + V; document.head.appendChild(l);
            function script(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('Could not load ' + src)); }; document.head.appendChild(s); }); }
            function three() {
                if (window.THREE) return Promise.resolve();
                return import('https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js').then(function (mod) { window.THREE = mod; }).catch(function () {
                    return import('https://unpkg.com/three@0.187.0/build/three.module.js').then(function (mod) { window.THREE = mod; });
                });
            }
            three().then(function () { return script('js/iba-office.js?v=' + V); })
              .then(function () { return script('js/iba-office-3d.js?v=' + V); })
              .then(function () { return script('js/iba-office-print.js?v=' + V); })
              .then(res).catch(function (e) { loading = null; rej(e); });
        });
        return loading;
    }
    function openOffice() {
        if (!isSuper()) return;
        var b = document.getElementById('iba-office-nav'); if (b) b.disabled = true;
        load().then(function () { if (window.ibaOffice) window.ibaOffice.open(); })
            .catch(function (e) { console.warn('Office: could not load', e); })
            .then(function () { if (b) b.disabled = false; });
    }
    function paint() {
        var ok = isSuper();
        var li = document.getElementById('iba-office-nav-li');
        if (!li) {
            if (!ok) return;
            var list = document.querySelector('#iba-shell-sidebar .iba-nav-list'); if (!list) return;
            li = document.createElement('li'); li.id = 'iba-office-nav-li';
            li.innerHTML = '<button class="iba-nav-btn" id="iba-office-nav" type="button" title="IBA Office (Super Admin, beta)"><i class="fa-solid fa-building"></i> Office <small style="font-size:10px;opacity:.7;letter-spacing:.05em">BETA</small></button>';
            var first = list.firstElementChild; list.insertBefore(li, first ? first.nextSibling : null);
            li.querySelector('button').addEventListener('click', openOffice);
        }
        li.hidden = !ok; li.style.display = ok ? '' : 'none';
        if (!ok && window.ibaOffice) window.ibaOffice.close();
    }
    // 18.0.0 patch 155: "My office" card on the phone Home (Super Admin only). Tap = the same office,
    // zoomed on your room; one finger moves, two fingers pinch to zoom / twist to turn.
    var PHONE_CSS = '#iba-office-phone{display:flex;align-items:center;gap:12px;width:100%;margin:12px 0 0;padding:12px 14px;min-height:64px;' +
        'border-radius:16px;border:1px solid rgba(227,201,138,.55);background:#161B24;color:#EEF2F7;text-align:left;cursor:pointer;font:inherit}' +
        '#iba-office-phone>i:first-child{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(227,201,138,.14);color:#E3C98A;font-size:18px;flex:none}' +
        '#iba-office-phone span{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}' +
        '#iba-office-phone b{font-size:15px;color:#E3C98A}#iba-office-phone small{font-size:12px;color:#A9B4C2;line-height:1.35}' +
        '#iba-office-phone em{font-style:normal;color:#EEF2F7;font-weight:700}#iba-office-phone>i:last-child{color:#E3C98A;flex:none}' +
        '#iba-office-phone[disabled]{opacity:.6}';
    function phoneText() {
        try {
            var s = window.ibaOffice && window.ibaOffice.summary ? window.ibaOffice.summary() : null;
            if (!s || !s.at) return 'Tap to open: your desk, cabinets, Ready to Print and the 4 bots';
            var n = function (id) { var c = s.cabs.filter(function (q) { return q.id === id; })[0]; return c ? c.n : 0; };
            var t = new Date(s.at), hh = t.getHours(), mm = ('0' + t.getMinutes()).slice(-2);
            var rina = s.bots.filter(function (b) { return b.name === 'Rina'; })[0];
            return 'Your desk <em>' + n('tray') + '</em> · Ready to Print <em>' + n('rtp') + '</em> · For Approval <em>' + n('me') + '</em><br>' +
                (rina ? 'Rina: ' + String(rina.status || '').replace(/[<>&]/g, '') + ' · ' : '') + 'as of ' + ((hh % 12) || 12) + ':' + mm + (hh < 12 ? ' AM' : ' PM');
        } catch (_) { return 'Tap to open'; }
    }
    function phoneCard() {
        var ph = document.getElementById('iba-phone');
        var card = document.getElementById('iba-office-phone');
        if (!ph || !isSuper()) { if (card) card.remove(); return; }
        var counts = ph.querySelector('.iba-mh-counts');
        if (!counts) return;
        if (!document.getElementById('iba-office-phone-css')) { var st = document.createElement('style'); st.id = 'iba-office-phone-css'; st.textContent = PHONE_CSS; document.head.appendChild(st); }
        if (!card || card.previousElementSibling !== counts) {
            if (card) card.remove();
            card = document.createElement('button'); card.type = 'button'; card.id = 'iba-office-phone';
            card.innerHTML = '<i class="fa-solid fa-building"></i><span><b>My office</b><small></small></span><i class="fa-solid fa-chevron-right"></i>';
            card.addEventListener('click', function () { card.disabled = true; card.querySelector('small').textContent = 'Opening the office...'; load().then(function () { if (window.ibaOffice) window.ibaOffice.open(); }).catch(function (e) { console.warn('Office: could not load', e); }).then(function () { card.disabled = false; card.querySelector('small').innerHTML = phoneText(); }); });
            counts.parentNode.insertBefore(card, counts.nextSibling);
        }
        if (!card.disabled) { var h = phoneText(); if (card.querySelector('small').innerHTML !== h) card.querySelector('small').innerHTML = h; }
    }
    var phoneWatch = null;
    function watchPhone() {
        var ph = document.getElementById('iba-phone'); if (!ph || phoneWatch) return;
        var queued = false;
        phoneWatch = new MutationObserver(function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; phoneCard(); }); });
        phoneWatch.observe(ph, { childList: true, subtree: true });
    }
    window.ibaOfficeOpen = openOffice;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
    setInterval(function () { paint(); watchPhone(); phoneCard(); }, 2000);
})();

