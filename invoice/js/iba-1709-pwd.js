/* 18.0.0 patch 109: password control (Super Admin)
 *
 * 0. CLEAR (main way, martin): Super Admin presses Clear password while the
 *    person asked (WhatsApp). That person signs in with just their mobile
 *    (any or empty password) and makes a new password. The old password stops
 *    working at once. p111: no time limit, it stays cleared until they do.
 * 1. Reset: Super Admin (Settings > Passwords) gives a person a TEMPORARY
 *    password. Saved on the approver record as Password + PwdStatus 'temp',
 *    PwdSetBy '<super admin>'.
 * 2. The person signs in with mobile + temporary password -> full screen
 *    "Make your own password" before anything opens. Saved as PwdStatus
 *    'user', PwdSetBy '<their name>'. The temporary one cannot be reused.
 * 3. Forgot password (login screens): the person types their mobile, the
 *    request is saved in iba_pwd_requests and WhatsApp opens with a ready
 *    message to the Super Admin.
 * 4. Own password changes (Settings / first-time setup) are marked
 *    'set by user' too. Every change is kept in approvers/<key>/PwdHistory.
 *
 * Database rules are NOT changed by this patch (still read/write true).
 * All screens are drawn inside shadow roots so the app's CSS cannot touch them.
 */
(function () {
    'use strict';
    if (window.ibaPwd) return;
    const VERSION = '18.0.0-p114';
    const SUPER = () => (typeof SUPER_ADMIN_NAME === 'string' && SUPER_ADMIN_NAME) || 'Irwin';
    const REQ = 'iba_pwd_requests';
    const CLEAR_MIN = 30;

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dbx = () => (typeof db !== 'undefined' && db) ? db : null;
    const me = () => { try { return (typeof currentApprover !== 'undefined') ? currentApprover : null; } catch (_) { return null; } };
    const setMe = (v) => { try { currentApprover = v; } catch (_) {} };
    const isSuper = () => { const u = me(); return !!(u && String(u.Name || '').trim().toLowerCase() === SUPER().toLowerCase()); };
    const digits = (m) => String(m || '').replace(/\D/g, '');
    const waNum = (m) => { const d = digits(m); return d.length === 8 ? '974' + d : d; };
    const showMobile = (m) => { const d = waNum(m); return d.startsWith('974') && d.length === 11 ? '+974 ' + d.slice(3) : (m || ''); };
    // a short fingerprint of the temporary password: only used to know whether
    // the password on the record is still the temporary one (not for security)
    function tag(s) {
        let h = 2166136261;
        s = 'iba-tmp|' + String(s || '');
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(36);
    }
    // p111: no time limit (martin): a cleared account stays open until the person makes a new password
    // p112: password rule (martin): 6+ characters, at least one letter AND one number,
    // not an easy one, not the person's mobile or name. '' = OK, else the message to show.
    const EASY = ['abc123','abcd1234','a12345','pass123','password1','password123','qwerty1','qwerty123','iba123','iba2026','admin123','test123','123abc','1q2w3e','1q2w3e4r','aa1234','abc12345'];
    function pwProblem(pw, u) {
        pw = String(pw || '');
        if (pw.length < 6) return 'Use at least 6 characters.';
        if (!/[a-z]/i.test(pw) || !/[0-9]/.test(pw)) return 'Use letters and numbers together, in any order (for example: bara26, 26bara, ba26ra).';
        const low = pw.toLowerCase();
        if (EASY.indexOf(low) >= 0) return 'This password is too easy. Make another one.';
        const d = pw.replace(/\D/g, ''), mob = String((u && u.Mobile) || '').replace(/\D/g, '');
        if (d.length >= 6 && mob && mob.indexOf(d) >= 0) return 'Do not use your mobile number.';
        const nm = String((u && u.Name) || '').toLowerCase().replace(/[^a-z]/g, '');
        if (nm.length >= 3 && low.replace(/[^a-z]/g, '') === nm && d.length < 2) return 'Too close to your name. Add more numbers or letters.';
        return '';
    }
    const clearedOpen = (u) => !!(u && u.PwdStatus === 'cleared');
    const lockPw = () => { let r = 'locked-'; const a = new Uint32Array(4); try { crypto.getRandomValues(a); } catch (_) { for (let i = 0; i < 4; i++) a[i] = Math.random() * 4e9; } a.forEach((x) => { r += x.toString(36); }); return r; };
    const isTemp = (u) => !!(u && u.PwdStatus === 'temp' && u.Password && u.PwdTempKey && tag(u.Password) === u.PwdTempKey);
    function when(t) {
        if (!t) return '';
        const d = new Date(t);
        if (isNaN(d)) return '';
        const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        return String(d.getDate()).padStart(2, '0') + '-' + M[d.getMonth()] + '-' + d.getFullYear() + ' ' + h + ':' + String(d.getMinutes()).padStart(2, '0') + ap;
    }
    function makeTemp() {
        const A = 'ABCDEFGHJKMNPQRSTUVWXYZ', N = '23456789';
        const r = (s) => s[Math.floor(Math.random() * s.length)];
        return r(A) + r(A) + r(A) + r(N) + r(N) + r(N) + r(N); // e.g. KRT4827
    }
    async function history(key, a, by) {
        try { await dbx().ref('approvers/' + key + '/PwdHistory').push({ a, by: by || '', at: Date.now() }); } catch (_) {}
    }

    // ------------------------------------------------------------------
    // shared glass box (shadow root)
    // ------------------------------------------------------------------
    const CSS = `
:host{all:initial}
*{box-sizing:border-box;font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif}
.dim{position:fixed;inset:0;z-index:2147483000;background:rgba(5,12,20,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.dim.solid{background:radial-gradient(circle at 30% 20%,#173247 0,#0b1724 55%,#060d15 100%)}
.box{width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#101e2b;border:1px solid rgba(227,201,138,.35);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.45);color:#F3F6F9;padding:22px 22px 18px}
.box.wide{width:min(1000px,100%)}
h2{margin:0 0 4px;font-size:20px;font-weight:700;color:#fff}
.sub{margin:0 0 16px;font-size:13.5px;line-height:1.45;color:#E3C98A}
label{display:block;font-size:12.5px;font-weight:600;color:#cfd8e1;margin:10px 0 5px}
input{width:100%;height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font-size:15px;padding:0 12px;outline:none}
input:focus{border-color:#E3C98A;box-shadow:0 0 0 3px rgba(227,201,138,.18)}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
button,a.btn{height:42px;padding:0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none}
button.main{background:#E3C98A;border-color:#E3C98A;color:#14202b}
a.btn.wa,button.wa{background:#1fa855;border-color:#1fa855;color:#fff}
button.sm{height:32px;padding:0 12px;font-size:12.5px}
button:disabled{opacity:.5;cursor:default}
.grow{flex:1}
.err{min-height:18px;margin:10px 0 0;font-size:13px;color:#ff9b9b}
.ok{margin:10px 0 0;font-size:13.5px;color:#9be3b4;line-height:1.45}
.note{font-size:12px;color:#aab7c4;margin-top:6px;line-height:1.4}
.tmp{font:700 26px/1.2 Consolas,"Courier New",monospace;letter-spacing:3px;color:#E3C98A;background:rgba(0,0,0,.25);border:1px dashed rgba(227,201,138,.5);border-radius:10px;padding:10px 14px;text-align:center;margin:8px 0}
.head{display:flex;align-items:flex-start;gap:12px}
.x{margin-left:auto;height:34px;width:34px;padding:0;font-size:18px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#E3C98A;padding:8px;border-bottom:1px solid rgba(227,201,138,.3);position:sticky;top:0;background:#12222f}
td{padding:8px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:middle}
tr:hover td{background:rgba(255,255,255,.04)}
.st{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;white-space:nowrap}
.st.user{background:rgba(31,168,85,.18);color:#9be3b4}
.st.temp{background:rgba(255,170,60,.18);color:#ffcf8a}
.st.none{background:rgba(255,255,255,.1);color:#cfd8e1}
.st.old{background:rgba(120,160,255,.14);color:#b9cdff}
.by{display:block;font-size:11.5px;color:#aab7c4;margin-top:3px}
.reqs{border:1px solid rgba(255,170,60,.45);background:rgba(255,170,60,.08);border-radius:12px;padding:10px 12px;margin:6px 0 12px}
.reqs h3{margin:0 0 6px;font-size:14px;color:#ffcf8a}
.req{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 0;border-top:1px solid rgba(255,255,255,.08)}
.req:first-of-type{border-top:0}
.tools{display:flex;gap:10px;align-items:center;margin-top:6px}
.tools input{height:38px;max-width:320px}
.scroll{max-height:min(60vh,560px);overflow:auto;border-radius:10px}
.hist{font-size:12px;color:#cfd8e1;padding:4px 0 2px}
.hist div{padding:2px 0}
.lnk{background:none;border:0;height:auto;padding:0;color:#fff;font-weight:600;text-decoration:underline dotted rgba(255,255,255,.4);cursor:pointer;font-size:13px}
@media (max-width:640px){.hide-s{display:none}.box{padding:18px 14px}.dim{padding:8px;align-items:flex-start}.box.wide{max-height:calc(100vh - 16px)}
 thead{display:none} table,tbody,tr,td{display:block;width:100%} tr{border-bottom:1px solid rgba(255,255,255,.12);padding:6px 0} td{border:0;padding:3px 4px}
 td.acts{text-align:left!important} .tools input{max-width:none} .req button.sm{flex:1} .scroll{max-height:none}}
`;
    function mount(html, opts) {
        opts = opts || {};
        const host = document.createElement('div');
        host.setAttribute('data-iba-pwd', opts.name || '');
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = '<style>' + CSS + '</style><div class="dim' + (opts.solid ? ' solid' : '') + '"><div class="box' + (opts.wide ? ' wide' : '') + '">' + html + '</div></div>';
        document.body.appendChild(host);
        const close = () => { try { host.remove(); } catch (_) {} document.removeEventListener('keydown', onKey, true); };
        function onKey(e) { if (e.key === 'Escape' && !opts.locked) { e.stopPropagation(); close(); } }
        document.addEventListener('keydown', onKey, true);
        if (!opts.locked) root.querySelector('.dim').addEventListener('mousedown', (e) => { if (e.target.classList.contains('dim')) close(); });
        return { host, root, close, q: (s) => root.querySelector(s) };
    }

    // ------------------------------------------------------------------
    // 2. forced "Make your own password"
    // ------------------------------------------------------------------
    function forceNewPassword(u, done, mode) {
        if (document.querySelector('[data-iba-pwd="force"]')) return;
        const by = u.PwdSetBy || SUPER();
        const cleared = mode === 'cleared';
        const w = mount(
            '<h2>Make your own password</h2>' +
            '<p class="sub">Hi ' + esc(u.Name || '') + (cleared ? ', your password was cleared by ' + esc(by) + '. Make your new password to sign in.' : ', you signed in with a temporary password from ' + esc(by) + '. Make your own password to continue.') + '</p>' +
            '<form autocomplete="off">' +
            '<label>New password</label><input type="password" data-n1 autocomplete="new-password" minlength="6">' +
            '<label>Type it again</label><input type="password" data-n2 autocomplete="new-password">' +
            '<p class="note">At least 6 characters, with letters and numbers in any order. Examples: bara26, 26bara, ba26ra, Bara2026. Only you will know it.</p>' +
            '<p class="err" data-err></p>' +
            '<div class="row"><button type="button" data-out>' + (cleared ? 'Cancel' : 'Sign out') + '</button><span class="grow"></span><button type="submit" class="main" data-save>Save and continue</button></div>' +
            '</form>', { name: 'force', solid: true, locked: true });
        setTimeout(() => { try { w.q('[data-n1]').focus(); } catch (_) {} }, 50);
        w.q('[data-out]').addEventListener('click', () => {
            if (cleared) { w.close(); setMe(null); return; }
            try { localStorage.removeItem('approverKey'); } catch (_) {}
            location.reload();
        });
        w.q('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const a = w.q('[data-n1]').value, b = w.q('[data-n2]').value, err = w.q('[data-err]');
            err.textContent = '';
            { const pr = pwProblem(a, u); if (pr) { err.textContent = pr; return; } }
            if (a !== b) { err.textContent = 'The two passwords are not the same.'; return; }
            if (!cleared && a === u.Password) { err.textContent = 'This is the temporary password. Make a new one.'; return; }
            const btn = w.q('[data-save]'); btn.disabled = true; btn.textContent = 'Saving…';
            const now = Date.now();
            const upd = { Password: a, PwdStatus: 'user', PwdSetBy: u.Name || '', PwdSetAt: now, PwdTempKey: null, PwdClearedAt: null };
            try {
                if (cleared) {
                    // still cleared and not expired? (read fresh)
                    const fresh = (await dbx().ref('approvers/' + u.key).once('value')).val() || {};
                    if (!clearedOpen(fresh)) { btn.disabled = false; btn.textContent = 'Save and continue'; err.textContent = 'Time is up. Ask ' + SUPER() + ' to clear your password again.'; return; }
                }
                await dbx().ref('approvers/' + u.key).update(upd);
                await history(u.key, cleared ? 'Own password made (after clear)' : 'Own password made (after temporary)', u.Name || '');
            } catch (ex) {
                btn.disabled = false; btn.textContent = 'Save and continue';
                err.textContent = 'Could not save. Check the connection and try again.';
                return;
            }
            const nu = Object.assign({}, u, upd); delete nu.PwdTempKey; delete nu.PwdClearedAt;
            setMe(nu);
            w.close();
            done();
        });
    }

    function hookLogin() {
        const orig = window.handleSuccessfulLogin;
        if (typeof orig !== 'function' || orig.__ibaPwd) return;
        const wrapped = function () {
            const u = me();
            if (u && u.key && isTemp(u)) {
                const self = this, args = arguments;
                // keep the opening sound/animation for after the new password
                const play = window.__ibaPlayLoginOpening;
                window.__ibaPlayLoginOpening = false;
                try { if (typeof showView === 'function') showView('login'); } catch (_) {}
                forceNewPassword(u, () => { window.__ibaPlayLoginOpening = play; orig.apply(self, args); });
                return;
            }
            return orig.apply(this, arguments);
        };
        wrapped.__ibaPwd = true;
        window.handleSuccessfulLogin = wrapped;
    }
    // a CLEARED account: sign-in with the mobile only -> make a new password
    document.addEventListener('submit', (e) => {
        const f = e.target;
        if (!f || (f.id !== 'login-form' && f.id !== 'mobile-login-form')) return;
        if (f.__ibaPwdPass) { f.__ibaPwdPass = false; return; } // second round: the app's own sign-in
        e.preventDefault(); e.stopImmediatePropagation();
        const mobileForm = f.id === 'mobile-login-form';
        const id = (($(mobileForm ? 'mobile-login-identifier' : 'login-identifier') || {}).value || '').trim();
        const pass = () => { f.__ibaPwdPass = true; try { f.requestSubmit(); } catch (_) { f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); } };
        if (!id || typeof findApprover !== 'function') { pass(); return; }
        findApprover(id).then((u) => {
            if (!u || u.PwdStatus !== 'cleared') { pass(); return; }
            const errEl = $(mobileForm ? 'mobile-login-error' : 'login-error');
            if (!clearedOpen(u)) { if (errEl) errEl.textContent = 'Your password was cleared but the time is up. Ask ' + SUPER() + ' to clear it again.'; return; }
            if (errEl) errEl.textContent = '';
            startCleared(u);
        }).catch(pass);
    }, true);
    // open "Make your new password" for a cleared account, then sign in
    function startCleared(u) {
        forceNewPassword(u, () => {
            const nu = me();
            const mobileView = !!document.querySelector('.mobile-login-container') && getComputedStyle(document.querySelector('.mobile-login-container')).display !== 'none';
            if (mobileView) { const c = document.querySelector('.mobile-login-container'); if (c) c.style.display = 'none'; }
            const sound = $('login-sound'); if (sound) sound.play().catch(() => {});
            window.__ibaPlayLoginOpening = true;
            if (nu) window.handleSuccessfulLogin();
        }, 'cleared');
        setMe(u);
    }
    // p110: after a Forgot password request, watch ONLY this account for as long as this
    // sign-in page stays open (even if the Super Admin answers late); the moment Clear is
    // pressed, "Make your new password" opens by itself
    let watchOff = null;
    function watchClear(key) {
        if (!key || !dbx()) return;
        if (watchOff) watchOff();
        const ref = dbx().ref('approvers/' + key);
        const since = Date.now();
        let done = false;
        const cb = (snap) => {
            if (done) return;
            const v = snap && snap.val ? snap.val() : null;
            const signedIn = (() => { const m = me(); return !!(m && m.key && localStorage.getItem('approverKey')); })();
            if (signedIn) { stop(); return; }
            if (v && v.PwdStatus === 'cleared' && v.PwdClearedAt >= since - 60000 && clearedOpen(v)) {
                done = true; stop();
                document.querySelectorAll('[data-iba-pwd="forgot"]').forEach((h) => h.remove());
                startCleared(Object.assign({ key }, v));
            }
        };
        function stop() { try { ref.off('value', cb); } catch (_) {} watchOff = null; }
        try { ref.on('value', cb); } catch (_) {}
        watchOff = stop;
    }
    // the phone sign-in box must allow an empty password (cleared accounts)
    function relaxPw() { const p = $('mobile-login-password'); if (p) p.removeAttribute('required'); }
    document.addEventListener('DOMContentLoaded', relaxPw); setTimeout(relaxPw, 500);

    // be the OUTERMOST wrapper (other files wrap the login too)
    hookLogin();
    document.addEventListener('DOMContentLoaded', hookLogin);
    window.addEventListener('load', () => { hookLogin(); setTimeout(hookLogin, 300); });

    // ------------------------------------------------------------------
    // 4. own password changes = set by user
    // ------------------------------------------------------------------
    function markOwn(how) {
        const u = me();
        if (!u || !u.key) return;
        const now = Date.now();
        try {
            dbx().ref('approvers/' + u.key).update({ PwdStatus: 'user', PwdSetBy: u.Name || '', PwdSetAt: now, PwdTempKey: null });
            history(u.key, how, u.Name || '');
        } catch (_) {}
    }
    document.addEventListener('submit', (e) => {
        const f = e.target;
        if (!f || !f.id) return;
        if (f.id === 'settings-form') {
            const p = $('settings-password');
            if (p && p.value) {
                const pr = pwProblem(p.value, me());
                if (pr) { e.preventDefault(); e.stopImmediatePropagation(); const m = $('settings-message'); if (m) { m.textContent = 'Password: ' + pr; m.style.color = '#ff8a80'; } try { p.focus(); } catch (_) {} return; }
                markOwn('Own password changed in Settings');
            }
        } else if (f.id === 'setup-form') {
            const p = $('setup-password');
            if (p && p.value) {
                const pr = pwProblem(p.value, me());
                if (pr) { e.preventDefault(); e.stopImmediatePropagation(); const m = $('setup-error'); if (m) m.textContent = pr; try { p.focus(); } catch (_) {} return; }
                markOwn('Own password made (first sign-in)');
            }
        }
    }, true);

    // ------------------------------------------------------------------
    // 3. Forgot password
    // ------------------------------------------------------------------
    let superCache = null;
    async function superApprover() {
        if (superCache) return superCache;
        try {
            const s = await dbx().ref('approvers').orderByChild('Name').equalTo(SUPER()).once('value');
            const v = s.val() || {};
            const k = Object.keys(v).find((x) => String(v[x].Name || '').trim().toLowerCase() === SUPER().toLowerCase());
            if (k) superCache = Object.assign({ key: k }, v[k]);
        } catch (_) {}
        return superCache;
    }
    function openForgot(prefill) {
        const w = mount(
            '<div class="head"><div><h2>Forgot password</h2>' +
            '<p class="sub">Type your IBA mobile number. ' + esc(SUPER()) + ' will get your request on WhatsApp and clear your password.</p></div>' +
            '<button class="x" data-x type="button" title="Close">×</button></div>' +
            '<div data-step1><label>Mobile number</label><input data-mob inputmode="tel" autocomplete="off" placeholder="e.g. 50992000" value="' + esc(prefill || '') + '">' +
            '<p class="err" data-err></p>' +
            '<div class="row"><span class="grow"></span><button class="main" data-send type="button">Send request</button></div></div>' +
            '<div data-step2 hidden></div>', { name: 'forgot' });
        w.q('[data-x]').addEventListener('click', w.close);
        setTimeout(() => { try { w.q('[data-mob]').focus(); } catch (_) {} }, 50);
        w.q('[data-mob]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); w.q('[data-send]').click(); } });
        w.q('[data-send]').addEventListener('click', async () => {
            const err = w.q('[data-err]'), btn = w.q('[data-send]');
            const mob = w.q('[data-mob]').value.trim();
            err.textContent = '';
            if (digits(mob).length < 8) { err.textContent = 'Type your full mobile number.'; return; }
            btn.disabled = true; btn.textContent = 'Checking…';
            let u = null;
            try { u = (typeof findApprover === 'function') ? await findApprover(mob) : null; } catch (_) {}
            if (!u) { btn.disabled = false; btn.textContent = 'Send request'; err.textContent = 'This number is not registered in the system.'; return; }
            const now = Date.now();
            try {
                await dbx().ref(REQ).push({ key: u.key || '', name: u.Name || '', mobile: u.Mobile || mob, at: now, status: 'open' });
                if (u.key) await history(u.key, 'Forgot password request', u.Name || '');
            } catch (_) {}
            const sa = await superApprover();
            const txt = 'IBA System - password reset request\nName: ' + (u.Name || '') + '\nMobile: ' + showMobile(u.Mobile || mob) +
                '\nPlease clear my password.' + '\nOpen: ' + location.origin + location.pathname + '?pwd=1';
            const s2 = w.q('[data-step2]');
            w.q('[data-step1]').hidden = true;
            s2.hidden = false;
            watchClear(u.key);
            s2.innerHTML = '<p class="ok">Request saved. Press the green button to send it on WhatsApp.</p>' +
                (sa && sa.Mobile ? '<div class="row"><a class="btn wa grow" target="_blank" rel="noopener" data-wa href="https://wa.me/' + waNum(sa.Mobile) + '?text=' + encodeURIComponent(txt) + '">Send on WhatsApp</a></div>'
                    : '<p class="note">WhatsApp number not found. Please call ' + esc(SUPER()) + '. Your request is saved.</p>') +
                '<p class="note">Keep this page open: when ' + esc(SUPER()) + ' clears your password, "Make your new password" opens here by itself. If you closed it: after ' + esc(SUPER()) + ' clears it, sign in with your mobile and leave the password empty.</p>' +
                '<div class="row"><span class="grow"></span><button data-x2 type="button">Close</button></div>';
            s2.querySelector('[data-x2]').addEventListener('click', w.close);
        });
    }
    function addForgotLinks() {
        [['login-form', 'login-identifier'], ['mobile-login-form', 'mobile-login-identifier']].forEach(([fid, iid]) => {
            const f = $(fid);
            if (!f || f.parentElement.querySelector('[data-iba-forgot="' + fid + '"]')) return;
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = 'Forgot password?';
            a.setAttribute('data-iba-forgot', fid);
            a.style.cssText = 'display:block;margin:12px auto 0;text-align:center;font-size:13.5px;font-weight:600;color:#E3C98A;text-decoration:underline;cursor:pointer;width:max-content;max-width:100%;';
            a.addEventListener('click', (e) => { e.preventDefault(); openForgot(($(iid) || {}).value || ''); });
            f.insertAdjacentElement('afterend', a);
        });
    }
    document.addEventListener('DOMContentLoaded', addForgotLinks);
    setTimeout(addForgotLinks, 500);
    setTimeout(addForgotLinks, 2000);

    // ------------------------------------------------------------------
    // 1. Super Admin: Passwords window
    // ------------------------------------------------------------------
    function statusHtml(p) {
        if (!p.Password) return '<span class="st none">Not set</span><span class="by">makes own at first sign-in</span>';
        if (p.PwdStatus === 'cleared') return clearedOpen(p)
            ? '<span class="st temp">Cleared · waiting for new password</span><span class="by">by ' + esc(p.PwdSetBy || SUPER()) + (p.PwdClearedAt ? ' · ' + esc(when(p.PwdClearedAt)) : '') + '</span>'
            : '<span class="st none">Cleared · time is up</span><span class="by">press Clear again</span>';
        if (isTemp(p)) return '<span class="st temp">Temporary · not changed yet</span><span class="by">set by ' + esc(p.PwdSetBy || SUPER()) + (p.PwdSetAt ? ' · ' + when(p.PwdSetAt) : '') + '</span>';
        if (p.PwdStatus === 'user' || p.PwdStatus === 'temp') return '<span class="st user">Own password</span><span class="by">set by ' + esc(p.PwdSetBy || p.Name || 'user') + (p.PwdSetAt ? ' · ' + when(p.PwdSetAt) : '') + '</span>';
        return '<span class="st old">Own password</span><span class="by">from before (no record)</span>';
    }
    async function loadPeople() {
        const s = await dbx().ref('approvers').once('value');
        const v = s.val() || {};
        return Object.keys(v).map((k) => Object.assign({ key: k }, v[k])).filter((p) => p && (p.Name || p.Mobile))
            .sort((a, b) => String(a.Name || '').localeCompare(String(b.Name || '')));
    }
    async function loadReqs() {
        try {
            const s = await dbx().ref(REQ).once('value');
            const v = s.val() || {};
            return Object.keys(v).map((k) => Object.assign({ id: k }, v[k])).filter((r) => r.status === 'open').sort((a, b) => (b.at || 0) - (a.at || 0));
        } catch (_) { return []; }
    }
    async function openAdmin() {
        if (!isSuper()) return;
        const w = mount(
            '<div class="head"><div><h2>Passwords</h2><p class="sub">Clear: the person signs in with the mobile only and makes a new password (stays cleared until they do). Temporary: they sign in with the password you send, then make their own.</p></div>' +
            '<button class="x" data-x type="button" title="Close">×</button></div>' +
            '<div data-reqs></div>' +
            '<div class="tools"><input data-q placeholder="Search name, mobile, position…" autocomplete="off"><span class="note" data-count></span></div>' +
            '<div class="scroll"><table><thead><tr><th>Name</th><th>Mobile</th><th class="hide-s">Position</th><th>Password</th><th></th></tr></thead><tbody data-rows><tr><td colspan="5">Loading…</td></tr></tbody></table></div>',
            { name: 'admin', wide: true });
        w.q('[data-x]').addEventListener('click', w.close);
        let people = [], reqs = [];
        const open = new Set();
        function paintReqs() {
            const box = w.q('[data-reqs]');
            if (!reqs.length) { box.innerHTML = ''; return; }
            box.innerHTML = '<div class="reqs"><h3>Forgot password requests (' + reqs.length + ')</h3>' + reqs.map((r) =>
                '<div class="req"><b>' + esc(r.name) + '</b><span>' + esc(showMobile(r.mobile)) + '</span><span class="note" style="margin:0">' + esc(when(r.at)) + '</span><span class="grow"></span>' +
                '<button class="sm main" type="button" data-rq-clear="' + esc(r.id) + '">Clear</button>' +
                '<button class="sm" type="button" data-rq-reset="' + esc(r.id) + '">Temporary</button>' +
                '<button class="sm" type="button" data-rq-done="' + esc(r.id) + '">Dismiss</button></div>').join('') + '</div>';
        }
        function paintRows() {
            const q = w.q('[data-q]').value.trim().toLowerCase();
            const list = people.filter((p) => !q || [p.Name, p.Mobile, p.Position, p.Site].join(' ').toLowerCase().includes(q));
            w.q('[data-count]').textContent = list.length + ' of ' + people.length;
            w.q('[data-rows]').innerHTML = list.map((p) => {
                const h = p.PwdHistory ? Object.keys(p.PwdHistory).map((k) => p.PwdHistory[k]).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 6) : [];
                return '<tr><td><button class="lnk" type="button" data-hist="' + esc(p.key) + '" title="Show history">' + esc(p.Name || '—') + '</button></td>' +
                    '<td>' + esc(showMobile(p.Mobile)) + '</td><td class="hide-s">' + esc(p.Position || '') + '</td><td>' + statusHtml(p) + '</td>' +
                    '<td class="acts" style="text-align:right;white-space:nowrap"><button class="sm main" type="button" data-clear="' + esc(p.key) + '">Clear</button> <button class="sm" type="button" data-reset="' + esc(p.key) + '">Temporary</button></td></tr>' +
                    (open.has(p.key) ? '<tr><td colspan="5"><div class="hist">' + (h.length ? h.map((x) => '<div>' + esc(when(x.at)) + ' · ' + esc(x.a) + (x.by ? ' · by ' + esc(x.by) : '') + '</div>').join('') : '<div>No history yet.</div>') + '</div></td></tr>' : '');
            }).join('') || '<tr><td colspan="5">Nobody found.</td></tr>';
        }
        async function refresh() {
            try { [people, reqs] = await Promise.all([loadPeople(), loadReqs()]); }
            catch (_) { w.q('[data-rows]').innerHTML = '<tr><td colspan="5">Could not load. Check the connection.</td></tr>'; return; }
            paintReqs(); paintRows();
            reqCount = reqs.length; paintTile();
        }
        w.q('[data-q]').addEventListener('input', paintRows);
        w.root.addEventListener('click', async (e) => {
            const t = e.target.closest('button');
            if (!t) return;
            if (t.hasAttribute('data-hist')) { const k = t.getAttribute('data-hist'); open.has(k) ? open.delete(k) : open.add(k); paintRows(); return; }
            if (t.hasAttribute('data-reset')) { const p = people.find((x) => x.key === t.getAttribute('data-reset')); if (p) resetFor(p, null, refresh); return; }
            if (t.hasAttribute('data-clear')) { const p = people.find((x) => x.key === t.getAttribute('data-clear')); if (p) clearFor(p, null, refresh); return; }
            if (t.hasAttribute('data-rq-clear')) {
                const r = reqs.find((x) => x.id === t.getAttribute('data-rq-clear'));
                const p = r && (people.find((x) => x.key === r.key) || people.find((x) => waNum(x.Mobile) === waNum(r.mobile)));
                if (p) clearFor(p, r.id, refresh);
                return;
            }
            if (t.hasAttribute('data-rq-reset')) {
                const r = reqs.find((x) => x.id === t.getAttribute('data-rq-reset'));
                const p = r && (people.find((x) => x.key === r.key) || people.find((x) => waNum(x.Mobile) === waNum(r.mobile)));
                if (p) resetFor(p, r.id, refresh);
                return;
            }
            if (t.hasAttribute('data-rq-done')) {
                t.disabled = true;
                try { await dbx().ref(REQ + '/' + t.getAttribute('data-rq-done')).update({ status: 'dismissed', doneAt: Date.now(), doneBy: (me() || {}).Name || '' }); } catch (_) {}
                refresh();
            }
        });
        refresh();
    }
    function clearFor(p, reqId, after) {
        const w = mount(
            '<div class="head"><div><h2>Clear password</h2><p class="sub">' + esc(p.Name || '') + ' · ' + esc(showMobile(p.Mobile)) + '</p></div>' +
            '<button class="x" data-x type="button" title="Close">×</button></div>' +
            '<div data-s1><p class="note" style="font-size:13.5px;color:#cfd8e1">Their old password stops working now. Tell them: type your mobile, leave the password empty, press Sign in, then make your new password. It stays cleared until they do.</p>' +
            '<p class="err" data-err></p>' +
            '<div class="row"><button type="button" data-x2>Cancel</button><span class="grow"></span><button class="main" type="button" data-save>Clear password</button></div></div>' +
            '<div data-s2 hidden></div>', { name: 'clear' });
        w.q('[data-x]').addEventListener('click', w.close);
        w.q('[data-x2]').addEventListener('click', w.close);
        w.q('[data-save]').addEventListener('click', async () => {
            const err = w.q('[data-err]'), btn = w.q('[data-save]');
            btn.disabled = true; btn.textContent = 'Clearing…';
            const by = (me() || {}).Name || SUPER();
            const now = Date.now();
            try {
                await dbx().ref('approvers/' + p.key).update({ Password: lockPw(), PwdStatus: 'cleared', PwdSetBy: by, PwdSetAt: now, PwdClearedAt: now, PwdTempKey: null });
                await history(p.key, 'Password cleared', by);
                if (reqId) await dbx().ref(REQ + '/' + reqId).update({ status: 'done', doneAt: now, doneBy: by });
            } catch (_) {
                btn.disabled = false; btn.textContent = 'Clear password';
                err.textContent = 'Could not save. Check the connection and try again.';
                return;
            }
            const msg = 'Hi ' + (p.Name || '') + ', your IBA System password is cleared. Sign in now with your mobile number, leave the password empty, and make your new password.';
            const s2 = w.q('[data-s2]');
            w.q('[data-s1]').hidden = true; s2.hidden = false;
            s2.innerHTML = '<p class="ok">Cleared. ' + esc(p.Name || '') + ' can sign in with the mobile only and make a new password.</p>' +
                '<div class="row">' + (p.Mobile ? '<a class="btn wa grow" target="_blank" rel="noopener" href="https://wa.me/' + waNum(p.Mobile) + '?text=' + encodeURIComponent(msg) + '">Tell them on WhatsApp</a>' : '') +
                '<button type="button" data-x3>Close</button></div>';
            s2.querySelector('[data-x3]').addEventListener('click', w.close);
            if (after) after();
        });
    }
    function resetFor(p, reqId, after) {
        const w = mount(
            '<div class="head"><div><h2>Reset password</h2><p class="sub">' + esc(p.Name || '') + ' · ' + esc(showMobile(p.Mobile)) + '</p></div>' +
            '<button class="x" data-x type="button" title="Close">×</button></div>' +
            '<div data-s1><label>Temporary password</label><input data-tmp autocomplete="off" value="' + makeTemp() + '">' +
            '<p class="note">You can keep this one or type your own (at least 6 characters). Their current password stops working.</p>' +
            '<p class="err" data-err></p>' +
            '<div class="row"><button type="button" data-x2>Cancel</button><span class="grow"></span><button class="main" type="button" data-save>Save temporary password</button></div></div>' +
            '<div data-s2 hidden></div>', { name: 'reset' });
        w.q('[data-x]').addEventListener('click', w.close);
        w.q('[data-x2]').addEventListener('click', w.close);
        w.q('[data-save]').addEventListener('click', async () => {
            const tmp = w.q('[data-tmp]').value.trim(), err = w.q('[data-err]'), btn = w.q('[data-save]');
            err.textContent = '';
            if (tmp.length < 6) { err.textContent = 'Use at least 6 characters.'; return; }
            btn.disabled = true; btn.textContent = 'Saving…';
            const by = (me() || {}).Name || SUPER();
            const now = Date.now();
            try {
                await dbx().ref('approvers/' + p.key).update({ Password: tmp, PwdStatus: 'temp', PwdSetBy: by, PwdSetAt: now, PwdTempKey: tag(tmp) });
                await history(p.key, 'Temporary password set', by);
                if (reqId) await dbx().ref(REQ + '/' + reqId).update({ status: 'done', doneAt: now, doneBy: by });
            } catch (_) {
                btn.disabled = false; btn.textContent = 'Save temporary password';
                err.textContent = 'Could not save. Check the connection and try again.';
                return;
            }
            const msg = 'Hi ' + (p.Name || '') + ', your temporary IBA System password is: ' + tmp +
                '\nSign in with your mobile number and this password. The system will ask you to make your own password.';
            const s2 = w.q('[data-s2]');
            w.q('[data-s1]').hidden = true; s2.hidden = false;
            s2.innerHTML = '<p class="ok">Saved. ' + esc(p.Name || '') + ' must make their own password at the next sign-in.</p>' +
                '<div class="tmp">' + esc(tmp) + '</div>' +
                '<div class="row">' + (p.Mobile ? '<a class="btn wa grow" target="_blank" rel="noopener" href="https://wa.me/' + waNum(p.Mobile) + '?text=' + encodeURIComponent(msg) + '">Send on WhatsApp</a>' : '') +
                '<button type="button" data-copy>Copy</button><button type="button" data-x3>Close</button></div>';
            s2.querySelector('[data-x3]').addEventListener('click', w.close);
            s2.querySelector('[data-copy]').addEventListener('click', (e) => {
                try { navigator.clipboard.writeText(tmp); e.target.textContent = 'Copied'; } catch (_) {}
            });
            if (after) after();
        });
    }

    // Settings card (Super Admin only), same pattern as the ESN printers card
    async function paintCard() {
        const sec = $('settings-form') || $('wd-settings');
        if (!sec) return;
        let card = $('iba-pwd-settings-card');
        if (!isSuper()) { if (card) card.remove(); return; }
        if (!card) {
            card = document.createElement('div');
            card.id = 'iba-pwd-settings-card';
            card.className = 'settings-card';
            card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-key"></i></div><div>' +
                '<h2>Passwords</h2><p>Super Admin only. Clear a password (they make a new one at once) or give a temporary one, see who set each password, and answer Forgot password requests.</p></div></div>' +
                '<p class="iba-pwd-card-sum" style="margin:6px 0 10px">Loading…</p>' +
                '<div class="settings-action-row"><button class="primary-btn" type="button" data-pwd-open><i class="fa-solid fa-key"></i> Open Passwords</button></div>';
            const esn = $('iba-esn-settings-card');
            const actions = sec.querySelector('.main-settings-actions');
            if (esn && esn.parentElement) esn.parentElement.insertBefore(card, esn);
            else if (actions && actions.parentElement) actions.parentElement.insertBefore(card, actions);
            else sec.appendChild(card);
            card.addEventListener('click', (e) => { if (e.target.closest('[data-pwd-open]')) { e.preventDefault(); openAdmin(); } });
        }
        const reqs = await loadReqs();
        const sum = card.querySelector('.iba-pwd-card-sum');
        if (sum) sum.innerHTML = reqs.length ? '<b style="color:#ffb35c">' + reqs.length + ' forgot password request' + (reqs.length > 1 ? 's' : '') + '</b> waiting.' : 'No forgot password requests.';
    }
    (function watchSettings() {
        const sec = $('wd-settings');
        if (!sec) { setTimeout(watchSettings, 1000); return; }
        let was = false;
        new MutationObserver(() => {
            const open = !sec.classList.contains('hidden');
            if (open && !was) paintCard();
            was = open;
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (!sec.classList.contains('hidden')) paintCard();
    })();

    // p110: Super Admin "Passwords" tile on the phone assistant (bottom row) with the number of requests
    let reqCount = 0;
    async function refreshCount() {
        if (!isSuper()) return;
        try { reqCount = (await loadReqs()).length; } catch (_) {}
        paintTile();
    }
    function paintTile() {
        const row = document.querySelector('#iba-ai-panel .iba-aph-more');
        if (!row) return;
        let b = row.querySelector('[data-aph-pwd]');
        if (!isSuper()) { if (b) { b.remove(); row.classList.replace('is-4', 'is-3'); } return; }
        if (!b) {
            b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('data-aph-pwd', '');
            b.style.setProperty('--c', '#C9A227');
            b.title = 'Passwords: clear a password, forgot password requests';
            b.innerHTML = '<i class="fa-solid fa-key"><em class="iba-aph-badge" hidden></em></i><b>Passwords</b>';
            row.insertBefore(b, row.firstChild);
            row.classList.replace('is-3', 'is-4');
            b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openAdmin(); });
        }
        const em = b.querySelector('.iba-aph-badge');
        if (em) { em.hidden = !reqCount; em.textContent = reqCount ? String(reqCount) : ''; }
    }
    setInterval(paintTile, 2000);
    setInterval(refreshCount, 5 * 60000);
    (function firstCount(n) { if (isSuper()) { refreshCount(); return; } if (n < 240) setTimeout(() => firstCount(n + 1), 1000); })(0);
    // p110: link in the WhatsApp request (?pwd=1) opens Passwords straight after sign-in
    (function openFromLink() {
        let want = false;
        try { want = new URLSearchParams(location.search).get('pwd') === '1'; } catch (_) {}
        if (!want) return;
        try { const u = new URL(location.href); u.searchParams.delete('pwd'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (_) {}
        (function wait(n) {
            const m = me();
            if (m && m.key && localStorage.getItem('approverKey')) { if (isSuper()) setTimeout(openAdmin, 1500); return; }
            if (n < 600) setTimeout(() => wait(n + 1), 1000);
        })(0);
    })();

    window.ibaPwd = { VERSION, openAdmin, openForgot, isTemp, tag, clearedOpen, pwProblem };
})();
