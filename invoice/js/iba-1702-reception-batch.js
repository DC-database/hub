/* ==========================================================================
   js/iba-1702-reception-batch.js — 17.0.2
   "New entries to Batch": every reception New Entry (WorkDesk job, for =
   Invoice) waiting for the user goes into Batch Entry as a new invoice:
   PO, invoice no., amount, invoice date and group from the reception entry,
   next invoice number on the PO (INV-02, INV-03 ...), status Under Review,
   and the +Del archive button when the original PO is in the file.
   Every box stays editable. Nothing is saved until the user presses Save;
   then each reception entry is closed as "Converted to Invoice" and linked
   to its new invoice, the same way Invoice Entry does it (app.js
   imBatchSaveRun calls prepare() and convert()).
   POs not in POVALUE2.csv yet are left out and listed.
   Patch 7: several entries on one PO are all added (INV-02, INV-03 ...).
   ========================================================================== */
(function () {
    'use strict';

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const me = () => { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) || 'System'; } catch (_) { return 'System'; } };
    const body = () => document.getElementById('im-batch-table-body');
    const cards = () => Array.from((body() || document).querySelectorAll('.batch-invoice-card'));

    function css() {
        if (document.getElementById('iba-1702-rb-css')) return;
        const st = document.createElement('style');
        st.id = 'iba-1702-rb-css';
        st.textContent = [
            '.batch-invoice-card .iba-rb-tag{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#feb088;color:#14293f;font-size:.68rem;font-weight:800;vertical-align:middle}',
            '.batch-invoice-card .iba-rb-del{display:inline-flex;align-items:center;gap:5px;margin-left:8px;height:22px;padding:0 9px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;font-size:.7rem;font-weight:800;cursor:pointer;vertical-align:middle}',
            '.batch-invoice-card .iba-rb-del i{color:#facc15}',
            '.batch-invoice-card .iba-rb-del.is-added{background:#059669}',
            '.batch-invoice-card .iba-rb-del.is-added i{color:#fff}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // "2026-10-20", "20-10-2026", "20/10/2026", "20-Oct-2026" -> "2026-10-20" ('' if unknown)
    function isoDate(v) {
        const s = String(v || '').trim();
        if (!s) return '';
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
        m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
        if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
        const t = Date.parse(s);
        if (isNaN(t)) return '';
        const d = new Date(t);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function group(v) {
        try { if (typeof imNormalizeInvoiceGroupValue === 'function') return imNormalizeInvoiceGroupValue(v || 'Normal'); } catch (_) {}
        return String(v || 'Normal');
    }
    function poData(po) {
        try { return (typeof allPOData !== 'undefined' && allPOData && allPOData[po] && Object.keys(allPOData[po]).length) ? allPOData[po] : null; } catch (_) { return null; }
    }

    // the reception New Entries in the user's Invoice Entry side panel
    async function jobs() {
        if (typeof fetchInvoiceEntrySidePanelJobs !== 'function') throw new Error('The reception list is not available on this page.');
        const list = await fetchInvoiceEntrySidePanelJobs(true);
        return (list || []).filter((j) => j && j.key && j.source === 'job_entry');
    }

    // original PO in the archive (same indexed lookup as Invoice Entry)
    async function inArchive(po) {
        try {
            if (typeof progressDb === 'undefined' || !progressDb) return false;
            const n = String(po).replace(/[^0-9]/g, '');
            if (!n) return false;
            const ref = progressDb.ref('records');
            let s = await ref.orderByChild('PO').equalTo(n).once('value');
            if (!s.exists()) s = await ref.orderByChild('PO').equalTo(parseInt(n, 10)).once('value');
            // 17.0.5 patch 38: only Status "Active" = the original is in the file
            return s.exists() && (window.ibaPoFile ? !!window.ibaPoFile.activeOf(s.val()) : true);
        } catch (_) { return false; }
    }
    function addArchiveButton(card, po) {
        const head = card.querySelector('.batch-card-header [title="PO Number"] > div:last-child') || card.querySelector('.batch-card-header [title="PO Number"]');
        if (!head || card.querySelector('.iba-rb-del')) return;
        const b = document.createElement('button');
        b.type = 'button';
        // im-po-collect-btn: imAddToDeletionCollection marks it "Added to List"
        b.className = 'iba-rb-del im-po-collect-btn';
        head.appendChild(b);
        if (typeof imResetPOFileActionButton === 'function') imResetPOFileActionButton(b, po, false);
        else b.onclick = () => window.imAddToDeletionCollection && window.imAddToDeletionCollection(po);
        b.innerHTML = '<i class="fa-solid fa-folder-open"></i> +Del';
        b.title = 'Original PO is in the file: add it to the deletion list';
    }

    function setVal(card, name, v) {
        const el = card.querySelector('[name="' + name + '"]');
        if (el && v !== undefined && v !== null && String(v).trim() !== '') el.value = String(v).trim();
    }

    // one reception entry -> one new Batch Entry card
    async function addJob(job) {
        const po = String(job.po || '').trim().toUpperCase();
        if (!po) return { ok: false, reason: 'No PO on the reception entry' };
        if (cards().some((c) => c.dataset.jobKey === job.key)) return { ok: false, already: true, reason: 'Already in Batch Entry' };
        if (!poData(po)) return { ok: false, missing: true, reason: 'Not in POVALUE2.csv yet' };
        const input = document.getElementById('im-batch-po-input');
        if (!input || typeof handleAddPOToBatch !== 'function') return { ok: false, reason: 'Batch Entry is not available on this page' };

        // 17.0.2 patch 7: several reception entries on one PO each get their own
        // new card. Batch Entry allows one new card per PO, so the ones already
        // there are hidden from that check for a moment; Save gives each its
        // own next free Inv Entry ID.
        const sameNew = cards().filter((c) => c.getAttribute('data-po') === po && !c.getAttribute('data-key'));
        sameNew.forEach((c) => c.setAttribute('data-key', '__iba_rb_tmp'));
        input.value = po;
        const said = [];
        const realAlert = window.alert;
        window.alert = (m) => { said.push(String(m || '')); };
        try { await handleAddPOToBatch(); } finally {
            window.alert = realAlert;
            sameNew.forEach((c) => { if (c.getAttribute('data-key') === '__iba_rb_tmp') c.removeAttribute('data-key'); });
        }
        const card = cards().filter((c) => c.getAttribute('data-po') === po && !c.getAttribute('data-key') && !c.dataset.jobKey).pop();
        if (!card) return { ok: false, reason: said[0] || 'Could not be added' };
        if (sameNew.length) {
            const num = (c) => parseInt(String(c.getAttribute('data-next-invid') || '').replace(/\D+/g, ''), 10) || 0;
            const next = Math.max(num(card), ...sameNew.map(num)) + (sameNew.some((c) => num(c) >= num(card)) ? 1 : 0);
            card.setAttribute('data-next-invid', 'INV-' + String(next).padStart(2, '0'));
        }

        const g = group(job.group || job.category);
        card.dataset.jobKey = job.key;
        card.dataset.jobDate = String(job.date || job.dateEntered || '');
        card.dataset.jobTs = String(Number(job.timestamp) || '');
        card.dataset.jobBy = String(job.enteredBy || '');
        card.setAttribute('data-group', g);
        card.setAttribute('data-invoice-group', g);

        setVal(card, 'invNumber', job.ref);
        setVal(card, 'invValue', job.amount);
        setVal(card, 'amountPaid', job.amount);
        setVal(card, 'invoiceDate', isoDate(job.invoiceDate || job.date));

        const st = card.querySelector('select[name="status"]');
        if (st) {
            st.value = 'Under Review';
            // no change event: that would open the person picker for every row
            if (typeof window.imBatchApplyAutoAttentionForRow === 'function') { try { await window.imBatchApplyAutoAttentionForRow(card, 'Under Review', { allowPicker: false }); } catch (_) {} }
            try { if (typeof updateBatchRowAttentionButton === 'function') updateBatchRowAttentionButton(card); } catch (_) {}
        }

        const invId = card.getAttribute('data-next-invid') || '';
        const newTag = card.querySelector('.batch-card-header [title="PO Number"] span');
        if (newTag) newTag.textContent = '(New' + (invId ? ' · ' + invId : '') + ')';
        const tagHost = card.querySelector('.batch-card-header [title="PO Number"] > div:last-child');
        if (tagHost && !tagHost.querySelector('.iba-rb-tag')) {
            const t = document.createElement('span');
            t.className = 'iba-rb-tag';
            t.textContent = 'Reception';
            t.title = 'From reception' + (job.enteredBy ? ' (' + job.enteredBy + ')' : '') + (job.date ? ', ' + job.date : '') + '. Saving closes the reception entry as Converted to Invoice.';
            tagHost.appendChild(t);
        }
        inArchive(po).then((yes) => { if (yes && card.isConnected) addArchiveButton(card, po); });
        return { ok: true, invId: invId };
    }

    async function run(openBatch) {
        css();
        const list = await jobs();
        const out = { total: list.length, added: [], skipped: [] };
        if (!list.length) return out;
        if (typeof ensureInvoicePOBaseDataFetched === 'function') { try { await ensureInvoicePOBaseDataFetched(false); } catch (_) {} }
        // one fresh POVALUE2.csv read when any PO is missing (not one per PO)
        if (list.some((j) => j.po && !poData(String(j.po).trim().toUpperCase())) && typeof refreshPOVALUE2CsvNow === 'function') {
            try { await refreshPOVALUE2CsvNow('reception-to-batch'); } catch (_) {}
        }
        if (openBatch && !(await openBatch())) throw new Error('Batch Entry could not be opened.');
        await wait(100);
        for (const j of list) {
            const row = { po: String(j.po || '').trim().toUpperCase() || '—', invoice_no: j.ref || '', amount: j.amount || '', by: j.enteredBy || '', date: j.date || '' };
            let r;
            try { r = await addJob(j); } catch (e) { r = { ok: false, reason: (e && e.message) || 'Could not be added' }; }
            if (r.ok) out.added.push(Object.assign(row, { inv: r.invId }));
            else out.skipped.push(Object.assign(row, { reason: r.reason }));
        }
        try { if (typeof updateBatchCount === 'function') updateBatchCount(); } catch (_) {}
        return out;
    }

    // ---- Batch save (app.js imBatchSaveRun, new invoice rows) ----
    // before the invoice is written: link it to the reception entry + carry
    // the reception history line, as Invoice Entry does
    function prepare(row, inv) {
        const k = row && row.dataset && row.dataset.jobKey;
        if (!k || !inv) return null;
        const ts = Number(row.dataset.jobTs) || 0;
        const date = row.dataset.jobDate || '';
        inv.linkedJobEntryKey = k;
        if (ts) { inv.originTimestamp = ts; inv.jobRecordTimestamp = ts; }
        inv.originDateEntered = date;
        inv.jobRecordDateEntered = date;
        inv.dateEntered = date;
        inv.originEnteredBy = row.dataset.jobBy || '';
        inv.originType = 'Job Entry';
        inv.group = inv.group || row.getAttribute('data-group') || 'Normal';
        inv.history = Object.assign({}, inv.history || {}, {
            imported_0: { status: 'Job Created (WorkDesk)', updatedBy: 'Reception', timestamp: ts || Date.parse(date) || (Date.now() - 2000), note: 'Carried over from WorkDesk' }
        });
        return k;
    }

    // after the invoice is written: close the reception entry
    function convert(jobKey, po, newKey, inv) {
        if (!jobKey || typeof db === 'undefined' || !db) return Promise.resolve();
        const TS = firebase.database.ServerValue.TIMESTAMP;
        const today = (typeof getTodayDateString === 'function') ? getTodayDateString() : new Date().toISOString().slice(0, 10);
        const updates = {
            for: 'Invoice', remarks: 'Converted to Invoice', status: 'Completed',
            convertedToInvoice: true, convertedFromFor: 'Invoice', archived: true,
            linkedInvoiceKey: newKey, linkedInvoicePO: po,
            invoiceWorkflowStatus: inv.status || '', linkedInvoiceStatus: inv.status || '',
            invoiceConvertedFrom: 'Job Entry', invoiceConvertedBy: me(), invoiceConvertedAt: TS,
            dateResponded: (typeof formatDate === 'function') ? formatDate(new Date()) : today,
            releaseDate: today, statusChangedAt: TS, statusQueueAt: TS,
            updatedAt: TS, updatedBy: me()
        };
        const saves = [db.ref('job_entries/' + jobKey).update(updates)];
        saves.push(db.ref('job_entries/' + jobKey + '/history').push({
            action: 'Converted to Invoice', by: me(), timestamp: TS,
            note: 'Converted Job Entry to Invoice Entry ' + (inv.invEntryID || newKey) + ' / PO ' + po + ' (Batch Entry).'
        }).then(null, (e) => console.warn('[IBA reception batch] history line not saved', e)));
        try {
            const local = (typeof allSystemEntries !== 'undefined' && Array.isArray(allSystemEntries)) ? allSystemEntries.find((e) => e && e.key === jobKey) : null;
            const localJob = Object.assign({}, local || {}, updates, { key: jobKey, source: 'job_entry', updatedAt: Date.now() });
            if (typeof wdUpsertLocalWorkdeskJobEntryCache === 'function') wdUpsertLocalWorkdeskJobEntryCache(jobKey, localJob);
            if (typeof wdWriteWorkdeskJobRecentMarker === 'function') saves.push(Promise.resolve(wdWriteWorkdeskJobRecentMarker(jobKey, localJob, 'updated')).catch(() => {}));
        } catch (_) {}
        return Promise.all(saves).then(() => {
            try { if (typeof imInvalidateActiveJobsSidebarCache === 'function') imInvalidateActiveJobsSidebarCache(); } catch (_) {}
        }, (e) => console.error('[IBA reception batch] reception entry not closed for ' + po, e));
    }

    window.ibaReceptionBatch = { run: run, prepare: prepare, convert: convert, isoDate: isoDate };
})();
