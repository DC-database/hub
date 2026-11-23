/* 18.0.0 patch 117: Settings, fresh look (martin picked design 2 of 3).
 * Settings page = tiles grouped "My account & screen" (everyone) and "Super Admin".
 * Each tile shows its current state (Sound: On, Passwords: 1 request ...). Click a tile ->
 * that setting opens as a centre pop-up window with a clean inside: one header, rows with
 * the label left and the box / switch right, buttons in one bar at the bottom.
 * Nothing is rebuilt or moved: the Settings section itself becomes the pop-up window (so
 * the form, Save and every patch's own buttons keep working); other cards are only hidden
 * (inline display:none !important). A tile shows only when the person can see its card(s).
 * Unknown (future) cards get their own tile under "Other".
 */
(function () {
    'use strict';
    const VERSION = '18.0.0-p126';
    const $ = (id) => document.getElementById(id);
    const txt = (id) => (($(id) || {}).textContent || '');
    const GROUPS = [
        { id: 'me', label: 'My account & screen' },
        { id: 'super', label: 'Super Admin', note: 'only you see these' },
        { id: 'other', label: 'Other' }
    ];
    // tile: id, group, label, line, icon, cards, state() -> [text, kind]
    const ITEMS = [
        { id: 'profile', g: 'me', label: 'Profile & password', sub: 'Site, new password, vacation', ic: 'user',
            cards: ['.settings-profile-card', '.settings-account-card', '.main-settings-actions', '#settings-message'],
            state: () => { const v = (($('settings-site') || {}).value || '').trim(); return v ? ['Site: ' + v] : null; } },
        { id: 'sound', g: 'me', label: 'Sound', sub: 'Click and success sounds', ic: 'sound', cards: ['.settings-audio-card'],
            state: () => window.isAudioMuted ? ['Muted', 'r'] : ['On', 'g'] },
        { id: 'saver', g: 'me', label: 'Screensaver', sub: 'Clock and video when you are away', ic: 'moon', cards: ['#iba-ss-settings'],
            state: () => { const m = /Screensaver\s+(On|Off)/i.exec(txt('iba-ss-settings')); return m ? [m[1], /on/i.test(m[1]) ? 'g' : ''] : null; } },
        { id: 'look', g: 'me', label: 'Background & speed', sub: 'Moving background, light mode for older PCs', ic: 'image', cards: ['#iba-still-card', '#iba-lite-card'],
            state: () => { const m = /Now:\s*([A-Za-z]+)/.exec(txt('iba-lite-card')); return m ? [m[1]] : null; } },
        { id: 'dash', g: 'me', label: 'Dashboard', sub: 'Refresh numbers, chart or cards', ic: 'chart', cards: ['#iba-dash-tools', '#iba-d2-settings-card'] },
        { id: 'apps', g: 'me', label: 'Install on phone', sub: 'Scan the QR with your phone or tablet', ic: 'phone', cards: ['#iba-app-qr-card'],
            state: () => (window.ibaApp && window.ibaApp.gateOn && document.body.classList.contains('iba-is-super-admin')) ? (window.ibaApp.gateOn() ? ['App required on PC', 'g'] : ['Tabs allowed', 'r']) : ['QR code'] },
        { id: 'version', g: 'me', label: 'System version', sub: 'Which patch this page runs', ic: 'info', cards: ['#iba-ver-card'],
            state: () => window.IBA_PATCH ? ['Patch ' + window.IBA_PATCH] : null },
        { id: 'pwd', g: 'super', label: 'Passwords', sub: 'Clear, temporary, forgot requests', ic: 'key', cards: ['#iba-pwd-settings-card'],
            state: () => { const m = /(\d+)\s+forgot password request/i.exec(txt('iba-pwd-settings-card')); return m && +m[1] ? [m[1] + (m[1] === '1' ? ' request' : ' requests'), 'r'] : ['No requests']; } },
        { id: 'esn', g: 'super', label: 'ESN printing', sub: 'Who can print ESN', ic: 'print', cards: ['#iba-esn-settings-card'],
            state: () => /Nobody yet/i.test(txt('iba-esn-settings-card')) ? ['Only you'] : ['List set'] },
        { id: 'lpo', g: 'super', label: 'LPO emails', sub: 'Who can send LPO emails', ic: 'mail', cards: ['#iba-lpo-settings-card'],
            state: () => /Nobody yet/i.test(txt('iba-lpo-settings-card')) ? ['Only you'] : ['List set'] },
        { id: 'skills', g: 'super', label: 'Skill access', sub: 'Who can use each assistant skill', ic: 'spark', cards: ['#iba-sa-settings-card'],
            state: () => /built-in rule/i.test(txt('iba-sa-settings-card')) ? ['As built'] : ['Custom'] },
        { id: 'inv', g: 'super', label: 'Inventory permissions', sub: 'Material Stock functions per person', ic: 'box', cards: ['#iba-invperm-card'] },
        { id: 'news', g: 'super', label: 'Announcements', sub: 'Celebration banner and important message', ic: 'horn', cards: ['#celebration-settings-container', '#general-announcement-settings-container'],
            state: () => { const a = ($('general-announcement-enabled') || {}).checked, c = ($('celebration-enabled') || {}).checked; return a || c ? [(a && c ? 'Both on' : a ? 'Announcement on' : 'Banner on'), 'g'] : ['None on']; } },
        { id: 'feat', g: 'super', label: 'Feature controls', sub: 'Manual PO / vacation mode', ic: 'sliders', cards: ['#im-admin-controls'],
            state: () => /Normal Mode/i.test(txt('im-admin-controls')) ? ['Normal'] : ['Vacation mode', 'r'] },
        { id: 'bgopen', g: 'super', label: 'Backgrounds & opening', sub: 'Photos and sign-in animation for everyone', ic: 'play', cards: ['#iba-shell-bg-settings', '#iba-login-opening-settings'] }
    ];
    const ICON = {
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
        sound: '<path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
        moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
        image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
        chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
        key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
        print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        spark: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
        box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
        horn: '<path d="M3 10v4h3l9 5V5L6 10H3z"/><path d="M18 9v6"/>',
        sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
        play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
        x: '<path d="M6 6l12 12M18 6L6 18"/>',
        phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
        dot: '<circle cx="12" cy="12" r="3"/>'
    };
    const svg = (k) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[k] || ICON.dot) + '</svg>';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let open = null, query = '';

    // ---------- tiles page (shadow root: the app's theme cannot touch it) ----------
    const TILE_CSS = `
:host{all:initial;display:block;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#e9eef3;max-width:1180px;margin:0 auto 24px}
.top{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:6px 2px 18px}
h1{font:700 28px/1.15 system-ui,sans-serif;margin:0;color:#fff}
.hi{font:400 14px/1.4 system-ui,sans-serif;color:#E3C98A;margin-top:5px}
.top>div:first-child{display:none}
.top{justify-content:flex-end}
.srch{margin-left:auto;display:flex;gap:10px;align-items:center;height:44px;border-radius:12px;background:rgba(11,19,29,.82);border:1px solid rgba(255,255,255,.13);padding:0 14px;width:min(380px,100%)}
.srch svg{width:17px;height:17px;stroke:#9fb3c2;fill:none;stroke-width:2;flex:none}
.srch input{all:unset;flex:1;min-width:0;color:#fff;font:400 14px/1 system-ui,sans-serif}
.srch input::placeholder{color:#8a9aa8}
.g{font:700 11px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#E3C98A;margin:20px 2px 10px;display:flex;gap:8px;align-items:center;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 10px rgba(0,0,0,.7)}
.g i{font-style:normal;color:#9fb0bf;letter-spacing:.03em;font-weight:600;text-transform:none}
.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.t{all:unset;box-sizing:border-box;cursor:pointer;background:rgba(11,19,29,.84);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:15px 16px;display:flex;flex-direction:column;gap:6px;min-height:118px;transition:border-color .15s,transform .15s,background .15s}
.t:hover{border-color:rgba(235,216,168,.55);background:rgba(16,27,40,.92);transform:translateY(-1px)}
.t:focus-visible{outline:2px solid #EBD8A8;outline-offset:2px}
.ic{width:36px;height:36px;border-radius:10px;background:rgba(235,216,168,.13);color:#EBD8A8;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.ic svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.t b{font:600 15px/1.25 system-ui,sans-serif;color:#fff}
.t small{font:400 12.5px/1.35 system-ui,sans-serif;color:#9fb0bf}
.st{margin-top:auto;padding-top:6px}
.chip{display:inline-block;font:600 11.5px/1 system-ui,sans-serif;padding:5px 10px;border-radius:20px;background:rgba(255,255,255,.08);color:#cfd8e1}
.chip.g{background:rgba(70,180,120,.18);color:#8fe0b0}.chip.r{background:rgba(229,72,77,.2);color:#ff9a9d}
.none{color:#cfd8e1;font:400 14px/1.4 system-ui,sans-serif;margin:16px 4px;background:rgba(12,14,17,.86);border-radius:10px;padding:10px 14px;width:fit-content}
@media (max-width:1100px){.tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:760px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.srch{margin-left:0}}`;

    // ---------- the pop-up window (the Settings section itself), inside the app's layer ----------
    const S = 'html body #wd-settings.iba-sw-open:not(.hidden)';
    const PAGE_CSS = `@layer iba-ui {
html body #wd-settings.iba-st-on:not(.hidden) > .settings-hero{display:none !important}
${S}{position:fixed !important;left:50% !important;top:calc(50% + 34px) !important;transform:translate(-50%,-50%) !important;width:min(880px,94vw) !important;max-height:calc(100vh - 110px) !important;
  overflow:auto !important;z-index:8995 !important;margin:0 !important;padding:0 0 10px !important;display:block !important;background:#0C0E11 !important;
  border:1px solid rgba(235,216,168,.25) !important;border-radius:18px !important;box-shadow:0 0 0 100vmax rgba(3,8,14,.42),0 30px 90px rgba(0,0,0,.55) !important;scrollbar-width:thin}
${S} > .settings-hero, ${S} > #iba-st-tiles{display:none !important}
html body #iba-st-ghost:has(+ #wd-settings.hidden), html body #iba-st-ghost:has(+ #wd-settings:not(.iba-sw-open)){display:none !important}
${S} .iba-sw-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:14px;padding:18px 24px 16px;background:#0C0E11;border-bottom:1px solid rgba(255,255,255,.08)}
${S} .iba-sw-head .ic{width:40px;height:40px;border-radius:11px;background:rgba(235,216,168,.14);color:#EBD8A8;display:flex;align-items:center;justify-content:center;flex:none}
${S} .iba-sw-head svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
${S} .iba-sw-head .tx{flex:1;min-width:0}
${S} .iba-sw-head b{display:block;font-size:19px;font-weight:700;color:#fff;line-height:1.2}
${S} .iba-sw-head span{display:block;font-size:13px;color:#E3C98A;margin-top:3px}
${S} .iba-sw-head .x{all:unset;cursor:pointer;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#cfd8e1;border:1px solid rgba(255,255,255,.14)}
${S} .iba-sw-head .x:hover{background:rgba(255,255,255,.08);color:#fff}
${S} #settings-form, ${S} .settings-grid{display:block !important;margin:0 !important;padding:0 !important;gap:0 !important;max-width:none !important}
${S} [data-st]{max-width:none !important}
${S} .settings-card{background:transparent !important;border:0 !important;box-shadow:none !important;border-radius:0 !important;margin:0 !important;padding:16px 24px 6px !important;backdrop-filter:none !important;width:auto !important;min-height:0 !important}
${S} .settings-card::before, ${S} .settings-card::after{display:none !important}
${S}.iba-sw-one .settings-card-header{display:none !important}
${S} .settings-card-header{display:block !important;padding:0 0 8px !important;margin:0 0 4px !important;border:0 !important;min-height:0 !important}
${S} .settings-card-header .settings-card-icon{display:none !important}
${S} .settings-card-header h2, ${S} .settings-card-header h3{font-size:12px !important;letter-spacing:.12em !important;text-transform:uppercase !important;color:#E3C98A !important;margin:0 0 4px !important;font-weight:700 !important}
${S} .settings-card-header p{font-size:12.5px !important;color:#9fb0bf !important;margin:0 !important;line-height:1.45 !important}
${S} .settings-card + .settings-card, ${S} [data-st] + [data-st]{border-top:1px solid rgba(255,255,255,.07) !important}
${S} .settings-fields-grid{display:block !important}
${S} .form-group{display:grid !important;grid-template-columns:210px minmax(0,1fr) !important;column-gap:20px !important;row-gap:4px !important;align-items:center !important;padding:12px 0 !important;margin:0 !important;border-top:1px solid rgba(255,255,255,.06) !important}
${S} .settings-fields-grid > .form-group:first-child{border-top:0 !important}
${S} .form-group > label{grid-column:1 !important;font-size:13.5px !important;font-weight:600 !important;color:#e9eef3 !important;margin:0 !important}
${S} .form-group > input, ${S} .form-group > select, ${S} .form-group > textarea{grid-column:2 !important;width:100% !important;margin:0 !important}
${S} .form-group > .input-note{grid-column:2 !important;font-size:12px !important;color:#9fb0bf !important;margin:2px 0 0 !important}
${S} .form-group:has(> .checkbox-group){display:block !important}
${S} .checkbox-group{display:flex !important;flex-direction:row-reverse !important;justify-content:space-between !important;align-items:center !important;gap:18px !important;margin:0 !important}
${S} .checkbox-group label{display:flex !important;flex-direction:column !important;gap:2px !important;margin:0 !important;font-size:13.5px !important;font-weight:600 !important}
${S} .checkbox-group label small{font-weight:400 !important;font-size:12px !important;color:#9fb0bf !important}
${S} .checkbox-group input[type=checkbox]{width:20px !important;height:20px !important;flex:none !important;accent-color:#c9a94f !important}
${S} .settings-vacation-panel{padding-left:0 !important;margin:0 !important;border:0 !important;background:transparent !important}
${S} .settings-action-row{display:flex !important;flex-wrap:wrap !important;justify-content:flex-end !important;gap:10px !important;padding:14px 0 8px !important;margin:10px 0 0 !important;border-top:1px solid rgba(255,255,255,.08) !important}
${S} .main-settings-actions{padding:14px 24px 8px !important;margin:0 !important}
${S} #settings-message{padding:0 24px !important;margin:0 !important;text-align:right !important}
${S} .settings-message-line:empty, ${S} .error-message:empty{display:none !important}
@media (max-width:760px){
 ${S}{width:100vw !important;max-height:100vh !important;height:100vh !important;border-radius:0 !important}
 ${S} .form-group{grid-template-columns:minmax(0,1fr) !important}
 ${S} .form-group > label, ${S} .form-group > input, ${S} .form-group > select, ${S} .form-group > textarea, ${S} .form-group > .input-note{grid-column:1 !important}
}}`;

    const blocksOf = (sec) => {
        const out = [];
        const skip = (el) => el.id === 'iba-st-tiles' || el.classList.contains('iba-sw-head') || el.classList.contains('settings-hero') || /^(STYLE|SCRIPT)$/.test(el.tagName);
        const add = (el) => { if (el && el.nodeType === 1 && !skip(el) && out.indexOf(el) < 0) out.push(el); };
        const form = $('settings-form');
        if (form) Array.from(form.children).forEach((c) => { if (c.classList.contains('settings-grid')) Array.from(c.children).forEach(add); else add(c); });
        Array.from(sec.children).forEach((c) => { if (c !== form) add(c); });
        return out;
    };
    // ids first (some patch cards also carry a borrowed class like settings-audio-card)
    const itemOf = (el) => {
        for (const it of ITEMS) for (const sel of it.cards) { if (sel[0] === '#' && el.id === sel.slice(1)) return it.id; }
        for (const it of ITEMS) for (const sel of it.cards) { try { if (sel[0] !== '#' && el.matches(sel)) return it.id; } catch (_) {} }
        return null;
    };
    function hide(el) {
        if (el.hasAttribute('data-st-off')) return;
        el.setAttribute('data-st-off', el.style.getPropertyValue('display') + '|' + el.style.getPropertyPriority('display'));
        el.style.setProperty('display', 'none', 'important');
    }
    function unhide(el) {
        const v = el.getAttribute('data-st-off');
        if (v === null) return;
        el.removeAttribute('data-st-off');
        const [d, pr] = v.split('|');
        if (d) el.style.setProperty('display', d, pr || ''); else el.style.removeProperty('display');
    }
    let obs = null;
    // hidden by the app itself (role, permission)? read with our hiding taken off for a moment
    function roleShown(list) {
        const off = list.filter((el) => el.hasAttribute('data-st-off'));
        off.forEach(unhide);
        const r = new Map(list.map((el) => [el, !el.classList.contains('hidden') && !el.hidden && getComputedStyle(el).display !== 'none']));
        off.forEach(hide);
        if (obs) obs.takeRecords();
        return r;
    }
    const cardTitle = (el) => ((el.querySelector('h2,h3,h4,.settings-card-eyebrow,strong') || {}).textContent || el.id || 'Setting').trim().slice(0, 40);
    const me = () => { try { return (typeof currentApprover !== 'undefined' && currentApprover) || null; } catch (_) { return null; } };

    function closeWin() {
        if (!open) return;
        open = null;
        paint();
    }
    // 119 (martin): tiles that only hold an "Open ..." button open that list straight away
    // (no in-between window with one button)
    const DIRECT = { pwd: /^Open Passwords/i, esn: /^Open the list/i, lpo: /^Open the list/i, skills: /^Open skill access/i, inv: /^Open$/i };
    function directBtn(id) {
        const re = DIRECT[id];
        const sec = $('wd-settings');
        if (!re || !sec) return null;
        const cards = sec.querySelectorAll('[data-st="' + id + '"]');
        for (const c of cards) {
            const b = Array.from(c.querySelectorAll('button')).find((x) => re.test(String(x.textContent || '').trim()) && !x.disabled);
            if (b) return b;
        }
        return null;
    }
    function openWin(id) {
        const b = directBtn(id);
        if (b) { if (open) { open = null; paint(); } b.click(); return; }
        open = id; paint(); const sec = $('wd-settings'); if (sec) sec.scrollTop = 0;
    }

    let paints = 0, lastSig = '';
    function paint() {
        paints++;
        const sec = $('wd-settings');
        if (!sec) return;
        if (!$('iba-st-css')) { const s = document.createElement('style'); s.id = 'iba-st-css'; s.textContent = PAGE_CSS; document.head.appendChild(s); }
        if (sec.classList.contains('hidden') && open) open = null;
        if (sec.classList.contains('hidden') && paints > 1) return; // p130: nothing to draw while Settings is closed
        const list = blocksOf(sec);
        const shown = roleShown(list);
        const items = ITEMS.map((it) => Object.assign({}, it, { els: [], vis: false, n: 0 }));
        const byId = {}; items.forEach((it) => { byId[it.id] = it; });
        list.forEach((el) => {
            let id = itemOf(el);
            if (!id) {
                if (!el.matches('.settings-card, [id$="-card"], [id$="-settings"]')) return; // spacers, message lines
                id = 'x-' + (el.id || cardTitle(el).toLowerCase().replace(/\W+/g, '-'));
                if (!byId[id]) { const it = { id, g: 'other', label: cardTitle(el), sub: '', ic: 'dot', els: [], vis: false, n: 0 }; byId[id] = it; items.push(it); }
            }
            if (el.getAttribute('data-st') !== id) el.setAttribute('data-st', id);
            byId[id].els.push(el);
            if (shown.get(el) && !/settings-message|main-settings-actions/.test(el.id + ' ' + el.className)) { byId[id].vis = true; byId[id].n++; }
        });
        const vis = items.filter((it) => it.vis);
        if (!vis.length) return;
        if (open && (!byId[open] || !byId[open].vis)) open = null;
        sec.classList.add('iba-st-on');
        sec.classList.toggle('iba-sw-open', !!open);
        sec.classList.toggle('iba-sw-one', !!open && byId[open].n === 1);

        // tiles
        let host = $('iba-st-tiles');
        if (!host) {
            host = document.createElement('div'); host.id = 'iba-st-tiles';
            const root = host.attachShadow({ mode: 'open' });
            root.innerHTML = '<style>' + TILE_CSS + '</style><div class="top"><div><h1>Settings</h1><div class="hi"></div></div>' +
                '<label class="srch">' + svg('search') + '<input type="search" placeholder="Search settings" autocomplete="off"></label></div><div class="body"></div>';
            root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-st-item]'); if (b) openWin(b.getAttribute('data-st-item')); });
            const inp = root.querySelector('input');
            inp.addEventListener('input', () => { query = inp.value.trim().toLowerCase(); lastSig = ''; paint(); });
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); const f = root.querySelector('[data-st-item]'); if (f) f.click(); }
                if (e.key === 'Escape') { inp.value = ''; query = ''; lastSig = ''; paint(); }
            });
        }
        if (host.parentNode !== sec || sec.firstElementChild !== host) sec.prepend(host);
        const root = host.shadowRoot;
        const u = me() || {};
        const hi = (u.Name ? 'Hello, ' + u.Name : 'Your settings') + (u.Position ? ' · ' + u.Position : '');
        const hiEl = root.querySelector('.hi'); if (hiEl.textContent !== hi) hiEl.textContent = hi;
        const match = (it) => !query || (it.label + ' ' + it.sub + ' ' + it.els.map((e) => e.textContent).join(' ')).toLowerCase().indexOf(query) >= 0;
        const stateOf = (it) => { try { return it.state ? it.state() : null; } catch (_) { return null; } };
        let html = '';
        GROUPS.forEach((g) => {
            const its = vis.filter((it) => it.g === g.id && match(it));
            if (!its.length) return;
            html += '<div class="g">' + esc(g.label) + (g.note ? '<i>· ' + esc(g.note) + '</i>' : '') + '</div><div class="tiles">';
            its.forEach((it) => {
                const st = stateOf(it);
                html += '<button type="button" class="t" data-st-item="' + esc(it.id) + '"><span class="ic">' + svg(it.ic) + '</span><b>' + esc(it.label) + '</b>' +
                    (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '<span class="st">' + (st ? '<span class="chip ' + (st[1] || '') + '">' + esc(st[0]) + '</span>' : '') + '</span></button>';
            });
            html += '</div>';
        });
        if (!html) html = '<p class="none">Nothing found.</p>';
        if (html !== lastSig) { lastSig = html; root.querySelector('.body').innerHTML = html; }

        // window header + dim
        let head = sec.querySelector(':scope > .iba-sw-head');
        if (open) {
            const it = byId[open];
            if (!head) {
                head = document.createElement('div'); head.className = 'iba-sw-head';
                head.addEventListener('click', (e) => { if (e.target.closest('.x')) closeWin(); });
            }
            if (head.previousElementSibling !== host) host.after(head);
            const hh = '<span class="ic">' + svg(it.ic) + '</span><span class="tx"><b>' + esc(it.label) + '</b><span>' + esc(it.sub || '') + '</span></span><button type="button" class="x" title="Close (Esc)">' + svg('x') + '</button>';
            if (head.getAttribute('data-for') !== open) { head.innerHTML = hh; head.setAttribute('data-for', open); }
        } else if (head) head.remove();

        // 117 (martin): the tiles stay visible behind the open window. The real tiles live
        // inside the section (which becomes the window), so a copy sits just before it.
        let ghost = $('iba-st-ghost');
        if (open) {
            if (!ghost) {
                ghost = document.createElement('div'); ghost.id = 'iba-st-ghost';
                const gr = ghost.attachShadow({ mode: 'open' });
                gr.innerHTML = '<style>' + TILE_CSS + '</style><div class="top"><div><h1>Settings</h1><div class="hi"></div></div></div><div class="body"></div>';
                gr.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-st-item]'); if (b) openWin(b.getAttribute('data-st-item')); else closeWin(); });
            }
            if (ghost.nextElementSibling !== sec) sec.parentNode.insertBefore(ghost, sec);
            const gr = ghost.shadowRoot;
            if (gr.__sig !== lastSig) { gr.__sig = lastSig; gr.querySelector('.body').innerHTML = lastSig; }
            const ghi = gr.querySelector('.hi'); if (ghi.textContent !== hi) ghi.textContent = hi;
            const cs = getComputedStyle(host);
            ghost.style.cssText = 'display:block;box-sizing:border-box;padding:' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft + ';';
        } else if (ghost) ghost.remove();

        list.forEach((el) => {
            const st = el.getAttribute('data-st');
            if (!st) return;
            if (open && st === open) unhide(el); else hide(el);
        });
        if (obs) obs.takeRecords(); // our own changes must not start another round
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !open) return;
        // an app pop-up opened from inside the window closes first
        const top = Array.from(document.querySelectorAll('.modal:not(.hidden), [role="dialog"]:not([hidden])')).find((m) => m.offsetParent !== null && !m.closest('#wd-settings'));
        if (top) return;
        closeWin();
    });
    // Save in Profile & password: a password error must stay visible -> keep the window open

    let tmr = 0;
    const later = () => { clearTimeout(tmr); tmr = setTimeout(paint, 120); };
    function start() {
        const sec = $('wd-settings');
        if (!sec) { setTimeout(start, 500); return; }
        paint();
        obs = new MutationObserver(later);
        obs.observe(sec, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        setInterval(function () { const s = $('wd-settings'); if (s && !s.classList.contains('hidden') && !document.hidden) paint(); }, 4000); // p130: only while Settings is open (it made every page recalculate)
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaSettingsTabs = { VERSION, paint, count: () => paints, show: openWin, close: closeWin };
})();
