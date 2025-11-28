// ==========================================================================
// MATERIAL STOCK MANAGEMENT (With Scrollable History & Breakdown)
// ==========================================================================

let allMaterialStockData = [];
let allTransferData = []; // Store transfers for history
let msProductChoices = null; 
let lastTypedProductID = ""; 

// 1. Load Data from Firebase (Stock + Transfers)
async function populateMaterialStock() {
    const tableBody = document.getElementById('ms-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading stock data...</td></tr>';

    try {
        // Fetch both Stock and Transfers in parallel
        const [stockSnap, transferSnap] = await Promise.all([
            db.ref('material_stock').once('value'),
            db.ref('transfer_entries').orderByChild('timestamp').once('value')
        ]);

        // Process Stock
        const stockData = stockSnap.val();
        allMaterialStockData = [];
        if (stockData) {
            Object.keys(stockData).forEach(key => {
                allMaterialStockData.push({ key: key, ...stockData[key] });
            });
        }

        // Process Transfers
        const tData = transferSnap.val();
        allTransferData = [];
        if (tData) {
            Object.keys(tData).forEach(key => {
                allTransferData.push({ key: key, ...tData[key] });
            });
            // Sort newest first
            allTransferData.sort((a, b) => b.timestamp - a.timestamp);
        }

        renderMaterialStockTable(allMaterialStockData);

    } catch (error) {
        console.error("Error loading material stock:", error);
        tableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error loading data. Check console.</td></tr>';
    }
}

// 2. Render Table (With Scrollable Breakdown)
function renderMaterialStockTable(data) {
    const tableBody = document.getElementById('ms-table-body');
    const searchInput = document.getElementById('ms-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    // Helper: Get Site Name
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
        // --- 1. Calculate Current Stock ---
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

        // --- 2. Build History Rows ---
        const productTransfers = allTransferData.filter(t => 
            (t.productID === item.productID) || (t.productID === item.productId) ||
            (t.productId === item.productID) || (t.productId === item.productId)
        );

        let historyRows = '';
        if (productTransfers.length === 0) {
            historyRows = '<tr><td colspan="6" style="text-align:center; color:#999; font-style:italic; padding: 20px;">No movement history found.</td></tr>';
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

        // --- CHILD ROW (WITH SCROLLBARS) ---
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
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Route</th>
                                        <th style="text-align:center;">Qty (Ord/App/Rec)</th>
                                        <th>By</th>
                                        <th>Status</th>
                                    </tr>
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
// 3. SMART MODAL: Search & Add (Standard)
// ==========================================================================
async function openNewMaterialModal() {
    document.getElementById('ms-new-material-form').reset();
    
    const nameInput = document.getElementById('ms-new-name');
    const detailsInput = document.getElementById('ms-new-details');
    nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff';
    detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff';
    delete document.getElementById('ms-new-material-form').dataset.existingKey;
    document.getElementById('ms-modal-title').textContent = "Register New Product";
    document.getElementById('ms-save-new-btn').textContent = "Save";

    const selectEl = document.getElementById('ms-new-id');
    if (msProductChoices) msProductChoices.destroy();
    
    const options = allMaterialStockData.map(item => ({
        value: item.productID || item.productId,
        label: `${item.productID} - ${item.productName}`,
        customProperties: { name: item.productName, details: item.details, key: item.key }
    }));

    msProductChoices = new Choices(selectEl, {
        choices: options, searchEnabled: true, shouldSort: false, itemSelectText: '',
        placeholder: true, placeholderValue: 'Type Product ID or Name...',
        removeItemButton: true, addItems: true,
        noResultsText: 'Press Enter (or Click Away) to use this ID',
        addItemText: (value) => `Press Enter to add ID: <b>"${value}"</b>`
    });

    const handleSelection = (val) => {
        if (!val) return;
        const selectedItem = msProductChoices._store.choices.find(c => c.value === val);

        if (selectedItem && selectedItem.customProperties && selectedItem.customProperties.key) {
            const data = selectedItem.customProperties;
            nameInput.value = data.name;
            detailsInput.value = data.details;
            nameInput.readOnly = true; nameInput.style.backgroundColor = '#e9ecef';
            detailsInput.readOnly = true; detailsInput.style.backgroundColor = '#e9ecef';
            document.getElementById('ms-new-material-form').dataset.existingKey = data.key;
            document.getElementById('ms-modal-title').textContent = "Add Stock to Existing Product";
        } else {
            if (nameInput.readOnly) { nameInput.value = ''; detailsInput.value = ''; }
            nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff';
            detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff';
            delete document.getElementById('ms-new-material-form').dataset.existingKey;
            document.getElementById('ms-modal-title').textContent = "Register New Product";
        }
    };

    selectEl.addEventListener('change', (e) => handleSelection(e.detail.value));
    selectEl.addEventListener('addItem', (e) => handleSelection(e.detail.value));

    lastTypedProductID = "";
    if (msProductChoices.input && msProductChoices.input.element) {
        msProductChoices.input.element.addEventListener('input', function() {
            lastTypedProductID = this.value; 
        });
        msProductChoices.input.element.addEventListener('blur', function() {
            const val = lastTypedProductID.trim();
            const hasSelection = msProductChoices.getValue(true);
            if (val && !hasSelection) {
                msProductChoices.setValue([{ value: val, label: val }]);
                handleSelection(val);
            }
        });
    }

    const siteSelect = document.getElementById('ms-new-site-select');
    if (siteSelect) {
        siteSelect.innerHTML = '<option value="Main Store">Main Store</option>'; 
        let sitesData = [];
        const cachedSites = localStorage.getItem('cached_SITES');
        if (cachedSites) { try { sitesData = JSON.parse(cachedSites).data || []; } catch (e) {} }

        if (sitesData.length === 0) {
            try {
                const res = await fetch("https://cdn.jsdelivr.net/gh/DC-database/Hub@main/Site.csv");
                const txt = await res.text();
                const lines = txt.split('\n');
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length >= 2) sitesData.push({ site: cols[0].replace(/"/g,'').trim(), description: cols[1].replace(/"/g,'').trim() });
                }
            } catch(e) {}
        }
        
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

    document.getElementById('ms-new-material-modal').classList.remove('hidden');
}

// --- 4. SAVE LOGIC ---
async function handleSaveNewMaterial() {
    const form = document.getElementById('ms-new-material-form');
    const existingKey = form.dataset.existingKey;
    
    let id = msProductChoices ? msProductChoices.getValue(true) : '';
    if (!id && lastTypedProductID) {
        id = lastTypedProductID.trim(); 
    }

    const name = document.getElementById('ms-new-name').value.trim();
    const details = document.getElementById('ms-new-details').value.trim();
    const selectedSite = document.getElementById('ms-new-site-select').value;
    const stockQty = parseFloat(document.getElementById('ms-new-stock-qty').value) || 0;

    if (!id) { alert("Product ID is required."); return; }
    if (!name) { alert("Product Name is required."); return; }

    const btn = document.getElementById('ms-save-new-btn');
    btn.disabled = true; btn.textContent = "Saving...";

    try {
        if (existingKey) {
            const item = allMaterialStockData.find(m => m.key === existingKey);
            let sites = item.sites || {};
            const currentSiteStock = parseFloat(sites[selectedSite]) || 0;
            const newSiteStock = currentSiteStock + stockQty;
            sites[selectedSite] = newSiteStock;
            
            let newGlobalStock = 0;
            Object.values(sites).forEach(q => newGlobalStock += parseFloat(q));

            await db.ref(`material_stock/${existingKey}`).update({
                stockQty: newGlobalStock,
                sites: sites,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            alert(`Stock added to ${selectedSite}!`);

        } else {
            const duplicate = allMaterialStockData.find(m => (m.productID || m.productId || '').toLowerCase() === id.toLowerCase());
            if (duplicate) {
                alert("Product ID already exists.");
                btn.disabled = false;
                return;
            }

            const sitesInit = {};
            if (stockQty > 0) sitesInit[selectedSite] = stockQty;

            const newMaterial = {
                productID: id,
                productName: name,
                details: details,
                stockQty: stockQty,
                transferredQty: 0,
                sites: sitesInit,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            await db.ref('material_stock').push(newMaterial);
            alert("New Product Registered!");
        }

        document.getElementById('ms-new-material-modal').classList.add('hidden');
        populateMaterialStock(); 

    } catch (error) {
        console.error(error); alert("Failed to save.");
    } finally {
        btn.disabled = false; btn.textContent = "Save";
    }
}

// --- 5. Delete ---
window.handleDeleteMaterial = async function(key) {
    if (!confirm("WARNING: This will permanently delete this material.\n\nAre you sure?")) return;
    try {
        await db.ref(`material_stock/${key}`).remove();
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
                    const newRef = db.ref('material_stock').push();
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
                await db.ref('material_stock').update(updates);
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