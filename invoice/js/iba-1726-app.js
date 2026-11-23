/* ==========================================================================
   iba-1726-app.js — 18.0.0 patch 126 (martin): feel like a native app
   1. PC in a browser TAB: "no install, no entry" - the page is covered by
      "Install IBA System to continue" (Install button in Chrome / Edge).
      Already installed: "Open the IBA app" (desktop icon). Other browsers:
      "Open IBA in Chrome or Edge". Never inside the installed app, never on
      phones / tablets, never on the local test copy. Super Admin can pass
      with the small "Super Admin sign-in" link (checked after sign-in).
   2. Settings tile "Install on phone" with a QR code. Super Admin chooses who
      sees it (Admins only / Everyone / People I pick), saved in
      system_settings/app_install.
   3. Two QRs (iPhone, Android) open the system with ?install=ios / android: iPhone/iPad get the 3 steps
      (Share > Add to Home Screen > Add), Android gets an Install button.
      Opened from the home-screen icon (no ?install) the guide never shows.
   4. Right-click menu and F12 / Ctrl+Shift+I/J/C / Ctrl+U blocked for everyone
      except Super Admin (right-click still works inside text boxes). Only a
      deterrent: data safety comes from the Firebase rules.
   Loaded in <head> so the browser's install offer is caught.
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaApp) return;
    var VERSION = '18.0.0-p126';
    var INSTALLED = 'iba-app-installed-v1';
    var SET_PATH = 'system_settings/app_install';
    var deferred = null;

    function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
    function today() { return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10); }
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function standalone() { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true; } catch (_) { return false; } }
    var UA = navigator.userAgent || '';
    var IOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/i.test(UA) && navigator.maxTouchPoints > 1);
    var ANDROID = /Android/i.test(UA);
    var MOBILE = IOS || ANDROID || /Mobi/i.test(UA);
    var EDGE_CHROME = /Chrome\/|Edg\//.test(UA) && !/OPR\/|Firefox/i.test(UA);
    function body() { return document.body; }
    function signedIn() { var b = body(); return !!(b && b.classList.contains('iba-shell-on')); }
    function isSuper() { var b = body(); if (b && b.classList.contains('iba-is-super-admin')) return true; try { var u = window.currentApprover || (typeof currentApprover !== 'undefined' ? currentApprover : null); return !!(u && /super admin/i.test(String(u.Position || ''))); } catch (_) { return false; } }
    function me() { try { return window.currentApprover || (typeof currentApprover !== 'undefined' ? currentApprover : null); } catch (_) { return null; } }
    function iris() { return !!window.IBA_IRIS_APP; }

    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; try { localStorage.removeItem(INSTALLED); } catch (_) {} setTimeout(function () { paintCard(); }, 300); });
    window.addEventListener('appinstalled', function () { set(INSTALLED, '1'); deferred = null; closeGuide(); if ($('iba-app-card')) paintCard('done'); });
    if (standalone()) set(INSTALLED, '1');

    // ------------------------------------------------------------------ shared look
    var CSS = ':host{all:initial}*{box-sizing:border-box;font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif}' +
        '.card{position:fixed;right:22px;bottom:22px;z-index:2147482000;width:min(390px,calc(100vw - 32px));background:#0C0E11;border:1px solid rgba(227,201,138,.4);border-radius:16px;padding:16px 18px;box-shadow:0 18px 50px rgba(0,0,0,.6);display:flex;gap:14px;color:#e8eef4;animation:in .25s ease}' +
        '@keyframes in{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}' +
        '.ic{width:46px;height:46px;border-radius:12px;flex:none;overflow:hidden;background:#1a2230}.ic img{width:100%;height:100%;display:block}' +
        'b{display:block;font-size:15px;margin:0 22px 4px 0;color:#fff}p{font-size:13px;color:#a9b9c8;line-height:1.45;margin:0 0 12px}' +
        '.btns{display:flex;gap:8px;flex-wrap:wrap}button{all:unset;cursor:pointer;padding:8px 14px;border-radius:10px;font-weight:600;font-size:13px;border:1px solid #2b4157;color:#e8eef4}' +
        'button.m{background:#d4af37;color:#111;border-color:#d4af37}button:focus-visible{outline:2px solid #EBD8A8;outline-offset:2px}' +
        '.x{position:absolute;top:8px;right:10px;padding:4px 8px;border:0;color:#8aa0b4;font-size:18px;line-height:1}' +
        '.dim{position:fixed;inset:0;z-index:2147483200;background:rgba(5,10,16,.72);display:flex;align-items:flex-end;justify-content:center;padding:14px}' +
        '.sheet{width:min(440px,100%);background:#0C0E11;border:1px solid rgba(227,201,138,.4);border-radius:20px;padding:20px 18px 18px;color:#e8eef4;box-shadow:0 -10px 40px rgba(0,0,0,.5)}' +
        '.sheet h2{margin:0 0 4px;font-size:19px;color:#fff}.sheet .sub{color:#a9b9c8;font-size:14px;margin:0 0 16px}' +
        'ol{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:10px}' +
        'li{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px}' +
        'li .n{width:30px;height:30px;border-radius:50%;background:#d4af37;color:#111;font-weight:800;display:grid;place-items:center;flex:none}' +
        'li span{font-size:15px;line-height:1.35}li svg{width:22px;height:22px;stroke:#5ea8ff;fill:none;stroke-width:2;vertical-align:-5px;margin:0 3px}' +
        '.gate{align-items:center;background:rgba(5,10,16,.94);z-index:2147483300}.gate .sheet{text-align:center;padding:26px 24px 18px}.gate h2{font-size:21px;margin-bottom:8px}.gate .sub{font-size:14.5px;line-height:1.5}' +
        'button.link{border:0;padding:4px 6px;color:#7f93a6;font-size:12px;font-weight:500;text-decoration:underline}' +
        '.row{display:flex;gap:10px}.row button{flex:1;text-align:center;padding:13px;font-size:15px}';
    function mount(id, html) {
        var old = $(id); if (old) old.remove();
        var host = document.createElement('div'); host.id = id;
        var root = host.attachShadow({ mode: 'open' });
        root.innerHTML = '<style>' + CSS + '</style>' + html;
        document.body.appendChild(host);
        return root;
    }

    // ------------------------------------------------------------------ 1. PC gate: "no install, no entry" (martin)
    // On a PC browser TAB (Chrome / Edge / any) the system is covered until it is opened from the installed app.
    // Not on: phones / tablets, the installed app itself, IRIS app window, local test copy (file://, localhost),
    // and Super Admin (sign-in link on the gate, then only if the signed-in person really is Super Admin).
    var SA = 'iba-app-sa-v1';
    function local() { if (window.IBA_APP_GATE_TEST) return false; return !/^https?:$/.test(location.protocol) || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }
    function saBypass() { var f = null; try { f = sessionStorage.getItem(SA); } catch (_) {} if (!f) return false; if (signedIn() && !isSuper()) { try { sessionStorage.removeItem(SA); } catch (_) {} return false; } return true; }
    // off switch (Super Admin, Settings > Install on phone): system_settings/app_install/gate = false
    var GATE = 'iba-app-gate-v1', gateReadAt = 0;
    function gateOn() { return get(GATE) !== '0'; }
    function readGate(force) {
        var d = dbx(); if (!d) return;
        var every = $('iba-app-card') ? 60000 : 10 * 60000;
        if (!force && Date.now() - gateReadAt < every) return;
        gateReadAt = Date.now();
        d.ref(SET_PATH + '/gate').once('value').then(function (s) { set(GATE, s.val() === false ? '0' : '1'); }).catch(function () {});
    }
    function needGate() { return gateOn() && !local() && !MOBILE && !standalone() && !iris() && !saBypass(); }
    function closeCard() {
        var c = $('iba-app-card'); if (!c) return;
        c.remove();
        Array.prototype.forEach.call(document.body.children, function (el) { if (el.__ibaInert) { el.inert = false; el.__ibaInert = false; } });
    }
    function gateHtml(state) {
        var main;
        if (state === 'done') main = '<h2>Installed!</h2><p class="sub">IBA now opens in its own window. Use that window from now on - you can close this browser tab.</p>';
        else if (deferred) main = '<h2>Install IBA System to continue</h2><p class="sub">IBA works as an app on this PC: its own window and desktop icon, no address bar. One click.</p><div class="row"><button class="m" data-inst>Install IBA</button></div>';
        else if (get(INSTALLED) === '1') main = '<h2>Open the IBA app</h2><p class="sub">IBA is installed on this PC. Close this tab and open <b style="display:inline;margin:0">IBA</b> from the icon on your desktop or Start menu.</p><p class="sub" style="font-size:12.5px">Removed it? Click the install icon ⊕ at the right end of the address bar, then Install.</p>';
        else if (EDGE_CHROME) main = '<h2>Install IBA System to continue</h2><p class="sub">Click the install icon <b style="display:inline;margin:0">⊕</b> at the right end of the address bar (or the browser menu ⋮ → <b style="display:inline;margin:0">Install IBA</b>), then press Install.</p>';
        else main = '<h2>Open IBA in Chrome or Edge</h2><p class="sub">IBA is used as an installed app. Please open this page in Google Chrome or Microsoft Edge and install it there.</p>';
        return '<div class="dim gate"><div class="sheet" role="dialog" aria-modal="true" aria-label="Install IBA">' +
            '<div style="display:flex;justify-content:center;margin-bottom:14px"><div class="ic" style="width:64px;height:64px;border-radius:16px"><img src="icons/icon-192.png" alt=""></div></div>' +
            main + '<div style="text-align:center;margin-top:14px"><button class="link" data-sa>Super Admin sign-in</button></div></div></div>';
    }
    function paintCard(state) {
        if (!needGate()) { closeCard(); return; }
        var sig = (state || '') + '|' + (deferred ? 1 : 0) + '|' + get(INSTALLED);
        var c = $('iba-app-card');
        if (c && c.getAttribute('data-sig') === sig) return;
        var root = mount('iba-app-card', gateHtml(state));
        c = $('iba-app-card'); c.setAttribute('data-sig', sig);
        Array.prototype.forEach.call(document.body.children, function (el) { if (el !== c && !el.inert && !/^(SCRIPT|STYLE)$/.test(el.tagName)) { el.inert = true; el.__ibaInert = true; } });
        root.addEventListener('click', function (e) {
            var t = e.target.closest && e.target.closest('button'); if (!t) return;
            if (t.hasAttribute('data-sa')) { try { sessionStorage.setItem(SA, '1'); } catch (_) {} closeCard(); return; }
            if (t.hasAttribute('data-inst') && deferred) {
                var d = deferred; deferred = null;
                d.prompt();
                (d.userChoice || Promise.resolve({})).then(function (r) { if (r && r.outcome === 'accepted') { set(INSTALLED, '1'); paintCard('done'); } else paintCard(); });
            }
        });
    }

    // ------------------------------------------------------------------ 3. phone guide (?install=1)
    var SHARE = '<svg viewBox="0 0 24 24"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>';
    var PLUS = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
    function closeGuide() {
        var g = $('iba-app-guide'); if (g) g.remove();
        try { var u = new URL(location.href); if (u.searchParams.has('install')) { u.searchParams.delete('install'); history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash); } } catch (_) {}
    }
    function paintGuide() {
        if (!/[?&]install=(1|ios|android)\b/.test(location.search) || standalone()) return;
        var steps;
        if (IOS) {
            steps = '<ol><li><span class="n">1</span><span>Tap ' + SHARE + ' <b style="display:inline;margin:0">Share</b> at the bottom of Safari</span></li>' +
                '<li><span class="n">2</span><span>Scroll and tap ' + PLUS + ' <b style="display:inline;margin:0">Add to Home Screen</b></span></li>' +
                '<li><span class="n">3</span><span>Tap <b style="display:inline;margin:0">Add</b> (top right). Then open IBA from the new icon.</span></li></ol>' +
                (/CriOS|FxiOS|EdgiOS/i.test(UA) ? '<p class="sub" style="color:#ffb35c">Tip: on iPhone this works best in Safari. If you do not see "Add to Home Screen", open this page in Safari.</p>' : '');
        } else if (deferred) {
            steps = '<ol><li><span class="n">1</span><span>Tap <b style="display:inline;margin:0">Install</b> below.</span></li><li><span class="n">2</span><span>Open IBA from the new icon on your home screen.</span></li></ol>';
        } else {
            steps = '<ol><li><span class="n">1</span><span>Tap the browser menu <b style="display:inline;margin:0">⋮</b> (top right)</span></li>' +
                '<li><span class="n">2</span><span>Tap <b style="display:inline;margin:0">Install app</b> or <b style="display:inline;margin:0">Add to Home screen</b></span></li>' +
                '<li><span class="n">3</span><span>Open IBA from the new icon on your home screen.</span></li></ol>';
        }
        var root = mount('iba-app-guide', '<div class="dim"><div class="sheet" role="dialog" aria-label="Install IBA">' +
            '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><div class="ic"><img src="icons/icon-192.png" alt=""></div><div><h2>Install IBA on this phone</h2><p class="sub" style="margin:0">Full screen, no address bar, own icon.</p></div></div>' +
            steps + '<div class="row">' + (!IOS && deferred ? '<button class="m" data-inst>Install</button>' : '') + '<button data-close>' + (IOS ? 'Done' : 'Close') + '</button></div></div></div>');
        root.addEventListener('click', function (e) {
            var t = e.target.closest && e.target.closest('button'); if (!t) return;
            if (t.hasAttribute('data-inst') && deferred) { var d = deferred; deferred = null; d.prompt(); (d.userChoice || Promise.resolve({})).then(closeGuide); return; }
            closeGuide();
        });
    }

    // ------------------------------------------------------------------ 2. Settings card with the QR
    var setting = null, settingAt = 0, people = null;
    function dbx() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function loadSetting(force) {
        if (!force && setting && Date.now() - settingAt < 5 * 60000) return Promise.resolve(setting);
        var d = dbx(); if (!d) return Promise.resolve(setting || { mode: 'admins' });
        return d.ref(SET_PATH).once('value').then(function (s) { setting = s.val() || { mode: 'admins' }; settingAt = Date.now(); return setting; }).catch(function () { return setting || { mode: 'admins' }; });
    }
    function canSee(st) {
        var u = me(); if (!u) return false;
        if (isSuper()) return true;
        var mode = (st && st.mode) || 'admins';
        if (mode === 'all') return true;
        if (mode === 'admins') return /admin/i.test(String(u.Role || ''));
        if (mode === 'pick') return !!(st.people && u.key && st.people[u.key]);
        return false;
    }
    function link(kind) { return location.origin + location.pathname + '?install=' + (kind || '1'); }
    function paintSettings() {
        var host = $('settings-form') || $('wd-settings');
        if (!host || !signedIn()) return;
        loadSetting(false).then(function (st) {
            var card = $('iba-app-qr-card');
            if (!canSee(st)) { if (card) card.remove(); return; }
            if (!card) {
                card = document.createElement('div');
                card.id = 'iba-app-qr-card';
                card.className = 'settings-card';
                var actions = host.querySelector('.main-settings-actions');
                if (actions && actions.parentElement) actions.parentElement.insertBefore(card, actions); else host.appendChild(card);
                card.addEventListener('change', onAdminChange);
                card.addEventListener('input', onAdminSearch);
            }
            var want = (isSuper() ? 'S' : 'U') + JSON.stringify(st || {});
            if (card.getAttribute('data-sig') === want) return;
            card.setAttribute('data-sig', want);
            card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-mobile-screen"></i></div><div><h2>Install on phone or tablet</h2>' +
                '<p>Scan the code for your phone with its camera. IBA opens with 3 easy steps to add it to your home screen, so it works like an app (full screen, own icon).</p></div></div>' +
                '<div style="display:flex;gap:18px;flex-wrap:wrap;padding:6px 0 12px">' + qrBox('ios', 'iPhone / iPad', 'Camera → tap the link → Share → Add to Home Screen → Add.') + qrBox('android', 'Android', 'Camera → tap the link → Install.') + '</div>' +
                '<p style="margin:0 0 10px;font-size:13px;color:#9fb0bf">Then always open IBA from the new icon.</p>' +
                (isSuper() ? adminHtml(st) : '');
            Array.prototype.forEach.call(card.querySelectorAll('[data-qr]'), function (q) {
                var u = link(q.getAttribute('data-qr'));
                try { if (window.QRCode) new window.QRCode(q, { text: u, width: 180, height: 180, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined }); else qText(q, u); } catch (_) { qText(q, u); }
            });
            if (isSuper() && st.mode === 'pick') paintPeople(card, st);
        });
    }
    // no QR library (offline): show the link small and wrapped inside the white box
    function qText(q, u) { q.innerHTML = ''; var s = document.createElement('div'); s.style.cssText = 'color:#0C0E11;font:600 11px/1.4 Inter,Arial,sans-serif;word-break:break-all;text-align:center'; s.textContent = u; q.appendChild(s); }
    // one QR per phone type (martin): each opens the guide for that phone
    function qrBox(kind, title, how) {
        return '<div style="flex:1 1 240px;max-width:300px;display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.03)">' +
            '<div style="font-size:15px;font-weight:700;color:#E3C98A;-webkit-text-fill-color:#E3C98A"><i class="fa-brands fa-' + (kind === 'ios' ? 'apple' : 'android') + '" style="margin-right:6px"></i>' + title + '</div>' +
            '<div data-qr="' + kind + '" style="background:#fff;padding:10px;border-radius:12px;width:200px;height:200px;display:grid;place-items:center"></div>' +
            '<div style="font-size:12.5px;line-height:1.5;color:#cfd8e1;text-align:center">' + how + '</div></div>';
    }
    function adminHtml(st) {
        var m = st.mode || 'admins';
        return '<div class="form-group" style="border-top:1px solid rgba(255,255,255,.08);padding-top:12px"><label for="iba-app-qr-mode">Who sees this tile</label>' +
            '<select id="iba-app-qr-mode" data-app-mode>' +
            '<option value="admins"' + (m === 'admins' ? ' selected' : '') + '>Admins only</option>' +
            '<option value="all"' + (m === 'all' ? ' selected' : '') + '>Everyone</option>' +
            '<option value="pick"' + (m === 'pick' ? ' selected' : '') + '>Only people I pick</option></select>' +
            '<span class="input-note">You always see it. Saved at once.</span></div>' +
            '<div style="display:flex;gap:14px;align-items:flex-start;border-top:1px solid rgba(255,255,255,.08);padding:14px 0 6px">' +
            '<input type="checkbox" id="iba-app-gate" data-app-gate' + (st.gate === false ? '' : ' checked') + ' style="width:22px;height:22px;min-width:22px;margin:2px 0 0;accent-color:#d4af37;cursor:pointer">' +
            '<label for="iba-app-gate" style="cursor:pointer;margin:0;display:block;text-transform:none;letter-spacing:0"><span style="display:block;font-size:14.5px;font-weight:700;color:#E3C98A;-webkit-text-fill-color:#E3C98A">Require the app on PC</span>' +
            '<span style="display:block;margin-top:3px;font-size:12.5px;font-weight:400;line-height:1.5;color:#b8c4cf;-webkit-text-fill-color:#b8c4cf">Browser tabs on a PC are blocked until IBA is installed as an app. Turn off if anything goes wrong - tabs open normally again within a minute.</span></label></div>' +
            (m === 'pick' ? '<div data-people style="padding:4px 0 8px"><input type="search" data-app-q placeholder="Find a name" autocomplete="off" style="width:100%;margin:6px 0 8px"><div data-list style="max-height:240px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px 14px">Loading…</div></div>' : '');
    }
    function saveSetting(st) {
        var d = dbx(); if (!d) return;
        setting = st; settingAt = Date.now();
        d.ref(SET_PATH).set(st).catch(function (e) { try { alert('Could not save: ' + (e && e.message || e)); } catch (_) {} });
    }
    function onAdminChange(e) {
        var t = e.target;
        if (t.hasAttribute('data-app-gate')) { var sg = Object.assign({ mode: 'admins' }, setting || {}, { gate: !!t.checked }); saveSetting(sg); set(GATE, t.checked ? '1' : '0'); var cg = $('iba-app-qr-card'); if (cg) cg.setAttribute('data-sig', 'S' + JSON.stringify(sg)); return; }
        if (t.hasAttribute('data-app-mode')) { var st = Object.assign({}, setting || {}, { mode: t.value }); saveSetting(st); var c = $('iba-app-qr-card'); if (c) c.removeAttribute('data-sig'); paintSettings(); return; }
        if (t.hasAttribute('data-app-person')) {
            var st2 = Object.assign({ mode: 'pick' }, setting || {}); st2.people = Object.assign({}, st2.people || {});
            if (t.checked) st2.people[t.value] = true; else delete st2.people[t.value];
            saveSetting(st2);
            var c2 = $('iba-app-qr-card'); if (c2) c2.setAttribute('data-sig', 'S' + JSON.stringify(st2));
        }
    }
    function onAdminSearch(e) {
        if (!e.target.hasAttribute('data-app-q')) return;
        var q = String(e.target.value || '').toLowerCase();
        var card = $('iba-app-qr-card'); if (!card) return;
        card.querySelectorAll('[data-pname]').forEach(function (l) { l.style.display = !q || l.getAttribute('data-pname').indexOf(q) >= 0 ? '' : 'none'; });
    }
    function paintPeople(card, st) {
        var list = card.querySelector('[data-list]'); if (!list) return;
        var go = function (all) {
            var rows = Object.keys(all || {}).map(function (k) { var p = all[k] || {}; return { k: k, n: String(p.Name || ''), pos: String(p.Position || ''), site: String(p.Site || '') }; })
                .filter(function (p) { return p.n; }).sort(function (a, b) { return a.n.localeCompare(b.n); });
            list.innerHTML = rows.map(function (p) {
                return '<label data-pname="' + esc((p.n + ' ' + p.pos + ' ' + p.site).toLowerCase()) + '" style="display:flex;gap:8px;align-items:center;font-size:13px;padding:4px 0;cursor:pointer">' +
                    '<input type="checkbox" data-app-person value="' + esc(p.k) + '"' + (st.people && st.people[p.k] ? ' checked' : '') + '> <span><b style="color:#fff">' + esc(p.n) + '</b> <span style="color:#9fb0bf">' + esc(p.pos) + (p.site ? ' · ' + esc(p.site) : '') + '</span></span></label>';
            }).join('') || 'No people found.';
        };
        if (people) { go(people); return; }
        var d = dbx(); if (!d) return;
        d.ref('approvers').once('value').then(function (s) { people = s.val() || {}; go(people); }).catch(function () { list.textContent = 'Could not load people.'; });
    }

    // ------------------------------------------------------------------ 4. right-click / dev keys
    function typingTarget(t) { return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')); }
    document.addEventListener('contextmenu', function (e) {
        if (isSuper() || typingTarget(e.target)) return;
        e.preventDefault();
    }, true);
    document.addEventListener('keydown', function (e) {
        if (isSuper()) return;
        var k = String(e.key || '').toUpperCase();
        var ctrl = e.ctrlKey || e.metaKey;
        if (k === 'F12' || (ctrl && e.shiftKey && (k === 'I' || k === 'J' || k === 'C')) || (ctrl && e.altKey && (k === 'I' || k === 'J' || k === 'C')) || (ctrl && !e.shiftKey && k === 'U')) {
            e.preventDefault(); e.stopPropagation();
        }
    }, true);

    // ------------------------------------------------------------------ start
    function tick() { try { readGate(false); } catch (_) {} try { var c = $('iba-app-card'); if (!c || !/^done/.test(c.getAttribute('data-sig') || '')) paintCard(); } catch (_) {} try { var s = $('wd-settings'); if (s && !s.classList.contains('hidden')) paintSettings(); } catch (_) {} }
    function start() {
        paintGuide();
        setInterval(tick, 3000);
        setTimeout(tick, 1500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.ibaApp = { VERSION: VERSION, gateOn: gateOn, readGate: readGate, link: link, card: paintCard, guide: paintGuide, settings: paintSettings, standalone: standalone, _deferred: function () { return deferred; } };
})();
