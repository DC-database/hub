// ==========================================
// FIREBASE CONFIGURATION (V8)
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
// GITHUB CSV URLs
// ==========================================
const ITEMS_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Item.csv";
const ACTIVITY_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/activity.csv";

// ==========================================
// GLOBAL STATE
// ==========================================
let allSearchableItems = []; 
let cart = []; 
let dynamicActivityData = {}; 
let legacyItems = []; 
let currentGroupCode = null;
let generatedSeries = null;
let generatedPartCode = null;

// ==========================================
// 1. INITIALIZATION: FETCH ALL DATA
// ==========================================
async function initializeApp() {
    const cacheBuster = "?v=" + new Date().getTime();
    
    // Fetch Items List for Search AND Legacy checking
    try {
        const itemResponse = await fetch(ITEMS_CSV_URL + cacheBuster);
        if (itemResponse.ok) {
            const csvText = await itemResponse.text();
            Papa.parse(csvText, {
                header: true, skipEmptyLines: true,
                complete: function(results) {
                    allSearchableItems = results.data;
                    legacyItems = results.data;
                    console.log("Loaded " + allSearchableItems.length + " items from GitHub.");
                }
            });
        }
    } catch (e) { console.error("Error loading items", e); }

    // Fetch Activity List for Generator Dropdown
    try {
        const actResponse = await fetch(ACTIVITY_CSV_URL + cacheBuster);
        if (actResponse.ok) {
            const csvText = await actResponse.text();
            Papa.parse(csvText, {
                header: true, skipEmptyLines: true,
                complete: function(results) {
                    const selector = document.getElementById('activitySelector');
                    selector.innerHTML = '<option value="">-- Select Classification --</option>';
                    
                    results.data.forEach(row => {
                        // Matching exact capitals from activity.csv
                        const groupCode = row["Group Code"];
                        const groupName = row["Group Name"];
                        if(groupCode && groupName) {
                            dynamicActivityData[groupCode] = {
                                groupName: groupName, 
                                classCode: row["Class Code"] || "N/A", 
                                className: row["Class Name"] || "N/A", 
                                activityCode: row["Activity Code"] || "N/A", 
                                activityName: row["Activity Name"] || row["Activity"] || "N/A"
                            };
                            const option = document.createElement('option');
                            option.value = groupCode; option.textContent = `${groupName} (Group: ${groupCode})`;
                            selector.appendChild(option);
                        }
                    });
                }
            });
        }
    } catch (e) { console.error("Error loading activities", e); }
}
initializeApp();

// ==========================================
// 2. SHOPPING CART & SEARCH LOGIC
// ==========================================
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const cartBody = document.getElementById('cartBody');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    searchResults.innerHTML = ''; 

    if (query.length < 2) return; 

    const matches = allSearchableItems.filter(item => {
        const partCode = (item["Part Code"] || item["Part code"] || "").toLowerCase();
        const desc = (item["Description"] || item["description"] || "").toLowerCase();
        return partCode.includes(query) || desc.includes(query);
    }).slice(0, 15); 

    if (matches.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No items found. Click "Create New" to generate a part code.</div>';
        return;
    }

    matches.forEach(item => {
        const partNo = item["Part Code"] || item["Part code"] || "N/A";
        const desc = item["Description"] || "N/A";
        const uom = item["UOM"] || "EA";
        // Grab the Group Name from the CSV
        const groupName = item["Group Name"] || item["Group name"] || "N/A"; 

        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <div class="result-info"><strong>${partNo}</strong> - ${desc} <em>(${uom})</em></div>
            <button class="add-btn" onclick="addToCart('${partNo}', '${desc.replace(/'/g, "\\'")}', '${uom}', '${groupName.replace(/'/g, "\\'")}')"><i class="fa-solid fa-plus"></i> Add</button>
        `;
        searchResults.appendChild(div);
    });
});

// Added groupName parameter and a blank comment field
window.addToCart = function(partCode, description, unit, groupName) {
    if (cart.find(i => i.partNo === partCode)) { alert("Item is already in your list!"); return; }

    cart.push({ 
        partNo: partCode, 
        description: description, 
        unit: unit, 
        groupName: groupName, 
        comment: '', // Default empty comment
        qty: 1, 
        price: 0 
    });
    
    searchInput.value = ''; searchResults.innerHTML = '';
    renderCart();
};

function renderCart() {
    cartBody.innerHTML = ''; let grandTotal = 0;
    const printBtn = document.getElementById('printBtn');

    if (cart.length === 0) {
        cartBody.innerHTML = '<tr class="empty-row"><td colspan="8">No items added to the list yet.</td></tr>';
        printBtn.disabled = true; document.getElementById('grandTotalVal').textContent = "0.00"; return;
    }

    printBtn.disabled = false;
    cart.forEach((item, index) => {
        const total = item.qty * item.price; grandTotal += total;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <strong>${item.partNo}</strong><br>
                <em class="cart-group-name">${item.groupName}</em>
            </td>
            <td>
                ${item.description}<br>
                <input type="text" class="calc-input cart-comment-input" placeholder="Add a comment (optional)..." value="${item.comment}" data-index="${index}">
            </td>
            <td><input type="number" min="1" class="calc-input qty-input" value="${item.qty}" data-index="${index}" data-field="qty"></td>
            <td>${item.unit}</td>
            <td><input type="number" min="0" step="0.01" class="calc-input price-input" value="${item.price}" data-index="${index}" data-field="price"></td>
            <td class="row-total">${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td class="action-col"><button class="remove-btn" onclick="removeFromCart(${index})"><i class="fa-solid fa-trash"></i></button></td>
        `;
        cartBody.appendChild(tr);
    });

    document.getElementById('grandTotalVal').textContent = grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2});
    
    // Number Inputs (Update Math & Re-render table)
    document.querySelectorAll('.qty-input, .price-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-index');
            const field = e.target.getAttribute('data-field');
            cart[idx][field] = parseFloat(e.target.value) || 0;
            renderCart();
        });
    });

    // Text Inputs (Update Text ONLY, do NOT re-render so cursor stays in the box)
    document.querySelectorAll('.cart-comment-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-index');
            cart[idx].comment = e.target.value; 
        });
    });
}

window.removeFromCart = function(index) { cart.splice(index, 1); renderCart(); };




// ==========================================
// 3. MODAL (POP-UP) LOGIC
// ==========================================
const modal = document.getElementById('generatorModal');
const openBtn = document.getElementById('openGeneratorBtn');
const closeBtn = document.getElementById('closeModalBtn');

// Defensive check to make sure the HTML elements actually exist
if (openBtn && modal) {
    openBtn.addEventListener('click', (e) => {
        e.preventDefault(); 
        modal.classList.add('active'); 
    });
} else {
    console.error("ERROR: Could not find the openGeneratorBtn or generatorModal in your HTML.");
}

if (closeBtn && modal) {
    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('active'); 
    });
}

// ==========================================
// 4. ITEM GENERATOR LOGIC (INSIDE MODAL)
// ==========================================
const activitySelector = document.getElementById('activitySelector');
const saveBtn = document.getElementById('saveBtn');

activitySelector.addEventListener('change', async (e) => {
    currentGroupCode = e.target.value;
    if (!currentGroupCode) { saveBtn.disabled = true; saveBtn.textContent = "Select Group First"; return; }

    const data = dynamicActivityData[currentGroupCode];
    document.getElementById('dispGroup').value = `${currentGroupCode} - ${data.groupName}`;
    document.getElementById('dispClass').value = `${data.classCode} - ${data.className}`;
    document.getElementById('dispActivity').value = `${data.activityCode} - ${data.activityName}`;

    await calculateNextSeries(currentGroupCode);
});

async function calculateNextSeries(groupCode) {
    saveBtn.disabled = true; saveBtn.textContent = "Calculating...";
    let highestSeries = 100000; 

    try {
        // Check GitHub using EXACT capital 'Group Code'
        legacyItems.forEach(item => {
            if (item["Group Code"] === groupCode || item["Group code"] === groupCode) {
                const sNum = parseInt(item["Series"], 10);
                if (sNum > highestSeries) highestSeries = sNum;
            }
        });
        
        // Check Firebase using EXACT capital 'Group Code'
        const snap = await db.collection("items").where("Group Code", "==", groupCode).get();
        snap.forEach((doc) => {
            const sNum = parseInt(doc.data().Series, 10);
            if (sNum > highestSeries) highestSeries = sNum;
        });

        generatedSeries = (highestSeries + 1).toString();
        generatedPartCode = `${groupCode}.${generatedSeries}`;

        document.getElementById('previewPartCode').textContent = generatedPartCode;
        document.getElementById('previewSeries').textContent = `Series: ${generatedSeries}`;
        
        saveBtn.disabled = false; saveBtn.textContent = "Save Item & Add to Cart";
    } catch (err) { console.error(err); alert("Error calculating series."); }
}

document.getElementById('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentGroupCode || !generatedSeries) return;

    const data = dynamicActivityData[currentGroupCode];
    const itemDesc = document.getElementById('description').value;
    const itemUOM = document.getElementById('uom').value;
    
    // Save to Firebase using exact capital headers
    const newItemRecord = {
        "Part Code": generatedPartCode, 
        "Series": generatedSeries, 
        "Description": itemDesc, 
        "UOM": itemUOM,
        "Group Code": currentGroupCode, 
        "Group Name": data.groupName, 
        "Class Code": data.classCode, 
        "Class Name": data.className,
        "Activity Code": data.activityCode, 
        "Activity Name": data.activityName, 
        "CreatedAt": new Date().toISOString()
    };

    try {
        saveBtn.disabled = true; saveBtn.textContent = "Saving...";
        
        await db.collection("items").add(newItemRecord);
        allSearchableItems.push(newItemRecord);
        
        // Add to cart with the Group Name included so the UI doesn't break
        addToCart(generatedPartCode, itemDesc, itemUOM, data.groupName);

        document.getElementById('itemForm').reset();
        document.getElementById('previewPartCode').textContent = 'XXXXX.XXXXXX';
        document.getElementById('previewSeries').textContent = 'Series: ------';
        saveBtn.disabled = true; saveBtn.textContent = "Select Group First";
        
        modal.classList.remove('active'); 
        
    } catch (error) {
        console.error("Error adding document: ", error); alert("Failed to save to Firebase.");
        saveBtn.disabled = false; saveBtn.textContent = "Save Item & Add to Cart";
    }
});



// ==========================================
// 5. PRINT LOGIC
// ==========================================
document.getElementById('printBtn').addEventListener('click', () => {
    let html = `<thead><tr><th>SN</th><th>Part No</th><th>Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th></tr></thead><tbody>`;
    let grandTotal = 0;
    
    cart.forEach((item, i) => {
        const total = item.qty * item.price; grandTotal += total;
        
        // Build the comment block if one exists
        const commentHTML = item.comment ? `<br><em style="font-size: 10px; color: #64748b; font-style: italic;">Note: ${item.comment}</em>` : '';
        
        html += `
        <tr>
            <td>${i + 1}</td>
            <td>
                <strong>${item.partNo}</strong><br>
                <em style="font-size: 10px; color: #64748b;">${item.groupName}</em>
            </td>
            <td>
                ${item.description}
                ${commentHTML}
            </td>
            <td>${item.qty}</td>
            <td>${item.unit}</td>
            <td>${item.price.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td>${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
        </tr>`;
    });
    
    document.getElementById('printTable').innerHTML = html + `</tbody>`;
    document.getElementById('printGrandTotalVal').textContent = grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('printDate').textContent = "Generated: " + new Date().toLocaleString();
    window.print();
});