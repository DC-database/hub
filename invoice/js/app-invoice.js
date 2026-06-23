// =================================================================================================
// app-invoice.js — Invoice Management helper foundation
// Version 7.6.0
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
