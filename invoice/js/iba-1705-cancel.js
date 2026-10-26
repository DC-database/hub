/* ==========================================================================
   iba-1705-cancel.js — 17.0.5 patch 5
   Cancel a job entry (Job Entry / reception jobs such as IPC Application
   sent to the site QS). A red "Cancel" button:
   - Active Task (PC): on every job-entry row, next to Process (the list only
     holds the user's own tasks).
   - Job Records: on open rows for the Super Admin, the person the job is
     addressed to, and the person who entered it.
   It asks for an optional reason, then saves: status (remarks) "Cancelled",
   attention none, dateResponded today, cancelledBy/At/Reason, Current Note
   "Cancelled: <reason>", and a history line. The job then leaves Active
   Task and stays in Job Records as Cancelled.
   Watches only the two table bodies (no body-wide observer).
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaJobCancel) return;

    const DONE = /^(cancel+ed|closed|paid|converted to invoice)$/i;

    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? String(currentApprover.Name).trim() : ''; } catch (_) { return ''; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function same(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() && !!String(a || '').trim(); }
    function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

    function findEntry(key) {
        const lists = [];
        try { if (Array.isArray(userActiveTasks)) lists.push(userActiveTasks); } catch (_) {}
        try { if (Array.isArray(allSystemEntries)) lists.push(allSystemEntries); } catch (_) {}
        try { if (Array.isArray(workdeskSystemEntries)) lists.push(workdeskSystemEntries); } catch (_) {}
        for (const l of lists) { const e = l.find((x) => x && String(x.key || '') === String(key)); if (e) return e; }
        return null;
    }
    function isJob(e) { return !!e && (e.source === 'job_entry' || (!e.source && e.for && !e.originalPO)); }
    function isOpen(e) { return !DONE.test(String(e.remarks || e.status || '').trim()); }

    function btnHtml(key) {
        return '<button type="button" class="wd-row-action iba-job-cancel-btn" data-cancel-key="' + esc(key) + '" title="Cancel this job (optional reason)"><i class="fa-solid fa-ban"></i> Cancel</button>';
    }

    // ---- buttons ---------------------------------------------------------
    function paintActive() {
        const body = document.getElementById('active-task-table-body');
        if (!body) return;
        body.querySelectorAll('tr[data-key]').forEach((tr) => {
            if (tr.querySelector('.iba-job-cancel-btn')) return;
            const e = findEntry(tr.getAttribute('data-key'));
            if (!isJob(e) || !isOpen(e)) return;
            const cell = tr.lastElementChild;
            if (!cell || !cell.querySelector('.modify-btn, .wd-row-action')) return;
            cell.insertAdjacentHTML('beforeend', btnHtml(e.key));
        });
    }
    function paintRecords() {
        const body = document.getElementById('reporting-table-body');
        const table = document.getElementById('job-records-table');
        if (!body || !table || !table.contains(body)) return;
        const name = me(), sup = isSuper();
        body.querySelectorAll('tr[data-key] .wd-record-status-cell').forEach((cell) => {
            if (cell.querySelector('.iba-job-cancel-btn')) return;
            const e = findEntry(cell.closest('tr').getAttribute('data-key'));
            if (!e || !isOpen(e)) return;
            if (!(sup || same(e.attention, name) || same(e.enteredBy, name))) return;
            const del = cell.querySelector('.iba-jr-del');
            if (del) del.insertAdjacentHTML('beforebegin', btnHtml(e.key));
            else cell.insertAdjacentHTML('beforeend', btnHtml(e.key));
        });
    }
    function paint() { try { paintActive(); } catch (_) {} try { paintRecords(); } catch (_) {} }

    // ---- the pop-up --------------------------------------------------------
    function ask(e) {
        return new Promise((resolve) => {
            const old = document.getElementById('iba-job-cancel-pop');
            if (old) old.remove();
            const what = [e.for || 'Job', e.ref, e.po ? 'PO ' + e.po : '', e.site ? 'Site ' + e.site : '', e.vendorName].filter(Boolean).join(' · ');
            const wrap = document.createElement('div');
            wrap.id = 'iba-job-cancel-pop';
            wrap.innerHTML =
                '<div class="iba-jc-box" role="dialog" aria-modal="true" aria-labelledby="iba-jc-t">' +
                '<h3 id="iba-jc-t"><i class="fa-solid fa-ban"></i> Cancel this job?</h3>' +
                '<p class="iba-jc-what">' + esc(what) + '</p>' +
                '<p class="iba-jc-sub">Status becomes <b>Cancelled</b> and Attention <b>None</b>. It leaves Active Task and stays in Job Records.</p>' +
                '<label for="iba-jc-why">Reason (optional)</label>' +
                '<textarea id="iba-jc-why" rows="3" maxlength="300" placeholder="e.g. sent by mistake, duplicate, already done"></textarea>' +
                '<div class="iba-jc-acts"><button type="button" class="iba-jc-back">Back</button><button type="button" class="iba-jc-go"><i class="fa-solid fa-ban"></i> Cancel job</button></div>' +
                '</div>';
            document.body.appendChild(wrap);
            const ta = wrap.querySelector('textarea');
            setTimeout(() => ta.focus(), 30);
            const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
            const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); done(null); } };
            document.addEventListener('keydown', onKey, true);
            wrap.addEventListener('click', (ev) => {
                if (ev.target === wrap || ev.target.closest('.iba-jc-back')) done(null);
                else if (ev.target.closest('.iba-jc-go')) done(String(ta.value || '').replace(/\s+/g, ' ').trim());
            });
        });
    }

    // ---- save --------------------------------------------------------------
    async function cancelJob(btn) {
        const key = btn.getAttribute('data-cancel-key');
        const d = mainDb();
        if (!key || !d) return;
        let entry = findEntry(key);
        try {
            const s = await d.ref('job_entries/' + key).once('value');
            if (s.exists()) entry = Object.assign({}, entry || {}, s.val() || {}, { key: key, source: 'job_entry' });
        } catch (_) {}
        if (!entry) { alert('This job could not be found. Please refresh.'); return; }
        if (!isOpen(entry)) { alert('This job is already ' + (entry.remarks || entry.status) + '.'); return; }
        const name = me();
        const onMyList = !!btn.closest('#active-task-table-body');
        if (!(onMyList || isSuper() || same(entry.attention, name) || same(entry.enteredBy, name))) { alert('Only the person this job is addressed to, the person who entered it, or the Super Admin can cancel it.'); return; }

        const reason = await ask(entry);
        if (reason === null) return;

        const by = name || 'System';
        const note = 'Cancelled' + (reason ? ': ' + reason : '');
        const updates = {
            remarks: 'Cancelled',
            status: 'Cancelled',
            attention: '',
            dateResponded: today(),
            note: note,
            cancelledBy: by,
            cancelledAt: Date.now(),
            cancelReason: reason || '',
            cancelledFromAttention: entry.attention || '',
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            updatedBy: by
        };
        const hist = {
            action: 'Cancelled',
            by: by,
            timestamp: Date.now(),
            status: 'Cancelled',
            note: note + (entry.attention ? ' | was with: ' + entry.attention : '') + ' | Attention: None'
        };
        btn.disabled = true;
        try {
            await Promise.all([d.ref('job_entries/' + key).update(updates), d.ref('job_entries/' + key + '/history').push(hist)]);
            const local = Object.assign({}, entry, updates, { updatedAt: Date.now(), key: key, source: 'job_entry' });
            try { if (typeof wdUpsertLocalWorkdeskJobEntryCache === 'function') wdUpsertLocalWorkdeskJobEntryCache(key, local); } catch (_) {}
            try { if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await wdWriteWorkdeskJobRecentMarker(key, local, 'updated'); } catch (_) {}
            [findEntry(key)].forEach((e) => { if (e) Object.assign(e, updates, { updatedAt: Date.now() }); });

            // Active Task: the job is no longer anyone's task
            try {
                if (Array.isArray(userActiveTasks)) { const i = userActiveTasks.findIndex((t) => t && t.key === key); if (i > -1) userActiveTasks.splice(i, 1); }
            } catch (_) {}
            const atRow = document.querySelector('#active-task-table-body tr[data-key="' + CSS.escape(key) + '"]');
            if (atRow) atRow.remove();
            // Job Records: show it as Cancelled right away
            const jrRow = document.querySelector('#reporting-table-body tr[data-key="' + CSS.escape(key) + '"]');
            if (jrRow) {
                const cell = jrRow.querySelector('.wd-record-status-cell');
                const badge = (typeof wdUiStatusBadge === 'function') ? wdUiStatusBadge('Cancelled') : 'Cancelled';
                if (cell) { cell.querySelectorAll('.iba-job-cancel-btn').forEach((b) => b.remove()); const first = cell.firstElementChild; if (first && !first.matches('button')) first.outerHTML = badge; }
                const att = jrRow.querySelector('.wd-attention-chip'); if (att) att.textContent = '';
                const nt = jrRow.querySelector('.wd-record-note-cell'); if (nt) { nt.textContent = note; nt.title = note; }
            }
            try {
                sessionStorage.removeItem('IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V1');
                localStorage.removeItem('IBA_WD_ACTIVE_DASHBOARD_CACHE_V1');
                if (typeof wdClearWorkdeskDashboardCache === 'function') wdClearWorkdeskDashboardCache();
            } catch (_) {}
            setTimeout(() => {
                try { if (typeof populateWorkdeskDashboard === 'function') Promise.resolve(populateWorkdeskDashboard(false)).catch(() => {}); } catch (_) {}
            }, 50);
            if (typeof window.ibaToast === 'function') window.ibaToast('Job cancelled.');
        } catch (err) {
            btn.disabled = false;
            console.error('Job cancel failed:', err);
            alert('Could not cancel this job: ' + ((err && err.message) || err));
        }
    }

    document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('.iba-job-cancel-btn') : null;
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        cancelJob(b);
    }, true);

    // ---- watch the two tables ---------------------------------------------
    let t = 0;
    function soon() { clearTimeout(t); t = setTimeout(paint, 60); }
    const watched = {};
    function watch(id) {
        const el = document.getElementById(id);
        if (!el || watched[id] === el) return;
        watched[id] = el;
        new MutationObserver(soon).observe(el, { childList: true });
        soon();
    }
    function hook() { watch('active-task-table-body'); watch('reporting-table-body'); }
    hook();
    document.addEventListener('DOMContentLoaded', hook);
    document.addEventListener('click', () => setTimeout(hook, 400), true);

    window.ibaJobCancel = { paint: paint };
})();
