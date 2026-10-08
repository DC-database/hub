// ==========================================================================
// FILE: materialStock.js
// ORGANIZED WORKING COPY
// PURPOSE: Material Stock master data, category/search UI, stock rendering, refresh cache, and Required Materials list.
// SAFETY NOTE:
//   - Original execution order is preserved.
//   - No logic was intentionally changed.
//   - Cleanup applied: consistent top map, trailing-space cleanup, blank-line cleanup.
//
// NAVIGATION MAP:
// MAJOR SECTIONS FOUND:
//   - Line    22: GLOBAL REFRESH COOLDOWN (30-min limit per user, per device)
//   - Line   116: 1. STOCK LEGENDS (F / RRR Structure)
//   - Line   255: INIT SYSTEM & SITE FILTER (INCLUDES PRINT CSS FIX)
//   - Line   257: 1. INJECT PRINT CSS FIX
//   - Line   344: 2. EXISTING UI LOGIC (TABS & FILTER)
//   - Line   379: 1. LOAD DATA
//   - Line   388: NOTE: We cache the stock list for speed, but stock can change due to
//   - Line   504: 2. TABS & RENDERING
//   - Line   554: RENDER TABLE (Fixed: Safe Null Checks for currentApprover)
//   - Line   563: READ SITE FILTER
//   - Line   623: 1. Family Filter Logic
//   - Line   628: 2. Search Text (SAFE STRING CONVERSION to prevent crash)
//   - Line   636: 3. SITE FILTER LOGIC
//   - Line   646: SAVE FILTERED DATA FOR REPORTING
//   - Line   659: 1. PRE-CALCULATE HISTORY
//   - Line   666: 2. GENERATE SITE BREAKDOWN
//   - Line   680: SMART LOGIC: Hide 0 qty sites UNLESS there's a pending transfer
//   - Line   713: 3. GENERATE HISTORY ROWS
//   - Line   799: UX: allow expanding/collapsing by clicking anywhere on the parent row
//   - Line   902: 4. DELETE & EDIT LOGIC
//   - Line   949: 5. MODAL LOGIC: OPEN & AUTO-POPULATION
//   - Line   951: Permission: Admins can edit. Super Admin's Vacation Delegate can edit while delegation is active.
//   - Line  1129: 6. SAVE LOGIC
//   - Line  1131: Permission guard (same as modal): Admins OR Super Admin Vacation Delegate.
//   - Line  1264: 7. CSV UPLOAD
//   - Line  1452: 8. ADD STOCK MODAL LOGIC
//   - Line  1480: 9. HELPERS (Fixed: Accordion Effect)
//   - Line  1482: 1. Auto-Minimize Others (Close all other open rows)
//   - Line  1499: 2. Toggle Current Item
//   - Line  1559: BULK DELETE LOGIC
//   - Line  1614: REPORTING FUNCTIONS (Updated: Logo Left, Text Centered Below)
//   - Line  1622: 1. Prepare Title & Filter Info
//   - Line  1629: 2. INJECT LOGO & HEADER
//   - Line  1650: 3. Update Stats Boxes
//   - Line  1659: 4. Render Table Rows
//
// FUNCTION QUICK INDEX:
//   - Line    32: _safeStr()
//   - Line    34: _getUserName()
//   - Line    43: _sanitizeKey()
//   - Line    48: _cooldownStorageKey()
//   - Line    53: _formatRemaining()
//   - Line    60: __attachRefreshCooldown()
//   - Line   258: initMaterialStockSystem()
//   - Line   382: populateMaterialStock()
//   - Line   489: fetchTransfersOnly()
//   - Line   507: renderCategoryTabs()
//   - Line   548: filterStockByCategory()
//   - Line   557: renderMaterialStockTable()
//   - Line   609: getSiteDisplayName()
//   - Line   906: handleDeleteMaterial()
//   - Line   952: openNewMaterialModal()
//   - Line  1022: openSuperAdminEdit()
//   - Line  1068: msParseSeriesFromProductId()
//   - Line  1076: generatePreviewID()
//   - Line  1101: msCloseNewMaterialModal()
//   - Line  1132: handleSaveNewMaterial()
//   - Line  1267: handleGetTemplate()
//   - Line  1282: handleUploadCSV()
//   - Line  1455: openAddStockModal()
//   - Line  1484: toggleStockDetail()
//   - Line  1507: populateModalSiteDropdown()
//   - Line  1523: handleClearMaterialForm()
//   - Line  1528: initiateReturn()
//   - Line  1560: handleBulkDelete()
//   - Line  1617: openStockReportModal()
//   - Line  1685: downloadFixedStockCSV()
//   - Line  1732: msRequiredListStorageKey()
//   - Line  1743: msLoadRequiredList()
//   - Line  1789: msRequiredListToSiteStorageKey()
//   - Line  1793: msLoadRequiredListToSite()
//   - Line  1802: msSaveRequiredListToSite()
//   - Line  1808: msSaveRequiredList()
//   - Line  1814: msUpdateRequiredListButton()
//   - Line  1822: msRenderRequiredListTable()
//   - Line  1831: esc()
//   - Line  1891: msAddToRequiredList()
//   - Line  1939: msAddManualRequiredItem()
//   - Line  1968: msRemoveFromRequiredList()
//   - Line  1976: msClearRequiredList()
//   - Line  1986: msOpenRequiredListModal()
//   - Line  2034: msPrintRequiredList()
//   - Line  2071: escapeHtml()
//   - Line  2153: onload()
//   - Line  2170: msInitRequiredListUI()
//   - Line  2280: run()
//   - Line  2409: deleteSiteStock()
// ==========================================================================

// materialStock.js - 12.8.7 (Material Stock cache integrity + lightweight count validation)

let allMaterialStockData = [];
let allTransferData = [];
// 12.8.5: expose controlled access for the Inventory Pocket without exposing mutable globals.
window.__ibaGetMaterialStockData = () => allMaterialStockData;
window.__ibaSetMaterialStockData = (data) => { allMaterialStockData = Array.isArray(data) ? data : []; };

let lastFilteredStockData = [];
let msProductChoices = null;
let lastTypedProductID = "";
// By default, keep the list empty until the user selects a Family tab or types a search.
// (This improves perceived performance on large datasets and matches the requested UX.)
let currentCategoryFilter = null;
let editingItemKey = null; // NEW: explicit modal state (prevents stuck edit mode)

// "Notepad" / Required Materials list (local-only, safe, non-destructive)
let msRequiredList = [];
let msRequiredListToSite = ""; // optional destination site note for the required list

// Constants
const STOCK_CACHE_KEY = "cached_MATERIAL_STOCK";
const STOCK_CACHE_DURATION = 8 * 24 * 60 * 60 * 1000;
const STOCK_CACHE_SOURCE = 'full-material-stock-v2';
const STOCK_META_PATH = 'material_stock_meta';
const STOCK_MIN_SAFE_CACHE_COUNT = 1700;
window.__ibaMaterialStockFullyLoaded = false;

async function msReadStockMeta(database) {
    try {
        const snap = await database.ref(STOCK_META_PATH).once('value');
        return snap.val() || null;
    } catch (e) {
        console.warn('Material Stock metadata read failed:', e);
        return null;
    }
}

async function msWriteStockMeta(database, count) {
    const safeCount = Math.max(0, Number(count) || 0);
    await database.ref(STOCK_META_PATH).update({
        count: safeCount,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
}



// OneDrive / SharePoint photo support for Material Stock.
// IMPORTANT: Firebase stores only a small text value.
// The actual photo file stays in OneDrive/SharePoint to avoid Firebase Storage usage.
const MS_MATERIAL_PHOTO_BASE_URL = 'https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/Photo/';
const MS_MATERIAL_PHOTO_DEFAULT_EXT = '.jpg';
// PhotoIndex.csv lives in GitHub and contains one required column: photoName.
// Browsing a private OneDrive folder directly is not possible from a static website without Microsoft Graph/API,
// so this browser reads the GitHub PhotoIndex CSV, previews the generated OneDrive .jpeg, and saves only the selected photoName.
const MS_MATERIAL_PHOTO_INDEX_URL = 'https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/PhotoIndex.csv';
const MS_MATERIAL_PHOTO_LIBRARY_DB_PATH = 'material_photo_library';
const MS_MATERIAL_PHOTO_LIBRARY_CACHE_KEY = 'ms_material_photo_library_names';
const MS_MATERIAL_PHOTO_LIBRARY_LIMIT = 80;
let msPhotoBrowserContext = { mode: 'input', targetInputId: 'ms-new-photo-url', itemKey: '', prefill: '' };

function msEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function msNormalizePhotoUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';

    // Allow only normal web links for legacy/custom photo links.
    // This prevents javascript: or other unsafe URL types from being saved/rendered.
    if (!/^https?:\/\//i.test(url)) return '';

    return url;
}

function msNormalizePhotoName(value) {
    let name = String(value || '').trim();
    if (!name || /^https?:\/\//i.test(name)) return '';

    // Users should type only the filename, but this safely handles pasted local/path text.
    name = name.split(/[\\/]/).pop().trim();

    // The system appends .jpeg automatically, so keep only the clean base filename.
    name = name.replace(/\.(jpe?g|png|webp|gif)$/i, '').trim();

    // Avoid URL query/hash/path characters in saved file names. Spaces are allowed and encoded later.
    if (!name || /[?#<>:"|*]/.test(name)) return '';

    return name;
}

function msIsMaterialPhotoBaseUrl(url) {
    return String(url || '').toLowerCase().startsWith(MS_MATERIAL_PHOTO_BASE_URL.toLowerCase());
}

function msExtractPhotoNameFromUrl(url) {
    try {
        const parsed = new URL(url);
        const fileName = decodeURIComponent((parsed.pathname || '').split('/').pop() || '');
        return msNormalizePhotoName(fileName);
    } catch (err) {
        return '';
    }
}

function msBuildMaterialPhotoUrlFromName(photoName) {
    const cleanName = msNormalizePhotoName(photoName);
    if (!cleanName) return '';
    return `${MS_MATERIAL_PHOTO_BASE_URL}${encodeURIComponent(cleanName)}${MS_MATERIAL_PHOTO_DEFAULT_EXT}`;
}

function msPreparePhotoDataForSave(value) {
    const raw = String(value || '').trim();
    if (!raw) return { photoName: '', photoUrl: '' };

    // Backward compatibility: full URL is still accepted.
    if (/^https?:\/\//i.test(raw)) {
        const cleanUrl = msNormalizePhotoUrl(raw);
        if (!cleanUrl) return null;

        // If it is from the fixed SharePoint photo folder, save only the filename.
        if (msIsMaterialPhotoBaseUrl(cleanUrl)) {
            const extractedName = msExtractPhotoNameFromUrl(cleanUrl);
            if (!extractedName) return null;
            return { photoName: extractedName, photoUrl: '' };
        }

        // For any old/custom external full URL, keep it as legacy photoUrl.
        return { photoName: '', photoUrl: cleanUrl };
    }

    const cleanName = msNormalizePhotoName(raw);
    if (!cleanName) return null;

    return { photoName: cleanName, photoUrl: '' };
}

function msGetMaterialPhotoInputValue(item) {
    const photoName = msNormalizePhotoName(item?.photoName || item?.photoFileName || item?.photoFile || '');
    if (photoName) return photoName;

    const legacyUrl = msNormalizePhotoUrl(item?.photoUrl || item?.photoLink || '');
    if (legacyUrl && msIsMaterialPhotoBaseUrl(legacyUrl)) {
        return msExtractPhotoNameFromUrl(legacyUrl) || legacyUrl;
    }

    return legacyUrl;
}

function msGetMaterialPhotoUrl(item) {
    const photoName = msNormalizePhotoName(item?.photoName || item?.photoFileName || item?.photoFile || '');
    if (photoName) return msBuildMaterialPhotoUrlFromName(photoName);

    // photoUrl/photoLink are accepted for compatibility with older records.
    return msNormalizePhotoUrl(item?.photoUrl || item?.photoLink || '');
}

function msBuildMaterialPhotoCard(item, canAttachPhoto) {
    const photoUrl = msGetMaterialPhotoUrl(item);
    const safeUrl = msEscapeHtml(photoUrl);
    const productName = msEscapeHtml(item?.productName || 'Material Photo');
    const itemKey = msEscapeHtml(item?.key || '');
    const pickerBtn = canAttachPhoto
        ? `<button type="button" class="secondary-btn ms-open-photo-picker-btn" data-key="${itemKey}" style="padding:5px 10px; font-size:0.78rem;"><i class="fa-solid fa-images"></i> Browse Photo</button>`
        : '';
    const clearBtn = (canAttachPhoto && itemKey)
        ? `<button type="button" class="secondary-btn ms-clear-photo-btn" data-key="${itemKey}" style="padding:5px 10px; font-size:0.78rem; background:#fff5f5; color:#c92a2a; border-color:#ffc9c9;"><i class="fa-solid fa-trash-can"></i> Remove Photo</button>`
        : '';

    if (!photoUrl) {
        return `
            <div class="ms-photo-card ms-photo-empty">
                <div class="ms-photo-placeholder">
                    <i class="fa-regular fa-image" style="font-size:2rem; color:#9aa7b1;"></i>
                    <div style="font-weight:700; color:#6c757d; margin-top:8px;">No photo available</div>
                    <div style="font-size:0.78rem; color:#89949e; margin-top:4px;">Browse the OneDrive photo library, preview, then attach the closest matching .jpg photo.</div>
                    ${canAttachPhoto ? `<div class="ms-photo-actions" style="margin-top:10px;">${pickerBtn}</div>` : ''}
                </div>
            </div>`;
    }

    return `
        <div class="ms-photo-card">
            <img src="${safeUrl}" alt="${productName}" class="ms-material-photo-img" loading="lazy" onerror="this.style.display='none'; var box=this.closest('.ms-photo-card'); if(box){ var f=box.querySelector('.ms-photo-fallback'); if(f) f.classList.remove('hidden'); }">
            <div class="ms-photo-fallback hidden">
                <i class="fa-regular fa-image" style="font-size:2rem; color:#9aa7b1;"></i>
                <div style="font-weight:700; color:#6c757d; margin-top:8px;">Preview not available</div>
                <div style="font-size:0.78rem; color:#89949e; margin-top:4px;">The OneDrive/SharePoint link may not allow direct image preview.</div>
            </div>
            <div class="ms-photo-actions">
                <a href="${safeUrl}" target="_blank" rel="noopener" class="secondary-btn" style="text-decoration:none; padding:5px 10px; font-size:0.78rem;"><i class="fa-solid fa-up-right-from-square"></i> Open Photo</a>
                ${pickerBtn}
                ${clearBtn}
            </div>
        </div>`;
}


function msGetCurrentMaterialUserName() {
    try {
        if (window.currentApprover && window.currentApprover.Name) return String(window.currentApprover.Name).trim();
        if (window.currentUser && window.currentUser.Name) return String(window.currentUser.Name).trim();
        if (window.currentUser && window.currentUser.username) return String(window.currentUser.username).trim();
    } catch (_) {}
    return '';
}

function msCanAttachMaterialPhoto() {
    // Photo attachment only saves a small photoName text field, not stock quantity/details.
    // Allow logged-in inventory users so site staff can attach photos without opening full stock editing.
    return !!msGetCurrentMaterialUserName();
}

function msPhotoLibraryKey(photoName) {
    const cleanName = msNormalizePhotoName(photoName);
    if (!cleanName) return '';
    return encodeURIComponent(cleanName).replace(/[.#$\[\]\/]/g, '_');
}

function msAddPhotoCandidate(map, value, source) {
    const cleanName = msNormalizePhotoName(value);
    if (!cleanName) return;
    const key = cleanName.toLowerCase();
    if (!map.has(key)) map.set(key, { name: cleanName, source: source || 'Library' });
}

function msGetCsvFirstColumn(line) {
    const raw = String(line || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return '';

    // Small CSV first-column parser so names with commas inside quotes do not break.
    if (raw.startsWith('"')) {
        let out = '';
        for (let i = 1; i < raw.length; i++) {
            const ch = raw[i];
            if (ch === '"' && raw[i + 1] === '"') {
                out += '"';
                i++;
                continue;
            }
            if (ch === '"') return out.trim();
            out += ch;
        }
        return out.trim();
    }

    return raw.split(',')[0].trim();
}

function msParsePhotoIndexText(text) {
    const names = [];
    String(text || '').split(/\r?\n/).forEach((line, idx) => {
        let value = msGetCsvFirstColumn(line);
        if (!value) return;

        // Skip normal CSV headers. Required header is photoName.
        const header = value.replace(/\s+/g, '').toLowerCase();
        if (idx === 0 && ['photoname', 'photo', 'filename', 'name', 'itemphoto'].includes(header)) return;

        const cleanName = msNormalizePhotoName(value);
        if (cleanName) names.push(cleanName);
    });
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

async function msFetchOptionalPhotoIndexNames() {
    const indexUrl = (window.MS_MATERIAL_PHOTO_INDEX_URL || MS_MATERIAL_PHOTO_INDEX_URL || '').trim();
    if (!indexUrl || !/^https?:\/\//i.test(indexUrl)) return [];

    try {
        const fetchUrl = `${indexUrl}${indexUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;
        const response = await fetch(fetchUrl, { cache: 'no-store' });
        if (!response.ok) return [];
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
            const data = await response.json();
            if (Array.isArray(data)) return data.map(v => typeof v === 'string' ? v : (v.photoName || v.name || '')).filter(Boolean);
            if (data && Array.isArray(data.photos)) return data.photos.map(v => typeof v === 'string' ? v : (v.photoName || v.name || '')).filter(Boolean);
            return [];
        }
        return msParsePhotoIndexText(await response.text());
    } catch (err) {
        console.warn('Photo index could not be loaded:', err);
        return [];
    }
}

async function msGetMaterialPhotoLibraryNames() {
    const candidates = new Map();

    // 1) Names already attached to stock items.
    (allMaterialStockData || []).forEach(item => {
        msAddPhotoCandidate(candidates, item?.photoName || item?.photoFileName || item?.photoFile || '', 'Used in Stock');
        const legacyUrl = msNormalizePhotoUrl(item?.photoUrl || item?.photoLink || '');
        if (legacyUrl && msIsMaterialPhotoBaseUrl(legacyUrl)) msAddPhotoCandidate(candidates, msExtractPhotoNameFromUrl(legacyUrl), 'Used in Stock');
    });

    // 2) Cached names from previous browser sessions.
    try {
        const cached = JSON.parse(localStorage.getItem(MS_MATERIAL_PHOTO_LIBRARY_CACHE_KEY) || '[]');
        if (Array.isArray(cached)) cached.forEach(name => msAddPhotoCandidate(candidates, name, 'Cached'));
    } catch (_) {}

    // 3) Optional hardcoded list if you later add one in index.html.
    try {
        if (Array.isArray(window.MS_MATERIAL_PHOTO_LIBRARY)) {
            window.MS_MATERIAL_PHOTO_LIBRARY.forEach(name => msAddPhotoCandidate(candidates, name, 'Configured'));
        }
    } catch (_) {}

    // 4) Optional Firebase text library. This is database text only, not Firebase Storage.
    try {
        const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
        const snap = await database.ref(MS_MATERIAL_PHOTO_LIBRARY_DB_PATH).once('value');
        const value = snap.val();
        if (value) {
            if (Array.isArray(value)) {
                value.forEach(v => msAddPhotoCandidate(candidates, typeof v === 'string' ? v : (v.photoName || v.name || ''), 'Library'));
            } else {
                Object.keys(value).forEach(k => {
                    const v = value[k];
                    msAddPhotoCandidate(candidates, typeof v === 'string' ? v : (v.photoName || v.name || k), 'Library');
                });
            }
        }
    } catch (err) {
        console.warn('Photo library DB list not available:', err);
    }

    // 5) Optional external PhotoIndex.csv/txt/json file if configured.
    const indexNames = await msFetchOptionalPhotoIndexNames();
    indexNames.forEach(name => msAddPhotoCandidate(candidates, name, 'Photo Index'));

    const names = Array.from(candidates.values()).map(v => v.name).sort((a, b) => a.localeCompare(b));
    try { localStorage.setItem(MS_MATERIAL_PHOTO_LIBRARY_CACHE_KEY, JSON.stringify(names)); } catch (_) {}
    return names;
}

async function msRememberMaterialPhotoName(photoName) {
    const cleanName = msNormalizePhotoName(photoName);
    if (!cleanName) return;

    // Cache locally first for immediate browsing.
    try {
        const cached = JSON.parse(localStorage.getItem(MS_MATERIAL_PHOTO_LIBRARY_CACHE_KEY) || '[]');
        const next = Array.from(new Set([...(Array.isArray(cached) ? cached : []), cleanName])).sort((a, b) => a.localeCompare(b));
        localStorage.setItem(MS_MATERIAL_PHOTO_LIBRARY_CACHE_KEY, JSON.stringify(next));
    } catch (_) {}

    // Also store in Firebase Realtime Database as tiny text, if rules allow.
    try {
        const key = msPhotoLibraryKey(cleanName);
        if (!key) return;
        const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
        await database.ref(`${MS_MATERIAL_PHOTO_LIBRARY_DB_PATH}/${key}`).set({
            photoName: cleanName,
            updatedBy: msGetCurrentMaterialUserName() || 'System',
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
    } catch (err) {
        console.warn('Photo name saved locally but not to shared library:', err);
    }
}

function msSetPhotoBrowserStatus(message, isError) {
    const el = document.getElementById('ms-photo-browser-status');
    if (!el) return;
    el.innerHTML = message || '';
    el.style.color = isError ? '#dc3545' : '#6c757d';
}

function msRenderPhotoBrowserPreview(photoName) {
    const preview = document.getElementById('ms-photo-browser-preview');
    if (!preview) return;
    const cleanName = msNormalizePhotoName(photoName);
    if (!cleanName) {
        preview.innerHTML = '';
        preview.hidden = true;
        return;
    }
    preview.hidden = false;
    const url = msBuildMaterialPhotoUrlFromName(cleanName);
    preview.innerHTML = `
        <div class="ms-photo-browser-preview-card clean">
            <img src="${msEscapeHtml(url)}" alt="${msEscapeHtml(cleanName)}" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
            <div class="ms-photo-browser-preview-fallback hidden">Preview not available.</div>
        </div>`;
}

function msFilterAndRenderPhotoLibrary(names) {
    const grid = document.getElementById('ms-photo-browser-grid');
    const datalist = document.getElementById('ms-photo-browser-options');
    const manualEl = document.getElementById('ms-photo-browser-manual');
    const query = String(manualEl?.value || '').trim().toLowerCase();

    const unique = new Map();
    (Array.isArray(names) ? names : []).forEach(name => {
        const cleanName = msNormalizePhotoName(name);
        if (cleanName) unique.set(cleanName.toLowerCase(), cleanName);
    });

    const sourceNames = Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
    const filtered = sourceNames.filter(name => !query || String(name).toLowerCase().includes(query));
    const shown = filtered.slice(0, MS_MATERIAL_PHOTO_LIBRARY_LIMIT);

    // Native datalist = compact dropdown. It avoids filling the modal with hundreds/thousands of buttons.
    if (datalist) {
        datalist.innerHTML = shown.map(name => `<option value="${msEscapeHtml(name)}"></option>`).join('');
    }

    // Keep the old grid container empty for backward CSS/HTML compatibility.
    if (grid) grid.innerHTML = '';

    if (!sourceNames.length) {
        msSetPhotoBrowserStatus('PhotoIndex.csv was not loaded yet. You can still type the exact OneDrive file name manually.', false);
        return;
    }

    if (!query) {
        msSetPhotoBrowserStatus(`${sourceNames.length} photo names loaded. Start typing to search, then choose from the dropdown.`, false);
        return;
    }

    if (!filtered.length) {
        msSetPhotoBrowserStatus('No matching photo name found in PhotoIndex.csv. If the file exists in OneDrive, you can still use this exact name.', false);
        return;
    }

    const limitNote = filtered.length > shown.length ? ` Showing first ${shown.length}.` : '';
    msSetPhotoBrowserStatus(`${filtered.length} match${filtered.length === 1 ? '' : 'es'} found.${limitNote} Choose from the dropdown or click Use This Photo.`, false);
}

async function msOpenMaterialPhotoBrowser(options = {}) {
    if (!msCanAttachMaterialPhoto()) {
        alert('Access Denied: You need to be logged in to attach item photos.');
        return;
    }

    msPhotoBrowserContext = {
        mode: options.mode || 'input',
        targetInputId: options.targetInputId || 'ms-new-photo-url',
        itemKey: options.itemKey || '',
        prefill: options.prefill || ''
    };

    const modal = document.getElementById('ms-photo-browser-modal');
    if (!modal) {
        alert('Photo browser modal was not found. Please refresh and try again.');
        return;
    }

    const manual = document.getElementById('ms-photo-browser-manual');
    const search = document.getElementById('ms-photo-browser-search');
    const targetLabel = document.getElementById('ms-photo-browser-target');
    const item = msPhotoBrowserContext.itemKey ? (allMaterialStockData || []).find(i => i.key === msPhotoBrowserContext.itemKey) : null;
    const initialName = msNormalizePhotoName(msPhotoBrowserContext.prefill || (item ? msGetMaterialPhotoInputValue(item) : (document.getElementById(msPhotoBrowserContext.targetInputId)?.value || '')));

    if (manual) manual.value = initialName;
    if (search) search.value = '';
    if (targetLabel) {
        targetLabel.textContent = item ? `Attaching photo for: ${(item.productID || item.productId || '')} - ${(item.productName || '')}` : 'Choose a photo name for the current item.';
    }

    msRenderPhotoBrowserPreview(initialName);
    modal.classList.remove('hidden');
    msSetPhotoBrowserStatus('Loading photo library...', false);

    const names = await msGetMaterialPhotoLibraryNames();
    window.__msLastPhotoLibraryNames = names;
    msFilterAndRenderPhotoLibrary(names);
}

function msCloseMaterialPhotoBrowser() {
    const modal = document.getElementById('ms-photo-browser-modal');
    if (modal) modal.classList.add('hidden');
}

async function msSavePhotoNameForItem(itemKey, photoName) {
    const cleanName = msNormalizePhotoName(photoName);
    if (!itemKey || !cleanName) {
        alert('Please select or type a valid photo name.');
        return;
    }
    if (!msCanAttachMaterialPhoto()) {
        alert('Access Denied: You need to be logged in to attach item photos.');
        return;
    }

    try {
        const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
        await database.ref(`material_stock/${itemKey}`).update({
            photoName: cleanName,
            photoUrl: null,
            photoUpdatedBy: msGetCurrentMaterialUserName() || 'System',
            photoUpdatedAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });
        await msRememberMaterialPhotoName(cleanName);

        const item = (allMaterialStockData || []).find(i => i.key === itemKey);
        if (item) {
            item.photoName = cleanName;
            item.photoUrl = '';
            item.photoUpdatedBy = msGetCurrentMaterialUserName() || 'System';
        }

        localStorage.removeItem(STOCK_CACHE_KEY);
        msCloseMaterialPhotoBrowser();
        renderMaterialStockTable(allMaterialStockData);
        alert(`Photo attached: ${cleanName}.jpg`);
    } catch (err) {
        console.error('Failed to attach photo:', err);
        alert('Could not attach photo. Please check your connection or permission.');
    }
}


async function msClearPhotoForItem(itemKey) {
    if (!itemKey) return;
    if (!msCanAttachMaterialPhoto()) {
        alert('Access Denied: You need to be logged in to remove item photos.');
        return;
    }

    const item = (allMaterialStockData || []).find(i => i.key === itemKey);
    const itemLabel = item ? `${item.productID || item.productId || ''} - ${item.productName || ''}` : 'this item';
    if (!confirm(`Remove the attached photo from ${itemLabel}?

This will only delete the saved photo name/link from the system. It will NOT delete the actual file from OneDrive.`)) {
        return;
    }

    try {
        const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
        await database.ref(`material_stock/${itemKey}`).update({
            photoName: null,
            photoUrl: null,
            photoFileName: null,
            photoFile: null,
            photoRemovedBy: msGetCurrentMaterialUserName() || 'System',
            photoRemovedAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });
        try { await window.inventoryPocket?.publishMaterialByKey(itemKey); } catch (pocketError) { console.warn('Inventory Pocket photo removal update failed:', pocketError); }

        if (item) {
            item.photoName = '';
            item.photoUrl = '';
            item.photoFileName = '';
            item.photoFile = '';
            item.photoRemovedBy = msGetCurrentMaterialUserName() || 'System';
        }

        localStorage.removeItem(STOCK_CACHE_KEY);
        renderMaterialStockTable(allMaterialStockData);
        alert('Photo link removed. You can now Browse Photo and attach the correct one.');
    } catch (err) {
        console.error('Failed to remove photo:', err);
        alert('Could not remove photo link. Please check your connection or permission.');
    }
}

function msRefreshRegPhotoPreview() {
    const box = document.getElementById('ms-reg-photo-preview');
    const input = document.getElementById('ms-new-photo-url');
    if (!box) return;
    const name = msNormalizePhotoName((input && input.value) || '');
    const url = name && typeof msBuildMaterialPhotoUrlFromName === 'function' ? msBuildMaterialPhotoUrlFromName(name) : '';
    if (!url) {
        box.hidden = true;
        box.innerHTML = '';
        return;
    }
    box.hidden = false;
    box.innerHTML = '<img alt="Item photo" src="' + String(url).replace(/"/g, '') + '">';
}

async function msUseSelectedPhotoName(photoName) {
    const cleanName = msNormalizePhotoName(photoName || document.getElementById('ms-photo-browser-manual')?.value || '');
    if (!cleanName) {
        alert('Please type or choose a valid photo name. Example: IBA-Sample');
        return;
    }

    if (msPhotoBrowserContext.mode === 'item' && msPhotoBrowserContext.itemKey) {
        await msSavePhotoNameForItem(msPhotoBrowserContext.itemKey, cleanName);
        return;
    }

    const input = document.getElementById(msPhotoBrowserContext.targetInputId || 'ms-new-photo-url');
    if (input) {
        input.value = cleanName;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        msRefreshRegPhotoPreview();
    }
    await msRememberMaterialPhotoName(cleanName);
    msCloseMaterialPhotoBrowser();
}

function msInitPhotoBrowserUI() {
    const closeBtn = document.getElementById('ms-photo-browser-close');
    if (closeBtn && closeBtn.dataset.bound !== '1') {
        closeBtn.dataset.bound = '1';
        closeBtn.addEventListener('click', msCloseMaterialPhotoBrowser);
    }

    const cancelBtn = document.getElementById('ms-photo-browser-cancel');
    if (cancelBtn && cancelBtn.dataset.bound !== '1') {
        cancelBtn.dataset.bound = '1';
        cancelBtn.addEventListener('click', msCloseMaterialPhotoBrowser);
    }

    const manual = document.getElementById('ms-photo-browser-manual');
    if (manual && manual.dataset.bound !== '1') {
        manual.dataset.bound = '1';
        const refreshDropdownAndPreview = () => {
            msRenderPhotoBrowserPreview(manual.value);
            msFilterAndRenderPhotoLibrary(window.__msLastPhotoLibraryNames || []);
        };
        manual.addEventListener('input', refreshDropdownAndPreview);
        manual.addEventListener('change', refreshDropdownAndPreview);
    }

    const search = document.getElementById('ms-photo-browser-search');
    if (search && search.dataset.bound !== '1') {
        search.dataset.bound = '1';
        search.addEventListener('input', () => msFilterAndRenderPhotoLibrary(window.__msLastPhotoLibraryNames || []));
    }

    const useBtn = document.getElementById('ms-photo-browser-use');
    if (useBtn && useBtn.dataset.bound !== '1') {
        useBtn.dataset.bound = '1';
        useBtn.addEventListener('click', () => msUseSelectedPhotoName());
    }

    const browseBtn = document.getElementById('ms-browse-photo-btn');
    if (browseBtn && browseBtn.dataset.bound !== '1') {
        browseBtn.dataset.bound = '1';
        browseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            msOpenMaterialPhotoBrowser({ mode: 'input', targetInputId: 'ms-new-photo-url' });
        });
    }

    const photoField = document.getElementById('ms-new-photo-url');
    if (photoField && photoField.dataset.previewBound !== '1') {
        photoField.dataset.previewBound = '1';
        photoField.addEventListener('input', msRefreshRegPhotoPreview);
        photoField.addEventListener('change', msRefreshRegPhotoPreview);
    }

    const clearFieldBtn = document.getElementById('ms-clear-photo-field-btn');
    if (clearFieldBtn && clearFieldBtn.dataset.bound !== '1') {
        clearFieldBtn.dataset.bound = '1';
        clearFieldBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.getElementById('ms-new-photo-url');
            if (input) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
            }
            msRefreshRegPhotoPreview();
        });
    }
}

window.msOpenMaterialPhotoBrowser = msOpenMaterialPhotoBrowser;
window.msCloseMaterialPhotoBrowser = msCloseMaterialPhotoBrowser;
window.msClearPhotoForItem = msClearPhotoForItem;


// ==========================================================================
// GLOBAL REFRESH COOLDOWN (30-min limit per user, per device)
// This prevents accidental repeated full re-downloads from Firebase.
// ==========================================================================
(function initRefreshCooldownHelper(){
    if (window.__attachRefreshCooldown) return;

    const DEFAULT_MINUTES = 30;
    const _inProgress = new Map();

    function _safeStr(v){ return String(v == null ? '' : v); }

    function _getUserName(){
        try {
            if (window.currentApprover && window.currentApprover.Name) return window.currentApprover.Name;
            if (window.currentUser && window.currentUser.username) return window.currentUser.username;
            if (window.currentUser && window.currentUser.Name) return window.currentUser.Name;
        } catch (_) {}
        return 'UnknownUser';
    }

    function _sanitizeKey(s){
        // LocalStorage-safe (and aligns with Firebase key restrictions)
        return _safeStr(s).trim().replace(/[.#$\[\]\/\\]/g, '_').replace(/\s+/g, '_') || 'UnknownUser';
    }

    function _cooldownStorageKey(actionKey){
        const userKey = _sanitizeKey(_getUserName());
        return `refreshCooldown:${userKey}:${actionKey}`;
    }

    function _formatRemaining(ms){
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}m ${s}s`;
    }

    window.__attachRefreshCooldown = function(buttonEl, actionKey, handler, minutes = DEFAULT_MINUTES, opts = {}){
        if (!buttonEl || typeof handler !== 'function') return;

        const cooldownMinutes = (typeof minutes === 'number' && minutes > 0) ? minutes : DEFAULT_MINUTES;
        const cooldownMs = cooldownMinutes * 60 * 1000;

        const showMessage = (typeof opts.showMessage === 'function')
            ? opts.showMessage
            : (msg) => alert(msg);

        const progressKey = _cooldownStorageKey(actionKey) + ':inProgress';

        // Prevent double-binding if called more than once
        if (buttonEl.dataset && buttonEl.dataset.cooldownBound === '1') return;
        if (buttonEl.dataset) buttonEl.dataset.cooldownBound = '1';

        buttonEl.addEventListener('click', async (e) => {
            // Block repeated clicks while an async refresh is running
            if (_inProgress.get(progressKey)) {
                e?.preventDefault?.();
                showMessage('Refresh is already running. Please wait.');
                return;
            }

            const key = _cooldownStorageKey(actionKey);
            const last = parseInt(localStorage.getItem(key) || '0', 10);
            const now = Date.now();

            if (last && (now - last) < cooldownMs) {
                const remaining = cooldownMs - (now - last);
                const nextTime = new Date(last + cooldownMs);
                e?.preventDefault?.();
                showMessage(
                    `Refresh is limited to once every ${cooldownMinutes} minutes.\n\n` +
                    `Please wait ${_formatRemaining(remaining)}.\n` +
                    `Next available: ${nextTime.toLocaleString()}`
                );
                return;
            }

            // Record immediately to prevent spamming heavy downloads
            localStorage.setItem(key, String(now));

            _inProgress.set(progressKey, true);
            try {
                await handler(e);
            } catch (err) {
                console.error('Refresh action failed:', err);
                showMessage('Refresh failed. If this keeps happening, please contact Admin.');
            } finally {
                _inProgress.delete(progressKey);
            }
        }, { passive: false });
    };
})();

// --- 1. STOCK LEGENDS (F / RRR Structure) ---
const STOCK_LEGENDS = {
    "1": {
        "name": "Civil & Structural",
        "relations": {
            "101": "Concrete & Cementitious",
            "102": "Reinforcement Steel",
            "103": "Structural Steel",
            "104": "Masonry (Blocks/Bricks)",
            "105": "Formwork & Shuttering",
            "106": "Waterproofing",
            "107": "Earthworks & Backfill",
            "108": "Roadworks & Paving",
            "109": "Aggregates & Sand",
            "110": "Fasteners & Anchors",
            "111": "Chemicals & Admixtures",
            "112": "Geotextiles & Drainage",
            "113": "Scaffolding"
        }
    },
    "2": {
        "name": "Architectural & Finishes",
        "relations": {
            "201": "Tiles & Stone",
            "202": "Paints & Coatings",
            "203": "Gypsum & Ceiling Systems",
            "204": "Doors, Windows & Ironmongery",
            "205": "Glass & Glazing",
            "206": "Flooring (Vinyl/Carpet/Laminate)",
            "207": "Joinery & Woodworks",
            "208": "Metal Works & Handrails",
            "209": "Sealants, Adhesives & Grouts",
            "210": "Wall Cladding & Panels",
            "211": "Sanitary Fixtures & Accessories & Parts",
            "212": "Accessories & Hardware"
        }
    },
    "3": {
        "name": "Electrical",
        "relations": {
            "301": "Cables & Wires",
            "302": "Conduits, Trunking & Cable Management",
            "303": "Switches, Sockets & Wiring Devices",
            "304": "Lighting Fixtures & Lamps",
            "305": "Distribution, Breakers & Panels",
            "306": "Earthing & Lightning Protection",
            "307": "Cable Accessories (Lugs, Glands, Terminations)",
            "308": "ELV / ICT (Data, CCTV, Access)",
            "309": "Batteries & UPS",
            "310": "Electrical Consumables"
        }
    },
    "4": {
        "name": "Mechanical (HVAC)",
        "relations": {
            "401": "HVAC Equipment",
            "402": "Ventilation System",
            "403": "Plumbing",
            "404": "Valves & Controls",
            "405": "Insulation & Cladding",
            "406": "Diffusers, Grilles & Louvers",
            "408": "Refrigerant & Copper Pipe",
            "409": "Filters & Spares",
            "410": "HVAC Consumables"
        }
    },
    "5": {
        "name": "HSE / PPE",
        "relations": {
            "501": "PPE - Personal Protective Equipment",
            "502": "Medical Supplies",
            "503": "Code Not In USE",
            "504": "Code Not In USE",
            "505": "Code Not In USE",
            "506": "Respiratory Protection",
            "507": "Code Not In USE",
            "508": "Code Not In USE",
            "509": "Hazardous Signage",
            "510": "Fire Safety"
        }
    },
    "6": {
        "name": "Office & Site Facilities",
        "relations": {
            "601": "Office Supplies",
            "602": "Cleaning & Hygiene",
            "603": "Pantry & Drinking Water",
            "604": "Furniture & Fixtures",
            "605": "Electronics Device & Appliances",
            "606": "Code Not In USE",
            "607": "Temporary Utilities",
            "608": "Waste Management",
            "609": "",
            "610": "Misc Facilities Supplies"
        }
    },
    "7": {
        "name": "Equipment & Plant",
        "relations": {
            "701": "Heavy Equipment",
            "702": "Plant",
            "703": "Generators & Power Equipment",
            "704": "Lifting & Rigging",
            "705": "Vehicles & Transport",
            "706": "Code Not In USE",
            "707": "Spares & Maintenance",
            "708": "Fuel & Lubricants",
            "709": "Welding & Cutting Equipment",
            "710": "Safety Barriers & Traffic"
        }
    },
    "8": {
        "name": "Tools & Consumables",
        "relations": {
            "801": "Power Tools",
            "802": "Hand Tools",
            "803": "Tool Accessories (Bits/Blades)",
            "804": "Code Not In USE",
            "805": "Abrasives (Discs/Sandpaper)",
            "806": "Chemicals & Adhesives (Epoxy/Silicone)",
            "807": "Marking & Measuring",
            "808": "Packaging & Protection",
            "809": "Code Not In USE",
            "810": "General Consumables"
        }
    },
    "9": {
        "name": "Other / Unclassified",
        "relations": {
            "901": "Miscellaneous",
            "902": "Client-supplied / Unknown",
            "903": "Scrap / Returns",
			"904": "HO Vehicle",
            "905": "Site Vehicle",
            "906": "Plant & Machinery (Heavy Equipment)"
        }
    }
};

// ==========================================================================
// INIT SYSTEM & SITE FILTER (INCLUDES PRINT CSS FIX)
// ==========================================================================
async function msLoadLatestSites() {
    try {
        if (typeof getFirebaseCSVUrl === 'function' && typeof fetchAndParseSitesCSV === 'function') {
            const url = await getFirebaseCSVUrl('Site.csv');
            if (url) {
                const fresh = await fetchAndParseSitesCSV(url);
                if (fresh && fresh.length) {
                    allSitesCSVData = fresh;
                    try { if (typeof setCache === 'function') setCache('cached_SITES', fresh); } catch (_) {}
                    return fresh;
                }
            }
        }
    } catch (error) {
        console.warn('Material Stock could not refresh Site.csv. Using the saved site list.', error);
    }
    if (typeof allSitesCSVData !== 'undefined' && Array.isArray(allSitesCSVData) && allSitesCSVData.length) {
        return allSitesCSVData;
    }
    try {
        const cached = JSON.parse(localStorage.getItem('cached_SITES') || '{}');
        return Array.isArray(cached.data) ? cached.data : [];
    } catch (_) {
        return [];
    }
}

function msFillSiteOptions(select, sites, keepValue) {
    if (!select) return;
    const current = keepValue != null ? keepValue : select.value;
    const seen = {};
    select.innerHTML = '';
    const add = (value, label) => {
        const key = String(value || '').trim();
        if (!key || seen[key]) return;
        seen[key] = 1;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label || key;
        select.appendChild(opt);
    };
    if (select.id === 'ms-site-filter') add('All', 'All Sites');
    add('Main Store', 'Main Store');
    (sites || []).forEach((site) => {
        const code = String(site.site || site.Site || '').trim();
        if (!code || code === 'Main Store') return;
        const description = String(site.description || site.Description || '').trim();
        add(code, description ? (code + ' - ' + description) : code);
    });
    if (current && select.querySelector(`option[value="${CSS.escape(current)}"]`)) select.value = current;
}

async function initMaterialStockSystem() {

    // --- 1. INJECT PRINT CSS FIX ---
    if (!document.getElementById('ms-print-style-fix')) {
        const style = document.createElement('style');
        style.id = 'ms-print-style-fix';
        style.innerHTML = `
            @media print {
                @page { margin: 5mm; size: auto; }

                body { margin: 0 !important; padding: 0 !important; background: white !important; }
                body * { visibility: hidden; height: 0; overflow: hidden; }

                /* SHOW MODAL & CONTENT */
                #ms-report-modal,
                #ms-report-modal * {
                    visibility: visible !important;
                    height: auto !important;
                    overflow: visible !important;
                    color: black !important;
                }

                /* --- HIDE DUPLICATE TOP TITLE --- */
                .modal-header, .modal-title, #ms-modal-title {
                    display: none !important;
                }

                /* HEADER CONTAINER */
                .print-only-header {
                    display: block !important;
                    visibility: visible !important;
                    margin-bottom: 20px !important;
                    overflow: hidden !important; /* Clears floats */
                }

                /* LOGO: LEFT ALIGNED & LARGER (550px) */
                .print-only-header img {
                    width: 550px !important;
                    max-width: 100% !important;
                    height: auto !important;
                    display: block !important;
                    float: left !important; /* Forces Left Alignment */
                    margin-bottom: 15px !important;
                }

                /* TEXT: CENTERED & BELOW LOGO */
                .print-only-header-text {
                    clear: both !important; /* Moves it below the floated logo */
                    display: block !important;
                    text-align: center !important; /* Centers the text */
                    width: 100% !important;
                }

                .print-only-header h3,
                .print-only-header p,
                .print-only-header span {
                    display: block !important;
                    visibility: visible !important;
                    color: black !important;
                }

                #ms-report-modal {
                    position: absolute !important;
                    left: 0 !important; top: 0 !important;
                    width: 100% !important; margin: 0 !important;
                    border: none !important;
                }
                #ms-report-modal .modal-content {
                    width: 100% !important; margin: 0 !important; padding: 0 !important;
                    box-shadow: none !important; border: none !important;
                }

                #ms-report-modal button, .close-btn, .modal-footer { display: none !important; }

                table { width: 100% !important; border-collapse: collapse !important; }
                th, td { border: 1px solid #ddd !important; padding: 5px !important; font-size: 11px !important; }

                th:nth-child(1), td:nth-child(1) { width: 15% !important; }
                th:nth-child(2), td:nth-child(2) { width: 35% !important; }
                th:nth-child(3), td:nth-child(3) { width: 10% !important; }
                th:nth-child(4), td:nth-child(4) { width: 40% !important; }
            }
        `;
        document.head.appendChild(style);
    }

    // --- 2. EXISTING UI LOGIC (TABS & FILTER) ---
    const tabsContainer = document.getElementById('ms-category-tabs');
    const filterId = 'ms-site-filter';
    if (!tabsContainer) return;

    let row = document.getElementById('ms-family-row');
    if (!row) {
        row = document.createElement('div');
        row.id = 'ms-family-row';
        tabsContainer.parentNode.insertBefore(row, tabsContainer);
    }
    if (tabsContainer.parentNode !== row) row.appendChild(tabsContainer);

    let wrapper = document.getElementById('ms-site-filter-wrap');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'ms-site-filter-wrap';
    }
    if (wrapper.parentNode !== row) row.appendChild(wrapper);

    if (!document.getElementById(filterId)) {
        const select = document.createElement('select');
        select.id = filterId;
        select.className = 'form-control';
        select.addEventListener('change', () => {
            renderMaterialStockTable(allMaterialStockData);
        });
        wrapper.appendChild(select);
    }
    const siteFilter = document.getElementById(filterId);
    const latestSites = await msLoadLatestSites();
    msFillSiteOptions(siteFilter, latestSites);
}

// ==========================================================================
// 1. LOAD DATA
// ==========================================================================
let materialStockLoadPromise = null;

async function populateMaterialStock(forceRefresh = false) {
    // Prevent duplicate simultaneous Firebase stock downloads. Multiple startup/navigation
    // paths can request Material Stock at nearly the same time; only the first request
    // is allowed to perform the read. All other callers await the same promise.
    if (materialStockLoadPromise) {
        console.log('Material Stock load already in progress; reusing the existing load.');
        return materialStockLoadPromise;
    }

    materialStockLoadPromise = (async () => {
    const tableBody = document.getElementById('ms-table-body');
    const tabsContainer = document.getElementById('ms-category-tabs');

    if (!tableBody) return;

    // 12.8.5: one safety sync per Saturday-Thursday cycle. This is the controlled
    // full refresh that covers records whose Pocket entry has already expired.
    if (!forceRefresh && window.inventoryPocket && window.inventoryPocket.needsWeeklySync()) {
        try {
            const syncResult = await window.inventoryPocket.ensureWeeklySafetySync();
            if (syncResult && syncResult.synced) {
                renderCategoryTabs();
                renderMaterialStockTable(allMaterialStockData);
                await fetchTransfersOnly();
                return;
            }
        } catch (syncError) {
            console.warn('Inventory weekly safety sync skipped:', syncError);
        }
    }

    // Browser cache is only trusted when it was created from a complete stock read.
    // A lightweight Firebase metadata count is checked first so a corrupted/partial cache
    // (for example 1 item + 100 Pocket records) can never be mistaken for the full stock.
    if (!forceRefresh) {
        const cached = localStorage.getItem(STOCK_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const age = Date.now() - parsed.timestamp;
                const cacheData = Array.isArray(parsed.data) ? parsed.data : [];
                const cacheCount = cacheData.length;
                const sourceValid = parsed.source === STOCK_CACHE_SOURCE;

                if (age >= 0 && age < STOCK_CACHE_DURATION && sourceValid &&
                    parsed.complete === true && cacheCount >= STOCK_MIN_SAFE_CACHE_COUNT) {
                    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
                    const meta = await msReadStockMeta(database);
                    const firebaseCount = meta && Number.isFinite(Number(meta.count)) ? Number(meta.count) : null;

                    if (firebaseCount !== null && firebaseCount !== cacheCount) {
                        console.warn(`Material Stock cache count mismatch: browser=${cacheCount}, Firebase=${firebaseCount}. Rebuilding full cache...`);
                    } else if (firebaseCount === null) {
                        console.warn('Material Stock metadata is missing. Rebuilding full cache once to establish authoritative count.');
                    } else {
                        console.log(`Loading complete Stock cache (${cacheCount} items)...`);
                        allMaterialStockData = cacheData;
                        window.__ibaMaterialStockFullyLoaded = true;

                        // Start Pocket only after the complete browser dataset is established.
                        try { window.inventoryPocket?.startPocketListener(); } catch (_) {}

                        // Always refresh transfers (movement history).
                        await fetchTransfersOnly();

                        // If any transfer entry is newer than the cache timestamp, refresh stock from DB.
                        let latestActivityTs = 0;
                        if (Array.isArray(allTransferData) && allTransferData.length) {
                            for (const t of allTransferData) {
                                const ts = parseFloat(t.lastUpdated || t.timestamp || 0) || 0;
                                if (ts > latestActivityTs) latestActivityTs = ts;
                            }
                        }

                        if (latestActivityTs && parsed.timestamp && latestActivityTs > parsed.timestamp) {
                            console.log("Stock cache is stale (newer transfers detected). Refreshing stock from DB...");
                            const stockSnap = await database.ref('material_stock').once('value');
                            const stockData = stockSnap.val();
                            allMaterialStockData = [];
                            if (stockData) {
                                Object.keys(stockData).forEach(key => {
                                    allMaterialStockData.push({ key: key, ...stockData[key] });
                                });
                            }
                            await msWriteStockMeta(database, allMaterialStockData.length);
                            localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify({
                                data: allMaterialStockData,
                                timestamp: Date.now(),
                                complete: true,
                                source: STOCK_CACHE_SOURCE
                            }));
                        }

                        renderCategoryTabs();
                        renderMaterialStockTable(allMaterialStockData);
                        return;
                    }
                } else if (cached) {
                    console.warn('Material Stock browser cache is missing completeness marker or is below the safe item threshold. Rebuilding full cache...');
                }
            } catch (e) { console.error("Cache parse error", e); }
        }
    }

    if(tabsContainer) tabsContainer.innerHTML = '<span style="padding:10px;">Downloading data...</span>';

    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Downloading stock data...</td></tr>';

    try {
        const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();

        const [stockSnap, transferSnap] = await Promise.all([
            database.ref('material_stock').once('value'),
            database.ref('transfer_entries').orderByChild('timestamp').once('value')
        ]);

        const stockData = stockSnap.val();
        allMaterialStockData = [];
        if (stockData) {
            Object.keys(stockData).forEach(key => {
                allMaterialStockData.push({ key: key, ...stockData[key] });
            });
        }

        await msWriteStockMeta(database, allMaterialStockData.length);
        window.__ibaMaterialStockFullyLoaded = true;
        localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify({
            data: allMaterialStockData,
            timestamp: Date.now(),
            complete: true,
            source: STOCK_CACHE_SOURCE
        }));
        try { window.inventoryPocket?.startPocketListener(); } catch (_) {}

        const tData = transferSnap.val();
        allTransferData = [];
        if (tData) {
            Object.keys(tData).forEach(key => {
                allTransferData.push({ key: key, ...tData[key] });
            });
            allTransferData.sort((a, b) => b.timestamp - a.timestamp);
        }

        renderCategoryTabs();
        // Show empty state by default (no heavy rendering) until user selects a tab or searches.
        renderMaterialStockTable(allMaterialStockData);

    } catch (error) {
        console.error("Error loading material stock:", error);
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error loading data. Check connection.</td></tr>';
    }
    })();

    try {
        return await materialStockLoadPromise;
    } finally {
        materialStockLoadPromise = null;
    }
}

async function fetchTransfersOnly() {
    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
    try {
        const transferSnap = await database.ref('transfer_entries').orderByChild('timestamp').once('value');
        const tData = transferSnap.val();
        allTransferData = [];
        if (tData) {
            Object.keys(tData).forEach(key => {
                allTransferData.push({ key: key, ...tData[key] });
            });
            allTransferData.sort((a, b) => b.timestamp - a.timestamp);
        }
    } catch(e) { console.warn("Could not fetch transfers:", e); }
}

// ==========================================================================
// 2. TABS & RENDERING
// ==========================================================================
function renderCategoryTabs() {
    const tabsContainer = document.getElementById('ms-category-tabs');
    if (!tabsContainer) return;

    const activeFamilyCodes = new Set();
    allMaterialStockData.forEach(item => {
        if (item.familyCode) activeFamilyCodes.add(item.familyCode);
    });

    // If the selected tab no longer exists in data, fall back to "All".
    // (Only do this when a tab is actually selected.)
    if (currentCategoryFilter && currentCategoryFilter !== 'All' && !activeFamilyCodes.has(currentCategoryFilter)) {
        currentCategoryFilter = 'All';
    }

    const msTabEsc = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const shortenFamilyName = (name, limit = 5) => {
        const clean = String(name || '').trim();
        if (clean.length <= limit) return clean;
        return clean.slice(0, limit);
    };

    const isAllActive = currentCategoryFilter === 'All';
    let html = `<button class="ms-family-chip ms-family-all ${isAllActive ? 'active' : ''}" onclick="filterStockByCategory('All')" title="Show all material families">
                    <span class="ms-family-code">All</span>
                    <span class="ms-family-name">${isAllActive ? 'Families' : ''}</span>
                </button>`;

    const sortedFamilies = Object.keys(STOCK_LEGENDS).sort((a, b) => parseInt(a) - parseInt(b));

    sortedFamilies.forEach(code => {
        if (activeFamilyCodes.has(code)) {
            const name = STOCK_LEGENDS[code].name;
            const isActive = currentCategoryFilter === code;
            const activeClass = isActive ? 'active' : '';
            const displayName = isActive ? name : shortenFamilyName(name, 5);
            html += `<button class="ms-family-chip ${activeClass}" onclick="filterStockByCategory('${code}')" title="Family ${msTabEsc(code)} - ${msTabEsc(name)}" aria-label="Family ${msTabEsc(code)} - ${msTabEsc(name)}">
                        <span class="ms-family-code">${msTabEsc(code)}</span>
                        <span class="ms-family-name">${msTabEsc(displayName)}</span>
                     </button>`;
        }
    });

    tabsContainer.innerHTML = html;

    // Keep the active tab centered when the list is scrollable
    const activeTab = tabsContainer.querySelector('.active');
    if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // Do NOT auto-render the full table here.
    // Rendering is triggered by user action (tab click / search input).
}

window.filterStockByCategory = function(category) {
    currentCategoryFilter = category;
    renderCategoryTabs();
    renderMaterialStockTable(allMaterialStockData);
};

// ==========================================================================
// RENDER TABLE (Fixed: Safe Null Checks for currentApprover)
// ==========================================================================
function msCanonSiteKey(site) {
    const raw = String(site || '').trim();
    if (!raw) return '';
    if (raw.toLowerCase() === 'main store') return 'Main Store';
    return raw.split(/\s+-\s+/)[0].trim().replace(/[.#$[\]\/]/g, '');
}

// ==========================================================================
// 14.0.0 patch 1: ONE STOCK RULE
//   The card's site quantities (material_stock/<key>/sites) ARE the stock.
//   Table, stock report, transfer form and deductions all use that same number.
//   Movement history is used only as a CROSS-CHECK, computed with exactly the same
//   timing the workflow uses to change the card:
//     Transfer : source -approved when authorized (In Transit), destination +received on receipt
//     Restock  : destination +received on receipt
//     Usage    : source -approved when authorized, final = -actual used on confirmation
//     Return   : of Restock -> source -approved; of Usage -> source +approved;
//                otherwise like a Transfer
//     Rejected / pending (not yet authorized) entries move nothing.
//   A reversal entry that carries originalMovement also re-applies the deleted original,
//   so deleting a completed record does not break the cross-check.
// ==========================================================================
const MS_OPEN_STATUSES = ['Pending', 'Pending Source', 'Pending Admin', 'In Transit', 'Pending Confirmation'];

function msHistoryNetBySite(transfers) {
    const net = {};
    const add = (site, qty) => {
        const key = msCanonSiteKey(site);
        if (!key || !qty) return;
        net[key] = (net[key] || 0) + qty;
    };
    const num = (v) => parseFloat(v) || 0;
    (transfers || []).forEach((t) => {
        if (!t) return;
        const state = String(t.remarks || t.status || '').trim();
        const done = state === 'Completed' || state === 'Received';
        const inTransit = state === 'In Transit';
        const pendConf = state === 'Pending Confirmation';
        const type = String(t.jobType || t.for || 'Transfer').trim();
        const from = t.fromLocation || t.fromSite;
        const to = t.toLocation || t.toSite;
        const approved = num(t.approvedQty) || num(t.orderedQty) || num(t.requiredQty);
        const received = num(t.receivedQty) || approved;

        // Original record that was deleted when this reversal was created.
        const om = t.originalMovement;
        if (om && typeof om === 'object') {
            const oType = String(om.jobType || '').trim();
            const oApproved = num(om.approvedQty) || num(om.receivedQty);
            const oReceived = num(om.receivedQty) || oApproved;
            if (oType === 'Transfer') { add(om.from, -oApproved); add(om.to, oReceived); }
            else if (oType === 'Restock') { add(om.to, oReceived); }
            else if (oType === 'Usage') { add(om.from, -oReceived); }
        }

        if (type === 'Transfer') {
            if (inTransit || done) add(from, -approved);
            if (done) add(to, received);
        } else if (type === 'Restock') {
            if (done) add(to, received);
        } else if (type === 'Usage') {
            if (pendConf) add(from, -approved);
            else if (done) add(from, -received);
        } else if (type === 'Return') {
            const orig = String(t.originalJobType || '').trim();
            if (orig === 'Restock') { if (done) add(from, -approved); }
            else if (orig === 'Usage') { if (done) add(from, approved); }
            else {
                if (inTransit || done) add(from, -approved);
                if (done) add(to, received);
            }
        }
    });
    return net;
}

// 14.0.0 patch 1: one site-name helper for the list and the expanded row.
// Uses the fresh Site.csv list first (14.0.0), then the saved copy, and matches
// "178" with "178 - Lusail" (13.0.1 site rule).
function msSiteDisplayName(siteCode) {
    if (siteCode === 'Main Store') return 'Main Store';
    const code = msCanonSiteKey(siteCode);
    let sites = (typeof allSitesCSVData !== 'undefined' && Array.isArray(allSitesCSVData) && allSitesCSVData.length) ? allSitesCSVData : null;
    if (!sites) {
        try { sites = (JSON.parse(localStorage.getItem('cached_SITES') || '{}').data) || []; } catch (_) { sites = []; }
    }
    const found = sites.find(s => s && (s.site == siteCode || s.site == code));
    if (found) return `<span style="color:#00748C; font-weight:bold;">${msEscapeHtml(found.site)}</span> - ${msEscapeHtml(found.description || '')}`;
    return msEscapeHtml(siteCode);
}

function msDisplayStockFromReceipts(item, transfers) {
    const stored = {};
    if (item && item.sites) {
        Object.entries(item.sites).forEach(([site, qty]) => {
            const key = msCanonSiteKey(site);
            if (!key) return;
            stored[key] = (stored[key] || 0) + (parseFloat(qty) || 0);
        });
    }
    const net = msHistoryNetBySite(transfers);
    const openCount = (transfers || []).filter((t) => MS_OPEN_STATUSES.includes(String((t && (t.remarks || t.status)) || '').trim())).length;
    // 14.0.0: a site at 0 stays visible while an open request involves it (display only).
    const pendingSites = new Set();
    (transfers || []).forEach((t) => {
        if (!t || !MS_OPEN_STATUSES.includes(String(t.remarks || t.status || '').trim())) return;
        [t.fromLocation || t.fromSite, t.toLocation || t.toSite].forEach((x) => { const k = msCanonSiteKey(x); if (k) pendingSites.add(k); });
    });
    const rows = [];
    let total = 0;
    let hasGap = false;
    new Set([...Object.keys(stored), ...Object.keys(net)]).forEach((site) => {
        const onCard = stored[site] || 0;
        const expected = (typeof net[site] === 'number') ? net[site] : null;
        // Gap = history proves MORE arrived here than the card holds (a lost stock update).
        // 14.0.0 patch 1: once a site was confirmed in Stock Check, it stops warning until
        // either the card qty or the history qty changes again.
        const ack = item && item.checkedSites && item.checkedSites[site];
        const acknowledged = !!ack && Math.abs((parseFloat(ack.card) || 0) - onCard) < 1e-9 &&
            expected !== null && Math.abs((parseFloat(ack.history) || 0) - expected) < 1e-9;
        const gap = expected !== null && expected > onCard && !acknowledged;
        if (!onCard && !gap && !(Object.prototype.hasOwnProperty.call(stored, site) && pendingSites.has(site))) return;
        if (gap) hasGap = true;
        rows.push({ site, qty: onCard, stored: onCard, expected, gap });
        total += onCard;
    });
    if (!rows.length) {
        const legacy = parseFloat(item && item.stockQty) || 0;
        if (legacy) return { total: legacy, rows: [{ site: 'Unassigned', qty: legacy, stored: legacy, expected: null, gap: false }], hasGap: false, openCount };
    }
    return { total, rows, hasGap, openCount };
}

window.msAlignCompletedReceiptGap = function () {
    return Promise.resolve();
};

function renderMaterialStockTable(data) {
    try {
        const scBtn = document.getElementById('ms-stock-check-btn');
        if (scBtn) scBtn.classList.toggle('hidden', !msCanAlignStock());
    } catch (_) {}
    const tableBody = document.getElementById('ms-table-body');
    const searchInput = document.getElementById('ms-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const countDisplay = document.getElementById('ms-total-count');

    // --- READ SITE FILTER ---
    const siteFilterVal = document.getElementById('ms-site-filter')?.value || 'All';

    // Default state: keep list cleared until user selects a Family tab or types a search term.
    // (Site filter alone does not trigger listing to avoid heavy initial rendering.)
    if (!searchTerm && !currentCategoryFilter) {
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#777;">List cleared. Please select a Family tab above or type in the search box.</td></tr>';
        }
        if (countDisplay) countDisplay.textContent = '';
        lastFilteredStockData = [];
        return;
    }

    // [FIX] Use strict null check (currentApprover && ...)
    const isAdmin = (currentApprover && (currentApprover.Role || '').toLowerCase() === 'admin');
    const isIrwin = (currentApprover && currentApprover.Name === 'Irwin');
    const canMergeStock = isIrwin || String((currentApprover && (currentApprover.Position || currentApprover.position)) || '').toLowerCase().includes('logistic');
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    // Super Admin replacement: allow edit actions in Inventory (no delete)
    const isEditor = (isAdmin || isVacationDelegate);
    const canAttachPhoto = isEditor || msCanAttachMaterialPhoto();

    const bulkBtn = document.getElementById('ms-bulk-delete-btn');
    const mergeBtn = document.getElementById('ms-merge-selected-btn');
    if (bulkBtn) {
        if (isIrwin) bulkBtn.classList.remove('hidden');
        else bulkBtn.classList.add('hidden');
    }
    if (mergeBtn) {
        if (canMergeStock) mergeBtn.classList.remove('hidden');
        else mergeBtn.classList.add('hidden');
    }

    const tableHeadRow = document.querySelector('#ms-table thead tr');
    if (tableHeadRow) {
        if (canMergeStock) {
            if(!document.getElementById('ms-select-all-header')) {
                tableHeadRow.children[0].innerHTML = '<input type="checkbox" id="ms-select-all-header" style="cursor:pointer;">';
                setTimeout(() => {
                    const selectAll = document.getElementById('ms-select-all-header');
                    if(selectAll) {
                        selectAll.onclick = (e) => {
                            document.querySelectorAll('.ms-row-checkbox').forEach(cb => cb.checked = e.target.checked);
                        };
                    }
                }, 100);
            }
        } else {
            tableHeadRow.children[0].innerHTML = '';
        }
    }

    const msCanonSite = (site) => {
        if (typeof window.stockCanonicalSiteKey === 'function') return window.stockCanonicalSiteKey(site);
        const raw = String(site || '').trim();
        if (!raw) return '';
        if (raw.toLowerCase() === 'main store') return 'Main Store';
        return raw.split(/\s+-\s+/)[0].trim().replace(/[.#$[\]\/]/g, '');
    };

    const getSiteDisplayName = (siteCode) => msSiteDisplayName(siteCode);

    const filtered = data.filter(item => {
        // 1. Family Filter Logic
        if (currentCategoryFilter && currentCategoryFilter !== 'All') {
            if (item.familyCode !== currentCategoryFilter) return false;
        }

        // 2. Search Text (SAFE STRING CONVERSION to prevent crash)
        const pID = String(item.productID || item.productId || '').toLowerCase();
        const pName = String(item.productName || '').toLowerCase();
        const pDetails = String(item.details || item.relationship || '').toLowerCase();

        const matchesText = pID.includes(searchTerm) || pName.includes(searchTerm) || pDetails.includes(searchTerm);
        if (!matchesText) return false;

        // 3. SITE FILTER LOGIC
        if (siteFilterVal !== 'All') {
            if (!item.sites || !item.sites[siteFilterVal] || parseFloat(item.sites[siteFilterVal]) <= 0) {
                return false;
            }
        }

        return true;
    });

    // --- SAVE FILTERED DATA FOR REPORTING ---
    // 14.0.0 patch 1: de-duplicate by the real Firebase key only. Previously cards that
    // share the same Product ID were silently hidden (only the newest was shown) while the
    // transfer form could pick the hidden one. Now every real card is shown and flagged.
    const stockByKey = new Map();
    filtered.forEach((item) => {
        const rowKey = String(item.key || item.productID || item.productId || '').trim();
        const current = stockByKey.get(rowKey);
        if (!current) { stockByKey.set(rowKey, item); return; }
        const currentUpdated = parseFloat(current.lastUpdated || 0) || 0;
        const nextUpdated = parseFloat(item.lastUpdated || 0) || 0;
        if (nextUpdated >= currentUpdated) stockByKey.set(rowKey, item);
    });
    const uniqueFiltered = Array.from(stockByKey.values());
    const msIdCardCount = msCountCardsByProductId();

    lastFilteredStockData = uniqueFiltered;

    if (countDisplay) countDisplay.textContent = `(Total: ${uniqueFiltered.length})`;

    tableBody.innerHTML = '';

    if (uniqueFiltered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#777;">No materials found.</td></tr>';
        return;
    }

    uniqueFiltered.forEach(item => {
        // 1. PRE-CALCULATE HISTORY
        const stockID = String(item.productID || item.productId || '').trim();
        const productTransfers = allTransferData.filter(t => {
            const transferID = String(t.productID || t.productId || '').trim();
            return transferID === stockID;
        });

        const displayStock = msDisplayStockFromReceipts(item, productTransfers);
        const totalStock = displayStock.total;
        const gapIcon = displayStock.hasGap
            ? ' <i class="fa-solid fa-triangle-exclamation" style="color:#f0ad4e; margin-left:4px;" title="Movement history shows more stock than this card holds at some site. Open the row to check."></i>'
            : '';
        const dupCount = msIdCardCount.get(stockID) || 0;
        const dupBadge = dupCount > 1
            ? ` <span style="display:inline-block; margin-left:6px; padding:1px 8px; border-radius:10px; background:#fff3cd; color:#8a6100; font-size:0.75rem; font-weight:700;" title="${dupCount} cards use this same Product ID. Tick them and use Merge Selected.">Duplicate ID x${dupCount}</span>`
            : '';

        const uniqueId = `detail-${item.key}`;
        let actionButtons = '';
        let firstColContent = `<button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button>`;

        // Required Materials (Notepad) - always available (local-only; does not modify stock)
        const _pid = item.productID || item.productId || '';
        const _pname = item.productName || '';
        const addToRequiredBtn = `<button type="button" class="secondary-btn ms-row-action-btn ms-add-to-required-btn" data-productid="${encodeURIComponent(String(_pid))}" data-productname="${encodeURIComponent(String(_pname))}" data-key="${item.key}" title="Add to Required List"><i class="fa-solid fa-cart-plus"></i><span>Add</span></button>`;

       if (isEditor) {
            // All Admins and Vacation Delegates can Edit
            actionButtons += addToRequiredBtn;
            actionButtons += `<button type="button" class="secondary-btn ms-row-action-btn ms-edit-stock-btn" data-key="${item.key}" title="Edit Details & Add Stock"><i class="fa-solid fa-pen-to-square"></i><span>Edit</span></button>`;

            // Delete remains Irwin-only
            if (isIrwin) {
                actionButtons += `<button type="button" class="delete-btn ms-row-action-btn ms-delete-btn" data-key="${item.key}" title="Delete Item"><i class="fa-solid fa-trash"></i><span>Delete</span></button>`;
            }
        } else {
            actionButtons = addToRequiredBtn + `<span class="ms-view-only-note">View Only</span>`;
        }
        if (canMergeStock) {
            firstColContent = `
                <div class="ms-row-selector">
                    <input type="checkbox" class="ms-row-checkbox" data-key="${item.key}" data-name="${item.productName}">
                    <button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button>
                </div>
            `;
        }

        actionButtons = `<div class="ms-row-actions">${actionButtons}</div>`;


        const familyDisplay = item.family || item.category || 'Unclassified';
        const relationshipDisplay = item.relationship || item.details || '';
        const materialPhotoCard = msBuildMaterialPhotoCard(item, canAttachPhoto);
        const hasPhotoIcon = msGetMaterialPhotoUrl(item) ? ' <i class="fa-regular fa-image" title="Photo available" style="color:#00748C; margin-left:6px;"></i>' : '';

        const parentRow = document.createElement('tr');
        parentRow.dataset.key = item.key || '';
        parentRow.classList.add('ms-parent-row');
        parentRow.innerHTML = `
            <td class="ms-cell-expand">${firstColContent}</td>
            <td class="ms-cell-code"><span class="ms-product-code">${item.productID || item.productId}</span>${dupBadge}</td>
            <td class="ms-cell-detail"><div class="ms-product-title"><strong>${item.productName}</strong>${hasPhotoIcon}</div></td>
            <td class="ms-cell-family"><span class="ms-family-badge">${familyDisplay}</span></td>
            <td class="ms-cell-relation"><span class="ms-relation-text">${relationshipDisplay || '-'}</span></td>
            <td class="ms-cell-stock"><span class="ms-stock-pill">${totalStock}</span>${gapIcon}</td>
            <td class="ms-cell-actions">${actionButtons}</td>
        `;

        // UX: allow expanding/collapsing by clicking anywhere on the parent row
        // (except interactive elements like buttons/checkboxes).
        parentRow.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('select') || e.target.closest('textarea')) {
                return;
            }
            const expandBtn = parentRow.querySelector('.ms-expand-btn');
            if (expandBtn) {
                window.toggleStockDetail(uniqueId, expandBtn);
            }
        });

        const childRow = document.createElement('tr');
        childRow.id = uniqueId;
        childRow.className = 'stock-child-row hidden';
        childRow.dataset.itemKey = item.key || '';
        childRow.dataset.ready = '0';
        childRow.innerHTML = '<td colspan="7" style="padding:12px 25px; color:#777;">Open this row to load stock and movement history.</td>';

        tableBody.appendChild(parentRow);
        tableBody.appendChild(childRow);
    });
    if (typeof msPaintRowFrost === 'function') msPaintRowFrost();


    // Bind action buttons (works for both admins and vacation delegates)
    document.querySelectorAll('.ms-edit-stock-btn').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const key = this.getAttribute('data-key');
            if (typeof openSuperAdminEdit === 'function') openSuperAdminEdit(key);
        });
    });

    document.querySelectorAll('.ms-open-photo-picker-btn').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const key = this.getAttribute('data-key');
            msOpenMaterialPhotoBrowser({ mode: 'item', itemKey: key });
        });
    });

    document.querySelectorAll('.ms-clear-photo-btn').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const key = this.getAttribute('data-key');
            msClearPhotoForItem(key);
        });
    });

    document.querySelectorAll('.ms-add-stock-text-btn').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const key = this.getAttribute('data-key');
            if (typeof openAddStockModal === 'function') openAddStockModal(key);
        });
    });

document.querySelectorAll('.ms-delete-btn').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteMaterial(this.getAttribute('data-key'));
        });
    });

    // Required Materials list (local-only)
    document.querySelectorAll('.ms-add-to-required-btn').forEach(btn => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const productID = decodeURIComponent(this.getAttribute('data-productid') || '');
            const productName = decodeURIComponent(this.getAttribute('data-productname') || '');
            const key = this.getAttribute('data-key');

            const item = allMaterialStockData.find(i => i.key === key) || { key, productID, productName };
            msAddToRequiredList(item);
            // Quick feedback: update the Required List button count
            msUpdateRequiredListButton();
        });
    });
}

// ==========================================================================
// 4. DELETE & EDIT LOGIC
// ==========================================================================

window.handleDeleteMaterial = async function(key) {
    const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : '';

    if (currentUser !== 'Irwin') {
        alert("Access Denied: Only Super Admin (Irwin) can delete items.");
        return;
    }

    const item = allMaterialStockData.find(i => i.key === key);
    if (!item) { alert("Error: Item not found."); return; }

    const productID = item.productID || item.productId;
    const productName = item.productName;

    // 14.0.0 patch 1: keep the history when another card still uses this Product ID
    // (duplicate cards / same-ID merge), otherwise deleting the empty card wipes the history.
    const idStillUsed = allMaterialStockData.some(other => other.key !== key &&
        String(other.productID || other.productId || '').trim() === String(productID || '').trim());
    const relatedTransfers = idStillUsed ? [] : allTransferData.filter(t =>
        (t.productID === productID || t.productId === productID)
    );

    const confirmMsg = idStillUsed
        ? `⚠️ MASTER DELETE (Super Admin) ⚠️\n\nProduct: ${productName}\nID: ${productID}\n\nAnother card still uses this Product ID, so the movement history will be KEPT. Only this card is deleted.\n\nProceed?`
        : `⚠️ MASTER DELETE (Super Admin) ⚠️\n\nProduct: ${productName}\nID: ${productID}\n\nThis will DELETE the item AND ALL ${relatedTransfers.length} related transactions history.\n\nThis cannot be undone. Proceed?`;

    if (confirm(confirmMsg)) {
        const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
        const updates = {};

        updates[`material_stock/${key}`] = null;
        updates[`${STOCK_META_PATH}/count`] = firebase.database.ServerValue.increment(-1);
        updates[`${STOCK_META_PATH}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;
        relatedTransfers.forEach(t => {
            updates[`transfer_entries/${t.key}`] = null;
        });

        try {
            await database.ref().update(updates);
            try { await window.inventoryPocket?.removeMaterialFromPocketByKey(key); } catch (pocketError) { console.warn('Inventory Pocket delete cleanup failed:', pocketError); }
            alert(`Master Delete Successful.\nRemoved: ${productName}`);
            localStorage.removeItem(STOCK_CACHE_KEY);
            populateMaterialStock(true);
        } catch (e) {
            console.error("Master delete failed:", e);
            alert("Database Error: Could not delete records.");
        }
    }
};

window.deleteStock = window.handleDeleteMaterial;

// ==========================================================================
// 5. MODAL LOGIC: OPEN & AUTO-POPULATION
// ==========================================================================
window.openNewMaterialModal = async function() {
    // Permission: Admins can edit. Super Admin's Vacation Delegate can edit while delegation is active.
    const role = (typeof currentApprover !== 'undefined' && currentApprover) ? (currentApprover.Role || '') : '';
    const isAdminUser = String(role).trim().toLowerCase() === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    if (!isAdminUser && !isVacationDelegate) {
        alert("View Only: You do not have permission to register new materials.");
        return;
    }

    // Always start in CREATE mode
    editingItemKey = null;
    const saveBtn = document.getElementById('ms-save-new-btn');
    if (saveBtn) saveBtn.textContent = 'Save';
    if (!allMaterialStockData || allMaterialStockData.length === 0) {
        const btn = document.getElementById('ms-add-new-btn');
        if(btn) btn.textContent = "Loading Data...";
        await populateMaterialStock(false);
        if(btn) btn.innerHTML = '<i class="fa-solid fa-plus"></i> Register New Material';
    }

    const modal = document.getElementById('ms-new-material-modal');
    const form = document.getElementById('ms-new-material-form');

    modal.classList.remove('hidden');
    form.reset();
    document.getElementById('ms-modal-title').textContent = "Register New Material";
    const stockRow = document.getElementById('ms-stock-entry-row');
    if (stockRow) stockRow.style.display = '';

    const familySelect = document.getElementById('ms-new-family');
    familySelect.innerHTML = '<option value="" disabled selected>Select Family</option>';

    Object.keys(STOCK_LEGENDS).sort().forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${code} - ${STOCK_LEGENDS[code].name}`;
        familySelect.appendChild(opt);
    });

    const relationSelect = document.getElementById('ms-new-relation');
    relationSelect.innerHTML = '<option value="" disabled selected>Select Relationship</option>';

    familySelect.onchange = function() {
        const ff = this.value;
        relationSelect.innerHTML = '<option value="" disabled selected>Select Relationship</option>';

        if(STOCK_LEGENDS[ff] && STOCK_LEGENDS[ff].relations) {
            const rels = STOCK_LEGENDS[ff].relations;
            Object.keys(rels).sort().forEach(rr => {
                const opt = document.createElement('option');
                opt.value = rr;
                opt.textContent = `${rr} - ${rels[rr]}`;
                relationSelect.appendChild(opt);
            });
        }
        generatePreviewID();
    };

    relationSelect.onchange = generatePreviewID;
    const idDisp = document.getElementById('ms-new-id-display');
    if (idDisp) {
        idDisp.value = "Auto-Generated";
        delete idDisp.dataset.series;
    }

    const stockInput = document.getElementById('ms-new-stock-qty');
    if (stockInput) stockInput.placeholder = 'Initial Stock (Optional)';

    const photoInput = document.getElementById('ms-new-photo-url');
    if (photoInput) photoInput.value = '';
    msRefreshRegPhotoPreview();

    populateModalSiteDropdown();
};

window.openSuperAdminEdit = function(key) {
    const item = allMaterialStockData.find(i => i.key === key);
    if(!item) return;

    editingItemKey = key;

    const modal = document.getElementById('ms-new-material-modal');
    modal.classList.remove('hidden');

    document.getElementById('ms-modal-title').textContent = "Edit Item";
    document.getElementById('ms-save-new-btn').textContent = "Update Item";
    const stockRow = document.getElementById('ms-stock-entry-row');
    if (stockRow) stockRow.style.display = 'none';

    document.getElementById('ms-new-name').value = item.productName;
    document.getElementById('ms-new-id-display').value = item.productID;

    const photoInput = document.getElementById('ms-new-photo-url');
    if (photoInput) photoInput.value = msGetMaterialPhotoInputValue(item);
    msRefreshRegPhotoPreview();

    const famSelect = document.getElementById('ms-new-family');
    if(famSelect.options.length <= 1) {
         Object.keys(STOCK_LEGENDS).sort().forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${code} - ${STOCK_LEGENDS[code].name}`;
            famSelect.appendChild(opt);
        });
    }
    famSelect.value = item.familyCode;

    const relationSelect = document.getElementById('ms-new-relation');
    relationSelect.innerHTML = '<option value="" disabled>Select Relationship</option>';
    if(STOCK_LEGENDS[item.familyCode]) {
        const rels = STOCK_LEGENDS[item.familyCode].relations;
        Object.keys(rels).sort().forEach(rr => {
            const opt = document.createElement('option');
            opt.value = rr;
            opt.textContent = `${rr} - ${rels[rr]}`;
            relationSelect.appendChild(opt);
        });
    }
    relationSelect.value = item.relationCode;

    const stockInput = document.getElementById('ms-new-stock-qty');
    stockInput.value = '';
    stockInput.placeholder = "Add Stock (Optional)";

    populateModalSiteDropdown();
};

function msParseSeriesFromProductId(pid) {
    const s = String(pid || '').trim();
    const m = s.match(/^(\d+)\.(\d+)\.(\d{1,})$/);
    if (!m) return null;
    const n = parseInt(m[3], 10);
    return Number.isFinite(n) ? n : null;
}

function generatePreviewID() {
    if (typeof editingItemKey !== 'undefined' && editingItemKey) return;

    const ff = document.getElementById('ms-new-family').value;
    const rr = document.getElementById('ms-new-relation').value;
    const idInput = document.getElementById('ms-new-id-display');

    if(ff && rr) {
        let maxSeries = 0;
        allMaterialStockData.forEach(item => {
            const s1 = (item.series !== undefined && item.series !== null && item.series !== '') ? parseInt(item.series, 10) : null;
            const s2 = (s1 === null || !Number.isFinite(s1)) ? msParseSeriesFromProductId(item.productID || item.productId) : null;
            const s = Number.isFinite(s1) ? s1 : (Number.isFinite(s2) ? s2 : null);
            if (Number.isFinite(s) && s > maxSeries) maxSeries = s;
        });
        const nextSeries = maxSeries + 1;
        const sssss = String(nextSeries).padStart(5, '0');
        idInput.value = `${ff}.${rr}.${sssss}`;
        idInput.dataset.series = nextSeries;
    } else {
        idInput.value = "Auto-Generated";
    }
}


window.msCloseNewMaterialModal = function() {
    const modal = document.getElementById('ms-new-material-modal');
    if (modal) modal.classList.add('hidden');

    // Reset state so Auto-ID works next time.
    editingItemKey = null;

    try {
        const form = document.getElementById('ms-new-material-form');
        form?.reset();
        const idInput = document.getElementById('ms-new-id-display');
        if (idInput) {
            idInput.value = 'Auto-Generated';
            delete idInput.dataset.series;
        }
        const saveBtn = document.getElementById('ms-save-new-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
        const stockInput = document.getElementById('ms-new-stock-qty');
        if (stockInput) {
            stockInput.value = '';
            stockInput.placeholder = 'Initial Stock (Optional)';
        }
        const stockRow = document.getElementById('ms-stock-entry-row');
        if (stockRow) stockRow.style.display = '';
        const photoInput = document.getElementById('ms-new-photo-url');
        if (photoInput) photoInput.value = '';
    } catch (_) { /* ignore */ }
};

// ==========================================================================
// 6. SAVE LOGIC
// ==========================================================================
async function handleSaveNewMaterial() {
    // Permission guard (same as modal): Admins OR Super Admin Vacation Delegate.
    const role = (typeof currentApprover !== 'undefined' && currentApprover) ? (currentApprover.Role || '') : '';
    const isAdminUser = String(role).trim().toLowerCase() === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    if (!isAdminUser && !isVacationDelegate) {
        alert("Access Denied: You do not have permission to save material changes.");
        return;
    }

    const btn = document.getElementById('ms-save-new-btn');
    btn.disabled = true;

    const familyCode = document.getElementById('ms-new-family').value;
    const relationCode = document.getElementById('ms-new-relation').value;
    const productDetail = document.getElementById('ms-new-name').value.trim();

    if (!familyCode || !relationCode) {
        alert('Please select Family and Relationship.');
        btn.disabled = false;
        return;
    }
    if (!productDetail) {
        alert('Please enter Item Name.');
        btn.disabled = false;
        return;
    }

    const stockInputVal = parseFloat(document.getElementById('ms-new-stock-qty').value) || 0;
    const selectedSite = document.getElementById('ms-new-site-select').value;
    const photoInputRaw = document.getElementById('ms-new-photo-url')?.value || '';
    const photoData = msPreparePhotoDataForSave(photoInputRaw);
    if (!photoData) {
        alert('Invalid photo name. Type only the file name, for example: IBA-Sample. The system will add .jpg automatically.');
        btn.disabled = false;
        return;
    }
    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();

    try {
        if (editingItemKey) {
            // === UPDATE MODE ===
            const item = allMaterialStockData.find(i => i.key === editingItemKey);

            const updates = {};
            updates['productName'] = productDetail;
            updates['familyCode'] = familyCode;
            updates['family'] = STOCK_LEGENDS[familyCode].name;
            updates['relationCode'] = relationCode;
            updates['relationship'] = STOCK_LEGENDS[familyCode].relations[relationCode];

            updates['category'] = STOCK_LEGENDS[familyCode].name;
            updates['details'] = STOCK_LEGENDS[familyCode].relations[relationCode];
            updates['photoName'] = photoData.photoName || null;
            updates['photoUrl'] = photoData.photoUrl || null;

            updates['updatedBy'] = (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'Irwin');
            updates['lastUpdated'] = firebase.database.ServerValue.TIMESTAMP;

            if (stockInputVal > 0) {
                if (!item.sites) item.sites = {};
                const currentSiteQty = parseFloat(item.sites[selectedSite] || 0);
                item.sites[selectedSite] = currentSiteQty + stockInputVal;

                updates['sites'] = item.sites;
                let total = 0;
                Object.values(item.sites).forEach(q => total += q);
                updates['stockQty'] = total;
                updates['balanceQty'] = total;
            }

            await database.ref(`material_stock/${editingItemKey}`).update(updates);
            try { await window.inventoryPocket?.publishMaterialByKey(editingItemKey); } catch (pocketError) { console.warn('Inventory Pocket update failed:', pocketError); }
            if (photoData.photoName) await msRememberMaterialPhotoName(photoData.photoName);
            alert("Item Updated Successfully!");

        } else {
            // === CREATE NEW MODE ===
            const productID = document.getElementById('ms-new-id-display').value;
            const series = parseInt(document.getElementById('ms-new-id-display').dataset.series);

            if (!productID || productID.includes("Auto")) {
                alert("ID Generation Error. Please select Family + Relationship again.");
                btn.disabled = false;
                return;
            }

            // Prevent duplicate Product ID (can happen if old items did not have series stored)
            const existing = allMaterialStockData.find(i => (i.productID || i.productId) === productID);
            if (existing) {
                alert(`This Product ID already exists: ${productID}\n\nPlease change Family/Relationship and try again.`);
                btn.disabled = false;
                return;
            }

            const sitesInit = {};
            if (stockInputVal > 0) sitesInit[selectedSite] = stockInputVal;

            const familyName = STOCK_LEGENDS[familyCode].name;
            const relationName = STOCK_LEGENDS[familyCode].relations[relationCode];

            const newMaterial = {
                productID: productID,
                productName: productDetail,
                familyCode: familyCode,
                family: familyName,
                relationCode: relationCode,
                relationship: relationName,
                series: series,
                category: familyName,
                details: relationName,
                stockQty: stockInputVal,
                transferredQty: 0,
                balanceQty: stockInputVal,
                sites: sitesInit,
                status: "Active",
                photoName: photoData.photoName || '',
                photoUrl: photoData.photoUrl || '',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                updatedBy: (typeof currentApprover !== 'undefined' ? currentApprover.Name : 'System')
            };

            const newMaterialRef = database.ref('material_stock').push();
            const newMaterialKey = newMaterialRef.key;
            const createUpdates = {};
            createUpdates[`material_stock/${newMaterialKey}`] = newMaterial;
            createUpdates[`${STOCK_META_PATH}/count`] = firebase.database.ServerValue.increment(1);
            createUpdates[`${STOCK_META_PATH}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;
            await database.ref().update(createUpdates);
            try { await window.inventoryPocket?.publishMaterialItem({ key: newMaterialKey, ...newMaterial }, newMaterialKey); } catch (pocketError) { console.warn('Inventory Pocket create failed:', pocketError); }
            if (photoData.photoName) await msRememberMaterialPhotoName(photoData.photoName);
            alert(`Success! Created: ${productID}`);
        }

        if (typeof window.msCloseNewMaterialModal === 'function') {
            window.msCloseNewMaterialModal();
        } else {
            document.getElementById('ms-new-material-modal').classList.add('hidden');
            editingItemKey = null;
        }

        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);

    } catch (error) {
        console.error("Save Error:", error);
        alert("Failed to save.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Save";
    }
}

// ==========================================================================
// 7. CSV UPLOAD
// ==========================================================================
function msCanUpdateTitles() {
    const user = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : {};
    const role = String(user.Role || user.role || '').trim().toLowerCase();
    const position = String(user.Position || user.position || '').trim().toLowerCase();
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    return role === 'admin' || isVacationDelegate || position.includes('logistic');
}

function handleDownloadTitles() {
    const rows = Array.isArray(lastFilteredStockData) ? lastFilteredStockData : [];
    if (!rows.length) {
        alert('Search or choose a family first. Download Titles only uses the rows on the screen.');
        return;
    }
    const lines = ['Product ID,New Title'];
    rows.forEach((item) => {
        const id = String(item.productID || item.productId || '').trim();
        const name = String(item.productName || '').replace(/"/g, '""');
        if (!id) return;
        lines.push(`"${id}","${name}"`);
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Material_Titles.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function handleGetTemplate() {
    const headers = ["Product ID", "Item Name", "F", "RRR", "Stock", "Site"];
    const row1 = "1.104.00150,Concrete Blocks 200mm,1,104,500,Site 175";
    const row2 = ",Marble Black Carrara 75x13,2,201,100,Main Store";

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + row1 + "\n" + row2;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Material_Upload_Template_V2.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleUploadCSV(event) {
    const role = (typeof currentApprover !== 'undefined' && currentApprover) ? (currentApprover.Role || '') : '';
    const isAdminUser = String(role).trim().toLowerCase() === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    if (!isAdminUser && !isVacationDelegate) {
        alert("Access Denied: You do not have permission to upload stock CSV.");
        event.target.value = '';
        return;
    }

    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');

        const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
        const currentUser = (typeof currentApprover !== 'undefined') ? currentApprover.Name : 'System';

        const idMap = new Map();
        const nameMap = new Map();
        let maxSeries = 0;

        allMaterialStockData.forEach(item => {
            const pid = (item.productID || item.productId || "").trim();
            if (pid) idMap.set(pid, item);
            if (item.productName) nameMap.set(item.productName.trim().toLowerCase(), item);
            const s = parseInt(item.series);
            if (!isNaN(s) && s > maxSeries) maxSeries = s;
        });

        const finalUpdates = {};
        let mergedCount = 0;
        let newCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

            if (cols.length >= 5) {
                const pID = cols[0].trim();
                const pName = cols[1].trim();
                const ff = cols[2].trim();
                const rrr = cols[3].trim();
                const pQty = parseFloat(cols[4]) || 0;
                const pSite = (cols[5] && cols[5] !== "") ? cols[5].trim() : "Main Store";

                if (pName) {
                    let existingItem = null;
                    if (pID && pID !== "") existingItem = idMap.get(pID);
                    else {
                        const normName = pName.toLowerCase();
                        existingItem = nameMap.get(normName);
                    }

                    if (existingItem) {
                        if (pName && pName !== "") existingItem.productName = pName;
                        if (!existingItem.sites) existingItem.sites = {};

                        let currentSiteQty = parseFloat(existingItem.sites[pSite] || 0);
                        existingItem.sites[pSite] = currentSiteQty + pQty;

                        let total = 0;
                        Object.values(existingItem.sites).forEach(q => total += parseFloat(q));
                        existingItem.stockQty = total;
                        existingItem.balanceQty = total;
                        existingItem.lastUpdated = Date.now();
                        existingItem.updatedBy = currentUser;

                        finalUpdates[existingItem.key] = existingItem;
                        mergedCount++;

                    } else {
                        if (ff && rrr && STOCK_LEGENDS[ff]) {
                            let finalID = pID;
                            let finalSeries = 0;
                            if (!finalID) {
                                maxSeries++;
                                finalSeries = maxSeries;
                                const sssss = String(maxSeries).padStart(5, '0');
                                finalID = `${ff}.${rrr}.${sssss}`;
                            }

                            const familyName = STOCK_LEGENDS[ff].name;
                            const relationName = STOCK_LEGENDS[ff].relations[rrr] || "Unknown";
                            const newKey = database.ref('material_stock').push().key;
                            const sites = {};
                            if (pQty > 0) sites[pSite] = pQty;

                            const newItem = {
                                key: newKey,
                                productID: finalID,
                                productName: pName,
                                familyCode: ff,
                                family: familyName,
                                relationCode: rrr,
                                relationship: relationName,
                                category: familyName,
                                details: relationName,
                                series: finalSeries,
                                stockQty: pQty,
                                balanceQty: pQty,
                                sites: sites,
                                status: "Active",
                                timestamp: Date.now(),
                                updatedBy: currentUser
                            };

                            idMap.set(finalID, newItem);
                            nameMap.set(pName.toLowerCase(), newItem);
                            finalUpdates[newKey] = newItem;
                            newCount++;
                        }
                    }
                }
            }
        }

        const updateKeys = Object.keys(finalUpdates);
        if (updateKeys.length === 0) {
            alert("No valid data found.");
            document.getElementById('ms-csv-file-input').value = '';
            return;
        }

        if (!confirm(`Processing Upload:\n\n- New Items: ${newCount}\n- Updated Items: ${mergedCount}\n\nProceed?`)) {
            document.getElementById('ms-csv-file-input').value = '';
            return;
        }

        const BATCH_SIZE = 500;
        let batch = {};
        let count = 0;
        const uploadBtn = document.getElementById('ms-upload-csv-btn');
        if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.innerText = "Saving..."; }

        try {
            for (let k of updateKeys) {
                batch[k] = finalUpdates[k];
                count++;
                if (count >= BATCH_SIZE) {
                    await database.ref('material_stock').update(batch);
                    batch = {};
                    count = 0;
                }
            }
            if (count > 0) await database.ref('material_stock').update(batch);
            if (newCount > 0) {
                await database.ref().update({
                    [`${STOCK_META_PATH}/count`]: firebase.database.ServerValue.increment(newCount),
                    [`${STOCK_META_PATH}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP
                });
            }
            for (const updatedKey of updateKeys) {
                try { await window.inventoryPocket?.publishMaterialItem(finalUpdates[updatedKey], updatedKey); }
                catch (pocketError) { console.warn('Inventory Pocket CSV publish failed for ' + updatedKey + ':', pocketError); }
            }

            alert("Upload Successful!");
            localStorage.removeItem("cached_MATERIAL_STOCK");
            populateMaterialStock(true);

        } catch(e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fa-solid fa-file-csv"></i> Upload CSV';
            }
            document.getElementById('ms-csv-file-input').value = '';
        }
    };
    reader.readAsText(file);
}

function handleUploadTitles(event) {
    if (!msCanUpdateTitles()) {
        alert('Access Denied: Only Admin or Logistic can update titles.');
        event.target.value = '';
        return;
    }
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        const lines = String(e.target.result || '').split(/\r?\n/);
        const idMap = new Map();
        (allMaterialStockData || []).forEach((item) => {
            const pid = String(item.productID || item.productId || '').trim();
            if (pid) idMap.set(pid, item);
        });
        const titleUpdates = {};
        const nameById = {};
        let missing = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
            const pID = cols[0];
            const pName = cols[1];
            if (!pID || !pName || pID.toLowerCase() === 'product id' || pID.toLowerCase() === 'id') continue;
            const existing = idMap.get(pID);
            if (!existing || !existing.key) { missing++; continue; }
            titleUpdates[`material_stock/${existing.key}/productName`] = pName;
            titleUpdates[`material_stock/${existing.key}/lastUpdated`] = Date.now();
            nameById[pID] = pName;
            existing.productName = pName;
        }
        const titleCount = Object.keys(nameById).length;
        if (!titleCount) {
            alert('No matching product IDs found. Use two columns: Product ID, New Title.');
            event.target.value = '';
            return;
        }
        if (!confirm(`Update ${titleCount} titles?\n\nQuantity and transaction quantities will not change.${missing ? `\n${missing} IDs were not found.` : ''}`)) {
            event.target.value = '';
            return;
        }
        const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
        const btn = document.getElementById('ms-upload-titles-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving titles...'; }
        try {
            await database.ref().update(titleUpdates);
            const transferUpdates = {};
            (allTransferData || []).forEach((t) => {
                const pid = String(t.productID || t.productId || '').trim();
                if (nameById[pid] && t.key) transferUpdates[`transfer_entries/${t.key}/productName`] = nameById[pid];
            });
            const transferKeys = Object.keys(transferUpdates);
            for (let i = 0; i < transferKeys.length; i += 400) {
                const batch = {};
                transferKeys.slice(i, i + 400).forEach((key) => { batch[key] = transferUpdates[key]; });
                await database.ref().update(batch);
            }
            alert(`Titles updated: ${titleCount}. Quantity was not changed.`);
            localStorage.removeItem('cached_MATERIAL_STOCK');
            if (typeof populateMaterialStock === 'function') populateMaterialStock(true);
        } catch (err) {
            console.error(err);
            alert('Title update failed: ' + (err && err.message ? err.message : err));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-pen"></i> Update Titles';
            }
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

// ==========================================================================
// 8. ADD STOCK MODAL LOGIC
// ==========================================================================
window.openAddStockModal = async function (key) {
    const item = allMaterialStockData.find(i => i.key === key);
    if (!item) return;
    document.getElementById('ms-add-stock-modal').classList.remove('hidden');
    document.getElementById('ms-add-key').value = key;
    document.getElementById('ms-add-id').value = item.productID;
    document.getElementById('ms-add-name').value = item.productName;
    document.getElementById('ms-add-details').value = item.relationship || item.details;
    document.getElementById('ms-add-current-stock').value = item.stockQty;
    document.getElementById('ms-add-qty-input').value = '';

    const siteSelect = document.getElementById('ms-add-site-select');
    const latestSites = await msLoadLatestSites();
    msFillSiteOptions(siteSelect, latestSites);
};

// ==========================================================================
// 9. HELPERS (Fixed: Accordion Effect)
// ==========================================================================

window.msFillStockDetail = function (row) {
    if (!row || row.dataset.ready === '1') return;
    const item = (Array.isArray(allMaterialStockData) ? allMaterialStockData : []).find((entry) => entry.key === row.dataset.itemKey);
    if (!item) return;
    const who = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : null;
    const currentUser = who ? who.Name : '';
    const isIrwin = !!who && who.Name === 'Irwin';
    const isAdmin = !!who && String(who.Role || '').toLowerCase() === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const canAttachPhoto = isAdmin || isVacationDelegate || msCanAttachMaterialPhoto();
    const stockID = String(item.productID || item.productId || '').trim();
    const productTransfers = (Array.isArray(allTransferData) ? allTransferData : []).filter((t) => String(t.productID || t.productId || '').trim() === stockID);
    const displayStock = msDisplayStockFromReceipts(item, productTransfers);

    // Stock breakdown = card qty per site (the stock rule). A warning + Align appears only where
    // completed movement history shows more than the card holds (Irwin / Logistic can align).
    const canAlign = msCanAlignStock();
    let breakdownRows = displayStock.rows.map((r) => {
        const siteLabel = msSiteDisplayName(r.site);
        // 14.0.0: Irwin can remove an empty site line.
        const deleteSite = (isIrwin && !r.qty && !r.gap)
            ? `<span onclick="deleteSiteStock('${msEscapeHtml(item.key)}', '${msEscapeHtml(r.site)}')" class="ms-site-delete" title="Delete empty site">&times;</span>`
            : '';
        const mainRow = `<tr><td class="ms-bd-site" style="width:70%;">${siteLabel} ${deleteSite}</td><td class="ms-bd-qty" style="width:30%;">${r.qty}</td></tr>`;
        if (!r.gap) return mainRow;
        const alignBtn = canAlign
            ? ` <button type="button" class="secondary-btn ms-align-site-btn" data-key="${msEscapeHtml(item.key)}" data-site="${msEscapeHtml(r.site)}" title="Set the card qty at this site to the qty from completed movement history">Align</button>`
            : '';
        return mainRow + `<tr class="ms-bd-gap-row"><td colspan="2"><div class="ms-bd-gap"><i class="fa-solid fa-triangle-exclamation"></i> Movement history says ${r.expected} should be here, card has ${r.stored}.${alignBtn}</div></td></tr>`;
    }).join('');
    if (!breakdownRows) breakdownRows = '<tr><td class="ms-bd-site">No site stock</td><td class="ms-bd-qty">0</td></tr>';
    const dupCards = (Array.isArray(allMaterialStockData) ? allMaterialStockData : []).filter((x) => String(x.productID || x.productId || '').trim() === stockID);
    if (dupCards.length > 1) {
        breakdownRows += `<tr><td colspan="2" class="ms-bd-dup"><i class="fa-solid fa-clone"></i> ${dupCards.length} cards use Product ID ${msEscapeHtml(stockID)}. Tick them in the list and use Merge Selected so transfers use one card.</td></tr>`;
    }

    let historyRows = '';
    if (!productTransfers.length) {
        historyRows = '<tr><td colspan="7" class="ms-hist-empty">No movement history found.</td></tr>';
    } else {
        productTransfers.forEach((t) => {
            const date = t.shippingDate || (t.timestamp ? new Date(t.timestamp).toISOString().split('T')[0] : '');
            const type = t.jobType || t.for || 'Transfer';
            const from = msEscapeHtml(t.fromLocation || t.fromSite || '');
            const to = msEscapeHtml(t.toLocation || t.toSite || '');
            let route = '-';
            if (type === 'Transfer') route = `${from} &rarr; ${to}`;
            else if (type === 'Restock') route = `<span class="ms-route-add">+ Add to ${to}</span>`;
            else if (type === 'Return') route = `<span class="ms-route-return">- Return from ${from}</span>`;
            else if (type === 'Usage') route = `<span class="ms-route-usage">- Used at ${from}</span>`;
            // 14.0.0: receiver can start a Return from a completed receipt.
            const isCompleted = (t.remarks === 'Completed' || t.remarks === 'Received');
            const actionBtn = (isCompleted && t.receiver === currentUser && type !== 'Return')
                ? `<button class="secondary-btn ms-hist-return-btn" onclick="initiateReturn('${msEscapeHtml(t.key)}')">Return</button>`
                : '';
            historyRows += `<tr><td>${msEscapeHtml(date)}</td><td class="ms-hist-type">${msEscapeHtml(type)}</td><td>${route}</td><td class="ms-hist-qty">${t.receivedQty || 0}</td><td>${msEscapeHtml(t.enteredBy || 'System')}</td><td>${msEscapeHtml(t.remarks || '')}</td><td class="ms-hist-action">${actionBtn}</td></tr>`;
        });
    }

    const photo = typeof msBuildMaterialPhotoCard === 'function' ? msBuildMaterialPhotoCard(item, canAttachPhoto) : '';
    // 14.0.0 glass layout (three panels).
    row.innerHTML = `
        <td colspan="7" class="ms-glass-detail">
            <div class="ms-glass-detail-grid">
                <div class="ms-glass-panel">
                    <h4><i class="fa-regular fa-image"></i> Item Photo</h4>
                    ${photo}
                </div>
                <div class="ms-glass-panel">
                    <h4><i class="fa-solid fa-cubes"></i> Current Stock Breakdown</h4>
                    <div class="ms-glass-scroll">
                        <table class="stock-detail-table">
                            <thead><tr><th>Site</th><th>Qty</th></tr></thead>
                            <tbody>${breakdownRows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="ms-glass-panel ms-glass-panel-wide">
                    <h4><i class="fa-solid fa-clock-rotate-left"></i> Movement History</h4>
                    <div class="ms-glass-scroll">
                        <table class="stock-detail-table">
                            <thead><tr><th>Date</th><th>Type</th><th>Route</th><th>Qty</th><th>By</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>${historyRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </td>`;
    row.dataset.ready = '1';

    // Buttons inside a row filled on demand must be bound here (the list binds only what exists at render time).
    row.querySelectorAll('.ms-align-site-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            msAlignSiteToHistory(btn.getAttribute('data-key'), btn.getAttribute('data-site'), btn);
        });
    });
    row.querySelectorAll('.ms-open-photo-picker-btn').forEach((btn) => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            msOpenMaterialPhotoBrowser({ mode: 'item', itemKey: btn.getAttribute('data-key') });
        });
    });
    row.querySelectorAll('.ms-clear-photo-btn').forEach((btn) => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            msClearPhotoForItem(btn.getAttribute('data-key'));
        });
    });
};

// ==========================================================================
// 14.0.0 patch 1: DUPLICATE ID COUNT + ALIGN CARD QTY TO MOVEMENT HISTORY
// ==========================================================================
function msCountCardsByProductId() {
    const counts = new Map();
    (Array.isArray(allMaterialStockData) ? allMaterialStockData : []).forEach((x) => {
        const id = String(x.productID || x.productId || '').trim();
        if (!id || !x.key) return;
        counts.set(id, (counts.get(id) || 0) + 1);
    });
    return counts;
}

function msCanAlignStock() {
    const who = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : null;
    if (!who) return false;
    if (who.Name === 'Irwin') return true;
    return String(who.Position || who.position || '').toLowerCase().includes('logistic');
}

async function msAlignSiteToHistory(key, site, btn) {
    if (!msCanAlignStock()) { alert('Only Irwin or Logistic can align stock.'); return; }
    const item = (Array.isArray(allMaterialStockData) ? allMaterialStockData : []).find((x) => x.key === key);
    if (!item) { alert('Item not loaded. Refresh Material Stock and try again.'); return; }
    const productID = String(item.productID || item.productId || '').trim();
    const siteKey = msCanonSiteKey(site);
    if (!siteKey) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }
    const resetBtn = () => { if (btn) { btn.disabled = false; btn.textContent = 'Align'; } };

    // Re-check against the LATEST history and the LATEST card before changing anything.
    try { await fetchTransfersOnly(); } catch (_) {}
    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
    let live;
    try { live = (await database.ref(`material_stock/${key}`).once('value')).val(); }
    catch (e) { resetBtn(); alert('Could not read the card. Check connection. Nothing was changed.'); return; }
    if (!live || String(live.productID || live.productId || '').trim() !== productID) {
        resetBtn(); localStorage.removeItem(STOCK_CACHE_KEY);
        alert('This card is out of date in this browser. Refresh Material Stock and try again. Nothing was changed.');
        return;
    }
    const transfers = (Array.isArray(allTransferData) ? allTransferData : []).filter((t) => String(t.productID || t.productId || '').trim() === productID);
    const check = msDisplayStockFromReceipts({ key, ...live }, transfers);
    const target = check.rows.find((r) => r.site === siteKey);
    if (!target || !target.gap || typeof target.expected !== 'number') {
        resetBtn();
        alert(`Site ${siteKey} is already correct on the card. Nothing to align.`);
        if (typeof populateMaterialStock === 'function') { localStorage.removeItem(STOCK_CACHE_KEY); populateMaterialStock(true); }
        return;
    }
    const before = target.stored;
    const after = target.expected;
    const openNote = check.openCount ? `\n\nNote: ${check.openCount} open transaction(s) for this product are already counted in this check.` : '';
    const ok = confirm(`ALIGN STOCK\n\nProduct: ${productID} - ${live.productName || ''}\nSite: ${siteKey}\n\nCard qty now: ${before}\nMovement history: ${after}\nWill add: ${after - before}${openNote}\n\nOnly do this if the material is physically at this site.`);
    if (!ok) { resetBtn(); return; }
    if (btn) btn.textContent = 'Saving...';

    let changed = false;
    try {
        const result = await database.ref(`material_stock/${key}`).transaction((current) => {
            if (!current) return current;
            if (!current.sites) current.sites = {};
            let siteVal = 0;
            Object.keys(current.sites).forEach((k) => {
                if (msCanonSiteKey(k) !== siteKey) return;
                siteVal += parseFloat(current.sites[k]) || 0;
                if (k !== siteKey) delete current.sites[k];
            });
            // 14.0.0 patch 1: only proceed if the card still has exactly what was shown in the
            // confirm box. If anything moved meanwhile, abort and let the user re-check.
            if (Math.abs(siteVal - before) > 1e-9 || siteVal >= after) return;
            current.sites[siteKey] = siteVal + (after - before);
            let total = 0;
            Object.values(current.sites).forEach((v) => { total += parseFloat(v) || 0; });
            current.stockQty = total;
            current.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
            return current;
        });
        changed = !!(result && result.committed && result.snapshot && result.snapshot.exists());
    } catch (e) {
        console.error('Align failed:', e);
        resetBtn();
        alert('Align failed: ' + (e && e.message ? e.message : e));
        return;
    }
    if (!changed) {
        resetBtn();
        alert('Nothing was changed: this card changed while you were checking. The list will refresh, please check again.');
        localStorage.removeItem(STOCK_CACHE_KEY);
        if (typeof populateMaterialStock === 'function') populateMaterialStock(true);
        return;
    }
    // Audit trail (separate node, so it never adds weight to the stock download).
    try {
        await database.ref('stock_adjustments').push({
            productID, key, site: siteKey, before, after,
            reason: 'Align card qty to completed movement history',
            by: (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover.Name : 'Unknown',
            at: firebase.database.ServerValue.TIMESTAMP
        });
    } catch (logError) { console.warn('Stock adjustment log failed:', logError); }
    try { await window.inventoryPocket?.publishMaterialByKey(key); } catch (pocketError) { console.warn('Inventory Pocket publish after align failed:', pocketError); }
    alert(`Aligned. ${productID} at ${siteKey} is now ${after}.\nIt is now available in the transfer form.`);
    localStorage.removeItem(STOCK_CACHE_KEY);
    if (typeof populateMaterialStock === 'function') populateMaterialStock(true);
}
window.msAlignSiteToHistory = msAlignSiteToHistory;

window.toggleStockDetail = function(rowId, btn) {
    // 1. Auto-Minimize Others (Close all other open rows)
    const allOpenRows = document.querySelectorAll('.stock-child-row:not(.hidden)');
    allOpenRows.forEach(row => {
        if (row.id !== rowId) {
            row.classList.add('hidden');
            // Reset the button for the closed row
            const prevRow = row.previousElementSibling;
            if (prevRow) {
                const expandBtn = prevRow.querySelector('.ms-expand-btn');
                if (expandBtn) expandBtn.textContent = '+';
            }
        }
    });

    // 2. Toggle Current Item
    const row = document.getElementById(rowId);
    if (row) {
        if (row.dataset.ready !== '1' && typeof window.msFillStockDetail === 'function') {
            window.msFillStockDetail(row);
        }
        row.classList.toggle('hidden');
        btn.textContent = row.classList.contains('hidden') ? '+' : '-';
    }
    if (typeof msPaintRowFrost === 'function') msPaintRowFrost();
};

async function msFillRequestListSites(selectEl) {
    const select = selectEl || document.getElementById('ms-requestlist-to-site');
    if (!select || select.tagName !== 'SELECT') return;
    const current = String(select.value || msRequiredListToSite || '');
    const latestSites = await msLoadLatestSites();
    select.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Select destination site';
    select.appendChild(blank);
    const seen = {};
    const add = (value, label) => {
        const key = String(value || '').trim();
        if (!key || seen[key]) return;
        seen[key] = 1;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label || key;
        select.appendChild(opt);
    };
    add('Main Store', 'Main Store');
    (latestSites || []).forEach((site) => {
        if (!site || !site.site || site.site === 'Main Store') return;
        add(site.site, site.description ? (site.site + ' - ' + site.description) : site.site);
    });
    if (current) select.value = current;
    select.classList.toggle('ms-site-empty', !select.value);
}


async function populateModalSiteDropdown() {
    const siteSelect = document.getElementById('ms-new-site-select');
    if (!siteSelect) return;
    const latestSites = await msLoadLatestSites();
    msFillSiteOptions(siteSelect, latestSites);
}

window.handleClearMaterialForm = function() {
    document.getElementById('ms-new-material-form').reset();
    document.getElementById('ms-new-id-display').value = "Auto-Generated";
    const photoInput = document.getElementById('ms-new-photo-url');
    if (photoInput) photoInput.value = '';
};

window.initiateReturn = function(transferKey) {
    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
    database.ref(`transfer_entries/${transferKey}`).once('value').then(snap => {
        const originalTask = snap.val();
        if (!originalTask) {
            alert("Error: Original transaction data not found.");
            return;
        }

        openTransferModal('Return');

        setTimeout(() => {
            if (transferProductChoices) {
                transferProductChoices.setChoiceByValue(originalTask.productID || originalTask.productId);
            }
            document.getElementById('tf-product-name').value = originalTask.productName;
            document.getElementById('tf-details').value = `Return of: ${originalTask.controlNumber || originalTask.ref}`;
            document.getElementById('tf-req-qty').value = originalTask.receivedQty || 0;

            const returnFrom = originalTask.toSite || originalTask.toLocation;
            const returnTo = originalTask.fromSite || originalTask.fromLocation;

            if (tfFromSiteChoices) tfFromSiteChoices.setChoiceByValue(returnFrom);
            if (tfToSiteChoices) tfToSiteChoices.setChoiceByValue(returnTo);

            const modalContent = document.querySelector('#transfer-job-modal .modal-content');
            if(modalContent) modalContent.scrollTop = 0;
        }, 500);
    });
};

// --- BULK DELETE LOGIC ---
async function handleBulkDelete() {
    const checkedBoxes = document.querySelectorAll('.ms-row-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert("Please select items to delete.");
        return;
    }

    const count = checkedBoxes.length;
    const confirmMsg = `⚠️ MASTER BULK DELETE ⚠️\n\nYou are about to delete ${count} items from Stock.\n\nThis will also delete the history for these specific Product IDs.\n\nAre you sure you want to proceed?`;

    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById('ms-bulk-delete-btn');
    btn.textContent = "Deleting...";
    btn.disabled = true;

    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
    const updates = {};
    let transfersDeletedCount = 0;

    checkedBoxes.forEach(box => {
        const key = box.dataset.key;
        const stockItem = allMaterialStockData.find(i => i.key === key);
        const productID = stockItem?.productID || stockItem?.productId || "";

        updates[`material_stock/${key}`] = null;

        // 14.0.0 patch 1: if another card (not being deleted) still uses this Product ID,
        // the history belongs to that card too, so it must NOT be deleted.
        const deletingKeys = new Set(Array.from(checkedBoxes).map((b) => b.dataset.key));
        const idStillUsed = !!productID && allMaterialStockData.some((other) =>
            !deletingKeys.has(other.key) &&
            String(other.productID || other.productId || '').trim() === String(productID).trim());

        if (productID && productID.trim() !== "" && !idStillUsed) {
            const relatedTransfers = allTransferData.filter(t => {
                const tID = (t.productID || t.productId || "").toString().trim();
                const sID = productID.toString().trim();
                return tID === sID;
            });
            relatedTransfers.forEach(t => {
                updates[`transfer_entries/${t.key}`] = null;
                transfersDeletedCount++;
            });
        }
    });

    updates[`${STOCK_META_PATH}/count`] = firebase.database.ServerValue.increment(-count);
    updates[`${STOCK_META_PATH}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;

    try {
        await database.ref().update(updates);
        try {
            for (const box of checkedBoxes) await window.inventoryPocket?.removeMaterialFromPocketByKey(box.dataset.key);
        } catch (pocketError) { console.warn('Inventory Pocket bulk delete cleanup failed:', pocketError); }
        alert(`Success!\n\nDeleted ${count} Stock Items.\nDeleted ${transfersDeletedCount} Related History Entries.`);
        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);
    } catch (e) {
        console.error("Bulk delete failed", e);
        alert("Error during bulk delete. Check console.");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete Selected';
        btn.disabled = false;
    }
}

function msProductSequence(item) {
    const id = String(item.productID || item.productId || '').trim();
    const parts = id.split('.').map((part) => parseInt(part, 10));
    return { id, parts };
}

async function handleMergeSelected() {
    const canMerge = (currentApprover && currentApprover.Name === 'Irwin')
        || String((currentApprover && (currentApprover.Position || currentApprover.position)) || '').toLowerCase().includes('logistic');
    if (!canMerge) {
        alert('Only Irwin or Logistic can merge stock items.');
        return;
    }
    const checked = Array.from(document.querySelectorAll('.ms-row-checkbox:checked'));
    if (checked.length < 2) {
        alert('Tick at least two items to merge.');
        return;
    }
    const items = checked.map((box) => allMaterialStockData.find((item) => item.key === box.dataset.key)).filter(Boolean);
    if (items.length < 2) {
        alert('The ticked items are not loaded. Refresh Material Stock and try again.');
        return;
    }
    items.sort((a, b) => {
        const left = msProductSequence(a).parts;
        const right = msProductSequence(b).parts;
        const len = Math.max(left.length, right.length);
        for (let i = 0; i < len; i++) {
            const diff = (left[i] || 0) - (right[i] || 0);
            if (diff) return diff;
        }
        const byId = msProductSequence(a).id.localeCompare(msProductSequence(b).id);
        if (byId) return byId;
        // 14.0.0 patch 1: same Product ID on several cards -> keep the card holding the most stock.
        return (parseFloat(b.stockQty) || 0) - (parseFloat(a.stockQty) || 0);
    });
    const main = items[0];
    const others = items.slice(1);
    const mainId = String(main.productID || main.productId || '').trim();
    const otherIds = others.map((item) => String(item.productID || item.productId || '').trim());
    if (!confirm(`Merge into the lowest ID ${mainId}?\n\n${otherIds.join('\n')}\n\nStock and history move to ${mainId}. The other cards become zero so you can delete them.`)) return;
    const btn = document.getElementById('ms-merge-selected-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Merging...'; }
    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
    const resetMergeBtn = () => { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-code-merge"></i> Merge Selected'; } };
    const who = (currentApprover && currentApprover.Name) || 'Unknown';

    // 14.0.0 patch 1: ATOMIC MERGE
    //  Step 1  each other card is emptied in its own transaction and its exact site qty captured
    //  Step 2  the captured qty is added to the main card in one transaction
    //  If step 2 fails, every emptied card gets its qty back (rollback).
    //  A stock movement made by someone else at the same moment can never be lost or doubled.
    const canonSite = (site) => (typeof window.stockCanonicalSiteKey === 'function')
        ? window.stockCanonicalSiteKey(site)
        : msCanonSiteKey(site);
    const foldInto = (target, sites, sign) => {
        Object.entries(sites || {}).forEach(([site, qty]) => {
            const amount = (parseFloat(qty) || 0) * sign;
            const key = canonSite(site) || String(site || '').trim().replace(/[.#$[\]\/]/g, '');
            if (!key || !amount) return;
            target[key] = (parseFloat(target[key]) || 0) + amount;
        });
    };
    const runTx = async (key, fn) => {
        const res = await database.ref(`material_stock/${key}`).transaction(fn);
        return !!(res && res.committed && res.snapshot && res.snapshot.exists());
    };
    const giveBack = async (taken) => {
        for (const t of taken) {
            try {
                await runTx(t.key, (cur) => {
                    if (!cur) return cur;
                    if (!cur.sites) cur.sites = {};
                    const folded = {};
                    foldInto(folded, cur.sites, 1);
                    foldInto(folded, t.sites, 1);
                    cur.sites = folded;
                    let tot = 0; Object.values(folded).forEach((v) => { tot += parseFloat(v) || 0; });
                    cur.stockQty = tot; cur.balanceQty = tot;
                    cur.mergedInto = null; cur.mergedAt = null;
                    cur.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
                    return cur;
                });
            } catch (e) { console.error('Merge rollback failed for', t.key, t.sites, e); }
        }
    };

    const taken = [];
    try {
        // Main card must exist and still be this product.
        const mainLive = (await database.ref(`material_stock/${main.key}`).once('value')).val();
        if (!mainLive || String(mainLive.productID || mainLive.productId || '').trim() !== mainId || mainLive.mergedInto) {
            resetMergeBtn(); localStorage.removeItem(STOCK_CACHE_KEY);
            alert(`Card ${mainId} is out of date in this browser or was already merged. Refresh Material Stock and try again. Nothing was changed.`);
            return;
        }

        // Step 1: empty each other card atomically.
        for (const item of others) {
            const expectId = String(item.productID || item.productId || '').trim();
            let captured = null;
            let problem = '';
            const ok = await runTx(item.key, (cur) => {
                captured = null; problem = '';
                if (!cur) return cur;
                if (String(cur.productID || cur.productId || '').trim() !== expectId) { problem = 'changed'; return; }
                if (cur.mergedInto) { problem = 'already merged into ' + cur.mergedInto; return; }
                captured = { ...(cur.sites || {}) };
                cur.sites = {};
                cur.stockQty = 0;
                cur.balanceQty = 0;
                cur.mergedInto = mainId;
                cur.mergedAt = firebase.database.ServerValue.TIMESTAMP;
                cur.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
                return cur;
            });
            if (!ok) {
                await giveBack(taken);
                resetMergeBtn(); localStorage.removeItem(STOCK_CACHE_KEY);
                alert(`Could not merge ${expectId}${problem ? ' (' + problem + ')' : ''}. Everything was put back. Refresh Material Stock and try again.`);
                if (typeof populateMaterialStock === 'function') populateMaterialStock(true);
                return;
            }
            taken.push({ key: item.key, id: expectId, sites: captured || {} });
        }

        // Step 2: add everything to the main card atomically.
        const addAll = {};
        taken.forEach((t) => foldInto(addAll, t.sites, 1));
        let mainTotal = 0;
        const okMain = await runTx(main.key, (cur) => {
            if (!cur) return cur;
            const folded = {};
            foldInto(folded, cur.sites, 1);
            foldInto(folded, addAll, 1);
            Object.keys(folded).forEach((k) => { if (!folded[k]) delete folded[k]; });
            cur.sites = folded;
            let tot = 0; Object.values(folded).forEach((v) => { tot += parseFloat(v) || 0; });
            cur.stockQty = tot; cur.balanceQty = tot;
            cur.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
            mainTotal = tot;
            return cur;
        });
        if (!okMain) {
            await giveBack(taken);
            resetMergeBtn();
            alert(`Could not add the stock to ${mainId}. Everything was put back. Nothing was merged.`);
            localStorage.removeItem(STOCK_CACHE_KEY);
            if (typeof populateMaterialStock === 'function') populateMaterialStock(true);
            return;
        }

        // Merge log (exact quantities moved, for audit / manual recovery).
        try {
            await database.ref('stock_merges').push({
                mainId, mainKey: main.key,
                merged: taken.map((t) => ({ id: t.id, key: t.key, sites: t.sites })),
                by: who, at: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (logError) { console.warn('Merge log failed:', logError); }

        // Step 3: history follows the stock.
        await fetchTransfersOnly();
        const idSet = new Set(taken.map((t) => t.id));
        idSet.delete(mainId);
        const updates = {};
        let historyCount = 0;
        (allTransferData || []).forEach((entry) => {
            const pid = String(entry.productID || entry.productId || '').trim();
            if (!idSet.has(pid) || !entry.key) return;
            updates[`transfer_entries/${entry.key}/productID`] = mainId;
            updates[`transfer_entries/${entry.key}/productId`] = mainId;
            updates[`transfer_entries/${entry.key}/productName`] = main.productName || '';
            updates[`transfer_entries/${entry.key}/mergedFrom`] = pid;
            historyCount++;
        });
        const keys = Object.keys(updates);
        for (let i = 0; i < keys.length; i += 400) {
            const batch = {};
            keys.slice(i, i + 400).forEach((k) => { batch[k] = updates[k]; });
            await database.ref().update(batch);
        }

        // Step 4: tell every browser (Pocket) and clear cached keys.
        try {
            await window.inventoryPocket?.publishMaterialByKey(main.key);
            for (const t of taken) await window.inventoryPocket?.publishMaterialByKey(t.key);
        } catch (pocketError) { console.warn('Inventory Pocket merge publish failed:', pocketError); }
        try { if (typeof transferStockItemKeyCache !== 'undefined') Object.keys(transferStockItemKeyCache).forEach((k) => { delete transferStockItemKeyCache[k]; }); } catch (_) {}

        alert(`Merged into ${mainId}.\nStock is now ${mainTotal}.\n${historyCount} history records moved.\nThe other cards are zero. Tick them and use Delete Selected.`);
        localStorage.removeItem(STOCK_CACHE_KEY);
        if (typeof populateMaterialStock === 'function') populateMaterialStock(true);
    } catch (error) {
        console.error(error);
        if (taken.length) await giveBack(taken);
        alert('Merge failed: ' + (error && error.message ? error.message : error) + (taken.length ? '\nStock was put back.' : ''));
        localStorage.removeItem(STOCK_CACHE_KEY);
        if (typeof populateMaterialStock === 'function') populateMaterialStock(true);
    } finally {
        resetMergeBtn();
    }
}

// ==========================================================================
// 14.0.0 patch 1: STOCK CHECK
//   One screen listing ONLY the sites where completed movement history says more
//   stock should be on the card than the card holds. For each one: enter the real qty
//   (pre-filled with the history qty), approve one by one or all ticked at once.
//   Uses data already loaded in the browser: no extra full download.
// ==========================================================================
let msStockCheckRows = [];

function msBuildStockCheckRows() {
    const byPid = new Map();
    (Array.isArray(allTransferData) ? allTransferData : []).forEach((t) => {
        const pid = String(t.productID || t.productId || '').trim();
        if (!pid) return;
        if (!byPid.has(pid)) byPid.set(pid, []);
        byPid.get(pid).push(t);
    });
    const rows = [];
    (Array.isArray(allMaterialStockData) ? allMaterialStockData : []).forEach((item) => {
        if (!item || !item.key || item.mergedInto) return;
        const pid = String(item.productID || item.productId || '').trim();
        if (!pid) return;
        const transfers = byPid.get(pid) || [];
        if (!transfers.length) return;
        const d = msDisplayStockFromReceipts(item, transfers);
        d.rows.filter((r) => r.gap).forEach((r) => {
            rows.push({
                id: `${item.key}|${r.site}`,
                key: item.key, productID: pid, productName: item.productName || '',
                site: r.site, card: r.stored, history: r.expected, open: d.openCount
            });
        });
    });
    rows.sort((a, b) => a.productID.localeCompare(b.productID, undefined, { numeric: true }) || a.site.localeCompare(b.site, undefined, { numeric: true }));
    return rows;
}

function msEnsureStockCheckModal() {
    let modal = document.getElementById('ms-stock-check-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ms-stock-check-modal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:10050; background:rgba(0,20,35,0.55); display:none; align-items:center; justify-content:center; padding:12px;';
    modal.innerHTML = `
      <div style="background:#fff; width:min(1100px,100%); max-height:92vh; display:flex; flex-direction:column; border-radius:14px; box-shadow:0 20px 50px rgba(0,0,0,0.3); overflow:hidden;">
        <div style="padding:14px 18px; background:#003A5C; color:#fff; display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div><div style="font-weight:800; font-size:1.1rem;"><i class="fa-solid fa-list-check"></i> Stock Check</div>
          <div id="ms-sc-summary" style="font-size:0.82rem; opacity:0.85;"></div></div>
          <button type="button" id="ms-sc-close" style="background:transparent; border:none; color:#fff; font-size:1.6rem; cursor:pointer; line-height:1;">&times;</button>
        </div>
        <div style="padding:10px 18px; display:flex; flex-wrap:wrap; gap:8px; align-items:center; border-bottom:1px solid #e5e7eb; background:#f8fafc;">
          <input id="ms-sc-search" type="text" placeholder="Search ID, name or site..." style="flex:1; min-width:180px; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px;">
          <button type="button" id="ms-sc-csv" class="secondary-btn" style="padding:8px 12px;"><i class="fa-solid fa-file-csv"></i> Download list</button>
          <button type="button" id="ms-sc-approve-all" style="padding:8px 14px; background:#0f766e; color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer;"><i class="fa-solid fa-check-double"></i> Approve ticked</button>
        </div>
        <div style="padding:8px 18px; font-size:0.8rem; color:#555;">Only sites where completed history shows MORE than the card are listed. Type the qty that is physically at the site (pre-filled with the history qty), then approve. A site you approve stops being listed until its qty or history changes again.</div>
        <div style="overflow:auto; flex:1; padding:0 18px 14px;">
          <table style="width:100%; border-collapse:collapse; font-size:0.86rem;">
            <thead><tr style="position:sticky; top:0; background:#e6f4f7; color:#003A5C;">
              <th style="padding:8px; text-align:center;"><input type="checkbox" id="ms-sc-all"></th>
              <th style="padding:8px; text-align:left;">Product ID</th>
              <th style="padding:8px; text-align:left;">Name</th>
              <th style="padding:8px; text-align:left;">Site</th>
              <th style="padding:8px; text-align:right;">Card</th>
              <th style="padding:8px; text-align:right;">History</th>
              <th style="padding:8px; text-align:center;">Correct qty</th>
              <th style="padding:8px;"></th>
            </tr></thead>
            <tbody id="ms-sc-body"></tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#ms-sc-close').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    modal.querySelector('#ms-sc-search').addEventListener('input', msRenderStockCheck);
    modal.querySelector('#ms-sc-all').addEventListener('change', (e) => {
        modal.querySelectorAll('.ms-sc-tick').forEach((cb) => { if (!cb.disabled) cb.checked = e.target.checked; });
    });
    modal.querySelector('#ms-sc-approve-all').addEventListener('click', msApproveTickedStockCheck);
    modal.querySelector('#ms-sc-csv').addEventListener('click', msDownloadStockCheckCsv);
    modal.querySelector('#ms-sc-body').addEventListener('click', (e) => {
        const btn = e.target.closest('.ms-sc-approve-one');
        if (!btn) return;
        msApproveStockCheckRows([btn.getAttribute('data-id')]);
    });
    return modal;
}

function msRenderStockCheck() {
    const modal = msEnsureStockCheckModal();
    const body = modal.querySelector('#ms-sc-body');
    const term = String(modal.querySelector('#ms-sc-search').value || '').toLowerCase().trim();
    const list = msStockCheckRows.filter((r) => !term ||
        r.productID.toLowerCase().includes(term) || r.productName.toLowerCase().includes(term) || r.site.toLowerCase().includes(term));
    const products = new Set(msStockCheckRows.map((r) => r.key)).size;
    modal.querySelector('#ms-sc-summary').textContent = msStockCheckRows.length
        ? `${msStockCheckRows.length} site(s) on ${products} item(s) need checking` + (term ? ` - showing ${list.length}` : '')
        : 'All cards match their movement history.';
    modal.querySelector('#ms-sc-all').checked = false;
    if (!list.length) {
        body.innerHTML = `<tr><td colspan="8" style="padding:30px; text-align:center; color:#0f766e; font-weight:700;">${msStockCheckRows.length ? 'No match for this search.' : '<i class="fa-solid fa-circle-check"></i> Nothing to check.'}</td></tr>`;
        return;
    }
    body.innerHTML = list.map((r) => `
        <tr data-id="${msEscapeHtml(r.id)}" style="border-bottom:1px solid #eef2f7;">
          <td style="padding:6px 8px; text-align:center;"><input type="checkbox" class="ms-sc-tick" data-id="${msEscapeHtml(r.id)}"></td>
          <td style="padding:6px 8px; font-family:monospace;">${msEscapeHtml(r.productID)}</td>
          <td style="padding:6px 8px;">${msEscapeHtml(r.productName)}${r.open ? ` <span title="Open requests for this item are already counted" style="font-size:0.72rem; color:#8a6100;">(${r.open} open)</span>` : ''}</td>
          <td style="padding:6px 8px;">${msEscapeHtml(r.site)}</td>
          <td style="padding:6px 8px; text-align:right; font-weight:700; color:#b91c1c;">${r.card}</td>
          <td style="padding:6px 8px; text-align:right; font-weight:700;">${r.history}</td>
          <td style="padding:6px 8px; text-align:center;"><input type="number" min="0" step="any" class="ms-sc-qty" data-id="${msEscapeHtml(r.id)}" value="${r.history}" style="width:90px; padding:5px 6px; border:1px solid #cbd5e1; border-radius:6px; text-align:right;"></td>
          <td style="padding:6px 8px; text-align:center;"><button type="button" class="ms-sc-approve-one" data-id="${msEscapeHtml(r.id)}" style="padding:5px 10px; background:#00748C; color:#fff; border:none; border-radius:6px; cursor:pointer;">Approve</button></td>
        </tr>`).join('');
}

async function msOpenStockCheck() {
    if (!msCanAlignStock()) { alert('Only Irwin or Logistic can use Stock Check.'); return; }
    const modal = msEnsureStockCheckModal();
    modal.style.display = 'flex';
    modal.querySelector('#ms-sc-body').innerHTML = '<tr><td colspan="8" style="padding:30px; text-align:center; color:#777;">Checking all items...</td></tr>';
    if (window.__ibaMaterialStockFullyLoaded !== true || !Array.isArray(allMaterialStockData) || !allMaterialStockData.length) {
        try { await populateMaterialStock(); } catch (_) {}
    }
    try { await fetchTransfersOnly(); } catch (_) {}
    msStockCheckRows = msBuildStockCheckRows();
    msRenderStockCheck();
}
window.msOpenStockCheck = msOpenStockCheck;

function msDownloadStockCheckCsv() {
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [['Product ID', 'Name', 'Site', 'Card Qty', 'History Qty', 'Counted Qty'].map(q).join(',')];
    msStockCheckRows.forEach((r) => lines.push([r.productID, r.productName, r.site, r.card, r.history, ''].map(q).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Stock_Check_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function msApproveTickedStockCheck() {
    const modal = msEnsureStockCheckModal();
    const ids = Array.from(modal.querySelectorAll('.ms-sc-tick:checked')).map((cb) => cb.getAttribute('data-id'));
    if (!ids.length) { alert('Tick the sites you have checked first.'); return; }
    await msApproveStockCheckRows(ids);
}

async function msApproveStockCheckRows(ids) {
    if (!msCanAlignStock()) { alert('Only Irwin or Logistic can approve stock.'); return; }
    const modal = msEnsureStockCheckModal();
    const jobs = [];
    for (const id of ids) {
        const r = msStockCheckRows.find((x) => x.id === id);
        if (!r) continue;
        const input = modal.querySelector(`.ms-sc-qty[data-id="${CSS.escape(id)}"]`);
        const qty = parseFloat(input ? input.value : '');
        if (!isFinite(qty) || qty < 0) { alert(`Enter a valid qty for ${r.productID} at ${r.site}.`); return; }
        jobs.push({ ...r, qty });
    }
    if (!jobs.length) return;
    const preview = jobs.slice(0, 12).map((j) => `${j.productID} @ ${j.site}: ${j.card} -> ${j.qty}`).join('\n') + (jobs.length > 12 ? `\n...and ${jobs.length - 12} more` : '');
    if (!confirm(`APPROVE STOCK (${jobs.length})\n\n${preview}\n\nOnly approve qty that is physically at the site.`)) return;

    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
    const who = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover.Name : 'Unknown';
    const approveBtn = modal.querySelector('#ms-sc-approve-all');
    const summary = modal.querySelector('#ms-sc-summary');
    if (approveBtn) approveBtn.disabled = true;
    let done = 0;
    const failed = [];
    const touchedKeys = new Set();

    for (const j of jobs) {
        summary.textContent = `Saving ${done + 1} of ${jobs.length}...`;
        try {
            let changedMeanwhile = false;
            const res = await database.ref(`material_stock/${j.key}`).transaction((cur) => {
                changedMeanwhile = false;
                if (!cur) return cur;
                if (String(cur.productID || cur.productId || '').trim() !== j.productID) { changedMeanwhile = true; return; }
                if (!cur.sites) cur.sites = {};
                let siteVal = 0;
                Object.keys(cur.sites).forEach((k) => {
                    if (msCanonSiteKey(k) !== j.site) return;
                    siteVal += parseFloat(cur.sites[k]) || 0;
                    if (k !== j.site) delete cur.sites[k];
                });
                // The card must still hold what was shown on screen; otherwise re-check.
                if (Math.abs(siteVal - j.card) > 1e-9) { changedMeanwhile = true; return; }
                if (j.qty > 0) cur.sites[j.site] = j.qty; else delete cur.sites[j.site];
                let total = 0;
                Object.values(cur.sites).forEach((v) => { total += parseFloat(v) || 0; });
                cur.stockQty = total;
                if (!cur.checkedSites) cur.checkedSites = {};
                cur.checkedSites[j.site] = { card: j.qty, history: j.history, by: who, at: Date.now() };
                cur.lastUpdated = firebase.database.ServerValue.TIMESTAMP;
                return cur;
            });
            const ok = !!(res && res.committed && res.snapshot && res.snapshot.exists());
            if (!ok) { failed.push(`${j.productID} @ ${j.site}${changedMeanwhile ? ' (changed meanwhile)' : ''}`); continue; }
            // Keep the browser list current without a full re-download.
            const fresh = res.snapshot.val();
            const idx = allMaterialStockData.findIndex((x) => x.key === j.key);
            if (idx >= 0) allMaterialStockData[idx] = { ...allMaterialStockData[idx], ...fresh, key: j.key };
            touchedKeys.add(j.key);
            try {
                await database.ref('stock_adjustments').push({
                    productID: j.productID, key: j.key, site: j.site,
                    before: j.card, after: j.qty, history: j.history,
                    reason: 'Stock Check approval', by: who, at: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (logError) { console.warn('Stock adjustment log failed:', logError); }
            done++;
        } catch (e) {
            console.error('Stock Check approve failed:', j, e);
            failed.push(`${j.productID} @ ${j.site} (${e && e.message ? e.message : 'error'})`);
        }
    }
    for (const key of touchedKeys) {
        try { await window.inventoryPocket?.publishMaterialByKey(key); } catch (pocketError) { console.warn('Pocket publish after Stock Check failed:', pocketError); }
    }
    try {
        localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify({ data: allMaterialStockData, timestamp: Date.now(), complete: true, source: STOCK_CACHE_SOURCE }));
    } catch (_) {}
    if (approveBtn) approveBtn.disabled = false;
    msStockCheckRows = msBuildStockCheckRows();
    msRenderStockCheck();
    try { renderMaterialStockTable(allMaterialStockData); } catch (_) {}
    alert(`Approved ${done} of ${jobs.length}.` + (failed.length ? `\n\nNot saved (check again):\n${failed.join('\n')}` : ''));
}

// ==========================================================================
// REPORTING FUNCTIONS (Updated: Logo Left, Text Centered Below)
// ==========================================================================
function openStockReportModal() {
    const modal = document.getElementById('ms-report-modal');
    const tbody = document.getElementById('ms-report-table-body');
    const data = lastFilteredStockData;

    // 1. Prepare Title & Filter Info
    let titleSuffix = "";
    if (currentCategoryFilter && currentCategoryFilter !== 'All') {
        const familyName = STOCK_LEGENDS[currentCategoryFilter]?.name || currentCategoryFilter;
        titleSuffix = `<span style="display:block; font-size:14px; font-weight:normal; margin-top:5px; color:#555;">(Filtered: ${familyName})</span>`;
    }

    // 2. INJECT LOGO & HEADER
    const headerContainer = document.querySelector('#ms-report-modal .print-only-header');
    if (headerContainer) {
        headerContainer.innerHTML = `
            <div style="margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 15px;">

                <img src="https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/logo%20(1).png"
                     style="width: 550px; max-width: 100%; height: auto;"
                     alt="IBA Logo">

                <div class="print-only-header-text" style="clear: both; text-align: center; margin-top: 10px;">
                    <h3 style="margin: 0; font-family: sans-serif; color: #222; text-transform: uppercase; font-size: 20px; font-weight: bold; line-height: 1.2;">
                        Material Stock Status Report
                    </h3>
                    ${titleSuffix}
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #444;">Generated: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `;
    }

    // 3. Update Stats Boxes
    document.getElementById('ms-report-total').textContent = data.length;
    document.getElementById('ms-report-instock').textContent = data.filter(i => (parseFloat(i.stockQty) || 0) > 0).length;
    document.getElementById('ms-report-outstock').textContent = data.length - data.filter(i => (parseFloat(i.stockQty) || 0) > 0).length;

    // (Optional) Update date if element exists
    const dateEl = document.getElementById('ms-report-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleString();

    // 4. Render Table Rows
    tbody.innerHTML = '';
    data.forEach(item => {
        let locText = 'Main Store: 0';
        if (item.sites) {
            const locs = [];
            Object.entries(item.sites).forEach(([site, qty]) => {
                if (parseFloat(qty) > 0) locs.push(`${site}: ${qty}`);
            });
            if (locs.length > 0) locText = locs.join(', ');
            else if ((parseFloat(item.stockQty) || 0) > 0) locText = 'Main Store: ' + item.stockQty;
            else locText = 'Out of Stock';
        }

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:5px; font-weight:bold;">${item.productID || ''}</td>
                <td style="padding:5px;">${item.productName}</td>
                <td style="padding:5px; text-align:center; font-weight:bold;">${item.stockQty}</td>
                <td style="padding:5px; font-size:0.85rem; color:#555;">${locText}</td>
            </tr>`;
    });

    modal.classList.remove('hidden');
}

function downloadFixedStockCSV() {
    // --- USE FILTERED DATA FROM TABLE ---
    let data = lastFilteredStockData;

    if (data.length === 0) { alert("No data to export."); return; }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Product ID,Product Name,Category,Total Stock,Location Breakdown\r\n";

    data.forEach(item => {
        let locText = "";
        if (item.sites) {
            locText = Object.entries(item.sites)
                .filter(([_, qty]) => parseFloat(qty) > 0)
                .map(([site, qty]) => `${site}: ${qty}`)
                .join(" | ");
        }
        if(!locText) locText = "Main Store: " + (item.stockQty || 0);

        const safeLocText = `="${locText.replace(/"/g, '""')}"`;

        const row = [
            `"${item.productID || item.productId || ''}"`,
            `"${(item.productName || '').replace(/"/g, '""')}"`,
            `"${item.family || item.category || ''}"`,
            item.stockQty || 0,
            safeLocText
        ];
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Report_${currentCategoryFilter || 'Filtered'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// REQUIRED MATERIALS LIST (Notepad / Grocery List)
// - Local-only (stored in browser localStorage)
// - Safe: does NOT modify any stock or transfer logic
// ==========================================================================
const MS_REQUIRED_LIST_LOGO_URL = "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/logo%20(1).png";


function msPrintHtmlInHiddenFrame(html, frameId = 'ms-inventory-print-frame') {
    const oldFrame = document.getElementById(frameId);
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = frameId;
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const doPrint = () => {
        try {
            const win = iframe.contentWindow;
            if (!win) return;
            win.focus();
            win.print();
        } catch (e) {
            console.warn('Material Stock print failed:', e);
        }
    };

    const waitForImages = () => {
        try {
            const imgs = Array.from(doc.images || []);
            if (!imgs.length) {
                setTimeout(doPrint, 250);
                return;
            }

            let pending = imgs.length;
            const done = () => {
                pending -= 1;
                if (pending <= 0) setTimeout(doPrint, 250);
            };

            imgs.forEach(img => {
                if (img.complete) done();
                else {
                    img.onload = done;
                    img.onerror = done;
                }
            });

            setTimeout(() => {
                if (pending > 0) doPrint();
            }, 2500);
        } catch (e) {
            setTimeout(doPrint, 300);
        }
    };

    iframe.onload = waitForImages;
    setTimeout(waitForImages, 400);
}

function msBuildStockReportPrintHtml() {
    const data = Array.isArray(lastFilteredStockData) ? lastFilteredStockData : [];
    const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    let titleSuffix = '';
    if (currentCategoryFilter && currentCategoryFilter !== 'All') {
        const familyName = STOCK_LEGENDS[currentCategoryFilter]?.name || currentCategoryFilter;
        titleSuffix = `<div class="subtitle">Filtered: ${esc(familyName)}</div>`;
    }

    const rowsHtml = data.map((item) => {
        let locText = 'Main Store: 0';
        if (item.sites) {
            const locs = [];
            Object.entries(item.sites).forEach(([site, qty]) => {
                if (parseFloat(qty) > 0) locs.push(`${site}: ${qty}`);
            });
            if (locs.length > 0) locText = locs.join(', ');
            else if ((parseFloat(item.stockQty) || 0) > 0) locText = 'Main Store: ' + item.stockQty;
            else locText = 'Out of Stock';
        }

        return `
            <tr>
                <td class="mono">${esc(item.productID || item.productId || '')}</td>
                <td>${esc(item.productName || '')}</td>
                <td class="num">${esc(item.stockQty ?? 0)}</td>
                <td>${esc(locText)}</td>
            </tr>`;
    }).join('');

    const totalItems = data.length;
    const inStock = data.filter(i => (parseFloat(i.stockQty) || 0) > 0).length;
    const outStock = totalItems - inStock;

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Material Stock Status Report</title>
  <style>
    *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    body{margin:20px;color:#111;background:#fff}
    .hdr{display:flex;align-items:center;gap:18px;border-bottom:2px solid #003A5C;padding-bottom:12px;margin-bottom:14px}
    .hdr img{height:58px;width:auto;display:block}
    h1{margin:0;color:#003A5C;font-size:20px;letter-spacing:.02em}
    .subtitle{margin-top:4px;color:#555;font-size:12px}
    .meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0 14px;color:#444;font-size:12px}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0 16px}
    .stat{border:1px solid #dbe5ef;border-radius:8px;padding:10px;text-align:center;background:#f8fafc}
    .stat span{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
    .stat strong{font-size:18px;color:#0f172a}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #d9e3ef;padding:7px 8px;vertical-align:top}
    th{background:#f1f5f9;color:#003A5C;text-align:left;text-transform:uppercase;font-size:11px;letter-spacing:.03em}
    .mono{font-family:Consolas,Monaco,monospace;font-weight:700;color:#003A5C}
    .num{text-align:center;font-weight:800}
    .foot{margin-top:18px;border-top:1px solid #d9e3ef;padding-top:8px;font-size:11px;color:#64748b;display:flex;justify-content:space-between}
    @media print{body{margin:10mm}.stat{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
</head>
<body>
  <div class="hdr">
    <img src="${MS_REQUIRED_LIST_LOGO_URL}" alt="IBA" />
    <div>
      <h1>Material Stock Status Report</h1>
      ${titleSuffix}
    </div>
  </div>

  <div class="meta">
    <div><strong>Generated:</strong> ${esc(new Date().toLocaleString())}</div>
    <div><strong>Total Items:</strong> ${totalItems}</div>
  </div>

  <div class="stats">
    <div class="stat"><span>Total Items</span><strong>${totalItems}</strong></div>
    <div class="stat"><span>In Stock</span><strong>${inStock}</strong></div>
    <div class="stat"><span>Out of Stock</span><strong>${outStock}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:16%;">Product ID</th>
        <th style="width:34%;">Name</th>
        <th style="width:10%;text-align:center;">Total Qty</th>
        <th>Location Breakdown</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" style="text-align:center;color:#777;padding:20px;">No materials found.</td></tr>'}
    </tbody>
  </table>

  <div class="foot">
    <span>System Generated Report</span>
    <span>Signature: _______________________</span>
  </div>
</body>
</html>`;
}

function msPrintStockReport() {
    const data = Array.isArray(lastFilteredStockData) ? lastFilteredStockData : [];
    if (!data.length) {
        alert('No stock report data to print. Please select a family tab or search first.');
        return;
    }
    msPrintHtmlInHiddenFrame(msBuildStockReportPrintHtml(), 'ms-stock-report-print-frame');
}

function msRequiredListStorageKey() {
    let name = 'UnknownUser';
    try {
        name = (window.currentApprover && window.currentApprover.Name) ? window.currentApprover.Name : name;
        name = (window.currentUser && (window.currentUser.username || window.currentUser.Name)) ? (window.currentUser.username || window.currentUser.Name) : name;
    } catch (_) { /* ignore */ }
    const safe = String(name || 'UnknownUser').trim().replace(/[.#$\[\]\/\\]/g, '_').replace(/\s+/g, '_');
    return `ms_required_list:${safe || 'UnknownUser'}`;
}


function msLoadRequiredList() {
    try {
        const raw = localStorage.getItem(msRequiredListStorageKey());
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        // Backward compatible normalization:
        // - Ensure every row has a stable rowId (used for editing/removal)
        // - Keep legacy rows working (older versions stored only productID)
        const out = [];
        parsed.forEach((r, idx) => {
            if (!r || typeof r !== 'object') return;
            const obj = Object.assign({}, r);

            // Normalize productID key
            if (obj.productID == null && obj.productId != null) obj.productID = obj.productId;
            const pid = String(obj.productID || '').trim();

            // Stable rowId (pid for stock items, generated for manual items)
            let rowId = obj.rowId || obj.rowID || obj.id;
            if (!rowId) {
                rowId = pid ? pid : `manual-${Date.now()}-${idx}`;
            }
            obj.rowId = String(rowId);

            // Manual rows: allow blank stock code + blank actual qty
            if (!pid) {
                obj.productID = '';
                obj.isManual = true;
                if (obj.actualQty == null) obj.actualQty = '';
            } else {
                obj.isManual = !!obj.isManual;
            }

            // Defaults
            if (obj.qty == null || obj.qty === '') obj.qty = 1;
            out.push(obj);
        });

        return out;
    } catch (_) {
        return [];
    }
}

function msRequiredListToSiteStorageKey() {
    return `${msRequiredListStorageKey()}:toSite`;
}

function msLoadRequiredListToSite() {
    try {
        const raw = localStorage.getItem(msRequiredListToSiteStorageKey());
        return (raw == null) ? "" : String(raw);
    } catch (_) {
        return "";
    }
}

function msSaveRequiredListToSite() {
    try {
        localStorage.setItem(msRequiredListToSiteStorageKey(), String(msRequiredListToSite || ""));
    } catch (_) { /* ignore */ }
}

function msSaveRequiredList() {
    try {
        localStorage.setItem(msRequiredListStorageKey(), JSON.stringify(msRequiredList || []));
    } catch (_) { /* ignore */ }
}

function msUpdateRequiredListButton() {
    const btn = document.getElementById('ms-open-requestlist-btn');
    if (!btn) return;
    const count = Array.isArray(msRequiredList) ? msRequiredList.length : 0;
    btn.innerHTML = `<i class="fa-solid fa-clipboard-list"></i> Required List${count ? ` (${count})` : ''}`;
}


function msRenderRequiredListTable() {
    const tbody = document.getElementById('ms-requestlist-body');
    if (!tbody) return;

    if (!Array.isArray(msRequiredList) || msRequiredList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color:#777;">No items added yet.</td></tr>';
        return;
    }

    const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    tbody.innerHTML = msRequiredList.map((row) => {
        const pid = String(row.productID || '').trim();
        const rowId = String(row.rowId || pid || '').trim();
        const name = row.productName || '';
        const qty = (row.qty == null || row.qty === '') ? 1 : row.qty;
        const isManual = !!row.isManual || !pid;

        // For manual items, current qty is unknown (empty)
        const actualQty = isManual ? '' : ((row.actualQty == null || row.actualQty === '') ? 0 : row.actualQty);

        if (isManual) {
            return `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px; font-family:monospace; font-weight:bold; color:#00748C;"></td>
                    <td style="padding:10px;">
                        <input class="ms-required-item" data-rowid="${encodeURIComponent(rowId)}" type="text" value="${esc(name)}" placeholder="Enter item name" style="width:100%; padding:6px 8px; border:1px solid #ddd; border-radius: 6px;" />
                        <div style="font-size:0.8rem; color:#999; margin-top:4px;">Manual item (not in stock records)</div>
                    </td>
                    <td style="padding:10px; text-align:center; font-weight:700;"></td>
                    <td style="padding:10px; text-align:center;">
                        <input class="ms-required-qty" data-rowid="${encodeURIComponent(rowId)}" type="number" min="1" value="${qty}" style="width: 90px; text-align:center; padding:6px 8px; border:1px solid #ddd; border-radius: 6px;" />
                    </td>
                    <td style="padding:10px; text-align:center;">
                        <button type="button" class="delete-btn ms-required-remove" data-rowid="${encodeURIComponent(rowId)}" style="padding: 6px 10px; border-radius: 6px;" title="Remove">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }

        return `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px; font-family:monospace; font-weight:bold; color:#00748C;">${esc(pid)}</td>
                <td style="padding:10px;">
                    <div style="font-weight:700; color:#222;">${esc(name)}</div>
                    ${row.family ? `<div style="font-size:0.85rem; color:#777;">${esc(row.family)}</div>` : ''}
                </td>
                <td style="padding:10px; text-align:center; font-weight:700;">${esc(actualQty)}</td>
                <td style="padding:10px; text-align:center;">
                    <input class="ms-required-qty" data-rowid="${encodeURIComponent(rowId)}" type="number" min="1" value="${qty}" style="width: 90px; text-align:center; padding:6px 8px; border:1px solid #ddd; border-radius: 6px;" />
                </td>
                <td style="padding:10px; text-align:center;">
                    <button type="button" class="delete-btn ms-required-remove" data-rowid="${encodeURIComponent(rowId)}" style="padding: 6px 10px; border-radius: 6px;" title="Remove">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}


function msPlayAddSound() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!window.__msAudio) window.__msAudio = new Ctx();
        const ctx = window.__msAudio;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        const tone = (freq, start, dur) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, now + start);
            gain.gain.exponentialRampToValueAtTime(0.07, now + start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + start);
            osc.stop(now + start + dur + 0.02);
        };
        tone(784, 0, 0.08);
        tone(1175, 0.07, 0.12);
    } catch (_) {}
}

function msAddToRequiredList(item) {
    if (!item) return;
    const pid = String(item.productID || item.productId || '').trim();
    if (!pid) return;

    if (!Array.isArray(msRequiredList)) msRequiredList = [];

    // Normalize existing rows (rowId)
    msRequiredList = (msRequiredList || []).map((r, idx) => {
        if (!r || typeof r !== 'object') return r;
        if (r.productID == null && r.productId != null) r.productID = r.productId;
        const _pid = String(r.productID || '').trim();
        if (!r.rowId) r.rowId = _pid ? _pid : `manual-${Date.now()}-${idx}`;
        r.isManual = !!r.isManual || !_pid;
        return r;
    });

    const existing = msRequiredList.find(r => String(r.productID || '').trim() === pid);
    if (existing) {
        const currentQty = parseFloat(existing.qty) || 1;
        existing.qty = currentQty + 1;
        if (!existing.productName && item.productName) existing.productName = item.productName;
        if (!existing.family && (item.family || item.category)) existing.family = item.family || item.category;
        const latestActual = parseFloat(item.stockQty ?? item.balanceQty ?? existing.actualQty ?? 0);
        existing.actualQty = Number.isFinite(latestActual) ? latestActual : (existing.actualQty ?? 0);
        existing.rowId = existing.rowId || pid;
        existing.isManual = false;
    } else {
        msRequiredList.push({
            rowId: pid,
            productID: pid,
            productName: item.productName || '',
            family: item.family || item.category || '',
            actualQty: (parseFloat(item.stockQty ?? item.balanceQty ?? 0) || 0),
            qty: 1,
            isManual: false
        });
    }

    msSaveRequiredList();
    msUpdateRequiredListButton();
    msPlayAddSound();

    const modal = document.getElementById('ms-requestlist-modal');
    if (modal && !modal.classList.contains('hidden')) {
        msRenderRequiredListTable();
    }
}

function msAddManualRequiredItem() {
    if (!Array.isArray(msRequiredList)) msRequiredList = [];

    const rowId = `manual-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    msRequiredList.push({
        rowId,
        productID: '',
        productName: '',
        family: '',
        actualQty: '',
        qty: 1,
        isManual: true
    });

    msSaveRequiredList();
    msUpdateRequiredListButton();

    const modal = document.getElementById('ms-requestlist-modal');
    if (modal && !modal.classList.contains('hidden')) {
        msRenderRequiredListTable();
        // Focus the newest manual row item input
        setTimeout(() => {
            const inputs = modal.querySelectorAll('input.ms-required-item');
            if (inputs && inputs.length) inputs[inputs.length - 1].focus();
        }, 0);
    }
}


function msRemoveFromRequiredList(rowId) {
    if (!Array.isArray(msRequiredList)) msRequiredList = [];
    msRequiredList = msRequiredList.filter(r => String(r.rowId || '') !== String(rowId));
    msSaveRequiredList();
    msUpdateRequiredListButton();
    msRenderRequiredListTable();
}

function msClearRequiredList() {
    if (!confirm('Clear the Required Materials list?')) return;
    msRequiredList = [];
    msRequiredListToSite = "";
    msSaveRequiredList();
    msSaveRequiredListToSite();
    msUpdateRequiredListButton();
    msRenderRequiredListTable();
}

function msOpenRequiredListModal() {
    const modal = document.getElementById('ms-requestlist-modal');
    if (!modal) return;

    // Ensure latest from localStorage (in case another tab updated)
    msRequiredList = msLoadRequiredList();
    msRequiredListToSite = msLoadRequiredListToSite();

    // Best-effort refresh of "Actual Qty" from the latest in-memory stock snapshot.
    // (Does NOT fetch from Firebase; keeps this feature safe and non-destructive.)
    try {
        if (Array.isArray(msRequiredList) && msRequiredList.length && Array.isArray(allMaterialStockData) && allMaterialStockData.length) {
            const byPid = new Map();
            allMaterialStockData.forEach(i => {
                const pid = i.productID || i.productId || '';
                if (!pid) return;
                byPid.set(String(pid), (parseFloat(i.stockQty ?? i.balanceQty ?? 0) || 0));
            });
            let changed = false;
            msRequiredList.forEach(r => {
                const pid = String(r.productID || '');
                if (!pid || !byPid.has(pid)) return;
                const latest = byPid.get(pid);
                if (r.actualQty !== latest) {
                    r.actualQty = latest;
                    changed = true;
                }
            });
            if (changed) msSaveRequiredList();
        }
    } catch (_) { /* ignore */ }
    msUpdateRequiredListButton();

    const logo = document.getElementById('ms-requestlist-logo');
    if (logo && !logo.src) logo.src = MS_REQUIRED_LIST_LOGO_URL;
    if (logo && logo.src !== MS_REQUIRED_LIST_LOGO_URL) logo.src = MS_REQUIRED_LIST_LOGO_URL;

    const dateEl = document.getElementById('ms-requestlist-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleString();

    const toSiteInput = document.getElementById('ms-requestlist-to-site');
    if (toSiteInput) {
        msFillRequestListSites(toSiteInput);
        toSiteInput.value = String(msRequiredListToSite || '');
    }

    msRenderRequiredListTable();
    modal.classList.remove('hidden');
}


function msPrintRequiredList() {
    if (!Array.isArray(msRequiredList) || msRequiredList.length === 0) {
        alert('No items to print. Add items first.');
        return;
    }

    // Best-effort refresh of "Actual Qty" from the latest in-memory stock snapshot
    // before printing (no extra fetching).
    try {
        if (Array.isArray(allMaterialStockData) && allMaterialStockData.length) {
            const byPid = new Map();
            allMaterialStockData.forEach(i => {
                const pid = i.productID || i.productId || '';
                if (!pid) return;
                byPid.set(String(pid), (parseFloat(i.stockQty ?? i.balanceQty ?? 0) || 0));
            });
            let changed = false;
            msRequiredList.forEach(r => {
                const pid = String(r.productID || '').trim();
                if (!pid || !byPid.has(pid)) return;
                const latest = byPid.get(pid);
                if (r.actualQty !== latest) {
                    r.actualQty = latest;
                    changed = true;
                }
            });
            if (changed) msSaveRequiredList();
        }
    } catch (_) { /* ignore */ }

    // Pull latest "To site" value from UI (if available)
    const toSiteInput = document.getElementById('ms-requestlist-to-site');
    if (toSiteInput) {
        msRequiredListToSite = String(toSiteInput.value || "").trim();
        msSaveRequiredListToSite();
    }

    const escapeHtml = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const toSiteText = (msRequiredListToSite || '').trim();

    const rowsHtml = msRequiredList.map((r, idx) => {
        const pid = String(r.productID || '').trim();
        const name = r.productName || '';
        const isManual = !!r.isManual || !pid;
        const actual = isManual ? '' : String((parseFloat(r.actualQty) || 0));
        const qty = String((parseFloat(r.qty) || 1));

        return `
            <tr>
                <td>${idx + 1}</td>
                <td style="font-family:monospace; font-weight:700;">${escapeHtml(pid)}</td>
                <td>${escapeHtml(name)}</td>
                <td style="text-align:center; font-weight:700;">${escapeHtml(actual)}</td>
                <td style="text-align:center; font-weight:700;">${escapeHtml(qty)}</td>
            </tr>
        `;
    }).join('');

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Required Materials to Transfer</title>
  <style>
    *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    body{margin:20px;color:#111}
    .hdr{border-bottom:2px solid #003A5C;padding-bottom:12px;margin-bottom:14px}
    /* Logo should be left-aligned (title remains centered on its own line) */
    .logo{display:flex;justify-content:flex-start}
    .logo img{height:54px;width:auto;display:block}
    .title{margin-top:8px;text-align:center;font-weight:900;color:#003A5C;font-size:20px}
    .meta{margin-top:6px;font-size:12px;color:#555;text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th,td{border:1px solid #ddd;padding:8px;font-size:13px}
    th{background:#003A5C;color:#fff;text-align:left}
    .foot{margin-top:18px;font-size:12px;color:#555;display:flex;justify-content:space-between}
    @media print{body{margin:10mm}}
  </style>
</head>
<body>
  <div class="hdr">
    <div class="logo"><img src="${MS_REQUIRED_LIST_LOGO_URL}" alt="IBA" /></div>
    <div class="title">Required Materials to Transfer</div>
    <div class="meta">Generated: ${new Date().toLocaleString()}</div>
  </div>

  <div class="meta" style="margin-top:6px; font-size:13px; text-align:left;">
    <span style="font-weight:800; color:#003A5C;">To site:</span>
    <span style="font-weight:800;">${escapeHtml(toSiteText || '________')}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:55px;">#</th>
        <th style="width:160px;">Stock Code</th>
        <th>Item</th>
        <th style="width:120px; text-align:center;">Actual Qty</th>
        <th style="width:120px; text-align:center;">Qty Needed</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="foot">
    <span>System Generated</span>
    <span>Signature: _______________________</span>
  </div>
</body>
</html>`;

    msPrintHtmlInHiddenFrame(html, 'ms-required-list-print-frame');
}

function msInitRequiredListUI() {
    // Load + badge
    msRequiredList = msLoadRequiredList();
    msRequiredListToSite = msLoadRequiredListToSite();
    msUpdateRequiredListButton();

    // Wire buttons
    const openBtn = document.getElementById('ms-open-requestlist-btn');
    if (openBtn && !openBtn.dataset.bound) {
        openBtn.dataset.bound = '1';
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            msOpenRequiredListModal();
        });
    }

    const printBtn = document.getElementById('ms-requestlist-print-btn');
    if (printBtn && !printBtn.dataset.bound) {
        printBtn.dataset.bound = '1';
        printBtn.addEventListener('click', (e) => {
            e.preventDefault();
            msPrintRequiredList();
        });
    }

    const clearBtn = document.getElementById('ms-requestlist-clear-btn');
    if (clearBtn && !clearBtn.dataset.bound) {
        clearBtn.dataset.bound = '1';
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            msClearRequiredList();
        });
    }
    const addManualBtn = document.getElementById('ms-requestlist-add-manual-btn');
    if (addManualBtn && !addManualBtn.dataset.bound) {
        addManualBtn.dataset.bound = '1';
        addManualBtn.addEventListener('click', (e) => {
            e.preventDefault();
            msRequiredList = msLoadRequiredList();
            msAddManualRequiredItem();
        });
    }


    // Delegated events for qty changes + remove
    const tbody = document.getElementById('ms-requestlist-body');
    if (tbody && !tbody.dataset.bound) {
        tbody.dataset.bound = '1';

        tbody.addEventListener('input', (e) => {
            const input = e.target;

            // Manual item name edits
            if (input && input.classList && input.classList.contains('ms-required-item')) {
                const rid = decodeURIComponent(input.getAttribute('data-rowid') || '');
                const row = msRequiredList.find(r => String(r.rowId || '') === String(rid));
                if (row) {
                    row.productName = String(input.value || '').trim();
                    msSaveRequiredList();
                }
                return;
            }

            if (!(input && input.classList && input.classList.contains('ms-required-qty'))) return;
            const rid = decodeURIComponent(input.getAttribute('data-rowid') || '');
            const v = Math.max(1, parseFloat(input.value) || 1);
            input.value = String(v);
            const row = msRequiredList.find(r => String(r.rowId || '') === String(rid));
            if (row) {
                row.qty = v;
                msSaveRequiredList();
            }
        });

        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.ms-required-remove');
            if (!btn) return;
            e.preventDefault();
            const rid = decodeURIComponent(btn.getAttribute('data-rowid') || '');
            msRemoveFromRequiredList(rid);
        });
    }

    // To site input (persist per user/device)
    const toSiteInput = document.getElementById('ms-requestlist-to-site');
    if (toSiteInput && !toSiteInput.dataset.bound) {
        toSiteInput.dataset.bound = '1';
        msFillRequestListSites(toSiteInput);
        toSiteInput.value = String(msRequiredListToSite || '');
        toSiteInput.addEventListener('change', () => {
            msRequiredListToSite = String(toSiteInput.value || '');
            toSiteInput.classList.toggle('ms-site-empty', !toSiteInput.value);
            msSaveRequiredListToSite();
        });
    }

    // Ensure modal logo is set once (best effort)
    const logo = document.getElementById('ms-requestlist-logo');
    if (logo && !logo.src) logo.src = MS_REQUIRED_LIST_LOGO_URL;
}

// ==========================================================================
// 10. EVENTS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initMaterialStockSystem();
    // Required Materials list (notepad) - safe, local-only
    msInitRequiredListUI();
    msInitPhotoBrowserUI();
    // 9.4.8 Firebase read optimization:
    // Do NOT auto-download material_stock + transfer_entries on every login/page load.
    // Data now loads only when the user opens the Material Stock section through navigation
    // or clicks Refresh while already inside that section.

        const refreshBtn = document.getElementById('ms-refresh-btn');
    if (refreshBtn) {
        const run = async () => {
            localStorage.removeItem(STOCK_CACHE_KEY);
            populateMaterialStock(true);
        };
        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(refreshBtn, 'ms-refresh', run, 30);
        } else {
            refreshBtn.addEventListener('click', run);
        }
    }
const addNewBtn = document.getElementById('ms-add-new-btn');
    if (addNewBtn) addNewBtn.addEventListener('click', openNewMaterialModal);

    const saveNewBtn = document.getElementById('ms-save-new-btn');
    if (saveNewBtn) saveNewBtn.addEventListener('click', handleSaveNewMaterial);

    const templateBtn = document.getElementById('ms-template-btn');
    if (templateBtn) templateBtn.addEventListener('click', handleGetTemplate);

    const uploadBtn = document.getElementById('ms-upload-csv-btn');
    const fileInput = document.getElementById('ms-csv-file-input');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleUploadCSV);
    }
    const titleBtn = document.getElementById('ms-upload-titles-btn');
    const titleInput = document.getElementById('ms-title-file-input');
    const titleDownloadBtn = document.getElementById('ms-download-titles-btn');
    if (titleBtn && titleInput && titleBtn.dataset.bound !== '1') {
        titleBtn.dataset.bound = '1';
        titleBtn.addEventListener('click', () => titleInput.click());
        titleInput.addEventListener('change', handleUploadTitles);
    }
    if (titleDownloadBtn && titleDownloadBtn.dataset.bound !== '1') {
        titleDownloadBtn.dataset.bound = '1';
        titleDownloadBtn.addEventListener('click', handleDownloadTitles);
    }

    const clearBtn = document.getElementById('ms-clear-form-btn');
    if (clearBtn) clearBtn.addEventListener('click', handleClearMaterialForm);

    // --- SEARCH LOGIC ---
    const msSearchInput = document.getElementById('ms-search-input');
        if (msSearchInput && msSearchInput.dataset.bound !== '1') {
        msSearchInput.dataset.bound = '1';
        msSearchInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            renderMaterialStockTable(allMaterialStockData);
        });
    }

   // --- MATERIAL STOCK CLEAR BUTTON LOGIC ---
    const msClearBtn = document.getElementById('ms-search-clear-btn');
    const msTableBody = document.getElementById('ms-table-body');
    const msCountDisplay = document.getElementById('ms-total-count');
    const msTabs = document.getElementById('ms-category-tabs');

    if (msClearBtn && msClearBtn.dataset.bound !== '1') {
        msClearBtn.dataset.bound = '1';
        msClearBtn.addEventListener('click', () => {
            if (msSearchInput) {
                msSearchInput.value = '';
                msSearchInput.disabled = false;
                msSearchInput.readOnly = false;
                msSearchInput.focus();
            }

            currentCategoryFilter = null;
            lastFilteredStockData = [];
            const siteFilter = document.getElementById('ms-site-filter');
            if (siteFilter) siteFilter.value = 'All';
            if (typeof renderCategoryTabs === 'function') renderCategoryTabs();
            renderMaterialStockTable(allMaterialStockData);
        });
    }

    const openReportBtn = document.getElementById('ms-open-report-modal-btn');
    if(openReportBtn) openReportBtn.addEventListener('click', openStockReportModal);

    const printModalBtn = document.getElementById('ms-modal-print-btn');
    if (printModalBtn && printModalBtn.dataset.bound !== '1') {
        printModalBtn.dataset.bound = '1';
        printModalBtn.addEventListener('click', msPrintStockReport);
    }

    const excelModalBtn = document.getElementById('ms-modal-excel-btn');
    if(excelModalBtn) excelModalBtn.addEventListener('click', downloadFixedStockCSV);

    const bulkDeleteBtn = document.getElementById('ms-bulk-delete-btn');
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    const mergeSelectedBtn = document.getElementById('ms-merge-selected-btn');
    if (mergeSelectedBtn && mergeSelectedBtn.dataset.bound !== '1') {
        mergeSelectedBtn.dataset.bound = '1';
        mergeSelectedBtn.addEventListener('click', handleMergeSelected);
    }
    const stockCheckBtn = document.getElementById('ms-stock-check-btn');
    if (stockCheckBtn && stockCheckBtn.dataset.bound !== '1') {
        stockCheckBtn.dataset.bound = '1';
        stockCheckBtn.addEventListener('click', () => msOpenStockCheck());
    }

    const saveStockBtn = document.getElementById('ms-save-stock-btn');
    if(saveStockBtn) {
        saveStockBtn.addEventListener('click', async () => {
            const key = document.getElementById('ms-add-key').value;
            const site = document.getElementById('ms-add-site-select').value;
            const qty = parseFloat(document.getElementById('ms-add-qty-input').value) || 0;

            if(qty === 0) { alert("Enter quantity."); return; }

            const item = allMaterialStockData.find(i => i.key === key);
            let sites = item.sites || {};

            let currentSiteQty = parseFloat(sites[site] || 0);
            currentSiteQty += qty;
            if(currentSiteQty < 0) { alert("Cannot have negative stock."); return; }

            sites[site] = currentSiteQty;

            let total = 0; Object.values(sites).forEach(q => total += q);

            await ((typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase()).ref(`material_stock/${key}`).update({
                sites: sites,
                stockQty: total,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            try { await window.inventoryPocket?.publishMaterialByKey(key); } catch (pocketError) { console.warn('Inventory Pocket stock update failed:', pocketError); }

            alert("Stock Updated Successfully.");
            document.getElementById('ms-add-stock-modal').classList.add('hidden');
            localStorage.removeItem(STOCK_CACHE_KEY);
            populateMaterialStock(true);
        });
    }
});

// ==========================================================================
// NEW: DELETE SPECIFIC SITE STOCK ONLY
// ==========================================================================
window.deleteSiteStock = async function(key, siteToDelete) {
    if (!confirm(`⚠️ WARNING (Super Admin)\n\nAre you sure you want to remove ALL stock from:\n📍 ${siteToDelete}?\n\nOther sites for this item will remain safe.`)) {
        return;
    }

    const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();

    try {
        const snapshot = await database.ref(`material_stock/${key}`).once('value');
        const item = snapshot.val();

        if (!item || !item.sites) {
            alert("Error: Item or sites not found.");
            return;
        }

        const updatedSites = { ...item.sites };
        delete updatedSites[siteToDelete];

        let newTotal = 0;
        Object.values(updatedSites).forEach(q => newTotal += parseFloat(q) || 0);

        await database.ref(`material_stock/${key}`).update({
            sites: updatedSites,
            stockQty: newTotal,
            balanceQty: newTotal,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
            updatedBy: "Irwin (Site Deleted)"
        });
        try { await window.inventoryPocket?.publishMaterialByKey(key); } catch (pocketError) { console.warn('Inventory Pocket site delete update failed:', pocketError); }

        alert(`Success! Removed stock from ${siteToDelete}.`);

        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);

    } catch (e) {
        console.error("Delete Site Error:", e);
        alert("Failed to delete site stock.");
    }
};

function msPaintRowFrost() {
    const table = document.getElementById('ms-table');
    const wrap = table && table.closest('.table-wrapper');
    if (!table || !wrap) return;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    let bar = wrap.querySelector(':scope > .ms-row-frost');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'ms-row-frost';
        bar.hidden = true;
        wrap.appendChild(bar);
    }
    const place = function (tr) {
        if (!tr) { bar.hidden = true; return; }
        table.querySelectorAll('tr.ms-frost-on').forEach(function (el) { el.classList.remove('ms-frost-on'); });
        tr.classList.add('ms-frost-on');
        const pr = wrap.getBoundingClientRect();
        const rr = tr.getBoundingClientRect();
        const tl = table.getBoundingClientRect();
        bar.hidden = false;
        bar.style.top = (rr.top - pr.top + wrap.scrollTop) + 'px';
        bar.style.height = Math.max(rr.height, 1) + 'px';
        bar.style.left = (tl.left - pr.left + wrap.scrollLeft) + 'px';
        bar.style.width = table.offsetWidth + 'px';
    };
    table.querySelectorAll('tbody tr.ms-parent-row').forEach(function (tr) {
        if (tr.dataset.frostBound === '1') return;
        tr.dataset.frostBound = '1';
        tr.addEventListener('mouseenter', function () { place(tr); });
        tr.addEventListener('mouseleave', function () {
            const child = table.querySelector('tbody tr.stock-child-row:not(.hidden)');
            const parent = child && child.previousElementSibling;
            if (parent && parent.classList.contains('ms-parent-row')) place(parent);
            else {
                tr.classList.remove('ms-frost-on');
                bar.hidden = true;
            }
        });
    });
    const openChild = table.querySelector('tbody tr.stock-child-row:not(.hidden)');
    const openParent = openChild && openChild.previousElementSibling;
    if (openParent && openParent.classList.contains('ms-parent-row')) place(openParent);
    else {
        table.querySelectorAll('tr.ms-frost-on').forEach(function (el) { el.classList.remove('ms-frost-on'); });
        bar.hidden = true;
    }
}
window.msPaintRowFrost = msPaintRowFrost;
