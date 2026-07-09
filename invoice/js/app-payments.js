// js/app-payments.js
// 8.3.0 — Payment workflow moved out of app.js (cleanup only).
// Public function names preserved for existing event wiring.

// ==========================================================================
// 21. INVOICE MANAGEMENT: PAYMENTS
// ==========================================================================

function updatePaymentModalTotal() {
    const modalResultsContainer = document.getElementById('im-payment-modal-results');
    const checkboxes = modalResultsContainer.querySelectorAll('.payment-modal-inv-checkbox:checked');

    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (!totalDisplay) return;

    let totalSum = 0;
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        if (row) {
            const invValueCell = row.cells[2].textContent;
            const value = parseFloat(String(invValueCell).replace(/,/g, ''));
            if (!isNaN(value)) {
                totalSum += value;
            }
        }
    });
    totalDisplay.textContent = formatCurrency(totalSum);
}

async function handlePaymentModalPOSearch() {
    const poNumber = imPaymentModalPOInput.value.trim().toUpperCase();
    const totalDisplay = document.getElementById('payment-modal-total-value');

    // 1. Reset Total Display
    if (totalDisplay) totalDisplay.textContent = formatCurrency(0);

    if (!poNumber) {
        imPaymentModalResults.innerHTML = '<p>Please enter a PO Number.</p>';
        return;
    }
    
    imPaymentModalResults.innerHTML = '<p>Searching...</p>';

    try {
        // 11.0.5: Payment PO search only needs one PO bucket. Do not download the
        // full invoice_entries tree just to find payable invoices for a typed PO.
        if (typeof ensureInvoicePOBaseDataFetched === 'function') {
            await ensureInvoicePOBaseDataFetched(false);
        } else if (typeof ensureInvoiceLightDataFetched === 'function') {
            await ensureInvoiceLightDataFetched(false);
        }

        let invoicesData = (allInvoiceData && allInvoiceData[poNumber]) ? allInvoiceData[poNumber] : null;
        if (!invoicesData && typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) {
            const snap = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
            invoicesData = snap.val() || null;
            if (invoicesData) {
                if (!allInvoiceData) allInvoiceData = {};
                allInvoiceData[poNumber] = invoicesData;
                if (window.__invoiceEntriesFullLoaded !== true) window.__invoiceEntriesFullLoaded = false;
            }
        }

        if (!invoicesData) {
             imPaymentModalResults.innerHTML = '<p>No invoices found for this PO.</p>';
             return;
        }

        // 2. Create Table Structure Programmatically
        imPaymentModalResults.innerHTML = ''; // Clear loading text
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th><input type="checkbox" id="payment-modal-select-all"></th>
                    <th>Inv. Entry ID</th>
                    <th>Inv. Value</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody id="payment-modal-tbody"></tbody>
        `;
        imPaymentModalResults.appendChild(table);
        const tbody = table.querySelector('tbody');

        const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        let resultsFound = false;

        // 3. Loop Through Invoices
        for (const [key, inv] of sortedInvoices) {
            // Filter: Only "With Accounts" AND not already in the payment list
            if (inv.status === 'With Accounts' && !invoicesToPay[key]) {
                resultsFound = true;
                
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer'; // Make the cursor look like a hand

                tr.innerHTML = `
                    <td style="text-align:center;">
                        <input type="checkbox" class="payment-modal-inv-checkbox" data-key='${key}' data-po='${poNumber}'>
                    </td>
                    <td>${inv.invEntryID || ''}</td>
                    <td>${formatCurrency(inv.invValue)}</td>
                    <td>${inv.status || ''}</td>
                `;

                // --- CLICK ROW LOGIC ---
                tr.addEventListener('click', (e) => {
                    // If user clicked the checkbox directly, do nothing (let default behavior work)
                    if (e.target.type === 'checkbox') return;

                    // Otherwise, find the checkbox and toggle it
                    const checkbox = tr.querySelector('.payment-modal-inv-checkbox');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        updatePaymentModalTotal(); // Recalculate Sum immediately
                    }
                });

                // Add Listener to Checkbox itself (for direct clicks)
                const checkbox = tr.querySelector('.payment-modal-inv-checkbox');
                checkbox.addEventListener('change', updatePaymentModalTotal);

                tbody.appendChild(tr);
            }
        }

        // 4. Handle Empty or Success States
        if (!resultsFound) {
            imPaymentModalResults.innerHTML = '<p>No invoices found for this PO with status "With Accounts" that haven\'t already been added.</p>';
        } else {
            // "Select All" Logic
            const selectAll = document.getElementById('payment-modal-select-all');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    const checkboxes = tbody.querySelectorAll('.payment-modal-inv-checkbox');
                    checkboxes.forEach(chk => chk.checked = e.target.checked);
                    updatePaymentModalTotal(); // Update Total
                });
            }
        }

    } catch (error) {
        console.error("Error searching in payment modal:", error);
        imPaymentModalResults.innerHTML = '<p>An error occurred while searching.</p>';
    }
}

async function handleAddSelectedToPayments() {
    const selectedCheckboxes = document.getElementById('im-payment-modal-results').querySelectorAll('.payment-modal-inv-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert("Please select at least one invoice to add.");
        return;
    }

    let addedCount = 0;

    if (typeof ensureInvoicePOBaseDataFetched === 'function') {
        await ensureInvoicePOBaseDataFetched(false);
    } else if (typeof ensureInvoiceLightDataFetched === 'function') {
        await ensureInvoiceLightDataFetched(false);
    }

    // The modal already fetched each selected PO bucket. As a safety net, fetch only
    // any exact PO that is missing from the local partial cache.
    const missingPOs = Array.from(new Set(Array.from(selectedCheckboxes).map(chk => String(chk.dataset.po || '').trim().toUpperCase()).filter(Boolean)))
        .filter(po => !(allInvoiceData && allInvoiceData[po]));
    for (const po of missingPOs) {
        try {
            const snap = await invoiceDb.ref(`invoice_entries/${po}`).once('value');
            if (!allInvoiceData) allInvoiceData = {};
            allInvoiceData[po] = snap.val() || {};
            if (window.__invoiceEntriesFullLoaded !== true) window.__invoiceEntriesFullLoaded = false;
        } catch (err) {
            console.warn('Payment selected PO fetch failed:', po, err);
        }
    }

    selectedCheckboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        const po = checkbox.dataset.po;

        if (invoicesToPay[key]) return;

        const invData = (allInvoiceData[po] && allInvoiceData[po][key]) ? allInvoiceData[po][key] : null;

        if (invData) {
            invoicesToPay[key] = {
                ...invData,
                key,
                po,
                originalAttention: invData.attention
            };

            const poDetails = allPOData[po] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            const row = document.createElement('tr');
            row.setAttribute('data-key', key);
            row.setAttribute('data-po', po);

            row.innerHTML = `
                <td>${po}</td>
                <td>${site}</td>
                <td>${vendor}</td>
                <td>${invData.invEntryID || ''}</td>
                <td>
                    <input type="number" name="invValue" class="payment-input" step="0.01" value="${invData.invValue || ''}" readonly style="background-color: #f0f0f0;">
                </td>
                <td>
                    <input type="number" name="amountPaid" class="payment-input highlight-field" step="0.01" value="${invData.invValue || ''}">
                </td>
                <td>
                    <input type="date" name="releaseDate" class="payment-input" value="${getTodayDateString()}">
                </td>
                <td>${invData.status || ''}</td>
                <td><button type="button" class="delete-btn payment-remove-btn" title="Remove from list">&times;</button></td>
            `;

            imPaymentsTableBody.appendChild(row);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        updatePaymentsCount();

        const modal = document.getElementById('im-add-payment-modal');
        if (modal) modal.classList.add('hidden');

        document.getElementById('im-payment-modal-po-input').value = '';
        document.getElementById('im-payment-modal-results').innerHTML = '';
    } else {
        alert("The selected invoices are already in your payment list.");
    }
}

function updatePaymentsCount() {
    if (paymentsCountDisplay) {
        const rows = imPaymentsTableBody.querySelectorAll('tr');
        paymentsCountDisplay.textContent = `(Total to Pay: ${rows.length})`;
    }
}

async function handleSavePayments() {
    const rows = imPaymentsTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("There are no payments in the list to save.");
        return;
    }
    if (!confirm(`You are about to mark ${rows.length} invoice(s) as 'Paid'. This will update their status, Invoice Value, Amount To Paid, and Release Date. Continue?`)) {
        return;
    }

    const savePromises = [];
    const localCacheUpdates = [];
    let updatesMade = 0;

    for (const row of rows) {
        const invoiceKey = row.dataset.key;
        const poNumber = row.dataset.po;
        const originalInvoiceData = invoicesToPay[invoiceKey];

        if (!invoiceKey || !poNumber || !originalInvoiceData) {
            console.warn("Skipping row with missing data:", row);
            continue;
        }

        const invValueInput = row.querySelector('input[name="invValue"]');
        const amountPaidInput = row.querySelector('input[name="amountPaid"]');
        const releaseDateInput = row.querySelector('input[name="releaseDate"]');

        const newInvValue = parseFloat(invValueInput.value) || 0;
        const newAmountPaid = parseFloat(amountPaidInput.value) || 0;
        const newReleaseDate = releaseDateInput.value || getTodayDateString();

        const updates = {
            status: 'Paid',
            invValue: newInvValue,
            amountPaid: newAmountPaid,
            releaseDate: newReleaseDate
        };

        savePromises.push(
            invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates)
        );

        // === SYNC LINKED JOB ENTRY ===
        await updateLinkedJobEntry(poNumber, invoiceKey, 'Paid', 'Payment processed');

        const updatedFullData = { ...originalInvoiceData, ...updates };
        savePromises.push(
            updateInvoiceTaskLookup(poNumber, invoiceKey, updatedFullData, originalInvoiceData.attention)
        );

        localCacheUpdates.push({
            po: poNumber,
            key: invoiceKey,
            data: updates
        });
        updatesMade++;
    }

    try {
        await Promise.all(savePromises);

        if (allInvoiceData) {
            for (const update of localCacheUpdates) {
                if (allInvoiceData[update.po] && allInvoiceData[update.po][update.key]) {
                    allInvoiceData[update.po][update.key] = {
                        ...allInvoiceData[update.po][update.key],
                        ...update.data
                    };
                }
            }
            console.log("Local invoice cache updated surgically.");
        }

        alert(`${updatesMade} payment(s) processed successfully! Invoices updated to 'Paid'.`);
        imPaymentsTableBody.innerHTML = '';
        invoicesToPay = {};
        updatePaymentsCount();
        allSystemEntries = [];
    } catch (error) {
        console.error("Error saving payments:", error);
        alert("An error occurred while saving payments. Some updates may have failed. Please check the data and try again.");
    }
}
