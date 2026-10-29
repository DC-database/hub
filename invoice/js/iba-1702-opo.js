/* ==========================================================================
   js/iba-1702-opo.js — 17.0.2 patch 12
   Original PO (paper PO out for revision) and the PO archive.
   1) PO file check (Invoice Entry "PO Record"): when the PO is not in the
      archive, the open "Original PO" job records are checked too. If the
      PO is there, it shows "Under revision · <attention>" instead of
      "No PO file found".
   2) WorkDesk Job Records > Original PO tab: a PO that is back in the
      archive gets a green "Back in file" mark, so it can be removed.
   3) Job Records (Super Admin): a tick box on every row and a bar with
      "Select back in file" (Original PO tab), "Select all" and
      "Delete selected". Same delete steps as the row trash button
      (js/iba-17-p13.js): record removed, "deleted" change marker written,
      local copies cleaned.
   Reads only: the archive by PO (indexed, one PO at a time) and the
   Original PO job records (saved Job Records copy, else one indexed read).
   ========================================================================== */
(function () {
    'use strict';
    const OPO = 'Original PO';
    const ARCHIVE_TTL = 10 * 60 * 1000;
    const JOBS_TTL = 5 * 60 * 1000;
    const archive = new Map();       // po -> { found, at, p }
    let opoJobs = null, opoJobsAt = 0, opoJobsP = null;

    const normPO = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function progDb() { try { return (typeof progressDb !== 'undefined' && progressDb && progressDb.ref) ? progressDb : null; } catch (_) { return null; } }
    function isClosed(e) { return /completed|closed|cancelled|canceled|done|resolved|returned/i.test(String((e && (e.remarks || e.status)) || '')); }

    // ---- archive: is the original PO in the file? -------------------------
    function inArchive(po) {
        const p = normPO(po);
        if (!p) return Promise.resolve(false);
        const c = archive.get(p);
        if (c && (c.p || Date.now() - c.at < ARCHIVE_TTL)) return c.p || Promise.resolve(c.found);
        const d = progDb();
        if (!d) return Promise.resolve(false);
        const ref = d.ref('records');
        const run = (async () => {
            let s = await ref.orderByChild('PO').equalTo(p).once('value');
            if (!s.exists()) s = await ref.orderByChild('PO').equalTo(parseInt(p, 10)).once('value');
            // 17.0.5 patch 38: only Status "Active" = the original is in the file
            return s.exists() && (window.ibaPoFile ? !!window.ibaPoFile.activeOf(s.val()) : true);
        })().then((found) => { archive.set(p, { found: found, at: Date.now() }); return found; },
            () => { archive.delete(p); return false; });
        archive.set(p, { found: false, at: 0, p: run });
        return run;
    }

    // ---- open Original PO job records -------------------------------------
    function loadOpoJobs(force) {
        if (!force && opoJobs && Date.now() - opoJobsAt < JOBS_TTL) return Promise.resolve(opoJobs);
        if (opoJobsP) return opoJobsP;
        opoJobsP = (async () => {
            let raw = null;
            try { if (typeof window.ibaJobsFromPocketWhere === 'function') raw = await window.ibaJobsFromPocketWhere((v) => !!v && v.for === OPO); } catch (_) { raw = null; }
            if (!raw) {
                const d = mainDb();
                if (!d) return [];
                const s = await d.ref('job_entries').orderByChild('for').equalTo(OPO).once('value');
                raw = (s && s.val()) || {};
            }
            opoJobs = Object.keys(raw).map((k) => Object.assign({}, raw[k], { key: k }));
            opoJobsAt = Date.now();
            return opoJobs;
        })().catch(() => opoJobs || []).finally(() => { opoJobsP = null; });
        return opoJobsP;
    }
    async function openRevision(po) {
        const p = normPO(po);
        if (!p) return null;
        const list = await loadOpoJobs(false);
        return list.find((e) => normPO(e.po) === p && !isClosed(e)) || null;
    }

    // ---- 1) PO file check: "Under revision" --------------------------------
    function wrapFileCheck() {
        const orig = window.imRunPOFileCheckInBackground;
        if (typeof orig !== 'function' || orig.__ibaOpo) return typeof orig === 'function';
        const wrapped = function (poNumber) {
            const out = orig.apply(this, arguments);
            afterFileCheck(normPO(poNumber));
            return out;
        };
        wrapped.__ibaOpo = true;
        window.imRunPOFileCheckInBackground = wrapped;
        return true;
    }
    function afterFileCheck(p) {
        if (!p) return;
        const started = Date.now();
        const tick = () => {
            const el = document.querySelector('#im-modal-po-details .im-po-record, .im-po-record');
            if (!el || normPO(el.dataset.poCheckFor) !== p) return;
            const state = el.dataset.poFileState;
            if (state === 'checking') { if (Date.now() - started < 30000) setTimeout(tick, 400); return; }
            if (state !== 'none') return;
            const runId = el.dataset.poCheckRunId;
            openRevision(p).then((job) => {
                if (!job || normPO(el.dataset.poCheckFor) !== p || el.dataset.poCheckRunId !== runId || el.dataset.poFileState !== 'none') return;
                el.className = 'im-po-record im-po-record-status im-po-record-status-revision';
                el.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> <span>Under revision' + (job.attention ? ' · ' + esc(job.attention) : '') + '</span>';
                el.title = 'Original PO is out for revision (Job Records > Original PO' + (job.date ? ', since ' + job.date : '') + ')';
                el.dataset.poFileState = 'revision';
            });
        };
        setTimeout(tick, 300);
    }

    // ---- 2) + 3) Job Records ----------------------------------------------
    function recordsTable() {
        const body = document.getElementById('reporting-table-body');
        const table = document.getElementById('job-records-table');
        if (!body || !table || !table.contains(body)) return null;
        if (document.body.classList.contains('inventory-mode')) return null;
        return { body: body, table: table };
    }
    function currentTab() { try { return String((typeof currentReportFilter !== 'undefined' && currentReportFilter) || ''); } catch (_) { return ''; } }
    function rows(body) { return Array.from(body.querySelectorAll('tr[data-key]')); }

    function markReturned(body) {
        rows(body).forEach((tr) => {
            if (tr.dataset.ibaOpo) return;
            const kick = tr.querySelector('.wd-table-kicker');
            const isOpo = currentTab() === OPO || (kick && /original po/i.test(kick.textContent || ''));
            if (!isOpo) return;
            const cell = tr.querySelector('.wd-po-code');
            const p = normPO(cell && cell.textContent);
            if (!p) return;
            tr.dataset.ibaOpo = 'checking';
            inArchive(p).then((found) => {
                if (!tr.isConnected) return;
                tr.dataset.ibaOpo = found ? 'back' : 'out';
                if (!found || tr.querySelector('.iba-opo-back')) return;
                tr.classList.add('iba-opo-row-back');
                const b = document.createElement('span');
                b.className = 'iba-opo-back';
                b.title = 'This original PO is back in your PO archive: it can be removed from here';
                b.innerHTML = '<i class="fa-solid fa-circle-check"></i> Back in file';
                cell.insertAdjacentElement('afterend', b);
                updateBar();
            });
        });
    }

    function addTicks(body) {
        rows(body).forEach((tr) => {
            if (tr.querySelector('.iba-jr-tick')) return;
            // in the PO cell: the Job column is hidden when the side panel is pinned
            const po = tr.querySelector('.wd-po-code');
            const first = (po && po.closest('td')) || tr.querySelector('td');
            if (!first) return;
            const c = document.createElement('input');
            c.type = 'checkbox';
            c.className = 'iba-jr-tick';
            c.title = 'Select for delete';
            c.setAttribute('aria-label', 'Select this job record');
            first.insertBefore(c, first.firstChild);
        });
    }

    function ensureBar(table) {
        let bar = document.getElementById('iba-jr-bulk');
        const wrap = table.closest('.table-wrapper') || table;
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'iba-jr-bulk';
            bar.className = 'iba-jr-bulk';
            bar.innerHTML =
                '<span class="iba-jr-bulk-n" data-n>0 selected</span>' +
                '<button type="button" data-sel="back"><i class="fa-solid fa-circle-check"></i> Select back in file</button>' +
                '<button type="button" data-sel="all"><i class="fa-solid fa-check-double"></i> Select all</button>' +
                '<button type="button" data-sel="none" title="Clear the ticks"><i class="fa-solid fa-xmark"></i> Clear</button>' +
                '<button type="button" class="is-danger" data-bulk-del disabled><i class="fa-solid fa-trash-can"></i> Delete selected</button>';
        }
        // on the tab line, right side (same grid cell as the folder tabs)
        const folder = document.getElementById('wd-jr-folder');
        if (folder && folder.parentNode && !folder.classList.contains('hidden')) {
            if (folder.nextElementSibling !== bar) folder.insertAdjacentElement('afterend', bar);
            bar.classList.add('is-on-tabs');
        } else {
            if (bar.nextElementSibling !== wrap) wrap.parentNode.insertBefore(bar, wrap);
            bar.classList.remove('is-on-tabs');
        }
        return bar;
    }
    function selected() {
        const t = recordsTable();
        return t ? rows(t.body).filter((tr) => { const c = tr.querySelector('.iba-jr-tick'); return c && c.checked; }) : [];
    }
    function updateBar() {
        const bar = document.getElementById('iba-jr-bulk');
        if (!bar) return;
        const n = selected().length;
        bar.querySelector('[data-n]').textContent = n + ' selected';
        const del = bar.querySelector('[data-bulk-del]');
        del.disabled = !n;
        del.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete selected' + (n ? ' (' + n + ')' : '');
        const t = recordsTable();
        const back = t ? rows(t.body).filter((tr) => tr.dataset.ibaOpo === 'back').length : 0;
        const sb = bar.querySelector('[data-sel="back"]');
        sb.hidden = currentTab() !== OPO;
        sb.innerHTML = '<i class="fa-solid fa-circle-check"></i> Select back in file (' + back + ')';
        sb.disabled = !back;
        rows(t ? t.body : document.createElement('tbody')).forEach((tr) => {
            const c = tr.querySelector('.iba-jr-tick');
            tr.classList.toggle('iba-jr-picked', !!(c && c.checked));
        });
    }

    function findEntry(key) {
        const lists = [];
        try { if (Array.isArray(allSystemEntries)) lists.push(allSystemEntries); } catch (_) {}
        try { if (Array.isArray(workdeskSystemEntries)) lists.push(workdeskSystemEntries); } catch (_) {}
        for (const l of lists) { const e = l.find((x) => x && String(x.key || '') === String(key)); if (e) return e; }
        return null;
    }
    async function bulkDelete(btn) {
        if (!isSuper()) { alert('Only the Super Admin can delete job records.'); return; }
        const d = mainDb();
        const picked = selected();
        if (!d || !picked.length) return;
        const lines = picked.slice(0, 12).map((tr) => {
            const e = findEntry(tr.getAttribute('data-key')) || {};
            return '• ' + [e.for || 'Job', e.po ? 'PO ' + e.po : '', e.vendorName, e.attention ? 'with ' + e.attention : ''].filter(Boolean).join(' · ');
        });
        if (picked.length > 12) lines.push('… and ' + (picked.length - 12) + ' more');
        if (!confirm('Delete ' + picked.length + ' job record' + (picked.length === 1 ? '' : 's') + ' permanently?\n\n' + lines.join('\n') + '\n\nThis cannot be undone.')) return;
        btn.disabled = true;
        let ok = 0;
        const failed = [];
        for (const tr of picked) {
            const key = tr.getAttribute('data-key');
            if (!key) continue;
            const e = findEntry(key) || {};
            try {
                await d.ref('job_entries/' + key).remove();
                try { if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await wdWriteWorkdeskJobRecentMarker(key, e, 'deleted'); } catch (_) {}
                try { if (typeof wdRemoveLocalWorkdeskJobEntryCache === 'function') wdRemoveLocalWorkdeskJobEntryCache(key); } catch (_) {}
                tr.remove();
                ok++;
            } catch (err) {
                failed.push((e.po ? 'PO ' + e.po : key) + ': ' + ((err && err.message) || err));
            }
        }
        try { if (typeof wdClearWorkdeskDashboardCache === 'function') wdClearWorkdeskDashboardCache(); } catch (_) {}
        opoJobs = null;
        const c = document.getElementById('job-records-count-display');
        if (c) { const m = c.textContent.match(/(\d+)/); if (m) c.textContent = '(Total Records: ' + Math.max(0, Number(m[1]) - ok) + ')'; }
        try { if (typeof populateActiveTasks === 'function') populateActiveTasks(); } catch (_) {}
        updateBar();
        if (failed.length) alert(ok + ' deleted. These could not be deleted:\n\n' + failed.join('\n'));
        else if (typeof showToast === 'function') { try { showToast(ok + ' job record' + (ok === 1 ? '' : 's') + ' deleted', 'success'); } catch (_) {} }
    }

    document.addEventListener('change', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('iba-jr-tick')) updateBar();
    }, true);
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.classList && t.classList.contains('iba-jr-tick')) { e.stopPropagation(); return; } // the row click opens the job
        const sel = t.closest('#iba-jr-bulk [data-sel]');
        const del = t.closest('#iba-jr-bulk [data-bulk-del]');
        if (!sel && !del) return;
        e.preventDefault();
        e.stopPropagation();
        if (del) { bulkDelete(del); return; }
        const tb = recordsTable();
        if (!tb) return;
        const mode = sel.getAttribute('data-sel');
        rows(tb.body).forEach((tr) => {
            const c = tr.querySelector('.iba-jr-tick');
            if (!c) return;
            c.checked = mode === 'all' ? true : mode === 'none' ? false : (tr.dataset.ibaOpo === 'back' || c.checked);
        });
        updateBar();
    }, true);

    function paint() {
        wrapFileCheck();
        const t = recordsTable();
        const bar = document.getElementById('iba-jr-bulk');
        if (!t) { if (bar) bar.hidden = true; return; }
        markReturned(t.body);
        if (isSuper() && rows(t.body).length) {
            addTicks(t.body);
            ensureBar(t.table).hidden = false;
            updateBar();
        } else if (bar) bar.hidden = true;
    }
    let queued = false;
    function queue() { if (queued) return; queued = true; setTimeout(() => { queued = false; paint(); }, 200); }
    function start() {
        paint();
        try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    window.ibaOriginalPO = { inArchive: inArchive, openRevision: openRevision, refresh: () => { archive.clear(); opoJobs = null; paint(); } };
})();
