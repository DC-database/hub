/* ==========================================================================
   js/app-data-cache.js
   IBA shared local cache, CSV fetchers/parsers, and Firebase data loaders.
   Version: 8.2.0

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

    const baseUrl = "https://cdn.jsdelivr.net/gh/DC-database/Hub@main/";
    const cacheBuster = "?v=" + new Date().getTime();
    return `${baseUrl}${filename}${cacheBuster}`;
}

async function silentlyRefreshStaleCaches() {
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

async function fetchAndParseCSV(url) {
    try {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
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
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();

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
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Sites CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
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
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
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
        console.error("Error fetching or parsing Ecommit CSV:", error);
        alert("CRITICAL ERROR: Could not load Ecommit data.");
        return null;
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
async function ensureInvoiceDataFetched(forceRefresh = false) {
    const now = Date.now();

    if (!forceRefresh && allPOData && allInvoiceData && allEpicoreData && allSitesCSVData && allEcommitDataProcessed && allVendorsData) {
        return;
    }

    if (!forceRefresh) {
        loadDataFromLocalStorage();
    }

    try {
        const promisesToRun = [];
        // URLs
        const poUrl = (!allPOData || forceRefresh) ? await getFirebaseCSVUrl('POVALUE2.csv') : null;
        const poDetailsUrl = (!allEpicoreData || forceRefresh) ? await getFirebaseCSVUrl('POdetails.csv') : null;
        const siteUrl = (!allSitesCSVData || forceRefresh) ? await getFirebaseCSVUrl('Site.csv') : null;
        const ecommitUrl = (!allEcommitDataProcessed || forceRefresh) ? await getFirebaseCSVUrl('ECommit.csv') : null;
        const vendorUrl = (!allVendorsData || forceRefresh) ? await getFirebaseCSVUrl('Vendors.csv') : null;

        // IMPORTANT: Manual POs live in invoiceDb/purchase_orders and must be merged even if allPOData
        // was already populated earlier (e.g., from Workdesk).
        const needManualPOs = forceRefresh || !manualPOsMergedIntoAllPOData;

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

        if (!allInvoiceData || forceRefresh) {
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
            allEcommitDataProcessed = results[resultIndex++];
            cacheTimestamps.ecommitData = now;
        }
        if (vendorUrl) {
            allVendorsData = results[resultIndex++] || {};
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
        alert("CRITICAL ERROR: Failed to download data. Check connection.");
        throw error;
    }
}

// ==========================================================================
// DATA FETCHER (Reverted to 4.7.2 Logic + Force Refresh Support)
// ==========================================================================
async function ensureAllEntriesFetched(forceRefresh = false) { 
    const now = Date.now();
    
    // 1. Check Cache
    if (!forceRefresh && allSystemEntries.length > 0 && (now - cacheTimestamps.systemEntries < CACHE_DURATION)) {
        return;
    }

    console.log("Loading Data for Workdesk...");

    // Added cache-buster to the raw github content link
    const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv?v=" + new Date().getTime();
    const { poDataByPO, poDataByRef } = await fetchAndParseCSV(PO_DATA_URL) || {};

    allPOData = poDataByPO || {};
    const purchaseOrdersDataByRef = poDataByRef || {};

    // 2. Fetch from Firebase (Standard + Transfers)
    // Removed orderByChild to ensure we get ALL data, even if timestamp is missing
    const [jobEntriesSnapshot, transferSnapshot] = await Promise.all([
        db.ref('job_entries').once('value'),
        db.ref('transfer_entries').once('value')
    ]);

    const jobEntriesData = jobEntriesSnapshot.val() || {};
    const transferData = transferSnapshot.val() || {};

    const processedEntries = [];
    const updatesToFirebase = {};

    // 3. Process Job Entries
    Object.entries(jobEntriesData).forEach(([key, value]) => {
        let entry = { key, ...value, source: 'job_entry' };

        // PR Matching Logic
        if (entry.for === 'PR' && entry.ref) {
            const refKey = String(entry.ref).trim();
            const csvMatch = purchaseOrdersDataByRef[refKey] || purchaseOrdersDataByRef[refKey.toUpperCase()];
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
        if (!entry.vendorName && entry.po && allPOData[entry.po]) {
            entry.vendorName = allPOData[entry.po]['Supplier Name'] || 'N/A';
        }
        processedEntries.push(entry);
    });

    // 4. Process Transfer Entries (THIS IS WHAT POPULATES THE TAB)
    Object.entries(transferData).forEach(([key, value]) => {
        const from = value.fromLocation || value.fromSite || 'N/A';
        const to = value.toLocation || value.toSite || 'N/A';
        let combinedSite = `${from} ➔ ${to}`;
        if (value.jobType === 'Usage') combinedSite = `Used at ${from}`;

        let contactPerson = value.receiver || 'N/A';
        if (value.remarks === 'Pending') contactPerson = value.approver;

        processedEntries.push({
            key,
            ...value,
            source: 'transfer_entry',
            productID: value.productID || '',
            jobType: value.jobType || 'Transfer',
            for: value.jobType || 'Transfer', // <--- This 'for' property creates the Tab
            ref: value.controlNumber,
            controlId: value.controlNumber,
            site: combinedSite,
            orderedQty: value.requiredQty || 0,
            deliveredQty: value.receivedQty || 0,
            // 7.7.6: if no shipping date was entered, show the record date/created date instead of N/A.
            shippingDate: value.shippingDate || (value.createdAt ? String(value.createdAt).slice(0, 10) : (value.date || 'N/A')),
            arrivalDate: value.arrivalDate || 'N/A',
            contactName: contactPerson,
            vendorName: value.productName,
            remarks: value.remarks || value.status || 'Pending'
        });
    });

    if (Object.keys(updatesToFirebase).length > 0) {
        try { await db.ref('job_entries').update(updatesToFirebase); } catch (e) {}
    }

    // 5. Sort & Save
    allSystemEntries = processedEntries;
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Inventory Phase 2: keep separate record families for Job Records.
    // This prevents Inventory Job Records from depending on the WorkDesk/Invoice list renderer source.
    inventorySystemEntries = allSystemEntries.filter(entry => (typeof isInventoryTaskRecord === 'function') ? isInventoryTaskRecord(entry) : ['Transfer', 'Restock', 'Return', 'Usage'].includes(entry.for));
    workdeskSystemEntries = allSystemEntries.filter(entry => (typeof isInventoryTaskRecord === 'function') ? !isInventoryTaskRecord(entry) : !['Transfer', 'Restock', 'Return', 'Usage'].includes(entry.for));
    
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
        const response = await fetch(url, {
            cache: 'no-store'
        });
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


// #endregion BLOCK 06 — LOCAL CACHE + CSV / DATA FETCHERS
