/* ==========================================================================
   js/iba-1705-snbatch.js — 17.0.5 patch 130
   Print summary notes (Super Admin, PC): every summary note dated TODAY in
   one print job, each with its own previous note.
   - Today's notes = note names with today's date in them, from the small
     note-name list the Summary Note already keeps (no invoice download).
   - Previous note = same vendor name (the note name without its date) with
     the latest earlier date, picked from the same list; changeable per row.
   - Print all: for each note the normal Summary Note is generated (same
     screen code, same small note index reads), its design C print page is
     taken, and all pages go to ONE print, each note from a new A4 page with
     its own "Previous note · Current note" line at the page bottom.
   window.ibaSummaryBatch.open()
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaSummaryBatch) return;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (id) => document.getElementById(id);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*';

    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function say(msg) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(msg); } catch (_) {} try { console.info('[IBA summary print] ' + msg); } catch (_) {} }

    // ---- note names ------------------------------------------------------------
    // 17.0.5 patch 131: a name with day + month but no year counts as this year
    const MI = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
    function dateOf(t) {
        const s = String(t || '').toLowerCase();
        if (/(?:^|[^0-9])(19|20)\d{2}(?![0-9])/.test(s)) { try { return (typeof imNoteTextDate === 'function') ? (imNoteTextDate(t) || 0) : 0; } catch (_) { return 0; } }
        const y = new Date().getFullYear();
        let m = /(?:^|[^0-9])(\d{1,2})(?:st|nd|rd|th)?[\s\/.,-]*(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)/.exec(s);
        if (m) return Date.UTC(y, MI[m[2]], Number(m[1]));
        m = /(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s\/.,-]*(\d{1,2})(?![0-9])/.exec(s);
        if (m) return Date.UTC(y, MI[m[1]], Number(m[2]));
        m = /(?:^|[^0-9])(\d{1,2})[\/.-](\d{1,2})(?![0-9\/.-])/.exec(s);
        if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return Date.UTC(y, Number(m[2]) - 1, Number(m[1]));
        return 0;
    }
    function usedAt(t) {
        try { const u = __imInvoiceNoteUsageMeta.get(imInvoiceNoteUsageKey(t)); return (u && Number(u.lastUsedAt)) || 0; } catch (_) { return 0; }
    }
    function vendorKey(t) {
        let s = ' ' + String(t || '').toLowerCase() + ' ';
        s = s.replace(new RegExp('\\b\\d{1,2}(st|nd|rd|th)?[\\s\\/.,-]*' + MON + '[\\s\\/.,-]*(19|20)\\d{2}\\b', 'g'), ' ')
            .replace(new RegExp('\\b' + MON + '[\\s\\/.,-]*\\d{1,2}(st|nd|rd|th)?[\\s\\/.,-]*(19|20)\\d{2}\\b', 'g'), ' ')
            .replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-](19|20)\d{2}\b/g, ' ')
            .replace(new RegExp('\\b' + MON + '[\\s\\/.,-]*(19|20)\\d{2}\\b', 'g'), ' ')
            .replace(new RegExp('\\b\\d{1,2}(st|nd|rd|th)?[\\s\\/.,-]*' + MON + '\\b', 'g'), ' ')
            .replace(new RegExp('\\b' + MON + '[\\s\\/.,-]*\\d{1,2}(st|nd|rd|th)?\\b', 'g'), ' ')
            .replace(/\b\d{1,2}[\/.-]\d{1,2}\b/g, ' ')
            .replace(/\b(19|20)\d{2}\b/g, ' ')
            .replace(/[^a-z0-9&]+/g, ' ').trim();
        return s;
    }
    function todayUTC() { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
    async function names(fresh) {
        try { if (typeof loadInvoiceNoteIndex === 'function') await loadInvoiceNoteIndex(false); } catch (_) {}
        // 17.0.5 patch 133: only the notes used since the last check (fresh = the whole list once more)
        try { if (typeof window.ibaNotesFresh === 'function') await window.ibaNotesFresh(); } catch (_) {}
        if (fresh) { try { if (typeof loadInvoiceNoteIndex === 'function') await loadInvoiceNoteIndex(true); } catch (_) {} }
        try { if ((typeof allPOData === 'undefined' || !allPOData || !Object.keys(allPOData).length) && typeof ensureInvoicePOBaseDataFetched === 'function') await ensureInvoicePOBaseDataFetched(false); } catch (_) {}
        let set = null;
        try { set = (typeof allUniqueNotes !== 'undefined' && allUniqueNotes) ? allUniqueNotes : null; } catch (_) {}
        const meta = noteMeta();
        const out = [];
        (set ? Array.from(set) : []).forEach((t) => { const s = String(t || '').trim(); if (s && (typeof window.ibaNoteIsDated !== 'function' || window.ibaNoteIsDated(s))) { /* p105: summary names have a date */ const m = meta[s.toLowerCase()] || {}; out.push({ text: s, date: dateOf(s), vk: vendorKey(s), used: usedAt(s), vid: m.vid || '', vname: m.vname || '' }); } });
        return out;
    }
    function isToday(n, today) {
        if (n.date) return n.date === today;
        const d = n.used ? new Date(n.used) : null;     // no date in the name: used today
        return !!d && Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) === today;
    }
    // 17.0.5 patch 132: same vendor even when the name grew or shrank
    // ("SunTech" = "SunTech Trading" = "Suntech Trading W.L.L.")
    const FILL = new Set(['trading', 'trade', 'traders', 'co', 'company', 'est', 'establishment', 'wll', 'w', 'l', 'llc', 'ltd', 'limited', 'qatar', 'doha', 'for', 'and', '&', 'the', 'group', 'contracting', 'contractors', 'services', 'service', 'general', 'gen', 'cont', 'intl', 'international', 'new', 'summary', 'note', 'payment']);
    function core(vk) { return String(vk || '').split(' ').filter((w) => w && !FILL.has(w)); }
    function sameVendor(a, b) {
        if (a.vid && b.vid && a.vid === b.vid) return 3;          // same vendor ID
        if (a.vname && b.vname && a.vname === b.vname) return 3;  // same vendor on the invoices
        if (!a.vk || !b.vk) return 0;
        if (a.vk === b.vk) return 2;
        const x = core(a.vk), y = core(b.vk);
        if (!x.length || !y.length) return 0;
        const short = x.length <= y.length ? x : y, long = short === x ? y : x;
        if (short.join(' ').length < 4) return 0;
        // every main word of the shorter name is in the longer one, first word the same
        // 17.0.5 patch 136: a cut-short word counts too ("Fittin" = "Fittings", "Pipe" = "Pipeline")
        const same = (w, v) => w === v || (Math.min(w.length, v.length) >= 4 && (w.indexOf(v) === 0 || v.indexOf(w) === 0));
        return same(short[0], long[0]) && short.every((w) => long.some((v) => same(w, v))) ? 1 : 0;
    }
    function earlierOf(list, n) {
        return list.filter((x) => x !== n && x.date && n.date && x.date < n.date && sameVendor(x, n)).sort((a, b) => b.date - a.date);
    }
    // 17.0.5 patch 132: each note's vendor ID from the saved note list (its last PO -> POVALUE2 Supplier ID)
    function noteMeta() {
        const out = {};
        let data = null;
        try { const c = (typeof getCache === 'function') ? getCache(typeof IM_NOTE_INDEX_CACHE_KEY !== 'undefined' ? IM_NOTE_INDEX_CACHE_KEY : 'cached_INVOICE_NOTE_INDEX') : null; data = c && c.data; } catch (_) {}
        const list = Array.isArray(data) ? data : Object.values(data || {});
        let pos = null;
        try { pos = (typeof allPOData !== 'undefined' && allPOData) ? allPOData : null; } catch (_) {}
        list.forEach((it) => {
            if (!it || typeof it !== 'object') return;
            const t = String(it.text || it.note || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (!t) return;
            let po = String(it.lastPO || '').trim().toUpperCase();
            if (!po && it.refs && typeof it.refs === 'object') { const r = Object.values(it.refs)[0]; po = String((r && r.po) || '').trim().toUpperCase(); }
            const row = po && pos ? (pos[po] || null) : null;
            const vid = row ? String(row['Supplier ID'] || row['Supplier ID:'] || row['Vendor ID'] || '').trim() : '';
            out[t] = { vid: vid, vname: String(it.lastVendor || (row && row['Supplier Name']) || '').trim().toLowerCase() };
        });
        return out;
    }
    function plan(list) {
        const today = todayUTC();
        return list.filter((n) => isToday(n, today)).sort((a, b) => a.text.localeCompare(b.text)).map((n) => {
            const earlier = earlierOf(list, n);
            const others = list.filter((x) => x !== n && earlier.indexOf(x) === -1 && x.date && x.date < n.date).sort((a, b) => a.text.localeCompare(b.text)).map((x) => x.text);
            return { cur: n.text, prev: earlier[0] ? earlier[0].text : '', options: earlier.map((x) => x.text), others: others };
        });
    }

    // 18.0.0 patch 104 (martin): only the summary notes whose invoices are in CEO Approval now.
    // Read only the CEO Approval rows of invoice_tasks_by_user/All (indexed on status), never invoice_entries.
    async function ceoNotes() {
        const out = {};
        let rows = {};
        try {
            const r = invoiceDb.ref('invoice_tasks_by_user/All');
            const ok = (typeof wdAllStatusIndexed === 'function') ? await wdAllStatusIndexed() : true;
            if (ok) rows = (await r.orderByChild('status').equalTo('CEO Approval').once('value')).val() || {};
            else if (typeof window.wdReadApprovalRowsFromAll === 'function') rows = await window.wdReadApprovalRowsFromAll();
        } catch (e) { console.warn('[IBA summary print] CEO Approval rows not read', e); return null; }
        Object.keys(rows || {}).forEach((k) => {
            const x = rows[k] || {};
            if (String(x.status || '').trim().toLowerCase() !== 'ceo approval') return;
            const t = (typeof window.ibaSumNoteOf === 'function') ? window.ibaSumNoteOf(x) : String(x.note || '').replace(/\s+/g, ' ').trim(); // p105: the Summary note
            if (!t) return;
            const key = t.toLowerCase();
            if (!out[key]) out[key] = { text: t, n: 0, items: [] };
            out[key].n++;
            // 18.0.0 patch 107: which invoices, for "Add to Batch Entry"
            const po = String(x.po || x.originalPO || '').trim(), ik = String(x.invoiceKey || x.key || k || '').trim();
            if (po && ik) out[key].items.push({ po: po, key: ik });
        });
        return out;
    }

    // 18.0.0 patch 105: shared with the Summary Note page suggestions (js/iba-1800-sumnote.js)
    function recentFrom() { const q = new Date(Date.now() + 3 * 3600e3); return Date.UTC(q.getUTCFullYear(), q.getUTCMonth() - 1, 1); } // 1st of last month, Qatar
    function noteObj(t, meta) { const m = (meta || {})[String(t).toLowerCase()] || {}; return { text: t, date: dateOf(t), vk: vendorKey(t), used: 0, vid: m.vid || '', vname: m.vname || '' }; }
    function knownNames() {
        let set = null;
        try { set = (typeof allUniqueNotes !== 'undefined' && allUniqueNotes) ? allUniqueNotes : null; } catch (_) {}
        return (set ? Array.from(set) : []).map((t) => String(t || '').replace(/\s+/g, ' ').trim()).filter((t) => t && (typeof window.ibaNoteIsDated !== 'function' || window.ibaNoteIsDated(t)));
    }
    // current note suggestions: this month and last month, newest first
    function currentOptions() {
        const from = recentFrom();
        const seen = new Set();
        return knownNames().map((t) => ({ t: t, d: dateOf(t) })).filter((x) => x.d >= from && !seen.has(x.t.toLowerCase()) && seen.add(x.t.toLowerCase()))
            .sort((a, b) => (b.d - a.d) || a.t.localeCompare(b.t)).map((x) => x.t);
    }
    // previous note suggestions: same vendor, before the current note, the newest `limit`
    function previousOptions(cur, limit) {
        const c = String(cur || '').replace(/\s+/g, ' ').trim();
        if (!c) return [];
        const meta = noteMeta();
        const list = knownNames().map((t) => noteObj(t, meta));
        const me = list.find((x) => x.text.toLowerCase() === c.toLowerCase()) || noteObj(c, meta);
        return earlierOf(list, me).filter((x, i, a) => a.findIndex((y) => y.text.toLowerCase() === x.text.toLowerCase()) === i).slice(0, limit || 3).map((x) => x.text);
    }

    // ---- the window ---------------------------------------------------------------
    let win = null;
    function close() { if (win) { win.remove(); win = null; } }
    async function open() {
        if (!isSuper()) { say('Print summary notes is for the Super Admin only.'); return; }
        close();
        win = document.createElement('div');
        win.id = 'iba-esn';
        win.className = 'iba-esn-ov iba-snb';
        win.innerHTML = '<div class="iba-esn-box is-wide" role="dialog" aria-modal="true" aria-label="Print summary notes">' +
            '<div class="iba-esn-head"><b><i class="fa-solid fa-print"></i> Print summary notes · CEO Approval</b>' +
            '<button type="button" class="iba-esn-x" data-snb-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-esn-body"><p class="iba-esn-sub">Loading the notes in CEO Approval…</p></div>' +
            '<div class="iba-esn-foot"><span class="iba-esn-sub" data-snb-msg></span><span class="iba-esn-sp"></span>' +
            '<button type="button" class="iba-esn-btn" data-snb-x>Cancel</button>' +
            (typeof window.ibaAddToBatch === 'function' ? '<button type="button" class="iba-esn-btn" data-snb-batch disabled title="Put the CEO Approval invoices of the ticked notes in Batch Entry"><i class="fa-solid fa-table-list"></i> Add to Batch Entry</button>' : '') +
            '<button type="button" class="iba-esn-btn is-go" data-snb-go disabled><i class="fa-solid fa-print"></i> Print all</button></div></div>';
        document.body.appendChild(win);
        win.addEventListener('click', onClick);
        win.addEventListener('change', count);
        // 18.0.0 patch 104: the notes in CEO Approval (not "dated today" any more)
        const [allNames, ceo] = await Promise.all([names(false), ceoNotes()]);
        let all = allNames;
        if (!win) return;
        const body = win.querySelector('.iba-esn-body');
        if (ceo === null) { body.innerHTML = '<p class="iba-esn-sub">Could not read the CEO Approval list. Check the connection and try again.</p>'; return; }
        const ceoKeys = Object.keys(ceo);
        if (!ceoKeys.length) { body.innerHTML = '<p class="iba-esn-sub">No summary note is in CEO Approval right now.</p>'; return; }
        ceoKeys.forEach((k) => { if (!all.some((n) => n.text.toLowerCase() === k)) all.push({ text: ceo[k].text, date: dateOf(ceo[k].text), vk: vendorKey(ceo[k].text), used: 0, vid: '', vname: '' }); });
        let rows = all.filter((n) => ceo[n.text.toLowerCase()]).sort((a, b) => (b.date - a.date) || a.text.localeCompare(b.text)).map((n) => {
            const earlier = earlierOf(all, n);
            const others = all.filter((x) => x !== n && earlier.indexOf(x) === -1 && x.date && (!n.date || x.date < n.date)).sort((a, b) => a.text.localeCompare(b.text)).map((x) => x.text);
            // 18.0.0 patch 105 (martin): previous = the same vendor's 3 newest earlier notes; other notes only from the last 2 months
            const from = recentFrom();
            return { cur: n.text, prev: earlier[0] ? earlier[0].text : '', options: earlier.slice(0, 3).map((x) => x.text), others: all.filter((x) => x !== n && earlier.indexOf(x) === -1 && x.date && x.date >= from && (!n.date || x.date < n.date)).sort((a, b) => b.date - a.date).map((x) => x.text), count: ceo[n.text.toLowerCase()].n, items: ceo[n.text.toLowerCase()].items };
        });
        if (!rows.length) {
            // nothing dated today: the newest notes, to tick by hand
            const recent = all.slice().sort((a, b) => (b.used || b.date) - (a.used || a.date)).slice(0, 12);
            recent.forEach((n) => {
                const earlier = earlierOf(all, n);
                const others = all.filter((x) => x !== n && earlier.indexOf(x) === -1).sort((a, b) => a.text.localeCompare(b.text)).map((x) => x.text);
                rows.push({ cur: n.text, prev: earlier[0] ? earlier[0].text : '', options: earlier.map((x) => x.text), others: others, off: true });
            });
            if (!rows.length) { body.innerHTML = '<p class="iba-esn-sub">No summary notes found on this computer yet. Open the Summary Note once, then try again.</p>'; return; }
        }
        const off = rows.some((r) => r.off);
        body.innerHTML = (off ? '<p class="iba-esn-sub"><b>No note with today\'s date found.</b> Here are your newest notes: tick the ones to print.</p>' : '') + '<p class="iba-esn-sub">Each note prints on its own A4 page with its previous note. The previous note is the same vendor\'s latest earlier note; change it if needed.</p>' +
            '<table class="iba-snb-t"><thead><tr><th><input type="checkbox" data-snb-all' + (off ? '' : ' checked') + ' aria-label="All"></th><th>' + (off ? 'Note' : 'Summary note (CEO Approval)') + '</th><th>Previous note</th></tr></thead><tbody>' +
            rows.map((r, i) => '<tr><td><input type="checkbox" data-snb-on="' + i + '"' + (r.off ? '' : ' checked') + '></td><td><b>' + esc(r.cur) + '</b>' + (r.count ? ' <span class="iba-esn-sub">· ' + r.count + ' invoice' + (r.count === 1 ? '' : 's') + '</span>' : '') + '</td><td><select class="iba-esn-place iba-snb-prev" data-snb-prev="' + i + '">' +
                '<option value="">none</option>' + (r.options.length ? '<optgroup label="Same vendor">' + r.options.map((o) => '<option' + (o === r.prev ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</optgroup>' : '') +
                ((r.others || []).length ? '<optgroup label="Other notes">' + r.others.map((o) => '<option>' + esc(o) + '</option>').join('') + '</optgroup>' : '') + '</select></td></tr>').join('') +
            '</tbody></table>';
        win.__rows = rows;
        count();
    }
    function picked() {
        if (!win || !win.__rows) return [];
        return win.__rows.map((r, i) => {
            const on = win.querySelector('[data-snb-on="' + i + '"]');
            const pv = win.querySelector('[data-snb-prev="' + i + '"]');
            return on && on.checked ? { cur: r.cur, prev: pv ? pv.value : '', items: r.items || [] } : null;
        }).filter(Boolean);
    }
    function count(e) {
        if (!win) return;
        if (e && e.target && e.target.hasAttribute && e.target.hasAttribute('data-snb-all')) win.querySelectorAll('[data-snb-on]').forEach((c) => { c.checked = e.target.checked; });
        const n = picked().length;
        const go = win.querySelector('[data-snb-go]');
        if (go) { go.disabled = !n; go.innerHTML = '<i class="fa-solid fa-print"></i> Print all (' + n + ')'; }
        const bt = win.querySelector('[data-snb-batch]');
        if (bt) { const k = picked().reduce((a, r) => a + r.items.length, 0); bt.disabled = !k; bt.innerHTML = '<i class="fa-solid fa-table-list"></i> Add to Batch Entry' + (k ? ' (' + k + ')' : ''); }
    }
    function onClick(e) {
        if (e.target.closest('[data-snb-x]') || e.target === win) { close(); return; }
        const go = e.target.closest('[data-snb-go]');
        if (go && !go.disabled) printAll(picked());
        const bt = e.target.closest('[data-snb-batch]');
        if (bt && !bt.disabled) toBatch(picked(), bt);
    }
    function msg(t) { const m = win && win.querySelector('[data-snb-msg]'); if (m) m.textContent = t; }

    // 18.0.0 patch 107 (martin): the ticked notes' invoices go to Batch Entry with their summary note.
    // Only invoices still in CEO Approval go (each one's status is read on its own, never the whole list).
    async function toBatch(list, btn) {
        const seen = {}, items = [];
        list.forEach((r) => (r.items || []).forEach((it) => { const id = it.po + '/' + it.key; if (!seen[id]) { seen[id] = 1; items.push(it); } }));
        if (!items.length) { msg('No invoice to add.'); return; }
        btn.disabled = true;
        msg('Checking ' + items.length + ' invoice' + (items.length === 1 ? '' : 's') + '…');
        const ok = [];
        let moved = 0;
        for (const it of items) {
            let st = '';
            try { st = String((await invoiceDb.ref('invoice_entries/' + it.po + '/' + it.key + '/status').once('value')).val() || ''); } catch (_) {}
            if (st.trim().toLowerCase() === 'ceo approval') ok.push(it); else moved++;
        }
        if (!ok.length) { msg('None of these invoices is in CEO Approval any more.'); btn.disabled = false; return; }
        msg('Adding ' + ok.length + ' to Batch Entry…');
        try {
            const r = await window.ibaAddToBatch(ok);
            if (r && r.error) throw new Error(r.error);
            const added = (r.added || []).length, had = (r.already_in_batch || []).length, miss = (r.not_added || []).length;
            say(added + ' added to Batch Entry' + (had ? ', ' + had + ' already there' : '') + (moved ? ', ' + moved + ' skipped (no longer CEO Approval)' : '') + (miss ? ', ' + miss + ' not found' : '') + '.');
            close();
        } catch (err) {
            btn.disabled = false;
            msg('Could not add them: ' + ((err && err.message) || err));
        }
    }

    // ---- build every page, then one print -------------------------------------------
    async function openSummaryScreen() {
        const area = $('summary-note-printable-area');
        const sec = $('im-summary-note');
        if (sec && !sec.classList.contains('hidden') && sec.getClientRects().length) return;
        const nav = document.querySelector('[data-iba-nav="im-summary-note"]') || $('summary-note-nav-link');
        if (nav) nav.click();
        for (let i = 0; i < 30; i++) { await wait(200); if (sec && sec.getClientRects().length) break; }
        void area;
    }
    async function printAll(list) {
        if (!list.length || typeof handleGenerateSummary !== 'function' || typeof window.ibaSummaryPrintBuild !== 'function') { say('The Summary Note is not ready on this page.'); return; }
        const go = win && win.querySelector('[data-snb-go]');
        if (go) go.disabled = true;
        await openSummaryScreen();
        const prevIn = $('summary-note-previous-input'), curIn = $('summary-note-current-input'), noteIn = $('summary-note-custom-notes-input');
        const keep = { prev: prevIn ? prevIn.value : '', cur: curIn ? curIn.value : '', note: noteIn ? noteIn.value : '' };
        const oldAlert = window.alert;
        const skipped = [];
        let lastAlert = '';
        window.alert = (m) => { lastAlert = String(m || ''); };
        const pages = [];
        let style = '';
        try {
            for (let i = 0; i < list.length; i++) {
                const it = list[i];
                msg('Preparing ' + (i + 1) + ' of ' + list.length + ': ' + it.cur);
                if (prevIn) prevIn.value = it.prev;
                if (curIn) curIn.value = it.cur;
                if (noteIn) noteIn.value = '';
                lastAlert = '';
                await handleGenerateSummary();
                await wait(150);
                const area = $('summary-note-printable-area');
                const rows = document.querySelectorAll('#sn-table-body tr').length;
                if (!area || area.classList.contains('hidden') || !rows) { skipped.push(it.cur + (lastAlert ? ' (' + lastAlert + ')' : '')); continue; }
                window.__ibaSnBatch = false;
                window.ibaSummaryPrintBuild();
                const host = $('sn-c');
                const root = host && host.shadowRoot;
                if (!root) { skipped.push(it.cur); continue; }
                const st = root.querySelector('style');
                if (st && !style) style = st.textContent;
                const page = root.querySelector('.p');
                if (page) pages.push({ html: page.outerHTML, foot: [it.prev ? 'Previous note: ' + it.prev : '', 'Current note: ' + it.cur].filter(Boolean).join('   ·   ') });
            }
        } catch (e) {
            console.warn('[IBA summary print]', e);
        } finally {
            window.alert = oldAlert;
        }
        if (!pages.length) { msg(''); if (go) go.disabled = false; say('Nothing to print: ' + (skipped.join('; ') || 'no invoices found')); return; }
        // one shadow page with every summary; each has its own named @page (own bottom line)
        const host = $('sn-c');
        const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
        root.innerHTML = '<style>' + style + '\n.snb + .snb{break-before:page}</style>' +
            pages.map((p, i) => '<div class="snb" style="page:snb' + i + '">' + p.html + '</div>').join('');
        let css = '@media print { @page sn-c { margin-bottom: 18mm; }';
        pages.forEach((p, i) => {
            const t = p.foot.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
            css += ' @page snb' + i + ' { size: A4 portrait; margin: 6mm 7mm 18mm 7mm; @bottom-left { content: "' + t + '"; font-family: "Segoe UI", Inter, Arial, sans-serif; font-size: 7.5pt; font-style: italic; color: #8a97a3; vertical-align: top; } }';
        });
        css += ' }';
        let ps = $('sn-c-page');
        if (!ps) { ps = document.createElement('style'); ps.id = 'sn-c-page'; document.head.appendChild(ps); }
        ps.textContent = css;
        document.body.classList.add('iba-sn-print-c');
        window.__ibaSnBatch = true;
        close();
        const done = () => {
            window.removeEventListener('afterprint', done);
            window.__ibaSnBatch = false;
            if (prevIn) prevIn.value = keep.prev;
            if (curIn) curIn.value = keep.cur;
            if (noteIn) noteIn.value = keep.note;
            document.body.classList.remove('iba-sn-print-c');
        };
        window.addEventListener('afterprint', done);
        if (skipped.length) say('Not printed (no invoices): ' + skipped.join('; '));
        await wait(60);
        window.print();
    }

    window.ibaSummaryBatch = { currentOptions, previousOptions, // p105
        open: open, _plan: plan, _vendorKey: vendorKey, _names: names, _print: printAll };
})();
