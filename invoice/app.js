// app.js
/*
  CLEAN ORGANIZED WORKING COPY - app.js
  Prepared: 2026-06-10

  IMPORTANT SAFETY NOTE:
  - Execution order is preserved. Code was NOT moved between modules.
  - This keeps const/let timing, DOM setup, event listeners, and Firebase initialization safer.
  - Related areas are wrapped with large searchable block titles so you can navigate quickly.

  HOW TO NAVIGATE:
  - Use Ctrl+F and search: BLOCK 17, INVOICE ENTRY, HELP CENTER, ACTIVE TASKS, etc.
  - VS Code can also fold sections marked with //#region / //#endregion.

  MAIN BLOCK MAP:
  [BLOCK 00] APP VERSION + ULTRA-FAST AUDIO ENGINE
  [BLOCK 01] NOTE CACHE + VACATION DELEGATION + INVENTORY CONTEXT
  [BLOCK 02] FIREBASE CONFIGURATION + SERVICE INITIALIZATION
  [BLOCK 03] GLOBAL CONSTANTS, STATE + SHARED UTILITIES
  [BLOCK 04] DIRECT MESSAGES / CHAT MODULE
  [BLOCK 05] RUNTIME STATE CONTAINERS
  [BLOCK 06] LOCAL CACHE + CSV / DATA FETCHERS
  [BLOCK 07] GENERAL HELPER FUNCTIONS
  [BLOCK 08] DOM REFERENCES / PAGE ELEMENT MAP
  [BLOCK 09] VIEW SWITCHING, LOGIN + SESSION INITIALIZATION
  [BLOCK 10] CELEBRATION BANNER MODULE
  [BLOCK 11] MAIN NAVIGATION + SETTINGS
  [BLOCK 12] WORKDESK DASHBOARD, CALENDAR + REPORTS
  [BLOCK 13] JOB RECORDS TABLE + REPORT FILTERING
  [BLOCK 14] ACTIVE TASKS + MOBILE TASK CARDS
  [BLOCK 15] JOB ENTRY FORM + VENDOR AUTOCOMPLETE + PERMISSIONS
  [BLOCK 16] MATERIAL STOCK + MODIFY TASK MODAL
  [BLOCK 17] INVOICE TASK LOOKUP + INVOICE ENTRY MODAL
  [BLOCK 18] INVOICE REPORTING, RECORDS, DEEP LINKS + SHARING
  [BLOCK 19] PRINT REPORTS + CSV DOWNLOADS
  [BLOCK 20] BATCH ENTRY + SUMMARY NOTES
  [BLOCK 21] INVOICE DASHBOARD + PAYMENT WORKFLOW
  [BLOCK 22] CEO / MANAGER APPROVAL RECEIPTS + MODALS
  [BLOCK 23] INVOICE MANAGEMENT EVENT WIRING + ATTENTION CHOICE
  [BLOCK 24] INVOICE / TRANSFER HISTORY + STOCK REVERSAL
  [BLOCK 25] STANDARD JOB MODAL + STICKER PRINTING
  [BLOCK 26] INVENTORY BUTTON + MODAL LISTENERS + CLEAR LOGIC
  [BLOCK 27] REPORT WORKFLOW, RECEIPT UPLOAD + FINANCE BATCH
  [BLOCK 28] FINANCE REPORTS + EXPORTS
  [BLOCK 29] DELETE INVOICE + RECENT SYNC STUBS + INVOICE RECORDS PRINT PREVIEW
  [BLOCK 30] UI SHORTCUTS, AUDIO TOGGLE + QUICK BUTTONS
  [BLOCK 31] IM HELP CENTER
  [BLOCK 32] FINAL UI CLEANUP + HELP CENTER BOOTSTRAP
*/

/*
  ORGANIZATION:
  - Config (Firebase) → Global State → Data/Caching → UI/DOM → Event Handlers → Init
  - Cleanup note: removed bracket labels like // [1.a], kept logic unchanged.
*/


// =================================================================================================
// #region BLOCK 00 — APP VERSION + ULTRA-FAST AUDIO ENGINE
// Purpose: Audio preload/volume, global sound controls, search-intent lock, click/keyboard sound triggers, table observers.
// =================================================================================================

// app.js - Top of file
const APP_VERSION = '10.4.5';

// ======================================================================
// ULTRA-FAST AUDIO ENGINE (WITH CONFIRM SOUND & SNAP-SHUT LOCK)
// ======================================================================
// Audio engine moved to js/app-audio.js in v8.0.4 (cleanup only).
// Public functions preserved:
// - toggleSystemAudio
// - armSearchIntent
// - playSystemSuccess / playSystemError / playSystemDelete / playSystemConfirm
// - playMessagePop / playMessageSent


// Helper function to format numbers into financial format (e.g., 64,862.50)
// formatTableCurrency moved to js/app-utils.js in v8.0.3 (cleanup only).



// #endregion BLOCK 00 — APP VERSION + ULTRA-FAST AUDIO ENGINE


// =================================================================================================
// #region BLOCK 01 — NOTE CACHE + VACATION DELEGATION + INVENTORY CONTEXT
// Purpose: Note dropdown refresh, Super Admin/general vacation delegation, SRV candidate picker, inventory/workdesk context detection.
// =================================================================================================

// ======================================================================
// NOTE CACHE / UI REFRESH (keeps Note dropdowns in-sync without reload)
// ======================================================================
// refreshNotePickers moved to js/app-attention-validation.js in v8.2.3 (cleanup only).

// --- Vacation Delegation Helpers moved to js/app-vacation.js in v8.0.5 (cleanup only).
// Public names preserved: SUPER_ADMIN_NAME, getCachedApproversData, getApproversDataSafe,
// getActiveVacationConfig, isVacationDelegateUser, getActiveVacationByName,
// resolveVacationAssignee, getDelegatorsForReplacement.

// autoSetAttentionForStatus moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// --------------------------------------------------------------
// Candidate picker modal (simple, no external dependencies)
// --------------------------------------------------------------
// showCandidatePicker moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// Find a person by exact name (case‑insensitive) or by position keyword
// findPersonByKeyword moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// getSiteMatchedAttentionCandidatesForSRV moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// DETECT INVENTORY CONTEXT
// 7.5.4 — Inventory context/type helper functions moved to js/app-inventory.js.
// Kept as global functions through a classic script so existing app.js calls continue to work.

// Keep legacy variable name for existing code paths
const isInventoryPage = (typeof isInventoryContext === 'function') ? isInventoryContext() : false;



// ======================================================================
// WORKDESK (DESKTOP) FILTERING: Hide Inventory Tasks/Jobs (Mobile unchanged)
// ======================================================================
// 7.5.0 — mobile/responsive helpers moved to js/app-mobile.js
// Kept as global functions through a classic script so existing app.js calls continue to work.


// #endregion BLOCK 01 — NOTE CACHE + VACATION DELEGATION + INVENTORY CONTEXT


// =================================================================================================
// #region BLOCK 02 — FIREBASE CONFIGURATION + SERVICE INITIALIZATION
// Purpose: Main DB, payment DB, invoice DB, progress PO DB, storage/database handles.
// =================================================================================================

// ==========================================================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================================================

// Main DB for approvers, job_entries, project_sites
const firebaseConfig = {
    apiKey: "AIzaSyBCHiQsjqhEUVZN9KhhckSqkw8vVT9LcXc",
    authDomain: "ibainvoice-3ea51.firebaseapp.com",
    databaseURL: "https://ibainvoice-3ea51-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ibainvoice-3ea51",
    storageBucket: "ibainvoice-3ea51.firebasestorage.app",
    messagingSenderId: "152429622957",
    appId: "1:152429622957:web:f79a80df75ce662e97b824",
    measurementId: "G-KR3KDQ3NRC"
};

// Initialize Main App and Services
const mainApp = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const mainStorage = firebase.storage(mainApp); // Initialized Storage for CSV fetching

// Payments DB (For Finance Report)
const paymentFirebaseConfig = {
    apiKey: "AIzaSyAt0fLWcfgGAWV4yiu4mfhc3xQ5ycolgnU",
    authDomain: "payment-report-23bda.firebaseapp.com",
    databaseURL: "https://payment-report-23bda-default-rtdb.firebaseio.com",
    projectId: "payment-report-23bda",
    storageBucket: "payment-report-23bda.firebasestorage.app",
    messagingSenderId: "575646169000",
    appId: "1:575646169000:web:e79a80df75ce662e97b824",
    measurementId: "G-X4WBLDGLHQ"
};
const paymentApp = firebase.initializeApp(paymentFirebaseConfig, 'paymentReport');
const paymentDb = paymentApp.database();

// Invoice DB
const invoiceFirebaseConfig = {
    apiKey: "AIzaSyB5_CCTk-dvr_Lsv0K2ScPwHJkkCY7VoAM",
    authDomain: "invoiceentry-b15a8.firebaseapp.com",
    databaseURL: "https://invoiceentry-b15a8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "invoiceentry-b15a8",
    storageBucket: "invoiceentry-b15a8.firebasestorage.app",
    messagingSenderId: "916998429537",
    appId: "1:916998429537:web:6f4635d6d6e1cb98bb0320",
    measurementId: "G-R409J22B97"
};
const invoiceApp = firebase.initializeApp(invoiceFirebaseConfig, 'invoiceEntry');
const invoiceDb = invoiceApp.database();
const storage = firebase.storage(invoiceApp);


// =======================================================
// SECONDARY DATABASE CONFIG (Progress PO)
// =======================================================
const progressPOConfig = {
    apiKey: "AIzaSyC7cfmocz3oPyERDIiJj5XIDeA3wc6rQZI",
    authDomain: "progress-po.firebaseapp.com",
    databaseURL: "https://progress-po-default-rtdb.firebaseio.com",
    projectId: "progress-po",
    storageBucket: "progress-po.firebasestorage.app",
    messagingSenderId: "100311283897",
    appId: "1:100311283897:web:0dc641fd38df3f241f8368",
    measurementId: "G-YYE9BBQ9SE"
};

// Initialize the app. We check if it already exists to prevent errors.
let progressApp;
try {
    progressApp = firebase.app("progressApp");
} catch (e) {
    progressApp = firebase.initializeApp(progressPOConfig, "progressApp");
}
const progressDb = progressApp.database();


// #endregion BLOCK 02 — FIREBASE CONFIGURATION + SERVICE INITIALIZATION


// =================================================================================================
// #region BLOCK 03 — GLOBAL CONSTANTS, STATE + SHARED UTILITIES
// Purpose: SharePoint paths, cache duration, state variables, safe text/date/html helpers.
// =================================================================================================

// ==========================================================================
// 2. GLOBAL CONSTANTS & STATE VARIABLES
// ==========================================================================

const ATTACHMENT_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/Attachments/";
const PDF_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/INVOICE/";
const SRV_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/SRV/";
const REPORT_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/Report/";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours cache

// SharePoint PDF filename handling
// Goal: always build links without any whitespace before ".pdf" and never end up with trailing spaces in the base name.
// Examples:
//   "12345-in-01-sample .pdf"  -> "12345-in-01-sample.pdf"
//   "....DISTRICT "            -> "....DISTRICT.pdf"
// SharePoint/text utility helpers moved to js/app-utils.js in v8.0.3 (cleanup only).






// Build a safe SharePoint PDF URL or return null if name is blank/"nil".



// -- State Variables --
let currentApprover = null;
let dateTimeInterval = null;
let workdeskDateTimeInterval = null;
let imDateTimeInterval = null;
let activeTaskAutoRefreshInterval = null;
let imNavigationList = [];
let imNavigationIndex = -1;

// ==========================================================================
// UTILITIES (shared)
// ==========================================================================

// escapeHtml moved to js/app-utils.js in v8.0.3 (cleanup only).





// #endregion BLOCK 03 — GLOBAL CONSTANTS, STATE + SHARED UTILITIES


// =================================================================================================
// #region BLOCK 04 — DIRECT MESSAGES / CHAT MODULE
// Moved to js/app-chat.js in 8.0.0 (cleanup only).
// =================================================================================================


// #endregion BLOCK 04 — DIRECT MESSAGES / CHAT MODULE


// =================================================================================================
// #region BLOCK 05 — RUNTIME STATE CONTAINERS
// Purpose: Choices instances, data arrays, filter state, cache containers, WorkDesk to Invoice Management context.
// =================================================================================================

// -- Dropdown Choices Instances --
let siteSelectChoices = null;
let attentionSelectChoices = null;
let imAttentionSelectChoices = null;
let imBatchGlobalAttentionChoices = null;
let imBatchNoteSearchChoices = null;
let modifyTaskAttentionChoices = null;

// -- Data Containers --
let currentlyEditingKey = null;
let currentlyEditingInvoiceKey = null;
let currentPO = null;

let allJobEntries = [];
let userJobEntries = [];
let userActiveTasks = [];
let allAdminCalendarTasks = [];
let ceoProcessedTasks = [];
let managerProcessedTasks = []; // <--- ADD THIS
let transferProcessedTasks = [];
window.transferProcessedTasks = transferProcessedTasks; // Expose to transferLogic.js

let allSystemEntries = [];
// Inventory Phase 2: separate cached record families for Job Records.
// These are derived from the same Firebase data but keep Inventory and WorkDesk renderers independent.
let inventorySystemEntries = [];
let workdeskSystemEntries = [];
let navigationContextList = [];
let navigationContextIndex = -1;
let currentPOInvoices = {};
let currentReportData = [];
let invoicesToPay = {};

// -- Filters & UI State --
let currentReportFilter = 'All';
let currentActiveTaskFilter = 'All';
let wdCurrentCalendarDate = new Date();
let isYearView = false;
let wdCurrentDayViewDate = null;
let imStatusBarChart = null;
let imYearlyChart = null;

// -- Cache Variables --
let approverListForSelect = [];
let allUniqueNotes = new Set();
let allEcostData = null;
let ecostDataTimestamp = 0;
let allPOData = null;
let allPODataByRef = null;
let manualPOsMergedIntoAllPOData = false; // Tracks whether invoiceDb/purchase_orders has been merged into allPOData

let allInvoiceData = null;
let ensuredPOInInvoiceDb = new Set(); // Auto-sync used POs into invoiceDb/purchase_orders
let allApproverData = null;
let allEpicoreData = null;
let allSitesCSVData = null;
let allEcommitDataProcessed = null;
let allApproversCache = null;
let allSitesCache = null;
let allApproverDataCache = null;
let allVendorsData = null; // New Cache for Vendors.csv

// -- Workdesk <-> IM Context --
let jobEntryToUpdateAfterInvoice = null;
let pendingJobEntryDataForInvoice = null;

let cacheTimestamps = {
    poData: 0,
    invoiceData: 0,
    approverData: 0,
    systemEntries: 0,
    epicoreData: 0,
    sitesCSV: 0
};


// #endregion BLOCK 05 — RUNTIME STATE CONTAINERS


// =================================================================================================
// #region BLOCK 06 — LOCAL CACHE + CSV / DATA FETCHERS
// Moved to js/app-data-cache.js in v8.2.0 (cleanup only).
// Public function names preserved:
// - setCache / getCache / loadDataFromLocalStorage
// - getFirebaseCSVUrl / silentlyRefreshStaleCaches
// - fetchAndParseCSV / fetchAndParseEpicoreCSV / fetchAndParseSitesCSV
// - fetchAndParseEcommitCSV / fetchAndParseEcostCSV / fetchAndParseVendorsCSV
// - ensureEcostDataFetched / ensureInvoiceDataFetched / ensureAllEntriesFetched
// - ensureApproverDataCached
// - updateLocalInvoiceCache / addToLocalInvoiceCache / removeFromLocalInvoiceCache
// - Summary PO key helpers and POdetails refresh helper
// #endregion BLOCK 06 — LOCAL CACHE + CSV / DATA FETCHERS


// =================================================================================================
// #region BLOCK 07 — GENERAL HELPER FUNCTIONS
// Purpose: Copy helpers, date/number/currency formatting, debounce, refresh cooldown helper fallback.
// =================================================================================================

// ==========================================================================
// 4. GENERAL HELPER FUNCTIONS
// ==========================================================================

// --------------------------------------------------------------------------
// QUICK COPY / DATE / MONEY / TEXT HELPERS
// --------------------------------------------------------------------------
// 7.5.2: Moved to js/app-core.js so shared helper changes can be maintained
// separately from the large main app.js file.
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Refresh cooldown helper fallback (materialStock.js normally defines this first)
// --------------------------------------------------------------------------
if (!window.__attachRefreshCooldown) {
    (function initRefreshCooldownHelperFallback(){
        const DEFAULT_MINUTES = 30;
        const _inProgress = new Map();

        function _safeStr(v){ return String(v == null ? '' : v); }
        function _getUserName(){
            try {
                if (window.currentApprover && window.currentApprover.Name) return window.currentApprover.Name;
                if (window.currentUser && window.currentUser.username) return window.currentUser.username;
                if (window.currentUser && window.currentUser.Name) return window.currentUser.Name;
            } catch (_) {}
            return 'UnknownUser';
        }
        function _sanitizeKey(s){
            return _safeStr(s).trim().replace(/[.#$\[\]\/\\]/g, '_').replace(/\s+/g, '_') || 'UnknownUser';
        }
        function _cooldownStorageKey(actionKey){
            const userKey = _sanitizeKey(_getUserName());
            return `refreshCooldown:${userKey}:${actionKey}`;
        }
        function _formatRemaining(ms){
            const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
            const m = Math.floor(totalSeconds / 60);
            const s = totalSeconds % 60;
            return `${m}m ${s}s`;
        }

        window.__attachRefreshCooldown = function(buttonEl, actionKey, handler, minutes = DEFAULT_MINUTES, opts = {}){
            if (!buttonEl || typeof handler !== 'function') return;

            const cooldownMinutes = (typeof minutes === 'number' && minutes > 0) ? minutes : DEFAULT_MINUTES;
            const cooldownMs = cooldownMinutes * 60 * 1000;

            const showMessage = (typeof opts.showMessage === 'function')
                ? opts.showMessage
                : (msg) => alert(msg);

            const progressKey = _cooldownStorageKey(actionKey) + ':inProgress';

            if (buttonEl.dataset && buttonEl.dataset.cooldownBound === '1') return;
            if (buttonEl.dataset) buttonEl.dataset.cooldownBound = '1';

            buttonEl.addEventListener('click', async (e) => {
                if (_inProgress.get(progressKey)) {
                    e?.preventDefault?.();
                    showMessage('Refresh is already running. Please wait.');
                    return;
                }

                const key = _cooldownStorageKey(actionKey);
                const last = parseInt(localStorage.getItem(key) || '0', 10);
                const now = Date.now();

                if (last && (now - last) < cooldownMs) {
                    const remaining = cooldownMs - (now - last);
                    const nextTime = new Date(last + cooldownMs);
                    e?.preventDefault?.();
                    showMessage(
                        `Refresh is limited to once every ${cooldownMinutes} minutes.\n\n` +
                        `Please wait ${_formatRemaining(remaining)}.\n` +
                        `Next available: ${nextTime.toLocaleString()}`
                    );
                    return;
                }

                localStorage.setItem(key, String(now));
                _inProgress.set(progressKey, true);
                try { await handler(e); }
                catch (err) {
                    console.error('Refresh action failed:', err);
                    showMessage('Refresh failed. If this keeps happening, please contact Admin.');
                }
                finally { _inProgress.delete(progressKey); }
            }, { passive: false });
        };
    })();
}

function updateDashboardDateTime() {}
function updateWorkdeskDateTime() {}
function updateIMDateTime() {}


// #endregion BLOCK 07 — GENERAL HELPER FUNCTIONS


// =================================================================================================
// #region BLOCK 08 — DOM REFERENCES / PAGE ELEMENT MAP
// Moved to js/app-dom-refs.js in v8.2.9 (cleanup only).
// The DOM constants and badge helper functions remain globally available for app.js and modules.
// #endregion BLOCK 08 — DOM REFERENCES / PAGE ELEMENT MAP


// =================================================================================================
// #region BLOCK 09 — VIEW SWITCHING, LOGIN + SESSION INITIALIZATION
// Moved to js/app-navigation-settings.js in v8.3.1 (cleanup only).
// Functions remain globally available: showView, findApprover, getApproverByKey, handleSuccessfulLogin.
// #endregion BLOCK 09 — VIEW SWITCHING, LOGIN + SESSION INITIALIZATION


// Celebration Banner Module moved to js/app-celebration.js in 8.0.1 (cleanup only).

// =================================================================================================
// #region BLOCK 11 — MAIN NAVIGATION + SETTINGS
// Moved to js/app-navigation-settings.js in v8.3.1 (cleanup only).
// Functions remain globally available: handleLogout, showWorkdeskSection, showIMSection, populateSettingsForm, handleUpdateSettings.
// #endregion BLOCK 11 — MAIN NAVIGATION + SETTINGS


// =================================================================================================
// #region BLOCK 12 — WORKDESK DASHBOARD, CALENDAR + REPORTS
// Purpose: Task completion checks, WorkDesk dashboard, calendar/year/day views, CSV download, in-transit report printing.
// =================================================================================================

// isTaskComplete moved to js/app-active-tasks.js in v8.1.5 (cleanup only).


// =================================================================================================
// #region BLOCK 12 — WORKDESK DASHBOARD, CALENDAR + REPORTS
// Moved to js/app-workdesk-dashboard.js in v8.1.4 (cleanup only).
// Public functions preserved:
// - populateWorkdeskDashboard
// - renderWorkdeskCalendar
// - populateAdminCalendarTasks
// - populateCalendarTasks
// - renderYearView
// - toggleCalendarView
// - displayCalendarTasksForDay
// - showDayView
// - generateDateScroller
// - handleDownloadWorkdeskCSV
// #endregion BLOCK 12 — WORKDESK DASHBOARD, CALENDAR + REPORTS

// ==========================================================================
// Inventory In-Transit report helpers moved to js/app-inventory.js in v7.9.4.
// Keep this marker here so the reporting block stays easy to locate.
// ==========================================================================


// ==========================================================================
// UPDATED FUNCTION: renderReportingTable (Includes 'Usage' & Strict Sticker Logic)
// ==========================================================================

// #endregion BLOCK 12 — WORKDESK DASHBOARD, CALENDAR + REPORTS


// =================================================================================================
// #region BLOCK 13 — JOB RECORDS TABLE + REPORT FILTERING
// Moved to js/app-workdesk-reporting.js in v8.1.3 (cleanup only).
// Public functions preserved:
// - renderReportingTable
// - filterAndRenderReport
// - handleReportingSearch
// Inventory renderer delegation remains unchanged through js/app-inventory.js.
// #endregion BLOCK 13 — JOB RECORDS TABLE + REPORT FILTERING


// =================================================================================================
// #region BLOCK 14 — ACTIVE TASKS + MOBILE TASK CARDS
// Purpose: Desktop active-task table, grouped inventory tasks, task filters, mobile cards, CEO/manager/transfer actions.
// =================================================================================================

// renderActiveTaskTable moved to js/app-active-tasks.js in v8.1.5 (cleanup only).


// 7.5.6 — renderInventoryActiveTaskTable moved to js/app-inventory.js.
// renderWorkdeskActiveTaskTable moved to js/app-active-tasks.js in v8.1.5 (cleanup only).


// 7.5.6 — renderInventoryMobileActiveTasks moved to js/app-inventory.js.
// renderWorkdeskMobileActiveTasks moved to js/app-active-tasks.js in v8.1.5 (cleanup only).


// ==========================================================================
// UPDATED FUNCTION: populateActiveTasks (V5.3.4)
// FIX: "For SRV" is now STRICTLY Attention-based.
// It ignores the "All Sites" profile capability.
// ==========================================================================
// populateActiveTasks moved to js/app-active-tasks.js in v8.1.5 (cleanup only).


// handleActiveTaskSearch moved to js/app-active-tasks.js in v8.1.5 (cleanup only).


// ==========================================================================
// NEW FUNCTION: Handle SRV Done (Routes back to Sender)
// ==========================================================================
async function handleSRVDone(btn, key) {
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processing...';
    }

    try {
        if (typeof ensureInvoiceDataFetched === 'function') {
            await ensureInvoiceDataFetched(false);
        } else if (typeof ensureAllEntriesFetched === 'function') {
            await ensureAllEntriesFetched(false);
        }

        const keyStr = String(key || '').trim();
        const taskFromList = (Array.isArray(userActiveTasks)
            ? (userActiveTasks.find(t => t && String(t.key || '').trim() === keyStr) || {})
            : {});

        const isInvoiceDB = keyStr.includes('_') || (taskFromList && taskFromList.source === 'invoice');

        let sender = 'Accounting';
        let oldAttention = '';
        let poNumber = '';
        let invoiceKey = '';

        if (isInvoiceDB) {
            if (taskFromList && taskFromList.originalPO) poNumber = taskFromList.originalPO;
            if (taskFromList && taskFromList.originalKey) invoiceKey = taskFromList.originalKey;

            if ((!poNumber || !invoiceKey) && keyStr.includes('_')) {
                const idx = keyStr.indexOf('_');
                poNumber = poNumber || keyStr.slice(0, idx);
                invoiceKey = invoiceKey || keyStr.slice(idx + 1);
            }

            poNumber = String(poNumber || '').trim().toUpperCase();
            const candidateInvoiceKey = String(invoiceKey || '').trim();

            const resolveInvoiceEntry = async () => {
                if (!poNumber) return { resolvedKey: null, invData: null };
                if (candidateInvoiceKey) {
                    const directSnap = await invoiceDb.ref(`invoice_entries/${poNumber}/${candidateInvoiceKey}`).once('value');
                    if (directSnap.exists()) {
                        return { resolvedKey: candidateInvoiceKey, invData: directSnap.val() || {} };
                    }
                }
                const targetInvEntryID = String(taskFromList.invEntryID || '').trim();
                const targetInvNumber = String(taskFromList.ref || taskFromList.invNumber || '').trim();
                const pickBestMatch = (bucket) => {
                    const matches = [];
                    if (!bucket) return null;
                    for (const [k, v] of Object.entries(bucket)) {
                        if (!v) continue;
                        const vEntry = String(v.invEntryID || '').trim();
                        const vNo = String(v.invNumber || '').trim();
                        const entryMatch = targetInvEntryID && vEntry && vEntry === targetInvEntryID;
                        const numberMatch = !entryMatch && targetInvNumber && vNo && vNo === targetInvNumber;
                        if (entryMatch || numberMatch) {
                            const score = Number(v.lastUpdated || v.updatedAt || v.enteredAt || 0);
                            matches.push({ k, v, score });
                        }
                    }
                    if (matches.length === 0) return null;
                    matches.sort((a, b) => (b.score || 0) - (a.score || 0));
                    return matches[0];
                };
                const cacheBucket = (allInvoiceData && allInvoiceData[poNumber]) ? allInvoiceData[poNumber] : null;
                let best = pickBestMatch(cacheBucket);
                if (!best) {
                    const poSnap = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
                    const poBucket = poSnap.val() || {};
                    best = pickBestMatch(poBucket);
                    if (best) return { resolvedKey: best.k, invData: best.v || {} };
                }
                if (best) return { resolvedKey: best.k, invData: best.v || {} };
                return { resolvedKey: null, invData: null };
            };

            const { resolvedKey, invData } = await resolveInvoiceEntry();
            if (!resolvedKey) throw new Error(`Invoice entry not found for PO ${poNumber}. (Prevented duplicate creation)`);
            invoiceKey = resolvedKey;
            sender = (invData && (invData.enteredBy || invData.originEnteredBy)) || 'Accounting';
            oldAttention = (taskFromList.attention || (invData ? invData.attention : '') || '');

            const updates = { status: 'SRV Done', attention: '', lastUpdated: firebase.database.ServerValue.TIMESTAMP };
            await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates);

            // === SYNC LINKED JOB ENTRY ===
            await updateLinkedJobEntry(poNumber, invoiceKey, 'SRV Done', 'Marked SRV Done via Active Task');

            try {
                const sanitizeFirebaseKey = (k) => String(k || '').replace(/[.#$[\]]/g, '_');
                const safeMe = sanitizeFirebaseKey(currentApprover?.Name || '');
                const removals = [];
                const keysToRemove = new Set([invoiceKey, candidateInvoiceKey].filter(Boolean));
                for (const k of keysToRemove) {
                    if (safeMe) removals.push(invoiceDb.ref(`invoice_tasks_by_user/${safeMe}/${k}`).remove());
                    removals.push(invoiceDb.ref(`invoice_tasks_by_user/All/${k}`).remove());
                }
                await Promise.allSettled(removals);
            } catch (_) { }

            const originalInvoice = (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey])
                ? allInvoiceData[poNumber][invoiceKey]
                : (invData || {});
            const updatedInvoiceData = { ...originalInvoice, ...updates };
            if (typeof updateInvoiceTaskLookup === 'function') {
                await updateInvoiceTaskLookup(poNumber, invoiceKey, updatedInvoiceData, oldAttention);
            }
            updateLocalInvoiceCache(poNumber, invoiceKey, updates);
            if (window.logInvoiceHistory) {
                await window.logInvoiceHistory(poNumber, invoiceKey, 'SRV Done', 'Marked SRV Done via Active Task');
            }
        } else {
            if (typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(false);
            const jobEntry = (allSystemEntries || []).find(e => e.key === keyStr);
            if (jobEntry) {
                sender = jobEntry.enteredBy || 'Accounting';
                oldAttention = jobEntry.attention || '';
            }
            await db.ref(`job_entries/${keyStr}`).update({
                remarks: 'SRV Done',
                attention: '',
                dateResponded: formatDate(new Date())
            });
        }

        alert('SRV Completed. Task removed from Active Tasks.');
        if (typeof populateActiveTasks === 'function') await populateActiveTasks();
    } catch (error) {
        console.error("Error marking SRV Done:", error);
        alert("Error updating status. Please try again.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'SRV Done';
        }
    }
}

// ==========================================================================
// AUTO-RECONCILE PR JOBS (Universal Date Fixer)
// ==========================================================================
async function reconcilePendingPRs() {
    // 1. Safety Checks
    if (!allSystemEntries || allSystemEntries.length === 0) return;

    if (!allPODataByRef) {
        console.log("CSV Data missing, attempting auto-load...");
        await ensureInvoiceDataFetched(false);
        if (!allPODataByRef) return;
    }

    const updates = {};
    let updateCount = 0;

    // 2. Scan Job Entries
    allSystemEntries.forEach(entry => {
        if (entry.source === 'job_entry' &&
            entry.for === 'PR' &&
            entry.remarks !== 'PO Ready' &&
            entry.ref) {

            const refKey = String(entry.ref).trim();
            const matchedPO = allPODataByRef[refKey] || allPODataByRef[refKey.toUpperCase()];

            if (matchedPO) {
                console.log(`>> MATCHED PR: ${refKey}`, matchedPO);

                // --- A. GET DATA ---
                const getVal = (keyPart) => {
                    const exactKey = Object.keys(matchedPO).find(k => k.toLowerCase().includes(keyPart.toLowerCase()));
                    return exactKey ? matchedPO[exactKey] : '';
                };

                const poNum = getVal('PO') || '';
                const supplier = getVal('Supplier') || 'N/A';
                let amount = String(getVal('Amount') || '0').replace(/,/g, '');
                const entryPerson = getVal('Entry Person') || getVal('Buyer') || 'Records';

                // --- B. "ABSOLUTE" DATE FIXER ---
                // This handles: 18-11-19, 18/11/2019, 18.11.19, etc.
                let rawDate = getVal('Order Date');
                let finalDate = '';

                if (rawDate) {
                    const cleanDate = rawDate.trim();

                    // Split by ANY separator (Hyphen, Slash, Dot, Space)
                    const parts = cleanDate.split(/[\/\-\.\s]+/);

                    if (parts.length === 3) {
                        // Assume Standard International Format: Day - Month - Year
                        let d = parts[0];
                        let m = parts[1];
                        let y = parts[2];

                        // Fix Year: If 2 digits (e.g. "19" or "25"), make it "2019" or "2025"
                        if (y.length === 2) y = "20" + y;

                        // Fix Day/Month: Ensure they are 2 digits (e.g. "1" -> "01")
                        d = d.padStart(2, '0');
                        m = m.padStart(2, '0');

                        // Create ISO String (YYYY-MM-DD) which formatYYYYMMDD understands
                        const isoDate = `${y}-${m}-${d}`;

                        // Convert to System Format: "18-Nov-2019"
                        finalDate = formatYYYYMMDD(isoDate);
                    } else {
                        // Fallback: Let the browser guess
                        finalDate = formatYYYYMMDD(normalizeDateForInput(cleanDate));
                    }
                }

                // Fallback if empty: Use Today
                if (!finalDate || finalDate === 'N/A') {
                    finalDate = formatDate(new Date());
                }

                // --- C. UPDATE ---
                const key = entry.key;
                updates[`job_entries/${key}/po`] = poNum;
                updates[`job_entries/${key}/vendorName`] = supplier;
                updates[`job_entries/${key}/amount`] = amount;
                updates[`job_entries/${key}/attention`] = entryPerson;
                updates[`job_entries/${key}/dateResponded`] = finalDate;
                updates[`job_entries/${key}/remarks`] = 'PO Ready';

                // --- D. UPDATE DISPLAY ---
                entry.po = poNum;
                entry.vendorName = supplier;
                entry.amount = amount;
                entry.attention = entryPerson;
                entry.dateResponded = finalDate;
                entry.remarks = 'PO Ready';

                updateCount++;
            }
        }
    });

    if (updateCount > 0) {
        console.log(`Auto-Reconcile: Updating ${updateCount} PRs...`);
        try {
            await db.ref().update(updates);
            if (document.getElementById('wd-activetask') && !document.getElementById('wd-activetask').classList.contains('hidden')) {
                populateActiveTasks();
            }
        } catch (e) {
            console.error("Error committing PR updates:", e);
        }
    }
}

// 8.0.8 cleanup note:
// Removed an old loose tab-coloring block that was sitting outside any function and referenced
// an undefined variable named `tasks`. It was not connected to the current Active Task tabs,
// and the current tab coloring/counting logic remains inside populateActiveTasks().

function isMobileInventoryTask(task) {
    return !!(task && ['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for));
}

function canMobileInventoryBulkApproveTask(task) {
    if (!isMobileInventoryTask(task)) return false;
    const currentUserName = (currentApprover && currentApprover.Name) ? currentApprover.Name : '';
    const isAdminUser = (currentApprover && String(currentApprover.Role || '').toLowerCase() === 'admin');
    const remarks = String(task.remarks || task.status || '').trim();

    // Bulk approval is intentionally limited to the authorization stage.
    // Source confirmation, receiver confirmation, and usage confirmation can need manual checking.
    if (!(remarks === 'Pending Admin' || remarks === 'Pending')) return false;
    return isAdminUser || String(task.approver || '').trim() === currentUserName;
}

function getMobileInventoryApprovalQty(task) {
    if (!task) return 0;
    const approved = (task.approvedQty !== undefined && task.approvedQty !== null) ? parseFloat(task.approvedQty) : NaN;
    if (Number.isFinite(approved) && approved > 0) return approved;
    const ordered = parseFloat(task.orderedQty ?? task.requiredQty ?? 0);
    return Number.isFinite(ordered) ? ordered : 0;
}

function updateMobileBulkApprovalCount(container) {
    if (!container) return;
    const selected = container.querySelectorAll('.mobile-transfer-select:checked').length;
    const countEl = container.querySelector('#mobile-bulk-selected-count');
    const approveBtn = container.querySelector('#mobile-bulk-approve-selected');
    if (countEl) countEl.textContent = `${selected} selected`;
    if (approveBtn) approveBtn.disabled = selected === 0;
}

function setupMobileBulkApprovalControls(container) {
    if (!container) return;
    const selectAll = container.querySelector('#mobile-bulk-select-all');
    const approveBtn = container.querySelector('#mobile-bulk-approve-selected');
    const checks = Array.from(container.querySelectorAll('.mobile-transfer-select'));

    checks.forEach(chk => {
        chk.addEventListener('click', e => e.stopPropagation());
        chk.addEventListener('change', () => {
            if (selectAll) selectAll.checked = checks.length > 0 && checks.every(c => c.checked);
            updateMobileBulkApprovalCount(container);
        });
    });

    if (selectAll) {
        selectAll.addEventListener('click', e => e.stopPropagation());
        selectAll.addEventListener('change', () => {
            checks.forEach(c => { c.checked = selectAll.checked; });
            updateMobileBulkApprovalCount(container);
        });
    }

    if (approveBtn) {
        approveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selectedKeys = checks.filter(c => c.checked).map(c => c.dataset.key).filter(Boolean);
            await window.processMobileTransferBulkApproval(selectedKeys, approveBtn, container);
        });
    }

    updateMobileBulkApprovalCount(container);
}

function renderMobileActiveTasks(tasks) {
    const container = document.getElementById('active-task-mobile-view');
    const receiptContainer = document.getElementById('mobile-receipt-action-container');
    const mobileTaskModule = (typeof window.getActiveMobileTaskModule === 'function') ? window.getActiveMobileTaskModule() : ((typeof isInventoryContext === 'function' && isInventoryContext()) ? 'inventory' : 'invoice');

    if (typeof window.applyMobileActiveTaskModuleScope === 'function') {
        window.applyMobileActiveTaskModuleScope(mobileTaskModule);
    }

    if (container) container.innerHTML = '';

    // 1. User Roles
    const isCEO = (currentApprover.Role || '').toLowerCase() === 'admin' && (currentApprover.Position || '').toLowerCase() === 'ceo';
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const currentUser = currentApprover.Name;

    // 2. [RESTORED] BUTTON VISIBILITY LOGIC
    // This was missing in the previous fix. It checks if we need to show ANY receipt button.
    if (receiptContainer) {
        // Check if lists have items
        const showCeoBtn = isCEO && (typeof ceoProcessedTasks !== 'undefined' && ceoProcessedTasks.length > 0);
        const showMgrBtn = isAdmin && (typeof managerProcessedTasks !== 'undefined' && managerProcessedTasks.length > 0);
        // We keep Transfer check here, but since we stopped pushing to the list, it won't show.
        const showTrfBtn = (typeof transferProcessedTasks !== 'undefined' && transferProcessedTasks.length > 0);

        // Show/Hide Main Container
        if (showCeoBtn || showMgrBtn || showTrfBtn) {
            receiptContainer.classList.remove('hidden');
        } else {
            receiptContainer.classList.add('hidden');
        }

        // Toggle Individual Buttons
        const btnCeo = document.getElementById('mobile-send-receipt-btn');
        if(btnCeo) btnCeo.classList.toggle('hidden', !showCeoBtn);

        const btnMgr = document.getElementById('mobile-send-manager-receipt-btn');
        if(btnMgr) btnMgr.classList.toggle('hidden', !showMgrBtn);

        const btnTrf = document.getElementById('mobile-send-transfer-receipt-btn');
        if(btnTrf) btnTrf.classList.toggle('hidden', !showTrfBtn);
    }

    // 3. Filter Logic (Restored)
    let filteredTasks = Array.isArray(tasks) ? tasks.slice() : [];
    const mobileTaskModuleIsInventory = mobileTaskModule === 'inventory';
    if (mobileTaskModuleIsInventory) {
        filteredTasks = filteredTasks.filter(t => isInventoryTaskRecord(t));
    } else {
        filteredTasks = filteredTasks.filter(t => isWorkdeskTaskRecord(t));
    }
    if (currentActiveTaskFilter !== 'All') {
        if (currentActiveTaskFilter === 'Other') {
            filteredTasks = filteredTasks.filter(task => task.remarks !== 'For SRV' && task.remarks !== 'Pending Signature');
        } else {
            filteredTasks = filteredTasks.filter(task => {
                if(['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) return task.for === currentActiveTaskFilter;
                return task.remarks === currentActiveTaskFilter;
            });
        }
    }

    // 4. Empty State
    if (!filteredTasks || filteredTasks.length === 0) {
        container.innerHTML = '<div class="im-mobile-empty-state"><p>No active tasks found.</p></div>';
        return;
    }

    // 5. Bulk approval toolbar for mobile inventory authorization tasks
    const bulkApproveTasks = filteredTasks.filter(task => canMobileInventoryBulkApproveTask(task));
    if (bulkApproveTasks.length > 0) {
        const bulkBar = document.createElement('div');
        bulkBar.className = 'mobile-bulk-approval-bar';
        bulkBar.innerHTML = `
            <div class="mobile-bulk-approval-main">
                <label class="mobile-bulk-select-all" onclick="event.stopPropagation();">
                    <input type="checkbox" id="mobile-bulk-select-all">
                    <span>Select all</span>
                </label>
                <span id="mobile-bulk-selected-count" class="mobile-bulk-selected-count">0 selected</span>
            </div>
            <button type="button" id="mobile-bulk-approve-selected" class="mobile-bulk-approve-btn" disabled>
                <i class="fa-solid fa-check-double"></i> Approve Selected
            </button>
            <div class="mobile-bulk-approval-note">For quantity changes or rejection, open the item and process it one by one.</div>`;
        container.appendChild(bulkBar);
    }

    // 6. Render Cards
    filteredTasks.forEach(task => {
        const card = document.createElement('div');
        const cardIsInventory = ['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for);
        card.className = `mobile-task-card ${cardIsInventory ? 'inventory-mobile-task-card' : 'invoice-mobile-task-card'}`;
        let html = '';

        // --- A. INVENTORY CARD ---
        if (cardIsInventory) {
            let canApprove = false;
            let statusMessage = "";

            // Smart Quantity Logic
            let displayQty = parseFloat(task.orderedQty) || 0;
            let qtyLabel = "Qty";

            if (task.approvedQty !== undefined && task.approvedQty !== null) {
                displayQty = parseFloat(task.approvedQty);
                if (displayQty != task.orderedQty) qtyLabel = "Qty (Adj)";
            }
            if (task.receivedQty !== undefined && task.receivedQty !== null) {
                displayQty = parseFloat(task.receivedQty);
            }

            // Permission Logic
            if (task.remarks === 'Pending Source' && task.sourceContact === currentUser) {
                statusMessage = "<i class='fa-solid fa-desktop'></i> Action Required on Desktop (Source)";
            }
            else if ((task.remarks === 'Pending Admin' || task.remarks === 'Pending') && (task.approver === currentUser || isAdmin)) {
                canApprove = true;
            }
            else if ((task.remarks === 'In Transit' || task.remarks === 'Approved') && task.receiver === currentUser) {
                 statusMessage = "<i class='fa-solid fa-desktop'></i> Action Required on Desktop (Receiver)";
            }
            else if (task.remarks === 'Pending Confirmation' && task.requestor === currentUser) {
                 statusMessage = "<i class='fa-solid fa-desktop'></i> Action Required on Desktop (Requestor)";
            }
            else {
                statusMessage = `<i class='fa-solid fa-clock'></i> Waiting for other party`;
            }

            const bulkCheckboxHtml = canApprove
                ? `<label class="mobile-bulk-item-check" onclick="event.stopPropagation();"><input type="checkbox" class="mobile-transfer-select" data-key="${task.key}"> <span>Select</span></label>`
                : '';

            html += `
            <div class="mobile-card-header inventory-transfer-mobile-header" style="border-left: 5px solid #17a2b8;">
                ${bulkCheckboxHtml}
                <div class="m-card-main">
                    <h3>${task.productName || 'Unknown Item'}</h3>
                    <div class="m-card-sub">
                        <span style="background:#e3f2fd; color:#00748C; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${task.for.toUpperCase()}</span>
                        <span style="margin-left:5px; color:#555;">${task.controlNumber || task.ref}</span>
                    </div>
                    <div class="m-card-sub" style="margin-top:4px;">${task.site || task.fromSite || ''}</div>
                </div>
                <div class="m-card-amount" style="text-align:right;">
                    <span class="m-card-val" style="color:#17a2b8; font-size:1.4rem;">${displayQty}</span>
                    <span class="m-card-ref" style="font-size:0.7rem; color:#999;">${qtyLabel}</span>
                </div>
            </div>
            <div class="mobile-card-body">
                <div class="m-action-group inventory-mobile-task-details">
                     <p><strong>Status:</strong> <span class="inventory-mobile-status-text">${task.remarks}</span></p>
                     <p><strong>Details:</strong> <span>${task.details || 'N/A'}</span></p>
                </div>
            `;

            if (canApprove) {
                html += `
                <div class="m-btn-row" style="margin-top:15px;">
                    <button class="m-btn-approve trf-mobile-action inventory-transfer-approve-btn" data-action="Approved" style="background-color: #17a2b8; width:100%; padding:12px; border-radius:8px; border:none; color:white; font-weight:bold;">
                        <i class="fa-solid fa-check inventory-transfer-approve-icon"></i> Confirm / Approve
                    </button>
                    <button class="m-btn-reject trf-mobile-action inventory-transfer-reject-btn" data-action="Rejected" style="background-color: #dc3545; width:100%; padding:12px; border-radius:8px; border:none; color:white; font-weight:bold;">
                        <i class="fa-solid fa-xmark inventory-transfer-reject-icon"></i> Reject
                    </button>
                </div>`;
            } else {
                 html += `<div style="text-align:center; padding:12px; color:#777; background:#f0f0f0; border-radius:8px; margin-top:10px; font-size:0.85rem; font-weight:500;">${statusMessage}</div>`;
            }
            html += `</div>`;

        } else {
            // --- B. STANDARD INVOICE CARD (Unchanged) ---
            const invName = task.invName || '';
            const pdfLink = (task.source === 'invoice')
                ? buildSharePointPdfUrl(PDF_BASE_PATH, invName) : null;
            const isManagerTask = isAdmin && task.remarks === 'For Approval';
            const displayAmount = task.amountPaid || task.amount || '';

            html += `
            <div class="mobile-card-header">
                <div class="m-card-main">
                    <h3>${task.vendorName || 'Unknown Vendor'}</h3>
                    <div class="m-card-sub">${task.po || task.ref}</div>
                    <div class="m-card-sub" style="color: #C3502F; font-weight: bold;">${task.remarks}</div>
                </div>
                <div class="m-card-amount">
                    <span class="m-card-val">${displayAmount}</span>
                    <span class="m-card-ref">QAR</span>
                </div>
            </div>
            <div class="mobile-card-body">`;

            if (pdfLink) html += `<a href="${pdfLink}" target="_blank" class="m-pdf-btn"><i class="fa-regular fa-file-pdf"></i> View Invoice PDF</a>`;

            html += `
                <div class="m-action-group">
                    <label>Amount to Paid</label>
                    <input type="number" class="m-input-amount" value="${displayAmount}" step="0.01" ${(!isCEO && !isManagerTask) ? 'readonly' : ''}>
                </div>
                <div class="m-action-group">
                    <label>Note / Remark</label>
                    <textarea class="m-input-note" rows="2" ${(!isCEO && !isManagerTask) ? 'readonly' : ''}>${task.note || ''}</textarea>
                </div>
            `;
            if (isCEO && !isManagerTask) {
                html += `<div class="m-btn-row"><button class="m-btn-approve ceo-action" data-action="Approved">Approve</button><button class="m-btn-reject ceo-action" data-action="Rejected">Reject</button></div>`;
            } else if (isManagerTask) {
                html += `<div class="m-btn-row"><button class="m-btn-approve manager-action" data-action="Approved" style="background-color: #00748C;">Approve</button><button class="m-btn-reject manager-action" data-action="Rejected">Reject</button></div>`;
            } else {
                html += `<div style="text-align:center; padding:10px; color:#777; background:#f0f0f0; border-radius:8px; margin-top:10px;"><i class="fa-solid fa-lock"></i> View Only</div>`;
            }
            html += `</div>`;
        }

        card.innerHTML = html;

        // Card Listeners
        const header = card.querySelector('.mobile-card-header');
        const body = card.querySelector('.mobile-card-body');
        header.addEventListener('click', () => {
            document.querySelectorAll('.mobile-card-body.open').forEach(el => { if (el !== body) el.classList.remove('open'); });
            body.classList.toggle('open');
        });

        // Button Actions
        if (cardIsInventory) {
            const trfBtns = card.querySelectorAll('.trf-mobile-action');
            trfBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                     if(typeof processMobileTransferAction === 'function') {
                         processMobileTransferAction(task, btn.dataset.action, card);
                     }
                });
            });
        } else {
            const ceoBtns = card.querySelectorAll('.ceo-action');
            ceoBtns.forEach(btn => btn.addEventListener('click', () => processMobileCEOAction(task, btn.dataset.action, card.querySelector('.m-input-amount').value, card.querySelector('.m-input-note').value, card)));
            const mgrBtns = card.querySelectorAll('.manager-action');
            mgrBtns.forEach(btn => btn.addEventListener('click', () => {
                if(typeof processMobileManagerAction === 'function') {
                    processMobileManagerAction(task, btn.dataset.action, card.querySelector('.m-input-amount').value, card.querySelector('.m-input-note').value, card);
                }
            }));
        }
        container.appendChild(card);
    });

    setupMobileBulkApprovalControls(container);
}

async function processMobileCEOAction(taskData, status, amount, note, cardElement) {
    if (!amount || amount < 0) { alert("Please enter a valid Amount."); return; }

    cardElement.style.opacity = '0.5'; cardElement.style.pointerEvents = 'none';

    const updates = {
        status: status,
        remarks: status,
        amountPaid: amount,
        amount: amount,
        note: note ? note.trim() : '',
        dateResponded: formatDate(new Date()),
        releaseDate: getTodayDateString(),
        statusChangedAt: firebase.database.ServerValue.TIMESTAMP,
        statusQueueAt: firebase.database.ServerValue.TIMESTAMP
    };

    // --- FIX: Create History Entry Object ---
    const historyEntry = {
        action: status, // "Approved" or "Rejected"
        by: currentApprover.Name,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        note: note || 'Mobile Action'
    };

    try {
        if (taskData.source === 'job_entry') {
            await db.ref(`job_entries/${taskData.key}`).update(updates);
            // Save History for Job
            await db.ref(`job_entries/${taskData.key}/history`).push(historyEntry);

        } else if (taskData.source === 'invoice') {
            await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update(updates);
            // Save History for Invoice
            await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}/history`).push(historyEntry);

            const originalInvoice = (allInvoiceData && allInvoiceData[taskData.originalPO]) ? allInvoiceData[taskData.originalPO][taskData.originalKey] : {};
            const updatedInvoiceData = { ...originalInvoice, ...updates };
            await updateInvoiceTaskLookup(taskData.originalPO, taskData.originalKey, updatedInvoiceData, taskData.attention);
            updateLocalInvoiceCache(taskData.originalPO, taskData.originalKey, updates);
        }

        taskData.status = status;
        taskData.amountPaid = amount;
        ceoProcessedTasks.push(taskData);

        const taskIndex = userActiveTasks.findIndex(t => t.key === taskData.key);
        if (taskIndex > -1) userActiveTasks.splice(taskIndex, 1);

        cardElement.style.transform = 'translateX(100%)';
        setTimeout(() => {
            cardElement.remove();
            document.getElementById('mobile-receipt-action-container').classList.remove('hidden');
            document.getElementById('mobile-send-receipt-btn').classList.remove('hidden');
        }, 300);

    } catch (error) {
        console.error("Mobile Action Error:", error);
        alert("Failed to process task.");
        cardElement.style.opacity = '1'; cardElement.style.pointerEvents = 'auto';
    }
}

async function processMobileManagerAction(taskData, status, amount, note, cardElement) {
    cardElement.style.opacity = '0.5'; cardElement.style.pointerEvents = 'none';

    const updates = {
        status: status,
        remarks: status,
        amountPaid: amount,
        amount: amount,
        note: note ? note.trim() : '',
        dateResponded: formatDate(new Date()),
        releaseDate: getTodayDateString(),
        statusChangedAt: firebase.database.ServerValue.TIMESTAMP,
        statusQueueAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (taskData.attention) updates.note = `${updates.note} [Action by ${currentApprover.Name}]`;

    // --- FIX: Create History Entry Object ---
    const historyEntry = {
        action: status, // "Approved" or "Rejected"
        by: currentApprover.Name,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        note: note || 'Mobile Action'
    };

    try {
        if (taskData.source === 'job_entry') {
            await db.ref(`job_entries/${taskData.key}`).update(updates);
            // Save History for Job
            await db.ref(`job_entries/${taskData.key}/history`).push(historyEntry);

        } else if (taskData.source === 'invoice') {
            await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update(updates);
            // Save History for Invoice
            await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}/history`).push(historyEntry);

            const originalInvoice = (allInvoiceData && allInvoiceData[taskData.originalPO]) ? allInvoiceData[taskData.originalPO][taskData.originalKey] : {};
            const updatedInvoiceData = { ...originalInvoice, ...updates };
            await updateInvoiceTaskLookup(taskData.originalPO, taskData.originalKey, updatedInvoiceData, taskData.attention);
            updateLocalInvoiceCache(taskData.originalPO, taskData.originalKey, updates);
        }

        taskData.status = status;
        taskData.amountPaid = amount;
        managerProcessedTasks.push(taskData);

        const taskIndex = userActiveTasks.findIndex(t => t.key === taskData.key);
        if (taskIndex > -1) userActiveTasks.splice(taskIndex, 1);

        cardElement.style.transform = 'translateX(100%)';
        setTimeout(() => {
            cardElement.remove();
            document.getElementById('mobile-receipt-action-container').classList.remove('hidden');
            document.getElementById('mobile-send-manager-receipt-btn').classList.remove('hidden');
        }, 300);

    } catch (error) {
        console.error("Manager Action Error:", error);
        alert("Failed to process.");
        cardElement.style.opacity = '1'; cardElement.style.pointerEvents = 'auto';
    }
}


window.processMobileTransferAction = async function(task, action, cardElement) {
    if (!task || !action) return;

    // 1. Visual Feedback
    cardElement.style.opacity = '0.5';
    cardElement.style.pointerEvents = 'none';

    // 2. Get Correct Quantity (Adjusted vs Ordered)
    const qty = (task.approvedQty !== undefined && task.approvedQty !== null)
                ? parseFloat(task.approvedQty)
                : (parseFloat(task.orderedQty) || 0);

    try {
        // 3. Populate Desktop Hidden Inputs (Required for logic engine)
        const keyInput = document.getElementById('transfer-modal-key');
        const qtyInput = document.getElementById('transfer-modal-qty');
        const noteInput = document.getElementById('transfer-modal-note');
        const dateInput = document.getElementById('transfer-modal-date');

        if(keyInput) keyInput.value = task.key;
        if(qtyInput) qtyInput.value = qty;
        if(noteInput) noteInput.value = "Mobile Action";
        if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        // 4. Execute Logic (Updates Database Status Only)
        if (window.handleTransferAction) {
            const actionResult = await window.handleTransferAction(action);
            if (actionResult === false) {
                cardElement.style.opacity = '1';
                cardElement.style.pointerEvents = 'auto';
                return;
            }
        } else {
            throw new Error("Logic engine not found");
        }

        // 5. Success Animation
        cardElement.style.transition = "transform 0.3s ease, height 0.3s ease";
        cardElement.style.transform = 'translateX(100%)';
        setTimeout(() => {
            cardElement.style.display = 'none';

            // Update Header Count
            if(typeof activeTaskCountDisplay !== 'undefined' && activeTaskCountDisplay) {
                const remaining = document.querySelectorAll('.mobile-task-card:not([style*="display: none"])').length;
                activeTaskCountDisplay.textContent = `(Total Tasks: ${remaining})`;
            }
        }, 300);

    } catch (e) {
        console.error("Mobile Transfer Error:", e);
        alert("Error processing action. Please refresh.");
        cardElement.style.opacity = '1';
        cardElement.style.pointerEvents = 'auto';
    }
};

window.processMobileTransferBulkApproval = async function(selectedKeys, buttonElement, container) {
    const keys = Array.isArray(selectedKeys) ? selectedKeys.filter(Boolean) : [];
    if (keys.length === 0) {
        alert('Please tick at least one item to approve.');
        return;
    }

    const tasks = keys
        .map(key => (userActiveTasks || []).find(t => t.key === key))
        .filter(task => canMobileInventoryBulkApproveTask(task));

    if (tasks.length === 0) {
        alert('No valid approval items selected. Please refresh and try again.');
        return;
    }

    const totalQty = tasks.reduce((sum, t) => sum + (getMobileInventoryApprovalQty(t) || 0), 0);
    const isSure = confirm(`Approve ${tasks.length} selected inventory item(s)?\n\nThis will process each item using the same stock update logic as one-by-one approval.\nTotal displayed qty: ${totalQty}\n\nContinue?`);
    if (!isSure) return;

    const allChecks = container ? Array.from(container.querySelectorAll('.mobile-transfer-select')) : [];
    allChecks.forEach(chk => { chk.disabled = true; });

    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing 0/' + tasks.length;
    }

    const failed = [];
    const processedKeys = [];

    try {
        let index = 0;
        for (const task of tasks) {
            index += 1;
            if (buttonElement) {
                buttonElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing ' + index + '/' + tasks.length;
            }

            const qty = getMobileInventoryApprovalQty(task);
            if (!qty || qty <= 0) {
                failed.push(`${task.productName || task.ref || task.key}: invalid quantity`);
                continue;
            }

            try {
                const keyInput = document.getElementById('transfer-modal-key');
                const qtyInput = document.getElementById('transfer-modal-qty');
                const noteInput = document.getElementById('transfer-modal-note');
                const dateInput = document.getElementById('transfer-modal-date');

                if (keyInput) keyInput.value = task.key;
                if (qtyInput) qtyInput.value = qty;
                if (noteInput) noteInput.value = 'Mobile bulk approval';
                if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

                const actionResult = await window.handleTransferAction('Approved', {
                    skipConfirm: true,
                    silent: true,
                    deferRefresh: true,
                    keepModalOpen: true,
                    prefetchedTask: task
                });

                if (actionResult === false) {
                    failed.push(task.productName || task.ref || task.key);
                    continue;
                }

                processedKeys.push(task.key);
                const card = container
                    ? Array.from(container.querySelectorAll('.mobile-transfer-select')).find(chk => chk.dataset.key === task.key)?.closest('.mobile-task-card')
                    : null;
                if (card) {
                    card.style.opacity = '0.45';
                    card.style.pointerEvents = 'none';
                    card.classList.add('mobile-bulk-approved-card');
                }
            } catch (err) {
                console.error('Bulk approval failed for task:', task, err);
                failed.push(task.productName || task.ref || task.key);
            }
        }

        if (processedKeys.length > 0) {
            for (const key of processedKeys) {
                const idx = userActiveTasks.findIndex(t => t.key === key);
                if (idx > -1) userActiveTasks.splice(idx, 1);
            }

            // 10.0.2: Do not run a full Firebase reload after every mobile bulk approval.
            // The database was already updated by the shared transfer engine. Re-render the
            // already-loaded task list locally so the mobile approver sees the result quickly.
            if (typeof renderActiveTaskTable === 'function') {
                renderActiveTaskTable(userActiveTasks);
            }
            if (typeof updateActiveTaskModuleBadges === 'function') {
                const totalTaskCount = userActiveTasks.length;
                const urgentCount = userActiveTasks.filter(t => t.isUrgent === true).length;
                updateActiveTaskModuleBadges(urgentCount, totalTaskCount, 'inventory');
            }
        }

        if (failed.length > 0) {
            alert(`Bulk approval completed with ${failed.length} item(s) not processed.\n\nNot processed:\n- ${failed.slice(0, 8).join('\n- ')}${failed.length > 8 ? '\n- ...' : ''}`);
        } else {
            alert(`Approved ${processedKeys.length} selected item(s).`);
        }
    } catch (error) {
        console.error('Bulk approval error:', error);
        alert('Bulk approval failed. Please refresh and try again.');
    } finally {
        allChecks.forEach(chk => { chk.disabled = false; });
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<i class="fa-solid fa-check-double"></i> Approve Selected';
        }
    }
};


// =========================================================
// UPDATE MANAGER APPROVAL (Corrected: Saves to 'db' > 'manager_approved')
// =========================================================
async function updateManagerApprovalRecord(task, finalESN, finalPdfLink) {
    const safePO = (task.originalPO || task.po || 'NO_PO').replace(/[.#$[\]]/g, '_');
    const safeInv = (task.originalKey || task.key || 'NO_KEY');
    const recordKey = `${safePO}_${safeInv}`;

    // FIX: Use 'db' (ibainvoice-3ea51) as requested
    const dbRef = db.ref(`manager_approved/${recordKey}`);

    try {
        const snapshot = await dbRef.once('value');
        let data = snapshot.val() || {};

        let slotIndex = 1;
        if (data.esn_1) slotIndex = 2;
        if (data.esn_2) slotIndex = 3;
        
        const isCEO = (currentApprover.Position || '').toLowerCase().includes('ceo');
        if (isCEO) slotIndex = 'ceo';

        const updates = {
            po: task.originalPO || task.po,
            inv_no: task.ref || task.invNumber,
            [`esn_${slotIndex}`]: finalESN,
            [`pdf_${slotIndex}`]: finalPdfLink,
            [`approver_${slotIndex}`]: currentApprover.Name,
            [`date_${slotIndex}`]: new Date().toLocaleDateString('en-GB')
        };

        await dbRef.update(updates);
        console.log(`Saved Approval to Slot ${slotIndex} in ibainvoice-3ea51`);

    } catch (error) {
        console.error("Error saving manager approval:", error);
    }
}

// =========================================================
// 2. MANAGER RECEIPT (SAFE STRINGS FIX)
// =========================================================
async function previewAndSendManagerReceipt() {
    var mobileBtn = document.getElementById('mobile-send-manager-receipt-btn');
    var desktopBtn = document.getElementById('desktop-finalize-btn');

    var receiptWindow = null;
    try {
        receiptWindow = window.open('', '_blank');
        if (receiptWindow) {
            receiptWindow.document.write('<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;"><h3>Generating Receipt...</h3><p>Please wait...</p></body></html>');
        }
    } catch(e) { console.log("Popup blocked"); }

    if (mobileBtn) { mobileBtn.disabled = true; mobileBtn.textContent = 'Syncing...'; }
    if (desktopBtn) { desktopBtn.disabled = true; desktopBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...'; }

    try {
        var approvedTasks = managerProcessedTasks.filter(t => t.status === 'Approved');
        var rejectedTasks = managerProcessedTasks.filter(t => t.status === 'Rejected');

        if (approvedTasks.length === 0 && rejectedTasks.length === 0) {
            alert("No tasks to finalize.");
            if (receiptWindow) receiptWindow.close();
            if (mobileBtn) { mobileBtn.disabled = false; mobileBtn.innerHTML = '<span style="font-size: 1.2rem; margin-right: 5px;">🚨</span> Finalize & Send Receipt'; }
            if (desktopBtn) { desktopBtn.disabled = false; desktopBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Finalize Batch & Send Receipt'; }
            return;
        }

        var baseSeriesNo = await getManagerSeriesNumber();
        var approverName = currentApprover ? currentApprover.Name.toUpperCase().split(' ')[0] : 'ADMIN';
        var finalESN = baseSeriesNo + "/" + approverName;
        var safeFilename = finalESN.replace(/[^a-zA-Z0-9]/g, '_'); 
        var bucketName = "invoiceentry-b15a8.firebasestorage.app"; 
        // FIXED LINE
        var finalPdfLink = "https://firebasestorage.googleapis.com/v0/b/" + bucketName + "/o/receipts%2F" + safeFilename + ".pdf?alt=media";

        var updatePromises = approvedTasks.map(task => {
            var historyEntry = {
                action: "Receipt Generated",
                by: "System",
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                esn: finalESN,
                pdfLink: finalPdfLink,
                note: "Batch Finalized"
            };

            updateManagerApprovalRecord(task, finalESN, finalPdfLink);

            if (task.source === 'invoice') {
                // FIXED LINES
                var mainUpdate = invoiceDb.ref('invoice_entries/' + task.originalPO + '/' + task.originalKey).update({ esn: finalESN });
                var historyUpdate = invoiceDb.ref('invoice_entries/' + task.originalPO + '/' + task.originalKey + '/history').push(historyEntry);
                return Promise.all([mainUpdate, historyUpdate]);
            } 
            else if (task.source === 'job_entry') {
                // FIXED LINES
                var mainUpdate = db.ref('job_entries/' + task.key).update({ esn: finalESN });
                var historyUpdate = db.ref('job_entries/' + task.key + '/history').push(historyEntry);
                return Promise.all([mainUpdate, historyUpdate]);
            }
        });

        await Promise.all(updatePromises);

        approvedTasks.forEach(t => t.esn = finalESN);

        var receiptData = {
            title: "Manager Approval",
            approvedTasks: approvedTasks,
            rejectedTasks: rejectedTasks,
            seriesNo: finalESN,
            appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '4.5'
        };

        localStorage.setItem('pendingReceiptData', JSON.stringify(receiptData));

        if (receiptWindow) receiptWindow.location.href = 'receipt.html';
        else window.open('receipt.html', '_blank');

        managerProcessedTasks = [];
        var mCont = document.getElementById('mobile-receipt-action-container');
        if (mCont) mCont.classList.add('hidden');
        if (desktopBtn) desktopBtn.classList.add('hidden');

    } catch (error) {
        console.error("Error:", error);
        alert("Error syncing ESN.");
        if (receiptWindow) receiptWindow.close();
    } finally {
        if (mobileBtn) {
            mobileBtn.disabled = false;
            mobileBtn.innerHTML = '<span style="font-size: 1.2rem; margin-right: 5px;">🚨</span> Finalize & Send Receipt';
        }
        if (desktopBtn) {
            desktopBtn.disabled = false;
            desktopBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Finalize Batch & Send Receipt';
        }
    }
}

// 2. Transfer Receipt (Inventory) - Updated ESN
async function previewAndSendTransferReceipt() {
    const btn = document.getElementById('mobile-send-transfer-receipt-btn') || document.getElementById('send-transfer-approval-receipt-btn');
    if(btn) { btn.disabled = true; btn.textContent = 'Preparing...'; }

    try {
        let baseSeriesNo = (transferProcessedTasks.length > 0 && transferProcessedTasks[0].esn)
                         ? transferProcessedTasks[0].esn
                         : await getManagerSeriesNumber();

        // --- NEW: Append Name (if not exists) ---
        const approverName = currentApprover ? currentApprover.Name.toUpperCase().split(' ')[0] : 'ADMIN';
        let finalESN = baseSeriesNo;
        if (!finalESN.includes('/')) {
            finalESN = `${baseSeriesNo}/${approverName}`;
        }

        const receiptData = {
            title: "Authorize Transaction",
            approvedTasks: transferProcessedTasks,
            rejectedTasks: [],
            seriesNo: finalESN,
            isInventory: true,
            movement: (transferProcessedTasks.length > 0) ? transferProcessedTasks[0].movement : '',
            appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '4.5'
        };

        localStorage.setItem('pendingReceiptData', JSON.stringify(receiptData));
        window.open('receipt.html', '_blank');

        transferProcessedTasks = [];
        const mCont = document.getElementById('mobile-receipt-action-container');
        if (mCont) mCont.classList.add('hidden');

        document.querySelectorAll('#send-transfer-approval-receipt-btn, #mobile-send-transfer-receipt-btn').forEach(b => b.classList.add('hidden'));

    } catch (error) {
        console.error("Error:", error);
        alert("Error generating receipt.");
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-boxes-packing"></i> Send Transfer Receipt';
        }
    }
}

// =========================================================
// EVENT LISTENERS (Re-attached correctly)
// =========================================================

// Manager Button Listener
const mgrReceiptBtn = document.getElementById('mobile-send-manager-receipt-btn');
if(mgrReceiptBtn) {
    // Remove old listener to prevent duplicates
    mgrReceiptBtn.replaceWith(mgrReceiptBtn.cloneNode(true));
    document.getElementById('mobile-send-manager-receipt-btn').addEventListener('click', previewAndSendManagerReceipt);
}

// Transfer Button Listeners
const desktopTrfBtn = document.getElementById('send-transfer-approval-receipt-btn');
if (desktopTrfBtn) {
    desktopTrfBtn.addEventListener('click', async () => {
        await previewAndSendTransferReceipt();
        desktopTrfBtn.classList.add('hidden');
    });
}

const mobileTrfBtn = document.getElementById('mobile-send-transfer-receipt-btn');
if (mobileTrfBtn) {
    mobileTrfBtn.addEventListener('click', async () => {
        await previewAndSendTransferReceipt();
        mobileTrfBtn.classList.add('hidden');
    });
}

// ==========================================================================
// 9. WORKDESK LOGIC: JOB ENTRY (CRUD)
// ==========================================================================

// --- Form Reset & Dropdown Population ---


// #endregion BLOCK 14 — ACTIVE TASKS + MOBILE TASK CARDS


// =================================================================================================
// #region BLOCK 15 — JOB ENTRY FORM + VENDOR AUTOCOMPLETE + PERMISSIONS
// Purpose: Job entry reset/toggle, vendor suggestions, attention dropdown, site dropdown, CRUD, permission checks.
// =================================================================================================


// resetJobEntryForm moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).


// --- Helper: Toggle "Other" Input ---

// toggleJobOtherInput moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).
// --------------------------------------------------------------------------
// Invoice Job: Vendor + Invoice Date fields (Smart lookup from Vendors.csv)
// - Does NOT affect WorkDesk vs Inventory task separation logic.
// - Only shows for Job Type = Invoice.
// --------------------------------------------------------------------------

let __jobVendorNameToId = null;     // { normalizedName: id }
let __jobVendorDatalistBuilt = false;
let __jobVendorNamesSorted = null; // [displayName, ...] for suggestions

// Shared vendor search index (built once after Vendors.csv is loaded)
let __vendorSearchIndex = null; // [{ id, name, nameLower }]

// Floating suggestion portal (prevents clipping inside modals where overflow is hidden)
let __vendorSuggestPortalEl = null;
let __vendorSuggestPortalAnchor = null; // input element
let __vendorSuggestPortalOnPick = null; // function(name)
let __vendorSuggestPortalHideTimer = null;
let __vendorSuggestPortalDebounceTimer = null;


// ==========================================================================
// Job Vendor Suggestions / Autocomplete helpers
// Moved to js/app-job-vendor.js in v8.1.8
// ==========================================================================


// toggleJobInvoiceFields moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).
// Click selection for Vendor suggestions (fallback dropdown)
if (jobVendorSuggestBox) {
    jobVendorSuggestBox.addEventListener('mousedown', (e) => {
        const item = e.target && e.target.closest ? e.target.closest('.vendor-suggest-item') : null;
        if (!item) return;
        e.preventDefault();
        const name = (item.getAttribute('data-vendor-name') || item.textContent || '').trim();
        if (name && jobVendorNameInput) {
            jobVendorNameInput.value = name;
            syncJobVendorFromName();
        }
        hideJobVendorSuggest();
    });
}

// Click selection for Manual PO Vendor suggestions (fallback dropdown)
if (manualVendorSuggestBox) {
    manualVendorSuggestBox.addEventListener('mousedown', (e) => {
        const item = e.target && e.target.closest ? e.target.closest('.vendor-suggest-item') : null;
        if (!item) return;
        e.preventDefault();
        const name = (item.getAttribute('data-vendor-name') || item.textContent || '').trim();
        const nameInput = document.getElementById('manual-vendor-name');
        const idInput = document.getElementById('manual-supplier-id');
        if (name && nameInput) {
            nameInput.value = name;
            try {
                const id = (typeof getVendorIdByName === 'function') ? getVendorIdByName(name) : '';
                if (id && idInput) idInput.value = id;
            } catch (_) {}
        }
        if (typeof hideManualVendorSuggest === 'function') hideManualVendorSuggest();
    });
}

// Hook vendor fields to keep Name <-> ID in sync (Invoice only)
if (jobVendorNameInput) {
    jobVendorNameInput.addEventListener('focus', async () => {
        await ensureVendorsDataFetchedForJobEntry(false);
        buildJobVendorDatalistIfNeeded();
        // Show suggestions immediately if user already typed something
        if (typeof showJobVendorSuggest === 'function') showJobVendorSuggest(jobVendorNameInput.value);
    });

    jobVendorNameInput.addEventListener('change', () => {
        // change fires after picking from datalist
        syncJobVendorFromName();
        if (typeof hideJobVendorSuggest === 'function') hideJobVendorSuggest();
    });

    jobVendorNameInput.addEventListener('input', () => {
        // if user types exact match, sync immediately
        syncJobVendorFromName();
        if (typeof showJobVendorSuggest === 'function') showJobVendorSuggest(jobVendorNameInput.value);
    });

    jobVendorNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && typeof hideJobVendorSuggest === 'function') {
            hideJobVendorSuggest();
        }
    });

    jobVendorNameInput.addEventListener('blur', () => {
        // Delay hide so click selection works
        setTimeout(() => {
            if (typeof hideJobVendorSuggest === 'function') hideJobVendorSuggest();
        }, 120);
    });
}

if (jobVendorIdInput) {
    jobVendorIdInput.addEventListener('focus', async () => {
        await ensureVendorsDataFetchedForJobEntry(false);
        buildJobVendorDatalistIfNeeded();
    });
    jobVendorIdInput.addEventListener('input', () => {
        syncJobVendorFromId();
    });
    jobVendorIdInput.addEventListener('change', () => {
        syncJobVendorFromId();
    });
}


// =========================================================
// 1. DESKTOP APPROVAL (FINAL: NO WHATSAPP, AUTO-RETURN TO SENDER)
// =========================================================
async function handleDesktopApproval(task, action) {
    // 1. Prompt for Note
    var note = prompt("Enter optional note for " + action + ":", "");
    if (note === null) return; 

    // 2. Prepare Status Updates
    var updates = {
        status: action,
        remarks: action,
        note: note ? note.trim() : '',
        dateResponded: formatDate(new Date()),
        last_approver: currentApprover.Name,
        releaseDate: getTodayDateString(),
        statusChangedAt: firebase.database.ServerValue.TIMESTAMP,
        statusQueueAt: firebase.database.ServerValue.TIMESTAMP
    };

    // --- NEW LOGIC: RETURN TO SENDER ---
    // If Approved, send it back to the person who created it (e.g. Irwin)
    // so it appears in their Sidebar as "Approved" (Green).
    if (action === 'Approved') {
        // Default to 'Irwin' if enteredBy is missing
        updates.attention = task.enteredBy || 'Irwin'; 
    } 
    // If Rejected, also send back to sender so they know
    else if (action === 'Rejected') {
        updates.attention = task.enteredBy || 'Irwin';
    }

    if (task.attention) {
        updates.note = updates.note + " [Action by " + currentApprover.Name + "]";
    }

    var historyEntry = {
        action: action,
        by: currentApprover.Name,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        note: note || 'Desktop Action'
    };

    try {
        // 3. Update Database
        if (task.source === 'job_entry') {
            await db.ref('job_entries/' + task.key).update(updates);
            await db.ref('job_entries/' + task.key + '/history').push(historyEntry);
        } 
        else if (task.source === 'invoice') {
            await invoiceDb.ref('invoice_entries/' + task.originalPO + '/' + task.originalKey).update(updates);
            await invoiceDb.ref('invoice_entries/' + task.originalPO + '/' + task.originalKey + '/history').push(historyEntry);
            
            // Sync local cache & Move task to new owner (Sender)
            var originalInvoice = (allInvoiceData && allInvoiceData[task.originalPO]) ? allInvoiceData[task.originalPO][task.originalKey] : {};
            var updatedInvoiceData = { ...originalInvoice, ...updates };
            
            // This moves the task from Manager's Inbox -> Sender's Inbox
            await updateInvoiceTaskLookup(task.originalPO, task.originalKey, updatedInvoiceData, task.attention);
            updateLocalInvoiceCache(task.originalPO, task.originalKey, updates);
        }

        // 4. Add to Manager's Batch Queue (For Receipt)
        // Even though we sent it back, we keep a copy here for the Manager to print the receipt now.
        task.status = action;
        managerProcessedTasks.push(task);

        // 5. Reveal Finalize Button
        var desktopBtn = document.getElementById('desktop-finalize-btn');
        if (desktopBtn) {
            desktopBtn.classList.remove('hidden');
            desktopBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Finalize Batch & Send Receipt (' + managerProcessedTasks.length + ')';
        }

        // 6. Remove row from table (It's done for the Manager)
        var row = document.querySelector('tr[data-key="' + task.key + '"]');
        if (row) row.remove();

        var taskIndex = userActiveTasks.findIndex(t => t.key === task.key);
        if (taskIndex > -1) userActiveTasks.splice(taskIndex, 1);

        if (activeTaskCountDisplay) {
            activeTaskCountDisplay.textContent = '(Total Tasks: ' + userActiveTasks.length + ')';
        }

        console.log("Task " + task.key + " approved and returned to " + updates.attention);

    } catch (error) {
        console.error("Approval Error:", error);
        alert("Error saving approval.");
    }
}

// =========================================================
// CHECK DATABASE FOR PENDING RECEIPTS
// =========================================================
async function checkPendingReceipts() {
    // We scan your active tasks or a specific list to see if any are 'pending_receipt'
    // Since we just refreshed the tasks, we can check the local list 'userActiveTasks' 
    // BUT for "Approved" items, they might leave the 'Active' list.
    
    // For simplicity in this step, we will check the visual button visibility.
    // Ideally, we query Firebase, but let's start by showing the button if we just clicked approve.
    
    const receiptBtn = document.getElementById('desktop-send-receipt-btn'); 
    // (Ensure you have a button with this ID in your HTML Dashboard)
    
    if (receiptBtn) {
        receiptBtn.classList.remove('hidden');
        receiptBtn.innerHTML = '<i class="fa-solid fa-file-invoice"></i> Finalize & Send Receipt';
    }
}

// ==========================================================================
// UPDATED: populateAttentionDropdown (Manual Filter Simulation)
// Logic: 1. Default -> Shows ONLY Suggested Users.
//        2. Typing  -> Shows ONLY exact name matches (Clean & Fast).
// ==========================================================================
// populateAttentionDropdown moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// --- Helper: Populate Job Types Dynamically ---

// updateJobTypeDropdown moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).



// populateSiteDropdown moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).


// --- Table Rendering & Search ---


// renderJobEntryTable moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).


// ==========================================================================
// UPDATED FUNCTION: handleJobEntrySearch (Strict Inventory Filter)
// ==========================================================================

// handleJobEntrySearch moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).


// ==========================================================================
// UPDATED FUNCTION: getJobDataFromForm (Sets "New Entry" for Invoices)
// ==========================================================================
function getJobDataFromForm() {
    const formData = new FormData(jobEntryForm);
    let jobType = formData.get('for');

    // 1. Handle "Other" Logic
    if (jobType === 'Other') {
        const customType = document.getElementById('job-other-specify').value.trim();
        if (customType) {
            jobType = customType; 
        } else {
            alert("Please specify the Job Type in the text box.");
            return null; 
        }
    }

    // 2. CRITICAL FIX: Get Attention from Raw HTML
    const attentionEl = document.getElementById('job-attention');
    let finalAttention = attentionEl ? attentionEl.value : '';

    if (!finalAttention && typeof attentionSelectChoices !== 'undefined' && attentionSelectChoices) {
        finalAttention = attentionSelectChoices.getValue(true);
    }

    // 3. Determine Status
    // Default is 'Pending', BUT if it's an Invoice, we call it 'New Entry'
    let status = (formData.get('status') || 'Pending').trim();
    if (jobType === 'Invoice' && status === 'Pending') {
        status = 'New Entry';
    }
    if (jobType === 'IPC Application') {
        status = 'Pending';
    }
    // 10.1.6: a manually-created IPC Processed job means IPC is already done
    // and Reception is waiting for the actual invoice.
    if (jobType === 'IPC Processed' && (!status || status === 'Pending')) {
        status = 'Waiting Invoice';
    }

    // 4. Build Data Object
    const data = {
        for: jobType,
        ref: (formData.get('ref') || '').trim(),
        amount: formData.get('amount') || '',
        po: (formData.get('po') || '').trim(),
        site: formData.get('site'),
        // 10.1.5: Group / Category is invoice-only (Normal / Logistic / HSE).
        // IPC Application and IPC Processed must not carry a group/category.
        group: (jobType === 'Invoice') ? (formData.get('group') || '') : '',
        attention: finalAttention,
        date: document.getElementById('job-date').value || formatDate(new Date()),
        
        remarks: status, // <--- Uses the new logic

        details: (formData.get('details') || '').trim(),
        note: (formData.get('details') || '').trim(),
        calendarDate: (formData.get('calendarDate') || ''),
        productName: (document.getElementById('job-product-name')?.value || '').trim(),
        attachmentName: (document.getElementById('job-attachment').value || '').trim()
    };

    // 5. Invoice-only fields (safe: does not affect other job types)
    // 10.1.3: IPC / PR / Payment / Report jobs are not invoices yet, so they must not
    // carry an invoiceDate. When an IPC is later converted to Invoice, the real invoice
    // date can be entered on the Invoice form/workflow.
    if (jobType === 'Invoice') {
        data.invoiceDate = String(jobInvoiceDateInput?.value || '').trim();
        data.vendorName = String(jobVendorNameInput?.value || '').trim();
        data.vendorId = String(jobVendorIdInput?.value || '').trim();
    } else {
        data.invoiceDate = null;
        data.group = '';
    }

    return data;
}

// =========================================================
// HANDLER: ADD NEW JOB ENTRY (Fully Updated)
// Includes: Smart Vendor Search & Smart Accounting Assign
// =========================================================
async function handleAddJobEntry(e) {
    e.preventDefault();
    
    const btn = document.getElementById('add-job-button') || document.getElementById('btn-add-job');
    if (btn) btn.disabled = true;

    // 1. Collect Data from Form
    const jobData = getJobDataFromForm();
    if (!jobData) {
        if (btn) btn.disabled = false;
        return;
    }

    if (!jobData.for || !jobData.site || (jobData.for === 'Invoice' && !jobData.group)) {
        alert(jobData.for === 'Invoice' ? 'Please fill in Job, Site, and Group / Category.' : 'Please fill in Job and Site.');
        if (btn) btn.disabled = false;
        return;
    }

    if (jobData.for !== 'Invoice' && (!jobData.attention || jobData.attention === 'None')) {
        alert('Please select an Attention user.');
        if (btn) btn.disabled = false;
        return;
    }

    try {
        // 2.a Ensure Approver/Vacation data is fresh (so new entries route to the correct replacement)
        await ensureApproverDataCached(true);

        // 2. Ensure we have reference data (PO & Vendors)
        await ensureAllEntriesFetched(); 

        // =========================================================
        // LOGIC A: VENDOR RESOLUTION (Invoice-only manual fields + PO match fallback)
        // =========================================================
        const isInvoiceJob = (jobData.for === 'Invoice');

        // If Invoice: try to load Vendors.csv so we can sync Name <-> ID
        if (isInvoiceJob) {
            try {
                await ensureVendorsDataFetchedForJobEntry(false);
                buildJobVendorDatalistIfNeeded();
            } catch (_) {
                // non-blocking
            }

            // If user typed one field only, fill the other
            if (jobData.vendorId && !jobData.vendorName && allVendorsData && allVendorsData[jobData.vendorId]) {
                jobData.vendorName = allVendorsData[jobData.vendorId];
            }
            if (jobData.vendorName && !jobData.vendorId) {
                const idByName = getVendorIdByName(jobData.vendorName);
                if (idByName) jobData.vendorId = idByName;
            }
        }

        const hasManualVendor = isInvoiceJob && (
            (String(jobData.vendorName || '').trim() !== '') ||
            (String(jobData.vendorId || '').trim() !== '')
        );

        let poMatch = null;
        if (!hasManualVendor && jobData.po && allPOData && allPOData[jobData.po]) {
            poMatch = allPOData[jobData.po];
        }

        if (!hasManualVendor && poMatch) {
            // SCENARIO 1: PO Found in System -> Use CSV Data
            jobData.vendorName = poMatch['Supplier Name'] || 'N/A';
            // Best-effort: fill Vendor ID from Vendors.csv by name
            if (isInvoiceJob && !jobData.vendorId && jobData.vendorName && jobData.vendorName !== 'N/A') {
                const idByName = getVendorIdByName(jobData.vendorName);
                if (idByName) jobData.vendorId = idByName;
            }
        } else if (!hasManualVendor) {
            // SCENARIO 2: PO Not Found -> Use legacy Manual Dropdown (if present)
            if (typeof jobManualVendorChoices !== 'undefined' && jobManualVendorChoices) {
                const manualValue = jobManualVendorChoices.getValue(true); // Expecting "ID|Name"
                if (manualValue && manualValue.includes('|')) {
                    const [vId, vName] = manualValue.split('|');
                    jobData.vendorName = vName;
                    jobData.vendorId = vId;
                    jobData.isManualVendor = true;
                } else if (manualValue) {
                    jobData.vendorName = manualValue;
                }
            }

            // Final check: If it's an Invoice and still no vendor, warn user (Optional)
            if (isInvoiceJob && (!jobData.vendorName || jobData.vendorName === 'N/A') && !jobData.vendorId) {
                console.warn("Saving Invoice without Vendor (PO not found and no manual vendor entered).");
            }
        }

        // =========================================================
        // LOGIC B: STATUS & SMART ASSIGNMENT
        // =========================================================

        if (isInvoiceJob) {
            // 1. Force Status to "New Entry"
            jobData.remarks = 'New Entry'; 

            // 2. Smart Assign to Accounting (Irwin or Vacation Replacement)
            if (!jobData.attention) {
                if (typeof getAccountingUser === 'function') {
                    jobData.attention = getAccountingUser(); // <--- Uses your new Smart Function
                } else {
                    jobData.attention = 'Accounting'; // Safety fallback
                }
            }
        }

        // 3. Add Timestamps & User Info
        jobData.timestamp = firebase.database.ServerValue.TIMESTAMP;
        
        // Prefer logged-in approver name (Workdesk user)
        let currentUserName = (currentApprover && currentApprover.Name) ? String(currentApprover.Name).trim() : 'Admin';
        // Backward compatible: some modules set window.currentUser.username
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
            currentUserName = String(currentUser.username).trim() || currentUserName;
        } else if (window.currentUser && window.currentUser.username) {
            currentUserName = String(window.currentUser.username).trim() || currentUserName;
        }
        jobData.createdBy = currentUserName;
        // Explicitly track who entered it (used for Workdesk ownership / delete permission)
        jobData.enteredBy = (currentApprover && currentApprover.Name) ? String(currentApprover.Name).trim() : currentUserName;

        // =========================================================
        // LOGIC C: VACATION DELEGATION (All Users)
        // If the selected "attention" user is on vacation and has a replacement,
        // route this task to the replacement automatically (without changing other logic).
        if (typeof resolveVacationAssignee === 'function' && jobData.attention) {
            jobData.attention = resolveVacationAssignee(jobData.attention);
        }

// =========================================================
        // SAVE TO FIREBASE
        // =========================================================
        const newRef = await db.ref('job_entries').push(jobData);

        // Update Local Cache immediately so we don't need a hard refresh
        await ensureAllEntriesFetched(true); 

        // =========================================================
        // CLEANUP & UI RESET
        // =========================================================
        alert("New Job Added Successfully!");
        
        const modal = document.getElementById('standard-job-modal');
        if (modal) modal.classList.add('hidden');
        
        // Reset form and choices
        resetJobEntryForm();

        // Reload the task table to show the new entry
        if (typeof loadActiveTasks === 'function') loadActiveTasks();

    } catch (error) {
        console.error("Error adding job:", error);
        alert("Failed to save job. Check console for details.");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// =========================================================
// NEW HELPER: SMART ACCOUNTING ASSIGNMENT
// =========================================================

function getAccountingUser() {
    // 1. Safety Check: If users aren't loaded yet, default to Irwin (or Irwin's active replacement)
    if (typeof allUsersData === 'undefined' || !allUsersData || allUsersData.length === 0) {
        return resolveVacationAssignee('Irwin');
    }

    // 2. Find everyone with Position = 'Accounting' who is NOT 'Disabled'
    const accountingTeam = allUsersData.filter(user => {
        const pos = (user.Position || '').trim().toLowerCase();
        const status = (user.Status || '').trim().toLowerCase();
        return pos === 'accounting' && status !== 'disabled';
    });

    // 3. Priority: Irwin first (but delegate to replacement if Irwin is on vacation)
    const irwin = accountingTeam.find(u => (u.Name || '').toLowerCase() === 'irwin');
    if (irwin) return resolveVacationAssignee(irwin.Name);

    // 4. Next: first available accountant, delegating if they are on vacation
    for (const u of accountingTeam) {
        const name = (u.Name || '').trim();
        if (!name) continue;
        return resolveVacationAssignee(name);
    }

    // 5. Emergency Default
    return resolveVacationAssignee('Irwin');
}


function getWorkdeskInvoiceHandlerSafe() {
    let handler = '';
    if (typeof getInvoiceHandlerName === 'function') {
        handler = getInvoiceHandlerName();
    } else if (typeof getAccountingUser === 'function') {
        handler = getAccountingUser();
    }
    handler = String(handler || '').trim() || 'Irwin';
    return (typeof resolveVacationAssignee === 'function') ? resolveVacationAssignee(handler) : handler;
}

function getIPCReceptionReturnUser(entry = {}) {
    const preferred = String(entry.enteredBy || entry.createdBy || entry.requestor || '').trim();
    if (preferred && !['admin', 'system'].includes(preferred.toLowerCase())) {
        return (typeof resolveVacationAssignee === 'function') ? resolveVacationAssignee(preferred) : preferred;
    }

    try {
        if (typeof allApproverData !== 'undefined' && allApproverData) {
            const users = Object.values(allApproverData);
            const receptionUser = users.find(u => {
                const pos = String(u.Position || '').toLowerCase();
                const name = String(u.Name || '').toLowerCase();
                const status = String(u.Status || '').toLowerCase();
                return status !== 'disabled' && (pos.includes('reception') || name.includes('hafiz'));
            });
            if (receptionUser && receptionUser.Name) {
                return (typeof resolveVacationAssignee === 'function') ? resolveVacationAssignee(receptionUser.Name) : receptionUser.Name;
            }
        }
    } catch (_) {}

    return (typeof resolveVacationAssignee === 'function') ? resolveVacationAssignee('Hafiz') : 'Hafiz';
}


async function handleDeleteJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) {
        alert("No entry selected for deletion.");
        return;
    }

    // =========================================================
    // DELETE PERMISSIONS (SAFE, MINIMAL)
    // - Irwin (Accounting) can delete any job entry (existing behavior)
    // - Hafiz can ONLY delete Invoice job entries that he created AND
    //   that are still "New Entry" (no dateResponded yet)
    // =========================================================
    const canDeleteJobEntryForUser = (entry, user) => {
        const userName = (user?.Name || '').trim();
        const userPos = (user?.Position || '').trim().toLowerCase();

        const isIrwinAdmin = (userName === 'Irwin' && userPos === 'accounting');
        if (isIrwinAdmin) return true;

        // Hafiz limited permission (Invoice only, initial stage only)
        const userNameLower = String(userName || '').trim().toLowerCase();
        const isHafizUser = userNameLower.includes('hafiz');
        if (!isHafizUser) return false;

        const jobType = String(entry?.for || entry?.jobType || '').trim().toLowerCase();
        if (jobType !== 'invoice') return false;

        const creator = String(entry?.createdBy || entry?.enteredBy || entry?.requestor || '').trim().toLowerCase();

        // If the record has an explicit creator and it is not Hafiz (and not legacy/admin/system), block.
        if (creator && !creator.includes('hafiz') && !['admin','system'].includes(creator)) return false;

        // Only allow deleting duplicates that are still in the initial stage
        const remarks = String(entry?.remarks || '').trim().toLowerCase();
        const allowedRemarks = ['new entry', 'pending', ''];
        if (!allowedRemarks.includes(remarks)) return false;
        if (entry?.dateResponded) return false;

        return true;
    };

    // Get the entry data for permission checks (prefer local cache, fallback to DB)
    let entry = Array.isArray(allSystemEntries) ? allSystemEntries.find(en => en.key === currentlyEditingKey) : null;
    if (!entry) {
        try {
            const snap = await db.ref(`job_entries/${currentlyEditingKey}`).once('value');
            if (snap.exists()) entry = { ...(snap.val() || {}), key: currentlyEditingKey };
        } catch (err) {
            console.warn('Could not fetch entry for delete permission check:', err);
        }
    }

    if (!canDeleteJobEntryForUser(entry, currentApprover)) {
        alert("Access Denied: Only Irwin can permanently delete entries. Hafiz can delete only his own Invoice entries that are still 'New Entry'.");
        return;
    }

    if (!confirm("Are you sure you want to permanently delete this job entry? This action cannot be undone.")) {
        return;
    }

    try {
        await db.ref(`job_entries/${currentlyEditingKey}`).remove();

        alert('Job Entry Deleted Successfully!');

        await ensureAllEntriesFetched(true);
        handleJobEntrySearch(jobEntrySearchInput.value);

        // REPLACED: Close the modal instead of resetting the old form
        closeStandardJobModal();

        populateActiveTasks();

    } catch (error) {
        console.error("Error deleting job entry:", error);
        alert('Failed to delete Job Entry. Please try again.');
    }
}

// ==========================================================================
// CONFIGURATION: VACATION MODE SETTINGS
// ==========================================================================
// Change this name to your replacement (e.g., "Hafiz") when you go on vacation.
// This ensures all "New Entry" invoices go to the right person automatically.
// Invoice handler is dynamic (Irwin or vacation replacement)
// See getInvoiceHandlerName() near top.
 

// ==========================================================================
// UPDATED FUNCTION: handleUpdateJobEntry (Fixed "Gio" Bug + Fixed "Undefined" Crash)
// ==========================================================================
async function handleUpdateJobEntry(e) {
    if (e) e.preventDefault();

    if (!currentlyEditingKey) {
        alert("No entry selected for update.");
        return;
    }

    const btn = document.getElementById('update-job-button');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
    }

    const jobData = typeof getJobDataFromForm === 'function' ? getJobDataFromForm() : null;
    if (!jobData) {
        console.warn("getJobDataFromForm not found, check your code.");
        if (btn) { btn.disabled = false; btn.textContent = 'Update'; }
        return;
    }

    const normalizeJobType = (value) => String(value || '').trim();
    const getInvoiceHandlerSafe = () => {
        let handler = '';
        if (typeof getInvoiceHandlerName === 'function') {
            handler = getInvoiceHandlerName();
        } else if (typeof getAccountingUser === 'function') {
            handler = getAccountingUser();
        }
        handler = String(handler || '').trim() || 'Accounting';
        return (typeof resolveVacationAssignee === 'function') ? resolveVacationAssignee(handler) : handler;
    };

    try { await ensureApproverDataCached(true); } catch (err) { /* non-blocking */ }

    const newJobType = normalizeJobType(jobData.for);

    // 8.7.0: Robust IPC/Job Record -> Invoice conversion.
    // Invoice job records must always go back to Accounting/Invoice handler as a fresh
    // New Entry task. Old IPC dateResponded/status values must not make it look complete.
    if (newJobType === 'Invoice') {
        jobData.for = 'Invoice';
        jobData.remarks = 'New Entry';
        jobData.status = 'New Entry';
        jobData.attention = getInvoiceHandlerSafe();
    }

    if (!jobData.for || !jobData.site || (jobData.for === 'Invoice' && !jobData.group)) {
        alert(jobData.for === 'Invoice' ? 'Please fill in Job, Site, and Group / Category.' : 'Please fill in Job and Site.');
        if (btn) { btn.disabled = false; btn.textContent = 'Update'; }
        return;
    }

    if (jobData.for !== 'Invoice' && !jobData.attention) {
        alert('Please select an Attention user.');
        if (btn) { btn.disabled = false; btn.textContent = 'Update'; }
        return;
    }

    try {
        await ensureAllEntriesFetched(true);
        const originalEntry = allSystemEntries.find(entry => entry.key === currentlyEditingKey);
        const originalJobType = normalizeJobType(originalEntry?.for || originalEntry?.jobType || '');
        const convertedToInvoice = !!originalEntry && originalJobType !== 'Invoice' && jobData.for === 'Invoice';

        let noteOnlyEdit = false;
        let attentionChanged = false;
        let statusChanged = false;

        if (originalEntry) {
            const currentUser = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover.Name : 'System';
            jobData.enteredBy = originalEntry.enteredBy || currentUser;
            jobData.timestamp = originalEntry.timestamp || firebase.database.ServerValue.TIMESTAMP;

            // 10.1.2: Preserve the original Entered Date when editing an existing Job Entry.
            // The hidden job-date input can be blank in edit mode; getJobDataFromForm() may then
            // default it to today's date. That is correct only for a brand-new entry, not for edits.
            // IPC/Job Record -> Invoice conversion is a separate workflow and becomes a fresh
            // New Entry task, so that conversion can receive today's entered date.
            if (convertedToInvoice) {
                jobData.date = formatDate(new Date());
            } else {
                jobData.date = originalEntry.date || jobData.date || '';
            }

            // 10.1.3: Non-Invoice Job Entry records like IPC have no supplier invoice yet.
            // Clear any stale invoiceDate that may have been saved by an earlier version.
            // This also removes the wrong current-date invoiceDate from IPC records on the next save.
            if (jobData.for !== 'Invoice') {
                jobData.invoiceDate = null;
                jobData.group = '';
            }

            const originalAttention = String(originalEntry.attention || '').trim();
            const newAttention = String(jobData.attention || '').trim();
            const originalStatus = String(originalEntry.remarks || originalEntry.status || '').trim();
            const newStatus = String(jobData.remarks || jobData.status || '').trim();
            const originalNote = String(originalEntry.note || originalEntry.details || originalEntry.currentNote || '').trim();
            const newNote = String(jobData.note || jobData.details || '').trim();

            attentionChanged = newAttention !== originalAttention;
            statusChanged = newStatus !== originalStatus;

            const extraFieldsChanged = [
                'for', 'ref', 'amount', 'po', 'site', 'group', 'date',
                'vendorName', 'vendorId', 'invoiceDate', 'productName', 'attachmentName'
            ].some(function (field) {
                return String(jobData[field] || '').trim() !== String(originalEntry[field] || '').trim();
            });

            noteOnlyEdit = !convertedToInvoice && !attentionChanged && !statusChanged && !extraFieldsChanged && originalNote !== newNote;

            const currentUserName = String((typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover.Name : '').trim();
            const assignedUserIsUpdating = !!currentUserName && currentUserName === newAttention;
            const activeStatuses = new Set(['', 'Pending', 'New Entry', 'For SRV', 'For IPC', 'For Approval', 'Report', 'On Hold', 'In Process', 'Unresolved', 'Under Review', 'Manager Approved', 'Waiting Invoice', 'IPC Issue']);
            const completionStatuses = new Set(['With Accounts', 'SRV Done', 'PO Ready', 'Paid', 'CLOSED', 'Closed', 'Cancelled', 'Canceled']);

            if (convertedToInvoice) {
                // Critical: do not carry IPC/old response state into the new Invoice task.
                jobData.dateResponded = null;
                jobData.invoiceConvertedFrom = originalJobType || 'Job Record';
                jobData.invoiceConvertedAt = firebase.database.ServerValue.TIMESTAMP;
                jobData.invoiceConvertedBy = currentUser;
            } else if (attentionChanged) {
                // Reassignment creates a fresh task for the new Attention user.
                jobData.dateResponded = null;
            } else if (statusChanged && completionStatuses.has(newStatus) && assignedUserIsUpdating && !originalEntry.dateResponded) {
                const today = new Date();
                jobData.dateResponded = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, '0') + "-" + String(today.getDate()).padStart(2, '0');
            } else if (statusChanged && activeStatuses.has(newStatus)) {
                // If a record is moved back to an active queue, keep it visible.
                jobData.dateResponded = null;
            } else {
                // Dependability fix: editing Current Note/details alone must not complete or hide the task.
                jobData.dateResponded = originalEntry.dateResponded || null;
            }

            // 10.1.7: IPC workflow items remain active while pending/issue/waiting invoice.
            // Their dedicated IPC timestamps can be kept separately, but dateResponded must
            // not make them disappear from the responsible QS/Senior QS personal queue.
            const finalTypeForActiveCheck = String(jobData.for || '').trim();
            const finalStatusForActiveCheck = String(jobData.remarks || jobData.status || '').trim();
            if (
                (finalTypeForActiveCheck === 'IPC Application' && ['', 'Pending', 'IPC Issue'].includes(finalStatusForActiveCheck)) ||
                (finalTypeForActiveCheck === 'IPC Processed' && (!finalStatusForActiveCheck || finalStatusForActiveCheck === 'Waiting Invoice'))
            ) {
                jobData.dateResponded = null;
            }
        } else {
            const currentUser = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover.Name : 'System';
            jobData.enteredBy = currentUser;
            jobData.timestamp = firebase.database.ServerValue.TIMESTAMP;
            if (jobData.for === 'Invoice') jobData.dateResponded = null;
        }

        await db.ref(`job_entries/${currentlyEditingKey}`).update(jobData);
        const updaterName = (typeof currentApprover !== 'undefined') ? currentApprover.Name : "System";
        const cleanCurrentNote = String(jobData.note || jobData.details || '').trim();
        const historyNote = convertedToInvoice
            ? `Converted from ${originalJobType || 'Job Record'} to Invoice and routed to: ${jobData.attention}${cleanCurrentNote ? ' | Note: ' + cleanCurrentNote : ''}`
            : noteOnlyEdit
                ? `Updated Current Note${cleanCurrentNote ? ': ' + cleanCurrentNote : ''}`
                : `Updated${statusChanged ? ' Status to: ' + (jobData.remarks || jobData.status || 'Pending') : ''}${attentionChanged ? ' | Attention to: ' + jobData.attention : ''}${(!statusChanged && !attentionChanged && jobData.attention) ? ' Attention: ' + jobData.attention : ''}${cleanCurrentNote ? ' | Note: ' + cleanCurrentNote : ''}`;
        const historyEntry = {
            action: convertedToInvoice ? "Converted to Invoice" : (noteOnlyEdit ? "Updated Current Note" : "Updated"),
            by: updaterName,
            timestamp: Date.now(),
            status: jobData.remarks || "Updated",
            note: historyNote
        };
        await db.ref(`job_entries/${currentlyEditingKey}/history`).push(historyEntry);

        // 10.1.1: The Firebase update/history save is complete at this point.
        // Reset the button immediately before the heavier UI refresh so users do not
        // get stuck looking at "Saving..." and wondering if the record was saved.
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Update';
            btn.removeAttribute('disabled');
        }

        alert(convertedToInvoice ? 'Job converted to Invoice successfully!' : 'Job Updated Successfully!');

        if (typeof closeStandardJobModal === 'function') closeStandardJobModal();

        // Force all affected WorkDesk lists/cards to refresh after bucket changes.
        // This is intentionally separated from the actual save confirmation.
        try {
            allSystemEntries = [];
            if (typeof cacheTimestamps !== 'undefined') {
                cacheTimestamps.systemEntries = 0;
                cacheTimestamps.invoiceData = 0;
            }

            try {
                sessionStorage.removeItem('IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V1');
                localStorage.removeItem('IBA_WD_ACTIVE_DASHBOARD_CACHE_V1');
                if (typeof wdClearWorkdeskDashboardCache === 'function') wdClearWorkdeskDashboardCache();
            } catch (_) {}

            await ensureAllEntriesFetched(true);

            const currentSearch = sessionStorage.getItem('jobEntrySearch') || '';
            if (typeof handleJobEntrySearch === 'function') handleJobEntrySearch(currentSearch);
            if (typeof populateActiveTasks === 'function') await populateActiveTasks(true);
            if (typeof populateWorkdeskDashboard === 'function') await populateWorkdeskDashboard(true);
        } catch (refreshError) {
            console.warn('Job saved, but screen refresh was delayed or failed:', refreshError);
        }

    } catch (error) {
        console.error("Error updating job:", error);
        alert('Failed to update. Check console for details.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Update';
            btn.removeAttribute('disabled');
        }
    }
}

// ==========================================================================
// HELPER: Populate Form (Kept safe)
// ==========================================================================

// populateFormForEditing moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).


// ==========================================================================
// HELPER: Nav Controls (Kept safe)
// ==========================================================================

// updateJobEntryNavControls moved to js/app-workdesk-job-entry.js in v8.2.5 (cleanup only).


// ==========================================================================
// 10. WORKDESK LOGIC: REPORTING
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.database();

    // DOM Elements
    const navMaterialStock = document.getElementById('nav-material-stock');
    const materialStockSection = document.getElementById('wd-material-stock');
    const stockFormContainer = document.getElementById('material-stock-form-container');
    const stockTableBody = document.getElementById('material-stock-table-body');
    const stockSearchInput = document.getElementById('stock-table-search');

    const saveStockBtn = document.getElementById('save-stock-btn');
    const cancelStockBtn = document.getElementById('cancel-stock-btn');
    const stockQtyInput = document.getElementById('stock-qty');
    const transQtyInput = document.getElementById('stock-transferred-qty');
    const balanceDisplay = document.getElementById('stock-balance-display');
    const stockProductName = document.getElementById('stock-product-name');
    const stockDetails = document.getElementById('stock-details');
    const stockProductIdSelect = document.getElementById('stock-product-id');
    const stockFormTitle = document.getElementById('stock-form-title');
    const stockEntryMode = document.getElementById('stock-entry-mode');
    const stockEntryKey = document.getElementById('stock-entry-key');

    const addStockBtn = document.getElementById('add-stock-btn');
    const uploadStockCsvBtn = document.getElementById('upload-stock-csv-btn');
    const downloadStockTemplateBtn = document.getElementById('download-stock-template-btn');
    const stockCsvInput = document.getElementById('stock-csv-upload');

    // Job Entry Elements
    const jobForSelect = document.getElementById('job-for');
    const addJobBtn = document.getElementById('add-job-button');

    let currentUser = null;
    let isUserAdmin = false;
    let allStockDataCache = {};
    let tableDataCache = [];

    let editingTransferKey = null;

    let fromSiteChoices, toSiteChoices, contactChoices, operatorChoices;
    let trfProductChoices, stockProductChoices;
    let currentStockSearchText = "";

    


    // ==========================================================================
    // 1. PERMISSION & INITIALIZATION (FIXED)
    // ==========================================================================

    async function checkPermissions() {
        const key = localStorage.getItem('approverKey');
        if (!key) return;
        try {
            const snapshot = await db.ref(`approvers/${key}`).once('value');
            currentUser = snapshot.val();
            if (currentUser) {
                const position = (currentUser.Position || '').trim();
                const role = (currentUser.Role || '').toLowerCase();
                isUserAdmin = (role === 'admin');

                // --- SAFETY CHECK: Ensure navMaterialStock exists ---
                if (typeof navMaterialStock !== 'undefined' && navMaterialStock && (position === 'Site DC' || isUserAdmin)) {
                    navMaterialStock.classList.remove('hidden');
                }

                if (isUserAdmin) {
                    const addBtn = document.getElementById('ms-add-new-btn');
                    const uploadBtn = document.getElementById('ms-upload-csv-btn');
                    const templBtn = document.getElementById('ms-template-btn');

                    if (addBtn) addBtn.classList.remove('hidden');
                    if (uploadBtn) uploadBtn.classList.remove('hidden');
                    if (templBtn) templBtn.classList.remove('hidden');
                }
            }
        } catch (e) {
            console.error("Error checking permissions:", e);
        }
    }
    // Ensure this runs after DOM Load if possible, or keep as is
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkPermissions);
    } else {
        checkPermissions();
    }



    // ==============================================================
    // 3. JOB ENTRY: TRANSFER & SPECIAL TYPES HANDLER (FINAL)
    // ==============================================================

    if (jobForSelect) {
        jobForSelect.addEventListener('change', async (e) => {
            const jobType = e.target.value;

            // 1. DEFINE THE SPECIAL TYPES
            // This ensures Transfer, Restock, Return, AND Usage all trigger the new modal
            const transferTypes = ['Transfer', 'Restock', 'Return', 'Usage'];

            if (transferTypes.includes(jobType) && !(typeof isInventoryContext === 'function' && isInventoryContext())) {
                // 7.3.4 safety guard: WorkDesk is not allowed to create Inventory jobs.
                // This protects users who still have old cached dropdown options in the browser.
                e.target.value = '';
                if (typeof toggleJobOtherInput === 'function') toggleJobOtherInput();
                alert('Transfer / Restock / Return / Usage are Inventory task types. Please open Inventory Management to create them.');
                return;
            }

            if (transferTypes.includes(jobType)) {
                // A. Close the Standard Job Modal
                if (typeof closeStandardJobModal === 'function') {
                    closeStandardJobModal();
                } else {
                    document.getElementById('standard-job-modal').classList.add('hidden');
                }

                // B. Ensure required data is loaded
                if (typeof ensureAllEntriesFetched === 'function') {
                    await ensureAllEntriesFetched(false);
                }

                // C. Open the dedicated Transfer Modal
                setTimeout(() => {
                    if (typeof openTransferModal === 'function') {
                        openTransferModal(jobType);
                    } else {
                        console.error("Critical Error: openTransferModal not found.");
                        alert("System error: Transfer logic script is not loaded.");
                    }
                }, 150);

                // STOP HERE. Do not execute standard logic.
                return;
            }

            // ============================================================
            // 2. STANDARD JOB LOGIC (For Invoice, PR, IPC, etc.)
            // ============================================================

            const isInvoice = (jobType === 'Invoice');
            const isIPCApplication = (jobType === 'IPC Application');

            // Reset Attention Field based on type
            if (attentionSelectChoices) {
                attentionSelectChoices.enable();
                if (isInvoice) {
                    attentionSelectChoices.clearStore();
                    attentionSelectChoices.setChoices([{
                        value: '',
                        label: 'Auto-assigned to Irwin / Accounting',
                        disabled: true,
                        selected: true
                    }], 'value', 'label', false);
                    attentionSelectChoices.disable();
                } else if (isIPCApplication) {
                    // 10.1.5: IPC Application routes to site QS / Senior QS based on Position, not Role.
                    const selectedSite = (siteSelectChoices && typeof siteSelectChoices.getValue === 'function')
                        ? siteSelectChoices.getValue(true)
                        : (document.getElementById('job-site')?.value || '');
                    // 10.2.1: IPC Application should show the full QS/Senior QS list by default.
                    // Site matching was too strict and only showed one name when the selected site matched one QS.
                    // Keep search/labels available, but do not require the user to already know the QS name.
                    if (typeof populateAttentionDropdown === 'function') {
                        await populateAttentionDropdown(attentionSelectChoices, 'IPC Application', null, true);
                    }
                } else {
                    // Repopulate standard approvers
                    if (typeof populateAttentionDropdown === 'function') {
                        populateAttentionDropdown(attentionSelectChoices);
                    }
                }
            }

            // Handle "Other" Input Visibility
            if (typeof toggleJobOtherInput === 'function') {
                toggleJobOtherInput();
            }

            // Invoice-only vendor/date fields
            if (typeof toggleJobInvoiceFields === 'function') {
                await toggleJobInvoiceFields();
            }
        });
    }

    // ==========================================================================
    // 5. MATERIAL STOCK LOGIC (Unchanged)
    // ==========================================================================

    if (navMaterialStock) {
        navMaterialStock.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.workdesk-section').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.workdesk-navigation a').forEach(el => el.classList.remove('active'));
            materialStockSection.classList.remove('hidden');
            navMaterialStock.querySelector('a').classList.add('active');
            loadMaterialStock();
            populateProductDropdowns();
        });
    }
    if (stockSearchInput) {
        stockSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = tableDataCache.filter(item =>
                (item.productId && item.productId.toLowerCase().includes(term)) ||
                (item.productName && item.productName.toLowerCase().includes(term)) ||
                (item.details && item.details.toLowerCase().includes(term))
            );
            renderStockTable(filtered);
        });
    }
    if (addStockBtn) {
        addStockBtn.addEventListener('click', () => {
            stockFormContainer.classList.remove('hidden');
            stockFormTitle.textContent = "Create / Edit Item";
            stockEntryMode.value = 'new';
            stockEntryKey.value = '';
            if (stockProductChoices) {
                stockProductChoices.enable();
                stockProductChoices.clearStore();
                currentStockSearchText = "";
                populateProductDropdowns();
            }
            stockProductName.readOnly = false;
            stockProductName.style.backgroundColor = "";
            stockDetails.readOnly = false;
            stockDetails.style.backgroundColor = "";
            document.getElementById('stock-qty-label').textContent = "Stock QTY (Total)";
            clearStockForm();
        });
    }

// #endregion BLOCK 15 — JOB ENTRY FORM + VENDOR AUTOCOMPLETE + PERMISSIONS


// =================================================================================================
// #region BLOCK 16 — MATERIAL STOCK + MODIFY TASK MODAL
// Purpose: Stock add/edit/delete, material stock table, task modification modal/save.
// =================================================================================================

    window.openAddStockModal = function (key) {
        const item = tableDataCache.find(i => i.key === key);
        if (!item) return;
        stockFormContainer.classList.remove('hidden');
        stockFormTitle.textContent = "Stock In (Add Quantity)";
        stockEntryMode.value = 'add_qty';
        stockEntryKey.value = key;
        if (stockProductChoices) {
            stockProductChoices.setChoiceByValue(item.productId);
            stockProductChoices.disable();
        }
        stockProductName.value = item.productName;
        stockProductName.readOnly = true;
        stockProductName.style.backgroundColor = "#e9ecef";
        stockDetails.value = item.details;
        stockDetails.readOnly = true;
        stockDetails.style.backgroundColor = "#e9ecef";
        document.getElementById('stock-qty-label').textContent = "Add Qty (Increment)";
        stockQtyInput.value = "";
        stockQtyInput.placeholder = "Enter amount to ADD";
        stockQtyInput.focus();
        transQtyInput.parentElement.classList.add('hidden');
        balanceDisplay.parentElement.classList.add('hidden');
        saveStockBtn.textContent = "Confirm Add Stock";
    };
    if (cancelStockBtn) {
        cancelStockBtn.addEventListener('click', () => {
            stockFormContainer.classList.add('hidden');
            clearStockForm();
            transQtyInput.parentElement.classList.remove('hidden');
            balanceDisplay.parentElement.classList.remove('hidden');
        });
    }
    if (saveStockBtn) {
        saveStockBtn.addEventListener('click', async () => {
            const mode = stockEntryMode.value;
            const key = stockEntryKey.value;
            const inputQty = parseFloat(stockQtyInput.value) || 0;
            const pId = stockProductChoices ? stockProductChoices.getValue(true) : '';
            const pName = stockProductName.value;
            if (!pId || !pName) {
                alert("Product ID/Name required.");
                return;
            }
            saveStockBtn.textContent = "Saving...";
            saveStockBtn.disabled = true;
            try {
                if (mode === 'add_qty') {
                    if (inputQty <= 0) {
                        alert("Enter valid quantity.");
                        saveStockBtn.disabled = false;
                        return;
                    }
                    const snap = await db.ref(`material_stock/${key}`).once('value');
                    const cur = snap.val();
                    const newStock = (parseFloat(cur.stockQty) || 0) + inputQty;
                    const newBal = newStock - (parseFloat(cur.transferredQty) || 0);
                    await db.ref(`material_stock/${key}`).update({
                        stockQty: newStock,
                        balanceQty: newBal,
                        lastUpdated: firebase.database.ServerValue.TIMESTAMP
                    });
                    alert("Stock Added!");
                } else {
                    const trans = parseFloat(transQtyInput.value) || 0;
                    const bal = inputQty - trans;
                    const pl = {
                        productId: pId,
                        productName: pName,
                        details: stockDetails.value,
                        stockQty: inputQty,
                        transferredQty: trans,
                        balanceQty: bal,
                        lastUpdated: firebase.database.ServerValue.TIMESTAMP
                    };
                    if (mode === 'edit' && key) await db.ref(`material_stock/${key}`).update(pl);
                    else {
                        pl.updatedBy = currentUser.Name;
                        await db.ref('material_stock').push(pl);
                    }
                    alert("Saved!");
                }
                stockFormContainer.classList.add('hidden');
                clearStockForm();
                transQtyInput.parentElement.classList.remove('hidden');
                balanceDisplay.parentElement.classList.remove('hidden');
                loadMaterialStock();
                populateProductDropdowns();
            } catch (e) {
                alert("Failed.");
            } finally {
                saveStockBtn.disabled = false;
            }
        });
    }
    function clearStockForm() {
        if (stockProductChoices) {
            stockProductChoices.enable();
            stockProductChoices.removeActiveItems();
        }
        currentStockSearchText = "";
        stockProductName.value = "";
        stockProductName.readOnly = false;
        stockProductName.style.backgroundColor = "";
        stockDetails.value = "";
        stockDetails.readOnly = false;
        stockDetails.style.backgroundColor = "";
        stockQtyInput.value = "";
        transQtyInput.value = "0";
        balanceDisplay.textContent = "0";
        stockEntryMode.value = "new";
        stockEntryKey.value = "";
    }
    async function loadMaterialStock() {
        stockTableBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        try {
            const snap = await db.ref('material_stock').once('value');
            const data = snap.val();
            tableDataCache = [];
            if (!data) {
                stockTableBody.innerHTML = '<tr><td colspan="7">No records.</td></tr>';
                return;
            }
            Object.entries(data).forEach(([k, v]) => tableDataCache.push({
                key: k,
                ...v
            }));
            renderStockTable(tableDataCache);
        } catch (e) {
            stockTableBody.innerHTML = '<tr><td colspan="7">Error.</td></tr>';
        }
    }
    function renderStockTable(data) {
        stockTableBody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement('tr');
            const bal = parseFloat(item.balanceQty) || 0;
            if (bal <= 0) row.style.backgroundColor = '#ffe6e6';
            const balDisp = bal <= 0 ? `<span style="color:#dc3545;font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> ${bal}</span>` : `<span style="font-weight:bold;color:#003A5C;">${bal}</span>`;
            let acts = `<button class="secondary-btn" onclick="openAddStockModal('${item.key}')" style="padding:4px 10px;font-size:12px;background-color:#28a745;color:white;margin-right:5px;">Add</button>`;
            if (isUserAdmin) acts += `<button class="secondary-btn" onclick="deleteStock('${item.key}')" style="padding:4px 10px;font-size:12px;background-color:#dc3545;color:white;">Delete</button>`;
            row.innerHTML = `<td>${item.productId}</td><td>${item.productName}</td><td>${item.details}</td><td>${item.stockQty}</td><td>${item.transferredQty}</td><td>${balDisp}</td><td>${acts}</td>`;
            stockTableBody.appendChild(row);
        });
    }
    window.deleteStock = async function (key) {
        if (confirm("Delete?")) {
            await db.ref(`material_stock/${key}`).remove();
            loadMaterialStock();
            populateProductDropdowns();
        }
    };

    // CSV Logic
    if (downloadStockTemplateBtn) {
        downloadStockTemplateBtn.addEventListener('click', () => {
            const headers = ["Product ID", "Product Name", "Details", "Stock QTY"];
            const exampleRow = ["P-1001", "Cement Bags", "50kg Grey Cement", "100"];
            const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + exampleRow.join(",");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "material_stock_template.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
    if (stockCsvInput) {
        stockCsvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const lines = event.target.result.split('\n').filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    alert("CSV empty.");
                    return;
                }
                let successCount = 0;
                const updates = {};
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(val => val.trim().replace(/^"|"$/g, ''));
                    if (values.length >= 2) {
                        const newKey = db.ref('material_stock').push().key;
                        updates[newKey] = {
                            productId: values[0],
                            productName: values[1],
                            details: values[2] || '',
                            stockQty: parseFloat(values[3]) || 0,
                            transferredQty: 0,
                            balanceQty: parseFloat(values[3]) || 0,
                            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
                            updatedBy: currentUser.Name
                        };
                        successCount++;
                    }
                }
                if (successCount > 0) {
                    try {
                        await db.ref('material_stock').update(updates);
                        alert(`Uploaded ${successCount} records.`);
                        loadMaterialStock();
                        populateProductDropdowns();
                    } catch (err) {
                        alert("Error writing DB.");
                    }
                }
                stockCsvInput.value = '';
            };
            reader.readAsText(file);
        });
    }
});

// ==========================================================================
// 11. TASK MODIFICATION (Modal Logic)
// ==========================================================================


function wdSetModifyTaskStatusOptions(optionValues, selectedValue = '') {
    if (!modifyTaskStatus) return;
    const current = selectedValue || modifyTaskStatus.value || '';
    modifyTaskStatus.innerHTML = '<option value="" disabled>Select new status...</option>';
    (optionValues || []).forEach(item => {
        const value = typeof item === 'string' ? item : item.value;
        const label = typeof item === 'string' ? item : (item.label || item.value);
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        modifyTaskStatus.appendChild(opt);
    });
    if (current && Array.from(modifyTaskStatus.options).some(opt => opt.value === current)) {
        modifyTaskStatus.value = current;
    } else if (optionValues && optionValues.length) {
        const first = typeof optionValues[0] === 'string' ? optionValues[0] : optionValues[0].value;
        modifyTaskStatus.value = first || '';
    }
}

function wdSetModifyTaskAttentionValue(value) {
    const finalValue = String(value || '').trim();
    if (!modifyTaskAttentionChoices || !finalValue) return;
    try {
        const hasChoice = modifyTaskAttentionChoices._store?.choices?.some(c => c.value === finalValue);
        if (!hasChoice) {
            modifyTaskAttentionChoices.setChoices([{ value: finalValue, label: finalValue }], 'value', 'label', false);
        }
        modifyTaskAttentionChoices.setChoiceByValue(finalValue);
    } catch (_) {
        try { modifyTaskAttentionChoices.setChoiceByValue(finalValue); } catch (__) {}
    }
}

function wdToggleModifyTaskInvoiceConvertFields() {
    const wrap = document.getElementById('modify-task-invoice-convert-fields');
    if (!wrap || !modifyTaskStatus) return;
    const show = modifyTaskStatus.value === 'Convert to Invoice';
    wrap.classList.toggle('hidden', !show);
}

function wdApplyIPCModifyTaskAutomation() {
    const taskData = window.currentModifyTaskData || {};
    if (!taskData || taskData.source !== 'job_entry' || !modifyTaskStatus) {
        wdToggleModifyTaskInvoiceConvertFields();
        return;
    }

    const jobType = String(taskData.for || taskData.type || '').trim();
    const selected = modifyTaskStatus.value;
    const originalAttention = String(taskData.attention || '').trim();

    // 10.1.7: IPC Application and IPC Processed remain QS/Senior QS responsibility.
    // Reception may update the record/status, but the system must not automatically
    // return IPC Processed to Reception. Only Convert to Invoice routes to Irwin/Accounting.
    if (jobType === 'IPC Application') {
        if (selected === 'IPC Done' || selected === 'IPC Issue') {
            wdSetModifyTaskAttentionValue(originalAttention);
        }
    }

    if (jobType === 'IPC Processed' || jobType === 'IPC') {
        if (selected === 'Waiting Invoice') {
            wdSetModifyTaskAttentionValue(originalAttention);
        } else if (selected === 'Convert to Invoice') {
            wdSetModifyTaskAttentionValue(getWorkdeskInvoiceHandlerSafe());
        }
    }

    wdToggleModifyTaskInvoiceConvertFields();
}

function openModifyTaskModal(taskData) {
    if (!taskData) return;
    window.currentModifyTaskData = taskData;

    // 1. Set Keys & Identifiers
    modifyTaskKey.value = taskData.key;
    modifyTaskSource.value = taskData.source;
    modifyTaskOriginalPO.value = taskData.originalPO || '';
    modifyTaskOriginalKey.value = taskData.originalKey || '';
    
    document.getElementById('modify-task-originalAttention').value = taskData.attention || '';
    modifyTaskNote.value = taskData.note || '';

    const convertFields = document.getElementById('modify-task-invoice-convert-fields');
    const convertInvoiceDate = document.getElementById('modify-task-invoice-date');
    const convertInvoiceGroup = document.getElementById('modify-task-invoice-group');
    if (convertFields) convertFields.classList.add('hidden');
    if (convertInvoiceDate) convertInvoiceDate.value = '';
    if (convertInvoiceGroup) convertInvoiceGroup.value = '';

    if (modifyTaskStatus && !modifyTaskStatus._ibaIpcAutomationBound) {
        modifyTaskStatus._ibaIpcAutomationBound = true;
        modifyTaskStatus.addEventListener('change', wdApplyIPCModifyTaskAutomation);
    }

    // Identify User Role
    const userPos = (currentApprover.Position || '').toLowerCase();
    const isFinance = userPos.includes('finance');

    // 2. SMART AUTOMATION LOGIC
    // -------------------------------------------------

    const taskJobType = String(taskData.for || taskData.type || '').trim();
    const taskStatusText = String(taskData.remarks || taskData.status || '').trim();
    const isIPCApplicationTask = taskData.source === 'job_entry' && taskJobType === 'IPC Application';
    const isIPCProcessedTask = taskData.source === 'job_entry' && (taskJobType === 'IPC Processed' || taskJobType === 'IPC');

    if (isIPCApplicationTask) {
        wdSetModifyTaskStatusOptions([
            { value: 'IPC Done', label: 'IPC Done' },
            { value: 'IPC Issue', label: 'IPC Issue' },
            { value: 'Other', label: 'Other (Specify)' }
        ], taskStatusText === 'IPC Issue' ? 'IPC Issue' : 'IPC Done');
        modifyTaskStatusOtherContainer.classList.add('hidden');
        if (modifyTaskAttentionChoices) wdSetModifyTaskAttentionValue(taskData.attention || '');
        wdApplyIPCModifyTaskAutomation();
    }
    else if (isIPCProcessedTask) {
        wdSetModifyTaskStatusOptions([
            { value: 'Waiting Invoice', label: 'Waiting Invoice' },
            { value: 'Convert to Invoice', label: 'Convert to Invoice' },
            { value: 'Other', label: 'Other (Specify)' }
        ], taskStatusText === 'Convert to Invoice' ? 'Convert to Invoice' : 'Waiting Invoice');
        modifyTaskStatusOtherContainer.classList.add('hidden');
        if (modifyTaskAttentionChoices) wdSetModifyTaskAttentionValue(taskData.attention || '');
        wdApplyIPCModifyTaskAutomation();
    }
    // SCENARIO A: FINANCE USER (Status is "Report Approval" -> Send back to Creator)
    else if (isFinance && (taskData.remarks === 'Report Approval')) {
        // Auto-set Status
        modifyTaskStatus.value = 'Report Approved';
        modifyTaskStatusOtherContainer.classList.add('hidden');

        // Auto-set Attention to SENDER (Creator)
        if (modifyTaskAttentionChoices) {
            const originalSender = taskData.enteredBy || 'Accounting';
            modifyTaskAttentionChoices.setChoiceByValue(originalSender);
        }
    }
    // SCENARIO B: MANAGER / SITE (Status is "Report" OR "Report Approval" -> Send to Finance)
    else if (taskData.remarks === 'Report' || taskData.remarks === 'Report Approval') {
        // Auto-set Status
        modifyTaskStatus.value = 'Report Approval';
        modifyTaskStatusOtherContainer.classList.add('hidden'); 

        // Auto-set Attention to FINANCE
        if (modifyTaskAttentionChoices) {
            let financeUser = null;
            if (typeof allApproverData !== 'undefined' && allApproverData) {
                // Find user with 'Finance' in position
                financeUser = Object.values(allApproverData).find(u => 
                    (u.Position && u.Position.toLowerCase().includes('finance'))
                );
            }
            if (financeUser) {
                modifyTaskAttentionChoices.setChoiceByValue(financeUser.Name);
            }
        }
    } 
    // SCENARIO C: STANDARD / DEFAULT
    else {
        if (modifyTaskAttentionChoices) {
            modifyTaskAttentionChoices.setChoiceByValue(taskData.attention || '');
        }

        const currentStatus = taskData.remarks || 'Pending';
        const statusOption = modifyTaskStatus.querySelector(`option[value="${currentStatus}"]`);
        
        if (statusOption) {
            modifyTaskStatus.value = currentStatus;
            modifyTaskStatusOtherContainer.classList.add('hidden');
        } else {
            modifyTaskStatus.value = 'Other';
            modifyTaskStatusOtherContainer.classList.remove('hidden');
            modifyTaskStatusOther.value = currentStatus;
        }
    }

    // 3. VIEW REPORT BUTTON LOGIC
    // ----------------------------------------
    const reportBtnContainer = document.getElementById('modify-task-report-actions');
    const reportBtn = document.getElementById('btn-view-finance-report-modal');
    
    const reportStatuses = ['Report', 'Report Approval', 'Report Approved'];
    const isReportTask = (taskData.source === 'invoice') && reportStatuses.includes(taskData.remarks);

    if (reportBtnContainer && reportBtn) {
        if (isReportTask) {
            reportBtnContainer.classList.remove('hidden');
            
            const newBtn = reportBtn.cloneNode(true);
            reportBtn.parentNode.replaceChild(newBtn, reportBtn);

            newBtn.addEventListener('click', async () => {
                const po = taskData.originalPO || taskData.po;
                if (!po) { alert("PO Number missing."); return; }

                if (!allPOData) await ensureInvoiceDataFetched();
                const poData = allPOData[po] || {};
                
                await generateFinanceReport({
                    poNo: po,
                    poValue: poData.Amount || 0,
                    site: poData['Project ID'] || '',
                    vendor: poData['Supplier Name'] || ''
                });
                
                const reportModal = document.getElementById('im-finance-report-modal');
                if (reportModal) reportModal.classList.remove('hidden');
            });

        } else {
            reportBtnContainer.classList.add('hidden');
        }
    }

    if (modifyTaskSaveBtn) {
        modifyTaskSaveBtn.textContent = "Confirm Action";
    }

    modifyTaskModal.classList.remove('hidden');
}

async function handleSaveModifiedTask() {
    const key = modifyTaskKey.value;
    const source = modifyTaskSource.value;
    const originalPO = modifyTaskOriginalPO.value;
    const originalKey = modifyTaskOriginalKey.value;
    const originalAttentionEl = document.getElementById('modify-task-originalAttention');
    const originalAttention = originalAttentionEl ? originalAttentionEl.value : '';

    if (!key || !source) {
        alert("Error: Task identifiers are missing.");
        return;
    }

    let selectedStatus = modifyTaskStatus.value;
    if (selectedStatus === 'Other') {
        selectedStatus = modifyTaskStatusOther.value.trim();
        if (!selectedStatus) {
            alert("Please enter a custom status.");
            return;
        }
    }

    if (!selectedStatus) {
        alert("Please select a new status.");
        return;
    }

    const updates = {
        attention: modifyTaskAttentionChoices.getValue(true) || '',
        remarks: selectedStatus,
        status: selectedStatus,
        note: modifyTaskNote.value.trim()
    };

    try { await ensureApproverDataCached(true); } catch (e) { /* ignore */ }

    if (updates.attention && updates.attention !== 'All' && updates.attention !== 'None') {
        try {
            if (typeof resolveVacationAssignee === 'function') {
                const resolved = resolveVacationAssignee(updates.attention);
                if (resolved && resolved !== updates.attention) {
                    updates.attention = resolved;
                }
            }
        } catch (e) { /* ignore */ }
    }

    if (updates.status === 'Under Review' || updates.status === 'With Accounts') {
        updates.attention = '';
    }

    modifyTaskSaveBtn.disabled = true;
    modifyTaskSaveBtn.textContent = 'Saving...';

    try {
        if (source === 'invoice' && originalPO && originalKey) {
            if (currentApprover && currentApprover.Position) {
                const isFinance = currentApprover.Position.toLowerCase().includes('finance');
                if (isFinance && updates.status === 'Report Approval') {
                    updates.status = 'Report Approved';
                    updates.remarks = 'Report Approved';
                    let accountingUser = null;
                    if (typeof allApproverData !== 'undefined') {
                        accountingUser = Object.values(allApproverData).find(u =>
                            u.Position && (u.Position.toLowerCase().includes('accounting') || u.Position.toLowerCase().includes('accounts'))
                        );
                    }
                    const accName = (typeof getAccountingUser === 'function') ? getAccountingUser() : (accountingUser ? accountingUser.Name : 'Accounting');
                    updates.attention = (typeof resolveVacationAssignee === 'function') ? resolveVacationAssignee(accName) : accName;
                    alert("Finance Approval Confirmed. Routing back to Accounting for printing.");
                }
            }

            if (typeof updateReportWorkflow === 'function') {
                await updateReportWorkflow(originalPO, originalKey, updates.status, currentApprover, updates.attention);
            } else {
                throw new Error("Helper function 'updateReportWorkflow' is missing from app.js!");
            }

            // === SYNC LINKED JOB ENTRY ===
            await updateLinkedJobEntry(originalPO, originalKey, selectedStatus, modifyTaskNote.value);
        }

        if (source === 'job_entry') {
            await ensureAllEntriesFetched(true);
            const originalEntry = allSystemEntries.find(entry => entry.key === key) || {};
            const originalFor = String(originalEntry.for || '').trim();
            const selectedStatusNorm = String(selectedStatus || '').trim();
            const todayStr = formatDate(new Date());
            const nowTs = firebase.database.ServerValue.TIMESTAMP;
            let historyAction = 'Task Updated';
            let historyNote = '';

            if (originalFor === 'IPC Application' && selectedStatusNorm === 'IPC Done') {
                const responsibleUser = originalEntry.attention || updates.attention || '';
                updates.for = 'IPC Processed';
                updates.remarks = 'Waiting Invoice';
                updates.status = 'Waiting Invoice';
                updates.attention = responsibleUser;
                updates.invoiceDate = null;
                updates.group = '';
                updates.ipcDoneDate = todayStr;
                updates.ipcDoneAt = nowTs;
                // 10.1.7: keep IPC Processed active for QS/Senior QS follow-up.
                // ipcDoneDate/ipcDoneAt records the action time; dateResponded stays null
                // so it does not disappear from the responsible QS personal queue.
                updates.dateResponded = null;
                updates.statusChangedAt = nowTs;
                updates.statusQueueAt = nowTs;
                updates.queueAt = nowTs;
                historyAction = 'IPC Done';
                historyNote = `Marked IPC Done and changed to IPC Processed / Waiting Invoice. Responsibility remains with: ${responsibleUser}${updates.note ? ' | Note: ' + updates.note : ''}`;
            } else if (originalFor === 'IPC Application' && selectedStatusNorm === 'IPC Issue') {
                updates.for = 'IPC Application';
                updates.remarks = 'IPC Issue';
                updates.status = 'IPC Issue';
                updates.attention = originalEntry.attention || updates.attention || '';
                updates.invoiceDate = null;
                updates.group = '';
                updates.dateResponded = null;
                updates.statusChangedAt = nowTs;
                historyAction = 'IPC Issue';
                historyNote = `Marked IPC Issue${updates.note ? ' | Note: ' + updates.note : ''}`;
            } else if ((originalFor === 'IPC Processed' || originalFor === 'IPC') && selectedStatusNorm === 'Convert to Invoice') {
                const invoiceDate = String(document.getElementById('modify-task-invoice-date')?.value || '').trim();
                const invoiceGroup = String(document.getElementById('modify-task-invoice-group')?.value || '').trim();
                if (!invoiceDate) throw new Error('Please enter the Invoice Date before converting to Invoice.');
                if (!invoiceGroup) throw new Error('Please select Group / Category before converting to Invoice.');

                updates.for = 'Invoice';
                updates.remarks = 'New Entry';
                updates.status = 'New Entry';
                updates.attention = getWorkdeskInvoiceHandlerSafe();
                updates.invoiceDate = invoiceDate;
                updates.group = invoiceGroup;
                updates.date = todayStr;
                updates.dateResponded = null;
                updates.invoiceConvertedFrom = originalFor || 'IPC Processed';
                updates.invoiceConvertedAt = nowTs;
                updates.invoiceConvertedBy = currentApprover?.Name || 'System';
                updates.statusChangedAt = nowTs;
                updates.statusQueueAt = nowTs;
                updates.queueAt = nowTs;
                historyAction = 'Converted to Invoice';
                historyNote = `Converted IPC Processed to Invoice and routed to: ${updates.attention} | Group: ${invoiceGroup} | Invoice Date: ${invoiceDate}${updates.note ? ' | Note: ' + updates.note : ''}`;
            } else if ((originalFor === 'IPC Processed' || originalFor === 'IPC') && selectedStatusNorm === 'Waiting Invoice') {
                updates.for = 'IPC Processed';
                updates.remarks = 'Waiting Invoice';
                updates.status = 'Waiting Invoice';
                updates.attention = originalEntry.attention || updates.attention || '';
                updates.invoiceDate = null;
                updates.group = '';
                // 10.1.7: IPC Processed remains an active QS/Senior QS follow-up task.
                // Preserve the dedicated IPC done timestamp if present, but do not use
                // dateResponded as completion for this waiting-invoice stage.
                updates.dateResponded = null;
                historyAction = 'Waiting Invoice';
                historyNote = `IPC Processed remains waiting for invoice under: ${updates.attention || 'current Attention'}${updates.note ? ' | Note: ' + updates.note : ''}`;
            } else {
                if (originalEntry && currentApprover.Name === (originalEntry.attention || '') && updates.attention === originalEntry.attention) {
                    updates.dateResponded = formatDate(new Date());
                } else if (updates.attention !== (originalEntry ? originalEntry.attention : '')) {
                    updates.dateResponded = null;
                }
                if (String(updates.for || originalFor) !== 'Invoice') {
                    updates.invoiceDate = null;
                    updates.group = '';
                }
                historyNote = `Updated Status to: ${updates.remarks || updates.status || ''}${updates.attention ? ' | Attention: ' + updates.attention : ''}${updates.note ? ' | Note: ' + updates.note : ''}`;
            }

            await db.ref(`job_entries/${key}`).update(updates);
            await db.ref(`job_entries/${key}/history`).push({
                action: historyAction,
                by: currentApprover?.Name || 'System',
                timestamp: Date.now(),
                status: updates.remarks || updates.status || selectedStatusNorm,
                note: historyNote || `Updated Status to: ${updates.remarks || updates.status || selectedStatusNorm}`
            });
            allSystemEntries = [];
        } else if (source === 'invoice' && originalPO && originalKey) {
            if (!allInvoiceData) await ensureInvoiceDataFetched();
            const originalInvoice = (allInvoiceData && allInvoiceData[originalPO]) ? allInvoiceData[originalPO][originalKey] : {};
            const oldInvoiceStatus = String((originalInvoice && originalInvoice.status) || '').trim();
            const newInvoiceStatus = String(updates.status || '').trim();
            if (newInvoiceStatus && oldInvoiceStatus !== newInvoiceStatus) {
                updates.releaseDate = getTodayDateString();
                updates.statusChangedAt = firebase.database.ServerValue.TIMESTAMP;
                updates.statusQueueAt = firebase.database.ServerValue.TIMESTAMP;
                if (newInvoiceStatus.toLowerCase().includes('srv')) {
                    updates.forSrvAt = firebase.database.ServerValue.TIMESTAMP;
                    updates.sentToSrvAt = firebase.database.ServerValue.TIMESTAMP;
                }
                if (newInvoiceStatus.toLowerCase().includes('report')) {
                    updates.reportAt = firebase.database.ServerValue.TIMESTAMP;
                    updates.sentToReportAt = firebase.database.ServerValue.TIMESTAMP;
                }
            }
            await invoiceDb.ref(`invoice_entries/${originalPO}/${originalKey}`).update(updates);
            const updatedInvoiceData = { ...originalInvoice, ...updates };
            await updateInvoiceTaskLookup(originalPO, originalKey, updatedInvoiceData, originalAttention);
            updateLocalInvoiceCache(originalPO, originalKey, updates);
            if (window.logInvoiceHistory) {
                await window.logInvoiceHistory(originalPO, originalKey, updates.status, updates.note);
            }
        }

        alert("Task updated successfully!");
        modifyTaskModal.classList.add('hidden');
        await populateActiveTasks();
    } catch (error) {
        console.error("Detailed Error:", error);
        alert("Update Failed: " + error.message);
    } finally {
        modifyTaskSaveBtn.disabled = false;
        modifyTaskSaveBtn.textContent = 'Confirm Action';
    }
}

// ==========================================================================
// 12. INVOICE MANAGEMENT: HELPERS (INBOX SYNC)
// ==========================================================================


// #endregion BLOCK 16 — MATERIAL STOCK + MODIFY TASK MODAL


// =================================================================================================
// #region BLOCK 17 — INVOICE TASK LOOKUP + INVOICE ENTRY MODAL
// Purpose: Invoice task activity, PO details sync, lookup updates, invoice modal reset/open/close, PO search, invoice CRUD.
// =================================================================================================

// isInvoiceTaskActive moved to js/app-invoice.js (7.6.1)




// -------------------------------------------------------------
// PO DETAILS RESOLVER (CSV allPOData + Firebase purchase_orders)
// Supports purchase_orders keyed by PO OR stored under push-ids with child "Po"/"PO".
// Canonical output keys: "Supplier Name", "Project ID", "Amount"
// -------------------------------------------------------------
// __invoicePOCache moved to js/app-invoice.js (7.6.1)

// __normalizePOKey moved to js/app-invoice.js (7.6.1)

// __normalizePODetails moved to js/app-invoice.js (7.6.1)

// getInvoicePurchaseOrderDetails moved to js/app-invoice.js (7.6.1)
// ensurePORecordInInvoiceDb moved to js/app-invoice.js (7.6.1)



async function updateInvoiceTaskLookup(poNumber, invoiceKey, invoiceData, oldAttention) {
    const sanitizeFirebaseKey = (key) => String(key || '').replace(/[.#$[\]\/\\]/g, '_').replace(/\s+/g, '_');

    // 10.2.6: Accuracy cleanup for invoice active-task index.
    // When an invoice is already With Accounts/SRV Done/Paid/Closed, it must be
    // removed from every possible lightweight inbox so Dashboard/Active Task cannot
    // keep showing stale tasks after the source invoice is done.
    const removeInvoiceTaskLookupEverywhere = async () => {
        if (!invoiceKey || typeof invoiceDb === 'undefined' || !invoiceDb || !invoiceDb.ref) return;
        const names = new Set();
        const addName = (v) => {
            const n = String(v || '').trim();
            if (n) names.add(n);
        };
        ['All', 'Accounting', 'Accounts', 'Finance', 'Irwin'].forEach(addName);
        addName(oldAttention);
        addName(invoiceData && invoiceData.attention);
        addName(invoiceData && invoiceData.assignedTo);
        addName(invoiceData && invoiceData.enteredBy);
        try {
            const src = (typeof allApproverData !== 'undefined' && allApproverData)
                ? allApproverData
                : ((typeof allUsersData !== 'undefined' && allUsersData) ? allUsersData : []);
            const arr = Array.isArray(src) ? src : Object.values(src || {});
            arr.forEach(u => addName(u && (u.Name || u.name)));
        } catch (_) { /* ignore */ }

        const removals = [];
        names.forEach(name => {
            const safe = sanitizeFirebaseKey(name);
            if (safe) removals.push(invoiceDb.ref(`invoice_tasks_by_user/${safe}/${invoiceKey}`).remove());
        });
        if (removals.length) await Promise.allSettled(removals);
    };
    const decodeFirebasePushTimestamp = (key) => {
        const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
        const raw = String(key || '').trim();
        const candidates = raw.length === 20 ? [raw] : (raw.match(/[-0-9A-Z_a-z]{20}/g) || []);
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
        return '';
    };
    const getJobRecordDateEnteredForInvoice = () => {
        const direct = invoiceData.jobRecordDateEntered || invoiceData.originDateEntered || invoiceData.dateEntered || invoiceData.entryDate || '';
        if (direct) return direct;
        const linkedKey = invoiceData.linkedJobEntryKey || invoiceData.originJobEntryKey || invoiceData.jobEntryKey || '';
        const originTs = invoiceData.originTimestamp || invoiceData.jobRecordTimestamp || '';
        try {
            const list = Array.isArray(allSystemEntries) ? allSystemEntries : [];
            let match = null;
            if (linkedKey) match = list.find(e => e && e.key === linkedKey);
            if (!match && originTs) {
                const target = Number(originTs);
                match = list.find(e => e && Number(e.timestamp || 0) === target);
            }
            if (!match && invoiceData.po_number) {
                const poKey = String(invoiceData.po_number || poNumber || '').trim().toUpperCase();
                match = list.find(e => e && String(e.po || '').trim().toUpperCase() === poKey && String(e.for || '').toLowerCase() === 'invoice');
            }
            return match ? (match.date || '') : '';
        } catch (_) {
            return '';
        }
    };

    const newAttention = invoiceData.attention;
    const isTaskNowActive = isInvoiceTaskActive(invoiceData);

    // 10.2.6: Done is done. If the invoice is now inactive, remove any stale
    // task-index row first and stop; do not let old invoice_tasks_by_user rows
    // recreate cards in WorkDesk Dashboard/Active Task.
    if (!isTaskNowActive) {
        await removeInvoiceTaskLookupEverywhere();
        return;
    }

    // 1. Add to new user's inbox
    if (isTaskNowActive && newAttention) {
        const poKey = String(poNumber || '').trim().toUpperCase();

        // Keep purchase_orders in-sync for any PO that is actually used in the invoice system
        if (typeof ensurePORecordInInvoiceDb === 'function') {
            await ensurePORecordInInvoiceDb(poKey);
        }

        // Resolve PO details (POVALUE2.csv + invoiceDb/purchase_orders)
        const poDetails = (typeof getInvoicePurchaseOrderDetails === 'function')
            ? await getInvoicePurchaseOrderDetails(poKey)
            : ((poKey && allPOData && allPOData[poKey]) ? allPOData[poKey] : {});

        const vendorName =
            invoiceData.vendorName ||
            invoiceData.vendor_name ||
            poDetails['Supplier Name'] ||
            poDetails['Supplier Name:'] ||
            poDetails['Supplier'] ||
            poDetails['Supplier:'] ||
            'N/A';

        const site =
            invoiceData.site ||
            invoiceData.site_name ||
            poDetails['Project ID'] ||
            poDetails['Project ID:'] ||
            poDetails['Project ID:'] ||
            'N/A';

        const sender =
            invoiceData.enteredBy ||
            invoiceData.originEnteredBy ||
            invoiceData.createdBy ||
            '';

        const taskStatusLower = String(invoiceData.status || '').trim().toLowerCase();
        const taskKeyCreatedAt = decodeFirebasePushTimestamp(invoiceKey);
        const taskJobRecordDateEntered = getJobRecordDateEnteredForInvoice();
        const taskJobRecordTimestamp = invoiceData.jobRecordTimestamp || invoiceData.originTimestamp || '';
        const normalizeQueueStatus = (value) => String(value || '').trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
        const parseQueueTimestamp = (value) => {
            if (value === undefined || value === null || value === '') return '';
            if (typeof value === 'object') return value;
            const n = Number(value);
            if (!Number.isNaN(n) && n > 0) return n < 10000000000 ? n * 1000 : n;
            const raw = String(value || '').trim();
            const parsed = Date.parse(raw);
            return Number.isNaN(parsed) ? '' : parsed;
        };
        const historyValues = (history) => {
            if (!history) return [];
            if (Array.isArray(history)) return history.filter(Boolean);
            if (typeof history === 'object') return Object.values(history).filter(Boolean);
            return [];
        };
        const historyStatusMatches = (entryStatus, targetStatus) => {
            const entry = normalizeQueueStatus(entryStatus);
            const target = normalizeQueueStatus(targetStatus);
            if (!entry || !target) return false;
            if (entry === target) return true;
            if (target.includes('srv')) return entry.includes('srv');
            if (target.includes('report')) return entry.includes('report');
            if (target.includes('process')) return entry.includes('process');
            if (target.includes('unresolved')) return entry.includes('unresolved');
            if (target.includes('pending')) return entry.includes('pending');
            if (target.includes('hold') || target.includes('waiting')) return entry.includes('hold') || entry.includes('waiting');
            return entry.includes(target) || target.includes(entry);
        };
        const getInvoiceHistoryQueueAt = () => {
            const hist = historyValues(invoiceData.history || invoiceData.invoiceHistory || invoiceData.statusHistory);
            let best = '';
            hist.forEach(h => {
                const hStatus = h && (h.status || h.action || h.remarks || '');
                if (!historyStatusMatches(hStatus, invoiceData.status)) return;
                const ts = parseQueueTimestamp(h.timestamp || h.updatedAt || h.createdAt || h.date || h.releaseDate);
                if (!ts || typeof ts === 'object') return;
                if (!best || Number(ts) > Number(best)) best = ts;
            });
            return best;
        };
        const taskCreatedQueueAt = taskJobRecordDateEntered || invoiceData.createdAt || invoiceData.enteredAt || invoiceData.originTimestamp || invoiceData.dateAdded || taskKeyCreatedAt || '';
        const taskInvoiceHistoryQueueAt = getInvoiceHistoryQueueAt();
        const taskStatusQueueAt = taskInvoiceHistoryQueueAt || invoiceData.statusQueueAt || invoiceData.forSrvAt || invoiceData.sentToSrvAt || invoiceData.statusChangedAt || invoiceData.statusUpdatedAt || invoiceData.releaseDate || invoiceData.updatedAt || invoiceData.lastUpdated || '';
        const isJobNewEntryStatus = taskStatusLower.includes('new entry');
        const isInvoiceStatusQueue = taskStatusLower.includes('srv') || taskStatusLower.includes('report') || taskStatusLower.includes('process') || taskStatusLower.includes('unresolved') || taskStatusLower.includes('pending') || taskStatusLower.includes('hold') || taskStatusLower.includes('waiting');
        const taskQueueAt = isJobNewEntryStatus ? taskCreatedQueueAt : (isInvoiceStatusQueue ? (taskStatusQueueAt || taskKeyCreatedAt || '') : (taskStatusQueueAt || taskCreatedQueueAt));

        const taskData = {
            // include these so Workdesk can route back correctly
            attention: newAttention,
            enteredBy: sender,

            ref: invoiceData.invNumber || '',
            po: poKey,
            originalPO: poKey,
            originalKey: invoiceKey,
            invoiceKey: invoiceKey,
            key: invoiceKey,

            // Save BOTH amounts
            amount: invoiceData.invValue || '', // Total Invoice Value
            amountPaid: invoiceData.amountPaid || '', // Actual Payment Amount

            // Supplier invoice date remains separate from the work queue date.
            date: invoiceData.invoiceDate || getTodayDateString(),
            invoiceDate: invoiceData.invoiceDate || getTodayDateString(),

            // Job Records Date Entered is the official source for New Entry date tabs.
            // Keep supplier Invoice Date separate from this workflow/queue date.
            linkedJobEntryKey: invoiceData.linkedJobEntryKey || invoiceData.originJobEntryKey || '',
            jobRecordDateEntered: taskJobRecordDateEntered || '',
            originDateEntered: invoiceData.originDateEntered || taskJobRecordDateEntered || '',
            dateEntered: invoiceData.dateEntered || taskJobRecordDateEntered || '',
            jobRecordTimestamp: taskJobRecordTimestamp || '',

            // Queue/date-tab tracking: these are used by WorkDesk/Active Task
            // to group by the date the work entered the queue, not invoice date.
            dateAdded: invoiceData.dateAdded || '',
            createdAt: invoiceData.createdAt || invoiceData.enteredAt || invoiceData.originTimestamp || invoiceData.dateAdded || taskKeyCreatedAt || '',
            enteredAt: invoiceData.enteredAt || invoiceData.createdAt || invoiceData.originTimestamp || invoiceData.dateAdded || taskKeyCreatedAt || '',
            originTimestamp: invoiceData.originTimestamp || '',
            keyCreatedAt: taskKeyCreatedAt || '',
            releaseDate: invoiceData.releaseDate || '',
            statusQueueAt: taskStatusQueueAt || '',
            statusChangedAt: invoiceData.statusChangedAt || invoiceData.statusUpdatedAt || '',
            statusUpdatedAt: invoiceData.statusUpdatedAt || invoiceData.statusChangedAt || '',
            forSrvAt: invoiceData.forSrvAt || invoiceData.sentToSrvAt || '',
            sentToSrvAt: invoiceData.sentToSrvAt || invoiceData.forSrvAt || '',
            queueAt: invoiceData.queueAt || taskQueueAt || '',
            status: invoiceData.status || 'Pending',
            group: invoiceData.group || invoiceData.category || '',
            vendorName: vendorName,
            site: site,
            invName: invoiceData.invName || '',
            note: invoiceData.note || ''
        };

        const safeNewAttentionKey = sanitizeFirebaseKey(newAttention);
        // 10.2.8: Keep both the personal inbox and the broad All index in sync.
        // 10.2.5 reduced downloads by using this lightweight index; if the All row
        // is not updated when Pending -> For SRV / On Hold, Dashboard can temporarily
        // lose the card even though the invoice is active.
        await invoiceDb.ref(`invoice_tasks_by_user/${safeNewAttentionKey}/${invoiceKey}`).set(taskData);
        await invoiceDb.ref(`invoice_tasks_by_user/All/${invoiceKey}`).set(taskData);
    }

    // 2. Remove from old user's inbox
    if (oldAttention && (oldAttention !== newAttention || !isTaskNowActive)) {
        const safeOldAttentionKey = sanitizeFirebaseKey(oldAttention);
        await invoiceDb.ref(`invoice_tasks_by_user/${safeOldAttentionKey}/${invoiceKey}`).remove();
    }
}

async function removeInvoiceTaskFromUser(invoiceKey, oldData) {
    if (!oldData || !oldData.attention) return;
    const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
    const safeOldAttentionKey = sanitizeFirebaseKey(oldData.attention);
    await invoiceDb.ref(`invoice_tasks_by_user/${safeOldAttentionKey}/${invoiceKey}`).remove();
}

async function updateLinkedJobEntry(poNumber, invoiceKey, newStatus, note = '') {
    if (!poNumber || !invoiceKey) return;
    // Get the invoice data (use cached version if available)
    let invoiceData = null;
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        invoiceData = allInvoiceData[poNumber][invoiceKey];
    } else {
        const snap = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).once('value');
        invoiceData = snap.val();
    }
    const jobKey = invoiceData?.linkedJobEntryKey;
    if (!jobKey) return;

    // 10.4.0: The original WorkDesk New Entry is only the intake/request record.
    // After an invoice record exists, it must stay closed/archived so Active Task
    // and Dashboard do not show both the old Job Entry and the live Invoice task.
    // Keep the current invoice workflow status in separate fields for history only.
    const updates = {
        remarks: 'Converted to Invoice',
        status: 'Completed',
        convertedToInvoice: true,
        archived: true,
        linkedInvoiceKey: invoiceKey,
        linkedInvoicePO: poNumber,
        invoiceWorkflowStatus: newStatus || '',
        linkedInvoiceStatus: newStatus || '',
        dateResponded: formatDate(new Date()),
        releaseDate: getTodayDateString(),
        statusChangedAt: firebase.database.ServerValue.TIMESTAMP,
        statusQueueAt: firebase.database.ServerValue.TIMESTAMP
    };
    await db.ref(`job_entries/${jobKey}`).update(updates);
    try {
        const local = (Array.isArray(allSystemEntries)
            ? allSystemEntries.find(e => e && e.key === jobKey)
            : null);
        if (local) Object.assign(local, updates);
    } catch (_) {}
    // Optional: push a history entry to the job entry
    await db.ref(`job_entries/${jobKey}/history`).push({
        action: "Invoice Status Updated",
        by: currentApprover?.Name || 'System',
        timestamp: Date.now(),
        note: `Invoice workflow status changed to ${newStatus}${note ? ': ' + note : ''}`
    });
}


// ==========================================================================
// 13. INVOICE MANAGEMENT: SEARCH & DISPLAY
// ==========================================================================

// ==========================================================================
// 13-15. INVOICE MANAGEMENT: SEARCH / MODAL / FORM LOADER
// Moved to js/app-invoice-entry-search.js in v8.2.2
// ==========================================================================




function buildInvoiceReportNameForSave(poNumber, invoiceData = {}, fallbackInvoiceData = {}) {
    try {
        const po = normalizeNameText(poNumber || invoiceData.po_number || fallbackInvoiceData.po_number || 'PO');
        const invEntryID = normalizeNameText(invoiceData.invEntryID || fallbackInvoiceData.invEntryID || 'INV-XX');

        let vendorName =
            invoiceData.vendor_name ||
            invoiceData.vendorName ||
            invoiceData.vendor ||
            fallbackInvoiceData.vendor_name ||
            fallbackInvoiceData.vendorName ||
            fallbackInvoiceData.vendor ||
            '';

        if (!vendorName && typeof allPOData !== 'undefined' && allPOData && poNumber && allPOData[poNumber]) {
            vendorName = allPOData[poNumber]['Supplier Name'] || allPOData[poNumber]['Supplier'] || '';
        }

        const shortVendor = truncateNameText(vendorName || 'Vendor', 15).replace(/[^a-zA-Z0-9 ]/g, '') || 'Vendor';
        return normalizeNameText(`${po}-${invEntryID}-${shortVendor}-Report`);
    } catch (error) {
        console.warn('Could not generate Report Name:', error);
        const safePO = normalizeNameText(poNumber || 'PO');
        const safeInvID = normalizeNameText(invoiceData.invEntryID || fallbackInvoiceData.invEntryID || 'INV-XX');
        return normalizeNameText(`${safePO}-${safeInvID}-Vendor-Report`);
    }
}

async function handleAddInvoice(e) {
    e.preventDefault();
    if (!currentPO) {
        alert('No PO is loaded. Please search for a PO first.');
        return;
    }

    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());
    
    // SANITIZE: Remove commas before saving
    if (invoiceData.invValue) invoiceData.invValue = invoiceData.invValue.replace(/,/g, '');
    if (invoiceData.amountPaid) invoiceData.amountPaid = invoiceData.amountPaid.replace(/,/g, '');
    
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;

    // Handle status-based clearing
    if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
    }

    // --- NEW: STRICT VALIDATION ---
    const isAttentionRequired = (invoiceData.status !== 'Under Review' && invoiceData.status !== 'With Accounts');

    if (!invoiceData.invNumber || !invoiceData.invValue || !invoiceData.invoiceDate || !invoiceData.status) {
        alert("Please fill in all highlighted fields:\n- Invoice No.\n- Invoice Value\n- Invoice Date\n- Status");
        return; // STOP HERE
    }

    if (isAttentionRequired && !invoiceData.attention) {
        alert("Please select an 'Attention' person.");
        return; // STOP HERE
    }
    // -----------------------------

    // ==========================================================
    // DUPLICATE INVOICE NUMBER CHECK (for the same PO)
    // ==========================================================
    const newInvNumber = (invoiceData.invNumber || '').trim();
    if (newInvNumber && allInvoiceData && allInvoiceData[currentPO]) {
        let isDuplicate = false;
        const existingInvoices = allInvoiceData[currentPO];
        for (const key in existingInvoices) {
            const inv = existingInvoices[key];
            const existingInvNumber = (inv.invNumber || '').trim();
            if (existingInvNumber && existingInvNumber.toLowerCase() === newInvNumber.toLowerCase()) {
                isDuplicate = true;
                break;
            }
        }
        if (isDuplicate) {
            alert(`❌ Duplicate Invoice Number!\n\nInvoice No. "${newInvNumber}" already exists for PO ${currentPO}.\nPlease check if this invoice was already entered, or use a different invoice number.`);
            return; // Stop saving
        }
    }
    // ==========================================================

    // Auto-generate Invoice Name if blank
    if (!invoiceData.invName || normalizeNameText(invoiceData.invName) === "") {
        const poDetails = allPOData[currentPO] || {};
        const site = normalizeNameText(poDetails['Project ID'] || 'N/A');
        const vendor = truncateNameText(poDetails['Supplier Name'] || 'N/A', 21);
        const invEntryID = normalizeNameText(invoiceData.invEntryID || 'INV-XX');
        invoiceData.invName = normalizeNameText(`${site}-${currentPO}-${invEntryID}-${vendor}`);
    } else {
        // Even if the user typed it manually, never save trailing spaces.
        invoiceData.invName = normalizeNameText(invoiceData.invName);
    }

    if (invoiceData.status === 'Report Approved') {
        invoiceData.reportName = normalizeNameText(invoiceData.reportName || buildInvoiceReportNameForSave(currentPO, invoiceData));
    }

    invoiceData.dateAdded = getTodayDateString();
    invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;
    
    // [SMART REFRESH] 1. Add Timestamp to record
    invoiceData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;

    // Track who created it (used for "return to sender" workflow)
    invoiceData.enteredBy = (typeof currentUserName !== 'undefined' && currentUserName) ? currentUserName : (currentApprover?.Name || '');

    // Persist vendor/site on the invoice record as a fallback (prevents N/A if PO lookup fails)
    const _poDetailsForInv = (allPOData && allPOData[currentPO]) ? allPOData[currentPO] : {};
    invoiceData.vendor_name = invoiceData.vendor_name || _poDetailsForInv['Supplier Name'] || _poDetailsForInv['Supplier Name:'] || '';
    invoiceData.vendor_id = invoiceData.vendor_id || _poDetailsForInv['Supplier ID'] || _poDetailsForInv['Supplier ID:'] || _poDetailsForInv['Vendor ID'] || '';
    invoiceData.site_name = invoiceData.site_name || _poDetailsForInv['Project ID'] || _poDetailsForInv['Project ID:'] || '';

    // Also keep a simple alias for older screens
    invoiceData.vendorName = invoiceData.vendorName || invoiceData.vendor_name;
    invoiceData.vendorId = invoiceData.vendorId || invoiceData.vendor_id;
    invoiceData.site = invoiceData.site || invoiceData.site_name;

    // Ensure this PO exists in invoiceDb/purchase_orders so tasks always have Vendor + Site
    if (typeof ensurePORecordInInvoiceDb === 'function') {
        await ensurePORecordInInvoiceDb(currentPO);
    }

    if (jobEntryToUpdateAfterInvoice) {
        const originJobEntry = allSystemEntries.find(entry => entry.key === jobEntryToUpdateAfterInvoice);
        if (originJobEntry) {
            invoiceData.linkedJobEntryKey = jobEntryToUpdateAfterInvoice;
            invoiceData.originTimestamp = originJobEntry.timestamp;
            invoiceData.jobRecordTimestamp = originJobEntry.timestamp;
            invoiceData.originDateEntered = originJobEntry.date || '';
            invoiceData.jobRecordDateEntered = originJobEntry.date || '';
            invoiceData.dateEntered = originJobEntry.date || '';
            invoiceData.originEnteredBy = originJobEntry.enteredBy;
            invoiceData.originType = "Job Entry";
        }
    }

    // Clean up nulls
    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key];
    });

    // =========================================================
    // 👉 INJECT IMPORTED RECEPTION HISTORY (if any)
    // =========================================================
    if (window.importedJobHistory && window.importedJobHistory.length > 0) {
        invoiceData.history = {};
        window.importedJobHistory.forEach((histItem, index) => {
            const exactTime = invoiceData.originTimestamp || new Date(histItem.date).getTime() || (Date.now() - 2000);
            invoiceData.history['imported_' + index] = {
                status: histItem.status,
                updatedBy: histItem.updatedBy,
                timestamp: exactTime,
                note: "Carried over from WorkDesk"
            };
        });
    }
    // =========================================================

    try {
        const newRef = await invoiceDb.ref(`invoice_entries/${currentPO}`).push(invoiceData);
        const newKey = newRef.key;

	if (jobEntryToUpdateAfterInvoice) {
    await invoiceDb.ref(`invoice_entries/${currentPO}/${newKey}`).update({
        linkedJobEntryKey: jobEntryToUpdateAfterInvoice,
        originDateEntered: invoiceData.originDateEntered || '',
        jobRecordDateEntered: invoiceData.jobRecordDateEntered || '',
        dateEntered: invoiceData.dateEntered || '',
        jobRecordTimestamp: invoiceData.jobRecordTimestamp || invoiceData.originTimestamp || ''
    });
}

        // [SMART REFRESH] 2. Log this update so "Smart Refresh" can find it
        if (typeof logRecentUpdate === 'function') {
            logRecentUpdate(currentPO);
        }

        await updateInvoiceTaskLookup(currentPO, newKey, invoiceData, null);

        if (window.logInvoiceHistory) {
            await window.logInvoiceHistory(currentPO, newKey, invoiceData.status, "Initial Entry");
        }

        alert('Invoice added successfully!');

        // Update Local Cache
        if (allInvoiceData && newKey) {
            if (!allInvoiceData[currentPO]) allInvoiceData[currentPO] = {};
            allInvoiceData[currentPO][newKey] = invoiceData;
        }

        if (invoiceData.note && invoiceData.note.trim() !== '') {
            allUniqueNotes.add(invoiceData.note.trim());
            refreshNotePickers(invoiceData.note);
        }

        // Update Origin Job Entry
        if (jobEntryToUpdateAfterInvoice) {
            try {
                // 10.4.0: Close/archive the original WorkDesk New Entry after it
                // becomes an Invoice Management record. Do not copy For SRV/Pending
                // back into the Job Entry, because that creates duplicate Active Tasks.
                const updates = {
                    remarks: 'Converted to Invoice',
                    status: 'Completed',
                    convertedToInvoice: true,
                    archived: true,
                    linkedInvoiceKey: newKey,
                    linkedInvoicePO: currentPO,
                    invoiceWorkflowStatus: invoiceData.status || '',
                    linkedInvoiceStatus: invoiceData.status || '',
                    dateResponded: formatDate(new Date()),
                    releaseDate: getTodayDateString(),
                    statusChangedAt: firebase.database.ServerValue.TIMESTAMP,
                    statusQueueAt: firebase.database.ServerValue.TIMESTAMP
                };
                const completedKey = jobEntryToUpdateAfterInvoice;
                await db.ref(`job_entries/${jobEntryToUpdateAfterInvoice}`).update(updates);
                try {
                    const local = (Array.isArray(allSystemEntries)
                        ? allSystemEntries.find(e => e && e.key === completedKey)
                        : null);
                    if (local) {
                        Object.assign(local, updates);
                    }
                } catch (_) {}

                jobEntryToUpdateAfterInvoice = null;
                if (typeof imInvalidateActiveJobsSidebarCache === 'function') imInvalidateActiveJobsSidebarCache();
                await populateActiveJobsSidebar(true);

            } catch (updateError) {
                console.error("Error updating the original job entry:", updateError);
            }
        }

        allSystemEntries = [];
        fetchAndDisplayInvoices(currentPO);
        
        // WIPE MEMORY TO PREVENT LEAKS
        window.importedJobHistory = null;

    } catch (error) {
        console.error("Error adding invoice:", error);
        alert('Failed to add invoice. Please try again.');
    }
}


async function handleUpdateInvoice(e) {
    e.preventDefault();
    if (!currentPO || !currentlyEditingInvoiceKey) {
        alert('No invoice selected for update.');
        return;
    }
    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());

    // SANITIZE: Remove commas before saving
    if (invoiceData.invValue) invoiceData.invValue = invoiceData.invValue.replace(/,/g, '');
    if (invoiceData.amountPaid) invoiceData.amountPaid = invoiceData.amountPaid.replace(/,/g, '');

    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;

    if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
    }

    const originalInvoiceData = currentPOInvoices[currentlyEditingInvoiceKey];
    const newStatus = invoiceData.status;
    const oldStatus = originalInvoiceData ? originalInvoiceData.status : '';

    // v8.5.7: Release Date drives department/status duration history.
    // Update it only when the invoice moves to a different status, not when
    // saving the same status again. Applies to all statuses, including With Accounts.
    const normalizedNewStatus = String(newStatus || '').trim();
    const normalizedOldStatus = String(oldStatus || '').trim();
    if (normalizedNewStatus && normalizedOldStatus && normalizedNewStatus !== normalizedOldStatus) {
        invoiceData.releaseDate = getTodayDateString();
        invoiceData.statusChangedAt = firebase.database.ServerValue.TIMESTAMP;
        if (normalizedNewStatus.toLowerCase().includes('srv')) invoiceData.forSrvAt = firebase.database.ServerValue.TIMESTAMP;
    } else if (originalInvoiceData && originalInvoiceData.releaseDate && !String(invoiceData.releaseDate || '').trim()) {
        invoiceData.releaseDate = originalInvoiceData.releaseDate;
        invoiceData.statusChangedAt = originalInvoiceData.statusChangedAt || originalInvoiceData.statusUpdatedAt || '';
        invoiceData.forSrvAt = originalInvoiceData.forSrvAt || originalInvoiceData.sentToSrvAt || '';
    }

    const srvNameLower = (invoiceData.srvName || '').toLowerCase();
    if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
        try {
            const poDetails = allPOData[currentPO];
            if (poDetails) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const formattedDate = `${yyyy}${mm}${dd}`;
                const site = normalizeNameText(poDetails['Project ID'] || 'N/A');
                const invEntryID = normalizeNameText(invoiceData.invEntryID || 'INV-XX');
                const vendorCandidate = truncateNameText(poDetails['Supplier Name'] || '', 21);
                const vendor = vendorCandidate || 'Vendor';
                invoiceData.srvName = normalizeNameText(`${formattedDate}-${currentPO}-${invEntryID}-${site}-${vendor}`);
                document.getElementById('im-srv-name').value = invoiceData.srvName;
            }
        } catch (error) {
            console.error("Could not generate SRV Name:", error);
            alert("Warning: Could not automatically generate the SRV Name.");
        }
    }

    if (invoiceData.status === 'Report Approved') {
        invoiceData.reportName = normalizeNameText(invoiceData.reportName || buildInvoiceReportNameForSave(currentPO, invoiceData, originalInvoiceData));
    }

    invoiceData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;

    if (typeof ensurePORecordInInvoiceDb === 'function') {
        await ensurePORecordInInvoiceDb(currentPO);
    }

    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key];
    });

    const newInvNumber = (invoiceData.invNumber || '').trim();
    if (newInvNumber && allInvoiceData && allInvoiceData[currentPO]) {
        let isDuplicate = false;
        const existingInvoices = allInvoiceData[currentPO];
        for (const key in existingInvoices) {
            if (key === currentlyEditingInvoiceKey) continue;
            const inv = existingInvoices[key];
            const existingInvNumber = (inv.invNumber || '').trim();
            if (existingInvNumber && existingInvNumber.toLowerCase() === newInvNumber.toLowerCase()) {
                isDuplicate = true;
                break;
            }
        }
        if (isDuplicate) {
            alert(`❌ Duplicate Invoice Number!\n\nInvoice No. "${newInvNumber}" already exists for PO ${currentPO}.\nPlease use a different invoice number.`);
            return;
        }
    }

    try {
        await invoiceDb.ref(`invoice_entries/${currentPO}/${currentlyEditingInvoiceKey}`).update(invoiceData);

        // === SYNC LINKED JOB ENTRY ===
        await updateLinkedJobEntry(currentPO, currentlyEditingInvoiceKey, invoiceData.status, invoiceData.note);

        if (typeof logRecentUpdate === 'function') {
            logRecentUpdate(currentPO);
        }

        if (newStatus === "With Accounts" || newStatus === "Paid") {
            console.log("🔄 Syncing: Checking for linked Job Entries...");
            let jobsToSearch = (typeof allSystemEntries !== 'undefined') ? allSystemEntries : [];
            if (!jobsToSearch || jobsToSearch.length === 0) {
                const jobSnap = await firebase.database().ref('job_entries').once('value');
                const jobObj = jobSnap.val() || {};
                jobsToSearch = Object.entries(jobObj).map(([k, v]) => ({ ...v, key: k, source: 'job_entry' }));
            }
            const matchedJob = jobsToSearch.find(job =>
                job.source === 'job_entry' &&
                job.po === currentPO &&
                (job.ref === invoiceData.invNumber || job.ref === originalInvoiceData.invNumber)
            );
            if (matchedJob) {
                console.log(`✅ Found Job Entry ${matchedJob.key}. Updating status...`);
                const db = firebase.database();
                await db.ref(`job_entries/${matchedJob.key}`).update({
                    status: "Completed",
                    remarks: newStatus,
                    dateResponded: new Date().toISOString().split('T')[0],
                    amount: invoiceData.invValue
                });
                await db.ref(`job_entries/${matchedJob.key}/history`).push({
                    action: "Auto-Sync",
                    by: "System",
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    note: `Status synced from Invoice Entry: ${newStatus}`
                });
            }
        }

        const oldAttn = originalInvoiceData ? originalInvoiceData.attention : null;
        await updateInvoiceTaskLookup(currentPO, currentlyEditingInvoiceKey, invoiceData, oldAttn);

        if (newStatus !== oldStatus && window.logInvoiceHistory) {
            await window.logInvoiceHistory(currentPO, currentlyEditingInvoiceKey, newStatus, invoiceData.note);
        }

        alert('Invoice updated successfully!');
        updateLocalInvoiceCache(currentPO, currentlyEditingInvoiceKey, invoiceData);

        if (invoiceData.note && invoiceData.note.trim() !== '') {
            allUniqueNotes.add(invoiceData.note.trim());
            refreshNotePickers(invoiceData.note);
        }

        // 10.3.0: Do not leave the WorkDesk Active Task list with an empty
        // allSystemEntries array after a normal Invoice Entry update. That made
        // the New Entry tab disappear until a full page reload. Rebuild from the
        // cached WorkDesk entries; if a later action needs a forced Job Entry
        // refresh, ensureAllEntriesFetched(true) will still handle it.
        try {
            if (typeof wdRebuildAllSystemEntriesFromFamilyCaches === 'function') {
                wdRebuildAllSystemEntriesFromFamilyCaches();
            }
        } catch (_) {}
        showIMSection('im-invoice-entry');
        fetchAndDisplayInvoices(currentPO);
    } catch (error) {
        console.error("Error updating invoice:", error);
        alert('Failed to update invoice. Please try again.');
    }
}


async function handleDeleteInvoice(key) {
    if (!currentPO || !key) {
        alert("Could not identify the invoice to delete.");
        return;
    }

    // --- SECURITY UPDATE: Strict check for "Irwin" ---
    if (currentApprover.Name !== 'Irwin') {
        alert("Access Denied: Only the original Administrator (Irwin) can delete invoices.");
        return;
    }
    // ------------------------------------------------

    const invoiceToDelete = currentPOInvoices[key];
    if (!invoiceToDelete) {
        alert("Error: Cannot find invoice data to delete. Please refresh.");
        return;
    }

    if (confirm("Are you sure you want to delete this invoice entry? This action cannot be undone.")) {
        try {
            await invoiceDb.ref(`invoice_entries/${currentPO}/${key}`).remove();
            await removeInvoiceTaskFromUser(key, invoiceToDelete);

            alert("Invoice deleted successfully.");
            removeFromLocalInvoiceCache(currentPO, key);
            fetchAndDisplayInvoices(currentPO);

        } catch (error) {
            console.error("Error deleting invoice:", error);
            alert("Failed to delete the invoice. Please try again.");
        }
    }
}


// ==========================================================================
// 16. INVOICE MANAGEMENT: REPORTING ENGINE (MERGED WITH NEW UI)
// ==========================================================================

// --- GUARANTEED SITE FILTER POPULATOR ---
async function populateSiteFilterDropdown() {
    try {
        // 10.4.1: Site filter only needs POVALUE2.csv site/project data.
        // Do not download full invoice_entries just to build the site dropdown.
        if (typeof ensureInvoicePOBaseDataFetched === 'function') {
            await ensureInvoicePOBaseDataFetched(false);
        } else if (typeof ensureInvoiceDataFetched === 'function') {
            await ensureInvoiceDataFetched();
        }
        
        const siteFilter = document.getElementById('im-reporting-site-filter');
        if (!siteFilter) return;

        // 2. Remember what the user currently has selected
        const currentSelection = siteFilter.value;
        const uniqueSites = new Set();
        
        // 3. Extract unique sites from all POs in the database
        if (typeof allPOData !== 'undefined' && allPOData) {
            Object.values(allPOData).forEach(po => {
                if (po['Project ID'] && po['Project ID'].trim() !== '') {
                    uniqueSites.add(po['Project ID'].trim());
                }
            });
        }
        
        // 4. Build the HTML dropdown options
        siteFilter.innerHTML = '<option value="">All Sites & Projects</option>';
        Array.from(uniqueSites).sort().forEach(site => {
            const opt = document.createElement('option');
            opt.value = site;
            opt.textContent = site;
            if (site === currentSelection) opt.selected = true;
            siteFilter.appendChild(opt);
        });
    } catch (e) {
        console.error("Error loading sites:", e);
    }
}

// --- STATE TRACKING VARIABLE ---
let imLastExpandedRowId = null;

// --- NEW UI EVENT LISTENERS & SETUP ---
document.addEventListener('DOMContentLoaded', () => {

    // --- PASTE IT RIGHT HERE ---
    // Reload the Site Filters
    if (typeof populateSiteFilterDropdown === 'function') {
        populateSiteFilterDropdown();
    }
    // ---------------------------

    // 1. Populate Year Filter dynamically
    const yearFilter = document.getElementById('im-reporting-year-filter');
    if (yearFilter) {
        yearFilter.innerHTML = '<option value="">All Years</option>';
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        }
    }

    // 2. Search Form Submit (Allows pressing 'Enter' to search)
    const reportForm = document.getElementById('im-reporting-form');
    if (reportForm) {
        reportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchTerm = document.getElementById('im-reporting-search').value;
            populateInvoiceReporting(searchTerm);
        });
    }

    // 3. Clear Button Logic
    const imReportingClearBtn = document.getElementById('im-reporting-clear-button');
    if (imReportingClearBtn) {
        imReportingClearBtn.addEventListener('click', () => {
            // 1. Clear all input fields
            if (imReportingSearchInput) imReportingSearchInput.value = '';
            const siteFilter = document.getElementById('im-reporting-site-filter');
            const monthFilter = document.getElementById('im-reporting-month-filter');
            const yearFilter = document.getElementById('im-reporting-year-filter');
            const statusFilter = document.getElementById('im-reporting-status-filter');

            if (siteFilter) siteFilter.value = '';
            if (monthFilter) monthFilter.value = '';
            if (yearFilter) yearFilter.value = '';
            if (statusFilter) statusFilter.value = '';

            // 2. Play clear sound
            if (typeof window.playSystemClear === 'function') window.playSystemClear();

            // 3. --- NEW: HIDE THE SEARCH RESULTS SUMMARY BOX ---
            const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
            if (grandTotalContainer) {
                grandTotalContainer.style.display = 'none';
                grandTotalContainer.innerHTML = '';
            }

            // 4. Reset the table to default empty state
            const contentArea = document.getElementById('im-reporting-content');
            if (contentArea) {
                contentArea.innerHTML = '<div class="loading-state"><i class="fa-solid fa-magnifying-glass"></i> <span style="margin-left: 8px;">Enter a search term and click Search to load data.</span></div>';
            }

            // 5. Reset record count and global data
            const countDisplay = document.getElementById('reporting-count-display');
            if (countDisplay) countDisplay.textContent = '(Found: 0)';
            currentReportData = [];
        });
    }

    // 4. Print Summary Button
    const printSummaryBtn = document.getElementById('printSummaryBtn');
    if (printSummaryBtn) {
        printSummaryBtn.addEventListener('click', () => {
            if (!currentReportData || currentReportData.length === 0) return alert("No records to print. Search first.");
            generateGithubStylePrintout(false);
        });
    }

   // 5. Print Detailed Button
    const printDetailedBtn = document.getElementById('printDetailedBtn');
    if (printDetailedBtn) {
        printDetailedBtn.addEventListener('click', () => {
            if (!currentReportData || currentReportData.length === 0) return alert("No records to print. Search first.");
            generateGithubStylePrintout(true);
        });
    }

    // --- PASTE IT HERE ---
    // 6. Interactive Master/Detail Expand Toggle
const contentArea = document.getElementById('im-reporting-content');
if (contentArea) {
    contentArea.addEventListener('click', (e) => {
        const row = e.target.closest('.master-grid-row');
        if (row && !e.target.closest('button')) {
            const card = row.closest('.invoice-card');
            if (card) {
                const isCurrentlyExpanded = card.classList.contains('expanded');
                const poId = card.getAttribute('data-po-id');
                
                // ACCORDION LOGIC: Close all other cards first
                const allCards = document.querySelectorAll('.invoice-card');
                allCards.forEach(c => {
                    if (c !== card) c.classList.remove('expanded');
                });

                // Toggle clicked PO
                if (isCurrentlyExpanded) {
                    card.classList.remove('expanded');
                    imLastExpandedRowId = null;
                } else {
                    card.classList.add('expanded');
                    imLastExpandedRowId = poId;
                }
            }
        }
    });
}

}); // <-- This is the end of the DOMContentLoaded block

// --- DATE FORMATTER + CORE INVOICE REPORTING LOGIC ---
// Moved to js/app-invoice-records.js in v8.1.7 (cleanup only).
// Public functions preserved:
// - formatToDDMMMYY
// - populateInvoiceReporting

async function populateApproverSelect(selectElement) {
    if (approverListForSelect.length === 0) {
        try {
            if (!allApproverData) {
                const snapshot = await db.ref('approvers').once('value');
                allApproverData = snapshot.val();
            }
            const approvers = allApproverData;
            if (approvers) {
                const approverOptions = Object.values(approvers)
                    .map(approver => {
                        if (!approver.Name) return null;
                        const name = approver.Name;
                        const position = approver.Position || 'No-Pos';
                        const site = approver.Site || 'No-Site';
                        return {
                            value: name,
                            label: `${name} - ${position} - ${site}`
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.label.localeCompare(b.label));

                approverListForSelect = [
                    { value: '', label: 'Select Attention', placeholder: true },
                    { value: 'None', label: 'None (Clear)' },
                    ...approverOptions
                ];
            } else {
                approverListForSelect = [{ value: '', label: 'No approvers found', placeholder: true }];
            }
        } catch (error) {
            console.error("Error fetching approvers for select:", error);
            approverListForSelect = [{ value: '', label: 'Error loading', placeholder: true }];
        }
    }

    selectElement.innerHTML = '';
    approverListForSelect.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.placeholder) {
            option.disabled = true;
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}

// updateBatchRowAttentionButton moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// setBatchRowAttentionValue moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// openBatchAttentionPicker moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// closeBatchAttentionPicker moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// updateBatchCount moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// handleAddPOToBatch moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// addInvoiceToBatchTable moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// handleBatchGlobalSearch moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
async function handleSaveBatchInvoices() {
    // 💡 UPDATED: Grabs the new Div Cards instead of <tr> rows
    const rows = document.getElementById('im-batch-table-body').querySelectorAll('.batch-invoice-card');
    if (rows.length === 0) {
        alert("There are no invoices to save.");
        return;
    }
    
    if (!confirm(`You are about to save/update ${rows.length} invoice(s). Continue?`)) return;

    let currentUserName = 'Admin'; 
    try {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
            currentUserName = currentUser.username;
        } else if (window.currentUser && window.currentUser.username) {
            currentUserName = window.currentUser.username;
        }
    } catch (e) { console.warn("User not defined, saving as Admin."); }

    const savePromises = [];
    let newInvoicesCount = 0, updatedInvoicesCount = 0;
    const notesTouchedThisBatch = new Set();

    // v8.3.4 safety fix:
    // Global Batch Entry overrides must be applied again at SAVE time.
    // This prevents multi-row updates from depending only on the earlier UI-change event.
    const batchGlobalStatus = (() => {
        try {
            const el = (typeof imBatchGlobalStatus !== 'undefined' && imBatchGlobalStatus)
                ? imBatchGlobalStatus
                : document.getElementById('im-batch-global-status');
            return el ? String(el.value || '').trim() : '';
        } catch (_) { return ''; }
    })();

    const batchGlobalNote = (() => {
        try {
            const el = (typeof imBatchGlobalNote !== 'undefined' && imBatchGlobalNote)
                ? imBatchGlobalNote
                : document.getElementById('im-batch-global-note');
            return el ? String(el.value || '').trim() : '';
        } catch (_) { return ''; }
    })();

    const batchGlobalAttention = (() => {
        try {
            if (typeof imBatchGlobalAttentionChoices !== 'undefined' && imBatchGlobalAttentionChoices) {
                return imBatchGlobalAttentionChoices.getValue(true) || '';
            }
            const el = (typeof imBatchGlobalAttention !== 'undefined' && imBatchGlobalAttention)
                ? imBatchGlobalAttention
                : document.getElementById('im-batch-global-attention');
            return el ? String(el.value || '').trim() : '';
        } catch (_) { return ''; }
    })();

    const getSrvName = (poNumber, site, vendor, invEntryID) => {
        const today = new Date(), yyyy = today.getFullYear(), mm = String(today.getMonth() + 1).padStart(2, '0'), dd = String(today.getDate()).padStart(2, '0');
        const safeSite = normalizeNameText(site || 'N/A');
        const safeVendor = truncateNameText(vendor || 'Vendor', 21) || 'Vendor';
        const invID = normalizeNameText(invEntryID || 'INV-XX');
        return normalizeNameText(`${yyyy}${mm}${dd}-${poNumber}-${invID}-${safeSite}-${safeVendor}`);
    };

    const generateReportName = (po, id, vendor) => {
        const shortVendor = truncateNameText(vendor || 'Vendor', 15).replace(/[^a-zA-Z0-9 ]/g, "");
        return normalizeNameText(`${po}-${id}-${shortVendor}-Report`);
    };

    if (typeof ensureInvoiceDataFetched === 'function') await ensureInvoiceDataFetched();

    for (const row of rows) {
        const poNumber = row.dataset.po;
        let site = row.dataset.site;
        const existingKey = row.dataset.key;
        let vendor = row.dataset.vendor;
        let invEntryID = row.dataset.nextInvid;

        if (existingKey) {
            const existingIDSpan = row.querySelector('span.existing-indicator');
            if (existingIDSpan) {
                const match = existingIDSpan.textContent.match(/\(Existing: (.*)\)/);
                if (match && match[1]) invEntryID = match[1];
            } else if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) {
                invEntryID = allInvoiceData[poNumber][existingKey].invEntryID;
            }
        }

        // 1. Build Data Object (💡 FIX: COMMAS ARE NOW STRIPPED IN THE BACKGROUND!)
        const invoiceData = {
            invNumber: row.querySelector('[name="invNumber"]').value,
            invName: row.querySelector('[name="invName"]').value,
            details: row.querySelector('[name="details"]') ? row.querySelector('[name="details"]').value : '',
            srvName: row.querySelector('[name="srvName"]').value,
            invoiceDate: row.querySelector('[name="invoiceDate"]').value,
            invValue: row.querySelector('[name="invValue"]').value.replace(/,/g, ''), // Commas stripped!
            amountPaid: row.querySelector('[name="amountPaid"]').value.replace(/,/g, ''), // Commas stripped!
            status: row.querySelector('[name="status"]').value,
            note: row.querySelector('[name="note"]').value,
            releaseDate: row.querySelector('[name="releaseDate"]') ? row.querySelector('[name="releaseDate"]').value : (typeof getTodayDateString === 'function' ? getTodayDateString() : new Date().toISOString().split('T')[0])
        };

        // Read per-row values first, then apply Global Overrides defensively.
        // The UI also updates rows on global-control changes, but this guarantees
        // multi-row batch save uses the current Global Override values.
        invoiceData.attention = row.choicesInstance ? row.choicesInstance.getValue(true) : row.querySelector('select[name="attention"]').value;
        if (batchGlobalStatus) invoiceData.status = batchGlobalStatus;
        if (batchGlobalNote) invoiceData.note = batchGlobalNote;
        if (batchGlobalAttention) invoiceData.attention = batchGlobalAttention;

        if (invoiceData.attention === 'None') invoiceData.attention = '';
        if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') invoiceData.attention = '';

        try {
            const n = (invoiceData.note || '').replace(/\u00A0/g, ' ').trim();
            if (n) {
                if (typeof allUniqueNotes === 'undefined' || !allUniqueNotes) allUniqueNotes = new Set();
                allUniqueNotes.add(n);
                notesTouchedThisBatch.add(n);
            }
        } catch (_) {}

        if (!invoiceData.invValue) {
            alert(`Invoice Value is required for PO ${poNumber}. Cannot proceed.`);
            return;
        }

        const isNA = (v) => {
            const s = String(v || '').trim().toLowerCase();
            return (!s || s === 'n/a' || s === 'na' || s === 'null' || s === 'undefined');
        };

        let poDetails = null;
        if ((isNA(site) || isNA(vendor)) && typeof getInvoicePurchaseOrderDetails === 'function') {
            try { poDetails = await getInvoicePurchaseOrderDetails(poNumber); } catch (_) {}
        }

        if (poDetails) {
            if (isNA(site)) site = normalizeNameText(poDetails['Project ID'] || poDetails['Project ID:'] || site || 'N/A');
            if (isNA(vendor)) vendor = normalizeNameText(poDetails['Supplier Name'] || poDetails['Supplier Name:'] || poDetails['Supplier'] || vendor || 'N/A');
        }

        try {
            row.dataset.site = site || 'N/A';
            row.dataset.vendor = vendor || 'N/A';
        } catch (_) {}

        const siteForName = normalizeNameText(site || 'N/A');
        const vendorFull = normalizeNameText(vendor || 'N/A');
        const vendorForName = truncateNameText(vendorFull || '', 21) || 'Vendor';

        if (!invoiceData.invName || normalizeNameText(invoiceData.invName) === "") {
            const safeInvID = normalizeNameText(invEntryID || invoiceData.invEntryID || 'INV-XX');
            invoiceData.invName = normalizeNameText(`${siteForName}-${poNumber}-${safeInvID}-${vendorForName}`);
        } else {
            invoiceData.invName = normalizeNameText(invoiceData.invName);
        }

        const srvNameLower = (invoiceData.srvName || '').toLowerCase();
        if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
            invoiceData.srvName = getSrvName(poNumber, siteForName, vendorFull, invEntryID);
        }

        if (invoiceData.status === 'Report Approved') {
            invoiceData.reportName = generateReportName(poNumber, invEntryID, vendorForName);
        }

        invoiceData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;

        // 5. SAVE & CACHE LOGIC
        if (existingKey) {
            const originalInvoice = (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) ? allInvoiceData[poNumber][existingKey] : {};

            // v8.5.7: Batch Entry releaseDate must follow the same history rule as Invoice Entry.
            // Per-row and Global Override updates refresh Release Date only when status changes.
            const originalBatchStatus = String(originalInvoice.status || '').trim();
            const finalBatchStatus = String(invoiceData.status || '').trim();
            if (originalBatchStatus && finalBatchStatus && originalBatchStatus !== finalBatchStatus) {
                invoiceData.releaseDate = getTodayDateString();
                invoiceData.statusChangedAt = firebase.database.ServerValue.TIMESTAMP;
                if (finalBatchStatus.toLowerCase().includes('srv')) invoiceData.forSrvAt = firebase.database.ServerValue.TIMESTAMP;
            } else if (originalInvoice.releaseDate && !String(invoiceData.releaseDate || '').trim()) {
                invoiceData.releaseDate = originalInvoice.releaseDate;
                invoiceData.statusChangedAt = originalInvoice.statusChangedAt || originalInvoice.statusUpdatedAt || '';
                invoiceData.forSrvAt = originalInvoice.forSrvAt || originalInvoice.sentToSrvAt || '';
            }

            try {
                const origVendor = originalInvoice.vendor_name || originalInvoice.vendorName || originalInvoice.vendor || '';
                const origSite = originalInvoice.site_name || originalInvoice.site || originalInvoice.siteName || '';
                if (isNA(origVendor)) {
                    invoiceData.vendor_name = vendorFull;
                    invoiceData.vendorName = vendorFull;
                    if (poDetails) {
                        invoiceData.vendor_id = invoiceData.vendor_id || poDetails['Supplier ID'] || poDetails['Vendor ID'] || '';
                        invoiceData.vendorId = invoiceData.vendorId || invoiceData.vendor_id;
                    }
                }
                if (isNA(origSite)) {
                    invoiceData.site_name = siteForName;
                    invoiceData.site = siteForName;
                }
            } catch (_) {}

            invoiceData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
            invoiceData.updatedBy = currentUserName;
            const statusChangedForHistory = (originalBatchStatus && finalBatchStatus && originalBatchStatus !== finalBatchStatus);
            const p = invoiceDb.ref(`invoice_entries/${poNumber}/${existingKey}`).update(invoiceData);
            savePromises.push(p);
            
            const updatedFullData = { ...originalInvoice, ...invoiceData };
            savePromises.push(p.then(() => updateInvoiceTaskLookup(poNumber, existingKey, updatedFullData, originalInvoice.attention)));
            if (statusChangedForHistory && window.logInvoiceHistory) {
                savePromises.push(p.then(() => window.logInvoiceHistory(poNumber, existingKey, finalBatchStatus, invoiceData.note || 'Updated via Batch Entry')));
            }
            updatedInvoicesCount++;
            
            if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) {
                Object.assign(allInvoiceData[poNumber][existingKey], invoiceData);
            }
        } else {
            invoiceData.invEntryID = invEntryID;
            invoiceData.vendor_name = vendorFull;
            if (poDetails) invoiceData.vendor_id = invoiceData.vendor_id || poDetails['Supplier ID'] || poDetails['Vendor ID'] || '';
            invoiceData.po_number = poNumber;
            invoiceData.site_name = siteForName;
            invoiceData.enteredAt = firebase.database.ServerValue.TIMESTAMP;
            invoiceData.enteredBy = currentUserName;

            const newRef = invoiceDb.ref(`invoice_entries/${poNumber}`).push();
            const newKey = newRef.key;
            const p = newRef.set(invoiceData);
            savePromises.push(p);
            savePromises.push(p.then(() => updateInvoiceTaskLookup(poNumber, newKey, invoiceData, null)));
            if (window.logInvoiceHistory) {
                savePromises.push(p.then(() => window.logInvoiceHistory(poNumber, newKey, invoiceData.status, 'Initial Entry via Batch Entry')));
            }
            newInvoicesCount++;

            if (!allInvoiceData) allInvoiceData = {};
            if (!allInvoiceData[poNumber]) allInvoiceData[poNumber] = {};
            allInvoiceData[poNumber][newKey] = {
                ...invoiceData,
                key: newKey,
                vendor_name: vendorFull,
                site_name: siteForName
            };
        }

        if (typeof logRecentUpdate === 'function') logRecentUpdate(poNumber);
    }

    try {
        await Promise.all(savePromises);

        // 9.8.9: Batch Entry can change many invoice statuses at once.
        // Mark Invoice Records / CSV data as dirty so the next export/search uses
        // a fresh invoice_entries read instead of an old currentReportData snapshot.
        try {
            window.__imInvoiceReportingDirty = true;
            if (typeof window.markInvoiceReportDataDirty === 'function') {
                window.markInvoiceReportDataDirty('Batch Entry save/update');
            }
            if (typeof currentReportData !== 'undefined') currentReportData = [];
        } catch (_) {}

        if (notesTouchedThisBatch.size > 0) refreshNotePickers(Array.from(notesTouchedThisBatch)[notesTouchedThisBatch.size - 1]);
        
        alert(`Batch Process Complete!\n\nNew Invoices: ${newInvoicesCount}\nUpdated Invoices: ${updatedInvoicesCount}`);
        
        document.getElementById('im-batch-table-body').innerHTML = '';
        if (typeof imBatchSearchModal !== 'undefined' && imBatchSearchModal) imBatchSearchModal.classList.add('hidden');
        if (typeof loadActiveTasks === 'function') loadActiveTasks();
    } catch (error) {
        console.error("Batch Save Error:", error);
        alert("An error occurred while saving. Check console.");
    }
}

// --------------------------------------------------------------------------
// SECTION D: MODAL POPUP LOGIC
// --------------------------------------------------------------------------

// handleBatchModalPOSearch moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// handleAddSelectedToBatch moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// initializeNoteSuggestions moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// populateNoteDropdown moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
// autoFillSummarySrvIfWithAccounts moved to js/app-batch-entry-ui.js in v8.2.7 (cleanup only).
async function handleGenerateSummary() {
    const getOrdinal = (n) => {
        if (isNaN(n) || n <= 0) return '';
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const prevNote = summaryNotePreviousInput.value.trim();
    const currentNote = summaryNoteCurrentInput.value.trim();

    sessionStorage.setItem('imSummaryPrevNote', prevNote);
    sessionStorage.setItem('imSummaryCurrNote', currentNote);

    if (!currentNote) {
        alert("Please enter a note for the 'Current Note' search.");
        return;
    }

    summaryNoteGenerateBtn.textContent = 'Generating...';
    summaryNoteGenerateBtn.disabled = true;

    try {
        await ensureInvoiceDataFetched();
        // Summary Note only: always refresh POdetails.csv so newly uploaded Bill Descriptions are available.
        await refreshSummaryPODetailsCSV();

        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;
        const epicoreData = allEpicoreData;

        let previousPaymentTotal = 0;
        let currentPaymentTotal = 0;

        let prevSummaryDateObj = null;
        const maybeSetPrevSummaryDate = (inv) => {
            try {
                const st = (inv?.status || '').toString().trim().toLowerCase();
                const isCompleted = (st === 'with accounts' || st === 'paid' || st === 'complete paid');
                if (!isCompleted) return;

                let d = null;
                if (inv?.releaseDate) {
                    const norm = normalizeDateForInput(inv.releaseDate);
                    if (norm) d = new Date(norm + 'T00:00:00');
                }
                if (!d && inv?.updatedAt) d = new Date(inv.updatedAt);
                if (!d && inv?.enteredAt) d = new Date(inv.enteredAt);
                if (!d && inv?.createdAt) d = new Date(inv.createdAt);
                if (!d && inv?.timestamp) d = new Date(inv.timestamp);
                if (!d && inv?.invoiceDate) {
                    const norm2 = normalizeDateForInput(inv.invoiceDate);
                    if (norm2) d = new Date(norm2 + 'T00:00:00');
                }

                if (d && !isNaN(d.getTime())) {
                    if (!prevSummaryDateObj || d.getTime() > prevSummaryDateObj.getTime()) {
                        prevSummaryDateObj = d;
                    }
                }
            } catch (_) {}
        };

        let allCurrentInvoices = [];
        let srvNameForQR = null;
        let foundSrv = false;

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];

                if (prevNote !== "" && inv.note === prevNote) {
                    previousPaymentTotal += parseFloat(inv.invValue) || 0;
                    maybeSetPrevSummaryDate(inv);

                    if (!foundSrv && inv.srvName && inv.srvName.toLowerCase() !== 'nil' && inv.srvName.trim() !== '') {
                        srvNameForQR = inv.srvName;
                        foundSrv = true;
                    }
                }

                if (inv.note === currentNote) {
                    const vendorName = (allPOs[poNumber] && allPOs[poNumber]['Supplier Name']) ? allPOs[poNumber]['Supplier Name'] : 'N/A';
                    const site = (allPOs[poNumber] && allPOs[poNumber]['Project ID']) ? allPOs[poNumber]['Project ID'] : 'N/A';
                    currentPaymentTotal += parseFloat(inv.invValue) || 0;
                    allCurrentInvoices.push({
                        po: poNumber,
                        key: key,
                        site,
                        vendor: vendorName,
                        ...inv
                    });
                }
            }
        }

        const count = allCurrentInvoices.length;
        if (summaryNoteCountDisplay) {
            summaryNoteCountDisplay.textContent = `(Total Items: ${count})`;
        }

        if (allCurrentInvoices.length === 0) {
            alert(`No invoices found with the note: "${currentNote}"`);
            summaryNotePrintArea.classList.add('hidden');
            return;
        }

        const qrElement = document.getElementById('sn-prev-summary-qr');
        if (qrElement) {
            qrElement.innerHTML = '';
            if (srvNameForQR) {
                try {
                    const pdfUrl = buildSharePointPdfUrl(SRV_BASE_PATH, srvNameForQR);
                    if (pdfUrl) {
                        new QRCode(qrElement, {
                        text: pdfUrl,
                        width: 60,
                        height: 60,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.L
                        });
                    }
                } catch (e) {
                    console.error("QR generation failed:", e);
                }
            }
        }

        allCurrentInvoices.sort((a, b) => (a.site || '').localeCompare(b.site || ''));
        const vendorData = allPOs[allCurrentInvoices[0].po];
        snVendorName.textContent = vendorData ? vendorData['Supplier Name'] : 'N/A';

        const today = new Date();
        snDate.textContent = `Date: ${today.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).replace(/ /g, '-')}`;

        if (snPrevSummaryDate) {
            if (prevSummaryDateObj) {
                const dd = String(prevSummaryDateObj.getDate()).padStart(2, '0');
                const mmm = prevSummaryDateObj.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
                const yyyy = prevSummaryDateObj.getFullYear();
                snPrevSummaryDate.textContent = ` (${dd}-${mmm}-${yyyy})`;
            } else {
                snPrevSummaryDate.textContent = '';
            }
        }
        snPreviousPayment.textContent = `${formatCurrency(previousPaymentTotal)} Qatari Riyals`;
        snCurrentPayment.textContent = `${formatCurrency(currentPaymentTotal)} Qatari Riyals`;
        snTableBody.innerHTML = '';

        for (const inv of allCurrentInvoices) {
            const row = document.createElement('tr');
            row.setAttribute('data-po', inv.po);
            row.setAttribute('data-key', inv.key);

            const poKeyVariants = getSummaryPOKeyVariants(inv.po);
            let rawDescription = '';

            if (epicoreData) {
                for (const poKey of poKeyVariants) {
                    if (Object.prototype.hasOwnProperty.call(epicoreData, poKey) && epicoreData[poKey]) {
                        rawDescription = epicoreData[poKey];
                        break;
                    }
                }
            }

            if (!rawDescription) rawDescription = (inv.details || '');
            rawDescription = String(rawDescription);
            let truncatedDescription = rawDescription;

            if (rawDescription.length > 20) {
                truncatedDescription = rawDescription.substring(0, 20) + "...";
            }

            let invCountDisplay = '';
            if (inv.invEntryID) {
                const match = inv.invEntryID.match(/INV-(\d+)/i);
                if (match && match[1]) {
                    const num = parseInt(match[1], 10);
                    invCountDisplay = getOrdinal(num);
                } else {
                    invCountDisplay = inv.invEntryID;
                }
            }

            row.innerHTML = `
                <td>${invCountDisplay}</td>
                <td>${inv.po}</td>
                <td>${inv.site}</td>
                <td><input type="text" class="summary-edit-input" name="details" value="${truncatedDescription}"></td>
                <td><input type="date" class="summary-edit-input" name="invoiceDate" value="${normalizeDateForInput(inv.invoiceDate) || ''}"></td>
                <td>${formatCurrency(inv.invValue)}</td>
            `;
            snTableBody.appendChild(row);
        }
        snTotalNumeric.textContent = formatCurrency(currentPaymentTotal);
        snTotalInWords.textContent = numberToWords(currentPaymentTotal);
        summaryNotePrintArea.classList.remove('hidden');
        
        // 💡 NEW ADDITION: Run the auto-filler right after the table builds, just in case!
        autoFillSummarySrvIfWithAccounts();

    } catch (error) {
        console.error("Error generating summary:", error);
        alert("An error occurred. Please check the notes and try again.");
    } finally {
        summaryNoteGenerateBtn.textContent = 'Generate Summary';
        summaryNoteGenerateBtn.disabled = false;
    }
}

async function handleUpdateSummaryChanges(sendToAccounts = false) {
    const rows = snTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("No data to update.");
        return;
    }
    const confirmMsg = sendToAccounts
        ? "This will UPDATE all visible entries and SEND them to ACCOUNTS (Status: With Accounts). Continue?"
        : "This will save changes for all visible entries. Continue?";
    if (!confirm(confirmMsg)) return;

    summaryNoteUpdateBtn.textContent = "Updating...";
    summaryNoteUpdateBtn.disabled = true;

    let newGlobalStatus = document.getElementById('summary-note-status-input').value;
    let newGlobalSRV = document.getElementById('summary-note-srv-input').value.trim();
    const today = getTodayDateString();

    if (sendToAccounts) {
        newGlobalStatus = 'With Accounts';
    }

    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
    const vendorName = snVendorName ? snVendorName.textContent.trim() : '';
    const autoSrvName = `${vendorName} ${dateStr}`.trim();

    if (newGlobalStatus === 'With Accounts' && !newGlobalSRV && vendorName && vendorName !== 'N/A') {
        newGlobalSRV = autoSrvName;
    }

    const updatePromises = [];
    const localCacheUpdates = [];

    try {
        await ensureInvoiceDataFetched();

        for (const row of rows) {
            const poNumber = row.dataset.po,
                invoiceKey = row.dataset.key;
            const newDetails = row.querySelector('input[name="details"]').value,
                newInvoiceDate = row.querySelector('input[name="invoiceDate"]').value;

            if (poNumber && invoiceKey) {
                const originalInvoice = (allInvoiceData && allInvoiceData[poNumber]) ? (allInvoiceData[poNumber][invoiceKey] || {}) : {};
                const originalStatus = (originalInvoice.status || '').toString().trim();

                const updates = {
                    details: newDetails,
                    invoiceDate: newInvoiceDate
                };

                if (newGlobalStatus) {
                    updates.status = newGlobalStatus;
                    if (newGlobalStatus !== originalStatus) {
                        updates.releaseDate = today;
                        updates.updatedAt = Date.now();
                        updates.statusChangedAt = Date.now();
                        if (String(newGlobalStatus || '').toLowerCase().includes('srv')) updates.forSrvAt = Date.now();
                    }
                }

                if (newGlobalSRV) {
                    updates.srvName = newGlobalSRV;
                }

                if (newGlobalStatus === 'With Accounts') updates.attention = '';

                const statusChangedForSummaryHistory = !!(newGlobalStatus && newGlobalStatus !== originalStatus);
                const updatePromise = invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates);
                updatePromises.push(updatePromise);
                if (statusChangedForSummaryHistory && window.logInvoiceHistory) {
                    updatePromises.push(updatePromise.then(() => window.logInvoiceHistory(poNumber, invoiceKey, newGlobalStatus, 'Updated via Summary Note')));
                }
                localCacheUpdates.push({
                    po: poNumber,
                    key: invoiceKey,
                    data: updates
                });

                // === SYNC LINKED JOB ENTRY ===
                await updateLinkedJobEntry(poNumber, invoiceKey, updates.status || newGlobalStatus, 'Updated via Summary Note');

                const updatedInvoiceData = { ...originalInvoice, ...updates };
                updatePromises.push(updateInvoiceTaskLookup(poNumber, invoiceKey, updatedInvoiceData, originalInvoice.attention));
            }
        }

        await Promise.all(updatePromises);

        if (allInvoiceData) {
            for (const update of localCacheUpdates) {
                if (allInvoiceData[update.po] && allInvoiceData[update.po][update.key]) {
                    allInvoiceData[update.po][update.key] = {
                        ...allInvoiceData[update.po][update.key],
                        ...update.data
                    };
                }
            }
        }

        alert("Changes saved successfully!");

        if (typeof summaryClearBtn !== 'undefined' && summaryClearBtn) {
            summaryClearBtn.click();
        } else {
            if (summaryNotePreviousInput) summaryNotePreviousInput.value = '';
            if (summaryNoteCurrentInput) summaryNoteCurrentInput.value = '';
            snTableBody.innerHTML = '';
            summaryNotePrintArea.classList.add('hidden');
        }
    } catch (error) {
        console.error("Error updating summary changes:", error);
        alert("An error occurred while saving the changes.");
    } finally {
        summaryNoteUpdateBtn.textContent = "UPDATE DATA";
        summaryNoteUpdateBtn.disabled = false;
        document.getElementById('summary-note-status-input').value = '';
        document.getElementById('summary-note-srv-input').value = '';
    }
}

// ==========================================================================
// 20. INVOICE MANAGEMENT: DASHBOARD (CHARTS)
// ==========================================================================


// #endregion BLOCK 20 — BATCH ENTRY + SUMMARY NOTES


// =================================================================================================
// #region BLOCK 21 — INVOICE DASHBOARD + PAYMENT WORKFLOW
// Purpose: Dashboard charts/top lists, payment modal search/add/save/count, payment totals.
// =================================================================================================

// [8.1.6] Invoice dashboard chart/top-list rendering moved to js/app-invoice-dashboard.js


// ==========================================================================
// 21. INVOICE MANAGEMENT: PAYMENTS
// ==========================================================================
// [8.3.0] Payment modal/search/add/save/count logic moved to js/app-payments.js.

// ==========================================================================
// 23. CEO APPROVAL & RECEIPT LOGIC
// ==========================================================================


// #endregion BLOCK 21 — INVOICE DASHBOARD + PAYMENT WORKFLOW


// =================================================================================================
// #region BLOCK 22 — CEO / MANAGER APPROVAL RECEIPTS + MODALS
// Purpose: CEO approval modal/actions, receipt preview/send, manager/transfer receipts, draggable modal helpers.
// =================================================================================================

function openCEOApprovalModal(taskData) {
    if (!taskData) return;

    document.getElementById('ceo-modal-key').value = taskData.key;
    document.getElementById('ceo-modal-source').value = taskData.source;
    document.getElementById('ceo-modal-originalPO').value = taskData.originalPO || '';
    document.getElementById('ceo-modal-originalKey').value = taskData.originalKey || '';

    const invName = taskData.invName || '';
    let pdfLinkHTML = '';
if (taskData.source === 'invoice') {
        const pdfUrl = buildSharePointPdfUrl(PDF_BASE_PATH, invName);
        if (pdfUrl) {
            pdfLinkHTML = `<a href="${pdfUrl}" target="_blank" class="action-btn invoice-pdf-btn" style="display: inline-block; margin-top: 10px; text-decoration: none;">View Invoice PDF</a>`;
        }
    }

    ceoModalDetails.innerHTML = `
        <strong>PO:</strong> ${taskData.po || 'N/A'}<br>
        <strong>Vendor:</strong> ${taskData.vendorName || 'N/A'}<br>
        <strong>Site:</strong> ${taskData.site || 'N/A'}
        ${pdfLinkHTML}
    `;

    ceoModalAmount.value = taskData.amount || '';
    ceoModalNote.value = taskData.note || '';

    ceoApprovalModal.classList.remove('hidden');
}

async function handleCEOAction(status) {
    const key = document.getElementById('ceo-modal-key').value;
    const source = document.getElementById('ceo-modal-source').value;
    const originalPO = document.getElementById('ceo-modal-originalPO').value;
    const originalKey = document.getElementById('ceo-modal-originalKey').value;

    if (!key || !source) { alert("Error: Task identifiers are missing."); return; }

    const newAmountPaid = ceoModalAmount.value;
    const newNote = ceoModalNote.value.trim();

    if (newAmountPaid === '' || newAmountPaid < 0) { alert("Please enter a valid Amount."); return; }

    const btn = (status === 'Approved') ? ceoModalApproveBtn : ceoModalRejectBtn;
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
        const updates = {
            status: status,
            remarks: status,
            amountPaid: newAmountPaid,
            amount: newAmountPaid,
            note: newNote,
            dateResponded: formatDate(new Date())
        };

        if (status === 'Approved') {
            const baseESN = await getNextSeriesNumber();
            const approverName = currentApprover.Name.split(' ')[0].toUpperCase();
            updates.esn = `${baseESN}/${approverName}`;
        }

        const processedTask = userActiveTasks.find(t => t.key === key);
        const originalAttention = processedTask ? (processedTask.attention || '') : '';

        if (source === 'job_entry') {
            await db.ref(`job_entries/${key}`).update(updates);
        } else if (source === 'invoice' && originalPO && originalKey) {
            await invoiceDb.ref(`invoice_entries/${originalPO}/${originalKey}`).update(updates);

            // === SYNC LINKED JOB ENTRY ===
            await updateLinkedJobEntry(originalPO, originalKey, status, newNote);

            const updatedInvoiceData = { ...processedTask, ...updates };
            await updateInvoiceTaskLookup(originalPO, originalKey, updatedInvoiceData, originalAttention);
            updateLocalInvoiceCache(originalPO, originalKey, updates);

            if (window.logInvoiceHistory) {
                const historyNote = updates.esn ? `Approved (ESN: ${updates.esn})` : `Marked as ${status}`;
                await window.logInvoiceHistory(originalPO, originalKey, status, historyNote);
            }
        }

        if (processedTask) {
            processedTask.status = status;
            processedTask.amountPaid = newAmountPaid;
            if (updates.esn) processedTask.esn = updates.esn;
            ceoProcessedTasks.push(processedTask);
            const taskIndex = userActiveTasks.findIndex(t => t.key === key);
            if (taskIndex > -1) userActiveTasks.splice(taskIndex, 1);
        }

        renderActiveTaskTable(userActiveTasks);
        const taskCount = userActiveTasks.length;
        if (activeTaskCountDisplay) activeTaskCountDisplay.textContent = `(Total Tasks: ${taskCount})`;
        updateActiveTaskModuleBadges(taskCount, taskCount, (typeof isInventoryContext === 'function' && isInventoryContext()) ? 'inventory' : 'workdesk');

        sendCeoApprovalReceiptBtn.classList.remove('hidden');
        alert(`Task ${status}!`);
        ceoApprovalModal.classList.add('hidden');
    } catch (error) {
        console.error("Error updating task:", error);
        alert("Failed to update task.");
        await populateActiveTasks();
    } finally {
        btn.disabled = false; btn.textContent = status;
    }
}

// ==========================================================================
// MANAGER ESN GENERATOR (5 Letters + 5 Digits Shuffled)
// ==========================================================================
async function getManagerSeriesNumber() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    let resultArr = [];

    // 1. Get exactly 5 Random Letters
    for (let i = 0; i < 5; i++) {
        resultArr.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    }

    // 2. Get exactly 5 Random Digits
    for (let i = 0; i < 5; i++) {
        resultArr.push(digits.charAt(Math.floor(Math.random() * digits.length)));
    }

    // 3. Shuffle them together (e.g., A9K2P5M1X3)
    const finalESN = resultArr.sort(() => 0.5 - Math.random()).join('');

    return Promise.resolve(finalESN);
}

// ==========================================================================
// CEO ESN GENERATOR (5 Letters + 6 Digits)
// ==========================================================================
async function getNextSeriesNumber() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    let resultArr = [];

    // 1. Get exactly 5 Random Letters
    for (let i = 0; i < 5; i++) {
        resultArr.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    }

    // 2. Get exactly 6 Random Digits
    for (let i = 0; i < 6; i++) {
        resultArr.push(digits.charAt(Math.floor(Math.random() * digits.length)));
    }

    // 3. Shuffle them together so they are mixed (e.g. "A9B8C7D6E54")
    const finalESN = resultArr.sort(() => 0.5 - Math.random()).join('');

    return Promise.resolve(finalESN);
}

// =========================================================
// CEO RECEIPT GENERATOR (UPDATED: Title Changed to "CEO Approval")
// =========================================================
async function previewAndSendReceipt() {
    // Check permissions
    const isCEO = (currentApprover?.Role || '').toLowerCase() === 'admin' &&
                  (currentApprover?.Position || '').toLowerCase().includes('ceo');

    if (!isCEO) {
        alert("Access Denied: Only the CEO can send approval receipts.");
        return;
    }

    const btn = document.getElementById('send-ceo-approval-receipt-btn') || document.getElementById('mobile-send-receipt-btn');
    if(btn) { btn.disabled = true; btn.textContent = 'Syncing & Generating...'; }

    try {
        const approvedTasks = ceoProcessedTasks.filter(t => t.status === 'Approved');
        const rejectedTasks = ceoProcessedTasks.filter(t => t.status === 'Rejected');

        // 1. Generate ONE Single ESN for the entire batch
        const baseSeriesNo = await getNextSeriesNumber();
        const approverName = currentApprover.Name.split(' ')[0].toUpperCase();
        const finalESN = `${baseSeriesNo}/${approverName}`;
        
        // Generate Link
        const safeFilename = finalESN.replace(/[^a-zA-Z0-9]/g, '_'); 
        const bucketName = "invoiceentry-b15a8.firebasestorage.app"; 
        const finalPdfLink = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/receipts%2F${safeFilename}.pdf?alt=media`;

        console.log(`Syncing CEO Batch ESN: ${finalESN}`);

        // 2. Update EVERY approved task
        const updatePromises = approvedTasks.map(task => {
            
            const historyEntry = {
                action: "Receipt Generated",
                by: "System",
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                esn: finalESN,
                pdfLink: finalPdfLink,
                note: "CEO Batch Finalized"
            };

            // A. SAVE TO MANAGER_APPROVED
            updateManagerApprovalRecord(task, finalESN, finalPdfLink);

            // B. STANDARD SAVE
            if (task.source === 'invoice') {
                const mainUpdate = invoiceDb.ref(`invoice_entries/${task.originalPO}/${task.originalKey}`).update({ esn: finalESN });
                const historyUpdate = invoiceDb.ref(`invoice_entries/${task.originalPO}/${task.originalKey}/history`).push(historyEntry);
                return Promise.all([mainUpdate, historyUpdate]);
            } else if (task.source === 'job_entry') {
                const mainUpdate = db.ref(`job_entries/${task.key}`).update({ esn: finalESN });
                const historyUpdate = db.ref(`job_entries/${task.key}/history`).push(historyEntry);
                return Promise.all([mainUpdate, historyUpdate]);
            }
        });

        await Promise.all(updatePromises);

        // 3. Update local list
        approvedTasks.forEach(t => t.esn = finalESN);

        const receiptData = {
            approvedTasks: approvedTasks,
            rejectedTasks: rejectedTasks,
            seriesNo: finalESN, 
            title: "CEO Approval", // <--- CHANGED HERE
            appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '4.5'
        };

        localStorage.setItem('pendingReceiptData', JSON.stringify(receiptData));
        window.open('receipt.html', '_blank');

        ceoProcessedTasks = [];
        const mCont = document.getElementById('mobile-receipt-action-container');
        if (mCont) mCont.classList.add('hidden');
        if (btn) btn.classList.add('hidden');

    } catch (error) {
        console.error("Error preparing receipt:", error);
        alert("Error syncing ESN to database.");
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<span style="font-size: 1.2rem; margin-right: 5px;">🚨</span> REQUIRED: Click Here to Finalize';
        }
    }
}

// ==========================================================================
// 24. INITIALIZATION & EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {

    // 7.4.0: Bind/repair mobile-only Invoice/Inventory module dropdowns placed with the version display.
    try { if (typeof initMobileModuleSwitchers === 'function') initMobileModuleSwitchers(); } catch (e) { console.warn('Mobile module switcher init failed:', e); }
    try { if (typeof enforceInventoryMobileNavVisibility === 'function') enforceInventoryMobileNavVisibility(); } catch (_) {}
    try {
        if (!window.__ibaMobileModuleResizeBound) {
            window.__ibaMobileModuleResizeBound = true;
            window.addEventListener('resize', () => {
                const currentModule = (typeof isInventoryMobileModuleActive === 'function' && isInventoryMobileModuleActive()) ? 'inventory' : 'workdesk';
                if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI(currentModule);
            });
        }
    } catch (_) {}

    // --- NEW: DRAGGABLE MODALS LOGIC (FIXED V2 - TRANSFORM) ---
    const makeDraggable = (modal) => {
        // 8.0.9: Invoice Entry uses its own viewport-safe drag handler.
        if (modal && modal.id === 'im-invoice-entry-modal') return;

        const header = modal.querySelector('.modal-header');
        const container = modal.querySelector('.modal-container');
        if (!header || !container) return;

        let currentX = 0;
        let currentY = 0;
        let initialX;
        let initialY;
        let isDragging = false;

        header.style.cursor = 'move'; // Show move cursor

        header.onmousedown = dragStart;

        function dragStart(e) {
            // Calculate starting point based on previous movements
            initialX = e.clientX - currentX;
            initialY = e.clientY - currentY;

            // Only drag if clicking the header
            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                document.onmouseup = dragEnd;
                document.onmousemove = drag;
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                
                // Calculate new position
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                // Use transform to move smoothly without fighting Flexbox
                container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        }

        function dragEnd() {
            isDragging = false;
            document.onmouseup = null;
            document.onmousemove = null;
        }
    };

    // Apply to all existing modals
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        makeDraggable(modal);
    });
  
    // --- 1. Version Display ---
    const __versionText = `V ${APP_VERSION}`;

    const __loginVersionEl = document.getElementById('app-version-display');
    if (__loginVersionEl) { __loginVersionEl.textContent = __versionText; }

    const __dashVersionEl = document.getElementById('dashboard-version-display');
    if (__dashVersionEl) { __dashVersionEl.textContent = __versionText; }

    const __mobileVersionEl = document.getElementById('mobile-version-display');
    if (__mobileVersionEl) { __mobileVersionEl.textContent = __versionText; }

document.querySelectorAll('.sidebar-version-display').forEach(el => {
        el.textContent = `V ${APP_VERSION}`;
    });

    // 8.6.4: Welcome screen time-based greeting + single date display.
    // Local-only display. No Firebase reads and no navigation logic changes.
    const refreshWelcomePremiumDetails = () => {
        try {
            const greetingEl = document.getElementById('welcome-time-greeting');
            const nameEl = document.getElementById('welcome-person-name');
            const dateEl = document.getElementById('welcome-current-date');
            const quoteEl = document.getElementById('welcome-daily-quote');
            const panelDateEl = document.getElementById('welcome-panel-date');
            const panelSubEl = document.getElementById('welcome-panel-sub');

            const pickPersonName = (obj) => {
                if (!obj) return '';
                return obj.Name || obj.name || obj.FullName || obj.fullName || obj.DisplayName || obj.displayName || obj.UserName || obj.username || obj.User || obj.user || obj['User Name'] || '';
            };
            const nameCandidates = [
                (typeof currentApprover !== 'undefined') ? pickPersonName(currentApprover) : '',
                pickPersonName(window.currentApprover),
                localStorage.getItem('IBA_LAST_USER_NAME') || '',
                localStorage.getItem('approverName') || '',
                localStorage.getItem('userName') || '',
                localStorage.getItem('loggedInUserName') || '',
                document.getElementById('dashboard-username')?.textContent || '',
                document.getElementById('wd-username')?.textContent || '',
                document.getElementById('im-username')?.textContent || ''
            ];
            let cleanName = 'User';
            for (const candidate of nameCandidates) {
                const cleaned = String(candidate || '')
                    .replace(/V\s*\d+(?:\.\d+)+/gi, '')
                    .replace(/User Name/gi, '')
                    .trim();
                if (cleaned && cleaned.toLowerCase() !== 'user' && cleaned !== '-') {
                    cleanName = cleaned;
                    break;
                }
            }
            try { if (cleanName && cleanName !== 'User') localStorage.setItem('IBA_LAST_USER_NAME', cleanName); } catch (_) {}

            const now = new Date();
            const hour = now.getHours();
            const greeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
            const fullDate = now.toLocaleDateString('en-QA', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const timeText = now.toLocaleTimeString('en-QA', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });

            const quotes = [
                'A clear record today prevents confusion tomorrow.',
                'Small accurate updates keep the whole project moving.',
                'Good work is easier when every task has a clear owner.',
                'Finish the step in front of you, and the flow becomes lighter.',
                'Organized records are quiet proof of good teamwork.',
                'Progress becomes visible when every update is done properly.',
                'The best system is the one people can trust every day.'
            ];
            const start = new Date(now.getFullYear(), 0, 0);
            const dayNo = Math.floor((now - start) / 86400000);
            const quote = quotes[Math.abs(dayNo) % quotes.length];

            if (greetingEl) greetingEl.textContent = greeting;
            if (nameEl) nameEl.textContent = cleanName;
            if (dateEl) dateEl.textContent = '';
            if (quoteEl) quoteEl.textContent = quote;
            if (panelDateEl) panelDateEl.textContent = fullDate;
            if (panelSubEl) {
                panelSubEl.textContent = timeText;
                panelSubEl.classList.add('welcome-panel-time');
                panelSubEl.setAttribute('aria-label', 'Current system time');
            }
        } catch (e) {
            console.warn('Welcome details refresh skipped:', e);
        }
    };

    window.refreshWelcomePremiumDetails = refreshWelcomePremiumDetails;
    refreshWelcomePremiumDetails();
    setTimeout(refreshWelcomePremiumDetails, 250);
    setTimeout(refreshWelcomePremiumDetails, 1200);
    if (!window.__ibaWelcomeClockInterval) {
        window.__ibaWelcomeClockInterval = setInterval(refreshWelcomePremiumDetails, 1000);
    }

    if (typeof window.showView === 'function' && !window.__ibaWelcomeShowViewWrapped) {
        window.__ibaWelcomeShowViewWrapped = true;
        const __ibaOriginalShowView = window.showView;
        window.showView = function(viewName, ...args) {
            const result = __ibaOriginalShowView.call(this, viewName, ...args);
            if (String(viewName || '').toLowerCase() === 'dashboard') {
                setTimeout(refreshWelcomePremiumDetails, 50);
            }
            return result;
        };
    }


// --- Quick Copy Shortcuts (Double-click to copy) ---
// Invoice Entry Modal fields: Invoice Name, SRV Name, Report Name
try {
    bindDblClickCopy(document.getElementById('im-inv-name'));
    bindDblClickCopy(document.getElementById('im-srv-name'));
    bindDblClickCopy(document.getElementById('im-report-name'));
} catch (e) { /* ignore */ }

    // --- 2. Session Restoration ---
    const savedApproverKey = localStorage.getItem('approverKey');

    if (savedApproverKey) {
        try { await ensureApproverDataCached(); } catch (e) { console.warn('Approver cache preload failed:', e); }
        currentApprover = await getApproverByKey(savedApproverKey);
        if (currentApprover) {
            console.log("Resuming session for:", currentApprover.Name);
            handleSuccessfulLogin();
        } else {
            console.log("Saved key found but no user data fetched, clearing session.");
            localStorage.removeItem('approverKey');
            showView('login');
        }
    } else {
        showView('login');
    }

    // --- 3. Authentication Listeners ---

    // Login Form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const identifier = loginIdentifierInput.value.trim();
        const enteredPassword = (desktopLoginPasswordInput ? desktopLoginPasswordInput.value : '').trim();
        try {
            const approver = await findApprover(identifier);
            if (!approver) {
                loginError.textContent = 'Access denied. Your email or mobile is not registered as an approver.';
                return;
            }
            currentApprover = approver;
            if (!currentApprover.Password || currentApprover.Password === '') {
                const isEmailMissing = !currentApprover.Email;
                const isSiteMissing = !currentApprover.Site;
                const isPositionMissing = !currentApprover.Position;
                setupEmailContainer.classList.toggle('hidden', !isEmailMissing);
                setupSiteContainer.classList.toggle('hidden', !isSiteMissing);
                setupPositionContainer.classList.toggle('hidden', !isPositionMissing);
                setupEmailInput.required = isEmailMissing;
                setupSiteInput.required = isSiteMissing;
                setupPositionInput.required = isPositionMissing;
                showView('setup');
                setupPasswordInput.focus();
            } else {
                if (!enteredPassword) {
                    loginError.textContent = 'Please enter your password.';
                    if (desktopLoginPasswordInput) desktopLoginPasswordInput.focus();
                    return;
                }

                if (enteredPassword === currentApprover.Password) {
                    // Play login sound (same as mobile / old desktop flow)
                    const sound = document.getElementById('login-sound');
                    if (sound) {
                        sound.play().catch(err => console.log('Audio play failed:', err));
                    }
                    handleSuccessfulLogin();
                } else {
                    loginError.textContent = 'Incorrect password. Please try again.';
                    if (desktopLoginPasswordInput) {
                        desktopLoginPasswordInput.value = '';
                        desktopLoginPasswordInput.focus();
                    }
                }
            }
        } catch (error) {
            console.error("Error checking approver:", error);
            loginError.textContent = 'An error occurred. Please try again.';
        }
    });

    // Setup Form
    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setupError.textContent = '';
        const newPassword = setupPasswordInput.value;
        const finalEmail = currentApprover.Email || setupEmailInput.value.trim();
        const finalSite = currentApprover.Site || setupSiteInput.value.trim();
        const finalPosition = currentApprover.Position || setupPositionInput.value.trim();

        if (!finalEmail.toLowerCase().endsWith('@iba.com.qa')) {
            setupError.textContent = 'Invalid email. Only @iba.com.qa addresses are allowed.';
            return;
        }
        if (newPassword.length < 6) {
            setupError.textContent = 'Password must be at least 6 characters long.';
            return;
        }

        try {
            const updates = {
                Password: newPassword,
                Email: finalEmail,
                Site: finalSite,
                Position: finalPosition
            };
            await db.ref(`approvers/${currentApprover.key}`).update(updates);
            currentApprover = {
                ...currentApprover,
                ...updates
            };
            handleSuccessfulLogin();
        } catch (error) {
            console.error("Error during setup:", error);
            setupError.textContent = 'An error occurred while saving. Please try again.';
        }
    });

    // --- NEW: Open SharePoint Folder when clicking "Attachment" Label ---
    const attachmentLabel = document.getElementById('job-attachment-label');
    if (attachmentLabel) {
        attachmentLabel.addEventListener('click', () => {
            // Opens the global variable defined at the top of app.js
            // ATTACHMENT_BASE_PATH = ".../Documents/Attachments/"
            window.open(ATTACHMENT_BASE_PATH, '_blank');
        });
    }

    // --- Sidebar "Add New Job" Action ---
    // Restored: users can add a new job entry from the WorkDesk sidebar.
    const sidebarAddJobBtn = document.getElementById('wd-sidebar-add-job-btn');
    if (sidebarAddJobBtn) {
        sidebarAddJobBtn.style.display = ''; // ensure visible
        sidebarAddJobBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // open modal in Add mode (function is attached to window later in this file)
            if (typeof window.openStandardJobModal === 'function') {
                window.openStandardJobModal('Add');
            }
        });
    }
    // Password Form (Desktop)
    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        passwordError.textContent = '';
        const enteredPassword = passwordInput.value;
        
        if (enteredPassword === currentApprover.Password) {
            
            // --- NEW: PLAY LOGIN SOUND ---
            const sound = document.getElementById('login-sound');
            if (sound) {
                sound.play().catch(err => console.log("Audio play failed:", err));
            }
            // -----------------------------

            handleSuccessfulLogin();
        } else {
            passwordError.textContent = 'Incorrect password. Please try again.';
            passwordInput.value = '';
        }
    });

    // Mobile Login
    if (mobileLoginForm) {
        mobileLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mobileIdentifier = document.getElementById('mobile-login-identifier').value.trim();
            const passwordInput = document.getElementById('mobile-login-password').value;
            const errorMsg = document.getElementById('mobile-login-error');

            const sound = document.getElementById('login-sound');
            if (sound) sound.play().catch(e => console.log("Audio play failed", e));

            try {
                const approver = await findApprover(mobileIdentifier);
                if (!approver) {
                    errorMsg.textContent = 'Access denied. Number not found.';
                    return;
                }
                currentApprover = approver;

                if (!currentApprover.Password) {
                    document.querySelector('.mobile-login-container').style.display = 'none';
                    const isEmailMissing = !currentApprover.Email;
                    setupEmailContainer.classList.toggle('hidden', !isEmailMissing);
                    setupSiteContainer.classList.toggle('hidden', !!currentApprover.Site);
                    setupPositionContainer.classList.toggle('hidden', !!currentApprover.Position);
                    if (isEmailMissing) setupEmailInput.required = true;
                    showView('setup');
                    return;
                }

                if (passwordInput === currentApprover.Password) {
                    document.querySelector('.mobile-login-container').style.display = 'none';
                    handleSuccessfulLogin();
                } else {
                    errorMsg.textContent = 'Incorrect password.';
                    document.getElementById('mobile-login-password').value = '';
                }
            } catch (error) {
                console.error(error);
                errorMsg.textContent = 'Error. Try again.';
            }
        });
    }

    // Logout Buttons
    logoutButton.addEventListener('click', handleLogout);
    wdLogoutButton.addEventListener('click', handleLogout);
    imLogoutButton.addEventListener('click', handleLogout);
    if (mobileActiveTaskLogoutBtn) {
        mobileActiveTaskLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                handleLogout();
            }
        });
    }

    // Mobile Bottom Nav Logout
    const mobileNavLogout = document.getElementById('mobile-nav-logout');
    if (mobileNavLogout) {
        mobileNavLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                handleLogout();
            }
        });
    }

    // Invoice Management Mobile Bottom Nav Logout
    const imMobileNavLogout = document.getElementById('im-mobile-nav-logout');
    if (imMobileNavLogout) {
        imMobileNavLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                handleLogout();
            }
        });
    }

    // --- 4. Workdesk Navigation & Setup ---

    workdeskButton.addEventListener('click', async () => {
        if (!currentApprover) {
            handleLogout();
            return;
        }

        // 7.3.6: Opening normal WorkDesk explicitly exits Inventory module mode.
        if (document.body) document.body.classList.remove('inventory-mode');
        try { window.__ibaActiveModule = 'workdesk'; } catch (_) {}
        if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('workdesk');

        wdUsername.textContent = currentApprover.Name || 'User';
        wdUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        // 1. Define User Roles
        const userPos = (currentApprover?.Position || '').trim();
        const userRole = (currentApprover?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
        const isAccounting = userPos === 'Accounting';
        const isAccounts = userPos === 'Accounts';

        const isVacationDelegate = isVacationDelegateUser();

        // 2. Toggle Admin Body Class
        document.body.classList.toggle('is-admin', isAdmin);

        // 3. SECURITY FIX: Only show IM Link for authorized roles
        // Users with role "User" (who are not Accounting/Accounts) will NOT see this
        if (isAdmin || isAccounting || isAccounts || isVacationDelegate) {
            workdeskIMLinkContainer.classList.remove('hidden');
        } else {
            workdeskIMLinkContainer.classList.add('hidden');
        }

        wdCurrentCalendarDate = new Date();

        // Initialize Dropdowns
        if (!siteSelectChoices) {
            const jobSiteElement = document.getElementById('job-site');
            siteSelectChoices = new Choices(jobSiteElement, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateSiteDropdown();
            if (jobSiteElement && !jobSiteElement._ibaIpcAttentionSiteBound) {
                jobSiteElement._ibaIpcAttentionSiteBound = true;
                jobSiteElement.addEventListener('change', async () => {
                    if (document.getElementById('job-for')?.value === 'IPC Application' && attentionSelectChoices && typeof populateAttentionDropdown === 'function') {
                        const selectedSite = (siteSelectChoices && typeof siteSelectChoices.getValue === 'function') ? siteSelectChoices.getValue(true) : jobSiteElement.value;
                        // 10.2.1: keep IPC Application Attention list broad when site changes too.
                        // Users should see all QS/Senior QS options without needing to type a name.
                        await populateAttentionDropdown(attentionSelectChoices, 'IPC Application', null, true);
                    }
                });
            }
        }
        if (!attentionSelectChoices) {
            const attentionElement = document.getElementById('job-attention');
            attentionSelectChoices = new Choices(attentionElement, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateAttentionDropdown(attentionSelectChoices);
            attentionElement.addEventListener('choice', (event) => {
                if (event.detail && event.detail.value && attentionSelectChoices) {
                    const selectedValue = event.detail.value;
                    const selectedChoice = attentionSelectChoices._store.choices.find(c => c.value === selectedValue);
                    if (selectedChoice && selectedChoice.customProperties && selectedChoice.customProperties.onVacation) {
                        vacationingUserName.textContent = selectedChoice.value;
                        vacationReturnDate.textContent = selectedChoice.customProperties.returnDate || 'N/A';
                        replacementNameDisplay.textContent = selectedChoice.customProperties.replacement.name;
                        replacementContactDisplay.textContent = selectedChoice.customProperties.replacement.contact;
                        replacementEmailDisplay.textContent = selectedChoice.customProperties.replacement.email;
                        vacationModal.classList.remove('hidden');
                    }
                }
            });
        }

        if (!modifyTaskAttentionChoices) {
            modifyTaskAttentionChoices = new Choices(modifyTaskAttention, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateAttentionDropdown(modifyTaskAttentionChoices);

            // Vacation notification + auto-switch to replacement in Workdesk Active Tasks (Modify Task modal)
            if (modifyTaskAttention && !modifyTaskAttention._vacationChoiceListenerAdded) {
                modifyTaskAttention._vacationChoiceListenerAdded = true;
                modifyTaskAttention.addEventListener('choice', (event) => {
                    try {
                        if (modifyTaskAttention._suppressVacationChoice) return;
                        if (!event.detail || !event.detail.value || !modifyTaskAttentionChoices) return;

                        const selectedValue = event.detail.value;
                        const selectedChoice = modifyTaskAttentionChoices._store?.choices?.find(c => c.value === selectedValue);

                        if (selectedChoice && selectedChoice.customProperties && selectedChoice.customProperties.onVacation) {
                            // Populate & show vacation modal
                            vacationingUserName.textContent = selectedChoice.value;
                            vacationReturnDate.textContent = selectedChoice.customProperties.returnDate || 'N/A';
                            replacementNameDisplay.textContent = selectedChoice.customProperties.replacement?.name || 'N/A';
                            replacementContactDisplay.textContent = selectedChoice.customProperties.replacement?.contact || 'N/A';
                            replacementEmailDisplay.textContent = selectedChoice.customProperties.replacement?.email || 'N/A';
                            if (vacationModal) vacationModal.classList.remove('hidden');

                            // Auto-switch attention to replacement (if available)
                            const rawReplacement = (selectedChoice.customProperties.replacement?.name || '').toString().trim();
                            if (rawReplacement && rawReplacement.toUpperCase() !== 'N/A' && rawReplacement !== selectedChoice.value) {
                                const resolvedReplacement = (typeof resolveVacationAssignee === 'function')
                                    ? resolveVacationAssignee(rawReplacement)
                                    : rawReplacement;

                                // Avoid recursion and only switch if the option exists
                                const hasChoice = modifyTaskAttentionChoices._store?.choices?.some(c => c.value === resolvedReplacement);
                                if (hasChoice) {
                                    modifyTaskAttention._suppressVacationChoice = true;
                                    modifyTaskAttentionChoices.setChoiceByValue(resolvedReplacement);
                                    setTimeout(() => { modifyTaskAttention._suppressVacationChoice = false; }, 0);
                                }
                            }
                        }
                    } catch (err) {
                        console.warn("Vacation choice handler error:", err);
                    }
                });
            }
        }

        updateWorkdeskDateTime();
        if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
        workdeskDateTimeInterval = setInterval(updateWorkdeskDateTime, 1000);

        showView('workdesk');

        // --- STRICT ROUTING: ALWAYS ACTIVE TASK ---
        // This ensures that even if Dashboard is hidden, we land on Active Tasks
        document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));

        const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
        if (activeTaskLink) {
            activeTaskLink.classList.add('active');
            await showWorkdeskSection('wd-activetask');
        }
    });

    // Sidebar Navigation
    document.querySelector('#workdesk-view .workdesk-sidebar').addEventListener('click', async (e) => {
        const link = e.target.closest('a');
        if (!link || link.classList.contains('back-to-main-dashboard') || link.id === 'wd-logout-button' || link.id === 'workdesk-im-link') return;
        e.preventDefault();
        if (link.hasAttribute('data-section')) {
            document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            await showWorkdeskSection(link.getAttribute('data-section'), null);
        }
    });

    workdeskIMLink.addEventListener('click', (e) => {
        e.preventDefault();
        invoiceManagementButton.click();
    });

    // Mobile Bottom Nav Logic
    if (imMobileActiveTaskLink) {
        imMobileActiveTaskLink.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
            setTimeout(() => {
                document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
                const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
                if (activeTaskLink) activeTaskLink.classList.add('active');
                showWorkdeskSection('wd-activetask');
            }, 100);
        });
    }

    // --- 5. Workdesk: Job Entry Listeners ---

    addJobButton.addEventListener('click', handleAddJobEntry);
    updateJobButton.addEventListener('click', handleUpdateJobEntry);
    clearJobButton.addEventListener('click', () => resetJobEntryForm(false));
    deleteJobButton.addEventListener('click', handleDeleteJobEntry);

    // Updated: Hide "Add New Job" buttons in Job Records across Workdesk + Inventory clone.
    // (Keeps UI simple and avoids duplicate entry paths.)
    const btnOpenStandard = document.querySelectorAll(
        '#wd-reporting .btn-open-standard-modal, #wd-jobentry .btn-open-standard-modal'
    );
    btnOpenStandard.forEach(btn => btn.style.display = 'none');

    jobEntryTableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row) {
            const key = row.getAttribute('data-key');
            if (jobEntryNavControls) jobEntryNavControls.classList.add('hidden');
            navigationContextList = [];
            navigationContextIndex = -1;

            ensureAllEntriesFetched().then(() => {
                const entry = allSystemEntries.find(item => item.key === key);
                if (key && entry && entry.source !== 'invoice') populateFormForEditing(key);
            });
        }
    });

    jobEntrySearchInput.addEventListener('input', debounce((e) => handleJobEntrySearch(e.target.value), 500));

    // Job Entry Navigation Buttons
    if (navPrevJobButton) {
        navPrevJobButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (navigationContextIndex > 0) {
                navigationContextIndex--;
                const prevKey = navigationContextList[navigationContextIndex];
                await ensureAllEntriesFetched();
                populateFormForEditing(prevKey);
                updateJobEntryNavControls();
            }
        });
    }
    if (navNextJobButton) {
        navNextJobButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (navigationContextIndex < navigationContextList.length - 1) {
                navigationContextIndex++;
                const nextKey = navigationContextList[navigationContextIndex];
                await ensureAllEntriesFetched();
                populateFormForEditing(nextKey);
                updateJobEntryNavControls();
            }
        });
    }

    // --- 6. Workdesk: Active Task Listeners ---

    activeTaskSearchInput.addEventListener('input', debounce((e) => handleActiveTaskSearch(e.target.value), 500));

   // --- FIXED ACTIVE TASK TAB LISTENER ---
    if (activeTaskFilters) {
        activeTaskFilters.addEventListener('click', (e) => {
            // Find the closest button (in case user clicks an icon/badge inside)
            const btn = e.target.closest('button');
            
            if (btn) {
                // 1. Safe Removal: Only remove 'active' if a tab is currently selected
                const currentActive = activeTaskFilters.querySelector('.active');
                if (currentActive) {
                    currentActive.classList.remove('active');
                }

                // 2. Set New Active
                btn.classList.add('active');
                currentActiveTaskFilter = btn.dataset.statusFilter;

                // 3. Refresh Table
                // Ensure we search active tasks, not fetch from scratch unless needed
                handleActiveTaskSearch(activeTaskSearchInput.value);
            }
        });
    }

    if (activeTaskClearButton) {
        activeTaskClearButton.addEventListener('click', () => {
            activeTaskSearchInput.value = '';
            sessionStorage.removeItem('activeTaskSearch');
            handleActiveTaskSearch('');
        });
    }    // Mobile Refresh Button (cooldown: 1 refresh per 30 minutes per user/device)
    if (mobileActiveTaskRefreshBtn) {
        const run = async (e) => {
            e?.preventDefault?.();
            const icon = mobileActiveTaskRefreshBtn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');

            cacheTimestamps.systemEntries = 0;
            await ensureAllEntriesFetched(false);
            await populateActiveTasks();

            if (icon) icon.classList.remove('fa-spin');
        };

        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(mobileActiveTaskRefreshBtn, 'mobile-active-tasks-refresh', run, 30);
        } else {
            mobileActiveTaskRefreshBtn.addEventListener('click', run);
        }
    }

    // --- 7. Workdesk: Calendar Listeners ---

    if (wdCalendarPrevBtn) {
        wdCalendarPrevBtn.addEventListener('click', () => {
            if (isYearView) {
                wdCurrentCalendarDate.setFullYear(wdCurrentCalendarDate.getFullYear() - 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
                renderYearView();
            } else {
                wdCurrentCalendarDate.setMonth(wdCurrentCalendarDate.getMonth() - 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                });
                renderWorkdeskCalendar();
                populateCalendarTasks();
            }
            wdCalendarTaskListTitle.textContent = 'Select a day to see tasks';
            wdCalendarTaskListUl.innerHTML = '';
        });
    }
    if (wdCalendarNextBtn) {
        wdCalendarNextBtn.addEventListener('click', () => {
            if (isYearView) {
                wdCurrentCalendarDate.setFullYear(wdCurrentCalendarDate.getFullYear() + 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
                renderYearView();
            } else {
                wdCurrentCalendarDate.setMonth(wdCurrentCalendarDate.getMonth() + 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                });
                renderWorkdeskCalendar();
                populateCalendarTasks();
            }
            wdCalendarTaskListTitle.textContent = 'Select a day to see tasks';
            wdCalendarTaskListUl.innerHTML = '';
        });
    }

    if (wdCalendarToggleBtn) {
        wdCalendarToggleBtn.addEventListener('click', toggleCalendarView);
    }

    if (wdCalendarGrid) {
        // Single Click: Show list below calendar
        wdCalendarGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('.wd-calendar-day');
            if (dayCell && !dayCell.classList.contains('other-month')) {
                const date = dayCell.dataset.date;
                if (date) displayCalendarTasksForDay(date);
            }
        });

        // Double Click: Show Day View
        wdCalendarGrid.addEventListener('dblclick', (e) => {
            const dayCell = e.target.closest('.wd-calendar-day');
            if (dayCell && !dayCell.classList.contains('other-month')) {
                const taskBadge = dayCell.querySelector('.task-count-badge');
                if (taskBadge) {
                    const date = dayCell.dataset.date;
                    if (date) showDayView(date);
                }
            }
        });
    }

    if (wdCalendarYearGrid) {
        wdCalendarYearGrid.addEventListener('dblclick', (e) => {
            const monthCell = e.target.closest('.wd-calendar-month-cell');
            if (!monthCell) return;
            const monthIndex = parseInt(monthCell.dataset.month, 10);
            if (isNaN(monthIndex)) return;

            wdCurrentCalendarDate.setMonth(monthIndex);
            toggleCalendarView();
            const firstDay = new Date(wdCurrentCalendarDate.getFullYear(), monthIndex, 1);
            const dateYear = firstDay.getFullYear();
            const dateMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
            const dateDay = String(firstDay.getDate()).padStart(2, '0');
            const firstDayStr = `${dateYear}-${dateMonth}-${dateDay}`;
            displayCalendarTasksForDay(firstDayStr);
        });
    }

    // --- FIX: Day View Task Double Click for Reporting ---
    const dayViewTaskList = document.getElementById('wd-dayview-task-list');
    if (dayViewTaskList) {
        dayViewTaskList.addEventListener('dblclick', (e) => {
            // Find the closest task card
            const taskCard = e.target.closest('.dayview-task-card');

            // Check if the card exists and has the admin class
            if (taskCard && taskCard.classList.contains('admin-clickable-task')) {
                const poNumber = taskCard.dataset.po;
                if (poNumber) {
                    // 1. Switch to Invoice Management View
                    invoiceManagementButton.click();

                    // 2. Wait briefly for the view to render, then perform the search
                    setTimeout(() => {
                        // Set the search input value
                        imReportingSearchInput.value = poNumber;
                        sessionStorage.setItem('imReportingSearch', poNumber);

                        // Switch to the Reporting Tab explicitly
                        const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                        if (imReportingLink) {
                            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                            imReportingLink.classList.add('active');
                            showIMSection('im-reporting'); // Force the section to show
                        }

                        // 3. Trigger the actual search logic
                        populateInvoiceReporting(poNumber);
                    }, 200); // Increased delay slightly to ensure DOM is ready
                }
            }
        });
    }

    // Calendar Task List Double Click (Admin Jump)
    if (wdCalendarTaskListUl) {
        wdCalendarTaskListUl.addEventListener('dblclick', (e) => {
            const taskItem = e.target.closest('li.clickable-task');
            if (!taskItem || !taskItem.dataset.po) return;
            const poNumber = taskItem.dataset.po;

            invoiceManagementButton.click();
            setTimeout(() => {
                imReportingSearchInput.value = poNumber;
                sessionStorage.setItem('imReportingSearch', poNumber);
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) imReportingLink.click();
            }, 150);
        });
    }

    // Enter Key Navigation
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const dashboardSection = document.getElementById('wd-dashboard');
        if (!dashboardSection || dashboardSection.classList.contains('hidden')) return;
        const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
        if (isMobile) return;

        const selectedDay = document.querySelector('.wd-calendar-day.selected');
        if (!selectedDay) return;

        const taskBadge = selectedDay.querySelector('.task-count-badge');
        if (!taskBadge) return;
        if (taskBadge.classList.contains('admin-view-only')) return;

        e.preventDefault();

        const date = selectedDay.dataset.date;
        if (!date) return;

        const friendlyDate = formatYYYYMMDD(date);
        const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');

        if (activeTaskLink) {
            activeTaskLink.click();
            setTimeout(() => {
                showWorkdeskSection('wd-activetask', friendlyDate);
            }, 50);
        }
    });

    // --- 8. Workdesk: Day View Listeners ---

    if (dayViewBackBtn) {
        dayViewBackBtn.addEventListener('click', () => {
            const dashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
            if (dashboardLink) dashboardLink.click();
        });
    }

    const navigateDayView = (direction) => {
        if (!wdCurrentDayViewDate) return;
        wdCurrentDayViewDate.setUTCDate(wdCurrentDayViewDate.getUTCDate() + direction);
        const year = wdCurrentDayViewDate.getUTCFullYear();
        const month = String(wdCurrentDayViewDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(wdCurrentDayViewDate.getUTCDate()).padStart(2, '0');
        const newDateString = `${year}-${month}-${day}`;
        showDayView(newDateString);
    };
    if (dayViewPrevBtn) dayViewPrevBtn.addEventListener('click', () => navigateDayView(-1));
    if (dayViewNextBtn) dayViewNextBtn.addEventListener('click', () => navigateDayView(1));

    // Mobile Day View Controls
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
        if (dayViewBackBtn) dayViewBackBtn.click();
    });
    if (mobileNotifyBtn) {
        mobileNotifyBtn.addEventListener('click', () => {
            const taskCount = userActiveTasks.length;
            if (taskCount > 0) alert(`Reminder: You still have ${taskCount} active task(s).`);
            else alert("You have no active tasks.");
        });
    }
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);
    if (dateScroller) {
        dateScroller.addEventListener('click', (e) => {
            const dayItem = e.target.closest('.day-scroller-item');
            if (dayItem && dayItem.dataset.date) {
                const oldActive = dateScroller.querySelector('.day-scroller-item.active');
                if (oldActive) oldActive.classList.remove('active');
                dayItem.classList.add('active');
                showDayView(dayItem.dataset.date);
            }
        });
    }

    // --- 9. Workdesk: Reporting Listeners ---

    reportingSearchInput.addEventListener('input', debounce(() => {
        const searchText = String(reportingSearchInput.value || '').trim();
        if (!searchText) {
            try { sessionStorage.removeItem('reportingSearch'); } catch (_) {}
            if (typeof handleReportingSearch === 'function') {
                handleReportingSearch({ userAction: false, reason: 'clear' });
            }
            return;
        }
        if (typeof handleReportingSearch === 'function') {
            handleReportingSearch({ userAction: true, reason: 'search' });
        }
    }, 500));

    // ==========================================================================
    // 1. REPORTING TABLE LISTENER (Universal Print Fix)
    // ==========================================================================
    if (reportingTableBody) {
        reportingTableBody.addEventListener('click', async (e) => {

            // --- A. HANDLE PRINT WAYBILL (Direct DB Fetch + Explicit Mapping) ---
            const printBtn = e.target.closest('.waybill-btn');
            if (printBtn) {
                e.stopPropagation();
                e.preventDefault();

                const key = printBtn.getAttribute('data-key');

                // Visual feedback
                const originalIcon = printBtn.innerHTML;
                printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                printBtn.disabled = true;

                try {
                    // 1. Fetch fresh data from Firebase
                    const snapshot = await db.ref(`transfer_entries/${key}`).once('value');
                    const val = snapshot.val();

                    if (val) {
                        // 2. EXPLICIT MAPPING (The Fix for Usage/Restock)
                        // We map every possible DB field name to the standard names the printer expects.
                        const entryData = {
                            key: key,

                            // IDs & Names
                            // Provide BOTH fields for compatibility:
                            // - controlNumber is what the printer expects historically
                            // - controlId is used elsewhere in the UI
                            controlNumber: val.controlNumber || val.controlId || val.ref || 'N/A',
                            controlId: val.controlNumber || val.controlId || val.ref || 'N/A',
                            productId: val.productID || val.productId || '',
                            productName: val.productName || '',
                            details: val.details || '',

                            // Sites (Handle missing sites for Usage/Restock)
                            fromSite: val.fromLocation || val.fromSite || 'Main Store',
                            toSite: val.toLocation || val.toSite || (val.jobType === 'Usage' ? 'Consumed' : 'Main Store'),

                            // People
                            requestor: val.requestor || '',
                            receiver: val.receiver || '',
                            approver: val.approver || '',
                            contactName: val.contactName || val.receiver || '',

                            // Quantities (Map requiredQty to orderedQty)
                            orderedQty: val.orderedQty || val.requiredQty || 0,
                            approvedQty: val.approvedQty || 0,
                            receivedQty: val.receivedQty || 0,

                            // Dates
                            // 7.7.6: if shipping date was not entered, use the entry/created date as fallback.
                            shippingDate: val.shippingDate || (val.createdAt ? String(val.createdAt).slice(0, 10) : (val.date || '')),
                            arrivalDate: val.arrivalDate || '',

                            // Status & Logic
                            jobType: val.jobType || val.for || 'Transfer',
                            remarks: val.remarks || val.status || 'Pending',

                            // Signatures / ESN
                            esn: val.esn || '',
                            receiverEsn: val.receiverEsn || ''
                        };

                        // 3. Execute Print
                        if (window.handlePrintWaybill) {
                            window.handlePrintWaybill(entryData);
                        } else {
                            console.error("handlePrintWaybill function missing in transferLogic.js");
                            alert("Print function not loaded. Please refresh.");
                        }
                    } else {
                        alert("Error: Record not found in database.");
                    }
                } catch (err) {
                    console.error("Print Fetch Error:", err);
                    alert("Network error: Could not fetch print data.");
                } finally {
                    // Restore button state
                    printBtn.innerHTML = originalIcon;
                    printBtn.disabled = false;
                }
                return;
            }

            // --- B. HANDLE TRANSFER DELETE ---
            const deleteBtn = e.target.closest('.transfer-delete-btn');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                const key = deleteBtn.getAttribute('data-key');
                if (typeof handleDeleteTransferEntry === 'function') {
                    handleDeleteTransferEntry(key);
                }
                return;
            }

            // --- C. HANDLE EXPAND BUTTON ---
            const expandBtn = e.target.closest('.expand-btn');
            if (expandBtn) {
                const masterRow = expandBtn.closest('.master-row');
                const detailRow = document.querySelector(masterRow.dataset.target);
                if (detailRow) {
                    detailRow.classList.toggle('hidden');
                    expandBtn.textContent = detailRow.classList.contains('hidden') ? '+' : '-';
                }
                return;
            }

            // --- D. HANDLE ROW CLICK (Edit Mode) ---
            const row = e.target.closest('tr');
            if (!row) return;
            const key = row.dataset.key;
            if (!key) return;

            // Load data to check type
            await ensureAllEntriesFetched();
            const entryData = allSystemEntries.find(entry => entry.key === key);
            if (!entryData) return;

            // D1: Transfer Edit
            if (['Transfer', 'Restock', 'Return', 'Usage'].includes(entryData.for)) {
                if (entryData.remarks === 'Pending' || entryData.remarks === 'Pending Source' || entryData.remarks === 'Pending Admin') {
                    if (confirm("Edit this Pending Request?")) {
                        const jobEntryLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
                        if (jobEntryLink) jobEntryLink.click();

                        // Use the correct loader from transferLogic.js
                        setTimeout(() => {
                            if (typeof openTransferModal === 'function') {
                                // We map the entry data to the form manually if needed,
                                // or better yet, rely on the ID to fetch fresh data inside the modal logic if you implemented an edit loader.
                                // For now, let's just open the modal in the correct mode.
                                // Ideally, you should add a specific 'edit' loader function in transferLogic.js,
                                // but opening the modal is the first step.
                                alert("Edit feature for Transfers is currently read-only in this version. Please delete and re-create if changes are needed.");
                            }
                        }, 200);
                    }
                }
                return;
            }

            // D2: Standard Job Edit
            if (entryData.source === 'invoice') return;

            if (confirm("Move to Job Entry form for editing?")) {
                const jobEntryLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
                if (jobEntryLink) jobEntryLink.click();
                setTimeout(() => populateFormForEditing(key), 100);
            }
        });
    }

    // ==========================================================================
    // UNIFIED ACTIVE TASK LISTENER (HANDLES EVERYTHING)
    // ==========================================================================
    if (activeTaskTableBody) {
        activeTaskTableBody.addEventListener('click', async (e) => {
            // Ignore clicks inside mobile view container
            if (e.target.closest('.mobile-only')) return;

            // 1. HANDLE TRANSFER ACTION (Priority 1)
            const transferBtn = e.target.closest('.transfer-action-btn');
            if (transferBtn) {
                e.preventDefault();
                e.stopPropagation();
                const key = transferBtn.getAttribute('data-key');
                const task = userActiveTasks.find(t => t.key === key);

                if (task) {
                    if (window.openTransferActionModal) {
                        await window.openTransferActionModal(task);
                    } else {
                        alert("Transfer Logic script not loaded.");
                    }
                } else {
                    alert("Task not found. Please refresh.");
                }
                return; // Stop here
            }


            // 3. GET ROW DATA
            const row = e.target.closest('tr');
            if (!row) return;
            const key = row.dataset.key;
            const taskData = userActiveTasks.find(entry => entry.key === key);
            
            if (!taskData) return;

            // 4. CEO APPROVE BUTTON
            if (e.target.classList.contains('ceo-approve-btn')) {
                e.stopPropagation();
                openCEOApprovalModal(taskData);
                return;
            }

	            // 5. SRV DONE BUTTON
	            // IMPORTANT: Single source of truth.
	            // We route ALL SRV Done clicks through handleSRVDone() to avoid double-processing
	            // (previously inline onclick + this listener ran together, which could create duplicates).
	            if (e.target.classList.contains('srv-done-btn')) {
                e.stopPropagation();
                const btnKey = e.target.getAttribute('data-key');
                const effectiveKey = btnKey || key;
                await handleSRVDone(e.target, effectiveKey);
                return;
            }

            // 6. EDIT BUTTON
            if (e.target.classList.contains('modify-btn')) {
                e.stopPropagation();
                openModifyTaskModal(taskData);
                return;
            }

            // 7. HANDLE ROW CLICKS (Opening Forms or PDFs)
            
            const userPosLower = (currentApprover?.Position || '').toLowerCase();
            const isAccounting = userPosLower === 'accounting';

            // A. Job Entry for Accounting (Go to Invoice Entry)
            if (taskData.source === 'job_entry' && taskData.for === 'Invoice' && isAccounting) {
                if (!taskData.po) {
                    alert("Missing PO Number.");
                    return;
                }
                jobEntryToUpdateAfterInvoice = key;
                pendingJobEntryDataForInvoice = taskData;
                invoiceManagementButton.click();
                setTimeout(() => {
                    const link = imNav.querySelector('a[data-section="im-invoice-entry"]');
                    if(link) link.click();
                    imPOSearchInput.value = taskData.po;
                    imPOSearchButton.click();
                    imBackToActiveTaskButton.classList.remove('hidden');
                }, 100);
                return;
            }

            // B. Standard Job Entry (Go to Job Form)
            if (taskData.source === 'job_entry' && taskData.for !== 'Invoice') {
                const jobLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
                if (jobLink) jobLink.click();
                await ensureAllEntriesFetched();
                populateFormForEditing(taskData.key);
                return;
            }

            // C. Invoice PDF Open (Only if not clicking a button)
            if (taskData.source === 'invoice' && taskData.invName && taskData.invName.trim() && taskData.invName.toLowerCase() !== 'nil') {
                if (!e.target.closest('button') && !e.target.closest('a')) {
                    const pdfUrl = buildSharePointPdfUrl(PDF_BASE_PATH, taskData.invName);
                    if (pdfUrl) window.open(pdfUrl, '_blank');
                }
            }
        });
    }


// Safeguard: Only add listener if button exists
    if (printReportButton) {
        printReportButton.addEventListener('click', () => {
            if (summaryNotePrintArea) summaryNotePrintArea.classList.add('hidden');
            if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
            if (imFinanceReportModal) imFinanceReportModal.classList.add('hidden');

            const wdPrintArea = document.getElementById('reporting-printable-area');
            if (wdPrintArea) {
                wdPrintArea.classList.add('printing');
                document.body.classList.add('workdesk-print-active');
            }
            window.print();
            setTimeout(() => {
                if (wdPrintArea) {
                    wdPrintArea.classList.remove('printing');
                    document.body.classList.remove('workdesk-print-active');
                }
            }, 1000);
        });
    }

    // Safeguard: Only add listener if button exists
    if (downloadWdReportButton) {
        downloadWdReportButton.addEventListener('click', handleDownloadWorkdeskCSV);
    }

    if (wdInTransitReportBtn) {
        wdInTransitReportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            printInventoryInTransitReport();
        });
    }

    // Persist contact filter selection (used for printing filtered In-Transit report)
    if (wdInTransitContactFilterSelect && !window.__wdInTransitContactFilterBound) {
        window.__wdInTransitContactFilterBound = true;
        wdInTransitContactFilterSelect.addEventListener('change', () => {
            try {
                if (localStorage) localStorage.setItem('wd_intransit_contact', wdInTransitContactFilterSelect.value || '');
            } catch (e) {}
        });
    }

    // Keep visibility in-sync when resizing
    if (!window.__wdInTransitResizeBound) {
        window.__wdInTransitResizeBound = true;
        window.addEventListener('resize', () => {
            if (typeof updateInTransitReportButtonVisibility === 'function') {
                updateInTransitReportButtonVisibility();
            }
        });
    }

    // 10.3.3: Job Records lazy-load. A category click is the first time the
    // WorkDesk/Inventory records source is fetched; opening the tab alone does not download it.
    reportTabsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const currentActive = reportTabsContainer.querySelector('.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }

            e.target.classList.add('active');
            currentReportFilter = e.target.getAttribute('data-job-type');

            if (typeof handleReportingSearch === 'function') {
                handleReportingSearch({ userAction: true, reason: 'tab' });
            }
        }
    });

    document.querySelectorAll('.back-to-main-dashboard').forEach(button => button.addEventListener('click', (e) => {
        e.preventDefault();
        showView('dashboard');
    }));

    // --- 10. Invoice Management Listeners ---

    invoiceManagementButton.addEventListener('click', async () => {
        if (!currentApprover) {
            handleLogout();
            return;
        }

        // 7.3.6: Invoice Management is its own module and exits Inventory mode.
        if (document.body) document.body.classList.remove('inventory-mode');
        try { window.__ibaActiveModule = 'invoice'; } catch (_) {}
        if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('workdesk');
        try { window.__ibaActiveModule = 'invoice'; } catch (_) {}
        try { if (typeof syncMobileModuleSwitchers === 'function') syncMobileModuleSwitchers('invoice'); } catch (_) {}

        // If Help was opened standalone from WorkDesk/Inventory, restore normal IM navigation
        window.__imHelpStandalone = false;
        if (imNav) imNav.classList.remove('hidden');
        // Ensure Help context defaults back to Invoice Management when entering IM normally
        imHelpSetContext('invoice', null, null);
        imUsername.textContent = currentApprover.Name || 'User';
        imUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        // --- FIX: FORCE DROPDOWN DOWNWARDS ---
        if (imAttentionSelectChoices) {
            imAttentionSelect.removeEventListener('choice', handleIMAttentionChoice);
            imAttentionSelectChoices.destroy();
        }
        
        imAttentionSelectChoices = new Choices(imAttentionSelect, {
            searchEnabled: true,
            shouldSort: false, // Important: Keep our custom sort (Suggestions first)
            itemSelectText: '',
            position: 'bottom' // <--- THIS FORCES IT TO DROP DOWN, NOT UP
        });
        await populateAttentionDropdown(imAttentionSelectChoices);
        imAttentionSelect.addEventListener('choice', handleIMAttentionChoice);

        // 1. Define Roles strictly (10.4.1 Invoice Management access cleanup)
        const userPos = (currentApprover?.Position || '').trim();
        const userRole = (currentApprover?.Role || '').toLowerCase();
        const userName = (currentApprover?.Name || '').trim().toLowerCase();
        const isAdmin = userRole === 'admin';
        const isSuperAdmin = userName === String(SUPER_ADMIN_NAME || '').trim().toLowerCase();
        const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;

        const canAccessInvoiceWrite = isSuperAdmin;
        const canAccessSummaryNote = isSuperAdmin;
        const canAccessInvoiceRecords = isAdmin || isSuperAdmin || isVacationDelegate;
        const canAccessPayments = false; // Payments is disabled/dead for now.
        const financeTokens = String(userPos || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        const hasFinancePosition = financeTokens.some(t => ['finance', 'accounts', 'accounting', 'ceo', 'coo'].includes(t));
        const canAccessEpicoreFinance = isSuperAdmin || isVacationDelegate || (isAdmin && hasFinancePosition);

        const imNavItems = imNav.querySelectorAll('li');

        imNavItems.forEach(li => {
            li.style.display = '';

            // Mobile link hiding on Desktop
            if (li.classList.contains('wd-nav-activetask-mobile')) {
                if (window.innerWidth > 768) {
                    li.style.display = 'none';
                    return;
                }
            }

            // Only apply rules to the direct anchor of this <li>; grouped parent <li> contains child anchors.
            const link = li.querySelector(':scope > a');
            if (!link) return;
            const section = link.dataset.section;

            if ((section === 'im-invoice-entry' || section === 'im-batch-entry') && !canAccessInvoiceWrite) {
                li.style.display = 'none';
            }

            if (section === 'im-summary-note' && !canAccessSummaryNote) {
                li.style.display = 'none';
            }

            if (section === 'im-reporting' && !canAccessInvoiceRecords) {
                li.style.display = 'none';
            }

            if (section === 'im-payments') {
                li.style.display = 'none';
                link.classList.add('hidden');
            }

            if (section === 'im-dashboard' && !(isAdmin || isVacationDelegate || isSuperAdmin)) {
                li.style.display = 'none';
            }

            if (link.id === 'im-finance-report-nav-link' && !canAccessEpicoreFinance) {
                li.style.display = 'none';
            }
        });

        // Hide a grouped sidebar header when all of its child links are hidden.
        imNav.querySelectorAll('.im-nav-group').forEach(group => {
            const visibleChildren = Array.from(group.querySelectorAll('.im-nav-submenu > li')).filter(item => item.style.display !== 'none');
            group.style.display = visibleChildren.length ? '' : 'none';
        });

        document.getElementById('im-nav-workdesk').classList.remove('hidden');

        updateIMDateTime();
        if (imDateTimeInterval) clearInterval(imDateTimeInterval);
        imDateTimeInterval = setInterval(updateIMDateTime, 1000);

        showView('invoice-management');

        // 7.9.0: Mobile Invoice/Task uses WorkDesk Active Task as the default shell.
        // Invoice dashboard remains desktop-only to avoid Dashboard Standby on phone refresh.
        const isMobileIMOpen = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
        if (isMobileIMOpen && typeof forceInvoiceTaskMobileActiveTaskShell === 'function') {
            forceInvoiceTaskMobileActiveTaskShell();
            return;
        }

        // --- STRICT ROUTING: ALWAYS DASHBOARD ---
        imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));

        // We default to Dashboard for everyone who can see IM.
        // If they are not admin, they shouldn't see the IM button in the first place (handled in login).
        // But if they are here, Dashboard is the safe landing page.
        const dashLink = imNav.querySelector('a[data-section="im-dashboard"]');
        if (dashLink) dashLink.classList.add('active');

        // Load Dashboard immediately (Single Click Fix)
        setTimeout(() => {
            showIMSection('im-dashboard');
        }, 50);
    });


// #endregion BLOCK 22 — CEO / MANAGER APPROVAL RECEIPTS + MODALS


// =================================================================================================
// #region BLOCK 23 — INVOICE MANAGEMENT EVENT WIRING + ATTENTION CHOICE
// Purpose: IM attention selection and large modal/form event wiring block.
// Moved to js/app-im-event-wiring.js in v8.2.8 (cleanup only).
// Public behavior preserved.
// #endregion BLOCK 23 — INVOICE MANAGEMENT EVENT WIRING + ATTENTION CHOICE


// =================================================================================================
// #region BLOCK 24 — INVOICE / TRANSFER HISTORY + STOCK REVERSAL
// Moved to js/app-history-transfer.js in v8.3.2.
// #endregion BLOCK 24 — INVOICE / TRANSFER HISTORY + STOCK REVERSAL


// =================================================================================================
// #region BLOCK 25 — STANDARD JOB MODAL + STICKER PRINTING
// Moved to js/app-standard-job.js in v8.1.9.
// Public function names are preserved for existing buttons and handlers.
// #endregion BLOCK 25 — STANDARD JOB MODAL + STICKER PRINTING


// =================================================================================================
// #region BLOCK 26 — INVENTORY BUTTON + MODAL LISTENERS + CLEAR LOGIC
// Moved to js/app-modal-navigation-clear.js in v8.2.1 (cleanup only).
// Behavior preserved:
// - Inventory button safe-mode launcher
// - Back/logout inventory cleanup
// - Invoice modal Prev/Next navigation
// - Invoice Value <-> Amount Paid smart sync
// - Desktop manager finalize listener
// - Job Records / Active Task clear buttons
// =================================================================================================

// #endregion BLOCK 26 — INVENTORY BUTTON + MODAL LISTENERS + CLEAR LOGIC


// =================================================================================================
// #region BLOCK 27 — REPORT WORKFLOW, RECEIPT UPLOAD + FINANCE BATCH
// Moved to js/app-report-workflow.js in v8.1.1 (cleanup only).
// Public functions/events preserved:
// - window.updateReportWorkflow
// - window.updateFinanceUI
// - window.finalizeApprovedBatch
// - window.formatCurrencyField / window.cleanCurrencyField
// - Cloud folder buttons and report-name auto generation
// =================================================================================================
// #endregion BLOCK 27 — REPORT WORKFLOW, RECEIPT UPLOAD + FINANCE BATCH


// =================================================================================================
// #region BLOCK 28 — FINANCE REPORTS + EXPORTS
// Moved to js/app-finance.js in 7.9.8 (cleanup only).
// Function names are preserved globally for existing HTML onclick and event wiring.
// #endregion BLOCK 28 — FINANCE REPORTS + EXPORTS


// =================================================================================================
// #region BLOCK 29 — DELETE INVOICE + RECENT SYNC STUBS + INVOICE RECORDS PRINT PREVIEW
// Moved to js/app-invoice.js in v8.0.2 to reduce app.js size.
// Public/legacy functions preserved:
// - Delete invoice button handler
// - logRecentUpdate
// - refreshRecentData
// - startInvoiceSmartLiveSync / stopInvoiceSmartLiveSync
// - Invoice Records preview/print already moved in v7.9.5
// =================================================================================================
// #endregion BLOCK 29 — DELETE INVOICE + RECENT SYNC STUBS + INVOICE RECORDS PRINT PREVIEW



// =================================================================================================
// #region BLOCK 30 — UI SHORTCUTS, AUDIO TOGGLE + QUICK BUTTONS
// Moved to js/app-ui-shortcuts.js in v8.1.0 (cleanup only).
// Public functions/events preserved:
// - Batch Entry spacebar add shortcut
// - window.imAddToDeletionCollection
// - window.handleAudioUIUpdate
// - Smart IPC/FIVE buttons
// - window.imSendWhatsAppInquiry
// - Double-click copy and invoice amount comma formatter
// =================================================================================================
// #endregion BLOCK 30 — UI SHORTCUTS, AUDIO TOGGLE + QUICK BUTTONS



// =================================================================================================
// #region BLOCK 31 — IM HELP CENTER
// Moved to js/app-help.js in v7.9.6 to reduce app.js size.
// Public functions preserved:
// - imHelpSetContext
// - imHelpOpenStandalone
// - imHelpEscapeHtml
// =================================================================================================

}); // END OF DOMCONTENTLOADED

// #endregion BLOCK 31 — IM HELP CENTER MOVED


// =================================================================================================
// v8.6.11 — WorkDesk darker theme v2 + modal header targeting (UI only)
// Keeps the dashboard as an executive/reference view without adding extra Firebase reads.
// =================================================================================================
(function () {
    function ensureInvoiceDashboardReferenceNote() {
        const dash = document.getElementById('im-dashboard');
        if (!dash) return;

        // This dashboard is for Super Admin/reference review. Remove launcher tiles that duplicate the left menu.
        dash.querySelectorAll('.im-dashboard-quick-actions').forEach(function (el) {
            el.remove();
        });

        if (dash.querySelector('.im-dashboard-reference-note')) return;

        const note = document.createElement('div');
        note.className = 'im-dashboard-reference-note';
        note.innerHTML = `
            <div class="im-dashboard-reference-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div>
                <strong>Reference only — not an official record.</strong>
                <span>The figures and results shown here are tentative calculations gathered from Epicore/internal data and may be incomplete or inaccurate. Use this dashboard only as an estimated overview, not as final proof or official financial record.</span>
            </div>
        `;

        const hero = dash.querySelector('.im-dashboard-hero, .im-dashboard-standby-hero');
        if (hero && hero.parentNode) {
            hero.insertAdjacentElement('afterend', note);
        } else {
            dash.insertBefore(note, dash.firstChild || null);
        }
    }

    function bootInvoiceDashboardUiGuard() {
        ensureInvoiceDashboardReferenceNote();
        const dash = document.getElementById('im-dashboard');
        if (!dash || dash.dataset.referenceNoteObserver === '1') return;
        dash.dataset.referenceNoteObserver = '1';
        let timer = null;
        const observer = new MutationObserver(function () {
            clearTimeout(timer);
            timer = setTimeout(ensureInvoiceDashboardReferenceNote, 80);
        });
        observer.observe(dash, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootInvoiceDashboardUiGuard);
    } else {
        bootInvoiceDashboardUiGuard();
    }
    window.ensureInvoiceDashboardReferenceNote = ensureInvoiceDashboardReferenceNote;
})();



// =================================================================================================
// v10.0.6 — Mobile Active Task Full Module Isolation
// Invoice/Task mobile active task and Inventory mobile active task now get separate body/container scope.
// The visible module switcher is the source of truth; hidden/stale inventory-mode flags must not style invoice tasks.
// UI scope only. No Firebase/save/approval workflow logic changed.
// =================================================================================================
(function () {
    function isSmallScreen() {
        return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    }

    function getVisibleMobileModuleValue() {
        const selectors = Array.from(document.querySelectorAll('.mobile-module-switcher-select'));
        if (!selectors.length) return '';
        const visibleSelected = selectors.find(function (sel) {
            const wrap = sel.closest('.mobile-module-switcher-wrap');
            const visible = !!(sel.offsetWidth || sel.offsetHeight || sel.getClientRects().length);
            const wrapVisible = !wrap || !!(wrap.offsetWidth || wrap.offsetHeight || wrap.getClientRects().length);
            return visible && wrapVisible;
        });
        return (visibleSelected && visibleSelected.value ? String(visibleSelected.value).toLowerCase() : '');
    }

    function getActiveMobileTaskModule() {
        if (!isSmallScreen()) {
            return (typeof isInventoryContext === 'function' && isInventoryContext()) ? 'inventory' : 'invoice';
        }

        // The visible selector is the highest authority on mobile.
        const visibleModule = getVisibleMobileModuleValue();
        if (visibleModule === 'inventory') return 'inventory';
        if (visibleModule === 'invoice' || visibleModule === 'workdesk' || visibleModule === 'task') return 'invoice';

        // Fallback only if no visible selector exists.
        if (document.body && (
            document.body.classList.contains('inventory-request-review-active') ||
            document.body.classList.contains('inventory-mobile-finder-active') ||
            document.body.classList.contains('inventory-mode')
        )) return 'inventory';
        return 'invoice';
    }

    function clearMobileTaskInlineTabStyles(filters) {
        if (!filters) return;
        filters.querySelectorAll('button').forEach(function (btn) {
            [
                'background', 'background-image', 'color', '-webkit-text-fill-color',
                'border-color', 'text-shadow', 'opacity', 'box-shadow'
            ].forEach(function (prop) { btn.style.removeProperty(prop); });
        });
    }

    function applyMobileActiveTaskModuleScope(moduleName) {
        const module = moduleName === 'inventory' ? 'inventory' : 'invoice';
        const isInventory = module === 'inventory';
        const body = document.body;
        const container = document.getElementById('active-task-mobile-view');
        const filters = document.getElementById('active-task-filters');
        const header = document.getElementById('active-task-mobile-header');
        const section = document.getElementById('wd-activetask');

        if (body) {
            body.classList.toggle('inventory-mobile-task-active', isInventory);
            body.classList.toggle('invoice-mobile-task-active', !isInventory);
            body.classList.toggle('inventory-mobile-theme-active', isInventory);

            // Prevent old Inventory body mode from repainting Invoice/Task mobile active task.
            if (!isInventory && isSmallScreen()) {
                body.classList.remove('inventory-mode');
            }
        }

        [container, filters, header, section].forEach(function (el) {
            if (!el) return;
            el.dataset.mobileTaskModule = module;
            el.classList.toggle('inventory-mobile-active-task', isInventory);
            el.classList.toggle('invoice-mobile-active-task', !isInventory);
        });

        if (filters) {
            filters.classList.toggle('inventory-task-filters-maroon', isInventory);
            filters.classList.toggle('invoice-task-filters-blue', !isInventory);
            clearMobileTaskInlineTabStyles(filters);
        }
    }

    function bootMobileTaskModuleIsolation() {
        applyMobileActiveTaskModuleScope(getActiveMobileTaskModule());

        const filters = document.getElementById('active-task-filters');
        if (filters && window.MutationObserver) {
            new MutationObserver(function () {
                setTimeout(function () { applyMobileActiveTaskModuleScope(getActiveMobileTaskModule()); }, 0);
            }).observe(filters, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'disabled'] });
        }

        document.querySelectorAll('.mobile-module-switcher-select').forEach(function (sel) {
            sel.addEventListener('change', function () {
                setTimeout(function () { applyMobileActiveTaskModuleScope(getActiveMobileTaskModule()); }, 0);
                setTimeout(function () { applyMobileActiveTaskModuleScope(getActiveMobileTaskModule()); }, 120);
            });
        });

        document.addEventListener('click', function () {
            setTimeout(function () { applyMobileActiveTaskModuleScope(getActiveMobileTaskModule()); }, 60);
        }, true);
        window.addEventListener('resize', function () { applyMobileActiveTaskModuleScope(getActiveMobileTaskModule()); });
    }

    window.getActiveMobileTaskModule = getActiveMobileTaskModule;
    window.applyMobileActiveTaskModuleScope = applyMobileActiveTaskModuleScope;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootMobileTaskModuleIsolation);
    } else {
        bootMobileTaskModuleIsolation();
    }
})();
