/* ==========================================================================
   js/iba-live-counts.js  —  14.0.0 patch 8
   Live counts for "Active Task" (WorkDesk) and "Active Job" (Inventory).

   While a person has something to act on, the top bar shows a glowing pill
   with the number (it breathes, its dot blinks, and the number counts up or
   down when it changes). The same number sits on the side-menu items and in
   the browser tab title. At zero the pill goes away.

   Which tasks count: exactly the ones Active Task / Active Job already mark
   for you (the same rules the 13.x side menu used for its blinking count):
     - Active Task: tasks whose Attention names you (or the person you cover
       on vacation), not On Hold;
     - Active Job: the inventory requests waiting for YOUR step (source
       confirmation, approval, receiving, ...).

   Download budget: no new full downloads.
     - The exact number is taken every time the Active Task / Active Job list
       is built (Dashboard start, opening the page, the existing refreshes).
     - Between those, the number follows:
         * your own small task inbox (invoice_tasks_by_user/<you>), listened
           to live: Firebase sends only the changes;
         * the WorkDesk job list the Dashboard already keeps in memory;
         * the newest inventory requests only (the last 60), listened to
           live. Older inventory requests are counted from the last time the
           full list was opened.
   No logic, rules or saving is changed.
   ========================================================================== */
(function () {
    'use strict';

    const VERSION = '14.0.0-p8';
    const INV_WINDOW = 60;
    const INV_KEYS_STORE = 'iba-live-inv-keys-v1';
    const INV_KEYS_TTL = 3 * 24 * 60 * 60 * 1000;
    const ON_HOLD = /on hold/i;

    const $ = (id) => document.getElementById(id);
    const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();

    const st = {
        user: '',
        running: false,
        offs: [],
        timer: 0,
        wd: { exact: null, exactAt: 0, live: null, liveReady: false, liveChangedAt: 0, liveSig: '', shown: null },
        inv: { exact: null, exactAt: 0, live: null, liveReady: false, liveChangedAt: 0, liveSig: '', shown: null,
               window: null, windowPrimed: false, baseKeys: null },
        inbox: {},
        inboxPrimed: {},
        inboxBuckets: [],
        delegators: []
    };

    // ------------------------------------------------------------------
    // Who am I
    // ------------------------------------------------------------------
    function me() {
        try { return String((typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) || '').trim(); } catch (_) { return ''; }
    }
    function delegatorsNow() {
        try { return (typeof getDelegatorsForReplacement === 'function') ? (getDelegatorsForReplacement(me()) || []) : []; } catch (_) { return []; }
    }
    function safeKey(v) { return String(v || '').trim().replace(/[.#$[\]\/\\]/g, '_').replace(/\s+/g, '_'); }

    // Same name test as Active Task (direct Attention, multi-name values allowed)
    function mentions(attention, name) {
        const a = norm(attention);
        const n = norm(name);
        if (!a || !n) return false;
        if (['all', 'site', 'accounting', 'accounts', 'finance'].indexOf(a) !== -1) return false;
        if (a === n) return true;
        const parts = a.split(/\s*(?:,|;|\/|\||&|\+|->|➔|\band\b|\bor\b)\s*/i).map((v) => v.trim()).filter(Boolean);
        if (parts.indexOf(n) !== -1) return true;
        const np = n.split(/\s+/).filter(Boolean);
        return np.length >= 2 && np.every((p) => a.indexOf(p) !== -1);
    }
    function forMeOrDelegated(attention) {
        if (mentions(attention, me())) return true;
        return st.delegators.some((d) => mentions(attention, d));
    }
    function isMeOrDelegated(nameVal) { // inventory steps: exact name
        const n = norm(nameVal);
        if (!n) return false;
        if (n === norm(me())) return true;
        return st.delegators.some((d) => norm(d) === n);
    }

    function taskComplete(e) {
        try { if (typeof isTaskComplete === 'function') return !!isTaskComplete(e); } catch (_) {}
        return false;
    }
    function isInvRecord(e) {
        try { if (typeof isInventoryTaskRecord === 'function') return !!isInventoryTaskRecord(e); } catch (_) {}
        const t = String((e && (e.for || e.jobType)) || '');
        return !!e && (e.source === 'transfer_entry' || ['Transfer', 'Restock', 'Return', 'Usage'].indexOf(t) !== -1);
    }

    // ------------------------------------------------------------------
    // WorkDesk: Active Task count (same filter as Active Task)
    // ------------------------------------------------------------------
    function wdJobKeys(out) {
        let list = [];
        try { if (typeof workdeskSystemEntries !== 'undefined' && Array.isArray(workdeskSystemEntries)) list = workdeskSystemEntries; } catch (_) {}
        let invData = null;
        try { if (typeof allInvoiceData !== 'undefined') invData = allInvoiceData; } catch (_) {}
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e || !e.key || isInvRecord(e)) continue;
            if (taskComplete(e)) continue;
            if (e.for === 'Invoice' && e.po && invData && invData[e.po]) {
                const cur = e.remarks || e.status || '';
                if (cur !== 'New Entry' && cur !== 'Pending') continue;
            }
            if (!e.attention || !String(e.attention).trim() || norm(e.attention) === 'none') continue;
            if (!forMeOrDelegated(e.attention)) continue;
            let display = e.remarks || e.status || 'Pending';
            if (e.for === 'Invoice' && display === 'Pending') display = 'New Entry';
            if (ON_HOLD.test(String(e.status || display || ''))) continue;
            out.add(String(e.key));
        }
        return list.length;
    }

    function inboxStatus(row) {
        try { if (typeof wdActiveTaskStatusFromLookup === 'function') return wdActiveTaskStatusFromLookup(row); } catch (_) {}
        return String(row.status || row.remarks || '').trim();
    }
    function inboxInactive(status) {
        try { if (typeof wdActiveTaskIsInactiveInvoiceStatus === 'function') return wdActiveTaskIsInactiveInvoiceStatus(status); } catch (_) {}
        return !status || /with accounts|srv done|paid|closed|cancel|completed|^done$|under review/i.test(status);
    }

    function wdInboxKeys(out) {
        Object.keys(st.inbox).forEach((bucket) => {
            const rows = st.inbox[bucket] || {};
            Object.keys(rows).forEach((invKey) => {
                const row = rows[invKey];
                if (!row || typeof row !== 'object') return;
                const status = inboxStatus(row);
                if (!status || inboxInactive(status)) return;
                if (!forMeOrDelegated(row.attention || '')) return;
                if (ON_HOLD.test(String(row.status || status || ''))) return;
                const po = String(row.po || row.originalPO || '').trim();
                out.add(po + '_' + invKey);
            });
        });
    }

    function recountWorkdesk(reason) {
        if (!st.running) return;
        const keys = new Set();
        const n = wdJobKeys(keys);
        wdInboxKeys(keys);
        const sig = Array.from(keys).sort().join(',');
        const primed = st.inboxBuckets.length > 0 && st.inboxBuckets.every((b) => st.inboxPrimed[b]);
        if (!primed && !n) return;
        // The first complete reading is the starting point; only later changes
        // (a new or finished task) take over from the exact Active Task number.
        if (primed && st.wd.baseline && sig !== st.wd.liveSig) st.wd.liveChangedAt = Date.now();
        if (primed && !st.wd.baseline) st.wd.baseline = true;
        st.wd.live = keys.size;
        st.wd.liveReady = true;
        st.wd.liveSig = sig;
        paint(reason || 'wd-live');
    }

    // ------------------------------------------------------------------
    // Inventory: Active Job count (same rules as Active Job)
    // ------------------------------------------------------------------
    function normalizeTransfer(key, value) {
        if (!value || typeof value !== 'object') return null;
        return Object.assign({}, value, {
            key: key,
            source: 'transfer_entry',
            jobType: value.jobType || 'Transfer',
            for: value.jobType || 'Transfer',
            remarks: value.remarks || value.status || 'Pending'
        });
    }

    function invMine(e) {
        if (!e || !isInvRecord(e)) return false;
        if (taskComplete(e)) return false;
        const forType = String(e.for || '');
        const isTransfer = ['Transfer', 'Restock', 'Return', 'Usage'].indexOf(forType) !== -1;
        const blank = !e.attention || !String(e.attention).trim() || norm(e.attention) === 'none';
        if (blank && !isTransfer) return false;
        let listed;
        if (isTransfer) {
            const r = e.remarks;
            if (r === 'Pending Confirmation') listed = isMeOrDelegated(e.requestor);
            else if (r === 'Pending Source') listed = isMeOrDelegated(e.sourceContact);
            else if (r === 'Pending Admin' || r === 'Pending') listed = isMeOrDelegated(e.approver) || isMeOrDelegated(e.attention);
            else if (r === 'Approved' || r === 'In Transit') listed = isMeOrDelegated(e.receiver);
            else listed = isMeOrDelegated(e.attention);
        } else {
            listed = isMeOrDelegated(e.attention);
        }
        if (!listed) return false;
        // urgent = the step is addressed to me directly
        const s = String(e.remarks || e.status || '').trim();
        let who = e.attention;
        if (s === 'Pending Confirmation') who = e.requestor || e.attention;
        else if (s === 'Pending Source') who = e.sourceContact || e.attention;
        else if (s === 'Pending Admin' || s === 'Pending') who = e.approver || e.attention;
        else if (s === 'Approved' || s === 'In Transit') who = e.receiver || e.attention;
        if (!mentions(who, me())) return false;
        if (ON_HOLD.test(String(e.remarks || e.status || ''))) return false;
        if (e.remarks === 'SRV Done') return false;
        return true;
    }

    function loadStoredInvKeys() {
        try {
            const raw = JSON.parse(localStorage.getItem(INV_KEYS_STORE) || 'null');
            if (raw && raw.user === norm(me()) && Array.isArray(raw.keys) && (Date.now() - Number(raw.at || 0)) < INV_KEYS_TTL) return raw.keys.map(String);
        } catch (_) {}
        return null;
    }
    function storeInvKeys(keys) {
        try { localStorage.setItem(INV_KEYS_STORE, JSON.stringify({ user: norm(me()), at: Date.now(), keys: Array.from(keys) })); } catch (_) {}
    }

    function fullInventoryList() {
        try { if (typeof inventorySystemEntries !== 'undefined' && Array.isArray(inventorySystemEntries) && inventorySystemEntries.length) return inventorySystemEntries; } catch (_) {}
        return null;
    }

    function recountInventory(reason) {
        if (!st.running) return;
        const full = fullInventoryList();
        const win = st.inv.window || {};
        const winKeys = Object.keys(win);
        const keys = new Set();
        if (full) {
            const winSet = new Set(winKeys);
            for (let i = 0; i < full.length; i++) {
                const e = full[i];
                if (!e || winSet.has(String(e.key))) continue;
                if (invMine(e)) keys.add(String(e.key));
            }
        } else if (st.inv.baseKeys) {
            const winSet = new Set(winKeys);
            st.inv.baseKeys.forEach((k) => { if (!winSet.has(k)) keys.add(k); });
        }
        winKeys.forEach((k) => {
            const e = normalizeTransfer(k, win[k]);
            if (invMine(e)) keys.add(k);
        });
        const ready = st.inv.windowPrimed || !!full || !!st.inv.baseKeys;
        if (!ready) return;
        if (full) {
            // remember the older requests that are mine, for the next visit
            const older = Array.from(keys);
            storeInvKeys(older);
            st.inv.baseKeys = older;
        }
        const sig = Array.from(keys).sort().join(',');
        const primed = st.inv.windowPrimed;
        if (primed && st.inv.baseline && sig !== st.inv.liveSig) st.inv.liveChangedAt = Date.now();
        if (primed && !st.inv.baseline) st.inv.baseline = true;
        st.inv.live = keys.size;
        st.inv.liveReady = true;
        st.inv.liveSig = sig;
        paint(reason || 'inv-live');
    }

    // ------------------------------------------------------------------
    // Exact numbers from the Active Task / Active Job lists
    // ------------------------------------------------------------------
    function hookExact() {
        const orig = window.updateActiveTaskModuleBadges;
        if (typeof orig !== 'function' || orig.__ibaLive) return;
        const wrapped = function (urgentCount, totalTaskCount, moduleName) {
            let r;
            try { r = orig.apply(this, arguments); } finally {
                try { takeExact(urgentCount, moduleName); } catch (err) { console.warn('[IBA live counts]', err); }
            }
            return r;
        };
        wrapped.__ibaLive = true;
        window.updateActiveTaskModuleBadges = wrapped;
    }

    function takeExact(urgentCount, moduleName) {
        const n = Math.max(0, Number(urgentCount) || 0);
        if (moduleName === 'inventory') {
            st.inv.exact = n;
            st.inv.exactAt = Date.now();
            try {
                const list = (typeof inventoryActiveTasks !== 'undefined' && Array.isArray(inventoryActiveTasks)) ? inventoryActiveTasks : [];
                const keys = list.filter((t) => t && t.isUrgent === true && t.key).map((t) => String(t.key));
                st.inv.baseKeys = keys;
                if (me()) storeInvKeys(keys);
            } catch (_) {}
        } else {
            st.wd.exact = n;
            st.wd.exactAt = Date.now();
        }
        if (!st.running) watchSession();
        paint('exact-' + (moduleName || 'workdesk'));
    }

    // ------------------------------------------------------------------
    // Live sources
    // ------------------------------------------------------------------
    function listen(ref, event, cb) {
        try {
            ref.on(event, cb, (err) => console.warn('[IBA live counts] listener stopped', err && (err.code || err.message)));
            st.offs.push(() => { try { ref.off(event, cb); } catch (_) {} });
        } catch (err) { console.warn('[IBA live counts] could not listen', err); }
    }

    function startInboxes() {
        let idb = null;
        try { if (typeof invoiceDb !== 'undefined') idb = invoiceDb; } catch (_) {}
        if (!idb || !idb.ref) return;
        const names = [me()].concat(st.delegators).filter(Boolean);
        st.inboxBuckets = Array.from(new Set(names.map(safeKey))).filter(Boolean);
        st.inboxBuckets.forEach((bucket) => {
            listen(idb.ref('invoice_tasks_by_user/' + bucket), 'value', (snap) => {
                st.inbox[bucket] = (snap && snap.val()) || {};
                st.inboxPrimed[bucket] = true;
                recountWorkdesk('inbox');
            });
        });
    }

    function startInventoryWindow() {
        let dbx = null;
        try { dbx = (typeof window.getInventoryDatabase === 'function') ? window.getInventoryDatabase() : (window.inventoryDb || null); } catch (_) { dbx = null; }
        if (!dbx || !dbx.ref) return;
        listen(dbx.ref('transfer_entries').orderByKey().limitToLast(INV_WINDOW), 'value', (snap) => {
            st.inv.window = (snap && snap.val()) || {};
            st.inv.windowPrimed = true;
            recountInventory('inv-window');
        });
    }

    function start() {
        if (st.running) return;
        const name = me();
        if (!name) return;
        st.running = true;
        st.user = name;
        st.delegators = delegatorsNow();
        st.inv.baseKeys = loadStoredInvKeys();
        ensureUi();
        startInboxes();
        startInventoryWindow();
        recountWorkdesk('start');
        recountInventory('start');
        // memory-only checks (no downloads): the WorkDesk job list and the full
        // inventory list are refreshed by the existing routines
        st.timer = setInterval(() => {
            if (document.hidden) return;
            const d = delegatorsNow();
            if (d.join('|') !== st.delegators.join('|')) { stop(); start(); return; }
            recountWorkdesk('tick');
            recountInventory('tick');
        }, 15000);
    }

    function stop() {
        st.offs.splice(0).forEach((f) => f());
        if (st.timer) { clearInterval(st.timer); st.timer = 0; }
        st.running = false;
        st.user = '';
        st.inbox = {};
        st.inboxPrimed = {};
        st.inboxBuckets = [];
        st.wd = { exact: null, exactAt: 0, live: null, liveReady: false, liveChangedAt: 0, liveSig: '', shown: null };
        st.inv = { exact: null, exactAt: 0, live: null, liveReady: false, liveChangedAt: 0, liveSig: '', shown: null, window: null, windowPrimed: false, baseKeys: null };
        paint('stop');
    }

    // ------------------------------------------------------------------
    // Showing the numbers
    // ------------------------------------------------------------------
    function pick(s) {
        if (s.exact !== null && (!s.liveReady || s.exactAt >= s.liveChangedAt)) return s.exact;
        if (s.liveReady) return s.live;
        return s.exact;
    }

    const PILLS = [
        { id: 'task', nav: 'wd-active-task', label: 'Active Task', icon: 'fa-clipboard-list', group: 'wd', dash: 'wd-active-task' },
        { id: 'job', nav: 'inv-active-job', label: 'Active Job', icon: 'fa-cube', group: 'inv', dash: 'inv-active-job' }
    ];

    function ensureUi() {
        const right = document.querySelector('#iba-app-shell .iba-shell-right');
        if (right && !$('iba-live-counts')) {
            const wrap = document.createElement('div');
            wrap.id = 'iba-live-counts';
            wrap.className = 'iba-live';
            wrap.setAttribute('role', 'status');
            wrap.setAttribute('aria-live', 'polite');
            wrap.innerHTML = PILLS.map((p) =>
                '<button type="button" class="iba-live-pill" data-live="' + p.id + '" data-go="' + p.nav + '" hidden>' +
                '<span class="iba-live-glow" aria-hidden="true"></span>' +
                '<span class="iba-live-dot" aria-hidden="true"></span>' +
                '<i class="fa-solid ' + p.icon + '" aria-hidden="true"></i>' +
                '<span class="iba-live-label">' + p.label + '</span>' +
                '<span class="iba-live-num">0</span>' +
                '</button>').join('');
            right.insertBefore(wrap, right.firstChild);
            wrap.addEventListener('click', (e) => {
                const btn = e.target.closest('.iba-live-pill');
                if (!btn) return;
                const go = btn.getAttribute('data-go');
                if (go && typeof window.ibaOpenShellPage === 'function') window.ibaOpenShellPage(go);
            });
        }
        PILLS.forEach((p) => {
            document.querySelectorAll('#iba-app-shell [data-iba-nav="' + p.nav + '"], #iba-app-shell [data-iba-dash-park="' + p.dash + '"]').forEach((btn) => {
                if (btn.querySelector(':scope > .iba-live-badge')) return;
                const b = document.createElement('span');
                b.className = 'iba-live-badge';
                b.setAttribute('data-live', p.id);
                b.hidden = true;
                b.textContent = '0';
                btn.appendChild(b);
            });
        });
    }

    function animateNumber(el, from, to) {
        if (!el) return;
        if (el.__ibaTick) cancelAnimationFrame(el.__ibaTick);
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || from === null || from === undefined || !Number.isFinite(from) || from === to) { el.textContent = String(to); return; }
        const t0 = performance.now();
        const dur = Math.min(900, 160 + Math.abs(to - from) * 90);
        const step = (now) => {
            const k = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - k, 3);
            el.textContent = String(Math.round(from + (to - from) * eased));
            if (k < 1) el.__ibaTick = requestAnimationFrame(step);
            else el.__ibaTick = 0;
        };
        el.__ibaTick = requestAnimationFrame(step);
    }

    let baseTitle = '';
    function paintTitle(total) {
        const clean = String(document.title || '').replace(/^\(\d+\)\s+/, '');
        if (!baseTitle || clean !== baseTitle) baseTitle = clean;
        const next = total > 0 ? '(' + total + ') ' + baseTitle : baseTitle;
        if (document.title !== next) document.title = next;
    }

    function paint() {
        ensureUi();
        const counts = { task: st.running ? pick(st.wd) : null, job: st.running ? pick(st.inv) : null };
        let total = 0;
        PILLS.forEach((p) => {
            const s = p.id === 'task' ? st.wd : st.inv;
            const n = Number(counts[p.id]) || 0;
            total += n;
            const pill = document.querySelector('#iba-live-counts .iba-live-pill[data-live="' + p.id + '"]');
            if (pill) {
                const was = pill.hidden ? 0 : Number(pill.getAttribute('data-count') || 0);
                pill.hidden = !(n > 0);
                pill.setAttribute('data-count', String(n));
                pill.title = n > 0 ? (n + ' ' + p.label.toLowerCase().replace('active ', '') + (n === 1 ? '' : 's') + ' waiting for you — open ' + p.label) : p.label;
                pill.setAttribute('aria-label', n + ' in ' + p.label);
                if (n !== s.shown) {
                    animateNumber(pill.querySelector('.iba-live-num'), s.shown === null ? null : was, n);
                    if (s.shown !== null && n > 0) {
                        pill.classList.remove('is-bump');
                        void pill.offsetWidth;
                        pill.classList.add('is-bump');
                        setTimeout(() => pill.classList.remove('is-bump'), 700);
                    }
                }
            }
            document.querySelectorAll('#iba-app-shell .iba-live-badge[data-live="' + p.id + '"]').forEach((b) => {
                b.hidden = !(n > 0);
                b.textContent = String(n);
            });
            document.querySelectorAll('#iba-app-shell [data-iba-group-toggle][data-iba-sys="' + p.group + '"]').forEach((g) => {
                g.classList.toggle('iba-live-has', n > 0);
            });
            s.shown = n;
        });
        document.body.classList.toggle('iba-live-on', total > 0);
        paintTitle(st.running ? total : 0);
    }

    // ------------------------------------------------------------------
    // Start after sign-in, stop on sign-out (checked every 2 s, no downloads)
    // ------------------------------------------------------------------
    function watchSession() {
        // desktop only: the phone workspace shows its own counts
        const signedIn = document.body && document.body.classList.contains('iba-shell-on') && !document.body.classList.contains('iba-phone') && !!me();
        if (signedIn && st.running && norm(st.user) !== norm(me())) stop();
        if (signedIn && !st.running) start();
        else if (!signedIn && st.running) stop();
    }

    hookExact(); // before the Dashboard builds its first list

    function boot() {
        hookExact();
        ensureUi();
        watchSession();
        setInterval(watchSession, 2000);
        window.ibaLiveCounts = {
            VERSION,
            state: () => ({ running: st.running, user: st.user, wd: Object.assign({}, st.wd, { shown: st.wd.shown }), inv: Object.assign({}, st.inv, { window: st.inv.window ? Object.keys(st.inv.window).length : 0 }), delegators: st.delegators.slice() }),
            recount: () => { recountWorkdesk('manual'); recountInventory('manual'); },
            paint
        };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
