// ==========================================================================
// UPDATED: populateAttentionDropdown (Manual Filter Simulation)
// Logic: 1. Default -> Shows ONLY Suggested Users.
//        2. Typing  -> Shows ONLY exact name matches (Clean & Fast).
// ==========================================================================
async function populateAttentionDropdown(choicesInstance, filterStatus = null, filterSite = null, allowOverrideSearch = false) {
    try {
        if (!choicesInstance) return;

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
                        
                    case 'For IPC':  // <--- ADDED THIS NEW RULE
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
                        
                    case 'Report':
                        // Report should suggest Admin users only
                        validPositions = ['Admin'];
                        break;
                        
                    default:
                        validPositions = null; // Everyone suggested
                        break;
                }
            }

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
                if (!validPositions) return true; 

                // Check Position
                const userPos = (user.position || '').toLowerCase();
                const isPosMatch = validPositions.some(role => {
                    const r = (role || '').toLowerCase();
                    if (r === 'admin') return userPos.includes('admin');
                    if (r === 'camp boss') return userPos.includes('camp') && userPos.includes('boss');
                    if (r === 'site dc') return userPos.includes('site') && userPos.includes('dc');
                    return userPos === r;
                });
                if (!isPosMatch) return false;

                // Check Site (For SRV & IPC)
                if (checkSite && filterSite) {
                    if (!user.site.includes(filterSite)) return false;
                }
                return true;
            });

            // Sort lists
            suggestedList.sort((a, b) => a.label.localeCompare(b.label));
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
            choicesInstance.clearChoices();
            choicesInstance.setChoices(initialChoices, 'value', 'label', true);

            // --- E. OVERRIDE SEARCH (Batch Entry Use-Case) ---
            // By default we keep Choices' own search behavior (search within the current suggested list).
            // When allowOverrideSearch = true, typing will search across ALL approvers (even if they don't match the auto-filter),
            // so you can select a temporary replacement without editing approver-site mappings.
            if (allowOverrideSearch && choicesInstance.passedElement && choicesInstance.passedElement.element) {
                const element = choicesInstance.passedElement.element;

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
                if (element._smartSearchHandler) element.removeEventListener('search', element._smartSearchHandler);
                if (element._smartHideHandler) element.removeEventListener('hideDropdown', element._smartHideHandler);
                if (element._smartShowHandler) element.removeEventListener('showDropdown', element._smartShowHandler);
                if (element._smartSearchInputEl && element._smartSearchInputHandler) {
                    try { element._smartSearchInputEl.removeEventListener('input', element._smartSearchInputHandler); } catch (e) {}
                }

                // 1) Choices 'search' event (when supported)
                element._smartSearchHandler = function (event) {
                    const q = (event && event.detail && typeof event.detail.value !== 'undefined') ? event.detail.value : '';
                    applySmartQuery(q);
                };
                element.addEventListener('search', element._smartSearchHandler);

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
                element.addEventListener('showDropdown', element._smartShowHandler);
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
                element.addEventListener('hideDropdown', element._smartHideHandler);
	        }

        } else {
            choicesInstance.setChoices([{ value: '', label: 'No approvers found', disabled: true }]);
        }
    } catch (error) {
        console.error("Error populating attention:", error);
    }
}

// --- Helper: Populate Job Types Dynamically ---
