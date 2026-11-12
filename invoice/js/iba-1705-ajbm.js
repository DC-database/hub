/* 17.0.5 patch 216 (martin's design): Invoice Entry "Active Jobs" panel on the right is opened / hidden
   with a vertical bookmark on its left edge.
   - Only for the Super Admin, and for his replacement while he is on vacation (ibaVacationHandover).
     Everyone else keeps the page exactly as before (Active Jobs button + panel).
   - Open stays open (also after Save or another PO search) until the bookmark is clicked; the choice is
     remembered (localStorage iba-aj-open-v1). Hidden = Invoice Entry uses the full width.
   - Bookmark shows the job count (red; grey 0).
   - Searching a PO that has a waiting job opens the panel by itself and that job glows.
   Nothing is re-created: the app's own panel and list are only slid in / out with a body class. */
(function () {
    'use strict';
    if (window.ibaAjBm) return;
    const KEY = 'iba-aj-open-v1';
    const $ = (id) => document.getElementById(id);
    const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();
    const normPO = (v) => String(v == null ? '' : v).replace(/[^0-9a-z]/gi, '').toUpperCase();
    function getOpen() { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } }
    function setOpen(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (_) {} }
    let open = getOpen();

    function me() { try { return String((typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) || '').trim(); } catch (_) { return ''; } }
    function superName() { try { return (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) ? SUPER_ADMIN_NAME : 'Irwin'; } catch (_) { return 'Irwin'; } }
    function eligible() {
        if (document.body.classList.contains('iba-mobile-ui')) return false;
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        try {
            const vh = window.ibaVacationHandover;
            const away = vh && typeof vh.away === 'function' ? vh.away() : [];
            const sup = norm(superName()), mine = norm(me());
            return !!mine && away.some((a) => a && norm(a.name).indexOf(sup) === 0 && norm(a.target) === mine);
        } catch (_) { return false; }
    }
    function onEntryPage() {
        const s = $('im-invoice-entry');
        if (!s || s.classList.contains('hidden')) return false;
        const r = s.getBoundingClientRect();   // views can be position:fixed, so no offsetParent check
        return r.width > 0 && r.height > 0;
    }
    function panel() { return $('im-entry-sidebar'); }
    function items() { const l = $('im-entry-sidebar-list'); return l ? Array.from(l.querySelectorAll('li.im-sidebar-item')) : []; }
    function count() {
        const t = ($('active-jobs-sidebar-count-display') || {}).textContent || '';
        const m = t.match(/\((\d+)\)/);
        return m ? Number(m[1]) : items().length;
    }

    let bm = null;
    function ensureBm() {
        if (bm && bm.isConnected) return bm;
        bm = document.createElement('button');
        bm.type = 'button';
        bm.id = 'iba-aj-bm';
        bm.title = 'Show / hide Active Jobs';
        bm.innerHTML = '<i class="fa-solid fa-list-check"></i><span>Active Jobs</span><em data-aj-n>0</em>';
        bm.addEventListener('click', (e) => { e.preventDefault(); toggle(!open); });
        document.body.appendChild(bm);
        return bm;
    }
    function showPanel() {
        const p = panel(); if (!p) return;
        if (p.classList.contains('hidden') || !p.classList.contains('visible')) {
            if (typeof imEnsureActiveJobsSidebarVisibleAndLoaded === 'function') { try { imEnsureActiveJobsSidebarVisibleAndLoaded(false); } catch (_) {} }
            else { p.classList.remove('hidden'); p.classList.add('visible'); }
        }
    }
    function toggle(v) {
        open = !!v; setOpen(open);
        if (open) showPanel();
        sync();
    }
    function sync() {
        const on = eligible() && onEntryPage();
        document.body.classList.toggle('iba-aj-on', on);
        document.body.classList.toggle('iba-aj-closed', on && !open);
        const b = ensureBm();
        b.hidden = !on;
        if (!on) return;
        if (open) showPanel();
        const n = count(), em = b.querySelector('[data-aj-n]');
        if (em && em.textContent !== String(n)) em.textContent = String(n);
        b.classList.toggle('is-zero', !n);
        b.classList.toggle('is-open', open);
        const p = panel();
        const w = (open && p) ? Math.round(p.getBoundingClientRect().width) : 0;
        b.style.setProperty('--aj-r', w + 'px');
        glow();
    }

    // searched PO has a waiting job -> open + glow
    let lastPO = '';
    function curPO() { try { return (typeof currentPO !== 'undefined' && currentPO) ? String(currentPO) : ''; } catch (_) { return ''; } }
    function glow() {
        const po = normPO(curPO());
        let hit = null;
        items().forEach((li) => {
            const m = !!po && normPO(li.dataset.po) === po;
            li.classList.toggle('iba-aj-glow', m);
            if (m && !hit) hit = li;
        });
        if (po !== lastPO) {
            lastPO = po;
            if (hit) {
                if (!open) toggle(true);
                try { hit.scrollIntoView({ block: 'nearest' }); } catch (_) {}
            }
        }
    }

    function css() {
        if ($('iba-aj-css')) return;
        const V = '#invoice-management-view#invoice-management-view#invoice-management-view#invoice-management-view';
        const st = document.createElement('style');
        st.id = 'iba-aj-css';
        st.textContent = '@layer iba-ui {' +
            'html body.iba-aj-on ' + V + ' #im-show-active-jobs-btn { display: none !important; }' +
            'html body.iba-shell-on.iba-aj-on ' + V + ' #im-entry-sidebar#im-entry-sidebar { transition: transform .28s ease !important; }' +
            'html body.iba-shell-on.iba-aj-closed ' + V + ' #im-entry-sidebar#im-entry-sidebar { transform: translateX(110%) !important; pointer-events: none !important; }' +
            'html body.iba-shell-on.iba-aj-closed ' + V + ' .workdesk-main.with-sidebar { padding-right: 0 !important; }' +
            'html body.iba-shell-on.iba-aj-closed ' + V + ' .workdesk-main.with-sidebar #im-content-area { padding-right: 0 !important; }' +
            '#iba-aj-bm { position: fixed !important; top: calc(var(--iba-shell-header-h, 64px) + 70px) !important; right: var(--aj-r, 0px) !important; z-index: 10006 !important; width: 40px !important; min-width: 0 !important; height: auto !important; padding: 12px 0 !important; margin: 0 !important; display: flex !important; flex-direction: column !important; align-items: center !important; gap: 9px !important; border-radius: 12px 0 0 12px !important; border: 1px solid rgba(232,197,71,.6) !important; border-right: 0 !important; background: rgba(12,14,17,.86) !important; color: #F3EAD3 !important; -webkit-text-fill-color: #F3EAD3 !important; font: 700 12.5px/1 inherit !important; cursor: pointer !important; box-shadow: -6px 6px 18px rgba(0,0,0,.35) !important; transition: right .28s ease, background .15s !important; }' +
            '#iba-aj-bm[hidden] { display: none !important; }' +
            '#iba-aj-bm:hover { background: rgba(22,25,30,.95) !important; }' +
            '#iba-aj-bm i { color: #e8c547 !important; -webkit-text-fill-color: #e8c547 !important; font-size: 13px !important; }' +
            '#iba-aj-bm span { writing-mode: vertical-rl !important; transform: rotate(180deg) !important; letter-spacing: .02em !important; }' +
            '#iba-aj-bm em { font-style: normal !important; min-width: 20px !important; height: 20px !important; padding: 0 5px !important; border-radius: 999px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; background: #e5484d !important; color: #fff !important; -webkit-text-fill-color: #fff !important; font-size: 11px !important; }' +
            '#iba-aj-bm.is-zero em { background: rgba(255,255,255,.14) !important; color: #9aa4b0 !important; -webkit-text-fill-color: #9aa4b0 !important; }' +
            'html body #im-entry-sidebar li.im-sidebar-item.iba-aj-glow { box-shadow: inset 0 0 0 2px #e8c547, 0 0 14px rgba(232,197,71,.45) !important; border-radius: 8px !important; background: rgba(232,197,71,.10) !important; }' +
            '}';
        document.head.appendChild(st);
    }

    function start() {
        css();
        sync();
        setInterval(sync, 700);
        try {
            const mo = new MutationObserver(() => { clearTimeout(start.t); start.t = setTimeout(sync, 60); });
            const l = $('im-entry-sidebar-list'); if (l) mo.observe(l, { childList: true });
            const c = $('active-jobs-sidebar-count-display'); if (c) mo.observe(c, { childList: true, characterData: true, subtree: true });
        } catch (_) {}
        window.addEventListener('resize', sync);
    }
    window.ibaAjBm = { sync, toggle, eligible };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
