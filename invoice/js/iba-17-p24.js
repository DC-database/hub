/* ==========================================================================
   js/iba-17-p24.js — 17.0.0 patch 24
   Access check (Super Admin). Shows, for every user, which pages and buttons
   the system gives them, worked out from the same rules the app uses (no
   signing in as anyone, nothing written):
   - a table of all users with the main pages as columns (✓ / ✗),
   - click a user for the full list, grouped by area,
   - warnings: anything a non-Super-Admin can use that changes the system
     for everyone, and pages given by position alone (whatever the role).
   Open it from the assistant ("Access check") or window.ibaAccessCheck().
   Keep the RULES list in step when a permission changes in the app.
   ========================================================================== */
(function () {
    'use strict';

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s || '').trim().toLowerCase();
    const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
    const anyTok = (u, list) => u.tok.some((t) => list.indexOf(t) !== -1);

    function superName() { try { return norm(typeof SUPER_ADMIN_NAME !== 'undefined' ? SUPER_ADMIN_NAME : 'Irwin'); } catch (_) { return 'irwin'; } }
    function isSuperNow() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }

    // a user record -> the facts the rules look at
    function facts(rec) {
        const name = String(rec.Name || rec.Email || '').trim();
        const pos = String(rec.Position || '').trim();
        const role = String(rec.Role || '').trim();
        return { key: rec.key, name: name, pos: pos, role: role, site: String(rec.Site || '').trim(),
            sup: norm(name) === superName(), admin: norm(role) === 'admin', roleHasAdmin: norm(role).indexOf('admin') !== -1,
            tok: tokens(pos), posLow: norm(pos) };
    }

    // ------------------------------------------------------------------
    // The rules. Each: area, label, who (u -> true/false), short = column in
    // the overview, sys = changes the system for everyone (Super Admin only),
    // byPos = given by position alone (role does not matter), note = how.
    // Mirrors app.js / app-navigation-settings.js / app-payments.js /
    // iba-shell.js / iba-assistant.js as of 17.0.0 patch 26.
    // ------------------------------------------------------------------
    const RULES = [
        { area: 'WorkDesk', label: 'WorkDesk (Dashboard, Active Task, Job Records, Calendar)', who: () => true, note: 'Everyone who can sign in' },
        { area: 'WorkDesk', label: 'Invoice Management link', short: 'Invoice Mgmt', who: (u) => u.sup || u.admin || u.pos === 'Accounting' || u.pos === 'Accounts', note: 'Admin role, or position exactly "Accounting" / "Accounts" (also anyone covering a vacation)' },
        { area: 'WorkDesk', label: 'Delete Job Records (red trash)', who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'WorkDesk', label: 'Approve / Reject "For Approval" when not named', who: (u) => u.sup || u.admin || /manager|director|ceo/.test(u.posLow), note: 'Admin role, or position with Manager / Director / CEO' },
        { area: 'WorkDesk', label: 'Print ESN from own Active Task (site Approval)', who: (u) => u.sup || !!(window.ibaEsnFlow && window.ibaEsnFlow.allowedSync(u.key)), note: 'Super Admin, or on the "Who can print ESN" list with the same name and mobile as when added' },
        { area: 'WorkDesk', label: 'CEO approval window', who: (u) => /ceo/.test(u.posLow), byPos: true, note: 'Position contains "CEO"' },

        { area: 'Invoice Management', label: 'Invoice Entry and Batch Entry (add / change invoices)', short: 'Entry', who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'Invoice Management', label: 'Summary Note', who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'Invoice Management', label: 'Invoice Records', short: 'Records', who: (u) => u.sup || u.admin, note: 'Admin role (also anyone covering a vacation)' },
        { area: 'Invoice Management', label: 'Payments', short: 'Payments', who: (u) => u.sup || (u.admin && anyTok(u, ['finance', 'accounts', 'accounting'])), note: 'Admin role with Finance / Accounts / Accounting in the position' },
        { area: 'Invoice Management', label: 'Invoice Dashboard', short: 'Inv. Dashboard', byPos: true,
            who: (u) => { try { if (typeof getInvoiceDashboardAccessState === 'function') return !!getInvoiceDashboardAccessState({ Name: u.name, Position: u.pos, Role: u.role }).canAccessDashboard; } catch (_) {} return u.sup || anyTok(u, ['finance', 'accounts', 'accounting', 'ceo', 'coo']); },
            note: 'Position Finance / Accounts / Accounting / CEO / COO, whatever the role' },
        { area: 'Invoice Management', label: 'Financial Report (Epicore records)', short: 'Fin. Report', who: (u) => u.sup || (u.admin && anyTok(u, ['finance', 'accounts', 'accounting', 'qs', 'seniorqs'])), note: 'Admin role with Finance / Accounts / Accounting / QS in the position (also anyone covering a vacation)' },

        { area: 'Welcome screen', label: 'Financial Report button', who: (u) => u.sup || (u.admin && anyTok(u, ['ceo', 'coo', 'finance', 'accounts', 'accounting'])), note: 'Admin role with CEO / COO / Finance / Accounts / Accounting (opens port.iba.com.qa/Finance)' },
        { area: 'Welcome screen', label: 'PO System button', who: (u) => u.sup, note: 'Super Admin only' },

        { area: 'Inventory', label: 'Material Stock page', short: 'Stock', who: (u) => u.sup || u.admin || u.pos === 'Site DC', note: 'Admin role, or position exactly "Site DC"' },
        // 17.0.5 patch 44: Material Stock functions follow Settings > Inventory permissions
        ...((window.ibaInvPerm && window.ibaInvPerm.FUNCS) || []).map((f) => ({ area: 'Inventory', label: 'Material Stock: ' + f.label,
            who: (u) => u.sup || window.ibaInvPerm.canFor(u.key, { Name: u.name, Position: u.pos, Role: u.role }).indexOf(f.id) !== -1,
            note: f.how + ' (or as ticked in Settings > Inventory permissions)' })),
        { area: 'Inventory', label: 'Material Stock: Delete items', who: (u) => u.sup, note: 'Super Admin only' },

        { area: 'System settings (for everyone)', label: 'Backgrounds and dimming', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'System settings (for everyone)', label: 'Opening page after login', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'System settings (for everyone)', label: 'Clock face', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'System settings (for everyone)', label: 'Celebration banner', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'System settings (for everyone)', label: 'General announcement', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'System settings (for everyone)', label: 'Same-name users (rename / move tasks)', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'System settings (for everyone)', label: 'Who can print ESN', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'System settings (for everyone)', label: 'Task check', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'System settings (for everyone)', label: 'Who can send LPO emails', sys: true, who: (u) => u.sup, note: 'Super Admin only' },
        { area: 'WorkDesk', label: 'LPO emails to vendors (Outlook)', who: (u) => u.sup || !!(window.ibaLpoMail && window.ibaLpoMail.allowedSync(u.key)), note: 'Super Admin, or on the "Who can send LPO emails" list with the same name and mobile as when added' },
        { area: 'System settings (for everyone)', label: 'Print basket (approved SRV stickers)', who: (u) => u.sup || !!(window.ibaEsnFlow && window.ibaEsnFlow.allowedSync(u.key)), note: 'Super Admin, or on the "Who can print ESN" list (17.0.4 patch 3)' }
    ];

    // assistant skills, read from the assistant itself
    function skillRules() {
        let list = [];
        try { if (typeof window.ibaAssistantSkillList === 'function') list = window.ibaAssistantSkillList() || []; } catch (_) { list = []; }
        // skills with their own rule above
        list = list.filter((s) => s.id !== 'lpo_mail');
        return list.map((s) => ({
            area: 'IBA Assistant skills', label: s.name,
            who: s.superOnly ? (u) => u.sup : (s.adminOnly ? (u) => u.sup || u.roleHasAdmin : () => true),
            note: s.superOnly ? 'Super Admin only' : (s.adminOnly ? 'Admin role' : 'Everyone')
        }));
    }
    function allRules() { return RULES.concat(skillRules()); }

    function level(u) {
        if (u.sup) return [0, 'Super Admin'];
        if (u.admin) {
            if (/ceo|coo|cfo|director|finance|accounts|accounting|manager/.test(u.posLow)) return [1, 'Admin · management / finance'];
            return [2, 'Admin · QS / site engineers / others'];
        }
        if (u.role) return [3, 'User · ' + u.role];
        return [4, 'User'];
    }
    function warnings(u, rules) {
        const w = [];
        if (u.sup) return w;
        rules.forEach((r) => {
            let ok = false;
            try { ok = !!r.who(u); } catch (_) {}
            if (ok && r.sys) w.push(['bad', 'Can change "' + r.label + '" for everyone (should be Super Admin only)']);
            if (ok && r.byPos && !u.admin) w.push(['warn', 'Gets "' + r.label + '" from the position "' + u.pos + '" although the role is ' + (u.role || 'not set')]);
        });
        return w;
    }

    async function users() {
        let data = null;
        try { if (typeof getApproversDataSafe === 'function') data = getApproversDataSafe(); } catch (_) {}
        if (!data || typeof data !== 'object' || !Object.keys(data).length) {
            try { const s = await db.ref('approvers').once('value'); data = (s && s.val()) || {}; } catch (_) { data = {}; }
        }
        return Object.keys(data).map((k) => facts(Object.assign({ key: k }, data[k] || {}))).filter((u) => u.name);
    }

    const tick = (ok) => ok ? '<span class="iba-ac-y" title="Yes">✓</span>' : '<span class="iba-ac-n" title="No">✗</span>';

    async function open() {
        if (!isSuperNow()) { alert('The Access check is for the Super Admin only.'); return; }
        const old = document.getElementById('iba-ac');
        if (old) old.remove();
        const w = document.createElement('div');
        w.id = 'iba-ac';
        w.innerHTML = '<div class="iba-ac-box" role="dialog" aria-modal="true" aria-label="Access check">' +
            '<div class="iba-ac-head"><b><i class="fa-solid fa-user-shield"></i> Access check</b>' +
            '<input type="search" class="iba-ac-q" placeholder="Find a name, position, role or site" autocomplete="off">' +
            '<button type="button" class="iba-ac-x" data-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<p class="iba-ac-sub">What each user can open, worked out from the system\'s rules. Nobody is signed in or told; nothing is saved. Click a name for the full list. Anyone covering a vacation also gets the pages of the person they cover.</p>' +
            '<div class="iba-ac-body"><p class="iba-ac-sub">Loading users…</p></div></div>';
        document.body.appendChild(w);
        const close = () => w.remove();
        w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('[data-x]')) close(); });
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

        const list = await users();
        const rules = allRules();
        const cols = rules.filter((r) => r.short);
        const body = w.querySelector('.iba-ac-body');
        const q = w.querySelector('.iba-ac-q');
        let picked = null;

        const overview = () => {
            const t = norm(q.value);
            const hit = list.filter((u) => !t || norm([u.name, u.pos, u.role, u.site].join(' ')).indexOf(t) !== -1);
            const groups = new Map();
            hit.forEach((u) => { const l = level(u); if (!groups.has(l[0])) groups.set(l[0], { name: l[1], list: [] }); groups.get(l[0]).list.push(u); });
            const order = Array.from(groups.keys()).sort((a, b) => a - b);
            const nWarn = hit.filter((u) => warnings(u, rules).length).length;
            body.innerHTML = (nWarn ? '<div class="iba-ac-alert"><i class="fa-solid fa-triangle-exclamation"></i> ' + nWarn + ' user' + (nWarn === 1 ? '' : 's') + ' with something to check (marked <span class="iba-ac-flag">!</span>)</div>' : '<div class="iba-ac-ok"><i class="fa-solid fa-circle-check"></i> No user other than the Super Admin can change system settings.</div>') +
                '<div class="iba-ac-scroll"><table class="iba-ac-table"><thead><tr><th>User</th><th>Position · role · site</th>' +
                cols.map((c) => '<th title="' + esc(c.label) + '">' + esc(c.short) + '</th>').join('') + '<th>Skills</th></tr></thead><tbody>' +
                order.map((k) => {
                    const g = groups.get(k);
                    g.list.sort((a, b) => a.name.localeCompare(b.name));
                    return '<tr class="iba-ac-grp"><td colspan="' + (cols.length + 3) + '">' + esc(g.name) + ' <span>' + g.list.length + '</span></td></tr>' + g.list.map((u) => {
                        const nSk = rules.filter((r) => r.area === 'IBA Assistant skills').filter((r) => { try { return r.who(u); } catch (_) { return false; } }).length;
                        const ws = warnings(u, rules);
                        return '<tr data-u="' + esc(u.key) + '"><td><button type="button" class="iba-ac-name" data-u="' + esc(u.key) + '">' + esc(u.name) + (ws.length ? ' <span class="iba-ac-flag" title="Something to check">!</span>' : '') + '</button></td>' +
                            '<td class="iba-ac-meta">' + esc([u.pos, u.role, u.site ? 'Site ' + u.site : ''].filter(Boolean).join(' · ')) + '</td>' +
                            cols.map((c) => { let ok = false; try { ok = !!c.who(u); } catch (_) {} return '<td class="c">' + tick(ok) + '</td>'; }).join('') +
                            '<td class="c">' + nSk + '</td></tr>';
                    }).join('');
                }).join('') + '</tbody></table></div>';
        };
        const detail = (u) => {
            const ws = warnings(u, rules);
            const areas = [];
            rules.forEach((r) => { if (areas.indexOf(r.area) === -1) areas.push(r.area); });
            body.innerHTML = '<button type="button" class="iba-ac-back" data-back><i class="fa-solid fa-arrow-left"></i> All users</button>' +
                '<div class="iba-ac-who"><b>' + esc(u.name) + '</b><span>' + esc([u.pos || 'No position', u.role || 'No role', u.site ? 'Site ' + u.site : ''].filter(Boolean).join(' · ')) + '</span><em>' + esc(level(u)[1]) + '</em></div>' +
                (ws.length ? '<ul class="iba-ac-warns">' + ws.map((x) => '<li class="is-' + x[0] + '"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(x[1]) + '</li>').join('') + '</ul>' : '') +
                '<div class="iba-ac-scroll">' + areas.map((a) => {
                    const rs = rules.filter((r) => r.area === a);
                    return '<div class="iba-ac-area">' + esc(a) + '</div><table class="iba-ac-table is-detail"><tbody>' + rs.map((r) => {
                        let ok = false; try { ok = !!r.who(u); } catch (_) {}
                        return '<tr class="' + (ok ? 'is-yes' : 'is-no') + '"><td class="c">' + tick(ok) + '</td><td>' + esc(r.label) + '</td><td class="iba-ac-meta">' + esc(r.note || '') + '</td></tr>';
                    }).join('') + '</tbody></table>';
                }).join('') + '</div>';
        };
        const paint = () => { if (picked) detail(picked); else overview(); };
        q.addEventListener('input', () => { picked = null; paint(); });
        body.addEventListener('click', (e) => {
            if (e.target.closest('[data-back]')) { picked = null; paint(); return; }
            const b = e.target.closest('[data-u]');
            if (!b) return;
            picked = list.find((u) => u.key === b.getAttribute('data-u')) || null;
            paint();
        });
        paint();
        setTimeout(() => q.focus(), 0);
    }

    window.ibaAccessCheck = open;
    window.ibaAccessRules = { RULES: RULES, facts: facts, warnings: warnings };
})();
