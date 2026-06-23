// =================================================================================================
// IBA — Inventory JS Foundation
// Version: 7.5.6
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

    renderInventoryJobRecordsTable(filteredEntries);
}

function renderInventoryJobRecordsTable(entries) {
    if (!reportingTableBody) return;
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
        reportingTableBody.innerHTML = '<tr><td colspan="9">No entries found.</td></tr>';
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
    const inventoryTasks = (Array.isArray(tasks) ? tasks : []).filter(t => isInventoryTaskRecord(t));
    const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : (window.innerWidth <= 768);
    if (isMobile) {
        if (typeof renderInventoryMobileActiveTasks === 'function') renderInventoryMobileActiveTasks(inventoryTasks);
        else if (typeof renderMobileActiveTasks === 'function') renderMobileActiveTasks(inventoryTasks);
        return;
    }

    activeTaskTableBody.innerHTML = '';

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
        activeTaskTableBody.innerHTML = '<tr><td colspan="8">No inventory tasks found for "' + currentActiveTaskFilter + '".</td></tr>';
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
        headerRow.className = 'controlid-group-header';
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


