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
   - 17.0.5 patch 116: optional "Given to" name per row: Proceed also makes an
     Original PO job (status PO Revision, attention = that name) for it.
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
    // 17.0.5 patch 68: one PO -> { po, ok, why } (used by +Del and by the box in the list window)
    async function addOne(poNumber) {
        const p = normPO(poNumber);
        if (!p) return { po: String(poNumber || ''), ok: false, why: 'not a PO number' };
        if (busy.has(p)) return { po: p, ok: false, why: 'busy' };
        busy.add(p);
        try {
            watchList();
            if (onList(p)) return { po: p, ok: false, why: 'already on the list' };
            const val = await lookup(p);
            const hit = activeOf(val);
            if (!hit) { const c = await classify(p, val); return Object.assign({ po: p, ok: false }, c); }
            if (list[hit[0]]) return { po: p, ok: false, why: 'already on the list' };
            const rec = hit[1];
            const row = {
                po: String(field(rec, 'PO') || p), supplier: String(field(rec, 'SupplierName') || ''), project: String(field(rec, 'ProjectID') || ''),
                amount: field(rec, 'Amount') === '' ? '' : field(rec, 'Amount'), dateFiled: String(field(rec, 'DateFiled') || ''),
                addedBy: me(), addedAt: Date.now(), pulled: false
            };
            await mainDb().ref(LIST + '/' + hit[0]).set(row);
            list[hit[0]] = row;
            markButtons();
            return { po: p, ok: true, why: 'added' };
        } catch (err) {
            console.error('PO pull-out list:', err);
            return { po: p, ok: false, why: 'could not add: ' + ((err && err.message) || err) };
        } finally { busy.delete(p); }
    }
    // 17.0.5 patch 69: why is a PO not Active? (one small read of that PO's invoices, never the whole list)
    function invDb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    async function classify(p, val) {
        if (!val || typeof val !== 'object' || !Object.keys(val).length) return { kind: 'none', why: 'not in the PO file' };
        const recs = Object.keys(val).map((k) => val[k] || {});
        const rec = recs.find((r) => String(field(r, 'DateReleased') || '').trim()) || recs[0];
        const vendor = String(field(rec, 'SupplierName') || ''), site = String(field(rec, 'ProjectID') || '');
        const rel = String(field(rec, 'DateReleased') || '').trim();
        if (rel) return { kind: 'released', why: 'Inactive · released ' + rel + ' (returned to Accounts)', vendor, site };
        // 17.0.5 patch 70: the DATE FILED decides (an invoice can arrive before the paper PO)
        const filed = String(field(rec, 'DateFiled') || '').trim();
        if (filed) return { kind: 'inactive', why: 'Inactive · was in your file (filed ' + filed + ', no release date)', vendor, site };
        let hasInv = false;
        try { const d = invDb(); if (d) { const s = await d.ref('invoice_entries/' + p).limitToFirst(1).once('value'); hasInv = !!(s && s.exists && s.exists()); } } catch (_) {}
        return { kind: 'proc', why: 'Still with Procurement (never filed' + (hasInv ? ', invoice already entered' : '') + ')', vendor, site };
    }
    // WhatsApp to Reception (Hafiz) asking for the original PO papers: the message is only prepared, you press Send
    function receptionNumber() {
        let all = {};
        try { all = (typeof window.getApproversDataSafe === 'function' && window.getApproversDataSafe()) || {}; } catch (_) {}
        if (!all || !Object.keys(all).length) { try { all = (typeof allApproverData !== 'undefined' && allApproverData) || {}; } catch (_) {} }
        const hit = Object.keys(all).map((k) => all[k] || {}).find((a) => /^hafiz\b/i.test(String(a.Name || '').trim()));
        let m = hit ? String(hit.Mobile || hit.mobile || '').replace(/\D/g, '') : '';
        if (m.length === 8) m = '974' + m;
        return m;
    }
    function requestOriginal(items) {
        const n = receptionNumber();
        if (!n) { say("Hafiz's mobile is not in the user list."); return; }
        const lines = items.map((x) => '• PO ' + x.po + (x.vendor ? ' · ' + x.vendor : '') + (x.site ? ' · Site ' + x.site : '')).join('\n');
        const text = 'Hi Hafiz, please send me the original PO' + (items.length > 1 ? 's' : '') + ':\n' + lines + '\n\nThank you,\n' + (me() || '');
        window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }
    async function addToList(poNumber) {
        if (!isSuper()) { say('Only the Super Admin can use the PO pull-out list.'); return; }
        const r = await addOne(poNumber);
        if (r.why === 'busy') return;
        say(r.ok ? 'PO ' + r.po + ' added to the pull-out list.' : 'PO ' + r.po + ': ' + r.why + '.');
    }
    window.imAddToDeletionCollection = addToList;

    // ---- the Pull-out list window -----------------------------------------
    function money(v) { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) && String(v).trim() !== '' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : esc(v); }
    const rows = () => Object.keys(list).map((k) => Object.assign({ key: k }, list[k])).sort((a, b) => Number(normPO(a.po)) - Number(normPO(b.po)));

    let win = null;
    function close() { if (win && win.isConnected) win.remove(); win = null; }
    async function openList(opts) {
        if (!isSuper()) { say('The PO pull-out list is for the Super Admin only.'); return; }
        close();
        win = document.createElement('div');
        win.id = 'iba-esn';
        win.className = 'iba-esn-ov iba-pull';
        win.tabIndex = -1;
        win.innerHTML = '<div class="iba-esn-box is-wide" role="dialog" aria-modal="true" aria-label="PO pull-out list">' +
            '<div class="iba-esn-head"><b><i class="fa-solid fa-folder-minus"></i> PO pull-out list</b>' +
            '<button type="button" class="iba-esn-x" data-pull-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-esn-body"><p class="iba-esn-sub">Take these original POs out of your file and tick <b>Pulled</b>. Then press <b>Proceed</b>: ticked POs become Inactive and the list is cleared. Someone taking the PO? Put the name in <b>Given to</b>: an Original PO job (PO Revision) is made for them.</p>' +
            '<form class="iba-pull-add" data-pull-add autocomplete="off"><input type="text" inputmode="numeric" data-pull-q placeholder="Forgot +Del? Type PO numbers, e.g. 57376, 54719" aria-label="PO numbers to add">' +
            '<button type="submit" class="iba-esn-btn is-go"><i class="fa-solid fa-cart-plus"></i> Add</button></form><div class="iba-pull-res" data-pull-res></div>' +
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
            if (b.dataset.pullReq) { const x = (w.__proc || []).find((r) => r.po === b.dataset.pullReq); return requestOriginal([x || { po: b.dataset.pullReq }]); }
            if (b.hasAttribute('data-pull-reqall')) return requestOriginal(w.__proc || []);
        });
        w.addEventListener('change', (e) => { const i = e.target.closest && e.target.closest('[data-pull-to]'); if (i) setGiven(w, i); });
        w.addEventListener('submit', (e) => { if (e.target.closest('[data-pull-add]')) { e.preventDefault(); addTyped(w); } });
        w.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'Enter' && e.target.closest('[data-pull-to]')) { e.preventDefault(); e.target.blur(); }
            else if (e.key === 'Enter' && !e.target.closest('button') && !e.target.closest('[data-pull-add]')) { e.preventDefault(); proceed(w, w.querySelector('[data-pull-go]')); }
        });
        w.focus();
        if (opts && opts.add) { const q = w.querySelector('[data-pull-q]'); if (q) q.focus(); }
        listOn = false;
        try { const s = await mainDb().ref(LIST).once('value'); list = s.val() || {}; }
        catch (e) { w.querySelector('.iba-esn-err').textContent = 'Could not load the list: ' + ((e && e.message) || e); }
        watchList();
        draw(w);
    }
    // 17.0.5 patch 68: the box in the window adds POs like a cart (only Active POs, never twice)
    async function addTyped(w) {
        const q = w.querySelector('[data-pull-q]'), res = w.querySelector('[data-pull-res]');
        const pos = Array.from(new Set(String((q && q.value) || '').split(/[\s,;]+/).map(normPO).filter(Boolean)));
        if (!pos.length) { if (q) q.focus(); return; }
        const btn = w.querySelector('[data-pull-add] button');
        if (btn) btn.disabled = true;
        res.innerHTML = '<span class="iba-pull-chip"><i class="fa-solid fa-circle-notch fa-spin"></i> Checking ' + pos.length + ' PO' + (pos.length === 1 ? '' : 's') + '…</span>';
        const out = [];
        for (const p of pos) out.push(await addOne(p));
        if (btn) btn.disabled = false;
        unsure(w);
        draw(w);
        const proc = out.filter((r) => (r.kind === 'proc' || r.kind === 'none'));
        w.__proc = proc;
        res.innerHTML = out.map((r) => '<span class="iba-pull-chip ' + (r.ok ? 'is-ok' : (r.why === 'already on the list' ? 'is-same' : ((r.kind === 'proc' || r.kind === 'none') ? 'is-proc' : 'is-bad'))) + '"><b>' + esc(r.po) + '</b> ' +
            esc(r.ok ? 'added' : r.why) + ((r.kind === 'proc' || r.kind === 'none') ? ' <button type="button" class="iba-pull-req" data-pull-req="' + esc(r.po) + '" title="WhatsApp to Reception asking for the original PO"><i class="fa-brands fa-whatsapp"></i> Request original PO</button>' : '') + '</span>').join('') +
            (proc.length > 1 ? '<button type="button" class="iba-pull-req is-all" data-pull-reqall><i class="fa-brands fa-whatsapp"></i> Request all (' + proc.length + ')</button>' : '');
        if (q) { q.value = ''; q.focus(); }
    }
    function draw(w) {
        const all = rows();
        const out = w.querySelector('.iba-pull-out');
        const done = all.filter((x) => x.pulled).length;
        const go = w.querySelector('[data-pull-go]');
        w.querySelector('[data-pull-count]').innerHTML = all.length ? '<b>' + done + '</b> of ' + all.length + ' pulled' : '';
        if (go && !go.dataset.sure) go.disabled = !all.length;
        if (!all.length) { out.innerHTML = '<p class="iba-esn-sub">The list is empty. Type PO numbers above, or use +Del or the folder button on an Active PO.</p>'; return; }
        out.innerHTML = '<div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th>#</th><th>PO</th><th>Supplier</th><th>Project</th><th style="text-align:right">Amount</th><th>Date filed</th><th title="Optional: who takes the original PO. Proceed makes an Original PO job (PO Revision) for that person">Given to</th><th></th></tr></thead><tbody>' +
            all.map((x, i) => '<tr class="' + (x.pulled ? 'is-pulled' : '') + '"><td>' + (i + 1) + '</td><td><b>' + esc(x.po) + '</b></td><td>' + esc(x.supplier) +
                '</td><td>' + esc(x.project) + '</td><td style="text-align:right">' + money(x.amount) + '</td><td>' + esc(x.dateFiled) + '</td>' +
                '<td><input type="text" class="iba-pull-to" list="iba-pull-users" data-pull-to="' + esc(x.key) + '" value="' + esc(x.givenTo || '') + '" placeholder="optional" aria-label="Given to (optional)" autocomplete="off"></td>' +
                '<td class="iba-pull-acts"><button type="button" class="iba-esn-btn is-small' + (x.pulled ? ' is-go' : '') + '" data-pull-tick="' + esc(x.key) + '">' +
                (x.pulled ? '<i class="fa-solid fa-check"></i> Pulled' : '<i class="fa-regular fa-square"></i> Pulled') + '</button>' +
                '<button type="button" class="iba-esn-btn is-small" data-pull-drop="' + esc(x.key) + '" title="Take it off the list (it stays Active)" aria-label="Remove from list"><i class="fa-solid fa-xmark"></i></button></td></tr>').join('') +
            '</tbody></table></div>' + usersList();
    }
    // ---- 17.0.5 patch 116: "Given to" -> Original PO job (PO Revision) ----
    function users() {
        try {
            const a = (typeof allUsersData !== 'undefined' && Array.isArray(allUsersData)) ? allUsersData : [];
            return a.filter((u) => u && u.Name && String(u.Status || '').trim().toLowerCase() !== 'disabled').map((u) => String(u.Name).trim());
        } catch (_) { return []; }
    }
    function usersList() { return '<datalist id="iba-pull-users">' + Array.from(new Set(users())).sort().map((n) => '<option value="' + esc(n) + '"></option>').join('') + '</datalist>'; }
    function realName(v) {
        const t = String(v || '').trim().toLowerCase();
        if (!t) return '';
        return users().find((n) => n.toLowerCase() === t) || null;
    }
    async function setGiven(w, inp) {
        const key = inp.dataset.pullTo;
        if (!list[key]) return;
        const err = w.querySelector('.iba-esn-err');
        const v = String(inp.value || '').trim();
        const name = realName(v);
        if (v && !name) { inp.classList.add('is-bad'); err.textContent = '"' + v + '" is not in the user list. Pick a name from the list.'; return; }
        inp.classList.remove('is-bad');
        err.textContent = '';
        unsure(w);
        list[key].givenTo = name || '';
        if (name && inp.value !== name) inp.value = name;
        try { await mainDb().ref(LIST + '/' + key + '/givenTo').set(name || null); }
        catch (e) { err.textContent = 'Could not save the name: ' + ((e && e.message) || e); }
    }
    async function giveJob(x) {
        const d = mainDb();
        let who = x.givenTo;
        try { if (typeof resolveVacationAssignee === 'function') who = resolveVacationAssignee(who) || who; } catch (_) {}
        let day = '';
        try { day = (typeof formatDate === 'function') ? formatDate(new Date()) : ''; } catch (_) {}
        const now = firebase.database.ServerValue.TIMESTAMP;
        const job = {
            for: 'Original PO', ref: '', amount: x.amount === '' || x.amount == null ? '' : String(x.amount), po: String(x.po || ''),
            site: String(x.project || ''), group: '', attention: who, date: day || today(), remarks: 'PO Revision',
            details: '', note: '', vendorName: String(x.supplier || ''),
            timestamp: now, createdAt: now, updatedAt: now, createdBy: me(), updatedBy: me(), enteredBy: me()
        };
        const ref = d.ref('job_entries').push();
        await ref.set(job);
        const local = Object.assign({}, job, { key: ref.key, source: 'job_entry', updatedAt: Date.now(), timestamp: Date.now(), createdAt: Date.now() });
        try { if (typeof wdWriteWorkdeskJobRecentMarker === 'function') await wdWriteWorkdeskJobRecentMarker(ref.key, local, 'created'); } catch (_) {}
        try { if (typeof wdUpsertLocalWorkdeskJobEntryCache === 'function') wdUpsertLocalWorkdeskJobEntryCache(ref.key, local); } catch (_) {}
        return who;
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
            const nGive = done.filter((x) => x.givenTo).length;
            b.innerHTML = '<i class="fa-solid fa-check-double"></i> Yes: ' + done.length + ' Inactive' + (nGive ? ' + ' + nGive + ' job' + (nGive === 1 ? '' : 's') : '') + (left ? ', ' + left + ' stay Active' : '');
            return;
        }
        b.disabled = true;
        const fails = [], gave = [], jobFails = [];
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
            } catch (e) { fails.push(x.po + ' (' + ((e && e.message) || e) + ')'); continue; }
            if (x.givenTo) {
                try { gave.push(x.po + ' to ' + (await giveJob(x))); }
                catch (e) { jobFails.push(x.po + ' (job not made: ' + ((e && e.message) || e) + ')'); }
            }
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
        if (gave.length) {
            try { if (window.ibaOriginalPO) window.ibaOriginalPO.refresh(); } catch (_) {}
            try { if (typeof wdClearWorkdeskDashboardCache === 'function') wdClearWorkdeskDashboardCache(); } catch (_) {}
            try { if (typeof wdRebuildAllSystemEntriesFromFamilyCaches === 'function') wdRebuildAllSystemEntriesFromFamilyCaches(); } catch (_) {}
        }
        const allFails = fails.concat(jobFails);
        if (allFails.length) err.textContent = 'Not saved: ' + allFails.join(', ');
        else say(done.length + ' PO' + (done.length === 1 ? '' : 's') + ' marked Inactive' + (gave.length ? '; Original PO job: ' + gave.join(', ') : '') + '. The list is cleared.');
    }

    // ---- 17.0.5 patch 71: first invoice on a PO still with Procurement -> offer the request at once ----
    // Watches only NEW invoices (push on invoice_entries/<PO>), reads that one PO in the PO file,
    // and if it was never filed (no DateFiled, not Active) shows "Request original PO" right away.
    // Super Admin only, once per PO per day.
    const SEEN_KEY = 'iba-procreq-v1';
    function seenGet() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (_) { return {}; } }
    function seenSet(po) {
        try {
            const m = seenGet(), now = Date.now();
            Object.keys(m).forEach((k) => { if (now - m[k] > 86400000) delete m[k]; });
            m[po] = now;
            localStorage.setItem(SEEN_KEY, JSON.stringify(m));
        } catch (_) {}
    }
    let reqQueue = new Set();
    let reqTimer = 0;
    function queueReq(po) {
        const p = normPO(po);
        if (!p || !isSuper()) return;
        const m = seenGet();
        if (m[p] && Date.now() - m[p] < 86400000) return;
        reqQueue.add(p);
        clearTimeout(reqTimer);
        reqTimer = setTimeout(checkReq, 1500); // a Batch save adds many: one pop-up for all
    }
    async function checkReq() {
        const pos = Array.from(reqQueue);
        reqQueue = new Set();
        const proc = [];
        for (const p of pos) {
            try {
                const val = await lookup(p);
                if (activeOf(val)) continue;
                const c = await classify(p, val);
                // 17.0.5 patch 215: a PO that is not in the PO file at all (never filed) is asked for too
                if (c.kind === 'proc' || c.kind === 'none') {
                    let pd = {}; try { pd = (typeof allPOData !== 'undefined' && allPOData && allPOData[p]) || {}; } catch (_) {}
                    proc.push({ po: p, vendor: c.vendor || pd['Supplier Name'] || pd.Supplier || '', site: c.site || pd['Project ID'] || '' });
                }
            } catch (_) {}
        }
        if (proc.length) offerReq(proc);
    }
    function offerReq(items) {
        items.forEach((x) => seenSet(x.po));
        const old = document.getElementById('iba-procreq');
        if (old) old.remove();
        const w = document.createElement('div');
        w.id = 'iba-procreq';
        w.className = 'iba-pb-layer';
        const one = items.length === 1;
        w.innerHTML = '<div class="iba-pb-box" role="alertdialog" aria-modal="true" aria-labelledby="iba-procreq-t" style="width:min(540px,100%)">' +
            '<div class="iba-pb-head"><b id="iba-procreq-t"><i class="fa-solid fa-folder-open"></i> Original PO not in your file yet</b></div>' +
            '<div class="iba-pb-sub"><p>' + (one ? 'This PO is' : 'These POs are') + ' not in your PO file yet (never filed):</p><ul class="iba-hf-list">' +
            items.map((x) => '<li><b>PO ' + esc(x.po) + '</b>' + (x.vendor ? ' · ' + esc(x.vendor) : '') + (x.site ? ' · Site ' + esc(x.site) : '') + '</li>').join('') +
            '</ul><p>Ask Hafiz (Reception) to send the original' + (one ? '' : 's') + '? WhatsApp opens with the message ready, you press Send.</p></div>' +
            '<div class="iba-pb-foot"><span></span><button type="button" data-no>Later</button>' +
            '<button type="button" data-yes class="is-main"><i class="fa-brands fa-whatsapp"></i> ' + (one ? 'Request original PO' : 'Request all (' + items.length + ')') + '</button></div></div>';
        document.body.appendChild(w);
        const end = () => w.remove();
        w.addEventListener('click', (e) => {
            if (e.target === w) return end();
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-yes')) requestOriginal(items);
            end();
        });
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); end(); } });
        setTimeout(() => { const n = w.querySelector('[data-no]'); if (n) n.focus(); }, 0);
    }
    function hookNewInvoice() {
        try {
            const R = window.firebase && firebase.database && firebase.database.Reference;
            if (!R || !R.prototype || R.prototype.__ibaProcReq) return;
            const proto = R.prototype;
            const orig = proto.push;
            let rootUrl = '';
            proto.push = function () {
                const res = orig.apply(this, arguments);
                try {
                    const d = invDb();
                    if (d) {
                        if (!rootUrl) rootUrl = d.ref().toString().replace(/\/$/, '');
                        const s = this.toString();
                        if (s.indexOf(rootUrl + '/invoice_entries/') === 0) {
                            const parts = s.slice(rootUrl.length + 1).split('/');
                            if (parts.length === 2 && parts[1]) {
                                const po = decodeURIComponent(parts[1]);
                                Promise.resolve(res).then(() => queueReq(po)).catch(() => {});
                            }
                        }
                    }
                } catch (_) {}
                return res;
            };
            proto.__ibaProcReq = true;
        } catch (e) { console.warn('[IBA PO file] new-invoice hook not set:', e); }
    }
    hookNewInvoice();

    window.ibaPoFile = { activeOf, isActive, lookup, addToList, openList, markButton, today, classify, requestOriginal, offerReq, queueReq };
})();
