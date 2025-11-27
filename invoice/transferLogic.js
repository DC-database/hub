// ==========================================================================
// TRANSFER LOGIC: ROBUST CHAIN (Source -> Admin -> Receiver)
// ==========================================================================

let currentTransferType = '';
let transferProductChoices = null;
let editingTransferData = null;

// Dropdown Instances
let tfFromSiteChoices = null, tfToSiteChoices = null;
let tfApproverChoices = null, tfReceiverChoices = null, tfSourceContactChoices = null;

// --- 1. Open Modal (New) ---
async function openTransferModal(type) {
    currentTransferType = type;
    editingTransferData = null;
    document.getElementById('transfer-job-form').reset();
    document.getElementById('tf-job-type').value = type;
    
    if (typeof currentApprover !== 'undefined' && currentApprover) {
        document.getElementById('tf-requestor').value = currentApprover.Name;
        // Default Receiver to me, but allow change
        if(tfReceiverChoices) tfReceiverChoices.setChoiceByValue(currentApprover.Name);
    }

    document.getElementById('tf-shipping-date').value = new Date().toISOString().split('T')[0];
    
    await initTransferDropdowns(); 
    await generateSequentialTransferId(type);

    document.getElementById('tf-status').closest('.form-group').style.display = 'none';
    highlightSenderFields(true);
    updateFieldLocks('Requestor'); 
    document.getElementById('transfer-job-modal').classList.remove('hidden');
}

// --- 2. Load for Edit/View ---
window.loadTransferForEdit = async function(entry) {
    editingTransferData = entry;
    document.getElementById('transfer-job-form').reset();
    document.getElementById('tf-job-type').value = entry.jobType || 'Transfer';
    document.getElementById('tf-control-no').value = entry.controlNumber;

    await initTransferDropdowns();

    // Populate Fields
    if(transferProductChoices) transferProductChoices.setChoiceByValue(entry.productID);
    document.getElementById('tf-product-name').value = entry.productName || '';
    document.getElementById('tf-details').value = entry.details || '';
    document.getElementById('tf-requestor').value = entry.requestor || '';
    
    // Set People
    if(tfApproverChoices) tfApproverChoices.setChoiceByValue(entry.approver || '');
    if(tfReceiverChoices) tfReceiverChoices.setChoiceByValue(entry.receiver || '');
    if(tfSourceContactChoices) tfSourceContactChoices.setChoiceByValue(entry.sourceContact || '');
    
    // Set Sites
    if(tfFromSiteChoices) tfFromSiteChoices.setChoiceByValue(entry.fromLocation || '');
    if(tfToSiteChoices) tfToSiteChoices.setChoiceByValue(entry.toLocation || '');

    // Set Qtys & Dates
    document.getElementById('tf-req-qty').value = entry.requiredQty || '';
    document.getElementById('tf-app-qty').value = entry.approvedQty || ''; 
    document.getElementById('tf-rec-qty').value = entry.receivedQty || '';
    document.getElementById('tf-shipping-date').value = entry.shippingDate || '';
    document.getElementById('tf-arrival-date').value = entry.arrivalDate || '';
    document.getElementById('tf-status').value = entry.status || 'Pending';
    document.getElementById('tf-remarks').value = entry.remarks || '';

    document.getElementById('tf-status').closest('.form-group').style.display = 'block';
    highlightSenderFields(false);

    // Determine Mode
    const currentUser = currentApprover ? currentApprover.Name : '';
    let mode = 'View';

    if (entry.remarks === 'Pending Source' && entry.sourceContact === currentUser) {
        mode = 'SourceContact';
    } 
    else if (entry.remarks === 'Pending Admin' && entry.approver === currentUser) {
        mode = 'Approver';
    }
    else if (entry.remarks === 'In Transit' && entry.receiver === currentUser) {
        mode = 'Receiver';
    }

    updateFieldLocks(mode); 
    document.getElementById('transfer-job-modal').classList.remove('hidden');
};

function closeTransferModal() { document.getElementById('transfer-job-modal').classList.add('hidden'); }

// --- 3. FIELD LOCKS ---
function updateFieldLocks(mode) {
    const allInputs = ['tf-req-qty', 'tf-app-qty', 'tf-rec-qty', 'tf-status', 'tf-remarks', 'tf-shipping-date', 'tf-arrival-date'];
    allInputs.forEach(id => document.getElementById(id).disabled = true);
    
    if(transferProductChoices) transferProductChoices.disable();
    if(tfFromSiteChoices) tfFromSiteChoices.disable();
    if(tfToSiteChoices) tfToSiteChoices.disable();
    if(tfApproverChoices) tfApproverChoices.disable();
    if(tfReceiverChoices) tfReceiverChoices.disable();
    if(tfSourceContactChoices) tfSourceContactChoices.disable();

    if (mode === 'Requestor') {
        document.getElementById('tf-req-qty').disabled = false; 
        document.getElementById('tf-remarks').disabled = false;
        document.getElementById('tf-shipping-date').disabled = false;
        
        if(transferProductChoices) transferProductChoices.enable();
        if(tfFromSiteChoices) tfFromSiteChoices.enable();
        if(tfToSiteChoices) tfToSiteChoices.enable();
        if(tfApproverChoices) tfApproverChoices.enable();
        if(tfReceiverChoices) tfReceiverChoices.enable(); 
        if(tfSourceContactChoices) tfSourceContactChoices.enable(); 
    } 
    else if (mode === 'SourceContact') {
        const appQty = document.getElementById('tf-app-qty');
        appQty.disabled = false; 
        appQty.classList.add('highlight-field');
        if(!appQty.value) appQty.value = document.getElementById('tf-req-qty').value;
        document.getElementById('tf-remarks').disabled = false;
    } 
    else if (mode === 'Approver') {
        document.getElementById('tf-remarks').disabled = false;
    } 
    else if (mode === 'Receiver') {
        const recQty = document.getElementById('tf-rec-qty');
        const arrDate = document.getElementById('tf-arrival-date');
        
        recQty.disabled = false;
        arrDate.disabled = false;
        
        recQty.classList.add('highlight-field');
        arrDate.classList.add('highlight-field');
        
        if(!arrDate.value) arrDate.value = new Date().toISOString().split('T')[0];
        if(!recQty.value) recQty.value = document.getElementById('tf-app-qty').value;
        
        document.getElementById('tf-remarks').disabled = false;
    }
}

// --- 4. SAVE ---
async function saveTransferEntry(e) {
    if(e) e.preventDefault(); 
    const btn = document.getElementById('tf-save-btn');
    btn.disabled = true; btn.textContent = "Saving...";

    const fromLoc = tfFromSiteChoices ? tfFromSiteChoices.getValue(true) : document.getElementById('tf-from').value;
    const toLoc = tfToSiteChoices ? tfToSiteChoices.getValue(true) : document.getElementById('tf-to').value;
    const productID = transferProductChoices ? transferProductChoices.getValue(true) : document.getElementById('tf-product-select').value;
    const sourceContact = tfSourceContactChoices ? tfSourceContactChoices.getValue(true) : document.getElementById('tf-source-contact').value;
    const approver = tfApproverChoices ? tfApproverChoices.getValue(true) : document.getElementById('tf-approver').value;
    const receiver = tfReceiverChoices ? tfReceiverChoices.getValue(true) : document.getElementById('tf-receiver').value;
    
    const qty = parseFloat(document.getElementById('tf-req-qty').value) || 0;
    const type = document.getElementById('tf-job-type').value;

    if (!productID || !fromLoc || !toLoc || !sourceContact || !approver || !receiver) {
        alert("Please fill in all fields.");
        btn.disabled = false; btn.textContent = "Save Transaction";
        return;
    }

    let initialStatus = 'Pending Source';
    let initialAttention = sourceContact; 

    if (type !== 'Transfer') {
        initialStatus = 'Pending Admin';
        initialAttention = approver;
    }

    const entryData = {
        controlNumber: document.getElementById('tf-control-no').value,
        jobType: type,
        productID: productID,
        productName: document.getElementById('tf-product-name').value,
        details: document.getElementById('tf-details').value,
        
        requestor: document.getElementById('tf-requestor').value,
        sourceContact: sourceContact,
        approver: approver,
        receiver: receiver,
        
        requiredQty: qty,
        fromLocation: fromLoc,
        toLocation: toLoc,
        shippingDate: document.getElementById('tf-shipping-date').value,
        
        status: initialStatus,
        remarks: initialStatus, 
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        enteredBy: currentApprover.Name,
        
        attention: initialAttention 
    };

    try {
        if (editingTransferData && editingTransferData.key) {
            await db.ref(`transfer_entries/${editingTransferData.key}`).update(entryData);
        } else {
            await db.ref('transfer_entries').push(entryData);
        }
        alert(`Request Sent!\n\nAssigned to: ${initialAttention}\nStatus: ${initialStatus}`);
        closeTransferModal();
        
        if(typeof ensureAllEntriesFetched === 'function') {
            await ensureAllEntriesFetched(true);
            if(typeof populateActiveTasks === 'function') populateActiveTasks();
        }
    } catch (e) { console.error(e); alert("Error saving."); } 
    finally { btn.disabled = false; btn.textContent = "Save Transaction"; }
}

// --- 5. ACTION HANDLER (FIXED: Uses Form Data as Backup) ---
const handleTransferAction = async (action) => {
    const key = document.getElementById('transfer-modal-key').value;
    const appQtyInput = document.getElementById('tf-app-qty');
    const recQtyInput = document.getElementById('tf-rec-qty');
    const arrDateInput = document.getElementById('tf-arrival-date');
    const noteInput = document.getElementById('transfer-modal-note') || document.getElementById('tf-remarks');

    const task = userActiveTasks.find(t => t.key === key) || editingTransferData;
    if (!task) { alert("Task error. Please refresh."); return; }

    // Grab fallback values from the DOM in case task object is stale
    const domApprover = tfApproverChoices ? tfApproverChoices.getValue(true) : document.getElementById('tf-approver').value;
    const domReceiver = tfReceiverChoices ? tfReceiverChoices.getValue(true) : document.getElementById('tf-receiver').value;

    const updates = { note: noteInput.value, dateResponded: new Date().toISOString().split('T')[0] };
    let nextStatus = '';
    let nextAttention = '';

    if (action === 'Rejected') {
        updates.status = 'Rejected';
        updates.remarks = 'Rejected';
        updates.attention = task.requestor;
        await db.ref(`transfer_entries/${key}`).update(updates);
        alert("Request Rejected.");
        location.reload();
        return;
    }

    // 1. Source Contact -> Sends to Admin
    if (task.remarks === 'Pending Source') {
        const confirmedQty = parseFloat(appQtyInput.value);
        if (isNaN(confirmedQty) || confirmedQty <= 0) { alert("Please enter Confirmed Qty."); return; }
        
        nextStatus = 'Pending Admin';
        
        // FIX: Use DOM value if task property is missing
        nextAttention = task.approver || domApprover; 
        
        updates.approvedQty = confirmedQty; 
        alert(`Source Confirmed! Sending to Admin: ${nextAttention}`);
    }
    
    // 2. Admin -> Sends to Receiver
    else if (task.remarks === 'Pending Admin') {
        const digits = Math.floor(100000 + Math.random() * 900000);
        updates.esn = `${digits}/${currentApprover.Name}`;
        
        nextStatus = 'In Transit';
        
        // FIX: Use DOM value if task property is missing
        nextAttention = task.receiver || domReceiver; 
        
        alert(`Authorized! Sending to Receiver: ${nextAttention}`);
    }
    
    // 3. Receiver -> Completed
    else if (task.remarks === 'In Transit') {
        const finalQty = parseFloat(recQtyInput.value);
        const arrivalDate = arrDateInput.value;
        
        if (isNaN(finalQty) || finalQty <= 0) { alert("Please confirm Qty."); return; }
        if (!arrivalDate) { alert("Please enter Arrival Date."); return; }

        const digits = Math.floor(1000 + Math.random() * 9000);
        updates.receiverEsn = `${digits}/${currentApprover.Name}`;
        updates.arrivalDate = arrivalDate;
        updates.receivedQty = finalQty;
        
        nextStatus = 'Completed';
        nextAttention = 'Records';
        
        const pID = task.productID || task.productId;
        const fromSite = task.fromLocation || task.fromSite;
        const toSite = task.toLocation || task.toSite;
        
        if (pID) await updateStockInventory(pID, finalQty, task.jobType || 'Transfer', fromSite, toSite);
        alert("Received! Stock Updated.");
    }

    updates.status = nextStatus;
    updates.remarks = nextStatus;
    updates.attention = nextAttention;

    // Safety Check
    if (!nextAttention) {
        alert("Error: Cannot determine who to send this task to. Please check if 'Approver' or 'Receiver' is set in the form.");
        return;
    }

    await db.ref(`transfer_entries/${key}`).update(updates);
    document.getElementById('transfer-approval-modal').classList.add('hidden');
    document.getElementById('transfer-job-modal').classList.add('hidden');
    location.reload();
};

// --- 6. STOCK UPDATE ---
async function updateStockInventory(id, qty, type, fromSite, toSite) {
    if (!id || !qty) return;
    try {
        let snap = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
        if (!snap.exists()) snap = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
        
        if (snap.exists()) {
            const data = snap.val();
            const key = Object.keys(data)[0];
            const item = data[key];
            let sites = item.sites || {};
            let amount = parseFloat(qty);
            
            if (!sites[fromSite]) sites[fromSite] = 0;
            if (!sites[toSite]) sites[toSite] = 0;

            if (type === 'Transfer') {
                sites[fromSite] = parseFloat(sites[fromSite]) - amount;
                sites[toSite] = parseFloat(sites[toSite]) + amount;
                if(sites[fromSite] < 0) sites[fromSite] = 0; 
            } else if (type === 'Restock') {
                sites[toSite] = parseFloat(sites[toSite]) + amount;
            } else if (type === 'Return') {
                sites[fromSite] = parseFloat(sites[fromSite]) - amount;
                sites[toSite] = parseFloat(sites[toSite]) + amount;
                if(sites[fromSite] < 0) sites[fromSite] = 0;
            }

            let globalTotal = 0;
            Object.values(sites).forEach(v => globalTotal += parseFloat(v));

            await db.ref(`material_stock/${key}`).update({
                sites: sites,
                stockQty: globalTotal,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
        }
    } catch (e) { console.error("Stock update failed", e); }
}

// --- Helpers ---
async function initTransferDropdowns() {
    await initTransferProductDropdown();
    await initTransferSiteDropdowns();
    await initTransferApproverDropdowns();
}

async function initTransferProductDropdown() {
    const selectElement = document.getElementById('tf-product-select');
    if (transferProductChoices) { transferProductChoices.removeActiveItems(); return; }
    transferProductChoices = new Choices(selectElement, { searchEnabled: true, itemSelectText: '', placeholder: true, placeholderValue: 'Type ID or Name...', shouldSort: false });
    try {
        const snapshot = await db.ref('material_stock').once('value');
        const data = snapshot.val();
        if (data) {
            const choices = Object.values(data).map(item => ({
                value: item.productID,
                label: `${item.productID} - ${item.productName}`,
                customProperties: { name: item.productName, details: item.details, sites: item.sites }
            }));
            transferProductChoices.setChoices(choices, 'value', 'label', true);
        }
    } catch (error) { console.error("Error loading products:", error); }
    selectElement.addEventListener('change', (e) => {
        const val = transferProductChoices.getValue(true);
        const item = transferProductChoices._store.choices.find(c => c.value === val);
        if (item && item.customProperties) {
            document.getElementById('tf-product-name').value = item.customProperties.name;
            document.getElementById('tf-details').value = item.customProperties.details;
            updateFromSiteOptions(item.customProperties.sites);
        }
    });
}

function updateFromSiteOptions(sitesData) {
    if (!tfFromSiteChoices) return;
    tfFromSiteChoices.clearStore();
    tfFromSiteChoices.clearInput();
    const currentJobType = document.getElementById('tf-job-type').value;
    if (currentJobType === 'Restock') {
        if (typeof allSitesCache !== 'undefined') tfFromSiteChoices.setChoices(allSitesCache, 'value', 'label', true);
        return;
    }
    const newChoices = [];
    if (sitesData) {
        Object.entries(sitesData).forEach(([site, qty]) => {
            const q = parseFloat(qty);
            if (q > 0) newChoices.push({ value: site, label: `${site} (Avail: ${q})` });
        });
    }
    if (newChoices.length > 0) tfFromSiteChoices.setChoices(newChoices, 'value', 'label', true);
    else tfFromSiteChoices.setChoices([{ value: '', label: 'No stock available', disabled: true, selected: true }], 'value', 'label', true);
}

async function initTransferSiteDropdowns() {
    if (!tfFromSiteChoices) tfFromSiteChoices = new Choices(document.getElementById('tf-from'), { searchEnabled: true, itemSelectText: '', placeholder: true, placeholderValue: 'Select Source' });
    if (!tfToSiteChoices) tfToSiteChoices = new Choices(document.getElementById('tf-to'), { searchEnabled: true, itemSelectText: '', placeholder: true, placeholderValue: 'Select Destination' });
    if (typeof allSitesCache !== 'undefined') {
        tfToSiteChoices.setChoices(allSitesCache, 'value', 'label', true);
        tfFromSiteChoices.setChoices(allSitesCache, 'value', 'label', true);
    }
}

async function initTransferApproverDropdowns() {
    const opts = { searchEnabled: true, itemSelectText: '', placeholder: true };
    if (!tfApproverChoices) tfApproverChoices = new Choices(document.getElementById('tf-approver'), { ...opts, placeholderValue: 'Select Admin Approver' });
    if (!tfReceiverChoices) tfReceiverChoices = new Choices(document.getElementById('tf-receiver'), { ...opts, placeholderValue: 'Select Receiver' });
    if (!tfSourceContactChoices) tfSourceContactChoices = new Choices(document.getElementById('tf-source-contact'), { ...opts, placeholderValue: 'Select Source Contact' }); 

    if (typeof allApproversCache !== 'undefined') {
        const choices = allApproversCache;
        tfApproverChoices.setChoices(choices, 'value', 'label', true);
        tfReceiverChoices.setChoices(choices, 'value', 'label', true);
        tfSourceContactChoices.setChoices(choices, 'value', 'label', true);
    }
}

function highlightSenderFields(isActive) {
    const ids = ['tf-from', 'tf-to', 'tf-req-qty', 'tf-shipping-date', 'tf-approver', 'tf-receiver', 'tf-source-contact'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) isActive ? el.classList.add('sender-required') : el.classList.remove('sender-required');
    });
    document.querySelectorAll('.choices__inner').forEach(c => isActive ? c.classList.add('sender-required') : c.classList.remove('sender-required'));
}

async function generateSequentialTransferId(type) {
    const prefix = (type === 'Transfer' ? 'TRF' : (type === 'Restock' ? 'STK' : 'RET'));
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

// Listeners
document.addEventListener('DOMContentLoaded', () => {
    const sBtn = document.getElementById('tf-save-btn');
    if(sBtn) sBtn.addEventListener('click', saveTransferEntry);
    
    const printBtn = document.getElementById('tf-print-btn');
    if(printBtn) printBtn.addEventListener('click', () => handlePrintWaybill(null));
    
    const appBtn = document.getElementById('transfer-modal-approve-btn');
    if(appBtn) {
        const clone = appBtn.cloneNode(true); appBtn.parentNode.replaceChild(clone, appBtn);
        clone.addEventListener('click', () => handleTransferAction('Approved'));
    }
    const rejBtn = document.getElementById('transfer-modal-reject-btn');
    if(rejBtn) {
        const clone = rejBtn.cloneNode(true); rejBtn.parentNode.replaceChild(clone, rejBtn);
        clone.addEventListener('click', () => handleTransferAction('Rejected'));
    }
    
    // FIX: POPULATE DATA ON TABLE CLICK TO ENSURE DROPDOWNS ARE FILLED
    document.body.addEventListener('click', async (e) => {
        if(e.target.classList.contains('transfer-action-btn')) {
            const key = e.target.dataset.key;
            const task = userActiveTasks.find(t => t.key === key);
            if(task) {
                document.getElementById('transfer-modal-key').value = key;
                document.getElementById('transfer-modal-note').value = task.note || '';
                
                // CRITICAL: Initialize Dropdowns FIRST so DOM logic works
                await initTransferDropdowns();
                
                // Set hidden fields to support fallback logic
                if(tfApproverChoices) tfApproverChoices.setChoiceByValue(task.approver);
                if(tfReceiverChoices) tfReceiverChoices.setChoiceByValue(task.receiver);
                
                const modalQty = document.getElementById('transfer-modal-qty');
                const modalDateCont = document.getElementById('transfer-modal-date-container');
                const modalDate = document.getElementById('transfer-modal-date');
                const btnText = document.getElementById('transfer-modal-approve-btn');
                const title = document.getElementById('transfer-modal-title');
                
                modalQty.disabled = true;
                modalDateCont.classList.add('hidden');
                
                if (task.remarks === 'Pending Source') {
                    title.textContent = "Source Confirmation";
                    btnText.textContent = "Confirm Availability";
                    btnText.style.backgroundColor = "#17a2b8"; 
                    modalQty.disabled = false; 
                    modalQty.value = task.requiredQty || 0;
                } 
                else if (task.remarks === 'Pending Admin') {
                    title.textContent = "Admin Authorization";
                    btnText.textContent = "Authorize Transfer";
                    btnText.style.backgroundColor = "#28a745"; 
                    modalQty.value = task.approvedQty || task.requiredQty; 
                } 
                else if (task.remarks === 'In Transit') {
                    title.textContent = "Final Receipt";
                    btnText.textContent = "Confirm Receipt";
                    btnText.style.backgroundColor = "#003A5C"; 
                    modalDateCont.classList.remove('hidden'); 
                    modalDate.value = new Date().toISOString().split('T')[0];
                    modalQty.value = task.approvedQty; 
                }
                
                document.getElementById('transfer-approval-modal').classList.remove('hidden');
            }
        }
    });
});