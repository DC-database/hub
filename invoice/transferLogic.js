// ==========================================================================
// TRANSFER LOGIC: WORKFLOW ENGINE (Corrected)
// ==========================================================================

let currentTransferType = '';
let transferProductChoices = null;
let editingTransferData = null;
let tfFromSiteChoices, tfToSiteChoices, tfApproverChoices, tfReceiverChoices, tfSourceContactChoices;

// ==========================================================================
// 1. OPEN NEW TRANSFER (Creation)
// ==========================================================================
async function openTransferModal(type) {
    currentTransferType = type;
    editingTransferData = null;
    document.getElementById('transfer-job-form').reset();
    document.getElementById('tf-job-type').value = type;
    
    // Auto-fill Requestor
    if (typeof currentApprover !== 'undefined' && currentApprover) {
        document.getElementById('tf-requestor').value = currentApprover.Name;
    }

    const dateEl = document.getElementById('tf-shipping-date');
    if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    
    await initTransferDropdowns(); 
    await generateSequentialTransferId(type);

    // --- VISIBILITY TOGGLES ---
    const sourceGroup = document.getElementById('tf-from').closest('.form-group');
    const contactGroup = document.getElementById('tf-source-contact').closest('.form-group');
    const destGroup = document.getElementById('tf-to').closest('.form-group');
    const approverGroup = document.getElementById('tf-approver').closest('.form-group');
    const recvGroup = document.getElementById('tf-receiver').closest('.form-group');
    const arrivalGroup = document.getElementById('tf-arrival-date').closest('.form-group');
    
    // HIDE STATUS & REMARKS (System Controlled)
    const statusGroup = document.getElementById('tf-status').closest('.form-group');
    const remarksGroup = document.getElementById('tf-remarks').closest('.form-group');
    statusGroup.style.display = 'none';
    remarksGroup.style.display = 'none';

    // 1. Reset: Show fields by default
    sourceGroup.style.display = 'block';
    contactGroup.style.display = 'block';
    destGroup.style.display = 'block';
    approverGroup.style.display = 'block';
    recvGroup.style.display = 'block';
    arrivalGroup.style.display = 'none'; // Always hide arrival on create

    // 2. Specific Logic
    if (type === 'Transfer') {
        // Show All
    }
    else if (type === 'Restock') {
        sourceGroup.style.display = 'none'; // No Source
        contactGroup.style.display = 'none';
    }
    else if (type === 'Usage') {
        destGroup.style.display = 'none'; // No Dest
        recvGroup.style.display = 'none'; 
    }
    else if (type === 'Return') {
        // Show All
    }

    document.getElementById('transfer-job-modal').classList.remove('hidden');
}

// 2. OPEN APPROVAL MODAL
window.openTransferActionModal = async function(task) {
    const modal = document.getElementById('transfer-approval-modal');
    const keyInput = document.getElementById('transfer-modal-key');
    const noteInput = document.getElementById('transfer-modal-note');
    const qtyInput = document.getElementById('transfer-modal-qty');
    const dateContainer = document.getElementById('transfer-modal-date-container');
    const dateInput = document.getElementById('transfer-modal-date');
    const title = document.getElementById('transfer-approval-modal-title'); 
    const approveBtn = document.getElementById('transfer-modal-approve-btn');
    const rejectBtn = document.getElementById('transfer-modal-reject-btn');
    const detailsDiv = document.getElementById('transfer-modal-details');

    keyInput.value = task.key;
    if(noteInput) noteInput.value = task.note || '';
    
    qtyInput.disabled = false;
    dateContainer.classList.add('hidden');
    rejectBtn.classList.remove('hidden');
    approveBtn.innerHTML = "Approve";

    // Header Logic
    if (task.remarks === 'Pending Source') {
        title.textContent = "Step 1: Source Confirmation";
        approveBtn.textContent = "Confirm & Send";
        approveBtn.style.backgroundColor = "#17a2b8"; 
        qtyInput.value = task.orderedQty; 
    } else if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
        title.textContent = "Step 2: Admin Authorization";
        approveBtn.textContent = "Authorize";
        approveBtn.style.backgroundColor = "#28a745"; 
        qtyInput.value = task.approvedQty || task.orderedQty; 
    } else if (task.remarks === 'In Transit') {
        title.textContent = "Step 3: Confirm Receipt";
        approveBtn.textContent = "Confirm Received";
        approveBtn.style.backgroundColor = "#003A5C"; 
        qtyInput.value = task.approvedQty; 
        dateContainer.classList.remove('hidden');
        if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        rejectBtn.classList.add('hidden');
    } else if (task.remarks === 'Pending Confirmation') {
        title.textContent = "Final Step: Confirm Usage";
        approveBtn.textContent = "Confirm Usage";
        approveBtn.style.backgroundColor = "#6f42c1"; 
        qtyInput.value = task.approvedQty;
    }

    detailsDiv.innerHTML = `
        <div style="font-size:0.9rem; color:#333;">
            <p><strong>Ref:</strong> ${task.ref || task.controlNumber}</p>
            <p><strong>Item:</strong> ${task.vendorName || task.productName}</p>
            <p><strong>Status:</strong> <span style="color:#00748C; font-weight:bold;">${task.remarks}</span></p>
        </div>`;

    modal.classList.remove('hidden');
};

// ==========================================================================
// 3. HANDLE ACTION CLICK (Workflow Engine)
// ==========================================================================
window.handleTransferAction = async (status) => {
    const key = document.getElementById('transfer-modal-key').value;
    const qty = parseFloat(document.getElementById('transfer-modal-qty').value) || 0;
    const note = document.getElementById('transfer-modal-note').value;
    const arrivalDateVal = document.getElementById('transfer-modal-date') ? document.getElementById('transfer-modal-date').value : ''; 
    
    const btn = status === 'Approved' ? document.getElementById('transfer-modal-approve-btn') : document.getElementById('transfer-modal-reject-btn');
    if(btn) { btn.disabled = true; btn.textContent = "Processing..."; }

    const database = (typeof db !== 'undefined') ? db : firebase.database();

    // --- NEW: STRICT ESN GENERATOR ---
    const generateStructuredESN = (letters, digits) => {
        const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numSet = "0123456789";
        let result = "";
        
        // 1. Get required Letters
        for (let i = 0; i < letters; i++) {
            result += charSet.charAt(Math.floor(Math.random() * charSet.length));
        }
        // 2. Get required Digits
        for (let i = 0; i < digits; i++) {
            result += numSet.charAt(Math.floor(Math.random() * numSet.length));
        }
        
        // 3. Shuffle the result to mix them up
        return result.split('').sort(() => 0.5 - Math.random()).join('');
    };

    try {
        const snapshot = await database.ref(`transfer_entries/${key}`).once('value');
        const task = snapshot.val();
        task.key = key; 

        const destSite = task.toLocation || task.toSite; 
        const sourceSite = task.fromLocation || task.fromSite; 
        const pID = task.productID || task.productId;
        const jobType = (task.jobType || task.for || '').trim(); 

        let nextStatus = status;
        let nextAttention = ''; 
        const updates = { 
            note: note, 
            dateResponded: formatDate(new Date())
        };

        // --- REJECTION ---
        if (status === 'Rejected') {
            updates.status = 'Rejected';
            updates.remarks = 'Rejected';
            updates.attention = task.requestor;
            await commitUpdate(database, key, updates, note);
            return; 
        } 
        
        // --- APPROVAL ---
        if (status === 'Approved') {
            const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
            // Clean name for ESN tag (e.g., IRWIN)
            const cleanName = currentUser.replace(/Engr\.?\s*/gi, '').trim().toUpperCase().split(' ')[0];

            // 1. RESTOCK
            if (jobType === 'Restock') {
                if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                    if (!task.receiver) { alert("Error: No Receiver."); btn.disabled = false; return; }
                    updates.approvedQty = qty;
                    updates.status = 'In Transit';
                    updates.remarks = 'In Transit';
                    updates.attention = task.receiver;
                    
                    // GENERATE APPROVER ESN: 6 Letters + 6 Digits
                    updates.esn = `${generateStructuredESN(6, 6)}/${cleanName}`;
                    
                    alert(`Restock Authorized! Sent to Receiver.`);
                    await commitUpdate(database, key, updates, note);
                    return; 
                }
                if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                    updates.receivedQty = qty; updates.arrivalDate = arrivalDateVal;
                    
                    // GENERATE RECEIVER ESN: 4 Letters + 4 Digits
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`;

                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);
                    alert(`Restock Confirmed! Stock Added.`);
                    await commitUpdate(database, key, updates, note);
                    return; 
                }
            }

            // 2. USAGE
            if (jobType === 'Usage') {
                if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                    updates.approvedQty = qty;
                    updates.status = 'Pending Confirmation'; updates.remarks = 'Pending Confirmation'; updates.attention = task.requestor;
                    updates.esn = `${generateStructuredESN(6, 6)}/${cleanName}`; // Approver ESN
                    
                    if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                    alert("Usage Authorized. Stock Deducted.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
                if (task.remarks === 'Pending Confirmation') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                    updates.receivedQty = qty;
                    alert("Usage Closed.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
            }

            // 3. TRANSFER
            if (jobType === 'Transfer') {
                if (task.remarks === 'Pending Source') {
                    updates.approvedQty = qty;
                    updates.status = 'Pending Admin'; updates.remarks = 'Pending Admin'; updates.attention = task.approver;
                    alert("Source Confirmed.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
                if (task.remarks === 'Pending Admin') {
                    updates.approvedQty = qty;
                    updates.status = 'In Transit'; updates.remarks = 'In Transit'; updates.attention = task.receiver;
                    
                    // GENERATE APPROVER ESN: 6 Letters + 6 Digits
                    updates.esn = `${generateStructuredESN(6, 6)}/${cleanName}`;

                    if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                    alert("Transfer Authorized. Stock Deducted.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
                
                // RECEIVER CONFIRM
                if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                    updates.receivedQty = qty; updates.arrivalDate = arrivalDateVal;
                    
                    // GENERATE RECEIVER ESN: 4 Letters + 4 Digits
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`;

                    // Add to Dest
                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);
                    
                    // Reconciliation (Partial Receive Logic)
                    const approved = parseFloat(task.approvedQty) || 0;
                    const diff = approved - qty;
                    if (diff > 0 && pID && sourceSite) {
                        await updateStockInventory(pID, diff, 'Add', sourceSite);
                        alert(`Partial Receive: ${qty} accepted. ${diff} returned to sender.`);
                    } else {
                        alert("Transfer Received. Stock Added.");
                    }
                    
                    await commitUpdate(database, key, updates, note);
                    return;
                }
            }

            // 4. RETURN
            if (jobType === 'Return') {
                if (task.remarks === 'Pending Admin') {
                    updates.approvedQty = qty;
                    // GENERATE APPROVER ESN
                    updates.esn = `${generateStructuredESN(6, 6)}/${cleanName}`;

                    if (task.originalJobType === 'Restock') {
                        updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                        if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                        alert("Restock Return Approved. Stock Removed.");
                    } 
                    else if (task.originalJobType === 'Usage') {
                        updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                        if (pID && sourceSite) await updateStockInventory(pID, qty, 'Add', sourceSite);
                        alert("Usage Return Approved. Stock Restored.");
                    } 
                    else {
                        // Transfer Return
                        updates.status = 'In Transit'; updates.remarks = 'In Transit'; updates.attention = task.receiver;
                        if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                        alert("Return Authorized. Stock Deducted.");
                    }
                    await commitUpdate(database, key, updates, note);
                    return;
                }
                
                // RECEIVER CONFIRM (Return)
                if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                    updates.receivedQty = qty;
                    
                    // GENERATE RECEIVER ESN
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`;

                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);
                    
                    // Reconciliation
                    const approved = parseFloat(task.approvedQty) || 0;
                    const diff = approved - qty;
                    if (diff > 0 && pID && sourceSite) {
                        await updateStockInventory(pID, diff, 'Add', sourceSite);
                        alert(`Partial Return Receive: ${diff} returned to origin.`);
                    } else {
                        alert("Return Received. Stock Restored.");
                    }

                    await commitUpdate(database, key, updates, note);
                    return;
                }
            }
        }

    } catch (error) {
        console.error("Error:", error);
        alert("Action failed. Check console.");
    } finally {
        if(btn) btn.disabled = false;
    }
};


// Helper
async function commitUpdate(db, key, updates, note) {
    const historyEntry = { 
        action: updates.status, 
        by: (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'Unknown'), 
        timestamp: Date.now(), 
        note: note || '' 
    };
    await db.ref(`transfer_entries/${key}`).update(updates);
    await db.ref(`transfer_entries/${key}/history`).push(historyEntry);
    document.getElementById('transfer-approval-modal').classList.add('hidden');
    if(typeof populateActiveTasks === 'function') await populateActiveTasks();
}

// 8. STOCK UPDATE HELPER (Ensure this is at the bottom of transferLogic.js)
async function updateStockInventory(id, qty, action, siteName) {
    if (!id || !qty || !siteName) { console.error("Missing params"); return; }
    const safeSiteName = siteName.replace(/[.#$[\]]/g, "_");
    const database = (typeof db !== 'undefined') ? db : firebase.database();

    try {
        let snapshot = await database.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
        if (!snapshot.exists()) snapshot = await database.ref('material_stock').orderByChild('productId').equalTo(id).once('value');

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

            await database.ref(`material_stock/${key}`).update({
                sites: sites, stockQty: newGlobalStock, lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
        }
    } catch (error) { console.error("Stock update failed:", error); }
}

// Helper
async function commitUpdate(db, key, updates, note) {
    const historyEntry = { 
        action: updates.status, 
        by: (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'Unknown'), 
        timestamp: Date.now(), 
        note: note || '' 
    };
    await db.ref(`transfer_entries/${key}`).update(updates);
    await db.ref(`transfer_entries/${key}/history`).push(historyEntry);
    document.getElementById('transfer-approval-modal').classList.add('hidden');
    if(typeof populateActiveTasks === 'function') await populateActiveTasks();
}

// ==========================================================================
// 4. SAVE ENTRY (The Only Save Function You Need)
// ==========================================================================
async function saveTransferEntry(e) {
    if(e) e.preventDefault(); 
    const btn = document.getElementById('tf-save-btn');
    btn.disabled = true; btn.textContent = "Saving...";

    // 1. Get Values
    const fromLoc = (tfFromSiteChoices ? tfFromSiteChoices.getValue(true) : document.getElementById('tf-from').value) || '';
    const toLoc = (tfToSiteChoices ? tfToSiteChoices.getValue(true) : document.getElementById('tf-to').value) || '';
    const productID = (transferProductChoices ? transferProductChoices.getValue(true) : document.getElementById('tf-product-select').value) || '';
    const sourceContact = (tfSourceContactChoices ? tfSourceContactChoices.getValue(true) : document.getElementById('tf-source-contact').value) || '';
    const approver = (tfApproverChoices ? tfApproverChoices.getValue(true) : document.getElementById('tf-approver').value) || '';
    const receiver = (tfReceiverChoices ? tfReceiverChoices.getValue(true) : document.getElementById('tf-receiver').value) || '';
    const qty = parseFloat(document.getElementById('tf-req-qty').value) || 0;
    const type = document.getElementById('tf-job-type').value;

    // 2. VALIDATION LOGIC (Critical for Workflow)
    if (type === 'Usage' || type === 'Return') {
        if (!productID || !fromLoc || !approver) {
            alert("Please fill in: Product, Source Site, and Approver."); 
            btn.disabled = false; btn.textContent = "Save Transaction"; return;
        }
    } 
    else if (type === 'Restock') {
        // MUST have Receiver so Admin knows who to send it back to
        if (!productID || !toLoc || !approver || !receiver) {
            alert("For Restock, you MUST select:\n1. Destination Site\n2. Approver\n3. Receiver (Yourself)"); 
            btn.disabled = false; btn.textContent = "Save Transaction"; return;
        }
    }
    else {
        // Transfer requires everything
        if (!productID || !fromLoc || !toLoc || !sourceContact || !approver || !receiver) {
            alert("Please fill in ALL fields for Transfer."); 
            btn.disabled = false; btn.textContent = "Save Transaction"; return;
        }
    }

    // 3. Determine Start Status
    const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
    let startStatus = 'Pending';
    let startAttention = '';

    if (type === 'Transfer') { 
        startStatus = 'Pending Source'; 
        startAttention = sourceContact; 
    } else { 
        // Restock, Usage, Return all go to Admin first
        startStatus = 'Pending Admin'; 
        startAttention = approver; 
    } 

    const entryData = {
        controlNumber: document.getElementById('tf-control-no').value,
        jobType: type, for: type,
        productID: productID, productName: document.getElementById('tf-product-name').value,
        details: document.getElementById('tf-details').value, requestor: document.getElementById('tf-requestor').value,
        sourceContact: sourceContact, approver: approver, receiver: receiver || '',
        requiredQty: qty, orderedQty: qty, 
        fromLocation: fromLoc, fromSite: fromLoc,
        toLocation: toLoc, toSite: toLoc,
        shippingDate: document.getElementById('tf-shipping-date').value,
        status: startStatus, remarks: startStatus, attention: startAttention, 
        timestamp: firebase.database.ServerValue.TIMESTAMP, enteredBy: currentUser, 
        history: [{ action: "Created", by: currentUser, timestamp: Date.now(), status: startStatus }]
    };

    // 4. Save to DB
    const database = (typeof db !== 'undefined') ? db : firebase.database();

    try {
        if (typeof editingTransferData !== 'undefined' && editingTransferData && editingTransferData.key) {
            await database.ref(`transfer_entries/${editingTransferData.key}`).update(entryData);
            alert("Transaction Updated!");
        } else {
            const newRef = await database.ref('transfer_entries').push(entryData);
            entryData.key = newRef.key; 
            alert("Transaction Saved!");
        }
        document.getElementById('transfer-job-modal').classList.add('hidden');
        if(typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(true);
        if(typeof populateActiveTasks === 'function') await populateActiveTasks();
    } catch (e) { 
        console.error(e); 
        alert("Error saving."); 
    } finally { 
        btn.disabled = false; 
        btn.textContent = "Save Transaction"; 
    }
}


// ==========================================================================
// 6. PRINT LOGIC (Fixed: Status Badge & ESN Text)
// ==========================================================================
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
    const esnText = document.getElementById('wb-esn-text');
    const receiverEsnText = document.getElementById('wb-receiver-esn-text');
    const arrivalDateEl = document.getElementById('wb-arrival-date');

    const generateBarcodeSrc = (text) => {
        try {
            const canvas = document.createElement('canvas');
            const cleanText = text.replace(/[^a-zA-Z0-9-]/g, ""); 
            JsBarcode(canvas, cleanText, { format: "CODE128", displayValue: false, height: 45, margin: 0, width: 2, background: "#ffffff" });
            return canvas.toDataURL("image/png");
        } catch(e) { return ""; }
    };

    const isApproved = ['In Transit', 'Approved', 'Completed', 'Received'].includes(entry.remarks);
    
    // --- APPROVER SECTION ---
    if (isApproved) {
        if(titleEl) titleEl.textContent = "TRANSFER SLIP";
        if(badgeEl) { badgeEl.textContent = "AUTHORIZED"; badgeEl.style.borderColor = "#00748C"; badgeEl.style.color = "#00748C"; }

        let esnString = entry.esn;
        if (!esnString) esnString = (entry.controlId || entry.ref) + "/APP"; 
        
        let signerName = entry.approver || "Admin";
        if (esnString.includes('/')) signerName = esnString.split('/')[1];

        // Just show ESN and Name (Lines are now in HTML)
        if(esnText) {
            esnText.innerHTML = `<div style="margin-bottom:2px;">Digital Sig: ${signerName}</div><div style="font-family:monospace;">${esnString}</div>`;
        }
        
        if(approverImg) { approverImg.src = generateBarcodeSrc(esnString); approverImg.style.display = 'block'; }
    } else {
        if(titleEl) titleEl.textContent = "DRAFT REQUEST";
        if(badgeEl) { badgeEl.textContent = "PENDING APPROVAL"; badgeEl.style.borderColor = "#dc3545"; badgeEl.style.color = "#dc3545"; }
        if(esnText) esnText.textContent = "PENDING APPROVAL";
        if(approverImg) approverImg.style.display = 'none';
    }

    // --- RECEIVER SECTION ---
    const isCompleted = ['Completed', 'Received'].includes(entry.remarks);
    
    if (isCompleted) {
        if(badgeEl) { badgeEl.textContent = "COMPLETED"; badgeEl.style.borderColor = "#28a745"; badgeEl.style.color = "#28a745"; }
        if(receiverText) receiverText.style.display = 'none';
        
        if (entry.jobType !== 'Usage' && entry.jobType !== 'Return') {
            let recString = entry.receiverEsn;
            if (!recString) recString = (entry.controlId || entry.ref) + "/REC"; 

            let recName = entry.receiver || "Receiver";
            if (recString.includes('/')) recName = recString.split('/')[1];

            if(receiverEsnText) {
                receiverEsnText.innerHTML = `<div style="margin-bottom:2px;">Received By: ${recName}</div><div style="font-family:monospace;">${recString}</div>`;
            }
            if(receiverImg) { receiverImg.src = generateBarcodeSrc(recString); receiverImg.style.display = 'block'; }
            if(receiverContainer) receiverContainer.style.display = 'block';
        } else {
             if(receiverText) { receiverText.style.display = 'block'; receiverText.textContent = "(System Processed)"; }
        }
    } else {
        if(receiverImg) receiverImg.style.display = 'none';
        if(receiverEsnText) receiverEsnText.textContent = "";
        if(receiverContainer) receiverContainer.style.display = 'none';
        if(receiverText) receiverText.style.display = 'block';
    }

    document.body.classList.add('printing-waybill');
    setTimeout(() => {
        window.print();
        setTimeout(() => { document.body.classList.remove('printing-waybill'); }, 1000);
    }, 500);
};

// ==========================================================================
// 7. HELPERS (DB Safe)
// ==========================================================================
window.closeTransferModal = function() { document.getElementById('transfer-job-modal').classList.add('hidden'); };

async function generateSequentialTransferId(type) {
    const database = (typeof db !== 'undefined') ? db : firebase.database();
    const prefix = (type === 'Transfer' ? 'TRF' : (type === 'Restock' ? 'STK' : (type === 'Usage' ? 'USE' : 'RET')));
    const input = document.getElementById('tf-control-no');
    input.value = "Generating...";
    try {
        const snap = await database.ref('transfer_entries').once('value');
        const data = snap.val();
        let max = 0;
        if (data) Object.values(data).forEach(i => { if(i.controlNumber && i.controlNumber.startsWith(prefix)) { const n = parseInt(i.controlNumber.split('-')[1]); if(n > max) max = n; } });
        input.value = `${prefix}-${String(max + 1).padStart(4, '0')}`;
    } catch (e) { input.value = `${prefix}-0001`; }
}

// ROBUST DROPDOWN INITIALIZER
async function initTransferDropdowns() {
    const database = (typeof db !== 'undefined') ? db : firebase.database();
    
    const selectElement = document.getElementById('tf-product-select');
    if (transferProductChoices) { transferProductChoices.destroy(); } 
    
    transferProductChoices = new Choices(selectElement, { searchEnabled: true, itemSelectText: '', placeholder: true, placeholderValue: 'Type ID or Name...', shouldSort: false });
    
    try {
        const snap = await database.ref('material_stock').once('value');
        const data = snap.val();
        if (data) {
            const choices = Object.values(data).map(item => ({ value: item.productID, label: `${item.productID} - ${item.productName}`, customProperties: { name: item.productName, details: item.details, sites: item.sites } }));
            transferProductChoices.setChoices(choices, 'value', 'label', true);
        }
    } catch (e) { console.error(e); }

    selectElement.addEventListener('change', () => {
        const val = transferProductChoices.getValue(true);
        const item = transferProductChoices._store.choices.find(c => c.value === val);
        if (item && item.customProperties) {
            document.getElementById('tf-product-name').value = item.customProperties.name;
            document.getElementById('tf-details').value = item.customProperties.details;
            updateFromSiteOptions(item.customProperties.sites);
        }
    });

    if (!tfFromSiteChoices) tfFromSiteChoices = new Choices(document.getElementById('tf-from'), { searchEnabled: true, itemSelectText: '' });
    if (!tfToSiteChoices) tfToSiteChoices = new Choices(document.getElementById('tf-to'), { searchEnabled: true, itemSelectText: '' });
    
    // Force Fetch Sites if Cache Empty
    let sitesData = [];
    if (typeof allSitesCache !== 'undefined' && allSitesCache.length > 0) {
        sitesData = allSitesCache;
    } else {
        try {
            const res = await fetch("https://cdn.jsdelivr.net/gh/DC-database/Hub@main/Site.csv");
            const txt = await res.text();
            const lines = txt.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length >= 2) {
                    sitesData.push({ value: cols[0].replace(/"/g,'').trim(), label: `${cols[0].replace(/"/g,'').trim()} - ${cols[1].replace(/"/g,'').trim()}` });
                }
            }
        } catch(e) {}
    }
    
    if(sitesData.length > 0) {
        sitesData.sort((a, b) => parseInt(a.value) - parseInt(b.value));
        tfToSiteChoices.setChoices(sitesData, 'value', 'label', true);
        tfFromSiteChoices.setChoices(sitesData, 'value', 'label', true);
    }

    const opts = { searchEnabled: true, itemSelectText: '' };
    if (!tfApproverChoices) tfApproverChoices = new Choices(document.getElementById('tf-approver'), opts);
    if (!tfReceiverChoices) tfReceiverChoices = new Choices(document.getElementById('tf-receiver'), opts);
    if (!tfSourceContactChoices) tfSourceContactChoices = new Choices(document.getElementById('tf-source-contact'), opts);

    // Force Fetch Approvers
    let approverList = [];
    if (typeof allApproversCache !== 'undefined' && allApproversCache.length > 0) {
        approverList = allApproversCache;
    } else {
        try {
            const snap = await database.ref('approvers').once('value');
            const data = snap.val();
            if (data) {
                approverList = Object.values(data).map(u => ({ value: u.Name, label: `${u.Name} - ${u.Position||''}` }));
            }
        } catch(e) {}
    }
    
    if(approverList.length > 0) {
        tfApproverChoices.setChoices(approverList, 'value', 'label', true);
        tfReceiverChoices.setChoices(approverList, 'value', 'label', true);
        tfSourceContactChoices.setChoices(approverList, 'value', 'label', true);
    }
}

function updateFromSiteOptions(sitesData) {
    if (!tfFromSiteChoices) return;
    tfFromSiteChoices.clearStore(); tfFromSiteChoices.clearInput();
    const currentJobType = document.getElementById('tf-job-type').value;
    // ... (Keep rest of logic) ...
     const newChoices = [];
    if (sitesData) {
        Object.entries(sitesData).forEach(([site, qty]) => {
            if (parseFloat(qty) > 0) newChoices.push({ value: site, label: `${site} (Avail: ${qty})` });
        });
    }
    // Fallback if empty
    if (newChoices.length > 0) tfFromSiteChoices.setChoices(newChoices, 'value', 'label', true);
    else {
        // If Restock, load ALL sites
        if (currentJobType === 'Restock') {
             // Re-run init logic for this specific dropdown or just show all
        } else {
            tfFromSiteChoices.setChoices([{ value: '', label: 'No stock available', disabled: true, selected: true }]);
        }
    }
}
function highlightSenderFields(isActive) { /* Keep */ }
function updateFieldLocks(mode) { /* Keep */ }

// Events
document.addEventListener('DOMContentLoaded', () => {
    const sBtn = document.getElementById('tf-save-btn');
    if(sBtn) sBtn.addEventListener('click', saveTransferEntry);
    const appBtn = document.getElementById('transfer-modal-approve-btn');
    if(appBtn) appBtn.addEventListener('click', () => handleTransferAction('Approved'));
    const rejBtn = document.getElementById('transfer-modal-reject-btn');
    if(rejBtn) rejBtn.addEventListener('click', () => handleTransferAction('Rejected'));
});

// ==========================================================================
// 8. STOCK UPDATE HELPER (Required for Approval Logic)
// ==========================================================================
async function updateStockInventory(id, qty, action, siteName) {
    if (!id || !qty || !siteName) {
        console.error("Missing parameters for stock update:", {id, qty, action, siteName});
        return;
    }

    // Sanitize Site Name (Firebase doesn't like ., #, $, [, ])
    const safeSiteName = siteName.replace(/[.#$[\]]/g, "_");
    
    // Safety check for DB connection
    const database = (typeof db !== 'undefined') ? db : firebase.database();

    console.log(`Executing Stock Update: ${action} ${qty} at ${safeSiteName} for Product ${id}`);

    try {
        // 1. Find the product (search by ID)
        let snapshot = await database.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
        if (!snapshot.exists()) {
            // Try searching by the other field name just in case
            snapshot = await database.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
        }

        if (snapshot.exists()) {
            const data = snapshot.val();
            const key = Object.keys(data)[0]; 
            const item = data[key];
            
            // 2. Calculate New Site Qty
            let sites = item.sites || {};
            let currentSiteStock = parseFloat(sites[safeSiteName] || 0);
            const amount = parseFloat(qty);

            if (action === 'Deduct') {
                currentSiteStock -= amount;
                if (currentSiteStock < 0) currentSiteStock = 0; // Prevent negatives
            } else if (action === 'Add') {
                currentSiteStock += amount;
            }

            sites[safeSiteName] = currentSiteStock;

            // 3. Recalculate Global Total
            let newGlobalStock = 0;
            Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

            // 4. Save to DB
            await database.ref(`material_stock/${key}`).update({
                sites: sites,
                stockQty: newGlobalStock,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log("Stock successfully updated.");
        } else {
            console.warn("Product ID not found in Material Stock database:", id);
        }
    } catch (error) { 
        console.error("Stock update failed:", error); 
        alert("Critical Error: Failed to update stock inventory in database.");
    }
}
