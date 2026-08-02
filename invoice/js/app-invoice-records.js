/* ==========================================================================
   js/app-invoice-records.js
   Invoice Management reporting / records renderer.
   Version: 11.6.5

   Cleanup Phase:
   - Moved the Invoice Reporting / Invoice Records display renderer out of app.js.
   - Public function names and existing behavior are preserved.
   - No invoice save/update/delete logic, batch save logic, payment save logic,
     Firebase write paths, or inventory stock logic changed.
   ========================================================================== */

// --- DATE FORMATTER ---
function formatToDDMMMYY(dateStr) {
    if (!dateStr) return '---';
    const d = new Date(normalizeDateForInput(dateStr) + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

// 11.4.9: Saved invoice entry IDs are permanent record identities.
// ECommit rows are supporting records only and must never renumber saved invoices.
function imIsEcommitInvoiceRecord(invoice) {
    return String((invoice && invoice.source) || '').trim().toLowerCase() === 'ecommit';
}

function imInvoiceEntrySequence(invoice) {
    const match = String((invoice && invoice.invEntryID) || '').match(/INV\s*-\s*0*(\d+)/i);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function imInvoiceRecordDateValue(invoice) {
    const value = new Date((invoice && invoice.invoiceDate) || '2099-01-01').getTime();
    return Number.isFinite(value) ? value : new Date('2099-01-01').getTime();
}

function imCompareSavedInvoiceRecords(a, b) {
    const sequenceDifference = imInvoiceEntrySequence(a) - imInvoiceEntrySequence(b);
    if (sequenceDifference !== 0) return sequenceDifference;

    const entryDifference = String((a && a.invEntryID) || '').localeCompare(
        String((b && b.invEntryID) || ''),
        undefined,
        { numeric: true, sensitivity: 'base' }
    );
    if (entryDifference !== 0) return entryDifference;

    return (imInvoiceRecordDateValue(a) - imInvoiceRecordDateValue(b))
        || String((a && a.invNumber) || '').localeCompare(String((b && b.invNumber) || ''));
}

function imCompareEcommitInvoiceRecords(a, b) {
    return (imInvoiceRecordDateValue(a) - imInvoiceRecordDateValue(b))
        || String((a && a.invNumber) || '').localeCompare(String((b && b.invNumber) || ''));
}

function imInvoiceRecordEntryLabel(invoice) {
    if (imIsEcommitInvoiceRecord(invoice)) return 'EPICOR – Not Imported';
    return String((invoice && invoice.invEntryID) || '');
}

// 11.6.4: Super Admin stages exactly the current Invoice Records result before
// transferring selected With Accounts rows into the compact payment pocket.
let imPocketTransferSourceItems = [];
let imPocketTransferExcludedIds = new Set();
let imPocketTransferCompleted = false;

function imPocketTransferText(value) {
    return String(value == null ? '' : value).trim();
}

function imPocketTransferNormalize(value) {
    return imPocketTransferText(value).toLowerCase().replace(/\s+/g, ' ');
}

function imPocketTransferIsSuperAdmin() {
    const currentName = imPocketTransferNormalize(currentApprover?.Name || currentApprover?.name || '');
    const superName = imPocketTransferNormalize(typeof SUPER_ADMIN_NAME !== 'undefined' ? SUPER_ADMIN_NAME : 'Irwin');
    return Boolean(currentName && superName && currentName === superName);
}

function imPocketTransferSafe(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value == null ? '' : value);
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function imPocketTransferAmount(invoice = {}) {
    const saved = Number(invoice.amountPaid);
    const invoiceValue = Number(invoice.invValue) || 0;
    return Number.isFinite(saved) && saved > 0 ? saved : invoiceValue;
}

function imPocketTransferCurrentResultItems() {
    const items = [];
    (Array.isArray(currentReportData) ? currentReportData : []).forEach(poData => {
        const po = imPocketTransferText(poData && poData.poNumber).toUpperCase();
        (Array.isArray(poData && poData.filteredInvoices) ? poData.filteredInvoices : []).forEach(invoice => {
            const key = imPocketTransferText(invoice && invoice.key);
            const id = `${po}::${key}`;
            items.push({
                id,
                po,
                key,
                source: imPocketTransferText(invoice && invoice.source),
                invoice: {
                    ...(invoice || {}),
                    vendorName: imPocketTransferText(
                        invoice && (invoice.vendorName || invoice.vendor || invoice.supplierName)
                    ) || imPocketTransferText(poData && poData.vendor) || 'N/A',
                    site: imPocketTransferText(
                        invoice && (invoice.site || invoice.siteName || invoice['Project ID'])
                    ) || imPocketTransferText(poData && poData.site) || 'N/A'
                }
            });
        });
    });
    return items;
}

function imPocketTransferValidation(items = imPocketTransferCurrentResultItems()) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return { valid: false, message: 'Search Invoice Records first.' };
    if (list.some(item => !item.po || !item.key)) {
        return { valid: false, message: 'The result contains a row without a permanent Firebase invoice identity.' };
    }
    if (list.some(item => imPocketTransferNormalize(item.source || item.invoice?.source) === 'ecommit')) {
        return { valid: false, message: 'The result contains ECommit-only rows. Filter saved With Accounts invoices only.' };
    }
    if (list.some(item => imPocketTransferNormalize(item.invoice?.status) !== 'with accounts')) {
        return { valid: false, message: 'Filter Invoice Records to With Accounts before preparing the transfer.' };
    }
    return { valid: true, message: '' };
}

function imUpdatePocketTransferButtonState() {
    const button = document.getElementById('im-prepare-pocket-transfer-btn');
    if (!button) return;
    const isSuperAdmin = imPocketTransferIsSuperAdmin();
    button.classList.toggle('hidden', !isSuperAdmin);
    if (!isSuperAdmin) return;

    const items = imPocketTransferCurrentResultItems();
    const validation = imPocketTransferValidation(items);
    button.disabled = !validation.valid;
    button.title = validation.valid
        ? `Prepare exactly ${items.length} filtered With Accounts invoice(s) for pocket transfer.`
        : validation.message;
    const label = button.querySelector('span');
    if (label) label.textContent = validation.valid
        ? `Prepare Pocket Transfer (${items.length})`
        : 'Prepare Pocket Transfer';
}

function imPocketTransferRemainingItems() {
    return imPocketTransferSourceItems.filter(item => !imPocketTransferExcludedIds.has(item.id));
}

function imPocketTransferSetStatus(message, tone = '') {
    const status = document.getElementById('im-pocket-transfer-status');
    if (!status) return;
    status.className = `im-pocket-transfer-status${tone ? ` is-${tone}` : ''}`;
    status.textContent = message || '';
}

function imRenderPocketTransferList() {
    const body = document.getElementById('im-pocket-transfer-table-body');
    const originalCount = document.getElementById('im-pocket-transfer-original-count');
    const excludedCount = document.getElementById('im-pocket-transfer-excluded-count');
    const remainingCount = document.getElementById('im-pocket-transfer-remaining-count');
    const totalDisplay = document.getElementById('im-pocket-transfer-total');
    const transferButton = document.getElementById('im-pocket-transfer-confirm-btn');
    const resetButton = document.getElementById('im-pocket-transfer-reset-btn');
    if (!body) return;

    const remaining = imPocketTransferRemainingItems();
    const total = remaining.reduce((sum, item) => sum + imPocketTransferAmount(item.invoice), 0);
    if (originalCount) originalCount.textContent = String(imPocketTransferSourceItems.length);
    if (excludedCount) excludedCount.textContent = String(imPocketTransferExcludedIds.size);
    if (remainingCount) remainingCount.textContent = String(remaining.length);
    if (totalDisplay) totalDisplay.textContent = typeof formatCurrency === 'function'
        ? formatCurrency(total)
        : total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (transferButton) transferButton.disabled = !remaining.length || imPocketTransferCompleted;
    if (resetButton) resetButton.disabled = !imPocketTransferExcludedIds.size || imPocketTransferCompleted;

    if (!remaining.length) {
        body.innerHTML = '<tr><td colspan="7" class="im-pocket-transfer-empty">All prepared invoices are excluded. Use Reset List to restore them.</td></tr>';
        return;
    }

    body.innerHTML = remaining.map(item => {
        const invoice = item.invoice || {};
        const amount = imPocketTransferAmount(invoice);
        const amountText = typeof formatCurrency === 'function'
            ? formatCurrency(amount)
            : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const releaseDate = typeof formatToDDMMMYY === 'function'
            ? formatToDDMMMYY(invoice.releaseDate)
            : imPocketTransferText(invoice.releaseDate) || '---';
        return `
            <tr>
                <td>${imPocketTransferSafe(invoice.invNumber || invoice.invoiceNo || invoice.invEntryID || 'N/A')}</td>
                <td>${imPocketTransferSafe(item.po)}</td>
                <td>${imPocketTransferSafe(invoice.vendorName || 'N/A')}</td>
                <td>${imPocketTransferSafe(invoice.site || 'N/A')}</td>
                <td class="right-align">${imPocketTransferSafe(amountText)}</td>
                <td>${imPocketTransferSafe(releaseDate)}</td>
                <td><button type="button" class="im-pocket-transfer-remove" data-transfer-id="${imPocketTransferSafe(encodeURIComponent(item.id))}" title="Exclude from this transfer only" aria-label="Exclude ${imPocketTransferSafe(invoice.invNumber || item.po)}"><i class="fa-solid fa-xmark"></i></button></td>
            </tr>`;
    }).join('');
}

function imOpenPocketTransferModal() {
    if (!imPocketTransferIsSuperAdmin()) {
        alert('Access Denied: Only Irwin/Super Admin can transfer Invoice Records results.');
        return;
    }
    const items = imPocketTransferCurrentResultItems();
    const validation = imPocketTransferValidation(items);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    imPocketTransferSourceItems = items;
    imPocketTransferExcludedIds = new Set();
    imPocketTransferCompleted = false;
    const transferButton = document.getElementById('im-pocket-transfer-confirm-btn');
    if (transferButton) transferButton.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Transfer Remaining to Payment Pocket';
    imPocketTransferSetStatus('Remove any invoice you do not want to transfer, then confirm the remaining list.');
    imRenderPocketTransferList();
    document.getElementById('im-pocket-transfer-modal')?.classList.remove('hidden');
}

function imClosePocketTransferModal() {
    document.getElementById('im-pocket-transfer-modal')?.classList.add('hidden');
}

async function imConfirmPocketTransfer() {
    if (!imPocketTransferIsSuperAdmin()) {
        alert('Access Denied: Only Irwin/Super Admin can transfer Invoice Records results.');
        return;
    }
    const remaining = imPocketTransferRemainingItems();
    if (!remaining.length) {
        alert('There are no remaining invoices to transfer.');
        return;
    }
    const validation = imPocketTransferValidation(remaining);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }
    if (!window.ibaPaymentPocket || typeof window.ibaPaymentPocket.transferFilteredInvoices !== 'function') {
        alert('The payment pocket service is unavailable. Refresh the system and try again.');
        return;
    }

    const total = remaining.reduce((sum, item) => sum + imPocketTransferAmount(item.invoice), 0);
    const totalText = typeof formatCurrency === 'function'
        ? formatCurrency(total)
        : total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const confirmed = confirm(
        `Transfer exactly ${remaining.length} remaining invoice(s) to the payment pocket?\n\n` +
        `Excluded: ${imPocketTransferExcludedIds.size}\n` +
        `Remaining Total: ${totalText}\n\n` +
        'Existing pocket records will be refreshed in place and will not duplicate.'
    );
    if (!confirmed) return;

    const transferButton = document.getElementById('im-pocket-transfer-confirm-btn');
    const resetButton = document.getElementById('im-pocket-transfer-reset-btn');
    if (transferButton) {
        transferButton.disabled = true;
        transferButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Transferring…';
    }
    if (resetButton) resetButton.disabled = true;
    document.querySelectorAll('#im-pocket-transfer-table-body .im-pocket-transfer-remove').forEach(button => {
        button.disabled = true;
    });

    try {
        const result = await window.ibaPaymentPocket.transferFilteredInvoices(remaining, progress => {
            imPocketTransferSetStatus(`Transferring ${progress.processed} of ${progress.total} invoice(s)…`, 'working');
        });
        imPocketTransferCompleted = true;
        imPocketTransferSetStatus(
            `${result.total} invoice(s) transferred successfully: ${result.added} new and ${result.refreshed} existing pocket record(s) refreshed. Current pocket total: ${result.items.length}.`,
            'success'
        );
        if (transferButton) transferButton.innerHTML = '<i class="fa-solid fa-circle-check"></i> Transfer Completed';
    } catch (error) {
        console.error('Invoice Records pocket transfer failed:', error);
        imPocketTransferSetStatus(error.message || 'The pocket transfer could not be completed.', 'error');
        if (transferButton) {
            transferButton.disabled = false;
            transferButton.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Retry Transfer';
        }
        if (resetButton) resetButton.disabled = !imPocketTransferExcludedIds.size;
        document.querySelectorAll('#im-pocket-transfer-table-body .im-pocket-transfer-remove').forEach(button => {
            button.disabled = false;
        });
    }
}

let imMarkPaidSourceItems = [];
let imMarkPaidExcludedIds = new Set();
let imMarkPaidCompleted = false;

function imMarkPaidWithAccountsDate(item) {
    const invoice = item && item.invoice ? item.invoice : (item || {});
    const raw = imPocketTransferText(invoice.withAccountsReleaseDate || invoice.releaseDate);
    if (window.ibaPaymentTools && typeof window.ibaPaymentTools.dateISO === 'function') {
        return window.ibaPaymentTools.dateISO(raw);
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

function imMarkPaidCalculatedDate(item) {
    const withAccountsDate = imMarkPaidWithAccountsDate(item);
    if (!withAccountsDate || !window.ibaPaymentPocket || typeof window.ibaPaymentPocket.calculatePaidDate !== 'function') return '';
    return window.ibaPaymentPocket.calculatePaidDate(withAccountsDate);
}

function imMarkPaidToday() {
    if (typeof getTodayDateString === 'function') return getTodayDateString();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function imMarkPaidValidation(items = imPocketTransferCurrentResultItems()) {
    const base = imPocketTransferValidation(items);
    if (!base.valid) return base;
    if (!window.ibaPaymentPocket || typeof window.ibaPaymentPocket.calculatePaidDate !== 'function') {
        return { valid: false, message: 'The payment date service is unavailable. Refresh the system and try again.' };
    }
    const missingDate = items.find(item => !imMarkPaidWithAccountsDate(item) || !imMarkPaidCalculatedDate(item));
    if (missingDate) {
        return { valid: false, message: 'Every filtered invoice must have a valid With Accounts Date before it can be marked Paid.' };
    }
    const futureDate = items.find(item => imMarkPaidCalculatedDate(item) > imMarkPaidToday());
    if (futureDate) {
        const invoice = futureDate.invoice || {};
        return {
            valid: false,
            message: `The calculated Paid Date for ${invoice.invNumber || invoice.invEntryID || futureDate.po} is later than today.`
        };
    }
    return { valid: true, message: '' };
}

function imUpdateMarkPaidButtonState() {
    const button = document.getElementById('im-prepare-mark-paid-btn');
    if (!button) return;
    const isSuperAdmin = imPocketTransferIsSuperAdmin();
    button.classList.toggle('hidden', !isSuperAdmin);
    if (!isSuperAdmin) return;

    const items = imPocketTransferCurrentResultItems();
    const validation = imMarkPaidValidation(items);
    button.disabled = !validation.valid;
    button.title = validation.valid
        ? `Prepare exactly ${items.length} filtered With Accounts invoice(s) to be marked Paid.`
        : validation.message;
    const label = button.querySelector('span');
    if (label) label.textContent = validation.valid
        ? `Prepare Mark as Paid (${items.length})`
        : 'Prepare Mark as Paid';
}

function imUpdateFilteredResultActionStates() {
    imUpdatePocketTransferButtonState();
    imUpdateMarkPaidButtonState();
}

function imMarkPaidRemainingItems() {
    return imMarkPaidSourceItems.filter(item => !imMarkPaidExcludedIds.has(item.id));
}

function imMarkPaidSetStatus(message, tone = '') {
    const status = document.getElementById('im-mark-paid-status');
    if (!status) return;
    status.className = `im-pocket-transfer-status${tone ? ` is-${tone}` : ''}`;
    status.textContent = message || '';
}

function imRenderMarkPaidList() {
    const body = document.getElementById('im-mark-paid-table-body');
    const originalCount = document.getElementById('im-mark-paid-original-count');
    const excludedCount = document.getElementById('im-mark-paid-excluded-count');
    const remainingCount = document.getElementById('im-mark-paid-remaining-count');
    const totalDisplay = document.getElementById('im-mark-paid-total');
    const confirmButton = document.getElementById('im-mark-paid-confirm-btn');
    const resetButton = document.getElementById('im-mark-paid-reset-btn');
    if (!body) return;

    const remaining = imMarkPaidRemainingItems();
    const total = remaining.reduce((sum, item) => sum + imPocketTransferAmount(item.invoice), 0);
    if (originalCount) originalCount.textContent = String(imMarkPaidSourceItems.length);
    if (excludedCount) excludedCount.textContent = String(imMarkPaidExcludedIds.size);
    if (remainingCount) remainingCount.textContent = String(remaining.length);
    if (totalDisplay) totalDisplay.textContent = typeof formatCurrency === 'function'
        ? formatCurrency(total)
        : total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (confirmButton) confirmButton.disabled = !remaining.length || imMarkPaidCompleted;
    if (resetButton) resetButton.disabled = !imMarkPaidExcludedIds.size || imMarkPaidCompleted;

    if (!remaining.length) {
        body.innerHTML = '<tr><td colspan="8" class="im-pocket-transfer-empty">All prepared invoices are excluded. Use Reset List to restore them.</td></tr>';
        return;
    }

    body.innerHTML = remaining.map(item => {
        const invoice = item.invoice || {};
        const amount = imPocketTransferAmount(invoice);
        const amountText = typeof formatCurrency === 'function'
            ? formatCurrency(amount)
            : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const withAccountsDate = imMarkPaidWithAccountsDate(item);
        const paidDate = imMarkPaidCalculatedDate(item);
        return `
            <tr>
                <td>${imPocketTransferSafe(invoice.invNumber || invoice.invoiceNo || invoice.invEntryID || 'N/A')}</td>
                <td>${imPocketTransferSafe(item.po)}</td>
                <td>${imPocketTransferSafe(invoice.vendorName || 'N/A')}</td>
                <td>${imPocketTransferSafe(invoice.site || 'N/A')}</td>
                <td class="right-align">${imPocketTransferSafe(amountText)}</td>
                <td>${imPocketTransferSafe(formatToDDMMMYY(withAccountsDate))}</td>
                <td><strong>${imPocketTransferSafe(formatToDDMMMYY(paidDate))}</strong></td>
                <td><button type="button" class="im-pocket-transfer-remove im-mark-paid-remove" data-mark-paid-id="${imPocketTransferSafe(encodeURIComponent(item.id))}" title="Exclude from this Mark as Paid action only" aria-label="Exclude ${imPocketTransferSafe(invoice.invNumber || item.po)}"><i class="fa-solid fa-xmark"></i></button></td>
            </tr>`;
    }).join('');
}

function imOpenMarkPaidModal() {
    if (!imPocketTransferIsSuperAdmin()) {
        alert('Access Denied: Only Irwin/Super Admin can mark filtered Invoice Records as Paid.');
        return;
    }
    const items = imPocketTransferCurrentResultItems();
    const validation = imMarkPaidValidation(items);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    imMarkPaidSourceItems = items;
    imMarkPaidExcludedIds = new Set();
    imMarkPaidCompleted = false;
    const confirmButton = document.getElementById('im-mark-paid-confirm-btn');
    if (confirmButton) confirmButton.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark Remaining as Paid';
    imMarkPaidSetStatus('Remove anything that should remain With Accounts, then confirm the remaining list.');
    imRenderMarkPaidList();
    document.getElementById('im-mark-paid-modal')?.classList.remove('hidden');
}

function imCloseMarkPaidModal() {
    document.getElementById('im-mark-paid-modal')?.classList.add('hidden');
}

async function imConfirmMarkPaid() {
    if (!imPocketTransferIsSuperAdmin()) {
        alert('Access Denied: Only Irwin/Super Admin can mark filtered Invoice Records as Paid.');
        return;
    }
    const remaining = imMarkPaidRemainingItems();
    if (!remaining.length) {
        alert('There are no remaining invoices to mark Paid.');
        return;
    }
    const validation = imMarkPaidValidation(remaining);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }
    if (!window.ibaPaymentPocket || typeof window.ibaPaymentPocket.markFilteredInvoicesPaid !== 'function') {
        alert('The filtered Mark as Paid service is unavailable. Refresh the system and try again.');
        return;
    }

    const total = remaining.reduce((sum, item) => sum + imPocketTransferAmount(item.invoice), 0);
    const totalText = typeof formatCurrency === 'function'
        ? formatCurrency(total)
        : total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const confirmed = confirm(
        `Mark exactly ${remaining.length} remaining invoice(s) as Paid?\n\n` +
        `Excluded: ${imMarkPaidExcludedIds.size}\n` +
        `Remaining Total: ${totalText}\n\n` +
        'Paid Date will be the day after the original With Accounts Date. If that day is Friday, it will move to Saturday. This will also remove matching payment-pocket rows.'
    );
    if (!confirmed) return;

    const confirmButton = document.getElementById('im-mark-paid-confirm-btn');
    const resetButton = document.getElementById('im-mark-paid-reset-btn');
    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validating…';
    }
    if (resetButton) resetButton.disabled = true;
    document.querySelectorAll('#im-mark-paid-table-body .im-mark-paid-remove').forEach(button => {
        button.disabled = true;
    });

    try {
        const result = await window.ibaPaymentPocket.markFilteredInvoicesPaid(remaining, progress => {
            const phaseLabel = progress.phase === 'saving'
                ? 'Saving the Paid status'
                : (progress.phase === 'syncing' ? 'Synchronizing linked records' : 'Validating current invoices');
            imMarkPaidSetStatus(`${phaseLabel}: ${progress.processed} of ${progress.total}…`, 'working');
            if (confirmButton) confirmButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${phaseLabel}…`;
        });
        imMarkPaidCompleted = true;
        const warning = result.syncFailures
            ? ` Core invoice updates are complete; ${result.syncFailures} linked background operation(s) reported a warning.`
            : '';
        imMarkPaidSetStatus(
            `${result.total} invoice(s) marked Paid successfully and removed from the payment pocket.${warning}`,
            result.syncFailures ? 'working' : 'success'
        );
        if (confirmButton) confirmButton.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark as Paid Completed';

        try {
            const currentSearch = document.getElementById('im-reporting-search')?.value || '';
            await populateInvoiceReporting(currentSearch, { silent: true });
        } catch (refreshError) {
            console.warn('Invoice Records could not refresh after filtered Mark as Paid:', refreshError);
            imUpdateFilteredResultActionStates();
        }
    } catch (error) {
        console.error('Filtered Invoice Records Mark as Paid failed:', error);
        imMarkPaidSetStatus(error.message || 'The invoices could not be marked Paid.', 'error');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.innerHTML = '<i class="fa-solid fa-circle-check"></i> Retry Mark as Paid';
        }
        if (resetButton) resetButton.disabled = !imMarkPaidExcludedIds.size;
        document.querySelectorAll('#im-mark-paid-table-body .im-mark-paid-remove').forEach(button => {
            button.disabled = false;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const prepareButton = document.getElementById('im-prepare-pocket-transfer-btn');
    const markPaidPrepareButton = document.getElementById('im-prepare-mark-paid-btn');
    const transferBody = document.getElementById('im-pocket-transfer-table-body');
    const markPaidBody = document.getElementById('im-mark-paid-table-body');
    const resetButton = document.getElementById('im-pocket-transfer-reset-btn');
    const markPaidResetButton = document.getElementById('im-mark-paid-reset-btn');
    const confirmButton = document.getElementById('im-pocket-transfer-confirm-btn');
    const markPaidConfirmButton = document.getElementById('im-mark-paid-confirm-btn');
    const clearButton = document.getElementById('im-reporting-clear-button');

    if (prepareButton && !prepareButton.dataset.pocketTransferBound) {
        prepareButton.dataset.pocketTransferBound = '1';
        prepareButton.addEventListener('click', imOpenPocketTransferModal);
    }
    if (markPaidPrepareButton && !markPaidPrepareButton.dataset.markPaidBound) {
        markPaidPrepareButton.dataset.markPaidBound = '1';
        markPaidPrepareButton.addEventListener('click', imOpenMarkPaidModal);
    }
    if (transferBody && !transferBody.dataset.pocketTransferBound) {
        transferBody.dataset.pocketTransferBound = '1';
        transferBody.addEventListener('click', event => {
            const removeButton = event.target.closest('.im-pocket-transfer-remove');
            if (!removeButton || removeButton.disabled || imPocketTransferCompleted) return;
            let itemId = '';
            try { itemId = decodeURIComponent(removeButton.dataset.transferId || ''); } catch (_) {}
            if (!itemId) return;
            imPocketTransferExcludedIds.add(itemId);
            imPocketTransferSetStatus('List updated. The excluded invoice will not be transferred.');
            imRenderPocketTransferList();
        });
    }
    if (markPaidBody && !markPaidBody.dataset.markPaidBound) {
        markPaidBody.dataset.markPaidBound = '1';
        markPaidBody.addEventListener('click', event => {
            const removeButton = event.target.closest('.im-mark-paid-remove');
            if (!removeButton || removeButton.disabled || imMarkPaidCompleted) return;
            let itemId = '';
            try { itemId = decodeURIComponent(removeButton.dataset.markPaidId || ''); } catch (_) {}
            if (!itemId) return;
            imMarkPaidExcludedIds.add(itemId);
            imMarkPaidSetStatus('List updated. The excluded invoice will remain With Accounts.');
            imRenderMarkPaidList();
        });
    }
    if (resetButton && !resetButton.dataset.pocketTransferBound) {
        resetButton.dataset.pocketTransferBound = '1';
        resetButton.addEventListener('click', () => {
            if (imPocketTransferCompleted) return;
            imPocketTransferExcludedIds = new Set();
            imPocketTransferSetStatus('All originally prepared Invoice Records rows have been restored.');
            imRenderPocketTransferList();
        });
    }
    if (markPaidResetButton && !markPaidResetButton.dataset.markPaidBound) {
        markPaidResetButton.dataset.markPaidBound = '1';
        markPaidResetButton.addEventListener('click', () => {
            if (imMarkPaidCompleted) return;
            imMarkPaidExcludedIds = new Set();
            imMarkPaidSetStatus('All originally prepared Invoice Records rows have been restored.');
            imRenderMarkPaidList();
        });
    }
    if (confirmButton && !confirmButton.dataset.pocketTransferBound) {
        confirmButton.dataset.pocketTransferBound = '1';
        confirmButton.addEventListener('click', imConfirmPocketTransfer);
    }
    if (markPaidConfirmButton && !markPaidConfirmButton.dataset.markPaidBound) {
        markPaidConfirmButton.dataset.markPaidBound = '1';
        markPaidConfirmButton.addEventListener('click', imConfirmMarkPaid);
    }
    document.querySelectorAll('#im-pocket-transfer-modal .modal-close-btn').forEach(button => {
        if (button.dataset.pocketTransferBound) return;
        button.dataset.pocketTransferBound = '1';
        button.addEventListener('click', imClosePocketTransferModal);
    });
    document.querySelectorAll('#im-mark-paid-modal .modal-close-btn').forEach(button => {
        if (button.dataset.markPaidBound) return;
        button.dataset.markPaidBound = '1';
        button.addEventListener('click', imCloseMarkPaidModal);
    });
    if (clearButton && !clearButton.dataset.pocketTransferStateBound) {
        clearButton.dataset.pocketTransferStateBound = '1';
        clearButton.addEventListener('click', () => setTimeout(imUpdateFilteredResultActionStates, 0));
    }
    imUpdateFilteredResultActionStates();
});


// --- CORE REPORTING LOGIC ---

// #endregion BLOCK 17 — INVOICE TASK LOOKUP + INVOICE ENTRY MODAL


// =================================================================================================
// #region BLOCK 18 — INVOICE REPORTING, RECORDS, DEEP LINKS + SHARING
// Purpose: Invoice records/reporting, printout generation, totals, deep links, WhatsApp approval sharing.
// =================================================================================================


// 7.5.0 — mobile invoice records card helpers moved to js/app-mobile.js
// populateInvoiceReporting remains in app.js; the mobile renderer is loaded before app.js.

// 10.5.0: Lightweight helpers for fast PO-number search in Invoice Records.
// Purpose: avoid downloading the full invoice_entries tree when the user searches an exact PO.
function imNormalizeRecordsPO(value) {
    return String(value || '').trim().toUpperCase();
}

function imLooksLikeExactPOSearch(value) {
    const text = String(value || '').trim();
    if (!text || text.length < 2) return false;
    if (/\s/.test(text)) return false;
    // PO numbers in IBA are usually numeric, but allow safe letter/dash variants for legacy entries.
    return /^[A-Za-z0-9._\/-]+$/.test(text);
}

function imRecordsHasEcommitLoaded() {
    return !!(allEcommitDataProcessed && cacheTimestamps && cacheTimestamps.ecommitData);
}

function imIsInvoiceRecordsSectionVisible() {
    const section = document.getElementById('im-reporting');
    return !!section && !section.classList.contains('hidden');
}

function imScheduleInvoiceRecordsExactPOBackgroundRefresh(searchTerm) {
    // 10.6.3: Exact PO searches should display Firebase/local results quickly.
    // ECommit.csv is large, so complete/merge Epicor/SRV records in the background.
    if (!searchTerm || imRecordsHasEcommitLoaded()) return;
    if (window.__imRecordsEcommitBackgroundLoading) return;

    window.__imRecordsEcommitBackgroundLoading = true;
    setTimeout(async () => {
        try {
            await imEnsureInvoiceRecordsLightDataFetched(false, { includeEcommit: true });
            const activeSearch = String(sessionStorage.getItem('imReportingSearch') || '').trim();
            if (activeSearch === String(searchTerm || '').trim() && imIsInvoiceRecordsSectionVisible()) {
                await populateInvoiceReporting(activeSearch, { silent: true });
            }
        } catch (error) {
            console.warn('Invoice Records background Epicor/SRV refresh could not complete:', error);
        } finally {
            window.__imRecordsEcommitBackgroundLoading = false;
        }
    }, 100);
}

async function imEnsureInvoiceRecordsLightDataFetched(forceRefresh = false, options = {}) {
    // Loads lightweight PO/reference data only. This does not read full invoice_entries or purchase_orders.
    // 10.6.3: Do not block exact-PO searches on ECommit.csv unless explicitly requested.
    const includeEcommit = options && options.includeEcommit === true;

    if (typeof ensureInvoicePOBaseDataFetched === 'function') {
        await ensureInvoicePOBaseDataFetched(forceRefresh);
    } else if (typeof ensureInvoiceDataFetched === 'function') {
        // Legacy fallback only; normally not used after 10.4.x.
        await ensureInvoiceDataFetched(forceRefresh);
        return;
    }

    if (!includeEcommit) return;

    const now = Date.now();
    if (!forceRefresh && allEcommitDataProcessed && cacheTimestamps?.ecommitData) return;

    try {
        if (typeof getFirebaseCSVUrl === 'function' && typeof fetchAndParseEcommitCSV === 'function') {
            const ecommitUrl = await getFirebaseCSVUrl('ECommit.csv');
            if (ecommitUrl) {
                allEcommitDataProcessed = await fetchAndParseEcommitCSV(ecommitUrl) || {};
                if (cacheTimestamps) cacheTimestamps.ecommitData = now;
            }
        }
    } catch (error) {
        console.warn('Invoice Records fast search: ECommit.csv could not be loaded. Continuing with Firebase/PO CSV only.', error);
        allEcommitDataProcessed = allEcommitDataProcessed || {};
    }
}

async function imTryFastInvoiceRecordsPOSearch(searchTerm) {
    if (!imLooksLikeExactPOSearch(searchTerm)) return null;
    const poNumber = imNormalizeRecordsPO(searchTerm);
    if (!poNumber) return null;

    await imEnsureInvoiceRecordsLightDataFetched(false, { includeEcommit: false });

    let firebaseInvoicesForPO = {};
    try {
        if (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) {
            const snap = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
            firebaseInvoicesForPO = snap.val() || {};
            if (!allInvoiceData) allInvoiceData = {};
            allInvoiceData[poNumber] = firebaseInvoicesForPO;
        }
    } catch (error) {
        console.warn(`Invoice Records fast PO search failed for ${poNumber}. Falling back to full search.`, error);
        return null;
    }

    const hasPOCsv = !!(allPOData && allPOData[poNumber]);
    const hasFirebaseInvoices = !!(firebaseInvoicesForPO && Object.keys(firebaseInvoicesForPO).length);
    const hasEcommit = !!(allEcommitDataProcessed && allEcommitDataProcessed[poNumber] && allEcommitDataProcessed[poNumber].length);

    if (!hasPOCsv && !hasFirebaseInvoices && !hasEcommit) return null;

    if (!allPOData) allPOData = {};
    if (!allEcommitDataProcessed) allEcommitDataProcessed = {};
    return [poNumber];
}


async function populateInvoiceReporting(searchTerm = '', options = {}) {
    const openCard = document.querySelector('#im-reporting-content .invoice-card.expanded');
    if (openCard) {
        imLastExpandedRowId = openCard.getAttribute('data-po-id');
    } else {
        imLastExpandedRowId = null;
    }

    sessionStorage.setItem('imReportingSearch', searchTerm);
    const silent = options && options.silent;
    const contentArea = document.getElementById('im-reporting-content');

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const isSuperAdmin = (currentApprover?.Name || '').trim().toLowerCase() === String(SUPER_ADMIN_NAME || '').trim().toLowerCase();
    const canEditInvoiceEntry = (typeof canCurrentUserEditInvoiceEntry === 'function')
        ? canCurrentUserEditInvoiceEntry()
        : (isSuperAdmin || isVacationDelegate);
    
    // 10.4.1: Invoice Records is Admin/Super Admin only. Normal users do not load invoice_entries here.
    const canAccessInvoiceRecords = isAdmin || isSuperAdmin || isVacationDelegate;
    const canViewAmounts = canAccessInvoiceRecords;
    const isAllowedUser = canAccessInvoiceRecords;
    const canPrintSticker = isAdmin && canAccessInvoiceRecords;

    currentReportData = [];
    imUpdateFilteredResultActionStates();

    if (!canAccessInvoiceRecords) {
        if (contentArea) contentArea.innerHTML = '<div class="loading-state">Access denied. Invoice Records is Admin only.</div>';
        return;
    }

    if (!silent) {
        contentArea.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</div>';
    }

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const monthFilter = document.getElementById('im-reporting-month-filter').value;
    const yearFilter = document.getElementById('im-reporting-year-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;

    try {
        const rawSearchTerm = String(searchTerm || '').trim();
        let fastPONumbers = null;

        // 10.5.0: If the user searches an exact PO, read only invoice_entries/{PO}.
        // This keeps common Invoice Records lookup fast without re-enabling full invoice_entries auto-download.
        if (rawSearchTerm) {
            fastPONumbers = await imTryFastInvoiceRecordsPOSearch(rawSearchTerm);
        }

        if (!fastPONumbers) {
            if (rawSearchTerm && imLooksLikeExactPOSearch(rawSearchTerm) && !silent && contentArea) {
                contentArea.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> PO not found directly. Running deeper search...</div>';
            }
            await ensureInvoiceDataFetched();
        } else if (rawSearchTerm && !imRecordsHasEcommitLoaded()) {
            imScheduleInvoiceRecordsExactPOBackgroundRefresh(rawSearchTerm);
        }

        const allPOs = allPOData || {};
        const allInvoicesByPO = allInvoiceData || {};
        const allEcommit = allEcommitDataProcessed || {};

        const searchText = rawSearchTerm.toLowerCase();
        const processedPOData = [];

        const allUniquePOs = fastPONumbers
            ? new Set(fastPONumbers)
            : new Set([...Object.keys(allPOs), ...Object.keys(allInvoicesByPO), ...Object.keys(allEcommit)]);

        const filteredPONumbers = Array.from(allUniquePOs).filter(poNumber => {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            let hasNoteMatch = false;
            if (allInvoicesByPO[poNumber]) {
                hasNoteMatch = Object.values(allInvoicesByPO[poNumber]).some(inv => inv.note && inv.note.toLowerCase().includes(searchText));
            }

            let hasInvoiceNumberMatch = false;
            if (searchText) {
                if (allInvoicesByPO[poNumber]) {
                    hasInvoiceNumberMatch = Object.values(allInvoicesByPO[poNumber]).some(inv => {
                        const v = (inv && inv.invNumber != null) ? String(inv.invNumber) : '';
                        return v.toLowerCase().includes(searchText);
                    });
                }
                if (!hasInvoiceNumberMatch && allEcommit[poNumber]) {
                    hasInvoiceNumberMatch = (allEcommit[poNumber] || []).some(inv => {
                        const v = (inv && inv.invNumber != null) ? String(inv.invNumber) : '';
                        return v.toLowerCase().includes(searchText);
                    });
                }
            }

            const searchMatch = !searchText || poNumber.toLowerCase().includes(searchText) || vendor.toLowerCase().includes(searchText) || hasNoteMatch || hasInvoiceNumberMatch;
            const siteMatch = !siteFilter || (site.toLowerCase() === siteFilter.toLowerCase());
            return searchMatch && siteMatch;
        });

        for (const poNumber of filteredPONumbers) {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            const firebaseInvoices = allInvoicesByPO[poNumber] ? Object.entries(allInvoicesByPO[poNumber]).map(([key, value]) => ({ key, ...value, source: 'firebase' })) : [];
            const firebasePackingSlips = new Set(firebaseInvoices.map(inv => String(inv.invNumber || '').trim().toLowerCase()).filter(Boolean));
            
            const ecommitInvoices = (allEcommit[poNumber] || []).map(inv => ({
                ...inv,
                source: (inv && inv.source) || 'ECommit'
            }));
            const filteredEcommitInvoices = ecommitInvoices.filter(inv => {
                const csvInvNum = String(inv.invNumber || '').trim().toLowerCase();
                return !csvInvNum || !firebasePackingSlips.has(csvInvNum);
            });

            // Check if PO is closed in POVALUE2.csv and update Ecommit status
            const isPoClosed = String(poDetails['Open']).trim().toLowerCase() === 'false';
            filteredEcommitInvoices.forEach(inv => {
                if (isPoClosed) {
                    inv.status = 'Epicor Closed';
                }
            });

            // Keep permanent Firebase IDs in their saved numeric order.
            // Supporting ECommit-only rows stay after them and receive no fake INV ID.
            let invoices = [
                ...firebaseInvoices.sort(imCompareSavedInvoiceRecords),
                ...filteredEcommitInvoices.sort(imCompareEcommitInvoiceRecords)
            ];

            let totalInvSum = 0;
            invoices.forEach(inv => totalInvSum += parseFloat(inv.invValue) || 0);

            const poVal = parseFloat(poDetails.Amount) || 0;
            let balance = poVal - totalInvSum;
            if (poVal === 0) balance = 0;

            if (statusFilter === 'Negative Balance' && balance >= -0.01) continue;

            const poMatchBySearch = !!searchText && poNumber.toLowerCase().includes(searchText);
            const vendorMatchBySearch = !!searchText && vendor.toLowerCase().includes(searchText);
            const noteMatchBySearch = !!searchText && invoices.some(i => (i.note || '').toLowerCase().includes(searchText));
            const invNumberMatchBySearch = !!searchText && invoices.some(i => String(i.invNumber || '').toLowerCase().includes(searchText));
            const restrictToInvoiceNumberMatches = !!searchText && !poMatchBySearch && !vendorMatchBySearch && !noteMatchBySearch && invNumberMatchBySearch;

            const filteredInvoices = invoices.filter(inv => {
                if (statusFilter === 'Negative Balance') {
                    if (restrictToInvoiceNumberMatches) return String(inv.invNumber || '').toLowerCase().includes(searchText);
                    return true;
                }
                
                let dateMatch = true;
                const rDate = inv.releaseDate || inv.invoiceDate || '';
                if (monthFilter || yearFilter) {
                    if (!rDate) { dateMatch = false; } 
                    else {
                        const [rYear, rMonth] = rDate.split('-');
                        if (monthFilter && rMonth !== monthFilter) dateMatch = false;
                        if (yearFilter && rYear !== yearFilter) dateMatch = false;
                    }
                }

                const statusMatch = !statusFilter || inv.status === statusFilter;
                const invNumMatch = !restrictToInvoiceNumberMatches || String(inv.invNumber || '').toLowerCase().includes(searchText);
                return dateMatch && statusMatch && invNumMatch;
            });

            if (filteredInvoices.length > 0) {
                processedPOData.push({ poNumber, poDetails, site, vendor, filteredInvoices, balance });
            }
        }

        processedPOData.sort((a, b) => a.balance - b.balance);
        currentReportData = processedPOData;
        imUpdateFilteredResultActionStates();

        if (document.getElementById('reporting-count-display')) {
            document.getElementById('reporting-count-display').textContent = `(Found: ${currentReportData.length})`;
        }

       if (currentReportData.length === 0) {
            if (fastPONumbers && rawSearchTerm && !imRecordsHasEcommitLoaded()) {
                imScheduleInvoiceRecordsExactPOBackgroundRefresh(rawSearchTerm);
                if (contentArea) contentArea.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Checking Epicor/SRV records for this PO...</div>';
                const sleekBar = document.getElementById('im-sleek-totals-bar');
                if (sleekBar) sleekBar.innerHTML = '<span>Checking Epicor/SRV records...</span>';
                return;
            }
            if (typeof window.playSystemError === 'function') window.playSystemError();
            if (contentArea) contentArea.innerHTML = '<div class="loading-state">No records found for your search criteria.</div>';
            const sleekBar = document.getElementById('im-sleek-totals-bar');
            if (sleekBar) sleekBar.innerHTML = '<span>No records found.</span>';
            
            // Hide the Grand Total box when the table clears out
            const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
            if (grandTotalContainer) {
                grandTotalContainer.style.display = 'none';
                grandTotalContainer.innerHTML = '';
            }
            
            if (window.innerWidth <= 768 && typeof renderMobileInvoiceRecordsCards === 'function') {
                renderMobileInvoiceRecordsCards([], canViewAmounts);
            }
            return;
        }

        // GENERATE GRAND TOTALS
        let grandTotalPO = 0;
        let grandTotalInv = 0;
        currentReportData.forEach(poData => {
            grandTotalPO += (parseFloat(poData.poDetails?.Amount) || 0);
            poData.filteredInvoices.forEach(i => grandTotalInv += parseFloat(i.invValue) || 0);
        });
        let grandTotalBalance = grandTotalPO - grandTotalInv;

        const sleekBar = document.getElementById('im-sleek-totals-bar');
        if (sleekBar) {
            sleekBar.innerHTML = `
                <div><strong>${currentReportData.length}</strong> Records Found</div>
                <div>Total PO Value: <span class="highlight-val">QAR ${formatCurrency(grandTotalPO)}</span></div>
                <div>Total SRV: <span class="highlight-val">QAR ${formatCurrency(grandTotalInv)}</span></div>
                <div>Total Outstanding: <span class="outstanding-val" style="color: ${grandTotalBalance < 0 ? '#dc3545' : '#1e293b'}">QAR ${formatCurrency(grandTotalBalance)}</span></div>
            `;
        }

        // ================================================================
        // MOBILE / DESKTOP SPLIT 1
        // ================================================================
        const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);

        if (isMobile) {
            // 7.4.2: Mobile Invoice Records uses a dedicated PO card renderer.
            // Desktop table remains untouched below this mobile return.
            if (typeof renderMobileInvoiceRecordsCards === 'function') {
                renderMobileInvoiceRecordsCards(currentReportData, canViewAmounts);
            }

            // Keep the record count updated
            if (document.getElementById('reporting-count-display')) {
                document.getElementById('reporting-count-display').textContent = `(Found: ${currentReportData.length})`;
            }
            return; // <-- mobile path ends here
        }

        // ========================
        // DESKTOP RENDERING 1
        // ========================
        const desktopContent = document.getElementById('im-reporting-content');
        const mobileContainer = document.getElementById('im-reporting-mobile-view');
        if (desktopContent) desktopContent.classList.remove('hidden');
        if (mobileContainer) mobileContainer.classList.add('hidden');

        let html = '';
        currentReportData.forEach(poData => {
            let totalInvValue = 0;
            let totalPaidWithRetention = 0;
            let totalPaidWithoutRetention = 0;
            let allWithAccounts = poData.filteredInvoices.length > 0;

            let innerRows = '';
    
            poData.filteredInvoices.forEach(inv => {
                if (inv.status !== 'With Accounts') allWithAccounts = false;

                const isEcommitRecord = imIsEcommitInvoiceRecord(inv);
                const invEntryDisplay = imInvoiceRecordEntryLabel(inv);
                const invValue = parseFloat(inv.invValue) || 0;
                const amountPaid = parseFloat(inv.amountPaid) || 0;
                const invNoText = (inv.invNumber || '').toLowerCase();   // retention check on INV. NO.
                totalInvValue += invValue;
                totalPaidWithRetention += amountPaid;
                if (!invNoText.includes('retention')) totalPaidWithoutRetention += amountPaid;

                const releaseDateDisplay = formatToDDMMMYY(inv.releaseDate);
                const invoiceDateDisplay = formatToDDMMMYY(inv.invoiceDate);
        
                const invValueDisplay = canViewAmounts ? formatCurrency(invValue) : '---';
                const amountPaidDisplay = canViewAmounts ? formatCurrency(amountPaid) : '---';

                let actionButtonsHTML = '';
                if (!isEcommitRecord && isAllowedUser) {
                    const finalInvName = getSharePointPdfBaseName(inv.invName);
                    const finalSrvName = getSharePointPdfBaseName(inv.srvName);
                    const finalReportName = getSharePointPdfBaseName(inv.reportName);

                    const exactPdfUrl = (finalInvName && finalInvName.toLowerCase() !== 'nil') ? `${PDF_BASE_PATH}${encodeURIComponent(finalInvName)}.pdf` : '';

                    const invPDFLink = (finalInvName && finalInvName.toLowerCase() !== 'nil') ? `<a href="${exactPdfUrl}" target="_blank" class="action-btn invoice-pdf-btn" onclick="event.stopPropagation();" title="View Invoice PDF">INV</a>` : '';
                    const srvPDFLink = (finalSrvName && finalSrvName.toLowerCase() !== 'nil') ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(finalSrvName)}.pdf" target="_blank" class="action-btn srv-pdf-btn" onclick="event.stopPropagation();" title="View SRV PDF">SRV</a>` : '';
                    const reportViewLink = (finalReportName && finalReportName.toLowerCase() !== 'nil') ? `<a href="${REPORT_BASE_PATH}${encodeURIComponent(finalReportName)}.pdf" target="_blank" class="action-btn" style="background-color: #6f42c1; color: white;" onclick="event.stopPropagation();" title="View Report PDF">RPT</a>` : '';

                    let historyBtn = (inv.history || inv.createdAt || inv.originTimestamp) ? `<button type="button" class="history-btn action-btn" onclick="event.stopPropagation(); showInvoiceHistory('${poData.poNumber}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>` : '';
                    let editBtn = canEditInvoiceEntry
                        ? `<button type="button" class="edit-inv-no-btn im-enter-inv-btn action-btn" data-po="${poData.poNumber}" data-key="${inv.key}" data-current="${inv.invNumber || ''}" title="Enter New Invoice Number" aria-label="Enter New Invoice Number"><i class="fa-solid fa-pen-to-square im-enter-inv-icon" style="color:#ffda1f !important; -webkit-text-fill-color:#ffda1f !important; fill:#ffda1f !important; text-shadow:0 1px 2px rgba(0,0,0,.45);"></i></button>`
                        : '';
            
                    // 9.5.9: Removed the separate printer + "Report" action button from Invoice Records.
                    // The compact "Rpt" button above remains the report PDF link.
                    let printReportBtn = '';

                    let stickerBtn = '';
                    if (canPrintSticker && inv.esn) {
                        stickerBtn = `<button type="button" class="action-btn" style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px;" title="Print Sticker" onclick="event.stopPropagation(); handlePrintSticker('${inv.key}', 'Invoice', '${poData.poNumber}')"><i class="fa-solid fa-qrcode"></i></button>`;
                    }

                    let waBtn = '';
                    if ((inv.status || '') === 'For Approval') {
                        waBtn = `<button type="button" class="action-btn" style="background-color:#25D366; color:#fff;" title="Send WhatsApp for Approval" onclick="event.stopPropagation(); window.imShareInvoiceForApprovalWhatsApp('${poData.poNumber}', '${inv.key}')"><i class="fa-brands fa-whatsapp"></i></button>`;
                    } else if ((inv.status || '') === 'For Inquiry') {
                        waBtn = `<button type="button" class="action-btn" style="background-color:#e2e8f0; color:#0f172a;" title="Inquire / Request Update via WhatsApp" onclick="event.stopPropagation(); window.imSendWhatsAppInquiry('${inv.invNumber || 'N/A'}', '${exactPdfUrl}')">
                            <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i><i class="fa-solid fa-question" style="font-size: 0.7em; margin-left: 2px; color: #00748C;"></i>
                        </button>`;
                    }

                    actionButtonsHTML = `<div class="modern-action-group im-record-actions">${editBtn} ${invPDFLink} ${reportViewLink} ${srvPDFLink} ${historyBtn} ${stickerBtn} ${waBtn}</div>`;
                } else if (isEcommitRecord && canEditInvoiceEntry) {
                    actionButtonsHTML = `<span style="font-size:0.8rem; color:#6f42c1; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-file-import"></i> Click to Import</span>`;
                }

                innerRows += `
                    <tr class="nested-invoice-row" 
                        data-po-number="${poData.poNumber}" 
                        data-invoice-key="${inv.key}" 
                        data-source="${inv.source}"
                        data-inv-number="${inv.invNumber || ''}" 
                        data-inv-date="${inv.invoiceDate || ''}"
                        data-release-date="${inv.releaseDate || ''}" 
                        data-inv-value="${inv.invValue || ''}"
                        title="${isEcommitRecord ? 'Click to Import' : 'Click to Edit'}"
                        style="cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: 0.2s;">
                        <td style="padding: 10px 5px; color: #64748b;">${escapeHtml(invEntryDisplay)}</td>
                        <td style="padding: 10px 5px; font-weight: 700; color: #00748C;">${inv.invNumber || 'N/A'}</td>
                        <td style="padding: 10px 5px;">${invoiceDateDisplay}</td>
                        <td style="padding: 10px 5px; text-align: right; font-family: monospace; font-weight: 600; color: #334155;">${invValueDisplay}</td>
                        <td style="padding: 10px 5px; text-align: right; font-family: monospace; font-weight: 600; color: #334155;">${amountPaidDisplay}</td>
                        <td style="padding: 10px 5px;">${releaseDateDisplay}</td>
                        <td style="padding: 10px 5px;"><span class="status-badge" style="background: #e2e8f0; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #334155;">${inv.status || 'N/A'}</span></td>
                        <td style="padding: 10px 5px; color: #64748b; font-size: 12px;">${inv.note || ''}</td>
                        <td style="padding: 10px 5px;" class="actions">${actionButtonsHTML}</td>
                    </tr>
                `;
            });

            let finalTotalPaid = totalPaidWithoutRetention;
            if (Math.abs(totalPaidWithRetention - totalInvValue) < 0.01) finalTotalPaid = totalPaidWithRetention;

            const diffValue = totalInvValue - finalTotalPaid;
            const diffColor = (diffValue > 0.05) ? '#dc3545' : '#28a745'; 
    
            const diffDisplay = canViewAmounts ? `<strong>${formatCurrency(diffValue)}</strong>` : '---';
            const totalInvValueDisplay = canViewAmounts ? `<strong>${formatCurrency(totalInvValue)}</strong>` : '---';
            const totalAmountPaidDisplay = canViewAmounts ? `<strong>${formatCurrency(finalTotalPaid)}</strong>` : '---';
    
            const poValueDisplay = canViewAmounts ? (poData.poDetails.Amount ? `QAR ${formatCurrency(poData.poDetails.Amount)}` : 'N/A') : '---';
            const balanceDisplay = canViewAmounts ? `QAR ${formatCurrency(poData.balance)}` : '---';

            let highlightClass = '';
            if (canViewAmounts) {
                if (poData.balance < -0.01) highlightClass = 'highlight-negative-balance';
                else if (Math.abs(poData.balance) < 0.01) {
                    if (allWithAccounts && Math.abs(finalTotalPaid - parseFloat(poData.poDetails.Amount)) < 0.01) highlightClass = 'highlight-fully-paid';
                    else if (allWithAccounts) highlightClass = 'highlight-partial';
                } 
                else if (poData.balance > 0.01) highlightClass = 'highlight-open-balance';
            }

            const isExpanded = imLastExpandedRowId === poData.poNumber ? 'expanded' : '';

            html += `
                <div class="invoice-card ${highlightClass} ${isExpanded}" data-po-id="${poData.poNumber}" style="box-sizing: border-box; width: 100%; overflow: hidden;">
                    <div class="master-grid-row">
                        <div class="grid-cell" style="width: 40px; color:#00748C;"><i class="fa-solid fa-chevron-down"></i></div>
                        <div class="grid-cell" style="font-weight: 800;">${poData.poNumber}</div>
                        <div class="grid-cell">${poData.site}</div>
                        <div class="grid-cell">${poData.vendor}</div>
                        <div class="grid-cell" style="font-family: monospace;">${poValueDisplay}</div>
                        <div class="grid-cell" style="font-family: monospace;">${canViewAmounts ? 'QAR ' + formatCurrency(totalInvValue) : '---'}</div>
                        <div class="grid-cell" style="font-weight: 800; font-family: monospace; color: ${poData.balance < 0 ? '#ef4444' : '#1e293b'}">${balanceDisplay}</div>
                    </div>
            
                    <div class="detail-grid-row im-invoice-entries-clean im-invoice-entries-flat" style="padding: 8px 14px 12px 36px; background-color: #fbfdff; border-top: 1px solid #eef2f7; box-sizing: border-box; width: 100%; overflow: visible;">
                        <div class="im-entries-title-strip" style="display:block; margin:0 0 6px 0; padding:0; border:0; background:transparent; box-shadow:none; line-height:1.2; color:#263238; -webkit-text-fill-color:#263238; font-size:.79rem; font-weight:700; text-transform:none; letter-spacing:0;">
                            <span class="im-entries-title-label">Invoice Entries</span><strong class="im-entries-title-po" style="margin-left:8px; color:#b42318; -webkit-text-fill-color:#b42318; font-weight:850; font-size:.82rem;">PO ${poData.poNumber}</strong>
                        </div>
                        <table class="im-nested-invoice-table" style="width: calc(100% - 18px); margin-left: 18px; border-collapse: collapse; text-align: left; font-size: 12px;">
                            <thead>
                                <tr class="im-entries-columns-row">
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important;">Inv. Entry</th>
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important;">Inv. No.</th>
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important;">Inv. Date</th>
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important; text-align:right !important;">Inv. Value</th>
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important; text-align:right !important;">Amt. Paid</th>
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important;">Release Date</th>
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important;">Status</th>
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important;">Note</th>
                                    <th style="padding:5px 5px 6px 5px !important; border:0 !important; border-bottom:1px solid #d9e2ec !important; background:#116045 !important; color:#facc15 !important; -webkit-text-fill-color:#facc15 !important; font-size:11px !important; font-weight:600 !important; letter-spacing:.035em !important; text-transform:uppercase !important; box-shadow:none !important; white-space:nowrap !important;">Action</th>
                                </tr>
                            </thead>
                            <tbody>${innerRows}</tbody>
                            <tfoot class="im-entries-total-footer">
                                <tr class="im-entries-total-row">
                                    <td colspan="3" class="im-entries-total-label">TOTAL</td>
                                    <td class="im-entries-total-value im-money-total">${totalInvValueDisplay}</td>
                                    <td class="im-entries-total-value im-money-paid">${totalAmountPaidDisplay}</td>
                                    <td class="im-entries-total-balance" style="color: ${diffColor}; -webkit-text-fill-color: ${diffColor};">${diffDisplay}</td>
                                    <td colspan="3" class="im-entries-total-spacer"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
        });

        contentArea.innerHTML = html;

        // POPULATE THE DEDICATED GRAND TOTAL CONTAINER
        const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
        if (grandTotalContainer) {
            if (canViewAmounts && currentReportData.length > 0) {
                grandTotalContainer.style.display = 'block';
                grandTotalContainer.style.width = '100%';
                grandTotalContainer.style.boxSizing = 'border-box';
                
                grandTotalContainer.innerHTML = `
                    <style>
                        @media (max-width: 768px) {
                            .summary-wrapper { flex-direction: column !important; align-items: flex-start !important; gap: 15px !important; padding: 15px !important; }
                            .summary-title-group { width: 100%; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; }
                            .summary-stats-group { flex-direction: column !important; width: 100%; gap: 12px !important; align-items: flex-start !important; }
                            .summary-stat-item { text-align: left !important; width: 100%; }
                        }
                    </style>

                    <div class="summary-wrapper" style="background: linear-gradient(to right, #003A5C, #00748C); border-radius: 12px; box-shadow: 0 8px 20px rgba(0, 58, 92, 0.15); display: flex; justify-content: space-between; align-items: center; padding: 22px 30px; margin-top: 25px; margin-bottom: 30px; width: 100%; box-sizing: border-box; color: white;">
                        
                        <div class="summary-title-group" style="display: flex; align-items: center; gap: 15px;">
                            <span class="im-summary-icon-fallback" aria-hidden="true" style="width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(186,230,253,.85);border-radius:7px;color:#bae6fd;font-size:17px;font-weight:700;line-height:1;">Σ</span>
                            <span style="font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">Search Results Summary</span>
                        </div>
                        
                        <div class="summary-stats-group" style="display: flex; gap: 40px; align-items: center;">
                            
                            <div class="summary-stat-item" style="display: flex; flex-direction: column; text-align: right; gap: 5px;">
                                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #e0f2fe; letter-spacing: 0.5px;">Total PO Value</span>
                                <span style="font-size: 16px; font-weight: 800; font-family: monospace;">QAR ${formatCurrency(grandTotalPO)}</span>
                            </div>
                            
                            <div class="summary-stat-item" style="display: flex; flex-direction: column; text-align: right; gap: 5px;">
                                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #e0f2fe; letter-spacing: 0.5px;">Total SRV</span>
                                <span style="font-size: 16px; font-weight: 800; font-family: monospace;">QAR ${formatCurrency(grandTotalInv)}</span>
                            </div>
                            
                            <div class="summary-stat-item" style="display: flex; flex-direction: column; text-align: right; gap: 5px;">
                                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #ffffff; letter-spacing: 0.5px;">Total Outstanding Balance</span>
                                <span style="font-size: 18px; font-weight: 900; font-family: monospace; color: #fde047;">QAR ${formatCurrency(grandTotalBalance)}</span>
                            </div>
                            
                        </div>
                    </div>
                `;
            } else {
                grandTotalContainer.style.display = 'none';
                grandTotalContainer.innerHTML = '';
            }
        }

       } catch (error) {
        console.error("Error generating report:", error);
        contentArea.innerHTML = '<div class="loading-state">Error loading report. Please try again.</div>';
    }
}

   	
// --- FORCE EXTERNAL LINK FOR FINANCIAL REPORT ---
document.addEventListener('click', function(e) {
    // Check if the clicked element is our Financial Report link
    const financeLink = e.target.closest('#im-finance-report-nav-link');
    
    if (financeLink) {
        // Stop the app's internal navigation from blocking this click
        e.stopPropagation(); 
        
        // The browser will now follow the href="https://port.iba.com.qa/Epicore/" naturally
        console.log("Navigating to Epicore external site...");
    }
}, true); // The 'true' here makes this run BEFORE the app's other scripts



// --- PRINTING LOGIC (PROFESSIONAL GITHUB STYLE WITH FORCED COLORS & CORRECT LABELS) ---
window.generateGithubStylePrintout = function(isDetailed) {
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    if (!isAdmin && !isAccounting) {
        if (typeof window.playSystemError === 'function') window.playSystemError();
        return alert("Permission denied to print financial data.");
    }

    if (!currentReportData || currentReportData.length === 0) {
        if (typeof window.playSystemError === 'function') window.playSystemError();
        return alert("No records to print. Please search first.");
    }

    const formatForPrint = (dateStr) => {
        if (!dateStr) return '---';
        const d = new Date(normalizeDateForInput(dateStr) + 'T00:00:00');
        if (isNaN(d)) return dateStr;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    };

    let totalPOAmt = 0;
    let totalInvAmt = 0;

let rowsHtml = '';
currentReportData.forEach(poData => {
    const poVal = poData.poAmount || parseFloat(poData.poDetails?.Amount) || 0;
    totalPOAmt += poVal;
    
    let invVal = 0;
    let poTotalPaid = 0;
    poData.filteredInvoices.forEach(i => {
        invVal += parseFloat(i.invValue) || 0;
        // ONLY add to paid total if INV. NO. does NOT contain "retention"
        const invNoPrint = (i.invNumber || '').toLowerCase();
        if (!invNoPrint.includes('retention')) {
            poTotalPaid += parseFloat(i.amountPaid) || 0;
        }
    });
    totalInvAmt += invVal;

    let balance = poVal - invVal;

    if (isDetailed) {
            let invRows = poData.filteredInvoices.map(inv => `
                <tr class="detail-row">
                    <td style="color: #64748b;">${escapeHtml(imInvoiceRecordEntryLabel(inv) || '---')}</td>
                    <td><span style="color: #00748C; font-weight: 600;">${inv.invNumber || 'N/A'}</span></td>
                    <td>${formatForPrint(inv.invoiceDate)}</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 600;">${formatCurrency(inv.invValue)}</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 600;">${formatCurrency(inv.amountPaid)}</td>
                    <td>${formatForPrint(inv.releaseDate)}</td>
                    <td><span class="status-badge" style="background-color: #e2e8f0; color: #334155;">${inv.status || 'Pending'}</span></td>
                    <td style="color: #64748b; font-size: 11px;">${inv.note || '---'}</td>
                </tr>
            `).join('');

            // HERE ARE THE UPDATED LABELS YOU REQUESTED:
            let poSubtotalRow = `
                <tr class="detail-row" style="background-color: #f1f5f9;">
                    <td colspan="3" style="text-align: right; font-weight: 800; color: #475569; font-size: 11px; text-transform: uppercase;">Total Invoice Value:</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 800; color: #0f172a;">${formatCurrency(invVal)}</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 800; color: #0f172a;">${formatCurrency(poTotalPaid)}</td>
                    <td colspan="2" style="text-align: right; font-weight: 800; color: #475569; font-size: 11px; text-transform: uppercase;">Balance Payment:</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 800; color: ${balance < 0 ? '#dc3545' : '#0f172a'};">${formatCurrency(balance)}</td>
                </tr>
            `;

            rowsHtml += `
                <tr class="master-row">
                    <td colspan="7">
                        <strong style="color: #003A5C; font-size: 13px;">PO: ${poData.poNumber}</strong> &nbsp;|&nbsp; 
                        Vendor: ${poData.vendor} &nbsp;|&nbsp; 
                        Site: ${poData.site}
                    </td>
                    <td class="right-align" style="font-family: monospace; color: #003A5C; font-size: 13px; font-weight: bold;">${formatCurrency(poVal)}</td>
                </tr>
                ${invRows}
                ${poSubtotalRow}
            `;
        } else {
            rowsHtml += `
                <tr class="master-row">
                    <td>${poData.poNumber}</td>
                    <td>${poData.vendor}</td>
                    <td>${poData.site}</td>
                    <td class="right-align" style="font-family: monospace;">${formatCurrency(poVal)}</td>
                    <td class="right-align" style="font-family: monospace;">${formatCurrency(invVal)}</td>
                    <td class="right-align" style="font-family: monospace; color: ${balance < 0 ? '#dc3545' : 'inherit'}">${formatCurrency(balance)}</td>
                </tr>
            `;
        }
    });

    const headerHTML = isDetailed 
        ? `<tr><th>Inv. Entry</th><th>Inv. No.</th><th>Inv. Date</th><th class="right-align">Inv. Value</th><th class="right-align">Amt. Paid</th><th>Release Date</th><th>Status</th><th>Note</th></tr>`
        : `<tr><th>PO Number</th><th>Vendor</th><th>Site</th><th class="right-align">PO Value (QAR)</th><th class="right-align">Total Inv (QAR)</th><th class="right-align">Balance (QAR)</th></tr>`;

    let totalBalance = totalPOAmt - totalInvAmt;

    const printHtml = `
        <!DOCTYPE html>
        <html><head><title>Invoice Records Report</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #1e293b; margin: 0; background: #fff;}
            .print-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #003A5C; padding-bottom: 12px; margin-bottom: 25px; }
            .print-header h2 { margin: 0; color: #003A5C; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .print-header p { margin: 0; color: #64748b; font-size: 13px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f8fafc; color: #475569; padding: 12px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; text-align: left; }
            td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; font-size: 12px; }
            .master-row td { background-color: #f1f5f9; font-weight: 700; color: #0f172a; border-top: 2px solid #cbd5e1; }
            .detail-row td { color: #334155; }
            .status-badge { font-size: 10px; padding: 3px 6px; border-radius: 12px; font-weight: 600; white-space: nowrap; }
            .right-align { text-align: right; }
            
            @media print { 
                body { padding: 0; } 
                * { 
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important; 
                    color-adjust: exact !important; 
                }
            }
        </style>
        </head><body>
            <div class="print-header">
                <h2>${isDetailed ? 'Detailed Report: POs & Invoices' : 'Summary Report: POs & Invoices'}</h2>
                <p>Generated on: ${new Date().toLocaleString()} &nbsp; | &nbsp; Records: ${currentReportData.length}</p>
            </div>
            <table>
                <thead>${headerHTML}</thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            
            <div class="print-summary-box" style="display: flex; justify-content: flex-end; margin-top: 25px; page-break-inside: avoid;">
                <div style="display: flex; gap: 20px; align-items: center; border: 2px solid #003A5C; border-radius: 8px; padding: 10px 20px; background-color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: #475569; font-weight: 800; text-transform: uppercase;">Grand Total PO Value:</span>
                        <span style="font-size: 14px; color: #0f172a; font-family: monospace; font-weight: 800;">QAR ${formatCurrency(totalPOAmt)}</span>
                    </div>
                    <div style="width: 2px; background: #cbd5e1; height: 16px;"></div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: #475569; font-weight: 800; text-transform: uppercase;">Grand Total SRV:</span>
                        <span style="font-size: 14px; color: #0f172a; font-family: monospace; font-weight: 800;">QAR ${formatCurrency(totalInvAmt)}</span>
                    </div>
                    <div style="width: 2px; background: #cbd5e1; height: 16px;"></div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: #003A5C; font-weight: 800; text-transform: uppercase;">Total Outstanding:</span>
                        <span style="font-size: 15px; color: #003A5C; font-family: monospace; font-weight: 800;">QAR ${formatCurrency(totalBalance)}</span>
                    </div>
                </div>
            </div>

        </body></html>
    `;

    const modal = document.getElementById('im-print-preview-modal');
    const iframe = document.getElementById('im-print-preview-iframe');
    
    if (modal && iframe) {
        modal.classList.remove('hidden');
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(printHtml);
        doc.close();
    } else {
        const win = window.open('', '_blank');
        win.document.write(printHtml);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    }
};

// --- FORCE GRAND TOTAL BOX TO HIDE ON CLEAR ---
document.addEventListener("DOMContentLoaded", () => {
    const myClearBtn = document.getElementById("clearAllBtn");
    
    if (myClearBtn) {
        myClearBtn.addEventListener("click", () => {
            const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
            if (grandTotalContainer) {
                grandTotalContainer.style.display = 'none';
                grandTotalContainer.innerHTML = '';
            }
        });
    }
});

// ==========================================================================
// 7.6.1: Invoice Records Totals Footer moved to js/app-invoice.js.
// ==========================================================================


// ==========================================================================
// 17. INVOICE MANAGEMENT: REPORTING ACTIONS
// ==========================================================================


// #endregion BLOCK 18 — INVOICE REPORTING, RECORDS, DEEP LINKS + SHARING


// =================================================================================================
// #region BLOCK 19 — PRINT REPORTS + CSV DOWNLOADS
// Moved to js/app-reporting-actions.js in v8.1.2 (cleanup only).
// Public functions preserved:
// - window.handleGeneratePrintReport
// - window.handleDownloadCSV
// =================================================================================================
// #endregion BLOCK 19 — PRINT REPORTS + CSV DOWNLOADS


// =================================================================================================
// #region BLOCK 20 — BATCH ENTRY + SUMMARY NOTES
// Purpose: Batch row attention picker, add PO/invoice to batch, batch global search, save batch invoices, note dropdowns, summary generation/update.
// =================================================================================================
