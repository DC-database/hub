/* ==========================================================================
   js/app-data-cache.js
   IBA shared local cache, CSV fetchers/parsers, and Firebase data loaders.
   Version: 10.7.4

   Cleanup Phase:
   - Moved Block 06 out of app.js intact.
   - Public function names are preserved for WorkDesk, Invoice, Inventory,
     Reporting, Dashboard, Job Vendor, and Batch Entry modules.
   - No Firebase path names, save/update/delete handlers, invoice CRUD,
     batch save, payment save, or inventory stock write logic changed.
   ========================================================================== */

// #region BLOCK 06 — LOCAL CACHE + CSV / DATA FETCHERS
// Purpose: LocalStorage cache, Firebase storage CSV URLs, CSV parsers, invoice/workdesk data loaders, local invoice cache updates.
// =================================================================================================

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


// 10.7.4: POVALUE2.csv is a GitHub CSV source, not Firebase billing data.
// Keep Invoice PO lookup fresh so newly uploaded POs can be used immediately.
const IM_ALWAYS_REFRESH_POVALUE2_CSV = true;
window.__imPOVALUE2InFlight = null;
window.__imLastPOVALUE2RefreshAt = 0;

function clearPOVALUE2MemoryCache() {
    try {
        allPOData = null;
        allPODataByRef = null;
        if (typeof cacheTimestamps !== 'undefined') cacheTimestamps.poData = 0;
        localStorage.removeItem('cached_POVALUE2');
        localStorage.removeItem('cached_PO_DATA');
    } catch (_) {}
}

async function refreshPOVALUE2CsvNow(reason = 'manual') {
    if (window.__imPOVALUE2InFlight) return window.__imPOVALUE2InFlight;

    window.__imPOVALUE2InFlight = (async () => {
        const startedAt = Date.now();
        try {
            const poUrl = await getFirebaseCSVUrl('POVALUE2.csv');
            console.log(`Refreshing latest POVALUE2.csv (${reason})...`);
            const csvData = await fetchAndParseCSV(poUrl);
            if (!csvData) throw new Error('POVALUE2.csv could not be parsed.');
            allPOData = csvData.poDataByPO || {};
            allPODataByRef = csvData.poDataByRef || {};
            if (typeof cacheTimestamps !== 'undefined') cacheTimestamps.poData = startedAt;
            window.__imLastPOVALUE2RefreshAt = Date.now();
            console.log(`Latest POVALUE2.csv ready. ${Object.keys(allPOData || {}).length} POs indexed.`);
            return csvData;
        } finally {
            window.__imPOVALUE2InFlight = null;
        }
    })();

    return window.__imPOVALUE2InFlight;
}

try {
    window.refreshPOVALUE2CsvNow = refreshPOVALUE2CsvNow;
    window.clearPOVALUE2MemoryCache = clearPOVALUE2MemoryCache;
} catch (_) {}

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
    // 11.0.9: Local/Test Mode uses browser cache only. Do not fetch Firebase/CSV URLs
    // while testing patch UI from file://, localhost, or ?testmode=1.
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('csv-url:' + filename, true)) {
        return null;
    }

    // For Ecost.csv, use raw GitHub URL to bypass CDN cache
    if (filename === 'Ecost.csv') {
        const cacheBuster = "?v=" + new Date().getTime();
        return "https://raw.githubusercontent.com/DC-database/Hub/main/Ecost.csv" + cacheBuster;
    }

    // Summary Note uses POdetails.csv for the Bill Description column.
    // Use GitHub raw + cache-buster so new uploads are available immediately.
    if (filename === 'POdetails.csv') {
        const cacheBuster = "?v=" + new Date().getTime();
        return "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/POdetails.csv" + cacheBuster;
    }

    // 7.8.2: Site.csv drives WorkDesk site dropdowns. Use GitHub raw with
    // a strong cache-buster so newly uploaded sites appear faster than CDN/local cache.
    if (filename === 'Site.csv') {
        const cacheBuster = "?v=" + new Date().getTime() + "&refresh=1";
        return "https://raw.githubusercontent.com/DC-database/Hub/main/Site.csv" + cacheBuster;
    }

    // 10.7.4: POVALUE2.csv must always be fresh after GitHub upload.
    // Add both time and random cache-busters. This is a free GitHub CSV read,
    // not a Firebase read/download.
    if (filename === 'POVALUE2.csv') {
        const cacheBuster = "?v=" + Date.now() + "&fresh=" + Math.random().toString(36).slice(2);
        return `https://raw.githubusercontent.com/DC-database/Hub/refs/heads/main/POVALUE2.csv${cacheBuster}`;
    }

    // 9.4.0: Prefer GitHub raw for critical Invoice Management CSV files.
    // jsDelivr sometimes returns 503 or omits CORS headers during local testing,
    // which can block Batch Entry PO Search / ECommit loading.
    const cacheBuster = "?v=" + new Date().getTime();
    const criticalRawCsv = ['Vendors.csv', 'ECommit.csv', 'ECommit2.csv'];
    if (criticalRawCsv.includes(filename)) {
        return `https://raw.githubusercontent.com/DC-database/Hub/main/${filename}${cacheBuster}`;
    }

    const baseUrl = "https://cdn.jsdelivr.net/gh/DC-database/Hub@main/";
    return `${baseUrl}${filename}${cacheBuster}`;
}

async function silentlyRefreshStaleCaches() {
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('silent-background-cache-refresh', true)) {
        try { loadDataFromLocalStorage(); } catch (_) {}
        return;
    }
    console.log("Checking for stale background caches...");
    const now = Date.now();

    try {
        if (cacheTimestamps.epicoreData === 0) {
            console.log("Silently refreshing POdetails.csv...");
            const url = await getFirebaseCSVUrl('POdetails.csv');
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

async function fetchCsvTextWithFallback(url, label = 'CSV') {
    const urlsToTry = [];
    const addUrl = (candidate) => {
        if (candidate && !urlsToTry.includes(candidate)) urlsToTry.push(candidate);
    };

    addUrl(url);

    const filenamePart = (typeof url === 'string') ? url.split('/').pop().split('?')[0] : '';

    // If any older code still passes a jsDelivr URL, retry the same file from GitHub raw.
    if (typeof url === 'string' && url.includes('cdn.jsdelivr.net/gh/DC-database/Hub@main/') && filenamePart) {
        addUrl(`https://raw.githubusercontent.com/DC-database/Hub/main/${filenamePart}?v=${Date.now()}&fresh=${Math.random().toString(36).slice(2)}`);
    }

    // Extra GitHub raw variants. This helps when GitHub serves an older cached object
    // for one raw URL shape immediately after a CSV upload.
    if (typeof url === 'string' && url.includes('raw.githubusercontent.com/DC-database/Hub/main/') && filenamePart) {
        addUrl(`https://raw.githubusercontent.com/DC-database/Hub/refs/heads/main/${filenamePart}?v=${Date.now()}&fresh=${Math.random().toString(36).slice(2)}`);
    }
    if (typeof url === 'string' && url.includes('raw.githubusercontent.com/DC-database/Hub/refs/heads/main/') && filenamePart) {
        addUrl(`https://raw.githubusercontent.com/DC-database/Hub/main/${filenamePart}?v=${Date.now()}&fresh=${Math.random().toString(36).slice(2)}`);
    }
    if (filenamePart) {
        addUrl(`https://cdn.jsdelivr.net/gh/DC-database/Hub@main/${filenamePart}?v=${Date.now()}&fresh=${Math.random().toString(36).slice(2)}`);
    }

    let lastError = null;
    for (const candidateUrl of urlsToTry) {
        try {
            // 10.7.5: Keep this as a simple CORS GET.
            // Do NOT send Cache-Control/Pragma request headers to raw.githubusercontent.com.
            // Those custom headers trigger an OPTIONS preflight, and GitHub raw can reject it,
            // especially when testing locally from file:// (origin 'null').
            const response = await fetch(candidateUrl, {
                cache: 'no-store',
                mode: 'cors'
            });
            if (!response.ok) throw new Error(`${label} fetch failed: ${response.status} ${response.statusText}`);
            return await response.text();
        } catch (error) {
            lastError = error;
            console.warn(`${label} fetch failed from ${candidateUrl}:`, error);
        }
    }
    throw lastError || new Error(`${label} fetch failed`);
}

async function fetchAndParseCSV(url) {
    try {
        const csvText = await fetchCsvTextWithFallback(url, 'POVALUE2.csv');
        // Remove Byte Order Mark (BOM) if present
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) {
            throw new Error("CSV is empty or has no data rows.");
        }

        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
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
        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        const headersLower = headers.map(h => h.toLowerCase());

        console.log("CSV Headers Found:", headers);

        // 2. Find 'PO' Column (Flexible)
        let poHeaderIndex = headersLower.findIndex(h => h.includes('po number') || h === 'po' || h === 'po_number');
        if (poHeaderIndex === -1) poHeaderIndex = 1; // Fallback to Col B

        // 3. Find 'ReqNum' Column (Flexible)
        // Looks for "reqnum", "req num", "req no", or just starts with "req"
        let refHeaderIndex = headersLower.findIndex(h => h === 'reqnum' || h === 'req num' || h === 'req no' || h.startsWith('req'));
        if (refHeaderIndex === -1) refHeaderIndex = 0; // Fallback to Col A

        console.log(`Mapping: PO is Col ${poHeaderIndex}, ReqNum is Col ${refHeaderIndex}`);

        const poDataByPO = {};
        const poDataByRef = {};

        // 4. Parse Rows
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);

            // Map values to headers
            const poEntry = {};
            headers.forEach((header, index) => {
                let val = values[index] || '';
                if (header.toLowerCase() === 'amount') {
                    val = val.replace(/,/g, '') || '0';
                }
                poEntry[header] = val;
            });

            // Index by PO
            const poKey = values[poHeaderIndex] ? values[poHeaderIndex].toUpperCase() : null;
            if (poKey) poDataByPO[poKey] = poEntry;

            // Index by Ref (ReqNum) - CRITICAL: Force String and Trim
            const rawRef = values[refHeaderIndex];
            if (rawRef) {
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


function normalizeSummaryPOKey(value) {
    let po = String(value || '').replace(/^\uFEFF/, '').replace(/\u00A0/g, ' ').trim();
    po = po.replace(/^"|"$/g, '').trim().toUpperCase();
    return po;
}

function getSummaryPOKeyVariants(value) {
    const base = normalizeSummaryPOKey(value);
    if (!base) return [];

    const variants = [base];
    const noCommas = base.replace(/,/g, '').trim();
    if (noCommas && noCommas !== base) variants.push(noCommas);

    // Excel sometimes exports numeric-looking PO values as 12345.00.
    const decimalTrimmed = noCommas.replace(/\.0+$/, '');
    if (decimalTrimmed && decimalTrimmed !== noCommas) variants.push(decimalTrimmed);

    return [...new Set(variants)];
}

async function refreshSummaryPODetailsCSV() {
    try {
        const url = await getFirebaseCSVUrl('POdetails.csv');
        if (!url) return false;

        console.log('Refreshing POdetails.csv for Summary Note...');
        const freshEpicoreData = await fetchAndParseEpicoreCSV(url, { silent: true });
        if (!freshEpicoreData) return false;

        allEpicoreData = freshEpicoreData;
        setCache('cached_EPICORE', allEpicoreData);
        cacheTimestamps.epicoreData = Date.now();
        console.log('Summary Note POdetails.csv refreshed successfully.');
        return true;
    } catch (error) {
        console.warn('Summary Note POdetails refresh failed. Existing data will be used if available.', error);
        return false;
    }
}

async function fetchAndParseEpicoreCSV(url, options = {}) {
    try {
        const csvText = await fetchCsvTextWithFallback(url, 'POdetails.csv');

        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
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

        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 1) {
            throw new Error("POdetails CSV is empty.");
        }

        const epicoreMap = {};
        
        // Start loop from 1 to skip the header row
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);

            // Column Mapping for POdetails.csv (0-based index):
            // A[0] = PO. No, B[1] = Bill Description
            if (values.length >= 2) {
                const poKeyVariants = getSummaryPOKeyVariants(values[0]);
                const description = values[1] || ''; 

                poKeyVariants.forEach((poKey) => {
                    epicoreMap[poKey] = description;
                });
            }
        }
        console.log(`Successfully fetched and parsed ${Object.keys(epicoreMap).length} entries from POdetails CSV.`);
        return epicoreMap;
    } catch (error) {
        console.error("Error fetching or parsing POdetails CSV:", error);
        if (!options.silent) {
            alert("CRITICAL ERROR: Could not load POdetails data.");
        }
        return null;
    }
}

async function fetchAndParseSitesCSV(url) {
    try {
        const csvText = await fetchCsvTextWithFallback(url, 'Site.csv');
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Site.csv is empty or has no data rows.");
        }
        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
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
        const csvText = await fetchCsvTextWithFallback(url, 'ECommit.csv');
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Ecommit CSV is empty or has no data rows.");
        }

        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
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

        const cleanInvoiceNumber = (str) => {
            if (!str) return '';
            let cleanStr = str.trim().replace(/^"|"$/g, '');
            if (cleanStr.toUpperCase().includes('E+')) {
                try {
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

        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        const headerMap = {};
        headers.forEach((h, i) => {
            headerMap[h] = i;
        });

        const requiredHeaders = ['PO', 'Whse', 'Date', 'Sys Date', 'Name', 'Packing Slip', 'Extended Cost'];
        if (!requiredHeaders.every(h => headerMap.hasOwnProperty(h))) {
    console.warn("Ecommit CSV is missing required headers. Ecommit data will be empty.");
    return {};
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
                    summedRecords.set(key, {
                        ...record
                    });
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
                    source: 'ECommit',
                    key: `ECommit_${record.packingSlip}`
                });
            });
            finalEcommitData[po] = formattedRecords;
        });

        console.log(`Successfully processed ${Object.keys(finalEcommitData).length} POs from Ecommit.csv.`);
        return finalEcommitData;
    } catch (error) {
        // 9.5.2: ECommit.csv is optional supporting data.
        // Do not stop login/refresh or block Invoice Management when this CSV is missing,
        // temporarily unavailable, too large, or blocked by network/cache/CORS.
        // Invoice records can still load Firebase invoices without ECommit values.
        console.warn("ECommit.csv could not be loaded. Continuing without ECommit data.", error);
        return {};
    }
}
async function fetchAndParseEcostCSV(url) {
    try {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Ecost CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Ecost CSV is empty or has no data rows.");
        }

        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
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

        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        const headerMap = {};
        headers.forEach((h, i) => {
            headerMap[h] = i;
        });

        const requiredHeaders = ['Order Date', 'Project #', 'Name', 'Line Amount', 'Delivered Amount', 'Outstanding', 'Activity Name'];
        for (const h of requiredHeaders) {
            if (typeof headerMap[h] === 'undefined') {
                console.warn(`Ecost CSV is missing expected header: ${h}`);
            }
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
            let orderDate = null;
            let year = null;
            let month = null;

            if (orderDateStr && orderDateStr.includes('-')) {
                const parts = orderDateStr.split('-');
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const monthIndex = parseInt(parts[1], 10) - 1;
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
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('ensure-ecost-data-fetched', true)) {
        try { loadDataFromLocalStorage(); } catch (_) {}
        return allEcostData || [];
    }
    const now = Date.now();
    if (!forceRefresh && allEcostData && (now - ecostDataTimestamp < CACHE_DURATION)) {
        return allEcostData;
    }

    console.log("Fetching Ecost.csv data...");
    const url = await getFirebaseCSVUrl('Ecost.csv');

    if (url) {
        try {
            allEcostData = await fetchAndParseEcostCSV(url);
            if (allEcostData) {
                ecostDataTimestamp = now;
                console.log("Ecost.csv data cached.");
            } else {
                console.warn("Ecost.csv could not be parsed. Dashboard will show empty.");
                allEcostData = [];
                ecostDataTimestamp = now;
            }
        } catch (error) {
            console.error("Error fetching Ecost.csv:", error);
            allEcostData = [];
            ecostDataTimestamp = now;
            // Remove the alert that bothers the user
        }
    }
    return allEcostData || [];
}

// =========================================================
// DATA FETCHER (Reads from 'purchase_orders' in Invoice DB)
// =========================================================
// =========================================================
// 10.4.2 — INVOICE MANAGEMENT FEATURE FLAGS + LIGHT PO BASE DATA
// Purpose: keep purchase_orders OFF by default and avoid downloading the full
// invoice_entries tree for simple Invoice Entry / Batch Entry PO lookup.
// The Manual PO / Vacation Mode switch is stored under purchase_orders/__settings
// because purchase_orders is the existing path used by the manual PO popup.
// =========================================================
window.imUseFirebasePurchaseOrders = false;
window.__imFeatureFlagsLoadedAt = 0;
const IM_PO_FALLBACK_SETTING_PATH = 'purchase_orders/__settings/manualPOFallbackEnabled';

function imNormalizeSuperAdminName(value) {
    return String(value || '').trim().toLowerCase();
}

function imIsCurrentUserSuperAdmin() {
    try {
        const userName = imNormalizeSuperAdminName(currentApprover?.Name || window.currentUser?.Name || window.currentUser?.username || '');
        const superName = imNormalizeSuperAdminName((typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) ? SUPER_ADMIN_NAME : 'Irwin');
        return !!(userName && superName && userName === superName);
    } catch (_) {
        return false;
    }
}

function isInvoiceFirebasePOFallbackEnabled() {
    return window.imUseFirebasePurchaseOrders === true;
}

function updateInvoicePOFallbackUI() {
    const box = document.getElementById('im-admin-controls');
    const toggle = document.getElementById('im-po-fallback-toggle');
    const pill = document.getElementById('im-po-fallback-status');
    const modeTitle = document.getElementById('im-po-fallback-mode-title');
    const modeDesc = document.getElementById('im-po-fallback-mode-desc');
    const canManage = imIsCurrentUserSuperAdmin();
    const isOn = window.imUseFirebasePurchaseOrders === true;

    if (box) {
        box.classList.toggle('hidden', !canManage);
        box.classList.toggle('is-vacation-mode', isOn);
        box.classList.toggle('is-normal-mode', !isOn);
    }
    if (toggle) {
        toggle.checked = isOn;
        toggle.disabled = !canManage;
        toggle.setAttribute('aria-checked', isOn ? 'true' : 'false');
    }
    if (pill) {
        pill.textContent = isOn ? 'ON' : 'OFF';
        pill.classList.toggle('is-on', isOn);
        pill.classList.toggle('is-off', !isOn);
    }
    if (modeTitle) {
        modeTitle.textContent = isOn ? 'Vacation Mode' : 'Normal Mode';
    }
    if (modeDesc) {
        modeDesc.textContent = isOn
            ? 'CSV first. If missing, check exact Firebase manual PO and allow the manual PO popup.'
            : 'POVALUE2.csv only. Firebase manual PO lookup and popup are disabled.';
    }
}

async function loadInvoiceFeatureFlags(forceRefresh = false) {
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('load-invoice-feature-flags', true)) {
        window.imUseFirebasePurchaseOrders = false;
        updateInvoicePOFallbackUI();
        return { useFirebasePurchaseOrders: false };
    }
    const now = Date.now();
    if (!forceRefresh && window.__imFeatureFlagsLoadedAt && (now - window.__imFeatureFlagsLoadedAt < CACHE_DURATION)) {
        updateInvoicePOFallbackUI();
        return { useFirebasePurchaseOrders: window.imUseFirebasePurchaseOrders === true };
    }

    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) {
            window.imUseFirebasePurchaseOrders = false;
            updateInvoicePOFallbackUI();
            return { useFirebasePurchaseOrders: false };
        }

        const snap = await invoiceDb.ref(IM_PO_FALLBACK_SETTING_PATH).once('value');
        window.imUseFirebasePurchaseOrders = snap.val() === true;
        window.__imFeatureFlagsLoadedAt = now;
        updateInvoicePOFallbackUI();
        return { useFirebasePurchaseOrders: window.imUseFirebasePurchaseOrders === true };
    } catch (error) {
        console.warn('Invoice Management feature flags could not be loaded. Firebase PO fallback remains OFF.', error);
        window.imUseFirebasePurchaseOrders = false;
        updateInvoicePOFallbackUI();
        return { useFirebasePurchaseOrders: false };
    }
}

async function setInvoiceFirebasePOFallbackEnabled(enabled) {
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('set-invoice-firebase-po-fallback', false)) {
        alert('TEST MODE: Firebase is disabled. Use the live system to change Manual PO / Vacation Mode.');
        updateInvoicePOFallbackUI();
        return false;
    }
    if (!imIsCurrentUserSuperAdmin()) {
        alert('Access Denied: Super Admin only.');
        updateInvoicePOFallbackUI();
        return false;
    }
    const nextValue = enabled === true;
    try {
        await invoiceDb.ref(IM_PO_FALLBACK_SETTING_PATH).set(nextValue);
        window.imUseFirebasePurchaseOrders = nextValue;
        window.__imFeatureFlagsLoadedAt = Date.now();
        updateInvoicePOFallbackUI();
        return true;
    } catch (error) {
        console.error('Failed to update Firebase PO fallback setting:', error);
        alert('Could not update Manual PO / Vacation Mode. Please check Firebase permission for purchase_orders/__settings.');
        updateInvoicePOFallbackUI();
        return false;
    }
}

async function ensureInvoicePOBaseDataFetched(forceRefresh = false) {
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('ensure-invoice-po-base-data-fetched', true)) {
        try { loadDataFromLocalStorage(); } catch (_) {}
        return;
    }
    const now = Date.now();
    const hasSupportingBase = allSitesCSVData && allVendorsData;

    if (!forceRefresh) {
        try { loadDataFromLocalStorage(); } catch (_) {}
    }

    const tasks = [];
    const taskNames = [];

    // 10.7.4: Always refresh POVALUE2.csv for Invoice PO lookup so GitHub-uploaded
    // PO changes take effect immediately. Use an in-flight guard to avoid duplicate
    // parallel downloads if multiple modules ask at the same time.
    if (IM_ALWAYS_REFRESH_POVALUE2_CSV || !allPOData || forceRefresh) {
        tasks.push(refreshPOVALUE2CsvNow(forceRefresh ? 'force' : 'invoice-po-lookup'));
        taskNames.push('po');
    }
    if (!allSitesCSVData || forceRefresh) {
        const siteUrl = await getFirebaseCSVUrl('Site.csv');
        if (siteUrl) { tasks.push(fetchAndParseSitesCSV(siteUrl)); taskNames.push('site'); }
    }
    if (!allVendorsData || forceRefresh) {
        const vendorUrl = await getFirebaseCSVUrl('Vendors.csv');
        if (vendorUrl) { tasks.push(fetchAndParseVendorsCSV(vendorUrl)); taskNames.push('vendor'); }
    }

    const results = await Promise.all(tasks);
    results.forEach((result, index) => {
        const name = taskNames[index];
        if (name === 'po' && result) {
            allPOData = result.poDataByPO || {};
            allPODataByRef = result.poDataByRef || {};
            cacheTimestamps.poData = now;
        } else if (name === 'site') {
            allSitesCSVData = result || [];
            cacheTimestamps.sitesCSV = now;
        } else if (name === 'vendor') {
            allVendorsData = result || {};
        }
    });
}

try {
    window.imIsCurrentUserSuperAdmin = imIsCurrentUserSuperAdmin;
    window.isInvoiceFirebasePOFallbackEnabled = isInvoiceFirebasePOFallbackEnabled;
    window.loadInvoiceFeatureFlags = loadInvoiceFeatureFlags;
    window.setInvoiceFirebasePOFallbackEnabled = setInvoiceFirebasePOFallbackEnabled;
    window.updateInvoicePOFallbackUI = updateInvoicePOFallbackUI;
    window.ensureInvoicePOBaseDataFetched = ensureInvoicePOBaseDataFetched;
    window.ensureInvoiceLightDataFetched = async function(forceRefresh = false) {
        return ensureInvoiceDataFetched(forceRefresh, { includeInvoiceEntries: false });
    };
} catch (_) {}

async function ensureInvoiceDataFetched(forceRefresh = false, options = {}) {
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('ensure-invoice-data-fetched', true)) {
        try { loadDataFromLocalStorage(); } catch (_) {}
        return;
    }
    if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('ensure-invoice-data-fetched', true)) return;
    const now = Date.now();
    const includeInvoiceEntries = !(options && options.includeInvoiceEntries === false);
    // 11.0.5: Some pages only need PO/site/vendor CSV data. They can pass
    // { includeInvoiceEntries:false } to avoid the heavy invoice_entries full-tree read.
    // Existing callers keep the old accurate behavior because the default remains true.
    // 10.5.4: Direct PO searches store only a partial allInvoiceData cache.
    // Do not treat a partial PO cache as the full invoice dataset, otherwise
    // Batch Entry note suggestions stay empty after using fast PO search.
    const invoiceEntriesFullyLoaded = (window.__invoiceEntriesFullLoaded === true);

    if (!forceRefresh && allPOData && allEpicoreData && allSitesCSVData && allEcommitDataProcessed && allVendorsData) {
        if (!includeInvoiceEntries || (allInvoiceData && invoiceEntriesFullyLoaded)) return;
    }

    if (!forceRefresh) {
        loadDataFromLocalStorage();
    }

    try {
        const promisesToRun = [];
        // URLs
        const poUrl = (IM_ALWAYS_REFRESH_POVALUE2_CSV || !allPOData || forceRefresh) ? await getFirebaseCSVUrl('POVALUE2.csv') : null;
        const poDetailsUrl = (!allEpicoreData || forceRefresh) ? await getFirebaseCSVUrl('POdetails.csv') : null;
        const siteUrl = (!allSitesCSVData || forceRefresh) ? await getFirebaseCSVUrl('Site.csv') : null;
        const ecommitUrl = (!allEcommitDataProcessed || forceRefresh) ? await getFirebaseCSVUrl('ECommit.csv') : null;
        const vendorUrl = (!allVendorsData || forceRefresh) ? await getFirebaseCSVUrl('Vendors.csv') : null;

        // 10.4.1: Do NOT bulk-download invoiceDb/purchase_orders during normal Invoice Management use.
        // Firebase PO fallback is controlled by a Super Admin toggle and, when ON, checks only the exact searched PO.
        const needManualPOs = false;

        if (poUrl) {
            console.log("Fetching POVALUE2.csv...");
            promisesToRun.push(fetchAndParseCSV(poUrl));
        }

        if (needManualPOs) {
            console.log("Fetching Manual POs from purchase_orders...");
            // Use invoiceDb (invoiceentry-b15a8) instead of db
            promisesToRun.push(invoiceDb.ref('purchase_orders').once('value'));
        }

        if (poDetailsUrl) promisesToRun.push(fetchAndParseEpicoreCSV(poDetailsUrl));
        if (siteUrl) promisesToRun.push(fetchAndParseSitesCSV(siteUrl));
        if (ecommitUrl) promisesToRun.push(fetchAndParseEcommitCSV(ecommitUrl));
        if (vendorUrl) promisesToRun.push(fetchAndParseVendorsCSV(vendorUrl));

        const shouldFetchFullInvoiceEntries = includeInvoiceEntries && (!allInvoiceData || forceRefresh || window.__invoiceEntriesFullLoaded !== true);
        if (shouldFetchFullInvoiceEntries) {
            try { console.warn('[IBA Firebase Download] Full invoice_entries read requested by ensureInvoiceDataFetched(). This should be limited to Invoice Records/Financial Reports/export/report actions only.'); } catch (_) {}
            promisesToRun.push(invoiceDb.ref('invoice_entries').once('value'));
        }

        const results = await Promise.all(promisesToRun);
        let resultIndex = 0;
        let manualPOSnapshot = null;

        if (poUrl) {
            // 1) CSV Result
            const csvData = results[resultIndex++];
            if (csvData === null) throw new Error("Failed to load POVALUE2.csv");

            allPOData = csvData.poDataByPO;
            allPODataByRef = csvData.poDataByRef;
            cacheTimestamps.poData = now;
        }

        // Manual POs (from purchase_orders) may be fetched even if poUrl is null
        if (needManualPOs) {
            manualPOSnapshot = results[resultIndex++];
            const manualPOData = (manualPOSnapshot && typeof manualPOSnapshot.val === 'function') ? (manualPOSnapshot.val() || {}) : {};

            if (manualPOData && Object.keys(manualPOData).length) {
                console.log("Merging Manual POs into memory...");
                if (!allPOData) allPOData = {};
              Object.keys(manualPOData).forEach(poKey => {
                    const normalizedKey = String(poKey || '').trim().toUpperCase();
                    const poObj = manualPOData[poKey] || {};
                    // Backward-compat: some older records used colon in keys (e.g. 'Project ID:')
                    if (poObj['Project ID:'] && !poObj['Project ID']) poObj['Project ID'] = poObj['Project ID:'];
                    if (poObj['Supplier Name:'] && !poObj['Supplier Name']) poObj['Supplier Name'] = poObj['Supplier Name:'];
                    // More backward-compat / alternate headers
                    if (poObj['Supplier'] && !poObj['Supplier Name']) poObj['Supplier Name'] = poObj['Supplier'];
                    if (poObj['Supplier:'] && !poObj['Supplier Name']) poObj['Supplier Name'] = poObj['Supplier:'];
                    if (poObj['Po'] && !poObj['PO']) poObj['PO'] = poObj['Po'];
                    if (poObj['PO'] && !poObj['Po']) poObj['Po'] = poObj['PO'];
                    
                    const finalKey = normalizedKey || poKey;
                    
                    // NEW: Only use Firebase PO if it does NOT exist in the GitHub CSV
                    if (!allPOData[finalKey]) {
                        allPOData[finalKey] = poObj; 
                    }
                });
            }

            manualPOsMergedIntoAllPOData = true;
        }

        if (poDetailsUrl) {
            allEpicoreData = results[resultIndex++];
            setCache('cached_EPICORE', allEpicoreData);
            cacheTimestamps.epicoreData = now;
        }
        if (siteUrl) {
            allSitesCSVData = results[resultIndex++];
            setCache('cached_SITES', allSitesCSVData);
            cacheTimestamps.sitesCSV = now;
        }
        if (ecommitUrl) {
            // 9.5.2: Treat ECommit as optional. An empty object is valid and prevents
            // repeated critical alerts after browser refresh/F5.
            allEcommitDataProcessed = results[resultIndex++] || {};
            cacheTimestamps.ecommitData = now;
        }
        if (vendorUrl) {
            allVendorsData = results[resultIndex++] || {};
        }

        if (shouldFetchFullInvoiceEntries) {
            const invoiceSnapshot = results[resultIndex++];
            allInvoiceData = invoiceSnapshot.val() || {};
            window.__invoiceEntriesFullLoaded = true;
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
        alert("CRITICAL ERROR: Failed to download data. Check connection.");
        throw error;
    }
}

// ==========================================================================
// DATA FETCHER (Reverted to 4.7.2 Logic + Force Refresh Support)
// ==========================================================================
function wdRebuildAllSystemEntriesFromFamilyCaches() {
    // 10.3.0: Invoice Management updates can clear allSystemEntries while the
    // WorkDesk family cache is still fresh. Rebuild the combined list from the
    // already-fetched family caches so Active Task tabs such as New Entry do not
    // disappear until a full refresh happens.
    const workdesk = Array.isArray(workdeskSystemEntries) ? workdeskSystemEntries : [];
    const inventory = Array.isArray(inventorySystemEntries) ? inventorySystemEntries : [];
    allSystemEntries = [...workdesk, ...inventory];
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return allSystemEntries;
}

try { window.wdRebuildAllSystemEntriesFromFamilyCaches = wdRebuildAllSystemEntriesFromFamilyCaches; } catch (_) {}

async function ensureAllEntriesFetched(forceRefresh = false, options = {}) { 
    const now = Date.now();
    const inventoryContext = (typeof isInventoryContext === 'function') ? isInventoryContext() : false;
    const requestedMode = String(options.mode || (inventoryContext ? 'inventory' : 'workdesk')).toLowerCase();
    const loadMode = ['inventory', 'workdesk', 'all'].includes(requestedMode) ? requestedMode : 'workdesk';
    const shouldLoadJobEntries = loadMode !== 'inventory' || options.includeJobEntries === true;
    const shouldLoadTransferEntries = loadMode === 'inventory' || loadMode === 'all' || options.includeTransfers === true;
    const cacheFresh = (now - cacheTimestamps.systemEntries < CACHE_DURATION);

    // 10.2.5: Do not make WorkDesk pages download the full Inventory transfer_entries
    // tree, and do not make Inventory pages redownload Job Entries just because the
    // other family is already cached. Keep a separate freshness check per family.
    if (!forceRefresh && cacheFresh) {
        if (loadMode === 'workdesk' && Array.isArray(workdeskSystemEntries) && workdeskSystemEntries.length > 0) {
            wdRebuildAllSystemEntriesFromFamilyCaches();
            return;
        }
        if (loadMode === 'inventory' && Array.isArray(inventorySystemEntries) && inventorySystemEntries.length > 0) {
            wdRebuildAllSystemEntriesFromFamilyCaches();
            return;
        }
        if (loadMode === 'all' && Array.isArray(allSystemEntries) && allSystemEntries.length > 0) return;
    }

    console.log(`Loading Data for ${loadMode === 'inventory' ? 'Inventory' : (loadMode === 'all' ? 'All Records' : 'Workdesk')}...`);

    let poDataByPO = allPOData || {};
    let poDataByRef = {};

    if (shouldLoadJobEntries) {
        // Added cache-buster to the raw github content link. Job Entries need PO matching;
        // Inventory-only loads do not.
        const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv?v=" + new Date().getTime();
        const csvResult = await fetchAndParseCSV(PO_DATA_URL) || {};
        poDataByPO = csvResult.poDataByPO || {};
        poDataByRef = csvResult.poDataByRef || {};
        allPOData = poDataByPO;
    }

    const [jobEntriesSnapshot, transferSnapshot] = await Promise.all([
        shouldLoadJobEntries ? db.ref('job_entries').once('value') : Promise.resolve(null),
        shouldLoadTransferEntries ? db.ref('transfer_entries').once('value') : Promise.resolve(null)
    ]);

    const jobEntriesData = jobEntriesSnapshot && typeof jobEntriesSnapshot.val === 'function' ? (jobEntriesSnapshot.val() || {}) : null;
    const transferData = transferSnapshot && typeof transferSnapshot.val === 'function' ? (transferSnapshot.val() || {}) : null;

    const processedWorkdeskEntries = [];
    const processedInventoryEntries = [];
    const updatesToFirebase = {};

    if (jobEntriesData) {
        Object.entries(jobEntriesData).forEach(([key, value]) => {
            let entry = { key, ...value, source: 'job_entry' };

            // PR Matching Logic
            if (entry.for === 'PR' && entry.ref) {
                const refKey = String(entry.ref).trim();
                const csvMatch = poDataByRef[refKey] || poDataByRef[refKey.toUpperCase()];
                if (csvMatch) {
                    const newPO = csvMatch['PO'] || csvMatch['PO Number'] || '';
                    const newVendor = csvMatch['Supplier Name'] || csvMatch['Supplier'] || 'N/A';
                    const newAmount = csvMatch['Amount'] || '';
                    const newAttention = csvMatch['Buyer Name'] || csvMatch['Entry Person'] || 'Records';
                    let rawDate = csvMatch['Order Date'] || '';
                    let newDate = rawDate ? formatYYYYMMDD(normalizeDateForInput(rawDate)) : rawDate;
                    
                    entry.po = newPO;
                    entry.vendorName = newVendor;
                    entry.amount = newAmount;
                    entry.attention = newAttention;
                    entry.dateResponded = newDate;
                    entry.remarks = 'PO Ready'; 

                    if (value.remarks !== 'PO Ready') {
                        updatesToFirebase[key] = { po: newPO, vendorName: newVendor, amount: newAmount, attention: newAttention, dateResponded: newDate, remarks: 'PO Ready' };
                    }
                }
            }
            if (!entry.vendorName && entry.po && poDataByPO[entry.po]) {
                entry.vendorName = poDataByPO[entry.po]['Supplier Name'] || 'N/A';
            }
            processedWorkdeskEntries.push(entry);
        });
    }

    if (transferData) {
        Object.entries(transferData).forEach(([key, value]) => {
            const from = value.fromLocation || value.fromSite || 'N/A';
            const to = value.toLocation || value.toSite || 'N/A';
            let combinedSite = `${from} ➔ ${to}`;
            if (value.jobType === 'Usage') combinedSite = `Used at ${from}`;

            let contactPerson = value.receiver || 'N/A';
            if (value.remarks === 'Pending') contactPerson = value.approver;

            processedInventoryEntries.push({
                key,
                ...value,
                source: 'transfer_entry',
                productID: value.productID || '',
                jobType: value.jobType || 'Transfer',
                for: value.jobType || 'Transfer',
                ref: value.controlNumber || value.controlId || value.ref || key,
                po: value.controlNumber || value.controlId || value.ref || key,
                site: combinedSite,
                contactName: contactPerson,
                vendorName: value.productName,
                remarks: value.remarks || value.status || 'Pending'
            });
        });
    }

    if (Object.keys(updatesToFirebase).length > 0) {
        try { await db.ref('job_entries').update(updatesToFirebase); } catch (e) {}
    }

    if (jobEntriesData) workdeskSystemEntries = processedWorkdeskEntries;
    if (transferData) inventorySystemEntries = processedInventoryEntries;

    allSystemEntries = [
        ...(Array.isArray(workdeskSystemEntries) ? workdeskSystemEntries : []),
        ...(Array.isArray(inventorySystemEntries) ? inventorySystemEntries : [])
    ];
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (Array.isArray(workdeskSystemEntries)) workdeskSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (Array.isArray(inventorySystemEntries)) inventorySystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    cacheTimestamps.systemEntries = now;
    console.log(`Loaded ${allSystemEntries.length} entries. WorkDesk: ${workdeskSystemEntries.length}, Inventory: ${inventorySystemEntries.length}.`);
}

async function ensureApproverDataCached(force = false) {
    // Keep this cache reasonably fresh because Vacation Delegation depends on it.
    // We re-fetch when:
    //  - force == true, OR
    //  - cache is empty, OR
    //  - cache is older than MAX_AGE_MS.
    const MAX_AGE_MS = 60 * 1000; // 1 minute (safe + light)
    const now = Date.now();

    try {
        if (!force && allApproverDataCache && cacheTimestamps && cacheTimestamps.approverData && (now - cacheTimestamps.approverData) < MAX_AGE_MS) {
            return;
        }
        if (!force && allApproverDataCache && (!cacheTimestamps || !cacheTimestamps.approverData)) {
            // Backward compatibility: if old builds never set the timestamp, keep current cache.
            return;
        }

        const snapshot = await db.ref('approvers').once('value');
        allApproverDataCache = snapshot.val() || {};
        allApproverData = allApproverDataCache; // keep in sync for older logic paths
        if (cacheTimestamps) cacheTimestamps.approverData = now;
        console.log("Approver data cached/refreshed for position-matching.");
    } catch (e) {
        // Never hard-fail the UI if caching fails.
        console.warn("ensureApproverDataCached failed:", e);
    }
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
        const csvText = await fetchCsvTextWithFallback(url, 'Vendors.csv');
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


// #endregion BLOCK 06 — LOCAL CACHE + CSV / DATA FETCHERS
