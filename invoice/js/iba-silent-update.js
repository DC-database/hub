/* ==========================================================================
   iba-silent-update.js — 17.0.4
   Keeps every open tab on the newest upload WITHOUT changing the version
   number. Every patch changes the ?v= tags in index.html, so:
   - every 30 min (and when the tab comes back) it reads index.html from the
     server (first only its date stamp; the file itself only when the stamp
     changed or the server gives none) - never Firebase;
   - if index.html lists a file version this page did not load, a new upload
     is out: the page reloads ONCE, quietly, at a safe moment: just opened,
     tab hidden for 2+ min, nobody used it for 30+ min, or 4-6 am Doha
     after 5 min idle - and never while a pop-up is open or something typed
     is still in a box;
   - no loop: one reload per upload (remembered in localStorage), at least
     15 min between automatic reloads. If the page still looks old after
     its reload, it stops; the normal version notice still works.
   Big updates keep using version.json + "Update Now" (app-version-checker).
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaSilentUpdate) return;
    if (!window.location || window.location.protocol === 'file:') return;

    var KEY = 'iba-silent-upd-v1';
    var CHECK_MS = 30 * 60 * 1000;
    var GAP_MS = 15 * 60 * 1000;
    var IDLE_MS = 30 * 60 * 1000;
    var HIDDEN_MS = 2 * 60 * 1000;
    var OPEN_MS = 90 * 1000;
    var loadedAt = Date.now();
    var lastInput = 0;          // last key / click / touch by the user
    var hiddenSince = document.hidden ? Date.now() : 0;
    var lastCheck = 0;
    var lastStamp = '';         // ETag / Last-Modified of index.html last time
    var pending = '';           // signature of the newer upload found
    var typed = [];             // boxes the user typed in

    function pageUrl() {
        var p = window.location.pathname || '/';
        return p.replace(/[^/]*$/, '') + 'index.html';
    }
    function readMemo() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
    function writeMemo(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }

    // file versions this page loaded (scripts and stylesheets with ?v=)
    function loadedSet() {
        var s = {};
        var els = document.querySelectorAll('script[src], link[href]');
        for (var i = 0; i < els.length; i++) {
            var v = els[i].getAttribute('src') || els[i].getAttribute('href') || '';
            if (v.indexOf('?v=') !== -1) s[v.trim()] = 1;
        }
        return s;
    }
    // file versions the index.html on the server lists
    function listedIn(html) {
        var out = [];
        var rx = /<(?:script|link)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+\?v=[^"']+)["']/gi;
        var m;
        while ((m = rx.exec(html))) out.push(m[1].trim());
        return out;
    }
    function newerIn(html) {
        var have = loadedSet();
        var listed = listedIn(html);
        if (listed.length < 5) return ''; // not the real page (error page, login wall...)
        var miss = listed.filter(function (u) { return !have[u]; });
        return miss.length ? miss.sort().join('|') : '';
    }

    function fetchStamp() {
        return fetch(pageUrl() + '?t=' + Date.now(), { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
            .then(function (r) { return r.ok ? (r.headers.get('ETag') || r.headers.get('Last-Modified') || '') : ''; })
            .catch(function () { return ''; });
    }
    function fetchPage() {
        return fetch(pageUrl() + '?t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.text() : ''; })
            .catch(function () { return ''; });
    }

    function check() {
        if (pending) { tryReload(); return; }
        lastCheck = Date.now();
        fetchStamp().then(function (stamp) {
            if (stamp && stamp === lastStamp) return null; // unchanged since last look
            return fetchPage().then(function (html) {
                if (!html) return;
                if (stamp) lastStamp = stamp;
                var sig = newerIn(html);
                if (!sig) return;
                var memo = readMemo();
                if (memo.sig === sig) return; // already reloaded for this upload once: stop
                pending = sig;
                tryReload();
            });
        }).catch(function () {});
    }

    function visible(el) {
        if (!el || !el.getClientRects().length) return false;
        var cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    }
    function busy() {
        // a pop-up is open
        var pops = document.querySelectorAll('.modal-container, .modal:not(.hidden), [role="dialog"]:not(#iba-system-update-notice), .swal2-container');
        for (var i = 0; i < pops.length; i++) if (visible(pops[i])) return true;
        // something the user typed is still in a box on screen
        typed = typed.filter(function (el) { return el.isConnected; });
        for (var j = 0; j < typed.length; j++) {
            var el = typed[j];
            var val = el.isContentEditable ? el.textContent : el.value;
            if (String(val || '').trim() && visible(el)) return true;
        }
        // typing right now
        var a = document.activeElement;
        if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && Date.now() - lastInput < 60000) return true;
        return false;
    }
    function dohaHour() {
        var d = new Date(Date.now() + 3 * 3600000); // Qatar = UTC+3, no daylight saving
        return d.getUTCHours();
    }
    function safeMoment() {
        var now = Date.now();
        if (!lastInput && now - loadedAt < OPEN_MS) return true;           // just opened
        if (document.hidden && hiddenSince && now - hiddenSince > HIDDEN_MS) return true;
        var idle = now - Math.max(lastInput, loadedAt);
        if (idle > IDLE_MS) return true;
        var h = dohaHour();
        if (h >= 4 && h < 6 && idle > 5 * 60000) return true;
        return false;
    }
    function tryReload() {
        if (!pending) return;
        var memo = readMemo();
        if (memo.sig === pending) { pending = ''; return; }
        if (memo.at && Date.now() - memo.at < GAP_MS) return;
        if (!safeMoment() || busy()) return;
        writeMemo({ sig: pending, at: Date.now() });
        try {
            var url = new URL(window.location.href);
            url.searchParams.set('iba_refresh', Date.now().toString());
            window.location.replace(url.toString());
        } catch (e) {
            window.location.reload();
        }
    }

    function mark(e) {
        lastInput = Date.now();
        var t = e && e.target;
        if (e && e.type === 'input' && t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName)) &&
            !/^(checkbox|radio|button|submit|range|color|file|hidden)$/i.test(t.type || '') && typed.indexOf(t) === -1) typed.push(t);
    }
    ['keydown', 'pointerdown', 'touchstart', 'wheel'].forEach(function (ev) { document.addEventListener(ev, mark, { capture: true, passive: true }); });
    document.addEventListener('input', mark, true);
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) { hiddenSince = Date.now(); return; }
        hiddenSince = 0;
        if (Date.now() - lastCheck > 5 * 60000) check();
    });

    setTimeout(check, 20000);
    setInterval(check, CHECK_MS);
    setInterval(tryReload, 60000); // a found update waits here for a safe moment

    window.ibaSilentUpdate = { check: check, state: function () { return { pending: pending, lastStamp: lastStamp, memo: readMemo(), safe: safeMoment(), busy: busy() }; } };
})();
