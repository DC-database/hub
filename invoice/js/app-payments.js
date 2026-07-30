// ============================================================================
// IBA 11.5.7 — Continuous Multi-Company Payment Search
// Lets authorized users collect With Accounts invoices from one or more
// companies and mark the complete payment cart Paid in one atomic checkout.
// ============================================================================

let paymentSearchResults = new Map();
let paymentRestoredStorageKey = '';

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
            version: '11.5.7',
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

async function paymentFetchPOBucket(poNumber) {
    const po = paymentText(poNumber).toUpperCase();
    if (!po) return {};
    if (allInvoiceData && Object.prototype.hasOwnProperty.call(allInvoiceData, po)) {
        return allInvoiceData[po] || {};
    }
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return {};
    const snap = await invoiceDb.ref(`invoice_entries/${po}`).once('value');
    const bucket = snap.val() || {};
    if (!allInvoiceData) allInvoiceData = {};
    allInvoiceData[po] = bucket;
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
            if (!(poMatch || supplierMatch || supplierIdMatch || invoiceMatch || entryMatch)) return;
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
        await paymentEnsurePOBaseData();
        const queryLower = paymentNormalize(query);
        const queryUpper = paymentText(query).toUpperCase();
        const candidatePOs = new Set();
        const allPOs = (typeof allPOData !== 'undefined' && allPOData) ? allPOData : {};

        Object.entries(allPOs).forEach(([poNumber, poData]) => {
            const supplierName = paymentText(
                poData['Supplier Name'] || poData['Supplier Name:'] || poData.Supplier
            );
            const supplierId = paymentNormalizeSupplierId(
                poData['Supplier ID'] || poData['Vendor ID'] || poData.vendor_id
            );
            if (
                paymentNormalize(poNumber).includes(queryLower) ||
                paymentNormalize(supplierName).includes(queryLower) ||
                supplierId.toLowerCase().includes(queryLower)
            ) {
                candidatePOs.add(paymentText(poNumber).toUpperCase());
            }
        });

        Object.entries(allInvoiceData || {}).forEach(([poNumber, bucket]) => {
            if (Object.values(bucket || {}).some(invoice =>
                paymentNormalize(invoice && (invoice.invNumber || invoice.invoiceNo || invoice.invEntryID)).includes(queryLower)
            )) {
                candidatePOs.add(paymentText(poNumber).toUpperCase());
            }
        });

        if (!/[\s.#$/[\]]/.test(queryUpper)) candidatePOs.add(queryUpper);
        if (candidatePOs.size > 150) {
            imPaymentModalResults.innerHTML = '<p>Too many POs match this company search. Please enter a more specific company name, PO number, or invoice number.</p>';
            return;
        }

        const candidateList = Array.from(candidatePOs).filter(Boolean);
        for (let index = 0; index < candidateList.length; index += 12) {
            const batch = candidateList.slice(index, index + 12);
            await Promise.all(batch.map(po => paymentFetchPOBucket(po)));
        }

        let results = paymentCollectMatches(candidateList, query);

        // Invoice-number searches cannot be addressed directly in the nested Firebase
        // tree without the PO. Run the existing deeper search only after a direct
        // PO/company/cache search returns nothing and only because the user requested it.
        if (!results.length && window.__invoiceEntriesFullLoaded !== true && typeof ensureInvoiceDataFetched === 'function') {
            imPaymentModalResults.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Running deeper invoice-number search…</p>';
            await ensureInvoiceDataFetched(false);
            results = paymentCollectMatches(Object.keys(allInvoiceData || {}), query);
        }

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
            throw new Error(`${missing.length} invoice record(s) could not be found. No checkout was completed.`);
        }
        const changed = currentRecords.filter(record => paymentNormalize(record.invoice.status) !== 'with accounts');
        if (changed.length) {
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
window.ibaPaymentTools = {
    parseAmount: paymentParseAmount,
    normalizeSupplierId: paymentNormalizeSupplierId
};
