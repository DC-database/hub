/* ==========================================================================
   js/iba-1705-batchval.js — 17.0.5 patch 56
   Batch Entry cards:
   1) Invoice No. with the word "Retention" -> Invoice Value becomes 0.00
      (same rule as Invoice Entry; Amount Paid is left alone). Save applies
      it too (app.js imBatchSaveRun).
   2) Small "Copy ↓ Paid" button on the Invoice Value label copies the
      invoice value into Amount Paid.
   ========================================================================== */
(function () {
    'use strict';
    const isRet = (v) => /\bretention\b/i.test(String(v || '').trim());
    function card(el) { return el && el.closest && el.closest('.batch-invoice-card'); }
    function field(c, n) { return c ? c.querySelector('[name="' + n + '"]') : null; }

    function applyRetention(c) {
        const no = field(c, 'invNumber'), val = field(c, 'invValue');
        if (!no || !val || !isRet(no.value)) return;
        if (val.value !== '0.00') { val.value = '0.00'; val.dispatchEvent(new Event('input', { bubbles: true })); }
        val.dataset.retentionAutoZero = '1';
    }
    function addButtons(root) {
        (root || document).querySelectorAll('.batch-invoice-card [name="invValue"]').forEach((inp) => {
            const box = inp.parentElement, lab = box && box.querySelector('label');
            if (!lab || lab.querySelector('.iba-bv-copy')) return;
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'iba-bv-copy';
            b.title = 'Copy the Invoice Value into Amount Paid';
            b.innerHTML = '<i class="fa-regular fa-copy"></i> to Paid';
            lab.classList.add('iba-bv-lab');
            lab.appendChild(b);
        });
    }
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.iba-bv-copy');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        const c = card(b), val = field(c, 'invValue'), paid = field(c, 'amountPaid');
        if (!val || !paid) return;
        paid.value = val.value;
        paid.dispatchEvent(new Event('input', { bubbles: true }));
        paid.dispatchEvent(new Event('change', { bubbles: true }));
        b.classList.add('is-done');
        setTimeout(() => b.classList.remove('is-done'), 900);
    }, true);
    const onNo = (e) => { const t = e.target; if (t && t.name === 'invNumber' && card(t)) applyRetention(card(t)); };
    document.addEventListener('input', onNo, true);
    document.addEventListener('change', onNo, true);

    // new cards: only watch the batch list itself (child cards added / removed)
    function start() {
        const body = document.getElementById('im-batch-table-body');
        if (!body) return;
        addButtons(body);
        new MutationObserver(() => { addButtons(body); body.querySelectorAll('.batch-invoice-card').forEach(applyRetention); }).observe(body, { childList: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
