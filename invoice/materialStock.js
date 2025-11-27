// ==========================================================================
// MATERIAL STOCK MANAGEMENT (Smart Search + Site Names + Layout Fix)
// ==========================================================================

let allMaterialStockData = [];
let msProductChoices = null; // Instance for the smart dropdown

// 1. Load Data from Firebase
async function populateMaterialStock() {
    const tableBody = document.getElementById('ms-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading stock data...</td></tr>';

    try {
        const snapshot = await db.ref('material_stock').once('value');
        const data = snapshot.val();
        allMaterialStockData = [];

        if (data) {
            Object.keys(data).forEach(key => {
                allMaterialStockData.push({ key: key, ...data[key] });
            });
        }

        renderMaterialStockTable(allMaterialStockData);

    } catch (error) {
        console.error("Error loading material stock:", error);
        tableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error loading data. Check console.</td></tr>';
    }
}

// 2. Render Table (Fixed Alignment & Site Names)
function renderMaterialStockTable(data) {
    const tableBody = document.getElementById('ms-table-body');
    const searchInput = document.getElementById('ms-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    // Helper: Get Site Name from Cache
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
        return siteCode; // Fallback
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
        // Calculate Totals
        let totalStock = 0;
        let detailRows = '';
        let hasSites = false;

        if (item.sites) {
            Object.entries(item.sites).forEach(([site, qty]) => {
                const q = parseFloat(qty);
                if (q !== 0) {
                    hasSites = true;
                    totalStock += q;
                    // Use helper to show "175 - Project Name"
                    detailRows += `
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
            detailRows = `<tr><td style="padding-left: 20px;">Unassigned (Global)</td><td>${legacyStock}</td></tr>`;
        }

        const transferred = parseFloat(item.transferredQty) || 0;
        const uniqueId = `detail-${item.key}`;

        // PARENT ROW
        const parentRow = document.createElement('tr');
        parentRow.innerHTML = `
            <td><button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button></td>
            <td>${item.productID || item.productId}</td>
            <td><strong>${item.productName}</strong></td>
            <td>${item.details || ''}</td>
            <td style="font-size: 1.1em; font-weight: bold; color: #003A5C;">${totalStock}</td>
            <td>${transferred}</td>
            <td style="text-align: center;">
                <button class="delete-btn ms-delete-btn" data-key="${item.key}" style="padding: 5px 10px; font-size: 0.8rem;" title="Delete Item">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

        // CHILD ROW
        const childRow = document.createElement('tr');
        childRow.id = uniqueId;
        childRow.className = 'stock-child-row hidden';
        childRow.innerHTML = `
            <td colspan="7" style="padding: 10px 20px;">
                <div style="font-weight:bold; margin-bottom:5px; color:#555; border-bottom: 1px solid #ddd;">Stock Breakdown:</div>
                <table class="stock-detail-table">
                    <tbody>${detailRows}</tbody>
                </table>
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

// --- 3. SMART MODAL: Search & Add ---

function openNewMaterialModal() {
    document.getElementById('ms-new-material-form').reset();
    
    // Reset UI
    const nameInput = document.getElementById('ms-new-name');
    const detailsInput = document.getElementById('ms-new-details');
    nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff';
    detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff';
    
    delete document.getElementById('ms-new-material-form').dataset.existingKey;
    
    document.getElementById('ms-modal-title').textContent = "Add Material / Stock";
    document.getElementById('ms-save-new-btn').textContent = "Save";

    // 1. Initialize Smart Search (Choices.js)
    const selectEl = document.getElementById('ms-new-id');
    if (msProductChoices) msProductChoices.destroy();
    
    // Prepare options from existing data
    const options = allMaterialStockData.map(item => ({
        value: item.productID || item.productId,
        label: `${item.productID} - ${item.productName}`, // Show "ID - Name"
        customProperties: { 
            name: item.productName, 
            details: item.details,
            key: item.key
        }
    }));

    msProductChoices = new Choices(selectEl, {
        choices: options,
        searchEnabled: true,
        shouldSort: false,
        itemSelectText: '',
        placeholder: true,
        placeholderValue: 'Type Product ID or Name...',
        removeItemButton: true,
        addItems: true, // Allows adding NEW IDs
        addItemText: (value) => `Press Enter to create new ID: <b>"${value}"</b>`
    });

    // 2. Handle Selection (Auto-Fill)
    selectEl.addEventListener('change', (e) => {
        const val = msProductChoices.getValue(true);
        const selectedItem = msProductChoices._store.choices.find(c => c.value === val);

        if (selectedItem && selectedItem.customProperties && selectedItem.customProperties.key) {
            // EXISTING ITEM SELECTED
            const data = selectedItem.customProperties;
            nameInput.value = data.name;
            detailsInput.value = data.details;
            
            // Lock fields
            nameInput.readOnly = true; nameInput.style.backgroundColor = '#e9ecef';
            detailsInput.readOnly = true; detailsInput.style.backgroundColor = '#e9ecef';
            
            document.getElementById('ms-new-material-form').dataset.existingKey = data.key;
            document.getElementById('ms-modal-title').textContent = "Add Stock to Existing Product";
        } else {
            // NEW ITEM (User typed a new ID)
            // Only clear if we switched from an existing item
            if (nameInput.readOnly) {
                nameInput.value = '';
                detailsInput.value = '';
            }
            // Unlock fields
            nameInput.readOnly = false; nameInput.style.backgroundColor = '#fff';
            detailsInput.readOnly = false; detailsInput.style.backgroundColor = '#fff';
            
            delete document.getElementById('ms-new-material-form').dataset.existingKey;
            document.getElementById('ms-modal-title').textContent = "Register New Product";
        }
    });

    // 3. Populate Site Dropdown
    const siteSelect = document.getElementById('ms-new-site-select');
    if (siteSelect) {
        siteSelect.innerHTML = ''; 
        const mainOpt = document.createElement('option');
        mainOpt.value = "Main Store"; mainOpt.textContent = "Main Store";
        siteSelect.appendChild(mainOpt);

        const cachedSites = localStorage.getItem('cached_SITES');
        if (cachedSites) { 
            try { 
                const sitesData = JSON.parse(cachedSites).data || []; 
                sitesData.forEach(site => {
                    if (site.site !== "Main Store") {
                        const opt = document.createElement('option');
                        opt.value = site.site;
                        opt.textContent = `${site.site} - ${site.description}`;
                        siteSelect.appendChild(opt);
                    }
                });
            } catch (e) {} 
        }
    }

    document.getElementById('ms-new-material-modal').classList.remove('hidden');
}

// --- 4. SAVE LOGIC ---
async function handleSaveNewMaterial() {
    const form = document.getElementById('ms-new-material-form');
    const existingKey = form.dataset.existingKey;
    
    // Get ID from Choices.js
    const id = msProductChoices ? msProductChoices.getValue(true) : '';
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
            // --- UPDATE EXISTING ---
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
            // --- CREATE NEW ---
            // Double check duplicate if manual entry
            const duplicate = allMaterialStockData.find(m => (m.productID || m.productId || '').toLowerCase() === id.toLowerCase());
            if (duplicate) {
                alert("Product ID already exists. Please select it from the dropdown.");
                btn.disabled = false;
                return;
            }

            const sitesInit = {};
            if (stockQty > 0) {
                sitesInit[selectedSite] = stockQty;
            }

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
}

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