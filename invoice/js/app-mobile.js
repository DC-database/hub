// =================================================================================================
// IBA WorkDesk — Mobile UI Helpers
// Version 7.5.3
//
// Purpose:
//   First safe JavaScript split from app.js.
//   This file owns mobile/responsive helpers and mobile Invoice Records card rendering.
//
// Important:
//   Loaded BEFORE app.js as a normal browser script, so all functions remain global
//   and existing app.js calls continue to work without changing Firebase/data logic.
// =================================================================================================

function isMobileViewport() {
    // 7.4.1: Treat real phone/tablet mobile UI as mobile even if the browser
    // reports a wider layout width. This keeps Inventory mobile routing stable.
    try {
        if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) return true;
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && (window.innerWidth || 0) <= 1180) return true;
        const ua = String(navigator.userAgent || '').toLowerCase();
        if (/android|iphone|ipad|ipod|mobile/.test(ua) && (window.innerWidth || 0) <= 1180) return true;
    } catch (_) {}
    return (window.innerWidth || 0) <= 768;
}

// 7.4.4 — hard mobile/desktop identity split.
// The mobile Invoice Records page must not reuse the desktop reporting UI when the screen is small.
function syncResponsiveModeClass() {
    const mobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
    if (document.body) {
        document.body.classList.toggle('iba-mobile-ui', mobile);
        document.body.classList.toggle('iba-desktop-ui', !mobile);
    }
    return mobile;
}

function isInvoiceReportingMobileMode() {
    const mobile = (typeof syncResponsiveModeClass === 'function') ? syncResponsiveModeClass() : ((window.innerWidth || 0) <= 900);
    const invoiceView = document.getElementById('invoice-management-view');
    const reportingSection = document.getElementById('im-reporting');
    const inventoryMode = (typeof isInventoryMobileModuleActive === 'function')
        ? isInventoryMobileModuleActive()
        : !!(document.body && document.body.classList.contains('inventory-mode'));
    return !!(mobile && !inventoryMode && invoiceView && !invoiceView.classList.contains('hidden') && reportingSection && !reportingSection.classList.contains('hidden'));
}

function imSetDisplayImportant(el, value) {
    if (!el) return;
    if (value === null || value === undefined) el.style.removeProperty('display');
    else el.style.setProperty('display', value, 'important');
}

// 7.4.5 — Mobile Invoice Records uses an always-visible mobile filter card.
// This avoids the small-screen modal event conflict and gives mobile its own stable identity.
function imEnsureMobileInvoiceInlineSearchPanel() {
    const reportingSection = document.getElementById('im-reporting');
    if (!reportingSection) return null;

    let panel = document.getElementById('im-mobile-inline-search-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'im-mobile-inline-search-panel';
    panel.className = 'im-mobile-inline-search-panel hidden';
    panel.innerHTML = `
        <div class="im-mobile-inline-title">
            <i class="fa-solid fa-filter"></i>
            <span>Search Invoice Records</span>
            <button id="im-mobile-inline-edit-btn" class="im-mobile-inline-edit-btn" type="button">Edit</button>
        </div>
        <div class="im-mobile-inline-collapsed-summary" id="im-mobile-inline-collapsed-summary">
            <span class="summary-caption">Current Search</span>
            <strong id="im-mobile-inline-filter-text">All invoice records</strong>
        </div>
        <div class="im-mobile-inline-grid">
            <div class="form-group">
                <label for="im-mobile-inline-search-term">PO or Vendor</label>
                <input type="text" id="im-mobile-inline-search-term" placeholder="Type PO or Vendor..." autocomplete="off">
            </div>
            <div class="form-group">
                <label for="im-mobile-inline-site-filter">Site</label>
                <select id="im-mobile-inline-site-filter"><option value="">All Sites</option></select>
            </div>
            <div class="form-group">
                <label for="im-mobile-inline-status-filter">Status</label>
                <select id="im-mobile-inline-status-filter">
                    <option value="">All Statuses</option>
                    <option value="Negative Balance">Negative Balance</option>
                    <option value="For SRV">For SRV</option>
                    <option value="Pending">Pending</option>
                    <option value="For IPC">For IPC</option>
                    <option value="Under Review">Under Review</option>
                    <option value="In Process">In Process</option>
                    <option value="Unresolved">Unresolved</option>
                    <option value="For Approval">For Approval</option>
                    <option value="CEO Approval">CEO Approval</option>
                    <option value="Report">Report</option>
                    <option value="Report Approval">Report Approval</option>
                    <option value="Report Approved">Report Approved</option>
                    <option value="With Accounts">With Accounts</option>
                    <option value="On Hold">On Hold</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Paid">Paid</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>
            <div class="form-group">
                <label for="im-mobile-inline-month-filter">Release Month</label>
                <select id="im-mobile-inline-month-filter">
                    <option value="">All Months</option>
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                </select>
            </div>
        </div>
        <div class="im-mobile-inline-actions">
            <button id="im-mobile-inline-clear-btn" class="secondary-btn" type="button">Clear</button>
            <button id="im-mobile-inline-run-btn" class="primary-btn" type="button"><i class="fa-solid fa-magnifying-glass"></i> Search</button>
        </div>
    `;

    const mobileView = document.getElementById('im-reporting-mobile-view');
    if (mobileView && mobileView.parentNode === reportingSection) {
        reportingSection.insertBefore(panel, mobileView);
    } else {
        const form = document.getElementById('im-reporting-form');
        if (form && form.parentNode === reportingSection) reportingSection.insertBefore(panel, form);
        else reportingSection.appendChild(panel);
    }
    return panel;
}

function imSyncMobileInvoiceInlineOptions() {
    const desktopSite = document.getElementById('im-reporting-site-filter');
    const inlineSite = document.getElementById('im-mobile-inline-site-filter');
    if (desktopSite && inlineSite) {
        const current = inlineSite.value;
        inlineSite.innerHTML = desktopSite.innerHTML || '<option value="">All Sites</option>';
        inlineSite.value = current || desktopSite.value || '';
    }

    const desktopStatus = document.getElementById('im-reporting-status-filter');
    const inlineStatus = document.getElementById('im-mobile-inline-status-filter');
    if (desktopStatus && inlineStatus && desktopStatus.options && desktopStatus.options.length) {
        const current = inlineStatus.value;
        inlineStatus.innerHTML = desktopStatus.innerHTML;
        inlineStatus.value = current || desktopStatus.value || '';
    }

    const inlineTerm = document.getElementById('im-mobile-inline-search-term');
    const desktopTerm = document.getElementById('im-reporting-search');
    if (inlineTerm && desktopTerm && !inlineTerm.value) inlineTerm.value = desktopTerm.value || '';

    const inlineMonth = document.getElementById('im-mobile-inline-month-filter');
    const desktopMonth = document.getElementById('im-reporting-month-filter');
    if (inlineMonth && desktopMonth && !inlineMonth.value) inlineMonth.value = desktopMonth.value || '';
}

function imApplyMobileInlineFiltersToDesktop() {
    const inlineTerm = document.getElementById('im-mobile-inline-search-term');
    const inlineSite = document.getElementById('im-mobile-inline-site-filter');
    const inlineStatus = document.getElementById('im-mobile-inline-status-filter');
    const inlineMonth = document.getElementById('im-mobile-inline-month-filter');

    const desktopTerm = document.getElementById('im-reporting-search');
    const desktopSite = document.getElementById('im-reporting-site-filter');
    const desktopStatus = document.getElementById('im-reporting-status-filter');
    const desktopMonth = document.getElementById('im-reporting-month-filter');
    const desktopYear = document.getElementById('im-reporting-year-filter');

    if (desktopTerm && inlineTerm) desktopTerm.value = inlineTerm.value.trim();
    if (desktopSite && inlineSite) desktopSite.value = inlineSite.value || '';
    if (desktopStatus && inlineStatus) desktopStatus.value = inlineStatus.value || '';
    if (desktopMonth && inlineMonth) desktopMonth.value = inlineMonth.value || '';
    if (desktopYear) desktopYear.value = '';

    return desktopTerm ? desktopTerm.value : (inlineTerm ? inlineTerm.value.trim() : '');
}


// 7.4.6: Mobile Invoice Records search panel can collapse after running search.
function imBuildMobileInlineFilterText() {
    const term = (document.getElementById('im-mobile-inline-search-term')?.value || '').trim();
    const site = document.getElementById('im-mobile-inline-site-filter')?.value || '';
    const status = document.getElementById('im-mobile-inline-status-filter')?.value || '';
    const monthEl = document.getElementById('im-mobile-inline-month-filter');
    const month = monthEl ? (monthEl.options[monthEl.selectedIndex]?.text || '') : '';
    const parts = [];
    if (term) parts.push(term);
    if (site) parts.push(`Site ${site}`);
    if (status) parts.push(status);
    if (monthEl && monthEl.value) parts.push(month);
    return parts.length ? parts.join(' • ') : 'All invoice records';
}

function imSetMobileInvoiceSearchCollapsed(collapsed) {
    const panel = document.getElementById('im-mobile-inline-search-panel');
    if (!panel) return;
    panel.classList.toggle('is-collapsed', !!collapsed);
    const text = document.getElementById('im-mobile-inline-filter-text');
    if (text) text.textContent = imBuildMobileInlineFilterText();
    try { panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
}

async function imRunMobileInlineInvoiceSearch() {
    if (typeof activateMobileInvoiceRecordsIdentity === 'function') activateMobileInvoiceRecordsIdentity();
    const searchText = imApplyMobileInlineFiltersToDesktop();
    sessionStorage.setItem('imReportingSearch', searchText || '');
    const mobileView = document.getElementById('im-reporting-mobile-view');
    if (mobileView) mobileView.innerHTML = '<div class="im-mobile-empty-state"><i class="fa-solid fa-spinner fa-spin"></i><h3>Searching...</h3><p>Please wait while records are loaded.</p></div>';
    if (typeof imSetMobileInvoiceSearchCollapsed === 'function') imSetMobileInvoiceSearchCollapsed(true);
    if (typeof populateInvoiceReporting === 'function') {
        await populateInvoiceReporting(searchText || '');
    }
}

function imClearMobileInlineInvoiceSearch() {
    ['im-mobile-inline-search-term', 'im-mobile-inline-site-filter', 'im-mobile-inline-status-filter', 'im-mobile-inline-month-filter',
     'im-reporting-search', 'im-reporting-site-filter', 'im-reporting-status-filter', 'im-reporting-month-filter', 'im-reporting-year-filter']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    sessionStorage.removeItem('imReportingSearch');
    if (typeof imSetMobileInvoiceSearchCollapsed === 'function') imSetMobileInvoiceSearchCollapsed(false);
    currentReportData = [];
    const mobileView = document.getElementById('im-reporting-mobile-view');
    if (mobileView && typeof imMobileInvoiceEmptyState === 'function') {
        mobileView.innerHTML = imMobileInvoiceEmptyState('Search Invoice Records', 'Enter your filters above, then tap Search.');
    }
    const desktopContent = document.getElementById('im-reporting-content');
    if (desktopContent) desktopContent.innerHTML = '<div class="loading-state"><i class="fa-solid fa-magnifying-glass"></i> <span style="margin-left: 8px;">Enter a search term and click Search to load data.</span></div>';
    const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
    if (grandTotalContainer) {
        grandTotalContainer.style.display = 'none';
        grandTotalContainer.innerHTML = '';
    }
    const count = document.getElementById('reporting-count-display');
    if (count) count.textContent = '(Found: 0)';
}

function imEnsureMobileInvoiceRecordsShell() {
    const reportingSection = document.getElementById('im-reporting');
    if (!reportingSection) return;
    if (typeof imEnsureMobileInvoiceInlineSearchPanel === 'function') imEnsureMobileInvoiceInlineSearchPanel();

    // Ensure the mobile card result container exists inside Invoice Records.
    let mobileView = document.getElementById('im-reporting-mobile-view');
    if (!mobileView) {
        mobileView = document.createElement('div');
        mobileView.id = 'im-reporting-mobile-view';
        mobileView.className = 'hidden';
        reportingSection.appendChild(mobileView);
    }

    // Ensure there is a visible mobile Search button in the header/title area.
    let mobileBtn = document.getElementById('im-mobile-search-btn');
    if (!mobileBtn) {
        mobileBtn = document.createElement('button');
        mobileBtn.id = 'im-mobile-search-btn';
        mobileBtn.type = 'button';
        mobileBtn.className = 'im-mobile-search-btn';
        mobileBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><span>Search</span>';
        const title = reportingSection.querySelector('.header-title') || reportingSection.querySelector('.header') || reportingSection;
        title.appendChild(mobileBtn);
    }
}

function activateMobileInvoiceRecordsIdentity() {
    syncResponsiveModeClass();
    imEnsureMobileInvoiceRecordsShell();

    const section = document.getElementById('im-reporting');
    if (!section) return;
    if (document.body) document.body.classList.add('im-mobile-reporting-mode');

    // Hide desktop Invoice Records controls/table with inline important styles.
    [
        section.querySelector('.daily-report-section'),
        section.querySelector('#im-reporting-form'),
        section.querySelector('.reporting-legend'),
        section.querySelector('.grid-header'),
        section.querySelector('#im-reporting-content'),
        section.querySelector('#im-reporting-grand-total-container')
    ].forEach(el => imSetDisplayImportant(el, 'none'));

    // 7.4.5: no modal button dependency on mobile. Show the inline mobile filter card instead.
    const mobileBtn = document.getElementById('im-mobile-search-btn');
    imSetDisplayImportant(mobileBtn, 'none');
    if (mobileBtn) mobileBtn.classList.add('hidden');

    const inlinePanel = (typeof imEnsureMobileInvoiceInlineSearchPanel === 'function') ? imEnsureMobileInvoiceInlineSearchPanel() : document.getElementById('im-mobile-inline-search-panel');
    if (inlinePanel) {
        inlinePanel.classList.remove('hidden');
        imSetDisplayImportant(inlinePanel, 'block');
        if (typeof imSyncMobileInvoiceInlineOptions === 'function') imSyncMobileInvoiceInlineOptions();
    }

    const mobileView = document.getElementById('im-reporting-mobile-view');
    if (mobileView) {
        mobileView.classList.remove('hidden');
        imSetDisplayImportant(mobileView, 'block');
        if (!mobileView.innerHTML.trim()) {
            if (typeof imMobileInvoiceEmptyState === 'function') {
                mobileView.innerHTML = imMobileInvoiceEmptyState('Search Invoice Records', 'Enter your filters above, then tap Search.');
            } else {
                mobileView.innerHTML = '<div class="im-mobile-empty-state"><h3>Search Invoice Records</h3><p>Tap Search to begin.</p></div>';
            }
        }
    }
}

function deactivateMobileInvoiceRecordsIdentity() {
    if (document.body) document.body.classList.remove('im-mobile-reporting-mode');
    const section = document.getElementById('im-reporting');
    if (!section) return;

    [
        section.querySelector('.daily-report-section'),
        section.querySelector('#im-reporting-form'),
        section.querySelector('.reporting-legend'),
        section.querySelector('.grid-header'),
        section.querySelector('#im-reporting-content'),
        section.querySelector('#im-reporting-grand-total-container')
    ].forEach(el => imSetDisplayImportant(el, null));

    const mobileBtn = document.getElementById('im-mobile-search-btn');
    imSetDisplayImportant(mobileBtn, null);

    const inlinePanel = document.getElementById('im-mobile-inline-search-panel');
    if (inlinePanel) {
        inlinePanel.classList.add('hidden');
        imSetDisplayImportant(inlinePanel, null);
    }

    const mobileView = document.getElementById('im-reporting-mobile-view');
    if (mobileView) {
        mobileView.classList.add('hidden');
        imSetDisplayImportant(mobileView, null);
    }
}

function refreshInvoiceRecordsResponsiveIdentity() {
    const mobile = syncResponsiveModeClass();
    const reportingSection = document.getElementById('im-reporting');
    const isReportingVisible = !!(reportingSection && !reportingSection.classList.contains('hidden'));
    const invoiceView = document.getElementById('invoice-management-view');
    const isInvoiceVisible = !!(invoiceView && !invoiceView.classList.contains('hidden'));
    const inventoryMode = !!(document.body && document.body.classList.contains('inventory-mode'));
    if (mobile && isInvoiceVisible && isReportingVisible && !inventoryMode) activateMobileInvoiceRecordsIdentity();
    else deactivateMobileInvoiceRecordsIdentity();
}

// Bind the mobile Invoice Records identity at document level so it does not depend on old desktop listeners.
if (!window.__ibaMobileInvoiceRecordsIdentityBound) {
    window.__ibaMobileInvoiceRecordsIdentityBound = true;
    const bindMobileIdentity = () => {
        refreshInvoiceRecordsResponsiveIdentity();
        window.addEventListener('resize', () => setTimeout(refreshInvoiceRecordsResponsiveIdentity, 50));
        window.addEventListener('orientationchange', () => setTimeout(refreshInvoiceRecordsResponsiveIdentity, 150));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindMobileIdentity);
    else bindMobileIdentity();

    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#im-mobile-search-btn, body.im-mobile-reporting-mode #im-reporting-search-btn');
        if (!btn) return;
        refreshInvoiceRecordsResponsiveIdentity();
        if (!isInvoiceReportingMobileMode()) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (typeof imOpenMobileInvoiceSearchModal === 'function') await imOpenMobileInvoiceSearchModal();
    }, true);
}
function isWorkdeskViewVisible() {
    const wdView = document.getElementById('workdesk-view');
    return !!(wdView && !wdView.classList.contains('hidden'));
}
/**
 * When we're on the NORMAL Workdesk (desktop viewport) we hide inventory-related
 * tasks/jobs (Transfer/Restock/Return/Usage). Inventory mode pages/clones keep them.
 * Mobile view is intentionally unchanged.
 */
function shouldExcludeInventoryFromWorkdeskDesktop() {
    const invCtx = (typeof isInventoryContext === 'function' && isInventoryContext());
    return isWorkdeskViewVisible() && !isMobileViewport() && !invCtx;
}


// 7.5.3 — Material Stock navigation scope guard.
// Material Stock is Inventory-only. It must not leak into normal Invoice/Task mobile nav.
function enforceMaterialStockNavigationScope(moduleName) {
    const explicit = String(moduleName || '').toLowerCase();
    const inventoryMode = explicit === 'inventory' ||
        ((window.__ibaActiveModule || '').toLowerCase() === 'inventory') ||
        (document.body && document.body.classList.contains('inventory-mode'));
    const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 768);

    document.querySelectorAll('#workdesk-nav .wd-nav-material').forEach(el => {
        const target = el.tagName && el.tagName.toLowerCase() === 'li' ? el : (el.closest('li') || el);
        if (!target) return;

        // Invoice/Task: always hidden. Inventory mobile: hidden by design.
        if (!inventoryMode || isMobile) {
            target.style.setProperty('display', 'none', 'important');
        } else {
            // Inventory desktop can show Material Stock.
            target.style.removeProperty('display');
        }
    });
}

// 7.3.6 — Module-aware WorkDesk shell navigation.
// Inventory still uses the WorkDesk shell for now, but the mobile/desktop routes
// must behave like a separate Inventory module.
function updateWorkdeskModuleRoutingUI(moduleName) {
    const inventoryMode = String(moduleName || '').toLowerCase() === 'inventory' ||
        (document.body && document.body.classList.contains('inventory-mode'));

    try { window.__ibaActiveModule = inventoryMode ? 'inventory' : 'workdesk'; } catch (_) {}
    if (document.body) document.body.classList.toggle('inventory-mode', inventoryMode);

    const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 768);
    const setLiDisplay = (selector, show) => {
        document.querySelectorAll(selector).forEach(el => {
            const li = el.tagName && el.tagName.toLowerCase() === 'li' ? el : el.closest('li');
            if (li) {
                if (show) {
                    li.style.removeProperty('display');
                } else {
                    li.style.setProperty('display', 'none', 'important');
                }
            }
        });
    };

    // Normal WorkDesk owns Dashboard/Add New Job. Inventory owns Material Stock and inventory records.
    setLiDisplay('.wd-nav-dashboard', !inventoryMode);
    const addJobLi = document.getElementById('wd-sidebar-add-job-btn')?.closest('li');
    if (addJobLi) addJobLi.style.display = inventoryMode ? 'none' : '';

    // Desktop Inventory can keep Material Stock/Job Records in its sidebar.
    // 7.3.9: Mobile Inventory keeps the compact task-only flow, so Material Stock
    // and both Reporting/Job Records nav entries are forcibly hidden in Inventory mobile mode.
    setLiDisplay('#workdesk-nav .wd-nav-material', inventoryMode && !isMobile);
    setLiDisplay('#workdesk-nav .wd-nav-reporting', !(inventoryMode && isMobile));
    setLiDisplay('#workdesk-nav .wd-nav-im-reporting-mobile', !(inventoryMode && isMobile));

    const wdId = document.getElementById('wd-user-identifier');
    if (wdId && inventoryMode) wdId.textContent = 'Inventory Access';

    const reportLink = document.querySelector('.wd-nav-reporting a[data-section="wd-reporting"]');
    if (reportLink) {
        reportLink.innerHTML = '<i class="fa-solid fa-chart-line"></i> Job Records';
    }

    const mobileReportLink = document.getElementById('wd-im-reporting-link-mobile');
    if (mobileReportLink) {
        mobileReportLink.innerHTML = '<i class="fa-solid fa-chart-line"></i> Reporting';
        mobileReportLink.setAttribute('title', inventoryMode ? 'Inventory Job Records' : 'Invoice Records');
        const reportLi = mobileReportLink.closest('li');
        if (reportLi) {
            if (inventoryMode && isMobile) reportLi.style.setProperty('display', 'none', 'important');
            else reportLi.style.removeProperty('display');
        }
    }

    // If Inventory is opened on mobile, always force the Inventory shell to Active Task.
    // Material Stock and Reporting are desktop-only for Inventory mobile.
    if (inventoryMode && isMobile) {
        if (typeof forceInventoryMobileActiveTaskShell === 'function') {
            forceInventoryMobileActiveTaskShell();
        } else {
            const activeTaskSection = document.getElementById('wd-activetask');
            if (activeTaskSection) {
                document.querySelectorAll('.workdesk-section').forEach(el => el.classList.add('hidden'));
                activeTaskSection.classList.remove('hidden');
                document.querySelectorAll('#workdesk-nav a').forEach(el => el.classList.remove('active'));
                const activeTaskLink = document.querySelector('#workdesk-nav a[data-section="wd-activetask"]');
                if (activeTaskLink) activeTaskLink.classList.add('active');
            }
        }
    }

    // Strong final pass for module-specific nav visibility. This protects against CSS rules
    // that convert the sidebar into a bottom nav with !important display styles.
    try { if (typeof enforceInventoryMobileNavVisibility === 'function') enforceInventoryMobileNavVisibility(); } catch (_) {}
    try { if (typeof enforceMaterialStockNavigationScope === 'function') enforceMaterialStockNavigationScope(inventoryMode ? 'inventory' : 'workdesk'); } catch (_) {}
    try { if (typeof ensureInventoryMobileMaterialFinderNav === 'function') ensureInventoryMobileMaterialFinderNav(); } catch (_) {}
    try { if (typeof updateInventoryMobileMaterialFinderNavVisibility === 'function') updateInventoryMobileMaterialFinderNavVisibility(); } catch (_) {}

    // 7.3.7: Keep the mobile module dropdown aligned with the active module.
    try {
        if (typeof syncMobileModuleSwitchers === 'function') {
            syncMobileModuleSwitchers(inventoryMode ? 'inventory' : 'invoice');
        }
    } catch (_) {}
}

// 7.3.9 — Hard guard: hide Inventory-only desktop/reporting tabs from the Inventory mobile bottom navigation.
function enforceInventoryMobileNavVisibility() {
    const inventoryMode = ((window.__ibaActiveModule || '').toLowerCase() === 'inventory') ||
        (document.body && document.body.classList.contains('inventory-mode'));
    const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 768);
    const hideInInventoryMobile = [
        '#workdesk-nav .wd-nav-material',
        '#workdesk-nav .wd-nav-reporting',
        '#workdesk-nav .wd-nav-im-reporting-mobile',
        '#inventory-view #inv-nav'
    ];
    hideInInventoryMobile.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            const target = el.tagName && el.tagName.toLowerCase() === 'li' ? el : (el.closest('li') || el);
            if (!target) return;

            // Material Stock belongs to Inventory only. In normal Invoice/Task mode it must stay hidden.
            if (selector === '#workdesk-nav .wd-nav-material') {
                if (!inventoryMode || isMobile) {
                    target.style.setProperty('display', 'none', 'important');
                } else {
                    target.style.removeProperty('display');
                }
                return;
            }

            if (inventoryMode && isMobile) {
                target.style.setProperty('display', 'none', 'important');
            } else if (selector !== '#inventory-view #inv-nav') {
                target.style.removeProperty('display');
            }
        });
    });

    try { if (typeof enforceMaterialStockNavigationScope === 'function') enforceMaterialStockNavigationScope(inventoryMode ? 'inventory' : 'workdesk'); } catch (_) {}
    try { if (typeof ensureInventoryMobileMaterialFinderNav === 'function') ensureInventoryMobileMaterialFinderNav(); } catch (_) {}
    try { if (typeof updateInventoryMobileMaterialFinderNavVisibility === 'function') updateInventoryMobileMaterialFinderNavVisibility(); } catch (_) {}
}

// 7.4.1 — Hard reset for mobile module switching.
// Prevents stale invoice task cards/badges/filters from remaining when the user
// switches to Inventory and there are no Inventory tasks to render.
function clearMobileActiveTaskCards() {
    try {
        const container = document.getElementById('active-task-mobile-view');
        if (container) container.innerHTML = '';
        const receiptContainer = document.getElementById('mobile-receipt-action-container');
        if (receiptContainer) receiptContainer.classList.add('hidden');
    } catch (_) {}
}

function forceInventoryMobileActiveTaskShell() {
    const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 768);
    const inventoryMode = ((window.__ibaActiveModule || '').toLowerCase() === 'inventory') ||
        (document.body && document.body.classList.contains('inventory-mode'));
    if (!inventoryMode || !isMobile) return;

    try {
        if (document.body) document.body.classList.add('inventory-mode');
        window.__ibaActiveModule = 'inventory';

        document.querySelectorAll('.workdesk-section').forEach(el => el.classList.add('hidden'));
        const activeSection = document.getElementById('wd-activetask');
        if (activeSection) activeSection.classList.remove('hidden');

        document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
        const activeLink = document.querySelector('#workdesk-nav a[data-section="wd-activetask"]');
        if (activeLink) activeLink.classList.add('active');

        // Hide these regardless of previous inline styles from desktop/workdesk state.
        ['#workdesk-nav .wd-nav-material', '#workdesk-nav .wd-nav-reporting', '#workdesk-nav .wd-nav-im-reporting-mobile', '#inventory-view #inv-nav']
            .forEach(sel => document.querySelectorAll(sel).forEach(el => {
                const target = el.tagName && el.tagName.toLowerCase() === 'li' ? el : (el.closest('li') || el);
                if (target) target.style.setProperty('display', 'none', 'important');
            }));
    } catch (_) {}
}

// 7.3.7 — Mobile Module Switcher helpers
// Mobile only needs two working module identities for now:
//   Invoice/Task Management and Inventory Management.
function isInventoryMobileModuleActive() {
    try {
        const activeModule = String(window.__ibaActiveModule || '').toLowerCase();
        if (activeModule === 'inventory') return true;
        if (activeModule === 'invoice' || activeModule === 'workdesk' || activeModule === 'home') return false;
        if (document.body && document.body.classList.contains('inventory-mode')) return true;
        return (typeof isInventoryContext === 'function' && isInventoryContext());
    } catch (_) {
        return false;
    }
}

function getMobileModuleValue() {
    return isInventoryMobileModuleActive() ? 'inventory' : 'invoice';
}

function buildMobileModuleSwitcherControl(id, scopeLabel) {
    const wrap = document.createElement('div');
    wrap.className = 'mobile-module-switcher-wrap';
    wrap.setAttribute('data-mobile-module-switcher-wrap', scopeLabel || 'dynamic');

    const label = document.createElement('label');
    label.className = 'mobile-module-switcher-label';
    label.setAttribute('for', id);
    label.textContent = 'Module';

    const select = document.createElement('select');
    select.id = id;
    select.className = 'mobile-module-switcher-select';
    select.setAttribute('aria-label', 'Switch module');
    select.innerHTML = '<option value="invoice">Invoice / Task</option><option value="inventory">Inventory</option>';

    wrap.appendChild(label);
    wrap.appendChild(select);
    return wrap;
}

function ensureMobileModuleSwitcherMarkup() {
    // 7.4.0: Safety repair. The switcher binding existed, but if HTML cleanup removes
    // the actual <select>, this recreates it near the version display.
    const placements = [
        { id: 'mobile-module-switcher-wd', scope: 'workdesk', view: '#workdesk-view' },
        { id: 'mobile-module-switcher-im', scope: 'invoice', view: '#invoice-management-view' },
        { id: 'mobile-module-switcher-inv', scope: 'inventory', view: '#inventory-view' }
    ];

    placements.forEach(cfg => {
        if (document.getElementById(cfg.id)) return;
        const view = document.querySelector(cfg.view);
        if (!view) return;
        const aside = view.querySelector('aside.workdesk-sidebar') || view.querySelector('aside');
        if (!aside) return;
        const wrap = buildMobileModuleSwitcherControl(cfg.id, cfg.scope);
        const version = aside.querySelector('.version-display.sidebar-version-display, .version-display');
        if (version && version.parentNode) {
            version.parentNode.insertBefore(wrap, version);
        } else {
            aside.appendChild(wrap);
        }
    });
}

function syncMobileModuleSwitchers(moduleName) {
    const value = (String(moduleName || '').toLowerCase() === 'inventory') ? 'inventory' : 'invoice';
    ['mobile-module-switcher-wd', 'mobile-module-switcher-im', 'mobile-module-switcher-inv'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value !== value) el.value = value;
    });
}

function bindMobileModuleSwitcher(el) {
    if (!el || el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('change', () => {
        const selected = String(el.value || '').toLowerCase();
        if (selected === 'inventory') {
            try { window.__ibaActiveModule = 'inventory'; } catch (_) {}
            if (document.body) document.body.classList.add('inventory-mode');
            if (typeof clearMobileActiveTaskCards === 'function') clearMobileActiveTaskCards();
            if (typeof updateActiveTaskModuleBadges === 'function') updateActiveTaskModuleBadges(0, 0, 'inventory');
            if (typeof syncMobileModuleSwitchers === 'function') syncMobileModuleSwitchers('inventory');
            if (typeof inventoryButton !== 'undefined' && inventoryButton) {
                inventoryButton.click();
                setTimeout(() => {
                    if (typeof forceInventoryMobileActiveTaskShell === 'function') forceInventoryMobileActiveTaskShell();
                    if (typeof enforceInventoryMobileNavVisibility === 'function') enforceInventoryMobileNavVisibility();
                }, 120);
            } else if (typeof showView === 'function') {
                showView('workdesk');
                if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('inventory');
                if (typeof forceInventoryMobileActiveTaskShell === 'function') forceInventoryMobileActiveTaskShell();
                if (typeof showWorkdeskSection === 'function') showWorkdeskSection('wd-activetask');
            }
            return;
        }

        // Invoice/Task Management module
        try { window.__ibaActiveModule = 'invoice'; } catch (_) {}
        if (document.body) document.body.classList.remove('inventory-mode');
        if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('workdesk');
        if (typeof syncMobileModuleSwitchers === 'function') syncMobileModuleSwitchers('invoice');

        if (typeof invoiceManagementButton !== 'undefined' && invoiceManagementButton) {
            invoiceManagementButton.click();
        } else if (typeof showView === 'function') {
            showView('invoice-management');
            if (typeof showIMSection === 'function') showIMSection('im-dashboard');
        }
    });
}

function initMobileModuleSwitchers() {
    try { ensureMobileModuleSwitcherMarkup(); } catch (e) { console.warn('Mobile module switcher markup repair failed:', e); }
    bindMobileModuleSwitcher(document.getElementById('mobile-module-switcher-wd'));
    bindMobileModuleSwitcher(document.getElementById('mobile-module-switcher-im'));
    bindMobileModuleSwitcher(document.getElementById('mobile-module-switcher-inv'));
    syncMobileModuleSwitchers(getMobileModuleValue());
}


// =================================================================================================
// Mobile Invoice Records helpers
// =================================================================================================

function imMobileInvoiceSafeId(value) {
    return String(value || 'po').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function imHasPdfName(name) {
    const clean = (typeof getSharePointPdfBaseName === 'function') ? getSharePointPdfBaseName(name) : String(name || '').trim();
    return !!(clean && clean.toLowerCase() !== 'nil' && clean.toLowerCase() !== 'n/a' && clean !== '-');
}

function imPdfBase(name) {
    return (typeof getSharePointPdfBaseName === 'function') ? getSharePointPdfBaseName(name) : String(name || '').trim();
}

function imAmountDisplay(value, canViewAmounts) {
    if (!canViewAmounts) return '---';
    return `QAR ${formatCurrency(parseFloat(value) || 0)}`;
}

function imMobileInvoiceEmptyState(title, message) {
    return `
        <div class="im-mobile-empty-state">
            <i class="fa-solid fa-file-circle-question"></i>
            <h3>${escapeHtml(title || 'No Results Found')}</h3>
            <p>${escapeHtml(message || 'Use the Search button to find records.')}</p>
        </div>`;
}


// 7.4.3: Robust mobile Invoice Records search modal opener.
// This fixes mobile cases where the visible Search button is not the same
// element captured by the earlier direct listener, or the desktop Search
// button is still tapped on mobile.
async function imOpenMobileInvoiceSearchModal() {
    if (typeof activateMobileInvoiceRecordsIdentity === 'function') activateMobileInvoiceRecordsIdentity();
    const modal = document.getElementById('im-mobile-search-modal');
    if (!modal) {
        console.warn('Mobile invoice search modal was not found in the page.');
        alert('Search modal is missing. Please refresh the page and try again.');
        return;
    }

    // Refresh site options if the normal reporting dropdown helper is available.
    if (typeof populateSiteFilterDropdown === 'function') {
        try { await populateSiteFilterDropdown(); } catch (e) { console.warn('Could not refresh site filter', e); }
    }
    if (typeof imSyncMobileInvoiceSearchModalOptions === 'function') {
        try { imSyncMobileInvoiceSearchModalOptions(); } catch (e) { console.warn('Could not sync mobile invoice search options', e); }
    }

    const pairs = [
        ['im-reporting-search', 'im-mobile-search-term'],
        ['im-reporting-site-filter', 'im-mobile-site-filter'],
        ['im-reporting-status-filter', 'im-mobile-status-filter'],
        ['im-reporting-month-filter', 'im-mobile-date-filter'],
    ];
    pairs.forEach(([desktopId, mobileId]) => {
        const desktopEl = document.getElementById(desktopId);
        const mobileEl = document.getElementById(mobileId);
        if (desktopEl && mobileEl) mobileEl.value = desktopEl.value || '';
    });

    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.zIndex = '999999';
    modal.setAttribute('aria-hidden', 'false');
    try { document.getElementById('im-mobile-search-term')?.focus(); } catch (_) {}
}

function imCloseMobileInvoiceSearchModal() {
    const modal = document.getElementById('im-mobile-search-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.removeProperty('display');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function renderMobileInvoiceRecordsCards(reportData, canViewAmounts) {
    if (typeof activateMobileInvoiceRecordsIdentity === 'function') activateMobileInvoiceRecordsIdentity();
    const mobileContainer = document.getElementById('im-reporting-mobile-view');
    const desktopContent = document.getElementById('im-reporting-content');
    if (desktopContent) desktopContent.classList.add('hidden');
    if (!mobileContainer) return;

    mobileContainer.classList.remove('hidden');
    mobileContainer.innerHTML = '';

    if (!Array.isArray(reportData) || reportData.length === 0) {
        mobileContainer.innerHTML = imMobileInvoiceEmptyState('No Results Found', 'Tap Search and enter PO, Vendor, Site, Status, or Release Month.');
        return;
    }

    reportData.forEach((poData, index) => {
        const safePo = imMobileInvoiceSafeId(poData.poNumber) + '_' + index;
        const listId = `mobile-invoice-list-${safePo}`;
        const invoices = poData.filteredInvoices || [];
        const poValue = parseFloat(poData.poDetails?.Amount) || 0;
        const totalSRV = invoices.reduce((sum, inv) => sum + (parseFloat(inv.invValue) || 0), 0);
        const balance = poValue - totalSRV;

        let cardClass = 'status-pending';
        const allStatuses = invoices.map(inv => inv.status || '');
        if (allStatuses.length && allStatuses.every(s => s === 'With Accounts' || s === 'Paid' || s === 'CLOSED')) {
            cardClass = 'status-close';
        } else if (allStatuses.some(s => s === 'Under Review' || s === 'In Process')) {
            cardClass = 'status-open';
        } else if (allStatuses.some(s => s === 'For IPC' || s === 'For SRV' || s === 'Original PO' || s === 'Epicore Value')) {
            cardClass = 'status-new';
        }

        const invoiceCards = invoices.map(inv => {
            const invPDFName = imPdfBase(inv.invName);
            const srvPDFName = imPdfBase(inv.srvName);
            const reportPDFName = imPdfBase(inv.reportName);
            const invButtons = [];
            if (imHasPdfName(inv.invName)) {
                invButtons.push(`<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="im-tx-action-btn invoice-pdf-btn" onclick="event.stopPropagation();"><i class="fa-solid fa-file-invoice"></i>&nbsp;INV PDF</a>`);
            }
            if (imHasPdfName(inv.srvName)) {
                invButtons.push(`<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="im-tx-action-btn srv-pdf-btn" onclick="event.stopPropagation();"><i class="fa-solid fa-receipt"></i>&nbsp;SRV PDF</a>`);
            }
            if (imHasPdfName(inv.reportName)) {
                invButtons.push(`<a href="${REPORT_BASE_PATH}${encodeURIComponent(reportPDFName)}.pdf" target="_blank" class="im-tx-action-btn report-pdf-btn" onclick="event.stopPropagation();"><i class="fa-solid fa-file-lines"></i>&nbsp;REPORT PDF</a>`);
            }
            return `
                <li class="im-invoice-item">
                    <div class="im-tx-card-header">
                        <div class="im-tx-invoice-main">
                            <span class="im-tx-field-label">Invoice No.</span>
                            <span class="im-tx-title">${escapeHtml(inv.invNumber || 'N/A')}</span>
                        </div>
                        <span class="im-tx-status">${escapeHtml(inv.status || 'N/A')}</span>
                    </div>
                    <div class="im-tx-amount-panel">
                        <span class="im-tx-field-label">Invoice Value</span>
                        <strong>${imAmountDisplay(inv.invValue, canViewAmounts)}</strong>
                    </div>
                    <div class="im-tx-meta-line">
                        <span>Date Release</span>
                        <strong>${formatToDDMMMYY(inv.releaseDate || inv.invoiceDate || '') || 'N/A'}</strong>
                    </div>
                    ${invButtons.length ? `<div class="im-tx-actions">${invButtons.join('')}</div>` : '<div class="im-tx-no-pdf">No PDF attached</div>'}
                </li>`;
        }).join('');

        mobileContainer.insertAdjacentHTML('beforeend', `
            <div class="im-po-balance-card ${cardClass}" data-toggle-target="#${listId}">
                <div class="po-card-header">
                    <div class="po-card-title-wrap">
                        <span class="po-card-label">PO No.</span>
                        <span class="po-card-ponum">${escapeHtml(poData.poNumber || 'N/A')}</span>
                    </div>
                    <div class="po-card-right-wrap">
                        <span class="po-card-count">${invoices.length} Txn</span>
                        <i class="fa-solid fa-chevron-down po-card-chevron"></i>
                    </div>
                </div>
                <div class="po-card-vendor-block">
                    <span class="po-card-label">Vendor Name</span>
                    <strong>${escapeHtml(poData.vendor || 'N/A')}</strong>
                </div>
                <div class="po-card-body">
                    <span class="po-card-site"><i class="fa-solid fa-location-dot"></i> Site No. ${escapeHtml(poData.site || 'N/A')}</span>
                    <div class="po-card-grid">
                        <div class="po-card-metric">
                            <span class="po-card-label">Total PO Value</span>
                            <span class="po-card-value">${imAmountDisplay(poValue, canViewAmounts)}</span>
                        </div>
                        <div class="po-card-metric balance-metric">
                            <span class="po-card-label">Balance</span>
                            <span class="po-card-value po-card-balance ${balance < 0 ? 'negative' : ''}">${imAmountDisplay(balance, canViewAmounts)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div id="${listId}" class="im-mobile-po-detail hidden-invoice-list">
                <div class="im-invoice-list-header">
                    <h3>Transactions</h3>
                    <span>${invoices.length} invoice entr${invoices.length === 1 ? 'y' : 'ies'}</span>
                </div>
                <ul class="im-invoice-list">${invoiceCards}</ul>
                <div class="im-mobile-po-summary">
                    <div class="im-mobile-po-summary-row"><span>Total PO Value</span><strong>${imAmountDisplay(poValue, canViewAmounts)}</strong></div>
                    <div class="im-mobile-po-summary-row"><span>Total SRV</span><strong>${imAmountDisplay(totalSRV, canViewAmounts)}</strong></div>
                    <div class="im-mobile-po-summary-row ${balance < 0 ? 'negative' : ''}"><span>Balance</span><strong>${imAmountDisplay(balance, canViewAmounts)}</strong></div>
                </div>
            </div>
        `);
    });
}

function imSyncMobileInvoiceSearchModalOptions() {
    const desktopSite = document.getElementById('im-reporting-site-filter');
    const mobileSite = document.getElementById('im-mobile-site-filter');
    if (desktopSite && mobileSite) mobileSite.innerHTML = desktopSite.innerHTML;
}
