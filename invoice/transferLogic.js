// ==========================================================================
// TRANSFER LOGIC: WORKFLOW ENGINE (V4.5 - Admin-Only Approver Filter)
// ==========================================================================

let currentTransferType = '';
let transferProductChoices = null;
let editingTransferData = null;
let tfFromSiteChoices, tfToSiteChoices, tfApproverChoices, tfReceiverChoices, tfSourceContactChoices;

// ==========================================================================
// 1. OPEN NEW TRANSFER
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

    const sourceGroup = document.getElementById('tf-from').closest('.form-group');
    const contactGroup = document.getElementById('tf-source-contact').closest('.form-group');
    const destGroup = document.getElementById('tf-to').closest('.form-group');
    const approverGroup = document.getElementById('tf-approver').closest('.form-group');
    const recvGroup = document.getElementById('tf-receiver').closest('.form-group');
    
    document.getElementById('tf-status').closest('.form-group').style.display = 'none';
    document.getElementById('tf-remarks').closest('.form-group').style.display = 'none';

    sourceGroup.style.display = 'block';
    contactGroup.style.display = 'block';
    destGroup.style.display = 'block';
    approverGroup.style.display = 'block';
    recvGroup.style.display = 'block';

    const highlight = (ids, status) => {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const parentChoices = el.closest('.choices');
            const target = parentChoices ? parentChoices.querySelector('.choices__inner') : el;
            
            if (status) target.classList.add('input-required-highlight');
            else target.classList.remove('input-required-highlight');
        });
    };

    const allFields = ['tf-product-select', 'tf-req-qty', 'tf-from', 'tf-to', 'tf-source-contact', 'tf-approver', 'tf-receiver'];
    highlight(allFields, false);

    if (type === 'Transfer') {
        highlight(['tf-product-select', 'tf-req-qty', 'tf-from', 'tf-to', 'tf-source-contact', 'tf-approver', 'tf-receiver'], true);
    }
    else if (type === 'Restock') {
        sourceGroup.style.display = 'none'; 
        contactGroup.style.display = 'none';
        highlight(['tf-product-select', 'tf-req-qty', 'tf-to', 'tf-approver', 'tf-receiver'], true);
    }
    else if (type === 'Usage') {
        destGroup.style.display = 'none'; 
        recvGroup.style.display = 'none'; 
        highlight(['tf-product-select', 'tf-req-qty', 'tf-from', 'tf-approver'], true);
    }
    else if (type === 'Return') {
        highlight(['tf-product-select', 'tf-req-qty', 'tf-from', 'tf-to', 'tf-approver'], true);
    }

    document.getElementById('transfer-job-modal').classList.remove('hidden');
}

// ==========================================================================
// 2. OPEN APPROVAL MODAL
// ==========================================================================
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
    
    qtyInput.classList.remove('input-required-highlight');
    if(dateInput) dateInput.classList.remove('input-required-highlight');
    
    qtyInput.disabled = false;
    dateContainer.classList.add('hidden');
    rejectBtn.classList.remove('hidden');
    approveBtn.innerHTML = "Approve";

    if (task.remarks === 'Pending Source') {
        title.textContent = "Step 1: Source Confirmation";
        approveBtn.textContent = "Confirm & Send";
        approveBtn.style.backgroundColor = "#17a2b8"; 
        qtyInput.value = task.orderedQty; 
        qtyInput.classList.add('input-required-highlight');

    } else if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
        title.textContent = "Step 2: Admin Authorization";
        approveBtn.textContent = "Authorize";
        approveBtn.style.backgroundColor = "#28a745"; 
        qtyInput.value = task.approvedQty || task.orderedQty; 
        qtyInput.classList.add('input-required-highlight');

    } else if (task.remarks === 'In Transit') {
        title.textContent = "Step 3: Confirm Receipt";
        approveBtn.textContent = "Confirm Received";
        approveBtn.style.backgroundColor = "#003A5C"; 
        qtyInput.value = task.approvedQty; 
        
        dateContainer.classList.remove('hidden');
        if(dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
            dateInput.classList.add('input-required-highlight');
        }
        qtyInput.classList.add('input-required-highlight');
        rejectBtn.classList.add('hidden'); 

    } else if (task.remarks === 'Pending Confirmation') {
        title.textContent = "Final Step: Confirm Usage";
        approveBtn.textContent = "Confirm Actual Usage";
        approveBtn.style.backgroundColor = "#6f42c1"; 
        qtyInput.value = task.approvedQty;
        qtyInput.classList.add('input-required-highlight');
    }

    detailsDiv.innerHTML = `
        <div style="font-size:0.9rem; color:#333;">
            <p><strong>Ref:</strong> ${task.ref || task.controlNumber}</p>
            <p><strong>Item:</strong> ${task.vendorName || task.productName}</p>
            <p><strong>Type:</strong> ${task.for || 'Transfer'}</p>
            <p><strong>Status:</strong> <span style="color:#00748C; font-weight:bold;">${task.remarks}</span></p>
        </div>`;

    modal.classList.remove('hidden');
};

// ==========================================================================
// 3. HANDLE ACTION CLICK
// ==========================================================================
window.handleTransferAction = async (status) => {
    const key = document.getElementById('transfer-modal-key').value;
    const qty = parseFloat(document.getElementById('transfer-modal-qty').value) || 0;
    const note = document.getElementById('transfer-modal-note').value;
    const arrivalDateVal = document.getElementById('transfer-modal-date') ? document.getElementById('transfer-modal-date').value : ''; 
    
    const btn = status === 'Approved' ? document.getElementById('transfer-modal-approve-btn') : document.getElementById('transfer-modal-reject-btn');
    if(btn) { btn.disabled = true; btn.textContent = "Processing..."; }

    const database = (typeof db !== 'undefined') ? db : firebase.database();

    const generateStructuredESN = (letters, digits) => {
        const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numSet = "0123456789";
        let result = "";
        for (let i = 0; i < letters; i++) result += charSet.charAt(Math.floor(Math.random() * charSet.length));
        for (let i = 0; i < digits; i++) result += numSet.charAt(Math.floor(Math.random() * numSet.length));
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

        let updates = { 
            note: note, 
            dateResponded: formatDate(new Date())
        };

        if (status === 'Rejected') {
            updates.status = 'Rejected';
            updates.remarks = 'Rejected';
            updates.attention = task.requestor;
            await commitUpdate(database, key, updates, note);
            return; 
        } 
        
       if (status === 'Approved') {
            const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
            const cleanName = currentUser.replace(/Engr\.?\s*/gi, '').trim().toUpperCase().split(' ')[0];

            // 1. GENERATE ESN HERE (Single Source of Truth)
            // This ensures the DB and the Receipt get the EXACT same number
            const generatedESN = `${generateStructuredESN(6, 6)}/${cleanName}`;

            // 2. DEFINE MOVEMENT STRING (e.g., "Store > Site")
            const fromLoc = task.fromLocation || task.fromSite || 'Src';
            const toLoc = task.toLocation || task.toSite || 'Dst';
            let movement = `${fromLoc} > ${toLoc}`;
            if (jobType === 'Usage') movement = `Used at ${fromLoc}`;
            if (jobType === 'Restock') movement = `Restock > ${toLoc}`;

            // 3. CAPTURE FOR RECEIPT (Admin OR Assigned Approver)
            const isApproverStage = (task.remarks === 'Pending Admin' || task.remarks === 'Pending');
            const isAuthorized = (currentApprover?.Role || '').toLowerCase() === 'admin' || (task.approver === currentUser);

            if (isAuthorized && isApproverStage) {
                const receiptItem = {
                    po: task.controlNumber || task.ref,
                    vendorName: task.productName,
                    invEntryID: task.jobType,
                    amountPaid: qty,
                    status: 'Approved',
                    isInventory: true,
                    esn: generatedESN,     // <--- PASS THE GENERATED ESN
                    movement: movement     // <--- PASS THE MOVEMENT
                };

                if (typeof window.transferProcessedTasks !== 'undefined') {
                    window.transferProcessedTasks.push(receiptItem);
                    
                    // Show Buttons
                    const dBtn = document.getElementById('send-transfer-approval-receipt-btn');
                    if(dBtn) dBtn.classList.remove('hidden');

                    const mCont = document.getElementById('mobile-receipt-action-container');
                    const mBtn = document.getElementById('mobile-send-transfer-receipt-btn');
                    if(mBtn && mCont) {
                        mCont.classList.remove('hidden');
                        mBtn.classList.remove('hidden');
                    }
                }
            }

            // 4. UPDATE DATABASE (Using the SAME ESN)
            // Note: We set updates.esn = generatedESN;
            
            if (jobType === 'Restock') {
                if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                    if (!task.receiver) { alert("Error: No Receiver."); btn.disabled = false; return; }
                    updates.approvedQty = qty; 
                    updates.status = 'In Transit';
                    updates.remarks = 'In Transit';
                    updates.attention = task.receiver;
                    updates.esn = generatedESN; // <--- USE IT HERE
                    alert(`Restock Authorized! Sent to Receiver.`);
                    await commitUpdate(database, key, updates, note);
                    return; 
                }
                // ... (Keep 'In Transit' logic as is, receiver makes their own ESN) ...
                 if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                    updates.receivedQty = qty; updates.arrivalDate = arrivalDateVal;
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`; // Receiver ESN is new
                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);
                    alert(`Restock Confirmed! ${qty} Added to Stock.`);
                    await commitUpdate(database, key, updates, note);
                    return; 
                }
            }

            if (jobType === 'Usage') {
                if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                    updates.approvedQty = qty;
                    updates.status = 'Pending'; updates.remarks = 'Pending Confirmation'; updates.attention = task.requestor;
                    updates.esn = generatedESN; // <--- USE IT HERE
                    if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                    alert("Usage Authorized. Stock Reserved (Deducted).");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
                // ... (Keep Confirmation logic) ...
                if (task.remarks === 'Pending Confirmation') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                    updates.receivedQty = qty;
                    // ... stock restore logic ...
                    const approved = parseFloat(task.approvedQty) || 0;
                    const diff = approved - qty; 
                    if (diff > 0 && pID && sourceSite) await updateStockInventory(pID, diff, 'Add', sourceSite);
                    else if (diff < 0) await updateStockInventory(pID, Math.abs(diff), 'Deduct', sourceSite);
                    
                    alert("Usage Closed.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
            }

            if (jobType === 'Transfer') {
                if (task.remarks === 'Pending Source') {
                    updates.approvedQty = qty;
                    updates.status = 'Pending'; updates.remarks = 'Pending Admin'; updates.attention = task.approver;
                    alert("Source Confirmed.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
                if (task.remarks === 'Pending Admin') {
                    updates.approvedQty = qty;
                    updates.status = 'In Transit'; updates.remarks = 'In Transit'; updates.attention = task.receiver;
                    updates.esn = generatedESN; // <--- USE IT HERE
                    if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                    alert("Transfer Authorized. Stock Deducted from Source.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
                // ... (Keep In Transit logic) ...
                if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                    updates.receivedQty = qty; updates.arrivalDate = arrivalDateVal;
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`;
                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);
                    alert("Transfer Received.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
            }

            if (jobType === 'Return') {
                if (task.remarks === 'Pending Admin') {
                    updates.approvedQty = qty;
                    updates.esn = generatedESN; // <--- USE IT HERE
                    // ... (Logic for rest of return) ...
                     if (task.originalJobType === 'Restock') {
                        updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                        if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                    } else if (task.originalJobType === 'Usage') {
                        updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                        if (pID && sourceSite) await updateStockInventory(pID, qty, 'Add', sourceSite);
                    } else {
                        updates.status = 'In Transit'; updates.remarks = 'In Transit'; updates.attention = task.receiver;
                        if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                    }
                    alert("Return Authorized.");
                    await commitUpdate(database, key, updates, note);
                    return;
                }
                // ... (Keep In Transit logic) ...
                if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records';
                    updates.receivedQty = qty;
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`;
                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);
                    alert("Return Received.");
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

// ==========================================================================
// 4. HELPERS
// ==========================================================================
async function commitUpdate(db, key, updates, note) {
    const historyEntry = { 
        action: (updates.remarks || updates.status), 
        by: (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'Unknown'), 
        timestamp: Date.now(), 
        note: note || '' 
    };
    
    await db.ref(`transfer_entries/${key}`).update(updates);
    await db.ref(`transfer_entries/${key}/history`).push(historyEntry);
    
    document.getElementById('transfer-approval-modal').classList.add('hidden');
    
    if(typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(true); 
    if(typeof populateActiveTasks === 'function') await populateActiveTasks();
}

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

// ==========================================================================
// 5. SAVE ENTRY
// ==========================================================================
async function saveTransferEntry(e) {
    if(e) e.preventDefault(); 
    const btn = document.getElementById('tf-save-btn');
    btn.disabled = true; btn.textContent = "Saving...";

    const fromLoc = (tfFromSiteChoices ? tfFromSiteChoices.getValue(true) : document.getElementById('tf-from').value) || '';
    const toLoc = (tfToSiteChoices ? tfToSiteChoices.getValue(true) : document.getElementById('tf-to').value) || '';
    const productID = (transferProductChoices ? transferProductChoices.getValue(true) : document.getElementById('tf-product-select').value) || '';
    const sourceContact = (tfSourceContactChoices ? tfSourceContactChoices.getValue(true) : document.getElementById('tf-source-contact').value) || '';
    const approver = (tfApproverChoices ? tfApproverChoices.getValue(true) : document.getElementById('tf-approver').value) || '';
    const receiver = (tfReceiverChoices ? tfReceiverChoices.getValue(true) : document.getElementById('tf-receiver').value) || '';
    const qty = parseFloat(document.getElementById('tf-req-qty').value) || 0;
    const type = document.getElementById('tf-job-type').value;

    if (type === 'Usage' || type === 'Return') {
        if (!productID || !fromLoc || !approver) {
            alert("Please fill in: Product, Source Site, and Approver."); 
            btn.disabled = false; btn.textContent = "Save Transaction"; return;
        }
    } 
    else if (type === 'Restock') {
        if (!productID || !toLoc || !approver || !receiver) {
            alert("For Restock, you MUST select:\n1. Destination Site\n2. Approver\n3. Receiver (Yourself)"); 
            btn.disabled = false; btn.textContent = "Save Transaction"; return;
        }
    }
    else {
        if (!productID || !fromLoc || !toLoc || !sourceContact || !approver || !receiver) {
            alert("Please fill in ALL fields for Transfer."); 
            btn.disabled = false; btn.textContent = "Save Transaction"; return;
        }
    }

    const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
    let startStatus = 'Pending';
    let startRemarks = 'Pending';
    let startAttention = '';

    if (type === 'Transfer') { 
        startRemarks = 'Pending Source';
        startAttention = sourceContact; 
    } else { 
        startRemarks = 'Pending Admin';
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
        
        status: startStatus, 
        remarks: startRemarks, 
        attention: startAttention, 
        
        timestamp: firebase.database.ServerValue.TIMESTAMP, enteredBy: currentUser, 
        history: [{ action: "Created", by: currentUser, timestamp: Date.now(), status: startStatus, remarks: startRemarks }]
    };

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
// 6. PRINT LOGIC (RESTORED)
// ==========================================================================
window.handlePrintWaybill = function(entry) {
    const getFullSiteName = (code) => {
        if (!code) return '-';
        if (typeof allSitesCSVData !== 'undefined' && allSitesCSVData) {
            const found = allSitesCSVData.find(s => s.site == code);
            if (found) return `${found.site} - ${found.description}`;
        }
        return code; 
    };

    const generateBarcodeSrc = (text) => {
        try {
            const canvas = document.createElement('canvas');
            const cleanText = text.replace(/[^a-zA-Z0-9-]/g, ""); 
            JsBarcode(canvas, cleanText, { format: "CODE128", displayValue: false, height: 50, margin: 0, width: 2, background: "#ffffff" });
            return canvas.toDataURL("image/png");
        } catch(e) { return ""; }
    };

    const date = formatYYYYMMDD(entry.shippingDate);
    const controlId = entry.controlId || entry.ref;
    const fromSite = getFullSiteName(entry.fromSite || entry.fromLocation);
    const toSite = getFullSiteName(entry.toSite || entry.toLocation);
    const requestor = entry.requestor || '-';
    const receiver = entry.receiver || '-';
    const prodId = entry.productId || entry.productID;
    const prodName = entry.productName;
    const details = entry.details;
    
    let displayQty = entry.orderedQty;
    if (entry.remarks === 'Completed') displayQty = entry.receivedQty;
    else if (entry.remarks === 'In Transit') displayQty = entry.approvedQty;
    
    const printDate = new Date().toLocaleString();
    const isApproved = ['In Transit', 'Approved', 'Completed', 'Received'].includes(entry.remarks);
    const isCompleted = ['Completed', 'Received'].includes(entry.remarks);

    let title = isApproved ? "TRANSFER SLIP" : "DRAFT REQUEST";
    let badgeText = isApproved ? "AUTHORIZED" : "PENDING APPROVAL";
    let badgeColor = isApproved ? "#00748C" : "#dc3545";
    if(isCompleted) { badgeText = "COMPLETED"; badgeColor = "#28a745"; }

    let approverSectionHTML = '';
    if(isApproved) {
        let esnString = entry.esn || ((entry.controlId || entry.ref) + "/APP");
        const barcodeSrc = generateBarcodeSrc(esnString);
        
        approverSectionHTML = `
            <div style="text-align: center;">
                <img src="${barcodeSrc}" style="width: 80%; height: 50px; object-fit: contain;">
                <div style="font-size: 10px; font-family: monospace; font-weight: bold; margin-top: 2px; color: black;">
                    <div>${esnString}</div>
                </div>
            </div>`;
    } else {
        approverSectionHTML = `<div style="text-align: center; font-weight: bold; color: #dc3545; padding: 20px;">PENDING APPROVAL</div>`;
    }

    let receiverSectionHTML = '';
    if(isCompleted) {
        if(entry.jobType !== 'Usage' && entry.jobType !== 'Return') {
            let recString = entry.receiverEsn || ((entry.controlId || entry.ref) + "/REC");
            const barcodeSrc = generateBarcodeSrc(recString);

            receiverSectionHTML = `
                <img src="${barcodeSrc}" style="width: 80%; height: 50px; margin: 0 auto; object-fit: contain; display: block;">
                <div style="font-size: 12px; font-weight: bold; font-family: monospace; margin-top: 5px; color: black;">
                    <div>${recString}</div>
                </div>`;
        } else {
            receiverSectionHTML = `<div style="font-size: 10px; color: #777; margin-top: 15px;">(System Processed)</div>`;
        }
    } else {
        receiverSectionHTML = `<div style="font-size: 10px; color: #999; margin-top: 15px;">(Barcode generated upon completion)</div>`;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Print Waybill - ${controlId}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #000; background: white; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid #003A5C; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { background-color: #003A5C; color: white; font-weight: 900; font-size: 36px; padding: 5px 15px; letter-spacing: 2px; margin-right: 15px; }
            .doc-title { font-size: 22px; font-weight: 800; color: #003A5C; margin: 0; }
            .grid-container { display: grid; grid-template-columns: 1fr 1fr; border: 2px solid #000; }
            .grid-item { padding: 10px; }
            .border-right { border-right: 2px solid #000; }
            .border-bottom { border-bottom: 2px solid #000; }
            .label-box { background-color: #003A5C; color: white; padding: 2px 5px; font-size: 11px; font-weight: bold; display: inline-block; margin-bottom: 5px; }
            .yellow-header { background-color: #ffc107; color: black; padding: 5px 10px; font-size: 12px; font-weight: bold; border-bottom: 2px solid #000; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { border-right: 1px solid #000; padding: 8px; background: #f0f0f0; text-align: left; }
            td { border-right: 1px solid #000; padding: 10px; border-top: 1px solid #000; }
            .footer-grid { display: flex; gap: 20px; margin-top: 30px; }
            .footer-box { flex: 1; border: 2px dashed #000; padding: 15px; text-align: center; border-radius: 8px; }
            .signature-line { border-bottom: 1px solid #000; height: 20px; margin-bottom: 5px; }
            
            @media print {
                @page { margin: 0.5cm; size: auto; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div style="display: flex; align-items: center;">
                <div class="logo">IBA</div>
                <div>
                    <h2 class="doc-title">${title}</h2>
                    <p style="margin: 5px 0 0 0; font-size: 11px; color: #555;">Ismail Bin Ali Tradg. & Cont. Co. W.L.L</p>
                </div>
            </div>
            <div style="border: 2px solid #000; padding: 5px 15px; font-weight: bold; font-size: 16px; color: ${badgeColor}; border-color: ${badgeColor};">
                ${badgeText}
            </div>
        </div>

        <div class="grid-container">
            <div class="border-right">
                <div class="grid-item border-bottom">
                    <div class="label-box">1. FROM</div>
                    <div style="margin-bottom: 8px;"><strong style="font-size: 14px;">${fromSite}</strong></div>
                    <div style="font-size: 12px;"><span style="color: #666; font-size: 10px;">By:</span> ${requestor}</div>
                </div>
                <div class="grid-item">
                    <div class="label-box">2. TO</div>
                    <div style="margin-bottom: 8px;"><strong style="font-size: 14px;">${toSite}</strong></div>
                    <div style="font-size: 12px;"><span style="color: #666; font-size: 10px;">Contact:</span> ${receiver}</div>
                </div>
            </div>
            <div>
                <div class="grid-item border-bottom">
                    <div class="label-box">3. DETAILS</div>
                    <div style="display: flex; justify-content: space-between;">
                        <div><span style="font-size: 10px; color: #666;">Date</span><br><strong>${date}</strong></div>
                        <div><span style="font-size: 10px; color: #666;">Control ID</span><br><strong>${controlId}</strong></div>
                    </div>
                </div>
                <div class="grid-item">
                    <div class="label-box">4. APPROVAL</div>
                    ${approverSectionHTML}
                </div>
            </div>
        </div>

        <div style="margin-top: 20px; border: 2px solid #000;">
            <div class="yellow-header">5. ITEM DESCRIPTION</div>
            <table>
                <thead>
                    <tr><th>ID</th><th>Name</th><th>Details</th><th style="border-right: none;">Qty</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${prodId}</td>
                        <td><strong>${prodName}</strong></td>
                        <td>${details}</td>
                        <td style="border-right: none; text-align: right; font-weight: bold;">${displayQty}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="footer-grid">
            <div class="footer-box">
                <div style="font-size: 9px; font-weight: bold; color: #003A5C; margin-bottom: 10px;">FINAL VERIFICATION / RECEIPT</div>
                ${receiverSectionHTML}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-around;">
                <div><div class="signature-line"></div><div style="font-size: 10px; font-weight: bold;">Approver Signature</div></div>
                <div><div class="signature-line"></div><div style="font-size: 10px; font-weight: bold;">Receiver Signature</div></div>
            </div>
        </div>

        <div style="text-align: center; font-size: 9px; margin-top: 20px; color: #777;">Printed: ${printDate}</div>
    </body>
    </html>`;

    // --- 3. EXECUTE PRINT ---
    const oldFrame = document.getElementById('waybill-print-frame');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'waybill-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = function() {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 500);
    };
};

// ==========================================================================
// 7. HELPERS & DROPDOWNS
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

    // --- UPDATED LOGIC FOR APPROVER FILTERING ---
    const opts = { searchEnabled: true, itemSelectText: '' };
    if (!tfApproverChoices) tfApproverChoices = new Choices(document.getElementById('tf-approver'), opts);
    if (!tfReceiverChoices) tfReceiverChoices = new Choices(document.getElementById('tf-receiver'), opts);
    if (!tfSourceContactChoices) tfSourceContactChoices = new Choices(document.getElementById('tf-source-contact'), opts);

    let rawData = null;

    // Check Global Raw Data first
    if (typeof allApproverData !== 'undefined' && allApproverData) {
        rawData = allApproverData;
    } else {
        // Fallback fetch
        try {
            const snap = await database.ref('approvers').once('value');
            rawData = snap.val();
        } catch(e) {}
    }

    if (rawData) {
        const allUsers = Object.values(rawData);

        // 1. Admin Only List (For Approver Field)
        const adminList = allUsers
            .filter(u => (u.Role || '').toLowerCase() === 'admin')
            .map(u => ({ value: u.Name, label: `${u.Name} - ${u.Position||''} (Admin)` }));

        // 2. Full List (For Receiver/Source Contact)
        const fullList = allUsers
            .map(u => ({ value: u.Name, label: `${u.Name} - ${u.Position||''}` }));

        // Apply
        tfApproverChoices.setChoices(adminList, 'value', 'label', true);
        tfReceiverChoices.setChoices(fullList, 'value', 'label', true);
        tfSourceContactChoices.setChoices(fullList, 'value', 'label', true);
    }
}

function updateFromSiteOptions(sitesData) {
    if (!tfFromSiteChoices) return;
    tfFromSiteChoices.clearStore(); tfFromSiteChoices.clearInput();
    const currentJobType = document.getElementById('tf-job-type').value;
    
    const newChoices = [];
    if (sitesData) {
        Object.entries(sitesData).forEach(([site, qty]) => {
            if (parseFloat(qty) > 0) newChoices.push({ value: site, label: `${site} (Avail: ${qty})` });
        });
    }
    
    if (newChoices.length > 0) {
        tfFromSiteChoices.setChoices(newChoices, 'value', 'label', true);
    } else {
        if (currentJobType === 'Restock' && typeof allSitesCache !== 'undefined') {
             tfFromSiteChoices.setChoices(allSitesCache, 'value', 'label', true);
        } else {
            tfFromSiteChoices.setChoices([{ value: '', label: 'No stock available', disabled: true, selected: true }]);
        }
    }
}

// Events
document.addEventListener('DOMContentLoaded', () => {
    const sBtn = document.getElementById('tf-save-btn');
    if(sBtn) sBtn.addEventListener('click', saveTransferEntry);
    const appBtn = document.getElementById('transfer-modal-approve-btn');
    if(appBtn) appBtn.addEventListener('click', () => handleTransferAction('Approved'));
    const rejBtn = document.getElementById('transfer-modal-reject-btn');
    if(rejBtn) rejBtn.addEventListener('click', () => handleTransferAction('Rejected'));
});