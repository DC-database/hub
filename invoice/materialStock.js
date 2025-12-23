// materialStock.js - V10.1 (F.RRR.SSSSS Format & Updated Template)

let allMaterialStockData = [];
let allTransferData = [];
let msProductChoices = null;
let lastTypedProductID = "";
let currentCategoryFilter = 'All';

// Constants
const STOCK_CACHE_KEY = "cached_MATERIAL_STOCK";
const STOCK_CACHE_DURATION = 24 * 60 * 60 * 1000;

// --- 1. STOCK LEGENDS (F / RRR Structure) ---
const STOCK_LEGENDS = {
    "1": {
        "name": "Civil & Structural",
        "relations": {
            "101": "Concrete & Cementitious",
            "102": "Reinforcement Steel",
            "103": "Structural Steel",
            "104": "Masonry (Blocks/Bricks)",
            "105": "Formwork & Shuttering",
            "106": "Waterproofing",
            "107": "Earthworks & Backfill",
            "108": "Roadworks & Paving",
            "109": "Aggregates & Sand",
            "110": "Fasteners & Anchors",
            "111": "Chemicals & Admixtures",
            "112": "Geotextiles & Drainage"
        }
    },
    "2": {
        "name": "Architectural & Finishes",
        "relations": {
            "201": "Tiles & Stone",
            "202": "Paints & Coatings",
            "203": "Gypsum & Ceiling Systems",
            "204": "Doors, Windows & Ironmongery",
            "205": "Glass & Glazing",
            "206": "Flooring (Vinyl/Carpet/Laminate)",
            "207": "Joinery & Woodworks",
            "208": "Metal Works & Handrails",
            "209": "Sealants, Adhesives & Grouts",
            "210": "Wall Cladding & Panels",
            "211": "Sanitary Fixtures & Accessories & Parts",
            "212": "Accessories & Hardware"
        }
    },
    "3": {
        "name": "Electrical",
        "relations": {
            "301": "Cables & Wires",
            "302": "Conduits, Trunking & Cable Management",
            "303": "Switches, Sockets & Wiring Devices",
            "304": "Lighting Fixtures & Lamps",
            "305": "Distribution, Breakers & Panels",
            "306": "Earthing & Lightning Protection",
            "307": "Cable Accessories (Lugs, Glands, Terminations)",
            "308": "ELV / ICT (Data, CCTV, Access)",
            "309": "Batteries & UPS",
            "310": "Electrical Consumables"
        }
    },
    "4": {
        "name": "Mechanical (HVAC)",
        "relations": {
            "401": "HVAC Equipment",
            "402": "Ventilation System",
            "403": "Plumbing",
            "404": "Valves & Controls",
            "405": "Insulation & Cladding",
            "406": "Diffusers, Grilles & Louvers",
            "407": "Scaffolding",
            "408": "Refrigerant & Copper Pipe",
            "409": "Filters & Spares",
            "410": "HVAC Consumables"
        }
    },
    "5": {
        "name": "HSE / PPE",
        "relations": {
            "501": "PPE - Personal Protective Equipment",
            "502": "Medical Supplies",
            "503": "Code Not In USE",
            "504": "Code Not In USE",
            "505": "Code Not In USE",
            "506": "Respiratory Protection",
            "507": "Code Not In USE",
            "508": "Code Not In USE",
            "509": "Hazardous Signage",
            "510": "Fire Safety"
        }
    },
    "6": {
        "name": "Office & Site Facilities",
        "relations": {
            "601": "Office Supplies",
            "602": "Cleaning & Hygiene",
            "603": "Pantry & Drinking Water",
            "604": "Furniture & Fixtures",
            "605": "Electronics Device & Appliances",
            "606": "Code Not In USE",
            "607": "Temporary Utilities",
            "608": "Waste Management",
            "609": "",
            "610": "Misc Facilities Supplies"
        }
    },
    "7": {
        "name": "Equipment & Plant",
        "relations": {
            "701": "Heavy Equipment",
            "702": "Plant",
            "703": "Generators & Power Equipment",
            "704": "Lifting & Rigging",
            "705": "Vehicles & Transport",
            "706": "Code Not In USE",
            "707": "Spares & Maintenance",
            "708": "Fuel & Lubricants",
            "709": "Welding & Cutting Equipment",
            "710": "Safety Barriers & Traffic"
        }
    },
    "8": {
        "name": "Tools & Consumables",
        "relations": {
            "801": "Power Tools",
            "802": "Hand Tools",
            "803": "Tool Accessories (Bits/Blades)",
            "804": "Code Not In USE",
            "805": "Abrasives (Discs/Sandpaper)",
            "806": "Chemicals & Adhesives (Epoxy/Silicone)",
            "807": "Marking & Measuring",
            "808": "Packaging & Protection",
            "809": "Code Not In USE",
            "810": "General Consumables"
        }
    },
    "9": {
        "name": "Other / Unclassified",
        "relations": {
            "901": "Miscellaneous",
            "902": "Client-supplied / Unknown",
            "903": "Scrap / Returns"
        }
    }
};

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
    if (!tabsContainer) return;

    // 1. Identify which families actually have data
    const activeFamilyCodes = new Set();
    allMaterialStockData.forEach(item => {
        if (item.familyCode) activeFamilyCodes.add(item.familyCode);
    });

    // 2. Safety Check: If current filter is empty/gone, reset to All
    if (currentCategoryFilter !== 'All' && !activeFamilyCodes.has(currentCategoryFilter)) {
        currentCategoryFilter = 'All';
    }

    // 3. Generate HTML
    let html = `<button class="${currentCategoryFilter === 'All' ? 'active' : ''}" onclick="filterStockByCategory('All')" style="margin-right:5px; padding: 8px 15px; cursor: pointer; border: none; background: transparent; border-bottom: 3px solid transparent; font-weight: 600; color: #555; white-space: nowrap;">All Families</button>`;

    const sortedFamilies = Object.keys(STOCK_LEGENDS).sort((a, b) => parseInt(a) - parseInt(b));

    sortedFamilies.forEach(code => {
        // ONLY RENDER IF DATA EXISTS IN THIS FAMILY
        if (activeFamilyCodes.has(code)) {
            const name = STOCK_LEGENDS[code].name;
            const activeClass = (currentCategoryFilter === code) ? 'active' : '';
            
            html += `<button class="${activeClass}" onclick="filterStockByCategory('${code}')" style="margin-right:5px; padding: 8px 15px; cursor: pointer; border: none; background: transparent; border-bottom: 3px solid transparent; font-weight: 600; color: #555; white-space: nowrap;">
                        ${name} <span style="font-size: 0.75rem; color: #dc3545; font-weight: normal; margin-left: 4px;">[${code}]</span>
                     </button>`;
        }
    });

    tabsContainer.innerHTML = html;

    const activeTabs = tabsContainer.querySelectorAll('.active');
    activeTabs.forEach(tab => {
        tab.style.borderBottomColor = '#00748C';
        tab.style.color = '#00748C';
        tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });

    renderMaterialStockTable(allMaterialStockData);
}

window.filterStockByCategory = function(category) {
    currentCategoryFilter = category;
    renderCategoryTabs();
    renderMaterialStockTable(allMaterialStockData);
};

// ==========================================================================
// RENDER TABLE (With Super Admin Edit, Item Delete & Site-Specific Delete)
// ==========================================================================
function renderMaterialStockTable(data) {
    const tableBody = document.getElementById('ms-table-body');
    const searchInput = document.getElementById('ms-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const countDisplay = document.getElementById('ms-total-count'); 

    // Check Permissions
    const isAdmin = (typeof currentApprover !== 'undefined' && (currentApprover.Role || '').toLowerCase() === 'admin');
    const isIrwin = (typeof currentApprover !== 'undefined' && currentApprover.Name === 'Irwin');

    // Show/Hide Bulk Button (Irwin Only)
    const bulkBtn = document.getElementById('ms-bulk-delete-btn');
    if (bulkBtn) {
        if (isIrwin) bulkBtn.classList.remove('hidden');
        else bulkBtn.classList.add('hidden');
    }

    // --- HEADER CHECKBOX LOGIC ---
    const tableHeadRow = document.querySelector('#ms-table thead tr');
    if (tableHeadRow) {
        if (isIrwin) {
            if(!document.getElementById('ms-select-all-header')) {
                tableHeadRow.children[0].innerHTML = '<input type="checkbox" id="ms-select-all-header" style="cursor:pointer;">';
                setTimeout(() => {
                    const selectAll = document.getElementById('ms-select-all-header');
                    if(selectAll) {
                        selectAll.onclick = (e) => {
                            document.querySelectorAll('.ms-row-checkbox').forEach(cb => cb.checked = e.target.checked);
                        };
                    }
                }, 100);
            }
        } else {
            tableHeadRow.children[0].innerHTML = '';
        }
    }

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
        // Family Filter Logic
        if (currentCategoryFilter && currentCategoryFilter !== 'All') {
            if (item.familyCode !== currentCategoryFilter) return false;
        }

        const pID = (item.productID || item.productId || '').toLowerCase();
        const pName = (item.productName || '').toLowerCase();
        const pDetails = (item.details || item.relationship || '').toLowerCase();
        
        return pID.includes(searchTerm) || pName.includes(searchTerm) || pDetails.includes(searchTerm);
    });

    if (countDisplay) countDisplay.textContent = `(Total: ${filtered.length})`;

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#777;">No materials found.</td></tr>';
        return;
    }

    filtered.forEach(item => {
        let totalStock = 0;
        let breakdownRows = '';
        let hasSites = false;

        // --- SITE BREAKDOWN LOGIC ---
        if (item.sites) {
            Object.entries(item.sites).forEach(([site, qty]) => {
                const q = parseFloat(qty);
                
                // Show site if quantity > 0 OR if user is Irwin (so he can see 0 qty sites to delete them if needed)
                if (q !== 0 || isIrwin) {
                    hasSites = true;
                    totalStock += q;

                    let deleteSiteAction = '';
                    if (isIrwin) {
                        // The red [x] button to delete ONLY this site
                        deleteSiteAction = `<span onclick="deleteSiteStock('${item.key}', '${site}')" style="color:red; font-weight:bold; cursor:pointer; margin-left:10px; float:right;" title="Delete ONLY this site stock">[x]</span>`;
                    }

                    breakdownRows += `
                        <tr>
                            <td style="width: 70%; padding-left: 20px;">
                                ${getSiteDisplayName(site)} ${deleteSiteAction}
                            </td>
                            <td style="width: 30%; font-weight:bold;">${q}</td>
                        </tr>`;
                }
            });
        }
        
        // Handle Legacy/Global Stock (No sites assigned yet)
        if (!hasSites) {
            const legacyStock = parseFloat(item.stockQty) || 0;
            totalStock = legacyStock;
            breakdownRows = `<tr><td style="padding-left: 20px;">Unassigned (Global)</td><td>${legacyStock}</td></tr>`;
        }

        // --- HISTORY LOGIC ---
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
        let firstColContent = `<button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button>`;

        // --- ACTION BUTTONS PERMISSIONS ---
        if(isAdmin) {
            if (isIrwin) {
                // SUPER ADMIN: Edit Item, Add Stock, Delete Item
                actionButtons += `<button class="secondary-btn" onclick="openSuperAdminEdit('${item.key}')" style="padding: 5px 10px; font-size: 0.8rem; background-color: #00748C; color: white; margin-right: 5px;" title="Edit Details & Add Stock"><i class="fa-solid fa-pen-to-square"></i> Edit</button>`;
                
                actionButtons += `<button class="delete-btn ms-delete-btn" data-key="${item.key}" style="padding: 5px 10px; font-size: 0.8rem;" title="Delete Item"><i class="fa-solid fa-trash"></i></button>`;
                
                // Add Checkbox for Bulk Delete
                firstColContent = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" class="ms-row-checkbox" data-key="${item.key}" data-name="${item.productName}">
                        <button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button>
                    </div>
                `;
            } else {
                // REGULAR ADMIN: Add Stock Only
                actionButtons += `<button class="secondary-btn" onclick="openAddStockModal('${item.key}')" style="padding: 5px 10px; font-size: 0.8rem; background-color: #28a745; color: white; margin-right: 5px;" title="Add Stock"><i class="fa-solid fa-plus"></i></button>`;
            }
        } else {
            actionButtons = `<small style="color:#999;">View Only</small>`;
        }

        const familyDisplay = item.family || item.category || 'Unclassified';
        const relationshipDisplay = item.relationship || item.details || '';

        // --- PARENT ROW (Main View) ---
        const parentRow = document.createElement('tr');
        parentRow.innerHTML = `
            <td>${firstColContent}</td>
            <td style="font-family:monospace; font-weight:bold; color:#00748C;">${item.productID || item.productId}</td>
            <td><strong>${item.productName}</strong></td>
            <td><span style="background:#e3f2fd; color:#00748C; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${familyDisplay}</span></td>
            <td>${relationshipDisplay}</td>
            <td style="font-size: 1.1em; font-weight: bold; color: #003A5C;">${totalStock}</td>
            <td style="text-align: center;">${actionButtons}</td>
        `;

        // --- CHILD ROW (Hidden Details) ---
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

    // Re-attach listeners for the "Trash" buttons (Item Delete)
    document.querySelectorAll('.ms-delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            handleDeleteMaterial(this.getAttribute('data-key'));
        });
    });
}

// ==========================================================================
// 4. DELETE & EDIT LOGIC
// ==========================================================================

window.handleDeleteMaterial = async function(key) {
    const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : '';

    if (currentUser !== 'Irwin') {
        alert("Access Denied: Only Super Admin (Irwin) can delete items.");
        return;
    }

    const item = allMaterialStockData.find(i => i.key === key);
    if (!item) { alert("Error: Item not found."); return; }

    const productID = item.productID || item.productId;
    const productName = item.productName;

    const relatedTransfers = allTransferData.filter(t =>
        (t.productID === productID || t.productId === productID)
    );

    const confirmMsg = `⚠️ MASTER DELETE (Super Admin) ⚠️\n\nProduct: ${productName}\nID: ${productID}\n\nThis will DELETE the item AND ALL ${relatedTransfers.length} related transactions history.\n\nThis cannot be undone. Proceed?`;

    if (confirm(confirmMsg)) {
        const database = firebase.database();
        const updates = {};

        updates[`material_stock/${key}`] = null;
        relatedTransfers.forEach(t => {
            updates[`transfer_entries/${t.key}`] = null;
        });

        try {
            await database.ref().update(updates);
            alert(`Master Delete Successful.\nRemoved: ${productName}`);
            localStorage.removeItem(STOCK_CACHE_KEY);
            populateMaterialStock(true);
        } catch (e) {
            console.error("Master delete failed:", e);
            alert("Database Error: Could not delete records.");
        }
    }
};

window.deleteStock = window.handleDeleteMaterial; 

// ==========================================================================
// 5. MODAL LOGIC: OPEN & AUTO-POPULATION
// ==========================================================================
window.openNewMaterialModal = async function() {
    // 1. Check if data is loaded
    if (!allMaterialStockData || allMaterialStockData.length === 0) {
        const btn = document.getElementById('ms-add-new-btn');
        if(btn) btn.textContent = "Loading Data...";
        await populateMaterialStock(false);
        if(btn) btn.innerHTML = '<i class="fa-solid fa-plus"></i> Register New Material';
    }

    const modal = document.getElementById('ms-new-material-modal');
    const form = document.getElementById('ms-new-material-form');
    
    modal.classList.remove('hidden');
    form.reset();
    document.getElementById('ms-modal-title').textContent = "Register New Material";

    // Populate Family Dropdown
    const familySelect = document.getElementById('ms-new-family');
    familySelect.innerHTML = '<option value="" disabled selected>Select Family</option>';
    
    Object.keys(STOCK_LEGENDS).sort().forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${code} - ${STOCK_LEGENDS[code].name}`;
        familySelect.appendChild(opt);
    });

    // Reset Relation Dropdown
    const relationSelect = document.getElementById('ms-new-relation');
    relationSelect.innerHTML = '<option value="" disabled selected>Select Relationship</option>';

    // Listener for Family Change
    familySelect.onchange = function() {
        const ff = this.value;
        relationSelect.innerHTML = '<option value="" disabled selected>Select Relationship</option>';
        
        if(STOCK_LEGENDS[ff] && STOCK_LEGENDS[ff].relations) {
            const rels = STOCK_LEGENDS[ff].relations;
            Object.keys(rels).sort().forEach(rr => {
                const opt = document.createElement('option');
                opt.value = rr;
                opt.textContent = `${rr} - ${rels[rr]}`;
                relationSelect.appendChild(opt);
            });
        }
        // Generate Preview ID
        generatePreviewID();
    };

    relationSelect.onchange = generatePreviewID;

    // Reset ID Field
    document.getElementById('ms-new-id-display').value = "Auto-Generated";

    populateModalSiteDropdown();
};

// ==========================================================================
// PASTE YOUR NEW FUNCTION HERE
// ==========================================================================
window.openSuperAdminEdit = function(key) {
    const item = allMaterialStockData.find(i => i.key === key);
    if(!item) return;

    editingItemKey = key; // Set Global Flag to Edit Mode

    // Reuse the "New Material" modal
    const modal = document.getElementById('ms-new-material-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('ms-modal-title').textContent = "Edit Item & Add Stock";
    document.getElementById('ms-save-new-btn').textContent = "Update Item";

    // 1. Fill Text Fields
    document.getElementById('ms-new-name').value = item.productName;
    document.getElementById('ms-new-id-display').value = item.productID;

    // 2. Set Family Dropdown
    const famSelect = document.getElementById('ms-new-family');
    
    // Repopulate if empty
    if(famSelect.options.length <= 1) {
         Object.keys(STOCK_LEGENDS).sort().forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${code} - ${STOCK_LEGENDS[code].name}`;
            famSelect.appendChild(opt);
        });
    }
    famSelect.value = item.familyCode;

    // 3. Trigger Family Change to load Relations
    const relationSelect = document.getElementById('ms-new-relation');
    relationSelect.innerHTML = '<option value="" disabled>Select Relationship</option>';
    if(STOCK_LEGENDS[item.familyCode]) {
        const rels = STOCK_LEGENDS[item.familyCode].relations;
        Object.keys(rels).sort().forEach(rr => {
            const opt = document.createElement('option');
            opt.value = rr;
            opt.textContent = `${rr} - ${rels[rr]}`;
            relationSelect.appendChild(opt);
        });
    }
    relationSelect.value = item.relationCode;

    // 4. Stock Field is for ADDING, not setting
    const stockInput = document.getElementById('ms-new-stock-qty');
    stockInput.value = ''; 
    stockInput.placeholder = "Add Stock (Optional)";
    
    populateModalSiteDropdown();
};

function generatePreviewID() {
    // FIX: Do not generate new ID if we are in Edit Mode
    if (typeof editingItemKey !== 'undefined' && editingItemKey) return; 

    const ff = document.getElementById('ms-new-family').value;
    const rr = document.getElementById('ms-new-relation').value;
    const idInput = document.getElementById('ms-new-id-display');

    if(ff && rr) {
        // Calculate Next Global Series
        let maxSeries = 0;
        allMaterialStockData.forEach(item => {
            if(item.series) {
                const s = parseInt(item.series);
                if(!isNaN(s) && s > maxSeries) maxSeries = s;
            }
        });
        const nextSeries = maxSeries + 1;
        const sssss = String(nextSeries).padStart(5, '0');
        
        // FORMAT: F.RRR.SSSSS
        idInput.value = `${ff}.${rr}.${sssss}`;
        idInput.dataset.series = nextSeries; // Store for saving
    } else {
        idInput.value = "Auto-Generated";
    }
}

// ==========================================================================
// 6. SAVE LOGIC
// ==========================================================================
async function handleSaveNewMaterial() {
    const btn = document.getElementById('ms-save-new-btn');
    btn.disabled = true; 

    const familyCode = document.getElementById('ms-new-family').value;
    const relationCode = document.getElementById('ms-new-relation').value;
    const productDetail = document.getElementById('ms-new-name').value.trim(); 
    
    // In Edit Mode, Stock Input = "Add this amount"
    // In New Mode, Stock Input = "Initial Stock"
    const stockInputVal = parseFloat(document.getElementById('ms-new-stock-qty').value) || 0;
    const selectedSite = document.getElementById('ms-new-site-select').value;
    const database = (typeof db !== 'undefined') ? db : firebase.database();

    try {
        if (editingItemKey) {
            // === UPDATE MODE (SUPER ADMIN) ===
            const item = allMaterialStockData.find(i => i.key === editingItemKey);
            
            // 1. Prepare Updates
            const updates = {};
            updates['productName'] = productDetail;
            updates['familyCode'] = familyCode;
            updates['family'] = STOCK_LEGENDS[familyCode].name;
            updates['relationCode'] = relationCode;
            updates['relationship'] = STOCK_LEGENDS[familyCode].relations[relationCode];
            
            // Compatibility Fields
            updates['category'] = STOCK_LEGENDS[familyCode].name;
            updates['details'] = STOCK_LEGENDS[familyCode].relations[relationCode];
            
            updates['updatedBy'] = (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'Irwin');
            updates['lastUpdated'] = firebase.database.ServerValue.TIMESTAMP;

            // 2. Handle Stock Addition
            if (stockInputVal > 0) {
                if (!item.sites) item.sites = {};
                const currentSiteQty = parseFloat(item.sites[selectedSite] || 0);
                item.sites[selectedSite] = currentSiteQty + stockInputVal;
                
                updates['sites'] = item.sites;
                
                // Recalc Total
                let total = 0;
                Object.values(item.sites).forEach(q => total += q);
                updates['stockQty'] = total;
                updates['balanceQty'] = total;
            }

            await database.ref(`material_stock/${editingItemKey}`).update(updates);
            alert("Item Updated Successfully!");

        } else {
            // === CREATE NEW MODE ===
            const productID = document.getElementById('ms-new-id-display').value;
            const series = parseInt(document.getElementById('ms-new-id-display').dataset.series);
            
            if (!productID || productID.includes("Auto")) { 
                alert("ID Generation Error"); btn.disabled = false; return; 
            }

            const sitesInit = {};
            if (stockInputVal > 0) sitesInit[selectedSite] = stockInputVal;

            const familyName = STOCK_LEGENDS[familyCode].name;
            const relationName = STOCK_LEGENDS[familyCode].relations[relationCode];

            const newMaterial = {
                productID: productID,
                productName: productDetail,
                familyCode: familyCode,
                family: familyName,
                relationCode: relationCode,
                relationship: relationName,
                series: series,
                category: familyName,
                details: relationName,
                stockQty: stockInputVal,
                transferredQty: 0, 
                balanceQty: stockInputVal,
                sites: sitesInit,
                status: "Active",
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                updatedBy: (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'System')
            };

            await database.ref('material_stock').push(newMaterial);
            alert(`Success! Created: ${productID}`);
        }

        // Cleanup
        document.getElementById('ms-new-material-modal').classList.add('hidden');
        editingItemKey = null; // Reset
        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);

    } catch (error) { 
        console.error("Save Error:", error); 
        alert("Failed to save."); 
    } finally { 
        btn.disabled = false; 
        btn.textContent = "Save"; 
    }
}

// ==========================================================================
// 7. CSV UPLOAD (Updated Template V2 - With Product ID)
// ==========================================================================
function handleGetTemplate() {
    // UPDATED TEMPLATE: "Product ID" is now the first column
    const headers = ["Product ID", "Item Name", "F", "RRR", "Stock", "Site"];
    
    // Example 1: Existing ID (Will update stock for this ID)
    const row1 = "1.104.00150,Concrete Blocks 200mm,1,104,500,Site 175";
    
    // Example 2: Empty ID (Will use previous logic: Match Name or Create New Auto-ID)
    const row2 = ",Marble Black Carrara 75x13,2,201,100,Main Store";

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + row1 + "\n" + row2;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Material_Upload_Template_V2.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// CORRECTED CSV UPLOAD FUNCTION (V2 - ID Priority + Name Update)
// ==========================================================================
function handleUploadCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        
        const database = (typeof db !== 'undefined') ? db : firebase.database();
        const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : 'System';
        
        // 1. Build Indexes (ID Map & Name Map)
        const idMap = new Map();
        const nameMap = new Map();
        let maxSeries = 0;

        // Index existing data
        allMaterialStockData.forEach(item => {
            // Map by Product ID
            const pid = (item.productID || item.productId || "").trim();
            if (pid) idMap.set(pid, item);

            // Map by Product Name (Fallback)
            if (item.productName) {
                nameMap.set(item.productName.trim().toLowerCase(), item);
            }

            // Track Max Series for Auto-Gen
            const s = parseInt(item.series);
            if (!isNaN(s) && s > maxSeries) maxSeries = s;
        });

        const finalUpdates = {}; 
        let mergedCount = 0;
        let newCount = 0;

        // 2. Process CSV Rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Clean split
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

            // EXPECTED: Product ID(0), Name(1), F(2), RRR(3), Qty(4), Site(5)
            if (cols.length >= 5) {
                const pID = cols[0].trim();   // NEW: Product ID
                const pName = cols[1].trim(); // Item Name
                const ff = cols[2].trim();
                const rrr = cols[3].trim();
                const pQty = parseFloat(cols[4]) || 0;
                const pSite = (cols[5] && cols[5] !== "") ? cols[5].trim() : "Main Store";

                if (pName) {
                    let existingItem = null;

                    // --- MATCHING STRATEGY ---
                    if (pID && pID !== "") {
                        // Priority 1: Match by ID
                        existingItem = idMap.get(pID);
                    } else {
                        // Priority 2: Match by Name (Legacy Logic)
                        const normName = pName.toLowerCase();
                        existingItem = nameMap.get(normName);
                    }

                    if (existingItem) {
                        // === MERGE MODE (Update Existing) ===
                        
                        // [FIX] Update Name if provided
                        if (pName && pName !== "") {
                            existingItem.productName = pName;
                        }

                        if (!existingItem.sites) existingItem.sites = {};
                        
                        // Add quantity to specific site
                        let currentSiteQty = parseFloat(existingItem.sites[pSite] || 0);
                        existingItem.sites[pSite] = currentSiteQty + pQty;

                        // Recalculate Totals
                        let total = 0;
                        Object.values(existingItem.sites).forEach(q => total += parseFloat(q));
                        existingItem.stockQty = total;
                        existingItem.balanceQty = total;
                        existingItem.lastUpdated = Date.now();
                        existingItem.updatedBy = currentUser;

                        finalUpdates[existingItem.key] = existingItem;
                        mergedCount++;

                    } else {
                        // === CREATE NEW MODE ===
                        // A. Check Metadata Validity
                        if (ff && rrr && STOCK_LEGENDS[ff]) {
                            
                            // B. Determine ID
                            let finalID = pID; // Use provided ID
                            let finalSeries = 0;

                            // If ID is empty, Auto-Generate (F.RRR.SSSSS)
                            if (!finalID) {
                                maxSeries++;
                                finalSeries = maxSeries;
                                const sssss = String(maxSeries).padStart(5, '0');
                                finalID = `${ff}.${rrr}.${sssss}`;
                            }

                            const familyName = STOCK_LEGENDS[ff].name;
                            const relationName = STOCK_LEGENDS[ff].relations[rrr] || "Unknown";

                            // C. Generate Object
                            const newKey = database.ref('material_stock').push().key;
                            const sites = {};
                            if (pQty > 0) sites[pSite] = pQty;

                            const newItem = {
                                key: newKey,
                                productID: finalID,
                                productName: pName,
                                familyCode: ff,
                                family: familyName,
                                relationCode: rrr,
                                relationship: relationName,
                                category: familyName, // Compatibility
                                details: relationName, // Compatibility
                                series: finalSeries,
                                stockQty: pQty,
                                balanceQty: pQty,
                                sites: sites,
                                status: "Active",
                                timestamp: Date.now(),
                                updatedBy: currentUser
                            };

                            // D. Add to local maps so subsequent rows in same file find this item
                            idMap.set(finalID, newItem);
                            nameMap.set(pName.toLowerCase(), newItem);

                            finalUpdates[newKey] = newItem;
                            newCount++;
                        }
                    }
                }
            }
        }

        // 3. Batch Upload Logic
        const updateKeys = Object.keys(finalUpdates);
        if (updateKeys.length === 0) {
            alert("No valid data found.");
            document.getElementById('ms-csv-file-input').value = '';
            return;
        }

        if (!confirm(`Processing Upload:\n\n- New Items: ${newCount}\n- Updated Items: ${mergedCount}\n\nProceed?`)) {
            document.getElementById('ms-csv-file-input').value = '';
            return;
        }

        // Send in batches
        const BATCH_SIZE = 500;
        let batch = {};
        let count = 0;
        const uploadBtn = document.getElementById('ms-upload-csv-btn');
        if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.innerText = "Saving..."; }

        try {
            for (let k of updateKeys) {
                batch[k] = finalUpdates[k];
                count++;
                if (count >= BATCH_SIZE) {
                    await database.ref('material_stock').update(batch);
                    batch = {};
                    count = 0;
                }
            }
            if (count > 0) await database.ref('material_stock').update(batch);

            alert("Upload Successful!");
            localStorage.removeItem("cached_MATERIAL_STOCK"); 
            populateMaterialStock(true);

        } catch(e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            if (uploadBtn) { 
                uploadBtn.disabled = false; 
                uploadBtn.innerHTML = '<i class="fa-solid fa-file-csv"></i> Upload CSV'; 
            }
            document.getElementById('ms-csv-file-input').value = '';
        }
    };
    reader.readAsText(file);
}

// ==========================================================================
// 8. ADD STOCK MODAL LOGIC
// ==========================================================================
window.openAddStockModal = function (key) {
    const item = allMaterialStockData.find(i => i.key === key);
    if (!item) return;
    document.getElementById('ms-add-stock-modal').classList.remove('hidden');
    document.getElementById('ms-add-key').value = key;
    document.getElementById('ms-add-id').value = item.productID;
    document.getElementById('ms-add-name').value = item.productName;
    document.getElementById('ms-add-details').value = item.relationship || item.details;
    document.getElementById('ms-add-current-stock').value = item.stockQty;
    document.getElementById('ms-add-qty-input').value = '';
    
    // Repopulate sites
    const siteSelect = document.getElementById('ms-add-site-select');
    siteSelect.innerHTML = '<option value="Main Store">Main Store</option>';
    if (typeof allSitesCSVData !== 'undefined') {
        allSitesCSVData.forEach(s => {
            if(s.site !== "Main Store") {
                const opt = document.createElement('option');
                opt.value = s.site;
                opt.textContent = `${s.site} - ${s.description}`;
                siteSelect.appendChild(opt);
            }
        });
    }
};

// ==========================================================================
// 9. HELPERS
// ==========================================================================

window.toggleStockDetail = function(rowId, btn) {
    const row = document.getElementById(rowId);
    if (row) {
        row.classList.toggle('hidden');
        btn.textContent = row.classList.contains('hidden') ? '+' : '-';
    }
};

async function populateModalSiteDropdown() {
    const siteSelect = document.getElementById('ms-new-site-select');
    if (!siteSelect) return;
    siteSelect.innerHTML = '<option value="Main Store">Main Store</option>';
    if (typeof allSitesCSVData !== 'undefined' && allSitesCSVData) {
        allSitesCSVData.forEach(site => {
            if (site.site !== "Main Store") {
                const opt = document.createElement('option');
                opt.value = site.site;
                opt.textContent = `${site.site} - ${site.description}`;
                siteSelect.appendChild(opt);
            }
        });
    }
}

window.handleClearMaterialForm = function() {
    document.getElementById('ms-new-material-form').reset();
    document.getElementById('ms-new-id-display').value = "Auto-Generated";
};

window.initiateReturn = function(transferKey) {
    const database = (typeof db !== 'undefined') ? db : firebase.database();
    database.ref(`transfer_entries/${transferKey}`).once('value').then(snap => {
        const originalTask = snap.val();
        if (!originalTask) {
            alert("Error: Original transaction data not found.");
            return;
        }

        openTransferModal('Return');

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

            const modalContent = document.querySelector('#transfer-job-modal .modal-content');
            if(modalContent) modalContent.scrollTop = 0;
        }, 500);
    });
};

// --- BULK DELETE LOGIC ---
async function handleBulkDelete() {
    // 1. Collect Checked Items
    const checkedBoxes = document.querySelectorAll('.ms-row-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert("Please select items to delete.");
        return;
    }

    const count = checkedBoxes.length;
    const confirmMsg = `⚠️ MASTER BULK DELETE ⚠️\n\nYou are about to delete ${count} items from Stock.\n\nThis will also delete the history for these specific Product IDs.\n\nAre you sure you want to proceed?`;
    
    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById('ms-bulk-delete-btn');
    btn.textContent = "Deleting...";
    btn.disabled = true;

    const database = firebase.database();
    const updates = {};
    let transfersDeletedCount = 0;

    // 2. Build Update Object
    checkedBoxes.forEach(box => {
        const key = box.dataset.key;
        
        // Find the full item data from the master list
        const stockItem = allMaterialStockData.find(i => i.key === key);
        const productID = stockItem?.productID || stockItem?.productId || "";

        // A. ALWAYS Mark the Stock Item itself for deletion
        updates[`material_stock/${key}`] = null;

        // B. SAFETY CHECK: Only delete history if Product ID is valid (Not empty)
        if (productID && productID.trim() !== "") {
            
            // Find transfers strictly matching this ID
            const relatedTransfers = allTransferData.filter(t => {
                const tID = (t.productID || t.productId || "").toString().trim();
                const sID = productID.toString().trim();
                return tID === sID;
            });

            // Mark these specific transfers for deletion
            relatedTransfers.forEach(t => {
                updates[`transfer_entries/${t.key}`] = null;
                transfersDeletedCount++;
            });
        }
    });

    try {
        // 3. Execute Atomic Delete
        await database.ref().update(updates);
        alert(`Success!\n\nDeleted ${count} Stock Items.\nDeleted ${transfersDeletedCount} Related History Entries.`);
        
        // 4. Refresh
        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);
        
    } catch (e) {
        console.error("Bulk delete failed", e);
        alert("Error during bulk delete. Check console.");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete Selected';
        btn.disabled = false;
    }
}

// --- REPORTING FUNCTIONS (PDF/EXCEL) ---
function openStockReportModal() {
    const modal = document.getElementById('ms-report-modal');
    const tbody = document.getElementById('ms-report-table-body');
    const dateEl = document.getElementById('ms-report-date');
    
    // 1. Filter Data & Determine Title Suffix
    let data = allMaterialStockData;
    let titleSuffix = "";

    if (currentCategoryFilter && currentCategoryFilter !== 'All') {
        data = allMaterialStockData.filter(i => (i.familyCode === currentCategoryFilter));
        const familyName = STOCK_LEGENDS[currentCategoryFilter] ? STOCK_LEGENDS[currentCategoryFilter].name : currentCategoryFilter;
        titleSuffix = ` for ${familyName}`;
    }

    // 2. Update Print Title
    const printTitleEl = document.querySelector('#ms-report-modal .print-only-header p');
    if (printTitleEl) {
        printTitleEl.textContent = `Material Stock Status Report${titleSuffix}`;
    }

    // 3. Update Stats
    document.getElementById('ms-report-total').textContent = data.length;
    const inStock = data.filter(i => (parseFloat(i.stockQty) || 0) > 0).length;
    document.getElementById('ms-report-instock').textContent = inStock;
    document.getElementById('ms-report-outstock').textContent = data.length - inStock;
    dateEl.textContent = new Date().toLocaleString();

    // 4. Render Table
    tbody.innerHTML = '';
    data.forEach(item => {
        let locText = 'Main Store: 0';
        if (item.sites) {
            const locs = [];
            Object.entries(item.sites).forEach(([site, qty]) => {
                if(parseFloat(qty) > 0) locs.push(`${site}: ${qty}`);
            });
            if(locs.length > 0) locText = locs.join(', ');
            else if((parseFloat(item.stockQty)||0) > 0) locText = 'Main Store: ' + item.stockQty;
            else locText = 'Out of Stock';
        }

        const row = `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; font-weight: bold;">${item.productID || item.productId}</td>
                <td style="padding: 8px;">${item.productName}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold; color: #003A5C;">${item.stockQty}</td>
                <td style="padding: 8px; color: #555; font-size: 0.85rem;">${locText}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
    modal.classList.remove('hidden');
}

function downloadFixedStockCSV() {
    let data = allMaterialStockData;
    if (currentCategoryFilter && currentCategoryFilter !== 'All') {
        data = allMaterialStockData.filter(i => (i.familyCode === currentCategoryFilter));
    }

    if (data.length === 0) { alert("No data to export."); return; }

    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    csvContent += "Product ID,Product Name,Category,Total Stock,Location Breakdown\r\n";

    data.forEach(item => {
        let locText = "";
        if (item.sites) {
            locText = Object.entries(item.sites)
                .filter(([_, qty]) => parseFloat(qty) > 0)
                .map(([site, qty]) => `${site}: ${qty}`)
                .join(" | ");
        }
        if(!locText) locText = "Main Store: " + (item.stockQty || 0);

        const safeLocText = `="${locText.replace(/"/g, '""')}"`; 

        const row = [
            `"${item.productID || item.productId || ''}"`,
            `"${(item.productName || '').replace(/"/g, '""')}"`,
            `"${item.family || item.category || ''}"`,
            item.stockQty || 0,
            safeLocText
        ];
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Report_${currentCategoryFilter || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// 10. EVENTS
// ==========================================================================
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
    
    // --- SEARCH LOGIC ---
    const msSearchInput = document.getElementById('ms-search-input');
    if (msSearchInput) {
        msSearchInput.addEventListener('input', () => {
            renderMaterialStockTable(allMaterialStockData);
        });
    }

    // --- MATERIAL STOCK CLEAR BUTTON LOGIC (WIPE CLEAN) ---
    const msClearBtn = document.getElementById('ms-search-clear-btn');
    const msTableBody = document.getElementById('ms-table-body');
    const msCountDisplay = document.getElementById('ms-total-count');
    const msTabs = document.getElementById('ms-category-tabs');

    if (msClearBtn) {
        msClearBtn.addEventListener('click', () => {
            // 1. Clear Input
            if (msSearchInput) {
                msSearchInput.value = '';
                msSearchInput.focus(); 
            }

            // 2. WIPE TABLE CLEAN
            if (msTableBody) {
                msTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#777;">List cleared. Please select a Family tab above.</td></tr>';
            }

            // 3. Reset Count
            if (msCountDisplay) {
                msCountDisplay.textContent = '';
            }

            // 4. Reset Active Tab Visuals
            if (msTabs) {
                msTabs.querySelectorAll('.active').forEach(tab => {
                    tab.classList.remove('active');
                    tab.style.borderBottomColor = 'transparent';
                    tab.style.color = '#555';
                });
            }
            
            // 5. Reset Filter State
            currentCategoryFilter = null; 
        });
    }

    // --- REPORTING BUTTONS ---
    const openReportBtn = document.getElementById('ms-open-report-modal-btn');
    if(openReportBtn) openReportBtn.addEventListener('click', openStockReportModal);

    const printModalBtn = document.getElementById('ms-modal-print-btn');
    if(printModalBtn) printModalBtn.addEventListener('click', () => {
        window.print();
    });

    const excelModalBtn = document.getElementById('ms-modal-excel-btn');
    if(excelModalBtn) excelModalBtn.addEventListener('click', downloadFixedStockCSV);

    // --- BULK DELETE BUTTON ---
    const bulkDeleteBtn = document.getElementById('ms-bulk-delete-btn');
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete);

    // --- SAVE ADD STOCK MODAL ---
    const saveStockBtn = document.getElementById('ms-save-stock-btn');
    if(saveStockBtn) {
        saveStockBtn.addEventListener('click', async () => {
            const key = document.getElementById('ms-add-key').value;
            const site = document.getElementById('ms-add-site-select').value;
            const qty = parseFloat(document.getElementById('ms-add-qty-input').value) || 0;
            
            if(qty === 0) { alert("Enter quantity."); return; }
            
            const item = allMaterialStockData.find(i => i.key === key);
            let sites = item.sites || {};
            
            // Add/Subtract logic
            let currentSiteQty = parseFloat(sites[site] || 0);
            currentSiteQty += qty;
            if(currentSiteQty < 0) { alert("Cannot have negative stock."); return; }
            
            sites[site] = currentSiteQty;
            
            // Recalc Global
            let total = 0; Object.values(sites).forEach(q => total += q);
            
            await firebase.database().ref(`material_stock/${key}`).update({
                sites: sites,
                stockQty: total,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            
            alert("Stock Updated Successfully.");
            document.getElementById('ms-add-stock-modal').classList.add('hidden');
            localStorage.removeItem(STOCK_CACHE_KEY);
            populateMaterialStock(true);
        });
    }
});

// ==========================================================================
// NEW: DELETE SPECIFIC SITE STOCK ONLY
// ==========================================================================
window.deleteSiteStock = async function(key, siteToDelete) {
    // 1. Safety Check
    if (!confirm(`⚠️ WARNING (Super Admin)\n\nAre you sure you want to remove ALL stock from:\n📍 ${siteToDelete}?\n\nOther sites for this item will remain safe.`)) {
        return;
    }

    const database = firebase.database();
    
    try {
        // 2. Fetch fresh data to ensure we don't overwrite other updates
        const snapshot = await database.ref(`material_stock/${key}`).once('value');
        const item = snapshot.val();
        
        if (!item || !item.sites) {
            alert("Error: Item or sites not found.");
            return;
        }

        // 3. Remove the specific site
        const updatedSites = { ...item.sites };
        delete updatedSites[siteToDelete];

        // 4. Recalculate Total Stock
        let newTotal = 0;
        Object.values(updatedSites).forEach(q => newTotal += parseFloat(q) || 0);

        // 5. Update Database
        await database.ref(`material_stock/${key}`).update({
            sites: updatedSites,
            stockQty: newTotal,
            balanceQty: newTotal,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
            updatedBy: "Irwin (Site Deleted)"
        });

        alert(`Success! Removed stock from ${siteToDelete}.`);
        
        // 6. Refresh Table
        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);

    } catch (e) {
        console.error("Delete Site Error:", e);
        alert("Failed to delete site stock.");
    }
};