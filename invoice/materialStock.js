// materialStock.js

let allMaterialStockData = [];
let allTransferData = [];
let msProductChoices = null;
let lastTypedProductID = "";
let currentCategoryFilter = null;

// Constants
const STOCK_CACHE_KEY = "cached_MATERIAL_STOCK";
const STOCK_CACHE_DURATION = 24 * 60 * 60 * 1000;

// ==========================================================================
// 1. LOAD DATA (WITH CACHING)
// ==========================================================================
async function populateMaterialStock(forceRefresh = false) {
    const tableBody = document.getElementById('ms-table-body');
    const tabsContainer = document.getElementById('ms-category-tabs');

    if (!tableBody) return;

    // 1. Check Cache First
    if (!forceRefresh) {
        const cached = localStorage.getItem(STOCK_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const age = Date.now() - parsed.timestamp;
                if (age < STOCK_CACHE_DURATION) {
                    console.log("Loading Stock from Cache...");
                    allMaterialStockData = parsed.data || [];
                    await fetchTransfersOnly();
                    renderCategoryTabs();
                    return;
                }
            } catch (e) { console.error("Cache parse error", e); }
        }
    }

    // 2. Fetch Fresh from Firebase
    if(tabsContainer) tabsContainer.innerHTML = '<span style="padding:10px;">Downloading data...</span>';
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Downloading stock data...</td></tr>';

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

        localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify({
            data: allMaterialStockData,
            timestamp: Date.now()
        }));

        const tData = transferSnap.val();
        allTransferData = [];
        if (tData) {
            Object.keys(tData).forEach(key => {
                allTransferData.push({ key: key, ...tData[key] });
            });
            allTransferData.sort((a, b) => b.timestamp - a.timestamp);
        }

        renderCategoryTabs();

    } catch (error) {
        console.error("Error loading material stock:", error);
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error loading data. Check connection.</td></tr>';
    }
}

async function fetchTransfersOnly() {
    const database = (typeof db !== 'undefined') ? db : firebase.database();
    try {
        const transferSnap = await database.ref('transfer_entries').orderByChild('timestamp').once('value');
        const tData = transferSnap.val();
        allTransferData = [];
        if (tData) {
            Object.keys(tData).forEach(key => {
                allTransferData.push({ key: key, ...tData[key] });
            });
            allTransferData.sort((a, b) => b.timestamp - a.timestamp);
        }
    } catch(e) { console.warn("Could not fetch transfers:", e); }
}

// ==========================================================================
// 2. TABS & RENDERING
// ==========================================================================
function renderCategoryTabs() {
    const tabsContainer = document.getElementById('ms-category-tabs');
    const tableBody = document.getElementById('ms-table-body');

    if (!tabsContainer) return;

    const categories = new Set();
    allMaterialStockData.forEach(item => {
        let cat = item.category ? item.category.trim() : "Uncategorized";
        if(cat === "") cat = "Uncategorized";
        categories.add(cat);
    });

    const sortedCats = Array.from(categories).sort();
    let html = '';
    sortedCats.forEach(cat => {
        const activeClass = (currentCategoryFilter === cat) ? 'active' : '';
        html += `<button class="${activeClass}" onclick="filterStockByCategory('${cat}')" style="margin-right:5px; padding: 8px 15px; cursor: pointer; border: none; background: transparent; border-bottom: 3px solid transparent; font-weight: 600; color: #555;">${cat}</button>`;
    });

    if (sortedCats.length === 0) {
        html = '<span style="padding:10px; color:#777;">No categories found. Add items to start.</span>';
    }

    tabsContainer.innerHTML = html;

    const activeTabs = tabsContainer.querySelectorAll('.active');
    activeTabs.forEach(tab => {
        tab.style.borderBottomColor = '#00748C';
        tab.style.color = '#00748C';
    });

    if (!currentCategoryFilter) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#777; font-weight:bold; font-size:1.1em;">Please select a Category tab above to view records.</td></tr>';
    } else {
        renderMaterialStockTable(allMaterialStockData);
    }
}

window.filterStockByCategory = function(category) {
    currentCategoryFilter = category;
    renderCategoryTabs();
    renderMaterialStockTable(allMaterialStockData);
};

// ==========================================================================
// 3. RENDER TABLE (UPDATED: RESTRICT DELETE BUTTON)
// ==========================================================================
function renderMaterialStockTable(data) {
    const tableBody = document.getElementById('ms-table-body');
    const searchInput = document.getElementById('ms-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    // Check Permissions
    const isAdmin = (typeof currentApprover !== 'undefined' && (currentApprover.Role || '').toLowerCase() === 'admin');
    const isIrwin = (typeof currentApprover !== 'undefined' && currentApprover.Name === 'Irwin');

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

    const filtered = data.filter(item => {
        let itemCat = item.category ? item.category.trim() : "Uncategorized";
        if (itemCat === "") itemCat = "Uncategorized";
        if (currentCategoryFilter && itemCat !== currentCategoryFilter) return false;

        const pID = (item.productID || item.productId || '').toLowerCase();
        const pName = (item.productName || '').toLowerCase();
        return pID.includes(searchTerm) || pName.includes(searchTerm);
    });

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#777;">No materials found in this category.</td></tr>';
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
                    breakdownRows += `<tr><td style="width: 70%; padding-left: 20px;">${getSiteDisplayName(site)}</td><td style="width: 30%; font-weight:bold;">${q}</td></tr>`;
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
            return transferID === stockID;
        });

        let historyRows = '';
        if (productTransfers.length === 0) {
            historyRows = '<tr><td colspan="7" style="text-align:center; color:#999; font-style:italic; padding: 20px;">No movement history found.</td></tr>';
        } else {
            productTransfers.forEach(t => {
                const date = t.shippingDate || new Date(t.timestamp).toISOString().split('T')[0];
                const type = t.jobType || t.for || 'Transfer';
                let route = '-';

                if (type === 'Transfer') route = `${t.fromLocation || t.fromSite} -> ${t.toLocation || t.toSite}`;
                else if (type === 'Restock') route = `<span style="color:#28a745;">+ Add to ${t.toLocation || t.toSite}</span>`;
                else if (type === 'Return') route = `<span style="color:#dc3545;">- Return from ${t.fromLocation || t.fromSite}</span>`;
                else if (type === 'Usage') route = `<span style="color:#6f42c1;">- Used at ${t.fromLocation || t.fromSite}</span>`;

                const qtyReceived = t.receivedQty || 0;

                let actionBtn = '';
                const isCompleted = (t.remarks === 'Completed' || t.remarks === 'Received');
                const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : '';
                const isMyReceipt = (t.receiver === currentUser);

                if (isCompleted && isMyReceipt && type !== 'Return') {
                    actionBtn = `<button class="secondary-btn" onclick="initiateReturn('${t.key}')" style="padding:2px 8px; font-size:0.75rem; background-color:#ffc107; color:#212529; border:none; border-radius:4px; cursor:pointer;" title="Return this item"><i class="fa-solid fa-rotate-left"></i> Return</button>`;
                }

                historyRows += `
                    <tr>
                        <td style="font-size:0.85rem;">${date}</td>
                        <td style="font-size:0.85rem; font-weight:600;">${type}</td>
                        <td style="font-size:0.85rem;">${route}</td>
                        <td style="font-size:0.85rem; text-align:center; font-weight:bold;">${qtyReceived}</td>
                        <td style="font-size:0.85rem;">${t.enteredBy || 'System'}</td>
                        <td style="font-size:0.85rem;">${t.remarks}</td>
                        <td style="text-align:center;">${actionBtn}</td>
                    </tr>
                `;
            });
        }

        const uniqueId = `detail-${item.key}`;

        let actionButtons = '';
        if(isAdmin) {
            // All Admins can Edit
            actionButtons += `<button class="secondary-btn" onclick="editMaterialDetails('${item.key}')" style="padding: 5px 10px; font-size: 0.8rem; background-color: #17a2b8; color: white; margin-right: 5px;" title="Edit Details"><i class="fa-solid fa-pen"></i></button>`;

            // --- STRICT CHECK: Only Irwin can see Delete ---
            if (isIrwin) {
                actionButtons += `<button class="delete-btn ms-delete-btn" data-key="${item.key}" style="padding: 5px 10px; font-size: 0.8rem;" title="Delete Item"><i class="fa-solid fa-trash"></i></button>`;
            }
        } else {
            actionButtons = `<small style="color:#999;">View Only</small>`;
        }

        const parentRow = document.createElement('tr');
        parentRow.innerHTML = `
            <td><button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button></td>
            <td>${item.productID || item.productId}</td>
            <td><strong>${item.productName}</strong></td>
            <td><span style="background:#e3f2fd; color:#00748C; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${item.category || 'Uncategorized'}</span></td>
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

// ==========================================================================
// 4. DELETE & EDIT LOGIC (STRICT IRWIN-ONLY DELETE)
// ==========================================================================

window.handleDeleteMaterial = async function(key) {
    const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : '';

    // --- SECURITY CHECK ---
    if (currentUser !== 'Irwin') {
        alert("Access Denied: Only Super Admin (Irwin) can delete items.");
        return;
    }

    // 1. Get Item Details
    const item = allMaterialStockData.find(i => i.key === key);
    if (!item) { alert("Error: Item not found."); return; }

    const productID = item.productID || item.productId;
    const productName = item.productName;

    // 2. Count transactions to be deleted
    const relatedTransfers = allTransferData.filter(t =>
        (t.productID === productID || t.productId === productID)
    );

    const confirmMsg = `⚠️ MASTER DELETE (Super Admin) ⚠️\n\nProduct: ${productName}\nID: ${productID}\n\nThis will DELETE the item AND ALL ${relatedTransfers.length} related transactions history from the database.\n\nThis cannot be undone. Proceed?`;

    if (confirm(confirmMsg)) {
        const database = firebase.database();
        const updates = {};

        // A. Mark Material Stock Item for Deletion
        updates[`material_stock/${key}`] = null;

        // B. Mark ALL Related Transactions for Deletion
        relatedTransfers.forEach(t => {
            updates[`transfer_entries/${t.key}`] = null;
        });

        try {
            // Execute Atomic Update (All or Nothing)
            await database.ref().update(updates);

            alert(`Master Delete Successful.\nRemoved: ${productName}\nDeleted: ${relatedTransfers.length} transactions.`);

            // Refresh
            localStorage.removeItem(STOCK_CACHE_KEY);
            populateMaterialStock(true);

        } catch (e) {
            console.error("Master delete failed:", e);
            alert("Database Error: Could not delete records.");
        }
    }
};

window.editMaterialDetails = function(key) {
    const item = allMaterialStockData.find(i => i.key === key);
    if (!item) return;

    document.getElementById('ms-new-material-modal').classList.remove('hidden');
    document.getElementById('ms-new-material-form').reset();
    document.getElementById('ms-modal-title').textContent = "Edit Item Details";

    const form = document.getElementById('ms-new-material-form');
    form.dataset.editMode = "details_only";
    form.dataset.existingKey = key;

    document.getElementById('ms-new-name').value = item.productName || '';
    document.getElementById('ms-new-details').value = item.details || '';

    const catInput = document.getElementById('ms-new-category');
    if(catInput) catInput.value = item.category || '';

    document.getElementById('ms-id-search-group').classList.add('hidden');
    document.getElementById('ms-id-display-group').classList.remove('hidden');
    document.getElementById('ms-edit-id-display').value = item.productID || item.productId;

    document.getElementById('ms-save-new-btn').textContent = "Update Details";
};

async function handleSaveNewMaterial() {
    const form = document.getElementById('ms-new-material-form');
    let targetKey = form.dataset.existingKey;
    let id = msProductChoices ? msProductChoices.getValue(true) : '';
    if (!id && lastTypedProductID) id = lastTypedProductID.trim();

    const name = document.getElementById('ms-new-name').value.trim();
    const details = document.getElementById('ms-new-details').value.trim();
    const catInput = document.getElementById('ms-new-category');
    const category = catInput ? catInput.value.trim() : '';

    const selectedSite = document.getElementById('ms-new-site-select') ? document.getElementById('ms-new-site-select').value : "Main Store";
    const stockQty = parseFloat(document.getElementById('ms-new-stock-qty').value) || 0;
    const statusSelect = document.getElementById('ms-new-status');
    const status = statusSelect ? statusSelect.value : 'Active';
    const editMode = form.dataset.editMode;

    const btn = document.getElementById('ms-save-new-btn');
    btn.disabled = true; btn.textContent = "Processing...";

    const database = (typeof db !== 'undefined') ? db : firebase.database();

    try {
        if (editMode === "details_only" && targetKey) {
            await database.ref(`material_stock/${targetKey}`).update({
                productName: name,
                details: details,
                category: category,
                status: status,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            alert("Details updated successfully!");
            document.getElementById('ms-new-material-modal').classList.add('hidden');
            localStorage.removeItem(STOCK_CACHE_KEY);
            populateMaterialStock(true);
            btn.disabled = false; btn.textContent = "Save";
            return;
        }

        if (!id) { alert("Product ID is required."); btn.disabled = false; return; }
        if (!category) { alert("Category is required."); btn.disabled = false; return; }

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
                category: category,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            alert(`Added ${selectedSite} to existing product!`);

        } else {
            const sitesInit = {};
            if (stockQty > 0) sitesInit[selectedSite] = stockQty;

            const newMaterial = {
                productID: id, productName: name, details: details,
                category: category,
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
        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);

    } catch (error) { console.error("Save Error:", error); alert("Failed to save."); }
    finally { btn.disabled = false; btn.textContent = "Save"; }
}

// ==========================================================================
// 5. CSV & TEMPLATE
// ==========================================================================
function handleGetTemplate() {
    const headers = ["Product ID", "Product Name", "Category", "Details", "Stock QTY", "Site", "Status", "Item Type"];
    const row1 = "BULK-001,Cement 50kg,Materials,Grey OPC,100,Main Store,Active,Bulk";
    const row2 = "TOOL-101,Hilti Drill,Tools,Cordless,1,Main Store,Broken,Serialized";

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + row1 + "\n" + row2;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "material_stock_template_v2.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

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

            if (cols.length >= 3) {
                const pID = cols[0].trim();
                const pName = cols[1].trim();
                const pCat = cols[2].trim();
                const pDetails = cols[3] ? cols[3].trim() : '';
                const pStock = parseFloat(cols[4]) || 0;
                const pSite = (cols[5] && cols[5].trim() !== "") ? cols[5].trim() : "Main Store";

                if(pID && pName) {
                    const existingItem = allMaterialStockData.find(item =>
                        (item.productID || item.productId).toLowerCase() === pID.toLowerCase()
                    );

                    if (existingItem) {
                        const sites = existingItem.sites || {};
                        sites[pSite] = (parseFloat(sites[pSite]||0)) + pStock;
                        let total = 0; Object.values(sites).forEach(v=>total+=parseFloat(v));

                        updates[existingItem.key] = {
                            stockQty: total,
                            sites: sites,
                            category: pCat,
                            lastUpdated: firebase.database.ServerValue.TIMESTAMP
                        };
                    } else {
                        const newKey = firebase.database().ref('material_stock').push().key;
                        const sites = {}; if(pStock>0) sites[pSite]=pStock;
                        updates[newKey] = {
                            productID: pID,
                            productName: pName,
                            category: pCat,
                            details: pDetails,
                            stockQty: pStock,
                            sites: sites,
                            timestamp: Date.now()
                        };
                        count++;
                    }
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            if(confirm(`Process ${Object.keys(updates).length} records?`)) {
                await firebase.database().ref('material_stock').update(updates);
                alert("Upload Complete!");
                localStorage.removeItem(STOCK_CACHE_KEY);
                populateMaterialStock(true);
            }
        }
        document.getElementById('ms-csv-file-input').value = '';
    };
    reader.readAsText(file);
}

window.toggleStockDetail = function(rowId, btn) {
    const row = document.getElementById(rowId);
    if (row) {
        row.classList.toggle('hidden');
        btn.textContent = row.classList.contains('hidden') ? '+' : '-';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('ms-refresh-btn');
    if(refreshBtn) refreshBtn.addEventListener('click', () => {
        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);
    });

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

window.openNewMaterialModal = async function() {
    if (!allMaterialStockData || allMaterialStockData.length === 0) {
        const btn = document.getElementById('ms-add-new-btn');
        if(btn) btn.textContent = "Loading Data...";
        await populateMaterialStock(false);
        if(btn) btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Material';
    }

    document.getElementById('ms-new-material-modal').classList.remove('hidden');
    document.getElementById('ms-new-material-form').reset();
    document.getElementById('ms-modal-title').textContent = "Register New Product";

    document.getElementById('ms-id-search-group').classList.remove('hidden');
    document.getElementById('ms-id-display-group').classList.add('hidden');

    const form = document.getElementById('ms-new-material-form');
    form.dataset.editMode = "new";
    delete form.dataset.existingKey;
    form.currentProductData = null;

    if(msProductChoices) msProductChoices.destroy();

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

    selectEl.addEventListener('addItem', (e) => handleMainSelection(e.detail.value));
    selectEl.addEventListener('removeItem', () => handleMainSelection(null));

    const siteSelect = document.getElementById('ms-new-site-select');
    if (siteSelect) {
        siteSelect.innerHTML = '<option value="Main Store">Main Store</option>';
        let sitesData = [];
        const cachedSites = localStorage.getItem('cached_SITES');
        if (cachedSites) { try { sitesData = JSON.parse(cachedSites).data || []; } catch (e) {} }
        else {
            try {
                const res = await fetch("https://cdn.jsdelivr.net/gh/DC-database/Hub@main/Site.csv");
                const txt = await res.text();
                const lines = txt.split('\n');
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length >= 2) {
                        sitesData.push({ site: cols[0].replace(/"/g,'').trim(), description: cols[1].replace(/"/g,'').trim() });
                    }
                }
            } catch(e) {}
        }

        if(sitesData.length > 0) {
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

        const newSiteSelect = siteSelect.cloneNode(true);
        siteSelect.parentNode.replaceChild(newSiteSelect, siteSelect);
    }

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
};

window.handleClearMaterialForm = function() {
    document.getElementById('ms-new-material-form').reset();
};

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