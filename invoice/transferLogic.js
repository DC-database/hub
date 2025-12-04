// ==========================================================================
// TRANSFER LOGIC: WORKFLOW ENGINE (V5.0 - Multi-Item Support)
// ==========================================================================

let currentTransferType = '';
let transferProductChoices = null;
let editingTransferData = null;
let tfFromSiteChoices, tfToSiteChoices, tfApproverChoices, tfReceiverChoices, tfSourceContactChoices;

// New Global Array to hold multiple items
let currentTransferItems = []; 

// ==========================================================================
// 1. OPEN NEW TRANSFER
// ==========================================================================
async function openTransferModal(type) {
    currentTransferType = type;
    editingTransferData = null;
    currentTransferItems = []; // Reset list
    
    document.getElementById('transfer-job-form').reset();
    document.getElementById('tf-job-type').value = type;
    
    // Clear the table body
    const tbody = document.getElementById('tf-items-list-body');
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">No items added yet.</td></tr>';
    
    if (typeof currentApprover !== 'undefined' && currentApprover) {
        document.getElementById('tf-requestor').value = currentApprover.Name;
    }

    const dateEl = document.getElementById('tf-shipping-date');
    if(dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    
    await initTransferDropdowns(); 
    await generateSequentialTransferId(type);

    // Toggle Field Visibility based on Type
    const sourceGroup = document.getElementById('tf-from').closest('.form-group');
    const contactGroup = document.getElementById('tf-source-contact').closest('.form-group');
    const destGroup = document.getElementById('tf-to').closest('.form-group');
    const receiverGroup = document.getElementById('tf-receiver').closest('.form-group');
    
    // Hidden fields for status logic
    document.getElementById('tf-status').closest('.form-group').style.display = 'none';
    document.getElementById('tf-remarks').closest('.form-group').style.display = 'none';

    // Default: Show all
    sourceGroup.style.display = 'block';
    contactGroup.style.display = 'block';
    destGroup.style.display = 'block';
    receiverGroup.style.display = 'block';

    if (type === 'Restock') {
        sourceGroup.style.display = 'none'; 
        contactGroup.style.display = 'none';
    }
    else if (type === 'Usage') {
        destGroup.style.display = 'none'; 
        receiverGroup.style.display = 'none'; 
    }

    document.getElementById('transfer-job-modal').classList.remove('hidden');
}

window.closeTransferModal = function() { 
    document.getElementById('transfer-job-modal').classList.add('hidden'); 
};

// ==========================================================================
// 2. ADD ITEM TO LIST LOGIC (NEW)
// ==========================================================================
function handleAddLineItem() {
    const pID = transferProductChoices ? transferProductChoices.getValue(true) : '';
    const pName = document.getElementById('tf-product-name').value;
    const pDetails = document.getElementById('tf-details').value;
    const qty = parseFloat(document.getElementById('tf-req-qty').value);

    if (!pID) { alert("Please select a product."); return; }
    if (!qty || qty <= 0) { alert("Please enter a valid quantity."); return; }

    // Add to Array
    currentTransferItems.push({
        productID: pID,
        productName: pName,
        details: pDetails,
        orderedQty: qty,
        approvedQty: qty, // Default to ordered
        receivedQty: 0
    });

    renderTransferItemsTable();

    // Clear Inputs
    transferProductChoices.removeActiveItems();
    document.getElementById('tf-req-qty').value = '';
    document.getElementById('tf-product-name').value = '';
    document.getElementById('tf-details').value = '';
}

function renderTransferItemsTable() {
    const tbody = document.getElementById('tf-items-list-body');
    tbody.innerHTML = '';

    if (currentTransferItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777;">No items added yet.</td></tr>';
        return;
    }

    currentTransferItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.productName}</td>
            <td>${item.details || '-'}</td>
            <td style="font-weight:bold; text-align:center;">${item.orderedQty}</td>
            <td style="text-align:center;">
                <button type="button" class="delete-btn" onclick="removeTransferItem(${index})" style="padding:2px 6px; font-size:0.7rem;">&times;</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.removeTransferItem = function(index) {
    currentTransferItems.splice(index, 1);
    renderTransferItemsTable();
};

// ==========================================================================
// 3. SAVE ENTRY (Handles Array)
// ==========================================================================
async function saveTransferEntry(e) {
    if(e) e.preventDefault(); 
    const btn = document.getElementById('tf-save-btn');
    btn.disabled = true; btn.textContent = "Saving...";

    // 1. Validate Global Fields
    const fromLoc = (tfFromSiteChoices ? tfFromSiteChoices.getValue(true) : document.getElementById('tf-from').value) || '';
    const toLoc = (tfToSiteChoices ? tfToSiteChoices.getValue(true) : document.getElementById('tf-to').value) || '';
    const approver = (tfApproverChoices ? tfApproverChoices.getValue(true) : document.getElementById('tf-approver').value) || '';
    const type = document.getElementById('tf-job-type').value;

    if (currentTransferItems.length === 0) {
        alert("Please add at least one item to the list.");
        btn.disabled = false; btn.textContent = "Save Transaction"; return;
    }

    if (type === 'Transfer' && (!fromLoc || !toLoc || !approver)) {
        alert("Please select Source, Destination, and Approver.");
        btn.disabled = false; btn.textContent = "Save Transaction"; return;
    }

    // 2. Prepare Data
    const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
    let startStatus = 'Pending';
    let startRemarks = (type === 'Transfer') ? 'Pending Source' : 'Pending Admin';
    let startAttention = (type === 'Transfer') ? 
        (tfSourceContactChoices ? tfSourceContactChoices.getValue(true) : '') : 
        approver;

    // Use the FIRST item for the main display columns (backward compatibility)
    const firstItem = currentTransferItems[0];

    const entryData = {
        controlNumber: document.getElementById('tf-control-no').value,
        jobType: type, for: type,
        
        // Main Display Data (Legacy compatibility)
        productID: firstItem.productID, 
        productName: (currentTransferItems.length > 1) ? "Multi-Item Transfer" : firstItem.productName,
        details: (currentTransferItems.length > 1) ? `${currentTransferItems.length} Items` : firstItem.details,
        orderedQty: (currentTransferItems.length > 1) ? 0 : firstItem.orderedQty,

        // THE NEW LIST
        items: currentTransferItems,

        requestor: document.getElementById('tf-requestor').value,
        sourceContact: (tfSourceContactChoices ? tfSourceContactChoices.getValue(true) : ''),
        approver: approver, 
        receiver: (tfReceiverChoices ? tfReceiverChoices.getValue(true) : '') || '',
        
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
        await database.ref('transfer_entries').push(entryData);
        alert("Transaction Saved!");
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
// 4. APPROVAL ACTION (Loop through items)
// ==========================================================================
window.openTransferActionModal = async function(task) {
    const modal = document.getElementById('transfer-approval-modal');
    const keyInput = document.getElementById('transfer-modal-key');
    const detailsDiv = document.getElementById('transfer-modal-details');
    const title = document.getElementById('transfer-approval-modal-title');
    const approveBtn = document.getElementById('transfer-modal-approve-btn');
    
    // Hide single qty input for multi-item tasks
    const qtyInputDiv = document.getElementById('transfer-modal-qty').closest('.form-group');
    
    keyInput.value = task.key;
    
    // Check if it has items array
    let itemsHtml = '';
    if (task.items && Array.isArray(task.items)) {
        qtyInputDiv.style.display = 'none'; // Hide single Qty input
        itemsHtml = `<table style="width:100%; font-size:0.85rem; margin-top:10px; border-collapse:collapse;">
            <thead style="background:#eee;"><tr><th>Item</th><th>Qty</th></tr></thead><tbody>`;
        task.items.forEach(item => {
            itemsHtml += `<tr><td style="border:1px solid #ddd; padding:4px;">${item.productName}</td><td style="border:1px solid #ddd; padding:4px; font-weight:bold;">${item.orderedQty}</td></tr>`;
        });
        itemsHtml += `</tbody></table>`;
    } else {
        qtyInputDiv.style.display = 'block'; // Show single Qty input for old records
        document.getElementById('transfer-modal-qty').value = task.orderedQty;
    }

    if (task.remarks === 'Pending Source') { title.textContent = "Step 1: Source Confirmation"; approveBtn.textContent = "Confirm & Send"; }
    else if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') { title.textContent = "Step 2: Admin Authorization"; approveBtn.textContent = "Authorize"; }
    else if (task.remarks === 'In Transit') { title.textContent = "Step 3: Confirm Receipt"; approveBtn.textContent = "Confirm Received"; }

    detailsDiv.innerHTML = `
        <p><strong>Control:</strong> ${task.controlNumber || task.ref}</p>
        <p><strong>Route:</strong> ${task.fromSite} > ${task.toSite}</p>
        ${itemsHtml}
    `;

    modal.classList.remove('hidden');
};

window.handleTransferAction = async (status) => {
    const key = document.getElementById('transfer-modal-key').value;
    const note = document.getElementById('transfer-modal-note').value;
    const database = (typeof db !== 'undefined') ? db : firebase.database();

    try {
        const snapshot = await database.ref(`transfer_entries/${key}`).once('value');
        const task = snapshot.val();
        
        let updates = { note: note, dateResponded: formatDate(new Date()) };

        const generateStructuredESN = (letters, digits) => {
            const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const numSet = "0123456789";
            let result = "";
            for (let i = 0; i < letters; i++) result += charSet.charAt(Math.floor(Math.random() * charSet.length));
            for (let i = 0; i < digits; i++) result += numSet.charAt(Math.floor(Math.random() * numSet.length));
            return result.split('').sort(() => 0.5 - Math.random()).join('');
        };

        if (status === 'Rejected') {
            updates.status = 'Rejected';
            updates.remarks = 'Rejected';
            updates.attention = task.requestor;
        } else if (status === 'Approved') {
            
            // Generate ESN if approved by Admin
            const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
            const cleanName = currentUser.replace(/Engr\.?\s*/gi, '').trim().toUpperCase().split(' ')[0];
            
            // Define next stage based on current status
            if (task.remarks === 'Pending Source') {
                updates.remarks = 'Pending Admin';
                updates.attention = task.approver;
            } else if (task.remarks === 'Pending Admin' || task.remarks === 'Pending') {
                updates.remarks = 'In Transit';
                updates.attention = task.receiver;
                updates.esn = `${generateStructuredESN(6, 6)}/${cleanName}`; // Approver ESN
                
                // DEDUCT STOCK
                await processStockMovement(task, 'Deduct');
            } else if (task.remarks === 'In Transit') {
                updates.remarks = 'Completed';
                updates.status = 'Completed';
                updates.attention = 'Records';
                updates.receiverEsn = `${generateStructuredESN(4, 4)}/${cleanName}`; // Receiver ESN
                
                // ADD STOCK
                await processStockMovement(task, 'Add');
            }
        }

        await commitUpdate(database, key, updates, note);

    } catch (e) {
        console.error(e);
        alert("Action failed.");
    }
};

async function processStockMovement(task, action) {
    const site = (action === 'Deduct') ? (task.fromLocation || task.fromSite) : (task.toLocation || task.toSite);
    
    if (task.items && Array.isArray(task.items)) {
        // Multi Item
        for (const item of task.items) {
            await updateStockInventory(item.productID, item.orderedQty, action, site);
        }
    } else {
        // Single Item (Legacy)
        await updateStockInventory(task.productID, task.orderedQty, action, site);
    }
}

// ==========================================================================
// 5. PRINT WAYBILL (RESTORED & UPDATED FOR MULTI-ITEM)
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
    
    const printDate = new Date().toLocaleString();
    const isApproved = ['In Transit', 'Approved', 'Completed', 'Received'].includes(entry.remarks);
    const isCompleted = ['Completed', 'Received'].includes(entry.remarks);

    let title = isApproved ? "TRANSFER SLIP" : "DRAFT REQUEST";
    let badgeText = isApproved ? "AUTHORIZED" : "PENDING APPROVAL";
    let badgeColor = isApproved ? "#00748C" : "#dc3545";
    if(isCompleted) { badgeText = "COMPLETED"; badgeColor = "#28a745"; }

    // --- ITEM TABLE BUILDER ---
    let itemsTableRows = '';
    
    if (entry.items && Array.isArray(entry.items)) {
        // Multi-Item
        entry.items.forEach(item => {
            let displayQty = item.orderedQty;
            itemsTableRows += `
                <tr>
                    <td>${item.productID}</td>
                    <td><strong>${item.productName}</strong></td>
                    <td>${item.details || '-'}</td>
                    <td style="border-right: none; text-align: right; font-weight: bold;">${displayQty}</td>
                </tr>`;
        });
    } else {
        // Single Item (Legacy)
        let displayQty = entry.orderedQty;
        if (entry.remarks === 'Completed') displayQty = entry.receivedQty;
        else if (entry.remarks === 'In Transit') displayQty = entry.approvedQty;
        
        itemsTableRows = `
            <tr>
                <td>${entry.productId || entry.productID}</td>
                <td><strong>${entry.productName}</strong></td>
                <td>${entry.details}</td>
                <td style="border-right: none; text-align: right; font-weight: bold;">${displayQty}</td>
            </tr>`;
    }

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
                    ${itemsTableRows}
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
// 6. DROPDOWNS & HELPERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const sBtn = document.getElementById('tf-save-btn');
    if(sBtn) sBtn.addEventListener('click', saveTransferEntry);
    
    const addLineBtn = document.getElementById('tf-add-line-btn');
    if(addLineBtn) addLineBtn.addEventListener('click', handleAddLineItem);
    
    // Approval Buttons
    const appBtn = document.getElementById('transfer-modal-approve-btn');
    if(appBtn) appBtn.addEventListener('click', () => handleTransferAction('Approved'));
    const rejBtn = document.getElementById('transfer-modal-reject-btn');
    if(rejBtn) rejBtn.addEventListener('click', () => handleTransferAction('Rejected'));
});

async function initTransferDropdowns() {
    if (!tfFromSiteChoices) tfFromSiteChoices = new Choices(document.getElementById('tf-from'), { searchEnabled: true, itemSelectText: '' });
    if (!tfToSiteChoices) tfToSiteChoices = new Choices(document.getElementById('tf-to'), { searchEnabled: true, itemSelectText: '' });
    
    // Load Sites
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
    
    // Product Search Dropdown
    const selectElement = document.getElementById('tf-product-select');
    if (transferProductChoices) { transferProductChoices.destroy(); } 
    transferProductChoices = new Choices(selectElement, { searchEnabled: true, itemSelectText: '', placeholder: true, placeholderValue: 'Type to search...' });
    
    const database = (typeof db !== 'undefined') ? db : firebase.database();
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
            // Trigger site update based on this product
            updateFromSiteOptions(item.customProperties.sites);
        }
    });

    // --- UPDATED LOGIC FOR APPROVER FILTERING ---
    const opts = { searchEnabled: true, itemSelectText: '' };
    if (!tfApproverChoices) tfApproverChoices = new Choices(document.getElementById('tf-approver'), opts);
    if (!tfReceiverChoices) tfReceiverChoices = new Choices(document.getElementById('tf-receiver'), opts);
    if (!tfSourceContactChoices) tfSourceContactChoices = new Choices(document.getElementById('tf-source-contact'), opts);

    let rawData = null;
    if (typeof allApproverData !== 'undefined' && allApproverData) {
        rawData = allApproverData;
    } else {
        try {
            const snap = await database.ref('approvers').once('value');
            rawData = snap.val();
        } catch(e) {}
    }

    if (rawData) {
        const allUsers = Object.values(rawData);
        const adminList = allUsers.filter(u => (u.Role || '').toLowerCase() === 'admin').map(u => ({ value: u.Name, label: `${u.Name} - ${u.Position||''} (Admin)` }));
        const fullList = allUsers.map(u => ({ value: u.Name, label: `${u.Name} - ${u.Position||''}` }));

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
    if(typeof populateActiveTasks === 'function') await populateActiveTasks();
}

async function updateStockInventory(id, qty, action, siteName) {
    if (!id || !qty || !siteName) return;
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