// ============================================================================
// IBA 11.5.9 — Cache-First Vendor Payment Recovery
// Uses a compact Firebase index for partial vendor/PO/invoice searches. Vendors
// without completion metadata receive one indexed With Accounts-only legacy scan;
// later vendor searches use only the compact index.
// ============================================================================

let paymentSearchResults = new Map();
let paymentRestoredStorageKey = '';
let paymentReadyIndex = new Map();
let paymentReadyIndexLoadPromise = null;
let paymentReadyIndexCacheRestored = false;
let paymentReadyMeta = new Map();
let paymentReadyMetaLoadPromise = null;
let paymentReadyMetaCacheRestored = false;

const PAYMENT_READY_INDEX_PATH = 'invoice_payments_ready';
const PAYMENT_READY_CACHE_KEY = 'iba_invoice_payments_ready_v1';
const PAYMENT_READY_META_PATH = 'invoice_payments_ready_meta';
const PAYMENT_READY_META_CACHE_KEY = 'iba_invoice_payments_ready_meta_v1';

function paymentText(value) {
    return String(value == null ? '' : value).trim();
}

function paymentNormalize(value) {
    return paymentText(value).toLowerCase().replace(/\s+/g, ' ');
}

function paymentNormalizeSupplierId(value) {
    const raw = paymentText(value).replace(/^"|"$/g, '').replace(/,/g, '').toUpperCase();
    return /^\d+\.0+$/.test(raw) ? raw.replace(/\.0+$/, '') : raw;
}

function paymentCurrency(value) {
    const amount = Number(value) || 0;
    if (typeof formatCurrency === 'function') return formatCurrency(amount);
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentParseAmount(value) {
    const parsed = Number(paymentText(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function paymentToday() {
    if (typeof getTodayDateString === 'function') return getTodayDateString();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function canCurrentUserAccessPayments() {
    const user = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : {};
    const name = paymentNormalize(user.Name || user.name);
    const superName = paymentNormalize(
        typeof SUPER_ADMIN_NAME !== 'undefined' ? SUPER_ADMIN_NAME : ''
    );
    if (name && superName && name === superName) return true;

    const role = paymentNormalize(user.Role || user.role);
    if (role !== 'admin') return false;

    const positionTokens = paymentNormalize(user.Position || user.position)
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    return positionTokens.some(token => ['finance', 'accounts', 'accounting'].includes(token));
}

function paymentCartId(poNumber, invoiceKey) {
    return `${paymentText(poNumber).toUpperCase()}::${paymentText(invoiceKey)}`;
}

function paymentReadyIndexKey(poNumber, invoiceKey) {
    const raw = paymentCartId(poNumber, invoiceKey);
    try {
        return encodeURIComponent(raw).replace(/\./g, '%2E');
    } catch (_) {
        return raw.replace(/[.#$[\]/]/g, character => `_${character.charCodeAt(0).toString(16)}_`);
    }
}

function paymentSafeFirebaseKey(value) {
    const raw = paymentText(value);
    try {
        return encodeURIComponent(raw).replace(/\./g, '%2E');
    } catch (_) {
        return raw.replace(/[.#$[\]/]/g, character => `_${character.charCodeAt(0).toString(16)}_`);
    }
}

function paymentVendorMetaKey(supplierId, vendorName) {
    const normalizedId = paymentNormalizeSupplierId(supplierId);
    const identity = normalizedId
        ? `supplier::${normalizedId}`
        : `vendor::${paymentNormalize(vendorName)}`;
    return paymentSafeFirebaseKey(identity);
}

function paymentCartItems() {
    if (!invoicesToPay || typeof invoicesToPay !== 'object') invoicesToPay = {};
    return Object.values(invoicesToPay).filter(Boolean);
}

function paymentGetSupplierDetails(poNumber, invoiceData = {}) {
    const po = paymentText(poNumber).toUpperCase();
    const poData = (typeof allPOData !== 'undefined' && allPOData && allPOData[po])
        ? allPOData[po]
        : {};
    const supplierName = paymentText(
        invoiceData.vendorName ||
        invoiceData.vendor_name ||
        invoiceData.vendor ||
        poData['Supplier Name'] ||
        poData['Supplier Name:'] ||
        poData.Supplier
    ) || 'N/A';
    const supplierId = paymentNormalizeSupplierId(
        invoiceData.vendorId ||
        invoiceData.vendor_id ||
        invoiceData.supplierId ||
        invoiceData.supplier_id ||
        poData['Supplier ID'] ||
        poData['Vendor ID'] ||
        poData.vendor_id
    );
    const site = paymentText(
        invoiceData.site ||
        invoiceData.siteName ||
        invoiceData.site_name ||
        poData['Project ID']
    ) || 'N/A';
    return { supplierName, supplierId, site };
}

function paymentReadyPayload(poNumber, invoiceKey, invoiceData = {}, updatedAtValue) {
    const po = paymentText(poNumber).toUpperCase();
    const key = paymentText(invoiceKey);
    const supplier = paymentGetSupplierDetails(po, invoiceData);
    const invoiceValue = Number(invoiceData.invValue) || 0;
    const savedAmount = Number(invoiceData.amountPaid);
    const amountPaid = Number.isFinite(savedAmount) && savedAmount > 0 ? savedAmount : invoiceValue;
    const updatedAt = updatedAtValue !== undefined
        ? updatedAtValue
        : ((typeof firebase !== 'undefined' && firebase.database)
            ? firebase.database.ServerValue.TIMESTAMP
            : Date.now());

    return {
        indexKey: paymentReadyIndexKey(po, key),
        po,
        invoiceKey: key,
        invoiceNo: paymentText(invoiceData.invNumber || invoiceData.invoiceNo),
        invEntryID: paymentText(invoiceData.invEntryID),
        vendorName: supplier.supplierName,
        vendorNameLower: paymentNormalize(supplier.supplierName),
        supplierId: supplier.supplierId,
        site: supplier.site,
        amountPaid,
        invoiceValue,
        status: 'With Accounts',
        originalAttention: paymentText(invoiceData.attention),
        updatedAt
    };
}

function paymentReadyItemFromRow(row = {}, fallbackIndexKey = '') {
    const po = paymentText(row.po || row.poNumber).toUpperCase();
    const key = paymentText(row.invoiceKey || row.key);
    if (!po || !key) return null;
    const invoiceValue = Number(row.invoiceValue ?? row.invValue) || 0;
    const savedAmount = Number(row.amountPaid);
    return {
        id: paymentCartId(po, key),
        key,
        po,
        indexKey: paymentText(row.indexKey || fallbackIndexKey) || paymentReadyIndexKey(po, key),
        invoiceNo: paymentText(row.invoiceNo || row.invNumber),
        invEntryID: paymentText(row.invEntryID),
        supplierName: paymentText(row.vendorName || row.supplierName) || 'N/A',
        supplierId: paymentNormalizeSupplierId(row.supplierId || row.vendorId),
        site: paymentText(row.site) || 'N/A',
        amountPaid: Number.isFinite(savedAmount) && savedAmount > 0 ? savedAmount : invoiceValue,
        invoiceValue,
        status: paymentText(row.status) || 'With Accounts',
        originalAttention: paymentText(row.originalAttention || row.attention)
    };
}

function paymentPersistReadyIndexCache() {
    try {
        localStorage.setItem(PAYMENT_READY_CACHE_KEY, JSON.stringify({
            version: '11.5.9',
            savedAt: Date.now(),
            items: Array.from(paymentReadyIndex.entries())
        }));
    } catch (error) {
        console.warn('Payment-ready browser cache could not be saved:', error);
    }
}

function paymentRestoreReadyIndexCache() {
    if (paymentReadyIndexCacheRestored) return;
    paymentReadyIndexCacheRestored = true;
    try {
        const parsed = JSON.parse(localStorage.getItem(PAYMENT_READY_CACHE_KEY) || 'null');
        const items = parsed && Array.isArray(parsed.items) ? parsed.items : [];
        items.forEach(([indexKey, row]) => {
            if (indexKey && row) paymentReadyIndex.set(indexKey, row);
        });
    } catch (error) {
        console.warn('Payment-ready browser cache could not be restored:', error);
    }
}

function paymentApplyReadyIndexSnapshot(snapshotValue) {
    const next = new Map();
    Object.entries(snapshotValue || {}).forEach(([indexKey, row]) => {
        if (!row || typeof row !== 'object') return;
        const item = paymentReadyItemFromRow(row, indexKey);
        if (!item || paymentNormalize(item.status) !== 'with accounts') return;
        next.set(indexKey, { ...row, indexKey });
    });
    paymentReadyIndex = next;
    paymentPersistReadyIndexCache();
}

async function paymentEnsureReadyIndexLoaded() {
    paymentRestoreReadyIndexCache();
    if (paymentReadyIndexLoadPromise) return paymentReadyIndexLoadPromise;
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) {
        return paymentReadyIndex;
    }

    paymentReadyIndexLoadPromise = new Promise(resolve => {
        const ref = invoiceDb.ref(PAYMENT_READY_INDEX_PATH);
        let resolved = false;
        const fallbackTimer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(paymentReadyIndex);
            }
        }, 4000);
        const applyAndResolve = snapshot => {
            paymentApplyReadyIndexSnapshot(snapshot && snapshot.val ? snapshot.val() : {});
            if (!resolved) {
                clearTimeout(fallbackTimer);
                resolved = true;
                resolve(paymentReadyIndex);
            }
        };
        const handleError = error => {
            console.warn('Payment-ready index could not be loaded. Using targeted PO fallback.', error);
            if (!resolved) {
                clearTimeout(fallbackTimer);
                resolved = true;
                resolve(paymentReadyIndex);
            }
        };

        if (ref && typeof ref.on === 'function') {
            ref.on('value', applyAndResolve, handleError);
            return;
        }
        if (ref && typeof ref.once === 'function') {
            ref.once('value').then(applyAndResolve).catch(handleError);
            return;
        }
        resolve(paymentReadyIndex);
    });
    return paymentReadyIndexLoadPromise;
}

function paymentPersistReadyMetaCache() {
    try {
        localStorage.setItem(PAYMENT_READY_META_CACHE_KEY, JSON.stringify({
            version: '11.5.9',
            savedAt: Date.now(),
            items: Array.from(paymentReadyMeta.entries())
        }));
    } catch (error) {
        console.warn('Payment-ready completion cache could not be saved:', error);
    }
}

function paymentRestoreReadyMetaCache() {
    if (paymentReadyMetaCacheRestored) return;
    paymentReadyMetaCacheRestored = true;
    try {
        const parsed = JSON.parse(localStorage.getItem(PAYMENT_READY_META_CACHE_KEY) || 'null');
        const items = parsed && Array.isArray(parsed.items) ? parsed.items : [];
        items.forEach(([metaKey, row]) => {
            if (metaKey && row) paymentReadyMeta.set(metaKey, row);
        });
    } catch (error) {
        console.warn('Payment-ready completion cache could not be restored:', error);
    }
}

function paymentApplyReadyMetaSnapshot(snapshotValue) {
    const next = new Map();
    Object.entries(snapshotValue || {}).forEach(([metaKey, row]) => {
        if (!metaKey || !row || typeof row !== 'object') return;
        next.set(metaKey, { ...row, metaKey });
    });
    paymentReadyMeta = next;
    paymentPersistReadyMetaCache();
}

async function paymentEnsureReadyMetaLoaded() {
    paymentRestoreReadyMetaCache();
    if (paymentReadyMetaLoadPromise) return paymentReadyMetaLoadPromise;
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) {
        return paymentReadyMeta;
    }

    paymentReadyMetaLoadPromise = new Promise(resolve => {
        const ref = invoiceDb.ref(PAYMENT_READY_META_PATH);
        let resolved = false;
        const fallbackTimer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(paymentReadyMeta);
            }
        }, 4000);
        const applyAndResolve = snapshot => {
            paymentApplyReadyMetaSnapshot(snapshot && snapshot.val ? snapshot.val() : {});
            if (!resolved) {
                clearTimeout(fallbackTimer);
                resolved = true;
                resolve(paymentReadyMeta);
            }
        };
        const handleError = error => {
            console.warn('Payment-ready completion metadata could not be loaded.', error);
            if (!resolved) {
                clearTimeout(fallbackTimer);
                resolved = true;
                resolve(paymentReadyMeta);
            }
        };

        if (ref && typeof ref.on === 'function') {
            ref.on('value', applyAndResolve, handleError);
            return;
        }
        if (ref && typeof ref.once === 'function') {
            ref.once('value').then(applyAndResolve).catch(handleError);
            return;
        }
        resolve(paymentReadyMeta);
    });
    return paymentReadyMetaLoadPromise;
}

function paymentUpdateReadyIndexMemory(indexKey, row) {
    if (!indexKey) return;
    if (row) paymentReadyIndex.set(indexKey, { ...row, indexKey });
    else paymentReadyIndex.delete(indexKey);
    paymentPersistReadyIndexCache();
}

function paymentUpdateReadyMetaMemory(metaKey, row) {
    if (!metaKey) return;
    if (row) paymentReadyMeta.set(metaKey, { ...row, metaKey });
    else paymentReadyMeta.delete(metaKey);
    paymentPersistReadyMetaCache();
}

async function syncInvoicePaymentReadyIndex(poNumber, invoiceKey, invoiceData = {}) {
    const po = paymentText(poNumber).toUpperCase();
    const key = paymentText(invoiceKey);
    if (!po || !key || typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return false;

    const indexKey = paymentReadyIndexKey(po, key);
    const ref = invoiceDb.ref(`${PAYMENT_READY_INDEX_PATH}/${indexKey}`);
    if (paymentNormalize(invoiceData.status) !== 'with accounts') {
        await ref.remove();
        paymentUpdateReadyIndexMemory(indexKey, null);
        return true;
    }

    const payload = paymentReadyPayload(po, key, invoiceData);
    await ref.set(payload);
    paymentUpdateReadyIndexMemory(indexKey, payload);
    return true;
}

async function removeInvoicePaymentReadyIndex(poNumber, invoiceKey) {
    const po = paymentText(poNumber).toUpperCase();
    const key = paymentText(invoiceKey);
    if (!po || !key || typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return false;
    const indexKey = paymentReadyIndexKey(po, key);
    await invoiceDb.ref(`${PAYMENT_READY_INDEX_PATH}/${indexKey}`).remove();
    paymentUpdateReadyIndexMemory(indexKey, null);
    return true;
}

async function paymentRemoveReadyItems(items) {
    const list = (items || []).filter(item => item && item.po && item.key);
    if (!list.length || typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return;
    const updates = {};
    list.forEach(item => {
        updates[`${PAYMENT_READY_INDEX_PATH}/${paymentReadyIndexKey(item.po, item.key)}`] = null;
    });
    await invoiceDb.ref().update(updates);
    list.forEach(item => paymentUpdateReadyIndexMemory(paymentReadyIndexKey(item.po, item.key), null));
}

function paymentStorageKey() {
    const user = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : {};
    const identity = paymentText(user.Email || user.Name || user.Mobile || 'unknown')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_');
    return `iba_payment_cart_11_5_6_${identity}`;
}

function persistPaymentCart() {
    try {
        const key = paymentStorageKey();
        const items = paymentCartItems();
        if (!items.length) {
            localStorage.removeItem(key);
            return;
        }
        localStorage.setItem(key, JSON.stringify({
            version: '11.5.9',
            savedAt: Date.now(),
            items
        }));
    } catch (error) {
        console.warn('Payment cart could not be saved locally:', error);
    }
}

function restorePaymentCart() {
    const key = paymentStorageKey();
    if (paymentRestoredStorageKey === key) return;
    paymentRestoredStorageKey = key;
    invoicesToPay = {};

    try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        const items = parsed && Array.isArray(parsed.items) ? parsed.items : [];
        items.forEach(item => {
            const po = paymentText(item.po).toUpperCase();
            const invoiceKey = paymentText(item.key);
            if (!po || !invoiceKey) return;
            const id = paymentCartId(po, invoiceKey);
            invoicesToPay[id] = {
                ...item,
                id,
                po,
                key: invoiceKey,
                amountPaid: Number(item.amountPaid) || 0
            };
        });
    } catch (error) {
        console.warn('Saved payment cart could not be restored:', error);
        try { localStorage.removeItem(key); } catch (_) {}
    }
}

function updatePaymentsCount() {
    const items = paymentCartItems();
    if (paymentsCountDisplay) {
        paymentsCountDisplay.textContent = items.length ? `(${items.length})` : '';
    }
}

function renderPaymentsCart() {
    if (!imPaymentsTableBody) return;
    const items = paymentCartItems();
    const emptyState = document.getElementById('im-payment-cart-empty');
    const tableWrap = document.querySelector('#im-payments .im-payment-cart-table-wrap');
    const totalEl = document.getElementById('im-payment-cart-total-value');
    const clearButton = document.getElementById('im-clear-payments-button');
    const checkoutButton = document.getElementById('im-save-payments-button');

    imPaymentsTableBody.innerHTML = '';
    if (emptyState) emptyState.classList.toggle('hidden', items.length > 0);
    if (tableWrap) tableWrap.classList.toggle('hidden', items.length === 0);
    if (clearButton) clearButton.disabled = items.length === 0;
    if (checkoutButton) checkoutButton.disabled = items.length === 0;

    let total = 0;
    items.forEach(item => {
        const row = document.createElement('tr');
        row.dataset.key = item.id;
        row.dataset.po = item.po;

        const invoiceCell = document.createElement('td');
        invoiceCell.textContent = item.invoiceNo || item.invEntryID || 'N/A';
        const poCell = document.createElement('td');
        poCell.textContent = item.po;
        const companyCell = document.createElement('td');
        companyCell.textContent = item.supplierName;

        const amountCell = document.createElement('td');
        const amountInput = document.createElement('input');
        amountInput.type = 'text';
        amountInput.inputMode = 'decimal';
        amountInput.className = 'payment-input highlight-field im-payment-amount-input';
        amountInput.name = 'amountPaid';
        amountInput.value = paymentCurrency(item.amountPaid);
        amountInput.setAttribute('aria-label', `Amount paid for ${item.invoiceNo || item.po}`);
        amountInput.addEventListener('input', () => {
            item.amountPaid = paymentParseAmount(amountInput.value);
            persistPaymentCart();
            const nextTotal = paymentCartItems().reduce((sum, current) => sum + (Number(current.amountPaid) || 0), 0);
            if (totalEl) totalEl.textContent = paymentCurrency(nextTotal);
        });
        amountInput.addEventListener('blur', () => {
            item.amountPaid = paymentParseAmount(amountInput.value);
            amountInput.value = paymentCurrency(item.amountPaid);
            persistPaymentCart();
        });
        amountCell.appendChild(amountInput);

        const releaseCell = document.createElement('td');
        releaseCell.innerHTML = `<span class="im-payment-auto-date"><i class="fa-solid fa-calendar-check"></i> ${paymentToday()}</span>`;

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge im-payment-status-badge';
        statusBadge.textContent = item.status || 'With Accounts';
        statusCell.appendChild(statusBadge);

        const actionCell = document.createElement('td');
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'delete-btn payment-remove-btn';
        removeButton.title = 'Remove from payment list';
        removeButton.setAttribute('aria-label', `Remove ${item.invoiceNo || item.po}`);
        removeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        actionCell.appendChild(removeButton);

        [invoiceCell, poCell, companyCell, amountCell, releaseCell, statusCell, actionCell]
            .forEach(cell => row.appendChild(cell));
        imPaymentsTableBody.appendChild(row);
        total += Number(item.amountPaid) || 0;
    });

    if (totalEl) totalEl.textContent = paymentCurrency(total);
    updatePaymentsCount();
}

async function initializePaymentsWorkspace() {
    if (!canCurrentUserAccessPayments()) return;
    restorePaymentCart();
    renderPaymentsCart();
    paymentEnsureReadyIndexLoaded();
    paymentEnsureReadyMetaLoaded();
    const statusEl = document.getElementById('im-payment-status-message');
    if (statusEl) statusEl.textContent = '';
}

function openPaymentSearchModal() {
    if (!canCurrentUserAccessPayments()) {
        alert('Access Denied: Payments requires an Admin role with a Finance, Accounts, or Accounting position.');
        return;
    }
    if (imPaymentModalPOInput) imPaymentModalPOInput.value = '';
    if (imPaymentModalResults) {
        imPaymentModalResults.innerHTML = '<p>Enter a PO number, invoice number, or company to begin.</p>';
    }
    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (totalDisplay) totalDisplay.textContent = paymentCurrency(0);
    paymentSearchResults = new Map();
    if (imAddPaymentModal) imAddPaymentModal.classList.remove('hidden');
    setTimeout(() => {
        if (imPaymentModalPOInput) imPaymentModalPOInput.focus();
    }, 80);
}

async function paymentEnsurePOBaseData() {
    if (typeof ensureInvoicePOBaseDataFetched === 'function') {
        await ensureInvoicePOBaseDataFetched(false);
    } else if (typeof ensureInvoiceLightDataFetched === 'function') {
        await ensureInvoiceLightDataFetched(false);
    }
}

async function paymentFetchWithAccountsPOBucket(poNumber) {
    const po = paymentText(poNumber).toUpperCase();
    if (!po) return {};
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return {};
    const poRef = invoiceDb.ref(`invoice_entries/${po}`);
    if (!poRef || typeof poRef.orderByChild !== 'function') {
        throw new Error(`Indexed payment status lookup is unavailable for PO ${po}.`);
    }
    const statusQuery = poRef.orderByChild('status');
    if (!statusQuery || typeof statusQuery.equalTo !== 'function') {
        throw new Error(`Indexed With Accounts filter is unavailable for PO ${po}.`);
    }
    const withAccountsQuery = statusQuery.equalTo('With Accounts');
    const snap = await withAccountsQuery.once('value');
    const bucket = snap.val() || {};
    if (!allInvoiceData) allInvoiceData = {};
    const mergedBucket = { ...(allInvoiceData[po] || {}) };
    Object.entries(mergedBucket).forEach(([key, invoice]) => {
        if (
            paymentNormalize(invoice && invoice.status) === 'with accounts' &&
            !Object.prototype.hasOwnProperty.call(bucket, key)
        ) {
            delete mergedBucket[key];
        }
    });
    allInvoiceData[po] = { ...mergedBucket, ...bucket };
    if (window.__invoiceEntriesFullLoaded !== true) window.__invoiceEntriesFullLoaded = false;
    return bucket;
}

function paymentResultFromInvoice(poNumber, invoiceKey, invoiceData) {
    const po = paymentText(poNumber).toUpperCase();
    const supplier = paymentGetSupplierDetails(po, invoiceData);
    const savedAmount = Number(invoiceData.amountPaid);
    const invoiceValue = Number(invoiceData.invValue) || 0;
    const amountPaid = Number.isFinite(savedAmount) && savedAmount > 0 ? savedAmount : invoiceValue;
    const id = paymentCartId(po, invoiceKey);
    return {
        id,
        key: paymentText(invoiceKey),
        po,
        invoiceNo: paymentText(invoiceData.invNumber || invoiceData.invoiceNo),
        invEntryID: paymentText(invoiceData.invEntryID),
        supplierName: supplier.supplierName,
        supplierId: supplier.supplierId,
        site: supplier.site,
        amountPaid,
        invoiceValue,
        status: paymentText(invoiceData.status) || 'With Accounts',
        originalAttention: paymentText(invoiceData.attention)
    };
}

function paymentCollectMatches(poNumbers, queryText) {
    const query = paymentNormalize(queryText);
    const cartIds = new Set(paymentCartItems().map(item => item.id));
    const results = [];

    poNumbers.forEach(poNumber => {
        const po = paymentText(poNumber).toUpperCase();
        const bucket = allInvoiceData && allInvoiceData[po] ? allInvoiceData[po] : {};
        const supplier = paymentGetSupplierDetails(po, {});
        const poMatch = paymentNormalize(po).includes(query);
        const supplierMatch = paymentNormalize(supplier.supplierName).includes(query);
        const supplierIdMatch = paymentNormalizeSupplierId(supplier.supplierId).toLowerCase().includes(query);

        Object.entries(bucket || {}).forEach(([key, invoice]) => {
            if (paymentNormalize(invoice && invoice.status) !== 'with accounts') return;
            const item = paymentResultFromInvoice(po, key, invoice || {});
            const invoiceMatch = paymentNormalize(item.invoiceNo).includes(query);
            const entryMatch = paymentNormalize(item.invEntryID).includes(query);
            const invoiceSupplierMatch = paymentNormalize(item.supplierName).includes(query);
            const invoiceSupplierIdMatch = paymentNormalizeSupplierId(item.supplierId).toLowerCase().includes(query);
            if (!(poMatch || supplierMatch || supplierIdMatch || invoiceMatch || entryMatch || invoiceSupplierMatch || invoiceSupplierIdMatch)) return;
            if (!cartIds.has(item.id)) results.push(item);
        });
    });

    results.sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName) ||
        a.po.localeCompare(b.po, undefined, { numeric: true }) ||
        (a.invoiceNo || a.invEntryID).localeCompare(b.invoiceNo || b.invEntryID, undefined, { numeric: true })
    );
    return results;
}

function paymentCollectReadyMatches(queryText) {
    const query = paymentNormalize(queryText);
    const cartIds = new Set(paymentCartItems().map(item => item.id));
    const results = [];

    paymentReadyIndex.forEach((row, indexKey) => {
        const item = paymentReadyItemFromRow(row, indexKey);
        if (!item || paymentNormalize(item.status) !== 'with accounts' || cartIds.has(item.id)) return;
        const fields = [
            item.po,
            item.invoiceNo,
            item.invEntryID,
            item.supplierName,
            item.supplierId
        ];
        if (fields.some(value => paymentNormalize(value).includes(query))) results.push(item);
    });
    return paymentSortAndDedupeResults(results);
}

function paymentSortAndDedupeResults(results) {
    const unique = new Map();
    (results || []).forEach(item => {
        if (item && item.id) unique.set(item.id, item);
    });
    return Array.from(unique.values()).sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName) ||
        a.po.localeCompare(b.po, undefined, { numeric: true }) ||
        (a.invoiceNo || a.invEntryID).localeCompare(b.invoiceNo || b.invEntryID, undefined, { numeric: true })
    );
}

function paymentVendorTargetsForQuery(queryText) {
    const query = paymentNormalize(queryText);
    const targets = new Map();
    const addTarget = (supplierIdValue, vendorNameValue) => {
        const supplierId = paymentNormalizeSupplierId(supplierIdValue);
        const vendorName = paymentText(vendorNameValue);
        if (!supplierId && !paymentNormalize(vendorName)) return;
        const metaKey = paymentVendorMetaKey(supplierId, vendorName);
        const current = targets.get(metaKey);
        targets.set(metaKey, {
            metaKey,
            supplierId: supplierId || (current && current.supplierId) || '',
            vendorName: vendorName || (current && current.vendorName) || 'N/A',
            vendorNameLower: paymentNormalize(vendorName || (current && current.vendorName))
        });
    };

    const vendors = (typeof allVendorsData !== 'undefined' && allVendorsData) ? allVendorsData : {};
    Object.entries(vendors).forEach(([supplierId, vendorName]) => {
        if (
            paymentNormalize(vendorName).includes(query) ||
            paymentNormalizeSupplierId(supplierId).toLowerCase().includes(query)
        ) {
            addTarget(supplierId, vendorName);
        }
    });

    const matchedSupplierIds = new Set(
        Array.from(targets.values()).map(target => target.supplierId).filter(Boolean)
    );
    const allPOs = (typeof allPOData !== 'undefined' && allPOData) ? allPOData : {};
    Object.values(allPOs).forEach(poData => {
        const supplierName = paymentText(
            poData['Supplier Name'] ||
            poData['Supplier Name:'] ||
            poData.Supplier ||
            poData['Supplier']
        );
        const supplierId = paymentNormalizeSupplierId(
            poData['Supplier ID'] ||
            poData['Supplier ID:'] ||
            poData['Vendor ID'] ||
            poData.vendor_id
        );
        if (
            paymentNormalize(supplierName).includes(query) ||
            supplierId.toLowerCase().includes(query) ||
            matchedSupplierIds.has(supplierId)
        ) {
            addTarget(supplierId, supplierName);
        }
    });

    return Array.from(targets.values());
}

function paymentPOVendorDetails(poData = {}) {
    return {
        supplierName: paymentText(
            poData['Supplier Name'] ||
            poData['Supplier Name:'] ||
            poData.Supplier ||
            poData['Supplier']
        ),
        supplierId: paymentNormalizeSupplierId(
            poData['Supplier ID'] ||
            poData['Supplier ID:'] ||
            poData['Vendor ID'] ||
            poData.vendor_id
        )
    };
}

function paymentPOsForVendorTargets(targets) {
    const requestedTargets = (targets || []).filter(Boolean);
    if (!requestedTargets.length) return [];
    const targetIds = new Set(requestedTargets.map(target => target.supplierId).filter(Boolean));
    const targetNames = new Set(
        requestedTargets.map(target => paymentNormalize(target.vendorName)).filter(Boolean)
    );
    const candidatePOs = new Set();
    const allPOs = (typeof allPOData !== 'undefined' && allPOData) ? allPOData : {};

    Object.entries(allPOs).forEach(([poNumber, poData]) => {
        const supplier = paymentPOVendorDetails(poData);
        if (
            (supplier.supplierId && targetIds.has(supplier.supplierId)) ||
            targetNames.has(paymentNormalize(supplier.supplierName))
        ) {
            candidatePOs.add(paymentText(poNumber).toUpperCase());
        }
    });

    return Array.from(candidatePOs).filter(Boolean);
}

function paymentVendorTargetIsComplete(target) {
    if (!target || !target.metaKey) return false;
    const row = paymentReadyMeta.get(target.metaKey);
    return Boolean(row && Object.prototype.hasOwnProperty.call(row, 'completedAt'));
}

function paymentCandidatePOsForQuery(queryText) {
    const query = paymentNormalize(queryText);
    const queryUpper = paymentText(queryText).toUpperCase();
    const candidatePOs = new Set();
    const allPOs = (typeof allPOData !== 'undefined' && allPOData) ? allPOData : {};

    Object.entries(allPOs).forEach(([poNumber, poData]) => {
        const supplier = paymentPOVendorDetails(poData);
        if (
            paymentNormalize(poNumber).includes(query) ||
            paymentNormalize(supplier.supplierName).includes(query) ||
            supplier.supplierId.toLowerCase().includes(query)
        ) {
            candidatePOs.add(paymentText(poNumber).toUpperCase());
        }
    });

    Object.entries(allInvoiceData || {}).forEach(([poNumber, bucket]) => {
        if (Object.values(bucket || {}).some(invoice => {
            const supplier = paymentGetSupplierDetails(poNumber, invoice || {});
            return [
                invoice && (invoice.invNumber || invoice.invoiceNo),
                invoice && invoice.invEntryID,
                supplier.supplierName,
                supplier.supplierId
            ].some(value => paymentNormalize(value).includes(query));
        })) {
            candidatePOs.add(paymentText(poNumber).toUpperCase());
        }
    });

    // Direct PO fallback is only useful for numeric PO searches. Treating a
    // one-word vendor query such as "Khalifa" as a Firebase PO path creates an
    // unnecessary empty read.
    if (/^\d{3,}$/.test(queryUpper)) candidatePOs.add(queryUpper);
    return Array.from(candidatePOs).filter(Boolean);
}

async function paymentCommitReadyBackfill(items, completedTargets = []) {
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return;
    const updates = {};
    const localRows = [];
    const localMetaRows = [];
    const serverTimestamp = (typeof firebase !== 'undefined' && firebase.database)
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now();

    (items || []).forEach(item => {
        const invoiceData = allInvoiceData && allInvoiceData[item.po]
            ? allInvoiceData[item.po][item.key]
            : null;
        if (!invoiceData || paymentNormalize(invoiceData.status) !== 'with accounts') return;
        const payload = paymentReadyPayload(item.po, item.key, invoiceData, serverTimestamp);
        const current = paymentReadyIndex.get(payload.indexKey);
        if (
            current &&
            paymentText(current.invoiceNo) === payload.invoiceNo &&
            paymentNormalize(current.vendorName) === payload.vendorNameLower &&
            Number(current.amountPaid) === Number(payload.amountPaid)
        ) {
            return;
        }
        updates[`${PAYMENT_READY_INDEX_PATH}/${payload.indexKey}`] = payload;
        localRows.push(payload);
    });

    (completedTargets || []).forEach(target => {
        if (!target || !target.metaKey) return;
        const targetPOs = paymentPOsForVendorTargets([target]);
        const targetPOSet = new Set(targetPOs);
        const metaRow = {
            metaKey: target.metaKey,
            supplierId: target.supplierId,
            vendorName: target.vendorName,
            vendorNameLower: paymentNormalize(target.vendorName),
            completedAt: serverTimestamp,
            poCount: targetPOs.length,
            invoiceCount: (items || []).filter(item => targetPOSet.has(item.po)).length,
            schemaVersion: 1
        };
        updates[`${PAYMENT_READY_META_PATH}/${target.metaKey}`] = metaRow;
        localMetaRows.push(metaRow);
    });

    if (!Object.keys(updates).length) return;
    await invoiceDb.ref().update(updates);
    localRows.forEach(payload => paymentUpdateReadyIndexMemory(payload.indexKey, payload));
    localMetaRows.forEach(metaRow => paymentUpdateReadyMetaMemory(metaRow.metaKey, metaRow));
}

function paymentRenderSearchResults(results) {
    paymentSearchResults = new Map(results.map(item => [item.id, item]));
    imPaymentModalResults.innerHTML = '';

    if (!results.length) {
        imPaymentModalResults.innerHTML = '<p>No matching With Accounts invoices were found, or the matching records are already in the payment list.</p>';
        const totalDisplay = document.getElementById('payment-modal-total-value');
        if (totalDisplay) totalDisplay.textContent = paymentCurrency(0);
        return;
    }

    const companyCount = new Set(results.map(item => paymentNormalize(item.supplierName))).size;
    const poCount = new Set(results.map(item => paymentText(item.po).toUpperCase())).size;
    const invoiceWord = results.length === 1 ? 'invoice' : 'invoices';
    const poWord = poCount === 1 ? 'PO' : 'POs';
    const companyWord = companyCount === 1 ? 'company' : 'companies';
    const resultSummary = document.createElement('div');
    resultSummary.className = 'im-payment-result-summary';
    resultSummary.innerHTML = `
        <i class="fa-solid fa-list-check"></i>
        <span><strong>${results.length}</strong> With Accounts ${invoiceWord} found across <strong>${poCount}</strong> ${poWord} from <strong>${companyCount}</strong> ${companyWord}.</span>
    `;

    const table = document.createElement('table');
    table.className = 'im-payment-result-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th><input type="checkbox" id="payment-modal-select-all" aria-label="Select all results"></th>
                <th>Invoice No.</th>
                <th>PO No.</th>
                <th>Company</th>
                <th>Amount Paid</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    results.forEach(item => {
        const row = document.createElement('tr');
        const selectCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'payment-modal-inv-checkbox';
        checkbox.dataset.id = item.id;
        checkbox.setAttribute('aria-label', `Select ${item.invoiceNo || item.po}`);
        selectCell.appendChild(checkbox);

        const invoiceCell = document.createElement('td');
        invoiceCell.textContent = item.invoiceNo || item.invEntryID || 'N/A';
        const poCell = document.createElement('td');
        poCell.textContent = item.po;
        const companyCell = document.createElement('td');
        companyCell.textContent = item.supplierName;
        const amountCell = document.createElement('td');
        amountCell.textContent = paymentCurrency(item.amountPaid);
        amountCell.className = 'right-align';
        const statusCell = document.createElement('td');
        statusCell.textContent = item.status;

        [selectCell, invoiceCell, poCell, companyCell, amountCell, statusCell]
            .forEach(cell => row.appendChild(cell));
        row.addEventListener('click', event => {
            if (event.target !== checkbox) checkbox.checked = !checkbox.checked;
            updatePaymentModalTotal();
        });
        checkbox.addEventListener('change', updatePaymentModalTotal);
        tbody.appendChild(row);
    });

    table.querySelector('#payment-modal-select-all').addEventListener('change', event => {
        tbody.querySelectorAll('.payment-modal-inv-checkbox').forEach(checkbox => {
            checkbox.checked = event.target.checked;
        });
        updatePaymentModalTotal();
    });

    imPaymentModalResults.appendChild(resultSummary);
    imPaymentModalResults.appendChild(table);
    updatePaymentModalTotal();
}

function updatePaymentModalTotal() {
    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (!totalDisplay || !imPaymentModalResults) return;
    let total = 0;
    imPaymentModalResults.querySelectorAll('.payment-modal-inv-checkbox:checked').forEach(checkbox => {
        const item = paymentSearchResults.get(checkbox.dataset.id);
        if (item) total += Number(item.amountPaid) || 0;
    });
    totalDisplay.textContent = paymentCurrency(total);
}

async function handlePaymentModalPOSearch() {
    const query = paymentText(imPaymentModalPOInput && imPaymentModalPOInput.value);
    if (!query) {
        imPaymentModalResults.innerHTML = '<p>Please enter a PO number, invoice number, or company.</p>';
        return;
    }

    imPaymentModalResults.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Searching With Accounts invoices…</p>';
    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (totalDisplay) totalDisplay.textContent = paymentCurrency(0);

    try {
        await Promise.all([
            paymentEnsureReadyIndexLoaded(),
            paymentEnsureReadyMetaLoaded(),
            paymentEnsurePOBaseData()
        ]);

        const indexedResults = paymentCollectReadyMatches(query);
        const vendorTargets = paymentVendorTargetsForQuery(query);
        const incompleteVendorTargets = vendorTargets.filter(target => !paymentVendorTargetIsComplete(target));

        // Completion metadata means every legacy With Accounts invoice for each
        // matching vendor has already been recovered into the compact index.
        if (vendorTargets.length && !incompleteVendorTargets.length) {
            paymentRenderSearchResults(indexedResults);
            return;
        }

        const candidateList = incompleteVendorTargets.length
            ? paymentPOsForVendorTargets(incompleteVendorTargets)
            : paymentCandidatePOsForQuery(query);

        if (candidateList.length > 150) {
            if (indexedResults.length) {
                paymentRenderSearchResults(indexedResults);
            } else {
                imPaymentModalResults.innerHTML = '<p>Too many POs match this company search. Please enter a more specific company name, PO number, or invoice number.</p>';
            }
            return;
        }

        for (let index = 0; index < candidateList.length; index += 12) {
            const batch = candidateList.slice(index, index + 12);
            await Promise.all(batch.map(po => paymentFetchWithAccountsPOBucket(po)));
        }

        const targetedResults = paymentCollectMatches(candidateList, query);
        if (targetedResults.length || incompleteVendorTargets.length) {
            try {
                // Only mark vendors complete after every indexed PO query and the
                // combined ready-index/metadata update have succeeded.
                await paymentCommitReadyBackfill(targetedResults, incompleteVendorTargets);
            } catch (indexError) {
                console.warn('Targeted payment-ready vendor backfill skipped:', indexError);
            }
        }

        const results = paymentSortAndDedupeResults([
            ...indexedResults,
            ...targetedResults
        ]);
        paymentRenderSearchResults(results);
    } catch (error) {
        console.error('Payment invoice search failed:', error);
        imPaymentModalResults.innerHTML = '<p>An error occurred while searching. Please check the connection and try again.</p>';
    }
}

async function handleAddSelectedToPayments() {
    const selected = Array.from(
        imPaymentModalResults.querySelectorAll('.payment-modal-inv-checkbox:checked')
    ).map(checkbox => paymentSearchResults.get(checkbox.dataset.id)).filter(Boolean);

    if (!selected.length) {
        alert('Please select at least one invoice to add.');
        return;
    }

    selected.forEach(item => {
        invoicesToPay[item.id] = { ...item };
    });
    persistPaymentCart();
    renderPaymentsCart();

    if (imPaymentModalPOInput) imPaymentModalPOInput.value = '';
    if (imPaymentModalResults) {
        const companyCount = new Set(selected.map(item => paymentNormalize(item.supplierName))).size;
        const invoiceWord = selected.length === 1 ? 'invoice' : 'invoices';
        const companyWord = companyCount === 1 ? 'company' : 'companies';
        imPaymentModalResults.innerHTML = `
            <div class="im-payment-add-success">
                <i class="fa-solid fa-circle-check"></i>
                <div>
                    <strong>${selected.length} ${invoiceWord} from ${companyCount} ${companyWord} added to the payment list.</strong>
                    <span>Search another company, PO, or invoice to continue building the same list.</span>
                </div>
            </div>
        `;
    }
    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (totalDisplay) totalDisplay.textContent = paymentCurrency(0);
    paymentSearchResults = new Map();
    if (imPaymentModalResults) imPaymentModalResults.scrollTop = 0;
    setTimeout(() => {
        if (imPaymentModalPOInput) imPaymentModalPOInput.focus();
    }, 50);
}

function removePaymentCartItem(cartId) {
    const id = paymentText(cartId);
    if (!id || !invoicesToPay || !invoicesToPay[id]) return;
    delete invoicesToPay[id];
    persistPaymentCart();
    renderPaymentsCart();
}

function clearPaymentCart(skipConfirmation = false) {
    const items = paymentCartItems();
    if (!items.length) return true;
    if (!skipConfirmation && !confirm(`Clear all ${items.length} invoice(s) from the payment list?`)) {
        return false;
    }
    invoicesToPay = {};
    persistPaymentCart();
    renderPaymentsCart();
    return true;
}

async function handleSavePayments() {
    const items = paymentCartItems();
    const statusEl = document.getElementById('im-payment-status-message');
    const checkoutButton = document.getElementById('im-save-payments-button');

    if (!items.length) {
        alert('There are no invoices in the payment list.');
        return;
    }
    if (!canCurrentUserAccessPayments()) {
        alert('Access Denied: Payments requires an Admin role with a Finance, Accounts, or Accounting position.');
        return;
    }
    if (items.some(item => !(Number(item.amountPaid) > 0))) {
        alert('Every invoice must have an Amount Paid greater than zero before it can be marked Paid.');
        return;
    }

    const companyNames = Array.from(new Set(
        items.map(item => paymentText(item.supplierName) || 'Unknown company')
    ));
    const companySummary = companyNames.length === 1
        ? companyNames[0]
        : `${companyNames.length} companies`;
    const total = items.reduce((sum, item) => sum + (Number(item.amountPaid) || 0), 0);
    const confirmed = confirm(
        `Mark ${items.length} invoice(s) from ${companySummary} as Paid?\n\n` +
        `Total Sum: ${paymentCurrency(total)}\n\n` +
        'This will mark every listed invoice Paid and set its Release Date to today.'
    );
    if (!confirmed) return;

    if (checkoutButton) {
        checkoutButton.disabled = true;
        checkoutButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing…';
    }
    if (statusEl) {
        statusEl.className = 'im-payment-status-message is-working';
        statusEl.textContent = 'Validating invoices before marking them Paid…';
    }

    try {
        const currentRecords = await Promise.all(items.map(async item => {
            const snap = await invoiceDb.ref(`invoice_entries/${item.po}/${item.key}`).once('value');
            return { item, invoice: snap.val() };
        }));

        const missing = currentRecords.filter(record => !record.invoice);
        if (missing.length) {
            try {
                await paymentRemoveReadyItems(missing.map(record => record.item));
            } catch (cleanupError) {
                console.warn('Missing payment-ready rows could not be cleaned:', cleanupError);
            }
            throw new Error(`${missing.length} invoice record(s) could not be found. No checkout was completed.`);
        }
        const changed = currentRecords.filter(record => paymentNormalize(record.invoice.status) !== 'with accounts');
        if (changed.length) {
            try {
                await paymentRemoveReadyItems(changed.map(record => record.item));
            } catch (cleanupError) {
                console.warn('Stale payment-ready rows could not be cleaned:', cleanupError);
            }
            throw new Error(
                `${changed.length} invoice record(s) are no longer With Accounts. Refresh the payment list before checkout.`
            );
        }

        const checkoutDate = paymentToday();
        const serverTimestamp = (typeof firebase !== 'undefined' && firebase.database)
            ? firebase.database.ServerValue.TIMESTAMP
            : Date.now();
        const batchUpdates = {};

        currentRecords.forEach(({ item }) => {
            const basePath = `invoice_entries/${item.po}/${item.key}`;
            batchUpdates[`${basePath}/status`] = 'Paid';
            batchUpdates[`${basePath}/amountPaid`] = Number(item.amountPaid);
            batchUpdates[`${basePath}/releaseDate`] = checkoutDate;
            batchUpdates[`${basePath}/statusChangedAt`] = serverTimestamp;
            batchUpdates[`${basePath}/statusQueueAt`] = serverTimestamp;
            batchUpdates[`${basePath}/lastUpdated`] = serverTimestamp;
            batchUpdates[`${PAYMENT_READY_INDEX_PATH}/${paymentReadyIndexKey(item.po, item.key)}`] = null;
        });

        if (statusEl) statusEl.textContent = 'Marking invoices Paid…';
        await invoiceDb.ref().update(batchUpdates);

        currentRecords.forEach(({ item, invoice }) => {
            const localUpdates = {
                status: 'Paid',
                amountPaid: Number(item.amountPaid),
                releaseDate: checkoutDate,
                statusChangedAt: Date.now(),
                statusQueueAt: Date.now(),
                lastUpdated: Date.now()
            };
            if (!allInvoiceData) allInvoiceData = {};
            if (!allInvoiceData[item.po]) allInvoiceData[item.po] = {};
            allInvoiceData[item.po][item.key] = { ...invoice, ...localUpdates };
            paymentUpdateReadyIndexMemory(paymentReadyIndexKey(item.po, item.key), null);
        });

        if (statusEl) statusEl.textContent = 'Synchronizing linked payment records…';
        const syncResults = await Promise.allSettled(currentRecords.flatMap(({ item, invoice }) => {
            const updatedInvoice = {
                ...invoice,
                status: 'Paid',
                amountPaid: Number(item.amountPaid),
                releaseDate: checkoutDate,
                statusChangedAt: Date.now(),
                statusQueueAt: Date.now(),
                lastUpdated: Date.now()
            };
            return [
                updateLinkedJobEntry(item.po, item.key, 'Paid', 'Payment marked Paid'),
                updateInvoiceTaskLookup(item.po, item.key, updatedInvoice, invoice.attention)
            ];
        }));
        const syncFailures = syncResults.filter(result => result.status === 'rejected');
        if (syncFailures.length) {
            console.warn('Some linked payment task synchronization calls failed:', syncFailures);
        }

        try {
            allSystemEntries = [];
            if (typeof cacheTimestamps !== 'undefined' && cacheTimestamps) cacheTimestamps.systemEntries = 0;
        } catch (_) {}

        clearPaymentCart(true);
        if (statusEl) {
            statusEl.className = 'im-payment-status-message is-success';
            statusEl.textContent = `${currentRecords.length} invoice(s) from ${companySummary} marked Paid successfully.`;
        }
    } catch (error) {
        console.error('Payment checkout failed:', error);
        if (statusEl) {
            statusEl.className = 'im-payment-status-message is-error';
            statusEl.textContent = error.message || 'The invoices could not be marked Paid.';
        }
        alert(error.message || 'The invoices could not be marked Paid. Please check the data and try again.');
    } finally {
        if (checkoutButton) {
            checkoutButton.disabled = paymentCartItems().length === 0;
            checkoutButton.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark as Paid';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const clearButton = document.getElementById('im-clear-payments-button');
    if (clearButton && !clearButton.dataset.paymentBound) {
        clearButton.dataset.paymentBound = '1';
        clearButton.addEventListener('click', () => clearPaymentCart(false));
    }

});

window.canCurrentUserAccessPayments = canCurrentUserAccessPayments;
window.initializePaymentsWorkspace = initializePaymentsWorkspace;
window.openPaymentSearchModal = openPaymentSearchModal;
window.removePaymentCartItem = removePaymentCartItem;
window.clearPaymentCart = clearPaymentCart;
window.syncInvoicePaymentReadyIndex = syncInvoicePaymentReadyIndex;
window.removeInvoicePaymentReadyIndex = removeInvoicePaymentReadyIndex;
window.ibaPaymentTools = {
    parseAmount: paymentParseAmount,
    normalizeSupplierId: paymentNormalizeSupplierId,
    readyIndexKey: paymentReadyIndexKey
};
