// =================================================================================================
// app-invoice.js — Invoice Management helper foundation
// Version 7.6.1
//
// This file is intentionally limited to safe Invoice helper functions.
// Main Invoice tasking, approval, Firebase writes, and form workflows remain in app.js for now.
// =================================================================================================

function getInvoiceHandlerName() {
    const vac = getActiveVacationConfig();
    return (vac && vac.replacementName) ? vac.replacementName : SUPER_ADMIN_NAME;
}


function isInvoiceTaskActive(invoiceData) {
    if (!invoiceData) return false;

    // We REMOVED 'Approved' and 'Rejected' from this list.
    // Now, they are considered ACTIVE so they can be sent back to the sender.
    const inactiveStatuses = [
        'With Accounts',
        'SRV Done',
        'Paid',
        'On Hold',
        'CLOSED',
        'Cancelled'
    ];

    if (inactiveStatuses.includes(invoiceData.status)) {
        return false;
    }
    // Must have an attention person assigned
    return !!invoiceData.attention;
}


const __invoicePOCache = new Map();


function __normalizePOKey(poNumber) {
    const po = String(poNumber || '').trim();
    if (!po) return '';
    return po.toUpperCase();
}


function __normalizePODetails(raw) {
    const d = raw || {};
    const supplier =
        d['Supplier Name'] || d['Supplier Name:'] || d['Supplier'] || d['Supplier:'] ||
        d['supplier name'] || d['supplier'] || d['SUPPLIER NAME'] || d['SUPPLIER'] || '';
    const projectId =
        d['Project ID'] || d['Project ID:'] || d['Project'] || d['Project:'] ||
        d['project id'] || d['PROJECT ID'] || '';
    const amount =
        d['Amount'] || d['amount'] || d.Amount || d.AMOUNT || '';

    const supplierId =
        d['Supplier ID'] || d['Supplier ID:'] || d['SupplierID'] || d['Supplier Id'] ||
        d['supplier id'] || d['SUPPLIER ID'] || d['Vendor ID'] || d['vendorId'] || d['vendor_id'] || '';

    // Return a merged object but ensure canonical keys exist
    return {
        ...d,
        'Supplier Name': supplier || d['Supplier Name'] || d['Supplier'] || '',
        'Supplier ID': supplierId || d['Supplier ID'] || d['Vendor ID'] || '',
        'Project ID': projectId || d['Project ID'] || '',
        'Amount': amount || d['Amount'] || ''
    };
}


async function getInvoicePurchaseOrderDetails(poNumber) {
    const poKey = __normalizePOKey(poNumber);
    if (!poKey) return {};

    if (__invoicePOCache.has(poKey)) return __invoicePOCache.get(poKey);

    // 1) Memory (POVALUE2.csv -> allPOData)
    let details = (typeof allPOData !== 'undefined' && allPOData && allPOData[poKey]) ? allPOData[poKey] : null;

    // 2) Firebase RTDB fallback (invoiceentry-b15a8 / purchase_orders)
    if ((!details || Object.keys(details).length === 0) && typeof invoiceDb !== 'undefined' && invoiceDb) {
        try {
            // A) Direct key: purchase_orders/<PO>
            const directSnap = await invoiceDb.ref(`purchase_orders/${poKey}`).once('value');
            if (directSnap.exists()) details = directSnap.val();
        } catch (_) { /* ignore */ }

        // B) Query by child "Po" or "PO" if the records are stored under push-ids
        if (!details || Object.keys(details).length === 0) {
            const tryQuery = async (child, value) => {
                try {
                    const snap = await invoiceDb.ref('purchase_orders').orderByChild(child).equalTo(value).once('value');
                    if (snap.exists()) {
                        const obj = snap.val() || {};
                        const firstKey = Object.keys(obj)[0];
                        return firstKey ? obj[firstKey] : null;
                    }
                } catch (_) { /* ignore */ }
                return null;
            };

            details = await tryQuery('Po', poKey) ||
                      await tryQuery('PO', poKey) ||
                      await tryQuery('po', poKey) ||
                      null;

            // Some DBs store Po as number. Try numeric query too.
            if ((!details || Object.keys(details).length === 0) && /^\d+$/.test(poKey)) {
                const n = Number(poKey);
                details = await tryQuery('Po', n) || await tryQuery('PO', n) || await tryQuery('po', n) || details;
            }
        }
    }

    const normalized = __normalizePODetails(details || {});
    __invoicePOCache.set(poKey, normalized);
    return normalized;
}


async function ensurePORecordInInvoiceDb(poNumber) {
    try {
        if (!poNumber || typeof invoiceDb === 'undefined' || !invoiceDb) return;
        const po = String(poNumber).trim().toUpperCase();
        if (!po) return;

        // Avoid hammering the DB: only sync each PO once per session
        if (typeof ensuredPOInInvoiceDb !== 'undefined' && ensuredPOInInvoiceDb.has(po)) return;
        if (typeof ensuredPOInInvoiceDb !== 'undefined') ensuredPOInInvoiceDb.add(po);

        const mem = (allPOData && allPOData[po]) ? allPOData[po] : null;

        // Quick exit if we have nothing to sync
        if (!mem) {
            // Still check if an older record exists with colon-keys and normalize it once
            const snap = await invoiceDb.ref(`purchase_orders/${po}`).once('value');
            const existing = snap.val();
            if (existing && existing['Project ID:'] && !existing['Project ID']) {
                await invoiceDb.ref(`purchase_orders/${po}`).update({ 'Project ID': existing['Project ID:'] });
            }
            if (existing && existing['Supplier Name:'] && !existing['Supplier Name']) {
                await invoiceDb.ref(`purchase_orders/${po}`).update({ 'Supplier Name': existing['Supplier Name:'] });
            }
            if (existing && existing['Supplier'] && !existing['Supplier Name']) {
                await invoiceDb.ref(`purchase_orders/${po}`).update({ 'Supplier Name': existing['Supplier'] });
            }
            return;
        }

        const supplier = mem['Supplier Name'] || mem['Supplier Name:'] || mem['Supplier'] || mem['Supplier:'] || '';
        const projectId = mem['Project ID'] || mem['Project ID:'] || '';
        const amount = mem.Amount || mem['Amount'] || '';
        const supplierId = mem['Supplier ID'] || mem['Supplier ID:'] || mem['SupplierID'] || mem['Vendor ID'] || mem.vendorId || mem.vendor_id || '';

        const ref = invoiceDb.ref(`purchase_orders/${po}`);
        const snap = await ref.once('value');
        const existing = snap.val();

        // Build minimal upsert payload (only what you asked for + safe extras)
        const upsert = {};
        if (!existing) upsert['PO'] = po;
        if (supplier) { upsert['Supplier Name'] = supplier; upsert['Supplier'] = supplier; }
        if (projectId) upsert['Project ID'] = projectId;
        if (supplierId) upsert['Supplier ID'] = supplierId;
        if (amount && (!existing || !existing.Amount)) upsert['Amount'] = amount;
        if (!existing) upsert['IsManual'] = false;

        if (Object.keys(upsert).length > 0) {
            await ref.update(upsert);
        }
    } catch (err) {
        console.warn("PO auto-sync to purchase_orders failed:", err);
    }
}


function imGetAppBaseUrl() {
    try {
        const u = new URL(window.location.href);
        // keep pathname, remove query/hash
        u.search = '';
        u.hash = '';
        return u.toString();
    } catch (e) {
        return (window.location.origin || '') + (window.location.pathname || '/');
    }
}


function imBuildInvoiceDeepLink(poNumber, invoiceKey) {
    const base = imGetAppBaseUrl();
    const u = new URL(base);
    u.searchParams.set('open', 'invoice');
    u.searchParams.set('po', String(poNumber || '').trim());
    u.searchParams.set('invKey', String(invoiceKey || '').trim());
    return u.toString();
}


function wdBuildActiveTaskDeepLink(poNumber, invoiceKey) {
    const base = imGetAppBaseUrl();
    const u = new URL(base);
    u.searchParams.set('open', 'wdtask');
    u.searchParams.set('po', String(poNumber || '').trim());
    u.searchParams.set('invKey', String(invoiceKey || '').trim());
    return u.toString();
}


function wdParseActiveTaskDeepLinkFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const open = (params.get('open') || '').toLowerCase();
        if (open !== 'wdtask') return null;
        const po = (params.get('po') || '').trim();
        const invKey = (params.get('invKey') || params.get('invoiceKey') || '').trim();
        if (!po || !invKey) return null;
        return { po, invKey };
    } catch (e) {
        return null;
    }
}


function wdClearActiveTaskDeepLinkFromUrl() {
    try {
        const u = new URL(window.location.href);
        u.searchParams.delete('open');
        u.searchParams.delete('po');
        u.searchParams.delete('invKey');
        u.searchParams.delete('invoiceKey');
        window.history.replaceState({}, document.title, u.toString());
    } catch (e) { /* ignore */ }
}


function imParseInvoiceDeepLinkFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const open = (params.get('open') || '').toLowerCase();
        if (open !== 'invoice') return null;
        const po = (params.get('po') || '').trim();
        const invKey = (params.get('invKey') || params.get('invoiceKey') || '').trim();
        if (!po || !invKey) return null;
        return { po, invKey };
    } catch (e) {
        return null;
    }
}


function imClearInvoiceDeepLinkFromUrl() {
    try {
        const u = new URL(window.location.href);
        u.searchParams.delete('open');
        u.searchParams.delete('po');
        u.searchParams.delete('invKey');
        u.searchParams.delete('invoiceKey');
        window.history.replaceState({}, document.title, u.toString());
    } catch (e) { /* ignore */ }
}


// End app-invoice.js


// =================================================================================================
// 7.6.1 — Invoice Records totals helper moved from app.js
// =================================================================================================
// ==========================================================================
// IM: Invoice Records Totals Footer (Desktop & Mobile)
// - Shows Total Invoice Value, Total Amount Paid, and Total Balance
// - Not part of the table (separate footer card)
// - No workflow/rules changes; display-only
// ==========================================================================
function imUpdateInvoiceRecordsTotals(reportData) {
    const card = document.getElementById('im-reporting-totals-card');
    const elInv = document.getElementById('im-reporting-total-inv-value');
    const elPaid = document.getElementById('im-reporting-total-paid-value');
    const elBal = document.getElementById('im-reporting-total-balance-value');

    if (!card || !elInv || !elPaid || !elBal) return;

    // Reset styles
    elBal.classList.remove('im-total-owed', 'im-total-ok');

    if (!Array.isArray(reportData) || reportData.length === 0) {
        card.classList.add('hidden');
        elInv.textContent = '---';
        elPaid.textContent = '---';
        elBal.textContent = '---';
        return;
    }

    // Permission logic: keep consistent with existing Invoice Records amounts visibility
    const userRole = (currentApprover?.Role || '').toLowerCase();
    const userPos = (currentApprover?.Position || '').trim().toLowerCase();
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const canViewAmounts = (userRole === 'admin' || userPos === 'accounting' || isVacationDelegate);

    let totalInv = 0;
    let totalPaid = 0;

    // Match the same paid-calculation rule used in the per-PO nested footer:
    // exclude 'retention' unless the paid total equals invoice total.
    reportData.forEach(poData => {
        const list = Array.isArray(poData?.filteredInvoices) ? poData.filteredInvoices : [];
        let poInv = 0;
        let paidWithRetention = 0;
        let paidWithoutRetention = 0;

        list.forEach(inv => {
            const invValue = parseFloat(inv?.invValue) || 0;
            const amountPaid = parseFloat(inv?.amountPaid) || 0;
            const noteText = String(inv?.note || '').toLowerCase();

            poInv += invValue;
            paidWithRetention += amountPaid;
            if (!noteText.includes('retention')) {
                paidWithoutRetention += amountPaid;
            }
        });

        let finalPaid = paidWithoutRetention;
        if (Math.abs(paidWithRetention - poInv) < 0.01) finalPaid = paidWithRetention;

        totalInv += poInv;
        totalPaid += finalPaid;
    });

    const totalBalance = totalInv - totalPaid;

    if (canViewAmounts) {
        elInv.textContent = `QAR ${formatCurrency(totalInv)}`;
        elPaid.textContent = `QAR ${formatCurrency(totalPaid)}`;
        elBal.textContent = `QAR ${formatCurrency(totalBalance)}`;

        // Red if still owed, Green if settled/overpaid (tolerance)
        if (totalBalance > 0.05) elBal.classList.add('im-total-owed');
        else elBal.classList.add('im-total-ok');
    } else {
        elInv.textContent = '---';
        elPaid.textContent = '---';
        elBal.textContent = '---';
    }

    card.classList.remove('hidden');
}

// ========================================================================== 
// IM: WhatsApp Share + Deep Link Helpers
// - Adds an optional "Send WhatsApp" action in Invoice Records (no workflow changes)
// - Deep link can open a specific invoice after login (if user has access)
// ==========================================================================

// imGetAppBaseUrl moved to js/app-invoice.js (7.6.1)

// imBuildInvoiceDeepLink moved to js/app-invoice.js (7.6.1)

// --- Deep Link (Workdesk Active Task) ---
// Shared via WhatsApp: opens Workdesk -> Active Task and focuses the invoice task.
// wdBuildActiveTaskDeepLink moved to js/app-invoice.js (7.6.1)


// wdParseActiveTaskDeepLinkFromUrl moved to js/app-invoice.js (7.6.1)

// wdClearActiveTaskDeepLinkFromUrl moved to js/app-invoice.js (7.6.1)

async function wdOpenActiveTaskFromDeepLink(po, invKey) {
    // Must be logged in
    if (!currentApprover) return;

    // Navigate to Workdesk
    try { workdeskButton.click(); } catch (e) { /* ignore */ }

    // Wait for Workdesk view + nav to render
    setTimeout(async () => {
        try {
            const activeTaskLink = (typeof workdeskNav !== 'undefined' && workdeskNav) ? workdeskNav.querySelector('a[data-section="wd-activetask"]') : null;
            if (activeTaskLink) activeTaskLink.click();

            // Ensure data is loaded and tasks are populated
            if (typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched();
            if (typeof ensureInvoiceDataFetched === 'function') await ensureInvoiceDataFetched(false);
            if (typeof populateActiveTasks === 'function') await populateActiveTasks();

            // Filter by PO for quick find
            const poStr = String(po || '').trim();
            if (typeof activeTaskSearchInput !== 'undefined' && activeTaskSearchInput) {
                activeTaskSearchInput.value = poStr;
                try { sessionStorage.setItem('activeTaskSearch', poStr); } catch (e) {}
            }
            if (typeof handleActiveTaskSearch === 'function') {
                handleActiveTaskSearch(poStr);
            }

            // Focus the exact row (invoice tasks use key: <PO>_<invKey>)
            setTimeout(() => {
                try {
                    const rowKey = `${poStr}_${String(invKey || '').trim()}`;
                    if (!rowKey) return;
                    const tbody = (typeof activeTaskTableBody !== 'undefined') ? activeTaskTableBody : null;
                    if (!tbody) return;
                    const esc = (window.CSS && CSS.escape) ? CSS.escape(rowKey) : rowKey.replace(/"/g, '\\"');
                    const row = tbody.querySelector(`tr[data-key="${esc}"]`);
                    if (row && row.scrollIntoView) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } catch (e) { /* ignore */ }
            }, 250);

        } catch (e) {
            console.log('Workdesk deep link open failed:', e);
        }
    }, 450);
}


// imParseInvoiceDeepLinkFromUrl moved to js/app-invoice.js (7.6.1)

// imClearInvoiceDeepLinkFromUrl moved to js/app-invoice.js (7.6.1)

// Exposed for button onclick
window.imShareInvoiceForApprovalWhatsApp = function (poNumber, invoiceKey) {
    try {
        const po = String(poNumber || '').trim();
        const key = String(invoiceKey || '').trim();
        if (!po || !key) { alert('Missing invoice reference.'); return; }

        const inv = (allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) ? allInvoiceData[po][key] : null;
        const poRec = (allPOData && allPOData[po]) ? allPOData[po] : null;

        const vendor = (poRec && (poRec['Supplier Name'] || poRec.vendor)) || (inv && (inv.vendorName || inv.vendor)) || 'N/A';
        const site = (poRec && (poRec['Project ID'] || poRec.site)) || (inv && (inv.site || inv.project)) || 'N/A';

        const invValueNum = inv ? (parseFloat(String(inv.invValue || '').replace(/,/g, '')) || 0) : 0;
        const invValueDisplay = inv ? `QAR ${formatCurrency(invValueNum)}` : 'N/A';

        const link = wdBuildActiveTaskDeepLink(po, key);
        const invNo = (inv && inv.invNumber) ? inv.invNumber : '';

        const msgLines = [
            'Dear Boss, need your approval for the below detail:',
            `PO: ${po}`,
            `Vendor: ${vendor}`,
            (invNo ? `Invoice No: ${invNo}` : null),
            `Invoice Value: ${invValueDisplay}`,
            `Site: ${site}`,
            '',
            `Link: ${link}`
        ].filter(Boolean);

        const waUrl = 'https://wa.me/?text=' + encodeURIComponent(msgLines.join('\n'));
        window.open(waUrl, '_blank', 'noopener');
    } catch (e) {
        console.error('WhatsApp share failed:', e);
        alert('Unable to create WhatsApp message.');
    }
};

async function imOpenInvoiceFromDeepLink(po, invKey) {
    // Safety: only proceed if we have a logged in user
    if (!currentApprover) return;

    const userPosLower = (currentApprover?.Position || '').toLowerCase();
    const userRoleLower = (currentApprover?.Role || '').toLowerCase();
    const isAdmin = userRoleLower === 'admin';
    const isAccounting = userPosLower === 'accounting';
    const isAccounts = userPosLower === 'accounts';
    const isVacationDelegate = isVacationDelegateUser();

    // Only users who can access IM at all
    const canOpenIM = isAdmin || isAccounting || isAccounts || isVacationDelegate;
    if (!canOpenIM) return;

    // Navigate into Invoice Management
    try { invoiceManagementButton.click(); } catch (e) { /* ignore */ }

    // Give IM nav/time to render
    setTimeout(async () => {
        try {
            // If user is Accounting, open Invoice Entry (edit modal)
            if (isAccounting) {
                const entryLink = imNav ? imNav.querySelector('a[data-section="im-invoice-entry"]') : null;
                if (entryLink) entryLink.click();

                // Ensure invoice data exists
                const fetchPromise = (typeof ensureInvoiceDataFetched === 'function') ? ensureInvoiceDataFetched() : Promise.resolve();
                await fetchPromise;

                currentPO = po;
                // Load PO (from memory if possible)
                if (allPOData && allPOData[po]) {
                    await proceedWithPOLoading(po, allPOData[po]);
                } else {
                    // Fallback search
                    imPOSearchInput.value = po;
                    await handlePOSearch(po);
                }

                // Populate invoice and open modal
                populateInvoiceFormForEditing(invKey);
                imBackToActiveTaskButton.classList.remove('hidden');
            } else {
                // Fallback for non-accounting: open Invoice Records and run a quick search by PO
                const reportingLink = imNav ? imNav.querySelector('a[data-section="im-reporting"]') : null;
                if (reportingLink) reportingLink.click();
                if (imReportingSearchInput) {
                    imReportingSearchInput.value = po;
                    await populateInvoiceReporting(po);
                }
                alert('Opened Invoice Records for this PO. (Editing/approval requires Accounting access.)');
            }
        } catch (e) {
            console.error('Deep link open failed:', e);
        }
    }, 650);
}



