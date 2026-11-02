/* ==========================================================================
   js/iba-1705-money.js — 17.0.5 patch 67
   Invoice Value / Amount Paid always SHOWN with thousands commas
   (100,000.00) in Invoice Entry and on every Batch Entry card.
   Display only: every save already strips the commas
   (app.js: invoiceData.invValue.replace(/,/g, '') and the Batch save),
   so Firebase keeps exactly what it stored before (100000.00).
   - Values the system puts in (open invoice, new card, "to Paid", retention
     0.00, assistant fill) are shown with commas at once.
   - While typing, commas appear live and the cursor stays in place.
   ========================================================================== */
(function () {
    'use strict';

    const IDS = ['im-inv-value', 'im-amount-paid'];
    const NAMES = ['invValue', 'amountPaid'];
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    function isMoney(el) {
        if (!el || el.tagName !== 'INPUT') return false;
        if (IDS.indexOf(el.id) !== -1) return true;
        return NAMES.indexOf(el.name) !== -1 && !!el.closest('.batch-invoice-card, #im-batch-table-body');
    }
    const numLike = (raw) => /^-?\d*\.?\d*$/.test(raw) && /\d/.test(raw);

    // while typing: commas in the whole part, decimals left as typed
    function typed(s) {
        const raw = String(s).replace(/,/g, '');
        if (!numLike(raw)) return String(s);
        const neg = raw.charAt(0) === '-';
        const body = neg ? raw.slice(1) : raw;
        const dot = body.indexOf('.');
        const whole = dot === -1 ? body : body.slice(0, dot);
        const dec = dot === -1 ? '' : body.slice(dot);
        const w = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return (neg ? '-' : '') + w + dec;
    }
    // finished value: 100,000.00
    function full(s) {
        const str = String(s == null ? '' : s).trim();
        const raw = str.replace(/,/g, '');
        if (!numLike(raw)) return str;
        const n = parseFloat(raw);
        return isNaN(n) ? str : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // any value the system sets is shown with commas
    function wrap(el) {
        if (!el || el.__ibaMoney || !desc) return;
        el.__ibaMoney = true;
        Object.defineProperty(el, 'value', {
            configurable: true,
            get() { return desc.get.call(this); },
            set(v) { desc.set.call(this, document.activeElement === this ? typed(v == null ? '' : v) : full(v)); }
        });
        const cur = desc.get.call(el);
        if (cur) desc.set.call(el, document.activeElement === el ? typed(cur) : full(cur));
    }
    function wrapAll(root) {
        IDS.forEach((id) => wrap(document.getElementById(id)));
        (root || document).querySelectorAll('.batch-invoice-card input[name="invValue"], .batch-invoice-card input[name="amountPaid"]').forEach(wrap);
    }

    // typing: live commas, cursor kept after the same digit
    document.addEventListener('input', (e) => {
        const el = e.target;
        if (!e.isTrusted || !isMoney(el)) return;
        wrap(el);
        const old = desc.get.call(el);
        const pos = el.selectionStart == null ? old.length : el.selectionStart;
        const digitsBefore = old.slice(0, pos).replace(/[^\d.-]/g, '').length;
        const now = typed(old);
        if (now === old) return;
        desc.set.call(el, now);
        let i = 0, seen = 0;
        while (i < now.length && seen < digitsBefore) { if (/[\d.-]/.test(now[i])) seen++; i++; }
        try { el.setSelectionRange(i, i); } catch (_) {}
    }, true);

    // leaving the box: 100,000.00
    document.addEventListener('blur', (e) => {
        const el = e.target;
        if (isMoney(el)) { const v = desc.get.call(el); if (v) desc.set.call(el, full(v)); }
    }, true);

    // the old focus helper removed the commas while editing: keep them, just select
    const origClean = window.cleanCurrencyField;
    window.cleanCurrencyField = function (input) {
        if (isMoney(input)) { try { input.select(); } catch (_) {} return; }
        if (typeof origClean === 'function') return origClean.apply(this, arguments);
    };

    function start() {
        wrapAll();
        const body = document.getElementById('im-batch-table-body');
        if (body) new MutationObserver(() => wrapAll(body)).observe(body, { childList: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaMoney = { full: full, typed: typed };
})();
