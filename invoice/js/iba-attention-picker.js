/* ==========================================================================
   js/iba-attention-picker.js  —  14.0.0 patch 8
   Invoice Entry > Attention: type to find a name, and the name you pick is
   the name that is saved.

   Why: the 14.0.0 Attention box (js/app-invoice-entry-search.js) is a plain
   button with a scroll list. When Invoice Management is opened from the side
   menu, the real Attention field behind it has no names in it, so the name
   picked in the box never reached the field:
     - a new invoice asked "Please select an 'Attention' person" again;
     - an edited invoice was saved with an EMPTY Attention, so it left the
       person's Active Task (this is why "For Approval" to yourself did not
       show up), and simply editing a note could wipe the Attention.
   Also, when an invoice was opened for editing, the box could show a
   suggested name instead of the invoice's own Attention.

   What this file does (no change to the save routine, statuses or rules):
     - the box always shows what will really be saved;
     - picking a name writes it into the real field (adding it if missing);
     - an invoice opened for editing keeps its own Attention until you change
       its status; the automatic suggestions (None, COO, CEO, Accounts, SRV
       person) still apply when the status changes, exactly as before;
     - the list has a search line: type part of a name, position or site;
       arrow keys + Enter pick, Esc closes. Typing on the closed box opens it.
   ========================================================================== */
(function () {
    'use strict';

    const VERSION = '14.0.0-p8';
    const $ = (id) => document.getElementById(id);
    // Status the loaded invoice was saved with; while the form still shows that
    // status, its own Attention is kept (no automatic suggestion over it).
    let holdStatus = null;

    function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function choicesInst() {
        try { if (typeof imAttentionSelectChoices !== 'undefined' && imAttentionSelectChoices) return imAttentionSelectChoices; } catch (_) {}
        return window.imAttentionSelectChoices || null;
    }

    // Exactly what Add / Update will read (same order as app.js).
    function formValue() {
        let v = '';
        const c = choicesInst();
        try { if (c && typeof c.getValue === 'function') v = c.getValue(true) || ''; } catch (_) { v = ''; }
        if (Array.isArray(v)) v = v[0] || '';
        if (!v) {
            const s = $('im-attention');
            v = s ? s.value : '';
        }
        return String(v || '');
    }

    function ensureOption(select, value) {
        let opt = Array.prototype.find.call(select.options, (o) => o.value === value);
        if (!opt) {
            opt = document.createElement('option');
            opt.value = value;
            opt.textContent = value;
            select.appendChild(opt);
        }
        return opt;
    }

    // Put a name into the real Attention field (and its dropdown, when the
    // dropdown has been built).
    function writeAttention(value) {
        value = String(value || '').trim();
        const s = $('im-attention');
        if (!s) return;
        const c = choicesInst();
        if (!value) {
            if (c) { try { c.removeActiveItems(); } catch (_) {} }
            s.selectedIndex = -1;
            return;
        }
        if (c) {
            if (value === 'None' && typeof imClearAttentionToNone === 'function') {
                try { imClearAttentionToNone(c); } catch (_) {}
            } else {
                try { c.setChoiceByValue(value); } catch (_) {}
            }
            let got = '';
            try { got = c.getValue(true) || ''; } catch (_) {}
            if (got !== value) {
                try { c.setChoices([{ value: value, label: value === 'None' ? 'None (Clear Selection)' : value, selected: true }], 'value', 'label', false); } catch (_) {}
                try { c.setChoiceByValue(value); } catch (_) {}
            }
        }
        if (s.value !== value) {
            ensureOption(s, value);
            s.value = value;
        }
    }

    function namesState() {
        const st = window.ibaAttentionState;
        return (st && typeof st === 'object') ? st : { key: '', names: [], auto: '' };
    }

    function labelFor(value, names) {
        if (!value) return '';
        if (value === 'None') return 'None';
        const hit = (names || []).find((n) => n && n.value === value);
        return hit ? hit.label : value;
    }

    function currentStatus() {
        try { if (typeof ibaAttentionStatus === 'function') return ibaAttentionStatus(); } catch (_) {}
        const el = $('im-status');
        return el ? String(el.value || '').trim() : '';
    }

    function isNoneStatus(status) {
        try { if (typeof ibaNoneStatus === 'function') return ibaNoneStatus(status); } catch (_) {}
        return ['under review', 'for summary', 'with accounts', 'pending', 'report approved'].indexOf(norm(status)) !== -1;
    }

    function ensureBox() {
        const group = $('im-attention-group');
        if (!group) return null;
        const wrap = group.querySelector('.choices');
        if (wrap) wrap.style.setProperty('display', 'none', 'important');
        let box = $('iba-attention-visible');
        if (box && (box.tagName !== 'BUTTON' || !box.classList.contains('iba-attn-box'))) { box.remove(); box = null; }
        if (!box) {
            box = document.createElement('button');
            box.type = 'button';
            box.id = 'iba-attention-visible';
            box.className = 'iba-attn-box';
            box.setAttribute('aria-haspopup', 'listbox');
            box.innerHTML = '<span class="iba-attn-text"></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
            group.appendChild(box);
        }
        return box;
    }

    // Replaces ibaPaintAttentionBox (called by the 14.0.0 timer every 0.4 s
    // while Invoice Entry is open).
    function paintBox() {
        const source = $('im-attention');
        const box = ensureBox();
        if (!source || !box) return;
        const state = namesState();
        if (state.key && box.getAttribute('data-applied') !== state.key) {
            const keyStatus = norm(String(state.key).split('|')[0]);
            const domStatus = norm(currentStatus());
            if (keyStatus !== domStatus) {
                // the names were worked out for an older status: wait for the next tick
            } else {
                box.setAttribute('data-applied', state.key);
                if (holdStatus !== null && keyStatus === holdStatus) {
                    holdStatus = null; // keep the invoice's own Attention
                } else {
                    holdStatus = null;
                    let next = '';
                    if (isNoneStatus(currentStatus())) next = 'None';
                    else if (state.auto) next = state.auto;
                    else {
                        const saved = formValue();
                        if (saved && saved !== 'None' && saved !== 'Select attention') next = saved;
                    }
                    if (next !== formValue()) writeAttention(next);
                }
            }
        }
        const value = formValue();
        const text = value ? labelFor(value, state.names) : 'Select attention';
        const span = box.querySelector('.iba-attn-text');
        if (span && span.textContent !== text) span.textContent = text;
        box.classList.toggle('is-empty', !value);
        box.setAttribute('data-value', value);
        box.title = value ? text : 'Choose who this invoice goes to';
        const menu = $('iba-attention-menu');
        box.setAttribute('aria-expanded', menu ? 'true' : 'false');
    }

    // ------------------------------------------------------------------
    // The list with a search line
    // ------------------------------------------------------------------
    let menuNames = [];
    let activeIndex = -1;

    function closeMenu(focusBox) {
        const menu = $('iba-attention-menu');
        if (menu) menu.remove();
        window.removeEventListener('scroll', placeMenu, true);
        window.removeEventListener('resize', placeMenu);
        const box = $('iba-attention-visible');
        if (box) box.setAttribute('aria-expanded', 'false');
        if (focusBox && box) { try { box.focus({ preventScroll: true }); } catch (_) { box.focus(); } }
    }

    function placeMenu(e) {
        const menu = $('iba-attention-menu');
        const box = $('iba-attention-visible');
        if (!menu || !box) return;
        if (e && e.type === 'scroll' && e.target && menu.contains(e.target)) return;
        const r = box.getBoundingClientRect();
        if (!r.width) { closeMenu(false); return; }
        const width = Math.max(280, Math.round(r.width));
        const left = Math.min(Math.max(8, Math.round(r.left)), Math.max(8, window.innerWidth - width - 8));
        menu.style.width = width + 'px';
        menu.style.left = left + 'px';
        const spaceBelow = window.innerHeight - r.bottom - 12;
        const spaceAbove = r.top - 12;
        const wanted = Math.min(menu.scrollHeight || 360, 360);
        if (spaceBelow < Math.min(wanted, 240) && spaceAbove > spaceBelow) {
            menu.style.top = 'auto';
            menu.style.bottom = Math.round(window.innerHeight - r.top + 6) + 'px';
            menu.style.maxHeight = Math.max(160, Math.min(360, spaceAbove)) + 'px';
        } else {
            menu.style.bottom = 'auto';
            menu.style.top = Math.round(r.bottom + 6) + 'px';
            menu.style.maxHeight = Math.max(160, Math.min(360, spaceBelow)) + 'px';
        }
    }

    function splitLabel(item) {
        const value = String(item.value || '');
        let meta = String(item.label || '');
        if (meta.indexOf(value) === 0) meta = meta.slice(value.length);
        meta = meta.replace(/^\s*-\s*/, '').replace(/\s+-\s+/g, ' · ').trim();
        return { name: value === 'None' ? 'None' : value, meta: meta };
    }

    function highlight(text, words) {
        let html = esc(text);
        words.forEach((w) => {
            if (!w) return;
            const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
            html = html.replace(re, '<mark>$1</mark>');
        });
        return html;
    }

    function renderList(query) {
        const menu = $('iba-attention-menu');
        if (!menu) return;
        const list = menu.querySelector('.iba-attn-list');
        const empty = menu.querySelector('.iba-attn-empty');
        const words = norm(query).split(' ').filter(Boolean);
        const current = formValue();
        let rows = menuNames.filter((item) => {
            const hay = norm(item.label + ' ' + item.value);
            return words.every((w) => hay.indexOf(w) !== -1);
        });
        if (words.length) {
            const first = words[0];
            rows = rows.slice().sort((a, b) => {
                const as = norm(a.value).indexOf(first) === 0 ? 0 : 1;
                const bs = norm(b.value).indexOf(first) === 0 ? 0 : 1;
                return as - bs;
            });
        }
        list.innerHTML = rows.map((item, i) => {
            const parts = splitLabel(item);
            const sel = item.value === current;
            return '<button type="button" class="iba-attn-opt' + (sel ? ' is-selected' : '') + '" role="option" data-index="' + i + '" data-value="' + esc(item.value) + '" aria-selected="' + (sel ? 'true' : 'false') + '">' +
                '<span class="iba-attn-name">' + highlight(parts.name, words) + '</span>' +
                (parts.meta ? '<span class="iba-attn-meta">' + highlight(parts.meta, words) + '</span>' : '') +
                (sel ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : '') +
                '</button>';
        }).join('');
        list._rows = rows;
        if (empty) {
            empty.hidden = rows.length > 0;
            empty.textContent = menuNames.length ? ('No name matches "' + String(query || '').trim() + '"') : 'No names for this status';
        }
        const selIdx = rows.findIndex((r) => r.value === current);
        setActive(words.length ? 0 : (selIdx >= 0 ? selIdx : 0), true);
    }

    function setActive(i, scroll) {
        const menu = $('iba-attention-menu');
        if (!menu) return;
        const opts = menu.querySelectorAll('.iba-attn-opt');
        if (!opts.length) { activeIndex = -1; return; }
        activeIndex = Math.max(0, Math.min(i, opts.length - 1));
        opts.forEach((o, k) => o.classList.toggle('is-active', k === activeIndex));
        const input = menu.querySelector('input');
        if (input) input.setAttribute('aria-activedescendant', 'iba-attn-opt-' + activeIndex);
        opts.forEach((o, k) => { o.id = 'iba-attn-opt-' + k; });
        if (scroll) opts[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function pick(value) {
        writeAttention(value);
        holdStatus = null;
        const box = $('iba-attention-visible');
        if (box) box.setAttribute('data-applied', namesState().key || box.getAttribute('data-applied') || '');
        closeMenu(true);
        paintBox();
        try {
            const group = $('im-attention-group');
            if (group) group.classList.remove('im-invalid');
        } catch (_) {}
    }

    async function openMenu(initialQuery) {
        const box = ensureBox();
        if (!box) return;
        closeMenu(false);
        let state = namesState();
        try { if (typeof ibaPrepareAttention === 'function') state = await ibaPrepareAttention(); } catch (_) {}
        menuNames = ((state && state.names) || []).filter((n) => n && n.value);
        const menu = document.createElement('div');
        menu.id = 'iba-attention-menu';
        menu.className = 'iba-attn-menu';
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-label', 'Choose attention');
        menu.innerHTML =
            '<div class="iba-attn-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
            '<input type="text" autocomplete="off" spellcheck="false" placeholder="Type a name, position or site" aria-label="Search names" role="combobox" aria-expanded="true" aria-controls="iba-attn-list"></div>' +
            '<div class="iba-attn-list" id="iba-attn-list" role="listbox"></div>' +
            '<div class="iba-attn-empty" hidden></div>';
        document.body.appendChild(menu);
        const input = menu.querySelector('input');
        input.value = initialQuery || '';
        renderList(input.value);
        placeMenu();
        window.addEventListener('scroll', placeMenu, true);
        window.addEventListener('resize', placeMenu);
        box.setAttribute('aria-expanded', 'true');

        input.addEventListener('input', () => { renderList(input.value); placeMenu(); });
        input.addEventListener('keydown', (e) => {
            const list = menu.querySelector('.iba-attn-list');
            const rows = (list && list._rows) || [];
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1, true); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1, true); }
            else if (e.key === 'PageDown') { e.preventDefault(); setActive(activeIndex + 6, true); }
            else if (e.key === 'PageUp') { e.preventDefault(); setActive(activeIndex - 6, true); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const row = rows[activeIndex >= 0 ? activeIndex : 0];
                if (row) pick(row.value);
            } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
            else if (e.key === 'Tab') { closeMenu(false); }
        });
        menu.addEventListener('mousedown', (e) => {
            // keep the search line focused while clicking a name
            if (!e.target.closest('input')) e.preventDefault();
        });
        menu.addEventListener('click', (e) => {
            const opt = e.target.closest('.iba-attn-opt');
            if (!opt) return;
            e.preventDefault();
            e.stopPropagation();
            const list = menu.querySelector('.iba-attn-list');
            const rows = (list && list._rows) || [];
            const row = rows[Number(opt.getAttribute('data-index'))];
            pick(row ? row.value : opt.getAttribute('data-value'));
        });
        menu.addEventListener('mousemove', (e) => {
            const opt = e.target.closest('.iba-attn-opt');
            if (opt) { const i = Number(opt.getAttribute('data-index')); if (i !== activeIndex) setActive(i, false); }
        });
        setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); } const n = input.value.length; try { input.setSelectionRange(n, n); } catch (_) {} }, 0);
    }

    // Typing on the closed box opens the list with that letter.
    document.addEventListener('keydown', (e) => {
        const box = e.target && e.target.id === 'iba-attention-visible' ? e.target : null;
        if (!box) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(''); return; }
        if (e.key && e.key.length === 1 && e.key !== ' ') { e.preventDefault(); openMenu(e.key); }
    }, true);

    // ------------------------------------------------------------------
    // Keep the loaded invoice's Attention; start a new invoice clean
    // ------------------------------------------------------------------
    function wrapFormFunctions() {
        const origPopulate = window.populateInvoiceFormForEditing;
        if (typeof origPopulate === 'function' && !origPopulate.__ibaAttn) {
            const wrapped = function (invoiceKey) {
                const result = origPopulate.apply(this, arguments);
                try {
                    const editing = (typeof currentlyEditingInvoiceKey !== 'undefined') ? currentlyEditingInvoiceKey : null;
                    const inv = (typeof currentPOInvoices !== 'undefined' && currentPOInvoices) ? currentPOInvoices[invoiceKey] : null;
                    if (inv && editing === invoiceKey) {
                        const att = String(inv.attention || '').trim();
                        holdStatus = norm(inv.status || 'Under Review');
                        writeAttention(att || (isNoneStatus(inv.status) ? 'None' : ''));
                        const box = $('iba-attention-visible');
                        if (box) box.setAttribute('data-applied', '');
                        // the older routine fills the list a moment later; keep the
                        // invoice's own name once it is done
                        [250, 900].forEach((ms) => setTimeout(() => {
                            if (currentlyEditingInvoiceKey !== invoiceKey) return;
                            if (norm(currentStatus()) !== norm(inv.status || 'Under Review')) return;
                            if (att && formValue() !== att) writeAttention(att);
                        }, ms));
                        paintBox();
                    }
                } catch (err) { console.warn('[IBA attention] could not keep the invoice attention', err); }
                return result;
            };
            wrapped.__ibaAttn = true;
            window.populateInvoiceFormForEditing = wrapped;
        }
        const origReset = window.resetInvoiceForm;
        if (typeof origReset === 'function' && !origReset.__ibaAttn) {
            const wrappedReset = function () {
                const result = origReset.apply(this, arguments);
                try {
                    holdStatus = null;
                    if (!choicesInst()) writeAttention('');
                    const box = $('iba-attention-visible');
                    if (box) box.setAttribute('data-applied', '');
                    closeMenu(false);
                } catch (_) {}
                return result;
            };
            wrappedReset.__ibaAttn = true;
            window.resetInvoiceForm = wrappedReset;
        }
    }

    function install() {
        window.ibaWriteAttention = writeAttention;
        window.ibaPaintAttentionBox = paintBox;
        window.ibaOpenAttentionMenu = function () { return openMenu(''); };
        window.ibaCloseAttentionMenu = function () { closeMenu(false); };
        wrapFormFunctions();
        window.ibaAttentionPicker = { VERSION, formValue, writeAttention, paintBox, openMenu, closeMenu };
    }

    install();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapFormFunctions, { once: true });
})();
