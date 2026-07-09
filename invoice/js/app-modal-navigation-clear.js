// =================================================================================================
// IBA App - Modal / Navigation / Clear Button Listeners
// Version: 8.2.1
// Moved from app.js in v8.2.1 (cleanup only).
// Behavior preserved: inventory launcher, dashboard back cleanup, invoice modal navigation,
// invoice value sync, desktop manager finalize listener, Job Records clear, Active Task clear.
// =================================================================================================

(function () {
'use strict';

// =================================================================================================
// #region BLOCK 26 — INVENTORY BUTTON + MODAL LISTENERS + CLEAR LOGIC
// Purpose: Inventory mode button, back/dashboard cleanup, invoice modal navigation, value sync, job records clear.
// =================================================================================================

// NEW: INVENTORY BUTTON LOGIC (SAFE MODE)
// =========================================================
const inventoryButton = document.getElementById('inventory-button');

// 1. Handle "Inventory" Click
if (inventoryButton) {
    inventoryButton.addEventListener('click', async () => {
        // 7.3.6: Mobile is now supported. Inventory no longer redirects to normal WorkDesk.
        if (!currentApprover) { handleLogout(); return; }

        // --- 2. IMMEDIATE UI SWITCH (THE FIX) ---
        // A. Enter Inventory Mode styling and routing
        document.body.classList.add('inventory-mode');
        try { window.__ibaActiveModule = 'inventory'; } catch (_) {}
        try { if (typeof syncMobileModuleSwitchers === 'function') syncMobileModuleSwitchers('inventory'); } catch (_) {}
        if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('inventory');
        if (typeof updateActiveTaskModuleBadges === 'function') {
            updateActiveTaskModuleBadges(0, 0, 'inventory');
        }
        if (typeof clearMobileActiveTaskCards === 'function') clearMobileActiveTaskCards();
        if (typeof forceInventoryMobileActiveTaskShell === 'function') forceInventoryMobileActiveTaskShell();

        // B. Update Sidebar Text
        const wdUser = document.getElementById('wd-username');
        const wdId = document.getElementById('wd-user-identifier');
        if(wdUser) wdUser.textContent = currentApprover.Name;
        if(wdId) wdId.textContent = "Inventory Access";

        // C. PRE-EMPTIVE SECTION SWAP (Crucial Step)
        // 7.3.8: On mobile, Inventory should open the Inventory Active Task screen
        // because Material Stock and Reporting tabs are intentionally hidden there.
        const inventoryDefaultSection = (typeof isMobileViewport === 'function' && isMobileViewport())
            ? 'wd-activetask'
            : 'wd-material-stock';

        document.querySelectorAll('.workdesk-section').forEach(el => el.classList.add('hidden'));
        const defaultInventorySectionEl = document.getElementById(inventoryDefaultSection);
        if (defaultInventorySectionEl) defaultInventorySectionEl.classList.remove('hidden');

        // D. Update Active Nav Link Visually
        document.querySelectorAll('#workdesk-nav a').forEach(el => el.classList.remove('active'));
        const defaultInventoryLink = document.querySelector(`a[data-section="${inventoryDefaultSection}"]`);
        if (defaultInventoryLink) defaultInventoryLink.classList.add('active');

        // E. Show the Main View
        showView('workdesk');
        if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('inventory');

        // --- 3. LOAD DATA (Happens while user sees the empty Inventory screen) ---
        console.log("Loading Inventory Data...");
        
        // Show a loading state in the Material Stock table only when the desktop/default
        // section is Material Stock.
        const stockTableBody = document.getElementById('ms-table-body');
        if(inventoryDefaultSection === 'wd-material-stock' && stockTableBody) stockTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Loading Inventory Data...</td></tr>';

        if (typeof ensureInvoiceDataFetched === 'function') await ensureInvoiceDataFetched(false); 
        if (typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(false);
        if (typeof ensureApproverDataCached === 'function') await ensureApproverDataCached();

        if (typeof populateSiteDropdown === 'function') await populateSiteDropdown();
        
        if (!attentionSelectChoices) {
             const dummyEl = document.createElement('select');
             const tempChoices = new Choices(dummyEl);
             if (typeof populateAttentionDropdown === 'function') await populateAttentionDropdown(tempChoices);
        } else {
             if (typeof populateAttentionDropdown === 'function') await populateAttentionDropdown(attentionSelectChoices);
        }

        // --- 4. POPULATE THE TABLE ---
        // Now that data is ready, run the logic to fill the table
        const itemFinderStillActive = String(window.__ibaInventoryMobileSection || '').toLowerCase() === 'item-search';
        if (typeof showWorkdeskSection === 'function' && !itemFinderStillActive) {
            // Desktop opens Material Stock; mobile opens Inventory Active Task.
            await showWorkdeskSection(inventoryDefaultSection);
        }
        if (!itemFinderStillActive && typeof forceInventoryMobileActiveTaskShell === 'function') forceInventoryMobileActiveTaskShell();
        if (typeof enforceInventoryMobileNavVisibility === 'function') enforceInventoryMobileNavVisibility();
        if (typeof refreshInventoryTaskBadgeOnly === 'function') {
            await refreshInventoryTaskBadgeOnly();
        }
    });
}

// 2. Handle "Back to Dashboard" (Cleanup)
document.querySelectorAll('.back-to-main-dashboard').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault(); // Stop default jump
        
        // Remove the special class so WorkDesk goes back to normal next time
        document.body.classList.remove('inventory-mode');
        try { window.__ibaActiveModule = 'home'; } catch (_) {}
        if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('workdesk');
        try { window.__ibaActiveModule = 'home'; } catch (_) {}
        
        // Return to dashboard
        showView('dashboard');
    });
});

// 3. Handle Logout (Cleanup)
const mainLogout = document.getElementById('wd-logout-button');
if(mainLogout) {
    mainLogout.addEventListener('click', () => {
        document.body.classList.remove('inventory-mode');
        try { window.__ibaActiveModule = 'home'; } catch (_) {}
        handleLogout();
    });
}

// --- Invoice Modal Navigation Listeners ---
const imNavPrev = document.getElementById('im-nav-prev');
const imNavNext = document.getElementById('im-nav-next');

if (imNavPrev) {
    imNavPrev.addEventListener('click', (e) => {
        e.preventDefault(); 
        
        // CASE 1: We are on "New Entry" (index == length)
        // Click Prev -> Go to last item
        if (imNavigationIndex === imNavigationList.length) {
            const lastKey = imNavigationList[imNavigationList.length - 1];
            populateInvoiceFormForEditing(lastKey);
        }
        // CASE 2: We are in the middle of the list
        // Click Prev -> Go to previous item
        else if (imNavigationIndex > 0) {
            const prevKey = imNavigationList[imNavigationIndex - 1];
            populateInvoiceFormForEditing(prevKey);
        }
    });
}

if (imNavNext) {
    imNavNext.addEventListener('click', (e) => {
        e.preventDefault(); 
        
        // CASE 1: Normal Next
        if (imNavigationIndex < imNavigationList.length - 1) {
            const nextKey = imNavigationList[imNavigationIndex + 1];
            populateInvoiceFormForEditing(nextKey);
        }
        // CASE 2: We are on the LAST existing item
        // Click Next -> Go to "New Entry"
        else if (imNavigationIndex === imNavigationList.length - 1) {
            resetInvoiceForm();
        }
    });
}

// --- SMART AUTO-FILL LOGIC (Value <-> Paid) ---
    if (imInvValueInput && imAmountPaidInput) {
        
        // 1. Typing in "Invoice Value" copies to "Amount Paid"
        imInvValueInput.addEventListener('input', () => {
            const val = imInvValueInput.value;
            if (val.trim() !== "") {
                imAmountPaidInput.value = val;
            }
        });

        // 2. Typing in "Amount Paid" FIRST sets "Invoice Value" to 0
        imAmountPaidInput.addEventListener('input', () => {
            // Only set to 0 if Invoice Value is currently empty
            // This prevents accidental wiping of existing values
            if (imInvValueInput.value.trim() === "") {
                imInvValueInput.value = "0";
            }
        });
    }

// Desktop Manager Finalize Button Listener
    const desktopMgrBtn = document.getElementById('desktop-finalize-btn');
    if (desktopMgrBtn) {
        // Remove any existing listener just in case, then add the new one
        const newBtn = desktopMgrBtn.cloneNode(true);
        desktopMgrBtn.parentNode.replaceChild(newBtn, desktopMgrBtn);
        newBtn.addEventListener('click', previewAndSendManagerReceipt);
    }

// --- JOB RECORDS CLEAR BUTTON LOGIC (WIPE CLEAN) ---
    const jobRecordsClearBtn = document.getElementById('reporting-clear-button');
    const jobRecordsInput = document.getElementById('reporting-search');
    const jobRecordsBody = document.getElementById('reporting-table-body');
    const jobRecordsCount = document.getElementById('reporting-count-display');
    const jobRecordsHeroCount = document.getElementById('job-records-count-display');

    if (jobRecordsClearBtn) {
        jobRecordsClearBtn.addEventListener('click', () => {
            // 1. Clear Input
            if (jobRecordsInput) {
                jobRecordsInput.value = '';
                jobRecordsInput.focus();
            }

            // 2. Clear Memory
            sessionStorage.removeItem('reportingSearch');

            // 10.9.9: WorkDesk Job Records Clear must also remove the selected/highlighted tab.
            // Scope this to WorkDesk records so the shared Inventory records behavior is not changed.
            const isInventoryRecords = (typeof isInventoryContext === 'function' && isInventoryContext()) ||
                !!(document.body && document.body.classList.contains('inventory-mode')) ||
                String(window.__ibaActiveModule || '').toLowerCase() === 'inventory';

            if (!isInventoryRecords) {
                if (typeof wdReportMarkManualTabFilter === 'function') {
                    wdReportMarkManualTabFilter(false);
                } else {
                    try { window.__wdReportManualTabFilter = false; } catch (_) {}
                }

                if (typeof wdReportSetActiveTab === 'function') {
                    wdReportSetActiveTab(null);
                } else {
                    currentReportFilter = null;
                    document.querySelectorAll('#report-tabs button').forEach(b => b.classList.remove('active'));
                }
            }

            // 3. WIPE TABLE CLEAN
            if (jobRecordsBody) {
                const message = isInventoryRecords
                    ? 'List cleared. Select a Category above to view records.'
                    : 'List cleared. Select a Job Records tab, or type a search to search all tabs.';
                jobRecordsBody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:30px; color:#888;">${message}</td></tr>`;
            }

            // 4. Reset Count
            if (jobRecordsCount) {
                jobRecordsCount.textContent = '';
            }
            if (jobRecordsHeroCount) {
                jobRecordsHeroCount.textContent = '';
            }
            if (typeof wdUiUpdateMiniMetrics === 'function' && !((typeof isInventoryContext === 'function' && isInventoryContext()))) {
                wdUiUpdateMiniMetrics('job-records-summary-strip', [], 'Job Records');
            }

            // We DO NOT call handleReportingSearch() here, because that would reload data.
        });
    }

    // --- ACTIVE TASK CLEAR BUTTON LOGIC (WIPE CLEAN) ---
    const activeTaskClearBtn = document.getElementById('active-task-clear-button');
    const activeTaskInput = document.getElementById('active-task-search');
    const activeTaskBody = document.getElementById('active-task-table-body');
    // Note: activeTaskCountDisplay usually shows TOTAL tasks in the pool, not just visible ones. 
    // If you want to hide that too, uncomment the reset line below.

    if (activeTaskClearBtn) {
        activeTaskClearBtn.addEventListener('click', () => {
            // 1. Clear Input
            if (activeTaskInput) {
                activeTaskInput.value = '';
            }

            // 2. Clear Memory
            sessionStorage.removeItem('activeTaskSearch');

            // 3. WIPE TABLE CLEAN
            if (activeTaskBody) {
                activeTaskBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px; color:#888;">List cleared. Click a Status Tab above to view tasks.</td></tr>';
            }
            
            // Optional: Un-highlight tabs so user knows they need to click one
            const activeFilters = document.getElementById('active-task-filters');
            if (activeFilters) {
                activeFilters.querySelectorAll('.active').forEach(btn => btn.classList.remove('active'));
            }
        });
    }


// #endregion BLOCK 26 — INVENTORY BUTTON + MODAL LISTENERS + CLEAR LOGIC

})();
