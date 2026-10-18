/* ==========================================================================
   js/iba-session-lock.js  —  15.0.0 patch 25 : one computer session per user
   --------------------------------------------------------------------------
   IBA now opens in Google Chrome, Microsoft Edge and Safari. To keep the
   Firebase downloads low, one user can have IBA open on ONE computer /
   browser at a time:
   - after sign-in (computer layout only - the phone is not limited) this
     window writes a tiny marker on the user's record:
       approvers/{key}/DesktopSession = { id, browser, at }
   - it then watches only that marker (a few bytes, read only when it
     changes). When the same user opens IBA in another browser or on another
     computer, the older window stops all Firebase work at once and says
     where the account was opened. "Continue here" takes it back.
   - the first time someone uses a browser other than the one they used
     last, a short note explains that each browser keeps its own saved data
     (the first load there downloads more), so they should keep to one.
   The one-tab-per-browser guard (js/app-tab-guard.js) stays as it is.
   ========================================================================== */
(function () {
    'use strict';
    const VERSION = '15.0.0-p25';
    const ID_KEY = 'IBA_DESKTOP_SESSION_ID_V1';
    const SEEN_KEY = 'IBA_BROWSER_USED_V1';

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : (window.currentApprover || null); } catch (_) { return window.currentApprover || null; } }
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function onPhone() { const b = document.body; return !!(b && (b.classList.contains('iba-phone') || b.classList.contains('iba-mobile-ui'))); }
    function signedIn() { const b = document.body; return !!(b && b.classList.contains('iba-shell-on') && me() && me().key && !me().__testPreview); }
    function tabActive() { try { return !window.IBA_TAB_GUARD || window.IBA_TAB_GUARD.isActive(); } catch (_) { return true; } }

    function sessionId() {
        let id = lsGet(ID_KEY);
        if (!id) { id = 's' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); lsSet(ID_KEY, id); }
        return id;
    }
    function osName() {
        const ua = navigator.userAgent || '';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
        if (/Android/i.test(ua)) return 'Android';
        if (/Windows/i.test(ua)) return 'Windows';
        if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
        if (/Linux/i.test(ua)) return 'Linux';
        return '';
    }
    function browserLabel() {
        const b = (window.IBA_TAB_GUARD && window.IBA_TAB_GUARD.browserName) || 'a browser';
        const os = osName();
        return b + (os ? ' on ' + os : '');
    }
    function fmtTime(t) {
        try { return new Date(Number(t)).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

    let ref = null, myKey = '', stopped = false, claimed = false;

    function stopFirebase() {
        try { (firebase.apps || []).forEach((a) => { try { a.database().goOffline(); } catch (_) {} }); } catch (_) {}
    }
    function overlay(other) {
        let el = document.getElementById('iba-session-lock');
        if (!el) {
            el = document.createElement('div');
            el.id = 'iba-session-lock';
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', 'true');
            el.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:22px;box-sizing:border-box;background:radial-gradient(circle at top,rgba(17,96,69,.24),rgba(2,6,23,.78));backdrop-filter:blur(7px);font-family:Inter,Arial,sans-serif;';
            document.body.appendChild(el);
        }
        el.innerHTML = '<div style="width:min(520px,94vw);border-radius:24px;padding:28px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 28px 70px rgba(15,23,42,.3);text-align:center;color:#0f172a;">' +
            '<div style="font-size:2.3rem;margin-bottom:6px;">🔒</div>' +
            '<h2 style="margin:0 0 10px;font-size:1.4rem;color:#0f5132;">IBA was opened somewhere else</h2>' +
            '<p style="margin:0;line-height:1.5;color:#334155;">Your account was opened in <b>' + esc(other.browser || 'another browser') + '</b>' + (other.at ? ' at ' + esc(fmtTime(other.at)) : '') + '. ' +
            'To keep the data downloads low, IBA runs on one computer or browser at a time, so this window has stopped.</p>' +
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px;">' +
            '<button type="button" data-lock="here" style="border:0;border-radius:999px;padding:11px 18px;font-weight:900;cursor:pointer;background:#116045;color:#fff;">Continue here</button>' +
            '<button type="button" data-lock="out" style="border:0;border-radius:999px;padding:11px 18px;font-weight:900;cursor:pointer;background:#e2e8f0;color:#0f172a;">Log out</button></div>' +
            '<p style="margin:16px 0 0;font-size:.8rem;color:#64748b;font-weight:700;">"Continue here" moves IBA back to this window and stops the other one. The phone is not affected.</p></div>';
        el.onclick = (e) => {
            const b = e.target.closest('[data-lock]');
            if (!b) return;
            if (b.dataset.lock === 'here') location.reload();
            else { try { localStorage.removeItem('approverKey'); } catch (_) {} location.reload(); }
        };
    }
    function kicked(other) {
        if (stopped) return;
        stopped = true;
        try { if (ref) ref.off(); } catch (_) {}
        stopFirebase();
        overlay(other || {});
        try { window.dispatchEvent(new CustomEvent('iba:session-moved', { detail: other || {} })); } catch (_) {}
    }
    function browserNote(prev) {
        const firstTimeHere = !lsGet(SEEN_KEY);
        lsSet(SEEN_KEY, String(Date.now()));
        if (!firstTimeHere || !prev || !prev.browser || prev.browser === browserLabel()) return;
        const text = 'You last used IBA in ' + prev.browser + '. Each browser keeps its own saved data, so the first load here takes longer and uses more data. Please keep using one browser.';
        try { if (typeof window.ibaToast === 'function') { window.ibaToast(text); return; } } catch (_) {}
        try {
            const n = document.createElement('div');
            n.setAttribute('role', 'status');
            n.textContent = text;
            n.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:13000;max-width:min(92vw,560px);padding:12px 18px;border-radius:12px;font:600 14px/1.4 Arial,sans-serif;color:#fff;background:#14532d;box-shadow:0 10px 30px rgba(0,0,0,.25);';
            document.body.appendChild(n);
            setTimeout(() => n.remove(), 12000);
        } catch (_) {}
    }

    async function claim() {
        const d = mainDb(), a = me();
        if (!d || !a || !a.key) return;
        myKey = a.key;
        const id = sessionId();
        ref = d.ref('approvers/' + a.key + '/DesktopSession');
        let prev = null;
        try { prev = (await ref.once('value')).val(); } catch (_) {}
        browserNote(prev);
        try {
            await ref.set({ id: id, browser: browserLabel(), at: firebase.database.ServerValue.TIMESTAMP, v: VERSION });
        } catch (e) {
            console.warn('[IBA session] could not save the session marker (rules?) - the one-session rule is off for now.', e);
            ref = null;
            return;
        }
        claimed = true;
        ref.on('value', (snap) => {
            const v = snap && snap.val();
            if (v && v.id && v.id !== id) kicked(v);
        });
    }
    function release() {
        try { if (ref) ref.off(); } catch (_) {}
        ref = null; claimed = false; myKey = '';
    }

    function tick() {
        if (stopped) return;
        const ok = signedIn() && !onPhone() && tabActive();
        if (ok && !claimed && !ref) { claim(); return; }
        if (claimed && (!signedIn() || (me() && me().key !== myKey))) release();
    }
    function boot() { tick(); setInterval(tick, 2000); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();

    window.ibaSessionLock = { VERSION: VERSION, id: sessionId, label: browserLabel, _state: () => ({ claimed, stopped, myKey }) };
})();
