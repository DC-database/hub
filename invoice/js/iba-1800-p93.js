/* 18.0.0 patch 93 (martin): small helpers used by the review fixes.
   1. window.ibaInvoiceToBin(po, key, fallback): before an invoice is deleted, a full copy goes to
      invoice db recycle_bin/invoice/<po>~<key> (Recycle Bin, Invoice tab: Restore / Delete forever).
      Throws when the copy cannot be saved, so the caller stops before deleting.
   2. Batch Entry: a row marked red (incomplete) loses its mark as soon as you type in it.
   3. window.ibaSameInvoice(po, data, exceptKey): an invoice already on the PO with the same value AND the same
      invoice date (but another Inv No.), e.g. "101" and "INV101" typed for one paper invoice
      (numbers the duplicate check already treats as equal, like "A-101" / "A101", are left to that check). */
(function () {
    'use strict';
    function me() { try { return (currentApprover && currentApprover.Name) || ''; } catch (_) { return ''; } }
    function idb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb) ? invoiceDb : null; } catch (_) { return null; } }

    window.ibaInvoiceToBin = async function (po, key, fallback) {
        const d = idb(); if (!d) throw new Error('no connection to the invoice database');
        let item = null;
        try { item = (await d.ref('invoice_entries/' + po + '/' + key).once('value')).val(); } catch (_) {}
        if (!item && fallback) item = Object.assign({}, fallback);
        if (!item) throw new Error('the invoice could not be read');
        delete item.key;
        await d.ref('recycle_bin/invoice/' + String(po).replace(/[.#$\[\]\/]/g, '_') + '~' + key).set({
            kind: 'invoice', po: String(po), key: String(key), item: item,
            invEntryID: item.invEntryID || '', invNumber: item.invNumber || '', invValue: item.invValue || '',
            status: item.status || '', vendor: item.vendorName || item.vendor_name || '',
            deletedBy: me(), deletedAt: firebase.database.ServerValue.TIMESTAMP
        });
        return true;
    };

    document.addEventListener('input', function (e) {
        const row = e.target && e.target.closest && e.target.closest('.batch-invoice-card.iba-bt-bad');
        if (row) { row.classList.remove('iba-bt-bad'); row.removeAttribute('data-bt-bad'); }
    }, true);

    function num(v) { const n = parseFloat(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : NaN; }
    function day(v) { const s = String(v || '').trim(); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : s; }
    function normNo(v) { try { if (window.ibaReception && window.ibaReception.normNo) return window.ibaReception.normNo(v); } catch (_) {} return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
    window.ibaSameInvoice = function (invs, data, exceptKey) {
        const v = num(data.invValue), dt = day(data.invoiceDate), no = normNo(data.invNumber);
        if (!isFinite(v) || v === 0 || !dt) return null;
        for (const k of Object.keys(invs || {})) {
            if (k === exceptKey) continue;
            const x = invs[k]; if (!x) continue;
            if (num(x.invValue) === v && day(x.invoiceDate) === dt && normNo(x.invNumber) !== no) return Object.assign({ key: k }, x);
        }
        return null;
    };
})();
