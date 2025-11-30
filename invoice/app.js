// --- ADD THIS LINE AT THE VERY TOP OF APP.JS ---
const APP_VERSION = "4.1.3"; 

// ==========================================================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================================================

// Main DB for approvers, job_entries, project_sites
const firebaseConfig = {
  apiKey: "AIzaSyBCHiQsjqhEUVZN9KhhckSqkw8vVT9LcXc",
  authDomain: "ibainvoice-3ea51.firebaseapp.com",
  databaseURL: "https://ibainvoice-3ea51-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ibainvoice-3ea51",
  storageBucket: "ibainvoice-3ea51.firebasestorage.app",
  messagingSenderId: "152429622957",
  appId: "1:152429622957:web:f79a80df75ce662e97b824",
  measurementId: "G-KR3KDQ3NRC"
};

// Initialize Main App and Services
const mainApp = firebase.initializeApp(firebaseConfig); 
const db = firebase.database();
const mainStorage = firebase.storage(mainApp); // Initialized Storage for CSV fetching

// Payments DB (For Finance Report)
const paymentFirebaseConfig = {
  apiKey: "AIzaSyAt0fLWcfgGAWV4yiu4mfhc3xQ5ycolgnU",
  authDomain: "payment-report-23bda.firebaseapp.com",
  databaseURL: "https://payment-report-23bda-default-rtdb.firebaseio.com",
  projectId: "payment-report-23bda",
  storageBucket: "payment-report-23bda.firebasestorage.app",
  messagingSenderId: "575646169000",
  appId: "1:575646169000:web:e79a80df75ce662e97b824",
  measurementId: "G-X4WBLDGLHQ"
};
const paymentApp = firebase.initializeApp(paymentFirebaseConfig, 'paymentReport');
const paymentDb = paymentApp.database();

// Invoice DB
const invoiceFirebaseConfig = {
  apiKey: "AIzaSyB5_CCTk-dvr_Lsv0K2ScPwHJkkCY7VoAM",
  authDomain: "invoiceentry-b15a8.firebaseapp.com",
  databaseURL: "https://invoiceentry-b15a8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "invoiceentry-b15a8",
  storageBucket: "invoiceentry-b15a8.firebasestorage.app",
  messagingSenderId: "916998429537",
  appId: "1:916998429537:web:6f4635d6d6e1cb98bb0320",
  measurementId: "G-R409J22B97"
};
const invoiceApp = firebase.initializeApp(invoiceFirebaseConfig, 'invoiceEntry');
const invoiceDb = invoiceApp.database();
const storage = firebase.storage(invoiceApp); 

// ==========================================================================
// 2. GLOBAL CONSTANTS & STATE VARIABLES
// ==========================================================================

const ATTACHMENT_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/Attachments/";
const PDF_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/INVOICE/";
const SRV_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/SRV/";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours cache

// -- State Variables --
let currentApprover = null; 
let dateTimeInterval = null; 
let workdeskDateTimeInterval = null;
let imDateTimeInterval = null;
let activeTaskAutoRefreshInterval = null;

// -- Dropdown Choices Instances --
let siteSelectChoices = null; 
let attentionSelectChoices = null;
let imAttentionSelectChoices = null;
let imBatchGlobalAttentionChoices = null; 
let imBatchNoteSearchChoices = null; 
let modifyTaskAttentionChoices = null; 

// -- Data Containers --
let currentlyEditingKey = null; 
let currentlyEditingInvoiceKey = null;
let currentPO = null;

let allJobEntries = []; 
let userJobEntries = [];
let userActiveTasks = [];
let allAdminCalendarTasks = [];
let ceoProcessedTasks = []; 
let allSystemEntries = [];
let navigationContextList = []; 
let navigationContextIndex = -1;
let currentPOInvoices = {};
let currentReportData = [];
let invoicesToPay = {}; 
let imFinanceAllPaymentsData = {};

// -- Filters & UI State --
let currentReportFilter = 'All';
let currentActiveTaskFilter = 'All'; 
let wdCurrentCalendarDate = new Date();
let isYearView = false;
let wdCurrentDayViewDate = null; 
let imStatusBarChart = null; 
let imYearlyChart = null; 

// -- Cache Variables --
let approverListForSelect = [];
let allUniqueNotes = new Set();
let allEcostData = null;
let ecostDataTimestamp = 0;
let allPOData = null;
let allPODataByRef = null;
let allInvoiceData = null;
let allApproverData = null;
let allEpicoreData = null; 
let allSitesCSVData = null; 
let allEcommitDataProcessed = null; 
let allApproversCache = null;
let allSitesCache = null;
let allApproverDataCache = null; 
let allVendorsData = null; // New Cache for Vendors.csv

// -- Workdesk <-> IM Context --
let jobEntryToUpdateAfterInvoice = null;
let pendingJobEntryDataForInvoice = null;

let cacheTimestamps = {
  poData: 0,
  invoiceData: 0,
  approverData: 0,
  systemEntries: 0,
  epicoreData: 0, 
  sitesCSV: 0 
};

// ==========================================================================
// 3. DATA FETCHING & CACHING LOGIC
// ==========================================================================

function setCache(key, data) {
    try {
        const item = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(item));
        console.log(`Saved data to localStorage cache: ${key}`);
    } catch (error) {
        console.error(`Error saving to localStorage ${key}:`, error);
        console.warn(`Could not cache ${key}. File may be too large for localStorage.`);
    }
}

function getCache(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    try {
        const item = JSON.parse(itemStr);
        const isStale = (Date.now() - item.timestamp) > CACHE_DURATION;
        return { data: item.data, isStale: isStale };
    } catch (error) {
        console.error(`Error parsing cache ${key}:`, error);
        localStorage.removeItem(key); 
        return null;
    }
}

function loadDataFromLocalStorage() {
    const epicoreCache = getCache('cached_EPICORE');
    const sitesCache = getCache('cached_SITES');

    if (epicoreCache) {
        allEpicoreData = epicoreCache.data;
        cacheTimestamps.epicoreData = epicoreCache.isStale ? 0 : Date.now();
    }
    if (sitesCache) {
        allSitesCSVData = sitesCache.data;
        cacheTimestamps.sitesCSV = sitesCache.isStale ? 0 : Date.now();
    }
    
    if (allEpicoreData && allSitesCSVData) return true;
    return false;
}

// NEW HELPER: Get URL from Firebase Storage
async function getFirebaseCSVUrl(filename) {
    // This Base URL points to your specific GitHub repository via a fast CDN
    const baseUrl = "https://cdn.jsdelivr.net/gh/DC-database/Hub@main/";
    
    // This automatically combines the base URL with whatever filename is requested
    // Example: baseUrl + 'POVALUE2.csv'
    return `${baseUrl}${filename}`;
}

async function silentlyRefreshStaleCaches() {
    console.log("Checking for stale background caches...");
    const now = Date.now();

    try {
        if (cacheTimestamps.epicoreData === 0) {
            console.log("Silently refreshing Ecost.csv...");
            const url = await getFirebaseCSVUrl('Ecost.csv');
            if (url) {
                const epicoreCsvData = await fetchAndParseEpicoreCSV(url);
                if (epicoreCsvData) {
                    allEpicoreData = epicoreCsvData;
                    setCache('cached_EPICORE', allEpicoreData);
                    cacheTimestamps.epicoreData = now;
                }
            }
        }
        if (cacheTimestamps.sitesCSV === 0) {
            console.log("Silently refreshing Site.csv...");
            const url = await getFirebaseCSVUrl('Site.csv');
            if (url) {
                const sitesCsvData = await fetchAndParseSitesCSV(url);
                if (sitesCsvData) {
                    allSitesCSVData = sitesCsvData;
                    setCache('cached_SITES', allSitesCSVData);
                    cacheTimestamps.sitesCSV = now;
                }
            }
        }
        console.log("Background cache check complete.");
    } catch (error) {
        console.warn("Silent background cache refresh failed:", error.message);
    }
}

// --- CSV Parsers ---

async function fetchAndParseCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { throw new Error(`Failed to fetch CSV: ${response.statusText}`); }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { throw new Error("CSV is empty or has no data rows."); }
        
        const parseCsvRow = (rowStr) => {
            const values = []; let inQuote = false; let currentVal = ''; const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) { inQuote = !inQuote; } else if (char === ',' && !inQuote) { values.push(currentVal.trim()); currentVal = ''; } else { currentVal += char; }
            }
            values.push(currentVal.trim());
            return values.map(v => v.replace(/^"|"$/g, ''));
        };

        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        let poHeaderIndex = headers.findIndex(h => h.toLowerCase() === 'po number' || h.toLowerCase() === 'po' || h.toLowerCase() === 'po_number');
        if (poHeaderIndex === -1) { poHeaderIndex = 1; } 

        let refHeaderIndex = headers.findIndex(h => h.toLowerCase() === 'reqnum'); 
        if (refHeaderIndex === -1) { refHeaderIndex = 0; } 

        const poDataByPO = {}; 
        const poDataByRef = {}; 

        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length !== headers.length) { console.warn(`Skipping malformed CSV row: ${lines[i]}`); continue; }

            const poKey = values[poHeaderIndex].toUpperCase();
            const refKey = values[refHeaderIndex]; 

            const poEntry = {};
            headers.forEach((header, index) => {
                if (header.toLowerCase() === 'amount') { poEntry[header] = values[index].replace(/,/g, '') || '0'; } else { poEntry[header] = values[index]; }
            });

            if (poKey) poDataByPO[poKey] = poEntry;
            if (refKey) poDataByRef[refKey] = poEntry;
        }
        console.log(`Successfully parsed ${Object.keys(poDataByPO).length} POs and ${Object.keys(poDataByRef).length} Refs.`);
        return { poDataByPO, poDataByRef };
    } catch (error) { console.error("Error fetching or parsing PO CSV:", error); alert("CRITICAL ERROR: Could not load Purchase Order data."); return null; }
}

async function fetchAndParseEpicoreCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { throw new Error(`Failed to fetch CSV: ${response.statusText}`); }
        const csvText = await response.text();
        
        const parseCsvRow = (rowStr) => {
            const values = []; let inQuote = false; let currentVal = ''; const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) { inQuote = !inQuote; } else if (char === ',' && !inQuote) { values.push(currentVal.trim().replace(/^"|"$/g, '')); currentVal = ''; } else { currentVal += char; }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };

        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 1) { throw new Error("Epicore CSV is empty."); }
        
        const epicoreMap = {};
        for (let i = 0; i < lines.length; i++) { 
            const values = parseCsvRow(lines[i]);
            
            // Column Mapping (0-based index):
            // A[0], B[1], C[2]=PO, D[3]=Project#, E[4]=Description
            
            if (values.length > 4) { 
                const poKey = values[2] ? values[2].toUpperCase().trim() : null; 
                const description = values[4] || ''; // Grab Column E
                
                if (poKey) { epicoreMap[poKey] = description; }
            }
        }
        console.log(`Successfully fetched and parsed ${Object.keys(epicoreMap).length} entries from Epicore CSV.`);
        return epicoreMap;
    } catch (error) { console.error("Error fetching or parsing Epicore CSV:", error); alert("CRITICAL ERROR: Could not load Epicore data."); return null; }
}

async function fetchAndParseSitesCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { throw new Error(`Failed to fetch Sites CSV: ${response.statusText}`); }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { throw new Error("Site.csv is empty or has no data rows."); }
        const parseCsvRow = (rowStr) => {
            const values = []; let inQuote = false; let currentVal = ''; const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) { inQuote = !inQuote; } else if (char === ',' && !inQuote) { values.push(currentVal.trim().replace(/^"|"$/g, '')); currentVal = ''; } else { currentVal += char; }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };
        const headers = parseCsvRow(lines[0]).map(h => h.trim().toLowerCase());
        let siteIndex = headers.indexOf('site');
        let descIndex = headers.indexOf('description');
        if (siteIndex === -1) siteIndex = 0;
        if (descIndex === -1) descIndex = 1;
        const sitesData = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length >= Math.max(siteIndex, descIndex)) {
                const site = values[siteIndex];
                const description = values[descIndex];
                if (site && description) { sitesData.push({ site, description }); }
            }
        }
        console.log(`Successfully fetched and parsed ${sitesData.length} sites from Site.csv.`);
        return sitesData;
    } catch (error) { console.error("Error fetching or parsing Site.csv:", error); alert("CRITICAL ERROR: Could not load Site data."); return null; }
}

async function fetchAndParseEcommitCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { throw new Error(`Failed to fetch CSV: ${response.statusText}`); }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { throw new Error("Ecommit CSV is empty or has no data rows."); }
        
        const parseCsvRow = (rowStr) => {
            const values = []; let inQuote = false; let currentVal = ''; const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) { inQuote = !inQuote; } else if (char === ',' && !inQuote) { values.push(currentVal.trim().replace(/^"|"$/g, '')); currentVal = ''; } else { currentVal += char; }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values.map(v => v.replace(/^"|"$/g, ''));
        };

        const cleanInvoiceNumber = (str) => {
            if (!str) return '';
            let cleanStr = str.trim().replace(/^"|"$/g, '');
            if (cleanStr.toUpperCase().includes('E+')) {
                try {
                    const num = Number(cleanStr);
                    if (!isNaN(num)) { return num.toLocaleString('fullwide', { useGrouping: false }); }
                } catch (e) { return cleanStr; }
            }
            return cleanStr;
        };

        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        const headerMap = {};
        headers.forEach((h, i) => { headerMap[h] = i; });

        const requiredHeaders = ['PO', 'Whse', 'Date', 'Sys Date', 'Name', 'Packing Slip', 'Extended Cost'];
        if (!requiredHeaders.every(h => headerMap.hasOwnProperty(h))) {
            throw new Error("Ecommit CSV is missing required headers.");
        }

        const poMap = {}; 
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length < headers.length) continue;

            const po = values[headerMap['PO']]?.toUpperCase().trim();
            if (!po) continue;

            const extendedCost = parseFloat(values[headerMap['Extended Cost']]?.replace(/,/g, '') || 0);
            const rawPackingSlip = values[headerMap['Packing Slip']] || '';
            const fixedPackingSlip = cleanInvoiceNumber(rawPackingSlip);

            const record = {
                po: po,
                site: values[headerMap['Whse']] || '',
                date: values[headerMap['Date']] || '',
                sysDate: values[headerMap['Sys Date']] || '', 
                supplierName: values[headerMap['Name']] || '',
                packingSlip: fixedPackingSlip, 
                invValue: extendedCost, 
                rawDate: values[headerMap['Date']] 
            };
            if (!poMap[po]) poMap[po] = [];
            poMap[po].push(record);
        }
        
        const finalEcommitData = {};
        Object.keys(poMap).forEach(po => {
            const recordsForPO = poMap[po];
            const summedRecords = new Map();

            recordsForPO.forEach(record => {
                const key = record.packingSlip;
                if (!key) return; 

                if (summedRecords.has(key)) {
                    const existing = summedRecords.get(key);
                    existing.invValue = existing.invValue + record.invValue;
                    
                    const existingDate = new Date(existing.rawDate);
                    const newDate = new Date(record.rawDate);
                    if (newDate < existingDate) {
                        existing.rawDate = record.rawDate;
                        existing.date = record.date;
                        existing.sysDate = record.sysDate; 
                    }
                } else {
                    summedRecords.set(key, { ...record }); 
                }
            });

            const poRecords = Array.from(summedRecords.values());
            poRecords.sort((a, b) => {
                const dateA = new Date(a.rawDate);
                const dateB = new Date(b.rawDate);
                if (dateA - dateB !== 0) return dateA - dateB;
                return a.packingSlip.localeCompare(b.packingSlip);
            });

            const formattedRecords = [];
            poRecords.forEach((record, index) => {
                formattedRecords.push({
                    invNumber: record.packingSlip, 
                    invoiceDate: normalizeDateForInput(record.date),
                    releaseDate: normalizeDateForInput(record.sysDate), 
                    invValue: record.invValue.toFixed(2), 
                    amountPaid: record.invValue.toFixed(2), 
                    status: 'Epicore Value',
                    source: 'ecommit',
                    key: `ecommit_${record.packingSlip}` 
                });
            });
            finalEcommitData[po] = formattedRecords; 
        });

        console.log(`Successfully processed ${Object.keys(finalEcommitData).length} POs from Ecommit.csv.`);
        return finalEcommitData;
    } catch (error) { 
        console.error("Error fetching or parsing Ecommit CSV:", error); 
        alert("CRITICAL ERROR: Could not load Ecommit data."); 
        return null; 
    }
}
async function fetchAndParseEcostCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { throw new Error(`Failed to fetch Ecost CSV: ${response.statusText}`); }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { throw new Error("Ecost CSV is empty or has no data rows."); }

        const parseCsvRow = (rowStr) => {
            const values = []; let inQuote = false; let currentVal = ''; const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) { inQuote = !inQuote; } else if (char === ',' && !inQuote) { values.push(currentVal.trim().replace(/^"|"$/g, '')); currentVal = ''; } else { currentVal += char; }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };

        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        const headerMap = {};
        headers.forEach((h, i) => { headerMap[h] = i; });

        const requiredHeaders = ['Order Date', 'Project #', 'Name', 'Line Amount', 'Delivered Amount', 'Outstanding', 'Activity Name'];
        for (const h of requiredHeaders) {
            if (typeof headerMap[h] === 'undefined') { console.warn(`Ecost CSV is missing expected header: ${h}`); }
        }
        
        const dateIndex = headerMap['Order Date'];
        const projectIndex = headerMap['Project #'];
        const vendorIndex = headerMap['Name'];
        const lineAmountIndex = headerMap['Line Amount'];
        const deliveredIndex = headerMap['Delivered Amount'];
        const outstandingIndex = headerMap['Outstanding'];
        const activityIndex = headerMap['Activity Name'];

        const processedData = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length < headers.length) continue;

            const orderDateStr = values[dateIndex];
            let orderDate = null; let year = null; let month = null;

            if (orderDateStr && orderDateStr.includes('-')) {
                const parts = orderDateStr.split('-'); 
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const monthIndex = parseInt(parts[1], 10) - 1; 
                    let fullYear = parseInt(parts[2], 10);
                    if (fullYear < 100) { fullYear += 2000; }
                    orderDate = new Date(Date.UTC(fullYear, monthIndex, day)); 
                }
            }
            if (!orderDate || isNaN(orderDate)) { orderDate = new Date(orderDateStr); }
            
            if (orderDate && !isNaN(orderDate)) {
                const now = new Date();
                if (orderDate > now) { continue; }
                year = orderDate.getFullYear();
                month = orderDate.getMonth(); 
            } else { continue; }

            processedData.push({
                'Order Date': orderDate,
                'Year': year,
                'Month': month,
                'Project #': values[projectIndex],
                'Vendor': values[vendorIndex], 
                'Total Committed': parseFloat(values[lineAmountIndex].replace(/,/g, '')) || 0, 
                'Delivered Amount': parseFloat(values[deliveredIndex].replace(/,/g, '')) || 0, 
                'Outstanding': parseFloat(values[outstandingIndex].replace(/,/g, '')) || 0, 
                'Activity Name': values[activityIndex]
            });
        }
        console.log(`Successfully parsed ${processedData.length} rows from Ecost.csv`);
        return processedData;
    } catch (error) {
        console.error("Error fetching or parsing Ecost CSV:", error);
        alert(`CRITICAL ERROR: Could not load dashboard data. ${error.message}`);
        return null;
    }
}

// --- Data fetch controllers (Updated to use Firebase) ---

async function ensureEcostDataFetched(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && allEcostData && (now - ecostDataTimestamp < CACHE_DURATION)) {
        return allEcostData;
    }
    console.log("Fetching Ecost.csv data from Firebase...");
    const url = await getFirebaseCSVUrl('Ecost.csv');
    if (!url) return null;

    allEcostData = await fetchAndParseEcostCSV(url);
    if (allEcostData) {
        ecostDataTimestamp = now;
        console.log("Ecost.csv data cached.");
    }
    return allEcostData;
}

async function ensureInvoiceDataFetched(forceRefresh = false) {
    const now = Date.now();

    // Check if everything is already loaded (including new vendors data)
    if (!forceRefresh && allPOData && allInvoiceData && allEpicoreData && allSitesCSVData && allEcommitDataProcessed && allVendorsData) {
        return; 
    }

    if (!forceRefresh) {
        loadDataFromLocalStorage(); 
    }

    try {
        const promisesToRun = [];
        
        // Get URLs from Firebase Storage
        const poUrl = (!allPOData || forceRefresh) ? await getFirebaseCSVUrl('POVALUE2.csv') : null;
        const ecostUrl = (!allEpicoreData || forceRefresh) ? await getFirebaseCSVUrl('Ecost.csv') : null;
        const siteUrl = (!allSitesCSVData || forceRefresh) ? await getFirebaseCSVUrl('Site.csv') : null;
        const ecommitUrl = (!allEcommitDataProcessed || forceRefresh) ? await getFirebaseCSVUrl('ECommit.csv') : null;
        
        // --- NEW: Get Vendors URL ---
        const vendorUrl = (!allVendorsData || forceRefresh) ? await getFirebaseCSVUrl('Vendors.csv') : null;

        if (poUrl) {
            console.log("Fetching POVALUE2.csv...");
            promisesToRun.push(fetchAndParseCSV(poUrl));
        }
        if (ecostUrl) {
            console.log("Fetching Ecost.csv...");
            promisesToRun.push(fetchAndParseEpicoreCSV(ecostUrl));
        }
        if (siteUrl) {
            console.log("Fetching Site.csv...");
            promisesToRun.push(fetchAndParseSitesCSV(siteUrl));
        }
        if (ecommitUrl) {
            console.log("Fetching ECommit.csv...");
            promisesToRun.push(fetchAndParseEcommitCSV(ecommitUrl));
        }
        
        // --- NEW: Fetch Vendors ---
        if (vendorUrl) {
            console.log("Fetching Vendors.csv...");
            promisesToRun.push(fetchAndParseVendorsCSV(vendorUrl));
        }

        if (!allInvoiceData || forceRefresh) {
            console.log("Fetching Firebase invoice data...");
            promisesToRun.push(invoiceDb.ref('invoice_entries').once('value'));
        }

        const results = await Promise.all(promisesToRun);
        let resultIndex = 0;

        if (poUrl) {
            const csvData = results[resultIndex++];
            if (csvData === null) throw new Error("Failed to load POVALUE2.csv");
            
            allPOData = csvData.poDataByPO;
            allPODataByRef = csvData.poDataByRef; // <--- ADD THIS LINE
            
            cacheTimestamps.poData = now;
        }
        if (ecostUrl) {
            allEpicoreData = results[resultIndex++];
            if (allEpicoreData === null) throw new Error("Failed to load Ecost.csv");
            setCache('cached_EPICORE', allEpicoreData); 
            cacheTimestamps.epicoreData = now;
        }
        if (siteUrl) {
            allSitesCSVData = results[resultIndex++];
            if (allSitesCSVData === null) throw new Error("Failed to load Site.csv");
            setCache('cached_SITES', allSitesCSVData); 
            cacheTimestamps.sitesCSV = now;
        }
        if (ecommitUrl) {
            allEcommitDataProcessed = results[resultIndex++];
            if (allEcommitDataProcessed === null) throw new Error("Failed to load ECommit.csv");
            cacheTimestamps.ecommitData = now;
        }
        
        // --- NEW: Handle Vendors Result ---
        if (vendorUrl) {
            allVendorsData = results[resultIndex++];
            // Ensure it is at least an empty object if fetch failed gracefully
            if (!allVendorsData) allVendorsData = {};
        }

        if (!allInvoiceData || forceRefresh) {
            const invoiceSnapshot = results[resultIndex++];
            allInvoiceData = invoiceSnapshot.val() || {};
            cacheTimestamps.invoiceData = now;
            
            allUniqueNotes = new Set();
            for (const po in allInvoiceData) {
                for (const invKey in allInvoiceData[po]) {
                    const invoice = allInvoiceData[po][invKey];
                    if (invoice.note && invoice.note.trim() !== '') {
                        allUniqueNotes.add(invoice.note.trim());
                    }
                }
            }
        }
    } catch (error) {
        console.error("CRITICAL: Failed to fetch required data:", error);
        alert("CRITICAL ERROR: Failed to download required data files. Please check your internet connection and try again.");
        throw error;
    }
}

// ==========================================================================
// UPDATED FUNCTION: ensureAllEntriesFetched (With Usage Data Formatting)
// ==========================================================================
async function ensureAllEntriesFetched(forceRefresh = false) {
    const now = Date.now();
    
    // 1. Ensure PO Data is loaded first
    if (!allPOData || forceRefresh) {
        try {
            const poUrl = await getFirebaseCSVUrl('POVALUE2.csv');
            if (poUrl) {
                const { poDataByPO } = await fetchAndParseCSV(poUrl) || {};
                if (poDataByPO) allPOData = poDataByPO;
            }
        } catch (error) { console.error("PO Load Error", error); }
    }
    
    console.log("Fetching Job & Transfer entries...");

    const [jobEntriesSnapshot, transferSnapshot] = await Promise.all([
        db.ref('job_entries').orderByChild('timestamp').once('value'),
        db.ref('transfer_entries').orderByChild('timestamp').once('value')
    ]);

    const jobEntriesData = jobEntriesSnapshot.val() || {};
    const transferData = transferSnapshot.val() || {};
    
    const processedEntries = [];

    // 3. PROCESS STANDARD JOB ENTRIES
    Object.entries(jobEntriesData).forEach(([key, value]) => {
        let entry = { key, ...value, source: 'job_entry' };
        if (!entry.vendorName && entry.po && allPOData && allPOData[entry.po]) {
            entry.vendorName = allPOData[entry.po]['Supplier Name'] || 'N/A';
        }
        processedEntries.push(entry);
    });

  // 4. PROCESS TRANSFER ENTRIES
    Object.entries(transferData).forEach(([key, value]) => {
        
        const from = value.fromLocation || value.fromSite || 'N/A';
        const to = value.toLocation || value.toSite || 'N/A';
        
        // --- FIX: Better Site Display for Usage ---
        let combinedSite = `${from} ➜ ${to}`;
        if (value.jobType === 'Usage') {
            combinedSite = `Used at ${from}`;
        }
        // ------------------------------------------

        // Determine Contact based on Stage
        let contactPerson = value.receiver || 'N/A';
        if(value.remarks === 'Pending') contactPerson = value.approver;

        processedEntries.push({
            key,
            ...value, 
            source: 'transfer_entry',
            productID: value.productID || '',
            jobType: value.jobType || 'Transfer',
            for: value.jobType || 'Transfer', 
            
            ref: value.controlNumber, 
            controlId: value.controlNumber,
            site: combinedSite, // Uses the cleaner display
            orderedQty: value.requiredQty || 0, 
            deliveredQty: value.receivedQty || 0, 
            shippingDate: value.shippingDate || 'N/A',
            arrivalDate: value.arrivalDate || 'N/A',
            contactName: contactPerson,
            vendorName: value.productName, 
            remarks: value.remarks || value.status || 'Pending'
        });
    });

    allSystemEntries = processedEntries; 
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    console.log(`Entries loaded: ${allSystemEntries.length}`);
}

   
async function ensureApproverDataCached() {
    if (allApproverDataCache) return; 
    const snapshot = await db.ref('approvers').once('value');
    allApproverDataCache = snapshot.val() || {};
    console.log("Approver data cached for position-matching.");
}

function updateLocalInvoiceCache(poNumber, invoiceKey, updatedData) {
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        allInvoiceData[poNumber][invoiceKey] = {
            ...allInvoiceData[poNumber][invoiceKey],
            ...updatedData
        };
    }
}
function addToLocalInvoiceCache(poNumber, newInvoiceData, newKey) { 
    if (!allInvoiceData) allInvoiceData = {};
    if (!allInvoiceData[poNumber]) {
        allInvoiceData[poNumber] = {};
    }
    if (newKey) { 
       allInvoiceData[poNumber][newKey] = newInvoiceData;
    } else {
        console.warn("Attempted to add to cache without a valid key:", poNumber, newInvoiceData);
    }
}
function removeFromLocalInvoiceCache(poNumber, invoiceKey) {
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        delete allInvoiceData[poNumber][invoiceKey];
    }
}

async function fetchAndParseVendorsCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error("Failed to fetch Vendors CSV");
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        
        const vendorMap = {}; // Key: Supplier ID, Value: Vendor Name
        
        // Assuming Header is Row 0: Name,Supplier ID
        for (let i = 1; i < lines.length; i++) {
            // Simple comma split (assuming no commas IN the names for now, or use complex parser if needed)
            const parts = lines[i].split(','); 
            if (parts.length >= 2) {
                // Assuming Column 0 = Name, Column 1 = ID
                // Clean up quotes if present
                const name = parts[0].replace(/^"|"$/g, '').trim();
                const id = parts[1].replace(/^"|"$/g, '').trim();
                if (id && name) {
                    vendorMap[id] = name;
                }
            }
        }
        console.log(`Cached ${Object.keys(vendorMap).length} vendors.`);
        return vendorMap;
    } catch (error) {
        console.error("Error parsing Vendors.csv:", error);
        return {};
    }
}

// ==========================================================================
// 4. GENERAL HELPER FUNCTIONS
// ==========================================================================

function normalizeMobile(mobile) { const digitsOnly = mobile.replace(/\D/g, ''); if (digitsOnly.length === 8) { return `974${digitsOnly}`; } return digitsOnly; }
function formatDate(date) { const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const day = String(date.getDate()).padStart(2, '0'); const month = months[date.getMonth()]; const year = date.getFullYear(); return `${day}-${month}-${year}`; }
function formatYYYYMMDD(dateString) { 
    if (!dateString) return 'N/A';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const parts = dateString.split('-'); 
    if (parts.length !== 3) return dateString; 
    
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1; 
    const day = parts[2];
    
    const month = months[monthIndex];
    if (!month) return dateString; 
    
    return `${day}-${month}-${year}`; 
}
function normalizeDateForInput(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) { return dateString; }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) { const parts = dateString.split('/'); const day = parts[0].padStart(2, '0'); const month = parts[1].padStart(2, '0'); const year = parts[2]; return `${year}-${month}-${day}`; }
    if (/^\d{2}-\d{2}-\d{2}$/.test(dateString)) { const parts = dateString.split('-'); const day = parts[0]; const month = parts[1]; const year = `20${parts[2]}`; return `${year}-${month}-${day}`; }
    const date = new Date(dateString);
    if (!isNaN(date)) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
    console.warn("Unrecognized date format:", dateString);
    return '';
}
function convertDisplayDateToInput(displayDate) {
    if (!displayDate || typeof displayDate !== 'string') return '';
    const parts = displayDate.split('-');
    if (parts.length !== 3) return '';
    const day = parts[0]; const year = parts[2];
    const monthMap = { "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12" };
    const month = monthMap[parts[1]];
    if (!month) return '';
    return `${year}-${month}-${day}`;
}
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function formatCurrency(value) {
    if (typeof value === 'number') {
         return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) { return 'N/A'; }
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatFinanceNumber(value) {
  if (value === undefined || value === null || value === '') return '';
  const num = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(num) ? value : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatFinanceDate(dateStr) {
  if (!dateStr || String(dateStr).trim() === '') return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) { return dateStr; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; 
      const day = parseInt(parts[2], 10);
      const utcDate = new Date(Date.UTC(year, month, day));
      
      const dayFormatted = utcDate.getUTCDate().toString().padStart(2, '0');
      const monthFormatted = utcDate.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
      const yearFormatted = utcDate.getUTCFullYear();
      return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
  }
  const dayFormatted = date.getUTCDate().toString().padStart(2, '0');
  const monthFormatted = date.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const yearFormatted = date.getUTCFullYear();
  return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
}
function formatFinanceDateLong(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
function numberToWords(num) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const s = ['', 'Thousand', 'Million', 'Billion'];
    const number = parseFloat(num).toFixed(2);
    const [integerPart, fractionalPart] = number.split('.');
    function toWords(n) { if (n < 20) return a[n]; let digit = n % 10; return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : ''); }
    function convert(nStr) {
        if (nStr === '0') return 'Zero';
        let words = ''; let i = nStr.length;
        while (i > 0) {
            let chunk = nStr.substring(Math.max(0, i - 3), i);
            if (chunk !== '000') { let num = parseInt(chunk); words = (chunk.length === 3 && num < 100 ? 'and ' : '') + toWords(num % 100) + (num > 99 ? ' Hundred' + (num % 100 ? ' and ' : '') : '') + ' ' + s[(nStr.length - i) / 3] + ' ' + words; }
            i -= 3;
        }
        return words.trim().replace(/\s+/g, ' ');
    }
    let words = convert(integerPart);
    if (fractionalPart && parseInt(fractionalPart) > 0) { words += ' and ' + parseInt(fractionalPart) + '/100'; }
    return words.charAt(0).toUpperCase() + words.slice(1) + " Qatari Riyals Only";
}
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
function updateDashboardDateTime() {}
function updateWorkdeskDateTime() {}
function updateIMDateTime() {}

// ==========================================================================
// 5. DOM ELEMENT REFERENCES
// ==========================================================================

// --- Main Views ---
const views = { 
    login: document.getElementById('login-view'), 
    password: document.getElementById('password-view'), 
    setup: document.getElementById('setup-view'), 
    dashboard: document.getElementById('dashboard-view'), 
    workdesk: document.getElementById('workdesk-view') 
};

// --- Login & Setup Forms ---
const loginForm = document.getElementById('login-form'); 
const loginIdentifierInput = document.getElementById('login-identifier'); 
const loginError = document.getElementById('login-error');
const passwordForm = document.getElementById('password-form'); 
const passwordInput = document.getElementById('login-password'); 
const passwordUserIdentifier = document.getElementById('password-user-identifier'); 
const passwordError = document.getElementById('password-error');
const setupForm = document.getElementById('setup-form'); 
const setupEmailContainer = document.getElementById('setup-email-container'); 
const setupEmailInput = document.getElementById('setup-email'); 
const setupSiteContainer = document.getElementById('setup-site-container'); 
const setupSiteInput = document.getElementById('setup-site'); 
const setupPositionContainer = document.getElementById('setup-position-container'); 
const setupPositionInput = document.getElementById('setup-position'); 
const setupPasswordInput = document.getElementById('setup-password'); 
const setupError = document.getElementById('setup-error');

// --- Main Dashboard & Workdesk Navigation ---
const dashboardUsername = document.getElementById('dashboard-username'); 
const datetimeElement = document.getElementById('datetime'); 
const logoutButton = document.getElementById('logout-button');
const workdeskButton = document.getElementById('workdesk-button'); 
const wdUsername = document.getElementById('wd-username'); 
const wdUserIdentifier = document.getElementById('wd-user-identifier'); 
const workdeskNav = document.getElementById('workdesk-nav'); 
const workdeskSections = document.querySelectorAll('.workdesk-section'); 
const wdLogoutButton = document.getElementById('wd-logout-button');
const workdeskDatetimeElement = document.getElementById('workdesk-datetime');
const workdeskIMLinkContainer = document.getElementById('workdesk-im-link-container');
const workdeskIMLink = document.getElementById('workdesk-im-link');

// --- Workdesk: Job Entry ---
const jobEntryForm = document.getElementById('jobentry-form'); 
const jobForSelect = document.getElementById('job-for'); 
const jobDateInput = document.getElementById('job-date'); 
const jobEntrySearchInput = document.getElementById('job-entry-search'); 
const jobEntryTableWrapper = document.getElementById('job-entry-table-wrapper'); 
const jobEntryTableBody = document.getElementById('job-entry-table-body');
const jobEntryFormTitle = document.getElementById('jobentry-form-title');
const deleteJobButton = document.getElementById('delete-job-button'); 
const jobEntryNavControls = document.getElementById('jobentry-nav-controls'); 
const navPrevJobButton = document.getElementById('nav-prev-job'); 
const navNextJobButton = document.getElementById('nav-next-job'); 
const navJobCounter = document.getElementById('nav-job-counter'); 
const addJobButton = document.getElementById('add-job-button'); 
const updateJobButton = document.getElementById('update-job-button'); 
const clearJobButton = document.getElementById('clear-job-button');

// --- Workdesk: Active Tasks ---
const activeTaskTableBody = document.getElementById('active-task-table-body');
const activeTaskFilters = document.getElementById('active-task-filters');
const activeTaskSearchInput = document.getElementById('active-task-search');
const activeTaskCountDisplay = document.getElementById('active-task-count-display');
const dbActiveTasksCount = document.getElementById('db-active-tasks-count');
const activeTaskClearButton = document.getElementById('active-task-clear-button');
const activeTaskCardLink = document.getElementById('db-active-tasks-card-link'); // Dashboard card

// --- Workdesk: Calendar & Day View ---
const wdCalendarGrid = document.getElementById('wd-calendar-grid');
const wdCalendarMonthYear = document.getElementById('wd-calendar-month-year');
const wdCalendarPrevBtn = document.getElementById('wd-calendar-prev');
const wdCalendarNextBtn = document.getElementById('wd-calendar-next');
const wdCalendarTaskListTitle = document.getElementById('wd-calendar-task-list-title');
const wdCalendarTaskListUl = document.getElementById('wd-calendar-task-list-ul');
const wdCalendarToggleBtn = document.getElementById('wd-calendar-toggle-view');
const wdCalendarYearGrid = document.getElementById('wd-calendar-year-grid');
const dayViewBackBtn = document.getElementById('wd-dayview-back-btn');
const dayViewPrevBtn = document.getElementById('wd-dayview-prev-btn');
const dayViewNextBtn = document.getElementById('wd-dayview-next-btn');
const dayViewTaskList = document.getElementById('wd-dayview-task-list');
const mobileMenuBtn = document.getElementById('wd-dayview-mobile-menu-btn');
const mobileNotifyBtn = document.getElementById('wd-dayview-mobile-notify-btn');
const mobileLogoutBtn = document.getElementById('wd-dayview-mobile-logout-btn-new');
const dateScroller = document.getElementById('wd-dayview-date-scroller-inner');
const calendarModalViewTasksBtn = document.getElementById('calendar-modal-view-tasks-btn');

// --- Workdesk: Reporting & Stats ---
const reportingTableBody = document.getElementById('reporting-table-body');
const reportingSearchInput = document.getElementById('reporting-search');
const reportTabsContainer = document.getElementById('report-tabs');
const printReportButton = document.getElementById('print-report-button');
const downloadWdReportButton = document.getElementById('download-wd-report-csv-button');
const dbCompletedTasksCount = document.getElementById('db-completed-tasks-count');
const dbSiteStatsContainer = document.getElementById('dashboard-site-stats');
const dbRecentTasksBody = document.getElementById('db-recent-tasks-body');
const jobRecordsCountDisplay = document.getElementById('job-records-count-display');

// --- Workdesk: Settings ---
const settingsForm = document.getElementById('settings-form');
const settingsNameInput = document.getElementById('settings-name');
const settingsEmailInput = document.getElementById('settings-email');
const settingsMobileInput = document.getElementById('settings-mobile');
const settingsPositionInput = document.getElementById('settings-position');
const settingsSiteInput = document.getElementById('settings-site');
const settingsPasswordInput = document.getElementById('settings-password');
const settingsVacationCheckbox = document.getElementById('settings-vacation');
const settingsReturnDateInput = document.getElementById('settings-return-date');
const settingsMessage = document.getElementById('settings-message');
const settingsVacationDetailsContainer = document.getElementById('settings-vacation-details-container');
const settingsReplacementNameInput = document.getElementById('settings-replacement-name');
const settingsReplacementContactInput = document.getElementById('settings-replacement-contact');
const settingsReplacementEmailInput = document.getElementById('settings-replacement-email');

// --- Invoice Management (IM) Common ---
const invoiceManagementView = document.getElementById('invoice-management-view');
const imNav = document.getElementById('im-nav');
const imContentArea = document.getElementById('im-content-area');
const imMainElement = document.querySelector('#invoice-management-view .workdesk-main'); 
const invoiceManagementButton = document.getElementById('invoice-mgmt-button');
const imUsername = document.getElementById('im-username');
const imUserIdentifier = document.getElementById('im-user-identifier');
const imLogoutButton = document.getElementById('im-logout-button');
const imDatetimeElement = document.getElementById('im-datetime');
const imWorkdeskButton = document.getElementById('im-workdesk-button');
const imActiveTaskButton = document.getElementById('im-activetask-button');
const imBackToWDDashboardLink = document.getElementById('im-back-to-wd-dashboard-link'); // Mobile

// --- IM: Invoice Entry ---
const imPOSearchInput = document.getElementById('im-po-search-input');
const imPOSearchButton = document.getElementById('im-po-search-button');
const imPOSearchInputBottom = document.getElementById('im-po-search-input-bottom');
const imPOSearchButtonBottom = document.getElementById('im-po-search-button-bottom');
const imPODetailsContainer = document.getElementById('im-po-details-container');
const imNewInvoiceForm = document.getElementById('im-new-invoice-form');
const imInvEntryIdInput = document.getElementById('im-inv-entry-id');
const imFormTitle = document.getElementById('im-form-title');
const imAttentionSelect = document.getElementById('im-attention');
const imAddInvoiceButton = document.getElementById('im-add-invoice-button');
const imUpdateInvoiceButton = document.getElementById('im-update-invoice-button');
const imClearFormButton = document.getElementById('im-clear-form-button');
const imBackToActiveTaskButton = document.getElementById('im-back-to-active-task-button');
const imExistingInvoicesContainer = document.getElementById('im-existing-invoices-container');
const imInvoicesTableBody = document.getElementById('im-invoices-table-body');
const imInvoiceDateInput = document.getElementById('im-invoice-date');
const imReleaseDateInput = document.getElementById('im-release-date');
const imStatusSelect = document.getElementById('im-status');
const imInvValueInput = document.getElementById('im-inv-value');
const imAmountPaidInput = document.getElementById('im-amount-paid');
const existingInvoicesCountDisplay = document.getElementById('existing-invoices-count-display');
const imEntrySidebar = document.getElementById('im-entry-sidebar');
const imEntrySidebarList = document.getElementById('im-entry-sidebar-list');
const imShowActiveJobsBtn = document.getElementById('im-show-active-jobs-btn');
const activeJobsSidebarCountDisplay = document.getElementById('active-jobs-sidebar-count-display');

// --- IM: Batch Entry ---
const batchTableBody = document.getElementById('im-batch-table-body'); 
const batchClearBtn = document.getElementById('im-batch-clear-button'); 
const batchCountDisplay = document.getElementById('batch-count-display');
const imBatchSearchExistingButton = document.getElementById('im-batch-search-existing-button');
const imBatchSearchModal = document.getElementById('im-batch-search-modal');
const imBatchNoteSearchSelect = document.getElementById('im-batch-note-search-select');
const imBatchGlobalAttention = document.getElementById('im-batch-global-attention');
const imBatchGlobalStatus = document.getElementById('im-batch-global-status');
const imBatchGlobalNote = document.getElementById('im-batch-global-note');
const batchAddBtn = document.getElementById('im-batch-add-po-button');
const batchSaveBtn = document.getElementById('im-batch-save-button');
const batchPOInput = document.getElementById('im-batch-po-input');
const batchSearchStatusBtn = document.getElementById('im-batch-search-by-status-button');
const batchSearchNoteBtn = document.getElementById('im-batch-search-by-note-button');

// --- IM: Payments ---
const paymentsNavLink = document.getElementById('payments-nav-link');
const imPaymentsSection = document.getElementById('im-payments');
const imAddPaymentButton = document.getElementById('im-add-payment-button');
const imPaymentsTableBody = document.getElementById('im-payments-table-body');
const imSavePaymentsButton = document.getElementById('im-save-payments-button');
const imAddPaymentModal = document.getElementById('im-add-payment-modal');
const imPaymentModalPOInput = document.getElementById('im-payment-modal-po-input');
const imPaymentModalSearchBtn = document.getElementById('im-payment-modal-search-btn');
const imPaymentModalResults = document.getElementById('im-payment-modal-results');
const imPaymentModalAddSelectedBtn = document.getElementById('im-payment-modal-add-selected-btn');
const paymentsCountDisplay = document.getElementById('payments-count-display');

// --- IM: Reporting & Finance ---
const imReportingForm = document.getElementById('im-reporting-form');
const imReportingContent = document.getElementById('im-reporting-content');
const imReportingSearchInput = document.getElementById('im-reporting-search');
const imReportingClearButton = document.getElementById('im-reporting-clear-button');
const imReportingDownloadCSVButton = document.getElementById('im-reporting-download-csv-button');
const imReportingPrintBtn = document.getElementById('im-reporting-print-btn');
const imReportingPrintableArea = document.getElementById('im-reporting-printable-area');
const imDailyReportDateInput = document.getElementById('im-daily-report-date');
const imDownloadDailyReportButton = document.getElementById('im-download-daily-report-button');
const imDownloadWithAccountsReportButton = document.getElementById('im-download-with-accounts-report-button');
const reportingCountDisplay = document.getElementById('reporting-count-display');
// Print Report Elements
const imPrintReportTitle = document.getElementById('im-print-report-title');
const imPrintReportDate = document.getElementById('im-print-report-date');
const imPrintReportSummaryPOs = document.getElementById('im-print-report-summary-pos');
const imPrintReportSummaryValue = document.getElementById('im-print-report-summary-value');
const imPrintReportSummaryPaid = document.getElementById('im-print-report-summary-paid');
const imPrintReportBody = document.getElementById('im-print-report-body');

// --- IM: Finance Report (Admin) ---
const imFinanceReportNavLink = document.getElementById('im-finance-report-nav-link');
const imFinanceReportSection = document.getElementById('im-finance-report');
const imFinanceSearchPoInput = document.getElementById('im-finance-search-po');
const imFinanceSearchBtn = document.getElementById('im-finance-search-btn');
const imFinanceClearBtn = document.getElementById('im-finance-clear-btn');
const imFinanceResults = document.getElementById('im-finance-results');
const imFinanceNoResults = document.getElementById('im-finance-no-results');
const imFinanceResultsBody = document.getElementById('im-finance-results-body');
const imFinanceReportModal = document.getElementById('im-finance-report-modal');
const imFinancePrintReportBtn = document.getElementById('im-finance-print-report-btn');
const financeReportCountDisplay = document.getElementById('finance-report-count-display');
// Finance Modal Details
const imReportDate = document.getElementById('im-reportDate');
const imReportPoNo = document.getElementById('im-reportPoNo');
const imReportProject = document.getElementById('im-reportProject');
const imReportVendorId = document.getElementById('im-reportVendorId');
const imReportVendorName = document.getElementById('im-reportVendorName');
const imReportTotalPoValue = document.getElementById('im-reportTotalPoValue');
const imReportTotalCertified = document.getElementById('im-reportTotalCertified');
const imReportTotalPrevPayment = document.getElementById('im-reportTotalPrevPayment');
const imReportTotalCommitted = document.getElementById('im-reportTotalCommitted');
const imReportTotalRetention = document.getElementById('im-reportTotalRetention');
const imReportTableBody = document.getElementById('im-reportTableBody');
const imReportTotalCertifiedAmount = document.getElementById('im-reportTotalCertifiedAmount'); 
const imReportTotalRetentionAmount = document.getElementById('im-reportTotalRetentionAmount'); 
const imReportTotalPaymentAmount = document.getElementById('im-reportTotalPaymentAmount'); 
const imReportNotesSection = document.getElementById('im-reportNotesSection');
const imReportNotesContent = document.getElementById('im-reportNotesContent');

// --- IM: Summary Note ---
const summaryNotePreviousInput = document.getElementById('summary-note-previous-input');
const summaryNoteCurrentInput = document.getElementById('summary-note-current-input');
const summaryNoteGenerateBtn = document.getElementById('summary-note-generate-btn');
const summaryNoteUpdateBtn = document.getElementById('summary-note-update-btn');
const summaryNotePrevPdfBtn = document.getElementById('summary-note-prev-pdf-btn'); // <--- ADD THIS
const summaryNotePrintBtn = document.getElementById('summary-note-print-btn');
const summaryNotePrintArea = document.getElementById('summary-note-printable-area');
const snDate = document.getElementById('sn-date');
const snVendorName = document.getElementById('sn-vendor-name');
const snPreviousPayment = document.getElementById('sn-previous-payment');
const snCurrentPayment = document.getElementById('sn-current-payment');
const snTableBody = document.getElementById('sn-table-body');
const snTotalInWords = document.getElementById('sn-total-in-words');
const snTotalNumeric = document.getElementById('sn-total-numeric');
const noteSuggestionsDatalist = document.getElementById('note-suggestions');
const summaryNoteCountDisplay = document.getElementById('summary-note-count-display');
const summaryClearBtn = document.getElementById('summary-note-clear-btn');

// --- Modals & Mobile Elements ---
const ceoApprovalModal = document.getElementById('ceo-approval-modal');
const ceoModalDetails = document.getElementById('ceo-modal-details');
const ceoModalAmount = document.getElementById('ceo-modal-amount');
const ceoModalNote = document.getElementById('ceo-modal-note');
const ceoModalApproveBtn = document.getElementById('ceo-modal-approve-btn');
const ceoModalRejectBtn = document.getElementById('ceo-modal-reject-btn');
const sendCeoApprovalReceiptBtn = document.getElementById('send-ceo-approval-receipt-btn');

const vacationModal = document.getElementById('vacation-replacement-modal');
const vacationingUserName = document.getElementById('vacationing-user-name');
const vacationReturnDate = document.getElementById('vacation-return-date');
const replacementNameDisplay = document.getElementById('replacement-name-display');
const replacementContactDisplay = document.getElementById('replacement-contact-display');
const replacementEmailDisplay = document.getElementById('replacement-email-display');

const modifyTaskModal = document.getElementById('modify-task-modal');
const modifyTaskAttention = document.getElementById('modify-task-attention');
const modifyTaskStatus = document.getElementById('modify-task-status');
const modifyTaskStatusOtherContainer = document.getElementById('modify-task-status-other-container');
const modifyTaskStatusOther = document.getElementById('modify-task-status-other');
const modifyTaskNote = document.getElementById('modify-task-note');
const modifyTaskSaveBtn = document.getElementById('modify-task-save-btn');
const modifyTaskKey = document.getElementById('modify-task-key');
const modifyTaskSource = document.getElementById('modify-task-source');
const modifyTaskOriginalPO = document.getElementById('modify-task-originalPO');
const modifyTaskOriginalKey = document.getElementById('modify-task-originalKey');

// Mobile Search & Misc
const imMobileSearchBtn = document.getElementById('im-mobile-search-btn');
const imMobileSearchModal = document.getElementById('im-mobile-search-modal');
const imMobileSearchRunBtn = document.getElementById('im-mobile-search-run-btn');
const imMobileSearchClearBtn = document.getElementById('im-mobile-search-clear-btn');
const imMobileSearchCloseBtn = document.querySelector('[data-modal-id="im-mobile-search-modal"]');
const wdImReportingLinkMobile = document.getElementById('wd-im-reporting-link-mobile');
const imNavReportingLinkMobile = document.getElementById('im-nav-reporting-link-mobile'); // New Selector
const mobileSendReceiptBtn = document.getElementById('mobile-send-receipt-btn');
const mobileActiveTaskLogoutBtn = document.getElementById('mobile-activetask-logout-btn');
const imMobileActiveTaskLink = document.getElementById('im-mobile-activetask-link');
const mobileActiveTaskRefreshBtn = document.getElementById('mobile-activetask-refresh-btn');
const mobileLoginForm = document.getElementById('mobile-login-form');

// --- Badges ---
const wdActiveTaskBadge = document.getElementById('wd-active-task-badge');
const imActiveTaskBadge = document.getElementById('im-active-task-badge');
const wdMobileNotifyBadge = document.getElementById('wd-mobile-notify-badge');

// ==========================================================================
// 6. VIEW NAVIGATION & AUTHENTICATION
// ==========================================================================

function showView(viewName) {
    Object.keys(views).forEach(key => {
        if (views[key]) views[key].classList.add('hidden');
    });
    if (invoiceManagementView) invoiceManagementView.classList.add('hidden');

    if (viewName === 'workdesk' || viewName === 'invoice-management') {
        document.body.classList.remove('login-background');
        document.getElementById('app-container').style.display = 'none';
    } else {
        document.body.classList.add('login-background');
        document.getElementById('app-container').style.display = 'block';
    }

    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    } else if (viewName === 'invoice-management' && invoiceManagementView) {
        invoiceManagementView.classList.remove('hidden');
    }
}

// --- Authentication Helpers ---

async function findApprover(identifier) {
    const isEmail = identifier.includes('@');
    const searchKey = isEmail ? 'Email' : 'Mobile';
    const searchValue = isEmail ? identifier : normalizeMobile(identifier);

    // Cache check
    if (!allApproverData) {
         console.log("Caching approvers list for the first time...");
         const snapshot = await db.ref('approvers').once('value');
         allApproverData = snapshot.val(); 
    }
    const approversData = allApproverData; 

    if (!approversData) return null;
    for (const key in approversData) {
        const record = approversData[key];
        const dbValue = record[searchKey];
        if (dbValue) {
            if (isEmail) {
                if (dbValue.toLowerCase() === searchValue.toLowerCase()) {
                    return { key, ...record };
                }
            } else {
                const normalizedDbMobile = dbValue.replace(/\D/g, '');
                if (normalizedDbMobile === searchValue) {
                    return { key, ...record };
                }
            }
        }
    }
    return null;
}

async function getApproverByKey(key) { 
    try { 
        const snapshot = await db.ref(`approvers/${key}`).once('value'); 
        const approverData = snapshot.val(); 
        if (approverData) { return { key, ...approverData }; } else { return null; } 
    } catch (error) { 
        console.error("Error fetching approver by key:", error); 
        return null; 
    } 
}

function handleSuccessfulLogin() {
    if (currentApprover && currentApprover.key) {
        localStorage.setItem('approverKey', currentApprover.key);
    } else {
        console.error("Attempted to save login state but currentApprover or key is missing.");
        handleLogout();
        return;
    }

    // Check for CEO Admin role
    const isCEO = (currentApprover?.Role || '').toLowerCase() === 'admin' && 
                  (currentApprover?.Position || '').toLowerCase() === 'ceo';
    document.body.classList.toggle('is-ceo', isCEO); 

    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        workdeskButton.click(); 
    } else {
        showView('dashboard');
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    document.body.classList.toggle('is-admin', isAdmin);

    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    const isAccounting = userPositionLower === 'accounting';
    const isAccounts = userPositionLower === 'accounts';

    // --- Hide Finance Report Button for non-Accounts ---
    const financeReportButton = document.querySelector('a[href="https://ibaport.site/Finance/"]');
    if (financeReportButton) {
        const isAccountsOrAccounting = isAccounts || isAccounting;
        financeReportButton.classList.toggle('hidden', !isAccountsOrAccounting);
    }

    // --- NEW FIX: Hide Invoice Management Button for Unauthorized Users ---
    // Only Admins, Accounting, or Accounts should see this button
    const invoiceMgmtBtn = document.getElementById('invoice-mgmt-button');
    if (invoiceMgmtBtn) {
        if (isAdmin || isAccounting || isAccounts) {
            invoiceMgmtBtn.classList.remove('hidden');
        } else {
            invoiceMgmtBtn.classList.add('hidden');
        }
    }
}

function handleLogout() {
    localStorage.removeItem('approverKey');
    
    if (dateTimeInterval) clearInterval(dateTimeInterval);
    if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
    if (imDateTimeInterval) clearInterval(imDateTimeInterval);
    location.reload();
}

// --- Workdesk Navigation ---

async function showWorkdeskSection(sectionId, newSearchTerm = null) {
    // 1. Cleanup
    if (activeTaskAutoRefreshInterval) {
        clearInterval(activeTaskAutoRefreshInterval);
        activeTaskAutoRefreshInterval = null;
    }

    // 2. Hide all sections, Show target
    workdeskSections.forEach(section => { section.classList.add('hidden'); });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) { targetSection.classList.remove('hidden'); }

    // 3. Section-Specific Logic
    if (sectionId === 'wd-dashboard') { 
        await populateWorkdeskDashboard(); 
        renderWorkdeskCalendar(); 
        renderYearView(); 
        await populateCalendarTasks(); 
        const today = new Date(); 
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`; 
        displayCalendarTasksForDay(todayStr);
    }
    
    if (sectionId === 'wd-jobentry') {
        if (!currentlyEditingKey) {
            resetJobEntryForm(false);
        }
        const savedSearch = sessionStorage.getItem('jobEntrySearch');
        if (savedSearch) {
            jobEntrySearchInput.value = savedSearch;
        }
        await handleJobEntrySearch(jobEntrySearchInput.value); 
    }
    
    if (sectionId === 'wd-activetask') {
        await populateActiveTasks(); 

        let searchTerm = '';
        if (newSearchTerm !== null) {
            searchTerm = newSearchTerm;
        } else {
            searchTerm = sessionStorage.getItem('activeTaskSearch') || '';
        }

        if (searchTerm) {
            activeTaskSearchInput.value = searchTerm;
            handleActiveTaskSearch(searchTerm); 
        }
    }
    
    if (sectionId === 'wd-reporting') {
        const savedSearch = sessionStorage.getItem('reportingSearch');
        if (savedSearch) {
            reportingSearchInput.value = savedSearch;
        }
         await handleReportingSearch(); 
    }

    // --- NEW: Material Stock Logic ---
    if (sectionId === 'wd-material-stock') {
        // This function lives in materialStock.js
        if (typeof populateMaterialStock === 'function') {
            await populateMaterialStock();
        } else {
            console.error("materialStock.js functions are not loaded.");
        }
    }

    if (sectionId === 'wd-settings') { populateSettingsForm(); }
}



// --- Invoice Management Navigation ---
function showIMSection(sectionId) {
    // 1. Get User Credentials
    const userPos = (currentApprover?.Position || '').trim(); // Case sensitive check next
    const userRole = (currentApprover?.Role || '').toLowerCase();
    
    // 2. Define Permission Flags (Strict Logic)
    const isAdmin = userRole === 'admin';
    const isAccountingPos = userPos === 'Accounting'; // Case sensitive as per request usually, but let's be safe
    const isAccountsPos = userPos === 'Accounts';

    // "Admin with Accounting" (Has Everything)
    const isAccountingAdmin = isAdmin && isAccountingPos; // Strictly Admin + Accounting
    
    // "Admin with Accounts" (Has Payments)
    // Note: We allow AccountingAdmin to see payments too since they have "everything"
    const isAccountsAdmin = (isAdmin && isAccountsPos) || isAccountingAdmin;

    // 3. Strict Access Control Checks
    if (sectionId === 'im-invoice-entry' && !isAccountingAdmin) { alert('Access Denied: Restricted to Admin & Accounting position.'); return; }
    if (sectionId === 'im-batch-entry' && !isAccountingAdmin) { alert('Access Denied: Restricted to Admin & Accounting position.'); return; }
    if (sectionId === 'im-summary-note' && !isAccountingAdmin) { alert('Access Denied: Restricted to Admin & Accounting position.'); return; }
    
    if (sectionId === 'im-payments' && !isAccountsAdmin) { alert('Access Denied: Restricted to Admin & Accounts/Accounting position.'); return; }
    
    if (sectionId === 'im-finance-report' && !isAdmin) { alert('Access Denied: Restricted to Admins.'); return; }

    // 4. Show/Hide Views
    imContentArea.querySelectorAll('.workdesk-section').forEach(section => section.classList.add('hidden'));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.remove('hidden');

    // 5. Sidebar Handling
    if (sectionId === 'im-invoice-entry') {
        if(imEntrySidebar) imEntrySidebar.classList.remove('hidden');
        if(imMainElement) imMainElement.classList.add('with-sidebar'); 
        populateActiveJobsSidebar(); 
    } else {
        if(imEntrySidebar) imEntrySidebar.classList.add('hidden'); 
        if(imMainElement) imMainElement.classList.remove('with-sidebar'); 
    }

    // 6. Section Specific Initializers
    if (sectionId === 'im-dashboard') { 
        // STOP AUTOMATIC LOADING
        // populateInvoiceDashboard(false); <--- REMOVED
        
        // Show "Standby" Message instead
        const dbSection = document.getElementById('im-dashboard');
        dbSection.innerHTML = `
            <h1>Dashboard</h1>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; color: #777; text-align: center;">
                <i class="fa-solid fa-chart-column" style="font-size: 4rem; margin-bottom: 20px; color: #ccc;"></i>
                <h2 style="margin-bottom: 10px;">Dashboard Standby</h2>
                <p>To view heavy chart data, please <strong>Double-Click</strong> the "Dashboard" button in the sidebar.</p>
            </div>
        `;
    }
    
    if (sectionId === 'im-batch-entry') {
        const savedBatchSearch = sessionStorage.getItem('imBatchSearch');
        const savedBatchNoteSearch = sessionStorage.getItem('imBatchNoteSearch'); 
        if (savedBatchSearch) document.getElementById('im-batch-po-input').value = savedBatchSearch;
        else document.getElementById('im-batch-po-input').value = '';
        
        document.getElementById('im-batch-table-body').innerHTML = '';
        updateBatchCount(); 

        if (!imBatchGlobalAttentionChoices) {
             imBatchGlobalAttentionChoices = new Choices(document.getElementById('im-batch-global-attention'), { searchEnabled: true, shouldSort: false, itemSelectText: '', });
             populateAttentionDropdown(imBatchGlobalAttentionChoices);
        } else populateAttentionDropdown(imBatchGlobalAttentionChoices);
        
        if (!imBatchNoteSearchChoices) {
            imBatchNoteSearchChoices = new Choices(document.getElementById('im-batch-note-search-select'), {
                searchEnabled: true, shouldSort: true, itemSelectText: '', removeItemButton: true, placeholder: true, placeholderValue: 'Search by Note...'
            });
        }
        populateNoteDropdown(imBatchNoteSearchChoices).then(() => {
            if (savedBatchNoteSearch) imBatchNoteSearchChoices.setChoiceByValue(savedBatchNoteSearch);
        });
    }

    if (sectionId === 'im-summary-note') { 
        initializeNoteSuggestions(); 
        const savedPrevNote = sessionStorage.getItem('imSummaryPrevNote');
        const savedCurrNote = sessionStorage.getItem('imSummaryCurrNote');
        if (savedPrevNote) summaryNotePreviousInput.value = savedPrevNote;
        if (savedCurrNote) {
            summaryNoteCurrentInput.value = savedCurrNote;
            handleGenerateSummary();
        } else {
            summaryNotePrintArea.classList.add('hidden');
            if (summaryNoteCountDisplay) summaryNoteCountDisplay.textContent = ''; 
        }
    }

    if (sectionId === 'im-reporting') {
        imDailyReportDateInput.value = getTodayDateString();
        const savedSearch = sessionStorage.getItem('imReportingSearch');
        if (savedSearch) {
            imReportingSearchInput.value = savedSearch;
            populateInvoiceReporting(savedSearch);
        } else {
            imReportingContent.innerHTML = '<p>Please enter a search term and click Search.</p>';
            if (reportingCountDisplay) reportingCountDisplay.textContent = ''; 
            imReportingSearchInput.value = '';
            currentReportData = [];
        }
        populateSiteFilterDropdown();
        
        // Visibility check for Accounting-specific download buttons
        const showReportBtns = isAccountingAdmin && (window.innerWidth > 768);
        if (imReportingDownloadCSVButton) imReportingDownloadCSVButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDownloadDailyReportButton) imDownloadDailyReportButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDownloadWithAccountsReportButton) imDownloadWithAccountsReportButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDailyReportDateInput) imDailyReportDateInput.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imReportingPrintBtn) imReportingPrintBtn.disabled = !isAccountingAdmin;
    }
    
    if (sectionId === 'im-payments') {
        imPaymentsTableBody.innerHTML = ''; 
        invoicesToPay = {}; 
        updatePaymentsCount(); 
    }
    
    if (sectionId === 'im-finance-report') {
        imFinanceSearchPoInput.value = '';
        imFinanceResults.style.display = 'none';
        imFinanceNoResults.style.display = 'none';
        imFinanceAllPaymentsData = {};
        if (financeReportCountDisplay) financeReportCountDisplay.textContent = ''; 
    }
}

// --- User Settings ---

function populateSettingsForm() {
    if (!currentApprover) return;
    settingsMessage.textContent = '';
    settingsMessage.className = 'error-message';
    settingsPasswordInput.value = '';
    settingsNameInput.value = currentApprover.Name || '';
    settingsEmailInput.value = currentApprover.Email || '';
    settingsMobileInput.value = currentApprover.Mobile || '';
    settingsPositionInput.value = currentApprover.Position || '';
    settingsSiteInput.value = currentApprover.Site || '';
    settingsVacationCheckbox.checked = currentApprover.Vacation === true || currentApprover.Vacation === "Yes"; 
    settingsReturnDateInput.value = currentApprover.DateReturn || '';

    settingsReplacementNameInput.value = currentApprover.ReplacementName || '';
    settingsReplacementContactInput.value = currentApprover.ReplacementContact || '';
    settingsReplacementEmailInput.value = currentApprover.ReplacementEmail || '';

    settingsVacationDetailsContainer.classList.toggle('hidden', !settingsVacationCheckbox.checked);
}

async function handleUpdateSettings(e) {
    e.preventDefault();
    if (!currentApprover || !currentApprover.key) {
        settingsMessage.textContent = 'Could not identify user. Please log in again.';
        settingsMessage.className = 'error-message';
        return;
    }

    const onVacation = settingsVacationCheckbox.checked;
    const updates = {
        Site: settingsSiteInput.value.trim(),
        Vacation: onVacation ? "Yes" : "", 
        DateReturn: onVacation ? settingsReturnDateInput.value : '',
        ReplacementName: onVacation ? settingsReplacementNameInput.value.trim() : '',
        ReplacementContact: onVacation ? settingsReplacementContactInput.value.trim() : '',
        ReplacementEmail: onVacation ? settingsReplacementEmailInput.value.trim() : ''
    };
    let passwordChanged = false;
    const newPassword = settingsPasswordInput.value;
    if (newPassword) {
        if (newPassword.length < 6) {
            settingsMessage.textContent = 'Password must be at least 6 characters long.';
            settingsMessage.className = 'error-message';
            return;
        }
        updates.Password = newPassword;
        passwordChanged = true;
    }

    try {
        await db.ref(`approvers/${currentApprover.key}`).update(updates);
        currentApprover = { ...currentApprover, ...updates, Vacation: updates.Vacation === "Yes" };
        allApproversCache = null; 
        allApproverDataCache = null; 
        settingsMessage.textContent = 'Settings updated successfully!';
        settingsMessage.className = 'success-message';
        settingsPasswordInput.value = '';
        if (passwordChanged) {
            alert('Password changed successfully! You will now be logged out.');
            handleLogout();
        } else {
             populateSettingsForm(); 
        }
    } catch (error) {
        console.error("Error updating settings:", error);
        settingsMessage.textContent = 'An error occurred. Please try again.';
        settingsMessage.className = 'error-message';
    }
}

// --- Placeholder Clock Functions ---
function updateWorkdeskDateTime() {}
function updateDashboardDateTime() {}
function updateIMDateTime() {}

// ==========================================================================
// 7. WORKDESK LOGIC: DASHBOARD & CALENDAR
// ==========================================================================

// --- Helper: Check Task Completion ---
function isTaskComplete(task) {
    if (!task) return false;

    if (task.source === 'job_entry' && task.for === 'Invoice') {
        return !!task.dateResponded; 
    }

    const completedStatuses = [
        'With Accounts', 
        'SRV Done', 
        'Paid',
        'CLOSED',
        'Cancelled',
        'Approved', 
        'Rejected'
    ];

    if (task.source === 'invoice') {
        if (completedStatuses.includes(task.remarks)) return true;
        if (task.enteredBy === currentApprover?.Name) {
            const trackingStatuses = ['For SRV', 'For IPC'];
            if (trackingStatuses.includes(task.remarks)) return false; 
            return true; 
        }
        return false;
    }
           
    if (task.source === 'job_entry') {
        if (task.attention === 'All') return true;
        if (completedStatuses.includes(task.remarks)) return true;
        if (task.for === 'PR' && task.remarks === 'PO Ready') return true;
        if (task.for !== 'PR' && task.dateResponded) return true;
    }
    
    return false;
}

// --- Dashboard Population ---

async function populateWorkdeskDashboard() {
    // 1. Populate the user's personal task list
    await populateActiveTasks(); 
    
    // SAFEGUARD: Only update count if element exists
    const activeCountEl = document.getElementById('db-active-tasks-count');
    if (activeCountEl) {
        activeCountEl.textContent = userActiveTasks.length;
    }

    // 2. Populate the admin's "all tasks" list
    await populateAdminCalendarTasks();

    // 3. Populate completed tasks count
    await ensureAllEntriesFetched(); 
    
    let completedJobTasks = allSystemEntries.filter(task => 
        (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name) && isTaskComplete(task)
    );

    let completedInvoiceTasks = [];
    const isAccounting = (currentApprover.Position || '').toLowerCase() === 'accounting';

    await ensureInvoiceDataFetched(); 

    if (allInvoiceData) {
        for (const poNumber in allInvoiceData) {
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                const inv = poInvoices[invoiceKey];
                const invoiceTask = {
                    key: `${poNumber}_${invoiceKey}`,
                    source: 'invoice',
                    remarks: inv.status,
                    enteredBy: isAccounting ? currentApprover.Name : 'Irwin' 
                };
                
                let shouldInclude = false;
                if (isAccounting) {
                    if (isTaskComplete(invoiceTask)) shouldInclude = true;
                } else {
                    if (inv.attention === currentApprover.Name && isTaskComplete(invoiceTask)) shouldInclude = true;
                }
                
                if (shouldInclude) completedInvoiceTasks.push(invoiceTask);
            }
        }
    }
    
    const totalCompleted = completedJobTasks.length + completedInvoiceTasks.length;
    
    // SAFEGUARD: Only update count if element exists
    const completedCountEl = document.getElementById('db-completed-tasks-count');
    if (completedCountEl) {
        completedCountEl.textContent = totalCompleted;
    }
}

// --- Calendar Logic (Month, Year, Day Views) ---

function renderWorkdeskCalendar() {
    if (!wdCalendarGrid || !wdCalendarMonthYear) return;

    wdCalendarGrid.innerHTML = `
        <div class="wd-calendar-day-name">Sun</div>
        <div class="wd-calendar-day-name">Mon</div>
        <div class="wd-calendar-day-name">Tue</div>
        <div class="wd-calendar-day-name">Wed</div>
        <div class="wd-calendar-day-name">Thu</div>
        <div class="wd-calendar-day-name">Fri</div>
        <div class="wd-calendar-day-name">Sat</div>
    `; 

    wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const year = wdCurrentCalendarDate.getFullYear();
    const month = wdCurrentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const blankDay = document.createElement('div');
        blankDay.className = 'wd-calendar-day other-month';
        wdCalendarGrid.appendChild(blankDay);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'wd-calendar-day';
        dayCell.textContent = day;

        const thisDate = new Date(year, month, day);
        thisDate.setHours(0, 0, 0, 0); 

        const dateYear = thisDate.getFullYear();
        const dateMonth = String(thisDate.getMonth() + 1).padStart(2, '0');
        const dateDay = String(thisDate.getDate()).padStart(2, '0');
        dayCell.dataset.date = `${dateYear}-${dateMonth}-${dateDay}`;

        if (thisDate.getTime() === today.getTime()) {
            dayCell.classList.add('today');
        }
        wdCalendarGrid.appendChild(dayCell);
    }
}

async function populateAdminCalendarTasks() {
    if (!currentApprover || (currentApprover.Role || '').toLowerCase() !== 'admin') {
        allAdminCalendarTasks = []; 
        return;
    }

    console.log("Admin user detected, populating full calendar...");
    let allTasks = [];

    // 1. Get all active JOB_ENTRIES
    await ensureAllEntriesFetched(); 
    const activeJobTasks = allSystemEntries.filter(entry => !isTaskComplete(entry));
    allTasks = allTasks.concat(activeJobTasks);

    // 2. Get all active INVOICE_ENTRIES
    await ensureInvoiceDataFetched(); 
    const unassignedStatuses = ['Pending', 'Report', 'Original PO'];

    if (allInvoiceData && allPOData) {
        for (const poNumber in allInvoiceData) {
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                const inv = poInvoices[invoiceKey];
                const isAssignedActive = isInvoiceTaskActive(inv);
                const isUnassignedActive = unassignedStatuses.includes(inv.status) && (!inv.attention || inv.attention === '');

                if (isAssignedActive || isUnassignedActive) {
                    const poDetails = allPOData[poNumber] || {};
                    const transformedInvoice = {
                        key: `${poNumber}_${invoiceKey}`,
                        originalKey: invoiceKey,
                        originalPO: poNumber,
                        source: 'invoice',
                        for: 'Invoice',
                        ref: inv.invNumber || '',
                        po: poNumber,
                        amount: inv.invValue || '',
                        site: poDetails['Project ID'] || 'N/A',
                        group: 'N/A',
                        attention: inv.attention || '',
                        enteredBy: 'Irwin', 
                        date: formatYYYYMMDD(inv.invoiceDate), 
                        calendarDate: formatYYYYMMDD(inv.releaseDate) !== 'N/A' ? formatYYYYMMDD(inv.releaseDate) : formatYYYYMMDD(inv.invoiceDate),
                        remarks: inv.status,
                        timestamp: (inv.releaseDate || inv.invoiceDate) ? new Date(inv.releaseDate || inv.invoiceDate).getTime() : Date.now(), 
                        invName: inv.invName || '',
                        vendorName: poDetails['Supplier Name'] || 'N/A',
                        note: inv.note || ''
                    };
                    allTasks.push(transformedInvoice);
                }
            }
        }
    }
    allAdminCalendarTasks = allTasks; 
}

async function populateCalendarTasks() {
    if (!currentApprover) return;

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    let tasks = [];
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key)); 

    if (isAdmin) {
        tasks = allAdminCalendarTasks;
    } else {
        tasks = userActiveTasks;
    }

    const tasksByDate = new Map();
    tasks.forEach(task => {
        let taskDateStr = task.calendarDate || task.date; 
        if (taskDateStr) {
            const inputDate = convertDisplayDateToInput(taskDateStr); 
            if (inputDate) {
                if (!tasksByDate.has(inputDate)) {
                    tasksByDate.set(inputDate, []);
                }
                tasksByDate.get(inputDate).push(task);
            }
        }
    });

    document.querySelectorAll('.wd-calendar-day[data-date]').forEach(dayCell => {
        const date = dayCell.dataset.date;
        const oldBadge = dayCell.querySelector('.task-count-badge');
        if (oldBadge) oldBadge.remove();

        if (tasksByDate.has(date)) {
            const tasksForDay = tasksByDate.get(date);
            const count = tasksForDay.length;

            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'task-count-badge';
                badge.textContent = count;

                let badgeColorSet = false;
                if (isAdmin) {
                    const hasMyTask = tasksForDay.some(task => myTaskKeys.has(task.key));
                    if (!hasMyTask) {
                        badge.classList.add('admin-view-only'); 
                        badgeColorSet = true;
                    }
                }
                if (!badgeColorSet) {
                    const allPendingSignature = tasksForDay.every(task => task.remarks === 'Pending Signature');
                    if (allPendingSignature) {
                        badge.classList.add('status-pending-signature'); 
                        badgeColorSet = true;
                    }
                }
                dayCell.appendChild(badge);
            }
        }
    });
}

function renderYearView() {
    if (!wdCalendarYearGrid) return;

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const year = wdCurrentCalendarDate.getFullYear();
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key));

    const tasksByMonth = new Map();
    for (let i = 0; i < 12; i++) {
        tasksByMonth.set(i, []); 
    }

    taskSource.forEach(task => {
        const taskDateStr = task.calendarDate || task.date;
        if (!taskDateStr) return;
        
        const taskDate = new Date(convertDisplayDateToInput(taskDateStr) + 'T00:00:00');
        if (taskDate.getFullYear() === year) {
            const monthIndex = taskDate.getMonth();
            tasksByMonth.get(monthIndex).push(task);
        }
    });

    wdCalendarYearGrid.innerHTML = '';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 0; i < 12; i++) { 
        const monthCell = document.createElement('div');
        monthCell.className = 'wd-calendar-month-cell';
        monthCell.textContent = monthNames[i];
        monthCell.dataset.month = i; 

        const tasksForThisMonth = tasksByMonth.get(i);
        const taskCount = tasksForThisMonth.length;

        if (taskCount > 0) {
            monthCell.classList.add('has-tasks');
            const badge = document.createElement('span');
            badge.className = 'month-task-count';
            badge.textContent = taskCount;

            let badgeColorSet = false;
            if (isAdmin) {
                const hasMyTask = tasksForThisMonth.some(task => myTaskKeys.has(task.key));
                if (!hasMyTask) {
                    monthCell.classList.add('admin-view-only'); 
                    badge.classList.add('admin-view-only'); 
                    badgeColorSet = true;
                }
            }
            if (!badgeColorSet) {
                const allPendingSignature = tasksForThisMonth.every(task => task.remarks === 'Pending Signature');
                if (allPendingSignature) {
                    monthCell.classList.add('status-pending-signature'); 
                    badge.classList.add('status-pending-signature'); 
                    badgeColorSet = true;
                }
            }
            monthCell.appendChild(badge);
        }
        wdCalendarYearGrid.appendChild(monthCell);
    }
}

function toggleCalendarView() {
    isYearView = !isYearView; 
    
    wdCalendarGrid.classList.toggle('hidden', isYearView);
    wdCalendarYearGrid.classList.toggle('hidden', !isYearView);
    
    if (isYearView) {
        wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
        wdCalendarToggleBtn.textContent = 'Month View';
        renderYearView(); 
    } else {
        wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        wdCalendarToggleBtn.textContent = 'Year View';
        renderWorkdeskCalendar(); 
        populateCalendarTasks(); 
    }
}

function displayCalendarTasksForDay(date) { 
    document.querySelectorAll('.wd-calendar-day.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    const selectedCell = document.querySelector(`.wd-calendar-day[data-date="${date}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;

    const tasks = taskSource.filter(task => {
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date); 
        return taskDate === date;
    });

    const friendlyDate = formatYYYYMMDD(date);
    
    if (tasks.length > 0) {
        wdCalendarTaskListTitle.textContent = `Task Details for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';
        
        tasks.forEach(task => {
            const li = document.createElement('li');
            
            let statusClass = '';
            const status = task.remarks || 'Pending';
            if (status === 'Pending Signature') statusClass = 'status-pending-signature';
            if (status === 'For SRV') statusClass = 'status-for-srv';
            li.className = statusClass;

            const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
            const subInfo = task.vendorName ? task.vendorName : `(Ref: ${task.ref || 'N/A'})`;
            
            const amountDisplay = (task.amount && parseFloat(task.amount) > 0) 
                ? ` - QAR ${formatCurrency(task.amount)}` 
                : ``;

            if (task.po) {
                li.dataset.po = task.po; 
                li.classList.add('clickable-task');
                li.title = `PO: ${task.po}\nDouble-click to search in IM Reporting`;
            }

            const noteHTML = task.note 
                ? `<span style="color: var(--iba-secondary-terracotta); font-style: italic; margin-top: 4px;">Note: ${task.note}</span>` 
                : '';

            const jobTypeHTML = task.for
                ? `<span style="font-weight: 600; margin-top: 4px;">Job: ${task.for}</span>`
                : '';

            li.innerHTML = `
                <strong>${mainInfo}${amountDisplay}</strong>
                <span>${subInfo}</span>
                ${jobTypeHTML}
                <span style="font-weight: 600; margin-top: 4px;">Status: ${status}</span>
                ${noteHTML}
            `;
            wdCalendarTaskListUl.appendChild(li);
        });

    } else {
        wdCalendarTaskListTitle.textContent = `No active tasks for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';
    }
}

function showDayView(date) { 
    try {
        const parts = date.split('-').map(Number);
        wdCurrentDayViewDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } catch (e) {
        console.error("Invalid date passed to showDayView:", date, e);
        return; 
    }

    workdeskSections.forEach(section => {
        section.classList.add('hidden');
    });
    const dayViewSection = document.getElementById('wd-dayview');
    dayViewSection.classList.remove('hidden');

    const friendlyDate = formatYYYYMMDD(date);
    document.getElementById('wd-dayview-title').textContent = `Tasks for ${friendlyDate}`;
    const mobileSubtitle = document.getElementById('wd-dayview-mobile-date-subtitle');
    if (mobileSubtitle) {
        const todayStr = getTodayDateString(); 
        if (date === todayStr) {
            mobileSubtitle.textContent = 'Today';
        } else {
            const subtitleDate = new Date(date + 'T00:00:00'); 
            mobileSubtitle.textContent = subtitleDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    }
    generateDateScroller(date);

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const isCEO = document.body.classList.contains('is-ceo');
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;

    const tasks = taskSource.filter(task => {
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date); 
        return taskDate === date;
    });

    const taskListDiv = document.getElementById('wd-dayview-task-list');
    taskListDiv.innerHTML = ''; 

    if (tasks.length === 0) {
        taskListDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #555;">No tasks found for this day.</p>';
        return;
    }
    
    const myTaskKeys = new Set(userActiveTasks.map(t => t.key));

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'dayview-task-card';

        card.dataset.key = task.key; 
        if (isCEO) {
            card.classList.add('ceo-clickable-day-card');
        }

        let borderColor = 'var(--iba-secondary-terracotta)';
        if (isAdmin && !myTaskKeys.has(task.key)) {
            borderColor = '#28a745';
        }
        card.style.borderLeft = `5px solid ${borderColor}`;

        if (isAdmin && task.po) {
            card.classList.add('admin-clickable-task'); 
            card.dataset.po = task.po;
            card.title = `Admin: Double-click to search for PO ${task.po} in IM Reporting`;
        }

        const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
        const amountDisplay = (task.amount && parseFloat(task.amount) > 0) 
            ? ` - QAR ${formatCurrency(task.amount)}` 
            : ``;
        
        const noteHTML = task.note 
            ? `<div class="task-detail-item note"><span class="label">Note:</span> ${task.note}</div>` 
            : '';

        card.innerHTML = `
            <strong>${mainInfo}${amountDisplay}</strong>
            <div class="task-details-grid">
                <div class="task-detail-item">
                    <span class="label">Vendor:</span> ${task.vendorName || 'N/A'}
                </div>
                <div class="task-detail-item">
                    <span class="label">Site:</span> ${task.site || 'N/A'}
                </div>
                <div class="task-detail-item">
                    <span class="label">Job:</span> ${task.for || 'N/A'}
                </div>
                <div class="task-detail-item status">
                    <span class="label">Status:</span> ${task.remarks || 'Pending'}
                </div>
                ${noteHTML}
            </div>
        `;
        taskListDiv.appendChild(card);
    });
}

function generateDateScroller(selectedDate) { 
    const scrollerInner = document.getElementById('wd-dayview-date-scroller-inner');
    if (!scrollerInner) return;

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let html = '';

    const parts = selectedDate.split('-').map(Number);
    const centerDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    for (let i = -3; i <= 3; i++) {
        const currentDate = new Date(centerDate);
        currentDate.setUTCDate(centerDate.getUTCDate() + i);

        const dayNum = String(currentDate.getUTCDate()).padStart(2, '0');
        const dayInitial = days[currentDate.getUTCDay()];
        
        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;

        const isActive = (dateStr === selectedDate) ? 'active' : '';

        html += `
            <div class="day-scroller-item ${isActive}" data-date="${dateStr}">
                <span class="day-scroller-num">${dayNum}</span>
                <span class="day-scroller-char">${dayInitial}</span>
            </div>
        `;
    }

    scrollerInner.innerHTML = html;
    setTimeout(() => {
        const activeItem = scrollerInner.querySelector('.day-scroller-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, 100);
}

// ==========================================================================
// 8. ACTIVE TASK LOGIC (Inbox)
// ==========================================================================

// --- MISSING FUNCTIONS RESTORED ---

function handleDownloadWorkdeskCSV() {
    const table = document.querySelector("#reporting-printable-area table");
    if (!table) { alert("Report table not found."); return; }

    let csv = [];
    const rows = table.querySelectorAll("tr");
    
    for (let i = 0; i < rows.length; i++) {
        const row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) 
            row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
        csv.push(row.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "job_records.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// UPDATED FUNCTION: renderReportingTable (Includes 'Usage' in Inventory Layout)
// ==========================================================================
function renderReportingTable(entries) {
    reportingTableBody.innerHTML = '';
    
    // --- FIX: Added 'Usage' to this list ---
    const inventoryTypes = ['Transfer', 'Restock', 'Return', 'Usage'];
    // ---------------------------------------

    const tableHead = document.querySelector('#reporting-printable-area table thead');
    
    // CHECK: If the CURRENT filter is one of these, change headers
    if (inventoryTypes.includes(currentReportFilter)) {
        tableHead.innerHTML = `
            <tr>
                <th>Control ID</th>
                <th>Product Name</th>
                <th>Site Route</th>
                <th>Ordered Qty</th>
                <th>Delivered Qty</th>
                <th>Shipping Date</th>
                <th>Arrival Date</th>
                <th>Contact</th>
                <th>Status / Remarks</th>
            </tr>`;
    } else {
        tableHead.innerHTML = `
            <tr>
                <th>Job</th>
                <th>Ref</th>
                <th>Site</th>
                <th>PO</th>
                <th>Vendor Name</th>
                <th>Amount</th>
                <th>Entered By</th>
                <th>Date Entered</th>
                <th>Attention</th>
                <th>Date Responded</th>
                <th>Status</th>
            </tr>`;
    }

    const count = entries.length;
    if(document.getElementById('job-records-count-display')) {
        document.getElementById('job-records-count-display').textContent = `(Total Records: ${count})`;
    }
    
    if (!entries || count === 0) { 
        reportingTableBody.innerHTML = '<tr><td colspan="11">No entries found.</td></tr>'; 
        return; 
    }
    
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';

    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', entry.key); 

        // CHECK: If this SPECIFIC ROW is one of these, render Inventory Columns
        if (inventoryTypes.includes(entry.for)) {
            
            let statusColor = 'black';
            if (entry.remarks === 'Approved') statusColor = '#28a745';
            if (entry.remarks === 'Pending') statusColor = '#dc3545';
            if (entry.remarks === 'Rejected') statusColor = 'red';
            if (entry.remarks === 'Completed') statusColor = '#003A5C';

            const noteDisplay = entry.note ? `<br><small style="color:#666; font-style:italic;">${entry.note}</small>` : '';
            
            let actions = '';
            
            // Print
            actions += `<button class="print-btn waybill-btn" data-key="${entry.key}" style="padding:2px 6px; margin-right:5px; font-size:0.7rem; background:#6f42c1; color:white; border:none; border-radius:4px;" title="Print Waybill"><i class="fa-solid fa-print"></i></button>`;
            
            // History
            actions += `<button class="history-btn action-btn" onclick="showTransferHistory('${entry.key}')" style="padding:2px 6px; margin-right:5px; font-size:0.7rem; background:#17a2b8; color:white; border:none; border-radius:4px;" title="View History"><i class="fa-solid fa-clock-rotate-left"></i></button>`;

            // Delete (Admin Only)
            if (isAdmin) {
                actions += `<button class="delete-btn transfer-delete-btn" data-key="${entry.key}" style="padding:2px 6px; font-size:0.7rem; border-radius:4px;">Del</button>`;
            }

            row.innerHTML = `
                <td><strong>${entry.controlId || ''}</strong></td>
                <td>${entry.productName || ''}</td>
                <td>${entry.site || ''}</td>
                <td>${entry.orderedQty || 0}</td>
                <td>${entry.deliveredQty || 0}</td>
                <td>${entry.shippingDate || ''}</td>
                <td>${entry.arrivalDate || ''}</td>
                <td>${entry.contactName || ''}</td>
                <td>
                    <span style="color:${statusColor}; font-weight:bold;">${entry.remarks || 'Pending'}</span>
                    ${noteDisplay}
                    <div style="margin-top:5px;">${actions}</div>
                </td>
            `;
        } else {
            // Standard Row (Unchanged)
            const status = entry.remarks || 'Pending';
            row.innerHTML = `
                <td>${entry.for || ''}</td>
                <td>${entry.ref || ''}</td>
                <td>${entry.site || ''}</td>
                <td>${entry.po || ''}</td>
                <td>${entry.vendorName || 'N/A'}</td>
                <td>${entry.amount || ''}</td>
                <td>${entry.enteredBy || ''}</td>
                <td>${entry.date || ''}</td>
                <td>${entry.attention || ''}</td>
                <td>${entry.dateResponded || ''}</td>
                <td>${status}</td>
            `;
        }
        reportingTableBody.appendChild(row);
    });
}
function filterAndRenderReport(baseEntries = []) {
    let filteredEntries = [...baseEntries];

    // 1. Filter by Tab (Job Type)
    if (currentReportFilter !== 'All') {
        filteredEntries = filteredEntries.filter(entry => entry.for === currentReportFilter);
    }

    // 2. Filter by Search Text
    const searchText = reportingSearchInput.value.toLowerCase();
    sessionStorage.setItem('reportingSearch', searchText);

    if (searchText) {
        filteredEntries = filteredEntries.filter(entry => {
            // Safe helper to check if a value contains the search text
            const check = (val) => val && String(val).toLowerCase().includes(searchText);

            return (
                check(entry.for) ||
                check(entry.ref) ||
                check(entry.po) ||
                check(entry.amount) ||
                check(entry.site) ||
                check(entry.attention) ||
                check(entry.enteredBy) ||
                check(entry.date) ||
                check(entry.vendorName) ||
                // Specific to Transfers
                check(entry.controlId) ||
                check(entry.productName) ||
                check(entry.contactName)
            );
        });
    }

    renderReportingTable(filteredEntries);
}

// ==========================================================================
// REPLACED FUNCTION: handleReportingSearch (With PR Auto-Fix)
// ==========================================================================
async function handleReportingSearch() {
    reportingTableBody.innerHTML = '<tr><td colspan="11">Loading records...</td></tr>';
    
    try {
        // 1. Load Job Entries
        await ensureAllEntriesFetched(); 
        
        // 2. Load CSV Data (Required for PR Reconciliation)
        await ensureInvoiceDataFetched(false);

        // 3. Run Reconciliation (Updates PRs if PO found in CSV)
        await reconcilePendingPRs();

        // 4. Standard Filtering Logic
        const uniqueJobTypes = [...new Set(allSystemEntries.map(entry => entry.for || 'Other'))];
        uniqueJobTypes.sort(); 

        let tabsHTML = '';

        if (uniqueJobTypes.length > 0) {
            if (currentReportFilter === 'All' || !uniqueJobTypes.includes(currentReportFilter)) {
                currentReportFilter = uniqueJobTypes[0]; 
            }
        }

        uniqueJobTypes.forEach(jobType => {
            const activeClass = (jobType === currentReportFilter) ? 'active' : '';
            tabsHTML += `<button class="${activeClass}" data-job-type="${jobType}">${jobType}</button>`;
        });

        const tabsContainer = document.getElementById('report-tabs');
        if(tabsContainer) tabsContainer.innerHTML = tabsHTML;

        // 5. Render
        filterAndRenderReport(allSystemEntries);

    } catch (error) {
        console.error("Error loading reporting:", error);
        reportingTableBody.innerHTML = '<tr><td colspan="11">Error loading data.</td></tr>';
    }
}

// ==========================================================================
// UPDATED FUNCTION: populateActiveTasks (Includes PR Auto-Reconciliation)
// ==========================================================================
async function populateActiveTasks() {
    activeTaskTableBody.innerHTML = `<tr><td colspan="10">Loading tasks...</td></tr>`;
    if (!currentApprover || !currentApprover.Name) {
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Could not identify user.</td></tr>`;
        return;
    }

    try {
        const currentUserName = currentApprover.Name;
        const userPositionLower = (currentApprover.Position || '').toLowerCase();
        const isAccounting = userPositionLower === 'accounting'; 
        const isQS = userPositionLower === 'qs'; 
        const isProcurement = userPositionLower === 'procurement';

        let userTasks = [];
        let pulledInvoiceKeys = new Set(); 

        // 1. Ensure Standard Job Data is Loaded
        await ensureAllEntriesFetched(); 
        await ensureApproverDataCached();

        // 2. NEW: Ensure CSV Data is Loaded (For PR Checks)
        // Passing 'false' uses cache if available, but ensures 'allPODataByRef' is populated
        await ensureInvoiceDataFetched(false); 

        // 3. NEW: Run Auto-Reconciliation for PRs
        // Checks pending PRs against CSV. If found, updates DB to "PO Ready" and removes from this list.
        if (typeof reconcilePendingPRs === 'function') {
            await reconcilePendingPRs();
        }
        
        // --- UPDATED FILTER BLOCK ---
        const jobTasks = allSystemEntries.filter(entry => {
            if (isTaskComplete(entry)) return false; 

            // 1. Transfer / Restock / Return / Usage Logic
            if (['Transfer', 'Restock', 'Return', 'Usage'].includes(entry.for)) {
                
                // Usage Flow
                if (entry.remarks === 'Pending Confirmation') return entry.requestor === currentUserName;

                // Pending Source
                if (entry.remarks === 'Pending Source') return entry.sourceContact === currentUserName;

                // Pending Admin / Pending
                if (entry.remarks === 'Pending Admin' || entry.remarks === 'Pending') return entry.approver === currentUserName;
                
                // Approved / In Transit
                if (entry.remarks === 'Approved' || entry.remarks === 'In Transit') return entry.receiver === currentUserName;
                
                // Fallback
                return entry.attention === currentUserName;
            }

            // 2. Standard Job Logic
            if (entry.for === 'Invoice') return isAccounting; 
            if (entry.for === 'PR') {
                if (isProcurement) return true; 
                if (entry.attention === currentUserName) return true; 
                return false;
            }
            if (entry.for === 'IPC') return isQS && entry.attention === currentUserName;
            
            return entry.attention === currentUserName;
        });
        // ----------------------------------------

        userTasks = jobTasks.map(task => {
            if(['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) {
                return {...task, source: 'transfer_entry'}; 
            }
            return {...task, source: 'job_entry'};
        });

        // ... (Invoice Task Fetching Logic - No Changes Here) ...
        const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
        const safeCurrentUserName = sanitizeFirebaseKey(currentUserName);
        const invoiceTaskSnapshot = await invoiceDb.ref(`invoice_tasks_by_user/${safeCurrentUserName}`).once('value');
        
        if (invoiceTaskSnapshot.exists()) {
            const tasksData = invoiceTaskSnapshot.val();
            for (const invoiceKey in tasksData) {
                const task = tasksData[invoiceKey];
                pulledInvoiceKeys.add(invoiceKey); 
                
                const transformedInvoice = {
                    key: `${task.po}_${invoiceKey}`,
                    originalKey: invoiceKey,
                    originalPO: task.po,
                    source: 'invoice',
                    for: 'Invoice',
                    ref: task.ref,
                    po: task.po,
                    amount: task.amount,
                    site: task.site,
                    group: 'N/A',
                    attention: currentUserName,
                    enteredBy: 'Irwin', 
                    date: formatYYYYMMDD(task.date),
                    remarks: task.status,
                    timestamp: Date.now(), 
                    invName: task.invName,
                    vendorName: (task.po && allPOData && allPOData[task.po]) ? (allPOData[task.po]['Supplier Name'] || 'N/A') : 'N/A', 
                    note: task.note
                };
                userTasks.push(transformedInvoice);
            }
        }

        if (isAccounting) {
            await ensureInvoiceDataFetched(); 
            const statusesToPull = ['Pending', 'Report', 'Original PO'];
            if (allInvoiceData && allPOData) {
                for (const poNumber in allInvoiceData) {
                    const poInvoices = allInvoiceData[poNumber];
                    for (const invoiceKey in poInvoices) {
                        if (pulledInvoiceKeys.has(invoiceKey)) continue;
                        const inv = poInvoices[invoiceKey];
                        if (inv && statusesToPull.includes(inv.status) && (!inv.attention || inv.attention === '')) {
                            const poDetails = allPOData[poNumber] || {};
                            const transformedInvoice = {
                                key: `${poNumber}_${invoiceKey}`,
                                originalKey: invoiceKey,
                                originalPO: poNumber,
                                source: 'invoice',
                                for: 'Invoice',
                                ref: inv.invNumber || '',
                                po: poNumber,
                                amount: inv.invValue || '',
                                site: poDetails['Project ID'] || 'N/A', 
                                group: 'N/A',
                                attention: inv.attention || '',
                                enteredBy: 'Irwin', 
                                date: formatYYYYMMDD(inv.invoiceDate),
                                remarks: inv.status,
                                timestamp: Date.now(),
                                invName: inv.invName || '',
                                vendorName: poDetails['Supplier Name'] || 'N/A', 
                                note: inv.note || ''
                            };
                            userTasks.push(transformedInvoice);
                        }
                    }
                }
            }
        }

        userActiveTasks = userTasks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        const taskCount = userActiveTasks.length;
        if (activeTaskCountDisplay) activeTaskCountDisplay.textContent = `(Total Tasks: ${taskCount})`;
        [wdActiveTaskBadge, imActiveTaskBadge, wdMobileNotifyBadge].forEach(badge => {
            if (badge) {
                badge.textContent = taskCount;
                badge.style.display = taskCount > 0 ? 'inline-block' : 'none';
            }
        });

        // --- TAB GROUPING LOGIC ---
        const tabCounts = {};
        userActiveTasks.forEach(task => {
            let key = '';
            if (['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) { key = task.for; } 
            else { key = task.remarks || 'Pending'; }
            tabCounts[key] = (tabCounts[key] || 0) + 1;
        });

        const uniqueTabs = Object.keys(tabCounts).sort();
        let tabsHTML = '';
        
        if (uniqueTabs.length > 0) {
            if (currentActiveTaskFilter === 'All' || !uniqueTabs.includes(currentActiveTaskFilter)) {
                currentActiveTaskFilter = uniqueTabs[0];
            }
            uniqueTabs.forEach(tabName => {
                const activeClass = (tabName === currentActiveTaskFilter) ? 'active' : '';
                let badgeColor = '#6c757d'; 
                if(tabName === 'Transfer') badgeColor = '#00748C';
                if(tabName === 'Restock') badgeColor = '#28a745';
                if(tabName === 'Return') badgeColor = '#ffc107';
                if(tabName === 'Usage') badgeColor = '#6f42c1'; 
                
                tabsHTML += `<button class="${activeClass}" data-status-filter="${tabName}">${tabName} <span class="notification-badge" style="background-color: ${badgeColor}; font-size: 0.7rem; margin-left: 5px;">${tabCounts[tabName]}</span></button>`;
            });
        } else {
            tabsHTML = '<button class="active" disabled>No Tasks</button>';
            activeTaskTableBody.innerHTML = `<tr><td colspan="10">You have no active tasks.</td></tr>`;
            activeTaskFilters.innerHTML = tabsHTML;
            return;
        }
        activeTaskFilters.innerHTML = tabsHTML;
        renderActiveTaskTable(userTasks); 

    } catch (error) {
        console.error("Error fetching active tasks:", error);
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Error loading tasks.</td></tr>`;
    }
}

function handleActiveTaskSearch(searchTerm) {
    const searchText = searchTerm.toLowerCase();
    sessionStorage.setItem('activeTaskSearch', searchText); 

    let searchedTasks = userActiveTasks;
    if (searchText) {
        searchedTasks = userActiveTasks.filter(task => {
            return (
                (task.for && task.for.toLowerCase().includes(searchText)) ||
                (task.ref && task.ref.toLowerCase().includes(searchText)) ||
                (task.po && task.po.toLowerCase().includes(searchText)) ||
                (task.vendorName && task.vendorName.toLowerCase().includes(searchText)) ||
                (task.site && task.site.toLowerCase().includes(searchText)) ||
                (task.group && task.group.toLowerCase().includes(searchText)) ||
                (task.date && task.date.toLowerCase().includes(searchText)) ||
                (task.calendarDate && task.calendarDate.toLowerCase().includes(searchText))
            );
        });
    }
    renderActiveTaskTable(searchedTasks);
}

// ==========================================================================
// AUTO-RECONCILE PR JOBS (FIXED: Order Date & Immediate UI Update)
// ==========================================================================
async function reconcilePendingPRs() {
    // Safety checks: Ensure we have both System Entries and CSV Data
    if (!allSystemEntries || allSystemEntries.length === 0) return;
    if (!allPODataByRef) return;

    const updates = {};
    let updateCount = 0;

    // Loop through all system entries
    allSystemEntries.forEach(entry => {
        // Look for: Job Entries -> Type PR -> Not yet "PO Ready" -> Has a Reference No.
        if (entry.source === 'job_entry' && 
            entry.for === 'PR' && 
            entry.remarks !== 'PO Ready' && 
            entry.ref) {
            
            // Clean the reference key (trim spaces)
            const refKey = String(entry.ref).trim();
            const matchedPO = allPODataByRef[refKey] || allPODataByRef[refKey.toUpperCase()];

            if (matchedPO) {
                // --- FOUND A MATCH! Get Data from CSV ---
                const poNum = matchedPO['PO Number'] || matchedPO['PO'] || matchedPO['po'] || '';
                const supplier = matchedPO['Supplier Name'] || matchedPO['Supplier'] || matchedPO['Name'] || 'N/A';
                const entryPerson = matchedPO['Entry Person'] || matchedPO['entry person'] || 'Records';
                
                // Get Amount (Remove commas)
                let amount = entry.amount; 
                if (matchedPO['Amount']) {
                    amount = String(matchedPO['Amount']).replace(/,/g, '');
                }

                // Get ORDER DATE (Use as Date Responded)
                // Use today as fallback if CSV date is missing
                let orderDate = matchedPO['Order Date'] || formatDate(new Date());
                
                // Normalize date format if needed (e.g., if CSV is DD/MM/YYYY or similar)
                if (orderDate.includes('/')) {
                    // Basic normalizer, or assume it's valid string
                    // You can use your normalizeDateForInput(orderDate) if it needs reformatting
                }

                // 1. Prepare Database Update
                const key = entry.key;
                updates[`job_entries/${key}/po`] = poNum;
                updates[`job_entries/${key}/vendorName`] = supplier; // Save Vendor to DB
                updates[`job_entries/${key}/amount`] = amount;
                updates[`job_entries/${key}/attention`] = entryPerson;
                updates[`job_entries/${key}/remarks`] = 'PO Ready';
                updates[`job_entries/${key}/dateResponded`] = orderDate; 
                
                // 2. UPDATE LOCAL MEMORY IMMEDIATELY (Crucial for UI)
                // This ensures the table updates instantly without needing a second refresh
                entry.po = poNum;
                entry.vendorName = supplier;
                entry.amount = amount;
                entry.attention = entryPerson;
                entry.remarks = 'PO Ready';
                entry.dateResponded = orderDate;
                
                updateCount++;
            }
        }
    });

    // 3. Commit Updates to Firebase
    if (updateCount > 0) {
        console.log(`Auto-Reconcile: Updated ${updateCount} PRs from CSV.`);
        try {
            await db.ref().update(updates);
        } catch (e) {
            console.error("Error committing PR updates:", e);
        }
    }
}

// ==========================================================================
// UPDATED FUNCTION: renderActiveTaskTable (Shows Adjusted/Approved Qty)
// ==========================================================================
function renderActiveTaskTable(tasks) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        if (typeof renderMobileActiveTasks === 'function') renderMobileActiveTasks(tasks);
        return; 
    }

    activeTaskTableBody.innerHTML = '';
    
    // Filter by Hybrid Tabs
    let filteredTasks = tasks.filter(task => {
        const specialTypes = ['Transfer', 'Restock', 'Return', 'Usage'];
        const isSpecialTab = specialTypes.includes(currentActiveTaskFilter);
        const taskIsSpecial = specialTypes.includes(task.for);

        if (isSpecialTab) {
            return task.for === currentActiveTaskFilter;
        } else {
            return task.remarks === currentActiveTaskFilter && !taskIsSpecial;
        }
    });

    if (filteredTasks.length === 0) {
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">No tasks found for "${currentActiveTaskFilter}".</td></tr>`;
        return;
    }

    // Check if we are in Transfer/Usage View
    const isTransferView = filteredTasks.length > 0 && ['Transfer', 'Restock', 'Return', 'Usage'].includes(filteredTasks[0].for);
    const tableHead = document.querySelector('#wd-activetask table thead');

    // --- HEADER SETUP ---
    if (isTransferView) {
        // Change header to reflect dynamic quantity
        tableHead.innerHTML = `
            <tr>
                <th class="desktop-only">Control ID</th>
                <th class="desktop-only">Product Name</th>
                <th class="desktop-only">Details</th>
                <th class="desktop-only">Movement</th>
                <th class="desktop-only">Current Qty</th> <th class="desktop-only">Contact</th>
                <th class="desktop-only">Status</th>
                <th class="desktop-only">Action</th>
            </tr>`;
    } else {
        tableHead.innerHTML = `
            <tr>
                <th class="desktop-only">Job</th>
                <th class="desktop-only">Ref</th>
                <th class="desktop-only">PO</th>
                <th class="desktop-only">Vendor Name</th>
                <th class="desktop-only">Invoice Amount</th>
                <th class="desktop-only">Site</th>
                <th class="desktop-only col-group">Group</th>
                <th class="desktop-only">Date</th>
                <th class="desktop-only">Status</th>
                <th class="desktop-only">Action</th>
            </tr>`;
    }

    const isCEO = document.body.classList.contains('is-ceo');
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin'; 

    filteredTasks.forEach(task => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', task.key);

        if (isTransferView) {
            // --- TRANSFER / USAGE ROW ---
            let actionButtons = `<button class="transfer-action-btn" data-key="${task.key}" style="background-color: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">Action</button>`;
            
            if (isAdmin) {
                actionButtons += `<button class="delete-btn transfer-delete-btn" data-key="${task.key}" style="margin-left: 5px; padding: 6px 12px;">Delete</button>`;
            }

            const fromLoc = task.fromSite || task.fromLocation || 'N/A';
            const toLoc = task.toSite || task.toLocation || 'N/A';
            
            let movement = `${fromLoc} <i class="fa-solid fa-arrow-right" style="color: #888; font-size: 0.8rem;"></i> ${toLoc}`;
            if (task.for === 'Usage') {
                movement = `<span style="color: #6f42c1;">Consumed at ${fromLoc}</span>`;
            }

            // *** FIX: SMART QUANTITY DISPLAY ***
            // 1. Default to what was ordered/requested
            let displayQty = task.orderedQty || task.requiredQty || 0;
            let qtyLabel = ""; // Optional helper text

            // 2. If Source Confirmed (Pending Admin) or Admin Approved (In Transit), show the APPROVED qty
            // This allows the Approver to see what the Source actually confirmed.
            if (task.approvedQty !== undefined && task.approvedQty !== null) {
                displayQty = task.approvedQty;
                // If it differs from ordered, maybe highlight it?
                if (displayQty != task.orderedQty) qtyLabel = " (Adj)";
            }

            // 3. If Received/Completed, show the FINAL RECEIVED qty
            if (task.receivedQty !== undefined && task.receivedQty !== null) {
                displayQty = task.receivedQty;
                qtyLabel = "";
            }
            // ***********************************

            let statusColor = '#333';
            if(task.remarks === 'Pending') statusColor = '#dc3545'; 
            if(task.remarks === 'Pending Admin') statusColor = '#dc3545'; 
            if(task.remarks === 'Approved') statusColor = '#28a745'; 
            if(task.remarks === 'Completed') statusColor = '#003A5C'; 

            row.innerHTML = `
                <td class="desktop-only"><strong>${task.ref || task.controlId || task.controlNumber}</strong></td>
                <td class="desktop-only">${task.vendorName || task.productName}</td>
                <td class="desktop-only">${task.details || ''}</td>
                <td class="desktop-only">${movement}</td>
                <td class="desktop-only" style="font-weight: bold; color: #003A5C;">${displayQty}${qtyLabel}</td>
                <td class="desktop-only">${task.contactName || task.requestor || ''}</td>
                <td class="desktop-only"><span style="color: ${statusColor}; font-weight: bold;">${task.remarks}</span></td>
                <td class="desktop-only">${actionButtons}</td>
            `;

        } else {
            // --- STANDARD ROW (Invoice/PR) ---
            const isInvoiceFromIrwin = task.source === 'invoice' && task.enteredBy === 'Irwin';
            const invName = task.invName || '';
            const isClickable = (isInvoiceFromIrwin || (task.source === 'invoice' && invName)) &&
                                invName.trim() &&
                                invName.toLowerCase() !== 'nil';

            if (isClickable) row.classList.add('clickable-pdf');
            if (isCEO) row.title = "Click to open approval modal";
            else if (isClickable) row.title = "Click to open PDF";

            let actionButtons = '';
            if (isCEO) {
                actionButtons = `<button class="ceo-approve-btn" data-key="${task.key}">Make Approval</button>`;
            } else {
                let srvDoneDisabled = '';
                if (task.source !== 'invoice') srvDoneDisabled = 'disabled title="Only invoice tasks"';
                actionButtons = `
                    <button class="srv-done-btn" data-key="${task.key}" ${srvDoneDisabled}>SRV Done</button>
                    <button class="modify-btn" data-key="${task.key}">Edit Action</button>
                `;
            }
            
            row.innerHTML = `
                <td class="desktop-only">${task.for || ''}</td>
                <td class="desktop-only">${task.ref || ''}</td>
                <td class="desktop-only">${task.po || ''}</td>
                <td class="desktop-only">${task.vendorName || 'N/A'}</td>
                <td class="desktop-only">${formatCurrency(task.amount)}</td>
                <td class="desktop-only">${task.site || ''}</td>
                <td class="desktop-only col-group">${task.group || ''}</td>
                <td class="desktop-only">${task.date || ''}</td>
                <td class="desktop-only">${task.remarks || 'Pending'}</td>
                <td class="desktop-only">${actionButtons}</td>
            `;
        }
        activeTaskTableBody.appendChild(row);
    });
}

function renderMobileActiveTasks(tasks) {
    const container = document.getElementById('active-task-mobile-view');
    const receiptContainer = document.getElementById('mobile-receipt-action-container');
    
    if (container) container.innerHTML = '';

    const isCEO = (currentApprover.Role || '').toLowerCase() === 'admin' && (currentApprover.Position || '').toLowerCase() === 'ceo';

    let filteredTasks = tasks;
    if (currentActiveTaskFilter !== 'All') {
        if (currentActiveTaskFilter === 'Other') {
            filteredTasks = tasks.filter(task => task.remarks !== 'For SRV' && task.remarks !== 'Pending Signature');
        } else {
            // Hybrid filtering logic
            filteredTasks = tasks.filter(task => {
                if(['Transfer', 'Restock', 'Return'].includes(task.for)) return task.for === currentActiveTaskFilter;
                return task.remarks === currentActiveTaskFilter;
            });
        }
    }

    if (!filteredTasks || filteredTasks.length === 0) {
        container.innerHTML = '<div class="im-mobile-empty-state"><p>No active tasks found.</p></div>';
        if (receiptContainer) {
            if (isCEO && ceoProcessedTasks.length > 0) { receiptContainer.classList.remove('hidden'); } 
            else { receiptContainer.classList.add('hidden'); }
        }
        return;
    }

    if (receiptContainer) {
        if (isCEO && ceoProcessedTasks.length > 0) { receiptContainer.classList.remove('hidden'); } 
        else { receiptContainer.classList.add('hidden'); }
    }

    filteredTasks.forEach(task => {
        const invName = task.invName || '';
        const pdfLink = (task.source === 'invoice' && invName.trim() && invName.toLowerCase() !== 'nil') 
            ? `${PDF_BASE_PATH}${encodeURIComponent(invName)}.pdf` 
            : null;

        const card = document.createElement('div');
        card.className = 'mobile-task-card';
        
        let html = `
            <div class="mobile-card-header">
                <div class="m-card-main">
                    <h3>${task.vendorName || task.productName || 'Unknown'}</h3>
                    <div class="m-card-sub">${task.po || task.ref || task.controlNumber} - ${task.site || task.fromSite || ''}</div>
                    <div class="m-card-sub" style="color: #C3502F;">${task.remarks}</div>
                </div>
                <div class="m-card-amount">
                    <span class="m-card-val">${task.amount || task.orderedQty || 0}</span>
                    <span class="m-card-ref">${task.invEntryID || ''}</span>
                </div>
            </div>
            <div class="mobile-card-body">
        `;

        if (pdfLink) {
            html += `<a href="${pdfLink}" target="_blank" class="m-pdf-btn"><i class="fa-regular fa-file-pdf"></i> View Invoice PDF</a>`;
        }

        // Action Buttons for Mobile
        if (['Transfer', 'Restock', 'Return'].includes(task.for)) {
             html += `<div class="m-btn-row"><button class="m-btn-approve transfer-action-btn" data-key="${task.key}" style="background-color: #17a2b8;">Open Action</button></div>`;
        } else {
            html += `
                <div class="m-action-group">
                    <label>Amount to Paid</label>
                    <input type="number" class="m-input-amount" value="${task.amount || ''}" step="0.01" ${!isCEO ? 'readonly' : ''}>
                </div>
                <div class="m-action-group">
                    <label>Note / Remark</label>
                    <textarea class="m-input-note" rows="2" ${!isCEO ? 'readonly' : ''}>${task.note || ''}</textarea>
                </div>
            `;
            if (isCEO) {
                html += `<div class="m-btn-row"><button class="m-btn-approve" data-key="${task.key}">Approve</button><button class="m-btn-reject" data-key="${task.key}">Reject</button></div>`;
            } else {
                html += `<div style="text-align:center; padding:10px; color:#777; background:#f0f0f0; border-radius:8px; margin-top:10px;"><i class="fa-solid fa-lock"></i> View Only</div>`;
            }
        }

        html += `</div>`; 
        card.innerHTML = html;
        
        const header = card.querySelector('.mobile-card-header');
        const body = card.querySelector('.mobile-card-body');
        header.addEventListener('click', () => {
            document.querySelectorAll('.mobile-card-body.open').forEach(el => { if (el !== body) el.classList.remove('open'); });
            body.classList.toggle('open');
        });

        if (isCEO && !['Transfer', 'Restock', 'Return'].includes(task.for)) {
            const btnApprove = card.querySelector('.m-btn-approve');
            const btnReject = card.querySelector('.m-btn-reject');
            const inputAmt = card.querySelector('.m-input-amount');
            const inputNote = card.querySelector('.m-input-note');
            const handleAction = (status) => { processMobileCEOAction(task, status, inputAmt.value, inputNote.value, card); };
            if(btnApprove) btnApprove.addEventListener('click', () => handleAction('Approved'));
            if(btnReject) btnReject.addEventListener('click', () => handleAction('Rejected'));
        }
        container.appendChild(card);
    });
}

async function processMobileCEOAction(taskData, status, amount, note, cardElement) {
    if (!amount || amount < 0) {
        alert("Please enter a valid Amount.");
        return;
    }

    cardElement.style.opacity = '0.5';
    cardElement.style.pointerEvents = 'none';

    const updates = {
        status: status, 
        remarks: status,
        amountPaid: amount,
        amount: amount, 
        note: note ? note.trim() : '',
        dateResponded: formatDate(new Date())
    };

    try {
        if (taskData.source === 'job_entry') {
            await db.ref(`job_entries/${taskData.key}`).update({
                remarks: updates.remarks,
                amount: updates.amount,
                note: updates.note,
                dateResponded: updates.dateResponded 
            });
        } else if (taskData.source === 'invoice') {
            await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update({
                status: updates.status,
                amountPaid: updates.amountPaid,
                note: updates.note
            });
            if (!allInvoiceData) await ensureInvoiceDataFetched();
            const originalInvoice = (allInvoiceData && allInvoiceData[taskData.originalPO]) ? allInvoiceData[taskData.originalPO][taskData.originalKey] : {};
            const updatedInvoiceData = {...originalInvoice, ...updates};
            await updateInvoiceTaskLookup(taskData.originalPO, taskData.originalKey, updatedInvoiceData, taskData.attention);
            updateLocalInvoiceCache(taskData.originalPO, taskData.originalKey, updates);
        }

        taskData.status = status;
        taskData.amountPaid = amount;
        ceoProcessedTasks.push(taskData);

        const taskIndex = userActiveTasks.findIndex(t => t.key === taskData.key);
        if (taskIndex > -1) {
            userActiveTasks.splice(taskIndex, 1);
        }

        cardElement.style.transform = 'translateX(100%)';
        setTimeout(() => {
            cardElement.remove();
            const count = userActiveTasks.length;
            if(activeTaskCountDisplay) activeTaskCountDisplay.textContent = `(Total Tasks: ${count})`;
            renderMobileActiveTasks(userActiveTasks); 
        }, 300);

    } catch (error) {
        console.error("Mobile Action Error:", error);
        alert("Failed to process task. Check connection.");
        cardElement.style.opacity = '1';
        cardElement.style.pointerEvents = 'auto';
    }
}

// ==========================================================================
// 9. WORKDESK LOGIC: JOB ENTRY (CRUD)
// ==========================================================================

// --- Form Reset & Dropdown Population ---

function resetJobEntryForm(keepJobType = false) {
    const jobType = jobForSelect.value;
    jobEntryForm.reset(); 
    
    if (keepJobType) {
         jobForSelect.value = jobType;
    }

    currentlyEditingKey = null;
    ['job-amount', 'job-po'].forEach(id => document.getElementById(id).classList.remove('highlight-field'));
    
    if (attentionSelectChoices.disabled) {
        attentionSelectChoices.enable();
    }
    attentionSelectChoices.clearInput();
    attentionSelectChoices.removeActiveItems();
    populateAttentionDropdown(attentionSelectChoices);
    
    if (siteSelectChoices) {
        siteSelectChoices.clearInput();
        siteSelectChoices.removeActiveItems();
    }

    jobEntryFormTitle.textContent = 'Add New Job Entry';
    
    // --- STRICT UI RESET: FORCE NORMAL VIEW ---
    // 1. Hide Transfer Stuff
    const transferContainer = document.getElementById('transfer-fields-container');
    if (transferContainer) transferContainer.classList.add('hidden');
    
    ['add-transfer-btn', 'update-transfer-btn', 'cancel-transfer-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.classList.add('hidden');
    });

    // 2. Show Normal Stuff
    document.querySelectorAll('.jobentry-form-2col .form-column').forEach(col => col.classList.remove('hidden'));
    addJobButton.classList.remove('hidden');
    updateJobButton.classList.add('hidden'); // Hide update button
    deleteJobButton.classList.add('hidden'); 
    
    addJobButton.disabled = false;
    addJobButton.textContent = 'Add';

    if (jobEntryNavControls) jobEntryNavControls.classList.add('hidden');
    navigationContextList = [];
    navigationContextIndex = -1;

    jobEntrySearchInput.value = '';
    sessionStorage.removeItem('jobEntrySearch');
}


// --- Helper: Toggle "Other" Input ---
function toggleJobOtherInput() {
    const select = document.getElementById('job-for');
    const otherInput = document.getElementById('job-other-specify');
    if (select.value === 'Other') {
        otherInput.classList.remove('hidden');
        otherInput.focus();
    } else {
        otherInput.classList.add('hidden');
        otherInput.value = ''; // Clear it if they switch back
    }
}
// Expose to global scope for HTML onchange
window.toggleJobOtherInput = toggleJobOtherInput;

async function populateAttentionDropdown(choicesInstance) {
    try {
        if (!choicesInstance) return;

        if (allApproversCache) {
            choicesInstance.setChoices(allApproversCache, 'value', 'label', true);
            return;
        }

        choicesInstance.setChoices([{ value: '', label: 'Loading...', disabled: true, selected: true }], 'value', 'label', true);

        if (!allApproverData) {
            const snapshot = await db.ref('approvers').once('value');
            allApproverData = snapshot.val(); 
        }
        const approvers = allApproverData;

        if (approvers) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); 

            const approverOptions = Object.values(approvers).map(approver => {
                if (!approver.Name) return null;

                const isOnVacation = approver.Vacation === true || approver.Vacation === "Yes";
                let isVacationActive = false;
                if (isOnVacation && approver.DateReturn) {
                    try {
                        const returnDate = new Date(approver.DateReturn + 'T00:00:00Z'); 
                         if (!isNaN(returnDate) && returnDate >= today) {
                            isVacationActive = true;
                        }
                    } catch (e) {
                         console.error(`Error parsing return date "${approver.DateReturn}" for ${approver.Name}:`, e);
                    }
                }

                const name = approver.Name || 'No-Name';
                const position = approver.Position || 'No-Pos';
                const site = approver.Site || 'No-Site';
                const newLabel = `${name} - ${position} - ${site}`;
                const displayLabel = isVacationActive ? `${newLabel} (On Vacation)` : newLabel;

                return {
                    value: approver.Name, 
                    label: displayLabel,  
                    customProperties: { 
                        onVacation: isVacationActive,
                        returnDate: approver.DateReturn,
                        replacement: {
                            name: approver.ReplacementName || 'N/A',
                            contact: approver.ReplacementContact || 'N/A',
                            email: approver.ReplacementEmail || 'N/A'
                        }
                    }
                };
            }).filter(Boolean); 

            const choiceList = [
                { value: '', label: 'Select Attention', disabled: true },
                { value: 'None', label: 'None (Clear Selection)' },
                { value: 'All', label: 'All (Send to Records)' }, 
                ...approverOptions.sort((a,b) => a.label.localeCompare(b.label)) 
            ];

            allApproversCache = choiceList; 
            choicesInstance.setChoices(allApproversCache, 'value', 'label', true);

        } else {
            choicesInstance.setChoices([{ value: '', label: 'No approvers found', disabled: true }]);
        }
    } catch (error) {
        console.error("Error populating attention dropdown:", error);
        if (choicesInstance) choicesInstance.setChoices([{ value: '', label: 'Error loading names', disabled: true }]);
    }
}

// --- Helper: Populate Job Types Dynamically ---
function updateJobTypeDropdown() {
    const select = document.getElementById('job-for');
    if (!select) return;

    // 1. Default Types (Hardcoded)
    // ADD 'Return' TO THIS LIST
    const defaultTypes = new Set(['PR', 'Invoice', 'IPC', 'Payment', 'Transfer', 'Trip', 'Report', 'Return', 'Other']);
    
    // 2. Learn from History
    // (allSystemEntries is your cached list of all jobs)
    if (allSystemEntries && allSystemEntries.length > 0) {
        allSystemEntries.forEach(entry => {
            if (entry.for && entry.for.trim() !== '') {
                // If this type isn't in our default list, it's a custom one!
                defaultTypes.add(entry.for.trim());
            }
        });
    }

    // 3. Rebuild Options
    // Save current selection to restore it after rebuild
    const currentVal = select.value; 
    
    select.innerHTML = '<option value="" disabled>Select a Type</option>';
    
    // Sort them alphabetically
    const sortedTypes = Array.from(defaultTypes).sort();

    sortedTypes.forEach(type => {
        if (type === 'Other') return; // Skip 'Other', we add it at the end manually
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        select.appendChild(opt);
    });

    // Always add 'Other' at the end
    const otherOpt = document.createElement('option');
    otherOpt.value = 'Other';
    otherOpt.textContent = '-- Other (Specify) --';
    otherOpt.style.fontWeight = 'bold';
    select.appendChild(otherOpt);

    // Restore selection if possible
    if (currentVal) select.value = currentVal;
}

async function populateSiteDropdown() {
    try {
        if (!siteSelectChoices) return;

        if (allSitesCache) {
            siteSelectChoices.setChoices(allSitesCache, 'value', 'label', true);
            return;
        }
        
        siteSelectChoices.setChoices([{ value: '', label: 'Loading...', disabled: true, selected: true }], 'value', 'label', true);

        // We use the cached CSV content here (fetched in ensureInvoiceDataFetched)
        // If not loaded yet, we fetch it specifically now
        if (!allSitesCSVData) { 
            console.log("Fetching Site.csv for WorkDesk dropdown from Firebase...");
            const url = await getFirebaseCSVUrl('Site.csv');
            if(url) {
                allSitesCSVData = await fetchAndParseSitesCSV(url); 
                cacheTimestamps.sitesCSV = Date.now();
            }
        }
        
        const sites = allSitesCSVData;

        if (sites && sites.length > 0) {
            const siteOptions = sites
                .map(site => (site.site && site.description) ? { value: site.site, label: `${site.site} - ${site.description}` } : null)
                .filter(Boolean)
                .sort((a, b) => { 
                    const numA = parseInt(a.value, 10);
                    const numB = parseInt(b.value, 10);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    return a.label.localeCompare(b.label);
                });

            const choiceList = [{ value: '', label: 'Select a Site', disabled: true }].concat(siteOptions);
            allSitesCache = choiceList; 
            siteSelectChoices.setChoices(allSitesCache, 'value', 'label', true);
        } else {
            siteSelectChoices.setChoices([{ value: '', label: 'No sites found', disabled: true }]);
        }
    } catch (error) {
        console.error("Error populating site dropdown from CSV:", error);
        if (siteSelectChoices) siteSelectChoices.setChoices([{ value: '', label: 'Error loading sites', disabled: true }]);
    }
}

// --- Table Rendering & Search ---

function renderJobEntryTable(entries) {
    jobEntryTableBody.innerHTML = '';
    
    if (!entries || entries.length === 0) {
        jobEntryTableBody.innerHTML = `<tr><td colspan="8">No pending entries found for your search.</td></tr>`;
        return;
    }

    entries.forEach(entry => {
        const row = document.createElement('tr');
    row.setAttribute('data-key', entry.key);
        
        // Make row clickable for editing (unless it's a pure invoice task)
        if (entry.source !== 'invoice') {
            row.style.cursor = 'pointer';
        }

        // --- Attachment Display Logic ---
        let refDisplay = entry.ref || '';
        
        if (entry.attachmentName && entry.attachmentName.trim() !== '') {
            const val = entry.attachmentName.trim();
            
            // Smart Link Construction (Same as above)
            let fullPath;
            if (val.startsWith('http')) {
                fullPath = val;
            } else {
                fullPath = ATTACHMENT_BASE_PATH + encodeURIComponent(val);
            }
            
            // Smart Icon Detection
            let iconClass = "fa-paperclip"; 
            const lowerName = val.toLowerCase();
            
            if (lowerName.endsWith('.zip') || lowerName.endsWith('.rar')) iconClass = "fa-file-zipper";
            else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png')) iconClass = "fa-file-image";
            else if (lowerName.endsWith('.pdf')) iconClass = "fa-file-pdf";
            else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) iconClass = "fa-file-excel";

            // Add the clickable icon
            refDisplay += ` <a href="${fullPath}" target="_blank" style="color: #6f42c1; margin-left: 8px; text-decoration: none;" title="View Attachment" onclick="event.stopPropagation()"><i class="fa-solid ${iconClass}"></i></a>`;
        }
        // -------------------------------------

        row.innerHTML = `
            <td>${entry.for || ''}</td>
            <td>${refDisplay}</td> <td>${entry.po || ''}</td>
            <td>${entry.site || ''}</td>
            <td>${entry.group || ''}</td>
            <td>${entry.attention || ''}</td>
            <td>${entry.date || ''}</td>
            <td>${entry.remarks || 'Pending'}</td>
        `;
        jobEntryTableBody.appendChild(row);
    });
}

async function handleJobEntrySearch(searchTerm) {
    const searchText = (searchTerm || '').toLowerCase();
    sessionStorage.setItem('jobEntrySearch', searchText); 

    jobEntryTableBody.innerHTML = '<tr><td colspan="8">Searching...</td></tr>';

    try {
        await ensureAllEntriesFetched();
        
        userJobEntries = allSystemEntries.filter(entry => 
            entry.enteredBy === currentApprover.Name && !isTaskComplete(entry)
        );

        let filteredEntries = userJobEntries;
        
        if (searchText) {
            filteredEntries = userJobEntries.filter(entry => {
                return (
                    (entry.for && entry.for.toLowerCase().includes(searchText)) ||
                    (entry.ref && entry.ref.toLowerCase().includes(searchText)) ||
                    (entry.site && entry.site.toLowerCase().includes(searchText)) ||
                    (entry.group && entry.group.toLowerCase().includes(searchText)) ||
                    (entry.attention && entry.attention.toLowerCase().includes(searchText)) ||
                    (entry.po && entry.po.toLowerCase().includes(searchText))
                );
            });
        }
        renderJobEntryTable(filteredEntries);
    } catch (error) {
        console.error("Error during job entry search:", error);
        jobEntryTableBody.innerHTML = '<tr><td colspan="8">Error searching entries.</td></tr>';
    }
}

// --- CRUD Handlers ---

function getJobDataFromForm() {
    const formData = new FormData(jobEntryForm);
    let jobType = formData.get('for');
    
    // 1. Handle "Other" Logic
    if (jobType === 'Other') {
        const customType = document.getElementById('job-other-specify').value.trim();
        if (customType) {
            jobType = customType; // Use the text input instead of "Other"
        } else {
            alert("Please specify the Job Type in the text box.");
            return null; // Stop execution
        }
    }

    const data = {
        for: jobType,
        ref: (formData.get('ref') || '').trim(), 
        amount: formData.get('amount') || '',
        po: (formData.get('po') || '').trim(), 
        site: formData.get('site'),
        group: formData.get('group'),
        attention: attentionSelectChoices.getValue(true),
        date: formatDate(new Date()),
        remarks: (formData.get('status') || 'Pending').trim(),
        
        // 2. CRITICAL: Capture Attachment Name explicitly by ID
        attachmentName: (document.getElementById('job-attachment').value || '').trim()
    };
    return data;
}

async function handleAddJobEntry(e) {
    e.preventDefault();
    
    // 1. Disable button immediately
    addJobButton.disabled = true;

    // 2. Get Data (This now handles the "Other" text input validation internally)
    const jobData = getJobDataFromForm();
    
    // 3. If getJobDataFromForm returned null, it means validation failed (e.g., empty "Other" box)
    if (!jobData) {
        addJobButton.disabled = false;
        return; // Stop execution here
    }

    addJobButton.textContent = 'Adding...';
    
    const isInvoiceJob = jobData.for === 'Invoice';

    // 4. Basic Validation
    if (!jobData.for || !jobData.site || !jobData.group) {
        alert('Please fill in Job, Site, and Group.');
        addJobButton.disabled = false;
        addJobButton.textContent = 'Add';
        return;
    }
    
    // 5. Attention Validation (Skip for Invoice)
    if (!isInvoiceJob && !jobData.attention) { 
         alert('Please select an Attention user.'); 
         addJobButton.disabled = false;
         addJobButton.textContent = 'Add';
         return; 
    }

    // 6. IPC Specific Logic (QS Checks & Duplicate Warnings)
    if (jobData.for === 'IPC') {
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
        if (isQS) {
            jobData.remarks = 'Ready';
            if (!jobData.amount || !jobData.po) { 
                alert('As a QS, IPC jobs require both an Amount and PO number.'); 
                addJobButton.disabled = false;
                addJobButton.textContent = 'Add';
                return; 
            }
        } else {
            if (!jobData.po) { 
                alert('For IPC jobs, a PO number is required.'); 
                addJobButton.disabled = false;
                addJobButton.textContent = 'Add';
                return; 
            }
        }
        
        // Check for duplicates
        await ensureAllEntriesFetched(); 
        const duplicatePO = allSystemEntries.find(entry => entry.for === 'IPC' && entry.po && entry.po.trim() !== '' && entry.po === jobData.po);
        if (duplicatePO) {
            const message = `WARNING: An IPC for PO Number "${jobData.po}" already exists.\n\nPress OK if this is a new IPC for this PO.\nPress Cancel to check the "Job Records" section first.`;
            if (!confirm(message)) { 
                addJobButton.disabled = false;
                addJobButton.textContent = 'Add';
                return; 
            }
        }
    }

    // 7. Add Metadata
    jobData.timestamp = Date.now();
    jobData.enteredBy = currentApprover.Name;

    try {
        // 8. Push to Firebase
        await db.ref('job_entries').push(jobData);

        alert('Job Entry Added Successfully!');
        
        // 9. Refresh Data & UI
        await ensureAllEntriesFetched(true); 
        
        // IMPORTANT: Refresh the dropdown list so the new "Custom Type" appears immediately
        updateJobTypeDropdown(); 
        
        handleJobEntrySearch(jobEntrySearchInput.value); 
        resetJobEntryForm();
        
    } catch (error) { 
        console.error("Error adding job entry:", error); 
        alert('Failed to add Job Entry. Please try again.'); 
    } finally {
        // 10. Re-enable button
        addJobButton.disabled = false; 
        addJobButton.textContent = 'Add';
    }
}

async function handleDeleteJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) {
        alert("No entry selected for deletion.");
        return;
    }

    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    
    // --- SECURITY UPDATE: Strict check for "Irwin" ---
    if (userPositionLower !== 'accounting' || currentApprover.Name !== 'Irwin') {
        alert("Access Denied: Only the original Administrator (Irwin) can permanently delete entries.");
        return;
    }
    // ------------------------------------------------

    if (!confirm("Are you sure you want to permanently delete this job entry? This action cannot be undone.")) {
        return;
    }

    try {
        await db.ref(`job_entries/${currentlyEditingKey}`).remove();

        alert('Job Entry Deleted Successfully!');
        
        await ensureAllEntriesFetched(true); 
        handleJobEntrySearch(jobEntrySearchInput.value); 
        resetJobEntryForm();
        populateActiveTasks(); 

    } catch (error) {
        console.error("Error deleting job entry:", error);
        alert('Failed to delete Job Entry. Please try again.');
    }
}

async function handleUpdateJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) { alert("No entry selected for update."); return; }
    
    // 1. Disable button
    updateJobButton.disabled = true;
    updateJobButton.textContent = 'Updating...';

    // 2. Get Data (Reuses the same logic as Add - handles Attachment & Other)
    const jobData = getJobDataFromForm();
    
    if (!jobData) {
        updateJobButton.disabled = false;
        updateJobButton.textContent = 'Update';
        return; // Validation failed
    }
    
    // 3. Special Logic for Invoice Jobs (Clear Attention)
    if (jobData.for === 'Invoice') {
        jobData.attention = '';
    }

    // 4. Validation
    const isInvoiceJob = jobData.for === 'Invoice';
    if (!jobData.for || !jobData.site || !jobData.group) {
        alert('Please fill in Job, Site, and Group.');
        updateJobButton.disabled = false;
        updateJobButton.textContent = 'Update';
        return;
    }
    if (!isInvoiceJob && !jobData.attention) { 
         alert('Please select an Attention user.'); 
         updateJobButton.disabled = false;
         updateJobButton.textContent = 'Update';
         return; 
    }
    
    try {
        // 5. Fetch original to preserve immutable data (timestamp, enteredBy)
        await ensureAllEntriesFetched(); 
        const originalEntry = allSystemEntries.find(entry => entry.key === currentlyEditingKey);
                
        if (originalEntry) { 
            // Keep original creator and time
            jobData.enteredBy = originalEntry.enteredBy; 
            jobData.timestamp = originalEntry.timestamp; 
            jobData.date = originalEntry.date; 

            // Logic: Should we reset 'Date Responded'?
            let newDateResponded = originalEntry.dateResponded || null; 

            if (currentApprover.Name === (originalEntry.attention || '') && 
                !originalEntry.dateResponded && 
                jobData.for !== 'Invoice' && 
                jobData.attention === (originalEntry.attention || '')) 
            {
                // If I am the attention user and I am updating it, mark as responded
                newDateResponded = formatDate(new Date());
            } 
            else {
                // If critical fields changed, reset response date (re-open task)
                const hasChanged = (
                    jobData.for !== originalEntry.for ||
                    jobData.ref !== (originalEntry.ref || '') ||
                    jobData.amount !== (originalEntry.amount || '') ||
                    jobData.po !== (originalEntry.po || '') ||
                    jobData.site !== originalEntry.site ||
                    jobData.group !== originalEntry.group ||
                    jobData.attention !== (originalEntry.attention || '') ||
                    jobData.remarks !== originalEntry.remarks
                );
                
                if (hasChanged) {
                    newDateResponded = null; 
                }
            }
            jobData.dateResponded = newDateResponded;
            
        } else {
            jobData.dateResponded = null;
        }

        // QS Logic Fix
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
        if (jobData.for === 'IPC' && jobData.attention === 'All' && isQS) {
            jobData.remarks = 'Ready';
        }
        
        // 6. Save to Database
        await db.ref(`job_entries/${currentlyEditingKey}`).update(jobData); 

        alert('Job Entry Updated Successfully!');
        
        // 7. Refresh
        await ensureAllEntriesFetched(true); 
        updateJobTypeDropdown(); // Refresh dropdown in case type changed
        handleJobEntrySearch(jobEntrySearchInput.value); 
        resetJobEntryForm(); 
        populateActiveTasks(); 

    } catch (error) { 
        console.error("Error updating job entry:", error); 
        alert('Failed to update Job Entry. Please try again.'); 
    } finally {
        updateJobButton.disabled = false;
        updateJobButton.textContent = 'Update';
    }
}

function populateFormForEditing(key) {
    const entryData = allSystemEntries.find(entry => entry.key === key);
    if (!entryData) return;

    // --- SAFETY CHECK: If it's a Transfer, send it to the Transfer Loader ---
    if (entryData.for === 'Transfer') {
        if (window.loadTransferForEdit) {
            // This function exists in transfer_stock.js and handles the UI switch
            window.loadTransferForEdit(entryData);
        } else {
            console.error("Transfer loader not found.");
        }
        return; // STOP HERE. Do not load normal fields.
    }

    currentlyEditingKey = key;
    
    // --- STRICT UI SWITCH: FORCE NORMAL VIEW ---
    // 1. Hide Transfer Stuff
    const transferContainer = document.getElementById('transfer-fields-container');
    if (transferContainer) transferContainer.classList.add('hidden');
    
    ['add-transfer-btn', 'update-transfer-btn', 'cancel-transfer-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.classList.add('hidden');
    });

    // 2. Show Normal Stuff
    document.querySelectorAll('.jobentry-form-2col .form-column').forEach(col => col.classList.remove('hidden'));
    
    // --- 3. Handle Job Type ---
    const jobTypeSelect = document.getElementById('job-for');
    const otherInput = document.getElementById('job-other-specify');
    
    const exists = Array.from(jobTypeSelect.options).some(opt => opt.value === entryData.for);
    
    if (exists) {
        jobTypeSelect.value = entryData.for || '';
        otherInput.classList.add('hidden');
    } else {
        jobTypeSelect.value = 'Other';
        otherInput.value = entryData.for || '';
        otherInput.classList.remove('hidden');
    }

    // --- 4. Populate Standard Fields ---
    document.getElementById('job-ref').value = entryData.ref || '';
    document.getElementById('job-amount').value = entryData.amount || '';
    document.getElementById('job-po').value = entryData.po || '';
    
    const attachmentInput = document.getElementById('job-attachment');
    if (attachmentInput) {
        attachmentInput.value = entryData.attachmentName || '';
    }

    document.getElementById('job-group').value = entryData.group || '';
    if (siteSelectChoices) siteSelectChoices.setChoiceByValue(entryData.site || '');
    if (attentionSelectChoices) attentionSelectChoices.setChoiceByValue(entryData.attention || '');

    document.getElementById('job-status').value = (entryData.remarks === 'Pending') ? '' : entryData.remarks || '';
    
    jobEntryFormTitle.textContent = 'Editing Job Entry';
    
    // Show Update Button, Hide Add
    addJobButton.classList.add('hidden');
    updateJobButton.classList.remove('hidden');

    // Security: Delete button for Irwin only
    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    if (userPositionLower === 'accounting' && currentApprover.Name === 'Irwin') {
        deleteJobButton.classList.remove('hidden');
    } else {
        deleteJobButton.classList.add('hidden');
    }

    document.getElementById('job-amount').classList.remove('highlight-field');
    document.getElementById('job-po').classList.remove('highlight-field');
    window.scrollTo(0, 0);
}

function updateJobEntryNavControls() {
    if (navigationContextList.length > 0 && navigationContextIndex > -1) {
        jobEntryNavControls.classList.remove('hidden');
        navJobCounter.textContent = (navigationContextIndex + 1) + ' / ' + navigationContextList.length;
        navPrevJobButton.disabled = (navigationContextIndex === 0);
        navNextJobButton.disabled = (navigationContextIndex === navigationContextList.length - 1);
    } else {
        jobEntryNavControls.classList.add('hidden');
    }
}

// ==========================================================================
// 10. WORKDESK LOGIC: REPORTING
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.database(); 

    // DOM Elements
    const navMaterialStock = document.getElementById('nav-material-stock');
    const materialStockSection = document.getElementById('wd-material-stock');
    const stockFormContainer = document.getElementById('material-stock-form-container');
    const stockTableBody = document.getElementById('material-stock-table-body');
    const stockSearchInput = document.getElementById('stock-table-search');
    
    const saveStockBtn = document.getElementById('save-stock-btn');
    const cancelStockBtn = document.getElementById('cancel-stock-btn');
    const stockQtyInput = document.getElementById('stock-qty');
    const transQtyInput = document.getElementById('stock-transferred-qty');
    const balanceDisplay = document.getElementById('stock-balance-display');
    const stockProductName = document.getElementById('stock-product-name');
    const stockDetails = document.getElementById('stock-details');
    const stockProductIdSelect = document.getElementById('stock-product-id');
    const stockFormTitle = document.getElementById('stock-form-title');
    const stockEntryMode = document.getElementById('stock-entry-mode'); 
    const stockEntryKey = document.getElementById('stock-entry-key');

    const addStockBtn = document.getElementById('add-stock-btn'); 
    const uploadStockCsvBtn = document.getElementById('upload-stock-csv-btn');
    const downloadStockTemplateBtn = document.getElementById('download-stock-template-btn');
    const stockCsvInput = document.getElementById('stock-csv-upload');

    // Job Entry Elements
    const jobForSelect = document.getElementById('job-for');
    const standardFormColumns = document.querySelectorAll('.jobentry-form-2col .form-column');
    const transferFieldsContainer = document.getElementById('transfer-fields-container');
    const addJobBtn = document.getElementById('add-job-button'); 
    
    // Transfer Buttons
    const addTransferBtn = document.getElementById('add-transfer-btn');
    const updateTransferBtn = document.getElementById('update-transfer-btn'); 
    const cancelTransferBtn = document.getElementById('cancel-transfer-btn'); 
    
    // Transfer Inputs
    const trfProductIdSelect = document.getElementById('trf-product-id');
    const trfProductName = document.getElementById('trf-product-name');
    const trfDetails = document.getElementById('trf-details');
    const trfFromSite = document.getElementById('trf-from-site');
    const trfToSite = document.getElementById('trf-to-site');
    const trfContactName = document.getElementById('trf-contact-name');
    const trfOperatorName = document.getElementById('trf-operator-name'); 
    const trfShippingDate = document.getElementById('trf-shipping-date');
    const trfAcquiredDate = document.getElementById('trf-acquired-date');
    
    // Status/Remarks
    const trfStatus = document.getElementById('trf-status');
    const trfRemarks = document.getElementById('trf-remarks');

    let currentUser = null;
    let isUserAdmin = false;
    let allStockDataCache = {}; 
    let tableDataCache = []; 
    
    let editingTransferKey = null;

    let fromSiteChoices, toSiteChoices, contactChoices, operatorChoices;
    let trfProductChoices, stockProductChoices;
    let currentStockSearchText = "";

  // ==========================================================================
    // 1. PERMISSION & INITIALIZATION (FIXED)
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

                // --- SAFETY CHECK: Ensure navMaterialStock exists ---
                if (typeof navMaterialStock !== 'undefined' && navMaterialStock && (position === 'Site DC' || isUserAdmin)) {
                    navMaterialStock.classList.remove('hidden');
                }

                if (isUserAdmin) {
                    const addBtn = document.getElementById('ms-add-new-btn');
                    const uploadBtn = document.getElementById('ms-upload-csv-btn');
                    const templBtn = document.getElementById('ms-template-btn');
                    
                    if(addBtn) addBtn.classList.remove('hidden');
                    if(uploadBtn) uploadBtn.classList.remove('hidden');
                    if(templBtn) templBtn.classList.remove('hidden');
                }
            }
        } catch (e) { console.error("Error checking permissions:", e); }
    }
    // Ensure this runs after DOM Load if possible, or keep as is
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkPermissions);
    } else {
        checkPermissions();
    }

    // ==========================================================================
    // 2. DROPDOWN POPULATION
    // ==========================================================================

    async function populateTransferSites() {
        const cachedSites = localStorage.getItem('cached_SITES');
        let sitesData = [];
        if (cachedSites) { try { sitesData = JSON.parse(cachedSites).data || []; } catch (e) {} }
        if (sitesData.length === 0) {
            const url = "https://cdn.jsdelivr.net/gh/DC-database/Hub@main/Site.csv";
            try {
                const response = await fetch(url);
                const text = await response.text();
                const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim() !== '');
                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].split(','); 
                    if(parts.length >= 2) sitesData.push({ site: parts[0].replace(/"/g, '').trim(), description: parts[1].replace(/"/g, '').trim() });
                }
            } catch (err) { }
        }
        const siteOptions = sitesData.map(s => ({ value: s.site, label: `${s.site} - ${s.description}` }))
            .sort((a, b) => (parseInt(a.value) - parseInt(b.value)) || a.label.localeCompare(b.label));

        if (trfFromSite) {
            if (fromSiteChoices) fromSiteChoices.destroy();
            fromSiteChoices = new Choices(trfFromSite, { choices: siteOptions, searchEnabled: true, shouldSort: false, itemSelectText: '', placeholderValue: 'Select Site', removeItemButton: true });
        }
        if (trfToSite) {
            if (toSiteChoices) toSiteChoices.destroy();
            toSiteChoices = new Choices(trfToSite, { choices: siteOptions, searchEnabled: true, shouldSort: false, itemSelectText: '', placeholderValue: 'Select Site', removeItemButton: true });
        }
    }

    async function populateApprovers() {
        try {
            const snapshot = await db.ref('approvers').once('value');
            const approvers = snapshot.val();
            const options = [];
            if (approvers) {
                Object.values(approvers).forEach(app => {
                    if (app.Name) options.push({ value: app.Name, label: `${app.Name} - ${app.Position || ''}` });
                });
            }
            options.sort((a, b) => a.label.localeCompare(b.label));

            if (trfContactName) {
                if (contactChoices) contactChoices.destroy();
                contactChoices = new Choices(trfContactName, { choices: options, searchEnabled: true, shouldSort: false, itemSelectText: '', placeholderValue: 'Select Contact', removeItemButton: true });
            }
            if (trfOperatorName) {
                if (operatorChoices) operatorChoices.destroy();
                operatorChoices = new Choices(trfOperatorName, { choices: options, searchEnabled: true, shouldSort: false, itemSelectText: '', placeholderValue: 'Select Operator', removeItemButton: true });
            }
        } catch (error) { console.error("Error fetching approvers:", error); }
    }

    async function populateProductDropdowns() {
        try {
            const snapshot = await db.ref('material_stock').once('value');
            const data = snapshot.val();
            const productOptions = [];
            allStockDataCache = {}; 

            if (data) {
                Object.entries(data).forEach(([key, item]) => {
                    allStockDataCache[item.productId] = { key: key, ...item };
                    productOptions.push({
                        value: item.productId,
                        label: `${item.productId} - ${item.productName}`,
                        customProperties: { name: item.productName, details: item.details }
                    });
                });
            }
            productOptions.sort((a, b) => a.label.localeCompare(b.label));

            // A. Transfer Form
            if (trfProductIdSelect) {
                if (trfProductChoices) trfProductChoices.destroy();
                trfProductChoices = new Choices(trfProductIdSelect, { choices: productOptions, searchEnabled: true, shouldSort: false, itemSelectText: '', placeholderValue: 'Select/Search Product', removeItemButton: true });
                trfProductIdSelect.addEventListener('choice', (e) => {
                    const selectedId = e.detail.value;
                    if (allStockDataCache[selectedId]) {
                        trfProductName.value = allStockDataCache[selectedId].productName;
                        trfDetails.value = allStockDataCache[selectedId].details;
                    }
                });
            }

            // B. Stock Form
            if (stockProductIdSelect) {
                if (stockProductChoices) stockProductChoices.destroy();
                stockProductChoices = new Choices(stockProductIdSelect, {
                    choices: productOptions,
                    searchEnabled: true,
                    shouldSort: false,
                    itemSelectText: '',
                    placeholderValue: 'Type New ID or Select',
                    removeItemButton: true,
                    addItems: true,
                    addItemText: (value) => `Press Enter to add <b>"${value}"</b>`
                });
                
                const handleProductSelection = (selectedId) => {
                    currentStockSearchText = ""; 
                    if (stockEntryMode.value !== 'add_qty') {
                        if (allStockDataCache[selectedId]) {
                            stockProductName.value = allStockDataCache[selectedId].productName;
                            stockDetails.value = allStockDataCache[selectedId].details;
                            stockQtyInput.value = allStockDataCache[selectedId].stockQty;
                            transQtyInput.value = allStockDataCache[selectedId].transferredQty;
                            stockEntryMode.value = 'edit';
                            stockEntryKey.value = allStockDataCache[selectedId].key;
                            saveStockBtn.textContent = "Update Item Details";
                            updateBalance();
                        } else {
                            stockProductName.value = ""; stockDetails.value = ""; stockQtyInput.value = ""; transQtyInput.value = 0;
                            stockEntryMode.value = 'new'; stockEntryKey.value = "";
                            saveStockBtn.textContent = "Create New Item";
                            updateBalance();
                        }
                    }
                };

                stockProductIdSelect.addEventListener('choice', (e) => handleProductSelection(e.detail.value));
                stockProductIdSelect.addEventListener('addItem', (e) => handleProductSelection(e.detail.value));

                if (stockProductChoices.input && stockProductChoices.input.element) {
                    stockProductChoices.input.element.addEventListener('input', function() { currentStockSearchText = this.value.trim(); });
                    stockProductChoices.input.element.addEventListener('blur', function() {
                        const val = currentStockSearchText;
                        if (val) {
                            const currentSelection = stockProductChoices.getValue(true);
                            if (!currentSelection) {
                                stockProductChoices.setValue([{ value: val, label: val }]);
                                handleProductSelection(val);
                            }
                        }
                    });
                }
            }
        } catch (e) { console.error("Error fetching products:", e); }
    }

    function setDateDefaults() {
        const today = new Date().toISOString().split('T')[0];
        if(trfShippingDate) trfShippingDate.value = today;
        if(trfAcquiredDate) trfAcquiredDate.value = today;
    }

    // ==========================================================================
    // 3. JOB ENTRY: "TRANSFER" LOGIC
    // ==========================================================================

    if (jobForSelect) {
        jobForSelect.addEventListener('change', async (e) => {
            if (e.target.value === 'Transfer') {
                standardFormColumns.forEach(col => col.classList.add('hidden'));
                addJobBtn.classList.add('hidden'); 
                transferFieldsContainer.classList.remove('hidden');
                
                addTransferBtn.classList.remove('hidden');
                updateTransferBtn.classList.add('hidden');
                editingTransferKey = null;
                
                if(cancelTransferBtn) cancelTransferBtn.classList.remove('hidden');
                
                // Only gen ID if not editing
                if (!document.getElementById('trf-control-id').value) generateNextTransferId();
                
                await populateTransferSites(); await populateApprovers(); await populateProductDropdowns();
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
        updateTransferBtn.classList.add('hidden');
        editingTransferKey = null;
        if(cancelTransferBtn) cancelTransferBtn.classList.add('hidden');
    }

    if (cancelTransferBtn) cancelTransferBtn.addEventListener('click', () => { jobForSelect.value = ""; revertToStandardJobEntry(); });

    if (addTransferBtn) {
        addTransferBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            addTransferBtn.textContent = "Saving..."; addTransferBtn.disabled = true;

            const orderedVal = parseFloat(document.getElementById('trf-ordered-qty').value) || 0;
            const deliveredVal = parseFloat(document.getElementById('trf-delivered-qty').value) || 0;
            const qtyToDeduct = deliveredVal > 0 ? deliveredVal : orderedVal;
            const pId = trfProductChoices ? trfProductChoices.getValue(true) : '';

            const stockItem = allStockDataCache[pId];
            if (stockItem) {
                const currentBal = parseFloat(stockItem.balanceQty) || 0;
                if (orderedVal > currentBal) {
                    alert(`Insufficient Stock!\n\nProduct: ${stockItem.productId}\nAvailable: ${currentBal}\nRequested: ${orderedVal}`);
                    addTransferBtn.textContent = "Add Transfer"; addTransferBtn.disabled = false; return;
                }
            } else {
                alert("Warning: Product ID not found in stock database.");
            }

            const transferData = getTransferFormData();
            if (!transferData) { addTransferBtn.textContent = "Add Transfer"; addTransferBtn.disabled = false; return; }

            transferData.timestamp = firebase.database.ServerValue.TIMESTAMP;
            transferData.enteredBy = currentUser ? currentUser.Name : 'Unknown';

            try {
                await db.ref('transfer_entries').push(transferData);
                await updateStockFromTransfer(transferData.productId, qtyToDeduct);
                alert("Transfer Entry Saved!");
                
                // REFRESH PAGE TO UPDATE TABLES
                location.reload();

            } catch (error) { console.error("Error:", error); alert("Failed to save."); addTransferBtn.textContent = "Add Transfer"; addTransferBtn.disabled = false; } 
        });
    }

    if (updateTransferBtn) {
        updateTransferBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!editingTransferKey) return;
            updateTransferBtn.textContent = "Updating..."; updateTransferBtn.disabled = true;

            const transferData = getTransferFormData();
            if (!transferData) { updateTransferBtn.textContent = "Update Transfer"; updateTransferBtn.disabled = false; return; }

            try {
                await db.ref(`transfer_entries/${editingTransferKey}`).update(transferData);
                alert("Transfer Entry Updated Successfully!");
                
                // REFRESH PAGE TO UPDATE TABLES
                location.reload();

            } catch (error) { console.error("Error updating:", error); alert("Failed to update transfer."); updateTransferBtn.textContent = "Update Transfer"; updateTransferBtn.disabled = false; } 
        });
    }

    function getTransferFormData() {
        const orderedVal = parseFloat(document.getElementById('trf-ordered-qty').value) || 0;
        const deliveredVal = parseFloat(document.getElementById('trf-delivered-qty').value) || 0;
        
        const fromSiteVal = fromSiteChoices ? fromSiteChoices.getValue(true) : '';
        const toSiteVal = toSiteChoices ? toSiteChoices.getValue(true) : '';
        const contactVal = contactChoices ? contactChoices.getValue(true) : '';
        const operatorVal = operatorChoices ? operatorChoices.getValue(true) : '';
        const pId = trfProductChoices ? trfProductChoices.getValue(true) : '';
        const productNameVal = document.getElementById('trf-product-name').value;

        if (!fromSiteVal || !toSiteVal || !productNameVal) {
            alert("Please fill in Product, Sites, and Name.");
            return null;
        }

        return {
            controlId: document.getElementById('trf-control-id').value,
            productId: pId,
            productName: productNameVal,
            details: document.getElementById('trf-details').value,
            fromSite: fromSiteVal,
            toSite: toSiteVal,
            orderedQty: orderedVal,
            deliveredQty: deliveredVal,
            shippingDate: document.getElementById('trf-shipping-date').value,
            acquiredDate: document.getElementById('trf-acquired-date').value,
            contactName: contactVal,
            operatorName: operatorVal,
            attention: operatorVal, 
            
            remarks: trfStatus ? trfStatus.value : 'Pending',
            note: trfRemarks ? trfRemarks.value : '',
            
            type: 'Transfer'
        };
    }

    function resetTransferForm() {
        document.querySelectorAll('#transfer-fields-container input').forEach(i => i.value = '');
        if(fromSiteChoices) fromSiteChoices.removeActiveItems();
        if(toSiteChoices) toSiteChoices.removeActiveItems();
        if(contactChoices) contactChoices.removeActiveItems();
        if(operatorChoices) operatorChoices.removeActiveItems();
        if(trfProductChoices) trfProductChoices.removeActiveItems();
        trfStatus.value = 'Pending';
        trfRemarks.value = '';
        setDateDefaults();
    }

    // --- LOAD FOR EDITING ---
    window.loadTransferForEdit = async function(entry) {
        jobForSelect.value = 'Transfer';
        standardFormColumns.forEach(col => col.classList.add('hidden'));
        addJobBtn.classList.add('hidden'); 
        transferFieldsContainer.classList.remove('hidden');
        
        addTransferBtn.classList.add('hidden');
        updateTransferBtn.classList.remove('hidden');
        if(cancelTransferBtn) cancelTransferBtn.classList.remove('hidden');

        editingTransferKey = entry.key;

        await populateTransferSites(); 
        await populateApprovers(); 
        await populateProductDropdowns();

        document.getElementById('trf-control-id').value = entry.controlId || '';
        
        if (trfProductChoices) {
            trfProductChoices.setChoiceByValue(String(entry.productId || ''));
            const pId = String(entry.productId);
            if (allStockDataCache[pId]) {
                document.getElementById('trf-product-name').value = allStockDataCache[pId].productName;
                document.getElementById('trf-details').value = allStockDataCache[pId].details;
            } else {
                document.getElementById('trf-product-name').value = entry.productName || '';
                document.getElementById('trf-details').value = entry.details || '';
            }
        }
        
        if (fromSiteChoices) fromSiteChoices.setChoiceByValue(String(entry.fromSite || ''));
        if (toSiteChoices) toSiteChoices.setChoiceByValue(String(entry.toSite || ''));
        
        document.getElementById('trf-ordered-qty').value = entry.orderedQty || '';
        document.getElementById('trf-delivered-qty').value = entry.deliveredQty || '';
        document.getElementById('trf-shipping-date').value = entry.shippingDate || '';
        document.getElementById('trf-acquired-date').value = entry.acquiredDate || '';
        
        if (contactChoices) contactChoices.setChoiceByValue(String(entry.contactName || ''));
        if (operatorChoices) operatorChoices.setChoiceByValue(String(entry.operatorName || ''));
        
        if (trfStatus) trfStatus.value = entry.remarks || 'Pending';
        if (trfRemarks) trfRemarks.value = entry.note || '';

        window.scrollTo(0, 0);
    };

    // ==========================================================================
    // 4. HELPERS
    // ==========================================================================
    
    async function generateNextTransferId() {
        const controlIdInput = document.getElementById('trf-control-id');
        if (!controlIdInput) return;
        controlIdInput.placeholder = "Generating...";
        try {
            const snapshot = await db.ref('transfer_entries').once('value');
            const data = snapshot.val();
            let maxCount = 0;
            if (data) {
                Object.values(data).forEach(item => {
                    if (item.controlId && item.controlId.startsWith('TRF-')) {
                        const num = parseInt(item.controlId.split('-')[1]);
                        if (!isNaN(num) && num > maxCount) maxCount = num;
                    }
                });
            }
            controlIdInput.value = `TRF-${String(maxCount + 1).padStart(4, '0')}`;
        } catch (error) { controlIdInput.value = "TRF-ERROR"; }
    }

    async function updateStockFromTransfer(productId, qtyToTransfer) {
        if (!productId || qtyToTransfer <= 0) return;
        const stockItem = allStockDataCache[productId];
        if (!stockItem) return;
        try {
            const newTransferred = (parseFloat(stockItem.transferredQty) || 0) + qtyToTransfer;
            const newBalance = (parseFloat(stockItem.stockQty) || 0) - newTransferred;
            await db.ref(`material_stock/${stockItem.key}`).update({
                transferredQty: newTransferred, balanceQty: newBalance, lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            allStockDataCache[productId].transferredQty = newTransferred;
            allStockDataCache[productId].balanceQty = newBalance;
        } catch (error) { console.error("Error auto-updating stock:", error); }
    }

    // ==========================================================================
    // 5. MATERIAL STOCK LOGIC (Unchanged)
    // ==========================================================================
    
    if (navMaterialStock) {
        navMaterialStock.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.workdesk-section').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.workdesk-navigation a').forEach(el => el.classList.remove('active'));
            materialStockSection.classList.remove('hidden');
            navMaterialStock.querySelector('a').classList.add('active');
            loadMaterialStock(); populateProductDropdowns();
        });
    }
    if (stockSearchInput) {
        stockSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = tableDataCache.filter(item => 
                (item.productId && item.productId.toLowerCase().includes(term)) ||
                (item.productName && item.productName.toLowerCase().includes(term)) ||
                (item.details && item.details.toLowerCase().includes(term))
            );
            renderStockTable(filtered);
        });
    }
    if (addStockBtn) {
        addStockBtn.addEventListener('click', () => {
            stockFormContainer.classList.remove('hidden');
            stockFormTitle.textContent = "Create / Edit Item";
            stockEntryMode.value = 'new'; stockEntryKey.value = '';
            if (stockProductChoices) { stockProductChoices.enable(); stockProductChoices.clearStore(); currentStockSearchText=""; populateProductDropdowns(); }
            stockProductName.readOnly = false; stockProductName.style.backgroundColor = "";
            stockDetails.readOnly = false; stockDetails.style.backgroundColor = "";
            document.getElementById('stock-qty-label').textContent = "Stock QTY (Total)";
            clearStockForm();
        });
    }
    window.openAddStockModal = function(key) {
        const item = tableDataCache.find(i => i.key === key);
        if (!item) return;
        stockFormContainer.classList.remove('hidden');
        stockFormTitle.textContent = "Stock In (Add Quantity)";
        stockEntryMode.value = 'add_qty'; stockEntryKey.value = key;
        if (stockProductChoices) { stockProductChoices.setChoiceByValue(item.productId); stockProductChoices.disable(); }
        stockProductName.value = item.productName; stockProductName.readOnly = true; stockProductName.style.backgroundColor = "#e9ecef";
        stockDetails.value = item.details; stockDetails.readOnly = true; stockDetails.style.backgroundColor = "#e9ecef";
        document.getElementById('stock-qty-label').textContent = "Add Qty (Increment)";
        stockQtyInput.value = ""; stockQtyInput.placeholder = "Enter amount to ADD"; stockQtyInput.focus();
        transQtyInput.parentElement.classList.add('hidden'); balanceDisplay.parentElement.classList.add('hidden');
        saveStockBtn.textContent = "Confirm Add Stock";
    };
    if (cancelStockBtn) {
        cancelStockBtn.addEventListener('click', () => {
            stockFormContainer.classList.add('hidden');
            clearStockForm();
            transQtyInput.parentElement.classList.remove('hidden');
            balanceDisplay.parentElement.classList.remove('hidden');
        });
    }
    if (saveStockBtn) {
        saveStockBtn.addEventListener('click', async () => {
            const mode = stockEntryMode.value; const key = stockEntryKey.value;
            const inputQty = parseFloat(stockQtyInput.value) || 0;
            const pId = stockProductChoices ? stockProductChoices.getValue(true) : '';
            const pName = stockProductName.value;
            if (!pId || !pName) { alert("Product ID/Name required."); return; }
            saveStockBtn.textContent = "Saving..."; saveStockBtn.disabled = true;
            try {
                if (mode === 'add_qty') {
                    if (inputQty <= 0) { alert("Enter valid quantity."); saveStockBtn.disabled = false; return; }
                    const snap = await db.ref(`material_stock/${key}`).once('value');
                    const cur = snap.val();
                    const newStock = (parseFloat(cur.stockQty)||0) + inputQty;
                    const newBal = newStock - (parseFloat(cur.transferredQty)||0);
                    await db.ref(`material_stock/${key}`).update({ stockQty: newStock, balanceQty: newBal, lastUpdated: firebase.database.ServerValue.TIMESTAMP });
                    alert("Stock Added!");
                } else {
                    const trans = parseFloat(transQtyInput.value)||0; const bal = inputQty - trans;
                    const pl = { productId: pId, productName: pName, details: stockDetails.value, stockQty: inputQty, transferredQty: trans, balanceQty: bal, lastUpdated: firebase.database.ServerValue.TIMESTAMP };
                    if (mode === 'edit' && key) await db.ref(`material_stock/${key}`).update(pl);
                    else { pl.updatedBy = currentUser.Name; await db.ref('material_stock').push(pl); }
                    alert("Saved!");
                }
                stockFormContainer.classList.add('hidden'); clearStockForm();
                transQtyInput.parentElement.classList.remove('hidden'); balanceDisplay.parentElement.classList.remove('hidden');
                loadMaterialStock(); populateProductDropdowns();
            } catch(e) { alert("Failed."); } finally { saveStockBtn.disabled = false; }
        });
    }
    function clearStockForm() {
        if(stockProductChoices) { stockProductChoices.enable(); stockProductChoices.removeActiveItems(); }
        currentStockSearchText = "";
        stockProductName.value = ""; stockProductName.readOnly = false; stockProductName.style.backgroundColor = "";
        stockDetails.value = ""; stockDetails.readOnly = false; stockDetails.style.backgroundColor = "";
        stockQtyInput.value = ""; transQtyInput.value = "0"; balanceDisplay.textContent = "0";
        stockEntryMode.value = "new"; stockEntryKey.value = "";
    }
    async function loadMaterialStock() {
        stockTableBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        try {
            const snap = await db.ref('material_stock').once('value'); const data = snap.val(); tableDataCache = [];
            if (!data) { stockTableBody.innerHTML = '<tr><td colspan="7">No records.</td></tr>'; return; }
            Object.entries(data).forEach(([k, v]) => tableDataCache.push({ key: k, ...v }));
            renderStockTable(tableDataCache);
        } catch (e) { stockTableBody.innerHTML = '<tr><td colspan="7">Error.</td></tr>'; }
    }
    function renderStockTable(data) {
        stockTableBody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement('tr');
            const bal = parseFloat(item.balanceQty)||0;
            if(bal<=0) row.style.backgroundColor = '#ffe6e6';
            const balDisp = bal<=0 ? `<span style="color:#dc3545;font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> ${bal}</span>` : `<span style="font-weight:bold;color:#003A5C;">${bal}</span>`;
            let acts = `<button class="secondary-btn" onclick="openAddStockModal('${item.key}')" style="padding:4px 10px;font-size:12px;background-color:#28a745;color:white;margin-right:5px;">Add</button>`;
            if(isUserAdmin) acts += `<button class="secondary-btn" onclick="deleteStock('${item.key}')" style="padding:4px 10px;font-size:12px;background-color:#dc3545;color:white;">Delete</button>`;
            row.innerHTML = `<td>${item.productId}</td><td>${item.productName}</td><td>${item.details}</td><td>${item.stockQty}</td><td>${item.transferredQty}</td><td>${balDisp}</td><td>${acts}</td>`;
            stockTableBody.appendChild(row);
        });
    }
    window.deleteStock = async function(key) { if(confirm("Delete?")) { await db.ref(`material_stock/${key}`).remove(); loadMaterialStock(); populateProductDropdowns(); } };
    
    // CSV Logic
    if (downloadStockTemplateBtn) {
        downloadStockTemplateBtn.addEventListener('click', () => {
            const headers = ["Product ID", "Product Name", "Details", "Stock QTY"];
            const exampleRow = ["P-1001", "Cement Bags", "50kg Grey Cement", "100"];
            const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + exampleRow.join(",");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri); link.setAttribute("download", "material_stock_template.csv");
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        });
    }
    if (stockCsvInput) {
        stockCsvInput.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const lines = event.target.result.split('\n').filter(line => line.trim() !== '');
                if (lines.length < 2) { alert("CSV empty."); return; }
                let successCount = 0; const updates = {};
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(val => val.trim().replace(/^"|"$/g, '')); 
                    if (values.length >= 2) { 
                        const newKey = db.ref('material_stock').push().key;
                        updates[newKey] = { productId: values[0], productName: values[1], details: values[2]||'', stockQty: parseFloat(values[3])||0, transferredQty: 0, balanceQty: parseFloat(values[3])||0, lastUpdated: firebase.database.ServerValue.TIMESTAMP, updatedBy: currentUser.Name };
                        successCount++;
                    }
                }
                if (successCount > 0) { try { await db.ref('material_stock').update(updates); alert(`Uploaded ${successCount} records.`); loadMaterialStock(); populateProductDropdowns(); } catch (err) { alert("Error writing DB."); } }
                stockCsvInput.value = '';
            };
            reader.readAsText(file);
        });
    }
});

// ==========================================================================
// 11. TASK MODIFICATION (Modal Logic)
// ==========================================================================

function openModifyTaskModal(taskData) {
    if (!taskData) return;

    modifyTaskKey.value = taskData.key;
    modifyTaskSource.value = taskData.source;
    modifyTaskOriginalPO.value = taskData.originalPO || '';
    modifyTaskOriginalKey.value = taskData.originalKey || '';

    document.getElementById('modify-task-originalAttention').value = taskData.attention || '';

    if (modifyTaskAttentionChoices) {
        modifyTaskAttentionChoices.setChoiceByValue(taskData.attention || '');
    }
    
    const currentStatus = taskData.remarks || 'Pending';
    const standardStatuses = ['For SRV', 'For IPC', 'Report'];
    if (standardStatuses.includes(currentStatus)) {
        modifyTaskStatus.value = currentStatus;
        modifyTaskStatusOtherContainer.classList.add('hidden');
        modifyTaskStatusOther.value = '';
    } else {
        modifyTaskStatus.value = 'Other';
        modifyTaskStatusOtherContainer.classList.remove('hidden');
        modifyTaskStatusOther.value = currentStatus;
    }

    modifyTaskNote.value = taskData.note || ''; 
    modifyTaskModal.classList.remove('hidden');
}

async function handleSaveModifiedTask() {
    const key = modifyTaskKey.value;
    const source = modifyTaskSource.value;
    const originalPO = modifyTaskOriginalPO.value;
    const originalKey = modifyTaskOriginalKey.value;

    const originalAttention = document.getElementById('modify-task-originalAttention').value;

    if (!key || !source) {
        alert("Error: Task identifiers are missing.");
        return;
    }

    let selectedStatus = modifyTaskStatus.value;
    if (selectedStatus === 'Other') {
        selectedStatus = modifyTaskStatusOther.value.trim();
        if (!selectedStatus) {
            alert("Please enter a custom status.");
            return;
        }
    }

    if (!selectedStatus) {
        alert("Please select a new status.");
        return;
    }

    const updates = {
        attention: modifyTaskAttentionChoices.getValue(true) || '',
        remarks: selectedStatus, 
        status: selectedStatus,  
        note: modifyTaskNote.value.trim()
    };

    if (updates.status === 'Under Review' || updates.status === 'With Accounts') {
        updates.attention = '';
    }

    modifyTaskSaveBtn.disabled = true;
    modifyTaskSaveBtn.textContent = 'Saving...';

    try {
        if (source === 'job_entry') {
            await ensureAllEntriesFetched(); 
            const originalEntry = allSystemEntries.find(entry => entry.key === key);

            const newAttention = updates.attention;
            const oldAttention = originalEntry ? originalEntry.attention : '';

            if (originalEntry && currentApprover.Name === oldAttention && newAttention === oldAttention) {
                updates.dateResponded = formatDate(new Date());
            } else if (newAttention !== oldAttention) {
                updates.dateResponded = null; 
            } else {
                updates.dateResponded = originalEntry ? originalEntry.dateResponded : null;
            }

            await db.ref(`job_entries/${key}`).update({
                attention: updates.attention,
                remarks: updates.remarks,
                note: updates.note,
                dateResponded: updates.dateResponded 
            });
            
            allSystemEntries = []; 

        } else if (source === 'invoice' && originalPO && originalKey) {
            await invoiceDb.ref(`invoice_entries/${originalPO}/${originalKey}`).update({
                attention: updates.attention,
                status: updates.status,
                note: updates.note
            });
            
            if (!allInvoiceData) await ensureInvoiceDataFetched(); 
            const originalInvoice = (allInvoiceData && allInvoiceData[originalPO]) ? allInvoiceData[originalPO][originalKey] : {};
            const updatedInvoiceData = {...originalInvoice, ...updates}; 
            
            await updateInvoiceTaskLookup(originalPO, originalKey, updatedInvoiceData, originalAttention);
            updateLocalInvoiceCache(originalPO, originalKey, updates);

            // --- FIX: LOG HISTORY HERE ---
            // This captures the CURRENT USER performing the modification
            if (window.logInvoiceHistory) {
                await window.logInvoiceHistory(originalPO, originalKey, updates.status, updates.note);
            }
            // -----------------------------
        } else {
            throw new Error("Invalid task source or missing keys.");
        }

        alert("Task updated successfully!");
        modifyTaskModal.classList.add('hidden');
        
        await populateActiveTasks(); 

    } catch (error) {
        console.error("Error updating task:", error);
        alert("Failed to update task. Please try again.");
    } finally {
        modifyTaskSaveBtn.disabled = false;
        modifyTaskSaveBtn.textContent = 'Save Changes';
    }
}

// ==========================================================================
// 12. INVOICE MANAGEMENT: HELPERS (INBOX SYNC)
// ==========================================================================

function isInvoiceTaskActive(invoiceData) {
    if (!invoiceData) return false;

    const inactiveStatuses = [
        'With Accounts', 
        'Under Review', 
        'SRV Done', 
        'Paid',
        'On Hold',
        'CLOSED',
        'Cancelled',
        'Approved', 
        'Rejected'  
    ];

    if (inactiveStatuses.includes(invoiceData.status)) {
        return false;
    }
    return !!invoiceData.attention; 
}

async function updateInvoiceTaskLookup(poNumber, invoiceKey, invoiceData, oldAttention) {
    const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
    const newAttention = invoiceData.attention;
    const isTaskNowActive = isInvoiceTaskActive(invoiceData);

    // 1. Add to new user's inbox
    if (isTaskNowActive && newAttention) {
        const poDetails = (poNumber && allPOData && allPOData[poNumber]) ? allPOData[poNumber] : {};
        
        const taskData = {
            ref: invoiceData.invNumber || '',
            po: poNumber,
            amount: invoiceData.invValue || '',
            date: invoiceData.invoiceDate || getTodayDateString(),
            releaseDate: invoiceData.releaseDate || '', 
            status: invoiceData.status || 'Pending',
            vendorName: poDetails['Supplier Name'] || 'N/A',
            site: poDetails['Project ID'] || 'N/A',
            invName: invoiceData.invName || '',
            note: invoiceData.note || ''
        };
        
        const safeNewAttentionKey = sanitizeFirebaseKey(newAttention);
        await invoiceDb.ref(`invoice_tasks_by_user/${safeNewAttentionKey}/${invoiceKey}`).set(taskData);
    }

    // 2. Remove from old user's inbox
    if (oldAttention && (oldAttention !== newAttention || !isTaskNowActive)) {
        const safeOldAttentionKey = sanitizeFirebaseKey(oldAttention);
        await invoiceDb.ref(`invoice_tasks_by_user/${safeOldAttentionKey}/${invoiceKey}`).remove();
    }
}

async function removeInvoiceTaskFromUser(invoiceKey, oldData) {
    if (!oldData || !oldData.attention) return; 
    const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
    const safeOldAttentionKey = sanitizeFirebaseKey(oldData.attention);
    await invoiceDb.ref(`invoice_tasks_by_user/${safeOldAttentionKey}/${invoiceKey}`).remove();
}

// ==========================================================================
// 13. INVOICE MANAGEMENT: SEARCH & DISPLAY
// ==========================================================================

function resetInvoiceForm() {
    const nextId = imInvEntryIdInput.value;
    imNewInvoiceForm.reset();
    
    // Restore ID and Date Defaults
    imInvEntryIdInput.value = nextId;
    imReleaseDateInput.value = getTodayDateString();
    imInvoiceDateInput.value = getTodayDateString(); 
    
    // Clear Attention Dropdown
    if (imAttentionSelectChoices) { 
        imAttentionSelectChoices.clearInput(); 
        imAttentionSelectChoices.removeActiveItems(); 
    }
    
    currentlyEditingInvoiceKey = null;
    imFormTitle.textContent = 'Add New Invoice for this PO';
    imAddInvoiceButton.classList.remove('hidden');
    imUpdateInvoiceButton.classList.add('hidden');

    // --- APPLY VISUAL HIGHLIGHTS (Updated for Attention) ---
    // 1. Remove old highlights
    const inputs = imNewInvoiceForm.querySelectorAll('.input-required-highlight');
    inputs.forEach(el => el.classList.remove('input-required-highlight'));

    // 2. Highlight Standard Inputs
    const mandatoryIds = ['im-inv-no', 'im-inv-value', 'im-invoice-date', 'im-status'];
    mandatoryIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('input-required-highlight');
    });

    // 3. Highlight Choices.js Dropdown (Attention)
    // We must target the visible inner container, not the hidden select
    const attnSelect = document.getElementById('im-attention');
    if (attnSelect) {
        const choicesInner = attnSelect.closest('.choices')?.querySelector('.choices__inner');
        if (choicesInner) {
            choicesInner.classList.add('input-required-highlight');
        }
    }
}

async function handlePOSearch(poNumberFromInput) {
    const poNumber = (poNumberFromInput || imPOSearchInput.value || imPOSearchInputBottom.value).trim().toUpperCase();
    
    if (!poNumber) {
        alert('Please enter a PO Number.');
        return;
    }

    sessionStorage.setItem('imPOSearch', poNumber);
    imPOSearchInput.value = poNumber;
    imPOSearchInputBottom.value = poNumber;
    
    try {
        if (!allPOData) await ensureAllEntriesFetched();

        let poData = allPOData[poNumber];

        // --- NEW LOGIC: FALLBACK MODAL ---
        if (!poData) {
            // Open the Manual Entry Modal
            document.getElementById('manual-po-number').value = poNumber;
            document.getElementById('manual-supplier-id').value = '';
            document.getElementById('manual-vendor-name').value = '';
            document.getElementById('manual-po-amount').value = '';
            
            // Populate Modal Site Dropdown (reuse existing logic)
            const modalSiteSelect = document.getElementById('manual-site-select');
            if (modalSiteSelect.options.length <= 1 && allSitesCSVData) {
                allSitesCSVData.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.site;
                    opt.textContent = `${s.site} - ${s.description}`;
                    modalSiteSelect.appendChild(opt);
                });
            }
            
            document.getElementById('im-manual-po-modal').classList.remove('hidden');
            return; // Stop here, wait for modal save
        }
        // ---------------------------------

        // Standard Logic continues if PO was found...
        proceedWithPOLoading(poNumber, poData);

    } catch (error) {
        console.error("Error searching for PO:", error);
        alert('An error occurred while searching for the PO.');
    }
}

// Helper to continue loading once we have data (Real or Manual)
async function proceedWithPOLoading(poNumber, poData) {
    const invoicesSnapshot = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
    const invoicesData = invoicesSnapshot.val();

    if (!allInvoiceData) allInvoiceData = {};
    allInvoiceData[poNumber] = invoicesData || {}; 

    currentPO = poNumber;
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    
    const poValueText = (isAdmin || isAccounting) ? (poData.Amount ? `QAR ${formatCurrency(poData.Amount)}` : 'N/A') : '---'; 
    const siteText = poData['Project ID'] || 'N/A';
    const vendorText = poData['Supplier Name'] || 'N/A';

    document.querySelectorAll('.im-po-no').forEach(el => el.textContent = poNumber);
    document.querySelectorAll('.im-po-site').forEach(el => el.textContent = siteText);
    document.querySelectorAll('.im-po-value').forEach(el => el.textContent = poValueText);
    document.querySelectorAll('.im-po-vendor').forEach(el => el.textContent = vendorText);
    
    document.querySelectorAll('.im-po-details-container').forEach(el => el.classList.remove('hidden'));

    fetchAndDisplayInvoices(poNumber);
}


function fetchAndDisplayInvoices(poNumber) {
    const invoicesData = allInvoiceData[poNumber];

    let maxInvIdNum = 0; 
    imInvoicesTableBody.innerHTML = '';
    currentPOInvoices = invoicesData || {};

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    let invoiceCount = 0; 
    
    let totalInvValueSum = 0;
    let totalPaidWithRetention = 0;    
    let totalPaidWithoutRetention = 0; 

    if (invoicesData) {
        const invoices = Object.entries(invoicesData).map(([key, value]) => ({ key, ...value }));
        invoiceCount = invoices.length; 

        invoices.forEach(inv => {
            if (inv.invEntryID) {
                const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                if (!isNaN(idNum) && idNum > maxInvIdNum) {
                    maxInvIdNum = idNum;
                }
            }
        });

        invoices.sort((a, b) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        
        invoices.forEach(inv => {
            
            const currentInvValue = parseFloat(inv.invValue) || 0;
            const currentAmtPaid = parseFloat(inv.amountPaid) || 0;
            const noteText = (inv.note || '').toLowerCase();

            totalInvValueSum += currentInvValue;
            totalPaidWithRetention += currentAmtPaid;

            if (!noteText.includes('retention')) {
                totalPaidWithoutRetention += currentAmtPaid;
            }

            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.setAttribute('data-key', inv.key);
            
            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            
            const invValueDisplay = (isAdmin || isAccounting) ? formatCurrency(inv.invValue) : '---';
            const amountPaidDisplay = (isAdmin || isAccounting) ? formatCurrency(inv.amountPaid) : '---';

            // --- Standard Invoice/SRV Links (Using Base Paths) ---
            const invPDFName = inv.invName || '';
            const invPDFLink = (invPDFName.trim() && invPDFName.toLowerCase() !== 'nil')
                ? `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn">Invoice</a>`
                : '';

            const srvPDFName = inv.srvName || '';
            const srvPDFLink = (srvPDFName.trim() && srvPDFName.toLowerCase() !== 'nil')
                ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="action-btn srv-pdf-btn">SRV</a>`
                : '';

            let historyBtn = '';
            if (inv.history || inv.createdAt || inv.originTimestamp) {
                historyBtn = `<button type="button" class="history-btn action-btn" title="View Status History" onclick="event.stopPropagation(); showInvoiceHistory('${poNumber}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>`;
            }

            let deleteBtnHTML = '';
            if (currentApprover.Name === 'Irwin') {
                deleteBtnHTML = `<button class="delete-btn" data-key="${inv.key}">Delete</button>`;
            }

            // --- Reverted: No generic attachment button here (Job Entry only) ---

            row.innerHTML = `
                <td>${inv.invEntryID || ''}</td>
                <td>${inv.invNumber || ''}</td>
                <td>${invoiceDateDisplay}</td>
                <td>${invValueDisplay}</td>
                <td>${amountPaidDisplay}</td>
                <td>${inv.status || ''}</td>
                <td>${releaseDateDisplay}</td>
                <td><div class="action-btn-group">${invPDFLink} ${srvPDFLink} ${historyBtn} ${deleteBtnHTML}</div></td>
            `;
            imInvoicesTableBody.appendChild(row);
        });
        imExistingInvoicesContainer.classList.remove('hidden');
    } else {
        imInvoicesTableBody.innerHTML = '<tr><td colspan="8">No invoices have been entered for this PO yet.</td></tr>';
        imExistingInvoicesContainer.classList.remove('hidden');
    }
    
    if (existingInvoicesCountDisplay) {
        existingInvoicesCountDisplay.textContent = `Existing Invoices (${invoiceCount})`;
    }
    
    const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;
    imInvEntryIdInput.value = nextInvId;
    resetInvoiceForm();
    imNewInvoiceForm.classList.remove('hidden');

    const footer = document.getElementById('im-invoices-table-footer');
    if (footer) {
        const isAdminOrAccounting = isAdmin || isAccounting;
        
        let finalTotalPaid = totalPaidWithoutRetention;

        if (Math.abs(totalPaidWithRetention - totalInvValueSum) < 0.01) {
            finalTotalPaid = totalPaidWithRetention;
        }

        document.getElementById('im-invoices-total-value').textContent = isAdminOrAccounting ? formatCurrency(totalInvValueSum) : '---';
        document.getElementById('im-invoices-total-paid').textContent = isAdminOrAccounting ? formatCurrency(finalTotalPaid) : '---';
        
        footer.style.display = invoiceCount > 0 ? '' : 'none';
    }

    if (pendingJobEntryDataForInvoice) {
        if (pendingJobEntryDataForInvoice.amount) {
            imInvValueInput.value = pendingJobEntryDataForInvoice.amount;
            imAmountPaidInput.value = pendingJobEntryDataForInvoice.amount;
        }
        if (pendingJobEntryDataForInvoice.ref) { document.getElementById('im-inv-no').value = pendingJobEntryDataForInvoice.ref; }
        if (pendingJobEntryDataForInvoice.date) { imInvoiceDateInput.value = convertDisplayDateToInput(pendingJobEntryDataForInvoice.date); }
        pendingJobEntryDataForInvoice = null;
    }
}

// ==========================================================================
// 14. INVOICE MANAGEMENT: SIDEBAR & ACTIVE JOBS
// ==========================================================================

async function populateActiveJobsSidebar() {
    if (!imEntrySidebarList) return;

    await populateActiveTasks();
    const tasksToDisplay = userActiveTasks; 

    const invoiceJobs = tasksToDisplay.filter(task => {
        if (task.source === 'invoice' && task.attention === currentApprover.Name) {
            return true;
        }
        if (task.source === 'job_entry' && task.for === 'Invoice' && (currentApprover?.Position || '').toLowerCase() === 'accounting') {
            return true;
        }
        return false;
    });

    const count = invoiceJobs.length;
    if (activeJobsSidebarCountDisplay) {
        activeJobsSidebarCountDisplay.textContent = `Your Active Invoice Jobs (${count})`;
    }

    imEntrySidebarList.innerHTML = ''; 

    if (invoiceJobs.length === 0) {
        imEntrySidebarList.innerHTML = '<li class="im-sidebar-no-jobs">No active invoice jobs found.</li>';
        return;
    }

    invoiceJobs.forEach(job => {
        const li = document.createElement('li');
        li.className = 'im-sidebar-item';
        li.dataset.key = job.key;
        li.dataset.po = job.po || '';
        li.dataset.ref = job.ref || '';
        li.dataset.amount = job.amount || '';
        li.dataset.date = job.date || '';
        li.dataset.source = job.source || ''; 
        li.dataset.originalKey = job.originalKey || ''; 
        li.dataset.originalPO = job.originalPO || ''; 
        
        // --- UPDATED HTML: Added Group Line ---
        li.innerHTML = `
            <span class="im-sidebar-po">PO: ${job.po || 'N/A'}</span>
            <span class="im-sidebar-vendor">${job.vendorName || 'No Vendor'}</span>
            <span class="im-sidebar-vendor" style="color: #8ecae6; font-size: 0.8rem;">Group: ${job.group || '-'}</span>
            <span class="im-sidebar-amount">QAR ${formatCurrency(job.amount)}</span>
        `;
        imEntrySidebarList.appendChild(li);
    });
}

async function handleActiveJobClick(e) {
    const item = e.target.closest('.im-sidebar-item');
    if (!item) return;

    const { po, ref, amount, date, source, key, originalKey, originalPO } = item.dataset;

    if (!po) {
        alert("This job entry is missing a PO number and cannot be processed.");
        return;
    }

    jobEntryToUpdateAfterInvoice = source === 'job_entry' ? key : null; 
    pendingJobEntryDataForInvoice = { po, ref, amount, date };

    if (source === 'invoice' && originalPO && originalKey) {
        jobEntryToUpdateAfterInvoice = null; 
        pendingJobEntryDataForInvoice = null; 
        
        try {
            await handlePOSearch(originalPO); 
            setTimeout(() => {
                populateInvoiceFormForEditing(originalKey); 
                imBackToActiveTaskButton.classList.remove('hidden');
            }, 200);
        } catch (error) {
            console.error("Error loading existing invoice task:", error);
            alert("Error loading this task. Please try searching for the PO manually.");
        }
        return;
    }
    
    try {
        await handlePOSearch(po); 
        imBackToActiveTaskButton.classList.remove('hidden');
    } catch (error) {
        console.error("Error searching for PO from active job:", error);
        alert("Error searching for PO. Please try again manually.");
    }
}

// ==========================================================================
// 15. INVOICE MANAGEMENT: CRUD OPERATIONS
// ==========================================================================

function populateInvoiceFormForEditing(invoiceKey) {
    const invData = currentPOInvoices[invoiceKey];
    if (!invData) return;
    resetInvoiceForm();
    currentlyEditingInvoiceKey = invoiceKey;
    imInvEntryIdInput.value = invData.invEntryID || '';
    document.getElementById('im-inv-no').value = invData.invNumber || '';
    imInvoiceDateInput.value = normalizeDateForInput(invData.invoiceDate);
    imInvValueInput.value = invData.invValue || '';
    imAmountPaidInput.value = invData.amountPaid || '0';
    document.getElementById('im-inv-name').value = invData.invName || '';
    document.getElementById('im-srv-name').value = invData.srvName || '';
    document.getElementById('im-details').value = invData.details || '';
    imReleaseDateInput.value = normalizeDateForInput(invData.releaseDate);
    imStatusSelect.value = invData.status || 'For SRV';
    document.getElementById('im-note').value = invData.note || '';
    if (imAttentionSelectChoices && invData.attention) {
        imAttentionSelectChoices.setChoiceByValue(invData.attention);
    }
    imFormTitle.textContent = `Editing Invoice: ${invData.invEntryID}`;
    imAddInvoiceButton.classList.add('hidden');
    imUpdateInvoiceButton.classList.remove('hidden');
    imNewInvoiceForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
}

async function handleAddInvoice(e) {
    e.preventDefault();
    if (!currentPO) { alert('No PO is loaded. Please search for a PO first.'); return; }
    
    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;
    
    // Handle status-based clearing
    if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') {
        invoiceData.attention = ''; 
    }

    // --- NEW: STRICT VALIDATION ---
    // 1. Check if required fields are filled
    // Note: We skip 'Attention' check ONLY if status is 'Under Review' or 'With Accounts'
    const isAttentionRequired = (invoiceData.status !== 'Under Review' && invoiceData.status !== 'With Accounts');
    
    if (!invoiceData.invNumber || !invoiceData.invValue || !invoiceData.invoiceDate || !invoiceData.status) {
        alert("Please fill in all highlighted fields:\n- Invoice No.\n- Invoice Value\n- Invoice Date\n- Status");
        return; // STOP HERE
    }

    if (isAttentionRequired && !invoiceData.attention) {
        alert("Please select an 'Attention' person.");
        return; // STOP HERE
    }
    // -----------------------------

    // Auto-generate Invoice Name if blank
    if (!invoiceData.invName || invoiceData.invName.trim() === "") {
        const poDetails = allPOData[currentPO] || {};
        const site = poDetails['Project ID'] || 'N/A';
        let vendor = poDetails['Supplier Name'] || 'N/A';
        if (vendor.length > 21) vendor = vendor.substring(0, 21);
        const invEntryID = invoiceData.invEntryID || 'INV-XX';
        invoiceData.invName = `${site}-${currentPO}-${invEntryID}-${vendor}`;
    }

    invoiceData.dateAdded = getTodayDateString();
    invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;

    if (jobEntryToUpdateAfterInvoice) {
        const originJobEntry = allSystemEntries.find(entry => entry.key === jobEntryToUpdateAfterInvoice);
        if (originJobEntry) {
            invoiceData.originTimestamp = originJobEntry.timestamp;
            invoiceData.originEnteredBy = originJobEntry.enteredBy;
            invoiceData.originType = "Job Entry";
        }
    }

    // Clean up nulls
    Object.keys(invoiceData).forEach(key => { if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key]; });

    try {
        const newRef = await invoiceDb.ref(`invoice_entries/${currentPO}`).push(invoiceData); 
        const newKey = newRef.key; 

        await updateInvoiceTaskLookup(currentPO, newKey, invoiceData, null); 
        
        if (window.logInvoiceHistory) {
             await window.logInvoiceHistory(currentPO, newKey, invoiceData.status, "Initial Entry");
        }

        alert('Invoice added successfully!');
        
        // Update Local Cache
        if (allInvoiceData && newKey) {
             if (!allInvoiceData[currentPO]) allInvoiceData[currentPO] = {};
             allInvoiceData[currentPO][newKey] = invoiceData;
        }
        
        if (invoiceData.note && invoiceData.note.trim() !== '') {
            allUniqueNotes.add(invoiceData.note.trim());
        }

        // Update Origin Job Entry
        if (jobEntryToUpdateAfterInvoice) {
            try {
                const updates = { 
                    remarks: invoiceData.status, 
                    dateResponded: formatDate(new Date()) 
                };
                await db.ref(`job_entries/${jobEntryToUpdateAfterInvoice}`).update(updates);
                jobEntryToUpdateAfterInvoice = null;
                await populateActiveJobsSidebar(); 

            } catch (updateError) {
                console.error("Error updating the original job entry:", updateError);
            }
        }
        
        allSystemEntries = [];
        fetchAndDisplayInvoices(currentPO);
        
    } catch (error) {
        console.error("Error adding invoice:", error);
        alert('Failed to add invoice. Please try again.');
    }
}

async function handleUpdateInvoice(e) {
    e.preventDefault();
    if (!currentPO || !currentlyEditingInvoiceKey) { alert('No invoice selected for update.'); return; }
    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;

    if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
    }

    const originalInvoiceData = currentPOInvoices[currentlyEditingInvoiceKey];

    const newStatus = invoiceData.status;
    const oldStatus = originalInvoiceData ? originalInvoiceData.status : '';

    if (newStatus === 'With Accounts' && oldStatus !== 'With Accounts') {
        invoiceData.releaseDate = getTodayDateString();
    }
    
    const srvNameLower = (invoiceData.srvName || '').toLowerCase();
    if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
        try {
            const poDetails = allPOData[currentPO];
            if (poDetails) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const formattedDate = `${yyyy}${mm}${dd}`;
                let vendor = poDetails['Supplier Name'] || '';
                if (vendor.length > 21) vendor = vendor.substring(0, 21);
                const site = poDetails['Project ID'] || 'N/A';
                const invEntryID = invoiceData.invEntryID || 'INV-XX';
                invoiceData.srvName = `${formattedDate}-${currentPO}-${invEntryID}-${site}-${vendor}`;
                document.getElementById('im-srv-name').value = invoiceData.srvName;
            }
        } catch (error) { console.error("Could not generate SRV Name:", error); alert("Warning: Could not automatically generate the SRV Name."); }
    }

    Object.keys(invoiceData).forEach(key => { if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key]; });

    try {
        await invoiceDb.ref(`invoice_entries/${currentPO}/${currentlyEditingInvoiceKey}`).update(invoiceData);

        const oldAttn = originalInvoiceData ? originalInvoiceData.attention : null;
        await updateInvoiceTaskLookup(currentPO, currentlyEditingInvoiceKey, invoiceData, oldAttn);

        if (newStatus !== oldStatus && window.logInvoiceHistory) {
             await window.logInvoiceHistory(currentPO, currentlyEditingInvoiceKey, newStatus, invoiceData.note);
        }

        alert('Invoice updated successfully!');
        updateLocalInvoiceCache(currentPO, currentlyEditingInvoiceKey, invoiceData);
        
        if (invoiceData.note && invoiceData.note.trim() !== '') {
            allUniqueNotes.add(invoiceData.note.trim());
        }

	    allSystemEntries = []; 
        showIMSection('im-invoice-entry');
        fetchAndDisplayInvoices(currentPO);
    } catch (error) {
        console.error("Error updating invoice:", error);
        alert('Failed to update invoice. Please try again.');
    }
}

async function handleDeleteInvoice(key) {
    if (!currentPO || !key) { alert("Could not identify the invoice to delete."); return; }
    
    // --- SECURITY UPDATE: Strict check for "Irwin" ---
    if (currentApprover.Name !== 'Irwin') {
        alert("Access Denied: Only the original Administrator (Irwin) can delete invoices.");
        return;
    }
    // ------------------------------------------------
    
    const invoiceToDelete = currentPOInvoices[key];
    if (!invoiceToDelete) {
        alert("Error: Cannot find invoice data to delete. Please refresh.");
        return;
    }

    if (confirm("Are you sure you want to delete this invoice entry? This action cannot be undone.")) {
        try {
            await invoiceDb.ref(`invoice_entries/${currentPO}/${key}`).remove();
            await removeInvoiceTaskFromUser(key, invoiceToDelete);
            
            alert("Invoice deleted successfully.");
            removeFromLocalInvoiceCache(currentPO, key);
            fetchAndDisplayInvoices(currentPO);
            
        } catch (error) {
            console.error("Error deleting invoice:", error);
            alert("Failed to delete the invoice. Please try again.");
        }
    }
}

// ==========================================================================
// 16. INVOICE MANAGEMENT: REPORTING ENGINE
// ==========================================================================

async function populateSiteFilterDropdown() {
    const siteFilterSelect = document.getElementById('im-reporting-site-filter');
    if (siteFilterSelect.options.length > 1) return; 
    try {
        await ensureInvoiceDataFetched(); 
        const allSites = allSitesCSVData; 
        if (!allSites) return;
        
        const sites = new Set();
        allSites.forEach(item => {
            if (item.site) {
                sites.add(item.site);
            }
        });

        const sortedSites = Array.from(sites).sort((a, b) => {
            const numA = parseInt(a, 10);
            const numB = parseInt(b, 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b); 
        });

        while (siteFilterSelect.options.length > 1) {
            siteFilterSelect.remove(1);
        }
        sortedSites.forEach(site => {
            const option = document.createElement('option');
            option.value = site;
            option.textContent = site;
            siteFilterSelect.appendChild(option);
        });
    } catch(error) {
        console.error("Error populating site filter:", error);
    }
}


// ==========================================================================
// 16. INVOICE MANAGEMENT: REPORTING ENGINE (SORTED BY BALANCE)
// ==========================================================================

// --- STATE TRACKING VARIABLE ---
let imLastExpandedRowId = null; 

async function populateInvoiceReporting(searchTerm = '') {
    const openRow = document.querySelector('#im-reporting-content .detail-row:not(.hidden)');
    if (openRow) {
        imLastExpandedRowId = openRow.id; 
    } else {
        imLastExpandedRowId = null;
    }

    sessionStorage.setItem('imReportingSearch', searchTerm);

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    currentReportData = []; 
    
    const isMobile = window.innerWidth <= 768;
    const desktopContainer = document.getElementById('im-reporting-content');
    const mobileContainer = document.getElementById('im-reporting-mobile-view');
    
    if (isMobile) {
        if (mobileContainer) mobileContainer.innerHTML = `
            <div class="im-mobile-empty-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <h3>Searching...</h3>
                <p>Please wait a moment.</p>
            </div>`;
        if (desktopContainer) desktopContainer.innerHTML = ''; 
    } else {
        if (desktopContainer) desktopContainer.innerHTML = '<p>Searching... Please wait.</p>';
        if (mobileContainer) mobileContainer.innerHTML = ''; 
    }

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const monthFilter = document.getElementById('im-reporting-date-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;

    try {
        await ensureInvoiceDataFetched(); 

        const allPOs = allPOData;
        const allInvoicesByPO = allInvoiceData;
        const allEcommit = allEcommitDataProcessed; 

        if (!allPOs || !allInvoicesByPO || !allEcommit) throw new Error("Data not loaded.");
        const searchText = searchTerm.toLowerCase();
        const processedPOData = [];
        
        const allUniquePOs = new Set([...Object.keys(allPOs), ...Object.keys(allInvoicesByPO), ...Object.keys(allEcommit)]);

        const filteredPONumbers = Array.from(allUniquePOs).filter(poNumber => {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';
            
            let hasNoteMatch = false;
            if (allInvoicesByPO[poNumber]) {
                hasNoteMatch = Object.values(allInvoicesByPO[poNumber]).some(inv => inv.note && inv.note.toLowerCase().includes(searchText));
            }
            
            const searchMatch = !searchText || poNumber.toLowerCase().includes(searchText) || vendor.toLowerCase().includes(searchText) || hasNoteMatch;
            const siteMatch = !siteFilter || site === siteFilter;
            return searchMatch && siteMatch;
        });

        for (const poNumber of filteredPONumbers) {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            const firebaseInvoices = allInvoicesByPO[poNumber] ? Object.entries(allInvoicesByPO[poNumber]).map(([key, value]) => ({ key, ...value, source: 'firebase' })) : [];
            const firebasePackingSlips = new Set(firebaseInvoices.map(inv => String(inv.invNumber || '').trim().toLowerCase()).filter(Boolean));
            const ecommitInvoices = allEcommit[poNumber] || []; 
            const filteredEcommitInvoices = ecommitInvoices.filter(inv => {
                const csvInvNum = String(inv.invNumber || '').trim().toLowerCase();
                return !csvInvNum || !firebasePackingSlips.has(csvInvNum);
            });

            let invoices = [...firebaseInvoices, ...filteredEcommitInvoices];

            // --- CALCULATE BALANCE FOR SORTING ---
            let totalInvSum = 0;
            invoices.forEach(inv => totalInvSum += parseFloat(inv.invValue) || 0);
            const poVal = parseFloat(poDetails.Amount) || 0;
            const balance = poVal - totalInvSum;

            // Filter Check: Negative Balance
            if (statusFilter === 'Negative Balance') {
                if (balance >= -0.01) continue; 
            }

            // Invoice Sorting (Inner)
            invoices.sort((a, b) => {
                const dateA = new Date(a.invoiceDate || '2099-01-01');
                const dateB = new Date(b.invoiceDate || '2099-01-01');
                return (dateA - dateB) || (a.invNumber || '').localeCompare(b.invNumber || '');
            });

            invoices.forEach((inv, index) => {
                inv.invEntryID = `INV-${String(index + 1).padStart(2, '0')}`;
            });

            let calculatedTotalPaid = 0;
            let latestPaidDateObj = null;

            for (const inv of invoices) {
                if (inv.status === 'Paid') {
                    calculatedTotalPaid += parseFloat(inv.amountPaid) || 0;
                    if (inv.releaseDate) {
                         const d = new Date(normalizeDateForInput(inv.releaseDate));
                         if (!isNaN(d) && (!latestPaidDateObj || d > latestPaidDateObj)) latestPaidDateObj = d;
                    }
                }
            }

            const filteredInvoices = invoices.filter(inv => {
                if (statusFilter === 'Negative Balance') return true; 
                const normRelease = normalizeDateForInput(inv.releaseDate);
                const dateMatch = !monthFilter || (normRelease && normRelease.startsWith(monthFilter));
                const statusMatch = !statusFilter || inv.status === statusFilter;
                return dateMatch && statusMatch;
            });

            if (filteredInvoices.length > 0) {
                processedPOData.push({ 
                    poNumber, poDetails, site, vendor, filteredInvoices, balance, // Store balance here
                    paymentData: { totalPaidAmount: calculatedTotalPaid || 'N/A', datePaid: latestPaidDateObj ? formatDate(latestPaidDateObj) : 'N/A' } 
                });
            }
        }

        // --- SORT BY BALANCE (ASCENDING: Most Negative First) ---
        processedPOData.sort((a, b) => a.balance - b.balance);

        currentReportData = processedPOData;
        if (reportingCountDisplay) reportingCountDisplay.textContent = `(Found: ${currentReportData.length})`;

        if (isMobile) {
            buildMobileReportView(currentReportData);
        } else {
            buildDesktopReportView(currentReportData);
        }

    } catch (error) {
        console.error("Error generating report:", error);
        if (desktopContainer) desktopContainer.innerHTML = '<p>Error loading report.</p>';
    }
}

function buildMobileReportView(reportData) {
    const container = document.getElementById('im-reporting-mobile-view');
    if (!container) return;

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const canViewAmounts = isAdmin || isAccounting;

    if (reportData.length === 0) {
        container.innerHTML = `<div class="im-mobile-empty-state"><i class="fa-solid fa-file-circle-question"></i><h3>No Results Found</h3><p>Try a different search.</p></div>`;
        return;
    }

    let mobileHTML = '';
    
    // REMOVED: reportData.sort by PO Number. It uses the Balance sort now.

    reportData.forEach((poData, poIndex) => {
        const { poNumber, site, vendor, poDetails, filteredInvoices, balance } = poData;
        const toggleId = `mobile-invoice-list-${poIndex}`;
        
        // Use the balance we calculated in populateInvoiceReporting
        const balanceNum = balance !== undefined ? balance : ((parseFloat(poDetails.Amount) || 0) - filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.invValue) || 0), 0));
        
        let statusClass = 'status-progress'; 
        let balanceStyle = "";

        if (balanceNum < -0.01) {
            statusClass = 'status-negative'; // Add CSS for this if you want red card
            balanceStyle = "color: #ff4d4d;"; // Force red text for balance
        } else if (balanceNum > 0.01) {
            statusClass = 'status-open';
        } else {
            // ... (Your existing status logic for Close/Open/New/Pending) ...
            let allClose = filteredInvoices.length > 0;
            const closeStatuses = ['With Accounts', 'Paid', 'Epicore Value'];
            for (const inv of filteredInvoices) {
                if (!closeStatuses.includes(inv.status)) allClose = false;
            }
            if (allClose) statusClass = 'status-close';
        }
        
        const poValueDisplay = canViewAmounts ? `QAR ${formatCurrency(parseFloat(poDetails.Amount))}` : '---';
        const balanceDisplay = canViewAmounts ? `QAR ${formatCurrency(balanceNum)}` : '---';

        mobileHTML += `
            <div class="im-mobile-report-container">
                <div class="im-po-balance-card ${statusClass}" data-toggle-target="#${toggleId}" style="cursor: pointer;">
                    <div class="po-card-header">
                        <div><span class="po-card-vendor">${vendor}</span><h3 class="po-card-ponum">PO: ${poNumber}</h3></div>
                        <i class="fa-solid fa-chevron-down po-card-chevron"></i>
                    </div>
                    <div class="po-card-body">
                        <div class="po-card-grid">
                            <div><span class="po-card-label">Total PO Value</span><span class="po-card-value">${poValueDisplay}</span></div>
                            <div><span class="po-card-label">Balance</span><span class="po-card-value po-card-balance" style="${balanceStyle}">${balanceDisplay}</span></div>
                        </div>
                        <span class="po-card-site">Site: ${site}</span>
                    </div>
                </div>
                <div id="${toggleId}" class="hidden-invoice-list"> 
                    <div class="im-invoice-list-header"><h2>Transactions (${filteredInvoices.length})</h2></div>
                    <ul class="im-invoice-list">
        `;
        
        // ... (Invoice List Loop - Same as before) ...
        filteredInvoices.forEach(inv => {
             // ... generate list items ...
             const invValueDisplay = canViewAmounts ? `QAR ${formatCurrency(inv.invValue)}` : '---';
             const releaseDateDisplay = inv.releaseDate ? formatYYYYMMDD(inv.releaseDate) : '';
             // ... actions ...
             mobileHTML += `<li class="im-invoice-item">...</li>`; // (Simplified for brevity)
        });
        
        mobileHTML += `</ul></div></div>`;
    });
    container.innerHTML = mobileHTML;
}

function buildDesktopReportView(reportData) {
    const container = document.getElementById('im-reporting-content');
    if (!container) return;

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    if (reportData.length === 0) {
        container.innerHTML = '<p>No results found for your search criteria.</p>';
        return;
    }

    let tableHTML = `<table><thead><tr><th></th><th>PO</th><th>Site</th><th>Vendor</th><th>Value</th><th>Balance</th></tr></thead><tbody>`;

    // REMOVED: reportData.sort(...) -> We now use the Balance sort from populateInvoiceReporting

    reportData.forEach(poData => {
        let totalInvValue = 0;
        let totalPaidWithRetention = 0;
        let totalPaidWithoutRetention = 0;
        let allWithAccounts = poData.filteredInvoices.length > 0;
        
        const detailRowId = `detail-${poData.poNumber}`;
        const isExpanded = (detailRowId === imLastExpandedRowId);
        const detailClass = isExpanded ? 'detail-row' : 'detail-row hidden';
        const buttonText = isExpanded ? '-' : '+';
        
        let nestedTableRows = '';
        
        poData.filteredInvoices.forEach(inv => {
            if (inv.status !== 'With Accounts') allWithAccounts = false;
            
            const invValue = parseFloat(inv.invValue) || 0;
            const amountPaid = parseFloat(inv.amountPaid) || 0;
            const noteText = (inv.note || '').toLowerCase();

            totalInvValue += invValue;
            totalPaidWithRetention += amountPaid;
            if (!noteText.includes('retention')) totalPaidWithoutRetention += amountPaid;

            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            const invValueDisplay = (isAdmin || isAccounting) ? formatCurrency(invValue) : '---';
            const amountPaidDisplay = (isAdmin || isAccounting) ? formatCurrency(amountPaid) : '---';

            let actionButtonsHTML = '';
            
            if (inv.source !== 'ecommit' && (isAdmin || isAccounting)) {
                const invPDFName = inv.invName || '';
                const invPDFLink = (invPDFName.trim() && invPDFName.toLowerCase() !== 'nil') ? `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn" onclick="event.stopPropagation();">Invoice</a>` : '';
                const srvPDFName = inv.srvName || '';
                const srvPDFLink = (srvPDFName.trim() && srvPDFName.toLowerCase() !== 'nil') ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="action-btn srv-pdf-btn" onclick="event.stopPropagation();">SRV</a>` : '';
                let historyBtn = (inv.history || inv.createdAt || inv.originTimestamp) ? `<button type="button" class="history-btn action-btn" onclick="event.stopPropagation(); showInvoiceHistory('${poData.poNumber}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>` : '';
                let editBtn = `<button type="button" class="edit-inv-no-btn action-btn" data-po="${poData.poNumber}" data-key="${inv.key}" data-current="${inv.invNumber || ''}"><i class="fa-solid fa-pen-to-square"></i></button>`;
                actionButtonsHTML = `<div class="action-btn-group">${editBtn} ${invPDFLink} ${srvPDFLink} ${historyBtn}</div>`;
            } else if (inv.source === 'ecommit' && (isAdmin || isAccounting)) {
                actionButtonsHTML = `<span style="font-size:0.8rem; color:#6f42c1; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-file-import"></i> Click to Import</span>`;
            }
            
            nestedTableRows += `<tr class="nested-invoice-row" 
                                    data-po-number="${poData.poNumber}" data-invoice-key="${inv.key}" data-source="${inv.source}"
                                    data-inv-number="${inv.invNumber || ''}" data-inv-date="${inv.invoiceDate || ''}"
                                    data-release-date="${inv.releaseDate || ''}" data-inv-value="${inv.invValue || ''}"
                                    title="${inv.source === 'ecommit' ? 'Click to Import' : 'Click to Edit'}">
                <td>${inv.invEntryID || ''}</td>
                <td style="font-weight: bold; color: #00748C;">${inv.invNumber || ''}</td> 
                <td>${invoiceDateDisplay}</td> <td>${invValueDisplay}</td> <td>${amountPaidDisplay}</td>
                <td>${releaseDateDisplay}</td> <td>${inv.status || ''}</td> <td>${inv.note || ''}</td>
                <td>${actionButtonsHTML}</td>
            </tr>`;
        });

        let finalTotalPaid = totalPaidWithoutRetention;
        if (Math.abs(totalPaidWithRetention - totalInvValue) < 0.01) finalTotalPaid = totalPaidWithRetention;

        const totalInvValueDisplay = (isAdmin || isAccounting) ? `<strong>QAR ${formatCurrency(totalInvValue)}</strong>` : '---';
        const totalAmountPaidDisplay = (isAdmin || isAccounting) ? `<strong>QAR ${formatCurrency(finalTotalPaid)}</strong>` : '---';
        const poValueDisplay = (isAdmin || isAccounting) ? (poData.poDetails.Amount ? `QAR ${formatCurrency(poData.poDetails.Amount)}` : 'N/A') : '---';
        
        // Use pre-calculated balance or re-calc here
        const balanceNum = poData.balance !== undefined ? poData.balance : ((parseFloat(poData.poDetails.Amount) || 0) - totalInvValue);
        const balanceDisplay = (isAdmin || isAccounting) ? `QAR ${formatCurrency(balanceNum)}` : '---';

        let highlightClass = '';
        if (isAdmin || isAccounting) {
            if (balanceNum < -0.01) {
                // Negative Balance Highlight (Red Tint)
                highlightClass = 'highlight-negative-balance'; 
            } else if (Math.abs(balanceNum) < 0.01) {
                if (allWithAccounts && Math.abs(finalTotalPaid - parseFloat(poData.poDetails.Amount)) < 0.01) highlightClass = 'highlight-fully-paid';
                else if (allWithAccounts) highlightClass = 'highlight-partial';
            } else if (balanceNum > 0.01) highlightClass = 'highlight-open-balance';
        }

        tableHTML += `<tr class="master-row ${highlightClass}" data-target="#${detailRowId}">
            <td><button class="expand-btn">${buttonText}</button></td>
            <td>${poData.poNumber}</td><td>${poData.site}</td><td>${poData.vendor}</td><td>${poValueDisplay}</td>
            <td style="${balanceNum < -0.01 ? 'color: red; font-weight: bold;' : ''}">${balanceDisplay}</td>
        </tr>`;
        
        tableHTML += `<tr id="${detailRowId}" class="${detailClass}"><td colspan="6"><div class="detail-content"><h4>Invoice Entries for PO ${poData.poNumber}</h4><table class="nested-invoice-table"><thead><tr><th>Inv. Entry</th><th>Inv. No.</th><th>Inv. Date</th><th>Inv. Value</th><th>Amt. Paid</th><th>Release Date</th><th>Status</th><th>Note</th><th>Action</th></tr></thead><tbody>${nestedTableRows}</tbody><tfoot><tr><td colspan="3" style="text-align: right;"><strong>TOTAL</strong></td><td>${totalInvValueDisplay}</td><td>${totalAmountPaidDisplay}</td><td colspan="4"></td></tr></tfoot></table></div></td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

// ==========================================================================
// 17. INVOICE MANAGEMENT: REPORTING ACTIONS
// ==========================================================================

function handleGeneratePrintReport() {
    if (currentReportData.length === 0) {
        alert("No data to print. Please run a search first.");
        return;
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    if (!isAdmin && !isAccounting) {
        alert("You do not have permission to print this report.");
        return;
    }

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;
    let title = "Invoice Records";
    if (siteFilter && !statusFilter) title = `Invoice Report for Site: ${siteFilter}`;
    if (statusFilter && !siteFilter) title = `Invoice Report - Status: ${statusFilter}`;
    if (siteFilter && statusFilter) title = `Invoice Report for Site: ${siteFilter} (Status: ${statusFilter})`;
    
    imPrintReportTitle.textContent = title;
    imPrintReportDate.textContent = `Generated on: ${new Date().toLocaleString('en-GB')}`;

    let totalPOs = currentReportData.length;
    let totalReportValue = 0;
    let totalReportInvValue = 0; 

    currentReportData.forEach(po => {
        totalReportValue += parseFloat(po.poDetails.Amount) || 0;
        po.filteredInvoices.forEach(inv => {
            totalReportInvValue += parseFloat(inv.invValue) || 0;
        });
    });
    
    const totalBalance = totalReportValue - totalReportInvValue; 

    imPrintReportSummaryPOs.textContent = totalPOs;
    imPrintReportSummaryValue.textContent = `QAR ${formatCurrency(totalReportValue)}`;
    
    if (imPrintReportSummaryPaid) {
        const parentDiv = imPrintReportSummaryPaid.parentElement;
        if (parentDiv) {
            const labelSpan = parentDiv.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = 'Total Balance'; 
            }
            parentDiv.style.display = ''; 
        }
        imPrintReportSummaryPaid.textContent = `QAR ${formatCurrency(totalBalance)}`; 
    }

    imPrintReportBody.innerHTML = '';
    
    currentReportData.forEach(po => {
        const poContainer = document.createElement('div');
        poContainer.className = 'print-po-container';

        let totalInvValue = 0;
        let totalAmountPaid = 0; 
        
        po.filteredInvoices.forEach(inv => {
            totalInvValue += parseFloat(inv.invValue) || 0;
            totalAmountPaid += parseFloat(inv.amountPaid) || 0; 
        });

        const poValueNum = parseFloat(po.poDetails.Amount) || 0;
        const balanceNum = poValueNum - totalInvValue;

        const poHeader = document.createElement('div');
        poHeader.className = 'print-po-header'; 
        
        poHeader.innerHTML = `
            <div class="po-header-item"><strong>PO:</strong> ${po.poNumber}</div>
            <div class="po-header-item"><strong>Site:</strong> ${po.site}</div>
            <div class="po-header-item"><strong>PO Value:</strong> QAR ${formatCurrency(poValueNum)}</div>
            <div class="po-header-item po-header-vendor"><strong>Vendor:</strong> ${po.vendor}</div>
            <div class="po-header-item"><strong>Balance:</strong> QAR ${formatCurrency(balanceNum)}</div>
        `;
        poContainer.appendChild(poHeader);

        let invoicesTableHTML = `
            <table class="print-invoice-table">
                <thead>
                    <tr>
                        <th>Inv. Entry</th>
                        <th>Inv. No.</th>
                        <th>Inv. Date</th>
                        <th>Inv. Value</th>
                        <th>Amt. Paid</th>
                        <th>Release Date</th>
                        <th>Status</th>
                        <th>Note</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        po.filteredInvoices.forEach(inv => {
            const invValue = parseFloat(inv.invValue) || 0;
            const status = inv.status || '';

            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';

            invoicesTableHTML += `
                <tr>
                    <td>${inv.invEntryID || ''}</td>
                    <td>${inv.invNumber || ''}</td>
                    <td>${invoiceDateDisplay}</td>
                    <td class="print-number">${formatCurrency(invValue)}</td>
                    <td class="print-number">${formatCurrency(inv.amountPaid)}</td>
                    <td>${releaseDateDisplay}</td>
                    <td>${status || ''}</td>
                    <td>${inv.note || ''}</td>
                </tr>
            `;
        });

        invoicesTableHTML += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="print-footer-label">PO Invoice Totals:</td>
                        <td class="print-number print-footer">${formatCurrency(totalInvValue)}</td>
                        <td class="print-number print-footer">${formatCurrency(totalAmountPaid)}</td>
                        <td colspan="3"></td>
                    </tr>
                </tfoot>
            </table>
        `;
        
        poContainer.innerHTML += invoicesTableHTML;
        imPrintReportBody.appendChild(poContainer);
    });

    if (summaryNotePrintArea) summaryNotePrintArea.classList.add('hidden');
    if (imReportingPrintableArea) imReportingPrintableArea.classList.remove('hidden');

    window.print();
    
    if (imPrintReportSummaryPaid && imPrintReportSummaryPaid.parentElement) {
        const parentDiv = imPrintReportSummaryPaid.parentElement;
        const labelSpan = parentDiv.querySelector('span');
        if (labelSpan) {
            labelSpan.textContent = 'Total Amount Paid'; 
        }
        parentDiv.style.display = ''; 
        imPrintReportSummaryPaid.textContent = 'QAR 0.00'; 
    }

    if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
}

async function handleDownloadCSV() {
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
        alert("You do not have permission to download this report.");
        return;
    }
    if (currentReportData.length === 0) { alert("No data to download. Please perform a search first."); return; }
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["PO", "Site", "Vendor", "PO Value", "Total Paid Amount", "Last Paid Date", "invEntryID", "invNumber", "invoiceDate", "invValue", "amountPaid", "invName", "srvName", "attention", "releaseDate", "status", "note"];
    csvContent += headers.join(",") + "\r\n";
    currentReportData.forEach(po => {
        const totalPaidCSV = (po.paymentData.totalPaidAmount !== 'N/A' ? po.paymentData.totalPaidAmount : '');
        const datePaidCSV = (po.paymentData.datePaid !== 'N/A' ? po.paymentData.datePaid : '');
        po.filteredInvoices.forEach(inv => {
            const row = [po.poNumber, po.site, `"${(po.vendor || '').replace(/"/g, '""')}"`, po.poDetails.Amount || '0', totalPaidCSV, datePaidCSV, inv.invEntryID || '', `"${(inv.invNumber || '').replace(/"/g, '""')}"`, inv.invoiceDate || '', inv.invValue || '0', inv.amountPaid || '0', `"${(inv.invName || '').replace(/"/g, '""')}"`, `"${(inv.srvName || '').replace(/"/g, '""')}"`, inv.attention || '', inv.releaseDate || '', inv.status || '', `"${(inv.note || '').replace(/"/g, '""')}"`];
            csvContent += row.join(",") + "\r\n";
        });
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "invoice_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// REPLACED FUNCTIONS: 1-Hour Reporting
// ==========================================================================

// 1. Updated Daily Report (Last 1 Hour Only)
async function handleDownloadDailyReport() {
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
        alert("You do not have permission to download this report.");
        return;
    }
    
    // Calculate timestamp for 1 hour ago
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    try {
        await ensureInvoiceDataFetched();
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for report.");

        let recentEntries = [];

        // 1. Collect Data
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                
                // Check if created within the last hour
                // We use 'createdAt' which is a server timestamp
                const creationTime = inv.createdAt || 0;
                
                if (creationTime > oneHourAgo) {
                    recentEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?.['Project ID'] || 'N/A',
                        ...inv,
                        sortTime: creationTime
                    });
                }
            }
        }

        if (recentEntries.length === 0) { alert("No new invoices found in the last hour."); return; }

        // 2. Sort by Timestamp: Ascending (Oldest First -> Newest Last)
        recentEntries.sort((a, b) => a.sortTime - b.sortTime);

        // 3. Build CSV
        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Time", "PO", "Site", "Inv No", "Inv Name", "Inv Amount", "Amount Paid", "Status"];
        csvContent += headers.join(",") + "\r\n";

        recentEntries.forEach(entry => {
            let timeString = '';
            if(entry.createdAt) {
                const dateObj = new Date(entry.createdAt);
                if (!isNaN(dateObj.getTime())) {
                    timeString = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }

            const row = [
                timeString,
                entry.po,
                entry.site,
                `"${(entry.invNumber || '').replace(/"/g, '""')}"`,
                `"${(entry.invName || '').replace(/"/g, '""')}"`,
                entry.invValue || '0',
                entry.amountPaid || '0',
                entry.status || ''
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `hourly_entry_report_${timestampStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) { 
        console.error("Error generating hourly report:", error); 
        alert("An error occurred while generating the report."); 
    }
}

// 2. Updated With Accounts Report (Last 1 Hour Only + Added Status)
async function handleDownloadWithAccountsReport() {
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
        alert("You do not have permission to download this report.");
        return;
    }

    // Calculate timestamp for 1 hour ago
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    try {
        await ensureInvoiceDataFetched();
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for report.");

        let recentEntries = [];

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                
                // Check status AND time
                const creationTime = inv.createdAt || 0; // Or you might track a separate 'statusChangeTime' if you have it
                
                // Note: Since we don't strictly track "when status changed", 
                // we are assuming 'createdAt' for new entries or checking if they exist.
                // If you want purely "Moved to Accounts in last hour", 
                // relying on createdAt is the safest fallback unless you log specific status timestamps.
                
                if (inv.status === 'With Accounts' && creationTime > oneHourAgo) {
                    recentEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?.['Project ID'] || 'N/A',
                        ...inv,
                        sortTime: creationTime
                    });
                }
            }
        }

        if (recentEntries.length === 0) { alert("No invoices found for 'With Accounts' in the last hour."); return; }

        // Sort Ascending
        recentEntries.sort((a, b) => a.sortTime - b.sortTime);

        let csvContent = "data:text/csv;charset=utf-8,";
        // ADDED "Status" to headers
        const headers = ["Time", "PO", "Site", "Inv No", "SRV Name", "Inv Amount", "Amount Paid", "Status"];
        csvContent += headers.join(",") + "\r\n";

        recentEntries.forEach(entry => {
            let timeString = '';
            if(entry.createdAt) {
                const dateObj = new Date(entry.createdAt);
                if (!isNaN(dateObj.getTime())) {
                    timeString = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }

            const row = [
                timeString,
                entry.po,
                entry.site,
                `"${(entry.invNumber || '').replace(/"/g, '""')}"`,
                `"${(entry.srvName || '').replace(/"/g, '""')}"`,
                entry.invValue || '0',
                entry.amountPaid || '0',
                entry.status || '' // Added Status Field
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `hourly_with_accounts_report_${timestampStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) { 
        console.error("Error generating report:", error); 
        alert("An error occurred while generating the report."); 
    }
}

// ==========================================================================
// 18. INVOICE MANAGEMENT: BATCH ENTRY
// ==========================================================================

async function populateApproverSelect(selectElement) {
    if (approverListForSelect.length === 0) {
        try {
            if (!allApproverData) { 
                 const snapshot = await db.ref('approvers').once('value');
                 allApproverData = snapshot.val();
            }
            const approvers = allApproverData; 
            if (approvers) {
                const approverOptions = Object.values(approvers)
                    .map(approver => {
                        if (!approver.Name) return null;
                        const name = approver.Name;
                        const position = approver.Position || 'No-Pos';
                        const site = approver.Site || 'No-Site';
                        const newLabel = `${name} - ${position} - ${site}`;
                        return { value: name, label: newLabel }; 
                    })
                    .filter(Boolean) 
                    .sort((a, b) => a.label.localeCompare(b.label)); 
                approverListForSelect = [{ value: '', label: 'Select Attention', placeholder: true }, { value: 'None', label: 'None (Clear)' }, ...approverOptions];
            } else {
                 approverListForSelect = [{ value: '', label: 'No approvers found', placeholder: true }];
            }
        } catch (error) {
            console.error("Error fetching approvers for select:", error);
             approverListForSelect = [{ value: '', label: 'Error loading', placeholder: true }];
        }
    }

    selectElement.innerHTML = ''; 
    approverListForSelect.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.placeholder) {
            option.disabled = true; 
            option.selected = true; 
        }
        selectElement.appendChild(option);
    });
}

function updateBatchCount() {
    if (batchCountDisplay) {
        const rows = batchTableBody.querySelectorAll('tr');
        batchCountDisplay.textContent = `Total in Batch: ${rows.length}`;
    }
}

async function handleAddPOToBatch() {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const poNumber = batchPOInput.value.trim().toUpperCase();
    if (!poNumber) { alert("Please enter a PO Number."); return; }

    sessionStorage.setItem('imBatchSearch', poNumber);
    sessionStorage.removeItem('imBatchNoteSearch'); 

    const batchTableBody = document.getElementById('im-batch-table-body');
    const existingRows = batchTableBody.querySelectorAll(`tr[data-po="${poNumber}"]`);
    let isExistingInvoice = false;
    existingRows.forEach(row => { if (!row.dataset.key) isExistingInvoice = true; });
    if (isExistingInvoice) { alert(`A new invoice for PO ${poNumber} is already in the batch list.`); return; }

    try {
        await ensureInvoiceDataFetched();
        const poData = allPOData[poNumber];
        if (!poData) { alert(`PO Number ${poNumber} not found.`); return; }
        const invoiceData = allInvoiceData[poNumber];

        let maxInvIdNum = 0;
        if (invoiceData) {
            Object.values(invoiceData).forEach(inv => {
                if (inv.invEntryID) {
                    const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                    if (!isNaN(idNum) && idNum > maxInvIdNum) {
                        maxInvIdNum = idNum;
                    }
                }
            });
        }
        const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;

        const site = poData['Project ID'] || 'N/A';
        const vendor = poData['Supplier Name'] || 'N/A';
        const row = document.createElement('tr');
        row.setAttribute('data-po', poNumber); row.setAttribute('data-site', site); row.setAttribute('data-vendor', vendor); row.setAttribute('data-next-invid', nextInvId);

        row.innerHTML = `
            <td>${poNumber} <span class="new-indicator">(New)</span></td>
            <td>${site}</td>
            <td>${vendor}</td>
            <td><input type="text" name="invNumber" class="batch-input"></td>
            <td><input type="text" name="invName" class="batch-input"></td>
            <td><input type="text" name="srvName" class="batch-input"></td>
            <td><input type="date" name="invoiceDate" class="batch-input" value="${getTodayDateString()}"></td>
            <td><input type="number" name="invValue" class="batch-input" step="0.01"></td>
            <td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="0"></td>
            <td><select name="attention" class="batch-input"></select></td>
            <td><select name="status" class="batch-input">
                <option value="For SRV">For SRV</option>
                <option value="Pending">Pending</option>
                <option value="For IPC">For IPC</option>
                <option value="Under Review">Under Review</option>
                <option value="CEO Approval">CEO Approval</option>
                <option value="Report">Report</option>
                <option value="With Accounts">With Accounts</option>
            </select></td>
            <td><input type="text" name="note" class="batch-input"></td>
            <td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>
        `;
        batchTableBody.appendChild(row);

        const attentionSelect = row.querySelector('select[name="attention"]');
        const statusSelect = row.querySelector('select[name="status"]');
        const noteInput = row.querySelector('input[name="note"]');

        await populateApproverSelect(attentionSelect); 

        const choices = new Choices(attentionSelect, {
            searchEnabled: true,
            shouldSort: false, 
            itemSelectText: '',
            removeItemButton: true
        });
        row.choicesInstance = choices; 

        // --- THE FIX IS HERE ---
        const globalAttnValue = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;
        if (globalAttnValue) {
            // Must pass as an array [value] to prevent library errors
            choices.setValue([globalAttnValue]); 
        }
        // -----------------------

        if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
        if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;
        
        updateBatchCount(); 

        batchPOInput.value = ''; batchPOInput.focus();
    } catch (error) { 
        console.error("Error adding PO to batch:", error); 
        alert('An error occurred while adding the PO.'); 
    }
}

async function addInvoiceToBatchTable(invData) {
    const batchTableBody = document.getElementById('im-batch-table-body');
    if (batchTableBody.querySelector(`tr[data-key="${invData.key}"]`)) return;
    
    const row = document.createElement('tr');
    row.setAttribute('data-po', invData.po); 
    row.setAttribute('data-key', invData.key); 
    row.setAttribute('data-site', invData.site); 
    row.setAttribute('data-vendor', invData.vendor);

    row.innerHTML = `
        <td>${invData.po} <span class="existing-indicator">(Existing: ${invData.invEntryID})</span></td>
        <td>${invData.site}</td>
        <td>${invData.vendor}</td>
        <td><input type="text" name="invNumber" class="batch-input" value="${invData.invNumber || ''}"></td>
        <td><input type="text" name="invName" class="batch-input" value="${invData.invName || ''}"></td>
        <td><input type="text" name="srvName" class="batch-input" value="${invData.srvName || ''}"></td>
        <td><input type="date" name="invoiceDate" class="batch-input" value="${normalizeDateForInput(invData.invoiceDate) || ''}"></td>
        <td><input type="number" name="invValue" class="batch-input" step="0.01" value="${invData.invValue || ''}"></td>
        <td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="${invData.amountPaid || '0'}"></td>
        <td><select name="attention" class="batch-input"></select></td>
        <td><select name="status" class="batch-input">
            <option value="For SRV">For SRV</option>
            <option value="Pending">Pending</option>
            <option value="For IPC">For IPC</option>
            <option value="Under Review">Under Review</option>
            <option value="CEO Approval">CEO Approval</option>
            <option value="Report">Report</option>
            <option value="With Accounts">With Accounts</option>
            <option value="On Hold">On Hold</option>
            <option value="CLOSED">CLOSED</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Original PO">Original PO</option>
        </select></td>
        <td><input type="text" name="note" class="batch-input" value="${invData.note || ''}"></td>
        <td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>
    `;
    
    batchTableBody.prepend(row); // Add to top of list
    
    const attentionSelect = row.querySelector('select[name="attention"]');
    const statusSelect = row.querySelector('select[name="status"]');
    const noteInput = row.querySelector('input[name="note"]');

    statusSelect.value = invData.status || 'For SRV';

    await populateApproverSelect(attentionSelect); 

    const choices = new Choices(attentionSelect, {
        searchEnabled: true,
        shouldSort: false, 
        itemSelectText: '',
        removeItemButton: true
    });
    row.choicesInstance = choices; 

    // --- FIX STARTS HERE ---
    const globalAttentionVal = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;
    
    if (globalAttentionVal) {
        // ERROR WAS HERE: It needs square brackets [] to be an array
        choices.setValue([globalAttentionVal]); 
    } else if (invData.attention) {
        // This method handles strings automatically, so it was fine
        choices.setChoiceByValue(invData.attention); 
    }
    // --- FIX ENDS HERE ---

    if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
    if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;
    
    updateBatchCount(); 
}

async function handleBatchGlobalSearch(searchType) {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const searchTerm = batchPOInput.value.trim();
    if (searchType === 'status' && !searchTerm) {
        alert(`Please enter a ${searchType} to search for.`); return; 
    }
    
    let noteSearchTerm = '';
    if (searchType === 'note') {
        if (!imBatchNoteSearchChoices) { alert("Note search is not ready."); return; }
        noteSearchTerm = imBatchNoteSearchChoices.getValue(true);
        if (!noteSearchTerm) { alert("Please select a note from the dropdown to search."); return; }
    }
    
    const finalSearchTerm = (searchType === 'note') ? noteSearchTerm : searchTerm;

    if (searchType === 'status') {
        sessionStorage.setItem('imBatchSearch', searchTerm);
        sessionStorage.removeItem('imBatchNoteSearch'); 
    } else if (searchType === 'note') {
        sessionStorage.setItem('imBatchNoteSearch', noteSearchTerm);
        sessionStorage.removeItem('imBatchSearch'); 
    }
    
    if (!confirm(`This will scan all locally cached invoices.\n\nContinue searching for all invoices with ${searchType} "${finalSearchTerm}"?`)) return;
    
    batchPOInput.disabled = true; const originalPlaceholder = batchPOInput.placeholder; batchPOInput.placeholder = 'Searching local cache...';
    if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.disable();
    
    try {
        await ensureInvoiceDataFetched();
        const allPOs = allPOData, allInvoicesByPO = allInvoiceData;
        let invoicesFound = 0; const promises = [];
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber], poData = allPOs[poNumber] || {}, site = poData['Project ID'] || 'N/A', vendor = poData['Supplier Name'] || 'N/A';
            for (const key in invoices) {
                const inv = invoices[key]; let isMatch = false;
                
                if (searchType === 'status' && inv.status && inv.status.toLowerCase() === finalSearchTerm.toLowerCase()) isMatch = true;
                else if (searchType === 'note' && inv.note && inv.note === finalSearchTerm) isMatch = true; 
                
                if (isMatch) { invoicesFound++; const invData = { key, po: poNumber, site, vendor, ...inv }; promises.push(addInvoiceToBatchTable(invData)); }
            }
        }
        await Promise.all(promises);
        if (invoicesFound === 0) alert(`No invoices found with the ${searchType} "${finalSearchTerm}".`);
        else { 
            alert(`Added ${invoicesFound} invoice(s) to the batch list.`); 
        }
    } catch (error) { console.error("Error during global batch search:", error); alert(`An error occurred: ${error.message}`); }
    finally { 
        batchPOInput.disabled = false; batchPOInput.placeholder = originalPlaceholder; 
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.enable();
    }
}

async function handleSaveBatchInvoices() {
    const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
    if (rows.length === 0) { alert("There are no invoices to save."); return; }
    if (!confirm(`You are about to save/update ${rows.length} invoice(s). Continue?`)) return;

    const savePromises = [];
    const localCacheUpdates = []; 
    let newInvoicesCount = 0, updatedInvoicesCount = 0;

    const getSrvName = (poNumber, site, vendor, invEntryID) => {
        const today = new Date(), yyyy = today.getFullYear(), mm = String(today.getMonth() + 1).padStart(2, '0'), dd = String(today.getDate()).padStart(2, '0');
        if (vendor.length > 21) vendor = vendor.substring(0, 21);
        const invID = invEntryID || 'INV-XX'; 
        return `${yyyy}${mm}${dd}-${poNumber}-${invID}-${site}-${vendor}`;
    };

    await ensureInvoiceDataFetched(); 

    for (const row of rows) {
        const poNumber = row.dataset.po, site = row.dataset.site, existingKey = row.dataset.key; let vendor = row.dataset.vendor;
        let invEntryID = row.dataset.nextInvid; 
        
        if (existingKey) {
            const existingIDSpan = row.querySelector('span.existing-indicator');
            if (existingIDSpan) {
                 const match = existingIDSpan.textContent.match(/\(Existing: (.*)\)/);
                 if (match && match[1]) invEntryID = match[1];
            }
        }

        const invoiceData = {
            invNumber: row.querySelector('[name="invNumber"]').value,
            invName: row.querySelector('[name="invName"]').value,
            srvName: row.querySelector('[name="srvName"]').value,
            invoiceDate: row.querySelector('[name="invoiceDate"]').value,
            invValue: row.querySelector('[name="invValue"]').value,
            amountPaid: row.querySelector('[name="amountPaid"]').value,
            status: row.querySelector('[name="status"]').value,
            note: row.querySelector('[name="note"]').value
        };

        invoiceData.releaseDate = getTodayDateString();
        invoiceData.attention = row.choicesInstance ? row.choicesInstance.getValue(true) : row.querySelector('select[name="attention"]').value;
        if (invoiceData.attention === 'None') invoiceData.attention = '';
        if (invoiceData.status === 'Under Review') invoiceData.attention = '';
        if (invoiceData.status === 'With Accounts') invoiceData.attention = '';
        if (!invoiceData.invValue) { alert(`Invoice Value is required for PO ${poNumber}. Cannot proceed.`); return; }
        if (vendor.length > 21) vendor = vendor.substring(0, 21);

        const srvNameLower = (invoiceData.srvName || '').toLowerCase();
        if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
            invoiceData.srvName = getSrvName(poNumber, site, vendor, invEntryID);
        }

        let promise;
        let oldAttention = null;

        if (existingKey) {
            if (allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) {
                oldAttention = allInvoiceData[poNumber][existingKey].attention;
            }

            promise = invoiceDb.ref(`invoice_entries/${poNumber}/${existingKey}`).update(invoiceData);
            
            savePromises.push(updateInvoiceTaskLookup(poNumber, existingKey, invoiceData, oldAttention));
            
            localCacheUpdates.push({ type: 'update', po: poNumber, key: existingKey, data: invoiceData });
            updatedInvoicesCount++;
        } else {
            invoiceData.invEntryID = invEntryID; 
            invoiceData.dateAdded = getTodayDateString();
            invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;
            if (!invoiceData.invName) {
                 invoiceData.invName = `${site}-${poNumber}-${invoiceData.invEntryID}-${vendor}`;
            }

            promise = invoiceDb.ref(`invoice_entries/${poNumber}`).push(invoiceData);
            newInvoicesCount++;

            savePromises.push(
                promise.then(newRef => {
                    const newKey = newRef.key;
                    const cacheUpdate = localCacheUpdates.find(upd => upd.promise === promise);
                    if (cacheUpdate) cacheUpdate.newKey = newKey; 
                    
                    return updateInvoiceTaskLookup(poNumber, newKey, invoiceData, null); 
                })
            );

            localCacheUpdates.push({ type: 'add', po: poNumber, data: invoiceData, promise: promise });
        }
        savePromises.push(promise);
    }
    try {
        await Promise.all(savePromises);

        if (allInvoiceData) { 
            for (const update of localCacheUpdates) {
                if (update.type === 'update') {
                    if (!allInvoiceData[update.po]) allInvoiceData[update.po] = {};
                    if (!allInvoiceData[update.po][update.key]) allInvoiceData[update.po][update.key] = {};
                    allInvoiceData[update.po][update.key] = {
                        ...allInvoiceData[update.po][update.key],
                        ...update.data
                    };
                } else if (update.type === 'add') {
                    const newKey = update.newKey;
                    if (newKey) {
                        if (!allInvoiceData[update.po]) allInvoiceData[update.po] = {};
                        allInvoiceData[update.po][newKey] = update.data;
                    }
                }
                
                if (update.data.note && update.data.note.trim() !== '') {
                    allUniqueNotes.add(update.data.note.trim());
                }
            }
            console.log("Local invoice cache updated surgically.");
        }

        alert(`${newInvoicesCount} new invoice(s) created and ${updatedInvoicesCount} invoice(s) updated successfully!`);
        
        document.getElementById('im-batch-table-body').innerHTML = ''; 
        updateBatchCount(); 
        
        allSystemEntries = []; 
    } catch (error) {
        console.error("Error saving batch invoices:", error);
        alert("An error occurred while saving. Please check the data and try again.");
    }
}

async function handleBatchModalPOSearch() {
    const modalPOSearchInput = document.getElementById('im-batch-modal-po-input');
    const modalResultsContainer = document.getElementById('im-batch-modal-results');
    const poNumber = modalPOSearchInput.value.trim().toUpperCase();
    if (!poNumber) return;
    modalResultsContainer.innerHTML = '<p>Searching...</p>';
    try {
        await ensureInvoiceDataFetched();
        const poData = allPOData[poNumber], invoicesData = allInvoiceData[poNumber];
        if (!invoicesData) { modalResultsContainer.innerHTML = '<p>No invoices found for this PO.</p>'; return; }
        const site = poData ? poData['Project ID'] || 'N/A' : 'N/A', vendor = poData ? poData['Supplier Name'] || 'N/A' : 'N/A';
        let tableHTML = `<table><thead><tr><th><input type="checkbox" id="modal-select-all"></th><th>Inv. Entry ID</th><th>Inv. No.</th><th>Inv. Value</th><th>Status</th></tr></thead><tbody>`;
        const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        for (const [key, inv] of sortedInvoices) {
            const invDataString = encodeURIComponent(JSON.stringify({ key, po: poNumber, site, vendor, ...inv }));
            tableHTML += `<tr><td><input type="checkbox" class="modal-inv-checkbox" data-invoice='${invDataString}'></td><td>${inv.invEntryID || ''}</td><td>${inv.invNumber || ''}</td><td>${formatCurrency(inv.invValue)}</td><td>${inv.status || ''}</td></tr>`;
        }
        tableHTML += `</tbody></table>`;
        modalResultsContainer.innerHTML = tableHTML;
        document.getElementById('modal-select-all').addEventListener('change', (e) => { modalResultsContainer.querySelectorAll('.modal-inv-checkbox').forEach(chk => chk.checked = e.target.checked); });
    } catch (error) { console.error("Error searching in batch modal:", error); modalResultsContainer.innerHTML = '<p>An error occurred.</p>'; }
}

async function handleAddSelectedToBatch() {
    const selectedCheckboxes = document.getElementById('im-batch-modal-results').querySelectorAll('.modal-inv-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) { 
        alert("Please select at least one invoice."); 
        return; 
    }
    
    // Optional: Change button text briefly
    const addBtn = document.getElementById('im-batch-modal-add-selected-btn');
    if (addBtn) addBtn.textContent = "Adding...";

    try {
        const promises = [];
        for (const checkbox of selectedCheckboxes) {
            try {
                const invData = JSON.parse(decodeURIComponent(checkbox.dataset.invoice));
                promises.push(addInvoiceToBatchTable(invData));
            } catch (err) {
                console.error("Row error:", err);
            }
        }
        
        await Promise.all(promises);

        // --- SPEED WORKFLOW UPDATE ---
        const searchInput = document.getElementById('im-batch-modal-po-input');
        const resultsContainer = document.getElementById('im-batch-modal-results');

        // 1. Instantly clear the input box
        if (searchInput) {
            searchInput.value = '';
        }
        
        // 2. Clear the table and show a small "Ready" indicator
        // We keep this small so it doesn't distract you
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div style="padding: 15px; text-align: center; color: #28a745;">
                    <strong><i class="fa-solid fa-check"></i> Added ${selectedCheckboxes.length} invoice(s).</strong>
                    <p style="color: #777; margin-top: 5px; font-size: 0.9rem;">Ready for next PO...</p>
                </div>
            `;
        }

        // 3. AUTO-FOCUS: This puts the cursor back in the box immediately
        if (searchInput) {
            // Small delay ensures the UI update finishes before we grab focus
            setTimeout(() => {
                searchInput.focus();
            }, 50);
        }

    } catch (error) {
        console.error("Batch Error:", error);
        alert("Error adding batch.");
    } finally {
        // Reset button text
        if (addBtn) addBtn.textContent = "Add Selected to Batch";
    }
}

// ==========================================================================
// 19. INVOICE MANAGEMENT: SUMMARY NOTES
// ==========================================================================

async function initializeNoteSuggestions() {
    if (allUniqueNotes.size > 0) {
        noteSuggestionsDatalist.innerHTML = '';
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });
        return;
    }
    try {
        await ensureInvoiceDataFetched(); 
        noteSuggestionsDatalist.innerHTML = '';
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });
    } catch (error) {
        console.error("Error initializing note suggestions:", error);
    }
}

async function populateNoteDropdown(choicesInstance) {
    if (!choicesInstance) return;

    if (allUniqueNotes.size > 0) {
        const sortedNotes = Array.from(allUniqueNotes).sort();
        const noteOptions = sortedNotes.map(note => ({ value: note, label: note }));
        
        choicesInstance.setChoices(
            [
                { value: '', label: 'Select a note to search...', disabled: true },
                ...noteOptions
            ],
            'value',
            'label',
            true 
        );
        return;
    }

    choicesInstance.setChoices([{ value: '', label: 'Loading notes...', disabled: true }]);
    try {
        await ensureInvoiceDataFetched(); 
        
        const sortedNotes = Array.from(allUniqueNotes).sort();
        const noteOptions = sortedNotes.map(note => ({ value: note, label: note }));

        choicesInstance.setChoices(
            [
                { value: '', label: 'Select a note to search...', disabled: true },
                ...noteOptions
            ],
            'value',
            'label',
            true
        );
    } catch (error) {
        console.error("Error populating note dropdown:", error);
        choicesInstance.setChoices([{ value: '', label: 'Error loading notes', disabled: true }]);
    }
}

async function handleGenerateSummary() {
    const getOrdinal = (n) => {
        if (isNaN(n) || n <= 0) return ''; 
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const prevNote = summaryNotePreviousInput.value.trim();
    const currentNote = summaryNoteCurrentInput.value.trim();
    
    sessionStorage.setItem('imSummaryPrevNote', prevNote);
    sessionStorage.setItem('imSummaryCurrNote', currentNote);

    if (!currentNote) { alert("Please enter a note for the 'Current Note' search."); return; }
    
    summaryNoteGenerateBtn.textContent = 'Generating...'; 
    summaryNoteGenerateBtn.disabled = true;

    try {
        await ensureInvoiceDataFetched(); 
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;
        
        // This variable holds the data from Ecost.csv
        const epicoreData = allEpicoreData; 

        let previousPaymentTotal = 0;
        let currentPaymentTotal = 0;
        let allCurrentInvoices = [];
        
        let srvNameForQR = null;
        let foundSrv = false;

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                
                // 1. Previous Payment Logic
                if (inv.note === prevNote) {
                    previousPaymentTotal += parseFloat(inv.invValue) || 0;
                    
                    if (!foundSrv && inv.srvName && inv.srvName.toLowerCase() !== 'nil' && inv.srvName.trim() !== '') {
                        srvNameForQR = inv.srvName;
                        foundSrv = true; 
                    }
                }

                // 2. Current Payment Logic
                if (inv.note === currentNote) {
                    const vendorName = (allPOs[poNumber] && allPOs[poNumber]['Supplier Name']) ? allPOs[poNumber]['Supplier Name'] : 'N/A';
                    const site = (allPOs[poNumber] && allPOs[poNumber]['Project ID']) ? allPOs[poNumber]['Project ID'] : 'N/A';
                    currentPaymentTotal += parseFloat(inv.invValue) || 0;
                    allCurrentInvoices.push({ po: poNumber, key: key, site, vendor: vendorName, ...inv });
                }
            }
        }
        
        const count = allCurrentInvoices.length;
        if (summaryNoteCountDisplay) {
            summaryNoteCountDisplay.textContent = `(Total Items: ${count})`;
        }
        
        if (allCurrentInvoices.length === 0) { 
            alert(`No invoices found with the note: "${currentNote}"`); 
            summaryNotePrintArea.classList.add('hidden'); 
            return; 
        }

        // QR Code Generation
        const qrElement = document.getElementById('sn-prev-summary-qr');
        if (qrElement) {
            qrElement.innerHTML = ''; 
            if (srvNameForQR) {
                try {
                    const pdfUrl = SRV_BASE_PATH + encodeURIComponent(srvNameForQR) + ".pdf";
                    new QRCode(qrElement, {
                        text: pdfUrl, 
                        width: 60,  
                        height: 60, 
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.L 
                    });
                } catch (e) {
                    console.error("QR generation failed:", e);
                }
            }
        }

        allCurrentInvoices.sort((a, b) => (a.site || '').localeCompare(b.site || ''));
        const vendorData = allPOs[allCurrentInvoices[0].po];
        snVendorName.textContent = vendorData ? vendorData['Supplier Name'] : 'N/A';
        
        const today = new Date();
        snDate.textContent = `Date: ${today.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).replace(/ /g, '-')}`;
        
        snPreviousPayment.textContent = `${formatCurrency(previousPaymentTotal)} Qatari Riyals`;
        snCurrentPayment.textContent = `${formatCurrency(currentPaymentTotal)} Qatari Riyals`;
        snTableBody.innerHTML = '';
        
        for (const inv of allCurrentInvoices) {
            const row = document.createElement('tr');
            row.setAttribute('data-po', inv.po); row.setAttribute('data-key', inv.key);

            const poKey = inv.po.toUpperCase();
            
            // --- UPDATED DESCRIPTION FETCHING LOGIC ---
            // 1. Try Ecost.csv (Epicore) using PO Key
            // 2. If not found, use Invoice Details
            // 3. Fallback to empty string
            let rawDescription = (epicoreData && epicoreData[poKey]) ? epicoreData[poKey] : (inv.details || '');
            
            // Ensure it is a string
            rawDescription = String(rawDescription);

            let truncatedDescription = rawDescription;
            
            // Cut to 20 characters as requested
            if (rawDescription.length > 20) {
                truncatedDescription = rawDescription.substring(0, 20) + "...";
            }
            // ------------------------------------------

            let invCountDisplay = '';
            if (inv.invEntryID) {
                const match = inv.invEntryID.match(/INV-(\d+)/i); 
                if (match && match[1]) {
                    const num = parseInt(match[1], 10);
                    invCountDisplay = getOrdinal(num); 
                } else {
                    invCountDisplay = inv.invEntryID; 
                }
            }

            row.innerHTML = `
                <td>${invCountDisplay}</td>
                <td>${inv.po}</td>
                <td>${inv.site}</td>
                <td><input type="text" class="summary-edit-input" name="details" value="${truncatedDescription}"></td>
                <td><input type="date" class="summary-edit-input" name="invoiceDate" value="${normalizeDateForInput(inv.invoiceDate) || ''}"></td>
                <td>${formatCurrency(inv.invValue)}</td>
            `;
            snTableBody.appendChild(row);
        }
        snTotalNumeric.textContent = formatCurrency(currentPaymentTotal);
        snTotalInWords.textContent = numberToWords(currentPaymentTotal);
        summaryNotePrintArea.classList.remove('hidden');

    } catch (error) { 
        console.error("Error generating summary:", error); 
        alert("An error occurred. Please check the notes and try again."); 
    } finally { 
        summaryNoteGenerateBtn.textContent = 'Generate Summary'; 
        summaryNoteGenerateBtn.disabled = false; 
    }
}

async function handleUpdateSummaryChanges() {
    const rows = snTableBody.querySelectorAll('tr');
    if (rows.length === 0) { alert("No data to update."); return; }
    if (!confirm("Are you sure you want to save the changes for all visible entries?")) return;
    summaryNoteUpdateBtn.textContent = "Updating..."; summaryNoteUpdateBtn.disabled = true;
    const newGlobalStatus = document.getElementById('summary-note-status-input').value, newGlobalSRV = document.getElementById('summary-note-srv-input').value.trim(), today = getTodayDateString();

    const updatePromises = [];
    const localCacheUpdates = []; 

    try {
        await ensureInvoiceDataFetched(); 

        for (const row of rows) {
            const poNumber = row.dataset.po, invoiceKey = row.dataset.key;
            const newDetails = row.querySelector('input[name="details"]').value, newInvoiceDate = row.querySelector('input[name="invoiceDate"]').value;
            if (poNumber && invoiceKey) {
                const updates = { details: newDetails, invoiceDate: newInvoiceDate, releaseDate: today };
                if (newGlobalStatus) updates.status = newGlobalStatus;
                
                if (newGlobalSRV) {
                    updates.srvName = newGlobalSRV;
                }
                
                if (newGlobalStatus === 'With Accounts') updates.attention = '';

                updatePromises.push(invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates));
                localCacheUpdates.push({ po: poNumber, key: invoiceKey, data: updates }); 
                
                const originalInvoice = (allInvoiceData && allInvoiceData[poNumber]) ? allInvoiceData[poNumber][invoiceKey] : {};
                const updatedInvoiceData = {...originalInvoice, ...updates};
                updatePromises.push(updateInvoiceTaskLookup(poNumber, invoiceKey, updatedInvoiceData, originalInvoice.attention));
            }
        }
        await Promise.all(updatePromises);

        if (allInvoiceData) { 
            for (const update of localCacheUpdates) {
                if (allInvoiceData[update.po] && allInvoiceData[update.po][update.key]) {
                    allInvoiceData[update.po][update.key] = {
                        ...allInvoiceData[update.po][update.key],
                        ...update.data
                    };
                }
            }
            console.log("Local invoice cache updated surgically.");
        }

        alert("Changes saved successfully!");
    } catch (error) {
        console.error("Error updating summary changes:", error);
        alert("An error occurred while saving the changes.");
    }
    finally {
        summaryNoteUpdateBtn.textContent = "Update Changes";
        summaryNoteUpdateBtn.disabled = false;
        document.getElementById('summary-note-status-input').value = '';
        document.getElementById('summary-note-srv-input').value = '';
    }
}

// ==========================================================================
// 20. INVOICE MANAGEMENT: DASHBOARD (CHARTS)
// ==========================================================================

async function populateInvoiceDashboard(forceRefresh = false) {
    const dashboardSection = document.getElementById('im-dashboard');
    dashboardSection.innerHTML = `
        <h1>Dashboard</h1>
        <div class="im-dashboard-grid">
            <div class="im-chart-card">
                <h2>Top 5 Vendors</h2>
                <ul id="top-vendors-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card">
                <h2>Top 5 Project Sites</h2>
                <ul id="top-projects-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card">
                <h2>Top 5 Activities</h2>
                <ul id="top-activities-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card full-width-card">
                <div class="dashboard-chart-header">
                    <h2>Yearly Overview</h2>
                    <div class="dashboard-chart-controls">
                        <select id="im-yearly-chart-year-select"></select>
                        <button id="im-dashboard-refresh-btn" class="secondary-btn" title="Force refresh data"><i class="fa-solid fa-sync"></i></button>
                    </div>
                </div>
                <div class="im-chart-container-full">
                    <canvas id="imYearlyChartCanvas"></canvas>
                </div>
            </div>
        </div>
    `;

    const topVendorsList = document.getElementById('top-vendors-list');
    const topProjectsList = document.getElementById('top-projects-list');
    const topActivitiesList = document.getElementById('top-activities-list');
    const yearSelect = document.getElementById('im-yearly-chart-year-select');

    const showLoading = (list) => {
        if (list) list.innerHTML = '<li>Loading...</li>';
    };
    showLoading(topVendorsList);
    showLoading(topProjectsList);
    showLoading(topActivitiesList);

    try {
        const data = await ensureEcostDataFetched(forceRefresh); 

        if (!data) {
            dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please try again later.</p>';
            return;
        }

        const yearlyData = {};
        const availableYears = new Set();

        data.forEach(row => {
            const year = row['Year'];
            if (year) {
                availableYears.add(year);
                if (!yearlyData[year]) {
                    yearlyData[year] = {
                        'Total Committed': Array(12).fill(0),
                        'Delivered Amount': Array(12).fill(0),
                        'Outstanding': Array(12).fill(0),
                    };
                }
                const month = row['Month']; 
                if (month !== null) {
                    yearlyData[year]['Total Committed'][month] += row['Total Committed'];
                    yearlyData[year]['Delivered Amount'][month] += row['Delivered Amount'];
                    yearlyData[year]['Outstanding'][month] += row['Outstanding'];
                }
            }
        });

        const sortedYears = Array.from(availableYears).sort((a, b) => b - a);

        yearSelect.innerHTML = '';
        if (sortedYears.length === 0) {
            document.getElementById('imYearlyChartCanvas').style.display = 'none';
            yearSelect.innerHTML = '<option>No data</option>';
            topVendorsList.innerHTML = '<li>No data found.</li>';
            topProjectsList.innerHTML = '<li>No data found.</li>';
            topActivitiesList.innerHTML = '<li>No data found.</li>';
            return;
        }

        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        const updateTop5Lists = (selectedYear) => {
            const yearData = allEcostData.filter(row => row['Year'] === selectedYear);

            const getTop5 = (data, keyField, valueField) => {
                const aggregated = data.reduce((acc, row) => {
                    const key = row[keyField];
                    if (key) {
                        acc[key] = (acc[key] || 0) + row[valueField];
                    }
                    return acc;
                }, {});

                return Object.entries(aggregated)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5);
            };

            const renderTop5List = (listElement, data) => {
                if (!listElement) return;
                listElement.innerHTML = '';
                if (data.length === 0) {
                    listElement.innerHTML = '<li>No data found.</li>';
                    return;
                }
                data.forEach(([name, value]) => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="top5-name">${name || 'N/A'}</span>
                        <span class="top5-value">QAR ${formatCurrency(value)}</span>
                    `;
                    listElement.appendChild(li);
                });
            };

            renderTop5List(topVendorsList, getTop5(yearData, 'Vendor', 'Total Committed'));
            renderTop5List(topProjectsList, getTop5(yearData, 'Project #', 'Total Committed'));
            renderTop5List(topActivitiesList, getTop5(yearData, 'Activity Name', 'Total Committed'));
        };

        const renderYearlyChart = (selectedYear) => {
            const ctx = document.getElementById('imYearlyChartCanvas').getContext('2d');
            const dataForYear = yearlyData[selectedYear];

            if (imYearlyChart) {
                imYearlyChart.destroy();
            }

            const colors = {
                'Total Committed': 'rgba(54, 162, 235, 0.7)', 
                'Delivered Amount': 'rgba(75, 192, 192, 0.7)', 
                'Outstanding': 'rgba(255, 206, 86, 0.7)' 
            };

            imYearlyChart = new Chart(ctx, {
                type: 'bar', 
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [
                        {
                            label: 'Total Committed',
                            data: dataForYear['Total Committed'],
                            backgroundColor: colors['Total Committed'],
                            borderColor: colors['Total Committed'],
                            borderWidth: 1
                        },
                        {
                            label: 'Delivered Amount',
                            data: dataForYear['Delivered Amount'],
                            backgroundColor: colors['Delivered Amount'],
                            borderColor: colors['Delivered Amount'],
                            borderWidth: 1
                        },
                        {
                            label: 'Outstanding',
                            data: dataForYear['Outstanding'],
                            backgroundColor: colors['Outstanding'],
                            borderColor: colors['Outstanding'],
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                             labels: {
                                color: 'rgba(230, 241, 255, 0.9)' 
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += `QAR ${formatCurrency(context.parsed.y)}`;
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { 
                            ticks: {
                                color: 'rgba(168, 178, 209, 0.7)' 
                            },
                            grid: {
                                color: 'rgba(48, 63, 96, 0.5)' 
                            }
                        },
                        y: {
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) return `QAR ${value / 1000000}M`;
                                    if (value >= 1000) return `QAR ${value / 1000}K`;
                                    return `QAR ${value}`;
                                },
                                color: 'rgba(168, 178, 209, 0.7)' 
                            },
                             grid: {
                                color: 'rgba(48, 63, 96, 0.5)' 
                            }
                        }
                    }
                }
            });
        };

        const initialYear = parseInt(sortedYears[0]);
        renderYearlyChart(initialYear);
        updateTop5Lists(initialYear);

        yearSelect.addEventListener('change', (e) => {
            const selectedYear = parseInt(e.target.value);
            renderYearlyChart(selectedYear);
            updateTop5Lists(selectedYear);
        });

        const refreshBtn = document.getElementById('im-dashboard-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                alert('Forcing dashboard refresh... This may take a moment.');
                populateInvoiceDashboard(true); 
            });
        }

    } catch (error) {
        console.error("Error populating invoice dashboard:", error);
        dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please check console for details.</p>';
    }
}

// ==========================================================================
// 21. INVOICE MANAGEMENT: PAYMENTS
// ==========================================================================

function updatePaymentModalTotal() {
    const modalResultsContainer = document.getElementById('im-payment-modal-results');
    const checkboxes = modalResultsContainer.querySelectorAll('.payment-modal-inv-checkbox:checked');
    
    const totalDisplay = document.getElementById('payment-modal-total-value'); 
    if (!totalDisplay) return;

    let totalSum = 0;
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        if (row) {
            const invValueCell = row.cells[2].textContent;
            const value = parseFloat(String(invValueCell).replace(/,/g, ''));
            if (!isNaN(value)) {
                totalSum += value;
            }
        }
    });
    totalDisplay.textContent = formatCurrency(totalSum);
}

async function handlePaymentModalPOSearch() {
    const poNumber = imPaymentModalPOInput.value.trim().toUpperCase();
    
    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (totalDisplay) totalDisplay.textContent = formatCurrency(0);

    if (!poNumber) {
        imPaymentModalResults.innerHTML = '<p>Please enter a PO Number.</p>';
        return;
    }
    imPaymentModalResults.innerHTML = '<p>Searching...</p>';

    try {
        await ensureInvoiceDataFetched(); 
        const invoicesData = allInvoiceData[poNumber];

        let resultsFound = false;
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th><input type="checkbox" id="payment-modal-select-all"></th>
                        <th>Inv. Entry ID</th>
                        <th>Inv. Value</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>`;

        if (invoicesData) {
            const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));

            for (const [key, inv] of sortedInvoices) {
                if (inv.status === 'With Accounts' && !invoicesToPay[key]) {
                    resultsFound = true;
                    tableHTML += `<tr>
                        <td><input type="checkbox" class="payment-modal-inv-checkbox" data-key='${key}' data-po='${poNumber}'></td>
                        <td>${inv.invEntryID || ''}</td>
                        <td>${formatCurrency(inv.invValue)}</td>
                        <td>${inv.status || ''}</td>
                    </tr>`;
                }
            }
        }

        if (!resultsFound) {
            imPaymentModalResults.innerHTML = '<p>No invoices found for this PO with status "With Accounts" that haven\'t already been added.</p>';
        } else {
            tableHTML += `</tbody></table>`; 
            
            imPaymentModalResults.innerHTML = tableHTML;
            
            document.getElementById('payment-modal-select-all').addEventListener('change', (e) => {
                imPaymentModalResults.querySelectorAll('.payment-modal-inv-checkbox').forEach(chk => chk.checked = e.target.checked);
                updatePaymentModalTotal(); 
            });

            imPaymentModalResults.querySelectorAll('.payment-modal-inv-checkbox').forEach(chk => {
                chk.addEventListener('change', updatePaymentModalTotal);
            });
        }
    } catch (error) {
        console.error("Error searching in payment modal:", error);
        imPaymentModalResults.innerHTML = '<p>An error occurred while searching.</p>';
    }
}

async function handleAddSelectedToPayments() {
    const selectedCheckboxes = document.getElementById('im-payment-modal-results').querySelectorAll('.payment-modal-inv-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert("Please select at least one invoice to add.");
        return;
    }

    let addedCount = 0;

    if (!allInvoiceData) await ensureInvoiceDataFetched();
    if (!allPOData) await ensureAllEntriesFetched();

    selectedCheckboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        const po = checkbox.dataset.po;

        if (invoicesToPay[key]) return;

        const invData = (allInvoiceData[po] && allInvoiceData[po][key]) ? allInvoiceData[po][key] : null;

        if (invData) {
            invoicesToPay[key] = { ...invData, key, po, originalAttention: invData.attention };

            const poDetails = allPOData[po] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            const row = document.createElement('tr');
            row.setAttribute('data-key', key);
            row.setAttribute('data-po', po);
            
            row.innerHTML = `
                <td>${po}</td>
                <td>${site}</td>
                <td>${vendor}</td>
                <td>${invData.invEntryID || ''}</td>
                <td>
                    <input type="number" name="invValue" class="payment-input" step="0.01" value="${invData.invValue || ''}" readonly style="background-color: #f0f0f0;">
                </td>
                <td>
                    <input type="number" name="amountPaid" class="payment-input highlight-field" step="0.01" value="${invData.invValue || ''}">
                </td>
                <td>
                    <input type="date" name="releaseDate" class="payment-input" value="${getTodayDateString()}">
                </td>
                <td>${invData.status || ''}</td>
                <td><button type="button" class="delete-btn payment-remove-btn" title="Remove from list">&times;</button></td>
            `;
            
            imPaymentsTableBody.appendChild(row);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        updatePaymentsCount(); 
        
        const modal = document.getElementById('im-add-payment-modal');
        if(modal) modal.classList.add('hidden');
        
        document.getElementById('im-payment-modal-po-input').value = '';
        document.getElementById('im-payment-modal-results').innerHTML = '';
    } else {
        alert("The selected invoices are already in your payment list.");
    }
}

function updatePaymentsCount() {
    if (paymentsCountDisplay) {
        const rows = imPaymentsTableBody.querySelectorAll('tr');
        paymentsCountDisplay.textContent = `(Total to Pay: ${rows.length})`;
    }
}

async function handleSavePayments() {
    const rows = imPaymentsTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("There are no payments in the list to save.");
        return;
    }
    if (!confirm(`You are about to mark ${rows.length} invoice(s) as 'Paid'. This will update their status, Invoice Value, Amount To Paid, and Release Date. Continue?`)) {
        return;
    }

    const savePromises = [];
    const localCacheUpdates = [];
    let updatesMade = 0;

    for (const row of rows) {
        const invoiceKey = row.dataset.key;
        const poNumber = row.dataset.po;
        const originalInvoiceData = invoicesToPay[invoiceKey]; 

        if (!invoiceKey || !poNumber || !originalInvoiceData) {
            console.warn("Skipping row with missing data:", row);
            continue;
        }

        const invValueInput = row.querySelector('input[name="invValue"]'); 
        const amountPaidInput = row.querySelector('input[name="amountPaid"]');
        const releaseDateInput = row.querySelector('input[name="releaseDate"]');

        const newInvValue = parseFloat(invValueInput.value) || 0; 
        const newAmountPaid = parseFloat(amountPaidInput.value) || 0;
        const newReleaseDate = releaseDateInput.value || getTodayDateString();

        const updates = {
            status: 'Paid',
            invValue: newInvValue, 
            amountPaid: newAmountPaid, 
            releaseDate: newReleaseDate 
        };

        savePromises.push(
            invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates)
        );
        
        const updatedFullData = {...originalInvoiceData, ...updates};
        savePromises.push(
            updateInvoiceTaskLookup(poNumber, invoiceKey, updatedFullData, originalInvoiceData.attention)
        );

        localCacheUpdates.push({ po: poNumber, key: invoiceKey, data: updates }); 
        updatesMade++;
    }

    try {
        await Promise.all(savePromises);

        if (allInvoiceData) { 
            for (const update of localCacheUpdates) {
                if (allInvoiceData[update.po] && allInvoiceData[update.po][update.key]) {
                    allInvoiceData[update.po][update.key] = {
                        ...allInvoiceData[update.po][update.key],
                        ...update.data
                    };
                }
            }
            console.log("Local invoice cache updated surgically.");
        }

        alert(`${updatesMade} payment(s) processed successfully! Invoices updated to 'Paid'.`);
        imPaymentsTableBody.innerHTML = ''; 
        invoicesToPay = {}; 
        updatePaymentsCount(); 
        allSystemEntries = []; 
    } catch (error) {
        console.error("Error saving payments:", error);
        alert("An error occurred while saving payments. Some updates may have failed. Please check the data and try again.");
    }
}

// ==========================================================================
// 22. FINANCE REPORT (READ-ONLY)
// ==========================================================================

function handleFinanceSearch() {
    const poNo = imFinanceSearchPoInput.value.trim();
    if (!poNo) {
        alert('Please enter a PO No. to search');
        return;
    }

    paymentDb.ref('payments').orderByChild('poNo').equalTo(poNo).once('value')
        .then(snapshot => {
            imFinanceResults.style.display = 'block';
            imFinanceResultsBody.innerHTML = '';

            if (!snapshot.exists()) {
                imFinanceNoResults.style.display = 'block';
                if (financeReportCountDisplay) financeReportCountDisplay.textContent = ''; 
            } else {
                imFinanceNoResults.style.display = 'none';
                imFinanceAllPaymentsData = {};
                snapshot.forEach(childSnapshot => {
                    imFinanceAllPaymentsData[childSnapshot.key] = { id: childSnapshot.key, ...childSnapshot.val() };
                });
                const payments = Object.values(imFinanceAllPaymentsData);
                if (financeReportCountDisplay) {
                    financeReportCountDisplay.textContent = `(Total Payments Found: ${payments.length})`;
                }
                showFinanceSearchResults(payments);
            }
        })
        .catch(error => console.error('Error searching payments:', error));
}

function showFinanceSearchResults(payments) {
    imFinanceResultsBody.innerHTML = '';
    if (payments.length === 0) return;

    const firstPayment = payments[0];
    const { site, vendor, vendorId, poNo, poValue } = firstPayment;

    const summaryHtml = `
        <table class="po-summary-table">
            <thead>
                <tr>
                    <th>Site</th>
                    <th>Vendor</th>
                    <th>Vendor ID</th>
                    <th>PO No.</th>
                    <th>PO Value</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${site || ''}</td>
                    <td>${vendor || ''}</td>
                    <td>${vendorId || ''}</td>
                    <td>${poNo || ''}</td>
                    <td>${formatFinanceNumber(poValue) || ''}</td>
                </tr>
            </tbody>
        </table>
    `;

    let totalCertified = 0;
    let totalRetention = 0;
    let totalPayment = 0;

    const paymentRowsHtml = payments.map(payment => `
        <tr>
            <td>${formatFinanceDate(payment.dateEntered) || ''}</td>
            <td>${payment.paymentNo || ''}</td>
            <td>${payment.chequeNo || ''}</td>
            <td>${formatFinanceNumber(payment.certifiedAmount) || ''}</td>
            <td>${formatFinanceNumber(payment.retention) || ''}</td>
            <td>${formatFinanceNumber(payment.payment) || ''}</td>
            <td>${formatFinanceDate(payment.datePaid) || ''}</td>
            <td>
                <button class="btn btn-sm btn-info me-2" data-action="report" data-id="${payment.id}">Print Preview</button>
            </td>
        </tr>
    `).join('');

    payments.forEach(payment => {
        totalCertified += parseFloat(payment.certifiedAmount) || 0;
        totalRetention += parseFloat(payment.retention) || 0;
        totalPayment += parseFloat(payment.payment) || 0;
    });

    const footerHtml = `
        <tfoot style="background-color: #e9ecef; font-weight: bold;">
            <tr>
                <td colspan="3" style="text-align: right;">Total:</td>
                <td>${formatFinanceNumber(totalCertified)}</td>
                <td>${formatFinanceNumber(totalRetention)}</td>
                <td>${formatFinanceNumber(totalPayment)}</td>
                <td colspan="2"></td>
            </tr>
        </tfoot>
    `;

    const detailsHtml = `
        <div class="payment-details-wrapper">
            <h6 class="payment-details-header">Invoice Entries for PO ${poNo}</h6>
            <div class="table-responsive">
                <table class="table payment-details-table">
                    <thead>
                        <tr>
                            <th>Date Entered</th>
                            <th>Payment No.</th>
                            <th>Cheque No.</th>
                            <th>Certified Amount</th>
                            <th>Retention</th>
                            <th>Payment</th>
                            <th>Date Paid</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentRowsHtml}
                    </tbody>
                    ${footerHtml} </table>
            </div>
        </div>
    `;

    imFinanceResultsBody.innerHTML = summaryHtml + detailsHtml;
}

function handleFinanceActionClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    const payment = imFinanceAllPaymentsData[id];

    if (!action || !id || !payment) return;

    if (action === 'report') {
        generateFinanceReport(payment);
    }
}

function resetFinanceSearch() {
    imFinanceSearchPoInput.value = '';
    imFinanceResults.style.display = 'none';
    imFinanceNoResults.style.display = 'none';
    imFinanceResultsBody.innerHTML = '';
    imFinanceAllPaymentsData = {};
    if (financeReportCountDisplay) financeReportCountDisplay.textContent = ''; 
}

async function generateFinanceReport(selectedPayment) {
    const poNo = selectedPayment.poNo;
    if (!poNo) return;
    try {
        const snapshot = await paymentDb.ref('payments').orderByChild('poNo').equalTo(poNo).once('value');
        if (!snapshot.exists()) {
            alert('No payments found for this PO No.');
            return;
        }
        const payments = [];
        snapshot.forEach(childSnapshot => {
            payments.push(childSnapshot.val());
        });
        payments.sort((a, b) => {
            const aNum = parseInt(String(a.paymentNo).replace('PVN-', ''));
            const bNum = parseInt(String(b.paymentNo).replace('PVN-', ''));
            return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
        });
        let totalCertified = 0, totalRetention = 0, totalPayment = 0, totalPrevPayment = 0;
        let allNotes = [];

        payments.forEach(payment => {
            const certified = parseFloat(payment.certifiedAmount || 0);
            const retention = parseFloat(payment.retention || 0);
            const paymentAmount = parseFloat(payment.payment || 0);

            totalCertified += certified;
            totalRetention += retention;
            totalPayment += paymentAmount;

            if (payment.datePaid && String(payment.datePaid).trim() !== '') {
                totalPrevPayment += paymentAmount;
            }
            if (payment.note && String(payment.note).trim() !== '') {
                allNotes.push(`${String(payment.note).trim()}`);
            }
        });

        const totalCommitted = parseFloat(selectedPayment.poValue || 0) - totalCertified;
        imReportDate.textContent = formatFinanceDateLong(new Date().toISOString());
        imReportPoNo.textContent = poNo;
        imReportProject.textContent = selectedPayment.site || '';
        imReportVendorId.textContent = selectedPayment.vendorId || '';
        imReportVendorName.textContent = selectedPayment.vendor || '';
        imReportTotalPoValue.textContent = formatFinanceNumber(selectedPayment.poValue);
        imReportTotalCertified.textContent = formatFinanceNumber(totalCertified);
        imReportTotalPrevPayment.textContent = formatFinanceNumber(totalPrevPayment);
        imReportTotalCommitted.textContent = formatFinanceNumber(totalCommitted);
        imReportTotalRetention.textContent = formatFinanceNumber(totalRetention);

        imReportTableBody.innerHTML = '';
        payments.forEach(payment => {
            const row = document.createElement('tr');
            const pvn = payment.paymentNo ? String(payment.paymentNo).replace('PVN-', '') : '';
            row.innerHTML = `
                <td>${pvn}</td>
                <td>${payment.chequeNo || ''}</td>
                <td>${formatFinanceNumber(payment.certifiedAmount)}</td>
                <td>${formatFinanceNumber(payment.retention)}</td>
                <td>${formatFinanceNumber(payment.payment)}</td>
                <td>${payment.datePaid ? formatFinanceDate(payment.datePaid) : ''}</td>`;
            imReportTableBody.appendChild(row);
        });

        imReportTotalCertifiedAmount.textContent = formatFinanceNumber(totalCertified);
        imReportTotalRetentionAmount.textContent = formatFinanceNumber(totalRetention);
        imReportTotalPaymentAmount.textContent = formatFinanceNumber(totalPayment);

        if (allNotes.length > 0) {
            imReportNotesContent.textContent = allNotes.join('\n');
            imReportNotesSection.style.display = 'block';
        } else {
            imReportNotesContent.textContent = '';
            imReportNotesSection.style.display = 'none';
        }

        imFinanceReportModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error generating finance report:', error);
    }
}

function printFinanceReport() {
    window.print();
}

// ==========================================================================
// 23. CEO APPROVAL & RECEIPT LOGIC
// ==========================================================================

function openCEOApprovalModal(taskData) {
    if (!taskData) return;

    document.getElementById('ceo-modal-key').value = taskData.key;
    document.getElementById('ceo-modal-source').value = taskData.source;
    document.getElementById('ceo-modal-originalPO').value = taskData.originalPO || '';
    document.getElementById('ceo-modal-originalKey').value = taskData.originalKey || '';

    const invName = taskData.invName || '';
    let pdfLinkHTML = '';
    if (taskData.source === 'invoice' && invName.trim() && invName.toLowerCase() !== 'nil') {
        const pdfUrl = `${PDF_BASE_PATH}${encodeURIComponent(invName)}.pdf`;
        pdfLinkHTML = `<a href="${pdfUrl}" target="_blank" class="action-btn invoice-pdf-btn" style="display: inline-block; margin-top: 10px; text-decoration: none;">View Invoice PDF</a>`;
    }

    ceoModalDetails.innerHTML = `
        <strong>PO:</strong> ${taskData.po || 'N/A'}<br>
        <strong>Vendor:</strong> ${taskData.vendorName || 'N/A'}<br>
        <strong>Site:</strong> ${taskData.site || 'N/A'}
        ${pdfLinkHTML}
    `;

    ceoModalAmount.value = taskData.amount || '';
    ceoModalNote.value = taskData.note || '';

    ceoApprovalModal.classList.remove('hidden');
}

async function handleCEOAction(status) {
    const key = document.getElementById('ceo-modal-key').value;
    const source = document.getElementById('ceo-modal-source').value;
    const originalPO = document.getElementById('ceo-modal-originalPO').value;
    const originalKey = document.getElementById('ceo-modal-originalKey').value;

    if (!key || !source) {
        alert("Error: Task identifiers are missing.");
        return;
    }

    const newAmountPaid = ceoModalAmount.value;
    const newNote = ceoModalNote.value.trim();

    if (newAmountPaid === '' || newAmountPaid < 0) {
        alert("Please enter a valid Amount to be Paid (0 or more).");
        return;
    }

    const updates = {
        status: status, 
        remarks: status, 
        amountPaid: newAmountPaid, 
        amount: newAmountPaid, 
        note: newNote,
        dateResponded: formatDate(new Date()) 
    };

    const btn = (status === 'Approved') ? ceoModalApproveBtn : ceoModalRejectBtn;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const processedTask = userActiveTasks.find(t => t.key === key);
        if (!processedTask) {
            throw new Error("Task not found in local list. Forcing full refresh.");
        }
        
        const originalAttention = processedTask.attention || '';

        if (source === 'job_entry') {
            await db.ref(`job_entries/${key}`).update({
                remarks: updates.remarks,
                amount: updates.amount,
                note: updates.note,
                dateResponded: updates.dateResponded 
            });
            
        } else if (source === 'invoice' && originalPO && originalKey) {
            await invoiceDb.ref(`invoice_entries/${originalPO}/${originalKey}`).update({
                status: updates.status,
                amountPaid: updates.amountPaid,
                note: updates.note
            });
            
            const updatedInvoiceData = {...processedTask, ...updates};
            await updateInvoiceTaskLookup(originalPO, originalKey, updatedInvoiceData, originalAttention);
            
            updateLocalInvoiceCache(originalPO, originalKey, updates);

            // --- FIX: LOG HISTORY HERE ---
            // This captures the CEO performing the action
            if (window.logInvoiceHistory) {
                const historyNote = updates.note ? `CEO Action: ${updates.note}` : `Marked as ${status} by CEO`;
                await window.logInvoiceHistory(originalPO, originalKey, status, historyNote);
            }
            // -----------------------------

        } else {
            throw new Error("Invalid task source or missing keys.");
        }

        processedTask.status = status;
        processedTask.amountPaid = newAmountPaid;
        ceoProcessedTasks.push(processedTask);

        const taskIndex = userActiveTasks.findIndex(t => t.key === key);
        if (taskIndex > -1) {
            userActiveTasks.splice(taskIndex, 1);
        }

        renderActiveTaskTable(userActiveTasks);

        const taskCount = userActiveTasks.length;
        if (activeTaskCountDisplay) {
            activeTaskCountDisplay.textContent = `(Total Tasks: ${taskCount})`;
        }
        [wdActiveTaskBadge, imActiveTaskBadge, wdMobileNotifyBadge].forEach(badge => {
            if (badge) {
                badge.textContent = taskCount;
                badge.style.display = taskCount > 0 ? 'inline-block' : 'none';
            }
        });

        sendCeoApprovalReceiptBtn.classList.remove('hidden');
        alert(`Task has been ${status}.`);
        ceoApprovalModal.classList.add('hidden');

    } catch (error) {
        console.error("Error updating task:", error);
        alert("Failed to update task. Please try again.");
        await populateActiveTasks();
    } finally {
        btn.disabled = false;
        btn.textContent = status;
    }
}

async function getNextSeriesNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return Promise.resolve(result);
}

async function previewAndSendReceipt() {
    const isCEO = (currentApprover?.Role || '').toLowerCase() === 'admin' && 
                  (currentApprover?.Position || '').toLowerCase() === 'ceo';
    
    if (!isCEO) {
        alert("Access Denied: Only the CEO can send approval receipts.");
        return;
    }

    sendCeoApprovalReceiptBtn.disabled = true;
    sendCeoApprovalReceiptBtn.textContent = 'Preparing...';

    try {
        const seriesNo = await getNextSeriesNumber();
        if (seriesNo === 'IBA_ERR') {
            alert("Error: Could not get a new series number.");
            return;
        }
        
        const approvedTasks = ceoProcessedTasks.filter(t => t.status === 'Approved');
        const rejectedTasks = ceoProcessedTasks.filter(t => t.status === 'Rejected');

        const receiptData = {
            approvedTasks: approvedTasks,
            rejectedTasks: rejectedTasks,
            seriesNo: seriesNo
        };

        localStorage.setItem('pendingReceiptData', JSON.stringify(receiptData));
        window.open('receipt.html', '_blank');

        ceoProcessedTasks = []; 
        sendCeoApprovalReceiptBtn.classList.add('hidden');

    } catch (error) {
        console.error("Error preparing receipt preview:", error);
        alert("Error preparing receipt. Please check the console.");
    } finally {
        sendCeoApprovalReceiptBtn.disabled = false;
        sendCeoApprovalReceiptBtn.textContent = 'Send Approval Receipt';
    }
}

// ==========================================================================
// 24. INITIALIZATION & EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. Version Display ---
    if(document.getElementById('app-version-display')) {
        document.getElementById('app-version-display').textContent = `Version ${APP_VERSION}`;
    }
    document.querySelectorAll('.sidebar-version-display').forEach(el => {
        el.textContent = `Version ${APP_VERSION}`;
    });

    // --- 2. Session Restoration ---
    const savedApproverKey = localStorage.getItem('approverKey');
    
    if (savedApproverKey) {
        currentApprover = await getApproverByKey(savedApproverKey);
        if (currentApprover) {
            console.log("Resuming session for:", currentApprover.Name);
            handleSuccessfulLogin();
        } else {
            console.log("Saved key found but no user data fetched, clearing session.");
            localStorage.removeItem('approverKey');
            showView('login');
        }
    } else {
        showView('login');
    }

    // --- 3. Authentication Listeners ---
    
    // Login Form
    loginForm.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        loginError.textContent = ''; 
        const identifier = loginIdentifierInput.value.trim(); 
        try { 
            const approver = await findApprover(identifier); 
            if (!approver) { loginError.textContent = 'Access denied. Your email or mobile is not registered as an approver.'; return; } 
            currentApprover = approver; 
            if (!currentApprover.Password || currentApprover.Password === '') { 
                const isEmailMissing = !currentApprover.Email;
                const isSiteMissing = !currentApprover.Site;
                const isPositionMissing = !currentApprover.Position; 
                setupEmailContainer.classList.toggle('hidden', !isEmailMissing); 
                setupSiteContainer.classList.toggle('hidden', !isSiteMissing); 
                setupPositionContainer.classList.toggle('hidden', !isPositionMissing); 
                setupEmailInput.required = isEmailMissing; 
                setupSiteInput.required = isSiteMissing; 
                setupPositionInput.required = isPositionMissing; 
                showView('setup'); 
                setupPasswordInput.focus(); 
            } else { 
                passwordUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile; 
                showView('password'); 
                passwordInput.focus(); 
            } 
        } catch (error) { 
            console.error("Error checking approver:", error); 
            loginError.textContent = 'An error occurred. Please try again.'; 
        } 
    });

    // Setup Form
    setupForm.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        setupError.textContent = ''; 
        const newPassword = setupPasswordInput.value;
        const finalEmail = currentApprover.Email || setupEmailInput.value.trim();
        const finalSite = currentApprover.Site || setupSiteInput.value.trim();
        const finalPosition = currentApprover.Position || setupPositionInput.value.trim(); 
        
        if (!finalEmail.toLowerCase().endsWith('@iba.com.qa')) { setupError.textContent = 'Invalid email. Only @iba.com.qa addresses are allowed.'; return; } 
        if (newPassword.length < 6) { setupError.textContent = 'Password must be at least 6 characters long.'; return; } 
        
        try { 
            const updates = { Password: newPassword, Email: finalEmail, Site: finalSite, Position: finalPosition }; 
            await db.ref(`approvers/${currentApprover.key}`).update(updates); 
            currentApprover = { ...currentApprover, ...updates }; 
            handleSuccessfulLogin(); 
        } catch (error) { 
            console.error("Error during setup:", error); 
            setupError.textContent = 'An error occurred while saving. Please try again.'; 
        } 
    });

    // Password Form
    passwordForm.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        passwordError.textContent = ''; 
        const enteredPassword = passwordInput.value; 
        if (enteredPassword === currentApprover.Password) { 
            handleSuccessfulLogin(); 
        } else { 
            passwordError.textContent = 'Incorrect password. Please try again.'; 
            passwordInput.value = ''; 
        } 
    });

    // Mobile Login
    if (mobileLoginForm) {
        mobileLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mobileIdentifier = document.getElementById('mobile-login-identifier').value.trim();
            const passwordInput = document.getElementById('mobile-login-password').value; 
            const errorMsg = document.getElementById('mobile-login-error');
            
            const sound = document.getElementById('login-sound');
            if(sound) sound.play().catch(e => console.log("Audio play failed", e));

            try {
                const approver = await findApprover(mobileIdentifier);
                if (!approver) {
                    errorMsg.textContent = 'Access denied. Number not found.';
                    return;
                }
                currentApprover = approver;
                
                if (!currentApprover.Password) {
                    document.querySelector('.mobile-login-container').style.display = 'none';
                    const isEmailMissing = !currentApprover.Email; 
                    setupEmailContainer.classList.toggle('hidden', !isEmailMissing); 
                    setupSiteContainer.classList.toggle('hidden', !!currentApprover.Site);
                    setupPositionContainer.classList.toggle('hidden', !!currentApprover.Position);
                    if(isEmailMissing) setupEmailInput.required = true;
                    showView('setup');
                    return;
                } 
                
                if (passwordInput === currentApprover.Password) {
                    document.querySelector('.mobile-login-container').style.display = 'none';
                    handleSuccessfulLogin();
                } else {
                    errorMsg.textContent = 'Incorrect password.';
                    document.getElementById('mobile-login-password').value = ''; 
                }
            } catch (error) {
                console.error(error);
                errorMsg.textContent = 'Error. Try again.';
            }
        });
    }

    // Logout Buttons
    logoutButton.addEventListener('click', handleLogout);
    wdLogoutButton.addEventListener('click', handleLogout);
    imLogoutButton.addEventListener('click', handleLogout);
    if (mobileActiveTaskLogoutBtn) {
        mobileActiveTaskLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                handleLogout();
            }
        });
    }

// Mobile Bottom Nav Logout
    const mobileNavLogout = document.getElementById('mobile-nav-logout');
    if (mobileNavLogout) {
        mobileNavLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                handleLogout();
            }
        });
    }

// Invoice Management Mobile Bottom Nav Logout
const imMobileNavLogout = document.getElementById('im-mobile-nav-logout');
if (imMobileNavLogout) {
    imMobileNavLogout.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm("Are you sure you want to logout?")) {
            handleLogout();
        }
    });
}

    // --- 4. Workdesk Navigation & Setup ---

    workdeskButton.addEventListener('click', async () => {
        if (!currentApprover) { handleLogout(); return; }
        wdUsername.textContent = currentApprover.Name || 'User';
        wdUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        // 1. Define User Roles
        const userPos = (currentApprover?.Position || '').trim();
        const userRole = (currentApprover?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isAccounting = userPos === 'Accounting';
        const isAccounts = userPos === 'Accounts';

        // 2. Toggle Admin Body Class
        document.body.classList.toggle('is-admin', isAdmin);
        
        // 3. SECURITY FIX: Only show IM Link for authorized roles
        // Users with role "User" (who are not Accounting/Accounts) will NOT see this
        if (isAdmin || isAccounting || isAccounts) {
    workdeskIMLinkContainer.classList.remove('hidden');
} else {
    workdeskIMLinkContainer.classList.add('hidden');
}

        wdCurrentCalendarDate = new Date();

        // Initialize Dropdowns
        if (!siteSelectChoices) {
            siteSelectChoices = new Choices(document.getElementById('job-site'), { searchEnabled: true, shouldSort: false, itemSelectText: '', });
            populateSiteDropdown();
        }
        if (!attentionSelectChoices) {
            const attentionElement = document.getElementById('job-attention');
            attentionSelectChoices = new Choices(attentionElement, { searchEnabled: true, shouldSort: false, itemSelectText: '', });
            populateAttentionDropdown(attentionSelectChoices);
            attentionElement.addEventListener('choice', (event) => {
                 if (event.detail && event.detail.value && attentionSelectChoices) {
                    const selectedValue = event.detail.value;
                    const selectedChoice = attentionSelectChoices._store.choices.find(c => c.value === selectedValue);
                    if (selectedChoice && selectedChoice.customProperties && selectedChoice.customProperties.onVacation) {
                        vacationingUserName.textContent = selectedChoice.value;
                        vacationReturnDate.textContent = selectedChoice.customProperties.returnDate || 'N/A';
                        replacementNameDisplay.textContent = selectedChoice.customProperties.replacement.name;
                        replacementContactDisplay.textContent = selectedChoice.customProperties.replacement.contact;
                        replacementEmailDisplay.textContent = selectedChoice.customProperties.replacement.email;
                        vacationModal.classList.remove('hidden');
                    }
                }
            });
        }
        
        if (!modifyTaskAttentionChoices) {
            modifyTaskAttentionChoices = new Choices(modifyTaskAttention, {
                searchEnabled: true, shouldSort: false, itemSelectText: '',
            });
            populateAttentionDropdown(modifyTaskAttentionChoices); 
        }

        updateWorkdeskDateTime();
        if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
        workdeskDateTimeInterval = setInterval(updateWorkdeskDateTime, 1000);
        
        showView('workdesk');

        // --- STRICT ROUTING: ALWAYS ACTIVE TASK ---
        document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active')); 
        
        const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
        if (activeTaskLink) {
            activeTaskLink.classList.add('active');
            await showWorkdeskSection('wd-activetask');
        }
    });

    // Sidebar Navigation
    document.querySelector('#workdesk-view .workdesk-sidebar').addEventListener('click', async (e) => { 
        const link = e.target.closest('a'); 
        if (!link || link.classList.contains('back-to-main-dashboard') || link.id === 'wd-logout-button' || link.id === 'workdesk-im-link') return; 
        e.preventDefault(); 
        if (link.hasAttribute('data-section')) { 
            document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active')); 
            link.classList.add('active'); 
            await showWorkdeskSection(link.getAttribute('data-section'), null); 
        } 
    });
    
    workdeskIMLink.addEventListener('click', (e) => {
        e.preventDefault();
        invoiceManagementButton.click();
    });

    // Mobile Bottom Nav Logic
    if (imMobileActiveTaskLink) {
        imMobileActiveTaskLink.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
            setTimeout(() => {
                document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
                const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
                if (activeTaskLink) activeTaskLink.classList.add('active');
                showWorkdeskSection('wd-activetask');
            }, 100);
        });
    }

    // --- 5. Workdesk: Job Entry Listeners ---
    
    addJobButton.addEventListener('click', handleAddJobEntry);
    updateJobButton.addEventListener('click', handleUpdateJobEntry);
    clearJobButton.addEventListener('click', () => resetJobEntryForm(false));
    deleteJobButton.addEventListener('click', handleDeleteJobEntry); 
    
    jobEntryTableBody.addEventListener('click', (e) => { 
        const row = e.target.closest('tr'); 
        if (row) { 
            const key = row.getAttribute('data-key'); 
            if (jobEntryNavControls) jobEntryNavControls.classList.add('hidden');
            navigationContextList = [];
            navigationContextIndex = -1;

            ensureAllEntriesFetched().then(() => {
                const entry = allSystemEntries.find(item => item.key === key); 
                if (key && entry && entry.source !== 'invoice') populateFormForEditing(key); 
            });
        } 
    });

    jobForSelect.addEventListener('change', (e) => { 
        const jobType = e.target.value;

        // 1. REDIRECT LOGIC: If Transfer, Return, or Restock
        const redirectTypes = ['Transfer', 'Restock', 'Return'];
        
        if (redirectTypes.includes(jobType)) {
            // A. Reset the Job Entry dropdown so it's clean if they come back
            e.target.value = ""; 
            resetJobEntryForm(false); // Clear any typed data in Job Entry

            // B. Navigate to Material Stock Section
            showWorkdeskSection('wd-material-stock');

            // C. Update Sidebar Highlight manually (Visual Polish)
            document.querySelectorAll('#workdesk-nav a').forEach(el => el.classList.remove('active'));
            const msLink = document.querySelector('a[data-section="wd-material-stock"]');
            if(msLink) msLink.classList.add('active');

            // D. Open the Modal (Small timeout ensures the view has switched first)
            setTimeout(() => {
                if (typeof openTransferModal === 'function') {
                    openTransferModal(jobType);
                } else {
                    console.error("Error: openTransferModal function not found in transferLogic.js");
                    alert("Could not open modal. Please check connection.");
                }
            }, 150); // 150ms delay

            return; // STOP HERE. Do not run the standard logic below.
        }

        // 2. STANDARD JOB LOGIC
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs'; 
        const isInvoice = (jobType === 'Invoice');
        const isIPCforQS = (jobType === 'IPC' && isQS);

        if (isInvoice) {
            attentionSelectChoices.clearStore(); 
            attentionSelectChoices.setChoices([{ value: '', label: 'Auto-assigned to Accounting', disabled: true, selected: true }], 'value', 'label', false); 
            attentionSelectChoices.disable(); 

        } else if (isIPCforQS) { 
            attentionSelectChoices.clearStore(); 
            attentionSelectChoices.setChoices([{ value: 'All', label: 'All', selected: true }], 'value', 'label', false); 
            attentionSelectChoices.disable(); 

        } else {
            attentionSelectChoices.enable(); 
            populateAttentionDropdown(attentionSelectChoices);
        }
        
        // Ensure the "Other" input box toggles correctly
        if (typeof toggleJobOtherInput === 'function') {
            toggleJobOtherInput();
        }
    });

    jobEntrySearchInput.addEventListener('input', debounce((e) => handleJobEntrySearch(e.target.value), 500));

    // Job Entry Navigation Buttons
    if (navPrevJobButton) {
        navPrevJobButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (navigationContextIndex > 0) {
                navigationContextIndex--; 
                const prevKey = navigationContextList[navigationContextIndex];
                await ensureAllEntriesFetched(); 
                populateFormForEditing(prevKey);
                updateJobEntryNavControls();
            }
        });
    }
    if (navNextJobButton) {
        navNextJobButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (navigationContextIndex < navigationContextList.length - 1) {
                navigationContextIndex++; 
                const nextKey = navigationContextList[navigationContextIndex];
                await ensureAllEntriesFetched(); 
                populateFormForEditing(nextKey);
                updateJobEntryNavControls();
            }
        });
    }

    // --- 6. Workdesk: Active Task Listeners ---

    activeTaskSearchInput.addEventListener('input', debounce((e) => handleActiveTaskSearch(e.target.value), 500));

    if (activeTaskFilters) {
        activeTaskFilters.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                activeTaskFilters.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                currentActiveTaskFilter = e.target.dataset.statusFilter;
                handleActiveTaskSearch(activeTaskSearchInput.value);
            }
        });
    }

    if (activeTaskClearButton) {
        activeTaskClearButton.addEventListener('click', () => {
            activeTaskSearchInput.value = '';
            sessionStorage.removeItem('activeTaskSearch');
            handleActiveTaskSearch(''); 
        });
    }
    
    // Mobile Refresh Button
    if (mobileActiveTaskRefreshBtn) {
        mobileActiveTaskRefreshBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const icon = mobileActiveTaskRefreshBtn.querySelector('i');
            if(icon) icon.classList.add('fa-spin');
            
            cacheTimestamps.systemEntries = 0; 
            await ensureAllEntriesFetched(false); 
            await populateActiveTasks(); 
            
            if(icon) icon.classList.remove('fa-spin');
        });
    }

    // Active Task Table Click
    activeTaskTableBody.addEventListener('click', async (e) => {
        if (e.target.closest('.mobile-only')) return;
        
        const row = e.target.closest('tr');
        if (!row) return;

        const key = row.dataset.key;
        if (!key) return;
        
        const taskData = userActiveTasks.find(entry => entry.key === key);
        if (!taskData) {
             alert("Could not find task details. The list may be out of date. Please refresh.");
             return;
        }

        if (e.target.classList.contains('ceo-approve-btn')) {
            openCEOApprovalModal(taskData);
            return;
        }

        if (e.target.classList.contains('srv-done-btn')) {
            e.target.disabled = true;
            e.target.textContent = 'Updating...';
            try {
                if (taskData.source === 'invoice') {
                    const updates = { releaseDate: getTodayDateString(), status: 'SRV Done' };
                    await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update(updates);
                    
                    if (!allInvoiceData) await ensureInvoiceDataFetched(); 
                    const originalInvoice = (allInvoiceData && allInvoiceData[taskData.originalPO]) ? allInvoiceData[taskData.originalPO][taskData.originalKey] : {};
                    const updatedInvoiceData = {...originalInvoice, ...updates};
                    await updateInvoiceTaskLookup(taskData.originalPO, taskData.originalKey, updatedInvoiceData, taskData.attention);

                    // --- FIX: LOG HISTORY HERE ---
                    // This captures the CURRENT USER (e.g., the person who clicked the button)
                    if (window.logInvoiceHistory) {
                        await window.logInvoiceHistory(taskData.originalPO, taskData.originalKey, 'SRV Done', 'Marked as SRV Done via Active Task');
                    }
                    // -----------------------------

                } else if (taskData.source === 'job_entry') {
                    const updates = { dateResponded: formatDate(new Date()), remarks: 'SRV Done' };
                    await db.ref(`job_entries/${taskData.key}`).update(updates);
                }
                alert('Task status updated to "SRV Done".');
                await populateActiveTasks();
            } catch (error) {
                console.error("Error updating task status:", error);
                alert("Failed to update task status. Please try again.");
                e.target.disabled = false;
                e.target.textContent = 'SRV Done';
            }
            return;
        }

        if (e.target.classList.contains('modify-btn')) {
            openModifyTaskModal(taskData);
            return;
        }
        
        const userPositionLower = (currentApprover?.Position || '').toLowerCase();
        const isAccountingPosition = userPositionLower === 'accounting';

        if (taskData.source === 'job_entry' && taskData.for === 'Invoice' && isAccountingPosition) {
             if (!taskData.po) {
                alert("This job entry is missing a PO number and cannot be processed in Invoice Management.");
                return;
            }
            jobEntryToUpdateAfterInvoice = key;
            pendingJobEntryDataForInvoice = taskData;
            invoiceManagementButton.click();
            setTimeout(() => {
                imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                imPOSearchInput.value = taskData.po;
                imPOSearchButton.click();
                imBackToActiveTaskButton.classList.remove('hidden');
            }, 100);
            return;
        }

        if (taskData.source === 'job_entry' && taskData.for !== 'Invoice') {
            const jobEntryLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
            if (jobEntryLink) {
                jobEntryLink.click();
            }
            await ensureAllEntriesFetched();
            populateFormForEditing(taskData.key);
            return;
        }

        if (taskData && taskData.source === 'invoice' && taskData.invName && taskData.invName.trim() && taskData.invName.toLowerCase() !== 'nil') {
            window.open(PDF_BASE_PATH + encodeURIComponent(taskData.invName) + ".pdf", '_blank');
        }
    });
    
    
     
    
    

    // --- 7. Workdesk: Calendar Listeners ---

    if (wdCalendarPrevBtn) {
        wdCalendarPrevBtn.addEventListener('click', () => {
            if (isYearView) {
                wdCurrentCalendarDate.setFullYear(wdCurrentCalendarDate.getFullYear() - 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
                renderYearView(); 
            } else {
                wdCurrentCalendarDate.setMonth(wdCurrentCalendarDate.getMonth() - 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                renderWorkdeskCalendar();
                populateCalendarTasks();
            }
            wdCalendarTaskListTitle.textContent = 'Select a day to see tasks';
            wdCalendarTaskListUl.innerHTML = '';
        });
    }
    if (wdCalendarNextBtn) {
        wdCalendarNextBtn.addEventListener('click', () => {
            if (isYearView) {
                wdCurrentCalendarDate.setFullYear(wdCurrentCalendarDate.getFullYear() + 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
                renderYearView(); 
            } else {
                wdCurrentCalendarDate.setMonth(wdCurrentCalendarDate.getMonth() + 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                renderWorkdeskCalendar();
                populateCalendarTasks();
            }
            wdCalendarTaskListTitle.textContent = 'Select a day to see tasks';
            wdCalendarTaskListUl.innerHTML = '';
        });
    }

    if (wdCalendarToggleBtn) {
        wdCalendarToggleBtn.addEventListener('click', toggleCalendarView);
    }

    if (wdCalendarGrid) {
        // Single Click: Show list below calendar
        wdCalendarGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('.wd-calendar-day');
            if (dayCell && !dayCell.classList.contains('other-month')) {
                const date = dayCell.dataset.date;
                if (date) displayCalendarTasksForDay(date);
            }
        });

        // Double Click: Show Day View
        wdCalendarGrid.addEventListener('dblclick', (e) => {
            const dayCell = e.target.closest('.wd-calendar-day');
            if (dayCell && !dayCell.classList.contains('other-month')) {
                const taskBadge = dayCell.querySelector('.task-count-badge');
                if (taskBadge) {
                    const date = dayCell.dataset.date;
                    if (date) showDayView(date);
                }
            }
        });
    }

 if (wdCalendarYearGrid) {
        wdCalendarYearGrid.addEventListener('dblclick', (e) => {
            const monthCell = e.target.closest('.wd-calendar-month-cell');
            if (!monthCell) return;
            const monthIndex = parseInt(monthCell.dataset.month, 10);
            if (isNaN(monthIndex)) return;

            wdCurrentCalendarDate.setMonth(monthIndex);
            toggleCalendarView();
            const firstDay = new Date(wdCurrentCalendarDate.getFullYear(), monthIndex, 1);
            const dateYear = firstDay.getFullYear();
            const dateMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
            const dateDay = String(firstDay.getDate()).padStart(2, '0');
            const firstDayStr = `${dateYear}-${dateMonth}-${dateDay}`;
            displayCalendarTasksForDay(firstDayStr);
        });
    }

// --- FIX: Day View Task Double Click for Reporting ---
    const dayViewTaskList = document.getElementById('wd-dayview-task-list');
    if (dayViewTaskList) {
        dayViewTaskList.addEventListener('dblclick', (e) => {
            // Find the closest task card
            const taskCard = e.target.closest('.dayview-task-card');
            
            // Check if the card exists and has the admin class
            if (taskCard && taskCard.classList.contains('admin-clickable-task')) {
                const poNumber = taskCard.dataset.po;
                if (poNumber) {
                    // 1. Switch to Invoice Management View
                    invoiceManagementButton.click();
                    
                    // 2. Wait briefly for the view to render, then perform the search
                    setTimeout(() => {
                        // Set the search input value
                        imReportingSearchInput.value = poNumber;
                        sessionStorage.setItem('imReportingSearch', poNumber);
                        
                        // Switch to the Reporting Tab explicitly
                        const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                        if (imReportingLink) {
                            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                            imReportingLink.classList.add('active');
                            showIMSection('im-reporting'); // Force the section to show
                        }

                        // 3. Trigger the actual search logic
                        populateInvoiceReporting(poNumber);
                    }, 200); // Increased delay slightly to ensure DOM is ready
                }
            }
        });
    }

    // Calendar Task List Double Click (Admin Jump)
    if (wdCalendarTaskListUl) {
        wdCalendarTaskListUl.addEventListener('dblclick', (e) => {
            const taskItem = e.target.closest('li.clickable-task');
            if (!taskItem || !taskItem.dataset.po) return;
            const poNumber = taskItem.dataset.po;
            
            invoiceManagementButton.click();
            setTimeout(() => {
                imReportingSearchInput.value = poNumber;
                sessionStorage.setItem('imReportingSearch', poNumber);
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) imReportingLink.click();
            }, 150); 
        });
    }

    // Enter Key Navigation
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const dashboardSection = document.getElementById('wd-dashboard');
        if (!dashboardSection || dashboardSection.classList.contains('hidden')) return;
        const isMobile = window.innerWidth <= 768;
        if (isMobile) return;

        const selectedDay = document.querySelector('.wd-calendar-day.selected');
        if (!selectedDay) return; 

        const taskBadge = selectedDay.querySelector('.task-count-badge');
        if (!taskBadge) return; 
        if (taskBadge.classList.contains('admin-view-only')) return; 

        e.preventDefault(); 

        const date = selectedDay.dataset.date; 
        if (!date) return;
        
        const friendlyDate = formatYYYYMMDD(date); 
        const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
        
        if (activeTaskLink) {
            activeTaskLink.click();
            setTimeout(() => {
                showWorkdeskSection('wd-activetask', friendlyDate);
            }, 50);
        }
    });

    // --- 8. Workdesk: Day View Listeners ---
    
    if (dayViewBackBtn) {
        dayViewBackBtn.addEventListener('click', () => {
            const dashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
            if (dashboardLink) dashboardLink.click();
        });
    }

    const navigateDayView = (direction) => {
        if (!wdCurrentDayViewDate) return;
        wdCurrentDayViewDate.setUTCDate(wdCurrentDayViewDate.getUTCDate() + direction);
        const year = wdCurrentDayViewDate.getUTCFullYear();
        const month = String(wdCurrentDayViewDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(wdCurrentDayViewDate.getUTCDate()).padStart(2, '0');
        const newDateString = `${year}-${month}-${day}`;
        showDayView(newDateString);
    };
    if (dayViewPrevBtn) dayViewPrevBtn.addEventListener('click', () => navigateDayView(-1));
    if (dayViewNextBtn) dayViewNextBtn.addEventListener('click', () => navigateDayView(1));

    // Mobile Day View Controls
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => { if (dayViewBackBtn) dayViewBackBtn.click(); });
    if (mobileNotifyBtn) {
        mobileNotifyBtn.addEventListener('click', () => {
            const taskCount = userActiveTasks.length;
            if (taskCount > 0) alert(`Reminder: You still have ${taskCount} active task(s).`);
            else alert("You have no active tasks.");
        });
    }
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);
    if (dateScroller) {
        dateScroller.addEventListener('click', (e) => {
            const dayItem = e.target.closest('.day-scroller-item');
            if (dayItem && dayItem.dataset.date) {
                const oldActive = dateScroller.querySelector('.day-scroller-item.active');
                if (oldActive) oldActive.classList.remove('active');
                dayItem.classList.add('active');
                showDayView(dayItem.dataset.date);
            }
        });
    }

    // --- 9. Workdesk: Reporting Listeners ---

    reportingSearchInput.addEventListener('input', debounce(() => {
        ensureAllEntriesFetched().then(() => { 
             filterAndRenderReport(allSystemEntries);
        });
    }, 500));
    
// ==========================================================================
    // 1. REPORTING TABLE LISTENER (Job Records)
    // Handles: Print Waybill, Admin Delete, Edit Row
    // ==========================================================================
    if (reportingTableBody) {
        reportingTableBody.addEventListener('click', async (e) => {
            
            // A. HANDLE PRINT WAYBILL (Waybill Button)
            const printBtn = e.target.closest('.waybill-btn');
            if (printBtn) {
                e.stopPropagation(); 
                const key = printBtn.getAttribute('data-key');
                
                // Ensure data is loaded
                if (!allSystemEntries || allSystemEntries.length === 0) await ensureAllEntriesFetched();
                
                const entryData = allSystemEntries.find(entry => entry.key === key);
                if (entryData && window.handlePrintWaybill) {
                    window.handlePrintWaybill(entryData);
                } else {
                    alert("Error loading entry data for printing.");
                }
                return;
            }

            // B. HANDLE TRANSFER DELETE (Delete Button)
            const deleteBtn = e.target.closest('.transfer-delete-btn');
            if (deleteBtn) {
                e.stopPropagation(); 
                const key = deleteBtn.getAttribute('data-key');
                if (typeof handleDeleteTransferEntry === 'function') {
                    handleDeleteTransferEntry(key);
                }
                return;
            }

            // C. HANDLE EXPAND BUTTON (Standard Grouping)
            const expandBtn = e.target.closest('.expand-btn'); 
            if (expandBtn) { 
                const masterRow = expandBtn.closest('.master-row'); 
                const detailRow = document.querySelector(masterRow.dataset.target); 
                if (detailRow) detailRow.classList.toggle('hidden'); 
                return; 
            }

            // D. HANDLE ROW CLICK (Edit Mode)
            const row = e.target.closest('tr');
            if (!row) return;
            const key = row.dataset.key;
            if (!key) return;

            // Load data to check type
            await ensureAllEntriesFetched();
            const entryData = allSystemEntries.find(entry => entry.key === key);
            if (!entryData) return;

            // Scenario D1: Transfer Edit
            if (['Transfer', 'Restock', 'Return'].includes(entryData.for)) {
                if (entryData.remarks === 'Pending') {
                    if (confirm("Edit this Pending Request?")) {
                        const jobEntryLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
                        if (jobEntryLink) jobEntryLink.click();
                        setTimeout(() => { 
                            if (window.loadTransferForEdit) window.loadTransferForEdit(entryData); 
                        }, 200);
                    }
                } else {
                    console.log("Cannot edit processed transfers.");
                }
                return;
            }

            // Scenario D2: Standard Job Edit (Invoice/PR/etc)
            if (entryData.source === 'invoice') return; 

            if (confirm("Move to Job Entry form for editing?")) {
                const jobEntryLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
                if (jobEntryLink) jobEntryLink.click();
                setTimeout(() => populateFormForEditing(key), 100);
            }
        });
    }

    // ==========================================================================
    // 2. ACTIVE TASK LISTENER (Inbox) - FIXED
    // ==========================================================================
    if (activeTaskTableBody) {
        activeTaskTableBody.addEventListener('click', async (e) => {
            // Ignore clicks inside the mobile view container (handled separately)
            if (e.target.closest('.mobile-only')) return;
            
            // --- A. HANDLE TRANSFER ACTION ---
            // We use .closest() to ensure it catches the click even if you hit the text inside
            const transferBtn = e.target.closest('.transfer-action-btn');
            
            if (transferBtn) {
                e.preventDefault(); // Stop any default button behavior
                e.stopPropagation(); // Stop the row click from firing
                
                const key = transferBtn.getAttribute('data-key');
                console.log("Transfer Button Clicked for Key:", key);

                // Find the task data
                const task = userActiveTasks.find(t => t.key === key);
                
                if (!task) {
                    alert("Error: Task data not found in memory. Please refresh the page.");
                    return;
                }
                
                // Check if the modal function exists
                if (window.openTransferActionModal) {
                    await window.openTransferActionModal(task); 
                } else {
                    console.error("Missing function: window.openTransferActionModal");
                    alert("System Error: The Transfer Logic script is not loaded correctly. Check console for details.");
                }
                return;
            }

            // --- B. HANDLE STANDARD ACTIONS (CEO/SRV/Edit) ---
            const row = e.target.closest('tr');
            if (!row) return;
            const key = row.dataset.key;
            const taskData = userActiveTasks.find(entry => entry.key === key);
            
            if (!taskData) return;

            if (e.target.classList.contains('ceo-approve-btn')) { 
                openCEOApprovalModal(taskData); 
                return; 
            }
            if (e.target.classList.contains('srv-done-btn')) { 
                // Existing SRV Logic would go here
                return; 
            }
            if (e.target.classList.contains('modify-btn')) { 
                openModifyTaskModal(taskData); 
                return; 
            }
            
            // --- C. HANDLE PDF CLICK (If clicking the row, not a button) ---
            const invName = taskData.invName || '';
            const isInvoiceFromIrwin = taskData.source === 'invoice' && taskData.enteredBy === 'Irwin';
            const isClickable = (isInvoiceFromIrwin || (taskData.source === 'invoice' && invName)) && invName.trim() && invName.toLowerCase() !== 'nil';

            // Only open PDF if we didn't click a button
            if (isClickable && !e.target.closest('button') && !e.target.closest('a')) {
                 window.open(PDF_BASE_PATH + encodeURIComponent(invName) + ".pdf", '_blank');
            }
        });
    }

    printReportButton.addEventListener('click', () => {
        if (summaryNotePrintArea) summaryNotePrintArea.classList.add('hidden');
        if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
        if (imFinanceReportModal) imFinanceReportModal.classList.add('hidden');
        
        const wdPrintArea = document.getElementById('reporting-printable-area');
        if(wdPrintArea) {
            wdPrintArea.classList.add('printing');
            document.body.classList.add('workdesk-print-active'); 
        }
        window.print(); 
        setTimeout(() => {
            if(wdPrintArea) {
                wdPrintArea.classList.remove('printing');
                document.body.classList.remove('workdesk-print-active');
            }
        }, 1000);
    });
    
    
    downloadWdReportButton.addEventListener('click', handleDownloadWorkdeskCSV);
    reportTabsContainer.addEventListener('click', (e) => { 
        if (e.target.tagName === 'BUTTON') { 
            reportTabsContainer.querySelector('.active').classList.remove('active'); 
            e.target.classList.add('active'); 
            currentReportFilter = e.target.getAttribute('data-job-type'); 
            ensureAllEntriesFetched().then(() => { 
                filterAndRenderReport(allSystemEntries); 
            });
        } 
    });

    document.querySelectorAll('.back-to-main-dashboard').forEach(button => button.addEventListener('click', (e) => { e.preventDefault(); showView('dashboard'); }));

    // --- 10. Invoice Management Listeners ---

    invoiceManagementButton.addEventListener('click', async () => {
        if (!currentApprover) { handleLogout(); return; }
        imUsername.textContent = currentApprover.Name || 'User';
        imUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        if (imAttentionSelectChoices) {
            imAttentionSelect.removeEventListener('choice', handleIMAttentionChoice); 
            imAttentionSelectChoices.destroy();
        }
        imAttentionSelectChoices = new Choices(imAttentionSelect, { searchEnabled: true, shouldSort: false, itemSelectText: '' });
        await populateAttentionDropdown(imAttentionSelectChoices); 
        imAttentionSelect.addEventListener('choice', handleIMAttentionChoice); 

        // 1. Define Roles strictly
        const userPos = (currentApprover?.Position || '').trim();
        const userRole = (currentApprover?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isAccountingPos = userPos === 'Accounting';
        const isAccountsPos = userPos === 'Accounts';

        // 2. Define Access Groups
        const isAccountingAdmin = isAdmin && isAccountingPos; // Strictly Admin + Accounting
        const isAccountsAdmin = (isAdmin && isAccountsPos) || isAccountingAdmin; // Admin + Accounts (or Accounting)

        const imNavLinks = imNav.querySelectorAll('li');

        imNavLinks.forEach(li => {
            const link = li.querySelector('a');
            if (!link) return;
            const section = link.dataset.section;
            
            li.style.display = ''; // Reset

            // Mobile link hiding on Desktop
            if (li.classList.contains('wd-nav-activetask-mobile')) {
                if (window.innerWidth > 768) { li.style.display = 'none'; return; }
            }

            // --- STRICT MENU HIDING RULES ---
            
            // 1. Entry Group: Strictly Admin + Accounting
            if ((section === 'im-invoice-entry' || section === 'im-batch-entry' || section === 'im-summary-note') && !isAccountingAdmin) {
                li.style.display = 'none';
            }
            
            // 2. Payments: Admin + Accounts (or Accounting)
            if (section === 'im-payments') {
                if(!isAccountsAdmin) li.style.display = 'none';
                else link.classList.remove('hidden');
            }
            
            // 3. Finance/Dashboard: Any Admin
            if ((section === 'im-finance-report' || section === 'im-dashboard') && !isAdmin) {
                li.style.display = 'none';
            }
        });
        
        document.getElementById('im-nav-workdesk').classList.remove('hidden');

        updateIMDateTime();
        if (imDateTimeInterval) clearInterval(imDateTimeInterval); 
        imDateTimeInterval = setInterval(updateIMDateTime, 1000);
        
        showView('invoice-management');
        
        // --- STRICT ROUTING: ALWAYS DASHBOARD ---
        imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        
        // We default to Dashboard for everyone who can see IM. 
        // If they are not admin, they shouldn't see the IM button in the first place (handled in login).
        // But if they are here, Dashboard is the safe landing page.
        const dashLink = imNav.querySelector('a[data-section="im-dashboard"]');
        if (dashLink) dashLink.classList.add('active');
        
        // Load Dashboard immediately (Single Click Fix)
        setTimeout(() => {
            showIMSection('im-dashboard');
        }, 50);
    });


    function handleIMAttentionChoice(event) {
        if (event.detail && event.detail.value && imAttentionSelectChoices) {
            const selectedValue = event.detail.value;
            const selectedChoice = imAttentionSelectChoices._store.choices.find(c => c.value === selectedValue); 
            if (selectedChoice && selectedChoice.customProperties && selectedChoice.customProperties.onVacation === true) { 
                vacationingUserName.textContent = selectedChoice.value;
                vacationReturnDate.textContent = selectedChoice.customProperties.returnDate || 'N/A';
                replacementNameDisplay.textContent = selectedChoice.customProperties.replacement.name;
                replacementContactDisplay.textContent = selectedChoice.customProperties.replacement.contact;
                replacementEmailDisplay.textContent = selectedChoice.customProperties.replacement.email;
                vacationModal.classList.remove('hidden');
            }
        }
    }

    if (imWorkdeskButton) {
        imWorkdeskButton.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
        });
    }
    if (imActiveTaskButton) {
        imActiveTaskButton.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
            setTimeout(() => {
                workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
                if (activeTaskLink) activeTaskLink.classList.add('active');
                showWorkdeskSection('wd-activetask');
            }, 100);
        });
    }

    if (wdImReportingLinkMobile) {
        wdImReportingLinkMobile.addEventListener('click', (e) => {
            e.preventDefault();
            invoiceManagementButton.click();
            setTimeout(() => {
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) {
                    imReportingLink.click();
                }
            }, 100);
        });
    }
    
// NEW: Listener for the renamed Invoice Management mobile link
if (imNavReportingLinkMobile) {
    imNavReportingLinkMobile.addEventListener('click', (e) => {
        e.preventDefault();
        // Ensure we are in IM view
        if(invoiceManagementView.classList.contains('hidden')) {
             invoiceManagementButton.click();
        }
        setTimeout(() => {
            const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
            if (imReportingLink) {
                imReportingLink.click();
            }
        }, 100);
    });
}    
    
    if (imBackToWDDashboardLink) {
        imBackToWDDashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
            setTimeout(() => {
                const wdDashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
                if (wdDashboardLink) {
                    wdDashboardLink.click();
                }
            }, 100);
        });
    }

    imNav.addEventListener('click', (e) => { const link = e.target.closest('a'); if (!link || link.classList.contains('disabled') || link.parentElement.style.display === 'none' || link.id === 'im-workdesk-button' || link.id === 'im-activetask-button') return; e.preventDefault(); const sectionId = link.getAttribute('data-section'); if (sectionId) { imNav.querySelectorAll('a').forEach(a => a.classList.remove('active')); link.classList.add('active'); showIMSection(sectionId); } });
    
    imPOSearchButton.addEventListener('click', () => handlePOSearch(imPOSearchInput.value));
    imPOSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handlePOSearch(imPOSearchInput.value); } });
    imPOSearchButtonBottom.addEventListener('click', () => handlePOSearch(imPOSearchInputBottom.value));
    imPOSearchInputBottom.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handlePOSearch(imPOSearchInputBottom.value); } });

    if (imShowActiveJobsBtn) imShowActiveJobsBtn.addEventListener('click', () => { imEntrySidebar.classList.toggle('visible'); });
    if (imEntrySidebarList) imEntrySidebarList.addEventListener('click', handleActiveJobClick);

    imAddInvoiceButton.addEventListener('click', handleAddInvoice);
    imUpdateInvoiceButton.addEventListener('click', handleUpdateInvoice);
    imClearFormButton.addEventListener('click', () => { 
        currentPO ? resetInvoiceForm() : resetInvoiceEntryPage(); 
        showIMSection('im-invoice-entry');
    });
    imBackToActiveTaskButton.addEventListener('click', () => { 
        workdeskButton.click();
        setTimeout(() => {
            workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            workdeskNav.querySelector('a[data-section="wd-activetask"]').classList.add('active'); 
            showWorkdeskSection('wd-activetask');
        }, 100);
    });

    imInvoicesTableBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            handleDeleteInvoice(deleteBtn.getAttribute('data-key'));
            return;
        }
        const pdfLink = e.target.closest('a');
        if (pdfLink) return;
        const row = e.target.closest('tr');
        if (row) {
            populateInvoiceFormForEditing(row.getAttribute('data-key'));
        }
    });

    // ==========================================================================
    // 1. REPORTING TABLE LISTENER (UPDATED: IMPORT DEFAULTS)
    // ==========================================================================
    if (imReportingContent) {
        imReportingContent.addEventListener('click', async (e) => { 
            
            // 1. Handle Expand Button
            const expandBtn = e.target.closest('.expand-btn'); 
            if (expandBtn) { 
                const masterRow = expandBtn.closest('.master-row'); 
                const detailRow = document.querySelector(masterRow.dataset.target); 
                if (detailRow) { 
                    detailRow.classList.toggle('hidden'); 
                    expandBtn.textContent = detailRow.classList.contains('hidden') ? '+' : '-'; 
                } 
                return; 
            }

            // 2. Handle "Edit Inv No" Button
            const editInvBtn = e.target.closest('.edit-inv-no-btn');
            if (editInvBtn) {
                e.stopPropagation(); 
                const po = editInvBtn.dataset.po;
                const key = editInvBtn.dataset.key;
                const currentVal = editInvBtn.dataset.current;

                const newVal = prompt("Enter new Invoice Number:", currentVal);
                
                if (newVal !== null && newVal.trim() !== currentVal) {
                    try {
                        await invoiceDb.ref(`invoice_entries/${po}/${key}`).update({
                            invNumber: newVal.trim()
                        });
                        if (allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) {
                            allInvoiceData[po][key].invNumber = newVal.trim();
                        }
                        alert("Invoice Number updated!");
                        const currentSearch = sessionStorage.getItem('imReportingSearch') || '';
                        populateInvoiceReporting(currentSearch);
                    } catch (err) {
                        console.error(err);
                        alert("Error updating invoice number.");
                    }
                }
                return;
            }

            // 3. Handle Row Click (Import or Edit)
            const invoiceRow = e.target.closest('.nested-invoice-row');
            if (invoiceRow) {
                const userPositionLower = (currentApprover?.Position || '').toLowerCase();
                if (userPositionLower !== 'accounting') return; 

                const poNumber = invoiceRow.dataset.poNumber;
                const invoiceKey = invoiceRow.dataset.invoiceKey;
                const source = invoiceRow.dataset.source; 

                if (!poNumber || !invoiceKey) return;

                // --- SCENARIO A: IMPORT FROM EPICORE (CSV) ---
                if (source === 'ecommit') {
                    if (confirm(`Import this Epicore record to Invoice Entry?\n\nPO: ${poNumber}\nInv: ${invoiceRow.dataset.invNumber || 'N/A'}`)) {
                        
                        imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                        imPOSearchInput.value = poNumber;
                        
                        handlePOSearch(poNumber).then(() => {
                            setTimeout(() => {
                                const invNo = invoiceRow.dataset.invNumber;
                                const invDate = invoiceRow.dataset.invDate;
                                const releaseDate = invoiceRow.dataset.releaseDate; 
                                const invValue = invoiceRow.dataset.invValue;

                                if (invNo) document.getElementById('im-inv-no').value = invNo;
                                if (invDate) document.getElementById('im-invoice-date').value = normalizeDateForInput(invDate);
                                if (releaseDate) document.getElementById('im-release-date').value = normalizeDateForInput(releaseDate);
                                
                                if (invValue) {
                                    document.getElementById('im-inv-value').value = invValue;
                                    document.getElementById('im-amount-paid').value = invValue; 
                                }

                                // --- UPDATED IMPORT DEFAULTS ---
                                document.getElementById('im-status').value = 'Under Review'; 
                                document.getElementById('im-inv-name').value = 'Nil';
                                if (imAttentionSelectChoices) imAttentionSelectChoices.removeActiveItems(); // Clear Attention
                                // -------------------------------
                                
                                currentlyEditingInvoiceKey = null; 
                                imAddInvoiceButton.classList.remove('hidden');
                                imUpdateInvoiceButton.classList.add('hidden');
                                imFormTitle.textContent = `Importing Invoice: ${invNo || 'New'}`;

                                document.getElementById('im-new-invoice-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 500); 
                        });
                    }
                    return; 
                }

                // --- SCENARIO B: EDIT EXISTING FIREBASE ENTRY ---
                if (confirm(`Do you want to edit this specific invoice entry?\n\nPO: ${poNumber}\nInvoice Key: ${invoiceKey}`)) {
                     imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                     imPOSearchInput.value = poNumber;
                     
                     ensureInvoiceDataFetched().then(() => {
                        currentPO = poNumber;
                        if (allPOData && allPOData[poNumber]) {
                            proceedWithPOLoading(poNumber, allPOData[poNumber]).then(() => {
                                populateInvoiceFormForEditing(invoiceKey);
                                imBackToActiveTaskButton.classList.remove('hidden');
                            });
                        } else {
                            handlePOSearch(poNumber).then(() => {
                                setTimeout(() => { populateInvoiceFormForEditing(invoiceKey); }, 300);
                            });
                        }
                    });
                }
                return; 
            }
        });
    }


    // Reporting Form Listeners
if (imReportingForm) {
    imReportingForm.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const searchTerm = imReportingSearchInput.value.trim(); 
        if (!searchTerm && !document.getElementById('im-reporting-site-filter').value && !document.getElementById('im-reporting-date-filter').value && !document.getElementById('im-reporting-status-filter').value) { 
            document.getElementById('im-reporting-content').innerHTML = '<p style="color: red; font-weight: bold;">Please specify at least one search criteria.</p>'; 
            return; 
        } 
        populateInvoiceReporting(searchTerm); 
    });
}

if (imReportingClearButton) {
    imReportingClearButton.addEventListener('click', () => { 
        imReportingForm.reset(); 
        sessionStorage.removeItem('imReportingSearch'); 
        document.getElementById('im-reporting-content').innerHTML = '<p>Please enter a search term and click Search.</p>'; 
        currentReportData = []; 
        if (reportingCountDisplay) reportingCountDisplay.textContent = ''; 
    });
}

if (imReportingDownloadCSVButton) imReportingDownloadCSVButton.addEventListener('click', handleDownloadCSV);
if (imDownloadDailyReportButton) imDownloadDailyReportButton.addEventListener('click', handleDownloadDailyReport);
if (imDownloadWithAccountsReportButton) imDownloadWithAccountsReportButton.addEventListener('click', handleDownloadWithAccountsReport);
if (imReportingPrintBtn) imReportingPrintBtn.addEventListener('click', handleGeneratePrintReport);

if (imStatusSelect) {
    imStatusSelect.addEventListener('change', (e) => {
        if (imAttentionSelectChoices) {
            if (e.target.value === 'Under Review') {
                imAttentionSelectChoices.removeActiveItems();
            }
        }
    });
}

    // --- 11. Modals, Settings & Misc Listeners ---

    settingsForm.addEventListener('submit', handleUpdateSettings);
    settingsVacationCheckbox.addEventListener('change', () => {
        const isChecked = settingsVacationCheckbox.checked;
        settingsVacationDetailsContainer.classList.toggle('hidden', !isChecked);
        if (!isChecked) {
            settingsReturnDateInput.value = '';
            settingsReplacementNameInput.value = '';
            settingsReplacementContactInput.value = '';
            settingsReplacementEmailInput.value = '';
        }
    });



    if (calendarModalViewTasksBtn) {
        calendarModalViewTasksBtn.addEventListener('click', () => { 
            const friendlyDate = calendarModalViewTasksBtn.dataset.friendlyDate;
            const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
            if (activeTaskLink) {
                document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active')); 
                activeTaskLink.classList.add('active'); 
                showWorkdeskSection('wd-activetask', friendlyDate); 
            }
            document.getElementById('calendar-task-modal').classList.add('hidden');
        });
    }

    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close-btn')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    });

    if(batchClearBtn) batchClearBtn.addEventListener('click', () => {
        batchTableBody.innerHTML = '';
        batchPOInput.value = '';
        sessionStorage.removeItem('imBatchSearch');
        sessionStorage.removeItem('imBatchNoteSearch'); 
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.clearInput();
        if (imBatchGlobalAttentionChoices) imBatchGlobalAttentionChoices.clearInput();
        imBatchGlobalStatus.value = '';
        imBatchGlobalNote.value = '';
        updateBatchCount(); 
    });

    if (batchSearchStatusBtn) batchSearchStatusBtn.addEventListener('click', () => handleBatchGlobalSearch('status'));
    if (batchSearchNoteBtn) batchSearchNoteBtn.addEventListener('click', () => handleBatchGlobalSearch('note'));
    if (batchAddBtn) batchAddBtn.addEventListener('click', handleAddPOToBatch);
    if (batchSaveBtn) batchSaveBtn.addEventListener('click', handleSaveBatchInvoices);
    
    if (batchPOInput) {
        batchPOInput.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                if(batchSearchStatusBtn) batchSearchStatusBtn.click(); 
            }
        });
        batchPOInput.addEventListener('input', debounce((e) => {
            sessionStorage.setItem('imBatchSearch', e.target.value);
            sessionStorage.removeItem('imBatchNoteSearch'); 
        }, 500));
    }
    if (imBatchNoteSearchSelect) {
        imBatchNoteSearchSelect.addEventListener('change', () => {
            if (imBatchNoteSearchChoices) {
                const noteValue = imBatchNoteSearchChoices.getValue(true);
                if (noteValue) {
                    sessionStorage.setItem('imBatchNoteSearch', noteValue);
                    sessionStorage.removeItem('imBatchSearch'); 
                } else {
                    sessionStorage.removeItem('imBatchNoteSearch');
                }
            }
        });
    }

    if (batchTableBody) {
        batchTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('batch-remove-btn')) {
                const row = e.target.closest('tr');
                if (row.choicesInstance) {
                    row.choicesInstance.destroy();
                }
                row.remove();
                updateBatchCount(); 
            }
        });
    }
    
    // Locate this in the "Event Listeners" section of Part 6
    if (imBatchSearchExistingButton) {
        imBatchSearchExistingButton.addEventListener('click', () => { 
            // 1. Show the modal
            if(imBatchSearchModal) imBatchSearchModal.classList.remove('hidden'); 
            
            // 2. FORCE RESET: This wipes out any old tables or success messages
            document.getElementById('im-batch-modal-results').innerHTML = '<p>Enter a PO number to see its invoices.</p>'; 
            
            // 3. Clear the input and focus it so you are ready to type the NEW PO immediately
            const inputField = document.getElementById('im-batch-modal-po-input');
            if (inputField) {
                inputField.value = ''; 
                setTimeout(() => inputField.focus(), 100); 
            }
        });
    }
    // --- END MODIFIED ---

    if (imBatchSearchModal) {
        const modalSearchBtn = document.getElementById('im-batch-modal-search-btn'), addSelectedBtn = document.getElementById('im-batch-modal-add-selected-btn'), modalPOInput = document.getElementById('im-batch-modal-po-input');
        if(modalSearchBtn) modalSearchBtn.addEventListener('click', handleBatchModalPOSearch);
        if(addSelectedBtn) addSelectedBtn.addEventListener('click', handleAddSelectedToBatch);
        if (modalPOInput) modalPOInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (modalSearchBtn) modalSearchBtn.click(); } });
    }

    if (imBatchGlobalAttention) {
        imBatchGlobalAttention.addEventListener('change', () => { 
            if (!imBatchGlobalAttentionChoices) return;
            const selectedValue = imBatchGlobalAttentionChoices.getValue(true); 
            const valueToSet = selectedValue ? [selectedValue] : []; 
            const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
            rows.forEach(row => {
                if (row.choicesInstance) {
                    row.choicesInstance.setValue(valueToSet); 
                }
            });
        });
    }
    if (imBatchGlobalStatus) {
        imBatchGlobalStatus.addEventListener('change', (e) => {
            const newValue = e.target.value;
            const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
            rows.forEach(row => {
                row.querySelector('select[name="status"]').value = newValue;
            });
        });
    }
    if (imBatchGlobalNote) {
         const updateNotes = (newValue) => {
             const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
             rows.forEach(row => {
                 row.querySelector('input[name="note"]').value = newValue;
             });
         };
         imBatchGlobalNote.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                updateNotes(e.target.value); 
            }
        });
         imBatchGlobalNote.addEventListener('blur', (e) => {
             updateNotes(e.target.value); 
         });
    }

    const refreshEntryBtn = document.getElementById('im-refresh-entry-button');
    if (refreshEntryBtn) refreshEntryBtn.addEventListener('click', async () => { alert("Refreshing all data from sources..."); await ensureInvoiceDataFetched(true); await populateActiveTasks(); alert("Data refreshed."); if (currentPO) handlePOSearch(currentPO); }); 
    const refreshBatchBtn = document.getElementById('im-refresh-batch-button');
    if (refreshBatchBtn) refreshBatchBtn.addEventListener('click', async () => { alert("Refreshing all data... Your current batch list will be cleared."); await ensureInvoiceDataFetched(true); document.getElementById('im-batch-table-body').innerHTML = ''; updateBatchCount(); alert("Data refreshed. Please add POs again."); });
    const refreshSummaryBtn = document.getElementById('im-refresh-summary-button');
    if (refreshSummaryBtn) refreshSummaryBtn.addEventListener('click', async () => { alert("Refreshing all data..."); await ensureInvoiceDataFetched(true); initializeNoteSuggestions(); alert("Data refreshed."); });
    const refreshReportingBtn = document.getElementById('im-refresh-reporting-button');
    if (refreshReportingBtn) {
        refreshReportingBtn.addEventListener('click', async () => {
            alert("Refreshing all data...");
            await ensureInvoiceDataFetched(true);
            alert("Data refreshed. Please run your search again.");
            const searchTerm = imReportingSearchInput.value.trim();
            if (searchTerm || document.getElementById('im-reporting-site-filter').value || document.getElementById('im-reporting-date-filter').value) {
                populateInvoiceReporting(searchTerm);
            }
        });
    }

    if(summaryNoteGenerateBtn) summaryNoteGenerateBtn.addEventListener('click', handleGenerateSummary);
    if(summaryNoteUpdateBtn) summaryNoteUpdateBtn.addEventListener('click', handleUpdateSummaryChanges);
    
    if (summaryClearBtn) {
        summaryClearBtn.addEventListener('click', () => {
            summaryNotePreviousInput.value = '';
            summaryNoteCurrentInput.value = '';
            document.getElementById('summary-note-status-input').value = '';
            document.getElementById('summary-note-srv-input').value = '';
            document.getElementById('summary-note-custom-notes-input').value = '';
            snTableBody.innerHTML = '';
            summaryNotePrintArea.classList.add('hidden');
            if (summaryNoteCountDisplay) summaryNoteCountDisplay.textContent = ''; 
            sessionStorage.removeItem('imSummaryPrevNote');
            sessionStorage.removeItem('imSummaryCurrNote');
        });
    }
    
    if (summaryNoteCurrentInput) {
        summaryNoteCurrentInput.addEventListener('input', debounce((e) => {
            sessionStorage.setItem('imSummaryCurrNote', e.target.value);
        }, 500));
    }

    if(summaryNotePrintBtn) {
        summaryNotePrintBtn.addEventListener('click', () => {
            const customNotesInput = document.getElementById('summary-note-custom-notes-input');
            const notesPrintContent = document.getElementById('sn-print-notes-content');
            const notesPrintContainer = document.getElementById('sn-print-notes');

            if (customNotesInput && notesPrintContent && notesPrintContainer) {
                const notesText = customNotesInput.value.trim();
                notesPrintContent.textContent = notesText; 

                if (notesText) {
                    notesPrintContainer.style.display = 'block'; 
                } else {
                    notesPrintContainer.style.display = 'none';  
                }
                
                if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
                if (summaryNotePrintArea) summaryNotePrintArea.classList.remove('hidden');
                window.print(); 
            } else {
                window.print();
            }
        });
    }


// --- NEW: Previous Summary PDF Button ---
    if (summaryNotePrevPdfBtn) {
        summaryNotePrevPdfBtn.addEventListener('click', async () => {
            const prevNote = document.getElementById('summary-note-previous-input').value.trim();
            
            if (!prevNote) {
                alert("Please enter a 'Previous Note' to search for.");
                return;
            }

            summaryNotePrevPdfBtn.textContent = "Searching...";
            
            try {
                await ensureInvoiceDataFetched();
                
                let foundSrvName = null;
                let foundPo = null;

                // Scan all invoices to find the FIRST match for this note
                // We use a label to break out of both loops once found
                outerLoop:
                for (const po in allInvoiceData) {
                    for (const key in allInvoiceData[po]) {
                        const inv = allInvoiceData[po][key];
                        // Check if note matches and we have a valid SRV name
                        if (inv.note === prevNote && inv.srvName && inv.srvName.toLowerCase() !== 'nil' && inv.srvName.trim() !== '') {
                            foundSrvName = inv.srvName;
                            foundPo = po;
                            break outerLoop; // Stop looking, we found one
                        }
                    }
                }

                if (foundSrvName) {
                    const pdfUrl = `${SRV_BASE_PATH}${encodeURIComponent(foundSrvName)}.pdf`;
                    window.open(pdfUrl, '_blank');
                } else {
                    alert(`No SRV document found for Previous Note: "${prevNote}"`);
                }

            } catch (e) {
                console.error("Error searching for Prev Summary:", e);
                alert("An error occurred while searching.");
            } finally {
                summaryNotePrevPdfBtn.innerHTML = '<i class="fa-regular fa-file-pdf"></i> Prev Summary';
            }
        });
    }


    if (imAddPaymentButton) {
        imAddPaymentButton.addEventListener('click', () => {
            imPaymentModalPOInput.value = '';
            imPaymentModalResults.innerHTML = '<p>Enter a PO number to see invoices ready for payment.</p>';
            imAddPaymentModal.classList.remove('hidden');
        });
    }
    if (imSavePaymentsButton) imSavePaymentsButton.addEventListener('click', handleSavePayments);
    if (imPaymentsTableBody) {
        imPaymentsTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('payment-remove-btn')) {
                const row = e.target.closest('tr');
                const key = row.dataset.key;
                if (key && invoicesToPay[key]) delete invoicesToPay[key]; 
                row.remove(); 
                updatePaymentsCount(); 
            }
        });
    }
    if (imPaymentModalSearchBtn) imPaymentModalSearchBtn.addEventListener('click', handlePaymentModalPOSearch);
    if (imPaymentModalPOInput) {
        imPaymentModalPOInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handlePaymentModalPOSearch(); }
        });
    }
    if (imPaymentModalAddSelectedBtn) imPaymentModalAddSelectedBtn.addEventListener('click', handleAddSelectedToPayments);

    if (imFinanceSearchBtn) imFinanceSearchBtn.addEventListener('click', handleFinanceSearch);
    if (imFinanceClearBtn) imFinanceClearBtn.addEventListener('click', resetFinanceSearch);
    if (imFinanceSearchPoInput) {
        imFinanceSearchPoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleFinanceSearch(); }
        });
    }
    if (imFinanceResults) imFinanceResults.addEventListener('click', handleFinanceActionClick);
    if (imFinancePrintReportBtn) imFinancePrintReportBtn.addEventListener('click', printFinanceReport);

    document.addEventListener('click', (e) => {
        const card = e.target.closest('.im-po-balance-card');
        if (card && card.dataset.toggleTarget) {
            const targetId = card.dataset.toggleTarget; 
            const targetElement = document.querySelector(targetId); 
            const icon = card.querySelector('.po-card-chevron');
            
            if (targetElement) {
                const isOpening = targetElement.classList.contains('hidden-invoice-list');
                
                if (isOpening) {
                    const allOpenLists = document.querySelectorAll('[id^="mobile-invoice-list-"]:not(.hidden-invoice-list)');
                    allOpenLists.forEach(listDiv => {
                        listDiv.classList.add('hidden-invoice-list');
                        const otherCard = document.querySelector(`[data-toggle-target="#${listDiv.id}"]`);
                        const otherIcon = otherCard ? otherCard.querySelector('.po-card-chevron') : null;
                        if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
                    });
                }

                targetElement.classList.toggle('hidden-invoice-list');
                if (icon) {
                    icon.style.transform = targetElement.classList.contains('hidden-invoice-list') ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            }
        }
    });

    // Mobile Search Modal Logic
    if (imMobileSearchBtn) {
        imMobileSearchBtn.addEventListener('click', () => {
            const desktopSearchInput = document.getElementById('im-reporting-search');
            const desktopSiteFilter = document.getElementById('im-reporting-site-filter');
            const desktopStatusFilter = document.getElementById('im-reporting-status-filter');
            const desktopDateFilter = document.getElementById('im-reporting-date-filter');
            
            const mobileSearchInput = document.getElementById('im-mobile-search-term');
            const mobileSiteFilter = document.getElementById('im-mobile-site-filter');
            const mobileStatusFilter = document.getElementById('im-mobile-status-filter');
            const mobileDateFilter = document.getElementById('im-mobile-date-filter');

            mobileSearchInput.value = desktopSearchInput.value;
            mobileSiteFilter.value = desktopSiteFilter.value;
            mobileStatusFilter.value = desktopStatusFilter.value;
            mobileDateFilter.value = desktopDateFilter.value;
            
            if (desktopSiteFilter.options.length > 1 && mobileSiteFilter.options.length <= 1) {
                mobileSiteFilter.innerHTML = desktopSiteFilter.innerHTML;
            }

            if (imMobileSearchModal) imMobileSearchModal.classList.remove('hidden');
        });
    }

    if (imMobileSearchCloseBtn) {
        imMobileSearchCloseBtn.addEventListener('click', () => {
            if (imMobileSearchModal) imMobileSearchModal.classList.add('hidden');
        });
    }

    if (imMobileSearchClearBtn) {
        imMobileSearchClearBtn.addEventListener('click', () => {
            document.getElementById('im-mobile-search-term').value = '';
            document.getElementById('im-mobile-site-filter').value = '';
            document.getElementById('im-mobile-status-filter').value = '';
            document.getElementById('im-mobile-date-filter').value = '';
            
            document.getElementById('im-reporting-search').value = '';
            document.getElementById('im-reporting-site-filter').value = '';
            document.getElementById('im-reporting-status-filter').value = '';
            document.getElementById('im-reporting-date-filter').value = '';
            
            sessionStorage.removeItem('imReportingSearch');
            currentReportData = [];
            
            const desktopContainer = document.getElementById('im-reporting-content');
            const mobileContainer = document.getElementById('im-reporting-mobile-view');
            
            if (desktopContainer) desktopContainer.innerHTML = '<p>Please enter a search term and click Search.</p>';
            if (mobileContainer) {
                mobileContainer.innerHTML = `
                    <div class="im-mobile-empty-state">
                        <i class="fa-solid fa-file-circle-question"></i>
                        <h3>No Results Found</h3>
                        <p>Use the search button to find a PO or Vendor.</p>
                    </div>`;
            }
            if (reportingCountDisplay) reportingCountDisplay.textContent = '(Found: 0)'; 
        });
    }

    if (imMobileSearchRunBtn) {
        imMobileSearchRunBtn.addEventListener('click', () => {
            const desktopSearchInput = document.getElementById('im-reporting-search');
            const mobileSearchInput = document.getElementById('im-mobile-search-term');
            
            desktopSearchInput.value = mobileSearchInput.value;
            document.getElementById('im-reporting-site-filter').value = document.getElementById('im-mobile-site-filter').value;
            document.getElementById('im-reporting-status-filter').value = document.getElementById('im-mobile-status-filter').value;
            document.getElementById('im-reporting-date-filter').value = document.getElementById('im-mobile-date-filter').value;
            
            sessionStorage.setItem('imReportingSearch', desktopSearchInput.value);
            populateInvoiceReporting(desktopSearchInput.value);
            
            if (imMobileSearchModal) imMobileSearchModal.classList.add('hidden');
        });
    }

    if (modifyTaskStatus) {
        modifyTaskStatus.addEventListener('change', (e) => {
            modifyTaskStatusOtherContainer.classList.toggle('hidden', e.target.value !== 'Other');
        });
    }
    if (modifyTaskSaveBtn) {
        modifyTaskSaveBtn.addEventListener('click', handleSaveModifiedTask);
    }

    if (ceoModalApproveBtn) ceoModalApproveBtn.addEventListener('click', () => handleCEOAction('Approved'));
    if (ceoModalRejectBtn) ceoModalRejectBtn.addEventListener('click', () => handleCEOAction('Rejected'));
    if (sendCeoApprovalReceiptBtn) sendCeoApprovalReceiptBtn.addEventListener('click', previewAndSendReceipt);
    if (mobileSendReceiptBtn) mobileSendReceiptBtn.addEventListener('click', previewAndSendReceipt); 


// --- NEW: Job Entry "View Attachment" Button Logic ---
    const jobAttachmentViewBtn = document.getElementById('job-attachment-view-btn');
    if (jobAttachmentViewBtn) {
        jobAttachmentViewBtn.addEventListener('click', () => {
            // 1. Get the filename from the input box
            const val = document.getElementById('job-attachment').value.trim();
            
            if (!val) {
                alert("Please paste a filename first.");
                return;
            }
            
            // 2. Smart Link Construction
            let fullPath;
            if (val.startsWith('http')) {
                // If they pasted a full link, use it as-is
                fullPath = val;
            } else {
                // If they just pasted "file.pdf", combine it with your specific path
                // encodeURIComponent ensures spaces become %20
                fullPath = ATTACHMENT_BASE_PATH + encodeURIComponent(val);
            }
            
            // 3. Open in new tab
            window.open(fullPath, '_blank');
        });
    }


// ==========================================================================
// NEW HELPERS: HISTORY TRACKING
// ==========================================================================

// 1. Log History to Firebase
window.logInvoiceHistory = async function(poNumber, invoiceKey, newStatus, note = "") {
    if (!poNumber || !invoiceKey) return;
    
    const historyEntry = {
        status: newStatus,
        updatedBy: currentApprover ? currentApprover.Name : 'System',
        timestamp: Date.now(),
        note: note || ''
    };
    
    try {
        await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}/history`).push(historyEntry);
    } catch (e) {
        console.error("Failed to log history", e);
    }
};

// 2. View History Modal
window.showInvoiceHistory = async function(poNumber, invoiceKey) {
    const modal = document.getElementById('history-modal');
    const loader = document.getElementById('history-modal-loader');
    const tbody = document.getElementById('history-table-body');
    
    if(modal) modal.classList.remove('hidden');
    if(loader) loader.classList.remove('hidden');
    if(tbody) tbody.innerHTML = '';

    try {
        // Fetch history
        const snapshot = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}/history`).orderByChild('timestamp').once('value');
        const historyData = [];
        
        snapshot.forEach(child => {
            historyData.push(child.val());
        });

        // Fetch creation date for the start point
        const invSnapshot = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).once('value');
        const invData = invSnapshot.val();
        
        if (invData) {
            // 1. Determine the Start Time
            const startTime = invData.originTimestamp || invData.createdAt;

            // 2. Determine the Initiator
            const initiator = invData.originEnteredBy || "System";

            // 3. Determine the Note
            const startNote = invData.originTimestamp 
                ? "Originated from Job Entry" 
                : "Initial Invoice Entry";

            if (startTime) {
                historyData.unshift({
                    status: "Created / Received",
                    timestamp: startTime,
                    updatedBy: initiator,
                    note: startNote
                });
            }
        }

        if(loader) loader.classList.add('hidden');

        if (historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No history recorded yet.</td></tr>';
            return;
        }

        let previousTime = null;

        historyData.forEach((entry) => {
            const dateObj = new Date(entry.timestamp);
            const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            let durationStr = "---";
            
            if (previousTime) {
                const diffMs = entry.timestamp - previousTime;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMins = Math.round(((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
                
                if (diffDays > 0) durationStr = `${diffDays}d ${diffHrs}h`;
                else if (diffHrs > 0) durationStr = `${diffHrs}h ${diffMins}m`;
                else durationStr = `${diffMins} mins`;
            }
            
            previousTime = entry.timestamp;

            const row = `
                <tr>
                    <td><strong>${entry.status}</strong><br><small style="color:#777">${entry.note || ''}</small></td>
                    <td>${dateStr}</td>
                    <td>${entry.updatedBy || 'N/A'}</td>
                    <td class="history-duration">${durationStr}</td>
                </tr>
            `;
            if(tbody) tbody.innerHTML += row; 
        });

    } catch (error) {
        console.error(error);
        if(loader) loader.classList.add('hidden');
        if(tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
};
// --- NEW: Dashboard Double-Click Logic ---
    const dashboardNavLink = document.getElementById('im-dashboard-nav-link');
    if (dashboardNavLink) {
        dashboardNavLink.addEventListener('dblclick', (e) => {
            e.preventDefault();
            // Only load if we are currently IN the IM view
            if (!invoiceManagementView.classList.contains('hidden')) {
                // Visual Feedback
                const dbSection = document.getElementById('im-dashboard');
                dbSection.innerHTML = `
                    <h1>Dashboard</h1>
                    <div style="text-align: center; padding-top: 50px;">
                        <p>Loading data...</p>
                    </div>
                `;
                // Trigger the Load
                populateInvoiceDashboard(true);
            }
        });
    }

// --- Manual PO Entry Logic ---
    const manualSupplierIdInput = document.getElementById('manual-supplier-id');
    
    // 1. Auto-lookup Vendor Name when ID is typed
    if (manualSupplierIdInput) {
        manualSupplierIdInput.addEventListener('input', (e) => {
            const id = e.target.value.trim();
            const nameInput = document.getElementById('manual-vendor-name');
            
            if (allVendorsData && allVendorsData[id]) {
                nameInput.value = allVendorsData[id];
                nameInput.style.backgroundColor = "#d4edda"; // Green tint for success
            } else {
                nameInput.value = "";
                nameInput.style.backgroundColor = "#f9f9f9";
            }
        });
    }

    // 2. Save Manual PO Button
    const saveManualPOBtn = document.getElementById('im-save-manual-po-btn');
    if (saveManualPOBtn) {
        saveManualPOBtn.addEventListener('click', () => {
            const po = document.getElementById('manual-po-number').value;
            const vendor = document.getElementById('manual-vendor-name').value;
            const site = document.getElementById('manual-site-select').value;
            const amount = document.getElementById('manual-po-amount').value;

            if (!vendor || !site || !amount) {
                alert("Please fill in all fields (Supplier ID, Site, Amount).");
                return;
            }

            // Construct a "Fake" PO Object to inject into cache
            const manualPOData = {
                'PO': po,
                'Supplier Name': vendor,
                'Project ID': site,
                'Amount': amount,
                'IsManual': true // Flag for debugging
            };

            // Inject into global cache
            if (!allPOData) allPOData = {};
            allPOData[po] = manualPOData;

            // Close Modal and Proceed
            document.getElementById('im-manual-po-modal').classList.add('hidden');
            proceedWithPOLoading(po, manualPOData);
        });
    }

window.showTransferHistory = async function(key) {
    const modal = document.getElementById('history-modal');
    const loader = document.getElementById('history-modal-loader');
    const tbody = document.getElementById('history-table-body');
    
    if(modal) modal.classList.remove('hidden');
    if(loader) loader.classList.remove('hidden');
    if(tbody) tbody.innerHTML = '';

    try {
        // 1. Get the entry
        const snapshot = await db.ref(`transfer_entries/${key}`).once('value');
        const entry = snapshot.val();
        
        if (!entry) throw new Error("Entry not found");

        const historyData = [];

        // 2. Parse History (It might be an array or an object depending on how it was saved)
        if (entry.history) {
            if (Array.isArray(entry.history)) {
                historyData.push(...entry.history);
            } else {
                Object.values(entry.history).forEach(h => historyData.push(h));
            }
        }

        if(loader) loader.classList.add('hidden');

        if (historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
            return;
        }

        // Sort by timestamp
        historyData.sort((a, b) => a.timestamp - b.timestamp);

        historyData.forEach((h) => {
            const dateObj = new Date(h.timestamp);
            const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const row = `
                <tr>
                    <td><strong>${h.action || h.status}</strong><br><small>${h.note || ''}</small></td>
                    <td>${dateStr}</td>
                    <td>${h.by || 'System'}</td>
                    <td>-</td>
                </tr>
            `;
            tbody.innerHTML += row; 
        });

    } catch (error) {
        console.error(error);
        if(loader) loader.classList.add('hidden');
        if(tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
};    

// ==========================================================================
// FIXED HELPER: Reverse Stock (Undo a transaction)
// ==========================================================================
async function reverseStockInventory(id, qty, jobType, fromSite, toSite) {
    if (!id || !qty) return;
    
    // Sanitize Site Names
    const safeFrom = fromSite ? fromSite.replace(/[.#$[\]]/g, "_") : null;
    const safeTo = toSite ? toSite.replace(/[.#$[\]]/g, "_") : null;

    console.log(`Reversing Stock -> Type: ${jobType}, Qty: ${qty}, ID: ${id}`);

    try {
        let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
        if (!snapshot.exists()) {
            snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
        }

        if (snapshot.exists()) {
            const data = snapshot.val();
            const key = Object.keys(data)[0];
            const item = data[key];
            let sites = item.sites || {};
            const amount = parseFloat(qty);

            // --- REVERSAL LOGIC ---
            
            // A. USAGE or RETURN (Original: Deducted Source -> Reversal: ADD Source)
            if (jobType === 'Usage' || jobType === 'Return') {
                if (safeFrom) {
                    let current = parseFloat(sites[safeFrom] || 0);
                    sites[safeFrom] = current + amount; // Add back to source
                }
            } 
            
            // B. RESTOCK (Original: Added Dest -> Reversal: DEDUCT Dest)
            else if (jobType === 'Restock') {
                if (safeTo) {
                    let current = parseFloat(sites[safeTo] || 0);
                    sites[safeTo] = current - amount;
                    if (sites[safeTo] < 0) sites[safeTo] = 0;
                }
            } 
            
            // C. TRANSFER (Original: Moved Source->Dest -> Reversal: Move Dest->Source)
            else {
                // Default to Transfer logic if type is missing
                if (safeFrom && safeTo) {
                    let curFrom = parseFloat(sites[safeFrom] || 0);
                    let curTo = parseFloat(sites[safeTo] || 0);
                    
                    sites[safeFrom] = curFrom + amount; // Return to source
                    sites[safeTo] = curTo - amount;     // Remove from dest
                    if (sites[safeTo] < 0) sites[safeTo] = 0;
                }
            }

            // Recalculate Global Total
            let newGlobalStock = 0;
            Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

            await db.ref(`material_stock/${key}`).update({
                sites: sites,
                stockQty: newGlobalStock,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            console.log("Stock Reversal Successful.");
        }
    } catch (error) { console.error("Stock reversal error:", error); }
}

// ==========================================================================
// HANDLE DELETE -> PROMPTS FOR QTY -> CREATES RETURN -> REMOVES ORIGINAL
// ==========================================================================
async function handleDeleteTransferEntry(key) {
    await ensureAllEntriesFetched(); 
    const task = allSystemEntries.find(t => t.key === key);
    
    if (!task) { alert("Error: Task not found."); return; }

    const isCompleted = ['Completed', 'Received', 'SRV Done'].includes(task.remarks);

    // 1. PENDING TASK? Just Delete.
    if (!isCompleted) {
        if (confirm("Delete this pending request?")) {
            await db.ref(`transfer_entries/${key}`).remove();
            alert("Request deleted.");
            location.reload();
        }
        return;
    }

    // 2. DETERMINE MAX QUANTITY
    // We can only return what was actually received (or ordered if not tracked)
    const maxQty = parseFloat(task.receivedQty || task.orderedQty || 0);

    if (maxQty <= 0) {
        alert("Error: This task has no quantity recorded to return.");
        return;
    }

    // 3. PROMPT USER FOR QUANTITY
    const returnQtyStr = prompt(
        `Creating Return Request for: ${task.productName}\n\nMax Quantity Available: ${maxQty}\n\nPlease enter the Quantity to Return:`, 
        maxQty
    );

    // If user clicks Cancel, stop everything
    if (returnQtyStr === null) return;

    const returnQty = parseFloat(returnQtyStr);

    // 4. VALIDATE QUANTITY
    if (isNaN(returnQty) || returnQty <= 0) {
        alert("Invalid Quantity. Please enter a number greater than 0.");
        return;
    }
    if (returnQty > maxQty) {
        alert(`Error: You cannot return ${returnQty} because the original transaction was only for ${maxQty}.`);
        return;
    }

    // 5. DETERMINE LOCATIONS (Robust Site Fix)
    const origSource = task.fromSite || task.fromLocation || task.site || 'Main Store';
    const origDest   = task.toSite || task.toLocation || 'Unknown';
    
    let retFrom = '';
    let retTo = '';
    let detailsMsg = '';

    if (task.jobType === 'Restock') {
        detailsMsg = `Reversal of Restock (${task.controlNumber})`;
        retFrom = origDest;       // Deduct from where it is now
        retTo = 'Outside Supplier'; 
    } 
    else if (task.jobType === 'Usage') {
        detailsMsg = `Reversal of Usage (${task.controlNumber})`;
        retFrom = origSource; // Usage occurred at source, return adds back to source
        retTo = origSource;   
    } 
    else if (task.jobType === 'Transfer') {
        detailsMsg = `Reversal of Transfer (${task.controlNumber})`;
        retFrom = origDest;   // Currently at Destination
        retTo = origSource;   // Return to Source
    } else {
        alert("Cannot reverse this transaction type.");
        return;
    }

    try {
        const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
        const newRef = db.ref('transfer_entries').push();
        
        // 6. CREATE REVERSAL DATA
        const reversalData = {
            controlNumber: `RET-${task.controlNumber}`, 
            jobType: 'Return',
            for: 'Return', 
            productID: task.productID || task.productId,
            productName: task.productName,
            details: detailsMsg,
            
            // Swapped Locations
            fromSite: retFrom, 
            toSite: retTo,
            fromLocation: retFrom,
            toLocation: retTo,
            
            // USER DEFINED QUANTITY
            requiredQty: returnQty, 
            orderedQty: returnQty,
            
            requestor: currentUser,
            approver: task.approver, 
            receiver: (task.jobType === 'Transfer') ? task.sourceContact : 'System', 
            
            status: 'Pending Admin', 
            remarks: 'Pending Admin',
            attention: task.approver, 
            
            originalJobType: task.jobType, 
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            enteredBy: currentUser,
            history: [{ action: "Return Requested", by: currentUser, timestamp: Date.now(), note: `Qty: ${returnQty}` }]
        };

        // 7. SAVE & DELETE OLD
        await newRef.set(reversalData);
        await db.ref(`transfer_entries/${key}`).remove();

        alert(`Return Request Created for ${returnQty} units! Sent to Approver.`);
        
        // Refresh
        allSystemEntries = allSystemEntries.filter(t => t.key !== key);
        if(typeof populateActiveTasks === 'function') populateActiveTasks();
        if(document.getElementById('reporting-table-body')) renderReportingTable(allSystemEntries);

    } catch (error) {
        console.error(error);
        alert("Failed to create return request.");
    }
}

// ==========================================================================
// FIXED: Stock Inventory Update (Site-Specific)
// ==========================================================================
async function updateStockInventory(id, qty, action, siteName) {
    if (!id || !qty || !siteName) return;

    // Sanitize Site Name
    const safeSiteName = siteName.replace(/[.#$[\]]/g, "_");
    console.log(`Stock Update: ${action} ${qty} at ${safeSiteName} for ${id}`);

    try {
        let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
        if (!snapshot.exists()) {
            snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
        }

        if (snapshot.exists()) {
            const data = snapshot.val();
            const key = Object.keys(data)[0]; 
            const item = data[key];
            let sites = item.sites || {};
            let currentSiteStock = parseFloat(sites[safeSiteName] || 0);
            const amount = parseFloat(qty);

            if (action === 'Deduct') {
                currentSiteStock -= amount;
                if (currentSiteStock < 0) currentSiteStock = 0; 
            } else if (action === 'Add') {
                currentSiteStock += amount;
            }

            sites[safeSiteName] = currentSiteStock;

            let newGlobalStock = 0;
            Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

            await db.ref(`material_stock/${key}`).update({
                sites: sites,
                stockQty: newGlobalStock,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
        }
    } catch (error) { console.error("Stock update failed:", error); }
}
    
    

}); // END OF DOMCONTENTLOADED