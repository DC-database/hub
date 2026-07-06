// js/app-navigation-settings.js
// Extracted from app.js in v8.3.1 (cleanup only).
// Keeps navigation, login/session routing, logout, and user settings helpers globally available.

// #region BLOCK 09 — VIEW SWITCHING, LOGIN + SESSION INITIALIZATION
// Purpose: showView, approver lookup, successful-login routing, permissions visibility, deep-link boot logic.
// =================================================================================================

// ==========================================================================
// 6. VIEW NAVIGATION & AUTHENTICATION
// ==========================================================================

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
    const isEmail = identifier.includes('@');
    const searchKey = isEmail ? 'Email' : 'Mobile';
    const searchValue = isEmail ? identifier : normalizeMobile(identifier);

    // Cache check
    if (!allApproverData) {
        console.log("Caching approvers list for the first time...");
        const snapshot = await db.ref('approvers').once('value');
        allApproverData = snapshot.val();
    }
    const approversData = allApproverData;

    if (!approversData) return null;
    for (const key in approversData) {
        const record = approversData[key];
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
        const snapshot = await db.ref(`approvers/${key}`).once('value');
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

// 9.5.1: Centralized Welcome Screen module permissions with hard restricted-button enforcement.
// Financial Report and PO System must never appear for Logistics/Admin or normal users.
// Default rule:
// - Everyone logged in: WorkDesk, Invoice Management, Inventory, Requisition
// - Financial Report: Super Admin, or Admin with finance/accounts/accounting/CEO/COO position only
// - PO System: Super Admin only
function normalizeWelcomeRoleText(value) {
    return String(value || '').trim().toLowerCase();
}

function getWelcomePermissionState() {
    const user = currentApprover || window.currentApprover || window.currentUser || null;
    const hasUser = !!(user && (
        user.key || user.Name || user.username || user.name || user.Role || user.role || user.Position || user.position
    ));

    const nameLower = normalizeWelcomeRoleText(user?.Name || user?.username || user?.name);
    const roleLower = normalizeWelcomeRoleText(user?.Role || user?.role);
    const posLower = normalizeWelcomeRoleText(user?.Position || user?.position);

    const superName = (typeof SUPER_ADMIN_NAME !== 'undefined') ? String(SUPER_ADMIN_NAME || '') : 'Irwin';
    const isSuperAdmin = hasUser && nameLower === normalizeWelcomeRoleText(superName);
    const isAdminRole = roleLower === 'admin';

    // 9.5.1: strict finance permission.
    // Logistics / Logistic Admin / Coordinator must NOT match CEO/COO/Finance by substring.
    const financeTokens = posLower.split(/[^a-z0-9]+/).filter(Boolean);
    const hasFinancePosition =
        financeTokens.includes('ceo') ||
        financeTokens.includes('coo') ||
        financeTokens.includes('finance') ||
        financeTokens.includes('accounts') ||
        financeTokens.includes('accounting');

    return {
        canCoreModules: hasUser,
        canFinancialReport: !!(isSuperAdmin || (isAdminRole && hasFinancePosition)),
        canPOSystem: !!isSuperAdmin
    };
}

function setWelcomeModuleVisibility(id, canShow, fallbackSelector = null) {
    const el = document.getElementById(id) || (fallbackSelector ? document.querySelector(fallbackSelector) : null);
    if (!el) return;

    el.classList.toggle('hidden', !canShow);
    el.style.setProperty('display', canShow ? '' : 'none', 'important');
    el.setAttribute('aria-hidden', canShow ? 'false' : 'true');

    if (canShow) {
        el.removeAttribute('tabindex');
        if (el.dataset.originalHref) {
            el.setAttribute('href', el.dataset.originalHref);
        }
    } else {
        el.setAttribute('tabindex', '-1');
        if (el.tagName === 'A') {
            if (!el.dataset.originalHref && el.getAttribute('href')) {
                el.dataset.originalHref = el.getAttribute('href');
            }
            el.removeAttribute('href');
        }
    }
}

function applyWelcomeModulePermissions() {
    const permission = getWelcomePermissionState();

    // 9.5.1: body classes drive the hard CSS guard in index.html.
    // Without these classes, restricted buttons stay hidden even if another script resets element classes.
    if (document.body) {
        document.body.classList.toggle('iba-can-see-financial-report', !!permission.canFinancialReport);
        document.body.classList.toggle('iba-can-see-po-system', !!permission.canPOSystem);
    }

    // Default visible modules for every logged-in user.
    setWelcomeModuleVisibility('workdesk-button', permission.canCoreModules);
    setWelcomeModuleVisibility('invoice-mgmt-button', permission.canCoreModules);
    setWelcomeModuleVisibility('inventory-button', permission.canCoreModules);
    setWelcomeModuleVisibility('requisition-button', permission.canCoreModules);

    // Restricted modules: never based on Admin alone.
    setWelcomeModuleVisibility(
        'finance-report-button',
        permission.canFinancialReport,
        'a[href="https://ibaport.site/Finance/"], a[data-original-href="https://ibaport.site/Finance/"]'
    );
    setWelcomeModuleVisibility(
        'po-system-button',
        permission.canPOSystem,
        'a[href="https://ibaport.site/PO/"], a[data-original-href="https://ibaport.site/PO/"]'
    );
}

function installWelcomeRestrictedButtonGuard() {
    const guard = function (e) {
        const financeBtn = e.target.closest && e.target.closest('#finance-report-button');
        const poBtn = e.target.closest && e.target.closest('#po-system-button');
        if (!financeBtn && !poBtn) return;

        const permission = getWelcomePermissionState();
        if ((financeBtn && !permission.canFinancialReport) || (poBtn && !permission.canPOSystem)) {
            e.preventDefault();
            e.stopPropagation();
            applyWelcomeModulePermissions();
            alert('Access Denied: This module is restricted.');
        }
    };

    document.addEventListener('click', guard, true);

    // Re-enforce after any UI refresh/class reset.
    const enforce = () => {
        try { applyWelcomeModulePermissions(); } catch (_) {}
    };
    document.addEventListener('DOMContentLoaded', enforce);
    window.addEventListener('load', enforce);
    setTimeout(enforce, 100);
    setTimeout(enforce, 300);
    setTimeout(enforce, 1000);
    setTimeout(enforce, 2000);
}

installWelcomeRestrictedButtonGuard();
try { window.applyWelcomeModulePermissions = applyWelcomeModulePermissions; } catch (_) {}

function handleSuccessfulLogin() {
    if (currentApprover && currentApprover.key) {
        localStorage.setItem('approverKey', currentApprover.key);

        // Keep a lightweight global user object for modules that rely on window.currentUser
        try {
            window.currentUser = {
                username: (currentApprover?.Name || '').trim(),
                Name: (currentApprover?.Name || '').trim(),
                Position: currentApprover?.Position || '',
                Role: currentApprover?.Role || '',
                Mobile: currentApprover?.Mobile || '',
                Email: currentApprover?.Email || '',
                Site: currentApprover?.Site || '',
                site: currentApprover?.Site || ''
            };
        } catch (e) { /* ignore */ }
    } else {
        console.error("Attempted to save login state but currentApprover or key is missing.");
        handleLogout();
        return;
    }

    // Check for CEO Admin role
    const isCEO = (currentApprover?.Role || '').toLowerCase() === 'admin' &&
        (currentApprover?.Position || '').toLowerCase() === 'ceo';
    document.body.classList.toggle('is-ceo', isCEO);

    // 7.3.6: Mobile should also be able to see the Welcome/module screen after login.
    // Direct module links such as ?mode=inventory are handled below after permissions are applied.
    const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
    try { window.__ibaActiveModule = 'home'; } catch (_) {}
    if (document.body) document.body.classList.remove('inventory-mode');

    // 9.5.1: apply module visibility before showing the Welcome screen.
    // This prevents normal/site users from seeing restricted buttons.
    applyWelcomeModulePermissions();
    showView('dashboard');

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    document.body.classList.toggle('is-admin', isAdmin);

    // --- Vacation delegation requires approver cache for replacement logic. ---
    // 9.5.1: after the cache finishes, re-apply the same centralized Welcome permissions
    // instead of using old Invoice Management-only visibility rules.
    if (!allApproverDataCache) {
        ensureApproverDataCached().then(() => {
            const _isVacationDelegate = isVacationDelegateUser();
            document.body.classList.toggle('is-vacation-delegate', _isVacationDelegate);
            applyWelcomeModulePermissions();
        }).catch((e) => console.warn('Approver cache preload failed:', e));
    }


    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    const isAccounting = userPositionLower === 'accounting';
    const isAccounts = userPositionLower === 'accounts';
    const isVacationDelegate = isVacationDelegateUser();
    document.body.classList.toggle('is-vacation-delegate', isVacationDelegate);


    // 9.5.1: enforce final Welcome Screen role visibility.
    // Normal/site users see only WorkDesk, Invoice Management, Inventory, and Requisition.
    // Financial Report is restricted; PO System is Super Admin only.
    applyWelcomeModulePermissions();

// [START] Auto-Open Inventory Mode
    // Supports direct Inventory links from the main IBA landing page:
    //   /invoice/?mode=inventory, ?open=inventory, ?module=inventory, or #inventory
    const directInventoryOpen = (typeof isDirectInventoryOpenRequested === 'function') && isDirectInventoryOpenRequested();

    if (directInventoryOpen) {
        console.log("Inventory direct-open detected. Opening Inventory module...");
        setTimeout(() => {
            const invBtn = document.getElementById('inventory-button');
            if (invBtn) invBtn.click();
        }, 250);
    }
    // [END] Auto-Open Inventory Mode

    // Smart Sync / Smart Refresh removed (no background auto-sync).

    // --- Celebration Banner (configurable; optional) ---
    // Safe to call on both mobile + desktop.
    try {
        showCelebrationBannerIfNeeded();
    } catch (e) {
        console.log('Celebration banner failed:', e);
    }

    // --- Direct Messages (1:1) ---
    // Works across WorkDesk + Invoice Management + Inventory.
    try {
        initDirectMessages();
    } catch (e) {
        console.warn('Direct messages init failed:', e);
    }

    // --- Deep Link: open a specific invoice (shared via WhatsApp / URL) ---
    // Safe optional feature: only run when the deep-link helpers are present.
    // 10.6.2: avoid console "not defined" noise when deep-link modules are not loaded.
    if (
        typeof imParseInvoiceDeepLinkFromUrl === 'function' &&
        typeof imClearInvoiceDeepLinkFromUrl === 'function' &&
        typeof imOpenInvoiceFromDeepLink === 'function'
    ) {
        try {
            const dl = imParseInvoiceDeepLinkFromUrl();
            if (dl && dl.po && dl.invKey) {
                // Prevent repeated opens on refresh/back
                imClearInvoiceDeepLinkFromUrl();
                // Give UI a moment to finish view rendering
                setTimeout(() => {
                    imOpenInvoiceFromDeepLink(dl.po, dl.invKey);
                }, 700);
            }
        } catch (e) {
            console.warn('Invoice deep link open skipped:', e);
        }
    }



    // --- Deep Link: open Workdesk Active Task for a specific invoice task ---
    // URL: ?open=wdtask&po=...&invKey=...
    // 10.6.2: avoid console "not defined" noise when deep-link modules are not loaded.
    if (
        typeof wdParseActiveTaskDeepLinkFromUrl === 'function' &&
        typeof wdClearActiveTaskDeepLinkFromUrl === 'function' &&
        typeof wdOpenActiveTaskFromDeepLink === 'function'
    ) {
        try {
            const wdl = wdParseActiveTaskDeepLinkFromUrl();
            if (wdl && wdl.po && wdl.invKey) {
                wdClearActiveTaskDeepLinkFromUrl();
                setTimeout(() => {
                    wdOpenActiveTaskFromDeepLink(wdl.po, wdl.invKey);
                }, 700);
            }
        } catch (e) {
            console.warn('WorkDesk active-task deep link open skipped:', e);
        }
    }
}


// #endregion BLOCK 09 — VIEW SWITCHING, LOGIN + SESSION INITIALIZATION


// #region BLOCK 11 — MAIN NAVIGATION + SETTINGS
// Purpose: Logout, WorkDesk section switching, Invoice Management section switching, user/settings forms, celebration settings save.
// =================================================================================================

function handleLogout() {
    // Live chat cleanup

    // Direct messages cleanup
    try { shutdownDirectMessages(); } catch (e) { /* ignore */ }

    // Smart Sync / Smart Refresh removed (no background listeners).

    localStorage.removeItem('approverKey');

    try { window.currentUser = null; } catch (e) { /* ignore */ }

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
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }


    // Inventory In-Transit report button is only relevant in Inventory context (desktop)
    if (typeof updateInTransitReportButtonVisibility === 'function') {
        updateInTransitReportButtonVisibility();
    }

    // 3. Section-Specific Logic
    if (sectionId === 'wd-dashboard') {
        // 8.3.6: WorkDesk Dashboard is now an open invoice task control center.
        // Calendar/date sorting was retired from this dashboard view.
        await populateWorkdeskDashboard();
    }

    if (sectionId === 'wd-jobentry') {
        if (!currentlyEditingKey) {
            resetJobEntryForm(false);
        }
        const savedSearch = sessionStorage.getItem('jobEntrySearch');
        if (savedSearch) {
            jobEntrySearchInput.value = savedSearch;
        }
        await handleJobEntrySearch(jobEntrySearchInput.value);
    }

    if (sectionId === 'wd-activetask') {
        await populateActiveTasks();

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
        // 10.3.3: WorkDesk Job Records is Admin/Super Admin only and lazy-loaded.
        // Opening this tab should show the shell only; data loads after tab click/search.
        const canOpenRecords = (typeof wdReportCanOpenCurrentRecords === 'function')
            ? wdReportCanOpenCurrentRecords()
            : true;
        if (!canOpenRecords) {
            alert('Job Records is Admin only. Your WorkDesk is limited to tasks addressed to you.');
            document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
            const dashLink = document.querySelector('#workdesk-nav a[data-section="wd-dashboard"]');
            if (dashLink) dashLink.classList.add('active');
            sectionId = 'wd-dashboard';
            const dashboardSection = document.getElementById('wd-dashboard');
            const reportingSection = document.getElementById('wd-reporting');
            if (reportingSection) reportingSection.classList.add('hidden');
            if (dashboardSection) dashboardSection.classList.remove('hidden');
            await populateWorkdeskDashboard();
            return;
        }

        currentReportFilter = null;
        try { sessionStorage.removeItem('reportingSearch'); } catch (_) {}

        if (reportingSearchInput) {
            reportingSearchInput.value = '';
        }
        await handleReportingSearch({ userAction: false, reason: 'open' });
    }

    // --- NEW: Material Stock Logic ---
    if (sectionId === 'wd-material-stock') {
        // Inventory Material Stock is still shown inside the WorkDesk shell,
        // so refresh the Inventory badge with inventory-only tasks here.
        // This clears stale WorkDesk/Invoice task counts before the user opens Active Task.
        if (typeof isInventoryContext === 'function' && isInventoryContext() && typeof refreshInventoryTaskBadgeOnly === 'function') {
            await refreshInventoryTaskBadgeOnly();
        }

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
function showIMSection(sectionId) {
    // 1. Get User Credentials
    const userPos = (currentApprover?.Position || '').trim();
    const userRole = (currentApprover?.Role || '').toLowerCase();
    const userName = (currentApprover?.Name || '').trim().toLowerCase();

    // 2. Define Permission Flags (10.4.1 Invoice Management only)
    const isAdmin = userRole === 'admin';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const isSuperAdmin = userName === String(SUPER_ADMIN_NAME || '').trim().toLowerCase();
    const canAccessInvoiceWrite = isSuperAdmin;
    const canAccessSummaryNote = isSuperAdmin;
    const canAccessInvoiceRecords = isAdmin || isSuperAdmin || isVacationDelegate;
    const canAccessPayments = false; // 10.4.1: Payments is disabled/dead for now.

    // 3. Strict Access Control Checks
    if ((sectionId === 'im-invoice-entry' || sectionId === 'im-batch-entry') && !canAccessInvoiceWrite) {
        alert('Access Denied: Invoice Entry and Batch Entry are Super Admin only.');
        return;
    }
    if (sectionId === 'im-summary-note' && !canAccessSummaryNote) {
        alert('Access Denied: Summary Note is Super Admin only.');
        return;
    }
    if (sectionId === 'im-reporting' && !canAccessInvoiceRecords) {
        alert('Access Denied: Invoice Records is Admin only.');
        return;
    }

    if (sectionId === 'im-payments') {
        alert('Payments is currently disabled.');
        return;
    }


    // 4. Show/Hide Views
    imContentArea.querySelectorAll('.workdesk-section').forEach(section => section.classList.add('hidden'));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.remove('hidden');

    // 5. Sidebar Handling
    if (sectionId === 'im-invoice-entry') {
        // 10.4.5: Invoice Entry Active Jobs should be visible every time the user
        // returns to Invoice Entry. Do not leave the panel in a standby/cleared state
        // while the cache says it is already loaded.
        if (imEntrySidebar) {
            imEntrySidebar.classList.remove('hidden');
            imEntrySidebar.classList.add('visible');
        }
        if (imMainElement) imMainElement.classList.add('with-sidebar');
        if (typeof imEnsureActiveJobsSidebarVisibleAndLoaded === 'function') {
            setTimeout(() => imEnsureActiveJobsSidebarVisibleAndLoaded(true), 150);
        } else if (typeof populateActiveJobsSidebar === 'function') {
            setTimeout(() => populateActiveJobsSidebar(true), 150);
        } else if (typeof setActiveJobsSidebarStandby === 'function') {
            setActiveJobsSidebarStandby('Loading active invoice job entries...');
        }
        if (typeof loadInvoiceFeatureFlags === 'function') {
            loadInvoiceFeatureFlags(false);
        } else if (typeof updateInvoicePOFallbackUI === 'function') {
            updateInvoicePOFallbackUI();
        }
    } else {
        if (imEntrySidebar) {
            imEntrySidebar.classList.add('hidden');
            imEntrySidebar.classList.remove('visible');
        }
        if (imMainElement) imMainElement.classList.remove('with-sidebar');
        const imAdminControls = document.getElementById('im-admin-controls');
        // 10.4.2: Manual PO / Vacation Mode control now lives in WorkDesk Settings.
        // Do not hide that settings card when switching Invoice Management pages.
        if (imAdminControls && imAdminControls.closest('#invoice-management-view')) {
            imAdminControls.classList.add('hidden');
        }
    }

    // 6. Section Specific Initializers
    if (sectionId === 'im-dashboard') {
        // 7.9.0: On mobile, Invoice/Task should land in Active Task shell.
        // The Dashboard standby page is desktop-only and was confusing in mobile.
        const isMobileIMDashboard = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
        if (isMobileIMDashboard && typeof forceInvoiceTaskMobileActiveTaskShell === 'function') {
            forceInvoiceTaskMobileActiveTaskShell();
            return;
        }
        // STOP AUTOMATIC LOADING
        // populateInvoiceDashboard(false); <--- REMOVED

        // 8.4.9: Premium standby view. Data still loads only on double-click to avoid heavy dashboard refresh on every entry.
        const dbSection = document.getElementById('im-dashboard');
        dbSection.innerHTML = `
            <div class="im-premium-dashboard-shell">
                <div class="im-dashboard-hero im-dashboard-standby-hero">
                    <div class="im-dashboard-hero-main">
                        <div class="im-dashboard-eyebrow">Invoice Management</div>
                        <div class="im-dashboard-title-row">
                            <div class="icon-wrapper im-dashboard-title-icon"><i class="fa-solid fa-building-columns"></i></div>
                            <h1><span class="im-command-title-text">Invoice Dashboard</span></h1>
                        </div>
                        <p>Premium finance dashboard is on standby to keep the system fast. Double-click Dashboard when you need live chart and cost movement data.</p>
                    </div>
                    <div class="im-dashboard-hero-actions">
                        <button type="button" class="im-dashboard-refresh-btn" onclick="populateInvoiceDashboard(true)">
                            <i class="fa-solid fa-chart-column"></i> Load Dashboard
                        </button>
                    </div>
                </div>
                <div class="im-dashboard-standby-card">
                    <i class="fa-solid fa-gauge-high"></i>
                    <h2>Dashboard Standby</h2>
                    <p>Click <strong>Load Dashboard</strong> or double-click the Dashboard menu to open the full Invoice Dashboard.</p>
                </div>
            </div>
        `;
    }

    if (sectionId === 'im-batch-entry') {
        const savedBatchSearch = sessionStorage.getItem('imBatchSearch');
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


// Double-click copy shortcut: Batch Entry "Search by Note"
try {
    const noteSelectEl = document.getElementById('im-batch-note-search-select');
    if (noteSelectEl && imBatchNoteSearchChoices) {
        const choicesWrapper =
            (noteSelectEl.parentElement && noteSelectEl.parentElement.querySelector('.choices')) ||
            noteSelectEl.closest('.choices');

        const feedbackEl = choicesWrapper
            ? (choicesWrapper.querySelector('.choices__inner') || choicesWrapper)
            : noteSelectEl;

        if (choicesWrapper) {
            bindDblClickCopy(choicesWrapper, () => {
                // Prefer selected note labels
                try {
                    const selected = imBatchNoteSearchChoices.getValue();
                    if (Array.isArray(selected) && selected.length) {
                        return selected
                            .map(x => (x.label || x.value || ''))
                            .filter(Boolean)
                            .join(', ');
                    }
                    if (selected && typeof selected === 'object') {
                        return (selected.label || selected.value || '');
                    }
                } catch (e) { /* ignore */ }

                // Fallback: whatever user typed into the search box
                const inputEl = choicesWrapper.querySelector('input.choices__input');
                return inputEl ? inputEl.value : '';
            }, feedbackEl);
        }
    }
} catch (e) { /* ignore */ }

        populateNoteDropdown(imBatchNoteSearchChoices).then(() => {
            if (savedBatchNoteSearch) imBatchNoteSearchChoices.setChoiceByValue(savedBatchNoteSearch);
        });
    }

    if (sectionId === 'im-summary-note') {
        initializeNoteSuggestions();
        const savedPrevNote = sessionStorage.getItem('imSummaryPrevNote');
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
        // 7.4.4: Mobile Invoice Records has its own identity and should not render desktop controls/table.
        if (typeof refreshInvoiceRecordsResponsiveIdentity === 'function') refreshInvoiceRecordsResponsiveIdentity();
        if (typeof isInvoiceReportingMobileMode === 'function' && isInvoiceReportingMobileMode()) {
            activateMobileInvoiceRecordsIdentity();
        }

        // Date picker was removed from UI (it was not used by report logic),
        // so guard against null to avoid runtime errors.
        if (imDailyReportDateInput) imDailyReportDateInput.value = getTodayDateString();
        const savedSearch = sessionStorage.getItem('imReportingSearch');
        // 10.4.1: Do not auto-load invoice_entries when opening Invoice Records.
        // Keep the previous search text for convenience, but load only after Admin clicks Search.
        if (savedSearch) {
            imReportingSearchInput.value = savedSearch;
            imReportingContent.innerHTML = '<p>Previous search restored. Click <strong>Search</strong> to load Invoice Records.</p>';
        } else {
            imReportingContent.innerHTML = '<p>Please enter a PO, Vendor, or Invoice No. and click Search.</p>';
            imReportingSearchInput.value = '';
        }
        if (reportingCountDisplay) reportingCountDisplay.textContent = '';
        currentReportData = [];
        populateSiteFilterDropdown();
        if (typeof refreshInvoiceRecordsResponsiveIdentity === 'function') refreshInvoiceRecordsResponsiveIdentity();
        // Visibility rules (V5.5.3 update):
        // - CSV/Excel downloads: Only Super Admin (Irwin) OR the active Super Admin Vacation Delegate
        // - Print Preview/List: All Admins (and Accounting)
        const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
        const isSuperAdminDelegate = isVacationDelegateUser();

        const isAdminRole = (currentApprover?.Role || '').toLowerCase() === 'admin';
        const posLower = (currentApprover?.Position || '').toLowerCase();
        const isAccountingPos = posLower.includes('accounting') || posLower.includes('accounts') || posLower.includes('finance');

        const showReportBtns = (isSuperAdmin || isSuperAdminDelegate) && (window.innerWidth > 768);
        if (imReportingDownloadCSVButton) imReportingDownloadCSVButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDownloadDailyReportButton) imDownloadDailyReportButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDownloadWithAccountsReportButton) imDownloadWithAccountsReportButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDailyReportDateInput) imDailyReportDateInput.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imReportingDownloadExcelButton) imReportingDownloadExcelButton.style.display = showReportBtns ? 'inline-block' : 'none';
        
        // --- ADD THIS NEW LINE HERE ---
        const customExcelBtn = document.getElementById('im-download-excel-custom-btn');
        if (customExcelBtn) customExcelBtn.style.display = showReportBtns ? 'inline-block' : 'none';

        const canPrintInvoiceReport = isAdminRole || isAccountingPos;
        if (imReportingPrintBtn) imReportingPrintBtn.disabled = !canPrintInvoiceReport;
    }

    if (sectionId === 'im-payments') {
        imPaymentsTableBody.innerHTML = '';
        invoicesToPay = {};
        updatePaymentsCount();
    }
}

// --- User Settings ---

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

    // Super Admin tools
    populateCelebrationSettingsForm();

    // 10.4.2: System-level Invoice Management toggle is organized in WorkDesk Settings.
    if (typeof loadInvoiceFeatureFlags === 'function') {
        loadInvoiceFeatureFlags(false);
    } else if (typeof updateInvoicePOFallbackUI === 'function') {
        updateInvoicePOFallbackUI();
    }

}

function isCurrentUserSuperAdmin() {
    const name = (currentApprover?.Name || '').trim().toLowerCase();
    const role = (currentApprover?.Role || '').trim().toLowerCase();
    const pos = (currentApprover?.Position || '').trim().toLowerCase();
    return name === 'irwin' || role.includes('super') || pos.includes('super admin');
}

// Celebration settings helpers moved to js/app-celebration.js in 8.0.1 (cleanup only).


async function handleUpdateSettings(e) {
    e.preventDefault();
    if (!currentApprover || !currentApprover.key) {
        settingsMessage.textContent = 'Could not identify user. Please log in again.';
        settingsMessage.className = 'error-message';
        return;
    }

    const onVacation = settingsVacationCheckbox.checked;
    const updates = {
        Site: settingsSiteInput.value.trim(),
        Vacation: onVacation ? "Yes" : "",
        DateReturn: onVacation ? settingsReturnDateInput.value : '',
        ReplacementName: onVacation ? settingsReplacementNameInput.value.trim() : '',
        ReplacementContact: onVacation ? settingsReplacementContactInput.value.trim() : '',
        ReplacementEmail: onVacation ? settingsReplacementEmailInput.value.trim() : ''
    };
    let passwordChanged = false;
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
function updateWorkdeskDateTime() {}
function updateDashboardDateTime() {}
function updateIMDateTime() {}

// ==========================================================================
// 7. WORKDESK LOGIC: DASHBOARD & CALENDAR
// ==========================================================================

// --- Helper: Check Task Completion ---

// #endregion BLOCK 11 — MAIN NAVIGATION + SETTINGS

