/* ==========================================================================
   js/iba-1705-release.js — 17.0.5 patch 38 (reworked in patch 39)
   Original PO file (progress-po database, records/<key>):
     PO, Status, DateFiled, DateReleased, SupplierName, ProjectID, Amount ...
   Status "Active" = the original paper PO is in martin's file.
   Inactive or blank = it is not.
   - window.ibaPoFile.activeOf(val): the Active record of a PO lookup
     (Invoice Entry badge, Batch +Del, Original PO "Back in file" use it).
   - +Del / folder button (Super Admin only) puts an Active PO on the
     Pull-out list (main db iba_assistant/po_pullout/<record key>).
     The PO stays Active.
   - Pull-out list (assistant skill "PO pull-out list"): tick Pulled while
     taking the papers out, then Proceed: ticked POs get Status "Inactive" +
     DateReleased today ("31-OCT-2026", same look as DateFiled); the list is
     emptied (unticked POs just leave the list and stay Active).
   ========================================================================== */
(function () {
    'use strict';
    const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const LIST = 'iba_assistant/po_pullout';
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const normPO = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');

    function progDb() { try { return (typeof progressDb !== 'undefined' && progressDb && progressDb.ref) ? progressDb : null; } catch (_) { return null; } }
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
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
    function keyOf(rec, name) { return Object.keys(rec || {}).find((x) => x.toLowerCase() === name.toLowerCase()) || name; }
    function isActive(rec) { return String(field(rec, 'Status') || '').trim().toLowerCase() === 'active'; }
    // val = snapshot.val() of a PO lookup -> [key, record] of the Active one, or null
    function activeOf(val) {
        if (!val || typeof val !== 'object') return null;
        const k = Object.keys(val).find((x) => isActive(val[x]));
        return k ? [k, val[k]] : null;
    }
    async function lookup(po) {
        const d = progDb();
        const p = normPO(po);
        if (!d || !p) return null;
        const ref = d.ref('records');
        let s = await ref.orderByChild('PO').equalTo(p).once('value');
        if (!s.exists()) s = await ref.orderByChild('PO').equalTo(parseInt(p, 10)).once('value');
        return s.exists() ? s.val() : null;
    }

    // ---- the list (small: emptied on every Proceed) ----------------------
    let list = {};
    let listOn = false;
    function watchList() {
        if (listOn || !isSuper()) return;
        const d = mainDb();
        if (!d) return;
        listOn = true;
        d.ref(LIST).on('value', (s) => {
            list = s.val() || {};
            markButtons();
            if (win && win.isConnected) draw(win);
        }, () => { listOn = false; });
    }
    const onList = (p) => Object.keys(list).some((k) => normPO(list[k] && list[k].po) === normPO(p));

    function markButton(b) {
        const p = normPO(b.dataset.poFilePo);
        if (!p || !onList(p)) return;
        if (b.id === 'im-modal-deletion-list-btn') { b.innerHTML = '<i class="fa-solid fa-check"></i>'; }
        else b.innerHTML = '<i class="fa-solid fa-check"></i> On pull-out list';
        b.title = 'On the PO pull-out list';
        b.disabled = true;
        b.setAttribute('aria-disabled', 'true');
        b.classList.add('is-added');
    }
    function markButtons() { document.querySelectorAll('#im-po-collect-btn, .im-po-collect-btn, #im-modal-deletion-list-btn').forEach(markButton); }
    // buttons drawn later (new search, Batch card) pick up "On pull-out list" too
    if (typeof window.imResetPOFileActionButton === 'function') {
        const reset = window.imResetPOFileActionButton;
        window.imResetPOFileActionButton = function (button) {
            const r = reset.apply(this, arguments);
            watchList();
            if (button) markButton(button);
            return r;
        };
    }

    // ---- +Del / folder: put it on the list ---------------------------------
    const busy = new Set();
    async function addToList(poNumber) {
        if (!isSuper()) { say('Only the Super Admin can use the PO pull-out list.'); return; }
        const p = normPO(poNumber);
        if (!p || busy.has(p)) return;
        busy.add(p);
        try {
            watchList();
            const hit = activeOf(await lookup(p));
            if (!hit) { say('PO ' + p + ' is not Active in the PO file (already released or not in the file).'); return; }
            const rec = hit[1];
            await mainDb().ref(LIST + '/' + hit[0]).set({
                po: String(field(rec, 'PO') || p), supplier: String(field(rec, 'SupplierName') || ''), project: String(field(rec, 'ProjectID') || ''),
                amount: field(rec, 'Amount') === '' ? '' : field(rec, 'Amount'), dateFiled: String(field(rec, 'DateFiled') || ''),
                addedBy: me(), addedAt: Date.now(), pulled: false
            });
            list[hit[0]] = { po: p };
            markButtons();
            say('PO ' + p + ' added to the pull-out list.');
        } catch (err) {
            console.error('PO pull-out list:', err);
            say('Could not add PO ' + p + ': ' + ((err && err.message) || err));
        } finally { busy.delete(p); }
    }
    window.imAddToDeletionCollection = addToList;

    // ---- the Pull-out list window -----------------------------------------
    function money(v) { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) && String(v).trim() !== '' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : esc(v); }
    const rows = () => Object.keys(list).map((k) => Object.assign({ key: k }, list[k])).sort((a, b) => Number(normPO(a.po)) - Number(normPO(b.po)));

    let win = null;
    function close() { if (win && win.isConnected) win.remove(); win = null; }
    async function openList() {
        if (!isSuper()) { say('The PO pull-out list is for the Super Admin only.'); return; }
        close();
        win = document.createElement('div');
        win.id = 'iba-esn';
        win.className = 'iba-esn-ov iba-pull';
        win.tabIndex = -1;
        win.innerHTML = '<div class="iba-esn-box is-wide" role="dialog" aria-modal="true" aria-label="PO pull-out list">' +
            '<div class="iba-esn-head"><b><i class="fa-solid fa-folder-minus"></i> PO pull-out list</b>' +
            '<button type="button" class="iba-esn-x" data-pull-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-esn-body"><p class="iba-esn-sub">Take these original POs out of your file and tick <b>Pulled</b>. Then press <b>Proceed</b>: ticked POs become Inactive and the list is cleared.</p>' +
            '<div class="iba-pull-out"><p class="iba-esn-sub"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading…</p></div><div class="iba-esn-err"></div></div>' +
            '<div class="iba-esn-foot"><span class="iba-esn-picked" data-pull-count></span><span class="iba-esn-sp"></span>' +
            '<button type="button" class="iba-esn-btn" data-pull-x>Close</button>' +
            '<button type="button" class="iba-esn-btn is-go" data-pull-go><i class="fa-solid fa-check-double"></i> Proceed</button></div></div>';
        document.body.appendChild(win);
        const w = win;
        w.addEventListener('click', (e) => {
            if (e.target === w || e.target.closest('[data-pull-x]')) return close();
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-pull-go')) return proceed(w, b);
            if (b.dataset.pullTick) return tick(w, b.dataset.pullTick);
            if (b.dataset.pullDrop) return drop(w, b.dataset.pullDrop);
        });
        w.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); proceed(w, w.querySelector('[data-pull-go]')); }
        });
        w.focus();
        listOn = false;
        try { const s = await mainDb().ref(LIST).once('value'); list = s.val() || {}; }
        catch (e) { w.querySelector('.iba-esn-err').textContent = 'Could not load the list: ' + ((e && e.message) || e); }
        watchList();
        draw(w);
    }
    function draw(w) {
        const all = rows();
        const out = w.querySelector('.iba-pull-out');
        const done = all.filter((x) => x.pulled).length;
        const go = w.querySelector('[data-pull-go]');
        w.querySelector('[data-pull-count]').innerHTML = all.length ? '<b>' + done + '</b> of ' + all.length + ' pulled' : '';
        if (go && !go.dataset.sure) go.disabled = !all.length;
        if (!all.length) { out.innerHTML = '<p class="iba-esn-sub">The list is empty. Use +Del or the folder button on an Active PO to add one.</p>'; return; }
        out.innerHTML = '<div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th>#</th><th>PO</th><th>Supplier</th><th>Project</th><th style="text-align:right">Amount</th><th>Date filed</th><th></th></tr></thead><tbody>' +
            all.map((x, i) => '<tr class="' + (x.pulled ? 'is-pulled' : '') + '"><td>' + (i + 1) + '</td><td><b>' + esc(x.po) + '</b></td><td>' + esc(x.supplier) +
                '</td><td>' + esc(x.project) + '</td><td style="text-align:right">' + money(x.amount) + '</td><td>' + esc(x.dateFiled) + '</td>' +
                '<td class="iba-pull-acts"><button type="button" class="iba-esn-btn is-small' + (x.pulled ? ' is-go' : '') + '" data-pull-tick="' + esc(x.key) + '">' +
                (x.pulled ? '<i class="fa-solid fa-check"></i> Pulled' : '<i class="fa-regular fa-square"></i> Pulled') + '</button>' +
                '<button type="button" class="iba-esn-btn is-small" data-pull-drop="' + esc(x.key) + '" title="Take it off the list (it stays Active)" aria-label="Remove from list"><i class="fa-solid fa-xmark"></i></button></td></tr>').join('') +
            '</tbody></table></div>';
    }
    function unsure(w) { const go = w.querySelector('[data-pull-go]'); if (go && go.dataset.sure) { delete go.dataset.sure; go.innerHTML = '<i class="fa-solid fa-check-double"></i> Proceed'; } }
    async function tick(w, key) {
        if (!list[key]) return;
        unsure(w);
        const v = !list[key].pulled;
        list[key].pulled = v;
        draw(w);
        try { await mainDb().ref(LIST + '/' + key + '/pulled').set(v); }
        catch (e) { w.querySelector('.iba-esn-err').textContent = 'Could not save the tick: ' + ((e && e.message) || e); }
    }
    async function drop(w, key) {
        if (!list[key]) return;
        unsure(w);
        const p = list[key].po;
        delete list[key];
        draw(w);
        try { await mainDb().ref(LIST + '/' + key).remove(); say('PO ' + p + ' taken off the list (still Active).'); }
        catch (e) { w.querySelector('.iba-esn-err').textContent = 'Could not remove it: ' + ((e && e.message) || e); }
    }
    async function proceed(w, b) {
        const all = rows();
        if (!b || !all.length || b.disabled) return;
        const done = all.filter((x) => x.pulled), left = all.length - done.length;
        const err = w.querySelector('.iba-esn-err');
        err.textContent = '';
        // one more press to be sure (Enter or click)
        if (!b.dataset.sure) {
            b.dataset.sure = '1';
            b.innerHTML = '<i class="fa-solid fa-check-double"></i> Yes: ' + done.length + ' Inactive' + (left ? ', ' + left + ' stay Active' : '');
            return;
        }
        b.disabled = true;
        const fails = [];
        const day = today();
        for (const x of done) {
            try {
                const snap = await progDb().ref('records/' + x.key).once('value');
                const rec = snap.val();
                if (!rec) throw new Error('not found in the PO file');
                const upd = {};
                upd[keyOf(rec, 'Status')] = 'Inactive';
                upd[keyOf(rec, 'DateReleased')] = day;
                await progDb().ref('records/' + x.key).update(upd);
            } catch (e) { fails.push(x.po + ' (' + ((e && e.message) || e) + ')'); }
        }
        // the list is always emptied, except POs that could not be written
        const keep = new Set(done.filter((x) => fails.some((f) => f.indexOf(x.po + ' (') === 0)).map((x) => x.key));
        const rm = {};
        all.forEach((x) => { if (!keep.has(x.key)) rm[x.key] = null; });
        try { await mainDb().ref(LIST).update(rm); } catch (e) { fails.push('list (' + ((e && e.message) || e) + ')'); }
        Object.keys(rm).forEach((k) => { delete list[k]; });
        delete b.dataset.sure;
        b.innerHTML = '<i class="fa-solid fa-check-double"></i> Proceed';
        b.disabled = false;
        draw(w);
        markButtons();
        if (fails.length) err.textContent = 'Not saved: ' + fails.join(', ');
        else say(done.length + ' PO' + (done.length === 1 ? '' : 's') + ' marked Inactive. The list is cleared.');
    }

    window.ibaPoFile = { activeOf, isActive, lookup, addToList, openList, markButton, today };
})();
