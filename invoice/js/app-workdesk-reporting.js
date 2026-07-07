/* ==========================================================================
   js/app-workdesk-reporting.js
   IBA WorkDesk/Inventory Job Records table and report filter helpers.
   Version: 10.7.6

   Cleanup Phase:
   - Moved Block 13 out of app.js.
   - Function names and existing behavior are preserved.
   - No Firebase paths, invoice save logic, or inventory renderer logic changed.

   10.3.3:
   - WorkDesk Job Records are Admin/Super Admin only. Normal users do not see or
     initialize the WorkDesk Job Records data loader.
   - Admin Job Records use lazy loading: opening the tab shows category buttons only;
     Firebase records load only after a category click or search input.
   - Download optimization only; no workflow, Firebase path, or invoice save logic changed.

   10.7.5:
   - Admin Job Records search is global again. Searching a PO/vendor/site/status does
     not require choosing the exact category tab first.
   - When a search result belongs to one category, the matching tab is auto-highlighted.
   ========================================================================== */

// #region BLOCK 13 — JOB RECORDS TABLE + REPORT FILTERING
// Purpose: Desktop job records table, inventory grouping rows, totals, search/filter rendering.
// =================================================================================================



function wdReportNormalizeRoleText(value) {
    return String(value || '').trim().toLowerCase();
}

function wdReportIsAdminUser() {
    if (typeof wdIsWideAccessUser === 'function') {
        try { return !!wdIsWideAccessUser(); } catch (_) { /* fallback below */ }
    }
    const accessText = wdReportNormalizeRoleText([
        currentApprover?.Role,
        currentApprover?.role,
        currentApprover?.AccountRole,
        currentApprover?.accountRole,
        currentApprover?.Access,
        currentApprover?.access
    ].filter(Boolean).join(' '));
    const nameText = wdReportNormalizeRoleText(currentApprover?.Name || currentApprover?.username || currentApprover?.name || '');
    const superNameText = (typeof SUPER_ADMIN_NAME !== 'undefined') ? wdReportNormalizeRoleText(SUPER_ADMIN_NAME) : '';
    return accessText.includes('admin') || accessText.includes('super') || (!!superNameText && nameText === superNameText);
}

function wdReportIsInventoryMode() {
    return (typeof isInventoryContext === 'function' && isInventoryContext()) ||
        !!(document.body && document.body.classList.contains('inventory-mode')) ||
        String(window.__ibaActiveModule || '').toLowerCase() === 'inventory';
}

function wdReportCanOpenCurrentRecords() {
    // 10.3.3: Normal WorkDesk users do not need Job Records; avoid loading it for them.
    // Inventory routing keeps its own existing behavior.
    if (wdReportIsInventoryMode()) return true;
    return wdReportIsAdminUser();
}

function wdReportDefaultJobTypes() {
    return wdReportIsInventoryMode()
        ? ['Transfer', 'Restock', 'Return', 'Usage']
        : ['Invoice', 'IPC Application', 'IPC Processed', 'PR', 'Credit Note', 'Cancel', 'Original PO', 'Other'];
}

function wdReportRenderNoAccessState() {
    const tabsContainer = document.getElementById('report-tabs');
    if (tabsContainer) tabsContainer.innerHTML = '';
    if (reportingCountDisplay) reportingCountDisplay.textContent = '';
    if (typeof wdUiUpdateMiniMetrics === 'function') wdUiUpdateMiniMetrics('job-records-summary-strip', [], 'Job Records');
    if (reportingTableBody) {
        reportingTableBody.innerHTML = `
            <tr>
                <td colspan="12">
                    <div class="wd-modern-empty-row wd-select-category-state">
                        <i class="fa-solid fa-lock"></i>
                        <strong>Job Records is Admin only</strong>
                        <span>Your WorkDesk view is attention-oriented to reduce Firebase downloads.</span>
                    </div>
                </td>
            </tr>`;
    }
}

function wdReportRenderLazyShell() {
    const tabsContainer = document.getElementById('report-tabs');
    const defaultTypes = wdReportDefaultJobTypes();
    if (tabsContainer) {
        tabsContainer.innerHTML = defaultTypes.map(jobType => {
            const activeClass = (jobType === currentReportFilter) ? 'active' : '';
            return `<button class="${activeClass}" data-job-type="${jobType}">${jobType}</button>`;
        }).join('');
    }
    if (reportingCountDisplay) reportingCountDisplay.textContent = '';
    if (typeof wdUiUpdateMiniMetrics === 'function') wdUiUpdateMiniMetrics('job-records-summary-strip', [], wdReportIsInventoryMode() ? 'Inventory Records' : 'Job Records');
    if (reportingTableBody) {
        reportingTableBody.innerHTML = `
            <tr>
                <td colspan="12">
                    <div class="wd-modern-empty-row wd-select-category-state">
                        <i class="fa-solid fa-hand-pointer"></i>
                        <strong>No records loaded yet</strong>
                        <span>Select a category or type a search. Firebase data will load only after that action.</span>
                    </div>
                </td>
            </tr>`;
    }
}

function wdReportDisplayJobType(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'Other';
    // 10.1.6: old saved IPC records should appear under the renamed IPC Processed tab.
    return raw === 'IPC' ? 'IPC Processed' : raw;
}

function wdReportSetActiveTab(jobType) {
    currentReportFilter = jobType || null;
    const tabsContainer = document.getElementById('report-tabs');
    if (!tabsContainer) return;
    tabsContainer.querySelectorAll('button[data-job-type]').forEach(btn => {
        btn.classList.toggle('active', !!jobType && btn.dataset.jobType === jobType);
    });
}


function wdUiSetRecordsHeroContext(mode) {
    const isInventory = String(mode || '').toLowerCase() === 'inventory';
    const hero = document.querySelector('#wd-reporting .wd-page-hero');
    if (hero) {
        hero.classList.toggle('wd-page-hero-records-inventory', isInventory);
        hero.classList.toggle('wd-page-hero-records', !isInventory);
    }

    const eyebrow = document.querySelector('#wd-reporting .wd-page-eyebrow');
    if (eyebrow) {
        eyebrow.innerHTML = isInventory
            ? '<i class="fa-solid fa-warehouse"></i> Inventory Records Center'
            : '<i class="fa-solid fa-chart-line"></i> WorkDesk Records Center';
    }

    const title = document.querySelector('#wd-reporting .wd-page-hero h1');
    if (title) title.textContent = isInventory ? 'Inventory Job Records' : 'Job Records';

    const subtitle = document.querySelector('#wd-reporting .wd-page-hero p');
    if (subtitle) {
        subtitle.textContent = isInventory
            ? 'Inventory movement history arranged by Control ID, product, route, quantity, contact, and current status.'
            : 'Searchable job history arranged for fast review by category, PO, site, vendor, attention, and current status.';
    }

    const metricLabel = document.querySelector('#wd-reporting .wd-page-hero-metric small');
    if (metricLabel) metricLabel.textContent = isInventory ? 'Inventory records' : 'Visible records';

    const searchInput = document.getElementById('reporting-search');
    if (searchInput) {
        searchInput.placeholder = isInventory
            ? 'Search control ID, product, route, contact, status...'
            : 'Search job, PO, vendor, site, attention, status, note...';
    }
}

function renderReportingTable(entries) {
    reportingTableBody.innerHTML = '';

    const inventoryTypes = (Array.isArray(window.INVENTORY_TYPES) ? window.INVENTORY_TYPES : ['Transfer', 'Restock', 'Return', 'Usage']);
    const isInventoryReport = ((typeof isInventoryContext === 'function' && isInventoryContext()) || inventoryTypes.includes(currentReportFilter));

    // 7.5.5 — Inventory Job Records renderer moved to js/app-inventory.js.
    // Keep WorkDesk/Invoice rendering here only.
    if (isInventoryReport) {
        wdUiSetRecordsHeroContext('inventory');
        if (typeof renderInventoryJobRecordsTable === 'function') {
            return renderInventoryJobRecordsTable(entries);
        }

        console.warn('Inventory Job Records renderer is missing. Check js/app-inventory.js.');
        const tableHead = document.querySelector('#reporting-printable-area table thead');
        const reportingTable = document.querySelector('#reporting-printable-area table');
        if (reportingTable) reportingTable.classList.add('inv-job-records-table');
        if (reportingTableBody) reportingTableBody.classList.add('inv-job-records-body');
        if (tableHead) {
            tableHead.innerHTML = `
                <tr>
                    <th>Control ID</th><th>Product Name</th><th>Site Route</th>
                    <th>Ordered Qty</th><th>Delivered Qty</th><th>Shipping Date</th>
                    <th>Arrival Date</th><th>Contact</th><th>Status / Remarks</th>
                </tr>`;
        }
        if (reportingTableBody) {
            reportingTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px; color:#b91c1c;">Inventory Job Records renderer is not loaded.</td></tr>';
        }
        return;
    }

    wdUiSetRecordsHeroContext('workdesk');
    const tableHead = document.querySelector('#reporting-printable-area table thead');
    const reportingTable = document.querySelector('#reporting-printable-area table');
    if (reportingTable) reportingTable.classList.add('wd-modern-table', 'wd-records-modern-table');

    // 7.8.2: Remove Inventory Active/Completed switch when returning to WorkDesk/Invoice records.
    const invStageSwitch = document.getElementById('inventory-job-records-stage-switch');
    if (invStageSwitch) invStageSwitch.remove();

    if (reportingTable) {
        reportingTable.classList.remove('inv-job-records-table');
    }
    if (reportingTableBody) {
        reportingTableBody.classList.remove('inv-job-records-body');
    }

    if (tableHead) {
        tableHead.innerHTML = `
            <tr>
                <th>Job</th><th>Ref</th><th>Site</th><th>PO</th>
                <th>Vendor Name</th><th>Amount</th><th>Entered By</th>
                <th>Date Entered</th><th>Attention</th><th>Date Responded</th>
                <th>Note</th><th>Status</th>
            </tr>`;
    }

    const totalRecords = Array.isArray(entries) ? entries.length : 0;

    if (!entries || totalRecords === 0) {
        if (document.getElementById('job-records-count-display')) {
            document.getElementById('job-records-count-display').textContent = `(Total Records: 0)`;
        }
        if (typeof wdUiUpdateMiniMetrics === 'function') wdUiUpdateMiniMetrics('job-records-summary-strip', [], 'Job Records');
        reportingTableBody.innerHTML = `<tr><td colspan="12"><div class="wd-modern-empty-row"><i class="fa-solid fa-folder-open"></i><strong>No entries found</strong><span>Try another category or search term.</span></div></td></tr>`;
        return;
    }

    if (document.getElementById('job-records-count-display')) {
        document.getElementById('job-records-count-display').textContent = `(Total Records: ${totalRecords})`;
    }

    if (typeof wdUiUpdateMiniMetrics === 'function') {
        wdUiUpdateMiniMetrics('job-records-summary-strip', entries, 'Job Records');
    }

    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', entry.key);

        const esc = (typeof wdUiEscape === 'function') ? wdUiEscape : (v) => String(v == null ? '' : v);
        const badge = (typeof wdUiStatusBadge === 'function') ? wdUiStatusBadge : (v) => esc(v || 'Pending');
        const tone = (typeof wdUiStatusTone === 'function') ? wdUiStatusTone : () => 'default';
        const status = entry.remarks || 'Pending';
        const currentNote = String(entry.note || entry.details || entry.currentNote || '').trim();
        row.className = 'wd-modern-row tone-' + tone(status);
        let actions = `<button class="history-btn action-btn wd-row-action wd-action-history wd-history-icon-only" onclick="event.stopPropagation(); showJobHistory('${esc(entry.key)}')" title="View History" aria-label="View History"><i class="fa-solid fa-clock-rotate-left"></i></button>`;

        row.innerHTML = `
            <td><span class="wd-table-kicker">${esc(wdReportDisplayJobType(entry.for || ''))}</span></td>
            <td><span class="wd-ref-chip">${esc(entry.ref || '')}</span></td>
            <td><span class="wd-site-badge"><i class="fa-solid fa-location-dot"></i>${esc(entry.site || '')}</span></td>
            <td><span class="wd-po-code">${esc(entry.po || '')}</span></td>
            <td><strong class="wd-vendor-name">${esc(entry.vendorName || 'N/A')}</strong></td>
            <td class="wd-amount-cell">${esc(entry.amount || '')}</td>
            <td><span class="wd-user-chip">${esc(entry.enteredBy || '')}</span></td>
            <td><span class="wd-date-chip">${esc(entry.date || '')}</span></td>
            <td><span class="wd-attention-chip">${esc(entry.attention || '')}</span></td>
            <td><span class="wd-date-chip">${esc(entry.dateResponded || '—')}</span></td>
            <td><div class="wd-record-note-cell" title="${esc(currentNote)}">${currentNote ? esc(currentNote) : '<span class="wd-muted-dash">—</span>'}</div></td>
            <td><div class="wd-record-status-cell">${badge(status)}${actions}</div></td>
        `;

        reportingTableBody.appendChild(row);
    });
}

function filterAndRenderReport(baseEntries = null) {
    // 7.5.5 — Inventory Job Records filtering moved to js/app-inventory.js.
    if (typeof isInventoryContext === 'function' && isInventoryContext()) {
        if (typeof filterAndRenderInventoryJobRecords === 'function') {
            return filterAndRenderInventoryJobRecords(baseEntries);
        }
        console.warn('Inventory Job Records filter is missing. Falling back to main renderer.');
    }

    // WorkDesk/Invoice Job Records source only.
    const chosenSource = Array.isArray(baseEntries) ? baseEntries : getWorkdeskJobRecordEntries();
    let filteredEntries = [...chosenSource].filter(entry => isWorkdeskTaskRecord(entry));

    // Search text is intentionally applied BEFORE category filtering.
    // 10.7.5: Admin Job Records search should be global, so an admin does not
    // need to know the exact category tab before searching a PO/job.
    const searchText = String(reportingSearchInput?.value || '').toLowerCase().trim();
    sessionStorage.setItem('reportingSearch', searchText);

    if (searchText) {
        filteredEntries = filteredEntries.filter(entry => {
            const check = (val) => val && String(val).toLowerCase().includes(searchText);

            return (
                check(entry.for) ||
                check(entry.ref) ||
                check(entry.po) ||
                check(entry.amount) ||
                check(entry.site) ||
                check(entry.attention) ||
                check(entry.enteredBy) ||
                check(entry.date) ||
                check(entry.vendorName) ||
                check(entry.note) ||
                check(entry.details) ||
                check(entry.currentNote)
            );
        });

        const matchingTypes = [...new Set(filteredEntries.map(entry => wdReportDisplayJobType(entry.for || 'Other')).filter(Boolean))];
        if (matchingTypes.length === 1) {
            // One clear result category: auto-highlight that tab.
            wdReportSetActiveTab(matchingTypes[0]);
        } else if (matchingTypes.length !== 1) {
            // Multiple/no categories: do not force the search into the old selected tab.
            wdReportSetActiveTab(null);
        }

        renderReportingTable(filteredEntries);
        return;
    }

    // No search text: keep normal selected-tab behavior.
    if (currentReportFilter && currentReportFilter !== 'All') {
        filteredEntries = filteredEntries.filter(entry => wdReportDisplayJobType(entry.for || 'Other') === currentReportFilter);
    }

    wdReportSetActiveTab(currentReportFilter);
    renderReportingTable(filteredEntries);
}

// ==========================================================================
// REPLACED FUNCTION: handleReportingSearch (Clean Start / Lazy Render)
// ==========================================================================
async function handleReportingSearch(options = {}) {
    const userAction = options && options.userAction === true;
    const reason = String(options && options.reason || '').toLowerCase();
    const searchTextNow = String(reportingSearchInput?.value || '').trim();
    const hasSelectedTab = !!(currentReportFilter && currentReportFilter !== 'All');
    const shouldLoad = userAction && (reason === 'tab' || reason === 'search' || searchTextNow || hasSelectedTab);

    if (!wdReportCanOpenCurrentRecords()) {
        wdReportRenderNoAccessState();
        return;
    }

    // 10.3.3: Opening Job Records must not immediately fetch Firebase data.
    // Admin sees the tabs/shell first; records load only after a tab click or search.
    if (!shouldLoad) {
        wdReportRenderLazyShell();
        return;
    }

    // Show loading only after a real user action.
    reportingTableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading selected records...</td></tr>';

    try {
        // 10.3.1/10.3.3: WorkDesk Job Records stay on the WorkDesk database only.
        // Do not fetch invoiceentry-b15a8/invoice_entries here; full invoice history
        // such as With Accounts belongs in Invoice Management > Invoice Records.
        await ensureAllEntriesFetched(false, { mode: wdReportIsInventoryMode() ? 'inventory' : 'workdesk' });
        await reconcilePendingPRs();

        // Build tabs from the current module family only after the first real load.
        let baseEntries = getJobRecordsBaseEntriesForCurrentContext();

        const uniqueJobTypes = [...new Set(baseEntries.map(entry => wdReportDisplayJobType(entry.for || 'Other')))];
        uniqueJobTypes.sort();

        // Keep default tabs available even when the selected family has no loaded rows yet.
        const finalJobTypes = uniqueJobTypes.length ? uniqueJobTypes : wdReportDefaultJobTypes();
        if (currentReportFilter && !finalJobTypes.includes(currentReportFilter)) {
            currentReportFilter = null;
        }
        let tabsHTML = '';
        finalJobTypes.forEach(jobType => {
            const activeClass = (jobType === currentReportFilter) ? 'active' : '';
            tabsHTML += `<button class="${activeClass}" data-job-type="${jobType}">${jobType}</button>`;
        });

        const tabsContainer = document.getElementById('report-tabs');
        if (tabsContainer) tabsContainer.innerHTML = tabsHTML;

        const savedSearch = sessionStorage.getItem('reportingSearch');
        // 10.7.6: First search after opening Job Records must render from the live
        // input value, not only from the old sessionStorage value or selected tab.
        // Without this, searching a PO before choosing a tab can show 0/lazy state,
        // while choosing the Invoice tab first shows the correct record.
        if (
            searchTextNow ||
            (savedSearch && savedSearch.trim() !== '') ||
            (currentReportFilter && currentReportFilter !== 'All')
        ) {
             filterAndRenderReport(baseEntries);
        } else {
             wdReportRenderLazyShell();
        }

    } catch (error) {
        console.error("Error loading reporting:", error);
        reportingTableBody.innerHTML = '<tr><td colspan="12" style="color:red; text-align:center;">Error loading data.</td></tr>';
    }
}

// ==========================================================================
// UPDATED FUNCTION: renderActiveTaskTable (Uses handleSRVDone)
// ==========================================================================

// #endregion BLOCK 13 — JOB RECORDS TABLE + REPORT FILTERING
