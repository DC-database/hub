// ============================================================================
// IBA 11.8.2 — WorkDesk Payment Pocket + Controlled Paid Date Action
// The compact With Accounts pocket now carries Invoice Value and SRV identity
// without downloading the invoice archive. Admin users in Accounts/Accounting
// may mark a displayed pocket row Paid through the same verified write workflow.
// ============================================================================

let paymentSearchResults = new Map();
let paymentModalGlobalPaidDate = '';
let paymentRestoredStorageKey = '';
let paymentReadyIndex = new Map();
let paymentReadyIndexLoadPromise = null;
let paymentReadyIndexCacheRestored = false;
let paymentReadyMeta = new Map();
let paymentReadyMetaLoadPromise = null;
let paymentReadyMetaCacheRestored = false;
let paymentInvoicePOKeys = new Set();
let paymentInvoicePOKeysLoadPromise = null;
const paymentReadyIndexSubscribers = new Set();

const PAYMENT_READY_INDEX_PATH = 'invoice_payments_ready';
const PAYMENT_READY_CACHE_KEY = 'iba_invoice_payments_ready_v1';
const PAYMENT_PAID_HISTORY_PATH = 'invoice_payments_paid_history';
const PAYMENT_READY_META_PATH = 'invoice_payments_ready_meta';
const PAYMENT_READY_META_CACHE_KEY = 'iba_invoice_payments_ready_meta_v1';
const PAYMENT_INVOICE_PO_KEYS_CACHE_KEY = 'iba_invoice_payment_po_keys_v1';
const PAYMENT_LEGACY_RECOVERY_YEAR = 2026;
const PAYMENT_PO_KEYS_CACHE_MAX_AGE = 30 * 60 * 1000;

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

function paymentInvoiceDateValue(invoiceData = {}) {
    return paymentText(
        invoiceData.invoiceDate ||
        invoiceData.InvoiceDate ||
        invoiceData['Invoice Date'] ||
        invoiceData.invoice_date
    );
}

function paymentInvoiceDateYear(invoiceData = {}) {
    const raw = paymentInvoiceDateValue(invoiceData);
    if (!raw) return null;

    const fourDigitYear = raw.match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/);
    if (fourDigitYear) return Number(fourDigitYear[1]);

    const shortDate = raw.match(/^\d{1,2}[\/.-]\d{1,2}[\/.-](\d{2})$/);
    if (shortDate) return 2000 + Number(shortDate[1]);

    return null;
}

function paymentInvoiceMatchesRecoveryYear(invoiceData = {}, year = PAYMENT_LEGACY_RECOVERY_YEAR) {
    return paymentInvoiceDateYear(invoiceData) === Number(year);
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

function paymentISOFromParts(yearValue, monthValue, dayValue) {
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
    const candidate = new Date(year, month - 1, day);
    if (
        candidate.getFullYear() !== year ||
        candidate.getMonth() !== month - 1 ||
        candidate.getDate() !== day
    ) return '';
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function paymentDateISO(value) {
    const raw = paymentText(value);
    if (!raw) return '';

    if (typeof normalizeDateForInput === 'function') {
        try {
            const normalized = paymentText(normalizeDateForInput(raw));
            const normalizedMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (normalizedMatch) {
                const validated = paymentISOFromParts(normalizedMatch[1], normalizedMatch[2], normalizedMatch[3]);
                if (validated) return validated;
            }
        } catch (_) {}
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        return paymentISOFromParts(isoMatch[1], isoMatch[2], isoMatch[3]);
    }

    const dayFirstMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-]((?:19|20)?\d{2})$/);
    if (dayFirstMatch) {
        const year = dayFirstMatch[3].length === 2 ? `20${dayFirstMatch[3]}` : dayFirstMatch[3];
        return paymentISOFromParts(year, dayFirstMatch[2], dayFirstMatch[1]);
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return paymentISOFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function paymentPaidHistoryYear(value, invoiceData = {}) {
    const iso = paymentDateISO(value);
    if (iso) {
        const year = Number(iso.slice(0, 4));
        if (Number.isInteger(year) && year >= 2000 && year <= 2100) return year;
    }

    const fallbackYear = paymentInvoiceDateYear(invoiceData);
    if (Number.isInteger(fallbackYear) && fallbackYear >= 2000 && fallbackYear <= 2100) return fallbackYear;

    return new Date().getFullYear();
}

function paymentWithAccountsDateValue(invoiceData = {}) {
    return paymentText(
        invoiceData.releaseDate ||
        invoiceData.ReleaseDate ||
        invoiceData['Release Date'] ||
        invoiceData.release_date ||
        invoiceData.withAccountsReleaseDate
    );
}

function paymentDateSortValue(value) {
    const iso = paymentDateISO(value);
    return iso ? Number(iso.replace(/-/g, '')) : -1;
}

function paymentDisplayDate(value) {
    const iso = paymentDateISO(value);
    if (!iso) return 'Date unavailable';
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function paymentNaturalCompare(left, right) {
    return paymentText(left).localeCompare(paymentText(right), undefined, {
        numeric: true,
        sensitivity: 'base'
    });
}

function paymentIsSuperAdmin() {
    const user = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : {};
    const name = paymentNormalize(user.Name || user.name);
    const superName = paymentNormalize(
        typeof SUPER_ADMIN_NAME !== 'undefined' ? SUPER_ADMIN_NAME : ''
    );
    return Boolean(name && superName && name === superName);
}

function canCurrentUserAccessPayments() {
    const user = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : {};
    if (paymentIsSuperAdmin()) return true;

    const role = paymentNormalize(user.Role || user.role);
    if (role !== 'admin') return false;

    const positionTokens = paymentNormalize(user.Position || user.position)
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    return positionTokens.some(token => ['finance', 'accounts', 'accounting'].includes(token));
}

function paymentCanCurrentUserEditPaidDate() {
    if (paymentIsSuperAdmin()) return true;

    const user = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : {};
    const role = paymentNormalize(user.Role || user.role);
    const position = paymentNormalize(user.Position || user.position);
    return role === 'admin' && position === 'accounts';
}

function paymentCanCurrentUserMarkWorkdeskPaid() {
    const user = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : {};
    const role = paymentNormalize(user.Role || user.role);
    if (role !== 'admin') return false;

    const positionTokens = paymentNormalize(user.Position || user.position)
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    return positionTokens.some(token => ['accounts', 'accounting'].includes(token));
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
        invoiceData.Vendor ||
        invoiceData['Vendor Name'] ||
        poData['Supplier Name'] ||
        poData['Supplier Name:'] ||
        poData.Supplier
    ) || 'N/A';
    const supplierId = paymentNormalizeSupplierId(
        invoiceData.vendorId ||
        invoiceData.vendor_id ||
        invoiceData.supplierId ||
        invoiceData.supplier_id ||
        invoiceData['Supplier ID'] ||
        invoiceData['Vendor ID'] ||
        poData['Supplier ID'] ||
        poData['Supplier ID:'] ||
        poData['Vendor ID'] ||
        poData.vendor_id
    );
    const site = paymentText(
        invoiceData.site ||
        invoiceData.siteName ||
        invoiceData.site_name ||
        invoiceData.Site ||
        invoiceData['Project ID'] ||
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
        srvName: paymentText(invoiceData.srvName || invoiceData.srvPDF || invoiceData.srvPdf),
        status: 'With Accounts',
        originalAttention: paymentText(invoiceData.attention),
        invoiceDate: paymentInvoiceDateValue(invoiceData),
        releaseDate: paymentWithAccountsDateValue(invoiceData),
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
        srvName: paymentText(row.srvName || row.srvPDF || row.srvPdf),
        status: paymentText(row.status) || 'With Accounts',
        originalAttention: paymentText(row.originalAttention || row.attention),
        invoiceDate: paymentInvoiceDateValue(row),
        releaseDate: paymentWithAccountsDateValue(row),
        paidDate: paymentDateISO(row.paidDate) || paymentToday()
    };
}


function paymentPaidHistoryPayload(poNumber, invoiceKey, invoiceData = {}, options = {}) {
    const po = paymentText(poNumber).toUpperCase();
    const key = paymentText(invoiceKey);
    if (!po || !key) return null;

    // 11.9.10: Paid History is its own compact pocket. Do not depend on PO/Vendor CSV
    // lookups here; copy the vendor/site identity from the With Accounts pocket row or
    // the filtered Invoice Records row that is already in hand.
    const vendorName = paymentText(
        options.vendorName || options.supplierName ||
        invoiceData.vendorName || invoiceData.supplierName || invoiceData.vendor ||
        invoiceData.Vendor || invoiceData['Vendor Name']
    ) || 'N/A';
    const supplierId = paymentNormalizeSupplierId(
        options.supplierId || options.vendorId ||
        invoiceData.supplierId || invoiceData.vendorId || invoiceData.vendor_id ||
        invoiceData['Supplier ID'] || invoiceData['Vendor ID']
    );
    const site = paymentText(
        options.site || invoiceData.site || invoiceData.siteName || invoiceData.Site ||
        invoiceData['Project ID']
    ) || 'N/A';
    const amountCandidate = options.amountPaid ?? invoiceData.amountPaid ?? invoiceData.invValue;
    const amountPaid = Number(String(amountCandidate ?? '').replace(/,/g, '')) || 0;
    const paidDate = paymentDateISO(options.paidDate || invoiceData.paidDate || invoiceData.actualPaidDate || invoiceData.releaseDate) || '';
    const paidYear = paymentPaidHistoryYear(
        paidDate || options.paidDate || invoiceData.paidDate || invoiceData.actualPaidDate || invoiceData.releaseDate,
        invoiceData
    );
    const withAccountsDate = paymentDateISO(
        options.withAccountsDate ||
        invoiceData.withAccountsReleaseDate ||
        invoiceData.withAccountsDate ||
        paymentWithAccountsDateValue(invoiceData)
    ) || '';
    const markedBy = paymentText(
        options.markedBy ||
        invoiceData.paidBy ||
        invoiceData.updatedBy ||
        (typeof currentApprover !== 'undefined' && currentApprover ? currentApprover.Name : '')
    ) || 'System';

    return {
        indexKey: paymentReadyIndexKey(po, key),
        po,
        invoiceKey: key,
        invoiceNo: paymentText(invoiceData.invNumber || invoiceData.invoiceNo),
        invEntryID: paymentText(invoiceData.invEntryID),
        vendorName,
        vendorNameLower: paymentNormalize(vendorName),
        supplierId,
        site,
        amountPaid,
        invoiceValue: Number(invoiceData.invValue) || Number(invoiceData.invoiceValue) || 0,
        withAccountsDate,
        paidDate,
        paidYear,
        releaseDate: paidDate,
        markedBy,
        paymentMethod: paymentText(
            options.paymentMethod ||
            invoiceData.paymentMethod ||
            invoiceData.modeOfPayment ||
            invoiceData.paymentMode
        ),
        status: 'Paid',
        updatedAt: options.updatedAt !== undefined
            ? options.updatedAt
            : ((typeof firebase !== 'undefined' && firebase.database)
                ? firebase.database.ServerValue.TIMESTAMP
                : Date.now()),
        schemaVersion: 4
    };
}

function paymentNotifyPaidHistoryUpdated(detail = {}) {
    try {
        window.dispatchEvent(new CustomEvent('iba:paid-history-updated', { detail }));
    } catch (_) {}
}

function paymentReadyItemsSnapshot() {
    const items = [];
    paymentReadyIndex.forEach((row, indexKey) => {
        const item = paymentReadyItemFromRow(row, indexKey);
        if (item && paymentNormalize(item.status) === 'with accounts') items.push(item);
    });
    return paymentSortAndDedupeResults(items);
}

function paymentNotifyReadyIndexSubscribers() {
    if (!paymentReadyIndexSubscribers.size) return;
    const items = paymentReadyItemsSnapshot();
    paymentReadyIndexSubscribers.forEach(listener => {
        try { listener(items.map(item => ({ ...item }))); } catch (error) {
            console.warn('Payment pocket subscriber could not be updated:', error);
        }
    });
}

function paymentSubscribeReadyIndex(listener) {
    if (typeof listener !== 'function') return () => {};
    paymentRestoreReadyIndexCache();
    paymentReadyIndexSubscribers.add(listener);
    try { listener(paymentReadyItemsSnapshot().map(item => ({ ...item }))); } catch (_) {}
    paymentEnsureReadyIndexLoaded().catch(error => {
        console.warn('Payment pocket subscription could not load the live pocket:', error);
    });
    return () => paymentReadyIndexSubscribers.delete(listener);
}

function paymentPersistReadyIndexCache() {
    try {
        localStorage.setItem(PAYMENT_READY_CACHE_KEY, JSON.stringify({
            version: '11.6.6',
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
    paymentNotifyReadyIndexSubscribers();
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
            console.warn('Payment-ready pocket could not be loaded. Using the saved local pocket cache.', error);
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
            version: '11.6.6',
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
    paymentNotifyReadyIndexSubscribers();
}

function paymentUpdateReadyMetaMemory(metaKey, row) {
    if (!metaKey) return;
    if (row) paymentReadyMeta.set(metaKey, { ...row, metaKey });
    else paymentReadyMeta.delete(metaKey);
    paymentPersistReadyMetaCache();
}

function paymentInvoiceDatabaseURL() {
    const candidates = [];
    try {
        if (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.app && invoiceDb.app.options) {
            candidates.push(invoiceDb.app.options.databaseURL);
        }
    } catch (_) {}
    try {
        if (typeof invoiceApp !== 'undefined' && invoiceApp && invoiceApp.options) {
            candidates.push(invoiceApp.options.databaseURL);
        }
    } catch (_) {}
    candidates.push('https://invoiceentry-b15a8-default-rtdb.europe-west1.firebasedatabase.app');
    return paymentText(candidates.find(Boolean)).replace(/\/+$/, '');
}

function paymentRestoreInvoicePOKeysCache() {
    try {
        const parsed = JSON.parse(localStorage.getItem(PAYMENT_INVOICE_PO_KEYS_CACHE_KEY) || 'null');
        if (
            !parsed ||
            !Array.isArray(parsed.items) ||
            !(Number(parsed.savedAt) > 0) ||
            Date.now() - Number(parsed.savedAt) > PAYMENT_PO_KEYS_CACHE_MAX_AGE
        ) {
            return null;
        }
        return new Set(parsed.items.map(value => paymentText(value).toUpperCase()).filter(Boolean));
    } catch (error) {
        console.warn('Payment invoice PO-key cache could not be restored:', error);
        return null;
    }
}

function paymentPersistInvoicePOKeysCache(keys) {
    try {
        localStorage.setItem(PAYMENT_INVOICE_PO_KEYS_CACHE_KEY, JSON.stringify({
            version: '11.6.6',
            savedAt: Date.now(),
            items: Array.from(keys || [])
        }));
    } catch (error) {
        console.warn('Payment invoice PO-key cache could not be saved:', error);
    }
}

async function paymentEnsureInvoicePOKeysLoaded() {
    if (paymentInvoicePOKeys.size) return paymentInvoicePOKeys;
    const cached = paymentRestoreInvoicePOKeysCache();
    if (cached && cached.size) {
        paymentInvoicePOKeys = cached;
        return paymentInvoicePOKeys;
    }
    if (paymentInvoicePOKeysLoadPromise) return paymentInvoicePOKeysLoadPromise;

    paymentInvoicePOKeysLoadPromise = (async () => {
        if (typeof fetch !== 'function') {
            const localKeys = new Set(
                Object.keys((typeof allInvoiceData !== 'undefined' && allInvoiceData) || {})
                    .map(value => paymentText(value).toUpperCase())
                    .filter(Boolean)
            );
            paymentInvoicePOKeys = localKeys;
            return paymentInvoicePOKeys;
        }

        const databaseURL = paymentInvoiceDatabaseURL();
        const response = await fetch(`${databaseURL}/invoice_entries.json?shallow=true`, {
            cache: 'no-store',
            mode: 'cors'
        });
        if (!response.ok) {
            throw new Error(`Invoice PO-key lookup failed: ${response.status} ${response.statusText || ''}`.trim());
        }
        const value = await response.json();
        paymentInvoicePOKeys = new Set(
            Object.keys(value || {}).map(po => paymentText(po).toUpperCase()).filter(Boolean)
        );
        paymentPersistInvoicePOKeysCache(paymentInvoicePOKeys);
        return paymentInvoicePOKeys;
    })();

    try {
        return await paymentInvoicePOKeysLoadPromise;
    } catch (error) {
        paymentInvoicePOKeysLoadPromise = null;
        throw error;
    }
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

async function paymentTransferFilteredInvoicesToPocket(records, onProgress) {
    if (!paymentIsSuperAdmin()) {
        throw new Error('Only Irwin/Super Admin can transfer Invoice Records results to the payment pocket.');
    }
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) {
        throw new Error('The Invoice Realtime Database connection is unavailable.');
    }

    await paymentEnsureReadyIndexLoaded();

    const unique = new Map();
    (Array.isArray(records) ? records : []).forEach(record => {
        const po = paymentText(record && (record.po || record.poNumber)).toUpperCase();
        const key = paymentText(record && (record.key || record.invoiceKey));
        const invoice = record && record.invoice && typeof record.invoice === 'object'
            ? record.invoice
            : record;
        if (!po || !key || !invoice || typeof invoice !== 'object') {
            throw new Error('One of the prepared Invoice Records rows has no permanent PO/invoice identity.');
        }
        if (paymentNormalize(record && record.source || invoice.source) === 'ecommit') {
            throw new Error('ECommit-only rows cannot be transferred to the payment pocket.');
        }
        if (paymentNormalize(invoice.status) !== 'with accounts') {
            throw new Error('Every prepared invoice must still have With Accounts status.');
        }
        unique.set(paymentCartId(po, key), { po, key, invoice });
    });

    const prepared = Array.from(unique.values());
    if (!prepared.length) throw new Error('There are no remaining invoices to transfer.');

    let added = 0;
    let refreshed = 0;
    const payloads = prepared.map(({ po, key, invoice }) => {
        const payload = paymentReadyPayload(po, key, invoice);
        if (paymentReadyIndex.has(payload.indexKey)) refreshed += 1;
        else added += 1;
        return payload;
    });

    const batchSize = 200;
    let processed = 0;
    for (let start = 0; start < payloads.length; start += batchSize) {
        const batch = payloads.slice(start, start + batchSize);
        const updates = {};
        batch.forEach(payload => {
            updates[`${PAYMENT_READY_INDEX_PATH}/${payload.indexKey}`] = payload;
        });
        await invoiceDb.ref().update(updates);
        batch.forEach(payload => {
            paymentReadyIndex.set(payload.indexKey, { ...payload, indexKey: payload.indexKey });
        });
        processed += batch.length;
        paymentPersistReadyIndexCache();
        paymentNotifyReadyIndexSubscribers();
        if (typeof onProgress === 'function') {
            onProgress({ processed, total: payloads.length, added, refreshed });
        }
    }

    return {
        total: payloads.length,
        added,
        refreshed,
        items: paymentReadyItemsSnapshot()
    };
}

async function paymentTransferFilteredPaidInvoicesToPocket(records, onProgress) {
    if (!paymentIsSuperAdmin()) {
        throw new Error('Only Irwin/Super Admin can transfer filtered Paid Invoice Records to the Paid History pocket.');
    }
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) {
        throw new Error('The Invoice Realtime Database connection is unavailable.');
    }

    const unique = new Map();
    (Array.isArray(records) ? records : []).forEach(record => {
        const po = paymentText(record && (record.po || record.poNumber)).toUpperCase();
        const key = paymentText(record && (record.key || record.invoiceKey));
        const invoice = record && record.invoice && typeof record.invoice === 'object'
            ? record.invoice
            : record;
        if (!po || !key || !invoice || typeof invoice !== 'object') {
            throw new Error('One of the prepared Paid rows has no permanent PO/invoice identity.');
        }
        if (paymentNormalize(record && record.source || invoice.source) === 'ecommit') {
            throw new Error('ECommit-only rows cannot be transferred to the Paid History pocket.');
        }
        if (paymentNormalize(invoice.status) !== 'paid') {
            throw new Error('Every prepared invoice must have Paid status. Filter Invoice Records to Paid first.');
        }
        unique.set(paymentCartId(po, key), { po, key, invoice });
    });

    const prepared = Array.from(unique.values());
    if (!prepared.length) throw new Error('There are no remaining Paid invoices to transfer.');

    const serverTimestamp = (typeof firebase !== 'undefined' && firebase.database)
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now();
    const payloads = prepared.map(({ po, key, invoice }) => paymentPaidHistoryPayload(po, key, invoice, {
        amountPaid: invoice.amountPaid ?? invoice.invValue,
        paidDate: invoice.paidDate || invoice.actualPaidDate || invoice.releaseDate,
        withAccountsDate: invoice.withAccountsReleaseDate || invoice.withAccountsDate,
        markedBy: invoice.paidBy || invoice.markedBy || invoice.updatedBy || 'Historical Transfer',
        vendorName: invoice.vendorName || invoice.supplierName || invoice.vendor,
        supplierId: invoice.supplierId || invoice.vendorId,
        site: invoice.site || invoice.siteName || invoice['Project ID'],
        updatedAt: serverTimestamp
    })).filter(Boolean);

    if (!payloads.length) throw new Error('No valid Paid records were available for transfer.');

    const batchSize = 200;
    let processed = 0;
    for (let start = 0; start < payloads.length; start += batchSize) {
        const batch = payloads.slice(start, start + batchSize);
        const updates = {};
        batch.forEach(payload => {
            // The permanent PO + invoice key is the pocket identity. Re-running a transfer
            // safely refreshes the same row instead of creating duplicates.
            updates[`${PAYMENT_PAID_HISTORY_PATH}/${payload.paidYear}/${payload.indexKey}`] = payload;
            // 11.9.12: clean any legacy flat copy of the same Paid record.
            updates[`${PAYMENT_PAID_HISTORY_PATH}/${payload.indexKey}`] = null;
        });
        await invoiceDb.ref().update(updates);
        processed += batch.length;
        if (typeof onProgress === 'function') {
            onProgress({ processed, total: payloads.length });
        }
    }

    paymentNotifyPaidHistoryUpdated({
        source: 'invoice-records-paid-transfer',
        count: payloads.length,
        years: Array.from(new Set(payloads.map(payload => String(payload.paidYear))))
    });
    return { total: payloads.length };
}

function paymentPaidDateAfterWithAccounts(value) {
    const iso = paymentDateISO(value);
    if (!iso) return '';
    const [year, month, day] = iso.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    if (next.getUTCDay() === 5) next.setUTCDate(next.getUTCDate() + 1);
    return paymentISOFromParts(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

async function paymentReadExactInvoicesInChunks(items, onProgress) {
    const records = [];
    const chunkSize = 25;
    for (let start = 0; start < items.length; start += chunkSize) {
        const chunk = items.slice(start, start + chunkSize);
        const resolved = await Promise.all(chunk.map(async item => {
            const snapshot = await invoiceDb.ref(`invoice_entries/${item.po}/${item.key}`).once('value');
            return { ...item, currentInvoice: snapshot.val() || null };
        }));
        records.push(...resolved);
        if (typeof onProgress === 'function') {
            onProgress({ phase: 'validating', processed: records.length, total: items.length });
        }
    }
    return records;
}

async function paymentMarkInvoicesPaidInternal(records, onProgress, accessMode) {
    const isWorkdeskPaymentAction = accessMode === 'workdesk-payment-pocket';
    if (isWorkdeskPaymentAction ? !paymentCanCurrentUserMarkWorkdeskPaid() : !paymentIsSuperAdmin()) {
        throw new Error(isWorkdeskPaymentAction
            ? 'Only an Admin with Accounts or Accounting position can mark this Ready for Payment invoice as Paid.'
            : 'Only Irwin/Super Admin can mark filtered Invoice Records as Paid.');
    }
    const actionSource = isWorkdeskPaymentAction
        ? 'WorkDesk Ready for Payment'
        : 'filtered Invoice Records';
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) {
        throw new Error('The Invoice Realtime Database connection is unavailable.');
    }

    const unique = new Map();
    (Array.isArray(records) ? records : []).forEach(record => {
        const po = paymentText(record && (record.po || record.poNumber)).toUpperCase();
        const key = paymentText(record && (record.key || record.invoiceKey));
        const invoice = record && record.invoice && typeof record.invoice === 'object'
            ? record.invoice
            : record;
        if (!po || !key || !invoice || typeof invoice !== 'object') {
            throw new Error('One of the prepared rows has no permanent PO/invoice identity.');
        }
        if (paymentNormalize(record && record.source || invoice.source) === 'ecommit') {
            throw new Error('ECommit-only rows cannot be marked Paid.');
        }
        if (paymentNormalize(invoice.status) !== 'with accounts') {
            throw new Error('Every prepared invoice must have With Accounts status.');
        }
        const withAccountsDate = paymentDateISO(
            paymentText(invoice.withAccountsReleaseDate) || paymentWithAccountsDateValue(invoice)
        );
        const paidDate = paymentPaidDateAfterWithAccounts(withAccountsDate);
        if (!withAccountsDate || !paidDate) {
            throw new Error('Every prepared invoice must have a valid With Accounts Date.');
        }
        if (paidDate > paymentToday()) {
            throw new Error(`The calculated Paid Date for ${paymentText(invoice.invNumber || invoice.invEntryID || po)} is later than today.`);
        }
        unique.set(paymentCartId(po, key), { po, key, invoice, withAccountsDate, paidDate });
    });

    const prepared = Array.from(unique.values());
    if (!prepared.length) throw new Error('There are no remaining invoices to mark Paid.');

    const exactRecords = await paymentReadExactInvoicesInChunks(prepared, onProgress);
    const missing = exactRecords.filter(record => !record.currentInvoice);
    if (missing.length) {
        throw new Error(`${missing.length} invoice record(s) could not be found. Nothing was updated.`);
    }

    const changedStatus = exactRecords.filter(record => paymentNormalize(record.currentInvoice.status) !== 'with accounts');
    if (changedStatus.length) {
        throw new Error(`${changedStatus.length} invoice record(s) are no longer With Accounts. Refresh Invoice Records; nothing was updated.`);
    }

    const changedDates = exactRecords.filter(record => {
        const currentDate = paymentDateISO(
            paymentText(record.currentInvoice.withAccountsReleaseDate) || paymentWithAccountsDateValue(record.currentInvoice)
        );
        return !currentDate || currentDate !== record.withAccountsDate;
    });
    if (changedDates.length) {
        throw new Error(`${changedDates.length} With Accounts Date value(s) changed after the search. Refresh Invoice Records; nothing was updated.`);
    }

    const serverTimestamp = (typeof firebase !== 'undefined' && firebase.database)
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now();
    const updates = {};
    const markedBy = paymentText(currentApprover?.Name) || 'System';
    exactRecords.forEach(record => {
        const basePath = `invoice_entries/${record.po}/${record.key}`;
        updates[`${basePath}/status`] = 'Paid';
        updates[`${basePath}/attention`] = '';
        updates[`${basePath}/withAccountsReleaseDate`] = record.withAccountsDate;
        updates[`${basePath}/paidDate`] = record.paidDate;
        updates[`${basePath}/releaseDate`] = record.paidDate;
        updates[`${basePath}/paidBy`] = markedBy;
        updates[`${basePath}/statusChangedAt`] = serverTimestamp;
        updates[`${basePath}/statusQueueAt`] = serverTimestamp;
        updates[`${basePath}/lastUpdated`] = serverTimestamp;
        updates[`${basePath}/updatedAt`] = serverTimestamp;
        updates[`${PAYMENT_READY_INDEX_PATH}/${paymentReadyIndexKey(record.po, record.key)}`] = null;

        const paidHistory = paymentPaidHistoryPayload(record.po, record.key, record.currentInvoice, {
            amountPaid: record.currentInvoice.amountPaid ?? record.invoice.amountPaid ?? record.currentInvoice.invValue,
            paidDate: record.paidDate,
            withAccountsDate: record.withAccountsDate,
            markedBy,
            vendorName: record.invoice.vendorName || record.invoice.supplierName || record.currentInvoice.vendorName || record.currentInvoice.supplierName,
            supplierId: record.invoice.supplierId || record.invoice.vendorId || record.currentInvoice.supplierId || record.currentInvoice.vendorId,
            site: record.invoice.site || record.invoice.siteName || record.currentInvoice.site || record.currentInvoice.siteName,
            updatedAt: serverTimestamp
        });
        if (paidHistory) {
            updates[`${PAYMENT_PAID_HISTORY_PATH}/${paidHistory.paidYear}/${paidHistory.indexKey}`] = paidHistory;
            updates[`${PAYMENT_PAID_HISTORY_PATH}/${paidHistory.indexKey}`] = null;
        }
    });

    if (typeof onProgress === 'function') {
        onProgress({ phase: 'saving', processed: 0, total: exactRecords.length });
    }
    await invoiceDb.ref().update(updates);
    paymentNotifyPaidHistoryUpdated({
        source: actionSource,
        count: exactRecords.length,
        years: Array.from(new Set(exactRecords.map(record => String(paymentPaidHistoryYear(record.paidDate, record.currentInvoice || {})))))
    });

    exactRecords.forEach(record => {
        const localUpdates = {
            status: 'Paid',
            attention: '',
            paidBy: markedBy,
            withAccountsReleaseDate: record.withAccountsDate,
            paidDate: record.paidDate,
            releaseDate: record.paidDate,
            statusChangedAt: Date.now(),
            statusQueueAt: Date.now(),
            lastUpdated: Date.now(),
            updatedAt: Date.now()
        };
        record.updatedInvoice = { ...record.currentInvoice, ...localUpdates };
        if (!allInvoiceData) allInvoiceData = {};
        if (!allInvoiceData[record.po]) allInvoiceData[record.po] = {};
        allInvoiceData[record.po][record.key] = { ...record.updatedInvoice, key: record.key };
        paymentReadyIndex.delete(paymentReadyIndexKey(record.po, record.key));
    });
    paymentPersistReadyIndexCache();
    paymentNotifyReadyIndexSubscribers();

    let syncFailures = 0;
    const syncChunkSize = 10;
    for (let start = 0; start < exactRecords.length; start += syncChunkSize) {
        const chunk = exactRecords.slice(start, start + syncChunkSize);
        const sideEffects = [];
        chunk.forEach(record => {
            if (typeof updateLinkedJobEntry === 'function') {
                sideEffects.push(Promise.resolve().then(() =>
                    updateLinkedJobEntry(record.po, record.key, 'Paid', `Marked Paid from ${actionSource}`)
                ));
            }
            if (typeof updateInvoiceTaskLookup === 'function') {
                sideEffects.push(Promise.resolve().then(() =>
                    updateInvoiceTaskLookup(
                        record.po,
                        record.key,
                        record.updatedInvoice,
                        record.currentInvoice.attention,
                        { skipPaymentReadySync: true }
                    )
                ));
            }
            if (window.logInvoiceHistory) {
                sideEffects.push(Promise.resolve().then(() =>
                    window.logInvoiceHistory(
                        record.po,
                        record.key,
                        'Paid',
                        `Marked Paid from ${actionSource}. With Accounts: ${record.withAccountsDate}; Paid: ${record.paidDate}`
                    )
                ));
            }
            try {
                if (typeof logRecentUpdate === 'function') logRecentUpdate(record.po);
            } catch (_) {}
        });
        const settled = await Promise.allSettled(sideEffects);
        syncFailures += settled.filter(result => result.status === 'rejected').length;
        if (typeof onProgress === 'function') {
            onProgress({
                phase: 'syncing',
                processed: Math.min(start + chunk.length, exactRecords.length),
                total: exactRecords.length
            });
        }
    }

    try {
        allSystemEntries = [];
        if (typeof cacheTimestamps !== 'undefined' && cacheTimestamps) cacheTimestamps.systemEntries = 0;
    } catch (_) {}

    return {
        total: exactRecords.length,
        pocketRemoved: exactRecords.length,
        syncFailures,
        records: exactRecords.map(record => ({
            po: record.po,
            key: record.key,
            withAccountsDate: record.withAccountsDate,
            paidDate: record.paidDate
        }))
    };
}

async function paymentMarkFilteredInvoicesPaid(records, onProgress) {
    return paymentMarkInvoicesPaidInternal(records, onProgress, 'invoice-records');
}

async function paymentMarkWorkdeskInvoicePaid(record, onProgress) {
    return paymentMarkInvoicesPaidInternal([record], onProgress, 'workdesk-payment-pocket');
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
    list.forEach(item => paymentReadyIndex.delete(paymentReadyIndexKey(item.po, item.key)));
    paymentPersistReadyIndexCache();
    paymentNotifyReadyIndexSubscribers();
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
            version: '11.6.6',
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
                amountPaid: Number(item.amountPaid) || 0,
                releaseDate: paymentWithAccountsDateValue(item),
                paidDate: paymentDateISO(item.paidDate) || paymentToday()
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

function paymentGroupKey(vendor, paidDate) {
    return `${paymentNormalize(vendor) || 'unknown'}|${paymentDateISO(paidDate) || 'no-date'}`;
}

function paymentGroupLabelDate(value) {
    const normalized = paymentDateISO(value);
    return normalized ? paymentDisplayDate(normalized) : 'No Paid Date';
}

function updatePaymentGroupSubtotal(groupId) {
    const subtotalEl = document.querySelector(`[data-payment-group-subtotal="${groupId}"]`);
    if (!subtotalEl) return;
    let total = 0;
    document.querySelectorAll(`#im-payments-table-body tr[data-payment-group-id="${groupId}"] .im-payment-amount-input`).forEach(input => {
        total += paymentParseAmount(input.value);
    });
    subtotalEl.textContent = paymentCurrency(total);
}

function renderPaymentsCart() {
    if (!imPaymentsTableBody) return;
    const items = paymentCartItems().slice().sort((a, b) => {
        return paymentNaturalCompare(a.supplierName, b.supplierName) ||
            paymentDateSortValue(a.paidDate) - paymentDateSortValue(b.paidDate) ||
            paymentNaturalCompare(a.invoiceNo || a.invEntryID, b.invoiceNo || b.invEntryID);
    });
    const canEditPaidDate = paymentCanCurrentUserEditPaidDate();
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
    let currentGroupKey = '';
    let groupIndex = 0;
    items.forEach(item => {
        item.releaseDate = paymentWithAccountsDateValue(item);
        item.paidDate = canEditPaidDate
            ? (paymentDateISO(item.paidDate) || paymentToday())
            : paymentToday();

        const groupKey = paymentGroupKey(item.supplierName, item.paidDate);
        if (groupKey !== currentGroupKey) {
            currentGroupKey = groupKey;
            const groupId = `payment-group-${++groupIndex}`;
            const groupRow = document.createElement('tr');
            groupRow.className = 'im-payment-vendor-group-row';
            groupRow.dataset.paymentGroupKey = groupKey;
            groupRow.dataset.paymentGroupId = groupId;
            const groupCell = document.createElement('td');
            groupCell.colSpan = 8;
            groupCell.innerHTML = `
                <div class="im-payment-vendor-group-heading">
                    <div><i class="fa-solid fa-building"></i><strong>${escapeHtml(item.supplierName || 'Unknown Vendor')}</strong><span>Paid Date: ${paymentGroupLabelDate(item.paidDate)}</span></div>
                    <div>Group Total: <strong data-payment-group-subtotal="${groupId}">QAR 0.00</strong></div>
                </div>`;
            groupRow.appendChild(groupCell);
            imPaymentsTableBody.appendChild(groupRow);
            items.forEach(groupItem => {
                if (paymentGroupKey(groupItem.supplierName, groupItem.paidDate) === groupKey) groupItem.__paymentGroupId = groupId;
            });
        }

        const row = document.createElement('tr');
        row.dataset.key = item.id;
        row.dataset.po = item.po;
        row.dataset.paymentGroupId = item.__paymentGroupId || '';

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
            updatePaymentGroupSubtotal(row.dataset.paymentGroupId);
        });
        amountInput.addEventListener('blur', () => {
            item.amountPaid = paymentParseAmount(amountInput.value);
            amountInput.value = paymentCurrency(item.amountPaid);
            persistPaymentCart();
            updatePaymentGroupSubtotal(row.dataset.paymentGroupId);
        });
        amountCell.appendChild(amountInput);

        const withAccountsDateCell = document.createElement('td');
        withAccountsDateCell.innerHTML = `<span class="im-payment-with-accounts-date${item.releaseDate ? '' : ' is-missing'}"><i class="fa-solid fa-calendar-day"></i> ${paymentDisplayDate(item.releaseDate)}</span>`;

        const paidDateCell = document.createElement('td');
        const paidDateInput = document.createElement('input');
        paidDateInput.type = 'date';
        paidDateInput.className = 'im-payment-paid-date-input';
        paidDateInput.value = item.paidDate;
        paidDateInput.max = paymentToday();
        paidDateInput.readOnly = !canEditPaidDate;
        paidDateInput.disabled = !canEditPaidDate;
        paidDateInput.title = canEditPaidDate
            ? 'Super Admin and Accounts Admin users may select the actual paid date.'
            : 'Paid Date is locked to today for users without Accounts date-edit permission.';
        paidDateInput.setAttribute('aria-label', `Paid date for ${item.invoiceNo || item.po}`);
        if (canEditPaidDate) {
            paidDateInput.addEventListener('change', () => {
                const normalizedDate = paymentDateISO(paidDateInput.value);
                if (!normalizedDate || normalizedDate > paymentToday()) {
                    alert('Paid Date must be a valid date and cannot be later than today.');
                    paidDateInput.value = item.paidDate || paymentToday();
                    return;
                }
                item.paidDate = normalizedDate;
                paidDateInput.value = normalizedDate;
                persistPaymentCart();
                renderPaymentsCart();
            });
        }
        paidDateCell.appendChild(paidDateInput);

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
        removeButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            removePaymentCartItem(item.id);
        });
        actionCell.appendChild(removeButton);

        [invoiceCell, poCell, companyCell, amountCell, withAccountsDateCell, paidDateCell, statusCell, actionCell]
            .forEach(cell => row.appendChild(cell));
        imPaymentsTableBody.appendChild(row);
        total += Number(item.amountPaid) || 0;
    });

    // Calculate each displayed vendor/date group subtotal from the rendered rows.
    imPaymentsTableBody.querySelectorAll('[data-payment-group-subtotal]').forEach(el => {
        updatePaymentGroupSubtotal(el.dataset.paymentGroupSubtotal);
    });
    if (totalEl) totalEl.textContent = paymentCurrency(total);
    updatePaymentsCount();
}

async function initializePaymentsWorkspace() {
    if (!canCurrentUserAccessPayments()) return;
    restorePaymentCart();
    renderPaymentsCart();
    paymentEnsureReadyIndexLoaded();
    const statusEl = document.getElementById('im-payment-status-message');
    if (statusEl) statusEl.textContent = '';
}

function openPaymentSearchModal() {
    if (!canCurrentUserAccessPayments()) {
        alert('Access Denied: Payments requires an Admin role with a Finance, Accounts, or Accounting position.');
        return;
    }
    paymentModalGlobalPaidDate = paymentToday();
    const globalPaidDateInput = document.getElementById('im-payment-modal-global-date');
    if (globalPaidDateInput) {
        globalPaidDateInput.value = paymentModalGlobalPaidDate;
        globalPaidDateInput.max = paymentToday();
        const canEditGlobalDate = paymentCanCurrentUserEditPaidDate();
        globalPaidDateInput.disabled = !canEditGlobalDate;
        globalPaidDateInput.title = canEditGlobalDate
            ? 'This date applies to newly added invoices while this popup remains open.'
            : 'Paid Date is locked to today for users without Accounts date-edit permission.';
        globalPaidDateInput.onchange = () => {
            const normalizedDate = paymentDateISO(globalPaidDateInput.value);
            if (!normalizedDate || normalizedDate > paymentToday()) {
                globalPaidDateInput.value = paymentModalGlobalPaidDate || paymentToday();
                return;
            }
            paymentModalGlobalPaidDate = normalizedDate;
            globalPaidDateInput.value = normalizedDate;
        };
    }
    if (imPaymentModalPOInput) imPaymentModalPOInput.value = '';
    if (imPaymentModalResults) {
        imPaymentModalResults.innerHTML = '<p>Press Search with the box empty to show every current With Accounts invoice, or enter a company, PO, or invoice number.</p>';
    }
    const legacyControls = document.getElementById('im-payment-legacy-controls');
    const legacyToggle = document.getElementById('im-payment-legacy-toggle');
    if (legacyToggle) legacyToggle.checked = false;
    if (legacyControls) legacyControls.classList.toggle('hidden', !paymentIsSuperAdmin());
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

async function paymentFetchWithAccountsPOBucketWithRetry(poNumber, maxAttempts = 2) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await paymentFetchWithAccountsPOBucket(poNumber);
            return paymentText(poNumber).toUpperCase();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 150 * attempt));
            }
        }
    }
    throw lastError || new Error(`With Accounts lookup failed for PO ${poNumber}.`);
}

async function paymentFetchWithAccountsPOs(poNumbers, onProgress) {
    const poList = Array.from(new Set(
        (poNumbers || []).map(po => paymentText(po).toUpperCase()).filter(Boolean)
    ));
    const succeeded = [];
    const failed = [];
    let processed = 0;

    for (let index = 0; index < poList.length; index += 12) {
        const batch = poList.slice(index, index + 12);
        const results = await Promise.allSettled(
            batch.map(po => paymentFetchWithAccountsPOBucketWithRetry(po, 2))
        );
        results.forEach((result, resultIndex) => {
            const po = batch[resultIndex];
            if (result.status === 'fulfilled') {
                succeeded.push(po);
            } else {
                failed.push({ po, error: result.reason });
            }
        });
        processed += batch.length;
        if (typeof onProgress === 'function') onProgress(processed, poList.length);
    }

    return { succeeded, failed };
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
        originalAttention: paymentText(invoiceData.attention),
        invoiceDate: paymentInvoiceDateValue(invoiceData),
        releaseDate: paymentWithAccountsDateValue(invoiceData),
        paidDate: paymentModalGlobalPaidDate || paymentToday()
    };
}

function paymentCollectMatches(poNumbers, queryText, options = {}) {
    const query = paymentNormalize(queryText);
    const recoveryYear = Number(options && options.recoveryYear) || 0;
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
            if (recoveryYear && !paymentInvoiceMatchesRecoveryYear(invoice || {}, recoveryYear)) return;
            const item = paymentResultFromInvoice(po, key, invoice || {});
            const invoiceMatch = paymentNormalize(item.invoiceNo).includes(query);
            const entryMatch = paymentNormalize(item.invEntryID).includes(query);
            const invoiceSupplierMatch = paymentNormalize(item.supplierName).includes(query);
            const invoiceSupplierIdMatch = paymentNormalizeSupplierId(item.supplierId).toLowerCase().includes(query);
            if (!(poMatch || supplierMatch || supplierIdMatch || invoiceMatch || entryMatch || invoiceSupplierMatch || invoiceSupplierIdMatch)) return;
            if (!cartIds.has(item.id)) results.push(item);
        });
    });

    return paymentSortAndDedupeResults(results, options);
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
        if (!query || fields.some(value => paymentNormalize(value).includes(query))) results.push(item);
    });
    return paymentSortAndDedupeResults(results);
}

function paymentIsExactPOQuery(queryText, results = []) {
    const query = paymentText(queryText).toUpperCase();
    if (!/^\d{3,}$/.test(query)) return false;
    return !results.length || results.every(item => paymentText(item && item.po).toUpperCase() === query);
}

function paymentSortAndDedupeResults(results, options = {}) {
    const unique = new Map();
    (results || []).forEach(item => {
        if (item && item.id) unique.set(item.id, item);
    });
    const items = Array.from(unique.values());
    const exactPO = Boolean(options.exactPO) || paymentIsExactPOQuery(options.queryText, items);

    return items.sort((a, b) => {
        if (exactPO) {
            return paymentNaturalCompare(a.invoiceNo || a.invEntryID, b.invoiceNo || b.invEntryID) ||
                paymentDateSortValue(b.releaseDate) - paymentDateSortValue(a.releaseDate) ||
                paymentNaturalCompare(a.supplierName, b.supplierName);
        }
        return paymentDateSortValue(b.releaseDate) - paymentDateSortValue(a.releaseDate) ||
            paymentNaturalCompare(a.supplierName, b.supplierName) ||
            paymentNaturalCompare(a.po, b.po) ||
            paymentNaturalCompare(a.invoiceNo || a.invEntryID, b.invoiceNo || b.invEntryID);
    });
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

function paymentPOMapForVendorTargets(targets, existingPOKeys = null) {
    const poMap = new Map();
    (targets || []).filter(Boolean).forEach(target => {
        const targetPOs = paymentPOsForVendorTargets([target]).filter(po =>
            !existingPOKeys || existingPOKeys.has(paymentText(po).toUpperCase())
        );
        poMap.set(target.metaKey, targetPOs);
    });
    return poMap;
}

function paymentPOUnionFromTargetMap(targetPOMap) {
    const poNumbers = new Set();
    (targetPOMap || new Map()).forEach(targetPOs => {
        (targetPOs || []).forEach(po => poNumbers.add(paymentText(po).toUpperCase()));
    });
    return Array.from(poNumbers).filter(Boolean);
}

function paymentVendorTargetIsComplete(target) {
    if (!target || !target.metaKey) return false;
    const row = paymentReadyMeta.get(target.metaKey);
    return Boolean(
        row &&
        Object.prototype.hasOwnProperty.call(row, 'completedAt') &&
        Number(row.recoveryYear) === PAYMENT_LEGACY_RECOVERY_YEAR &&
        Number(row.schemaVersion) >= 2
    );
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

async function paymentCommitReadyBackfill(items, completedTargets = [], targetPOMap = new Map()) {
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
            Number(current.amountPaid) === Number(payload.amountPaid) &&
            Number(current.invoiceValue) === Number(payload.invoiceValue) &&
            paymentText(current.srvName) === payload.srvName &&
            paymentDateISO(current.releaseDate) === paymentDateISO(payload.releaseDate)
        ) {
            return;
        }
        updates[`${PAYMENT_READY_INDEX_PATH}/${payload.indexKey}`] = payload;
        localRows.push(payload);
    });

    (completedTargets || []).forEach(target => {
        if (!target || !target.metaKey) return;
        const targetPOs = targetPOMap.get(target.metaKey) || [];
        const targetPOSet = new Set(targetPOs);
        const metaRow = {
            metaKey: target.metaKey,
            supplierId: target.supplierId,
            vendorName: target.vendorName,
            vendorNameLower: paymentNormalize(target.vendorName),
            completedAt: serverTimestamp,
            poCount: targetPOs.length,
            invoiceCount: (items || []).filter(item => targetPOSet.has(item.po)).length,
            recoveryYear: PAYMENT_LEGACY_RECOVERY_YEAR,
            schemaVersion: 2
        };
        updates[`${PAYMENT_READY_META_PATH}/${target.metaKey}`] = metaRow;
        localMetaRows.push(metaRow);
    });

    if (!Object.keys(updates).length) return;
    await invoiceDb.ref().update(updates);
    if (localRows.length) {
        localRows.forEach(payload => paymentReadyIndex.set(payload.indexKey, { ...payload, indexKey: payload.indexKey }));
        paymentPersistReadyIndexCache();
        paymentNotifyReadyIndexSubscribers();
    }
    localMetaRows.forEach(metaRow => paymentUpdateReadyMetaMemory(metaRow.metaKey, metaRow));
}

function paymentRenderSearchResults(results, options = {}) {
    const exactPO = Boolean(options.exactPO) || paymentIsExactPOQuery(options.queryText, results);
    const sortedResults = paymentSortAndDedupeResults(results, {
        queryText: options.queryText,
        exactPO
    });
    paymentSearchResults = new Map(sortedResults.map(item => [item.id, item]));
    imPaymentModalResults.innerHTML = '';

    if (!sortedResults.length) {
        imPaymentModalResults.innerHTML = '<p>No matching With Accounts invoices were found, or the matching records are already in the payment list.</p>';
        const totalDisplay = document.getElementById('payment-modal-total-value');
        if (totalDisplay) totalDisplay.textContent = paymentCurrency(0);
        return;
    }

    const companyCount = new Set(sortedResults.map(item => paymentNormalize(item.supplierName))).size;
    const poCount = new Set(sortedResults.map(item => paymentText(item.po).toUpperCase())).size;
    const invoiceWord = sortedResults.length === 1 ? 'invoice' : 'invoices';
    const poWord = poCount === 1 ? 'PO' : 'POs';
    const companyWord = companyCount === 1 ? 'company' : 'companies';
    const resultSummary = document.createElement('div');
    resultSummary.className = 'im-payment-result-summary';
    resultSummary.innerHTML = `
        <i class="fa-solid fa-list-check"></i>
        <span><strong>${sortedResults.length}</strong> With Accounts ${invoiceWord} found across <strong>${poCount}</strong> ${poWord} from <strong>${companyCount}</strong> ${companyWord}. ${exactPO ? 'Invoice numbers are arranged in natural order.' : 'Newest With Accounts date is shown first.'}</span>
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

    let currentDateGroup = null;
    sortedResults.forEach(item => {
        const dateGroup = paymentDateISO(item.releaseDate) || '__missing__';
        if (!exactPO && dateGroup !== currentDateGroup) {
            const groupRow = document.createElement('tr');
            groupRow.className = `im-payment-date-group${dateGroup === '__missing__' ? ' is-missing' : ''}`;
            const groupCell = document.createElement('td');
            groupCell.colSpan = 6;
            groupCell.innerHTML = `<i class="fa-solid fa-calendar-day"></i> With Accounts Date: <strong>${paymentDisplayDate(item.releaseDate)}</strong>`;
            groupRow.appendChild(groupCell);
            tbody.appendChild(groupRow);
            currentDateGroup = dateGroup;
        }

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
    const legacyToggle = document.getElementById('im-payment-legacy-toggle');
    const legacyMode = Boolean(legacyToggle && legacyToggle.checked);

    // Hiding the control is not treated as security. This guard prevents every
    // archive path unless the current signed-in user is the Super Admin.
    if (legacyMode && !paymentIsSuperAdmin()) {
        if (legacyToggle) legacyToggle.checked = false;
        imPaymentModalResults.innerHTML = '<p>Legacy Archive Search is restricted to the Super Admin.</p>';
        return;
    }
    if (legacyMode && !query) {
        imPaymentModalResults.innerHTML = '<p>Enter an exact PO number or part of a company name before using Legacy Archive Search.</p>';
        return;
    }

    imPaymentModalResults.innerHTML = legacyMode
        ? '<p><i class="fa-solid fa-spinner fa-spin"></i> Preparing targeted Super Admin archive search…</p>'
        : '<p><i class="fa-solid fa-spinner fa-spin"></i> Searching the current With Accounts pocket…</p>';
    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (totalDisplay) totalDisplay.textContent = paymentCurrency(0);

    try {
        await paymentEnsureReadyIndexLoaded();
        const pocketResults = paymentCollectReadyMatches(query);

        // Normal Finance/Accounts/Accounting searches stop here. They never
        // inspect invoice_entries, including when no pocket match is found.
        if (!legacyMode) {
            paymentRenderSearchResults(pocketResults, {
                queryText: query,
                source: 'pocket'
            });
            return;
        }

        await paymentEnsurePOBaseData();

        const queryUpper = paymentText(query).toUpperCase();
        const exactPO = /^\d{3,}$/.test(queryUpper);
        const indexedResults = exactPO
            ? pocketResults
            : pocketResults.filter(item => paymentInvoiceMatchesRecoveryYear(item, PAYMENT_LEGACY_RECOVERY_YEAR));
        const vendorTargets = exactPO ? [] : paymentVendorTargetsForQuery(query);
        let targetPOMap = new Map();
        let candidateList = [];

        if (exactPO) {
            // An exact PO is already a targeted database path, so it may recover
            // older genuine With Accounts records from any invoice year.
            candidateList = [queryUpper];
        } else if (vendorTargets.length) {
            let existingPOKeys = null;
            try {
                imPaymentModalResults.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Checking existing invoice POs…</p>';
                existingPOKeys = await paymentEnsureInvoicePOKeysLoaded();
            } catch (poKeyError) {
                console.warn('Lightweight invoice PO-key lookup failed. Using matching vendor POs directly.', poKeyError);
            }
            // Explicit Super Admin recovery rechecks matching vendors even when
            // older completion metadata exists; this also refreshes missing dates.
            targetPOMap = paymentPOMapForVendorTargets(vendorTargets, existingPOKeys);
            candidateList = paymentPOUnionFromTargetMap(targetPOMap);
        } else {
            candidateList = paymentCandidatePOsForQuery(query);
        }

        if (!candidateList.length) {
            paymentRenderSearchResults(indexedResults, {
                queryText: query,
                exactPO,
                source: 'legacy'
            });
            return;
        }

        const recovery = await paymentFetchWithAccountsPOs(candidateList, (processed, total) => {
            imPaymentModalResults.innerHTML = `
                <p><i class="fa-solid fa-spinner fa-spin"></i>
                ${exactPO ? 'Checking the selected PO across all years' : `Recovering ${PAYMENT_LEGACY_RECOVERY_YEAR} With Accounts invoices`}… ${processed} of ${total} POs checked.</p>
            `;
        });

        const targetedResults = paymentCollectMatches(recovery.succeeded, query, {
            recoveryYear: exactPO ? 0 : PAYMENT_LEGACY_RECOVERY_YEAR,
            queryText: query,
            exactPO
        });
        const failedPOs = new Set(recovery.failed.map(item => item.po));
        const completedVendorTargets = vendorTargets.filter(target =>
            (targetPOMap.get(target.metaKey) || []).every(po => !failedPOs.has(po))
        );
        if (targetedResults.length || vendorTargets.length) {
            try {
                await paymentCommitReadyBackfill(
                    targetedResults,
                    completedVendorTargets,
                    targetPOMap
                );
            } catch (indexError) {
                console.warn('Targeted payment-ready vendor backfill skipped:', indexError);
            }
        }

        const results = paymentSortAndDedupeResults([
            ...indexedResults,
            ...targetedResults
        ], {
            queryText: query,
            exactPO
        });
        paymentRenderSearchResults(results, {
            queryText: query,
            exactPO,
            source: 'legacy'
        });
        if (
            recovery.failed.length &&
            imPaymentModalResults &&
            typeof imPaymentModalResults.insertAdjacentHTML === 'function'
        ) {
            imPaymentModalResults.insertAdjacentHTML(
                'afterbegin',
                `<div class="im-payment-recovery-warning">
                    ${recovery.failed.length} PO lookup(s) could not be completed and will be retried on the next search.
                </div>`
            );
        }
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
        invoicesToPay[item.id] = {
            ...item,
            releaseDate: paymentWithAccountsDateValue(item),
            // The popup global date applies only at the moment this invoice is added.
            // After insertion, the cart row is independent from the popup date.
            paidDate: paymentModalGlobalPaidDate || paymentToday()
        };
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
    const canEditPaidDate = paymentCanCurrentUserEditPaidDate();
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

    const today = paymentToday();
    const invalidPaidDates = [];
    items.forEach(item => {
        const selectedDate = canEditPaidDate ? paymentDateISO(item.paidDate) : today;
        if (!selectedDate || selectedDate > today) {
            invalidPaidDates.push(item.invoiceNo || item.po);
            return;
        }
        item.paidDate = selectedDate;
    });
    if (invalidPaidDates.length) {
        alert(`Paid Date must be valid and cannot be later than today. Please check: ${invalidPaidDates.join(', ')}`);
        return;
    }

    const companyNames = Array.from(new Set(
        items.map(item => paymentText(item.supplierName) || 'Unknown company')
    ));
    const companySummary = companyNames.length === 1
        ? companyNames[0]
        : `${companyNames.length} companies`;
    const total = items.reduce((sum, item) => sum + (Number(item.amountPaid) || 0), 0);
    const paidDates = Array.from(new Set(items.map(item => item.paidDate)));
    const paidDateSummary = paidDates.length === 1
        ? paymentDisplayDate(paidDates[0])
        : `${paidDates.length} selected Paid Dates`;
    const confirmed = confirm(
        `Mark ${items.length} invoice(s) from ${companySummary} as Paid?\n\n` +
        `Total Sum: ${paymentCurrency(total)}\n\n` +
        `Paid Date: ${paidDateSummary}\n\n` +
        'The existing With Accounts Date will be preserved, and Release Date will become the selected Paid Date.'
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

        const serverTimestamp = (typeof firebase !== 'undefined' && firebase.database)
            ? firebase.database.ServerValue.TIMESTAMP
            : Date.now();
        const batchUpdates = {};
        const markedBy = paymentText(currentApprover?.Name) || 'System';

        currentRecords.forEach(({ item, invoice }) => {
            const basePath = `invoice_entries/${item.po}/${item.key}`;
            const withAccountsDate = paymentText(invoice.withAccountsReleaseDate) ||
                paymentWithAccountsDateValue(invoice) ||
                paymentWithAccountsDateValue(item);
            batchUpdates[`${basePath}/status`] = 'Paid';
            batchUpdates[`${basePath}/amountPaid`] = Number(item.amountPaid);
            if (!paymentText(invoice.withAccountsReleaseDate) && withAccountsDate) {
                batchUpdates[`${basePath}/withAccountsReleaseDate`] = withAccountsDate;
            }
            batchUpdates[`${basePath}/paidDate`] = item.paidDate;
            batchUpdates[`${basePath}/releaseDate`] = item.paidDate;
            batchUpdates[`${basePath}/paidBy`] = markedBy;
            batchUpdates[`${basePath}/statusChangedAt`] = serverTimestamp;
            batchUpdates[`${basePath}/statusQueueAt`] = serverTimestamp;
            batchUpdates[`${basePath}/lastUpdated`] = serverTimestamp;
            batchUpdates[`${basePath}/updatedAt`] = serverTimestamp;
            batchUpdates[`${PAYMENT_READY_INDEX_PATH}/${paymentReadyIndexKey(item.po, item.key)}`] = null;

            const paidHistory = paymentPaidHistoryPayload(item.po, item.key, invoice, {
                amountPaid: Number(item.amountPaid),
                paidDate: item.paidDate,
                withAccountsDate,
                markedBy,
                vendorName: item.supplierName || item.vendorName,
                supplierId: item.supplierId || item.vendorId,
                site: item.site,
                updatedAt: serverTimestamp
            });
            if (paidHistory) {
                batchUpdates[`${PAYMENT_PAID_HISTORY_PATH}/${paidHistory.paidYear}/${paidHistory.indexKey}`] = paidHistory;
                batchUpdates[`${PAYMENT_PAID_HISTORY_PATH}/${paidHistory.indexKey}`] = null;
            }
        });

        if (statusEl) statusEl.textContent = 'Marking invoices Paid…';
        await invoiceDb.ref().update(batchUpdates);
        paymentNotifyPaidHistoryUpdated({
            source: 'invoice-management-payments',
            count: currentRecords.length,
            years: Array.from(new Set(currentRecords.map(({ item, invoice }) => String(paymentPaidHistoryYear(item.paidDate, invoice || {})))))
        });

        currentRecords.forEach(({ item, invoice }) => {
            const withAccountsDate = paymentText(invoice.withAccountsReleaseDate) ||
                paymentWithAccountsDateValue(invoice) ||
                paymentWithAccountsDateValue(item);
            const localUpdates = {
                status: 'Paid',
                amountPaid: Number(item.amountPaid),
                paidBy: markedBy,
                paidDate: item.paidDate,
                releaseDate: item.paidDate,
                statusChangedAt: Date.now(),
                statusQueueAt: Date.now(),
                lastUpdated: Date.now()
            };
            if (!paymentText(invoice.withAccountsReleaseDate) && withAccountsDate) {
                localUpdates.withAccountsReleaseDate = withAccountsDate;
            }
            if (!allInvoiceData) allInvoiceData = {};
            if (!allInvoiceData[item.po]) allInvoiceData[item.po] = {};
            allInvoiceData[item.po][item.key] = { ...invoice, ...localUpdates };
            paymentReadyIndex.delete(paymentReadyIndexKey(item.po, item.key));
        });
        paymentPersistReadyIndexCache();
        paymentNotifyReadyIndexSubscribers();

        if (statusEl) statusEl.textContent = 'Synchronizing linked payment records…';
        const syncResults = await Promise.allSettled(currentRecords.flatMap(({ item, invoice }) => {
            const withAccountsDate = paymentText(invoice.withAccountsReleaseDate) ||
                paymentWithAccountsDateValue(invoice) ||
                paymentWithAccountsDateValue(item);
            const updatedInvoice = {
                ...invoice,
                status: 'Paid',
                amountPaid: Number(item.amountPaid),
                paidBy: markedBy,
                paidDate: item.paidDate,
                releaseDate: item.paidDate,
                ...(!paymentText(invoice.withAccountsReleaseDate) && withAccountsDate
                    ? { withAccountsReleaseDate: withAccountsDate }
                    : {}),
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
window.ibaPaymentPocket = {
    ensureLoaded: paymentEnsureReadyIndexLoaded,
    getItems: paymentReadyItemsSnapshot,
    subscribe: paymentSubscribeReadyIndex,
    transferFilteredInvoices: paymentTransferFilteredInvoicesToPocket,
    transferFilteredPaidInvoices: paymentTransferFilteredPaidInvoicesToPocket,
    markFilteredInvoicesPaid: paymentMarkFilteredInvoicesPaid,
    markWorkdeskInvoicePaid: paymentMarkWorkdeskInvoicePaid,
    calculatePaidDate: paymentPaidDateAfterWithAccounts,
    displayDate: paymentDisplayDate,
    isSuperAdmin: paymentIsSuperAdmin,
    canMarkWorkdeskPaid: paymentCanCurrentUserMarkWorkdeskPaid
};
window.ibaPaymentTools = {
    parseAmount: paymentParseAmount,
    normalizeSupplierId: paymentNormalizeSupplierId,
    readyIndexKey: paymentReadyIndexKey,
    dateISO: paymentDateISO,
    displayDate: paymentDisplayDate,
    isSuperAdmin: paymentIsSuperAdmin,
    sortResults: paymentSortAndDedupeResults
};
