// ==========================================
// FIREBASE CONFIG 1: ITEM DATABASE (Original)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCPTuMQO1u4sWpV31614VQUEZKmnIIfm70",
    authDomain: "material-8f545.firebaseapp.com",
    databaseURL: "https://material-8f545-default-rtdb.firebaseio.com",
    projectId: "material-8f545",
    storageBucket: "material-8f545.firebasestorage.app",
    messagingSenderId: "563088704699",
    appId: "1:563088704699:web:e82a5bbca68e8483a3159e",
    measurementId: "G-F44DEZEX0Q"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

// ==========================================
// FIREBASE CONFIG 2: REQUISITIONS DATABASE (NEW)
// ==========================================
const firebaseConfigReq = {
    apiKey: "AIzaSyCxQKz3MOzyyKsJQhB54ZO1EKH_9QPkI44",
    authDomain: "requisition-bf146.firebaseapp.com",
    projectId: "requisition-bf146",
    storageBucket: "requisition-bf146.firebasestorage.app",
    messagingSenderId: "419583502521",
    appId: "1:419583502521:web:4eb33209e0f645f3145368",
    measurementId: "G-D60S6XVEGQ"
};

const reqApp = firebase.initializeApp(firebaseConfigReq, "RequisitionApp");
const dbReq = reqApp.firestore();

// ==========================================
// URLs & GLOBALS
// ==========================================
const ITEMS_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Item.csv";
const ACTIVITY_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/activity.csv";
const VENDORS_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Vendors.csv";
const SITE_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Site.csv";

let allSearchableItems = []; let allVendors = []; let allSites = [];
let cart = []; let legacyItems = []; let dynamicActivityData = {};
let currentGroupCode = null; let generatedSeries = null; let generatedPartCode = null;
let selectedVendor = { id: '', name: '' }; let selectedSite = { code: '', name: '' };

// ==========================================
// SESSION STORAGE LOGIC
// ==========================================
function saveSession() {
    const data = {
        cart: cart, vendor: selectedVendor, site: selectedSite,
        createdBy: document.getElementById('createdBy').value,
        mobileNumber: document.getElementById('mobileNumber').value
    };
    sessionStorage.setItem('pr_session_data', JSON.stringify(data));
}

function loadSession() {
    const stored = sessionStorage.getItem('pr_session_data');
    if (stored) {
        const data = JSON.parse(stored);
        cart = data.cart || [];
        selectedVendor = data.vendor || { id: '', name: '' };
        selectedSite = data.site || { code: '', name: '' };
        document.getElementById('createdBy').value = data.createdBy || '';
        document.getElementById('mobileNumber').value = data.mobileNumber || '';

        if(selectedVendor.id) document.getElementById('selectedVendorDisplay').innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <strong>${selectedVendor.id}</strong> - ${selectedVendor.name}`;
        if(selectedSite.code) document.getElementById('selectedSiteDisplay').innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <strong>${selectedSite.code}</strong> - ${selectedSite.name}`;
        
        renderCart();
    }
}

document.getElementById('createdBy').addEventListener('input', saveSession);
document.getElementById('mobileNumber').addEventListener('input', saveSession);

document.getElementById('clearSessionBtn').addEventListener('click', () => {
    if(confirm("Are you sure you want to clear your entire cart?")) {
        sessionStorage.removeItem('pr_session_data');
        location.reload();
    }
});

// ==========================================
// 1. INITIALIZATION
// ==========================================
async function initializeApp() {
    const cacheBuster = "?v=" + new Date().getTime();
    fetch(ITEMS_CSV_URL + cacheBuster).then(res => res.text()).then(csvText => { Papa.parse(csvText, { header: true, skipEmptyLines: true, complete: function(results) { allSearchableItems = results.data; legacyItems = results.data; }}); });
    fetch(ACTIVITY_CSV_URL + cacheBuster).then(res => res.text()).then(csvText => { Papa.parse(csvText, { header: true, skipEmptyLines: true, complete: function(results) { const selector = document.getElementById('activitySelector'); selector.innerHTML = '<option value="">-- Select Classification --</option>'; results.data.forEach(row => { const groupCode = row["Group Code"]; const groupName = row["Group Name"]; if(groupCode && groupName) { dynamicActivityData[groupCode] = { groupName: groupName, classCode: row["Class Code"] || "N/A", className: row["Class Name"] || "N/A", activityCode: row["Activity Code"] || "N/A", activityName: row["Activity Name"] || row["Activity"] || "N/A" }; const option = document.createElement('option'); option.value = groupCode; option.textContent = `${groupName} (Group: ${groupCode})`; selector.appendChild(option); } }); }}); });
    fetch(VENDORS_CSV_URL + cacheBuster).then(res => res.text()).then(csvText => { Papa.parse(csvText, { header: true, skipEmptyLines: true, complete: function(results) { allVendors = results.data; }}); });
    fetch(SITE_CSV_URL + cacheBuster).then(res => res.text()).then(csvText => { Papa.parse(csvText, { header: true, skipEmptyLines: true, complete: function(results) { allSites = results.data; }}); });
    loadSession(); 
}
initializeApp();

// ==========================================
// 2. VENDOR & SITE AUTOCOMPLETE
// ==========================================
const vendorSearch = document.getElementById('vendorSearch'); const vendorSuggestions = document.getElementById('vendorSuggestions'); const selectedVendorDisplay = document.getElementById('selectedVendorDisplay');
vendorSearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim(); vendorSuggestions.innerHTML = ''; if (q.length < 1) return;
    const matches = allVendors.filter(v => { return String(v["Name"] || "").toLowerCase().includes(q) || String(v["Supplier ID"] || "").toLowerCase().includes(q); }).slice(0, 8);
    matches.forEach(v => {
        const name = v["Name"] || "N/A"; const id = v["Supplier ID"] || "N/A"; const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<strong>${id}</strong> - ${name}`;
        div.onclick = () => { selectedVendor = { id: id, name: name }; selectedVendorDisplay.innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <strong>${id}</strong> - ${name}`; vendorSearch.value = name; vendorSuggestions.innerHTML = ''; saveSession(); };
        vendorSuggestions.appendChild(div);
    });
});

const siteSearch = document.getElementById('siteSearch'); const siteSuggestions = document.getElementById('siteSuggestions'); const selectedSiteDisplay = document.getElementById('selectedSiteDisplay');
siteSearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim(); siteSuggestions.innerHTML = ''; if (q.length < 1) return;
    const matches = allSites.filter(s => { return String(s["Description"] || "").toLowerCase().includes(q) || String(s["Warehouse"] || "").toLowerCase().includes(q); }).slice(0, 8);
    matches.forEach(s => {
        const name = s["Description"] || "N/A"; const code = s["Warehouse"] || "N/A"; const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<strong>${code}</strong> - ${name}`;
        div.onclick = () => { selectedSite = { code: code, name: name }; selectedSiteDisplay.innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <strong>${code}</strong> - ${name}`; siteSearch.value = name; siteSuggestions.innerHTML = ''; saveSession(); };
        siteSuggestions.appendChild(div);
    });
});

document.addEventListener('click', (e) => { if (!e.target.closest('.autocomplete-wrapper')) { vendorSuggestions.innerHTML = ''; siteSuggestions.innerHTML = ''; } });

// ==========================================
// 3. SHOPPING CART & SEARCH LOGIC
// ==========================================
const searchInput = document.getElementById('searchInput'); const searchResults = document.getElementById('searchResults'); const cartBody = document.getElementById('cartBody');
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim(); searchResults.innerHTML = ''; if (query.length < 2) return; 
    const matches = allSearchableItems.filter(item => { return String(item["Part Code"]||item["Part code"]||"").toLowerCase().includes(query) || String(item["Description"]||item["description"]||"").toLowerCase().includes(query) || String(item["Group Name"]||item["Group name"]||"").toLowerCase().includes(query) || String(item["Activity Name"]||item["Activity name"]||item["Activity"]||"").toLowerCase().includes(query); }).slice(0, 15); 
    if (matches.length === 0) { searchResults.innerHTML = '<div class="no-results">No items found. Click "Create New" to generate a part code.</div>'; return; }
    matches.forEach(item => {
        const partNo = item["Part Code"] || item["Part code"] || "N/A"; const desc = item["Description"] || "N/A"; const uom = item["UOM"] || "EA"; const groupName = item["Group Name"] || item["Group name"] || "N/A"; const actName = item["Activity Name"] || item["Activity name"] || item["Activity"] || "N/A";
        const safeDesc = String(desc).replace(/'/g, "\\'").replace(/"/g, '&quot;'); const safeGroup = String(groupName).replace(/'/g, "\\'").replace(/"/g, '&quot;'); const safeAct = String(actName).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const div = document.createElement('div'); div.className = 'result-item';
        div.innerHTML = `
            <div class="result-info"><strong>${partNo}</strong> - ${desc} <em>(${uom})</em><br>
            <span style="font-size: 12px; color: #64748b; margin-top: 4px; display: inline-block;">
            <i class="fa-solid fa-folder-tree"></i> ${groupName} &nbsp;|&nbsp; <i class="fa-solid fa-clipboard-check"></i> ${actName}</span></div>
            <button class="add-btn" onclick="addToCart('${partNo}', '${safeDesc}', '${uom}', '${safeGroup}', '${safeAct}')"><i class="fa-solid fa-plus"></i> Add</button>
        `;
        searchResults.appendChild(div);
    });
});

window.addToCart = function(partCode, description, unit, groupName, actName) {
    if (cart.find(i => i.partNo === partCode)) { alert("Item is already in your list!"); return; }
    cart.push({ partNo: partCode, description: description, unit: unit, groupName: groupName, actName: actName, comment: '', qty: 1, price: 0 });
    searchInput.value = ''; searchResults.innerHTML = ''; renderCart(); saveSession();
};

function renderCart() {
    cartBody.innerHTML = ''; let grandTotal = 0;
    const previewBtn = document.getElementById('previewBtn');
    const saveBtnAction = document.getElementById('saveBtnAction');

    if (cart.length === 0) {
        cartBody.innerHTML = '<tr class="empty-row"><td colspan="8">No items added to the list yet.</td></tr>';
        previewBtn.disabled = true; saveBtnAction.disabled = true;
        document.getElementById('grandTotalVal').textContent = "0.00"; return;
    }

    previewBtn.disabled = false; saveBtnAction.disabled = false;
    
    cart.forEach((item, index) => {
        const total = item.qty * item.price; grandTotal += total;
        const units = ['Bag', 'Box', 'Bun', 'Day', 'Doz', 'Dr', 'Gal', 'Hrs', 'Kg', 'Litre', 'Lm', 'm2', 'm3', 'Mon', 'Pcs', 'Annual'];
        let unitOptions = ''; let found = false;
        units.forEach(u => { if (item.unit && u.toLowerCase() === item.unit.toLowerCase()) { unitOptions += `<option value="${u}" selected>${u}</option>`; found = true; } else { unitOptions += `<option value="${u}">${u}</option>`; } });
        if (!found) { unitOptions += `<option value="${item.unit || 'EA'}" selected>${item.unit || 'EA'}</option>`; }

        const tr = document.createElement('tr');
        // Added the (Activity Name) here!
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${item.partNo}</strong><br><em class="cart-group-name">${item.groupName} (${item.actName || ''})</em></td>
            <td>${item.description}<br><input type="text" class="calc-input cart-comment-input" placeholder="Add a comment (optional)..." value="${item.comment}" data-index="${index}"></td>
            <td><input type="number" min="1" class="calc-input qty-input" value="${item.qty}" data-index="${index}" data-field="qty"></td>
            <td><select class="calc-input unit-input" data-index="${index}">${unitOptions}</select></td>
            <td><input type="number" min="0" step="0.01" class="calc-input price-input" value="${item.price}" data-index="${index}" data-field="price"></td>
            <td class="row-total">${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td class="action-col"><button class="remove-btn" onclick="removeFromCart(${index})"><i class="fa-solid fa-trash"></i></button></td>
        `;
        cartBody.appendChild(tr);
    });

    document.getElementById('grandTotalVal').textContent = grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2});
    
    document.querySelectorAll('.qty-input, .price-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.index; const field = e.target.dataset.field;
            cart[idx][field] = parseFloat(e.target.value) || 0;
            saveSession();

            const rowNode = e.target.closest('tr');
            const totalNode = rowNode.querySelector('.row-total');
            const newTotal = cart[idx].qty * cart[idx].price;
            totalNode.textContent = newTotal.toLocaleString('en-US', {minimumFractionDigits: 2});

            let newGrand = 0; cart.forEach(i => newGrand += (i.qty * i.price));
            document.getElementById('grandTotalVal').textContent = newGrand.toLocaleString('en-US', {minimumFractionDigits: 2});
        });
    });

    document.querySelectorAll('.unit-input, .cart-comment-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const field = e.target.classList.contains('unit-input') ? 'unit' : 'comment';
            cart[e.target.dataset.index][field] = e.target.value; saveSession();
        });
    });
}
window.removeFromCart = function(index) { cart.splice(index, 1); renderCart(); saveSession(); };

// ==========================================
// 4. MODAL (POP-UP) LOGIC
// ==========================================
const modal = document.getElementById('generatorModal'); const openBtn = document.getElementById('openGeneratorBtn'); const closeBtn = document.getElementById('closeModalBtn');
if (openBtn && modal) openBtn.addEventListener('click', (e) => { e.preventDefault(); modal.classList.add('active'); });
if (closeBtn && modal) closeBtn.addEventListener('click', (e) => { e.preventDefault(); modal.classList.remove('active'); });

const activitySelector = document.getElementById('activitySelector'); const saveBtn = document.getElementById('saveBtn');
activitySelector.addEventListener('change', async (e) => {
    currentGroupCode = e.target.value; if (!currentGroupCode) { saveBtn.disabled = true; saveBtn.textContent = "Select Group First"; return; }
    const data = dynamicActivityData[currentGroupCode]; document.getElementById('dispGroup').value = `${currentGroupCode} - ${data.groupName}`; document.getElementById('dispClass').value = `${data.classCode} - ${data.className}`; document.getElementById('dispActivity').value = `${data.activityCode} - ${data.activityName}`;
    await calculateNextSeries(currentGroupCode);
});

async function calculateNextSeries(groupCode) {
    saveBtn.disabled = true; saveBtn.textContent = "Calculating..."; let highestSeries = 100000; 
    try {
        legacyItems.forEach(item => { if (item["Group Code"] === groupCode || item["Group code"] === groupCode) { const sNum = parseInt(item["Series"], 10); if (sNum > highestSeries) highestSeries = sNum; } });
        const snap = await db.collection("items").where("Group Code", "==", groupCode).get();
        snap.forEach((doc) => { const sNum = parseInt(doc.data().Series, 10); if (sNum > highestSeries) highestSeries = sNum; });
        generatedSeries = (highestSeries + 1).toString(); generatedPartCode = `${groupCode}.${generatedSeries}`;
        document.getElementById('previewPartCode').textContent = generatedPartCode; document.getElementById('previewSeries').textContent = `Series: ${generatedSeries}`;
        saveBtn.disabled = false; saveBtn.textContent = "Save Item & Add to Cart";
    } catch (err) { console.error(err); alert("Error calculating series."); }
}

document.getElementById('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault(); if(!currentGroupCode || !generatedSeries) return;
    const data = dynamicActivityData[currentGroupCode]; const itemDesc = document.getElementById('description').value; const itemUOM = document.getElementById('uom').value;
    const newItemRecord = { "Part Code": generatedPartCode, "Series": generatedSeries, "Description": itemDesc, "UOM": itemUOM, "Group Code": currentGroupCode, "Group Name": data.groupName, "Class Code": data.classCode, "Class Name": data.className, "Activity Code": data.activityCode, "Activity Name": data.activityName, "CreatedAt": new Date().toISOString() };
    try {
        saveBtn.disabled = true; saveBtn.textContent = "Saving...";
        await db.collection("items").add(newItemRecord); allSearchableItems.push(newItemRecord);
        // Added the activity name parameter here too
        addToCart(generatedPartCode, itemDesc, itemUOM, data.groupName, data.activityName);
        document.getElementById('itemForm').reset(); document.getElementById('previewPartCode').textContent = 'XXXXX.XXXXXX'; document.getElementById('previewSeries').textContent = 'Series: ------';
        saveBtn.disabled = true; saveBtn.textContent = "Select Group First"; modal.classList.remove('active'); 
    } catch (error) { console.error("Error adding document: ", error); alert("Failed to save to Firebase."); saveBtn.disabled = false; saveBtn.textContent = "Save Item & Add to Cart"; }
});

// ==========================================
// 6. PREVIEW & SAVE LOGIC
// ==========================================
function populatePrintLayout(reqNum, dateStr, createdBy, mobile) {
    document.getElementById('printReqNumber').textContent = reqNum;
    document.getElementById('printReqDate').textContent = dateStr;
    document.getElementById('printVendorId').textContent = selectedVendor.id || '_________________';
    document.getElementById('printVendorName').textContent = selectedVendor.name || '_________________';
    document.getElementById('printSiteId').textContent = selectedSite.code || '_________________';
    document.getElementById('printSiteName').textContent = selectedSite.name || '_________________';
    
    // FORMATTING THE SINGLE LINE "CREATED BY" STRING
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    
    const exactTimeStr = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    const cleanCreatedBy = createdBy || "N/A";
    const cleanMobile = mobile || "N/A";
    
    document.getElementById('printFooterInfo').textContent = `${cleanCreatedBy}:${cleanMobile}: ${exactTimeStr}`;

    let grandTotal = 0;
    let html = `<thead><tr><th>SN</th><th>Part No</th><th>Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th></tr></thead><tbody>`;
    cart.forEach((item, i) => {
        const total = item.qty * item.price; grandTotal += total;
        const commentHTML = item.comment ? `<br><em style="font-size: 10px; color: #64748b; font-style: italic;">Note: ${item.comment}</em>` : '';
        // Added the (Activity Name) here!
        html += `<tr><td>${i + 1}</td><td><strong>${item.partNo}</strong><br><em style="font-size: 10px; color: #64748b;">${item.groupName} (${item.actName || ''})</em></td><td>${item.description} ${commentHTML}</td><td>${item.qty}</td><td>${item.unit}</td><td>${item.price.toLocaleString('en-US', {minimumFractionDigits: 2})}</td><td>${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>`;
    });
    
    document.getElementById('printTable').innerHTML = html + `</tbody>`;
    document.getElementById('printGrandTotalVal').textContent = grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2});
}

// ACTION 1: PREVIEW ONLY
document.getElementById('previewBtn').addEventListener('click', () => {
    const d = new Date();
    const formattedDate = `${String(d.getDate()).padStart(2, '0')} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;
    const createdBy = document.getElementById('createdBy').value.trim();
    const mobile = document.getElementById('mobileNumber').value.trim();

    populatePrintLayout("DRAFT", formattedDate, createdBy, mobile);
    window.print();
});

// ACTION 2: SAVE TO FIREBASE AND PRINT
document.getElementById('saveBtnAction').addEventListener('click', async () => {
    const createdBy = document.getElementById('createdBy').value.trim();
    const mobile = document.getElementById('mobileNumber').value.trim();
    
    if (!createdBy || !mobile) {
        alert("Wait! Please fill in your 'Created By' Name and 'Mobile Number' at the top before saving.");
        return;
    }

    const saveBtnAction = document.getElementById('saveBtnAction');
    saveBtnAction.disabled = true;
    saveBtnAction.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        let nextReqNum = 100001;
        const prRef = dbReq.collection("requisitions");
        const snapshot = await prRef.orderBy("reqNumber", "desc").limit(1).get();
        if (!snapshot.empty) {
            const lastNum = snapshot.docs[0].data().reqNumber;
            nextReqNum = parseInt(lastNum) + 1;
        }

        const d = new Date();
        const formattedDate = `${String(d.getDate()).padStart(2, '0')} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;

        let grandTotal = 0; cart.forEach(item => grandTotal += (item.qty * item.price));

        await prRef.doc(nextReqNum.toString()).set({
            reqNumber: nextReqNum,
            createdAt: d.toISOString(),
            dateFormatted: formattedDate,
            vendor: selectedVendor,
            site: selectedSite,
            createdBy: createdBy,
            mobileNumber: mobile,
            items: cart,
            totalValue: grandTotal
        });

        populatePrintLayout(nextReqNum, formattedDate, createdBy, mobile);
        window.print();
        
        setTimeout(() => {
            alert(`Success! Requisition Number ${nextReqNum} has been saved.`);
            sessionStorage.removeItem('pr_session_data');
            location.reload(); 
        }, 1000);
        
    } catch (error) {
        console.error(error); alert("Database Error. Check connection.");
    } finally {
        saveBtnAction.disabled = false;
        saveBtnAction.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save Requisition';
    }
});