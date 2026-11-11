/* 17.0.5 patch 202 (martin): Batch Entry > Search PO finds no invoices for the PO ->
   button "Not in records yet - add as new invoice". It closes the search window and runs the
   normal "+ New PO" step for that PO (same code as typing the PO and pressing New PO):
   - site / vendor come from POVALUE2; a PO that is not there goes to the PO file (progress-po)
     and, if missing there too, the existing "Add PO" form opens (Super Admin)
   - the new card can take any status; Save fills the invoice name (Site-PO-InvID-Vendor). */
(function () {
    'use strict';
    if (window.ibaBatchNew) return;
    const $ = (id) => document.getElementById(id);

    function addBtn() {
        const box = $('im-batch-modal-results');
        if (!box) return;
        const empty = box.querySelector('.batch-modal-empty');
        if (!empty || box.querySelector('.iba-bn-wrap')) return;
        const po = String(($('im-batch-modal-po-input') || {}).value || '').trim().toUpperCase();
        if (!po) return;
        const w = document.createElement('div');
        w.className = 'iba-bn-wrap';
        w.innerHTML = '<button type="button" class="iba-bn-btn" data-bn-po=""><i class="fa-solid fa-plus"></i> Not in records yet - add as new invoice</button>' +
            '<small>Adds a new card for this PO to the batch. You can pick any status.</small>';
        w.querySelector('button').setAttribute('data-bn-po', po);
        empty.after(w);
    }

    async function addNew(po) {
        const input = $('im-batch-po-input');
        if (!input || typeof handleAddPOToBatch !== 'function') { alert('Batch Entry is not ready. Refresh the page and try again.'); return; }
        const modal = $('im-batch-search-modal');
        if (modal) modal.classList.add('hidden');
        const old = input.value;
        input.value = po;
        try { await handleAddPOToBatch(); }
        finally { if (input.value === po) input.value = old; }
        // bring the new card into view and put the cursor in its invoice no.
        setTimeout(() => {
            const cards = document.querySelectorAll('#im-batch-table-body .batch-invoice-card[data-po="' + po.replace(/"/g, '') + '"]:not([data-key])');
            const c = cards[cards.length - 1];
            if (!c) return;
            try { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
            const f = c.querySelector('input[name="invNumber"]'); if (f) f.focus();
        }, 250);
    }

    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-bn-po]');
        if (!b) return;
        e.preventDefault();
        addNew(b.getAttribute('data-bn-po'));
    });
    function start() {
        const box = $('im-batch-modal-results');
        if (box) new MutationObserver(addBtn).observe(box, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaBatchNew = { addNew };
})();
