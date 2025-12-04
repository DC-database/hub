// =====================================
// [File 1] app.js
// =====================================

// --- ADD THIS LINE AT THE VERY TOP OF APP.JS ---
// [1.a] APP_VERSION
const APP_VERSION = "4.4.0";

// ==========================================================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================================================

// Main DB for approvers, job_entries, project_sites
// [1.b] firebaseConfig
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
// [1.c] mainApp
const mainApp = firebase.initializeApp(firebaseConfig);
// [1.d] db
const db = firebase.database();
// [1.e] mainStorage
const mainStorage = firebase.storage(mainApp); // Initialized Storage for CSV fetching

// Payments DB (For Finance Report)
// [1.f] paymentFirebaseConfig
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
// [1.g] paymentApp
const paymentApp = firebase.initializeApp(paymentFirebaseConfig, 'paymentReport');
// [1.h] paymentDb
const paymentDb = paymentApp.database();

// Invoice DB
// [1.i] invoiceFirebaseConfig
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
// [1.j] invoiceApp
const invoiceApp = firebase.initializeApp(invoiceFirebaseConfig, 'invoiceEntry');
// [1.k] invoiceDb
const invoiceDb = invoiceApp.database();
// [1.l] storage
const storage = firebase.storage(invoiceApp);

// ==========================================================================
// 2. GLOBAL CONSTANTS & STATE VARIABLES
// ==========================================================================

// [1.m] ATTACHMENT_BASE_PATH
const ATTACHMENT_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/Attachments/";
// [1.n] PDF_BASE_PATH
const PDF_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/INVOICE/";
// [1.o] SRV_BASE_PATH
const SRV_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/SRV/";
// [1.p] CACHE_DURATION
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours cache

// -- State Variables --
// [1.q] currentApprover
let currentApprover = null;
// [1.r] dateTimeInterval
let dateTimeInterval = null;
// [1.s] workdeskDateTimeInterval
let workdeskDateTimeInterval = null;
// [1.t] imDateTimeInterval
let imDateTimeInterval = null;
// [1.u] activeTaskAutoRefreshInterval
let activeTaskAutoRefreshInterval = null;

// -- Dropdown Choices Instances --
// [1.v] siteSelectChoices
let siteSelectChoices = null;
// [1.w] attentionSelectChoices
let attentionSelectChoices = null;
// [1.x] imAttentionSelectChoices
let imAttentionSelectChoices = null;
// [1.y] imBatchGlobalAttentionChoices
let imBatchGlobalAttentionChoices = null;
// [1.z] imBatchNoteSearchChoices
let imBatchNoteSearchChoices = null;
// [1.aa] modifyTaskAttentionChoices
let modifyTaskAttentionChoices = null;

// -- Data Containers --
// [1.ab] currentlyEditingKey
let currentlyEditingKey = null;
// [1.ac] currentlyEditingInvoiceKey
let currentlyEditingInvoiceKey = null;
// [1.ad] currentPO
let currentPO = null;


let allJobEntries = [];
let userJobEntries = [];
let userActiveTasks = [];
let allAdminCalendarTasks = [];
let ceoProcessedTasks = [];
let managerProcessedTasks = []; // <--- ADD THIS
let transferProcessedTasks = [];
window.transferProcessedTasks = transferProcessedTasks; // Expose to transferLogic.js

let allSystemEntries = [];
let navigationContextList = [];
let navigationContextIndex = -1;
let currentPOInvoices = {};
let currentReportData = [];
let invoicesToPay = {};
let imFinanceAllPaymentsData = {};

// -- Filters & UI State --
// [1.ar] currentReportFilter
let currentReportFilter = 'All';
// [1.as] currentActiveTaskFilter
let currentActiveTaskFilter = 'All';
// [1.at] wdCurrentCalendarDate
let wdCurrentCalendarDate = new Date();
// [1.au] isYearView
let isYearView = false;
// [1.av] wdCurrentDayViewDate
let wdCurrentDayViewDate = null;
// [1.aw] imStatusBarChart
let imStatusBarChart = null;
// [1.ax] imYearlyChart
let imYearlyChart = null;

// -- Cache Variables --
// [1.ay] approverListForSelect
let approverListForSelect = [];
// [1.az] allUniqueNotes
let allUniqueNotes = new Set();
// [1.ba] allEcostData
let allEcostData = null;
// [1.bb] ecostDataTimestamp
let ecostDataTimestamp = 0;
// [1.bc] allPOData
let allPOData = null;
// [1.bd] allPODataByRef
let allPODataByRef = null;
// [1.be] allInvoiceData
let allInvoiceData = null;
// [1.bf] allApproverData
let allApproverData = null;
// [1.bg] allEpicoreData
let allEpicoreData = null;
// [1.bh] allSitesCSVData
let allSitesCSVData = null;
// [1.bi] allEcommitDataProcessed
let allEcommitDataProcessed = null;
// [1.bj] allApproversCache
let allApproversCache = null;
// [1.bk] allSitesCache
let allSitesCache = null;
// [1.bl] allApproverDataCache
let allApproverDataCache = null;
// [1.bm] allVendorsData
let allVendorsData = null; // New Cache for Vendors.csv

// -- Workdesk <-> IM Context --
// [1.bn] jobEntryToUpdateAfterInvoice
let jobEntryToUpdateAfterInvoice = null;
// [1.bo] pendingJobEntryDataForInvoice
let pendingJobEntryDataForInvoice = null;

// [1.bp] cacheTimestamps
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

// [1.bq] setCache
function setCache(key, data) {
    try {
        // [1.br] item
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

// [1.bs] getCache
function getCache(key) {
    // [1.bt] itemStr
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    try {
        // [1.bu] item
        const item = JSON.parse(itemStr);
        // [1.bv] isStale
        const isStale = (Date.now() - item.timestamp) > CACHE_DURATION;
        return {
            data: item.data,
            isStale: isStale
        };
    } catch (error) {
        console.error(`Error parsing cache ${key}:`, error);
        localStorage.removeItem(key);
        return null;
    }
}

// [1.bw] loadDataFromLocalStorage
function loadDataFromLocalStorage() {
    // [1.bx] epicoreCache
    const epicoreCache = getCache('cached_EPICORE');
    // [1.by] sitesCache
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
    // [1.bz] baseUrl
    const baseUrl = "https://cdn.jsdelivr.net/gh/DC-database/Hub@main/";

    // This automatically combines the base URL with whatever filename is requested
    // Example: baseUrl + 'POVALUE2.csv'
    return `${baseUrl}${filename}`;
}

async function silentlyRefreshStaleCaches() {
    console.log("Checking for stale background caches...");
    // [1.ca] now
    const now = Date.now();

    try {
        if (cacheTimestamps.epicoreData === 0) {
            console.log("Silently refreshing Ecost.csv...");
            // [1.cb] url
            const url = await getFirebaseCSVUrl('Ecost.csv');
            if (url) {
                // [1.cc] epicoreCsvData
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
            // [1.cd] url
            const url = await getFirebaseCSVUrl('Site.csv');
            if (url) {
                // [1.ce] sitesCsvData
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

// [REPLACE THIS WHOLE FUNCTION]
async function fetchAndParseCSV(url) {
    try {
        // [1.cf] response
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        // [1.cg] csvText
        const csvText = await response.text();
        // Remove Byte Order Mark (BOM) if present
        // [1.ch] lines
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) {
            throw new Error("CSV is empty or has no data rows.");
        }

        // [1.ci] parseCsvRow
        const parseCsvRow = (rowStr) => {
            // [1.cj] values
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                // [1.ck] char
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());
            // CRITICAL FIX: Add .trim() here to remove spaces from "21284 "
            return values.map(v => v.replace(/^"|"$/g, '').trim());
        };

        // 1. Identify Headers
        // [1.cl] headers
        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        // [1.cm] headersLower
        const headersLower = headers.map(h => h.toLowerCase());

        console.log("CSV Headers Found:", headers);

        // 2. Find 'PO' Column (Flexible)
        // [1.cn] poHeaderIndex
        let poHeaderIndex = headersLower.findIndex(h => h.includes('po number') || h === 'po' || h === 'po_number');
        if (poHeaderIndex === -1) poHeaderIndex = 1; // Fallback to Col B

        // 3. Find 'ReqNum' Column (Flexible)
        // Looks for "reqnum", "req num", "req no", or just starts with "req"
        // [1.co] refHeaderIndex
        let refHeaderIndex = headersLower.findIndex(h => h === 'reqnum' || h === 'req num' || h === 'req no' || h.startsWith('req'));
        if (refHeaderIndex === -1) refHeaderIndex = 0; // Fallback to Col A

        console.log(`Mapping: PO is Col ${poHeaderIndex}, ReqNum is Col ${refHeaderIndex}`);

        // [1.cp] poDataByPO
        const poDataByPO = {};
        // [1.cq] poDataByRef
        const poDataByRef = {};

        // 4. Parse Rows
        for (let i = 1; i < lines.length; i++) {
            // [1.cr] values
            const values = parseCsvRow(lines[i]);

            // Map values to headers
            // [1.cs] poEntry
            const poEntry = {};
            headers.forEach((header, index) => {
                // [1.ct] val
                let val = values[index] || '';
                if (header.toLowerCase() === 'amount') {
                    val = val.replace(/,/g, '') || '0';
                }
                poEntry[header] = val;
            });

            // Index by PO
            // [1.cu] poKey
            const poKey = values[poHeaderIndex] ? values[poHeaderIndex].toUpperCase() : null;
            if (poKey) poDataByPO[poKey] = poEntry;

            // Index by Ref (ReqNum) - CRITICAL: Force String and Trim
            // [1.cv] rawRef
            const rawRef = values[refHeaderIndex];
            if (rawRef) {
                // [1.cw] refKey
                const refKey = String(rawRef).trim();
                poDataByRef[refKey] = poEntry;
                // Backup: Save uppercase version too just in case
                poDataByRef[refKey.toUpperCase()] = poEntry;
            }
        }

        console.log(`CSV Loaded. ${Object.keys(poDataByRef).length} References indexed.`);
        return {
            poDataByPO,
            poDataByRef
        };

    } catch (error) {
        console.error("Error fetching PO CSV:", error);
        return null;
    }
}

async function fetchAndParseEpicoreCSV(url) {
    try {
        // [1.cx] response
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        // [1.cy] csvText
        const csvText = await response.text();

        // [1.cz] parseCsvRow
        const parseCsvRow = (rowStr) => {
            // [1.da] values
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                // [1.db] char
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };

        // [1.dc] lines
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 1) {
            throw new Error("Epicore CSV is empty.");
        }

        // [1.dd] epicoreMap
        const epicoreMap = {};
        for (let i = 0; i < lines.length; i++) {
            // [1.de] values
            const values = parseCsvRow(lines[i]);

            // Column Mapping (0-based index):
            // A[0], B[1], C[2]=PO, D[3]=Project#, E[4]=Description

            if (values.length > 4) {
                // [1.df] poKey
                const poKey = values[2] ? values[2].toUpperCase().trim() : null;
                // [1.dg] description
                const description = values[4] || ''; // Grab Column E

                if (poKey) {
                    epicoreMap[poKey] = description;
                }
            }
        }
        console.log(`Successfully fetched and parsed ${Object.keys(epicoreMap).length} entries from Epicore CSV.`);
        return epicoreMap;
    } catch (error) {
        console.error("Error fetching or parsing Epicore CSV:", error);
        alert("CRITICAL ERROR: Could not load Epicore data.");
        return null;
    }
}

async function fetchAndParseSitesCSV(url) {
    try {
        // [1.dh] response
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Sites CSV: ${response.statusText}`);
        }
        // [1.di] csvText
        const csvText = await response.text();
        // [1.dj] lines
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Site.csv is empty or has no data rows.");
        }
        // [1.dk] parseCsvRow
        const parseCsvRow = (rowStr) => {
            // [1.dl] values
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                // [1.dm] char
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };
        // [1.dn] headers
        const headers = parseCsvRow(lines[0]).map(h => h.trim().toLowerCase());
        // [1.do] siteIndex
        let siteIndex = headers.indexOf('site');
        // [1.dp] descIndex
        let descIndex = headers.indexOf('description');
        if (siteIndex === -1) siteIndex = 0;
        if (descIndex === -1) descIndex = 1;
        // [1.dq] sitesData
        const sitesData = [];
        for (let i = 1; i < lines.length; i++) {
            // [1.dr] values
            const values = parseCsvRow(lines[i]);
            if (values.length >= Math.max(siteIndex, descIndex)) {
                // [1.ds] site
                const site = values[siteIndex];
                // [1.dt] description
                const description = values[descIndex];
                if (site && description) {
                    sitesData.push({
                        site,
                        description
                    });
                }
            }
        }
        console.log(`Successfully fetched and parsed ${sitesData.length} sites from Site.csv.`);
        return sitesData;
    } catch (error) {
        console.error("Error fetching or parsing Site.csv:", error);
        alert("CRITICAL ERROR: Could not load Site data.");
        return null;
    }
}

async function fetchAndParseEcommitCSV(url) {
    try {
        // [1.du] response
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        // [1.dv] csvText
        const csvText = await response.text();
        // [1.dw] lines
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Ecommit CSV is empty or has no data rows.");
        }

        // [1.dx] parseCsvRow
        const parseCsvRow = (rowStr) => {
            // [1.dy] values
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                // [1.dz] char
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values.map(v => v.replace(/^"|"$/g, ''));
        };

        // [1.ea] cleanInvoiceNumber
        const cleanInvoiceNumber = (str) => {
            if (!str) return '';
            // [1.eb] cleanStr
            let cleanStr = str.trim().replace(/^"|"$/g, '');
            if (cleanStr.toUpperCase().includes('E+')) {
                try {
                    // [1.ec] num
                    const num = Number(cleanStr);
                    if (!isNaN(num)) {
                        return num.toLocaleString('fullwide', {
                            useGrouping: false
                        });
                    }
                } catch (e) {
                    return cleanStr;
                }
            }
            return cleanStr;
        };

        // [1.ed] headers
        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        // [1.ee] headerMap
        const headerMap = {};
        headers.forEach((h, i) => {
            headerMap[h] = i;
        });

        // [1.ef] requiredHeaders
        const requiredHeaders = ['PO', 'Whse', 'Date', 'Sys Date', 'Name', 'Packing Slip', 'Extended Cost'];
        if (!requiredHeaders.every(h => headerMap.hasOwnProperty(h))) {
            throw new Error("Ecommit CSV is missing required headers.");
        }

        // [1.eg] poMap
        const poMap = {};
        for (let i = 1; i < lines.length; i++) {
            // [1.eh] values
            const values = parseCsvRow(lines[i]);
            if (values.length < headers.length) continue;

            // [1.ei] po
            const po = values[headerMap['PO']]?.toUpperCase().trim();
            if (!po) continue;

            // [1.ej] extendedCost
            const extendedCost = parseFloat(values[headerMap['Extended Cost']]?.replace(/,/g, '') || 0);
            // [1.ek] rawPackingSlip
            const rawPackingSlip = values[headerMap['Packing Slip']] || '';
            // [1.el] fixedPackingSlip
            const fixedPackingSlip = cleanInvoiceNumber(rawPackingSlip);

            // [1.em] record
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

        // [1.en] finalEcommitData
        const finalEcommitData = {};
        Object.keys(poMap).forEach(po => {
            // [1.eo] recordsForPO
            const recordsForPO = poMap[po];
            // [1.ep] summedRecords
            const summedRecords = new Map();

            recordsForPO.forEach(record => {
                // [1.eq] key
                const key = record.packingSlip;
                if (!key) return;

                if (summedRecords.has(key)) {
                    // [1.er] existing
                    const existing = summedRecords.get(key);
                    existing.invValue = existing.invValue + record.invValue;

                    // [1.es] existingDate
                    const existingDate = new Date(existing.rawDate);
                    // [1.et] newDate
                    const newDate = new Date(record.rawDate);
                    if (newDate < existingDate) {
                        existing.rawDate = record.rawDate;
                        existing.date = record.date;
                        existing.sysDate = record.sysDate;
                    }
                } else {
                    summedRecords.set(key, {
                        ...record
                    });
                }
            });

            // [1.eu] poRecords
            const poRecords = Array.from(summedRecords.values());
            poRecords.sort((a, b) => {
                // [1.ev] dateA
                const dateA = new Date(a.rawDate);
                // [1.ew] dateB
                const dateB = new Date(b.rawDate);
                if (dateA - dateB !== 0) return dateA - dateB;
                return a.packingSlip.localeCompare(b.packingSlip);
            });

            // [1.ex] formattedRecords
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
        // [1.ey] response
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Ecost CSV: ${response.statusText}`);
        }
        // [1.ez] csvText
        const csvText = await response.text();
        // [1.fa] lines
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Ecost CSV is empty or has no data rows.");
        }

        // [1.fb] parseCsvRow
        const parseCsvRow = (rowStr) => {
            // [1.fc] values
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                // [1.fd] char
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };

        // [1.fe] headers
        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        // [1.ff] headerMap
        const headerMap = {};
        headers.forEach((h, i) => {
            headerMap[h] = i;
        });

        // [1.fg] requiredHeaders
        const requiredHeaders = ['Order Date', 'Project #', 'Name', 'Line Amount', 'Delivered Amount', 'Outstanding', 'Activity Name'];
        for (const h of requiredHeaders) {
            if (typeof headerMap[h] === 'undefined') {
                console.warn(`Ecost CSV is missing expected header: ${h}`);
            }
        }

        // [1.fh] dateIndex
        const dateIndex = headerMap['Order Date'];
        // [1.fi] projectIndex
        const projectIndex = headerMap['Project #'];
        // [1.fj] vendorIndex
        const vendorIndex = headerMap['Name'];
        // [1.fk] lineAmountIndex
        const lineAmountIndex = headerMap['Line Amount'];
        // [1.fl] deliveredIndex
        const deliveredIndex = headerMap['Delivered Amount'];
        // [1.fm] outstandingIndex
        const outstandingIndex = headerMap['Outstanding'];
        // [1.fn] activityIndex
        const activityIndex = headerMap['Activity Name'];

        // [1.fo] processedData
        const processedData = [];
        for (let i = 1; i < lines.length; i++) {
            // [1.fp] values
            const values = parseCsvRow(lines[i]);
            if (values.length < headers.length) continue;

            // [1.fq] orderDateStr
            const orderDateStr = values[dateIndex];
            // [1.fr] orderDate
            let orderDate = null;
            let year = null;
            let month = null;

            if (orderDateStr && orderDateStr.includes('-')) {
                // [1.fs] parts
                const parts = orderDateStr.split('-');
                if (parts.length === 3) {
                    // [1.ft] day
                    const day = parseInt(parts[0], 10);
                    // [1.fu] monthIndex
                    const monthIndex = parseInt(parts[1], 10) - 1;
                    // [1.fv] fullYear
                    let fullYear = parseInt(parts[2], 10);
                    if (fullYear < 100) {
                        fullYear += 2000;
                    }
                    orderDate = new Date(Date.UTC(fullYear, monthIndex, day));
                }
            }
            if (!orderDate || isNaN(orderDate)) {
                orderDate = new Date(orderDateStr);
            }

            if (orderDate && !isNaN(orderDate)) {
                // [1.fw] now
                const now = new Date();
                if (orderDate > now) {
                    continue;
                }
                year = orderDate.getFullYear();
                month = orderDate.getMonth();
            } else {
                continue;
            }

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

// ==========================================================================
// FIX: ensureEcostDataFetched (Uses correct URL generator)
// ==========================================================================
async function ensureEcostDataFetched(forceRefresh = false) {
    // [1.fx] now
    const now = Date.now();
    if (!forceRefresh && allEcostData && (now - ecostDataTimestamp < CACHE_DURATION)) {
        return allEcostData;
    }

    console.log("Fetching Ecost.csv data...");

    // --- THE FIX IS HERE: Get the URL dynamically instead of using undefined variable ---
    // [1.fy] url
    const url = await getFirebaseCSVUrl('Ecost.csv');

    if (url) {
        allEcostData = await fetchAndParseEcostCSV(url);
        if (allEcostData) {
            ecostDataTimestamp = now;
            console.log("Ecost.csv data cached.");
        }
    }
    return allEcostData;
}

async function ensureInvoiceDataFetched(forceRefresh = false) {
    // [1.fz] now
    const now = Date.now();

    // Check if everything is already loaded (including new vendors data)
    if (!forceRefresh && allPOData && allInvoiceData && allEpicoreData && allSitesCSVData && allEcommitDataProcessed && allVendorsData) {
        return;
    }

    if (!forceRefresh) {
        loadDataFromLocalStorage();
    }

    try {
        // [1.ga] promisesToRun
        const promisesToRun = [];

        // Get URLs from Firebase Storage
        // [1.gb] poUrl
        const poUrl = (!allPOData || forceRefresh) ? await getFirebaseCSVUrl('POVALUE2.csv') : null;
        // [1.gc] ecostUrl
        const ecostUrl = (!allEpicoreData || forceRefresh) ? await getFirebaseCSVUrl('Ecost.csv') : null;
        // [1.gd] siteUrl
        const siteUrl = (!allSitesCSVData || forceRefresh) ? await getFirebaseCSVUrl('Site.csv') : null;
        // [1.ge] ecommitUrl
        const ecommitUrl = (!allEcommitDataProcessed || forceRefresh) ? await getFirebaseCSVUrl('ECommit.csv') : null;

        // --- NEW: Get Vendors URL ---
        // [1.gf] vendorUrl
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

        // [1.gg] results
        const results = await Promise.all(promisesToRun);
        // [1.gh] resultIndex
        let resultIndex = 0;

        if (poUrl) {
            // [1.gi] csvData
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
            // [1.gj] invoiceSnapshot
            const invoiceSnapshot = results[resultIndex++];
            allInvoiceData = invoiceSnapshot.val() || {};
            cacheTimestamps.invoiceData = now;

            allUniqueNotes = new Set();
            for (const po in allInvoiceData) {
                for (const invKey in allInvoiceData[po]) {
                    // [1.gk] invoice
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
async function ensureAllEntriesFetched(forceRefresh = false) { // <--- ADD THIS LINE
    // [1.gl] now
    const now = Date.now();
    // 1. Check Cache
    if (!forceRefresh && allSystemEntries.length > 0 && (now - cacheTimestamps.systemEntries < CACHE_DURATION)) {
        return;
    }

    console.log("Loading Data for Workdesk...");

    // 2. Load PO Data (Always fetch fresh if needed for PRs)
    // [1.gm] PO_DATA_URL
    const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
    const {
        poDataByPO,
        poDataByRef
    } = await fetchAndParseCSV(PO_DATA_URL) || {};

    allPOData = poDataByPO || {};
    // [1.gn] purchaseOrdersDataByRef
    const purchaseOrdersDataByRef = poDataByRef || {};

    // 3. Fetch Job Entries from Firebase
    const [jobEntriesSnapshot, transferSnapshot] = await Promise.all([
        db.ref('job_entries').orderByChild('timestamp').once('value'),
        db.ref('transfer_entries').orderByChild('timestamp').once('value')
    ]);

    // [1.go] jobEntriesData
    const jobEntriesData = jobEntriesSnapshot.val() || {};
    // [1.gp] transferData
    const transferData = transferSnapshot.val() || {};

    // [1.gq] processedEntries
    const processedEntries = [];
    // [1.gr] updatesToFirebase
    const updatesToFirebase = {};

    // 4. Process Job Entries (PR Matching Here)
    Object.entries(jobEntriesData).forEach(([key, value]) => {
        // [1.gs] entry
        let entry = {
            key,
            ...value,
            source: 'job_entry'
        };

        // --- *** PR AUTO-SOLVE LOGIC *** ---
        if (entry.for === 'PR' && entry.ref) {

            // Force String and Trim
            // [1.gt] refKey
            const refKey = String(entry.ref).trim();

            // Try exact match OR uppercase match
            // [1.gu] csvMatch
            const csvMatch = purchaseOrdersDataByRef[refKey] || purchaseOrdersDataByRef[refKey.toUpperCase()];

            if (csvMatch) {
                console.log(`>> PR MATCH FOUND: ${refKey}`, csvMatch);

                // Get Data from CSV
                // [1.gv] newPO
                const newPO = csvMatch['PO'] || csvMatch['PO Number'] || '';
                // [1.gw] newVendor
                const newVendor = csvMatch['Supplier Name'] || csvMatch['Supplier'] || 'N/A';
                // [1.gx] newAmount
                const newAmount = csvMatch['Amount'] || '';
                // Look for "Buyer Name" OR "Entry Person"
                // [1.gy] newAttention
                const newAttention = csvMatch['Buyer Name'] || csvMatch['Entry Person'] || 'Records';

                // Date Fix
                // [1.gz] rawDate
                let rawDate = csvMatch['Order Date'] || '';
                // If CSV date is like "22-11-25", we need to parse it correctly
                // [1.ha] newDate
                let newDate = rawDate;
                // Basic attempt to format, or just use what's in CSV
                if (rawDate) newDate = formatYYYYMMDD(normalizeDateForInput(rawDate));

                // 1. Update Local Object (Immediate Display)
                entry.po = newPO;
                entry.vendorName = newVendor;
                entry.amount = newAmount;
                entry.attention = newAttention;
                entry.dateResponded = newDate;
                entry.remarks = 'PO Ready'; // Force Status Update

                // 2. Queue Firebase Update (Only if not already updated)
                if (value.remarks !== 'PO Ready') {
                    updatesToFirebase[key] = {
                        po: newPO,
                        vendorName: newVendor,
                        amount: newAmount,
                        attention: newAttention,
                        dateResponded: newDate,
                        remarks: 'PO Ready'
                    };
                }
            }
        }
        // --- *** END PR LOGIC *** ---

        // Fallback for non-PR vendor names
        if (!entry.vendorName && entry.po && allPOData[entry.po]) {
            entry.vendorName = allPOData[entry.po]['Supplier Name'] || 'N/A';
        }

        processedEntries.push(entry);
    });

    // 5. Process Transfer Entries
    Object.entries(transferData).forEach(([key, value]) => {
        // [1.hb] from
        const from = value.fromLocation || value.fromSite || 'N/A';
        // [1.hc] to
        const to = value.toLocation || value.toSite || 'N/A';
        // [1.hd] combinedSite
        let combinedSite = `${from} ➔ ${to}`;
        if (value.jobType === 'Usage') combinedSite = `Used at ${from}`;

        // [1.he] contactPerson
        let contactPerson = value.receiver || 'N/A';
        if (value.remarks === 'Pending') contactPerson = value.approver;

        processedEntries.push({
            key,
            ...value,
            source: 'transfer_entry',
            productID: value.productID || '',
            jobType: value.jobType || 'Transfer',
            for: value.jobType || 'Transfer',
            ref: value.controlNumber,
            controlId: value.controlNumber,
            site: combinedSite,
            orderedQty: value.requiredQty || 0,
            deliveredQty: value.receivedQty || 0,
            shippingDate: value.shippingDate || 'N/A',
            arrivalDate: value.arrivalDate || 'N/A',
            contactName: contactPerson,
            vendorName: value.productName,
            remarks: value.remarks || value.status || 'Pending'
        });
    });

    // 6. Apply Firebase Updates
    if (Object.keys(updatesToFirebase).length > 0) {
        console.log(`Auto-updating ${Object.keys(updatesToFirebase).length} PRs...`);
        try {
            await db.ref('job_entries').update(updatesToFirebase);
        } catch (error) {
            console.error("Failed to auto-update PRs:", error);
        }
    }

    allSystemEntries = processedEntries;
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    cacheTimestamps.systemEntries = now;
    console.log(`Loaded ${allSystemEntries.length} entries.`);
}


async function ensureApproverDataCached() {
    if (allApproverDataCache) return;
    // [1.hf] snapshot
    const snapshot = await db.ref('approvers').once('value');
    allApproverDataCache = snapshot.val() || {};
    console.log("Approver data cached for position-matching.");
}

// [1.hg] updateLocalInvoiceCache
function updateLocalInvoiceCache(poNumber, invoiceKey, updatedData) {
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        allInvoiceData[poNumber][invoiceKey] = {
            ...allInvoiceData[poNumber][invoiceKey],
            ...updatedData
        };
    }
}
// [1.hh] addToLocalInvoiceCache
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
// [1.hi] removeFromLocalInvoiceCache
function removeFromLocalInvoiceCache(poNumber, invoiceKey) {
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        delete allInvoiceData[poNumber][invoiceKey];
    }
}

async function fetchAndParseVendorsCSV(url) {
    try {
        // [1.hj] response
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error("Failed to fetch Vendors CSV");
        // [1.hk] csvText
        const csvText = await response.text();
        // [1.hl] lines
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');

        // [1.hm] vendorMap
        const vendorMap = {}; // Key: Supplier ID, Value: Vendor Name

        // Assuming Header is Row 0: Name,Supplier ID
        for (let i = 1; i < lines.length; i++) {
            // Simple comma split (assuming no commas IN the names for now, or use complex parser if needed)
            // [1.hn] parts
            const parts = lines[i].split(',');
            if (parts.length >= 2) {
                // Assuming Column 0 = Name, Column 1 = ID
                // Clean up quotes if present
                // [1.ho] name
                const name = parts[0].replace(/^"|"$/g, '').trim();
                // [1.hp] id
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

// [1.hq] normalizeMobile
function normalizeMobile(mobile) {
    const digitsOnly = mobile.replace(/\D/g, '');
    if (digitsOnly.length === 8) {
        return `974${digitsOnly}`;
    }
    return digitsOnly;
}
// [1.hr] formatDate
function formatDate(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}
// [1.hs] formatYYYYMMDD
function formatYYYYMMDD(dateString) {
    if (!dateString) return 'N/A';
    // [1.ht] months
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    // [1.hu] parts
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;

    // [1.hv] year
    const year = parts[0];
    // [1.hw] monthIndex
    const monthIndex = parseInt(parts[1], 10) - 1;
    // [1.hx] day
    const day = parts[2];

    // [1.hy] month
    const month = months[monthIndex];
    if (!month) return dateString;

    return `${day}-${month}-${year}`;
}
// [1.hz] normalizeDateForInput
function normalizeDateForInput(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const parts = dateString.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    if (/^\d{2}-\d{2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-');
        const day = parts[0];
        const month = parts[1];
        const year = `20${parts[2]}`;
        return `${year}-${month}-${day}`;
    }
    // [1.ia] date
    const date = new Date(dateString);
    if (!isNaN(date)) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    console.warn("Unrecognized date format:", dateString);
    return '';
}
// [1.ib] convertDisplayDateToInput
function convertDisplayDateToInput(displayDate) {
    if (!displayDate || typeof displayDate !== 'string') return '';
    // [1.ic] parts
    const parts = displayDate.split('-');
    if (parts.length !== 3) return '';
    // [1.id] day
    const day = parts[0];
    const year = parts[2];
    // [1.ie] monthMap
    const monthMap = {
        "Jan": "01",
        "Feb": "02",
        "Mar": "03",
        "Apr": "04",
        "May": "05",
        "Jun": "06",
        "Jul": "07",
        "Aug": "08",
        "Sep": "09",
        "Oct": "10",
        "Nov": "11",
        "Dec": "12"
    };
    // [1.if] month
    const month = monthMap[parts[1]];
    if (!month) return '';
    return `${year}-${month}-${day}`;
}
// [1.ig] getTodayDateString
function getTodayDateString() {
    // [1.ih] today
    const today = new Date();
    // [1.ii] year
    const year = today.getFullYear();
    // [1.ij] month
    const month = String(today.getMonth() + 1).padStart(2, '0');
    // [1.ik] day
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
// [1.il] formatCurrency
function formatCurrency(value) {
    if (typeof value === 'number') {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    // [1.im] number
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) {
        return 'N/A';
    }
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
// [1.in] formatFinanceNumber
function formatFinanceNumber(value) {
    if (value === undefined || value === null || value === '') return '';
    // [1.io] num
    const num = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? value : num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
// [1.ip] formatFinanceDate
function formatFinanceDate(dateStr) {
    if (!dateStr || String(dateStr).trim() === '') return '';
    // [1.iq] date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return dateStr;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // [1.ir] parts
        const parts = dateStr.split('-');
        // [1.is] year
        const year = parseInt(parts[0], 10);
        // [1.it] month
        const month = parseInt(parts[1], 10) - 1;
        // [1.iu] day
        const day = parseInt(parts[2], 10);
        // [1.iv] utcDate
        const utcDate = new Date(Date.UTC(year, month, day));

        // [1.iw] dayFormatted
        const dayFormatted = utcDate.getUTCDate().toString().padStart(2, '0');
        // [1.ix] monthFormatted
        const monthFormatted = utcDate.toLocaleString('default', {
            month: 'short',
            timeZone: 'UTC'
        }).toUpperCase();
        // [1.iy] yearFormatted
        const yearFormatted = utcDate.getUTCFullYear();
        return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
    }
    // [1.iz] dayFormatted
    const dayFormatted = date.getUTCDate().toString().padStart(2, '0');
    // [1.ja] monthFormatted
    const monthFormatted = date.toLocaleString('default', {
        month: 'short',
        timeZone: 'UTC'
    }).toUpperCase();
    // [1.jb] yearFormatted
    const yearFormatted = date.getUTCFullYear();
    return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
}
// [1.jc] formatFinanceDateLong
function formatFinanceDateLong(dateStr) {
    if (!dateStr) return '';
    // [1.jd] date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    // [1.je] day
    const day = date.getDate();
    // [1.jf] month
    const month = date.toLocaleString('default', {
        month: 'long'
    });
    // [1.jg] year
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}
// [1.jh] numberToWords
function numberToWords(num) {
    // [1.ji] a
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    // [1.jj] b
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    // [1.jk] s
    const s = ['', 'Thousand', 'Million', 'Billion'];
    // [1.jl] number
    const number = parseFloat(num).toFixed(2);
    const [integerPart, fractionalPart] = number.split('.');
    // [1.jm] toWords
    function toWords(n) {
        if (n < 20) return a[n];
        let digit = n % 10;
        return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
    }
    // [1.jn] convert
    function convert(nStr) {
        if (nStr === '0') return 'Zero';
        // [1.jo] words
        let words = '';
        let i = nStr.length;
        while (i > 0) {
            // [1.jp] chunk
            let chunk = nStr.substring(Math.max(0, i - 3), i);
            if (chunk !== '000') {
                let num = parseInt(chunk);
                words = (chunk.length === 3 && num < 100 ? 'and ' : '') + toWords(num % 100) + (num > 99 ? ' Hundred' + (num % 100 ? ' and ' : '') : '') + ' ' + s[(nStr.length - i) / 3] + ' ' + words;
            }
            i -= 3;
        }
        return words.trim().replace(/\s+/g, ' ');
    }
    // [1.jq] words
    let words = convert(integerPart);
    if (fractionalPart && parseInt(fractionalPart) > 0) {
        words += ' and ' + parseInt(fractionalPart) + '/100';
    }
    return words.charAt(0).toUpperCase() + words.slice(1) + " Qatari Riyals Only";
}
// [1.jr] debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        // [1.js] later
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
// [1.jt] updateDashboardDateTime
function updateDashboardDateTime() {}
// [1.ju] updateWorkdeskDateTime
function updateWorkdeskDateTime() {}
// [1.jv] updateIMDateTime
function updateIMDateTime() {}

// ==========================================================================
// 5. DOM ELEMENT REFERENCES
// ==========================================================================

// --- Main Views ---
// [1.jw] views
const views = {
    login: document.getElementById('login-view'),
    password: document.getElementById('password-view'),
    setup: document.getElementById('setup-view'),
    dashboard: document.getElementById('dashboard-view'),
    workdesk: document.getElementById('workdesk-view')
};

// --- Login & Setup Forms ---
// [1.jx] loginForm
const loginForm = document.getElementById('login-form');
// [1.jy] loginIdentifierInput
const loginIdentifierInput = document.getElementById('login-identifier');
// [1.jz] loginError
const loginError = document.getElementById('login-error');
// [1.ka] passwordForm
const passwordForm = document.getElementById('password-form');
// [1.kb] passwordInput
const passwordInput = document.getElementById('login-password');
// [1.kc] passwordUserIdentifier
const passwordUserIdentifier = document.getElementById('password-user-identifier');
// [1.kd] passwordError
const passwordError = document.getElementById('password-error');
// [1.ke] setupForm
const setupForm = document.getElementById('setup-form');
// [1.kf] setupEmailContainer
const setupEmailContainer = document.getElementById('setup-email-container');
// [1.kg] setupEmailInput
const setupEmailInput = document.getElementById('setup-email');
// [1.kh] setupSiteContainer
const setupSiteContainer = document.getElementById('setup-site-container');
// [1.ki] setupSiteInput
const setupSiteInput = document.getElementById('setup-site');
// [1.kj] setupPositionContainer
const setupPositionContainer = document.getElementById('setup-position-container');
// [1.kk] setupPositionInput
const setupPositionInput = document.getElementById('setup-position');
// [1.kl] setupPasswordInput
const setupPasswordInput = document.getElementById('setup-password');
// [1.km] setupError
const setupError = document.getElementById('setup-error');

// --- Main Dashboard & Workdesk Navigation ---
// [1.kn] dashboardUsername
const dashboardUsername = document.getElementById('dashboard-username');
// [1.ko] datetimeElement
const datetimeElement = document.getElementById('datetime');
// [1.kp] logoutButton
const logoutButton = document.getElementById('logout-button');
// [1.kq] workdeskButton
const workdeskButton = document.getElementById('workdesk-button');
// [1.kr] wdUsername
const wdUsername = document.getElementById('wd-username');
// [1.ks] wdUserIdentifier
const wdUserIdentifier = document.getElementById('wd-user-identifier');
// [1.kt] workdeskNav
const workdeskNav = document.getElementById('workdesk-nav');
// [1.ku] workdeskSections
const workdeskSections = document.querySelectorAll('.workdesk-section');
// [1.kv] wdLogoutButton
const wdLogoutButton = document.getElementById('wd-logout-button');
// [1.kw] workdeskDatetimeElement
const workdeskDatetimeElement = document.getElementById('workdesk-datetime');
// [1.kx] workdeskIMLinkContainer
const workdeskIMLinkContainer = document.getElementById('workdesk-im-link-container');
// [1.ky] workdeskIMLink
const workdeskIMLink = document.getElementById('workdesk-im-link');

// --- Workdesk: Job Entry ---
// [1.kz] jobEntryForm
const jobEntryForm = document.getElementById('jobentry-form');
// [1.la] jobForSelect
const jobForSelect = document.getElementById('job-for');
// [1.lb] jobDateInput
const jobDateInput = document.getElementById('job-date');
// [1.lc] jobEntrySearchInput
const jobEntrySearchInput = document.getElementById('job-entry-search');
// [1.ld] jobEntryTableWrapper
const jobEntryTableWrapper = document.getElementById('job-entry-table-wrapper');
// [1.le] jobEntryTableBody
const jobEntryTableBody = document.getElementById('job-entry-table-body');
// [1.lf] jobEntryFormTitle
const jobEntryFormTitle = document.getElementById('standard-modal-title');
// [1.lg] deleteJobButton
const deleteJobButton = document.getElementById('delete-job-button');
// [1.lh] jobEntryNavControls
const jobEntryNavControls = document.getElementById('jobentry-nav-controls');
// [1.li] navPrevJobButton
const navPrevJobButton = document.getElementById('nav-prev-job');
// [1.lj] navNextJobButton
const navNextJobButton = document.getElementById('nav-next-job');
// [1.lk] navJobCounter
const navJobCounter = document.getElementById('nav-job-counter');
// [1.ll] addJobButton
const addJobButton = document.getElementById('add-job-button');
// [1.lm] updateJobButton
const updateJobButton = document.getElementById('update-job-button');
// [1.ln] clearJobButton
const clearJobButton = document.getElementById('clear-job-button');

// --- Workdesk: Active Tasks ---
// [1.lo] activeTaskTableBody
const activeTaskTableBody = document.getElementById('active-task-table-body');
// [1.lp] activeTaskFilters
const activeTaskFilters = document.getElementById('active-task-filters');
// [1.lq] activeTaskSearchInput
const activeTaskSearchInput = document.getElementById('active-task-search');
// [1.lr] activeTaskCountDisplay
const activeTaskCountDisplay = document.getElementById('active-task-count-display');
// [1.ls] dbActiveTasksCount
const dbActiveTasksCount = document.getElementById('db-active-tasks-count');
// [1.lt] activeTaskClearButton
const activeTaskClearButton = document.getElementById('active-task-clear-button');
// [1.lu] activeTaskCardLink
const activeTaskCardLink = document.getElementById('db-active-tasks-card-link'); // Dashboard card

// --- Workdesk: Calendar & Day View ---
// [1.lv] wdCalendarGrid
const wdCalendarGrid = document.getElementById('wd-calendar-grid');
// [1.lw] wdCalendarMonthYear
const wdCalendarMonthYear = document.getElementById('wd-calendar-month-year');
// [1.lx] wdCalendarPrevBtn
const wdCalendarPrevBtn = document.getElementById('wd-calendar-prev');
// [1.ly] wdCalendarNextBtn
const wdCalendarNextBtn = document.getElementById('wd-calendar-next');
// [1.lz] wdCalendarTaskListTitle
const wdCalendarTaskListTitle = document.getElementById('wd-calendar-task-list-title');
// [1.ma] wdCalendarTaskListUl
const wdCalendarTaskListUl = document.getElementById('wd-calendar-task-list-ul');
// [1.mb] wdCalendarToggleBtn
const wdCalendarToggleBtn = document.getElementById('wd-calendar-toggle-view');
// [1.mc] wdCalendarYearGrid
const wdCalendarYearGrid = document.getElementById('wd-calendar-year-grid');
// [1.md] dayViewBackBtn
const dayViewBackBtn = document.getElementById('wd-dayview-back-btn');
// [1.me] dayViewPrevBtn
const dayViewPrevBtn = document.getElementById('wd-dayview-prev-btn');
// [1.mf] dayViewNextBtn
const dayViewNextBtn = document.getElementById('wd-dayview-next-btn');
// [1.mg] dayViewTaskList
const dayViewTaskList = document.getElementById('wd-dayview-task-list');
// [1.mh] mobileMenuBtn
const mobileMenuBtn = document.getElementById('wd-dayview-mobile-menu-btn');
// [1.mi] mobileNotifyBtn
const mobileNotifyBtn = document.getElementById('wd-dayview-mobile-notify-btn');
// [1.mj] mobileLogoutBtn
const mobileLogoutBtn = document.getElementById('wd-dayview-mobile-logout-btn-new');
// [1.mk] dateScroller
const dateScroller = document.getElementById('wd-dayview-date-scroller-inner');
// [1.ml] calendarModalViewTasksBtn
const calendarModalViewTasksBtn = document.getElementById('calendar-modal-view-tasks-btn');

// --- Workdesk: Reporting & Stats ---
// [1.mm] reportingTableBody
const reportingTableBody = document.getElementById('reporting-table-body');
// [1.mn] reportingSearchInput
const reportingSearchInput = document.getElementById('reporting-search');
// [1.mo] reportTabsContainer
const reportTabsContainer = document.getElementById('report-tabs');
// [1.mp] printReportButton
const printReportButton = document.getElementById('print-report-button');
// [1.mq] downloadWdReportButton
const downloadWdReportButton = document.getElementById('download-wd-report-csv-button');
// [1.mr] dbCompletedTasksCount
const dbCompletedTasksCount = document.getElementById('db-completed-tasks-count');
// [1.ms] dbSiteStatsContainer
const dbSiteStatsContainer = document.getElementById('dashboard-site-stats');
// [1.mt] dbRecentTasksBody
const dbRecentTasksBody = document.getElementById('db-recent-tasks-body');
// [1.mu] jobRecordsCountDisplay
const jobRecordsCountDisplay = document.getElementById('job-records-count-display');

// --- Workdesk: Settings ---
// [1.mv] settingsForm
const settingsForm = document.getElementById('settings-form');
// [1.mw] settingsNameInput
const settingsNameInput = document.getElementById('settings-name');
// [1.mx] settingsEmailInput
const settingsEmailInput = document.getElementById('settings-email');
// [1.my] settingsMobileInput
const settingsMobileInput = document.getElementById('settings-mobile');
// [1.mz] settingsPositionInput
const settingsPositionInput = document.getElementById('settings-position');
// [1.na] settingsSiteInput
const settingsSiteInput = document.getElementById('settings-site');
// [1.nb] settingsPasswordInput
const settingsPasswordInput = document.getElementById('settings-password');
// [1.nc] settingsVacationCheckbox
const settingsVacationCheckbox = document.getElementById('settings-vacation');
// [1.nd] settingsReturnDateInput
const settingsReturnDateInput = document.getElementById('settings-return-date');
// [1.ne] settingsMessage
const settingsMessage = document.getElementById('settings-message');
// [1.nf] settingsVacationDetailsContainer
const settingsVacationDetailsContainer = document.getElementById('settings-vacation-details-container');
// [1.ng] settingsReplacementNameInput
const settingsReplacementNameInput = document.getElementById('settings-replacement-name');
// [1.nh] settingsReplacementContactInput
const settingsReplacementContactInput = document.getElementById('settings-replacement-contact');
// [1.ni] settingsReplacementEmailInput
const settingsReplacementEmailInput = document.getElementById('settings-replacement-email');

// --- Invoice Management (IM) Common ---
// [1.nj] invoiceManagementView
const invoiceManagementView = document.getElementById('invoice-management-view');
// [1.nk] imNav
const imNav = document.getElementById('im-nav');
// [1.nl] imContentArea
const imContentArea = document.getElementById('im-content-area');
// [1.nm] imMainElement
const imMainElement = document.querySelector('#invoice-management-view .workdesk-main');
// [1.nn] invoiceManagementButton
const invoiceManagementButton = document.getElementById('invoice-mgmt-button');
// [1.no] imUsername
const imUsername = document.getElementById('im-username');
// [1.np] imUserIdentifier
const imUserIdentifier = document.getElementById('im-user-identifier');
// [1.nq] imLogoutButton
const imLogoutButton = document.getElementById('im-logout-button');
// [1.nr] imDatetimeElement
const imDatetimeElement = document.getElementById('im-datetime');
// [1.ns] imWorkdeskButton
const imWorkdeskButton = document.getElementById('im-workdesk-button');
// [1.nt] imActiveTaskButton
const imActiveTaskButton = document.getElementById('im-activetask-button');
// [1.nu] imBackToWDDashboardLink
const imBackToWDDashboardLink = document.getElementById('im-back-to-wd-dashboard-link'); // Mobile

// --- IM: Invoice Entry ---
// [1.nv] imPOSearchInput
const imPOSearchInput = document.getElementById('im-po-search-input');
// [1.nw] imPOSearchButton
const imPOSearchButton = document.getElementById('im-po-search-button');
// [1.nx] imPOSearchInputBottom
const imPOSearchInputBottom = document.getElementById('im-po-search-input-bottom');
// [1.ny] imPOSearchButtonBottom
const imPOSearchButtonBottom = document.getElementById('im-po-search-button-bottom');
// [1.nz] imPODetailsContainer
const imPODetailsContainer = document.getElementById('im-po-details-container');
// [1.oa] imNewInvoiceForm
const imNewInvoiceForm = document.getElementById('im-new-invoice-form');
// [1.ob] imInvEntryIdInput
const imInvEntryIdInput = document.getElementById('im-inv-entry-id');
// [1.oc] imFormTitle
const imFormTitle = document.getElementById('im-form-title');
// [1.od] imAttentionSelect
const imAttentionSelect = document.getElementById('im-attention');
// [1.oe] imAddInvoiceButton
const imAddInvoiceButton = document.getElementById('im-add-invoice-button');
// [1.of] imUpdateInvoiceButton
const imUpdateInvoiceButton = document.getElementById('im-update-invoice-button');
// [1.og] imClearFormButton
const imClearFormButton = document.getElementById('im-clear-form-button');
// [1.oh] imBackToActiveTaskButton
const imBackToActiveTaskButton = document.getElementById('im-back-to-active-task-button');
// [1.oi] imExistingInvoicesContainer
const imExistingInvoicesContainer = document.getElementById('im-existing-invoices-container');
// [1.oj] imInvoicesTableBody
const imInvoicesTableBody = document.getElementById('im-invoices-table-body');
// [1.ok] imInvoiceDateInput
const imInvoiceDateInput = document.getElementById('im-invoice-date');
// [1.ol] imReleaseDateInput
const imReleaseDateInput = document.getElementById('im-release-date');
// [1.om] imStatusSelect
const imStatusSelect = document.getElementById('im-status');
// [1.on] imInvValueInput
const imInvValueInput = document.getElementById('im-inv-value');
// [1.oo] imAmountPaidInput
const imAmountPaidInput = document.getElementById('im-amount-paid');
// [1.op] existingInvoicesCountDisplay
const existingInvoicesCountDisplay = document.getElementById('existing-invoices-count-display');
// [1.oq] imEntrySidebar
const imEntrySidebar = document.getElementById('im-entry-sidebar');
// [1.or] imEntrySidebarList
const imEntrySidebarList = document.getElementById('im-entry-sidebar-list');
// [1.os] imShowActiveJobsBtn
const imShowActiveJobsBtn = document.getElementById('im-show-active-jobs-btn');
// [1.ot] activeJobsSidebarCountDisplay
const activeJobsSidebarCountDisplay = document.getElementById('active-jobs-sidebar-count-display');

// --- IM: Batch Entry ---
// [1.ou] batchTableBody
const batchTableBody = document.getElementById('im-batch-table-body');
// [1.ov] batchClearBtn
const batchClearBtn = document.getElementById('im-batch-clear-button');
// [1.ow] batchCountDisplay
const batchCountDisplay = document.getElementById('batch-count-display');
// [1.ox] imBatchSearchExistingButton
const imBatchSearchExistingButton = document.getElementById('im-batch-search-existing-button');
// [1.oy] imBatchSearchModal
const imBatchSearchModal = document.getElementById('im-batch-search-modal');
// [1.oz] imBatchNoteSearchSelect
const imBatchNoteSearchSelect = document.getElementById('im-batch-note-search-select');
// [1.pa] imBatchGlobalAttention
const imBatchGlobalAttention = document.getElementById('im-batch-global-attention');
// [1.pb] imBatchGlobalStatus
const imBatchGlobalStatus = document.getElementById('im-batch-global-status');
// [1.pc] imBatchGlobalNote
const imBatchGlobalNote = document.getElementById('im-batch-global-note');
// [1.pd] batchAddBtn
const batchAddBtn = document.getElementById('im-batch-add-po-button');
// [1.pe] batchSaveBtn
const batchSaveBtn = document.getElementById('im-batch-save-button');
// [1.pf] batchPOInput
const batchPOInput = document.getElementById('im-batch-po-input');
// [1.pg] batchSearchStatusBtn
const batchSearchStatusBtn = document.getElementById('im-batch-search-by-status-button');
// [1.ph] batchSearchNoteBtn
const batchSearchNoteBtn = document.getElementById('im-batch-search-by-note-button');

// --- IM: Payments ---
// [1.pi] paymentsNavLink
const paymentsNavLink = document.getElementById('payments-nav-link');
// [1.pj] imPaymentsSection
const imPaymentsSection = document.getElementById('im-payments');
// [1.pk] imAddPaymentButton
const imAddPaymentButton = document.getElementById('im-add-payment-button');
// [1.pl] imPaymentsTableBody
const imPaymentsTableBody = document.getElementById('im-payments-table-body');
// [1.pm] imSavePaymentsButton
const imSavePaymentsButton = document.getElementById('im-save-payments-button');
// [1.pn] imAddPaymentModal
const imAddPaymentModal = document.getElementById('im-add-payment-modal');
// [1.po] imPaymentModalPOInput
const imPaymentModalPOInput = document.getElementById('im-payment-modal-po-input');
// [1.pp] imPaymentModalSearchBtn
const imPaymentModalSearchBtn = document.getElementById('im-payment-modal-search-btn');
// [1.pq] imPaymentModalResults
const imPaymentModalResults = document.getElementById('im-payment-modal-results');
// [1.pr] imPaymentModalAddSelectedBtn
const imPaymentModalAddSelectedBtn = document.getElementById('im-payment-modal-add-selected-btn');
// [1.ps] paymentsCountDisplay
const paymentsCountDisplay = document.getElementById('payments-count-display');

// --- IM: Reporting & Finance ---
// [1.pt] imReportingForm
const imReportingForm = document.getElementById('im-reporting-form');
// [1.pu] imReportingContent
const imReportingContent = document.getElementById('im-reporting-content');
// [1.pv] imReportingSearchInput
const imReportingSearchInput = document.getElementById('im-reporting-search');
// [1.pw] imReportingClearButton
const imReportingClearButton = document.getElementById('im-reporting-clear-button');
// [1.px] imReportingDownloadCSVButton
const imReportingDownloadCSVButton = document.getElementById('im-reporting-download-csv-button');
// [1.py] imReportingPrintBtn
const imReportingPrintBtn = document.getElementById('im-reporting-print-btn');
// [1.pz] imReportingPrintableArea
const imReportingPrintableArea = document.getElementById('im-reporting-printable-area');
// [1.qa] imDailyReportDateInput
const imDailyReportDateInput = document.getElementById('im-daily-report-date');
// [1.qb] imDownloadDailyReportButton
const imDownloadDailyReportButton = document.getElementById('im-download-daily-report-button');
// [1.qc] imDownloadWithAccountsReportButton
const imDownloadWithAccountsReportButton = document.getElementById('im-download-with-accounts-report-button');
// [1.qd] reportingCountDisplay
const reportingCountDisplay = document.getElementById('reporting-count-display');
// Print Report Elements
// [1.qe] imPrintReportTitle
const imPrintReportTitle = document.getElementById('im-print-report-title');
// [1.qf] imPrintReportDate
const imPrintReportDate = document.getElementById('im-print-report-date');
// [1.qg] imPrintReportSummaryPOs
const imPrintReportSummaryPOs = document.getElementById('im-print-report-summary-pos');
// [1.qh] imPrintReportSummaryValue
const imPrintReportSummaryValue = document.getElementById('im-print-report-summary-value');
// [1.qi] imPrintReportSummaryPaid
const imPrintReportSummaryPaid = document.getElementById('im-print-report-summary-paid');
// [1.qj] imPrintReportBody
const imPrintReportBody = document.getElementById('im-print-report-body');

// --- IM: Finance Report (Admin) ---
// [1.qk] imFinanceReportNavLink
const imFinanceReportNavLink = document.getElementById('im-finance-report-nav-link');
// [1.ql] imFinanceReportSection
const imFinanceReportSection = document.getElementById('im-finance-report');
// [1.qm] imFinanceSearchPoInput
const imFinanceSearchPoInput = document.getElementById('im-finance-search-po');
// [1.qn] imFinanceSearchBtn
const imFinanceSearchBtn = document.getElementById('im-finance-search-btn');
// [1.qo] imFinanceClearBtn
const imFinanceClearBtn = document.getElementById('im-finance-clear-btn');
// [1.qp] imFinanceResults
const imFinanceResults = document.getElementById('im-finance-results');
// [1.qq] imFinanceNoResults
const imFinanceNoResults = document.getElementById('im-finance-no-results');
// [1.qr] imFinanceResultsBody
const imFinanceResultsBody = document.getElementById('im-finance-results-body');
// [1.qs] imFinanceReportModal
const imFinanceReportModal = document.getElementById('im-finance-report-modal');
// [1.qt] imFinancePrintReportBtn
const imFinancePrintReportBtn = document.getElementById('im-finance-print-report-btn');
// [1.qu] financeReportCountDisplay
const financeReportCountDisplay = document.getElementById('finance-report-count-display');
// Finance Modal Details
// [1.qv] imReportDate
const imReportDate = document.getElementById('im-reportDate');
// [1.qw] imReportPoNo
const imReportPoNo = document.getElementById('im-reportPoNo');
// [1.qx] imReportProject
const imReportProject = document.getElementById('im-reportProject');
// [1.qy] imReportVendorId
const imReportVendorId = document.getElementById('im-reportVendorId');
// [1.qz] imReportVendorName
const imReportVendorName = document.getElementById('im-reportVendorName');
// [1.ra] imReportTotalPoValue
const imReportTotalPoValue = document.getElementById('im-reportTotalPoValue');
// [1.rb] imReportTotalCertified
const imReportTotalCertified = document.getElementById('im-reportTotalCertified');
// [1.rc] imReportTotalPrevPayment
const imReportTotalPrevPayment = document.getElementById('im-reportTotalPrevPayment');
// [1.rd] imReportTotalCommitted
const imReportTotalCommitted = document.getElementById('im-reportTotalCommitted');
// [1.re] imReportTotalRetention
const imReportTotalRetention = document.getElementById('im-reportTotalRetention');
// [1.rf] imReportTableBody
const imReportTableBody = document.getElementById('im-reportTableBody');
// [1.rg] imReportTotalCertifiedAmount
const imReportTotalCertifiedAmount = document.getElementById('im-reportTotalCertifiedAmount');
// [1.rh] imReportTotalRetentionAmount
const imReportTotalRetentionAmount = document.getElementById('im-reportTotalRetentionAmount');
// [1.ri] imReportTotalPaymentAmount
const imReportTotalPaymentAmount = document.getElementById('im-reportTotalPaymentAmount');
// [1.rj] imReportNotesSection
const imReportNotesSection = document.getElementById('im-reportNotesSection');
// [1.rk] imReportNotesContent
const imReportNotesContent = document.getElementById('im-reportNotesContent');

// --- IM: Summary Note ---
// [1.rl] summaryNotePreviousInput
const summaryNotePreviousInput = document.getElementById('summary-note-previous-input');
// [1.rm] summaryNoteCurrentInput
const summaryNoteCurrentInput = document.getElementById('summary-note-current-input');
// [1.rn] summaryNoteGenerateBtn
const summaryNoteGenerateBtn = document.getElementById('summary-note-generate-btn');
// [1.ro] summaryNoteUpdateBtn
const summaryNoteUpdateBtn = document.getElementById('summary-note-update-btn');
// [1.rp] summaryNotePrevPdfBtn
const summaryNotePrevPdfBtn = document.getElementById('summary-note-prev-pdf-btn'); // <--- ADD THIS
// [1.rq] summaryNotePrintBtn
const summaryNotePrintBtn = document.getElementById('summary-note-print-btn');
// [1.rr] summaryNotePrintArea
const summaryNotePrintArea = document.getElementById('summary-note-printable-area');
// [1.rs] snDate
const snDate = document.getElementById('sn-date');
// [1.rt] snVendorName
const snVendorName = document.getElementById('sn-vendor-name');
// [1.ru] snPreviousPayment
const snPreviousPayment = document.getElementById('sn-previous-payment');
// [1.rv] snCurrentPayment
const snCurrentPayment = document.getElementById('sn-current-payment');
// [1.rw] snTableBody
const snTableBody = document.getElementById('sn-table-body');
// [1.rx] snTotalInWords
const snTotalInWords = document.getElementById('sn-total-in-words');
// [1.ry] snTotalNumeric
const snTotalNumeric = document.getElementById('sn-total-numeric');
// [1.rz] noteSuggestionsDatalist
const noteSuggestionsDatalist = document.getElementById('note-suggestions');
// [1.sa] summaryNoteCountDisplay
const summaryNoteCountDisplay = document.getElementById('summary-note-count-display');
// [1.sb] summaryClearBtn
const summaryClearBtn = document.getElementById('summary-note-clear-btn');

// --- Modals & Mobile Elements ---
// [1.sc] ceoApprovalModal
const ceoApprovalModal = document.getElementById('ceo-approval-modal');
// [1.sd] ceoModalDetails
const ceoModalDetails = document.getElementById('ceo-modal-details');
// [1.se] ceoModalAmount
const ceoModalAmount = document.getElementById('ceo-modal-amount');
// [1.sf] ceoModalNote
const ceoModalNote = document.getElementById('ceo-modal-note');
// [1.sg] ceoModalApproveBtn
const ceoModalApproveBtn = document.getElementById('ceo-modal-approve-btn');
// [1.sh] ceoModalRejectBtn
const ceoModalRejectBtn = document.getElementById('ceo-modal-reject-btn');
// [1.si] sendCeoApprovalReceiptBtn
const sendCeoApprovalReceiptBtn = document.getElementById('send-ceo-approval-receipt-btn');

// [1.sj] vacationModal
const vacationModal = document.getElementById('vacation-replacement-modal');
// [1.sk] vacationingUserName
const vacationingUserName = document.getElementById('vacationing-user-name');
// [1.sl] vacationReturnDate
const vacationReturnDate = document.getElementById('vacation-return-date');
// [1.sm] replacementNameDisplay
const replacementNameDisplay = document.getElementById('replacement-name-display');
// [1.sn] replacementContactDisplay
const replacementContactDisplay = document.getElementById('replacement-contact-display');
// [1.so] replacementEmailDisplay
const replacementEmailDisplay = document.getElementById('replacement-email-display');

// [1.sp] modifyTaskModal
const modifyTaskModal = document.getElementById('modify-task-modal');
// [1.sq] modifyTaskAttention
const modifyTaskAttention = document.getElementById('modify-task-attention');
// [1.sr] modifyTaskStatus
const modifyTaskStatus = document.getElementById('modify-task-status');
// [1.ss] modifyTaskStatusOtherContainer
const modifyTaskStatusOtherContainer = document.getElementById('modify-task-status-other-container');
// [1.st] modifyTaskStatusOther
const modifyTaskStatusOther = document.getElementById('modify-task-status-other');
// [1.su] modifyTaskNote
const modifyTaskNote = document.getElementById('modify-task-note');
// [1.sv] modifyTaskSaveBtn
const modifyTaskSaveBtn = document.getElementById('modify-task-save-btn');
// [1.sw] modifyTaskKey
const modifyTaskKey = document.getElementById('modify-task-key');
// [1.sx] modifyTaskSource
const modifyTaskSource = document.getElementById('modify-task-source');
// [1.sy] modifyTaskOriginalPO
const modifyTaskOriginalPO = document.getElementById('modify-task-originalPO');
// [1.sz] modifyTaskOriginalKey
const modifyTaskOriginalKey = document.getElementById('modify-task-originalKey');

// Mobile Search & Misc
// [1.ta] imMobileSearchBtn
const imMobileSearchBtn = document.getElementById('im-mobile-search-btn');
// [1.tb] imMobileSearchModal
const imMobileSearchModal = document.getElementById('im-mobile-search-modal');
// [1.tc] imMobileSearchRunBtn
const imMobileSearchRunBtn = document.getElementById('im-mobile-search-run-btn');
// [1.td] imMobileSearchClearBtn
const imMobileSearchClearBtn = document.getElementById('im-mobile-search-clear-btn');
// [1.te] imMobileSearchCloseBtn
const imMobileSearchCloseBtn = document.querySelector('[data-modal-id="im-mobile-search-modal"]');
// [1.tf] wdImReportingLinkMobile
const wdImReportingLinkMobile = document.getElementById('wd-im-reporting-link-mobile');
// [1.tg] imNavReportingLinkMobile
const imNavReportingLinkMobile = document.getElementById('im-nav-reporting-link-mobile'); // New Selector
// [1.th] mobileSendReceiptBtn
const mobileSendReceiptBtn = document.getElementById('mobile-send-receipt-btn');
// [1.ti] mobileActiveTaskLogoutBtn
const mobileActiveTaskLogoutBtn = document.getElementById('mobile-activetask-logout-btn');
// [1.tj] imMobileActiveTaskLink
const imMobileActiveTaskLink = document.getElementById('im-mobile-activetask-link');
// [1.tk] mobileActiveTaskRefreshBtn
const mobileActiveTaskRefreshBtn = document.getElementById('mobile-activetask-refresh-btn');
// [1.tl] mobileLoginForm
const mobileLoginForm = document.getElementById('mobile-login-form');

// --- Badges ---
// [1.tm] wdActiveTaskBadge
const wdActiveTaskBadge = document.getElementById('wd-active-task-badge');
// [1.tn] imActiveTaskBadge
const imActiveTaskBadge = document.getElementById('im-active-task-badge');
// [1.to] wdMobileNotifyBadge
const wdMobileNotifyBadge = document.getElementById('wd-mobile-notify-badge');

// ==========================================================================
// 6. VIEW NAVIGATION & AUTHENTICATION
// ==========================================================================

// [1.tp] showView
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
    // [1.tq] isEmail
    const isEmail = identifier.includes('@');
    // [1.tr] searchKey
    const searchKey = isEmail ? 'Email' : 'Mobile';
    // [1.ts] searchValue
    const searchValue = isEmail ? identifier : normalizeMobile(identifier);

    // Cache check
    if (!allApproverData) {
        console.log("Caching approvers list for the first time...");
        // [1.tt] snapshot
        const snapshot = await db.ref('approvers').once('value');
        allApproverData = snapshot.val();
    }
    // [1.tu] approversData
    const approversData = allApproverData;

    if (!approversData) return null;
    for (const key in approversData) {
        // [1.tv] record
        const record = approversData[key];
        // [1.tw] dbValue
        const dbValue = record[searchKey];
        if (dbValue) {
            if (isEmail) {
                if (dbValue.toLowerCase() === searchValue.toLowerCase()) {
                    return {
                        key,
                        ...record
                    };
                }
            } else {
                // [1.tx] normalizedDbMobile
                const normalizedDbMobile = dbValue.replace(/\D/g, '');
                if (normalizedDbMobile === searchValue) {
                    return {
                        key,
                        ...record
                    };
                }
            }
        }
    }
    return null;
}

async function getApproverByKey(key) {
    try {
        // [1.ty] snapshot
        const snapshot = await db.ref(`approvers/${key}`).once('value');
        // [1.tz] approverData
        const approverData = snapshot.val();
        if (approverData) {
            return {
                key,
                ...approverData
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching approver by key:", error);
        return null;
    }
}

// [1.ua] handleSuccessfulLogin
function handleSuccessfulLogin() {
    if (currentApprover && currentApprover.key) {
        localStorage.setItem('approverKey', currentApprover.key);
    } else {
        console.error("Attempted to save login state but currentApprover or key is missing.");
        handleLogout();
        return;
    }

    // Check for CEO Admin role
    // [1.ub] isCEO
    const isCEO = (currentApprover?.Role || '').toLowerCase() === 'admin' &&
        (currentApprover?.Position || '').toLowerCase() === 'ceo';
    document.body.classList.toggle('is-ceo', isCEO);

    // [1.uc] isMobile
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        workdeskButton.click();
    } else {
        showView('dashboard');
    }

    // [1.ud] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    document.body.classList.toggle('is-admin', isAdmin);

    // [1.ue] userPositionLower
    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    // [1.uf] isAccounting
    const isAccounting = userPositionLower === 'accounting';
    // [1.ug] isAccounts
    const isAccounts = userPositionLower === 'accounts';

    // --- Hide Finance Report Button for non-Accounts ---
    // [1.uh] financeReportButton
    const financeReportButton = document.querySelector('a[href="https://ibaport.site/Finance/"]');
    if (financeReportButton) {
        // [1.ui] isAccountsOrAccounting
        const isAccountsOrAccounting = isAccounts || isAccounting;
        financeReportButton.classList.toggle('hidden', !isAccountsOrAccounting);
    }

    // --- NEW FIX: Hide Invoice Management Button for Unauthorized Users ---
    // Only Admins, Accounting, or Accounts should see this button
    // [1.uj] invoiceMgmtBtn
    const invoiceMgmtBtn = document.getElementById('invoice-mgmt-button');
    if (invoiceMgmtBtn) {
        if (isAdmin || isAccounting || isAccounts) {
            invoiceMgmtBtn.classList.remove('hidden');
        } else {
            invoiceMgmtBtn.classList.add('hidden');
        }
    }
}

// [1.uk] handleLogout
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
    workdeskSections.forEach(section => {
        section.classList.add('hidden');
    });
    // [1.ul] targetSection
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    // 3. Section-Specific Logic
    if (sectionId === 'wd-dashboard') {
        await populateWorkdeskDashboard();
        renderWorkdeskCalendar();
        renderYearView();
        await populateCalendarTasks();
        // [1.um] today
        const today = new Date();
        // [1.un] year
        const year = today.getFullYear();
        // [1.uo] month
        const month = String(today.getMonth() + 1).padStart(2, '0');
        // [1.up] day
        const day = String(today.getDate()).padStart(2, '0');
        // [1.uq] todayStr
        const todayStr = `${year}-${month}-${day}`;
        displayCalendarTasksForDay(todayStr);
    }

    if (sectionId === 'wd-jobentry') {
        if (!currentlyEditingKey) {
            resetJobEntryForm(false);
        }
        // [1.ur] savedSearch
        const savedSearch = sessionStorage.getItem('jobEntrySearch');
        if (savedSearch) {
            jobEntrySearchInput.value = savedSearch;
        }
        await handleJobEntrySearch(jobEntrySearchInput.value);
    }

    if (sectionId === 'wd-activetask') {
        await populateActiveTasks();

        // [1.us] searchTerm
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
        // [1.ut] savedSearch
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

    if (sectionId === 'wd-settings') {
        populateSettingsForm();
    }
}



// --- Invoice Management Navigation ---
// [1.uu] showIMSection
function showIMSection(sectionId) {
    // 1. Get User Credentials
    // [1.uv] userPos
    const userPos = (currentApprover?.Position || '').trim(); // Case sensitive check next
    // [1.uw] userRole
    const userRole = (currentApprover?.Role || '').toLowerCase();

    // 2. Define Permission Flags (Strict Logic)
    // [1.ux] isAdmin
    const isAdmin = userRole === 'admin';
    // [1.uy] isAccountingPos
    const isAccountingPos = userPos === 'Accounting'; // Case sensitive as per request usually, but let's be safe
    // [1.uz] isAccountsPos
    const isAccountsPos = userPos === 'Accounts';

    // "Admin with Accounting" (Has Everything)
    // [1.va] isAccountingAdmin
    const isAccountingAdmin = isAdmin && isAccountingPos; // Strictly Admin + Accounting

    // "Admin with Accounts" (Has Payments)
    // Note: We allow AccountingAdmin to see payments too since they have "everything"
    // [1.vb] isAccountsAdmin
    const isAccountsAdmin = (isAdmin && isAccountsPos) || isAccountingAdmin;

    // 3. Strict Access Control Checks
    if (sectionId === 'im-invoice-entry' && !isAccountingAdmin) {
        alert('Access Denied: Restricted to Admin & Accounting position.');
        return;
    }
    if (sectionId === 'im-batch-entry' && !isAccountingAdmin) {
        alert('Access Denied: Restricted to Admin & Accounting position.');
        return;
    }
    if (sectionId === 'im-summary-note' && !isAccountingAdmin) {
        alert('Access Denied: Restricted to Admin & Accounting position.');
        return;
    }

    if (sectionId === 'im-payments' && !isAccountsAdmin) {
        alert('Access Denied: Restricted to Admin & Accounts/Accounting position.');
        return;
    }

    if (sectionId === 'im-finance-report' && !isAdmin) {
        alert('Access Denied: Restricted to Admins.');
        return;
    }

    // 4. Show/Hide Views
    imContentArea.querySelectorAll('.workdesk-section').forEach(section => section.classList.add('hidden'));
    // [1.vc] targetSection
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.remove('hidden');

    // 5. Sidebar Handling
    if (sectionId === 'im-invoice-entry') {
        if (imEntrySidebar) imEntrySidebar.classList.remove('hidden');
        if (imMainElement) imMainElement.classList.add('with-sidebar');
        populateActiveJobsSidebar();
    } else {
        if (imEntrySidebar) imEntrySidebar.classList.add('hidden');
        if (imMainElement) imMainElement.classList.remove('with-sidebar');
    }

    // 6. Section Specific Initializers
    if (sectionId === 'im-dashboard') {
        // STOP AUTOMATIC LOADING
        // populateInvoiceDashboard(false); <--- REMOVED

        // Show "Standby" Message instead
        // [1.vd] dbSection
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
        // [1.ve] savedBatchSearch
        const savedBatchSearch = sessionStorage.getItem('imBatchSearch');
        // [1.vf] savedBatchNoteSearch
        const savedBatchNoteSearch = sessionStorage.getItem('imBatchNoteSearch');
        if (savedBatchSearch) document.getElementById('im-batch-po-input').value = savedBatchSearch;
        else document.getElementById('im-batch-po-input').value = '';

        document.getElementById('im-batch-table-body').innerHTML = '';
        updateBatchCount();

        if (!imBatchGlobalAttentionChoices) {
            imBatchGlobalAttentionChoices = new Choices(document.getElementById('im-batch-global-attention'), {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateAttentionDropdown(imBatchGlobalAttentionChoices);
        } else populateAttentionDropdown(imBatchGlobalAttentionChoices);

        if (!imBatchNoteSearchChoices) {
            imBatchNoteSearchChoices = new Choices(document.getElementById('im-batch-note-search-select'), {
                searchEnabled: true,
                shouldSort: true,
                itemSelectText: '',
                removeItemButton: true,
                placeholder: true,
                placeholderValue: 'Search by Note...'
            });
        }
        populateNoteDropdown(imBatchNoteSearchChoices).then(() => {
            if (savedBatchNoteSearch) imBatchNoteSearchChoices.setChoiceByValue(savedBatchNoteSearch);
        });
    }

    if (sectionId === 'im-summary-note') {
        initializeNoteSuggestions();
        // [1.vg] savedPrevNote
        const savedPrevNote = sessionStorage.getItem('imSummaryPrevNote');
        // [1.vh] savedCurrNote
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
        // [1.vi] savedSearch
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
        // [1.vj] showReportBtns
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

// [1.vk] populateSettingsForm
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

    // [1.vl] onVacation
    const onVacation = settingsVacationCheckbox.checked;
    // [1.vm] updates
    const updates = {
        Site: settingsSiteInput.value.trim(),
        Vacation: onVacation ? "Yes" : "",
        DateReturn: onVacation ? settingsReturnDateInput.value : '',
        ReplacementName: onVacation ? settingsReplacementNameInput.value.trim() : '',
        ReplacementContact: onVacation ? settingsReplacementContactInput.value.trim() : '',
        ReplacementEmail: onVacation ? settingsReplacementEmailInput.value.trim() : ''
    };
    // [1.vn] passwordChanged
    let passwordChanged = false;
    // [1.vo] newPassword
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
        currentApprover = {
            ...currentApprover,
            ...updates,
            Vacation: updates.Vacation === "Yes"
        };
        allApproversCache = null;
        allApproverData = null;
        allApproverDataCache = null;
        // Refresh dropdowns that use cached approver data (so Vacation updates show immediately).
        try {
            if (typeof attentionSelectChoices !== 'undefined' && attentionSelectChoices) await populateAttentionDropdown(attentionSelectChoices);
            if (typeof modifyTaskAttentionChoices !== 'undefined' && modifyTaskAttentionChoices) await populateAttentionDropdown(modifyTaskAttentionChoices);
            if (typeof imAttentionSelectChoices !== 'undefined' && imAttentionSelectChoices) await populateAttentionDropdown(imAttentionSelectChoices);
        } catch (refreshErr) {
            console.warn('Could not refresh attention dropdowns after settings update:', refreshErr);
        }

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
        settingsMessage.textContent = `Update failed: ${error?.message || error}`;
        settingsMessage.className = 'error-message';
    }
}

// --- Placeholder Clock Functions ---
// [1.vp] updateWorkdeskDateTime
function updateWorkdeskDateTime() {}
// [1.vq] updateDashboardDateTime
function updateDashboardDateTime() {}
// [1.vr] updateIMDateTime
function updateIMDateTime() {}

// ==========================================================================
// 7. WORKDESK LOGIC: DASHBOARD & CALENDAR
// ==========================================================================

// --- Helper: Check Task Completion ---
// [1.vs] isTaskComplete
function isTaskComplete(task) {
    if (!task) return false;

    if (task.source === 'job_entry' && task.for === 'Invoice') {
        return !!task.dateResponded;
    }

    // [1.vt] completedStatuses
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
            // [1.vu] trackingStatuses
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
    // [1.vv] activeCountEl
    const activeCountEl = document.getElementById('db-active-tasks-count');
    if (activeCountEl) {
        activeCountEl.textContent = userActiveTasks.length;
    }

    // 2. Populate the admin's "all tasks" list
    await populateAdminCalendarTasks();

    // 3. Populate completed tasks count
    await ensureAllEntriesFetched();

    // [1.vw] completedJobTasks
    let completedJobTasks = allSystemEntries.filter(task =>
        (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name) && isTaskComplete(task)
    );

    // [1.vx] completedInvoiceTasks
    let completedInvoiceTasks = [];
    // [1.vy] isAccounting
    const isAccounting = (currentApprover.Position || '').toLowerCase() === 'accounting';

    await ensureInvoiceDataFetched();

    if (allInvoiceData) {
        for (const poNumber in allInvoiceData) {
            // [1.vz] poInvoices
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                // [1.wa] inv
                const inv = poInvoices[invoiceKey];
                // [1.wb] invoiceTask
                const invoiceTask = {
                    key: `${poNumber}_${invoiceKey}`,
                    source: 'invoice',
                    remarks: inv.status,
                    enteredBy: isAccounting ? currentApprover.Name : 'Irwin'
                };

                // [1.wc] shouldInclude
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

    // [1.wd] totalCompleted
    const totalCompleted = completedJobTasks.length + completedInvoiceTasks.length;

    // SAFEGUARD: Only update count if element exists
    // [1.we] completedCountEl
    const completedCountEl = document.getElementById('db-completed-tasks-count');
    if (completedCountEl) {
        completedCountEl.textContent = totalCompleted;
    }
}

// --- Calendar Logic (Month, Year, Day Views) ---

// [1.wf] renderWorkdeskCalendar
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

    // [1.wg] year
    const year = wdCurrentCalendarDate.getFullYear();
    // [1.wh] month
    const month = wdCurrentCalendarDate.getMonth();
    // [1.wi] firstDay
    const firstDay = new Date(year, month, 1).getDay();
    // [1.wj] daysInMonth
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        // [1.wk] blankDay
        const blankDay = document.createElement('div');
        blankDay.className = 'wd-calendar-day other-month';
        wdCalendarGrid.appendChild(blankDay);
    }

    // [1.wl] today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        // [1.wm] dayCell
        const dayCell = document.createElement('div');
        dayCell.className = 'wd-calendar-day';
        dayCell.textContent = day;

        // [1.wn] thisDate
        const thisDate = new Date(year, month, day);
        thisDate.setHours(0, 0, 0, 0);

        // [1.wo] dateYear
        const dateYear = thisDate.getFullYear();
        // [1.wp] dateMonth
        const dateMonth = String(thisDate.getMonth() + 1).padStart(2, '0');
        // [1.wq] dateDay
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
    // [1.wr] allTasks
    let allTasks = [];

    // 1. Get all active JOB_ENTRIES
    await ensureAllEntriesFetched();
    // [1.ws] activeJobTasks
    const activeJobTasks = allSystemEntries.filter(entry => !isTaskComplete(entry));
    allTasks = allTasks.concat(activeJobTasks);

    // 2. Get all active INVOICE_ENTRIES
    await ensureInvoiceDataFetched();
    // [1.wt] unassignedStatuses
    const unassignedStatuses = ['Pending', 'Report', 'Original PO'];

    if (allInvoiceData && allPOData) {
        for (const poNumber in allInvoiceData) {
            // [1.wu] poInvoices
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                // [1.wv] inv
                const inv = poInvoices[invoiceKey];
                // [1.ww] isAssignedActive
                const isAssignedActive = isInvoiceTaskActive(inv);
                // [1.wx] isUnassignedActive
                const isUnassignedActive = unassignedStatuses.includes(inv.status) && (!inv.attention || inv.attention === '');

                if (isAssignedActive || isUnassignedActive) {
                    // [1.wy] poDetails
                    const poDetails = allPOData[poNumber] || {};
                    // [1.wz] transformedInvoice
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

    // [1.xa] isAdmin
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    // [1.xb] tasks
    let tasks = [];
    // [1.xc] myTaskKeys
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key));

    if (isAdmin) {
        tasks = allAdminCalendarTasks;
    } else {
        tasks = userActiveTasks;
    }

    // [1.xd] tasksByDate
    const tasksByDate = new Map();
    tasks.forEach(task => {
        // [1.xe] taskDateStr
        let taskDateStr = task.calendarDate || task.date;
        if (taskDateStr) {
            // [1.xf] inputDate
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
        // [1.xg] date
        const date = dayCell.dataset.date;
        // [1.xh] oldBadge
        const oldBadge = dayCell.querySelector('.task-count-badge');
        if (oldBadge) oldBadge.remove();

        if (tasksByDate.has(date)) {
            // [1.xi] tasksForDay
            const tasksForDay = tasksByDate.get(date);
            // [1.xj] count
            const count = tasksForDay.length;

            if (count > 0) {
                // [1.xk] badge
                const badge = document.createElement('span');
                badge.className = 'task-count-badge';
                badge.textContent = count;

                // [1.xl] badgeColorSet
                let badgeColorSet = false;
                if (isAdmin) {
                    // [1.xm] hasMyTask
                    const hasMyTask = tasksForDay.some(task => myTaskKeys.has(task.key));
                    if (!hasMyTask) {
                        badge.classList.add('admin-view-only');
                        badgeColorSet = true;
                    }
                }
                if (!badgeColorSet) {
                    // [1.xn] allPendingSignature
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

// [1.xo] renderYearView
function renderYearView() {
    if (!wdCalendarYearGrid) return;

    // [1.xp] isAdmin
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    // [1.xq] year
    const year = wdCurrentCalendarDate.getFullYear();
    // [1.xr] taskSource
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    // [1.xs] myTaskKeys
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key));

    // [1.xt] tasksByMonth
    const tasksByMonth = new Map();
    for (let i = 0; i < 12; i++) {
        tasksByMonth.set(i, []);
    }

    taskSource.forEach(task => {
        // [1.xu] taskDateStr
        const taskDateStr = task.calendarDate || task.date;
        if (!taskDateStr) return;

        // [1.xv] taskDate
        const taskDate = new Date(convertDisplayDateToInput(taskDateStr) + 'T00:00:00');
        if (taskDate.getFullYear() === year) {
            // [1.xw] monthIndex
            const monthIndex = taskDate.getMonth();
            tasksByMonth.get(monthIndex).push(task);
        }
    });

    wdCalendarYearGrid.innerHTML = '';
    // [1.xx] monthNames
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
        // [1.xy] monthCell
        const monthCell = document.createElement('div');
        monthCell.className = 'wd-calendar-month-cell';
        monthCell.textContent = monthNames[i];
        monthCell.dataset.month = i;

        // [1.xz] tasksForThisMonth
        const tasksForThisMonth = tasksByMonth.get(i);
        // [1.ya] taskCount
        const taskCount = tasksForThisMonth.length;

        if (taskCount > 0) {
            monthCell.classList.add('has-tasks');
            // [1.yb] badge
            const badge = document.createElement('span');
            badge.className = 'month-task-count';
            badge.textContent = taskCount;

            // [1.yc] badgeColorSet
            let badgeColorSet = false;
            if (isAdmin) {
                // [1.yd] hasMyTask
                const hasMyTask = tasksForThisMonth.some(task => myTaskKeys.has(task.key));
                if (!hasMyTask) {
                    monthCell.classList.add('admin-view-only');
                    badge.classList.add('admin-view-only');
                    badgeColorSet = true;
                }
            }
            if (!badgeColorSet) {
                // [1.ye] allPendingSignature
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

// [1.yf] toggleCalendarView
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

// [1.yg] displayCalendarTasksForDay
function displayCalendarTasksForDay(date) {
    document.querySelectorAll('.wd-calendar-day.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    // [1.yh] selectedCell
    const selectedCell = document.querySelector(`.wd-calendar-day[data-date="${date}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }

    // [1.yi] isAdmin
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    // [1.yj] taskSource
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;

    // [1.yk] tasks
    const tasks = taskSource.filter(task => {
        // [1.yl] taskDate
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date);
        return taskDate === date;
    });

    // [1.ym] friendlyDate
    const friendlyDate = formatYYYYMMDD(date);

    if (tasks.length > 0) {
        wdCalendarTaskListTitle.textContent = `Task Details for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';

        tasks.forEach(task => {
            // [1.yn] li
            const li = document.createElement('li');

            // [1.yo] statusClass
            let statusClass = '';
            // [1.yp] status
            const status = task.remarks || 'Pending';
            if (status === 'Pending Signature') statusClass = 'status-pending-signature';
            if (status === 'For SRV') statusClass = 'status-for-srv';
            li.className = statusClass;

            // [1.yq] mainInfo
            const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
            // [1.yr] subInfo
            const subInfo = task.vendorName ? task.vendorName : `(Ref: ${task.ref || 'N/A'})`;

            // [1.ys] amountDisplay
            const amountDisplay = (task.amount && parseFloat(task.amount) > 0) ?
                ` - QAR ${formatCurrency(task.amount)}` :
                ``;

            if (task.po) {
                li.dataset.po = task.po;
                li.classList.add('clickable-task');
                li.title = `PO: ${task.po}\nDouble-click to search in IM Reporting`;
            }

            // [1.yt] noteHTML
            const noteHTML = task.note ?
                `<span style="color: var(--iba-secondary-terracotta); font-style: italic; margin-top: 4px;">Note: ${task.note}</span>` :
                '';

            // [1.yu] jobTypeHTML
            const jobTypeHTML = task.for ?
                `<span style="font-weight: 600; margin-top: 4px;">Job: ${task.for}</span>` :
                '';

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

// [1.yv] showDayView
function showDayView(date) {
    try {
        // [1.yw] parts
        const parts = date.split('-').map(Number);
        wdCurrentDayViewDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } catch (e) {
        console.error("Invalid date passed to showDayView:", date, e);
        return;
    }

    workdeskSections.forEach(section => {
        section.classList.add('hidden');
    });
    // [1.yx] dayViewSection
    const dayViewSection = document.getElementById('wd-dayview');
    dayViewSection.classList.remove('hidden');

    // [1.yy] friendlyDate
    const friendlyDate = formatYYYYMMDD(date);
    document.getElementById('wd-dayview-title').textContent = `Tasks for ${friendlyDate}`;
    // [1.yz] mobileSubtitle
    const mobileSubtitle = document.getElementById('wd-dayview-mobile-date-subtitle');
    if (mobileSubtitle) {
        // [1.za] todayStr
        const todayStr = getTodayDateString();
        if (date === todayStr) {
            mobileSubtitle.textContent = 'Today';
        } else {
            // [1.zb] subtitleDate
            const subtitleDate = new Date(date + 'T00:00:00');
            mobileSubtitle.textContent = subtitleDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    }
    generateDateScroller(date);

    // [1.zc] isAdmin
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    // [1.zd] isCEO
    const isCEO = document.body.classList.contains('is-ceo');
    // [1.ze] taskSource
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;

    // [1.zf] tasks
    const tasks = taskSource.filter(task => {
        // [1.zg] taskDate
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date);
        return taskDate === date;
    });

    // [1.zh] taskListDiv
    const taskListDiv = document.getElementById('wd-dayview-task-list');
    taskListDiv.innerHTML = '';

    if (tasks.length === 0) {
        taskListDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #555;">No tasks found for this day.</p>';
        return;
    }

    // [1.zi] myTaskKeys
    const myTaskKeys = new Set(userActiveTasks.map(t => t.key));

    tasks.forEach(task => {
        // [1.zj] card
        const card = document.createElement('div');
        card.className = 'dayview-task-card';

        card.dataset.key = task.key;
        if (isCEO) {
            card.classList.add('ceo-clickable-day-card');
        }

        // [1.zk] borderColor
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

        // [1.zl] mainInfo
        const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
        // [1.zm] amountDisplay
        const amountDisplay = (task.amount && parseFloat(task.amount) > 0) ?
            ` - QAR ${formatCurrency(task.amount)}` :
            ``;

        // [1.zn] noteHTML
        const noteHTML = task.note ?
            `<div class="task-detail-item note"><span class="label">Note:</span> ${task.note}</div>` :
            '';

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

// [1.zo] generateDateScroller
function generateDateScroller(selectedDate) {
    // [1.zp] scrollerInner
    const scrollerInner = document.getElementById('wd-dayview-date-scroller-inner');
    if (!scrollerInner) return;

    // [1.zq] days
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    // [1.zr] html
    let html = '';

    // [1.zs] parts
    const parts = selectedDate.split('-').map(Number);
    // [1.zt] centerDate
    const centerDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    for (let i = -3; i <= 3; i++) {
        // [1.zu] currentDate
        const currentDate = new Date(centerDate);
        currentDate.setUTCDate(centerDate.getUTCDate() + i);

        // [1.zv] dayNum
        const dayNum = String(currentDate.getUTCDate()).padStart(2, '0');
        // [1.zw] dayInitial
        const dayInitial = days[currentDate.getUTCDay()];

        // [1.zx] year
        const year = currentDate.getUTCFullYear();
        // [1.zy] month
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        // [1.zz] dateStr
        const dateStr = `${year}-${month}-${dayNum}`;

        // [1.aaa] isActive
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
        // [1.aab] activeItem
        const activeItem = scrollerInner.querySelector('.day-scroller-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest'
            });
        }
    }, 100);
}

// ==========================================================================
// FIX: Clean Excel Download (Removes Buttons before saving)
// ==========================================================================
// [1.aac] handleDownloadWorkdeskCSV
function handleDownloadWorkdeskCSV() {
    // [1.aad] originalTable
    const originalTable = document.querySelector("#reporting-printable-area table");
    if (!originalTable) {
        alert("Report table not found.");
        return;
    }

    // 1. Clone the table so we don't mess up the actual screen
    // [1.aae] tableClone
    const tableClone = originalTable.cloneNode(true);

    // 2. REMOVE ALL BUTTONS & ICONS FROM THE CLONE
    // This strips out the "Print", "History", "Del" text
    // [1.aaf] junk
    const junk = tableClone.querySelectorAll('button, .action-btn, .waybill-btn, .history-btn, .delete-btn, i');
    junk.forEach(el => el.remove());

    // 3. Generate CSV from the CLEAN clone
    // [1.aag] csv
    let csv = [];
    // [1.aah] rows
    const rows = tableClone.querySelectorAll("tr");

    for (let i = 0; i < rows.length; i++) {
        // [1.aai] row
        const row = [],
            cols = rows[i].querySelectorAll("td, th");

        for (let j = 0; j < cols.length; j++) {
            // Clean up extra whitespace left behind by removed buttons
            // .trim() removes spaces from start/end
            // [1.aaj] cleanText
            let cleanText = cols[j].innerText.replace(/\s+/g, ' ').trim();

            // Escape double quotes for CSV format
            row.push('"' + cleanText.replace(/"/g, '""') + '"');
        }
        csv.push(row.join(","));
    }

    // [1.aak] csvContent
    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    // [1.aal] encodedUri
    const encodedUri = encodeURI(csvContent);
    // [1.aam] link
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
// [1.aan] renderReportingTable
function renderReportingTable(entries) {
    reportingTableBody.innerHTML = '';

    // --- FIX: Added 'Usage' to this list ---
    // [1.aao] inventoryTypes
    const inventoryTypes = ['Transfer', 'Restock', 'Return', 'Usage'];
    // ---------------------------------------

    // [1.aap] tableHead
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

    // [1.aaq] count
    const count = entries.length;
    if (document.getElementById('job-records-count-display')) {
        document.getElementById('job-records-count-display').textContent = `(Total Records: ${count})`;
    }

    if (!entries || count === 0) {
        reportingTableBody.innerHTML = '<tr><td colspan="11">No entries found.</td></tr>';
        return;
    }

    // [1.aar] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';

    entries.forEach(entry => {
        // [1.aas] row
        const row = document.createElement('tr');
        row.setAttribute('data-key', entry.key);

        // CHECK: If this SPECIFIC ROW is one of these, render Inventory Columns
        if (inventoryTypes.includes(entry.for)) {

            // [1.aat] statusColor
            let statusColor = 'black';
            if (entry.remarks === 'Approved') statusColor = '#28a745';
            if (entry.remarks === 'Pending') statusColor = '#dc3545';
            if (entry.remarks === 'Rejected') statusColor = 'red';
            if (entry.remarks === 'Completed') statusColor = '#003A5C';

            // [1.aau] noteDisplay
            const noteDisplay = entry.note ? `<br><small style="color:#666; font-style:italic;">${entry.note}</small>` : '';

            // [1.aav] actions
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
            // Standard Row (IPC, PR, Invoice, etc.)
            const status = entry.remarks || 'Pending';

            // --- NEW: Action Buttons (History) ---
            let actions = '';

            // Add History Button for PR and IPC (or all)
            // We verify if it's not a Transfer (already handled above)
            actions += `<button class="history-btn action-btn" onclick="event.stopPropagation(); showJobHistory('${entry.key}')" style="padding:2px 6px; font-size:0.7rem; background:#17a2b8; color:white; border:none; border-radius:4px;" title="View History"><i class="fa-solid fa-clock-rotate-left"></i></button>`;

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
                <td>
                    ${status}
                    <div style="margin-top:5px;">${actions}</div>
                </td>
            `;
        }
        reportingTableBody.appendChild(row);
    });
}
// [1.aax] filterAndRenderReport
function filterAndRenderReport(baseEntries = []) {
    // [1.aay] filteredEntries
    let filteredEntries = [...baseEntries];

    // 1. Filter by Tab (Job Type)
    if (currentReportFilter !== 'All') {
        filteredEntries = filteredEntries.filter(entry => (entry.for || 'Other') === currentReportFilter);
    }

    // 2. Filter by Search Text
    // [1.aaz] searchText
    const searchText = reportingSearchInput.value.toLowerCase();
    sessionStorage.setItem('reportingSearch', searchText);

    if (searchText) {
        filteredEntries = filteredEntries.filter(entry => {
            // Safe helper to check if a value contains the search text
            // [1.aba] check
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
        // [1.abb] uniqueJobTypes
        const uniqueJobTypes = [...new Set(allSystemEntries.map(entry => entry.for || 'Other'))];
        uniqueJobTypes.sort();

        // [1.abc] tabsHTML
        let tabsHTML = '';

        if (uniqueJobTypes.length > 0) {
            if (currentReportFilter === 'All' || !uniqueJobTypes.includes(currentReportFilter)) {
                currentReportFilter = uniqueJobTypes[0];
            }
        }

        uniqueJobTypes.forEach(jobType => {
            // [1.abd] activeClass
            const activeClass = (jobType === currentReportFilter) ? 'active' : '';
            tabsHTML += `<button class="${activeClass}" data-job-type="${jobType}">${jobType}</button>`;
        });

        // [1.abe] tabsContainer
        const tabsContainer = document.getElementById('report-tabs');
        if (tabsContainer) tabsContainer.innerHTML = tabsHTML;

        // 5. Render
        filterAndRenderReport(allSystemEntries);

    } catch (error) {
        console.error("Error loading reporting:", error);
        reportingTableBody.innerHTML = '<tr><td colspan="11">Error loading data.</td></tr>';
    }
}

// ==========================================================================
// UPDATED FUNCTION: populateActiveTasks (Fixes "Amount To Paid" value)
// ==========================================================================
// [1.abk] populateActiveTasks (FIXED: Prioritizes amountPaid)
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

        // 1. Load Data
        await ensureAllEntriesFetched();
        await ensureApproverDataCached();
        await ensureInvoiceDataFetched(false); // Need full data for lookup fallback

        if (typeof reconcilePendingPRs === 'function') {
            await reconcilePendingPRs();
        }

        // --- A. Job Entries (Standard) ---
        const jobTasks = allSystemEntries.filter(entry => {
            if (isTaskComplete(entry)) return false;
            if (['Transfer', 'Restock', 'Return', 'Usage'].includes(entry.for)) {
                if (entry.remarks === 'Pending Confirmation') return entry.requestor === currentUserName;
                if (entry.remarks === 'Pending Source') return entry.sourceContact === currentUserName;
                if (entry.remarks === 'Pending Admin' || entry.remarks === 'Pending') return entry.approver === currentUserName;
                if (entry.remarks === 'Approved' || entry.remarks === 'In Transit') return entry.receiver === currentUserName;
                return entry.attention === currentUserName;
            }
            if (entry.for === 'Invoice') return isAccounting;
            if (entry.for === 'PR') {
                if (isProcurement) return true;
                if (entry.attention === currentUserName) return true;
                return false;
            }
            if (entry.for === 'IPC') return isQS && entry.attention === currentUserName;
            return entry.attention === currentUserName;
        });

        userTasks = jobTasks.map(task => {
            if (['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) {
                return {
                    ...task,
                    source: 'transfer_entry'
                };
            }
            return {
                ...task,
                source: 'job_entry'
            };
        });

        // --- B. Invoice Tasks (The Fix) ---
        const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
        const safeCurrentUserName = sanitizeFirebaseKey(currentUserName);
        const invoiceTaskSnapshot = await invoiceDb.ref(`invoice_tasks_by_user/${safeCurrentUserName}`).once('value');

        if (invoiceTaskSnapshot.exists()) {
            const tasksData = invoiceTaskSnapshot.val();
            for (const invoiceKey in tasksData) {
                const task = tasksData[invoiceKey];
                pulledInvoiceKeys.add(invoiceKey);

                // FIX: Try to get amountPaid from task, otherwise lookup from full data
                let realAmountPaid = task.amountPaid;
                if (!realAmountPaid && allInvoiceData && allInvoiceData[task.po] && allInvoiceData[task.po][invoiceKey]) {
                    realAmountPaid = allInvoiceData[task.po][invoiceKey].amountPaid;
                }

                const transformedInvoice = {
                    key: `${task.po}_${invoiceKey}`,
                    originalKey: invoiceKey,
                    originalPO: task.po,
                    source: 'invoice',
                    for: 'Invoice',
                    ref: task.ref,
                    po: task.po,

                    // Pass correct values
                    amount: task.amount,
                    amountPaid: realAmountPaid || task.amount, // Fallback to total if no payment amount

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

        // --- C. Accounting View ---
        if (isAccounting) {
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

                                // Fix for Accounting View too
                                amount: inv.invValue || '',
                                amountPaid: inv.amountPaid || inv.invValue || '',

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

        // Tab Logic
        const tabCounts = {};
        userActiveTasks.forEach(task => {
            let key = '';
            if (['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) {
                key = task.for;
            } else {
                key = task.remarks || 'Pending';
            }
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
                if (tabName === 'Transfer') badgeColor = '#00748C';
                if (tabName === 'Restock') badgeColor = '#28a745';
                if (tabName === 'Return') badgeColor = '#ffc107';
                if (tabName === 'Usage') badgeColor = '#6f42c1';

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

// [1.acf] handleActiveTaskSearch
function handleActiveTaskSearch(searchTerm) {
    // [1.acg] searchText
    const searchText = searchTerm.toLowerCase();
    sessionStorage.setItem('activeTaskSearch', searchText);

    // [1.ach] searchedTasks
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
// AUTO-RECONCILE PR JOBS (Universal Date Fixer)
// ==========================================================================
async function reconcilePendingPRs() {
    // 1. Safety Checks
    if (!allSystemEntries || allSystemEntries.length === 0) return;

    if (!allPODataByRef) {
        console.log("CSV Data missing, attempting auto-load...");
        await ensureInvoiceDataFetched(false);
        if (!allPODataByRef) return;
    }

    // [1.aci] updates
    const updates = {};
    // [1.acj] updateCount
    let updateCount = 0;

    // 2. Scan Job Entries
    allSystemEntries.forEach(entry => {
        if (entry.source === 'job_entry' &&
            entry.for === 'PR' &&
            entry.remarks !== 'PO Ready' &&
            entry.ref) {

            // [1.ack] refKey
            const refKey = String(entry.ref).trim();
            // [1.acl] matchedPO
            const matchedPO = allPODataByRef[refKey] || allPODataByRef[refKey.toUpperCase()];

            if (matchedPO) {
                console.log(`>> MATCHED PR: ${refKey}`, matchedPO);

                // --- A. GET DATA ---
                // [1.acm] getVal
                const getVal = (keyPart) => {
                    // [1.acn] exactKey
                    const exactKey = Object.keys(matchedPO).find(k => k.toLowerCase().includes(keyPart.toLowerCase()));
                    return exactKey ? matchedPO[exactKey] : '';
                };

                // [1.aco] poNum
                const poNum = getVal('PO') || '';
                // [1.acp] supplier
                const supplier = getVal('Supplier') || 'N/A';
                // [1.acq] amount
                let amount = String(getVal('Amount') || '0').replace(/,/g, '');
                // [1.acr] entryPerson
                const entryPerson = getVal('Entry Person') || getVal('Buyer') || 'Records';

                // --- B. "ABSOLUTE" DATE FIXER ---
                // This handles: 18-11-19, 18/11/2019, 18.11.19, etc.
                // [1.acs] rawDate
                let rawDate = getVal('Order Date');
                // [1.act] finalDate
                let finalDate = '';

                if (rawDate) {
                    // [1.acu] cleanDate
                    const cleanDate = rawDate.trim();

                    // Split by ANY separator (Hyphen, Slash, Dot, Space)
                    // [1.acv] parts
                    const parts = cleanDate.split(/[\/\-\.\s]+/);

                    if (parts.length === 3) {
                        // Assume Standard International Format: Day - Month - Year
                        // [1.acw] d
                        let d = parts[0];
                        // [1.acx] m
                        let m = parts[1];
                        // [1.acy] y
                        let y = parts[2];

                        // Fix Year: If 2 digits (e.g. "19" or "25"), make it "2019" or "2025"
                        if (y.length === 2) y = "20" + y;

                        // Fix Day/Month: Ensure they are 2 digits (e.g. "1" -> "01")
                        d = d.padStart(2, '0');
                        m = m.padStart(2, '0');

                        // Create ISO String (YYYY-MM-DD) which formatYYYYMMDD understands
                        // [1.acz] isoDate
                        const isoDate = `${y}-${m}-${d}`;

                        // Convert to System Format: "18-Nov-2019"
                        finalDate = formatYYYYMMDD(isoDate);
                    } else {
                        // Fallback: Let the browser guess
                        finalDate = formatYYYYMMDD(normalizeDateForInput(cleanDate));
                    }
                }

                // Fallback if empty: Use Today
                if (!finalDate || finalDate === 'N/A') {
                    finalDate = formatDate(new Date());
                }

                // --- C. UPDATE ---
                // [1.ada] key
                const key = entry.key;
                updates[`job_entries/${key}/po`] = poNum;
                updates[`job_entries/${key}/vendorName`] = supplier;
                updates[`job_entries/${key}/amount`] = amount;
                updates[`job_entries/${key}/attention`] = entryPerson;
                updates[`job_entries/${key}/dateResponded`] = finalDate;
                updates[`job_entries/${key}/remarks`] = 'PO Ready';

                // --- D. UPDATE DISPLAY ---
                entry.po = poNum;
                entry.vendorName = supplier;
                entry.amount = amount;
                entry.attention = entryPerson;
                entry.dateResponded = finalDate;
                entry.remarks = 'PO Ready';

                updateCount++;
            }
        }
    });

    if (updateCount > 0) {
        console.log(`Auto-Reconcile: Updating ${updateCount} PRs...`);
        try {
            await db.ref().update(updates);
            if (document.getElementById('wd-activetask') && !document.getElementById('wd-activetask').classList.contains('hidden')) {
                populateActiveTasks();
            }
        } catch (e) {
            console.error("Error committing PR updates:", e);
        }
    }
}


// ==========================================================================
// UPDATED FUNCTION: renderActiveTaskTable (Shows Adjusted/Approved Qty)
// ==========================================================================
// [1.adb] renderActiveTaskTable
function renderActiveTaskTable(tasks) {
    // [1.adc] isMobile
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        if (typeof renderMobileActiveTasks === 'function') renderMobileActiveTasks(tasks);
        return;
    }

    activeTaskTableBody.innerHTML = '';

    // Filter by Hybrid Tabs
    // [1.add] filteredTasks
    let filteredTasks = tasks.filter(task => {
        // [1.ade] specialTypes
        const specialTypes = ['Transfer', 'Restock', 'Return', 'Usage'];
        // [1.adf] isSpecialTab
        const isSpecialTab = specialTypes.includes(currentActiveTaskFilter);
        // [1.adg] taskIsSpecial
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
    // [1.adh] isTransferView
    const isTransferView = filteredTasks.length > 0 && ['Transfer', 'Restock', 'Return', 'Usage'].includes(filteredTasks[0].for);
    // [1.adi] tableHead
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

    // [1.adj] isCEO
    const isCEO = document.body.classList.contains('is-ceo');
    // [1.adk] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';

    filteredTasks.forEach(task => {
        // [1.adl] row
        const row = document.createElement('tr');
        row.setAttribute('data-key', task.key);

        if (isTransferView) {
            // --- TRANSFER / USAGE ROW ---
            // [1.adm] actionButtons
            let actionButtons = `<button class="transfer-action-btn" data-key="${task.key}" style="background-color: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">Action</button>`;

            if (isAdmin) {
                actionButtons += `<button class="delete-btn transfer-delete-btn" data-key="${task.key}" style="margin-left: 5px; padding: 6px 12px;">Delete</button>`;
            }

            // [1.adn] fromLoc
            const fromLoc = task.fromSite || task.fromLocation || 'N/A';
            // [1.ado] toLoc
            const toLoc = task.toSite || task.toLocation || 'N/A';

            // [1.adp] movement
            let movement = `${fromLoc} <i class="fa-solid fa-arrow-right" style="color: #888; font-size: 0.8rem;"></i> ${toLoc}`;
            if (task.for === 'Usage') {
                movement = `<span style="color: #6f42c1;">Consumed at ${fromLoc}</span>`;
            }

            // *** FIX: SMART QUANTITY DISPLAY ***
            // 1. Default to what was ordered/requested
            // [1.adq] displayQty
            let displayQty = task.orderedQty || task.requiredQty || 0;
            // [1.adr] qtyLabel
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

            // [1.ads] statusColor
            let statusColor = '#333';
            if (task.remarks === 'Pending') statusColor = '#dc3545';
            if (task.remarks === 'Pending Admin') statusColor = '#dc3545';
            if (task.remarks === 'Approved') statusColor = '#28a745';
            if (task.remarks === 'Completed') statusColor = '#003A5C';

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

            // FIX: Use 'Amount To Paid' for Desktop Display
            // This matches the Mobile Card logic
            const displayAmount = task.amountPaid || task.amount || 0;

            row.innerHTML = `
                <td class="desktop-only">${task.for || ''}</td>
                <td class="desktop-only">${task.ref || ''}</td>
                <td class="desktop-only">${task.po || ''}</td>
                <td class="desktop-only">${task.vendorName || 'N/A'}</td>
                <td class="desktop-only">${formatCurrency(displayAmount)}</td>
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

// [FIXED] renderMobileActiveTasks (Restores CEO Receipt + Smart Qty)
function renderMobileActiveTasks(tasks) {
    const container = document.getElementById('active-task-mobile-view');
    const receiptContainer = document.getElementById('mobile-receipt-action-container');
    
    if (container) container.innerHTML = '';

    // 1. User Roles
    const isCEO = (currentApprover.Role || '').toLowerCase() === 'admin' && (currentApprover.Position || '').toLowerCase() === 'ceo';
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const currentUser = currentApprover.Name;

    // 2. [RESTORED] BUTTON VISIBILITY LOGIC
    // This was missing in the previous fix. It checks if we need to show ANY receipt button.
    if (receiptContainer) {
        // Check if lists have items
        const showCeoBtn = isCEO && (typeof ceoProcessedTasks !== 'undefined' && ceoProcessedTasks.length > 0);
        const showMgrBtn = isAdmin && (typeof managerProcessedTasks !== 'undefined' && managerProcessedTasks.length > 0);
        // We keep Transfer check here, but since we stopped pushing to the list, it won't show.
        const showTrfBtn = (typeof transferProcessedTasks !== 'undefined' && transferProcessedTasks.length > 0);

        // Show/Hide Main Container
        if (showCeoBtn || showMgrBtn || showTrfBtn) {
            receiptContainer.classList.remove('hidden');
        } else {
            receiptContainer.classList.add('hidden');
        }

        // Toggle Individual Buttons
        const btnCeo = document.getElementById('mobile-send-receipt-btn');
        if(btnCeo) btnCeo.classList.toggle('hidden', !showCeoBtn);

        const btnMgr = document.getElementById('mobile-send-manager-receipt-btn');
        if(btnMgr) btnMgr.classList.toggle('hidden', !showMgrBtn);

        const btnTrf = document.getElementById('mobile-send-transfer-receipt-btn');
        if(btnTrf) btnTrf.classList.toggle('hidden', !showTrfBtn);
    }

    // 3. Filter Logic (Restored)
    let filteredTasks = tasks;
    if (currentActiveTaskFilter !== 'All') {
        if (currentActiveTaskFilter === 'Other') {
            filteredTasks = tasks.filter(task => task.remarks !== 'For SRV' && task.remarks !== 'Pending Signature');
        } else {
            filteredTasks = tasks.filter(task => {
                if(['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) return task.for === currentActiveTaskFilter;
                return task.remarks === currentActiveTaskFilter;
            });
        }
    }

    // 4. Empty State
    if (!filteredTasks || filteredTasks.length === 0) {
        container.innerHTML = '<div class="im-mobile-empty-state"><p>No active tasks found.</p></div>';
        return;
    }

    // 5. Render Cards
    filteredTasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'mobile-task-card';
        let html = '';

        // --- A. INVENTORY CARD ---
        if (['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) {
            let canApprove = false;
            let statusMessage = "";

            // Smart Quantity Logic
            let displayQty = parseFloat(task.orderedQty) || 0;
            let qtyLabel = "Qty";

            if (task.approvedQty !== undefined && task.approvedQty !== null) {
                displayQty = parseFloat(task.approvedQty);
                if (displayQty != task.orderedQty) qtyLabel = "Qty (Adj)";
            }
            if (task.receivedQty !== undefined && task.receivedQty !== null) {
                displayQty = parseFloat(task.receivedQty);
            }

            // Permission Logic
            if (task.remarks === 'Pending Source' && task.sourceContact === currentUser) {
                statusMessage = "<i class='fa-solid fa-desktop'></i> Action Required on Desktop (Source)";
            }
            else if ((task.remarks === 'Pending Admin' || task.remarks === 'Pending') && (task.approver === currentUser || isAdmin)) {
                canApprove = true;
            }
            else if ((task.remarks === 'In Transit' || task.remarks === 'Approved') && task.receiver === currentUser) {
                 statusMessage = "<i class='fa-solid fa-desktop'></i> Action Required on Desktop (Receiver)";
            }
            else if (task.remarks === 'Pending Confirmation' && task.requestor === currentUser) {
                 statusMessage = "<i class='fa-solid fa-desktop'></i> Action Required on Desktop (Requestor)";
            }
            else {
                statusMessage = `<i class='fa-solid fa-clock'></i> Waiting for other party`;
            }

            html += `
            <div class="mobile-card-header" style="border-left: 5px solid #17a2b8;">
                <div class="m-card-main">
                    <h3>${task.productName || 'Unknown Item'}</h3>
                    <div class="m-card-sub">
                        <span style="background:#e3f2fd; color:#00748C; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${task.for.toUpperCase()}</span>
                        <span style="margin-left:5px; color:#555;">${task.controlNumber || task.ref}</span>
                    </div>
                    <div class="m-card-sub" style="margin-top:4px;">${task.site || task.fromSite || ''}</div>
                </div>
                <div class="m-card-amount" style="text-align:right;">
                    <span class="m-card-val" style="color:#17a2b8; font-size:1.4rem;">${displayQty}</span>
                    <span class="m-card-ref" style="font-size:0.7rem; color:#999;">${qtyLabel}</span>
                </div>
            </div>
            <div class="mobile-card-body">
                <div class="m-action-group">
                     <p style="font-size: 0.9rem; color: #333; margin-bottom:5px;"><strong>Status:</strong> <span style="color:#C3502F;">${task.remarks}</span></p>
                     <p style="font-size: 0.9rem; color: #555;"><strong>Details:</strong> ${task.details || 'N/A'}</p>
                </div>
            `;

            if (canApprove) {
                html += `
                <div class="m-btn-row" style="margin-top:15px;">
                    <button class="m-btn-approve trf-mobile-action" data-action="Approved" style="background-color: #17a2b8; width:100%; padding:12px; border-radius:8px; border:none; color:white; font-weight:bold;">
                        <i class="fa-solid fa-check"></i> Confirm / Approve
                    </button>
                    <button class="m-btn-reject trf-mobile-action" data-action="Rejected" style="background-color: #dc3545; width:100%; padding:12px; border-radius:8px; border:none; color:white; font-weight:bold;">
                        <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                </div>`;
            } else {
                 html += `<div style="text-align:center; padding:12px; color:#777; background:#f0f0f0; border-radius:8px; margin-top:10px; font-size:0.85rem; font-weight:500;">${statusMessage}</div>`;
            }
            html += `</div>`; 

        } else {
            // --- B. STANDARD INVOICE CARD (Unchanged) ---
            const invName = task.invName || '';
            const pdfLink = (task.source === 'invoice' && invName.trim() && invName.toLowerCase() !== 'nil') 
                ? `${PDF_BASE_PATH}${encodeURIComponent(invName)}.pdf` : null;
            const isManagerTask = isAdmin && task.remarks === 'For Approval';
            const displayAmount = task.amountPaid || task.amount || '';

            html += `
            <div class="mobile-card-header">
                <div class="m-card-main">
                    <h3>${task.vendorName || 'Unknown Vendor'}</h3>
                    <div class="m-card-sub">${task.po || task.ref}</div>
                    <div class="m-card-sub" style="color: #C3502F; font-weight: bold;">${task.remarks}</div>
                </div>
                <div class="m-card-amount">
                    <span class="m-card-val">${displayAmount}</span>
                    <span class="m-card-ref">QAR</span>
                </div>
            </div>
            <div class="mobile-card-body">`;
            
            if (pdfLink) html += `<a href="${pdfLink}" target="_blank" class="m-pdf-btn"><i class="fa-regular fa-file-pdf"></i> View Invoice PDF</a>`;
            
            html += `
                <div class="m-action-group">
                    <label>Amount to Paid</label>
                    <input type="number" class="m-input-amount" value="${displayAmount}" step="0.01" ${(!isCEO && !isManagerTask) ? 'readonly' : ''}>
                </div>
                <div class="m-action-group">
                    <label>Note / Remark</label>
                    <textarea class="m-input-note" rows="2" ${(!isCEO && !isManagerTask) ? 'readonly' : ''}>${task.note || ''}</textarea>
                </div>
            `;
            if (isCEO && !isManagerTask) {
                html += `<div class="m-btn-row"><button class="m-btn-approve ceo-action" data-action="Approved">Approve</button><button class="m-btn-reject ceo-action" data-action="Rejected">Reject</button></div>`;
            } else if (isManagerTask) {
                html += `<div class="m-btn-row"><button class="m-btn-approve manager-action" data-action="Approved" style="background-color: #00748C;">Approve</button><button class="m-btn-reject manager-action" data-action="Rejected">Reject</button></div>`;
            } else {
                html += `<div style="text-align:center; padding:10px; color:#777; background:#f0f0f0; border-radius:8px; margin-top:10px;"><i class="fa-solid fa-lock"></i> View Only</div>`;
            }
            html += `</div>`;
        }

        card.innerHTML = html;
        
        // Card Listeners
        const header = card.querySelector('.mobile-card-header');
        const body = card.querySelector('.mobile-card-body');
        header.addEventListener('click', () => {
            document.querySelectorAll('.mobile-card-body.open').forEach(el => { if (el !== body) el.classList.remove('open'); });
            body.classList.toggle('open');
        });

        // Button Actions
        if (['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) {
            const trfBtns = card.querySelectorAll('.trf-mobile-action');
            trfBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                     if(typeof processMobileTransferAction === 'function') {
                         processMobileTransferAction(task, btn.dataset.action, card);
                     }
                });
            });
        } else {
            const ceoBtns = card.querySelectorAll('.ceo-action');
            ceoBtns.forEach(btn => btn.addEventListener('click', () => processMobileCEOAction(task, btn.dataset.action, card.querySelector('.m-input-amount').value, card.querySelector('.m-input-note').value, card)));
            const mgrBtns = card.querySelectorAll('.manager-action');
            mgrBtns.forEach(btn => btn.addEventListener('click', () => {
                if(typeof processMobileManagerAction === 'function') {
                    processMobileManagerAction(task, btn.dataset.action, card.querySelector('.m-input-amount').value, card.querySelector('.m-input-note').value, card);
                }
            }));
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

    // [1.aes] updates
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
            // [1.aet] originalInvoice
            const originalInvoice = (allInvoiceData && allInvoiceData[taskData.originalPO]) ? allInvoiceData[taskData.originalPO][taskData.originalKey] : {};
            // [1.aeu] updatedInvoiceData
            const updatedInvoiceData = {
                ...originalInvoice,
                ...updates
            };
            await updateInvoiceTaskLookup(taskData.originalPO, taskData.originalKey, updatedInvoiceData, taskData.attention);
            updateLocalInvoiceCache(taskData.originalPO, taskData.originalKey, updates);
        }

        taskData.status = status;
        taskData.amountPaid = amount;
        ceoProcessedTasks.push(taskData);

        // [1.aev] taskIndex
        const taskIndex = userActiveTasks.findIndex(t => t.key === taskData.key);
        if (taskIndex > -1) {
            userActiveTasks.splice(taskIndex, 1);
        }

        cardElement.style.transform = 'translateX(100%)';
        setTimeout(() => {
            cardElement.remove();
            // [1.aew] count
            const count = userActiveTasks.length;
            if (activeTaskCountDisplay) activeTaskCountDisplay.textContent = `(Total Tasks: ${count})`;
            renderMobileActiveTasks(userActiveTasks);
        }, 300);

    } catch (error) {
        console.error("Mobile Action Error:", error);
        alert("Failed to process task. Check connection.");
        cardElement.style.opacity = '1';
        cardElement.style.pointerEvents = 'auto';
    }
}

async function processMobileManagerAction(taskData, status, amount, note, cardElement) {
    // Visual feedback
    cardElement.style.opacity = '0.5';
    cardElement.style.pointerEvents = 'none';

    // Prepare Updates
    const updates = {
        status: status,
        remarks: status,
        amountPaid: amount, // This gets the value directly from the "Amount to Paid" box
        amount: amount, // Sync main amount to match (optional, but safe)
        note: note ? note.trim() : '',
        dateResponded: formatDate(new Date())
    };

    if (taskData.attention) {
        updates.note = `${updates.note} [Action by ${currentApprover.Name}]`;
    }

    try {
        // 1. Update Database (Keep existing logic)
        if (taskData.source === 'job_entry') {
            await db.ref(`job_entries/${taskData.key}`).update(updates);
        } else if (taskData.source === 'invoice') {
            await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update(updates);
            if (!allInvoiceData) await ensureInvoiceDataFetched();
            const originalInvoice = (allInvoiceData && allInvoiceData[taskData.originalPO]) ? allInvoiceData[taskData.originalPO][taskData.originalKey] : {};
            const updatedInvoiceData = {
                ...originalInvoice,
                ...updates
            };
            await updateInvoiceTaskLookup(taskData.originalPO, taskData.originalKey, updatedInvoiceData, taskData.attention);
            updateLocalInvoiceCache(taskData.originalPO, taskData.originalKey, updates);
        }

        // 2. Add to Manager Processed List (CRITICAL FIX FOR RECEIPT)
        taskData.status = status;
        taskData.amountPaid = amount; // <--- Explicitly save the "Amount To Paid" value
        managerProcessedTasks.push(taskData);

        // 3. Remove from UI
        const taskIndex = userActiveTasks.findIndex(t => t.key === taskData.key);
        if (taskIndex > -1) userActiveTasks.splice(taskIndex, 1);

        cardElement.style.transform = 'translateX(100%)';
        setTimeout(() => {
            cardElement.remove();
            document.getElementById('mobile-receipt-action-container').classList.remove('hidden');
            document.getElementById('mobile-send-manager-receipt-btn').classList.remove('hidden');
        }, 300);

    } catch (error) {
        console.error("Manager Action Error:", error);
        alert("Failed to process. Check connection.");
        cardElement.style.opacity = '1';
        cardElement.style.pointerEvents = 'auto';
    }
}

// [FIXED] Mobile Action - APPROVAL ONLY (No Receipt)
window.processMobileTransferAction = async function(task, action, cardElement) {
    if (!task || !action) return;
    
    // 1. Visual Feedback
    cardElement.style.opacity = '0.5';
    cardElement.style.pointerEvents = 'none';

    // 2. Get Correct Quantity (Adjusted vs Ordered)
    const qty = (task.approvedQty !== undefined && task.approvedQty !== null) 
                ? parseFloat(task.approvedQty) 
                : (parseFloat(task.orderedQty) || 0);

    try {
        // 3. Populate Desktop Hidden Inputs (Required for logic engine)
        const keyInput = document.getElementById('transfer-modal-key');
        const qtyInput = document.getElementById('transfer-modal-qty');
        const noteInput = document.getElementById('transfer-modal-note');
        const dateInput = document.getElementById('transfer-modal-date');

        if(keyInput) keyInput.value = task.key;
        if(qtyInput) qtyInput.value = qty; 
        if(noteInput) noteInput.value = "Mobile Action";
        if(dateInput) dateInput.value = new Date().toISOString().split('T')[0]; 

        // 4. Execute Logic (Updates Database Status Only)
        if (window.handleTransferAction) {
            await window.handleTransferAction(action);
        } else {
            throw new Error("Logic engine not found");
        }

        // 5. Success Animation
        cardElement.style.transition = "transform 0.3s ease, height 0.3s ease";
        cardElement.style.transform = 'translateX(100%)';
        setTimeout(() => {
            cardElement.style.display = 'none'; 
            
            // Update Header Count
            if(typeof activeTaskCountDisplay !== 'undefined' && activeTaskCountDisplay) {
                const remaining = document.querySelectorAll('.mobile-task-card:not([style*="display: none"])').length;
                activeTaskCountDisplay.textContent = `(Total Tasks: ${remaining})`;
            }
        }, 300);

    } catch (e) {
        console.error("Mobile Transfer Error:", e);
        alert("Error processing action. Please refresh.");
        cardElement.style.opacity = '1';
        cardElement.style.pointerEvents = 'auto';
    }
};


// =========================================================
// RECEIPT GENERATION FUNCTIONS (SEPARATED & FIXED)
// =========================================================

// 1. Manager Receipt Generator (For Invoices - "Manager Approval")
async function previewAndSendManagerReceipt() {
    const btn = document.getElementById('mobile-send-manager-receipt-btn');
    if(btn) { btn.disabled = true; btn.textContent = 'Preparing...'; }

    try {
        const seriesNo = await getManagerSeriesNumber(); 
        
        const approvedTasks = managerProcessedTasks.filter(t => t.status === 'Approved');
        const rejectedTasks = managerProcessedTasks.filter(t => t.status === 'Rejected');

        const receiptData = {
            title: "Manager Approval", 
            approvedTasks: approvedTasks,
            rejectedTasks: rejectedTasks,
            seriesNo: seriesNo,
            appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '4.0'
        };

        localStorage.setItem('pendingReceiptData', JSON.stringify(receiptData));
        window.open('receipt.html', '_blank');

        // Reset
        managerProcessedTasks = [];
        const mCont = document.getElementById('mobile-receipt-action-container');
        if (mCont) mCont.classList.add('hidden');
        if (btn) btn.classList.add('hidden');

    } catch (error) {
        console.error("Error:", error);
        alert("Error generating receipt.");
    } finally {
        if(btn) { 
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-signature"></i> Send Manager Receipt';
        }
    }
}

// 2. Transfer Receipt Generator (For Inventory - "Authorize Transaction")
async function previewAndSendTransferReceipt() {
    const btn = document.getElementById('mobile-send-transfer-receipt-btn') || document.getElementById('send-transfer-approval-receipt-btn');
    if(btn) { btn.disabled = true; btn.textContent = 'Preparing...'; }

    try {
        // Use the ESN from the task if available
        const seriesNo = (transferProcessedTasks.length > 0 && transferProcessedTasks[0].esn) 
                         ? transferProcessedTasks[0].esn 
                         : await getManagerSeriesNumber();
        
        const receiptData = {
            title: "Authorize Transaction", 
            approvedTasks: transferProcessedTasks,
            rejectedTasks: [], 
            seriesNo: seriesNo,
            isInventory: true, 
            movement: (transferProcessedTasks.length > 0) ? transferProcessedTasks[0].movement : '',
            appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '4.3.7'
        };

        localStorage.setItem('pendingReceiptData', JSON.stringify(receiptData));
        window.open('receipt.html', '_blank');

        // Reset
        transferProcessedTasks = [];
        const mCont = document.getElementById('mobile-receipt-action-container');
        if (mCont) mCont.classList.add('hidden');
        
        document.querySelectorAll('#send-transfer-approval-receipt-btn, #mobile-send-transfer-receipt-btn').forEach(b => b.classList.add('hidden'));

    } catch (error) {
        console.error("Error:", error);
        alert("Error generating receipt.");
    } finally {
        if(btn) { 
            btn.disabled = false; 
            btn.innerHTML = '<i class="fa-solid fa-boxes-packing"></i> Send Transfer Receipt'; 
        }
    }
}

// =========================================================
// EVENT LISTENERS (Re-attached correctly)
// =========================================================

// Manager Button Listener
const mgrReceiptBtn = document.getElementById('mobile-send-manager-receipt-btn');
if(mgrReceiptBtn) {
    // Remove old listener to prevent duplicates
    mgrReceiptBtn.replaceWith(mgrReceiptBtn.cloneNode(true));
    document.getElementById('mobile-send-manager-receipt-btn').addEventListener('click', previewAndSendManagerReceipt);
}

// Transfer Button Listeners
const desktopTrfBtn = document.getElementById('send-transfer-approval-receipt-btn');
if (desktopTrfBtn) {
    desktopTrfBtn.addEventListener('click', async () => {
        await previewAndSendTransferReceipt();
        desktopTrfBtn.classList.add('hidden');
    });
}

const mobileTrfBtn = document.getElementById('mobile-send-transfer-receipt-btn');
if (mobileTrfBtn) {
    mobileTrfBtn.addEventListener('click', async () => {
        await previewAndSendTransferReceipt();
        mobileTrfBtn.classList.add('hidden');
    });
}


// ==========================================================================
// 9. WORKDESK LOGIC: JOB ENTRY (CRUD)
// ==========================================================================

// --- Form Reset & Dropdown Population ---

// [1.afh] resetJobEntryForm
function resetJobEntryForm(keepJobType = false) {
    // [1.afi] jobType
    const jobType = document.getElementById('job-for').value;

    // 1. Reset the actual form inputs
    document.getElementById('jobentry-form').reset();

    // 2. Restore Job Type if requested
    if (keepJobType) {
        document.getElementById('job-for').value = jobType;
    }

    // 3. CRITICAL: Switch Mode back to "ADD"
    currentlyEditingKey = null; // Forget the ID we were editing
    document.getElementById('standard-modal-title').textContent = 'Add New Job Entry';

    // 4. Toggle Buttons (Hide Update/Delete, Show Add)
    // We use classList to ensure we don't break the layout
    // [1.afj] addBtn
    const addBtn = document.getElementById('add-job-button');
    // [1.afk] updateBtn
    const updateBtn = document.getElementById('update-job-button');
    // [1.afl] deleteBtn
    const deleteBtn = document.getElementById('delete-job-button');

    if (addBtn) addBtn.classList.remove('hidden');
    if (updateBtn) updateBtn.classList.add('hidden');
    if (deleteBtn) deleteBtn.classList.add('hidden');

    // 5. Remove Highlight Visuals
    ['job-amount', 'job-po'].forEach(id => {
        // [1.afm] el
        const el = document.getElementById(id);
        if (el) el.classList.remove('highlight-field');
    });

    // 6. Reset Dropdowns (Choices.js)
    if (attentionSelectChoices) {
        if (attentionSelectChoices.disabled) attentionSelectChoices.enable();
        attentionSelectChoices.clearInput();
        attentionSelectChoices.removeActiveItems();
        // Repopulate to ensure list is clean
        populateAttentionDropdown(attentionSelectChoices);
    }

    if (siteSelectChoices) {
        siteSelectChoices.clearInput();
        siteSelectChoices.removeActiveItems();
    }

    // 7. Hide Transfer Fields (Just in case)
    // [1.afn] transferContainer
    const transferContainer = document.getElementById('transfer-fields-container');
    if (transferContainer) transferContainer.classList.add('hidden');

    document.querySelectorAll('.jobentry-form-2col .form-column').forEach(col => col.classList.remove('hidden'));

    // 8. Reset Search (Optional, keeps UI clean)
    // [1.afo] searchInput
    const searchInput = document.getElementById('job-entry-search');
    if (searchInput) searchInput.value = '';
    sessionStorage.removeItem('jobEntrySearch');
}

// --- Helper: Toggle "Other" Input ---
// [1.afp] toggleJobOtherInput
function toggleJobOtherInput() {
    // [1.afq] select
    const select = document.getElementById('job-for');
    // [1.afr] otherInput
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

        choicesInstance.setChoices([{
            value: '',
            label: 'Loading...',
            disabled: true,
            selected: true
        }], 'value', 'label', true);

        if (!allApproverData) {
            // [1.afs] snapshot
            const snapshot = await db.ref('approvers').once('value');
            allApproverData = snapshot.val();
        }
        // [1.aft] approvers
        const approvers = allApproverData;

        if (approvers) {
            // [1.afu] today
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // [1.afv] approverOptions
            const approverOptions = Object.values(approvers).map(approver => {
                if (!approver.Name) return null;

                // [1.afw] isOnVacation
                const isOnVacation = approver.Vacation === true || approver.Vacation === "Yes";
                // [1.afx] isVacationActive
                let isVacationActive = false;
                if (isOnVacation) {
                    // If no return date is provided, treat vacation as active (manual toggle).
                    if (!approver.DateReturn) {
                        isVacationActive = true;
                    } else {
                        try {
                            // [1.afy] returnDate
                            const returnDate = new Date(approver.DateReturn + 'T00:00:00Z');
                            if (!isNaN(returnDate) && returnDate >= today) {
                                isVacationActive = true;
                            }
                        } catch (e) {
                            console.error(`Error parsing return date "${approver.DateReturn}" for ${approver.Name}:`, e);
                        }
                    }
                }

                // [1.afz] name
                const name = approver.Name || 'No-Name';
                // [1.aga] position
                const position = approver.Position || 'No-Pos';
                // [1.agb] site
                const site = approver.Site || 'No-Site';
                // [1.agc] newLabel
                const newLabel = `${name} - ${position} - ${site}`;
                // [1.agd] displayLabel
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

            // [1.age] choiceList
            const choiceList = [
                {
                    value: '',
                    label: 'Select Attention',
                    disabled: true
                },
                {
                    value: 'None',
                    label: 'None (Clear Selection)'
                },
                {
                    value: 'All',
                    label: 'All (Send to Records)'
                },
                ...approverOptions.sort((a, b) => a.label.localeCompare(b.label))
            ];

            allApproversCache = choiceList;
            choicesInstance.setChoices(allApproversCache, 'value', 'label', true);

        } else {
            choicesInstance.setChoices([{
                value: '',
                label: 'No approvers found',
                disabled: true
            }]);
        }
    } catch (error) {
        console.error("Error populating attention dropdown:", error);
        if (choicesInstance) choicesInstance.setChoices([{
            value: '',
            label: 'Error loading names',
            disabled: true
        }]);
    }
}

// --- Helper: Populate Job Types Dynamically ---
// [1.agf] updateJobTypeDropdown
function updateJobTypeDropdown() {
    // [1.agg] select
    const select = document.getElementById('job-for');
    if (!select) return;

    // 1. Default Types (Hardcoded)
    // ADD 'Return' TO THIS LIST
    // [1.agh] defaultTypes
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
    // [1.agi] currentVal
    const currentVal = select.value;

    select.innerHTML = '<option value="" disabled>Select a Type</option>';

    // Sort them alphabetically
    // [1.agj] sortedTypes
    const sortedTypes = Array.from(defaultTypes).sort();

    sortedTypes.forEach(type => {
        if (type === 'Other') return; // Skip 'Other', we add it at the end manually
        // [1.agk] opt
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        select.appendChild(opt);
    });

    // Always add 'Other' at the end
    // [1.agl] otherOpt
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

        siteSelectChoices.setChoices([{
            value: '',
            label: 'Loading...',
            disabled: true,
            selected: true
        }], 'value', 'label', true);

        // We use the cached CSV content here (fetched in ensureInvoiceDataFetched)
        // If not loaded yet, we fetch it specifically now
        if (!allSitesCSVData) {
            console.log("Fetching Site.csv for WorkDesk dropdown from Firebase...");
            // [1.agm] url
            const url = await getFirebaseCSVUrl('Site.csv');
            if (url) {
                allSitesCSVData = await fetchAndParseSitesCSV(url);
                cacheTimestamps.sitesCSV = Date.now();
            }
        }

        // [1.agn] sites
        const sites = allSitesCSVData;

        if (sites && sites.length > 0) {
            // [1.ago] siteOptions
            const siteOptions = sites
                .map(site => (site.site && site.description) ? {
                    value: site.site,
                    label: `${site.site} - ${site.description}`
                } : null)
                .filter(Boolean)
                .sort((a, b) => {
                    // [1.agp] numA
                    const numA = parseInt(a.value, 10);
                    // [1.agq] numB
                    const numB = parseInt(b.value, 10);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    return a.label.localeCompare(b.label);
                });

            // [1.agr] choiceList
            const choiceList = [{
                value: '',
                label: 'Select a Site',
                disabled: true
            }].concat(siteOptions);
            allSitesCache = choiceList;
            siteSelectChoices.setChoices(allSitesCache, 'value', 'label', true);
        } else {
            siteSelectChoices.setChoices([{
                value: '',
                label: 'No sites found',
                disabled: true
            }]);
        }
    } catch (error) {
        console.error("Error populating site dropdown from CSV:", error);
        if (siteSelectChoices) siteSelectChoices.setChoices([{
            value: '',
            label: 'Error loading sites',
            disabled: true
        }]);
    }
}

// --- Table Rendering & Search ---

// [1.ags] renderJobEntryTable
function renderJobEntryTable(entries) {
    jobEntryTableBody.innerHTML = '';

    if (!entries || entries.length === 0) {
        jobEntryTableBody.innerHTML = `<tr><td colspan="8">No pending entries found for your search.</td></tr>`;
        return;
    }

    entries.forEach(entry => {
        // [1.agt] row
        const row = document.createElement('tr');
        row.setAttribute('data-key', entry.key);

        // Make row clickable for editing (unless it's a pure invoice task)
        if (entry.source !== 'invoice') {
            row.style.cursor = 'pointer';
        }

        // --- Attachment Display Logic ---
        // [1.agu] refDisplay
        let refDisplay = entry.ref || '';

        if (entry.attachmentName && entry.attachmentName.trim() !== '') {
            // [1.agv] val
            const val = entry.attachmentName.trim();

            // Smart Link Construction (Same as above)
            let fullPath;
            if (val.startsWith('http')) {
                fullPath = val;
            } else {
                fullPath = ATTACHMENT_BASE_PATH + encodeURIComponent(val);
            }

            // Smart Icon Detection
            // [1.agw] iconClass
            let iconClass = "fa-paperclip";
            // [1.agx] lowerName
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
    // [1.agy] searchText
    const searchText = (searchTerm || '').toLowerCase();
    sessionStorage.setItem('jobEntrySearch', searchText);

    jobEntryTableBody.innerHTML = '<tr><td colspan="8">Searching...</td></tr>';

    try {
        await ensureAllEntriesFetched();

        userJobEntries = allSystemEntries.filter(entry =>
            entry.enteredBy === currentApprover.Name && !isTaskComplete(entry)
        );

        // [1.agz] filteredEntries
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

// [1.aha] getJobDataFromForm
function getJobDataFromForm() {
    // [1.ahb] formData
    const formData = new FormData(jobEntryForm);
    // [1.ahc] jobType
    let jobType = formData.get('for');

    // 1. Handle "Other" Logic
    if (jobType === 'Other') {
        // [1.ahd] customType
        const customType = document.getElementById('job-other-specify').value.trim();
        if (customType) {
            jobType = customType; // Use the text input instead of "Other"
        } else {
            alert("Please specify the Job Type in the text box.");
            return null; // Stop execution
        }
    }

    // [1.ahe] data
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
    // [1.ahf] jobData
    const jobData = getJobDataFromForm();

    // 3. If getJobDataFromForm returned null, it means validation failed (e.g., empty "Other" box)
    if (!jobData) {
        addJobButton.disabled = false;
        return; // Stop execution here
    }

    addJobButton.textContent = 'Adding...';

    // [1.ahg] isInvoiceJob
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
        // [1.ahh] isQS
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
        // [1.ahi] duplicatePO
        const duplicatePO = allSystemEntries.find(entry => entry.for === 'IPC' && entry.po && entry.po.trim() !== '' && entry.po === jobData.po);
        if (duplicatePO) {
            // [1.ahj] message
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

    // --- NEW: INITIAL HISTORY LOG ---
    jobData.history = [{
        action: "Created",
        by: currentApprover.Name,
        timestamp: Date.now(),
        status: jobData.remarks || 'Pending',
        note: "Initial Entry"
    }];

    try {
        // 8. Push to Firebase
        await db.ref('job_entries').push(jobData);

        alert('Job Entry Added Successfully!');

        // 9. Refresh Data & UI
        await ensureAllEntriesFetched(true);

        // IMPORTANT: Refresh the dropdown list so the new "Custom Type" appears immediately
        updateJobTypeDropdown();

        handleJobEntrySearch(jobEntrySearchInput.value);

        // REPLACED: Close the modal instead of resetting the old form
        closeStandardJobModal();

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

    // [1.ahk] userPositionLower
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

        // REPLACED: Close the modal instead of resetting the old form
        closeStandardJobModal();

        populateActiveTasks();

    } catch (error) {
        console.error("Error deleting job entry:", error);
        alert('Failed to delete Job Entry. Please try again.');
    }
}

async function handleUpdateJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) {
        alert("No entry selected for update.");
        return;
    }

    // 1. Disable button
    updateJobButton.disabled = true;
    updateJobButton.textContent = 'Updating...';

    // 2. Get Data (Reuses the same logic as Add - handles Attachment & Other)
    // [1.ahl] jobData
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
    // [1.ahm] isInvoiceJob
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
        // [1.ahn] originalEntry
        const originalEntry = allSystemEntries.find(entry => entry.key === currentlyEditingKey);

        if (originalEntry) {
            // Keep original creator and time
            jobData.enteredBy = originalEntry.enteredBy;
            jobData.timestamp = originalEntry.timestamp;
            jobData.date = originalEntry.date;

            // Logic: Should we reset 'Date Responded'?
            // [1.aho] newDateResponded
            let newDateResponded = originalEntry.dateResponded || null;

            if (currentApprover.Name === (originalEntry.attention || '') &&
                !originalEntry.dateResponded &&
                jobData.for !== 'Invoice' &&
                jobData.attention === (originalEntry.attention || '')) {
                // If I am the attention user and I am updating it, mark as responded
                newDateResponded = formatDate(new Date());
            } else {
                // If critical fields changed, reset response date (re-open task)
                // [1.ahp] hasChanged
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
        // [1.ahq] isQS
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
        if (jobData.for === 'IPC' && jobData.attention === 'All' && isQS) {
            jobData.remarks = 'Ready';
        }

        // 6. Save to Database
        await db.ref(`job_entries/${currentlyEditingKey}`).update(jobData);

        // --- NEW: LOG UPDATE HISTORY ---
        const historyEntry = {
            action: "Updated",
            by: currentApprover.Name,
            timestamp: Date.now(),
            status: jobData.remarks,
            note: "Job details updated"
        };
        // Push to history sub-collection
        await db.ref(`job_entries/${currentlyEditingKey}/history`).push(historyEntry);

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

// [1.ahr] populateFormForEditing
function populateFormForEditing(key) {
    // [1.ahs] entryData
    const entryData = allSystemEntries.find(entry => entry.key === key);
    if (!entryData) return;

    // --- 1. TRANSFER GROUP LOGIC (KEPT SAME) ---
    // We check for all transfer types to be safe. 
    // If matched, we hand it over to transferLogic.js just like before.
    if (['Transfer', 'Restock', 'Return', 'Usage'].includes(entryData.for)) {
        if (window.loadTransferForEdit) {
            window.loadTransferForEdit(entryData);
        } else {
            console.error("Transfer loader not found.");
        }
        return; // STOP HERE. The Transfer Modal takes over.
    }

    // --- 2. STANDARD GROUP LOGIC (NEW) ---
    // Previously, this code filled the static form on the page.
    // Now, we simply tell it to open the new Modal in 'Edit' mode.
    openStandardJobModal('Edit', entryData);
}

// [1.aht] updateJobEntryNavControls
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
    // [1.ahu] db
    const db = firebase.database();

    // DOM Elements
    // [1.ahv] navMaterialStock
    const navMaterialStock = document.getElementById('nav-material-stock');
    // [1.ahw] materialStockSection
    const materialStockSection = document.getElementById('wd-material-stock');
    // [1.ahx] stockFormContainer
    const stockFormContainer = document.getElementById('material-stock-form-container');
    // [1.ahy] stockTableBody
    const stockTableBody = document.getElementById('material-stock-table-body');
    // [1.ahz] stockSearchInput
    const stockSearchInput = document.getElementById('stock-table-search');

    // [1.aia] saveStockBtn
    const saveStockBtn = document.getElementById('save-stock-btn');
    // [1.aib] cancelStockBtn
    const cancelStockBtn = document.getElementById('cancel-stock-btn');
    // [1.aic] stockQtyInput
    const stockQtyInput = document.getElementById('stock-qty');
    // [1.aid] transQtyInput
    const transQtyInput = document.getElementById('stock-transferred-qty');
    // [1.aie] balanceDisplay
    const balanceDisplay = document.getElementById('stock-balance-display');
    // [1.aif] stockProductName
    const stockProductName = document.getElementById('stock-product-name');
    // [1.aig] stockDetails
    const stockDetails = document.getElementById('stock-details');
    // [1.aih] stockProductIdSelect
    const stockProductIdSelect = document.getElementById('stock-product-id');
    // [1.aii] stockFormTitle
    const stockFormTitle = document.getElementById('stock-form-title');
    // [1.aij] stockEntryMode
    const stockEntryMode = document.getElementById('stock-entry-mode');
    // [1.aik] stockEntryKey
    const stockEntryKey = document.getElementById('stock-entry-key');

    // [1.ail] addStockBtn
    const addStockBtn = document.getElementById('add-stock-btn');
    // [1.aim] uploadStockCsvBtn
    const uploadStockCsvBtn = document.getElementById('upload-stock-csv-btn');
    // [1.ain] downloadStockTemplateBtn
    const downloadStockTemplateBtn = document.getElementById('download-stock-template-btn');
    // [1.aio] stockCsvInput
    const stockCsvInput = document.getElementById('stock-csv-upload');

    // Job Entry Elements
    // [1.aip] jobForSelect
    const jobForSelect = document.getElementById('job-for');
    // [1.ais] addJobBtn
    const addJobBtn = document.getElementById('add-job-button');

    // [1.ajh] currentUser
    let currentUser = null;
    // [1.aji] isUserAdmin
    let isUserAdmin = false;
    // [1.ajj] allStockDataCache
    let allStockDataCache = {};
    // [1.ajk] tableDataCache
    let tableDataCache = [];

    // [1.ajl] editingTransferKey
    let editingTransferKey = null;

    let fromSiteChoices, toSiteChoices, contactChoices, operatorChoices;
    let trfProductChoices, stockProductChoices;
    // [1.ajm] currentStockSearchText
    let currentStockSearchText = "";

    // ==========================================================================
    // 1. PERMISSION & INITIALIZATION (FIXED)
    // ==========================================================================

    async function checkPermissions() {
        // [1.ajn] key
        const key = localStorage.getItem('approverKey');
        if (!key) return;
        try {
            // [1.ajo] snapshot
            const snapshot = await db.ref(`approvers/${key}`).once('value');
            currentUser = snapshot.val();
            if (currentUser) {
                // [1.ajp] position
                const position = (currentUser.Position || '').trim();
                // [1.ajq] role
                const role = (currentUser.Role || '').toLowerCase();
                isUserAdmin = (role === 'admin');

                // --- SAFETY CHECK: Ensure navMaterialStock exists ---
                if (typeof navMaterialStock !== 'undefined' && navMaterialStock && (position === 'Site DC' || isUserAdmin)) {
                    navMaterialStock.classList.remove('hidden');
                }

                if (isUserAdmin) {
                    // [1.ajr] addBtn
                    const addBtn = document.getElementById('ms-add-new-btn');
                    // [1.ajs] uploadBtn
                    const uploadBtn = document.getElementById('ms-upload-csv-btn');
                    // [1.ajt] templBtn
                    const templBtn = document.getElementById('ms-template-btn');

                    if (addBtn) addBtn.classList.remove('hidden');
                    if (uploadBtn) uploadBtn.classList.remove('hidden');
                    if (templBtn) templBtn.classList.remove('hidden');
                }
            }
        } catch (e) {
            console.error("Error checking permissions:", e);
        }
    }
    // Ensure this runs after DOM Load if possible, or keep as is
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkPermissions);
    } else {
        checkPermissions();
    }

    // ==============================================================
    // 3. JOB ENTRY: TRANSFER & SPECIAL TYPES HANDLER (FINAL)
    // ==============================================================

    if (jobForSelect) {
        jobForSelect.addEventListener('change', async (e) => {
            const jobType = e.target.value;

            // 1. DEFINE THE SPECIAL TYPES
            // This ensures Transfer, Restock, Return, AND Usage all trigger the new modal
            const transferTypes = ['Transfer', 'Restock', 'Return', 'Usage'];

            if (transferTypes.includes(jobType)) {
                // A. Close the Standard Job Modal
                if (typeof closeStandardJobModal === 'function') {
                    closeStandardJobModal();
                } else {
                    document.getElementById('standard-job-modal').classList.add('hidden');
                }

                // B. Ensure required data is loaded
                if (typeof ensureAllEntriesFetched === 'function') {
                    await ensureAllEntriesFetched(false);
                }

                // C. Open the dedicated Transfer Modal
                setTimeout(() => {
                    if (typeof openTransferModal === 'function') {
                        openTransferModal(jobType);
                    } else {
                        console.error("Critical Error: openTransferModal not found.");
                        alert("System error: Transfer logic script is not loaded.");
                    }
                }, 150);

                // STOP HERE. Do not execute standard logic.
                return;
            }

            // ============================================================
            // 2. STANDARD JOB LOGIC (For Invoice, PR, IPC, etc.)
            // ============================================================

            const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
            const isInvoice = (jobType === 'Invoice');
            const isIPCforQS = (jobType === 'IPC' && isQS);

            // Reset Attention Field based on type
            if (attentionSelectChoices) {
                attentionSelectChoices.enable();
                if (isInvoice) {
                    attentionSelectChoices.clearStore();
                    attentionSelectChoices.setChoices([{
                        value: '',
                        label: 'Auto-assigned to Accounting',
                        disabled: true,
                        selected: true
                    }], 'value', 'label', false);
                    attentionSelectChoices.disable();
                } else if (isIPCforQS) {
                    attentionSelectChoices.clearStore();
                    attentionSelectChoices.setChoices([{
                        value: 'All',
                        label: 'All',
                        selected: true
                    }], 'value', 'label', false);
                    attentionSelectChoices.disable();
                } else {
                    // Repopulate standard approvers
                    if (typeof populateAttentionDropdown === 'function') {
                        populateAttentionDropdown(attentionSelectChoices);
                    }
                }
            }

            // Handle "Other" Input Visibility
            if (typeof toggleJobOtherInput === 'function') {
                toggleJobOtherInput();
            }
        });
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
            loadMaterialStock();
            populateProductDropdowns();
        });
    }
    if (stockSearchInput) {
        stockSearchInput.addEventListener('input', (e) => {
            // [1.alq] term
            const term = e.target.value.toLowerCase();
            // [1.alr] filtered
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
            stockEntryMode.value = 'new';
            stockEntryKey.value = '';
            if (stockProductChoices) {
                stockProductChoices.enable();
                stockProductChoices.clearStore();
                currentStockSearchText = "";
                populateProductDropdowns();
            }
            stockProductName.readOnly = false;
            stockProductName.style.backgroundColor = "";
            stockDetails.readOnly = false;
            stockDetails.style.backgroundColor = "";
            document.getElementById('stock-qty-label').textContent = "Stock QTY (Total)";
            clearStockForm();
        });
    }
    window.openAddStockModal = function (key) {
        // [1.als] item
        const item = tableDataCache.find(i => i.key === key);
        if (!item) return;
        stockFormContainer.classList.remove('hidden');
        stockFormTitle.textContent = "Stock In (Add Quantity)";
        stockEntryMode.value = 'add_qty';
        stockEntryKey.value = key;
        if (stockProductChoices) {
            stockProductChoices.setChoiceByValue(item.productId);
            stockProductChoices.disable();
        }
        stockProductName.value = item.productName;
        stockProductName.readOnly = true;
        stockProductName.style.backgroundColor = "#e9ecef";
        stockDetails.value = item.details;
        stockDetails.readOnly = true;
        stockDetails.style.backgroundColor = "#e9ecef";
        document.getElementById('stock-qty-label').textContent = "Add Qty (Increment)";
        stockQtyInput.value = "";
        stockQtyInput.placeholder = "Enter amount to ADD";
        stockQtyInput.focus();
        transQtyInput.parentElement.classList.add('hidden');
        balanceDisplay.parentElement.classList.add('hidden');
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
            // [1.alt] mode
            const mode = stockEntryMode.value;
            const key = stockEntryKey.value;
            // [1.alu] inputQty
            const inputQty = parseFloat(stockQtyInput.value) || 0;
            // [1.alv] pId
            const pId = stockProductChoices ? stockProductChoices.getValue(true) : '';
            // [1.alw] pName
            const pName = stockProductName.value;
            if (!pId || !pName) {
                alert("Product ID/Name required.");
                return;
            }
            saveStockBtn.textContent = "Saving...";
            saveStockBtn.disabled = true;
            try {
                if (mode === 'add_qty') {
                    if (inputQty <= 0) {
                        alert("Enter valid quantity.");
                        saveStockBtn.disabled = false;
                        return;
                    }
                    // [1.alx] snap
                    const snap = await db.ref(`material_stock/${key}`).once('value');
                    // [1.aly] cur
                    const cur = snap.val();
                    // [1.alz] newStock
                    const newStock = (parseFloat(cur.stockQty) || 0) + inputQty;
                    // [1.ama] newBal
                    const newBal = newStock - (parseFloat(cur.transferredQty) || 0);
                    await db.ref(`material_stock/${key}`).update({
                        stockQty: newStock,
                        balanceQty: newBal,
                        lastUpdated: firebase.database.ServerValue.TIMESTAMP
                    });
                    alert("Stock Added!");
                } else {
                    // [1.amb] trans
                    const trans = parseFloat(transQtyInput.value) || 0;
                    const bal = inputQty - trans;
                    // [1.amc] pl
                    const pl = {
                        productId: pId,
                        productName: pName,
                        details: stockDetails.value,
                        stockQty: inputQty,
                        transferredQty: trans,
                        balanceQty: bal,
                        lastUpdated: firebase.database.ServerValue.TIMESTAMP
                    };
                    if (mode === 'edit' && key) await db.ref(`material_stock/${key}`).update(pl);
                    else {
                        pl.updatedBy = currentUser.Name;
                        await db.ref('material_stock').push(pl);
                    }
                    alert("Saved!");
                }
                stockFormContainer.classList.add('hidden');
                clearStockForm();
                transQtyInput.parentElement.classList.remove('hidden');
                balanceDisplay.parentElement.classList.remove('hidden');
                loadMaterialStock();
                populateProductDropdowns();
            } catch (e) {
                alert("Failed.");
            } finally {
                saveStockBtn.disabled = false;
            }
        });
    }
    // [1.amd] clearStockForm
    function clearStockForm() {
        if (stockProductChoices) {
            stockProductChoices.enable();
            stockProductChoices.removeActiveItems();
        }
        currentStockSearchText = "";
        stockProductName.value = "";
        stockProductName.readOnly = false;
        stockProductName.style.backgroundColor = "";
        stockDetails.value = "";
        stockDetails.readOnly = false;
        stockDetails.style.backgroundColor = "";
        stockQtyInput.value = "";
        transQtyInput.value = "0";
        balanceDisplay.textContent = "0";
        stockEntryMode.value = "new";
        stockEntryKey.value = "";
    }
    async function loadMaterialStock() {
        stockTableBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        try {
            // [1.ame] snap
            const snap = await db.ref('material_stock').once('value');
            const data = snap.val();
            tableDataCache = [];
            if (!data) {
                stockTableBody.innerHTML = '<tr><td colspan="7">No records.</td></tr>';
                return;
            }
            Object.entries(data).forEach(([k, v]) => tableDataCache.push({
                key: k,
                ...v
            }));
            renderStockTable(tableDataCache);
        } catch (e) {
            stockTableBody.innerHTML = '<tr><td colspan="7">Error.</td></tr>';
        }
    }
    // [1.amf] renderStockTable
    function renderStockTable(data) {
        stockTableBody.innerHTML = '';
        data.forEach(item => {
            // [1.amg] row
            const row = document.createElement('tr');
            // [1.amh] bal
            const bal = parseFloat(item.balanceQty) || 0;
            if (bal <= 0) row.style.backgroundColor = '#ffe6e6';
            // [1.ami] balDisp
            const balDisp = bal <= 0 ? `<span style="color:#dc3545;font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> ${bal}</span>` : `<span style="font-weight:bold;color:#003A5C;">${bal}</span>`;
            // [1.amj] acts
            let acts = `<button class="secondary-btn" onclick="openAddStockModal('${item.key}')" style="padding:4px 10px;font-size:12px;background-color:#28a745;color:white;margin-right:5px;">Add</button>`;
            if (isUserAdmin) acts += `<button class="secondary-btn" onclick="deleteStock('${item.key}')" style="padding:4px 10px;font-size:12px;background-color:#dc3545;color:white;">Delete</button>`;
            row.innerHTML = `<td>${item.productId}</td><td>${item.productName}</td><td>${item.details}</td><td>${item.stockQty}</td><td>${item.transferredQty}</td><td>${balDisp}</td><td>${acts}</td>`;
            stockTableBody.appendChild(row);
        });
    }
    window.deleteStock = async function (key) {
        if (confirm("Delete?")) {
            await db.ref(`material_stock/${key}`).remove();
            loadMaterialStock();
            populateProductDropdowns();
        }
    };

    // CSV Logic
    if (downloadStockTemplateBtn) {
        downloadStockTemplateBtn.addEventListener('click', () => {
            // [1.amk] headers
            const headers = ["Product ID", "Product Name", "Details", "Stock QTY"];
            // [1.aml] exampleRow
            const exampleRow = ["P-1001", "Cement Bags", "50kg Grey Cement", "100"];
            // [1.amm] csvContent
            const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + exampleRow.join(",");
            // [1.amn] encodedUri
            const encodedUri = encodeURI(csvContent);
            // [1.amo] link
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
            // [1.amp] file
            const file = e.target.files[0];
            if (!file) return;
            // [1.amq] reader
            const reader = new FileReader();
            reader.onload = async (event) => {
                // [1.amr] lines
                const lines = event.target.result.split('\n').filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    alert("CSV empty.");
                    return;
                }
                // [1.ams] successCount
                let successCount = 0;
                const updates = {};
                for (let i = 1; i < lines.length; i++) {
                    // [1.amt] values
                    const values = lines[i].split(',').map(val => val.trim().replace(/^"|"$/g, ''));
                    if (values.length >= 2) {
                        // [1.amu] newKey
                        const newKey = db.ref('material_stock').push().key;
                        updates[newKey] = {
                            productId: values[0],
                            productName: values[1],
                            details: values[2] || '',
                            stockQty: parseFloat(values[3]) || 0,
                            transferredQty: 0,
                            balanceQty: parseFloat(values[3]) || 0,
                            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
                            updatedBy: currentUser.Name
                        };
                        successCount++;
                    }
                }
                if (successCount > 0) {
                    try {
                        await db.ref('material_stock').update(updates);
                        alert(`Uploaded ${successCount} records.`);
                        loadMaterialStock();
                        populateProductDropdowns();
                    } catch (err) {
                        alert("Error writing DB.");
                    }
                }
                stockCsvInput.value = '';
            };
            reader.readAsText(file);
        });
    }
});

// ==========================================================================
// 11. TASK MODIFICATION (Modal Logic)
// ==========================================================================

// [1.amv] openModifyTaskModal
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

    // [1.amw] currentStatus
    const currentStatus = taskData.remarks || 'Pending';
    // [1.amx] standardStatuses
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
    // [1.amy] key
    const key = modifyTaskKey.value;
    // [1.amz] source
    const source = modifyTaskSource.value;
    // [1.ana] originalPO
    const originalPO = modifyTaskOriginalPO.value;
    // [1.anb] originalKey
    const originalKey = modifyTaskOriginalKey.value;

    // [1.anc] originalAttention
    const originalAttention = document.getElementById('modify-task-originalAttention').value;

    if (!key || !source) {
        alert("Error: Task identifiers are missing.");
        return;
    }

    // [1.and] selectedStatus
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

    // [1.ane] updates
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
            // [1.anf] originalEntry
            const originalEntry = allSystemEntries.find(entry => entry.key === key);

            // [1.ang] newAttention
            const newAttention = updates.attention;
            // [1.anh] oldAttention
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
            // [1.ani] originalInvoice
            const originalInvoice = (allInvoiceData && allInvoiceData[originalPO]) ? allInvoiceData[originalPO][originalKey] : {};
            // [1.anj] updatedInvoiceData
            const updatedInvoiceData = {
                ...originalInvoice,
                ...updates
            };

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

// [1.ank] isInvoiceTaskActive
function isInvoiceTaskActive(invoiceData) {
    if (!invoiceData) return false;

    // [1.anl] inactiveStatuses
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

// [1.anm] updateInvoiceTaskLookup (FIXED: Saves amountPaid)
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

            // FIX: Save BOTH amounts
            amount: invoiceData.invValue || '', // Total Invoice Value
            amountPaid: invoiceData.amountPaid || '', // Actual Payment Amount

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
    // [1.ant] sanitizeFirebaseKey
    const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
    // [1.anu] safeOldAttentionKey
    const safeOldAttentionKey = sanitizeFirebaseKey(oldData.attention);
    await invoiceDb.ref(`invoice_tasks_by_user/${safeOldAttentionKey}/${invoiceKey}`).remove();
}

// ==========================================================================
// 13. INVOICE MANAGEMENT: SEARCH & DISPLAY
// ==========================================================================

// [1.anv] resetInvoiceForm
function resetInvoiceForm() {
    // [1.anw] nextId
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
    // [1.anx] inputs
    const inputs = imNewInvoiceForm.querySelectorAll('.input-required-highlight');
    inputs.forEach(el => el.classList.remove('input-required-highlight'));

    // 2. Highlight Standard Inputs
    // [1.any] mandatoryIds
    const mandatoryIds = ['im-inv-no', 'im-inv-value', 'im-invoice-date', 'im-status'];
    mandatoryIds.forEach(id => {
        // [1.anz] el
        const el = document.getElementById(id);
        if (el) el.classList.add('input-required-highlight');
    });

    // 3. Highlight Choices.js Dropdown (Attention)
    // We must target the visible inner container, not the hidden select
    // [1.aoa] attnSelect
    const attnSelect = document.getElementById('im-attention');
    if (attnSelect) {
        // [1.aob] choicesInner
        const choicesInner = attnSelect.closest('.choices')?.querySelector('.choices__inner');
        if (choicesInner) {
            choicesInner.classList.add('input-required-highlight');
        }
    }
}

async function handlePOSearch(poNumberFromInput) {
    // [1.aoc] poNumber
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

        // [1.aod] poData
        let poData = allPOData[poNumber];

        // --- NEW LOGIC: FALLBACK MODAL ---
        if (!poData) {
            // Open the Manual Entry Modal
            document.getElementById('manual-po-number').value = poNumber;
            document.getElementById('manual-supplier-id').value = '';
            document.getElementById('manual-vendor-name').value = '';
            document.getElementById('manual-po-amount').value = '';

            // Populate Modal Site Dropdown (reuse existing logic)
            // [1.aoe] modalSiteSelect
            const modalSiteSelect = document.getElementById('manual-site-select');
            if (modalSiteSelect.options.length <= 1 && allSitesCSVData) {
                allSitesCSVData.forEach(s => {
                    // [1.aof] opt
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
    // [1.aog] invoicesSnapshot
    const invoicesSnapshot = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
    // [1.aoh] invoicesData
    const invoicesData = invoicesSnapshot.val();

    if (!allInvoiceData) allInvoiceData = {};
    allInvoiceData[poNumber] = invoicesData || {};

    currentPO = poNumber;
    // [1.aoi] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    // [1.aoj] isAccounting
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    // [1.aok] poValueText
    const poValueText = (isAdmin || isAccounting) ? (poData.Amount ? `QAR ${formatCurrency(poData.Amount)}` : 'N/A') : '---';
    // [1.aol] siteText
    const siteText = poData['Project ID'] || 'N/A';
    // [1.aom] vendorText
    const vendorText = poData['Supplier Name'] || 'N/A';

    document.querySelectorAll('.im-po-no').forEach(el => el.textContent = poNumber);
    document.querySelectorAll('.im-po-site').forEach(el => el.textContent = siteText);
    document.querySelectorAll('.im-po-value').forEach(el => el.textContent = poValueText);
    document.querySelectorAll('.im-po-vendor').forEach(el => el.textContent = vendorText);

    document.querySelectorAll('.im-po-details-container').forEach(el => el.classList.remove('hidden'));

    fetchAndDisplayInvoices(poNumber);
}


// [1.aon] fetchAndDisplayInvoices
function fetchAndDisplayInvoices(poNumber) {
    // [1.aoo] invoicesData
    const invoicesData = allInvoiceData[poNumber];

    // [1.aop] maxInvIdNum
    let maxInvIdNum = 0;
    imInvoicesTableBody.innerHTML = '';
    currentPOInvoices = invoicesData || {};

    // [1.aoq] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    // [1.aor] isAccounting
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    // [1.aos] invoiceCount
    let invoiceCount = 0;

    // [1.aot] totalInvValueSum
    let totalInvValueSum = 0;
    // [1.aou] totalPaidWithRetention
    let totalPaidWithRetention = 0;
    // [1.aov] totalPaidWithoutRetention
    let totalPaidWithoutRetention = 0;

    if (invoicesData) {
        // [1.aow] invoices
        const invoices = Object.entries(invoicesData).map(([key, value]) => ({
            key,
            ...value
        }));
        invoiceCount = invoices.length;

        invoices.forEach(inv => {
            if (inv.invEntryID) {
                // [1.aox] idNum
                const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                if (!isNaN(idNum) && idNum > maxInvIdNum) {
                    maxInvIdNum = idNum;
                }
            }
        });

        invoices.sort((a, b) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));

        invoices.forEach(inv => {

            // [1.aoy] currentInvValue
            const currentInvValue = parseFloat(inv.invValue) || 0;
            // [1.aoz] currentAmtPaid
            const currentAmtPaid = parseFloat(inv.amountPaid) || 0;
            // [1.apa] noteText
            const noteText = (inv.note || '').toLowerCase();

            totalInvValueSum += currentInvValue;
            totalPaidWithRetention += currentAmtPaid;

            if (!noteText.includes('retention')) {
                totalPaidWithoutRetention += currentAmtPaid;
            }

            // [1.apb] row
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.setAttribute('data-key', inv.key);

            // [1.apc] releaseDateDisplay
            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            // [1.apd] invoiceDateDisplay
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';

            // [1.ape] invValueDisplay
            const invValueDisplay = (isAdmin || isAccounting) ? formatCurrency(inv.invValue) : '---';
            // [1.apf] amountPaidDisplay
            const amountPaidDisplay = (isAdmin || isAccounting) ? formatCurrency(inv.amountPaid) : '---';

            // --- Standard Invoice/SRV Links (Using Base Paths) ---
            // [1.apg] invPDFName
            const invPDFName = inv.invName || '';
            // [1.aph] invPDFLink
            const invPDFLink = (invPDFName.trim() && invPDFName.toLowerCase() !== 'nil') ?
                `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn">Invoice</a>` :
                '';

            // [1.api] srvPDFName
            const srvPDFName = inv.srvName || '';
            // [1.apj] srvPDFLink
            const srvPDFLink = (srvPDFName.trim() && srvPDFName.toLowerCase() !== 'nil') ?
                `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="action-btn srv-pdf-btn">SRV</a>` :
                '';

            // [1.apk] historyBtn
            let historyBtn = '';
            if (inv.history || inv.createdAt || inv.originTimestamp) {
                historyBtn = `<button type="button" class="history-btn action-btn" title="View Status History" onclick="event.stopPropagation(); showInvoiceHistory('${poNumber}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>`;
            }

            // [1.apl] deleteBtnHTML
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

    // [1.apm] nextInvId
    const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;
    imInvEntryIdInput.value = nextInvId;
    resetInvoiceForm();
    imNewInvoiceForm.classList.remove('hidden');

    // [1.apn] footer
    const footer = document.getElementById('im-invoices-table-footer');
    if (footer) {
        // [1.apo] isAdminOrAccounting
        const isAdminOrAccounting = isAdmin || isAccounting;

        // [1.app] finalTotalPaid
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
        if (pendingJobEntryDataForInvoice.ref) {
            document.getElementById('im-inv-no').value = pendingJobEntryDataForInvoice.ref;
        }
        if (pendingJobEntryDataForInvoice.date) {
            imInvoiceDateInput.value = convertDisplayDateToInput(pendingJobEntryDataForInvoice.date);
        }
        pendingJobEntryDataForInvoice = null;
    }
}

// ==========================================================================
// 14. INVOICE MANAGEMENT: SIDEBAR & ACTIVE JOBS
// ==========================================================================

async function populateActiveJobsSidebar() {
    if (!imEntrySidebarList) return;

    await populateActiveTasks();
    // [1.apq] tasksToDisplay
    const tasksToDisplay = userActiveTasks;

    // [1.apr] invoiceJobs
    const invoiceJobs = tasksToDisplay.filter(task => {
        if (task.source === 'invoice' && task.attention === currentApprover.Name) {
            return true;
        }
        if (task.source === 'job_entry' && task.for === 'Invoice' && (currentApprover?.Position || '').toLowerCase() === 'accounting') {
            return true;
        }
        return false;
    });

    // [1.aps] count
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
        // [1.apt] li
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
    // [1.apu] item
    const item = e.target.closest('.im-sidebar-item');
    if (!item) return;

    const {
        po,
        ref,
        amount,
        date,
        source,
        key,
        originalKey,
        originalPO
    } = item.dataset;

    if (!po) {
        alert("This job entry is missing a PO number and cannot be processed.");
        return;
    }

    jobEntryToUpdateAfterInvoice = source === 'job_entry' ? key : null;
    pendingJobEntryDataForInvoice = {
        po,
        ref,
        amount,
        date
    };

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

// [1.apv] populateInvoiceFormForEditing
function populateInvoiceFormForEditing(invoiceKey) {
    // [1.apw] invData
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
    imNewInvoiceForm.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

async function handleAddInvoice(e) {
    e.preventDefault();
    if (!currentPO) {
        alert('No PO is loaded. Please search for a PO first.');
        return;
    }

    // [1.apx] formData
    const formData = new FormData(imNewInvoiceForm);
    // [1.apy] invoiceData
    const invoiceData = Object.fromEntries(formData.entries());
    // [1.apz] attentionValue
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;

    // Handle status-based clearing
    if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
    }

    // --- NEW: STRICT VALIDATION ---
    // 1. Check if required fields are filled
    // Note: We skip 'Attention' check ONLY if status is 'Under Review' or 'With Accounts'
    // [1.aqa] isAttentionRequired
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
        // [1.aqb] poDetails
        const poDetails = allPOData[currentPO] || {};
        // [1.aqc] site
        const site = poDetails['Project ID'] || 'N/A';
        // [1.aqd] vendor
        let vendor = poDetails['Supplier Name'] || 'N/A';
        if (vendor.length > 21) vendor = vendor.substring(0, 21);
        // [1.aqe] invEntryID
        const invEntryID = invoiceData.invEntryID || 'INV-XX';
        invoiceData.invName = `${site}-${currentPO}-${invEntryID}-${vendor}`;
    }

    invoiceData.dateAdded = getTodayDateString();
    invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;

    if (jobEntryToUpdateAfterInvoice) {
        // [1.aqf] originJobEntry
        const originJobEntry = allSystemEntries.find(entry => entry.key === jobEntryToUpdateAfterInvoice);
        if (originJobEntry) {
            invoiceData.originTimestamp = originJobEntry.timestamp;
            invoiceData.originEnteredBy = originJobEntry.enteredBy;
            invoiceData.originType = "Job Entry";
        }
    }

    // Clean up nulls
    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key];
    });

    try {
        // [1.aqg] newRef
        const newRef = await invoiceDb.ref(`invoice_entries/${currentPO}`).push(invoiceData);
        // [1.aqh] newKey
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
                // [1.aqi] updates
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
    if (!currentPO || !currentlyEditingInvoiceKey) {
        alert('No invoice selected for update.');
        return;
    }
    // [1.aqj] formData
    const formData = new FormData(imNewInvoiceForm);
    // [1.aqk] invoiceData
    const invoiceData = Object.fromEntries(formData.entries());
    // [1.aql] attentionValue
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;

    if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
    }

    // [1.aqm] originalInvoiceData
    const originalInvoiceData = currentPOInvoices[currentlyEditingInvoiceKey];

    // [1.aqn] newStatus
    const newStatus = invoiceData.status;
    // [1.aqo] oldStatus
    const oldStatus = originalInvoiceData ? originalInvoiceData.status : '';

    if (newStatus === 'With Accounts' && oldStatus !== 'With Accounts') {
        invoiceData.releaseDate = getTodayDateString();
    }

    // [1.aqp] srvNameLower
    const srvNameLower = (invoiceData.srvName || '').toLowerCase();
    if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
        try {
            // [1.aqq] poDetails
            const poDetails = allPOData[currentPO];
            if (poDetails) {
                // [1.aqr] today
                const today = new Date();
                // [1.aqs] yyyy
                const yyyy = today.getFullYear();
                // [1.aqt] mm
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                // [1.aqu] dd
                const dd = String(today.getDate()).padStart(2, '0');
                // [1.aqv] formattedDate
                const formattedDate = `${yyyy}${mm}${dd}`;
                // [1.aqw] vendor
                let vendor = poDetails['Supplier Name'] || '';
                if (vendor.length > 21) vendor = vendor.substring(0, 21);
                // [1.aqx] site
                const site = poDetails['Project ID'] || 'N/A';
                // [1.aqy] invEntryID
                const invEntryID = invoiceData.invEntryID || 'INV-XX';
                invoiceData.srvName = `${formattedDate}-${currentPO}-${invEntryID}-${site}-${vendor}`;
                document.getElementById('im-srv-name').value = invoiceData.srvName;
            }
        } catch (error) {
            console.error("Could not generate SRV Name:", error);
            alert("Warning: Could not automatically generate the SRV Name.");
        }
    }

    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key];
    });

    try {
        await invoiceDb.ref(`invoice_entries/${currentPO}/${currentlyEditingInvoiceKey}`).update(invoiceData);

        // [1.aqz] oldAttn
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
    if (!currentPO || !key) {
        alert("Could not identify the invoice to delete.");
        return;
    }

    // --- SECURITY UPDATE: Strict check for "Irwin" ---
    if (currentApprover.Name !== 'Irwin') {
        alert("Access Denied: Only the original Administrator (Irwin) can delete invoices.");
        return;
    }
    // ------------------------------------------------

    // [1.ara] invoiceToDelete
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
    // [1.arb] siteFilterSelect
    const siteFilterSelect = document.getElementById('im-reporting-site-filter');
    if (siteFilterSelect.options.length > 1) return;
    try {
        await ensureInvoiceDataFetched();
        // [1.arc] allSites
        const allSites = allSitesCSVData;
        if (!allSites) return;

        // [1.ard] sites
        const sites = new Set();
        allSites.forEach(item => {
            if (item.site) {
                sites.add(item.site);
            }
        });

        // [1.are] sortedSites
        const sortedSites = Array.from(sites).sort((a, b) => {
            // [1.arf] numA
            const numA = parseInt(a, 10);
            // [1.arg] numB
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
            // [1.arh] option
            const option = document.createElement('option');
            option.value = site;
            option.textContent = site;
            siteFilterSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating site filter:", error);
    }
}


// ==========================================================================
// 16. INVOICE MANAGEMENT: REPORTING ENGINE (SORTED BY BALANCE)
// ==========================================================================

// --- STATE TRACKING VARIABLE ---
// [1.ari] imLastExpandedRowId
let imLastExpandedRowId = null;

async function populateInvoiceReporting(searchTerm = '') {
    // [1.arj] openRow
    const openRow = document.querySelector('#im-reporting-content .detail-row:not(.hidden)');
    if (openRow) {
        imLastExpandedRowId = openRow.id;
    } else {
        imLastExpandedRowId = null;
    }

    sessionStorage.setItem('imReportingSearch', searchTerm);

    // [1.ark] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    // [1.arl] isAccounting
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    currentReportData = [];

    // [1.arm] isMobile
    const isMobile = window.innerWidth <= 768;
    // [1.arn] desktopContainer
    const desktopContainer = document.getElementById('im-reporting-content');
    // [1.aro] mobileContainer
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

    // [1.arp] siteFilter
    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    // [1.arq] monthFilter
    const monthFilter = document.getElementById('im-reporting-date-filter').value;
    // [1.arr] statusFilter
    const statusFilter = document.getElementById('im-reporting-status-filter').value;

    try {
        await ensureInvoiceDataFetched();

        // [1.ars] allPOs
        const allPOs = allPOData;
        // [1.art] allInvoicesByPO
        const allInvoicesByPO = allInvoiceData;
        // [1.aru] allEcommit
        const allEcommit = allEcommitDataProcessed;

        if (!allPOs || !allInvoicesByPO || !allEcommit) throw new Error("Data not loaded.");
        // [1.arv] searchText
        const searchText = searchTerm.toLowerCase();
        // [1.arw] processedPOData
        const processedPOData = [];

        // [1.arx] allUniquePOs
        const allUniquePOs = new Set([...Object.keys(allPOs), ...Object.keys(allInvoicesByPO), ...Object.keys(allEcommit)]);

        // [1.ary] filteredPONumbers
        const filteredPONumbers = Array.from(allUniquePOs).filter(poNumber => {
            // [1.arz] poDetails
            const poDetails = allPOs[poNumber] || {};
            // [1.asa] site
            const site = poDetails['Project ID'] || 'N/A';
            // [1.asb] vendor
            const vendor = poDetails['Supplier Name'] || 'N/A';

            // [1.asc] hasNoteMatch
            let hasNoteMatch = false;
            if (allInvoicesByPO[poNumber]) {
                hasNoteMatch = Object.values(allInvoicesByPO[poNumber]).some(inv => inv.note && inv.note.toLowerCase().includes(searchText));
            }

            // [1.asd] searchMatch
            const searchMatch = !searchText || poNumber.toLowerCase().includes(searchText) || vendor.toLowerCase().includes(searchText) || hasNoteMatch;
            // [1.ase] siteMatch
            const siteMatch = !siteFilter || site === siteFilter;
            return searchMatch && siteMatch;
        });

        for (const poNumber of filteredPONumbers) {
            // [1.asf] poDetails
            const poDetails = allPOs[poNumber] || {};
            // [1.asg] site
            const site = poDetails['Project ID'] || 'N/A';
            // [1.ash] vendor
            const vendor = poDetails['Supplier Name'] || 'N/A';

            // [1.asi] firebaseInvoices
            const firebaseInvoices = allInvoicesByPO[poNumber] ? Object.entries(allInvoicesByPO[poNumber]).map(([key, value]) => ({
                key,
                ...value,
                source: 'firebase'
            })) : [];
            // [1.asj] firebasePackingSlips
            const firebasePackingSlips = new Set(firebaseInvoices.map(inv => String(inv.invNumber || '').trim().toLowerCase()).filter(Boolean));
            // [1.ask] ecommitInvoices
            const ecommitInvoices = allEcommit[poNumber] || [];
            // [1.asl] filteredEcommitInvoices
            const filteredEcommitInvoices = ecommitInvoices.filter(inv => {
                // [1.asm] csvInvNum
                const csvInvNum = String(inv.invNumber || '').trim().toLowerCase();
                return !csvInvNum || !firebasePackingSlips.has(csvInvNum);
            });

            // [1.asn] invoices
            let invoices = [...firebaseInvoices, ...filteredEcommitInvoices];

            // --- CALCULATE BALANCE FOR SORTING ---
            // [1.aso] totalInvSum
            let totalInvSum = 0;
            invoices.forEach(inv => totalInvSum += parseFloat(inv.invValue) || 0);
            // [1.asp] poVal
            const poVal = parseFloat(poDetails.Amount) || 0;
            // [1.asq] balance
            const balance = poVal - totalInvSum;

            // Filter Check: Negative Balance
            if (statusFilter === 'Negative Balance') {
                if (balance >= -0.01) continue;
            }

            // Invoice Sorting (Inner)
            invoices.sort((a, b) => {
                // [1.asr] dateA
                const dateA = new Date(a.invoiceDate || '2099-01-01');
                // [1.ass] dateB
                const dateB = new Date(b.invoiceDate || '2099-01-01');
                return (dateA - dateB) || (a.invNumber || '').localeCompare(b.invNumber || '');
            });

            invoices.forEach((inv, index) => {
                inv.invEntryID = `INV-${String(index + 1).padStart(2, '0')}`;
            });

            // [1.ast] calculatedTotalPaid
            let calculatedTotalPaid = 0;
            // [1.asu] latestPaidDateObj
            let latestPaidDateObj = null;

            for (const inv of invoices) {
                if (inv.status === 'Paid') {
                    calculatedTotalPaid += parseFloat(inv.amountPaid) || 0;
                    if (inv.releaseDate) {
                        // [1.asv] d
                        const d = new Date(normalizeDateForInput(inv.releaseDate));
                        if (!isNaN(d) && (!latestPaidDateObj || d > latestPaidDateObj)) latestPaidDateObj = d;
                    }
                }
            }

            // [1.asw] filteredInvoices
            const filteredInvoices = invoices.filter(inv => {
                if (statusFilter === 'Negative Balance') return true;
                // [1.asx] normRelease
                const normRelease = normalizeDateForInput(inv.releaseDate);
                // [1.asy] dateMatch
                const dateMatch = !monthFilter || (normRelease && normRelease.startsWith(monthFilter));
                // [1.asz] statusMatch
                const statusMatch = !statusFilter || inv.status === statusFilter;
                return dateMatch && statusMatch;
            });

            if (filteredInvoices.length > 0) {
                processedPOData.push({
                    poNumber,
                    poDetails,
                    site,
                    vendor,
                    filteredInvoices,
                    balance, // Store balance here
                    paymentData: {
                        totalPaidAmount: calculatedTotalPaid || 'N/A',
                        datePaid: latestPaidDateObj ? formatDate(latestPaidDateObj) : 'N/A'
                    }
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

// [1.ata] buildMobileReportView
function buildMobileReportView(reportData) {
    // [1.atb] container
    const container = document.getElementById('im-reporting-mobile-view');
    if (!container) return;

    // [1.atc] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    // [1.atd] isAccounting
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    // [1.ate] canViewAmounts
    const canViewAmounts = isAdmin || isAccounting;

    if (reportData.length === 0) {
        container.innerHTML = `<div class="im-mobile-empty-state"><i class="fa-solid fa-file-circle-question"></i><h3>No Results Found</h3><p>Try a different search.</p></div>`;
        return;
    }

    // [1.atf] mobileHTML
    let mobileHTML = '';

    reportData.forEach((poData, poIndex) => {
        const {
            poNumber,
            site,
            vendor,
            poDetails,
            filteredInvoices,
            balance
        } = poData;
        // [1.atg] toggleId
        const toggleId = `mobile-invoice-list-${poIndex}`;

        // Calculate Balance
        // [1.ath] balanceNum
        const balanceNum = balance !== undefined ? balance : ((parseFloat(poDetails.Amount) || 0) - filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.invValue) || 0), 0));

        // [1.ati] statusClass
        let statusClass = 'status-progress';
        // [1.atj] balanceStyle
        let balanceStyle = "";

        if (balanceNum < -0.01) {
            statusClass = 'status-pending'; // Red styling for negative
            balanceStyle = "color: #ff4d4d;";
        } else if (balanceNum > 0.01) {
            statusClass = 'status-open';
        } else {
            // [1.atk] allClose
            let allClose = filteredInvoices.length > 0;
            // [1.atl] closeStatuses
            const closeStatuses = ['With Accounts', 'Paid', 'Epicore Value'];
            for (const inv of filteredInvoices) {
                if (!closeStatuses.includes(inv.status)) allClose = false;
            }
            if (allClose) statusClass = 'status-close';
        }

        // [1.atm] poValueDisplay
        const poValueDisplay = canViewAmounts ? `QAR ${formatCurrency(parseFloat(poDetails.Amount))}` : '---';
        // [1.atn] balanceDisplay
        const balanceDisplay = canViewAmounts ? `QAR ${formatCurrency(balanceNum)}` : '---';

        // 1. Build PO Card
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

        // 2. Build Invoice List Items
        if (filteredInvoices.length === 0) {
            mobileHTML += `<li class="im-invoice-item-empty">No invoices recorded.</li>`;
        } else {
            filteredInvoices.forEach(inv => {
                // [1.ato] invValueDisplay
                const invValueDisplay = canViewAmounts ? `QAR ${formatCurrency(inv.invValue)}` : '---';
                // [1.atp] releaseDateDisplay
                const releaseDateDisplay = inv.releaseDate ? formatYYYYMMDD(inv.releaseDate) : '';
                // [1.atq] invDateDisplay
                const invDateDisplay = inv.invoiceDate ? formatYYYYMMDD(inv.invoiceDate) : '';

                // [1.atr] status
                const status = inv.status || 'Pending';
                // [1.ats] iconClass
                let iconClass = 'pending';
                // [1.att] iconChar
                let iconChar = '<i class="fa-solid fa-clock"></i>';

                if (status === 'Paid' || status === 'With Accounts') {
                    iconClass = 'paid';
                    iconChar = '<i class="fa-solid fa-check"></i>';
                }

                // PDF Links
                // [1.atu] actionsHTML
                let actionsHTML = '';
                if (inv.invName && inv.invName.toLowerCase() !== 'nil') {
                    actionsHTML += `<a href="${PDF_BASE_PATH}${encodeURIComponent(inv.invName)}.pdf" target="_blank" class="im-tx-action-btn invoice-pdf-btn">INV</a>`;
                }
                if (inv.srvName && inv.srvName.toLowerCase() !== 'nil') {
                    actionsHTML += `<a href="${SRV_BASE_PATH}${encodeURIComponent(inv.srvName)}.pdf" target="_blank" class="im-tx-action-btn srv-pdf-btn">SRV</a>`;
                }

                mobileHTML += `
                    <li class="im-invoice-item">
                        <div class="im-tx-icon ${iconClass}">${iconChar}</div>
                        <div class="im-tx-details">
                            <span class="im-tx-title">${inv.invNumber || 'No Inv#'}</span>
                            <span class="im-tx-subtitle">${inv.status}</span>
                            <span class="im-tx-date">Date: ${invDateDisplay}</span>
                        </div>
                        <div class="im-tx-amount">
                            <span class="im-tx-value ${iconClass}">${invValueDisplay}</span>
                            <div class="im-tx-actions">${actionsHTML}</div>
                        </div>
                    </li>
                 `;
            });
        }

        mobileHTML += `</ul></div></div>`;
    });
    container.innerHTML = mobileHTML;
}

// [1.atv] buildDesktopReportView
function buildDesktopReportView(reportData) {
    // [1.atw] container
    const container = document.getElementById('im-reporting-content');
    if (!container) return;

    // [1.atx] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    // [1.aty] isAccounting
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    if (reportData.length === 0) {
        container.innerHTML = '<p>No results found for your search criteria.</p>';
        return;
    }

    // [1.atz] tableHTML
    let tableHTML = `<table><thead><tr><th></th><th>PO</th><th>Site</th><th>Vendor</th><th>Value</th><th>Balance</th></tr></thead><tbody>`;

    // REMOVED: reportData.sort(...) -> We now use the Balance sort from populateInvoiceReporting

    reportData.forEach(poData => {
        // [1.aua] totalInvValue
        let totalInvValue = 0;
        // [1.aub] totalPaidWithRetention
        let totalPaidWithRetention = 0;
        // [1.auc] totalPaidWithoutRetention
        let totalPaidWithoutRetention = 0;
        // [1.aud] allWithAccounts
        let allWithAccounts = poData.filteredInvoices.length > 0;

        // [1.aue] detailRowId
        const detailRowId = `detail-${poData.poNumber}`;
        // [1.auf] isExpanded
        const isExpanded = (detailRowId === imLastExpandedRowId);
        // [1.aug] detailClass
        const detailClass = isExpanded ? 'detail-row' : 'detail-row hidden';
        // [1.auh] buttonText
        const buttonText = isExpanded ? '-' : '+';

        // [1.aui] nestedTableRows
        let nestedTableRows = '';

        poData.filteredInvoices.forEach(inv => {
            if (inv.status !== 'With Accounts') allWithAccounts = false;

            // [1.auj] invValue
            const invValue = parseFloat(inv.invValue) || 0;
            // [1.auk] amountPaid
            const amountPaid = parseFloat(inv.amountPaid) || 0;
            // [1.aul] noteText
            const noteText = (inv.note || '').toLowerCase();

            totalInvValue += invValue;
            totalPaidWithRetention += amountPaid;
            if (!noteText.includes('retention')) totalPaidWithoutRetention += amountPaid;

            // [1.aum] releaseDateDisplay
            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            // [1.aun] invoiceDateDisplay
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            // [1.auo] invValueDisplay
            const invValueDisplay = (isAdmin || isAccounting) ? formatCurrency(invValue) : '---';
            // [1.aup] amountPaidDisplay
            const amountPaidDisplay = (isAdmin || isAccounting) ? formatCurrency(amountPaid) : '---';

            // [1.auq] actionButtonsHTML
            let actionButtonsHTML = '';

            if (inv.source !== 'ecommit' && (isAdmin || isAccounting)) {
                // [1.aur] invPDFName
                const invPDFName = inv.invName || '';
                // [1.aus] invPDFLink
                const invPDFLink = (invPDFName.trim() && invPDFName.toLowerCase() !== 'nil') ? `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn" onclick="event.stopPropagation();">Invoice</a>` : '';
                // [1.aut] srvPDFName
                const srvPDFName = inv.srvName || '';
                // [1.auu] srvPDFLink
                const srvPDFLink = (srvPDFName.trim() && srvPDFName.toLowerCase() !== 'nil') ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="action-btn srv-pdf-btn" onclick="event.stopPropagation();">SRV</a>` : '';
                // [1.auv] historyBtn
                let historyBtn = (inv.history || inv.createdAt || inv.originTimestamp) ? `<button type="button" class="history-btn action-btn" onclick="event.stopPropagation(); showInvoiceHistory('${poData.poNumber}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>` : '';
                // [1.auw] editBtn
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

        // [1.aux] finalTotalPaid
        let finalTotalPaid = totalPaidWithoutRetention;
        if (Math.abs(totalPaidWithRetention - totalInvValue) < 0.01) finalTotalPaid = totalPaidWithRetention;

        // [1.auy] totalInvValueDisplay
        const totalInvValueDisplay = (isAdmin || isAccounting) ? `<strong>QAR ${formatCurrency(totalInvValue)}</strong>` : '---';
        // [1.auz] totalAmountPaidDisplay
        const totalAmountPaidDisplay = (isAdmin || isAccounting) ? `<strong>QAR ${formatCurrency(finalTotalPaid)}</strong>` : '---';
        // [1.ava] poValueDisplay
        const poValueDisplay = (isAdmin || isAccounting) ? (poData.poDetails.Amount ? `QAR ${formatCurrency(poData.poDetails.Amount)}` : 'N/A') : '---';

        // Use pre-calculated balance or re-calc here
        // [1.avb] balanceNum
        const balanceNum = poData.balance !== undefined ? poData.balance : ((parseFloat(poData.poDetails.Amount) || 0) - totalInvValue);
        // [1.avc] balanceDisplay
        const balanceDisplay = (isAdmin || isAccounting) ? `QAR ${formatCurrency(balanceNum)}` : '---';

        // [1.avd] highlightClass
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

// [1.ave] handleGeneratePrintReport
function handleGeneratePrintReport() {
    if (currentReportData.length === 0) {
        alert("No data to print. Please run a search first.");
        return;
    }

    // [1.avf] isAdmin
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    // [1.avg] isAccounting
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    if (!isAdmin && !isAccounting) {
        alert("You do not have permission to print this report.");
        return;
    }

    // [1.avh] siteFilter
    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    // [1.avi] statusFilter
    const statusFilter = document.getElementById('im-reporting-status-filter').value;
    // [1.avj] title
    let title = "Invoice Records";
    if (siteFilter && !statusFilter) title = `Invoice Report for Site: ${siteFilter}`;
    if (statusFilter && !siteFilter) title = `Invoice Report - Status: ${statusFilter}`;
    if (siteFilter && statusFilter) title = `Invoice Report for Site: ${siteFilter} (Status: ${statusFilter})`;

    imPrintReportTitle.textContent = title;
    imPrintReportDate.textContent = `Generated on: ${new Date().toLocaleString('en-GB')}`;

    // [1.avk] totalPOs
    let totalPOs = currentReportData.length;
    // [1.avl] totalReportValue
    let totalReportValue = 0;
    // [1.avm] totalReportInvValue
    let totalReportInvValue = 0;

    currentReportData.forEach(po => {
        totalReportValue += parseFloat(po.poDetails.Amount) || 0;
        po.filteredInvoices.forEach(inv => {
            totalReportInvValue += parseFloat(inv.invValue) || 0;
        });
    });

    // [1.avn] totalBalance
    const totalBalance = totalReportValue - totalReportInvValue;

    imPrintReportSummaryPOs.textContent = totalPOs;
    imPrintReportSummaryValue.textContent = `QAR ${formatCurrency(totalReportValue)}`;

    if (imPrintReportSummaryPaid) {
        // [1.avo] parentDiv
        const parentDiv = imPrintReportSummaryPaid.parentElement;
        if (parentDiv) {
            // [1.avp] labelSpan
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
        // [1.avq] poContainer
        const poContainer = document.createElement('div');
        poContainer.className = 'print-po-container';

        // [1.avr] totalInvValue
        let totalInvValue = 0;
        // [1.avs] totalAmountPaid
        let totalAmountPaid = 0;

        po.filteredInvoices.forEach(inv => {
            totalInvValue += parseFloat(inv.invValue) || 0;
            totalAmountPaid += parseFloat(inv.amountPaid) || 0;
        });

        // [1.avt] poValueNum
        const poValueNum = parseFloat(po.poDetails.Amount) || 0;
        // [1.avu] balanceNum
        const balanceNum = poValueNum - totalInvValue;

        // [1.avv] poHeader
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

        // [1.avw] invoicesTableHTML
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
            // [1.avx] invValue
            const invValue = parseFloat(inv.invValue) || 0;
            // [1.avy] status
            const status = inv.status || '';

            // [1.avz] releaseDateDisplay
            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            // [1.awa] invoiceDateDisplay
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
        // [1.awb] parentDiv
        const parentDiv = imPrintReportSummaryPaid.parentElement;
        // [1.awc] labelSpan
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
    // [1.awd] isAccountingPosition
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
        alert("You do not have permission to download this report.");
        return;
    }
    if (currentReportData.length === 0) {
        alert("No data to download. Please perform a search first.");
        return;
    }
    // [1.awe] csvContent
    let csvContent = "data:text/csv;charset=utf-8,";
    // [1.awf] headers
    const headers = ["PO", "Site", "Vendor", "PO Value", "Total Paid Amount", "Last Paid Date", "invEntryID", "invNumber", "invoiceDate", "invValue", "amountPaid", "invName", "srvName", "attention", "releaseDate", "status", "note"];
    csvContent += headers.join(",") + "\r\n";
    currentReportData.forEach(po => {
        // [1.awg] totalPaidCSV
        const totalPaidCSV = (po.paymentData.totalPaidAmount !== 'N/A' ? po.paymentData.totalPaidAmount : '');
        // [1.awh] datePaidCSV
        const datePaidCSV = (po.paymentData.datePaid !== 'N/A' ? po.paymentData.datePaid : '');
        po.filteredInvoices.forEach(inv => {
            // [1.awi] row
            const row = [po.poNumber, po.site, `"${(po.vendor || '').replace(/"/g, '""')}"`, po.poDetails.Amount || '0', totalPaidCSV, datePaidCSV, inv.invEntryID || '', `"${(inv.invNumber || '').replace(/"/g, '""')}"`, inv.invoiceDate || '', inv.invValue || '0', inv.amountPaid || '0', `"${(inv.invName || '').replace(/"/g, '""')}"`, `"${(inv.srvName || '').replace(/"/g, '""')}"`, inv.attention || '', inv.releaseDate || '', inv.status || '', `"${(inv.note || '').replace(/"/g, '""')}"`];
            csvContent += row.join(",") + "\r\n";
        });
    });
    // [1.awj] encodedUri
    const encodedUri = encodeURI(csvContent);
    // [1.awk] link
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

// Updated Daily Report (More robust timestamp checking)
async function handleDownloadDailyReport() {
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
        alert("You do not have permission to download this report.");
        return;
    }

    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

    try {
        await ensureInvoiceDataFetched(true);

        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for report.");

        let recentEntries = [];

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];

                // 1. FIX: Handle both number and string timestamps safeley
                let creationTime = inv.createdAt || inv.timestamp || 0;
                if (typeof creationTime === 'string') {
                    creationTime = new Date(creationTime).getTime();
                }

                // Check if created within the last 2 hours
                if (creationTime > twoHoursAgo) {
                    recentEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?. ['Project ID'] || 'N/A',
                        ...inv,
                        sortTime: creationTime
                    });
                }
            }
        }

        if (recentEntries.length === 0) {
            alert("No new invoices found in the last 2 hours.");
            return;
        }

        recentEntries.sort((a, b) => a.sortTime - b.sortTime);

        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Time", "PO", "Site", "Inv No", "Inv Name", "Inv Amount", "Amount Paid", "Status"];
        csvContent += headers.join(",") + "\r\n";

        recentEntries.forEach(entry => {
            let timeString = '';
            if (entry.createdAt) {
                const dateObj = new Date(entry.createdAt);
                if (!isNaN(dateObj.getTime())) {
                    timeString = dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
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
        link.setAttribute("download", `entry_report_last_2hrs_${timestampStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating report:", error);
        alert("An error occurred while generating the report.");
    }
}

// Updated With Accounts Report (Checks Release Date OR Creation Time)
async function handleDownloadWithAccountsReport() {
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
        alert("You do not have permission to download this report.");
        return;
    }

    // 1. Setup Time Checkers
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    const todayStr = getTodayDateString(); // Gets "YYYY-MM-DD" for today

    try {
        await ensureInvoiceDataFetched(true);

        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for report.");

        let recentEntries = [];

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];

                // 2. Normalize Timestamp (Handle strings or numbers)
                let creationTime = inv.createdAt || inv.timestamp || 0;
                if (typeof creationTime === 'string') creationTime = new Date(creationTime).getTime();

                // 3. THE FIX: Check if Created Recently OR Released Today
                const isRecent = (creationTime > twoHoursAgo);
                const isReleasedToday = (inv.releaseDate === todayStr);

                // Only include if status is correct AND (it's new OR it was updated today)
                if (inv.status === 'With Accounts' && (isRecent || isReleasedToday)) {
                    recentEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?. ['Project ID'] || 'N/A',
                        ...inv,
                        sortTime: creationTime
                    });
                }
            }
        }

        if (recentEntries.length === 0) {
            alert("No 'With Accounts' invoices found from Today or the last 2 hours.");
            return;
        }

        // Sort Ascending
        recentEntries.sort((a, b) => a.sortTime - b.sortTime);

        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Time", "PO", "Site", "Inv No", "SRV Name", "Inv Amount", "Amount Paid", "Status"];
        csvContent += headers.join(",") + "\r\n";

        recentEntries.forEach(entry => {
            let timeString = '';
            if (entry.createdAt) {
                const dateObj = new Date(entry.createdAt);
                if (!isNaN(dateObj.getTime())) {
                    timeString = dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
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
                entry.status || ''
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `with_accounts_report_${timestampStr}.csv`);
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
                // [1.axr] snapshot
                const snapshot = await db.ref('approvers').once('value');
                allApproverData = snapshot.val();
            }
            // [1.axs] approvers
            const approvers = allApproverData;
            if (approvers) {
                // [1.axt] approverOptions
                const approverOptions = Object.values(approvers)
                    .map(approver => {
                        if (!approver.Name) return null;
                        // [1.axu] name
                        const name = approver.Name;
                        // [1.axv] position
                        const position = approver.Position || 'No-Pos';
                        // [1.axw] site
                        const site = approver.Site || 'No-Site';
                        // [1.axx] newLabel
                        const newLabel = `${name} - ${position} - ${site}`;
                        return {
                            value: name,
                            label: newLabel
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.label.localeCompare(b.label));
                approverListForSelect = [{
                    value: '',
                    label: 'Select Attention',
                    placeholder: true
                }, {
                    value: 'None',
                    label: 'None (Clear)'
                }, ...approverOptions];
            } else {
                approverListForSelect = [{
                    value: '',
                    label: 'No approvers found',
                    placeholder: true
                }];
            }
        } catch (error) {
            console.error("Error fetching approvers for select:", error);
            approverListForSelect = [{
                value: '',
                label: 'Error loading',
                placeholder: true
            }];
        }
    }

    selectElement.innerHTML = '';
    approverListForSelect.forEach(opt => {
        // [1.axy] option
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

// [1.axz] updateBatchCount
function updateBatchCount() {
    if (batchCountDisplay) {
        // [1.aya] rows
        const rows = batchTableBody.querySelectorAll('tr');
        batchCountDisplay.textContent = `Total in Batch: ${rows.length}`;
    }
}

async function handleAddPOToBatch() {
    // [1.ayb] batchPOInput
    const batchPOInput = document.getElementById('im-batch-po-input');
    // [1.ayc] poNumber
    const poNumber = batchPOInput.value.trim().toUpperCase();
    if (!poNumber) {
        alert("Please enter a PO Number.");
        return;
    }

    sessionStorage.setItem('imBatchSearch', poNumber);
    sessionStorage.removeItem('imBatchNoteSearch');

    // [1.ayd] batchTableBody
    const batchTableBody = document.getElementById('im-batch-table-body');
    // [1.aye] existingRows
    const existingRows = batchTableBody.querySelectorAll(`tr[data-po="${poNumber}"]`);
    // [1.ayf] isExistingInvoice
    let isExistingInvoice = false;
    existingRows.forEach(row => {
        if (!row.dataset.key) isExistingInvoice = true;
    });
    if (isExistingInvoice) {
        alert(`A new invoice for PO ${poNumber} is already in the batch list.`);
        return;
    }

    try {
        await ensureInvoiceDataFetched();
        // [1.ayg] poData
        const poData = allPOData[poNumber];
        if (!poData) {
            alert(`PO Number ${poNumber} not found.`);
            return;
        }
        // [1.ayh] invoiceData
        const invoiceData = allInvoiceData[poNumber];

        // [1.ayi] maxInvIdNum
        let maxInvIdNum = 0;
        if (invoiceData) {
            Object.values(invoiceData).forEach(inv => {
                if (inv.invEntryID) {
                    // [1.ayj] idNum
                    const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                    if (!isNaN(idNum) && idNum > maxInvIdNum) {
                        maxInvIdNum = idNum;
                    }
                }
            });
        }
        // [1.ayk] nextInvId
        const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;

        // [1.ayl] site
        const site = poData['Project ID'] || 'N/A';
        // [1.aym] vendor
        const vendor = poData['Supplier Name'] || 'N/A';
        // [1.ayn] row
        const row = document.createElement('tr');
        row.setAttribute('data-po', poNumber);
        row.setAttribute('data-site', site);
        row.setAttribute('data-vendor', vendor);
        row.setAttribute('data-next-invid', nextInvId);

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

        // [1.ayo] attentionSelect
        const attentionSelect = row.querySelector('select[name="attention"]');
        // [1.ayp] statusSelect
        const statusSelect = row.querySelector('select[name="status"]');
        // [1.ayq] noteInput
        const noteInput = row.querySelector('input[name="note"]');

        await populateApproverSelect(attentionSelect);

        // [1.ayr] choices
        const choices = new Choices(attentionSelect, {
            searchEnabled: true,
            shouldSort: false,
            itemSelectText: '',
            removeItemButton: true
        });
        row.choicesInstance = choices;

        // --- THE FIX IS HERE ---
        // [1.ays] globalAttnValue
        const globalAttnValue = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;
        if (globalAttnValue) {
            // Must pass as an array [value] to prevent library errors
            choices.setValue([globalAttnValue]);
        }
        // -----------------------

        if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
        if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;

        updateBatchCount();

        batchPOInput.value = '';
        batchPOInput.focus();
    } catch (error) {
        console.error("Error adding PO to batch:", error);
        alert('An error occurred while adding the PO.');
    }
}

async function addInvoiceToBatchTable(invData) {
    // [1.ayt] batchTableBody
    const batchTableBody = document.getElementById('im-batch-table-body');
    if (batchTableBody.querySelector(`tr[data-key="${invData.key}"]`)) return;

    // [1.ayu] row
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

    // [1.ayv] attentionSelect
    const attentionSelect = row.querySelector('select[name="attention"]');
    // [1.ayw] statusSelect
    const statusSelect = row.querySelector('select[name="status"]');
    // [1.ayx] noteInput
    const noteInput = row.querySelector('input[name="note"]');

    statusSelect.value = invData.status || 'For SRV';

    await populateApproverSelect(attentionSelect);

    // [1.ayy] choices
    const choices = new Choices(attentionSelect, {
        searchEnabled: true,
        shouldSort: false,
        itemSelectText: '',
        removeItemButton: true
    });
    row.choicesInstance = choices;

    // --- FIX STARTS HERE ---
    // [1.ayz] globalAttentionVal
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
    // [1.aza] batchPOInput
    const batchPOInput = document.getElementById('im-batch-po-input');
    // [1.azb] searchTerm
    const searchTerm = batchPOInput.value.trim();
    if (searchType === 'status' && !searchTerm) {
        alert(`Please enter a ${searchType} to search for.`);
        return;
    }

    // [1.azc] noteSearchTerm
    let noteSearchTerm = '';
    if (searchType === 'note') {
        if (!imBatchNoteSearchChoices) {
            alert("Note search is not ready.");
            return;
        }
        noteSearchTerm = imBatchNoteSearchChoices.getValue(true);
        if (!noteSearchTerm) {
            alert("Please select a note from the dropdown to search.");
            return;
        }
    }

    // [1.azd] finalSearchTerm
    const finalSearchTerm = (searchType === 'note') ? noteSearchTerm : searchTerm;

    if (searchType === 'status') {
        sessionStorage.setItem('imBatchSearch', searchTerm);
        sessionStorage.removeItem('imBatchNoteSearch');
    } else if (searchType === 'note') {
        sessionStorage.setItem('imBatchNoteSearch', noteSearchTerm);
        sessionStorage.removeItem('imBatchSearch');
    }

    if (!confirm(`This will scan all locally cached invoices.\n\nContinue searching for all invoices with ${searchType} "${finalSearchTerm}"?`)) return;

    batchPOInput.disabled = true;
    const originalPlaceholder = batchPOInput.placeholder;
    batchPOInput.placeholder = 'Searching local cache...';
    if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.disable();

    try {
        await ensureInvoiceDataFetched();
        // [1.aze] allPOs
        const allPOs = allPOData,
            allInvoicesByPO = allInvoiceData;
        // [1.azf] invoicesFound
        let invoicesFound = 0;
        const promises = [];
        for (const poNumber in allInvoicesByPO) {
            // [1.azg] invoices
            const invoices = allInvoicesByPO[poNumber],
                poData = allPOs[poNumber] || {},
                site = poData['Project ID'] || 'N/A',
                vendor = poData['Supplier Name'] || 'N/A';
            for (const key in invoices) {
                // [1.azh] inv
                const inv = invoices[key];
                let isMatch = false;

                if (searchType === 'status' && inv.status && inv.status.toLowerCase() === finalSearchTerm.toLowerCase()) isMatch = true;
                else if (searchType === 'note' && inv.note && inv.note === finalSearchTerm) isMatch = true;

                if (isMatch) {
                    invoicesFound++;
                    const invData = {
                        key,
                        po: poNumber,
                        site,
                        vendor,
                        ...inv
                    };
                    promises.push(addInvoiceToBatchTable(invData));
                }
            }
        }
        await Promise.all(promises);
        if (invoicesFound === 0) alert(`No invoices found with the ${searchType} "${finalSearchTerm}".`);
        else {
            alert(`Added ${invoicesFound} invoice(s) to the batch list.`);
        }
    } catch (error) {
        console.error("Error during global batch search:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        batchPOInput.disabled = false;
        batchPOInput.placeholder = originalPlaceholder;
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.enable();
    }
}

async function handleSaveBatchInvoices() {
    // [1.azi] rows
    const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
    if (rows.length === 0) {
        alert("There are no invoices to save.");
        return;
    }
    if (!confirm(`You are about to save/update ${rows.length} invoice(s). Continue?`)) return;

    // [1.azj] savePromises
    const savePromises = [];
    // [1.azk] localCacheUpdates
    const localCacheUpdates = [];
    // [1.azl] newInvoicesCount
    let newInvoicesCount = 0,
        updatedInvoicesCount = 0;

    // [1.azm] getSrvName
    const getSrvName = (poNumber, site, vendor, invEntryID) => {
        // [1.azn] today
        const today = new Date(),
            yyyy = today.getFullYear(),
            mm = String(today.getMonth() + 1).padStart(2, '0'),
            dd = String(today.getDate()).padStart(2, '0');
        if (vendor.length > 21) vendor = vendor.substring(0, 21);
        // [1.azo] invID
        const invID = invEntryID || 'INV-XX';
        return `${yyyy}${mm}${dd}-${poNumber}-${invID}-${site}-${vendor}`;
    };

    await ensureInvoiceDataFetched();

    for (const row of rows) {
        // [1.azp] poNumber
        const poNumber = row.dataset.po,
            site = row.dataset.site,
            existingKey = row.dataset.key;
        let vendor = row.dataset.vendor;
        // [1.azq] invEntryID
        let invEntryID = row.dataset.nextInvid;

        if (existingKey) {
            // [1.azr] existingIDSpan
            const existingIDSpan = row.querySelector('span.existing-indicator');
            if (existingIDSpan) {
                // [1.azs] match
                const match = existingIDSpan.textContent.match(/\(Existing: (.*)\)/);
                if (match && match[1]) invEntryID = match[1];
            }
        }

        // [1.azt] invoiceData
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
        if (!invoiceData.invValue) {
            alert(`Invoice Value is required for PO ${poNumber}. Cannot proceed.`);
            return;
        }
        if (vendor.length > 21) vendor = vendor.substring(0, 21);

        // [1.azu] srvNameLower
        const srvNameLower = (invoiceData.srvName || '').toLowerCase();
        if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
            invoiceData.srvName = getSrvName(poNumber, site, vendor, invEntryID);
        }

        let promise;
        // [1.azv] oldAttention
        let oldAttention = null;

        if (existingKey) {
            if (allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) {
                oldAttention = allInvoiceData[poNumber][existingKey].attention;
            }

            promise = invoiceDb.ref(`invoice_entries/${poNumber}/${existingKey}`).update(invoiceData);

            savePromises.push(updateInvoiceTaskLookup(poNumber, existingKey, invoiceData, oldAttention));

            localCacheUpdates.push({
                type: 'update',
                po: poNumber,
                key: existingKey,
                data: invoiceData
            });
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
                    // [1.azw] newKey
                    const newKey = newRef.key;
                    // [1.azx] cacheUpdate
                    const cacheUpdate = localCacheUpdates.find(upd => upd.promise === promise);
                    if (cacheUpdate) cacheUpdate.newKey = newKey;

                    return updateInvoiceTaskLookup(poNumber, newKey, invoiceData, null);
                })
            );

            localCacheUpdates.push({
                type: 'add',
                po: poNumber,
                data: invoiceData,
                promise: promise
            });
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
                    // [1.azy] newKey
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
    // [1.azz] modalPOSearchInput
    const modalPOSearchInput = document.getElementById('im-batch-modal-po-input');
    // [1.baa] modalResultsContainer
    const modalResultsContainer = document.getElementById('im-batch-modal-results');
    // [1.bab] poNumber
    const poNumber = modalPOSearchInput.value.trim().toUpperCase();
    if (!poNumber) return;
    modalResultsContainer.innerHTML = '<p>Searching...</p>';
    try {
        await ensureInvoiceDataFetched();
        // [1.bac] poData
        const poData = allPOData[poNumber],
            invoicesData = allInvoiceData[poNumber];
        if (!invoicesData) {
            modalResultsContainer.innerHTML = '<p>No invoices found for this PO.</p>';
            return;
        }
        // [1.bad] site
        const site = poData ? poData['Project ID'] || 'N/A' : 'N/A',
            vendor = poData ? poData['Supplier Name'] || 'N/A' : 'N/A';
        // [1.bae] tableHTML
        let tableHTML = `<table><thead><tr><th><input type="checkbox" id="modal-select-all"></th><th>Inv. Entry ID</th><th>Inv. No.</th><th>Inv. Value</th><th>Status</th></tr></thead><tbody>`;
        // [1.baf] sortedInvoices
        const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        for (const [key, inv] of sortedInvoices) {
            // [1.bag] invDataString
            const invDataString = encodeURIComponent(JSON.stringify({
                key,
                po: poNumber,
                site,
                vendor,
                ...inv
            }));
            tableHTML += `<tr><td><input type="checkbox" class="modal-inv-checkbox" data-invoice='${invDataString}'></td><td>${inv.invEntryID || ''}</td><td>${inv.invNumber || ''}</td><td>${formatCurrency(inv.invValue)}</td><td>${inv.status || ''}</td></tr>`;
        }
        tableHTML += `</tbody></table>`;
        modalResultsContainer.innerHTML = tableHTML;
        document.getElementById('modal-select-all').addEventListener('change', (e) => {
            modalResultsContainer.querySelectorAll('.modal-inv-checkbox').forEach(chk => chk.checked = e.target.checked);
        });
    } catch (error) {
        console.error("Error searching in batch modal:", error);
        modalResultsContainer.innerHTML = '<p>An error occurred.</p>';
    }
}

async function handleAddSelectedToBatch() {
    // [1.bah] selectedCheckboxes
    const selectedCheckboxes = document.getElementById('im-batch-modal-results').querySelectorAll('.modal-inv-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert("Please select at least one invoice.");
        return;
    }

    // Optional: Change button text briefly
    // [1.bai] addBtn
    const addBtn = document.getElementById('im-batch-modal-add-selected-btn');
    if (addBtn) addBtn.textContent = "Adding...";

    try {
        // [1.baj] promises
        const promises = [];
        for (const checkbox of selectedCheckboxes) {
            try {
                // [1.bak] invData
                const invData = JSON.parse(decodeURIComponent(checkbox.dataset.invoice));
                promises.push(addInvoiceToBatchTable(invData));
            } catch (err) {
                console.error("Row error:", err);
            }
        }

        await Promise.all(promises);

        // --- SPEED WORKFLOW UPDATE ---
        // [1.bal] searchInput
        const searchInput = document.getElementById('im-batch-modal-po-input');
        // [1.bam] resultsContainer
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
        // [1.ban] sortedNotes
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            // [1.bao] option
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });
        return;
    }
    try {
        await ensureInvoiceDataFetched();
        noteSuggestionsDatalist.innerHTML = '';
        // [1.bap] sortedNotes
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            // [1.baq] option
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
        // [1.bar] sortedNotes
        const sortedNotes = Array.from(allUniqueNotes).sort();
        // [1.bas] noteOptions
        const noteOptions = sortedNotes.map(note => ({
            value: note,
            label: note
        }));

        choicesInstance.setChoices(
            [
                {
                    value: '',
                    label: 'Select a note to search...',
                    disabled: true
                },
                ...noteOptions
            ],
            'value',
            'label',
            true
        );
        return;
    }

    choicesInstance.setChoices([{
        value: '',
        label: 'Loading notes...',
        disabled: true
    }]);
    try {
        await ensureInvoiceDataFetched();

        // [1.bat] sortedNotes
        const sortedNotes = Array.from(allUniqueNotes).sort();
        // [1.bau] noteOptions
        const noteOptions = sortedNotes.map(note => ({
            value: note,
            label: note
        }));

        choicesInstance.setChoices(
            [
                {
                    value: '',
                    label: 'Select a note to search...',
                    disabled: true
                },
                ...noteOptions
            ],
            'value',
            'label',
            true
        );
    } catch (error) {
        console.error("Error populating note dropdown:", error);
        choicesInstance.setChoices([{
            value: '',
            label: 'Error loading notes',
            disabled: true
        }]);
    }
}

async function handleGenerateSummary() {
    // [1.bav] getOrdinal
    const getOrdinal = (n) => {
        if (isNaN(n) || n <= 0) return '';
        // [1.baw] s
        const s = ["th", "st", "nd", "rd"];
        // [1.bax] v
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    // [1.bay] prevNote
    const prevNote = summaryNotePreviousInput.value.trim();
    // [1.baz] currentNote
    const currentNote = summaryNoteCurrentInput.value.trim();

    sessionStorage.setItem('imSummaryPrevNote', prevNote);
    sessionStorage.setItem('imSummaryCurrNote', currentNote);

    if (!currentNote) {
        alert("Please enter a note for the 'Current Note' search.");
        return;
    }

    summaryNoteGenerateBtn.textContent = 'Generating...';
    summaryNoteGenerateBtn.disabled = true;

    try {
        await ensureInvoiceDataFetched();
        // [1.bba] allInvoicesByPO
        const allInvoicesByPO = allInvoiceData;
        // [1.bbb] allPOs
        const allPOs = allPOData;

        // This variable holds the data from Ecost.csv
        // [1.bbc] epicoreData
        const epicoreData = allEpicoreData;

        // [1.bbd] previousPaymentTotal
        let previousPaymentTotal = 0;
        // [1.bbe] currentPaymentTotal
        let currentPaymentTotal = 0;
        // [1.bbf] allCurrentInvoices
        let allCurrentInvoices = [];

        // [1.bbg] srvNameForQR
        let srvNameForQR = null;
        // [1.bbh] foundSrv
        let foundSrv = false;

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];

                // --- 1. Previous Payment Logic (FIXED) ---
                // Only sum if prevNote is NOT empty AND matches the invoice note
                if (prevNote !== "" && inv.note === prevNote) {
                    previousPaymentTotal += parseFloat(inv.invValue) || 0;

                    if (!foundSrv && inv.srvName && inv.srvName.toLowerCase() !== 'nil' && inv.srvName.trim() !== '') {
                        srvNameForQR = inv.srvName;
                        foundSrv = true;
                    }
                }

                // --- 2. Current Payment Logic ---
                if (inv.note === currentNote) {
                    const vendorName = (allPOs[poNumber] && allPOs[poNumber]['Supplier Name']) ? allPOs[poNumber]['Supplier Name'] : 'N/A';
                    const site = (allPOs[poNumber] && allPOs[poNumber]['Project ID']) ? allPOs[poNumber]['Project ID'] : 'N/A';
                    currentPaymentTotal += parseFloat(inv.invValue) || 0;
                    allCurrentInvoices.push({
                        po: poNumber,
                        key: key,
                        site,
                        vendor: vendorName,
                        ...inv
                    });
                }
            }
        }

        // [1.bbm] count
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
        // [1.bbn] qrElement
        const qrElement = document.getElementById('sn-prev-summary-qr');
        if (qrElement) {
            qrElement.innerHTML = '';
            if (srvNameForQR) {
                try {
                    // [1.bbo] pdfUrl
                    const pdfUrl = SRV_BASE_PATH + encodeURIComponent(srvNameForQR) + ".pdf";
                    new QRCode(qrElement, {
                        text: pdfUrl,
                        width: 60,
                        height: 60,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.L
                    });
                } catch (e) {
                    console.error("QR generation failed:", e);
                }
            }
        }

        allCurrentInvoices.sort((a, b) => (a.site || '').localeCompare(b.site || ''));
        // [1.bbp] vendorData
        const vendorData = allPOs[allCurrentInvoices[0].po];
        snVendorName.textContent = vendorData ? vendorData['Supplier Name'] : 'N/A';

        // [1.bbq] today
        const today = new Date();
        snDate.textContent = `Date: ${today.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).replace(/ /g, '-')}`;

        snPreviousPayment.textContent = `${formatCurrency(previousPaymentTotal)} Qatari Riyals`;
        snCurrentPayment.textContent = `${formatCurrency(currentPaymentTotal)} Qatari Riyals`;
        snTableBody.innerHTML = '';

        for (const inv of allCurrentInvoices) {
            // [1.bbr] row
            const row = document.createElement('tr');
            row.setAttribute('data-po', inv.po);
            row.setAttribute('data-key', inv.key);

            // [1.bbs] poKey
            const poKey = inv.po.toUpperCase();

            // --- UPDATED DESCRIPTION FETCHING LOGIC ---
            // 1. Try Ecost.csv (Epicore) using PO Key
            // 2. If not found, use Invoice Details
            // 3. Fallback to empty string
            // [1.bbt] rawDescription
            let rawDescription = (epicoreData && epicoreData[poKey]) ? epicoreData[poKey] : (inv.details || '');

            // Ensure it is a string
            rawDescription = String(rawDescription);

            // [1.bbu] truncatedDescription
            let truncatedDescription = rawDescription;

            // Cut to 20 characters as requested
            if (rawDescription.length > 20) {
                truncatedDescription = rawDescription.substring(0, 20) + "...";
            }
            // ------------------------------------------

            // [1.bbv] invCountDisplay
            let invCountDisplay = '';
            if (inv.invEntryID) {
                // [1.bbw] match
                const match = inv.invEntryID.match(/INV-(\d+)/i);
                if (match && match[1]) {
                    // [1.bbx] num
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
    // [1.bby] rows
    const rows = snTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("No data to update.");
        return;
    }
    if (!confirm("Are you sure you want to save the changes for all visible entries?")) return;
    summaryNoteUpdateBtn.textContent = "Updating...";
    summaryNoteUpdateBtn.disabled = true;
    // [1.bbz] newGlobalStatus
    const newGlobalStatus = document.getElementById('summary-note-status-input').value,
        newGlobalSRV = document.getElementById('summary-note-srv-input').value.trim(),
        today = getTodayDateString();

    // [1.bca] updatePromises
    const updatePromises = [];
    // [1.bcb] localCacheUpdates
    const localCacheUpdates = [];

    try {
        await ensureInvoiceDataFetched();

        for (const row of rows) {
            // [1.bcc] poNumber
            const poNumber = row.dataset.po,
                invoiceKey = row.dataset.key;
            // [1.bcd] newDetails
            const newDetails = row.querySelector('input[name="details"]').value,
                newInvoiceDate = row.querySelector('input[name="invoiceDate"]').value;
            if (poNumber && invoiceKey) {
                // [1.bce] updates
                const updates = {
                    details: newDetails,
                    invoiceDate: newInvoiceDate,
                    releaseDate: today
                };
                if (newGlobalStatus) updates.status = newGlobalStatus;

                if (newGlobalSRV) {
                    updates.srvName = newGlobalSRV;
                }

                if (newGlobalStatus === 'With Accounts') updates.attention = '';

                updatePromises.push(invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates));
                localCacheUpdates.push({
                    po: poNumber,
                    key: invoiceKey,
                    data: updates
                });

                // [1.bcf] originalInvoice
                const originalInvoice = (allInvoiceData && allInvoiceData[poNumber]) ? allInvoiceData[poNumber][invoiceKey] : {};
                // [1.bcg] updatedInvoiceData
                const updatedInvoiceData = {
                    ...originalInvoice,
                    ...updates
                };
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
    } finally {
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
    // [1.bch] dashboardSection
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

    // [1.bci] topVendorsList
    const topVendorsList = document.getElementById('top-vendors-list');
    // [1.bcj] topProjectsList
    const topProjectsList = document.getElementById('top-projects-list');
    // [1.bck] topActivitiesList
    const topActivitiesList = document.getElementById('top-activities-list');
    // [1.bcl] yearSelect
    const yearSelect = document.getElementById('im-yearly-chart-year-select');

    // [1.bcm] showLoading
    const showLoading = (list) => {
        if (list) list.innerHTML = '<li>Loading...</li>';
    };
    showLoading(topVendorsList);
    showLoading(topProjectsList);
    showLoading(topActivitiesList);

    try {
        // [1.bcn] data
        const data = await ensureEcostDataFetched(forceRefresh);

        if (!data) {
            dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please try again later.</p>';
            return;
        }

        // [1.bco] yearlyData
        const yearlyData = {};
        // [1.bcp] availableYears
        const availableYears = new Set();

        data.forEach(row => {
            // [1.bcq] year
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
                // [1.bcr] month
                const month = row['Month'];
                if (month !== null) {
                    yearlyData[year]['Total Committed'][month] += row['Total Committed'];
                    yearlyData[year]['Delivered Amount'][month] += row['Delivered Amount'];
                    yearlyData[year]['Outstanding'][month] += row['Outstanding'];
                }
            }
        });

        // [1.bcs] sortedYears
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
            // [1.bct] option
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        // [1.bcu] updateTop5Lists
        const updateTop5Lists = (selectedYear) => {
            // [1.bcv] yearData
            const yearData = allEcostData.filter(row => row['Year'] === selectedYear);

            // [1.bcw] getTop5
            const getTop5 = (data, keyField, valueField) => {
                // [1.bcx] aggregated
                const aggregated = data.reduce((acc, row) => {
                    // [1.bcy] key
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

            // [1.bcz] renderTop5List
            const renderTop5List = (listElement, data) => {
                if (!listElement) return;
                listElement.innerHTML = '';
                if (data.length === 0) {
                    listElement.innerHTML = '<li>No data found.</li>';
                    return;
                }
                data.forEach(([name, value]) => {
                    // [1.bda] li
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

        // [1.bdb] renderYearlyChart
        const renderYearlyChart = (selectedYear) => {
            // [1.bdc] ctx
            const ctx = document.getElementById('imYearlyChartCanvas').getContext('2d');
            // [1.bdd] dataForYear
            const dataForYear = yearlyData[selectedYear];

            if (imYearlyChart) {
                imYearlyChart.destroy();
            }

            // [1.bde] colors
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
                                label: function (context) {
                                    // [1.bdf] label
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
                                callback: function (value) {
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

        // [1.bdg] initialYear
        const initialYear = parseInt(sortedYears[0]);
        renderYearlyChart(initialYear);
        updateTop5Lists(initialYear);

        yearSelect.addEventListener('change', (e) => {
            // [1.bdh] selectedYear
            const selectedYear = parseInt(e.target.value);
            renderYearlyChart(selectedYear);
            updateTop5Lists(selectedYear);
        });

        // [1.bdi] refreshBtn
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

// [1.bdj] updatePaymentModalTotal
function updatePaymentModalTotal() {
    // [1.bdk] modalResultsContainer
    const modalResultsContainer = document.getElementById('im-payment-modal-results');
    // [1.bdl] checkboxes
    const checkboxes = modalResultsContainer.querySelectorAll('.payment-modal-inv-checkbox:checked');

    // [1.bdm] totalDisplay
    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (!totalDisplay) return;

    // [1.bdn] totalSum
    let totalSum = 0;
    checkboxes.forEach(checkbox => {
        // [1.bdo] row
        const row = checkbox.closest('tr');
        if (row) {
            // [1.bdp] invValueCell
            const invValueCell = row.cells[2].textContent;
            // [1.bdq] value
            const value = parseFloat(String(invValueCell).replace(/,/g, ''));
            if (!isNaN(value)) {
                totalSum += value;
            }
        }
    });
    totalDisplay.textContent = formatCurrency(totalSum);
}

async function handlePaymentModalPOSearch() {
    // [1.bdr] poNumber
    const poNumber = imPaymentModalPOInput.value.trim().toUpperCase();

    // [1.bds] totalDisplay
    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (totalDisplay) totalDisplay.textContent = formatCurrency(0);

    if (!poNumber) {
        imPaymentModalResults.innerHTML = '<p>Please enter a PO Number.</p>';
        return;
    }
    imPaymentModalResults.innerHTML = '<p>Searching...</p>';

    try {
        await ensureInvoiceDataFetched();
        // [1.bdt] invoicesData
        const invoicesData = allInvoiceData[poNumber];

        // [1.bdu] resultsFound
        let resultsFound = false;
        // [1.bdv] tableHTML
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
            // [1.bdw] sortedInvoices
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
    // [1.bdx] selectedCheckboxes
    const selectedCheckboxes = document.getElementById('im-payment-modal-results').querySelectorAll('.payment-modal-inv-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert("Please select at least one invoice to add.");
        return;
    }

    // [1.bdy] addedCount
    let addedCount = 0;

    if (!allInvoiceData) await ensureInvoiceDataFetched();
    if (!allPOData) await ensureAllEntriesFetched();

    selectedCheckboxes.forEach(checkbox => {
        // [1.bdz] key
        const key = checkbox.dataset.key;
        // [1.bea] po
        const po = checkbox.dataset.po;

        if (invoicesToPay[key]) return;

        // [1.beb] invData
        const invData = (allInvoiceData[po] && allInvoiceData[po][key]) ? allInvoiceData[po][key] : null;

        if (invData) {
            invoicesToPay[key] = {
                ...invData,
                key,
                po,
                originalAttention: invData.attention
            };

            // [1.bec] poDetails
            const poDetails = allPOData[po] || {};
            // [1.bed] site
            const site = poDetails['Project ID'] || 'N/A';
            // [1.bee] vendor
            const vendor = poDetails['Supplier Name'] || 'N/A';

            // [1.bef] row
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

        // [1.beg] modal
        const modal = document.getElementById('im-add-payment-modal');
        if (modal) modal.classList.add('hidden');

        document.getElementById('im-payment-modal-po-input').value = '';
        document.getElementById('im-payment-modal-results').innerHTML = '';
    } else {
        alert("The selected invoices are already in your payment list.");
    }
}

// [1.beh] updatePaymentsCount
function updatePaymentsCount() {
    if (paymentsCountDisplay) {
        // [1.bei] rows
        const rows = imPaymentsTableBody.querySelectorAll('tr');
        paymentsCountDisplay.textContent = `(Total to Pay: ${rows.length})`;
    }
}

async function handleSavePayments() {
    // [1.bej] rows
    const rows = imPaymentsTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("There are no payments in the list to save.");
        return;
    }
    if (!confirm(`You are about to mark ${rows.length} invoice(s) as 'Paid'. This will update their status, Invoice Value, Amount To Paid, and Release Date. Continue?`)) {
        return;
    }

    // [1.bek] savePromises
    const savePromises = [];
    // [1.bel] localCacheUpdates
    const localCacheUpdates = [];
    // [1.bem] updatesMade
    let updatesMade = 0;

    for (const row of rows) {
        // [1.ben] invoiceKey
        const invoiceKey = row.dataset.key;
        // [1.beo] poNumber
        const poNumber = row.dataset.po;
        // [1.bep] originalInvoiceData
        const originalInvoiceData = invoicesToPay[invoiceKey];

        if (!invoiceKey || !poNumber || !originalInvoiceData) {
            console.warn("Skipping row with missing data:", row);
            continue;
        }

        // [1.beq] invValueInput
        const invValueInput = row.querySelector('input[name="invValue"]');
        // [1.ber] amountPaidInput
        const amountPaidInput = row.querySelector('input[name="amountPaid"]');
        // [1.bes] releaseDateInput
        const releaseDateInput = row.querySelector('input[name="releaseDate"]');

        // [1.bet] newInvValue
        const newInvValue = parseFloat(invValueInput.value) || 0;
        // [1.beu] newAmountPaid
        const newAmountPaid = parseFloat(amountPaidInput.value) || 0;
        // [1.bev] newReleaseDate
        const newReleaseDate = releaseDateInput.value || getTodayDateString();

        // [1.bew] updates
        const updates = {
            status: 'Paid',
            invValue: newInvValue,
            amountPaid: newAmountPaid,
            releaseDate: newReleaseDate
        };

        savePromises.push(
            invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates)
        );

        // [1.bex] updatedFullData
        const updatedFullData = {
            ...originalInvoiceData,
            ...updates
        };
        savePromises.push(
            updateInvoiceTaskLookup(poNumber, invoiceKey, updatedFullData, originalInvoiceData.attention)
        );

        localCacheUpdates.push({
            po: poNumber,
            key: invoiceKey,
            data: updates
        });
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

// [1.bey] handleFinanceSearch
function handleFinanceSearch() {
    // [1.bez] poNo
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
                    imFinanceAllPaymentsData[childSnapshot.key] = {
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    };
                });
                // [1.bfa] payments
                const payments = Object.values(imFinanceAllPaymentsData);
                if (financeReportCountDisplay) {
                    financeReportCountDisplay.textContent = `(Total Payments Found: ${payments.length})`;
                }
                showFinanceSearchResults(payments);
            }
        })
        .catch(error => console.error('Error searching payments:', error));
}

// [1.bfb] showFinanceSearchResults
function showFinanceSearchResults(payments) {
    imFinanceResultsBody.innerHTML = '';
    if (payments.length === 0) return;

    // [1.bfc] firstPayment
    const firstPayment = payments[0];
    const {
        site,
        vendor,
        vendorId,
        poNo,
        poValue
    } = firstPayment;

    // [1.bfd] summaryHtml
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

    // [1.bfe] totalCertified
    let totalCertified = 0;
    // [1.bff] totalRetention
    let totalRetention = 0;
    // [1.bfg] totalPayment
    let totalPayment = 0;

    // [1.bfh] paymentRowsHtml
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

    // [1.bfi] footerHtml
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

    // [1.bfj] detailsHtml
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

// [1.bfk] handleFinanceActionClick
function handleFinanceActionClick(e) {
    // [1.bfl] target
    const target = e.target.closest('button');
    if (!target) return;

    // [1.bfm] action
    const action = target.dataset.action;
    // [1.bfn] id
    const id = target.dataset.id;
    // [1.bfo] payment
    const payment = imFinanceAllPaymentsData[id];

    if (!action || !id || !payment) return;

    if (action === 'report') {
        generateFinanceReport(payment);
    }
}

// [1.bfp] resetFinanceSearch
function resetFinanceSearch() {
    imFinanceSearchPoInput.value = '';
    imFinanceResults.style.display = 'none';
    imFinanceNoResults.style.display = 'none';
    imFinanceResultsBody.innerHTML = '';
    imFinanceAllPaymentsData = {};
    if (financeReportCountDisplay) financeReportCountDisplay.textContent = '';
}

async function generateFinanceReport(selectedPayment) {
    // [1.bfq] poNo
    const poNo = selectedPayment.poNo;
    if (!poNo) return;
    try {
        // [1.bfr] snapshot
        const snapshot = await paymentDb.ref('payments').orderByChild('poNo').equalTo(poNo).once('value');
        if (!snapshot.exists()) {
            alert('No payments found for this PO No.');
            return;
        }
        // [1.bfs] payments
        const payments = [];
        snapshot.forEach(childSnapshot => {
            payments.push(childSnapshot.val());
        });
        payments.sort((a, b) => {
            // [1.bft] aNum
            const aNum = parseInt(String(a.paymentNo).replace('PVN-', ''));
            // [1.bfu] bNum
            const bNum = parseInt(String(b.paymentNo).replace('PVN-', ''));
            return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
        });
        // [1.bfv] totalCertified
        let totalCertified = 0,
            totalRetention = 0,
            totalPayment = 0,
            totalPrevPayment = 0;
        // [1.bfw] allNotes
        let allNotes = [];

        payments.forEach(payment => {
            // [1.bfx] certified
            const certified = parseFloat(payment.certifiedAmount || 0);
            // [1.bfy] retention
            const retention = parseFloat(payment.retention || 0);
            // [1.bfz] paymentAmount
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

        // [1.bga] totalCommitted
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
            // [1.bgb] row
            const row = document.createElement('tr');
            // [1.bgc] pvn
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

// [1.bgd] printFinanceReport
function printFinanceReport() {
    window.print();
}

// ==========================================================================
// 23. CEO APPROVAL & RECEIPT LOGIC
// ==========================================================================

// [1.bge] openCEOApprovalModal
function openCEOApprovalModal(taskData) {
    if (!taskData) return;

    document.getElementById('ceo-modal-key').value = taskData.key;
    document.getElementById('ceo-modal-source').value = taskData.source;
    document.getElementById('ceo-modal-originalPO').value = taskData.originalPO || '';
    document.getElementById('ceo-modal-originalKey').value = taskData.originalKey || '';

    // [1.bgf] invName
    const invName = taskData.invName || '';
    // [1.bgg] pdfLinkHTML
    let pdfLinkHTML = '';
    if (taskData.source === 'invoice' && invName.trim() && invName.toLowerCase() !== 'nil') {
        // [1.bgh] pdfUrl
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
    // [1.bgi] key
    const key = document.getElementById('ceo-modal-key').value;
    // [1.bgj] source
    const source = document.getElementById('ceo-modal-source').value;
    // [1.bgk] originalPO
    const originalPO = document.getElementById('ceo-modal-originalPO').value;
    // [1.bgl] originalKey
    const originalKey = document.getElementById('ceo-modal-originalKey').value;

    if (!key || !source) {
        alert("Error: Task identifiers are missing.");
        return;
    }

    // [1.bgm] newAmountPaid
    const newAmountPaid = ceoModalAmount.value;
    // [1.bgn] newNote
    const newNote = ceoModalNote.value.trim();

    if (newAmountPaid === '' || newAmountPaid < 0) {
        alert("Please enter a valid Amount to be Paid (0 or more).");
        return;
    }

    // [1.bgo] updates
    const updates = {
        status: status,
        remarks: status,
        amountPaid: newAmountPaid,
        amount: newAmountPaid,
        note: newNote,
        dateResponded: formatDate(new Date())
    };

    // [1.bgp] btn
    const btn = (status === 'Approved') ? ceoModalApproveBtn : ceoModalRejectBtn;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        // [1.bgq] processedTask
        const processedTask = userActiveTasks.find(t => t.key === key);
        if (!processedTask) {
            throw new Error("Task not found in local list. Forcing full refresh.");
        }

        // [1.bgr] originalAttention
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

            // [1.bgs] updatedInvoiceData
            const updatedInvoiceData = {
                ...processedTask,
                ...updates
            };
            await updateInvoiceTaskLookup(originalPO, originalKey, updatedInvoiceData, originalAttention);

            updateLocalInvoiceCache(originalPO, originalKey, updates);

            // --- FIX: LOG HISTORY HERE ---
            // This captures the CEO performing the action
            if (window.logInvoiceHistory) {
                // [1.bgt] historyNote
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

        // [1.bgu] taskIndex
        const taskIndex = userActiveTasks.findIndex(t => t.key === key);
        if (taskIndex > -1) {
            userActiveTasks.splice(taskIndex, 1);
        }

        renderActiveTaskTable(userActiveTasks);

        // [1.bgv] taskCount
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

// ==========================================================================
// MANAGER ESN GENERATOR (5 Letters + 5 Digits Shuffled)
// ==========================================================================
async function getManagerSeriesNumber() {
    // [1.bgw] letters
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    // [1.bgx] digits
    const digits = "0123456789";
    // [1.bgy] resultArr
    let resultArr = [];

    // 1. Get exactly 5 Random Letters
    for (let i = 0; i < 5; i++) {
        resultArr.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    }

    // 2. Get exactly 5 Random Digits
    for (let i = 0; i < 5; i++) {
        resultArr.push(digits.charAt(Math.floor(Math.random() * digits.length)));
    }

    // 3. Shuffle them together (e.g., A9K2P5M1X3)
    // [1.bgz] finalESN
    const finalESN = resultArr.sort(() => 0.5 - Math.random()).join('');

    return Promise.resolve(finalESN);
}

// ==========================================================================
// CEO ESN GENERATOR (5 Letters + 6 Digits)
// ==========================================================================
async function getNextSeriesNumber() {
    // [1.bha] letters
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    // [1.bhb] digits
    const digits = "0123456789";
    // [1.bhc] resultArr
    let resultArr = [];

    // 1. Get exactly 5 Random Letters
    for (let i = 0; i < 5; i++) {
        resultArr.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    }

    // 2. Get exactly 6 Random Digits
    for (let i = 0; i < 6; i++) {
        resultArr.push(digits.charAt(Math.floor(Math.random() * digits.length)));
    }

    // 3. Shuffle them together so they are mixed (e.g. "A9B8C7D6E54")
    // [1.bhd] finalESN
    const finalESN = resultArr.sort(() => 0.5 - Math.random()).join('');

    return Promise.resolve(finalESN);
}


async function previewAndSendReceipt() {
    // [1.bhe] isCEO
    const isCEO = (currentApprover?.Role || '').toLowerCase() === 'admin' &&
        (currentApprover?.Position || '').toLowerCase() === 'ceo';

    if (!isCEO) {
        alert("Access Denied: Only the CEO can send approval receipts.");
        return;
    }

    sendCeoApprovalReceiptBtn.disabled = true;
    sendCeoApprovalReceiptBtn.textContent = 'Preparing...';

    try {
        // [1.bhf] seriesNo
        const seriesNo = await getNextSeriesNumber();
        if (seriesNo === 'IBA_ERR') {
            alert("Error: Could not get a new series number.");
            return;
        }

        // [1.bhg] approvedTasks
        const approvedTasks = ceoProcessedTasks.filter(t => t.status === 'Approved');
        // [1.bhh] rejectedTasks
        const rejectedTasks = ceoProcessedTasks.filter(t => t.status === 'Rejected');

        // [1.bhi] receiptData
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
    if (document.getElementById('app-version-display')) {
        document.getElementById('app-version-display').textContent = `Version ${APP_VERSION}`;
    }
    document.querySelectorAll('.sidebar-version-display').forEach(el => {
        el.textContent = `Version ${APP_VERSION}`;
    });

    // --- 2. Session Restoration ---
    // [1.bhj] savedApproverKey
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
        // [1.bhk] identifier
        const identifier = loginIdentifierInput.value.trim();
        try {
            // [1.bhl] approver
            const approver = await findApprover(identifier);
            if (!approver) {
                loginError.textContent = 'Access denied. Your email or mobile is not registered as an approver.';
                return;
            }
            currentApprover = approver;
            if (!currentApprover.Password || currentApprover.Password === '') {
                // [1.bhm] isEmailMissing
                const isEmailMissing = !currentApprover.Email;
                // [1.bhn] isSiteMissing
                const isSiteMissing = !currentApprover.Site;
                // [1.bho] isPositionMissing
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
        // [1.bhp] newPassword
        const newPassword = setupPasswordInput.value;
        // [1.bhq] finalEmail
        const finalEmail = currentApprover.Email || setupEmailInput.value.trim();
        // [1.bhr] finalSite
        const finalSite = currentApprover.Site || setupSiteInput.value.trim();
        // [1.bhs] finalPosition
        const finalPosition = currentApprover.Position || setupPositionInput.value.trim();

        if (!finalEmail.toLowerCase().endsWith('@iba.com.qa')) {
            setupError.textContent = 'Invalid email. Only @iba.com.qa addresses are allowed.';
            return;
        }
        if (newPassword.length < 6) {
            setupError.textContent = 'Password must be at least 6 characters long.';
            return;
        }

        try {
            // [1.bht] updates
            const updates = {
                Password: newPassword,
                Email: finalEmail,
                Site: finalSite,
                Position: finalPosition
            };
            await db.ref(`approvers/${currentApprover.key}`).update(updates);
            currentApprover = {
                ...currentApprover,
                ...updates
            };
            handleSuccessfulLogin();
        } catch (error) {
            console.error("Error during setup:", error);
            setupError.textContent = 'An error occurred while saving. Please try again.';
        }
    });


    // --- NEW: Open SharePoint Folder when clicking "Attachment" Label ---
    // [1.bhu] attachmentLabel
    const attachmentLabel = document.getElementById('job-attachment-label');
    if (attachmentLabel) {
        attachmentLabel.addEventListener('click', () => {
            // Opens the global variable defined at the top of app.js
            // ATTACHMENT_BASE_PATH = ".../Documents/Attachments/"
            window.open(ATTACHMENT_BASE_PATH, '_blank');
        });
    }

    // --- NEW: Sidebar "Add New Job" Action ---
    // [1.bhv] sidebarAddJobBtn
    const sidebarAddJobBtn = document.getElementById('wd-sidebar-add-job-btn');
    if (sidebarAddJobBtn) {
        sidebarAddJobBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // 1. Navigate to "Job Records" Section
            // We simulate a click on the existing Job Records link so it handles the view switching/active state for us
            // [1.bhw] jobRecordsLink
            const jobRecordsLink = workdeskNav.querySelector('a[data-section="wd-reporting"]');
            if (jobRecordsLink) {
                jobRecordsLink.click();
            }

            // 2. Open the "Add New Job" Modal
            // We use a tiny delay to ensure the view transition finishes first
            setTimeout(() => {
                openStandardJobModal('Add');
            }, 100);
        });
    }
    // Password Form
    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        passwordError.textContent = '';
        // [1.bhx] enteredPassword
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
            // [1.bhy] mobileIdentifier
            const mobileIdentifier = document.getElementById('mobile-login-identifier').value.trim();
            // [1.bhz] passwordInput
            const passwordInput = document.getElementById('mobile-login-password').value;
            // [1.bia] errorMsg
            const errorMsg = document.getElementById('mobile-login-error');

            // [1.bib] sound
            const sound = document.getElementById('login-sound');
            if (sound) sound.play().catch(e => console.log("Audio play failed", e));

            try {
                // [1.bic] approver
                const approver = await findApprover(mobileIdentifier);
                if (!approver) {
                    errorMsg.textContent = 'Access denied. Number not found.';
                    return;
                }
                currentApprover = approver;

                if (!currentApprover.Password) {
                    document.querySelector('.mobile-login-container').style.display = 'none';
                    // [1.bid] isEmailMissing
                    const isEmailMissing = !currentApprover.Email;
                    setupEmailContainer.classList.toggle('hidden', !isEmailMissing);
                    setupSiteContainer.classList.toggle('hidden', !!currentApprover.Site);
                    setupPositionContainer.classList.toggle('hidden', !!currentApprover.Position);
                    if (isEmailMissing) setupEmailInput.required = true;
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
    // [1.bie] mobileNavLogout
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
    // [1.bif] imMobileNavLogout
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
        if (!currentApprover) {
            handleLogout();
            return;
        }
        wdUsername.textContent = currentApprover.Name || 'User';
        wdUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        // 1. Define User Roles
        // [1.big] userPos
        const userPos = (currentApprover?.Position || '').trim();
        // [1.bih] userRole
        const userRole = (currentApprover?.Role || '').toLowerCase();
        // [1.bii] isAdmin
        const isAdmin = userRole === 'admin';
        // [1.bij] isAccounting
        const isAccounting = userPos === 'Accounting';
        // [1.bik] isAccounts
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
            siteSelectChoices = new Choices(document.getElementById('job-site'), {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateSiteDropdown();
        }
        if (!attentionSelectChoices) {
            // [1.bil] attentionElement
            const attentionElement = document.getElementById('job-attention');
            attentionSelectChoices = new Choices(attentionElement, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateAttentionDropdown(attentionSelectChoices);
            attentionElement.addEventListener('choice', (event) => {
                if (event.detail && event.detail.value && attentionSelectChoices) {
                    // [1.bim] selectedValue
                    const selectedValue = event.detail.value;
                    // [1.bin] selectedChoice
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
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateAttentionDropdown(modifyTaskAttentionChoices);
        }

        updateWorkdeskDateTime();
        if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
        workdeskDateTimeInterval = setInterval(updateWorkdeskDateTime, 1000);

        showView('workdesk');

        // --- STRICT ROUTING: ALWAYS ACTIVE TASK ---
        // This ensures that even if Dashboard is hidden, we land on Active Tasks
        document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));

        // [1.bio] activeTaskLink
        const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
        if (activeTaskLink) {
            activeTaskLink.classList.add('active');
            await showWorkdeskSection('wd-activetask');
        }
    });

    // Sidebar Navigation
    document.querySelector('#workdesk-view .workdesk-sidebar').addEventListener('click', async (e) => {
        // [1.bip] link
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
                // [1.biq] activeTaskLink
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

    // [NEW] Listener for opening the Standard Job Modal (Updated for multiple buttons)
    // [1.bir] btnOpenStandard
    const btnOpenStandard = document.querySelectorAll('.btn-open-standard-modal');
    btnOpenStandard.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default behavior if needed
            openStandardJobModal('Add');
        });
    });

    jobEntryTableBody.addEventListener('click', (e) => {
        // [1.bis] row
        const row = e.target.closest('tr');
        if (row) {
            // [1.bit] key
            const key = row.getAttribute('data-key');
            if (jobEntryNavControls) jobEntryNavControls.classList.add('hidden');
            navigationContextList = [];
            navigationContextIndex = -1;

            ensureAllEntriesFetched().then(() => {
                // [1.biu] entry
                const entry = allSystemEntries.find(item => item.key === key);
                if (key && entry && entry.source !== 'invoice') populateFormForEditing(key);
            });
        }
    });


    jobEntrySearchInput.addEventListener('input', debounce((e) => handleJobEntrySearch(e.target.value), 500));

    // Job Entry Navigation Buttons
    if (navPrevJobButton) {
        navPrevJobButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (navigationContextIndex > 0) {
                navigationContextIndex--;
                // [1.bja] prevKey
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
                // [1.bjb] nextKey
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
            // [1.bjc] icon
            const icon = mobileActiveTaskRefreshBtn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');

            cacheTimestamps.systemEntries = 0;
            await ensureAllEntriesFetched(false);
            await populateActiveTasks();

            if (icon) icon.classList.remove('fa-spin');
        });
    }

    // Active Task Table Click
    activeTaskTableBody.addEventListener('click', async (e) => {
        if (e.target.closest('.mobile-only')) return;

        // [1.bjd] row
        const row = e.target.closest('tr');
        if (!row) return;

        // [1.bje] key
        const key = row.dataset.key;
        if (!key) return;

        // [1.bjf] taskData
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
                    // [1.bjg] updates
                    const updates = {
                        releaseDate: getTodayDateString(),
                        status: 'SRV Done'
                    };
                    await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update(updates);

                    if (!allInvoiceData) await ensureInvoiceDataFetched();
                    // [1.bjh] originalInvoice
                    const originalInvoice = (allInvoiceData && allInvoiceData[taskData.originalPO]) ? allInvoiceData[taskData.originalPO][taskData.originalKey] : {};
                    // [1.bji] updatedInvoiceData
                    const updatedInvoiceData = {
                        ...originalInvoice,
                        ...updates
                    };
                    await updateInvoiceTaskLookup(taskData.originalPO, taskData.originalKey, updatedInvoiceData, taskData.attention);

                    // --- FIX: LOG HISTORY HERE ---
                    // This captures the CURRENT USER (e.g., the person who clicked the button)
                    if (window.logInvoiceHistory) {
                        await window.logInvoiceHistory(taskData.originalPO, taskData.originalKey, 'SRV Done', 'Marked as SRV Done via Active Task');
                    }
                    // -----------------------------

                } else if (taskData.source === 'job_entry') {
                    // [1.bjj] updates
                    const updates = {
                        dateResponded: formatDate(new Date()),
                        remarks: 'SRV Done'
                    };
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

        // [1.bjk] userPositionLower
        const userPositionLower = (currentApprover?.Position || '').toLowerCase();
        // [1.bjl] isAccountingPosition
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
            // [1.bjm] jobEntryLink
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
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                });
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
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                });
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
            // [1.bjn] dayCell
            const dayCell = e.target.closest('.wd-calendar-day');
            if (dayCell && !dayCell.classList.contains('other-month')) {
                // [1.bjo] date
                const date = dayCell.dataset.date;
                if (date) displayCalendarTasksForDay(date);
            }
        });

        // Double Click: Show Day View
        wdCalendarGrid.addEventListener('dblclick', (e) => {
            // [1.bjp] dayCell
            const dayCell = e.target.closest('.wd-calendar-day');
            if (dayCell && !dayCell.classList.contains('other-month')) {
                // [1.bjq] taskBadge
                const taskBadge = dayCell.querySelector('.task-count-badge');
                if (taskBadge) {
                    // [1.bjr] date
                    const date = dayCell.dataset.date;
                    if (date) showDayView(date);
                }
            }
        });
    }

    if (wdCalendarYearGrid) {
        wdCalendarYearGrid.addEventListener('dblclick', (e) => {
            // [1.bjs] monthCell
            const monthCell = e.target.closest('.wd-calendar-month-cell');
            if (!monthCell) return;
            // [1.bjt] monthIndex
            const monthIndex = parseInt(monthCell.dataset.month, 10);
            if (isNaN(monthIndex)) return;

            wdCurrentCalendarDate.setMonth(monthIndex);
            toggleCalendarView();
            // [1.bju] firstDay
            const firstDay = new Date(wdCurrentCalendarDate.getFullYear(), monthIndex, 1);
            // [1.bjv] dateYear
            const dateYear = firstDay.getFullYear();
            // [1.bjw] dateMonth
            const dateMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
            // [1.bjx] dateDay
            const dateDay = String(firstDay.getDate()).padStart(2, '0');
            // [1.bjy] firstDayStr
            const firstDayStr = `${dateYear}-${dateMonth}-${dateDay}`;
            displayCalendarTasksForDay(firstDayStr);
        });
    }

    // --- FIX: Day View Task Double Click for Reporting ---
    // [1.bjz] dayViewTaskList
    const dayViewTaskList = document.getElementById('wd-dayview-task-list');
    if (dayViewTaskList) {
        dayViewTaskList.addEventListener('dblclick', (e) => {
            // Find the closest task card
            // [1.bka] taskCard
            const taskCard = e.target.closest('.dayview-task-card');

            // Check if the card exists and has the admin class
            if (taskCard && taskCard.classList.contains('admin-clickable-task')) {
                // [1.bkb] poNumber
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
                        // [1.bkc] imReportingLink
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
            // [1.bkd] taskItem
            const taskItem = e.target.closest('li.clickable-task');
            if (!taskItem || !taskItem.dataset.po) return;
            // [1.bke] poNumber
            const poNumber = taskItem.dataset.po;

            invoiceManagementButton.click();
            setTimeout(() => {
                imReportingSearchInput.value = poNumber;
                sessionStorage.setItem('imReportingSearch', poNumber);
                // [1.bkf] imReportingLink
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) imReportingLink.click();
            }, 150);
        });
    }

    // Enter Key Navigation
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        // [1.bkg] dashboardSection
        const dashboardSection = document.getElementById('wd-dashboard');
        if (!dashboardSection || dashboardSection.classList.contains('hidden')) return;
        // [1.bkh] isMobile
        const isMobile = window.innerWidth <= 768;
        if (isMobile) return;

        // [1.bki] selectedDay
        const selectedDay = document.querySelector('.wd-calendar-day.selected');
        if (!selectedDay) return;

        // [1.bkj] taskBadge
        const taskBadge = selectedDay.querySelector('.task-count-badge');
        if (!taskBadge) return;
        if (taskBadge.classList.contains('admin-view-only')) return;

        e.preventDefault();

        // [1.bkk] date
        const date = selectedDay.dataset.date;
        if (!date) return;

        // [1.bkl] friendlyDate
        const friendlyDate = formatYYYYMMDD(date);
        // [1.bkm] activeTaskLink
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
            // [1.bkn] dashboardLink
            const dashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
            if (dashboardLink) dashboardLink.click();
        });
    }

    // [1.bko] navigateDayView
    const navigateDayView = (direction) => {
        if (!wdCurrentDayViewDate) return;
        wdCurrentDayViewDate.setUTCDate(wdCurrentDayViewDate.getUTCDate() + direction);
        // [1.bkp] year
        const year = wdCurrentDayViewDate.getUTCFullYear();
        // [1.bkq] month
        const month = String(wdCurrentDayViewDate.getUTCMonth() + 1).padStart(2, '0');
        // [1.bkr] day
        const day = String(wdCurrentDayViewDate.getUTCDate()).padStart(2, '0');
        // [1.bks] newDateString
        const newDateString = `${year}-${month}-${day}`;
        showDayView(newDateString);
    };
    if (dayViewPrevBtn) dayViewPrevBtn.addEventListener('click', () => navigateDayView(-1));
    if (dayViewNextBtn) dayViewNextBtn.addEventListener('click', () => navigateDayView(1));

    // Mobile Day View Controls
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
        if (dayViewBackBtn) dayViewBackBtn.click();
    });
    if (mobileNotifyBtn) {
        mobileNotifyBtn.addEventListener('click', () => {
            // [1.bkt] taskCount
            const taskCount = userActiveTasks.length;
            if (taskCount > 0) alert(`Reminder: You still have ${taskCount} active task(s).`);
            else alert("You have no active tasks.");
        });
    }
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);
    if (dateScroller) {
        dateScroller.addEventListener('click', (e) => {
            // [1.bku] dayItem
            const dayItem = e.target.closest('.day-scroller-item');
            if (dayItem && dayItem.dataset.date) {
                // [1.bkv] oldActive
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
    // 1. REPORTING TABLE LISTENER (Universal Print Fix)
    // ==========================================================================
    if (reportingTableBody) {
        reportingTableBody.addEventListener('click', async (e) => {

            // --- A. HANDLE PRINT WAYBILL (Direct DB Fetch + Explicit Mapping) ---
            const printBtn = e.target.closest('.waybill-btn');
            if (printBtn) {
                e.stopPropagation();
                e.preventDefault();

                const key = printBtn.getAttribute('data-key');

                // Visual feedback
                const originalIcon = printBtn.innerHTML;
                printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                printBtn.disabled = true;

                try {
                    // 1. Fetch fresh data from Firebase
                    const snapshot = await db.ref(`transfer_entries/${key}`).once('value');
                    const val = snapshot.val();

                    if (val) {
                        // 2. EXPLICIT MAPPING (The Fix for Usage/Restock)
                        // We map every possible DB field name to the standard names the printer expects.
                        const entryData = {
                            key: key,

                            // IDs & Names
                            controlId: val.controlNumber || val.controlId || val.ref || 'N/A',
                            productId: val.productID || val.productId || '',
                            productName: val.productName || '',
                            details: val.details || '',

                            // Sites (Handle missing sites for Usage/Restock)
                            fromSite: val.fromLocation || val.fromSite || 'Main Store',
                            toSite: val.toLocation || val.toSite || (val.jobType === 'Usage' ? 'Consumed' : 'Main Store'),

                            // People
                            requestor: val.requestor || '',
                            receiver: val.receiver || '',
                            approver: val.approver || '',
                            contactName: val.contactName || val.receiver || '',

                            // Quantities (Map requiredQty to orderedQty)
                            orderedQty: val.orderedQty || val.requiredQty || 0,
                            approvedQty: val.approvedQty || 0,
                            receivedQty: val.receivedQty || 0,

                            // Dates
                            shippingDate: val.shippingDate || '',
                            arrivalDate: val.arrivalDate || '',

                            // Status & Logic
                            jobType: val.jobType || val.for || 'Transfer',
                            remarks: val.remarks || val.status || 'Pending',

                            // Signatures / ESN
                            esn: val.esn || '',
                            receiverEsn: val.receiverEsn || ''
                        };

                        // 3. Execute Print
                        if (window.handlePrintWaybill) {
                            window.handlePrintWaybill(entryData);
                        } else {
                            console.error("handlePrintWaybill function missing in transferLogic.js");
                            alert("Print function not loaded. Please refresh.");
                        }
                    } else {
                        alert("Error: Record not found in database.");
                    }
                } catch (err) {
                    console.error("Print Fetch Error:", err);
                    alert("Network error: Could not fetch print data.");
                } finally {
                    // Restore button state
                    printBtn.innerHTML = originalIcon;
                    printBtn.disabled = false;
                }
                return;
            }

            // --- B. HANDLE TRANSFER DELETE ---
            const deleteBtn = e.target.closest('.transfer-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const key = deleteBtn.getAttribute('data-key');
                if (typeof handleDeleteTransferEntry === 'function') {
                    handleDeleteTransferEntry(key);
                }
                return;
            }

            // --- C. HANDLE EXPAND BUTTON ---
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

            // --- D. HANDLE ROW CLICK (Edit Mode) ---
            const row = e.target.closest('tr');
            if (!row) return;
            const key = row.dataset.key;
            if (!key) return;

            // Load data to check type
            await ensureAllEntriesFetched();
            const entryData = allSystemEntries.find(entry => entry.key === key);
            if (!entryData) return;

            // D1: Transfer Edit
            if (['Transfer', 'Restock', 'Return', 'Usage'].includes(entryData.for)) {
                if (entryData.remarks === 'Pending' || entryData.remarks === 'Pending Source' || entryData.remarks === 'Pending Admin') {
                    if (confirm("Edit this Pending Request?")) {
                        const jobEntryLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
                        if (jobEntryLink) jobEntryLink.click();

                        // Use the correct loader from transferLogic.js
                        setTimeout(() => {
                            if (typeof openTransferModal === 'function') {
                                // We map the entry data to the form manually if needed, 
                                // or better yet, rely on the ID to fetch fresh data inside the modal logic if you implemented an edit loader.
                                // For now, let's just open the modal in the correct mode.
                                // Ideally, you should add a specific 'edit' loader function in transferLogic.js, 
                                // but opening the modal is the first step.
                                alert("Edit feature for Transfers is currently read-only in this version. Please delete and re-create if changes are needed.");
                            }
                        }, 200);
                    }
                }
                return;
            }

            // D2: Standard Job Edit
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
            // [1.blj] transferBtn
            const transferBtn = e.target.closest('.transfer-action-btn');

            if (transferBtn) {
                e.preventDefault(); // Stop any default button behavior
                e.stopPropagation(); // Stop the row click from firing

                // [1.blk] key
                const key = transferBtn.getAttribute('data-key');
                console.log("Transfer Button Clicked for Key:", key);

                // Find the task data
                // [1.bll] task
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
            // [1.blm] row
            const row = e.target.closest('tr');
            if (!row) return;
            // [1.bln] key
            const key = row.dataset.key;
            // [1.blo] taskData
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
            // [1.blp] invName
            const invName = taskData.invName || '';
            // [1.blq] isInvoiceFromIrwin
            const isInvoiceFromIrwin = taskData.source === 'invoice' && taskData.enteredBy === 'Irwin';
            // [1.blr] isClickable
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

        // [1.bls] wdPrintArea
        const wdPrintArea = document.getElementById('reporting-printable-area');
        if (wdPrintArea) {
            wdPrintArea.classList.add('printing');
            document.body.classList.add('workdesk-print-active');
        }
        window.print();
        setTimeout(() => {
            if (wdPrintArea) {
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

    document.querySelectorAll('.back-to-main-dashboard').forEach(button => button.addEventListener('click', (e) => {
        e.preventDefault();
        showView('dashboard');
    }));

    // --- 10. Invoice Management Listeners ---

    invoiceManagementButton.addEventListener('click', async () => {
        if (!currentApprover) {
            handleLogout();
            return;
        }
        imUsername.textContent = currentApprover.Name || 'User';
        imUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        if (imAttentionSelectChoices) {
            imAttentionSelect.removeEventListener('choice', handleIMAttentionChoice);
            imAttentionSelectChoices.destroy();
        }
        imAttentionSelectChoices = new Choices(imAttentionSelect, {
            searchEnabled: true,
            shouldSort: false,
            itemSelectText: ''
        });
        await populateAttentionDropdown(imAttentionSelectChoices);
        imAttentionSelect.addEventListener('choice', handleIMAttentionChoice);

        // 1. Define Roles strictly
        // [1.blt] userPos
        const userPos = (currentApprover?.Position || '').trim();
        // [1.blu] userRole
        const userRole = (currentApprover?.Role || '').toLowerCase();
        // [1.blv] isAdmin
        const isAdmin = userRole === 'admin';
        // [1.blw] isAccountingPos
        const isAccountingPos = userPos === 'Accounting';
        // [1.blx] isAccountsPos
        const isAccountsPos = userPos === 'Accounts';

        // 2. Define Access Groups
        // [1.bly] isAccountingAdmin
        const isAccountingAdmin = isAdmin && isAccountingPos; // Strictly Admin + Accounting
        // [1.blz] isAccountsAdmin
        const isAccountsAdmin = (isAdmin && isAccountsPos) || isAccountingAdmin; // Admin + Accounts (or Accounting)

        // [1.bma] imNavLinks
        const imNavLinks = imNav.querySelectorAll('li');

        imNavLinks.forEach(li => {
            // [1.bmb] link
            const link = li.querySelector('a');
            if (!link) return;
            // [1.bmc] section
            const section = link.dataset.section;

            li.style.display = ''; // Reset

            // Mobile link hiding on Desktop
            if (li.classList.contains('wd-nav-activetask-mobile')) {
                if (window.innerWidth > 768) {
                    li.style.display = 'none';
                    return;
                }
            }

            // --- STRICT MENU HIDING RULES ---

            // 1. Entry Group: Strictly Admin + Accounting
            if ((section === 'im-invoice-entry' || section === 'im-batch-entry' || section === 'im-summary-note') && !isAccountingAdmin) {
                li.style.display = 'none';
            }

            // 2. Payments: Admin + Accounts (or Accounting)
            if (section === 'im-payments') {
                if (!isAccountsAdmin) li.style.display = 'none';
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
        // [1.bmd] dashLink
        const dashLink = imNav.querySelector('a[data-section="im-dashboard"]');
        if (dashLink) dashLink.classList.add('active');

        // Load Dashboard immediately (Single Click Fix)
        setTimeout(() => {
            showIMSection('im-dashboard');
        }, 50);
    });


    // [1.bme] handleIMAttentionChoice
    function handleIMAttentionChoice(event) {
        if (event.detail && event.detail.value && imAttentionSelectChoices) {
            // [1.bmf] selectedValue
            const selectedValue = event.detail.value;
            // [1.bmg] selectedChoice
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
                // [1.bmh] activeTaskLink
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
                // [1.bmi] imReportingLink
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
            if (invoiceManagementView.classList.contains('hidden')) {
                invoiceManagementButton.click();
            }
            setTimeout(() => {
                // [1.bmj] imReportingLink
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
                // [1.bmk] wdDashboardLink
                const wdDashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
                if (wdDashboardLink) {
                    wdDashboardLink.click();
                }
            }, 100);
        });
    }

    imNav.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link || link.classList.contains('disabled') || link.parentElement.style.display === 'none' || link.id === 'im-workdesk-button' || link.id === 'im-activetask-button') return;
        e.preventDefault();
        const sectionId = link.getAttribute('data-section');
        if (sectionId) {
            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            showIMSection(sectionId);
        }
    });

    imPOSearchButton.addEventListener('click', () => handlePOSearch(imPOSearchInput.value));
    imPOSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePOSearch(imPOSearchInput.value);
        }
    });
    imPOSearchButtonBottom.addEventListener('click', () => handlePOSearch(imPOSearchInputBottom.value));
    imPOSearchInputBottom.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePOSearch(imPOSearchInputBottom.value);
        }
    });

    if (imShowActiveJobsBtn) imShowActiveJobsBtn.addEventListener('click', () => {
        imEntrySidebar.classList.toggle('visible');
    });
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
        // [1.bml] deleteBtn
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            handleDeleteInvoice(deleteBtn.getAttribute('data-key'));
            return;
        }
        // [1.bmm] pdfLink
        const pdfLink = e.target.closest('a');
        if (pdfLink) return;
        // [1.bmn] row
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
            // [1.bmo] expandBtn
            const expandBtn = e.target.closest('.expand-btn');
            if (expandBtn) {
                // [1.bmp] masterRow
                const masterRow = expandBtn.closest('.master-row');
                // [1.bmq] detailRow
                const detailRow = document.querySelector(masterRow.dataset.target);
                if (detailRow) {
                    detailRow.classList.toggle('hidden');
                    expandBtn.textContent = detailRow.classList.contains('hidden') ? '+' : '-';
                }
                return;
            }

            // 2. Handle "Edit Inv No" Button
            // [1.bmr] editInvBtn
            const editInvBtn = e.target.closest('.edit-inv-no-btn');
            if (editInvBtn) {
                e.stopPropagation();
                // [1.bms] po
                const po = editInvBtn.dataset.po;
                // [1.bmt] key
                const key = editInvBtn.dataset.key;
                // [1.bmu] currentVal
                const currentVal = editInvBtn.dataset.current;

                // [1.bmv] newVal
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
                        // [1.bmw] currentSearch
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
            // [1.bmx] invoiceRow
            const invoiceRow = e.target.closest('.nested-invoice-row');
            if (invoiceRow) {
                // [1.bmy] userPositionLower
                const userPositionLower = (currentApprover?.Position || '').toLowerCase();
                if (userPositionLower !== 'accounting') return;

                // [1.bmz] poNumber
                const poNumber = invoiceRow.dataset.poNumber;
                // [1.bna] invoiceKey
                const invoiceKey = invoiceRow.dataset.invoiceKey;
                // [1.bnb] source
                const source = invoiceRow.dataset.source;

                if (!poNumber || !invoiceKey) return;

                // --- SCENARIO A: IMPORT FROM EPICORE (CSV) ---
                if (source === 'ecommit') {
                    if (confirm(`Import this Epicore record to Invoice Entry?\n\nPO: ${poNumber}\nInv: ${invoiceRow.dataset.invNumber || 'N/A'}`)) {

                        imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                        imPOSearchInput.value = poNumber;

                        handlePOSearch(poNumber).then(() => {
                            setTimeout(() => {
                                // [1.bnc] invNo
                                const invNo = invoiceRow.dataset.invNumber;
                                // [1.bnd] invDate
                                const invDate = invoiceRow.dataset.invDate;
                                // [1.bne] releaseDate
                                const releaseDate = invoiceRow.dataset.releaseDate;
                                // [1.bnf] invValue
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

                                document.getElementById('im-new-invoice-form').scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center'
                                });
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
                                setTimeout(() => {
                                    populateInvoiceFormForEditing(invoiceKey);
                                }, 300);
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
            // [1.bng] searchTerm
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
        // [1.bnh] isChecked
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
            // [1.bni] friendlyDate
            const friendlyDate = calendarModalViewTasksBtn.dataset.friendlyDate;
            // [1.bnj] activeTaskLink
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
            // [1.bnk] modal
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    });

    if (batchClearBtn) batchClearBtn.addEventListener('click', () => {
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
                if (batchSearchStatusBtn) batchSearchStatusBtn.click();
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
                // [1.bnl] noteValue
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
                // [1.bnm] row
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
            if (imBatchSearchModal) imBatchSearchModal.classList.remove('hidden');

            // 2. FORCE RESET: This wipes out any old tables or success messages
            document.getElementById('im-batch-modal-results').innerHTML = '<p>Enter a PO number to see its invoices.</p>';

            // 3. Clear the input and focus it so you are ready to type the NEW PO immediately
            // [1.bnn] inputField
            const inputField = document.getElementById('im-batch-modal-po-input');
            if (inputField) {
                inputField.value = '';
                setTimeout(() => inputField.focus(), 100);
            }
        });
    }
    // --- END MODIFIED ---

    if (imBatchSearchModal) {
        // [1.bno] modalSearchBtn
        const modalSearchBtn = document.getElementById('im-batch-modal-search-btn'),
            addSelectedBtn = document.getElementById('im-batch-modal-add-selected-btn'),
            modalPOInput = document.getElementById('im-batch-modal-po-input');
        if (modalSearchBtn) modalSearchBtn.addEventListener('click', handleBatchModalPOSearch);
        if (addSelectedBtn) addSelectedBtn.addEventListener('click', handleAddSelectedToBatch);
        if (modalPOInput) modalPOInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (modalSearchBtn) modalSearchBtn.click();
            }
        });
    }

    if (imBatchGlobalAttention) {
        imBatchGlobalAttention.addEventListener('change', () => {
            if (!imBatchGlobalAttentionChoices) return;
            // [1.bnp] selectedValue
            const selectedValue = imBatchGlobalAttentionChoices.getValue(true);
            // [1.bnq] valueToSet
            const valueToSet = selectedValue ? [selectedValue] : [];
            // [1.bnr] rows
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
            // [1.bns] newValue
            const newValue = e.target.value;
            // [1.bnt] rows
            const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
            rows.forEach(row => {
                row.querySelector('select[name="status"]').value = newValue;
            });
        });
    }
    if (imBatchGlobalNote) {
        // [1.bnu] updateNotes
        const updateNotes = (newValue) => {
            // [1.bnv] rows
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

    // [1.bnw] refreshEntryBtn
    const refreshEntryBtn = document.getElementById('im-refresh-entry-button');
    if (refreshEntryBtn) refreshEntryBtn.addEventListener('click', async () => {
        alert("Refreshing all data from sources...");
        await ensureInvoiceDataFetched(true);
        await populateActiveTasks();
        alert("Data refreshed.");
        if (currentPO) handlePOSearch(currentPO);
    });
    // [1.bnx] refreshBatchBtn
    const refreshBatchBtn = document.getElementById('im-refresh-batch-button');
    if (refreshBatchBtn) refreshBatchBtn.addEventListener('click', async () => {
        alert("Refreshing all data... Your current batch list will be cleared.");
        await ensureInvoiceDataFetched(true);
        document.getElementById('im-batch-table-body').innerHTML = '';
        updateBatchCount();
        alert("Data refreshed. Please add POs again.");
    });
    // [1.bny] refreshSummaryBtn
    const refreshSummaryBtn = document.getElementById('im-refresh-summary-button');
    if (refreshSummaryBtn) refreshSummaryBtn.addEventListener('click', async () => {
        alert("Refreshing all data...");
        await ensureInvoiceDataFetched(true);
        initializeNoteSuggestions();
        alert("Data refreshed.");
    });
    // [1.bnz] refreshReportingBtn
    const refreshReportingBtn = document.getElementById('im-refresh-reporting-button');
    if (refreshReportingBtn) {
        refreshReportingBtn.addEventListener('click', async () => {
            alert("Refreshing all data...");
            await ensureInvoiceDataFetched(true);
            alert("Data refreshed. Please run your search again.");
            // [1.boa] searchTerm
            const searchTerm = imReportingSearchInput.value.trim();
            if (searchTerm || document.getElementById('im-reporting-site-filter').value || document.getElementById('im-reporting-date-filter').value) {
                populateInvoiceReporting(searchTerm);
            }
        });
    }

    if (summaryNoteGenerateBtn) summaryNoteGenerateBtn.addEventListener('click', handleGenerateSummary);
    if (summaryNoteUpdateBtn) summaryNoteUpdateBtn.addEventListener('click', handleUpdateSummaryChanges);

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

    if (summaryNotePrintBtn) {
        summaryNotePrintBtn.addEventListener('click', () => {
            // [1.bob] customNotesInput
            const customNotesInput = document.getElementById('summary-note-custom-notes-input');
            // [1.boc] notesPrintContent
            const notesPrintContent = document.getElementById('sn-print-notes-content');
            // [1.bod] notesPrintContainer
            const notesPrintContainer = document.getElementById('sn-print-notes');

            if (customNotesInput && notesPrintContent && notesPrintContainer) {
                // [1.boe] notesText
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
            // [1.bof] prevNote
            const prevNote = document.getElementById('summary-note-previous-input').value.trim();

            if (!prevNote) {
                alert("Please enter a 'Previous Note' to search for.");
                return;
            }

            summaryNotePrevPdfBtn.textContent = "Searching...";

            try {
                await ensureInvoiceDataFetched();

                // [1.bog] foundSrvName
                let foundSrvName = null;
                // [1.boh] foundPo
                let foundPo = null;

                // Scan all invoices to find the FIRST match for this note
                // We use a label to break out of both loops once found
                outerLoop:
                    for (const po in allInvoiceData) {
                        for (const key in allInvoiceData[po]) {
                            // [1.boi] inv
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
                    // [1.boj] pdfUrl
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
                // [1.bok] row
                const row = e.target.closest('tr');
                // [1.bol] key
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
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePaymentModalPOSearch();
            }
        });
    }
    if (imPaymentModalAddSelectedBtn) imPaymentModalAddSelectedBtn.addEventListener('click', handleAddSelectedToPayments);

    if (imFinanceSearchBtn) imFinanceSearchBtn.addEventListener('click', handleFinanceSearch);
    if (imFinanceClearBtn) imFinanceClearBtn.addEventListener('click', resetFinanceSearch);
    if (imFinanceSearchPoInput) {
        imFinanceSearchPoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleFinanceSearch();
            }
        });
    }
    if (imFinanceResults) imFinanceResults.addEventListener('click', handleFinanceActionClick);
    if (imFinancePrintReportBtn) imFinancePrintReportBtn.addEventListener('click', printFinanceReport);

    document.addEventListener('click', (e) => {
        // [1.bom] card
        const card = e.target.closest('.im-po-balance-card');
        if (card && card.dataset.toggleTarget) {
            // [1.bon] targetId
            const targetId = card.dataset.toggleTarget;
            // [1.boo] targetElement
            const targetElement = document.querySelector(targetId);
            // [1.bop] icon
            const icon = card.querySelector('.po-card-chevron');

            if (targetElement) {
                // [1.boq] isOpening
                const isOpening = targetElement.classList.contains('hidden-invoice-list');

                if (isOpening) {
                    // [1.bor] allOpenLists
                    const allOpenLists = document.querySelectorAll('[id^="mobile-invoice-list-"]:not(.hidden-invoice-list)');
                    allOpenLists.forEach(listDiv => {
                        listDiv.classList.add('hidden-invoice-list');
                        // [1.bos] otherCard
                        const otherCard = document.querySelector(`[data-toggle-target="#${listDiv.id}"]`);
                        // [1.bot] otherIcon
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
            // [1.bou] desktopSearchInput
            const desktopSearchInput = document.getElementById('im-reporting-search');
            // [1.bov] desktopSiteFilter
            const desktopSiteFilter = document.getElementById('im-reporting-site-filter');
            // [1.bow] desktopStatusFilter
            const desktopStatusFilter = document.getElementById('im-reporting-status-filter');
            // [1.box] desktopDateFilter
            const desktopDateFilter = document.getElementById('im-reporting-date-filter');

            // [1.boy] mobileSearchInput
            const mobileSearchInput = document.getElementById('im-mobile-search-term');
            // [1.boz] mobileSiteFilter
            const mobileSiteFilter = document.getElementById('im-mobile-site-filter');
            // [1.bpa] mobileStatusFilter
            const mobileStatusFilter = document.getElementById('im-mobile-status-filter');
            // [1.bpb] mobileDateFilter
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

            // [1.bpc] desktopContainer
            const desktopContainer = document.getElementById('im-reporting-content');
            // [1.bpd] mobileContainer
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
            // [1.bpe] desktopSearchInput
            const desktopSearchInput = document.getElementById('im-reporting-search');
            // [1.bpf] mobileSearchInput
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
    // [1.bpg] jobAttachmentViewBtn
    const jobAttachmentViewBtn = document.getElementById('job-attachment-view-btn');
    if (jobAttachmentViewBtn) {
        jobAttachmentViewBtn.addEventListener('click', () => {
            // 1. Get the filename from the input box
            // [1.bph] val
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
    window.logInvoiceHistory = async function (poNumber, invoiceKey, newStatus, note = "") {
        if (!poNumber || !invoiceKey) return;

        // [1.bpi] historyEntry
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
    window.showInvoiceHistory = async function (poNumber, invoiceKey) {
        // [1.bpj] modal
        const modal = document.getElementById('history-modal');
        // [1.bpk] loader
        const loader = document.getElementById('history-modal-loader');
        // [1.bpl] tbody
        const tbody = document.getElementById('history-table-body');

        if (modal) modal.classList.remove('hidden');
        if (loader) loader.classList.remove('hidden');
        if (tbody) tbody.innerHTML = '';

        try {
            // Fetch history
            // [1.bpm] snapshot
            const snapshot = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}/history`).orderByChild('timestamp').once('value');
            // [1.bpn] historyData
            const historyData = [];

            snapshot.forEach(child => {
                historyData.push(child.val());
            });

            // Fetch creation date for the start point
            // [1.bpo] invSnapshot
            const invSnapshot = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).once('value');
            // [1.bpp] invData
            const invData = invSnapshot.val();

            if (invData) {
                // 1. Determine the Start Time
                // [1.bpq] startTime
                const startTime = invData.originTimestamp || invData.createdAt;

                // 2. Determine the Initiator
                // [1.bpr] initiator
                const initiator = invData.originEnteredBy || "System";

                // 3. Determine the Note
                // [1.bps] startNote
                const startNote = invData.originTimestamp ?
                    "Originated from Job Entry" :
                    "Initial Invoice Entry";

                if (startTime) {
                    historyData.unshift({
                        status: "Created / Received",
                        timestamp: startTime,
                        updatedBy: initiator,
                        note: startNote
                    });
                }
            }

            if (loader) loader.classList.add('hidden');

            if (historyData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No history recorded yet.</td></tr>';
                return;
            }

            // [1.bpt] previousTime
            let previousTime = null;

            historyData.forEach((entry) => {
                // [1.bpu] dateObj
                const dateObj = new Date(entry.timestamp);
                // [1.bpv] dateStr
                const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // [1.bpw] durationStr
                let durationStr = "---";

                if (previousTime) {
                    // [1.bpx] diffMs
                    const diffMs = entry.timestamp - previousTime;
                    // [1.bpy] diffDays
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    // [1.bpz] diffHrs
                    const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    // [1.bqa] diffMins
                    const diffMins = Math.round(((diffMs % (1000 * 60 * 60)) / (1000 * 60)));

                    if (diffDays > 0) durationStr = `${diffDays}d ${diffHrs}h`;
                    else if (diffHrs > 0) durationStr = `${diffHrs}h ${diffMins}m`;
                    else durationStr = `${diffMins} mins`;
                }

                previousTime = entry.timestamp;

                // [1.bqb] row
                const row = `
                <tr>
                    <td><strong>${entry.status}</strong><br><small style="color:#777">${entry.note || ''}</small></td>
                    <td>${dateStr}</td>
                    <td>${entry.updatedBy || 'N/A'}</td>
                    <td class="history-duration">${durationStr}</td>
                </tr>
            `;
                if (tbody) tbody.innerHTML += row;
            });

        } catch (error) {
            console.error(error);
            if (loader) loader.classList.add('hidden');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
        }
    };
    // --- NEW: Dashboard Double-Click Logic ---
    // [1.bqc] dashboardNavLink
    const dashboardNavLink = document.getElementById('im-dashboard-nav-link');
    if (dashboardNavLink) {
        dashboardNavLink.addEventListener('dblclick', (e) => {
            e.preventDefault();
            // Only load if we are currently IN the IM view
            if (!invoiceManagementView.classList.contains('hidden')) {
                // Visual Feedback
                // [1.bqd] dbSection
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
    // [1.bqe] manualSupplierIdInput
    const manualSupplierIdInput = document.getElementById('manual-supplier-id');

    // 1. Auto-lookup Vendor Name when ID is typed
    if (manualSupplierIdInput) {
        manualSupplierIdInput.addEventListener('input', (e) => {
            // [1.bqf] id
            const id = e.target.value.trim();
            // [1.bqg] nameInput
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
    // [1.bqh] saveManualPOBtn
    const saveManualPOBtn = document.getElementById('im-save-manual-po-btn');
    if (saveManualPOBtn) {
        saveManualPOBtn.addEventListener('click', () => {
            // [1.bqi] po
            const po = document.getElementById('manual-po-number').value;
            // [1.bqj] vendor
            const vendor = document.getElementById('manual-vendor-name').value;
            // [1.bqk] site
            const site = document.getElementById('manual-site-select').value;
            // [1.bql] amount
            const amount = document.getElementById('manual-po-amount').value;

            if (!vendor || !site || !amount) {
                alert("Please fill in all fields (Supplier ID, Site, Amount).");
                return;
            }

            // Construct a "Fake" PO Object to inject into cache
            // [1.bqm] manualPOData
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

    window.showTransferHistory = async function (key) {
        // [1.bqn] modal
        const modal = document.getElementById('history-modal');
        // [1.bqo] loader
        const loader = document.getElementById('history-modal-loader');
        // [1.bqp] tbody
        const tbody = document.getElementById('history-table-body');

        if (modal) modal.classList.remove('hidden');
        if (loader) loader.classList.remove('hidden');
        if (tbody) tbody.innerHTML = '';

        try {
            // 1. Get the entry
            // [1.bqq] snapshot
            const snapshot = await db.ref(`transfer_entries/${key}`).once('value');
            // [1.bqr] entry
            const entry = snapshot.val();

            if (!entry) throw new Error("Entry not found");

            // [1.bqs] historyData
            const historyData = [];

            // 2. Parse History (It might be an array or an object depending on how it was saved)
            if (entry.history) {
                if (Array.isArray(entry.history)) {
                    historyData.push(...entry.history);
                } else {
                    Object.values(entry.history).forEach(h => historyData.push(h));
                }
            }

            if (loader) loader.classList.add('hidden');

            if (historyData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
                return;
            }

            // Sort by timestamp
            historyData.sort((a, b) => a.timestamp - b.timestamp);

            historyData.forEach((h) => {
                // [1.bqt] dateObj
                const dateObj = new Date(h.timestamp);
                // [1.bqu] dateStr
                const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // [1.bqv] row
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
            if (loader) loader.classList.add('hidden');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
        }
    };

    // ==========================================================================
    // FIXED HELPER: Reverse Stock (Undo a transaction)
    // ==========================================================================
    async function reverseStockInventory(id, qty, jobType, fromSite, toSite) {
        if (!id || !qty) return;

        // Sanitize Site Names
        // [1.bqw] safeFrom
        const safeFrom = fromSite ? fromSite.replace(/[.#$[\]]/g, "_") : null;
        // [1.bqx] safeTo
        const safeTo = toSite ? toSite.replace(/[.#$[\]]/g, "_") : null;

        console.log(`Reversing Stock -> Type: ${jobType}, Qty: ${qty}, ID: ${id}`);

        try {
            // [1.bqy] snapshot
            let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
            if (!snapshot.exists()) {
                snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
            }

            if (snapshot.exists()) {
                // [1.bqz] data
                const data = snapshot.val();
                // [1.bra] key
                const key = Object.keys(data)[0];
                // [1.brb] item
                const item = data[key];
                // [1.brc] sites
                let sites = item.sites || {};
                // [1.brd] amount
                const amount = parseFloat(qty);

                // --- REVERSAL LOGIC ---

                // A. USAGE or RETURN (Original: Deducted Source -> Reversal: ADD Source)
                if (jobType === 'Usage' || jobType === 'Return') {
                    if (safeFrom) {
                        // [1.bre] current
                        let current = parseFloat(sites[safeFrom] || 0);
                        sites[safeFrom] = current + amount; // Add back to source
                    }
                }

                // B. RESTOCK (Original: Added Dest -> Reversal: DEDUCT Dest)
                else if (jobType === 'Restock') {
                    if (safeTo) {
                        // [1.brf] current
                        let current = parseFloat(sites[safeTo] || 0);
                        sites[safeTo] = current - amount;
                        if (sites[safeTo] < 0) sites[safeTo] = 0;
                    }
                }

                // C. TRANSFER (Original: Moved Source->Dest -> Reversal: Move Dest->Source)
                else {
                    // Default to Transfer logic if type is missing
                    if (safeFrom && safeTo) {
                        // [1.brg] curFrom
                        let curFrom = parseFloat(sites[safeFrom] || 0);
                        // [1.brh] curTo
                        let curTo = parseFloat(sites[safeTo] || 0);

                        sites[safeFrom] = curFrom + amount; // Return to source
                        sites[safeTo] = curTo - amount; // Remove from dest
                        if (sites[safeTo] < 0) sites[safeTo] = 0;
                    }
                }

                // Recalculate Global Total
                // [1.bri] newGlobalStock
                let newGlobalStock = 0;
                Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

                await db.ref(`material_stock/${key}`).update({
                    sites: sites,
                    stockQty: newGlobalStock,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });
                console.log("Stock Reversal Successful.");
            }
        } catch (error) {
            console.error("Stock reversal error:", error);
        }
    }

    // ==========================================================================
    // HANDLE DELETE -> PROMPTS FOR QTY -> CREATES RETURN -> REMOVES ORIGINAL
    // ==========================================================================
    async function handleDeleteTransferEntry(key) {
        await ensureAllEntriesFetched();
        // [1.brj] task
        const task = allSystemEntries.find(t => t.key === key);

        if (!task) {
            alert("Error: Task not found.");
            return;
        }

        // [1.brk] isCompleted
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
        // [1.brl] maxQty
        const maxQty = parseFloat(task.receivedQty || task.orderedQty || 0);

        if (maxQty <= 0) {
            alert("Error: This task has no quantity recorded to return.");
            return;
        }

        // 3. PROMPT USER FOR QUANTITY
        // [1.brm] returnQtyStr
        const returnQtyStr = prompt(
            `Creating Return Request for: ${task.productName}\n\nMax Quantity Available: ${maxQty}\n\nPlease enter the Quantity to Return:`,
            maxQty
        );

        // If user clicks Cancel, stop everything
        if (returnQtyStr === null) return;

        // [1.brn] returnQty
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
        // [1.bro] origSource
        const origSource = task.fromSite || task.fromLocation || task.site || 'Main Store';
        // [1.brp] origDest
        const origDest = task.toSite || task.toLocation || 'Unknown';

        // [1.brq] retFrom
        let retFrom = '';
        // [1.brr] retTo
        let retTo = '';
        // [1.brs] detailsMsg
        let detailsMsg = '';

        if (task.jobType === 'Restock') {
            detailsMsg = `Reversal of Restock (${task.controlNumber})`;
            retFrom = origDest; // Deduct from where it is now
            retTo = 'Outside Supplier';
        } else if (task.jobType === 'Usage') {
            detailsMsg = `Reversal of Usage (${task.controlNumber})`;
            retFrom = origSource; // Usage occurred at source, return adds back to source
            retTo = origSource;
        } else if (task.jobType === 'Transfer') {
            detailsMsg = `Reversal of Transfer (${task.controlNumber})`;
            retFrom = origDest; // Currently at Destination
            retTo = origSource; // Return to Source
        } else {
            alert("Cannot reverse this transaction type.");
            return;
        }

        try {
            // [1.brt] currentUser
            const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
            // [1.bru] newRef
            const newRef = db.ref('transfer_entries').push();

            // 6. CREATE REVERSAL DATA
            // [1.brv] reversalData
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
                history: [{
                    action: "Return Requested",
                    by: currentUser,
                    timestamp: Date.now(),
                    note: `Qty: ${returnQty}`
                }]
            };

            // 7. SAVE & DELETE OLD
            await newRef.set(reversalData);
            await db.ref(`transfer_entries/${key}`).remove();

            alert(`Return Request Created for ${returnQty} units! Sent to Approver.`);

            // Refresh
            allSystemEntries = allSystemEntries.filter(t => t.key !== key);
            if (typeof populateActiveTasks === 'function') populateActiveTasks();
            if (document.getElementById('reporting-table-body')) renderReportingTable(allSystemEntries);

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
        // [1.brw] safeSiteName
        const safeSiteName = siteName.replace(/[.#$[\]]/g, "_");
        console.log(`Stock Update: ${action} ${qty} at ${safeSiteName} for ${id}`);

        try {
            // [1.brx] snapshot
            let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
            if (!snapshot.exists()) {
                snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
            }

            if (snapshot.exists()) {
                // [1.bry] data
                const data = snapshot.val();
                // [1.brz] key
                const key = Object.keys(data)[0];
                // [1.bsa] item
                const item = data[key];
                // [1.bsb] sites
                let sites = item.sites || {};
                // [1.bsc] currentSiteStock
                let currentSiteStock = parseFloat(sites[safeSiteName] || 0);
                // [1.bsd] amount
                const amount = parseFloat(qty);

                if (action === 'Deduct') {
                    currentSiteStock -= amount;
                    if (currentSiteStock < 0) currentSiteStock = 0;
                } else if (action === 'Add') {
                    currentSiteStock += amount;
                }

                sites[safeSiteName] = currentSiteStock;

                // [1.bse] newGlobalStock
                let newGlobalStock = 0;
                Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

                await db.ref(`material_stock/${key}`).update({
                    sites: sites,
                    stockQty: newGlobalStock,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });
            }
        } catch (error) {
            console.error("Stock update failed:", error);
        }
    }

    // A. OPEN MODAL (Handles both Add and Edit modes)
    window.openStandardJobModal = function (mode, entryData = null) {
        // [1.bsf] modal
        const modal = document.getElementById('standard-job-modal');
        // [1.bsg] title
        const title = document.getElementById('standard-modal-title');

        // Get Buttons
        // [1.bsh] addBtn
        const addBtn = document.getElementById('add-job-button');
        // [1.bsi] updateBtn
        const updateBtn = document.getElementById('update-job-button');
        // [1.bsj] deleteBtn
        const deleteBtn = document.getElementById('delete-job-button');

        // 1. ADD MODE
        if (mode === 'Add') {
            resetJobEntryForm(false); // Clean form
            title.textContent = "Add New Job Entry";

            // Show Add, Hide Update/Delete
            addBtn.classList.remove('hidden');
            updateBtn.classList.add('hidden');
            deleteBtn.classList.add('hidden');
        }
        // 2. EDIT MODE
        else if (mode === 'Edit' && entryData) {
            currentlyEditingKey = entryData.key;
            title.textContent = "Edit Job Entry";

            // Hide Add, Show Update
            addBtn.classList.add('hidden');
            updateBtn.classList.remove('hidden');

            // Check permission for Delete button
            // [1.bsk] userPositionLower
            const userPositionLower = (currentApprover?.Position || '').toLowerCase();
            if (userPositionLower === 'accounting' && currentApprover.Name === 'Irwin') {
                deleteBtn.classList.remove('hidden');
            } else {
                deleteBtn.classList.add('hidden');
            }

            // Populate Form Data
            document.getElementById('job-for').value = entryData.for || 'Other';
            // Handle "Other" Input Visibility
            if (!['PR', 'Invoice', 'IPC', 'Payment', 'Report', 'Transfer', 'Restock', 'Return', 'Usage'].includes(entryData.for)) {
                document.getElementById('job-for').value = 'Other';
                document.getElementById('job-other-specify').value = entryData.for;
                document.getElementById('job-other-specify').classList.remove('hidden');
            } else {
                document.getElementById('job-other-specify').classList.add('hidden');
            }

            document.getElementById('job-ref').value = entryData.ref || '';
            document.getElementById('job-po').value = entryData.po || '';
            document.getElementById('job-amount').value = entryData.amount || '';
            document.getElementById('job-attachment').value = entryData.attachmentName || '';
            document.getElementById('job-group').value = entryData.group || '';
            document.getElementById('job-status').value = (entryData.remarks === 'Pending') ? '' : entryData.remarks || '';

            if (siteSelectChoices) siteSelectChoices.setChoiceByValue(entryData.site || '');
            if (attentionSelectChoices) attentionSelectChoices.setChoiceByValue(entryData.attention || '');
        }

        modal.classList.remove('hidden');
    };


    // B. CLOSE MODAL
    window.closeStandardJobModal = function () {
        document.getElementById('standard-job-modal').classList.add('hidden');
        // Optional: clear form on close
        resetJobEntryForm(false);
    };

    // ==========================================================================
    // NEW: SHOW JOB HISTORY (IPC, PR, etc.)
    // ==========================================================================
    window.showJobHistory = async function (key) {
        const modal = document.getElementById('history-modal');
        const loader = document.getElementById('history-modal-loader');
        const tbody = document.getElementById('history-table-body');

        if (modal) modal.classList.remove('hidden');
        if (loader) loader.classList.remove('hidden');
        if (tbody) tbody.innerHTML = '';

        try {
            // 1. Get the entry
            const snapshot = await db.ref(`job_entries/${key}`).once('value');
            const entry = snapshot.val();

            if (!entry) throw new Error("Entry not found");

            const historyData = [];

            // 2. Parse History
            if (entry.history) {
                if (Array.isArray(entry.history)) {
                    historyData.push(...entry.history);
                } else {
                    Object.values(entry.history).forEach(h => historyData.push(h));
                }
            }

            if (loader) loader.classList.add('hidden');

            if (historyData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
                return;
            }

            // Sort by timestamp
            historyData.sort((a, b) => a.timestamp - b.timestamp);

            historyData.forEach((h) => {
                const dateObj = new Date(h.timestamp);
                const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });

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
            if (loader) loader.classList.add('hidden');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
        }
    };


    
    
}); // END OF DOMCONTENTLOADED
