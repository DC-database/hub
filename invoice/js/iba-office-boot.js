/* js/iba-office-boot.js — 18.0.0 patch 132: "Office" menu button for the Super Admin only.
   Tiny: every 2 s it checks if the signed-in user is the Super Admin and shows/hides the button.
   The office itself (js/iba-office.js + css/iba-office.css) is downloaded only on the first click,
   so nothing of the office runs for anyone else. Open from the console: window.ibaOfficeOpen() */
(function () {
    'use strict';
    var V = '18.0.0-p141', loading = null;
    function isSuper() {
        try { if (window.ibaTestAs) return false; return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; }
    }
    function load() {
        if (window.ibaOffice && window.ibaOffice.ready) return Promise.resolve();
        if (loading) return loading;
        loading = new Promise(function (res, rej) {
            var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/iba-office.css?v=' + V; document.head.appendChild(l);
            var s = document.createElement('script'); s.src = 'js/iba-office.js?v=' + V;
            s.onload = function () { res(); var r = document.createElement('script'); r.src = 'js/iba-office-print.js?v=' + V; document.head.appendChild(r); }; // patch 140: Ready to Print
            s.onerror = function () { loading = null; rej(new Error('office file not found')); };
            document.head.appendChild(s);
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
    window.ibaOfficeOpen = openOffice;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
    setInterval(paint, 2000);
})();
