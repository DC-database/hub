// js/app-attention-validation.js
// Version 11.2.4 — Restore Batch/Invoice automatic Attention routing while preserving no-attention statuses.
// Moved from app.js in v8.2.3 (cleanup only).
// Public function names preserved for existing app.js listeners and inline handlers.


// ------------------------------------------------------------
// refreshNotePickers
// ------------------------------------------------------------
function refreshNotePickers(latestNote) {
    try {
        const note = (latestNote == null) ? '' : String(latestNote);
        const trimmed = note.replace(/\u00A0/g, ' ').trim(); // normalize NBSP
        if (trimmed) {
            if (typeof allUniqueNotes === 'undefined' || !allUniqueNotes) allUniqueNotes = new Set();
            allUniqueNotes.add(trimmed);
        }
    } catch (e) {
        // ignore
    }

    // 1) Summary Note datalist suggestions
    try {
        if (typeof noteSuggestionsDatalist !== 'undefined' && noteSuggestionsDatalist) {
            noteSuggestionsDatalist.innerHTML = '';
            const sorted = Array.from(allUniqueNotes || []).sort((a, b) => String(a).localeCompare(String(b)));
            for (const n of sorted) {
                const opt = document.createElement('option');
                opt.value = n;
                noteSuggestionsDatalist.appendChild(opt);
            }
        }
    } catch (e) {
        // ignore
    }

    // 2) Batch Entry "Search by Note" dropdown (Choices)
    try {
        if (typeof imBatchNoteSearchChoices !== 'undefined' && imBatchNoteSearchChoices) {
            let current = '';
            try {
                current = imBatchNoteSearchChoices.getValue(true);
            } catch (_) { /* ignore */ }

            Promise.resolve(populateNoteDropdown(imBatchNoteSearchChoices)).then(() => {
                try {
                    if (Array.isArray(current)) {
                        current.forEach(v => imBatchNoteSearchChoices.setChoiceByValue(v));
                    } else if (current) {
                        imBatchNoteSearchChoices.setChoiceByValue(current);
                    }
                } catch (_) { /* ignore */ }
            });
        }
    } catch (e) {
        // ignore
    }
}

// ------------------------------------------------------------
// autoSetAttentionForStatus
// ------------------------------------------------------------
async function autoSetAttentionForStatus(status, siteCode, choicesInstance) {
    if (!choicesInstance) return;
    if (typeof imShouldForceAttentionNoneForStatus === 'function' && imShouldForceAttentionNoneForStatus(status)) {
        imClearAttentionToNone(choicesInstance);
        return;
    }

    if (!allApproverData || Object.keys(allApproverData).length === 0) {
        await ensureApproverDataCached(true);
    }

    let targetName = null;
    let candidates = [];

    const st = (status || '').toLowerCase().trim();

    if (st === 'ceo approval') {
        targetName = findPersonByKeyword('hamad', true);
    } else if (st === 'in process') {
        // 11.2.4: In Process should route to COO (not the old E.Ali fallback).
        targetName = findPersonByKeyword('coo', true);
    } else if (st === 'report') {
        targetName = findPersonByKeyword('gio', true);
    } else if (st === 'for srv') {
    candidates = getSiteMatchedAttentionCandidatesForSRV(siteCode);
    candidates = candidates.filter(c => c && c.name && c.name.trim().length > 0);
    if (candidates.length === 1) {
        targetName = candidates[0].name;
    } else if (candidates.length > 1) {
        showCandidatePicker(candidates, 'Select Person for SRV', (selected) => {
            // selected is the raw name
            if (selected) {
                const attentionSelect = document.getElementById('im-attention');
                if (attentionSelect) {
                    attentionSelect.value = selected;
                    attentionSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
                try {
                    choicesInstance.clearChoices();
                    choicesInstance.setChoices([{ value: selected, label: selected }], 'value', 'label', false);
                    choicesInstance.setChoiceByValue(selected);
                } catch (e) { console.warn(e); }
            }
        });
        return;
    }
}

    if (targetName) {
        try {
            choicesInstance.setChoiceByValue(targetName);
            const attentionSelect = document.getElementById('im-attention');
            if (attentionSelect) attentionSelect.value = targetName;
        } catch (err) {
            await populateAttentionDropdown(choicesInstance, status, siteCode, true);
            choicesInstance.setChoiceByValue(targetName);
        }
    } else if (st === 'for srv' && candidates.length === 0) {
        const fallback = resolveVacationAssignee('Irwin');
        choicesInstance.setChoiceByValue(fallback);
        const attentionSelect = document.getElementById('im-attention');
        if (attentionSelect) attentionSelect.value = fallback;
    }
}

// ------------------------------------------------------------
// showCandidatePicker
// ------------------------------------------------------------
function showCandidatePicker(candidates, title, callback) {
    if (!candidates || candidates.length === 0) return;

    const existing = document.getElementById('dynamic-candidate-picker');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dynamic-candidate-picker';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10050; display:flex; align-items:center; justify-content:center;';

    const container = document.createElement('div');
    container.style.cssText = 'background:white; border-radius:12px; max-width:400px; width:90%; padding:20px; box-shadow:0 10px 25px rgba(0,0,0,0.2);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;';
    header.innerHTML = `<h3 style="margin:0; color:#000;">${title}</h3>
                        <button style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#000;">&times;</button>`;
    container.appendChild(header);

    const content = document.createElement('div');
    content.style.marginBottom = '20px';
    content.innerHTML = '<p style="color:#000;">Multiple persons match the site. Please select one:</p>';
    const listDiv = document.createElement('div');
    listDiv.style.display = 'flex';
    listDiv.style.flexDirection = 'column';
    listDiv.style.gap = '8px';

    candidates.forEach(candidate => {
        // candidate can be string (backward compat) or object { name, position }
        const name = typeof candidate === 'object' ? candidate.name : candidate;
        const position = typeof candidate === 'object' ? candidate.position : '';
        const displayText = position ? `${name} - ${position}` : name;

        const btn = document.createElement('button');
        btn.textContent = displayText;
        btn.style.cssText = 'padding:8px; border:1px solid #ccc; border-radius:8px; background:#f8fafc; cursor:pointer; text-align:left; color:#000000 !important; font-weight:500;';
        btn.addEventListener('click', () => {
            overlay.remove();
            callback(name); // pass only the name (raw)
        });
        listDiv.appendChild(btn);
    });
    content.appendChild(listDiv);
    container.appendChild(content);

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'secondary-btn';
    cancelBtn.style.cssText = 'padding:8px 16px; color:#000; background:#e2e8f0; border:none; border-radius:6px; cursor:pointer;';
    cancelBtn.addEventListener('click', () => {
        overlay.remove();
        callback(null);
    });
    footer.appendChild(cancelBtn);
    container.appendChild(footer);

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    const closeBtn = header.querySelector('button');
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        callback(null);
    });
}

// ------------------------------------------------------------
// findPersonByKeyword
// ------------------------------------------------------------
function findPersonByKeyword(keyword, fallbackToIrwin = true) {
    if (!allApproverData) return fallbackToIrwin ? 'Irwin' : null;
    const keywordLower = keyword.toLowerCase();
    for (const key in allApproverData) {
        const p = allApproverData[key];
        if (!p || !p.Name) continue;
        const name = p.Name.trim();
        const pos = (p.Position || '').toLowerCase();
        if (name.toLowerCase() === keywordLower || pos.includes(keywordLower)) {
            return resolveVacationAssignee(name);
        }
    }
    return fallbackToIrwin ? resolveVacationAssignee('Irwin') : null;
}

// ------------------------------------------------------------
// getSiteMatchedAttentionCandidatesForSRV
// ------------------------------------------------------------
function getSiteMatchedAttentionCandidatesForSRV(siteCode) {
    if (!allApproverData) {
        console.warn("allApproverData is null or undefined. Call ensureApproverDataCached() first.");
        return [];
    }

    const poSiteId = (siteCode || '').toString().toLowerCase().split(/[\s\-]+/)[0].trim();
    if (!poSiteId) {
        console.warn("No site ID extracted from PO site:", siteCode);
        return [];
    }

    console.log("🔍 Looking for SRV candidates matching site ID:", poSiteId);
    const allowedPositions = ['logistic', 'camp boss', 'site dc', 'storekeeper'];
    const candidates = []; // will store { name, position }

    for (const key in allApproverData) {
        const approver = allApproverData[key];
        if (!approver) continue;

        let name = approver.Name || approver.Username || approver.FullName || '';
        name = name.toString().trim();
        if (!name) continue;

        const position = (approver.Position || '').toString().toLowerCase().trim();
        const userSiteRaw = (approver.Site || '').toString().trim();
        if (!userSiteRaw) continue;

        const userSites = userSiteRaw.split(',').map(s => s.trim()).filter(s => s !== '');
        if (userSites.length === 0) continue;

        const posMatch = allowedPositions.some(allowed => position.includes(allowed));
        if (!posMatch) continue;

        const siteMatch = userSites.includes(poSiteId);
        if (!siteMatch) continue;

        candidates.push({ name, position });
        console.log(`✅ Candidate: ${name} (${position}) - sites: ${userSites}`);
    }

    // Remove duplicates by name (keep first occurrence)
    const unique = [];
    const seen = new Set();
    for (const cand of candidates) {
        if (!seen.has(cand.name)) {
            seen.add(cand.name);
            unique.push(cand);
        }
    }
    console.log("🎯 Final SRV candidates:", unique);
    return unique;
}

// ------------------------------------------------------------
// imIsAttentionRequiredForStatus
// ------------------------------------------------------------
function imNormalizeAttentionStatus(statusValue) {
    return String(statusValue || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// 11.1.5: These invoice statuses are holding/final/reference statuses.
// They must always use Attention = None/blank and must not create personal active tasks.
function imShouldForceAttentionNoneForStatus(statusValue) {
    const st = imNormalizeAttentionStatus(statusValue);
    return [
        'under review',
        'for summary',
        'with accounts',
        'pending',
        'report approved',
        'on hold'
    ].includes(st);
}

function imIsAttentionRequiredForStatus(statusValue) {
    return !imShouldForceAttentionNoneForStatus(statusValue);
}

function imClearAttentionToNone(choicesInstance) {
    if (!choicesInstance) return;
    try {
        if (typeof choicesInstance.removeActiveItems === 'function') choicesInstance.removeActiveItems();
        if (typeof choicesInstance.setChoices === 'function') {
            choicesInstance.setChoices([{ value: 'None', label: 'None (Clear Selection)' }], 'value', 'label', false);
        }
        if (typeof choicesInstance.setChoiceByValue === 'function') choicesInstance.setChoiceByValue('None');
        else if (typeof choicesInstance.setValue === 'function') choicesInstance.setValue(['None']);
    } catch (_) {
        try { if (typeof choicesInstance.removeActiveItems === 'function') choicesInstance.removeActiveItems(); } catch (__) {}
    }
    const attentionSelect = document.getElementById('im-attention');
    if (attentionSelect) attentionSelect.value = 'None';
}

// ------------------------------------------------------------
// imUpdateAttentionRequiredUI
// ------------------------------------------------------------
function imUpdateAttentionRequiredUI(statusValue) {
    if (!imAttentionGroup) return;
    const required = imIsAttentionRequiredForStatus(statusValue || '');
    imAttentionGroup.classList.toggle('is-required', required);

    // If attention isn't required, clear any "invalid" visuals for it
    if (!required) {
        imAttentionGroup.classList.remove('im-invalid');
    }
}

// ------------------------------------------------------------
// imClearInvoiceInvalidUI
// ------------------------------------------------------------
function imClearInvoiceInvalidUI() {
    if (!imNewInvoiceForm) return;

    // Clear invalid on all invoice-entry inputs/selects/textareas
    imNewInvoiceForm.querySelectorAll('.im-invalid').forEach(el => el.classList.remove('im-invalid'));

    // Also clear group-level invalid states
    imNewInvoiceForm.querySelectorAll('.form-group.im-invalid').forEach(el => el.classList.remove('im-invalid'));
    if (imAttentionGroup) imAttentionGroup.classList.remove('im-invalid');
}

// ------------------------------------------------------------
// imMarkInvoiceInvalidUI
// ------------------------------------------------------------
function imMarkInvoiceInvalidUI({ requireAttention = true } = {}) {
    if (!imNewInvoiceForm) return;

    const requiredIds = ['im-inv-no', 'im-inv-value', 'im-invoice-date', 'im-status'];
    requiredIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const missing = !String(el.value || '').trim();
        el.classList.toggle('im-invalid', missing);
        const group = el.closest('.form-group');
        if (group) group.classList.toggle('im-invalid', missing);
    });

    if (requireAttention) {
        const raw = imAttentionSelectChoices ? imAttentionSelectChoices.getValue(true) : (imAttentionSelect ? imAttentionSelect.value : '');
        const attentionMissing = !raw || raw === 'None';
        if (imAttentionGroup) imAttentionGroup.classList.toggle('im-invalid', attentionMissing);
    } else {
        if (imAttentionGroup) imAttentionGroup.classList.remove('im-invalid');
    }
}

// ------------------------------------------------------------
// imWireInvoiceValidationUI
// ------------------------------------------------------------
function imWireInvoiceValidationUI() {
    if (!imNewInvoiceForm) return;

    const clearFor = (id, evt = 'input') => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(evt, () => {
            el.classList.remove('im-invalid');
            const group = el.closest('.form-group');
            if (group) group.classList.remove('im-invalid');
        });
    };

    clearFor('im-inv-no', 'input');
    clearFor('im-inv-value', 'input');
    clearFor('im-invoice-date', 'change');
    clearFor('im-status', 'change');
    clearFor('im-details', 'input');
    clearFor('im-amount-paid', 'input');
    clearFor('im-release-date', 'change');
    clearFor('im-inv-name', 'input');
    clearFor('im-srv-name', 'input');
    clearFor('im-report-name', 'input');
    clearFor('im-note', 'input');

    if (imAttentionSelect) {
        imAttentionSelect.addEventListener('change', () => {
            if (imAttentionGroup) imAttentionGroup.classList.remove('im-invalid');
        });
    }
}

// ------------------------------------------------------------
// populateAttentionDropdown
// ------------------------------------------------------------
async function populateAttentionDropdown(choicesInstance, filterStatus = null, filterSite = null, allowOverrideSearch = false) {
    try {
        if (!choicesInstance) return;

        // 11.1.5: No-attention statuses should not fetch/prepare approver choices.
        if (typeof imShouldForceAttentionNoneForStatus === 'function' && imShouldForceAttentionNoneForStatus(filterStatus)) {
            imClearAttentionToNone(choicesInstance);
            return;
        }

        // 1. Fetch Data (if missing)
        if (!allApproverData) {
            const snapshot = await db.ref('approvers').once('value');
            allApproverData = snapshot.val();
        }
        const approvers = allApproverData;

        if (approvers) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // --- A. DEFINE RULES ---
            let validPositions = null;
            let checkSite = false;

            if (filterStatus) {
                const statusKey = (filterStatus || '').toString().trim();
                switch (statusKey) {
                    case 'For SRV':
                    case 'No Need SRV':
                        // Batch Entry rule: SRV should only suggest Site DC + Camp Boss (site-matched)
                        validPositions = ['Site DC', 'Camp Boss'];
                        checkSite = true; // Match User Site with PO Site
                        break;
                        
                    case 'IPC Application':
                        // 10.2.3: WorkDesk IPC Application must show the FULL QS/Senior QS list.
                        // Reception may not know the QS name and should not be limited by selected site.
                        validPositions = ['QS', 'Senior QS'];
                        checkSite = false;
                        break;

                    case 'For IPC':
                        // Invoice Management legacy For IPC routing can remain site-matched.
                        validPositions = ['QS', 'Senior QS'];
                        checkSite = true; // Match User Site with PO Site
                        break;
                    
                    // For Approval and any other status should show ALL (no auto-filter)
                    case 'For Approval':
                        validPositions = null;
                        break;
                        
                    case 'CEO Approval':
                        validPositions = ['CEO'];
                        break;

                    case 'In Process':
                        // 11.2.4: In Process should suggest COO first/only.
                        validPositions = ['COO'];
                        break;
                        
                    case 'Report':
                        // Report should suggest Accounts users (GIO first)
                        validPositions = ['Accounts', 'Account'];
                        break;
                        
                    default:
                        validPositions = null; // Everyone suggested
                        break;
                }
            }

            const isReportStatus = (String(filterStatus || '').trim().toLowerCase() === 'report');

            // --- B. PROCESS ALL USERS (Background Data) ---
            const allProcessedUsers = Object.values(approvers).map(approver => {
                if (!approver.Name) return null;

                const position = (approver.Position || '').trim();
                const userSite = (approver.Site || '').trim();

                // Vacation Logic
                const isOnVacation = approver.Vacation === true || approver.Vacation === "Yes";
                let isVacationActive = false;
                if (isOnVacation) {
                    if (!approver.DateReturn) {
                        isVacationActive = true;
                    } else {
                        try {
                            const returnDate = new Date(approver.DateReturn + 'T00:00:00Z');
                            if (!isNaN(returnDate) && returnDate >= today) isVacationActive = true;
                        } catch (e) {}
                    }
                }

                const name = approver.Name || 'No-Name';
                const siteLabel = approver.Site || 'No-Site';
                const newLabel = `${name} - ${position} - ${siteLabel}`;
                const displayLabel = isVacationActive ? `${newLabel} (On Vacation)` : newLabel;

                return {
                    value: approver.Name,
                    label: displayLabel,
                    position: position,
                    site: userSite,
                    customProperties: {
                        onVacation: isVacationActive,
                        returnDate: (approver.DateReturn ? formatYYYYMMDD(String(approver.DateReturn)).toUpperCase() : 'N/A'),
                        replacement: {
                            name: approver.ReplacementName || 'N/A',
                            contact: approver.ReplacementContact || 'N/A',
                            email: approver.ReplacementEmail || 'N/A'
                        }
                    }
                };
            }).filter(Boolean);

            // --- C. CREATE SUGGESTED LIST (Default View) ---
            const suggestedList = allProcessedUsers.filter(user => {
                const _nameUpper = String(user.value || '').trim().toUpperCase();
                if (isReportStatus && _nameUpper === 'GIO') return true;
                if (!validPositions) return true; 

                // Check Position
                const userPos = (user.position || '').toLowerCase();
                const isPosMatch = validPositions.some(role => {
                    const r = (role || '').toLowerCase();
                    const compactPos = userPos.replace(/[.\s_\-\/]+/g, '');
                    const hasQS = (compactPos === 'qs') || compactPos.includes('qs') || userPos.includes('quantity surveyor') || /(^|[^a-z])q\.?\s*s\.?([^a-z]|$)/i.test(user.position || '');

                    if (r === 'admin') return userPos.includes('admin');
                    if (r === 'accounts' || r === 'account') return userPos.includes('account');
                    if (r === 'coo') return userPos.includes('coo') || userPos.includes('chief operating');
                    if (r === 'camp boss') return userPos.includes('camp') && userPos.includes('boss');
                    if (r === 'site dc') return userPos.includes('site') && userPos.includes('dc');

                    // 10.2.2: IPC Application should show all QS/Senior QS users from approvers.
                    // Firebase Position values are not always exactly "QS" or "Senior QS".
                    // Accept common variants such as "Site QS", "Sr. QS", "Senior Q.S",
                    // "Quantity Surveyor", and "Senior Quantity Surveyor".
                    if (r === 'qs') return hasQS;
                    if (r === 'senior qs') return hasQS && (userPos.includes('senior') || userPos.includes('sr'));

                    return userPos === r;
                });
                if (!isPosMatch) return false;

                // Check Site (For SRV & IPC)
                if (checkSite && filterSite) {
            // Match site by ID token (supports values like "181", "181 - Camp", etc.)
            const _siteId = (s) => String(s || '').trim().split(' ')[0].toLowerCase();
            const _siteMatch = (userSite, targetSite) => {
                const u = String(userSite || '').trim();
                const t = String(targetSite || '').trim();
                if (!u || !t) return false;
                const uId = _siteId(u);
                const tId = _siteId(t);
                if (uId && tId && uId === tId) return true;
                // Fallback: substring match either direction
                return u.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(u.toLowerCase());
            };
            if (!_siteMatch(user.site, filterSite)) return false;
        }
                return true;
            });

            // Sort lists
            suggestedList.sort((a, b) => {
                const aIsGIO = String(a.value || '').trim().toUpperCase() === 'GIO';
                const bIsGIO = String(b.value || '').trim().toUpperCase() === 'GIO';
                if (isReportStatus) {
                    if (aIsGIO && !bIsGIO) return -1;
                    if (!aIsGIO && bIsGIO) return 1;
                }
                return a.label.localeCompare(b.label);
            });
            allProcessedUsers.sort((a, b) => a.label.localeCompare(b.label));

            // Base Options
            const baseOptions = [
                { value: '', label: 'Select Attention', disabled: true, selected: true },
                { value: 'None', label: 'None (Clear Selection)' },
                { value: 'All', label: 'All (Send to Records)' }
            ];

            // --- D. INITIAL RENDER ---
            // Keep current selection visible even if it is outside the suggested list (override use-case)
            let selectedExtras = [];
            try {
                let selected = (typeof choicesInstance.getValue === 'function') ? choicesInstance.getValue(true) : null;
                if (selected && !Array.isArray(selected)) selected = [selected];
                if (Array.isArray(selected)) {
                    const suggestedValues = new Set(suggestedList.map(u => u.value));
                    const added = new Set();
                    selected.map(v => (v || '').toString().trim()).filter(v => v && v !== 'All' && v !== 'None').forEach(val => {
                        if (suggestedValues.has(val) || added.has(val)) return;
                        const found = allProcessedUsers.find(u => u.value === val);
                        if (found) {
                            selectedExtras.push({ value: found.value, label: found.label });
                        } else {
                            selectedExtras.push({ value: val, label: val });
                        }
                        added.add(val);
                    });
                }
            } catch (e) {}

            const initialChoices = [...baseOptions, ...selectedExtras, ...suggestedList];
            try {
                if (typeof choicesInstance.clearStore === 'function') {
                    choicesInstance.clearStore();
                } else {
                    choicesInstance.clearChoices();
                }
            } catch (_) {
                try { choicesInstance.clearChoices(); } catch (__) {}
            }
            choicesInstance.setChoices(initialChoices, 'value', 'label', true);

            // --- E. OVERRIDE SEARCH (Batch Entry Use-Case) ---
            // By default we keep Choices' own search behavior (search within the current suggested list).
            // When allowOverrideSearch = true, typing will search across ALL approvers (even if they don't match the auto-filter),
            // so you can select a temporary replacement without editing approver-site mappings.
            if (allowOverrideSearch && choicesInstance.passedElement && choicesInstance.passedElement.element) {
                const element = choicesInstance.passedElement.element;
                const outerEl = (choicesInstance.containerOuter && choicesInstance.containerOuter.element) ? choicesInstance.containerOuter.element : null;
                const _safeAddEvt = (t, evt, fn) => { try { if (t && typeof t.addEventListener === 'function') t.addEventListener(evt, fn); } catch (e) {} };
                const _safeRmEvt  = (t, evt, fn) => { try { if (t && typeof t.removeEventListener === 'function' && fn) t.removeEventListener(evt, fn); } catch (e) {} };


                // Helper: apply query safely without spamming re-renders
                const applySmartQuery = (rawQuery) => {
                    const query = (rawQuery || '').toString().toLowerCase().trim();
                    if (query === element._lastSmartQuery) return;
                    element._lastSmartQuery = query;

                    if (query.length > 0) {
                        const matches = allProcessedUsers.filter(u => (u.label || '').toLowerCase().includes(query));
                        // Keep base options + matches (full override search)
                        choicesInstance.setChoices([...baseOptions, ...matches], 'value', 'label', true);
                    } else {
                        // Reset to the default suggested list (plus any selected extras)
                        choicesInstance.setChoices(initialChoices, 'value', 'label', true);
                    }
                };

                // Cleanup any old listeners (avoid duplicates on repeated calls)
                _safeRmEvt(element,  'search',       element._smartSearchHandler);
                _safeRmEvt(outerEl,  'search',       element._smartSearchHandler);
                _safeRmEvt(element,  'hideDropdown', element._smartHideHandler);
                _safeRmEvt(outerEl,  'hideDropdown', element._smartHideHandler);
                _safeRmEvt(element,  'showDropdown', element._smartShowHandler);
                _safeRmEvt(outerEl,  'showDropdown', element._smartShowHandler);
if (element._smartSearchInputEl && element._smartSearchInputHandler) {
                    try { element._smartSearchInputEl.removeEventListener('input', element._smartSearchInputHandler); } catch (e) {}
                }

                // 1) Choices 'search' event (when supported)
                element._smartSearchHandler = function (event) {
                    const q = (event && event.detail && typeof event.detail.value !== 'undefined') ? event.detail.value : '';
                    applySmartQuery(q);
                };
                _safeAddEvt(element, 'search', element._smartSearchHandler);
                _safeAddEvt(outerEl, 'search', element._smartSearchHandler);

                // 2) Direct input listener (more reliable across versions)
                element._smartSearchInputHandler = function (e) {
                    const q = e && e.target ? e.target.value : '';
                    applySmartQuery(q);
                };

                const attachInputListener = () => {
                    try {
                        const outer = choicesInstance.containerOuter && choicesInstance.containerOuter.element;
                        if (!outer) return;
                        const inputEl = outer.querySelector('input.choices__input--cloned, input.choices__input');
                        if (!inputEl) return;
                        if (element._smartSearchInputEl && element._smartSearchInputHandler) {
                            try { element._smartSearchInputEl.removeEventListener('input', element._smartSearchInputHandler); } catch (e) {}
                        }
                        element._smartSearchInputEl = inputEl;
                        inputEl.addEventListener('input', element._smartSearchInputHandler);
                    } catch (e) {}
                };

                // Attach now + whenever dropdown opens
                element._smartShowHandler = function () { attachInputListener(); };
                _safeAddEvt(element, 'showDropdown', element._smartShowHandler);
                _safeAddEvt(outerEl, 'showDropdown', element._smartShowHandler);
                attachInputListener();

                // Reset list when dropdown closes (keeps system "default strict suggestions" next time)
                element._smartHideHandler = function () {
                    // Clear the search box if we can find it
                    try {
                        if (element._smartSearchInputEl) element._smartSearchInputEl.value = '';
                    } catch (e) {}
                    element._lastSmartQuery = '';
                    applySmartQuery('');
                };
                _safeAddEvt(element, 'hideDropdown', element._smartHideHandler);
                _safeAddEvt(outerEl, 'hideDropdown', element._smartHideHandler);
            }

        } else {
            choicesInstance.setChoices([{ value: '', label: 'No approvers found', disabled: true }]);
        }
    } catch (error) {
        console.error("Error populating attention:", error);
    }
}
