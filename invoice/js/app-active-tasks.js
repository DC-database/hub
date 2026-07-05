/* ==========================================================================
   js/app-active-tasks.js
   IBA WorkDesk active-task renderer, filters, mobile cards, and task loader.
   Version: 10.5.1

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

   9.2.5:
   - WorkDesk Active Task is now a personal Attention-name queue only.
   - Dashboard overview rules remain unchanged.
   - Active Task dashboard-style mini metric cards are removed/cleared.

   9.2.7:
   - Active Task tab emphasis softened so the UI is readable without every label
     looking extra-bold.
   ========================================================================== */

// =================================================================================================
// #region BLOCK 14 — ACTIVE TASKS DISPLAY + LOADING
// Purpose: WorkDesk/Inventory active-task routing, desktop table, mobile cards, filters, and task loading.
// =================================================================================================


function wdActiveTaskDisplayType(task) {
    const raw = String(task?.for || task?.type || '').trim();
    if (raw === 'IPC') return 'IPC Processed';
    return raw;
}

function wdActiveTaskIsIPCWorkflowTask(task) {
    const raw = String(task?.for || task?.type || '').trim();
    const status = String(task?.remarks || task?.status || '').trim();
    return raw === 'IPC Application' || raw === 'IPC Processed' || raw === 'IPC' || status === 'Waiting Invoice' || status === 'IPC Issue';
}

function isTaskComplete(task) {
    if (!task) return false;

    // 1. Special check for Job Entries (Invoice Type)
    if (task.source === 'job_entry' && task.for === 'Invoice') {
        const invoiceJobStatus = String(task.remarks || task.status || '').trim();
        const invoiceJobStatusLower = invoiceJobStatus.toLowerCase();

        // 10.5.1: IPC Application / IPC Processed can be converted into an Invoice
        // intake row. That converted intake must remain visible as a fresh New Entry
        // until Invoice Entry actually creates the real invoice record. Do not treat
        // invoiceConvertedAt/dateResponded/history text as completed by itself.
        if (invoiceJobStatusLower === 'new entry' || invoiceJobStatusLower === 'pending' || !invoiceJobStatusLower) {
            const isHardClosedInvoiceJob = !!(
                task.convertedToInvoice ||
                task.archived ||
                task.linkedInvoiceKey ||
                task.invoiceWorkflowStatus ||
                task.linkedInvoiceStatus ||
                invoiceJobStatusLower === 'converted to invoice'
            );
            return isHardClosedInvoiceJob;
        }

        const isConvertedInvoiceJob = !!(
            task.convertedToInvoice ||
            task.archived ||
            task.linkedInvoiceKey ||
            task.invoiceWorkflowStatus ||
            task.linkedInvoiceStatus ||
            invoiceJobStatusLower === 'converted to invoice'
        );
        if (isConvertedInvoiceJob) return true;

        // 8.7.0: IPC/Job Record items converted to Invoice must remain visible as
        // fresh invoice tasks even if the old IPC record carried dateResponded.

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
        'Cancelled',
        'Completed',
        'Done'
    ];

    if (task.source === 'invoice') {
        // 10.2.8: Invoice tasks must follow the real invoice status, not who entered it.
        // Previously an invoice entered by the logged-in user could be treated as complete
        // unless it was exactly For SRV/For IPC. That wrongly hid active queues such as
        // On Hold, Pending, Report, In Process, and Unresolved from My Personal Tasks.
        const invoiceStatus = String(task.remarks || task.status || '').trim();
        if (!invoiceStatus) return true;
        if (typeof isInvoiceTaskActive === 'function') {
            return !isInvoiceTaskActive({ status: invoiceStatus, remarks: invoiceStatus });
        }
        if (completedStatuses.includes(invoiceStatus)) return true;
        return wdActiveTaskIsInactiveInvoiceStatus(invoiceStatus);
    }

    if (task.source === 'job_entry') {
        // 10.1.5: IPC Processed must stay active for Reception even though QS action
        // time is stored in dateResponded/ipcDoneDate. IPC Issue must stay active for QS.
        if (wdActiveTaskIsIPCWorkflowTask(task)) {
            const st = String(task.remarks || task.status || '').trim().toLowerCase();
            if (['with accounts', 'closed', 'cancelled', 'canceled', 'completed', 'done', 'paid'].includes(st)) return true;
            if (String(task.for || '').trim() === 'Invoice') return false;
            return false;
        }
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
        wdActiveTaskClearDateTabs();
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


// 9.7.9: Active Task date-tab queue helpers.
// Keeps Active Task aligned with the Dashboard idea: older queue dates first,
// but users can still click any date tab they want to work on.
let wdActiveTaskSelectedDateKey = '';
let wdActiveTaskSelectedDateStatus = '';

// 10.4.9: Active Task must not reuse a stale WorkDesk Job Entry cache for too long.
// Reception can add New Entry rows while the logged-in user keeps the app open;
// a short freshness window keeps the New Entry tab current without forcing a
// Firebase reload on every tiny table/search render.
let wdActiveTaskWorkdeskLastFreshLoadAt = 0;
const WD_ACTIVE_TASK_WORKDESK_FRESH_MS = 10000;

function wdActiveTaskShouldRefreshWorkdeskSource(forceRefresh, isInventoryPage) {
    if (isInventoryPage) return !!forceRefresh;
    if (forceRefresh) return true;
    return (Date.now() - Number(wdActiveTaskWorkdeskLastFreshLoadAt || 0)) > WD_ACTIVE_TASK_WORKDESK_FRESH_MS;
}

// 9.8.5: Queue date tabs belong only to WorkDesk/Invoice Active Task.
// Inventory Active Task is a separate module and must not inherit the WorkDesk date-tab UI.
function wdActiveTaskClearDateTabs() {
    const dateTabsEl = document.getElementById('active-task-date-tabs');
    if (!dateTabsEl) return;
    dateTabsEl.innerHTML = '';
    dateTabsEl.style.display = 'none';
    dateTabsEl.classList.add('wd-date-tabs-disabled');
}

function wdActiveTaskEnableDateTabs() {
    const dateTabsEl = document.getElementById('active-task-date-tabs');
    if (!dateTabsEl) return null;
    dateTabsEl.style.display = '';
    dateTabsEl.classList.remove('wd-date-tabs-disabled');
    return dateTabsEl;
}

function wdActiveTaskParseQueueTimestamp(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value < 10000000000 ? value * 1000 : value;
    const raw = String(value || '').trim();
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) {
        const n = Number(raw);
        return n < 10000000000 ? n * 1000 : n;
    }
    const m = raw.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,}|\d{1,2})[-\/\s](\d{4})$/);
    if (m) {
        const months = { jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11 };
        const day = Number(m[1]);
        const monthRaw = String(m[2]).toLowerCase();
        const month = /^\d+$/.test(monthRaw) ? Number(monthRaw) - 1 : months[monthRaw];
        const year = Number(m[3]);
        if (day > 0 && month >= 0 && month <= 11 && year > 1900) {
            const d = new Date(year, month, day);
            if (!Number.isNaN(d.getTime())) return d.getTime();
        }
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function wdActiveTaskFindLinkedJobRecord(task = {}) {
    try {
        const list = Array.isArray(allSystemEntries) ? allSystemEntries : [];
        if (!list.length) return null;
        const linkedKey = task.linkedJobEntryKey || task.originJobEntryKey || task.jobEntryKey || '';
        if (linkedKey) {
            const found = list.find(e => e && e.key === linkedKey);
            if (found) return found;
        }
        const targetTs = Number(task.jobRecordTimestamp || task.originTimestamp || 0);
        if (targetTs) {
            const found = list.find(e => e && Number(e.timestamp || 0) === targetTs);
            if (found) return found;
        }
        return null;
    } catch (_) {
        return null;
    }
}

function wdActiveTaskJobRecordEnteredTimestamp(task = {}) {
    const linked = wdActiveTaskFindLinkedJobRecord(task);
    const source = String(task?.source || '').toLowerCase();
    const directJobEntryDate = (source === 'job_entry' || source === 'transfer_entry') ? task?.date : '';
    return wdActiveTaskFirstQueueTimestamp(
        linked?.date,
        directJobEntryDate,
        task?.jobRecordDateEntered,
        task?.originDateEntered,
        task?.dateEntered,
        task?.entryDate,
        task?.jobRecordTimestamp,
        linked?.timestamp
    );
}

// 9.8.2: Decode Firebase push IDs so old invoice/task records can still use
// the true created/entered date for queue tabs when createdAt/enteredAt was not saved.
// This prevents date tabs from falling back to supplier invoice date or current load time.
function wdActiveTaskFirebasePushTimestamp(value) {
    const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    const raw = String(value || '');
    const candidates = [];
    if (raw.length >= 20) {
        const direct = raw.trim();
        if (direct.length === 20) candidates.push(direct);
        const matches = raw.match(/[-0-9A-Z_a-z]{20}/g) || [];
        candidates.push(...matches);
    }
    for (const id of candidates.reverse()) {
        let ts = 0;
        let valid = true;
        for (let i = 0; i < 8; i += 1) {
            const c = PUSH_CHARS.indexOf(id.charAt(i));
            if (c < 0) { valid = false; break; }
            ts = ts * 64 + c;
        }
        if (valid && ts > 0) return ts;
    }
    return 0;
}

function wdActiveTaskKeyCreatedTimestamp(task) {
    return wdActiveTaskFirebasePushTimestamp(
        task?.originalKey || task?.invoiceKey || task?.firebaseKey || task?.key || task?.id || ''
    );
}

function wdActiveTaskJobEnteredTimestamp(task) {
    // Official New Entry grouping uses the same value shown in Job Records > Date Entered.
    const officialJobDate = wdActiveTaskJobRecordEnteredTimestamp(task);
    if (officialJobDate) return officialJobDate;

    // Fallback for direct job_entries if the date field is missing.
    const source = String(task?.source || '').toLowerCase();
    const taskFor = String(task?.for || '').toLowerCase();
    if (source === 'job_entry' || source === 'transfer_entry' || taskFor === 'invoice') {
        return task?.timestamp;
    }
    return '';
}

function wdActiveTaskFirstQueueTimestamp() {
    for (let i = 0; i < arguments.length; i += 1) {
        const ts = wdActiveTaskParseQueueTimestamp(arguments[i]);
        if (ts > 0) return ts;
    }
    return 0;
}

function wdActiveTaskQueueStatusNorm(value) {
    return String(value || '').trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}


// 9.8.8: Official WorkDesk invoice-status queues must be exact matches.
// Do not convert similar/completed statuses such as "SRV Done" to "For SRV",
// and do not convert "Report Approved" to "Report".
const WD_ACTIVE_EXACT_INVOICE_STATUS_MAP = {
    'for srv': 'For SRV',
    'on hold': 'On Hold',
    'in process': 'In Process',
    'pending': 'Pending',
    'unresolved': 'Unresolved',
    'report': 'Report'
};
const WD_ACTIVE_COMPLETED_OR_NON_QUEUE_STATUSES = new Set([
    'with accounts',
    'srv done',
    'report approved',
    'approved',
    'rejected',
    'under review',
    'manager approved',
    'ceo approved',
    'cancelled',
    'canceled',
    'closed',
    'paid'
]);

function wdActiveTaskExactInvoiceStatusLabel(value) {
    const raw = wdActiveTaskQueueStatusNorm(value);
    if (!raw || WD_ACTIVE_COMPLETED_OR_NON_QUEUE_STATUSES.has(raw)) return '';

    // 10.2.7: Keep On Hold visible even if legacy rows saved it as
    // On-Hold, OnHold, Hold, or On Hold / Waiting.
    const compact = raw.replace(/[^a-z0-9]/g, '');
    if (compact === 'onhold' || raw === 'hold' || raw.includes('on hold')) return 'On Hold';

    return WD_ACTIVE_EXACT_INVOICE_STATUS_MAP[raw] || '';
}

function wdActiveTaskInvoiceStatusLabel(value) {
    return wdActiveTaskExactInvoiceStatusLabel(value);
}

function wdActiveTaskIsTrackedInvoiceStatus(value) {
    return !!wdActiveTaskInvoiceStatusLabel(value);
}

function wdActiveTaskHistoryValues(history) {
    if (!history) return [];
    if (Array.isArray(history)) return history.filter(Boolean);
    if (typeof history === 'object') return Object.values(history).filter(Boolean);
    return [];
}

function wdActiveTaskHistoryStatusMatches(entryStatus, targetStatus) {
    const entryLabel = wdActiveTaskExactInvoiceStatusLabel(entryStatus);
    const targetLabel = wdActiveTaskExactInvoiceStatusLabel(targetStatus);
    if (entryLabel && targetLabel) return entryLabel === targetLabel;
    const entry = wdActiveTaskQueueStatusNorm(entryStatus);
    const target = wdActiveTaskQueueStatusNorm(targetStatus);
    return !!entry && !!target && entry === target;
}

function wdActiveTaskInvoiceHistoryTimestamp(task, status) {
    const target = wdActiveTaskQueueStatusNorm(status || task?.remarks || task?.status || '');
    const historyList = [
        ...wdActiveTaskHistoryValues(task?.history),
        ...wdActiveTaskHistoryValues(task?.invoiceHistory),
        ...wdActiveTaskHistoryValues(task?.statusHistory)
    ];
    let best = 0;
    historyList.forEach(entry => {
        const entryStatus = entry?.status || entry?.action || entry?.remarks || '';
        if (!wdActiveTaskHistoryStatusMatches(entryStatus, target)) return;
        const ts = wdActiveTaskFirstQueueTimestamp(entry?.timestamp, entry?.updatedAt, entry?.createdAt, entry?.date, entry?.releaseDate);
        if (ts && ts > best) best = ts;
    });
    return best;
}

function wdActiveTaskIsJobNewEntry(task, status) {
    const s = wdActiveTaskQueueStatusNorm(status || task?.remarks || task?.status || '');
    const source = wdActiveTaskQueueStatusNorm(task?.source || '');
    const taskFor = wdActiveTaskQueueStatusNorm(task?.for || '');
    if (s.includes('new entry')) return true;
    // Pending is treated as New Entry only when it is still a Job Records invoice entry.
    // Invoice-management Pending must use invoice status/history date instead.
    return (s === 'pending' || s === 'new') && source === 'job entry' && taskFor === 'invoice';
}

function wdActiveTaskIsIPCQueue(task, status) {
    const s = wdActiveTaskQueueStatusNorm(status || task?.remarks || task?.status || '');
    const source = wdActiveTaskQueueStatusNorm(task?.source || '');
    const taskFor = wdActiveTaskQueueStatusNorm(task?.for || '');
    return ['ipc', 'ipc application', 'ipc processed'].includes(taskFor) || source.includes('ipc') || s.includes('ipc') || s === 'waiting invoice';
}

function wdActiveTaskInvoiceStatusTimestamp(task, status) {
    const exactStatus = wdActiveTaskExactInvoiceStatusLabel(status || task?.remarks || task?.status || '');
    const historyTs = wdActiveTaskInvoiceHistoryTimestamp(task, exactStatus || status);
    const keyCreatedAt = wdActiveTaskKeyCreatedTimestamp(task);

    if (exactStatus === 'For SRV') {
        return wdActiveTaskFirstQueueTimestamp(
            historyTs,
            task?.statusQueueAt,
            task?.forSrvAt,
            task?.sentToSrvAt,
            task?.srvRequestedAt,
            task?.queueAt,
            task?.statusChangedAt,
            task?.statusUpdatedAt,
            task?.releaseDate,
            task?.updatedAt,
            task?.lastUpdated,
            task?.invoiceLastUpdated,
            keyCreatedAt
        );
    }

    if (exactStatus === 'Report') {
        return wdActiveTaskFirstQueueTimestamp(
            historyTs,
            task?.statusQueueAt,
            task?.reportAt,
            task?.sentToReportAt,
            task?.queueAt,
            task?.statusChangedAt,
            task?.statusUpdatedAt,
            task?.releaseDate,
            task?.updatedAt,
            task?.lastUpdated,
            task?.invoiceLastUpdated,
            keyCreatedAt
        );
    }

    return wdActiveTaskFirstQueueTimestamp(
        historyTs,
        task?.statusQueueAt,
        task?.queueAt,
        task?.statusChangedAt,
        task?.statusUpdatedAt,
        task?.releaseDate,
        task?.updatedAt,
        task?.lastUpdated,
        task?.invoiceLastUpdated,
        keyCreatedAt
    );
}

function wdActiveTaskQueueTimestamp(task) {
    const status = String(task?.remarks || task?.status || '').trim();
    const keyCreatedAt = wdActiveTaskKeyCreatedTimestamp(task);
    const jobEnteredAt = wdActiveTaskJobEnteredTimestamp(task);

    // IMPORTANT: Date tabs must never use supplier invoice date (task.date / invoiceDate).
    // New Entry uses Job Records Date Entered; IPC uses Job Records; invoice statuses
    // use Invoice Entry status/history date.
    if (wdActiveTaskIsJobNewEntry(task, status)) {
        return wdActiveTaskFirstQueueTimestamp(
            jobEnteredAt,
            task?.jobRecordDateEntered,
            task?.originDateEntered,
            task?.dateEntered,
            task?.entryDate,
            task?.createdAt,
            task?.enteredAt,
            task?.dateAdded,
            task?.originTimestamp,
            task?.dateCreated,
            keyCreatedAt
        );
    }

    if (wdActiveTaskIsIPCQueue(task, status)) {
        return wdActiveTaskFirstQueueTimestamp(
            task?.ipcAt,
            task?.ipcQueueAt,
            task?.statusQueueAt,
            task?.queueAt,
            task?.statusChangedAt,
            task?.statusUpdatedAt,
            jobEnteredAt,
            task?.jobRecordDateEntered,
            task?.originDateEntered,
            task?.dateEntered,
            task?.entryDate,
            task?.jobRecordTimestamp,
            task?.originTimestamp,
            keyCreatedAt
        );
    }

    return wdActiveTaskInvoiceStatusTimestamp(task, status);
}

function wdActiveTaskDateKey(timestamp) {
    const ts = Number(timestamp || 0);
    if (!ts) return 'unknown';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'unknown';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function wdActiveTaskDateFromKey(key) {
    if (!key || key === 'unknown') return null;
    const parts = String(key).split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function wdActiveTaskDateLabel(key) {
    const d = wdActiveTaskDateFromKey(key);
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) : 'No Date';
}

function wdActiveTaskFullDateLabel(key) {
    const d = wdActiveTaskDateFromKey(key);
    return d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }) : 'Date not tracked';
}

function wdActiveTaskAgeText(timestamp) {
    const ts = Number(timestamp || 0);
    if (!ts) return 'not tracked';
    const days = Math.floor(Math.max(0, Date.now() - ts) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days`;
}

function wdActiveTaskBuildDateGroups(tasks) {
    const groups = new Map();
    (Array.isArray(tasks) ? tasks : []).forEach(task => {
        const queueTs = wdActiveTaskQueueTimestamp(task);
        const key = wdActiveTaskDateKey(queueTs);
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label: wdActiveTaskDateLabel(key),
                fullLabel: wdActiveTaskFullDateLabel(key),
                timestamp: queueTs || 0,
                tasks: []
            });
        }
        groups.get(key).tasks.push({ ...task, _activeQueueTimestamp: queueTs || 0 });
    });
    return Array.from(groups.values()).sort((a, b) => {
        if (a.key === 'unknown' && b.key !== 'unknown') return 1;
        if (b.key === 'unknown' && a.key !== 'unknown') return -1;
        return (a.timestamp || 0) - (b.timestamp || 0);
    });
}

function wdActiveTaskCompareQueue(a, b) {
    const qa = Number(a?._activeQueueTimestamp || wdActiveTaskQueueTimestamp(a) || 0);
    const qb = Number(b?._activeQueueTimestamp || wdActiveTaskQueueTimestamp(b) || 0);
    if (qa && qb && qa !== qb) return qa - qb;
    if (qa && !qb) return -1;
    if (!qa && qb) return 1;
    return (Number(a?.timestamp || 0) || 0) - (Number(b?.timestamp || 0) || 0);
}

function wdActiveTaskQueueFields(task, invMeta = {}) {
    const decodedCreatedAt = wdActiveTaskFirebasePushTimestamp(task?.originalKey || task?.invoiceKey || task?.key || invMeta?.key || '');
    const jobRecordDateEntered = task?.jobRecordDateEntered || task?.originDateEntered || task?.dateEntered || invMeta?.jobRecordDateEntered || invMeta?.originDateEntered || invMeta?.dateEntered || '';
    const jobRecordTimestamp = task?.jobRecordTimestamp || invMeta?.jobRecordTimestamp || invMeta?.originTimestamp || task?.originTimestamp || '';
    const createdAt = jobRecordDateEntered || task?.createdAt || invMeta?.createdAt || invMeta?.enteredAt || task?.enteredAt || task?.originTimestamp || invMeta?.originTimestamp || task?.dateAdded || invMeta?.dateAdded || decodedCreatedAt || '';
    const enteredAt = jobRecordDateEntered || task?.enteredAt || invMeta?.enteredAt || task?.createdAt || invMeta?.createdAt || task?.originTimestamp || invMeta?.originTimestamp || task?.dateAdded || invMeta?.dateAdded || decodedCreatedAt || '';
    const releaseDate = task?.releaseDate || invMeta?.releaseDate || '';
    const statusHistoryAt = wdActiveTaskInvoiceHistoryTimestamp({ ...task, history: task?.history || invMeta?.history }, task?.status || task?.remarks || invMeta?.status || '');
    const statusChangedAt = task?.statusChangedAt || task?.statusUpdatedAt || invMeta?.statusChangedAt || invMeta?.statusUpdatedAt || task?.queueAt || invMeta?.queueAt || releaseDate || '';
    const statusQueueAt = task?.statusQueueAt || invMeta?.statusQueueAt || statusHistoryAt || statusChangedAt || '';
    const queueAt = task?.queueAt || invMeta?.queueAt || statusQueueAt || createdAt || releaseDate || '';
    return {
        createdAt,
        enteredAt,
        dateAdded: task?.dateAdded || invMeta?.dateAdded || '',
        originTimestamp: task?.originTimestamp || invMeta?.originTimestamp || '',
        linkedJobEntryKey: task?.linkedJobEntryKey || invMeta?.linkedJobEntryKey || '',
        jobRecordDateEntered,
        originDateEntered: task?.originDateEntered || invMeta?.originDateEntered || jobRecordDateEntered || '',
        dateEntered: task?.dateEntered || invMeta?.dateEntered || jobRecordDateEntered || '',
        jobRecordTimestamp,
        releaseDate,
        statusChangedAt,
        statusUpdatedAt: task?.statusUpdatedAt || invMeta?.statusUpdatedAt || statusChangedAt || '',
        statusQueueAt,
        queueAt,
        forSrvAt: task?.forSrvAt || invMeta?.forSrvAt || '',
        sentToSrvAt: task?.sentToSrvAt || invMeta?.sentToSrvAt || '',
        srvRequestedAt: task?.srvRequestedAt || invMeta?.srvRequestedAt || '',
        history: task?.history || invMeta?.history || null,
        invoiceHistory: task?.invoiceHistory || invMeta?.history || null,
        invoiceLastUpdated: task?.invoiceLastUpdated || invMeta?.lastUpdated || invMeta?.updatedAt || invMeta?.enteredAt || 0
    };
}

window.wdSelectActiveTaskDateTab = function(dateKey) {
    wdActiveTaskSelectedDateKey = String(dateKey || '');
    wdActiveTaskSelectedDateStatus = String(currentActiveTaskFilter || '');
    if (typeof handleActiveTaskSearch === 'function') {
        const input = document.getElementById('active-task-search');
        handleActiveTaskSearch(input ? input.value : '');
    }
};

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
    if (isInventory) wdActiveTaskClearDateTabs();
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

    // 9.2.7: Active Task should not repeat Dashboard summary cards.
    // Dashboard remains the overview/control board; Active Task is only the
    // logged-in user's personal Attention-name task queue.
    const summaryStrip = document.getElementById('active-task-summary-strip');
    if (summaryStrip) summaryStrip.innerHTML = '';

    const statusFilteredTasks = workdeskTasks.filter(function(task) {
        if (currentActiveTaskFilter === 'All') return true;
        return task.remarks === currentActiveTaskFilter;
    });

    const dateTabsEl = wdActiveTaskEnableDateTabs();
    const dateGroups = wdActiveTaskBuildDateGroups(statusFilteredTasks);
    if (dateTabsEl) {
        if (!dateGroups.length) {
            wdActiveTaskClearDateTabs();
        } else {
            if (wdActiveTaskSelectedDateStatus !== String(currentActiveTaskFilter || '')) {
                wdActiveTaskSelectedDateKey = '';
                wdActiveTaskSelectedDateStatus = String(currentActiveTaskFilter || '');
            }
            if (!wdActiveTaskSelectedDateKey || !dateGroups.some(g => g.key === wdActiveTaskSelectedDateKey)) {
                wdActiveTaskSelectedDateKey = dateGroups[0].key;
            }
            const tabs = dateGroups.map(group => {
                const active = group.key === wdActiveTaskSelectedDateKey ? 'active' : '';
                const age = group.timestamp ? wdActiveTaskAgeText(group.timestamp) : '';
                return `
                    <button class="wd-date-tab ${active}" type="button" onclick="window.wdSelectActiveTaskDateTab('${wdUiEscape(group.key)}')" title="Show ${wdUiEscape(group.fullLabel)} tasks">
                        <span class="wd-date-tab-day">${wdUiEscape(group.label)}</span>
                        <span class="wd-date-tab-count">${group.tasks.length}</span>
                        ${age ? `<small>${wdUiEscape(age)}</small>` : ''}
                    </button>`;
            }).join('');
            dateTabsEl.innerHTML = `
                <div class="wd-active-date-tabs-head">
                    <span><i class="fa-regular fa-calendar-days"></i> Queue Date</span>
                    <small>Oldest date is selected first. You can still choose any date.</small>
                </div>
                <div class="wd-date-tabs-wrap" role="tablist" aria-label="Active task queue date filter">${tabs}</div>`;
        }
    }

    const selectedDateGroup = dateGroups.find(g => g.key === wdActiveTaskSelectedDateKey) || dateGroups[0];
    const filteredTasks = selectedDateGroup ? selectedDateGroup.tasks.slice().sort(wdActiveTaskCompareQueue) : [];

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
        const invoiceGroupText = (String(task.for || '').trim() === 'Invoice' && task.group) ? ` · Group: ${task.group}` : ''; 
        row.innerHTML =
            '<td class="desktop-only"><span class="wd-table-kicker">' + wdUiEscape(wdActiveTaskDisplayType(task) || '') + '</span></td>' +
            '<td class="desktop-only"><span class="wd-ref-chip">' + wdUiEscape(task.ref || '') + '</span></td>' +
            '<td class="desktop-only"><span class="wd-po-code">' + wdUiEscape(task.po || '') + '</span></td>' +
            '<td class="desktop-only"><strong class="wd-vendor-name">' + wdUiEscape(task.vendorName || 'N/A') + '</strong></td>' +
            '<td class="desktop-only wd-amount-cell">' + wdUiEscape(formatCurrency(displayAmount)) + '</td>' +
            '<td class="desktop-only"><span class="wd-site-badge"><i class="fa-solid fa-location-dot"></i>' + wdUiEscape(task.site || '') + '</span></td>' +
            '<td class="desktop-only"><span class="wd-date-chip">' + wdUiEscape(task.date || '') + '</span></td>' +
            '<td class="desktop-only"><div class="wd-note-cell">' + wdUiEscape(taskNote + invoiceGroupText) + '</div></td>' +
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
    const savedAt = Date.now();
    const userKey = wdActiveTaskCacheUserKey();
    try {
        window.IBA_ACTIVE_TASK_LAST_MODE = mode;
        window.IBA_ACTIVE_TASK_LOADED_AT = savedAt;
        if (mode === 'workdesk' && Array.isArray(tasks)) {
            window.sessionStorage.setItem('IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V3', JSON.stringify({
                userKey,
                savedAt,
                tasks: tasks
            }));
        }
    } catch (e) {
        // Storage can fail in private mode. Never block task rendering.
    } finally {
        // 9.7.6: Let WorkDesk Dashboard reuse the exact Active Task result instead
        // of rebuilding from another heavy source. This keeps Dashboard and Active
        // Task in sync after deletes/completions while avoiding extra full reads.
        try {
            window.dispatchEvent(new CustomEvent('iba:active-tasks-updated', {
                detail: {
                    mode,
                    userKey,
                    savedAt,
                    count: Array.isArray(tasks) ? tasks.length : 0
                }
            }));
        } catch (_) { /* ignore */ }
    }
}


function wdActiveTaskSafeFirebaseKey(value) {
    return String(value || '').trim().replace(/[.#$\[\]\/\\]/g, '_').replace(/\s+/g, '_');
}

function wdActiveTaskStatusFromLookup(task = {}) {
    const raw = task.status || task.remarks || task.Status || task.Remarks || '';
    if (typeof wdActiveTaskInvoiceStatusLabel === 'function') return wdActiveTaskInvoiceStatusLabel(raw);
    return String(raw || '').trim();
}

function wdActiveTaskIsInactiveInvoiceStatus(status) {
    const raw = String(status || '').trim().toLowerCase();
    if (!raw) return true;
    return raw === 'under review' ||
        raw === 'with accounts' ||
        raw === 'srv done' ||
        raw === 'paid' ||
        raw === 'closed' ||
        raw === 'cancelled' ||
        raw === 'canceled' ||
        raw === 'completed' ||
        raw === 'done' ||
        raw.includes('with accounts') ||
        raw.includes('srv done') ||
        raw.includes('closed') ||
        raw.includes('cancel');
}

function wdActiveTaskNormalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ');
}

function wdActiveTaskAttentionMentionsName(attentionVal, nameVal) {
    const attention = wdActiveTaskNormalizeName(attentionVal);
    const name = wdActiveTaskNormalizeName(nameVal);
    if (!attention || !name) return false;
    if (attention === name) return true;
    const parts = attention
        .split(/\s*(?:,|;|\/|\||&|\+|->|➔|\band\b|\bor\b)\s*/i)
        .map(v => wdActiveTaskNormalizeName(v))
        .filter(Boolean);
    if (parts.includes(name)) return true;
    return attention.includes(name) || name.includes(attention);
}

async function wdActiveTaskRemoveLookupRow(ownerName, invoiceKey) {
    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref || !invoiceKey) return;
        const safeOwner = wdActiveTaskSafeFirebaseKey(ownerName);
        const removals = [];
        if (safeOwner) removals.push(invoiceDb.ref(`invoice_tasks_by_user/${safeOwner}/${invoiceKey}`).remove());
        removals.push(invoiceDb.ref(`invoice_tasks_by_user/All/${invoiceKey}`).remove());
        await Promise.allSettled(removals);
    } catch (_) { /* do not block UI */ }
}

async function wdActiveTaskValidateLookupSource(task = {}, ownerName = '', invoiceKey = '') {
    const poNumber = String(task.po || task.originalPO || '').trim();
    const key = String(invoiceKey || task.originalKey || '').trim();
    if (!poNumber || !key || typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) {
        return null;
    }

    const normalizeCandidate = (v) => wdActiveTaskNormalizeName(v);
    const candidateMatches = (inv = {}, sourceKey = '') => {
        const invoiceCandidates = [
            sourceKey,
            inv.key,
            inv.invoiceKey,
            inv.originalKey,
            inv.invEntryID,
            inv.entryId,
            inv.entryID,
            inv.invNumber,
            inv.invoiceNo,
            inv.invoiceNumber,
            inv.ref
        ].map(normalizeCandidate).filter(Boolean);
        const taskCandidates = [
            key,
            task.originalKey,
            task.invoiceKey,
            task.key,
            task.invEntryID,
            task.entryId,
            task.entryID,
            task.ref,
            task.invNumber,
            task.invoiceNo,
            task.invoiceNumber
        ].map(normalizeCandidate).filter(Boolean);
        return invoiceCandidates.some(a => taskCandidates.some(b => a === b));
    };

    try {
        let latest = null;
        let sourceKey = key;
        const snap = await invoiceDb.ref(`invoice_entries/${poNumber}/${key}`).once('value');
        latest = snap.val();

        // 10.2.7: Some older lightweight inbox rows use invoice number/entry id
        // as the lookup key instead of the actual invoice_entries child key. Search
        // within the PO before deciding an active On Hold task is stale.
        if (!latest || typeof latest !== 'object') {
            const poSnap = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
            const invoices = poSnap.val() || {};
            for (const candidateKey of Object.keys(invoices)) {
                const inv = invoices[candidateKey] || {};
                if (candidateMatches(inv, candidateKey)) {
                    latest = inv;
                    sourceKey = candidateKey;
                    break;
                }
            }
        }

        if (!latest || typeof latest !== 'object') {
            await wdActiveTaskRemoveLookupRow(ownerName, key);
            return null;
        }

        const latestStatus = wdActiveTaskStatusFromLookup(latest);
        const activeByHelper = (typeof isInvoiceTaskActive === 'function')
            ? isInvoiceTaskActive(latest)
            : !wdActiveTaskIsInactiveInvoiceStatus(latestStatus);
        if (!activeByHelper || wdActiveTaskIsInactiveInvoiceStatus(latestStatus)) {
            await wdActiveTaskRemoveLookupRow(ownerName, key);
            return null;
        }

        const latestAttention = latest.attention || latest.Attention || latest.assignedTo || '';
        if (!latestAttention) {
            await wdActiveTaskRemoveLookupRow(ownerName, key);
            return null;
        }

        // Personal Active Task must follow source-of-truth Attention. If this
        // lightweight inbox row is under an old user, hide and clean that row.
        if (ownerName && !wdActiveTaskAttentionMentionsName(latestAttention, ownerName)) {
            await wdActiveTaskRemoveLookupRow(ownerName, key);
            return null;
        }

        return {
            ...task,
            ...latest,
            originalKey: sourceKey || key,
            lookupKey: key,
            originalPO: poNumber,
            po: poNumber,
            attention: latestAttention,
            status: latestStatus,
            remarks: latestStatus,
            invoiceLastUpdated: latest.invoiceLastUpdated || latest.lastUpdated || latest.updatedAt || latest.statusChangedAt || task.invoiceLastUpdated || 0
        };
    } catch (e) {
        console.warn('Active Task could not validate invoice task source:', e);
        // Fail closed for accuracy: do not show an invoice task that cannot be
        // confirmed from invoice_entries. User can refresh after connection recovers.
        return null;
    }
}

async function wdLoadPersonalInvoiceLookupTasksForActiveTask(names = [], forceRefresh = false) {
    const result = [];
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return result;

    const uniqueNames = Array.from(new Set((names || []).map(n => String(n || '').trim()).filter(Boolean)));
    const cacheKey = `IBA_ACTIVE_INVOICE_LOOKUP_V1:${uniqueNames.map(wdActiveTaskSafeFirebaseKey).join('|')}`;
    const maxAge = 0; // 10.2.6: accuracy first; always re-read the small lookup index, then validate source invoice.

    try {
        if (!forceRefresh && window.sessionStorage) {
            const raw = window.sessionStorage.getItem(cacheKey);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved && Array.isArray(saved.tasks) && (Date.now() - Number(saved.savedAt || 0)) < maxAge) {
                    return saved.tasks;
                }
            }
        }
    } catch (_) { /* ignore cache errors */ }

    try {
        const snapshots = await Promise.all(uniqueNames.map(async (name) => {
            const safeKey = wdActiveTaskSafeFirebaseKey(name);
            if (!safeKey) return { name, safeKey, data: {} };
            const snap = await invoiceDb.ref(`invoice_tasks_by_user/${safeKey}`).once('value');
            return { name, safeKey, data: snap.val() || {} };
        }));

        const seen = new Set();
        for (const bucket of snapshots) {
            const inbox = bucket.data || {};
            for (const invoiceKey in inbox) {
                const task = inbox[invoiceKey] || {};
                if (!task || typeof task !== 'object') continue;
                const poNumber = String(task.po || task.originalPO || '').trim();
                const uniqueKey = `${poNumber}_${invoiceKey}`;
                if (seen.has(uniqueKey)) continue;
                seen.add(uniqueKey);

                const validatedTask = await wdActiveTaskValidateLookupSource(task, bucket.name, invoiceKey);
                if (!validatedTask) continue;

                const invoiceStatus = wdActiveTaskStatusFromLookup(validatedTask);
                if (!invoiceStatus || wdActiveTaskIsInactiveInvoiceStatus(invoiceStatus)) continue;

                const poDetails = (typeof allPOData !== 'undefined' && allPOData && poNumber && allPOData[poNumber]) ? allPOData[poNumber] : {};
                const site = validatedTask.site || validatedTask.siteName || validatedTask.projectName || poDetails['Project ID'] || poDetails['Project ID:'] || 'N/A';
                const effAttention = validatedTask.attention || bucket.name;
                const queueFields = (typeof wdActiveTaskQueueFields === 'function') ? wdActiveTaskQueueFields({}, validatedTask) : {};

                result.push({
                    key: uniqueKey,
                    originalKey: invoiceKey,
                    originalPO: poNumber,
                    source: 'invoice',
                    for: 'Invoice',
                    ref: validatedTask.ref || validatedTask.invNumber || validatedTask.invoiceNo || '',
                    invEntryID: validatedTask.invEntryID || validatedTask.entryId || '',
                    po: poNumber,
                    amount: validatedTask.amount || validatedTask.invValue || validatedTask.invoiceValue || '',
                    amountPaid: validatedTask.amountPaid || validatedTask.paidAmount || validatedTask.amount || validatedTask.invValue || validatedTask.invoiceValue || '',
                    site,
                    group: task.group || 'N/A',
                    attention: effAttention,
                    enteredBy: validatedTask.enteredBy || validatedTask.updatedBy || 'Accounting',
                    date: typeof formatYYYYMMDD === 'function' ? formatYYYYMMDD(validatedTask.invoiceDate || validatedTask.invDate || '') : (validatedTask.invoiceDate || validatedTask.invDate || ''),
                    invoiceDate: typeof formatYYYYMMDD === 'function' ? formatYYYYMMDD(validatedTask.invoiceDate || validatedTask.invDate || '') : (validatedTask.invoiceDate || validatedTask.invDate || ''),
                    ...queueFields,
                    remarks: invoiceStatus,
                    status: invoiceStatus,
                    timestamp: (typeof wdActiveTaskQueueTimestamp === 'function') ? (wdActiveTaskQueueTimestamp({ ...validatedTask, ...queueFields, remarks: invoiceStatus, status: invoiceStatus }) || 0) : (Number(validatedTask.timestamp || validatedTask.lastUpdated || 0) || 0),
                    invName: validatedTask.invName || '',
                    vendorName: validatedTask.vendorName || validatedTask.vendor || poDetails['Supplier Name'] || poDetails['Supplier Name:'] || poDetails['Supplier'] || poDetails['Supplier:'] || 'N/A',
                    note: validatedTask.note || validatedTask.details || '',
                    isUrgent: !String(invoiceStatus || '').toLowerCase().includes('on hold')
                });
            }
        }

        try {
            if (window.sessionStorage) window.sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), tasks: result }));
        } catch (_) { /* ignore cache errors */ }
    } catch (e) {
        console.warn('Active Task could not load lightweight invoice lookup:', e);
    }

    return result;
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

// 9.2.7: WorkDesk Active Task must be personal. If the logged-in
// user's name is mentioned in Attention, show/count/blink it for them.
// Site, position, and broad department visibility are for Dashboard only.
const _attentionMentionsName = (attentionVal, nameVal) => {
    const attention = _norm(attentionVal);
    const name = _norm(nameVal);
    if (!attention || !name) return false;
    if (['all', 'site', 'accounting', 'accounts', 'finance'].includes(attention)) return false;
    if (attention === name) return true;

    // Handle multi-name Attention values such as "Irwin / Hafiz",
    // "Irwin, Hafiz", "Irwin & Hafiz", etc.
    const parts = attention
        .split(/\s*(?:,|;|\/|\||&|\+|->|➔|\band\b|\bor\b)\s*/i)
        .map(v => v.trim())
        .filter(Boolean);
    if (parts.includes(name)) return true;

    // Safer fallback for names with middle/last-name differences.
    const nameParts = name.split(/\s+/).filter(Boolean);
    if (nameParts.length >= 2 && nameParts.every(part => attention.includes(part))) return true;

    return false;
};

const isDirectAttentionForUser = (attentionVal) => _attentionMentionsName(attentionVal, currentUserName);
const isAttentionForMeOrDelegated = (attentionVal) => {
    if (isDirectAttentionForUser(attentionVal)) return true;
    return delegatedFromNames.some(name => _attentionMentionsName(attentionVal, name));
};

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
        const isQS = userPositionLower === 'qs' || userPositionLower === 'senior qs';
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

        // 10.2.9: Accuracy restore for invoice queues.
        // Active Task must use invoice_entries as source of truth for For SRV, On Hold,
        // Pending, Report, In Process, and Unresolved. The lightweight
        // invoice_tasks_by_user index can be stale/missing after Invoice Management updates,
        // so it must not drive WorkDesk personal task visibility.
        // 10.4.9: Active Task New Entry must include recent Reception-added rows.
        // Use a short forced-refresh window for WorkDesk job_entries only; do not rely
        // on the longer global systemEntries cache when the user returns to Active Task.
        const forceWorkdeskSourceRefresh = wdActiveTaskShouldRefreshWorkdeskSource(forceRefresh, isInventoryPage);
        await ensureAllEntriesFetched(forceWorkdeskSourceRefresh, { mode: isInventoryPage ? 'inventory' : 'workdesk' });
        if (!isInventoryPage) wdActiveTaskWorkdeskLastFreshLoadAt = Date.now();

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
            
            if ((entry.for === 'IPC' || entry.for === 'IPC Application') && isQS && isMeOrDelegated(entry.attention)) return true;
            
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
            return {
                ...task,
                displayFor: wdActiveTaskDisplayType(task),
                source: source,
                jobRecordDateEntered: task.date || '',
                dateEntered: task.date || '',
                jobRecordTimestamp: task.timestamp || '',
                note: task.note || task.details || task.currentNote || '',
                isUrgent: isUrgent,
                remarks: displayStatus
            };
        });

        // --- B. INVOICE QUEUES FROM SOURCE-OF-TRUTH ---
        // 10.2.9: Restored from invoice_entries so For SRV / On Hold / Pending
        // remain accurate immediately after Invoice Management updates.
        if (!isInventoryPage && allInvoiceData) { 
            
            const accStatuses = ['For SRV', 'On Hold', 'In Process', 'Pending', 'Unresolved', 'Report'];
            const siteStatuses = ['For SRV'];

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
                    const invoiceStatus = wdActiveTaskInvoiceStatusLabel(inv.status || inv.remarks || inv.Status || inv.Remarks);
                    if (!invoiceStatus) continue;
	                    const poSite = (poSiteFromPO && poSiteFromPO !== 'N/A')
	                        ? poSiteFromPO
	                        : (inv.site_name || inv.site || inv.siteName || 'N/A');
                    let shouldShow = false;
                    let isUrgent = false;

                    // 1. Accounting/Admin Visibility
                    if ((isAccounting || isAdmin) && accStatuses.includes(invoiceStatus)) {
                        shouldShow = true;
                        isUrgent = false; 
                    }

                    // 2. Site Visibility: site users receive For SRV from invoice_entries.
                    if (siteStatuses.includes(invoiceStatus)) {
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
    isUrgent = invoiceStatus !== 'On Hold';
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
                            date: formatYYYYMMDD(inv.invoiceDate), // supplier invoice date only
                            invoiceDate: formatYYYYMMDD(inv.invoiceDate),
                            ...wdActiveTaskQueueFields({}, inv),
                            remarks: invoiceStatus,
                            status: invoiceStatus,
                            timestamp: wdActiveTaskQueueTimestamp({ ...inv, ...wdActiveTaskQueueFields({}, inv), remarks: invoiceStatus, status: invoiceStatus }) || 0,
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
            // 9.2.7: WorkDesk Active Task = My Attention tasks only.
            // Do not show broad Accounting/Admin/Site/All tasks here; those remain
            // visible in the Dashboard overview according to the existing dashboard rules.
            userTasks = userTasks
                .filter(t => isWorkdeskTaskRecord(t))
                .filter(t => isAttentionForMeOrDelegated(t.attention))
                .map(t => ({
                    ...t,
                    isUrgent: !String(t.status || t.remarks || '').toLowerCase().includes('on hold')
                }));
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

	        userActiveTasks = userTasks.sort(wdActiveTaskCompareQueue);
        wdSaveActiveTaskSessionSnapshot(isInventoryPage ? 'inventory' : 'workdesk', userActiveTasks);
        const totalTaskCount = userActiveTasks.length;
        const urgentCount = userActiveTasks.filter(t => t.isUrgent === true).length;

        if (activeTaskCountDisplay) {
            activeTaskCountDisplay.textContent = isInventoryPage
                ? `(Action: ${urgentCount} | Records: ${totalTaskCount})`
                : '';
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
        fontWeight = '700';
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
