/* ==========================================================================
   js/app-workdesk-reporting.js
   IBA WorkDesk/Inventory Job Records table and report filter helpers.
   Version: 10.1.0

   Cleanup Phase:
   - Moved Block 13 out of app.js.
   - Function names and existing behavior are preserved.
   - No Firebase paths, invoice save logic, or inventory renderer logic changed.
   ========================================================================== */

// #region BLOCK 13 — JOB RECORDS TABLE + REPORT FILTERING
// Purpose: Desktop job records table, inventory grouping rows, totals, search/filter rendering.
// =================================================================================================


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
            <td><span class="wd-table-kicker">${esc(entry.for || '')}</span></td>
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

    // 1. Filter by Tab (Job Type)
    if (currentReportFilter && currentReportFilter !== 'All') {
        filteredEntries = filteredEntries.filter(entry => (entry.for || 'Other') === currentReportFilter);
    }

    // 2. Filter by Search Text
    const searchText = reportingSearchInput.value.toLowerCase();
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
    }

    renderReportingTable(filteredEntries);
}

// ==========================================================================
// REPLACED FUNCTION: handleReportingSearch (Clean Start / Lazy Render)
// ==========================================================================
async function handleReportingSearch() {
    // Show loading initially
    reportingTableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:20px;">Loading categories...</td></tr>';

    try {
        // 1. Load All Data (Still required to build the buttons)
        await ensureAllEntriesFetched();
        await ensureInvoiceDataFetched(false);
        await reconcilePendingPRs();

        // 2. Build Tabs from the current module family only.
        // Inventory gets transfer_entries only; WorkDesk gets job_entries only.
        let baseEntries = getJobRecordsBaseEntriesForCurrentContext();

        const uniqueJobTypes = [...new Set(baseEntries.map(entry => entry.for || 'Other'))];
        uniqueJobTypes.sort();

        
        // Safety: if the previously-selected tab isn't available (e.g., desktop hides inventory tabs), reset.
        if (currentReportFilter && !uniqueJobTypes.includes(currentReportFilter)) {
            currentReportFilter = null;
        }
let tabsHTML = '';

        // --- CHANGE: Do NOT auto-select the first tab ---
        uniqueJobTypes.forEach(jobType => {
            const activeClass = (jobType === currentReportFilter) ? 'active' : '';
            tabsHTML += `<button class="${activeClass}" data-job-type="${jobType}">${jobType}</button>`;
        });

        const tabsContainer = document.getElementById('report-tabs');
        if (tabsContainer) tabsContainer.innerHTML = tabsHTML;

        // 3. Render Logic (The "Clean" Check)
        const savedSearch = sessionStorage.getItem('reportingSearch');

        // Condition A: If user typed in Search box, show results immediately
        if (savedSearch && savedSearch.trim() !== '') {
             filterAndRenderReport(baseEntries);
        }
        // Condition B: If user clicked a tab (Filter is active), show results
        else if (currentReportFilter && currentReportFilter !== 'All') {
             filterAndRenderReport(baseEntries);
        }
        // Condition C: CLEAN START (No Search, No Tab Clicked)
        else {
             reportingTableBody.innerHTML = `
                <tr>
                    <td colspan="12">
                        <div class="wd-modern-empty-row wd-select-category-state">
                            <i class="fa-solid fa-arrow-up-wide-short"></i>
                            <strong>Select a Category above</strong>
                            <span>${(typeof isInventoryContext === 'function' && isInventoryContext()) ? '(Transfer, Restock, Return, Usage)' : '(e.g., IPC, Invoice, PR)' } to view records.</span>
                        </div>
                    </td>
                </tr>`;
             // Clear the count display
             if (reportingCountDisplay) reportingCountDisplay.textContent = '';
             if (typeof wdUiUpdateMiniMetrics === 'function') wdUiUpdateMiniMetrics('job-records-summary-strip', [], 'Job Records');
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
