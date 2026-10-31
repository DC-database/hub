/* ==========================================================================
   js/iba-1705-invperm.js — 17.0.5 patch 44
   Inventory permissions (Super Admin, Settings card "Inventory permissions").
   For each person, tick which Material Stock functions they may use.
   - Nothing changed = the same rules as before (the "default" column).
   - A tick that differs from the default is saved for that person only
     (main db system_settings/inventory_permissions/<user key> = { <function>: true/false }).
   - "Back to default" removes the person's changes.
   - Super Admin always has everything. Delete stays Super Admin only and is
     not in the list. Transfer / Restock / Usage / Return stay open to all.
   window.ibaInvCan(id, def) is asked by materialStock.js and Site stock:
   the person's saved choice, else def (today's rule).
   ========================================================================== */
(function () {
    'use strict';
    // same place as the other Super Admin settings (system_settings is writable)
    const PATH = 'system_settings/inventory_permissions';
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const low = (v) => String(v || '').trim().toLowerCase();
    const $ = (id) => document.getElementById(id);

    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) || null; } catch (_) { return null; } }
    function myKey() { try { return String((me() && me().key) || localStorage.getItem('approverKey') || ''); } catch (_) { return ''; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function delegateNow() { try { return typeof isVacationDelegateUser === 'function' && !!isVacationDelegateUser(); } catch (_) { return false; } }
    function say(msg) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(msg); } catch (_) {} alert(msg); }

    // today's rules (u = a user record; del = covering the Super Admin's vacation)
    const admin = (u) => low(u.Role) === 'admin';
    const logistic = (u) => low(u.Position).indexOf('logistic') !== -1;
    const irwin = (u) => low(u.Name) === 'irwin';
    const FUNCS = [
        { id: 'register', label: 'Register new material', def: (u, del) => admin(u) || del, how: 'Admin role' },
        { id: 'edit', label: 'Edit material (details and stock)', def: (u, del) => admin(u) || del, how: 'Admin role' },
        { id: 'upload', label: 'Upload stock CSV', def: (u, del) => admin(u) || del, how: 'Admin role' },
        { id: 'titles', label: 'Upload titles', def: (u, del) => admin(u) || del || logistic(u), how: 'Admin role or Logistic' },
        { id: 'download', label: 'Download titles / Template', def: () => true, how: 'Everyone with Material Stock' },
        { id: 'report', label: 'Stock Report (print + CSV)', def: () => true, how: 'Everyone with Material Stock' },
        { id: 'site_stock', label: 'Site stock (print + CSV)', def: (u) => irwin(u) || /^e\.?\s*ali$/i.test(String(u.Name || '').trim()), how: 'Super Admin and E.Ali' },
        { id: 'required', label: 'Required List', def: () => true, how: 'Everyone with Material Stock' },
        { id: 'merge', label: 'Merge selected items', def: (u) => irwin(u) || logistic(u), how: 'Super Admin or Logistic' },
        { id: 'stock_check', label: 'Stock Check (align / approve site qty)', def: (u) => irwin(u) || logistic(u), how: 'Super Admin or Logistic' },
        { id: 'photo', label: 'Attach item photo', def: (u) => !!String(u.Name || '').trim(), how: 'Everyone signed in' }
    ];
    const byId = {};
    FUNCS.forEach((f) => { byId[f.id] = f; });

    // ---- my own saved choices ------------------------------------------------
    let mine = {};
    let watching = '';
    function watchMine() {
        const k = myKey(), d = mainDb();
        if (!k || !d || watching === k) return;
        if (watching) { try { d.ref(PATH + '/' + watching).off(); } catch (_) {} }
        watching = k;
        d.ref(PATH + '/' + k).on('value', (s) => { mine = s.val() || {}; applyBody(); }, () => { watching = ''; });
    }
    // every person's choices (Super Admin: Access check), small
    let everyone = null;
    function watchAll() {
        if (everyone || !isSuper() || !mainDb()) return;
        everyone = {};
        mainDb().ref(PATH).on('value', (s) => { everyone = s.val() || {}; }, () => { everyone = null; });
    }
    function canFor(key, rec) {
        if (irwin(rec || {})) return FUNCS.map((f) => f.id);
        watchAll();
        const saved = (everyone && everyone[key]) || {};
        return FUNCS.filter((f) => (typeof saved[f.id] === 'boolean' ? saved[f.id] : !!f.def(rec || {}, false))).map((f) => f.id);
    }
    // def = today's rule as the caller works it out (kept exactly)
    function can(id, def) {
        if (isSuper()) return true;
        watchMine();
        if (Object.prototype.hasOwnProperty.call(mine, id) && typeof mine[id] === 'boolean') return mine[id];
        if (typeof def === 'boolean') return def;
        const f = byId[id], u = me();
        return !!(f && u && f.def(u, delegateNow()));
    }
    // buttons that are always shown today are hidden only when you took them away
    function off(id) { return !isSuper() && mine[id] === false; }
    function applyBody() {
        const b = document.body;
        if (!b) return;
        ['download', 'report', 'required', 'register', 'upload', 'titles', 'photo'].forEach((id) => {
            const on = off(id);
            if (b.classList.contains('iba-inv-off-' + id) !== on) b.classList.toggle('iba-inv-off-' + id, on);
        });
    }
    // clicks on a function you took away are stopped (for buttons drawn before the change)
    const BTN = { 'ms-download-titles-btn': 'download', 'ms-template-btn': 'download', 'ms-open-report-modal-btn': 'report',
        'ms-modal-print-btn': 'report', 'ms-modal-excel-btn': 'report', 'ms-open-requestlist-btn': 'required' };
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('button');
        if (!b) return;
        const id = BTN[b.id] || (b.classList.contains('ms-add-to-required-btn') ? 'required' : '');
        if (id && off(id)) { e.preventDefault(); e.stopImmediatePropagation(); say('You do not have this function. Ask the Super Admin.'); }
    }, true);

    // ---- people --------------------------------------------------------------
    async function people() {
        let data = null;
        try { if (typeof getApproversDataSafe === 'function') data = getApproversDataSafe(); } catch (_) {}
        try { if ((!data || !Object.keys(data).length) && typeof allApproverData !== 'undefined' && allApproverData) data = allApproverData; } catch (_) {}
        if (!data || typeof data !== 'object' || !Object.keys(data).length) {
            try { const s = await mainDb().ref('approvers').once('value'); data = s.val() || {}; } catch (_) { data = {}; }
        }
        const list = Array.isArray(data) ? data.map((v, i) => [String(i), v]) : Object.entries(data);
        return list.filter(([, v]) => v && (v.Name || v.name)).map(([k, v]) => Object.assign({}, v, { key: k, Name: String(v.Name || v.name).trim() }))
            .sort((a, b) => a.Name.localeCompare(b.Name));
    }
    const label = (p) => p.Name + ' · ' + [p.Position, p.Site].filter(Boolean).join(' · ');

    // ---- the window ------------------------------------------------------------
    let win = null;
    function close() { if (win && win.isConnected) win.remove(); win = null; }
    async function open(preKey) {
        if (!isSuper()) return say('Inventory permissions are for the Super Admin only.');
        close();
        win = document.createElement('div');
        win.id = 'iba-esn';
        win.className = 'iba-esn-ov iba-invperm';
        win.innerHTML = '<div class="iba-esn-box is-wide" role="dialog" aria-modal="true" aria-label="Inventory permissions">' +
            '<div class="iba-esn-head"><b><i class="fa-solid fa-boxes-stacked"></i> Inventory permissions</b>' +
            '<button type="button" class="iba-esn-x" data-ip-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-esn-body"><p class="iba-esn-sub">Pick a person. The ticks show what they can use on Material Stock now. Change a tick and press <b>Save</b>: only that person changes. Delete stays yours only.</p>' +
            '<label><span class="iba-esn-lab">Person</span><input class="iba-esn-q" data-ip-who list="iba-ip-people" placeholder="Type a name, position or site" autocomplete="off"><datalist id="iba-ip-people"></datalist></label>' +
            '<div class="iba-ip-out"></div><div class="iba-esn-err"></div></div>' +
            '<div class="iba-esn-foot"><span class="iba-esn-picked" data-ip-sum></span><span class="iba-esn-sp"></span>' +
            '<button type="button" class="iba-esn-btn" data-ip-reset disabled><i class="fa-solid fa-rotate-left"></i> Back to default</button>' +
            '<button type="button" class="iba-esn-btn is-go" data-ip-save disabled><i class="fa-solid fa-floppy-disk"></i> Save</button></div></div>';
        document.body.appendChild(win);
        const w = win;
        w.addEventListener('click', (e) => {
            if (e.target === w || e.target.closest('[data-ip-x]')) return close();
            if (e.target.closest('[data-ip-save]')) return save(w);
            if (e.target.closest('[data-ip-reset]')) return reset(w);
        });
        w.addEventListener('change', (e) => { if (e.target.matches('[data-ip-f]')) mark(w); });
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        const who = w.querySelector('[data-ip-who]');
        const [list, all] = await Promise.all([people(), mainDb().ref(PATH).once('value').then((s) => s.val() || {}).catch(() => ({}))]);
        w.__people = list; w.__all = all;
        // same-name people are told apart by position and site (never combined)
        w.querySelector('#iba-ip-people').innerHTML = list.filter((p) => !irwin(p)).map((p) => '<option value="' + esc(label(p)) + '"></option>').join('');
        const pick = () => {
            const v = who.value.trim();
            const p = list.find((x) => label(x) === v) || (list.filter((x) => low(x.Name) === low(v)).length === 1 ? list.find((x) => low(x.Name) === low(v)) : null);
            if (p && !irwin(p)) show(w, p);
        };
        who.addEventListener('change', pick);
        who.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pick(); } });
        summary(w);
        const pre = preKey && list.find((x) => x.key === preKey);
        if (pre) { who.value = label(pre); show(w, pre); } else who.focus();
    }
    function summary(w) {
        const keys = Object.keys(w.__all || {}).filter((k) => w.__all[k] && Object.keys(w.__all[k]).some((f) => byId[f]));
        const names = keys.map((k) => { const p = (w.__people || []).find((x) => x.key === k); return p ? p.Name : (w.__all[k].name || k); });
        w.querySelector('[data-ip-sum]').innerHTML = names.length ? 'Changed for: <b>' + esc(names.join(', ')) + '</b>' : 'Nobody changed: everyone has the default.';
    }
    function show(w, p) {
        w.__p = p;
        const saved = (w.__all && w.__all[p.key]) || {};
        const out = w.querySelector('.iba-ip-out');
        out.innerHTML = '<div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th>Function</th><th>Default</th><th style="text-align:center">Can use</th></tr></thead><tbody>' +
            FUNCS.map((f) => {
                const d = !!f.def(p, false);
                const has = typeof saved[f.id] === 'boolean';
                const on = has ? saved[f.id] : d;
                return '<tr' + (has && saved[f.id] !== d ? ' class="is-changed"' : '') + '><td><b>' + esc(f.label) + '</b><small>' + esc(f.how) + '</small></td>' +
                    '<td>' + (d ? 'Yes' : 'No') + '</td><td class="c"><input type="checkbox" data-ip-f="' + f.id + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(f.label) + '"></td></tr>';
            }).join('') + '</tbody></table></div>';
        w.querySelector('[data-ip-reset]').disabled = !Object.keys(saved).some((f) => byId[f]);
        w.querySelector('[data-ip-save]').disabled = true;
    }
    function mark(w) {
        const p = w.__p;
        if (!p) return;
        w.querySelectorAll('[data-ip-f]').forEach((c) => { c.closest('tr').classList.toggle('is-changed', c.checked !== !!byId[c.dataset.ipF].def(p, false)); });
        w.querySelector('[data-ip-save]').disabled = false;
    }
    async function save(w) {
        const p = w.__p;
        if (!p) return;
        const val = {};
        w.querySelectorAll('[data-ip-f]').forEach((c) => { const d = !!byId[c.dataset.ipF].def(p, false); if (c.checked !== d) val[c.dataset.ipF] = c.checked; });
        const btn = w.querySelector('[data-ip-save]');
        btn.disabled = true;
        try {
            const ref = mainDb().ref(PATH + '/' + p.key);
            if (Object.keys(val).length) await ref.set(Object.assign({ name: p.Name, by: (me() && me().Name) || '', at: Date.now() }, val));
            else await ref.remove();
            w.__all[p.key] = Object.keys(val).length ? val : undefined;
            if (!Object.keys(val).length) delete w.__all[p.key];
            show(w, p);
            summary(w);
            say(p.Name + ': saved.');
        } catch (e) { btn.disabled = false; w.querySelector('.iba-esn-err').textContent = 'Could not save: ' + ((e && e.message) || e); }
    }
    async function reset(w) {
        const p = w.__p;
        if (!p) return;
        try {
            await mainDb().ref(PATH + '/' + p.key).remove();
            delete w.__all[p.key];
            show(w, p);
            summary(w);
            say(p.Name + ': back to default.');
        } catch (e) { w.querySelector('.iba-esn-err').textContent = 'Could not reset: ' + ((e && e.message) || e); }
    }

    // ---- Settings card (Super Admin) -------------------------------------------
    function paintCard() {
        const sec = $('settings-form') || $('wd-settings');
        if (!sec) return;
        let card = $('iba-invperm-card');
        if (!isSuper()) { if (card) card.remove(); return; }
        if (card) return;
        card = document.createElement('div');
        card.id = 'iba-invperm-card';
        card.className = 'settings-card';
        card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-boxes-stacked"></i></div><div>' +
            '<h2>Inventory permissions</h2><p>Super Admin only. Tick which Material Stock functions each person may use (Register, Edit, Upload, Stock Report, Site stock, Merge, Stock Check ...). Untouched people keep the default.</p></div></div>' +
            '<div class="settings-action-row"><button class="primary-btn" type="button" data-ip-open><i class="fa-solid fa-user-gear"></i> Open</button></div>';
        const esn = $('iba-esn-settings-card');
        const before = $('iba-shell-bg-settings') || $('iba-login-opening-settings');
        if (esn && esn.parentElement) esn.parentElement.insertBefore(card, esn.nextSibling);
        else if (before && before.parentElement) before.parentElement.insertBefore(card, before);
        else sec.appendChild(card);
        card.addEventListener('click', (e) => { if (e.target.closest('[data-ip-open]')) { e.preventDefault(); open(); } });
    }
    (function watchSettings() {
        const sec = $('wd-settings');
        if (!sec) { setTimeout(watchSettings, 1000); return; }
        let was = false;
        new MutationObserver(() => {
            const o = !sec.classList.contains('hidden');
            if (o && !was) setTimeout(paintCard, 300);
            was = o;
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (!sec.classList.contains('hidden')) paintCard();
    })();
    // start reading my own choices once signed in
    (function waitUser(n) {
        if (myKey() && mainDb()) { watchMine(); watchAll(); return; }
        if (n < 240) setTimeout(() => waitUser(n + 1), 500);
    })(0);

    window.ibaInvCan = can;
    window.ibaInvPerm = { open, can, canFor, FUNCS };
})();
