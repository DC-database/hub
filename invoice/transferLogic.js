// ==========================================================================
// TRANSFER LOGIC: MASTER FILE (With Usage Support)
// Handles: Creation, Approval, Stock Updates, Printing
// ==========================================================================

let currentTransferType = '';
let transferProductChoices = null;
let editingTransferData = null;

// Dropdown Instances
let tfFromSiteChoices = null, tfToSiteChoices = null;
let tfApproverChoices = null, tfReceiverChoices = null, tfSourceContactChoices = null;

// ==========================================================================
// 1. OPEN NEW TRANSFER REQUEST (CREATION)
// ==========================================================================
async function openTransferModal(type) {
    currentTransferType = type;
    editingTransferData = null;
    document.getElementById('transfer-job-form').reset();
    document.getElementById('tf-job-type').value = type;
    
    if (typeof currentApprover !== 'undefined' && currentApprover) {
        document.getElementById('tf-requestor').value = currentApprover.Name;
    }

    const dateEl = document.getElementById('tf-shipping-date');
    if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    
    await initTransferDropdowns(); 
    await generateSequentialTransferId(type);

    const statusField = document.getElementById('tf-status');
    if(statusField) {
        statusField.value = "Pending Source";
        statusField.closest('.form-group').style.display = 'none'; 
    }

    highlightSenderFields(true);
    updateFieldLocks('Requestor'); 
    
    // --- VISUAL LOGIC FOR USAGE ---
    // Hide Destination & Receiver if we are just using/consuming items
    const destGroup = document.getElementById('tf-to').closest('.form-group');
    const recvGroup = document.getElementById('tf-receiver').closest('.form-group');
    
    if (type === 'Usage') {
        if(destGroup) destGroup.style.display = 'none';
        if(recvGroup) recvGroup.style.display = 'none';
    } else {
        if(destGroup) destGroup.style.display = 'block';
        if(recvGroup) recvGroup.style.display = 'block';
    }
    // ------------------------------

    document.getElementById('transfer-job-modal').classList.remove('hidden');
}

// ==========================================================================
// 2. OPEN ACTION MODAL (APPROVAL/RECEIPT)
// ==========================================================================
window.openTransferActionModal = async function(task) {
    console.log("Opening Action Modal for:", task.controlNumber);

    const modal = document.getElementById('transfer-approval-modal');
    if (!modal) { alert("Error: Modal HTML missing."); return; }

    const keyInput = document.getElementById('transfer-modal-key');
    const noteInput = document.getElementById('transfer-modal-note');
    const qtyInput = document.getElementById('transfer-modal-qty');
    const dateContainer = document.getElementById('transfer-modal-date-container');
    const dateInput = document.getElementById('transfer-modal-date');
    const title = document.getElementById('transfer-approval-modal-title'); 
    const approveBtn = document.getElementById('transfer-modal-approve-btn');
    const rejectBtn = document.getElementById('transfer-modal-reject-btn');
    const detailsDiv = document.getElementById('transfer-modal-details');

    if (!keyInput || !approveBtn || !title || !detailsDiv) {
        console.error("Missing modal elements"); return;
    }

    // Setup Data
    keyInput.value = task.key;
    if(noteInput) noteInput.value = task.note || '';
    
    // Build View
    detailsDiv.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem; color: #333;">
            <div style="grid-column: span 2; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px;">
                <strong>Item:</strong> ${task.vendorName || task.productName} <br>
                <small style="color:#666;">${task.details || ''}</small>
            </div>
            <div><strong>Control ID:</strong> <span style="color:#003A5C; font-weight:bold;">${task.ref || task.controlNumber}</span></div>
            <div><strong>Type:</strong> ${task.jobType || task.for}</div>
            
            <div style="grid-column: span 2; background-color: #f8f9fa; padding: 8px; border-radius: 4px; border: 1px dashed #ccc;">
                <strong>Route:</strong> ${task.fromSite || task.fromLocation || 'N/A'} <i class="fa-solid fa-arrow-right"></i> ${task.toSite || task.toLocation || 'N/A'}
            </div>
            
            <div><strong>Req. Qty:</strong> ${task.orderedQty || task.requiredQty}</div>
            <div><strong>Status:</strong> <span style="font-weight:bold; color:#00748C">${task.remarks}</span></div>
        </div>
    `;

    // Context Logic
    if(qtyInput) qtyInput.disabled = false;
    if(dateContainer) dateContainer.classList.add('hidden');
    if(rejectBtn) rejectBtn.classList.remove('hidden');
    approveBtn.innerHTML = "Approve";

    if (task.remarks === 'Pending Source') {
        title.textContent = "Step 1: Source Confirmation";
        approveBtn.textContent = "Confirm & Send";
        approveBtn.style.backgroundColor = "#17a2b8"; 
        if(qtyInput) qtyInput.value = task.orderedQty || task.requiredQty; 
    } 
    else if (task.remarks === 'Pending Admin') {
        title.textContent = "Step 2: Admin Authorization";
        approveBtn.textContent = "Authorize & Finalize";
        approveBtn.style.backgroundColor = "#28a745"; 
        if(qtyInput) qtyInput.value = task.approvedQty || task.orderedQty; 
    } 
    else if (task.remarks === 'In Transit') {
        title.textContent = "Step 3: Final Receipt";
        approveBtn.textContent = "Confirm Delivery";
        approveBtn.style.backgroundColor = "#003A5C"; 
        if(qtyInput) qtyInput.value = task.approvedQty; 
        if(dateContainer) dateContainer.classList.remove('hidden');
        if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        if(rejectBtn) rejectBtn.classList.add('hidden'); 
    }

    modal.classList.remove('hidden');
};

// ==========================================================================
// 3. STOCK INVENTORY UPDATE (Site-Specific)
// ==========================================================================
async function updateStockInventory(id, qty, action, siteName) {
    if (!id || !qty || !siteName) return;
    
    // Sanitize Site Name
    const safeSiteName = siteName.replace(/[.#$[\]]/g, "_");
    console.log(`Stock Update: ${action} ${qty} at ${safeSiteName} for ${id}`);

    try {
        let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
        if (!snapshot.exists()) snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');

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
    } catch (e) { console.error("Stock Update Failed:", e); }
}

// ==========================================================================
// 4. HANDLE ACTION CLICK (With Usage Logic)
// ==========================================================================
const handleTransferAction = async (status) => {
    const key = document.getElementById('transfer-modal-key').value;
    const qty = parseFloat(document.getElementById('transfer-modal-qty').value) || 0;
    const note = document.getElementById('transfer-modal-note').value;
    const arrivalDateVal = document.getElementById('transfer-modal-date') ? document.getElementById('transfer-modal-date').value : ''; 

    const btn = status === 'Approved' ? document.getElementById('transfer-modal-approve-btn') : document.getElementById('transfer-modal-reject-btn');
    if(btn) { btn.disabled = true; btn.textContent = "Processing..."; }

    const generateMixedESN = (length) => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    };

    try {
        const snapshot = await db.ref(`transfer_entries/${key}`).once('value');
        const task = snapshot.val();
        task.key = key; 

        const sourceSite = task.fromLocation || task.fromSite;
        const destSite = task.toLocation || task.toSite;
        const pID = task.productID || task.productId;
        const jobType = task.jobType || task.for || 'Transfer';
        
        let nextStatus = status;
        let nextAttention = ''; 
        const updates = { note: note, dateResponded: formatDate(new Date()) };

        if (status === 'Rejected') {
            nextStatus = 'Rejected';
            nextAttention = task.requestor; 
        } 
        else if (status === 'Approved') {
            const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
            const cleanName = currentUser.replace(/Engr\.?\s*/gi, '').trim().toUpperCase();

            // STEP 1: Source
            if (task.remarks === 'Pending Source') {
                nextStatus = 'Pending Admin';
                nextAttention = task.approver;
                updates.approvedQty = qty; 
                alert(`Source Confirmed! Sending to Admin: ${nextAttention}`);
            }
            // STEP 2: Admin
            else if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                if (!task.esn) updates.esn = `${generateMixedESN(12)}/${cleanName}`;
                updates.approvedQty = qty; 

                if (jobType === 'Restock') {
                    nextStatus = 'Completed'; nextAttention = 'Records'; updates.receivedQty = qty;
                    if (pID) await updateStockInventory(pID, qty, 'Add', destSite);
                } 
                // --- USAGE & RETURN LOGIC (Instant Deduct) ---
                else if (jobType === 'Return' || jobType === 'Usage') {
                    nextStatus = 'Completed'; nextAttention = 'Records'; updates.receivedQty = qty;
                    if (pID) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                } 
                // ---------------------------------------------
                else {
                    // Transfer
                    nextStatus = 'In Transit'; nextAttention = task.receiver; 
                    if (pID && sourceSite) {
                        await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                        alert(`Authorized! Stock deducted from ${sourceSite}. Sending to Receiver.`);
                    }
                }
            } 
            // STEP 3: Receiver
            else if (task.remarks === 'In Transit' || task.remarks === 'Approved') {
                nextStatus = 'Completed'; nextAttention = 'Records'; updates.receivedQty = qty; 
                if(arrivalDateVal) updates.arrivalDate = arrivalDateVal;
                updates.receiverEsn = `${generateMixedESN(8)}/${cleanName}`;

                if (pID && destSite) {
                    await updateStockInventory(pID, qty, 'Add', destSite);
                    alert(`Transfer Completed! Stock added to ${destSite}.`);
                }
            }
        }

        updates.remarks = nextStatus; 
        updates.status = nextStatus; 
        updates.attention = nextAttention;
        
        const historyEntry = {
            action: nextStatus,
            by: (currentApprover ? currentApprover.Name : 'Unknown'),
            timestamp: Date.now(),
            note: note || ''
        };
        
        await db.ref(`transfer_entries/${key}`).update(updates);
        await db.ref(`transfer_entries/${key}/history`).push(historyEntry);

        document.getElementById('transfer-approval-modal').classList.add('hidden');
        
        if(typeof ensureAllEntriesFetched === 'function') {
            if(typeof cacheTimestamps !== 'undefined') cacheTimestamps.systemEntries = 0;
            await ensureAllEntriesFetched(true);
            await populateActiveTasks();
        }
        
    } catch (error) { 
        console.error("Error:", error); 
        alert("Failed to update. Check console."); 
    } finally { 
        if(btn) { btn.disabled = false; btn.textContent = status === 'Approved' ? "Approve" : "Reject"; }
    }
};

// ==========================================================================
// 5. SAVE NEW ENTRY (Fixed: Usage goes direct to Admin)
// ==========================================================================
async function saveTransferEntry(e) {
    if(e) e.preventDefault(); 
    const btn = document.getElementById('tf-save-btn');
    btn.disabled = true; btn.textContent = "Saving...";

    // 1. Safe Value Retrieval
    const fromLoc = (tfFromSiteChoices ? tfFromSiteChoices.getValue(true) : document.getElementById('tf-from').value) || '';
    const toLoc = (tfToSiteChoices ? tfToSiteChoices.getValue(true) : document.getElementById('tf-to').value) || '';
    const productID = (transferProductChoices ? transferProductChoices.getValue(true) : document.getElementById('tf-product-select').value) || '';
    const sourceContact = (tfSourceContactChoices ? tfSourceContactChoices.getValue(true) : document.getElementById('tf-source-contact').value) || '';
    const approver = (tfApproverChoices ? tfApproverChoices.getValue(true) : document.getElementById('tf-approver').value) || '';
    const receiver = (tfReceiverChoices ? tfReceiverChoices.getValue(true) : document.getElementById('tf-receiver').value) || '';
    
    const qty = parseFloat(document.getElementById('tf-req-qty').value) || 0;
    const type = document.getElementById('tf-job-type').value;

    // 2. Validation Logic
    if (type === 'Usage') {
        // Usage: Needs Product, Source, and Admin only
        if (!productID || !fromLoc || !approver) {
            alert("Please fill in: Product, Source Site, and Approver.");
            btn.disabled = false; btn.textContent = "Save Transaction";
            return;
        }
    } else {
        // Standard: Needs Everything
        if (!productID || !fromLoc || !toLoc || !sourceContact || !approver || !receiver) {
            alert("Please fill in all fields.");
            btn.disabled = false; btn.textContent = "Save Transaction";
            return;
        }
    }

    const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
    
    // 3. DETERMINE STARTING STATE
    let startStatus = 'Pending Source';
    let startAttention = sourceContact;

    // --- FIX: Usage goes DIRECTLY to Admin ---
    if (type === 'Usage') {
        startStatus = 'Pending Admin';
        startAttention = approver; // Skip the source contact
    }
    // -----------------------------------------

    const initialHistory = [{
        action: "Created",
        by: currentUser,
        timestamp: Date.now(),
        status: startStatus
    }];

    const entryData = {
        controlNumber: document.getElementById('tf-control-no').value,
        jobType: type,
        productID: productID,
        productName: document.getElementById('tf-product-name').value || '',
        details: document.getElementById('tf-details').value || '',
        requestor: document.getElementById('tf-requestor').value || '',
        
        sourceContact: sourceContact,
        approver: approver,
        receiver: receiver, 
        
        requiredQty: qty,
        orderedQty: qty, 
        
        fromLocation: fromLoc,
        toLocation: toLoc, 
        
        shippingDate: document.getElementById('tf-shipping-date').value || '',
        
        // Use the dynamic status variables
        status: startStatus,
        remarks: startStatus, 
        attention: startAttention, 
        
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        enteredBy: currentUser,
        history: initialHistory
    };

    try {
        if (editingTransferData && editingTransferData.key) {
            await db.ref(`transfer_entries/${editingTransferData.key}`).update(entryData);
            alert("Transaction Updated!");
        } else {
            const newRef = await db.ref('transfer_entries').push(entryData);
            entryData.key = newRef.key; 
            
            if (confirm("Transaction Saved Successfully!\n\nDo you want to print the Waybill now?")) {
                if (window.handlePrintWaybill) {
                    window.handlePrintWaybill(entryData);
                }
            }
        }
        
        document.getElementById('transfer-job-modal').classList.add('hidden');
        
        if(typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(true);
        if(typeof populateActiveTasks === 'function') populateActiveTasks();
        
    } catch (e) { 
        console.error("Firebase Save Error:", e); 
        alert("Error saving transaction. Check console for details."); 
    } finally { 
        btn.disabled = false; 
        btn.textContent = "Save Transaction"; 
    }
}

// ==========================================================================
// 6. HELPER FUNCTIONS
// ==========================================================================

window.closeTransferModal = function() {
    document.getElementById('transfer-job-modal').classList.add('hidden');
};

async function generateSequentialTransferId(type) {
    // Usage gets its own prefix or shares 'TRF'
    const prefix = (type === 'Transfer' ? 'TRF' : (type === 'Restock' ? 'STK' : (type === 'Usage' ? 'USE' : 'RET')));
    const input = document.getElementById('tf-control-no');
    input.value = "Generating...";
    try {
        const snap = await db.ref('transfer_entries').once('value');
        const data = snap.val();
        let max = 0;
        if (data) Object.values(data).forEach(i => { if(i.controlNumber && i.controlNumber.startsWith(prefix)) { const n = parseInt(i.controlNumber.split('-')[1]); if(n > max) max = n; } });
        input.value = `${prefix}-${String(max + 1).padStart(4, '0')}`;
    } catch (e) { input.value = `${prefix}-0001`; }
}

async function initTransferDropdowns() {
    const selectElement = document.getElementById('tf-product-select');
    if (transferProductChoices) { transferProductChoices.removeActiveItems(); } 
    else {
        transferProductChoices = new Choices(selectElement, { searchEnabled: true, itemSelectText: '', placeholder: true, placeholderValue: 'Type ID or Name...', shouldSort: false });
        const snap = await db.ref('material_stock').once('value');
        const data = snap.val();
        if (data) {
            const choices = Object.values(data).map(item => ({ value: item.productID, label: `${item.productID} - ${item.productName}`, customProperties: { name: item.productName, details: item.details, sites: item.sites } }));
            transferProductChoices.setChoices(choices, 'value', 'label', true);
        }
        selectElement.addEventListener('change', () => {
            const val = transferProductChoices.getValue(true);
            const item = transferProductChoices._store.choices.find(c => c.value === val);
            if (item && item.customProperties) {
                document.getElementById('tf-product-name').value = item.customProperties.name;
                document.getElementById('tf-details').value = item.customProperties.details;
                updateFromSiteOptions(item.customProperties.sites);
            }
        });
    }
    if (!tfFromSiteChoices) tfFromSiteChoices = new Choices(document.getElementById('tf-from'), { searchEnabled: true, itemSelectText: '' });
    if (!tfToSiteChoices) tfToSiteChoices = new Choices(document.getElementById('tf-to'), { searchEnabled: true, itemSelectText: '' });
    if (typeof allSitesCache !== 'undefined') {
        tfToSiteChoices.setChoices(allSitesCache, 'value', 'label', true);
        tfFromSiteChoices.setChoices(allSitesCache, 'value', 'label', true);
    }
    const opts = { searchEnabled: true, itemSelectText: '' };
    if (!tfApproverChoices) tfApproverChoices = new Choices(document.getElementById('tf-approver'), opts);
    if (!tfReceiverChoices) tfReceiverChoices = new Choices(document.getElementById('tf-receiver'), opts);
    if (!tfSourceContactChoices) tfSourceContactChoices = new Choices(document.getElementById('tf-source-contact'), opts);
    if (typeof allApproversCache !== 'undefined') {
        tfApproverChoices.setChoices(allApproversCache, 'value', 'label', true);
        tfReceiverChoices.setChoices(allApproversCache, 'value', 'label', true);
        tfSourceContactChoices.setChoices(allApproversCache, 'value', 'label', true);
    }
}

function updateFromSiteOptions(sitesData) {
    if (!tfFromSiteChoices) return;
    tfFromSiteChoices.clearStore(); tfFromSiteChoices.clearInput();
    const currentJobType = document.getElementById('tf-job-type').value;
    if (currentJobType === 'Restock') {
        if (typeof allSitesCache !== 'undefined') tfFromSiteChoices.setChoices(allSitesCache, 'value', 'label', true);
        return;
    }
    const newChoices = [];
    if (sitesData) {
        Object.entries(sitesData).forEach(([site, qty]) => {
            if (parseFloat(qty) > 0) newChoices.push({ value: site, label: `${site} (Avail: ${qty})` });
        });
    }
    if (newChoices.length > 0) tfFromSiteChoices.setChoices(newChoices, 'value', 'label', true);
    else tfFromSiteChoices.setChoices([{ value: '', label: 'No stock available', disabled: true, selected: true }]);
}

function highlightSenderFields(isActive) {
    const ids = ['tf-from', 'tf-to', 'tf-req-qty', 'tf-shipping-date', 'tf-approver', 'tf-receiver', 'tf-source-contact'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) isActive ? el.classList.add('sender-required') : el.classList.remove('sender-required');
    });
}

function updateFieldLocks(mode) {
    const ids = ['tf-req-qty', 'tf-shipping-date', 'tf-remarks'];
    ids.forEach(id => document.getElementById(id).disabled = (mode !== 'Requestor'));
    if(mode === 'Requestor') {
        if(transferProductChoices) transferProductChoices.enable();
        if(tfFromSiteChoices) tfFromSiteChoices.enable();
        if(tfToSiteChoices) tfToSiteChoices.enable();
        if(tfApproverChoices) tfApproverChoices.enable();
        if(tfReceiverChoices) tfReceiverChoices.enable();
        if(tfSourceContactChoices) tfSourceContactChoices.enable();
    } else {
        if(transferProductChoices) transferProductChoices.disable();
        if(tfFromSiteChoices) tfFromSiteChoices.disable();
        if(tfToSiteChoices) tfToSiteChoices.disable();
        if(tfApproverChoices) tfApproverChoices.disable();
        if(tfReceiverChoices) tfReceiverChoices.disable();
        if(tfSourceContactChoices) tfSourceContactChoices.disable();
    }
}

// --- PRINT FUNCTION (Waybill) ---
window.handlePrintWaybill = function(entry) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
    const getFullSiteName = (code) => {
        if (!code) return '-';
        if (typeof allSitesCSVData !== 'undefined' && allSitesCSVData) {
            const found = allSitesCSVData.find(s => s.site == code);
            if (found) return `${found.site} - ${found.description}`;
        }
        return code; 
    };

    setText('wb-date', formatYYYYMMDD(entry.shippingDate));
    setText('wb-control-id', entry.controlId || entry.ref);
    setText('wb-from-site', getFullSiteName(entry.fromSite || entry.fromLocation));
    setText('wb-to-site', getFullSiteName(entry.toSite || entry.toLocation));
    setText('wb-requestor', entry.requestor);
    setText('wb-receiver', entry.receiver);
    
    setText('wb-prod-id', entry.productId || entry.productID);
    setText('wb-prod-name', entry.productName);
    setText('wb-details', entry.details);
    
    let displayQty = entry.orderedQty;
    if (entry.remarks === 'Completed') displayQty = entry.receivedQty;
    else if (entry.remarks === 'In Transit') displayQty = entry.approvedQty;
    setText('wb-qty', displayQty || 0);
    setText('wb-print-date', new Date().toLocaleString());

    const titleEl = document.getElementById('wb-doc-title');
    const badgeEl = document.getElementById('wb-status-badge');
    const approverImg = document.getElementById('wb-barcode-approver');
    const receiverImg = document.getElementById('wb-barcode-receiver');
    const receiverContainer = document.getElementById('wb-receiver-esn-container');
    const receiverText = document.getElementById('wb-receiver-pending-text');
    const arrivalDateEl = document.getElementById('wb-arrival-date');
    const esnText = document.getElementById('wb-esn-text');
    const receiverEsnText = document.getElementById('wb-receiver-esn-text');

    if(approverImg) { approverImg.style.display = 'none'; approverImg.src = ''; }
    if(receiverImg) { receiverImg.style.display = 'none'; receiverImg.src = ''; }
    if(receiverContainer) receiverContainer.style.display = 'none';
    if(receiverText) receiverText.style.display = 'block';
    if(esnText) esnText.textContent = "PENDING APPROVAL";
    if(arrivalDateEl) arrivalDateEl.textContent = "PENDING ARRIVAL";

    const generateBarcodeSrc = (text) => {
        try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, text, { format: "CODE128", displayValue: false, height: 50, margin: 0, width: 2 });
            return canvas.toDataURL("image/png");
        } catch(e) { return ""; }
    };

    if (entry.remarks.includes('Pending')) {
        if(titleEl) titleEl.textContent = "TRANSFER REQUEST (DRAFT)";
        if(badgeEl) { badgeEl.textContent = "WAITING APPROVAL"; badgeEl.style.borderColor = "#dc3545"; badgeEl.style.color = "#dc3545"; }
    }
    else if (entry.remarks === 'In Transit' || entry.remarks === 'Approved') {
        if(titleEl) titleEl.textContent = "WAYBILL / GATE PASS";
        if(badgeEl) { badgeEl.textContent = "AUTHORIZED FOR TRANSIT"; badgeEl.style.borderColor = "#00748C"; badgeEl.style.color = "#00748C"; }
        if (entry.esn) {
            const esnCode = entry.esn.split('/')[0];
            if(esnText) esnText.textContent = entry.esn;
            if(approverImg) { approverImg.src = generateBarcodeSrc(esnCode); approverImg.style.display = 'block'; }
        }
        // Hide receiver pending text for Usage/Return if applicable, but keep standard for Transfer
        // For USAGE, maybe change title?
        if (entry.jobType === 'Usage') {
             titleEl.textContent = "USAGE RECORD";
             if(badgeEl) badgeEl.textContent = "CONSUMED";
             if(receiverText) receiverText.style.display = 'none';
        }
    }
    else if (entry.remarks === 'Completed' || entry.remarks === 'Received') {
        if(titleEl) titleEl.textContent = "FINAL DELIVERY NOTE";
        if (entry.jobType === 'Usage') titleEl.textContent = "USAGE RECORD (COMPLETED)";
        
        if(badgeEl) { badgeEl.textContent = "DELIVERED & RECEIVED"; badgeEl.style.borderColor = "#28a745"; badgeEl.style.color = "#28a745"; }
        if(arrivalDateEl) arrivalDateEl.textContent = formatYYYYMMDD(entry.arrivalDate) || "ARRIVED";
        
        if (entry.esn) {
            const esnCode = entry.esn.split('/')[0];
            if(esnText) esnText.textContent = entry.esn;
            if(approverImg) { approverImg.src = generateBarcodeSrc(esnCode); approverImg.style.display = 'block'; }
        }
        if (entry.receiverEsn) {
            const recCode = entry.receiverEsn.split('/')[0];
            if(receiverText) receiverText.style.display = 'none';
            if(receiverContainer) receiverContainer.style.display = 'block';
            if(receiverEsnText) receiverEsnText.textContent = entry.receiverEsn;
            if(receiverImg) { receiverImg.src = generateBarcodeSrc(recCode); receiverImg.style.display = 'block'; }
        }
    } 
    else {
        if(titleEl) titleEl.textContent = "TRANSFER RECORD";
        if(badgeEl) { badgeEl.textContent = entry.remarks.toUpperCase(); badgeEl.style.borderColor = "#333"; badgeEl.style.color = "#333"; }
    }

    document.body.classList.add('printing-waybill');
    window.print();
    setTimeout(() => { document.body.classList.remove('printing-waybill'); }, 1000);
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    const sBtn = document.getElementById('tf-save-btn');
    if(sBtn) sBtn.addEventListener('click', saveTransferEntry);
    
    const appBtn = document.getElementById('transfer-modal-approve-btn');
    if(appBtn) appBtn.addEventListener('click', () => handleTransferAction('Approved'));
    
    const rejBtn = document.getElementById('transfer-modal-reject-btn');
    if(rejBtn) rejBtn.addEventListener('click', () => handleTransferAction('Rejected'));
});

// ==========================================================================
// 7. EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Save Button
    const sBtn = document.getElementById('tf-save-btn');
    if(sBtn) sBtn.addEventListener('click', saveTransferEntry);
    
    // Print Button (Generic)
    const printBtn = document.getElementById('tf-print-btn');
    if(printBtn) printBtn.addEventListener('click', () => {
        alert("Please print from the Job Records table.");
    });
    
    // Modal Action Buttons
    const appBtn = document.getElementById('transfer-modal-approve-btn');
    if(appBtn) appBtn.addEventListener('click', () => handleTransferAction('Approved'));
    
    const rejBtn = document.getElementById('transfer-modal-reject-btn');
    if(rejBtn) rejBtn.addEventListener('click', () => handleTransferAction('Rejected'));
});

// ==========================================================================
// 8. SMART PRINT LOGIC (Strict Reset & Barcode Generation)
// ==========================================================================
window.handlePrintWaybill = function(entry) {
    // --- HELPER: Lookup Site Name ---
    const getFullSiteName = (code) => {
        if (!code) return '-';
        if (typeof allSitesCSVData !== 'undefined' && allSitesCSVData) {
            const found = allSitesCSVData.find(s => s.site == code);
            if (found) return `${found.site} - ${found.description}`;
        }
        return code;
    };

    // 1. Map Text Fields
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '-';
    };

    setText('wb-date', formatYYYYMMDD(entry.shippingDate));
    setText('wb-control-id', entry.controlId || entry.ref);
    setText('wb-from-site', getFullSiteName(entry.fromSite || entry.fromLocation));
    setText('wb-to-site', getFullSiteName(entry.toSite || entry.toLocation));
    setText('wb-requestor', entry.requestor);
    setText('wb-receiver', entry.receiver);
    
    setText('wb-prod-id', entry.productId || entry.productID);
    setText('wb-prod-name', entry.productName);
    setText('wb-details', entry.details);
    
    // Logic: Show Qty based on status
    let displayQty = entry.orderedQty;
    if (entry.remarks === 'Completed') displayQty = entry.receivedQty;
    else if (entry.remarks === 'In Transit') displayQty = entry.approvedQty;
    
    setText('wb-qty', displayQty || 0);
    setText('wb-print-date', new Date().toLocaleString());

    // 2. UI Elements
    const titleEl = document.getElementById('wb-doc-title');
    const badgeEl = document.getElementById('wb-status-badge');
    
    // Barcode Elements
    const approverImg = document.getElementById('wb-barcode-approver');
    const esnText = document.getElementById('wb-esn-text');
    
    const receiverImg = document.getElementById('wb-barcode-receiver');
    const receiverContainer = document.getElementById('wb-receiver-esn-container');
    const receiverEsnText = document.getElementById('wb-receiver-esn-text');
    const receiverPendingText = document.getElementById('wb-receiver-pending-text');
    const arrivalDateEl = document.getElementById('wb-arrival-date');

    // --- CRITICAL FIX: HARD RESET EVERY TIME ---
    // Clear previous images/text to prevent "ghosting"
    if (approverImg) { approverImg.style.display = 'none'; approverImg.src = ''; }
    if (receiverImg) { receiverImg.style.display = 'none'; receiverImg.src = ''; }
    if (receiverContainer) receiverContainer.style.display = 'none';
    if (receiverPendingText) receiverPendingText.style.display = 'block'; // Default to showing "Pending"
    
    if (esnText) esnText.textContent = "PENDING APPROVAL";
    if (arrivalDateEl) arrivalDateEl.textContent = "PENDING ARRIVAL";

    // --- BARCODE GENERATOR HELPER ---
    const generateBarcodeSrc = (text) => {
        try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, text, {
                format: "CODE128",
                displayValue: false, // We display text manually below
                height: 50,
                margin: 0,
                width: 2,
                background: "#ffffff"
            });
            return canvas.toDataURL("image/png");
        } catch(e) { console.error(e); return ""; }
    };

    // --- STATE LOGIC ---

    // STATE 1: DRAFT (Pending)
    if (entry.remarks.includes('Pending')) {
        titleEl.textContent = "TRANSFER REQUEST (DRAFT)";
        badgeEl.textContent = "WAITING APPROVAL";
        badgeEl.style.borderColor = "#dc3545";
        badgeEl.style.color = "#dc3545";
    }
    
    // STATE 2: IN TRANSIT (Approver Done, Receiver Pending)
    else if (entry.remarks === 'In Transit' || entry.remarks === 'Approved') {
        titleEl.textContent = "WAYBILL / GATE PASS";
        badgeEl.textContent = "AUTHORIZED FOR TRANSIT";
        badgeEl.style.borderColor = "#00748C";
        badgeEl.style.color = "#00748C";
        
        // Show Approver Barcode
        if (entry.esn) {
            const esnCode = entry.esn.split('/')[0]; // Get code part
            esnText.textContent = entry.esn;
            approverImg.src = generateBarcodeSrc(esnCode);
            approverImg.style.display = 'block';
        }
        
        // Ensure Receiver section is explicitly PENDING
        receiverContainer.style.display = 'none';
        receiverPendingText.style.display = 'block';
    }
    
    // STATE 3: COMPLETED (Approver Done, Receiver Done)
    else if (entry.remarks === 'Completed' || entry.remarks === 'Received') {
        titleEl.textContent = "FINAL DELIVERY NOTE";
        badgeEl.textContent = "DELIVERED & RECEIVED";
        badgeEl.style.borderColor = "#28a745";
        badgeEl.style.color = "#28a745";
        
        if(arrivalDateEl) arrivalDateEl.textContent = formatYYYYMMDD(entry.arrivalDate) || "ARRIVED";

        // Show Approver Barcode
        if (entry.esn) {
            const esnCode = entry.esn.split('/')[0];
            esnText.textContent = entry.esn;
            approverImg.src = generateBarcodeSrc(esnCode);
            approverImg.style.display = 'block';
        }

        // Show Receiver Barcode
        if (entry.receiverEsn) {
            const recCode = entry.receiverEsn.split('/')[0];
            
            // Hide "Pending" text, Show Barcode Container
            receiverPendingText.style.display = 'none';
            receiverContainer.style.display = 'block';
            
            receiverEsnText.textContent = entry.receiverEsn;
            receiverImg.src = generateBarcodeSrc(recCode);
            receiverImg.style.display = 'block';
        }
    } 
    
    // Fallback
    else {
        titleEl.textContent = "TRANSFER RECORD";
        badgeEl.textContent = entry.remarks.toUpperCase();
        badgeEl.style.borderColor = "#333";
        badgeEl.style.color = "#333";
    }

    // 3. Trigger Print
    document.body.classList.add('printing-waybill');
    
    // Small delay to allow images to render
    setTimeout(() => {
        window.print();
        setTimeout(() => { document.body.classList.remove('printing-waybill'); }, 1000);
    }, 300);
};

// ==========================================================================
// 9. MISSING MODAL FUNCTIONS
// ==========================================================================
window.closeTransferModal = function() {
    document.getElementById('transfer-job-modal').classList.add('hidden');
    // Optional: Reset form fields here if you want
    if(typeof resetTransferForm === 'function') resetTransferForm();
};