/* ==========================================================================
   js/iba-1705-msmenu.js — 17.0.5 patch 46
   Material Stock page, cleaner (martin picked layout A + hints from C):
   1) "More tools ▾" dropdown next to Transfer / Restock / Usage holds the
      extra buttons (Site stock, Stock Report, Required List, Register New
      Material, Stock Check, Upload, Update Titles, Download Titles, Template).
      The real buttons are MOVED into the menu, so their own clicks, rights
      (Inventory permissions) and hiding keep working. "More tools" only shows
      when at least one tool inside is showing for this account.
   2) Movement History (open an item): "Trans no." column; clicking it prints
      that transaction's waybill in its current state (In Transit = waybill,
      Completed = completed delivery). Uses the record already in memory.
   ========================================================================== */
(function () {
    'use strict';
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const $ = (id) => document.getElementById(id);
    function onPhone() { return !!(document.body && (document.body.classList.contains('iba-phone') || document.body.classList.contains('iba-mobile-ui'))); }

    // ---- 1) More tools menu -------------------------------------------------
    const GROUPS = [
        ['Reports', [['iba-ss-btn', 'One site, print or CSV'], ['ms-open-report-modal-btn', 'All stock'], ['ms-open-requestlist-btn', 'What sites need']]],
        ['Materials', [['ms-add-new-btn', 'Add a new item'], ['ms-stock-check-btn', 'Fix counts that do not match']]],
        ['Titles and files', [['ms-upload-csv-btn', 'Add items from a CSV'], ['ms-upload-titles-btn', 'Rename items from a CSV'], ['ms-download-titles-btn', 'Titles as CSV'], ['ms-template-btn', 'Empty CSV to fill']]],
        ['Ticked items', [['ms-merge-selected-btn', 'Join the ticked items into one']]]
    ];
    let wrap = null, panel = null, more = null;

    // tools a person may not use are not listed (same rules as Settings >
    // Inventory permissions; before, some showed and only refused on click)
    const PERM = { 'ms-add-new-btn': 'register', 'ms-upload-csv-btn': 'upload', 'ms-upload-titles-btn': 'titles',
        'ms-download-titles-btn': 'download', 'ms-template-btn': 'download', 'ms-open-report-modal-btn': 'report', 'ms-open-requestlist-btn': 'required' };
    function mayUse(b) {
        const id = PERM[b.id];
        if (!id) return true;
        try { if (window.ibaInvPerm && typeof window.ibaInvPerm.can === 'function') return !!window.ibaInvPerm.can(id); } catch (_) {}
        return true;
    }
    const OFF = { 'ms-download-titles-btn': 'download', 'ms-template-btn': 'download', 'ms-open-report-modal-btn': 'report', 'ms-open-requestlist-btn': 'required',
        'ms-add-new-btn': 'register', 'ms-upload-csv-btn': 'upload', 'ms-upload-titles-btn': 'titles' };
    let exactNow = false;
    function shown(b) {
        if (!b || b.hidden || b.classList.contains('hidden')) return false;
        if (b.closest('.iba-msm-panel')) { const ok = mayUse(b); if (b.classList.contains('iba-msm-no') === ok) b.classList.toggle('iba-msm-no', !ok); if (!ok) return false; }
        // 17.0.5 patch 48: no layout reads (they slowed Material Stock); the
        // "taken away" body classes from Inventory permissions are checked here
        const off = OFF[b.id];
        if (off && document.body.classList.contains('iba-inv-off-' + off)) return false;
        // phone CSS hides print / download buttons: measured only when the menu opens
        if (exactNow) { try { return getComputedStyle(b).display !== 'none'; } catch (_) {} }
        return true;
    }
    function build() {
        const actions = $('ms-transfer-action-btn') && $('ms-transfer-action-btn').parentElement;
        if (!actions) return false;
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'iba-msm';
            wrap.innerHTML = '<button type="button" class="iba-msm-more" aria-haspopup="true" aria-expanded="false"><i class="fa-solid fa-toolbox"></i> More tools <i class="fa-solid fa-chevron-down iba-msm-chev"></i></button>' +
                '<div class="iba-msm-panel" role="menu" hidden></div>';
            more = wrap.querySelector('.iba-msm-more');
            panel = wrap.querySelector('.iba-msm-panel');
            panel.innerHTML = GROUPS.map(([name], gi) => '<div class="iba-msm-group" data-g="' + gi + '"><div class="iba-msm-gname">' + esc(name) + '</div><div class="iba-msm-items"></div></div>').join('');
            // the list lives on <body> (fixed), so no page panel can cut it off
            document.body.appendChild(panel);
            more.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
            // a tool was picked: close the menu (its own click runs first)
            panel.addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(close, 0); });
            // 17.0.5 patch 48: close on any press outside, caught early (capture) so
            // page handlers that stop clicks cannot keep it open
            document.addEventListener('pointerdown', (e) => { if (!panel.hidden && !wrap.contains(e.target) && !panel.contains(e.target)) close(); }, true);
            window.addEventListener('blur', () => { if (!panel.hidden) close(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
            window.addEventListener('resize', place);
            window.addEventListener('scroll', place, true);
        }
        if (wrap.parentElement !== actions) actions.appendChild(wrap);
        // the refresh icon stays on the page, beside More tools
        const ref = $('ms-refresh-btn');
        if (ref && ref.parentElement !== actions) { ref.classList.add('iba-msm-refresh'); actions.insertBefore(ref, wrap); }
        // move the tools in (they keep their own clicks and rules)
        GROUPS.forEach(([, items], gi) => {
            const box = panel.querySelector('.iba-msm-group[data-g="' + gi + '"] .iba-msm-items');
            items.forEach(([id, hint]) => {
                const b = $(id);
                if (!b) return;
                b.setAttribute('data-msm-hint', hint);
                b.setAttribute('role', 'menuitem');
                if (b.parentElement !== box) box.appendChild(b);
            });
        });
        return true;
    }
    function refresh() {
        if (!build()) return;
        let any = false;
        panel.querySelectorAll('.iba-msm-group').forEach((g) => {
            const vis = Array.from(g.querySelectorAll('.iba-msm-items > button')).map(shown).some(Boolean); // check every button (keeps each one's rights fresh)
            g.hidden = !vis;
            if (vis) any = true;
        });
        if (wrap.hidden !== !any) wrap.hidden = !any;
        if (!any) close();
        // the old top toolbar row: hide it when nothing is left showing there
        const tb = document.querySelector('#wd-material-stock .ms-premium-toolbar');
        if (tb) { const empty = !Array.from(tb.querySelectorAll('button')).some(shown); if (tb.classList.contains('iba-msm-empty') !== empty) tb.classList.toggle('iba-msm-empty', empty); }
    }
    function place() {
        if (!panel || panel.hidden) return;
        const r = more.getBoundingClientRect();
        const w = Math.min(320, window.innerWidth - 16);
        panel.style.width = w + 'px';
        panel.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
        const below = window.innerHeight - r.bottom - 12;
        if (below >= 260 || below >= r.top) { panel.style.top = (r.bottom + 6) + 'px'; panel.style.bottom = ''; panel.style.maxHeight = Math.max(160, below) + 'px'; }
        else { panel.style.top = ''; panel.style.bottom = (window.innerHeight - r.top + 6) + 'px'; panel.style.maxHeight = Math.max(160, r.top - 12) + 'px'; }
    }
    function open() { exactNow = true; try { refresh(); } finally { exactNow = false; } panel.hidden = false; more.setAttribute('aria-expanded', 'true'); wrap.classList.add('is-open'); place(); }
    function close() { if (!panel) return; panel.hidden = true; more.setAttribute('aria-expanded', 'false'); wrap.classList.remove('is-open'); }
    function toggle() { if (panel.hidden) open(); else close(); }

    function pageOpen() { const sec = $('wd-material-stock'); return !!sec && !sec.classList.contains('hidden') && !document.hidden; }
    function tick() {
        if (!pageOpen()) { if (panel && !panel.hidden) close(); return; }
        try { refresh(); } catch (e) { console.warn('[IBA] More tools:', e); }
    }
    function start() {
        tick();
        setInterval(tick, 3000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaMsMenu = { open, close, refresh };
})();
