/* ==========================================================================
   js/iba-status-options.js — 15.0.0 patch 45
   Status lists in Invoice Entry, Batch Entry and Invoice Records:
   - "For Approval", "Approved" and "Rejected" are always there.
   - "Other…" at the end lets you type a status that is not in the list.
     Typed statuses are kept in this browser and offered again next time
     (also in the status filters).
   ========================================================================== */
(function () {
    'use strict';

    const OTHER = '__iba_other__';
    const CUSTOM_KEY = 'iba-custom-statuses-v1';
    const ADD = ['For Approval', 'Approved', 'Rejected'];
    // lists you set a status with (they get "Other…")
    const EDIT_SEL = '#im-status, #im-batch-global-status, #summary-note-status-input, select[name="status"].batch-input';
    // lists you filter by (no "Other…")
    const FILTER_SEL = '#im-reporting-status-filter, #im-mobile-status-filter, #im-mobile-inline-status-filter';

    function customList() {
        try {
            const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
            return Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()) : [];
        } catch (_) { return []; }
    }
    function saveCustom(name) {
        const list = customList();
        if (list.some((s) => s.toLowerCase() === name.toLowerCase())) return;
        list.push(name);
        try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.slice(-30))); } catch (_) {}
    }

    function has(sel, value) {
        const low = String(value).toLowerCase();
        return Array.from(sel.options).some((o) => String(o.value).toLowerCase() === low);
    }
    function opt(value, text) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = text || value;
        return o;
    }

    function fill(sel, withOther) {
        // after CEO Approval when the list has it, else before the end
        const anchor = Array.from(sel.options).find((o) => o.value === 'CEO Approval');
        let after = anchor || null;
        ADD.forEach((s) => {
            if (has(sel, s)) return;
            const o = opt(s);
            o.setAttribute('data-iba-p45', '1');
            if (after) { after.after(o); after = o; } else sel.appendChild(o);
        });
        const other = sel.querySelector('option[value="' + OTHER + '"]');
        customList().forEach((s) => {
            if (has(sel, s)) return;
            const o = opt(s);
            o.setAttribute('data-iba-custom', '1');
            if (other) sel.insertBefore(o, other); else sel.appendChild(o);
        });
        if (withOther && !other) sel.appendChild(opt(OTHER, 'Other… (type a status)'));
    }

    function fillAll() {
        document.querySelectorAll(EDIT_SEL).forEach((s) => { if (s.tagName === 'SELECT') fill(s, true); });
        document.querySelectorAll(FILTER_SEL).forEach((s) => { if (s.tagName === 'SELECT') fill(s, false); });
    }

    // remember the value before a change so a cancelled "Other…" can go back
    document.addEventListener('focusin', (e) => {
        const s = e.target;
        if (s && s.matches && s.matches(EDIT_SEL)) s.dataset.ibaPrev = s.value;
    }, true);

    document.addEventListener('change', (e) => {
        const s = e.target;
        if (!s || !s.matches || !s.matches(EDIT_SEL) || s.value !== OTHER) {
            if (s && s.matches && s.matches(EDIT_SEL)) s.dataset.ibaPrev = s.value;
            return;
        }
        // the app's own handlers must not see "__iba_other__"
        e.stopImmediatePropagation();
        const prev = s.dataset.ibaPrev || '';
        const typed = String(window.prompt('Type the status to use:', '') || '').replace(/\s+/g, ' ').trim();
        if (!typed || typed === OTHER) {
            s.value = has(s, prev) && prev !== OTHER ? prev : (s.options[0] ? s.options[0].value : '');
            return;
        }
        const known = Array.from(s.options).find((o) => String(o.value).toLowerCase() === typed.toLowerCase() && o.value !== OTHER);
        const value = known ? known.value : typed;
        if (!known) saveCustom(typed);
        fillAll();
        s.value = value;
        s.dataset.ibaPrev = value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
    }, true);

    let queued = false;
    function queue() {
        if (queued) return;
        queued = true;
        setTimeout(() => { queued = false; fillAll(); }, 120);
    }

    function start() {
        fillAll();
        try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    window.ibaStatusOptionsRefresh = fillAll;
})();
