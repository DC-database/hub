/* ==========================================================================
   js/app-workdesk-dashboard.js
   IBA WorkDesk Dashboard Active Task Control Center
   Version: 8.5.2

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
   ========================================================================== */

// =================================================================================================
// #region BLOCK 12 — WORKDESK DASHBOARD CONTROL CENTER + REPORTS
// Purpose: WorkDesk dashboard counts/list for incomplete invoice tasks + clean Job Records CSV export.
// =================================================================================================

let wdActiveDashboardTasks = [];
let wdActiveDashboardSelectedStatus = '__ALL__';
let wdActiveDashboardCacheMeta = { fromCache: false, savedAt: 0 };

// 8.5.1: Keep the WorkDesk Dashboard self-sufficient for short periods.
// It prevents repeated Firebase downloads when users switch pages or reopen the dashboard.
// Manual Refresh still bypasses this cache and gets fresh live data.
const WD_DASHBOARD_CACHE_KEY = 'IBA_WD_ACTIVE_DASHBOARD_CACHE_V1';
const WD_ACTIVE_TASK_SOURCE_CACHE_KEY = 'IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V1';
const WD_DASHBOARD_CACHE_TTL = 10 * 60 * 1000; // 10 minutes: efficient but still reasonably fresh.

const WD_DASHBOARD_ALL = '__ALL__';
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
    'Pending',
    'Under Review',
    'On Hold',
    'Original PO',
    'Epicore Value',
    'For SRV',
    'SRV Done',
    'For Approval',
    'Approved',
    'IPC',
    'Report',
    'Report Approved',
    'Waiting Signature',
    'Waiting Approval'
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

function wdLoadDashboardCache() {
    const cached = wdReadJSONStorage(window.localStorage, WD_DASHBOARD_CACHE_KEY);
    if (!cached || !Array.isArray(cached.tasks)) return null;
    if (cached.userKey !== wdDashboardUserCacheKey()) return null;
    if ((Date.now() - Number(cached.savedAt || 0)) > WD_DASHBOARD_CACHE_TTL) return null;
    return cached;
}

function wdSaveDashboardCache(tasks) {
    if (!Array.isArray(tasks)) return;
    wdWriteJSONStorage(window.localStorage, WD_DASHBOARD_CACHE_KEY, {
        userKey: wdDashboardUserCacheKey(),
        savedAt: Date.now(),
        tasks
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
}
window.wdClearWorkdeskDashboardCache = wdClearWorkdeskDashboardCache;

function wdLoadActiveTaskSourceSnapshot() {
    const cached = wdReadJSONStorage(window.sessionStorage, WD_ACTIVE_TASK_SOURCE_CACHE_KEY);
    if (!cached || !Array.isArray(cached.tasks)) return [];
    if (cached.userKey !== wdDashboardUserCacheKey()) return [];
    if ((Date.now() - Number(cached.savedAt || 0)) > WD_DASHBOARD_CACHE_TTL) return [];
    return cached.tasks;
}

function wdStatus(value, fallback = 'Pending') {
    return wdText(value, fallback);
}

function wdIsNewEntryStatus(status) {
    const s = wdNormalize(status);
    return !s || s === 'pending' || s === 'new' || s === 'new entry' || s.includes('new entry');
}

function wdDashboardBucket(status, type = '') {
    const typeText = wdNormalize(type);
    const s = wdNormalize(status);

    // 8.3.9: IPC must be one clean dashboard group coming from IPC job records,
    // not a confusing separate "For IPC" card.
    if (typeText === 'ipc' || s.includes('ipc')) return 'IPC';

    // New Entry should be the WorkDesk Active Task / Job Records entry, not every
    // invoice record that happens to have a generic Pending status.
    if ((typeText.includes('job') || typeText === 'invoice job') && wdIsNewEntryStatus(status)) return 'New Entry';
    if (wdIsNewEntryStatus(status)) return 'Pending';

    return wdStatus(status, 'Pending');
}

function wdIsCompletedStatus(status) {
    return WD_COMPLETED_STATUSES.has(wdNormalize(status));
}

function wdIsDashboardOpenStatus(status) {
    const normalized = wdNormalize(status);
    if (!normalized) return true;
    return !WD_COMPLETED_STATUSES.has(normalized);
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
    // 8.3.7: Dashboard visibility is based on account Role, not Position label.
    // Any Admin/Super Admin role sees all sites. User/non-admin accounts are site-limited.
    const roleText = wdNormalize(
        currentApprover?.Role ||
        currentApprover?.role ||
        currentApprover?.AccountRole ||
        currentApprover?.accountRole ||
        ''
    );
    return roleText.includes('admin');
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
    if (!wdIsDashboardOpenStatus(status)) return false;

    // The new dashboard is for invoice-related WorkDesk follow-up only.
    return entry.for === 'Invoice' || entry.for === 'IPC';
}

function wdBuildIPCMap() {
    const ipcMap = new Map();
    const entries = Array.isArray(allSystemEntries) ? allSystemEntries : [];

    entries.forEach(entry => {
        if (!entry || entry.for !== 'IPC') return;
        const status = wdEntryStatus(entry);
        if (!wdIsDashboardOpenStatus(status)) return;

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

    const isInvoiceRelated = taskFor === 'Invoice' || source === 'invoice' || source === 'job_entry';
    if (!isInvoiceRelated) return false;

    if (!wdIsDashboardOpenStatus(status)) return false;
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
        bucket: isJobEntry && wdIsNewEntryStatus(status) ? 'New Entry' : wdDashboardBucket(status, type),
        note: wdText(task.note || invMeta.note || ''),
        ipc: wdFormatIPCText(ipcInfo),
        ipcActive: !!ipcInfo,
        invName: task.invName || invMeta.invName || '',
        reportName: task.reportName || invMeta.reportName || '',
        amount: task.amountPaid || task.amount || invMeta.amountPaid || invMeta.invValue || '',
        date: task.date || invMeta.invoiceDate || invMeta.releaseDate || '',
        timestamp: Number(task.invoiceLastUpdated || task.timestamp || wdEntryTimestamp(invMeta) || 0)
    };
}

function wdDashboardDedupeKey(task) {
    const source = wdText(task?.source || '');
    const po = wdText(task?.po || task?.originalPO || '');
    const ref = wdText(task?.ref || task?.originalKey || task?.key || '');
    const type = wdText(task?.type || '');
    return `${source}|${type}|${po}|${ref}`;
}

async function wdBuildIPCJobRecordTasks(ipcMap) {
    const tasks = [];
    const entries = Array.isArray(allSystemEntries) ? allSystemEntries : [];

    for (const entry of entries) {
        if (!entry || entry.for !== 'IPC') continue;

        // IPC is a special supplier-follow-up list from Job Records. Do not require it
        // to be in My Active Task; only hide truly completed/closed records.
        const status = wdEntryStatus(entry);
        if (!wdIsDashboardOpenStatus(status)) continue;

        const po = wdText(entry.po || entry.originalPO || entry.ref || '');
        const poDetails = await wdGetPODetails(po);
        const site = wdText(entry.site || entry.Site || wdGetPOValue(poDetails, ['Project ID', 'Project ID:', 'Site'], ''), 'N/A');
        if (!wdSiteMatchesCurrentUser(site)) continue;

        const jobKey = wdText(entry.key || entry.id || `${po}_${entry.ref || ''}_${entry.date || entry.timestamp || ''}`);
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
            invName: entry.invName || '',
            reportName: entry.reportName || '',
            amount: entry.amount || entry.invoiceValue || '',
            date: entry.invoiceDate || entry.date || '',
            timestamp: wdEntryTimestamp(entry) || (ipcInfo ? ipcInfo.latestTimestamp : 0)
        });
    }

    return tasks;
}

async function wdBuildDashboardTasks(options = {}) {
    const tasks = [];
    const forceRefresh = !!options.forceRefresh;

    // 8.4.11 efficient path:
    // Use the same Active Task source, but only fetch from Firebase when there is no usable
    // in-memory/session source or when the user manually presses Refresh.
    let activeSource = forceRefresh ? [] : wdGetActiveTaskSourceList();

    if ((!activeSource.length || forceRefresh) && typeof populateActiveTasks === 'function') {
        const previousFilter = (typeof currentActiveTaskFilter !== 'undefined') ? currentActiveTaskFilter : null;
        await populateActiveTasks(forceRefresh);
        if (previousFilter !== null && typeof currentActiveTaskFilter !== 'undefined') {
            currentActiveTaskFilter = previousFilter;
        }
        activeSource = wdGetActiveTaskSourceList();
    }

    const ipcMap = wdBuildIPCMap();
    const activeSourceTasks = activeSource.filter(wdIsDashboardActiveTaskSourceItem);

    for (const task of activeSourceTasks) {
        tasks.push(await wdNormalizeActiveTaskForDashboard(task, ipcMap));
    }

    // IPC is the only extra list added from Job Records, as requested.
    const ipcJobRecordTasks = await wdBuildIPCJobRecordTasks(ipcMap);
    tasks.push(...ipcJobRecordTasks);

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
    listEl.innerHTML = '<div class="wd-dashboard-empty-state">Loading task list...</div>';
    if (titleEl) titleEl.textContent = 'All Open Tasks';
    if (summaryEl) summaryEl.textContent = 'Only incomplete invoice-related entries are shown.';

    try {
        if (!forceRefresh) {
            const cached = wdLoadDashboardCache();
            if (cached) {
                wdActiveDashboardTasks = cached.tasks;
                wdActiveDashboardCacheMeta = { fromCache: true, savedAt: cached.savedAt || Date.now() };

                if (wdActiveDashboardSelectedStatus !== WD_DASHBOARD_ALL) {
                    const stillExists = wdActiveDashboardTasks.some(t => (t.bucket || wdDashboardBucket(t.status, t.type)) === wdActiveDashboardSelectedStatus);
                    if (!stillExists) wdActiveDashboardSelectedStatus = WD_DASHBOARD_ALL;
                }

                wdRenderDashboardCards();
                wdRenderDashboardList();
                wdBindDashboardControls();
                return;
            }
        }

        wdActiveDashboardTasks = await wdBuildDashboardTasks({ forceRefresh });
        wdActiveDashboardCacheMeta = { fromCache: false, savedAt: Date.now() };
        wdSaveDashboardCache(wdActiveDashboardTasks);

        // Reset selected status if that status no longer exists.
        if (wdActiveDashboardSelectedStatus !== WD_DASHBOARD_ALL) {
            const stillExists = wdActiveDashboardTasks.some(t => (t.bucket || wdDashboardBucket(t.status, t.type)) === wdActiveDashboardSelectedStatus);
            if (!stillExists) wdActiveDashboardSelectedStatus = WD_DASHBOARD_ALL;
        }

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

    const counts = new Map();
    wdActiveDashboardTasks.forEach(task => {
        const bucket = task.bucket || wdDashboardBucket(task.status, task.type);
        counts.set(bucket, (counts.get(bucket) || 0) + 1);
    });

    const statuses = wdSortStatuses(Array.from(counts.keys()));
    const allActive = wdActiveDashboardSelectedStatus === WD_DASHBOARD_ALL ? 'active' : '';
    let html = `
        <button class="wd-active-status-card all-card ${allActive}" data-status="${WD_DASHBOARD_ALL}" type="button" aria-label="Show all open invoice tasks">
            <span class="wd-status-card-glow"></span>
            <span class="wd-status-icon"><i class="fa-solid fa-layer-group"></i></span>
            <span class="wd-status-meta">
                <strong>${wdActiveDashboardTasks.length}</strong>
                <em>All Open</em>
                <small>${wdActiveDashboardTasks.length === 1 ? 'Incomplete entry' : 'Incomplete entries'}</small>
            </span>
            <span class="wd-status-arrow"><i class="fa-solid fa-arrow-right"></i></span>
        </button>`;

    if (!statuses.length) {
        cardsEl.innerHTML = html;
        return;
    }

    statuses.forEach(status => {
        const count = counts.get(status) || 0;
        const tone = wdStatusTone(status);
        const active = status === wdActiveDashboardSelectedStatus ? 'active' : '';
        html += `
        <button class="wd-active-status-card tone-${tone} ${active}" data-status="${wdSafe(status)}" type="button" aria-label="Show ${wdSafe(status)} tasks">
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

    cardsEl.innerHTML = html;
}

function wdGetFilteredDashboardTasks() {
    const searchInput = document.getElementById('wd-active-dashboard-search');
    const search = wdNormalize(searchInput?.value || '');

    let tasks = wdActiveDashboardTasks.slice();
    if (wdActiveDashboardSelectedStatus !== WD_DASHBOARD_ALL) {
        tasks = tasks.filter(task => (task.bucket || wdDashboardBucket(task.status, task.type)) === wdActiveDashboardSelectedStatus);
    }

    if (search) {
        tasks = tasks.filter(task => {
            const haystack = [
                task.po,
                task.ref,
                task.vendorName,
                task.site,
                task.status,
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

    const tasks = wdGetFilteredDashboardTasks();
    const selectedLabel = wdActiveDashboardSelectedStatus === WD_DASHBOARD_ALL ? 'All Open Tasks' : wdActiveDashboardSelectedStatus;

    if (titleEl) titleEl.textContent = selectedLabel;
    if (summaryEl) {
        const cacheSuffix = wdActiveDashboardCacheMeta && wdActiveDashboardCacheMeta.fromCache
            ? ` · browser cache ${wdCacheAgeText(wdActiveDashboardCacheMeta.savedAt)}`
            : '';
        summaryEl.textContent = `${tasks.length} incomplete entr${tasks.length === 1 ? 'y' : 'ies'} shown · ${wdAccessLabel()}${cacheSuffix}`;
    }

    if (!wdActiveDashboardTasks.length) {
        listEl.innerHTML = `
            <div class="wd-dashboard-empty-state success">
                <span class="wd-empty-icon"><i class="fa-solid fa-circle-check"></i></span>
                <div>
                    <strong>Clear board</strong>
                    <p>No incomplete invoice entries found for your access.</p>
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
                    <p>Try another card or search by PO, vendor, site, note, or status.</p>
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
