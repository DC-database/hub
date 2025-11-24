document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // 1. INITIALIZATION & REFERENCES
    // ==========================================================================
    
    const db = firebase.database(); 

    // DOM Elements - Job Entry
    const jobForSelect = document.getElementById('job-for');
    const standardFormColumns = document.querySelectorAll('.jobentry-form-2col .form-column');
    const transferFieldsContainer = document.getElementById('transfer-fields-container');
    
    // Job Entry Buttons
    const addJobBtn = document.getElementById('add-job-button'); 
    const addTransferBtn = document.getElementById('add-transfer-btn');
    const cancelTransferBtn = document.getElementById('cancel-transfer-btn'); 
    
    // DOM Elements - Material Stock
    const navMaterialStock = document.getElementById('nav-material-stock');
    const materialStockSection = document.getElementById('wd-material-stock');
    const stockFormContainer = document.getElementById('material-stock-form-container');
    const stockTableBody = document.getElementById('material-stock-table-body');
    const saveStockBtn = document.getElementById('save-stock-btn');
    const cancelStockBtn = document.getElementById('cancel-stock-btn');
    
    // Inputs
    const stockQtyInput = document.getElementById('stock-qty');
    const transQtyInput = document.getElementById('stock-transferred-qty');
    const balanceDisplay = document.getElementById('stock-balance-display');
    
    // New CSV & Action Buttons
    const addStockBtn = document.getElementById('add-stock-btn'); 
    const uploadStockCsvBtn = document.getElementById('upload-stock-csv-btn');
    const downloadStockTemplateBtn = document.getElementById('download-stock-template-btn');
    const stockCsvInput = document.getElementById('stock-csv-upload');

    // Transfer Specific Inputs (New Dropdowns)
    const trfFromSite = document.getElementById('trf-from-site');
    const trfToSite = document.getElementById('trf-to-site');
    const trfContactName = document.getElementById('trf-contact-name');
    const trfShippingDate = document.getElementById('trf-shipping-date');
    const trfAcquiredDate = document.getElementById('trf-acquired-date');

    let currentUser = null;
    let isUserAdmin = false;
    
    // Choices.js instances storage
    let fromSiteChoices = null;
    let toSiteChoices = null;
    let contactChoices = null;

    // ==========================================================================
    // 2. PERMISSION CHECK & SETUP
    // ==========================================================================
    
    async function checkPermissions() {
        const key = localStorage.getItem('approverKey');
        if (!key) return;

        try {
            const snapshot = await db.ref(`approvers/${key}`).once('value');
            currentUser = snapshot.val();

            if (currentUser) {
                const position = (currentUser.Position || '').trim();
                const role = (currentUser.Role || '').toLowerCase();
                
                isUserAdmin = (role === 'admin');

                // 1. ACCESS RULE: "Site DC" OR "Admin" can VIEW the page
                if (position === 'Site DC' || isUserAdmin) {
                    navMaterialStock.classList.remove('hidden');
                }

                // 2. ACTION RULE: Only "Admin" can ADD/UPLOAD
                if (isUserAdmin) {
                    if(addStockBtn) addStockBtn.classList.remove('hidden');
                    if(uploadStockCsvBtn) uploadStockCsvBtn.classList.remove('hidden');
                    if(downloadStockTemplateBtn) downloadStockTemplateBtn.classList.remove('hidden');
                } else {
                    if(addStockBtn) addStockBtn.classList.add('hidden');
                    if(uploadStockCsvBtn) uploadStockCsvBtn.classList.add('hidden');
                    if(downloadStockTemplateBtn) downloadStockTemplateBtn.classList.add('hidden');
                }
            }
        } catch (e) {
            console.error("Error checking permissions:", e);
        }
    }
    
    checkPermissions();

    // ==========================================================================
    // 3. DROPDOWN POPULATION & DEFAULTS
    // ==========================================================================

    // A. Fetch Sites (Reusable for From/To)
    async function populateTransferSites() {
        // Try to get from LocalStorage cache first (shared with app.js)
        const cachedSites = localStorage.getItem('cached_SITES');
        let sitesData = [];

        if (cachedSites) {
            try {
                const parsed = JSON.parse(cachedSites);
                sitesData = parsed.data || [];
            } catch (e) { console.error("Error parsing cached sites", e); }
        }

        // If no cache, we might need to fetch (Fallback)
        if (sitesData.length === 0) {
            console.log("Transfer: Fetching Site.csv...");
            // Using the same URL structure as your main app
            const url = "https://cdn.jsdelivr.net/gh/DC-database/Hub@main/Site.csv";
            try {
                const response = await fetch(url);
                const text = await response.text();
                // Simple CSV Parse
                const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim() !== '');
                for (let i = 1; i < lines.length; i++) {
                    // Handle simple CSV structure Site,Description
                    const parts = lines[i].split(','); 
                    if(parts.length >= 2) {
                        const siteId = parts[0].replace(/"/g, '').trim();
                        const desc = parts[1].replace(/"/g, '').trim();
                        if(siteId) sitesData.push({ site: siteId, description: desc });
                    }
                }
            } catch (err) { console.error("Failed to fetch sites for transfer", err); }
        }

        // Format for Choices.js
        const siteOptions = sitesData.map(s => ({
            value: s.site,
            label: `${s.site} - ${s.description}`
        })).sort((a, b) => {
            // Sort numerically if possible, else alphabetically
            const numA = parseInt(a.value); const numB = parseInt(b.value);
            return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.label.localeCompare(b.label);
        });

        // Initialize Choices.js for FROM SITE
        if (trfFromSite) {
            if (fromSiteChoices) fromSiteChoices.destroy();
            fromSiteChoices = new Choices(trfFromSite, {
                choices: siteOptions,
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
                placeholderValue: 'Select Site',
                removeItemButton: true
            });
        }

        // Initialize Choices.js for TO SITE
        if (trfToSite) {
            if (toSiteChoices) toSiteChoices.destroy();
            toSiteChoices = new Choices(trfToSite, {
                choices: siteOptions,
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
                placeholderValue: 'Select Site',
                removeItemButton: true
            });
        }
    }

    // B. Fetch Approvers (Contact Name)
    async function populateContactName() {
        if (!trfContactName) return;
        
        try {
            // Reuse the approvers list from Firebase
            const snapshot = await db.ref('approvers').once('value');
            const approvers = snapshot.val();
            const options = [];

            if (approvers) {
                Object.values(approvers).forEach(app => {
                    if (app.Name) {
                        const label = `${app.Name} - ${app.Position || ''}`;
                        options.push({ value: app.Name, label: label });
                    }
                });
            }
            
            // Sort Alphabetically
            options.sort((a, b) => a.label.localeCompare(b.label));

            if (contactChoices) contactChoices.destroy();
            contactChoices = new Choices(trfContactName, {
                choices: options,
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
                placeholderValue: 'Select Contact',
                removeItemButton: true
            });

        } catch (error) {
            console.error("Error fetching contacts for transfer:", error);
        }
    }

    // C. Set Default Dates (Today)
    function setDateDefaults() {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        if(trfShippingDate) trfShippingDate.value = today;
        if(trfAcquiredDate) trfAcquiredDate.value = today;
    }

    // ==========================================================================
    // 4. HELPER: SEQUENTIAL ID & STOCK UPDATE LOGIC
    // ==========================================================================
    
    async function generateNextTransferId() {
        const controlIdInput = document.getElementById('trf-control-id');
        if (!controlIdInput) return;

        controlIdInput.placeholder = "Generating ID...";
        
        try {
            const snapshot = await db.ref('transfer_entries').once('value');
            const data = snapshot.val();
            let maxCount = 0;

            if (data) {
                Object.values(data).forEach(item => {
                    if (item.controlId && item.controlId.startsWith('TRF-')) {
                        const parts = item.controlId.split('-');
                        if (parts.length > 1) {
                            const num = parseInt(parts[1]);
                            if (!isNaN(num) && num > maxCount) {
                                maxCount = num;
                            }
                        }
                    }
                });
            }
            const nextNum = maxCount + 1;
            controlIdInput.value = `TRF-${String(nextNum).padStart(4, '0')}`;
            
        } catch (error) {
            console.error("Error generating Control ID:", error);
            controlIdInput.value = "TRF-ERROR";
        }
    }

    // Logic to find product in stock and deduct quantity
    async function updateStockFromTransfer(productId, qtyToTransfer) {
        if (!productId || qtyToTransfer <= 0) return;

        try {
            const snapshot = await db.ref('material_stock')
                                     .orderByChild('productId')
                                     .equalTo(productId)
                                     .once('value');
            
            const data = snapshot.val();
            if (!data) return; 

            const keys = Object.keys(data);
            const stockKey = keys[0];
            const stockItem = data[stockKey];

            const currentTransferred = parseFloat(stockItem.transferredQty) || 0;
            const currentStock = parseFloat(stockItem.stockQty) || 0;
            
            const newTransferred = currentTransferred + qtyToTransfer;
            const newBalance = currentStock - newTransferred;

            await db.ref(`material_stock/${stockKey}`).update({
                transferredQty: newTransferred,
                balanceQty: newBalance,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });

        } catch (error) {
            console.error("Error auto-updating stock inventory:", error);
        }
    }

    // ==========================================================================
    // 5. JOB ENTRY: "TRANSFER" LOGIC
    // ==========================================================================

    if (jobForSelect) {
        jobForSelect.addEventListener('change', async (e) => {
            const val = e.target.value;
            
            if (val === 'Transfer') {
                standardFormColumns.forEach(col => col.classList.add('hidden'));
                addJobBtn.classList.add('hidden'); 
                
                transferFieldsContainer.classList.remove('hidden');
                addTransferBtn.classList.remove('hidden');
                if(cancelTransferBtn) cancelTransferBtn.classList.remove('hidden');
                
                const controlIdInput = document.getElementById('trf-control-id');
                if (!controlIdInput.value) {
                    generateNextTransferId();
                }

                // --- LOAD DROPDOWN DATA ON DEMAND ---
                await populateTransferSites();
                await populateContactName();
                setDateDefaults();

            } else {
                revertToStandardJobEntry();
            }
        });
    }

    function revertToStandardJobEntry() {
        standardFormColumns.forEach(col => col.classList.remove('hidden'));
        addJobBtn.classList.remove('hidden');
        
        transferFieldsContainer.classList.add('hidden');
        addTransferBtn.classList.add('hidden');
        if(cancelTransferBtn) cancelTransferBtn.classList.add('hidden');
    }

    if (cancelTransferBtn) {
        cancelTransferBtn.addEventListener('click', () => {
            jobForSelect.value = ""; 
            revertToStandardJobEntry();
        });
    }

    if (addTransferBtn) {
        addTransferBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            addTransferBtn.textContent = "Saving...";
            addTransferBtn.disabled = true;

            // Logic: Use Delivered QTY if entered, otherwise use Ordered QTY for stock deduction
            const orderedVal = parseFloat(document.getElementById('trf-ordered-qty').value) || 0;
            const deliveredVal = parseFloat(document.getElementById('trf-delivered-qty').value) || 0;
            const qtyToDeduct = deliveredVal > 0 ? deliveredVal : orderedVal;

            // Get Values from Choices.js Dropdowns
            const fromSiteVal = fromSiteChoices ? fromSiteChoices.getValue(true) : '';
            const toSiteVal = toSiteChoices ? toSiteChoices.getValue(true) : '';
            const contactVal = contactChoices ? contactChoices.getValue(true) : '';

            const transferData = {
                controlId: document.getElementById('trf-control-id').value,
                productId: document.getElementById('trf-product-id').value,
                productName: document.getElementById('trf-product-name').value,
                details: document.getElementById('trf-details').value,
                fromSite: fromSiteVal,
                toSite: toSiteVal,
                orderedQty: orderedVal,
                deliveredQty: deliveredVal,
                shippingDate: document.getElementById('trf-shipping-date').value,
                acquiredDate: document.getElementById('trf-acquired-date').value,
                contactName: contactVal,
                operatorName: document.getElementById('trf-operator-name').value,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                enteredBy: currentUser ? currentUser.Name : 'Unknown',
                type: 'Transfer'
            };

            if (!transferData.fromSite || !transferData.toSite || !transferData.productName) {
                alert("Please fill in Product Name, From Site, and To Site.");
                addTransferBtn.textContent = "Add Transfer";
                addTransferBtn.disabled = false;
                return;
            }

            try {
                // 1. Save Transfer
                await db.ref('transfer_entries').push(transferData);
                
                // 2. Update Stock
                await updateStockFromTransfer(transferData.productId, qtyToDeduct);

                alert("Transfer Entry Saved & Inventory Updated!");
                
                // 3. Reset Inputs
                document.querySelectorAll('#transfer-fields-container input').forEach(i => i.value = '');
                
                // 4. Reset Dropdowns
                if(fromSiteChoices) fromSiteChoices.removeActiveItems();
                if(toSiteChoices) toSiteChoices.removeActiveItems();
                if(contactChoices) contactChoices.removeActiveItems();
                
                // 5. Prepare next ID and Reset Dates
                await generateNextTransferId();
                setDateDefaults();

            } catch (error) {
                console.error("Error saving transfer:", error);
                alert("Failed to save transfer.");
            } finally {
                addTransferBtn.textContent = "Add Transfer";
                addTransferBtn.disabled = false;
            }
        });
    }

    // ==========================================================================
    // 6. MATERIAL STOCK LOGIC
    // ==========================================================================

    if (navMaterialStock) {
        navMaterialStock.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.workdesk-section').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.workdesk-navigation a').forEach(el => el.classList.remove('active'));
            
            materialStockSection.classList.remove('hidden');
            navMaterialStock.querySelector('a').classList.add('active');
            
            loadMaterialStock();
        });
    }

    if (addStockBtn) {
        addStockBtn.addEventListener('click', () => {
            stockFormContainer.classList.remove('hidden');
            addStockBtn.classList.add('hidden');
            uploadStockCsvBtn.classList.add('hidden');
            downloadStockTemplateBtn.classList.add('hidden');
            
            clearStockForm();
            // Lock Transferred QTY for new entries
            if(transQtyInput) {
                transQtyInput.value = "0";
                transQtyInput.disabled = true;
                transQtyInput.style.backgroundColor = "#e9ecef";
            }
        });
    }
    
    if (cancelStockBtn) {
        cancelStockBtn.addEventListener('click', () => {
            stockFormContainer.classList.add('hidden');
            if (isUserAdmin) {
                addStockBtn.classList.remove('hidden');
                uploadStockCsvBtn.classList.remove('hidden');
                downloadStockTemplateBtn.classList.remove('hidden');
            }
            clearStockForm();
        });
    }

    function updateBalance() {
        const stock = parseFloat(stockQtyInput.value) || 0;
        const trans = parseFloat(transQtyInput.value) || 0;
        const bal = stock - trans;
        balanceDisplay.textContent = bal.toLocaleString(undefined, {minimumFractionDigits: 2});
        
        if(bal <= 0) {
            balanceDisplay.style.color = "#dc3545";
            balanceDisplay.style.backgroundColor = "#f8d7da";
        } else {
            balanceDisplay.style.color = "#003A5C";
            balanceDisplay.style.backgroundColor = "#e9ecef";
        }
    }

    if (stockQtyInput) {
        stockQtyInput.addEventListener('input', updateBalance);
    }

    if (saveStockBtn) {
        saveStockBtn.addEventListener('click', async () => {
            saveStockBtn.textContent = "Saving...";
            saveStockBtn.disabled = true;

            const stock = parseFloat(stockQtyInput.value) || 0;
            const trans = 0; 
            const balance = stock;

            const stockData = {
                productId: document.getElementById('stock-product-id').value,
                productName: document.getElementById('stock-product-name').value,
                details: document.getElementById('stock-details').value,
                stockQty: stock,
                transferredQty: trans,
                balanceQty: balance,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP,
                updatedBy: currentUser ? currentUser.Name : 'Unknown'
            };

            if (!stockData.productName || !stockData.productId) {
                alert("Product Name and ID are required.");
                saveStockBtn.textContent = "Save Stock";
                saveStockBtn.disabled = false;
                return;
            }

            try {
                await db.ref('material_stock').push(stockData);
                alert("Stock Added Successfully!");
                clearStockForm();
                stockFormContainer.classList.add('hidden');
                if (isUserAdmin) {
                    addStockBtn.classList.remove('hidden');
                    uploadStockCsvBtn.classList.remove('hidden');
                    downloadStockTemplateBtn.classList.remove('hidden');
                }
                loadMaterialStock(); 
            } catch (error) {
                console.error("Error saving stock:", error);
                alert("Failed to save stock.");
            } finally {
                saveStockBtn.textContent = "Save Stock";
                saveStockBtn.disabled = false;
            }
        });
    }

    function clearStockForm() {
        document.querySelectorAll('#material-stock-form-container input').forEach(i => i.value = '');
        document.getElementById('stock-balance-display').textContent = '0';
        if(transQtyInput) {
            transQtyInput.disabled = true;
            transQtyInput.value = 0;
        }
    }

    async function loadMaterialStock() {
        stockTableBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        
        try {
            const snapshot = await db.ref('material_stock').once('value');
            const data = snapshot.val();
            
            stockTableBody.innerHTML = '';
            
            if (!data) {
                stockTableBody.innerHTML = '<tr><td colspan="7">No stock records found.</td></tr>';
                return;
            }

            Object.entries(data).forEach(([key, item]) => {
                const row = document.createElement('tr');
                
                const balance = parseFloat(item.balanceQty) || 0;
                const isLowStock = balance <= 0;

                if (isLowStock) {
                    row.style.backgroundColor = '#ffe6e6'; 
                }

                const deleteBtnHtml = isUserAdmin 
                    ? `<button class="secondary-btn" onclick="deleteStock('${key}')" style="padding: 2px 8px; font-size: 12px; background-color: #dc3545;">Delete</button>`
                    : `<span style="color: #999; font-size: 0.8rem;">View Only</span>`;

                const balanceDisplay = isLowStock 
                    ? `<span style="color: #dc3545; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> ${balance}</span>`
                    : `<span style="font-weight:bold; color: #003A5C;">${balance}</span>`;

                row.innerHTML = `
                    <td>${item.productId || ''}</td>
                    <td>${item.productName || ''}</td>
                    <td>${item.details || ''}</td>
                    <td>${item.stockQty || 0}</td>
                    <td>${item.transferredQty || 0}</td>
                    <td>${balanceDisplay}</td>
                    <td>${deleteBtnHtml}</td>
                `;
                stockTableBody.appendChild(row);
            });

        } catch (error) {
            console.error("Error loading stock:", error);
            stockTableBody.innerHTML = '<tr><td colspan="7">Error loading data.</td></tr>';
        }
    }

    window.deleteStock = async function(key) {
        if (confirm("Are you sure you want to delete this stock entry?")) {
            await db.ref(`material_stock/${key}`).remove();
            loadMaterialStock();
        }
    };

    // ==========================================================================
    // 7. CSV UPLOAD & TEMPLATE LOGIC
    // ==========================================================================

    if (downloadStockTemplateBtn) {
        downloadStockTemplateBtn.addEventListener('click', () => {
            const headers = ["Product ID", "Product Name", "Details", "Stock QTY"];
            const exampleRow = ["P-1001", "Cement Bags", "50kg Grey Cement", "100"];
            
            const csvContent = "data:text/csv;charset=utf-8," 
                + headers.join(",") + "\n" 
                + exampleRow.join(",");

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "material_stock_template.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    if (stockCsvInput) {
        stockCsvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            
            reader.onload = async (event) => {
                const csvText = event.target.result;
                const lines = csvText.split('\n').filter(line => line.trim() !== '');
                
                if (lines.length < 2) {
                    alert("CSV appears to be empty or missing data rows.");
                    return;
                }
                
                let successCount = 0;
                const updates = {};

                for (let i = 1; i < lines.length; i++) {
                    const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                    const values = lines[i].split(',').map(val => val.trim().replace(/^"|"$/g, '')); 

                    if (values.length >= 2) { 
                        const pId = values[0];
                        const pName = values[1];
                        const details = values[2] || '';
                        const stock = parseFloat(values[3]) || 0;
                        const trans = 0; 
                        const balance = stock;

                        const newKey = db.ref('material_stock').push().key;
                        updates[newKey] = {
                            productId: pId,
                            productName: pName,
                            details: details,
                            stockQty: stock,
                            transferredQty: trans,
                            balanceQty: balance,
                            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
                            updatedBy: currentUser ? currentUser.Name : 'Batch Upload'
                        };
                        successCount++;
                    }
                }

                if (successCount > 0) {
                    try {
                        await db.ref('material_stock').update(updates);
                        alert(`Successfully uploaded ${successCount} records.`);
                        loadMaterialStock();
                    } catch (err) {
                        console.error(err);
                        alert("Error writing to database.");
                    }
                } else {
                    alert("No valid rows found.");
                }
                stockCsvInput.value = '';
            };
            reader.readAsText(file);
        });
    }
});