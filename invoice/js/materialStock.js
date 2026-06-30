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

// materialStock.js - V10.16 (9.4.8: Firebase read optimization - no auto Material Stock download on login)

let allMaterialStockData = [];
let allTransferData = [];
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
const STOCK_CACHE_DURATION = 24 * 60 * 60 * 1000;


// OneDrive / SharePoint photo support for Material Stock.
// IMPORTANT: Firebase stores only a small text value.
// The actual photo file stays in OneDrive/SharePoint to avoid Firebase Storage usage.
const MS_MATERIAL_PHOTO_BASE_URL = 'https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/Photo/';
const MS_MATERIAL_PHOTO_DEFAULT_EXT = '.jpg';
// PhotoIndex.csv lives in GitHub and contains one required column: photoName.
// Browsing a private OneDrive folder directly is not possible from a static website without Microsoft Graph/API,
// so this browser reads the GitHub PhotoIndex CSV, previews the generated OneDrive .jpg, and saves only the selected photoName.
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

    // The system appends .jpg automatically, so keep only the clean base filename.
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
        const database = (typeof db !== 'undefined') ? db : firebase.database();
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
        const database = (typeof db !== 'undefined') ? db : firebase.database();
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
        preview.innerHTML = '<div class="ms-photo-browser-empty-preview">Choose a photo name from the suggestions to preview.</div>';
        return;
    }
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
        const database = (typeof db !== 'undefined') ? db : firebase.database();
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
        const database = (typeof db !== 'undefined') ? db : firebase.database();
        await database.ref(`material_stock/${itemKey}`).update({
            photoName: null,
            photoUrl: null,
            photoFileName: null,
            photoFile: null,
            photoRemovedBy: msGetCurrentMaterialUserName() || 'System',
            photoRemovedAt: firebase.database.ServerValue.TIMESTAMP,
            lastUpdated: firebase.database.ServerValue.TIMESTAMP
        });

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

    if (tabsContainer && !document.getElementById(filterId)) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-block';
        wrapper.style.marginLeft = '15px';
        wrapper.style.verticalAlign = 'middle';

        const select = document.createElement('select');
        select.id = filterId;
        select.className = 'form-control';
        select.style.padding = '5px 10px';
        select.innerHTML = `<option value="All">All Sites</option><option value="Main Store">Main Store</option>`;

        const cachedSites = localStorage.getItem('cached_SITES');
        if (cachedSites) {
            try {
                const sitesData = JSON.parse(cachedSites).data || [];
                sitesData.forEach(s => {
                    if (s.site !== 'Main Store') select.innerHTML += `<option value="${s.site}">${s.site} - ${s.description}</option>`;
                });
            } catch (e) {}
        }

        select.addEventListener('change', () => {
            renderMaterialStockTable(allMaterialStockData);
        });

        wrapper.appendChild(select);
        tabsContainer.parentNode.insertBefore(wrapper, tabsContainer.nextSibling);
    }
}

// ==========================================================================
// 1. LOAD DATA
// ==========================================================================
async function populateMaterialStock(forceRefresh = false) {
    const tableBody = document.getElementById('ms-table-body');
    const tabsContainer = document.getElementById('ms-category-tabs');

    if (!tableBody) return;

    // NOTE: We cache the stock list for speed, but stock can change due to
    // Transfer/Restock/Usage/Return actions happening in other sessions.
    // To avoid showing outdated totals (e.g., Movement History updated but Stock Breakdown still old),
    // we treat the cache as stale when there are newer transfer entries than the cache timestamp.
    if (!forceRefresh) {
        const cached = localStorage.getItem(STOCK_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const age = Date.now() - parsed.timestamp;
                if (age < STOCK_CACHE_DURATION) {
                    console.log("Loading Stock from Cache...");
                    allMaterialStockData = parsed.data || [];

                    // Always refresh transfers (movement history)
                    await fetchTransfersOnly();

                    // If any transfer entry is newer than the cache timestamp, refresh stock from DB.
                    // This keeps the UI accurate without requiring a manual page refresh.
                    // Transfer entries keep the original `timestamp` (created-at). When a transfer is
                    // approved/received, we update `lastUpdated`. Use the latest activity time so the
                    // stock cache refreshes correctly after completions.
                    let latestActivityTs = 0;
                    if (Array.isArray(allTransferData) && allTransferData.length) {
                        for (const t of allTransferData) {
                            const ts = parseFloat(t.lastUpdated || t.timestamp || 0) || 0;
                            if (ts > latestActivityTs) latestActivityTs = ts;
                        }
                    }

                    if (latestActivityTs && parsed.timestamp && latestActivityTs > parsed.timestamp) {
                        console.log("Stock cache is stale (newer transfers detected). Refreshing stock from DB...");
                        const database = (typeof db !== 'undefined') ? db : firebase.database();
                        const stockSnap = await database.ref('material_stock').once('value');
                        const stockData = stockSnap.val();
                        allMaterialStockData = [];
                        if (stockData) {
                            Object.keys(stockData).forEach(key => {
                                allMaterialStockData.push({ key: key, ...stockData[key] });
                            });
                        }

                        // Update cache timestamp after refresh
                        localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify({
                            data: allMaterialStockData,
                            timestamp: Date.now()
                        }));
                    }

                    renderCategoryTabs();
                    // Show empty state by default (no heavy rendering) until user selects a tab or searches.
                    renderMaterialStockTable(allMaterialStockData);
                    return;
                }
            } catch (e) { console.error("Cache parse error", e); }
        }
    }

    if(tabsContainer) tabsContainer.innerHTML = '<span style="padding:10px;">Downloading data...</span>';
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Downloading stock data...</td></tr>';

    try {
        const database = (typeof db !== 'undefined') ? db : firebase.database();

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

        localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify({
            data: allMaterialStockData,
            timestamp: Date.now()
        }));

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
}

async function fetchTransfersOnly() {
    const database = (typeof db !== 'undefined') ? db : firebase.database();
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

    const shortenFamilyName = (name, limit = 12) => {
        const clean = String(name || '').trim();
        if (clean.length <= limit) return clean;
        return clean.slice(0, limit).trimEnd() + '…';
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
            const displayName = isActive ? name : shortenFamilyName(name, 12);
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
function renderMaterialStockTable(data) {
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
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    // Super Admin replacement: allow edit actions in Inventory (no delete)
    const isEditor = (isAdmin || isVacationDelegate);
    const canAttachPhoto = isEditor || msCanAttachMaterialPhoto();

    const bulkBtn = document.getElementById('ms-bulk-delete-btn');
    if (bulkBtn) {
        if (isIrwin) bulkBtn.classList.remove('hidden');
        else bulkBtn.classList.add('hidden');
    }

    const tableHeadRow = document.querySelector('#ms-table thead tr');
    if (tableHeadRow) {
        if (isIrwin) {
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

    const getSiteDisplayName = (siteCode) => {
        if (siteCode === "Main Store") return "Main Store";
        const cachedSites = localStorage.getItem('cached_SITES');
        if (cachedSites) {
            try {
                const sitesData = JSON.parse(cachedSites).data || [];
                const found = sitesData.find(s => s.site == siteCode);
                if (found) return `<span style="color:#00748C; font-weight:bold;">${found.site}</span> - ${found.description}`;
            } catch (e) {}
        }
        return siteCode;
    };

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
    lastFilteredStockData = filtered;

    if (countDisplay) countDisplay.textContent = `(Total: ${filtered.length})`;

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#777;">No materials found.</td></tr>';
        return;
    }

    filtered.forEach(item => {
        // 1. PRE-CALCULATE HISTORY
        const stockID = String(item.productID || item.productId || '').trim();
        const productTransfers = allTransferData.filter(t => {
            const transferID = String(t.productID || t.productId || '').trim();
            return transferID === stockID;
        });

        // 2. GENERATE SITE BREAKDOWN
        let totalStock = 0;
        let breakdownRows = '';
        let hasSites = false;

        if (siteFilterVal !== 'All') totalStock = parseFloat(item.sites[siteFilterVal] || 0);

        if (item.sites) {
            Object.entries(item.sites).forEach(([site, qty]) => {
                const q = parseFloat(qty);

                // Filter Check
                if (siteFilterVal !== 'All' && site !== siteFilterVal) return;

                // --- SMART LOGIC: Hide 0 qty sites UNLESS there's a pending transfer ---
                const hasPendingTransaction = productTransfers.some(t => {
                    const isPending = (t.remarks !== 'Completed' && t.remarks !== 'Received');
                    const involvesSite = (t.toLocation === site || t.toSite === site || t.fromLocation === site || t.fromSite === site);
                    return isPending && involvesSite;
                });

                if (q !== 0 || hasPendingTransaction) {
                    hasSites = true;
                    if (siteFilterVal === 'All') totalStock += q;

                    let deleteSiteAction = '';
                    if (isIrwin && q === 0) {
                        deleteSiteAction = `<span onclick="deleteSiteStock('${item.key}', '${site}')" style="color:red; font-weight:bold; cursor:pointer; margin-left:10px; float:right;" title="Delete ONLY this site stock">[x]</span>`;
                    }

                    breakdownRows += `
                        <tr>
                            <td style="width: 70%; padding-left: 20px;">
                                ${getSiteDisplayName(site)} ${deleteSiteAction}
                            </td>
                            <td style="width: 30%; font-weight:bold;">${q}</td>
                        </tr>`;
                }
            });
        }

        if (!hasSites && siteFilterVal === 'All') {
            const legacyStock = parseFloat(item.stockQty) || 0;
            totalStock = legacyStock;
            breakdownRows = `<tr><td style="padding-left: 20px;">Unassigned (Global)</td><td>${legacyStock}</td></tr>`;
        }

        // 3. GENERATE HISTORY ROWS
        let historyRows = '';
        if (productTransfers.length === 0) {
            historyRows = '<tr><td colspan="7" style="text-align:center; color:#999; font-style:italic; padding: 20px;">No movement history found.</td></tr>';
        } else {
            productTransfers.forEach(t => {
                const date = t.shippingDate || new Date(t.timestamp).toISOString().split('T')[0];
                const type = t.jobType || t.for || 'Transfer';
                let route = '-';

                if (type === 'Transfer') route = `${t.fromLocation || t.fromSite} -> ${t.toLocation || t.toSite}`;
                else if (type === 'Restock') route = `<span style="color:#28a745;">+ Add to ${t.toLocation || t.toSite}</span>`;
                else if (type === 'Return') route = `<span style="color:#dc3545;">- Return from ${t.fromLocation || t.fromSite}</span>`;
                else if (type === 'Usage') route = `<span style="color:#6f42c1;">- Used at ${t.fromLocation || t.fromSite}</span>`;

                const qtyReceived = t.receivedQty || 0;

                let actionBtn = '';
                const isCompleted = (t.remarks === 'Completed' || t.remarks === 'Received');

                // [FIX] Safe check for currentUser inside the loop
                const currentUser = (currentApprover) ? currentApprover.Name : '';
                const isMyReceipt = (t.receiver === currentUser);

                if (isCompleted && isMyReceipt && type !== 'Return') {
                    actionBtn = `<button class="secondary-btn" onclick="initiateReturn('${t.key}')" style="padding:2px 8px; font-size:0.75rem; background-color:#ffc107; color:#212529; border:none; border-radius:4px; cursor:pointer;" title="Return this item"><i class="fa-solid fa-rotate-left"></i> Return</button>`;
                }

                historyRows += `
                    <tr>
                        <td style="font-size:0.85rem;">${date}</td>
                        <td style="font-size:0.85rem; font-weight:600;">${type}</td>
                        <td style="font-size:0.85rem;">${route}</td>
                        <td style="font-size:0.85rem; text-align:center; font-weight:bold;">${qtyReceived}</td>
                        <td style="font-size:0.85rem;">${t.enteredBy || 'System'}</td>
                        <td style="font-size:0.85rem;">${t.remarks}</td>
                        <td style="text-align:center;">${actionBtn}</td>
                    </tr>
                `;
            });
        }

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
                firstColContent = `
                    <div class="ms-row-selector">
                        <input type="checkbox" class="ms-row-checkbox" data-key="${item.key}" data-name="${item.productName}">
                        <button class="ms-expand-btn" onclick="toggleStockDetail('${uniqueId}', this)">+</button>
                    </div>
                `;
            }
        } else {
            actionButtons = addToRequiredBtn + `<span class="ms-view-only-note">View Only</span>`;
        }

        actionButtons = `<div class="ms-row-actions">${actionButtons}</div>`;


        const familyDisplay = item.family || item.category || 'Unclassified';
        const relationshipDisplay = item.relationship || item.details || '';
        const materialPhotoCard = msBuildMaterialPhotoCard(item, canAttachPhoto);
        const hasPhotoIcon = msGetMaterialPhotoUrl(item) ? ' <i class="fa-regular fa-image" title="Photo available" style="color:#00748C; margin-left:6px;"></i>' : '';

        const parentRow = document.createElement('tr');
        parentRow.classList.add('ms-parent-row');
        parentRow.innerHTML = `
            <td class="ms-cell-expand">${firstColContent}</td>
            <td class="ms-cell-code"><span class="ms-product-code">${item.productID || item.productId}</span></td>
            <td class="ms-cell-detail"><div class="ms-product-title"><strong>${item.productName}</strong>${hasPhotoIcon}</div></td>
            <td class="ms-cell-family"><span class="ms-family-badge">${familyDisplay}</span></td>
            <td class="ms-cell-relation"><span class="ms-relation-text">${relationshipDisplay || '-'}</span></td>
            <td class="ms-cell-stock"><span class="ms-stock-pill">${totalStock}</span></td>
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
        childRow.innerHTML = `
            <td colspan="7" style="padding: 15px 25px; background-color: #fcfcfc;">
                <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start;">
                    <div style="flex: 0 0 250px; min-width: 230px;">
                        <h4 style="margin: 0 0 10px 0; color: #00748C; border-bottom: 2px solid #00748C; padding-bottom: 5px;">
                            <i class="fa-regular fa-image"></i> Item Photo
                        </h4>
                        ${materialPhotoCard}
                    </div>
                    <div style="flex: 1; min-width: 300px;">
                        <h4 style="margin: 0 0 10px 0; color: #003A5C; border-bottom: 2px solid #003A5C; padding-bottom: 5px;">
                            <i class="fa-solid fa-cubes"></i> Current Stock Breakdown
                        </h4>
                        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; background: #fff;">
                            <table class="stock-detail-table" style="width: 100%; margin: 0;">
                                <thead style="background:#f0f0f0; position: sticky; top: 0;"><tr><th>Site</th><th>Qty</th></tr></thead>
                                <tbody>${breakdownRows}</tbody>
                            </table>
                        </div>
                    </div>
                    <div style="flex: 2; min-width: 400px;">
                        <h4 style="margin: 0 0 10px 0; color: #6f42c1; border-bottom: 2px solid #6f42c1; padding-bottom: 5px;">
                            <i class="fa-solid fa-clock-rotate-left"></i> Movement History
                        </h4>
                        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; background: #fff;">
                            <table class="stock-detail-table" style="width: 100%; margin: 0;">
                                <thead style="background:#f0f0f0; position: sticky; top: 0;">
                                    <tr><th>Date</th><th>Type</th><th>Route</th><th style="text-align:center;">Qty</th><th>By</th><th>Status</th><th>Action</th></tr>
                                </thead>
                                <tbody>${historyRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </td>
        `;

        tableBody.appendChild(parentRow);
        tableBody.appendChild(childRow);
    });


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

    const relatedTransfers = allTransferData.filter(t =>
        (t.productID === productID || t.productId === productID)
    );

    const confirmMsg = `⚠️ MASTER DELETE (Super Admin) ⚠️\n\nProduct: ${productName}\nID: ${productID}\n\nThis will DELETE the item AND ALL ${relatedTransfers.length} related transactions history.\n\nThis cannot be undone. Proceed?`;

    if (confirm(confirmMsg)) {
        const database = firebase.database();
        const updates = {};

        updates[`material_stock/${key}`] = null;
        relatedTransfers.forEach(t => {
            updates[`transfer_entries/${t.key}`] = null;
        });

        try {
            await database.ref().update(updates);
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

    populateModalSiteDropdown();
};

window.openSuperAdminEdit = function(key) {
    const item = allMaterialStockData.find(i => i.key === key);
    if(!item) return;

    editingItemKey = key;

    const modal = document.getElementById('ms-new-material-modal');
    modal.classList.remove('hidden');

    document.getElementById('ms-modal-title').textContent = "Edit Item & Add Stock";
    document.getElementById('ms-save-new-btn').textContent = "Update Item";

    document.getElementById('ms-new-name').value = item.productName;
    document.getElementById('ms-new-id-display').value = item.productID;

    const photoInput = document.getElementById('ms-new-photo-url');
    if (photoInput) photoInput.value = msGetMaterialPhotoInputValue(item);

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
    const database = (typeof db !== 'undefined') ? db : firebase.database();

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

            await database.ref('material_stock').push(newMaterial);
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

        const database = (typeof db !== 'undefined') ? db : firebase.database();
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

// ==========================================================================
// 8. ADD STOCK MODAL LOGIC
// ==========================================================================
window.openAddStockModal = function (key) {
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
    siteSelect.innerHTML = '<option value="Main Store">Main Store</option>';
    if (typeof allSitesCSVData !== 'undefined') {
        allSitesCSVData.forEach(s => {
            if(s.site !== "Main Store") {
                const opt = document.createElement('option');
                opt.value = s.site;
                opt.textContent = `${s.site} - ${s.description}`;
                siteSelect.appendChild(opt);
            }
        });
    }
};

// ==========================================================================
// 9. HELPERS (Fixed: Accordion Effect)
// ==========================================================================

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
        row.classList.toggle('hidden');
        btn.textContent = row.classList.contains('hidden') ? '+' : '-';
    }
};

async function populateModalSiteDropdown() {
    const siteSelect = document.getElementById('ms-new-site-select');
    if (!siteSelect) return;
    siteSelect.innerHTML = '<option value="Main Store">Main Store</option>';
    if (typeof allSitesCSVData !== 'undefined' && allSitesCSVData) {
        allSitesCSVData.forEach(site => {
            if (site.site !== "Main Store") {
                const opt = document.createElement('option');
                opt.value = site.site;
                opt.textContent = `${site.site} - ${site.description}`;
                siteSelect.appendChild(opt);
            }
        });
    }
}

window.handleClearMaterialForm = function() {
    document.getElementById('ms-new-material-form').reset();
    document.getElementById('ms-new-id-display').value = "Auto-Generated";
    const photoInput = document.getElementById('ms-new-photo-url');
    if (photoInput) photoInput.value = '';
};

window.initiateReturn = function(transferKey) {
    const database = (typeof db !== 'undefined') ? db : firebase.database();
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

    const database = firebase.database();
    const updates = {};
    let transfersDeletedCount = 0;

    checkedBoxes.forEach(box => {
        const key = box.dataset.key;
        const stockItem = allMaterialStockData.find(i => i.key === key);
        const productID = stockItem?.productID || stockItem?.productId || "";

        updates[`material_stock/${key}`] = null;

        if (productID && productID.trim() !== "") {
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

    try {
        await database.ref().update(updates);
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
    if (toSiteInput) toSiteInput.value = String(msRequiredListToSite || "");

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
        toSiteInput.value = String(msRequiredListToSite || "");
        toSiteInput.addEventListener('input', () => {
            msRequiredListToSite = String(toSiteInput.value || "");
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

    const clearBtn = document.getElementById('ms-clear-form-btn');
    if (clearBtn) clearBtn.addEventListener('click', handleClearMaterialForm);

    // --- SEARCH LOGIC ---
    const msSearchInput = document.getElementById('ms-search-input');
    if (msSearchInput) {
        msSearchInput.addEventListener('input', () => {
            renderMaterialStockTable(allMaterialStockData);
        });
    }

   // --- MATERIAL STOCK CLEAR BUTTON LOGIC ---
    const msClearBtn = document.getElementById('ms-search-clear-btn');
    const msTableBody = document.getElementById('ms-table-body');
    const msCountDisplay = document.getElementById('ms-total-count');
    const msTabs = document.getElementById('ms-category-tabs');

    if (msClearBtn) {
        msClearBtn.addEventListener('click', () => {
            // 1. Clear Search Input
            if (msSearchInput) {
                msSearchInput.value = '';
                msSearchInput.focus();
            }

            // 2. Wipe Table
            if (msTableBody) {
                msTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#777;">List cleared. Please select a Family tab above.</td></tr>';
            }

            // 3. Reset Counts
            if (msCountDisplay) {
                msCountDisplay.textContent = '';
            }

            // 4. Reset Category Tabs
            if (msTabs) {
                msTabs.querySelectorAll('.active').forEach(tab => {
                    tab.classList.remove('active');
                    tab.style.borderBottomColor = 'transparent';
                    tab.style.color = '#555';
                });
            }
            currentCategoryFilter = null;
            lastFilteredStockData = [];

            // 5. NEW: Reset Site Filter to "All"
            const siteFilter = document.getElementById('ms-site-filter');
            if(siteFilter) siteFilter.value = 'All';
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

            await firebase.database().ref(`material_stock/${key}`).update({
                sites: sites,
                stockQty: total,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });

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

    const database = firebase.database();

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

        alert(`Success! Removed stock from ${siteToDelete}.`);

        localStorage.removeItem(STOCK_CACHE_KEY);
        populateMaterialStock(true);

    } catch (e) {
        console.error("Delete Site Error:", e);
        alert("Failed to delete site stock.");
    }
};
