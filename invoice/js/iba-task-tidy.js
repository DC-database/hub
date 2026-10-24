/* ==========================================================================
   js/iba-task-tidy.js — 17.0.0 patch 6
   Removes old rows from your own task list.
   When an invoice's Attention was changed (e.g. Santosh -> Asif) the row in
   the old person's list could stay behind, so the invoice kept showing in
   their count, Now brief and Dashboard. Saving now removes it (app.js); this
   cleans rows left from before.
   How: about 10 s after you log in, at most every 6 hours, each row in your
   own list is compared with the shared list (invoice_tasks_by_user/All). If
   the shared list names someone else for that invoice, your row is removed.
   Only small rows are read; the invoices themselves are never changed.
   ========================================================================== */
(function () {
    'use strict';

    const EVERY = 6 * 3600000;
    const KEY = 'iba-task-tidy-at-v1:';
    const safe = (v) => String(v || '').replace(/[.#$[\]\/\\]/g, '_').replace(/\s+/g, '_');
    const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? String(currentApprover.Name).trim() : ''; } catch (_) { return ''; } }
    function idb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    function mentions(att, name) {
        try { if (typeof wdActiveTaskAttentionMentionsName === 'function') return wdActiveTaskAttentionMentionsName(att, name); } catch (_) {}
        const a = norm(att), n = norm(name);
        return !!a && !!n && (a === n || a.split(/\s*(?:,|;|\/|&|\band\b)\s*/).indexOf(n) !== -1);
    }

    async function tidy(force) {
        const name = me();
        const d = idb();
        if (!name || !d || name === 'All') return { checked: 0, removed: 0 };
        const memo = KEY + safe(name);
        let last = 0;
        try { last = Number(localStorage.getItem(memo) || 0); } catch (_) {}
        if (!force && Date.now() - last < EVERY) return { checked: 0, removed: 0, skipped: true };
        try { localStorage.setItem(memo, String(Date.now())); } catch (_) {}

        const snap = await d.ref('invoice_tasks_by_user/' + safe(name)).once('value');
        const rows = (snap && snap.val()) || {};
        const keys = Object.keys(rows);
        let removed = 0;
        for (let i = 0; i < keys.length; i += 10) {
            const part = keys.slice(i, i + 10);
            await Promise.all(part.map(async (k) => {
                try {
                    const s = await d.ref('invoice_tasks_by_user/All/' + k + '/attention').once('value');
                    if (!s.exists()) return; // not in the shared list: leave it to Active Task's own check
                    const now = String(s.val() || '').trim();
                    if (now && mentions(now, name)) return;
                    await d.ref('invoice_tasks_by_user/' + safe(name) + '/' + k).remove();
                    removed++;
                } catch (_) { /* leave the row */ }
            }));
        }
        if (removed) console.info('[IBA task tidy] removed ' + removed + ' old row(s) from your task list.');
        return { checked: keys.length, removed: removed };
    }

    function start() {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            if (me() && idb()) { clearInterval(t); tidy(false).catch(() => {}); }
            else if (tries > 60) clearInterval(t);
        }, 10000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    window.ibaTaskTidy = tidy;
})();
