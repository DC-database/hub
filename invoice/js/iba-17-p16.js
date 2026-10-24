/* ==========================================================================
   js/iba-17-p16.js — 17.0.0 patch 16
   Users with the same name are kept apart.
   Tasks, inboxes, vacation hand-over and reminders all go by the user's Name.
   Two users both named "Asif" (one at site 173, one at 170) were therefore
   one person to the system: a task for one could be handed over because the
   other was on vacation.
   This file (Super Admin only):
     - finds users that share a name and shows a "Split same-name users" window
       (once per sign-in while any exist, and from window.ibaSplitNames());
     - gives each one its own name, e.g. "Asif (173)" and "Asif (170)" (you
       can change the suggestion). Sign-in is by email / mobile, so it does
       not change; only the Name in the user list changes;
     - moves each open task that says "Asif" to the right one, chosen by the
       invoice's site (you can change each choice), with a history line;
     - fixes profiles whose Replacement is "Asif".
   Nothing is written until you press "Apply".
   17.0.0 patch 17: also "Asif" + "Asif.2" (renamed by hand): open tasks that
   still say "Asif", and tasks the vacation hand-over moved away from "Asif",
   are listed so each goes to the right one (by site).
   ========================================================================== */
(function () {
    'use strict';

    const norm = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const safe = (k) => String(k || '').replace(/[.#$[\]\/\\]/g, '_').replace(/\s+/g, '_');
    const CLOSED = /(with accounts|paid|srv done|closed|cancel|deleted|archived|complete)/i;
    const TS = () => firebase.database.ServerValue.TIMESTAMP;

    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function invDb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : null; } catch (_) { return null; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function poMap() { try { return (typeof allPOData !== 'undefined' && allPOData) ? allPOData : {}; } catch (_) { return {}; } }
    const siteNums = (v) => String(v || '').match(/\d+/g) || [];

    async function approvers() {
        try { if (typeof allApproverData !== 'undefined' && allApproverData && Object.keys(allApproverData).length) return allApproverData; } catch (_) {}
        const d = mainDb();
        if (!d) return {};
        const s = await d.ref('approvers').once('value');
        return (s && s.val()) || {};
    }

    // [{ name, users:[{key, Name, Position, Site, Email, Mobile, Vacation}] }]
    // 17.0.0 patch 17: "Asif" and "Asif.2" / "Asif 2" / "Asif (173)" are the
    // same base name: kept together so tasks that still say "Asif" can be checked.
    const baseName = (n) => norm(n).replace(/\s*\([^)]*\)\s*$/, '').replace(/[\s._-]*\d+$/, '').trim();
    async function findGroups() {
        const map = await approvers();
        const by = {};
        Object.keys(map).forEach((k) => {
            const a = map[k];
            if (!a || !String(a.Name || '').trim()) return;
            const b = baseName(a.Name) || norm(a.Name);
            (by[b] = by[b] || []).push(Object.assign({ key: k }, a));
        });
        return Object.keys(by).filter((n) => by[n].length > 1).map((n) => {
            const users = by[n];
            const plain = users.find((u) => norm(u.Name) === n);
            const same = users.some((u, i) => users.some((v, j) => i !== j && norm(u.Name) === norm(v.Name)));
            return { name: plain ? String(plain.Name).trim() : String(users[0].Name).trim(), base: n, users: users, same: same };
        });
    }

    function suggestNames(g) {
        if (!g.same) return g.users.map((u) => String(u.Name).trim());
        const used = {};
        return g.users.map((u) => {
            const site = siteNums(u.Site)[0] || String(u.Site || '').trim();
            let n = g.name + ' (' + (site || u.Position || 'user') + ')';
            if (used[norm(n)]) n = g.name + ' (' + [site, u.Position].filter(Boolean).join(' ') + ')';
            let i = 2;
            while (used[norm(n)]) n = g.name + ' (' + (site || 'user') + ' ' + (i++) + ')';
            used[norm(n)] = true;
            return n;
        });
    }

    // open tasks that say this name: invoices from the person's inbox, and loaded WorkDesk jobs
    async function openTasks(name) {
        const out = [];
        const idb = invDb();
        if (idb) {
            try {
                const s = await idb.ref('invoice_tasks_by_user/' + safe(name)).once('value');
                const rows = (s && s.val()) || {};
                Object.keys(rows).forEach((k) => {
                    const r = rows[k] || {};
                    const po = String(r.po || r.originalPO || r.poNumber || '').trim();
                    if (!po) return;
                    const rec = poMap()[po.toUpperCase()] || poMap()[po] || {};
                    out.push({ kind: 'invoice', po: po, key: String(r.originalKey || r.invoiceKey || k), ref: r.ref || r.invNumber || '', status: r.status || r.remarks || '',
                        site: String(r.site || rec['Project ID'] || '').trim(), vendor: r.vendorName || rec['Supplier Name'] || '' });
                });
            } catch (_) {}
        }
        // tasks the vacation hand-over moved away from this name, still with the replacement
        const d0 = mainDb();
        if (d0 && idb) {
            try {
                const s = await d0.ref('iba_assistant/handover_log').limitToLast(60).once('value');
                const logs = (s && s.val()) || {};
                const seen = {};
                out.forEach((t) => { seen[t.key] = true; });
                for (const id of Object.keys(logs)) {
                    const x = logs[id] || {};
                    if (x.undone || norm(x.from) !== norm(name)) continue;
                    const items = Array.isArray(x.items) ? x.items.filter(Boolean) : Object.values(x.items || {}).filter(Boolean);
                    for (const m of items) {
                        if (m.kind !== 'invoice' || !m.po || !m.key || seen[m.key]) continue;
                        const is = await idb.ref('invoice_entries/' + m.po + '/' + m.key).once('value');
                        const inv = is && is.val();
                        if (!inv || CLOSED.test(String(inv.status || '')) || norm(inv.attention) !== norm(x.to)) continue;
                        seen[m.key] = true;
                        const rec = poMap()[String(m.po).toUpperCase()] || poMap()[m.po] || {};
                        out.push({ kind: 'invoice', po: m.po, key: m.key, ref: inv.invNumber || m.ref || '', status: (inv.status || '') + ' · handed over to ' + x.to,
                            site: String(inv.site || rec['Project ID'] || '').trim(), vendor: inv.vendorName || rec['Supplier Name'] || '', from: x.to });
                    }
                }
            } catch (_) {}
        }
        let jobs = [];
        try { if (typeof allSystemEntries !== 'undefined' && Array.isArray(allSystemEntries)) jobs = allSystemEntries; } catch (_) {}
        jobs.forEach((e) => {
            if (!e || !e.key || e.source === 'invoice' || e.originalPO) return;
            if (norm(e.attention) !== norm(name) || CLOSED.test(String(e.remarks || e.status || ''))) return;
            out.push({ kind: 'job', key: e.key, po: e.po || '', ref: e.ref || '', status: (e.for ? e.for + ' · ' : '') + (e.remarks || ''), site: String(e.site || '').trim(), vendor: e.vendorName || '', entry: e });
        });
        return out;
    }

    function guess(task, users) {
        const ts = siteNums(task.site);
        const hits = users.map((u, i) => ({ i, ok: siteNums(u.Site).some((n) => ts.indexOf(n) !== -1) })).filter((x) => x.ok);
        return hits.length === 1 ? hits[0].i : -1;
    }

    // ------------------------------------------------------------------
    // The window
    // ------------------------------------------------------------------
    async function open(auto) {
        if (!isSuper()) { if (!auto) alert('Only the Super Admin can split same-name users.'); return; }
        const groups = await findGroups();
        if (!groups.length) { if (!auto) alert('No two users share a name. Nothing to split.'); return; }
        const data = [];
        for (const g of groups) {
            const names = suggestNames(g);
            const tasks = await openTasks(g.name);
            if (!g.same && !tasks.length) continue; // names already apart and nothing left to check
            const map = await approvers();
            const reps = Object.keys(map).filter((k) => map[k] && norm(map[k].ReplacementName) === norm(g.name)).map((k) => ({ key: k, owner: map[k].Name, site: map[k].Site || '' }));
            data.push({ g, names, tasks, reps });
        }
        if (!data.length) { if (!auto) alert('Users with similar names are already apart and no task needs checking.'); return; }
        const old = document.getElementById('iba-split-names');
        if (old) old.remove();
        const w = document.createElement('div');
        w.id = 'iba-split-names';
        w.className = 'iba-pb-layer';
        const opt = (d, sel) => d.g.users.map((u, i) => '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + esc(d.names[i]) + '</option>').join('');
        w.innerHTML = '<div class="iba-pb-box iba-split-box" role="dialog" aria-modal="true">' +
            '<div class="iba-pb-head"><b><i class="fa-solid fa-people-arrows"></i> Same-name users</b><span>Tasks go by name. Give each user a name of their own, and send each open task to the right one.</span></div>' +
            '<div class="iba-split-body">' + data.map((d, gi) =>
                '<section data-g="' + gi + '"><h4>' + (d.g.same ? d.g.users.length + ' users named "' + esc(d.g.name) + '"' : 'Users named like "' + esc(d.g.name) + '": ' + d.g.users.map((u) => '"' + esc(u.Name) + '"').join(', ')) + '</h4>' +
                '<table class="iba-split-users"><thead><tr><th>New name</th><th>Position</th><th>Site</th><th>Sign-in</th><th></th></tr></thead><tbody>' +
                d.g.users.map((u, i) => '<tr><td><input data-name="' + i + '" value="' + esc(d.names[i]) + '"></td><td>' + esc(u.Position || '') + '</td><td>' + esc(u.Site || '') + '</td><td>' + esc(u.Email || u.Mobile || '') + '</td><td>' +
                    ((u.Vacation === true || norm(u.Vacation) === 'yes') ? '<span class="iba-split-tag">on vacation</span>' : '') + '</td></tr>').join('') + '</tbody></table>' +
                (d.tasks.length ? '<p class="iba-pb-sub">' + d.tasks.length + ' open task(s) say "' + esc(d.g.name) + '" or were handed over from "' + esc(d.g.name) + '". Who should each one go to? (picked by the invoice\'s site; check the ones marked)</p>' +
                    '<table class="iba-split-tasks"><thead><tr><th>PO</th><th>Site</th><th>Invoice / job</th><th>Status</th><th>Goes to</th></tr></thead><tbody>' +
                    d.tasks.map((t, ti) => { const gs = guess(t, d.g.users); return '<tr' + (gs < 0 ? ' class="is-check"' : '') + '><td>' + esc(t.po) + '</td><td>' + esc(t.site) + '</td><td>' + esc([t.ref, t.vendor].filter(Boolean).join(' · ')) + '</td><td>' + esc(t.status) + '</td><td><select data-task="' + ti + '"><option value="">— choose —</option>' + opt(d, gs) + '</select></td></tr>'; }).join('') + '</tbody></table>'
                    : '<p class="iba-pb-sub">No open tasks say "' + esc(d.g.name) + '" right now.</p>') +
                (d.reps.length ? '<p class="iba-pb-sub">Profiles with "' + esc(d.g.name) + '" as their vacation replacement:</p><table class="iba-split-tasks"><tbody>' +
                    d.reps.map((r, ri) => '<tr><td>' + esc(r.owner) + '</td><td>' + esc(r.site) + '</td><td><select data-rep="' + ri + '"><option value="">— choose —</option>' + opt(d, -1) + '</select></td></tr>').join('') + '</tbody></table>' : '') +
                '</section>').join('') + '</div>' +
            '<div class="iba-pb-foot"><span class="iba-split-msg"></span><button type="button" data-x>Later</button><button type="button" data-go class="is-main"><i class="fa-solid fa-check"></i> Apply</button></div></div>';
        document.body.appendChild(w);
        const msg = w.querySelector('.iba-split-msg');
        const say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? '#FCA5A5' : '#7FE3D6'; };
        // keep the "Goes to" lists in step with the typed names
        w.addEventListener('input', (e) => {
            const inp = e.target.closest('input[data-name]');
            if (!inp) return;
            const sec = inp.closest('section');
            const i = inp.getAttribute('data-name');
            sec.querySelectorAll('select option[value="' + i + '"]').forEach((o) => { o.textContent = inp.value; });
        });
        w.addEventListener('click', async (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-x')) { w.remove(); return; }
            if (!b.hasAttribute('data-go')) return;
            // check
            const plan = [];
            const map = await approvers();
            const taken = {};
            Object.keys(map).forEach((k) => { if (map[k] && map[k].Name) taken[norm(map[k].Name)] = k; });
            for (let gi = 0; gi < data.length; gi++) {
                const d = data[gi], sec = w.querySelector('section[data-g="' + gi + '"]');
                const names = Array.from(sec.querySelectorAll('input[data-name]')).map((x) => x.value.replace(/\s+/g, ' ').trim());
                const seen = {};
                for (let i = 0; i < names.length; i++) {
                    const n = names[i];
                    if (!n) return say('Every user needs a name.', true);
                    if (n !== String(d.g.users[i].Name).trim() && /[.#$[\]\/\\]/.test(n)) return say('A name cannot contain . # $ [ ] / \\', true);
                    if (seen[norm(n)]) return say('"' + n + '" is used twice.', true);
                    seen[norm(n)] = true;
                    const other = taken[norm(n)];
                    if (other && !d.g.users.some((u) => u.key === other)) return say('"' + n + '" is already another user\'s name.', true);
                }
                const tasks = Array.from(sec.querySelectorAll('select[data-task]')).map((s) => s.value);
                if (tasks.some((v) => v === '')) return say('Choose who each task goes to (rows marked).', true);
                const reps = Array.from(sec.querySelectorAll('select[data-rep]')).map((s) => s.value);
                if (reps.some((v) => v === '')) return say('Choose the replacement for each profile listed.', true);
                plan.push({ d, names, tasks, reps });
            }
            const lines = plan.map((p) => p.d.g.users.map((u, i) => '"' + u.Name + '" (' + (u.Site || u.Position || '') + ')' + (p.names[i] !== String(u.Name).trim() ? ' -> "' + p.names[i] + '"' : ' stays')).join('\n') + (p.tasks.length ? '\n' + p.tasks.length + ' task(s) moved' : '')).join('\n\n');
            if (!confirm('Apply these changes now?\n\n' + lines + '\n\nSign-in does not change.')) return;
            b.disabled = true;
            say('Working…');
            try {
                const done = await apply(plan);
                say('Done: ' + done.users + ' user(s) renamed, ' + done.tasks + ' task(s) moved.');
                try { allApproverData = null; } catch (_) {}
                try { allApproversCache = null; } catch (_) {}
                setTimeout(() => { w.remove(); alert('Done. Ask any renamed users to press Ctrl+F5 (or sign in again) so they see their new name.'); }, 600);
            } catch (err) {
                b.disabled = false;
                console.error('[split names]', err);
                say('Stopped: ' + ((err && err.message) || err), true);
            }
        });
    }

    async function apply(plan) {
        const d = mainDb(), idb = invDb();
        const by = (me() && me().Name) || 'Super Admin';
        let users = 0, tasks = 0;
        for (const p of plan) {
            const from = p.d.g.name;
            // 1. the new names
            for (let i = 0; i < p.d.g.users.length; i++) {
                const u = p.d.g.users[i];
                if (p.names[i] === String(u.Name).trim()) continue;
                await d.ref('approvers/' + u.key).update({ Name: p.names[i], NameBefore: String(u.Name).trim() });
                users++;
            }
            // 2. the open tasks
            for (let ti = 0; ti < p.d.tasks.length; ti++) {
                const t = p.d.tasks[ti];
                const to = p.names[Number(p.tasks[ti])];
                const was = t.from || from;
                if (norm(to) === norm(was)) continue;
                const note = 'Same-name users split: ' + was + ' -> ' + to;
                if (t.kind === 'invoice') {
                    const s = await idb.ref('invoice_entries/' + t.po + '/' + t.key).once('value');
                    const inv = s && s.val();
                    if (!inv || norm(inv.attention) !== norm(was)) { if (!t.from) { try { await idb.ref('invoice_tasks_by_user/' + safe(from) + '/' + t.key).remove(); } catch (_) {} } continue; }
                    await Promise.all([
                        idb.ref('invoice_entries/' + t.po + '/' + t.key).update({ attention: to, lastUpdated: TS() }),
                        idb.ref('invoice_entries/' + t.po + '/' + t.key + '/history').push({ action: 'Attention changed', status: inv.status || '', by: by, timestamp: TS(), note: note })
                    ]);
                    try { if (typeof updateInvoiceTaskLookup === 'function') await updateInvoiceTaskLookup(t.po, t.key, Object.assign({}, inv, { attention: to }), was); } catch (e) { console.warn('[split names] task list', e); }
                    try { await idb.ref('invoice_tasks_by_user/' + safe(was) + '/' + t.key).remove(); } catch (_) {}
                } else {
                    await Promise.all([
                        d.ref('job_entries/' + t.key).update({ attention: to }),
                        d.ref('job_entries/' + t.key + '/history').push({ action: 'Attention changed', status: t.entry.remarks || '', by: by, timestamp: TS(), note: note })
                    ]);
                    const local = Object.assign({}, t.entry, { attention: to });
                    try { if (typeof wdUpsertLocalWorkdeskJobEntryCache === 'function') wdUpsertLocalWorkdeskJobEntryCache(t.key, local); } catch (_) {}
                    try { if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await wdWriteWorkdeskJobRecentMarker(t.key, local, 'updated'); } catch (_) {}
                }
                tasks++;
            }
            // 3. vacation replacements that named this person
            for (let ri = 0; ri < p.d.reps.length; ri++) {
                const r = p.d.reps[ri];
                await d.ref('approvers/' + r.key).update({ ReplacementName: p.names[Number(p.reps[ri])] });
            }
        }
        return { users, tasks };
    }

    // once per sign-in, when the Super Admin is in and same-name users exist
    let asked = false;
    function check() {
        if (asked || !me() || !isSuper()) return;
        asked = true;
        setTimeout(() => {
            findGroups().then((g) => {
                if (!g.length) return;
                let k = 'iba-split-names-asked:' + g.map((x) => x.name).join('|');
                try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (_) {}
                open(true).catch((e) => console.warn('[split names]', e));
            }).catch(() => {});
        }, 8000);
    }
    const t = setInterval(() => { if (me()) { clearInterval(t); check(); } }, 5000);

    window.ibaSplitNames = () => open(false);
})();
