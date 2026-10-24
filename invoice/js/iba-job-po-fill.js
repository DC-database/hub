/* ==========================================================================
   js/iba-job-po-fill.js — 15.0.0 patch 45
   WorkDesk Job Entry: when a PO number is typed, the details POVALUE2.csv
   has for it are filled in (Site, and for Invoice jobs the Vendor Name and
   Vendor ID). Only empty fields are filled, so anything typed by hand stays.
   The PO value / Amount is never filled: the amount is the invoice's own.
   ========================================================================== */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let timer = null;
    let lastPO = '';

    function cleanPO(v) {
        const po = String(v == null ? '' : v).trim().toUpperCase().replace(/^PO[\s#:-]*/i, '');
        return /^[A-Z0-9_-]{1,30}$/.test(po) ? po : '';
    }
    function poRows() {
        try { if (typeof allPOData !== 'undefined' && allPOData) return allPOData; } catch (_) {}
        return null;
    }
    async function lookup(po) {
        let rows = poRows();
        if (!rows || !Object.keys(rows).length) {
            try { if (typeof ensureInvoicePOBaseDataFetched === 'function') await ensureInvoicePOBaseDataFetched(false); } catch (_) {}
            rows = poRows();
        }
        return rows ? (rows[po] || null) : null;
    }
    function pick(row, keys) {
        for (const k of keys) {
            const v = row && row[k];
            if (v != null && String(v).trim() && String(v).trim() !== 'N/A') return String(v).trim();
        }
        return '';
    }

    function hint(text, ok) {
        const po = $('job-po');
        if (!po) return;
        let el = $('iba-job-po-hint');
        if (!el) {
            el = document.createElement('small');
            el.id = 'iba-job-po-hint';
            el.style.cssText = 'display:block;margin-top:3px;font-size:11.5px;line-height:1.35;';
            po.insertAdjacentElement('afterend', el);
        }
        el.textContent = text || '';
        el.style.color = ok ? '#0F766E' : '#92400E';
        el.hidden = !text;
    }

    function siteValue() {
        const el = $('job-site');
        return el ? String(el.value || '').trim() : '';
    }
    function setSite(projectId) {
        const el = $('job-site');
        if (!el || !projectId || siteValue()) return false;
        const raw = String(projectId).trim();
        const cands = [raw, raw.split(' - ')[0].trim(), (raw.match(/\d+/) || [''])[0]].filter(Boolean);
        const options = Array.from(el.options).map((o) => o.value).filter(Boolean);
        let hit = '';
        for (const c of cands) {
            hit = options.find((v) => v === c) || options.find((v) => v.toLowerCase() === c.toLowerCase()) || '';
            if (hit) break;
        }
        if (!hit) return false;
        let done = false;
        try {
            if (typeof siteSelectChoices !== 'undefined' && siteSelectChoices && typeof siteSelectChoices.setChoiceByValue === 'function') {
                siteSelectChoices.setChoiceByValue(hit);
                done = true;
            }
        } catch (_) {}
        if (!done || el.value !== hit) el.value = hit;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }
    function setIfEmpty(id, value) {
        const el = $(id);
        if (!el || !value || String(el.value || '').trim()) return false;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }
    function isInvoiceJob() {
        const f = $('job-for');
        return !!(f && f.value === 'Invoice');
    }

    async function run(force) {
        const input = $('job-po');
        if (!input) return;
        const po = cleanPO(input.value);
        if (!po) { lastPO = ''; hint(''); return; }
        if (po === lastPO && !force) return;
        lastPO = po;
        const row = await lookup(po);
        if (cleanPO(input.value) !== po) return; // typed on meanwhile
        if (!row) { hint('PO ' + po + ' is not in POVALUE2: please fill the details by hand.', false); return; }
        const filled = [];
        if (setSite(pick(row, ['Project ID', 'Site', 'site']))) filled.push('Site');
        if (isInvoiceJob()) {
            if (setIfEmpty('job-vendor-name', pick(row, ['Supplier Name', 'Supplier Name:', 'Supplier', 'Vendor Name']))) filled.push('Vendor name');
            if (setIfEmpty('job-vendor-id', pick(row, ['Supplier ID', 'Vendor ID', 'vendor_id']))) filled.push('Vendor ID');
        }
        const vendor = pick(row, ['Supplier Name', 'Supplier Name:', 'Supplier', 'Vendor Name']);
        hint('PO ' + po + (vendor ? ' · ' + vendor : '') + (filled.length ? ' · filled from POVALUE2: ' + filled.join(', ') : ' · found in POVALUE2'), true);
    }
    function soon(force) {
        clearTimeout(timer);
        timer = setTimeout(() => { run(force).catch(() => {}); }, 450);
    }

    document.addEventListener('input', (e) => { if (e.target && e.target.id === 'job-po') soon(false); }, true);
    document.addEventListener('change', (e) => {
        const id = e.target && e.target.id;
        if (id === 'job-po') soon(false);
        // switching to Invoice opens the vendor fields: fill them now
        if (id === 'job-for' && $('job-po') && $('job-po').value) setTimeout(() => run(true).catch(() => {}), 200);
    }, true);

    // the hint is cleared when the form is reset or a record is opened
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('#add-job-button, #update-job-button, #delete-job-button, [data-wd-clear-form], .wd-clear-btn')) {
            lastPO = '';
            setTimeout(() => hint(''), 300);
        }
    }, true);

    window.ibaJobPOFill = run;
})();
