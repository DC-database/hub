/*
 * IBA WorkDesk - Job Vendor Suggestions / Autocomplete helpers
 * Split from app.js in v8.1.8. Public function names are preserved
 * because existing Job Entry and Invoice Entry handlers call them directly.
 */

function __normVendorName(v) {
    return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function ensureVendorsDataFetchedForJobEntry(forceRefresh = false) {
    try {
        if (!forceRefresh && allVendorsData && Object.keys(allVendorsData).length) return allVendorsData;

        let url = null;

        // Preferred: same mechanism used by Invoice Management
        if (typeof getFirebaseCSVUrl === 'function') {
            try {
                url = await getFirebaseCSVUrl('Vendors.csv');
            } catch (_) {
                url = null;
            }
        }

        // Fallback: public GitHub raw file (matches POVALUE2 pattern)
        if (!url) {
            url = 'https://raw.githubusercontent.com/DC-database/Hub/main/Vendors.csv';
        }

        const map = await fetchAndParseVendorsCSV(url);
        allVendorsData = map || {};
        __jobVendorDatalistBuilt = false;
        __jobVendorNameToId = null;
        __manualVendorDatalistBuilt = false;
        __vendorSearchIndex = null;
        return allVendorsData;
    } catch (e) {
        console.warn('ensureVendorsDataFetchedForJobEntry failed:', e);
        if (!allVendorsData) allVendorsData = {};
        return allVendorsData;
    }
}

function buildJobVendorDatalistIfNeeded() {
    if (__jobVendorDatalistBuilt) return;
    if (!allVendorsData || !Object.keys(allVendorsData).length) return;

    const nameToId = {};
    const uniqueNames = new Map(); // normalized -> display name

    for (const [id, name] of Object.entries(allVendorsData)) {
        const disp = String(name || '').trim();
        const norm = __normVendorName(disp);
        if (!id || !disp || !norm) continue;
        if (!nameToId[norm]) nameToId[norm] = String(id).trim();
        if (!uniqueNames.has(norm)) uniqueNames.set(norm, disp);
    }

    const sorted = Array.from(uniqueNames.values()).sort((a, b) => a.localeCompare(b));
    __jobVendorNamesSorted = sorted;
    // IMPORTANT: Do NOT inject thousands of <option> elements into <datalist>.
    // On some browsers this makes the whole system feel slow and can still fail
    // to show suggestions reliably. We keep the datalist empty and use the custom
    // suggestion dropdown instead.
    if (jobVendorNameList) jobVendorNameList.innerHTML = '';
    __jobVendorNameToId = nameToId;
    // Build a lightweight search index for fast suggestions
    __vendorSearchIndex = sorted.map(n => ({ name: n, nameLower: String(n).toLowerCase() }));
    __jobVendorDatalistBuilt = true;
}


let __manualVendorDatalistBuilt = false;

function buildManualVendorDatalistIfNeeded() {
    if (__manualVendorDatalistBuilt) return;
    const listEl = document.getElementById('manual-vendor-name-list');
    if (!listEl) return;
    if (!allVendorsData || !Object.keys(allVendorsData).length) return;

    // Prefer the same sorted vendor list we already build for Job Entry
    let sorted = __jobVendorNamesSorted;
    if (!sorted || !sorted.length) {
        const uniqueNames = new Map(); // normalized -> display name
        for (const [id, name] of Object.entries(allVendorsData)) {
            const disp = String(name || '').trim();
            const norm = __normVendorName(disp);
            if (!id || !disp || !norm) continue;
            if (!uniqueNames.has(norm)) uniqueNames.set(norm, disp);
        }
        sorted = Array.from(uniqueNames.values()).sort((a, b) => a.localeCompare(b));
    }

    // Keep datalist empty for performance/reliability; we use the custom dropdown.
    listEl.innerHTML = '';
    __manualVendorDatalistBuilt = true;
}

// --------------------------------------------------------------------------
// Vendor suggestion dropdown (Portal)
// - Renders into <body> so it is NOT clipped by modal containers.
// - Used by BOTH: Workdesk Job Entry (Invoice) and Invoice Management Manual PO.
// --------------------------------------------------------------------------

function __ensureVendorSuggestPortal() {
    if (__vendorSuggestPortalEl) return __vendorSuggestPortalEl;

    const el = document.createElement('div');
    el.className = 'vendor-suggest-box vendor-suggest-portal hidden';
    el.setAttribute('role', 'listbox');
    document.body.appendChild(el);
    __vendorSuggestPortalEl = el;

    // Prevent blur->hide from blocking click selection
    el.addEventListener('mousedown', (e) => {
        const item = e.target && e.target.closest ? e.target.closest('.vendor-suggest-item') : null;
        if (!item) return;
        e.preventDefault();
        const name = (item.getAttribute('data-vendor-name') || item.textContent || '').trim();
        if (name && typeof __vendorSuggestPortalOnPick === 'function') {
            __vendorSuggestPortalOnPick(name);
        }
        __hideVendorSuggestPortal();
    });

    // Hide when clicking outside
    document.addEventListener('mousedown', (e) => {
        if (!__vendorSuggestPortalEl || __vendorSuggestPortalEl.classList.contains('hidden')) return;
        const t = e.target;
        if (__vendorSuggestPortalEl.contains(t)) return;
        if (__vendorSuggestPortalAnchor && (__vendorSuggestPortalAnchor === t || __vendorSuggestPortalAnchor.contains(t))) return;
        __hideVendorSuggestPortal();
    });

    // Keep position correct on resize/scroll
    window.addEventListener('resize', () => {
        if (__vendorSuggestPortalAnchor && __vendorSuggestPortalEl && !__vendorSuggestPortalEl.classList.contains('hidden')) {
            __positionVendorSuggestPortal(__vendorSuggestPortalAnchor);
        }
    });
    window.addEventListener('scroll', () => {
        if (__vendorSuggestPortalAnchor && __vendorSuggestPortalEl && !__vendorSuggestPortalEl.classList.contains('hidden')) {
            __positionVendorSuggestPortal(__vendorSuggestPortalAnchor);
        }
    }, true);

    return el;
}

function __positionVendorSuggestPortal(anchorInput) {
    try {
        if (!anchorInput || !__vendorSuggestPortalEl) return;
        const r = anchorInput.getBoundingClientRect();
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

        // Prefer opening downward; if not enough space, open upward.
        const spaceBelow = vh - r.bottom;
        const spaceAbove = r.top;
        const openUp = (spaceBelow < 180 && spaceAbove > spaceBelow);

        const width = Math.min(Math.max(r.width, 220), vw - 16);
        const left = Math.min(Math.max(r.left, 8), vw - width - 8);

        __vendorSuggestPortalEl.style.width = `${width}px`;
        __vendorSuggestPortalEl.style.left = `${left}px`;
        __vendorSuggestPortalEl.style.right = 'auto';
        __vendorSuggestPortalEl.style.position = 'fixed';

        if (openUp) {
            const bottom = Math.max(8, vh - r.top + 2);
            __vendorSuggestPortalEl.style.bottom = `${bottom}px`;
            __vendorSuggestPortalEl.style.top = 'auto';
        } else {
            const top = Math.min(vh - 8, r.bottom + 2);
            __vendorSuggestPortalEl.style.top = `${top}px`;
            __vendorSuggestPortalEl.style.bottom = 'auto';
        }
    } catch (_) {
        // best effort
    }
}

function __hideVendorSuggestPortal() {
    if (!__vendorSuggestPortalEl) return;
    __vendorSuggestPortalEl.classList.add('hidden');
    __vendorSuggestPortalEl.innerHTML = '';
    __vendorSuggestPortalAnchor = null;
    __vendorSuggestPortalOnPick = null;
    if (__vendorSuggestPortalHideTimer) {
        clearTimeout(__vendorSuggestPortalHideTimer);
        __vendorSuggestPortalHideTimer = null;
    }
}

function __scheduleHideVendorSuggestPortal(delayMs = 120) {
    if (__vendorSuggestPortalHideTimer) clearTimeout(__vendorSuggestPortalHideTimer);
    __vendorSuggestPortalHideTimer = setTimeout(() => {
        __hideVendorSuggestPortal();
    }, delayMs);
}

function __renderVendorSuggestPortal(anchorInput, query, onPickFn) {
    const el = __ensureVendorSuggestPortal();

    const esc = (typeof imHelpEscapeHtml === 'function')
        ? imHelpEscapeHtml
        : (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const q = String(query || '').toLowerCase().trim();
    if (!q) {
        __hideVendorSuggestPortal();
        return;
    }

    // Ensure search index exists
    if (!__vendorSearchIndex || !__vendorSearchIndex.length) {
        // Try building from current vendors cache
        try {
            if (typeof buildJobVendorDatalistIfNeeded === 'function') buildJobVendorDatalistIfNeeded();
        } catch (_) {}
    }
    const index = __vendorSearchIndex || [];
    if (!index.length) {
        __hideVendorSuggestPortal();
        return;
    }

    // Match anywhere, but prioritize startsWith.
    const starts = [];
    const contains = [];
    for (const row of index) {
        const nl = row.nameLower || '';
        const pos = nl.indexOf(q);
        if (pos === -1) continue;
        if (pos === 0) starts.push(row.name);
        else contains.push(row.name);
        // Keep work light
        if ((starts.length + contains.length) >= 80) break;
    }

    if (!starts.length && !contains.length) {
        __hideVendorSuggestPortal();
        return;
    }

    starts.sort((a, b) => a.localeCompare(b));
    contains.sort((a, b) => a.localeCompare(b));
    const top = starts.concat(contains).slice(0, 10);

    el.innerHTML = top.map(n => (
        `<div class="vendor-suggest-item" role="option" data-vendor-name="${esc(n)}">${esc(n)}</div>`
    )).join('');

    __vendorSuggestPortalAnchor = anchorInput;
    __vendorSuggestPortalOnPick = onPickFn;
    __positionVendorSuggestPortal(anchorInput);
    el.classList.remove('hidden');
}

function __debouncedVendorSuggestPortal(anchorInput, query, onPickFn) {
    if (__vendorSuggestPortalDebounceTimer) clearTimeout(__vendorSuggestPortalDebounceTimer);
    __vendorSuggestPortalDebounceTimer = setTimeout(() => {
        __renderVendorSuggestPortal(anchorInput, query, onPickFn);
    }, 90);
}

function getVendorIdByName(name) {
    const norm = __normVendorName(name);
    if (!norm) return '';
    if (__jobVendorNameToId && __jobVendorNameToId[norm]) return __jobVendorNameToId[norm];
    // Fallback: scan map once if needed
    if (allVendorsData && Object.keys(allVendorsData).length) {
        for (const [id, n] of Object.entries(allVendorsData)) {
            if (__normVendorName(n) === norm) return String(id).trim();
        }
    }
    return '';
}

function syncJobVendorFromName() {
    if (!jobVendorNameInput || !jobVendorIdInput) return;
    const name = String(jobVendorNameInput.value || '').trim();
    if (!name) return;
    const id = getVendorIdByName(name);
    if (id) jobVendorIdInput.value = id;
}

function syncJobVendorFromId() {
    if (!jobVendorNameInput || !jobVendorIdInput) return;
    const id = String(jobVendorIdInput.value || '').trim();
    if (!id) return;
    if (allVendorsData && allVendorsData[id]) {
        jobVendorNameInput.value = allVendorsData[id];
    }
}

function hideJobVendorSuggest() {
    // Hide both the legacy in-modal box (if present) and the portal dropdown.
    try { __hideVendorSuggestPortal(); } catch (_) {}
    if (jobVendorSuggestBox) {
        jobVendorSuggestBox.classList.add('hidden');
        jobVendorSuggestBox.innerHTML = '';
    }
}

function showJobVendorSuggest(query) {
    if (!jobVendorNameInput) return;
    if (!jobForSelect || jobForSelect.value !== 'Invoice') {
        hideJobVendorSuggest();
        return;
    }

    // Ensure vendor index exists (best-effort, does not block typing)
    try { buildJobVendorDatalistIfNeeded(); } catch (_) {}

    __debouncedVendorSuggestPortal(jobVendorNameInput, query, (pickedName) => {
        if (!pickedName) return;
        jobVendorNameInput.value = pickedName;
        syncJobVendorFromName();
    });
}

// --------------------------------------------------------------------------
// Manual PO: Vendor Name visible suggestions (Fallback dropdown)
// - Supports contains-match (e.g., typing 'NAY' suggests all vendors with NAY)
// - Keeps existing Manual PO save & sync logic intact.
// --------------------------------------------------------------------------

function hideManualVendorSuggest() {
    try { __hideVendorSuggestPortal(); } catch (_) {}
    if (manualVendorSuggestBox) {
        manualVendorSuggestBox.classList.add('hidden');
        manualVendorSuggestBox.innerHTML = '';
    }
}

function showManualVendorSuggest(query) {
    const modal = document.getElementById('im-manual-po-modal');
    if (modal && modal.classList.contains('hidden')) {
        hideManualVendorSuggest();
        return;
    }
    const nameInput = document.getElementById('manual-vendor-name');
    const idInput = document.getElementById('manual-supplier-id');
    if (!nameInput) return;

    // Ensure vendor index exists (best-effort)
    try { buildJobVendorDatalistIfNeeded(); } catch (_) {}

    __debouncedVendorSuggestPortal(nameInput, query, (pickedName) => {
        if (!pickedName) return;
        nameInput.value = pickedName;
        try {
            const id = (typeof getVendorIdByName === 'function') ? getVendorIdByName(pickedName) : '';
            if (id && idInput) idInput.value = id;
        } catch (_) {}
    });
}
