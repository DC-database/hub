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
        (set ? Array.from(set) : []).forEach((t) => { const s = String(t || '').trim(); if (s) { const m = meta[s.toLowerCase()] || {}; out.push({ text: s, date: dateOf(s), vk: vendorKey(s), used: usedAt(s), vid: m.vid || '', vname: m.vname || '' }); } });
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
            '<div class="iba-esn-head"><b><i class="fa-solid fa-print"></i> Print summary notes · today</b>' +
            '<button type="button" class="iba-esn-x" data-snb-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-esn-body"><p class="iba-esn-sub">Loading today\'s notes…</p></div>' +
            '<div class="iba-esn-foot"><span class="iba-esn-sub" data-snb-msg></span><span class="iba-esn-sp"></span>' +
            '<button type="button" class="iba-esn-btn" data-snb-x>Cancel</button>' +
            '<button type="button" class="iba-esn-btn is-go" data-snb-go disabled><i class="fa-solid fa-print"></i> Print all</button></div></div>';
        document.body.appendChild(win);
        win.addEventListener('click', onClick);
        win.addEventListener('change', count);
        let all = await names(false);
        let rows = plan(all);
        if (!rows.length) { all = await names(true); rows = plan(all); }   // one fresh read of the note names
        if (!win) return;
        const body = win.querySelector('.iba-esn-body');
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
            '<table class="iba-snb-t"><thead><tr><th><input type="checkbox" data-snb-all' + (off ? '' : ' checked') + ' aria-label="All"></th><th>' + (off ? 'Note' : 'Current note (today)') + '</th><th>Previous note</th></tr></thead><tbody>' +
            rows.map((r, i) => '<tr><td><input type="checkbox" data-snb-on="' + i + '"' + (r.off ? '' : ' checked') + '></td><td><b>' + esc(r.cur) + '</b></td><td><select class="iba-esn-place iba-snb-prev" data-snb-prev="' + i + '">' +
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
            return on && on.checked ? { cur: r.cur, prev: pv ? pv.value : '' } : null;
        }).filter(Boolean);
    }
    function count(e) {
        if (!win) return;
        if (e && e.target && e.target.hasAttribute && e.target.hasAttribute('data-snb-all')) win.querySelectorAll('[data-snb-on]').forEach((c) => { c.checked = e.target.checked; });
        const n = picked().length;
        const go = win.querySelector('[data-snb-go]');
        if (go) { go.disabled = !n; go.innerHTML = '<i class="fa-solid fa-print"></i> Print all (' + n + ')'; }
    }
    function onClick(e) {
        if (e.target.closest('[data-snb-x]') || e.target === win) { close(); return; }
        const go = e.target.closest('[data-snb-go]');
        if (go && !go.disabled) printAll(picked());
    }
    function msg(t) { const m = win && win.querySelector('[data-snb-msg]'); if (m) m.textContent = t; }

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

    window.ibaSummaryBatch = { open: open, _plan: plan, _vendorKey: vendorKey, _names: names, _print: printAll };
})();
