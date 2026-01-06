// materialStock.js - V10.11 (FINAL COMPLETE: All Fixes Included)

let allMaterialStockData = [];
let allTransferData = [];
let lastFilteredStockData = []; 
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
// INIT SYSTEM & SITE FILTER (INCLUDES PRINT CSS FIX)
// ==========================================================================
async function initMaterialStockSystem() {
    
    // --- 1. INJECT PRINT CSS FIX ---
    if (!document.getElementById('ms-print-style-fix')) {
        const style = document.createElement('style');
        style.id = 'ms-print-style-fix';
        style.innerHTML = `
            @media print {
                @page { margin: 5mm; size: auto; }
                
                body { margin: 0 !important; padding: 0 !important; background: white !important; }
                body * { visibility: hidden; height: 0; overflow: hidden; }
                
                /* SHOW MODAL & CONTENT */
                #ms-report-modal, 
                #ms-report-modal * {
                    visibility: visible !important;
                    height: auto !important;
                    overflow: visible !important;
                    color: black !important;
                }

                /* --- HIDE DUPLICATE TOP TITLE --- */
                .modal-header, .modal-title, #ms-modal-title {
                    display: none !important;
                }

                /* HEADER CONTAINER */
                .print-only-header {
                    display: block !important;
                    visibility: visible !important;
                    margin-bottom: 20px !important;
                    overflow: hidden !important; /* Clears floats */
                }

                /* LOGO: LEFT ALIGNED & LARGER (550px) */
                .print-only-header img {
                    width: 550px !important;
                    max-width: 100% !important;
                    height: auto !important;
                    display: block !important;
                    float: left !important; /* Forces Left Alignment */
                    margin-bottom: 15px !important;
                }

                /* TEXT: CENTERED & BELOW LOGO */
                .print-only-header-text {
                    clear: both !important; /* Moves it below the floated logo */
                    display: block !important;
                    text-align: center !important; /* Centers the text */
                    width: 100% !important;
                }

                .print-only-header h3, 
                .print-only-header p,
                .print-only-header span {
                    display: block !important;
                    visibility: visible !important;
                    color: black !important;
                }

                #ms-report-modal {
                    position: absolute !important;
                    left: 0 !important; top: 0 !important;
                    width: 100% !important; margin: 0 !important;
                    border: none !important;
                }
                #ms-report-modal .modal-content {
                    width: 100% !important; margin: 0 !important; padding: 0 !important;
                    box-shadow: none !important; border: none !important;
                }

                #ms-report-modal button, .close-btn, .modal-footer { display: none !important; }

                table { width: 100% !important; border-collapse: collapse !important; }
                th, td { border: 1px solid #ddd !important; padding: 5px !important; font-size: 11px !important; }
                
                th:nth-child(1), td:nth-child(1) { width: 15% !important; } 
                th:nth-child(2), td:nth-child(2) { width: 35% !important; } 
                th:nth-child(3), td:nth-child(3) { width: 10% !important; } 
                th:nth-child(4), td:nth-child(4) { width: 40% !important; } 
            }
        `;
        document.head.appendChild(style);
    }

    // --- 2. EXISTING UI LOGIC (TABS & FILTER) ---
    const tabsContainer = document.getElementById('ms-category-tabs');
    const filterId = 'ms-site-filter';
    
    if (tabsContainer && !document.getElementById(filterId)) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-block';
        wrapper.style.marginLeft = '15px';
        wrapper.style.verticalAlign = 'middle';

        const select = document.createElement('select');
        select.id = filterId;
        select.className = 'form-control'; 
        select.style.padding = '5px 10px';
        select.innerHTML = `<option value="All">All Sites</option><option value="Main Store">Main Store</option>`;
        
        const cachedSites = localStorage.getItem('cached_SITES');
        if (cachedSites) {
            try {
                const sitesData = JSON.parse(cachedSites).data || [];
                sitesData.forEach(s => {
                    if (s.site !== 'Main Store') select.innerHTML += `<option value="${s.site}">${s.site} - ${s.description}</option>`;
                });
            } catch (e) {}
        }
        
        select.addEventListener('change', () => {
            renderMaterialStockTable(allMaterialStockData);
        });

        wrapper.appendChild(select);
        tabsContainer.parentNode.insertBefore(wrapper, tabsContainer.nextSibling);
    }
}

// ==========================================================================
// 1. LOAD DATA
// ==========================================================================
async function populateMaterialStock(forceRefresh = false) {
    const tableBody = document.getElementById('ms-table-body');
    const tabsContainer = document.getElementById('ms-category-tabs');

    if (!tableBody) return;

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

    const activeFamilyCodes = new Set();
    allMaterialStockData.forEach(item => {
        if (item.familyCode) activeFamilyCodes.add(item.familyCode);
    });

    // If the selected tab no longer exists in data, fall back to "All"
    if (currentCategoryFilter !== 'All' && !activeFamilyCodes.has(currentCategoryFilter)) {
        currentCategoryFilter = 'All';
    }

    let html = `<button class="${currentCategoryFilter === 'All' ? 'active' : ''}" onclick="filterStockByCategory('All')">All Families</button>`;

    const sortedFamilies = Object.keys(STOCK_LEGENDS).sort((a, b) => parseInt(a) - parseInt(b));

    sortedFamilies.forEach(code => {
        if (activeFamilyCodes.has(code)) {
            const name = STOCK_LEGENDS[code].name;
            const activeClass = (currentCategoryFilter === code) ? 'active' : '';
            html += `<button class="${activeClass}" onclick="filterStockByCategory('${code}')">
                        ${name} <span style="font-size: 0.75rem; color: #dc3545; font-weight: normal; margin-left: 4px;">[${code}]</span>
                     </button>`;
        }
    });

    tabsContainer.innerHTML = html;

    // Keep the active tab centered when the list is scrollable
    const activeTab = tabsContainer.querySelector('.active');
    if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    renderMaterialStockTable(allMaterialStockData);
}

window.filterStockByCategory = function(category) {
    currentCategoryFilter = category;
    renderCategoryTabs();
    renderMaterialStockTable(allMaterialStockData);
};

// ==========================================================================
// RENDER TABLE (Fixed: Safe Null Checks for currentApprover)
// ==========================================================================
function renderMaterialStockTable(data) {
    const tableBody = document.getElementById('ms-table-body');
    const searchInput = document.getElementById('ms-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const countDisplay = document.getElementById('ms-total-count'); 
    
    // --- READ SITE FILTER ---
    const siteFilterVal = document.getElementById('ms-site-filter')?.value || 'All';

    // [FIX] Use strict null check (currentApprover && ...)
    const isAdmin = (currentApprover && (currentApprover.Role || '').toLowerCase() === 'admin');
    const isIrwin = (currentApprover && currentApprover.Name === 'Irwin');
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    // Super Admin replacement: allow edit actions in Inventory (no delete)
    const isEditor = (isAdmin || isVacationDelegate);

    const bulkBtn = document.getElementById('ms-bulk-delete-btn');
    if (bulkBtn) {
        if (isIrwin) bulkBtn.classList.remove('hidden');
        else bulkBtn.classList.add('hidden');
    }

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
        // 1. Family Filter Logic
        if (currentCategoryFilter && currentCategoryFilter !== 'All') {
            if (item.familyCode !== currentCategoryFilter) return false;
        }

        // 2. Search Text (SAFE STRING CONVERSION to prevent crash)
        const pID = String(item.productID || item.productId || '').toLowerCase();
        const pName = String(item.productName || '').toLowerCase();
        const pDetails = String(item.details || item.relationship || '').toLowerCase();
        
        const matchesText = pID.includes(searchTerm) || pName.includes(searchTerm) || pDetails.includes(searchTerm);
        if (!matchesText) return false;

        // 3. SITE FILTER LOGIC
        if (siteFilterVal !== 'All') {
            if (!item.sites || !item.sites[siteFilterVal] || parseFloat(item.sites[siteFilterVal]) <= 0) {
                return false;
            }
        }

        return true;
    });

    // --- SAVE FILTERED DATA FOR REPORTING ---
    lastFilteredStockData = filtered;

    if (countDisplay) countDisplay.textContent = `(Total: ${filtered.length})`;

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#777;">No materials found.</td></tr>';
        return;
    }

    filtered.forEach(item => {
        // 1. PRE-CALCULATE HISTORY
        const stockID = String(item.productID || item.productId || '').trim();
        const productTransfers = allTransferData.filter(t => {
            const transferID = String(t.productID || t.productId || '').trim();
            return transferID === stockID;
        });

        // 2. GENERATE SITE BREAKDOWN
        let totalStock = 0;
        let breakdownRows = '';
        let hasSites = false;

        if (siteFilterVal !== 'All') totalStock = parseFloat(item.sites[siteFilterVal] || 0);

        if (item.sites) {
            Object.entries(item.sites).forEach(([site, qty]) => {
                const q = parseFloat(qty);
                
                // Filter Check
                if (siteFilterVal !== 'All' && site !== siteFilterVal) return; 

                // --- SMART LOGIC: Hide 0 qty sites UNLESS there's a pending transfer ---
                const hasPendingTransaction = productTransfers.some(t => {
                    const isPending = (t.remarks !== 'Completed' && t.remarks !== 'Received');
                    const involvesSite = (t.toLocation === site || t.toSite === site || t.fromLocation === site || t.fromSite === site);
                    return isPending && involvesSite;
                });

                if (q !== 0 || hasPendingTransaction) {
                    hasSites = true;
                    if (siteFilterVal === 'All') totalStock += q;
                    
                    let deleteSiteAction = '';
                    if (isIrwin && q === 0) { 
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
        
        if (!hasSites && siteFilterVal === 'All') {
            const legacyStock = parseFloat(item.stockQty) || 0;
            totalStock = legacyStock;
            breakdownRows = `<tr><td style="padding-left: 20px;">Unassigned (Global)</td><td>${legacyStock}</td></tr>`;
        }

        // 3. GENERATE HISTORY ROWS
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
                
                // [FIX] Safe check for currentUser inside the loop
                const currentUser = (currentApprover) ? currentApprover.Name : '';
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

if(isEditor) {
    // Super Admin (Irwin) AND Irwin's active Vacation Delegate can edit materials.
    // Delete remains Irwin-only (button + backend guard).
    if (isIrwin || isVacationDelegate) {
        actionButtons += `<button type="button" class="secondary-btn ms-edit-stock-btn" data-key="${item.key}" style="padding: 5px 10px; font-size: 0.8rem; background-color: #00748C; color: white; margin-right: 5px;" title="Edit Details & Add Stock"><i class="fa-solid fa-pen-to-square"></i> Edit</button>`;
        // Removed redundant green "+" (Add Stock) action button; stock adjustments are handled via Edit.

        if (isIrwin) {
            actionButtons += `<button type="button" class="delete-btn ms-delete-btn" data-key="${item.key}" style="padding: 5px 10px; font-size: 0.8rem;" title="Delete Item"><i class="fa-solid fa-trash"></i></button>`;
            firstColContent = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="ms-row-checkbox" data-key="${item.key}" data-name="${item.productName}">
                    <button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button>
                </div>
            `;
        }
    } else {
	    // Normal admins (non-Irwin) can add stock only.
	    actionButtons += `<button type="button" class="secondary-btn ms-add-stock-text-btn" data-key="${item.key}" style="padding: 5px 10px; font-size: 0.8rem; background-color: #28a745; color: white; margin-right: 5px;" title="Add Stock">Add Stock</button>`;
    }
} else {
    actionButtons = `<small style="color:#999;">View Only</small>`;
}const familyDisplay = item.family || item.category || 'Unclassified';
        const relationshipDisplay = item.relationship || item.details || '';

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



    // Bind action buttons (works for both admins and vacation delegates)
    document.querySelectorAll('.ms-edit-stock-btn').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const key = this.getAttribute('data-key');
            if (typeof openSuperAdminEdit === 'function') openSuperAdminEdit(key);
        });
    });

    document.querySelectorAll('.ms-add-stock-text-btn').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const key = this.getAttribute('data-key');
            if (typeof openAddStockModal === 'function') openAddStockModal(key);
        });
    });

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
    // Permission: Admins can edit. Super Admin's Vacation Delegate can edit while delegation is active.
    const role = (typeof currentApprover !== 'undefined' && currentApprover) ? (currentApprover.Role || '') : '';
    const isAdminUser = String(role).toLowerCase() === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    if (!isAdminUser && !isVacationDelegate) {
        alert("View Only: You do not have permission to register new materials.");
        return;
    }

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

    const familySelect = document.getElementById('ms-new-family');
    familySelect.innerHTML = '<option value="" disabled selected>Select Family</option>';
    
    Object.keys(STOCK_LEGENDS).sort().forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${code} - ${STOCK_LEGENDS[code].name}`;
        familySelect.appendChild(opt);
    });

    const relationSelect = document.getElementById('ms-new-relation');
    relationSelect.innerHTML = '<option value="" disabled selected>Select Relationship</option>';

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
        generatePreviewID();
    };

    relationSelect.onchange = generatePreviewID;
    document.getElementById('ms-new-id-display').value = "Auto-Generated";

    populateModalSiteDropdown();
};

window.openSuperAdminEdit = function(key) {
    const item = allMaterialStockData.find(i => i.key === key);
    if(!item) return;

    editingItemKey = key;

    const modal = document.getElementById('ms-new-material-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('ms-modal-title').textContent = "Edit Item & Add Stock";
    document.getElementById('ms-save-new-btn').textContent = "Update Item";

    document.getElementById('ms-new-name').value = item.productName;
    document.getElementById('ms-new-id-display').value = item.productID;

    const famSelect = document.getElementById('ms-new-family');
    if(famSelect.options.length <= 1) {
         Object.keys(STOCK_LEGENDS).sort().forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${code} - ${STOCK_LEGENDS[code].name}`;
            famSelect.appendChild(opt);
        });
    }
    famSelect.value = item.familyCode;

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

    const stockInput = document.getElementById('ms-new-stock-qty');
    stockInput.value = ''; 
    stockInput.placeholder = "Add Stock (Optional)";
    
    populateModalSiteDropdown();
};

function generatePreviewID() {
    if (typeof editingItemKey !== 'undefined' && editingItemKey) return; 

    const ff = document.getElementById('ms-new-family').value;
    const rr = document.getElementById('ms-new-relation').value;
    const idInput = document.getElementById('ms-new-id-display');

    if(ff && rr) {
        let maxSeries = 0;
        allMaterialStockData.forEach(item => {
            if(item.series) {
                const s = parseInt(item.series);
                if(!isNaN(s) && s > maxSeries) maxSeries = s;
            }
        });
        const nextSeries = maxSeries + 1;
        const sssss = String(nextSeries).padStart(5, '0');
        idInput.value = `${ff}.${rr}.${sssss}`;
        idInput.dataset.series = nextSeries;
    } else {
        idInput.value = "Auto-Generated";
    }
}

// ==========================================================================
// 6. SAVE LOGIC
// ==========================================================================
async function handleSaveNewMaterial() {
    // Permission guard (same as modal): Admins OR Super Admin Vacation Delegate.
    const role = (typeof currentApprover !== 'undefined' && currentApprover) ? (currentApprover.Role || '') : '';
    const isAdminUser = String(role).toLowerCase() === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    if (!isAdminUser && !isVacationDelegate) {
        alert("Access Denied: You do not have permission to save material changes.");
        return;
    }

    const btn = document.getElementById('ms-save-new-btn');
    btn.disabled = true; 

    const familyCode = document.getElementById('ms-new-family').value;
    const relationCode = document.getElementById('ms-new-relation').value;
    const productDetail = document.getElementById('ms-new-name').value.trim(); 
    
    const stockInputVal = parseFloat(document.getElementById('ms-new-stock-qty').value) || 0;
    const selectedSite = document.getElementById('ms-new-site-select').value;
    const database = (typeof db !== 'undefined') ? db : firebase.database();

    try {
        if (editingItemKey) {
            // === UPDATE MODE ===
            const item = allMaterialStockData.find(i => i.key === editingItemKey);
            
            const updates = {};
            updates['productName'] = productDetail;
            updates['familyCode'] = familyCode;
            updates['family'] = STOCK_LEGENDS[familyCode].name;
            updates['relationCode'] = relationCode;
            updates['relationship'] = STOCK_LEGENDS[familyCode].relations[relationCode];
            
            updates['category'] = STOCK_LEGENDS[familyCode].name;
            updates['details'] = STOCK_LEGENDS[familyCode].relations[relationCode];
            
            updates['updatedBy'] = (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'Irwin');
            updates['lastUpdated'] = firebase.database.ServerValue.TIMESTAMP;

            if (stockInputVal > 0) {
                if (!item.sites) item.sites = {};
                const currentSiteQty = parseFloat(item.sites[selectedSite] || 0);
                item.sites[selectedSite] = currentSiteQty + stockInputVal;
                
                updates['sites'] = item.sites;
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

        document.getElementById('ms-new-material-modal').classList.add('hidden');
        editingItemKey = null; 
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
// 7. CSV UPLOAD
// ==========================================================================
function handleGetTemplate() {
    const headers = ["Product ID", "Item Name", "F", "RRR", "Stock", "Site"];
    const row1 = "1.104.00150,Concrete Blocks 200mm,1,104,500,Site 175";
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

function handleUploadCSV(event) {
    const role = (typeof currentApprover !== 'undefined' && currentApprover) ? (currentApprover.Role || '') : '';
    const isAdminUser = String(role).toLowerCase() === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    if (!isAdminUser && !isVacationDelegate) {
        alert("Access Denied: You do not have permission to upload stock CSV.");
        event.target.value = '';
        return;
    }

    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        
        const database = (typeof db !== 'undefined') ? db : firebase.database();
        const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : 'System';
        
        const idMap = new Map();
        const nameMap = new Map();
        let maxSeries = 0;

        allMaterialStockData.forEach(item => {
            const pid = (item.productID || item.productId || "").trim();
            if (pid) idMap.set(pid, item);
            if (item.productName) nameMap.set(item.productName.trim().toLowerCase(), item);
            const s = parseInt(item.series);
            if (!isNaN(s) && s > maxSeries) maxSeries = s;
        });

        const finalUpdates = {}; 
        let mergedCount = 0;
        let newCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

            if (cols.length >= 5) {
                const pID = cols[0].trim();
                const pName = cols[1].trim();
                const ff = cols[2].trim();
                const rrr = cols[3].trim();
                const pQty = parseFloat(cols[4]) || 0;
                const pSite = (cols[5] && cols[5] !== "") ? cols[5].trim() : "Main Store";

                if (pName) {
                    let existingItem = null;
                    if (pID && pID !== "") existingItem = idMap.get(pID);
                    else {
                        const normName = pName.toLowerCase();
                        existingItem = nameMap.get(normName);
                    }

                    if (existingItem) {
                        if (pName && pName !== "") existingItem.productName = pName;
                        if (!existingItem.sites) existingItem.sites = {};
                        
                        let currentSiteQty = parseFloat(existingItem.sites[pSite] || 0);
                        existingItem.sites[pSite] = currentSiteQty + pQty;

                        let total = 0;
                        Object.values(existingItem.sites).forEach(q => total += parseFloat(q));
                        existingItem.stockQty = total;
                        existingItem.balanceQty = total;
                        existingItem.lastUpdated = Date.now();
                        existingItem.updatedBy = currentUser;

                        finalUpdates[existingItem.key] = existingItem;
                        mergedCount++;

                    } else {
                        if (ff && rrr && STOCK_LEGENDS[ff]) {
                            let finalID = pID;
                            let finalSeries = 0;
                            if (!finalID) {
                                maxSeries++;
                                finalSeries = maxSeries;
                                const sssss = String(maxSeries).padStart(5, '0');
                                finalID = `${ff}.${rrr}.${sssss}`;
                            }

                            const familyName = STOCK_LEGENDS[ff].name;
                            const relationName = STOCK_LEGENDS[ff].relations[rrr] || "Unknown";
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
                                category: familyName,
                                details: relationName,
                                series: finalSeries,
                                stockQty: pQty,
                                balanceQty: pQty,
                                sites: sites,
                                status: "Active",
                                timestamp: Date.now(),
                                updatedBy: currentUser
                            };

                            idMap.set(finalID, newItem);
                            nameMap.set(pName.toLowerCase(), newItem);
                            finalUpdates[newKey] = newItem;
                            newCount++;
                        }
                    }
                }
            }
        }

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
// 9. HELPERS (Fixed: Accordion Effect)
// ==========================================================================

window.toggleStockDetail = function(rowId, btn) {
    // 1. Auto-Minimize Others (Close all other open rows)
    const allOpenRows = document.querySelectorAll('.stock-child-row:not(.hidden)');
    allOpenRows.forEach(row => {
        if (row.id !== rowId) {
            row.classList.add('hidden');
            // Reset the button for the closed row
            const prevRow = row.previousElementSibling;
            if (prevRow) {
                const expandBtn = prevRow.querySelector('.ms-expand-btn');
                if (expandBtn) expandBtn.textContent = '+';
            }
        }
    });

    // 2. Toggle Current Item
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

    checkedBoxes.forEach(box => {
        const key = box.dataset.key;
        const stockItem = allMaterialStockData.find(i => i.key === key);
        const productID = stockItem?.productID || stockItem?.productId || "";

        updates[`material_stock/${key}`] = null;

        if (productID && productID.trim() !== "") {
            const relatedTransfers = allTransferData.filter(t => {
                const tID = (t.productID || t.productId || "").toString().trim();
                const sID = productID.toString().trim();
                return tID === sID;
            });
            relatedTransfers.forEach(t => {
                updates[`transfer_entries/${t.key}`] = null;
                transfersDeletedCount++;
            });
        }
    });

    try {
        await database.ref().update(updates);
        alert(`Success!\n\nDeleted ${count} Stock Items.\nDeleted ${transfersDeletedCount} Related History Entries.`);
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

// ==========================================================================
// REPORTING FUNCTIONS (Updated: Logo Left, Text Centered Below)
// ==========================================================================
function openStockReportModal() {
    const modal = document.getElementById('ms-report-modal');
    const tbody = document.getElementById('ms-report-table-body');
    const data = lastFilteredStockData;

    // 1. Prepare Title & Filter Info
    let titleSuffix = "";
    if (currentCategoryFilter && currentCategoryFilter !== 'All') {
        const familyName = STOCK_LEGENDS[currentCategoryFilter]?.name || currentCategoryFilter;
        titleSuffix = `<span style="display:block; font-size:14px; font-weight:normal; margin-top:5px; color:#555;">(Filtered: ${familyName})</span>`;
    }

    // 2. INJECT LOGO & HEADER
    const headerContainer = document.querySelector('#ms-report-modal .print-only-header');
    if (headerContainer) {
        headerContainer.innerHTML = `
            <div style="margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 15px;">
                
                <img src="https://firebasestorage.googleapis.com/v0/b/ibainvoice-3ea51.firebasestorage.app/o/iba_logo.png?alt=media&token=ccc85b7b-d41e-4242-9e27-08942efb3012" 
                     style="width: 550px; max-width: 100%; height: auto;" 
                     alt="IBA Logo">
                
                <div class="print-only-header-text" style="clear: both; text-align: center; margin-top: 10px;">
                    <h3 style="margin: 0; font-family: sans-serif; color: #222; text-transform: uppercase; font-size: 20px; font-weight: bold; line-height: 1.2;">
                        Material Stock Status Report
                    </h3>
                    ${titleSuffix}
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #444;">Generated: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `;
    }

    // 3. Update Stats Boxes
    document.getElementById('ms-report-total').textContent = data.length;
    document.getElementById('ms-report-instock').textContent = data.filter(i => (parseFloat(i.stockQty) || 0) > 0).length;
    document.getElementById('ms-report-outstock').textContent = data.length - data.filter(i => (parseFloat(i.stockQty) || 0) > 0).length;
    
    // (Optional) Update date if element exists
    const dateEl = document.getElementById('ms-report-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleString();

    // 4. Render Table Rows
    tbody.innerHTML = '';
    data.forEach(item => {
        let locText = 'Main Store: 0';
        if (item.sites) {
            const locs = [];
            Object.entries(item.sites).forEach(([site, qty]) => {
                if (parseFloat(qty) > 0) locs.push(`${site}: ${qty}`);
            });
            if (locs.length > 0) locText = locs.join(', ');
            else if ((parseFloat(item.stockQty) || 0) > 0) locText = 'Main Store: ' + item.stockQty;
            else locText = 'Out of Stock';
        }

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:5px; font-weight:bold;">${item.productID || ''}</td>
                <td style="padding:5px;">${item.productName}</td>
                <td style="padding:5px; text-align:center; font-weight:bold;">${item.stockQty}</td>
                <td style="padding:5px; font-size:0.85rem; color:#555;">${locText}</td>
            </tr>`;
    });

    modal.classList.remove('hidden');
}

function downloadFixedStockCSV() {
    // --- USE FILTERED DATA FROM TABLE ---
    let data = lastFilteredStockData;

    if (data.length === 0) { alert("No data to export."); return; }

    let csvContent = "data:text/csv;charset=utf-8,";
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
    link.setAttribute("download", `Stock_Report_${currentCategoryFilter || 'Filtered'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// 10. EVENTS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initMaterialStockSystem();
    populateMaterialStock(false); // <--- ENSURE AUTO-LOAD IS ACTIVE

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

   // --- MATERIAL STOCK CLEAR BUTTON LOGIC ---
    const msClearBtn = document.getElementById('ms-search-clear-btn');
    const msTableBody = document.getElementById('ms-table-body');
    const msCountDisplay = document.getElementById('ms-total-count');
    const msTabs = document.getElementById('ms-category-tabs');

    if (msClearBtn) {
        msClearBtn.addEventListener('click', () => {
            // 1. Clear Search Input
            if (msSearchInput) {
                msSearchInput.value = '';
                msSearchInput.focus(); 
            }
            
            // 2. Wipe Table
            if (msTableBody) {
                msTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#777;">List cleared. Please select a Family tab above.</td></tr>';
            }
            
            // 3. Reset Counts
            if (msCountDisplay) {
                msCountDisplay.textContent = '';
            }
            
            // 4. Reset Category Tabs
            if (msTabs) {
                msTabs.querySelectorAll('.active').forEach(tab => {
                    tab.classList.remove('active');
                    tab.style.borderBottomColor = 'transparent';
                    tab.style.color = '#555';
                });
            }
            currentCategoryFilter = null; 
            
            // 5. NEW: Reset Site Filter to "All"
            const siteFilter = document.getElementById('ms-site-filter');
            if(siteFilter) siteFilter.value = 'All';
        });
    }

    const openReportBtn = document.getElementById('ms-open-report-modal-btn');
    if(openReportBtn) openReportBtn.addEventListener('click', openStockReportModal);

    const printModalBtn = document.getElementById('ms-modal-print-btn');
    if(printModalBtn) printModalBtn.addEventListener('click', () => {
        window.print();
    });

    const excelModalBtn = document.getElementById('ms-modal-excel-btn');
    if(excelModalBtn) excelModalBtn.addEventListener('click', downloadFixedStockCSV);

    const bulkDeleteBtn = document.getElementById('ms-bulk-delete-btn');
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete);

    const saveStockBtn = document.getElementById('ms-save-stock-btn');
    if(saveStockBtn) {
        saveStockBtn.addEventListener('click', async () => {
            const key = document.getElementById('ms-add-key').value;
            const site = document.getElementById('ms-add-site-select').value;
            const qty = parseFloat(document.getElementById('ms-add-qty-input').value) || 0;
            
            if(qty === 0) { alert("Enter quantity."); return; }
            
            const item = allMaterialStockData.find(i => i.key === key);
            let sites = item.sites || {};
            
            let currentSiteQty = parseFloat(sites[site] || 0);
            currentSiteQty += qty;
            if(currentSiteQty < 0) { alert("Cannot have negative stock."); return; }
            
            sites[site] = currentSiteQty;
            
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
    if (!confirm(`⚠️ WARNING (Super Admin)\n\nAre you sure you want to remove ALL stock from:\n📍 ${siteToDelete}?\n\nOther sites for this item will remain safe.`)) {
        return;
    }

    const database = firebase.database();
    
    try {
        const snapshot = await database.ref(`material_stock/${key}`).once('value');
        const item = snapshot.val();
        
        if (!item || !item.sites) {
            alert("Error: Item or sites not found.");
            return;
        }

        const updatedSites = { ...item.sites };
        delete updatedSites[siteToDelete];

        let newTotal = 0;
        Object.values(updatedSites).forEach(q => newTotal += parseFloat(q) || 0);

        await database.ref(`material_stock/${key}`).update({
            sites: updatedSites,
            stockQty: newTotal,
            balanceQty: newTotal,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
            updatedBy: "Irwin (Site Deleted)"
        });

        alert(`Success! Removed stock from ${siteToDelete}.`);
        
        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);

    } catch (e) {
        console.error("Delete Site Error:", e);
        alert("Failed to delete site stock.");
    }
};