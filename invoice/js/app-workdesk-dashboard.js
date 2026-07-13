/* ==========================================================================
   js/app-workdesk-dashboard.js
   IBA WorkDesk Dashboard Active Task Control Center
   Version: 10.8.4

   8.3.6:
   - Replaced the old WorkDesk calendar/date dashboard with a clean view-only
     control center for invoice-related entries that are not yet complete.
   - "With Accounts" is treated as complete and excluded from this dashboard.
   - Shows status cards and a professional task list with PO, vendor, site,
     status, note, IPC indicator, invoice PDF, and report PDF.
   - Visibility: management/office roles see all; User/non-admin accounts see only assigned site(s).
   - No invoice save/update, approval, SRV, report, payment, Firebase write, or
     inventory logic is changed here.

   8.3.7:
   - Access simplified: accounts with Role containing "Admin" see all sites.
   - User/non-admin accounts see only entries matching their assigned site(s).
   - Position labels such as Site Engineer, QS, Senior QS, Finance, Accounts,
     Procurement, or Manager no longer grant all-site dashboard access unless
     their Role is Admin.

   8.3.8:
   - Visual polish: replaced the plain grid/table feeling with a modern command-board
     layout, stronger KPI cards, premium task cards, clearer note/IPC/document zones,
     and better mobile readability. Display only; no save/update logic changed.

   8.3.9:
   - New Entry now uses open WorkDesk Invoice job entries from Active Task/Job Records
     even when an invoice record already exists, so new reception entries do not disappear.
   - Replaced the separate For IPC/IPC Active card behavior with one clean IPC card
     powered by open WorkDesk IPC job records. Admins can quickly see IPC-ready jobs
     and inform suppliers to submit invoices.
   - Header title contrast adjusted through CSS. Display only; no write logic changed.

   8.4.0:
   - Data-source correction: dashboard now builds its invoice queue from the same
     WorkDesk Active Task source/list, then adds IPC Job Records only. It no longer
     rebuilds a separate invoice list from allInvoiceData, preventing wrong counts.
   - For IPC is not shown as a separate active-invoice card; IPC comes from Job Records.
   - Display only; no save/update/write logic changed.

   8.4.1:
   - Dashboard card layout balance: reduced Note area weight and gave more room to
     IPC status so IPC text is easier to read. Display/style only.

   8.5.1:
   - Firebase efficiency: dashboard now uses a short per-user browser cache and
     existing Active Task memory before calling populateActiveTasks again.
   - Manual Refresh still forces a live reload when the user needs the newest board.
   - Display/data-source only; no invoice save/update/write logic changed.


   8.9.3:
   - Safety fix: IPC dashboard cards are rebuilt from live Job Records even when
     the Active Task source is served from the short browser/session snapshot.
   - This prevents IPC Job Records from disappearing from the WorkDesk dashboard
     after CSS-only/version updates or when cached dashboard data is stale.

   9.2.7:
   - Dashboard overview is independent again from the personal Active Task queue.
   - Active Task stays user-attention-only, but Dashboard rebuilds open WorkDesk invoice
     process items from Job Records and Invoice Records so unassigned/on-hold/process
     items remain visible in the system preview.
   - Display/data-source only; no Firebase write/workflow logic changed.

   9.3.3:
   - Dashboard split corrected: Admin/Super Admin can see My Personal Tasks plus All Active
     Tasks; User accounts see only their own personal Attention tasks.
   - All Active Tasks excludes tasks assigned to the logged-in user so the same task does
     not duplicate between Personal and All Active for that user.
   - IPC Job Records are counted record-by-record without collapsing by PO and without
     hiding waiting/signature-style open IPC items.

   9.3.7:
   - All Active Tasks no longer counts stale full invoice records directly. It uses the
     invoice task lookup + open Job Records + IPC Job Records so dashboard counts match
     the task queues more closely. For SRV should no longer inflate from old invoice data.
   - All Active still excludes tasks assigned to the logged-in user.
   - IPC Job Records use a per-row fallback id so same-PO IPC items do not collapse.

   9.4.6:
   - Removed the All Active total-count card from the WorkDesk All Active Tasks section.
   - Status cards remain visible and the dashboard list can still show all active tasks.

   9.4.7:
   - Fixed normal/User dashboard personal card clicks. My Personal Task status cards now
     filter the below list by selected personal status (For SRV, On Hold, Pending, etc.).
   - Admin/Super Admin All Active behavior remains unchanged.

   9.4.8:
   - Firebase read optimization for WorkDesk Dashboard. Normal/User accounts now build
     only My Personal Tasks and skip the wider All Active overview reads.
   - Dashboard no longer auto-renders the below task list on open; user must click a
     status card first. This reduces immediate screen work and avoids accidental list loads.
   - WorkDesk Dashboard IPC job source reads job_entries only and no longer triggers
     a full transfer_entries read through ensureAllEntriesFetched.
   - Display/data-read only; no Firebase write/workflow logic changed.

   9.7.2:
   - Added clean queue-age guidance for New Entry and For SRV tasks.
   - Task lists now sort older queue items first while still allowing users to open any task.
   - Shows Invoice Date separately from Entered / Sent to SRV timing so priority is clearer.
   - Display/sort only; no Firebase write/workflow logic changed.

   9.7.3:
   - Replaced the queue-age chip layout with clean date tabs for selected dashboard queues.
   - Users can click date tabs such as Jun 30 / Jul 01 and see only that date's entries.
   - Default date tab is the oldest queue date so the system still guides priority without forcing order.

   10.3.2:
   - Role-based Dashboard download reduction. Normal/User accounts now remain strictly
     attention-oriented and no longer subscribe to the global invoice_tasks_by_user/All
     lookup while on Dashboard. Admin/Super Admin keep the full Dashboard with All Active
     overview and global sorting.
   - Personal task sorting remains available only inside the user's own assigned queue.
   - Display/read optimization only; no workflow, Firebase path, or invoice save logic changed.

   10.3.3:
   - Admin/Super Admin Dashboard All Active is now lazy-loaded. Dashboard opens with
     My Personal Tasks and lightweight All Active load buttons only; global overview data
     is fetched only after an Admin clicks an All Active status card.
   - The dashboard root listener for invoice_tasks_by_user is disabled by default to avoid
     background global downloads. Manual/card refresh keeps accuracy on demand.
   - Download optimization only; no workflow, Firebase path, or invoice save logic changed.


   10.5.8:
   - WorkDesk Dashboard now keeps a day/session browser snapshot, shows cached counts as
     cached/updating instead of fake zeroes, and starts a lightweight recent-change sync
     on every Dashboard open plus every 30 seconds while visible.
   - Recent sync reads the small workdesk_dashboard_recent index written by invoice updates
     and merges/removes changed invoice tasks by PO + invoice key instead of redownloading
     the whole invoice_entries tree.

   10.6.0:
   - Dashboard now writes a verified All Active browser cache as soon as the exact
     All Active dataset finishes loading in the background. First-open cards and
     clicked-card details use the same verified source instead of different preview
     counts, preventing count changes only after an Admin clicks a card.

   10.8.4:
   - Added For Approval to WorkDesk Dashboard active queues.
   - For Approval uses normal site-card grouping.

   11.0.0:
   - Dashboard global search remains flexible/contains-based, but search mode now
     always groups matching results by Site, including For Summary records. Direct
     For Summary clicks still keep the existing vendor grouping.
   - Added Dashboard Clear behavior to reset search text, selected status card,
     selected site/vendor card, highlighted categories, and the yellow-note area.
   - In global search mode, All Active category cards highlight only the categories
     present in the current result/site selection and grey out unrelated categories.

   11.0.4:
   - Dashboard Job Record cache can now be overwritten/removed by Firebase job key.
   - This prevents stale IPC Application dashboard copies when the same record moves
     to IPC Processed in another open browser.
   ========================================================================== */

// =================================================================================================
// #region BLOCK 12 — WORKDESK DASHBOARD CONTROL CENTER + REPORTS
// Purpose: WorkDesk dashboard counts/list for incomplete invoice tasks + clean Job Records CSV export.
// 11.2.1: Stable Dashboard counts - never blank All Active cards during background refresh.
// =================================================================================================

let wdActiveDashboardTasks = [];
let wdPersonalDashboardTasks = [];
let wdActiveDashboardSelectedStatus = '__NONE__';
let wdActiveDashboardSelectedQueueDate = '';
let wdAllActiveCorkboardSelectedSiteKey = '';
let wdActiveDashboardCacheMeta = { fromCache: false, savedAt: 0 };
let wdDashboardJobEntriesCache = { entries: [], savedAt: 0 };
let wdInvoiceTaskLookupLiveCache = { nodes: null, savedAt: 0, scope: '' };
let wdDashboardLiveSyncStarted = false;
let wdDashboardLiveSyncTimer = null;
let wdDashboardTaskLookupRootRef = null;
let wdDashboardTaskLookupPersonalRef = null;
let wdDashboardTaskLookupAllRef = null;
let wdAllActiveDashboardLoaded = false;
let wdAllActiveDashboardLoading = false;
let wdAllActiveDashboardCountsLoaded = false;
let wdAllActiveDashboardCountsLoading = false;
let wdAllActiveDashboardCountMap = new Map();
let wdAllActiveDashboardCountSavedAt = 0;
let wdAllActiveDashboardCountItemsMap = new Map();
// 11.1.9: prevent repeated live/force refresh from wiping count cards to dash.
let wdPopulateDashboardRunning = false;
let wdDashboardLastSoftSyncAt = 0;
const WD_DASHBOARD_SOFT_SYNC_MIN_MS = 10000;
let wdDashboardRecentSyncTimer = null;
let wdDashboardRecentSyncRunning = false;
let wdDashboardVerifiedRefreshRunning = false;
let wdDashboardLastRecentSyncAt = 0;

// 8.5.1: Keep the WorkDesk Dashboard self-sufficient for short periods.
// It prevents repeated Firebase downloads when users switch pages or reopen the dashboard.
// Manual Refresh still bypasses this cache and gets fresh live data.
const WD_DASHBOARD_CACHE_KEY = 'IBA_WD_ACTIVE_DASHBOARD_CACHE_V17';
const WD_ACTIVE_TASK_SOURCE_CACHE_KEY = 'IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V3';
const WD_DASHBOARD_CACHE_TTL = 24 * 60 * 60 * 1000; // 10.5.8: day/session cache; recent sync repairs changes on open/interval.
const WD_DASHBOARD_COUNT_CACHE_TTL = 24 * 60 * 60 * 1000;
const WD_DASHBOARD_RECENT_SYNC_INTERVAL = 30 * 1000;
const WD_DASHBOARD_RECENT_SYNC_OVERLAP = 2 * 60 * 1000;

const WD_DASHBOARD_NONE = '__NONE__';
const WD_DASHBOARD_ALL = '__ALL__';
const WD_DASHBOARD_STATUS_PREFIX = '__STATUS__::';
const WD_DASHBOARD_PERSON_PREFIX = '__PERSON__::';
const WD_DASHBOARD_MY_STATUS_PREFIX = '__MY_STATUS__::';
const WD_COMPLETED_STATUSES = new Set([
    'with accounts',
    'paid',
    'closed',
    'cancelled',
    'canceled',
    'completed',
    'done',
    'deleted'
]);

const WD_STATUS_ORDER = [
    'New Entry',
    'For SRV',
    'For IPC',
    'Pending',
    'On Hold',
    'In Process',
    'For Summary',
    'Retention',
    'For Approval',
    'Unresolved',
    'IPC Application',
    'IPC Processed',
    'IPC',
    'Report'
];

const WD_DASHBOARD_ALLOWED_BUCKETS = new Set([
    'new entry',
    'for srv',
    'pending',
    'on hold',
    'in process',
    'for summary',
    'retention',
    'for approval',
    'unresolved',
    'ipc application',
    'ipc processed',
    'ipc',
    'waiting invoice',
    'ipc issue',
    'report'
]);

const WD_DASHBOARD_LAZY_ADMIN_STATUSES = [
    'New Entry',
    'For SRV',
    'Pending',
    'On Hold',
    'In Process',
    'For Summary',
    'Retention',
    'For Approval',
    'Unresolved',
    'IPC Application',
    'IPC Processed',
    'Report'
];

// 11.2.5: These are the fixed WorkDesk All Active command-board cards.
// Keep them visible even when the current count is zero, so important queues
// like IPC Application / IPC Processed do not disappear after count refresh.
const WD_DASHBOARD_FIXED_ALL_ACTIVE_CARDS = [
    'New Entry',
    'For SRV',
    'Pending',
    'On Hold',
    'In Process',
    'For Summary',
    'Retention',
    'For Approval',
    'Unresolved',
    'IPC Application',
    'IPC Processed',
    'Report'
];

function wdText(value, fallback = '') {
    const str = String(value ?? '').trim();
    return str || fallback;
}

function wdSafe(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value ?? '');
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function wdNormalize(value) {
    return String(value || '').trim().toLowerCase();
}

function wdDashboardUserCacheKey() {
    return [
        wdNormalize(currentApprover?.Name || ''),
        wdNormalize(currentApprover?.Role || currentApprover?.role || ''),
        wdNormalize(currentApprover?.Site || currentApprover?.site || '')
    ].join('|');
}

function wdCacheAgeText(savedAt) {
    const ageMs = Math.max(0, Date.now() - Number(savedAt || 0));
    const mins = Math.floor(ageMs / 60000);
    if (mins <= 0) return 'just now';
    if (mins === 1) return '1 min ago';
    return `${mins} mins ago`;
}

function wdReadJSONStorage(storage, key) {
    try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function wdWriteJSONStorage(storage, key, value) {
    try {
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false;
    }
}

function wdIsDashboardVisible() {
    const section = document.getElementById('wd-dashboard');
    if (!section) return false;
    return !section.classList.contains('hidden') && section.offsetParent !== null;
}

function wdCurrentSafeUserTaskKey() {
    const name = wdText(currentApprover?.Name || currentApprover?.name || '');
    return name ? wdSanitizeFirebaseKey(name) : '';
}

function wdSetInvoiceTaskLookupLiveCache(nodes, scope) {
    wdInvoiceTaskLookupLiveCache = {
        nodes: (nodes && typeof nodes === 'object') ? nodes : {},
        savedAt: Date.now(),
        scope: scope || 'unknown'
    };
}

function wdGetLiveInvoiceTaskLookupNodes(forceRefresh = false) {
    if (forceRefresh) return null;
    if (!wdInvoiceTaskLookupLiveCache || !wdInvoiceTaskLookupLiveCache.nodes) return null;
    if ((Date.now() - Number(wdInvoiceTaskLookupLiveCache.savedAt || 0)) > (10 * 60 * 1000)) return null;
    return wdInvoiceTaskLookupLiveCache.nodes;
}

function wdLoadDashboardCache() {
    const cached = wdReadJSONStorage(window.localStorage, WD_DASHBOARD_CACHE_KEY);
    if (!cached || !Array.isArray(cached.tasks)) return null;
    if (cached.userKey !== wdDashboardUserCacheKey()) return null;
    if ((Date.now() - Number(cached.savedAt || 0)) > WD_DASHBOARD_CACHE_TTL) return null;
    return cached;
}

function wdSaveDashboardCache(tasks, personalTasks, meta = {}) {
    if (!Array.isArray(tasks)) return;
    const now = Date.now();
    wdWriteJSONStorage(window.localStorage, WD_DASHBOARD_CACHE_KEY, {
        userKey: wdDashboardUserCacheKey(),
        savedAt: now,
        tasks,
        personalTasks: Array.isArray(personalTasks) ? personalTasks : [],
        allActiveVerified: meta.allActiveVerified === true,
        verifiedAt: meta.allActiveVerified === true ? (meta.verifiedAt || now) : 0,
        reason: meta.reason || ''
    });
}

function wdDashboardCacheHasVerifiedAllActive(cached) {
    return !!(
        wdCanSeeAllActiveDashboard() &&
        cached &&
        cached.allActiveVerified === true &&
        Array.isArray(cached.tasks) &&
        (Date.now() - Number(cached.savedAt || 0)) <= WD_DASHBOARD_CACHE_TTL
    );
}

function wdClearDashboardCache() {
    try { window.localStorage.removeItem(WD_DASHBOARD_CACHE_KEY); } catch (e) { /* ignore */ }
    try { window.localStorage.removeItem('IBA_WD_ALL_ACTIVE_COUNT_CACHE_V1'); } catch (e) { /* ignore */ }
}

function wdNormalizeDashboardJobEntry(key, entry = {}) {
    return { ...(entry || {}), key, source: 'job_entry' };
}

function wdUpsertDashboardJobEntryCache(key, entry = {}) {
    if (!key) return;
    const normalized = wdNormalizeDashboardJobEntry(key, entry);
    const existing = Array.isArray(wdDashboardJobEntriesCache.entries) ? wdDashboardJobEntriesCache.entries : [];
    wdDashboardJobEntriesCache = {
        entries: existing.filter(item => String(item?.key || '') !== String(key)).concat([normalized]),
        savedAt: Date.now()
    };
    try {
        if (Array.isArray(workdeskSystemEntries)) {
            workdeskSystemEntries = workdeskSystemEntries.filter(item => String(item?.key || '') !== String(key)).concat([normalized]);
        }
    } catch (_) {}
    try {
        if (Array.isArray(allSystemEntries)) {
            allSystemEntries = allSystemEntries.filter(item => !(item && item.source === 'job_entry' && String(item.key || '') === String(key))).concat([normalized]);
        }
    } catch (_) {}
}

function wdRemoveDashboardJobEntryCache(key) {
    if (!key) return;
    const sameKey = (item) => String(item?.key || '') === String(key);
    wdDashboardJobEntriesCache = {
        entries: (Array.isArray(wdDashboardJobEntriesCache.entries) ? wdDashboardJobEntriesCache.entries : []).filter(item => !sameKey(item)),
        savedAt: Date.now()
    };
    wdActiveDashboardTasks = (Array.isArray(wdActiveDashboardTasks) ? wdActiveDashboardTasks : []).filter(task => !(String(task?.key || '') === String(key) && wdNormalize(task?.source || '').includes('job')));
    wdPersonalDashboardTasks = (Array.isArray(wdPersonalDashboardTasks) ? wdPersonalDashboardTasks : []).filter(task => !(String(task?.key || '') === String(key) && wdNormalize(task?.source || '').includes('job')));
    try { if (Array.isArray(workdeskSystemEntries)) workdeskSystemEntries = workdeskSystemEntries.filter(item => !sameKey(item)); } catch (_) {}
    try { if (Array.isArray(allSystemEntries)) allSystemEntries = allSystemEntries.filter(item => !(item && item.source === 'job_entry' && sameKey(item))); } catch (_) {}
    try { wdAllActiveDashboardCountItemsMap.delete(`job|${wdNormalize(key)}`); } catch (_) {}
}

// 8.5.2: Public safe cache clearer for save/update flows that change task buckets
// such as converting an IPC Job Record to an Invoice Job Record.
function wdClearWorkdeskDashboardCache() {
    wdClearDashboardCache();
    try { window.sessionStorage.removeItem(WD_ACTIVE_TASK_SOURCE_CACHE_KEY); } catch (e) { /* ignore */ }
    wdDashboardJobEntriesCache = { entries: [], savedAt: 0 };
    wdInvoiceTaskLookupLiveCache = { nodes: null, savedAt: 0, scope: '' };
    wdActiveDashboardCacheMeta = { fromCache: false, savedAt: 0 };
    wdPersonalDashboardTasks = [];
    wdAllActiveDashboardLoaded = false;
    wdAllActiveDashboardCountsLoaded = false;
    wdAllActiveDashboardCountMap = new Map();
    wdAllActiveDashboardCountItemsMap = new Map();
}
window.wdClearWorkdeskDashboardCache = wdClearWorkdeskDashboardCache;
window.wdUpsertDashboardJobEntryCache = wdUpsertDashboardJobEntryCache;
window.wdRemoveDashboardJobEntryCache = wdRemoveDashboardJobEntryCache;

function wdLoadActiveTaskSourceSnapshot() {
    const cached = wdReadJSONStorage(window.sessionStorage, WD_ACTIVE_TASK_SOURCE_CACHE_KEY);
    if (!cached || !Array.isArray(cached.tasks)) return [];
    if (cached.userKey !== wdDashboardUserCacheKey()) return [];
    if ((Date.now() - Number(cached.savedAt || 0)) > WD_DASHBOARD_CACHE_TTL) return [];
    return cached.tasks;
}

function wdGetDashboardJobEntriesList() {
    if (wdDashboardJobEntriesCache && Array.isArray(wdDashboardJobEntriesCache.entries) && wdDashboardJobEntriesCache.entries.length) {
        return wdDashboardJobEntriesCache.entries;
    }
    try {
        if (Array.isArray(workdeskSystemEntries) && workdeskSystemEntries.length) {
            return workdeskSystemEntries;
        }
    } catch (e) { /* ignore */ }
    try {
        if (Array.isArray(allSystemEntries) && allSystemEntries.length) {
            return allSystemEntries.filter(entry => entry && entry.source === 'job_entry');
        }
    } catch (e) { /* ignore */ }
    return [];
}

async function wdEnsureDashboardJobEntriesFetched(forceRefresh = false) {
    // 9.4.8: WorkDesk Dashboard only needs Job Records for IPC follow-up.
    // Do not call ensureAllEntriesFetched() here because that also downloads
    // the full inventory transfer_entries tree from ibainvoice-3ea51.
    const now = Date.now();
    if (!forceRefresh && wdDashboardJobEntriesCache.entries.length && (now - wdDashboardJobEntriesCache.savedAt) < WD_DASHBOARD_CACHE_TTL) {
        return wdDashboardJobEntriesCache.entries;
    }

    try {
        if (!forceRefresh && Array.isArray(workdeskSystemEntries) && workdeskSystemEntries.length) {
            wdDashboardJobEntriesCache = {
                entries: workdeskSystemEntries.filter(entry => entry && entry.source === 'job_entry'),
                savedAt: now
            };
            return wdDashboardJobEntriesCache.entries;
        }
    } catch (e) { /* ignore */ }

    if (typeof db === 'undefined' || !db || !db.ref) return wdGetDashboardJobEntriesList();

    try {
        const snap = await db.ref('job_entries').once('value');
        const raw = snap.val() || {};
        const entries = Object.keys(raw).map(key => ({ key, ...(raw[key] || {}), source: 'job_entry' }));
        wdDashboardJobEntriesCache = { entries, savedAt: now };
        return entries;
    } catch (e) {
        console.warn('WorkDesk dashboard could not read Job Records without inventory transfers:', e);
        return wdGetDashboardJobEntriesList();
    }
}

async function wdGetExactMyActiveTaskList(forceRefresh = false) {
    // 9.3.1: Dashboard Personal Tasks must be the exact same list as the
    // WorkDesk Active Task screen. This avoids counting unrelated dashboard
    // overview records just because the user's name appears somewhere.
    try {
        const inMemory = (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks))
            ? userActiveTasks.filter(t => t && (typeof isWorkdeskTaskRecord !== 'function' || isWorkdeskTaskRecord(t)))
            : [];
        if (!forceRefresh && inMemory.length) return inMemory.slice();

        const snap = wdLoadActiveTaskSourceSnapshot();
        if (!forceRefresh && snap.length) return snap.filter(t => t && (typeof isWorkdeskTaskRecord !== 'function' || isWorkdeskTaskRecord(t)));

        if (typeof populateActiveTasks === 'function') {
            await populateActiveTasks(forceRefresh);
            const refreshed = (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks))
                ? userActiveTasks.filter(t => t && (typeof isWorkdeskTaskRecord !== 'function' || isWorkdeskTaskRecord(t)))
                : [];
            return refreshed.slice();
        }
    } catch (e) {
        console.warn('WorkDesk dashboard could not mirror My Active Task list:', e);
    }
    return [];
}


async function wdEnsureDashboardInvoiceEntriesFetched(forceRefresh = false) {
    // 9.8.7: Dashboard invoice tabs must be accurate from invoice_entries.
    // Use the existing Invoice Management loader when available, so the dashboard
    // does not invent another competing source.
    try {
        const hasInvoiceMemory = (typeof allInvoiceData !== 'undefined' && allInvoiceData && Object.keys(allInvoiceData || {}).length);
        if (hasInvoiceMemory && !forceRefresh) return allInvoiceData;
        if (typeof ensureInvoiceDataFetched === 'function') {
            await ensureInvoiceDataFetched(forceRefresh);
            return (typeof allInvoiceData !== 'undefined' && allInvoiceData) ? allInvoiceData : {};
        }
    } catch (e) {
        console.warn('WorkDesk dashboard could not load Invoice Entry data for accurate status tabs:', e);
    }
    return (typeof allInvoiceData !== 'undefined' && allInvoiceData) ? allInvoiceData : {};
}

function wdStatus(value, fallback = 'Pending') {
    return wdText(value, fallback);
}

function wdInvoiceRecordStatus(inv) {
    if (!inv || typeof inv !== 'object') return '';
    // Match the fields used by Invoice Records/Invoice Entry as broadly as possible.
    // status is first because this is the main Firebase invoice_entries status field.
    return wdStatus(
        inv.status || inv.Status ||
        inv.remarks || inv.Remarks ||
        inv.invoiceStatus || inv.InvoiceStatus ||
        inv.currentStatus || inv.CurrentStatus ||
        inv.stage || inv.Stage ||
        ''
    );
}


function wdCurrentInvoiceTaskStatus(task = {}, latestMeta = {}) {
    // 9.8.6: Invoice Entry Firebase record is the source of truth for status tabs.
    // Lightweight inbox rows can be stale after batch update/manual status changes.
    const current = wdInvoiceRecordStatus(latestMeta);
    if (current) return current;
    return wdStatus(task.status || task.remarks || task.Status || task.Remarks || 'Pending');
}


// 9.8.8: Official Dashboard invoice-status queues must be exact matches.
// Similar/completed names must not be folded into active queues:
// "SRV Done" is not "For SRV", and "Report Approved" is not "Report".
const WD_DASHBOARD_EXACT_INVOICE_STATUS_MAP = {
    'for srv': 'For SRV',
    'on hold': 'On Hold',
    'in process': 'In Process',
    'for summary': 'For Summary',
    'retention': 'Retention',
    'for approval': 'For Approval',
    'pending': 'Pending',
    'unresolved': 'Unresolved',
    'report': 'Report'
};
const WD_DASHBOARD_COMPLETED_OR_NON_QUEUE_STATUSES = new Set([
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

function wdDashboardExactInvoiceStatusLabel(value) {
    const raw = wdNormalize(value).replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!raw || WD_DASHBOARD_COMPLETED_OR_NON_QUEUE_STATUSES.has(raw)) return '';

    // 10.2.7: Keep On Hold visible even if old invoice rows saved the status
    // with slightly different spacing/punctuation (On-Hold, OnHold, On Hold / Waiting).
    const compact = raw.replace(/[^a-z0-9]/g, '');
    if (compact === 'onhold' || raw === 'hold' || raw.includes('on hold')) return 'On Hold';

    return WD_DASHBOARD_EXACT_INVOICE_STATUS_MAP[raw] || '';
}

function wdDashboardInvoiceStatusLabel(value) {
    return wdDashboardExactInvoiceStatusLabel(value);
}

function wdDashboardIsTrackedInvoiceStatus(value) {
    return !!wdDashboardInvoiceStatusLabel(value);
}

function wdIsNewEntryStatus(status) {
    const s = wdNormalize(status);
    return !s || s === 'pending' || s === 'new' || s === 'new entry' || s.includes('new entry');
}

function wdDashboardBucket(status, type = '') {
    const typeText = wdNormalize(type);
    const s = wdNormalize(status);

    // Exact status names only for invoice-management queues.
    // This prevents SRV Done -> For SRV and Report Approved -> Report mistakes.
    const exactInvoiceStatus = wdDashboardExactInvoiceStatusLabel(status);
    if (exactInvoiceStatus) return exactInvoiceStatus;

    if (typeText === 'ipc application') return 'IPC Application';
    if (typeText === 'ipc processed' || typeText === 'ipc' || s === 'waiting invoice') return 'IPC Processed';
    if (s === 'ipc issue') return 'IPC Application';
    if (s === 'ipc') return 'IPC Processed';

    // New Entry should be the WorkDesk Job Record entry, not every invoice record
    // that happens to have generic Pending status.
    if ((typeText.includes('job') || typeText === 'invoice job') && wdIsNewEntryStatus(status)) return 'New Entry';
    if (wdIsNewEntryStatus(status)) return 'Pending';

    return wdStatus(status, 'Pending');
}

function wdIsCompletedStatus(status) {
    return WD_COMPLETED_STATUSES.has(wdNormalize(status));
}

function wdDashboardAllowedBucket(status, type = '') {
    const raw = wdNormalize(status);

    if (!raw) return type === 'job_entry' ? 'New Entry' : 'Pending';
    if (WD_DASHBOARD_COMPLETED_OR_NON_QUEUE_STATUSES.has(raw)) return '';
    if (WD_COMPLETED_STATUSES.has(raw)) return '';

    const bucket = wdDashboardBucket(status, type);
    return WD_DASHBOARD_ALLOWED_BUCKETS.has(wdNormalize(bucket)) ? bucket : '';
}

function wdIsDashboardOpenStatus(status, type = '') {
    return !!wdDashboardAllowedBucket(status, type);
}

function wdDashboardStatusFilterKey(status) {
    return WD_DASHBOARD_STATUS_PREFIX + wdNormalize(status);
}

function wdDashboardMyStatusFilterKey(status) {
    return WD_DASHBOARD_MY_STATUS_PREFIX + wdNormalize(status);
}

function wdDashboardPersonalBucket(status, type = '') {
    const s = wdNormalize(status);
    const typeText = wdNormalize(type);
    const isJobRecordQueue = typeText.includes('job') || typeText === 'invoice job' || typeText === 'job_entry';

    if (!s) return isJobRecordQueue ? 'New Entry' : 'Pending';

    const exactInvoiceStatus = wdDashboardExactInvoiceStatusLabel(status);
    if (exactInvoiceStatus) return exactInvoiceStatus;

    if (s === 'new entry' || s === 'new') return 'New Entry';
    if (s === 'pending') return isJobRecordQueue ? 'New Entry' : 'Pending';
    if (typeText === 'ipc application') return 'IPC Application';
    if (typeText === 'ipc processed' || typeText === 'ipc' || s === 'waiting invoice') return 'IPC Processed';
    if (s === 'ipc issue') return 'IPC Application';
    if (s === 'ipc') return 'IPC Processed';

    return wdStatus(status, 'Pending');
}

function wdGetPersonalDashboardSourceList(sourceList) {
    const source = Array.isArray(sourceList) ? sourceList : [];
    if (!source.length) return [];
    return source
        .filter(task => task && (typeof isWorkdeskTaskRecord !== 'function' || isWorkdeskTaskRecord(task)))
        .filter(task => !(typeof isTaskComplete === 'function' && isTaskComplete(task)));
}

function wdDashboardPersonFilterKey(name) {
    return WD_DASHBOARD_PERSON_PREFIX + wdNormalize(name);
}

function wdAttentionNames(attention) {
    const raw = wdText(attention);
    if (!raw) return [];
    const parts = raw
        .split(/\s*(?:,|;|\/|\||&|\band\b|\bor\b)\s*/i)
        .map(part => wdText(part))
        .filter(Boolean)
        .filter(part => !['all', 'n/a', 'na', '-', 'none'].includes(wdNormalize(part)));
    return Array.from(new Set(parts));
}

function wdTaskHasAttentionName(task, nameNorm) {
    if (!nameNorm) return false;
    return wdAttentionNames(task?.attention || '').some(name => wdNormalize(name) === nameNorm);
}

function wdCurrentUserNameNorm() {
    return wdNormalize(currentApprover?.Name || currentApprover?.name || '');
}

function wdDashboardFilterExists(filterKey) {
    if (!filterKey || filterKey === WD_DASHBOARD_NONE || filterKey === WD_DASHBOARD_ALL) return true;
    if (filterKey.startsWith(WD_DASHBOARD_MY_STATUS_PREFIX)) {
        const target = filterKey.slice(WD_DASHBOARD_MY_STATUS_PREFIX.length);
        return wdPersonalDashboardTasks.some(t => wdNormalize(t.personalBucket || wdDashboardPersonalBucket(t.status, t.type)) === target);
    }
    if (filterKey.startsWith(WD_DASHBOARD_STATUS_PREFIX)) {
        const target = filterKey.slice(WD_DASHBOARD_STATUS_PREFIX.length);
        return wdActiveDashboardTasks.some(t => wdNormalize(t.bucket || wdDashboardBucket(t.status, t.type)) === target);
    }
    if (filterKey.startsWith(WD_DASHBOARD_PERSON_PREFIX)) {
        const target = filterKey.slice(WD_DASHBOARD_PERSON_PREFIX.length);
        const currentName = wdCurrentUserNameNorm();
        // Personal dashboard means the current logged-in user's own Active Task queue only.
        if (!target || target !== currentName) return false;
        return wdPersonalDashboardTasks.length > 0;
    }
    // Backward compatibility with old cached selected status values.
    return wdActiveDashboardTasks.some(t => (t.bucket || wdDashboardBucket(t.status, t.type)) === filterKey);
}

function wdDashboardSelectedLabel() {
    if (wdActiveDashboardSelectedStatus === WD_DASHBOARD_NONE) return 'Select a status card';
    if (wdActiveDashboardSelectedStatus === WD_DASHBOARD_ALL) return 'All Active Tasks';
    if (wdActiveDashboardSelectedStatus.startsWith(WD_DASHBOARD_MY_STATUS_PREFIX)) {
        const target = wdActiveDashboardSelectedStatus.slice(WD_DASHBOARD_MY_STATUS_PREFIX.length);
        const found = wdPersonalDashboardTasks.find(t => wdNormalize(t.personalBucket || wdDashboardPersonalBucket(t.status, t.type)) === target);
        return found ? `My ${found.personalBucket || wdDashboardPersonalBucket(found.status, found.type)} Tasks` : 'My Personal Tasks';
    }
    if (wdActiveDashboardSelectedStatus.startsWith(WD_DASHBOARD_STATUS_PREFIX)) {
        const target = wdActiveDashboardSelectedStatus.slice(WD_DASHBOARD_STATUS_PREFIX.length);
        const found = wdActiveDashboardTasks.find(t => wdNormalize(t.bucket || wdDashboardBucket(t.status, t.type)) === target);
        return found ? (found.bucket || wdDashboardBucket(found.status, found.type)) : 'Selected Status';
    }
    if (wdActiveDashboardSelectedStatus.startsWith(WD_DASHBOARD_PERSON_PREFIX)) {
        const target = wdActiveDashboardSelectedStatus.slice(WD_DASHBOARD_PERSON_PREFIX.length);
        const currentName = wdCurrentUserNameNorm();
        if (target && target === currentName) return 'My Personal Tasks';
        return 'Personal Tasks';
    }
    return wdActiveDashboardSelectedStatus;
}

function wdHasPdfName(name) {
    const baseName = (typeof getSharePointPdfBaseName === 'function')
        ? getSharePointPdfBaseName(name)
        : wdText(name);
    return !!baseName && baseName.toLowerCase() !== 'nil';
}

function wdBuildPdfButton(label, basePath, fileName, className) {
    if (!wdHasPdfName(fileName) || !basePath || typeof buildSharePointPdfUrl !== 'function') {
        return '<span class="wd-pdf-empty">—</span>';
    }
    const url = buildSharePointPdfUrl(basePath, fileName);
    if (!url) return '<span class="wd-pdf-empty">—</span>';
    return `<a class="wd-dashboard-pdf-btn ${className || ''}" href="${wdSafe(url)}" target="_blank" rel="noopener"><i class="fa-regular fa-file-pdf"></i> ${wdSafe(label)}</a>`;
}

function wdGetUserPositionText() {
    return wdNormalize(currentApprover?.Position || currentApprover?.Role || '');
}

function wdIsWideAccessUser() {
    // 10.3.3: Wide Dashboard access is controlled by Role/permission fields,
    // not workflow Position labels like QS, Site DC, Engineer, or Accounts.
    const roleAccessText = wdNormalize([
        currentApprover?.Role,
        currentApprover?.role,
        currentApprover?.AccountRole,
        currentApprover?.accountRole,
        currentApprover?.Access,
        currentApprover?.access
    ].filter(Boolean).join(' '));
    const nameText = wdNormalize(currentApprover?.Name || currentApprover?.username || currentApprover?.name || '');
    const superNameText = (typeof SUPER_ADMIN_NAME !== 'undefined') ? wdNormalize(SUPER_ADMIN_NAME) : '';
    return roleAccessText.includes('admin') || roleAccessText.includes('super') || (!!superNameText && nameText === superNameText);
}

function wdCanSeeAllActiveDashboard() {
    // 9.3.3: Only Admin/Super Admin accounts should see the wider system overview.
    // Normal User role accounts see only tasks directly addressed to their own name.
    return wdIsWideAccessUser();
}

function wdDashboardTaskBelongsToCurrentUser(task) {
    const currentName = wdCurrentUserNameNorm();
    if (!currentName || !task) return false;
    return wdTaskHasAttentionName(task, currentName);
}

function wdSanitizeFirebaseKey(key) {
    return String(key || '').replace(/[.#$[\]]/g, '_');
}

function wdDashboardOwnerKeyMatchesCurrentUser(ownerKey) {
    const currentName = wdText(currentApprover?.Name || currentApprover?.name || '');
    if (!currentName) return false;
    const owner = wdNormalize(ownerKey);
    const safeCurrent = wdNormalize(wdSanitizeFirebaseKey(currentName));
    const looseOwner = owner.replace(/_/g, ' ');
    return owner === safeCurrent || looseOwner === wdNormalize(currentName);
}

function wdIsInvoiceLookupComplete(status) {
    const raw = wdNormalize(status);
    if (!raw) return false;
    if (WD_COMPLETED_STATUSES.has(raw)) return true;
    if (raw.includes('with accounts')) return true;
    if (raw.includes('srv done') || raw.includes('marked srv done') || raw.includes('completed srv')) return true;
    if (raw.includes('paid') || raw.includes('closed') || raw.includes('cancel') || raw === 'done') return true;
    return false;
}

let wdInvoiceSourceTruthCache = new Map();

async function wdGetInvoiceSourceTruth(poNumber, invoiceKey, forceRefresh = false, lookupTask = {}) {
    const po = wdText(poNumber || '');
    const key = wdText(invoiceKey || '');
    if (!po || !key) return null;
    const cacheKey = `${po}||${key}`;

    if (!forceRefresh && wdInvoiceSourceTruthCache.has(cacheKey)) {
        return wdInvoiceSourceTruthCache.get(cacheKey);
    }

    const attachSourceKey = (val, sourceKey) => {
        if (!val || typeof val !== 'object') return val;
        return { ...val, __sourceInvoiceKey: sourceKey || key };
    };
    const candidateMatches = (inv, sourceKey) => {
        if (!inv || typeof inv !== 'object') return false;
        const candidates = [
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
        ].map(v => wdText(v)).filter(Boolean);
        const taskCandidates = [
            key,
            lookupTask.originalKey,
            lookupTask.invoiceKey,
            lookupTask.key,
            lookupTask.invEntryID,
            lookupTask.entryId,
            lookupTask.entryID,
            lookupTask.ref,
            lookupTask.invNumber,
            lookupTask.invoiceNo,
            lookupTask.invoiceNumber
        ].map(v => wdText(v)).filter(Boolean);
        return candidates.some(a => taskCandidates.some(b => wdNormalize(a) === wdNormalize(b)));
    };

    try {
        if (!forceRefresh && typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[po]) {
            if (allInvoiceData[po][key]) {
                const val = attachSourceKey(allInvoiceData[po][key] || null, key);
                wdInvoiceSourceTruthCache.set(cacheKey, val);
                return val;
            }
            const invoices = allInvoiceData[po] || {};
            for (const sourceKey of Object.keys(invoices)) {
                const inv = invoices[sourceKey] || {};
                if (candidateMatches(inv, sourceKey)) {
                    const val = attachSourceKey(inv, sourceKey);
                    wdInvoiceSourceTruthCache.set(cacheKey, val);
                    return val;
                }
            }
        }
    } catch (_) { /* ignore */ }

    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return null;
        const snap = await invoiceDb.ref(`invoice_entries/${po}/${key}`).once('value');
        const val = snap.val() || null;
        if (val) {
            const directVal = attachSourceKey(val, key);
            wdInvoiceSourceTruthCache.set(cacheKey, directVal);
            return directVal;
        }

        // 10.2.7: Some older lightweight task rows were keyed by invoice number
        // or entry id instead of the real invoice_entries child key. Do not delete
        // valid On Hold/active tasks just because the lookup key is legacy.
        const poSnap = await invoiceDb.ref(`invoice_entries/${po}`).once('value');
        const invoices = poSnap.val() || {};
        for (const sourceKey of Object.keys(invoices)) {
            const inv = invoices[sourceKey] || {};
            if (candidateMatches(inv, sourceKey)) {
                const matchedVal = attachSourceKey(inv, sourceKey);
                wdInvoiceSourceTruthCache.set(cacheKey, matchedVal);
                return matchedVal;
            }
        }
        wdInvoiceSourceTruthCache.set(cacheKey, null);
        return null;
    } catch (e) {
        console.warn('WorkDesk dashboard could not verify invoice source:', e);
        return null;
    }
}

async function wdCleanupStaleInvoiceLookupRow(ownerKey, invoiceKey) {
    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref || !invoiceKey) return;
        const owner = String(ownerKey || '').trim();
        const removals = [];
        if (owner) removals.push(invoiceDb.ref(`invoice_tasks_by_user/${owner}/${invoiceKey}`).remove());
        if (wdNormalize(owner) !== 'all') removals.push(invoiceDb.ref(`invoice_tasks_by_user/All/${invoiceKey}`).remove());
        await Promise.allSettled(removals);
    } catch (_) { /* ignore stale cleanup failure */ }
}

function wdDashboardTaskOwnerAttention(ownerKey, task) {
    const taskAttention = wdText(task?.attention || task?.Attention || '');
    if (taskAttention) return taskAttention;
    if (wdNormalize(ownerKey) === 'all') return 'All';
    return wdText(String(ownerKey || '').replace(/_/g, ' '));
}

function wdComparableTaskKeys(task) {
    const keys = [];
    if (!task) return keys;
    const source = wdNormalize(task.source || task.type || task.for || '');
    const direct = wdNormalize(task.key || task.id || task.originalKey || '');
    const po = wdNormalize(task.po || task.originalPO || '');
    const ref = wdNormalize(task.ref || task.invNumber || task.invoiceNo || task.invEntryID || '');

    // 9.3.7: Invoice lookup keys are not globally unique in this system.
    // Many POs can reuse labels such as INV-01, so PO must be part of every
    // comparison key. Otherwise the dashboard collapses many For SRV/New Entry
    // tasks into one card/count.
    if (direct && po) keys.push(`direct-po|${source}|${po}|${direct}`);
    if (direct) keys.push(`direct|${source}|${direct}`);
    if (po && ref) keys.push(`po-ref|${po}|${ref}`);
    if (source && po && ref) keys.push(`src-po-ref|${source}|${po}|${ref}`);
    return keys;
}

function wdBuildPersonalTaskKeySet() {
    const set = new Set();
    wdPersonalDashboardTasks.forEach(task => {
        set.add(wdDashboardDedupeKey(task));
        wdComparableTaskKeys(task).forEach(k => set.add(k));
    });
    return set;
}

function wdDashboardTaskIsAlreadyPersonal(task, personalKeySet) {
    if (wdDashboardTaskBelongsToCurrentUser(task)) return true;
    if (!personalKeySet || !personalKeySet.size) return false;
    if (personalKeySet.has(wdDashboardDedupeKey(task))) return true;
    return wdComparableTaskKeys(task).some(k => personalKeySet.has(k));
}

function wdIsOpenIPCJobStatus(status) {
    const raw = wdNormalize(status);
    if (!raw) return true;
    if (WD_COMPLETED_STATUSES.has(raw)) return false;
    if (raw.includes('with accounts')) return false;
    if (raw.includes('closed') || raw.includes('cancel')) return false;
    if (raw.includes('deleted')) return false;
    if (raw.includes('srv done') || raw.includes('marked srv done') || raw.includes('completed srv')) return false;
    // IPC dashboard is a supplier-follow-up queue. Waiting/signature/review notes are still open IPC items.
    return true;
}

function wdUserSiteTokens() {
    const raw = wdText(currentApprover?.Site || currentApprover?.site || '');
    if (!raw || wdNormalize(raw) === 'all') return ['all'];
    return raw
        .split(/[,+/|;]+|\s+and\s+/i)
        .map(part => wdNormalize(part).split(' ')[0])
        .filter(Boolean);
}

function wdSiteMatchesCurrentUser(taskSite) {
    if (wdIsWideAccessUser()) return true;

    const userSites = wdUserSiteTokens();
    if (userSites.includes('all')) return true;

    const siteRaw = wdText(taskSite);
    if (!siteRaw || wdNormalize(siteRaw) === 'all') return true;

    const siteLower = wdNormalize(siteRaw);
    const siteFirst = siteLower.split(' ')[0];

    return userSites.some(userSite => {
        if (!userSite) return false;
        return siteFirst === userSite || siteLower.includes(userSite) || userSite.includes(siteFirst);
    });
}

function wdGetPOValue(poDetails, keys, fallback = '') {
    if (!poDetails) return fallback;
    for (const key of keys) {
        if (poDetails[key] !== undefined && poDetails[key] !== null && String(poDetails[key]).trim() !== '') {
            return poDetails[key];
        }
    }
    return fallback;
}

async function wdGetPODetails(poNumber) {
    if (!poNumber) return {};
    if (typeof getInvoicePurchaseOrderDetails === 'function') {
        try {
            return await getInvoicePurchaseOrderDetails(poNumber) || {};
        } catch (e) {
            console.warn('Dashboard PO detail lookup failed:', poNumber, e);
        }
    }
    if (typeof allPOData !== 'undefined' && allPOData && allPOData[poNumber]) return allPOData[poNumber];
    return {};
}

function wdResolveInvoiceSite(inv, poDetails) {
    return wdText(
        wdGetPOValue(poDetails, ['Project ID', 'Project ID:', 'Project', 'Site'], '') ||
        inv?.site || inv?.site_name || inv?.siteName || inv?.projectId || inv?.projectID || '',
        'N/A'
    );
}

function wdResolveInvoiceVendor(inv, poDetails) {
    return wdText(
        wdGetPOValue(poDetails, ['Supplier Name', 'Supplier Name:', 'Supplier', 'Supplier:', 'Vendor Name'], '') ||
        inv?.vendorName || inv?.vendor_name || inv?.supplierName || inv?.Supplier || '',
        'N/A'
    );
}

function wdEntryStatus(entry) {
    return wdStatus(entry?.remarks || entry?.status || entry?.Status || 'Pending');
}

function wdIsConvertedInvoiceJobEntry(entry = {}) {
    try {
        const taskFor = wdNormalize(entry.for || entry.type || '');
        if (!(taskFor === 'invoice' || taskFor === 'invoice job')) return false;
        const st = wdNormalize(entry.remarks || entry.status || '');
        // 10.5.1: An IPC/Job Record converted into Invoice becomes an active New Entry
        // intake until Invoice Entry creates the real invoice record. Only explicit
        // archive/link/completed fields should hide the old WorkDesk intake row.
        return !!(entry.convertedToInvoice || entry.archived || entry.linkedInvoiceKey || entry.invoiceWorkflowStatus || entry.linkedInvoiceStatus || st === 'converted to invoice');
    } catch (_) { return false; }
}

function wdEntryTimestamp(entry) {
    const candidates = [
        entry?.invoiceLastUpdated,
        entry?.lastUpdated,
        entry?.updatedAt,
        entry?.createdAt,
        entry?.enteredAt,
        entry?.originTimestamp,
        entry?.dateCreated,
        entry?.dateAdded,
        entry?.releaseDate,
        entry?.timestamp
    ];
    for (const c of candidates) {
        if (!c) continue;
        const n = Number(c);
        if (!Number.isNaN(n) && n > 0) return n < 10000000000 ? n * 1000 : n;
        const d = new Date(c).getTime();
        if (!Number.isNaN(d)) return d;
    }
    return 0;
}

function wdIsOpenJobEntry(entry) {
    if (!entry) return false;
    const status = wdEntryStatus(entry);
    if (!wdIsDashboardOpenStatus(status, 'job_entry')) return false;

    // The new dashboard is for invoice-related WorkDesk follow-up only.
    const entryFor = wdNormalize(entry.for);
    return entryFor === 'invoice' || entryFor === 'ipc' || entryFor === 'ipc application' || entryFor === 'ipc processed';
}

function wdBuildIPCMap() {
    const ipcMap = new Map();
    const entries = wdGetDashboardJobEntriesList();

    entries.forEach(entry => {
        const entryForNorm = wdNormalize(entry && entry.for);
        if (!entry || !['ipc', 'ipc application', 'ipc processed'].includes(entryForNorm)) return;
        const status = wdEntryStatus(entry);
        if (!wdIsOpenIPCJobStatus(status)) return;

        const po = wdText(entry.po || entry.originalPO || entry.ref || '');
        if (!po) return;

        const current = ipcMap.get(po) || { count: 0, statuses: new Set(), latestTimestamp: 0, latestStatus: '' };
        current.count += 1;
        current.statuses.add(status);
        const ts = wdEntryTimestamp(entry);
        if (ts >= current.latestTimestamp) {
            current.latestTimestamp = ts;
            current.latestStatus = status;
        }
        ipcMap.set(po, current);
    });

    return ipcMap;
}

function wdFormatIPCText(ipcInfo) {
    if (!ipcInfo || !ipcInfo.count) return 'No IPC';
    if (ipcInfo.count === 1) return ipcInfo.latestStatus ? `Active - ${ipcInfo.latestStatus}` : 'Active IPC';
    return `${ipcInfo.count} active - ${ipcInfo.latestStatus || 'Multiple IPC'}`;
}

function wdStatusTone(status) {
    const s = wdNormalize(status);
    if (s.includes('hold')) return 'hold';
    if (s.includes('summary')) return 'report';
    if (s.includes('report')) return 'report';
    if (s.includes('approval') || s === 'approved') return 'approval';
    if (s.includes('ipc')) return 'ipc';
    if (s.includes('srv')) return 'srv';
    if (s.includes('review') || s.includes('new') || s.includes('pending')) return 'pending';
    return 'default';
}

function wdStatusIcon(status) {
    const tone = wdStatusTone(status);
    const icons = {
        hold: 'fa-pause',
        report: 'fa-file-lines',
        approval: 'fa-user-check',
        ipc: 'fa-clipboard-list',
        srv: 'fa-truck-ramp-box',
        pending: 'fa-hourglass-half',
        default: 'fa-list-check'
    };
    return icons[tone] || icons.default;
}

function wdTaskDisplayStatus(task = {}) {
    const bucket = wdText(task.bucket || '');
    const rawStatus = wdText(task.status || task.remarks || bucket || 'Pending');
    if (['ipc', 'ipc processed', 'ipc application'].includes(wdNormalize(bucket)) || ['ipc', 'ipc processed', 'ipc application'].includes(wdNormalize(task.type || ''))) {
        const ipcStatus = wdText(task.ipc || task.ipcStatus || task.jobStatus || rawStatus || '');
        if (ipcStatus && wdNormalize(ipcStatus) !== 'no ipc') return ipcStatus;
        return wdNormalize(task.type || '') === 'ipc application' ? 'Pending' : 'Waiting Invoice';
    }
    return rawStatus || bucket || 'Pending';
}

function wdStatusMicrocopy(status, count) {
    const tone = wdStatusTone(status);
    if (tone === 'hold') return count === 1 ? 'Needs follow-up' : 'Need follow-up';
    if (tone === 'report') return count === 1 ? 'Report stage' : 'Report stage';
    if (tone === 'approval') return count === 1 ? 'Approval queue' : 'Approval queue';
    if (tone === 'ipc') return count === 1 ? 'Supplier follow-up' : 'Supplier follow-up';
    if (tone === 'srv') return count === 1 ? 'SRV movement' : 'SRV movement';
    if (tone === 'pending') return count === 1 ? 'New / review' : 'New / review';
    return count === 1 ? 'Open item' : 'Open items';
}

function wdAccessLabel() {
    if (wdIsWideAccessUser()) return 'Admin view · All sites';
    return `Site view · ${wdText(currentApprover?.Site || currentApprover?.site || 'Assigned site')}`;
}

function wdFormatDashboardDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return wdText(value);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}


function wdParseQueueTimestamp(value) {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'object') {
        if (value.seconds) return Number(value.seconds) * 1000;
        if (value._seconds) return Number(value._seconds) * 1000;
        return 0;
    }
    const n = Number(value);
    if (!Number.isNaN(n) && n > 0) {
        // Accept Firebase millisecond timestamps and older second-based values.
        return n < 10000000000 ? n * 1000 : n;
    }
    const raw = String(value || '').trim();
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
    const d = new Date(value).getTime();
    return Number.isNaN(d) ? 0 : d;
}

function wdFindLinkedJobRecord(rawTask = {}, invMeta = {}) {
    try {
        const list = Array.isArray(allSystemEntries) ? allSystemEntries : [];
        if (!list.length) return null;
        const linkedKey = rawTask?.linkedJobEntryKey || rawTask?.originJobEntryKey || rawTask?.jobEntryKey || invMeta?.linkedJobEntryKey || invMeta?.originJobEntryKey || invMeta?.jobEntryKey || '';
        if (linkedKey) {
            const found = list.find(e => e && e.key === linkedKey);
            if (found) return found;
        }
        const targetTs = Number(rawTask?.jobRecordTimestamp || invMeta?.jobRecordTimestamp || rawTask?.originTimestamp || invMeta?.originTimestamp || 0);
        if (targetTs) {
            const found = list.find(e => e && Number(e.timestamp || 0) === targetTs);
            if (found) return found;
        }
        return null;
    } catch (_) {
        return null;
    }
}

function wdJobRecordEnteredTimestamp(rawTask = {}, invMeta = {}) {
    const linked = wdFindLinkedJobRecord(rawTask, invMeta);
    const source = String(rawTask?.source || '').toLowerCase();
    const directJobEntryDate = (source === 'job_entry' || source === 'transfer_entry' || source === 'ipc_job_record') ? rawTask?.date : '';
    return wdFirstQueueTimestamp(
        linked?.date,
        directJobEntryDate,
        rawTask?.jobRecordDateEntered,
        rawTask?.originDateEntered,
        rawTask?.dateEntered,
        rawTask?.entryDate,
        invMeta?.jobRecordDateEntered,
        invMeta?.originDateEntered,
        invMeta?.dateEntered,
        invMeta?.entryDate,
        rawTask?.jobRecordTimestamp,
        invMeta?.jobRecordTimestamp,
        linked?.timestamp
    );
}

// 9.8.2: Decode Firebase push IDs to recover true created/entered time for
// older invoice/task rows where createdAt/enteredAt was not stored. This keeps
// Dashboard date tabs based on queue/entered date, never supplier invoice date.
function wdFirebasePushTimestamp(value) {
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

function wdTaskKeyCreatedTimestamp(rawTask = {}, invMeta = {}) {
    return wdFirebasePushTimestamp(
        rawTask?.originalKey || rawTask?.invoiceKey || rawTask?.firebaseKey || rawTask?.key || invMeta?.key || rawTask?.id || ''
    );
}

function wdTrustedTaskEnteredTimestamp(rawTask = {}, invMeta = {}) {
    // Official New Entry grouping uses the same value shown in Job Records > Date Entered.
    const officialJobDate = wdJobRecordEnteredTimestamp(rawTask, invMeta);
    if (officialJobDate) return officialJobDate;

    const source = String(rawTask?.source || '').toLowerCase();
    const taskFor = String(rawTask?.for || '').toLowerCase();
    if (source === 'job_entry' || source === 'transfer_entry' || taskFor === 'invoice') return rawTask?.timestamp;
    return '';
}

function wdFirstQueueTimestamp(...values) {
    for (const value of values) {
        const ts = wdParseQueueTimestamp(value);
        if (ts > 0) return ts;
    }
    return 0;
}

function wdQueueLabelForTask(status, type = '') {
    const bucket = wdDashboardPersonalBucket(status, type) || wdDashboardBucket(status, type) || status;
    const s = wdNormalize(bucket || status);
    // 9.9.7: Corkboard notes should show the official date source name,
    // not the generic "Queue Since" label.
    // New Entry and IPC are Job Records based, so show Date Entered.
    // Invoice status queues use the Invoice Entry release/status date.
    if (s === 'new entry' || s === 'ipc') return 'Date Entered';
    return 'Release Date';
}

function wdCorkNoteDateLabel(task = {}) {
    const bucket = task.personalBucket || task.bucket || wdDashboardPersonalBucket(task.status, task.type) || wdDashboardBucket(task.status, task.type) || task.status || '';
    const s = wdNormalize(bucket);
    if (s === 'new entry' || s === 'ipc') return 'Date Entered';
    return 'Release Date';
}

function wdQueueDateOnlyText(timestamp) {
    const ts = Number(timestamp || 0);
    if (!ts) return 'not tracked';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'not tracked';
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}


// 9.9.8: Pending age is calculated locally from the official Date Entered / Release Date.
// No extra Firebase read is required; the count updates whenever the dashboard is opened/refreshed.
function wdTaskAgeDaysFromTimestamp(timestamp) {
    const ts = Number(timestamp || 0);
    if (!ts) return null;
    const start = new Date(ts);
    if (Number.isNaN(start.getTime())) return null;
    const now = new Date();
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(0, Math.floor((today - startDay) / 86400000));
}

function wdPendingForText(timestamp) {
    const days = wdTaskAgeDaysFromTimestamp(timestamp);
    if (days === null) return 'not tracked';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
}

function wdPendingForTone(timestamp) {
    const days = wdTaskAgeDaysFromTimestamp(timestamp);
    if (days === null) return 'neutral';
    if (days >= 30) return 'critical';
    if (days >= 8) return 'alert';
    if (days >= 3) return 'watch';
    return 'fresh';
}

function wdHistoryValues(history) {
    if (!history) return [];
    if (Array.isArray(history)) return history.filter(Boolean);
    if (typeof history === 'object') return Object.values(history).filter(Boolean);
    return [];
}

function wdHistoryStatusMatches(entryStatus, targetStatus) {
    const entryLabel = wdDashboardExactInvoiceStatusLabel(entryStatus);
    const targetLabel = wdDashboardExactInvoiceStatusLabel(targetStatus);
    if (entryLabel && targetLabel) return entryLabel === targetLabel;
    const entry = wdNormalize(entryStatus);
    const target = wdNormalize(targetStatus);
    return !!entry && !!target && entry === target;
}

function wdInvoiceHistoryTimestampForStatus(rawTask = {}, invMeta = {}, status = '') {
    const target = wdNormalize(status || rawTask?.status || rawTask?.remarks || invMeta?.status || invMeta?.remarks || '');
    const historyList = [
        ...wdHistoryValues(rawTask?.history),
        ...wdHistoryValues(rawTask?.invoiceHistory),
        ...wdHistoryValues(rawTask?.statusHistory),
        ...wdHistoryValues(invMeta?.history),
        ...wdHistoryValues(invMeta?.invoiceHistory),
        ...wdHistoryValues(invMeta?.statusHistory)
    ];
    let best = 0;
    historyList.forEach(entry => {
        const entryStatus = entry?.status || entry?.action || entry?.remarks || '';
        if (!wdHistoryStatusMatches(entryStatus, target)) return;
        const ts = wdFirstQueueTimestamp(entry?.timestamp, entry?.updatedAt, entry?.createdAt, entry?.date, entry?.releaseDate);
        if (ts && ts > best) best = ts;
    });
    return best;
}

function wdIsJobNewEntryQueue(rawTask = {}, status = '', type = '') {
    // 10.4.0: Do not count old WorkDesk intake rows once they already became
    // Invoice Management records. The real invoice row owns For SRV/Pending/etc.
    if (wdIsConvertedInvoiceJobEntry(rawTask)) return false;

    const s = wdNormalize(status || rawTask?.status || rawTask?.remarks || '');
    const source = wdNormalize(rawTask?.source || type || '');
    const taskFor = wdNormalize(rawTask?.for || rawTask?.type || '');
    if (s.includes('new entry')) return true;
    // Pending becomes a New Entry queue only for Job Records invoice entries.
    // Invoice Management Pending must use invoice status/history dates.
    return (s === 'pending' || s === 'new') && (source.includes('job') || taskFor === 'invoice job');
}

function wdIsIPCQueue(rawTask = {}, status = '', type = '') {
    const s = wdNormalize(status || rawTask?.status || rawTask?.remarks || '');
    const source = wdNormalize(rawTask?.source || type || '');
    const taskFor = wdNormalize(rawTask?.for || rawTask?.type || '');
    return ['ipc', 'ipc application', 'ipc processed'].includes(taskFor) || source.includes('ipc') || s.includes('ipc') || s === 'waiting invoice';
}

function wdInvoiceStatusQueueTimestamp(rawTask = {}, invMeta = {}, status = '') {
    const exactStatus = wdDashboardExactInvoiceStatusLabel(status || rawTask?.status || rawTask?.remarks || invMeta?.status || '');
    const keyCreatedAt = wdTaskKeyCreatedTimestamp(rawTask, invMeta);
    const historyTs = wdInvoiceHistoryTimestampForStatus(rawTask, invMeta, exactStatus || status);

    if (exactStatus === 'For SRV') {
        return wdFirstQueueTimestamp(
            historyTs,
            rawTask?.statusQueueAt,
            invMeta?.statusQueueAt,
            rawTask?.forSrvAt,
            rawTask?.sentToSrvAt,
            rawTask?.srvRequestedAt,
            invMeta?.forSrvAt,
            invMeta?.sentToSrvAt,
            invMeta?.srvRequestedAt,
            rawTask?.queueAt,
            invMeta?.queueAt,
            rawTask?.statusChangedAt,
            rawTask?.statusUpdatedAt,
            invMeta?.statusChangedAt,
            invMeta?.statusUpdatedAt,
            rawTask?.releaseDate,
            invMeta?.releaseDate,
            rawTask?.updatedAt,
            rawTask?.lastUpdated,
            rawTask?.invoiceLastUpdated,
            invMeta?.updatedAt,
            invMeta?.lastUpdated,
            keyCreatedAt
        );
    }

    if (exactStatus === 'Report') {
        return wdFirstQueueTimestamp(
            historyTs,
            rawTask?.statusQueueAt,
            invMeta?.statusQueueAt,
            rawTask?.reportAt,
            rawTask?.sentToReportAt,
            invMeta?.reportAt,
            invMeta?.sentToReportAt,
            rawTask?.queueAt,
            invMeta?.queueAt,
            rawTask?.statusChangedAt,
            rawTask?.statusUpdatedAt,
            invMeta?.statusChangedAt,
            invMeta?.statusUpdatedAt,
            rawTask?.releaseDate,
            invMeta?.releaseDate,
            rawTask?.updatedAt,
            rawTask?.lastUpdated,
            rawTask?.invoiceLastUpdated,
            invMeta?.updatedAt,
            invMeta?.lastUpdated,
            keyCreatedAt
        );
    }

    return wdFirstQueueTimestamp(
        historyTs,
        rawTask?.statusQueueAt,
        invMeta?.statusQueueAt,
        rawTask?.queueAt,
        invMeta?.queueAt,
        rawTask?.statusChangedAt,
        rawTask?.statusUpdatedAt,
        invMeta?.statusChangedAt,
        invMeta?.statusUpdatedAt,
        rawTask?.releaseDate,
        invMeta?.releaseDate,
        rawTask?.updatedAt,
        rawTask?.lastUpdated,
        rawTask?.invoiceLastUpdated,
        invMeta?.updatedAt,
        invMeta?.lastUpdated,
        keyCreatedAt
    );
}

function wdQueueTimestampForTask(rawTask, invMeta = {}, status = '', type = '') {
    const bucket = wdDashboardPersonalBucket(status, type);
    const effectiveStatus = bucket || status;
    const keyCreatedAt = wdTaskKeyCreatedTimestamp(rawTask, invMeta);
    const trustedEnteredAt = wdTrustedTaskEnteredTimestamp(rawTask, invMeta);

    // Correct source rules:
    // New Entry = Job Records Date Entered.
    // IPC = Job Records / IPC job date.
    // For SRV, For Summary, Retention, Report, In Process, Unresolved, Pending, On Hold = Invoice Entry status/history date.
    if (wdIsJobNewEntryQueue(rawTask, effectiveStatus, type)) {
        return wdFirstQueueTimestamp(
            trustedEnteredAt,
            rawTask?.jobRecordDateEntered,
            rawTask?.originDateEntered,
            rawTask?.dateEntered,
            invMeta?.jobRecordDateEntered,
            invMeta?.originDateEntered,
            invMeta?.dateEntered,
            rawTask?.createdAt,
            rawTask?.enteredAt,
            rawTask?.dateAdded,
            rawTask?.originTimestamp,
            rawTask?.dateCreated,
            invMeta?.createdAt,
            invMeta?.enteredAt,
            invMeta?.dateAdded,
            invMeta?.originTimestamp,
            invMeta?.dateCreated,
            keyCreatedAt
        );
    }

    if (wdIsIPCQueue(rawTask, effectiveStatus, type)) {
        return wdFirstQueueTimestamp(
            rawTask?.ipcAt,
            rawTask?.ipcQueueAt,
            invMeta?.ipcAt,
            invMeta?.ipcQueueAt,
            rawTask?.statusQueueAt,
            invMeta?.statusQueueAt,
            rawTask?.queueAt,
            invMeta?.queueAt,
            rawTask?.statusChangedAt,
            rawTask?.statusUpdatedAt,
            invMeta?.statusChangedAt,
            invMeta?.statusUpdatedAt,
            trustedEnteredAt,
            rawTask?.jobRecordDateEntered,
            rawTask?.originDateEntered,
            rawTask?.dateEntered,
            invMeta?.jobRecordDateEntered,
            invMeta?.originDateEntered,
            invMeta?.dateEntered,
            rawTask?.jobRecordTimestamp,
            invMeta?.jobRecordTimestamp,
            rawTask?.originTimestamp,
            invMeta?.originTimestamp,
            keyCreatedAt
        );
    }

    return wdInvoiceStatusQueueTimestamp(rawTask, invMeta, effectiveStatus);
}

function wdQueueAgeParts(timestamp) {
    const ts = Number(timestamp || 0);
    if (!ts) return { text: 'date not tracked', tone: 'unknown', days: 0 };
    const now = Date.now();
    const ageMs = Math.max(0, now - ts);
    const days = Math.floor(ageMs / 86400000);
    if (days <= 0) return { text: 'Today', tone: 'fresh', days };
    if (days === 1) return { text: 'Yesterday', tone: 'watch', days };
    if (days === 2) return { text: '2 days waiting', tone: 'watch', days };
    return { text: `${days} days waiting`, tone: 'urgent', days };
}

function wdQueueFullText(timestamp) {
    const ts = Number(timestamp || 0);
    if (!ts) return 'date not tracked yet';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'date not tracked yet';
    const age = wdQueueAgeParts(ts).text;
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${age} • ${time}`;
}

function wdQueueTimeText(timestamp) {
    const ts = Number(timestamp || 0);
    if (!ts) return 'not tracked';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'not tracked';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function wdQueueDateKey(timestamp) {
    const ts = Number(timestamp || 0);
    if (!ts) return 'unknown';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'unknown';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function wdDateFromQueueKey(key) {
    if (!key || key === 'unknown') return null;
    const parts = String(key).split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function wdQueueTabLabel(key) {
    const d = wdDateFromQueueKey(key);
    if (!d) return 'No Date';
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

function wdQueueTabFullLabel(key) {
    const d = wdDateFromQueueKey(key);
    if (!d) return 'Date not tracked';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
}

function wdBuildQueueDateGroups(tasks) {
    const groups = new Map();
    (tasks || []).forEach(task => {
        const key = wdQueueDateKey(task.queueTimestamp || task.timestamp);
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label: wdQueueTabLabel(key),
                fullLabel: wdQueueTabFullLabel(key),
                tasks: [],
                timestamp: Number(task.queueTimestamp || task.timestamp || 0) || 0
            });
        }
        groups.get(key).tasks.push(task);
    });
    return Array.from(groups.values()).sort((a, b) => {
        if (a.key === 'unknown' && b.key !== 'unknown') return 1;
        if (b.key === 'unknown' && a.key !== 'unknown') return -1;
        return (a.timestamp || 0) - (b.timestamp || 0);
    });
}

function wdQueueSortTime(task) {
    return Number(task?.queueTimestamp || task?.timestamp || 0) || 0;
}

function wdCompareDashboardPriority(a, b) {
    const qa = wdQueueSortTime(a);
    const qb = wdQueueSortTime(b);
    // Oldest tracked queue item first. Unknown dates go after tracked dates.
    if (qa && qb && qa !== qb) return qa - qb;
    if (qa && !qb) return -1;
    if (!qa && qb) return 1;
    return (Number(a?.timestamp || 0) || 0) - (Number(b?.timestamp || 0) || 0);
}

function wdTaskVendorSortName(task) {
    const raw = wdText(
        task?.vendorName || task?.vendor || task?.supplierName || task?.Supplier ||
        task?.supplier || task?.vendor_name || ''
    );
    const clean = raw && wdNormalize(raw) !== 'n/a' ? raw : 'ZZZ No Vendor';
    return clean.toLowerCase();
}

function wdIsForSummaryDashboardLabel(label) {
    return wdNormalize(label) === 'for summary';
}

function wdCompareForSummaryByVendor(a, b) {
    const va = wdTaskVendorSortName(a);
    const vb = wdTaskVendorSortName(b);
    const vendorCompare = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
    if (vendorCompare !== 0) return vendorCompare;

    const pa = wdText(a?.po || a?.ref || '');
    const pb = wdText(b?.po || b?.ref || '');
    const poCompare = pa.localeCompare(pb, undefined, { numeric: true, sensitivity: 'base' });
    if (poCompare !== 0) return poCompare;

    return wdCompareDashboardPriority(a, b);
}

function wdDashboardSorterForLabel(label) {
    return wdIsForSummaryDashboardLabel(label) ? wdCompareForSummaryByVendor : wdCompareDashboardPriority;
}

function wdDocButtonZone(invoicePdf, reportPdf) {
    return `
        <div class="wd-doc-zone">
            <div class="wd-doc-label"><i class="fa-regular fa-folder-open"></i> Documents</div>
            <div class="wd-doc-actions">
                ${invoicePdf}
                ${reportPdf}
            </div>
        </div>`;
}

function wdSortStatuses(statuses) {
    return statuses.sort((a, b) => {
        const ia = WD_STATUS_ORDER.indexOf(a);
        const ib = WD_STATUS_ORDER.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    });
}

function wdGetActiveTaskSourceList() {
    // Prefer live in-memory WorkDesk Active Task data. Do not reuse Inventory-mode tasks.
    try {
        const lastMode = String(window.IBA_ACTIVE_TASK_LAST_MODE || '').toLowerCase();
        if (lastMode && lastMode !== 'workdesk') return [];
    } catch (e) { /* ignore */ }

    try {
        if (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks) && userActiveTasks.length) {
            return userActiveTasks.slice();
        }
    } catch (e) { /* ignore */ }
    try {
        if (window.userActiveTasks && Array.isArray(window.userActiveTasks) && window.userActiveTasks.length) {
            return window.userActiveTasks.slice();
        }
    } catch (e) { /* ignore */ }

    // 8.5.1: If the user already loaded Active Task in this tab, reuse that short session snapshot.
    // This avoids another Firebase read just to rebuild the dashboard.
    return wdLoadActiveTaskSourceSnapshot();
}
function wdFindInvoiceMetaForActiveTask(task) {
    const po = wdText(task?.po || task?.originalPO || '');
    if (!po || !allInvoiceData || !allInvoiceData[po]) return {};

    const invoices = allInvoiceData[po] || {};
    const directKey = wdText(task?.originalKey || task?.invoiceKey || task?.key || '');
    if (directKey && invoices[directKey]) return invoices[directKey] || {};

    const ref = wdText(task?.ref || task?.invNumber || '');
    const invEntryID = wdText(task?.invEntryID || '');
    for (const k in invoices) {
        const inv = invoices[k] || {};
        if (invEntryID && wdText(inv.invEntryID || '') === invEntryID) return inv;
        if (ref && wdText(inv.invNumber || inv.ref || '') === ref) return inv;
    }
    return {};
}

function wdIsDashboardActiveTaskSourceItem(task) {
    if (!task) return false;

    const taskFor = wdText(task.for || task.type || '');
    const source = wdText(task.source || '');
    const status = wdStatus(task.remarks || task.status || 'Pending');
    const statusNorm = wdNormalize(status);

    if (wdIsConvertedInvoiceJobEntry(task)) return false;

    // Dashboard source must mirror WorkDesk Active Task, but only invoice-related items.
    if (['Transfer', 'Restock', 'Return', 'Usage'].includes(taskFor) || source === 'transfer_entry') return false;

    // IPC is intentionally added from Job Records only, so Active Task "For IPC" / IPC rows
    // do not create a second wrong card/count.
    if (['IPC', 'IPC Application', 'IPC Processed'].includes(taskFor) || source === 'ipc_job' || statusNorm.includes('ipc') || statusNorm === 'waiting invoice') return false;

    const isInvoiceRelated = taskFor === 'Invoice' || source === 'invoice' || source === 'invoice_record' || source === 'job_entry';
    if (!isInvoiceRelated) return false;

    // All Active Tasks remains the system overview only. Personal-only statuses
    // such as For SRV are handled by wdPersonalDashboardTasks and should not create
    // extra All Active cards.
    if (!wdIsDashboardOpenStatus(status, source === 'job_entry' ? 'job_entry' : taskFor)) return false;
    return true;
}

async function wdNormalizeActiveTaskForDashboard(task, ipcMap) {
    const po = wdText(task.po || task.originalPO || task.ref || '');
    const poDetails = await wdGetPODetails(po);
    const invMeta = wdFindInvoiceMetaForActiveTask(task);

    let status = wdStatus(task.remarks || task.status || 'Pending');
    if (task.source !== 'job_entry' && invMeta && typeof invMeta === 'object' && Object.keys(invMeta).length) {
        status = wdCurrentInvoiceTaskStatus(task, invMeta);
    }
    if (task.source === 'job_entry' && task.for === 'Invoice' && wdIsNewEntryStatus(status)) status = 'New Entry';

    const isJobEntry = task.source === 'job_entry';
    const sourceText = wdNormalize(task.source || '');
    const taskForText = wdNormalize(task.for || task.type || '');
    // 10.1.4: IPC / non-Invoice Job Records must never show supplier Invoice Date.
    // Their task date is the Entered/queue date only.
    const isNonInvoiceJobRecord = isJobEntry
        ? taskForText && taskForText !== 'invoice' && taskForText !== 'invoice job'
        : (sourceText === 'ipc_job_record' || taskForText === 'ipc');
    let type = isJobEntry ? 'Invoice Job' : 'Invoice';
    if (isJobEntry && taskForText === 'ipc application') type = 'IPC Application';
    if (isJobEntry && (taskForText === 'ipc processed' || taskForText === 'ipc')) type = 'IPC Processed';
    const bucketType = (type === 'IPC Application' || type === 'IPC Processed') ? type : (isJobEntry ? 'job_entry' : type);
    const bucket = wdDashboardAllowedBucket(status, bucketType) || wdDashboardBucket(status, type);
    const ipcInfo = ipcMap.get(po);

    const site = wdText(
        task.site || task.Site || invMeta.site || invMeta.site_name || invMeta.siteName ||
        wdGetPOValue(poDetails, ['Project ID', 'Project ID:', 'Site'], ''),
        'N/A'
    );

    const vendorName = wdText(
        task.vendorName || task.vendor || invMeta.vendorName || invMeta.vendor_name ||
        wdGetPOValue(poDetails, ['Supplier Name', 'Supplier Name:', 'Supplier', 'Supplier:', 'Vendor Name'], ''),
        'N/A'
    );

    const queueTimestamp = wdQueueTimestampForTask(task, invMeta, bucket || status, type);

    return {
        id: `active_${task.key || po || task.ref || Math.random()}`,
        key: task.key || '',
        originalKey: task.originalKey || '',
        source: task.source || 'active_task',
        type,
        po,
        ref: wdText(task.ref || invMeta.invNumber || ''),
        vendorName,
        site,
        siteName: task.siteName || invMeta.siteName || invMeta.projectName || wdResolveSiteNameFromPODetails(poDetails),
        status,
        bucket,
        note: wdText(task.note || task.details || task.currentNote || invMeta.note || ''),
        attention: task.attention || invMeta.attention || '',
        enteredBy: task.enteredBy || invMeta.enteredBy || invMeta.updatedBy || '',
        ipc: wdFormatIPCText(ipcInfo),
        ipcActive: !!ipcInfo,
        invName: task.invName || invMeta.invName || '',
        reportName: task.reportName || invMeta.reportName || '',
        srvName: task.srvName || invMeta.srvName || '',
        amount: task.amountPaid || task.amount || invMeta.amountPaid || invMeta.invValue || '',
        group: (isJobEntry && taskForText === 'invoice') ? (task.group || '') : (task.group || invMeta.group || ''),
        // 10.1.3: For Job Entry records, date is the Entered Date. It must not be reused
        // as supplier Invoice Date. IPC / PR / Payment / Report tasks have no invoiceDate
        // until they become a real Invoice task.
        date: task.date || invMeta.invoiceDate || '',
        invoiceDate: isNonInvoiceJobRecord ? '' : (isJobEntry ? (taskForText === 'invoice' || taskForText === 'invoice job' ? (task.invoiceDate || '') : '') : (invMeta.invoiceDate || task.invoiceDate || '')),
        linkedJobEntryKey: task.linkedJobEntryKey || invMeta.linkedJobEntryKey || '',
        jobRecordDateEntered: task.jobRecordDateEntered || task.originDateEntered || task.dateEntered || invMeta.jobRecordDateEntered || invMeta.originDateEntered || invMeta.dateEntered || '',
        originDateEntered: task.originDateEntered || invMeta.originDateEntered || '',
        dateEntered: task.dateEntered || invMeta.dateEntered || '',
        jobRecordTimestamp: task.jobRecordTimestamp || invMeta.jobRecordTimestamp || task.originTimestamp || invMeta.originTimestamp || '',
        queueLabel: wdQueueLabelForTask(bucket || status, type),
        queueTimestamp,
        queueText: wdQueueFullText(queueTimestamp),
        queueTone: wdQueueAgeParts(queueTimestamp).tone,
        timestamp: Number(queueTimestamp || task.invoiceLastUpdated || wdEntryTimestamp(invMeta) || task.timestamp || 0)
    };
}


async function wdNormalizePersonalTaskForDashboard(task) {
    const normalized = await wdNormalizeActiveTaskForDashboard(task, new Map());
    const status = wdStatus(task.remarks || task.status || normalized.status || 'Pending');
    const personalBucket = wdDashboardPersonalBucket(status, normalized.type || task.for || task.type || task.source || normalized.source);
    if (!personalBucket) return null;
    normalized.status = status;
    normalized.personalBucket = personalBucket;
    normalized.bucket = personalBucket;
    normalized.id = `personal_${task.key || task.originalKey || task.po || task.ref || Math.random()}`;
    return normalized;
}

async function wdBuildPersonalDashboardTasks(sourceList) {
    const source = wdGetPersonalDashboardSourceList(sourceList);
    const tasks = [];
    for (const task of source) {
        const normalized = await wdNormalizePersonalTaskForDashboard(task);
        if (normalized) tasks.push(normalized);
    }

    const seen = new Set();
    const unique = [];
    for (const task of tasks) {
        const key = wdDashboardDedupeKey(task);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(task);
    }
    return unique.sort((a, b) => {
        const ba = wdNormalize(a.personalBucket || a.bucket || '');
        const bb = wdNormalize(b.personalBucket || b.bucket || '');
        const order = WD_STATUS_ORDER.map(wdNormalize);
        const ia = order.indexOf(ba);
        const ib = order.indexOf(bb);
        if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
        if (ia !== -1 && ib === -1) return -1;
        if (ia === -1 && ib !== -1) return 1;
        return wdCompareDashboardPriority(a, b);
    });
}

function wdDashboardDedupeKey(task) {
    const source = wdText(task?.source || '');
    const type = wdText(task?.type || '');
    const directKey = wdText(task?.key || task?.id || task?.originalKey || '');
    const po = wdText(task?.po || task?.originalPO || '');

    // 9.3.7: Invoice task lookup records must dedupe by PO + invoice key.
    // The invoice key alone can repeat across different POs, which caused
    // counts like For SRV to collapse and become inaccurate.
    if (source.includes('invoice_task_lookup')) {
        const ref = wdText(task?.ref || task?.invEntryID || '');
        return `${source}|${type}|${po}|${directKey || ref}`;
    }
    // 9.3.2: Job Records, especially IPC entries, must not collapse just because
    // they share the same PO or have a blank reference. Use the Firebase/job key first.
    if (directKey && (source.includes('job') || source.includes('ipc'))) {
        return `${source}|${type}|${directKey}`;
    }
    const ref = wdText(task?.ref || task?.originalKey || task?.key || '');
    return `${source}|${type}|${po}|${ref}`;
}


// 11.1.0: Dashboard duplicate-source cleanup.
// A WorkDesk Job Record is only the intake/source record. When an invoice entry
// already exists for that same job/PO and is active in invoice_tasks_by_user/All,
// Dashboard must show only the live invoice task (Report/In Process/For SRV/etc.)
// and hide the old New Entry job card. This uses only the already-loaded compact
// active invoice index, not a full invoice_entries or job_entries scan.
function wdJobEntryIsClosedForDashboard(entry = {}) {
    if (!entry || typeof entry !== 'object') return false;
    const flagValues = [
        entry.convertedToInvoice,
        entry.archived,
        entry.closed,
        entry.completed,
        entry.activeDashboard === false,
        entry.dashboardActive === false,
        entry.hideFromDashboard,
        entry.hideFromWorkdeskDashboard
    ];
    if (flagValues.some(Boolean)) return true;

    const status = wdNormalize(entry.remarks || entry.status || entry.currentStatus || entry.Status || entry.Remarks || '');
    if (status === 'converted to invoice' || status === 'completed' || status === 'closed') return true;
    if (status.includes('converted') && status.includes('invoice')) return true;
    return false;
}

function wdAddDashboardLinkKey(set, value, prefix = '') {
    if (!set) return;
    const raw = wdText(value || '');
    if (!raw) return;
    set.add(`${prefix}${wdNormalize(raw)}`);
}

function wdActiveInvoiceLinkKeySet(invoiceTasks = []) {
    const set = new Set();
    (Array.isArray(invoiceTasks) ? invoiceTasks : []).forEach(task => {
        if (!task || typeof task !== 'object') return;
        const po = wdText(task.po || task.originalPO || task.linkedInvoicePO || '');
        const ref = wdText(task.ref || task.invEntryID || task.invoiceNo || task.invNumber || '');
        const invoiceKey = wdText(task.originalKey || task.invoiceKey || task.key || '');

        wdAddDashboardLinkKey(set, task.linkedJobEntryKey || task.originJobEntryKey || task.jobEntryKey, 'jobkey|');
        wdAddDashboardLinkKey(set, task.jobRecordTimestamp || task.originTimestamp, 'jobts|');
        wdAddDashboardLinkKey(set, task.linkedInvoiceKey || invoiceKey, 'invkey|');
        if (po) wdAddDashboardLinkKey(set, po, 'po|');
        if (po && ref) wdAddDashboardLinkKey(set, `${po}|${ref}`, 'poref|');
    });
    return set;
}

function wdJobEntryMatchesActiveInvoice(entry = {}, activeInvoiceLinkKeys) {
    if (!activeInvoiceLinkKeys || !activeInvoiceLinkKeys.size || !entry) return false;
    const po = wdText(entry.po || entry.originalPO || entry.PO || entry.ref || '');
    const ref = wdText(entry.ref || entry.invEntryID || entry.invoiceNo || entry.invNumber || '');

    const candidates = [
        ['jobkey|', entry.key || entry.id || entry.linkedJobEntryKey || entry.originJobEntryKey || entry.jobEntryKey],
        ['jobts|', entry.timestamp || entry.originTimestamp || entry.jobRecordTimestamp],
        ['invkey|', entry.linkedInvoiceKey || entry.invoiceKey || entry.originalKey],
        ['po|', po]
    ];
    for (const [prefix, value] of candidates) {
        const raw = wdText(value || '');
        if (raw && activeInvoiceLinkKeys.has(`${prefix}${wdNormalize(raw)}`)) return true;
    }
    if (po && ref && activeInvoiceLinkKeys.has(`poref|${wdNormalize(`${po}|${ref}`)}`)) return true;
    return false;
}


// 10.0.4: New Entry should also be visible in Admin/Super Admin All Active Tasks.
// It comes from WorkDesk Job Records (Date Entered source), not invoice_entries.
async function wdBuildNewEntryJobRecordTasks(activeInvoiceLinkKeys = null) {
    const tasks = [];
    const entries = wdGetDashboardJobEntriesList();

    for (const [rowIndex, entry] of entries.entries()) {
        if (!entry) continue;
        if (wdJobEntryIsClosedForDashboard(entry)) continue;
        if (wdJobEntryMatchesActiveInvoice(entry, activeInvoiceLinkKeys)) continue;

        const forText = wdNormalize(entry.for || entry.For || entry.type || entry.Type || '');
        const isInvoiceJob = forText === 'invoice' || forText === 'invoice job' || forText.includes('invoice');
        if (!isInvoiceJob) continue;

        const status = wdEntryStatus(entry);
        if (!wdIsJobNewEntryQueue(entry, status, 'job_entry')) continue;
        if (typeof isTaskComplete === 'function' && isTaskComplete(entry)) continue;

        const po = wdText(entry.po || entry.originalPO || entry.PO || entry.ref || '');
        const poDetails = await wdGetPODetails(po);
        const site = wdText(
            entry.site || entry.Site || entry.projectId || entry.projectID ||
            wdGetPOValue(poDetails, ['Project ID', 'Project ID:', 'Project', 'Site'], ''),
            'N/A'
        );
        if (!wdSiteMatchesCurrentUser(site)) continue;

        const vendorName = wdText(
            entry.vendorName || entry.vendor || entry.Supplier || entry.supplierName ||
            wdGetPOValue(poDetails, ['Supplier Name', 'Supplier Name:', 'Supplier', 'Supplier:', 'Vendor Name'], ''),
            'N/A'
        );

        const jobKey = wdText(entry.key || entry.id || `${po}_${entry.ref || ''}_${entry.date || entry.timestamp || ''}_${rowIndex}`);
        const queueTimestamp = wdQueueTimestampForTask(entry, {}, 'New Entry', 'job_entry');

        tasks.push({
            id: `new_entry_${jobKey || po || rowIndex}`,
            key: entry.key || '',
            originalKey: entry.key || '',
            source: 'job_entry',
            for: 'Invoice',
            type: 'Invoice Job',
            po,
            ref: wdText(entry.ref || entry.invoiceNo || entry.invNumber || entry.invEntryID || ''),
            invEntryID: wdText(entry.invEntryID || entry.entryId || ''),
            vendorName,
            site,
            siteName: entry.siteName || entry.projectName || wdResolveSiteNameFromPODetails(poDetails),
            group: entry.group || '',
            status: 'New Entry',
            remarks: 'New Entry',
            bucket: 'New Entry',
            note: wdText(entry.note || entry.details || entry.description || ''),
            attention: entry.attention || entry.Attention || '',
            enteredBy: entry.enteredBy || entry.createdBy || entry.updatedBy || '',
            invName: entry.invName || '',
            reportName: entry.reportName || '',
            srvName: entry.srvName || '',
            amount: entry.amount || entry.invoiceValue || entry.invValue || '',
            amountPaid: entry.amountPaid || entry.amount || entry.invoiceValue || entry.invValue || '',
            date: entry.invoiceDate || entry.invDate || '',
            invoiceDate: entry.invoiceDate || entry.invDate || '',
            linkedJobEntryKey: entry.key || '',
            jobRecordDateEntered: entry.date || entry.dateEntered || entry.entryDate || '',
            originDateEntered: entry.date || entry.dateEntered || entry.entryDate || '',
            dateEntered: entry.date || entry.dateEntered || entry.entryDate || '',
            jobRecordTimestamp: entry.timestamp || entry.originTimestamp || '',
            queueLabel: wdQueueLabelForTask('New Entry', 'job_entry'),
            queueTimestamp,
            queueText: wdQueueFullText(queueTimestamp),
            queueTone: wdQueueAgeParts(queueTimestamp).tone,
            timestamp: queueTimestamp || wdEntryTimestamp(entry),
            isUrgent: false
        });
    }

    return tasks;
}


async function wdBuildIPCJobRecordTasks(ipcMap) {
    const tasks = [];
    const entries = wdGetDashboardJobEntriesList();

    for (const [rowIndex, entry] of entries.entries()) {
        const entryForNorm = wdNormalize(entry.for || entry.type || '');
        if (!entry || !['ipc', 'ipc processed', 'ipc application'].includes(entryForNorm)) continue;

        // IPC is a special supplier-follow-up list from Job Records. Do not require it
        // to be in My Active Task; only hide truly completed/closed records.
        const status = wdEntryStatus(entry);
        if (!wdIsOpenIPCJobStatus(status)) continue;

        const po = wdText(entry.po || entry.originalPO || entry.ref || '');
        const poDetails = await wdGetPODetails(po);
        const site = wdText(entry.site || entry.Site || wdGetPOValue(poDetails, ['Project ID', 'Project ID:', 'Site'], ''), 'N/A');
        if (!wdSiteMatchesCurrentUser(site)) continue;

        const jobKey = wdText(entry.key || entry.id || `${po}_${entry.ref || ''}_${entry.date || entry.timestamp || ''}_${rowIndex}`);
        const ipcInfo = ipcMap.get(po);
        const isIPCApplication = entryForNorm === 'ipc application';
        const displayType = isIPCApplication ? 'IPC Application' : 'IPC Processed';
        const displayStatus = isIPCApplication
            ? wdText(status, 'Pending')
            : (wdNormalize(status) === 'ipc' ? 'Waiting Invoice' : wdText(status, 'Waiting Invoice'));
        const displayBucket = isIPCApplication ? 'IPC Application' : 'IPC Processed';
        const queueTimestamp = wdQueueTimestampForTask(entry, {}, displayBucket, displayType);

        tasks.push({
            id: `ipc_${jobKey || po || entry.ref || Math.random()}`,
            key: entry.key || '',
            source: 'ipc_job_record',
            type: displayType,
            po,
            ref: wdText(entry.ref || entry.ipcNo || ''),
            vendorName: wdText(entry.vendorName || entry.vendor || entry.Supplier || wdGetPOValue(poDetails, ['Supplier Name', 'Supplier Name:', 'Supplier'], ''), 'N/A'),
            site,
            siteName: entry.siteName || entry.projectName || wdResolveSiteNameFromPODetails(poDetails),
            status: displayStatus,
            bucket: displayBucket,
            note: wdText(entry.note || entry.details || entry.description || ''),
            ipc: isIPCApplication ? 'Pending IPC application' : 'IPC processed',
            ipcActive: true,
            attention: entry.attention || '',
            enteredBy: entry.enteredBy || entry.updatedBy || '',
            invName: entry.invName || '',
            reportName: entry.reportName || '',
            srvName: entry.srvName || '',
            amount: entry.amount || entry.invoiceValue || '',
            // 10.1.4: IPC is not an invoice yet. Keep Entered Date separate and
            // leave supplier Invoice Date blank until IPC is converted to Invoice.
            date: entry.date || '',
            invoiceDate: '',
            jobRecordDateEntered: entry.date || entry.dateEntered || entry.entryDate || '',
            originDateEntered: entry.date || entry.dateEntered || entry.entryDate || '',
            dateEntered: entry.date || entry.dateEntered || entry.entryDate || '',
            jobRecordTimestamp: entry.timestamp || entry.originTimestamp || '',
            queueLabel: wdQueueLabelForTask(displayBucket, displayType),
            queueTimestamp,
            queueText: wdQueueFullText(queueTimestamp),
            queueTone: wdQueueAgeParts(queueTimestamp).tone,
            timestamp: wdEntryTimestamp(entry) || (ipcInfo ? ipcInfo.latestTimestamp : 0) || queueTimestamp
        });
    }

    return tasks;
}


async function wdBuildInvoiceRecordOverviewTasks(forceRefresh = false) {
    // 9.3.7: All Active dashboard counts must come from actual Firebase
    // Invoice Management records for invoice-status stages such as For SRV,
    // Report, On Hold, In Process, and Unresolved. Do not use the old
    // invoice_tasks_by_user lookup for these counts because it can retain
    // stale/duplicated task rows and inflate counts.
    const source = [];
    const invoiceData = (typeof allInvoiceData !== 'undefined' && allInvoiceData) ? allInvoiceData : {};
    if (!invoiceData || typeof invoiceData !== 'object') return source;

    for (const po of Object.keys(invoiceData)) {
        const invoices = invoiceData[po] || {};
        if (!invoices || typeof invoices !== 'object') continue;

        const poDetails = await wdGetPODetails(po);
        for (const invoiceKey of Object.keys(invoices)) {
            const inv = invoices[invoiceKey] || {};
            if (!inv || typeof inv !== 'object') continue;

            const status = wdDashboardInvoiceStatusLabel(wdInvoiceRecordStatus(inv));
            if (!status) continue;
            const bucket = status;

            const site = wdResolveInvoiceSite(inv, poDetails);
            if (!wdSiteMatchesCurrentUser(site)) continue;

            const ref = wdText(inv.invNumber || inv.invoiceNo || inv.ref || inv.invoiceNumber || invoiceKey);
            const invEntryID = wdText(inv.invEntryID || inv.entryId || inv.entryID || '');
            const queueTimestamp = wdQueueTimestampForTask(inv, inv, bucket || status, 'Invoice');
            source.push({
                key: `${po}_${invoiceKey}`,
                originalKey: invoiceKey,
                originalPO: po,
                source: 'invoice_record',
                for: 'Invoice',
                type: 'Invoice',
                ref,
                invEntryID,
                po,
                amount: inv.invValue || inv.invoiceValue || inv.amount || '',
                amountPaid: inv.amountPaid || inv.paidAmount || inv.invValue || inv.invoiceValue || inv.amount || '',
                site,
                siteName: inv.siteName || inv.projectName || wdResolveSiteNameFromPODetails(poDetails),
                group: 'N/A',
                attention: inv.attention || inv.Attention || inv.assignedTo || inv.assigned_to || '',
                enteredBy: inv.enteredBy || inv.updatedBy || inv.createdBy || '',
                date: inv.invoiceDate || inv.invDate || inv.date || '',
                invoiceDate: inv.invoiceDate || inv.invDate || inv.date || '',
                queueLabel: wdQueueLabelForTask(bucket || status, 'Invoice'),
                queueTimestamp,
                queueText: wdQueueFullText(queueTimestamp),
                queueTone: wdQueueAgeParts(queueTimestamp).tone,
                remarks: status,
                status,
                bucket,
                invName: inv.invName || inv.invoiceName || '',
                reportName: inv.reportName || '',
                srvName: inv.srvName || inv.srvPDF || inv.srvPdf || '',
                vendorName: wdResolveInvoiceVendor(inv, poDetails),
                note: inv.note || inv.details || inv.description || '',
                timestamp: Number(inv.invoiceLastUpdated || inv.lastUpdated || inv.updatedAt || inv.enteredAt || 0) || wdEntryTimestamp(inv) || queueTimestamp,
                isUrgent: false
            });
        }
    }

    return source;
}

async function wdBuildInvoiceTaskLookupOverviewTasks(forceRefresh = false) {
    // 11.0.5: Download reduction. All Active Dashboard must NOT read the full
    // invoice_entries tree. Use the compact active-task index at
    // invoice_tasks_by_user/All, then verify each visible row by its exact
    // invoice_entries/{PO}/{invoiceKey} record. This keeps accuracy while avoiding
    // multi-MB full-tree reads when many users leave WorkDesk open.
    const resultByInvoiceKey = new Map();
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return [];

    try {
        let nodes = wdGetLiveInvoiceTaskLookupNodes(forceRefresh);
        let allInbox = nodes && nodes.All && typeof nodes.All === 'object' ? nodes.All : null;
        if (!allInbox) {
            const snapshot = await invoiceDb.ref('invoice_tasks_by_user/All').once('value');
            if (!snapshot.exists()) return [];
            allInbox = snapshot.val() || {};
            nodes = { All: allInbox };
            wdSetInvoiceTaskLookupLiveCache(nodes, 'all-once');
        }

        const ownerKey = 'All';
        const ownerIsAll = true;
        const invoiceKeys = Object.keys(allInbox || {});
        for (const invoiceKey of invoiceKeys) {
            const task = allInbox[invoiceKey] || {};
            if (!task || typeof task !== 'object') continue;

            const po = wdText(task.po || task.originalPO || '');
            const latestInv = await wdGetInvoiceSourceTruth(po, invoiceKey, forceRefresh, task);
            if (!latestInv || typeof latestInv !== 'object') {
                await wdCleanupStaleInvoiceLookupRow(ownerKey, invoiceKey);
                continue;
            }

            const status = wdCurrentInvoiceTaskStatus(task, latestInv || {});
            const stillActive = (typeof isInvoiceTaskActive === 'function')
                ? isInvoiceTaskActive(latestInv)
                : !wdIsInvoiceLookupComplete(status);
            if (!stillActive || wdIsInvoiceLookupComplete(status)) {
                await wdCleanupStaleInvoiceLookupRow(ownerKey, invoiceKey);
                continue;
            }

            const bucket = wdDashboardAllowedBucket(status, 'invoice_task_lookup');
            if (!bucket) continue;

            const latestAttention = wdText(latestInv.attention || latestInv.Attention || latestInv.assignedTo || task.attention || '');
            const attention = wdDashboardTaskOwnerAttention(ownerKey, { ...task, attention: latestAttention });

            // All Active excludes the current user's personal tasks. The caller
            // also checks against wdPersonalDashboardTasks, but doing it here keeps
            // counts from bloating before dedupe.
            if (wdTaskHasAttentionName({ attention }, wdCurrentUserNameNorm())) continue;

            const lookupTaskKey = `${po}||${invoiceKey}`;
            const poDetails = await wdGetPODetails(po);
            const site = wdText(
                task.site || task.Site || latestInv.site || latestInv.site_name || latestInv.siteName || wdGetPOValue(poDetails, ['Project ID', 'Project ID:', 'Site'], ''),
                'N/A'
            );
            if (!wdSiteMatchesCurrentUser(site)) continue;

            const vendorName = wdText(
                task.vendorName || task.vendor || latestInv.vendorName || latestInv.vendor_name || latestInv.vendor || wdGetPOValue(poDetails, ['Supplier Name', 'Supplier Name:', 'Supplier', 'Supplier:', 'Vendor Name'], ''),
                'N/A'
            );
            const latestMeta = latestInv || {};
            const queueTimestamp = wdQueueTimestampForTask(task, latestMeta, bucket || status, 'Invoice');
            const normalized = {
                key: `${po}_${invoiceKey}`,
                originalKey: invoiceKey,
                originalPO: po,
                source: 'invoice_task_lookup',
                ownerKey,
                for: 'Invoice',
                type: 'Invoice',
                ref: wdText(task.ref || latestMeta.invNumber || latestMeta.invoiceNo || invoiceKey),
                invEntryID: latestMeta.invEntryID || task.invEntryID || '',
                po,
                amount: task.amount || latestMeta.invValue || latestMeta.invoiceValue || latestMeta.amount || '',
                amountPaid: task.amountPaid || task.amount || latestMeta.amountPaid || latestMeta.invValue || latestMeta.invoiceValue || latestMeta.amount || '',
                site,
                siteName: task.siteName || latestMeta.siteName || latestMeta.projectName || wdResolveSiteNameFromPODetails(poDetails),
                group: 'N/A',
                attention,
                enteredBy: task.enteredBy || latestMeta.enteredBy || latestMeta.updatedBy || '',
                date: latestMeta.invoiceDate || task.invoiceDate || '',
                invoiceDate: latestMeta.invoiceDate || task.invoiceDate || '',
                linkedJobEntryKey: task.linkedJobEntryKey || latestMeta.linkedJobEntryKey || '',
                jobRecordDateEntered: task.jobRecordDateEntered || task.originDateEntered || task.dateEntered || latestMeta.jobRecordDateEntered || latestMeta.originDateEntered || latestMeta.dateEntered || '',
                originDateEntered: task.originDateEntered || latestMeta.originDateEntered || '',
                dateEntered: task.dateEntered || latestMeta.dateEntered || '',
                jobRecordTimestamp: task.jobRecordTimestamp || latestMeta.jobRecordTimestamp || task.originTimestamp || latestMeta.originTimestamp || '',
                queueLabel: wdQueueLabelForTask(bucket || status, 'Invoice'),
                queueTimestamp,
                queueText: wdQueueFullText(queueTimestamp),
                queueTone: wdQueueAgeParts(queueTimestamp).tone,
                remarks: status,
                status: bucket,
                bucket,
                invName: task.invName || latestMeta.invName || '',
                reportName: task.reportName || latestMeta.reportName || '',
                srvName: task.srvName || latestMeta.srvName || latestMeta.srvPDF || latestMeta.srvPdf || '',
                vendorName,
                note: task.note || latestMeta.note || latestMeta.details || '',
                timestamp: Number(queueTimestamp || task.invoiceLastUpdated || latestMeta.lastUpdated || latestMeta.updatedAt || latestMeta.enteredAt || task.timestamp || 0),
                isUrgent: false
            };

            resultByInvoiceKey.set(lookupTaskKey, normalized);
        }
    } catch (e) {
        console.warn('WorkDesk dashboard could not read invoice task lookup:', e);
    }

    return Array.from(resultByInvoiceKey.values());
}

function wdOverviewInvoiceIdentity(task = {}) {
    const po = wdText(task.originalPO || task.po || '');
    const key = wdText(task.originalKey || task.invoiceKey || task.key || '');
    const ref = wdText(task.invEntryID || task.ref || '');
    return `${po}||${key || ref}`;
}

async function wdBuildDashboardOverviewSourceTasks(forceRefresh = false) {
    const sourceMap = new Map();

    // 11.0.5: Dashboard All Active now uses the compact active-task index and
    // exact per-invoice validation. Do not call wdEnsureDashboardInvoiceEntriesFetched()
    // here because that downloads the whole invoice_entries tree and quickly burns
    // Firebase download quota when multiple users leave WorkDesk open.
    const currentInvoiceTasks = await wdBuildInvoiceTaskLookupOverviewTasks(forceRefresh);
    currentInvoiceTasks.forEach(task => sourceMap.set(wdOverviewInvoiceIdentity(task), task));

    try { await wdEnsureDashboardJobEntriesFetched(forceRefresh); }
    catch (e) { console.warn('WorkDesk dashboard could not refresh Job Records:', e); }

    return Array.from(sourceMap.values());
}

async function wdBuildDashboardTasks(options = {}) {
    const tasks = [];
    const forceRefresh = !!options.forceRefresh;
    const includeAllActive = options.includeAllActive === true;

    // 9.4.8/10.3.3: Build My Personal Tasks first. Normal/User accounts stop here.
    // Admin/Super Admin also stop here on first Dashboard open; the global All Active
    // overview is fetched only after an Admin clicks an All Active status card.
    const exactMyActiveTasks = await wdGetExactMyActiveTaskList(forceRefresh);
    wdPersonalDashboardTasks = await wdBuildPersonalDashboardTasks(exactMyActiveTasks);

    if (!wdCanSeeAllActiveDashboard() || !includeAllActive) {
        return [];
    }

    const activeSource = await wdBuildDashboardOverviewSourceTasks(forceRefresh);
    const activeInvoiceLinkKeys = wdActiveInvoiceLinkKeySet(activeSource.filter(task => wdNormalize(task?.source || '').includes('invoice')));
    const personalKeySet = wdBuildPersonalTaskKeySet();
    const ipcMap = wdBuildIPCMap();
    const activeSourceTasks = activeSource.filter(wdIsDashboardActiveTaskSourceItem);

    for (const task of activeSourceTasks) {
        const normalized = await wdNormalizeActiveTaskForDashboard(task, ipcMap);
        if (wdDashboardTaskIsAlreadyPersonal(normalized, personalKeySet)) continue;
        tasks.push(normalized);
    }

    // 10.0.4: New Entry is also an All Active open task for Admin/Super Admin.
    // It is sourced from WorkDesk Job Records so Head Office can see newly received invoices.
    const newEntryJobRecordTasks = await wdBuildNewEntryJobRecordTasks(activeInvoiceLinkKeys);
    newEntryJobRecordTasks.forEach(task => {
        if (!wdDashboardTaskIsAlreadyPersonal(task, personalKeySet)) tasks.push(task);
    });

    // IPC stays as a separate Job Records list so supplier follow-up remains visible.
    const ipcJobRecordTasks = await wdBuildIPCJobRecordTasks(ipcMap);
    ipcJobRecordTasks.forEach(task => {
        if (!wdDashboardTaskIsAlreadyPersonal(task, personalKeySet)) tasks.push(task);
    });

    const finalInvoiceLinkKeys = wdActiveInvoiceLinkKeySet(tasks.filter(task => wdNormalize(task?.source || '').includes('invoice')));
    const filteredTasks = tasks.filter(task => {
        const source = wdNormalize(task?.source || '');
        if (!source.includes('job')) return true;
        if (task.bucket !== 'New Entry' && !wdIsNewEntryStatus(task.status || task.remarks)) return true;
        return !wdJobEntryMatchesActiveInvoice(task, finalInvoiceLinkKeys);
    });

    const seen = new Set();
    const unique = [];
    for (const task of filteredTasks) {
        const key = wdDashboardDedupeKey(task);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(task);
    }

    return unique.sort(wdCompareDashboardPriority);
}

function wdBuildAllActiveCountItemsFromTasks(tasks = [], savedAt = Date.now()) {
    const counts = {};
    const items = [];
    (Array.isArray(tasks) ? tasks : []).forEach(task => {
        if (!task || typeof task !== 'object') return;
        const bucket = task.bucket || wdDashboardBucket(task.status, task.type);
        if (!bucket) return;
        wdIncrementAllActiveCount(counts, bucket);
        const source = wdNormalize(task.source || task.type || '');
        const kind = source.includes('job') ? 'job' : 'invoice';
        const identityKey = wdDashboardTaskIdentityKey(task);
        items.push({
            kind,
            itemKey: kind === 'job' ? `job|${wdNormalize(task.key || task.id || identityKey)}` : identityKey,
            po: task.po || task.originalPO || '',
            invoiceKey: task.originalKey || task.invoiceKey || task.key || '',
            key: task.key || task.id || '',
            bucket,
            active: true,
            updatedAt: Number(task.timestamp || task.queueTimestamp || task.updatedAt || savedAt || Date.now()) || Date.now(),
            task
        });
    });
    return { counts, items };
}

function wdApplyVerifiedAllActiveDashboardCache(tasks = [], reason = 'verified-all-active') {
    const verifiedTasks = (Array.isArray(tasks) ? tasks.slice() : []).sort(wdCompareDashboardPriority);
    const savedAt = Date.now();

    // 11.2.1: If a background refresh gives an empty temporary result, keep the
    // last known good All Active cards/counts on screen. This prevents the
    // visible section from blinking 3 -> dash/empty -> 3 while loaders settle.
    if (!verifiedTasks.length && wdShouldProtectAllActiveFromBlank(reason)) {
        wdActiveDashboardCacheMeta = {
            fromCache: true,
            savedAt: wdAllActiveDashboardCountSavedAt || savedAt,
            reason: `${reason || 'refresh'}-blank-protected`,
            verified: true,
            protectedBlank: true
        };
        return false;
    }

    wdActiveDashboardTasks = verifiedTasks;
    wdAllActiveDashboardLoaded = true;

    const exact = wdBuildAllActiveCountItemsFromTasks(verifiedTasks, savedAt);
    wdSetAllActiveDashboardCountMap(exact.counts, savedAt, exact.items);
    wdSaveAllActiveDashboardCountsCache(exact.counts, exact.items);

    wdActiveDashboardCacheMeta = { fromCache: false, savedAt, reason, verified: true };
    wdSaveDashboardCache(verifiedTasks, wdPersonalDashboardTasks, {
        allActiveVerified: true,
        verifiedAt: savedAt,
        reason
    });
    return true;
}

function wdRestoreVerifiedAllActiveDashboardCache(cached) {
    if (!wdDashboardCacheHasVerifiedAllActive(cached)) return false;
    wdActiveDashboardTasks = (Array.isArray(cached.tasks) ? cached.tasks.slice() : []).sort(wdCompareDashboardPriority);
    wdAllActiveDashboardLoaded = true;
    const savedAt = Number(cached.verifiedAt || cached.savedAt || Date.now()) || Date.now();
    const exact = wdBuildAllActiveCountItemsFromTasks(wdActiveDashboardTasks, savedAt);
    wdSetAllActiveDashboardCountMap(exact.counts, savedAt, exact.items);
    wdActiveDashboardCacheMeta = { fromCache: true, savedAt, reason: 'verified-cache', verified: true };
    return true;
}

async function wdRefreshVerifiedAllActiveDashboardCache(options = {}) {
    if (!wdCanSeeAllActiveDashboard() || !wdIsDashboardVisible()) return false;
    if (wdDashboardVerifiedRefreshRunning || wdAllActiveDashboardLoading) return false;

    const forceRefresh = !!options.forceRefresh;
    const reason = options.reason || 'verified-dashboard-refresh';
    const skipVerifiedCacheCheck = options.skipVerifiedCacheCheck === true;

    if (!forceRefresh && !skipVerifiedCacheCheck) {
        const cached = wdLoadDashboardCache();
        if (wdRestoreVerifiedAllActiveDashboardCache(cached)) {
            wdRenderDashboardCards();
            return true;
        }
    }

    wdDashboardVerifiedRefreshRunning = true;
    wdAllActiveDashboardLoading = true;
    wdRenderDashboardCards();

    try {
        const verifiedTasks = await wdBuildDashboardTasks({ forceRefresh, includeAllActive: true });
        wdApplyVerifiedAllActiveDashboardCache(verifiedTasks, reason);
        return true;
    } catch (e) {
        console.warn('WorkDesk dashboard verified All Active refresh failed:', e);
        return false;
    } finally {
        wdDashboardVerifiedRefreshRunning = false;
        wdAllActiveDashboardLoading = false;
        wdRenderDashboardCards();
        if ((wdActiveDashboardSelectedStatus || WD_DASHBOARD_NONE) !== WD_DASHBOARD_NONE) {
            wdRenderDashboardList();
        }
    }
}

async function wdSoftRebuildDashboardFromLiveSource(reason = '') {
    if (!wdIsDashboardVisible()) return;

    const previousStatus = wdActiveDashboardSelectedStatus || WD_DASHBOARD_NONE;
    const previousDate = wdActiveDashboardSelectedQueueDate || '';

    try {
        wdActiveDashboardTasks = await wdBuildDashboardTasks({ forceRefresh: false, includeAllActive: wdAllActiveDashboardLoaded });
        wdActiveDashboardCacheMeta = { fromCache: false, savedAt: Date.now(), reason: reason || 'live-sync', verified: wdAllActiveDashboardLoaded };
        if (wdAllActiveDashboardLoaded) {
            wdApplyVerifiedAllActiveDashboardCache(wdActiveDashboardTasks, reason || 'live-sync');
        } else {
            wdSaveDashboardCache([], wdPersonalDashboardTasks, { allActiveVerified: false, reason: reason || 'live-sync' });
        }

        wdActiveDashboardSelectedStatus = wdDashboardFilterExists(previousStatus) ? previousStatus : WD_DASHBOARD_NONE;
        wdActiveDashboardSelectedQueueDate = previousDate;

        wdRenderDashboardCards();
        wdRenderDashboardList();
        wdBindDashboardControls();
    } catch (e) {
        console.warn('WorkDesk dashboard live sync failed:', e);
    }
}

function wdScheduleDashboardLiveSync(reason = 'live-change', delay = 900) {
    if (!wdIsDashboardVisible()) return;
    const now = Date.now();
    // 11.1.9: Active Task/live events can fire repeatedly. Debounce and do not clear
    // the verified count cache; otherwise cards flash from their real count to dash.
    const elapsed = now - Number(wdDashboardLastSoftSyncAt || 0);
    const safeDelay = elapsed < WD_DASHBOARD_SOFT_SYNC_MIN_MS
        ? Math.max(delay, WD_DASHBOARD_SOFT_SYNC_MIN_MS - elapsed)
        : delay;
    if (wdDashboardLiveSyncTimer) clearTimeout(wdDashboardLiveSyncTimer);
    wdDashboardLiveSyncTimer = setTimeout(() => {
        wdDashboardLiveSyncTimer = null;
        wdDashboardLastSoftSyncAt = Date.now();
        wdSoftRebuildDashboardFromLiveSource(reason);
    }, safeDelay);
}

function wdStartDashboardActiveTaskLiveSync() {
    if (wdDashboardLiveSyncStarted) return;
    wdDashboardLiveSyncStarted = true;

    // 9.7.6: Active Task is the personal source of truth. When Active Task finishes
    // loading/cleaning stale rows, Dashboard immediately reuses that exact list.
    try {
        window.addEventListener('iba:active-tasks-updated', (event) => {
            const detail = event && event.detail ? event.detail : {};
            if (String(detail.mode || '').toLowerCase() !== 'workdesk') return;
            wdScheduleDashboardLiveSync('active-task-updated', 250);
        });
    } catch (e) { /* ignore */ }

    // Lightweight Firebase listener: watch only the active task lookup, not full
    // invoice_entries/job_entries.
    // 10.3.2: Normal/User accounts are strictly attention-oriented and listen only
    // to their own task inbox. They no longer subscribe to invoice_tasks_by_user/All,
    // because All Active/global sorting is Admin/Super Admin only.
    // Admin/Super Admin keep the small lookup-root listener for the complete overview.
    try {
        if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return;

        if (wdCanSeeAllActiveDashboard()) {
            // 10.3.3: Admin/Super Admin no longer subscribe to the global task lookup
            // on Dashboard open. Global All Active data is fetched on demand when an
            // Admin clicks an All Active status card. This avoids background downloads.
            wdDashboardTaskLookupRootRef = null;
            wdDashboardTaskLookupAllRef = null;
            return;
        } else {
            const safeName = wdCurrentSafeUserTaskKey();
            const personalNodes = {};
            let personalListenerPrimed = false;
            let activeTaskReloadTimer = null;
            const updatePersonalLiveCache = () => {
                wdSetInvoiceTaskLookupLiveCache(personalNodes, 'personal-listener');

                // The first Firebase .on('value') callback is only the initial small
                // snapshot. Do not reload Active Task again because Dashboard has just
                // built it. Later callbacks represent real changes and can be refreshed.
                if (!personalListenerPrimed) {
                    personalListenerPrimed = true;
                    wdScheduleDashboardLiveSync('personal-task-index-initial', 1200);
                    return;
                }

                if (activeTaskReloadTimer) clearTimeout(activeTaskReloadTimer);
                activeTaskReloadTimer = setTimeout(() => {
                    activeTaskReloadTimer = null;
                    // Let Active Task perform its existing accurate cleanup/filter logic,
                    // then Dashboard reuses the saved Active Task snapshot event.
                    if (typeof populateActiveTasks === 'function') {
                        try { populateActiveTasks(false); } catch (_) { wdScheduleDashboardLiveSync('personal-task-index', 1000); }
                    } else {
                        wdScheduleDashboardLiveSync('personal-task-index', 1000);
                    }
                }, 1500);
            };

            if (safeName) {
                wdDashboardTaskLookupPersonalRef = invoiceDb.ref(`invoice_tasks_by_user/${safeName}`);
                wdDashboardTaskLookupPersonalRef.on('value', (snapshot) => {
                    personalNodes[safeName] = snapshot.val() || {};
                    updatePersonalLiveCache();
                });
            }
            // 10.3.2: Do not listen to invoice_tasks_by_user/All for normal users.
            // Their Dashboard is intentionally limited to My Personal Tasks, so reading
            // the global All node wastes download and can trigger unnecessary rebuilds.
            wdDashboardTaskLookupAllRef = null;
        }
    } catch (e) {
        console.warn('WorkDesk dashboard live listener could not start:', e);
    }
}

async function populateWorkdeskDashboard(forceRefresh = false) {
    if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('populate-workdesk-dashboard')) return;
    if (wdPopulateDashboardRunning) return;
    const cardsEl = document.getElementById('wd-active-dashboard-cards');
    const listEl = document.getElementById('wd-active-dashboard-list');
    const titleEl = document.getElementById('wd-active-dashboard-title');
    const summaryEl = document.getElementById('wd-active-dashboard-summary');

    if (!cardsEl || !listEl) return;

    // 11.1.9: Background refresh must not blank the cards/counts.
    // Show the loading placeholder only when the Dashboard has no usable cards/cache yet.
    const hasExistingDashboardCards = !!cardsEl.querySelector('.wd-active-status-card, .wd-dashboard-card-section');
    const hasCountCache = !!(wdAllActiveDashboardCountsLoaded && wdAllActiveDashboardCountMap && wdAllActiveDashboardCountMap.size);
    if (!hasExistingDashboardCards && !hasCountCache) {
        cardsEl.innerHTML = `
            <div class="wd-dashboard-loading-card">
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading open tasks...
            </div>`;
        listEl.innerHTML = '<div class="wd-dashboard-empty-state">Loading task cards...</div>';
    }
    if (titleEl && !hasExistingDashboardCards) titleEl.textContent = 'Select a status card';
    if (summaryEl && !hasExistingDashboardCards) summaryEl.textContent = wdCanSeeAllActiveDashboard()
        ? 'Cards are loaded. Click a status card to review the list.'
        : 'Cards are loaded. Click a My Personal Task card to review the list.';

    wdPopulateDashboardRunning = true;

    try {
        if (!forceRefresh) {
            const cached = wdLoadDashboardCache();
            if (cached) {
                wdPersonalDashboardTasks = Array.isArray(cached.personalTasks) ? cached.personalTasks : [];

                // 10.6.0: Restore the verified All Active dataset when it exists.
                // If the cache is only a preview/old cache, do not trust its counts;
                // trigger the verified builder below so the cards and clicked details
                // are corrected automatically without requiring the Admin to click first.
                const restoredVerifiedAllActive = wdRestoreVerifiedAllActiveDashboardCache(cached);
                if (!restoredVerifiedAllActive) {
                    wdActiveDashboardTasks = wdCanSeeAllActiveDashboard() ? [] : cached.tasks;
                    wdAllActiveDashboardLoaded = false;
                    if (wdCanSeeAllActiveDashboard()) {
                        wdAllActiveDashboardCountsLoaded = false;
                        wdAllActiveDashboardCountMap = new Map();
                        wdAllActiveDashboardCountItemsMap = new Map();
                        wdAllActiveDashboardCountSavedAt = 0;
                    }
                    wdActiveDashboardCacheMeta = { fromCache: true, savedAt: cached.savedAt || Date.now(), verified: false };
                }

                // 9.4.8: Never auto-open the table after loading cache.
                wdActiveDashboardSelectedStatus = WD_DASHBOARD_NONE;

                wdRenderDashboardCards();
                wdRenderDashboardList();
                wdBindDashboardControls();
                wdStartDashboardActiveTaskLiveSync();
                wdStartDashboardRecentUpdateSync();
                wdPrimeAllActiveDashboardCounts(!restoredVerifiedAllActive);
                return;
            }
        }

        wdAllActiveDashboardLoaded = false;
        // 11.1.9: preserve already verified/count-preview All Active counts during background refresh.
        // Clearing these maps is what made cards flash from 3 to dash every few seconds.
        if (!wdAllActiveDashboardCountsLoaded || !wdAllActiveDashboardCountMap || wdAllActiveDashboardCountMap.size === 0) {
            wdAllActiveDashboardCountsLoaded = false;
            wdAllActiveDashboardCountMap = new Map();
            wdAllActiveDashboardCountItemsMap = new Map();
            wdAllActiveDashboardCountSavedAt = 0;
        }
        wdActiveDashboardTasks = await wdBuildDashboardTasks({ forceRefresh, includeAllActive: false });
        wdActiveDashboardCacheMeta = { fromCache: false, savedAt: Date.now(), verified: false };
        wdSaveDashboardCache([], wdPersonalDashboardTasks, { allActiveVerified: false, reason: 'personal-cache' });

        // 9.4.8: Do not auto-open any list after loading. User clicks a card first.
        wdActiveDashboardSelectedStatus = WD_DASHBOARD_NONE;

        wdRenderDashboardCards();
        wdRenderDashboardList();
        wdBindDashboardControls();
        wdStartDashboardActiveTaskLiveSync();
        wdStartDashboardRecentUpdateSync();
        wdPrimeAllActiveDashboardCounts(true);
    } catch (error) {
        console.error('Error loading WorkDesk dashboard control center:', error);
        cardsEl.innerHTML = '<div class="wd-dashboard-error-card"><i class="fa-solid fa-triangle-exclamation"></i> Unable to load dashboard tasks.</div>';
        listEl.innerHTML = '<div class="wd-dashboard-empty-state">Please refresh or check the console error.</div>';
    } finally {
        wdPopulateDashboardRunning = false;
    }
}

async function wdEnsureAdminAllActiveDashboardLoaded(forceRefresh = false) {
    if (!wdCanSeeAllActiveDashboard()) return;
    if (wdAllActiveDashboardLoaded && !forceRefresh) return;
    if (wdAllActiveDashboardLoading || wdDashboardVerifiedRefreshRunning) return;

    const listEl = document.getElementById('wd-active-dashboard-list');
    const summaryEl = document.getElementById('wd-active-dashboard-summary');
    if (summaryEl) summaryEl.textContent = 'Loading selected Admin overview from Firebase...';
    if (listEl) {
        listEl.innerHTML = '<div class="wd-dashboard-empty-state"><span class="wd-empty-icon"><i class="fa-solid fa-spinner fa-spin"></i></span><div><strong>Loading Admin overview...</strong><p>The verified dashboard cache is being prepared now.</p></div></div>';
    }

    await wdRefreshVerifiedAllActiveDashboardCache({
        forceRefresh,
        reason: 'admin-card-click',
        skipVerifiedCacheCheck: true
    });
}

function wdBindDashboardControls() {
    const cardsEl = document.getElementById('wd-active-dashboard-cards');
    const refreshBtn = document.getElementById('wd-active-dashboard-refresh');
    const searchInput = document.getElementById('wd-active-dashboard-search');
    const clearBtn = document.getElementById('wd-active-dashboard-clear');

    if (cardsEl && !cardsEl.dataset.bound) {
        cardsEl.dataset.bound = 'true';
        cardsEl.addEventListener('click', async (e) => {
            const card = e.target.closest('.wd-active-status-card');
            if (!card) return;
            wdActiveDashboardSelectedStatus = card.dataset.status || WD_DASHBOARD_ALL;
            wdActiveDashboardSelectedQueueDate = '';
            wdAllActiveCorkboardSelectedSiteKey = '';

            const isPersonalSelection = wdIsPersonalDashboardSelection(wdActiveDashboardSelectedStatus);
            if (wdCanSeeAllActiveDashboard() && !isPersonalSelection) {
                await wdEnsureAdminAllActiveDashboardLoaded(false);
            }

            wdRenderDashboardCards();
            wdRenderDashboardList();
        });
    }

    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.dataset.bound = 'true';
        refreshBtn.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            try {
                wdClearDashboardCache();
                wdAllActiveDashboardLoaded = false;
                wdAllActiveDashboardCountsLoaded = false;
                wdAllActiveDashboardCountMap = new Map();
                wdAllActiveDashboardCountItemsMap = new Map();
                wdDashboardLastRecentSyncAt = 0;
                wdActiveDashboardTasks = [];
                try { window.sessionStorage.removeItem(WD_ACTIVE_TASK_SOURCE_CACHE_KEY); } catch (e) { /* ignore */ }
                if (typeof cacheTimestamps !== 'undefined') {
                    cacheTimestamps.systemEntries = 0;
                    cacheTimestamps.invoiceData = 0;
                    cacheTimestamps.approverData = 0;
                }
                await populateWorkdeskDashboard(true);
            } finally {
                if (icon) icon.classList.remove('fa-spin');
            }
        });
    }

    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', () => {
            // 11.0.0: Dashboard search is global. Typing a search clears any
            // previously picked All Active category/site so results are not trapped
            // inside the old card selection.
            wdActiveDashboardSelectedStatus = WD_DASHBOARD_NONE;
            wdActiveDashboardSelectedQueueDate = '';
            wdAllActiveCorkboardSelectedSiteKey = '';
            wdRenderDashboardCards();
            wdRenderDashboardList();
        });
    }

    if (clearBtn && !clearBtn.dataset.bound) {
        clearBtn.dataset.bound = 'true';
        clearBtn.addEventListener('click', () => {
            wdResetDashboardSearchAndSelection();
            try { searchInput?.focus(); } catch (_) {}
        });
    }

    const listEl = document.getElementById('wd-active-dashboard-list');
    if (listEl && !listEl.dataset.dateTabsBound) {
        listEl.dataset.dateTabsBound = 'true';
        listEl.addEventListener('click', (e) => {
            const forwardBtn = e.target.closest('.wd-forward-task-btn');
            if (forwardBtn) {
                e.preventDefault();
                e.stopPropagation();
                wdOpenForwardTaskPreview(forwardBtn.dataset.wdForwardTaskId || '', forwardBtn);
                return;
            }

            const siteCard = e.target.closest('.wd-cork-site-card');
            if (siteCard) {
                wdAllActiveCorkboardSelectedSiteKey = siteCard.dataset.siteKey || '';
                wdRenderDashboardList();
                wdRenderDashboardCards();
                return;
            }

            const tab = e.target.closest('.wd-date-tab');
            if (!tab) return;
            wdActiveDashboardSelectedQueueDate = tab.dataset.dateKey || '';
            wdRenderDashboardList();
        });
    }
}


function wdDashboardTaskIdentityKey(task = {}) {
    const po = wdText(task.originalPO || task.po || '');
    const direct = wdText(task.originalKey || task.invoiceKey || task.key || task.id || '');
    const ref = wdText(task.invEntryID || task.ref || task.invNumber || task.invoiceNo || '');
    const source = wdNormalize(task.source || task.type || 'task');
    if (source.includes('job') || source.includes('ipc')) {
        return `job|${wdNormalize(direct || ref || po || Math.random())}`;
    }
    if (po && direct) return `invoice|${wdNormalize(po)}|${wdNormalize(direct)}`;
    if (po && ref) return `invoice-ref|${wdNormalize(po)}|${wdNormalize(ref)}`;
    return `${source}|${wdNormalize(direct || ref || Math.random())}`;
}

function wdDashboardCountItemKey(item = {}) {
    if (item.itemKey) return item.itemKey;
    if (item.kind === 'job') return `job|${wdNormalize(item.key || item.jobKey || '')}`;
    return wdDashboardTaskIdentityKey(item);
}

function wdDashboardUpdatedMillis(...values) {
    let best = 0;
    values.forEach(value => {
        const ts = wdParseQueueTimestamp(value);
        if (ts && ts > best) best = ts;
    });
    return best;
}

function wdSetAllActiveDashboardCountItems(items = []) {
    wdAllActiveDashboardCountItemsMap = new Map();
    (Array.isArray(items) ? items : []).forEach(item => {
        if (!item || !item.bucket) return;
        const key = wdDashboardCountItemKey(item);
        if (!key) return;
        wdAllActiveDashboardCountItemsMap.set(key, { ...item, itemKey: key });
    });
}

function wdRecalculateAllActiveCountMapFromItems(save = true) {
    const counts = {};
    wdAllActiveDashboardCountItemsMap.forEach(item => {
        if (!item || item.active === false) return;
        const bucket = item.bucket || item.status;
        if (bucket) wdIncrementAllActiveCount(counts, bucket);
    });
    wdSetAllActiveDashboardCountMap(counts, Date.now(), Array.from(wdAllActiveDashboardCountItemsMap.values()));
    if (save) wdSaveAllActiveDashboardCountsCache(counts, Array.from(wdAllActiveDashboardCountItemsMap.values()));
}

function wdRemoveCachedDashboardTaskByRecentKey(po, invoiceKey) {
    const wanted = wdNormalize(`invoice|${wdNormalize(po)}|${wdNormalize(invoiceKey)}`);
    const same = (task) => wdNormalize(wdDashboardTaskIdentityKey(task)) === wanted;
    wdActiveDashboardTasks = (Array.isArray(wdActiveDashboardTasks) ? wdActiveDashboardTasks : []).filter(task => !same(task));
    wdPersonalDashboardTasks = (Array.isArray(wdPersonalDashboardTasks) ? wdPersonalDashboardTasks : []).filter(task => !same(task));
}

function wdUpsertCachedDashboardTask(task) {
    if (!task || !task.bucket) return;
    const key = wdDashboardTaskIdentityKey(task);
    const upsert = (arr) => {
        const list = Array.isArray(arr) ? arr.slice() : [];
        const idx = list.findIndex(existing => wdDashboardTaskIdentityKey(existing) === key);
        if (idx >= 0) list[idx] = { ...list[idx], ...task };
        else list.push(task);
        return list.sort(wdCompareDashboardPriority);
    };
    if (wdAllActiveDashboardLoaded) wdActiveDashboardTasks = upsert(wdActiveDashboardTasks);
}

async function wdNormalizeRecentInvoiceRowForDashboard(recent = {}, invoiceKey = '') {
    const po = wdText(recent.po || recent.originalPO || '');
    const key = wdText(invoiceKey || recent.invoiceKey || recent.originalKey || '');
    if (!po || !key) return null;
    const active = recent.active !== false && !wdIsInvoiceLookupComplete(recent.status || '');
    if (!active) return { active: false, po, invoiceKey: key, itemKey: `invoice|${wdNormalize(po)}|${wdNormalize(key)}` };

    const latestInv = await wdGetInvoiceSourceTruth(po, key, true, recent);
    if (!latestInv || typeof latestInv !== 'object') {
        return { active: false, po, invoiceKey: key, itemKey: `invoice|${wdNormalize(po)}|${wdNormalize(key)}` };
    }

    const status = wdCurrentInvoiceTaskStatus(recent, latestInv || {});
    const stillActive = (typeof isInvoiceTaskActive === 'function')
        ? isInvoiceTaskActive(latestInv)
        : !wdIsInvoiceLookupComplete(status);
    if (!stillActive || wdIsInvoiceLookupComplete(status)) {
        return { active: false, po, invoiceKey: key, itemKey: `invoice|${wdNormalize(po)}|${wdNormalize(key)}` };
    }

    const bucket = wdDashboardAllowedBucket(status, 'invoice_task_lookup');
    if (!bucket) return null;

    const latestAttention = wdText(latestInv.attention || latestInv.Attention || latestInv.assignedTo || recent.attention || '');
    if (wdTaskHasAttentionName({ attention: latestAttention }, wdCurrentUserNameNorm())) {
        return { active: false, po, invoiceKey: key, itemKey: `invoice|${wdNormalize(po)}|${wdNormalize(key)}` };
    }

    const poDetails = await wdGetPODetails(po);
    const site = wdText(
        latestInv.site || latestInv.site_name || latestInv.siteName || recent.site || recent.Site || wdGetPOValue(poDetails, ['Project ID', 'Project ID:', 'Site'], ''),
        'N/A'
    );
    if (!wdSiteMatchesCurrentUser(site)) return null;

    const vendorName = wdText(
        latestInv.vendorName || latestInv.vendor_name || recent.vendorName || recent.vendor || wdGetPOValue(poDetails, ['Supplier Name', 'Supplier Name:', 'Supplier', 'Supplier:', 'Vendor Name'], ''),
        'N/A'
    );
    const queueTimestamp = wdQueueTimestampForTask(recent, latestInv, bucket || status, 'Invoice');
    const updatedAt = wdDashboardUpdatedMillis(
        recent.dashboardUpdatedAt,
        recent.invoiceLastUpdated,
        recent.updatedAt,
        latestInv.lastUpdated,
        latestInv.updatedAt,
        latestInv.statusChangedAt,
        latestInv.enteredAt,
        queueTimestamp
    );
    const task = {
        key: `${po}_${key}`,
        originalKey: key,
        originalPO: po,
        source: 'invoice_task_lookup',
        ownerKey: recent.ownerKey || 'All',
        for: 'Invoice',
        type: 'Invoice',
        ref: wdText(latestInv.invNumber || latestInv.invoiceNo || recent.ref || key),
        invEntryID: latestInv.invEntryID || recent.invEntryID || '',
        po,
        amount: latestInv.invValue || latestInv.amount || recent.amount || '',
        amountPaid: latestInv.amountPaid || latestInv.invValue || latestInv.amount || recent.amountPaid || recent.amount || '',
        site,
        siteName: latestInv.siteName || latestInv.projectName || recent.siteName || wdResolveSiteNameFromPODetails(poDetails),
        group: 'N/A',
        attention: latestAttention,
        enteredBy: latestInv.enteredBy || latestInv.updatedBy || recent.enteredBy || '',
        date: latestInv.invoiceDate || recent.invoiceDate || '',
        invoiceDate: latestInv.invoiceDate || recent.invoiceDate || '',
        linkedJobEntryKey: latestInv.linkedJobEntryKey || recent.linkedJobEntryKey || '',
        jobRecordDateEntered: latestInv.jobRecordDateEntered || latestInv.originDateEntered || latestInv.dateEntered || recent.jobRecordDateEntered || recent.originDateEntered || recent.dateEntered || '',
        originDateEntered: latestInv.originDateEntered || recent.originDateEntered || '',
        dateEntered: latestInv.dateEntered || recent.dateEntered || '',
        jobRecordTimestamp: latestInv.jobRecordTimestamp || latestInv.originTimestamp || recent.jobRecordTimestamp || recent.originTimestamp || '',
        queueLabel: wdQueueLabelForTask(bucket || status, 'Invoice'),
        queueTimestamp,
        queueText: wdQueueFullText(queueTimestamp),
        queueTone: wdQueueAgeParts(queueTimestamp).tone,
        remarks: status,
        status: bucket,
        bucket,
        invName: latestInv.invName || recent.invName || '',
        reportName: latestInv.reportName || recent.reportName || '',
        srvName: latestInv.srvName || recent.srvName || '',
        vendorName,
        note: latestInv.note || recent.note || '',
        timestamp: Number(queueTimestamp || updatedAt || 0),
        isUrgent: false
    };
    return {
        active: true,
        itemKey: `invoice|${wdNormalize(po)}|${wdNormalize(key)}`,
        kind: 'invoice',
        po,
        invoiceKey: key,
        bucket,
        updatedAt,
        task
    };
}

async function wdApplyRecentDashboardChange(recent = {}, invoiceKey = '') {
    const item = await wdNormalizeRecentInvoiceRowForDashboard(recent, invoiceKey);
    if (!item) return false;
    const itemKey = item.itemKey || `invoice|${wdNormalize(item.po)}|${wdNormalize(item.invoiceKey)}`;
    if (item.active === false) {
        wdAllActiveDashboardCountItemsMap.delete(itemKey);
        wdRemoveCachedDashboardTaskByRecentKey(item.po, item.invoiceKey);
    } else {
        wdAllActiveDashboardCountItemsMap.set(itemKey, item);
        wdUpsertCachedDashboardTask(item.task);
    }
    return true;
}

async function wdDashboardSyncRecentUpdates(reason = 'recent-sync') {
    if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('workdesk-dashboard-recent-sync', true)) return;
    if (!wdCanSeeAllActiveDashboard() || !wdIsDashboardVisible()) return;
    if (wdDashboardRecentSyncRunning) return;
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return;

    const now = Date.now();
    const lastSync = Number(wdDashboardLastRecentSyncAt || wdAllActiveDashboardCountSavedAt || wdActiveDashboardCacheMeta?.savedAt || 0) || (now - WD_DASHBOARD_RECENT_SYNC_INTERVAL);
    const cutoff = Math.max(0, lastSync - WD_DASHBOARD_RECENT_SYNC_OVERLAP);

    wdDashboardRecentSyncRunning = true;
    try {
        const snap = await invoiceDb.ref('workdesk_dashboard_recent')
            .orderByChild('updatedAt')
            .startAt(cutoff)
            .once('value');
        const rows = snap.val() || {};
        let changed = false;
        for (const invoiceKey of Object.keys(rows || {})) {
            const row = rows[invoiceKey] || {};
            if (!row || typeof row !== 'object') continue;
            // Safety overlap means the same row may arrive more than once; upsert makes it harmless.
            const applied = await wdApplyRecentDashboardChange(row, invoiceKey);
            changed = changed || applied;
        }
        wdDashboardLastRecentSyncAt = now;
        if (changed) {
            wdRecalculateAllActiveCountMapFromItems(true);
            wdActiveDashboardCacheMeta = { fromCache: false, savedAt: Date.now(), reason, verified: wdAllActiveDashboardLoaded };
            wdSaveDashboardCache(wdAllActiveDashboardLoaded ? wdActiveDashboardTasks : [], wdPersonalDashboardTasks, {
                allActiveVerified: wdAllActiveDashboardLoaded,
                reason
            });
            wdRenderDashboardCards();
            wdRenderDashboardList();
        }
    } catch (e) {
        // Missing Firebase index/rules should not break Dashboard. The normal count refresh remains available.
        console.warn('WorkDesk dashboard recent update sync could not complete:', e);
    } finally {
        wdDashboardRecentSyncRunning = false;
    }
}

function wdStartDashboardRecentUpdateSync() {
    if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('start-dashboard-recent-sync', true)) return;
    if (!wdCanSeeAllActiveDashboard()) return;
    if (wdDashboardRecentSyncTimer) clearInterval(wdDashboardRecentSyncTimer);
    setTimeout(() => { wdDashboardSyncRecentUpdates('dashboard-open'); }, 900);
    wdDashboardRecentSyncTimer = setInterval(() => {
        if (!wdIsDashboardVisible()) return;
        wdDashboardSyncRecentUpdates('dashboard-30s');
    }, WD_DASHBOARD_RECENT_SYNC_INTERVAL);
}

try {
    document.addEventListener('iba:tabguardchange', (ev) => {
        if (ev && ev.detail && ev.detail.active && typeof wdDashboardSyncRecentUpdates === 'function') {
            wdDashboardSyncRecentUpdates('tabguard-active');
        }
    });
} catch (_) {}


function wdReadAllActiveDashboardCountsCache() {
    try {
        const cached = wdReadJSONStorage(window.localStorage, 'IBA_WD_ALL_ACTIVE_COUNT_CACHE_V1');
        if (!cached || cached.userKey !== wdDashboardUserCacheKey()) return null;
        if ((Date.now() - Number(cached.savedAt || 0)) > WD_DASHBOARD_COUNT_CACHE_TTL) return null;
        return cached.counts && typeof cached.counts === 'object' ? cached : null;
    } catch (e) {
        return null;
    }
}

function wdSaveAllActiveDashboardCountsCache(countsObj, items = null) {
    try {
        wdWriteJSONStorage(window.localStorage, 'IBA_WD_ALL_ACTIVE_COUNT_CACHE_V1', {
            userKey: wdDashboardUserCacheKey(),
            savedAt: Date.now(),
            counts: countsObj || {},
            items: Array.isArray(items) ? items : Array.from(wdAllActiveDashboardCountItemsMap.values())
        });
    } catch (e) { /* ignore */ }
}

function wdSetAllActiveDashboardCountMap(countsObj, savedAt = Date.now(), items = null) {
    wdAllActiveDashboardCountMap = new Map();
    Object.entries(countsObj || {}).forEach(([status, count]) => {
        const label = wdText(status);
        if (!label) return;
        wdAllActiveDashboardCountMap.set(label, Number(count) || 0);
    });
    if (Array.isArray(items)) wdSetAllActiveDashboardCountItems(items);
    wdAllActiveDashboardCountSavedAt = savedAt || Date.now();
    wdAllActiveDashboardCountsLoaded = true;
}

function wdIncrementAllActiveCount(counts, status, inc = 1) {
    const label = wdText(status);
    if (!label) return;
    counts[label] = (Number(counts[label]) || 0) + (Number(inc) || 1);
}

function wdAllActiveCountForStatus(status) {
    const wanted = wdNormalize(status);
    if (!wanted) return 0;
    for (const [label, count] of wdAllActiveDashboardCountMap.entries()) {
        if (wdNormalize(label) === wanted) return Number(count) || 0;
    }
    return 0;
}

// 11.2.1: Background/live refresh can temporarily return an empty dataset while
// cache/index loaders are still settling. Never let that temporary empty state wipe
// the visible All Active cards. Manual refresh and confirmed card-click loads can
// still replace the dashboard when genuinely empty.
function wdAllActiveHasStableVisibleCounts() {
    if (!wdAllActiveDashboardCountMap || typeof wdAllActiveDashboardCountMap.forEach !== 'function') return false;
    let has = false;
    wdAllActiveDashboardCountMap.forEach(count => {
        if ((Number(count) || 0) > 0) has = true;
    });
    return has;
}

function wdShouldProtectAllActiveFromBlank(reason = '') {
    const r = wdNormalize(reason || '');
    if (!wdAllActiveHasStableVisibleCounts()) return false;
    if (r.includes('manual') || r.includes('refresh button') || r.includes('refresh-button')) return false;
    if (r.includes('admin card click') || r.includes('admin-card-click')) return false;
    return true;
}

function wdMergeFixedAllActiveCards(statuses = []) {
    const map = new Map();
    const add = (label) => {
        const text = wdText(label);
        if (!text) return;
        const key = wdNormalize(text);
        if (!key || map.has(key)) return;
        map.set(key, text);
    };
    WD_DASHBOARD_FIXED_ALL_ACTIVE_CARDS.forEach(add);
    (Array.isArray(statuses) ? statuses : []).forEach(add);
    return wdSortStatuses(Array.from(map.values()));
}

function wdPreviewStatusesWithCount() {
    const labels = [];
    wdAllActiveDashboardCountMap.forEach((count, label) => {
        const text = wdText(label);
        if (!text) return;
        if ((Number(count) || 0) <= 0) return;
        labels.push(text);
    });
    // 11.2.5: show the fixed category cards even if the count is zero.
    return wdMergeFixedAllActiveCards(labels);
}

function wdAllActiveStatusesToShowWhileLazy() {
    // 11.2.5: The command board must keep fixed category cards visible.
    // Counts may be zero, but categories such as IPC Application / IPC Processed
    // should not vanish after the count cache is loaded.
    if (wdAllActiveDashboardCountsLoaded) {
        return wdPreviewStatusesWithCount();
    }
    return WD_DASHBOARD_LAZY_ADMIN_STATUSES.slice();
}

async function wdLoadAllActiveDashboardCounts(forceRefresh = false) {
    if (!wdCanSeeAllActiveDashboard()) return;
    if (wdAllActiveDashboardCountsLoading) return;
    if (wdAllActiveDashboardCountsLoaded && !forceRefresh) return;

    if (!forceRefresh) {
        const cached = wdReadAllActiveDashboardCountsCache();
        if (cached) {
            wdSetAllActiveDashboardCountMap(cached.counts, cached.savedAt, Array.isArray(cached.items) ? cached.items : null);
            wdRenderDashboardCards();
            return;
        }
    }

    // 10.5.8: A forced count refresh is still lightweight compared with the old
    // full dashboard detail load. It reads the small task index, validates each
    // visible invoice against its exact source record, and stores count-items so
    // later 30-second recent-sync passes can update the cached counts incrementally.
    wdAllActiveDashboardCountsLoading = true;
    wdRenderDashboardCards();
    const counts = {};
    const countItems = [];
    try {
        const activeInvoiceLinkKeysForCounts = new Set();
        if (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) {
            const snap = await invoiceDb.ref('invoice_tasks_by_user/All').once('value');
            const rows = snap.val() || {};
            for (const key of Object.keys(rows || {})) {
                const task = rows[key] || {};
                if (!task || typeof task !== 'object') continue;

                let status = wdCurrentInvoiceTaskStatus(task, {});
                let latestInv = null;
                if (forceRefresh) {
                    const po = wdText(task.po || task.originalPO || '');
                    latestInv = await wdGetInvoiceSourceTruth(po, key, true, task);
                    if (!latestInv || typeof latestInv !== 'object') {
                        await wdCleanupStaleInvoiceLookupRow('All', key);
                        continue;
                    }
                    status = wdCurrentInvoiceTaskStatus(task, latestInv || {});
                    const stillActive = (typeof isInvoiceTaskActive === 'function')
                        ? isInvoiceTaskActive(latestInv)
                        : !wdIsInvoiceLookupComplete(status);
                    if (!stillActive || wdIsInvoiceLookupComplete(status)) {
                        await wdCleanupStaleInvoiceLookupRow('All', key);
                        continue;
                    }
                }

                if (!status || wdIsInvoiceLookupComplete(status)) continue;
                const bucket = wdDashboardAllowedBucket(status, 'invoice_task_lookup');
                if (!bucket) continue;
                const attention = wdText((latestInv && (latestInv.attention || latestInv.Attention || latestInv.assignedTo)) || task.attention || '');
                if (wdTaskHasAttentionName({ ...task, attention }, wdCurrentUserNameNorm())) continue;
                const po = wdText(task.po || task.originalPO || (latestInv && latestInv.po_number) || '');
                const mergedInvoiceForLink = { ...task, ...(latestInv || {}), po, originalPO: po, originalKey: key, invoiceKey: key, key };
                wdActiveInvoiceLinkKeySet([mergedInvoiceForLink]).forEach(v => activeInvoiceLinkKeysForCounts.add(v));
                wdIncrementAllActiveCount(counts, bucket);
                countItems.push({
                    kind: 'invoice',
                    itemKey: `invoice|${wdNormalize(po)}|${wdNormalize(key)}`,
                    po,
                    invoiceKey: key,
                    bucket,
                    active: true,
                    updatedAt: wdDashboardUpdatedMillis(task.dashboardUpdatedAt, task.invoiceLastUpdated, task.updatedAt, latestInv?.lastUpdated, latestInv?.updatedAt, latestInv?.statusChangedAt)
                });
            }
        }

        // 10.4.9: All Active cards should show count/value immediately without
        // requiring the Admin to click a card first. Count Job Entries here, but
        // do not render or download the yellow pinned detail cards until a status
        // card and then a site card are clicked.
        try {
            const entries = await wdEnsureDashboardJobEntriesFetched(forceRefresh);
            const personalKeySet = wdBuildPersonalTaskKeySet();
            entries.forEach((entry, index) => {
                if (!entry || typeof entry !== 'object') return;
                if (wdJobEntryIsClosedForDashboard(entry)) return;
                if (wdJobEntryMatchesActiveInvoice(entry, activeInvoiceLinkKeysForCounts)) return;
                const status = wdEntryStatus(entry);
                const forText = wdNormalize(entry.for || entry.For || entry.type || entry.Type || '');
                const isInvoiceJob = forText === 'invoice' || forText === 'invoice job' || forText.includes('invoice');
                if (isInvoiceJob && wdIsJobNewEntryQueue(entry, status, 'job_entry')) {
                    const key = wdText(entry.key || entry.id || entry.po || `${index}`);
                    const pseudo = { source: 'job_entry', type: 'Invoice Job', key, po: entry.po || entry.originalPO || entry.ref || '', ref: entry.ref || '' };
                    if (!wdDashboardTaskIsAlreadyPersonal(pseudo, personalKeySet)) {
                        wdIncrementAllActiveCount(counts, 'New Entry');
                        countItems.push({ kind: 'job', itemKey: `job|${wdNormalize(key)}`, key, bucket: 'New Entry', active: true, updatedAt: wdEntryTimestamp(entry) });
                    }
                    return;
                }
                if (['ipc', 'ipc processed', 'ipc application'].includes(forText) && wdIsOpenIPCJobStatus(status)) {
                    const displayBucket = forText === 'ipc application' ? 'IPC Application' : 'IPC Processed';
                    const key = wdText(entry.key || entry.id || `${entry.po || ''}_${entry.ref || ''}_${index}`);
                    wdIncrementAllActiveCount(counts, displayBucket);
                    countItems.push({ kind: 'job', itemKey: `job|${wdNormalize(key)}`, key, bucket: displayBucket, active: true, updatedAt: wdEntryTimestamp(entry) });
                }
            });
        } catch (_) { /* job count is optional */ }

        // 11.2.1: Do not let a background count preview temporarily wipe a
        // previously visible All Active count set. A true empty result is still
        // accepted from manual/forced refresh paths.
        const hasNewCount = Object.values(counts || {}).some(v => (Number(v) || 0) > 0);
        if (!hasNewCount && !forceRefresh && wdShouldProtectAllActiveFromBlank('count-preview')) {
            return;
        }

        wdSetAllActiveDashboardCountMap(counts, Date.now(), countItems);
        wdSaveAllActiveDashboardCountsCache(counts, countItems);
    } catch (e) {
        console.warn('Dashboard All Active count preview could not load:', e);
    } finally {
        wdAllActiveDashboardCountsLoading = false;
        wdRenderDashboardCards();
    }
}

function wdPrimeAllActiveDashboardCounts(forceRefresh = false) {
    if (!wdCanSeeAllActiveDashboard()) return;
    setTimeout(() => {
        // 10.6.0: Prime the verified cache, not the older preview-only count cache.
        // This makes first-open cards and clicked-card details use the same source.
        wdRefreshVerifiedAllActiveDashboardCache({
            forceRefresh,
            reason: forceRefresh ? 'dashboard-open-verified-refresh' : 'dashboard-open-verified-cache'
        });
    }, 50);
}

function wdDashboardSearchValue() {
    const input = document.getElementById('wd-active-dashboard-search');
    return wdNormalize(input?.value || '');
}

function wdDashboardTaskCategoryLabel(task = {}) {
    return wdText(task.bucket || task.personalBucket || wdDashboardBucket(task.status, task.type) || wdDashboardPersonalBucket(task.status, task.type) || '');
}

function wdDashboardSearchContextStatusKeys() {
    const selected = wdActiveDashboardSelectedStatus || WD_DASHBOARD_NONE;
    const search = wdDashboardSearchValue();
    if (!search || selected !== WD_DASHBOARD_NONE) return new Set();

    let tasks = (typeof wdGetFilteredDashboardTasks === 'function')
        ? wdGetFilteredDashboardTasks()
        : [];

    // In global Dashboard search mode, results are site-based even when one
    // matching item belongs to For Summary. If a site card is selected, highlight
    // only the categories represented inside that selected site.
    if (wdAllActiveCorkboardSelectedSiteKey) {
        const groups = wdBuildSiteGroups(tasks, wdCompareDashboardPriority);
        const selectedGroup = groups.find(group => group.key === wdAllActiveCorkboardSelectedSiteKey);
        tasks = selectedGroup ? (selectedGroup.tasks || []) : [];
    }

    return new Set((Array.isArray(tasks) ? tasks : [])
        .map(task => wdNormalize(wdDashboardTaskCategoryLabel(task)))
        .filter(Boolean));
}

function wdResetDashboardSearchAndSelection() {
    const input = document.getElementById('wd-active-dashboard-search');
    if (input) input.value = '';
    wdActiveDashboardSelectedStatus = WD_DASHBOARD_NONE;
    wdActiveDashboardSelectedQueueDate = '';
    wdAllActiveCorkboardSelectedSiteKey = '';
    wdRenderDashboardCards();
    wdRenderDashboardList();
}

function wdRenderDashboardCards() {
    const cardsEl = document.getElementById('wd-active-dashboard-cards');
    if (!cardsEl) return;

    const canSeeAllActive = wdCanSeeAllActiveDashboard();
    const dashboardSearch = wdDashboardSearchValue();
    const selectedFilter = wdActiveDashboardSelectedStatus || WD_DASHBOARD_NONE;
    const dashboardGlobalSearchMode = !!dashboardSearch && selectedFilter === WD_DASHBOARD_NONE;
    const searchStatusKeys = (canSeeAllActive && dashboardGlobalSearchMode)
        ? wdDashboardSearchContextStatusKeys()
        : new Set();
    const shouldShowSearchCategoryContext = searchStatusKeys.size > 0;
    const statusCounts = new Map();

    wdActiveDashboardTasks.forEach(task => {
        const bucket = task.bucket || wdDashboardBucket(task.status, task.type);
        if (bucket) statusCounts.set(bucket, (statusCounts.get(bucket) || 0) + 1);
    });

    const statuses = wdSortStatuses(Array.from(statusCounts.keys()));

    const myStatusCounts = new Map();
    wdPersonalDashboardTasks.forEach(task => {
        const bucket = task.personalBucket || wdDashboardPersonalBucket(task.status, task.type);
        if (bucket) myStatusCounts.set(bucket, (myStatusCounts.get(bucket) || 0) + 1);
    });
    const myStatuses = wdSortStatuses(Array.from(myStatusCounts.keys()));
    let personalHtml = '';
    if (myStatuses.length) {
        myStatuses.forEach(status => {
            const count = myStatusCounts.get(status) || 0;
            const tone = wdStatusTone(status);
            const filterKey = wdDashboardMyStatusFilterKey(status);
            const active = (!canSeeAllActive && filterKey === wdActiveDashboardSelectedStatus) || filterKey === wdActiveDashboardSelectedStatus ? 'active' : '';
            personalHtml += `
                <button class="wd-active-status-card wd-person-task-card tone-${tone} ${active}" data-status="${wdSafe(filterKey)}" type="button" aria-label="Show my ${wdSafe(status)} tasks">
                    <span class="wd-status-card-glow"></span>
                    <span class="wd-status-icon"><i class="fa-solid ${wdStatusIcon(status)}"></i></span>
                    <span class="wd-status-meta">
                        <strong>${count}</strong>
                        <em>My ${wdSafe(status)}</em>
                        <small>Assigned to you</small>
                    </span>
                    <span class="wd-status-arrow"><i class="fa-solid fa-arrow-right"></i></span>
                </button>`;
        });
    } else {
        personalHtml = `
        <div class="wd-dashboard-mini-empty">
            <i class="fa-regular fa-circle-check"></i>
            No task is currently addressed to you.
        </div>`;
    }
    let sectionsHtml = `
        <section class="wd-dashboard-card-section wd-dashboard-person-section">
            <div class="wd-dashboard-card-section-head">
                <span><i class="fa-solid fa-user-check"></i> My personal tasks</span>
                <small>Only tasks directly addressed to your name</small>
            </div>
            <div class="wd-dashboard-card-grid wd-dashboard-person-grid">${personalHtml}</div>
        </section>`;

    if (canSeeAllActive) {
        // 9.4.6: Removed the All Active total-count KPI card from WorkDesk.
        // The section now starts directly with the actionable status cards.
        let activeHtml = '';

        let activeStatusesToShow = wdAllActiveDashboardLoaded ? wdMergeFixedAllActiveCards(statuses) : wdAllActiveStatusesToShowWhileLazy();
        // 11.2.1: During background/live refresh, keep the section visible instead
        // of rendering it empty while the verified set is being rebuilt.
        if (!activeStatusesToShow.length && (wdAllActiveDashboardCountsLoading || wdAllActiveDashboardLoading || wdDashboardVerifiedRefreshRunning) && wdAllActiveHasStableVisibleCounts()) {
            activeStatusesToShow = wdPreviewStatusesWithCount();
        }
        if (!activeStatusesToShow.length && wdAllActiveDashboardCountsLoaded && !wdAllActiveDashboardCountsLoading && !wdAllActiveDashboardLoading && !wdDashboardVerifiedRefreshRunning) {
            activeHtml = `
                <div class="wd-dashboard-mini-empty">
                    <i class="fa-regular fa-circle-check"></i>
                    No open system task is currently outside your personal queue.
                </div>`;
        }
        activeStatusesToShow.forEach(status => {
            const count = wdAllActiveDashboardLoaded
                ? (statusCounts.get(status) || wdAllActiveCountForStatus(status) || 0)
                : wdAllActiveCountForStatus(status);
            const tone = wdStatusTone(status);
            const filterKey = wdDashboardStatusFilterKey(status);
            const searchKey = wdNormalize(status);
            const searchContextMatch = shouldShowSearchCategoryContext && searchStatusKeys.has(searchKey);
            const directActive = filterKey === wdActiveDashboardSelectedStatus || status === wdActiveDashboardSelectedStatus;
            const active = (!shouldShowSearchCategoryContext && directActive) || searchContextMatch ? 'active' : '';
            const searchContextClass = shouldShowSearchCategoryContext
                ? (searchContextMatch ? 'wd-search-category-match' : 'wd-search-category-muted')
                : '';
            const hasCount = wdAllActiveDashboardCountsLoaded || wdAllActiveDashboardLoaded;
            const countLabel = (!hasCount && wdAllActiveDashboardCountsLoading) ? '<i class="fa-solid fa-spinner fa-spin"></i>' : (hasCount ? String(count) : '—');
            const microcopy = wdAllActiveDashboardLoaded
                ? wdStatusMicrocopy(status, count)
                : (wdAllActiveDashboardCountsLoading && wdAllActiveDashboardCountsLoaded
                    ? `Updating • cached ${wdCacheAgeText(wdAllActiveDashboardCountSavedAt)}`
                    : (wdAllActiveDashboardCountsLoaded ? `Click to show sites • ${wdCacheAgeText(wdAllActiveDashboardCountSavedAt)}` : 'Checking current count...'));
            activeHtml += `
                <button class="wd-active-status-card tone-${tone} ${active} ${searchContextClass}" data-status="${wdSafe(filterKey)}" type="button" aria-label="Show ${wdSafe(status)} tasks">
                    <span class="wd-status-card-glow"></span>
                    <span class="wd-status-icon"><i class="fa-solid ${wdStatusIcon(status)}"></i></span>
                    <span class="wd-status-meta">
                        <strong>${countLabel}</strong>
                        <em>${wdSafe(status)}</em>
                        <small>${wdSafe(microcopy)}</small>
                    </span>
                    <span class="wd-status-arrow"><i class="fa-solid fa-arrow-right"></i></span>
                </button>`;
        });

        sectionsHtml += `
            <section class="wd-dashboard-card-section wd-dashboard-active-section">
                <div class="wd-dashboard-card-section-head">
                    <span><i class="fa-solid fa-list-check"></i> All active tasks</span>
                    <small>Open system tasks not assigned to you</small>
                </div>
                <div class="wd-dashboard-card-grid wd-dashboard-status-grid">${activeHtml}</div>
            </section>`;
    }

    cardsEl.innerHTML = sectionsHtml;
}

function wdGetFilteredDashboardTasks() {
    const searchInput = document.getElementById('wd-active-dashboard-search');
    const search = wdNormalize(searchInput?.value || '');
    const canSeeAllActive = wdCanSeeAllActiveDashboard();

    const selected = wdActiveDashboardSelectedStatus || WD_DASHBOARD_NONE;
    const isGlobalDashboardSearch = !!search && selected === WD_DASHBOARD_NONE;

    const searchableText = (task = {}) => [
        task.po,
        task.ref,
        task.invNumber,
        task.invoiceNumber,
        task.invoiceNo,
        task.invEntryID,
        task.vendorName,
        task.vendor,
        task.supplierName,
        task.site,
        task.status,
        task.remarks,
        task.currentStatus,
        task.bucket,
        task.personalBucket,
        task.attention,
        task.note,
        task.details,
        task.currentNote,
        task.ipc,
        task.queueLabel,
        task.queueText,
        task.type,
        task.group,
        task.amount
    ].join(' ').toLowerCase();

    const applySearch = (items) => {
        if (!search) return items;
        return items.filter(task => searchableText(task).includes(search));
    };

    const dedupeTasks = (items) => {
        const seen = new Set();
        const output = [];
        (Array.isArray(items) ? items : []).forEach(task => {
            const key = (typeof wdDashboardTaskIdentityKey === 'function')
                ? wdDashboardTaskIdentityKey(task)
                : [task.po, task.ref, task.key, task.invoiceKey, task.invEntryID].join('|');
            const normKey = wdNormalize(key || JSON.stringify(task || {}));
            if (seen.has(normKey)) return;
            seen.add(normKey);
            output.push(task);
        });
        return output;
    };

    // 10.8.5: If the admin/user types a PO/vendor before choosing a status card,
    // search only the already-loaded browser dashboard arrays. Do not fetch Firebase
    // again on every keystroke. This allows finding whether the task is Retention,
    // IPC, For Summary, For SRV, etc. without knowing the card first.
    if (isGlobalDashboardSearch) {
        const visibleSources = canSeeAllActive
            ? [...(Array.isArray(wdActiveDashboardTasks) ? wdActiveDashboardTasks : []), ...(Array.isArray(wdPersonalDashboardTasks) ? wdPersonalDashboardTasks : [])]
            : (Array.isArray(wdPersonalDashboardTasks) ? wdPersonalDashboardTasks.slice() : []);
        return dedupeTasks(applySearch(visibleSources)).sort(wdCompareDashboardPriority);
    }

    // 9.4.7: Normal/User accounts must also respect the clicked My Personal
    // status card. Previously non-admin users were always forced back to the
    // whole personal queue, so cards such as My For SRV or My On Hold changed
    // the active card but not the list below.
    let tasks = canSeeAllActive ? wdActiveDashboardTasks.slice() : wdPersonalDashboardTasks.slice();

    if (selected === WD_DASHBOARD_NONE) return [];

    if (selected && selected !== WD_DASHBOARD_ALL) {
        if (selected.startsWith(WD_DASHBOARD_MY_STATUS_PREFIX)) {
            const target = selected.slice(WD_DASHBOARD_MY_STATUS_PREFIX.length);
            tasks = wdPersonalDashboardTasks.filter(task => wdNormalize(task.personalBucket || wdDashboardPersonalBucket(task.status, task.type)) === target);
        } else if (canSeeAllActive && selected.startsWith(WD_DASHBOARD_STATUS_PREFIX)) {
            const target = selected.slice(WD_DASHBOARD_STATUS_PREFIX.length);
            tasks = wdActiveDashboardTasks.filter(task => wdNormalize(task.bucket || wdDashboardBucket(task.status, task.type)) === target);
        } else if (selected.startsWith(WD_DASHBOARD_PERSON_PREFIX)) {
            tasks = wdPersonalDashboardTasks.slice();
        } else if (canSeeAllActive) {
            // Backward compatibility with old direct status filters for Admin/Super Admin.
            tasks = wdActiveDashboardTasks.filter(task => (task.bucket || wdDashboardBucket(task.status, task.type)) === selected);
        } else {
            // Backward compatibility for any old direct status value on normal/User accounts.
            tasks = wdPersonalDashboardTasks.filter(task => (task.personalBucket || wdDashboardPersonalBucket(task.status, task.type)) === selected);
        }
    }

    return applySearch(tasks).slice().sort(wdCompareDashboardPriority);
}


function wdIsPersonalDashboardSelection(selected = wdActiveDashboardSelectedStatus) {
    const filter = String(selected || '');
    if (!wdCanSeeAllActiveDashboard()) return true;
    return filter.startsWith(WD_DASHBOARD_MY_STATUS_PREFIX) || filter.startsWith(WD_DASHBOARD_PERSON_PREFIX);
}



// 9.9.3: Site.csv helper for All Active site selector.
// Uses the existing global Site.csv cache when available and only performs a small
// optional Site.csv refresh if the cache has not been loaded yet.
let wdSiteCsvLookupMap = null;
let wdSiteCsvLookupPromise = null;

function wdNormalizeSiteKey(value) {
    const raw = wdText(value);
    if (!raw) return '';
    const numeric = raw.match(/\d{2,}/);
    return numeric ? numeric[0] : wdNormalize(raw);
}

function wdBuildSiteCsvLookupMap() {
    const map = new Map();
    const rows = (typeof allSitesCSVData !== 'undefined' && Array.isArray(allSitesCSVData)) ? allSitesCSVData : [];
    rows.forEach(row => {
        const siteNo = wdText(row?.site || row?.Site || row?.siteNumber || row?.site_no || row?.['Site Number'] || row?.['site number'] || '');
        const siteName = wdText(row?.description || row?.Description || row?.siteName || row?.['Site Name'] || row?.['site name'] || row?.name || row?.Name || '');
        if (!siteNo || !siteName) return;
        const key = wdNormalizeSiteKey(siteNo);
        if (key && !map.has(key)) map.set(key, siteName);
        const rawKey = wdNormalize(siteNo);
        if (rawKey && !map.has(rawKey)) map.set(rawKey, siteName);
    });
    wdSiteCsvLookupMap = map;
    return map;
}

function wdLookupSiteNameFromCsv(site) {
    const map = wdSiteCsvLookupMap || wdBuildSiteCsvLookupMap();
    const key = wdNormalizeSiteKey(site);
    if (key && map.has(key)) return wdText(map.get(key));
    const rawKey = wdNormalize(site);
    if (rawKey && map.has(rawKey)) return wdText(map.get(rawKey));
    return '';
}

function wdDisplaySiteName(site, fallbackName = '') {
    return wdLookupSiteNameFromCsv(site) || wdText(fallbackName || '');
}

function wdParseSiteCsvForDashboard(csvText) {
    const lines = wdText(csvText).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    const parseRow = (rowStr) => {
        const values = [];
        let inQuote = false;
        let current = '';
        for (let i = 0; i < rowStr.length; i++) {
            const ch = rowStr[i];
            if (ch === '"') {
                if (inQuote && rowStr[i + 1] === '"') { current += '"'; i++; }
                else inQuote = !inQuote;
            } else if (ch === ',' && !inQuote) {
                values.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += ch;
            }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));
        return values;
    };
    const headers = parseRow(lines[0]).map(h => wdNormalize(h));
    let siteIndex = headers.findIndex(h => ['site', 'site no', 'site number', 'site no.', 'site #'].includes(h));
    let nameIndex = headers.findIndex(h => ['description', 'site name', 'name', 'project name'].includes(h));
    if (siteIndex < 0) siteIndex = 0;
    if (nameIndex < 0) nameIndex = 1;
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseRow(lines[i]);
        const site = wdText(values[siteIndex]);
        const description = wdText(values[nameIndex]);
        if (site && description) rows.push({ site, description });
    }
    return rows;
}

async function wdFetchSiteCsvForDashboard() {
    const urls = [];
    try {
        if (typeof getFirebaseCSVUrl === 'function') urls.push(await getFirebaseCSVUrl('Site.csv'));
    } catch (_) {}
    urls.push('https://raw.githubusercontent.com/DC-database/Hub/main/Site.csv?v=' + Date.now());
    urls.push('https://cdn.jsdelivr.net/gh/DC-database/Hub@main/Site.csv?v=' + Date.now());
    for (const url of urls) {
        if (!url) continue;
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) continue;
            const text = await res.text();
            const rows = wdParseSiteCsvForDashboard(text);
            if (rows.length) return rows;
        } catch (e) {
            console.warn('Optional Dashboard Site.csv fetch failed:', e);
        }
    }
    return [];
}

function wdEnsureSiteCsvLookupForDashboard() {
    if (wdSiteCsvLookupMap && wdSiteCsvLookupMap.size) return Promise.resolve(wdSiteCsvLookupMap);
    if (typeof allSitesCSVData !== 'undefined' && Array.isArray(allSitesCSVData) && allSitesCSVData.length) {
        return Promise.resolve(wdBuildSiteCsvLookupMap());
    }
    if (wdSiteCsvLookupPromise) return wdSiteCsvLookupPromise;
    wdSiteCsvLookupPromise = (async () => {
        try {
            const data = await wdFetchSiteCsvForDashboard();
            if (Array.isArray(data) && data.length) {
                if (typeof allSitesCSVData !== 'undefined') allSitesCSVData = data;
                wdBuildSiteCsvLookupMap();
                try {
                    if (typeof setCache === 'function') setCache('cached_SITES', data);
                } catch (_) {}
                // Repaint once so site cards replace fallback labels like "Site 177" with the real project name.
                setTimeout(() => {
                    try { wdRenderDashboardList(); } catch (_) {}
                }, 0);
            } else {
                wdBuildSiteCsvLookupMap();
            }
        } catch (e) {
            console.warn('Dashboard Site.csv lookup failed; using site numbers only.', e);
            wdBuildSiteCsvLookupMap();
        }
        return wdSiteCsvLookupMap || new Map();
    })();
    return wdSiteCsvLookupPromise;
}

function wdFormatAccountingAmount(value) {
    const raw = wdText(value);
    if (!raw) return '';
    const hasParentheses = /^\s*\(.*\)\s*$/.test(raw);
    const cleaned = raw.replace(/,/g, '').replace(/[()]/g, '').replace(/[^0-9.\-]/g, '');
    const numeric = Number(cleaned);
    if (!Number.isFinite(numeric)) return raw;
    const amount = hasParentheses && numeric > 0 ? -numeric : numeric;
    const formatted = Math.abs(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return amount < 0 ? `(${formatted})` : formatted;
}

function wdResolveSiteNameFromPODetails(poDetails) {
    return wdText(wdGetPOValue(poDetails, [
        'Project Name', 'Project Name:',
        'Site Name', 'Site Name:',
        'Project Description', 'Project Description:',
        'Site Description', 'Site Description:',
        'Project Title', 'Project Title:'
    ], ''));
}

function wdSiteDisplayParts(site, siteName = '') {
    const label = wdText(site, 'No Site');
    const numberMatch = label.match(/\b\d{2,}\b/);
    const siteNo = numberMatch ? numberMatch[0] : label;
    let cleanName = wdDisplaySiteName(siteNo || label, siteName);
    if (!cleanName) {
        cleanName = label
            .replace(/^\s*site\s*[:#-]?\s*/i, '')
            .replace(siteNo, '')
            .replace(/^\s*[-–—:|,/]+\s*/, '')
            .trim();
    }
    if (!cleanName || wdNormalize(cleanName) === wdNormalize(siteNo) || wdNormalize(cleanName) === 'no site') {
        cleanName = siteNo && siteNo !== 'No Site' ? `Site ${siteNo}` : 'No Site assigned';
    }
    return { siteNo, siteName: cleanName, label };
}

function wdSiteGroupLabel(site) {
    const raw = wdText(site);
    return raw || 'No Site';
}

function wdSiteGroupSortValue(label) {
    const text = wdText(label).toLowerCase();
    if (!text || text === 'no site') return 'zzzz-no-site';
    const numeric = text.match(/\d+/);
    if (numeric) return String(Number(numeric[0])).padStart(6, '0') + '-' + text;
    return text;
}

function wdBuildSiteGroups(tasks, taskSorter = wdCompareDashboardPriority) {
    const groups = new Map();
    (tasks || []).forEach(task => {
        const label = wdSiteGroupLabel(task?.site);
        const key = wdNormalize(label) || 'no-site';
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label,
                siteName: wdDisplaySiteName(label, task?.siteName || task?.projectName || ''),
                sort: wdSiteGroupSortValue(label),
                tasks: []
            });
        } else if (!groups.get(key).siteName) {
            groups.get(key).siteName = wdDisplaySiteName(label, task?.siteName || task?.projectName || '');
        }
        groups.get(key).tasks.push(task);
    });
    return Array.from(groups.values())
        .map(group => ({ ...group, tasks: group.tasks.slice().sort(taskSorter) }))
        .sort((a, b) => String(a.sort).localeCompare(String(b.sort), undefined, { numeric: true, sensitivity: 'base' }));
}

function wdVendorGroupLabel(task) {
    const raw = wdText(
        task?.vendorName || task?.vendor || task?.supplierName || task?.Supplier ||
        task?.supplier || task?.vendor_name || ''
    );
    return raw && wdNormalize(raw) !== 'n/a' ? raw : 'No Vendor';
}

function wdVendorGroupSortValue(label) {
    const text = wdText(label).toLowerCase();
    if (!text || text === 'no vendor') return 'zzzz-no-vendor';
    return text;
}

function wdVendorGroupKey(label) {
    return wdNormalize(label) || 'no-vendor';
}

function wdBuildVendorGroups(tasks, taskSorter = wdCompareForSummaryByVendor) {
    const groups = new Map();
    (tasks || []).forEach(task => {
        const label = wdVendorGroupLabel(task);
        const key = wdVendorGroupKey(label);
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label,
                sort: wdVendorGroupSortValue(label),
                tasks: []
            });
        }
        groups.get(key).tasks.push(task);
    });
    return Array.from(groups.values())
        .map(group => ({ ...group, tasks: group.tasks.slice().sort(taskSorter) }))
        .sort((a, b) => String(a.sort).localeCompare(String(b.sort), undefined, { numeric: true, sensitivity: 'base' }));
}


function wdPendingToneRank(tone) {
    const order = { neutral: 0, fresh: 1, watch: 2, alert: 3, critical: 4 };
    return order[wdNormalize(tone)] ?? 0;
}

function wdSiteGroupAttentionTone(tasks) {
    let worstTone = 'neutral';
    (tasks || []).forEach(task => {
        const tone = wdPendingForTone(task?.queueTimestamp || task?.timestamp);
        if (wdPendingToneRank(tone) > wdPendingToneRank(worstTone)) worstTone = tone;
    });
    return worstTone;
}

function wdSiteGroupAttentionLabel(tone) {
    const t = wdNormalize(tone);
    if (t === 'critical') return '30+ days attention';
    if (t === 'alert') return '8+ days yellow attention';
    if (t === 'watch') return '3-7 days yellow-green attention';
    if (t === 'fresh') return '0-2 days green';
    return 'No date tracked';
}



// 10.4.7: Forward a compact task detail from Dashboard cards to Message users.
// Opens a preview/recipient selector first so Admin can confirm or change recipient.
let wdForwardTaskCounter = 0;
let wdForwardPending = null;
window.__wdForwardTaskStore = window.__wdForwardTaskStore || {};

function wdForwardRegisterTask(task) {
    const id = `wd-fwd-${Date.now()}-${++wdForwardTaskCounter}`;
    window.__wdForwardTaskStore[id] = task;
    return id;
}

function wdForwardTaskKind(task) {
    const haystack = [
        task?.type,
        task?.for,
        task?.bucket,
        task?.personalBucket,
        task?.status,
        task?.remarks,
        task?.note
    ].map(wdText).join(' ').toLowerCase();
    return haystack.includes('ipc') ? 'IPC' : 'invoice';
}

function wdBuildForwardTaskMessage(task) {
    const kind = wdForwardTaskKind(task);
    const po = wdText(task?.po || task?.originalPO || task?.ref || 'N/A') || 'N/A';
    const amountRaw = task?.amountPaid || task?.amount || task?.invoiceAmount || task?.poValue || '';
    const amount = wdFormatAccountingAmount(amountRaw) || wdText(amountRaw) || '—';
    const vendor = wdText(task?.vendorName || task?.vendor || task?.supplier || 'N/A') || 'N/A';
    const note = wdText(task?.note || task?.currentNote || task?.remarksNote || '') || 'No current note added.';

    // DM safe text collapses line breaks, so keep the actual message compact.
    return `Please follow up this ${kind}. | PO No: ${po} | PO Value: ${amount} | Vendor: ${vendor} | Current Note: ${note}`;
}

function wdBuildForwardPreviewText(task) {
    const kind = wdForwardTaskKind(task);
    const po = wdText(task?.po || task?.originalPO || task?.ref || 'N/A') || 'N/A';
    const amountRaw = task?.amountPaid || task?.amount || task?.invoiceAmount || task?.poValue || '';
    const amount = wdFormatAccountingAmount(amountRaw) || wdText(amountRaw) || '—';
    const vendor = wdText(task?.vendorName || task?.vendor || task?.supplier || 'N/A') || 'N/A';
    const note = wdText(task?.note || task?.currentNote || task?.remarksNote || '') || 'No current note added.';
    return `Please follow up this ${kind}.\n\nPO No: ${po}\nPO Value: ${amount}\nVendor: ${vendor}\nCurrent Note: ${note}`;
}

function wdGetForwardRecipients() {
    const data = (typeof getApproversDataSafe === 'function') ? getApproversDataSafe() : null;
    if (!data || typeof data !== 'object') return [];

    const seen = new Set();
    return Object.keys(data).map(key => {
        const item = data[key] || {};
        return {
            key,
            name: wdText(item.Name || item.name || ''),
            position: wdText(item.Position || item.position || ''),
            role: wdText(item.Role || item.role || ''),
            site: wdText(item.Site || item.site || '')
        };
    }).filter(user => {
        if (!user.key || !user.name) return false;
        const sig = `${user.key}::${wdNormalize(user.name)}`;
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function wdEnsureForwardModal() {
    let modal = document.getElementById('wd-forward-task-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'wd-forward-task-modal';
    modal.className = 'wd-forward-modal hidden';
    modal.innerHTML = `
        <div class="wd-forward-modal-backdrop" data-wd-forward-close="1"></div>
        <div class="wd-forward-modal-card" role="dialog" aria-modal="true" aria-labelledby="wd-forward-modal-title">
            <div class="wd-forward-modal-head">
                <div>
                    <span class="wd-forward-modal-kicker"><i class="fa-solid fa-paper-plane"></i> Forward task details</span>
                    <h3 id="wd-forward-modal-title">Send message preview</h3>
                </div>
                <button type="button" class="wd-forward-modal-x" data-wd-forward-close="1" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="wd-forward-modal-body">
                <label class="wd-forward-field">
                    <span>Send to</span>
                    <select id="wd-forward-recipient"></select>
                </label>
                <div id="wd-forward-recipient-note" class="wd-forward-recipient-note"></div>
                <label class="wd-forward-field">
                    <span>Message preview</span>
                    <textarea id="wd-forward-preview" readonly rows="7"></textarea>
                </label>
            </div>
            <div class="wd-forward-modal-actions">
                <button type="button" class="wd-forward-cancel" data-wd-forward-close="1">Cancel</button>
                <button type="button" class="wd-forward-send" id="wd-forward-send-btn"><i class="fa-solid fa-paper-plane"></i> Send Message</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target.closest('[data-wd-forward-close]')) {
            wdCloseForwardTaskModal();
        }
    });

    const select = modal.querySelector('#wd-forward-recipient');
    if (select) {
        select.addEventListener('change', wdUpdateForwardRecipientNote);
    }

    const sendBtn = modal.querySelector('#wd-forward-send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', wdSendForwardTaskMessageFromModal);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) wdCloseForwardTaskModal();
    });

    return modal;
}

function wdUpdateForwardRecipientNote() {
    const modal = document.getElementById('wd-forward-task-modal');
    if (!modal || !wdForwardPending) return;
    const select = modal.querySelector('#wd-forward-recipient');
    const note = modal.querySelector('#wd-forward-recipient-note');
    if (!select || !note) return;

    const selectedName = select.options[select.selectedIndex]?.textContent || '';
    const original = wdText(wdForwardPending.attention || '');
    if (original && selectedName && wdNormalize(selectedName) !== wdNormalize(original)) {
        note.innerHTML = `<i class="fa-solid fa-circle-info"></i> Original Attention: <strong>${wdSafe(original)}</strong> · Sending to: <strong>${wdSafe(selectedName)}</strong>`;
    } else if (original) {
        note.innerHTML = `<i class="fa-solid fa-user-check"></i> Default recipient follows Attention: <strong>${wdSafe(original)}</strong>`;
    } else {
        note.innerHTML = `<i class="fa-solid fa-circle-info"></i> Choose the recipient who should follow up this task.`;
    }
}

async function wdOpenForwardTaskPreview(taskId, triggerBtn) {
    const task = window.__wdForwardTaskStore?.[taskId];
    if (!task) {
        alert('Task details are no longer available. Please refresh the Dashboard and try again.');
        return;
    }

    try {
        if (typeof ensureApproverDataCached === 'function') {
            await ensureApproverDataCached(false);
        }
    } catch (e) {
        console.warn('Could not refresh approver list for forward modal:', e);
    }

    const recipients = wdGetForwardRecipients();
    if (!recipients.length) {
        alert('No Message recipients are available. Please refresh and try again.');
        return;
    }

    const attention = wdText(task.attention || task.Attention || task.assignedTo || '');
    let defaultRecipient = null;
    if (attention && typeof window.dmResolveUserByDisplayName === 'function') {
        defaultRecipient = window.dmResolveUserByDisplayName(attention);
    }
    if (!defaultRecipient || !defaultRecipient.key) {
        defaultRecipient = recipients.find(user => wdNormalize(user.name) === wdNormalize(attention)) || recipients[0];
    }

    wdForwardPending = {
        taskId,
        task,
        attention,
        message: wdBuildForwardTaskMessage(task),
        preview: wdBuildForwardPreviewText(task),
        triggerBtn: triggerBtn || null
    };

    const modal = wdEnsureForwardModal();
    const select = modal.querySelector('#wd-forward-recipient');
    const preview = modal.querySelector('#wd-forward-preview');
    const sendBtn = modal.querySelector('#wd-forward-send-btn');

    if (select) {
        select.innerHTML = recipients.map(user => {
            const meta = [user.position, user.site].filter(Boolean).join(' · ');
            const label = meta ? `${user.name} (${meta})` : user.name;
            const selected = user.key === defaultRecipient.key ? 'selected' : '';
            return `<option value="${wdSafe(user.key)}" data-name="${wdSafe(user.name)}" ${selected}>${wdSafe(label)}</option>`;
        }).join('');
    }
    if (preview) preview.value = wdForwardPending.preview;
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Message';
    }

    wdUpdateForwardRecipientNote();
    modal.classList.remove('hidden');
    setTimeout(() => { try { select?.focus(); } catch (_) {} }, 60);
}

function wdCloseForwardTaskModal() {
    const modal = document.getElementById('wd-forward-task-modal');
    if (modal) modal.classList.add('hidden');
    wdForwardPending = null;
}

async function wdSendForwardTaskMessageFromModal() {
    const modal = document.getElementById('wd-forward-task-modal');
    const select = modal?.querySelector('#wd-forward-recipient');
    const sendBtn = modal?.querySelector('#wd-forward-send-btn');
    if (!wdForwardPending || !select) return;

    const toKey = select.value;
    const toName = select.options[select.selectedIndex]?.dataset?.name || select.options[select.selectedIndex]?.textContent || '';
    if (!toKey || !toName) {
        alert('Please choose a recipient.');
        return;
    }

    if (typeof window.dmSendDirectMessage !== 'function') {
        alert('Message module is not ready. Please open Messages once or refresh and try again.');
        return;
    }

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    }

    try {
        await window.dmSendDirectMessage(toKey, toName, wdForwardPending.message);
        const triggerBtn = wdForwardPending.triggerBtn;
        wdCloseForwardTaskModal();
        if (triggerBtn) {
            triggerBtn.classList.add('sent');
            setTimeout(() => triggerBtn.classList.remove('sent'), 1200);
        }
        alert(`Task detail forwarded to ${toName}.`);
    } catch (err) {
        console.error('Forward task detail failed:', err);
        alert('Could not forward the task detail. Please try again.');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Message';
        }
    }
}

window.wdOpenForwardTaskPreview = wdOpenForwardTaskPreview;

function wdRenderDashboardCorkNote(task, index, options = {}) {
    const displayStatus = wdTaskDisplayStatus(task);
    const statusText = wdText(displayStatus || task.status || task.bucket || 'Pending') || 'Pending';
    // 9.9.6: The top-right note pill is only a simple queue title (IPC, For SRV, Report, etc.).
    // The detailed/current status remains in the Current Status note box below.
    const simpleStatusTitle = wdText(
        options.simpleStatusTitle ||
        task.personalBucket ||
        task.bucket ||
        wdDashboardPersonalBucket(task.status, task.type) ||
        wdDashboardBucket(task.status, task.type) ||
        task.status ||
        'Pending'
    ) || 'Pending';
    const statusTone = wdStatusTone(task.bucket || simpleStatusTitle || statusText || task.status);
    // 10.8.7: Cork-board note actions use compact labels and support SRV,
    // so INV/RPT/SRV + Forward can fit without being cut.
    const invoicePdf = wdHasPdfName(task.invName) ? wdBuildPdfButton('INV', PDF_BASE_PATH, task.invName, 'invoice') : '';
    const reportPdf = wdHasPdfName(task.reportName) ? wdBuildPdfButton('RPT', REPORT_BASE_PATH, task.reportName, 'report') : '';
    const srvPdf = (typeof SRV_BASE_PATH !== 'undefined' && SRV_BASE_PATH && wdHasPdfName(task.srvName)) ? wdBuildPdfButton('SRV', SRV_BASE_PATH, task.srvName, 'srv') : '';
    const forwardTaskId = wdForwardRegisterTask(task);
    const forwardBtn = `<button class="wd-forward-task-btn" type="button" data-wd-forward-task-id="${wdSafe(forwardTaskId)}" title="Forward PO value, vendor, and current note to Attention user"><i class="fa-solid fa-paper-plane"></i> Forward</button>`;
    const poDisplay = task.po || task.ref || 'N/A';
    const invoiceNo = task.ref && task.ref !== task.po ? task.ref : (task.invoiceNumber || task.invoiceNo || '—');
    // 10.1.3: Do not fallback to Entered Date for Invoice Date.
    // IPC jobs should show blank/— until they are converted to an invoice.
    const invoiceDate = wdFormatDashboardDate(task.invoiceDate) || '—';
    const amountText = wdFormatAccountingAmount(task.amount) || '—';
    const taskQueueLabel = wdCorkNoteDateLabel(task);
    const taskDateTimestamp = task.queueTimestamp || task.timestamp;
    const queueTime = wdQueueDateOnlyText(taskDateTimestamp);
    const pendingForText = wdPendingForText(taskDateTimestamp);
    const pendingForTone = wdPendingForTone(taskDateTimestamp);
    const noteText = wdText(task.note) || 'No current note added.';
    const attentionText = wdText(task.attention) || 'Not assigned';
    const vendorText = wdText(task.vendorName) || 'N/A';
    const typeText = wdText(task.type) || 'Invoice';
    const groupText = (wdNormalize(typeText).includes('invoice') && wdText(task.group)) ? `Group: ${wdText(task.group)}` : '';
    const siteText = wdText(options.siteLabel || task.site) || 'N/A';
    const tilt = ['-0.18deg', '0.12deg', '-0.08deg', '0.18deg'][index % 4];

    return `
        <article class="wd-cork-note tone-${statusTone} pending-${pendingForTone}" style="--note-delay:${Math.min(index, 14) * 18}ms; --note-tilt:${tilt};">
            <span class="wd-note-pin" aria-hidden="true"></span>
            <div class="wd-note-head">
                <div>
                    <span class="wd-note-kicker">PO Number</span>
                    <h3>${wdSafe(poDisplay)}</h3>
                </div>
                <span class="wd-status-pill tone-${statusTone}"><i class="fa-solid ${wdStatusIcon(simpleStatusTitle)}"></i> ${wdSafe(simpleStatusTitle)}</span>
            </div>

            <div class="wd-note-vendor" title="${wdSafe(vendorText)}">
                <i class="fa-regular fa-building"></i>
                <span>${wdSafe(vendorText)}</span>
            </div>

            <div class="wd-note-detail-grid">
                <span><small>Invoice No.</small><strong>${wdSafe(invoiceNo)}</strong></span>
                <span><small>Amount</small><strong>${wdSafe(amountText)}</strong></span>
                <span><small>Invoice Date</small><strong>${wdSafe(invoiceDate)}</strong></span>
                <span><small>${wdSafe(taskQueueLabel)}</small><strong>${wdSafe(queueTime)}</strong></span>
                <span class="wd-note-age wd-note-age-${pendingForTone}"><small>Pending For</small><strong>${wdSafe(pendingForText)}</strong></span>
            </div>

            <div class="wd-note-current-note">
                <small>Current note</small>
                <p>${wdSafe(noteText)}</p>
            </div>

            <div class="wd-note-current-status tone-${statusTone}">
                <small>Current status</small>
                <p><i class="fa-solid ${wdStatusIcon(statusText)}"></i> ${wdSafe(statusText)}</p>
            </div>

            <div class="wd-note-responsible">
                <span><i class="fa-solid fa-user-check"></i> ${wdSafe(attentionText)}</span>
                <span class="wd-note-site-ref"><i class="fa-solid fa-location-dot"></i> <strong>${wdSafe(siteText)}</strong></span>
                <span><i class="fa-solid fa-tag"></i> ${wdSafe(typeText)}</span>
                ${groupText ? `<span><i class="fa-solid fa-layer-group"></i> ${wdSafe(groupText)}</span>` : ''}
            </div>

            <div class="wd-note-actions">
                ${invoicePdf}
                ${reportPdf}
                ${srvPdf}
                ${forwardBtn}
            </div>
        </article>`;
}

function wdRenderAllActiveCorkboard(baseTasks, selectedLabel, cacheSuffix, summaryEl, listEl) {
    wdEnsureSiteCsvLookupForDashboard();
    const statusLabel = selectedLabel || 'All Active Tasks';
    const taskSorter = wdDashboardSorterForLabel(statusLabel);
    const isForSummaryView = wdIsForSummaryDashboardLabel(statusLabel);
    const tasks = (baseTasks || []).slice().sort(taskSorter);
    const groupLabel = isForSummaryView ? 'vendor' : 'site';
    const groupLabelPlural = isForSummaryView ? 'vendor groups' : 'site groups';
    const groups = isForSummaryView
        ? wdBuildVendorGroups(tasks, taskSorter)
        : wdBuildSiteGroups(tasks, taskSorter);

    if (summaryEl) {
        summaryEl.textContent = `${tasks.length} active task${tasks.length === 1 ? '' : 's'} in ${groups.length} ${groupLabel} group${groups.length === 1 ? '' : 's'}${cacheSuffix}`;
    }

    if (!groups.length) {
        wdAllActiveCorkboardSelectedSiteKey = '';
        listEl.innerHTML = '<div class="wd-dashboard-empty-state">No active item found for this status.</div>';
        return;
    }

    // 10.4.7: After an Admin clicks a status card, show the selector first.
    // 10.8.0: For Summary uses vendor cards instead of site cards.
    if (wdAllActiveCorkboardSelectedSiteKey && !groups.some(group => group.key === wdAllActiveCorkboardSelectedSiteKey)) {
        wdAllActiveCorkboardSelectedSiteKey = '';
    }

    const selectedGroup = wdAllActiveCorkboardSelectedSiteKey
        ? groups.find(group => group.key === wdAllActiveCorkboardSelectedSiteKey)
        : null;
    const selectedTasks = selectedGroup ? (selectedGroup.tasks || []).slice().sort(taskSorter) : [];
    const selectedSiteParts = selectedGroup && !isForSummaryView ? wdSiteDisplayParts(selectedGroup.label || '', selectedGroup.siteName || '') : null;
    const selectedDisplayLabel = selectedGroup
        ? (isForSummaryView ? selectedGroup.label : selectedSiteParts.label)
        : '';

    if (summaryEl) {
        summaryEl.textContent = selectedGroup
            ? `${selectedTasks.length} item${selectedTasks.length === 1 ? '' : 's'} shown for ${selectedDisplayLabel} · ${tasks.length} total in ${statusLabel}${cacheSuffix}`
            : `${tasks.length} active item${tasks.length === 1 ? '' : 's'} in ${groups.length} ${groupLabel} group${groups.length === 1 ? '' : 's'} for ${statusLabel}. Choose a ${groupLabel} to show pinned notes${cacheSuffix}`;
    }

    const groupCardsHtml = groups.map(group => {
        const active = selectedGroup && group.key === selectedGroup.key ? 'active' : '';
        const statusCounts = group.tasks.reduce((acc, task) => {
            const label = wdText(task.bucket || task.status || 'Open');
            acc[label] = (acc[label] || 0) + 1;
            return acc;
        }, {});
        const statusPreview = Object.entries(statusCounts).slice(0, 2)
            .map(([label, count]) => `${wdSafe(label)} ${count}`)
            .join(' · ');
        const attentionTone = wdSiteGroupAttentionTone(group.tasks);
        const attentionLabel = wdSiteGroupAttentionLabel(attentionTone);

        if (isForSummaryView) {
            const vendorLabel = wdText(group.label, 'No Vendor');
            const initials = vendorLabel
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part.charAt(0).toUpperCase())
                .join('') || 'V';
            return `
            <button class="wd-cork-site-card wd-cork-vendor-card ${active} site-age-${wdSafe(attentionTone)}" type="button" data-site-key="${wdSafe(group.key)}" aria-label="Show ${wdSafe(vendorLabel)} For Summary tasks · ${wdSafe(attentionLabel)}">
                <span class="wd-site-card-pin" title="${wdSafe(attentionLabel)}"><i class="fa-solid fa-thumbtack"></i></span>
                <span class="wd-site-card-no"><i class="fa-regular fa-building"></i> ${wdSafe(initials)}</span>
                <span class="wd-site-card-name">${wdSafe(vendorLabel)}</span>
                <span class="wd-site-card-count">${group.tasks.length} item${group.tasks.length === 1 ? '' : 's'}</span>
                ${statusPreview ? `<small>${statusPreview}</small>` : ''}
            </button>`;
        }

        const parts = wdSiteDisplayParts(group.label, group.siteName);
        return `
            <button class="wd-cork-site-card ${active} site-age-${wdSafe(attentionTone)}" type="button" data-site-key="${wdSafe(group.key)}" aria-label="Show ${wdSafe(group.label)} tasks · ${wdSafe(attentionLabel)}">
                <span class="wd-site-card-pin" title="${wdSafe(attentionLabel)}"><i class="fa-solid fa-thumbtack"></i></span>
                <span class="wd-site-card-no">${wdSafe(parts.siteNo)}</span>
                <span class="wd-site-card-name">${wdSafe(parts.siteName)}</span>
                <span class="wd-site-card-count">${group.tasks.length} item${group.tasks.length === 1 ? '' : 's'}</span>
                ${statusPreview ? `<small>${statusPreview}</small>` : ''}
            </button>`;
    }).join('');

    const cardsHtml = selectedGroup
        ? selectedTasks.map((task, index) => wdRenderDashboardCorkNote(task, index, isForSummaryView ? {} : { siteLabel: selectedSiteParts.label })).join('')
        : '';

    const selectorHtml = `
        <div class="wd-site-selector-panel ${selectedGroup ? 'has-selection' : 'site-only'} ${isForSummaryView ? 'vendor-selector' : ''}">
            <div class="wd-cork-site-selector" role="tablist" aria-label="All Active Tasks ${groupLabel} selector">
                ${groupCardsHtml}
            </div>
        </div>`;

    const corkNotesHtml = selectedGroup
        ? `
            <div class="wd-cork-board wd-cork-board-site-filtered wd-cork-notes-board">
                <div class="wd-cork-note-grid">${cardsHtml}</div>
            </div>`
        : '';

    listEl.innerHTML = `${selectorHtml}${corkNotesHtml}`;
}

function wdRenderDashboardList() {
    const listEl = document.getElementById('wd-active-dashboard-list');
    const titleEl = document.getElementById('wd-active-dashboard-title');
    const summaryEl = document.getElementById('wd-active-dashboard-summary');
    if (!listEl) return;

    const selected = wdActiveDashboardSelectedStatus || WD_DASHBOARD_NONE;
    const searchInput = document.getElementById('wd-active-dashboard-search');
    const globalSearch = wdNormalize(searchInput?.value || '');
    const baseTasks = wdGetFilteredDashboardTasks();
    let selectedLabel = selected === WD_DASHBOARD_NONE
        ? (globalSearch ? 'Global search results' : 'Select a status card')
        : ((wdActiveDashboardSelectedStatus || '').startsWith(WD_DASHBOARD_MY_STATUS_PREFIX)
            ? wdDashboardSelectedLabel()
            : (wdCanSeeAllActiveDashboard() ? wdDashboardSelectedLabel() : 'My Personal Tasks'));

    // 11.0.0: In Dashboard global search mode, always keep one consistent
    // site-card result flow. This intentionally does not switch the title to
    // "For Summary" when For Summary is the only matched queue, because direct
    // For Summary clicks are vendor-grouped while global search must be site-grouped.

    if (titleEl) titleEl.textContent = selectedLabel;

    if (selected === WD_DASHBOARD_NONE && !globalSearch) {
        if (summaryEl) {
            const cacheSuffix = wdActiveDashboardCacheMeta && wdActiveDashboardCacheMeta.fromCache
                ? ` · browser cache ${wdCacheAgeText(wdActiveDashboardCacheMeta.savedAt)}`
                : '';
            summaryEl.textContent = wdCanSeeAllActiveDashboard()
                ? `Click any All Active or My Personal status card to review its date tabs${cacheSuffix}`
                : `Click a My Personal Task status card to review its date tabs${cacheSuffix}`;
        }
        listEl.innerHTML = `
            <div class="wd-dashboard-empty-state">
                <span class="wd-empty-icon"><i class="fa-solid fa-hand-pointer"></i></span>
                <div>
                    <strong>No list loaded yet</strong>
                    <p>${wdCanSeeAllActiveDashboard()
                        ? 'Select one status card above, then choose a date tab.'
                        : 'Select one My Personal Task card above, then choose a date tab.'}</p>
                </div>
            </div>`;
        return;
    }

    if (!wdActiveDashboardTasks.length && !wdPersonalDashboardTasks.length) {
        if (summaryEl) summaryEl.textContent = 'No personal or active dashboard items found for your access.';
        listEl.innerHTML = `
            <div class="wd-dashboard-empty-state success">
                <span class="wd-empty-icon"><i class="fa-solid fa-circle-check"></i></span>
                <div>
                    <strong>Clear board</strong>
                    <p>No personal or active dashboard items found for your access.</p>
                </div>
            </div>`;
        return;
    }

    if (!baseTasks.length) {
        const globalSearchEmpty = selected === WD_DASHBOARD_NONE && globalSearch;
        if (summaryEl) summaryEl.textContent = globalSearchEmpty
            ? 'No matching task found in the already-loaded Dashboard cache.'
            : 'No matching task found for the selected card/search.';
        listEl.innerHTML = `
            <div class="wd-dashboard-empty-state">
                <span class="wd-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
                <div>
                    <strong>No matching task</strong>
                    <p>${globalSearchEmpty
                        ? 'The global search used the Dashboard data already loaded in this browser. Refresh the Dashboard only if you need to verify newest records.'
                        : 'Try another status card or search by PO, vendor, site, attention, note, or status.'}</p>
                </div>
            </div>`;
        return;
    }

    const cacheSuffix = wdActiveDashboardCacheMeta && wdActiveDashboardCacheMeta.fromCache
        ? ` · browser cache ${wdCacheAgeText(wdActiveDashboardCacheMeta.savedAt)}`
        : '';

    // 9.9.1: All Active Tasks is an overview/help board, not a personal queue.
    // Keep date tabs only for My Personal Tasks. All Active now uses a compact
    // yellow note board grouped by site so users can quickly see where they can help.
    if (!wdIsPersonalDashboardSelection(selected)) {
        wdRenderAllActiveCorkboard(baseTasks, selectedLabel, cacheSuffix, summaryEl, listEl);
        return;
    }

    const dateGroups = wdBuildQueueDateGroups(baseTasks);
    if (!dateGroups.length) {
        listEl.innerHTML = '<div class="wd-dashboard-empty-state">No queue date available for this selection.</div>';
        return;
    }

    if (!wdActiveDashboardSelectedQueueDate || !dateGroups.some(g => g.key === wdActiveDashboardSelectedQueueDate)) {
        // Default to the oldest date tab. This guides priority without forcing the user.
        wdActiveDashboardSelectedQueueDate = dateGroups[0].key;
    }

    const selectedGroup = dateGroups.find(g => g.key === wdActiveDashboardSelectedQueueDate) || dateGroups[0];
    const personalTaskSorter = wdDashboardSorterForLabel(selectedLabel);
    const tasks = (selectedGroup.tasks || []).slice().sort(personalTaskSorter);
    const queueLabel = tasks[0] ? wdCorkNoteDateLabel(tasks[0]) : 'Date';

    if (summaryEl) {
        summaryEl.textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'} shown for ${selectedGroup.fullLabel} · ${baseTasks.length} total in this card${cacheSuffix}`;
    }

    const tabsHtml = dateGroups.map(group => {
        const active = selectedGroup && group.key === selectedGroup.key ? 'active' : '';
        const age = group.tasks[0]?.queueTimestamp ? wdQueueAgeParts(group.tasks[0].queueTimestamp).text : '';
        return `
            <button class="wd-date-tab ${active}" type="button" data-date-key="${wdSafe(group.key)}" aria-label="Show ${wdSafe(group.fullLabel)} tasks">
                <span class="wd-date-tab-day">${wdSafe(group.label)}</span>
                <span class="wd-date-tab-count">${group.tasks.length}</span>
                ${age ? `<small>${wdSafe(age)}</small>` : ''}
            </button>`;
    }).join('');

    const cards = tasks.map((task, index) => wdRenderDashboardCorkNote(task, index)).join('');

    listEl.innerHTML = `
        <div class="wd-task-board wd-task-board-date-tabs wd-personal-cork-queue">
            <div class="wd-task-board-head">
                <div>
                    <span class="wd-board-label">${wdSafe(queueLabel)} queue</span>
                    <strong>${tasks.length}</strong>
                    <span>${wdSafe(selectedGroup.fullLabel)} · ${tasks.length === 1 ? 'entry' : 'entries'}</span>
                </div>
                <div class="wd-board-access-pill"><i class="fa-solid fa-eye"></i> ${wdSafe(wdAccessLabel())}</div>
            </div>
            <div class="wd-date-tabs-wrap" role="tablist" aria-label="Queue date filter">
                ${tabsHtml}
            </div>
            <div class="wd-date-tabs-note"><i class="fa-solid fa-arrow-down-short-wide"></i> Oldest date is selected first. Users may click any date tab when a newer item is more urgent.</div>
            <div class="wd-cork-board wd-personal-cork-board">
                <div class="wd-cork-note-grid wd-personal-cork-note-grid">${cards}</div>
            </div>
        </div>`;
}

// Retired calendar functions are kept as safe no-ops for old listeners/cache.
function renderWorkdeskCalendar() { return; }
function populateAdminCalendarTasks() { allAdminCalendarTasks = []; return Promise.resolve(); }
function populateCalendarTasks() { return Promise.resolve(); }
function renderYearView() { return; }
function toggleCalendarView() { return; }
function displayCalendarTasksForDay() { return; }
function showDayView() { return; }
function generateDateScroller() { return; }

// ==========================================================================
// FIX: Clean Excel Download (Removes Buttons before saving)
// ==========================================================================
function handleDownloadWorkdeskCSV() {
    const originalTable = document.querySelector("#reporting-printable-area table");
    if (!originalTable) {
        alert("Report table not found.");
        return;
    }

    // 1. Clone the table so we don't mess up the actual screen
    const tableClone = originalTable.cloneNode(true);

    // 2. REMOVE ALL BUTTONS & ICONS FROM THE CLONE
    // This strips out the "Print", "History", "Del" text
    const junk = tableClone.querySelectorAll('button, .action-btn, .waybill-btn, .history-btn, .delete-btn, i');
    junk.forEach(el => el.remove());

    // 3. Generate CSV from the CLEAN clone
    let csv = [];
    const rows = tableClone.querySelectorAll("tr");

    for (let i = 0; i < rows.length; i++) {
        const row = [],
            cols = rows[i].querySelectorAll("td, th");

        for (let j = 0; j < cols.length; j++) {
            // Clean up extra whitespace left behind by removed buttons
            // .trim() removes spaces from start/end
            let cleanText = cols[j].innerText.replace(/\s+/g, ' ').trim();

            // Escape double quotes for CSV format
            row.push('"' + cleanText.replace(/"/g, '""') + '"');
        }
        csv.push(row.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "job_records.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// #endregion BLOCK 12 — WORKDESK DASHBOARD CONTROL CENTER + REPORTS

// ========================================================================== 
// 9.9.8 — Shared History Modal Scope Guard
// Purpose: keep history styling separated by module so WorkDesk, Invoice
// Management, and Inventory do not accidentally inherit each other's theme.
// ========================================================================== 
(function wdInstallHistoryScopeGuard() {
    if (window.__wdHistoryScopeGuardInstalled) return;
    window.__wdHistoryScopeGuardInstalled = true;

    document.addEventListener('click', function(event) {
        const trigger = event.target.closest('.history-btn, .wd-action-history, [data-history-action], [data-open-history]');
        if (!trigger) return;

        const modal = document.getElementById('history-modal');
        if (!modal) return;

        modal.classList.remove('history-scope-workdesk', 'history-scope-invoice', 'history-scope-inventory');

        if (trigger.closest('#workdesk-view')) {
            modal.classList.add('history-scope-workdesk');
        } else if (trigger.closest('#inventory-view')) {
            modal.classList.add('history-scope-inventory');
        } else if (trigger.closest('#invoice-management-view')) {
            modal.classList.add('history-scope-invoice');
        }
    }, true);
}());
