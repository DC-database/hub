/* ==========================================================================
   js/app-active-tasks.js
   IBA WorkDesk active-task renderer, filters, mobile cards, and task loader.
   Version: 8.7.0

   Cleanup Phase:
   - Moved Block 14 active-task display/loading helpers out of app.js.
   - Public function names and existing behavior are preserved.
   - No SRV Done write logic, approval write logic, invoice save logic, batch save logic,
     Firebase write paths, or inventory stock logic changed.

   8.4.11:
   - Added a short session snapshot for WorkDesk Active Task data so the dashboard can
     reuse it without re-fetching from Firebase.
   - populateActiveTasks now supports optional forceRefresh for manual dashboard refresh.
   - Approver lookup no longer force-refreshes every active-task load unless requested.
   ========================================================================== */

// =================================================================================================
// #region BLOCK 14 — ACTIVE TASKS DISPLAY + LOADING
// Purpose: WorkDesk/Inventory active-task routing, desktop table, mobile cards, filters, and task loading.
// =================================================================================================

function isTaskComplete(task) {
    if (!task) return false;

    // 1. Special check for Job Entries (Invoice Type)
    if (task.source === 'job_entry' && task.for === 'Invoice') {
        const invoiceJobStatus = String(task.remarks || task.status || '').trim();

        // 8.7.0: IPC/Job Record items converted to Invoice must remain visible as
        // fresh invoice tasks even if the old IPC record carried dateResponded.
        if (invoiceJobStatus === 'New Entry' || invoiceJobStatus === 'Pending' || !invoiceJobStatus) {
            return false;
        }

        if (invoiceJobStatus === 'Approved' || invoiceJobStatus === 'Rejected') {
            return false;
        }
        return !!task.dateResponded;
    }

    // 2. Standard Statuses for Completion
    const completedStatuses = [
        'With Accounts',
        'SRV Done',
        'Paid',
        'CLOSED',
        'Cancelled'
    ];

    if (task.source === 'invoice') {
        if (completedStatuses.includes(task.remarks)) return true;
        if (task.enteredBy === currentApprover?.Name) {
            const trackingStatuses = ['For SRV', 'For IPC', 'Approved', 'Rejected'];
            if (trackingStatuses.includes(task.remarks)) return false; 
            return true;
        }
        return false;
    }

    if (task.source === 'job_entry') {
        // [CHANGE] REMOVED THE LINE: if (task.attention === 'All') return true; 
        // "All" tasks should now stay active until status is resolved.

        if (completedStatuses.includes(task.remarks)) return true;
        if (task.for === 'PR' && task.remarks === 'PO Ready') return true;
        if (task.remarks === 'Approved' || task.remarks === 'Rejected') return false; 
        if (task.for !== 'PR' && task.dateResponded) return true;
    }

    return false;
}

function renderActiveTaskTable(tasks) {
    // 7.3.5 — Active Task Renderer Separation
    // This router keeps the old public function name used by listeners/search,
    // but sends Inventory and WorkDesk tasks to different renderers.
    const list = Array.isArray(tasks) ? tasks : [];
    const inventoryMode = (typeof isInventoryContext === 'function' && isInventoryContext()) ||
        (list.length > 0 && list.every(t => isInventoryTaskRecord(t)));

    if (inventoryMode) {
        return renderInventoryActiveTaskTable(list);
    }
    return renderWorkdeskActiveTaskTable(list);
}


function wdUiEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function wdUiStatusTone(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('hold')) return 'hold';
    if (s.includes('new') || s.includes('pending')) return 'pending';
    if (s.includes('srv') || s.includes('signature')) return 'srv';
    if (s.includes('approval') || s === 'approved' || s.includes('manager approved')) return 'approval';
    if (s.includes('ipc')) return 'ipc';
    if (s.includes('report')) return 'report';
    if (s.includes('reject') || s.includes('cancel')) return 'danger';
    return 'default';
}

function wdUiStatusBadge(status, extraClass = '') {
    const label = wdUiEscape(status || 'Pending');
    const tone = wdUiStatusTone(status);
    return `<span class="wd-status-badge tone-${tone} ${extraClass}">${label}</span>`;
}

function wdUiUpdateMiniMetrics(containerId, entries, modeLabel) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
        box.innerHTML = '';
        return;
    }
    const total = list.length;
    const statusCounts = {};
    list.forEach(item => {
        const st = String(item.remarks || item.status || 'Pending').trim() || 'Pending';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
    });
    const topStatuses = Object.entries(statusCounts)
        .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 4);
    const siteCount = new Set(list.map(i => String(i.site || '').trim()).filter(Boolean)).size;
    const urgent = list.filter(i => i.isUrgent === true).length;
    const cards = [
        {label: modeLabel || 'Records', value: total, icon: 'fa-layer-group', tone: 'default'},
        {label: 'Action Now', value: urgent, icon: 'fa-bell', tone: urgent ? 'pending' : 'default'},
        {label: 'Sites', value: siteCount, icon: 'fa-location-dot', tone: 'approval'}
    ].concat(topStatuses.map(([label, value]) => ({label, value, icon: 'fa-circle-dot', tone: wdUiStatusTone(label)})));
    box.innerHTML = cards.map(c => `
        <div class="wd-mini-metric tone-${wdUiEscape(c.tone)}">
            <span class="wd-mini-icon"><i class="fa-solid ${wdUiEscape(c.icon)}"></i></span>
            <strong>${wdUiEscape(c.value)}</strong>
            <small>${wdUiEscape(c.label)}</small>
        </div>`).join('');
}


function wdUiSetActiveTaskHeroContext(mode) {
    const isInventory = String(mode || '').toLowerCase() === 'inventory';
    const hero = document.querySelector('#wd-activetask .wd-page-hero');
    if (hero) {
        hero.classList.toggle('wd-page-hero-inventory', isInventory);
        hero.classList.toggle('wd-page-hero-active', !isInventory);
    }

    const eyebrow = document.querySelector('#wd-activetask .wd-page-eyebrow');
    if (eyebrow) {
        eyebrow.innerHTML = isInventory
            ? '<i class="fa-solid fa-boxes-stacked"></i> Inventory Action Center'
            : '<i class="fa-solid fa-bolt"></i> WorkDesk Action Center';
    }

    const title = document.querySelector('#wd-activetask .wd-page-hero h1');
    if (title) title.textContent = isInventory ? 'Inventory Active Tasks' : 'Your Active Tasks';

    const subtitle = document.querySelector('#wd-activetask .wd-page-hero p');
    if (subtitle) {
        subtitle.textContent = isInventory
            ? 'Inventory-only action queue for transfer, restock, return, usage, receiving, and movement approvals.'
            : 'Personal invoice and WorkDesk action queue with the documents, notes, status, and process buttons in one clean working view.';
    }

    const metricLabel = document.querySelector('#wd-activetask .wd-page-hero-metric small');
    if (metricLabel) metricLabel.textContent = isInventory ? 'Inventory workload' : 'Live workload';

    const mobileTitle = document.querySelector('#active-task-mobile-header h1');
    if (mobileTitle) mobileTitle.textContent = isInventory ? 'Inventory Tasks' : 'My Tasks';
}

function renderWorkdeskActiveTaskTable(tasks) {
    wdUiSetActiveTaskHeroContext('workdesk');
    const workdeskTasks = (Array.isArray(tasks) ? tasks : []).filter(t => isWorkdeskTaskRecord(t));
    const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : (window.innerWidth <= 768);
    if (isMobile) {
        if (typeof renderWorkdeskMobileActiveTasks === 'function') renderWorkdeskMobileActiveTasks(workdeskTasks);
        else if (typeof renderMobileActiveTasks === 'function') renderMobileActiveTasks(workdeskTasks);
        return;
    }

    activeTaskTableBody.innerHTML = '';

    const activeTaskTable = document.querySelector('#wd-activetask table');
    if (activeTaskTable) activeTaskTable.classList.add('wd-modern-table', 'wd-active-modern-table');
    wdUiUpdateMiniMetrics('active-task-summary-strip', workdeskTasks, 'Active Tasks');

    const filteredTasks = workdeskTasks.filter(function(task) {
        if (currentActiveTaskFilter === 'All') return true;
        return task.remarks === currentActiveTaskFilter;
    });

    const tableHead = document.querySelector('#wd-activetask table thead');
    if (tableHead) {
        tableHead.innerHTML =
            '<tr>' +
                '<th class="desktop-only">Job</th>' +
                '<th class="desktop-only">Ref</th>' +
                '<th class="desktop-only">PO</th>' +
                '<th class="desktop-only">Vendor Name</th>' +
                '<th class="desktop-only">Invoice Amount</th>' +
                '<th class="desktop-only">Site</th>' +
                '<th class="desktop-only">Date</th>' +
                '<th class="desktop-only">Note</th>' +
                '<th class="desktop-only">Status</th>' +
                '<th class="desktop-only">Action</th>' +
            '</tr>';
    }

    if (filteredTasks.length === 0) {
        activeTaskTableBody.innerHTML = '<tr><td colspan="10"><div class="wd-modern-empty-row"><i class="fa-solid fa-circle-check"></i><strong>No WorkDesk tasks found</strong><span>No item under "' + wdUiEscape(currentActiveTaskFilter) + '" right now.</span></div></td></tr>';
        return;
    }

    const isCEO = document.body.classList.contains('is-ceo');
    const userPos = (currentApprover.Position || '').toLowerCase();
    const userRole = (currentApprover.Role || '').toLowerCase();
    const isManager = userPos.indexOf('manager') !== -1 ||
                    userPos.indexOf('director') !== -1 ||
                    userPos.indexOf('ceo') !== -1 ||
                    userRole === 'admin';

    filteredTasks.forEach(function(task) {
        const row = document.createElement('tr');
        row.setAttribute('data-key', task.key);
        row.className = 'wd-modern-row tone-' + wdUiStatusTone(task.remarks || 'Pending') + (task.isUrgent === true ? ' wd-row-urgent' : ' wd-row-calm');

        if (task.isUrgent === false) {
            row.classList.add('wd-row-muted');
        }

        const isInvoiceFromIrwin = task.source === 'invoice' && task.enteredBy === 'Irwin';
        const invName = task.invName || '';
        const isClickable = (isInvoiceFromIrwin || (task.source === 'invoice' && invName)) &&
                          invName.trim() && invName.toLowerCase() !== 'nil';

        if (isClickable) row.classList.add('clickable-pdf');
        if (isCEO) row.title = "Click to open approval modal";
        else if (isClickable) row.title = "Click to open PDF";

        const displayAmount = task.amountPaid || task.amount || 0;

        const taskStatus = task.remarks || 'Pending';
        const taskNote = task.note || 'No note';
        row.innerHTML =
            '<td class="desktop-only"><span class="wd-table-kicker">' + wdUiEscape(task.for || '') + '</span></td>' +
            '<td class="desktop-only"><span class="wd-ref-chip">' + wdUiEscape(task.ref || '') + '</span></td>' +
            '<td class="desktop-only"><span class="wd-po-code">' + wdUiEscape(task.po || '') + '</span></td>' +
            '<td class="desktop-only"><strong class="wd-vendor-name">' + wdUiEscape(task.vendorName || 'N/A') + '</strong></td>' +
            '<td class="desktop-only wd-amount-cell">' + wdUiEscape(formatCurrency(displayAmount)) + '</td>' +
            '<td class="desktop-only"><span class="wd-site-badge"><i class="fa-solid fa-location-dot"></i>' + wdUiEscape(task.site || '') + '</span></td>' +
            '<td class="desktop-only"><span class="wd-date-chip">' + wdUiEscape(task.date || '') + '</span></td>' +
            '<td class="desktop-only"><div class="wd-note-cell">' + wdUiEscape(taskNote) + '</div></td>' +
            '<td class="desktop-only">' + wdUiStatusBadge(taskStatus) + '</td>';

        const actionsCell = document.createElement('td');
        actionsCell.className = "desktop-only";

        if (task.remarks === 'For Approval' && isManager) {
            const approveBtn = document.createElement('button');
            approveBtn.className = 'action-btn approve-btn wd-row-action wd-action-approve';
            approveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            approveBtn.title = 'Approve';
            approveBtn.style.backgroundColor = '#28a745';
            approveBtn.style.color = 'white';
            approveBtn.style.marginRight = '5px';
            approveBtn.onclick = function(e) { e.stopPropagation(); handleDesktopApproval(task, 'Approved'); };

            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'action-btn reject-btn wd-row-action wd-action-reject';
            rejectBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            rejectBtn.title = 'Reject';
            rejectBtn.style.backgroundColor = '#dc3545';
            rejectBtn.style.color = 'white';
            rejectBtn.onclick = function(e) { e.stopPropagation(); handleDesktopApproval(task, 'Rejected'); };

            actionsCell.appendChild(approveBtn);
            actionsCell.appendChild(rejectBtn);
        } else if (isCEO) {
            actionsCell.innerHTML = '<button class="ceo-approve-btn wd-row-action wd-action-gold" data-key="' + wdUiEscape(task.key) + '">Make Approval</button>';
        } else {
            let actionsHTML = '';
            if (task.remarks === 'For SRV' || task.remarks === 'Waiting Signature' || task.remarks === 'Waiting Approval') {
                actionsHTML += `<button class="srv-done-btn wd-row-action wd-action-srv" data-key="${wdUiEscape(task.key)}">SRV Done</button>`;
                actionsHTML += `<button class="modify-btn wd-row-action wd-action-process" data-key="${wdUiEscape(task.key)}">Process</button>`;
            } else {
                actionsHTML = `<button class="modify-btn wd-row-action wd-action-process" data-key="${wdUiEscape(task.key)}">Process</button>`;
            }
            actionsCell.innerHTML = actionsHTML;
        }

        row.appendChild(actionsCell);
        activeTaskTableBody.appendChild(row);
    });
}

function renderWorkdeskMobileActiveTasks(tasks) {
    // 7.3.5: WorkDesk has its own mobile renderer entry point and receives
    // WorkDesk/Invoice-only tasks.
    return renderMobileActiveTasks((Array.isArray(tasks) ? tasks : []).filter(t => isWorkdeskTaskRecord(t)));
}


function wdActiveTaskCacheUserKey() {
    try {
        return [
            String(currentApprover?.Name || '').trim().toLowerCase(),
            String(currentApprover?.Role || currentApprover?.role || '').trim().toLowerCase(),
            String(currentApprover?.Site || currentApprover?.site || '').trim().toLowerCase()
        ].join('|');
    } catch (e) {
        return '';
    }
}

function wdSaveActiveTaskSessionSnapshot(mode, tasks) {
    try {
        window.IBA_ACTIVE_TASK_LAST_MODE = mode;
        window.IBA_ACTIVE_TASK_LOADED_AT = Date.now();
        if (mode !== 'workdesk' || !Array.isArray(tasks)) return;
        window.sessionStorage.setItem('IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V1', JSON.stringify({
            userKey: wdActiveTaskCacheUserKey(),
            savedAt: Date.now(),
            tasks: tasks
        }));
    } catch (e) {
        // Storage can fail in private mode. Never block task rendering.
    }
}

async function populateActiveTasks(forceRefresh = false) {
    activeTaskTableBody.innerHTML = `<tr><td colspan="10">Loading tasks...</td></tr>`;

    // --- SAFETY DEFINITIONS ---
    const isInventoryPage = (typeof isInventoryContext === 'function') ? isInventoryContext() : false;
    
    if (!currentApprover || !currentApprover.Name) {
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Could not identify user.</td></tr>`;
        return;
    }

    try {
        const currentUserName = currentApprover.Name;
        const currentUserSite = currentApprover.Site || ''; 

        // Vacation Delegation: if you are listed as ReplacementName for any user currently on vacation,
        // you will also see their tasks in Active Tasks (so nothing is missed while they are away).
        const delegatedFromNames = (typeof getDelegatorsForReplacement === 'function')
            ? getDelegatorsForReplacement(currentUserName)
            : [];
        const delegatedFromNorm = new Set(delegatedFromNames.map(n => _normName(n)));
        const isMeOrDelegated = (nameVal) => {
            const n = _normName(nameVal);
            if (!n) return false;
            if (n === _normName(currentUserName)) return true;
            return delegatedFromNorm.has(n);
        };

// =============================================================
// Direct-attention helpers (for accurate UI triggers)
// 7.5.1: Manual Attention override rule for WorkDesk/Invoice tasking.
// If a user's name is manually selected in Attention, the task must blink/count/color
// for that person even when the task site is not part of their registered site list.
// Site matching is kept only for broad/all-site visibility rules, not for direct Attention.
// =============================================================
const _norm = (v) => String(v || '').trim().toLowerCase();
const _userNameNorm = _norm(currentUserName);
const _userSiteNorm = _norm(currentUserSite);

const isDirectAttentionForUser = (attentionVal) => _norm(attentionVal) === _userNameNorm;

const isSiteMatchForUser = (taskSiteVal) => {
    // Users with Site "All" can match any site.
    if (_userSiteNorm === '' || _userSiteNorm === 'all') return true;

    const raw = String(taskSiteVal || '').trim();
    if (!raw) return true;
    const siteLower = raw.toLowerCase();

    // "All" / blank site means not restricting by site
    if (siteLower === 'all') return true;

    // Handle combined strings like "A ➔ B" or "Used at A"
    if (siteLower.includes(_userSiteNorm)) return true;

    // Fallback to ID-based matching (keeps old behavior)
    const taskId = siteLower.split(' ')[0];
    const userId = _userSiteNorm.split(' ')[0];
    if (_userSiteNorm.includes(taskId)) return true;
    if (siteLower.includes(userId)) return true;

    return false;
};

const getTaskSiteForMatch = (t) =>
    t.site || t.toSite || t.fromSite || t.toLocation || t.fromLocation || '';
        
        const nameLower = (currentApprover.Name || '').toLowerCase();
        const userPositionLower = (currentApprover.Position || '').toLowerCase();
        const userRoleLower = (currentApprover.Role || '').toLowerCase();

        const isAccounting = userPositionLower.includes('accounting') || 
                             userPositionLower.includes('accounts') || 
                             userPositionLower.includes('finance') ||
                             nameLower.includes('irwin');
        
        const isAdmin = userRoleLower === 'admin';
        const isQS = userPositionLower === 'qs';
        const isProcurement = userPositionLower === 'procurement';

        const financeBatchControls = document.getElementById('financeBatchControls');
        if (financeBatchControls) {
            // [VACATION] Force hidden for now
            financeBatchControls.style.display = 'none'; 
            
            // OLD CODE (Keep for later):
            // financeBatchControls.style.display = (isInventoryPage) ? 'none' : ((isAccounting || isAdmin) ? 'flex' : 'none');
        }

        let userTasks = [];
        let pulledInvoiceKeys = new Set(); 

        await ensureAllEntriesFetched(forceRefresh);
        await ensureApproverDataCached(forceRefresh);
        
        if (!isInventoryPage) {
            await ensureInvoiceDataFetched(forceRefresh);
        }

        if (typeof reconcilePendingPRs === 'function') {
            await reconcilePendingPRs();
        }

        // --- A. JOB ENTRIES FILTER ---
        const jobTasks = allSystemEntries.filter(entry => {
            if (isTaskComplete(entry)) return false;
            if (isInventoryPage && !INVENTORY_TYPES.includes(entry.for)) return false;

            if (entry.for === 'Invoice' && entry.po && allInvoiceData && allInvoiceData[entry.po]) {
                const currentStatus = entry.remarks || entry.status || '';
                if (currentStatus !== 'New Entry' && currentStatus !== 'Pending') return false; 
            }

            // 1. BLANK ATTENTION CHECK
            if (!entry.attention || entry.attention.trim() === '' || entry.attention.toLowerCase() === 'none') {
                const isTransfer = ['Transfer', 'Restock', 'Return', 'Usage'].includes(entry.for);
                const isInvoiceForAcc = (entry.for === 'Invoice' && (isAccounting || isAdmin) && !isInventoryPage);
                if (!isTransfer && !isInvoiceForAcc) return false; 
            }
            
            // 2. Transfer Logic
            if (['Transfer', 'Restock', 'Return', 'Usage'].includes(entry.for)) {
                if (entry.remarks === 'Pending Confirmation') return isMeOrDelegated(entry.requestor);
                if (entry.remarks === 'Pending Source') return isMeOrDelegated(entry.sourceContact);
                if (entry.remarks === 'Pending Admin' || entry.remarks === 'Pending') return isMeOrDelegated(entry.approver) || isMeOrDelegated(entry.attention);
                if (entry.remarks === 'Approved' || entry.remarks === 'In Transit') return isMeOrDelegated(entry.receiver);
                if (isMeOrDelegated(entry.attention)) return true;
                // 7.7.4: Inventory Active Task is personal/designated only.
                // Do not show broad Attention=All inventory tasks in My Active Task.
                return false;
            }

            // 3. Invoice / Accounting Logic
            if ((isAccounting || isAdmin) && !isInventoryPage) {
                if (entry.for === 'Invoice') return true; 
                if (entry.attention === 'Accounting') return true;
            }
            
            // 4. General & Name Match
            if (entry.for === 'PR' && isProcurement) return true;
            if (isMeOrDelegated(entry.attention)) return true;

            // 5. "ALL" Logic
            if (entry.attention === 'All') {
                if (currentUserSite === 'All') return true;
                if (!entry.site || entry.site === 'All') return true;
                const entrySiteID = entry.site.split(' ')[0];
                if (currentUserSite.includes(entrySiteID)) return true;
                if (entry.site === currentUserSite) return true; 
            }
            
            if (entry.for === 'IPC' && isQS && isMeOrDelegated(entry.attention)) return true;
            
            return false;
        });

        userTasks = jobTasks.map(task => {
            let displayStatus = task.remarks || task.status || 'Pending';
            if (task.for === 'Invoice' && displayStatus === 'Pending') displayStatus = 'New Entry'; 

            const taskSiteForMatch = getTaskSiteForMatch(task);
            const taskIsInventory = isInventoryTaskRecord(task);
            let attentionForUrgent = task.attention;

            // Inventory approvals use role-specific people instead of always using
            // the generic attention field. This keeps Inventory badge/blink counts
            // accurate without borrowing WorkDesk/Invoice task triggers.
            if (taskIsInventory) {
                const invStatus = String(task.remarks || task.status || '').trim();
                if (invStatus === 'Pending Confirmation') attentionForUrgent = task.requestor || task.attention;
                else if (invStatus === 'Pending Source') attentionForUrgent = task.sourceContact || task.attention;
                else if (invStatus === 'Pending Admin' || invStatus === 'Pending') attentionForUrgent = task.approver || task.attention;
                else if (invStatus === 'Approved' || invStatus === 'In Transit') attentionForUrgent = task.receiver || task.attention;
            }

            let isUrgent = isDirectAttentionForUser(attentionForUrgent);

            // 7.7.4: Inventory Active Task must stay personal/designated.
            // Admin/Super Admin still have full access in Job Records/Request Review, but
            // My Active Task should not show every generic Pending Admin inventory record.

            // Keep existing "no action" states from triggering UI
            if (String(displayStatus || '').toLowerCase().includes('on hold')) isUrgent = false;
            if (task.remarks === 'SRV Done') isUrgent = false;
            
            const source = ['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for) ? 'transfer_entry' : 'job_entry';
            return { ...task, source: source, isUrgent: isUrgent, remarks: displayStatus };
        });

        // --- B. INVOICE TASKS (Personal Notifications) ---
        if (!isInventoryPage) {
            const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
            const cleanupPromises = []; // stale invoice task cleanup

            const safeCurrentUserName = sanitizeFirebaseKey(currentUserName);
            
            const [personalSnapshot, allSnapshot] = await Promise.all([
                invoiceDb.ref(`invoice_tasks_by_user/${safeCurrentUserName}`).once('value'),
                invoiceDb.ref(`invoice_tasks_by_user/All`).once('value')
            ]);

            const processInvoiceSnapshot = async (snapshot) => {
                if (snapshot.exists()) {
                    const tasksData = snapshot.val();
                    for (const invoiceKey in tasksData) {
                        if (pulledInvoiceKeys.has(invoiceKey)) continue;
                        const task = tasksData[invoiceKey];
                        const isFromAll = (snapshot.key === 'All');

                        // Fast cleanup: Completed invoice tasks should not appear in Active Tasks
                        // (SRV Done, With Accounts, Paid, etc.). If found in inbox, remove it silently.
                        try {
                            const st = String(task.status || task.remarks || '').trim();
                            const completed = ['With Accounts', 'SRV Done', 'Paid', 'On Hold', 'CLOSED', 'Cancelled'];
                            if (completed.includes(st)) {
                                cleanupPromises.push(invoiceDb.ref(`invoice_tasks_by_user/${snapshot.key}/${invoiceKey}`).remove());
                                continue;
                            }
                        } catch (_) { /* ignore */ }


                        // --- STALE TASK RECONCILE ---
                        // If the invoice status/attention changed elsewhere (batch edits, etc.),
                        // remove this stale inbox item so it won't keep showing.
                        try {
                            const latestInv = (allInvoiceData && task.po && allInvoiceData[task.po] && allInvoiceData[task.po][invoiceKey])
                                ? allInvoiceData[task.po][invoiceKey]
                                : null;

                            if (latestInv && typeof isInvoiceTaskActive === 'function') {
                                const latestIsActive = isInvoiceTaskActive(latestInv);
                                const latestAttn = String(latestInv.attention || '').trim();
                                const latestAttnKey = latestAttn ? sanitizeFirebaseKey(latestAttn) : '';
                                const thisInboxKey = snapshot.key; // already sanitized

                                let shouldRemoveFromThisInbox = false;

                                // If task is no longer active (e.g., moved to With Accounts/Paid/etc.) => remove
                                if (!latestIsActive) shouldRemoveFromThisInbox = true;

                                // If attention moved to someone else => remove from this old inbox
                                if (!shouldRemoveFromThisInbox) {
                                    if (thisInboxKey === 'All') {
                                        if (latestAttnKey && latestAttnKey !== 'All') shouldRemoveFromThisInbox = true;
                                    } else {
                                        if (latestAttnKey && latestAttnKey !== thisInboxKey) shouldRemoveFromThisInbox = true;
                                    }
                                }

                                if (shouldRemoveFromThisInbox) {
                                    cleanupPromises.push(
                                        invoiceDb.ref(`invoice_tasks_by_user/${thisInboxKey}/${invoiceKey}`).remove()
                                    );
                                    // Optional repair: ensure it exists in the new attention inbox
                                    if (latestIsActive && latestAttn && typeof updateInvoiceTaskLookup === 'function') {
                                        cleanupPromises.push(
                                            updateInvoiceTaskLookup(task.po, invoiceKey, latestInv, task.attention || '')
                                        );
                                    }
                                    continue;
                                }
                            }
                        } catch (e) {
                            // ignore cleanup errors (never block UI)
                        }

                        if ((!task.attention || task.attention.trim() === '') && !isFromAll) { task.attention = (currentApprover ? currentApprover.Name : ''); }
                        if (isFromAll) {
                            let allowed = false;
                            if (currentUserSite === 'All') allowed = true;
                            else if (!task.site || task.site === 'All') allowed = true;
                            else if (currentUserSite.includes(task.site.split(' ')[0])) allowed = true;
                            if (!allowed) continue;
                        }
                        pulledInvoiceKeys.add(invoiceKey);

                        let realAmountPaid = task.amountPaid;
                        if (!realAmountPaid && allInvoiceData && allInvoiceData[task.po] && allInvoiceData[task.po][invoiceKey]) {
                            realAmountPaid = allInvoiceData[task.po][invoiceKey].amountPaid;
                        }
                        let finalAttention = task.attention || (isFromAll ? 'All' : currentUserName);
                        
                        const taskSiteForMatch = task.site;
let isUrgent = isDirectAttentionForUser(finalAttention) &&
               task.status !== 'On Hold';

                        // Resolve PO details (POVALUE2.csv + invoiceDb/purchase_orders) for Vendor/Site fallback
                        const poDetails = (typeof getInvoicePurchaseOrderDetails === 'function')
                            ? await getInvoicePurchaseOrderDetails(task.po)
                            : ((typeof allPOData !== 'undefined' && allPOData && allPOData[task.po]) ? allPOData[task.po] : {});

                        const resolvedVendor = (task.vendorName && String(task.vendorName).trim() && String(task.vendorName).trim().toUpperCase() !== 'N/A')
                            ? task.vendorName
                            : (poDetails['Supplier Name'] || poDetails['Supplier Name:'] || poDetails['Supplier'] || poDetails['Supplier:'] || 'N/A');

                        const resolvedSite = (task.site && String(task.site).trim() && String(task.site).trim().toUpperCase() !== 'N/A')
                            ? task.site
                            : (poDetails['Project ID'] || poDetails['Project ID:'] || 'N/A');

                        const resolvedPOAmount = (task.amount && String(task.amount).trim() && String(task.amount).trim().toUpperCase() !== 'N/A')
                            ? task.amount
                            : (poDetails['Amount'] || poDetails.Amount || '');

	                        // Pull live invoice metadata (helps dedupe & debugging if duplicate keys exist)
	                        const invMeta = (allInvoiceData && allInvoiceData[task.po] && allInvoiceData[task.po][invoiceKey])
	                            ? allInvoiceData[task.po][invoiceKey]
	                            : {};

                        userTasks.push({
                            key: `${task.po}_${invoiceKey}`,
                            originalKey: invoiceKey,
                            originalPO: task.po,
                            source: 'invoice',
                            for: 'Invoice',
                            ref: task.ref,
	                            invEntryID: invMeta.invEntryID || task.invEntryID || '',
                            po: task.po,
                            amount: task.amount || resolvedPOAmount,
                            amountPaid: realAmountPaid || task.amount || resolvedPOAmount,
                            site: resolvedSite,
                            group: 'N/A',
                            attention: finalAttention, 
	                            enteredBy: task.enteredBy || (invMeta.enteredBy || '') || 'Accounting',
                            date: formatYYYYMMDD(task.date),
                            remarks: task.status,
	                            timestamp: Date.now(),
	                            invoiceLastUpdated: invMeta.lastUpdated || invMeta.updatedAt || invMeta.enteredAt || 0,
                            invName: task.invName,
                            vendorName: resolvedVendor,
                            note: task.note,
                            isUrgent: isUrgent
                        });
                    }
                }
            };
            await processInvoiceSnapshot(personalSnapshot);
            await processInvoiceSnapshot(allSnapshot);

            // Fire-and-forget cleanup of stale inbox items
            if (cleanupPromises.length > 0) {
                Promise.allSettled(cleanupPromises).catch(() => {});
            }
        }

        // --- C. GLOBAL INVOICE LOOKUP ---
        if (!isInventoryPage && allInvoiceData) { 
            
            const accStatuses = ['Pending', 'Report', 'Original PO', 'On Hold', 'Unresolved', 'In Process'];
            
            // [FIX HERE]: Removed 'For SRV' from this list.
            // This prevents "Site: All" users from automatically seeing 'For SRV' tasks.
            const siteStatuses = ['Waiting Signature', 'Waiting Approval']; 

            for (const poNumber in allInvoiceData) {
                const poInvoices = allInvoiceData[poNumber];
                const poDetails = (typeof getInvoicePurchaseOrderDetails === 'function')
				? await getInvoicePurchaseOrderDetails(poNumber)
				: (allPOData[poNumber] || {});
	                // Prefer site from POVALUE2/allPOData. Fall back to invoice fields after inv is defined.
	                const poSiteFromPO = poDetails['Project ID'] || poDetails['Project ID:'] || 'N/A';

                for (const invoiceKey in poInvoices) {
                    if (pulledInvoiceKeys.has(invoiceKey)) continue; 
                    const inv = poInvoices[invoiceKey];
                    // Skip completed SRV Done items (never show in Active Tasks)
                    if (String(inv.status || '').trim() === 'SRV Done') continue;
	                    const poSite = (poSiteFromPO && poSiteFromPO !== 'N/A')
	                        ? poSiteFromPO
	                        : (inv.site_name || inv.site || inv.siteName || 'N/A');
                    let shouldShow = false;
                    let isUrgent = false;

                    // 1. Accounting/Admin Visibility
                    if ((isAccounting || isAdmin) && accStatuses.includes(inv.status)) {
                        shouldShow = true;
                        isUrgent = false; 
                    }

                    // 2. Site Visibility
                    // Because 'For SRV' was removed from siteStatuses, this block is skipped for SRV tasks.
                    if (siteStatuses.includes(inv.status)) {
                        if (currentUserSite === 'All' || currentUserSite.includes(poSite.split(' ')[0])) {
                            shouldShow = true; 
                        }
                    }

                    // [7.5.1] ATTENTION CHECK (Manual Attention override)
// Visibility may still be granted by the blocks above, but
// blink/color/count must trigger for direct Attention even if the site is not
// registered under that helper's profile.
if (inv.attention === 'All') {
    shouldShow = true;
    isUrgent = false; // "All" = visible but NOT a direct action for a specific user
} 
else if (isDirectAttentionForUser(inv.attention)) {
    shouldShow = true;
    isUrgent = inv.status !== 'On Hold';
}

                    
                    if (shouldShow) {
                        let effAttention = inv.attention;
                        if (!effAttention || effAttention === '') effAttention = isAccounting ? 'Accounting' : 'Site';

                        userTasks.push({
                            key: `${poNumber}_${invoiceKey}`,
                            originalKey: invoiceKey,
                            originalPO: poNumber,
                            source: 'invoice',
                            for: 'Invoice',
                            ref: inv.invNumber || '',
	                            invEntryID: inv.invEntryID || '',
                            po: poNumber,
                            amount: inv.invValue || '',
                            amountPaid: inv.amountPaid || inv.invValue || '',
                            site: (poSite && poSite !== 'N/A') ? poSite : (inv.site || inv.site_name || 'N/A'),
                            group: 'N/A',
                            attention: effAttention, 
                            enteredBy: inv.enteredBy || inv.originEnteredBy || inv.updatedBy || 'Accounting',
                            date: formatYYYYMMDD(inv.invoiceDate),
                            remarks: inv.status,
	                            timestamp: Date.now(),
	                            invoiceLastUpdated: inv.lastUpdated || inv.updatedAt || inv.enteredAt || 0,
                            invName: inv.invName || '',
                            vendorName: poDetails['Supplier Name'] || poDetails['Supplier Name:'] || poDetails['Supplier'] || poDetails['Supplier:'] || inv.vendorName || inv.vendor_name || 'N/A',
                            note: inv.note || '',
                            isUrgent: isUrgent 
                        });
                    }
                }
            }
        }
        // INVENTORY PHASE 1: separate task identity.
        // Inventory mode keeps only inventory tasks. Normal WorkDesk/Invoice mode
        // keeps only non-inventory tasks, so invoice/workdesk jobs cannot trigger
        // Inventory Active Task counts/blink anymore and inventory jobs cannot leak
        // into WorkDesk Active Task counts.
        if (isInventoryPage) {
            userTasks = userTasks.filter(t => isInventoryTaskRecord(t));
        } else {
            userTasks = userTasks.filter(t => isWorkdeskTaskRecord(t));
        }

	        // ------------------------------------------------------------------
	        // DEFENSIVE DEDUPE
	        // If a task is reverted (e.g. SRV Done -> For SRV) and the database ends up with
	        // duplicate invoice entries or stale inbox rows, the UI can show the same task twice.
	        // We de-duplicate by:
	        //  1) Exact task.key (should never repeat)
	        //  2) Invoice logical id: PO + invEntryID (fallback: PO + ref), keeping the newest
	        // ------------------------------------------------------------------
	        try {
	            // 1) Exact key dedupe
	            const _seenKeys = new Set();
	            userTasks = userTasks.filter(t => {
	                if (!t || !t.key) return false;
	                if (_seenKeys.has(t.key)) return false;
	                _seenKeys.add(t.key);
	                return true;
	            });

	            // 2) Invoice logical dedupe
	            const _bestByLogicalId = new Map();
	            const _dropKeys = new Set();
	            for (const t of userTasks) {
	                if (!t || t.source !== 'invoice') continue;
	                const po = String(t.po || t.originalPO || '').trim();
	                const logicalPart = String(t.invEntryID || t.ref || '').trim();
	                if (!po || !logicalPart) continue;
	                const logicalId = `${po}|${logicalPart}`;
	                const existing = _bestByLogicalId.get(logicalId);
	                if (!existing) {
	                    _bestByLogicalId.set(logicalId, t);
	                    continue;
	                }
	                const a = Number(existing.invoiceLastUpdated || 0);
	                const b = Number(t.invoiceLastUpdated || 0);
	                if (b > a) {
	                    _dropKeys.add(existing.key);
	                    _bestByLogicalId.set(logicalId, t);
	                } else {
	                    _dropKeys.add(t.key);
	                }
	            }
	            if (_dropKeys.size > 0) {
	                userTasks = userTasks.filter(t => !(_dropKeys.has(t.key)));
	            }
	        } catch (e) {
	            // Never block task loading due to dedupe logic
	        }

	        userActiveTasks = userTasks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        wdSaveActiveTaskSessionSnapshot(isInventoryPage ? 'inventory' : 'workdesk', userActiveTasks);
        const totalTaskCount = userActiveTasks.length;
        const urgentCount = userActiveTasks.filter(t => t.isUrgent === true).length;

        if (activeTaskCountDisplay) {
            activeTaskCountDisplay.textContent = `(Action: ${urgentCount} | Records: ${totalTaskCount})`;
        }
        
        if (isInventoryPage) {
            inventoryActiveTasks = userActiveTasks.slice();
        }
        updateActiveTaskModuleBadges(urgentCount, totalTaskCount, isInventoryPage ? 'inventory' : 'workdesk');

        // --- D. Tab Calculation ---
// Tabs are built from ALL visible tasks, but blink/color/count is ONLY for
// tasks that are direct-attention + site-match (task.isUrgent === true).
const tabCountsAll = {};
const directTabCounts = {};

userActiveTasks.forEach(task => {
    let key = '';
    if (['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) {
        key = task.for;
    } else {
        key = task.remarks || 'Pending';
    }

    tabCountsAll[key] = (tabCountsAll[key] || 0) + 1;

    if (task.isUrgent === true) {
        directTabCounts[key] = (directTabCounts[key] || 0) + 1;
    }
});

// Order tabs so "direct attention" (urgent) tabs appear first.
// Within urgent tabs: highest urgent count first, then alphabetical.
// Remaining tabs: alphabetical.
const uniqueTabs = Object.keys(tabCountsAll).sort((a, b) => {
    const da = (directTabCounts[a] || 0);
    const db = (directTabCounts[b] || 0);
    const ha = da > 0;
    const hb = db > 0;
    if (ha && !hb) return -1;
    if (!ha && hb) return 1;
    if (ha && hb && db !== da) return db - da;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
});
        let tabsHTML = '';
        const getTabColor = (statusRaw) => {
            const status = (statusRaw || '').toLowerCase();
            if (status.includes('approved')) return '#28a745'; 
            if (status.includes('rejected')) return '#dc3545'; 
            if (status.includes('pending')) return '#ffc107';  
            if (status.includes('new entry')) return '#17a2b8'; 
            if (status.includes('unresolved')) return '#fd7e14'; 
            if (status.includes('on hold')) return '#6c757d'; 
            if (status.includes('process')) return '#17a2b8'; 
            if (status.includes('report')) return '#007bff';  
            if (status.includes('original')) return '#6610f2'; 
            if (status.includes('transfer')) return '#00748C'; 
            if (status.includes('srv')) return '#e83e8c'; 
            if (status.includes('waiting')) return '#6610f2';
            return '#fd7e14';
        };

        // 8.6.10: Choose black/white tab text based on real contrast.
        // This keeps unread / not-clicked Active Task status tabs readable,
        // especially bright colors like Pending yellow and New Entry cyan.
        const getReadableTabText = (hexColor) => {
            try {
                const hex = String(hexColor || '').replace('#', '').trim();
                if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#0f172a';
                const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
                const linear = rgb.map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
                const lum = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
                const whiteContrast = (1.05) / (lum + 0.05);
                const darkContrast = (lum + 0.05) / 0.068; // #0f172a approximate luminance
                return darkContrast >= whiteContrast ? '#0f172a' : '#ffffff';
            } catch (e) {
                return '#0f172a';
            }
        };

        if (uniqueTabs.length > 0) {
            if (currentActiveTaskFilter === 'All' || !uniqueTabs.includes(currentActiveTaskFilter)) {
                currentActiveTaskFilter = uniqueTabs[0];
            }
            uniqueTabs.forEach(tabName => {
    const activeClass = (tabName === currentActiveTaskFilter) ? 'active' : '';
    const directCount = (directTabCounts[tabName] || 0);
    const hasDirectTasks = directCount > 0;

    let tabColor, tabText, fontWeight, blinkClass;

    if (hasDirectTasks) {
        const statusColor = getTabColor(tabName);
        tabColor = statusColor;
        tabText = getReadableTabText(statusColor);
        fontWeight = '900';
        blinkClass = 'blink-tab';
    } else {
        // No direct attention tasks for this user in this tab => keep it neutral
        tabColor = '#d7dbe0';
        tabText = '#2c2c2c';
        fontWeight = '700';
        blinkClass = '';
    }

    const badgeHTML = hasDirectTasks
        ? `<span class="notification-badge"
                 style="background-color: ${tabColor}; color: ${tabText}; font-size: 0.7rem; margin-left: 5px; border: 1px solid rgba(255,255,255,.45);">
                ${directCount}
           </span>`
        : '';

    tabsHTML += `
    <button class="${activeClass} ${blinkClass}"
            data-status-filter="${tabName}"
            style="--tab-color: ${tabColor}; --tab-text: ${tabText}; font-weight: ${fontWeight};">
        ${tabName}
        ${badgeHTML}
    </button>`;
});
        } else {
            tabsHTML = '<button class="active" disabled>No Tasks</button>';
            activeTaskTableBody.innerHTML = `<tr><td colspan="10">You have no active tasks.</td></tr>`;
            activeTaskFilters.innerHTML = tabsHTML;
            // 7.4.1: Also clear/render the mobile card area. Without this,
            // old invoice mobile cards can remain below the Inventory "No Tasks" tab.
            if (typeof renderActiveTaskTable === 'function') {
                renderActiveTaskTable([]);
            } else if (typeof clearMobileActiveTaskCards === 'function') {
                clearMobileActiveTaskCards();
            }
            return;
        }
        activeTaskFilters.innerHTML = tabsHTML;
        renderActiveTaskTable(userTasks);

    } catch (error) {
        console.error("Error fetching active tasks:", error);
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Error loading tasks.</td></tr>`;
    }
}

function handleActiveTaskSearch(searchTerm) {
    const searchText = searchTerm.toLowerCase();
    sessionStorage.setItem('activeTaskSearch', searchText);

    let searchedTasks = Array.isArray(userActiveTasks) ? userActiveTasks.slice() : [];
    // 7.4.1: When the mobile module changes, never let stale invoice cards render inside Inventory.
    if (typeof isInventoryContext === 'function' && isInventoryContext()) {
        searchedTasks = searchedTasks.filter(t => isInventoryTaskRecord(t));
    } else {
        searchedTasks = searchedTasks.filter(t => isWorkdeskTaskRecord(t));
    }
    if (searchText) {
        searchedTasks = userActiveTasks.filter(task => {
            return (
                (task.for && task.for.toLowerCase().includes(searchText)) ||
                (task.ref && task.ref.toLowerCase().includes(searchText)) ||
                (task.po && task.po.toLowerCase().includes(searchText)) ||
                (task.vendorName && task.vendorName.toLowerCase().includes(searchText)) ||
                (task.site && task.site.toLowerCase().includes(searchText)) ||
                (task.note && task.note.toLowerCase().includes(searchText)) ||
                (task.date && task.date.toLowerCase().includes(searchText)) ||
                (task.calendarDate && task.calendarDate.toLowerCase().includes(searchText))
            );
        });
    }
    renderActiveTaskTable(searchedTasks);
}

// #endregion BLOCK 14 — ACTIVE TASKS DISPLAY + LOADING
