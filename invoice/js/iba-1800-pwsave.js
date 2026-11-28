/* 18.0.0 patch 164 (martin: the boss is fine with being signed out, but must not type the password every time):
   let the phone / PC browser SAVE the mobile number + password and fill them in next time.
   The app itself still stores no password. Two parts:
   1. The login boxes are marked as username / current-password (Chrome, Edge, Safari, Samsung read this).
   2. After a sign-in that really worked, Chrome / Edge / Android get the "Save password?" offer through
      navigator.credentials.store (the app's login never reloads the page, so the browser does not always offer it).
   Skipped for a temporary or cleared password (the person makes a new one right after). */
(function () {
    'use strict';
    if (window.ibaPwSave) return;
    var FORMS = [
        { form: 'login-form', user: 'login-identifier', pass: 'login-password-desktop' },
        { form: 'mobile-login-form', user: 'mobile-login-identifier', pass: 'mobile-login-password' }
    ];
    function $(id) { return document.getElementById(id); }
    function mark() {
        FORMS.forEach(function (f) {
            var fm = $(f.form), u = $(f.user), p = $(f.pass);
            if (fm) fm.removeAttribute('autocomplete');
            if (u) { u.setAttribute('autocomplete', 'username'); u.setAttribute('name', 'username'); u.setAttribute('autocapitalize', 'off'); u.setAttribute('spellcheck', 'false'); }
            if (p) { p.setAttribute('autocomplete', 'current-password'); p.setAttribute('name', 'password'); }
        });
        var p2 = $('login-password');
        if (p2) { p2.setAttribute('autocomplete', 'current-password'); p2.setAttribute('name', 'password'); }
    }
    function signedIn() {
        var k = ''; try { k = localStorage.getItem('approverKey') || ''; } catch (_) { k = ''; }
        if (!k || k === '__IBA_TEST_PREVIEW__') return null;
        var a = null; try { a = (typeof currentApprover !== 'undefined') ? currentApprover : null; } catch (_) { a = null; }
        return a;
    }
    var watch = 0;
    function offerSave(id, pw) {
        if (!id || !pw || !window.PasswordCredential || !navigator.credentials || typeof navigator.credentials.store !== 'function') return;
        clearInterval(watch);
        var tries = 0;
        watch = setInterval(function () {
            tries++;
            var a = signedIn();
            if (a) {
                clearInterval(watch);
                // only the person's own working password (not a temporary / cleared one)
                if (a.Password !== pw || a.PwdStatus === 'temp' || a.PwdStatus === 'cleared') return;
                try {
                    var c = new window.PasswordCredential({ id: id, password: pw, name: String(a.Name || id) });
                    navigator.credentials.store(c).catch(function () {});
                } catch (_) {}
                return;
            }
            if (tries > 40) clearInterval(watch); // 20 s: the sign-in did not work
        }, 500);
    }
    // window capture runs before the app's own submit handlers (they clear the password on a wrong one)
    window.addEventListener('submit', function (e) {
        var fm = e.target;
        if (!fm || !fm.id) return;
        var f = FORMS.filter(function (x) { return x.form === fm.id; })[0];
        if (!f) return;
        var u = $(f.user), p = $(f.pass);
        offerSave(u ? String(u.value || '').trim() : '', p ? String(p.value || '') : '');
    }, true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark); else mark();
    setTimeout(mark, 1500);
    window.ibaPwSave = { mark: mark };
})();
