// GitHub Raw URLs
const PO_CSV_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
const ECOMMIT_CSV_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/ECommit2.csv"; 
const SITE_CSV_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/Site.csv";

// DATE FORMATTER: DD-MMM-YYYY
function formatToDDMMMYYYY(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === 'N/A') return dateStr || '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()]; 
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// SOUNDS
const soundClick = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Click.mp3');
const soundClear = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Clear.mp3');
const soundDelete = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Delete.mp3'); 
const soundConfirm = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Confirm.mp3'); 
const soundSuccess = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Success.mp3');
const soundError = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Error.mp3');
const soundPop = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Pop.mp3');
const soundSent = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Sent.mp3');

soundClick.volume   = 0.3;  
soundPop.volume     = 0.2;  
soundClear.volume   = 0.4;
soundDelete.volume  = 0.5;
soundError.volume   = 0.4;
soundSuccess.volume = 0.5;
soundConfirm.volume = 0.6;  
soundSent.volume    = 0.5;

function playAudio(audioObj) {
    if (audioObj) {
        audioObj.currentTime = 0; 
        audioObj.play().catch(e => console.log("Audio play prevented by browser:", e));
    }
}

// ==========================================
// FIREBASE CONFIG 1: RETENTION (PAYMENTS)
// ==========================================
const firebaseConfig1 = {
  apiKey: "AIzaSyAt0fLWcfgGAWV4yiu4mfhc3xQ5ycolgnU",
  authDomain: "payment-report-23bda.firebaseapp.com",
  projectId: "payment-report-23bda",
  storageBucket: "payment-report-23bda.appspot.com",
  messagingSenderId: "575646169000",
  appId: "1:575646169000:web:e7c4a9222ffe7753138f9d",
  measurementId: "G-X4WBLDGLHQ"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig1);
}
const dbRetention = firebase.database();

// ==========================================
// FIREBASE CONFIG 2: FALLBACK SRV (INVOICES)
// ==========================================
const firebaseConfig2 = {
  apiKey: "AIzaSyB5_CCTk-dvr_Lsv0K2ScPwHJkkCY7VoAM",
  authDomain: "invoiceentry-b15a8.firebaseapp.com",
  databaseURL: "https://invoiceentry-b15a8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "invoiceentry-b15a8",
  storageBucket: "invoiceentry-b15a8.firebasestorage.app",
  messagingSenderId: "916998429537",
  appId: "1:916998429537:web:6f4635d6d6e1cb98bb0320",
  measurementId: "G-R409J22B97"
};
const fallbackApp = firebase.initializeApp(firebaseConfig2, "FallbackApp");
const dbFallback = fallbackApp.database();

// Cache Keys & Settings
const CACHE_PO_KEY = "invoice_app_po_data";
const CACHE_COMMIT_KEY = "invoice_app_commit_data";
const CACHE_SITE_KEY = "invoice_app_site_data"; 
const CACHE_FB_RETENTION = "invoice_app_fb_retention";
const CACHE_FB_FALLBACK = "invoice_app_fb_fallback";
const CACHE_FB_RAW = "invoice_app_fb_raw";

const CACHE_TIME_KEY = "invoice_app_last_updated";
const CACHE_MS_KEY = "invoice_app_last_ms";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

let allInvoiceData = [];
let allCommitData = [];
let allSiteData = []; 
let allFirebaseData = []; 
let commitsByPO = {}; 
let fallbackSrvByPO = {}; 
let retentionByPO = {}; 
let siteNameMap = {}; 
let isDataLoaded = false;
let currentFilteredData = [];
let years = new Set();

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const executeSearchBtn = document.getElementById("executeSearchBtn");
    const clearAllBtn = document.getElementById("clearAllBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    
    const exportExcelBtn = document.getElementById("exportExcelBtn");
    const printSummaryBtn = document.getElementById("printSummaryBtn");
    const printDetailedBtn = document.getElementById("printDetailedBtn");
    const printProjectBtn = document.getElementById("printProjectBtn"); 
    const printRetentionBtn = document.getElementById("printRetentionBtn"); 

    const filterMonth = document.getElementById("filterMonth");
    const filterYearFrom = document.getElementById("filterYearFrom"); 
    const filterYearTo = document.getElementById("filterYearTo");     
    const filterStatus = document.getElementById("filterStatus"); 
    const filterBalance = document.getElementById("filterBalance");
    const filterMinBalance = document.getElementById("filterMinBalance"); 
    const filterSrv = document.getElementById("filterSrv"); 
    const filterRetention = document.getElementById("filterRetention"); 
    const filterInvoiced = document.getElementById("filterInvoiced");

    const siteSelectBtn = document.getElementById("siteSelectBtn");
    const siteDropdown = document.getElementById("siteDropdown");
    const siteSearchInput = document.getElementById("siteSearchInput");
    const selectAllSitesBtn = document.getElementById("selectAllSitesBtn");
    const clearAllSitesBtn = document.getElementById("clearAllSitesBtn");
    const siteCheckboxList = document.getElementById("siteCheckboxList");

    if (siteSelectBtn) {
        siteSelectBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            siteDropdown.classList.toggle("hidden");
        });

        document.addEventListener("click", (e) => {
            if (!siteDropdown.contains(e.target) && !siteSelectBtn.contains(e.target)) {
                siteDropdown.classList.add("hidden");
            }
        });

        siteSearchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const labels = siteCheckboxList.querySelectorAll(".checkbox-item");
            labels.forEach(label => {
                const text = label.innerText.toLowerCase();
                label.style.display = text.includes(term) ? "flex" : "none";
            });
        });

        selectAllSitesBtn.addEventListener("click", () => {
            siteCheckboxList.querySelectorAll(".site-checkbox").forEach(cb => cb.checked = true);
            updateSiteButtonLabel();
        });

        clearAllSitesBtn.addEventListener("click", () => {
            siteCheckboxList.querySelectorAll(".site-checkbox").forEach(cb => cb.checked = false);
            updateSiteButtonLabel();
        });

        siteCheckboxList.addEventListener("change", () => {
            updateSiteButtonLabel();
        });
    }

    window.updateSiteButtonLabel = function() {
        const checkboxes = document.querySelectorAll(".site-checkbox");
        const checked = document.querySelectorAll(".site-checkbox:checked");
        const label = document.getElementById("siteSelectLabel");
        
        if (!label) return;

        if (checked.length === checkboxes.length || checked.length === 0) {
            label.textContent = "All Sites";
        } else if (checked.length === 1) {
            label.textContent = checked[0].value;
        } else {
            label.textContent = `${checked.length} Sites Selected`;
        }
    };

    const bgToggleBtn = document.getElementById("bgToggleBtn");
    if(bgToggleBtn) {
        const themes = ['theme-auto', 'theme-day', 'theme-night', 'theme-off'];
        const themeLabels = [
            '<i class="fa-solid fa-wand-magic-sparkles"></i> Auto Theme', 
            '<i class="fa-solid fa-sun"></i> Day Mode', 
            '<i class="fa-solid fa-moon"></i> Night Mode', 
            '<i class="fa-solid fa-ban"></i> Bg Off'
        ];
        let currentThemeIndex = 0;
        
        document.body.classList.add(themes[0]); 
        
        bgToggleBtn.addEventListener("click", () => {
            if (typeof soundClick !== 'undefined') playAudio(soundClick);
            document.body.classList.remove(themes[currentThemeIndex]);
            currentThemeIndex = (currentThemeIndex + 1) % themes.length;
            document.body.classList.add(themes[currentThemeIndex]);
            bgToggleBtn.innerHTML = themeLabels[currentThemeIndex];
        });
    }

    initializeData();

    executeSearchBtn.addEventListener("click", () => { 
        if (isDataLoaded) { playAudio(soundClick); applyFilters(); }
    });

    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") { e.preventDefault(); if (isDataLoaded) applyFilters(); }
    });

    clearAllBtn.addEventListener("click", () => {
    playAudio(soundClear);
    
    // Clear search input
    searchInput.value = "";
    
    // Reset Sites dropdown - select all sites AND update button label
    const allSiteCheckboxes = document.querySelectorAll(".site-checkbox");
    allSiteCheckboxes.forEach(cb => cb.checked = true);
    
    // Force update the button label
    if(window.updateSiteButtonLabel) {
        window.updateSiteButtonLabel();
    }
    
    // Also manually update the label text to "All Sites"
    const siteSelectLabel = document.getElementById("siteSelectLabel");
    if(siteSelectLabel) {
        siteSelectLabel.textContent = "All Sites";
    }
    
    // Reset ALL dropdown filters
    const filterMonth = document.getElementById("filterMonth");
    const filterYearFrom = document.getElementById("filterYearFrom");
    const filterYearTo = document.getElementById("filterYearTo");
    const filterStatus = document.getElementById("filterStatus");
    const filterBalance = document.getElementById("filterBalance");
    const filterSrv = document.getElementById("filterSrv");
    const filterRetention = document.getElementById("filterRetention");
    const filterInvoiced = document.getElementById("filterInvoiced");
    const filterMinBalance = document.getElementById("filterMinBalance");
    
    if(filterMonth) filterMonth.value = "";
    if(filterYearFrom) filterYearFrom.value = "";
    if(filterYearTo) filterYearTo.value = "";   
    if(filterStatus) filterStatus.value = "";
    if(filterBalance) filterBalance.value = "";
    if(filterSrv) filterSrv.value = "";
    if(filterRetention) filterRetention.value = "";
    if(filterInvoiced) filterInvoiced.value = "";
    if(filterMinBalance) filterMinBalance.value = "";
    
    // Reset the site search input in dropdown if it has text
    const siteSearchInput = document.getElementById("siteSearchInput");
    if(siteSearchInput) {
        siteSearchInput.value = "";
        // Trigger search to show all items again
        const event = new Event('input');
        siteSearchInput.dispatchEvent(event);
    }
    
    // Reset to empty state
    resetToEmptyState();
    
    // Focus back on search input for next search
    searchInput.focus();
});

    refreshBtn.addEventListener("click", () => {
        playAudio(soundClick);
        const icon = refreshBtn.querySelector('i');
        icon.classList.add('fa-spin');
        document.getElementById("tableBody").innerHTML = `<div class="loading-state"><i class="fa-solid fa-cloud-arrow-down fa-bounce" style="font-size:24px; color:#38bdf8; margin-bottom:15px; display:block;"></i> Downloading fresh data...</div>`;
        fetchAllData(true).then(() => {
            icon.classList.remove('fa-spin');
            resetToEmptyState(); 
        });
    });

    exportExcelBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { playAudio(soundError); alert("No records currently visible to export."); return; }
        playAudio(soundConfirm); exportToExcel();
    });

    printSummaryBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { playAudio(soundError); alert("No records currently visible to print."); return; }
        playAudio(soundConfirm); generateSummaryPrintout();
    });

    printDetailedBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { playAudio(soundError); alert("No records currently visible to print."); return; }
        playAudio(soundConfirm); generateDetailedPrintout();
    });

    printProjectBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { playAudio(soundError); alert("No records currently visible to print."); return; }
        playAudio(soundConfirm); generateProjectPrintout();
    });

    printRetentionBtn.addEventListener("click", () => {
        if (!isDataLoaded || currentFilteredData.length === 0) { playAudio(soundError); alert("No records currently visible to print."); return; }
        playAudio(soundConfirm); generateRetentionPrintout();
    });

    document.getElementById("tableBody").addEventListener("click", (e) => {
        const cardRow = e.target.closest('.master-grid-row');
        if (cardRow) {
            playAudio(soundPop);
            const invoiceCard = cardRow.closest('.invoice-card');
            invoiceCard.classList.toggle('expanded');
        }
    });
});

async function initializeData() {
    const cachedPO = localStorage.getItem(CACHE_PO_KEY);
    const cachedCommit = localStorage.getItem(CACHE_COMMIT_KEY);
    const cachedSite = localStorage.getItem(CACHE_SITE_KEY); 
    const cachedFbRet = localStorage.getItem(CACHE_FB_RETENTION);
    const cachedFbFall = localStorage.getItem(CACHE_FB_FALLBACK);
    const cachedFbRaw = localStorage.getItem(CACHE_FB_RAW);
    const lastUpdatedString = localStorage.getItem(CACHE_TIME_KEY);
    const lastUpdatedMs = localStorage.getItem(CACHE_MS_KEY);

    const isCacheValid = lastUpdatedMs && (Date.now() - parseInt(lastUpdatedMs)) < CACHE_EXPIRY_MS;

    if (cachedPO && cachedCommit && cachedSite && cachedFbRet && cachedFbFall && cachedFbRaw && isCacheValid) {
        allInvoiceData = JSON.parse(cachedPO);
        allCommitData = JSON.parse(cachedCommit);
        allSiteData = JSON.parse(cachedSite); 
        retentionByPO = JSON.parse(cachedFbRet);
        fallbackSrvByPO = JSON.parse(cachedFbFall);
        allFirebaseData = JSON.parse(cachedFbRaw);

        setupDataDependents();
        isDataLoaded = true;
        updateUIReadyState(lastUpdatedString);
        resetToEmptyState();
    } else {
        await fetchAllData(false);
        resetToEmptyState();
    }
}

async function fetchAllData(isManualRefresh) {
    try {
        const cacheBuster = "?v=" + new Date().getTime();
        const [poResponse, commitResponse, siteResponse] = await Promise.all([
            fetch(PO_CSV_URL + cacheBuster), fetch(ECOMMIT_CSV_URL + cacheBuster), fetch(SITE_CSV_URL + cacheBuster)
        ]);
        
        if (!poResponse.ok || !commitResponse.ok || !siteResponse.ok) throw new Error("Failed to download CSV files from GitHub.");
        
        allInvoiceData = parseCSV(await poResponse.text());
        allCommitData = parseCSV(await commitResponse.text());
        allSiteData = parseCSV(await siteResponse.text()); 
        
        await Promise.all([fetchFirebaseRetentionData(), fetchFallbackSrvData()]); 

        try {
            localStorage.setItem(CACHE_PO_KEY, JSON.stringify(allInvoiceData));
            localStorage.setItem(CACHE_COMMIT_KEY, JSON.stringify(allCommitData));
            localStorage.setItem(CACHE_SITE_KEY, JSON.stringify(allSiteData)); 
            localStorage.setItem(CACHE_FB_RETENTION, JSON.stringify(retentionByPO));
            localStorage.setItem(CACHE_FB_FALLBACK, JSON.stringify(fallbackSrvByPO));
            localStorage.setItem(CACHE_FB_RAW, JSON.stringify(allFirebaseData));

            const now = new Date();
            localStorage.setItem(CACHE_TIME_KEY, now.toLocaleString());
            localStorage.setItem(CACHE_MS_KEY, now.getTime().toString());
            updateUIReadyState(now.toLocaleString());
        } catch (e) {}

        setupDataDependents();
        isDataLoaded = true;
        if (isManualRefresh) playAudio(soundSuccess);
    } catch (error) {
        if (isManualRefresh) playAudio(soundError);
        document.getElementById("tableBody").innerHTML = `<div class="error-state"><i class="fa-solid fa-triangle-exclamation" style="font-size:24px; margin-bottom:10px; display:block;"></i> Error: ${error.message}</div>`;
    }
}

async function fetchFirebaseRetentionData() {
    retentionByPO = {};
    allFirebaseData = []; 
    try {
        const snapshot = await dbRetention.ref('payments').once('value'); 
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
    } catch (error) { console.error("Failed DB1 Retention:", error); }
}

async function fetchFallbackSrvData() {
    fallbackSrvByPO = {};
    try {
        const snapshot = await dbFallback.ref('invoice_entries').once('value'); 
        const data = snapshot.val();
        
        if (data) {
            Object.keys(data).forEach(poKey => {
                const poNo = poKey.toString().trim();
                const entriesForPO = data[poKey];
                
                if (entriesForPO && typeof entriesForPO === 'object') {
                    Object.values(entriesForPO).forEach(record => {
                        const fallbackCommit = {
                            'PO Number': poNo,
                            'Packing Slip': record.invNumber || '-',       
                            'Date': record.releaseDate || '-',              
                            '_rawCost': parseFloat(String(record.invValue || '0').replace(/,/g, '')), 
                            '_status': record.status || 'System Portal',    
                            '_isFallback': true
                        };
                        
                        if (!fallbackSrvByPO[poNo]) fallbackSrvByPO[poNo] = [];
                        fallbackSrvByPO[poNo].push(fallbackCommit);
                    });
                }
            });
        }
    } catch (error) { console.error("Failed DB2 Fallback SRV:", error); }
}

function getSrvRecordsForPO(poNumber) {
    if (commitsByPO[poNumber] && commitsByPO[poNumber].length > 0) {
        return commitsByPO[poNumber]; 
    }
    if (fallbackSrvByPO[poNumber] && fallbackSrvByPO[poNumber].length > 0) {
        return fallbackSrvByPO[poNumber]; 
    }
    return []; 
}

function setupDataDependents() {
    commitsByPO = {};
    siteNameMap = {}; 
    years = new Set(); 
    const sites = new Set();

    allSiteData.forEach(row => {
        const wsheKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'warehouse');
        const descKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'description');
        if (wsheKey && descKey) {
            const wshe = (row[wsheKey] || '').toString().trim().toUpperCase();
            const desc = (row[descKey] || '').toString().trim();
            if (wshe && desc && desc.toUpperCase() !== 'N/A') siteNameMap[wshe] = desc;
        }
    });

    allCommitData.forEach(commit => {
        const po = commit['PO Number'] || commit['PO'] || commit['ReqNum'];
        if (!po || po === 'N/A') return;
        
        let cost = 0;
        if (commit['Extended Cost'] && commit['Extended Cost'] !== '-') {
            const parsed = parseFloat(String(commit['Extended Cost']).replace(/,/g, ''));
            if (!isNaN(parsed)) cost = parsed;
        }
        commit._rawCost = cost;
        commit._isFallback = false;

        if (commit['Date'] && commit['Date'] !== '-') {
            const d = new Date(commit['Date']);
            if (!isNaN(d)) {
                years.add(d.getFullYear().toString());
            }
        }

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
        row._month = ""; row._year = "";
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

    const siteListContainer = document.getElementById("siteCheckboxList");
    if (siteListContainer) {
        siteListContainer.innerHTML = '';
        Array.from(sites).sort().forEach(site => { 
            siteListContainer.innerHTML += `
                <label class="checkbox-item">
                    <input type="checkbox" class="site-checkbox" value="${site}" checked>
                    <span>${site}</span>
                </label>
            `; 
        });
        if(window.updateSiteButtonLabel) window.updateSiteButtonLabel();
    }

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
    const selectedMonth = document.getElementById("filterMonth").value;
    const selectedYearFrom = document.getElementById("filterYearFrom").value; 
    const selectedYearTo = document.getElementById("filterYearTo").value;     
    const selectedStatus = document.getElementById("filterStatus").value; 
    const selectedBalance = document.getElementById("filterBalance").value; 
    
    const minBalanceInput = document.getElementById("filterMinBalance");
    const selectedMinBalance = minBalanceInput ? minBalanceInput.value : ""; 
    
    const selectedSrv = document.getElementById("filterSrv").value; 
    const selectedRetention = document.getElementById("filterRetention").value; 
    
    const filterInvoicedEl = document.getElementById("filterInvoiced");
    const selectedInvoiced = filterInvoicedEl ? filterInvoicedEl.value : "";

    const selectedSiteCheckboxes = Array.from(document.querySelectorAll(".site-checkbox:checked")).map(cb => cb.value);
    const totalSitesAvailable = document.querySelectorAll(".site-checkbox").length;
    
    const isSiteFilterActive = selectedSiteCheckboxes.length > 0 && selectedSiteCheckboxes.length < totalSitesAvailable;
    const isDateFilterActive = (selectedMonth !== "" || selectedYearFrom !== "" || selectedYearTo !== "");

    const filtered = allInvoiceData.filter(row => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || '';

        if (isSiteFilterActive && !selectedSiteCheckboxes.includes(site.trim())) return false;

        const relatedCommits = getSrvRecordsForPO(poNumber);
        let validCommits = [];

        let poDatePasses = true;
        if (selectedMonth !== "" && row._month !== selectedMonth) poDatePasses = false;
        if (selectedYearFrom !== "" && (!row._year || parseInt(row._year) < parseInt(selectedYearFrom))) poDatePasses = false;
        if (selectedYearTo !== "" && (!row._year || parseInt(row._year) > parseInt(selectedYearTo))) poDatePasses = false;

        let hasMatchingSrvDate = false;
        relatedCommits.forEach(commit => {
            let srvDatePasses = true;
            let srvMonth = ""; let srvYear = "";
            if (commit['Date'] && commit['Date'] !== '-') {
                const d = new Date(commit['Date']);
                if (!isNaN(d)) {
                    srvMonth = d.getMonth().toString();
                    srvYear = d.getFullYear().toString();
                }
            }

            if (selectedMonth !== "" && srvMonth !== selectedMonth) srvDatePasses = false;
            if (selectedYearFrom !== "" && (srvYear === "" || parseInt(srvYear) < parseInt(selectedYearFrom))) srvDatePasses = false;
            if (selectedYearTo !== "" && (srvYear === "" || parseInt(srvYear) > parseInt(selectedYearTo))) srvDatePasses = false;

            if (srvDatePasses) {
                hasMatchingSrvDate = true;
                validCommits.push(commit); 
            }
        });

        if (isDateFilterActive && !poDatePasses && !hasMatchingSrvDate) {
            return false;
        }

        row._filteredCommits = isDateFilterActive ? validCommits : relatedCommits;

        const openColumnVal = (row['Open'] || '').toString().toLowerCase().trim();
        const isClosed = (openColumnVal === 'false');
        if (selectedStatus === 'open' && isClosed) return false;
        if (selectedStatus === 'closed' && !isClosed) return false;

        if (selectedInvoiced !== "") {
            const actualInvoicedHeader = row._filteredCommits.length > 0 ? (Object.keys(row._filteredCommits[0]).find(k => k.trim() === "Invoiced") || "Invoiced") : "Invoiced";
            let isCleared = true;
            
            if (row._filteredCommits.length > 0) {
                isCleared = row._filteredCommits.every(commit => (commit[actualInvoicedHeader] || '').toString().trim().toUpperCase() === 'TRUE');
            } else {
                isCleared = isClosed;
            }

            if (selectedInvoiced === 'cleared' && !isCleared) return false;
            if (selectedInvoiced === 'pending' && isCleared) return false;
        }

        if (selectedBalance !== "" || selectedSrv !== "" || selectedRetention !== "" || selectedMinBalance !== "") {
            let poSrvAmt = 0;
            row._filteredCommits.forEach(commit => { poSrvAmt += commit._rawCost; });
            const invAmt = row._rawAmount;
            
            let rowBalance = invAmt - poSrvAmt;
            if (isClosed && poSrvAmt === 0) {
                rowBalance = 0;
            }
            
            if (selectedMinBalance !== "") {
                const minAllowed = parseFloat(selectedMinBalance);
                if (!isNaN(minAllowed) && rowBalance < minAllowed) return false;
            }
            
            if (selectedSrv !== "") {
                const hasSrvValue = poSrvAmt > 0.001;
                if (selectedSrv === 'has_srv' && !hasSrvValue) return false; 
                if (selectedSrv === 'no_srv' && hasSrvValue) return false;
            }

            if (selectedBalance !== "") {
                const isZeroBalance = Math.abs(rowBalance) < 0.01;
                if (selectedBalance === 'zero' && !isZeroBalance) return false; 
                if (selectedBalance === 'value' && isZeroBalance) return false; 
            }

            // ==============================================
            // CORRECTED RETENTION FILTER LOGIC
            // ==============================================
            if (selectedRetention !== "") {
                const poRetAmt = retentionByPO[poNumber] || 0;
                const hasRetention = Math.abs(poRetAmt) > 0.01;
                
                const fbRecords = allFirebaseData.filter(r => (r.poNo || r.poNumber || "").toString().trim() === poNumber);
                let hasRealPendingPayment = false;
                
                fbRecords.forEach(rec => {
                    const dPaid = (rec.datePaid || '').toString().trim();
                    const chq = (rec.chequeNo || '').toString().trim();
                    const retVal = parseFloat(rec.retention || 0);
                    
                    const isDPaidEmpty = (dPaid === '' || dPaid === '-');
                    const isChqEmpty = (chq === '' || chq === '-');
                    
                    // Only count as pending payment if BOTH date and cheque are empty AND the retention value is NOT zero
                    if (isDPaidEmpty && isChqEmpty && Math.abs(retVal) > 0.001) {
                        hasRealPendingPayment = true;
                    }
                });
                
                // Determine if this qualifies as "Pending Payment" for filtering
                // Pending payment ONLY when: total retention is zero/negative BUT there's a pending record with non-zero value
                let isPendingPayment = false;
                if (!hasRetention && hasRealPendingPayment) {
                    isPendingPayment = true;
                }
                
                if (selectedRetention === 'value' && !hasRetention) return false;
                if (selectedRetention === 'zero' && hasRetention) return false;
                if (selectedRetention === 'value_or_unpaid' && !hasRetention && !isPendingPayment) return false;
            }
        }

        if (query) {
            let commitDataStr = row._filteredCommits.map(c => `${c['Packing Slip']} ${c._rawCost}`).join(" ");
            const searchableText = `${poNumber} ${site} ${row['Supplier Name'] || row['Supplier'] || ''} ${row['Order Date'] || row['Date'] || ''} ${commitDataStr}`.toLowerCase();
            if (!searchableText.includes(query)) return false;
        }
        
        return true;
    });
    
    currentFilteredData = filtered;
    
    if (filtered.length > 0) {
        playAudio(soundSuccess);
    } else {
        playAudio(soundError);
    }
    
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
    let grandTotalBalance = 0;

    dataToRender.forEach((row) => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || 'N/A';
        const vendor = row['Supplier Name'] || row['Supplier'] || 'N/A';
        const orderDate = formatToDDMMMYYYY(row['Order Date'] || row['Date'] || 'N/A');
        
        let mainStatus = row['Status'] || 'Open';
        const openColumnVal = (row['Open'] || '').toString().toLowerCase().trim();
        if (openColumnVal === 'false') mainStatus = 'Closed';

        const invAmt = row._rawAmount;
        grandTotalInvoice += invAmt;
        const verifiedClass = mainStatus.toLowerCase() === 'open' ? 'verified' : (mainStatus.toLowerCase() === 'closed' ? 'closed-badge' : '');

        let masterHTML = `
            <div class="invoice-card">
                <div class="master-grid-row">
                    <div class="grid-cell">
                        <div class="expand-btn" title="View Details">
                            <i class="fa-solid fa-chevron-right"></i>
                        </div>
                    </div>
                    <div class="grid-cell" style="color:#38bdf8;">
                        <i class="fa-solid fa-file-invoice" style="margin-right:5px;"></i> Invoice
                    </div>
                    <div class="grid-cell"><strong>${poNumber}</strong></div>
                    <div class="grid-cell" title="${site}">${site}</div>
                    <div class="grid-cell" title="${vendor}">${vendor}</div>
                    <div class="grid-cell">
                        <strong>QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                    </div>
                    <div class="grid-cell">${orderDate}</div>
                    <div class="grid-cell">
                        <span class="status-badge ${verifiedClass}">${mainStatus}</span>
                    </div>
                </div>
        `;

        const relatedCommits = row._filteredCommits || getSrvRecordsForPO(poNumber);
        let subTableHTML = '';
        let poSrvAmt = 0;

        if (relatedCommits.length > 0) {
            const theadHTML = `
                <th>Inv.Entry</th>
                <th>Packing Slip</th>
                <th>SRV Date</th>
                <th>SRV Value</th>
                <th>Invoiced</th>
                <th>REMARKS</th>
            `;

let tbodyHTML = '';
if (relatedCommits.length === 0) {
    tbodyHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding: 20px;">No SRV records found for this PO</td></tr>`;
} else {
    tbodyHTML = relatedCommits.map((commit, i) => {
        const invEntry = `Inv-${String(i + 1).padStart(2, '0')}`;
        const packingSlip = commit['Packing Slip'] || '-';
        const srvDate = formatToDDMMMYYYY(commit['Date'] || '-');
        const srvVal = commit._rawCost;
        
        const isInvoiced = (commit['Invoiced'] || '').toString().trim().toUpperCase() === 'TRUE';
        const invoicedBadge = isInvoiced 
            ? `<span style="color:#ef4444; font-weight:bold;">Cleared</span>` 
            : `<span style="color:#f59e0b; font-weight:bold;">Pending</span>`;
        
        poSrvAmt += srvVal;
        const srvValueFormatted = srvVal.toLocaleString('en-US', {minimumFractionDigits: 2});
        
        const remarkBadge = commit._isFallback 
            ? `<span class="epicor-badge" style="color:#38bdf8;">${commit._status}</span>` 
            : `<span class="epicor-badge">Epicor Record</span>`;
        
        return `
            <tr>
                <td><strong>${invEntry}</strong></td>
                <td>${packingSlip}</td>
                <td>${srvDate}</td>
                <td class="num">${srvValueFormatted}</td>
                <td>${invoicedBadge}</td>
                <td>${remarkBadge}</td>
            </tr>
        `;
    }).join('');
}

            let rowBalance = invAmt - poSrvAmt;
            if (mainStatus === 'Closed' && poSrvAmt === 0) {
                rowBalance = 0;
            }

            grandTotalSrv += poSrvAmt;
            grandTotalBalance += rowBalance;

            subTableHTML = `
                <div class="detail-grid-row">
                    <div class="sub-table-header">
                        <i class="fa-solid fa-list-check"></i> Service Receipts (SRV)
                    </div>
                    <div class="sub-table-wrapper">
                        <table class="sub-table">
                            <thead><tr>${theadHTML}</tr></thead>
                            <tbody>${tbodyHTML}</tbody>
                        </table>
                        <div class="sub-table-footer">
                            <div class="sub-stat">
                                <span>PO Value:</span> 
                                <strong>QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                            </div>
                            <div class="sub-stat">
                                <span>Total SRV:</span> 
                                <strong>QAR ${poSrvAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                            </div>
                            <div class="sub-stat highlight">
                                <span>Outstanding Balance:</span> 
                                <strong>QAR ${rowBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        } else {
            let rowBalance = invAmt - poSrvAmt;
            if (mainStatus === 'Closed' && poSrvAmt === 0) {
                rowBalance = 0;
            }
            
            grandTotalBalance += rowBalance;

            subTableHTML = `
                <div class="detail-grid-row">
                    <div class="sub-table-header">
                        <i class="fa-solid fa-list-check"></i> Service Receipts (SRV)
                    </div>
                    <div class="sub-table-wrapper">
                        <div class="no-commits-msg">
                            <i class="fa-solid fa-circle-info"></i> No delivery or payment records found for this PO in the selected period.
                        </div>
                        <div class="sub-table-footer">
                            <div class="sub-stat">
                                <span>PO Value:</span> 
                                <strong>QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                            </div>
                            <div class="sub-stat">
                                <span>Total SRV:</span> 
                                <strong>QAR 0.00</strong>
                            </div>
                            <div class="sub-stat highlight">
                                <span>Outstanding Balance:</span> 
                                <strong>QAR ${rowBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        gridHTML += (masterHTML + subTableHTML);
    });
    
    const summaryCardHTML = `
        <div class="grand-summary-card">
            <div class="grand-summary-title">
                <i class="fa-solid fa-calculator"></i>
                <div>Search Results Summary</div>
            </div>
            <div class="grand-summary-stats">
                <div class="g-stat">
                    <span>Total PO Value</span>
                    <strong>QAR ${grandTotalInvoice.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                </div>
                <div class="g-stat">
                    <span>Total SRV</span>
                    <strong>QAR ${grandTotalSrv.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                </div>
                <div class="g-stat highlight">
                    <span>Total Outstanding Balance</span>
                    <strong>QAR ${grandTotalBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                </div>
            </div>
        </div>
    `;

    tbody.innerHTML = gridHTML + summaryCardHTML;
}

function getActiveFiltersHtml() {
    const monthIdx = document.getElementById("filterMonth").value;
    const yearFrom = document.getElementById("filterYearFrom").value; 
    const yearTo = document.getElementById("filterYearTo").value;     
    const status = document.getElementById("filterStatus").value; 
    const balance = document.getElementById("filterBalance").value; 
    const srv = document.getElementById("filterSrv").value; 
    const retention = document.getElementById("filterRetention").value; 
    const filterInvoicedEl = document.getElementById("filterInvoiced");
    const invoiced = filterInvoicedEl ? filterInvoicedEl.value : "";
    const query = document.getElementById("searchInput").value.trim();

    const minBalanceInput = document.getElementById("filterMinBalance");
    const minBalanceVal = minBalanceInput ? minBalanceInput.value : "";

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    let activeFilters = [];
    if (query) activeFilters.push(`Search: "${query}"`);
    
    const selectedSiteCheckboxes = Array.from(document.querySelectorAll(".site-checkbox:checked")).map(cb => cb.value);
    const totalSitesAvailable = document.querySelectorAll(".site-checkbox").length;
    
    if (selectedSiteCheckboxes.length > 0 && selectedSiteCheckboxes.length < totalSitesAvailable) {
        if (selectedSiteCheckboxes.length <= 3) {
            activeFilters.push(`Sites: ${selectedSiteCheckboxes.join(', ')}`);
        } else {
            activeFilters.push(`Sites: ${selectedSiteCheckboxes.length} Selected`);
        }
    }

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
    
    if (minBalanceVal !== "" && !isNaN(parseFloat(minBalanceVal))) {
        activeFilters.push(`Min Balance: &ge; QAR ${parseFloat(minBalanceVal).toLocaleString('en-US')}`);
    }

    if (balance === "value") activeFilters.push(`BALANCE: HAS VALUE`);
    if (balance === "zero") activeFilters.push(`BALANCE: ZERO`);

    if (srv === "has_srv") activeFilters.push(`SRV: HAS VALUE`);
    if (srv === "no_srv") activeFilters.push(`SRV: NO RECORD`);

    if (invoiced === "cleared") activeFilters.push(`Invoiced: CLEARED`);
    if (invoiced === "pending") activeFilters.push(`Invoiced: PENDING`);

    if (retention === "value") activeFilters.push(`RETENTION: HAS VALUE`);
    if (retention === "zero") activeFilters.push(`RETENTION: ZERO`);
    if (retention === "value_or_unpaid") activeFilters.push(`RETENTION: VALUE OR PENDING PAYMENT`);

    if (activeFilters.length > 0) {
        return `<p class="print-filters">FILTERED BY &rarr; &nbsp; ${activeFilters.join(' &nbsp;|&nbsp; ')}</p>`;
    }
    return '';
}

function exportToExcel() {
    const excelData = currentFilteredData.map(row => {
        const poNumber = row._cleanPO;
        const relatedCommits = row._filteredCommits || getSrvRecordsForPO(poNumber);
        
        const totalSrv = relatedCommits.reduce((sum, c) => sum + c._rawCost, 0);
        const retention = retentionByPO[poNumber] || 0;
        
        const isClosed = (row['Open'] || '').toLowerCase() === 'false';
        const status = isClosed ? 'Closed' : 'Open';
        
        let balance = row._rawAmount - totalSrv;
        if (status === 'Closed' && totalSrv === 0) {
            balance = 0;
        }

        return {
            "Ref / PO": poNumber,
            "Site / Project ID": row['Project ID'] || row['Site'] || 'N/A',
            "Vendor Name": row['Supplier Name'] || row['Supplier'] || 'N/A',
            "Order Date": formatToDDMMMYYYY(row['Order Date'] || row['Date']),
            "PO Value (QAR)": row._rawAmount,
            "Total SRV (QAR)": totalSrv,
            "Retention (QAR)": retention,
            "Outstanding Balance (QAR)": balance,
            "Status": status
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice Records");

    const maxWidths = Object.keys(excelData[0]).map(key => ({ wch: key.length + 5 }));
    worksheet["!cols"] = maxWidths;

    const fileName = `Invoice_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

function generateSummaryPrintout() {
    let totalInvoiceAmount = 0; 
    let totalSrvAmount = 0; 
    let totalRetentionAmount = 0; 
    let totalOutstandingBalance = 0; 
    let rowsHtml = '';
    
    currentFilteredData.forEach(row => {
        const poNumber = (row._cleanPO || '').toString().trim(); 
        const site = row['Project ID'] || row['Site'] || 'N/A';
        const vendor = row['Supplier Name'] || row['Supplier'] || 'N/A';
        const orderDate = formatToDDMMMYYYY(row['Order Date'] || row['Date'] || 'N/A');

        let mainStatus = (row['Status'] || 'Open').toString().trim();
        const openColumnVal = (row['Open'] || '').toString().toLowerCase().trim();
        if (openColumnVal === 'false') mainStatus = 'Closed';

        const invAmt = row._rawAmount || 0;
        totalInvoiceAmount += invAmt;

        const relatedCommits = row._filteredCommits || getSrvRecordsForPO(poNumber);
        
let summaryInvoicedStatus = "Pending";
let summaryInvoicedStyle = "color:#f59e0b !important; font-weight:800;";

if (relatedCommits && relatedCommits.length > 0) {
    const actualInvoicedHeader = Object.keys(relatedCommits[0]).find(k => k.trim() === "Invoiced") || "Invoiced";
    const allCleared = relatedCommits.every(commit => {
        const rawVal = commit[actualInvoicedHeader] || "";
        const cleanVal = rawVal.toString().trim().toUpperCase();
        return cleanVal === "TRUE";
    });

    if (allCleared) {
        summaryInvoicedStatus = "Cleared";
        summaryInvoicedStyle = "color:#ef4444 !important; font-weight:800;";
    }
} else if (mainStatus === 'Closed') {
    summaryInvoicedStatus = "Cleared";
    summaryInvoicedStyle = "color:#ef4444 !important; font-weight:800;";
} else if (relatedCommits.length === 0) {
    summaryInvoicedStatus = "No SRV";
    summaryInvoicedStyle = "color:#94a3b8 !important; font-weight:800;";
}

        let poSrvAmt = 0;
        relatedCommits.forEach(commit => { 
            poSrvAmt += (commit._rawCost || 0); 
        });
        totalSrvAmount += poSrvAmt;

        // ==============================================
        // CORRECTED RETENTION DISPLAY LOGIC FOR SUMMARY
        // ==============================================
        const fbRecords = allFirebaseData.filter(r => (r.poNo || r.poNumber || "").toString().trim() === poNumber);
        let hasRealPendingPayment = false;
        let pendingRetentionValue = 0;
        
        fbRecords.forEach(rec => {
            const dPaid = (rec.datePaid || '').toString().trim();
            const chq = (rec.chequeNo || '').toString().trim();
            const retVal = parseFloat(rec.retention || 0);
            
            const isDPaidEmpty = (dPaid === '' || dPaid === '-');
            const isChqEmpty = (chq === '' || chq === '-');
            
            // Only show "Pending Payment" if retention value is non-zero
            if (isDPaidEmpty && isChqEmpty && Math.abs(retVal) > 0.001) {
                hasRealPendingPayment = true;
                pendingRetentionValue = retVal;
            }
        });

        const poRetention = retentionByPO[poNumber] || 0;
        totalRetentionAmount += poRetention;
        
        let retentionDisplay = poRetention.toLocaleString('en-US', {minimumFractionDigits: 2});
        
        // Only show "Pending Payment" when total retention is zero but there's a pending record with non-zero value
        // If total retention is non-zero, just show the number without any label
        if (Math.abs(poRetention) < 0.01 && hasRealPendingPayment) {
            retentionDisplay = `${pendingRetentionValue.toLocaleString('en-US', {minimumFractionDigits: 2})} <br><span style="font-size:10px; color:#ef4444; white-space:nowrap;">(Pending Payment)</span>`;
        }

        let rowBalance = invAmt - poSrvAmt;
        if (mainStatus === 'Closed' && poSrvAmt === 0) {
            rowBalance = 0;
        }
        
        totalOutstandingBalance += rowBalance;

        let statusStyle = mainStatus === 'Closed' ? 'color:#ef4444 !important; font-weight:800;' : 'color:#10b981 !important; font-weight:800;';

        rowsHtml += `
            <tr>
                <td><strong>${poNumber}</strong></td>
                <td>${site}</td>
                <td>${vendor}</td>
                <td>${orderDate}</td>
                <td style="${statusStyle}">${mainStatus}</td>
                <td style="${summaryInvoicedStyle}">${summaryInvoicedStatus}</td>
                <td class="num">${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num">${poSrvAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="color:#ea580c !important; font-weight:bold;">${retentionDisplay}</td>
                <td class="num" style="font-weight:bold; color:#ef4444 !important;">${rowBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    });

    const printTime = `${formatToDDMMMYYYY(new Date())} ${new Date().toLocaleTimeString()}`;
    const printHtml = `
        <div class="print-header">
            <h2>Summary Report: POs & SRVs</h2>
            <p>Generated on: ${printTime} &nbsp; | &nbsp; Records: ${currentFilteredData.length}</p>
            ${getActiveFiltersHtml()}
        </div>
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 8%;">Ref / PO</th>
                    <th style="width: 6%;">Site</th>
                    <th style="width: 20%;">Vendor Name</th>
                    <th style="width: 10%;">Order Date</th>
                    <th style="width: 8%;">PO Status</th> 
                    <th style="width: 8%;">Invoiced</th> 
                    <th class="num" style="width: 10%;">PO Value (QAR)</th>
                    <th class="num" style="width: 10%;">SRV Total (QAR)</th>
                    <th class="num" style="color:#ea580c !important; width: 8%;">Retention (QAR)</th>
                    <th class="num" style="width: 12%;">Outstanding (QAR)</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr><td>Grand Total PO Value</td><td>QAR ${totalInvoiceAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td>Grand Total SRV</td><td>QAR ${totalSrvAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td style="color:#ea580c !important;">Grand Total Retention</td><td style="color:#ea580c !important;">QAR ${totalRetentionAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr class="balance-row"><td>TOTAL OUTSTANDING BALANCE</td><td>QAR ${totalOutstandingBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
            </table>
        </div>
    `;
    document.getElementById("printArea").innerHTML = printHtml;
    window.print();
}

function generateDetailedPrintout() {
    let totalInvoiceAmount = 0; let totalSrvAmount = 0; let totalRetentionAmount = 0; let totalOutstandingBalance = 0; let htmlContent = '';
    
    currentFilteredData.forEach(row => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || 'N/A';
        const vendor = row['Supplier Name'] || row['Supplier'] || 'N/A';
        const orderDate = formatToDDMMMYYYY(row['Order Date'] || row['Date'] || 'N/A');

        let mainStatus = row['Status'] || 'Open';
        const openColumnVal = (row['Open'] || '').toString().toLowerCase().trim();
        if (openColumnVal === 'false') mainStatus = 'Closed';

        const invAmt = row._rawAmount;
        totalInvoiceAmount += invAmt;

        let poSrvAmt = 0;
        const relatedCommits = row._filteredCommits || getSrvRecordsForPO(poNumber);

        let srvRowsHtml = '';
        if (relatedCommits.length > 0) {
            srvRowsHtml += `
                <table class="print-sub-table">
                    <thead>
                        <tr>
                            <th>Inv.Entry</th>
                            <th>Packing Slip</th>
                            <th>SRV Date</th>
                            <th class="num">SRV Value (QAR)</th>
                            <th>Invoiced</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            relatedCommits.forEach((commit, i) => {
                const invEntry = `Inv-${String(i + 1).padStart(2, '0')}`;
                const packingSlip = commit['Packing Slip'] || '-';
                const srvDate = formatToDDMMMYYYY(commit['Date'] || '-');
                const srvVal = commit._rawCost;
                
const isInvoiced = (commit['Invoiced'] || '').toString().trim().toUpperCase() === 'TRUE';
const invoicedStatus = isInvoiced ? "Cleared" : "Pending";
const invoicedStyle = isInvoiced ? "color:#ef4444 !important; font-weight:bold;" : "color:#f59e0b !important; font-weight:bold;";

                poSrvAmt += srvVal; totalSrvAmount += srvVal;
                
                srvRowsHtml += `
                    <tr>
                        <td><strong>${invEntry}</strong></td>
                        <td>${packingSlip}</td>
                        <td>${srvDate}</td>
                        <td class="num">${srvVal.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                        <td style="${invoicedStyle}">${invoicedStatus}</td>
                    </tr>
                `;
            });
            srvRowsHtml += `</tbody></table>`;
        } else {
            srvRowsHtml = `<div class="print-no-srv">No delivery or payment records found for this PO in the selected period.</div>`;
        }

        // ==============================================
        // CORRECTED RETENTION DISPLAY LOGIC FOR DETAILED
        // ==============================================
        const fbRecords = allFirebaseData.filter(r => (r.poNo || r.poNumber || "").toString().trim() === poNumber);
        let hasRealPendingPayment = false;
        let pendingRetentionValue = 0;
        
        fbRecords.forEach(rec => {
            const dPaid = (rec.datePaid || '').toString().trim();
            const chq = (rec.chequeNo || '').toString().trim();
            const retVal = parseFloat(rec.retention || 0);
            
            const isDPaidEmpty = (dPaid === '' || dPaid === '-');
            const isChqEmpty = (chq === '' || chq === '-');
            
            if (isDPaidEmpty && isChqEmpty && Math.abs(retVal) > 0.001) {
                hasRealPendingPayment = true;
                pendingRetentionValue = retVal;
            }
        });

        const poRetention = retentionByPO[poNumber] || 0;
        totalRetentionAmount += poRetention;
        
        let retentionDisplay = poRetention.toLocaleString('en-US', {minimumFractionDigits: 2});
        
        // Only show "Pending Payment" when total retention is zero but there's a pending record with non-zero value
        if (Math.abs(poRetention) < 0.01 && hasRealPendingPayment) {
            retentionDisplay = `${pendingRetentionValue.toLocaleString('en-US', {minimumFractionDigits: 2})} (Pending Payment)`;
        }

        let rowBalance = invAmt - poSrvAmt;
        if (mainStatus === 'Closed' && poSrvAmt === 0) {
            rowBalance = 0;
        }

        totalOutstandingBalance += rowBalance;
        
        htmlContent += `
            <div class="print-detailed-po-block">
                <div class="print-po-header">
                    <div class="po-title">PO: ${poNumber} <span>| Site: ${site} | Vendor: ${vendor} | Date: ${orderDate}</span></div>
                    <div class="po-inv-amt">PO Value: QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                ${srvRowsHtml}
                <div class="print-po-footer">
                    <div>Total SRV: QAR ${poSrvAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                    <div style="color:#ea580c !important;">Total Retention: QAR ${retentionDisplay}</div>
                    <div class="highlight" style="color:#ef4444 !important;">Outstanding Balance: QAR ${rowBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
            </div>
        `;
    });

    const printTime = `${formatToDDMMMYYYY(new Date())} ${new Date().toLocaleTimeString()}`;
    
    const printHtml = `
        <div class="print-header">
            <h2>Detailed Report: POs & SRVs</h2>
            <p>Generated on: ${printTime} &nbsp; | &nbsp; Records: ${currentFilteredData.length}</p>
            ${getActiveFiltersHtml()}
        </div>
        <div>${htmlContent}</div>
        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr><td>Grand Total PO Value</td><td>QAR ${totalInvoiceAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td>Grand Total SRV</td><td>QAR ${totalSrvAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td style="color:#ea580c !important;">Grand Total Retention</td><td style="color:#ea580c !important;">QAR ${totalRetentionAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr class="balance-row"><td>TOTAL OUTSTANDING BALANCE</td><td>QAR ${totalOutstandingBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
            </table>
        </div>
    `;
    document.getElementById("printArea").innerHTML = printHtml;
    window.print();
}

function generateProjectPrintout() {
    let projectTotals = {}; let grandTotalInvoice = 0; let grandTotalSrv = 0; let grandTotalRetention = 0; let validRecordsCount = 0;

    currentFilteredData.forEach(row => {
        const openColumnVal = (row['Open'] || '').toString().toLowerCase().trim();
        if (openColumnVal === 'false') return;

        validRecordsCount++; 
        const site = row['Project ID'] || row['Site'] || 'Unassigned Site';
        const poNumber = row._cleanPO;
        const invAmt = row._rawAmount;
        
        const cleanSiteId = site.toString().trim().toUpperCase();
        let siteName = siteNameMap[cleanSiteId] || 'N/A';

        let poSrvAmt = 0;
        const relatedCommits = row._filteredCommits || getSrvRecordsForPO(poNumber);
        relatedCommits.forEach(commit => { poSrvAmt += commit._rawCost; });
        const poRetention = retentionByPO[poNumber] || 0;

        if (!projectTotals[site]) projectTotals[site] = { poValue: 0, srvTotal: 0, retentionTotal: 0, poCount: 0, siteNames: new Set() };
        
        projectTotals[site].siteNames.add(siteName);
        projectTotals[site].poValue += invAmt;
        projectTotals[site].srvTotal += poSrvAmt;
        projectTotals[site].retentionTotal += poRetention;
        projectTotals[site].poCount += 1;

        grandTotalInvoice += invAmt; grandTotalSrv += poSrvAmt; grandTotalRetention += poRetention;
    });

    if (validRecordsCount === 0) { playAudio(soundError); alert("No valid Open records found for Project Report."); return; }
    
    let rowsHtml = '';
    const sortedSites = Object.keys(projectTotals).sort();

    sortedSites.forEach(site => {
        const data = projectTotals[site];
        const sitePayable = data.srvTotal - data.retentionTotal;
        const siteOutstanding = data.poValue - data.srvTotal;
        
        let siteNameStr = Array.from(data.siteNames).join(', ');
        if (siteNameStr.length > 30) siteNameStr = siteNameStr.substring(0, 30) + '...';

        rowsHtml += `
            <tr>
                <td><strong>${site}</strong></td>
                <td>${siteNameStr}</td>
                <td class="num" style="text-align:center;">${data.poCount}</td>
                <td class="num">${data.poValue.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num">${data.srvTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="color:#ea580c !important;">${data.retentionTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="font-weight:bold; color:#0369a1 !important;">${sitePayable.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="font-weight:bold; color:#ef4444 !important;">${siteOutstanding.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    });

    let grandPayable = grandTotalSrv - grandTotalRetention;
    let grandBalance = grandTotalInvoice - grandTotalSrv;
    
    const printTime = `${formatToDDMMMYYYY(new Date())} ${new Date().toLocaleTimeString()}`;
    
    const printHtml = `
        <div class="print-header">
            <h2>Project Closeout Summary <span style="font-size:12px; color:#ef4444 !important; font-style:italic; font-weight:bold;">(Excludes Closed POs)</span></h2>
            <p>Generated on: ${printTime} &nbsp; | &nbsp; Sites/Projects: ${sortedSites.length}</p>
            ${getActiveFiltersHtml()}
        </div>
        <table class="print-project-table">
            <thead>
                <tr>
                    <th>Site / Project ID</th>
                    <th>Site Name</th>
                    <th style="text-align:center;">Open POs</th>
                    <th class="num">Total PO Value</th>
                    <th class="num">Total SRV</th>
                    <th class="num" style="color:#ea580c !important;">Retention</th>
                    <th class="num" style="color:#0369a1 !important;">Net Payable</th>
                    <th class="num">Outstanding Balance</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr><td>Grand Total PO Value</td><td>QAR ${grandTotalInvoice.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td>Grand Total SRV</td><td>QAR ${grandTotalSrv.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td style="color:#ea580c !important;">Grand Total Retention</td><td style="color:#ea580c !important;">QAR ${grandTotalRetention.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr><td style="color:#0369a1 !important; font-weight:800;">TOTAL NET PAYABLE</td><td style="color:#0369a1 !important; font-weight:800;">QAR ${grandPayable.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
                <tr class="balance-row"><td>TOTAL OUTSTANDING BALANCE</td><td>QAR ${grandBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>
            </table>
        </div>
    `;
    document.getElementById("printArea").innerHTML = printHtml;
    window.print();
}

function generateRetentionPrintout() {
    let htmlContent = ''; let validRecordsCount = 0;

    currentFilteredData.forEach(row => {
        const poNumber = row._cleanPO;
        const site = row['Project ID'] || row['Site'] || 'N/A';
        const vendor = row['Supplier Name'] || row['Supplier'] || 'N/A';
        const invAmt = row._rawAmount;

        const fbRecords = allFirebaseData.filter(r => (r.poNo || r.poNumber || "").toString().trim() === poNumber);
        if (fbRecords.length === 0) return; 

        validRecordsCount++;
        let poTotalCertified = 0; let poTotalPayment = 0; let poTotalRetention = 0; 
        
        let rowsHtml = `
            <table class="print-sub-table">
                <thead>
                    <tr>
                        <th>Payment No</th>
                        <th>Date Paid</th>
                        <th>Cheque No</th>
                        <th class="num">Certified Amount (QAR)</th>
                        <th class="num" style="color:#ea580c !important;">Retention (QAR)</th>
                        <th class="num">Payment (QAR)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        fbRecords.forEach(rec => {
            const payNo = rec.paymentNo || '-';
            const dPaid = formatToDDMMMYYYY(rec.datePaid || '-');
            const chq = rec.chequeNo || '-';
            const certAmt = parseFloat(rec.certifiedAmount || 0);
            const payAmt = parseFloat(rec.payment || 0);
            const retAmt = parseFloat(rec.retention || 0); 
            
            poTotalCertified += certAmt; poTotalPayment += payAmt; poTotalRetention += retAmt;
            
            rowsHtml += `
                <tr>
                    <td><strong>${payNo}</strong></td>
                    <td>${dPaid}</td>
                    <td>${chq}</td>
                    <td class="num">${certAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td class="num" style="color:#ea580c !important; font-weight:bold;">${retAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td class="num">${payAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                </tr>
            `;
        });
        
        rowsHtml += `
            <tr style="background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <td colspan="3" style="text-align: right; font-weight: 800; font-size: 10px; color: #0f172a !important;">TOTALS:</td>
                <td class="num" style="font-weight: 800; font-size: 11px; color: #0f172a !important;">${poTotalCertified.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="color:#ea580c !important; font-weight: 800; font-size: 11px;">${poTotalRetention.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="num" style="font-weight: 800; font-size: 11px; color: #0f172a !important;">${poTotalPayment.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
        </tbody>
        </table>`;

        let poCommittedCost = invAmt - poTotalCertified;
        let poRetentionToDate = poTotalCertified - poTotalPayment;

        let summaryCardHtml = `
            <div style="border: 3px solid #003A5C !important; border-radius: 8px; display: flex; background-color: #fff; overflow: hidden; page-break-inside: avoid; align-items: center;">
                <div style="flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1;">
                    <div style="color: #475569 !important; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">PO Value</div>
                    <div style="font-weight: 900; font-size: 13px; color: #0f172a !important;">QAR ${invAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div style="flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1;">
                    <div style="color: #475569 !important; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Total Certified Cost</div>
                    <div style="font-weight: 900; font-size: 13px; color: #0f172a !important;">QAR ${poTotalCertified.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div style="flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1;">
                    <div style="color: #475569 !important; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Total Prev. Payment</div>
                    <div style="font-weight: 900; font-size: 13px; color: #0f172a !important;">QAR ${poTotalPayment.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div style="flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1;">
                    <div style="color: #475569 !important; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Total Committed Cost</div>
                    <div style="font-weight: 900; font-size: 13px; color: #0369a1 !important;">QAR ${poCommittedCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div style="flex: 1; padding: 10px 12px;">
                    <div style="color: #475569 !important; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Total Retention To Date</div>
                    <div style="font-weight: 900; font-size: 13px; color: #ea580c !important;">QAR ${poRetentionToDate.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
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
            <div style="height: 30px;"></div>
        `;
    });

    if (validRecordsCount === 0) { playAudio(soundError); alert("No Firebase Payment records found for POs in this search."); return; }
    
    const printTime = `${formatToDDMMMYYYY(new Date())} ${new Date().toLocaleTimeString()}`;

    const printHtml = `
        <div class="print-header">
            <h2>Detailed Retention Report</h2>
            <p>Generated on: ${printTime} &nbsp; | &nbsp; POs with Records: ${validRecordsCount}</p>
            ${getActiveFiltersHtml()}
        </div>
        <div>${htmlContent}</div>
    `;
    
    document.getElementById("printArea").innerHTML = printHtml;
    window.print();
}

// =========================================================
// AUTO-FILL PO FROM INVOICE SYSTEM (Retention Button)
// Reads sessionStorage set by ibaport.site main app
// =========================================================
(function() {
    const savedPO = sessionStorage.getItem('epicore_search_po');
    
    if (savedPO) {
        // Clear it so it doesn't trigger on normal reloads
        sessionStorage.removeItem('epicore_search_po');
        
        // Wait for the page to fully initialize
        const tryFill = setInterval(() => {
            const searchInput = document.getElementById('searchInput');
            const searchBtn = document.getElementById('executeSearchBtn');
            
            // Check if data is loaded (the filters row is visible)
            const filtersRow = document.getElementById('filtersRow');
            const isReady = filtersRow && !filtersRow.classList.contains('hidden');
            
            if (searchInput && isReady) {
                // Fill the PO number
                searchInput.value = savedPO;
                
                // Trigger input event so any listeners detect the change
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Auto-click the Search button after a short delay
                if (searchBtn) {
                    setTimeout(() => {
                        searchBtn.click();
                    }, 500);
                }
                
                clearInterval(tryFill);
            }
        }, 300);
        
        // Stop trying after 10 seconds
        setTimeout(() => clearInterval(tryFill), 10000);
    }
})();