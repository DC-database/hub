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
    function dateOf(t) { try { return (typeof imNoteTextDate === 'function') ? (imNoteTextDate(t) || 0) : 0; } catch (_) { return 0; } }
    function vendorKey(t) {
        let s = ' ' + String(t || '').toLowerCase() + ' ';
        s = s.replace(new RegExp('\\b\\d{1,2}(st|nd|rd|th)?[\\s\\/.,-]*' + MON + '[\\s\\/.,-]*(19|20)\\d{2}\\b', 'g'), ' ')
            .replace(new RegExp('\\b' + MON + '[\\s\\/.,-]*\\d{1,2}(st|nd|rd|th)?[\\s\\/.,-]*(19|20)\\d{2}\\b', 'g'), ' ')
            .replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-](19|20)\d{2}\b/g, ' ')
            .replace(new RegExp('\\b' + MON + '[\\s\\/.,-]*(19|20)\\d{2}\\b', 'g'), ' ')
            .replace(/[^a-z0-9&]+/g, ' ').trim();
        return s;
    }
    function todayUTC() { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
    async function names() {
        try { if (typeof loadInvoiceNoteIndex === 'function') await loadInvoiceNoteIndex(false); } catch (_) {}
        let set = null;
        try { set = (typeof allUniqueNotes !== 'undefined' && allUniqueNotes) ? allUniqueNotes : null; } catch (_) {}
        const out = [];
        (set ? Array.from(set) : []).forEach((t) => { const s = String(t || '').trim(); if (s) out.push({ text: s, date: dateOf(s), vk: vendorKey(s) }); });
        return out;
    }
    function plan(list) {
        const today = todayUTC();
        return list.filter((n) => n.date === today).sort((a, b) => a.text.localeCompare(b.text)).map((n) => {
            const earlier = list.filter((x) => x !== n && x.vk && x.vk === n.vk && x.date && x.date < n.date).sort((a, b) => b.date - a.date);
            return { cur: n.text, prev: earlier[0] ? earlier[0].text : '', options: earlier.map((x) => x.text) };
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
        const rows = plan(await names());
        if (!win) return;
        const body = win.querySelector('.iba-esn-body');
        if (!rows.length) {
            body.innerHTML = '<p class="iba-esn-sub">No summary note has today\'s date in its name yet. Name them like <b>Khalifa Steel ' + esc(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')) + '</b>.</p>';
            return;
        }
        body.innerHTML = '<p class="iba-esn-sub">Each note prints on its own A4 page with its previous note. The previous note is the same vendor\'s latest earlier note; change it if needed.</p>' +
            '<table class="iba-snb-t"><thead><tr><th><input type="checkbox" data-snb-all checked aria-label="All"></th><th>Current note (today)</th><th>Previous note</th></tr></thead><tbody>' +
            rows.map((r, i) => '<tr><td><input type="checkbox" data-snb-on="' + i + '" checked></td><td><b>' + esc(r.cur) + '</b></td><td><select class="iba-esn-place iba-snb-prev" data-snb-prev="' + i + '">' +
                '<option value="">none</option>' + r.options.map((o) => '<option' + (o === r.prev ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></td></tr>').join('') +
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
