/* ==========================================================================
   js/iba-1705-release.js — 17.0.5 patch 38
   Original PO file (progress-po database, records/<key>):
     PO, Status, DateFiled, DateReleased, SupplierName, ProjectID, Amount ...
   Status "Active" = the original paper PO is in martin's file.
   Inactive or blank = it is not.
   - window.ibaPoFile.activeOf(val): the Active record of a PO lookup
     (Invoice Entry badge, Batch +Del, Original PO "Back in file" use it).
   - +Del (Super Admin only) releases the PO: Status "Inactive" and
     DateReleased today ("29-OCT-2026", same look as DateFiled).
   - Pull-out list (assistant skill "PO pull-out list"): every PO released
     today, so the paper copies can be taken out of the file. Pulled ticks
     are kept on this computer for today only; Undo puts a PO back to Active.
   ========================================================================== */
(function () {
    'use strict';
    const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const TICKS = 'iba-po-pulled-v1';
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const normPO = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');

    function db() { try { return (typeof progressDb !== 'undefined' && progressDb && progressDb.ref) ? progressDb : null; } catch (_) { return null; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function me() { try { return String((typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) || '').trim(); } catch (_) { return ''; } }
    function say(msg) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(msg); } catch (_) {} alert(msg); }
    function today() { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '-' + MON[d.getMonth()] + '-' + d.getFullYear(); }

    // field names as Firebase spells them (PO / po, Status / status ...)
    function field(rec, name) {
        if (!rec) return '';
        if (rec[name] != null) return rec[name];
        const k = Object.keys(rec).find((x) => x.toLowerCase() === name.toLowerCase());
        return k ? rec[k] : '';
    }
    function isActive(rec) { return String(field(rec, 'Status') || '').trim().toLowerCase() === 'active'; }
    // val = snapshot.val() of a PO lookup -> [key, record] of the Active one, or null
    function activeOf(val) {
        if (!val || typeof val !== 'object') return null;
        const k = Object.keys(val).find((x) => isActive(val[x]));
        return k ? [k, val[k]] : null;
    }
    async function lookup(po) {
        const d = db();
        const p = normPO(po);
        if (!d || !p) return null;
        const ref = d.ref('records');
        let s = await ref.orderByChild('PO').equalTo(p).once('value');
        if (!s.exists()) s = await ref.orderByChild('PO').equalTo(parseInt(p, 10)).once('value');
        return s.exists() ? s.val() : null;
    }

    // ---- +Del: release the original PO -----------------------------------
    const orig = window.imAddToDeletionCollection;
    const busy = new Set();
    async function release(poNumber) {
        if (!isSuper()) { say('Only the Super Admin can release an original PO.'); return; }
        const p = normPO(poNumber);
        if (!p || busy.has(p)) return;
        busy.add(p);
        try {
            const val = await lookup(p);
            const hit = activeOf(val);
            if (!hit) { say('PO ' + p + ' is not Active in the PO file (already released or not in the file).'); return; }
            const rec = hit[1];
            const upd = {};
            upd[Object.keys(rec).find((x) => x.toLowerCase() === 'status') || 'Status'] = 'Inactive';
            upd[Object.keys(rec).find((x) => x.toLowerCase() === 'datereleased') || 'DateReleased'] = today();
            await db().ref('records/' + hit[0]).update(upd);
            // the old routine still marks the buttons (and keeps the PO site list)
            if (typeof orig === 'function') { try { await orig(poNumber); } catch (_) {} }
            document.querySelectorAll('#im-po-collect-btn, .im-po-collect-btn').forEach((b) => {
                if (normPO(b.dataset.poFilePo) !== p) return;
                b.innerHTML = '<i class="fa-solid fa-check"></i> Released';
                b.title = 'Released today: on the PO pull-out list';
                b.disabled = true;
                b.classList.add('is-added');
            });
            const m = document.getElementById('im-modal-deletion-list-btn');
            if (m && normPO(m.dataset.poFilePo) === p) m.title = 'Released today: on the PO pull-out list';
            say('PO ' + p + ' released. It is on today\'s pull-out list.');
        } catch (err) {
            console.error('PO release:', err);
            say('Could not release PO ' + p + ': ' + ((err && err.message) || err));
        } finally { busy.delete(p); }
    }
    window.imAddToDeletionCollection = release;

    // ---- today's pull-out list --------------------------------------------
    function ticks() {
        try {
            const t = JSON.parse(localStorage.getItem(TICKS) || '{}');
            return t && t.day === today() ? t : { day: today(), keys: {} };
        } catch (_) { return { day: today(), keys: {} }; }
    }
    function saveTicks(t) { try { localStorage.setItem(TICKS, JSON.stringify(t)); } catch (_) {} }

    async function released() {
        const d = db();
        if (!d) throw new Error('The PO file database is not available.');
        const s = await d.ref('records').orderByChild('DateReleased').equalTo(today()).once('value');
        const val = s.val() || {};
        return Object.keys(val).map((k) => ({ key: k, rec: val[k] }))
            .filter((x) => !isActive(x.rec))
            .sort((a, b) => Number(normPO(field(a.rec, 'PO'))) - Number(normPO(field(b.rec, 'PO'))));
    }
    function money(v) { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) && String(v).trim() !== '' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : esc(v); }

    let win = null;
    function close() { if (win && win.isConnected) win.remove(); win = null; }
    async function openList() {
        if (!isSuper()) { say('The PO pull-out list is for the Super Admin only.'); return; }
        close();
        win = document.createElement('div');
        win.id = 'iba-esn';
        win.className = 'iba-esn-ov iba-pull';
        win.innerHTML = '<div class="iba-esn-box is-wide" role="dialog" aria-modal="true" aria-label="PO pull-out list">' +
            '<div class="iba-esn-head"><b><i class="fa-solid fa-folder-minus"></i> PO pull-out list · ' + esc(today()) + '</b>' +
            '<button type="button" class="iba-esn-x" data-pull-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-esn-body"><p class="iba-esn-sub">POs released today. Take these original copies out of your file and tick <b>Pulled</b>.</p>' +
            '<div class="iba-pull-out"><p class="iba-esn-sub"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading…</p></div><div class="iba-esn-err"></div></div>' +
            '<div class="iba-esn-foot"><span class="iba-esn-picked" data-pull-count></span><span class="iba-esn-sp"></span>' +
            '<button type="button" class="iba-esn-btn" data-pull-reload><i class="fa-solid fa-rotate"></i> Refresh</button>' +
            '<button type="button" class="iba-esn-btn is-go" data-pull-x>Close</button></div></div>';
        document.body.appendChild(win);
        const w = win;
        w.addEventListener('click', (e) => {
            if (e.target === w || e.target.closest('[data-pull-x]')) return close();
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-pull-reload')) return paint(w);
            if (b.dataset.pullTick) {
                const t = ticks();
                if (t.keys[b.dataset.pullTick]) delete t.keys[b.dataset.pullTick]; else t.keys[b.dataset.pullTick] = 1;
                saveTicks(t);
                return draw(w);
            }
            if (b.dataset.pullUndo) return undo(w, b);
        });
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        paint(w);
    }
    async function paint(w) {
        const err = w.querySelector('.iba-esn-err');
        err.textContent = '';
        try { w.__list = await released(); draw(w); }
        catch (e) { w.querySelector('.iba-pull-out').innerHTML = ''; err.textContent = 'Could not load the list: ' + ((e && e.message) || e); }
    }
    function draw(w) {
        const list = w.__list || [];
        const t = ticks();
        const out = w.querySelector('.iba-pull-out');
        const left = list.filter((x) => !t.keys[x.key]).length;
        w.querySelector('[data-pull-count]').innerHTML = list.length ? '<b>' + left + '</b> to pull · ' + (list.length - left) + ' pulled' : '';
        if (!list.length) { out.innerHTML = '<p class="iba-esn-sub">Nothing released today.</p>'; return; }
        out.innerHTML = '<div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th>#</th><th>PO</th><th>Supplier</th><th>Project</th><th style="text-align:right">Amount</th><th>Date filed</th><th></th></tr></thead><tbody>' +
            list.map((x, i) => {
                const r = x.rec, done = !!t.keys[x.key];
                return '<tr class="' + (done ? 'is-pulled' : '') + '"><td>' + (i + 1) + '</td><td><b>' + esc(field(r, 'PO')) + '</b></td><td>' + esc(field(r, 'SupplierName')) +
                    '</td><td>' + esc(field(r, 'ProjectID')) + '</td><td style="text-align:right">' + money(field(r, 'Amount')) + '</td><td>' + esc(field(r, 'DateFiled')) + '</td>' +
                    '<td class="iba-pull-acts"><button type="button" class="iba-esn-btn is-small' + (done ? ' is-go' : '') + '" data-pull-tick="' + esc(x.key) + '">' +
                    (done ? '<i class="fa-solid fa-check"></i> Pulled' : '<i class="fa-regular fa-square"></i> Pulled') + '</button>' +
                    '<button type="button" class="iba-esn-btn is-small" data-pull-undo="' + esc(x.key) + '" title="Put it back to Active (it stays in the file)"><i class="fa-solid fa-rotate-left"></i> Undo</button></td></tr>';
            }).join('') + '</tbody></table></div>';
    }
    async function undo(w, b) {
        const key = b.dataset.pullUndo;
        const x = (w.__list || []).find((y) => y.key === key);
        if (!x) return;
        b.disabled = true;
        try {
            const rec = x.rec, upd = {};
            upd[Object.keys(rec).find((k) => k.toLowerCase() === 'status') || 'Status'] = 'Active';
            upd[Object.keys(rec).find((k) => k.toLowerCase() === 'datereleased') || 'DateReleased'] = '';
            await db().ref('records/' + key).update(upd);
            const t = ticks(); delete t.keys[key]; saveTicks(t);
            w.__list = w.__list.filter((y) => y.key !== key);
            draw(w);
            say('PO ' + field(rec, 'PO') + ' is Active again.');
        } catch (e) { b.disabled = false; w.querySelector('.iba-esn-err').textContent = 'Undo failed: ' + ((e && e.message) || e); }
    }

    window.ibaPoFile = { activeOf, isActive, lookup, release, openList, today };
})();
