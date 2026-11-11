/* 17.0.5 patch 209 (martin): Super Admin "Fix transfer".
   Open any Transfer / Restock / Return / Usage by its Control ID and correct who and where,
   without signing in to the other person's account:
   - before stock moves (Pending / Pending Source / Pending Admin / Pending Confirmation):
     source contact, approver, receiver, from site (per line) and to site
   - Approved / In Transit (stock already left the source): receiver and to site only
   - Completed / Received / Rejected: read only
   The waiting person (attention) follows the change, so the job moves to the right Active Job.
   Every changed line gets a history row "Corrected by Super Admin" with old -> new.
   Reads only the lines of that Control ID (no full download).
   Opens from: Work History row/group button (wrench), Material Stock > More tools, window.ibaTrFix.open('TRF-1125'). */
(function () {
    'use strict';
    if (window.ibaTrFix) return;
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function isSuper() { try { return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
    function me() { try { return (currentApprover && currentApprover.Name) || 'Super Admin'; } catch (_) { return 'Super Admin'; } }
    function db() {
        try { if (typeof inventoryDb !== 'undefined' && inventoryDb && inventoryDb.ref) return inventoryDb; } catch (_) {}
        try { if (typeof getInventoryDatabase === 'function') return getInventoryDatabase(); } catch (_) {}
        return null;
    }
    const EARLY = ['pending', 'pending source', 'pending admin', 'pending confirmation'];
    const MOVING = ['approved', 'in transit'];
    function stepOf(e) { return String((e && (e.remarks || e.status)) || '').trim(); }
    function level(e) {
        const s = stepOf(e).toLowerCase();
        if (EARLY.includes(s)) return 2;           // everything can change
        if (MOVING.includes(s)) return 1;          // receiver + to site only
        return 0;                                  // finished: read only
    }

    // ---- lists ------------------------------------------------------------------------
    function store(ch) { try { return (ch && ch._store && ch._store.getState().choices) || (ch && ch.config && ch.config.choices) || []; } catch (_) { return []; } }
    function sites() {
        let sc = [];
        try { sc = store(typeof tfToSiteChoices !== 'undefined' ? tfToSiteChoices : null); } catch (_) {}
        let out = sc.filter((c) => c && c.value && !c.placeholder).map((c) => ({ value: String(c.value), label: String(c.label || c.value) }));
        if (!out.length) {
            const sel = $('tf-to') || $('tf-from');
            if (sel) out = Array.from(sel.options).filter((o) => o.value).map((o) => ({ value: o.value, label: o.textContent || o.value }));
        }
        return out;
    }
    function people() {
        const users = (typeof allApproverData !== 'undefined' && allApproverData) ? Object.values(allApproverData) : [];
        return users.filter((u) => u && u.Name).map((u) => ({ value: u.Name, label: u.Name + (u.Position ? ' - ' + u.Position : '') + (u.Site ? ' · ' + u.Site : '') }))
            .sort((a, b) => a.value.localeCompare(b.value));
    }
    async function approvers() {
        try { if (window.ibaInvPerm && typeof window.ibaInvPerm.deliveryApprovers === 'function') { const l = await window.ibaInvPerm.deliveryApprovers(); if (Array.isArray(l) && l.length) return l.map((u) => ({ value: u.Name, label: u.Name + (u.Position ? ' - ' + u.Position : '') })); } } catch (_) {}
        const users = (typeof allApproverData !== 'undefined' && allApproverData) ? Object.values(allApproverData) : [];
        return users.filter((u) => u && u.Name && String(u.Role || '').toLowerCase() === 'admin').map((u) => ({ value: u.Name, label: u.Name + (u.Position ? ' - ' + u.Position : '') }));
    }
    function selectHtml(name, list, cur, off, extra) {
        const has = list.some((o) => o.value === cur);
        const opts = (cur && !has ? [{ value: cur, label: cur + ' (now)' }] : []).concat(list);
        return '<select data-tf="' + name + '"' + (extra || '') + (off ? ' disabled' : '') + '>' + (cur ? '' : '<option value="">- pick -</option>') +
            opts.map((o) => '<option value="' + esc(o.value) + '"' + (o.value === cur ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
    }

    // ---- read one Control ID ----------------------------------------------------------
    async function load(cid) {
        const d = db(); if (!d) throw new Error('Inventory database not ready');
        const ref = d.ref('transfer_entries');
        let v = null;
        for (const f of ['controlNumber', 'controlId', 'ref']) {
            const s = await ref.orderByChild(f).equalTo(cid).once('value');
            if (s.exists()) { v = s.val(); break; }
        }
        return Object.entries(v || {}).map(([key, e]) => Object.assign({ key }, e))
            .sort((a, b) => (Number(a.batchIndex) || 0) - (Number(b.batchIndex) || 0));
    }

    // ---- window -----------------------------------------------------------------------
    let LINES = [], CID = '';
    function layer(html) {
        const old = $('iba-trfix'); if (old) old.remove();
        const w = document.createElement('div');
        w.id = 'iba-trfix'; w.className = 'iba-pb-layer';
        w.innerHTML = '<div class="iba-pb-box iba-tx-box" role="dialog" aria-modal="true" aria-label="Fix transfer">' + html + '</div>';
        document.body.appendChild(w);
        w.addEventListener('click', onClick);
        w.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
            if (e.key === 'Enter' && e.target && e.target.id === 'iba-tx-cid') { e.preventDefault(); find(); }
        });
        return w;
    }
    function close() { const w = $('iba-trfix'); if (w) w.remove(); }
    const head = '<div class="iba-pb-head"><b><i class="fa-solid fa-screwdriver-wrench"></i> Fix transfer</b><button type="button" class="iba-tx-x" data-tx-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>';
    function searchBar(v) {
        return '<div class="iba-tx-find"><input id="iba-tx-cid" type="text" autocomplete="off" placeholder="Control ID, e.g. TRF-1125" value="' + esc(v || '') + '"><button type="button" class="iba-tx-btn" data-tx-find><i class="fa-solid fa-magnifying-glass"></i> Open</button></div>';
    }

    async function open(cid) {
        if (!isSuper()) { alert('Only the Super Admin can fix a transfer.'); return; }
        const w = layer(head + '<div class="iba-pb-sub"><p>Correct the people or sites on a transfer without signing in to their account. Every change is written in the history.</p>' + searchBar(cid) + '<div class="iba-tx-body"></div></div>');
        const inp = w.querySelector('#iba-tx-cid');
        if (cid) find(); else setTimeout(() => inp && inp.focus(), 30);
    }
    async function find() {
        const w = $('iba-trfix'); if (!w) return;
        const body = w.querySelector('.iba-tx-body');
        const cid = String((w.querySelector('#iba-tx-cid') || {}).value || '').trim().toUpperCase();
        if (!cid) { body.innerHTML = '<p class="iba-tx-bad">Type a Control ID.</p>'; return; }
        body.innerHTML = '<p><i class="fa-solid fa-circle-notch fa-spin"></i> Opening ' + esc(cid) + '…</p>';
        try { LINES = await load(cid); } catch (e) { body.innerHTML = '<p class="iba-tx-bad">Could not read it: ' + esc(e.message || e) + '</p>'; return; }
        CID = cid;
        if (!LINES.length) { body.innerHTML = '<p class="iba-tx-bad">No transfer found with Control ID ' + esc(cid) + '.</p>'; return; }
        await draw();
    }
    async function draw() {
        const w = $('iba-trfix'); if (!w) return;
        const body = w.querySelector('.iba-tx-body');
        const L = LINES, first = L[0];
        const lv = Math.min.apply(null, L.map(level));
        const type = String(first.for || first.jobType || 'Transfer');
        const S = sites(), P = people(), A = await approvers();
        const steps = Array.from(new Set(L.map(stepOf))).join(', ');
        const note = lv === 2 ? 'Stock has not moved yet: you can change the people and the sites.'
            : lv === 1 ? 'Stock already left the source: only the receiver and the To site can change.'
            : 'This one is finished: nothing can be changed here.';
        const isTr = type === 'Transfer';
        const row = (label, html) => '<div class="iba-tx-f"><label>' + label + '</label>' + html + '</div>';
        let h = '<div class="iba-tx-top"><div><b class="iba-tx-cid">' + esc(CID) + '</b> <span class="iba-tx-pill">' + esc(type) + '</span> <span class="iba-tx-pill is-step">' + esc(steps) + '</span></div>' +
            '<small>Made by ' + esc(first.requestor || first.enteredBy || '-') + ' · ' + L.length + ' line' + (L.length === 1 ? '' : 's') + '</small></div>' +
            '<p class="iba-tx-note' + (lv ? '' : ' iba-tx-bad') + '">' + note + '</p><div class="iba-tx-grid">';
        if (isTr) h += row('Source contact <em>(confirms at the source)</em>', selectHtml('sourceContact', P, first.sourceContact || '', lv < 2));
        h += row('Approver', selectHtml('approver', A.length ? A : P, first.approver || '', lv < 2));
        if (type === 'Transfer' || type === 'Restock') h += row('Receiver', selectHtml('receiver', P, first.receiver || '', lv < 1));
        if (type !== 'Usage') h += row('To site', selectHtml('toSite', S, first.toSite || first.toLocation || '', lv < 1));
        h += '</div>';
        if (type !== 'Restock') {
            h += '<div class="iba-tx-lines"><table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th>From site</th><th>Step</th></tr></thead><tbody>' +
                L.map((e, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + esc(e.productName || '') + '</b><small>' + esc(e.productID || e.productId || '') + '</small></td><td class="r">' + esc(e.orderedQty || e.requiredQty || '') + '</td><td>' +
                    selectHtml('fromSite', S, e.fromSite || e.fromLocation || '', level(e) < 2, ' data-line="' + i + '"') + '</td><td>' + esc(stepOf(e)) + '</td></tr>').join('') +
                '</tbody></table></div>';
        }
        h += '<div class="iba-tx-bar"><span class="iba-tx-msg"></span><span><button type="button" class="iba-tx-btn" data-tx-x>Close</button> ' +
            (lv ? '<button type="button" class="iba-tx-btn is-go" data-tx-save><i class="fa-solid fa-floppy-disk"></i> Save changes</button>' : '') + '</span></div>';
        body.innerHTML = h;
    }

    function attentionFor(e, nv) {
        const s = stepOf(e).toLowerCase();
        if (s === 'pending source') return nv.sourceContact;
        if (s === 'pending admin' || s === 'pending') return nv.approver;
        if (s === 'approved' || s === 'in transit') return nv.receiver;
        return null;   // Pending Confirmation: the requester keeps it
    }
    async function save() {
        const w = $('iba-trfix'); if (!w || !LINES.length) return;
        const msg = w.querySelector('.iba-tx-msg');
        const val = (n) => { const s = w.querySelector('select[data-tf="' + n + '"]:not([data-line])'); return s && !s.disabled ? s.value : null; };
        const top = { sourceContact: val('sourceContact'), approver: val('approver'), receiver: val('receiver'), toSite: val('toSite') };
        const fromSel = Array.from(w.querySelectorAll('select[data-tf="fromSite"][data-line]'));
        const LABEL = { sourceContact: 'Source contact', approver: 'Approver', receiver: 'Receiver', toSite: 'To site', fromSite: 'From site' };
        const plan = [];
        LINES.forEach((e, i) => {
            const up = {}, chg = [];
            Object.keys(top).forEach((k) => {
                const nv = top[k]; if (nv == null || !nv) return;
                const ov = String((k === 'toSite' ? (e.toSite || e.toLocation) : e[k]) || '');
                if (nv !== ov) { up[k] = nv; if (k === 'toSite') up.toLocation = nv; chg.push(LABEL[k] + ': ' + (ov || '-') + ' -> ' + nv); }
            });
            const fs = fromSel.find((s) => Number(s.getAttribute('data-line')) === i);
            if (fs && !fs.disabled && fs.value) {
                const ov = String(e.fromSite || e.fromLocation || '');
                if (fs.value !== ov) { up.fromSite = fs.value; up.fromLocation = fs.value; chg.push(LABEL.fromSite + ': ' + (ov || '-') + ' -> ' + fs.value); }
            }
            if (up.sourceContact && String(e.contactName || '') === String(e.sourceContact || '')) up.contactName = up.sourceContact;
            const nv = { sourceContact: up.sourceContact || e.sourceContact, approver: up.approver || e.approver, receiver: up.receiver || e.receiver };
            const att = attentionFor(e, nv);
            if (att && att !== e.attention && chg.length) up.attention = att;
            if (chg.length) plan.push({ e, up, chg });
        });
        if (!plan.length) { msg.textContent = 'Nothing changed.'; return; }
        const btn = w.querySelector('[data-tx-save]');
        if (!btn.dataset.sure) {
            btn.dataset.sure = '1';
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Yes, save ' + plan.length + ' line' + (plan.length === 1 ? '' : 's');
            msg.innerHTML = esc(Array.from(new Set(plan.flatMap((p) => p.chg))).join(' · '));
            return;
        }
        btn.disabled = true; msg.textContent = 'Saving…';
        const d = db();
        try {
            for (const p of plan) {
                const hk = d.ref('transfer_entries/' + p.e.key + '/history').push().key;
                const upd = Object.assign({}, p.up, { lastUpdated: firebase.database.ServerValue.TIMESTAMP });
                upd['history/' + hk] = { action: 'Corrected by Super Admin', by: me(), timestamp: Date.now(), status: p.e.status || '', remarks: p.e.remarks || '', note: p.chg.join('; ') };
                await d.ref('transfer_entries/' + p.e.key).update(upd);
                try { if (typeof applyTransferUpdateToLocalCaches === 'function') applyTransferUpdateToLocalCaches(p.e.key, p.up); } catch (_) {}
                Object.assign(p.e, p.up);
            }
        } catch (e) { btn.disabled = false; msg.innerHTML = '<span class="iba-tx-bad">Not saved: ' + esc(e.message || e) + '</span>'; return; }
        msg.innerHTML = '<span class="iba-tx-ok"><i class="fa-solid fa-check"></i> Saved. ' + esc(CID) + ' now waits for the right person.</span>';
        try { if (typeof filterAndRenderInventoryJobRecords === 'function' && $('wd-reporting') && $('wd-reporting').offsetParent) filterAndRenderInventoryJobRecords(); } catch (_) {}
        try { if (typeof populateActiveTasks === 'function' && $('inv-active-job') && $('inv-active-job').offsetParent) populateActiveTasks(); } catch (_) {}
        setTimeout(draw, 1200);
    }
    function onClick(e) {
        const t = e.target;
        if (t === e.currentTarget) return;   // a click beside the window does nothing
        if (t.closest('[data-tx-x]')) { close(); return; }
        if (t.closest('[data-tx-find]')) { find(); return; }
        if (t.closest('[data-tx-save]')) { save(); return; }
    }
    // any change resets the "Yes, save" step
    document.addEventListener('change', (e) => {
        if (!e.target.closest || !e.target.closest('#iba-trfix')) return;
        const b = document.querySelector('#iba-trfix [data-tx-save]');
        if (b && b.dataset.sure) { delete b.dataset.sure; b.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save changes'; const m = document.querySelector('#iba-trfix .iba-tx-msg'); if (m) m.textContent = ''; }
    }, true);

    // ---- entry points -----------------------------------------------------------------
    // 1) Work History: a wrench next to each single row / multi group (Super Admin only)
    function rowButtons() {
        if (!isSuper()) return;
        const body = $('reporting-table-body'); if (!body || !body.classList.contains('inv-job-records-body')) return;
        body.querySelectorAll('tr.inv-job-single-row, tr.inv-job-group-row').forEach((tr) => {
            if (tr.querySelector('[data-tx-open]')) return;
            const idEl = tr.querySelector('.inv-control-id-text'); if (!idEl) return;
            const cid = idEl.textContent.trim(); if (!cid || /^\(/.test(cid)) return;
            const cell = tr.querySelector('.inv-row-actions') || tr.querySelector('.inv-group-actions-cell'); if (!cell) return;
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'iba-tx-rowbtn'; b.title = 'Fix transfer (Super Admin)';
            b.setAttribute('data-tx-open', cid); b.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i>';
            cell.insertBefore(b, cell.firstChild);
        });
    }
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-tx-open]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        open(b.getAttribute('data-tx-open'));
    }, true);
    // 2) Material Stock > More tools (the menu picks it up by id)
    function menuBtn() {
        if ($('iba-trfix-btn')) return;
        const near = $('ms-merge-undo-btn'); if (!near) return;
        const b = document.createElement('button');
        b.id = 'iba-trfix-btn'; b.type = 'button'; b.className = 'secondary-btn';
        b.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i> Fix transfer';
        b.addEventListener('click', () => open(''));
        near.parentElement.appendChild(b);
        if (!isSuper()) b.style.setProperty('display', 'none', 'important');
    }
    function tick() { try { rowButtons(); } catch (_) {} try { menuBtn(); const b = $('iba-trfix-btn'); if (b) { if (isSuper()) b.style.removeProperty('display'); else b.style.setProperty('display', 'none', 'important'); } } catch (_) {} }
    function start() {
        tick();
        const body = $('reporting-table-body');
        if (body) new MutationObserver(() => setTimeout(tick, 0)).observe(body, { childList: true });
        setInterval(tick, 2000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaTrFix = { open };
})();
