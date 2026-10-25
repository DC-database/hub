/* ==========================================================================
   js/iba-1702-esn.js — 17.0.2 patch 14
   Site approval, Print ESN and Ready (agreed with martin, plan doc
   "ESN print and Ready flow").

   1. For SRV task: a new "Approval" button next to SRV Done. The site user
      picks their engineer; that counts as SRV done and the invoice goes to
      the engineer as For Approval (approvalFlow 'site', approvalRequestedBy).
   2. The engineer approves / rejects as today (js/iba-approvals.js). An
      approval goes back to the sender only when the sender may print ESN
      (Super Admin list "Who can print ESN"); otherwise to Irwin as before.
      A rejection always goes back to the sender.
   3. The sender sees "Print ESN" and, after printing, "Ready". Ready hands
      the invoice to Irwin; the sender can no longer print or change it.
   4. Irwin's Ready task has "Extra": send back to the sender, print ESN,
      history.
   5. "Who can print ESN" (Super Admin): people are kept by their user
      record ID plus the name and mobile at the time they were added. If the
      name or the mobile no longer match, printing is off for that person
      until Irwin removes and adds them again (fail-safe).
   6. Print ESN window (everyone who prints from the system): tick which
      signatures to print (max 3 + MD) and where: Left, Middle, or Right top /
      middle / bottom. Only the newest signature starts ticked. The sticker
      is design A (QR stamp) with a bold APPROVED.
   Reads: tiny settings list (once), two tiny records when an engineer
   approves, and the one invoice being worked on. No list is downloaded.
   ========================================================================== */
(function () {
    'use strict';

    const VERSION = '17.0.2-p14';
    const SET_PATH = 'system_settings/esn_printers';
    const SRV_STEPS = ['for srv', 'waiting signature', 'waiting approval'];
    const PLACES = [
        ['L', 'Left'],
        ['M', 'Middle'],
        ['RB', 'Right bottom'],
        ['RM', 'Right middle'],
        ['RT', 'Right top']
    ];
    // where each place sits on the A4 page (the sticker is about 46 x 16 mm;
    // 17.0.3: 70% of the first size, martin found it too big)
    const PLACE_CSS = {
        L: 'left:10mm;bottom:20mm;',
        M: 'left:50%;bottom:20mm;transform:translateX(-50%);',
        RB: 'right:10mm;bottom:20mm;',
        RM: 'right:10mm;bottom:39mm;',
        RT: 'right:10mm;bottom:58mm;'
    };

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------
    const $ = (id) => document.getElementById(id);
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function norm(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' '); }
    function normMob(v) {
        const s = String(v == null ? '' : v);
        try { if (typeof normalizeMobile === 'function') return normalizeMobile(s); } catch (_) {}
        const d = s.replace(/\D/g, '');
        return d.length === 8 ? '974' + d : d;
    }
    function ts() { return firebase.database.ServerValue.TIMESTAMP; }
    function apv() { return window.ibaApprovals || null; }
    function mainDb() { try { return (typeof db !== 'undefined') ? db : window.db; } catch (_) { return window.db; } }
    function invDb() { try { return (typeof invoiceDb !== 'undefined') ? invoiceDb : window.invoiceDb; } catch (_) { return window.invoiceDb; } }
    function user() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : (window.currentApprover || null); } catch (_) { return window.currentApprover || null; } }
    function myName() { const u = user(); return String((u && u.Name) || '').trim(); }
    function myKey() { const u = user(); return String((u && u.key) || localStorage.getItem('approverKey') || '').trim(); }
    function superName() { try { return (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) ? SUPER_ADMIN_NAME : 'Irwin'; } catch (_) { return 'Irwin'; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function') return !!imIsCurrentUserSuperAdmin(); } catch (_) {}
        return norm(myName()) === norm(superName());
    }
    function namedForMe(att) { const a = apv(); return a ? a.namedForMe(att) : norm(att) === norm(myName()); }
    function toast(msg, tone) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(msg, tone); } catch (_) {} alert(msg); }
    function taskIds(task) { const a = apv(); return a ? a.taskIds(task) : { po: String(task.originalPO || task.po || ''), key: String(task.originalKey || '') }; }
    function dateOf(v) { const n = Number(v); if (!n) return ''; const d = new Date(n); return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

    function findTask(key) {
        try {
            if (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks)) {
                return userActiveTasks.find((t) => String((t && t.key) || '') === String(key || '')) || null;
            }
        } catch (_) {}
        return null;
    }

    // the user list (already in memory on most pages; read once otherwise)
    async function approvers() {
        let data = null;
        try { if (typeof getApproversDataSafe === 'function') data = getApproversDataSafe(); } catch (_) {}
        try { if ((!data || !Object.keys(data).length) && typeof allApproverData !== 'undefined' && allApproverData) data = allApproverData; } catch (_) {}
        if (!data || typeof data !== 'object' || !Object.keys(data).length) {
            try { const s = await mainDb().ref('approvers').once('value'); data = s.val() || {}; } catch (_) { data = {}; }
            try { if (typeof allApproverData !== 'undefined' && !allApproverData) allApproverData = data; } catch (_) {}
        }
        const list = Array.isArray(data) ? data.map((v, i) => [String(i), v]) : Object.entries(data);
        return list.filter(([, v]) => v && (v.Name || v.name)).map(([k, v]) => ({
            key: k, name: String(v.Name || v.name).trim(), pos: String(v.Position || '').trim(),
            site: String(v.Site || '').trim(), mobile: String(v.Mobile || '').trim(), role: String(v.Role || '').trim()
        }));
    }
    function approverByKeySync(key) {
        let data = null;
        try { if (typeof getApproversDataSafe === 'function') data = getApproversDataSafe(); } catch (_) {}
        try { if (!data && typeof allApproverData !== 'undefined') data = allApproverData; } catch (_) {}
        return (data && key && data[key]) || null;
    }
    function personLine(p) { return [p.pos, p.site ? 'Site ' + p.site : '', p.mobile].filter(Boolean).join(' · '); }

    // ------------------------------------------------------------------
    // "Who can print ESN" (system_settings/esn_printers/{userKey})
    // ------------------------------------------------------------------
    let printers = null;
    let printersAt = 0;
    async function loadPrinters(force) {
        if (!force && printers && Date.now() - printersAt < 10 * 60000) return printers;
        try { const s = await mainDb().ref(SET_PATH).once('value'); printers = s.val() || {}; printersAt = Date.now(); }
        catch (e) { console.warn('[esn] settings not read', e); printers = printers || {}; }
        return printers;
    }
    // fail-safe: the saved name AND mobile must still be the user's
    function matches(entry, rec) {
        if (!entry || !rec) return false;
        return norm(entry.name) === norm(rec.Name || rec.name) && !!normMob(entry.mobile) && normMob(entry.mobile) === normMob(rec.Mobile || rec.mobile);
    }
    function allowedSync(key, rec) {
        if (!key || !printers) return false;
        return matches(printers[key], rec || approverByKeySync(key));
    }
    async function allowedFresh(key) {
        if (!key) return false;
        try {
            const d = mainDb();
            const [e, r] = await Promise.all([d.ref(SET_PATH + '/' + key).once('value'), d.ref('approvers/' + key).once('value')]);
            return matches(e.val(), r.val());
        } catch (e) { console.warn('[esn] check failed', e); return false; }
    }
    // null = not known yet (settings still loading)
    function meAllowedSync() {
        if (isSuper()) return true;
        if (!printers) return null;
        const u = user();
        return !!(u && u.key && matches(printers[u.key], u));
    }
    async function meAllowed() {
        if (isSuper()) return true;
        const k = myKey();
        if (!k) return false;
        const ok = await allowedFresh(k);
        loadPrinters(true).then(repaintRows);
        return ok;
    }

    // Who gets the decision back (called by iba-approvals.js decide()).
    // null = today's rule (Irwin / his replacement).
    async function returnTo(inv, action) {
        if (!inv || inv.approvalFlow !== 'site') return null;
        const req = String(inv.approvalRequestedBy || '').trim();
        if (!req) return null;
        let target = req;
        try { if (typeof resolveVacationAssignee === 'function') target = resolveVacationAssignee(req) || req; } catch (_) {}
        if (action === 'Rejected') return { name: target, site: true };
        let ok = false;
        if (norm(target) === norm(req)) {
            ok = await allowedFresh(inv.approvalRequestedByKey);
        } else {
            // the vacation replacement prints only if they are on the list too
            const same = (await approvers()).filter((p) => norm(p.name) === norm(target));
            ok = same.length === 1 ? await allowedFresh(same[0].key) : false;
        }
        return ok ? { name: target, site: true } : null;
    }

    // ------------------------------------------------------------------
    // the small window used by everything here
    // ------------------------------------------------------------------
    let closeCurrent = null;
    function openWin(title, icon, bodyHtml, footHtml, wide) {
        if (closeCurrent) closeCurrent();
        const w = document.createElement('div');
        w.id = 'iba-esn';
        w.className = 'iba-esn-ov';
        w.innerHTML = '<div class="iba-esn-box' + (wide ? ' is-wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
            '<div class="iba-esn-head"><b><i class="fa-solid ' + icon + '"></i> ' + esc(title) + '</b>' +
            '<button type="button" class="iba-esn-x" data-esn-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-esn-body">' + bodyHtml + '</div>' +
            (footHtml ? '<div class="iba-esn-foot">' + footHtml + '</div>' : '') + '</div>';
        document.body.appendChild(w);
        let done;
        const closed = new Promise((r) => { done = r; });
        const close = () => { if (!w.isConnected) return; w.remove(); closeCurrent = null; done(); };
        closeCurrent = close;
        w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('[data-esn-x]')) close(); });
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        return { w, close, closed, err: (m) => { const el = w.querySelector('.iba-esn-err'); if (el) el.textContent = m || ''; } };
    }
    function invGrid(task) {
        const ids = taskIds(task);
        const a = apv();
        const amount = task.amountPaid || task.amount || '';
        return '<div class="iba-esn-grid">' + [
            ['PO', ids.po], ['Invoice', task.ref || task.invNumber || ''], ['Vendor', task.vendorName || ''],
            ['Site', task.site || ''], ['Amount', amount !== '' ? 'QAR ' + (a ? a.money(amount) : amount) : '']
        ].map(([k, v]) => '<div><small>' + esc(k) + '</small><strong>' + esc(v || '—') + '</strong></div>').join('') + '</div>';
    }

    // ------------------------------------------------------------------
    // 1. Approval (For SRV -> engineer)
    // ------------------------------------------------------------------
    const ENGINEER_RX = /eng|manager|director|coo|head|supervisor|incharge|in-charge|\bpm\b/i;
    async function openApproval(task) {
        if (!task) { toast('Task not found. Please refresh.', 'error'); return; }
        const W = openWin('Send for approval', 'fa-user-check',
            invGrid(task) +
            '<p class="iba-esn-sub">This counts as <b>SRV done</b>. The invoice goes to the engineer you pick as <b>For Approval</b>' +
            ' and comes back to you once it is approved.</p>' +
            '<label class="iba-esn-lab">Engineer</label>' +
            '<input type="search" class="iba-esn-q" placeholder="Find a name, position, site or mobile" autocomplete="off">' +
            '<div class="iba-esn-people" role="listbox"><p class="iba-esn-sub">Loading users…</p></div>' +
            '<label class="iba-esn-all"><input type="checkbox" class="iba-esn-all-cb"> Show everyone (not only engineers and managers)</label>' +
            '<label class="iba-esn-lab">Note for the engineer (optional)</label>' +
            '<textarea class="iba-esn-note" rows="2" placeholder="e.g. delivery checked, all items received"></textarea>' +
            '<div class="iba-esn-err" role="alert"></div>',
            '<span class="iba-esn-picked">No engineer picked yet</span><span class="iba-esn-sp"></span>' +
            '<button type="button" class="iba-esn-btn" data-esn-x>Cancel</button>' +
            '<button type="button" class="iba-esn-btn is-go" data-esn-send disabled><i class="fa-solid fa-paper-plane"></i> Send for approval</button>');
        const box = W.w;
        const q = box.querySelector('.iba-esn-q');
        const listEl = box.querySelector('.iba-esn-people');
        const allCb = box.querySelector('.iba-esn-all-cb');
        const sendBtn = box.querySelector('[data-esn-send]');
        let people = [];
        let picked = null;
        const meKey = myKey(), meN = norm(myName());
        const paint = () => {
            const t = norm(q.value);
            const hit = people.filter((p) => p.key !== meKey && norm(p.name) !== meN)
                .filter((p) => allCb.checked || t || ENGINEER_RX.test(p.pos))
                .filter((p) => !t || norm([p.name, p.pos, p.site, p.mobile].join(' ')).indexOf(t) !== -1)
                .sort((a, b) => (Number(!ENGINEER_RX.test(a.pos)) - Number(!ENGINEER_RX.test(b.pos))) || a.name.localeCompare(b.name));
            // same name twice: both rows say so, so the right one is picked
            const count = {};
            people.forEach((p) => { const n = norm(p.name); count[n] = (count[n] || 0) + 1; });
            listEl.innerHTML = hit.length ? hit.slice(0, 80).map((p) =>
                '<button type="button" class="iba-esn-person' + (picked && picked.key === p.key ? ' is-on' : '') + '" data-pk="' + esc(p.key) + '">' +
                '<b>' + esc(p.name) + (count[norm(p.name)] > 1 ? ' <span class="iba-esn-same">same name</span>' : '') + '</b>' +
                '<small>' + esc(personLine(p) || '—') + '</small></button>').join('')
                : '<p class="iba-esn-sub">No name matches. Tick "Show everyone" or type part of the name.</p>';
        };
        listEl.addEventListener('click', (e) => {
            const b = e.target.closest('[data-pk]');
            if (!b) return;
            picked = people.find((p) => p.key === b.getAttribute('data-pk')) || null;
            box.querySelector('.iba-esn-picked').innerHTML = picked ? 'To: <b>' + esc(picked.name) + '</b> <small>' + esc(personLine(picked)) + '</small>' : 'No engineer picked yet';
            sendBtn.disabled = !picked;
            paint();
        });
        q.addEventListener('input', paint);
        allCb.addEventListener('change', paint);
        sendBtn.addEventListener('click', async () => {
            if (!picked) return;
            W.err('');
            sendBtn.disabled = true;
            const label = sendBtn.innerHTML;
            sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
            try {
                await sendForApproval(task, picked, box.querySelector('.iba-esn-note').value);
                W.close();
            } catch (e) {
                W.err((e && e.message) || String(e));
                sendBtn.disabled = false;
            } finally { sendBtn.innerHTML = label; }
        });
        setTimeout(() => q.focus(), 30);
        people = await approvers();
        paint();
        return W.closed;
    }

    async function sendForApproval(task, eng, note) {
        const ids = taskIds(task);
        const po = ids.po, key = ids.key;
        const idb = invDb();
        if (!po || !key || !idb) throw new Error('Invoice identifiers are missing. Please refresh.');
        const ref = idb.ref('invoice_entries/' + po + '/' + key);
        const inv = (await ref.once('value')).val();
        if (!inv) throw new Error('This invoice was not found. It may have been deleted.');
        const st = norm(inv.status);
        const fromRejected = st === 'rejected' && inv.approvalFlow === 'site';
        if (SRV_STEPS.indexOf(st) === -1 && !fromRejected) throw new Error('This invoice is now "' + (inv.status || 'no status') + '". Please refresh.');
        if (!namedForMe(inv.attention || '')) throw new Error('This invoice is no longer in your name (Attention: ' + (inv.attention || 'none') + ').');
        const a = apv();
        if (a) {
            const used = await a.countApprovals(po, key);
            if (used >= a.MAX_APPROVALS) throw new Error('This invoice already has ' + a.MAX_APPROVALS + ' approvals.');
        }
        const me = myName() || 'User';
        const n = String(note || '').trim();
        const updates = {
            status: 'For Approval', remarks: 'For Approval', attention: eng.name,
            approvalFlow: 'site', approvalRequestedBy: me, approvalRequestedByKey: myKey(), approvalRequestedAt: ts(),
            approvalEngineer: eng.name, approvalEngineerKey: eng.key, approvalRequestNote: n,
            srvDoneBy: me, srvDoneAt: ts(),
            approvalReturnOpen: false, esnState: null, esnPrintedAt: null, esnPrintedBy: null, readyAt: null, readyBy: null,
            statusChangedAt: ts(), statusQueueAt: ts(), updatedAt: ts(), updatedBy: me, lastUpdated: ts()
        };
        await Promise.all([
            ref.update(updates),
            ref.child('history').push({ action: 'SRV done, sent for approval', status: 'For Approval', by: me, to: eng.name, note: n, timestamp: ts() })
        ]);
        await afterSave(po, key, inv, updates, 'For Approval', 'SRV done, sent for approval to ' + eng.name);
        if (typeof window.ibaFinishTaskAction === 'function') window.ibaFinishTaskAction(task.key, 'SRV done · sent to ' + eng.name + ' for approval.');
        else toast('Sent to ' + eng.name + ' for approval.');
    }

    // the task lists, the linked job record and this browser's copy
    async function afterSave(po, key, inv, updates, status, note) {
        const merged = Object.assign({}, inv, updates);
        const jobs = [];
        try { if (typeof updateInvoiceTaskLookup === 'function') jobs.push(updateInvoiceTaskLookup(po, key, merged, inv.attention || '')); } catch (e) { console.warn('[esn] task list', e); }
        try { if (typeof updateLinkedJobEntry === 'function' && inv.linkedJobEntryKey) jobs.push(updateLinkedJobEntry(po, key, status, note)); } catch (e) { console.warn('[esn] job record', e); }
        try { if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(po, key, updates); } catch (_) {}
        await Promise.allSettled(jobs);
    }

    // ------------------------------------------------------------------
    // 2. Print ESN window
    // ------------------------------------------------------------------
    let origPrint = null;
    async function readStickers(po, key) {
        // the original routine works out PO / invoice no. and the approvals
        if (!origPrint) return [];
        return (await origPrint(key, 'Invoice', po, { position: '4', collect: true })) || [];
    }
    function dateNum(d) {
        const m = String(d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        return m ? Number(m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0')) : 0;
    }

    // 17.0.3: the approval time from the ESN register (manager_approved/
    // esn_registry/{ESN}.usedAt, one tiny read per signature). Older ESNs
    // without it keep the date only.
    const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    function stampWhen(ms) {
        const d = new Date(Number(ms));
        if (!ms || isNaN(d)) return '';
        let h = d.getHours();
        const ap = h < 12 ? 'AM' : 'PM';
        h = h % 12 || 12;
        return String(d.getDate()).padStart(2, '0') + '/' + MON[d.getMonth()] + '/' + d.getFullYear() + ' ' + DAY[d.getDay()] + ' ' +
            h + ':' + String(d.getMinutes()).padStart(2, '0') + ap;
    }
    function dateOnly(dmy) {
        const m = String(dmy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!m) return String(dmy || '');
        const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        return m[1].padStart(2, '0') + '/' + MON[d.getMonth()] + '/' + m[3] + ' ' + DAY[d.getDay()];
    }
    async function addTimes(list) {
        await Promise.all(list.map(async (s) => {
            const base = String(s.esn || '').split('/')[0].trim();
            let at = 0;
            if (base) {
                try {
                    const r = (await mainDb().ref('manager_approved/esn_registry/' + base).once('value')).val();
                    if (r && Number(r.usedAt) && (!r.esn || r.esn === s.esn)) at = Number(r.usedAt);
                } catch (_) {}
            }
            s.at = at;
            s.when = at ? stampWhen(at) : dateOnly(s.date);
        }));
    }

    async function printWindow(po, key, opts) {
        opts = opts || {};
        let stickers = [];
        try { stickers = await readStickers(po, key); } catch (e) { console.warn('[esn] read', e); }
        if (!stickers.length) { alert('No approval stickers found for this invoice.'); return; }
        // newest last: by date, then slot order (MD last)
        await addTimes(stickers);
        stickers = stickers.map((s, i) => Object.assign({}, s, { _i: i })).sort((a, b) => (dateNum(a.date) - dateNum(b.date)) || ((a.at || 0) - (b.at || 0)) || (a._i - b._i));
        const newest = stickers.length - 1;
        // newest on Right bottom; the older ones get the other places, unticked
        const order = ['RB', 'M', 'L', 'RM', 'RT'];
        stickers.forEach((s, i) => { s._place = order[(newest - i) % order.length]; s._on = i === newest; });
        // basket: what was picked before
        // 17.0.3 patch 9: ESN compared loosely (history rows may carry the ESN a
        // bit differently); when nothing matches the defaults stay
        const sameEsn = (a, b) => {
            const x = String(a || '').trim().toUpperCase(), y = String(b || '').trim().toUpperCase();
            return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x));
        };
        if (Array.isArray(opts.current) && opts.current.length && stickers.some((s) => opts.current.some((x) => x && sameEsn(x.esn, s.esn)))) {
            stickers.forEach((s) => {
                const c = opts.current.find((x) => x && sameEsn(x.esn, s.esn));
                s._on = !!c;
                if (c && PLACE_CSS[c.place]) s._place = c.place;
            });
        }

        const rows = stickers.map((s, i) =>
            '<tr data-i="' + i + '"><td class="c"><input type="checkbox" class="iba-esn-tick"' + (s._on ? ' checked' : '') + ' aria-label="Print this signature"></td>' +
            '<td><b>' + esc(s.approverName || '—') + '</b>' + (s.isCeo ? ' <span class="iba-esn-same">MD</span>' : '') + (i === newest ? ' <span class="iba-esn-new">newest</span>' : '') + '</td>' +
            '<td>' + esc(s.when || s.date || '') + '</td><td class="iba-esn-mono">' + esc(s.esn || '') + '</td>' +
            '<td><select class="iba-esn-place">' + PLACES.map(([v, l]) => '<option value="' + v + '"' + (s._place === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></td></tr>').join('');

        const W = openWin(opts.choose ? 'Add to print basket' : 'Print ESN', opts.choose ? 'fa-cart-plus' : 'fa-print',
            '<p class="iba-esn-sub">PO <b>' + esc(po) + '</b> · invoice ' + esc((stickers[0] && stickers[0].invoiceOrdinal) || '') +
            '. Tick what to print and where. Older signatures are usually on the paper already, so only the newest is ticked.</p>' +
            '<div class="iba-esn-printgrid"><div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th></th><th>Approver</th><th>Date</th><th>ESN</th><th>Place</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<div class="iba-esn-a4" aria-label="Page preview"><span class="iba-esn-a4-cap">A4</span></div></div>' +
            '<div class="iba-esn-err" role="alert"></div>',
            '<span class="iba-esn-sp"></span><button type="button" class="iba-esn-btn" data-esn-x>Cancel</button>' +
            '<button type="button" class="iba-esn-btn is-go" data-esn-print>' + (opts.choose ? '<i class="fa-solid fa-cart-plus"></i> ' + esc(opts.choose) : '<i class="fa-solid fa-print"></i> Print') + '</button>', true);
        const box = W.w;
        const a4 = box.querySelector('.iba-esn-a4');
        const picks = () => Array.from(box.querySelectorAll('tbody tr')).map((tr) => ({
            s: stickers[Number(tr.getAttribute('data-i'))],
            on: tr.querySelector('.iba-esn-tick').checked,
            place: tr.querySelector('.iba-esn-place').value
        }));
        const preview = () => {
            const p = picks().filter((x) => x.on);
            const used = {};
            p.forEach((x) => { used[x.place] = (used[x.place] || 0) + 1; });
            a4.querySelectorAll('.iba-esn-a4-s').forEach((el) => el.remove());
            p.forEach((x) => {
                const el = document.createElement('div');
                el.className = 'iba-esn-a4-s is-' + x.place + (used[x.place] > 1 ? ' is-clash' : '');
                el.textContent = String(x.s.approverName || '').split(/\s+/)[0];
                a4.appendChild(el);
            });
            const clash = Object.keys(used).filter((k) => used[k] > 1);
            W.err(clash.length ? 'Two signatures are on the same place (' + clash.map((k) => PLACES.find((x) => x[0] === k)[1]).join(', ') + '). Pick another place for one of them.' : '');
            box.querySelector('[data-esn-print]').disabled = !p.length || clash.length > 0;
        };
        box.addEventListener('change', preview);
        preview();
        box.querySelector('[data-esn-print]').addEventListener('click', async () => {
            const p = picks().filter((x) => x.on);
            if (!p.length) return;
            if (opts.choose) {
                W.close();
                if (typeof opts.onPicked === 'function') opts.onPicked(p.map((x) => ({ esn: x.s.esn || '', place: x.place, name: x.s.approverName || '' })));
                return;
            }
            printStickers(p.map((x) => Object.assign({}, x.s, { cssPosition: PLACE_CSS[x.place] })));
            W.close();
            if (typeof opts.onPrinted === 'function') {
                try { await opts.onPrinted(p.map((x) => (x.s.esn || '') + ' (' + PLACES.find((y) => y[0] === x.place)[1] + ')')); } catch (e) { console.warn('[esn] after print', e); }
            }
        });
        return W.closed;
    }

    // design A: QR stamp. The QR opens the approval's receipt PDF (or holds the ESN).
    function qrData(text) {
        try {
            if (typeof QRCode !== 'function' || !text) return '';
            const holder = document.createElement('div');
            holder.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(holder);
            new QRCode(holder, { text: String(text), width: 192, height: 192, correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0 });
            const c = holder.querySelector('canvas');
            const img = holder.querySelector('img');
            const url = (c && c.toDataURL) ? c.toDataURL('image/png') : (img ? img.src : '');
            holder.remove();
            return url || '';
        } catch (e) { console.warn('[esn] QR', e); return ''; }
    }
    function stickerA(s) {
        const qr = qrData(s.pdf || s.esn);
        const po = String(s.poDisplay || s.po || '');
        const inv = String(s.invoiceOrdinal || '01').padStart(2, '0');
        return '<div class="esa" style="' + (s.cssPosition || '') + '">' +
            '<div class="q">' + (qr ? '<img src="' + qr + '" alt="">' : '<span class="noqr">ESN</span>') + '</div>' +
            '<div class="t"><div class="k">APPROVED</div>' +
            '<div class="big">PO ' + esc(po) + ' · INV ' + esc(inv) + '</div>' +
            '<div class="esn">' + esc(s.esn || '') + '</div>' +
            // the ESN already ends with the name, so the last line is the date only (martin)
            '<div class="m">' + esc(s.when || s.date || '') + '</div></div></div>';
    }
    const STICKER_CSS =
        '@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}' +
        '.page{position:relative;width:210mm;height:297mm;overflow:hidden;page-break-after:always;break-after:page}' +
        '.page:last-child{page-break-after:auto;break-after:auto}' +
        '.esa{position:absolute;display:flex;align-items:stretch;width:46mm;box-sizing:border-box;border:0.4mm solid #111;border-radius:1.1mm;overflow:hidden;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111}' +
        '.esa .q{padding:1mm;border-right:0.4mm solid #111;display:flex;align-items:center;justify-content:center}' +
        '.esa .q img{width:12.6mm;height:12.6mm;display:block;image-rendering:pixelated}' +
        '.esa .noqr{width:12.6mm;font-weight:900;font-size:6.5pt;text-align:center}' +
        '.esa .t{flex:1;min-width:0;padding:.8mm 1.5mm}' +
        '.esa .k{font-size:9.1pt;line-height:1.05;font-weight:900;letter-spacing:.06em;color:#0f6b2f}' +
        '.esa .big{font-size:7pt;font-weight:800;white-space:nowrap;margin-top:.4mm}' +
        '.esa .esn{font-family:"Courier New",monospace;font-size:6.7pt;font-weight:700;white-space:nowrap;margin:.35mm 0}' +
        '.esa .m{text-align:left;font-size:5.8pt;font-weight:700;border-top:0.2mm solid #888;padding-top:.4mm}' +
        '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}';
    function printStickers(list, pagesHtml) {
        const html = pagesHtml || ('<div class="page">' + list.map(stickerA).join('') + '</div>');
        const old = $('iba-esn-print-frame');
        if (old) old.remove();
        const frame = document.createElement('iframe');
        frame.id = 'iba-esn-print-frame';
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
        document.body.appendChild(frame);
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open();
        doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Approval</title><style>' + STICKER_CSS + '</style></head><body>' + html + '</body></html>');
        doc.close();
        setTimeout(() => {
            try { frame.contentWindow.focus(); frame.contentWindow.print(); }
            catch (e) { console.warn('[esn] print failed', e); }
        }, 350);
        window.__ibaEsnLastPrint = html;
    }

    // ------------------------------------------------------------------
    // 17.0.3: print basket uses the same window and sticker
    // ------------------------------------------------------------------
    // resolves [{esn, place, name}] or null (cancelled)
    function choose(po, key, current, label) {
        return new Promise((resolve) => {
            let got = null;
            Promise.resolve(printWindow(po, key, { choose: label || 'Add to basket', current, onPicked: (p) => { got = p; } }))
                .then(() => resolve(got), () => resolve(null));
        });
    }
    // one A4 page per basket item; items: [{po, key, picks|pos}]
    async function basketPages(items, progress) {
        const pages = [], missing = [];
        for (let i = 0; i < items.length; i++) {
            const x = items[i];
            if (typeof progress === 'function') progress(i, x);
            let st = [];
            try { st = await readStickers(x.po, x.key); } catch (_) { st = []; }
            if (!st.length) { missing.push('PO ' + x.po + (x.ref ? ' (' + x.ref + ')' : '')); continue; }
            await addTimes(st);
            let picks = Array.isArray(x.picks) ? x.picks : null;
            if (!picks || !picks.length) {
                // added before 17.0.3: the newest signature on Right bottom
                st.sort((a, b) => (dateNum(a.date) - dateNum(b.date)) || ((a.at || 0) - (b.at || 0)));
                picks = [{ esn: st[st.length - 1].esn, place: 'RB' }];
            }
            const chosen = picks.map((pk) => { const s0 = st.find((s) => s.esn === pk.esn); return s0 ? Object.assign({}, s0, { cssPosition: PLACE_CSS[pk.place] || PLACE_CSS.RB }) : null; }).filter(Boolean);
            if (!chosen.length) { missing.push('PO ' + x.po + (x.ref ? ' (' + x.ref + ')' : '')); continue; }
            pages.push('<div class="page">' + chosen.map(stickerA).join('') + '</div>');
        }
        return { pages, missing };
    }
    function printPages(pages) { printStickers(null, pages.join('')); }
    function placeName(k) { const p = PLACES.find((x) => x[0] === k); return p ? p[1] : k; }

    // Every print from the system goes through here. Basket (collect /
    // position) keeps the original routine.
    async function guardedPrint(key, type, po, opts) {
        opts = opts || {};
        if (opts.collect || opts.position) return origPrint(key, type, po, opts);
        if (!key || !po) { alert('Missing data for print.'); return; }
        // after Ready only Irwin prints
        if (!isSuper()) {
            try {
                const inv = (await invDb().ref('invoice_entries/' + po + '/' + key).once('value')).val() || {};
                if (inv.esnState === 'ready') { alert('This invoice was handed to ' + superName() + ' as Ready. Only ' + superName() + ' can print its ESN now.'); return; }
            } catch (_) {}
        }
        // 17.0.3 patch 9: opts.esn = open with that ESN ticked (history Print)
        return printWindow(po, key, opts.esn ? { current: [{ esn: opts.esn, place: 'RB' }] } : undefined);
    }

    // 17.0.3 patch 9: the Print button in an invoice's Status History used its
    // own plain sticker (printHistorySticker). It now opens the same Print ESN
    // window (QR sticker A, places) for that invoice with that ESN ticked.
    let histPo = '', histKey = '';
    function wrapHistory() {
        if (typeof window.showInvoiceHistory !== 'function' || typeof window.printHistorySticker !== 'function') return false;
        if (window.showInvoiceHistory.__ibaEsn) return true;
        const origShow = window.showInvoiceHistory;
        const origHist = window.printHistorySticker;
        const show = function (po, key) { histPo = String(po || ''); histKey = String(key || ''); return origShow.apply(this, arguments); };
        show.__ibaEsn = true;
        window.showInvoiceHistory = show;
        window.printHistorySticker = function (esn) {
            const modal = document.getElementById('history-modal');
            const open = modal && !modal.classList.contains('hidden');
            if (open && histPo && histKey && typeof window.handlePrintSticker === 'function' && window.handlePrintSticker.__ibaEsn) {
                return window.handlePrintSticker(histKey, 'Invoice', histPo, { esn: esn });
            }
            return origHist.apply(this, arguments);
        };
        return true;
    }
    if (!wrapHistory()) {
        let hn = 0;
        const ht = setInterval(() => { if (wrapHistory() || ++hn > 60) clearInterval(ht); }, 500);
    }

    async function printForTask(task) {
        if (!task) { toast('Task not found. Please refresh.', 'error'); return; }
        const ids = taskIds(task);
        const ok = await meAllowed();
        if (!ok) {
            alert('ESN printing is switched off for you (ask ' + superName() + '). Press Ready to hand the invoice to ' + superName() + ' for printing.');
            task.esnPrintBlocked = true;
            repaintRows();
            return;
        }
        const inv = (await invDb().ref('invoice_entries/' + ids.po + '/' + ids.key).once('value')).val() || {};
        if (inv.esnState !== 'approved' || !namedForMe(inv.attention || '')) {
            alert('This invoice is not waiting for you to print any more (status: ' + (inv.status || 'none') + '). Please refresh.');
            return;
        }
        return printWindow(ids.po, ids.key, {
            onPrinted: async (what) => {
                const me = myName();
                const ref = invDb().ref('invoice_entries/' + ids.po + '/' + ids.key);
                await Promise.all([
                    ref.update({ esnPrintedAt: ts(), esnPrintedBy: me }),
                    ref.child('history').push({ action: 'ESN printed', status: inv.status || 'Approved', by: me, note: what.join(', '), timestamp: ts() })
                ]);
                task.esnPrintedAt = Date.now();
                task.esnPrintedBy = me;
                repaintRows();
            }
        });
    }

    // ------------------------------------------------------------------
    // 3. Ready (sender -> Irwin)
    // ------------------------------------------------------------------
    async function ready(task) {
        if (!task) { toast('Task not found. Please refresh.', 'error'); return; }
        const ids = taskIds(task);
        const to = (apv() && apv().senderName()) || superName();
        if (!confirm('Hand PO ' + ids.po + (task.ref ? ' (' + task.ref + ')' : '') + ' to ' + to + ' as Ready?\n\nAfter this you cannot print or change it. Only ' + superName() + ' can send it back.')) return;
        const ref = invDb().ref('invoice_entries/' + ids.po + '/' + ids.key);
        const inv = (await ref.once('value')).val();
        if (!inv) { toast('This invoice was not found.', 'error'); return; }
        if (inv.esnState !== 'approved' || !namedForMe(inv.attention || '')) { toast('This invoice is not waiting for you any more. Please refresh.', 'error'); return; }
        const me = myName();
        const updates = {
            status: 'Ready', remarks: 'Ready', attention: to, esnState: 'ready', readyAt: ts(), readyBy: me,
            approvalReturnOpen: false, statusChangedAt: ts(), statusQueueAt: ts(), updatedAt: ts(), updatedBy: me, lastUpdated: ts()
        };
        await Promise.all([ref.update(updates), ref.child('history').push({ action: 'Ready', status: 'Ready', by: me, to, timestamp: ts() })]);
        await afterSave(ids.po, ids.key, inv, updates, 'Ready', 'Ready, handed to ' + to);
        if (typeof window.ibaFinishTaskAction === 'function') window.ibaFinishTaskAction(task.key, 'Ready · handed to ' + to + '.');
    }

    // ------------------------------------------------------------------
    // 4. Extra (Irwin)
    // ------------------------------------------------------------------
    async function extra(task) {
        if (!isSuper()) { alert('Extra is for ' + superName() + ' only.'); return; }
        if (!task) { toast('Task not found. Please refresh.', 'error'); return; }
        const ids = taskIds(task);
        const inv = (await invDb().ref('invoice_entries/' + ids.po + '/' + ids.key).once('value')).val() || {};
        const req = inv.approvalRequestedBy || '';
        const W = openWin('Extra', 'fa-ellipsis',
            invGrid(task) +
            '<p class="iba-esn-sub">Sent by <b>' + esc(req || '—') + '</b>' + (inv.readyBy ? ' · Ready by <b>' + esc(inv.readyBy) + '</b> ' + esc(dateOf(inv.readyAt)) : '') + '</p>' +
            '<div class="iba-esn-extra">' +
            '<button type="button" class="iba-esn-btn" data-ex="back"' + (req ? '' : ' disabled') + '><i class="fa-solid fa-rotate-left"></i> Send back to ' + esc(req || 'sender') + '<small>They can print the ESN and press Ready again.</small></button>' +
            '<button type="button" class="iba-esn-btn" data-ex="print"><i class="fa-solid fa-print"></i> Print ESN<small>Pick the signatures and places.</small></button>' +
            '<button type="button" class="iba-esn-btn" data-ex="hist"><i class="fa-solid fa-clock-rotate-left"></i> History<small>Every step of this invoice.</small></button>' +
            '</div><div class="iba-esn-histbox"></div><div class="iba-esn-err" role="alert"></div>');
        W.w.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-ex]');
            if (!b) return;
            const what = b.getAttribute('data-ex');
            if (what === 'print') { W.close(); await printWindow(ids.po, ids.key); return; }
            if (what === 'hist') { W.w.querySelector('.iba-esn-histbox').innerHTML = historyHtml(inv); return; }
            if (what === 'back') {
                b.disabled = true;
                try { await sendBack(task, inv); W.close(); }
                catch (err) { W.err((err && err.message) || String(err)); b.disabled = false; }
            }
        });
        return W.closed;
    }
    function historyHtml(inv) {
        const h = inv && inv.history ? Object.values(inv.history).filter(Boolean) : [];
        h.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
        if (!h.length) return '<p class="iba-esn-sub">No history saved.</p>';
        return '<div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th>When</th><th>What</th><th>By</th><th>Note</th></tr></thead><tbody>' +
            h.slice(-40).map((x) => '<tr><td>' + esc(dateOf(x.timestamp)) + '</td><td>' + esc(x.action || x.status || '') + (x.to ? ' → ' + esc(x.to) : '') + '</td><td>' + esc(x.by || x.user || '') + '</td><td>' + esc(x.note || x.esn || '') + '</td></tr>').join('') +
            '</tbody></table></div>';
    }
    async function sendBack(task, inv) {
        const ids = taskIds(task);
        const req = String(inv.approvalRequestedBy || '').trim();
        if (!req) throw new Error('The sender is not known for this invoice.');
        let to = req;
        try { if (typeof resolveVacationAssignee === 'function') to = resolveVacationAssignee(req) || req; } catch (_) {}
        if (!confirm('Send PO ' + ids.po + ' back to ' + to + '? They can print the ESN and press Ready again.')) return;
        const me = myName();
        const updates = {
            status: 'Approved', remarks: 'Approved', attention: to, esnState: 'approved', approvalReturnOpen: true,
            esnPrintedAt: null, esnPrintedBy: null, readyAt: null, readyBy: null,
            statusChangedAt: ts(), statusQueueAt: ts(), updatedAt: ts(), updatedBy: me, lastUpdated: ts()
        };
        const ref = invDb().ref('invoice_entries/' + ids.po + '/' + ids.key);
        await Promise.all([ref.update(updates), ref.child('history').push({ action: 'Sent back to sender', status: 'Approved', by: me, to, timestamp: ts() })]);
        await afterSave(ids.po, ids.key, inv, updates, 'Approved', 'Sent back to ' + to);
        if (typeof window.ibaFinishTaskAction === 'function') window.ibaFinishTaskAction(task.key, 'Sent back to ' + to + '.');
    }

    // ------------------------------------------------------------------
    // 5. "Who can print ESN" (Super Admin)
    // ------------------------------------------------------------------
    async function openSettings() {
        if (!isSuper()) { alert('"Who can print ESN" is for the Super Admin only.'); return; }
        const W = openWin('Who can print ESN', 'fa-stamp',
            '<p class="iba-esn-sub">People on this list print the ESN of invoices their engineer approved, from their own Active Task, and then press Ready. ' +
            'They are kept by their user record with the name and mobile of today. If the name or mobile changes, printing stops for them (red) until you remove and add them again.</p>' +
            '<div class="iba-esn-cur"><p class="iba-esn-sub">Loading…</p></div>' +
            '<label class="iba-esn-lab">Add a person</label>' +
            '<input type="search" class="iba-esn-q" placeholder="Find a name, position, site or mobile" autocomplete="off">' +
            '<div class="iba-esn-people"></div><div class="iba-esn-err" role="alert"></div>', '', true);
        const box = W.w;
        const cur = box.querySelector('.iba-esn-cur');
        const q = box.querySelector('.iba-esn-q');
        const listEl = box.querySelector('.iba-esn-people');
        let people = [];
        const byKey = {};
        const paintCur = () => {
            const keys = Object.keys(printers || {});
            if (!keys.length) { cur.innerHTML = '<p class="iba-esn-sub"><b>Nobody yet.</b> Only ' + esc(superName()) + ' prints ESN (same as before).</p>'; return; }
            cur.innerHTML = '<div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th>Person</th><th>Saved when added</th><th>Now</th><th></th></tr></thead><tbody>' + keys.map((k) => {
                const e = printers[k] || {};
                const p = byKey[k];
                const rec = p ? { Name: p.name, Mobile: p.mobile } : null;
                const ok = matches(e, rec);
                const now = p ? p.name + ' · ' + (p.mobile || 'no mobile') : 'user record deleted';
                return '<tr class="' + (ok ? 'is-ok' : 'is-bad') + '"><td><b>' + esc(p ? p.name : e.name) + '</b><small>' + esc(p ? [p.pos, p.site ? 'Site ' + p.site : ''].filter(Boolean).join(' · ') : '') + '</small></td>' +
                    '<td>' + esc((e.name || '') + ' · ' + (e.mobile || '')) + '<small>by ' + esc(e.addedBy || '') + ' ' + esc(dateOf(e.addedAt)) + '</small></td>' +
                    '<td>' + (ok ? '<span class="iba-esn-ok"><i class="fa-solid fa-circle-check"></i> Can print</span>' : '<span class="iba-esn-bad"><i class="fa-solid fa-triangle-exclamation"></i> Details changed: now ' + esc(now) + '. Printing is off.</span>') + '</td>' +
                    '<td><button type="button" class="iba-esn-btn is-small" data-rm="' + esc(k) + '">Remove</button></td></tr>';
            }).join('') + '</tbody></table></div>';
        };
        const paintAdd = () => {
            const t = norm(q.value);
            if (!t) { listEl.innerHTML = ''; return; }
            const hit = people.filter((p) => !(printers && printers[p.key]) && norm([p.name, p.pos, p.site, p.mobile].join(' ')).indexOf(t) !== -1).slice(0, 30);
            listEl.innerHTML = hit.length ? hit.map((p) => '<button type="button" class="iba-esn-person" data-add="' + esc(p.key) + '"><b>' + esc(p.name) + '</b><small>' + esc(personLine(p) || '—') + '</small><span class="iba-esn-addtag"><i class="fa-solid fa-plus"></i> Add</span></button>').join('')
                : '<p class="iba-esn-sub">No one found (people already on the list are not shown).</p>';
        };
        q.addEventListener('input', paintAdd);
        box.addEventListener('click', async (e) => {
            const add = e.target.closest('[data-add]');
            const rm = e.target.closest('[data-rm]');
            W.err('');
            try {
                if (add) {
                    const p = byKey[add.getAttribute('data-add')];
                    if (!p) return;
                    if (!normMob(p.mobile)) { W.err(p.name + ' has no mobile saved, so the safety check cannot work. Add the mobile to the user first.'); return; }
                    await mainDb().ref(SET_PATH + '/' + p.key).set({ name: p.name, mobile: p.mobile, addedBy: myName(), addedAt: ts() });
                } else if (rm) {
                    const k = rm.getAttribute('data-rm');
                    const e2 = (printers || {})[k] || {};
                    if (!confirm('Remove ' + (e2.name || 'this person') + ' from "Who can print ESN"?')) return;
                    await mainDb().ref(SET_PATH + '/' + k).remove();
                } else return;
                await loadPrinters(true);
                paintSettingsCard();
                q.value = '';
                paintCur(); paintAdd();
            } catch (err) { W.err('Not saved: ' + ((err && err.message) || err)); }
        });
        const [list] = await Promise.all([approvers(), loadPrinters(true)]);
        people = list;
        people.forEach((p) => { byKey[p.key] = p; });
        paintCur();
        setTimeout(() => q.focus(), 30);
        return W.closed;
    }

    // ------------------------------------------------------------------
    // Active Task rows (called by js/app-active-tasks.js)
    // ------------------------------------------------------------------
    function isSrvStep(task) { return SRV_STEPS.indexOf(norm(task && (task.status || task.remarks))) !== -1; }
    function approvalBtnHtml(task) {
        if (!task || task.source !== 'invoice' || !isSrvStep(task)) return '';
        return '<button type="button" class="iba-esn-approval-btn wd-row-action wd-action-process" data-key="' + esc(task.key) + '" title="SRV done and send to your engineer for approval"><i class="fa-solid fa-user-check"></i> Approval</button>';
    }
    // full action cell for the site-approval steps; '' = the normal buttons
    function rowActionsHtml(task) {
        if (!task || task.source !== 'invoice' || task.approvalFlow !== 'site') return '';
        const st = norm(task.status || task.remarks);
        const k = esc(task.key);
        if (st === 'approved' && task.approvalReturnOpen === true && task.esnState === 'approved' && namedForMe(task.attention)) {
            const can = task.esnPrintBlocked ? false : meAllowedSync();
            let h = '';
            if (can !== false) h += '<button type="button" class="iba-esn-print-btn wd-row-action wd-action-gold" data-key="' + k + '" title="Print the engineer\'s ESN"><i class="fa-solid fa-print"></i> Print ESN</button>';
            if (task.esnPrintedAt || can === false) h += '<button type="button" class="iba-esn-ready-btn wd-row-action wd-action-srv" data-key="' + k + '" title="Hand it to ' + esc(superName()) + '"><i class="fa-solid fa-flag-checkered"></i> Ready</button>';
            else h += '<button type="button" class="iba-esn-ready-btn wd-row-action is-locked" data-key="' + k + '" disabled title="Print the ESN first"><i class="fa-solid fa-flag-checkered"></i> Ready</button>';
            return h;
        }
        if (st === 'rejected' && task.approvalReturnOpen === true && namedForMe(task.attention)) {
            return '<button class="srv-done-btn wd-row-action wd-action-srv" data-key="' + k + '">SRV Done</button>' +
                '<button type="button" class="iba-esn-approval-btn wd-row-action wd-action-process" data-key="' + k + '"><i class="fa-solid fa-user-check"></i> Approval</button>' +
                '<button type="button" class="iba-apv-process-btn wd-row-action wd-action-process" data-key="' + k + '">Process</button>';
        }
        if (st === 'ready' && isSuper()) {
            return '<button class="modify-btn wd-row-action wd-action-process" data-key="' + k + '">Process</button>' +
                '<button type="button" class="iba-esn-extra-btn wd-row-action wd-action-gold" data-key="' + k + '" title="Send back, print ESN, history"><i class="fa-solid fa-ellipsis"></i> Extra</button>';
        }
        return '';
    }
    function repaintRows() {
        document.querySelectorAll('#wd-activetask tr[data-key]').forEach((tr) => {
            const t = findTask(tr.getAttribute('data-key'));
            if (!t || t.approvalFlow !== 'site') return;
            const html = rowActionsHtml(t);
            const cell = tr.lastElementChild;
            if (html && cell) cell.innerHTML = html;
        });
    }

    // Now brief rows (js/iba-assistant.js taskActs / act)
    function briefActs(t) {
        const task = findTask(t && t.key);
        if (!task || task.source !== 'invoice') return null;
        const st = norm(task.status || task.remarks);
        if (isSrvStep(task)) {
            const out = [];
            if (typeof handleSRVDone === 'function') out.push(['srv', 'SRV Done', 'fa-circle-check']);
            out.push(['esn-approval', 'Approval', 'fa-user-check']);
            if (typeof openModifyTaskModal === 'function') out.push(['process', 'Process', 'fa-pen-to-square']);
            return out;
        }
        if (task.approvalFlow !== 'site') return null;
        if (st === 'approved' && task.esnState === 'approved' && task.approvalReturnOpen === true && namedForMe(task.attention)) {
            const can = task.esnPrintBlocked ? false : meAllowedSync();
            const out = [];
            if (can !== false) out.push(['esn-print', 'Print ESN', 'fa-print']);
            if (task.esnPrintedAt || can === false) out.push(['esn-ready', 'Ready', 'fa-flag-checkered']);
            return out;
        }
        if (st === 'rejected' && task.approvalReturnOpen === true) return [['srv', 'SRV Done', 'fa-circle-check'], ['esn-approval', 'Approval', 'fa-user-check'], ['process', 'Process', 'fa-pen-to-square']];
        if (st === 'ready' && isSuper()) return [['process', 'Process', 'fa-pen-to-square'], ['esn-extra', 'Extra', 'fa-ellipsis']];
        return null;
    }
    function briefHandles(act) { return /^esn-/.test(String(act || '')); }
    function briefAct(act, task) {
        if (act === 'esn-approval') return openApproval(task);
        if (act === 'esn-print') return printForTask(task);
        if (act === 'esn-ready') return ready(task);
        if (act === 'esn-extra') return extra(task);
        return Promise.resolve();
    }

    // ------------------------------------------------------------------
    // wiring
    // ------------------------------------------------------------------
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        const b = t.closest('.iba-esn-approval-btn, .iba-esn-print-btn, .iba-esn-ready-btn, .iba-esn-extra-btn');
        if (!b || b.disabled) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const task = findTask(b.getAttribute('data-key'));
        const run = b.classList.contains('iba-esn-approval-btn') ? openApproval
            : b.classList.contains('iba-esn-print-btn') ? printForTask
            : b.classList.contains('iba-esn-ready-btn') ? ready : extra;
        Promise.resolve(run(task)).catch((err) => { console.error('[esn]', err); toast((err && err.message) || 'Something went wrong. Please try again.', 'error'); });
    }, true);

    function wrapPrint() {
        if (typeof window.handlePrintSticker !== 'function' || window.handlePrintSticker.__ibaEsn) return !!origPrint;
        origPrint = window.handlePrintSticker;
        guardedPrint.__ibaEsn = true;
        window.handlePrintSticker = guardedPrint;
        return true;
    }
    if (!wrapPrint()) {
        let n = 0;
        const t = setInterval(() => { if (wrapPrint() || ++n > 60) clearInterval(t); }, 500);
    }
    // the settings list once after sign-in (a few bytes), then the rows repaint
    (function waitUser(n) {
        if (user() && user().Name) { loadPrinters().then(repaintRows); return; }
        if (n < 240) setTimeout(() => waitUser(n + 1), 500);
    })(0);

    // 17.0.2 patch 16: the same list from Settings (Super Admin card)
    async function paintSettingsCard() {
        const sec = $('settings-form') || $('wd-settings');
        if (!sec) return;
        let card = $('iba-esn-settings-card');
        if (!isSuper()) { if (card) card.remove(); return; }
        if (!card) {
            card = document.createElement('div');
            card.id = 'iba-esn-settings-card';
            card.className = 'settings-card';
            card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-stamp"></i></div><div>' +
                '<h2>Who can print ESN</h2><p>Super Admin only. People on this list print the ESN of invoices their engineer approved (site Approval) and then press Ready.</p></div></div>' +
                '<p class="iba-esn-card-sum">Loading…</p>' +
                '<div class="settings-action-row"><button class="primary-btn" type="button" data-esn-open-list><i class="fa-solid fa-user-pen"></i> Open the list</button></div>';
            const before = $('iba-shell-bg-settings') || $('iba-login-opening-settings');
            const actions = sec.querySelector('.main-settings-actions');
            if (before && before.parentElement) before.parentElement.insertBefore(card, before);
            else if (actions && actions.parentElement) actions.parentElement.insertBefore(card, actions);
            else sec.appendChild(card);
            card.addEventListener('click', (e) => { if (e.target.closest('[data-esn-open-list]')) { e.preventDefault(); openSettings(); } });
        }
        const sum = card.querySelector('.iba-esn-card-sum');
        const list = await loadPrinters();
        const people = await approvers();
        const byKey = {};
        people.forEach((p) => { byKey[p.key] = p; });
        const keys = Object.keys(list || {});
        const bad = keys.filter((k) => { const p = byKey[k]; return !matches(list[k], p ? { Name: p.name, Mobile: p.mobile } : null); });
        sum.innerHTML = !keys.length ? 'Nobody yet: only <b>' + esc(superName()) + '</b> prints ESN.'
            : '<b>' + keys.length + '</b> ' + (keys.length === 1 ? 'person' : 'people') + ': ' + keys.map((k) => esc((byKey[k] && byKey[k].name) || list[k].name)).join(', ') +
              (bad.length ? ' · <span class="iba-esn-card-bad">' + bad.length + ' with changed details (printing off)</span>' : '');
    }
    // paint the card whenever Settings opens
    (function watchSettings() {
        const sec = $('wd-settings');
        if (!sec) { setTimeout(watchSettings, 1000); return; }
        let was = false;
        new MutationObserver(() => {
            const open = !sec.classList.contains('hidden');
            if (open && !was) paintSettingsCard();
            was = open;
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (!sec.classList.contains('hidden')) paintSettingsCard();
    })();

    window.ibaEsnPrinters = openSettings;
    window.ibaEsnFlow = {
        VERSION, returnTo, allowedSync, allowedFresh, loadPrinters, meAllowed,
        openApproval, sendForApproval, printWindow, printForTask, ready, extra, sendBack, openSettings,
        approvalBtnHtml, rowActionsHtml, choose, basketPages, printPages, placeName, stampWhen, addTimes, repaintRows, paintSettingsCard, briefActs, briefHandles, briefAct, stickerA, printStickers
    };
    console.info('%cIBA ESN flow ' + VERSION + ' loaded', 'color:#138A97;font-weight:700');
})();
