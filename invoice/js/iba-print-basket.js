/* ==========================================================================
   js/iba-print-basket.js — 17.0.0 patch 4 (patch 19: Move to Batch Entry)
   Print basket for approval stickers.
   "Add to print" on an approved invoice (Now Brief, Active Task) asks where
   the stickers go on that page (Left / Middle / Right / Auto) and puts the
   invoice in the basket. The basket button (bottom left) lists them: change
   a position, move up/down, remove. "Print all" makes one document with one
   A4 page per invoice, in that order, each with its own position. In the
   print window pick the printer or "Save as PDF" for one combined PDF.
   The basket is kept in this browser until it is emptied.
   17.0.0 patch 22: Super Admin only (approved SRV printing is the Super
   Admin's job); other users never see the button or "Add to print".
   17.0.3: when js/iba-1702-esn.js is loaded, "Add to print" opens the Print
   ESN window (tick signatures, Left / Middle / Right bottom / middle / top)
   and the basket prints the new sticker (design A with the time). Items
   saved before keep working (newest signature, Right bottom).
   17.0.5 patch 24: "Add all approved to print (N)" above Active Task puts
   every approved invoice waiting for its print in the basket at once
   (normal sticker: newest signature, Right bottom; pen = change). The
   basket shows each invoice's amount and the total.
   ========================================================================== */
(function () {
    'use strict';

    const KEY = 'iba-print-basket-v1';
    const POS = { '1': 'Left', '2': 'Middle', '3': 'Right', '4': 'Auto' };
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function isSuperUser() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    // 17.0.4 patch 3: also the people on "Who can print ESN"
    function allowed() {
        try { if (window.ibaTestAs) return false; } catch (_) {}
        if (isSuperUser()) return true;
        try { return !!(window.ibaEsnFlow && typeof window.ibaEsnFlow.meAllowedSync === 'function' && window.ibaEsnFlow.meAllowedSync() === true); } catch (_) { return false; }
    }

    function load() {
        try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => x && x.po && x.key) : []; } catch (_) { return []; }
    }
    function save(list) {
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) {}
        paintButton();
        paintAllButton();
        if (document.getElementById('iba-pb-panel')) openPanel();
    }
    function esn() { return (window.ibaEsnFlow && typeof window.ibaEsnFlow.choose === 'function') ? window.ibaEsnFlow : null; }
    function placesText(picks) {
        const E = esn();
        return (picks || []).map((p) => String(p.name || '').split(/\s+/)[0] + ' ' + (E ? E.placeName(p.place) : p.place)).join(', ');
    }
    function num(v) { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; }
    function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function tasks() { try { return (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks)) ? userActiveTasks : []; } catch (_) { return []; } }
    function taskAmount(t) { return t ? (t.amountPaid || t.amount || t.invValue || '') : ''; }
    // amount of a basket item: saved with it, else from memory (no download)
    function amountOf(x) {
        if (x.amount !== undefined && x.amount !== '') return x.amount;
        try {
            const r = (typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[x.po]) ? allInvoiceData[x.po][x.key] : null;
            if (r) return r.amountPaid || r.invValue || '';
        } catch (_) {}
        const E = esn();
        const t = tasks().find((y) => { try { const ids = E && E.taskIds ? E.taskIds(y) : null; return ids && String(ids.po) === String(x.po) && String(ids.key) === String(x.key); } catch (_) { return false; } });
        return taskAmount(t);
    }
    function same(a, b) { return String(a.po) === String(b.po) && String(a.key) === String(b.key); }

    // ------------------------------------------------------------------
    // Small glass windows
    // ------------------------------------------------------------------
    function closeLayer(id) { const el = document.getElementById(id); if (el) el.remove(); }
    function layer(id, html) {
        closeLayer(id);
        const wrap = document.createElement('div');
        wrap.id = id;
        wrap.className = 'iba-pb-layer';
        wrap.innerHTML = '<div class="iba-pb-box" role="dialog" aria-modal="true">' + html + '</div>';
        wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeLayer(id); });
        document.body.appendChild(wrap);
        return wrap;
    }

    // ask the sticker position; resolves '1'..'4' or null
    function askPosition(label, current) {
        return new Promise((resolve) => {
            const w = layer('iba-pb-ask',
                '<div class="iba-pb-head"><b>Add to print</b><span>' + esc(label) + '</span></div>' +
                '<p class="iba-pb-sub">Where should the approval stickers go on this page?</p>' +
                '<div class="iba-pb-pos">' + Object.keys(POS).map((k) =>
                    '<button type="button" data-pos="' + k + '" class="' + (String(current || '4') === k ? 'is-on' : '') + '"><span class="iba-pb-mini is-' + POS[k].toLowerCase() + '"><i></i></span>' + POS[k] + (k === '4' ? ' <small>(best for several)</small>' : '') + '</button>').join('') + '</div>' +
                '<div class="iba-pb-foot"><button type="button" data-x>Cancel</button></div>');
            const done = (v) => { closeLayer('iba-pb-ask'); resolve(v); };
            w.addEventListener('click', (e) => {
                const b = e.target.closest('button');
                if (!b) return;
                if (b.hasAttribute('data-x')) return done(null);
                if (b.dataset.pos) return done(b.dataset.pos);
            });
            w.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') done(null);
                if (POS[e.key]) done(e.key);
            });
            const first = w.querySelector('button.is-on') || w.querySelector('button');
            if (first) setTimeout(() => first.focus(), 0);
        });
    }

    async function add(item) {
        if (!item || !item.po || !item.key) return false;
        if (!allowed()) { alert('The print basket is only for the Super Admin and the people on "Who can print ESN".'); return false; }
        const list = load();
        const had = list.find((x) => same(x, item));
        const label = 'PO ' + item.po + (item.ref ? ' · ' + item.ref : '') + (item.vendor ? ' · ' + item.vendor : '');
        const E = esn();
        let pos = had ? had.pos : '4', picks = null;
        if (E && Array.isArray(item.picks) && item.picks.length) {
            picks = item.picks; // already picked in the Print ESN window
        } else if (E) {
            picks = await E.choose(String(item.po), String(item.key), had && had.picks, had ? 'Save' : 'Add to basket');
            if (!picks) return false;
        } else {
            pos = await askPosition(label, had ? had.pos : '4');
            if (!pos) return false;
        }
        if (had) { had.pos = pos; if (item.amount) had.amount = item.amount; if (picks) had.picks = picks; if (item.esnTask) had.esnTask = true; }
        else list.push({ po: String(item.po), key: String(item.key), ref: item.ref || '', vendor: item.vendor || '', amount: item.amount || undefined, pos: pos, picks: picks || undefined, esnTask: item.esnTask ? true : undefined, at: Date.now() });
        save(list);
        const where = picks ? placesText(picks) : POS[pos];
        flash(had ? 'Changed: ' + where : 'Added (' + list.length + '). Click Print basket above to print.');
        // 17.0.0 patch 10: say what to do next right away
        const w = layer('iba-pb-next',
            '<div class="iba-pb-head"><b>' + (had ? 'Changed' : 'Added to the print basket') + '</b><span>' + esc(label) + ' · ' + esc(where) + '</span></div>' +
            '<p class="iba-pb-sub">There ' + (list.length === 1 ? 'is <b>1 invoice</b>' : 'are <b>' + list.length + ' invoices</b>') + ' in the basket. Add more, or print them all now as one document (one A4 page each).</p>' +
            '<div class="iba-pb-foot"><span></span><button type="button" data-x>Add more</button><button type="button" data-go class="is-main"><i class="fa-solid fa-print"></i> Print all (' + list.length + ')</button></div>');
        w.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            closeLayer('iba-pb-next');
            if (btn.hasAttribute('data-go')) openPanel();
        });
        const go = w.querySelector('[data-go]');
        if (go) setTimeout(() => go.focus(), 0);
        return true;
    }

    function flash(text) {
        const btn = paintButton();
        if (!btn) return;
        btn.setAttribute('data-flash', text);
        btn.classList.remove('is-flash');
        void btn.offsetWidth;
        btn.classList.add('is-flash');
        clearTimeout(flash.t);
        flash.t = setTimeout(() => btn.classList.remove('is-flash'), 2600);
    }

    // ------------------------------------------------------------------
    // The basket button and list
    // ------------------------------------------------------------------
    function paintButton() {
        const n = allowed() ? load().length : 0;
        let b = document.getElementById('iba-pb-btn');
        if (!n) { if (b) b.remove(); return null; }
        if (!b) {
            b = document.createElement('button');
            b.type = 'button';
            b.id = 'iba-pb-btn';
            b.title = 'Approval stickers waiting to be printed';
            b.addEventListener('click', openPanel);
            document.body.appendChild(b);
        }
        const html = '<i class="fa-solid fa-print"></i> Print basket <b>' + n + '</b> <span class="iba-pb-hint">click to print</span>';
        if (b.__ibaHtml !== html) { b.innerHTML = html; b.__ibaHtml = html; }
        return b;
    }

    function openPanel() {
        if (!allowed()) { closeLayer('iba-pb-panel'); return; }
        const list = load();
        if (!list.length) { closeLayer('iba-pb-panel'); return; }
        const rows = list.map((x, i) =>
            '<tr data-i="' + i + '"><td class="n">' + (i + 1) + '</td>' +
            '<td><b>' + esc(x.po) + '</b>' + (x.ref ? '<small>' + esc(x.ref) + '</small>' : '') + '</td>' +
            '<td class="v">' + esc(x.vendor || '') + '</td>' +
            '<td class="m">' + (amountOf(x) !== '' ? esc(money(amountOf(x))) : '-') + '</td>' +
            (esn() ? '<td class="iba-pb-picks">' + esc(x.picks && x.picks.length ? placesText(x.picks) : 'Newest · Right bottom') + ' <button type="button" data-change title="Change signatures / places"><i class="fa-solid fa-pen"></i></button></td>'
                : '<td><select data-pos>' + Object.keys(POS).map((k) => '<option value="' + k + '"' + (x.pos === k ? ' selected' : '') + '>' + POS[k] + '</option>').join('') + '</select></td>') +
            '<td class="a"><button type="button" data-up title="Move up"' + (i ? '' : ' disabled') + '><i class="fa-solid fa-arrow-up"></i></button>' +
            '<button type="button" data-down title="Move down"' + (i < list.length - 1 ? '' : ' disabled') + '><i class="fa-solid fa-arrow-down"></i></button>' +
            '<button type="button" data-del title="Remove"><i class="fa-solid fa-xmark"></i></button></td></tr>').join('');
        const total = list.reduce((s2, x) => s2 + num(amountOf(x)), 0);
        const w = layer('iba-pb-panel',
            '<div class="iba-pb-head"><b>Print basket</b><span>' + list.length + ' invoice' + (list.length === 1 ? '' : 's') + ' · one A4 page each, in this order</span></div>' +
            '<div class="iba-pb-scroll"><table class="iba-pb-table"><thead><tr><th>#</th><th>PO</th><th>Vendor</th><th class="m">Amount (QAR)</th><th>Stickers</th><th></th></tr></thead><tbody>' + rows + '</tbody>' +
            '<tfoot><tr><td></td><td colspan="2">Total · ' + list.length + ' invoice' + (list.length === 1 ? '' : 's') + '</td><td class="m"><b>' + esc(money(total)) + '</b></td><td colspan="2"></td></tr></tfoot></table></div>' +
            '<p class="iba-pb-msg" hidden></p>' +
            '<div class="iba-pb-foot"><button type="button" data-empty class="is-quiet">Empty basket</button><span></span>' +
            '<button type="button" data-x>Close</button>' + (typeof window.ibaAddToBatch === 'function' && isSuperUser() ? '<button type="button" data-tobatch title="Put these invoices in Batch Entry and empty the basket"><i class="fa-solid fa-table-list"></i> To Batch Entry</button>' : '') + '<button type="button" data-print class="is-main"><i class="fa-solid fa-print"></i> Print all / Save as PDF</button></div>');
        w.addEventListener('change', (e) => {
            const sel = e.target.closest('select[data-pos]');
            if (!sel) return;
            const l = load();
            const i = Number(sel.closest('tr').dataset.i);
            if (l[i]) { l[i].pos = sel.value; save(l); }
        });
        w.addEventListener('click', async (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-x')) return closeLayer('iba-pb-panel');
            if (b.hasAttribute('data-empty')) {
                if (confirm('Remove all ' + load().length + ' invoice(s) from the print basket?')) { save([]); closeLayer('iba-pb-panel'); }
                return;
            }
            if (b.hasAttribute('data-print')) return printAll(w, b);
            if (b.hasAttribute('data-tobatch')) return afterPrint();
            const tr = b.closest('tr');
            if (!tr) return;
            const l = load();
            const i = Number(tr.dataset.i);
            if (b.hasAttribute('data-change') && esn() && l[i]) {
                const p = await esn().choose(l[i].po, l[i].key, l[i].picks, 'Save');
                if (p) { const l2 = load(); const j = l2.findIndex((y) => same(y, l[i])); if (j > -1) { l2[j].picks = p; save(l2); } }
                return;
            }
            if (b.hasAttribute('data-del')) l.splice(i, 1);
            else if (b.hasAttribute('data-up') && i > 0) l.splice(i - 1, 0, l.splice(i, 1)[0]);
            else if (b.hasAttribute('data-down') && i < l.length - 1) l.splice(i + 1, 0, l.splice(i, 1)[0]);
            save(l);
            if (!l.length) closeLayer('iba-pb-panel');
        });
    }

    // ------------------------------------------------------------------
    // Print all: one page per invoice
    // ------------------------------------------------------------------
    const PAGE_CSS = '@page { size: A4; margin: 0; } html, body { margin: 0; padding: 0; font-family: "Arial", sans-serif; } ' +
        '.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; break-after: page; } ' +
        '.page:last-child { page-break-after: auto; break-after: auto; } ' +
        '.sticker-box { position: absolute; width: max-content; min-width: 48mm; padding: 2mm 3mm; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; z-index: 100; box-sizing: border-box; } ' +
        '.main { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; } ' +
        '.status { font-weight: 900; font-size: 8pt; text-transform: uppercase; margin: 0; color: #000; text-align: center; white-space: nowrap; font-family: "Courier New", monospace; } ' +
        '.approved-word { color: #16803c; } .po-part { color: #18324a; } .count-part { color: #d22b2b; } ' +
        '.esn { font-weight: bold; font-size: 8pt; margin-top: 1.5mm; font-family: "Courier New", monospace; white-space: nowrap; color: #000; text-align: center; } ' +
        '.approval-divider { width: 80%; border-top: 0.4pt dashed #000; margin: 1.5mm 0 1mm; } ' +
        '.side { font-size: 8pt; margin: 0; color: #000; font-family: "Courier New", monospace; text-align: center; } ' +
        '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }';

    async function printAll(w, btn) {
        const list = load();
        if (!list.length) return;
        if (typeof window.handlePrintSticker !== 'function' || typeof createStickerHTML !== 'function') {
            alert('The sticker print is not loaded on this page. Please refresh.');
            return;
        }
        const msg = w.querySelector('.iba-pb-msg');
        const say = (t, bad) => { msg.hidden = !t; msg.textContent = t || ''; msg.classList.toggle('is-bad', !!bad); };
        if (esn()) {
            btn.disabled = true;
            let r;
            try { r = await esn().basketPages(list, (i, x) => say('Preparing ' + (i + 1) + ' of ' + list.length + ' (PO ' + x.po + ')...')); }
            finally { btn.disabled = false; }
            if (!r.pages.length) { say('None of these invoices has an approval sticker yet.', true); return; }
            say(r.missing.length ? 'No approval found for ' + r.missing.join(', ') + ': left out. Printing ' + r.pages.length + ' page(s).' : 'Printing ' + r.pages.length + ' page(s)...', !!r.missing.length);
            esn().printPages(r.pages);
            // 17.0.4 patch 3: ESN tasks printed from the basket count as printed (Ready unlocks)
            if (typeof esn().markPrinted === 'function') {
                list.filter((x) => x.esnTask && r.missing.indexOf('PO ' + x.po + (x.ref ? ' (' + x.ref + ')' : '')) === -1).forEach((x) => {
                    Promise.resolve(esn().markPrinted(x.po, x.key, x.picks ? placesText(x.picks) : '')).catch((e) => console.warn('[basket] mark printed', e));
                });
            }
            setTimeout(() => { if (load().length) afterPrint(); }, 1500);
            return;
        }
        btn.disabled = true;
        const pages = [];
        const missing = [];
        try {
            for (let i = 0; i < list.length; i++) {
                const x = list[i];
                say('Preparing ' + (i + 1) + ' of ' + list.length + ' (PO ' + x.po + ')...');
                let stickers = [];
                try { stickers = (await window.handlePrintSticker(x.key, 'Invoice', x.po, { position: x.pos, collect: true })) || []; } catch (_) { stickers = []; }
                if (!stickers.length) { missing.push('PO ' + x.po + (x.ref ? ' (' + x.ref + ')' : '')); continue; }
                pages.push('<div class="page">' + stickers.map((s) => createStickerHTML(s, s.cssPosition)).join('') + '</div>');
            }
        } finally {
            btn.disabled = false;
        }
        if (!pages.length) { say('None of these invoices has an approval sticker yet.', true); return; }
        say(missing.length ? 'No approval found for ' + missing.join(', ') + ': left out. Printing ' + pages.length + ' page(s).' : 'Printing ' + pages.length + ' page(s)...', !!missing.length);
        const win = window.open('', '', 'width=1000,height=1200');
        if (!win) { say('Please allow pop-ups to print the approvals.', true); return; }
        win.document.write('<html><head><title>Approvals ' + new Date().toLocaleDateString('en-GB') + ' (' + pages.length + ' pages)</title><style>' + PAGE_CSS + '</style></head><body>' +
            pages.join('') + '<script>setTimeout(function(){ window.print(); }, 250);<\/script></body></html>');
        win.document.close();
        setTimeout(() => { if (load().length) afterPrint(); }, 1500);
    }

    // 17.0.0 patch 19: after printing, the invoices can go on to Batch Entry
    // (to update them together), which also empties the basket.
    function afterPrint() {
        const list = load();
        const canBatch = typeof window.ibaAddToBatch === 'function' && isSuperUser();
        const w = layer('iba-pb-after',
            '<div class="iba-pb-head"><b>Printed / saved?</b><span>' + list.length + ' invoice' + (list.length === 1 ? '' : 's') + ' in the basket</span></div>' +
            '<p class="iba-pb-sub">' + (canBatch ? '<b>Move to Batch Entry</b> puts them in the Batch Entry list (nothing is saved until you press Save there) and empties the basket.' : 'Empty the basket now, or keep the list.') + '</p>' +
            '<p class="iba-pb-sub iba-pb-after-msg" hidden></p>' +
            '<div class="iba-pb-foot"><button type="button" data-keep class="is-quiet">Keep list</button><span></span><button type="button" data-empty>Empty basket</button>' +
            (canBatch ? '<button type="button" data-batch class="is-main"><i class="fa-solid fa-table-list"></i> Move to Batch Entry</button>' : '') + '</div>');
        const msg = w.querySelector('.iba-pb-after-msg');
        w.addEventListener('click', async (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-keep')) return closeLayer('iba-pb-after');
            if (b.hasAttribute('data-empty')) { save([]); closeLayer('iba-pb-after'); closeLayer('iba-pb-panel'); return; }
            if (!b.hasAttribute('data-batch')) return;
            b.disabled = true;
            msg.hidden = false;
            msg.textContent = 'Adding to Batch Entry…';
            try {
                const r = await window.ibaAddToBatch(list.map((x) => ({ po: x.po, key: x.key })));
                if (r && r.error) throw new Error(r.error);
                const added = (r.added || []).length, had = (r.already_in_batch || []).length, miss = (r.not_added || []).length;
                save([]);
                closeLayer('iba-pb-panel');
                msg.textContent = added + ' added to Batch Entry' + (had ? ', ' + had + ' were already there' : '') + (miss ? ', ' + miss + ' not found' : '') + '. The basket is empty.';
                setTimeout(() => closeLayer('iba-pb-after'), 2200);
            } catch (err) {
                b.disabled = false;
                msg.textContent = 'Could not add them: ' + ((err && err.message) || err) + ' The basket is kept.';
            }
        });
    }
    // ------------------------------------------------------------------
    // "Add to print" in Active Task (approved invoices)
    // ------------------------------------------------------------------
    function addActiveTaskButtons() {
        if (!allowed()) { document.querySelectorAll('.iba-pb-add-btn').forEach((b) => b.remove()); return; }
        // 17.0.4 patch 3: next to Print ESN as well (ESN printers)
        document.querySelectorAll('.iba-esn-print-btn').forEach((p) => {
            if (p.nextElementSibling && p.nextElementSibling.classList.contains('iba-pb-add-btn')) return;
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'iba-pb-add-btn wd-row-action wd-action-gold';
            b.title = 'Add to the print basket (print several as one PDF)';
            b.setAttribute('data-esn-task', p.getAttribute('data-key') || '');
            b.innerHTML = '<i class="fa-solid fa-cart-plus"></i>';
            p.insertAdjacentElement('afterend', b);
        });
        document.querySelectorAll('.iba-apv-print-btn').forEach((p) => {
            if (p.nextElementSibling && p.nextElementSibling.classList.contains('iba-pb-add-btn')) return;
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'iba-pb-add-btn wd-row-action wd-action-gold';
            b.title = 'Add to the print basket (one combined print)';
            b.setAttribute('data-po', p.getAttribute('data-po') || '');
            b.setAttribute('data-invkey', p.getAttribute('data-invkey') || '');
            b.innerHTML = '<i class="fa-solid fa-cart-plus"></i>';
            p.insertAdjacentElement('afterend', b);
        });
    }
    document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('.iba-pb-add-btn') : null;
        if (!b) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const tr = b.closest('tr');
        let ref = '', vendor = '', amount = '';
        try {
            const key = (tr && tr.getAttribute('data-key')) || '';
            const t = (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks)) ? userActiveTasks.find((x) => x && String(x.key) === key) : null;
            if (t) { ref = t.ref || ''; vendor = t.vendorName || ''; amount = taskAmount(t); }
        } catch (_) {}
        const et = b.getAttribute('data-esn-task');
        if (et) {
            const t = (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks)) ? userActiveTasks.find((x) => x && String(x.key) === et) : null;
            const ids = t && window.ibaEsnFlow && window.ibaEsnFlow.taskIds ? window.ibaEsnFlow.taskIds(t) : null;
            if (!t || !ids || !ids.po || !ids.key) { alert('Task not found. Please refresh.'); return; }
            add({ po: ids.po, key: ids.key, ref: t.ref || '', vendor: t.vendorName || '', amount: taskAmount(t), esnTask: true });
            return;
        }
        add({ po: b.getAttribute('data-po'), key: b.getAttribute('data-invkey'), ref, vendor, amount });
    }, true);

    // ------------------------------------------------------------------
    // 17.0.5 patch 24: "Add all approved to print" (Active Task)
    // ------------------------------------------------------------------
    // every approved invoice in my Active Task that has a Print button
    // (all of them, whatever tab / search is shown), not yet in the basket
    function approvedToPrint() {
        const E = window.ibaEsnFlow, A = window.ibaApprovals;
        const list = load(), out = [], seen = {};
        tasks().forEach((t) => {
            let ids = null, esnTask = false;
            try {
                const h = E && E.rowActionsHtml ? E.rowActionsHtml(t) : '';
                // ESN rows: not the ones already printed (they wait for Ready)
                if (h) { if (h.indexOf('iba-esn-print-btn') !== -1 && !t.esnPrintedAt) { ids = E.taskIds(t); esnTask = true; } }
                else if (A && A.isOpenReturn(t) && A.rowActionsHtml(t).indexOf('iba-apv-print-btn') !== -1) ids = A.taskIds(t);
            } catch (_) { ids = null; }
            if (!ids || !ids.po || !ids.key) return;
            const it = { po: String(ids.po), key: String(ids.key), ref: t.ref || '', vendor: t.vendorName || '', amount: taskAmount(t), esnTask: esnTask || undefined };
            const k = it.po + '|' + it.key;
            if (seen[k] || list.some((x) => same(x, it))) return;
            seen[k] = 1;
            out.push(it);
        });
        return out;
    }
    function addAll() {
        const items = approvedToPrint();
        if (!items.length) { flash('All approved invoices are already in the basket'); openPanel(); return; }
        const list = load();
        items.forEach((it) => list.push(Object.assign({ pos: '4', at: Date.now() }, it)));
        save(list);
        flash('Added ' + items.length + '. Check them in the basket.');
        openPanel();
    }
    function paintAllButton() {
        const sec = document.getElementById('wd-activetask');
        const bar = sec && sec.querySelector('.form-buttons-container');
        let b = document.getElementById('iba-pb-all');
        const n = (allowed() && bar) ? approvedToPrint().length : 0;
        if (!n) { if (b) b.remove(); return; }
        if (!b) {
            b = document.createElement('button');
            b.type = 'button';
            b.id = 'iba-pb-all';
            b.className = 'download-btn';
            b.title = 'Put every approved invoice in the print basket. You can still remove or change them there.';
            b.addEventListener('click', addAll);
            bar.insertBefore(b, bar.firstChild);
        }
        const html = '<i class="fa-solid fa-cart-plus"></i> Add all approved to print (' + n + ')';
        if (b.__ibaHtml !== html) { b.innerHTML = html; b.__ibaHtml = html; }
    }

    let queued = false;
    function queue() { if (queued) return; queued = true; setTimeout(() => { queued = false; addActiveTaskButtons(); paintButton(); paintAllButton(); }, 200); }

    function start() {
        paintButton();
        addActiveTaskButtons();
        try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
    window.addEventListener('storage', (e) => { if (e.key === KEY) paintButton(); });

    window.ibaPrintBasket = { add, addAll, approvedToPrint, list: load, open: openPanel, clear: () => save([]), allowed };
})();
