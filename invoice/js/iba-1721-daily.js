/* ==========================================================================
   iba-1721-daily.js — 18.0.0 patch 122 (martin): sign in once a day
   - A new working day starts at 4 AM Doha. A sign-in from an earlier day
     ends: the next time the page opens, it shows the sign-in screen.
   - If the system is still open after 4 AM, it signs out at a SAFE moment
     only: when the person comes back to the tab, or after 10 minutes idle,
     or when the tab was in the background for 2 minutes. Never while a
     pop-up is open or something typed is not saved.
   - The browser remembers the mobile and password, so signing in is one
     click. A cleared account gets "Make your new password" at that sign-in.
   Loaded in <head> BEFORE app.js, so an old sign-in is ended before the app
   restores it. Same on phone.
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaDaily) return;
    var VERSION = '18.0.0-p122';
    var KEY = 'approverKey';
    var STAMP = 'iba-signin-day-v1';
    var NOTE = 'iba-daily-note-v1';
    var DAY_START_H = 4;              // 4 AM Doha
    var IDLE_MS = 10 * 60000, HIDDEN_MS = 2 * 60000;
    var TEST = '__IBA_TEST_PREVIEW__';

    function ls() { try { return window.localStorage; } catch (_) { return null; } }
    function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function set(k, v) { try { realSet.call(localStorage, k, v); } catch (_) {} }
    function del(k) { try { localStorage.removeItem(k); } catch (_) {} }
    // the working day: Doha time (UTC+3, no daylight saving) moved back by 4 hours
    function day(t) { var d = new Date((t || Date.now()) + (3 - DAY_START_H) * 3600000); return d.toISOString().slice(0, 10); }

    // every sign-in writes the day it happened
    var realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
        realSet.apply(this, arguments);
        try { if (this === ls() && k === KEY && v && v !== TEST) { realSet.call(this, STAMP, day()); var n = document.getElementById('iba-daily-note'); if (n) n.remove(); } } catch (_) {}
    };

    function stale() {
        var k = get(KEY);
        if (!k || k === TEST) return false;
        var s = get(STAMP);
        if (!s) { set(STAMP, day()); return false; } // signed in before this patch: counts as today
        return s !== day();
    }

    // 1. page opened on a new day: end the old sign-in before the app restores it
    if (stale()) {
        del(KEY);
        try { sessionStorage.setItem(NOTE, '1'); } catch (_) {}
    }

    // 2. still open after 4 AM: sign out at a safe moment
    var lastInput = Date.now(), hiddenSince = document.hidden ? Date.now() : 0;
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { lastInput = Date.now(); }, true); });
    function visible(el) { if (!el || !el.getClientRects().length) return false; var cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05; }
    function busy() {
        try { var s = window.ibaSilentUpdate && window.ibaSilentUpdate.state && window.ibaSilentUpdate.state(); if (s && s.busy) return true; } catch (_) {}
        var pops = document.querySelectorAll('.modal-container, .modal:not(.hidden), [role="dialog"]:not(#iba-system-update-notice), .swal2-container, [data-iba-pwd]');
        for (var i = 0; i < pops.length; i++) if (visible(pops[i])) return true;
        var a = document.activeElement;
        if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && String(a.value || a.textContent || '').trim()) return true;
        return false;
    }
    function signOut() {
        try { sessionStorage.setItem(NOTE, '1'); } catch (_) {}
        try { if (typeof handleLogout === 'function') { handleLogout(); return; } } catch (_) {}
        del(KEY);
        location.reload();
    }
    function check(back) {
        if (!stale() || busy()) return;
        var now = Date.now();
        if (back || (document.hidden && hiddenSince && now - hiddenSince > HIDDEN_MS) || now - lastInput > IDLE_MS) signOut();
    }
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) { hiddenSince = Date.now(); return; }
        hiddenSince = 0;
        check(true); // coming back to the tab (next morning): sign in again before starting work
    });
    setInterval(function () { check(false); }, 60000);

    // 3. a short note on the sign-in screen
    function note() {
        var n = null; try { n = sessionStorage.getItem(NOTE); } catch (_) {}
        if (!n || get(KEY)) return;
        try { sessionStorage.removeItem(NOTE); } catch (_) {}
        var d = document.createElement('div');
        d.id = 'iba-daily-note';
        d.setAttribute('role', 'status');
        d.textContent = 'Good morning! A new day started - please sign in again.';
        d.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483600;background:#0C0E11;color:#EBD8A8;border:1px solid rgba(227,201,138,.45);border-radius:12px;padding:10px 18px;font:600 14px/1.3 Inter,Segoe UI,Arial,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.45);max-width:calc(100vw - 32px);text-align:center';
        document.body.appendChild(d);
        setTimeout(function () { try { d.remove(); } catch (_) {} }, 9000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(note, 800); });
    else setTimeout(note, 800);

    window.ibaDaily = { VERSION: VERSION, day: day, stale: stale, check: check };
})();
