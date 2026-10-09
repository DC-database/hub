/* ==========================================================================
   js/app-workdesk-reporting.js
   IBA WorkDesk/Inventory Job Records table and report filter helpers.
   Version: 11.5.1

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

   10.9.9:
   - WorkDesk Job Records search now respects a manually selected Job Records tab.
   - If no tab was manually selected, search remains global across existing Job Records tabs.
   - Search remains contains-based/flexible and now includes Status/remarks explicitly.
   - Clear button support removes the selected tab/highlight through the companion clear patch.

   11.5.0:
   - Job Records can print the exact rows produced by the current tab/search filters.
   - The report includes a current category, optional search term, visible-row count,
     and generated timestamp without changing filtering or Firebase data.

   11.5.1:
   - Build a dedicated plain-text print table so responsive screen cards and buttons
     cannot collapse or leak into the printed report.
   - Install a temporary A4 landscape page override only while Job Records prints.
   ========================================================================== */

// #region BLOCK 13 — JOB RECORDS TABLE + REPORT FILTERING
// Purpose: Desktop job records table, inventory grouping rows, totals, search/filter rendering.
// =================================================================================================



function wdReportClipVendor(name) {
    // 14.0.0 patch 3: full vendor name; the column trims long names with "…" (css/iba-ui.css)
    // and the cell tooltip still shows the whole name.
    const s = String(name == null || name === '' ? 'N/A' : name).trim() || 'N/A';
    return s;
}

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

function wdReportOrderedJobTypes(foundTypes) {
    const defaults = wdReportDefaultJobTypes();
    const found = [...new Set((foundTypes || []).map((t) => String(t || '').trim()).filter(Boolean))];
    const extras = found.filter((t) => !defaults.includes(t));
    return defaults.concat(extras);
}

function isWorkdeskRecordCompleted(entry) {
    const text = String(entry?.remarks || entry?.status || '').toLowerCase();
    return /completed|closed|cancelled|canceled|done|resolved/.test(text);
}

function getWorkdeskJobRecordsStageFilter() {
    const val = String(window.workdeskJobRecordsStageFilter || 'Active').trim();
    return val === 'Completed' ? 'Completed' : 'Active';
}

function setWorkdeskJobRecordsStageFilter(stage) {
    window.workdeskJobRecordsStageFilter = (stage === 'Completed') ? 'Completed' : 'Active';
}

function ensureWorkdeskJobRecordsFolder() {
    const reporting = document.getElementById('wd-reporting');
    const tabs = document.getElementById('report-tabs');
    const stage = document.getElementById('wd-job-records-stage-switch');
    let folder = document.getElementById('wd-jr-folder');

    if (wdReportIsInventoryMode() || !reporting || !tabs) {
        if (folder) {
            const host = document.querySelector('#wd-reporting .report-tabs-container') || reporting;
            if (tabs && folder.contains(tabs) && host) host.appendChild(tabs);
            if (stage && folder.contains(stage) && folder.parentNode) folder.parentNode.insertBefore(stage, folder);
            folder.remove();
        }
        return;
    }

    if (!folder) {
        folder = document.createElement('div');
        folder.id = 'wd-jr-folder';
        folder.className = 'wd-jr-folder';
        const controls = document.querySelector('#wd-reporting .report-controls');
        if (controls && controls.parentNode) controls.parentNode.insertBefore(folder, controls.nextSibling);
        else reporting.insertBefore(folder, reporting.firstChild);
    }

    if (tabs.parentNode !== folder) folder.appendChild(tabs);
    tabs.classList.add('wd-jr-tabs');
    if (stage && stage.parentNode !== folder) folder.appendChild(stage);
    if (stage) stage.classList.add('wd-jr-body');
    folder.style.setProperty('display', 'inline-flex', 'important');
    folder.style.setProperty('flex-direction', 'column', 'important');
    folder.style.setProperty('gap', '0', 'important');
    tabs.style.setProperty('margin', '0', 'important');
    tabs.style.setProperty('padding', '0', 'important');
    tabs.style.setProperty('position', 'relative', 'important');
    tabs.style.setProperty('z-index', '3', 'important');
    if (stage) {
        stage.style.setProperty('margin', '0', 'important');
        stage.style.setProperty('margin-top', '0', 'important');
        stage.style.setProperty('border-top', '0', 'important');
        stage.style.setProperty('border-top-left-radius', '0', 'important');
        stage.style.setProperty('border-top-right-radius', '0', 'important');
        stage.style.setProperty('border-bottom-left-radius', '16px', 'important');
        stage.style.setProperty('border-bottom-right-radius', '16px', 'important');
        stage.style.setProperty('padding', '8px 10px', 'important');
        stage.style.setProperty('position', 'relative', 'important');
        stage.style.setProperty('z-index', '1', 'important');
        stage.style.setProperty('backdrop-filter', 'blur(10px)', 'important');
        stage.style.setProperty('-webkit-backdrop-filter', 'blur(10px)', 'important');
    }
    layoutWorkdeskJobRecordsFolder();
}

function layoutWorkdeskJobRecordsFolder() {
    const folder = document.getElementById('wd-jr-folder');
    const tabs = document.getElementById('report-tabs');
    if (!folder || !tabs) return;
    ['invoice', 'ipc-application', 'ipc-processed', 'pr', 'credit-note', 'cancel', 'original-po', 'other'].forEach((tone) => {
        folder.classList.remove('wd-jr-tone-' + tone);
        folder.classList.remove('inv-wh-tone-' + tone);
    });
    const type = String((typeof currentReportFilter !== 'undefined' && currentReportFilter) || 'Invoice');
    const tone = (typeof jobRecordsToneSlug === 'function') ? jobRecordsToneSlug(type) : 'invoice';
    folder.classList.add('wd-jr-tone-' + tone);

    const stage = document.getElementById('wd-job-records-stage-switch');
    const buttons = Array.from(tabs.querySelectorAll('button'));
    folder.style.width = 'auto';
    tabs.style.width = 'max-content';
    buttons.forEach((btn) => {
        btn.style.flex = '0 0 auto';
        btn.style.width = 'auto';
    });
    if (stage) {
        stage.style.width = '0px';
        stage.style.minWidth = '0';
    }
    requestAnimationFrame(() => {
        const live = Array.from(tabs.querySelectorAll('button')).filter((btn) => btn.offsetParent !== null || btn.getClientRects().length);
        const use = live.length ? live : buttons;
        const first = use[0];
        const last = use[use.length - 1];
        if (!first || !last) return;
        const w = Math.ceil(last.getBoundingClientRect().right - first.getBoundingClientRect().left);
        if (w > 40) {
            folder.style.setProperty('width', w + 'px', 'important');
            folder.style.setProperty('max-width', w + 'px', 'important');
            folder.style.setProperty('box-sizing', 'border-box', 'important');
            if (stage) {
                stage.style.setProperty('width', '100%', 'important');
                stage.style.setProperty('max-width', '100%', 'important');
                stage.style.setProperty('min-width', '0', 'important');
                stage.style.setProperty('box-sizing', 'border-box', 'important');
            }
        }
    });
}

function ensureWorkdeskJobRecordsStageSwitch() {
    if (wdReportIsInventoryMode()) {
        if (typeof isolateJobRecordsStage === 'function') isolateJobRecordsStage('inventory');
        return;
    }
    const wrap = document.getElementById('wd-job-records-stage-switch');
    if (wrap) wrap.remove();
    if (typeof ensureWorkdeskJobRecordsFolder === 'function') ensureWorkdeskJobRecordsFolder();
}

function wdReportRenderNoAccessState() {
    wdReportUpdateJobRecordsPrintHeader([]);
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
    wdReportUpdateJobRecordsPrintHeader([]);
    const tabsContainer = document.getElementById('report-tabs');
    const defaultTypes = wdReportDefaultJobTypes();
    if (tabsContainer && !wdReportIsInventoryMode()) {
        tabsContainer.innerHTML = '';
    } else if (tabsContainer) {
        tabsContainer.innerHTML = defaultTypes.map(jobType => {
            const activeClass = (jobType === currentReportFilter) ? 'active' : '';
            return `<button class="${activeClass}" data-job-type="${jobType}">${jobType}</button>`;
        }).join('');
    }
    if (!wdReportIsInventoryMode()) ensureWorkdeskJobRecordsStageSwitch({ active: 0, completed: 0 });
    else if (typeof ensureInventoryWorkHistoryFolder === 'function') ensureInventoryWorkHistoryFolder();
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
    if (raw === 'IPC') return 'IPC Processed';
    const defaults = wdReportDefaultJobTypes();
    const hit = defaults.find((t) => t.toLowerCase() === raw.toLowerCase());
    return hit || raw;
}

function wdReportSetActiveTab(jobType) {
    currentReportFilter = jobType || null;
    const tabsContainer = document.getElementById('report-tabs');
    if (!tabsContainer) return;
    tabsContainer.querySelectorAll('button[data-job-type]').forEach(btn => {
        btn.classList.toggle('active', !!jobType && btn.dataset.jobType === jobType);
    });
}

function wdReportHasManualTabFilter() {
    return !!(window.__wdReportManualTabFilter === true && currentReportFilter && currentReportFilter !== 'All');
}

function wdReportMarkManualTabFilter(isManual) {
    try { window.__wdReportManualTabFilter = !!isManual; } catch (_) {}
}

function wdReportSetPrintButtonState(hasRecords) {
    const button = document.getElementById('print-report-button');
    if (!button) return;

    const isInventory = wdReportIsInventoryMode();
    button.style.display = isInventory ? 'none' : 'inline-flex';
    button.disabled = isInventory || !hasRecords;
    button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
    button.title = button.disabled
        ? 'Select a Job Records category or search to load records first'
        : 'Print every record currently listed in the Job Records table';
}

function wdReportRefreshPrintGeneratedAt() {
    const generated = document.getElementById('wd-job-records-print-generated');
    if (!generated) return;

    generated.textContent = `Generated: ${new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`;
}

function wdReportBuildPrintRows(entries) {
    const printBody = document.getElementById('wd-job-records-print-body');
    if (!printBody) return;

    printBody.innerHTML = '';
    const visibleEntries = Array.isArray(entries) ? entries : [];
    visibleEntries.forEach(entry => {
        const row = document.createElement('tr');
        const currentNote = String(entry.note || entry.details || entry.currentNote || '').trim();
        const values = [
            wdReportDisplayJobType(entry.for || ''),
            entry.ref || '',
            entry.site || '',
            entry.po || '',
            entry.vendorName || 'N/A',
            entry.amount || '',
            entry.enteredBy || '',
            entry.date || '',
            entry.attention || '',
            entry.dateResponded || '—',
            currentNote || '—',
            entry.remarks || 'Pending'
        ];

        values.forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = String(value == null ? '' : value);
            row.appendChild(cell);
        });
        printBody.appendChild(row);
    });
}

function wdReportUpdateJobRecordsPrintHeader(entries) {
    const visibleEntries = Array.isArray(entries) ? entries : [];
    const searchText = String(reportingSearchInput?.value || '').trim();
    const selectedCategory = (currentReportFilter && currentReportFilter !== 'All')
        ? currentReportFilter
        : '';
    const categoryLabel = selectedCategory || 'All Job Records';
    const reportTitle = selectedCategory
        ? `${selectedCategory} Job Records Report`
        : (searchText ? 'Filtered Job Records Report' : 'Job Records Report');

    const title = document.getElementById('wd-job-records-print-title');
    const category = document.getElementById('wd-job-records-print-category');
    const search = document.getElementById('wd-job-records-print-search');
    const searchItem = document.getElementById('wd-job-records-print-search-item');
    const printMeta = document.querySelector('.wd-job-records-print-meta');
    const total = document.getElementById('wd-job-records-print-total');

    if (title) title.textContent = reportTitle;
    if (category) category.textContent = categoryLabel;
    if (search) search.textContent = searchText;
    if (searchItem) searchItem.style.display = searchText ? '' : 'none';
    if (printMeta) printMeta.classList.toggle('has-search', !!searchText);
    if (total) total.textContent = String(visibleEntries.length);

    wdReportRefreshPrintGeneratedAt();
    wdReportBuildPrintRows(visibleEntries);
    wdReportSetPrintButtonState(visibleEntries.length > 0);
}

function prepareWorkdeskJobRecordsPrint() {
    const printBody = document.getElementById('wd-job-records-print-body');
    if (!printBody || printBody.querySelectorAll('tr').length === 0) return false;

    wdReportRefreshPrintGeneratedAt();

    let pageStyle = document.getElementById('wd-job-records-page-override');
    if (!pageStyle) {
        pageStyle = document.createElement('style');
        pageStyle.id = 'wd-job-records-page-override';
        pageStyle.media = 'print';
        document.head.appendChild(pageStyle);
    }
    pageStyle.textContent = '@page { size: A4 landscape; margin: 6mm; }';
    return true;
}

function cleanupWorkdeskJobRecordsPrint() {
    const pageStyle = document.getElementById('wd-job-records-page-override');
    if (pageStyle) pageStyle.remove();
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

    const printButton = document.getElementById('print-report-button');
    if (printButton) {
        printButton.style.display = isInventory ? 'none' : 'inline-flex';
        if (isInventory) {
            printButton.disabled = true;
            printButton.setAttribute('aria-disabled', 'true');
        }
    }
}

function renderReportingTable(entries) {
    reportingTableBody.innerHTML = '';

    const inventoryTypes = (Array.isArray(window.INVENTORY_TYPES) ? window.INVENTORY_TYPES : ['Transfer', 'Restock', 'Return', 'Usage']);
    const isInventoryReport = (typeof isInventoryContext === 'function' && isInventoryContext()) || wdReportIsInventoryMode();

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
    const reportingTable = document.getElementById('job-records-table');
    const tableHead = reportingTable ? reportingTable.querySelector('thead') : null;
    const printHead = document.querySelector('#wd-job-records-print-table thead');
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
        tableHead.style.display = '';
        tableHead.innerHTML = `
            <tr>
                <th>Job</th><th>Ref</th><th>Site</th><th>PO</th>
                <th>Vendor Name</th><th>Amount</th><th>Entered By</th>
                <th>Date Entered</th><th>Attention</th><th>Date Responded</th>
                <th>Note</th><th>Status</th>
            </tr>`;
    }
    if (printHead) printHead.innerHTML = tableHead ? tableHead.innerHTML : '';

    const totalRecords = Array.isArray(entries) ? entries.length : 0;
    wdReportUpdateJobRecordsPrintHeader(entries);

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
        const statusLabel = /^converted to invoice$/i.test(String(status)) ? 'Converted' : status;
        const currentNote = String(entry.note || entry.details || entry.currentNote || '').trim();
        row.className = 'wd-modern-row tone-' + tone(status);
        let actions = `<button class="history-btn action-btn wd-row-action wd-action-history wd-history-icon-only" onclick="event.stopPropagation(); showJobHistory('${esc(entry.key)}')" title="View History" aria-label="View History"><i class="fa-solid fa-clock-rotate-left"></i></button>`;

        row.innerHTML = `
            <td><span class="wd-table-kicker">${esc(wdReportDisplayJobType(entry.for || ''))}</span></td>
            <td><span class="wd-ref-chip">${esc(entry.ref || '')}</span></td>
            <td><span class="wd-site-badge"><i class="fa-solid fa-location-dot"></i>${esc(entry.site || '')}</span></td>
            <td><span class="wd-po-code">${esc(entry.po || '')}</span></td>
            <td title="${esc(entry.vendorName || 'N/A')}"><span class="wd-vendor-name">${esc(wdReportClipVendor(entry.vendorName))}</span></td>
            <td class="wd-amount-cell">${esc(entry.amount || '')}</td>
            <td><span class="wd-user-chip">${esc(entry.enteredBy || '')}</span></td>
            <td><span class="wd-date-chip">${esc(entry.date || '')}</span></td>
            <td><span class="wd-attention-chip">${esc(entry.attention || '')}</span></td>
            <td><span class="wd-date-chip">${esc(entry.dateResponded || '—')}</span></td>
            <td><div class="wd-record-note-cell" title="${esc(currentNote)}">${currentNote ? esc(currentNote) : '<span class="wd-muted-dash">—</span>'}</div></td>
            <td><div class="wd-record-status-cell">${badge(statusLabel)}${actions}</div></td>
        `;

        reportingTableBody.appendChild(row);
    });
    wdMarkJobRecordFadeEdges();
}

// 14.0.0 patch 8: same result as before (first / last visible cell of every
// row gets the fade edge), but much lighter. The visible columns are read once
// from one row instead of from every cell of every row, rows that already
// carry the right marks are left alone, nothing runs while Job Records is not
// on screen, and body class changes are handled at most once per frame.
// Before, every body class change (opening a popup, hovering the side panel)
// re-measured every cell, even on other pages.
function wdMarkJobRecordFadeEdges() {
    const table = document.getElementById('job-records-table');
    if (!table || !table.offsetParent) return;
    const rows = table.tBodies && table.tBodies[0] ? table.tBodies[0].rows : table.querySelectorAll('tbody tr');
    if (!rows || !rows.length) return;
    const visibleIndexes = (tr) => {
        const out = [];
        Array.from(tr.children).forEach((td, i) => {
            if (td.tagName === 'TD' && getComputedStyle(td).display !== 'none') out.push(i);
        });
        return out;
    };
    // Rows of the same shape share the same visible columns; measure each shape once.
    const shapeCache = new Map();
    for (let r = 0; r < rows.length; r++) {
        const tr = rows[r];
        const cells = tr.children;
        if (!cells.length) continue;
        const shape = cells.length + '|' + (cells[0].colSpan || 1);
        let vis = shapeCache.get(shape);
        if (!vis) { vis = visibleIndexes(tr); shapeCache.set(shape, vis); }
        const first = vis.length ? vis[0] : -1;
        const last = vis.length ? vis[vis.length - 1] : -1;
        for (let c = 0; c < cells.length; c++) {
            const td = cells[c];
            const wantLeft = c === first;
            const wantRight = c === last;
            if (td.classList.contains('wd-fade-left') !== wantLeft) td.classList.toggle('wd-fade-left', wantLeft);
            if (td.classList.contains('wd-fade-right') !== wantRight) td.classList.toggle('wd-fade-right', wantRight);
        }
    }
}
if (!window.__wdFadeEdgeWatch) {
    window.__wdFadeEdgeWatch = true;
    let wdFadeEdgeFrame = 0;
    new MutationObserver(() => {
        if (wdFadeEdgeFrame) return;
        wdFadeEdgeFrame = requestAnimationFrame(() => {
            wdFadeEdgeFrame = 0;
            if (typeof wdMarkJobRecordFadeEdges === 'function') wdMarkJobRecordFadeEdges();
        });
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
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

    const searchText = String(reportingSearchInput?.value || '').toLowerCase().trim();
    // 14.0.0 patch 2: Job Records keeps its own saved search.
    if (window.ibaSurfaces) window.ibaSurfaces.writeSearch('records', searchText, 'workdesk');
    else sessionStorage.setItem('reportingSearch', searchText);

    const selectedJobType = (currentReportFilter && currentReportFilter !== 'All') ? currentReportFilter : null;
    const restrictSearchToSelectedTab = !!(searchText && selectedJobType && wdReportHasManualTabFilter());

    if (restrictSearchToSelectedTab) {
        filteredEntries = filteredEntries.filter(entry => wdReportDisplayJobType(entry.for || 'Other') === selectedJobType);
    }

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
                check(entry.currentNote) ||
                check(entry.remarks) ||
                check(entry.status)
            );
        });

        if (restrictSearchToSelectedTab) {
            wdReportSetActiveTab(selectedJobType);
        } else {
            const matchingTypes = [...new Set(filteredEntries.map(entry => wdReportDisplayJobType(entry.for || 'Other')).filter(Boolean))];
            if (matchingTypes.length === 1) {
                wdReportMarkManualTabFilter(false);
                wdReportSetActiveTab(matchingTypes[0]);
            } else {
                wdReportMarkManualTabFilter(false);
                wdReportSetActiveTab(null);
            }
        }
    } else if (selectedJobType) {
        filteredEntries = filteredEntries.filter(entry => wdReportDisplayJobType(entry.for || 'Other') === selectedJobType);
        wdReportSetActiveTab(selectedJobType);
    } else {
        wdReportSetActiveTab(selectedJobType);
    }

    ensureWorkdeskJobRecordsStageSwitch();

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
    const shouldLoad = (!wdReportIsInventoryMode() && reason === 'open')
        || (userAction && (reason === 'tab' || reason === 'search' || searchTextNow || hasSelectedTab));

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

    // 14.0.0 patch 2: load ticket. If the user switches between Job Records and
    // Work History before this load finishes, the late result is dropped.
    const ibaLoadTicket = window.ibaSurfaces ? window.ibaSurfaces.beginLoad('records') : null;
    if (window.ibaSurfaces) window.ibaSurfaces.markRecordsSurface();

    // Show loading only after a real user action.
    wdReportSetPrintButtonState(false);
    reportingTableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading selected records...</td></tr>';

    try {
        // 10.3.1/10.3.3: WorkDesk Job Records stay on the WorkDesk database only.
        // Do not fetch invoiceentry-b15a8/invoice_entries here; full invoice history
        // such as With Accounts belongs in Invoice Management > Invoice Records.
        await ensureAllEntriesFetched(false, { mode: wdReportIsInventoryMode() ? 'inventory' : 'workdesk' });
        await reconcilePendingPRs();
        if (window.ibaSurfaces && !window.ibaSurfaces.isCurrent(ibaLoadTicket)) return; // 14.0.0 patch 2

        // Build tabs from the current module family only after the first real load.
        let baseEntries = getJobRecordsBaseEntriesForCurrentContext();

        const uniqueJobTypes = [...new Set(baseEntries.map(entry => wdReportDisplayJobType(entry.for || 'Other')))];
        let finalJobTypes = wdReportOrderedJobTypes(uniqueJobTypes);
        if (!wdReportIsInventoryMode()) {
            const defaults = wdReportDefaultJobTypes();
            const extras = uniqueJobTypes.filter((jobType) => !defaults.includes(jobType));
            finalJobTypes = defaults.filter((jobType) => uniqueJobTypes.includes(jobType)).concat(extras);
            if (!finalJobTypes.includes(currentReportFilter)) currentReportFilter = finalJobTypes[0] || null;
        } else if (currentReportFilter && !finalJobTypes.includes(currentReportFilter)) {
            currentReportFilter = null;
        }
        let tabsHTML = '';
        finalJobTypes.forEach(jobType => {
            const activeClass = (jobType === currentReportFilter) ? 'active' : '';
            tabsHTML += `<button class="${activeClass}" data-job-type="${jobType}">${jobType}</button>`;
        });

        const tabsContainer = document.getElementById('report-tabs');
        if (!wdReportIsInventoryMode() && !finalJobTypes.length) {
            if (tabsContainer) tabsContainer.innerHTML = '';
            currentReportFilter = null;
            renderReportingTable([]);
            return;
        }
        if (tabsContainer) tabsContainer.innerHTML = tabsHTML;
        if (!wdReportIsInventoryMode()) ensureWorkdeskJobRecordsStageSwitch({ active: 0, completed: 0 });
        else if (typeof ensureInventoryWorkHistoryFolder === 'function') ensureInventoryWorkHistoryFolder();

        const savedSearch = window.ibaSurfaces ? window.ibaSurfaces.readSearch('records') : sessionStorage.getItem('reportingSearch');
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
        wdReportSetPrintButtonState(false);
        reportingTableBody.innerHTML = '<tr><td colspan="12" style="color:red; text-align:center;">Error loading data.</td></tr>';
    }
}

// ==========================================================================
// UPDATED FUNCTION: renderActiveTaskTable (Uses handleSRVDone)
// ==========================================================================

// #endregion BLOCK 13 — JOB RECORDS TABLE + REPORT FILTERING
