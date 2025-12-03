// =====================================
// [File 2] materialStock.js (V5.6 - Fixed Edit ID Display)
// =====================================

let allMaterialStockData = [];
let allTransferData = []; 
let msProductChoices = null; 
let lastTypedProductID = ""; 

// ==========================================================================
// 1. LOAD DATA
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
// 2. RENDER TABLE
// ==========================================================================
function renderMaterialStockTable(data) {
    const tableBody = document.getElementById('ms-table-body');
    const searchInput = document.getElementById('ms-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : '';
    const isAdmin = (typeof currentApprover !== 'undefined' && (currentApprover.Role || '').toLowerCase() === 'admin');

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
        const pStatus = (item.status || '').toLowerCase();
        return pID.includes(searchTerm) || pName.includes(searchTerm) || pStatus.includes(searchTerm);
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

        // --- HISTORY LOGIC ---
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

                let actionBtn = '';
                const isCompleted = (t.remarks === 'Completed' || t.remarks === 'Received');
                const isMyReceipt = (t.receiver === currentUser);
                
                if (isCompleted && isMyReceipt && type !== 'Return') {
                    actionBtn = `<button class="secondary-btn" onclick="initiateReturn('${t.key}')" style="padding:2px 8px; font-size:0.75rem; background-color:#ffc107; color:#212529; border:none; border-radius:4px; cursor:pointer;" title="Return this item"><i class="fa-solid fa-rotate-left"></i> Return</button>`;
                }

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

        let statusBadge = '';
        const status = (item.status || 'Active').trim();
        const statusLower = status.toLowerCase();
        
        if (statusLower === 'broken') {
            statusBadge = `<span style="background:#dc3545; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px;">BROKEN</span>`;
        } else if (statusLower === 'inactive' || statusLower === 'not active' || statusLower === 'closed') {
            statusBadge = `<span style="background:#6c757d; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px;">INACTIVE</span>`;
        } else {
            statusBadge = `<span style="background:#28a745; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px;">ACTIVE</span>`;
        }

        const parentRow = document.createElement('tr');
        
        let actionButtons = '';
        if(isAdmin) {
            actionButtons += `<button class="secondary-btn" onclick="editMaterialDetails('${item.key}')" style="padding: 5px 10px; font-size: 0.8rem; background-color: #17a2b8; color: white; margin-right: 5px;" title="Edit Details">
                <i class="fa-solid fa-pen"></i>
            </button>`;
            
            actionButtons += `<button class="delete-btn ms-delete-btn" data-key="${item.key}" style="padding: 5px 10px; font-size: 0.8rem;" title="Delete Item">
                <i class="fa-solid fa-trash"></i>
            </button>`;
        } else {
            actionButtons = `<small style="color:#999;">View Only</small>`;
        }

        parentRow.innerHTML = `
            <td><button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button></td>
            <td>${item.productID || item.productId}</td>
            <td><strong>${item.productName}</strong> ${statusBadge}</td>
            <td>${item.details || ''}</td>
            <td style="font-size: 1.1em; font-weight: bold; color: #003A5C;">${totalStock}</td>
            <td style="text-align: center;">${actionButtons}</td>
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
// 3. EDIT MATERIAL DETAILS (ADMIN ONLY) - FIXED
// ==========================================================================
window.editMaterialDetails = function(key) {
    const item = allMaterialStockData.find(i => i.key === key);
    if (!item) return;

    // Open Modal
    document.getElementById('ms-new-material-modal').classList.remove('hidden');
    document.getElementById('ms-new-material-form').reset();
    document.getElementById('ms-modal-title').textContent = "Edit Item Details";
    
    // Set Edit Mode Flag
    document.getElementById('ms-new-material-form').dataset.editMode = "details_only";
    document.getElementById('ms-new-material-form').dataset.existingKey = key;

    // References
    const statusSelect = document.getElementById('ms-new-status');
    const nameInput = document.getElementById('ms-new-name');
    const detailsInput = document.getElementById('ms-new-details');
    const idSearchGroup = document.getElementById('ms-id-search-group');
    const idDisplayGroup = document.getElementById('ms-id-display-group');
    const idDisplayInput = document.getElementById('ms-edit-id-display');
    const clearBtn = document.getElementById('ms-clear-form-btn');

    // 1. SWITCH TO DISPLAY MODE FOR ID
    if(idSearchGroup) idSearchGroup.classList.add('hidden');
    if(idDisplayGroup) idDisplayGroup.classList.remove('hidden');
    
    // Set ID Value
    if(idDisplayInput) idDisplayInput.value = item.productID || item.productId;

    // 2. FILL & UNLOCK EDITABLE FIELDS
    nameInput.value = item.productName || '';
    nameInput.readOnly = false;
    nameInput.style.backgroundColor = "#ffffff";

    detailsInput.value = item.details || '';
    detailsInput.readOnly = false;
    detailsInput.style.backgroundColor = "#ffffff";

    if(statusSelect) statusSelect.value = item.status || 'Active';
    
    // 3. HIDE NON-EDITABLE FIELDS
    const typeContainer = document.getElementById('ms-type-container');
    const serialContainer = document.getElementById('ms-serial-container');
    const stockRow = document.getElementById('ms-stock-entry-row');

    if(typeContainer) typeContainer.classList.add('hidden');
    if(serialContainer) serialContainer.classList.add('hidden');
    if(stockRow) stockRow.style.display = 'none';
    if(clearBtn) clearBtn.style.visibility = 'hidden'; // Hide clear btn in edit mode

    document.getElementById('ms-save-new-btn').textContent = "Update Details";
};

// ==========================================================================
// 4. SMART MODAL (ADD NEW / ADD STOCK) & CLEAR LOGIC
// ==========================================================================
async function openNewMaterialModal() {
    // 1. Reset everything to "Add Mode"
    handleClearMaterialForm();
    
    // 2. Init Choices
    if (msProductChoices) msProductChoices.destroy();
    
    const selectEl = document.getElementById('ms-new-id');
    const options = allMaterialStockData.map(item => ({
        value: item.productID || item.productId,
        label: `${item.productID} - ${item.productName}`,
        customProperties: { 
            name: item.productName, 
            details: item.details, 
            key: item.key,
            sites: item.sites || {},
            status: item.status || 'Active'
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
        fuseOptions: { threshold: 0.0, distance: 0 }, 
        noResultsText: 'Press Enter to add this ID',
        addItemText: (value) => `Press Enter to add ID: <b>"${value}"</b>`
    });

    // 3. Listeners
    const typeSelect = document.getElementById('ms-new-type');
    if (typeSelect) {
        // Clone to remove old listeners
        const newTypeSelect = typeSelect.cloneNode(true);
        typeSelect.parentNode.replaceChild(newTypeSelect, typeSelect);
        
        newTypeSelect.addEventListener('change', () => {
            const qtyInput = document.getElementById('ms-new-stock-qty'); 
            const serialContainer = document.getElementById('ms-serial-container');
            if (newTypeSelect.value === 'Serialized') {
                serialContainer.classList.remove('hidden');
                qtyInput.value = "1";
                qtyInput.readOnly = true; 
                qtyInput.style.backgroundColor = "#e9ecef";
            } else {
                serialContainer.classList.add('hidden');
                qtyInput.readOnly = false;
                qtyInput.style.backgroundColor = "#fff";
                qtyInput.value = "";
            }
        });
    }

    const siteSelect = document.getElementById('ms-new-site-select');
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
        
        const newSiteSelect = siteSelect.cloneNode(true);
        siteSelect.parentNode.replaceChild(newSiteSelect, siteSelect);
        newSiteSelect.addEventListener('change', checkPermissions);
    }

    // Attach Main Selection Logic
    selectEl.addEventListener('addItem', (e) => handleMainSelection(e.detail.value));
    selectEl.addEventListener('removeItem', () => handleMainSelection(null));

    // Kill Switch for Choices
    if (msProductChoices.input && msProductChoices.input.element) {
        const inputEl = msProductChoices.input.element;
        inputEl.addEventListener('keydown', function(e) {
            if (e.keyCode === 13 || e.keyCode === 9) {
                const val = this.value; 
                if (val && val.trim() !== "") {
                    const typedLower = val.trim().toLowerCase();
                    const exactMatch = options.find(o => o.value.toLowerCase() === typedLower);
                    if (exactMatch) { return; } 
                    else {
                        e.stopImmediatePropagation();
                        e.preventDefault();
                        msProductChoices.setValue([{ value: val.trim(), label: val.trim() }]);
                        handleMainSelection(val.trim());
                        msProductChoices.clearInput();
                        msProductChoices.hideDropdown();
                        if (e.keyCode === 9) { setTimeout(() => document.getElementById('ms-new-name').focus(), 50); }
                    }
                }
            }
        }, true); 
    }

    document.getElementById('ms-new-material-modal').classList.remove('hidden');
}

// --- Logic Helpers ---
function checkPermissions() {
    const siteSelect = document.getElementById('ms-new-site-select');
    const qtyInput = document.getElementById('ms-new-stock-qty');
    const btn = document.getElementById('ms-save-new-btn');
    const form = document.getElementById('ms-new-material-form');
    const currentProductData = form.currentProductData || null; 
    const isAdmin = (typeof currentApprover !== 'undefined' && (currentApprover.Role || '').toLowerCase() === 'admin');

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
}

function handleMainSelection(val) {
    const form = document.getElementById('ms-new-material-form');
    const nameInput = document.getElementById('ms-new-name');
    const detailsInput = document.getElementById('ms-new-details');
    const title = document.getElementById('ms-modal-title');
    const statusSelect = document.getElementById('ms-new-status');

    if (!val) {
        form.currentProductData = null;
        nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff'; nameInput.value = '';
        detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff'; detailsInput.value = '';
        delete form.dataset.existingKey;
        title.textContent = "Register New Product";
        checkPermissions();
        return;
    }

    const existingMatch = allMaterialStockData.find(item => 
        (item.productID || item.productId).toLowerCase() === val.toLowerCase()
    );

    if (existingMatch) {
        const currentProductData = {
            name: existingMatch.productName,
            details: existingMatch.details,
            key: existingMatch.key,
            sites: existingMatch.sites || {},
            status: existingMatch.status || 'Active'
        };
        form.currentProductData = currentProductData;
        
        nameInput.value = currentProductData.name;
        detailsInput.value = currentProductData.details;
        if(statusSelect) statusSelect.value = currentProductData.status;

        nameInput.readOnly = true; nameInput.style.backgroundColor = '#e9ecef';
        detailsInput.readOnly = true; detailsInput.style.backgroundColor = '#e9ecef';
        form.dataset.existingKey = currentProductData.key;
        title.textContent = "Add Stock to Existing Product";
    } 
    else {
        form.currentProductData = null;
        if(nameInput.readOnly) { nameInput.value = ''; detailsInput.value = ''; }
        nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff';
        detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff';
        delete form.dataset.existingKey;
        title.textContent = "Register New Product";
    }
    checkPermissions();
}

function handleClearMaterialForm() {
    document.getElementById('ms-new-material-form').reset();
    
    if (msProductChoices) {
        msProductChoices.removeActiveItems();
        msProductChoices.enable();
    }
    
    const ids = ['ms-new-name', 'ms-new-details', 'ms-new-stock-qty'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.readOnly = false;
            el.disabled = false;
            el.style.backgroundColor = '#fff';
        }
    });

    // RESTORE ADD MODE UI
    const idSearchGroup = document.getElementById('ms-id-search-group');
    const idDisplayGroup = document.getElementById('ms-id-display-group');
    const typeContainer = document.getElementById('ms-type-container');
    const serialContainer = document.getElementById('ms-serial-container');
    const stockRow = document.getElementById('ms-stock-entry-row');
    const clearBtn = document.getElementById('ms-clear-form-btn');

    if(idSearchGroup) idSearchGroup.classList.remove('hidden');
    if(idDisplayGroup) idDisplayGroup.classList.add('hidden');
    if(typeContainer) typeContainer.classList.remove('hidden');
    if(serialContainer) serialContainer.classList.add('hidden');
    if(stockRow) stockRow.style.display = 'flex';
    if(clearBtn) clearBtn.style.visibility = 'visible';

    const form = document.getElementById('ms-new-material-form');
    delete form.dataset.existingKey;
    delete form.dataset.editMode;
    form.currentProductData = null;

    document.getElementById('ms-modal-title').textContent = "Register New Product";
    document.getElementById('ms-save-new-btn').textContent = "Save";
    document.getElementById('ms-save-new-btn').disabled = false;
}

// ==========================================================================
// 5. SAVE LOGIC (UPDATED)
// ==========================================================================
async function handleSaveNewMaterial() {
    const form = document.getElementById('ms-new-material-form');
    let targetKey = form.dataset.existingKey; 
    let id = msProductChoices ? msProductChoices.getValue(true) : '';
    if (!id && lastTypedProductID) id = lastTypedProductID.trim(); 

    const name = document.getElementById('ms-new-name').value.trim();
    let details = document.getElementById('ms-new-details').value.trim();
    const selectedSite = document.getElementById('ms-new-site-select').value;
    const stockQty = parseFloat(document.getElementById('ms-new-stock-qty').value) || 0;
    const statusSelect = document.getElementById('ms-new-status');
    const status = statusSelect ? statusSelect.value : 'Active';
    const editMode = form.dataset.editMode;

    const btn = document.getElementById('ms-save-new-btn');
    btn.disabled = true; btn.textContent = "Processing...";

    const database = (typeof db !== 'undefined') ? db : firebase.database();

    try {
        // --- MODE 1: EDIT DETAILS ONLY ---
        if (editMode === "details_only" && targetKey) {
            await database.ref(`material_stock/${targetKey}`).update({
                productName: name,
                details: details,
                status: status,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            alert("Details updated successfully!");
            document.getElementById('ms-new-material-modal').classList.add('hidden');
            populateMaterialStock();
            btn.disabled = false; btn.textContent = "Save";
            return;
        }

        // --- MODE 2: NEW / ADD STOCK ---
        if (!id) { alert("Product ID is required."); btn.disabled = false; return; }
        
        const typeSelect = document.getElementById('ms-new-type');
        const serialInput = document.getElementById('ms-new-serial');
        
        if (typeSelect && typeSelect.value === 'Serialized' && serialInput.value.trim()) {
            details += ` [SN: ${serialInput.value.trim()}]`;
        }

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
                stockQty: newGlobalStock, 
                sites: sites, 
                status: status,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            alert(`Added ${selectedSite} to existing product!`);

        } else {
            const sitesInit = {};
            if (stockQty > 0) sitesInit[selectedSite] = stockQty;

            const newMaterial = {
                productID: id, productName: name, details: details,
                stockQty: stockQty, transferredQty: 0, balanceQty: stockQty,
                sites: sitesInit,
                status: status, 
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
        let updateCount = 0;
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
                
                const pSite = (cols[4] && cols[4].trim() !== "") ? cols[4].trim() : "Main Store";
                const pStatus = (cols[5] && cols[5].trim() !== "") ? cols[5].trim() : "Active";
                
                const pType = (cols[6] && cols[6].trim() !== "") ? cols[6].trim() : "Bulk";
                const pSerial = (cols[7] && cols[7].trim() !== "") ? cols[7].trim() : "";

                let finalQty = pStock;
                let finalDetails = pDetails;
                
                if (pType.toLowerCase() === 'serialized') {
                    finalQty = 1; // Force 1
                    if (pSerial) {
                        finalDetails += ` [SN: ${pSerial}]`;
                    }
                }

                if(pID && pName) {
                    const existingItem = allMaterialStockData.find(item => 
                        (item.productID || item.productId).toLowerCase() === pID.toLowerCase()
                    );

                    if (existingItem) {
                        const sites = existingItem.sites || {};
                        const currentSiteStock = parseFloat(sites[pSite] || 0);
                        sites[pSite] = currentSiteStock + finalQty;
                        
                        let newGlobalStock = 0;
                        Object.values(sites).forEach(q => newGlobalStock += parseFloat(q));

                        updates[existingItem.key] = {
                            stockQty: newGlobalStock,
                            sites: sites,
                            status: pStatus,
                            lastUpdated: firebase.database.ServerValue.TIMESTAMP
                        };
                        updateCount++;
                    } else {
                        const newRef = database.ref('material_stock').push();
                        const sitesInit = {};
                        if(finalQty > 0) sitesInit[pSite] = finalQty;
                        
                        updates[newRef.key] = {
                            productID: pID, 
                            productName: pName, 
                            details: finalDetails,
                            stockQty: finalQty, 
                            transferredQty: 0, 
                            sites: sitesInit, 
                            status: pStatus, 
                            timestamp: Date.now()
                        };
                        count++;
                    }
                }
            }
        }
        
        const totalOps = count + updateCount;
        if (totalOps > 0) {
            if(confirm(`Found ${totalOps} valid records:\n- ${count} New Items\n- ${updateCount} Updated Items\n\nProceed with upload?`)) {
                await database.ref('material_stock').update(updates);
                alert(`Successfully processed ${totalOps} records.`);
                populateMaterialStock();
            }
        } else { alert("No valid data found in CSV."); }
        document.getElementById('ms-csv-file-input').value = '';
    };
    reader.readAsText(file);
}

function handleGetTemplate() {
    const headers = ["Product ID", "Product Name", "Details", "Stock QTY", "Site", "Status", "Item Type", "Serial Number"];
    const row1 = "BULK-001,Cement 50kg,Grey OPC,100,Main Store,Active,Bulk,";
    const row2 = "TOOL-101,Hilti Drill,Cordless,1,Main Store,Broken,Serialized,SN-987654";
    const row3 = "OLD-999,Ceramic Tile,60x60 White,50,Main Store,Inactive,Bulk,";

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + row1 + "\n" + row2 + "\n" + row3;
    
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
    
    const clearBtn = document.getElementById('ms-clear-form-btn');
    if (clearBtn) clearBtn.addEventListener('click', handleClearMaterialForm);
});

window.initiateReturn = function(transferKey) {
    const originalTask = allTransferData.find(t => t.key === transferKey);
    if (!originalTask) {
        alert("Error: Original transaction data not found.");
        return;
    }
    openTransferModal('Return');
    if (transferProductChoices) {
        transferProductChoices.setChoiceByValue(originalTask.productId || originalTask.productID);
    }
    document.getElementById('tf-product-name').value = originalTask.productName;
    document.getElementById('tf-details').value = `Return of: ${originalTask.controlNumber || originalTask.ref}`;
    document.getElementById('tf-req-qty').value = originalTask.receivedQty || 0;
    const returnFrom = originalTask.toSite || originalTask.toLocation;
    const returnTo = originalTask.fromSite || originalTask.fromLocation;
    if (tfFromSiteChoices) tfFromSiteChoices.setChoiceByValue(returnFrom);
    if (tfToSiteChoices) tfToSiteChoices.setChoiceByValue(returnTo);
    document.querySelector('#transfer-job-modal .modal-content').scrollTop = 0;
};