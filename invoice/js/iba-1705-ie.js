/* 17.0.5 patch 200 (martin picked design A): Invoice Entry pop-up re-arranged.
   - PO strip on top: PO no., vendor (gold), site, PO value / Invoiced / Balance
   - four boxes: Invoice / Status & who has it (quick status pills, was the side panel) /
     Files (Invoice, SRV, Report: Open + Upload) / Notes
   - header: Entry ID tag, Prev/Next, "Search another PO", ×
   - footer: Delete (left) + "Last update: who · when"; Clear / Back / Close / Add / Update (right)
   - Tab key: Invoice No > Inv Date > Value > Amount to pay > Release > Status > Attention > Note > Details
   Nothing is re-created: the existing fields and buttons are MOVED (same ids, same listeners).
   Add/Update keep submitting the form through the form="" attribute. */
(function () {
    'use strict';
    if (window.ibaIE) return;
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const grp = (id) => { const el = $(id); return el ? el.closest('.form-group') : null; };
    const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
    const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function relabel(id, text) { const l = document.querySelector('label[for="' + id + '"]'); if (l && l.textContent !== text) l.textContent = text; }
    // other start-up scripts write some labels back, so these are re-applied while the pop-up is open
    const LABELS = [['im-amount-paid', 'Amount to pay'], ['im-release-date', 'Release date'], ['im-note', 'Note (shows in the tracker)']];
    function sec(icon, title, cls) {
        const s = el('section', 'iba-ie-sec ' + cls);
        s.appendChild(el('h4', '', '<i class="' + icon + '"></i> ' + title));
        const f = el('div', 'iba-ie-fields'); s.appendChild(f);
        return [s, f];
    }

    let built = false;
    function build() {
        if (built) return;
        const modal = $('im-invoice-entry-modal'), form = $('im-new-invoice-form');
        const grid = form && form.querySelector('.form-grid-compact');
        if (!modal || !form || !grid) return;
        built = true;
        modal.classList.add('iba-ie-a');

        // ---- PO strip (the .im-po-* spans are filled by the app's own PO search) ----
        const po = el('div', 'iba-ie-po',
            '<div class="iba-ie-po-no"><span class="l">PO No.</span><span class="im-po-no">---</span></div>' +
            '<div class="iba-ie-po-v"><span class="l">Vendor</span><span class="im-po-vendor">---</span>' +
            '<div class="iba-ie-site"><i class="fa-solid fa-location-dot"></i> Site <span class="im-po-site">---</span></div></div>' +
            '<div class="iba-ie-fig"><span class="l">PO value</span><b class="im-po-value">---</b></div>' +
            '<div class="iba-ie-fig"><span class="l">Invoiced</span><b data-ie-invoiced>---</b></div>' +
            '<div class="iba-ie-fig is-bal"><span class="l">Balance</span><b data-ie-balance>---</b></div>');
        form.insertBefore(po, form.firstChild);
        // copy what the app already wrote into the other PO spans
        ['im-po-no', 'im-po-vendor', 'im-po-site', 'im-po-value'].forEach((c) => {
            const src = document.querySelector('#im-invoice-entry-modal .im-footer-po-summary .' + c) || document.querySelector('.' + c);
            const dst = po.querySelector('.' + c);
            if (src && dst && src.textContent.trim()) dst.textContent = src.textContent;
        });

        // ---- four boxes ----
        const [sInv, fInv] = sec('fa-solid fa-file-invoice', 'Invoice', 'is-inv');
        const [sSt, fSt] = sec('fa-solid fa-route', 'Status &amp; who has it', 'is-st');
        const [sFi, fFi] = sec('fa-solid fa-paperclip', 'Files', 'is-files');
        const [sNo, fNo] = sec('fa-regular fa-note-sticky', 'Notes', 'is-notes');
        ['im-inv-no', 'im-invoice-date', 'im-inv-value', 'im-amount-paid', 'im-release-date', 'im-inv-entry-id'].forEach((id) => { const g = grp(id); if (g) fInv.appendChild(g); });
        ['im-status', 'im-attention'].forEach((id) => { const g = grp(id); if (g) fSt.appendChild(g); });
        const pills = document.querySelector('#im-invoice-entry-modal .im-quick-status-buttons');
        if (pills) { pills.classList.add('iba-ie-pills'); sSt.appendChild(pills); sSt.appendChild(el('div', 'iba-ie-hint', '<i class="fa-solid fa-bolt"></i> One tap sets the status')); }
        const FILES = [['im-inv-name', 'Invoice', 'PDF_BASE_PATH'], ['im-srv-name', 'SRV', 'SRV_BASE_PATH'], ['im-report-name', 'Report', 'REPORT_BASE_PATH']];
        const oldWrap = grp('im-report-name') && grp('im-report-name').parentElement;
        FILES.forEach(([id, name, base]) => {
            const g = grp(id); if (!g) return;
            g.classList.add('iba-ie-file');
            relabel(id, name);
            const inp = $(id);
            const box = inp.parentElement;                      // the flex row: input + upload button
            box.classList.add('iba-ie-file-row');
            inp.style.removeProperty('border-top-right-radius'); inp.style.removeProperty('border-bottom-right-radius');
            const open = el('button', 'iba-ie-open', '<i class="fa-solid fa-eye"></i> Open');
            open.type = 'button'; open.tabIndex = -1; open.dataset.ieOpen = base; open.title = 'Open the ' + name + ' PDF';
            inp.after(open);
            fFi.appendChild(g);
        });
        ['im-note', 'im-details'].forEach((id) => { const g = grp(id); if (g) fNo.appendChild(g); });
        LABELS.forEach(([id, txt]) => relabel(id, txt));
        if (oldWrap && oldWrap !== grid && !oldWrap.querySelector('input,select,textarea')) oldWrap.remove();
        // anything left in the grid (future fields) goes to the Notes box so nothing gets lost
        Array.from(grid.children).forEach((c) => { if (c.querySelector && c.querySelector('input,select,textarea')) fNo.appendChild(c); });
        grid.classList.add('iba-ie-grid');
        grid.append(sInv, sSt, sFi, sNo);

        // ---- header: Entry ID tag + search another PO ----
        const head = modal.querySelector('.modal-header');
        const title = $('im-form-title');
        if (title) title.after(el('span', 'iba-ie-tag', ''));
        const bsearch = $('im-po-search-input-bottom');
        const sWrap = bsearch && bsearch.parentElement;
        const xBtn = head && head.querySelector(':scope > .modal-close-btn');
        if (sWrap && head) {
            sWrap.classList.add('iba-ie-search');
            sWrap.removeAttribute('style');
            bsearch.placeholder = 'Search another PO…';
            if (xBtn) head.insertBefore(sWrap, xBtn); else head.appendChild(sWrap);
        }

        // ---- footer ----
        const ft = modal.querySelector('.im-entry-modal-footer');
        if (ft) {
            const L = el('div', 'iba-ie-ft-l'), R = el('div', 'iba-ie-ft-r');
            ['im-delete-invoice-btn', 'im-modal-deletion-list-btn'].forEach((id) => { const b = $(id); if (b) L.appendChild(b); });
            L.appendChild(el('span', 'iba-ie-last', ''));
            const close = ft.querySelector('.im-footer-close-btn');
            ['im-clear-form-button', 'im-back-to-active-task-button'].forEach((id) => { const b = $(id); if (b) R.appendChild(b); });
            if (close) { close.innerHTML = '<i class="fa-solid fa-xmark"></i> Close'; R.appendChild(close); }
            ['im-add-invoice-button', 'im-update-invoice-button'].forEach((id) => { const b = $(id); if (b) { b.setAttribute('form', 'im-new-invoice-form'); R.appendChild(b); } });
            ft.append(L, R);
            ft.classList.add('iba-ie-ft');
        }
        const tb = form.querySelector('.im-toolbar-row');
        if (tb && !tb.querySelector('button, input')) tb.remove();

        // ---- Tab key: only the fields, in martin's order (DOM order now matches) ----
        ['im-inv-entry-id', 'im-inv-name', 'im-srv-name', 'im-report-name', 'im-btn-view-invoice', 'im-btn-view-srv', 'btn-open-report-drive']
            .forEach((id) => { const e = $(id); if (e) e.tabIndex = -1; });
        modal.querySelectorAll('[data-im-quick-status], .iba-cpy, .iba-ie-open').forEach((b) => { b.tabIndex = -1; });

        modal.addEventListener('click', (e) => {
            const o = e.target.closest && e.target.closest('[data-ie-open]');
            if (!o) return;
            e.preventDefault();
            const inp = o.parentElement.querySelector('input');
            const name = inp && inp.value.trim();
            let base = '';
            try { base = { PDF_BASE_PATH: PDF_BASE_PATH, SRV_BASE_PATH: SRV_BASE_PATH, REPORT_BASE_PATH: REPORT_BASE_PATH }[o.dataset.ieOpen]; } catch (_) {}
            const url = name && base && typeof buildSharePointPdfUrl === 'function' ? buildSharePointPdfUrl(base, name) : '';
            if (url) window.open(url, '_blank', 'noopener');
        });
        sync();
        new MutationObserver(soon).observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
        ['input', 'change'].forEach((t) => modal.addEventListener(t, soon, true));
        setInterval(() => { if (!modal.classList.contains('hidden')) sync(); }, 1500);
    }

    let t = 0;
    function soon() { if (!t) t = setTimeout(() => { t = 0; sync(); }, 80); }
    function fmtWhen(ms) {
        const d = new Date(ms); if (!ms || isNaN(d)) return '';
        const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        return String(d.getDate()).padStart(2, '0') + '/' + M[d.getMonth()] + '/' + String(d.getFullYear()).slice(2) + ' ' + h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap;
    }
    function sync() {
        const modal = $('im-invoice-entry-modal'); if (!modal || !built) return;
        LABELS.forEach(([id, txt]) => relabel(id, txt));
        // patch 205: IPC / F / FIVE as tiny I / F / 5 buttons on the Invoice No. title line,
        // so the Invoice No. box gets its full width (same buttons, same clicks)
        const qf = $('smart-quick-fill-group'), ql = modal.querySelector('label[for="im-inv-no"]');
        if (qf && ql && qf.parentElement !== ql) {
            ql.appendChild(qf); qf.classList.add('iba-ie-qf');
            [['btn-smart-ipc', 'I', 'I = IPC (next IPC number for this PO)'], ['btn-smart-ipc-final', 'F', 'F = Final (adds .Final to the IPC)'], ['btn-smart-five', '5', '5 = Five']].forEach(([id, t, tip]) => { const b = $(id); if (b) { b.textContent = t; b.title = tip; b.removeAttribute('style'); } });
        }
        // Tab key skips the extra ticks and the hidden attention list (the visible picker gets the Tab)
        modal.querySelectorAll('#iba-urg-tick, #iba-ret-tick, [data-im-quick-status], .iba-cpy').forEach((x) => { if (x.tabIndex !== -1) x.tabIndex = -1; });
        const att = $('im-attention'), ag = att && att.closest('.form-group');
        if (ag && $('iba-attention-visible')) ag.querySelectorAll('select, .choices, .choices [tabindex], .choices input').forEach((x) => { if (x.tabIndex !== -1) x.tabIndex = -1; });
        // Entry ID tag
        const tag = modal.querySelector('.iba-ie-tag'), id = $('im-inv-entry-id');
        if (tag) { const v = id ? id.value.trim() : ''; tag.textContent = v; tag.hidden = !v; }
        // files: Open only when there is a name
        modal.querySelectorAll('.iba-ie-open').forEach((o) => { const i = o.parentElement.querySelector('input'); const ok = !!(i && i.value.trim() && !/^nil$/i.test(i.value.trim())); o.disabled = !ok; });
        // Invoiced / Balance from the PO's invoices already in memory
        let invs = null, key = null;
        try { invs = (typeof currentPOInvoices !== 'undefined') ? currentPOInvoices : null; } catch (_) {}
        try { key = (typeof currentlyEditingInvoiceKey !== 'undefined') ? currentlyEditingInvoiceKey : null; } catch (_) {}
        const pv = modal.querySelector('.iba-ie-po .im-po-value');
        const showAmt = pv && /\d/.test(pv.textContent);
        let tot = 0;
        if (invs && typeof invs === 'object') Object.values(invs).forEach((x) => { if (x && !/cancel/i.test(String(x.status || ''))) tot += num(x.invValue); });
        const iv = modal.querySelector('[data-ie-invoiced]'), bv = modal.querySelector('[data-ie-balance]');
        if (iv) iv.textContent = showAmt && invs ? money(tot) : '---';
        if (bv) { const bal = num(pv && pv.textContent) - tot; bv.textContent = showAmt && invs ? money(bal) : '---'; bv.classList.toggle('is-neg', showAmt && bal < -0.005); }
        // Last update: who · when (edit mode only)
        const last = modal.querySelector('.iba-ie-last');
        if (last) {
            let txt = '';
            const inv = key && invs ? invs[key] : null;
            if (inv) {
                const h = inv.history; const arr = Array.isArray(h) ? h : (h && typeof h === 'object' ? Object.values(h) : []);
                let best = null; arr.forEach((x) => { const at = Number(x && x.timestamp) || Date.parse(x && x.date || '') || 0; if (x && (!best || at >= best.at)) best = { at, by: String(x.updatedBy || x.by || '').trim() }; });
                const at = Math.max(best ? best.at : 0, Number(inv.lastUpdated) || 0);
                const by = best && best.by ? best.by : String(inv.updatedBy || inv.enteredBy || '').trim();
                const w = fmtWhen(at);
                if (by || w) txt = 'Last update: ' + esc([by, w].filter(Boolean).join(' · '));
            }
            last.innerHTML = txt;
        }
    }


    // ---- Tab key: next field, never the little buttons or the parts of a date ----
    // Invoice Entry pop-up: martin's order. Batch Entry: each card left to right, row by row
    // as it looks on screen, then the next card.
    const IE_ORDER = ['im-inv-no', 'im-invoice-date', 'im-inv-value', 'im-amount-paid', 'im-release-date', 'im-status', '@att', 'im-note', 'im-details'];
    const shown = (x) => !!(x && !x.disabled && x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden');
    function ieList() {
        return IE_ORDER.map((id) => id === '@att' ? ($('iba-attention-visible') || $('im-attention')) : $(id)).filter(shown);
    }
    function cardFields(card) {
        const xs = Array.from(card.querySelectorAll('input, select, textarea, .batch-attention-btn')).filter((x) =>
            shown(x) && !x.readOnly && x.type !== 'checkbox' && x.type !== 'hidden' && !(x.tagName === 'SELECT' && x.name === 'attention') && !x.closest('.choices'));
        const pos = xs.map((x) => { const r = x.getBoundingClientRect(); return { x, top: r.top, left: r.left }; });
        pos.sort((a, b) => (Math.abs(a.top - b.top) > 18 ? a.top - b.top : a.left - b.left));
        return pos.map((p) => p.x);
    }
    function batchList() {
        return Array.from(document.querySelectorAll('.batch-invoice-card')).filter(shown).flatMap(cardFields);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
        const a = document.activeElement;
        if (!a || document.body.classList.contains('iba-mobile-ui')) return;
        let list = null;
        if (a.closest('#im-invoice-entry-modal.iba-ie-a')) list = ieList();
        else if (a.closest('.batch-invoice-card')) list = batchList();
        if (!list) return;
        const i = list.indexOf(a);
        if (i < 0) return;
        const n = list[i + (e.shiftKey ? -1 : 1)];
        if (!n) return;                         // first / last field: normal Tab
        e.preventDefault();
        n.focus();
        try { if (n.select && n.tagName === 'INPUT' && /^(text|search|)$/.test(n.type)) n.select(); } catch (_) {}
        try { n.scrollIntoView({ block: 'nearest' }); } catch (_) {}
    }, true);

    window.ibaIE = { build, sync, ieList, batchList };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
