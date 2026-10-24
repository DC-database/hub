/* ==========================================================================
   js/iba-17-p13.js — 17.0.0 patch 13
   Job Records (WorkDesk): a Delete button on each row for the Super Admin,
   next to the History button. No need to open the record in the job window
   first. Same steps as the Delete in that window (app.js handleDeleteJobEntry):
   the record is removed, a "deleted" change marker is written so other
   browsers drop it too, and the local copies are cleaned. The row then leaves
   the table without downloading the job list again.
   ========================================================================== */
(function () {
    'use strict';

    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function findEntry(key) {
        const lists = [];
        try { if (Array.isArray(allSystemEntries)) lists.push(allSystemEntries); } catch (_) {}
        try { if (Array.isArray(workdeskSystemEntries)) lists.push(workdeskSystemEntries); } catch (_) {}
        for (const l of lists) { const e = l.find((x) => x && String(x.key || '') === String(key)); if (e) return e; }
        return null;
    }

    function addButtons() {
        const body = document.getElementById('reporting-table-body');
        const table = document.getElementById('job-records-table');
        if (!body || !table || !table.contains(body) || !isSuper()) return;
        body.querySelectorAll('tr[data-key] .wd-record-status-cell').forEach((cell) => {
            if (cell.querySelector('.iba-jr-del')) return;
            const tr = cell.closest('tr');
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'action-btn wd-row-action iba-jr-del';
            b.title = 'Delete this job record (Super Admin)';
            b.setAttribute('aria-label', 'Delete this job record');
            b.setAttribute('data-key', tr.getAttribute('data-key') || '');
            b.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            cell.appendChild(b);
        });
    }

    async function del(btn) {
        const key = btn.getAttribute('data-key');
        const d = mainDb();
        if (!key || !d) return;
        if (!isSuper()) { alert('Only the Super Admin can delete job records here.'); return; }
        let entry = findEntry(key);
        if (!entry) {
            try { const s = await d.ref('job_entries/' + key).once('value'); if (s.exists()) entry = Object.assign({}, s.val() || {}, { key: key }); } catch (_) {}
        }
        const e = entry || {};
        const what = [e.for || 'Job', e.ref, e.po ? 'PO ' + e.po : '', e.vendorName, e.amount ? 'QAR ' + e.amount : '', e.remarks].filter(Boolean).join(' · ');
        if (!confirm('Delete this job record permanently?\n\n' + (what || key) + '\n\nThis cannot be undone.')) return;
        btn.disabled = true;
        try {
            await d.ref('job_entries/' + key).remove();
            try { if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await wdWriteWorkdeskJobRecentMarker(key, e, 'deleted'); } catch (_) {}
            try { if (typeof wdRemoveLocalWorkdeskJobEntryCache === 'function') wdRemoveLocalWorkdeskJobEntryCache(key); } catch (_) {}
            try { if (typeof wdClearWorkdeskDashboardCache === 'function') wdClearWorkdeskDashboardCache(); } catch (_) {}
            const tr = btn.closest('tr');
            if (tr) tr.remove();
            const c = document.getElementById('job-records-count-display');
            if (c) { const m = c.textContent.match(/(\d+)/); if (m) c.textContent = '(Total Records: ' + Math.max(0, Number(m[1]) - 1) + ')'; }
            try { if (typeof populateActiveTasks === 'function') populateActiveTasks(); } catch (_) {}
        } catch (err) {
            btn.disabled = false;
            console.error('Job record delete failed:', err);
            alert('Could not delete this job record: ' + ((err && err.message) || err));
        }
    }

    document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('.iba-jr-del') : null;
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        del(b);
    }, true);

    let queued = false;
    function queue() { if (queued) return; queued = true; setTimeout(() => { queued = false; addButtons(); }, 150); }
    function start() {
        addButtons();
        try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
