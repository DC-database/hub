/* ==========================================================================
   js/app-data-cache.js
   IBA shared local cache, CSV fetchers/parsers, and Firebase data loaders.
   Version: 11.2.1

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


// 11.1.2: POVALUE2.csv is a GitHub/static CSV source, not Firebase billing data.
// It is large enough that Dashboard must never re-download it during every refresh.
// Keep one in-flight request, reuse memory cache, and throttle automatic refreshes.
const IM_ALWAYS_REFRESH_POVALUE2_CSV = false; // legacy flag kept for compatibility; do not force every caller.
const IM_POVALUE2_AUTO_REFRESH_MIN_MS = 10 * 60 * 1000; // 10 minutes minimum between automatic CSV refreshes.
// 11.1.8: Some legacy WorkDesk/Job Entry paths call public force refresh repeatedly.
// Treat repeated force calls as unsafe unless the memory cache is missing or the cooldown has passed.
const IM_POVALUE2_FORCE_REFRESH_MIN_MS = 10 * 60 * 1000;
window.__imPOVALUE2InFlight = null;
window.__imLastPOVALUE2RefreshAt = window.__imLastPOVALUE2RefreshAt || 0;
// 11.1.2: Internal function name is intentionally different from window.refreshPOVALUE2CsvNow
// to avoid a browser global recursion / maximum call stack error.

function hasPOVALUE2MemoryIndex() {
    try {
        return !!(allPOData && Object.keys(allPOData || {}).length);
    } catch (_) {
        return !!allPOData;
    }
}

function shouldRefreshPOVALUE2Csv(forceRefresh = false, reason = '') {
    const now = Date.now();
    const last = Number(window.__imLastPOVALUE2RefreshAt || (cacheTimestamps && cacheTimestamps.poData) || 0);
    if (!hasPOVALUE2MemoryIndex()) return true;

    // 11.1.8: protect WorkDesk/Dashboard from repeated legacy force refresh calls.
    // A caller saying "force" every few seconds must not redownload the 39k PO CSV each time.
    if (forceRefresh) {
        const age = now - last;
        if (age < IM_POVALUE2_FORCE_REFRESH_MIN_MS) {
            return false;
        }
        return true;
    }

    // Dashboard/invoice lookup may call this often. Reuse the indexed CSV.
    if (now - last < IM_POVALUE2_AUTO_REFRESH_MIN_MS) return false;
    return false; // keep automatic Dashboard refresh from reloading CSV; manual/force only.
}

function getPOVALUE2CachedResult() {
    return { poDataByPO: allPOData || {}, poDataByRef: allPODataByRef || {} };
}

function clearPOVALUE2MemoryCache() {
    try {
        allPOData = null;
        allPODataByRef = null;
        if (typeof cacheTimestamps !== 'undefined') cacheTimestamps.poData = 0;
        localStorage.removeItem('cached_POVALUE2');
        localStorage.removeItem('cached_PO_DATA');
    } catch (_) {}
}

async function imRefreshPOVALUE2CsvNowInternal(reason = 'manual', options = {}) {
    const forceRefresh = !!(options && options.force);

    if (!shouldRefreshPOVALUE2Csv(forceRefresh, reason)) {
        return getPOVALUE2CachedResult();
    }

    if (window.__imPOVALUE2InFlight) return window.__imPOVALUE2InFlight;

    window.__imPOVALUE2InFlight = (async () => {
        const startedAt = Date.now();
        try {
            const poUrl = await getFirebaseCSVUrl('POVALUE2.csv');
            if (!poUrl) return getPOVALUE2CachedResult();
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
    window.refreshPOVALUE2CsvNow = function(reason) {
        const reasonText = String(reason || 'manual').toLowerCase();
        // 11.1.8: Legacy modules sometimes call refreshPOVALUE2CsvNow('force') on a loop.
        // Only a real manual/user refresh may request force; all automatic/force-string calls are throttled.
        const manualForce = /manual|user|button|settings/.test(reasonText) && !/auto|workdesk|dashboard|force/.test(reasonText);
        return imRefreshPOVALUE2CsvNowInternal(reason || 'manual', { force: manualForce });
    };
    window.forceRefreshPOVALUE2CsvNow = function(reason) { return imRefreshPOVALUE2CsvNowInternal(reason || 'manual-force', { force: true }); };
    window.clearPOVALUE2MemoryCache = clearPOVALUE2MemoryCache;
    window.__ibaHasPOVALUE2MemoryIndex = hasPOVALUE2MemoryIndex;
} catch (_) {}


// 11.1.4: Invoice Management note suggestions must not scan full invoice_entries.
// Use a tiny Firebase index + browser cache for Summary Note / Batch Entry note pickers.
const IM_NOTE_INDEX_PATH = 'invoice_note_index';
const IM_NOTE_INDEX_CACHE_KEY = 'cached_INVOICE_NOTE_INDEX';
const IM_NOTE_INDEX_CACHE_MS = 12 * 60 * 60 * 1000; // 12 hours: notes are not high-frequency data.
const IM_NOTE_INDEX_LIMIT = 500; // Small list only; avoids large Firebase downloads.

function imNormalizeInvoiceNoteText(note) {
    return String(note == null ? '' : note).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function imNoteIndexHash(text) {
    const str = String(text || '');
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash >>> 0;
    }
    return hash.toString(36);
}

function imNoteIndexKey(note) {
    const normalized = imNormalizeInvoiceNoteText(note).toLowerCase();
    const slug = normalized
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 44) || 'note';
    return `${slug}_${imNoteIndexHash(normalized)}`;
}

function imApplyNoteIndexToMemory(indexData) {
    try {
        if (typeof allUniqueNotes === 'undefined' || !allUniqueNotes) allUniqueNotes = new Set();
        const list = Array.isArray(indexData)
            ? indexData
            : Object.values(indexData || {});
        list.forEach(item => {
            const text = imNormalizeInvoiceNoteText((item && typeof item === 'object') ? (item.text || item.note || '') : item);
            if (text) allUniqueNotes.add(text);
        });
    } catch (_) {}
}

function imReadLocalNoteIndex() {
    try {
        const cache = getCache(IM_NOTE_INDEX_CACHE_KEY);
        if (cache && cache.data) {
            imApplyNoteIndexToMemory(cache.data);
            return { data: cache.data, isStale: cache.isStale };
        }
    } catch (_) {}
    return null;
}

function imWriteLocalNoteIndexFromSet() {
    try {
        const notes = Array.from(allUniqueNotes || [])
            .map(imNormalizeInvoiceNoteText)
            .filter(Boolean)
            .slice(-IM_NOTE_INDEX_LIMIT)
            .map(text => ({ text, lastUsedAt: Date.now(), localOnly: true }));
        setCache(IM_NOTE_INDEX_CACHE_KEY, notes);
    } catch (_) {}
}

async function loadInvoiceNoteIndex(forceRefresh = false) {
    // Always make local cached notes available first so the UI opens fast.
    const local = imReadLocalNoteIndex();
    if (!forceRefresh && local && !local.isStale && allUniqueNotes && allUniqueNotes.size > 0) {
        return allUniqueNotes;
    }

    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('load-invoice-note-index', true)) {
        return allUniqueNotes || new Set();
    }
    if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('load-invoice-note-index', true)) {
        return allUniqueNotes || new Set();
    }

    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) {
            return allUniqueNotes || new Set();
        }
        const snap = await invoiceDb.ref(IM_NOTE_INDEX_PATH)
            .orderByChild('lastUsedAt')
            .limitToLast(IM_NOTE_INDEX_LIMIT)
            .once('value');
        const data = snap.val() || {};
        imApplyNoteIndexToMemory(data);
        try { setCache(IM_NOTE_INDEX_CACHE_KEY, data); } catch (_) {}
        return allUniqueNotes || new Set();
    } catch (error) {
        console.warn('Invoice note index could not be loaded. Using local note cache only.', error);
        return allUniqueNotes || new Set();
    }
}

function imNormalizeIndexText(value) {
    return String(value == null ? '' : value).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function imNoteIndexSafeKey(value) {
    return imNoteIndexHash(String(value || '').toLowerCase());
}

function imNoteIndexNormalizeLookup(value) {
    return imNormalizeIndexText(value).toLowerCase();
}

// 11.3.8: Summary Note previous-payment recovery must tolerate vendor text differences.
// Example: "Al Kuwaiti Store" vs "Al Kuwaiti Stores WLL" or W.L.L punctuation in CSV.
function imNoteIndexVendorComparableText(value) {
    return imNormalizeIndexText(value)
        .toLowerCase()
        .replace(/w\s*\.?\s*l\s*\.?\s*l\s*\.?/g, ' wll ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(wll|llc|ltd|limited|company|co)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function imNoteIndexVendorTokens(value) {
    return imNoteIndexVendorComparableText(value)
        .split(/\s+/)
        .map(imNoteIndexCanonicalToken)
        .filter(t => t && t.length >= 2 && !/^(wll|llc|ltd|co)$/.test(t));
}

function imNoteIndexVendorTokenMatches(targetSet, token) {
    if (!token) return true;
    if (targetSet.has(token)) return true;
    if (token.endsWith('s') && token.length > 3 && targetSet.has(token.slice(0, -1))) return true;
    if (!token.endsWith('s') && targetSet.has(token + 's')) return true;
    return false;
}

function imNoteIndexVendorMatches(targetVendor, queryVendor) {
    const target = imNoteIndexVendorComparableText(targetVendor);
    const query = imNoteIndexVendorComparableText(queryVendor);
    if (!target || !query) return false;
    if (target === query) return true;
    if (target.includes(query) || query.includes(target)) return true;
    const queryTokens = imNoteIndexVendorTokens(query);
    if (!queryTokens.length) return false;
    const targetSet = new Set(imNoteIndexVendorTokens(target));
    return queryTokens.every(t => imNoteIndexVendorTokenMatches(targetSet, t));
}

function imSummaryNoteVendorCandidateFromNote(noteText) {
    // Strip date/month tokens from a Summary Note label to obtain a vendor-like candidate.
    // "Al Kuwaiti Stores 17-June-2026" -> "Al Kuwaiti Stores".
    const monthWords = 'jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december';
    return imNormalizeIndexText(noteText)
        .replace(new RegExp('\\b(' + monthWords + ')\\b', 'ig'), ' ')
        .replace(/\b\d{1,2}(st|nd|rd|th)?\b/ig, ' ')
        .replace(/\b20\d{2}\b/g, ' ')
        .replace(/[-_/.,]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function imNoteIndexGetPOMeta(po) {
    const poText = imNormalizeIndexText(po);
    const variants = [poText, poText.toUpperCase(), poText.replace(/^0+/, ''), poText.padStart(10, '0')].filter(Boolean);
    let poData = null;
    try {
        for (const v of variants) {
            if (allPOData && allPOData[v]) {
                poData = allPOData[v];
                break;
            }
        }
    } catch (_) {}
    poData = poData || {};
    const vendor = imNormalizeIndexText(poData['Supplier Name'] || poData['Supplier Name:'] || poData.Supplier || poData['Supplier'] || '');
    const site = imNormalizeIndexText(poData['Project ID'] || poData['Project ID:'] || poData.Site || poData.site || '');
    const supplierId = imNormalizeIndexText(poData['Supplier ID'] || poData['Vendor ID'] || poData.vendor_id || '');
    return { vendor, vendorKey: imNoteIndexNormalizeLookup(vendor), site, siteKey: imNoteIndexNormalizeLookup(site), supplierId };
}

function imNoteIndexBuildRefPayload(note, meta = {}) {
    const po = imNormalizeIndexText(meta.po || meta.poNumber || meta.po_no || meta.poNo || '');
    const invoiceKey = imNormalizeIndexText(meta.invoiceKey || meta.key || meta.invoice_id || '');
    if (!po || !invoiceKey) return null;
    const poMeta = imNoteIndexGetPOMeta(po);
    const vendor = imNormalizeIndexText(meta.vendor || meta.vendorName || meta.vendor_name || poMeta.vendor || '');
    const site = imNormalizeIndexText(meta.site || meta.siteName || meta.site_name || poMeta.site || '');
    const group = imNormalizeIndexText(meta.group || meta.jobType || meta.invoiceGroup || '');
    const now = Date.now();
    return {
        po,
        invoiceKey,
        note: imNormalizeInvoiceNoteText(note),
        vendor,
        vendorKey: imNoteIndexNormalizeLookup(vendor),
        site,
        siteKey: imNoteIndexNormalizeLookup(site),
        group,
        groupKey: imNoteIndexNormalizeLookup(group),
        status: imNormalizeIndexText(meta.status || ''),
        srvName: imNormalizeIndexText(meta.srvName || ''),
        invoiceDate: imNormalizeIndexText(meta.invoiceDate || ''),
        invValue: imNormalizeIndexText(meta.invValue || meta.amount || ''),
        amountPaid: imNormalizeIndexText(meta.amountPaid || meta.amtPaid || meta.paidAmount || meta.paymentAmount || ''),
        updatedAt: (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue)
            ? firebase.database.ServerValue.TIMESTAMP
            : now,
        source: imNormalizeIndexText(meta.source || 'invoice-management')
    };
}

function imNoteIndexRefKey(po, invoiceKey) {
    return imNoteIndexHash(`${imNormalizeIndexText(po).toLowerCase()}::${imNormalizeIndexText(invoiceKey).toLowerCase()}`);
}

async function saveInvoiceNoteToIndex(note, meta = {}) {
    const text = imNormalizeInvoiceNoteText(note);
    if (!text) return false;

    try {
        if (typeof allUniqueNotes === 'undefined' || !allUniqueNotes) allUniqueNotes = new Set();
        allUniqueNotes.add(text);
        imWriteLocalNoteIndexFromSet();
    } catch (_) {}

    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('save-invoice-note-index', false)) return true;
    if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('save-invoice-note-index', false)) return true;

    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return true;
        const key = imNoteIndexKey(text);
        const now = Date.now();
        const ref = invoiceDb.ref(`${IM_NOTE_INDEX_PATH}/${key}`);
        const refPayload = imNoteIndexBuildRefPayload(text, meta);
        await ref.transaction(current => {
            const existing = (current && typeof current === 'object') ? current : {};
            const count = Number(existing.count || 0) + 1;
            const next = {
                ...existing,
                text,
                count,
                lastUsedAt: (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue)
                    ? firebase.database.ServerValue.TIMESTAMP
                    : now,
                lastPO: meta.po || meta.poNumber || existing.lastPO || '',
                lastInvoiceKey: meta.invoiceKey || meta.key || existing.lastInvoiceKey || '',
                lastStatus: meta.status || existing.lastStatus || '',
                lastAmountPaid: (refPayload && refPayload.amountPaid) || existing.lastAmountPaid || '',
                lastVendor: (refPayload && refPayload.vendor) || existing.lastVendor || '',
                lastVendorKey: (refPayload && refPayload.vendorKey) || existing.lastVendorKey || '',
                lastGroup: (refPayload && refPayload.group) || existing.lastGroup || '',
                lastGroupKey: (refPayload && refPayload.groupKey) || existing.lastGroupKey || '',
                lastSource: meta.source || existing.lastSource || 'invoice-management'
            };
            if (meta.po || meta.invoiceKey) {
                next.lastRef = `${meta.po || ''}${meta.invoiceKey ? '/' + meta.invoiceKey : ''}`;
            }
            return next;
        });

        // 11.1.6: Keep a tiny note -> invoice reference index for Summary Note.
        // This lets Summary Note fetch previous/current invoices by note without scanning all invoice_entries.
        if (refPayload) {
            const refKey = imNoteIndexRefKey(refPayload.po, refPayload.invoiceKey);
            await ref.child(`refs/${refKey}`).update(refPayload);
        }
        return true;
    } catch (error) {
        console.warn('Invoice note index update skipped. Invoice save is still safe.', error);
        return false;
    }
}

function imNoteIndexRowFromInvoice(note, po, invoiceKey, inv = {}) {
    const poMeta = imNoteIndexGetPOMeta(po);
    const vendor = imNormalizeIndexText(inv.vendor_name || inv.vendorName || inv.vendor || poMeta.vendor || '');
    const site = imNormalizeIndexText(inv.site_name || inv.siteName || inv.site || poMeta.site || '');
    return {
        po: imNormalizeIndexText(po),
        key: imNormalizeIndexText(invoiceKey),
        site: site || 'N/A',
        vendor: vendor || 'N/A',
        ...inv
    };
}

function imNoteIndexIsExactNote(inv, note) {
    return imNormalizeInvoiceNoteText(inv && inv.note).toLowerCase() === imNormalizeInvoiceNoteText(note).toLowerCase();
}


// 11.1.7: Summary Note search may be typed as a group label like "DON 2026".
// Keep exact matching first, but allow safe keyword matching against the small note index
// and against a one-time confirmed legacy scan. This avoids full invoice downloads on open.
function imNoteIndexCanonicalToken(token) {
    const t = String(token || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    if (!t) return '';
    const monthMap = {
        january: 'jan', jan: 'jan',
        february: 'feb', feb: 'feb',
        march: 'mar', mar: 'mar',
        april: 'apr', apr: 'apr',
        may: 'may',
        june: 'jun', jun: 'jun',
        july: 'jul', jul: 'jul',
        august: 'aug', aug: 'aug',
        september: 'sep', sept: 'sep', sep: 'sep',
        october: 'oct', oct: 'oct',
        november: 'nov', nov: 'nov',
        december: 'dec', dec: 'dec'
    };
    return monthMap[t] || t;
}

function imNoteIndexTextTokens(value) {
    return imNormalizeInvoiceNoteText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .map(imNoteIndexCanonicalToken)
        .filter(t => t && t.length >= 2);
}

function imNoteIndexQueryTokens(query) {
    return imNoteIndexTextTokens(query);
}

function imNoteIndexTokenMatches(noteTokenSet, token) {
    if (!token) return true;
    if (noteTokenSet.has(token)) return true;
    // 11.3.7: tolerate small human differences in Summary Note names, e.g. Store/Stores.
    if (token.endsWith('s') && token.length > 3 && noteTokenSet.has(token.slice(0, -1))) return true;
    if (!token.endsWith('s') && noteTokenSet.has(token + 's')) return true;
    // 11.3.8: tolerate year labels like 2026 vs 26 in old notes.
    if (/^20\d{2}$/.test(token) && noteTokenSet.has(token.slice(2))) return true;
    if (/^\d{2}$/.test(token) && noteTokenSet.has('20' + token)) return true;
    return false;
}

function imNoteIndexMatchesQuery(noteText, queryText) {
    const note = imNormalizeInvoiceNoteText(noteText).toLowerCase();
    const query = imNormalizeInvoiceNoteText(queryText).toLowerCase();
    if (!note || !query) return false;
    if (note === query) return true;
    if (note.includes(query)) return true;
    const tokens = imNoteIndexQueryTokens(query);
    if (!tokens.length) return false;
    const noteTokenSet = new Set(imNoteIndexTextTokens(note));
    return tokens.every(t => imNoteIndexTokenMatches(noteTokenSet, t));
}

function imNoteIndexIsQueryMatch(inv, noteQuery) {
    return imNoteIndexMatchesQuery(inv && inv.note, noteQuery);
}

async function loadInvoiceNoteIndexDataForSearch(forceRefresh = false, limit = 2000) {
    const local = imReadLocalNoteIndex();
    if (!forceRefresh && local && local.data) return local.data;
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('load-invoice-note-index-search', true)) return (local && local.data) || {};
    if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('load-invoice-note-index-search', true)) return (local && local.data) || {};
    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return (local && local.data) || {};
        const snap = await invoiceDb.ref(IM_NOTE_INDEX_PATH)
            .orderByChild('lastUsedAt')
            .limitToLast(Number(limit || 2000))
            .once('value');
        const data = snap.val() || {};
        imApplyNoteIndexToMemory(data);
        try { setCache(IM_NOTE_INDEX_CACHE_KEY, data); } catch (_) {}
        return data;
    } catch (error) {
        console.warn('Invoice note index search could not be loaded. Using local note cache only.', error);
        return (local && local.data) || {};
    }
}

async function loadInvoiceNoteRefsByQuery(noteQuery, options = {}) {
    const query = imNormalizeInvoiceNoteText(noteQuery);
    if (!query) return [];
    const data = await loadInvoiceNoteIndexDataForSearch(!!options.forceRefresh, Number(options.noteIndexLimit || 2000));
    const refs = [];
    const seen = new Set();
    try {
        Object.values(data || {}).forEach(item => {
            if (!item || typeof item !== 'object') return;
            const text = imNormalizeInvoiceNoteText(item.text || item.note || '');
            if (!imNoteIndexMatchesQuery(text, query)) return;
            const itemRefs = item.refs || {};
            Object.values(itemRefs || {}).forEach(r => {
                if (!r || !r.po || !r.invoiceKey) return;
                const id = `${r.po}::${r.invoiceKey}`;
                if (seen.has(id)) return;
                seen.add(id);
                refs.push(r);
            });
        });
    } catch (_) {}
    return refs;
}

async function loadInvoicesByNoteSearch(noteQuery, options = {}) {
    const query = imNormalizeInvoiceNoteText(noteQuery);
    if (!query) return [];

    const rows = [];
    const seen = new Set();
    try {
        if (allInvoiceData) {
            for (const po in allInvoiceData) {
                const invoices = allInvoiceData[po] || {};
                for (const key in invoices) {
                    const inv = invoices[key] || {};
                    if (imNoteIndexIsQueryMatch(inv, query)) {
                        const id = `${po}::${key}`;
                        if (!seen.has(id)) {
                            rows.push(imNoteIndexRowFromInvoice(inv.note || query, po, key, inv));
                            seen.add(id);
                        }
                    }
                }
            }
        }
    } catch (_) {}

    // Exact key first, then flexible small-index refs such as "DON 2026" -> matching note texts.
    const exactRefs = await loadInvoiceNoteRefs(query);
    const queryRefs = await loadInvoiceNoteRefsByQuery(query, options);
    const refList = [...exactRefs, ...queryRefs].slice(-Number(options.limit || 900));

    for (const ref of refList) {
        const po = imNormalizeIndexText(ref.po);
        const invoiceKey = imNormalizeIndexText(ref.invoiceKey);
        if (!po || !invoiceKey || seen.has(`${po}::${invoiceKey}`)) continue;
        try {
            const snap = await invoiceDb.ref(`invoice_entries/${po}/${invoiceKey}`).once('value');
            const inv = snap.val() || {};
            if (!imNoteIndexIsQueryMatch(inv, query)) continue;
            if (!allInvoiceData) allInvoiceData = {};
            if (!allInvoiceData[po]) allInvoiceData[po] = {};
            allInvoiceData[po][invoiceKey] = { ...inv, key: invoiceKey };
            if (window.__invoiceEntriesFullLoaded !== true) window.__invoiceEntriesFullLoaded = false;
            rows.push(imNoteIndexRowFromInvoice(inv.note || query, po, invoiceKey, inv));
            seen.add(`${po}::${invoiceKey}`);
        } catch (error) {
            console.warn('Invoice note query ref read skipped:', po, invoiceKey, error);
        }
    }

    return rows;
}

async function loadInvoiceNoteRefs(note) {
    const text = imNormalizeInvoiceNoteText(note);
    if (!text) return [];
    if (window.ibaShouldUseCacheOnly && window.ibaShouldUseCacheOnly('load-invoice-note-refs', true)) return [];
    if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('load-invoice-note-refs', true)) return [];
    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return [];
        const key = imNoteIndexKey(text);
        const snap = await invoiceDb.ref(`${IM_NOTE_INDEX_PATH}/${key}/refs`).once('value');
        const refs = snap.val() || {};
        return Object.values(refs || {}).filter(r => r && r.po && r.invoiceKey);
    } catch (error) {
        console.warn('Invoice note refs could not be loaded. Using local cache only.', error);
        return [];
    }
}

async function loadInvoicesByNoteIndex(note, options = {}) {
    const text = imNormalizeInvoiceNoteText(note);
    if (!text) return [];

    const fromMemory = [];
    try {
        if (allInvoiceData) {
            for (const po in allInvoiceData) {
                const invoices = allInvoiceData[po] || {};
                for (const key in invoices) {
                    const inv = invoices[key] || {};
                    if (imNoteIndexIsExactNote(inv, text)) {
                        fromMemory.push(imNoteIndexRowFromInvoice(text, po, key, inv));
                    }
                }
            }
        }
    } catch (_) {}

    const refs = await loadInvoiceNoteRefs(text);
    const seen = new Set(fromMemory.map(r => `${r.po}::${r.key}`));
    const rows = [...fromMemory];
    const refList = refs.slice(-Number(options.limit || 800));

    for (const ref of refList) {
        const po = imNormalizeIndexText(ref.po);
        const invoiceKey = imNormalizeIndexText(ref.invoiceKey);
        if (!po || !invoiceKey || seen.has(`${po}::${invoiceKey}`)) continue;
        try {
            const snap = await invoiceDb.ref(`invoice_entries/${po}/${invoiceKey}`).once('value');
            const inv = snap.val() || {};
            if (!imNoteIndexIsExactNote(inv, text)) continue;
            if (!allInvoiceData) allInvoiceData = {};
            if (!allInvoiceData[po]) allInvoiceData[po] = {};
            allInvoiceData[po][invoiceKey] = { ...inv, key: invoiceKey };
            if (window.__invoiceEntriesFullLoaded !== true) window.__invoiceEntriesFullLoaded = false;
            rows.push(imNoteIndexRowFromInvoice(text, po, invoiceKey, inv));
            seen.add(`${po}::${invoiceKey}`);
        } catch (error) {
            console.warn('Invoice note exact ref read skipped:', po, invoiceKey, error);
        }
    }

    return rows;
}

function imFindPOsForVendor(vendorName, extraCandidates = []) {
    const candidates = Array.from(new Set([vendorName, ...(extraCandidates || [])]
        .map(imNormalizeIndexText)
        .filter(Boolean)));
    if (!candidates.length || !allPOData) return [];
    const exactKeys = new Set(candidates.map(imNoteIndexNormalizeLookup));
    const out = [];
    try {
        for (const po in allPOData) {
            const poMeta = imNoteIndexGetPOMeta(po);
            const poVendor = poMeta.vendor || '';
            const exactOk = poMeta.vendorKey && exactKeys.has(poMeta.vendorKey);
            const fuzzyOk = candidates.some(c => imNoteIndexVendorMatches(poVendor, c));
            if (exactOk || fuzzyOk) out.push(String(po));
        }
    } catch (_) {}
    return out;
}

async function backfillInvoiceNoteIndexForVendor(noteList, vendorName, options = {}) {
    const notes = Array.from(new Set((noteList || []).map(imNormalizeInvoiceNoteText).filter(Boolean)));
    const vendor = imNormalizeIndexText(vendorName);
    if (!notes.length || !vendor) return {};
    try {
        if (typeof ensureInvoicePOBaseDataFetched === 'function') await ensureInvoicePOBaseDataFetched(false);
    } catch (_) {}
    const noteVendorCandidates = notes
        .map(imSummaryNoteVendorCandidateFromNote)
        .filter(Boolean);
    const poList = imFindPOsForVendor(vendor, noteVendorCandidates);
    // 11.3.5: Some vendors have more than 300 POs. Previous-note recovery was missing newer months.
    // 11.3.8: Keep the lookup vendor-only but make vendor matching fuzzy, so WLL/punctuation/plural differences
    // do not prevent previous payment from being recovered.
    const maxPOs = Number(options.maxPOs || 3000);
    const selectedPOs = poList.slice(-maxPOs);
    const noteMap = {};
    notes.forEach(n => { noteMap[n.toLowerCase()] = []; });

    for (const po of selectedPOs) {
        try {
            const snap = await invoiceDb.ref(`invoice_entries/${po}`).once('value');
            const invoices = snap.val() || {};
            if (!allInvoiceData) allInvoiceData = {};
            if (!allInvoiceData[po]) allInvoiceData[po] = {};
            for (const key in invoices) {
                const inv = invoices[key] || {};
                const invNote = imNormalizeInvoiceNoteText(inv.note);
                if (!invNote) continue;
                const matchedQueries = notes.filter(q => imNoteIndexMatchesQuery(invNote, q));
                if (!matchedQueries.length) continue;
                allInvoiceData[po][key] = { ...inv, key };
                const row = imNoteIndexRowFromInvoice(invNote, po, key, inv);
                matchedQueries.forEach(q => {
                    const k = q.toLowerCase();
                    if (noteMap[k] && !noteMap[k].some(existing => `${existing.po}::${existing.key}` === `${row.po}::${row.key}`)) {
                        noteMap[k].push(row);
                    }
                });
                try {
                    await saveInvoiceNoteToIndex(invNote, {
                        po,
                        invoiceKey: key,
                        status: inv.status || '',
                        vendor: row.vendor,
                        site: row.site,
                        group: inv.group || inv.jobType || '',
                        srvName: inv.srvName || '',
                        invoiceDate: inv.invoiceDate || '',
                        invValue: inv.invValue || '',
                        amountPaid: inv.amountPaid || inv.amtPaid || inv.paidAmount || '',
                        source: 'summary-note-vendor-backfill'
                    });
                } catch (_) {}
            }
        } catch (error) {
            console.warn('Summary Note vendor note backfill skipped PO:', po, error);
        }
    }
    if (window.__invoiceEntriesFullLoaded !== true) window.__invoiceEntriesFullLoaded = false;
    return noteMap;
}

async function buildInvoiceNoteIndexFromLoadedInvoicesForNotes(noteList) {
    const notes = Array.from(new Set((noteList || []).map(imNormalizeInvoiceNoteText).filter(Boolean)));
    const noteMap = {};
    notes.forEach(n => { noteMap[n.toLowerCase()] = []; });
    if (!notes.length || !allInvoiceData) return noteMap;

    for (const po in allInvoiceData) {
        const invoices = allInvoiceData[po] || {};
        for (const key in invoices) {
            const inv = invoices[key] || {};
            const invNote = imNormalizeInvoiceNoteText(inv.note);
            if (!invNote) continue;
            const matchedQueries = notes.filter(q => imNoteIndexMatchesQuery(invNote, q));
            if (!matchedQueries.length) continue;
            const row = imNoteIndexRowFromInvoice(invNote, po, key, inv);
            matchedQueries.forEach(q => {
                const k = q.toLowerCase();
                if (noteMap[k] && !noteMap[k].some(existing => `${existing.po}::${existing.key}` === `${row.po}::${row.key}`)) {
                    noteMap[k].push(row);
                }
            });
            try {
                await saveInvoiceNoteToIndex(invNote, {
                    po,
                    invoiceKey: key,
                    status: inv.status || '',
                    vendor: row.vendor,
                    site: row.site,
                    group: inv.group || inv.jobType || '',
                    srvName: inv.srvName || '',
                    invoiceDate: inv.invoiceDate || '',
                    invValue: inv.invValue || '',
                    amountPaid: inv.amountPaid || inv.amtPaid || inv.paidAmount || '',
                    source: 'summary-note-one-time-full-backfill'
                });
            } catch (_) {}
        }
    }
    return noteMap;
}

async function loadSummaryNoteInvoicesFromIndex(prevNote, currentNote, options = {}) {
    const prevText = imNormalizeInvoiceNoteText(prevNote);
    const currentText = imNormalizeInvoiceNoteText(currentNote);
    const notes = [prevText, currentText].filter(Boolean);
    const result = { previous: [], current: [], vendorBackfilled: false, currentVendor: '' };
    if (!currentText) return result;

    result.current = (typeof loadInvoicesByNoteSearch === 'function')
        ? await loadInvoicesByNoteSearch(currentText, options)
        : await loadInvoicesByNoteIndex(currentText, options);
    if (prevText) {
        result.previous = (typeof loadInvoicesByNoteSearch === 'function')
            ? await loadInvoicesByNoteSearch(prevText, options)
            : await loadInvoicesByNoteIndex(prevText, options);
    }

    // 11.3.9: Summary Note Previous Payment is note-only.
    // When noteOnly/disableVendorBackfill is enabled, do not use vendor/group matching to recover or filter notes.
    if (options.noteOnly === true || options.disableVendorBackfill === true) {
        return result;
    }

    // Legacy targeted recovery remains available only for older flows that explicitly allow it.
    const currentVendor = (result.current[0] && result.current[0].vendor && result.current[0].vendor !== 'N/A') ? result.current[0].vendor : '';
    result.currentVendor = currentVendor;
    if (currentVendor && notes.length) {
        const needVendorBackfill = (prevText && result.previous.length === 0) || result.current.length === 0;
        if (needVendorBackfill || options.alwaysVendorBackfill) {
            const backfilled = await backfillInvoiceNoteIndexForVendor(notes, currentVendor, options);
            if (backfilled && Object.keys(backfilled).length) {
                if (currentText && backfilled[currentText.toLowerCase()] && backfilled[currentText.toLowerCase()].length) {
                    const seen = new Set(result.current.map(r => `${r.po}::${r.key}`));
                    backfilled[currentText.toLowerCase()].forEach(r => { if (!seen.has(`${r.po}::${r.key}`)) result.current.push(r); });
                }
                if (prevText && backfilled[prevText.toLowerCase()] && backfilled[prevText.toLowerCase()].length) {
                    const seen = new Set(result.previous.map(r => `${r.po}::${r.key}`));
                    backfilled[prevText.toLowerCase()].forEach(r => { if (!seen.has(`${r.po}::${r.key}`)) result.previous.push(r); });
                }
                result.vendorBackfilled = true;
            }
        }
    }
    return result;
}

try {
    window.loadInvoiceNoteIndex = loadInvoiceNoteIndex;
    window.saveInvoiceNoteToIndex = saveInvoiceNoteToIndex;
    window.imNormalizeInvoiceNoteText = imNormalizeInvoiceNoteText;
    window.imNoteIndexKey = imNoteIndexKey;
    window.loadInvoiceNoteRefs = loadInvoiceNoteRefs;
    window.loadInvoicesByNoteIndex = loadInvoicesByNoteIndex;
    window.loadInvoicesByNoteSearch = loadInvoicesByNoteSearch;
    window.imNoteIndexMatchesQuery = imNoteIndexMatchesQuery;
    window.backfillInvoiceNoteIndexForVendor = backfillInvoiceNoteIndexForVendor;
    window.buildInvoiceNoteIndexFromLoadedInvoicesForNotes = buildInvoiceNoteIndexFromLoadedInvoicesForNotes;
    window.loadSummaryNoteInvoicesFromIndex = loadSummaryNoteInvoicesFromIndex;
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
    const hasBaseMemory = !!(hasPOVALUE2MemoryIndex() && allSitesCSVData && allVendorsData);
    const lastPOBaseRefresh = Number(window.__imLastPOBaseRefreshAt || 0);
    const effectiveForceRefresh = !!forceRefresh && !(hasBaseMemory && (now - lastPOBaseRefresh < IM_POVALUE2_FORCE_REFRESH_MIN_MS));

    if (!forceRefresh || !effectiveForceRefresh) {
        try { loadDataFromLocalStorage(); } catch (_) {}
    }

    const tasks = [];
    const taskNames = [];

    // 11.1.2/11.1.8: Dashboard may call this repeatedly. Load POVALUE2.csv only when missing
    // or when the safe force cooldown allows it; otherwise reuse the indexed cache.
    if (shouldRefreshPOVALUE2Csv(effectiveForceRefresh, 'invoice-po-lookup')) {
        tasks.push(imRefreshPOVALUE2CsvNowInternal(effectiveForceRefresh ? 'force' : 'invoice-po-lookup', { force: effectiveForceRefresh }));
        taskNames.push('po');
    }
    if (!allSitesCSVData || effectiveForceRefresh) {
        const siteUrl = await getFirebaseCSVUrl('Site.csv');
        if (siteUrl) { tasks.push(fetchAndParseSitesCSV(siteUrl)); taskNames.push('site'); }
    }
    if (!allVendorsData || effectiveForceRefresh) {
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
    if (tasks.length > 0) window.__imLastPOBaseRefreshAt = Date.now();
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
    const hasInvoiceBaseMemory = !!(hasPOVALUE2MemoryIndex() && allEpicoreData && allSitesCSVData && allEcommitDataProcessed && allVendorsData);
    const effectiveForceRefresh = !!forceRefresh && !(hasInvoiceBaseMemory && (now - Number(window.__imLastInvoiceBaseRefreshAt || 0) < IM_POVALUE2_FORCE_REFRESH_MIN_MS));
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
        const poUrl = shouldRefreshPOVALUE2Csv(effectiveForceRefresh, 'ensure-invoice-data') ? await getFirebaseCSVUrl('POVALUE2.csv') : null;
        const poDetailsUrl = (!allEpicoreData || effectiveForceRefresh) ? await getFirebaseCSVUrl('POdetails.csv') : null;
        const siteUrl = (!allSitesCSVData || effectiveForceRefresh) ? await getFirebaseCSVUrl('Site.csv') : null;
        const ecommitUrl = (!allEcommitDataProcessed || effectiveForceRefresh) ? await getFirebaseCSVUrl('ECommit.csv') : null;
        const vendorUrl = (!allVendorsData || effectiveForceRefresh) ? await getFirebaseCSVUrl('Vendors.csv') : null;

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
        if (promisesToRun.length > 0) window.__imLastInvoiceBaseRefreshAt = Date.now();
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

// 11.1.8: WorkDesk refresh guard. Recent-sync/UI refresh can request force repeatedly;
// keep the screen accurate from local/recent markers without reloading job_entries + CSV every few seconds.
const WD_ALL_ENTRIES_FORCE_REFRESH_MIN_MS = 5 * 60 * 1000; // 11.1.9: WorkDesk must not full-reload/reset counts every few seconds.
window.__wdLastAllEntriesFullFetchAt = window.__wdLastAllEntriesFullFetchAt || 0;
// 11.2.0: stop fetch storms. Multiple Dashboard/Job Entry callers can fire at the same time
// during page resume/open. Share one WorkDesk load instead of starting 2-5 full job_entries reads.
window.__wdAllEntriesInFlight = window.__wdAllEntriesInFlight || {};

async function ensureAllEntriesFetched(forceRefresh = false, options = {}) { 
    const now = Date.now();
    const inventoryContext = (typeof isInventoryContext === 'function') ? isInventoryContext() : false;
    const requestedMode = String(options.mode || (inventoryContext ? 'inventory' : 'workdesk')).toLowerCase();
    const loadMode = ['inventory', 'workdesk', 'all'].includes(requestedMode) ? requestedMode : 'workdesk';
    const shouldLoadJobEntries = loadMode !== 'inventory' || options.includeJobEntries === true;
    const shouldLoadTransferEntries = loadMode === 'inventory' || loadMode === 'all' || options.includeTransfers === true;
    const cacheFresh = (now - cacheTimestamps.systemEntries < CACHE_DURATION);
    const hasWorkdeskCache = Array.isArray(workdeskSystemEntries) && workdeskSystemEntries.length > 0;
    const hasInventoryCache = Array.isArray(inventorySystemEntries) && inventorySystemEntries.length > 0;
    const modeHasCache = (loadMode === 'workdesk' && hasWorkdeskCache) || (loadMode === 'inventory' && hasInventoryCache) || (loadMode === 'all' && (hasWorkdeskCache || hasInventoryCache || (Array.isArray(allSystemEntries) && allSystemEntries.length > 0)));
    const inFlightKey = loadMode;

    // 11.2.0: If another caller already started the same WorkDesk/Inventory load, wait for it.
    // This prevents duplicate job_entries downloads during initial Dashboard + Job Entry startup.
    if (window.__wdAllEntriesInFlight && window.__wdAllEntriesInFlight[inFlightKey]) {
        await window.__wdAllEntriesInFlight[inFlightKey];
        wdRebuildAllSystemEntriesFromFamilyCaches();
        return;
    }

    // 11.1.9: If a legacy caller asks for force repeatedly, do not redownload WorkDesk
    // job_entries/CSV every few seconds. Local cache + recent markers keep the UI current
    // and prevent Dashboard status-card counts from flashing to dash/loading.
    if (forceRefresh && modeHasCache && options.allowImmediateForce !== true) {
        const lastFull = Number(window.__wdLastAllEntriesFullFetchAt || cacheTimestamps.systemEntries || 0);
        if (now - lastFull < WD_ALL_ENTRIES_FORCE_REFRESH_MIN_MS) {
            wdRebuildAllSystemEntriesFromFamilyCaches();
            return;
        }
    }

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

    const __wdDoFullLoad = async () => {
    console.log(`Loading Data for ${loadMode === 'inventory' ? 'Inventory' : (loadMode === 'all' ? 'All Records' : 'Workdesk')}...`);

    let poDataByPO = allPOData || {};
    let poDataByRef = {};

    if (shouldLoadJobEntries) {
        // 11.1.8: Job Entries need PO matching, but WorkDesk must not re-download
        // POVALUE2.csv on every refresh. Reuse the shared indexed CSV and only load it when missing.
        let csvResult = { poDataByPO: allPOData || {}, poDataByRef: allPODataByRef || {} };
        if (!csvResult.poDataByPO || Object.keys(csvResult.poDataByPO || {}).length === 0) {
            csvResult = await imRefreshPOVALUE2CsvNowInternal('workdesk-job-po-match', { force: false }) || {};
        }
        poDataByPO = csvResult.poDataByPO || allPOData || {};
        poDataByRef = csvResult.poDataByRef || allPODataByRef || {};
        allPOData = poDataByPO;
        allPODataByRef = poDataByRef;
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

    cacheTimestamps.systemEntries = Date.now();
    window.__wdLastAllEntriesFullFetchAt = Date.now();
    console.log(`Loaded ${allSystemEntries.length} entries. WorkDesk: ${workdeskSystemEntries.length}, Inventory: ${inventorySystemEntries.length}.`);
    };

    window.__wdAllEntriesInFlight[inFlightKey] = __wdDoFullLoad();
    try {
        await window.__wdAllEntriesInFlight[inFlightKey];
    } finally {
        if (window.__wdAllEntriesInFlight && window.__wdAllEntriesInFlight[inFlightKey]) {
            delete window.__wdAllEntriesInFlight[inFlightKey];
        }
    }
}

window.__ibaApproverDataInFlight = window.__ibaApproverDataInFlight || null;
window.__ibaLastApproverDataFetchAt = window.__ibaLastApproverDataFetchAt || 0;

async function ensureApproverDataCached(force = false) {
    // Keep this cache reasonably fresh because Vacation Delegation depends on it.
    // 11.2.0: Dashboard/WorkDesk can call this several times during startup.
    // Share one request and ignore repeated force calls inside the safe one-minute window.
    const MAX_AGE_MS = 60 * 1000; // 1 minute (safe + light)
    const now = Date.now();

    try {
        const lastFetch = Number((cacheTimestamps && cacheTimestamps.approverData) || window.__ibaLastApproverDataFetchAt || 0);
        if (allApproverDataCache && lastFetch && (now - lastFetch) < MAX_AGE_MS) {
            return;
        }
        if (!force && allApproverDataCache && (!cacheTimestamps || !cacheTimestamps.approverData)) {
            // Backward compatibility: if old builds never set the timestamp, keep current cache.
            return;
        }
        if (window.__ibaApproverDataInFlight) {
            await window.__ibaApproverDataInFlight;
            return;
        }

        window.__ibaApproverDataInFlight = (async () => {
            const snapshot = await db.ref('approvers').once('value');
            allApproverDataCache = snapshot.val() || {};
            allApproverData = allApproverDataCache; // keep in sync for older logic paths
            const fetchedAt = Date.now();
            window.__ibaLastApproverDataFetchAt = fetchedAt;
            if (cacheTimestamps) cacheTimestamps.approverData = fetchedAt;
            console.log("Approver data cached/refreshed for position-matching.");
        })();

        await window.__ibaApproverDataInFlight;
    } catch (e) {
        // Never hard-fail the UI if caching fails.
        console.warn("ensureApproverDataCached failed:", e);
    } finally {
        window.__ibaApproverDataInFlight = null;
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
