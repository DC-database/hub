/* ==========================================================================
   js/iba-approvals.js — 14.0.0 patch 5
   One approval routine for the desktop and the phone.

   Rules (agreed with Irwin):
   - Anyone named in the Attention of a "For Approval" invoice can approve or
     reject it, whatever their position. Several names in Attention: each one
     can act. A vacation stand-in can act for the person they cover.
   - "CEO Approval" invoices: the CEO named in Attention approves them.
   - Approve: the invoice gets its own ESN, registered in Firebase
     (manager_approved/esn_registry + manager_approved/{PO}_{key}).
   - Reject: needs a note; no ESN.
   - After either decision the invoice goes back to the sender (Irwin, or his
     active vacation replacement) and waits in his Active Task under
     "Approved" or "Rejected" until he moves it to the next step.
   - At most 3 approvals per invoice (slots 1-3). The CEO has his own slot.
     A 4th approval is refused instead of overwriting slot 3.
   - The daily approval code (approval_sequences) is no longer used.
   ========================================================================== */
(function () {
    'use strict';

    const VERSION = '14.0.0-p5';
    const MAX_APPROVALS = 3;
    const SLOTS = [1, 2, 3];

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function norm(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' '); }
    function statusNorm(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' '); }
    function ts() { return firebase.database.ServerValue.TIMESTAMP; }
    function user() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : (window.currentApprover || null); } catch (_) { return window.currentApprover || null; } }
    function myName() { const u = user(); return String((u && u.Name) || '').trim(); }
    function firstName(name) { return (String(name || '').trim().split(/\s+/)[0] || 'USER').toUpperCase(); }
    function ymd(d) { d = d || new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }
    function dateGB(d) { return (d || new Date()).toLocaleDateString('en-GB'); }
    function invDb() { try { return (typeof invoiceDb !== 'undefined') ? invoiceDb : window.invoiceDb; } catch (_) { return window.invoiceDb; } }
    function mainDb() { try { return (typeof db !== 'undefined') ? db : window.db; } catch (_) { return window.db; } }
    function safeKey(v) { return String(v || '').trim().replace(/[.#$\[\]\/\\]/g, '_').replace(/\s+/g, '_'); }
    function money(v) {
        const n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
        if (!Number.isFinite(n)) return String(v || '');
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function isCEOUser(u) {
        u = u || user();
        const pos = String((u && u.Position) || '').trim().toLowerCase();
        const tokens = pos.split(/[^a-z0-9]+/).filter(Boolean);
        return tokens.includes('ceo') || pos === 'chief executive officer';
    }

    function superAdminName() {
        try { return (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) ? SUPER_ADMIN_NAME : 'Irwin'; } catch (_) { return 'Irwin'; }
    }

    // The sender is Irwin, or his active vacation replacement.
    function senderName() {
        const base = superAdminName();
        try { if (typeof resolveVacationAssignee === 'function') return resolveVacationAssignee(base) || base; } catch (_) {}
        return base;
    }

    // Me + everyone I currently stand in for (vacation replacement).
    function myNames() {
        const me = myName();
        let delegators = [];
        try { if (typeof getDelegatorsForReplacement === 'function') delegators = getDelegatorsForReplacement(me) || []; } catch (_) {}
        return Array.from(new Set([me].concat(delegators).map(n => String(n || '').trim()).filter(Boolean)));
    }

    // Split an Attention value such as "Ahmad, Maria / Khalid" into names.
    function attentionParts(att) {
        return String(att || '')
            .split(/\s*(?:,|;|\/|\||&|\+|->|➔|\band\b|\bor\b)\s*/i)
            .map(norm).filter(Boolean);
    }

    // Is this person named in Attention? Exact name, or every word of a
    // multi-word name inside one Attention part ("Ahmad" alone never matches
    // "Ahmad Engr" the other way round).
    function attentionNames(att, name) {
        const n = norm(name);
        if (!n) return false;
        const whole = norm(att);
        if (!whole) return false;
        if (['all', 'site', 'accounting', 'accounts', 'finance', 'none'].includes(whole)) return false;
        if (whole === n) return true;
        const parts = attentionParts(att);
        if (parts.includes(n)) return true;
        const words = n.split(' ').filter(Boolean);
        if (words.length >= 2) return parts.some(p => words.every(w => p.split(' ').includes(w)));
        return false;
    }

    function namedForMe(att) { return myNames().some(n => attentionNames(att, n)); }

    // What kind of decision is waiting on this invoice (or task row)?
    //   'approval' = For Approval, 'ceo' = CEO Approval, '' = none
    function waitingKind(rec) {
        const st = statusNorm(rec && (rec.status || rec.remarks));
        if (st === 'for approval') return 'approval';
        if (st === 'ceo approval') return 'ceo';
        return '';
    }

    function canDecide(rec) {
        if (!rec) return false;
        const kind = waitingKind(rec);
        if (!kind) return false;
        const att = rec.attention || rec.Attention || rec.assignedTo || '';
        if (kind === 'ceo') return isCEOUser() && namedForMe(att);
        return namedForMe(att);
    }

    function isOpenReturn(rec) {
        if (!rec || rec.approvalReturnOpen !== true) return false;
        const st = statusNorm(rec.status || rec.remarks);
        return st === 'approved' || st === 'rejected';
    }

    function taskIds(task) {
        const po = String((task && (task.originalPO || task.po)) || '').trim();
        let key = String((task && (task.originalKey || task.invoiceKey)) || '').trim();
        if (!key && task && task.key) {
            const k = String(task.key);
            key = (po && k.indexOf(po + '_') === 0) ? k.slice(po.length + 1) : k;
        }
        return { po, key };
    }

    function recordKey(po, key) {
        const safePO = String(po || 'NO_PO').replace(/[.#$[\]]/g, '_');
        return `${safePO}_${key || 'NO_KEY'}`;
    }

    function pdfUrl(rec) {
        const name = rec && (rec.invName || rec.invoiceName);
        if (!name || String(name).trim().toLowerCase() === 'nil') return '';
        try {
            if (typeof buildSharePointPdfUrl === 'function' && typeof PDF_BASE_PATH !== 'undefined') return buildSharePointPdfUrl(PDF_BASE_PATH, name) || '';
        } catch (_) {}
        return '';
    }

    // ------------------------------------------------------------------
    // Approval record (manager_approved/{PO}_{key})
    // ------------------------------------------------------------------
    async function readRecord(po, key) {
        const d = mainDb();
        if (!d || !po || !key) return {};
        const snap = await d.ref(`manager_approved/${recordKey(po, key)}`).once('value');
        return snap.val() || {};
    }

    function countIn(rec) { return SLOTS.filter(n => rec && rec['esn_' + n]).length; }

    async function countApprovals(po, key) {
        if (!po || !key) return 0;
        try { return countIn(await readRecord(po, key)); }
        catch (e) { console.warn('[approvals] count failed', e); return 0; }
    }

    function approvalsList(rec) {
        const out = [];
        SLOTS.forEach(n => {
            if (rec && rec['esn_' + n]) out.push({ slot: n, esn: rec['esn_' + n], name: rec['approver_' + n] || '', date: rec['date_' + n] || '' });
        });
        if (rec && rec.esn_ceo) out.push({ slot: 'ceo', esn: rec.esn_ceo, name: rec.approver_ceo || '', date: rec.date_ceo || '' });
        return out;
    }

    // Claim the next free slot (or the CEO slot) in one transaction, so two
    // approvers acting at the same moment can never share or overwrite a slot.
    async function claimSlot(po, key, inv, esn, approver, ceo) {
        const d = mainDb();
        let outcome = { ok: false, message: 'Could not save the approval. Please try again.' };
        const res = await d.ref(`manager_approved/${recordKey(po, key)}`).transaction(cur => {
            const rec = (cur && typeof cur === 'object') ? cur : {};
            let slot;
            if (ceo) {
                if (rec.esn_ceo) {
                    outcome = { ok: false, message: `This invoice already has the CEO approval (${rec.esn_ceo}).` };
                    return;
                }
                slot = 'ceo';
            } else {
                slot = SLOTS.find(n => !rec['esn_' + n]);
                if (!slot) {
                    outcome = { ok: false, message: `This invoice already has ${MAX_APPROVALS} approvals.` };
                    return;
                }
            }
            const next = Object.assign({}, rec, {
                po: rec.po || po,
                inv_no: rec.inv_no || (inv && (inv.invNumber || inv.ref)) || '',
                ['esn_' + slot]: esn,
                ['approver_' + slot]: approver,
                ['date_' + slot]: dateGB(new Date())
            });
            outcome = { ok: true, slot, count: countIn(next) };
            return next;
        });
        if (!res || !res.committed) return outcome.ok ? { ok: false, message: 'Could not save the approval. Please try again.' } : outcome;
        return outcome;
    }

    async function newEsn(ceo) {
        const base = ceo
            ? ((typeof getNextSeriesNumber === 'function') ? await getNextSeriesNumber() : null)
            : ((typeof getManagerSeriesNumber === 'function') ? await getManagerSeriesNumber() : null);
        if (!base) throw new Error('The ESN generator is not available. Please refresh the page.');
        return base;
    }

    // ------------------------------------------------------------------
    // The decision (one invoice)
    // ------------------------------------------------------------------
    async function decide(task, action, opts) {
        opts = opts || {};
        if (action !== 'Approved' && action !== 'Rejected') throw new Error('Unknown action.');
        const note = String(opts.note || '').trim();
        if (action === 'Rejected' && !note) throw new Error('Please write a note for the sender before rejecting.');

        const ids = taskIds(task);
        const po = ids.po, key = ids.key;
        const idb = invDb();
        if (!po || !key || !idb) throw new Error('Invoice identifiers are missing. Please refresh.');

        const ref = idb.ref(`invoice_entries/${po}/${key}`);
        const snap = await ref.once('value');
        const inv = snap.val();
        if (!inv) throw new Error('This invoice was not found. It may have been deleted.');
        if (!waitingKind(inv)) {
            const who = inv.last_approver ? ` Last action by ${inv.last_approver}.` : '';
            throw new Error(`This invoice is no longer waiting for approval (status: ${inv.status || 'none'}).${who}`);
        }
        if (!canDecide(inv)) throw new Error('Your name is not in the Attention of this invoice.');

        const approver = myName() || 'User';
        const short = firstName(approver);
        const now = new Date();
        const ceo = isCEOUser();
        let esn = '', slot = '', count = null, esnBase = '';

        if (action === 'Approved') {
            // Quick check first, so a full invoice does not burn an ESN.
            const before = await readRecord(po, key);
            if (ceo && before.esn_ceo) throw new Error(`This invoice already has the CEO approval (${before.esn_ceo}).`);
            if (!ceo && countIn(before) >= MAX_APPROVALS) throw new Error(`This invoice already has ${MAX_APPROVALS} approvals.`);

            esnBase = await newEsn(ceo);
            esn = `${esnBase}/${short}`;
            const claim = await claimSlot(po, key, inv, esn, approver, ceo);
            const registry = mainDb().ref(`manager_approved/esn_registry/${esnBase}`);
            if (!claim.ok) {
                try { await registry.update({ voided: true, voidedReason: claim.message }); } catch (_) {}
                throw new Error(claim.message);
            }
            slot = claim.slot;
            count = claim.count;
            await registry.update({
                esn, po, invoiceKey: key,
                inv_no: inv.invNumber || '',
                approver, slot: String(slot),
                usedAt: ts()
            });
        }

        const decision = {
            status: action,
            action: action === 'Approved' ? 'APPROVED' : 'REJECTED',
            name: approver,
            nameShort: short,
            identity: `${action === 'Approved' ? 'APPROVED' : 'REJECTED'}/${short}`,
            date: ymd(now),
            remarks: note,
            timestamp: ts()
        };
        if (esn) { decision.esn = esn; decision.code = esn; decision.slot = String(slot); }

        const sender = senderName();
        const updates = {
            status: action,
            remarks: action,
            attention: sender,
            last_approver: approver,
            dateResponded: (typeof formatDate === 'function') ? formatDate(now) : dateGB(now),
            releaseDate: (typeof getTodayDateString === 'function') ? getTodayDateString() : now.toISOString().slice(0, 10),
            statusChangedAt: ts(),
            statusQueueAt: ts(),
            updatedAt: ts(),
            updatedBy: approver,
            approvalDecision: decision,
            approvalNote: note,
            approvalReturnOpen: true
        };
        if (esn) {
            updates.esn = esn;
            updates.approvalCount = count;
        }

        await ref.update(updates);
        const hist = { action, by: approver, timestamp: ts(), note: note || (action === 'Approved' ? 'Approved' : 'Rejected') };
        if (esn) { hist.esn = esn; hist.slot = String(slot); }
        await ref.child('history').push(hist);

        const merged = Object.assign({}, inv, updates);
        try {
            if (typeof updateInvoiceTaskLookup === 'function') await updateInvoiceTaskLookup(po, key, merged, inv.attention || '');
        } catch (e) { console.warn('[approvals] task lookup update failed', e); }
        try { if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(po, key, updates); } catch (_) {}

        // Drop it from the in-memory Active Task list straight away.
        try {
            if (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks)) {
                const i = userActiveTasks.findIndex(t => t && (t.key === task.key || (taskIds(t).po === po && taskIds(t).key === key)));
                if (i > -1) userActiveTasks.splice(i, 1);
            }
        } catch (_) {}

        const result = {
            action, esn, slot, count, po, key, sender,
            invNumber: inv.invNumber || '',
            vendorName: inv.vendorName || inv.vendor_name || task.vendorName || '',
            site: inv.site || inv.site_name || task.site || '',
            amount: inv.amountPaid || inv.invValue || task.amountPaid || task.amount || ''
        };
        try { window.dispatchEvent(new CustomEvent('iba:approval-decision-saved', { detail: result })); } catch (_) {}
        return result;
    }

    // ------------------------------------------------------------------
    // Status saves elsewhere (invoice form, batch, summary note, Process)
    // ------------------------------------------------------------------
    async function prepareStatusSave(po, key, original, updates, newStatus) {
        original = original || {};
        updates = updates || {};
        const ns = statusNorm(newStatus);
        const os = statusNorm(original.status || original.remarks);
        if (ns === 'for approval') {
            if (key) {
                const used = await countApprovals(po, key);
                if (used >= MAX_APPROVALS) {
                    return { ok: false, message: `This invoice already has ${MAX_APPROVALS} approvals. It cannot be sent for another approval.` };
                }
            }
            if (os !== 'for approval') {
                updates.approvalRequestedBy = myName() || 'System';
                updates.approvalRequestedAt = ts();
            }
        }
        // Moving a returned decision to its next step takes it off the
        // sender's Approved / Rejected tab.
        if (ns && ns !== os && (original.approvalReturnOpen === true || original.approvalDecision || original.esn)) {
            updates.approvalReturnOpen = false;
        }
        return { ok: true };
    }

    // ------------------------------------------------------------------
    // Load the invoices waiting for my decision (phone + checks)
    // Reads only the small task index (mine + delegated + the shared All
    // index, as the desktop Active Task already does) and then each listed
    // invoice once.
    // ------------------------------------------------------------------
    async function loadMyInvoiceApprovals() {
        const idb = invDb();
        if (!idb) return [];
        const names = myNames();
        const buckets = await Promise.all(names.concat(['All']).map(async n => {
            try { const s = await idb.ref(`invoice_tasks_by_user/${safeKey(n)}`).once('value'); return s.val() || {}; }
            catch (_) { return {}; }
        }));
        const seen = new Set();
        const candidates = [];
        buckets.forEach(bucket => {
            Object.keys(bucket || {}).forEach(k => {
                const row = bucket[k];
                if (!row || typeof row !== 'object') return;
                if (!waitingKind(row)) return;
                if (!canDecide(row)) return;
                const po = String(row.po || row.originalPO || '').trim();
                const key = String(row.originalKey || row.invoiceKey || k).trim();
                if (!po || !key) return;
                const id = po + '_' + key;
                if (seen.has(id)) return;
                seen.add(id);
                candidates.push({ po, key, row });
            });
        });

        const out = [];
        await Promise.all(candidates.map(async c => {
            try {
                const s = await idb.ref(`invoice_entries/${c.po}/${c.key}`).once('value');
                const inv = s.val();
                if (!inv || !canDecide(inv)) return;
                out.push({
                    key: c.po + '_' + c.key,
                    originalPO: c.po,
                    originalKey: c.key,
                    po: c.po,
                    source: 'invoice',
                    for: 'Invoice',
                    status: inv.status,
                    remarks: inv.status,
                    kind: waitingKind(inv),
                    attention: inv.attention || '',
                    ref: inv.invNumber || c.row.ref || '',
                    invNumber: inv.invNumber || c.row.ref || '',
                    vendorName: inv.vendorName || inv.vendor_name || c.row.vendorName || '',
                    site: inv.site || inv.site_name || c.row.site || '',
                    amount: inv.invValue || c.row.amount || '',
                    amountPaid: inv.amountPaid || inv.invValue || c.row.amountPaid || '',
                    invName: inv.invName || c.row.invName || '',
                    note: inv.note || '',
                    invoiceDate: inv.invoiceDate || c.row.date || '',
                    enteredBy: inv.enteredBy || '',
                    approvalCount: Number(inv.approvalCount || 0),
                    requestedAt: Number(inv.approvalRequestedAt || inv.statusChangedAt || 0) || 0
                });
            } catch (e) { console.warn('[approvals] could not read invoice', c, e); }
        }));
        out.sort((a, b) => (a.kind === b.kind ? 0 : (a.kind === 'ceo' ? -1 : 1)) || (b.requestedAt - a.requestedAt) || String(a.po).localeCompare(String(b.po)));
        return out;
    }

    // ------------------------------------------------------------------
    // Print (ESN stamp for the Site Approval area of the SRV)
    // ------------------------------------------------------------------
    let printRoot = null;
    async function printStamp(po, key, inv) {
        if (!inv) {
            try { const s = await invDb().ref(`invoice_entries/${po}/${key}`).once('value'); inv = s.val() || {}; } catch (_) { inv = {}; }
        }
        let rec = {};
        try { rec = await readRecord(po, key); } catch (_) {}
        let stamps = approvalsList(rec).map(a => ({ status: 'Approved', identity: `APPROVED/${firstName(a.name)}`, code: a.esn, date: a.date }));
        const dec = inv && inv.approvalDecision;
        if (!stamps.length && dec) {
            // older records: the decision itself (daily code before patch 5)
            stamps = [{ status: inv.status || dec.status, identity: dec.identity || `${(dec.action || 'APPROVED')}/${firstName(dec.name)}`, code: dec.esn || dec.code || '', date: dec.date ? `${dec.date.slice(6, 8)}/${dec.date.slice(4, 6)}/${dec.date.slice(0, 4)}` : '' }];
        }
        if (!stamps.length) { alert('This invoice has no approval to print yet.'); return; }

        if (!printRoot) {
            printRoot = document.getElementById('iba-approval-print-root');
            if (!printRoot) {
                printRoot = document.createElement('div');
                printRoot.id = 'iba-approval-print-root';
                document.body.appendChild(printRoot);
            }
        }
        const title = `PO ${po}${inv && inv.invNumber ? ' · INV ' + inv.invNumber : ''}`;
        printRoot.innerHTML = `
          <div class="iba-approval-print-toolbar">
            <strong>${esc(title)} — ${stamps.length} approval${stamps.length === 1 ? '' : 's'}</strong>
            <span>
              <button type="button" class="print-now">Print A4</button>
              <button type="button" class="close-print">Close</button>
            </span>
          </div>
          <div class="iba-approval-print-page">
            <div class="iba-approval-stamp-stack">
              ${stamps.map(s => `
              <div class="iba-approval-stamp ${String(s.status).toLowerCase() === 'rejected' ? 'rejected' : 'approved'}">
                <div class="iba-approval-main">${esc(s.identity)}</div>
                <div class="iba-approval-code">${esc(s.code)}</div>
                <div class="iba-approval-date">${esc(s.date || dateGB(new Date()))}</div>
              </div>`).join('')}
            </div>
          </div>`;
        printRoot.classList.add('is-open');
        printRoot.querySelector('.print-now').onclick = () => {
            const page = printRoot.querySelector('.iba-approval-print-page');
            printInFrame(page ? page.outerHTML : '');
        };
        printRoot.querySelector('.close-print').onclick = () => printRoot.classList.remove('is-open');
    }

    // The stamps print from their own small page, so the other print rules
    // of the system (Summary Note, app frame) cannot interfere.
    const STAMP_PRINT_CSS = `
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .iba-approval-print-page { position: relative; width: 210mm; height: 297mm; margin: 0; overflow: hidden; background: #fff; }
      .iba-approval-stamp-stack { position: absolute; left: 50%; bottom: 28mm; transform: translateX(-50%); width: 196mm;
        display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 4mm 5mm; }
      .iba-approval-stamp { width: 58mm; text-align: center; color: #198754; font-family: Arial, Helvetica, sans-serif; line-height: 1.12; }
      .iba-approval-stamp.rejected { color: #c62828; }
      .iba-approval-main { margin: 0; font-size: 10pt; font-weight: 900; letter-spacing: .15px; white-space: nowrap; }
      .iba-approval-code { margin: 2.2mm 0 1.4mm; font-size: 8.5pt; font-weight: 800; white-space: nowrap; }
      .iba-approval-date { font-size: 8pt; font-weight: 700; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;

    function printInFrame(pageHtml) {
        const old = document.getElementById('iba-apv-print-frame');
        if (old) old.remove();
        const frame = document.createElement('iframe');
        frame.id = 'iba-apv-print-frame';
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
        document.body.appendChild(frame);
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Approval</title><style>${STAMP_PRINT_CSS}</style></head><body>${pageHtml}</body></html>`);
        doc.close();
        setTimeout(() => {
            try { frame.contentWindow.focus(); frame.contentWindow.print(); }
            catch (e) { console.warn('[approvals] print failed', e); window.print(); }
        }, 250);
    }

    // ------------------------------------------------------------------
    // WhatsApp (optional second proof)
    // ------------------------------------------------------------------
    function whatsAppText(results) {
        const lines = ['APPROVAL', '', 'Approved Invoice(s):'];
        results.filter(r => r && r.action === 'Approved').forEach(r => {
            lines.push('');
            lines.push(`ESN: ${r.esn || ''}`);
            lines.push(`PO: ${r.po || 'N/A'}`);
            lines.push(`INV: ${r.invNumber || r.key || 'N/A'}`);
            lines.push(`Vendor: ${r.vendorName || 'N/A'}`);
            lines.push(`Site: ${r.site || 'N/A'}`);
            lines.push(`Invoice Amount: QAR ${money(r.amount || 0)}`);
        });
        return lines.join('\n');
    }
    function sendWhatsApp(results) {
        const approved = (results || []).filter(r => r && r.action === 'Approved');
        if (!approved.length) return;
        const url = 'https://wa.me/?text=' + encodeURIComponent(whatsAppText(approved));
        const w = window.open(url, '_blank');
        if (!w) window.location.href = url;
    }

    // ------------------------------------------------------------------
    // Toast
    // ------------------------------------------------------------------
    function toast(html, opts) {
        opts = opts || {};
        let host = document.getElementById('iba-apv-toast');
        if (!host) {
            host = document.createElement('div');
            host.id = 'iba-apv-toast';
            document.body.appendChild(host);
        }
        host.innerHTML = `<div class="iba-apv-toast-body ${opts.tone || ''}">${html}<button type="button" class="iba-apv-toast-x" aria-label="Close">&times;</button></div>`;
        host.classList.add('is-open');
        host.querySelector('.iba-apv-toast-x').onclick = () => host.classList.remove('is-open');
        if (typeof opts.bind === 'function') opts.bind(host);
        clearTimeout(host.__t);
        host.__t = setTimeout(() => host.classList.remove('is-open'), opts.ms || 9000);
    }

    function decisionToast(results) {
        const ok = (results || []).filter(Boolean);
        if (!ok.length) return;
        const approved = ok.filter(r => r.action === 'Approved');
        const rejected = ok.filter(r => r.action === 'Rejected');
        let html = '';
        if (approved.length === 1) html += `<strong>Approved</strong> · ESN <code>${esc(approved[0].esn)}</code>`;
        else if (approved.length > 1) html += `<strong>${approved.length} approved</strong>`;
        if (rejected.length) html += `${html ? ' · ' : ''}<strong>${rejected.length} rejected</strong>`;
        html += `<span class="iba-apv-toast-sub">Sent back to ${esc(ok[0].sender || senderName())}.</span>`;
        if (approved.length) html += `<button type="button" class="iba-apv-wa"><i class="fa-brands fa-whatsapp"></i> Send to WhatsApp (optional)</button>`;
        toast(html, {
            tone: approved.length ? 'ok' : 'warn',
            ms: 12000,
            bind: host => {
                const wa = host.querySelector('.iba-apv-wa');
                if (wa) wa.onclick = () => sendWhatsApp(approved);
            }
        });
    }

    // ------------------------------------------------------------------
    // Desktop dialog
    // ------------------------------------------------------------------
    let dialog = null;
    let dialogTask = null;

    function ensureDialog() {
        if (dialog) return dialog;
        dialog = document.createElement('div');
        dialog.id = 'iba-apd';
        dialog.className = 'iba-apd hidden';
        dialog.innerHTML = `
          <div class="iba-apd-box" role="dialog" aria-modal="true" aria-labelledby="iba-apd-title">
            <div class="iba-apd-head">
              <div>
                <span class="iba-apd-kicker" id="iba-apd-kicker">For Approval</span>
                <h3 id="iba-apd-title">Invoice</h3>
              </div>
              <button type="button" class="iba-apd-x" data-apd="cancel" aria-label="Close">&times;</button>
            </div>
            <div class="iba-apd-body">
              <div class="iba-apd-grid" id="iba-apd-grid"></div>
              <div class="iba-apd-slots" id="iba-apd-slots"></div>
              <label for="iba-apd-note">Note <span id="iba-apd-note-hint">(optional when approving, required when rejecting)</span></label>
              <textarea id="iba-apd-note" rows="3" placeholder="Write a note for the sender..."></textarea>
              <div class="iba-apd-error" id="iba-apd-error" role="alert"></div>
            </div>
            <div class="iba-apd-foot">
              <a class="iba-apd-pdf" id="iba-apd-pdf" href="#" target="_blank" rel="noopener"><i class="fa-regular fa-file-pdf"></i> View PDF</a>
              <span class="iba-apd-spacer"></span>
              <button type="button" class="iba-apd-btn is-reject" data-apd="Rejected"><i class="fa-solid fa-xmark"></i> Reject</button>
              <button type="button" class="iba-apd-btn is-approve" data-apd="Approved"><i class="fa-solid fa-check"></i> Approve</button>
            </div>
          </div>`;
        document.body.appendChild(dialog);
        dialog.addEventListener('click', async e => {
            const b = e.target.closest('[data-apd]');
            if (!b) { if (e.target === dialog) closeDialog(); return; }
            const a = b.getAttribute('data-apd');
            if (a === 'cancel') { closeDialog(); return; }
            await runDialogDecision(a, b);
        });
        dialog.addEventListener('keydown', e => { if (e.key === 'Escape') closeDialog(); });
        return dialog;
    }

    function closeDialog() {
        if (dialog) dialog.classList.add('hidden');
        dialogTask = null;
    }

    async function openDialog(task) {
        if (!task) return;
        const d = ensureDialog();
        dialogTask = task;
        const kind = waitingKind(task);
        d.querySelector('#iba-apd-kicker').textContent = kind === 'ceo' ? 'CEO Approval' : 'For Approval';
        d.querySelector('#iba-apd-title').textContent = task.vendorName || 'Invoice';
        const ids = taskIds(task);
        const amount = task.amountPaid || task.amount || '';
        d.querySelector('#iba-apd-grid').innerHTML = [
            ['PO', ids.po],
            ['Invoice', task.ref || task.invNumber || ''],
            ['Site', task.site || ''],
            ['Amount', amount !== '' ? 'QAR ' + money(amount) : ''],
            ['Attention', task.attention || ''],
            ['Sent by', senderName()]
        ].map(([k, v]) => `<div><small>${esc(k)}</small><strong>${esc(v || '—')}</strong></div>`).join('');
        const note = d.querySelector('#iba-apd-note');
        note.value = '';
        d.querySelector('#iba-apd-error').textContent = '';
        const pdf = pdfUrl(task);
        const pdfA = d.querySelector('#iba-apd-pdf');
        if (pdf) { pdfA.href = pdf; pdfA.classList.remove('hidden'); } else { pdfA.removeAttribute('href'); pdfA.classList.add('hidden'); }
        d.querySelectorAll('.iba-apd-btn').forEach(b => { b.disabled = false; });
        const slots = d.querySelector('#iba-apd-slots');
        slots.innerHTML = '<span class="iba-apd-slot-load">Checking approvals…</span>';
        d.classList.remove('hidden');
        setTimeout(() => note.focus(), 60);
        try {
            const rec = await readRecord(ids.po, ids.key);
            if (dialogTask !== task) return;
            const list = approvalsList(rec);
            const used = countIn(rec);
            const chips = SLOTS.map(n => {
                const a = list.find(x => x.slot === n);
                return a ? `<span class="iba-apd-slot is-used" title="${esc(a.esn)}"><i class="fa-solid fa-check"></i> ${esc(a.name || 'Approved')}</span>`
                         : `<span class="iba-apd-slot">Free</span>`;
            }).join('');
            const ceo = list.find(x => x.slot === 'ceo');
            slots.innerHTML = `<small>Approvals ${used} of ${MAX_APPROVALS}</small>${chips}${ceo ? `<span class="iba-apd-slot is-ceo"><i class="fa-solid fa-crown"></i> CEO ${esc(ceo.name)}</span>` : ''}`;
            if (!isCEOUser() && used >= MAX_APPROVALS) {
                d.querySelector('#iba-apd-error').textContent = `This invoice already has ${MAX_APPROVALS} approvals. You can still reject it with a note.`;
                d.querySelector('.iba-apd-btn.is-approve').disabled = true;
            }
        } catch (_) {
            slots.innerHTML = '';
        }
    }

    async function runDialogDecision(action, btn) {
        const task = dialogTask;
        if (!task) return;
        const d = ensureDialog();
        const noteEl = d.querySelector('#iba-apd-note');
        const errEl = d.querySelector('#iba-apd-error');
        const note = String(noteEl.value || '').trim();
        errEl.textContent = '';
        if (action === 'Rejected' && !note) {
            errEl.textContent = 'Please write a note for the sender before rejecting.';
            noteEl.focus();
            return;
        }
        const buttons = Array.from(d.querySelectorAll('.iba-apd-btn'));
        buttons.forEach(b => { b.disabled = true; });
        const label = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
        try {
            const result = await decide(task, action, { note });
            closeDialog();
            try {
                const row = document.querySelector(`#wd-activetask tr[data-key="${CSS.escape(String(task.key))}"]`);
                if (row) row.remove();
            } catch (_) {}
            decisionToast([result]);
            if (typeof populateActiveTasks === 'function') {
                try { await populateActiveTasks(true); } catch (_) {}
            }
        } catch (e) {
            errEl.textContent = (e && e.message) ? e.message : String(e);
            buttons.forEach(b => { b.disabled = false; });
        } finally {
            btn.innerHTML = label;
        }
    }

    // ------------------------------------------------------------------
    // Desktop Active Task: route approval clicks to the dialog, print and
    // process returned decisions.
    // ------------------------------------------------------------------
    function findTask(key) {
        try {
            if (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks)) {
                return userActiveTasks.find(t => String((t && t.key) || '') === String(key || '')) || null;
            }
        } catch (_) {}
        return null;
    }

    function installInterceptor() {
        document.addEventListener('click', function (event) {
            const t = event.target;
            if (!t || !t.closest) return;
            const printBtn = t.closest('.iba-apv-print-btn');
            if (printBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const po = printBtn.getAttribute('data-po');
                const key = printBtn.getAttribute('data-invkey');
                printStamp(po, key);
                return;
            }
            const processBtn = t.closest('.iba-apv-process-btn');
            if (processBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                processReturned(findTask(processBtn.getAttribute('data-key')));
                return;
            }
            const btn = t.closest('.modify-btn, .wd-action-approve, .wd-action-reject, .ceo-approve-btn');
            if (!btn) return;
            if (!btn.closest('#wd-activetask, #active-task-mobile-view')) return;
            const row = btn.closest('tr');
            const key = btn.getAttribute('data-key') || (row && row.getAttribute('data-key'));
            const task = findTask(key);
            if (!task || task.source !== 'invoice') return;
            if (!canDecide(task)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            openDialog(task);
            if (btn.classList.contains('wd-action-reject')) {
                setTimeout(() => { const n = document.getElementById('iba-apd-note'); if (n) n.focus(); }, 90);
            }
        }, true);
    }

    // "Process" on a returned decision: open the invoice in Invoice Entry
    // (where its status and Attention are changed). Saving it with a new
    // status takes it off the Approved / Rejected tab.
    async function processReturned(task) {
        if (!task) { alert('Task not found. Please refresh.'); return; }
        const ids = taskIds(task);
        let canEdit = true;
        try { if (typeof canCurrentUserEditInvoiceEntry === 'function') canEdit = !!canCurrentUserEditInvoiceEntry(); } catch (_) {}
        const canOpen = canEdit && typeof handlePOSearch === 'function' && typeof populateInvoiceFormForEditing === 'function';
        if (!canOpen) {
            if (typeof openModifyTaskModal === 'function') openModifyTaskModal(task);
            return;
        }
        try {
            if (typeof window.ibaOpenShellPage === 'function') await window.ibaOpenShellPage('im-invoice-entry');
            await handlePOSearch(ids.po);
            setTimeout(() => {
                try { populateInvoiceFormForEditing(ids.key); } catch (e) { console.warn('[approvals] open invoice', e); }
                // The status list has no Approved / Rejected entry; show the
                // current status so an Update without a new status keeps it.
                try {
                    const sel = document.getElementById('im-status');
                    const cur = String(task.status || task.remarks || '').trim();
                    if (sel && cur && !sel.value) {
                        let opt = sel.querySelector('option[data-iba-current]');
                        if (!opt) {
                            opt = document.createElement('option');
                            opt.setAttribute('data-iba-current', '1');
                            sel.insertBefore(opt, sel.firstChild);
                        }
                        opt.value = cur;
                        opt.textContent = cur + ' (current)';
                        sel.value = cur;
                        sel.addEventListener('change', function drop() {
                            if (sel.value !== opt.value) { opt.remove(); sel.removeEventListener('change', drop); }
                        });
                    }
                } catch (_) {}
                try { if (typeof imBackToActiveTaskButton !== 'undefined' && imBackToActiveTaskButton) imBackToActiveTaskButton.classList.remove('hidden'); } catch (_) {}
            }, 200);
        } catch (e) {
            console.warn('[approvals] process', e);
            alert('Could not open this invoice. Please search the PO in Invoice Entry.');
        }
    }

    // Row decoration for the Active Task table (called by app-active-tasks.js)
    function rowActionsHtml(task) {
        if (!task || !isOpenReturn(task)) return '';
        const ids = taskIds(task);
        const approved = statusNorm(task.status || task.remarks) === 'approved';
        let html = '';
        if (approved) {
            html += `<button type="button" class="iba-apv-print-btn wd-row-action wd-action-gold" data-po="${esc(ids.po)}" data-invkey="${esc(ids.key)}" title="Print the approval with its ESN"><i class="fa-solid fa-print"></i> Print</button>`;
        }
        html += `<button type="button" class="iba-apv-process-btn wd-row-action wd-action-process" data-key="${esc(task.key)}" title="Open the invoice to move it to its next step">Process</button>`;
        return html;
    }

    function returnNoteText(task) {
        if (!task || !isOpenReturn(task)) return '';
        const d = task.approvalDecision || {};
        const who = d.name || task.last_approver || task.lastApprover || '';
        const what = statusNorm(task.status || task.remarks) === 'approved' ? 'Approved' : 'Rejected';
        const esn = d.esn ? ` · ESN ${d.esn}` : '';
        const note = task.approvalNote || d.remarks || '';
        return `${what}${who ? ' by ' + who : ''}${esn}${note ? ' — ' + note : ''}`;
    }

    function boot() {
        installInterceptor();
        console.info(`%cIBA approvals ${VERSION} loaded`, 'color:#138A97;font-weight:700');
    }

    window.ibaApprovals = {
        VERSION, MAX_APPROVALS,
        statusNorm, attentionNames, namedForMe, myNames, senderName, isCEOUser,
        waitingKind, canDecide, isOpenReturn, taskIds, pdfUrl, money, esc,
        readRecord, countApprovals, approvalsList,
        decide, prepareStatusSave, loadMyInvoiceApprovals,
        openDialog, closeDialog, printStamp, sendWhatsApp, decisionToast, toast, processReturned,
        rowActionsHtml, returnNoteText
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
