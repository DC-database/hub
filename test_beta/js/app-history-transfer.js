// js/app-history-transfer.js
// Version 8.3.2
// Moved from app.js: BLOCK 24 — Invoice / Transfer History + Stock Reversal
// Logic preserved; only file location changed.

// #region BLOCK 24 — INVOICE / TRANSFER HISTORY + STOCK REVERSAL
// Purpose: Invoice history, history stickers, transfer history, reverse/update stock inventory, transfer delete handling.
// =================================================================================================

    window.logInvoiceHistory = async function (poNumber, invoiceKey, newStatus, note = "") {
        if (!poNumber || !invoiceKey) return;

        const historyEntry = {
            status: newStatus,
            updatedBy: currentApprover ? currentApprover.Name : 'System',
            timestamp: Date.now(),
            note: note || ''
        };

        try {
            await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}/history`).push(historyEntry);
        } catch (e) {
            console.error("Failed to log history", e);
        }
    };

// =========================================================
// 2. VIEW HISTORY (WITH DURATION CALCULATION FIXED)
// =========================================================
window.showInvoiceHistory = async function (poNumber, invoiceKey) {
    const modal = document.getElementById('history-modal');
    const tbody = document.getElementById('history-table-body');
    const loader = document.getElementById('history-modal-loader');

    if (modal) modal.classList.remove('hidden');
    if (loader) loader.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';

    try {
        const snapshot = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}/history`).once('value');
        const historyData = [];

        snapshot.forEach(child => { historyData.push(child.val()); });

        // 1. Sort ASCENDING first (Oldest First) to calculate duration
        historyData.sort((a, b) => a.timestamp - b.timestamp);

        // 2. Calculate Duration
        historyData.forEach((entry, index) => {
            if (index === 0) {
                entry.durationDisplay = '-'; // First entry has no duration
            } else {
                const prevTime = historyData[index - 1].timestamp;
                const currTime = entry.timestamp;
                const diffMs = currTime - prevTime;

                // Math logic
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                if (diffDays > 0) entry.durationDisplay = `${diffDays}d ${diffHrs}h`;
                else if (diffHrs > 0) entry.durationDisplay = `${diffHrs}h ${diffMins}m`;
                else entry.durationDisplay = `${diffMins}m`;
            }
        });

        // 3. Reverse back to DESCENDING (Newest First) for display
        historyData.reverse();

        // --- SMART SEARCH FOR ESN (Keep existing logic) ---
        let sharedEsn = null;
        let sharedLink = null;
        for (const entry of historyData) {
            if (entry.esn && entry.pdfLink) {
                sharedEsn = entry.esn;
                sharedLink = entry.pdfLink;
                break;
            }
        }

        if (loader) loader.classList.add('hidden');

        if (historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
            return;
        }

        historyData.forEach((h) => {
            const dateObj = new Date(h.timestamp);
            const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // QR Logic
            let qrButton = '';
            let currentEsn = h.esn;
            let currentLink = h.pdfLink;

            if (!currentEsn && (h.action === 'Approved' || h.status === 'Approved') && sharedEsn) {
                currentEsn = sharedEsn;
                currentLink = sharedLink;
            }

            if (currentEsn && currentLink) {
                qrButton = `
                <button onclick="printHistorySticker('${currentEsn}', '${currentLink}')" 
                        class="action-btn" 
                        title="Print QR Sticker (${currentEsn})"
                        style="background-color: #6f42c1; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-left: 5px; cursor: pointer;">
                    <i class="fa-solid fa-qrcode"></i> Print
                </button>`;
            }

            // [MODIFIED] Added h.durationDisplay to the 4th column
            const row = `
            <tr>
                <td>
                    <strong>${h.action || h.status}</strong>
                    ${qrButton} <br>
                    <small style="color:#777">${h.note || ''}</small>
                </td>
                <td>${dateStr}</td>
                <td>${h.updatedBy || h.by || 'System'}</td>
                <td style="font-weight: bold; color: #00748C;">${h.durationDisplay}</td>
            </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        if (loader) loader.classList.add('hidden');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
};

    // --- NEW: Dashboard Double-Click Logic ---
    const dashboardNavLink = document.getElementById('im-dashboard-nav-link');
    if (dashboardNavLink) {
        dashboardNavLink.addEventListener('dblclick', (e) => {
            e.preventDefault();
            // Only load if we are currently IN the IM view
            if (!invoiceManagementView.classList.contains('hidden')) {
                // Visual Feedback
                const dbSection = document.getElementById('im-dashboard');
                dbSection.innerHTML = `
                    <h1>Dashboard</h1>
                    <div style="text-align: center; padding-top: 50px;">
                        <p>Loading data...</p>
                    </div>
                `;
                // Trigger the Load
                populateInvoiceDashboard(true);
            }
        });
    }


// =========================================================
// 3. PRINT HISTORY STICKER (MANAGER 1, 2, 3 LOGIC)
// =========================================================
window.printHistorySticker = function(esn, link) {
    if (!esn || !link) {
        alert("Error: ESN or Link missing for this record.");
        return;
    }

    // 1. ASK FOR POSITION
    const pos = prompt(
        "Select Sticker Position on A4 Paper:\n\n" +
        "1 - Manager 1 (Bottom LEFT)\n" +
        "2 - Manager 2 (Bottom CENTER)\n" +
        "3 - Manager 3 (Bottom RIGHT)", 
        "1"
    );

    if (!pos) return; // Cancelled

    // 2. DEFINE CSS POSITION
    let cssPosition = "";
    if (pos === "1") cssPosition = "bottom: 20mm; left: 20mm;"; // Manager 1
    else if (pos === "2") cssPosition = "bottom: 20mm; left: 50%; transform: translateX(-50%);"; // Manager 2
    else if (pos === "3") cssPosition = "bottom: 20mm; right: 20mm;"; // Manager 3
    else { alert("Invalid selection"); return; }

    const dateStr = new Date().toLocaleDateString('en-GB');

    // 3. OPEN PRINT WINDOW
    const printWin = window.open('', '', 'width=600,height=600');
    printWin.document.write(`
        <html>
        <head>
            <title>Print Sticker - ${esn}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
            <style>
                @page { size: A4; margin: 0; }
                body { margin: 0; padding: 0; width: 210mm; height: 297mm; position: relative; }
                
                #sticker-container {
                    position: absolute;
                    ${cssPosition} /* Applies the Manager 1/2/3 logic */
                    width: auto;
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    padding: 5px;
                    background: white;
                    border: 1px dashed #ccc; /* Helper border, remove if unwanted */
                }
                .main-box { text-align: center; padding-right: 5px; border-right: 1px solid #000; }
                .status-text { font-weight: 900; font-size: 14px; color: #28a745; margin-bottom: 2px; }
                .esn-text { font-family: monospace; font-weight: bold; font-size: 10px; margin-top: 2px; }
                .side-text { 
                    writing-mode: vertical-rl; 
                    text-orientation: mixed; 
                    font-size: 8px; 
                    font-weight: bold; 
                    margin-left: 5px;
                }
            </style>
        </head>
        <body>
            <div id="sticker-container">
                <div class="main-box">
                    <div class="status-text">APPROVED</div>
                    <div id="qrcode"></div>
                    <div class="esn-text">${esn}</div>
                </div>
                <div class="side-text">${dateStr}</div>
            </div>
            <script>
                new QRCode(document.getElementById("qrcode"), {
                    text: "${link}",
                    width: 80,
                    height: 80,
                    correctLevel: QRCode.CorrectLevel.M
                });
                // Wait for QR render then print
                setTimeout(() => { window.print(); window.close(); }, 500);
            <\/script>
        </body>
        </html>
    `);
    printWin.document.close();
};

    // --- Manual PO Entry Logic ---
    const manualSupplierIdInput = document.getElementById('manual-supplier-id');

    // 1. Auto-lookup Vendor Name when ID is typed
    if (manualSupplierIdInput) {
        manualSupplierIdInput.addEventListener('input', (e) => {
            const id = e.target.value.trim();
            const nameInput = document.getElementById('manual-vendor-name');

            if (allVendorsData && allVendorsData[id]) {
                nameInput.value = allVendorsData[id];
                nameInput.style.backgroundColor = "#d4edda"; // Green tint for success
            } else {
                nameInput.value = "";
                nameInput.style.backgroundColor = "#f9f9f9";
            }
        });


    // 1b. Auto-lookup Supplier ID when Vendor Name is typed/selected
    const manualVendorNameInput = document.getElementById('manual-vendor-name');
    if (manualVendorNameInput) {
        manualVendorNameInput.addEventListener('input', (e) => {
            const name = String(e.target.value || '').trim();
            if (!name) {
                // If user clears name, don't force-clear ID (they might be typing ID instead)
                return;
            }
            try {
                if (typeof buildManualVendorDatalistIfNeeded === 'function') {
                    buildManualVendorDatalistIfNeeded();
                }
                if (typeof buildJobVendorDatalistIfNeeded === 'function') {
                    buildJobVendorDatalistIfNeeded();
                }
                const id = (typeof getVendorIdByName === 'function') ? getVendorIdByName(name) : '';
                if (id && manualSupplierIdInput) {
                    manualSupplierIdInput.value = id;
                }
            } catch (_) {
                // Best-effort
            }
            try {
                if (typeof showManualVendorSuggest === 'function') showManualVendorSuggest(manualVendorNameInput.value);
            } catch (_) {}
        });


        manualVendorNameInput.addEventListener('focus', async () => {
            try {
                if (typeof ensureVendorsDataFetchedForJobEntry === 'function') await ensureVendorsDataFetchedForJobEntry(false);
                if (typeof buildManualVendorDatalistIfNeeded === 'function') buildManualVendorDatalistIfNeeded();
                if (typeof buildJobVendorDatalistIfNeeded === 'function') buildJobVendorDatalistIfNeeded();
                if (typeof showManualVendorSuggest === 'function') showManualVendorSuggest(manualVendorNameInput.value);
            } catch (_) {}
        });

        manualVendorNameInput.addEventListener('change', () => {
            try {
                const name = String(manualVendorNameInput.value || '').trim();
                const id = (typeof getVendorIdByName === 'function') ? getVendorIdByName(name) : '';
                if (id && manualSupplierIdInput) manualSupplierIdInput.value = id;
            } catch (_) {}
            try {
                if (typeof hideManualVendorSuggest === 'function') hideManualVendorSuggest();
            } catch (_) {}
        });

        manualVendorNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                try {
                    if (typeof hideManualVendorSuggest === 'function') hideManualVendorSuggest();
                } catch (_) {}
            }
        });

        manualVendorNameInput.addEventListener('blur', () => {
            setTimeout(() => {
                try {
                    if (typeof hideManualVendorSuggest === 'function') hideManualVendorSuggest();
                } catch (_) {}
            }, 120);
        });
    }
}

   // =========================================================
// MANUAL PO SAVE (Corrected: Saves to 'invoiceDb' > 'purchase_orders')
// =========================================================
const saveManualPOBtn = document.getElementById('im-save-manual-po-btn');
if (saveManualPOBtn) {
    saveManualPOBtn.addEventListener('click', async () => {
        const po = document.getElementById('manual-po-number').value.trim().toUpperCase();
        const supplierId = String(document.getElementById('manual-supplier-id')?.value || '').trim();
        const vendor = String(document.getElementById('manual-vendor-name')?.value || '').trim();
        const site = String(document.getElementById('manual-site-select')?.value || '').trim();
        const amount = String(document.getElementById('manual-po-amount')?.value || '').trim();

        if (!vendor || !site || !amount) {
            alert("Please fill in Vendor Name, Site, and Total PO Value.");
            return;
        }

        const manualPOData = {
            'PO': po,
            'Supplier Name': vendor,
            'Project ID': site,
            'Amount': amount,
            'IsManual': true
        };

        // Store Supplier ID if provided (helps Finance report + vendor traceability)
        if (supplierId) {
            manualPOData['Supplier ID'] = supplierId;
        }

        // 1. UPDATE MEMORY IMMEDIATELY
        if (!allPOData) allPOData = {};
        allPOData[po] = manualPOData;

        // 2. SAVE TO FIREBASE PERMANENTLY (CORRECTED TARGET)
        try {
            saveManualPOBtn.textContent = "Saving...";
            
            // FIX: Use 'invoiceDb' (invoiceentry-b15a8) and 'purchase_orders' path
            await invoiceDb.ref(`purchase_orders/${po}`).set(manualPOData);
            
            // Close Modal and Proceed
            document.getElementById('im-manual-po-modal').classList.add('hidden');
            proceedWithPOLoading(po, manualPOData);
        } catch(e) {
            console.error("Error saving manual PO", e);
            alert("Could not save Manual PO to database.");
        } finally {
            saveManualPOBtn.textContent = "Save & Continue";
        }
    });
}

    window.showTransferHistory = async function (key) {
    const modal = document.getElementById('history-modal');
    const loader = document.getElementById('history-modal-loader');
    const tbody = document.getElementById('history-table-body');

    if (modal) modal.classList.remove('hidden');
    if (loader) loader.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';

    try {
        // 1. Get the entry
        const snapshot = await db.ref(`transfer_entries/${key}`).once('value');
        const entry = snapshot.val();

        if (!entry) throw new Error("Entry not found");

        const historyData = [];

        // 2. Parse History (array or object)
        if (entry.history) {
            if (Array.isArray(entry.history)) {
                historyData.push(...entry.history);
            } else {
                Object.values(entry.history).forEach(h => historyData.push(h));
            }
        }

        if (historyData.length === 0) {
            if (loader) loader.classList.add('hidden');
            tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
            return;
        }

        // 3. Sort ASC (oldest -> newest) to calculate duration
        historyData.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

        // 4. Duration calculation (same style as Invoice history)
        historyData.forEach((h, index) => {
            if (index === 0) {
                h.durationDisplay = '-';
            } else {
                const prevTs = Number(historyData[index - 1].timestamp) || 0;
                const currTs = Number(h.timestamp) || 0;
                const diffMs = Math.max(0, currTs - prevTs);

                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                if (diffDays > 0) h.durationDisplay = `${diffDays}d ${diffHrs}h`;
                else if (diffHrs > 0) h.durationDisplay = `${diffHrs}h ${diffMins}m`;
                else h.durationDisplay = `${diffMins}m`;
            }
        });

        // 5. Reverse to DESC for display
        historyData.reverse();

        if (loader) loader.classList.add('hidden');

        historyData.forEach((h) => {
            const dateObj = new Date(Number(h.timestamp) || Date.now());
            const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            const who = h.by || h.updatedBy || 'System';

            const row = `
                <tr>
                    <td><strong>${h.action || h.status || ''}</strong><br><small>${h.note || ''}</small></td>
                    <td>${dateStr}</td>
                    <td>${who}</td>
                    <td style="font-weight: bold; color: #00748C;">${h.durationDisplay || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        if (loader) loader.classList.add('hidden');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
};

    // ==========================================================================
    // FIXED HELPER: Reverse Stock (Undo a transaction)
    // ==========================================================================
    async function reverseStockInventory(id, qty, jobType, fromSite, toSite) {
        if (!id || !qty) return;

        // Sanitize Site Names
        const safeFrom = fromSite ? fromSite.replace(/[.#$[\]]/g, "_") : null;
        const safeTo = toSite ? toSite.replace(/[.#$[\]]/g, "_") : null;

        console.log(`Reversing Stock -> Type: ${jobType}, Qty: ${qty}, ID: ${id}`);

        try {
            let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
            if (!snapshot.exists()) {
                snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
            }

            if (snapshot.exists()) {
                const data = snapshot.val();
                const key = Object.keys(data)[0];
                const item = data[key];
                let sites = item.sites || {};
                const amount = parseFloat(qty);

                // --- REVERSAL LOGIC ---

                // A. USAGE or RETURN (Original: Deducted Source -> Reversal: ADD Source)
                if (jobType === 'Usage' || jobType === 'Return') {
                    if (safeFrom) {
                        let current = parseFloat(sites[safeFrom] || 0);
                        sites[safeFrom] = current + amount; // Add back to source
                    }
                }

                // B. RESTOCK (Original: Added Dest -> Reversal: DEDUCT Dest)
                else if (jobType === 'Restock') {
                    if (safeTo) {
                        let current = parseFloat(sites[safeTo] || 0);
                        sites[safeTo] = current - amount;
                        if (sites[safeTo] < 0) sites[safeTo] = 0;
                    }
                }

                // C. TRANSFER (Original: Moved Source->Dest -> Reversal: Move Dest->Source)
                else {
                    // Default to Transfer logic if type is missing
                    if (safeFrom && safeTo) {
                        let curFrom = parseFloat(sites[safeFrom] || 0);
                        let curTo = parseFloat(sites[safeTo] || 0);

                        sites[safeFrom] = curFrom + amount; // Return to source
                        sites[safeTo] = curTo - amount; // Remove from dest
                        if (sites[safeTo] < 0) sites[safeTo] = 0;
                    }
                }

                // Recalculate Global Total
                let newGlobalStock = 0;
                Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

                await db.ref(`material_stock/${key}`).update({
                    sites: sites,
                    stockQty: newGlobalStock,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });
                console.log("Stock Reversal Successful.");
            }
        } catch (error) {
            console.error("Stock reversal error:", error);
        }
    }

    // ==========================================================================
    // HANDLE DELETE -> PROMPTS FOR QTY -> CREATES RETURN -> REMOVES ORIGINAL
    // ==========================================================================
    async function handleDeleteTransferEntry(key) {
        await ensureAllEntriesFetched();
        const task = allSystemEntries.find(t => t.key === key);

        if (!task) {
            alert("Error: Task not found.");
            return;
        }

        const isCompleted = ['Completed', 'Received', 'SRV Done'].includes(task.remarks);

        // 1. PENDING TASK? Just Delete.
        if (!isCompleted) {
            if (confirm("Delete this pending request?")) {
                await db.ref(`transfer_entries/${key}`).remove();
                alert("Request deleted.");

                // Remove from local caches and refresh UI without reloading
                allSystemEntries = allSystemEntries.filter(t => t.key !== key);
                if (Array.isArray(userActiveTasks)) {
                    userActiveTasks = userActiveTasks.filter(t => t.key !== key);
                }

                if (typeof populateActiveTasks === 'function') {
                    populateActiveTasks();
                }

                // Respect current tab/search filters in Job Records
                if (typeof filterAndRenderReport === 'function' && document.getElementById('reporting-table-body')) {
                    filterAndRenderReport(allSystemEntries);
                } else if (typeof renderReportingTable === 'function' && document.getElementById('reporting-table-body')) {
                    renderReportingTable(allSystemEntries);
                }

            }
            return;
        }

        // 2. DETERMINE MAX QUANTITY
        // We can only return what was actually received (or ordered if not tracked)
        const maxQty = parseFloat(task.receivedQty || task.orderedQty || 0);

        if (maxQty <= 0) {
            alert("Error: This task has no quantity recorded to return.");
            return;
        }

        // 3. PROMPT USER FOR QUANTITY
        const returnQtyStr = prompt(
            `Creating Return Request for: ${task.productName}\n\nMax Quantity Available: ${maxQty}\n\nPlease enter the Quantity to Return:`,
            maxQty
        );

        // If user clicks Cancel, stop everything
        if (returnQtyStr === null) return;

        const returnQty = parseFloat(returnQtyStr);

        // 4. VALIDATE QUANTITY
        if (isNaN(returnQty) || returnQty <= 0) {
            alert("Invalid Quantity. Please enter a number greater than 0.");
            return;
        }
        if (returnQty > maxQty) {
            alert(`Error: You cannot return ${returnQty} because the original transaction was only for ${maxQty}.`);
            return;
        }

        // 5. DETERMINE LOCATIONS (Robust Site Fix)
        const origSource = task.fromSite || task.fromLocation || task.site || 'Main Store';
        const origDest = task.toSite || task.toLocation || 'Unknown';

        let retFrom = '';
        let retTo = '';
        let detailsMsg = '';

        if (task.jobType === 'Restock') {
            detailsMsg = `Reversal of Restock (${task.controlNumber})`;
            retFrom = origDest; // Deduct from where it is now
            retTo = 'Outside Supplier';
        } else if (task.jobType === 'Usage') {
            detailsMsg = `Reversal of Usage (${task.controlNumber})`;
            retFrom = origSource; // Usage occurred at source, return adds back to source
            retTo = origSource;
        } else if (task.jobType === 'Transfer') {
            detailsMsg = `Reversal of Transfer (${task.controlNumber})`;
            retFrom = origDest; // Currently at Destination
            retTo = origSource; // Return to Source
        } else {
            alert("Cannot reverse this transaction type.");
            return;
        }

        try {
            const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
            const newRef = db.ref('transfer_entries').push();

            // 6. CREATE REVERSAL DATA
            const reversalData = {
                controlNumber: `RET-${task.controlNumber}`,
                jobType: 'Return',
                for: 'Return',
                productID: task.productID || task.productId,
                productName: task.productName,
                details: detailsMsg,

                // Swapped Locations
                fromSite: retFrom,
                toSite: retTo,
                fromLocation: retFrom,
                toLocation: retTo,

                // USER DEFINED QUANTITY
                requiredQty: returnQty,
                orderedQty: returnQty,

                requestor: currentUser,
                approver: task.approver,
                receiver: (task.jobType === 'Transfer') ? task.sourceContact : 'System',

                status: 'Pending Admin',
                remarks: 'Pending Admin',
                attention: task.approver,

                originalJobType: task.jobType,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                enteredBy: currentUser,
                history: [{
                    action: "Return Requested",
                    by: currentUser,
                    timestamp: Date.now(),
                    note: `Qty: ${returnQty}`
                }]
            };

            // 7. SAVE & DELETE OLD
            await newRef.set(reversalData);
            await db.ref(`transfer_entries/${key}`).remove();

            alert(`Return Request Created for ${returnQty} units! Sent to Approver.`);

            // Refresh
            allSystemEntries = allSystemEntries.filter(t => t.key !== key);
            if (typeof populateActiveTasks === 'function') populateActiveTasks();
            if (document.getElementById('reporting-table-body')) {
                if (typeof filterAndRenderReport === 'function') filterAndRenderReport(allSystemEntries);
                else renderReportingTable(allSystemEntries);
            }

        } catch (error) {
            console.error(error);
            alert("Failed to create return request.");
        }
    }

    // ==========================================================================
    // FIXED: Stock Inventory Update (Site-Specific)
    // ==========================================================================
    async function updateStockInventory(id, qty, action, siteName) {
        if (!id || !qty || !siteName) return;

        // Sanitize Site Name
        const safeSiteName = siteName.replace(/[.#$[\]]/g, "_");
        console.log(`Stock Update: ${action} ${qty} at ${safeSiteName} for ${id}`);

        try {
            let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
            if (!snapshot.exists()) {
                snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
            }

            if (snapshot.exists()) {
                const data = snapshot.val();
                const key = Object.keys(data)[0];
                const item = data[key];
                let sites = item.sites || {};
                let currentSiteStock = parseFloat(sites[safeSiteName] || 0);
                const amount = parseFloat(qty);

                if (action === 'Deduct') {
                    currentSiteStock -= amount;
                    if (currentSiteStock < 0) currentSiteStock = 0;
                } else if (action === 'Add') {
                    currentSiteStock += amount;
                }

                sites[safeSiteName] = currentSiteStock;

                let newGlobalStock = 0;
                Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

                await db.ref(`material_stock/${key}`).update({
                    sites: sites,
                    stockQty: newGlobalStock,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });
            }
        } catch (error) {
            console.error("Stock update failed:", error);
        }
    }

    // A. OPEN MODAL (Handles both Add and Edit modes)

// #endregion BLOCK 24 — INVOICE / TRANSFER HISTORY + STOCK REVERSAL
