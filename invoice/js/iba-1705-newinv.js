/* ==========================================================================
   js/iba-1705-newinv.js — 17.0.5 patch 117
   "New invoice" (martin approved mock-up, Nov 2026). WorkDesk Add New Job
   with Job type = Invoice becomes a guided window in 4 steps:
     1 PO (Site, Vendor, Vendor ID filled from the PO list, PO value shown)
     2 Invoice (invoice no. = Reference, invoice date, amount; warns when that
       invoice no. is already on the PO)
     3 Attachment
     4 Send to (Group, Attention, note). Status stays Pending (hidden).
   A kicker shows "Step N of 4", the next empty box glows, Save invoice works
   once the must-fill boxes are filled.
   Existing boxes are MOVED, never rebuilt: every id, Choices drop-down, the
   vendor name <-> vendor ID suggestions and the Add routine stay as they are.
   Other job types and Edit keep the normal form.
   Side menu "+ New Invoice" and the assistant skill "Add new invoice" open
   the window straight in this mode (window.ibaNewInvoice(po)).
   Downloads: only invoice_entries/<PO> of the typed PO (duplicate check).
   ========================================================================== */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
    const normInv = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '');
    // 17.0.5 patch 123: two guided windows. inv = New invoice (Reception),
    // req = New requisition (Procurement, job type PR, no PO yet)
    const CFG = {
        inv: { type: 'Invoice', title: 'New invoice', save: 'Save invoice', done: 'Everything needed is filled. The note is optional.',
            steps: [
                { n: 1, name: 'PO', head: 'PO', help: 'Type the PO number. Site and vendor fill in by themselves.' },
                { n: 2, name: 'Invoice details', head: 'Invoice', help: 'Type the invoice number, date and amount from the paper.' },
                { n: 3, name: 'Attachment', head: 'Attachment', help: 'Optional: the file name with .pdf (file in SharePoint Attachments) or the SharePoint link.' },
                { n: 4, name: 'Send to', head: 'Send to', help: 'Pick the group and add a short note. It goes to Irwin automatically.' }],
            // (Attention is not asked: invoice jobs go to Irwin automatically)
            need: { 1: ['job-po', 'job-site', 'job-vendor-name'], 2: ['job-ref', 'job-invoice-date', 'job-amount'], 3: [], 4: ['job-group'] },
            label: { 'job-po': 'PO number', 'job-site': 'Site', 'job-vendor-name': 'Vendor', 'job-ref': 'Invoice no.', 'job-invoice-date': 'Invoice date', 'job-amount': 'Amount', 'job-group': 'Group' } },
        req: { type: 'PR', title: 'New requisition', save: 'Save requisition', done: 'Everything needed is filled. Value, vendor and note are optional.',
            steps: [
                { n: 1, name: 'Requisition', head: 'Requisition', help: 'Type the requisition number and pick the site. No PO yet.' },
                { n: 2, name: 'Vendor', head: 'Vendor', help: 'Optional: type the vendor ID or search the vendor name.' },
                { n: 3, name: 'Attachment', head: 'Attachment', help: 'The requisition PDF: file name with .pdf (in SharePoint Attachments) or the SharePoint link.' },
                { n: 4, name: 'Send to', head: 'Send to', help: 'Pick who it goes to (Procurement is on top) and add a short note.' }],
            need: { 1: ['job-ref', 'job-site'], 2: [], 3: [], 4: ['job-attention'] },
            label: { 'job-ref': 'Requisition no.', 'job-site': 'Site', 'job-attention': 'Attention' } }
    };
    const st = { on: false, mode: '', moved: [], saved: {}, po: '', poInfo: null, invs: null, invsPo: '', reading: '', again: 0, againMode: '', want: '' };
    function C() { return CFG[st.mode] || CFG.inv; }

    function modal() { return $('standard-job-modal'); }
    function isOpen() { const m = modal(); return !!(m && !m.classList.contains('hidden') && m.getClientRects().length > 0); }
    function addMode() { const a = $('add-job-button'), u = $('update-job-button'); return !!(a && !a.classList.contains('hidden') && (!u || u.classList.contains('hidden'))); }
    function isInvoice() { const f = $('job-for'); return !!(f && f.value === 'Invoice'); }
    function modeOfForm() { const f = $('job-for'); const v = f ? f.value : ''; return v === 'Invoice' ? 'inv' : v === 'PR' ? 'req' : ''; }
    function onPhone() { const b = document.body; return !!(b && (b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone'))); }
    function val(id) { const el = $(id); return el ? String(el.value || '').trim() : ''; }
    function grp(id) { const el = $(id); return el ? el.closest('.form-group') : null; }
    function cleanPO(v) { const p = String(v == null ? '' : v).trim().toUpperCase().replace(/^PO[\s#:-]*/i, ''); return /^[A-Z0-9_-]{1,30}$/.test(p) ? p : ''; }
    function money(v) { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) && n ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
    function isSuper() { try { return !!(document.body.classList.contains('iba-is-super-admin') || (typeof currentApprover !== 'undefined' && currentApprover && /super/i.test(String(currentApprover.Role || '')))); } catch (_) { return false; } }

    // ---- turn on / off ------------------------------------------------------
    function move(el, box) {
        if (!el || !box) return;
        const mark = document.createComment('iba-ni');
        el.parentNode.insertBefore(mark, el);
        st.moved.push({ el: el, mark: mark });
        box.appendChild(el);
    }
    function on(mode) {
        if (st.on) return;
        st.mode = mode === 'req' ? 'req' : 'inv';
        const S = C().steps;
        const m = modal(), form = $('jobentry-form');
        const grid = form && form.querySelector('.transfer-2col-grid');
        if (!m || !grid) return;
        st.on = true;
        const wrap = document.createElement('div');
        wrap.id = 'iba-ni';
        wrap.innerHTML = '<div class="iba-ni-kick"><b id="iba-ni-step"></b><span id="iba-ni-help"></span><span class="iba-ni-bar" id="iba-ni-bar">' +
            S.map((s) => '<i data-ni-bar="' + s.n + '"></i>').join('') + '</span><button type="button" class="iba-ni-other" data-ni-other title="Use the normal form for another job type">Other job type</button></div>' +
            '<div class="iba-ni-steps">' + S.map((s) => '<section class="iba-ni-st" data-ni-st="' + s.n + '"><div class="iba-ni-sh"><span class="iba-ni-num">' + s.n + '</span><b>' +
                esc(s.head) + '</b><small data-ni-tag="' + s.n + '"></small></div><div class="iba-ni-body" data-ni-body="' + s.n + '"></div>' +
                '<div class="iba-ni-hint" data-ni-hint="' + s.n + '"></div></section>').join('') + '</div>';
        grid.parentNode.insertBefore(wrap, grid);
        const body = (n) => wrap.querySelector('[data-ni-body="' + n + '"]');
        if (st.mode === 'inv') {
            // step 1: PO, Site, Vendor, Vendor ID
            move(grp('job-po'), body(1));
            const row1 = document.createElement('div'); row1.className = 'iba-ni-row'; body(1).appendChild(row1);
            move(grp('job-site'), row1);
            const pv = document.createElement('div'); pv.className = 'form-group iba-ni-pov'; pv.innerHTML = '<label>PO value</label><div class="iba-ni-ro" id="iba-ni-povalue">—</div>';
            row1.appendChild(pv); st.moved.push({ el: pv, mark: null });
            const row2 = document.createElement('div'); row2.className = 'iba-ni-row'; body(1).appendChild(row2);
            move(grp('job-vendor-name'), row2);
            move(grp('job-vendor-id'), row2);
            // step 2: invoice no., date, amount
            move(grp('job-ref'), body(2));
            const row3 = document.createElement('div'); row3.className = 'iba-ni-row'; body(2).appendChild(row3);
            move(grp('job-invoice-date'), row3);
            move(grp('job-amount'), row3);
            // step 3: attachment
            move(grp('job-attachment'), body(3));
            // step 4: group, attention, note
            const row4 = document.createElement('div'); row4.className = 'iba-ni-row'; body(4).appendChild(row4);
            move($('job-group-container'), row4);
            // 17.0.5 patch 120: invoice jobs always go to Irwin (or his vacation
            // replacement) by the app itself, so no Attention picker here
            const to = document.createElement('div'); to.className = 'form-group iba-ni-pov'; to.innerHTML = '<label>Goes to</label><div class="iba-ni-ro" id="iba-ni-goes"></div>';
            row4.appendChild(to); st.moved.push({ el: to, mark: null });
            move(grp('job-current-note'), body(4));
            // labels and title
            const relabel = (sel, text) => { const l = document.querySelector(sel); if (l) { st.saved[sel] = l.innerHTML; l.textContent = text; } };
            relabel('label[for="job-ref"]', 'Invoice no.');
            relabel('label[for="job-amount"]', 'Amount (QAR)');
            relabel('label[for="job-vendor-name"]', 'Vendor');
            relabel('#standard-modal-title', 'New invoice');
        } else {
            // New requisition: requisition no. (Reference), Site, Value | Vendor | Attachment | Attention, note
            move(grp('job-ref'), body(1));
            const r1 = document.createElement('div'); r1.className = 'iba-ni-row'; body(1).appendChild(r1);
            move(grp('job-site'), r1);
            move(grp('job-amount'), r1);
            const r2 = document.createElement('div'); r2.className = 'iba-ni-row'; body(2).appendChild(r2);
            move(grp('job-vendor-name'), r2);
            move(grp('job-vendor-id'), r2);
            move(grp('job-attachment'), body(3));
            move(grp('job-attention'), body(4));
            move(grp('job-current-note'), body(4));
            const relabel = (sel, text) => { const l = document.querySelector(sel); if (l) { st.saved[sel] = l.innerHTML; l.textContent = text; } };
            relabel('label[for="job-ref"]', 'Requisition no.');
            relabel('label[for="job-amount"]', 'Value (QAR) · optional');
            relabel('label[for="job-vendor-name"]', 'Vendor');
            relabel('#standard-modal-title', 'New requisition');
            const rf = $('job-ref'); if (rf) { st.saved.refPh = rf.placeholder; rf.placeholder = 'e.g. 20418'; }
            loadVendors();
            groupAttention();
        }
        // 17.0.5 patch 123: sample for the attachment box. The app opens
        // SharePoint .../Documents/Attachments/ + this name, or the link itself
        // when it starts with http, so a name with .pdf or a full share link both work
        const at = $('job-attachment'); if (at) { st.saved.attPh = at.placeholder; at.placeholder = st.mode === 'inv' ? 'e.g. INV-50213.pdf or SharePoint link' : 'e.g. 20418.pdf or SharePoint link'; }
        const ref = $('job-ref'); if (ref && st.mode === 'inv') { st.saved.refPh = ref.placeholder; ref.placeholder = 'Type the invoice number…'; }
        ['job-po', 'job-ref', 'job-amount', 'job-vendor-name', 'job-vendor-id', 'job-attachment'].forEach((id) => { const el = $(id); if (el) el.setAttribute('autocomplete', 'off'); });
        const add = $('add-job-button'); if (add) { st.saved.add = add.innerHTML; add.innerHTML = '<i class="fa-solid fa-check"></i> ' + C().save; }
        const foot = m.querySelector('.modal-footer');
        if (foot && !$('iba-ni-next')) { const n = document.createElement('span'); n.id = 'iba-ni-next'; foot.insertBefore(n, foot.lastElementChild); }
        m.classList.add('iba-ni-on');
        m.classList.toggle('iba-ni-req', st.mode === 'req');
        // 17.0.5 patch 124: real pill (the add-job page CSS kills h2::after)
        const tt = $('standard-modal-title');
        if (tt && !tt.querySelector('.iba-ni-pill')) { const pl = document.createElement('span'); pl.className = 'iba-ni-pill' + (st.mode === 'req' ? ' is-req' : ''); pl.textContent = st.mode === 'req' ? 'Procurement' : 'Reception'; tt.appendChild(pl); }
        st.po = ''; st.poInfo = null;
        paint();
    }
    function off() {
        if (!st.on) return;
        st.on = false;
        st.moved.slice().reverse().forEach((x) => {
            if (x.mark && x.mark.parentNode) { x.mark.parentNode.insertBefore(x.el, x.mark); x.mark.remove(); }
            else if (!x.mark && x.el.parentNode) x.el.remove();
        });
        st.moved = [];
        Object.keys(st.saved).forEach((k) => {
            if (k === 'refPh') { const r = $('job-ref'); if (r) r.placeholder = st.saved[k]; }
            if (k === 'attPh') { const r = $('job-attachment'); if (r) r.placeholder = st.saved[k]; }
            else if (k === 'add') { const a = $('add-job-button'); if (a) a.innerHTML = st.saved[k]; }
            else { const l = document.querySelector(k); if (l) l.innerHTML = st.saved[k]; }
        });
        st.saved = {};
        const w = $('iba-ni'); if (w) w.remove();
        const n = $('iba-ni-next'); if (n) n.remove();
        document.querySelectorAll('.iba-ni-glow').forEach((e) => e.classList.remove('iba-ni-glow'));
        const m = modal(); if (m) m.classList.remove('iba-ni-on', 'iba-ni-ready', 'iba-ni-req');
        if (st.mode === 'req') ungroupAttention();
    }

    // ---- state ---------------------------------------------------------------
    function missing(n) { return C().need[n].filter((id) => !val(id)); }
    function firstOpen() { for (let n = 1; n <= 4; n++) if (missing(n).length) return n; return 0; }
    function glowTarget(id) {
        const el = $(id);
        if (!el) return null;
        const ch = el.closest('.choices');
        return ch || el;
    }
    function paint() {
        if (!st.on) return;
        const STEPS = C().steps;
        const goes = $('iba-ni-goes');
        if (goes && !goes.textContent) { let h = 'Irwin'; try { if (typeof getAccountingUser === 'function') h = getAccountingUser() || h; } catch (_) {} goes.textContent = h + ' (automatic)'; }
        const now = firstOpen();
        const cur = now || 4;
        STEPS.forEach((s) => {
            const sec = document.querySelector('[data-ni-st="' + s.n + '"]');
            if (!sec) return;
            const done = !missing(s.n).length && (s.n !== 3 || now === 0 || now > 3 || val('job-attachment'));
            sec.classList.toggle('is-done', done && s.n !== now);
            sec.classList.toggle('is-now', s.n === now);
            sec.classList.toggle('is-wait', !!now && s.n > now && !done);
            const tag = document.querySelector('[data-ni-tag="' + s.n + '"]');
            if (tag) tag.textContent = s.n === now ? 'now' : (done ? '✓' : (s.n === 3 ? 'optional' : ''));
            const bar = document.querySelector('[data-ni-bar="' + s.n + '"]');
            if (bar) { bar.className = s.n === now ? 'is-now' : (done ? 'is-on' : ''); }
        });
        const sEl = $('iba-ni-step'), hEl = $('iba-ni-help');
        if (sEl) sEl.textContent = now ? 'Step ' + now + ' of 4 · ' + STEPS[now - 1].name : 'Ready · check and save';
        if (hEl) hEl.textContent = now ? STEPS[now - 1].help : C().done;
        document.querySelectorAll('.iba-ni-glow').forEach((e) => e.classList.remove('iba-ni-glow'));
        const ae = document.activeElement;
        if (now) {
            const id = missing(now)[0];
            const t = glowTarget(id);
            if (t && !(ae && (ae === $(id) || t.contains(ae)))) t.classList.add('iba-ni-glow');
        }
        const left = [1, 2, 3, 4].reduce((a, n) => a + missing(n).length, 0);
        const nx = $('iba-ni-next');
        if (nx) nx.innerHTML = now ? 'Next: <b>' + esc(C().label[missing(now)[0]] || '') + '</b> · ' + left + ' box' + (left === 1 ? '' : 'es') + ' left' : '<b>Ready to save</b>';
        const m = modal(); if (m) m.classList.toggle('iba-ni-ready', !now);
        if (st.mode === 'inv') { poHint(); dupHint(); } else reqHints();
    }
    function setHint(n, html, cls) {
        const h = document.querySelector('[data-ni-hint="' + n + '"]');
        if (!h) return;
        if (h.__html !== html) { h.__html = html; h.innerHTML = html; }
        h.className = 'iba-ni-hint ' + (cls || '');
    }
    // 17.0.5 patch 127: requisition that already has a PO in POVALUE2.csv (ReqNum
    // column, kept in memory by the app: no download) -> show the PO, never save
    function reqPo(ref) {
        if (ref === undefined && st.mode !== 'req') return null;
        const r = String(ref === undefined ? (val('job-ref') || '') : ref).trim();
        if (!r) return null;
        let m = null;
        try { m = (typeof allPODataByRef !== 'undefined' && allPODataByRef) ? allPODataByRef : null; } catch (_) {}
        if (!m) return null;
        const hit = m[r] || m[r.toUpperCase()] || (/^\d+$/.test(r) ? m[String(parseInt(r, 10))] : null);
        if (!hit) return null;
        const f = (k) => { const x = Object.keys(hit).find((y) => y.toLowerCase().replace(/[\s:]/g, '') === k); return x ? String(hit[x] || '').trim() : ''; };
        const po = f('po') || f('ponumber');
        return po ? { po: po, vendor: f('suppliername'), site: f('projectid'), amount: f('amount') } : null;
    }
    // 17.0.5 patch 128: the assistant skill checks first, without the window
    window.ibaReqPo = async (ref) => {
        try { if ((typeof allPODataByRef === 'undefined' || !allPODataByRef) && typeof ensureInvoicePOBaseDataFetched === 'function') await ensureInvoicePOBaseDataFetched(false); } catch (_) {}
        return reqPo(String(ref == null ? '' : ref));
    };
    function reqHints() {
        const hit = reqPo();
        if (hit) {
            const amt = Number(String(hit.amount).replace(/,/g, ''));
            setHint(1, '<b>Requisition ' + esc(val('job-ref')) + ' already has PO ' + esc(hit.po) + '.</b> ' +
                [hit.vendor, hit.site ? 'Site ' + hit.site : '', amt ? 'QAR ' + amt.toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''].filter(Boolean).map(esc).join(' · ') +
                '<br>No need to add it again. <button type="button" class="iba-ni-trackpo" data-ni-trackpo="' + esc(hit.po) + '"><i class="fa-solid fa-magnifying-glass-location"></i> Track PO ' + esc(hit.po) + '</button>', 'is-bad');
            const nx = $('iba-ni-next'); if (nx) nx.innerHTML = '<b>PO ' + esc(hit.po) + ' already created</b> · nothing to save';
            const m = modal(); if (m) m.classList.remove('iba-ni-ready');
            setHint(2, '', ''); setHint(3, '', ''); setHint(4, '', '');
            return;
        }
        setHint(1, val('job-ref') ? 'No PO yet: the requisition number is the reference.' : '', 'is-good');
        setHint(2, 'Type the ID and the name fills in, or type part of the name and pick from the suggestions. Leave empty if not known yet.', '');
        setHint(3, val('job-attachment') ? '' : 'No file yet. You can still save, but the requisition PDF helps procurement.', 'is-warn');
        setHint(4, 'Status starts as Pending.', '');
    }

    // ---- New requisition: vendor list + Procurement on top of Attention -------------
    function loadVendors() {
        Promise.resolve().then(async () => {
            try { if (typeof ensureVendorsDataFetchedForJobEntry === 'function') await ensureVendorsDataFetchedForJobEntry(false); } catch (_) {}
            try { if (typeof buildJobVendorDatalistIfNeeded === 'function') buildJobVendorDatalistIfNeeded(); } catch (_) {}
            try { if (typeof ensureInvoicePOBaseDataFetched === 'function' && (typeof allPODataByRef === 'undefined' || !allPODataByRef)) { await ensureInvoicePOBaseDataFetched(false); paint(); } } catch (_) {}
        });
    }
    function attn() { try { return (typeof attentionSelectChoices !== 'undefined' && attentionSelectChoices) ? attentionSelectChoices : null; } catch (_) { return null; } }
    // 17.0.5 patch 125: martin's fixed Procurement list (no Position lookup)
    const PROC = ['cyril', 'awais', 'emad', 'hafiz'];
    function procRank(c) {
        const n = String((c && c.value) || '').trim().toLowerCase().split(/[\s.\-_]+/)[0];
        return PROC.indexOf(n);
    }
    function isProc(c) { return procRank(c) >= 0; }
    let grouping = 0;
    function groupAttention(tries) {
        const ch = attn();
        if (!ch || st.mode !== 'req' || !st.on) return;
        let list = [];
        try { list = (ch._store && ch._store.choices) ? ch._store.choices.slice() : []; } catch (_) {}
        list = list.filter((c) => c && c.value !== undefined && c.value !== '' && !c.placeholder);
        if (!list.length) { if ((tries || 0) < 20) { clearTimeout(grouping); grouping = setTimeout(() => groupAttention((tries || 0) + 1), 300); } return; }
        if (list.some((c) => c.__ibaReq) || ch.__ibaReqGrouped) return;
        const pick = (c) => ({ value: c.value, label: c.label, customProperties: c.customProperties, __ibaReq: 1 });
        const proc = list.filter(isProc).sort((x, y) => procRank(x) - procRank(y)).map(pick), rest = list.filter((c) => !isProc(c)).map(pick);
        if (!proc.length) return;
        try {
            ch.clearStore();
            ch.setChoices([{ label: 'Procurement', id: 901, disabled: false, choices: proc }, { label: 'Everyone else', id: 902, disabled: false, choices: rest }], 'value', 'label', true);
            ch.__ibaReqGrouped = true;
        } catch (e) { console.warn('[newreq] attention', e); }
    }
    function ungroupAttention() {
        const ch = attn();
        if (!ch || !ch.__ibaReqGrouped) return;
        ch.__ibaReqGrouped = false;
        try { if (typeof populateAttentionDropdown === 'function') populateAttentionDropdown(ch); } catch (_) {}
    }
    // the app re-fills the Attention list when the job type changes: group again
    (function hookPopulate() {
        const orig = window.populateAttentionDropdown;
        if (typeof orig !== 'function') { setTimeout(hookPopulate, 300); return; }
        if (orig.__ibaReq) return;
        const w = async function (inst) {
            const r = await orig.apply(this, arguments);
            try { if (inst && inst === attn()) { inst.__ibaReqGrouped = false; if (st.on && st.mode === 'req') setTimeout(groupAttention, 30); } } catch (_) {}
            return r;
        };
        w.__ibaReq = true;
        window.populateAttentionDropdown = w;
    })();
    // a PR job keeps the vendor typed in the New requisition window (the app
    // keeps vendor fields for Invoice jobs only)
    (function hookForm() {
        const orig = window.getJobDataFromForm;
        if (typeof orig !== 'function') { setTimeout(hookForm, 300); return; }
        if (orig.__ibaReq) return;
        const w = function () {
            const d = orig.apply(this, arguments);
            try {
                if (d && st.on && st.mode === 'req' && d.for === 'PR') {
                    const vn = val('job-vendor-name'), vi = val('job-vendor-id');
                    if (vn) d.vendorName = vn;
                    if (vi) d.vendorId = vi;
                    if (!d.remarks) d.remarks = 'Pending';
                }
            } catch (_) {}
            return d;
        };
        w.__ibaReq = true;
        window.getJobDataFromForm = w;
    })();

    // ---- step 1: PO facts ------------------------------------------------------
    function poRow(po) {
        try { if (typeof allPOData !== 'undefined' && allPOData && allPOData[po]) return allPOData[po]; } catch (_) {}
        return null;
    }
    function poHint() {
        const po = cleanPO(val('job-po'));
        const pvEl = $('iba-ni-povalue');
        const h = document.querySelector('[data-ni-hint="1"]');
        if (!h) return;
        if (!po) { if (pvEl) pvEl.textContent = '—'; h.className = 'iba-ni-hint'; h.innerHTML = ''; return; }
        const row = poRow(po);
        if (pvEl) pvEl.textContent = row ? (money(row['Amount'] || row['PO Value'] || row['POValue'] || row['Value']) || '—') : '—';
        readInvs(po);
        let txt = '', cls = '';
        const poHintEl = $('iba-job-po-hint');
        const notFound = poHintEl && !poHintEl.hidden && /not in POVALUE2/i.test(poHintEl.textContent || '');
        if (row) {
            cls = 'is-good';
            txt = 'Filled from the PO list.';
            if (st.invs && st.invsPo === po) {
                const ks = Object.keys(st.invs);
                const open = ks.filter((k) => norm((st.invs[k] || {}).status) !== 'paid').length;
                txt += ' ' + ks.length + ' invoice' + (ks.length === 1 ? '' : 's') + ' on this PO' + (ks.length ? ', ' + open + ' still open.' : '.');
            }
        } else if (notFound) {
            cls = 'is-bad';
            txt = 'PO ' + po + ' is not in records. ' + (isSuper() && window.ibaAddPo ? '' : 'Fill the site and vendor by hand, or ask Irwin to add the PO.');
        }
        const btn = (cls === 'is-bad' && isSuper() && window.ibaAddPo) ? ' <button type="button" class="iba-ni-addpo" data-ni-addpo>+ Add PO</button>' : '';
        const html = esc(txt) + btn;
        if (h.__html !== html) { h.__html = html; h.innerHTML = html; }
        h.className = 'iba-ni-hint ' + cls;
    }
    // invoices already on the PO: one PO only, read once per PO
    function readInvs(po) {
        if (!po || st.invsPo === po || st.reading === po) return;
        let d = null;
        try { d = (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) {}
        if (!d) return;
        st.reading = po;
        d.ref('invoice_entries/' + po).once('value').then((s) => {
            if (st.reading !== po) return;
            st.invs = (s && s.val()) || {}; st.invsPo = po;
        }).catch(() => { st.invs = null; st.invsPo = ''; }).finally(() => { if (st.reading === po) st.reading = ''; paint(); });
    }
    function dupHint() {
        const h = document.querySelector('[data-ni-hint="2"]');
        if (!h) return;
        const po = cleanPO(val('job-po')), no = normInv(val('job-ref'));
        let html = '', cls = '';
        if (po && no && st.invs && st.invsPo === po) {
            const k = Object.keys(st.invs).find((x) => { const i = st.invs[x] || {}; return normInv(i.invNumber) === no || normInv(i.invEntryID) === no; });
            if (k) {
                const i = st.invs[k] || {};
                cls = 'is-bad';
                html = 'Invoice ' + esc(i.invNumber || val('job-ref')) + ' is already on PO ' + esc(po) + (i.status ? ' (' + esc(i.status) + ')' : '') + '. Check before saving: it may be a double entry.';
            } else { cls = 'is-good'; html = 'Not on this PO yet. Good.'; }
        } else if (po && no && st.reading === po) html = 'Checking PO ' + esc(po) + '…';
        if (h.__html !== html) { h.__html = html; h.innerHTML = html; }
        h.className = 'iba-ni-hint ' + cls;
    }

    // ---- watch the window ------------------------------------------------------
    // both menu items open the same page: light only the one in use
    function fixNav() {
        const add = document.querySelector('#iba-app-shell [data-iba-nav="wd-add-job"]:not([data-iba-newinv]):not([data-iba-newreq])');
        const ni = document.querySelector('#iba-app-shell [data-iba-newinv]');
        const nr = document.querySelector('#iba-app-shell [data-iba-newreq]');
        const all = [add, ni, nr].filter(Boolean);
        if (!all.some((x) => x.classList.contains('is-active'))) return;
        if (add) add.classList.toggle('is-active', !st.on);
        if (ni) ni.classList.toggle('is-active', st.on && st.mode === 'inv');
        if (nr) nr.classList.toggle('is-active', st.on && st.mode === 'req');
    }
    function sync() {
        setTimeout(fixNav, 0);
        const want = (isOpen() && addMode() && !onPhone()) ? modeOfForm() : '';
        if (st.on && want !== st.mode) off();
        if (want && !st.on) on(want);
        else if (st.on) paint();
        // after a save the form is cleared: stay in the same window for the next one
        if (!st.on && st.again && Date.now() - st.again < 5000 && isOpen() && addMode() && !val('job-for')) {
            st.again = 0;
            setType(st.againMode === 'req' ? 'PR' : 'Invoice');
        }
    }
    function setInvoice() { setType('Invoice'); }
    function setType(t) {
        const f = $('job-for');
        if (!f) return;
        f.value = t;
        f.dispatchEvent(new Event('change', { bubbles: true }));
        setTimeout(sync, 60);
    }
    setInterval(() => { if (st.on || isOpen()) sync(); }, 400);
    document.addEventListener('change', (e) => { if (e.target && (e.target.id === 'job-for' || e.target.closest && e.target.closest('#standard-job-modal'))) setTimeout(sync, 30); }, true);
    document.addEventListener('input', (e) => { if (st.on && e.target && e.target.closest && e.target.closest('#standard-job-modal')) setTimeout(paint, 30); }, true);
    document.addEventListener('focusout', () => { if (st.on) setTimeout(paint, 60); }, true);
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        // side menu "+ New Invoice"
        const nav = t.closest('[data-iba-nav="wd-add-job"]');
        if (nav) st.want = nav.hasAttribute('data-iba-newinv') ? 'Invoice' : nav.hasAttribute('data-iba-newreq') ? 'PR' : '';
        if (!st.on) return;
        if (t.closest('[data-ni-other]')) { e.preventDefault(); const f = $('job-for'); if (f) { f.value = ''; f.dispatchEvent(new Event('change', { bubbles: true })); } off(); return; }
        if (t.closest('[data-ni-addpo]')) {
            e.preventDefault();
            const po = cleanPO(val('job-po'));
            if (po && window.ibaAddPo) window.ibaAddPo.resolve(po).then((r) => { if (r && typeof window.ibaJobPOFill === 'function') window.ibaJobPOFill(true); setTimeout(paint, 300); });
            return;
        }
        const tp = t.closest('[data-ni-trackpo]');
        if (tp) {
            e.preventDefault();
            const po = tp.getAttribute('data-ni-trackpo');
            try { if (window.ibaAssistant && window.ibaAssistant.ask) window.ibaAssistant.ask(po); } catch (_) {}
            return;
        }
        if (t.closest('#add-job-button') && reqPo()) {
            e.preventDefault(); e.stopImmediatePropagation();
            paint();
            const g = $('job-ref'); if (g) { g.classList.add('iba-ni-glow'); try { g.focus(); } catch (_) {} }
            const nx = $('iba-ni-next'); if (nx) { nx.classList.remove('is-shake'); void nx.offsetWidth; nx.classList.add('is-shake'); }
            return;
        }
        if (t.closest('#add-job-button')) {
            const now = firstOpen();
            if (now) {
                e.preventDefault(); e.stopImmediatePropagation();
                const id = missing(now)[0];
                paint();
                const g = glowTarget(id);
                if (g) { g.classList.add('iba-ni-glow'); try { g.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} }
                try { ($(id) || {}).focus && $(id).focus(); } catch (_) {}
                const nx = $('iba-ni-next'); if (nx) { nx.classList.remove('is-shake'); void nx.offsetWidth; nx.classList.add('is-shake'); }
                return;
            }
            if (st.mode === 'inv') {
                // no Attention: the app sends invoice jobs to Irwin / his replacement
                try { if (typeof attentionSelectChoices !== 'undefined' && attentionSelectChoices) attentionSelectChoices.removeActiveItems(); } catch (_) {}
                const at = $('job-attention'); if (at) at.value = '';
            }
            st.again = Date.now();
            st.againMode = st.mode;
        }
    }, true);

    // the window opened from "+ New Invoice" / the skill starts as an invoice
    function hookOpen() {
        const orig = window.openStandardJobModal;
        if (typeof orig !== 'function' || orig.__ibaNi) return typeof orig === 'function';
        const w = function (mode) {
            const r = orig.apply(this, arguments);
            if (mode === 'Add' && st.want) { const t = st.want; st.want = ''; setTimeout(() => setType(t), 350); }
            else if (mode !== 'Add') st.want = '';
            setTimeout(sync, 50);
            return r;
        };
        Object.keys(orig).forEach((k) => { try { w[k] = orig[k]; } catch (_) {} });
        w.__ibaNi = true;
        window.openStandardJobModal = w;
        return true;
    }
    let tries = 0;
    (function boot() { if (!hookOpen() && ++tries < 60) setTimeout(boot, 250); })();

    // open it from anywhere (assistant skill "Add new invoice")
    async function openReq(ref) {
        if (typeof window.ibaOpenShellPage !== 'function') throw new Error('Add New Job is not available on this page.');
        st.want = 'PR';
        await window.ibaOpenShellPage('wd-add-job');
        for (let i = 0; i < 30 && !(isOpen() && modeOfForm() === 'req'); i++) await new Promise((r) => setTimeout(r, 200));
        if (modeOfForm() !== 'req') setType('PR');
        await new Promise((r) => setTimeout(r, 300));
        const el = $('job-ref');
        if (el && ref) { el.value = String(ref).trim(); el.dispatchEvent(new Event('input', { bubbles: true })); }
        if (el) el.focus();
        sync();
    }
    window.ibaNewRequisition = openReq;
    async function open(po) {
        if (typeof window.ibaOpenShellPage !== 'function') throw new Error('Add New Job is not available on this page.');
        st.want = 'Invoice';
        await window.ibaOpenShellPage('wd-add-job');
        for (let i = 0; i < 30 && !(isOpen() && isInvoice()); i++) await new Promise((r) => setTimeout(r, 200));
        if (!isInvoice()) setInvoice();
        await new Promise((r) => setTimeout(r, 300));
        const el = $('job-po');
        if (el && po) {
            el.value = String(po).trim();
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            const r = $('job-ref'); if (r) setTimeout(() => r.focus(), 600);
        } else if (el) el.focus();
        sync();
    }
    window.ibaNewInvoice = open;
})();
