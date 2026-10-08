/* ========================================================================
   js/app-approval-print.js — IBA For Approval workflow + print stamp
   Version 12.5.0

   Standalone module:
   - Does NOT modify app.js.
   - Owns the special For Approval action UI.
   - Owns approval/rejection sequence generation.
   - Owns compact A4 Site Approval printout.
   - Reuses the existing Firebase objects and JsBarcode library.
   ======================================================================== */
(function () {
    'use strict';

    const MODULE_VERSION = '12.5.0';
    const FINAL_STATUSES = new Set(['Approved', 'Rejected']);
    let activeTaskBeingProcessed = null;
    let approvalModal = null;
    let printRoot = null;

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function firstName(name) {
        const clean = String(name || '').trim();
        return (clean.split(/\s+/)[0] || 'USER').toUpperCase();
    }

    function ymdLocal(date) {
        const d = date || new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }

    function normalizeTaskStatus(task) {
        return String(task?.remarks || task?.status || '').trim();
    }

    function findTaskByKey(key) {
        try {
            if (Array.isArray(userActiveTasks)) {
                return userActiveTasks.find(t => String(t?.key || '') === String(key || '')) || null;
            }
        } catch (_) {}
        return null;
    }

    function getApproverName() {
        try { return String(currentApprover?.Name || 'User').trim() || 'User'; } catch (_) { return 'User'; }
    }

    function getSender(task) {
        return String(task?.enteredBy || task?.createdBy || 'Irwin').trim() || 'Irwin';
    }

    function ensureActionModal() {
        if (approvalModal) return approvalModal;
        approvalModal = document.createElement('div');
        approvalModal.id = 'iba-approval-action-modal';
        approvalModal.innerHTML = `
          <div class="iba-approval-dialog" role="dialog" aria-modal="true" aria-labelledby="iba-approval-title">
            <div class="iba-approval-head">
              <h3 id="iba-approval-title">For Approval</h3>
              <p id="iba-approval-subtitle">Review this item and choose the final action.</p>
            </div>
            <div class="iba-approval-body">
              <div class="iba-approval-meta" id="iba-approval-meta"></div>
              <label for="iba-approval-remarks">Remarks <span style="font-weight:600;color:#94a3b8;">(optional)</span></label>
              <textarea id="iba-approval-remarks" placeholder="Add an explanation or note if needed..."></textarea>
              <div class="iba-approval-actions">
                <button type="button" class="iba-approval-btn iba-approval-approve" data-approval-action="Approved">Approve</button>
                <button type="button" class="iba-approval-btn iba-approval-reject" data-approval-action="Rejected">Reject</button>
                <button type="button" class="iba-approval-btn iba-approval-hold" data-approval-action="On Hold">Hold</button>
              </div>
              <button type="button" class="iba-approval-cancel" data-approval-action="Cancel">Cancel</button>
            </div>
          </div>`;
        document.body.appendChild(approvalModal);

        approvalModal.addEventListener('click', async function (event) {
            const actionBtn = event.target.closest('[data-approval-action]');
            if (!actionBtn) {
                if (event.target === approvalModal) closeApprovalModal();
                return;
            }
            const action = actionBtn.getAttribute('data-approval-action');
            if (action === 'Cancel') { closeApprovalModal(); return; }
            await completeApprovalAction(action);
        });
        return approvalModal;
    }

    function openApprovalModal(task) {
        activeTaskBeingProcessed = task;
        const modal = ensureActionModal();
        const meta = modal.querySelector('#iba-approval-meta');
        const remarks = modal.querySelector('#iba-approval-remarks');
        const status = normalizeTaskStatus(task);
        if (remarks) remarks.value = '';
        if (meta) {
            meta.innerHTML = `
              <div class="iba-approval-meta-item"><small>PO No.</small><strong>${esc(task?.po || task?.originalPO || 'N/A')}</strong></div>
              <div class="iba-approval-meta-item"><small>Invoice</small><strong>${esc(task?.invName || task?.invNumber || task?.ref || 'N/A')}</strong></div>
              <div class="iba-approval-meta-item"><small>Vendor</small><strong>${esc(task?.vendorName || 'N/A')}</strong></div>
              <div class="iba-approval-meta-item"><small>Site</small><strong>${esc(task?.site || 'N/A')}</strong></div>`;
        }
        modal.querySelector('#iba-approval-title').textContent = status === 'For Approval' ? 'For Approval' : 'Approval Action';
        modal.classList.add('is-open');
        setTimeout(() => remarks?.focus(), 50);
    }

    function closeApprovalModal() {
        approvalModal?.classList.remove('is-open');
        activeTaskBeingProcessed = null;
    }

    async function nextApprovalSequence(dateKey) {
        let invoiceDatabase = null;
        try { invoiceDatabase = (typeof invoiceDb !== 'undefined') ? invoiceDb : window.invoiceDb; } catch (_) { invoiceDatabase = window.invoiceDb; }
        if (!invoiceDatabase || typeof invoiceDatabase.ref !== 'function') {
            throw new Error('Invoice database is not available.');
        }
        const ref = invoiceDatabase.ref(`approval_sequences/${dateKey}`);
        const result = await ref.transaction(current => (Number(current) || 0) + 1);
        const value = Number(result?.snapshot?.val() || 0);
        if (!value) throw new Error('Could not create a unique approval sequence.');
        return String(value).padStart(4, '0');
    }

    async function writeDecision(task, action, note) {
        const now = new Date();
        const dateKey = ymdLocal(now);
        const sequence = await nextApprovalSequence(dateKey);
        const code = `${dateKey}.${sequence}`;
        const approver = getApproverName();
        const actionWord = action === 'Approved' ? 'APPROVED' : 'REJECTED';
        const identity = `${actionWord}/${firstName(approver)}`;
        const timestamp = firebase.database.ServerValue.TIMESTAMP;
        const decision = {
            status: action,
            action: actionWord,
            name: approver,
            nameShort: firstName(approver),
            code,
            identity,
            date: dateKey,
            timestamp,
            remarks: String(note || '').trim()
        };

        const updates = {
            status: action,
            remarks: action,
            note: String(note || '').trim(),
            attention: getSender(task),
            dateResponded: (typeof formatDate === 'function') ? formatDate(now) : now.toLocaleDateString('en-GB'),
            last_approver: approver,
            releaseDate: (typeof getTodayDateString === 'function') ? getTodayDateString() : now.toISOString().slice(0, 10),
            statusChangedAt: timestamp,
            statusQueueAt: timestamp,
            approvalDecision: decision,
            approvalCode: code,
            approvalIdentity: identity,
            approvalBy: approver,
            approvalDate: dateKey
        };

        if (task.source === 'invoice') {
            const po = task.originalPO || task.po;
            const key = task.originalKey || task.key;
            let invoiceDatabase = null;
            try { invoiceDatabase = (typeof invoiceDb !== 'undefined') ? invoiceDb : window.invoiceDb; } catch (_) { invoiceDatabase = window.invoiceDb; }
            if (!po || !key || !invoiceDatabase) throw new Error('Invoice identifiers are missing.');
            await invoiceDatabase.ref(`invoice_entries/${po}/${key}`).update(updates);
            await invoiceDatabase.ref(`invoice_entries/${po}/${key}/history`).push({
                action,
                by: approver,
                timestamp,
                note: note || '',
                approvalCode: code,
                approvalIdentity: identity
            });
            const original = (typeof allInvoiceData !== 'undefined' && allInvoiceData?.[po]?.[key]) ? allInvoiceData[po][key] : {};
            const merged = { ...original, ...updates };
            if (typeof updateInvoiceTaskLookup === 'function') await updateInvoiceTaskLookup(po, key, merged, task.attention);
            if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(po, key, updates);
        } else if (task.source === 'job_entry') {
            let mainDatabase = null;
            try { mainDatabase = (typeof db !== 'undefined') ? db : window.db; } catch (_) { mainDatabase = window.db; }
            if (!mainDatabase) throw new Error('Main database is not available.');
            await mainDatabase.ref(`job_entries/${task.key}`).update(updates);
            await mainDatabase.ref(`job_entries/${task.key}/history`).push({
                action,
                by: approver,
                timestamp,
                note: note || '',
                approvalCode: code,
                approvalIdentity: identity
            });
        } else {
            throw new Error('Unsupported task source.');
        }

        return { ...decision, task: { ...task, ...updates } };
    }

    async function holdDecision(task, note) {
        const now = new Date();
        const updates = {
            status: 'On Hold',
            remarks: 'On Hold',
            note: String(note || '').trim(),
            statusChangedAt: firebase.database.ServerValue.TIMESTAMP,
            statusQueueAt: firebase.database.ServerValue.TIMESTAMP,
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            updatedBy: getApproverName()
        };
        if (task.source === 'invoice') {
            const po = task.originalPO || task.po;
            const key = task.originalKey || task.key;
            let invoiceDatabase = null;
            try { invoiceDatabase = (typeof invoiceDb !== 'undefined') ? invoiceDb : window.invoiceDb; } catch (_) { invoiceDatabase = window.invoiceDb; }
            await invoiceDatabase.ref(`invoice_entries/${po}/${key}`).update(updates);
            await invoiceDatabase.ref(`invoice_entries/${po}/${key}/history`).push({ action: 'On Hold', by: getApproverName(), timestamp: firebase.database.ServerValue.TIMESTAMP, note: note || '' });
            const original = (typeof allInvoiceData !== 'undefined' && allInvoiceData?.[po]?.[key]) ? allInvoiceData[po][key] : {};
            const merged = { ...original, ...updates };
            if (typeof updateInvoiceTaskLookup === 'function') await updateInvoiceTaskLookup(po, key, merged, task.attention);
            if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(po, key, updates);
        } else {
            let mainDatabase = null;
            try { mainDatabase = (typeof db !== 'undefined') ? db : window.db; } catch (_) { mainDatabase = window.db; }
            await mainDatabase.ref(`job_entries/${task.key}`).update(updates);
            await mainDatabase.ref(`job_entries/${task.key}/history`).push({ action: 'On Hold', by: getApproverName(), timestamp: firebase.database.ServerValue.TIMESTAMP, note: note || '' });
        }
    }

    async function completeApprovalAction(action) {
        if (!activeTaskBeingProcessed) return;
        const task = activeTaskBeingProcessed;
        const modal = ensureActionModal();
        const note = String(modal.querySelector('#iba-approval-remarks')?.value || '').trim();
        const buttons = [...modal.querySelectorAll('.iba-approval-btn')];
        buttons.forEach(b => b.disabled = true);
        try {
            if (action === 'On Hold') {
                await holdDecision(task, note);
                closeApprovalModal();
            } else {
                const result = await writeDecision(task, action, note);
                closeApprovalModal();
                // Keep the normal Active Task renderer responsible for removing the
                // completed item from the current personal queue.
                if (typeof populateActiveTasks === 'function') await populateActiveTasks(true);
                if (result?.task) {
                    try { window.dispatchEvent(new CustomEvent('iba:approval-decision-saved', { detail: result })); } catch (_) {}
                }
            }
            if (typeof populateActiveTasks === 'function') await populateActiveTasks(true);
        } catch (error) {
            console.error('[Approval Print] action failed:', error);
            alert(`Approval action failed: ${error.message || error}`);
        } finally {
            buttons.forEach(b => b.disabled = false);
        }
    }

    function installTaskActionInterceptor() {
        document.addEventListener('click', function (event) {
            const btn = event.target.closest('.modify-btn, .wd-action-approve, .wd-action-reject');
            if (!btn) return;
            const key = btn.getAttribute('data-key');
            const task = findTaskByKey(key);
            if (!task || normalizeTaskStatus(task) !== 'For Approval') return;
            // Only the user who currently owns Attention can process this special task.
            const owner = String(task.attention || '').trim().toLowerCase();
            const me = getApproverName().toLowerCase();
            if (owner && owner !== me) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            openApprovalModal(task);
        }, true);
    }

    // 12.6.2: Approval print no longer uses QR/barcode or external receipt links.
    function buildBarcodeSvg() { return ''; }


    function openApprovalPrint(data) {
        const approved = data.status === 'Approved';
        const statusClass = approved ? 'approved' : 'rejected';
        const stamp = approved ? 'APPROVED' : 'REJECTED';
        const identity = data.identity || `${stamp}/${firstName(data.name)}`;
        const code = data.code || '';

        if (!printRoot) {
            printRoot = document.createElement('div');
            printRoot.id = 'iba-approval-print-root';
            document.body.appendChild(printRoot);
        }
        printRoot.innerHTML = `
          <div class="iba-approval-print-toolbar">
            <strong>${esc(stamp)} — ${esc(code)}</strong>
            <span>
              <button type="button" class="print-now">Print A4</button>
              <button type="button" class="close-print">Close</button>
            </span>
          </div>
          <div class="iba-approval-print-page">
            <div class="iba-approval-stamp ${statusClass}">
              <div class="iba-approval-main">${esc(identity)}</div>
              <div class="iba-approval-code">${esc(code)}</div>
              <div class="iba-approval-date">${esc(new Date().toLocaleDateString('en-GB'))}</div>
            </div>
          </div>`;
        printRoot.classList.add('is-open');
        printRoot.querySelector('.print-now').onclick = () => window.print();
        printRoot.querySelector('.close-print').onclick = () => printRoot.classList.remove('is-open');
    }

    function printButtonForRow(row) {
        if (row.querySelector('.iba-approval-print-btn')) return;
        const po = row.getAttribute('data-po-number');
        const key = row.getAttribute('data-invoice-key');
        if (!po || !key || typeof allInvoiceData === 'undefined') return;
        const inv = allInvoiceData?.[po]?.[key];
        if (!inv || !FINAL_STATUSES.has(String(inv.status || '').trim()) || !inv.approvalDecision?.code) return;
        const actions = row.querySelector('td.actions .modern-action-group');
        if (!actions) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `iba-approval-print-btn ${inv.status === 'Approved' ? 'is-approved' : 'is-rejected'}`;
        btn.title = `Print ${inv.status} Site Approval`;
        btn.innerHTML = '<i class="fa-solid fa-print"></i>';
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            openApprovalPrint({ ...inv.approvalDecision, status: inv.status });
        });
        actions.appendChild(btn);
    }

    function installInvoiceRecordsPrintButtons() {
        const scan = () => document.querySelectorAll('#invoice-management-view tr.nested-invoice-row').forEach(printButtonForRow);
        scan();
        const observer = new MutationObserver(scan);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('iba:approval-decision-saved', scan);
    }

    // The status itself is already active in the existing WorkDesk task logic.
    // This module only replaces the action UI for the special For Approval case.
    function boot() {
        installTaskActionInterceptor();
        installInvoiceRecordsPrintButtons();
        console.info(`%cIBA Approval Print ${MODULE_VERSION} loaded`, 'color:#198754;font-weight:800');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
