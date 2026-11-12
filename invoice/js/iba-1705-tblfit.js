/* 17.0.5 patch 219 (martin, mock-up https://claude.ai/artifact/XmJfFm6C4z3a3254xiEScb):
   on the list pages ONLY THE LIST SCROLLS. The search / filters / details above it and the column header
   stay where they are (they never slide under the main header any more): the list panel is sized to fill
   the rest of the screen and the page around it is held still.
   Rows that slide under the column header are hidden by a strongly frosted header (18.0.0 p2; the old
   per-row fade made long lists freeze), so nothing can be read through it.
   - PC only (not phone / tablet phone view / iba-mobile-ui). Nothing is re-created: the app's own list
     panel only gets a height and its page scroll is paused while the list is on screen.
   - If the screen is too small (list would be under 220 px) the page scrolls as before.
   window.ibaTblFit.fit() re-measures now; window.ibaTblFit.off = true switches it off for a test. */
(function () {
    'use strict';
    if (window.ibaTblFit) return;
    // the main list of each page (same lists as css/iba-ui-tables.css 23.1)
    const LISTS = [
        '#im-invoice-entry #im-existing-invoices-container > .table-wrapper',
        '#wd-activetask > .table-wrapper',
        '#wd-reporting #reporting-printable-area > .table-wrapper',
        '#inv-active-job > .table-wrapper',
        // Material Stock is NOT here (18.0.0 p3): its own list box already scrolls on its own and the page stays
        // still, and taking it over made a long list laggy. Only its header is darkened (css below).
        '#im-payments .im-payment-cart-table-wrap',
        '#im-reporting .iba-records-sheet > #im-reporting-content',  // 18.0.0 p1: Invoice Records (header is outside the list)
        '#im-batch-entry #im-batch-table-body',                       // 18.0.0 p1: Batch Entry cards
        '#im-po-closeout #im-po-closeout-list',                       // 18.0.0 p1: PO Close Out
        '#wd-taskhistory > .table-wrapper',                           // 18.0.0 p1: Task History
    ];
    const MIN_H = 220, GAP = 14;
    const api = { off: false };

    function pcOk() {
        const b = document.body;
        if (!b || !b.classList.contains('iba-shell-on')) return false;
        if (b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone')) return false;
        return window.innerWidth > 900 && window.innerHeight > 480;
    }
    function shown(el) {
        if (!el || !el.isConnected) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 50 || r.height < 10) return false;
        for (let e = el; e && e !== document.body; e = e.parentElement) {
            if (e.classList && e.classList.contains('hidden')) return false;
            if (e.classList && e.classList.contains('modal-overlay')) return false;
        }
        return true;
    }
    function scrollers(wrap) {
        const out = [];
        for (let e = wrap.parentElement; e && e !== document.body; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (/(auto|scroll)/.test(cs.overflowY) || e.hasAttribute('data-iba-tf-lock')) out.push(e);
            if (/^(workdesk-view|invoice-management-view|inventory-view)$/.test(e.id)) break;
        }
        return out;
    }

    // ---- held page + list height ----
    let cur = null, locked = [], small = '', lastBase = -1, lastSet = 0;
    function set(w, h) { const v = Math.max(0, h) + 'px'; if (w.style.getPropertyValue('max-height') !== v) { w.style.setProperty('max-height', v, 'important'); w.style.setProperty('height', 'auto', 'important'); } }
    function lock(list) {
        list.forEach((e) => {
            if (!e.hasAttribute('data-iba-tf-lock')) {
                e.setAttribute('data-iba-tf-lock', '');
                e.style.setProperty('overflow-y', 'hidden', 'important');
            }
            if (e.scrollTop) e.scrollTop = 0;
        });
        locked.filter((e) => list.indexOf(e) < 0).forEach(unlockOne);
        locked = list.slice();
    }
    function unlockOne(e) { e.removeAttribute('data-iba-tf-lock'); e.style.removeProperty('overflow-y'); }
    function release() {
        locked.forEach(unlockOne); locked = [];
        if (cur) { cur.style.removeProperty('max-height'); cur.style.removeProperty('height'); cur.classList.remove('iba-tf-on'); }
        cur = null; lastBase = -1;
    }
    function pick() {
        for (const s of LISTS) {
            const w = document.querySelector(s);
            if (w && shown(w)) return w;
        }
        return null;
    }
    function fit() {
        if (api.off || !pcOk()) { release(); return; }
        const w = pick();
        if (!w) { release(); return; }
        if (cur && cur !== w) release();
        const sc = scrollers(w);
        const outer = sc[sc.length - 1];
        if (!outer) { release(); return; }
        // where the list starts with the page at the top
        const top0 = w.getBoundingClientRect().top + sc.reduce((a, e) => a + e.scrollTop, 0);
        const bottom = Math.min(outer.getBoundingClientRect().bottom + outer.scrollTop * 0, window.innerHeight);
        const key = Math.round(top0) + ':' + Math.round(bottom) + ':' + Math.round(w.scrollHeight / 40);
        if (cur !== w && small === key) return;           // too small last time, page keeps scrolling
        let room = Math.floor(bottom - top0 - GAP);
        if (room < MIN_H) { small = key; release(); return; }
        cur = w;
        w.classList.add('iba-tf-on');
        lock(sc);
        // 18.0.0 p2: only touch the height when the space really changed. Writing it again every 0.9 s made
        // the browser re-measure the whole table each time: with a long list (Material Stock "All") the page froze.
        if (room !== lastBase || !w.style.getPropertyValue('max-height')) { lastBase = room; set(w, room); lastSet = room; }
        else room = lastSet;
        // whatever is under the list (pager, totals, buttons) must still fit: shrink by the overflow
        for (let k = 0; k < 2; k++) {
            const over = Math.max(0, ...sc.map((e) => e.scrollHeight - e.clientHeight));
            if (!over) break;
            room -= over; set(w, room); lastSet = room;
        }
        if (room < MIN_H) { small = key; release(); return; }
        small = '';
    }

    // 18.0.0 p2: the old row fade (a mask on the rows under the header) is gone. Any mask inside the list
    // makes the browser repaint the whole table on every scroll step: with a long list (Material Stock
    // "All") scrolling froze. Instead the column header is frosted strongly (css below), so rows that slide
    // under it cannot be read, and scrolling stays smooth with thousands of rows.

    function css() {
        if (document.getElementById('iba-tf-css')) return;
        const st = document.createElement('style');
        st.id = 'iba-tf-css';
        st.textContent = '@layer iba-ui {' +
            'html body.iba-shell-on .iba-tf-on { overflow-y: auto !important; }' +
            // frosted header: strong blur so rows under it are not readable (beats the page glass rules)
            // 18.0.0 p4: the column header is SOLID dark (martin could still read rows through it). Being solid it
            // needs no glass blur, and dropping that blur also saves work on every scroll step.
            'html body.iba-shell-on :is(.iba-tf-on, #wd-material-stock .ms-premium-tablewrap):not(#iba-no1):not(#iba-no2):not(#iba-no3):not(#iba-no4):not(#iba-no5) table > thead th {' +
            ' box-shadow: inset 0 0 0 999px rgb(13, 17, 23) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }' +
            '}';
        document.head.appendChild(st);
    }

    let t = 0;
    function soon() { clearTimeout(t); t = setTimeout(fit, 80); }
    function start() {
        css();
        fit();
        setInterval(fit, 900);
        window.addEventListener('resize', soon);
        try { new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
        document.addEventListener('click', () => setTimeout(fit, 120), true);
    }
    api.fit = fit;
    window.ibaTblFit = api;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
