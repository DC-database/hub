/* ==========================================================================
   js/iba-17-p21.js — 17.0.0 patch 21
   1) Dashboard task cards: when the task is yours, the card gets the same
      buttons as the Now brief (SRV Done, Process, Approve / Reject, Close
      out, Print ...) plus "Active Task" to open it there. They run the same
      routines as WorkDesk Active Task (js/iba-assistant.js taskAct).
   2) The clock in the top left corner: a rounded-square face like a watch
      (default), a digital face or the classic round one. The time is shown
      next to it above the date.
      17.0.0 patch 23: only the Super Admin can click the clock to pick; the
      choice is saved for everyone (system_settings/clock_face, a few bytes)
      and each browser keeps the last one it saw.
   ========================================================================== */
(function () {
    'use strict';

    const FACE_KEY = 'iba-clock-face-v1';
    const FACES = [
        ['square', 'Square', 'Rounded square with hands'],
        ['digital', 'Digital', 'Rounded square with the time in digits'],
        ['round', 'Round', 'The classic round clock']
    ];
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s || '').trim().toLowerCase();

    // ------------------------------------------------------------------
    // 1) Dashboard task cards
    // ------------------------------------------------------------------
    function me() {
        try { if (typeof currentApprover !== 'undefined' && currentApprover) return currentApprover; } catch (_) {}
        return window.currentApprover || {};
    }
    function isMine(att) {
        if (!att) return false;
        try { if (window.ibaApprovals && typeof window.ibaApprovals.namedForMe === 'function') return !!window.ibaApprovals.namedForMe(att); } catch (_) {}
        const a = norm(att);
        if (a === norm(me().Name)) return true;
        try {
            const del = (typeof getDelegatorsForReplacement === 'function') ? (getDelegatorsForReplacement(me().Name || '') || []) : [];
            return del.some((n) => norm(n) === a);
        } catch (_) { return false; }
    }
    function taskOf(note) {
        const fwd = note.querySelector('.wd-forward-task-btn[data-wd-forward-task-id]');
        const id = fwd && fwd.getAttribute('data-wd-forward-task-id');
        return (id && window.__wdForwardTaskStore && window.__wdForwardTaskStore[id]) || null;
    }
    function briefTask(t) {
        const src = norm(t.source);
        if (src === 'transfer_entry') return null;
        const job = src === 'job_entry' || src === 'ipc_job_record';
        const po = String(t.originalPO || t.po || '').trim();
        let key = String(t.key || '');
        if (!job && po && t.originalKey && key.indexOf(po + '_') !== 0) key = po + '_' + t.originalKey;
        if (!key) return null;
        return {
            key: key, po: po, ref: t.ref || '', kind: job ? 'job' : 'invoice',
            status: t.status || t.remarks || '', attention: t.attention || '',
            vendor: t.vendorName || t.vendor || '', at: t.queueTimestamp || t.timestamp || 0
        };
    }
    function addCardButtons() {
        const api = window.ibaTaskActions;
        if (!api) return;
        document.querySelectorAll('.wd-cork-note:not([data-iba-do])').forEach((note) => {
            note.setAttribute('data-iba-do', '0');
            const t = taskOf(note);
            if (!t || !isMine(t.attention || t.Attention)) return;
            const q = briefTask(t);
            if (!q) return;
            let acts = '';
            try { acts = api.html(q) || ''; } catch (_) { acts = ''; }
            const open = '<button type="button" class="iba-ai-mini iba-ai-go is-open" data-open-task="' + esc(JSON.stringify({ key: q.key, po: q.po, ref: q.ref })) + '" title="Open it in Active Task"><i class="fa-solid fa-arrow-up-right-from-square"></i> Active Task</button>';
            const row = document.createElement('div');
            row.className = 'iba-note-do';
            row.innerHTML = '<span class="iba-note-do-label"><i class="fa-solid fa-hand-pointer"></i> Do it here</span>' + acts + open;
            const actions = note.querySelector('.wd-note-actions');
            if (actions) actions.insertAdjacentElement('afterend', row); else note.appendChild(row);
            note.setAttribute('data-iba-do', '1');
        });
    }
    document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('.wd-cork-note [data-task-act], .wd-cork-note [data-open-task]') : null;
        if (!b || !window.ibaTaskActions) return;
        e.preventDefault();
        e.stopPropagation();
        if (b.dataset.taskAct) { window.ibaTaskActions.run(b); return; }
        let q = {};
        try { q = JSON.parse(b.dataset.openTask || '{}'); } catch (_) {}
        window.ibaTaskActions.open(q);
    }, true);

    // ------------------------------------------------------------------
    // 2) Clock faces
    // ------------------------------------------------------------------
    function face() {
        let f = 'square';
        try { f = localStorage.getItem(FACE_KEY) || 'square'; } catch (_) {}
        return FACES.some((x) => x[0] === f) ? f : 'square';
    }
    function paintFace(f) {
        if (!FACES.some((x) => x[0] === f)) return;
        try { localStorage.setItem(FACE_KEY, f); } catch (_) {}
        const c = document.querySelector('.iba-shell-left .iba-analog-clock');
        if (c) c.setAttribute('data-face', f);
    }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    const FACE_PATH = 'system_settings/clock_face';
    function setFace(f) {
        if (!isSuper()) return;
        paintFace(f);
        const d = mainDb();
        if (d) d.ref(FACE_PATH).set(f).catch((e) => console.warn('[IBA clock] face not saved for everyone:', e));
    }
    let watching = false;
    function watchFace() {
        if (watching) return;
        const d = mainDb();
        if (!d) return;
        watching = true;
        try { d.ref(FACE_PATH).on('value', (snap) => { const v = snap && snap.val(); if (typeof v === 'string') paintFace(v); }, () => { watching = false; }); } catch (_) { watching = false; }
    }
    function syncClockAccess() {
        const c = document.querySelector('.iba-shell-left .iba-analog-clock[data-face]');
        if (!c) return;
        const sup = isSuper();
        c.classList.toggle('is-pickable', sup);
        if (sup) { c.setAttribute('role', 'button'); c.setAttribute('tabindex', '0'); c.setAttribute('title', 'Change the clock face (for everyone)'); }
        else { c.removeAttribute('role'); c.removeAttribute('tabindex'); c.removeAttribute('title'); }
    }
    function buildClock() {
        const c = document.querySelector('.iba-shell-left .iba-analog-clock');
        if (!c || c.hasAttribute('data-face')) return !!c;
        c.setAttribute('data-face', face());
        c.removeAttribute('aria-hidden');
        const ticks = document.createElement('div');
        ticks.className = 'iba-clock-ticks';
        for (let i = 0; i < 12; i++) {
            const s = document.createElement('i');
            s.style.setProperty('--a', (i * 30) + 'deg');
            if (i % 3 === 0) s.className = 'is-major';
            ticks.appendChild(s);
        }
        c.insertBefore(ticks, c.firstChild);
        const dig = document.createElement('div');
        dig.className = 'iba-clock-digital';
        dig.innerHTML = '<b class="iba-clock-dig-hm">--:--</b><span class="iba-clock-dig-sec"><i></i></span>';
        c.appendChild(dig);
        // time above the date
        const date = document.getElementById('iba-shell-date');
        if (date && !date.parentElement.classList.contains('iba-shell-when')) {
            const when = document.createElement('div');
            when.className = 'iba-shell-when';
            when.innerHTML = '<strong class="iba-shell-time" id="iba-shell-time">--:--</strong>';
            date.parentElement.insertBefore(when, date);
            when.appendChild(date);
        }
        c.addEventListener('click', (e) => { if (!isSuper()) return; e.stopPropagation(); togglePicker(c); });
        c.addEventListener('keydown', (e) => { if (!isSuper()) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePicker(c); } });
        syncClockAccess();
        return true;
    }
    function togglePicker(c) {
        let p = document.getElementById('iba-clock-picker');
        if (p) { p.remove(); return; }
        p = document.createElement('div');
        p.id = 'iba-clock-picker';
        p.className = 'iba-clock-picker';
        const cur = face();
        p.innerHTML = '<div class="iba-clock-picker-title">Clock face · for everyone</div>' + FACES.map((f) =>
            '<button type="button" data-clock-face="' + f[0] + '" class="' + (f[0] === cur ? 'is-on' : '') + '">' +
            '<span class="iba-clock-swatch is-' + f[0] + '">' + (f[0] === 'digital' ? '<b>9:41</b>' : '<i></i><i></i>') + '</span>' +
            '<span><b>' + esc(f[1]) + '</b><small>' + esc(f[2]) + '</small></span>' +
            (f[0] === cur ? '<i class="fa-solid fa-check"></i>' : '') + '</button>').join('');
        document.body.appendChild(p);
        const r = c.getBoundingClientRect();
        p.style.left = Math.max(8, r.left) + 'px';
        p.style.top = (r.bottom + 8) + 'px';
        p.addEventListener('click', (e) => {
            const b = e.target.closest('[data-clock-face]');
            if (!b) return;
            setFace(b.getAttribute('data-clock-face'));
            p.remove();
        });
    }
    document.addEventListener('click', (e) => {
        const p = document.getElementById('iba-clock-picker');
        if (p && !p.contains(e.target)) p.remove();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const p = document.getElementById('iba-clock-picker'); if (p) p.remove(); } });

    const pad = (n) => (n < 10 ? '0' : '') + n;
    function tick() {
        const now = new Date();
        const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
        const t = document.getElementById('iba-shell-time');
        if (t && t.textContent !== hm) t.textContent = hm;
        const d = document.querySelector('.iba-analog-clock .iba-clock-dig-hm');
        if (d && d.textContent !== hm) d.textContent = hm;
        const s = document.querySelector('.iba-analog-clock .iba-clock-dig-sec i');
        if (s) s.style.width = ((now.getSeconds() + 1) / 60 * 100).toFixed(1) + '%';
    }

    let queued = false;
    function queue() { if (queued) return; queued = true; setTimeout(() => { queued = false; addCardButtons(); syncClockAccess(); watchFace(); }, 200); }
    function start() {
        buildClock();
        tick();
        setInterval(tick, 1000);
        addCardButtons();
        try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
