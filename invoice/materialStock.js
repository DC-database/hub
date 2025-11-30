// ==========================================================================
// MATERIAL STOCK MANAGEMENT (Final Version: Strict Exact Match Logic)
// ==========================================================================

let allMaterialStockData = [];
let allTransferData = []; 
let msProductChoices = null; 
let lastTypedProductID = ""; 

// ==========================================================================
// 1. LOAD DATA (Stock + Transfers)
// ==========================================================================
async function populateMaterialStock() {
    const tableBody = document.getElementById('ms-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading stock data...</td></tr>';

    try {
        const database = (typeof db !== 'undefined') ? db : firebase.database();

        const [stockSnap, transferSnap] = await Promise.all([
            database.ref('material_stock').once('value'),
            database.ref('transfer_entries').orderByChild('timestamp').once('value')
        ]);

        const stockData = stockSnap.val();
        allMaterialStockData = [];
        if (stockData) {
            Object.keys(stockData).forEach(key => {
                allMaterialStockData.push({ key: key, ...stockData[key] });
            });
        }

        const tData = transferSnap.val();
        allTransferData = [];
        if (tData) {
            Object.keys(tData).forEach(key => {
                allTransferData.push({ key: key, ...tData[key] });
            });
            allTransferData.sort((a, b) => b.timestamp - a.timestamp);
        }

        renderMaterialStockTable(allMaterialStockData);

    } catch (error) {
        console.error("Error loading material stock:", error);
        tableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error loading data. Check console.</td></tr>';
    }
}

// ==========================================================================
// 2. RENDER TABLE (UPDATED: "Return" Button Logic)
// ==========================================================================
function renderMaterialStockTable(data) {
    const tableBody = document.getElementById('ms-table-body');
    const searchInput = document.getElementById('ms-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    // Safe check for currentUser
    const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : '';

    const getSiteDisplayName = (siteCode) => {
        if (siteCode === "Main Store") return "Main Store";
        const cachedSites = localStorage.getItem('cached_SITES');
        if (cachedSites) {
            try {
                const sitesData = JSON.parse(cachedSites).data || [];
                const found = sitesData.find(s => s.site == siteCode);
                if (found) return `<span style="color:#00748C; font-weight:bold;">${found.site}</span> - ${found.description}`;
            } catch (e) {}
        }
        return siteCode; 
    };

    tableBody.innerHTML = '';

    const filtered = data.filter(item => {
        const pID = (item.productID || item.productId || '').toLowerCase();
        const pName = (item.productName || '').toLowerCase();
        return pID.includes(searchTerm) || pName.includes(searchTerm);
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#777;">No materials found.</td></tr>';
        return;
    }

    filtered.forEach(item => {
        let totalStock = 0;
        let breakdownRows = '';
        let hasSites = false;

        if (item.sites) {
            Object.entries(item.sites).forEach(([site, qty]) => {
                const q = parseFloat(qty);
                if (q !== 0) {
                    hasSites = true;
                    totalStock += q;
                    breakdownRows += `
                        <tr>
                            <td style="width: 70%; padding-left: 20px;">${getSiteDisplayName(site)}</td>
                            <td style="width: 30%; font-weight:bold;">${q}</td>
                        </tr>
                    `;
                }
            });
        }
        
        if (!hasSites) {
            const legacyStock = parseFloat(item.stockQty) || 0;
            totalStock = legacyStock;
            breakdownRows = `<tr><td style="padding-left: 20px;">Unassigned (Global)</td><td>${legacyStock}</td></tr>`;
        }

        const stockID = (item.productID || item.productId || '').trim();

        const productTransfers = allTransferData.filter(t => {
            const transferID = (t.productID || t.productId || '').trim();
            const idMatch = transferID === stockID;
            const isAfterCreation = t.timestamp >= (item.timestamp || 0);
            return idMatch && isAfterCreation;
        });

        let historyRows = '';
        if (productTransfers.length === 0) {
            historyRows = '<tr><td colspan="7" style="text-align:center; color:#999; font-style:italic; padding: 20px;">No movement history found.</td></tr>';
        } else {
            productTransfers.forEach(t => {
                const date = t.shippingDate || new Date(t.timestamp).toISOString().split('T')[0];
                const type = t.jobType || t.for || 'Transfer';
                let route = '-';
                
                if (type === 'Transfer') route = `${t.fromLocation || t.fromSite} <i class="fa-solid fa-arrow-right" style="font-size:0.8em; color:#888;"></i> ${t.toLocation || t.toSite}`;
                else if (type === 'Restock') route = `<span style="color:#28a745;">+ Add to ${t.toLocation || t.toSite}</span>`;
                else if (type === 'Return') route = `<span style="color:#dc3545;">- Return from ${t.fromLocation || t.fromSite}</span>`;
                else if (type === 'Usage') route = `<span style="color:#6f42c1;">- Used at ${t.fromLocation || t.fromSite}</span>`;

                const qtyOrdered = t.orderedQty || 0;
                const qtyApproved = t.approvedQty || 0;
                const qtyReceived = t.receivedQty || 0;
                
                let statusColor = '#333';
                if(t.remarks === 'Completed') statusColor = '#003A5C';
                if(t.remarks === 'In Transit') statusColor = '#17a2b8';
                if(t.remarks.includes('Pending')) statusColor = '#dc3545';

                // --- RETURN BUTTON LOGIC ---
                let actionBtn = '';
                
                // 1. Must be Completed (You physically have the item)
                const isCompleted = (t.remarks === 'Completed' || t.remarks === 'Received');
                
                // 2. You must be the Receiver (It was sent TO you)
                const isMyReceipt = (t.receiver === currentUser);
                
                // 3. Show button if conditions met
                if (isCompleted && isMyReceipt && type !== 'Return') {
                    actionBtn = `<button class="secondary-btn" onclick="initiateReturn('${t.key}')" style="padding:2px 8px; font-size:0.75rem; background-color:#ffc107; color:#212529; border:none; border-radius:4px; cursor:pointer;" title="Return this item"><i class="fa-solid fa-rotate-left"></i> Return</button>`;
                }
                // ---------------------------

                historyRows += `
                    <tr>
                        <td style="font-size:0.85rem;">${date}</td>
                        <td style="font-size:0.85rem; font-weight:600;">${type}</td>
                        <td style="font-size:0.85rem;">${route}</td>
                        <td style="font-size:0.85rem; text-align:center;">
                            <span title="Ordered" style="color:#999;">${qtyOrdered}</span> / 
                            <span title="Approved" style="color:#17a2b8;">${qtyApproved}</span> / 
                            <span title="Received" style="color:#28a745; font-weight:bold;">${qtyReceived}</span>
                        </td>
                        <td style="font-size:0.85rem;">${t.enteredBy || 'System'}</td>
                        <td style="font-size:0.85rem; font-weight:bold; color:${statusColor};">${t.remarks}</td>
                        <td style="text-align:center;">${actionBtn}</td>
                    </tr>
                `;
            });
        }

        const uniqueId = `detail-${item.key}`;

        const parentRow = document.createElement('tr');
        parentRow.innerHTML = `
            <td><button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button></td>
            <td>${item.productID || item.productId}</td>
            <td><strong>${item.productName}</strong></td>
            <td>${item.details || ''}</td>
            <td style="font-size: 1.1em; font-weight: bold; color: #003A5C;">${totalStock}</td>
            <td style="text-align: center;">
                <button class="delete-btn ms-delete-btn" data-key="${item.key}" style="padding: 5px 10px; font-size: 0.8rem;" title="Delete Item">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

        const childRow = document.createElement('tr');
        childRow.id = uniqueId;
        childRow.className = 'stock-child-row hidden';
        childRow.innerHTML = `
            <td colspan="7" style="padding: 15px 25px; background-color: #fcfcfc;">
                <div style="display: flex; gap: 30px; flex-wrap: wrap; align-items: flex-start;">
                    <div style="flex: 1; min-width: 300px;">
                        <h4 style="margin: 0 0 10px 0; color: #003A5C; border-bottom: 2px solid #003A5C; padding-bottom: 5px;">
                            <i class="fa-solid fa-cubes"></i> Current Stock Breakdown
                        </h4>
                        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; background: #fff;">
                            <table class="stock-detail-table" style="width: 100%; margin: 0;">
                                <thead style="background:#f0f0f0; position: sticky; top: 0;"><tr><th>Site</th><th>Qty</th></tr></thead>
                                <tbody>${breakdownRows}</tbody>
                            </table>
                        </div>
                    </div>
                    <div style="flex: 2; min-width: 400px;">
                        <h4 style="margin: 0 0 10px 0; color: #6f42c1; border-bottom: 2px solid #6f42c1; padding-bottom: 5px;">
                            <i class="fa-solid fa-clock-rotate-left"></i> Movement History
                        </h4>
                        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; background: #fff;">
                            <table class="stock-detail-table" style="width: 100%; margin: 0;">
                                <thead style="background:#f0f0f0; position: sticky; top: 0;">
                                    <tr><th>Date</th><th>Type</th><th>Route</th><th style="text-align:center;">Qty</th><th>By</th><th>Status</th><th>Action</th></tr>
                                </thead>
                                <tbody>${historyRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </td>
        `;

        tableBody.appendChild(parentRow);
        tableBody.appendChild(childRow);
    });

    document.querySelectorAll('.ms-delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            handleDeleteMaterial(this.getAttribute('data-key'));
        });
    });
}

window.toggleStockDetail = function(rowId, btn) {
    const row = document.getElementById(rowId);
    if (row) {
        const isHidden = row.classList.contains('hidden');
        if (isHidden) {
            row.classList.remove('hidden');
            btn.textContent = '-';
            btn.style.backgroundColor = '#dc3545';
        } else {
            row.classList.add('hidden');
            btn.textContent = '+';
            btn.style.backgroundColor = '#003A5C';
        }
    }
};

// ==========================================================================
// 3. SMART MODAL: STRICT EXACT MATCH (Final "Kill Switch" Fix)
// ==========================================================================
async function openNewMaterialModal() {
    document.getElementById('ms-new-material-form').reset();
    
    // UI References
    const nameInput = document.getElementById('ms-new-name');
    const detailsInput = document.getElementById('ms-new-details');
    const qtyInput = document.getElementById('ms-new-stock-qty'); 
    const selectEl = document.getElementById('ms-new-id');
    const siteSelect = document.getElementById('ms-new-site-select');
    const btn = document.getElementById('ms-save-new-btn');
    const title = document.getElementById('ms-modal-title');

    // State
    let currentProductData = null; 
    const isAdmin = (typeof currentApprover !== 'undefined' && (currentApprover.Role || '').toLowerCase() === 'admin');

    // 1. Reset UI
    nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff';
    detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff';
    qtyInput.disabled = false; qtyInput.style.backgroundColor = '#fff';
    qtyInput.placeholder = "Initial Stock";
    qtyInput.value = "";
    delete document.getElementById('ms-new-material-form').dataset.existingKey;
    title.textContent = "Register New Product";
    btn.textContent = "Save";

    // 2. Initialize Dropdown
    if (msProductChoices) msProductChoices.destroy();
    
    // Pre-build options list for fast checking
    const options = allMaterialStockData.map(item => ({
        value: item.productID || item.productId,
        label: `${item.productID} - ${item.productName}`,
        customProperties: { 
            name: item.productName, 
            details: item.details, 
            key: item.key,
            sites: item.sites || {} 
        }
    }));

    msProductChoices = new Choices(selectEl, {
        choices: options,
        searchEnabled: true,
        shouldSort: false,
        itemSelectText: '',
        placeholder: true,
        placeholderValue: 'Type ID or Name...',
        removeItemButton: true,
        addItems: true, 
        duplicateItemsAllowed: false,
        addItemFilter: (value) => { return !!value && value !== ""; },
        
        // Disable sorting so exact matches appear logically
        fuseOptions: { threshold: 0.0, distance: 0 }, 
        
        noResultsText: 'Press Enter to add this ID',
        addItemText: (value) => `Press Enter to add ID: <b>"${value}"</b>`
    });

    // --- LOGIC A: PERMISSION CHECKER ---
    const checkPermissions = () => {
        const selectedSite = siteSelect.value;
        if (!currentProductData) {
            qtyInput.disabled = false; qtyInput.style.backgroundColor = '#fff'; qtyInput.placeholder = "Initial Stock"; btn.disabled = false;
            return;
        }
        const existingSites = currentProductData.sites || {};
        if (existingSites[selectedSite] !== undefined) {
            if (isAdmin) {
                qtyInput.disabled = false; qtyInput.style.backgroundColor = '#fff'; qtyInput.placeholder = "Add Qty (+)"; btn.disabled = false;
            } else {
                qtyInput.disabled = true; qtyInput.style.backgroundColor = '#e9ecef'; qtyInput.value = ""; qtyInput.placeholder = "Already exists (Admin Only)";
            }
        } else {
            qtyInput.disabled = false; qtyInput.style.backgroundColor = '#fff'; qtyInput.placeholder = "New stock for this site"; btn.disabled = false;
        }
    };

    // --- LOGIC B: HANDLE SELECTION (Standard) ---
    const handleMainSelection = (val) => {
        if (!val) {
            currentProductData = null;
            nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff'; nameInput.value = '';
            detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff'; detailsInput.value = '';
            delete document.getElementById('ms-new-material-form').dataset.existingKey;
            title.textContent = "Register New Product";
            checkPermissions();
            return;
        }

        const existingMatch = allMaterialStockData.find(item => 
            (item.productID || item.productId).toLowerCase() === val.toLowerCase()
        );

        if (existingMatch) {
            // ---> EXISTING ITEM
            currentProductData = {
                name: existingMatch.productName,
                details: existingMatch.details,
                key: existingMatch.key,
                sites: existingMatch.sites || {}
            };
            nameInput.value = currentProductData.name;
            detailsInput.value = currentProductData.details;
            nameInput.readOnly = true; nameInput.style.backgroundColor = '#e9ecef';
            detailsInput.readOnly = true; detailsInput.style.backgroundColor = '#e9ecef';
            document.getElementById('ms-new-material-form').dataset.existingKey = currentProductData.key;
            title.textContent = "Add Stock to Existing Product";
        } 
        else {
            // ---> NEW ITEM
            currentProductData = null;
            if(nameInput.readOnly) { nameInput.value = ''; detailsInput.value = ''; }
            nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff';
            detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff';
            delete document.getElementById('ms-new-material-form').dataset.existingKey;
            title.textContent = "Register New Product";
        }
        checkPermissions();
    };

    selectEl.addEventListener('addItem', (e) => handleMainSelection(e.detail.value));
    selectEl.addEventListener('removeItem', () => handleMainSelection(null));

    // --- LOGIC C: THE "KILL SWITCH" FOR ENTER KEY ---
    if (msProductChoices.input && msProductChoices.input.element) {
        const inputEl = msProductChoices.input.element;

        inputEl.addEventListener('keydown', function(e) {
            // Check for Enter (13) or Tab (9)
            if (e.keyCode === 13 || e.keyCode === 9) {
                const val = this.value; 
                
                if (val && val.trim() !== "") {
                    const typedLower = val.trim().toLowerCase();

                    // 1. IS IT A PERFECT 100% MATCH?
                    const exactMatch = options.find(o => o.value.toLowerCase() === typedLower);

                    if (exactMatch) {
                        // PERFECT MATCH: Let the library handle it naturally
                        // (It will select the existing item, which is what we want)
                        return; 
                    } 
                    else {
                        // NOT A PERFECT MATCH (Even if library is suggesting something similar)
                        // KILL THE LIBRARY'S EVENT
                        e.stopImmediatePropagation();
                        e.preventDefault();

                        // FORCE ADD NEW VALUE
                        msProductChoices.setValue([{ value: val.trim(), label: val.trim() }]);
                        handleMainSelection(val.trim());
                        
                        // Clean up
                        msProductChoices.clearInput();
                        msProductChoices.hideDropdown();
                        
                        if (e.keyCode === 9) { setTimeout(() => nameInput.focus(), 50); }
                    }
                }
            }
        }, true); // <--- TRUE IS CRITICAL (Captures event before library sees it)
    }

    if (siteSelect) {
        siteSelect.innerHTML = '<option value="Main Store">Main Store</option>'; 
        let sitesData = [];
        const cachedSites = localStorage.getItem('cached_SITES');
        if (cachedSites) { try { sitesData = JSON.parse(cachedSites).data || []; } catch (e) {} }
        
        sitesData.sort((a, b) => parseInt(a.site) - parseInt(b.site));
        sitesData.forEach(site => {
            if (site.site !== "Main Store") {
                const opt = document.createElement('option');
                opt.value = site.site;
                opt.textContent = `${site.site} - ${site.description}`;
                siteSelect.appendChild(opt);
            }
        });
    }
    
    siteSelect.addEventListener('change', checkPermissions);

    document.getElementById('ms-new-material-modal').classList.remove('hidden');
}

// ==========================================================================
// 4. SAVE LOGIC
// ==========================================================================
async function handleSaveNewMaterial() {
    const form = document.getElementById('ms-new-material-form');
    let targetKey = form.dataset.existingKey; 
    let id = msProductChoices ? msProductChoices.getValue(true) : '';
    if (!id && lastTypedProductID) id = lastTypedProductID.trim(); 

    const name = document.getElementById('ms-new-name').value.trim();
    const details = document.getElementById('ms-new-details').value.trim();
    const selectedSite = document.getElementById('ms-new-site-select').value;
    const stockQty = parseFloat(document.getElementById('ms-new-stock-qty').value) || 0;

    if (!id) { alert("Product ID is required."); return; }
    if (!name) { alert("Product Name is required."); return; }

    const btn = document.getElementById('ms-save-new-btn');
    btn.disabled = true; btn.textContent = "Processing...";

    const database = (typeof db !== 'undefined') ? db : firebase.database();

    try {
        if (!targetKey) {
            const existingItem = allMaterialStockData.find(m => (m.productID || m.productId || '').toLowerCase() === id.toLowerCase());
            if (existingItem) targetKey = existingItem.key; 
        }

        if (targetKey) {
            const item = allMaterialStockData.find(m => m.key === targetKey);
            let sites = item.sites || {};
            
            if (sites[selectedSite] !== undefined) {
                alert(`Error: Product "${item.productName}" already exists at ${selectedSite}.\nUse "Add" button to adjust stock.`);
                btn.disabled = false; btn.textContent = "Save"; return;
            }

            const confirmMsg = `Product "${item.productName}" exists.\nAdd ${stockQty} to ${selectedSite}?`;
            if (!confirm(confirmMsg)) { btn.disabled = false; btn.textContent = "Save"; return; }

            sites[selectedSite] = stockQty;
            let newGlobalStock = 0;
            Object.values(sites).forEach(q => newGlobalStock += parseFloat(q));

            await database.ref(`material_stock/${targetKey}`).update({
                stockQty: newGlobalStock, sites: sites, lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            alert(`Added ${selectedSite} to existing product!`);

        } else {
            const sitesInit = {};
            if (stockQty > 0) sitesInit[selectedSite] = stockQty;

            const newMaterial = {
                productID: id, productName: name, details: details,
                stockQty: stockQty, transferredQty: 0, balanceQty: stockQty,
                sites: sitesInit,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                updatedBy: (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'System')
            };

            await database.ref('material_stock').push(newMaterial);
            alert("New Product Registered!");
        }

        document.getElementById('ms-new-material-modal').classList.add('hidden');
        populateMaterialStock(); 

    } catch (error) {
        console.error("Save Error:", error); 
        alert("Failed to save. Check console.");
    } finally {
        btn.disabled = false; btn.textContent = "Save";
    }
}

// --- 5. Delete ---
window.handleDeleteMaterial = async function(key) {
    if (!confirm("WARNING: This will permanently delete this material.\n\nAre you sure?")) return;
    try {
        const database = (typeof db !== 'undefined') ? db : firebase.database();
        await database.ref(`material_stock/${key}`).remove();
        populateMaterialStock(); 
    } catch (error) { alert("Error deleting."); }
};

// --- 6. CSV & Template ---
function handleUploadCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        const updates = {};
        let count = 0;
        const database = (typeof db !== 'undefined') ? db : firebase.database();

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',');
            if (cols.length >= 2) { 
                const pID = cols[0].trim();
                const pName = cols[1].trim();
                const pDetails = cols[2] ? cols[2].trim() : '';
                const pStock = parseFloat(cols[3]) || 0;
                if(pID && pName) {
                    const newRef = database.ref('material_stock').push();
                    const sitesInit = {};
                    if(pStock > 0) sitesInit["Main Store"] = pStock;
                    updates[newRef.key] = {
                        productID: pID, productName: pName, details: pDetails,
                        stockQty: pStock, transferredQty: 0, sites: sitesInit, timestamp: Date.now()
                    };
                    count++;
                }
            }
        }
        if (count > 0) {
            if(confirm(`Found ${count} items. Upload?`)) {
                await database.ref('material_stock').update(updates);
                alert(`Uploaded ${count} materials.`);
                populateMaterialStock();
            }
        } else { alert("No valid data."); }
        document.getElementById('ms-csv-file-input').value = '';
    };
    reader.readAsText(file);
}

function handleGetTemplate() {
    const headers = ["Product ID", "Product Name", "Details", "Stock QTY (Main Store)"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + "A001,Apple,Red Fruit,100";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "material_stock_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('ms-search-input');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => renderMaterialStockTable(allMaterialStockData), 300);
        });
    }

    const addNewBtn = document.getElementById('ms-add-new-btn');
    if (addNewBtn) addNewBtn.addEventListener('click', openNewMaterialModal);

    const saveNewBtn = document.getElementById('ms-save-new-btn');
    if (saveNewBtn) saveNewBtn.addEventListener('click', handleSaveNewMaterial);

    const templateBtn = document.getElementById('ms-template-btn');
    if (templateBtn) templateBtn.addEventListener('click', handleGetTemplate);

    const uploadBtn = document.getElementById('ms-upload-csv-btn');
    const fileInput = document.getElementById('ms-csv-file-input');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleUploadCSV);
    }

});

// ==========================================================================
// 8. INITIATE RETURN LOGIC
// ==========================================================================
window.initiateReturn = function(transferKey) {
    // 1. Find the original transfer data
    const originalTask = allTransferData.find(t => t.key === transferKey);
    if (!originalTask) {
        alert("Error: Original transaction data not found.");
        return;
    }

    // 2. Open the Modal in "Return" mode
    openTransferModal('Return');

    // 3. Pre-fill Data (REVERSING THE LOGIC)
    
    // Product
    if (transferProductChoices) {
        // Set Product (Use ID)
        transferProductChoices.setChoiceByValue(originalTask.productId || originalTask.productID);
    }
    document.getElementById('tf-product-name').value = originalTask.productName;
    document.getElementById('tf-details').value = `Return of: ${originalTask.controlNumber || originalTask.ref}`;

    // Qty (Default to what was received)
    document.getElementById('tf-req-qty').value = originalTask.receivedQty || 0;

    // --- CRITICAL: SWAP LOCATIONS ---
    // Return FROM: Where it is now (The Destination of original)
    const returnFrom = originalTask.toSite || originalTask.toLocation;
    
    // Return TO: Where it came from (The Source of original)
    const returnTo = originalTask.fromSite || originalTask.fromLocation;

    // Set Dropdowns
    if (tfFromSiteChoices) tfFromSiteChoices.setChoiceByValue(returnFrom);
    if (tfToSiteChoices) tfToSiteChoices.setChoiceByValue(returnTo);

    // Set People
    // Approver: Usually the original sender needs to approve taking it back
    // Or set to Admin if that's your flow. For now, let's leave it for user to select or map to original Requestor.
    
    // Scroll to top of modal
    document.querySelector('#transfer-job-modal .modal-content').scrollTop = 0;
};