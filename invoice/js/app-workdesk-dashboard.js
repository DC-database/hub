/* ==========================================================================
   js/app-workdesk-dashboard.js
   IBA WorkDesk Dashboard Active Task Control Center
   Version: 9.4.8

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
   ========================================================================== */

// =================================================================================================
// #region BLOCK 12 — WORKDESK DASHBOARD CONTROL CENTER + REPORTS
// Purpose: WorkDesk dashboard counts/list for incomplete invoice tasks + clean Job Records CSV export.
// =================================================================================================

let wdActiveDashboardTasks = [];
let wdPersonalDashboardTasks = [];
let wdActiveDashboardSelectedStatus = '__NONE__';
let wdActiveDashboardCacheMeta = { fromCache: false, savedAt: 0 };
let wdDashboardJobEntriesCache = { entries: [], savedAt: 0 };

// 8.5.1: Keep the WorkDesk Dashboard self-sufficient for short periods.
// It prevents repeated Firebase downloads when users switch pages or reopen the dashboard.
// Manual Refresh still bypasses this cache and gets fresh live data.
const WD_DASHBOARD_CACHE_KEY = 'IBA_WD_ACTIVE_DASHBOARD_CACHE_V12';
const WD_ACTIVE_TASK_SOURCE_CACHE_KEY = 'IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V2';
const WD_DASHBOARD_CACHE_TTL = 60 * 60 * 1000; // 9.3.1: 60 minutes to reduce Firebase reads; Refresh still forces live data.

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
    'deleted'
]);

const WD_STATUS_ORDER = [
    'New Entry',
    'For SRV',
    'For IPC',
    'Pending',
    'On Hold',
    'In Process',
    'Unresolved',
    'IPC',
    'Report'
];

const WD_DASHBOARD_ALLOWED_BUCKETS = new Set([
    'new entry',
    'for srv',
    'pending',
    'on hold',
    'in process',
    'unresolved',
    'ipc',
    'report'
]);

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

function wdLoadDashboardCache() {
    const cached = wdReadJSONStorage(window.localStorage, WD_DASHBOARD_CACHE_KEY);
    if (!cached || !Array.isArray(cached.tasks)) return null;
    if (cached.userKey !== wdDashboardUserCacheKey()) return null;
    if ((Date.now() - Number(cached.savedAt || 0)) > WD_DASHBOARD_CACHE_TTL) return null;
    return cached;
}

function wdSaveDashboardCache(tasks, personalTasks) {
    if (!Array.isArray(tasks)) return;
    wdWriteJSONStorage(window.localStorage, WD_DASHBOARD_CACHE_KEY, {
        userKey: wdDashboardUserCacheKey(),
        savedAt: Date.now(),
        tasks,
        personalTasks: Array.isArray(personalTasks) ? personalTasks : []
    });
}

function wdClearDashboardCache() {
    try { window.localStorage.removeItem(WD_DASHBOARD_CACHE_KEY); } catch (e) { /* ignore */ }
}

// 8.5.2: Public safe cache clearer for save/update flows that change task buckets
// such as converting an IPC Job Record to an Invoice Job Record.
function wdClearWorkdeskDashboardCache() {
    try { window.localStorage.removeItem(WD_DASHBOARD_CACHE_KEY); } catch (e) { /* ignore */ }
    try { window.sessionStorage.removeItem(WD_ACTIVE_TASK_SOURCE_CACHE_KEY); } catch (e) { /* ignore */ }
    wdActiveDashboardCacheMeta = { fromCache: false, savedAt: 0 };
    wdPersonalDashboardTasks = [];
}
window.wdClearWorkdeskDashboardCache = wdClearWorkdeskDashboardCache;

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

function wdIsNewEntryStatus(status) {
    const s = wdNormalize(status);
    return !s || s === 'pending' || s === 'new' || s === 'new entry' || s.includes('new entry');
}

function wdDashboardBucket(status, type = '') {
    const typeText = wdNormalize(type);
    const s = wdNormalize(status);

    // 9.2.9: Dashboard is an active-work preview only. Keep bucket names tight
    // so completed/review/approval records do not come back into the board.
    if (s.includes('srv')) return 'For SRV';
    if (typeText === 'ipc' || s.includes('ipc')) return 'IPC';
    if (s.includes('report')) return 'Report';
    if (s.includes('hold') || s.includes('waiting')) return 'On Hold';
    if (s.includes('unresolved') || s.includes('unresolve')) return 'Unresolved';
    if (s.includes('in process') || s.includes('processing') || s.includes('process')) return 'In Process';

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

    // Explicitly excluded from Dashboard per 9.2.9 discussion:
    // With Accounts, Under Review, CEO Approval and other completed/approval queues.
    if (!raw) return type === 'job_entry' ? 'New Entry' : 'Pending';
    if (WD_COMPLETED_STATUSES.has(raw)) return '';
    if (raw.includes('with accounts')) return '';
    if (raw.includes('under review')) return '';
    if (raw.includes('ceo')) return '';
    if (raw.includes('approval') || raw === 'approved' || raw.includes('approved')) return '';
    if (raw.includes('srv done') || raw.includes('marked srv done') || raw.includes('completed srv')) return '';
    if (raw.includes('original po') || raw.includes('epicore')) return '';
    // Waiting-style notes are still open work and should stay visible as On Hold.
    if (raw.includes('waiting')) return 'On Hold';

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
    if (!s) return 'New Entry';
    if (s.includes('srv')) return 'For SRV';
    if (s.includes('new entry') || s === 'pending' || s === 'new') return 'New Entry';
    if (s.includes('hold') || s.includes('waiting')) return 'On Hold';
    if (s.includes('unresolved') || s.includes('unresolve')) return 'Unresolved';
    if (s.includes('in process') || s.includes('processing') || s.includes('process')) return 'In Process';
    if (s.includes('ipc')) return 'IPC';
    if (s.includes('report')) return 'Report';
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
    // 9.3.2: Dashboard wide-access should recognize both Role and Position
    // because some accounts store "Super Admin" / "Admin" in Position instead of Role.
    const accessText = wdNormalize([
        currentApprover?.Role,
        currentApprover?.role,
        currentApprover?.AccountRole,
        currentApprover?.accountRole,
        currentApprover?.Position,
        currentApprover?.position,
        currentApprover?.Access,
        currentApprover?.access
    ].filter(Boolean).join(' '));
    return accessText.includes('admin') || accessText.includes('super');
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
    if (raw.includes('paid') || raw.includes('closed') || raw.includes('cancel')) return true;
    return false;
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

function wdEntryTimestamp(entry) {
    const candidates = [
        entry?.invoiceLastUpdated,
        entry?.lastUpdated,
        entry?.updatedAt,
        entry?.timestamp,
        entry?.dateCreated,
        entry?.date,
        entry?.invoiceDate,
        entry?.releaseDate
    ];
    for (const c of candidates) {
        if (!c) continue;
        const n = Number(c);
        if (!Number.isNaN(n) && n > 0) return n;
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
    return entryFor === 'invoice' || entryFor === 'ipc';
}

function wdBuildIPCMap() {
    const ipcMap = new Map();
    const entries = wdGetDashboardJobEntriesList();

    entries.forEach(entry => {
        if (!entry || wdNormalize(entry.for) !== 'ipc') return;
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

    // Dashboard source must mirror WorkDesk Active Task, but only invoice-related items.
    if (['Transfer', 'Restock', 'Return', 'Usage'].includes(taskFor) || source === 'transfer_entry') return false;

    // IPC is intentionally added from Job Records only, so Active Task "For IPC" / IPC rows
    // do not create a second wrong card/count.
    if (taskFor === 'IPC' || source === 'ipc_job' || statusNorm.includes('ipc')) return false;

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
    if ((task.for === 'Invoice' || task.source === 'job_entry') && wdIsNewEntryStatus(status)) status = 'New Entry';

    const isJobEntry = task.source === 'job_entry';
    const type = isJobEntry ? 'Invoice Job' : 'Invoice';
    const bucket = wdDashboardAllowedBucket(status, isJobEntry ? 'job_entry' : type) || wdDashboardBucket(status, type);
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
        status,
        bucket,
        note: wdText(task.note || invMeta.note || ''),
        attention: task.attention || invMeta.attention || '',
        enteredBy: task.enteredBy || invMeta.enteredBy || invMeta.updatedBy || '',
        ipc: wdFormatIPCText(ipcInfo),
        ipcActive: !!ipcInfo,
        invName: task.invName || invMeta.invName || '',
        reportName: task.reportName || invMeta.reportName || '',
        amount: task.amountPaid || task.amount || invMeta.amountPaid || invMeta.invValue || '',
        date: task.date || invMeta.invoiceDate || invMeta.releaseDate || '',
        timestamp: Number(task.invoiceLastUpdated || task.timestamp || wdEntryTimestamp(invMeta) || 0)
    };
}


async function wdNormalizePersonalTaskForDashboard(task) {
    const normalized = await wdNormalizeActiveTaskForDashboard(task, new Map());
    const status = wdStatus(task.remarks || task.status || normalized.status || 'Pending');
    const personalBucket = wdDashboardPersonalBucket(status, task.source || task.type || task.for || normalized.source || normalized.type);
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
        return (b.timestamp || 0) - (a.timestamp || 0);
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


async function wdBuildIPCJobRecordTasks(ipcMap) {
    const tasks = [];
    const entries = wdGetDashboardJobEntriesList();

    for (const [rowIndex, entry] of entries.entries()) {
        if (!entry || wdNormalize(entry.for) !== 'ipc') continue;

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

        tasks.push({
            id: `ipc_${jobKey || po || entry.ref || Math.random()}`,
            key: entry.key || '',
            source: 'ipc_job_record',
            type: 'IPC',
            po,
            ref: wdText(entry.ref || entry.ipcNo || ''),
            vendorName: wdText(entry.vendorName || entry.vendor || entry.Supplier || wdGetPOValue(poDetails, ['Supplier Name', 'Supplier Name:', 'Supplier'], ''), 'N/A'),
            site,
            status: 'IPC',
            bucket: 'IPC',
            note: wdText(entry.note || entry.details || entry.description || ''),
            ipc: wdText(status, 'IPC Ready'),
            ipcActive: true,
            attention: entry.attention || '',
            enteredBy: entry.enteredBy || entry.updatedBy || '',
            invName: entry.invName || '',
            reportName: entry.reportName || '',
            amount: entry.amount || entry.invoiceValue || '',
            date: entry.invoiceDate || entry.date || '',
            timestamp: wdEntryTimestamp(entry) || (ipcInfo ? ipcInfo.latestTimestamp : 0)
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

            const status = wdInvoiceRecordStatus(inv);
            const bucket = wdDashboardAllowedBucket(status, 'invoice_record');
            if (!bucket) continue;

            const site = wdResolveInvoiceSite(inv, poDetails);
            if (!wdSiteMatchesCurrentUser(site)) continue;

            const ref = wdText(inv.invNumber || inv.invoiceNo || inv.ref || inv.invoiceNumber || invoiceKey);
            const invEntryID = wdText(inv.invEntryID || inv.entryId || inv.entryID || '');
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
                group: 'N/A',
                attention: inv.attention || inv.Attention || inv.assignedTo || inv.assigned_to || '',
                enteredBy: inv.enteredBy || inv.updatedBy || inv.createdBy || '',
                date: inv.invoiceDate || inv.invDate || inv.releaseDate || inv.date || '',
                remarks: status,
                status,
                bucket,
                invName: inv.invName || inv.invoiceName || '',
                reportName: inv.reportName || '',
                vendorName: wdResolveInvoiceVendor(inv, poDetails),
                note: inv.note || inv.details || inv.description || '',
                timestamp: Number(inv.invoiceLastUpdated || inv.lastUpdated || inv.updatedAt || inv.enteredAt || 0) || wdEntryTimestamp(inv),
                isUrgent: false
            });
        }
    }

    return source;
}

async function wdBuildInvoiceTaskLookupOverviewTasks(forceRefresh = false) {
    // 9.3.7: All Active Tasks should use the same active task lookup source that
    // feeds the work queues, not the full historical invoice records. This prevents
    // stale invoice statuses from inflating cards such as For SRV.
    const resultByInvoiceKey = new Map(); // key = PO + invoice task key (invoice key can repeat across POs)
    if (typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return [];

    try {
        const snapshot = await invoiceDb.ref('invoice_tasks_by_user').once('value');
        if (!snapshot.exists()) return [];
        const nodes = snapshot.val() || {};
        const ownerKeys = Object.keys(nodes).sort((a, b) => {
            const aa = wdNormalize(a) === 'all' ? 1 : 0;
            const bb = wdNormalize(b) === 'all' ? 1 : 0;
            if (aa !== bb) return aa - bb; // person inboxes before All inbox
            return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        });

        for (const ownerKey of ownerKeys) {
            const inbox = nodes[ownerKey] || {};
            if (!inbox || typeof inbox !== 'object') continue;
            const ownerIsAll = wdNormalize(ownerKey) === 'all';
            const ownerIsCurrentUser = wdDashboardOwnerKeyMatchesCurrentUser(ownerKey);

            for (const invoiceKey in inbox) {
                const task = inbox[invoiceKey] || {};
                if (!task || typeof task !== 'object') continue;

                const status = wdStatus(task.status || task.remarks || 'Pending');
                if (wdIsInvoiceLookupComplete(status)) continue;

                // If the full invoice record is already completed, ignore stale lookup rows.
                const latestInv = (allInvoiceData && task.po && allInvoiceData[task.po] && allInvoiceData[task.po][invoiceKey])
                    ? allInvoiceData[task.po][invoiceKey]
                    : null;
                if (latestInv) {
                    const latestStatus = wdStatus(latestInv.status || latestInv.remarks || '');
                    if (wdIsInvoiceLookupComplete(latestStatus)) continue;
                }

                const bucket = wdDashboardAllowedBucket(status, 'invoice_task_lookup');
                if (!bucket) continue;

                const attention = wdDashboardTaskOwnerAttention(ownerKey, task);
                // All Active excludes the current user's personal tasks. The caller
                // also checks against wdPersonalDashboardTasks, but doing it here keeps
                // counts from bloating before dedupe.
                if (ownerIsCurrentUser || wdTaskHasAttentionName({ attention }, wdCurrentUserNameNorm())) continue;

                const po = wdText(task.po || task.originalPO || '');
                const lookupTaskKey = `${po}||${invoiceKey}`;
                const poDetails = await wdGetPODetails(po);
                const site = wdText(
                    task.site || task.Site || wdGetPOValue(poDetails, ['Project ID', 'Project ID:', 'Site'], ''),
                    'N/A'
                );
                if (!wdSiteMatchesCurrentUser(site)) continue;

                const vendorName = wdText(
                    task.vendorName || task.vendor || wdGetPOValue(poDetails, ['Supplier Name', 'Supplier Name:', 'Supplier', 'Supplier:', 'Vendor Name'], ''),
                    'N/A'
                );
                const latestMeta = latestInv || {};
                const existing = resultByInvoiceKey.get(lookupTaskKey);
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
                    amount: task.amount || latestMeta.invValue || latestMeta.amount || '',
                    amountPaid: task.amountPaid || task.amount || latestMeta.amountPaid || latestMeta.invValue || latestMeta.amount || '',
                    site,
                    group: 'N/A',
                    attention,
                    enteredBy: task.enteredBy || latestMeta.enteredBy || latestMeta.updatedBy || '',
                    date: task.date || latestMeta.invoiceDate || latestMeta.releaseDate || '',
                    remarks: status,
                    status: bucket,
                    bucket,
                    invName: task.invName || latestMeta.invName || '',
                    reportName: task.reportName || latestMeta.reportName || '',
                    vendorName,
                    note: task.note || latestMeta.note || '',
                    timestamp: Number(task.timestamp || task.invoiceLastUpdated || latestMeta.lastUpdated || latestMeta.updatedAt || latestMeta.enteredAt || 0),
                    isUrgent: false
                };

                // Prefer a direct person's inbox over the broad All inbox when both exist.
                if (!existing || (wdNormalize(existing.ownerKey) === 'all' && !ownerIsAll)) {
                    resultByInvoiceKey.set(lookupTaskKey, normalized);
                }
            }
        }
    } catch (e) {
        console.warn('WorkDesk dashboard could not read invoice task lookup:', e);
    }

    return Array.from(resultByInvoiceKey.values());
}

async function wdBuildDashboardOverviewSourceTasks(forceRefresh = false) {
    const source = [];

    // 9.3.7: Dashboard status counts must match Invoice Management / Invoice Records.
    // Do not count Invoice Job Records for For SRV/On Hold/Report/In Process/etc.
    // Those Job Record rows are historical workflow echoes and can inflate the cards.
    // All Active invoice-status buckets are built from Firebase invoice_entries
    // via allInvoiceData. IPC remains the only dashboard bucket rebuilt from Job Records.
    try { await wdEnsureDashboardJobEntriesFetched(forceRefresh); }
    catch (e) { console.warn('WorkDesk dashboard could not refresh Job Records:', e); }
    if (typeof ensureApproverDataCached === 'function') {
        try { await ensureApproverDataCached(forceRefresh); }
        catch (e) { console.warn('WorkDesk dashboard could not refresh approver data:', e); }
    }
    if (typeof ensureInvoiceDataFetched === 'function') {
        try { await ensureInvoiceDataFetched(forceRefresh); }
        catch (e) { console.warn('WorkDesk dashboard could not refresh Invoice Records:', e); }
    }

    const invoiceRecordTasks = await wdBuildInvoiceRecordOverviewTasks(forceRefresh);
    source.push(...invoiceRecordTasks);

    return source;
}

async function wdBuildDashboardTasks(options = {}) {
    const tasks = [];
    const forceRefresh = !!options.forceRefresh;

    // 9.4.8: Build My Personal Tasks first. Normal/User accounts stop here so
    // the dashboard does not read global invoice_entries/job_entries/transfer_entries.
    const exactMyActiveTasks = await wdGetExactMyActiveTaskList(forceRefresh);
    wdPersonalDashboardTasks = await wdBuildPersonalDashboardTasks(exactMyActiveTasks);

    // 9.3.3/9.4.8: Normal User role accounts should not receive the wider All Active dashboard.
    // They only see their own Personal Tasks and now avoid the expensive All Active overview reads.
    if (!wdCanSeeAllActiveDashboard()) {
        return [];
    }

    const activeSource = await wdBuildDashboardOverviewSourceTasks(forceRefresh);
    const personalKeySet = wdBuildPersonalTaskKeySet();
    const ipcMap = wdBuildIPCMap();
    const activeSourceTasks = activeSource.filter(wdIsDashboardActiveTaskSourceItem);

    for (const task of activeSourceTasks) {
        const normalized = await wdNormalizeActiveTaskForDashboard(task, ipcMap);
        if (wdDashboardTaskIsAlreadyPersonal(normalized, personalKeySet)) continue;
        tasks.push(normalized);
    }

    // IPC stays as a separate Job Records list so supplier follow-up remains visible.
    const ipcJobRecordTasks = await wdBuildIPCJobRecordTasks(ipcMap);
    ipcJobRecordTasks.forEach(task => {
        if (!wdDashboardTaskIsAlreadyPersonal(task, personalKeySet)) tasks.push(task);
    });

    const seen = new Set();
    const unique = [];
    for (const task of tasks) {
        const key = wdDashboardDedupeKey(task);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(task);
    }

    return unique.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
async function populateWorkdeskDashboard(forceRefresh = false) {
    const cardsEl = document.getElementById('wd-active-dashboard-cards');
    const listEl = document.getElementById('wd-active-dashboard-list');
    const titleEl = document.getElementById('wd-active-dashboard-title');
    const summaryEl = document.getElementById('wd-active-dashboard-summary');

    if (!cardsEl || !listEl) return;

    cardsEl.innerHTML = `
        <div class="wd-dashboard-loading-card">
            <i class="fa-solid fa-spinner fa-spin"></i>
            Loading open tasks...
        </div>`;
    listEl.innerHTML = '<div class="wd-dashboard-empty-state">Loading task cards...</div>';
    if (titleEl) titleEl.textContent = 'Select a status card';
    if (summaryEl) summaryEl.textContent = wdCanSeeAllActiveDashboard()
        ? 'Cards are loaded. Click a status card to review the list.'
        : 'Cards are loaded. Click a My Personal Task card to review the list.';

    try {
        if (!forceRefresh) {
            const cached = wdLoadDashboardCache();
            if (cached) {
                wdActiveDashboardTasks = cached.tasks;
                wdPersonalDashboardTasks = Array.isArray(cached.personalTasks) ? cached.personalTasks : [];
                wdActiveDashboardCacheMeta = { fromCache: true, savedAt: cached.savedAt || Date.now() };

                // 9.4.8: Never auto-open the table after loading cache.
                wdActiveDashboardSelectedStatus = WD_DASHBOARD_NONE;

                wdRenderDashboardCards();
                wdRenderDashboardList();
                wdBindDashboardControls();
                return;
            }
        }

        wdActiveDashboardTasks = await wdBuildDashboardTasks({ forceRefresh });
        wdActiveDashboardCacheMeta = { fromCache: false, savedAt: Date.now() };
        wdSaveDashboardCache(wdActiveDashboardTasks, wdPersonalDashboardTasks);

        // 9.4.8: Do not auto-open any list after loading. User clicks a card first.
        wdActiveDashboardSelectedStatus = WD_DASHBOARD_NONE;

        wdRenderDashboardCards();
        wdRenderDashboardList();
        wdBindDashboardControls();
    } catch (error) {
        console.error('Error loading WorkDesk dashboard control center:', error);
        cardsEl.innerHTML = '<div class="wd-dashboard-error-card"><i class="fa-solid fa-triangle-exclamation"></i> Unable to load dashboard tasks.</div>';
        listEl.innerHTML = '<div class="wd-dashboard-empty-state">Please refresh or check the console error.</div>';
    }
}

function wdBindDashboardControls() {
    const cardsEl = document.getElementById('wd-active-dashboard-cards');
    const refreshBtn = document.getElementById('wd-active-dashboard-refresh');
    const searchInput = document.getElementById('wd-active-dashboard-search');

    if (cardsEl && !cardsEl.dataset.bound) {
        cardsEl.dataset.bound = 'true';
        cardsEl.addEventListener('click', (e) => {
            const card = e.target.closest('.wd-active-status-card');
            if (!card) return;
            wdActiveDashboardSelectedStatus = card.dataset.status || WD_DASHBOARD_ALL;
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
        searchInput.addEventListener('input', () => wdRenderDashboardList());
    }
}

function wdRenderDashboardCards() {
    const cardsEl = document.getElementById('wd-active-dashboard-cards');
    if (!cardsEl) return;

    const canSeeAllActive = wdCanSeeAllActiveDashboard();
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

        statuses.forEach(status => {
            const count = statusCounts.get(status) || 0;
            const tone = wdStatusTone(status);
            const filterKey = wdDashboardStatusFilterKey(status);
            const active = filterKey === wdActiveDashboardSelectedStatus || status === wdActiveDashboardSelectedStatus ? 'active' : '';
            activeHtml += `
                <button class="wd-active-status-card tone-${tone} ${active}" data-status="${wdSafe(filterKey)}" type="button" aria-label="Show ${wdSafe(status)} tasks">
                    <span class="wd-status-card-glow"></span>
                    <span class="wd-status-icon"><i class="fa-solid ${wdStatusIcon(status)}"></i></span>
                    <span class="wd-status-meta">
                        <strong>${count}</strong>
                        <em>${wdSafe(status)}</em>
                        <small>${wdSafe(wdStatusMicrocopy(status, count))}</small>
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

    // 9.4.7: Normal/User accounts must also respect the clicked My Personal
    // status card. Previously non-admin users were always forced back to the
    // whole personal queue, so cards such as My For SRV or My On Hold changed
    // the active card but not the list below.
    let tasks = canSeeAllActive ? wdActiveDashboardTasks.slice() : wdPersonalDashboardTasks.slice();
    const selected = wdActiveDashboardSelectedStatus || WD_DASHBOARD_NONE;

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

    if (search) {
        tasks = tasks.filter(task => {
            const haystack = [
                task.po,
                task.ref,
                task.vendorName,
                task.site,
                task.status,
                task.bucket,
                task.personalBucket,
                task.attention,
                task.note,
                task.ipc,
                task.type,
                task.amount
            ].join(' ').toLowerCase();
            return haystack.includes(search);
        });
    }

    return tasks;
}

function wdRenderDashboardList() {
    const listEl = document.getElementById('wd-active-dashboard-list');
    const titleEl = document.getElementById('wd-active-dashboard-title');
    const summaryEl = document.getElementById('wd-active-dashboard-summary');
    if (!listEl) return;

    const selected = wdActiveDashboardSelectedStatus || WD_DASHBOARD_NONE;
    const tasks = wdGetFilteredDashboardTasks();
    const selectedLabel = selected === WD_DASHBOARD_NONE
        ? 'Select a status card'
        : ((wdActiveDashboardSelectedStatus || '').startsWith(WD_DASHBOARD_MY_STATUS_PREFIX)
            ? wdDashboardSelectedLabel()
            : (wdCanSeeAllActiveDashboard() ? wdDashboardSelectedLabel() : 'My Personal Tasks'));

    if (titleEl) titleEl.textContent = selectedLabel;
    if (summaryEl) {
        const cacheSuffix = wdActiveDashboardCacheMeta && wdActiveDashboardCacheMeta.fromCache
            ? ` · browser cache ${wdCacheAgeText(wdActiveDashboardCacheMeta.savedAt)}`
            : '';
        summaryEl.textContent = selected === WD_DASHBOARD_NONE
            ? (wdCanSeeAllActiveDashboard()
                ? `Click any All Active or My Personal status card to review its list${cacheSuffix}`
                : `Click a My Personal Task status card to review its list${cacheSuffix}`)
            : (wdCanSeeAllActiveDashboard()
                ? `${tasks.length} active task${tasks.length === 1 ? '' : 's'} shown · active-status dashboard only · ${wdAccessLabel()}${cacheSuffix}`
                : `${tasks.length} personal task${tasks.length === 1 ? '' : 's'} shown · tasks addressed to your name only${cacheSuffix}`);
    }

    if (selected === WD_DASHBOARD_NONE) {
        listEl.innerHTML = `
            <div class="wd-dashboard-empty-state">
                <span class="wd-empty-icon"><i class="fa-solid fa-hand-pointer"></i></span>
                <div>
                    <strong>No list loaded yet</strong>
                    <p>${wdCanSeeAllActiveDashboard()
                        ? 'Select one status card above to load only that review list.'
                        : 'Select one My Personal Task card above to load only that personal list.'}</p>
                </div>
            </div>`;
        return;
    }

    if (!wdActiveDashboardTasks.length && !wdPersonalDashboardTasks.length) {
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

    if (!tasks.length) {
        listEl.innerHTML = `
            <div class="wd-dashboard-empty-state">
                <span class="wd-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
                <div>
                    <strong>No matching task</strong>
                    <p>Try another person, status card, or search by PO, vendor, site, attention, note, or status.</p>
                </div>
            </div>`;
        return;
    }

    const cards = tasks.map((task, index) => {
        const statusTone = wdStatusTone(task.bucket || task.status);
        const note = task.note ? wdSafe(task.note) : '<span class="wd-muted">No note added</span>';
        const ipcClass = task.ipcActive ? 'wd-ipc-active' : 'wd-ipc-empty';
        const invoicePdf = wdBuildPdfButton('Invoice PDF', PDF_BASE_PATH, task.invName, 'invoice');
        const reportPdf = wdBuildPdfButton('Report PDF', REPORT_BASE_PATH, task.reportName, 'report');
        const poDisplay = task.po || task.ref || 'N/A';
        const dateText = wdFormatDashboardDate(task.date);
        const amountText = wdText(task.amount);
        const metaPieces = [];
        if (dateText) metaPieces.push(`<span><i class="fa-regular fa-calendar"></i> ${wdSafe(dateText)}</span>`);
        if (amountText) metaPieces.push(`<span><i class="fa-solid fa-coins"></i> ${wdSafe(amountText)}</span>`);
        if (task.attention) metaPieces.push(`<span><i class="fa-solid fa-user-check"></i> ${wdSafe(task.attention)}</span>`);
        metaPieces.push(`<span><i class="fa-solid fa-tag"></i> ${wdSafe(task.type || 'Invoice')}</span>`);

        return `
            <article class="wd-task-card tone-${statusTone}" style="--wd-delay:${Math.min(index, 12) * 22}ms">
                <div class="wd-task-accent"></div>
                <div class="wd-task-main">
                    <div class="wd-task-topline">
                        <div class="wd-task-identity">
                            <span class="wd-task-kicker">PO Number</span>
                            <h3>${wdSafe(poDisplay)}</h3>
                            ${task.ref && task.ref !== task.po ? `<p class="wd-task-subref">Invoice ref: ${wdSafe(task.ref)}</p>` : ''}
                        </div>
                        <div class="wd-task-status-block">
                            <span class="wd-status-pill tone-${statusTone}"><i class="fa-solid ${wdStatusIcon(task.status)}"></i> ${wdSafe(task.status || 'Pending')}</span>
                            <span class="wd-site-pill"><i class="fa-solid fa-location-dot"></i> ${wdSafe(task.site || 'N/A')}</span>
                        </div>
                    </div>

                    <div class="wd-task-vendor-line">
                        <i class="fa-regular fa-building"></i>
                        <span>${wdSafe(task.vendorName || 'N/A')}</span>
                    </div>

                    <div class="wd-task-meta-grid">
                        <div class="wd-task-meta-box">
                            <label>Note</label>
                            <div class="wd-task-note-text">${note}</div>
                        </div>
                        <div class="wd-task-meta-box compact wd-task-ipc-box">
                            <label>IPC Status</label>
                            <span class="${ipcClass}">${wdSafe(task.ipc || 'No IPC')}</span>
                        </div>
                    </div>

                    <div class="wd-task-footline">
                        ${metaPieces.join('')}
                    </div>
                </div>
                <aside class="wd-task-side">
                    ${wdDocButtonZone(invoicePdf, reportPdf)}
                </aside>
            </article>`;
    }).join('');

    listEl.innerHTML = `
        <div class="wd-task-board">
            <div class="wd-task-board-head">
                <div>
                    <span class="wd-board-label">Current queue</span>
                    <strong>${tasks.length}</strong>
                    <span>${tasks.length === 1 ? 'entry needs attention' : 'entries need attention'}</span>
                </div>
                <div class="wd-board-access-pill"><i class="fa-solid fa-eye"></i> ${wdSafe(wdAccessLabel())}</div>
            </div>
            <div class="wd-task-card-list">${cards}</div>
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
