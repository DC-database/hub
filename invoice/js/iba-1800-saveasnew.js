/* 18.0.0 patch 92 (martin): Invoice Entry "Save as new".
   Shown next to Update only while an already-saved invoice is open (edit mode). Update still corrects that
   invoice; "Save as new" leaves it untouched and adds a NEW invoice on the same PO with what is on the form:
   - next Inv Entry ID (INV-02...) picked by the normal Add (handleAddInvoice re-reads the PO)
   - the Inv No. you typed is kept (the normal duplicate check still stops a number already on the PO)
   - Invoice file name, SRV file name and Report are cleared (Add fills the usual auto invoice name)
   - status Under Review
   If the Add does not go through, the form is put back exactly as it was, so Update still works. */
(function () {
    'use strict';
    if (window.ibaSaveAsNew) return;
    const $ = (id) => document.getElementById(id);
    let busy = false;

    function editingKey() { try { return (typeof currentlyEditingInvoiceKey !== 'undefined' && currentlyEditingInvoiceKey) || ''; } catch (_) { return ''; } }
    function po() { try { return (typeof currentPO !== 'undefined' && currentPO) || ''; } catch (_) { return ''; } }
    function keysOf(p) { try { return Object.keys((allInvoiceData && allInvoiceData[p]) || {}); } catch (_) { return []; } }

    function paint() {
        const upd = $('im-update-invoice-button');
        let btn = $('iba-save-as-new-btn');
        if (!upd) return;
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button'; btn.id = 'iba-save-as-new-btn'; btn.className = 'secondary-btn hidden';
            btn.title = 'Keep this invoice as it is and save the form as a NEW invoice on this PO (next INV number, no file names, Under Review)';
            btn.innerHTML = '<i class="fa-solid fa-copy"></i> Save as new';
            btn.addEventListener('click', run);
        }
        if (btn.previousElementSibling !== upd) upd.insertAdjacentElement('afterend', btn);
        const show = !upd.classList.contains('hidden') && !!editingKey();
        btn.classList.toggle('hidden', !show);
        btn.disabled = busy;
    }

    function field(name) { const f = $('im-new-invoice-form'); return f ? f.querySelector('[name="' + name + '"]') : null; }
    function setVal(el, v) {
        if (!el) return;
        el.value = v;
        try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    }

    async function run(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const oldKey = editingKey(), P = po();
        if (busy || !oldKey || !P || typeof handleAddInvoice !== 'function') return;
        const entry = (field('invEntryID') || {}).value || 'this invoice';
        if (!confirm('Save as a NEW invoice on PO ' + P + '?\n\n' + entry + ' stays exactly as it is.\nThe new one gets the next INV number, keeps the Inv No. on the form, has no Invoice / SRV / Report file names, and starts as Under Review.')) return;

        const names = ['invEntryID', 'invName', 'srvName', 'reportName', 'status'];
        const before = {}; names.forEach((n) => { const el = field(n); before[n] = el ? el.value : null; });
        let jobBefore = null; try { jobBefore = jobEntryToUpdateAfterInvoice; jobEntryToUpdateAfterInvoice = null; } catch (_) {}
        const had = new Set(keysOf(P));

        setVal(field('invEntryID'), '');
        setVal(field('invName'), '');
        setVal(field('srvName'), '');
        setVal(field('reportName'), '');
        const st = field('status');
        if (st) {
            if (st.tagName === 'SELECT' && !Array.from(st.options).some((o) => o.value === 'Under Review')) { const o = document.createElement('option'); o.value = o.textContent = 'Under Review'; st.appendChild(o); }
            setVal(st, 'Under Review');
        }

        busy = true; paint();
        let newKey = '';
        try {
            await handleAddInvoice();
            newKey = keysOf(P).find((k) => !had.has(k)) || '';
        } catch (err) { console.warn('Save as new failed', err); }
        busy = false;

        if (newKey) {
            try {
                await invoiceDb.ref('invoice_entries/' + P + '/' + newKey).update({ copiedFromKey: oldKey, copiedFromEntry: before.invEntryID || '' });
                if (typeof window.logInvoiceHistory === 'function') await window.logInvoiceHistory(P, newKey, 'Under Review', 'Saved as new from ' + (before.invEntryID || 'another invoice'));
            } catch (_) {}
            try { if (typeof resetInvoiceForm === 'function' && editingKey()) resetInvoiceForm(); } catch (_) {}
        } else {
            // not saved (missing field, duplicate Inv No., no connection...): put the form back for Update
            names.forEach((n) => { if (before[n] != null) setVal(field(n), before[n]); });
            try { if (jobBefore) jobEntryToUpdateAfterInvoice = jobBefore; } catch (_) {}
        }
        paint();
    }

    setInterval(paint, 800);
    window.ibaSaveAsNew = { run, paint };
})();
