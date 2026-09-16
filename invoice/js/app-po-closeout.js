/* ==========================================================================
   js/app-po-closeout.js
   PO remaining-qty close-out (v12.8.8)

   Two paths:
   1) Automatic — when Site clicks SRV Done and PO value > invoiced value.
   2) Manual "PO Close Out" — Head Office sends old With Accounts / already
      processed invoices back to Site as a dedicated task.
   ========================================================================== */

(function () {
    const EPS = 0.009;
    const STATUS_CLOSEOUT = 'PO Close Out';
    const REMARK_REMOVE = 'Remaining qty to be removed';
    const REMARK_KEEP = 'Remaining qty still needed';
    const INDEX_PATH = 'invoice_tasks_by_user/POCloseOutHO';
    const LOCAL_QUEUE_KEY = 'iba_po_closeout_queue_v1';

    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
        ]);
    }

    function loadLocalQueue() {
        try {
            const raw = localStorage.getItem(LOCAL_QUEUE_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (_) {
            return [];
        }
    }

    function saveLocalQueue(rows) {
        try { localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(rows || [])); } catch (_) {}
    }

    function upsertLocalQueue(row) {
        const key = indexKey(row.poNumber, row.invoiceKey);
        const next = loadLocalQueue().filter(r => indexKey(r.poNumber, r.invoiceKey) !== key);
        next.unshift(row);
        saveLocalQueue(next);
    }

    function removeLocalQueue(poNumber, invoiceKey) {
        const key = indexKey(poNumber, invoiceKey);
        saveLocalQueue(loadLocalQueue().filter(r => indexKey(r.poNumber, r.invoiceKey) !== key));
    }

    function isIrwinSuperAdmin() {
        const name = String((typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? currentApprover.Name : '').trim().toLowerCase();
        const superName = String((typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) ? SUPER_ADMIN_NAME : 'Irwin').trim().toLowerCase();
        return !!name && name === superName;
    }

    function indexKey(poNumber, invoiceKey) {
        return String(poNumber || '').replace(/[.#$[\]]/g, '_') + '__' + String(invoiceKey || '').replace(/[.#$[\]]/g, '_');
    }

    async function writeCloseoutIndex(poNumber, invoiceKey, payload) {
        const key = indexKey(poNumber, invoiceKey);
        if (!key || key === '__') return;
        const body = Object.assign({
            poNumber: String(poNumber || ''),
            invoiceKey: String(invoiceKey || ''),
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        }, payload || {});
        Object.keys(body).forEach((k) => {
            if (body[k] === undefined) delete body[k];
        });
        upsertLocalQueue(body);
        try {
            await withTimeout(invoiceDb.ref(`${INDEX_PATH}/${key}`).set(body), 2000);
        } catch (err) {
            console.warn('PO Close Out remote queue write skipped.', err);
        }
    }

    async function removeCloseoutIndex(poNumber, invoiceKey) {
        const key = indexKey(poNumber, invoiceKey);
        if (!key || key === '__') return;
        removeLocalQueue(poNumber, invoiceKey);
        try {
            await withTimeout(invoiceDb.ref(`${INDEX_PATH}/${key}`).remove(), 2000);
        } catch (err) {
            console.warn('PO Close Out remote queue remove skipped.', err);
        }
    }

    function num(v) {
        if (v === null || v === undefined || v === '') return 0;
        const n = parseFloat(String(v).replace(/,/g, ''));
        return Number.isFinite(n) ? n : 0;
    }

    function money(v) {
        return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function poRecord(poNumber) {
        const po = String(poNumber || '').trim().toUpperCase();
        if (!po) return { po: '', rec: {} };
        const rec = (typeof allPOData !== 'undefined' && allPOData)
            ? (allPOData[po] || allPOData[poNumber] || {})
            : {};
        return { po, rec };
    }

    function poValueOf(poNumber) {
        const { rec } = poRecord(poNumber);
        return num(
            rec.Amount ||
            rec['Amount'] ||
            rec['PO Amount'] ||
            rec['PO Value'] ||
            (rec.poDetails && rec.poDetails.Amount)
        );
    }

    function invoicesOnPO(poNumber) {
        const po = String(poNumber || '').trim().toUpperCase();
        const bucket = (typeof allInvoiceData !== 'undefined' && allInvoiceData)
            ? (allInvoiceData[po] || allInvoiceData[poNumber] || {})
            : {};
        return Object.entries(bucket || {}).map(([key, inv]) => ({ key, inv: inv || {} }));
    }

    function totalInvoicedOnPO(poNumber) {
        return invoicesOnPO(poNumber).reduce((sum, row) => {
            return sum + num(row.inv.invValue || row.inv.invoiceValue || row.inv.amountPaid);
        }, 0);
    }

    function remainingOnPO(poNumber, currentInv) {
        const poVal = poValueOf(poNumber);
        let invVal = totalInvoicedOnPO(poNumber);
        if (invVal <= 0 && currentInv) {
            invVal = num(currentInv.invValue || currentInv.invoiceValue || currentInv.amountPaid);
        }
        return {
            poValue: poVal,
            invoiceValue: invVal,
            remaining: Math.round((poVal - invVal) * 100) / 100
        };
    }

    function isQualified(poNumber, currentInv) {
        const info = remainingOnPO(poNumber, currentInv);
        if (info.poValue <= 0) return false;
        return info.remaining > EPS;
    }

    function alreadyDecided(inv) {
        const c = inv && inv.poCloseout;
        if (!c) return false;
        return c.remainingNeeded === true || c.remainingNeeded === false;
    }

    function ensureModal() {
        let el = document.getElementById('po-closeout-modal');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'po-closeout-modal';
        el.style.cssText = 'display:none;position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.55);align-items:center;justify-content:center;padding:16px;';
        el.innerHTML = `
            <div style="width:min(520px,100%);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.28);overflow:hidden;font-family:inherit;">
                <div style="padding:16px 18px;background:#14293f;color:#fff;">
                    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.75;">PO Close Out</div>
                    <div id="po-closeout-title" style="font-weight:800;font-size:18px;margin-top:4px;">Remaining quantity</div>
                </div>
                <div style="padding:18px;">
                    <p id="po-closeout-copy" style="margin:0 0 14px;color:#334155;line-height:1.45;font-size:14px;"></p>
                    <div id="po-closeout-figures" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;"></div>
                    <p style="margin:0 0 14px;color:#0f172a;font-weight:700;">Is the remaining quantity still needed?</p>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button type="button" id="po-closeout-yes" style="flex:1;min-width:140px;background:#0d7e85;color:#fff;border:0;border-radius:10px;padding:11px 12px;font-weight:800;cursor:pointer;">Yes, keep remaining</button>
                        <button type="button" id="po-closeout-no" style="flex:1;min-width:140px;background:#b45309;color:#fff;border:0;border-radius:10px;padding:11px 12px;font-weight:800;cursor:pointer;">No, remove remaining</button>
                    </div>
                    <button type="button" id="po-closeout-cancel" style="margin-top:12px;width:100%;background:#e2e8f0;color:#0f172a;border:0;border-radius:10px;padding:10px;font-weight:700;cursor:pointer;">Cancel</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        return el;
    }

    function askSiteDecision(info) {
        return new Promise((resolve) => {
            const modal = ensureModal();
            document.getElementById('po-closeout-title').textContent = `PO ${info.poNumber || ''}`.trim();
            document.getElementById('po-closeout-copy').textContent =
                info.mode === 'manual'
                    ? 'Head Office asked Site to confirm the open PO balance before this record stays closed with Accounts.'
                    : 'This invoice does not consume the full PO value. Confirm whether the remaining quantity is still required.';
            document.getElementById('po-closeout-figures').innerHTML = `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">
                    <div style="font-size:11px;color:#64748b;">PO Value</div>
                    <div style="font-weight:800;">QAR ${money(info.poValue)}</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">
                    <div style="font-size:11px;color:#64748b;">Invoiced</div>
                    <div style="font-weight:800;">QAR ${money(info.invoiceValue)}</div>
                </div>
                <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px;">
                    <div style="font-size:11px;color:#9a3412;">Remaining</div>
                    <div style="font-weight:800;color:#9a3412;">QAR ${money(info.remaining)}</div>
                </div>`;
            modal.style.display = 'flex';

            const done = (answer) => {
                modal.style.display = 'none';
                resolve(answer);
            };
            document.getElementById('po-closeout-yes').onclick = () => done(true);
            document.getElementById('po-closeout-no').onclick = () => done(false);
            document.getElementById('po-closeout-cancel').onclick = () => done(null);
        });
    }

    function buildRemark(needed, info) {
        const who = (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name)
            ? currentApprover.Name
            : 'User';
        const when = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const head = needed ? REMARK_KEEP : REMARK_REMOVE;
        return `${head}. PO ${info.poNumber} value QAR ${money(info.poValue)} vs invoiced QAR ${money(info.invoiceValue)} (remaining QAR ${money(info.remaining)}). Confirmed by ${who} on ${when}.`;
    }

    async function writeDecision(poNumber, invoiceKey, inv, needed, info, source) {
        const remark = buildRemark(needed, info);
        const closeout = {
            remainingNeeded: !!needed,
            poValue: info.poValue,
            invoiceValue: info.invoiceValue,
            remainingValue: info.remaining,
            remark,
            confirmedBy: (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? currentApprover.Name : '',
            confirmedAt: firebase.database.ServerValue.TIMESTAMP,
            source: source || 'srv_done',
            status: 'confirmed',
            hoClosed: false
        };
        const updates = {
            poCloseout: closeout,
            poCloseoutPending: null,
            poCloseoutHoPending: needed ? null : true,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        };
        await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates);
        if (typeof updateLocalInvoiceCache === 'function') {
            updateLocalInvoiceCache(poNumber, invoiceKey, updates);
        }
        if (window.logInvoiceHistory) {
            await window.logInvoiceHistory(poNumber, invoiceKey, needed ? 'PO remaining kept' : 'PO remaining to remove', remark);
        }
        try {
            if (needed) {
                removeCloseoutIndex(poNumber, invoiceKey);
            } else {
                writeCloseoutIndex(poNumber, invoiceKey, {
                    waitingSite: false,
                    waitingHo: true,
                    site: siteOf(poNumber, inv),
                    vendor: vendorOf(poNumber, inv),
                    invNumber: inv.invNumber || inv.invoiceNo || '',
                    remark,
                    poValue: info.poValue,
                    invoiceValue: info.invoiceValue,
                    remaining: info.remaining
                });
            }
        } catch (_) {}
        return { remark, updates };
    }

    function headWord(needed) {
        return needed ? REMARK_KEEP : REMARK_REMOVE;
    }

    window.poCloseoutIsQualified = isQualified;
    window.poCloseoutRemaining = remainingOnPO;

    window.poCloseoutIsReadyToClose = function (inv, poNumber) {
        if (!inv) return false;
        const c = inv.poCloseout || {};
        if (c.hoClosed === true || inv.poCloseoutHoClosed === true) return false;
        const po = String(poNumber || inv.po || inv.po_number || inv.poNumber || '').trim().toUpperCase();
        if (po && !isQualified(po, inv)) return false;
        return inv.poCloseoutHoPending === true || (c.status === 'confirmed' && c.remainingNeeded === false);
    };

    window.poCloseoutPOHasReady = function (poNumber) {
        const po = String(poNumber || '').trim().toUpperCase();
        if (!isQualified(po)) return false;
        const bucket = (typeof allInvoiceData !== 'undefined' && allInvoiceData)
            ? (allInvoiceData[po] || allInvoiceData[poNumber] || {})
            : {};
        return Object.values(bucket || {}).some(inv => window.poCloseoutIsReadyToClose(inv, po));
    };

    window.poCloseoutReadyDotHTML = function (invOrPo, invoiceKey) {
        let ready = false;
        if (typeof invOrPo === 'string') {
            ready = window.poCloseoutPOHasReady(invOrPo);
        } else {
            const po = invOrPo && (invOrPo.po || invOrPo.po_number || invOrPo.poNumber);
            ready = window.poCloseoutIsReadyToClose(invOrPo, po) || window.poCloseoutPOHasReady(po);
        }
        if (!ready) return '';
        return `<span class="po-closeout-ready-dot" title="This PO needs close out" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.28);pointer-events:none;"></span>`;
    };

    /**
     * Called from handleSRVDone BEFORE status is written.
     * Returns { proceed: true } after optional prompt, or { proceed: false } if cancelled.
     */
    function askSrvDoneConfirm(poNumber) {
        return new Promise((resolve) => {
            let el = document.getElementById('po-srv-confirm-modal');
            if (!el) {
                el = document.createElement('div');
                el.id = 'po-srv-confirm-modal';
                el.style.cssText = 'display:none;position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.55);align-items:center;justify-content:center;padding:16px;';
                el.innerHTML = `
                    <div style="width:min(460px,100%);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.28);overflow:hidden;font-family:inherit;">
                        <div style="padding:16px 18px;background:#14293f;color:#fff;">
                            <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.75;">Active Task</div>
                            <div id="po-srv-confirm-title" style="font-weight:800;font-size:18px;margin-top:4px;">Confirm SRV Done</div>
                        </div>
                        <div style="padding:18px;">
                            <p id="po-srv-confirm-copy" style="margin:0 0 16px;color:#334155;line-height:1.45;font-size:14px;"></p>
                            <div style="display:flex;gap:8px;">
                                <button type="button" id="po-srv-confirm-ok" style="flex:1;background:#0d7e85;color:#fff;border:0;border-radius:10px;padding:11px 12px;font-weight:800;cursor:pointer;">Proceed</button>
                                <button type="button" id="po-srv-confirm-cancel" style="flex:1;background:#e2e8f0;color:#0f172a;border:0;border-radius:10px;padding:11px 12px;font-weight:800;cursor:pointer;">Cancel</button>
                            </div>
                        </div>
                    </div>`;
                document.body.appendChild(el);
            }
            document.getElementById('po-srv-confirm-title').textContent = poNumber ? `PO ${poNumber}` : 'Confirm SRV Done';
            document.getElementById('po-srv-confirm-copy').textContent =
                'Are you sure this SRV is complete? Click Proceed only if you are ready. Click Cancel if this was pressed by mistake.';
            el.style.display = 'flex';
            const done = (ok) => {
                el.style.display = 'none';
                resolve(!!ok);
            };
            document.getElementById('po-srv-confirm-ok').onclick = () => done(true);
            document.getElementById('po-srv-confirm-cancel').onclick = () => done(false);
            el.onclick = (e) => { if (e.target === el) done(false); };
        });
    }

    window.poCloseoutBeforeSrvDone = async function (poNumber, invoiceKey, invData) {
        try {
            if (!poNumber || !invoiceKey) return { proceed: true };
            if (alreadyDecided(invData) || !isQualified(poNumber, invData)) {
                const ok = await askSrvDoneConfirm(poNumber);
                return { proceed: !!ok };
            }
            const info = { poNumber, ...remainingOnPO(poNumber, invData), mode: 'srv' };
            const needed = await askSiteDecision(info);
            if (needed === null) return { proceed: false };
            await writeDecision(poNumber, invoiceKey, invData || {}, needed, info, 'srv_done');
            return { proceed: true, remainingNeeded: needed };
        } catch (err) {
            console.error('PO close-out prompt failed', err);
            alert('Remaining qty must be confirmed before SRV Done.');
            return { proceed: false };
        }
    };

    /**
     * Site confirmation for a manual PO Close Out task.
     * Restores the previous status (usually With Accounts).
     */
    window.handlePOCloseOutDone = async function (btn, key) {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Processing...';
        }
        try {
            if (typeof ensureInvoiceDataFetched === 'function') await ensureInvoiceDataFetched(false);
            const keyStr = String(key || '').trim();
            const taskFromList = (Array.isArray(userActiveTasks)
                ? (userActiveTasks.find(t => t && String(t.key || '').trim() === keyStr) || {})
                : {});
            let poNumber = String(taskFromList.originalPO || '').trim().toUpperCase();
            let invoiceKey = String(taskFromList.originalKey || '').trim();
            if ((!poNumber || !invoiceKey) && keyStr.includes('_')) {
                const idx = keyStr.indexOf('_');
                poNumber = poNumber || keyStr.slice(0, idx);
                invoiceKey = invoiceKey || keyStr.slice(idx + 1);
            }
            if (!poNumber || !invoiceKey) throw new Error('Invoice not found for PO Close Out.');

            const snap = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).once('value');
            if (!snap.exists()) throw new Error('Invoice entry not found.');
            const invData = snap.val() || {};
            const info = { poNumber, ...remainingOnPO(poNumber), mode: 'manual' };
            const needed = await askSiteDecision(info);
            if (needed === null) return;

            const returnStatus = invData.poCloseoutReturnStatus || 'With Accounts';
            const { remark } = await writeDecision(poNumber, invoiceKey, invData, needed, info, 'manual_po_closeout');
            const updates = {
                status: returnStatus,
                attention: '',
                poCloseoutPending: null,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };
            await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates);
            if (typeof updateInvoiceTaskLookup === 'function') {
                await updateInvoiceTaskLookup(poNumber, invoiceKey, { ...invData, ...updates, status: returnStatus, attention: '' }, invData.attention || '');
            }
            if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(poNumber, invoiceKey, updates);
            if (window.logInvoiceHistory) {
                await window.logInvoiceHistory(poNumber, invoiceKey, returnStatus, remark);
            }
            alert('PO Close Out saved. Task removed from Active Tasks.');
            if (typeof populateActiveTasks === 'function') await populateActiveTasks();
        } catch (error) {
            console.error('PO Close Out failed', error);
            alert(error.message || 'Could not complete PO Close Out.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'PO Close Out';
            }
        }
    };

    function resolveCloseoutSiteCode(poNumber, inv) {
        const { rec } = poRecord(poNumber);
        const raw = String(
            (inv && (inv.site || inv.site_name || inv.siteName || inv.siteId)) ||
            rec['Project ID'] || rec['Project ID:'] || rec['Project'] || rec.Site || rec.site ||
            ''
        ).trim();
        return raw;
    }

    function closeoutRoleRank(position) {
        const p = String(position || '').toLowerCase();
        if (p.includes('site dc') || (p.includes('dc') && !p.includes('cdc'))) return 1;
        if (p.includes('store keeper') || p.includes('storekeeper')) return 2;
        if (p.includes('logistic')) return 3;
        if (p.includes('camp boss')) return 4;
        return 9;
    }

    function allApproverChoices() {
        const src = (typeof allApproverData !== 'undefined' && allApproverData) ? allApproverData : {};
        const arr = Array.isArray(src) ? src : Object.values(src || {});
        const out = [];
        const seen = new Set();
        arr.forEach((u) => {
            if (!u) return;
            const name = String(u.Name || u.name || u.Username || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            out.push({
                name,
                position: String(u.Position || u.position || '').trim(),
                site: String(u.Site || u.site || '').trim()
            });
        });
        return out.sort((a, b) => a.name.localeCompare(b.name));
    }

    async function loadCloseoutCandidates(poNumber, inv) {
        if (typeof ensureApproverDataCached === 'function') {
            try { await ensureApproverDataCached(false); } catch (_) {}
        } else if (typeof imBatchEnsureApproverData === 'function') {
            try { await imBatchEnsureApproverData(); } catch (_) {}
        }
        const siteCode = resolveCloseoutSiteCode(poNumber, inv);
        const group = (inv && (inv.group || inv.invoiceGroup)) || '';
        let suggested = [];
        if (typeof imBatchGetAttentionCandidatesForSRV === 'function') {
            suggested = await imBatchGetAttentionCandidatesForSRV(siteCode, group);
        } else if (typeof getSiteMatchedAttentionCandidatesForSRV === 'function') {
            suggested = getSiteMatchedAttentionCandidatesForSRV(siteCode);
        }
        suggested = (suggested || []).filter(c => c && c.name && !c.isFallback);
        suggested.sort((a, b) => closeoutRoleRank(a.position) - closeoutRoleRank(b.position) || String(a.name).localeCompare(String(b.name)));
        return { siteCode, suggested, everyone: allApproverChoices() };
    }

    function pickPOCloseOutAttention(poNumber, inv) {
        return new Promise(async (resolve) => {
            const { siteCode, suggested, everyone } = await loadCloseoutCandidates(poNumber, inv);
            const suggestedNames = new Set(suggested.map(c => String(c.name).toLowerCase()));
            const autoName = suggested.length === 1 ? suggested[0].name : '';

            const existing = document.getElementById('po-closeout-attention-picker');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'po-closeout-attention-picker';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:13000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;';
            overlay.innerHTML = `
                <div style="width:min(460px,100%);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.28);overflow:hidden;">
                    <div style="padding:16px 18px;background:#14293f;color:#fff;">
                        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.75;">Send PO Close Out</div>
                        <div style="font-weight:800;font-size:18px;margin-top:4px;">Select Site person</div>
                        <div style="font-size:12px;opacity:.8;margin-top:4px;">Site ${siteCode || 'unknown'} · DC first, then Storekeeper, then Logistic</div>
                    </div>
                    <div style="padding:16px 18px 18px;">
                        <input id="po-closeout-attn-search" type="text" placeholder="Type a name to search..." style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font-size:14px;margin-bottom:10px;">
                        <select id="po-closeout-attn-select" size="6" style="width:100%;height:168px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:4px 6px;font-size:13px;line-height:1.4;"></select>
                        <div style="display:flex;gap:8px;margin-top:12px;">
                            <button type="button" id="po-closeout-attn-ok" style="flex:1;background:#0d7e85;color:#fff;border:0;border-radius:10px;padding:10px;font-weight:800;cursor:pointer;">Send to this person</button>
                            <button type="button" id="po-closeout-attn-cancel" style="flex:1;background:#e2e8f0;color:#0f172a;border:0;border-radius:10px;padding:10px;font-weight:700;cursor:pointer;">Cancel</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            const search = overlay.querySelector('#po-closeout-attn-search');
            const select = overlay.querySelector('#po-closeout-attn-select');

            const fill = (query) => {
                const q = String(query || '').trim().toLowerCase();
                const suggestedFiltered = suggested.filter(c => {
                    const hay = `${c.name} ${c.position}`.toLowerCase();
                    return !q || hay.includes(q);
                });
                const manual = everyone.filter(c => {
                    if (suggestedNames.has(c.name.toLowerCase())) return false;
                    const hay = `${c.name} ${c.position} ${c.site}`.toLowerCase();
                    return !q || hay.includes(q);
                });
                const opts = [];
                if (suggestedFiltered.length) {
                    opts.push(`<optgroup label="Suggested for this site">`);
                    suggestedFiltered.forEach((c) => {
                        const role = c.position ? ` — ${c.position}` : '';
                        opts.push(`<option value="${c.name.replace(/"/g, '&quot;')}">${c.name}${role}</option>`);
                    });
                    opts.push(`</optgroup>`);
                }
                if (manual.length) {
                    opts.push(`<optgroup label="All names (type to search)">`);
                    manual.forEach((c) => {
                        const role = c.position ? ` — ${c.position}` : '';
                        opts.push(`<option value="${c.name.replace(/"/g, '&quot;')}">${c.name}${role}</option>`);
                    });
                    opts.push(`</optgroup>`);
                }
                select.innerHTML = opts.join('') || '<option value="">No matching name</option>';
                if (autoName && Array.from(select.options).some(o => o.value === autoName)) {
                    select.value = autoName;
                } else if (select.options.length && select.options[0].value) {
                    select.selectedIndex = 0;
                }
            };

            fill('');
            if (autoName) search.placeholder = `Auto: ${autoName} — type to pick someone else`;
            search.addEventListener('input', () => fill(search.value));
            search.focus();

            const finish = (name) => {
                overlay.remove();
                resolve(name || '');
            };
            overlay.querySelector('#po-closeout-attn-ok').onclick = () => finish(select.value);
            overlay.querySelector('#po-closeout-attn-cancel').onclick = () => finish('');
            overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(''); });
            select.addEventListener('dblclick', () => finish(select.value));
        });
    }

    /**
     * Head Office: send an old invoice back to Site for remaining-qty confirmation.
     * Does not change payment status permanently — stores return status and
     * temporarily sets status to "PO Close Out" so it appears in Site tasks.
     */
    window.sendPOCloseOutToSite = async function (poNumber, invoiceKey) {
        try {
            if (!isIrwinSuperAdmin()) {
                alert('Access Denied: Only Super Admin can send PO Close Out.');
                return;
            }
            poNumber = String(poNumber || '').trim().toUpperCase();
            invoiceKey = String(invoiceKey || '').trim();
            if (!poNumber || !invoiceKey) {
                alert('Select an invoice first.');
                return;
            }
            if (!isQualified(poNumber)) {
                alert('This PO is not qualified. PO value matches invoiced value (no remaining balance).');
                return;
            }
            const snap = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).once('value');
            if (!snap.exists()) {
                alert('Invoice entry not found.');
                return;
            }
            const inv = snap.val() || {};
            const currentStatus = String(inv.status || '').trim();
            const alreadyWaiting = String(currentStatus).toLowerCase() === STATUS_CLOSEOUT.toLowerCase() || !!inv.poCloseoutPending;

            const attention = String(await pickPOCloseOutAttention(poNumber, inv) || '').trim();
            if (!attention) {
                alert('PO Close Out was cancelled. A Site Attention person is required.');
                return;
            }

            const updates = {
                poCloseoutReturnStatus: alreadyWaiting
                    ? (inv.poCloseoutReturnStatus || currentStatus || 'With Accounts')
                    : ((String(currentStatus).toLowerCase() === STATUS_CLOSEOUT.toLowerCase())
                        ? (inv.poCloseoutReturnStatus || 'With Accounts')
                        : (currentStatus || 'With Accounts')),
                poCloseoutPending: true,
                poCloseoutRequestedBy: (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? currentApprover.Name : '',
                poCloseoutRequestedAt: firebase.database.ServerValue.TIMESTAMP,
                status: STATUS_CLOSEOUT,
                attention,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };
            await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates);
            if (typeof updateInvoiceTaskLookup === 'function') {
                await updateInvoiceTaskLookup(poNumber, invoiceKey, { ...inv, ...updates }, inv.attention || '');
            }
            if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(poNumber, invoiceKey, updates);
            if (window.logInvoiceHistory) {
                await window.logInvoiceHistory(poNumber, invoiceKey, STATUS_CLOSEOUT, `Sent to ${attention} for remaining qty confirmation. Return status: ${updates.poCloseoutReturnStatus}.`);
            }
            try {
                const info = remainingOnPO(poNumber);
                await writeCloseoutIndex(poNumber, invoiceKey, {
                    waitingSite: true,
                    waitingHo: false,
                    site: siteOf(poNumber, inv),
                    vendor: vendorOf(poNumber, inv),
                    invNumber: inv.invNumber || inv.invoiceNo || '',
                    attention,
                    poValue: info.poValue,
                    invoiceValue: info.invoiceValue,
                    remaining: info.remaining
                });
            } catch (_) {}
            alert(`PO Close Out sent to ${attention}. It is now on your PO Close Out list as Waiting Site, and on their Active Tasks.`);
            if (typeof window.renderPOCloseOutList === 'function') {
                window.renderPOCloseOutList(false);
            }
            if (typeof fetchAndDisplayInvoices === 'function' && typeof currentPO !== 'undefined' && currentPO) {
                fetchAndDisplayInvoices(currentPO);
            }
        } catch (error) {
            console.error('sendPOCloseOutToSite failed', error);
            alert('Could not send PO Close Out. Please try again.');
        }
    };

    function siteOf(poNumber, inv) {
        const { rec } = poRecord(poNumber);
        return String(
            inv.site || inv.site_name || inv.siteName ||
            rec['Project ID'] || rec['Project'] || rec.site || ''
        ).trim();
    }

    function vendorOf(poNumber, inv) {
        const { rec } = poRecord(poNumber);
        return String(
            inv.vendorName || inv.vendor_name || inv.vendor ||
            rec['Supplier Name'] || rec.Supplier || ''
        ).trim();
    }

    function rowsFromCache() {
        const rows = [];
        const data = (typeof allInvoiceData !== 'undefined' && allInvoiceData) ? allInvoiceData : {};
        Object.keys(data).forEach((poNumber) => {
            const bucket = data[poNumber] || {};
            Object.keys(bucket).forEach((invoiceKey) => {
                const inv = bucket[invoiceKey] || {};
                const c = inv.poCloseout || {};
                const waitingSite = !!inv.poCloseoutPending || String(inv.status || '').toLowerCase() === 'po close out';
                const waitingHo = inv.poCloseoutHoPending === true || (c.status === 'confirmed' && c.remainingNeeded === false && c.hoClosed !== true);
                if (c.hoClosed === true || inv.poCloseoutHoClosed === true) return;
                if (!waitingSite && !waitingHo) return;
                const info = remainingOnPO(poNumber);
                rows.push({
                    poNumber,
                    invoiceKey,
                    site: siteOf(poNumber, inv),
                    vendor: vendorOf(poNumber, inv),
                    invNumber: inv.invNumber || inv.invoiceNo || '',
                    remaining: info.remaining,
                    poValue: info.poValue,
                    invoiceValue: info.invoiceValue,
                    waitingSite,
                    waitingHo,
                    remark: c.remark || inv.note || '',
                    attention: inv.attention || '',
                    confirmedBy: c.confirmedBy || ''
                });
            });
        });
        return rows;
    }

    function rowFromInvoice(poNumber, invoiceKey, inv, extra) {
        const c = (inv && inv.poCloseout) || {};
        const hoClosed = c.hoClosed === true || !!(inv && inv.poCloseoutHoClosed);
        const statusIsCloseout = String((inv && inv.status) || '').toLowerCase() === 'po close out';
        const waitingHo = !hoClosed && (
            !!(inv && inv.poCloseoutHoPending) ||
            (c.status === 'confirmed' && c.remainingNeeded === false)
        );
        const waitingSite = !hoClosed && !waitingHo && statusIsCloseout;
        const info = remainingOnPO(poNumber);
        return {
            poNumber,
            invoiceKey,
            site: extra && extra.site || siteOf(poNumber, inv || {}),
            vendor: extra && extra.vendor || vendorOf(poNumber, inv || {}),
            invNumber: extra && extra.invNumber || inv.invNumber || inv.invoiceNo || '',
            remaining: extra && extra.remaining != null ? num(extra.remaining) : info.remaining,
            poValue: extra && extra.poValue != null ? num(extra.poValue) : info.poValue,
            invoiceValue: extra && extra.invoiceValue != null ? num(extra.invoiceValue) : info.invoiceValue,
            waitingSite: waitingSite && !hoClosed,
            waitingHo: waitingHo && !hoClosed,
            remark: extra && extra.remark || c.remark || inv.note || '',
            attention: extra && extra.attention || inv.attention || '',
            confirmedBy: extra && extra.confirmedBy || c.confirmedBy || '',
            hoClosed
        };
    }

    async function collectCloseoutRows() {
        const merged = new Map();
        const add = (row) => {
            if (!row || !row.poNumber || !row.invoiceKey) return;
            if (row.hoClosed) return;
            if (!row.waitingSite && !row.waitingHo) return;
            merged.set(indexKey(row.poNumber, row.invoiceKey), row);
        };
        loadLocalQueue().forEach(add);
        rowsFromCache().forEach(add);

        const pointers = Array.from(merged.values());
        await Promise.all(pointers.map(async (row) => {
            try {
                const cached = (typeof allInvoiceData !== 'undefined' && allInvoiceData
                    && allInvoiceData[row.poNumber] && allInvoiceData[row.poNumber][row.invoiceKey])
                    ? allInvoiceData[row.poNumber][row.invoiceKey]
                    : null;
                const inv = cached || ((await withTimeout(
                    invoiceDb.ref(`invoice_entries/${row.poNumber}/${row.invoiceKey}`).once('value'),
                    2500
                )).val() || {});
                if (cached || inv) {
                    const live = rowFromInvoice(row.poNumber, row.invoiceKey, inv || {}, row);
                    if (!live.waitingSite && !live.waitingHo) {
                        removeLocalQueue(row.poNumber, row.invoiceKey);
                        merged.delete(indexKey(row.poNumber, row.invoiceKey));
                    } else {
                        add(live);
                    }
                }
            } catch (_) {}
        }));

        return Array.from(merged.values()).filter(r => !r.hoClosed && (r.waitingSite || r.waitingHo));
    }

    function bindListControls() {
        const search = document.getElementById('im-po-closeout-search');
        const siteSel = document.getElementById('im-po-closeout-site-sort');
        const searchBtn = document.getElementById('im-po-closeout-search-btn');
        const clearBtn = document.getElementById('im-po-closeout-clear-btn');
        if (search && !search.dataset.bound) {
            search.dataset.bound = '1';
            search.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    window.renderPOCloseOutList(false);
                }
            });
        }
        if (siteSel && !siteSel.dataset.bound) {
            siteSel.dataset.bound = '1';
            siteSel.addEventListener('change', () => window.renderPOCloseOutList(false));
        }
        if (searchBtn && !searchBtn.dataset.bound) {
            searchBtn.dataset.bound = '1';
            searchBtn.addEventListener('click', () => window.renderPOCloseOutList(false));
        }
        if (clearBtn && !clearBtn.dataset.bound) {
            clearBtn.dataset.bound = '1';
            clearBtn.addEventListener('click', () => {
                if (search) search.value = '';
                if (siteSel) siteSel.value = '';
                window.renderPOCloseOutList(false);
            });
        }
        const tabWaiting = document.getElementById('im-po-closeout-tab-waiting');
        const tabReady = document.getElementById('im-po-closeout-tab-ready');
        const applyTabStyle = () => {
            const tab = window._poCloseoutTab || 'waiting';
            if (tabWaiting) tabWaiting.className = tab === 'waiting' ? 'primary-btn' : 'secondary-btn';
            if (tabReady) tabReady.className = tab === 'ready' ? 'primary-btn' : 'secondary-btn';
        };
        if (tabWaiting && !tabWaiting.dataset.bound) {
            tabWaiting.dataset.bound = '1';
            tabWaiting.addEventListener('click', () => {
                window._poCloseoutTab = 'waiting';
                applyTabStyle();
                window.renderPOCloseOutList(false);
            });
        }
        if (tabReady && !tabReady.dataset.bound) {
            tabReady.dataset.bound = '1';
            tabReady.addEventListener('click', () => {
                window._poCloseoutTab = 'ready';
                applyTabStyle();
                window.renderPOCloseOutList(false);
            });
        }
        applyTabStyle();
    }

    window.renderPOCloseOutList = async function (forceFetch) {
        bindListControls();
        const listEl = document.getElementById('im-po-closeout-list');
        const countEl = document.getElementById('po-closeout-count-display');
        const siteSel = document.getElementById('im-po-closeout-site-sort');
        const searchEl = document.getElementById('im-po-closeout-search');
        if (!listEl) return;
        if (!isIrwinSuperAdmin()) {
            listEl.innerHTML = '<p style="color:#64748b;">PO Close Out is Super Admin only.</p>';
            return;
        }
        listEl.innerHTML = '<p style="color:#64748b;">Loading PO Close Out list...</p>';
        let rows = [];
        try {
            rows = await collectCloseoutRows();
        } catch (err) {
            console.error(err);
            listEl.innerHTML = '<p style="color:#b45309;">Could not load the close-out queue.</p>';
            return;
        }
        const sites = Array.from(new Set(rows.map(r => r.site).filter(Boolean))).sort((a, b) => a.localeCompare(b));
        if (siteSel) {
            const current = siteSel.value;
            siteSel.innerHTML = '<option value="">All Sites</option>' + sites.map(s => `<option value="${s.replace(/"/g, '&quot;')}">${s}</option>`).join('');
            if (current && sites.includes(current)) siteSel.value = current;
        }
        const q = String(searchEl && searchEl.value || '').trim().toLowerCase();
        const siteFilter = String(siteSel && siteSel.value || '').trim().toLowerCase();
        rows = rows.filter((r) => {
            if (siteFilter && String(r.site || '').toLowerCase() !== siteFilter) return false;
            if (!q) return true;
            const hay = [r.poNumber, r.invNumber, r.vendor, r.site, r.remark, r.attention, r.confirmedBy].join(' ').toLowerCase();
            return hay.includes(q);
        });
        rows.sort((a, b) => String(a.site || '').localeCompare(String(b.site || '')) || String(a.poNumber).localeCompare(String(b.poNumber)));
        const tab = window._poCloseoutTab || 'waiting';
        const waitingCount = rows.filter(r => r.waitingSite).length;
        const readyCount = rows.filter(r => r.waitingHo).length;
        rows = rows.filter(r => tab === 'ready' ? r.waitingHo : r.waitingSite);
        const tabWaiting = document.getElementById('im-po-closeout-tab-waiting');
        const tabReady = document.getElementById('im-po-closeout-tab-ready');
        if (tabWaiting) tabWaiting.textContent = `Waiting Site (${waitingCount})`;
        if (tabReady) tabReady.textContent = `Ready to close (${readyCount})`;

        if (countEl) countEl.textContent = `(${rows.length})`;
        if (!rows.length) {
            listEl.innerHTML = tab === 'ready'
                ? '<p style="color:#64748b;">No items ready to close. After Site answers “No, remove remaining”, they appear in this tab.</p>'
                : '<p style="color:#64748b;">No waiting Site requests. Send PO Close Out from Invoice Records and it will show here until they answer.</p>';
            return;
        }

        listEl.innerHTML = rows.map((r) => {
            const state = r.waitingHo
                ? '<span style="background:#fff7ed;color:#9a3412;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;">Ready to close</span>'
                : '<span style="background:#e2e8f0;color:#334155;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;">Waiting Site</span>';
            const canDone = !!r.waitingHo;
            const btn = canDone
                ? `<button type="button" class="primary-btn" onclick="window.markPOCloseOutHoDone('${r.poNumber}','${r.invoiceKey}')">Close Out Done</button>`
                : `<button type="button" class="secondary-btn" onclick="window.sendPOCloseOutToSite('${r.poNumber}','${r.invoiceKey}')">Reassign</button>`;
            return `
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
                        <div>
                            <div style="font-weight:800;font-size:16px;color:#14293f;">PO ${r.poNumber} · Inv ${r.invNumber || '—'}</div>
                            <div style="color:#64748b;font-size:13px;margin-top:4px;">${r.site || 'No site'} · ${r.vendor || 'No vendor'}</div>
                            <div style="margin-top:8px;font-size:13px;color:#334155;">PO QAR ${money(r.poValue)} · Invoiced QAR ${money(r.invoiceValue)} · Remaining QAR ${money(r.remaining)}</div>
                            <div style="margin-top:6px;font-size:12px;color:#0f172a;">${r.remark || (r.waitingSite ? ('Sent to ' + (r.attention || 'Site')) : '')}</div>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
                            ${state}
                            ${btn}
                        </div>
                    </div>
                </div>`;
        }).join('');
    };

    window.markPOCloseOutHoDone = async function (poNumber, invoiceKey) {
        try {
            poNumber = String(poNumber || '').trim().toUpperCase();
            invoiceKey = String(invoiceKey || '').trim();
            if (!poNumber || !invoiceKey) return;
            if (!isIrwinSuperAdmin()) {
                alert('Access Denied: PO Close Out is Super Admin only.');
                return;
            }
            if (!confirm(`Mark PO ${poNumber} close-out as done and remove it from this list?`)) return;
            const snap = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).once('value');
            const inv = snap.val() || {};
            const closeout = Object.assign({}, inv.poCloseout || {}, {
                hoClosed: true,
                hoClosedBy: (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? currentApprover.Name : '',
                hoClosedAt: firebase.database.ServerValue.TIMESTAMP
            });
            const returnStatus = String(inv.poCloseoutReturnStatus || '').trim()
                || (String(inv.status || '').trim().toLowerCase() === 'po close out' ? 'With Accounts' : String(inv.status || 'With Accounts').trim())
                || 'With Accounts';
            const updates = {
                poCloseout: closeout,
                poCloseoutHoPending: null,
                poCloseoutHoClosed: true,
                status: returnStatus,
                attention: '',
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };
            await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates);
            await removeCloseoutIndex(poNumber, invoiceKey);
            if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(poNumber, invoiceKey, updates);
            if (window.logInvoiceHistory) {
                await window.logInvoiceHistory(poNumber, invoiceKey, returnStatus || 'With Accounts', 'Head Office marked remaining qty close-out finished.');
            }
            await window.renderPOCloseOutList(false);
        } catch (error) {
            console.error('markPOCloseOutHoDone failed', error);
            alert('Could not mark Close Out Done.');
        }
    };
})();
