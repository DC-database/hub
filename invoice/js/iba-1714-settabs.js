/* 18.0.0 patch 114: Settings re-arranged (martin: "settings is like a jungle").
 * Layout like phone / Windows settings: a menu on the left (groups + items, search box),
 * the chosen item's card(s) on the right, one item at a time.
 * Nothing is moved or rebuilt: every card stays in its place in the page (other patches
 * keep inserting cards next to each other); cards of other items are only hidden
 * (inline display:none !important) and the section becomes a 2-column grid.
 * An item shows in the menu only when the person can see at least one of its cards, so a
 * normal user / Admin gets "My account" + "My screen" and the Super Admin also gets the
 * admin groups. Unknown (future) cards get their own item under "Other".
 * Last item is remembered per PC (localStorage iba-settings-item-v1).
 */
(function () {
    'use strict';
    const VERSION = '18.0.0-p114';
    const KEY = 'iba-settings-item-v1';
    const GROUPS = [
        { id: 'account', label: 'My account' },
        { id: 'screen', label: 'My screen' },
        { id: 'people', label: 'People & access', admin: true },
        { id: 'news', label: 'Announcements', admin: true },
        { id: 'system', label: 'System & look', admin: true },
        { id: 'other', label: 'Other' }
    ];
    // item: id, group, label, small line, icon, cards (selectors)
    const ITEMS = [
        { id: 'profile', g: 'account', label: 'Profile & password', sub: 'Your details, site, new password, vacation', ic: 'user',
            cards: ['.settings-profile-card', '.settings-account-card', '.main-settings-actions', '#settings-message'] },
        { id: 'version', g: 'account', label: 'System version', sub: 'Which patch this page runs', ic: 'info', cards: ['#iba-ver-card'] },
        { id: 'sound', g: 'screen', label: 'Sound', sub: 'Click and success sounds', ic: 'sound', cards: ['.settings-audio-card'] },
        { id: 'saver', g: 'screen', label: 'Screensaver', sub: 'Clock and video when you are away', ic: 'moon', cards: ['#iba-ss-settings'] },
        { id: 'look', g: 'screen', label: 'Background & speed', sub: 'Moving background, light mode for old PCs', ic: 'image', cards: ['#iba-still-card', '#iba-lite-card'] },
        { id: 'dash', g: 'screen', label: 'Dashboard', sub: 'Refresh numbers, chart or cards', ic: 'chart', cards: ['#iba-dash-tools', '#iba-d2-settings-card'] },
        { id: 'pwd', g: 'people', label: 'Passwords', sub: 'Clear, temporary, forgot requests', ic: 'key', cards: ['#iba-pwd-settings-card'] },
        { id: 'esn', g: 'people', label: 'ESN printing', sub: 'Who can print ESN', ic: 'print', cards: ['#iba-esn-settings-card'] },
        { id: 'lpo', g: 'people', label: 'LPO emails', sub: 'Who can send LPO emails', ic: 'mail', cards: ['#iba-lpo-settings-card'] },
        { id: 'skills', g: 'people', label: 'Skill access', sub: 'Who can use each assistant skill', ic: 'spark', cards: ['#iba-sa-settings-card'] },
        { id: 'inv', g: 'people', label: 'Inventory permissions', sub: 'Material Stock functions per person', ic: 'box', cards: ['#iba-invperm-card'] },
        { id: 'celeb', g: 'news', label: 'Celebration banner', sub: 'Greeting banner for everyone', ic: 'star', cards: ['#celebration-settings-container'] },
        { id: 'ann', g: 'news', label: 'Important announcement', sub: 'Message everyone must see', ic: 'horn', cards: ['#general-announcement-settings-container'] },
        { id: 'feat', g: 'system', label: 'Feature controls', sub: 'Manual PO / vacation mode switches', ic: 'sliders', cards: ['#im-admin-controls'] },
        { id: 'bg', g: 'system', label: 'Backgrounds', sub: 'Photo of each area, for everyone', ic: 'image', cards: ['#iba-shell-bg-settings'] },
        { id: 'open', g: 'system', label: 'Opening', sub: 'Sign-in animation for everyone', ic: 'play', cards: ['#iba-login-opening-settings'] }
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
        star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
        horn: '<path d="M3 10v4h3l9 5V5L6 10H3z"/><path d="M18 9v6"/>',
        sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
        play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
        dot: '<circle cx="12" cy="12" r="3"/>'
    };
    const svg = (k) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[k] || ICON.dot) + '</svg>';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const $ = (id) => document.getElementById(id);
    let cur = null, query = '';
    try { cur = localStorage.getItem(KEY); } catch (_) {}

    // the menu: shadow root, so the app's button / theme rules cannot touch it
    const CSS = `
:host{all:initial;display:block;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.nav{border-radius:18px;background:rgba(12,22,32,.92);border:1px solid rgba(235,216,168,.2);padding:14px 10px 12px;
  box-shadow:0 10px 28px rgba(0,0,0,.28);max-height:calc(100vh - 130px);overflow:auto;scrollbar-width:thin}
.title{font:700 19px/1.2 system-ui,sans-serif;color:#fff;margin:2px 8px 12px;letter-spacing:.01em}
.search{display:flex;align-items:center;gap:8px;margin:0 4px 6px;padding:0 10px;height:40px;border-radius:11px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.search svg{width:16px;height:16px;stroke:#9fb3c2;fill:none;stroke-width:2;flex:none}
.search input{all:unset;flex:1;min-width:0;color:#fff;font:400 14px/1 system-ui,sans-serif}
.search input::placeholder{color:#8a9aa8}
.g{font:700 10.5px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#E3C98A;margin:16px 10px 6px;display:flex;align-items:center;gap:6px}
.g .lock{font-weight:600;letter-spacing:.04em;color:#9fb3c2;text-transform:none}
.it{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:11px;width:100%;padding:9px 10px;border-radius:11px;cursor:pointer;color:#dfe6ec}
.it:hover{background:rgba(255,255,255,.07)}
.it.on{background:#EBD8A8;color:#1b2430}
.it svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none;opacity:.9}
.it .tx{display:flex;flex-direction:column;min-width:0}
.it b{font:600 14px/1.25 system-ui,sans-serif}
.it small{font:400 11.5px/1.3 system-ui,sans-serif;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.it .badge{margin-left:auto;min-width:20px;height:20px;border-radius:10px;background:#e5484d;color:#fff;font:700 11px/20px system-ui,sans-serif;text-align:center;padding:0 6px}
.none{color:#9fb3c2;font:400 13px/1.4 system-ui,sans-serif;margin:8px 10px}
@media (max-width:900px){
  .nav{max-height:none;padding:10px 8px}
  .title,.g,.it small{display:none}
  .list{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
  .list::-webkit-scrollbar{display:none}
  .it{width:auto;white-space:nowrap;padding:8px 12px}
  .search{margin:0 0 8px}
}`;
    // 2-column page + tidier cards (inside the app's own layer so it wins over its !important rules)
    const PAGE_CSS = `@layer iba-ui {
html body #wd-settings.iba-st-on{display:grid !important;grid-template-columns:290px minmax(0,1fr) !important;column-gap:26px !important;align-items:start !important}
html body #wd-settings.iba-st-on > *{grid-column:2 !important;min-width:0}
html body #wd-settings.iba-st-on > #iba-st-nav{grid-column:1 !important;grid-row:1 / span 50 !important;position:sticky !important;top:12px !important;align-self:start !important}
html body #wd-settings.iba-st-on > .settings-hero{display:none !important}
html body #wd-settings.iba-st-on #settings-form,html body #wd-settings.iba-st-on .settings-grid{margin-top:0 !important}
html body #wd-settings.iba-st-on .iba-st-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 14px;margin:4px 2px 16px}
html body #wd-settings.iba-st-on .iba-st-head b{font-size:24px;color:#fff;font-weight:700}
html body #wd-settings.iba-st-on .iba-st-head span{color:#E3C98A;font-size:14px}
html body #wd-settings.iba-st-on [data-st]{max-width:1000px}
html body #wd-settings.iba-st-on .settings-card{padding:18px 20px !important;border-radius:16px !important;margin-bottom:14px !important}
@media (max-width:900px){
 html body #wd-settings.iba-st-on{grid-template-columns:minmax(0,1fr) !important}
 html body #wd-settings.iba-st-on > *{grid-column:1 !important}
 html body #wd-settings.iba-st-on > #iba-st-nav{grid-column:1 !important;grid-row:auto !important;top:0 !important;z-index:5}
}}`;

    const blocksOf = (sec) => {
        const out = [];
        const add = (el) => { if (el && el.nodeType === 1 && el.id !== 'iba-st-nav' && !el.classList.contains('iba-st-head') && out.indexOf(el) < 0) out.push(el); };
        const form = $('settings-form');
        if (form) Array.from(form.children).forEach((c) => { if (c.classList.contains('settings-grid')) Array.from(c.children).forEach(add); else add(c); });
        Array.from(sec.children).forEach((c) => { if (c !== form && !c.classList.contains('settings-hero') && !/^(STYLE|SCRIPT)$/.test(c.tagName)) add(c); });
        return out;
    };
    const itemOf = (el) => {
        for (const it of ITEMS) for (const sel of it.cards) { try { if (el.matches(sel)) return it.id; } catch (_) {} }
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
    const reqCount = () => { const c = $('iba-pwd-settings-card'); const m = c && /(\d+)\s+forgot password request/i.exec(c.textContent || ''); return m ? +m[1] : 0; };

    let paints = 0, lastSig = '';
    function paint() {
        paints++;
        const sec = $('wd-settings');
        if (!sec) return;
        if (!$('iba-st-css')) { const s = document.createElement('style'); s.id = 'iba-st-css'; s.textContent = PAGE_CSS; document.head.appendChild(s); }
        const list = blocksOf(sec);
        const shown = roleShown(list);
        const items = ITEMS.map((it) => Object.assign({}, it, { els: [], vis: false }));
        const byId = {}; items.forEach((it) => { byId[it.id] = it; });
        list.forEach((el) => {
            let id = itemOf(el);
            if (!id) {
                if (!el.matches('.settings-card, [id$="-card"], [id$="-settings"]')) return; // spacers, message lines
                id = 'x-' + (el.id || cardTitle(el).toLowerCase().replace(/\W+/g, '-'));
                if (!byId[id]) { const it = { id, g: 'other', label: cardTitle(el), sub: '', ic: 'dot', els: [], vis: false }; byId[id] = it; items.push(it); }
            }
            if (el.getAttribute('data-st') !== id) el.setAttribute('data-st', id);
            byId[id].els.push(el);
            if (shown.get(el) && !/settings-message|main-settings-actions/.test(el.id + ' ' + el.className)) byId[id].vis = true;
        });
        const vis = items.filter((it) => it.vis);
        if (!vis.length) return;
        if (!cur || !byId[cur] || !byId[cur].vis) cur = vis[0].id;
        sec.classList.add('iba-st-on');

        // menu
        let host = $('iba-st-nav');
        if (!host) {
            host = document.createElement('div'); host.id = 'iba-st-nav';
            const root = host.attachShadow({ mode: 'open' });
            root.innerHTML = '<style>' + CSS + '</style><nav class="nav" aria-label="Settings"><div class="title">Settings</div>' +
                '<label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" placeholder="Search settings" autocomplete="off"></label>' +
                '<div class="list"></div></nav>';
            root.addEventListener('click', (e) => {
                const b = e.target.closest && e.target.closest('[data-st-item]');
                if (!b) return;
                cur = b.getAttribute('data-st-item');
                try { localStorage.setItem(KEY, cur); } catch (_) {}
                paint();
                if (sec.getBoundingClientRect().top < 0) sec.scrollIntoView({ block: 'start' });
            });
            const inp = root.querySelector('input');
            inp.addEventListener('input', () => { query = inp.value.trim().toLowerCase(); lastSig = ''; paint(); });
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); const f = root.querySelector('[data-st-item]'); if (f) f.click(); }
                if (e.key === 'Escape') { inp.value = ''; query = ''; lastSig = ''; paint(); }
            });
        }
        if (host.parentNode !== sec) sec.prepend(host);
        const root = host.shadowRoot;
        const match = (it) => !query || (it.label + ' ' + it.sub + ' ' + it.els.map((e) => e.textContent).join(' ')).toLowerCase().indexOf(query) >= 0;
        const badge = reqCount();
        const sig = vis.map((it) => it.id).join(',') + '|' + query + '|' + badge;
        if (sig !== lastSig) {
            lastSig = sig;
            let html = '', admin = false;
            GROUPS.forEach((g) => {
                const its = vis.filter((it) => it.g === g.id && match(it));
                if (!its.length) return;
                html += '<div class="g">' + esc(g.label) + (g.admin && !admin ? '<span class="lock">· Super Admin</span>' : '') + '</div>';
                if (g.admin) admin = true;
                its.forEach((it) => {
                    html += '<button type="button" class="it" data-st-item="' + esc(it.id) + '">' + svg(it.ic) +
                        '<span class="tx"><b>' + esc(it.label) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' +
                        (it.id === 'pwd' && badge ? '<span class="badge">' + badge + '</span>' : '') + '</button>';
                });
            });
            root.querySelector('.list').innerHTML = html || '<p class="none">Nothing found.</p>';
        }
        root.querySelectorAll('[data-st-item]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-st-item') === cur));

        // heading over the cards
        const it = byId[cur];
        let head = sec.querySelector(':scope > .iba-st-head');
        if (!head) { head = document.createElement('div'); head.className = 'iba-st-head'; }
        if (head.previousElementSibling !== host) host.after(head);
        const hh = '<b>' + esc(it.label) + '</b><span>' + esc(it.sub || '') + '</span>';
        if (head.innerHTML !== hh) head.innerHTML = hh;

        list.forEach((el) => {
            const st = el.getAttribute('data-st');
            if (!st) return;
            if (st === cur) unhide(el); else hide(el);
        });
        if (obs) obs.takeRecords(); // our own changes must not start another round
    }

    // a password error in Settings must be seen: jump to Profile & password
    // (window, capture: runs before the password check, which may stop the submit)
    window.addEventListener('submit', (e) => {
        if (e.target && e.target.id === 'settings-form' && cur !== 'profile') { cur = 'profile'; paint(); }
    }, true);

    let tmr = 0;
    const later = () => { clearTimeout(tmr); tmr = setTimeout(paint, 120); };
    function start() {
        const sec = $('wd-settings');
        if (!sec) { setTimeout(start, 500); return; }
        paint();
        obs = new MutationObserver(later);
        obs.observe(sec, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        setInterval(paint, 4000); // role changes after sign-in, request count
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaSettingsTabs = { VERSION, paint, count: () => paints, show: (id) => { cur = id; paint(); } };
})();
