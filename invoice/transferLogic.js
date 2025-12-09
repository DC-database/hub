// ==========================================================================
// TRANSFER LOGIC: WORKFLOW ENGINE (V6.4 - Complete Integration)
// Includes: Batch Entry, Inventory Reservation, Batch Print, Manual Refresh, Return Logic
// ==========================================================================

let currentTransferType = '';
let transferProductChoices = null;
let editingTransferData = null;
let tfFromSiteChoices, tfToSiteChoices, tfApproverChoices, tfReceiverChoices, tfSourceContactChoices;

// --- MULTI-MODE & CACHE VARIABLES ---
let isMultiMode = false;
let multiItemBuffer = [];
let activeTransfersCache = []; // Stores all pending movements

// ==========================================================================
// 1. OPEN NEW TRANSFER
// ==========================================================================
async function openTransferModal(type) {
    currentTransferType = type;
    editingTransferData = null;

    // Reset to Single Mode by default
    if(typeof toggleTransferMode === 'function') {
        toggleTransferMode('single');
        const radio = document.querySelector('input[name="tf-mode"][value="single"]');
        if(radio) radio.checked = true;
    }

    document.getElementById('transfer-job-form').reset();
    document.getElementById('tf-job-type').value = type;

    if (typeof currentApprover !== 'undefined' && currentApprover) {
        document.getElementById('tf-requestor').value = currentApprover.Name;
    }

    const dateEl = document.getElementById('tf-shipping-date');
    if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    // 1. PRE-FETCH ACTIVE TRANSFERS (To calculate reservation)
    await fetchActiveTransfers();

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
// 1.1 INVENTORY RESERVATION LOGIC (NEW)
// ==========================================================================

async function fetchActiveTransfers() {
    const database = (typeof db !== 'undefined') ? db : firebase.database();
    activeTransfersCache = [];
    try {
        // Get all transfers
        const snap = await database.ref('transfer_entries').orderByChild('timestamp').once('value');
        const data = snap.val();
        if (data) {
            Object.values(data).forEach(t => {
                // Filter for "Active/Pending" items that DEDUCT from source
                // Completed/Rejected are ignored (Completed already deducted in DB, Rejected freed up)
                const pendingStatuses = ['Pending', 'Pending Source', 'Pending Admin', 'In Transit', 'Pending Confirmation'];

                if (pendingStatuses.includes(t.remarks || t.status)) {
                    activeTransfersCache.push({
                        productID: t.productID || t.productId,
                        fromSite: t.fromLocation || t.fromSite,
                        qty: parseFloat(t.orderedQty || t.requiredQty || 0)
                    });
                }
            });
        }
    } catch(e) {
        console.error("Error fetching active transfers:", e);
    }
}

function calculateRealAvailable(productID, siteName, dbStockQty) {
    // 1. Sum of Pending DB Transfers
    const pendingDbQty = activeTransfersCache
        .filter(t => t.productID === productID && t.fromSite === siteName)
        .reduce((sum, t) => sum + t.qty, 0);

    // 2. Sum of Current Batch Buffer (items waiting to be saved)
    const batchBufferQty = multiItemBuffer
        .filter(t => t.productID === productID) // Batch assumes same source for all
        .reduce((sum, t) => sum + t.qty, 0);

    // 3. Real Available
    const realAvailable = dbStockQty - pendingDbQty - batchBufferQty;

    return realAvailable > 0 ? realAvailable : 0;
}

// --- NEW: MANUAL REFRESH FUNCTION ---
async function manualRefreshStockData() {
    const icon = document.getElementById('tf-refresh-stock-btn');
    if(icon) icon.classList.add('fa-spin'); // Spin animation

    // 1. Re-fetch Pending Transfers
    await fetchActiveTransfers();

    // 2. Re-populate Dropdowns (which triggers re-calculation)
    await initTransferDropdowns();

    if(icon) icon.classList.remove('fa-spin');

    // Optional: Visual confirmation
    const label = icon ? icon.closest('label') : null;
    if(label) {
        icon.style.color = "#00748C";
        setTimeout(() => { icon.style.color = "#28a745"; }, 500);
    }
}

// ==========================================================================
// 1.2 MULTI-ITEM LOGIC
// ==========================================================================
window.toggleTransferMode = function(mode) {
    isMultiMode = (mode === 'multi');
    const addBtn = document.getElementById('tf-add-to-list-btn');
    const listContainer = document.getElementById('tf-multi-list-container');
    const saveBtn = document.getElementById('tf-save-btn');

    if (isMultiMode) {
        if(addBtn) addBtn.classList.remove('hidden');
        if(listContainer) listContainer.classList.remove('hidden');
        if(saveBtn) saveBtn.textContent = "Save All Items";
        multiItemBuffer = [];
        renderBatchTable();
    } else {
        if(addBtn) addBtn.classList.add('hidden');
        if(listContainer) listContainer.classList.add('hidden');
        if(saveBtn) saveBtn.textContent = "Save Transaction";
    }
};

function addItemToBatch() {
    const productID = (transferProductChoices ? transferProductChoices.getValue(true) : document.getElementById('tf-product-select').value) || '';
    const productName = document.getElementById('tf-product-name').value;
    const details = document.getElementById('tf-details').value;
    const qty = parseFloat(document.getElementById('tf-req-qty').value);
    const fromSite = (tfFromSiteChoices ? tfFromSiteChoices.getValue(true) : document.getElementById('tf-from').value);

    if (!productID || !productName) { alert("Please select a product."); return; }
    if (!qty || qty <= 0) { alert("Please enter a valid quantity."); return; }

    // --- RE-VALIDATE STOCK BEFORE ADDING ---
    const selectedOption = tfFromSiteChoices._store.choices.find(c => c.value === fromSite);
    let limit = 999999;
    if (selectedOption && selectedOption.label) {
        const match = selectedOption.label.match(/\(Avail: (\d+(\.\d+)?)\)/);
        if (match) limit = parseFloat(match[1]);
    }

    if (qty > limit) {
        alert(`Error: You requested ${qty}, but only ${limit} is available (considering pending tasks).`);
        return;
    }

    // Check Duplicate & Merge
    const existingIndex = multiItemBuffer.findIndex(item => item.productID === productID);

    if (existingIndex > -1) {
        const newTotal = multiItemBuffer[existingIndex].qty + qty;
        if (newTotal > limit) {
             alert(`Error: Adding ${qty} would exceed available stock of ${limit}.`);
             return;
        }
        multiItemBuffer[existingIndex].qty = newTotal;
    } else {
        multiItemBuffer.push({ productID, productName, details, qty });
    }

    if(transferProductChoices) transferProductChoices.removeActiveItems();
    document.getElementById('tf-product-name').value = '';
    document.getElementById('tf-details').value = '';
    document.getElementById('tf-req-qty').value = '';

    renderBatchTable();
}

function renderBatchTable() {
    const tbody = document.getElementById('tf-batch-table-body');
    const countSpan = document.getElementById('tf-batch-count');
    if(!tbody) return;

    tbody.innerHTML = '';
    if(countSpan) countSpan.textContent = multiItemBuffer.length;

    multiItemBuffer.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${item.productName}</strong><br><span style="font-size:0.8em; color:#666;">${item.productID}</span></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${item.qty}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;"><button type="button" class="delete-btn" onclick="removeItemFromBatch(${index})" style="padding: 2px 8px; font-size: 0.8rem; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">&times;</button></td>
        `;
        tbody.appendChild(row);
    });
}

window.removeItemFromBatch = function(index) {
    multiItemBuffer.splice(index, 1);
    renderBatchTable();
};

// ==========================================================================
// 2. APPROVAL LOGIC
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
// 3. HANDLE ACTION CLICK (FIXED: Receiver Stock Update)
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

        // --- CRITICAL FIX: Ensure Site Names are Strings ---
        const destSite = String(task.toLocation || task.toSite || '');
        const sourceSite = String(task.fromLocation || task.fromSite || '');
        const pID = task.productID || task.productId;
        const jobType = (task.jobType || task.for || '').trim();

        let updates = { note: note, dateResponded: formatDate(new Date()) };

        if (status === 'Rejected') {
            updates.status = 'Rejected';
            updates.remarks = 'Rejected';
            updates.attention = 'Records';
            await commitUpdate(database, key, updates, note);
            return;
        }

       if (status === 'Approved') {
            const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
            const cleanName = currentUser.replace(/Engr\.?\s*/gi, '').trim().toUpperCase().split(' ')[0];
            const generatedESN = `${generateStructuredESN(6, 6)}/${cleanName}`;

            const fromLoc = task.fromLocation || task.fromSite || 'Src';
            const toLoc = task.toLocation || task.toSite || 'Dst';
            let movement = `${fromLoc} > ${toLoc}`;
            if (jobType === 'Usage') movement = `Used at ${fromLoc}`;
            if (jobType === 'Restock') movement = `Restock > ${toLoc}`;

            // ... (Receipt Logic omitted for brevity, it remains same) ...

            // --- WORKFLOW LOGIC ---

            if (jobType === 'Restock') {
                if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                    if (!task.receiver) { alert("Error: No Receiver."); btn.disabled = false; return; }
                    updates.approvedQty = qty; updates.status = 'In Transit'; updates.remarks = 'In Transit'; updates.attention = task.receiver; updates.esn = generatedESN;
                    alert(`Restock Authorized! Sent to Receiver.`);
                    await commitUpdate(database, key, updates, note); return;
                }
                 if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records'; updates.receivedQty = qty; updates.arrivalDate = arrivalDateVal;
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`;

                    // FIX: Ensure destSite exists before updating
                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);

                    alert(`Restock Confirmed! ${qty} Added to Stock.`);
                    await commitUpdate(database, key, updates, note); return;
                }
            }

            if (jobType === 'Usage') {
                if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                    updates.approvedQty = qty; updates.status = 'Pending'; updates.remarks = 'Pending Confirmation'; updates.attention = task.requestor; updates.esn = generatedESN;
                    if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                    alert("Usage Authorized. Stock Reserved (Deducted).");
                    await commitUpdate(database, key, updates, note); return;
                }
                if (task.remarks === 'Pending Confirmation') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records'; updates.receivedQty = qty;
                    const approved = parseFloat(task.approvedQty) || 0;
                    const diff = approved - qty;
                    if (diff > 0 && pID && sourceSite) await updateStockInventory(pID, diff, 'Add', sourceSite);
                    else if (diff < 0) await updateStockInventory(pID, Math.abs(diff), 'Deduct', sourceSite);
                    alert("Usage Closed.");
                    await commitUpdate(database, key, updates, note); return;
                }
            }

            if (jobType === 'Transfer') {
                if (task.remarks === 'Pending Source') {
                    updates.approvedQty = qty; updates.status = 'Pending'; updates.remarks = 'Pending Admin'; updates.attention = task.approver;
                    alert("Source Confirmed.");
                    await commitUpdate(database, key, updates, note); return;
                }
                // FIX: Accept both 'Pending Admin' AND 'Pending'
                if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                    updates.approvedQty = qty; updates.status = 'In Transit'; updates.remarks = 'In Transit'; updates.attention = task.receiver; updates.esn = generatedESN;
                    if (pID && sourceSite) await updateStockInventory(pID, qty, 'Deduct', sourceSite);
                    alert("Transfer Authorized. Stock Deducted from Source.");
                    await commitUpdate(database, key, updates, note); return;
                }
                if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records'; updates.receivedQty = qty; updates.arrivalDate = arrivalDateVal;
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`;

                    // FIX: Ensure destSite exists before updating
                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);

                    alert("Transfer Received.");
                    await commitUpdate(database, key, updates, note); return;
                }
            }

            if (jobType === 'Return') {
                if (task.remarks === 'Pending Admin') {
                    updates.approvedQty = qty; updates.esn = generatedESN;
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
                    await commitUpdate(database, key, updates, note); return;
                }
                if (task.remarks === 'In Transit') {
                    updates.status = 'Completed'; updates.remarks = 'Completed'; updates.attention = 'Records'; updates.receivedQty = qty;
                    updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`;

                    // FIX: Ensure destSite exists before updating
                    if (pID && destSite) await updateStockInventory(pID, qty, 'Add', destSite);

                    alert("Return Received.");
                    await commitUpdate(database, key, updates, note); return;
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
    const historyEntry = { action: (updates.remarks || updates.status), by: (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'Unknown'), timestamp: Date.now(), note: note || '' };
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
// 5. SAVE ENTRY (BATCH SAVING)
// ==========================================================================
async function saveTransferEntry(e) {
    if(e) e.preventDefault();
    const btn = document.getElementById('tf-save-btn');
    btn.disabled = true; btn.textContent = "Saving...";

    const fromLoc = (tfFromSiteChoices ? tfFromSiteChoices.getValue(true) : document.getElementById('tf-from').value) || '';
    const toLoc = (tfToSiteChoices ? tfToSiteChoices.getValue(true) : document.getElementById('tf-to').value) || '';
    const sourceContact = (tfSourceContactChoices ? tfSourceContactChoices.getValue(true) : document.getElementById('tf-source-contact').value) || '';
    const approver = (tfApproverChoices ? tfApproverChoices.getValue(true) : document.getElementById('tf-approver').value) || '';
    const receiver = (tfReceiverChoices ? tfReceiverChoices.getValue(true) : document.getElementById('tf-receiver').value) || '';
    const shippingDate = document.getElementById('tf-shipping-date').value;
    const type = document.getElementById('tf-job-type').value;
    const controlNo = document.getElementById('tf-control-no').value;

    if (type === 'Usage' || type === 'Return') {
        if (!fromLoc || !approver) { alert("Please fill in: Source Site and Approver."); btn.disabled = false; btn.textContent = isMultiMode ? "Save All Items" : "Save Transaction"; return; }
    } else if (type === 'Restock') {
        if (!toLoc || !approver || !receiver) { alert("Restock req: Destination, Approver, Receiver."); btn.disabled = false; btn.textContent = isMultiMode ? "Save All Items" : "Save Transaction"; return; }
    } else {
        if (!fromLoc || !toLoc || !sourceContact || !approver || !receiver) { alert("Please fill in ALL fields."); btn.disabled = false; btn.textContent = isMultiMode ? "Save All Items" : "Save Transaction"; return; }
    }

    const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
    let startStatus = 'Pending';
    let startRemarks = 'Pending';
    let startAttention = '';

    if (type === 'Transfer') { startRemarks = 'Pending Source'; startAttention = sourceContact; }
    else { startRemarks = 'Pending Admin'; startAttention = approver; }

    const database = (typeof db !== 'undefined') ? db : firebase.database();

    let itemsToSave = [];
    if (isMultiMode) {
        if (multiItemBuffer.length === 0) { alert("Please add at least one item to the batch list."); btn.disabled = false; btn.textContent = "Save All Items"; return; }
        itemsToSave = multiItemBuffer;
    } else {
        const pID = (transferProductChoices ? transferProductChoices.getValue(true) : document.getElementById('tf-product-select').value) || '';
        const pName = document.getElementById('tf-product-name').value;
        const qty = parseFloat(document.getElementById('tf-req-qty').value);
        if (!pID || !qty) { alert("Please select a product and quantity."); btn.disabled = false; btn.textContent = "Save Transaction"; return; }
        itemsToSave.push({ productID: pID, productName: pName, details: document.getElementById('tf-details').value, qty: qty });
    }

    try {
        const promises = itemsToSave.map(item => {
            const entryData = {
                controlNumber: controlNo, // Same ID for all items
                jobType: type, for: type,
                productID: item.productID, productName: item.productName, details: item.details, requiredQty: item.qty, orderedQty: item.qty,
                requestor: document.getElementById('tf-requestor').value, sourceContact: sourceContact, approver: approver, receiver: receiver || '',
                fromLocation: fromLoc, fromSite: fromLoc, toLocation: toLoc, toSite: toLoc, shippingDate: shippingDate,
                status: startStatus, remarks: startRemarks, attention: startAttention,
                timestamp: firebase.database.ServerValue.TIMESTAMP, enteredBy: currentUser,
                history: [{ action: "Created", by: currentUser, timestamp: Date.now(), status: startStatus, remarks: startRemarks }]
            };
            return database.ref('transfer_entries').push(entryData);
        });

        await Promise.all(promises);

        alert(isMultiMode ? `Batch of ${itemsToSave.length} items saved!` : "Transaction Saved!");
        document.getElementById('transfer-job-modal').classList.add('hidden');
        if(typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(true);
        if(typeof populateActiveTasks === 'function') await populateActiveTasks();

    } catch (e) { console.error(e); alert("Error saving."); }
    finally { btn.disabled = false; btn.textContent = isMultiMode ? "Save All Items" : "Save Transaction"; }
}

// ==========================================================================
// 6. PRINT LOGIC (UPDATED - Batch Print Support)
// ==========================================================================
window.handlePrintWaybill = async function(entry) {
    const database = (typeof db !== 'undefined') ? db : firebase.database();

    const controlNo = entry.controlNumber || entry.controlId || entry.ref;

    let batchItems = [];
    try {
        let snap = await database.ref('transfer_entries').orderByChild('controlNumber').equalTo(controlNo).once('value');
        if (!snap.exists()) snap = await database.ref('transfer_entries').orderByChild('ref').equalTo(controlNo).once('value');

        if (snap.exists()) {
            batchItems = Object.values(snap.val());
        } else {
            batchItems = [entry];
        }
    } catch(e) {
        console.warn("Fetch failed, using single:", e);
        batchItems = [entry];
    }

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

    const primary = batchItems[0];
    const date = formatYYYYMMDD(primary.shippingDate);
    const controlId = primary.controlNumber || primary.ref;
    const fromSite = getFullSiteName(primary.fromSite || primary.fromLocation);
    const toSite = getFullSiteName(primary.toSite || primary.toLocation);
    const requestor = primary.requestor || '-';
    const receiver = primary.receiver || '-';

    const printDate = new Date().toLocaleString();
    const isApproved = ['In Transit', 'Approved', 'Completed', 'Received'].includes(primary.remarks);
    const isCompleted = ['Completed', 'Received'].includes(primary.remarks);
    const isRejected = (primary.remarks === 'Rejected');

    let title = isApproved ? "TRANSFER SLIP" : "DRAFT REQUEST";
    let badgeText = isApproved ? "AUTHORIZED" : "PENDING APPROVAL";
    let badgeColor = isApproved ? "#00748C" : "#dc3545";

    if(isCompleted) { badgeText = "COMPLETED"; badgeColor = "#28a745"; }

    if(isRejected) {
        title = "TRANSFER SLIP (VOID)";
        badgeText = "REJECTED";
        badgeColor = "#D32F2F";
    }

    let tableRows = '';
    batchItems.forEach(item => {
        let displayQty = item.orderedQty;
        if (item.remarks === 'Completed') displayQty = item.receivedQty;
        else if (item.remarks === 'In Transit') displayQty = item.approvedQty;

        const prodId = item.productId || item.productID;
        const prodName = item.productName;
        const details = item.details || '';

        tableRows += `
            <tr>
                <td style="border-right:1px solid #000; padding:10px; border-top:1px solid #000;">${prodId}</td>
                <td style="border-right:1px solid #000; padding:10px; border-top:1px solid #000; font-weight:bold;">${prodName}</td>
                <td style="border-right:1px solid #000; padding:10px; border-top:1px solid #000;">${details}</td>
                <td style="padding:10px; border-top:1px solid #000; font-weight:bold; text-align:right;">${displayQty}</td>
            </tr>
        `;
    });

    let approverSectionHTML = '';
    if(isApproved) {
        let esnString = primary.esn || ((primary.controlNumber || primary.ref) + "/APP");
        const barcodeSrc = generateBarcodeSrc(esnString);
        approverSectionHTML = `<div style="text-align: center;"><img src="${barcodeSrc}" style="width: 80%; height: 50px; object-fit: contain;"><div style="font-size: 10px; font-family: monospace; font-weight: bold; margin-top: 2px; color: black;"><div>${esnString}</div></div></div>`;
    }
    else if (isRejected) {
        approverSectionHTML = `<div style="text-align: center; padding: 15px;"><div style="display: inline-block; border: 3px solid #D32F2F; color: #D32F2F; font-weight: bold; font-size: 18px; padding: 5px 15px; text-transform: uppercase; transform: rotate(-5deg); opacity: 0.8;">REJECTED</div><div style="font-size: 10px; margin-top: 5px; color: #555;">No Deduction Made</div></div>`;
    }
    else {
        approverSectionHTML = `<div style="text-align: center; font-weight: bold; color: #dc3545; padding: 20px;">PENDING APPROVAL</div>`;
    }

    let receiverSectionHTML = '';
    if(isCompleted) {
        if(primary.jobType !== 'Usage' && primary.jobType !== 'Return') {
            let recString = primary.receiverEsn || ((primary.controlNumber || primary.ref) + "/REC");
            const barcodeSrc = generateBarcodeSrc(recString);
            receiverSectionHTML = `<img src="${barcodeSrc}" style="width: 80%; height: 50px; margin: 0 auto; object-fit: contain; display: block;"><div style="font-size: 12px; font-weight: bold; font-family: monospace; margin-top: 5px; color: black;"><div>${recString}</div></div>`;
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
            @media print { @page { margin: 0.5cm; size: auto; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
    </head>
    <body>
        <div class="header">
            <div style="display: flex; align-items: center;">
                <div class="logo">IBA</div>
                <div><h2 class="doc-title">${title}</h2><p style="margin: 5px 0 0 0; font-size: 11px; color: #555;">Ismail Bin Ali Tradg. & Cont. Co. W.L.L</p></div>
            </div>
            <div style="border: 2px solid #000; padding: 5px 15px; font-weight: bold; font-size: 16px; color: ${badgeColor}; border-color: ${badgeColor};">${badgeText}</div>
        </div>
        <div class="grid-container">
            <div class="border-right">
                <div class="grid-item border-bottom"><div class="label-box">1. FROM</div><div style="margin-bottom: 8px;"><strong style="font-size: 14px;">${fromSite}</strong></div><div style="font-size: 12px;"><span style="color: #666; font-size: 10px;">By:</span> ${requestor}</div></div>
                <div class="grid-item"><div class="label-box">2. TO</div><div style="margin-bottom: 8px;"><strong style="font-size: 14px;">${toSite}</strong></div><div style="font-size: 12px;"><span style="color: #666; font-size: 10px;">Contact:</span> ${receiver}</div></div>
            </div>
            <div>
                <div class="grid-item border-bottom"><div class="label-box">3. DETAILS</div><div style="display: flex; justify-content: space-between;"><div><span style="font-size: 10px; color: #666;">Date</span><br><strong>${date}</strong></div><div><span style="font-size: 10px; color: #666;">Control ID</span><br><strong>${controlId}</strong></div></div></div>
                <div class="grid-item"><div class="label-box">4. APPROVAL</div>${approverSectionHTML}</div>
            </div>
        </div>
        <div style="margin-top: 20px; border: 2px solid #000;">
            <div class="yellow-header">5. ITEM DESCRIPTION</div>
            <table><thead><tr><th>ID</th><th>Name</th><th>Details</th><th style="border-right: none;">Qty</th></tr></thead><tbody>
                ${tableRows}
            </tbody></table>
        </div>
        <div class="footer-grid">
            <div class="footer-box"><div style="font-size: 9px; font-weight: bold; color: #003A5C; margin-bottom: 10px;">FINAL VERIFICATION / RECEIPT</div>${receiverSectionHTML}</div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-around;"><div><div class="signature-line"></div><div style="font-size: 10px; font-weight: bold;">Sender Signature</div></div><div><div class="signature-line"></div><div style="font-size: 10px; font-weight: bold;">Receiver Signature</div></div></div>
        </div>
        <div style="text-align: center; font-size: 9px; margin-top: 20px; color: #777;">Printed: ${printDate}</div>
    </body>
    </html>`;

    const oldFrame = document.getElementById('waybill-print-frame');
    if (oldFrame) oldFrame.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'waybill-print-frame';
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(htmlContent); doc.close();
    iframe.onload = function() { setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 500); };
};

// ==========================================================================
// 7. HELPERS & DROPDOWNS (UNCHANGED)
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

    // Product Select
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

    const opts = { searchEnabled: true, itemSelectText: '' };
    if (!tfApproverChoices) tfApproverChoices = new Choices(document.getElementById('tf-approver'), opts);
    if (!tfReceiverChoices) tfReceiverChoices = new Choices(document.getElementById('tf-receiver'), opts);
    if (!tfSourceContactChoices) tfSourceContactChoices = new Choices(document.getElementById('tf-source-contact'), opts);

    let rawData = null;
    if (typeof allApproverData !== 'undefined' && allApproverData) { rawData = allApproverData; }
    else { try { const snap = await database.ref('approvers').once('value'); rawData = snap.val(); } catch(e) {} }

    if (rawData) {
        const allUsers = Object.values(rawData);
        const adminList = allUsers.filter(u => (u.Role || '').toLowerCase() === 'admin').map(u => ({ value: u.Name, label: `${u.Name} - ${u.Position||''} (Admin)` }));
        const fullList = allUsers.map(u => ({ value: u.Name, label: `${u.Name} - ${u.Position||''}` }));

        tfApproverChoices.setChoices(adminList, 'value', 'label', true);
        tfReceiverChoices.setChoices(fullList, 'value', 'label', true);
        tfSourceContactChoices.setChoices(fullList, 'value', 'label', true);
    }

    let sitesData = [];
    if (typeof allSitesCache !== 'undefined' && allSitesCache && allSitesCache.length > 0) { sitesData = allSitesCache; }
    else {
        try {
            const res = await fetch("https://cdn.jsdelivr.net/gh/DC-database/Hub@main/Site.csv");
            const txt = await res.text();
            const lines = txt.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length >= 2) sitesData.push({ value: cols[0].replace(/"/g,'').trim(), label: `${cols[0].replace(/"/g,'').trim()} - ${cols[1].replace(/"/g,'').trim()}` });
            }
        } catch(e) {}
    }
    if(sitesData.length > 0) {
        sitesData.sort((a, b) => parseInt(a.value) - parseInt(b.value));
        tfToSiteChoices.setChoices(sitesData, 'value', 'label', true);
        tfFromSiteChoices.setChoices(sitesData, 'value', 'label', true);
    }
}

// --- UPDATED TO USE REAL AVAILABLE ---
function updateFromSiteOptions(sitesData) {
    if (!tfFromSiteChoices) return;
    tfFromSiteChoices.clearStore(); tfFromSiteChoices.clearInput();
    const currentJobType = document.getElementById('tf-job-type').value;

    // Get selected product ID to check pending transfers
    const productID = (transferProductChoices ? transferProductChoices.getValue(true) : '');

    const newChoices = [];
    if (sitesData) {
        Object.entries(sitesData).forEach(([site, qty]) => {
            // 1. Calculate Real Available (Total - Pending - Batch)
            const realAvailable = calculateRealAvailable(productID, site, parseFloat(qty));

            // 2. Only add to dropdown if Real Available > 0
            if (realAvailable > 0) {
                newChoices.push({
                    value: site,
                    label: `${site} (Avail: ${realAvailable})`
                });
            }
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

// ==========================================================================
// 8. INITIATE RETURN (RESTORED from User's Code)
// ==========================================================================
window.initiateReturn = function(transferKey) {
    // Note: Ensure allTransferData is available, usually populated by materialStock.js or app.js
    // If running standalone test, this might need a fetch. But in full app context, it should be fine.
    // Or we can fetch it direct:

    const database = (typeof db !== 'undefined') ? db : firebase.database();
    database.ref(`transfer_entries/${transferKey}`).once('value').then(snap => {
        const originalTask = snap.val();
        if (!originalTask) {
            alert("Error: Original transaction data not found.");
            return;
        }

        // Trigger the modal
        openTransferModal('Return');

        // Pre-fill data after a short delay to allow dropdowns to init
        setTimeout(() => {
            if (transferProductChoices) {
                transferProductChoices.setChoiceByValue(originalTask.productID || originalTask.productId);
            }
            document.getElementById('tf-product-name').value = originalTask.productName;
            document.getElementById('tf-details').value = `Return of: ${originalTask.controlNumber || originalTask.ref}`;
            document.getElementById('tf-req-qty').value = originalTask.receivedQty || 0;

            const returnFrom = originalTask.toSite || originalTask.toLocation;
            const returnTo = originalTask.fromSite || originalTask.fromLocation;

            if (tfFromSiteChoices) tfFromSiteChoices.setChoiceByValue(returnFrom);
            if (tfToSiteChoices) tfToSiteChoices.setChoiceByValue(returnTo);

            // Scroll to top
            const modalContent = document.querySelector('#transfer-job-modal .modal-content');
            if(modalContent) modalContent.scrollTop = 0;
        }, 500);
    });
};

// Events
document.addEventListener('DOMContentLoaded', () => {
    const sBtn = document.getElementById('tf-save-btn');
    if(sBtn) sBtn.onclick = saveTransferEntry;

    const appBtn = document.getElementById('transfer-modal-approve-btn');
    if(appBtn) appBtn.addEventListener('click', () => handleTransferAction('Approved'));

    const rejBtn = document.getElementById('transfer-modal-reject-btn');
    if(rejBtn) rejBtn.addEventListener('click', () => handleTransferAction('Rejected'));

    // --- NEW: Event Listener for Add to Batch Button ---
    const addListBtn = document.getElementById('tf-add-to-list-btn');
    if(addListBtn) addListBtn.onclick = addItemToBatch;

    // --- NEW: Event Listener for Manual Refresh Button ---
    const refreshBtn = document.getElementById('tf-refresh-stock-btn');
    if(refreshBtn) refreshBtn.onclick = manualRefreshStockData;
});
