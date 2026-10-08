/* ========================================================================
   js/app-approval-print.js — IBA approval print button (Invoice Records)
   Version 14.0.0-p8

   14.0.0 patch 5:
   - The approve / reject dialog and the daily approval code
     (approval_sequences) are gone. Decisions are made by the one approval
     routine in js/iba-approvals.js, which gives each approval its own ESN.
   - This file only adds the Print button to Invoice Records rows that have
     an approval decision. The print shows every approval of the invoice
     with its ESN. Older decisions made with a daily code still print with
     that code.

   14.0.0 patch 8:
   - Watches only the Invoice Management area (not the whole page) and
     checks the rows at most once per frame. Same buttons, less work.
   ======================================================================== */
(function () {
    'use strict';

    const MODULE_VERSION = '14.0.0-p8';
    const FINAL_STATUSES = new Set(['Approved', 'Rejected']);

    function printButtonForRow(row) {
        if (row.querySelector('.iba-approval-print-btn')) return;
        const po = row.getAttribute('data-po-number');
        const key = row.getAttribute('data-invoice-key');
        if (!po || !key || typeof allInvoiceData === 'undefined') return;
        const inv = allInvoiceData?.[po]?.[key];
        if (!inv) return;
        const hasDecision = !!(inv.approvalDecision && (inv.approvalDecision.esn || inv.approvalDecision.code));
        const hasEsn = !!inv.esn;
        if (!(hasDecision || (hasEsn && FINAL_STATUSES.has(String(inv.status || '').trim())))) return;
        const actions = row.querySelector('td.actions .modern-action-group');
        if (!actions) return;
        const rejected = String(inv.status || '').trim() === 'Rejected';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `iba-approval-print-btn ${rejected ? 'is-rejected' : 'is-approved'}`;
        btn.title = 'Print the approval (ESN)';
        btn.innerHTML = '<i class="fa-solid fa-print"></i>';
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (window.ibaApprovals && typeof window.ibaApprovals.printStamp === 'function') {
                window.ibaApprovals.printStamp(po, key, inv);
            }
        });
        actions.appendChild(btn);
    }

    function installInvoiceRecordsPrintButtons() {
        const scan = () => document.querySelectorAll('#invoice-management-view tr.nested-invoice-row').forEach(printButtonForRow);
        let frame = 0;
        const scanSoon = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => { frame = 0; scan(); });
        };
        scan();
        const root = document.getElementById('invoice-management-view') || document.body;
        const observer = new MutationObserver(scanSoon);
        observer.observe(root, { childList: true, subtree: true });
        window.addEventListener('iba:approval-decision-saved', scan);
    }

    function boot() {
        installInvoiceRecordsPrintButtons();
        console.info(`%cIBA Approval Print ${MODULE_VERSION} loaded`, 'color:#198754;font-weight:800');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
