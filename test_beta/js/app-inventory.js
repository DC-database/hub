// =================================================================================================
// IBA — Inventory JS Foundation
// Version: 8.4.4
// Purpose: Inventory context/type helpers separated from app.js.
// Keep this file lightweight. Do not move stock saving/approval logic here until later phases.
// =================================================================================================

// Inventory task type family used by both WorkDesk filtering and Inventory rendering.
var INVENTORY_TYPES = window.INVENTORY_TYPES || ['Transfer', 'Restock', 'Return', 'Usage'];
window.INVENTORY_TYPES = INVENTORY_TYPES;

// Inventory mode can be triggered by:
// - URL query: ?mode=inventory
// - URL query: ?open=inventory / ?module=inventory
// - Hash: #inventory
function isDirectInventoryOpenRequested() {
    try {
        const params = new URLSearchParams(window.location.search);
        const mode = String(params.get('mode') || '').toLowerCase();
        const open = String(params.get('open') || '').toLowerCase();
        const module = String(params.get('module') || '').toLowerCase();
        const hash = String(window.location.hash || '').toLowerCase().replace('#', '');
        return mode === 'inventory' || mode === 'materialstock' || mode === 'material-stock' ||
               open === 'inventory' || module === 'inventory' || hash === 'inventory';
    } catch (e) {
        return false;
    }
}

function isInventoryContext() {
    // Once the user chooses a module, trust the live module state first.
    // This prevents ?mode=inventory from leaking into normal WorkDesk after returning home.
    const activeModule = String(window.__ibaActiveModule || '').toLowerCase();
    if (activeModule === 'inventory') return true;
    if (activeModule === 'workdesk' || activeModule === 'invoice' || activeModule === 'home') return false;

    if (typeof isDirectInventoryOpenRequested === 'function' && isDirectInventoryOpenRequested()) return true;

    const href = (window.location.href || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    const title = (document.title || '').toLowerCase();

    if (document.body && (document.body.classList.contains('inventory-page') || document.body.classList.contains('inventory-mode'))) return true;
    if (href.includes('inventory') || path.includes('inventory') || title.includes('inventory')) return true;

    const invView = document.getElementById('inventory-view');
    if (invView && !invView.classList.contains('hidden')) return true;

    // Detect the older WorkDesk clone used only for Inventory/Material Stock access.
    try {
        const wdView = document.getElementById('workdesk-view');
        const wdNav = document.getElementById('workdesk-nav');
        const wdViewVisible = (!wdView || !wdView.classList.contains('hidden'));
        if (wdNav && wdViewVisible) {
            const navText = (wdNav.textContent || '').toLowerCase();
            const hasMaterial = !!wdNav.querySelector('.wd-nav-material') || navText.includes('material stock');
            const hasActiveTask = !!wdNav.querySelector('.wd-nav-activetask') || navText.includes('active task');
            const hasJobRecords = !!wdNav.querySelector('.wd-nav-reporting') || navText.includes('job records');
            const hasDashboard = !!wdNav.querySelector('.wd-nav-dashboard') || navText.includes('dashboard');

            const idEl = document.getElementById('wd-user-identifier');
            const idText = ((idEl && idEl.textContent) ? idEl.textContent : '').toLowerCase();
            const idSaysInventory = idText.includes('inventory');

            if (hasMaterial && hasActiveTask && hasJobRecords && (!hasDashboard || idSaysInventory)) {
                return true;
            }
        }
    } catch (e) { /* ignore */ }

    return false;
}

function isInventoryTaskRecord(task) {
    if (!task) return false;
    const type = String(task.for || task.jobType || '').trim();
    const src = String(task.source || '').trim();
    return src === 'transfer_entry' || (Array.isArray(INVENTORY_TYPES) && INVENTORY_TYPES.includes(type));
}

function isWorkdeskTaskRecord(task) {
    return !!task && !isInventoryTaskRecord(task);
}

function getInventoryJobRecordEntries() {
    const source = (typeof inventorySystemEntries !== 'undefined' && Array.isArray(inventorySystemEntries) && inventorySystemEntries.length)
        ? inventorySystemEntries
        : ((typeof allSystemEntries !== 'undefined' && Array.isArray(allSystemEntries)) ? allSystemEntries.filter(entry => isInventoryTaskRecord(entry)) : []);
    return source;
}

function getWorkdeskJobRecordEntries() {
    const source = (typeof workdeskSystemEntries !== 'undefined' && Array.isArray(workdeskSystemEntries) && workdeskSystemEntries.length)
        ? workdeskSystemEntries
        : ((typeof allSystemEntries !== 'undefined' && Array.isArray(allSystemEntries)) ? allSystemEntries.filter(entry => isWorkdeskTaskRecord(entry)) : []);
    return source;
}

function getJobRecordsBaseEntriesForCurrentContext() {
    return (typeof isInventoryContext === 'function' && isInventoryContext())
        ? getInventoryJobRecordEntries()
        : getWorkdeskJobRecordEntries();
}



// =================================================================================================
// 7.8.1 — Inventory Job Records Active / Completed switch
// Purpose: Keep open jobs separate from closed/completed jobs inside Inventory Job Records.
// =================================================================================================
function getInventoryJobRecordsStageFilter() {
    const val = (window.inventoryJobRecordsStageFilter || 'Active').toString();
    return val === 'Completed' ? 'Completed' : 'Active';
}

function setInventoryJobRecordsStageFilter(stage) {
    window.inventoryJobRecordsStageFilter = (stage === 'Completed') ? 'Completed' : 'Active';
}

function getInventoryRecordStatusText(entry) {
    return (entry?.remarks || entry?.status || entry?.transferStatus || entry?.jobStatus || '').toString().trim();
}

function isInventoryRecordCompletedOrClosed(entry) {
    const st = getInventoryRecordStatusText(entry).toLowerCase();
    if (!st) return false;

    // Completed/received/closed records belong to the Completed folder.
    // Rejected/cancelled records are also closed records, not active tasks.
    return (
        st.includes('completed') ||
        st.includes('complete') ||
        st.includes('received') ||
        st.includes('final') ||
        st.includes('closed') ||
        st.includes('rejected') ||
        st.includes('cancelled') ||
        st.includes('canceled')
    );
}

function ensureInventoryJobRecordsStageSwitch(counts = {}) {
    const isInv = (typeof isInventoryContext === 'function') ? isInventoryContext() : false;
    let wrap = document.getElementById('inventory-job-records-stage-switch');

    if (!isInv) {
        if (wrap) wrap.remove();
        return;
    }

    const reportControls = document.querySelector('#wd-reporting .report-controls');
    const printableArea = document.getElementById('reporting-printable-area');
    const anchor = reportControls || printableArea;
    if (!anchor || !anchor.parentNode) return;

    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'inventory-job-records-stage-switch';
        wrap.className = 'inv-job-stage-switch';
        if (reportControls && reportControls.nextSibling) {
            reportControls.parentNode.insertBefore(wrap, reportControls.nextSibling);
        } else if (printableArea) {
            printableArea.parentNode.insertBefore(wrap, printableArea);
        } else {
            anchor.parentNode.appendChild(wrap);
        }
    }

    const activeCount = Number(counts.active || 0);
    const completedCount = Number(counts.completed || 0);
    const current = getInventoryJobRecordsStageFilter();

    wrap.innerHTML = `
        <button type="button" class="inv-stage-btn ${current === 'Active' ? 'active' : ''}" data-inv-stage="Active">
            <span class="inv-stage-main">Active Jobs</span>
            <span class="inv-stage-count">${activeCount}</span>
        </button>
        <button type="button" class="inv-stage-btn ${current === 'Completed' ? 'active' : ''}" data-inv-stage="Completed">
            <span class="inv-stage-main">Completed / Closed</span>
            <span class="inv-stage-count">${completedCount}</span>
        </button>
    `;

    if (!wrap.dataset.bound) {
        wrap.dataset.bound = '1';
        wrap.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-inv-stage]');
            if (!btn) return;
            setInventoryJobRecordsStageFilter(btn.dataset.invStage || 'Active');
            if (typeof filterAndRenderInventoryJobRecords === 'function') {
                filterAndRenderInventoryJobRecords();
            }
        });
    }
}

function removeInventoryJobRecordsStageSwitch() {
    const wrap = document.getElementById('inventory-job-records-stage-switch');
    if (wrap) wrap.remove();
}

// =================================================================================================
// 7.5.5 — Inventory Job Records filtering + rendering
// Purpose: Keep Inventory Job Records table ownership outside main app.js.
// WorkDesk/Invoice Job Records stays inside app.js for now.
// =================================================================================================
function filterAndRenderInventoryJobRecords(baseEntries = null) {
    const chosenSource = Array.isArray(baseEntries) ? baseEntries : getInventoryJobRecordEntries();
    let filteredEntries = [...chosenSource].filter(entry => isInventoryTaskRecord(entry));

    // Inventory tabs: Transfer / Usage / Return / Restock / All
    if (currentReportFilter && currentReportFilter !== 'All') {
        filteredEntries = filteredEntries.filter(entry => (entry.for || entry.jobType || 'Other') === currentReportFilter);
    }

    const searchText = reportingSearchInput ? String(reportingSearchInput.value || '').toLowerCase() : '';
    try { sessionStorage.setItem('reportingSearch', searchText); } catch (_) {}

    if (searchText) {
        filteredEntries = filteredEntries.filter(entry => {
            const check = (val) => val && String(val).toLowerCase().includes(searchText);
            return (
                check(entry.for) ||
                check(entry.jobType) ||
                check(entry.ref) ||
                check(entry.po) ||
                check(entry.amount) ||
                check(entry.site) ||
                check(entry.attention) ||
                check(entry.enteredBy) ||
                check(entry.date) ||
                check(entry.vendorName) ||
                check(entry.controlId) ||
                check(entry.productName) ||
                check(entry.contactName) ||
                check(entry.sourceSite) ||
                check(entry.destinationSite)
            );
        });
    }

    const stageCounts = filteredEntries.reduce((acc, entry) => {
        if (isInventoryRecordCompletedOrClosed(entry)) acc.completed += 1;
        else acc.active += 1;
        return acc;
    }, { active: 0, completed: 0 });

    ensureInventoryJobRecordsStageSwitch(stageCounts);

    const stage = getInventoryJobRecordsStageFilter();
    filteredEntries = filteredEntries.filter(entry => {
        const completed = isInventoryRecordCompletedOrClosed(entry);
        return stage === 'Completed' ? completed : !completed;
    });

    renderInventoryJobRecordsTable(filteredEntries);
}

function renderInventoryJobRecordsTable(entries) {
    if (!reportingTableBody) return;
    if (typeof wdUiSetRecordsHeroContext === 'function') wdUiSetRecordsHeroContext('inventory');
    reportingTableBody.innerHTML = '';

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

    const totalRecords = Array.isArray(entries) ? entries.length : 0;
    const countDisplay = document.getElementById('job-records-count-display');

    if (!entries || totalRecords === 0) {
        if (countDisplay) countDisplay.textContent = `(Total Records: 0)`;
        if (typeof wdUiUpdateMiniMetrics === 'function') wdUiUpdateMiniMetrics('job-records-summary-strip', [], 'Inventory Records');
        reportingTableBody.innerHTML = '<tr><td colspan="9"><div class="wd-modern-empty-row"><i class="fa-solid fa-box-open"></i><strong>No inventory records found</strong><span>Select another inventory category or search term.</span></div></td></tr>';
        return;
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const esc = (typeof _escapeHtml === 'function')
        ? _escapeHtml
        : (val) => String(val ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

    const makeSafeId = (str) => {
        const base = (str ?? '').toString().trim();
        const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '_');
        return (cleaned || 'NO_CONTROL_ID').slice(0, 60);
    };

    const groups = [];
    const groupMap = new Map();

    entries.forEach((entry, idx) => {
        const rawCid = (entry.controlId ?? '').toString().trim();
        const cidKey = rawCid !== '' ? rawCid : `NO_CONTROL_ID_${idx}`;
        if (!groupMap.has(cidKey)) {
            const groupId = `cid_${makeSafeId(cidKey)}_${groups.length}`;
            const g = { cidKey, displayCid: rawCid || '(No Control ID)', groupId, items: [] };
            groupMap.set(cidKey, g);
            groups.push(g);
        }
        groupMap.get(cidKey).items.push(entry);
    });

    if (countDisplay) {
        countDisplay.textContent = `(Groups: ${groups.length} | Records: ${totalRecords})`;
    }
    if (typeof wdUiUpdateMiniMetrics === 'function') wdUiUpdateMiniMetrics('job-records-summary-strip', entries, 'Inventory Records');

    bindInventoryJobRecordGroupToggle();

    const invTypeClass = (type) => {
        const t = (type || '').toString().trim().toLowerCase();
        if (t === 'transfer') return 'inv-type-transfer';
        if (t === 'usage') return 'inv-type-usage';
        if (t === 'return') return 'inv-type-return';
        if (t === 'restock') return 'inv-type-restock';
        return 'inv-type-other';
    };

    const invStatusClass = (status) => {
        const st = (status || 'Pending').toString().trim().toLowerCase();
        if (st.includes('approved') || st.includes('completed')) return 'approved';
        if (st.includes('reject')) return 'rejected';
        if (st.includes('transit')) return 'transit';
        if (st.includes('pending')) return 'pending';
        return 'neutral';
    };

    const buildInvStatusBadge = (status) => {
        const safeStatus = esc(status || 'Pending');
        return `<span class="inv-job-status-badge inv-job-status-${invStatusClass(status)}">${safeStatus}</span>`;
    };

    const buildInventoryRow = (entry, opts = {}) => {
        const isChild = !!opts.isChild;
        const itemIndex = Number.isFinite(opts.itemIndex) ? opts.itemIndex : null;
        const type = entry.for || entry.jobType;
        const controlCell = isChild
            ? `<span class="inv-child-connector"></span><span class="inv-child-index">${itemIndex !== null ? itemIndex : ''}</span>`
            : `<strong class="inv-control-id-text">${esc(entry.controlId || '')}</strong><span class="inv-type-pill ${invTypeClass(type)}">${esc(type || 'Inventory')}</span>`;

        const noteDisplay = entry.note ? `<div class="inv-job-note">${esc(entry.note)}</div>` : '';

        let actions = `<button class="print-btn waybill-btn" data-key="${entry.key}" style="padding:2px 6px; margin-right:5px; font-size:0.7rem; background:#6f42c1; color:white; border:none; border-radius:4px;" title="Print Waybill"><i class="fa-solid fa-print"></i></button>`;
        actions += `<button class="history-btn action-btn" onclick="showTransferHistory('${entry.key}')" style="padding:2px 6px; margin-right:5px; font-size:0.7rem; background:#17a2b8; color:white; border:none; border-radius:4px;" title="View History"><i class="fa-solid fa-clock-rotate-left"></i></button>`;
        if (isAdmin) {
            actions += `<button type="button" class="delete-btn transfer-delete-btn" data-key="${entry.key}" style="padding:2px 6px; font-size:0.7rem; border-radius:4px;">Del</button>`;
        }

        return `
            <td class="inv-control-cell">${controlCell}</td>
            <td class="inv-product-cell">${esc(entry.productName || '')}</td>
            <td class="inv-route-cell">${esc(entry.site || '')}</td>
            <td class="inv-qty-cell">${esc(entry.orderedQty || 0)}</td>
            <td class="inv-qty-cell">${esc(entry.deliveredQty || 0)}</td>
            <td>${esc(entry.shippingDate || '')}</td>
            <td>${esc(entry.arrivalDate || '')}</td>
            <td>${esc(entry.contactName || '')}</td>
            <td class="inv-status-cell">
                ${buildInvStatusBadge(entry.remarks || 'Pending')}
                ${noteDisplay}
                <div class="inv-row-actions">${actions}</div>
            </td>
        `;
    };

    groups.forEach(g => {
        const items = g.items || [];
        if (items.length <= 1) {
            const entry = items[0];
            const row = document.createElement('tr');
            row.className = `inventory-record-single-row inv-job-single-row ${invTypeClass(entry.for || entry.jobType)}`;
            row.setAttribute('data-key', entry.key);
            row.innerHTML = buildInventoryRow(entry);
            reportingTableBody.appendChild(row);
            return;
        }

        const uniqueProducts = Array.from(new Set(items.map(x => (x.productName || '').toString().trim()).filter(Boolean)));
        const productSummary = uniqueProducts.length === 1 ? uniqueProducts[0] : `Multiple (${uniqueProducts.length})`;

        const uniqueSites = Array.from(new Set(items.map(x => (x.site || '').toString().trim()).filter(Boolean)));
        const siteSummary = uniqueSites.length === 1 ? uniqueSites[0] : (uniqueSites.length > 1 ? `Multiple (${uniqueSites.length})` : '');

        const sumNum = (val) => {
            const n = parseFloat(val);
            return Number.isFinite(n) ? n : 0;
        };
        const totalOrdered = items.reduce((acc, x) => acc + sumNum(x.orderedQty), 0);
        const totalDelivered = items.reduce((acc, x) => acc + sumNum(x.deliveredQty), 0);

        const groupRow = document.createElement('tr');
        groupRow.className = `inventory-group-row inv-job-group-row ${invTypeClass(items[0]?.for || items[0]?.jobType)}`;
        groupRow.dataset.groupId = g.groupId;
        groupRow.dataset.expanded = '0';

        const groupJobType = items[0]?.for || items[0]?.jobType || 'Inventory';
        const firstShippingDate = items.map(x => x.shippingDate || '').find(Boolean) || '';
        const firstArrivalDate = items.map(x => x.arrivalDate || '').find(Boolean) || '';
        const firstContact = items.map(x => x.contactName || '').find(Boolean) || '';

        groupRow.innerHTML = `
            <td class="inv-group-id-cell">
                <span class="group-toggle-icon">▶</span>
                <strong class="inv-control-id-text">${esc(g.displayCid)}</strong>
                <span class="inv-type-pill ${invTypeClass(groupJobType)}">${esc(groupJobType)}</span>
            </td>
            <td class="inv-group-product-cell">
                <strong>${esc(productSummary)}</strong>
                <span class="group-count-badge">${items.length} items</span>
            </td>
            <td>${esc(siteSummary)}</td>
            <td class="inv-qty-cell">${esc(totalOrdered)}</td>
            <td class="inv-qty-cell">${esc(totalDelivered)}</td>
            <td>${esc(firstShippingDate)}</td>
            <td>${esc(firstArrivalDate)}</td>
            <td>${esc(firstContact)}</td>
            <td class="inv-group-status-cell">
                <span class="inv-expand-hint">Click to expand</span>
            </td>
        `;
        reportingTableBody.appendChild(groupRow);

        items.forEach((entry, idx) => {
            const child = document.createElement('tr');
            child.className = `inventory-child-row inv-job-child-row ${invTypeClass(entry.for || entry.jobType)}`;
            child.dataset.parent = g.groupId;
            child.style.display = 'none';
            child.setAttribute('data-key', entry.key);
            child.innerHTML = buildInventoryRow(entry, { isChild: true, itemIndex: idx + 1 });
            reportingTableBody.appendChild(child);
        });
    });
}

function bindInventoryJobRecordGroupToggle() {
    if (!reportingTableBody || reportingTableBody.dataset.inventoryGroupToggleBound) return;
    reportingTableBody.dataset.inventoryGroupToggleBound = '1';
    reportingTableBody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr.inventory-group-row');
        if (!tr) return;
        if (e.target.closest('button, a, input, select, textarea, label')) return;

        const groupId = tr.dataset.groupId;
        if (!groupId) return;

        const expanded = tr.dataset.expanded === '1';

        if (!expanded) {
            const openGroups = reportingTableBody.querySelectorAll('tr.inventory-group-row[data-expanded="1"]');
            openGroups.forEach(g => {
                if (g === tr) return;
                const ogid = g.dataset.groupId;
                if (!ogid) return;

                const ochildren = reportingTableBody.querySelectorAll(`tr.inventory-child-row[data-parent="${ogid}"]`);
                ochildren.forEach(r => { r.style.display = 'none'; });

                g.dataset.expanded = '0';
                const oicon = g.querySelector('.group-toggle-icon');
                if (oicon) oicon.textContent = '▶';
            });
        }

        const children = reportingTableBody.querySelectorAll(`tr.inventory-child-row[data-parent="${groupId}"]`);
        children.forEach(row => {
            row.style.display = expanded ? 'none' : '';
        });

        tr.dataset.expanded = expanded ? '0' : '1';

        const icon = tr.querySelector('.group-toggle-icon');
        if (icon) icon.textContent = expanded ? '▶' : '▼';
    });
}

// Explicit exports for future module cleanup. Current code still uses classic global functions.
window.getInventoryJobRecordsStageFilter = getInventoryJobRecordsStageFilter;
window.setInventoryJobRecordsStageFilter = setInventoryJobRecordsStageFilter;
window.isInventoryRecordCompletedOrClosed = isInventoryRecordCompletedOrClosed;
window.ensureInventoryJobRecordsStageSwitch = ensureInventoryJobRecordsStageSwitch;
window.removeInventoryJobRecordsStageSwitch = removeInventoryJobRecordsStageSwitch;
window.isDirectInventoryOpenRequested = isDirectInventoryOpenRequested;
window.isInventoryContext = isInventoryContext;
window.isInventoryTaskRecord = isInventoryTaskRecord;
window.isWorkdeskTaskRecord = isWorkdeskTaskRecord;
window.getInventoryJobRecordEntries = getInventoryJobRecordEntries;
window.getWorkdeskJobRecordEntries = getWorkdeskJobRecordEntries;
window.getJobRecordsBaseEntriesForCurrentContext = getJobRecordsBaseEntriesForCurrentContext;
window.filterAndRenderInventoryJobRecords = filterAndRenderInventoryJobRecords;
window.renderInventoryJobRecordsTable = renderInventoryJobRecordsTable;
window.bindInventoryJobRecordGroupToggle = bindInventoryJobRecordGroupToggle;


// =================================================================================================
// 7.5.6 — Inventory Active Task rendering
// Purpose: Keep Inventory Active Task desktop/mobile renderer ownership outside main app.js.
// WorkDesk/Invoice Active Task remains inside app.js for now.
// =================================================================================================
function renderInventoryActiveTaskTable(tasks) {
    // Moved from app.js in 7.5.6. Keep Inventory Active Task UI owned by app-inventory.js.
    if (typeof wdUiSetActiveTaskHeroContext === 'function') wdUiSetActiveTaskHeroContext('inventory');
    const inventoryTasks = (Array.isArray(tasks) ? tasks : []).filter(t => isInventoryTaskRecord(t));
    const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : (window.innerWidth <= 768);
    if (isMobile) {
        if (typeof renderInventoryMobileActiveTasks === 'function') renderInventoryMobileActiveTasks(inventoryTasks);
        else if (typeof renderMobileActiveTasks === 'function') renderMobileActiveTasks(inventoryTasks);
        return;
    }

    activeTaskTableBody.innerHTML = '';

    const activeTaskTable = document.querySelector('#wd-activetask table');
    if (activeTaskTable) activeTaskTable.classList.add('wd-modern-table', 'wd-inventory-modern-table');
    if (typeof wdUiUpdateMiniMetrics === 'function') wdUiUpdateMiniMetrics('active-task-summary-strip', inventoryTasks, 'Inventory Tasks');

    const filteredTasks = inventoryTasks.filter(function(task) {
        if (currentActiveTaskFilter === 'All') return true;
        return task.for === currentActiveTaskFilter;
    });

    const tableHead = document.querySelector('#wd-activetask table thead');
    if (tableHead) {
        tableHead.innerHTML =
            '<tr>' +
                '<th class="desktop-only">Control ID</th>' +
                '<th class="desktop-only">Product Name</th>' +
                '<th class="desktop-only">Details</th>' +
                '<th class="desktop-only">Movement</th>' +
                '<th class="desktop-only">Current Qty</th>' +
                '<th class="desktop-only">Contact</th>' +
                '<th class="desktop-only">Status</th>' +
                '<th class="desktop-only">Action</th>' +
            '</tr>';
    }

    if (filteredTasks.length === 0) {
        activeTaskTableBody.innerHTML = '<tr><td colspan="8"><div class="wd-modern-empty-row"><i class="fa-solid fa-clipboard-check"></i><strong>No inventory tasks found</strong><span>No item under "' + currentActiveTaskFilter + '" right now.</span></div></td></tr>';
        return;
    }

    const userRole = (currentApprover.Role || '').toLowerCase();

    const getControlKey = (t) => String(t.ref || t.controlId || t.controlNumber || '').trim() || 'N/A';

    const getMovementText = (t) => {
        const fromLoc = t.fromSite || t.fromLocation || 'N/A';
        const toLoc = t.toSite || t.toLocation || 'N/A';
        let movement = `${fromLoc} ➔ ${toLoc}`;
        if (t.for === 'Usage') movement = `Consumed at ${fromLoc}`;
        return movement;
    };

    const getDisplayQty = (t) => {
        let displayQty = parseFloat(t.orderedQty ?? t.requiredQty ?? 0) || 0;
        if (t.approvedQty !== undefined && t.approvedQty !== null) {
            displayQty = parseFloat(t.approvedQty) || displayQty;
        }
        if (t.receivedQty !== undefined && t.receivedQty !== null) {
            displayQty = parseFloat(t.receivedQty) || displayQty;
        }
        return displayQty;
    };

    const getStatusColor = (status) => {
        if (status === 'Pending' || status === 'Pending Admin') return '#dc3545';
        if (status === 'Approved') return '#28a745';
        if (status === 'Completed') return '#003A5C';
        return '#333';
    };

    const renderTransferRow = (task, { isChild = false } = {}) => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', task.key);
        row.classList.toggle('controlid-group-child', isChild);
        row.classList.add('wd-modern-row', 'wd-inventory-row', 'tone-' + ((typeof wdUiStatusTone === 'function') ? wdUiStatusTone(task.remarks || task.status || 'Pending') : 'default'));

        if (task.isUrgent === false) {
            row.style.opacity = '0.7';
            row.style.backgroundColor = '#f9f9f9';
        }

        let actionButtons = '<button class="transfer-action-btn" data-key="' + task.key + '" style="background-color: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">Action</button>';

        // Inventory keeps its own action flow. Delete is intentionally hidden here
        // so Inventory Active Task no longer borrows the old WorkDesk admin-delete UI.
        if (false && userRole === 'admin') {
            actionButtons += '<button type="button" class="delete-btn transfer-delete-btn" data-key="' + task.key + '" style="margin-left: 5px; padding: 6px 12px;">Delete</button>';
        }

        const movement = getMovementText(task);

        let displayQty = task.orderedQty || task.requiredQty || 0;
        let qtyLabel = "";
        if (task.approvedQty !== undefined && task.approvedQty !== null) {
            displayQty = task.approvedQty;
            if (displayQty != task.orderedQty) qtyLabel = " (Adj)";
        }
        if (task.receivedQty !== undefined && task.receivedQty !== null) {
            displayQty = task.receivedQty;
            qtyLabel = "";
        }

        const statusColor = getStatusColor(task.remarks);

        const controlCell = isChild
            ? '<td class="desktop-only controlid-child-cell"><span class="controlid-child-marker">↳</span> ' + (getControlKey(task)) + '</td>'
            : '<td class="desktop-only"><strong>' + (getControlKey(task)) + '</strong></td>';

        row.innerHTML =
            controlCell +
            '<td class="desktop-only">' + (task.vendorName || task.productName || '') + '</td>' +
            '<td class="desktop-only">' + (task.details || '') + '</td>' +
            '<td class="desktop-only">' + movement + '</td>' +
            '<td class="desktop-only" style="font-weight: bold; color: #003A5C;">' + displayQty + qtyLabel + '</td>' +
            '<td class="desktop-only">' + (task.contactName || task.requestor || '') + '</td>' +
            '<td class="desktop-only"><span style="color: ' + statusColor + '; font-weight: bold;">' + task.remarks + '</span></td>' +
            '<td class="desktop-only">' + actionButtons + '</td>';

        return row;
    };

    // Group Inventory tasks by Control ID (accordion)
    const groups = new Map();
    filteredTasks.forEach(t => {
        const k = getControlKey(t);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
    });

    const safeSelectorValue = (value) => String(value || '').replace(/"/g, '');

    const closeAllGroups = () => {
        document.querySelectorAll('#active-task-table-body tr.controlid-group-child').forEach(r => { r.style.display = 'none'; });
        document.querySelectorAll('#active-task-table-body tr.controlid-group-header').forEach(r => { r.classList.remove('open'); });
    };

    const openGroup = (groupId) => {
        const safeId = safeSelectorValue(groupId);
        document.querySelectorAll('#active-task-table-body tr.controlid-group-child[data-parent-group="' + safeId + '"]').forEach(r => { r.style.display = 'table-row'; });
        const header = document.querySelector('#active-task-table-body tr.controlid-group-header[data-group-id="' + safeId + '"]');
        if (header) header.classList.add('open');
    };

    const groupIds = Array.from(groups.keys()).sort((a, b) => String(a).localeCompare(String(b)));
    groupIds.forEach(groupId => {
        const items = groups.get(groupId) || [];
        if (items.length <= 1) {
            activeTaskTableBody.appendChild(renderTransferRow(items[0]));
            return;
        }

        const first = items[0] || {};
        const productName = first.vendorName || first.productName || '';
        const uniqueDetails = Array.from(new Set(items.map(i => String(i.details || '').trim()).filter(Boolean)));
        const detailsSummary = uniqueDetails.length === 0 ? '' : (uniqueDetails.length === 1 ? uniqueDetails[0] : 'Multiple records');

        const uniqueMov = Array.from(new Set(items.map(getMovementText)));
        const movementSummary = uniqueMov.length === 1 ? uniqueMov[0] : 'Multiple';

        const totalQty = items.reduce((sum, t) => sum + getDisplayQty(t), 0);
        const uniqueContacts = Array.from(new Set(items.map(i => String(i.contactName || i.requestor || '').trim()).filter(Boolean)));
        const contactSummary = uniqueContacts.length === 0 ? '' : (uniqueContacts.length === 1 ? uniqueContacts[0] : 'Multiple');

        const uniqueStatuses = Array.from(new Set(items.map(i => String(i.remarks || '').trim()).filter(Boolean)));
        const statusSummary = uniqueStatuses.length === 0 ? '' : (uniqueStatuses.length === 1 ? uniqueStatuses[0] : 'Multiple');
        const statusColor = uniqueStatuses.length === 1 ? getStatusColor(statusSummary) : '#333';

        const groupIsUrgent = items.some(t => t.isUrgent === true);
        const headerRow = document.createElement('tr');
        headerRow.className = 'controlid-group-header wd-modern-row wd-inventory-group-row tone-' + ((typeof wdUiStatusTone === 'function') ? wdUiStatusTone(statusSummary || 'Pending') : 'default');
        headerRow.setAttribute('data-group-id', safeSelectorValue(groupId));

        if (!groupIsUrgent) {
            headerRow.style.opacity = '0.7';
            headerRow.style.backgroundColor = '#f9f9f9';
        }

        headerRow.innerHTML =
            '<td class="desktop-only"><span class="group-toggle-icon">▸</span> <strong>' + groupId + '</strong> <span class="controlid-group-count">(' + items.length + ')</span></td>' +
            '<td class="desktop-only">' + productName + '</td>' +
            '<td class="desktop-only">' + detailsSummary + '</td>' +
            '<td class="desktop-only">' + movementSummary + '</td>' +
            '<td class="desktop-only" style="font-weight: bold; color: #003A5C;">' + (Number.isFinite(totalQty) ? totalQty : '') + ' <span class="controlid-group-total-label">(Total)</span></td>' +
            '<td class="desktop-only">' + contactSummary + '</td>' +
            '<td class="desktop-only"><span style="color: ' + statusColor + '; font-weight: bold;">' + statusSummary + '</span></td>' +
            '<td class="desktop-only"><span class="controlid-group-hint">Click to expand</span></td>';

        headerRow.addEventListener('click', () => {
            const isOpen = headerRow.classList.contains('open');
            closeAllGroups();
            if (!isOpen) openGroup(groupId);
        });

        activeTaskTableBody.appendChild(headerRow);

        items.forEach(item => {
            const childRow = renderTransferRow(item, { isChild: true });
            childRow.setAttribute('data-parent-group', safeSelectorValue(groupId));
            childRow.style.display = 'none';
            activeTaskTableBody.appendChild(childRow);
        });
    });
}



function renderInventoryMobileActiveTasks(tasks) {
    // Moved from app.js in 7.5.6.
    // 7.3.5: Inventory has its own mobile renderer entry point and receives
    // inventory-only tasks. Internally it reuses the existing card builder for
    // now to keep approvals/checkboxes stable.
    return renderMobileActiveTasks((Array.isArray(tasks) ? tasks : []).filter(t => isInventoryTaskRecord(t)));
}



// =================================================================================================
// 7.6.9 — Inventory Mobile Material Finder (preview/search only)
// Purpose: Mobile-only item lookup with suggestion picker, photo, stock balance, and recent movement history.
// No CRUD, no stock writes, no approval changes.
// =================================================================================================
(function inventoryMobileMaterialFinderModule(){
    const PHOTO_BASE_URL = 'https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/Photo/';
    let materialCache = null;
    let movementCache = null;
    let siteCache = null;
    let isLoadingMaterials = false;
    let barcodeScannerStream = null;
    let barcodeScannerTimer = null;
    let barcodeScannerActive = false;

    // 7.7.6 — Mobile Transfer Request Cart foundation + manual source-site picker.
    // Request stage is separated from official transfer_entries so no stock movement happens here.
    const TRANSFER_REQUEST_CART_KEY = 'iba_inventory_transfer_request_cart_v1';
    const TRANSFER_REQUEST_SUBMIT_POSITIONS = ['site dc', 'procurement', 'coo', 'ceo', 'reception', 'logistic', 'storekeeper'];
    const TRANSFER_REQUEST_REVIEW_POSITIONS = ['logistic', 'storekeeper'];
    // 7.7.7 — Delete pending requests is narrower than review/conversion.
    // Logistic, COO, and Super Admin can delete; Storekeeper can review/convert but not delete.
    const TRANSFER_REQUEST_DELETE_POSITIONS = ['logistic', 'coo'];
    let transferRequestFormItemKey = '';

    function isInventoryFinderMobileActive() {
        const mobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
        const inv = (typeof isInventoryContext === 'function') ? isInventoryContext() : ((window.__ibaActiveModule || '') === 'inventory');
        return !!(mobile && inv);
    }

    function invFinderEscape(value) {
        if (typeof _escapeHtml === 'function') return _escapeHtml(value);
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function invFinderNumber(value) {
        const n = parseFloat(String(value ?? '').replace(/,/g, ''));
        return Number.isFinite(n) ? n : 0;
    }

    function invFinderQty(value) {
        const n = invFinderNumber(value);
        return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    function invFinderPhotoUrl(item) {
        const direct = String(item?.photoUrl || item?.photoURL || item?.imageUrl || item?.imageURL || '').trim();
        if (direct) return direct;
        let name = String(item?.photoName || item?.photo || item?.photoFile || item?.photoFileName || '').trim();
        if (!name) return '';
        name = name.replace(/^\/+/, '').replace(/\.(jpg|jpeg|png|webp)$/i, '');
        return PHOTO_BASE_URL + encodeURIComponent(name) + '.jpg';
    }

    function invFinderProductId(item) {
        return String(item?.productId || item?.productID || item?.ProductID || item?.id || '').trim();
    }

    function invFinderProductName(item) {
        return String(item?.productName || item?.ProductName || item?.name || item?.vendorName || '').trim();
    }

    function invFinderDetails(item) {
        return String(item?.details || item?.detail || item?.description || item?.relation || '').trim();
    }

    function invFinderBarcodeText(item) {
        return String(item?.barcode || item?.barcodeNo || item?.barcodeNumber || item?.itemBarcode || item?.productBarcode || item?.productCode || item?.itemCode || item?.sku || '').trim();
    }

    function invFinderNormalizeCode(value) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }


    // 7.8.2 — QR label helpers for scan-to-item workflow.
    // QR labels use a short stable value: Product ID first, then barcode, then Firebase key.
    function invFinderQrValue(item) {
        return String(invFinderProductId(item) || invFinderBarcodeText(item) || item?.key || '').trim();
    }

    function invFinderQrImageUrl(value, size = 220) {
        const clean = String(value || '').trim();
        if (!clean) return '';
        const px = Math.max(120, Math.min(400, parseInt(size, 10) || 220));
        return `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&margin=10&data=${encodeURIComponent(clean)}`;
    }

    function invFinderExtractScannedCode(rawValue) {
        const raw = String(rawValue || '').trim();
        if (!raw) return '';
        try {
            const url = new URL(raw);
            const keys = ['item', 'productId', 'productID', 'pid', 'code', 'barcode'];
            for (const key of keys) {
                const val = String(url.searchParams.get(key) || '').trim();
                if (val) return val;
            }
        } catch (_) {}
        return raw;
    }

    function invFinderMatchText(item) {
        return [invFinderProductId(item), invFinderProductName(item), invFinderDetails(item), invFinderBarcodeText(item), item?.family, item?.relationship]
            .map(v => String(v || '').toLowerCase()).join(' ');
    }

    function invSiteSafeKey(value) {
        return String(value || '').trim().replace(/[.#$[\]]/g, '_');
    }

    function invSiteDisplayKey(value) {
        return String(value || '').trim().replace(/_/g, ' ');
    }

    function invSiteNorm(value) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function invReadCachedSites() {
        try {
            const raw = localStorage.getItem('cached_SITES');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed?.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);
            return arr.map(s => ({
                site: String(s.site || s.Site || s.value || '').trim(),
                description: String(s.description || s.Description || s.name || s.label || '').trim()
            })).filter(s => s.site || s.description);
        } catch (_) {
            return [];
        }
    }

    function buildInventorySiteCache(projectSites = null, materialObj = null) {
        const map = new Map();
        const add = (site, description = '') => {
            const code = String(site || '').trim();
            const desc = String(description || '').trim();
            if (!code && !desc) return;
            const key = invSiteNorm(code || desc);
            if (!key) return;
            const current = map.get(key) || {};
            map.set(key, {
                site: current.site || code || desc,
                description: current.description || desc || ''
            });
        };

        invReadCachedSites().forEach(s => add(s.site, s.description));

        if (projectSites && typeof projectSites === 'object') {
            Object.entries(projectSites).forEach(([key, val]) => {
                if (val && typeof val === 'object') {
                    add(val.site || val.siteNo || val.siteNumber || val.projectId || val.projectID || key, val.description || val.siteName || val.name || val.projectName || '');
                } else {
                    add(key, val);
                }
            });
        }

        if (materialObj && typeof materialObj === 'object') {
            Object.values(materialObj).forEach(item => {
                if (!item || typeof item !== 'object') return;
                if (item.sites && typeof item.sites === 'object') {
                    Object.keys(item.sites).forEach(siteKey => add(invSiteDisplayKey(siteKey), ''));
                }
                add(item.site || item.siteNo || item.siteNumber || item.site_name || item.siteName || item.location || item.projectSite || '', item.siteDescription || item.siteDesc || item.projectName || '');
            });
        }

        return Array.from(map.values())
            .filter(s => s.site || s.description)
            .sort((a, b) => {
                const na = parseInt(a.site, 10);
                const nb = parseInt(b.site, 10);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return `${a.site} ${a.description}`.localeCompare(`${b.site} ${b.description}`);
            });
    }

    function invSiteLabel(siteValue) {
        const raw = String(siteValue || '').trim();
        if (!raw) return '';
        const norm = invSiteNorm(raw);
        const hit = Array.isArray(siteCache) ? siteCache.find(s => invSiteNorm(s.site) === norm || invSiteNorm(s.description) === norm) : null;
        if (hit && hit.description && invSiteNorm(hit.description) !== invSiteNorm(hit.site)) return `${hit.site} - ${hit.description}`;
        return hit?.site || raw;
    }

    function invResolveSiteInput(input) {
        const raw = String(input || '').trim();
        if (!raw) return { site: '', siteName: '', label: '' };
        const clean = raw.replace(/^site\s+/i, '').trim();
        const beforeDash = clean.split(/\s+-\s+/)[0].trim();
        const rawNorm = invSiteNorm(clean);
        const beforeNorm = invSiteNorm(beforeDash);
        const sites = Array.isArray(siteCache) ? siteCache : [];
        let hit = sites.find(s =>
            invSiteNorm(s.site) === rawNorm ||
            invSiteNorm(s.description) === rawNorm ||
            invSiteNorm(`${s.site} ${s.description}`) === rawNorm ||
            invSiteNorm(`${s.site} - ${s.description}`) === rawNorm ||
            invSiteNorm(s.site) === beforeNorm
        );
        if (!hit && rawNorm) {
            hit = sites.find(s => invSiteNorm(s.description).includes(rawNorm) || invSiteNorm(s.site).includes(rawNorm));
        }
        if (hit) {
            const label = hit.description ? `${hit.site} - ${hit.description}` : hit.site;
            return { site: String(hit.site || '').trim(), siteName: String(hit.description || '').trim(), label };
        }
        return { site: beforeDash || clean, siteName: '', label: clean };
    }

    function invSiteOptionsHtml() {
        const sites = Array.isArray(siteCache) ? siteCache : [];
        return sites.map(s => {
            const label = s.description ? `${s.site} - ${s.description}` : s.site;
            return `<option value="${invFinderEscape(label)}"></option>`;
        }).join('');
    }

    function invMaterialGroupKey(item) {
        const pid = invFinderNormalizeCode(invFinderProductId(item));
        if (pid) return `pid:${pid}`;
        return `name:${invRequestNorm(invFinderProductName(item))}|${invRequestNorm(invFinderDetails(item))}`;
    }

    function invMaterialSameGroup(a, b) {
        if (!a || !b) return false;
        const aid = invFinderNormalizeCode(invFinderProductId(a));
        const bid = invFinderNormalizeCode(invFinderProductId(b));
        if (aid && bid) return aid === bid;
        return invRequestNorm(invFinderProductName(a)) === invRequestNorm(invFinderProductName(b)) &&
               invRequestNorm(invFinderDetails(a)) === invRequestNorm(invFinderDetails(b));
    }

    function invAddStockLocation(map, site, qty, item = null) {
        const amount = invFinderNumber(qty);
        if (amount <= 0) return;
        let siteCode = invSiteDisplayKey(site || item?.site || item?.siteNo || item?.siteNumber || item?.site_name || item?.siteName || item?.location || item?.projectSite || invRequestUser().site || 'Unassigned');
        const resolved = invResolveSiteInput(siteCode);
        siteCode = resolved.site || siteCode;
        const key = invSiteNorm(siteCode);
        if (!key) return;
        const current = map.get(key) || { site: siteCode, siteName: resolved.siteName || '', label: invSiteLabel(siteCode), qty: 0 };
        current.qty += amount;
        if (!current.siteName && resolved.siteName) current.siteName = resolved.siteName;
        current.label = invSiteLabel(current.site);
        map.set(key, current);
    }

    function getInventoryItemStockLocations(item) {
        const map = new Map();
        const list = Array.isArray(materialCache) ? materialCache : [];
        const matches = list.filter(row => invMaterialSameGroup(row, item));
        const rows = matches.length ? matches : [item];

        rows.forEach(row => {
            if (!row || typeof row !== 'object') return;
            if (row.sites && typeof row.sites === 'object') {
                Object.entries(row.sites).forEach(([siteKey, qty]) => invAddStockLocation(map, siteKey, qty, row));
                return;
            }
            const qty = row.balanceQty ?? row.availableQty ?? row.available ?? row.stockQty ?? row.stock ?? row.quantity ?? 0;
            const site = row.site || row.siteNo || row.siteNumber || row.site_name || row.siteName || row.location || row.projectSite || '';
            invAddStockLocation(map, site, qty, row);
        });

        if (!map.size) {
            const fallbackQty = invFinderNumber(item?.balanceQty ?? item?.availableQty ?? item?.available ?? item?.stockQty ?? 0);
            invAddStockLocation(map, item?.site || item?.site_name || item?.siteName || invRequestUser().site || 'Unassigned', fallbackQty, item);
        }

        return Array.from(map.values()).sort((a, b) => {
            const na = parseInt(a.site, 10);
            const nb = parseInt(b.site, 10);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a.site).localeCompare(String(b.site));
        });
    }

    function getInventoryItemTotalAvailable(item) {
        return getInventoryItemStockLocations(item).reduce((sum, loc) => sum + invFinderNumber(loc.qty), 0);
    }

    function getCartQtyForMaterialSource(cart, item, fromSite) {
        const srcNorm = invSiteNorm(fromSite);
        const groupKey = invMaterialGroupKey(item);
        return (cart?.items || []).reduce((sum, it) => {
            const sameGroup = (it.materialGroupKey && it.materialGroupKey === groupKey) ||
                (invFinderNormalizeCode(it.productId) && invFinderNormalizeCode(it.productId) === invFinderNormalizeCode(invFinderProductId(item))) ||
                (String(it.materialKey || '') && String(it.materialKey) === String(item?.key || ''));
            if (!sameGroup) return sum;
            if (invSiteNorm(it.fromSite) !== srcNorm) return sum;
            return sum + invFinderNumber(it.qty);
        }, 0);
    }

    function getTransferRequestSourceOptions(item, cart = null, toSiteValue = '') {
        const toResolved = invResolveSiteInput(toSiteValue);
        const toNorm = invSiteNorm(toResolved.site || toResolved.label || toSiteValue);
        return getInventoryItemStockLocations(item).map(src => {
            const available = invFinderNumber(src.qty);
            const alreadyInCart = getCartQtyForMaterialSource(cart || readTransferRequestCart(), item, src.site);
            const remaining = Math.max(0, available - alreadyInCart);
            const sameAsTo = !!(toNorm && invSiteNorm(src.site) === toNorm);
            return { ...src, available, alreadyInCart, remaining, sameAsTo };
        });
    }

    function validateManualTransferRequestQty(item, requestedQty, fromSiteValue, toSiteValue, cart) {
        const toResolved = invResolveSiteInput(toSiteValue);
        const toNorm = invSiteNorm(toResolved.site || toResolved.label || toSiteValue);
        const fromResolved = invResolveSiteInput(fromSiteValue);
        const fromSite = fromResolved.site || fromResolved.label || fromSiteValue;
        const fromNorm = invSiteNorm(fromSite);
        if (!fromNorm) return { ok: false, message: 'Please select From Site.' };
        if (toNorm && fromNorm === toNorm) return { ok: false, message: 'From Site and To Site cannot be the same.' };

        const sources = getTransferRequestSourceOptions(item, cart, toSiteValue);
        const src = sources.find(x => invSiteNorm(x.site) === fromNorm || invSiteNorm(x.label) === fromNorm || invSiteNorm(`${x.site} - ${x.siteName || ''}`) === fromNorm);
        if (!src) return { ok: false, message: 'Selected From Site has no available stock for this item.' };
        if (src.sameAsTo) return { ok: false, message: 'From Site and To Site cannot be the same.' };
        if (src.remaining <= 0) return { ok: false, message: `No remaining stock is available from ${src.label || src.site}.` };
        if (requestedQty > src.remaining) {
            return { ok: false, message: `Requested qty is ${invFinderQty(requestedQty)}, but ${src.label || src.site} has only ${invFinderQty(src.remaining)} available for this request.` };
        }
        return {
            ok: true,
            toResolved,
            fromResolved,
            lines: [{
                fromSite: src.site,
                fromSiteName: src.siteName || fromResolved.siteName || '',
                fromSiteLabel: src.label || fromResolved.label || invSiteLabel(src.site),
                sourceAvailableQty: src.available,
                sourceRemainingQty: src.remaining,
                qty: requestedQty
            }]
        };
    }

    function invRequestUser() {
        const u = window.currentUser || {};
        return {
            name: String(u.Name || u.username || u.name || '').trim(),
            position: String(u.Position || u.position || '').trim(),
            role: String(u.Role || u.role || '').trim(),
            email: String(u.Email || u.email || '').trim(),
            site: String(u.Site || u.site || '').trim()
        };
    }

    function invRequestNorm(value) {
        return String(value || '').trim().toLowerCase();
    }

    function invRequestIsSuperAdmin() {
        try {
            if (typeof window.isCurrentUserSuperAdmin === 'function' && window.isCurrentUserSuperAdmin()) return true;
        } catch (_) {}
        const user = invRequestUser();
        const name = invRequestNorm(user.name);
        const role = invRequestNorm(user.role);
        const pos = invRequestNorm(user.position);
        return name === 'irwin' || name === 'super admin' || role.includes('super') || pos.includes('super admin');
    }

    function invRequestPositionAllowed(allowed) {
        if (invRequestIsSuperAdmin()) return true;
        const pos = invRequestNorm(invRequestUser().position);
        return allowed.some(p => pos === p || pos.includes(p));
    }

    function canSubmitInventoryTransferRequest() {
        return invRequestPositionAllowed(TRANSFER_REQUEST_SUBMIT_POSITIONS);
    }

    function canReviewInventoryTransferRequests() {
        return invRequestPositionAllowed(TRANSFER_REQUEST_REVIEW_POSITIONS);
    }

    function canDeleteInventoryTransferRequests() {
        return invRequestPositionAllowed(TRANSFER_REQUEST_DELETE_POSITIONS);
    }

    function canAccessInventoryRequestReview() {
        return canReviewInventoryTransferRequests() || canDeleteInventoryTransferRequests();
    }

    function readTransferRequestCart() {
        try {
            const raw = localStorage.getItem(TRANSFER_REQUEST_CART_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed && Array.isArray(parsed.items) ? parsed : { requestType: 'Transfer', items: [] };
        } catch (_) {
            return { requestType: 'Transfer', items: [] };
        }
    }

    function writeTransferRequestCart(cart) {
        try { localStorage.setItem(TRANSFER_REQUEST_CART_KEY, JSON.stringify(cart || { requestType: 'Transfer', items: [] })); } catch (_) {}
    }

    function clearTransferRequestCart() {
        try { localStorage.removeItem(TRANSFER_REQUEST_CART_KEY); } catch (_) {}
    }

    function transferRequestCode() {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `TRFREQ-${stamp}-${rand}`;
    }

    function getMaterialFinderSection() {
        let section = document.getElementById('wd-inv-mobile-material-finder');
        if (section) return section;

        const main = document.querySelector('#workdesk-view .workdesk-main') || document.querySelector('#workdesk-view [role="main"]');
        if (!main) return null;

        section = document.createElement('section');
        section.id = 'wd-inv-mobile-material-finder';
        section.className = 'workdesk-section hidden inv-mobile-finder-section';
        section.innerHTML = `
            <div class="inv-mobile-finder-head">
                <div>
                    <h1><i class="fa-solid fa-magnifying-glass"></i> Item Finder</h1>
                    <p>Search material by name, ID, or details. Preview only.</p>
                </div>
            </div>
            <div class="inv-mobile-finder-search">
                <div class="inv-mobile-search-box">
                    <i class="fa-solid fa-box-open"></i>
                    <input id="inv-mobile-material-search-input" type="search" placeholder="Search item material or scan QR / barcode..." autocomplete="off">
                </div>
                <div class="inv-mobile-finder-actions">
                    <button id="inv-mobile-material-scan" type="button" class="inv-mobile-scan-btn"><i class="fa-solid fa-qrcode"></i> Scan</button>
                    <button id="inv-mobile-material-search-clear" type="button" class="secondary-btn">Clear</button>
                </div>
            </div>
            <div id="inv-mobile-barcode-scanner" class="inv-mobile-barcode-scanner hidden" aria-live="polite">
                <div class="inv-mobile-barcode-box">
                    <div class="inv-mobile-barcode-head">
                        <strong><i class="fa-solid fa-qrcode"></i> Scan item QR / barcode</strong>
                        <button type="button" id="inv-mobile-barcode-close" aria-label="Close barcode scanner"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="inv-mobile-barcode-video-wrap">
                        <video id="inv-mobile-barcode-video" autoplay muted playsinline></video>
                        <div class="inv-mobile-barcode-guide"></div>
                    </div>
                    <div id="inv-mobile-barcode-status" class="inv-mobile-barcode-status">Point camera at the QR code or barcode.</div>
                </div>
            </div>
            <div id="inv-mobile-material-suggestions" class="inv-mobile-material-suggestions" aria-live="polite"></div>
            <div id="inv-mobile-material-status" class="inv-mobile-material-status">Type an item name to search, then pick one suggestion.</div>
            <div id="inv-mobile-material-results" class="inv-mobile-material-results"></div>
        `;
        main.appendChild(section);
        return section;
    }

    function ensureInventoryMobileMaterialFinderNav() {
        const navList = document.querySelector('#workdesk-nav ul');
        if (!navList) return;
        let li = document.getElementById('wd-nav-inv-mobile-material-search')?.closest('li');
        if (!li) {
            li = document.createElement('li');
            li.className = 'wd-nav-inv-mobile-material-search mobile-only-nav-item';
            li.innerHTML = `<a href="#" id="wd-nav-inv-mobile-material-search"><i class="fa-solid fa-magnifying-glass"></i> Item Search</a>`;
            const logoutLi = document.getElementById('mobile-nav-logout')?.closest('li');
            if (logoutLi && logoutLi.parentNode === navList) navList.insertBefore(li, logoutLi);
            else navList.appendChild(li);
        }

        const link = document.getElementById('wd-nav-inv-mobile-material-search');
        if (link && link.dataset.bound !== '1') {
            link.dataset.bound = '1';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                openInventoryMobileMaterialFinder();
            });
        }

        updateInventoryMobileMaterialFinderNavVisibility();
    }

    function updateInventoryMobileMaterialFinderNavVisibility() {
        const li = document.getElementById('wd-nav-inv-mobile-material-search')?.closest('li');
        if (li) {
            if (isInventoryFinderMobileActive()) li.style.removeProperty('display');
            else li.style.setProperty('display', 'none', 'important');
        }
        try { updateInventoryRequestReviewNavVisibility(); } catch (_) {}
    }

    function openInventoryMobileMaterialFinder() {
        const section = getMaterialFinderSection();
        if (!section) return;
        try {
            window.__ibaActiveModule = 'inventory';
            window.__ibaInventoryMobileSection = 'item-search';
        } catch (_) {}
        if (document.body) {
            document.body.classList.add('inventory-mode');
            document.body.classList.add('inventory-mobile-finder-active');
            document.body.classList.remove('inventory-request-review-active');
        }
        try { closeInventoryRequestReview(); } catch (_) {}

        document.querySelectorAll('#workdesk-view .workdesk-section, .workdesk-section').forEach(el => el.classList.add('hidden'));
        section.classList.remove('hidden');
        section.classList.add('is-open');

        document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
        const link = document.getElementById('wd-nav-inv-mobile-material-search');
        if (link) link.classList.add('active');

        updateInventoryMobileMaterialFinderNavVisibility();
        bindInventoryMobileMaterialFinderControls();
        const input = document.getElementById('inv-mobile-material-search-input');
        if (input) setTimeout(() => input.focus(), 120);

        if (!materialCache) {
            loadInventoryMobileMaterialFinderData().then(() => {
                renderInventoryMobileMaterialFinderSuggestions(input?.value || '');
            });
        } else {
            renderInventoryMobileMaterialFinderSuggestions(input?.value || '');
        }
    }

    function bindInventoryMobileMaterialFinderControls() {
        const input = document.getElementById('inv-mobile-material-search-input');
        const clearBtn = document.getElementById('inv-mobile-material-search-clear');
        const scanBtn = document.getElementById('inv-mobile-material-scan');
        const scannerClose = document.getElementById('inv-mobile-barcode-close');
        const suggestions = document.getElementById('inv-mobile-material-suggestions');
        const results = document.getElementById('inv-mobile-material-results');
        if (input && input.dataset.bound !== '1') {
            input.dataset.bound = '1';
            input.addEventListener('input', () => renderInventoryMobileMaterialFinderSuggestions(input.value));
            input.addEventListener('focus', () => renderInventoryMobileMaterialFinderSuggestions(input.value));
        }
        if (suggestions && suggestions.dataset.bound !== '1') {
            suggestions.dataset.bound = '1';
            suggestions.addEventListener('click', (event) => {
                const btn = event.target.closest('.inv-mobile-material-suggestion-item');
                if (!btn) return;
                const key = btn.getAttribute('data-material-key') || '';
                const item = findInventoryMobileMaterialByKey(key);
                if (!item) return;
                if (input) input.value = `${invFinderProductName(item) || invFinderProductId(item)}`;
                transferRequestFormItemKey = '';
                renderInventoryMobileMaterialFinderSelected(item);
                invMobileScrollToCenter(null, '#inv-mobile-material-results .inv-mobile-material-card');
            });
        }
        if (results && results.dataset.transferRequestBound !== '1') {
            results.dataset.transferRequestBound = '1';
            results.addEventListener('click', handleInventoryTransferRequestClick);
            results.addEventListener('change', handleInventoryTransferRequestChange);
        }
        if (clearBtn && clearBtn.dataset.bound !== '1') {
            clearBtn.dataset.bound = '1';
            clearBtn.addEventListener('click', () => {
                if (input) input.value = '';
                resetInventoryMobileMaterialFinder();
                stopInventoryMobileBarcodeScanner();
                if (input) input.focus();
            });
        }
        if (scanBtn && scanBtn.dataset.bound !== '1') {
            scanBtn.dataset.bound = '1';
            scanBtn.addEventListener('click', () => startInventoryMobileBarcodeScanner());
        }
        if (scannerClose && scannerClose.dataset.bound !== '1') {
            scannerClose.dataset.bound = '1';
            scannerClose.addEventListener('click', () => stopInventoryMobileBarcodeScanner());
        }
    }


    async function startInventoryMobileBarcodeScanner() {
        const scanner = document.getElementById('inv-mobile-barcode-scanner');
        const video = document.getElementById('inv-mobile-barcode-video');
        const scannerStatus = document.getElementById('inv-mobile-barcode-status');
        const status = document.getElementById('inv-mobile-material-status');
        if (!scanner || !video) return;

        if (!('BarcodeDetector' in window)) {
            const msg = 'QR / barcode scanning is not supported in this browser. Try Chrome on Android, or type the item code manually.';
            if (scannerStatus) scannerStatus.textContent = msg;
            if (status) status.textContent = msg;
            scanner.classList.remove('hidden');
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const msg = 'Camera access is not available. Please type the item code manually.';
            if (scannerStatus) scannerStatus.textContent = msg;
            if (status) status.textContent = msg;
            scanner.classList.remove('hidden');
            return;
        }

        try {
            if (!materialCache && !isLoadingMaterials) await loadInventoryMobileMaterialFinderData();
            stopInventoryMobileBarcodeScanner(false);
            scanner.classList.remove('hidden');
            barcodeScannerActive = true;
            if (scannerStatus) scannerStatus.textContent = 'Starting camera...';

            const supported = typeof BarcodeDetector.getSupportedFormats === 'function'
                ? await BarcodeDetector.getSupportedFormats()
                : [];
            const preferredFormats = ['qr_code', 'code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix', 'pdf417'];
            const formats = supported.length ? preferredFormats.filter(f => supported.includes(f)) : preferredFormats;
            const detector = new BarcodeDetector(formats.length ? { formats } : undefined);

            barcodeScannerStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false
            });
            video.srcObject = barcodeScannerStream;
            await video.play();
            if (scannerStatus) scannerStatus.textContent = 'Point camera at the QR code or barcode.';

            const scanLoop = async () => {
                if (!barcodeScannerActive) return;
                try {
                    const codes = await detector.detect(video);
                    if (codes && codes.length) {
                        const raw = String(codes[0].rawValue || '').trim();
                        if (raw) {
                            handleInventoryMobileBarcodeValue(raw);
                            return;
                        }
                    }
                } catch (err) {
                    // Some browsers throw while the video is starting. Keep trying quietly.
                }
                barcodeScannerTimer = window.setTimeout(scanLoop, 250);
            };
            barcodeScannerTimer = window.setTimeout(scanLoop, 400);
        } catch (err) {
            console.error('Inventory mobile barcode scanner failed:', err);
            if (scannerStatus) scannerStatus.textContent = 'Camera permission denied or scanner failed. You can still type the item code manually.';
            if (status) status.textContent = 'Camera scanner could not start. Type the item code manually.';
            stopInventoryMobileBarcodeScanner(false);
        }
    }

    function stopInventoryMobileBarcodeScanner(hide = true) {
        barcodeScannerActive = false;
        if (barcodeScannerTimer) {
            clearTimeout(barcodeScannerTimer);
            barcodeScannerTimer = null;
        }
        if (barcodeScannerStream) {
            barcodeScannerStream.getTracks().forEach(track => {
                try { track.stop(); } catch (_) {}
            });
            barcodeScannerStream = null;
        }
        const video = document.getElementById('inv-mobile-barcode-video');
        if (video) video.srcObject = null;
        if (hide) {
            const scanner = document.getElementById('inv-mobile-barcode-scanner');
            if (scanner) scanner.classList.add('hidden');
        }
    }

    function findInventoryMobileMaterialByBarcode(code) {
        if (!Array.isArray(materialCache)) return null;
        const normalized = invFinderNormalizeCode(code);
        if (!normalized) return null;
        return materialCache.find(item => {
            const candidates = [
                invFinderBarcodeText(item),
                invFinderProductId(item),
                item?.productCode,
                item?.itemCode,
                item?.sku
            ].map(invFinderNormalizeCode).filter(Boolean);
            return candidates.some(v => v === normalized);
        }) || null;
    }

    function handleInventoryMobileBarcodeValue(rawValue) {
        const input = document.getElementById('inv-mobile-material-search-input');
        const status = document.getElementById('inv-mobile-material-status');
        const scannerStatus = document.getElementById('inv-mobile-barcode-status');
        stopInventoryMobileBarcodeScanner();

        const scanCode = invFinderExtractScannedCode(rawValue);
        if (input) input.value = scanCode || rawValue;
        if (scannerStatus) scannerStatus.textContent = `Scanned: ${scanCode || rawValue}`;

        const exact = findInventoryMobileMaterialByBarcode(scanCode || rawValue);
        if (exact) {
            if (input) input.value = invFinderProductName(exact) || invFinderProductId(exact) || scanCode || rawValue;
            if (status) status.textContent = `QR / barcode matched: ${invFinderProductName(exact) || invFinderProductId(exact)}`;
            renderInventoryMobileMaterialFinderSelected(exact);
            return;
        }

        if (status) status.textContent = `QR / barcode scanned: ${scanCode || rawValue}. No exact Product ID match. Showing suggestions.`;
        renderInventoryMobileMaterialFinderSuggestions(scanCode || rawValue);
    }

    async function loadInventoryMobileMaterialFinderData() {
        if (isLoadingMaterials) return;
        isLoadingMaterials = true;
        const status = document.getElementById('inv-mobile-material-status');
        if (status) status.textContent = 'Loading material records...';
        try {
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) throw new Error('Firebase database is not loaded.');

            const [matSnap, moveSnap, siteSnap] = await Promise.all([
                dbRef.ref('material_stock').once('value'),
                dbRef.ref('transfer_entries').limitToLast(400).once('value'),
                dbRef.ref('project_sites').once('value').catch(() => ({ val: () => null }))
            ]);

            const matObj = matSnap.val() || {};
            materialCache = Object.entries(matObj).map(([key, val]) => ({ key, ...(val || {}) }));

            const moveObj = moveSnap.val() || {};
            movementCache = Object.entries(moveObj).map(([key, val]) => ({ key, ...(val || {}) }));
            siteCache = buildInventorySiteCache(siteSnap?.val ? siteSnap.val() : null, matObj);

            if (status) status.textContent = materialCache.length ? 'Search ready.' : 'No material records found.';
        } catch (err) {
            console.error('Inventory mobile material finder load failed:', err);
            materialCache = [];
            movementCache = [];
            siteCache = buildInventorySiteCache();
            if (status) status.textContent = 'Unable to load material records.';
        } finally {
            isLoadingMaterials = false;
        }
    }

    function getInventoryMaterialMovements(item) {
        const pid = invFinderNormalizeCode(invFinderProductId(item));
        const barcode = invFinderNormalizeCode(invFinderBarcodeText(item));
        const name = invRequestNorm(invFinderProductName(item));
        const detail = invRequestNorm(invFinderDetails(item));
        const moves = Array.isArray(movementCache) ? movementCache : [];
        return moves.filter(m => {
            const ids = [m.productId, m.productID, m.productCode, m.productIDNo, m.itemCode, m.sku]
                .map(invFinderNormalizeCode).filter(Boolean);
            if (pid && ids.includes(pid)) return true;
            if (barcode && ids.includes(barcode)) return true;

            // Backup only when the entry has no reliable Product ID. Keep this strict to avoid showing unrelated history.
            const midMissing = !ids.length;
            if (!midMissing) return false;
            const mname = invRequestNorm(m.productName || m.vendorName || m.itemName || '');
            const mdetail = invRequestNorm(m.details || m.detail || '');
            return !!(name && detail && mname === name && mdetail === detail);
        }).slice(-8).reverse();
    }

    function invFinderMovementLine(move) {
        const type = String(move.for || move.jobType || '').trim() || 'Movement';
        const from = move.fromSite || move.fromLocation || move.sourceSite || move.site || 'N/A';
        const to = move.toSite || move.toLocation || move.destinationSite || move.requestSite || 'N/A';
        const qty = move.receivedQty ?? move.approvedQty ?? move.orderedQty ?? move.requiredQty ?? '';
        const date = move.arrivalDate || move.shippingDate || move.dateResponded || move.date || '';
        const status = move.remarks || move.status || '';
        return { type, from, to, qty, date, status };
    }

    function resetInventoryMobileMaterialFinder() {
        const results = document.getElementById('inv-mobile-material-results');
        const status = document.getElementById('inv-mobile-material-status');
        const suggestions = document.getElementById('inv-mobile-material-suggestions');
        if (suggestions) suggestions.innerHTML = '';
        if (results) {
            results.innerHTML = '<div class="inv-mobile-material-empty"><i class="fa-solid fa-boxes-stacked"></i><strong>Search item material</strong><span>Type item name / ID or scan QR / barcode, then pick one suggestion to preview.</span></div>';
        }
        if (status) status.textContent = Array.isArray(materialCache)
            ? `${materialCache.length} material records available.`
            : 'Type an item name or scan QR / barcode, then pick one suggestion.';
    }

    function invMobileScrollToCenter(target, fallbackSelector) {
        // 7.9.3 — Stronger mobile refocus.
        // scrollIntoView({ block:'center' }) is not reliable when the page has a sticky
        // blue module header and fixed bottom nav. This centers the target inside the
        // visible safe area instead of just bringing it barely into view.
        const run = () => {
            try {
                const el = target || (fallbackSelector ? document.querySelector(fallbackSelector) : null);
                if (!el) return;

                const findScrollParent = (node) => {
                    let cur = node && node.parentElement;
                    while (cur && cur !== document.body && cur !== document.documentElement) {
                        const st = window.getComputedStyle ? window.getComputedStyle(cur) : null;
                        const oy = st ? String(st.overflowY || '') : '';
                        if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight + 8) return cur;
                        cur = cur.parentElement;
                    }
                    return null;
                };

                const getFixedBottomHeight = () => {
                    const candidates = [
                        '.workdesk-footer-nav',
                        '.mobile-bottom-nav',
                        '#workdesk-mobile-bottom-nav',
                        '#inventory-mobile-bottom-nav',
                        '.bottom-mobile-nav'
                    ];
                    for (const sel of candidates) {
                        const n = document.querySelector(sel);
                        if (!n || n.classList.contains('hidden')) continue;
                        const r = n.getBoundingClientRect();
                        if (r.height > 20 && r.bottom > (window.innerHeight - 140)) return r.height;
                    }
                    return 74;
                };

                const getFixedHeaderBottom = () => {
                    const candidates = [
                        '.mobile-module-header',
                        '.workdesk-mobile-header',
                        '.inventory-mobile-header',
                        '#workdesk-mobile-header',
                        '#inventory-mobile-header'
                    ];
                    let maxBottom = 0;
                    for (const sel of candidates) {
                        const n = document.querySelector(sel);
                        if (!n || n.classList.contains('hidden')) continue;
                        const r = n.getBoundingClientRect();
                        if (r.height > 20 && r.top <= 2) maxBottom = Math.max(maxBottom, r.bottom);
                    }
                    return maxBottom || 0;
                };

                const er = el.getBoundingClientRect();
                const headerBottom = getFixedHeaderBottom();
                const footerHeight = getFixedBottomHeight();
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 700;
                const viewportSafeTop = Math.max(headerBottom + 14, 14);
                const viewportSafeBottom = Math.max(viewportSafeTop + 120, viewportHeight - footerHeight - 18);
                const viewportSafeHeight = Math.max(140, viewportSafeBottom - viewportSafeTop);

                // 8.0.7 — hard align transfer form near the visible header.
                // The request form is tall, so true center makes the title look too low and hides fields.
                // User asked for the "Add to Transfer Cart" bar to land near the MODULE/version header.
                // Therefore transfer forms use a near-header anchor; other item previews keep center logic.
                const isTransferForm = !!(el.classList && el.classList.contains('inv-transfer-request-form'));
                const shouldTopAlign = isTransferForm || er.height > (viewportSafeHeight * 0.72);
                const desiredTop = isTransferForm
                    ? Math.max(viewportSafeTop + 10, Math.min(viewportSafeTop + 24, viewportHeight * 0.14))
                    : (shouldTopAlign ? viewportSafeTop + 8 : viewportSafeTop + (viewportSafeHeight - er.height) / 2);

                const scrollByDelta = (delta, behavior = 'smooth') => {
                    const preferOuter = isTransferForm;
                    let parent = null;
                    if (preferOuter) {
                        let cur = el && el.parentElement;
                        while (cur && cur !== document.body && cur !== document.documentElement) {
                            const st = window.getComputedStyle ? window.getComputedStyle(cur) : null;
                            const oy = st ? String(st.overflowY || '') : '';
                            if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight + 8) parent = cur;
                            cur = cur.parentElement;
                        }
                    } else {
                        parent = findScrollParent(el);
                    }

                    if (parent) {
                        parent.scrollTo({ top: parent.scrollTop + delta, behavior });
                        return true;
                    }

                    window.scrollBy({ top: delta, behavior });
                    return true;
                };

                const firstDelta = er.top - desiredTop;
                scrollByDelta(firstDelta, 'smooth');

                // Verify multiple times. Mobile browsers sometimes ignore the first smooth-scroll,
                // especially when the result card re-renders and nested panels are scrollable. For the
                // transfer form, force the final position by correcting all possible scroll containers.
                if (isTransferForm) {
                    const forceNearHeader = () => {
                        try {
                            const latest = el.getBoundingClientRect();
                            const correction = latest.top - desiredTop;
                            if (Math.abs(correction) <= 8) return;

                            const touched = [];
                            let cur = el.parentElement;
                            while (cur && cur !== document.body && cur !== document.documentElement) {
                                const st = window.getComputedStyle ? window.getComputedStyle(cur) : null;
                                const oy = st ? String(st.overflowY || '') : '';
                                if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && cur.scrollHeight > cur.clientHeight + 8) {
                                    touched.push(cur);
                                }
                                cur = cur.parentElement;
                            }

                            const pageScroller = document.scrollingElement || document.documentElement || document.body;
                            touched.push(pageScroller);

                            // Try the nearest/outer scroll areas. The first one with available movement usually wins.
                            for (const scroller of touched) {
                                if (!scroller || typeof scroller.scrollTop !== 'number') continue;
                                const before = scroller.scrollTop;
                                const maxScroll = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
                                const next = Math.max(0, Math.min(maxScroll || (before + correction), before + correction));
                                if (Math.abs(next - before) > 1) {
                                    scroller.scrollTop = next;
                                    break;
                                }
                            }

                            // Last safety: if it still did not move enough, use window scroll directly.
                            setTimeout(() => {
                                try {
                                    const after = el.getBoundingClientRect();
                                    const remaining = after.top - desiredTop;
                                    if (Math.abs(remaining) > 10) window.scrollBy({ top: remaining, behavior: 'auto' });
                                } catch (_) {}
                            }, 30);
                        } catch (_) {}
                    };
                    setTimeout(forceNearHeader, 80);
                    setTimeout(forceNearHeader, 180);
                    setTimeout(forceNearHeader, 360);
                    setTimeout(forceNearHeader, 650);
                }
            } catch (_) {
                try {
                    const el = target || (fallbackSelector ? document.querySelector(fallbackSelector) : null);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                } catch (__) {}
            }
        };
        setTimeout(run, 90);
        setTimeout(run, 320);
    }

    function closeInventoryMobileMaterialFinder() {
        try { window.__ibaInventoryMobileSection = ''; } catch (_) {}
        const section = document.getElementById('wd-inv-mobile-material-finder');
        if (section) {
            section.classList.add('hidden');
            section.classList.remove('is-open');
        }
        if (document.body) document.body.classList.remove('inventory-mobile-finder-active');
        const link = document.getElementById('wd-nav-inv-mobile-material-search');
        if (link) link.classList.remove('active');
        try { stopInventoryMobileBarcodeScanner(false); } catch (_) {}
    }

    function bindInventoryMobileMaterialFinderAutoClose() {
        if (window.__ibaInvFinderAutoCloseBound === true) return;
        window.__ibaInvFinderAutoCloseBound = true;
        document.addEventListener('click', (e) => {
            const itemSearchLink = e.target && e.target.closest ? e.target.closest('#wd-nav-inv-mobile-material-search') : null;
            if (itemSearchLink) return;
            const insideFinder = e.target && e.target.closest ? e.target.closest('#wd-inv-mobile-material-finder') : null;
            if (insideFinder) return;
            const navClick = e.target && e.target.closest ? e.target.closest('#workdesk-nav a, .workdesk-footer-nav a, #im-nav a, #invoice-management-view a, #dashboard a, #dashboard button, .dashboard-card, .menu-card, .nav-link, .mobile-module-switcher-select') : null;
            if (navClick) closeInventoryMobileMaterialFinder();
        }, true);
    }

    function findInventoryMobileMaterialByKey(key) {
        if (!Array.isArray(materialCache)) return null;
        return materialCache.find(item => String(item.key || '') === String(key || '')) || null;
    }

    function handleInventoryTransferRequestClick(event) {
        const startBtn = event.target.closest('[data-inv-transfer-request-start]');
        if (startBtn) {
            const item = findInventoryMobileMaterialByKey(startBtn.getAttribute('data-material-key') || '');
            if (!item) return;
            if (!canSubmitInventoryTransferRequest()) {
                alert('Transfer request is only available for approved positions.');
                return;
            }
            transferRequestFormItemKey = item.key || '';
            renderInventoryMobileMaterialFinderSelected(item);
            invMobileScrollToCenter(null, '#inv-mobile-material-results .inv-transfer-request-form, #inv-mobile-material-results .inv-mobile-material-card');
            return;
        }

        const cancelBtn = event.target.closest('[data-inv-transfer-request-cancel]');
        if (cancelBtn) {
            const item = findInventoryMobileMaterialByKey(cancelBtn.getAttribute('data-material-key') || '');
            transferRequestFormItemKey = '';
            if (item) renderInventoryMobileMaterialFinderSelected(item);
            return;
        }

        const addBtn = event.target.closest('[data-inv-transfer-request-add]');
        if (addBtn) {
            const item = findInventoryMobileMaterialByKey(addBtn.getAttribute('data-material-key') || '');
            if (item) addInventoryTransferRequestItem(item);
            return;
        }

        const removeBtn = event.target.closest('[data-inv-transfer-request-remove]');
        if (removeBtn) {
            removeInventoryTransferRequestCartItem(removeBtn.getAttribute('data-cart-id') || '');
            const currentKey = document.querySelector('.inv-mobile-material-card')?.getAttribute('data-material-key') || '';
            const item = findInventoryMobileMaterialByKey(currentKey);
            if (item) renderInventoryMobileMaterialFinderSelected(item);
            return;
        }

        const clearBtn = event.target.closest('[data-inv-transfer-request-clear-cart]');
        if (clearBtn) {
            if (confirm('Clear the current transfer request cart?')) {
                clearTransferRequestCart();
                const currentKey = document.querySelector('.inv-mobile-material-card')?.getAttribute('data-material-key') || '';
                const item = findInventoryMobileMaterialByKey(currentKey);
                if (item) renderInventoryMobileMaterialFinderSelected(item);
            }
            return;
        }

        const checkoutBtn = event.target.closest('[data-inv-transfer-request-checkout]');
        if (checkoutBtn) {
            submitInventoryTransferRequestCart();
            return;
        }

        const qrPrintBtn = event.target.closest('[data-inv-qr-print-label]');
        if (qrPrintBtn) {
            const key = qrPrintBtn.getAttribute('data-material-key') || document.querySelector('.inv-mobile-material-card')?.getAttribute('data-material-key') || '';
            const item = findInventoryMobileMaterialByKey(key);
            if (item) printInventoryMobileQrLabel(item, qrPrintBtn.getAttribute('data-inv-qr-print-label') || 'thermal');
            else alert('Unable to find selected item for QR label.');
            return;
        }
    }

    function handleInventoryTransferRequestChange(event) {
        const sourcePick = event.target.closest('input[name="inv-transfer-request-from-pick"]');
        if (sourcePick) {
            const hidden = document.getElementById('inv-transfer-request-from');
            if (hidden) hidden.value = sourcePick.value || '';
        }
    }

    function addInventoryTransferRequestItem(item) {
        const qtyEl = document.getElementById('inv-transfer-request-qty');
        const fromEl = document.getElementById('inv-transfer-request-from');
        const toEl = document.getElementById('inv-transfer-request-to');
        const remarksEl = document.getElementById('inv-transfer-request-remarks');
        const status = document.getElementById('inv-mobile-material-status');
        const qty = invFinderNumber(qtyEl?.value);
        const fromRaw = String(fromEl?.value || '').trim();
        const toRaw = String(toEl?.value || '').trim();
        const remarks = String(remarksEl?.value || '').trim();
        if (!fromRaw) { alert('Please select From Site.'); fromEl?.focus(); return; }
        if (!qty || qty <= 0) { alert('Please enter a valid quantity.'); qtyEl?.focus(); return; }
        if (!toRaw) { alert('Please enter To Site.'); toEl?.focus(); return; }

        const cart = readTransferRequestCart();
        const split = validateManualTransferRequestQty(item, qty, fromRaw, toRaw, cart);
        if (!split.ok) {
            alert(split.message || 'Requested quantity is not available.');
            qtyEl?.focus();
            return;
        }

        const toSite = split.toResolved.site || split.toResolved.label || toRaw;
        const toSiteName = split.toResolved.siteName || '';
        const materialGroupKey = invMaterialGroupKey(item);
        const toLabel = split.toResolved.label || invSiteLabel(toSite) || toRaw;
        const addedAt = Date.now();
        split.lines.forEach((line, idx) => {
            const cartId = `${addedAt}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
            cart.items.push({
                cartId,
                productId: invFinderProductId(item),
                productName: invFinderProductName(item),
                details: invFinderDetails(item),
                photoName: item?.photoName || item?.photo || '',
                photoUrl: invFinderPhotoUrl(item),
                qty: line.qty,
                requestedTotalQty: qty,
                fromSite: line.fromSite,
                fromSiteName: line.fromSiteName || '',
                fromSiteLabel: line.fromSiteLabel || invSiteLabel(line.fromSite),
                toSite,
                toSiteName,
                toSiteLabel: toLabel,
                remarks,
                materialKey: item?.key || '',
                materialGroupKey,
                availableQty: line.sourceAvailableQty,
                sourceAvailableQty: line.sourceAvailableQty,
                sourceRemainingQty: line.sourceRemainingQty,
                splitFromMultiSource: false
            });
        });
        writeTransferRequestCart(cart);
        transferRequestFormItemKey = '';
        if (status) status.textContent = 'Item added to transfer request cart.';
        renderInventoryMobileMaterialFinderSelected(item);
        invMobileScrollToCenter(null, '#inv-mobile-material-results .inv-transfer-request-cart, #inv-mobile-material-results .inv-mobile-material-card');
    }

    function removeInventoryTransferRequestCartItem(cartId) {
        const cart = readTransferRequestCart();
        cart.items = cart.items.filter(x => String(x.cartId) !== String(cartId));
        if (cart.items.length) writeTransferRequestCart(cart);
        else clearTransferRequestCart();
    }

    async function submitInventoryTransferRequestCart() {
        const cart = readTransferRequestCart();
        if (!cart.items.length) { alert('No items in transfer request cart.'); return; }
        const user = invRequestUser();
        const code = transferRequestCode();
        const status = document.getElementById('inv-mobile-material-status');
        const totalQty = cart.items.reduce((sum, it) => sum + invFinderNumber(it.qty), 0);
        const fromSites = [...new Set(cart.items.map(it => String(it.fromSite || '').trim()).filter(Boolean))];
        const toSites = [...new Set(cart.items.map(it => String(it.toSite || '').trim()).filter(Boolean))];
        const payload = {
            requestCode: code,
            requestType: 'Transfer',
            status: 'Pending Office Review',
            remarks: 'Pending Office Review',
            requestedBy: user.name || 'Unknown',
            requestedByPosition: user.position || '',
            requestedByRole: user.role || '',
            requestedByEmail: user.email || '',
            requestedSite: user.site || '',
            fromSite: fromSites.length === 1 ? fromSites[0] : 'Mixed',
            toSite: toSites.length === 1 ? toSites[0] : 'Mixed',
            itemCount: cart.items.length,
            totalQty,
            items: cart.items,
            createdAt: new Date().toISOString(),
            timestamp: (typeof firebase !== 'undefined' && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now(),
            source: 'mobile-item-search'
        };
        try {
            if (status) status.textContent = 'Submitting transfer request...';
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) throw new Error('Firebase database is not loaded.');
            await dbRef.ref(`inventory_requests/${code}`).set(payload);
            clearTransferRequestCart();
            if (status) status.textContent = `Transfer request submitted: ${code}`;
            alert(`Transfer Request Submitted!\n\nRequest Code: ${code}\n\nOffice Logistic/Storekeeper can review this request.`);
            refreshInventoryRequestReviewBadge();
            const currentKey = document.querySelector('.inv-mobile-material-card')?.getAttribute('data-material-key') || '';
            const item = findInventoryMobileMaterialByKey(currentKey);
            if (item) renderInventoryMobileMaterialFinderSelected(item);
            else resetInventoryMobileMaterialFinder();
        } catch (err) {
            console.error('Transfer request submit failed:', err);
            if (status) status.textContent = 'Transfer request failed to submit.';
            alert('Transfer request failed. Please try again.');
        }
    }

    function renderInventoryQrLabelBlock(item) {
        const qrValue = invFinderQrValue(item);
        if (!qrValue) return '';
        const qrUrl = invFinderQrImageUrl(qrValue, 220);
        const key = invFinderEscape(item?.key || '');
        const pid = invFinderProductId(item) || qrValue;
        return `<details class="inv-mobile-qr-label-card inv-mobile-qr-label-collapsed">
            <summary class="inv-mobile-qr-label-summary">
                <span><i class="fa-solid fa-qrcode"></i> QR Label <em>Optional</em></span>
                <small>Tap only if you need to print item label</small>
                <i class="fa-solid fa-chevron-down inv-mobile-qr-label-chevron"></i>
            </summary>
            <div class="inv-mobile-qr-label-content">
                <div class="inv-mobile-qr-label-head">
                    <div><strong><i class="fa-solid fa-tag"></i> Print Item Label</strong><span>Use this only when site wants a physical QR label.</span></div>
                </div>
                <div class="inv-mobile-qr-label-body">
                    <img src="${invFinderEscape(qrUrl)}" alt="QR code for ${invFinderEscape(pid)}" loading="lazy">
                    <div><span>QR Value</span><strong>${invFinderEscape(qrValue)}</strong><small>Use Product ID as the label code for reliable scanning.</small></div>
                </div>
                <div class="inv-mobile-qr-label-actions">
                    <button type="button" data-inv-qr-print-label="thermal" data-material-key="${key}"><i class="fa-solid fa-tag"></i> Label Printer</button>
                    <button type="button" data-inv-qr-print-label="office" data-material-key="${key}"><i class="fa-solid fa-file-pdf"></i> Office / PDF</button>
                </div>
                <div class="inv-mobile-qr-label-note">Label Printer uses 50mm × 30mm layout. Office/PDF uses an A4-friendly layout.</div>
            </div>
        </details>`;
    }

    function invFinderShortText(value, max = 34) {
        const clean = String(value || '').replace(/\s+/g, ' ').trim();
        if (clean.length <= max) return clean;
        return clean.slice(0, Math.max(0, max - 1)).trim() + '…';
    }

    function printInventoryMobileQrLabel(item, mode = 'thermal') {
        const qrValue = invFinderQrValue(item);
        if (!qrValue) { alert('This item has no Product ID / code to generate QR.'); return; }
        const pid = invFinderProductId(item) || qrValue;
        const name = invFinderProductName(item) || 'Inventory Item';
        const details = invFinderDetails(item) || '';
        const isOffice = String(mode || '').toLowerCase() === 'office';
        const qrUrl = invFinderQrImageUrl(qrValue, isOffice ? 320 : 260);
        const safePid = invFinderEscape(pid);
        const shortName = invFinderShortText(name, isOffice ? 58 : 30);
        const shortDetails = invFinderShortText(details, isOffice ? 80 : 26);
        const title = isOffice ? `QR Office/PDF - ${safePid}` : `QR Thermal Label - ${safePid}`;
        const thermalStyle = `
            @page{size:50mm 30mm;margin:0}
            html,body{width:50mm;height:30mm;margin:0;padding:0;overflow:hidden;background:#fff;color:#111;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .toolbar{display:none}.label{width:50mm;height:30mm;box-sizing:border-box;padding:1.6mm 1.8mm;display:grid;grid-template-columns:21mm 1fr;gap:1.5mm;align-items:center;overflow:hidden;border:0}
            .qr{width:21mm;height:21mm;display:flex;align-items:center;justify-content:center}.qr img{width:20.5mm;height:20.5mm;display:block}
            .txt{min-width:0;overflow:hidden}.brand{font-size:6.6pt;font-weight:900;line-height:1;margin:0 0 1.3mm 0;white-space:nowrap}.name{font-size:6.2pt;font-weight:800;line-height:1.12;margin:0 0 1mm 0;max-height:14pt;overflow:hidden}.code{font-size:6.6pt;font-weight:900;line-height:1.1;word-break:break-all;margin:0 0 .8mm 0}.details{font-size:5.2pt;line-height:1.05;color:#333;max-height:11pt;overflow:hidden}.hint{font-size:4.8pt;color:#555;margin-top:.7mm}@media print{.toolbar{display:none!important}}
        `;
        const officeStyle = `
            @page{size:A4;margin:12mm}
            html,body{margin:0;padding:0;background:#f6f8fb;color:#111;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .toolbar{position:sticky;top:0;background:#0f2942;color:#fff;padding:10px 12px;font-size:12px;display:flex;gap:8px;align-items:center;justify-content:space-between}.toolbar button{border:0;border-radius:8px;background:#14b8a6;color:#fff;font-weight:800;padding:8px 10px}.toolbar span{opacity:.9}
            .sheet{padding:14mm;display:flex;justify-content:center}.label{width:86mm;min-height:54mm;background:#fff;border:1px solid #111;border-radius:3mm;box-sizing:border-box;padding:5mm;display:grid;grid-template-columns:33mm 1fr;gap:5mm;align-items:center;box-shadow:0 8px 24px rgba(15,23,42,.12)}
            .qr img{width:33mm;height:33mm;display:block}.brand{font-size:12pt;font-weight:900;margin:0 0 2mm 0}.name{font-size:10pt;font-weight:800;line-height:1.15;margin:0 0 2mm 0}.code{font-size:11pt;font-weight:900;border:1px solid #cbd5e1;border-radius:2mm;padding:1.5mm 2mm;display:inline-block;word-break:break-all}.details{font-size:8pt;color:#444;line-height:1.25;margin-top:2mm}.hint{font-size:7pt;color:#64748b;margin-top:2.5mm}@media print{body{background:#fff}.toolbar{display:none!important}.sheet{padding:0}.label{box-shadow:none}}
        `;
        const style = isOffice ? officeStyle : thermalStyle;
        const bodyClass = isOffice ? 'office' : 'thermal';
        const instruction = isOffice ? 'Office/PDF mode: choose printer or Save as PDF in the print dialog.' : 'Thermal label mode: use paper size 50mm × 30mm. Set scale to 100% if available.';
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
            <style>${style}</style></head><body class="${bodyClass}">
            <div class="toolbar"><span>${invFinderEscape(instruction)}</span><button onclick="window.print()">Print / Save PDF</button></div>
            <div class="sheet"><div class="label"><div class="qr"><img src="${invFinderEscape(qrUrl)}" alt="QR"></div><div class="txt"><div class="brand">IBA Inventory</div><div class="name">${invFinderEscape(shortName)}</div><div class="code">${invFinderEscape(qrValue)}</div>${shortDetails ? `<div class="details">${invFinderEscape(shortDetails)}</div>` : ''}<div class="hint">Scan QR to find item</div></div></div></div>
            <script>window.onload=function(){setTimeout(function(){window.print();},450);};</script></body></html>`;
        const w = window.open('', '_blank', isOffice ? 'width=820,height=700' : 'width=360,height=260');
        if (!w) { alert('Popup blocked. Please allow popups to print QR label.'); return; }
        w.document.open();
        w.document.write(html);
        w.document.close();
    }

    function renderInventoryTransferRequestForm(item) {
        if (!canSubmitInventoryTransferRequest()) return '';
        const key = invFinderEscape(item?.key || '');
        if (String(transferRequestFormItemKey || '') !== String(item?.key || '')) {
            return `<button type="button" class="inv-transfer-request-start" data-inv-transfer-request-start data-material-key="${key}"><i class="fa-solid fa-truck-arrow-right"></i> Create Transfer Request</button>`;
        }
        const cart = readTransferRequestCart();
        const locations = getTransferRequestSourceOptions(item, cart);
        const totalAvailable = locations.reduce((sum, loc) => sum + invFinderNumber(loc.available), 0);
        const totalRemaining = locations.reduce((sum, loc) => sum + invFinderNumber(loc.remaining), 0);
        const positiveLocations = locations.filter(x => x.remaining > 0);
        const sourceRows = locations.length
            ? locations.map(loc => {
                const usedText = loc.alreadyInCart > 0 ? `<small>Already in cart: ${invFinderEscape(invFinderQty(loc.alreadyInCart))}</small>` : '<small>Available source</small>';
                const disabled = loc.remaining <= 0 ? ' disabled' : '';
                return `<label class="inv-transfer-source-card${disabled}">
                    <input type="radio" name="inv-transfer-request-from-pick" value="${invFinderEscape(loc.site)}" ${disabled ? 'disabled' : ''} ${!disabled && positiveLocations.indexOf(loc) === 0 ? 'checked' : ''}>
                    <span><strong>${invFinderEscape(loc.label || loc.site)}</strong>${usedText}</span>
                    <em>${invFinderEscape(invFinderQty(loc.remaining))}</em>
                </label>`;
            }).join('')
            : `<div class="inv-transfer-source-row"><span>No stock location found</span><strong>0</strong></div>`;
        const firstAvailable = positiveLocations[0];
        return `<div class="inv-transfer-request-form inv-shopping-form">
            <div class="inv-transfer-request-form-title"><i class="fa-solid fa-cart-plus"></i> Add to Transfer Cart</div>
            <div class="inv-transfer-source-box">
                <div class="inv-transfer-source-title">Choose From Site<span>Available: ${invFinderEscape(invFinderQty(totalRemaining))}</span></div>
                <div class="inv-transfer-source-picker">
                    ${sourceRows}
                </div>
                <small class="inv-transfer-source-hint">Pick the exact site where you want to take the material. Qty cannot exceed the selected site's remaining available stock.</small>
            </div>
            <input id="inv-transfer-request-from" type="hidden" value="${invFinderEscape(firstAvailable?.site || '')}">
            <label>Quantity to take<input id="inv-transfer-request-qty" type="number" min="0.01" max="${invFinderEscape(totalAvailable)}" step="0.01" placeholder="Qty"></label>
            <label>To Site<input id="inv-transfer-request-to" type="text" list="inv-transfer-request-to-options" placeholder="Type site no. or site name"></label>
            <datalist id="inv-transfer-request-to-options">${invSiteOptionsHtml()}</datalist>
            <label>Remarks<textarea id="inv-transfer-request-remarks" rows="2" placeholder="Optional remarks"></textarea></label>
            <div class="inv-transfer-request-form-actions">
                <button type="button" class="primary-btn" data-inv-transfer-request-add data-material-key="${key}"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>
                <button type="button" class="secondary-btn" data-inv-transfer-request-cancel data-material-key="${key}">Cancel</button>
            </div>
        </div>`;
    }

    function renderInventoryTransferRequestCart() {
        const cart = readTransferRequestCart();
        if (!cart.items.length) return '';
        const totalQty = cart.items.reduce((sum, it) => sum + invFinderNumber(it.qty), 0);
        const itemsHtml = cart.items.map((it, idx) => `<div class="inv-transfer-cart-item shop-cart-line">
            <div class="shop-cart-line-index">${idx + 1}</div>
            <div class="shop-cart-line-main">
                <strong>${invFinderEscape(it.productName || it.productId || 'Item')}</strong>
                <span>${invFinderEscape(it.productId || '')}</span>
                <small><i class="fa-solid fa-location-dot"></i> ${invFinderEscape(it.fromSiteLabel || it.fromSite || '')} <i class="fa-solid fa-arrow-right-long"></i> ${invFinderEscape(it.toSiteLabel || it.toSite || '')}</small>
            </div>
            <div class="shop-cart-line-qty"><span>Qty</span><strong>${invFinderEscape(invFinderQty(it.qty))}</strong></div>
            <button type="button" data-inv-transfer-request-remove data-cart-id="${invFinderEscape(it.cartId)}" aria-label="Remove item"><i class="fa-solid fa-trash-can"></i></button>
        </div>`).join('');
        return `<div class="inv-transfer-request-cart inv-shopping-cart">
            <div class="inv-transfer-request-cart-head"><strong><i class="fa-solid fa-basket-shopping"></i> Transfer Cart</strong><span>${cart.items.length} line${cart.items.length === 1 ? '' : 's'} · Qty ${invFinderEscape(invFinderQty(totalQty))}</span></div>
            <div class="inv-shopping-cart-list">${itemsHtml}</div>
            <div class="inv-transfer-request-cart-actions">
                <button type="button" class="primary-btn" data-inv-transfer-request-checkout><i class="fa-solid fa-paper-plane"></i> Checkout Request</button>
                <button type="button" class="secondary-btn" data-inv-transfer-request-clear-cart>Clear Cart</button>
            </div>
        </div>`;
    }

    function renderInventoryMobileMaterialFinderSuggestions(term) {
        const results = document.getElementById('inv-mobile-material-results');
        const status = document.getElementById('inv-mobile-material-status');
        const suggestions = document.getElementById('inv-mobile-material-suggestions');
        if (!suggestions) return;

        const q = String(term || '').trim().toLowerCase();
        if (!Array.isArray(materialCache)) {
            suggestions.innerHTML = '';
            if (results) results.innerHTML = '<div class="inv-mobile-material-empty"><i class="fa-solid fa-spinner fa-spin"></i><strong>Loading...</strong></div>';
            if (status) status.textContent = 'Loading material records...';
            return;
        }

        if (!q) {
            suggestions.innerHTML = '';
            resetInventoryMobileMaterialFinder();
            return;
        }

        if (q.length < 2) {
            suggestions.innerHTML = '';
            if (status) status.textContent = 'Type at least 2 characters to show suggestions.';
            if (results) results.innerHTML = '<div class="inv-mobile-material-empty"><i class="fa-solid fa-keyboard"></i><strong>Keep typing</strong><span>Suggestions will appear after 2 characters.</span></div>';
            return;
        }

        const matches = materialCache.filter(item => invFinderMatchText(item).includes(q)).slice(0, 12);
        if (status) status.textContent = matches.length
            ? `${matches.length} suggestion${matches.length === 1 ? '' : 's'} found. Pick one item.`
            : 'No matching material found.';

        if (!matches.length) {
            suggestions.innerHTML = '';
            if (results) results.innerHTML = '<div class="inv-mobile-material-empty"><i class="fa-regular fa-face-frown"></i><strong>No item found</strong><span>Try a shorter name or product ID.</span></div>';
            return;
        }

        suggestions.innerHTML = matches.map(item => renderInventoryMobileMaterialSuggestion(item)).join('');
        if (results) results.innerHTML = '<div class="inv-mobile-material-empty"><i class="fa-solid fa-hand-pointer"></i><strong>Select item</strong><span>Tap one suggestion above to view photo, stock, and history.</span></div>';
    }

    function renderInventoryMobileMaterialSuggestion(item) {
        const key = invFinderEscape(item?.key || '');
        const pid = invFinderProductId(item) || 'No ID';
        const name = invFinderProductName(item) || 'Unnamed Item';
        const details = invFinderDetails(item) || 'No details available';
        const balVal = getInventoryItemTotalAvailable(item);
        const photoUrl = invFinderPhotoUrl(item);
        const photoHtml = photoUrl
            ? `<span class="inv-mobile-material-suggestion-photo"><img src="${invFinderEscape(photoUrl)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('photo-error'); this.remove();"></span>`
            : `<span class="inv-mobile-material-suggestion-photo no-photo"><i class="fa-solid fa-image"></i></span>`;
        return `<button type="button" class="inv-mobile-material-suggestion-item" data-material-key="${key}">
            ${photoHtml}
            <span class="inv-mobile-material-suggestion-text">
                <strong>${invFinderEscape(name)}</strong>
                <small>${invFinderEscape(pid)} · ${invFinderEscape(details)}</small>
            </span>
            <span class="inv-mobile-material-suggestion-qty">${invFinderEscape(invFinderQty(balVal))}</span>
        </button>`;
    }

    function renderInventoryMobileMaterialFinderSelected(item) {
        const results = document.getElementById('inv-mobile-material-results');
        const status = document.getElementById('inv-mobile-material-status');
        const suggestions = document.getElementById('inv-mobile-material-suggestions');
        if (suggestions) suggestions.innerHTML = '';
        if (status) status.textContent = 'Previewing selected material.';
        if (results) results.innerHTML = renderInventoryMobileMaterialCard(item);
    }

    function renderInventoryMobileMaterialCard(item) {
        const pid = invFinderProductId(item) || 'No ID';
        const name = invFinderProductName(item) || 'Unnamed Item';
        const details = invFinderDetails(item) || 'No details available';
        const stockQty = invFinderQty(item.stockQty ?? item.stock ?? item.quantity ?? 0);
        const balVal = getInventoryItemTotalAvailable(item);
        const balance = invFinderQty(balVal);
        const photoUrl = invFinderPhotoUrl(item);
        const movements = getInventoryMaterialMovements(item);
        const balanceClass = balVal <= 0 ? 'danger' : (balVal <= 5 ? 'warning' : 'ok');

        const photoHtml = photoUrl
            ? `<a class="inv-mobile-material-photo-link" href="${invFinderEscape(photoUrl)}" target="_blank" rel="noopener"><img src="${invFinderEscape(photoUrl)}" alt="${invFinderEscape(name)}" loading="lazy" onerror="this.closest('.inv-mobile-material-photo-link').classList.add('photo-error'); this.remove();"></a>`
            : `<div class="inv-mobile-material-photo-placeholder"><i class="fa-solid fa-image"></i><span>No Photo</span></div>`;

        const historyHtml = movements.length
            ? movements.map(move => {
                const m = invFinderMovementLine(move);
                return `<div class="inv-mobile-material-history-row">
                    <div class="history-main"><strong>${invFinderEscape(m.type)}</strong><span>${invFinderEscape(m.status)}</span></div>
                    <div class="history-route"><i class="fa-solid fa-location-dot"></i> ${invFinderEscape(m.from)} <i class="fa-solid fa-arrow-right-long"></i> ${invFinderEscape(m.to)}</div>
                    <div class="history-meta"><span>Qty: ${invFinderEscape(m.qty || '0')}</span><span>${invFinderEscape(m.date || '')}</span></div>
                </div>`;
            }).join('')
            : `<div class="inv-mobile-material-history-empty">No movement history found for this item.</div>`;

        return `<article class="inv-mobile-material-card" data-material-key="${invFinderEscape(item?.key || '')}">
            <div class="inv-mobile-material-card-top">
                <div class="inv-mobile-material-photo">${photoHtml}</div>
                <div class="inv-mobile-material-info">
                    <span class="inv-mobile-material-id">${invFinderEscape(pid)}</span>
                    <h3>${invFinderEscape(name)}</h3>
                    <p>${invFinderEscape(details)}</p>
                </div>
            </div>
            <div class="inv-mobile-material-stats single-stat">
                <div class="${balanceClass}"><span>Available Stock</span><strong>${invFinderEscape(balance)}</strong></div>
            </div>
            ${renderInventoryQrLabelBlock(item)}
            <div class="inv-mobile-material-history">
                <div class="inv-mobile-material-history-title"><i class="fa-solid fa-clock-rotate-left"></i> Item Movement History</div>
                ${historyHtml}
            </div>
            ${renderInventoryTransferRequestForm(item)}
            ${renderInventoryTransferRequestCart()}
        </article>`;
    }

    // =====================================================================
    // 7.6.9 — Desktop Inventory Request Review foundation
    // Shows pending mobile transfer requests to Logistic / Storekeeper / Super Admin.
    // 7.7.2 adds controlled conversion to official transfer_entries after stock re-check.
    // 7.7.3 adds delete option for wrong pending requests before conversion.
    // 7.7.4 adds proper conversion modal/designation and combines same-route items.
    // =====================================================================
    function getInventoryRequestReviewSection() {
        let section = document.getElementById('wd-inv-request-review');
        if (section) return section;
        const main = document.querySelector('#workdesk-view .workdesk-main') || document.querySelector('#workdesk-view [role="main"]');
        if (!main) return null;
        section = document.createElement('section');
        section.id = 'wd-inv-request-review';
        section.className = 'workdesk-section hidden inventory-request-review-section';
        section.innerHTML = `<div class="inventory-request-review-head">
            <div><h1><i class="fa-solid fa-clipboard-list"></i> Inventory Request Review</h1><p>Mobile transfer requests from site. Default view shows pending requests only.</p></div>
            <button type="button" id="inv-request-review-refresh" class="secondary-btn"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </div>
        <div class="inventory-request-review-toolbar">
            <label>Show
                <select id="inv-request-review-filter">
                    <option value="pending" selected>Pending</option>
                    <option value="converted">Converted</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All</option>
                </select>
            </label>
        </div>
        <div id="inv-request-review-status" class="inventory-request-review-status">Loading requests...</div>
        <div id="inv-request-review-list" class="inventory-request-review-list"></div>`;
        main.appendChild(section);
        const refresh = section.querySelector('#inv-request-review-refresh');
        if (refresh) refresh.addEventListener('click', loadInventoryRequestReviewList);
        const filter = section.querySelector('#inv-request-review-filter');
        if (filter) filter.addEventListener('change', loadInventoryRequestReviewList);
        const list = section.querySelector('#inv-request-review-list');
        if (list && list.dataset.bound !== '1') {
            list.dataset.bound = '1';
            list.addEventListener('click', handleInventoryRequestReviewListClick);
        }
        return section;
    }

    function ensureInventoryRequestReviewNav() {
        const navList = document.querySelector('#workdesk-nav ul');
        if (!navList) return;
        let li = document.getElementById('wd-nav-inv-request-review')?.closest('li');
        if (!li) {
            li = document.createElement('li');
            li.className = 'wd-nav-inv-request-review desktop-only-li';
            li.innerHTML = `<a href="#" id="wd-nav-inv-request-review"><i class="fa-solid fa-clipboard-list"></i> Request Review <span id="wd-inv-request-review-badge" class="notification-badge" style="display:none;">0</span></a>`;
            const materialLi = document.querySelector('#workdesk-nav .wd-nav-material');
            if (materialLi && materialLi.parentNode === navList) navList.insertBefore(li, materialLi);
            else navList.appendChild(li);
        }
        const link = document.getElementById('wd-nav-inv-request-review');
        if (link && link.dataset.bound !== '1') {
            link.dataset.bound = '1';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                openInventoryRequestReview();
            });
        }
        updateInventoryRequestReviewNavVisibility();
        bindInventoryRequestReviewAutoClose();
        bindInventoryRequestReviewConvertButtonFallback();
    }

    function updateInventoryRequestReviewNavVisibility() {
        const li = document.getElementById('wd-nav-inv-request-review')?.closest('li');
        if (!li) return;
        const mobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
        const activeModule = String(window.__ibaActiveModule || '').toLowerCase();
        // 7.7.2: keep Request Review only in the Inventory module. Do not let old body classes
        // or shared WorkDesk sections make it appear in Invoice/Task pages.
        const inventory = activeModule === 'inventory' || (!activeModule && typeof isDirectInventoryOpenRequested === 'function' && isDirectInventoryOpenRequested());
        if (!mobile && inventory && canAccessInventoryRequestReview()) {
            li.style.removeProperty('display');
            refreshInventoryRequestReviewBadge();
        } else {
            li.style.setProperty('display', 'none', 'important');
        }
    }

    function closeInventoryRequestReview() {
        const section = document.getElementById('wd-inv-request-review');
        if (section) {
            section.classList.add('hidden');
            section.classList.remove('is-open');
        }
        if (document.body) document.body.classList.remove('inventory-request-review-active');
        const link = document.getElementById('wd-nav-inv-request-review');
        if (link) link.classList.remove('active');
    }

    function bindInventoryRequestReviewAutoClose() {
        if (window.__ibaInvRequestReviewAutoCloseBound === true) return;
        window.__ibaInvRequestReviewAutoCloseBound = true;
        document.addEventListener('click', (e) => {
            const reviewLink = e.target && e.target.closest ? e.target.closest('#wd-nav-inv-request-review') : null;
            if (reviewLink) return;
            const navClick = e.target && e.target.closest ? e.target.closest('#workdesk-nav a, .workdesk-footer-nav a, #im-nav a, #invoice-management-view a, #dashboard a, #dashboard button, .dashboard-card, .menu-card, .nav-link') : null;
            if (navClick) closeInventoryRequestReview();
        }, true);
    }

    function bindInventoryRequestReviewConvertButtonFallback() {
        if (window.__ibaInvRequestConvertFallbackBound === true) return;
        window.__ibaInvRequestConvertFallbackBound = true;
        document.addEventListener('click', (event) => {
            const convertBtn = event.target && event.target.closest ? event.target.closest('[data-inv-request-convert]') : null;
            const rejectBtn = event.target && event.target.closest ? event.target.closest('[data-inv-request-reject]') : null;
            const deleteBtn = event.target && event.target.closest ? event.target.closest('[data-inv-request-delete]') : null;
            const btn = convertBtn || rejectBtn || deleteBtn;
            if (!btn || !btn.closest('#wd-inv-request-review')) return;
            event.preventDefault();
            event.stopPropagation();
            if (convertBtn) {
                const code = convertBtn.getAttribute('data-inv-request-convert') || convertBtn.getAttribute('data-inv-request-code') || '';
                convertInventoryRequestToOfficialTransfer(code, convertBtn);
                return;
            }
            if (rejectBtn) {
                const code = rejectBtn.getAttribute('data-inv-request-reject') || rejectBtn.getAttribute('data-inv-request-code') || '';
                rejectInventoryRequest(code, rejectBtn);
                return;
            }
            if (deleteBtn) {
                const code = deleteBtn.getAttribute('data-inv-request-delete') || deleteBtn.getAttribute('data-inv-request-code') || '';
                deleteInventoryRequest(code, deleteBtn);
            }
        }, true);
    }

    function openInventoryRequestReview() {
        if (!canAccessInventoryRequestReview()) {
            alert('Request Review is available only for Logistic / Storekeeper / COO / Super Admin.');
            return;
        }
        const section = getInventoryRequestReviewSection();
        if (!section) return;
        try { window.__ibaActiveModule = 'inventory'; } catch (_) {}
        if (document.body) {
            document.body.classList.add('inventory-mode');
            document.body.classList.add('inventory-request-review-active');
            document.body.classList.remove('inventory-mobile-finder-active');
        }
        try { closeInventoryMobileMaterialFinder(); } catch (_) {}
        document.querySelectorAll('#workdesk-view .workdesk-section, .workdesk-section').forEach(el => el.classList.add('hidden'));
        section.classList.remove('hidden');
        section.classList.add('is-open');
        document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
        document.getElementById('wd-nav-inv-request-review')?.classList.add('active');
        loadInventoryRequestReviewList();
    }

    async function refreshInventoryRequestReviewBadge() {
        const badge = document.getElementById('wd-inv-request-review-badge');
        if (!badge || !canAccessInventoryRequestReview()) return;
        try {
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) return;
            const snap = await dbRef.ref('inventory_requests').limitToLast(100).once('value');
            const data = snap.val() || {};
            const pending = Object.values(data).filter(r => String(r?.status || '').toLowerCase() === 'pending office review').length;
            if (pending > 0) {
                badge.textContent = String(pending);
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        } catch (err) {
            console.warn('Request review badge failed:', err);
        }
    }

    function invRequestStatusBucket(status) {
        const s = String(status || '').trim().toLowerCase();
        if (s === 'pending office review' || s === 'pending' || !s) return 'pending';
        if (s.includes('converted')) return 'converted';
        if (s.includes('reject')) return 'rejected';
        if (s.includes('delete')) return 'deleted';
        return s.replace(/\s+/g, '-');
    }

    async function loadInventoryRequestReviewList() {
        const list = document.getElementById('inv-request-review-list');
        const status = document.getElementById('inv-request-review-status');
        const filterEl = document.getElementById('inv-request-review-filter');
        const activeFilter = invRequestSafeText(filterEl?.value || 'pending').toLowerCase() || 'pending';
        const filterLabelMap = { pending: 'pending', converted: 'converted', rejected: 'rejected', all: 'all' };
        const label = filterLabelMap[activeFilter] || activeFilter;
        if (!list) return;
        if (status) status.textContent = `Loading ${label} requests...`;
        list.innerHTML = '';
        try {
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) throw new Error('Firebase database is not loaded.');
            const snap = await dbRef.ref('inventory_requests').limitToLast(150).once('value');
            const data = snap.val() || {};
            let requests = Object.entries(data)
                .map(([key, value]) => ({ ...(value || {}), __firebaseKey: key, requestCode: invRequestSafeText(value?.requestCode || key) }))
                .filter(r => {
                    const bucket = invRequestStatusBucket(r?.status);
                    if (activeFilter === 'all') return bucket !== 'deleted';
                    return bucket === activeFilter;
                })
                .sort((a,b) => String(b.createdAt || b.convertedAt || b.rejectedAt || '').localeCompare(String(a.createdAt || a.convertedAt || a.rejectedAt || '')));

            const noun = activeFilter === 'all' ? 'request' : `${label} request`;
            if (status) status.textContent = requests.length ? `${requests.length} ${noun}${requests.length === 1 ? '' : 's'}.` : `No ${noun}${activeFilter === 'all' ? 's' : ''}.`;
            if (!requests.length) {
                list.innerHTML = `<div class="inventory-request-empty"><i class="fa-solid fa-clipboard-check"></i><strong>No ${invFinderEscape(label)} requests</strong><span>Use the filter above to view Pending, Converted, or Rejected requests.</span></div>`;
                refreshInventoryRequestReviewBadge();
                return;
            }
            list.innerHTML = requests.map(renderInventoryRequestReviewCard).join('');
            refreshInventoryRequestReviewBadge();
        } catch (err) {
            console.error('Inventory request review load failed:', err);
            if (status) status.textContent = 'Unable to load requests.';
            list.innerHTML = `<div class="inventory-request-empty"><i class="fa-solid fa-triangle-exclamation"></i><strong>Unable to load requests</strong><span>Please try refresh.</span></div>`;
        }
    }



    function invRequestSafeText(value) {
        return String(value ?? '').trim();
    }

    function invRequestSiteLooseMatch(a, b) {
        const rawA = invRequestSafeText(a).replace(/_/g, ' ');
        const rawB = invRequestSafeText(b).replace(/_/g, ' ');
        if (!rawA || !rawB) return false;
        const normA = invSiteNorm(rawA);
        const normB = invSiteNorm(rawB);
        if (!normA || !normB) return false;
        if (normA === normB) return true;
        const headA = invSiteNorm(rawA.split(/\s+-\s+|➔|→/)[0]);
        const headB = invSiteNorm(rawB.split(/\s+-\s+|➔|→/)[0]);
        if (headA && headB && headA === headB) return true;
        // Common case: "100 - STORE" against "100".
        if (headA && normB === headA) return true;
        if (headB && normA === headB) return true;
        if (normA.length >= 3 && normB.includes(normA)) return true;
        if (normB.length >= 3 && normA.includes(normB)) return true;
        return false;
    }

    function invRequestMaterialGroupKeyFromLine(line) {
        const pid = invFinderNormalizeCode(line?.productId || line?.productID || line?.productIDNo || '');
        if (pid) return `pid:${pid}`;
        return `name:${invRequestNorm(line?.productName || '')}|${invRequestNorm(line?.details || '')}`;
    }

    function invRequestMaterialRowMatchesLine(row, line) {
        if (!row || !line) return false;
        const linePid = invFinderNormalizeCode(line.productId || line.productID || line.productIDNo || '');
        const rowPid = invFinderNormalizeCode(row.productId || row.productID || row.ProductID || row.productIDNo || row.id || '');
        if (linePid && rowPid && linePid === rowPid) return true;
        const lineName = invRequestNorm(line.productName || '');
        const rowName = invRequestNorm(invFinderProductName(row));
        const lineDetail = invRequestNorm(line.details || '');
        const rowDetail = invRequestNorm(invFinderDetails(row));
        return !!(lineName && rowName && lineName === rowName && (!lineDetail || !rowDetail || lineDetail === rowDetail));
    }

    function invRequestQtyFromRowAtSite(row, fromSite) {
        if (!row || !fromSite) return 0;
        let total = 0;
        if (row.sites && typeof row.sites === 'object') {
            Object.entries(row.sites).forEach(([siteKey, qty]) => {
                if (invRequestSiteLooseMatch(siteKey, fromSite)) total += invFinderNumber(qty);
            });
            return total;
        }
        const rowSite = row.site || row.siteNo || row.siteNumber || row.site_name || row.siteName || row.location || row.projectSite || '';
        if (!invRequestSiteLooseMatch(rowSite, fromSite)) return 0;
        return invFinderNumber(row.balanceQty ?? row.availableQty ?? row.available ?? row.stockQty ?? row.stock ?? row.quantity ?? 0);
    }

    async function loadInventoryRequestMaterialRows() {
        const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
        if (!dbRef) throw new Error('Firebase database is not loaded.');
        const snap = await dbRef.ref('material_stock').once('value');
        const obj = snap.val() || {};
        return Object.entries(obj).map(([key, val]) => ({ key, ...(val || {}) }));
    }

    function validateInventoryRequestStockBeforeConvert(req, materialRows) {
        const items = Array.isArray(req.items) ? req.items : Object.values(req.items || {});
        if (!items.length) return { ok: false, message: 'This request has no item lines.', shortages: [] };

        const needed = new Map();
        items.forEach(line => {
            const from = invRequestSafeText(line.fromSite || line.fromSiteLabel || '');
            const qty = invFinderNumber(line.qty);
            if (!from || qty <= 0) return;
            const key = `${invRequestMaterialGroupKeyFromLine(line)}@@${invSiteNorm(from)}`;
            const current = needed.get(key) || { line, fromSite: from, qty: 0, key };
            current.qty += qty;
            needed.set(key, current);
        });

        const shortages = [];
        for (const check of needed.values()) {
            const matchingRows = materialRows.filter(row => invRequestMaterialRowMatchesLine(row, check.line));
            const available = matchingRows.reduce((sum, row) => sum + invRequestQtyFromRowAtSite(row, check.fromSite), 0);
            if (check.qty > available) {
                shortages.push({
                    ...check,
                    available,
                    shortage: Math.max(0, check.qty - available),
                    message: `${check.line.productName || check.line.productId || 'Item'} from ${check.fromSite}: requested ${invFinderQty(check.qty)}, available ${invFinderQty(available)}.`
                });
            }
        }
        if (shortages.length) {
            return {
                ok: false,
                shortages,
                message: shortages.map(s => s.message).slice(0, 5).join('\n')
            };
        }
        return { ok: true, shortages: [] };
    }

    function buildInventoryRequestReducedItems(req, materialRows) {
        const items = Array.isArray(req.items) ? req.items : Object.values(req.items || {});
        const availableMap = new Map();
        const usedMap = new Map();
        const adjusted = [];
        const changes = [];

        items.forEach(line => {
            const from = invRequestSafeText(line.fromSite || line.fromSiteLabel || '');
            const key = `${invRequestMaterialGroupKeyFromLine(line)}@@${invSiteNorm(from)}`;
            if (!availableMap.has(key)) {
                const matchingRows = materialRows.filter(row => invRequestMaterialRowMatchesLine(row, line));
                const available = matchingRows.reduce((sum, row) => sum + invRequestQtyFromRowAtSite(row, from), 0);
                availableMap.set(key, available);
            }
            const requested = invFinderNumber(line.qty);
            const used = usedMap.get(key) || 0;
            const remaining = Math.max(0, invFinderNumber(availableMap.get(key)) - used);
            const allowed = Math.min(requested, remaining);

            if (allowed > 0) {
                const nextLine = { ...line, qty: allowed };
                if (allowed !== requested) {
                    nextLine.originalRequestedQty = requested;
                    nextLine.adjustedQty = allowed;
                    nextLine.stockAdjustedAt = new Date().toISOString();
                }
                adjusted.push(nextLine);
            }

            usedMap.set(key, used + allowed);
            if (allowed !== requested) {
                changes.push({
                    productName: line.productName || line.productId || 'Item',
                    fromSite: from || 'N/A',
                    requested,
                    adjusted: allowed,
                    available: invFinderNumber(availableMap.get(key))
                });
            }
        });

        return { items: adjusted, changes, changed: changes.length > 0 };
    }

    async function offerInventoryRequestStockAdjustment(req, materialRows, code, reasonText = '') {
        const reduced = buildInventoryRequestReducedItems(req, materialRows);
        if (!reduced.changed) return null;
        const validLines = reduced.items.filter(line => invFinderNumber(line.qty) > 0);
        const changeLines = reduced.changes.map(ch =>
            `• ${ch.productName} from ${ch.fromSite}: ${invFinderQty(ch.requested)} → ${invFinderQty(ch.adjusted)}`
        ).slice(0, 8).join('\n');

        if (!validLines.length) {
            alert(`Stock changed and no quantity is available for this request anymore.\n\n${reasonText || ''}\n\nPlease delete/reject this request and create a new one if needed.`);
            return null;
        }

        const ok = confirm(`Stock changed before this request was converted.\n\nFirst completed/converted requests take priority, so this request must be adjusted before it can continue.\n\nAdjust request quantity to current available stock?\n\n${changeLines}\n\nOK = continue with reduced qty.\nCancel = keep request pending so you can delete/reject or review it.`);
        if (!ok) return null;

        const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
        if (!dbRef) throw new Error('Firebase database is not loaded.');
        const reviewer = invRequestUser();
        const adjustmentLog = {
            at: new Date().toISOString(),
            by: reviewer.name || 'Unknown',
            changes: reduced.changes
        };
        await dbRef.ref(`inventory_requests/${code}`).update({
            items: validLines,
            stockAdjustedAt: adjustmentLog.at,
            stockAdjustedBy: adjustmentLog.by,
            stockAdjustmentLog: adjustmentLog,
            remarks: 'Adjusted to current available stock before official conversion'
        });
        return { ...req, items: validLines, stockAdjustmentLog: adjustmentLog };
    }

    function buildOfficialTransferControlNumber(requestCode, index) {
        const base = String(requestCode || 'REQ').replace(/^TRFREQ-?/i, '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 28);
        return `TRF-${base}-${String(index + 1).padStart(2, '0')}`;
    }

    function invRequestNormName(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function getInventoryRequestApproverRecords() {
        let data = null;
        try {
            if (typeof getCachedApproversData === 'function') data = getCachedApproversData();
        } catch (_) {}
        try {
            if ((!data || Object.keys(data || {}).length === 0) && typeof allApproverData !== 'undefined') data = allApproverData;
        } catch (_) {}
        const list = Object.entries(data || {}).map(([key, a]) => ({
            key,
            name: invRequestSafeText(a?.Name || a?.Username || a?.FullName || ''),
            position: invRequestSafeText(a?.Position || ''),
            role: invRequestSafeText(a?.Role || ''),
            site: invRequestSafeText(a?.Site || '')
        })).filter(u => u.name);
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }

    function isInventoryRequestAdminRecord(user) {
        const role = String(user?.role || '').toLowerCase();
        const pos = String(user?.position || '').toLowerCase();
        return role === 'admin' || role.includes('admin') || pos.includes('super admin');
    }

    function buildInventoryRequestUserOptions(list, selectedName = '') {
        const selectedNorm = invRequestNormName(selectedName);
        return (list || []).map(u => {
            const labelParts = [u.name];
            if (u.position) labelParts.push(u.position);
            if (u.site) labelParts.push(`Site ${u.site}`);
            const selected = selectedNorm && invRequestNormName(u.name) === selectedNorm ? ' selected' : '';
            return `<option value="${invFinderEscape(u.name)}"${selected}>${invFinderEscape(labelParts.join(' — '))}</option>`;
        }).join('');
    }

    function findInventoryRequestDefaultUser(users, { site = '', positionIncludes = [], roleAdminOnly = false } = {}) {
        const candidates = (users || []).filter(u => !roleAdminOnly || isInventoryRequestAdminRecord(u));
        const posTerms = (positionIncludes || []).map(v => String(v || '').toLowerCase()).filter(Boolean);
        const siteNorm = invSiteNorm(site || '');
        const bySiteAndPosition = candidates.find(u => {
            const okPos = posTerms.length === 0 || posTerms.some(term => String(u.position || '').toLowerCase().includes(term));
            const okSite = siteNorm && invSiteNorm(u.site || '').includes(siteNorm);
            return okPos && okSite;
        });
        if (bySiteAndPosition) return bySiteAndPosition.name;
        const byPosition = candidates.find(u => posTerms.length === 0 || posTerms.some(term => String(u.position || '').toLowerCase().includes(term)));
        if (byPosition) return byPosition.name;
        const currentName = invRequestSafeText((typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover.Name : '');
        const currentRecord = candidates.find(u => invRequestNormName(u.name) === invRequestNormName(currentName));
        if (currentRecord) return currentRecord.name;
        return candidates[0]?.name || '';
    }

    function getInventoryRequestItems(req) {
        return Array.isArray(req?.items) ? req.items : Object.values(req?.items || {});
    }

    function getInventoryRequestRouteGroups(req) {
        const items = getInventoryRequestItems(req);
        const groups = new Map();
        items.forEach(line => {
            const fromSite = invRequestSafeText(line.fromSite || line.fromSiteLabel || '');
            const toSite = invRequestSafeText(line.toSite || line.toSiteLabel || '');
            const groupKey = `${invSiteNorm(fromSite)}@@${invSiteNorm(toSite)}`;
            if (!groups.has(groupKey)) groups.set(groupKey, { key: groupKey, fromSite, toSite, lines: [] });
            groups.get(groupKey).lines.push(line);
        });
        return Array.from(groups.values());
    }

    function buildOfficialTransferEntryFromRequestLine(req, line, index, officialKey, reviewer, routeMeta = {}) {
        const nowIso = new Date().toISOString();
        const todayYmd = nowIso.slice(0, 10);
        const shippingDate = invRequestSafeText(line.shippingDate || req.shippingDate || req.requestedShippingDate || todayYmd) || todayYmd;
        const qty = invFinderNumber(line.qty);
        const fromSite = invRequestSafeText(line.fromSite || line.fromSiteLabel || routeMeta.fromSite || '');
        const toSite = invRequestSafeText(line.toSite || line.toSiteLabel || routeMeta.toSite || '');
        const requester = invRequestSafeText(req.requestedBy || line.requestedBy || reviewer.name || 'Unknown');
        const reviewerName = invRequestSafeText(reviewer.name || 'Unknown');
        const sourceContact = invRequestSafeText(routeMeta.sourceContact || reviewerName);
        const approver = invRequestSafeText(routeMeta.approver || '');
        const receiver = invRequestSafeText(routeMeta.receiver || requester);
        const controlNumber = invRequestSafeText(routeMeta.controlNumber || buildOfficialTransferControlNumber(req.requestCode, index));
        return {
            controlNumber,
            controlId: controlNumber,
            ref: controlNumber,
            jobType: 'Transfer',
            for: 'Transfer',
            productID: invRequestSafeText(line.productId || line.productID || ''),
            productId: invRequestSafeText(line.productId || line.productID || ''),
            productName: invRequestSafeText(line.productName || ''),
            details: invRequestSafeText(line.details || ''),
            fromSite,
            toSite,
            fromLocation: fromSite,
            toLocation: toSite,
            requiredQty: qty,
            orderedQty: qty,
            requestor: requester,
            approver,
            sourceContact,
            receiver,
            contactName: sourceContact,
            attention: sourceContact,
            status: 'Pending Source',
            remarks: 'Pending Source',
            enteredBy: reviewerName,
            createdBy: reviewerName,
            createdAt: nowIso,
            date: todayYmd,
            shippingDate,
            timestamp: (typeof firebase !== 'undefined' && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now(),
            source: 'mobile-request-conversion',
            convertedFromRequest: true,
            requestCode: invRequestSafeText(req.requestCode || ''),
            inventoryRequestCode: invRequestSafeText(req.requestCode || ''),
            requestItemCartId: invRequestSafeText(line.cartId || ''),
            materialKey: invRequestSafeText(line.materialKey || ''),
            materialGroupKey: invRequestSafeText(line.materialGroupKey || ''),
            splitFromMultiSource: !!line.splitFromMultiSource,
            convertedRouteKey: invRequestSafeText(routeMeta.routeKey || ''),
            originalRequestedByPosition: invRequestSafeText(req.requestedByPosition || ''),
            history: [{
                action: 'Converted to Official Transfer',
                by: reviewerName,
                timestamp: Date.now(),
                note: `From mobile request ${req.requestCode || ''}; pending source confirmation by ${sourceContact}`
            }]
        };
    }

    function canRejectInventoryTransferRequests() {
        return canAccessInventoryRequestReview();
    }

    async function rejectInventoryRequest(requestCode, button = null) {
        if (!canRejectInventoryTransferRequests()) {
            alert('You are not authorized to reject this request.');
            return;
        }
        const code = invRequestSafeText(requestCode);
        if (!code) {
            alert('Reject failed: missing request code. Please refresh Request Review and try again.');
            return;
        }
        const reason = prompt(`Reject ${code}?\n\nEnter rejection reason:`);
        if (reason === null) return;
        const cleanReason = invRequestSafeText(reason);
        if (!cleanReason) {
            alert('Please enter a rejection reason.');
            return;
        }

        const originalText = button ? button.innerHTML : '';
        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rejecting...';
            }
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) throw new Error('Firebase database is not loaded.');
            const reqRef = dbRef.ref(`inventory_requests/${code}`);
            const snap = await reqRef.once('value');
            const req = snap.val();
            if (!req) throw new Error('Request not found.');
            if (invRequestStatusBucket(req.status) !== 'pending') {
                alert(`This request is already ${req.status || 'processed'} and cannot be rejected as pending.`);
                loadInventoryRequestReviewList();
                return;
            }
            const reviewer = invRequestUser();
            await reqRef.update({
                status: 'Rejected',
                remarks: `Rejected: ${cleanReason}`,
                rejectionReason: cleanReason,
                rejectedBy: reviewer.name || 'Unknown',
                rejectedByPosition: reviewer.position || '',
                rejectedAt: new Date().toISOString()
            });
            alert(`${code} rejected.\n\nReason: ${cleanReason}`);
            loadInventoryRequestReviewList();
            refreshInventoryRequestReviewBadge();
        } catch (err) {
            console.error('Reject inventory request failed:', err);
            alert(`Reject failed: ${err.message || err}`);
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
            }
        }
    }

    async function deleteInventoryRequest(requestCode, button = null) {
        if (!canDeleteInventoryTransferRequests()) {
            alert('Only Logistic / COO / Super Admin can delete pending requests.');
            return;
        }
        const code = invRequestSafeText(requestCode);
        if (!code) {
            alert('Delete failed: missing request code. Please refresh Request Review and try again.');
            return;
        }
        if (!confirm(`Delete ${code}?\n\nThis will remove the pending request only. No stock movement will happen.`)) return;

        const originalText = button ? button.innerHTML : '';
        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
            }
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) throw new Error('Firebase database is not loaded.');
            const reqRef = dbRef.ref(`inventory_requests/${code}`);
            const reqSnap = await reqRef.once('value');
            const req = reqSnap.val();
            if (!req) {
                alert('Request not found or already deleted.');
                loadInventoryRequestReviewList();
                refreshInventoryRequestReviewBadge();
                return;
            }
            if (String(req.status || '').toLowerCase() !== 'pending office review') {
                alert(`This request is already ${req.status || 'processed'} and cannot be deleted from pending review.`);
                loadInventoryRequestReviewList();
                return;
            }
            await reqRef.remove();
            alert(`${code} deleted. You can now create a new correct request.`);
            loadInventoryRequestReviewList();
            refreshInventoryRequestReviewBadge();
        } catch (err) {
            console.error('Delete inventory request failed:', err);
            alert(`Delete failed: ${err.message || err}`);
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
            }
        }
    }

    function ensureInventoryRequestConvertModal() {
        let modal = document.getElementById('inv-request-convert-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'inv-request-convert-modal';
        modal.className = 'inventory-request-convert-backdrop hidden';
        modal.innerHTML = `
            <div class="inventory-request-convert-modal" role="dialog" aria-modal="true" aria-labelledby="inv-request-convert-title">
                <div class="inventory-request-convert-head">
                    <div>
                        <h2 id="inv-request-convert-title"><i class="fa-solid fa-right-left"></i> Convert Request to Official Transfer</h2>
                        <p id="inv-request-convert-subtitle">Complete the official designation before creating transfer record(s).</p>
                    </div>
                    <button type="button" id="inv-request-convert-close" class="inventory-request-convert-close" aria-label="Close">×</button>
                </div>
                <div id="inv-request-convert-body" class="inventory-request-convert-body"></div>
                <div class="inventory-request-convert-footer">
                    <button type="button" id="inv-request-convert-cancel" class="secondary-btn">Cancel</button>
                    <button type="button" id="inv-request-convert-submit" class="primary-btn"><i class="fa-solid fa-file-circle-check"></i> Create Official Transfer</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        const close = () => modal.classList.add('hidden');
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        modal.querySelector('#inv-request-convert-close')?.addEventListener('click', close);
        modal.querySelector('#inv-request-convert-cancel')?.addEventListener('click', close);
        modal.querySelector('#inv-request-convert-submit')?.addEventListener('click', () => submitInventoryRequestConversionFromModal());
        return modal;
    }

    function renderInventoryRequestConvertModal(req) {
        const modal = ensureInventoryRequestConvertModal();
        const body = modal.querySelector('#inv-request-convert-body');
        const subtitle = modal.querySelector('#inv-request-convert-subtitle');
        const users = getInventoryRequestApproverRecords();
        const adminUsers = users.filter(isInventoryRequestAdminRecord);
        const groups = getInventoryRequestRouteGroups(req);
        if (subtitle) subtitle.textContent = `${req.requestCode || 'Request'} • ${groups.length} route${groups.length === 1 ? '' : 's'} • same From/To items will be combined under one Transfer ID.`;
        const currentUser = invRequestUser();
        const reviewerName = invRequestSafeText(currentUser.name || '');
        const groupHtml = groups.map((group, index) => {
            const sourceDefault = findInventoryRequestDefaultUser(users, { site: group.fromSite, positionIncludes: ['storekeeper', 'logistic'] }) || reviewerName;
            const receiverDefault = findInventoryRequestDefaultUser(users, { site: group.toSite, positionIncludes: ['site dc', 'storekeeper', 'logistic'] });
            const approverDefault = findInventoryRequestDefaultUser(adminUsers, { roleAdminOnly: true }) || reviewerName;
            const linesHtml = group.lines.map(line => `
                <div class="inventory-request-convert-line">
                    <span><strong>${invFinderEscape(line.productName || line.productId || 'Item')}</strong><small>${invFinderEscape(line.productId || '')} ${line.details ? '· ' + invFinderEscape(line.details) : ''}</small></span>
                    <b>Qty ${invFinderEscape(invFinderQty(line.qty))}</b>
                </div>`).join('');
            return `
                <section class="inventory-request-convert-route" data-route-index="${index}" data-route-key="${invFinderEscape(group.key)}">
                    <div class="inventory-request-convert-route-head">
                        <div><strong>Official Transfer ${index + 1}</strong><span>${invFinderEscape(group.fromSite)} → ${invFinderEscape(group.toSite)}</span></div>
                        <em>${group.lines.length} item${group.lines.length === 1 ? '' : 's'} combined</em>
                    </div>
                    <div class="inventory-request-convert-lines">${linesHtml}</div>
                    <div class="inventory-request-convert-grid">
                        <label>Source Qty Checker / Confirmer
                            <select data-convert-field="sourceContact" data-route-index="${index}" required>
                                <option value="">Select source checker</option>
                                ${buildInventoryRequestUserOptions(users, sourceDefault)}
                            </select>
                        </label>
                        <label>Approver (Admin role only)
                            <select data-convert-field="approver" data-route-index="${index}" required>
                                <option value="">Select approver</option>
                                ${buildInventoryRequestUserOptions(adminUsers, approverDefault)}
                            </select>
                        </label>
                        <label>Receiver / Receiving Contact
                            <select data-convert-field="receiver" data-route-index="${index}" required>
                                <option value="">Select receiver</option>
                                ${buildInventoryRequestUserOptions(users, receiverDefault)}
                            </select>
                        </label>
                    </div>
                </section>`;
        }).join('');
        if (body) {
            body.innerHTML = `
                <div class="inventory-request-convert-warning">
                    <i class="fa-solid fa-circle-info"></i>
                    This will create official Transfer record(s) with status <strong>Pending Source</strong>. Stock will not move yet. Source checker confirms qty first, then it goes to the selected admin approver, then receiver.
                </div>
                ${groupHtml || '<div class="inventory-request-empty">No route lines found.</div>'}`;
        }
        modal.dataset.requestCode = invRequestSafeText(req.__firebaseKey || req.requestCode || '');
        modal.dataset.displayCode = invRequestSafeText(req.requestCode || req.__firebaseKey || '');
        modal.classList.remove('hidden');
    }

    async function openInventoryRequestConvertModal(requestCode, button = null) {
        if (!canReviewInventoryTransferRequests()) {
            alert('Only Logistic / Storekeeper / Super Admin can convert requests.');
            return;
        }
        const code = invRequestSafeText(requestCode);
        if (!code) {
            alert('Convert failed: missing request code. Please refresh Request Review and try again.');
            return;
        }
        const originalText = button ? button.innerHTML : '';
        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
            }
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) throw new Error('Firebase database is not loaded.');
            if (typeof ensureApproverDataCached === 'function') await ensureApproverDataCached(false);
            const reqSnap = await dbRef.ref(`inventory_requests/${code}`).once('value');
            const req = reqSnap.val();
            if (!req) throw new Error('Request not found.');
            if (String(req.status || '').toLowerCase() !== 'pending office review') {
                alert(`This request is already ${req.status || 'processed'}.`);
                loadInventoryRequestReviewList();
                return;
            }
            const items = getInventoryRequestItems(req);
            if (!items.length) throw new Error('Request has no item lines.');
            const materialRows = await loadInventoryRequestMaterialRows();
            const stockCheck = validateInventoryRequestStockBeforeConvert(req, materialRows);
            let reviewReq = req;
            if (!stockCheck.ok) {
                const adjustedReq = await offerInventoryRequestStockAdjustment(req, materialRows, code, stockCheck.message);
                if (!adjustedReq) return;
                reviewReq = adjustedReq;
                alert('Request quantity was adjusted to current available stock. Please review the updated lines before creating the official transfer.');
            }
            renderInventoryRequestConvertModal({ ...reviewReq, __firebaseKey: code, requestCode: invRequestSafeText(reviewReq.requestCode || code) });
        } catch (err) {
            console.error('Open inventory request conversion failed:', err);
            alert(`Convert failed: ${err.message || err}`);
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
            }
        }
    }

    async function submitInventoryRequestConversionFromModal() {
        const modal = ensureInventoryRequestConvertModal();
        const code = invRequestSafeText(modal.dataset.requestCode || modal.dataset.displayCode || '');
        if (!code) {
            alert('Convert failed: missing request code. Please close and reopen Request Review.');
            return;
        }
        const groupsMeta = [];
        const routeSections = Array.from(modal.querySelectorAll('.inventory-request-convert-route'));
        for (const section of routeSections) {
            const index = Number(section.dataset.routeIndex || 0);
            const sourceContact = invRequestSafeText(section.querySelector('[data-convert-field="sourceContact"]')?.value || '');
            const approver = invRequestSafeText(section.querySelector('[data-convert-field="approver"]')?.value || '');
            const receiver = invRequestSafeText(section.querySelector('[data-convert-field="receiver"]')?.value || '');
            if (!sourceContact || !approver || !receiver) {
                alert('Please complete Source Checker, Approver, and Receiver for every route.');
                return;
            }
            groupsMeta[index] = { sourceContact, approver, receiver, routeKey: invRequestSafeText(section.dataset.routeKey || '') };
        }
        if (!confirm(`Create official Transfer record(s) for ${modal.dataset.displayCode || code}?\n\nThis will start at Pending Source. No stock will move yet.`)) return;

        const submitBtn = modal.querySelector('#inv-request-convert-submit');
        const originalText = submitBtn ? submitBtn.innerHTML : '';
        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
            }
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) throw new Error('Firebase database is not loaded.');

            const reqSnap = await dbRef.ref(`inventory_requests/${code}`).once('value');
            const req = reqSnap.val();
            if (!req) throw new Error('Request not found.');
            if (String(req.status || '').toLowerCase() !== 'pending office review') {
                alert(`This request is already ${req.status || 'processed'}.`);
                modal.classList.add('hidden');
                loadInventoryRequestReviewList();
                return;
            }

            const materialRows = await loadInventoryRequestMaterialRows();
            const stockCheck = validateInventoryRequestStockBeforeConvert(req, materialRows);
            if (!stockCheck.ok) {
                const adjustedReq = await offerInventoryRequestStockAdjustment(req, materialRows, code, stockCheck.message);
                if (adjustedReq) {
                    alert('Request was adjusted to current available stock. Please review the updated lines and click Create Official Transfer again.');
                    renderInventoryRequestConvertModal({ ...adjustedReq, __firebaseKey: code, requestCode: invRequestSafeText(adjustedReq.requestCode || code) });
                }
                return;
            }

            const reviewer = invRequestUser();
            const routeGroups = getInventoryRequestRouteGroups(req);
            const updates = {};
            const officialKeys = [];
            const officialGroups = [];
            let runningIndex = 0;
            routeGroups.forEach((group, groupIndex) => {
                const meta = groupsMeta[groupIndex] || {};
                const controlNumber = buildOfficialTransferControlNumber(req.requestCode || code, groupIndex);
                officialGroups.push({ controlNumber, fromSite: group.fromSite, toSite: group.toSite, itemCount: group.lines.length, sourceContact: meta.sourceContact, approver: meta.approver, receiver: meta.receiver });
                group.lines.forEach(line => {
                    const newRef = dbRef.ref('transfer_entries').push();
                    const officialKey = newRef.key;
                    officialKeys.push(officialKey);
                    updates[`transfer_entries/${officialKey}`] = buildOfficialTransferEntryFromRequestLine(req, line, runningIndex, officialKey, reviewer, {
                        ...meta,
                        controlNumber,
                        fromSite: group.fromSite,
                        toSite: group.toSite,
                        routeKey: group.key
                    });
                    runningIndex += 1;
                });
            });
            const reviewerName = invRequestSafeText(reviewer.name || 'Unknown');
            updates[`inventory_requests/${code}/status`] = 'Converted to Official';
            updates[`inventory_requests/${code}/remarks`] = 'Converted to Official Transfer';
            updates[`inventory_requests/${code}/convertedBy`] = reviewerName;
            updates[`inventory_requests/${code}/convertedByPosition`] = invRequestSafeText(reviewer.position || '');
            updates[`inventory_requests/${code}/convertedAt`] = new Date().toISOString();
            updates[`inventory_requests/${code}/officialTransferKeys`] = officialKeys;
            updates[`inventory_requests/${code}/officialTransferGroups`] = officialGroups;
            updates[`inventory_requests/${code}/officialTransferCount`] = officialKeys.length;
            updates[`inventory_requests/${code}/officialRouteCount`] = officialGroups.length;

            await dbRef.ref().update(updates);
            modal.classList.add('hidden');
            alert(`${code} converted to ${officialGroups.length} official Transfer route${officialGroups.length === 1 ? '' : 's'} with ${officialKeys.length} item line${officialKeys.length === 1 ? '' : 's'}.\n\nStatus: Pending Source confirmation.`);
            try { if (typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(true); } catch (_) {}
            try { if (typeof populateActiveTasks === 'function') populateActiveTasks(); } catch (_) {}
            try {
                if (document.getElementById('reporting-table-body')) {
                    if (typeof filterAndRenderReport === 'function') filterAndRenderReport(window.allSystemEntries || []);
                    else if (typeof renderReportingTable === 'function') renderReportingTable(window.allSystemEntries || []);
                }
            } catch (_) {}
            loadInventoryRequestReviewList();
            refreshInventoryRequestReviewBadge();
        } catch (err) {
            console.error('Convert inventory request failed:', err);
            alert(`Convert failed: ${err.message || err}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    async function convertInventoryRequestToOfficialTransfer(requestCode, button = null) {
        return openInventoryRequestConvertModal(requestCode, button);
    }

    function handleInventoryRequestReviewListClick(event) {
        const convertBtn = event.target.closest('[data-inv-request-convert]');
        const rejectBtn = event.target.closest('[data-inv-request-reject]');
        const deleteBtn = event.target.closest('[data-inv-request-delete]');
        if (!convertBtn && !rejectBtn && !deleteBtn) return;
        event.preventDefault();
        event.stopPropagation();
        if (convertBtn) {
            convertInventoryRequestToOfficialTransfer(convertBtn.getAttribute('data-inv-request-convert') || '', convertBtn);
            return;
        }
        if (rejectBtn) {
            rejectInventoryRequest(rejectBtn.getAttribute('data-inv-request-reject') || '', rejectBtn);
            return;
        }
        if (deleteBtn) deleteInventoryRequest(deleteBtn.getAttribute('data-inv-request-delete') || '', deleteBtn);
    }

    function renderInventoryRequestReviewCard(req) {
        const items = Array.isArray(req.items) ? req.items : Object.values(req.items || {});
        const requestKey = invRequestSafeText(req.__firebaseKey || req.requestCode || '');
        const displayCode = invRequestSafeText(req.requestCode || requestKey);
        const statusBucket = invRequestStatusBucket(req.status);
        const isPending = statusBucket === 'pending';
        const itemsHtml = items.map(it => `<div class="inventory-request-review-item"><strong>${invFinderEscape(it.productName || it.productId || 'Item')}</strong><span>${invFinderEscape(it.productId || '')} · Qty ${invFinderEscape(invFinderQty(it.qty))}</span><small>${invFinderEscape(it.fromSiteLabel || it.fromSite || '')} → ${invFinderEscape(it.toSiteLabel || it.toSite || '')}${it.remarks ? ' · ' + invFinderEscape(it.remarks) : ''}</small></div>`).join('');
        const rejectionHtml = statusBucket === 'rejected'
            ? `<div class="inventory-request-review-note is-rejected"><i class="fa-solid fa-ban"></i> Rejected by ${invFinderEscape(req.rejectedBy || '')}${req.rejectionReason ? ': ' + invFinderEscape(req.rejectionReason) : ''}</div>`
            : '';
        const convertedHtml = statusBucket === 'converted'
            ? `<div class="inventory-request-review-note is-converted"><i class="fa-solid fa-circle-check"></i> Converted by ${invFinderEscape(req.convertedBy || '')}. Official transfer count: ${invFinderEscape(req.officialTransferCount || 0)}</div>`
            : '';
        return `<article class="inventory-request-review-card status-${invFinderEscape(statusBucket)}" data-request-key="${invFinderEscape(requestKey)}">
            <div class="inventory-request-review-card-head">
                <div><span class="inventory-request-code">${invFinderEscape(displayCode)}</span><h3>${invFinderEscape(req.requestType || 'Transfer')} Request</h3></div>
                <span class="inventory-request-status">${invFinderEscape(req.status || '')}</span>
            </div>
            <div class="inventory-request-review-meta">
                <span><b>By:</b> ${invFinderEscape(req.requestedBy || '')}</span>
                <span><b>Position:</b> ${invFinderEscape(req.requestedByPosition || '')}</span>
                <span><b>Route:</b> ${invFinderEscape(req.fromSite || '')} → ${invFinderEscape(req.toSite || '')}</span>
                <span><b>Items:</b> ${items.length}</span>
            </div>
            <div class="inventory-request-review-items">${itemsHtml}</div>
            ${rejectionHtml}${convertedHtml}
            ${isPending ? `<div class="inventory-request-review-note"><i class="fa-solid fa-shield-halved"></i> Stock will be re-checked before conversion. If another request already consumed the stock, this request must be adjusted or rejected.</div>` : ''}
            <div class="inventory-request-review-actions">
                ${isPending && canReviewInventoryTransferRequests() ? `<button type="button" class="primary-btn" data-inv-request-convert="${invFinderEscape(requestKey || displayCode)}" data-inv-request-code="${invFinderEscape(displayCode)}"><i class="fa-solid fa-right-left"></i> Convert / Designate</button>` : ''}
                ${isPending && canRejectInventoryTransferRequests() ? `<button type="button" class="secondary-btn inv-request-reject-btn" data-inv-request-reject="${invFinderEscape(requestKey || displayCode)}" data-inv-request-code="${invFinderEscape(displayCode)}"><i class="fa-solid fa-ban"></i> Reject Request</button>` : ''}
                ${statusBucket !== 'converted' && canDeleteInventoryTransferRequests() ? `<button type="button" class="danger-btn inv-request-delete-btn" data-inv-request-delete="${invFinderEscape(requestKey || displayCode)}" data-inv-request-code="${invFinderEscape(displayCode)}"><i class="fa-solid fa-trash-can"></i> Delete Request</button>` : ''}
            </div>
        </article>`;
    }



    function buildInventoryRequestLineFromTransferTask(task) {
        return {
            productId: task?.productId || task?.productID || task?.productIDNo || task?.productIDNo || '',
            productName: task?.productName || '',
            details: task?.details || '',
            fromSite: task?.fromSite || task?.fromLocation || '',
            fromSiteLabel: task?.fromSite || task?.fromLocation || '',
            qty: invFinderNumber(task?.orderedQty ?? task?.requiredQty ?? task?.approvedQty ?? task?.receivedQty ?? 0),
            materialKey: task?.materialKey || '',
            materialGroupKey: task?.materialGroupKey || ''
        };
    }

    function isConvertedMobileRequestTransferTask(task) {
        if (!task) return false;
        const status = invRequestSafeText(task.remarks || task.status || '');
        const type = invRequestSafeText(task.for || task.jobType || '');
        if (type !== 'Transfer' || status !== 'Pending Source') return false;
        return !!(task.convertedFromRequest || task.inventoryRequestCode || task.requestCode || String(task.source || '').includes('mobile-request'));
    }

    async function guardConvertedRequestSourceConfirmation(task) {
        if (!isConvertedMobileRequestTransferTask(task)) return true;
        const materialRows = await loadInventoryRequestMaterialRows();
        const line = buildInventoryRequestLineFromTransferTask(task);
        const check = validateInventoryRequestStockBeforeConvert({ items: [line] }, materialRows);
        if (check.ok) return true;
        alert(`Stock changed before source confirmation.\n\n${check.message || 'Requested qty is no longer available.'}\n\nPlease adjust/reject the related request or recreate the transfer with the current available stock.`);
        return false;
    }

    function bindInventoryRequestSourceConfirmationStockGuard() {
        if (window.__ibaInvSourceConfirmationStockGuardBound === true) return;
        window.__ibaInvSourceConfirmationStockGuardBound = true;
        let attempts = 0;
        const tryWrap = () => {
            attempts += 1;
            if (typeof window.openTransferActionModal !== 'function') {
                if (attempts < 30) setTimeout(tryWrap, 500);
                return;
            }
            if (window.openTransferActionModal.__ibaSourceStockGuardWrapped) return;
            const originalOpenTransferActionModal = window.openTransferActionModal;
            window.openTransferActionModal = async function(task, ...args) {
                try {
                    const ok = await guardConvertedRequestSourceConfirmation(task);
                    if (!ok) return;
                } catch (err) {
                    console.error('Source confirmation stock guard failed:', err);
                    alert(`Unable to verify current stock before source confirmation. Please refresh and try again.\n\n${err.message || err}`);
                    return;
                }
                return originalOpenTransferActionModal.apply(this, [task, ...args]);
            };
            window.openTransferActionModal.__ibaSourceStockGuardWrapped = true;
        };
        tryWrap();
    }

    bindInventoryRequestSourceConfirmationStockGuard();

    // Make helpers available for mobile router/switcher without making app.js larger.
    function isInventoryMobileMaterialFinderOpen() {
        const section = document.getElementById('wd-inv-mobile-material-finder');
        const activeByState = String(window.__ibaInventoryMobileSection || '').toLowerCase() === 'item-search';
        const activeByDom = !!(section && !section.classList.contains('hidden'));
        return !!(activeByState || activeByDom);
    }

    function clearInventoryMobileMaterialFinderState() {
        closeInventoryMobileMaterialFinder();
    }

    // 7.6.7: Keep the Item Search public API grouped under one Inventory-owned namespace.
    // The older window-level names stay as aliases so app-mobile.js and app.js do not break.
    window.InventoryMobileMaterialFinder = Object.assign(window.InventoryMobileMaterialFinder || {}, {
        version: '7.9.0',
        isOpen: isInventoryMobileMaterialFinderOpen,
        clearState: clearInventoryMobileMaterialFinderState,
        ensureNav: ensureInventoryMobileMaterialFinderNav,
        updateNavVisibility: updateInventoryMobileMaterialFinderNavVisibility,
        open: openInventoryMobileMaterialFinder,
        startScanner: startInventoryMobileBarcodeScanner,
        stopScanner: stopInventoryMobileBarcodeScanner,
        canSubmitTransferRequest: canSubmitInventoryTransferRequest,
        canReviewRequests: canReviewInventoryTransferRequests,
        canDeleteRequests: canDeleteInventoryTransferRequests,
        canRejectRequests: canRejectInventoryTransferRequests,
        rejectRequest: rejectInventoryRequest,
        canAccessRequestReview: canAccessInventoryRequestReview,
        ensureRequestReviewNav: ensureInventoryRequestReviewNav,
        openRequestReview: openInventoryRequestReview,
        refreshRequestReviewBadge: refreshInventoryRequestReviewBadge,
        convertRequestToOfficialTransfer: convertInventoryRequestToOfficialTransfer,
        deleteRequest: deleteInventoryRequest
    });

    window.isInventoryMobileMaterialFinderOpen = isInventoryMobileMaterialFinderOpen;
    window.clearInventoryMobileMaterialFinderState = clearInventoryMobileMaterialFinderState;
    window.ensureInventoryMobileMaterialFinderNav = ensureInventoryMobileMaterialFinderNav;
    window.updateInventoryMobileMaterialFinderNavVisibility = updateInventoryMobileMaterialFinderNavVisibility;
    window.openInventoryMobileMaterialFinder = openInventoryMobileMaterialFinder;
    window.startInventoryMobileBarcodeScanner = startInventoryMobileBarcodeScanner;
    window.stopInventoryMobileBarcodeScanner = stopInventoryMobileBarcodeScanner;
    window.ensureInventoryRequestReviewNav = ensureInventoryRequestReviewNav;
    window.openInventoryRequestReview = openInventoryRequestReview;
    window.refreshInventoryRequestReviewBadge = refreshInventoryRequestReviewBadge;
    window.convertInventoryRequestToOfficialTransfer = convertInventoryRequestToOfficialTransfer;
    window.deleteInventoryRequest = deleteInventoryRequest;

    document.addEventListener('DOMContentLoaded', () => {
        ensureInventoryMobileMaterialFinderNav();
        bindInventoryMobileMaterialFinderAutoClose();
        ensureInventoryRequestReviewNav();
        getMaterialFinderSection();
        getInventoryRequestReviewSection();
        bindInventoryMobileMaterialFinderControls();
        window.addEventListener('resize', updateInventoryMobileMaterialFinderNavVisibility);
        let reqReviewRefreshCount = 0;
        const reqReviewTimer = window.setInterval(() => {
            reqReviewRefreshCount += 1;
            try { ensureInventoryRequestReviewNav(); updateInventoryRequestReviewNavVisibility(); } catch (_) {}
            if (reqReviewRefreshCount >= 20) window.clearInterval(reqReviewTimer);
        }, 1000);
        window.addEventListener('beforeunload', () => stopInventoryMobileBarcodeScanner(false));
    });
})();

// ==========================================================================
// Inventory In-Transit printable PDF helpers
// Moved from app.js in v7.9.4 to keep Inventory-only reporting code together.
// ==========================================================================

function updateInTransitReportButtonVisibility() {
    try {
        if (!wdInTransitReportBtn) return;
        const invCtx = (typeof isInventoryContext === 'function' && isInventoryContext());
        const show = invCtx && !isMobileViewport();
        wdInTransitReportBtn.style.display = show ? 'inline-flex' : 'none';

        if (wdInTransitContactFilterSelect) {
            wdInTransitContactFilterSelect.style.display = show ? 'inline-flex' : 'none';
            if (show) {
                populateInTransitContactFilterOptions();
            }
        }
    } catch (e) {
        // fail silently
    }
}

function _normalizeContactLabel(val) {
    return String(val || '').replace(/\s+/g, ' ').trim();
}

function getInTransitTransferEntries() {
    return (allSystemEntries || [])
        .filter(e => (e && e.source === 'transfer_entry'))
        .filter(e => {
            const status = String(e.remarks || e.status || '').trim().toLowerCase();
            return status === 'in transit';
        })
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

async function populateInTransitContactFilterOptions() {
    try {
        if (!wdInTransitContactFilterSelect) return;
        await ensureAllEntriesFetched(false);

        const inTransit = getInTransitTransferEntries();
        const map = new Map();

        for (const e of inTransit) {
            const label = _normalizeContactLabel(e.contactName || e.receiver || e.attention || e.contact || '');
            if (!label) continue;
            const key = label.toLowerCase();
            if (!map.has(key)) map.set(key, label);
        }

        const stored = (localStorage && localStorage.getItem('wd_intransit_contact')) || '';
        const current = _normalizeContactLabel(wdInTransitContactFilterSelect.value) || stored;
        const contacts = Array.from(map.values()).sort((a, b) => a.localeCompare(b));

        wdInTransitContactFilterSelect.innerHTML = [
            `<option value="">All Contacts</option>`,
            ...contacts.map(c => `<option value="${_inventoryEscapeHtml(c)}">${_inventoryEscapeHtml(c)}</option>`)
        ].join('');

        if (current && Array.from(wdInTransitContactFilterSelect.options).some(o => o.value === current)) {
            wdInTransitContactFilterSelect.value = current;
        }
    } catch (e) {
        // Silent failure to avoid breaking WorkDesk/Inventory page rendering.
    }
}

function _inventoryEscapeHtml(val) {
    const s = (val === null || val === undefined) ? '' : String(val);
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function inventoryPrintHtmlInHiddenFrame(html, frameId = 'inventory-print-frame') {
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
            console.warn('Inventory print failed:', e);
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

async function printInventoryInTransitReport() {
    try {
        await ensureAllEntriesFetched(false);

        if (typeof populateInTransitContactFilterOptions === 'function') {
            populateInTransitContactFilterOptions();
        }

        const inTransitAll = getInTransitTransferEntries();
        const selectedContact = wdInTransitContactFilterSelect ? _normalizeContactLabel(wdInTransitContactFilterSelect.value) : '';
        const selectedKey = selectedContact ? selectedContact.toLowerCase() : '';
        const inTransit = selectedKey
            ? inTransitAll.filter(e => _normalizeContactLabel(e.contactName || e.receiver || e.attention || e.contact || '').toLowerCase() === selectedKey)
            : inTransitAll;

        if (!inTransitAll.length) {
            alert('No "In Transit" inventory records found.');
            return;
        }

        if (!inTransit.length) {
            alert(selectedContact
                ? `No "In Transit" inventory records found for contact: ${selectedContact}`
                : 'No "In Transit" inventory records found.');
            return;
        }

        const now = new Date();
        const printDate = now.toLocaleString('en-GB', { hour12: false });
        const logoUrl = "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/logo%20(1).png";

        const rowsHtml = inTransit.map((e, idx) => {
            const controlId = e.controlId || e.ref || e.controlNumber || '';
            const product = e.productName || e.vendorName || '';
            const route = e.site || '';
            const ordered = (e.orderedQty ?? e.requiredQty ?? 0);
            const delivered = (e.deliveredQty ?? e.receivedQty ?? 0);
            const ship = e.shippingDate || '';
            const arr = e.arrivalDate || '';
            const contact = e.contactName || e.receiver || '';
            const jobType = e.for || e.jobType || 'Transfer';
            const status = e.remarks || e.status || 'In Transit';

            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${_inventoryEscapeHtml(controlId)}</td>
                    <td>${_inventoryEscapeHtml(jobType)}</td>
                    <td>${_inventoryEscapeHtml(product)}</td>
                    <td>${_inventoryEscapeHtml(route)}</td>
                    <td style="text-align:right;">${_inventoryEscapeHtml(ordered)}</td>
                    <td style="text-align:right;">${_inventoryEscapeHtml(delivered)}</td>
                    <td>${_inventoryEscapeHtml(ship)}</td>
                    <td>${_inventoryEscapeHtml(arr)}</td>
                    <td>${_inventoryEscapeHtml(contact)}</td>
                    <td><strong>${_inventoryEscapeHtml(status)}</strong></td>
                </tr>
            `;
        }).join('');

        const html = `
<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Inventory In Transit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #111; }
        .header { display:flex; align-items:center; gap:15px; border-bottom: 2px solid #003A5C; padding-bottom: 10px; margin-bottom: 15px; }
        .header img { height: 55px; width: auto; }
        .meta { margin: 10px 0 15px; color:#444; font-size: 12px; display:flex; justify-content: space-between; gap:20px; flex-wrap:wrap;}
        h2 { margin: 8px 0 0; font-size: 18px; color:#003A5C; }
        table { width:100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
        th { background: #f2f5f7; color:#003A5C; text-align: left; }
        .summary { margin-top: 10px; font-size: 12px; color:#003A5C; font-weight: 700; }
        @media print {
            body { margin: 10mm; }
            .no-print { display:none !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="${logoUrl}" alt="IBA" crossorigin="anonymous"
             onerror="this.style.display='none'; document.getElementById('fallbackLogo').style.display='block';" />
        <div id="fallbackLogo" style="display:none; background:#003A5C; color:white; font-weight:900; font-size:26px; padding:6px 12px; letter-spacing:1px;">IBA</div>
        <div>
            <h2>Inventory – In Transit Report</h2>
        </div>
    </div>

    <div class="meta">
        <div><strong>Generated:</strong> ${_inventoryEscapeHtml(printDate)}</div>
        <div><strong>Contact:</strong> ${selectedContact ? _inventoryEscapeHtml(selectedContact) : 'All'}</div>
        <div><strong>Total In Transit:</strong> ${inTransit.length}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:35px;">#</th>
                <th style="width:110px;">Control ID</th>
                <th style="width:80px;">Job</th>
                <th>Product Name</th>
                <th>Site Route</th>
                <th style="width:80px;">Ordered</th>
                <th style="width:80px;">Delivered</th>
                <th style="width:95px;">Shipping</th>
                <th style="width:95px;">Arrival</th>
                <th style="width:120px;">Contact</th>
                <th style="width:90px;">Status</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div class="summary">Tip: Use your browser Print → “Save as PDF” to share with site teams.</div>
</body>
</html>`;

        inventoryPrintHtmlInHiddenFrame(html, 'inventory-in-transit-print-frame');

    } catch (error) {
        console.error("printInventoryInTransitReport error:", error);
        alert('Failed to generate the In Transit report.');
    }
}

