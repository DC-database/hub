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



// =================================================================================================
// 7.6.5 — Inventory Mobile Material Finder (preview/search only)
// Purpose: Mobile-only item lookup with suggestion picker, photo, stock balance, and recent movement history.
// No CRUD, no stock writes, no approval changes.
// =================================================================================================
(function inventoryMobileMaterialFinderModule(){
    const PHOTO_BASE_URL = 'https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/Photo/';
    let materialCache = null;
    let movementCache = null;
    let isLoadingMaterials = false;
    let barcodeScannerStream = null;
    let barcodeScannerTimer = null;
    let barcodeScannerActive = false;

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

    function invFinderMatchText(item) {
        return [invFinderProductId(item), invFinderProductName(item), invFinderDetails(item), invFinderBarcodeText(item), item?.family, item?.relationship]
            .map(v => String(v || '').toLowerCase()).join(' ');
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
                    <input id="inv-mobile-material-search-input" type="search" placeholder="Search item material or scan barcode..." autocomplete="off">
                </div>
                <div class="inv-mobile-finder-actions">
                    <button id="inv-mobile-material-scan" type="button" class="inv-mobile-scan-btn"><i class="fa-solid fa-barcode"></i> Scan</button>
                    <button id="inv-mobile-material-search-clear" type="button" class="secondary-btn">Clear</button>
                </div>
            </div>
            <div id="inv-mobile-barcode-scanner" class="inv-mobile-barcode-scanner hidden" aria-live="polite">
                <div class="inv-mobile-barcode-box">
                    <div class="inv-mobile-barcode-head">
                        <strong><i class="fa-solid fa-barcode"></i> Scan item barcode</strong>
                        <button type="button" id="inv-mobile-barcode-close" aria-label="Close barcode scanner"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="inv-mobile-barcode-video-wrap">
                        <video id="inv-mobile-barcode-video" autoplay muted playsinline></video>
                        <div class="inv-mobile-barcode-guide"></div>
                    </div>
                    <div id="inv-mobile-barcode-status" class="inv-mobile-barcode-status">Point camera at the barcode.</div>
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
        if (!li) return;
        if (isInventoryFinderMobileActive()) li.style.removeProperty('display');
        else li.style.setProperty('display', 'none', 'important');
    }

    function openInventoryMobileMaterialFinder() {
        const section = getMaterialFinderSection();
        if (!section) return;
        try {
            window.__ibaActiveModule = 'inventory';
            window.__ibaInventoryMobileSection = 'item-search';
        } catch (_) {}
        if (document.body) document.body.classList.add('inventory-mode');

        document.querySelectorAll('#workdesk-view .workdesk-section, .workdesk-section').forEach(el => el.classList.add('hidden'));
        section.classList.remove('hidden');

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
                renderInventoryMobileMaterialFinderSelected(item);
            });
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
            const msg = 'Barcode scanning is not supported in this browser. Try Chrome on Android, or type the item code manually.';
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
            if (scannerStatus) scannerStatus.textContent = 'Point camera at the barcode.';

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

        if (input) input.value = rawValue;
        if (scannerStatus) scannerStatus.textContent = `Scanned: ${rawValue}`;

        const exact = findInventoryMobileMaterialByBarcode(rawValue);
        if (exact) {
            if (input) input.value = invFinderProductName(exact) || invFinderProductId(exact) || rawValue;
            if (status) status.textContent = `Barcode matched: ${invFinderProductName(exact) || invFinderProductId(exact)}`;
            renderInventoryMobileMaterialFinderSelected(exact);
            return;
        }

        if (status) status.textContent = `Barcode scanned: ${rawValue}. No exact Product ID match. Showing suggestions.`;
        renderInventoryMobileMaterialFinderSuggestions(rawValue);
    }

    async function loadInventoryMobileMaterialFinderData() {
        if (isLoadingMaterials) return;
        isLoadingMaterials = true;
        const status = document.getElementById('inv-mobile-material-status');
        if (status) status.textContent = 'Loading material records...';
        try {
            const dbRef = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
            if (!dbRef) throw new Error('Firebase database is not loaded.');

            const [matSnap, moveSnap] = await Promise.all([
                dbRef.ref('material_stock').once('value'),
                dbRef.ref('transfer_entries').limitToLast(400).once('value')
            ]);

            const matObj = matSnap.val() || {};
            materialCache = Object.entries(matObj).map(([key, val]) => ({ key, ...(val || {}) }));

            const moveObj = moveSnap.val() || {};
            movementCache = Object.entries(moveObj).map(([key, val]) => ({ key, ...(val || {}) }));

            if (status) status.textContent = materialCache.length ? 'Search ready.' : 'No material records found.';
        } catch (err) {
            console.error('Inventory mobile material finder load failed:', err);
            materialCache = [];
            movementCache = [];
            if (status) status.textContent = 'Unable to load material records.';
        } finally {
            isLoadingMaterials = false;
        }
    }

    function getInventoryMaterialMovements(item) {
        const pid = invFinderProductId(item).toLowerCase();
        const name = invFinderProductName(item).toLowerCase();
        const detail = invFinderDetails(item).toLowerCase();
        const moves = Array.isArray(movementCache) ? movementCache : [];
        return moves.filter(m => {
            const mid = String(m.productId || m.productID || m.productCode || '').toLowerCase();
            const mname = String(m.productName || m.vendorName || m.itemName || '').toLowerCase();
            const mdetail = String(m.details || m.detail || '').toLowerCase();
            return (pid && mid === pid) ||
                   (pid && String(m.controlId || '').toLowerCase().includes(pid)) ||
                   (name && mname && mname.includes(name)) ||
                   (detail && mdetail && mdetail.includes(detail));
        }).slice(-5).reverse();
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
            results.innerHTML = '<div class="inv-mobile-material-empty"><i class="fa-solid fa-boxes-stacked"></i><strong>Search item material</strong><span>Type item name / ID or scan barcode, then pick one suggestion to preview.</span></div>';
        }
        if (status) status.textContent = Array.isArray(materialCache)
            ? `${materialCache.length} material records available.`
            : 'Type an item name or scan barcode, then pick one suggestion.';
    }

    function findInventoryMobileMaterialByKey(key) {
        if (!Array.isArray(materialCache)) return null;
        return materialCache.find(item => String(item.key || '') === String(key || '')) || null;
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
        const balVal = invFinderNumber(item.balanceQty ?? item.availableQty ?? item.available ?? item.stockQty ?? 0);
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
        const movedQty = invFinderQty(item.transferredQty ?? item.issuedQty ?? item.usedQty ?? 0);
        const balVal = invFinderNumber(item.balanceQty ?? item.availableQty ?? item.available ?? item.stockQty ?? 0);
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
            : `<div class="inv-mobile-material-history-empty">No recent movement found.</div>`;

        return `<article class="inv-mobile-material-card">
            <div class="inv-mobile-material-card-top">
                <div class="inv-mobile-material-photo">${photoHtml}</div>
                <div class="inv-mobile-material-info">
                    <span class="inv-mobile-material-id">${invFinderEscape(pid)}</span>
                    <h3>${invFinderEscape(name)}</h3>
                    <p>${invFinderEscape(details)}</p>
                </div>
            </div>
            <div class="inv-mobile-material-stats">
                <div><span>Stock</span><strong>${invFinderEscape(stockQty)}</strong></div>
                <div><span>Moved/Used</span><strong>${invFinderEscape(movedQty)}</strong></div>
                <div class="${balanceClass}"><span>Available</span><strong>${invFinderEscape(balance)}</strong></div>
            </div>
            <div class="inv-mobile-material-history">
                <div class="inv-mobile-material-history-title"><i class="fa-solid fa-clock-rotate-left"></i> Recent History</div>
                ${historyHtml}
            </div>
        </article>`;
    }

    // Make helpers available for mobile router/switcher without making app.js larger.
    function isInventoryMobileMaterialFinderOpen() {
        const section = document.getElementById('wd-inv-mobile-material-finder');
        const activeByState = String(window.__ibaInventoryMobileSection || '').toLowerCase() === 'item-search';
        const activeByDom = !!(section && !section.classList.contains('hidden'));
        return !!(activeByState || activeByDom);
    }

    function clearInventoryMobileMaterialFinderState() {
        try { if (String(window.__ibaInventoryMobileSection || '').toLowerCase() === 'item-search') window.__ibaInventoryMobileSection = ''; } catch (_) {}
        stopInventoryMobileBarcodeScanner(false);
    }

    window.isInventoryMobileMaterialFinderOpen = isInventoryMobileMaterialFinderOpen;
    window.clearInventoryMobileMaterialFinderState = clearInventoryMobileMaterialFinderState;
    window.ensureInventoryMobileMaterialFinderNav = ensureInventoryMobileMaterialFinderNav;
    window.updateInventoryMobileMaterialFinderNavVisibility = updateInventoryMobileMaterialFinderNavVisibility;
    window.openInventoryMobileMaterialFinder = openInventoryMobileMaterialFinder;
    window.startInventoryMobileBarcodeScanner = startInventoryMobileBarcodeScanner;
    window.stopInventoryMobileBarcodeScanner = stopInventoryMobileBarcodeScanner;

    document.addEventListener('DOMContentLoaded', () => {
        ensureInventoryMobileMaterialFinderNav();
        getMaterialFinderSection();
        bindInventoryMobileMaterialFinderControls();
        window.addEventListener('resize', updateInventoryMobileMaterialFinderNavVisibility);
        window.addEventListener('beforeunload', () => stopInventoryMobileBarcodeScanner(false));
    });
})();
