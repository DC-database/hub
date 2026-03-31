// GitHub Raw URLs
const PO_CSV_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
const ECOMMIT_CSV_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/ECommit.csv";

// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyAt0fLWcfgGAWV4yiu4mfhc3xQ5ycolgnU",
  authDomain: "payment-report-23bda.firebaseapp.com",
  projectId: "payment-report-23bda",
  storageBucket: "payment-report-23bda.appspot.com",
  messagingSenderId: "575646169000",
  appId: "1:575646169000:web:e7c4a9222ffe7753138f9d",
  measurementId: "G-X4WBLDGLHQ"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Cache Keys & Settings
const CACHE_PO_KEY = "invoice_app_po_data";
const CACHE_COMMIT_KEY = "invoice_app_commit_data";
const CACHE_TIME_KEY = "invoice_app_last_updated";
const CACHE_MS_KEY = "invoice_app_last_ms";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 Hours

let allInvoiceData = [];
let allCommitData = [];
let allFirebaseData = []; 
let commitSearchMap = {}; 
let commitsByPO = {}; 
let retentionByPO = {}; 
let isDataLoaded = false;
let currentFilteredData = [];

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const executeSearchBtn = document.getElementById("executeSearchBtn");
    const clearAllBtn = document.getElementById("clearAllBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    
    const printSummaryBtn = document.getElementById("printSummaryBtn");
    const printDetailedBtn = document.getElementById("printDetailedBtn");
    const printProjectBtn = document.getElementById("printProjectBtn"); 
    const printRetentionBtn = document.getElementById("printRetentionBtn"); 

    const filterSite = document.getElementById("filterSite");
    const filterMonth = document.getElementById("filterMonth");
    const filterYearFrom = document.getElementById("filterYearFrom"); 
    const filterYearTo = document.getElementById("filterYearTo");     
    const filterStatus = document.getElementById("filterStatus"); 
    const filterBalance = document.getElementById("filterBalance");
    const filterSrv = document.getElementById("filterSrv"); 
    const filterRetention = document.getElementById("filterRetention"); 

    initializeData();

    executeSearchBtn.addEventListener("click", () => { if (isDataLoaded) applyFilters(); });
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") { e.preventDefault(); if (isDataLoaded) applyFilters(); }
    });

    clearAllBtn.addEventListener("click", () => {
        searchInput.value = "";
        filterSite.value = ""; 
        filterMonth.value = ""; 
        filterYearFrom.value = ""; 
        filterYearTo.value = "";   
        filterStatus.value = ""; 
        filterBalance.value = ""; 
        filterSrv.value = ""; 
        filterRetention.value = ""; 
        resetToEmptyState();
        searchInput.focus();
    });

    refreshBtn.addEventListener("click", () => {
        const icon = refreshBtn.querySelector('i');
        icon.classList.add('fa-spin');
        document.getElementById("tableBody").innerHTML = `
            <div class="loading-state"><i class="fa-solid fa-cloud-arrow-down fa-bounce" style="font-size:24px; color:#00748C; margin-bottom:15px; display:block;"></i> Downloading fresh data...</div>
        `;
        fetchDataFromGitHub().then(() => {
            icon.classList.remove('fa-spin');
            resetToEmptyState(); 
        });
    });

    printSummaryBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { alert("No records currently visible to print. Please search first."); return; }
        generateSummaryPrintout();
    });

    printDetailedBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { alert("No records currently visible to print. Please search first."); return; }
        generateDetailedPrintout();
    });

    printProjectBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { alert("No records currently visible to print. Please search first."); return; }
        generateProjectPrintout();
    });

    printRetentionBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { alert("No records currently visible to print. Please search first."); return; }
        generateRetentionPrintout();
    });

    document.getElementById("tableBody").addEventListener("click", (e) => {
        const cardRow = e.target.closest('.master-grid-row');
        if (cardRow) {
            const invoiceCard = cardRow.closest('.invoice-card');
            invoiceCard.classList.toggle('expanded');
        }
    });
});

async function initializeData() {
    const cachedPO = localStorage.getItem(CACHE_PO_KEY);
    const cachedCommit = localStorage.getItem(CACHE_COMMIT_KEY);
    const lastUpdatedString = localStorage.getItem(CACHE_TIME_KEY);
    const lastUpdatedMs = localStorage.getItem(CACHE_MS_KEY);

    const isCacheValid = lastUpdatedMs && (Date.now() - parseInt(lastUpdatedMs)) < CACHE_EXPIRY_MS;

    if (cachedPO && cachedCommit && isCacheValid) {
        allInvoiceData = JSON.parse(cachedPO);
        allCommitData = JSON.parse(cachedCommit);
        await fetchFirebaseRetentionData(); 
        setupDataDependents();
        isDataLoaded = true;
        updateUIReadyState(lastUpdatedString);
        resetToEmptyState();
    } else {
        await fetchDataFromGitHub();
        resetToEmptyState();
    }
}

async function fetchFirebaseRetentionData() {
    retentionByPO = {};
    allFirebaseData = []; 
    try {
        const snapshot = await database.ref('payments').once('value'); 
        const data = snapshot.val();
        
        if (data) {
            Object.values(data).forEach(record => {
                allFirebaseData.push(record); 
                
                const poNo = (record.poNo || record.poNumber || "").toString().trim();
                if (poNo) {
                    const retVal = parseFloat(record.retention) || 0;
                    if (!retentionByPO[poNo]) retentionByPO[poNo] = 0;
                    retentionByPO[poNo] += retVal; 
                }
            });
        }
    } catch (error) {
        console.error("Failed to fetch Firebase Retention Data:", error);
    }
}

async function fetchDataFromGitHub() {
    try {
        const cacheBuster = "?v=" + new Date().getTime();
        const [poResponse, commitResponse] = await Promise.all([
            fetch(PO_CSV_URL + cacheBuster), fetch(ECOMMIT_CSV_URL + cacheBuster)
        ]);
        if (!poResponse.ok || !commitResponse.ok) throw new Error("Failed to download from GitHub. (You may be rate-limited).");
        
        const poCsvText = await poResponse.text();
        const commitCsvText = await commitResponse.text();
        allInvoiceData = parseCSV(poCsvText);
        allCommitData = parseCSV(commitCsvText);
        
        try {
            localStorage.setItem(CACHE_PO_KEY, JSON.stringify(allInvoiceData));
            localStorage.setItem(CACHE_COMMIT_KEY, JSON.stringify(allCommitData));
            const now = new Date();
            localStorage.setItem(CACHE_TIME_KEY, now.toLocaleString());
            localStorage.setItem(CACHE_MS_KEY, now.getTime().toString());
            updateUIReadyState(now.toLocaleString());
        } catch (e) {}

        await fetchFirebaseRetentionData(); 
        setupDataDependents();
        isDataLoaded = true;
    } catch (error) {
        document.getElementById("tableBody").innerHTML = `<div class="error-state"><i class="fa-solid fa-triangle-exclamation" style="font-size:24px; margin-bottom:10px; display:block;"></i> Error: ${error.message}</div>`;
    }
}

function setupDataDependents() {
    commitSearchMap = {};
    commitsByPO = {};
    const sites = new Set();
    const years = new Set();

    allCommitData.forEach(commit => {
        const po = commit['PO Number'] || commit['PO'] || commit['ReqNum'];
        if (!po || po === 'N/A') return;
        
        const ps = commit['Packing Slip'] || "";
        
        let cost = 0;
        if (commit['Extended Cost'] && commit['Extended Cost'] !== '-') {
            const parsed = parseFloat(String(commit['Extended Cost']).replace(/,/g, ''));
            if (!isNaN(parsed)) cost = parsed;
        }
        commit._rawCost = cost;
        
        if (!commitSearchMap[po]) commitSearchMap[po] = "";
        commitSearchMap[po] += ` ${ps} ${commit['Extended Cost']} `;

        if (!commitsByPO[po]) commitsByPO[po] = [];
        commitsByPO[po].push(commit);
    });

    Object.keys(commitsByPO).forEach(po => {
        commitsByPO[po].sort((a, b) => new Date(a['Date']) - new Date(b['Date']));
    });

    allInvoiceData.forEach(row => {
        const site = row['Project ID'] || row['Site'];
        if (site && site.trim() !== "") sites.add(site.trim());
        
        const dateRaw = row['Order Date'] || row['Date'];
        row._month = "";
        row._year = "";
        if (dateRaw) {
            const dateObj = new Date(dateRaw);
            if (!isNaN(dateObj)) {
                row._month = dateObj.getMonth().toString();
                row._year = dateObj.getFullYear().toString();
                years.add(row._year);
            }
        }

        let amt = 0;
        if (row['Amount']) {
            const parsed = parseFloat(String(row['Amount']).replace(/,/g, ''));
            if (!isNaN(parsed)) amt = parsed;
        }
        row._rawAmount = amt;
        row._cleanPO = row['PO Number'] || row['PO'] || row['ReqNum'] || 'N/A';
    });

    const siteSelect = document.getElementById("filterSite");
    siteSelect.innerHTML = '<option value="">All Sites</option>';
    Array.from(sites).sort().forEach(site => { siteSelect.innerHTML += `<option value="${site}">${site}</option>`; });

    const yearFromSelect = document.getElementById("filterYearFrom");
    const yearToSelect = document.getElementById("filterYearTo");
    yearFromSelect.innerHTML = '<option value="">Any</option>';
    yearToSelect.innerHTML = '<option value="">Any</option>';
    
    const sortedYears = Array.from(years).sort((a,b) => a - b);
    sortedYears.forEach(year => { 
        yearFromSelect.innerHTML += `<option value="${year}">${year}</option>`; 
        yearToSelect.innerHTML += `<option value="${year}">${year}</option>`; 
    });

    document.getElementById("filtersRow").classList.remove("hidden");
}

function updateUIReadyState(timeString) {
    document.getElementById("loadingSpinner")?.classList.add("hidden");
    document.getElementById("recordCount").textContent = `System ready. Loaded ${allInvoiceData.length} records.`;
    if(timeString) document.getElementById("lastUpdated").textContent = `Last synced: ${timeString}`;
}

function parseCSV(csvText) {
    const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        let row = []; let inQuote = false; let val = '';
        for (let char of lines[i]) {
            if (char === '"') inQuote = !inQuote;
            else if (char === ',' && !inQuote) { row.push(val.trim()); val = ''; }
            else val += char;
        }
        row.push(val.trim());
        row = row.map(v => v.replace(/^"|"$/g, '').trim());
        let entry = {};
        headers.forEach((h, index) => { entry[h] = row[index] || ''; });
        data.push(entry);
    }
    return data;
}

function resetToEmptyState() {
    currentFilteredData = [];
    const tbody = document.getElementById("tableBody");
    const countDisplay = document.getElementById("recordCount");
    tbody.innerHTML = `<div class="empty-state"><i class="fa-solid fa-list-check" style="font-size: 30px; color: #cbd5e1; margin-bottom: 15px; display: block;"></i>Ready. Enter your criteria and click <strong>Search</strong>.</div>`;
    countDisplay.textContent = `Awaiting search...`;
}

function applyFilters() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const selectedSite = document.getElementById("filterSite").value;
    const selectedMonth = document.getElementById("filterMonth").value;
    const selectedYearFrom = document.getElementById("filterYearFrom").value; 
    const selectedYearTo = document.getElementById("filterYearTo").value;     
    const selectedStatus = document.getElementById("filterStatus").value; 
    const selectedBalance = document.getElementById("filterBalance").value; 
    const selectedSrv = document.getElementById("filterSrv").value; 
    const selectedRetention = document.getElementById("filterRetention").value; 

    const filtered = allInvoiceData.filter(row => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || '';

        // Site & Date Filters
        if (selectedSite && site.trim() !== selectedSite) return false;
        if (selectedMonth !== "" && row._month !== selectedMonth) return false;
        if (selectedYearFrom !== "" && (!row._year || parseInt(row._year) < parseInt(selectedYearFrom))) return false;
        if (selectedYearTo !== "" && (!row._year || parseInt(row._year) > parseInt(selectedYearTo))) return false;

        // Status Filter
        const openColumnVal = (row['Open'] || '').toString().toLowerCase().trim();
        const isClosed = (openColumnVal === 'false');
        if (selectedStatus === 'open' && isClosed) return false;
        if (selectedStatus === 'closed' && !isClosed) return false;

        // Balance & SRV & Retention Filter Math
        if (selectedBalance !== "" || selectedSrv !== "" || selectedRetention !== "") {
            let poSrvAmt = 0;
            const relatedCommits = commitsByPO[poNumber] || [];
            relatedCommits.forEach(commit => { poSrvAmt += commit._rawCost; });
            
            if (selectedSrv !== "") {
                const hasSrvValue = poSrvAmt > 0.001;
                if (selectedSrv === 'has_srv' && !hasSrvValue) return false; 
                if (selectedSrv === 'no_srv' && hasSrvValue) return false;
            }

            if (selectedBalance !== "") {
                const invAmt = row._rawAmount;
                const rowBalance = invAmt - poSrvAmt;
                const isZeroBalance = Math.abs(rowBalance) < 0.01;

                if (selectedBalance === 'zero' && !isZeroBalance) return false; 
                if (selectedBalance === 'value' && isZeroBalance) return false; 
            }

            if (selectedRetention !== "") {
                const poRetAmt = retentionByPO[poNumber] || 0;
                const hasRetention = poRetAmt > 0.01;
                if (selectedRetention === 'value' && !hasRetention) return false;
                if (selectedRetention === 'zero' && hasRetention) return false;
            }
        }

        // Search Box Text Filter
        if (query) {
            const commitDataStr = commitSearchMap[poNumber] || "";
            const searchableText = `${poNumber} ${site} ${row['Supplier Name'] || row['Supplier'] || ''} ${row['Order Date'] || row['Date'] || ''} ${commitDataStr}`.toLowerCase();
            if (!searchableText.includes(query)) return false;
        }
        
        return true;
    });
    
    currentFilteredData = filtered;
    renderGrid(filtered);
}

function renderGrid(dataToRender) {
    const tbody = document.getElementById("tableBody");
    const countDisplay = document.getElementById("recordCount");
    tbody.innerHTML = '';
    
    if (dataToRender.length === 0) {
        countDisplay.textContent = `Found 0 matching records`;
        tbody.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass" style="font-size: 30px; color: #cbd5e1; margin-bottom: 15px; display: block;"></i>No matching records found based on your search.</div>`;
        return;
    }

    countDisplay.textContent = `Found ${dataToRender.length} matching records`;
    
    let gridHTML = '';
    let grandTotalInvoice = 0;
    let grandTotalSrv = 0;

    dataToRender.forEach((row) => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || 'N/A';
        const vendor = row['Supplier Name'] || row['Supplier'] || 'N/A';
        const orderDate = row['Order Date'] || row['Date'] || 'N/A';
        
        let mainStatus = row['Status'] || 'Verified';
        const openColumnVal = (row['Open'] || '').toString().toLowerCase().trim();
        if (openColumnVal === 'false') {
            mainStatus = 'Closed';
        }

        const invAmt = row._rawAmount;
        grandTotalInvoice += invAmt;

        const verifiedClass = mainStatus.toLowerCase() === 'verified' ? 'verified' : (mainStatus.toLowerCase() === 'closed' ? 'closed-badge' : '');

        let masterHTML = `
            <div class="invoice-card">
                <div class="master-grid-row">
                    <div class="grid-cell"><div class="expand-btn" title="View Details"><i class="fa-solid fa-chevron-right"></i></div></div>
                    <div class="grid-cell" style="color:#00748C;"><i class="fa-solid fa-file-invoice" style="margin-right:5px;"></i> Invoice</div>
                    <div class="grid-cell"><strong>${poNumber}</strong></div>
                    <div class="grid-cell" title="${site}">${site}</div>
                    <div class="grid-cell" title="${vendor}">${vendor}</div>
                    <div class="grid-cell"><strong>QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                    <div class="grid-cell">${orderDate}</div>
                    <div class="grid-cell"><span class="status-badge ${verifiedClass}">${mainStatus}</span></div>
                </div>
        `;

        const relatedCommits = commitsByPO[poNumber] || [];
        let subTableHTML = '';
        let poSrvAmt = 0;

        if (relatedCommits.length > 0) {
            const theadHTML = `<th>Inv.Entry</th><th>Packing Slip</th><th>SRV Date</th><th>SRV Value</th><th>REMARKS</th>`;
            
            let tbodyHTML = relatedCommits.map((commit, i) => {
                const invEntry = `Inv-${String(i + 1).padStart(2, '0')}`;
                const packingSlip = commit['Packing Slip'] || '-';
                const srvDate = commit['Date'] || '-';
                const srvVal = commit._rawCost;
                
                poSrvAmt += srvVal;
                const srvValueFormatted = srvVal.toLocaleString('en-US', {minimumFractionDigits: 2});
                const epicorStatus = `<span class="epicor-badge">Epicor Record</span>`;
                
                return `<tr><td><strong>${invEntry}</strong></td><td>${packingSlip}</td><td>${srvDate}</td><td>${srvValueFormatted}</td><td>${epicorStatus}</td></tr>`;
            }).join('');

            let rowBalance = invAmt - poSrvAmt;
            grandTotalSrv += poSrvAmt;

            subTableHTML = `
                <div class="detail-grid-row">
                    <div class="sub-table-header"><i class="fa-solid fa-list-check"></i> Service Receipts (SRV)</div>
                    <div class="sub-table-wrapper">
                        <table class="sub-table">
                            <thead><tr>${theadHTML}</tr></thead>
                            <tbody>${tbodyHTML}</tbody>
                        </table>
                        <div class="sub-table-footer">
                            <div class="sub-stat"><span>PO Value:</span> <strong>QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            <div class="sub-stat"><span>Total SRV:</span> <strong>QAR ${poSrvAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            <div class="sub-stat highlight"><span>Outstanding Balance:</span> <strong>QAR ${rowBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                        </div>
                    </div>
                </div>
            </div>`;
        } else {
            subTableHTML = `
                <div class="detail-grid-row">
                    <div class="sub-table-header"><i class="fa-solid fa-list-check"></i> Service Receipts (SRV)</div>
                    <div class="sub-table-wrapper">
                        <div class="no-commits-msg"><i class="fa-solid fa-circle-info"></i> No Epicor records found for this PO.</div>
                        <div class="sub-table-footer">
                            <div class="sub-stat"><span>PO Value:</span> <strong>QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                            <div class="sub-stat"><span>Total SRV:</span> <strong>QAR 0.00</strong></div>
                            <div class="sub-stat highlight"><span>Outstanding Balance:</span> <strong>QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        gridHTML += (masterHTML + subTableHTML);
    });
    
    let grandBalance = grandTotalInvoice - grandTotalSrv;
    const summaryCardHTML = `
        <div class="grand-summary-card">
            <div class="grand-summary-title"><i class="fa-solid fa-calculator"></i><div>Search Results Summary</div></div>
            <div class="grand-summary-stats">
                <div class="g-stat"><span>Total PO Value</span><strong>QAR ${grandTotalInvoice.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                <div class="g-stat"><span>Total SRV</span><strong>QAR ${grandTotalSrv.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
                <div class="g-stat highlight"><span>Total Outstanding Balance</span><strong>QAR ${grandBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong></div>
            </div>
        </div>
    `;

    tbody.innerHTML = gridHTML + summaryCardHTML;
}

function getActiveFiltersHtml() {
    const site = document.getElementById("filterSite").value;
    const monthIdx = document.getElementById("filterMonth").value;
    const yearFrom = document.getElementById("filterYearFrom").value; 
    const yearTo = document.getElementById("filterYearTo").value;     
    const status = document.getElementById("filterStatus").value; 
    const balance = document.getElementById("filterBalance").value; 
    const srv = document.getElementById("filterSrv").value; 
    const retention = document.getElementById("filterRetention").value; 
    const query = document.getElementById("searchInput").value.trim();

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    let activeFilters = [];
    if (query) activeFilters.push(`Search: "${query}"`);
    if (site) activeFilters.push(`Site: ${site}`);
    if (monthIdx !== "") activeFilters.push(`Month: ${months[parseInt(monthIdx)]}`);
    
    if (yearFrom && yearTo) {
        if (yearFrom === yearTo) activeFilters.push(`Year: ${yearFrom}`);
        else activeFilters.push(`Years: ${yearFrom} &ndash; ${yearTo}`);
    } else if (yearFrom) {
        activeFilters.push(`Years: ${yearFrom} onwards`);
    } else if (yearTo) {
        activeFilters.push(`Years: up to ${yearTo}`);
    }

    if (status === "open") activeFilters.push(`Status: Open POs`); 
    if (status === "closed") activeFilters.push(`Status: Closed POs`); 
    
    if (balance === "value") activeFilters.push(`BALANCE: HAS VALUE`);
    if (balance === "zero") activeFilters.push(`BALANCE: ZERO`);

    if (srv === "has_srv") activeFilters.push(`SRV: HAS VALUE`);
    if (srv === "no_srv") activeFilters.push(`SRV: NO RECORD`);

    if (retention === "value") activeFilters.push(`RETENTION: HAS VALUE`);
    if (retention === "zero") activeFilters.push(`RETENTION: ZERO`);

    if (activeFilters.length > 0) {
        return `<p class="print-filters">FILTERED BY &rarr; &nbsp; ${activeFilters.join(' &nbsp;|&nbsp; ')}</p>`;
    }
    return '';
}

// ---------------------------------------------------------
// PRINT FUNCTIONS
// ---------------------------------------------------------

function generateSummaryPrintout() {
    let totalInvoiceAmount = 0; let totalSrvAmount = 0; let rowsHtml = '';
    currentFilteredData.forEach(row => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || 'N/A';
        const vendor = row['Supplier Name'] || row['Supplier'] || 'N/A';
        const orderDate = row['Order Date'] || row['Date'] || 'N/A';

        const invAmt = row._rawAmount;
        totalInvoiceAmount += invAmt;

        let poSrvAmt = 0;
        const relatedCommits = commitsByPO[poNumber] || [];
        relatedCommits.forEach(commit => { poSrvAmt += commit._rawCost; });
        totalSrvAmount += poSrvAmt;

        let rowBalance = invAmt - poSrvAmt;
        rowsHtml += `<tr><td><strong>${poNumber}</strong></td><td>${site}</td><td>${vendor}</td><td>${orderDate}</td><td class="num">${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td><td class="num">${poSrvAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td><td class="num" style="font-weight:bold; color:#ef4444;">${rowBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>`;
    });

    let totalBalance = totalInvoiceAmount - totalSrvAmount;
    const printHtml = `
        <div class="print-header">
            <h2>Summary Report: POs & SRVs</h2>
            <p>Generated on: ${new Date().toLocaleString()} &nbsp; | &nbsp; Records: ${currentFilteredData.length}</p>
            ${getActiveFiltersHtml()}
        </div>
        <table class="print-table">
            <thead><tr><th>Ref / PO</th><th>Site</th><th>Vendor Name</th><th>Order Date</th><th class="num">PO Value (QAR)</th><th class="num">SRV Total (QAR)</th><th class="num">Outstanding Balance (QAR)</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr><td>Grand Total PO Value</td><td>QAR ${totalInvoiceAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td>Grand Total SRV</td><td>QAR ${totalSrvAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr class="balance-row"><td>TOTAL OUTSTANDING BALANCE</td><td>QAR ${totalBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
            </table>
        </div>
    `;
    document.getElementById("printArea").innerHTML = printHtml;
    window.print();
}

function generateDetailedPrintout() {
    let totalInvoiceAmount = 0; let totalSrvAmount = 0; let htmlContent = '';
    currentFilteredData.forEach(row => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || 'N/A';
        const vendor = row['Supplier Name'] || row['Supplier'] || 'N/A';
        const orderDate = row['Order Date'] || row['Date'] || 'N/A';

        const invAmt = row._rawAmount;
        totalInvoiceAmount += invAmt;

        let poSrvAmt = 0;
        const relatedCommits = commitsByPO[poNumber] || [];

        let srvRowsHtml = '';
        if (relatedCommits.length > 0) {
            srvRowsHtml += `<table class="print-sub-table"><thead><tr><th>Inv.Entry</th><th>Packing Slip</th><th>SRV Date</th><th class="num">SRV Value (QAR)</th></tr></thead><tbody>`;
            relatedCommits.forEach((commit, i) => {
                const invEntry = `Inv-${String(i + 1).padStart(2, '0')}`;
                const packingSlip = commit['Packing Slip'] || '-';
                const srvDate = commit['Date'] || '-';
                const srvVal = commit._rawCost;
                
                poSrvAmt += srvVal; 
                totalSrvAmount += srvVal;
                srvRowsHtml += `<tr><td><strong>${invEntry}</strong></td><td>${packingSlip}</td><td>${srvDate}</td><td class="num">${srvVal.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>`;
            });
            srvRowsHtml += `</tbody></table>`;
        } else {
            srvRowsHtml = `<div class="print-no-srv">No Service Receipts (SRV) mapped to this record.</div>`;
        }

        let rowBalance = invAmt - poSrvAmt;
        
        htmlContent += `
            <div class="print-detailed-po-block">
                <div class="print-po-header">
                    <div class="po-title">PO: ${poNumber} <span>| Site: ${site} | Vendor: ${vendor} | Date: ${orderDate}</span></div>
                    <div class="po-inv-amt">PO Value: QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                ${srvRowsHtml}
                <div class="print-po-footer">
                    <div>Total SRV: QAR ${poSrvAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                    <div class="highlight" style="color:#ef4444;">Outstanding Balance: QAR ${rowBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
            </div>
        `;
    });

    let totalBalance = totalInvoiceAmount - totalSrvAmount;
    const printHtml = `
        <div class="print-header">
            <h2>Detailed Report: POs & SRVs</h2>
            <p>Generated on: ${new Date().toLocaleString()} &nbsp; | &nbsp; Records: ${currentFilteredData.length}</p>
            ${getActiveFiltersHtml()}
        </div>
        <div>${htmlContent}</div>
        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr><td>Grand Total PO Value</td><td>QAR ${totalInvoiceAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td>Grand Total SRV</td><td>QAR ${totalSrvAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr class="balance-row"><td>TOTAL OUTSTANDING BALANCE</td><td>QAR ${totalBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
            </table>
        </div>
    `;
    document.getElementById("printArea").innerHTML = printHtml;
    window.print();
}

function generateProjectPrintout() {
    let projectTotals = {};
    let grandTotalInvoice = 0;
    let grandTotalSrv = 0;
    let grandTotalRetention = 0;
    let validRecordsCount = 0;

    currentFilteredData.forEach(row => {
        const openColumnVal = (row['Open'] || '').toString().toLowerCase().trim();
        const isClosed = openColumnVal === 'false';
        
        if (isClosed) return;

        validRecordsCount++; 

        const site = row['Project ID'] || row['Site'] || 'Unassigned Site';
        const poNumber = row._cleanPO;
        const invAmt = row._rawAmount;

        let poSrvAmt = 0;
        const relatedCommits = commitsByPO[poNumber] || [];
        relatedCommits.forEach(commit => { poSrvAmt += commit._rawCost; });

        const poRetention = retentionByPO[poNumber] || 0;

        if (!projectTotals[site]) {
            projectTotals[site] = { poValue: 0, srvTotal: 0, retentionTotal: 0, poCount: 0 };
        }

        projectTotals[site].poValue += invAmt;
        projectTotals[site].srvTotal += poSrvAmt;
        projectTotals[site].retentionTotal += poRetention;
        projectTotals[site].poCount += 1;

        grandTotalInvoice += invAmt;
        grandTotalSrv += poSrvAmt;
        grandTotalRetention += poRetention;
    });

    let rowsHtml = '';
    const sortedSites = Object.keys(projectTotals).sort();

    sortedSites.forEach(site => {
        const data = projectTotals[site];
        const sitePayable = data.srvTotal - data.retentionTotal;
        const siteOutstanding = data.poValue - data.srvTotal;
        
        rowsHtml += `
            <tr>
                <td><strong>${site}</strong></td>
                <td class="num" style="text-align:center;">${data.poCount}</td>
                <td class="num">${data.poValue.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num">${data.srvTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="color:#ea580c;">${data.retentionTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="font-weight:bold; color:#0369a1;">${sitePayable.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="font-weight:bold; color:#ef4444;">${siteOutstanding.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    });

    let grandPayable = grandTotalSrv - grandTotalRetention;
    let grandBalance = grandTotalInvoice - grandTotalSrv;
    
    if (validRecordsCount === 0) {
        alert("There are no valid Open records based on your current filters to display for the Project Report.");
        return;
    }
    
    const printHtml = `
        <div class="print-header">
            <h2>Project Closeout Summary <span style="font-size:12px; color:#ef4444; font-style:italic; font-weight:bold;">(Excludes Closed POs)</span></h2>
            <p>Generated on: ${new Date().toLocaleString()} &nbsp; | &nbsp; Sites/Projects: ${sortedSites.length}</p>
            ${getActiveFiltersHtml()}
        </div>
        <table class="print-project-table">
            <thead>
                <tr>
                    <th>Site / Project ID</th>
                    <th style="text-align:center;">Open POs</th>
                    <th class="num">Total PO Value</th>
                    <th class="num">Total SRV</th>
                    <th class="num" style="color:#ea580c;">Retention</th>
                    <th class="num" style="color:#0369a1;">Net Payable</th>
                    <th class="num">Outstanding Balance</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr><td>Grand Total PO Value</td><td>QAR ${grandTotalInvoice.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td>Grand Total SRV</td><td>QAR ${grandTotalSrv.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td style="color:#ea580c;">Grand Total Retention</td><td style="color:#ea580c;">QAR ${grandTotalRetention.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td style="color:#0369a1; font-weight:800;">TOTAL NET PAYABLE</td><td style="color:#0369a1; font-weight:800;">QAR ${grandPayable.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr class="balance-row"><td>TOTAL OUTSTANDING BALANCE</td><td>QAR ${grandBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
            </table>
        </div>
    `;
    
    document.getElementById("printArea").innerHTML = printHtml;
    window.print();
}

// ---------------------------------------------------------
// NEW FIREBASE INDIVIDUAL RETENTION REPORT (DETACHED SUMMARY)
// ---------------------------------------------------------
function generateRetentionPrintout() {
    let htmlContent = '';
    let validRecordsCount = 0;

    currentFilteredData.forEach(row => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || 'N/A';
        const vendor = row['Supplier Name'] || row['Supplier'] || 'N/A';
        const invAmt = row._rawAmount;

        const fbRecords = allFirebaseData.filter(r => {
            return (r.poNo || r.poNumber || "").toString().trim() === poNumber;
        });

        if (fbRecords.length === 0) return; 

        validRecordsCount++;
        
        let poTotalCertified = 0;
        let poTotalPayment = 0;
        let poTotalRetention = 0; 
        
        let rowsHtml = `<table class="print-sub-table">
            <thead>
                <tr>
                    <th>Payment No</th>
                    <th>Date Paid</th>
                    <th>Cheque No</th>
                    <th class="num">Certified Amount (QAR)</th>
                    <th class="num" style="color:#ea580c;">Retention (QAR)</th>
                    <th class="num">Payment (QAR)</th>
                </tr>
            </thead>
            <tbody>`;
        
        fbRecords.forEach(rec => {
            const payNo = rec.paymentNo || '-';
            const dPaid = rec.datePaid || '-';
            const chq = rec.chequeNo || '-';
            const certAmt = parseFloat(rec.certifiedAmount || 0);
            const payAmt = parseFloat(rec.payment || 0);
            const retAmt = parseFloat(rec.retention || 0); 
            
            poTotalCertified += certAmt;
            poTotalPayment += payAmt;
            poTotalRetention += retAmt;
            
            rowsHtml += `<tr>
                <td><strong>${payNo}</strong></td>
                <td>${dPaid}</td>
                <td>${chq}</td>
                <td class="num">${certAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="color:#ea580c; font-weight:bold;">${retAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num">${payAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>`;
        });
        
        // Sum Row at the bottom of the table
        rowsHtml += `<tr style="background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <td colspan="3" style="text-align: right; font-weight: 800; font-size: 10px; color: #0f172a;">TOTALS:</td>
            <td class="num" style="font-weight: 800; font-size: 11px; color: #0f172a;">${poTotalCertified.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td class="num" style="color:#ea580c; font-weight: 800; font-size: 11px;">${poTotalRetention.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td class="num" style="font-weight: 800; font-size: 11px; color: #0f172a;">${poTotalPayment.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
        </tr>`;
        
        rowsHtml += `</tbody></table>`;

        // Exact Math requested
        let poCommittedCost = invAmt - poTotalCertified;
        let poRetentionToDate = poTotalCertified - poTotalPayment;

        // Structured 5-Point Summary Card (Completely detached from the table)
        let summaryCardHtml = `
            <div style="border: 3px solid #003A5C !important; border-radius: 8px; display: flex; background-color: #fff; overflow: hidden; page-break-inside: avoid; align-items: center;">
                <div style="flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1;">
                    <div style="color: #475569; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">PO Value</div>
                    <div style="font-weight: 900; font-size: 13px; color: #0f172a;">QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div style="flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1;">
                    <div style="color: #475569; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Total Certified Cost</div>
                    <div style="font-weight: 900; font-size: 13px; color: #0f172a;">QAR ${poTotalCertified.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div style="flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1;">
                    <div style="color: #475569; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Total Prev. Payment</div>
                    <div style="font-weight: 900; font-size: 13px; color: #0f172a;">QAR ${poTotalPayment.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div style="flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1;">
                    <div style="color: #475569; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Total Committed Cost</div>
                    <div style="font-weight: 900; font-size: 13px; color: #0369a1;">QAR ${poCommittedCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div style="flex: 1; padding: 10px 12px;">
                    <div style="color: #475569; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Total Retention To Date</div>
                    <div style="font-weight: 900; font-size: 13px; color: #ea580c;">QAR ${poRetentionToDate.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
            </div>
        `;

        htmlContent += `
            <div class="print-detailed-po-block" style="margin-bottom: 12px;">
                <div class="print-po-header">
                    <div class="po-title">PO: ${poNumber} <span>| Site: ${site} | Vendor: ${vendor}</span></div>
                </div>
                ${rowsHtml}
            </div>
            ${summaryCardHtml}
            <div style="height: 30px;"></div> `;
    });

    if (validRecordsCount === 0) {
        alert("There are no Firebase Payment/Retention records found for the POs in your current search results.");
        return;
    }

    const printHtml = `
        <div class="print-header">
            <h2>Detailed Retention Report</h2>
            <p>Generated on: ${new Date().toLocaleString()} &nbsp; | &nbsp; POs with Records: ${validRecordsCount}</p>
            ${getActiveFiltersHtml()}
        </div>
        <div>${htmlContent}</div>
    `;
    
    document.getElementById("printArea").innerHTML = printHtml;
    window.print();
}