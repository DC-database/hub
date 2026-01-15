// app.js
/*
  ORGANIZATION:
  - Config (Firebase) → Global State → Data/Caching → UI/DOM → Event Handlers → Init
  - Cleanup note: removed bracket labels like // [1.a], kept logic unchanged.
*/

// app.js - Top of file
const APP_VERSION = "6.3.9";

// ======================================================================
// NOTE CACHE / UI REFRESH (keeps Note dropdowns in-sync without reload)
// ======================================================================
function refreshNotePickers(latestNote) {
    try {
        const note = (latestNote == null) ? '' : String(latestNote);
        const trimmed = note.replace(/\u00A0/g, ' ').trim(); // normalize NBSP
        if (trimmed) {
            if (typeof allUniqueNotes === 'undefined' || !allUniqueNotes) allUniqueNotes = new Set();
            allUniqueNotes.add(trimmed);
        }
    } catch (e) {
        // ignore
    }

    // 1) Summary Note datalist suggestions
    try {
        if (typeof noteSuggestionsDatalist !== 'undefined' && noteSuggestionsDatalist) {
            noteSuggestionsDatalist.innerHTML = '';
            const sorted = Array.from(allUniqueNotes || []).sort((a, b) => String(a).localeCompare(String(b)));
            for (const n of sorted) {
                const opt = document.createElement('option');
                opt.value = n;
                noteSuggestionsDatalist.appendChild(opt);
            }
        }
    } catch (e) {
        // ignore
    }

    // 2) Batch Entry "Search by Note" dropdown (Choices)
    try {
        if (typeof imBatchNoteSearchChoices !== 'undefined' && imBatchNoteSearchChoices) {
            let current = '';
            try {
                current = imBatchNoteSearchChoices.getValue(true);
            } catch (_) { /* ignore */ }

            Promise.resolve(populateNoteDropdown(imBatchNoteSearchChoices)).then(() => {
                try {
                    if (Array.isArray(current)) {
                        current.forEach(v => imBatchNoteSearchChoices.setChoiceByValue(v));
                    } else if (current) {
                        imBatchNoteSearchChoices.setChoiceByValue(current);
                    }
                } catch (_) { /* ignore */ }
            });
        }
    } catch (e) {
        // ignore
    }
}

// --- Vacation Delegation Helpers (Super Admin Replacement) ---
// When SUPER_ADMIN_NAME enables Vacation in Settings and sets ReplacementName,
// that replacement user is granted temporary Invoice Management access (except Delete, which remains Irwin-only).
const SUPER_ADMIN_NAME = "Irwin";

function getCachedApproversData() {
    return (typeof allApproverDataCache !== 'undefined' && allApproverDataCache) ? allApproverDataCache : allApproverData;
}

// Safe accessor used by Direct Messages.
// Some packages missed this helper which caused the DM user list to be empty.
function getApproversDataSafe() {
    try {
        const d = getCachedApproversData();
        if (d && typeof d === 'object') return d;
    } catch (_) { /* ignore */ }
    return {};
}

function getActiveVacationConfig() {
    const approversData = getCachedApproversData();
    if (!approversData) return null;

    for (const key in approversData) {
        const a = approversData[key];
        if (!a) continue;
        const name = (a.Name || '').trim();
        if (!name || name.toLowerCase() !== SUPER_ADMIN_NAME.toLowerCase()) continue;

        const vacationVal = a.Vacation;
        const onVacation = vacationVal === true || vacationVal === "Yes" || (typeof vacationVal === 'string' && vacationVal.toLowerCase() === 'yes');
        if (!onVacation) return null;

        const replacementName = (a.ReplacementName || '').trim();
        if (!replacementName) return null;

        const returnStr = (a.DateReturn || '').trim();
        let returnDate = null;
        if (returnStr) {
            const d = new Date(returnStr);
            if (!isNaN(d)) {
                d.setHours(23, 59, 59, 999);
                returnDate = d;
            }
        }

        // Auto-disable after return date (no DB write; just treated as inactive)
        const now = new Date();
        if (returnDate && now > returnDate) return null;

        return { superAdminKey: key, replacementName, returnDateStr: returnStr || '' };
    }
    return null;
}

function isVacationDelegateUser() {
    const vac = getActiveVacationConfig();
    if (!vac || !currentApprover) return false;
    const currentName = (currentApprover.Name || '').trim();
    return currentName && currentName.toLowerCase() === vac.replacementName.toLowerCase();
}

function getInvoiceHandlerName() {
    const vac = getActiveVacationConfig();
    return (vac && vac.replacementName) ? vac.replacementName : SUPER_ADMIN_NAME;
}

// --- General Vacation Delegation (All Users) ---
// Any user can enable Vacation in Settings and set ReplacementName + (optional) DateReturn.
// When active, tasks assigned to the vacationing user will:
//  - route to the replacement at creation/update time (where possible), and
//  - appear in the replacement's Active Tasks list even if already assigned to the vacationing user.
function _normName(v) { return String(v || '').trim().toLowerCase(); }

function _parseReturnDate(dateStr) {
    const s = String(dateStr || '').trim();
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d)) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

function getActiveVacationByName(name) {
    const approversData = getCachedApproversData();
    const target = _normName(name);
    if (!approversData || !target) return null;

    for (const key in approversData) {
        const a = approversData[key];
        if (!a) continue;
        const aName = _normName(a.Name);
        if (!aName || aName !== target) continue;

        const vacationVal = a.Vacation;
        const onVacation = vacationVal === true || vacationVal === "Yes" || (typeof vacationVal === 'string' && vacationVal.toLowerCase() === 'yes');
        if (!onVacation) return null;

        const replacementName = String(a.ReplacementName || '').trim();
        if (!replacementName) return null;

        const returnDate = _parseReturnDate(a.DateReturn || '');
        const now = new Date();
        if (returnDate && now > returnDate) return null;

        return {
            key,
            name: (a.Name || '').trim(),
            replacementName,
            returnDateStr: String(a.DateReturn || '').trim()
        };
    }
    return null;
}

function resolveVacationAssignee(name) {
    const n = String(name || '').trim();
    if (!n) return n;
    // Do not rewrite special buckets
    const lower = n.toLowerCase();
    if (lower === 'all' || lower === 'accounting') return n;

    const vac = getActiveVacationByName(n);
    return (vac && vac.replacementName) ? vac.replacementName : n;
}

function getDelegatorsForReplacement(replacementName) {
    const approversData = getCachedApproversData();
    const target = _normName(replacementName);
    const delegators = [];
    if (!approversData || !target) return delegators;

    const now = new Date();

    for (const key in approversData) {
        const a = approversData[key];
        if (!a) continue;

        const rep = _normName(a.ReplacementName);
        if (!rep || rep !== target) continue;

        const vacationVal = a.Vacation;
        const onVacation = vacationVal === true || vacationVal === "Yes" || (typeof vacationVal === 'string' && vacationVal.toLowerCase() === 'yes');
        if (!onVacation) continue;

        const returnDate = _parseReturnDate(a.DateReturn || '');
        if (returnDate && now > returnDate) continue;

        const fromName = String(a.Name || '').trim();
        if (fromName) delegators.push(fromName);
    }
    return delegators;
}


// DETECT INVENTORY CONTEXT
// Inventory mode can be triggered by:
// - URL query: ?mode=inventory (used by the inventory clone)
// - A dedicated inventory page (URL/title contains 'inventory')
// - Body class 'inventory-page'
// - Inventory view currently visible (single-page view switch)
function isInventoryContext() {
    try {
        const params = new URLSearchParams(window.location.search);
        const mode = (params.get('mode') || '').toLowerCase();
        if (mode === 'inventory' || mode === 'materialstock' || mode === 'material-stock') return true;
    } catch (e) { /* ignore */ }

    const href = (window.location.href || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    const title = (document.title || '').toLowerCase();

    if (document.body && document.body.classList.contains('inventory-page')) return true;
    if (href.includes('inventory') || path.includes('inventory') || title.includes('inventory')) return true;

    const invView = document.getElementById('inventory-view');
    if (invView && !invView.classList.contains('hidden')) return true;

	    // --- Detect "Workdesk clone" used for Inventory/Material Stock access ---
	    // Some deployments use a stripped-down Workdesk layout that only shows:
	    //   Active Task + Job Records + Material Stock + Logout
	    // In that case we want Inventory-only behavior even if the URL/title
	    // does not contain the word "inventory".
	    try {
	        const wdView = document.getElementById('workdesk-view');
	        const wdNav = document.getElementById('workdesk-nav');
	        const wdViewVisible = (!wdView || !wdView.classList.contains('hidden'));
	        if (wdNav && wdViewVisible) {
		            const navText = (wdNav.textContent || '').toLowerCase();
		            // Prefer structural checks when possible (more robust than text)
		            const hasMaterial = !!wdNav.querySelector('.wd-nav-material') || navText.includes('material stock');
		            const hasActiveTask = !!wdNav.querySelector('.wd-nav-activetask') || navText.includes('active task');
		            const hasJobRecords = !!wdNav.querySelector('.wd-nav-reporting') || navText.includes('job records');
		            const hasDashboard = !!wdNav.querySelector('.wd-nav-dashboard') || navText.includes('dashboard');

	            // Optional extra signal: the identifier line often shows "Inventory Access"
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

// Keep legacy variable name for existing code paths
const isInventoryPage = isInventoryContext();
// Define what counts as an "Inventory Task"
const INVENTORY_TYPES = ['Transfer', 'Restock', 'Return', 'Usage'];



// ======================================================================
// WORKDESK (DESKTOP) FILTERING: Hide Inventory Tasks/Jobs (Mobile unchanged)
// ======================================================================
function isMobileViewport() {
    return (window.innerWidth || 0) <= 768;
}
function isWorkdeskViewVisible() {
    const wdView = document.getElementById('workdesk-view');
    return !!(wdView && !wdView.classList.contains('hidden'));
}
/**
 * When we're on the NORMAL Workdesk (desktop viewport) we hide inventory-related
 * tasks/jobs (Transfer/Restock/Return/Usage). Inventory mode pages/clones keep them.
 * Mobile view is intentionally unchanged.
 */
function shouldExcludeInventoryFromWorkdeskDesktop() {
    const invCtx = (typeof isInventoryContext === 'function' && isInventoryContext());
    return isWorkdeskViewVisible() && !isMobileViewport() && !invCtx;
}

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
function normalizeNameText(value) {
    // Convert common non-breaking / special spaces to a normal space, then trim.
    return String(value ?? '')
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
        .trim();
}

function truncateNameText(value, maxLen) {
    const s = normalizeNameText(value);
    if (!maxLen || maxLen <= 0) return s;
    // IMPORTANT: do NOT pad. Only truncate, then trim again to remove a trailing space at the cut point.
    return (s.length > maxLen) ? s.substring(0, maxLen).trim() : s;
}

function getSharePointPdfBaseName(name) {
    const raw = normalizeNameText(name);
    const lower = raw.toLowerCase();
    if (!lower || lower === 'nil') return '';

    // Remove a trailing ".pdf" (case-insensitive), allowing accidental spaces before/after it.
    // Then normalize again so we never end up with "... .pdf" when we later append ".pdf".
    const noExt = raw.replace(/\s*\.pdf\s*$/i, '');
    return normalizeNameText(noExt);
}

// Build a safe SharePoint PDF URL or return null if name is blank/"nil".
function buildSharePointPdfUrl(basePath, name) {
    const baseName = getSharePointPdfBaseName(name);
    if (!baseName) return null;
    return `${basePath}${encodeURIComponent(baseName)}.pdf`;
}


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

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatChatTime(ts) {
    try {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return '';
    }
}

// ============================================================================
// DIRECT MESSAGES (DM) — SIMPLE 1:1 IN-APP CHAT + ONLINE STATUS + OFFLINE INBOX
// - Works without Firebase Auth (your rules currently allow reads/writes).
// - If recipient is online (system open) → instant pop-up.
// - If recipient is offline → delivered from inbox once they login.
// - UI entry points added to: WorkDesk + Invoice Management + Inventory.
// ============================================================================

const DM_PRESENCE_ROOT = 'presence';
const DM_INBOX_ROOT = 'dm_inbox';
const DM_THREADS_ROOT = 'dm_threads';
const DM_UNREAD_ROOT = 'dm_unread';

let dmState = {
    initialized: false,
    userKey: null,
    userName: '',
    open: false,
    // current thread
    threadId: null,
    toKey: null,
    toName: '',
    // refs/listeners
    presenceRef: null,
    connectedRef: null,
    onConnected: null,
    heartbeatInterval: null,
    inboxRef: null,
    onInbox: null,
    unreadRef: null,
    onUnread: null,
    presenceListRef: null,
    onPresenceList: null,
    onPresenceChild: null,
    onPresenceRemoved: null,
    threadMessagesRef: null,
    onThreadMsg: null,
    // caches
    presenceCache: {},
    unreadCache: {},
    // ui
    mobileScreen: 'list',
};

function dmIsMobile() {
    // Mobile mode should activate when the viewport is too small for split-view,
    // and on tablets/phones (even when "Request Desktop Site" is enabled).
    try {
        const w = window.innerWidth || document.documentElement.clientWidth || 1024;
        const mq = window.matchMedia ? window.matchMedia.bind(window) : null;

        const isVeryNarrow = mq ? mq('(max-width: 760px)').matches : (w <= 760);
        if (isVeryNarrow) return true;

        const isTabletWidth = mq ? mq('(max-width: 1024px)').matches : (w <= 1024);
        const isCoarse = mq ? mq('(pointer: coarse)').matches : false;
        const maxTouch = (typeof navigator !== 'undefined' && navigator && typeof navigator.maxTouchPoints === 'number')
            ? navigator.maxTouchPoints
            : 0;
        const ua = (typeof navigator !== 'undefined' && navigator && navigator.userAgent) ? navigator.userAgent : '';
        const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);

        return isTabletWidth && (isCoarse || maxTouch > 0 || isMobileUA);
    } catch (_) {
        return (window.innerWidth || 1024) <= 760;
    }
}

function dmSetMobileScreen(screen) {
    dmState.mobileScreen = (screen === 'chat') ? 'chat' : 'list';
    const card = document.querySelector('#dm-modal .dm-card');
    if (!card) return;

    const isMob = dmIsMobile();
    card.classList.toggle('dm-mobile', isMob);
    card.classList.toggle('dm-mobile-list', isMob && dmState.mobileScreen === 'list');
    card.classList.toggle('dm-mobile-chat', isMob && dmState.mobileScreen === 'chat');

    const backBtn = document.getElementById('dm-back-users');
    if (backBtn) {
        backBtn.style.display = (isMob && dmState.mobileScreen === 'chat') ? 'inline-flex' : 'none';
    }
}

function dmGetThreadId(aKey, bKey) {
    const a = String(aKey || '').trim();
    const b = String(bKey || '').trim();
    if (!a || !b) return '';
    return (a < b) ? `${a}__${b}` : `${b}__${a}`;
}

function dmSafeText(t) {
    return String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 800);
}

function dmEnsureInlineStyles() {
    // Minimal fallback styles (full styles also exist in style.css).
    if (document.getElementById('dm-inline-style')) return;
    const style = document.createElement('style');
    style.id = 'dm-inline-style';
    style.textContent = `
.dm-hidden{display:none !important}

/* Toast */
.dm-toast-wrap{position:fixed;right:18px;top:18px;z-index:999999;display:flex;flex-direction:column;gap:10px;max-width:min(420px,calc(100vw - 36px))}
.dm-toast{background:rgba(20,20,24,.88);color:#fff;border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:16px;padding:12px 14px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
.dm-toast b{display:block;margin-bottom:4px}

/* Modal */
.dm-modal{position:fixed;inset:0;z-index:999998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.34);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.dm-card{width:min(1040px,calc(100vw - 28px));height:min(720px,calc(100vh - 28px));border-radius:22px;overflow:hidden;
  background:linear-gradient(180deg,rgba(28,28,34,.92),rgba(16,16,18,.82));
  border:1px solid rgba(255,255,255,.14);box-shadow:0 26px 110px rgba(0,0,0,.55);color:#fff;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif}
.dm-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.10)}
.dm-header .dm-title{font-weight:850;letter-spacing:.2px;display:flex;align-items:center;gap:10px}
.dm-close{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;opacity:.9}
.dm-close:hover{opacity:1}

.dm-body{display:grid;grid-template-columns:360px 1fr;height:calc(100% - 58px);min-height:0}

/* Users */
.dm-users{border-right:1px solid rgba(255,255,255,.10);display:flex;flex-direction:column;min-height:0}
.dm-search-wrap{display:flex;align-items:center;gap:10px;margin:12px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);padding:10px 12px}
.dm-search-wrap i{opacity:.8}
.dm-users input{flex:1;border:0;background:transparent;color:#fff;outline:none;padding:0;margin:0}
.dm-user-list{flex:1;overflow:auto;padding:6px 8px 12px 8px}
.dm-user{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px;border-radius:16px;cursor:pointer;user-select:none}
.dm-user:hover{background:rgba(255,255,255,.08)}
.dm-user.active{background:rgba(255,255,255,.12)}
.dm-user .dm-left{display:flex;align-items:center;gap:12px;min-width:0}
.dm-avatar{width:38px;height:38px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);font-weight:800;letter-spacing:.4px;flex:0 0 auto;position:relative}
.dm-dot{position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:999px;background:rgba(255,255,255,.30);border:2px solid rgba(18,18,20,.95)}
.dm-dot.online{background:#27c46b}
.dm-name{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-meta{font-size:12px;opacity:.80;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-badge{background:#e53935;color:#fff;border-radius:999px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;padding:0 7px}

/* Chat */
.dm-chat{display:flex;flex-direction:column;min-width:0;min-height:0}
.dm-chat-top{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.10);display:flex;align-items:center;justify-content:space-between;gap:12px}
.dm-chat-top-left{display:flex;align-items:center;gap:10px;min-width:0}
.dm-chat-ident{display:flex;align-items:center;gap:10px;min-width:0}
.dm-chat-avatar{width:36px;height:36px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);font-weight:850;flex:0 0 auto}
.dm-back{display:none;align-items:center;justify-content:center;width:36px;height:36px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer}
.dm-chat-top .dm-chat-title{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-chat-actions{display:flex;align-items:center;gap:8px}
.dm-action{display:inline-flex;align-items:center;gap:8px;border-radius:14px;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);color:#fff;padding:9px 12px;cursor:pointer;font-weight:750}
.dm-action span{font-size:13px;opacity:.92}
.dm-action:hover{background:rgba(255,255,255,.09)}

.dm-message-list{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:0}
.dm-empty{margin:auto;max-width:440px;text-align:center;opacity:.86;padding:18px 16px;border-radius:18px;border:1px dashed rgba(255,255,255,.18);background:rgba(255,255,255,.04)}
.dm-empty-title{font-weight:900;margin-bottom:6px}
.dm-empty-sub{font-size:13px;opacity:.85}

.dm-msg{max-width:min(620px,92%);padding:10px 12px;border-radius:18px 18px 18px 8px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.07);line-height:1.35}
.dm-msg.me{align-self:flex-end;border-radius:18px 18px 8px 18px;background:rgba(90,160,255,.20)}
.dm-msg .dm-ts{font-size:11px;opacity:.72;margin-top:6px;text-align:right}

.dm-compose{display:flex;gap:10px;align-items:center;padding:12px 14px;border-top:1px solid rgba(255,255,255,.10)}
.dm-compose input{flex:1;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;padding:12px 12px;outline:none}
.dm-compose button{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
.dm-compose button:hover{background:rgba(255,255,255,.18)}

/* Mobile: WhatsApp-style list <-> chat with Back (touch devices only; controlled by dm-mobile class) */
@media (max-width: 820px){
  .dm-toast-wrap{left:14px;right:14px;top:14px;max-width:none}
  .dm-card.dm-mobile{width:100vw;height:100vh;border-radius:0}
  .dm-card.dm-mobile .dm-body{grid-template-columns:1fr}
  .dm-card.dm-mobile.dm-mobile-list .dm-chat{display:none}
  .dm-card.dm-mobile.dm-mobile-chat .dm-users{display:none}
  .dm-card.dm-mobile .dm-back{display:inline-flex}
}
`;
    document.head.appendChild(style);
}

function dmEnsureUI() {
    dmEnsureInlineStyles();

    if (!document.getElementById('dm-toast-wrap')) {
        const toastWrap = document.createElement('div');
        toastWrap.id = 'dm-toast-wrap';
        toastWrap.className = 'dm-toast-wrap';
        document.body.appendChild(toastWrap);
    }

    if (document.getElementById('dm-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'dm-modal';
    modal.className = 'dm-modal dm-hidden';
    modal.innerHTML = `
<div class="dm-card" role="dialog" aria-modal="true">
  <div class="dm-header">
    <div class="dm-title"><i class="fa-solid fa-comments"></i> Messages</div>
    <button class="dm-close" id="dm-close" title="Close">&times;</button>
  </div>
  <div class="dm-body">
    <aside class="dm-users" aria-label="Users">
      <div class="dm-search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="dm-user-search" type="text" placeholder="Search..." />
      </div>
      <div class="dm-user-list" id="dm-user-list"></div>
    </aside>
    <section class="dm-chat" aria-label="Chat">
      <div class="dm-chat-top">
        <div class="dm-chat-top-left">
          <button id="dm-back-users" class="dm-back" type="button" aria-label="Back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="dm-chat-ident">
            <div class="dm-chat-avatar" id="dm-chat-avatar">?</div>
            <div style="min-width:0;">
              <div class="dm-chat-title" id="dm-chat-title">Select a user</div>
              <div class="dm-meta" id="dm-chat-status"></div>
            </div>
          </div>
        </div>
        <div class="dm-chat-actions">
          <button id="dm-users-btn" class="dm-action" type="button" title="Users">
            <i class="fa-solid fa-users"></i><span>Users</span>
          </button>
        </div>
      </div>
      <div class="dm-message-list" id="dm-message-list">
        <div class="dm-empty" id="dm-empty-state">
          <div class="dm-empty-title">No conversation selected</div>
          <div class="dm-empty-sub">Pick a user from the list to start chatting.</div>
        </div>
      </div>
      <div class="dm-compose">
        <input id="dm-input" type="text" placeholder="Message..." autocomplete="off" />
        <button id="dm-send" type="button" title="Send">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </section>
  </div>
</div>
`;

    document.body.appendChild(modal);

    // Close actions
    modal.addEventListener('click', (e) => {
        if (e.target === modal) dmClose();
    });
    document.getElementById('dm-close')?.addEventListener('click', dmClose);
    document.addEventListener('keydown', (e) => {
        if (dmState.open && e.key === 'Escape') dmClose();
    });

    // Send
    const input = document.getElementById('dm-input');
    const sendBtn = document.getElementById('dm-send');
    sendBtn?.addEventListener('click', () => dmSendCurrent());
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            dmSendCurrent();
        }
    });

    // Search
    const search = document.getElementById('dm-user-search');
    search?.addEventListener('input', () => dmRenderUserList());

    // Mobile back (WhatsApp-like: Users list ↔ Chat)
    document.getElementById('dm-back-users')?.addEventListener('click', () => {
        dmSetMobileScreen('list');
        try { document.getElementById('dm-user-search')?.focus(); } catch (_) { /* ignore */ }
    });

// Users button (desktop + mobile): always brings you back to the user list.
document.getElementById('dm-users-btn')?.addEventListener('click', () => {
    dmSetMobileScreen('list');
    try { document.getElementById('dm-user-search')?.focus(); } catch (_) { /* ignore */ }
});


    // Keep layout correct on rotate / resize
    window.addEventListener('resize', () => {
        if (!dmState.open) return;
        dmSetMobileScreen(dmState.mobileScreen);
    });
}

function dmToast(fromName, text) {
    dmEnsureUI();
    const wrap = document.getElementById('dm-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'dm-toast';
    el.innerHTML = `<b>${escapeHtml(fromName || 'Message')}</b><div>${escapeHtml(text || '')}</div>`;
    wrap.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 260ms ease';
        setTimeout(() => el.remove(), 280);
    }, 3800);
}

function dmOpen() {
    dmEnsureUI();
    const modal = document.getElementById('dm-modal');
    if (!modal) return;
    modal.classList.remove('dm-hidden');
    dmState.open = true;
    dmSetMobileScreen('list');
    try { dmSubscribePresenceList(); } catch (_) { /* ignore */ }
    // Ensure approver list is loaded so the user picker isn't empty.
    try {
        const cached = getCachedApproversData();
        if (!cached || (typeof cached === 'object' && Object.keys(cached).length === 0)) {
            ensureApproverDataCached(true).then(() => {
                if (dmState.open) dmRenderUserList();
            });
        }
    } catch (_) { /* ignore */ }
    dmRenderUserList();
    setTimeout(() => {
        try {
            if (!dmState.open) return;
            if (dmIsMobile() && dmState.mobileScreen === 'list') {
                document.getElementById('dm-user-search')?.focus();
            }
        } catch (_) { /* ignore */ }
    }, 0);
}

function dmClose() {
    const modal = document.getElementById('dm-modal');
    if (modal) modal.classList.add('dm-hidden');
    dmState.open = false;
    try { dmUnsubscribePresenceList(); } catch (_) { /* ignore */ }
    dmSetMobileScreen('list');
}

function dmGetApproversList() {
    const data = getApproversDataSafe();
    if (!data) return [];
    const list = [];
    for (const key of Object.keys(data)) {
        const a = data[key];
        if (!a) continue;
        const name = String(a.Name || '').trim();
        if (!name) continue;
        // Hide self
        if (dmState.userKey && key === dmState.userKey) continue;
        list.push({
            key,
            name,
            position: String(a.Position || ''),
            role: String(a.Role || ''),
            site: String(a.Site || '')
        });
    }
    // Sort by online first then name
    list.sort((x, y) => {
        const xOn = !!(dmState.presenceCache?.[x.key]?.status === 'online');
        const yOn = !!(dmState.presenceCache?.[y.key]?.status === 'online');
        if (xOn !== yOn) return xOn ? -1 : 1;
        return x.name.localeCompare(y.name);
    });
    return list;
}

function dmTotalUnreadCount() {
    let total = 0;
    const u = dmState.unreadCache || {};
    for (const tid of Object.keys(u)) {
        const c = Number(u[tid]?.count || 0);
        if (c > 0) total += c;
    }
    return total;
}

function dmUpdateBadges() {
    const total = dmTotalUnreadCount();
    document.querySelectorAll('.dm-unread-badge').forEach(b => {
        if (!b) return;
        b.textContent = String(total);
        b.style.display = total > 0 ? 'inline-flex' : 'none';
    });
}

function dmInitials(name) {
    const s = String(name || '').trim();
    if (!s) return '?';
    const parts = s.split(/\s+/).filter(Boolean);
    const a = (parts[0] || '').charAt(0);
    const b = (parts[1] || '').charAt(0);
    const out = (a + b).toUpperCase();
    return out || s.charAt(0).toUpperCase();
}

function dmRenderUserList() {
    const listEl = document.getElementById('dm-user-list');
    if (!listEl) return;

    const q = String(document.getElementById('dm-user-search')?.value || '').trim().toLowerCase();
    const users = dmGetApproversList().filter(u => {
        if (!q) return true;
        return u.name.toLowerCase().includes(q) || (u.position || '').toLowerCase().includes(q);
    });

    listEl.innerHTML = '';
    if (!users.length) {
        listEl.innerHTML = `<div style="padding:14px;opacity:.8;">No users found.</div>`;
        return;
    }

    for (const u of users) {
        const pres = dmState.presenceCache?.[u.key] || {};
        const isOnline = pres.status === 'online';
        const threadId = dmGetThreadId(dmState.userKey, u.key);
        const unreadObj = dmState.unreadCache?.[threadId] || {};
        const unread = Number(unreadObj?.count || 0);
        const lastText = dmSafeText(unreadObj?.lastText || '');
        const lastTs = Number(unreadObj?.lastTs || 0);

        const metaText = lastText ? lastText : String((u.position || '').trim() || (u.site ? ('Site ' + u.site) : ''));
        const metaTime = lastTs ? formatChatTime(lastTs) : '';
        const active = dmState.toKey && dmState.toKey === u.key;

        const row = document.createElement('div');
        row.className = `dm-user${active ? ' active' : ''}`;
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        const initials = dmInitials(u.name);

        row.innerHTML = `
          <div class="dm-left">
            <div class="dm-avatar" aria-hidden="true">
              ${escapeHtml(initials)}
              <span class="dm-dot ${isOnline ? 'online' : ''}"></span>
            </div>
            <div style="min-width:0;">
              <div class="dm-name">${escapeHtml(u.name)}</div>
              <div class="dm-meta">${escapeHtml(metaText)}</div>
            </div>
          </div>
          ${unread > 0 ? `<div class="dm-badge">${unread}</div>` : (metaTime ? `<div class="dm-meta">${escapeHtml(metaTime)}</div>` : ``)}
        `;

        const open = () => dmOpenThread(u.key, u.name);
        row.addEventListener('click', open);
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });

        listEl.appendChild(row);
    }

    dmUpdateBadges();
}

function dmSetChatHeader() {
    const titleEl = document.getElementById('dm-chat-title');
    const statusEl = document.getElementById('dm-chat-status');
    const avatarEl = document.getElementById('dm-chat-avatar');
    if (!titleEl || !statusEl) return;

    if (!dmState.toKey) {
        titleEl.textContent = 'Select a user';
        statusEl.textContent = '';
        if (avatarEl) avatarEl.textContent = '?';
        return;
    }

    titleEl.textContent = dmState.toName || 'Chat';
    if (avatarEl) avatarEl.textContent = dmInitials(dmState.toName || '');

    const pres = dmState.presenceCache?.[dmState.toKey];
    const isOnline = pres && pres.status === 'online';
    if (isOnline) {
        statusEl.textContent = 'Online';
    } else {
        const lastSeen = Number(pres?.lastSeen || 0);
        statusEl.textContent = lastSeen ? (`Offline • last seen ${formatChatTime(lastSeen)}`) : 'Offline';
    }
}

function dmClearThreadListener() {
    try {
        if (dmState.threadMessagesRef && dmState.onThreadMsg) {
            dmState.threadMessagesRef.off('child_added', dmState.onThreadMsg);
        }
    } catch (_) { /* ignore */ }
    dmState.threadMessagesRef = null;
    dmState.onThreadMsg = null;
}

function dmOpenThread(toKey, toName) {
    dmEnsureUI();

    // If the modal is already open, do NOT re-run dmOpen() (it can reset layout & feel "stuck" on desktop).
    if (!dmState.open) dmOpen();

    dmState.toKey = String(toKey || '').trim();
    dmState.toName = String(toName || '').trim();
    dmState.threadId = dmGetThreadId(dmState.userKey, dmState.toKey);

    dmSetChatHeader();
    dmRenderUserList(); // update active highlight

    // Mobile (touch) mode: switch to chat view immediately (WhatsApp-like)
    dmSetMobileScreen('chat');
    try { document.getElementById('dm-input')?.focus(); } catch (_) { /* ignore */ }

    // mark read
    if (dmState.threadId) {
        db.ref(`${DM_UNREAD_ROOT}/${dmState.userKey}/${dmState.threadId}`).remove().catch(() => {});
    }

    // clear list and subscribe
    const msgList = document.getElementById('dm-message-list');
    if (msgList) {
        msgList.innerHTML = '';
        msgList.scrollTop = msgList.scrollHeight;
    }

    dmClearThreadListener();
    if (!dmState.threadId) return;

    dmState.threadMessagesRef = db.ref(`${DM_THREADS_ROOT}/${dmState.threadId}/messages`).limitToLast(200);
    dmState.onThreadMsg = (snap) => {
        const m = snap.val();
        if (!m) return;
        dmRenderMessage(m);
    };
    dmState.threadMessagesRef.on('child_added', dmState.onThreadMsg);
}

function dmRenderMessage(m) {
    const msgList = document.getElementById('dm-message-list');
    if (!msgList) return;

    const fromKey = String(m.fromKey || '');
    const isMe = (fromKey === dmState.userKey);
    const text = dmSafeText(m.text || '');
    if (!text) return;

    const el = document.createElement('div');
    el.className = `dm-msg ${isMe ? 'me' : ''}`;
    const ts = m.ts && typeof m.ts === 'number' ? m.ts : null;
    el.innerHTML = `
      <div>${escapeHtml(text)}</div>
      <div class="dm-ts">${escapeHtml(formatChatTime(ts))}</div>
    `;
    msgList.appendChild(el);

    // Auto scroll if near bottom
    const nearBottom = (msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight) < 120;
    if (nearBottom) msgList.scrollTop = msgList.scrollHeight;
}

function dmSendCurrent() {
    if (!dmState.toKey || !dmState.threadId) {
        dmToast('Messages', 'Select a user first.');
        return;
    }
    const input = document.getElementById('dm-input');
    const text = dmSafeText(input?.value || '');
    if (!text) return;
    if (input) input.value = '';
    dmSendMessage(dmState.toKey, dmState.toName, text);
}

async function dmSendMessage(toKey, toName, text) {
    const fromKey = dmState.userKey;
    const fromName = dmState.userName;
    const threadId = dmGetThreadId(fromKey, toKey);
    if (!fromKey || !toKey || !threadId) return;

    const msgId = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages`).push().key;
    const msg = {
        fromKey,
        fromName,
        toKey,
        toName: String(toName || '').trim(),
        text: dmSafeText(text),
        ts: firebase.database.ServerValue.TIMESTAMP
    };

    const updates = {};
    updates[`${DM_THREADS_ROOT}/${threadId}/participants/${fromKey}`] = true;
    updates[`${DM_THREADS_ROOT}/${threadId}/participants/${toKey}`] = true;
    updates[`${DM_THREADS_ROOT}/${threadId}/names/${fromKey}`] = fromName;
    updates[`${DM_THREADS_ROOT}/${threadId}/names/${toKey}`] = String(toName || '').trim();
    updates[`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`] = msg;
    updates[`${DM_INBOX_ROOT}/${toKey}/${msgId}`] = msg;

    try {
        await db.ref().update(updates);
        // Unread counters for recipient
        const base = db.ref(`${DM_UNREAD_ROOT}/${toKey}/${threadId}`);
        base.child('count').transaction(c => (Number(c) || 0) + 1);
        base.child('lastText').set(msg.text);
        base.child('lastTs').set(firebase.database.ServerValue.TIMESTAMP);
        base.child('fromName').set(fromName);
        base.child('fromKey').set(fromKey);
    } catch (e) {
        console.warn('DM send failed:', e);
        dmToast('Messages', 'Message failed to send (check rules / connection).');
    }
}

function dmInjectMessagesButtons() {
    // We place Messages next to Logout (desktop footer), and also in the mobile bottom bar.
    const targets = [
        // Mobile bottom bars (main nav lists)
        { ul: document.querySelector('#workdesk-nav ul'), id: 'dm-wd-link', liClass: 'wd-nav-messages-mobile' },
        { ul: document.querySelector('#im-nav ul'),       id: 'dm-im-link', liClass: 'im-nav-messages-mobile' },
        { ul: document.querySelector('#inv-nav ul'),      id: 'dm-inv-link', liClass: 'inv-nav-messages-mobile' },

        // Desktop: footer nav next to Logout
        { ul: document.querySelector('#workdesk-view .workdesk-footer-nav ul'),            id: 'dm-wd-link-footer',  liClass: 'dm-footer-link' },
        { ul: document.querySelector('#invoice-management-view .workdesk-footer-nav ul'), id: 'dm-im-link-footer',  liClass: 'dm-footer-link' },
        { ul: document.querySelector('#inventory-view .workdesk-footer-nav ul'),          id: 'dm-inv-link-footer', liClass: 'dm-footer-link' },
    ];

    for (const t of targets) {
        if (!t.ul) continue;

        // --- Cleanup: remove any legacy/duplicate "Messages" entries inside this list ---
        const allMsgAnchors = Array.from(t.ul.querySelectorAll('a')).filter(a => {
            const txt = (a.textContent || '').trim().toLowerCase();
            return a.classList.contains('dm-messages-link') || txt === 'messages';
        });

        const preferred = t.ul.querySelector(`#${t.id}`);
        if (preferred) {
            allMsgAnchors.forEach(a => {
                if (a !== preferred) a.closest('li')?.remove();
            });
        } else if (allMsgAnchors.length > 0) {
            // Re-use the first legacy "Messages" anchor (upgrade-in-place), remove the rest.
            const keep = allMsgAnchors[0];
            allMsgAnchors.slice(1).forEach(a => a.closest('li')?.remove());

            keep.id = t.id;
            keep.classList.add('dm-messages-link');
            keep.innerHTML = `
                <i class="fa-solid fa-comments"></i> Messages
                <span class="notification-badge dm-unread-badge" style="display:none; margin-left:8px;">0</span>
            `;
        }

        // If still missing, inject it
        if (!t.ul.querySelector(`#${t.id}`)) {
            const li = document.createElement('li');
            if (t.liClass) li.className = t.liClass;
            li.innerHTML = `
              <a href="#" id="${t.id}" class="dm-messages-link">
                <i class="fa-solid fa-comments"></i> Messages
                <span class="notification-badge dm-unread-badge" style="display:none; margin-left:8px;">0</span>
              </a>
            `;

            // Insert before logout if possible
            const logoutLi = Array.from(t.ul.children).find(x => (x.textContent || '').toLowerCase().includes('logout'));
            if (logoutLi) t.ul.insertBefore(li, logoutLi);
            else t.ul.appendChild(li);
        }

        // Bind click (ensure it is bound exactly once)
        const a = t.ul.querySelector(`#${t.id}`);
        if (a && !a.dataset.dmBound) {
            a.dataset.dmBound = '1';
            a.addEventListener('click', (e) => {
                e.preventDefault();
                dmOpen();
            });
        }
    }

    dmUpdateBadges();
}

function dmStartPresence() {
    if (!dmState.userKey) return;
    dmState.connectedRef = db.ref('.info/connected');
    dmState.onConnected = (snap) => {
        if (snap.val() !== true) return;
        dmState.presenceRef = db.ref(`${DM_PRESENCE_ROOT}/${dmState.userKey}`);
        const offlinePayload = {
            name: dmState.userName,
            status: 'offline',
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        };
        dmState.presenceRef.onDisconnect().set(offlinePayload);
        dmState.presenceRef.set({
            name: dmState.userName,
            status: 'online',
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    };
    dmState.connectedRef.on('value', dmState.onConnected);

    if (dmState.heartbeatInterval) clearInterval(dmState.heartbeatInterval);
    // Heartbeat keeps your "online" status fresh. Slower interval = less mobile data.
    dmState.heartbeatInterval = setInterval(() => {
        if (dmState.presenceRef) {
            dmState.presenceRef.update({ status: 'online', lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }
    }, 120_000);

    window.addEventListener('beforeunload', () => {
        try {
            dmState.presenceRef?.update({ status: 'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP });
        } catch (_) { /* ignore */ }
    });

    // NOTE: We subscribe to the presence list only while the Messages window is open.
    // This reduces background downloads on mobile.
}

function dmSubscribePresenceList() {
    if (dmState.presenceListRef) return;
    dmState.presenceCache = dmState.presenceCache || {};
    dmState.presenceListRef = db.ref(DM_PRESENCE_ROOT);

    const onChild = (snap) => {
        dmState.presenceCache[snap.key] = snap.val() || {};
        if (dmState.open) dmRenderUserList();
        dmSetChatHeader();
    };
    const onRemoved = (snap) => {
        try { delete dmState.presenceCache[snap.key]; } catch (_) { /* ignore */ }
        if (dmState.open) dmRenderUserList();
        dmSetChatHeader();
    };

    dmState.onPresenceChild = onChild;
    dmState.onPresenceRemoved = onRemoved;

    dmState.presenceListRef.on('child_added', onChild);
    dmState.presenceListRef.on('child_changed', onChild);
    dmState.presenceListRef.on('child_removed', onRemoved);
}

function dmUnsubscribePresenceList() {
    try {
        if (!dmState.presenceListRef) return;
        if (dmState.onPresenceChild) {
            dmState.presenceListRef.off('child_added', dmState.onPresenceChild);
            dmState.presenceListRef.off('child_changed', dmState.onPresenceChild);
        }
        if (dmState.onPresenceRemoved) {
            dmState.presenceListRef.off('child_removed', dmState.onPresenceRemoved);
        }
    } catch (_) { /* ignore */ }
    dmState.presenceListRef = null;
    dmState.onPresenceChild = null;
    dmState.onPresenceRemoved = null;
}

function dmSubscribeInbox() {
    if (!dmState.userKey) return;
    dmState.inboxRef = db.ref(`${DM_INBOX_ROOT}/${dmState.userKey}`).limitToLast(50);
    dmState.onInbox = (snap) => {
        const m = snap.val();
        if (!m) return;
        const fromName = String(m.fromName || m.from || 'Message');
        const text = dmSafeText(m.text || '');
        if (text) dmToast(fromName, text);

        // remove from inbox to avoid duplicates
        snap.ref.remove().catch(() => {});
    };
    dmState.inboxRef.on('child_added', dmState.onInbox);
}

function dmSubscribeUnread() {
    if (!dmState.userKey) return;
    dmState.unreadRef = db.ref(`${DM_UNREAD_ROOT}/${dmState.userKey}`);
    dmState.onUnread = (snap) => {
        dmState.unreadCache = snap.val() || {};
        dmUpdateBadges();
        if (dmState.open) dmRenderUserList();
    };
    dmState.unreadRef.on('value', dmState.onUnread);
}

function initDirectMessages() {
    if (dmState.initialized) return;
    if (!currentApprover || !currentApprover.key) return;

    dmState.userKey = String(currentApprover.key);
    dmState.userName = String(currentApprover.Name || currentApprover.Username || currentApprover.Email || 'User').trim();
    dmState.initialized = true;

    // Preload approvers so the user list can render immediately.
    try {
        ensureApproverDataCached(false).then(() => {
            if (dmState.open) dmRenderUserList();
        });
    } catch (_) { /* ignore */ }

    // If an older "Live Chat" bubble exists in the DOM from previous versions,
    // hide it to avoid confusion (DM is the supported chat feature).
    try {
        document.getElementById('live-chat-fab')?.classList.add('hidden');
        document.getElementById('live-chat-panel')?.classList.add('hidden');
    } catch (_) { /* ignore */ }

    try { dmEnsureUI(); } catch (_) {}
    try { dmInjectMessagesButtons(); } catch (_) {}
    try { dmStartPresence(); } catch (e) { console.warn('DM presence init failed:', e); }
    try { dmSubscribeUnread(); } catch (e) { console.warn('DM unread init failed:', e); }
    try { dmSubscribeInbox(); } catch (e) { console.warn('DM inbox init failed:', e); }
}

function shutdownDirectMessages() {
    try {
        dmClearThreadListener();
        if (dmState.heartbeatInterval) {
            clearInterval(dmState.heartbeatInterval);
            dmState.heartbeatInterval = null;
        }
        if (dmState.presenceRef) {
            dmState.presenceRef.update({ status: 'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }
        if (dmState.connectedRef && dmState.onConnected) dmState.connectedRef.off('value', dmState.onConnected);
        if (dmState.inboxRef && dmState.onInbox) dmState.inboxRef.off('child_added', dmState.onInbox);
        if (dmState.unreadRef && dmState.onUnread) dmState.unreadRef.off('value', dmState.onUnread);
        dmUnsubscribePresenceList();
    } catch (e) {
        console.warn('DM shutdown warning:', e);
    }
}


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
let navigationContextList = [];
let navigationContextIndex = -1;
let currentPOInvoices = {};
let currentReportData = [];
let invoicesToPay = {};
let imFinanceAllPaymentsData = {};

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

// ==========================================================================
// 3. DATA FETCHING & CACHING LOGIC
// ==========================================================================

function setCache(key, data) {
    try {
        const item = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(item));
        console.log(`Saved data to localStorage cache: ${key}`);
    } catch (error) {
        console.error(`Error saving to localStorage ${key}:`, error);
        console.warn(`Could not cache ${key}. File may be too large for localStorage.`);
    }
}

function getCache(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    try {
        const item = JSON.parse(itemStr);
        const isStale = (Date.now() - item.timestamp) > CACHE_DURATION;
        return {
            data: item.data,
            isStale: isStale
        };
    } catch (error) {
        console.error(`Error parsing cache ${key}:`, error);
        localStorage.removeItem(key);
        return null;
    }
}

function loadDataFromLocalStorage() {
    const epicoreCache = getCache('cached_EPICORE');
    const sitesCache = getCache('cached_SITES');

    if (epicoreCache) {
        allEpicoreData = epicoreCache.data;
        cacheTimestamps.epicoreData = epicoreCache.isStale ? 0 : Date.now();
    }
    if (sitesCache) {
        allSitesCSVData = sitesCache.data;
        cacheTimestamps.sitesCSV = sitesCache.isStale ? 0 : Date.now();
    }

    if (allEpicoreData && allSitesCSVData) return true;
    return false;
}

// NEW HELPER: Get URL from Firebase Storage
async function getFirebaseCSVUrl(filename) {
    // This Base URL points to your specific GitHub repository via a fast CDN
    const baseUrl = "https://cdn.jsdelivr.net/gh/DC-database/Hub@main/";

    // This automatically combines the base URL with whatever filename is requested
    // Example: baseUrl + 'POVALUE2.csv'
    return `${baseUrl}${filename}`;
}

async function silentlyRefreshStaleCaches() {
    console.log("Checking for stale background caches...");
    const now = Date.now();

    try {
        if (cacheTimestamps.epicoreData === 0) {
            console.log("Silently refreshing Ecost.csv...");
            const url = await getFirebaseCSVUrl('Ecost.csv');
            if (url) {
                const epicoreCsvData = await fetchAndParseEpicoreCSV(url);
                if (epicoreCsvData) {
                    allEpicoreData = epicoreCsvData;
                    setCache('cached_EPICORE', allEpicoreData);
                    cacheTimestamps.epicoreData = now;
                }
            }
        }
        if (cacheTimestamps.sitesCSV === 0) {
            console.log("Silently refreshing Site.csv...");
            const url = await getFirebaseCSVUrl('Site.csv');
            if (url) {
                const sitesCsvData = await fetchAndParseSitesCSV(url);
                if (sitesCsvData) {
                    allSitesCSVData = sitesCsvData;
                    setCache('cached_SITES', allSitesCSVData);
                    cacheTimestamps.sitesCSV = now;
                }
            }
        }
        console.log("Background cache check complete.");
    } catch (error) {
        console.warn("Silent background cache refresh failed:", error.message);
    }
}

// --- CSV Parsers ---

async function fetchAndParseCSV(url) {
    try {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        // Remove Byte Order Mark (BOM) if present
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');

        if (lines.length < 2) {
            throw new Error("CSV is empty or has no data rows.");
        }

        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());
            // CRITICAL FIX: Add .trim() here to remove spaces from "21284 "
            return values.map(v => v.replace(/^"|"$/g, '').trim());
        };

        // 1. Identify Headers
        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        const headersLower = headers.map(h => h.toLowerCase());

        console.log("CSV Headers Found:", headers);

        // 2. Find 'PO' Column (Flexible)
        let poHeaderIndex = headersLower.findIndex(h => h.includes('po number') || h === 'po' || h === 'po_number');
        if (poHeaderIndex === -1) poHeaderIndex = 1; // Fallback to Col B

        // 3. Find 'ReqNum' Column (Flexible)
        // Looks for "reqnum", "req num", "req no", or just starts with "req"
        let refHeaderIndex = headersLower.findIndex(h => h === 'reqnum' || h === 'req num' || h === 'req no' || h.startsWith('req'));
        if (refHeaderIndex === -1) refHeaderIndex = 0; // Fallback to Col A

        console.log(`Mapping: PO is Col ${poHeaderIndex}, ReqNum is Col ${refHeaderIndex}`);

        const poDataByPO = {};
        const poDataByRef = {};

        // 4. Parse Rows
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);

            // Map values to headers
            const poEntry = {};
            headers.forEach((header, index) => {
                let val = values[index] || '';
                if (header.toLowerCase() === 'amount') {
                    val = val.replace(/,/g, '') || '0';
                }
                poEntry[header] = val;
            });

            // Index by PO
            const poKey = values[poHeaderIndex] ? values[poHeaderIndex].toUpperCase() : null;
            if (poKey) poDataByPO[poKey] = poEntry;

            // Index by Ref (ReqNum) - CRITICAL: Force String and Trim
            const rawRef = values[refHeaderIndex];
            if (rawRef) {
                const refKey = String(rawRef).trim();
                poDataByRef[refKey] = poEntry;
                // Backup: Save uppercase version too just in case
                poDataByRef[refKey.toUpperCase()] = poEntry;
            }
        }

        console.log(`CSV Loaded. ${Object.keys(poDataByRef).length} References indexed.`);
        return {
            poDataByPO,
            poDataByRef
        };

    } catch (error) {
        console.error("Error fetching PO CSV:", error);
        return null;
    }
}

async function fetchAndParseEpicoreCSV(url) {
    try {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();

        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };

        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 1) {
            throw new Error("Epicore CSV is empty.");
        }

        const epicoreMap = {};
        for (let i = 0; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);

            // Column Mapping (0-based index):
            // A[0], B[1], C[2]=PO, D[3]=Project#, E[4]=Description

            if (values.length > 4) {
                const poKey = values[2] ? values[2].toUpperCase().trim() : null;
                const description = values[4] || ''; // Grab Column E

                if (poKey) {
                    epicoreMap[poKey] = description;
                }
            }
        }
        console.log(`Successfully fetched and parsed ${Object.keys(epicoreMap).length} entries from Epicore CSV.`);
        return epicoreMap;
    } catch (error) {
        console.error("Error fetching or parsing Epicore CSV:", error);
        alert("CRITICAL ERROR: Could not load Epicore data.");
        return null;
    }
}

async function fetchAndParseSitesCSV(url) {
    try {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Sites CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Site.csv is empty or has no data rows.");
        }
        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };
        const headers = parseCsvRow(lines[0]).map(h => h.trim().toLowerCase());
        let siteIndex = headers.indexOf('site');
        let descIndex = headers.indexOf('description');
        if (siteIndex === -1) siteIndex = 0;
        if (descIndex === -1) descIndex = 1;
        const sitesData = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length >= Math.max(siteIndex, descIndex)) {
                const site = values[siteIndex];
                const description = values[descIndex];
                if (site && description) {
                    sitesData.push({
                        site,
                        description
                    });
                }
            }
        }
        console.log(`Successfully fetched and parsed ${sitesData.length} sites from Site.csv.`);
        return sitesData;
    } catch (error) {
        console.error("Error fetching or parsing Site.csv:", error);
        alert("CRITICAL ERROR: Could not load Site data.");
        return null;
    }
}

async function fetchAndParseEcommitCSV(url) {
    try {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Ecommit CSV is empty or has no data rows.");
        }

        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values.map(v => v.replace(/^"|"$/g, ''));
        };

        const cleanInvoiceNumber = (str) => {
            if (!str) return '';
            let cleanStr = str.trim().replace(/^"|"$/g, '');
            if (cleanStr.toUpperCase().includes('E+')) {
                try {
                    const num = Number(cleanStr);
                    if (!isNaN(num)) {
                        return num.toLocaleString('fullwide', {
                            useGrouping: false
                        });
                    }
                } catch (e) {
                    return cleanStr;
                }
            }
            return cleanStr;
        };

        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        const headerMap = {};
        headers.forEach((h, i) => {
            headerMap[h] = i;
        });

        const requiredHeaders = ['PO', 'Whse', 'Date', 'Sys Date', 'Name', 'Packing Slip', 'Extended Cost'];
        if (!requiredHeaders.every(h => headerMap.hasOwnProperty(h))) {
            throw new Error("Ecommit CSV is missing required headers.");
        }

        const poMap = {};
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length < headers.length) continue;

            const po = values[headerMap['PO']]?.toUpperCase().trim();
            if (!po) continue;

            const extendedCost = parseFloat(values[headerMap['Extended Cost']]?.replace(/,/g, '') || 0);
            const rawPackingSlip = values[headerMap['Packing Slip']] || '';
            const fixedPackingSlip = cleanInvoiceNumber(rawPackingSlip);

            const record = {
                po: po,
                site: values[headerMap['Whse']] || '',
                date: values[headerMap['Date']] || '',
                sysDate: values[headerMap['Sys Date']] || '',
                supplierName: values[headerMap['Name']] || '',
                packingSlip: fixedPackingSlip,
                invValue: extendedCost,
                rawDate: values[headerMap['Date']]
            };
            if (!poMap[po]) poMap[po] = [];
            poMap[po].push(record);
        }

        const finalEcommitData = {};
        Object.keys(poMap).forEach(po => {
            const recordsForPO = poMap[po];
            const summedRecords = new Map();

            recordsForPO.forEach(record => {
                const key = record.packingSlip;
                if (!key) return;

                if (summedRecords.has(key)) {
                    const existing = summedRecords.get(key);
                    existing.invValue = existing.invValue + record.invValue;

                    const existingDate = new Date(existing.rawDate);
                    const newDate = new Date(record.rawDate);
                    if (newDate < existingDate) {
                        existing.rawDate = record.rawDate;
                        existing.date = record.date;
                        existing.sysDate = record.sysDate;
                    }
                } else {
                    summedRecords.set(key, {
                        ...record
                    });
                }
            });

            const poRecords = Array.from(summedRecords.values());
            poRecords.sort((a, b) => {
                const dateA = new Date(a.rawDate);
                const dateB = new Date(b.rawDate);
                if (dateA - dateB !== 0) return dateA - dateB;
                return a.packingSlip.localeCompare(b.packingSlip);
            });

            const formattedRecords = [];
            poRecords.forEach((record, index) => {
                formattedRecords.push({
                    invNumber: record.packingSlip,
                    invoiceDate: normalizeDateForInput(record.date),
                    releaseDate: normalizeDateForInput(record.sysDate),
                    invValue: record.invValue.toFixed(2),
                    amountPaid: record.invValue.toFixed(2),
                    status: 'Epicore Value',
                    source: 'ecommit',
                    key: `ecommit_${record.packingSlip}`
                });
            });
            finalEcommitData[po] = formattedRecords;
        });

        console.log(`Successfully processed ${Object.keys(finalEcommitData).length} POs from Ecommit.csv.`);
        return finalEcommitData;
    } catch (error) {
        console.error("Error fetching or parsing Ecommit CSV:", error);
        alert("CRITICAL ERROR: Could not load Ecommit data.");
        return null;
    }
}
async function fetchAndParseEcostCSV(url) {
    try {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Ecost CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Ecost CSV is empty or has no data rows.");
        }

        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i - 1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };

        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        const headerMap = {};
        headers.forEach((h, i) => {
            headerMap[h] = i;
        });

        const requiredHeaders = ['Order Date', 'Project #', 'Name', 'Line Amount', 'Delivered Amount', 'Outstanding', 'Activity Name'];
        for (const h of requiredHeaders) {
            if (typeof headerMap[h] === 'undefined') {
                console.warn(`Ecost CSV is missing expected header: ${h}`);
            }
        }

        const dateIndex = headerMap['Order Date'];
        const projectIndex = headerMap['Project #'];
        const vendorIndex = headerMap['Name'];
        const lineAmountIndex = headerMap['Line Amount'];
        const deliveredIndex = headerMap['Delivered Amount'];
        const outstandingIndex = headerMap['Outstanding'];
        const activityIndex = headerMap['Activity Name'];

        const processedData = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length < headers.length) continue;

            const orderDateStr = values[dateIndex];
            let orderDate = null;
            let year = null;
            let month = null;

            if (orderDateStr && orderDateStr.includes('-')) {
                const parts = orderDateStr.split('-');
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const monthIndex = parseInt(parts[1], 10) - 1;
                    let fullYear = parseInt(parts[2], 10);
                    if (fullYear < 100) {
                        fullYear += 2000;
                    }
                    orderDate = new Date(Date.UTC(fullYear, monthIndex, day));
                }
            }
            if (!orderDate || isNaN(orderDate)) {
                orderDate = new Date(orderDateStr);
            }

            if (orderDate && !isNaN(orderDate)) {
                const now = new Date();
                if (orderDate > now) {
                    continue;
                }
                year = orderDate.getFullYear();
                month = orderDate.getMonth();
            } else {
                continue;
            }

            processedData.push({
                'Order Date': orderDate,
                'Year': year,
                'Month': month,
                'Project #': values[projectIndex],
                'Vendor': values[vendorIndex],
                'Total Committed': parseFloat(values[lineAmountIndex].replace(/,/g, '')) || 0,
                'Delivered Amount': parseFloat(values[deliveredIndex].replace(/,/g, '')) || 0,
                'Outstanding': parseFloat(values[outstandingIndex].replace(/,/g, '')) || 0,
                'Activity Name': values[activityIndex]
            });
        }
        console.log(`Successfully parsed ${processedData.length} rows from Ecost.csv`);
        return processedData;
    } catch (error) {
        console.error("Error fetching or parsing Ecost CSV:", error);
        alert(`CRITICAL ERROR: Could not load dashboard data. ${error.message}`);
        return null;
    }
}

// ==========================================================================
// FIX: ensureEcostDataFetched (Uses correct URL generator)
// ==========================================================================
async function ensureEcostDataFetched(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && allEcostData && (now - ecostDataTimestamp < CACHE_DURATION)) {
        return allEcostData;
    }

    console.log("Fetching Ecost.csv data...");

    // --- THE FIX IS HERE: Get the URL dynamically instead of using undefined variable ---
    const url = await getFirebaseCSVUrl('Ecost.csv');

    if (url) {
        allEcostData = await fetchAndParseEcostCSV(url);
        if (allEcostData) {
            ecostDataTimestamp = now;
            console.log("Ecost.csv data cached.");
        }
    }
    return allEcostData;
}

// =========================================================
// DATA FETCHER (CORRECTED: Reads from 'purchase_orders' in Invoice DB)
// =========================================================
async function ensureInvoiceDataFetched(forceRefresh = false) {
    const now = Date.now();

    if (!forceRefresh && allPOData && allInvoiceData && allEpicoreData && allSitesCSVData && allEcommitDataProcessed && allVendorsData) {
        return;
    }

    if (!forceRefresh) {
        loadDataFromLocalStorage();
    }

    try {
        const promisesToRun = [];

        // URLs
        const poUrl = (!allPOData || forceRefresh) ? await getFirebaseCSVUrl('POVALUE2.csv') : null;
        const ecostUrl = (!allEpicoreData || forceRefresh) ? await getFirebaseCSVUrl('Ecost.csv') : null;
        const siteUrl = (!allSitesCSVData || forceRefresh) ? await getFirebaseCSVUrl('Site.csv') : null;
        const ecommitUrl = (!allEcommitDataProcessed || forceRefresh) ? await getFirebaseCSVUrl('ECommit.csv') : null;
        const vendorUrl = (!allVendorsData || forceRefresh) ? await getFirebaseCSVUrl('Vendors.csv') : null;

        if (poUrl) {
            console.log("Fetching POVALUE2.csv...");
            promisesToRun.push(fetchAndParseCSV(poUrl));

            // --- CORRECTED FETCH: Get Manual POs from Invoice DB ---
            console.log("Fetching Manual POs from purchase_orders...");
            // Use invoiceDb (invoiceentry-b15a8) instead of db
            promisesToRun.push(invoiceDb.ref('purchase_orders').once('value'));
        }
        if (ecostUrl) promisesToRun.push(fetchAndParseEpicoreCSV(ecostUrl));
        if (siteUrl) promisesToRun.push(fetchAndParseSitesCSV(siteUrl));
        if (ecommitUrl) promisesToRun.push(fetchAndParseEcommitCSV(ecommitUrl));
        if (vendorUrl) promisesToRun.push(fetchAndParseVendorsCSV(vendorUrl));

        if (!allInvoiceData || forceRefresh) {
            promisesToRun.push(invoiceDb.ref('invoice_entries').once('value'));
        }

        const results = await Promise.all(promisesToRun);
        let resultIndex = 0;

        if (poUrl) {
            // 1. CSV Result
            const csvData = results[resultIndex++];
            
            // 2. Manual PO Result (from purchase_orders)
            const manualPOSnapshot = results[resultIndex++];
            const manualPOData = manualPOSnapshot.val();

            if (csvData === null) throw new Error("Failed to load POVALUE2.csv");

            allPOData = csvData.poDataByPO;
            allPODataByRef = csvData.poDataByRef;

            // --- MERGE LOGIC ---
            if (manualPOData) {
                console.log("Merging Manual POs into memory...");
                if (!allPOData) allPOData = {};
                Object.keys(manualPOData).forEach(poKey => {
                    const normalizedKey = String(poKey || '').trim().toUpperCase();
                    const poObj = manualPOData[poKey] || {};
                    // Backward-compat: some older records used colon in keys (e.g. 'Project ID:')
                    if (poObj['Project ID:'] && !poObj['Project ID']) poObj['Project ID'] = poObj['Project ID:'];
                    if (poObj['Supplier Name:'] && !poObj['Supplier Name']) poObj['Supplier Name'] = poObj['Supplier Name:'];
                    // More backward-compat / alternate headers
                    if (poObj['Supplier'] && !poObj['Supplier Name']) poObj['Supplier Name'] = poObj['Supplier'];
                    if (poObj['Supplier:'] && !poObj['Supplier Name']) poObj['Supplier Name'] = poObj['Supplier:'];
                    if (poObj['Po'] && !poObj['PO']) poObj['PO'] = poObj['Po'];
                    if (poObj['PO'] && !poObj['Po']) poObj['Po'] = poObj['PO'];
                    allPOData[normalizedKey || poKey] = poObj; // Add/Overwrite
                });
            }
            cacheTimestamps.poData = now;
        }

        if (ecostUrl) {
            allEpicoreData = results[resultIndex++];
            setCache('cached_EPICORE', allEpicoreData);
            cacheTimestamps.epicoreData = now;
        }
        if (siteUrl) {
            allSitesCSVData = results[resultIndex++];
            setCache('cached_SITES', allSitesCSVData);
            cacheTimestamps.sitesCSV = now;
        }
        if (ecommitUrl) {
            allEcommitDataProcessed = results[resultIndex++];
            cacheTimestamps.ecommitData = now;
        }
        if (vendorUrl) {
            allVendorsData = results[resultIndex++] || {};
        }

        if (!allInvoiceData || forceRefresh) {
            const invoiceSnapshot = results[resultIndex++];
            allInvoiceData = invoiceSnapshot.val() || {};
            cacheTimestamps.invoiceData = now;

            allUniqueNotes = new Set();
            for (const po in allInvoiceData) {
                for (const invKey in allInvoiceData[po]) {
                    const invoice = allInvoiceData[po][invKey];
                    if (invoice.note && invoice.note.trim() !== '') {
                        allUniqueNotes.add(invoice.note.trim());
                    }
                }
            }
        }
    } catch (error) {
        console.error("CRITICAL: Failed to fetch required data:", error);
        alert("CRITICAL ERROR: Failed to download data. Check connection.");
        throw error;
    }
}

// ==========================================================================
// DATA FETCHER (Reverted to 4.7.2 Logic + Force Refresh Support)
// ==========================================================================
async function ensureAllEntriesFetched(forceRefresh = false) { 
    const now = Date.now();
    
    // 1. Check Cache
    if (!forceRefresh && allSystemEntries.length > 0 && (now - cacheTimestamps.systemEntries < CACHE_DURATION)) {
        return;
    }

    console.log("Loading Data for Workdesk...");

    const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
    const { poDataByPO, poDataByRef } = await fetchAndParseCSV(PO_DATA_URL) || {};

    allPOData = poDataByPO || {};
    const purchaseOrdersDataByRef = poDataByRef || {};

    // 2. Fetch from Firebase (Standard + Transfers)
    // Removed orderByChild to ensure we get ALL data, even if timestamp is missing
    const [jobEntriesSnapshot, transferSnapshot] = await Promise.all([
        db.ref('job_entries').once('value'),
        db.ref('transfer_entries').once('value')
    ]);

    const jobEntriesData = jobEntriesSnapshot.val() || {};
    const transferData = transferSnapshot.val() || {};

    const processedEntries = [];
    const updatesToFirebase = {};

    // 3. Process Job Entries
    Object.entries(jobEntriesData).forEach(([key, value]) => {
        let entry = { key, ...value, source: 'job_entry' };

        // PR Matching Logic
        if (entry.for === 'PR' && entry.ref) {
            const refKey = String(entry.ref).trim();
            const csvMatch = purchaseOrdersDataByRef[refKey] || purchaseOrdersDataByRef[refKey.toUpperCase()];
            if (csvMatch) {
                const newPO = csvMatch['PO'] || csvMatch['PO Number'] || '';
                const newVendor = csvMatch['Supplier Name'] || csvMatch['Supplier'] || 'N/A';
                const newAmount = csvMatch['Amount'] || '';
                const newAttention = csvMatch['Buyer Name'] || csvMatch['Entry Person'] || 'Records';
                let rawDate = csvMatch['Order Date'] || '';
                let newDate = rawDate ? formatYYYYMMDD(normalizeDateForInput(rawDate)) : rawDate;
                
                entry.po = newPO;
                entry.vendorName = newVendor;
                entry.amount = newAmount;
                entry.attention = newAttention;
                entry.dateResponded = newDate;
                entry.remarks = 'PO Ready'; 

                if (value.remarks !== 'PO Ready') {
                    updatesToFirebase[key] = { po: newPO, vendorName: newVendor, amount: newAmount, attention: newAttention, dateResponded: newDate, remarks: 'PO Ready' };
                }
            }
        }
        if (!entry.vendorName && entry.po && allPOData[entry.po]) {
            entry.vendorName = allPOData[entry.po]['Supplier Name'] || 'N/A';
        }
        processedEntries.push(entry);
    });

    // 4. Process Transfer Entries (THIS IS WHAT POPULATES THE TAB)
    Object.entries(transferData).forEach(([key, value]) => {
        const from = value.fromLocation || value.fromSite || 'N/A';
        const to = value.toLocation || value.toSite || 'N/A';
        let combinedSite = `${from} ➔ ${to}`;
        if (value.jobType === 'Usage') combinedSite = `Used at ${from}`;

        let contactPerson = value.receiver || 'N/A';
        if (value.remarks === 'Pending') contactPerson = value.approver;

        processedEntries.push({
            key,
            ...value,
            source: 'transfer_entry',
            productID: value.productID || '',
            jobType: value.jobType || 'Transfer',
            for: value.jobType || 'Transfer', // <--- This 'for' property creates the Tab
            ref: value.controlNumber,
            controlId: value.controlNumber,
            site: combinedSite,
            orderedQty: value.requiredQty || 0,
            deliveredQty: value.receivedQty || 0,
            shippingDate: value.shippingDate || 'N/A',
            arrivalDate: value.arrivalDate || 'N/A',
            contactName: contactPerson,
            vendorName: value.productName,
            remarks: value.remarks || value.status || 'Pending'
        });
    });

    if (Object.keys(updatesToFirebase).length > 0) {
        try { await db.ref('job_entries').update(updatesToFirebase); } catch (e) {}
    }

    // 5. Sort & Save
    allSystemEntries = processedEntries;
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    cacheTimestamps.systemEntries = now;
    console.log(`Loaded ${allSystemEntries.length} entries.`);
}

async function ensureApproverDataCached(force = false) {
    // Keep this cache reasonably fresh because Vacation Delegation depends on it.
    // We re-fetch when:
    //  - force == true, OR
    //  - cache is empty, OR
    //  - cache is older than MAX_AGE_MS.
    const MAX_AGE_MS = 60 * 1000; // 1 minute (safe + light)
    const now = Date.now();

    try {
        if (!force && allApproverDataCache && cacheTimestamps && cacheTimestamps.approverData && (now - cacheTimestamps.approverData) < MAX_AGE_MS) {
            return;
        }
        if (!force && allApproverDataCache && (!cacheTimestamps || !cacheTimestamps.approverData)) {
            // Backward compatibility: if old builds never set the timestamp, keep current cache.
            return;
        }

        const snapshot = await db.ref('approvers').once('value');
        allApproverDataCache = snapshot.val() || {};
        allApproverData = allApproverDataCache; // keep in sync for older logic paths
        if (cacheTimestamps) cacheTimestamps.approverData = now;
        console.log("Approver data cached/refreshed for position-matching.");
    } catch (e) {
        // Never hard-fail the UI if caching fails.
        console.warn("ensureApproverDataCached failed:", e);
    }
}

function updateLocalInvoiceCache(poNumber, invoiceKey, updatedData) {
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        allInvoiceData[poNumber][invoiceKey] = {
            ...allInvoiceData[poNumber][invoiceKey],
            ...updatedData
        };
    }
}
function addToLocalInvoiceCache(poNumber, newInvoiceData, newKey) {
    if (!allInvoiceData) allInvoiceData = {};
    if (!allInvoiceData[poNumber]) {
        allInvoiceData[poNumber] = {};
    }
    if (newKey) {
        allInvoiceData[poNumber][newKey] = newInvoiceData;
    } else {
        console.warn("Attempted to add to cache without a valid key:", poNumber, newInvoiceData);
    }
}
function removeFromLocalInvoiceCache(poNumber, invoiceKey) {
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        delete allInvoiceData[poNumber][invoiceKey];
    }
}

async function fetchAndParseVendorsCSV(url) {
    try {
        const response = await fetch(url, {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error("Failed to fetch Vendors CSV");
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');

        const vendorMap = {}; // Key: Supplier ID, Value: Vendor Name

        // Assuming Header is Row 0: Name,Supplier ID
        for (let i = 1; i < lines.length; i++) {
            // Simple comma split (assuming no commas IN the names for now, or use complex parser if needed)
            const parts = lines[i].split(',');
            if (parts.length >= 2) {
                // Assuming Column 0 = Name, Column 1 = ID
                // Clean up quotes if present
                const name = parts[0].replace(/^"|"$/g, '').trim();
                const id = parts[1].replace(/^"|"$/g, '').trim();
                if (id && name) {
                    vendorMap[id] = name;
                }
            }
        }
        console.log(`Cached ${Object.keys(vendorMap).length} vendors.`);
        return vendorMap;
    } catch (error) {
        console.error("Error parsing Vendors.csv:", error);
        return {};
    }
}

// ==========================================================================
// 4. GENERAL HELPER FUNCTIONS
// ==========================================================================

// --------------------------------------------------------------------------
// QUICK COPY SHORTCUTS
// Double-click supported fields to copy their current value to clipboard.
// --------------------------------------------------------------------------

function fallbackCopyText(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        console.error('Fallback copy failed', e);
        return false;
    }
}

async function copyTextToClipboard(text, feedbackEl) {
    if (!text) return false;

    const doFeedback = () => {
        if (!feedbackEl) return;
        const originalBg = feedbackEl.style.backgroundColor;
        feedbackEl.style.backgroundColor = '#d4edda'; // Light green flash
        feedbackEl.style.transition = 'background-color 0.3s';
        setTimeout(() => {
            feedbackEl.style.backgroundColor = originalBg;
        }, 450);
    };

    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            doFeedback();
            return true;
        }
    } catch (e) {
        // Ignore and fall back
    }

    const ok = fallbackCopyText(text);
    if (ok) doFeedback();
    return ok;
}

function bindDblClickCopy(el, getTextFn, feedbackEl) {
    if (!el) return;
    if (el.dataset && el.dataset.dblcopyBound === '1') return;
    if (el.dataset) el.dataset.dblcopyBound = '1';

    el.addEventListener('dblclick', (e) => {
        const raw = (typeof getTextFn === 'function')
            ? getTextFn()
            : (el.value !== undefined ? el.value : (el.innerText || el.textContent || ''));

        const text = (raw || '').toString().trim();
        if (!text) return;

        e.preventDefault();

        try {
            if (typeof el.focus === 'function') el.focus();
            if (typeof el.select === 'function') el.select();
        } catch (err) { /* ignore */ }

        copyTextToClipboard(text, feedbackEl || el);
    });
}

function normalizeMobile(mobile) {
    const digitsOnly = mobile.replace(/\D/g, '');
    if (digitsOnly.length === 8) {
        return `974${digitsOnly}`;
    }
    return digitsOnly;
}
function formatDate(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}
function formatYYYYMMDD(dateString) {
    if (!dateString) return 'N/A';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;

    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2];

    const month = months[monthIndex];
    if (!month) return dateString;

    return `${day}-${month}-${year}`;
}
function normalizeDateForInput(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const parts = dateString.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    if (/^\d{2}-\d{2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-');
        const day = parts[0];
        const month = parts[1];
        const year = `20${parts[2]}`;
        return `${year}-${month}-${day}`;
    }
    const date = new Date(dateString);
    if (!isNaN(date)) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    console.warn("Unrecognized date format:", dateString);
    return '';
}
function convertDisplayDateToInput(displayDate) {
    if (!displayDate || typeof displayDate !== 'string') return '';
    const parts = displayDate.split('-');
    if (parts.length !== 3) return '';
    const day = parts[0];
    const year = parts[2];
    const monthMap = {
        "Jan": "01",
        "Feb": "02",
        "Mar": "03",
        "Apr": "04",
        "May": "05",
        "Jun": "06",
        "Jul": "07",
        "Aug": "08",
        "Sep": "09",
        "Oct": "10",
        "Nov": "11",
        "Dec": "12"
    };
    const month = monthMap[parts[1]];
    if (!month) return '';
    return `${year}-${month}-${day}`;
}
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function formatCurrency(value) {
    if (typeof value === 'number') {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) {
        return 'N/A';
    }
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function formatFinanceNumber(value) {
    if (value === undefined || value === null || value === '') return '';
    const num = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? value : num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function formatFinanceDate(dateStr) {
    if (!dateStr || String(dateStr).trim() === '') return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return dateStr;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const utcDate = new Date(Date.UTC(year, month, day));

        const dayFormatted = utcDate.getUTCDate().toString().padStart(2, '0');
        const monthFormatted = utcDate.toLocaleString('default', {
            month: 'short',
            timeZone: 'UTC'
        }).toUpperCase();
        const yearFormatted = utcDate.getUTCFullYear();
        return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
    }
    const dayFormatted = date.getUTCDate().toString().padStart(2, '0');
    const monthFormatted = date.toLocaleString('default', {
        month: 'short',
        timeZone: 'UTC'
    }).toUpperCase();
    const yearFormatted = date.getUTCFullYear();
    return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
}
function formatFinanceDateLong(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const month = date.toLocaleString('default', {
        month: 'long'
    });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function numberToWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  const n = parseFloat(String(num).replace(/,/g, ''));
  if (!isFinite(n)) return '';

  const fixed = n.toFixed(2);
  const [intStr, fracStr] = fixed.split('.');

  function twoDigits(x) {
    if (x < 20) return a[x];
    const tens = Math.floor(x / 10);
    const ones = x % 10;
    return b[tens] + (ones ? ' ' + a[ones] : '');
  }

  function threeDigits(x) {
    const hundreds = Math.floor(x / 100);
    const rem = x % 100;
    let out = '';

    if (hundreds) {
      out += a[hundreds] + ' Hundred';
      if (rem) out += ' and ' + twoDigits(rem);
    } else if (rem) {
      out += twoDigits(rem);
    }
    return out.trim();
  }

  let words = '';
  let s = intStr;
  let scaleIndex = 0;

  if (parseInt(s, 10) === 0) {
    words = 'Zero';
  } else {
    const parts = [];
    while (s.length > 0) {
      const chunkStr = s.slice(-3);
      s = s.slice(0, -3);
      const chunkNum = parseInt(chunkStr, 10);

      if (chunkNum) {
        const chunkWords = threeDigits(chunkNum);
        const scale = scales[scaleIndex];
        parts.push((chunkWords + (scale ? ' ' + scale : '')).trim());
      }
      scaleIndex++;
    }
    words = parts.reverse().join(' ').trim();
  }

  // Keep the existing decimal style
  if (fracStr && parseInt(fracStr, 10) > 0) {
    words += ' and ' + fracStr + '/100';
  }

  return words.charAt(0).toUpperCase() + words.slice(1) + ' Qatari Riyals Only';
}


function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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

// ==========================================================================
// 5. DOM ELEMENT REFERENCES
// ==========================================================================

// --- Main Views ---
const views = {
    login: document.getElementById('login-view'),
    password: document.getElementById('password-view'),
    setup: document.getElementById('setup-view'),
    dashboard: document.getElementById('dashboard-view'),
    workdesk: document.getElementById('workdesk-view')
};

// --- Login & Setup Forms ---
const loginForm = document.getElementById('login-form');
const loginIdentifierInput = document.getElementById('login-identifier');
const desktopLoginPasswordInput = document.getElementById('login-password-desktop');
const loginError = document.getElementById('login-error');
const passwordForm = document.getElementById('password-form');
const passwordInput = document.getElementById('login-password');
const passwordUserIdentifier = document.getElementById('password-user-identifier');
const passwordError = document.getElementById('password-error');
const setupForm = document.getElementById('setup-form');
const setupEmailContainer = document.getElementById('setup-email-container');
const setupEmailInput = document.getElementById('setup-email');
const setupSiteContainer = document.getElementById('setup-site-container');
const setupSiteInput = document.getElementById('setup-site');
const setupPositionContainer = document.getElementById('setup-position-container');
const setupPositionInput = document.getElementById('setup-position');
const setupPasswordInput = document.getElementById('setup-password');
const setupError = document.getElementById('setup-error');

// --- Main Dashboard & Workdesk Navigation ---
const dashboardUsername = document.getElementById('dashboard-username');
const datetimeElement = document.getElementById('datetime');
const logoutButton = document.getElementById('logout-button');
const workdeskButton = document.getElementById('workdesk-button');
const wdUsername = document.getElementById('wd-username');
const wdUserIdentifier = document.getElementById('wd-user-identifier');
const workdeskNav = document.getElementById('workdesk-nav');
const workdeskSections = document.querySelectorAll('.workdesk-section');
const wdLogoutButton = document.getElementById('wd-logout-button');
const workdeskDatetimeElement = document.getElementById('workdesk-datetime');
const workdeskIMLinkContainer = document.getElementById('workdesk-im-link-container');
const workdeskIMLink = document.getElementById('workdesk-im-link');

// --- Workdesk: Job Entry ---
const jobEntryForm = document.getElementById('jobentry-form');
const jobForSelect = document.getElementById('job-for');
const jobDateInput = document.getElementById('job-date');
const jobEntrySearchInput = document.getElementById('job-entry-search');
const jobEntryTableWrapper = document.getElementById('job-entry-table-wrapper');
const jobEntryTableBody = document.getElementById('job-entry-table-body');
const jobEntryFormTitle = document.getElementById('standard-modal-title');
const deleteJobButton = document.getElementById('delete-job-button');
const jobEntryNavControls = document.getElementById('jobentry-nav-controls');
const navPrevJobButton = document.getElementById('nav-prev-job');
const navNextJobButton = document.getElementById('nav-next-job');
const navJobCounter = document.getElementById('nav-job-counter');
const addJobButton = document.getElementById('add-job-button');
const updateJobButton = document.getElementById('update-job-button');
const clearJobButton = document.getElementById('clear-job-button');

// --- Workdesk: Active Tasks ---
const activeTaskTableBody = document.getElementById('active-task-table-body');
const activeTaskFilters = document.getElementById('active-task-filters');
const activeTaskSearchInput = document.getElementById('active-task-search');
const activeTaskCountDisplay = document.getElementById('active-task-count-display');
const dbActiveTasksCount = document.getElementById('db-active-tasks-count');
const activeTaskClearButton = document.getElementById('active-task-clear-button');
const activeTaskCardLink = document.getElementById('db-active-tasks-card-link'); // Dashboard card

// --- Workdesk: Calendar & Day View ---
const wdCalendarGrid = document.getElementById('wd-calendar-grid');
const wdCalendarMonthYear = document.getElementById('wd-calendar-month-year');
const wdCalendarPrevBtn = document.getElementById('wd-calendar-prev');
const wdCalendarNextBtn = document.getElementById('wd-calendar-next');
const wdCalendarTaskListTitle = document.getElementById('wd-calendar-task-list-title');
const wdCalendarTaskListUl = document.getElementById('wd-calendar-task-list-ul');
const wdCalendarToggleBtn = document.getElementById('wd-calendar-toggle-view');
const wdCalendarYearGrid = document.getElementById('wd-calendar-year-grid');
const dayViewBackBtn = document.getElementById('wd-dayview-back-btn');
const dayViewPrevBtn = document.getElementById('wd-dayview-prev-btn');
const dayViewNextBtn = document.getElementById('wd-dayview-next-btn');
const dayViewTaskList = document.getElementById('wd-dayview-task-list');
const mobileMenuBtn = document.getElementById('wd-dayview-mobile-menu-btn');
const mobileNotifyBtn = document.getElementById('wd-dayview-mobile-notify-btn');
const mobileLogoutBtn = document.getElementById('wd-dayview-mobile-logout-btn-new');
const dateScroller = document.getElementById('wd-dayview-date-scroller-inner');
const calendarModalViewTasksBtn = document.getElementById('calendar-modal-view-tasks-btn');

// --- Workdesk: Reporting & Stats ---
const reportingTableBody = document.getElementById('reporting-table-body');
const reportingSearchInput = document.getElementById('reporting-search');
const reportTabsContainer = document.getElementById('report-tabs');
const printReportButton = document.getElementById('print-report-button');
const downloadWdReportButton = document.getElementById('download-wd-report-csv-button');
const wdInTransitReportBtn = document.getElementById('wd-inventory-intransit-report-btn');
const wdInTransitContactFilterSelect = document.getElementById('wd-inventory-intransit-contact-filter');
const dbCompletedTasksCount = document.getElementById('db-completed-tasks-count');
const dbSiteStatsContainer = document.getElementById('dashboard-site-stats');
const dbRecentTasksBody = document.getElementById('db-recent-tasks-body');
const jobRecordsCountDisplay = document.getElementById('job-records-count-display');

// --- Workdesk: Settings ---
const settingsForm = document.getElementById('settings-form');
const settingsNameInput = document.getElementById('settings-name');
const settingsEmailInput = document.getElementById('settings-email');
const settingsMobileInput = document.getElementById('settings-mobile');
const settingsPositionInput = document.getElementById('settings-position');
const settingsSiteInput = document.getElementById('settings-site');
const settingsPasswordInput = document.getElementById('settings-password');
const settingsVacationCheckbox = document.getElementById('settings-vacation');
const settingsReturnDateInput = document.getElementById('settings-return-date');
const settingsMessage = document.getElementById('settings-message');
const settingsVacationDetailsContainer = document.getElementById('settings-vacation-details-container');
const settingsReplacementNameInput = document.getElementById('settings-replacement-name');
const settingsReplacementContactInput = document.getElementById('settings-replacement-contact');
const settingsReplacementEmailInput = document.getElementById('settings-replacement-email');

// --- Workdesk: Super Admin Celebration Banner Settings ---
const celebrationSettingsContainer = document.getElementById('celebration-settings-container');
const celebrationEnabledCheckbox = document.getElementById('celebration-enabled');
const celebrationTitleInput = document.getElementById('celebration-title-input');
const celebrationSubtitleInput = document.getElementById('celebration-subtitle-input');
const celebrationEmojiInput = document.getElementById('celebration-emoji-input');
const celebrationStartDateInput = document.getElementById('celebration-start-date');
const celebrationEndDateInput = document.getElementById('celebration-end-date');
const celebrationShowModeSelect = document.getElementById('celebration-show-mode');
const celebrationSoundEnabledCheckbox = document.getElementById('celebration-sound-enabled');
const celebrationSoundUrlInput = document.getElementById('celebration-sound-url');
const celebrationSaveBtn = document.getElementById('celebration-save-btn');
const celebrationDisableBtn = document.getElementById('celebration-disable-btn');
const celebrationPreviewBtn = document.getElementById('celebration-preview-btn');
const celebrationSettingsMessage = document.getElementById('celebration-settings-message');



// --- Invoice Management (IM) Common ---
const invoiceManagementView = document.getElementById('invoice-management-view');
const imNav = document.getElementById('im-nav');
const imContentArea = document.getElementById('im-content-area');
const imMainElement = document.querySelector('#invoice-management-view .workdesk-main');
const invoiceManagementButton = document.getElementById('invoice-mgmt-button');
const imUsername = document.getElementById('im-username');
const imUserIdentifier = document.getElementById('im-user-identifier');
const imLogoutButton = document.getElementById('im-logout-button');
const imDatetimeElement = document.getElementById('im-datetime');
const imWorkdeskButton = document.getElementById('im-workdesk-button');
const imActiveTaskButton = document.getElementById('im-activetask-button');
const imBackToWDDashboardLink = document.getElementById('im-back-to-wd-dashboard-link'); // Mobile

// --- IM: Invoice Entry ---
const imPOSearchInput = document.getElementById('im-po-search-input');
const imPOSearchButton = document.getElementById('im-po-search-button');
const imPOSearchInputBottom = document.getElementById('im-po-search-input-bottom');
const imPOSearchButtonBottom = document.getElementById('im-po-search-button-bottom');
const imPODetailsContainer = document.getElementById('im-po-details-container');
const imNewInvoiceForm = document.getElementById('im-new-invoice-form');
const imInvoiceEntryModal = document.getElementById('im-invoice-entry-modal');
const imInvoiceFormTrigger = document.getElementById('im-invoice-form-trigger');
const imOpenInvoiceFormBtn = document.getElementById('im-open-invoice-form-btn');
const imInvEntryIdInput = document.getElementById('im-inv-entry-id');
const imFormTitle = document.getElementById('im-form-title');
const imAttentionSelect = document.getElementById('im-attention');
const imAddInvoiceButton = document.getElementById('im-add-invoice-button');
const imUpdateInvoiceButton = document.getElementById('im-update-invoice-button');
const imClearFormButton = document.getElementById('im-clear-form-button');
const imBackToActiveTaskButton = document.getElementById('im-back-to-active-task-button');
const imExistingInvoicesContainer = document.getElementById('im-existing-invoices-container');
const imInvoicesTableBody = document.getElementById('im-invoices-table-body');
const imInvoiceDateInput = document.getElementById('im-invoice-date');
const imReleaseDateInput = document.getElementById('im-release-date');
const imStatusSelect = document.getElementById('im-status');
const imInvValueInput = document.getElementById('im-inv-value');
const imAmountPaidInput = document.getElementById('im-amount-paid');
const existingInvoicesCountDisplay = document.getElementById('existing-invoices-count-display');
const imEntrySidebar = document.getElementById('im-entry-sidebar');
const imEntrySidebarList = document.getElementById('im-entry-sidebar-list');
const imShowActiveJobsBtn = document.getElementById('im-show-active-jobs-btn');
const activeJobsSidebarCountDisplay = document.getElementById('active-jobs-sidebar-count-display');



// =============================================================
// IM: Invoice Entry – UI helpers (visual only; does NOT change logic)
// =============================================================
const imAttentionGroup = document.getElementById('im-attention-group');

function imIsAttentionRequiredForStatus(statusValue) {
    return statusValue !== 'Under Review' && statusValue !== 'With Accounts';
}

function imUpdateAttentionRequiredUI(statusValue) {
    if (!imAttentionGroup) return;
    const required = imIsAttentionRequiredForStatus(statusValue || '');
    imAttentionGroup.classList.toggle('is-required', required);

    // If attention isn't required, clear any "invalid" visuals for it
    if (!required) {
        imAttentionGroup.classList.remove('im-invalid');
    }
}

function imClearInvoiceInvalidUI() {
    if (!imNewInvoiceForm) return;

    // Clear invalid on all invoice-entry inputs/selects/textareas
    imNewInvoiceForm.querySelectorAll('.im-invalid').forEach(el => el.classList.remove('im-invalid'));

    // Also clear group-level invalid states
    imNewInvoiceForm.querySelectorAll('.form-group.im-invalid').forEach(el => el.classList.remove('im-invalid'));
    if (imAttentionGroup) imAttentionGroup.classList.remove('im-invalid');
}

function imMarkInvoiceInvalidUI({ requireAttention = true } = {}) {
    if (!imNewInvoiceForm) return;

    const requiredIds = ['im-inv-no', 'im-inv-value', 'im-invoice-date', 'im-status'];
    requiredIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const missing = !String(el.value || '').trim();
        el.classList.toggle('im-invalid', missing);
        const group = el.closest('.form-group');
        if (group) group.classList.toggle('im-invalid', missing);
    });

    if (requireAttention) {
        const raw = imAttentionSelectChoices ? imAttentionSelectChoices.getValue(true) : (imAttentionSelect ? imAttentionSelect.value : '');
        const attentionMissing = !raw || raw === 'None';
        if (imAttentionGroup) imAttentionGroup.classList.toggle('im-invalid', attentionMissing);
    } else {
        if (imAttentionGroup) imAttentionGroup.classList.remove('im-invalid');
    }
}

// Clear invalid visuals as user types/changes (keeps the UI clean)
function imWireInvoiceValidationUI() {
    if (!imNewInvoiceForm) return;

    const clearFor = (id, evt = 'input') => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(evt, () => {
            el.classList.remove('im-invalid');
            const group = el.closest('.form-group');
            if (group) group.classList.remove('im-invalid');
        });
    };

    clearFor('im-inv-no', 'input');
    clearFor('im-inv-value', 'input');
    clearFor('im-invoice-date', 'change');
    clearFor('im-status', 'change');
    clearFor('im-details', 'input');
    clearFor('im-amount-paid', 'input');
    clearFor('im-release-date', 'change');
    clearFor('im-inv-name', 'input');
    clearFor('im-srv-name', 'input');
    clearFor('im-report-name', 'input');
    clearFor('im-note', 'input');

    if (imAttentionSelect) {
        imAttentionSelect.addEventListener('change', () => {
            if (imAttentionGroup) imAttentionGroup.classList.remove('im-invalid');
        });
    }
}

// --- IM: Batch Entry ---
const batchTableBody = document.getElementById('im-batch-table-body');
const batchClearBtn = document.getElementById('im-batch-clear-button');
const batchCountDisplay = document.getElementById('batch-count-display');
const imBatchSearchExistingButton = document.getElementById('im-batch-search-existing-button');
const imBatchSearchModal = document.getElementById('im-batch-search-modal');
const imBatchNoteSearchSelect = document.getElementById('im-batch-note-search-select');
const imBatchGlobalAttention = document.getElementById('im-batch-global-attention');
const imBatchGlobalStatus = document.getElementById('im-batch-global-status');
const imBatchGlobalNote = document.getElementById('im-batch-global-note');
const batchAddBtn = document.getElementById('im-batch-add-po-button');
const batchSaveBtn = document.getElementById('im-batch-save-button');
const batchPOInput = document.getElementById('im-batch-po-input');
const batchSearchStatusBtn = document.getElementById('im-batch-search-by-status-button');
const batchSearchNoteBtn = document.getElementById('im-batch-search-by-note-button');

// Batch Entry: Per-row Attention picker (modal)
const imAttentionPickerModal = document.getElementById('im-attention-picker-modal');
const imAttentionPickerSelect = document.getElementById('im-attention-picker-select');
const imAttentionPickerApplyBtn = document.getElementById('im-attention-picker-apply');
const imAttentionPickerCancelBtn = document.getElementById('im-attention-picker-cancel');
const imAttentionPickerCloseBtn = document.getElementById('im-attention-picker-close');

let imAttentionPickerChoices = null;
let imAttentionPickerActiveRow = null;

// --- IM: Payments ---
const paymentsNavLink = document.getElementById('payments-nav-link');
const imPaymentsSection = document.getElementById('im-payments');
const imAddPaymentButton = document.getElementById('im-add-payment-button');
const imPaymentsTableBody = document.getElementById('im-payments-table-body');
const imSavePaymentsButton = document.getElementById('im-save-payments-button');
const imAddPaymentModal = document.getElementById('im-add-payment-modal');
const imPaymentModalPOInput = document.getElementById('im-payment-modal-po-input');
const imPaymentModalSearchBtn = document.getElementById('im-payment-modal-search-btn');
const imPaymentModalResults = document.getElementById('im-payment-modal-results');
const imPaymentModalAddSelectedBtn = document.getElementById('im-payment-modal-add-selected-btn');
const paymentsCountDisplay = document.getElementById('payments-count-display');

// --- IM: Reporting & Finance ---
const imReportingForm = document.getElementById('im-reporting-form');
const imReportingContent = document.getElementById('im-reporting-content');
const imReportingSearchInput = document.getElementById('im-reporting-search');
const imReportingClearButton = document.getElementById('im-reporting-clear-button');
const imReportingDownloadCSVButton = document.getElementById('im-reporting-download-csv-button');
const imReportingPrintBtn = document.getElementById('im-reporting-print-btn');
const imReportingPrintableArea = document.getElementById('im-reporting-printable-area');
const imDailyReportDateInput = document.getElementById('im-daily-report-date');
const imDownloadDailyReportButton = document.getElementById('im-download-daily-report-button');
const imDownloadWithAccountsReportButton = document.getElementById('im-download-with-accounts-report-button');
const imReportingDownloadExcelButton = document.getElementById('im-reporting-download-btn');
const reportingCountDisplay = document.getElementById('reporting-count-display');
// Print Report Elements
const imPrintReportTitle = document.getElementById('im-print-report-title');
const imPrintReportDate = document.getElementById('im-print-report-date');
const imPrintReportSummaryPOs = document.getElementById('im-print-report-summary-pos');
const imPrintReportSummaryValue = document.getElementById('im-print-report-summary-value');
const imPrintReportSummaryPaid = document.getElementById('im-print-report-summary-paid');
const imPrintReportBody = document.getElementById('im-print-report-body');

// --- IM: Finance Report (Admin) ---
const imFinanceReportNavLink = document.getElementById('im-finance-report-nav-link');
const imFinanceReportSection = document.getElementById('im-finance-report');
const imFinanceSearchPoInput = document.getElementById('im-finance-search-po');
const imFinanceSearchBtn = document.getElementById('im-finance-search-btn');
const imFinanceClearBtn = document.getElementById('im-finance-clear-btn');
const imFinanceResults = document.getElementById('im-finance-results');
const imFinanceNoResults = document.getElementById('im-finance-no-results');
const imFinanceResultsBody = document.getElementById('im-finance-results-body');
const imFinanceReportModal = document.getElementById('im-finance-report-modal');
const imFinancePrintReportBtn = document.getElementById('im-finance-print-report-btn');
const financeReportCountDisplay = document.getElementById('finance-report-count-display');
// Finance Modal Details
const imReportDate = document.getElementById('im-reportDate');
const imReportPoNo = document.getElementById('im-reportPoNo');
const imReportProject = document.getElementById('im-reportProject');
const imReportVendorId = document.getElementById('im-reportVendorId');
const imReportVendorName = document.getElementById('im-reportVendorName');
const imReportTotalPoValue = document.getElementById('im-reportTotalPoValue');
const imReportTotalCertified = document.getElementById('im-reportTotalCertified');
const imReportTotalPrevPayment = document.getElementById('im-reportTotalPrevPayment');
const imReportTotalCommitted = document.getElementById('im-reportTotalCommitted');
const imReportTotalRetention = document.getElementById('im-reportTotalRetention');
const imReportTableBody = document.getElementById('im-reportTableBody');
const imReportTotalCertifiedAmount = document.getElementById('im-reportTotalCertifiedAmount');
const imReportTotalRetentionAmount = document.getElementById('im-reportTotalRetentionAmount');
const imReportTotalPaymentAmount = document.getElementById('im-reportTotalPaymentAmount');
const imReportNotesSection = document.getElementById('im-reportNotesSection');
const imReportNotesContent = document.getElementById('im-reportNotesContent');

// --- IM: Summary Note ---
const summaryNotePreviousInput = document.getElementById('summary-note-previous-input');
const summaryNoteCurrentInput = document.getElementById('summary-note-current-input');
const summaryNoteGenerateBtn = document.getElementById('summary-note-generate-btn');
const summaryNoteUpdateBtn = document.getElementById('summary-note-update-btn');
const summaryNotePrevPdfBtn = document.getElementById('summary-note-prev-pdf-btn'); // <--- ADD THIS
const summaryNotePrintBtn = document.getElementById('summary-note-print-btn');
const summaryNotePrintArea = document.getElementById('summary-note-printable-area');
const snDate = document.getElementById('sn-date');
const snPrevSummaryDate = document.getElementById('sn-prev-summary-date');
const snVendorName = document.getElementById('sn-vendor-name');
const snPreviousPayment = document.getElementById('sn-previous-payment');
const snCurrentPayment = document.getElementById('sn-current-payment');
const snTableBody = document.getElementById('sn-table-body');
const snTotalInWords = document.getElementById('sn-total-in-words');
const snTotalNumeric = document.getElementById('sn-total-numeric');
const noteSuggestionsDatalist = document.getElementById('note-suggestions');
const summaryNoteCountDisplay = document.getElementById('summary-note-count-display');
const summaryClearBtn = document.getElementById('summary-note-clear-btn');

// --- Modals & Mobile Elements ---
const ceoApprovalModal = document.getElementById('ceo-approval-modal');
const ceoModalDetails = document.getElementById('ceo-modal-details');
const ceoModalAmount = document.getElementById('ceo-modal-amount');
const ceoModalNote = document.getElementById('ceo-modal-note');
const ceoModalApproveBtn = document.getElementById('ceo-modal-approve-btn');
const ceoModalRejectBtn = document.getElementById('ceo-modal-reject-btn');
const sendCeoApprovalReceiptBtn = document.getElementById('send-ceo-approval-receipt-btn');

const vacationModal = document.getElementById('vacation-replacement-modal');
const vacationingUserName = document.getElementById('vacationing-user-name');
const vacationReturnDate = document.getElementById('vacation-return-date');
const replacementNameDisplay = document.getElementById('replacement-name-display');
const replacementContactDisplay = document.getElementById('replacement-contact-display');
const replacementEmailDisplay = document.getElementById('replacement-email-display');

const modifyTaskModal = document.getElementById('modify-task-modal');
const modifyTaskAttention = document.getElementById('modify-task-attention');
const modifyTaskStatus = document.getElementById('modify-task-status');
const modifyTaskStatusOtherContainer = document.getElementById('modify-task-status-other-container');
const modifyTaskStatusOther = document.getElementById('modify-task-status-other');
const modifyTaskNote = document.getElementById('modify-task-note');
const modifyTaskSaveBtn = document.getElementById('modify-task-save-btn');
const modifyTaskKey = document.getElementById('modify-task-key');
const modifyTaskSource = document.getElementById('modify-task-source');
const modifyTaskOriginalPO = document.getElementById('modify-task-originalPO');
const modifyTaskOriginalKey = document.getElementById('modify-task-originalKey');

// Mobile Search & Misc
const imMobileSearchBtn = document.getElementById('im-mobile-search-btn');
const imMobileSearchModal = document.getElementById('im-mobile-search-modal');
const imMobileSearchRunBtn = document.getElementById('im-mobile-search-run-btn');
const imMobileSearchClearBtn = document.getElementById('im-mobile-search-clear-btn');
const imMobileSearchCloseBtn = document.querySelector('[data-modal-id="im-mobile-search-modal"]');
const wdImReportingLinkMobile = document.getElementById('wd-im-reporting-link-mobile');
const imNavReportingLinkMobile = document.getElementById('im-nav-reporting-link-mobile'); // New Selector
const mobileSendReceiptBtn = document.getElementById('mobile-send-receipt-btn');
const mobileActiveTaskLogoutBtn = document.getElementById('mobile-activetask-logout-btn');
const imMobileActiveTaskLink = document.getElementById('im-mobile-activetask-link');
const mobileActiveTaskRefreshBtn = document.getElementById('mobile-activetask-refresh-btn');
const mobileLoginForm = document.getElementById('mobile-login-form');

// --- Badges ---
const wdActiveTaskBadge = document.getElementById('wd-active-task-badge');
const imActiveTaskBadge = document.getElementById('im-active-task-badge');
const wdMobileNotifyBadge = document.getElementById('wd-mobile-notify-badge');

// ==========================================================================
// 6. VIEW NAVIGATION & AUTHENTICATION
// ==========================================================================

function showView(viewName) {
    Object.keys(views).forEach(key => {
        if (views[key]) views[key].classList.add('hidden');
    });
    if (invoiceManagementView) invoiceManagementView.classList.add('hidden');

    if (viewName === 'workdesk' || viewName === 'invoice-management') {
        document.body.classList.remove('login-background');
        document.getElementById('app-container').style.display = 'none';
    } else {
        document.body.classList.add('login-background');
        document.getElementById('app-container').style.display = 'block';
    }

    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    } else if (viewName === 'invoice-management' && invoiceManagementView) {
        invoiceManagementView.classList.remove('hidden');
    }
}

// --- Authentication Helpers ---

async function findApprover(identifier) {
    const isEmail = identifier.includes('@');
    const searchKey = isEmail ? 'Email' : 'Mobile';
    const searchValue = isEmail ? identifier : normalizeMobile(identifier);

    // Cache check
    if (!allApproverData) {
        console.log("Caching approvers list for the first time...");
        const snapshot = await db.ref('approvers').once('value');
        allApproverData = snapshot.val();
    }
    const approversData = allApproverData;

    if (!approversData) return null;
    for (const key in approversData) {
        const record = approversData[key];
        const dbValue = record[searchKey];
        if (dbValue) {
            if (isEmail) {
                if (dbValue.toLowerCase() === searchValue.toLowerCase()) {
                    return {
                        key,
                        ...record
                    };
                }
            } else {
                const normalizedDbMobile = dbValue.replace(/\D/g, '');
                if (normalizedDbMobile === searchValue) {
                    return {
                        key,
                        ...record
                    };
                }
            }
        }
    }
    return null;
}

async function getApproverByKey(key) {
    try {
        const snapshot = await db.ref(`approvers/${key}`).once('value');
        const approverData = snapshot.val();
        if (approverData) {
            return {
                key,
                ...approverData
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching approver by key:", error);
        return null;
    }
}

function handleSuccessfulLogin() {
    if (currentApprover && currentApprover.key) {
        localStorage.setItem('approverKey', currentApprover.key);
    } else {
        console.error("Attempted to save login state but currentApprover or key is missing.");
        handleLogout();
        return;
    }

    // Check for CEO Admin role
    const isCEO = (currentApprover?.Role || '').toLowerCase() === 'admin' &&
        (currentApprover?.Position || '').toLowerCase() === 'ceo';
    document.body.classList.toggle('is-ceo', isCEO);

    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        workdeskButton.click();
    } else {
        showView('dashboard');
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    document.body.classList.toggle('is-admin', isAdmin);

    // --- Vacation delegation requires full approvers cache (preload + re-apply UI on refresh) ---
    // On initial login we often already have it, but on session restore we may only have a single user record.
    // Preload approvers in background and then re-apply Invoice Management visibility once available.
    if (!allApproverDataCache) {
        ensureApproverDataCached().then(() => {
            const _isVacationDelegate = isVacationDelegateUser();
            document.body.classList.toggle('is-vacation-delegate', _isVacationDelegate);
            const _invoiceMgmtBtn = document.getElementById('invoice-mgmt-button');
            if (_invoiceMgmtBtn) {
                const _userPosLower = (currentApprover?.Position || '').toLowerCase();
                const _isAccounting = _userPosLower === 'accounting';
                const _isAccounts = _userPosLower === 'accounts';
                const _isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
                if (_isAdmin || _isAccounting || _isAccounts || _isVacationDelegate) {
                    _invoiceMgmtBtn.classList.remove('hidden');
                } else {
                    _invoiceMgmtBtn.classList.add('hidden');
                }
            }
        }).catch((e) => console.warn('Approver cache preload failed:', e));
    }


    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    const isAccounting = userPositionLower === 'accounting';
    const isAccounts = userPositionLower === 'accounts';
    const isVacationDelegate = isVacationDelegateUser();
    document.body.classList.toggle('is-vacation-delegate', isVacationDelegate);


    // --- Financial Report: Super Admin (Irwin) + active Super Admin Replacement only ---
    // This keeps financial data restricted to the Super Admin workflow.
    const financeReportButton = document.getElementById('finance-report-button') || document.querySelector('a[href="https://ibaport.site/Finance/"]');
    if (financeReportButton) {
        const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
        const canSeeFinancialReport = isSuperAdmin || isVacationDelegate;
        financeReportButton.classList.toggle('hidden', !canSeeFinancialReport);
    }

    // --- NEW FIX: Hide Invoice Management Button for Unauthorized Users ---
    // Only Admins, Accounting, or Accounts should see this button
    const invoiceMgmtBtn = document.getElementById('invoice-mgmt-button');
    if (invoiceMgmtBtn) {
        if (isAdmin || isAccounting || isAccounts || isVacationDelegate) {
            invoiceMgmtBtn.classList.remove('hidden');
        } else {
            invoiceMgmtBtn.classList.add('hidden');
        }
    }

// [START] Auto-Open Inventory Mode
    // Check if the URL contains "?mode=inventory"
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'inventory') {
        console.log("Inventory mode detected. Auto-clicking button...");
        setTimeout(() => {
            const invBtn = document.getElementById('inventory-button');
            if (invBtn) {
                invBtn.click();
                // Optional: Clean URL so refreshing doesn't trigger it again
                // window.history.replaceState({}, document.title, window.location.pathname); 
            }
        }, 500); // Short delay to ensure view is rendered
    }
    // [END] Auto-Open Inventory Mode

    // Smart Sync / Smart Refresh removed (no background auto-sync).

    // --- Celebration Banner (configurable; optional) ---
    // Safe to call on both mobile + desktop.
    try {
        showCelebrationBannerIfNeeded();
    } catch (e) {
        console.log('Celebration banner failed:', e);
    }

    // --- Direct Messages (1:1) ---
    // Works across WorkDesk + Invoice Management + Inventory.
    try {
        initDirectMessages();
    } catch (e) {
        console.warn('Direct messages init failed:', e);
    }

}

// ================================
// Celebration Banner Overlay (configurable)
// - Trigger: successful login
// - Config source: Firebase RTDB `system_settings/celebration_banner`
// - Date window uses Asia/Qatar
// - Frequency: every login OR once per device (per config.version)
// ================================

function getQatarNowParts() {
    // Returns {year, month, day, hour, minute} in Asia/Qatar without relying on device timezone.
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Qatar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = fmt.formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute)
    };
}

function ymdToInt(ymd) {
    // ymd: 'YYYY-MM-DD'
    if (!ymd || typeof ymd !== 'string') return null;
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return Number(m[1] + m[2] + m[3]);
}

function getQatarTodayInt() {
    const p = getQatarNowParts();
    const mm = String(p.month).padStart(2, '0');
    const dd = String(p.day).padStart(2, '0');
    return Number(String(p.year) + mm + dd);
}

function normalizeCelebrationConfig(raw) {
    const defaults = {
        enabled: true,
        title: 'Happy New Year 2026',
        subtitle: 'Welcome back — wishing you a successful year.',
        emoji: '🎆',
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        showMode: 'every_login', // 'every_login' | 'once_per_device'
        soundEnabled: true,
        // Optional external sound (e.g., Firebase Storage mp3). If empty, a built-in sound plays.
        soundUrl: 'https://firebasestorage.googleapis.com/v0/b/invoiceentry-b15a8.firebasestorage.app/o/Files%2Ffireworks.mp3?alt=media&token=b2c11d84-182c-43d9-be3c-f2b32250116c',
        soundVolume: 0.75,
        durationMs: 5200,
        version: 'default-ny2026'
    };

    if (!raw || typeof raw !== 'object') return defaults;

    const cfg = { ...defaults, ...raw };

    // Defensive cleanup
    cfg.enabled = cfg.enabled === true || cfg.enabled === 'true' || cfg.enabled === 'Yes';
    cfg.title = String(cfg.title || defaults.title);
    cfg.subtitle = String(cfg.subtitle || defaults.subtitle);
    cfg.emoji = String(cfg.emoji || defaults.emoji).trim() || defaults.emoji;
    cfg.showMode = (cfg.showMode === 'once_per_device') ? 'once_per_device' : 'every_login';
    cfg.soundEnabled = cfg.soundEnabled === true || cfg.soundEnabled === 'true' || cfg.soundEnabled === 'Yes';
    cfg.soundUrl = String(cfg.soundUrl || '').trim();
    cfg.soundVolume = Number(cfg.soundVolume ?? defaults.soundVolume);
    if (!Number.isFinite(cfg.soundVolume) || cfg.soundVolume <= 0 || cfg.soundVolume > 1) cfg.soundVolume = defaults.soundVolume;
    cfg.durationMs = Number(cfg.durationMs || defaults.durationMs);
    if (!Number.isFinite(cfg.durationMs) || cfg.durationMs < 1200) cfg.durationMs = defaults.durationMs;
    cfg.version = String(cfg.version || defaults.version);

    return cfg;
}

async function fetchCelebrationConfig() {
    // If DB is unavailable, return null and fallback to defaults (NY2026 only).
    try {
        if (!db || typeof db.ref !== 'function') return null;
        const snap = await db.ref('system_settings/celebration_banner').once('value');
        return snap.val();
    } catch (e) {
        console.log('Celebration config fetch failed:', e);
        return null;
    }
}

function isConfigActiveNow(cfg) {
    if (!cfg?.enabled) return false;

    const today = getQatarTodayInt();
    const start = ymdToInt(cfg.startDate);
    const end = ymdToInt(cfg.endDate);

    if (start && today < start) return false;
    if (end && today > end) return false;

    return true;
}

function buildCelebrationParticles(container) {
    if (!container) return;

    // Clear previous effects
    container.innerHTML = '';

    const colors = ['#ff4d4d', '#ffd24d', '#4dd2ff', '#7dff4d', '#c44dff', '#ffffff'];

    // -----------------------------
    // 1) Confetti (falling pieces)
    // -----------------------------
    const confettiCount = 70;

    for (let i = 0; i < confettiCount; i++) {
        const s = document.createElement('span');
        s.className = 'confetti';

        const left = Math.random() * 100;
        const delay = Math.random() * 0.7;
        const duration = 3.5 + Math.random() * 1.7;
        const sizeW = 6 + Math.random() * 6;
        const sizeH = 10 + Math.random() * 10;

        s.style.left = left + 'vw';
        s.style.top = (-10 - Math.random() * 30) + 'vh';
        s.style.background = colors[Math.floor(Math.random() * colors.length)];
        s.style.width = sizeW + 'px';
        s.style.height = sizeH + 'px';
        s.style.animationDuration = duration + 's';
        s.style.animationDelay = delay + 's';
        s.style.transform = `translateY(-10vh) rotate(${Math.random() * 180}deg)`;

        container.appendChild(s);
    }

    // -----------------------------
    // 2) Fireworks (spark bursts)
    // -----------------------------
    // Lightweight CSS-based bursts (no canvas) that appear behind the banner.
    const burstCount = 10;          // number of firework bursts
    const sparksPerBurst = 14;      // sparks in each burst

    for (let b = 0; b < burstCount; b++) {
        const fw = document.createElement('div');
        fw.className = 'firework';

        // Keep fireworks mostly in the upper/middle area so they don't distract from buttons.
        const x = 10 + Math.random() * 80;      // vw
        const y = 12 + Math.random() * 50;      // vh

        fw.style.left = x + 'vw';
        fw.style.top = y + 'vh';

        // Spread bursts across the banner duration (default ~5.2s)
        const baseDelay = Math.random() * 2.8;  // seconds
        const dur = 0.75 + Math.random() * 0.55;

        for (let i = 0; i < sparksPerBurst; i++) {
            const sp = document.createElement('span');
            sp.className = 'spark';

            const angle = (Math.PI * 2 * i / sparksPerBurst) + (Math.random() * 0.35);
            const dist = 36 + Math.random() * 80;

            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;

            const c = colors[Math.floor(Math.random() * colors.length)];

            sp.style.setProperty('--dx', dx.toFixed(1) + 'px');
            sp.style.setProperty('--dy', dy.toFixed(1) + 'px');
            sp.style.setProperty('--c', c);
            sp.style.setProperty('--dur', dur.toFixed(2) + 's');
            sp.style.setProperty('--d', (baseDelay + Math.random() * 0.18).toFixed(2) + 's');

            // Slight size variation
            const size = 2.5 + Math.random() * 2.5;
            sp.style.width = size.toFixed(1) + 'px';
            sp.style.height = size.toFixed(1) + 'px';

            fw.appendChild(sp);
        }

        container.appendChild(fw);
    }
}

function tryPlayFireworksSound(volume = 0.5) {
    // Lightweight synthesized "firework pops" using WebAudio (no external file).
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return { ok: false, reason: 'no_audio_context' };

        if (!window.__ibaFireworkAudioCtx) {
            window.__ibaFireworkAudioCtx = new AudioCtx();
        }
        const ctx = window.__ibaFireworkAudioCtx;

        // Resume may fail on mobile until a user gesture happens.
        if (ctx.state === 'suspended') {
            const p = ctx.resume();
            if (p && typeof p.then === 'function') {
                // We'll still attempt to schedule; if resume fails, catch below.
            }
        }

        const now = ctx.currentTime;

        for (let i = 0; i < 6; i++) {
            const t = now + i * (0.12 + Math.random() * 0.05);
            const dur = 0.12 + Math.random() * 0.10;
            const len = Math.floor(ctx.sampleRate * dur);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const data = buf.getChannelData(0);

            // Exponential decay noise burst
            for (let j = 0; j < len; j++) {
                const decay = Math.exp(-j / (len / 6));
                data[j] = (Math.random() * 2 - 1) * decay;
            }

            const src = ctx.createBufferSource();
            src.buffer = buf;

            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 900 + Math.random() * 1600;
            bp.Q.value = 2.5 + Math.random() * 2;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

            src.connect(bp);
            bp.connect(gain);
            gain.connect(ctx.destination);

            src.start(t);
            src.stop(t + dur + 0.01);
        }

        return { ok: true };
    } catch (e) {
        return { ok: false, reason: e?.message || 'unknown' };
    }
}

async function tryPlayFireworksSoundFromUrl(url, volume = 0.75) {
    // External mp3 (recommended for "real" fireworks). Returns ok=false if autoplay is blocked.
    try {
        const cleanUrl = String(url || '').trim();
        if (!cleanUrl) return { ok: false, reason: 'no_url' };

        // Reuse a single audio element to avoid creating many instances.
        if (!window.__ibaCelebrationAudio || window.__ibaCelebrationAudio.src !== cleanUrl) {
            const a = new Audio(cleanUrl);
            a.preload = 'auto';
            // Not all browsers honor this for cross-origin mp3, but it doesn't hurt.
            a.crossOrigin = 'anonymous';
            window.__ibaCelebrationAudio = a;
        }

        const audio = window.__ibaCelebrationAudio;
        audio.volume = Math.min(1, Math.max(0, Number(volume) || 0.75));
        try { audio.currentTime = 0; } catch (_) {}

        const p = audio.play();
        if (p && typeof p.then === 'function') {
            await p;
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: e?.name || e?.message || 'unknown' };
    }
}

function stopCelebrationAudio() {
    try {
        if (window.__ibaCelebrationAudio) {
            window.__ibaCelebrationAudio.pause();
            try { window.__ibaCelebrationAudio.currentTime = 0; } catch (_) {}
        }
    } catch (_) {}
}

function showCelebrationBannerFromConfig(cfg, opts = {}) {
    const overlay = document.getElementById('celebration-overlay');
    const closeBtn = document.getElementById('celebration-close-btn');
    const particles = document.getElementById('celebration-particles');
    const titleEl = document.getElementById('celebration-title');
    const subEl = document.getElementById('celebration-sub');
    const emojiEl = document.getElementById('celebration-emoji');
    const soundHint = document.getElementById('celebration-sound-hint');

    if (!overlay || !closeBtn || !titleEl || !subEl || !emojiEl) return;

    titleEl.textContent = cfg.title || '';
    subEl.textContent = cfg.subtitle || '';
    emojiEl.textContent = cfg.emoji || '🎉';

    buildCelebrationParticles(particles);

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');

    const hide = () => {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        if (soundHint) soundHint.classList.add('hidden');
        stopCelebrationAudio();
    };

    // Close actions
    const escHandler = (ev) => {
        if (ev.key === 'Escape') {
            hide();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    const clickOutsideHandler = (ev) => {
        // Click outside the banner closes too
        const banner = document.getElementById('celebration-banner');
        if (banner && !banner.contains(ev.target)) {
            hide();
            overlay.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', escHandler);
        }
    };

    closeBtn.onclick = () => {
        hide();
        overlay.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);
    };
    overlay.addEventListener('click', clickOutsideHandler);

    // Sound: try autoplay; if blocked, request a tap
    if (cfg.soundEnabled) {
        const volume = Math.min(1, Math.max(0, Number(cfg.soundVolume) || 0.75));

        const attemptPlay = async () => {
            // Prefer external mp3 if configured, else fallback to built-in synth.
            if (cfg.soundUrl) {
                const r1 = await tryPlayFireworksSoundFromUrl(cfg.soundUrl, volume);
                if (r1.ok) return r1;
                // If it failed for a non-autoplay reason (e.g., bad URL/network), fallback to synth.
                if (String(r1.reason || '').toLowerCase().includes('notallowed')) return r1;
                const r2 = tryPlayFireworksSound(Math.max(0.35, volume * 0.75));
                return r2.ok ? r2 : r1;
            }
            return tryPlayFireworksSound(Math.max(0.35, volume * 0.75));
        };

        attemptPlay().then((res) => {
            if (res?.ok) return;
            if (soundHint) soundHint.classList.remove('hidden');

            const gesturePlay = async () => {
                const r = await attemptPlay();
                if (r?.ok && soundHint) soundHint.classList.add('hidden');
                overlay.removeEventListener('pointerdown', gesturePlay);
            };
            overlay.addEventListener('pointerdown', gesturePlay, { once: true });
        }).catch(() => {
            if (soundHint) soundHint.classList.remove('hidden');
        });
    }

    // Auto-close
    const duration = Number(cfg.durationMs || 5200);
    setTimeout(() => {
        hide();
        overlay.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);
    }, duration);
}

async function showCelebrationBannerIfNeeded() {
    // 1) Fetch config (DB) or fallback.
    const raw = await fetchCelebrationConfig();
    const cfg = normalizeCelebrationConfig(raw);

    // If no DB config exists, only show the built-in default during its own date window.
    if (!raw && !isConfigActiveNow(cfg)) return;

    // If DB config exists, still respect the date window.
    if (raw && !isConfigActiveNow(cfg)) return;

    // 2) Frequency rule
    const storageKey = `celebration_shown_${cfg.version}`;
    if (cfg.showMode === 'once_per_device' && localStorage.getItem(storageKey) === '1') {
        return;
    }

    // Mark shown before rendering (prevents loops on refresh)
    if (cfg.showMode === 'once_per_device') {
        localStorage.setItem(storageKey, '1');
    }

    showCelebrationBannerFromConfig(cfg);
}

// ================================
// End Celebration Banner Overlay
// ================================



function handleLogout() {
    // Live chat cleanup

    // Direct messages cleanup
    try { shutdownDirectMessages(); } catch (e) { /* ignore */ }

    // Smart Sync / Smart Refresh removed (no background listeners).

    localStorage.removeItem('approverKey');

    if (dateTimeInterval) clearInterval(dateTimeInterval);
    if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
    if (imDateTimeInterval) clearInterval(imDateTimeInterval);
    location.reload();
}

// --- Workdesk Navigation ---

async function showWorkdeskSection(sectionId, newSearchTerm = null) {
    // 1. Cleanup
    if (activeTaskAutoRefreshInterval) {
        clearInterval(activeTaskAutoRefreshInterval);
        activeTaskAutoRefreshInterval = null;
    }

    // 2. Hide all sections, Show target
    workdeskSections.forEach(section => {
        section.classList.add('hidden');
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }


    // Inventory In-Transit report button is only relevant in Inventory context (desktop)
    if (typeof updateInTransitReportButtonVisibility === 'function') {
        updateInTransitReportButtonVisibility();
    }

    // 3. Section-Specific Logic
    if (sectionId === 'wd-dashboard') {
        await populateWorkdeskDashboard();
        renderWorkdeskCalendar();
        renderYearView();
        await populateCalendarTasks();
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        displayCalendarTasksForDay(todayStr);
    }

    if (sectionId === 'wd-jobentry') {
        if (!currentlyEditingKey) {
            resetJobEntryForm(false);
        }
        const savedSearch = sessionStorage.getItem('jobEntrySearch');
        if (savedSearch) {
            jobEntrySearchInput.value = savedSearch;
        }
        await handleJobEntrySearch(jobEntrySearchInput.value);
    }

    if (sectionId === 'wd-activetask') {
        await populateActiveTasks();

        let searchTerm = '';
        if (newSearchTerm !== null) {
            searchTerm = newSearchTerm;
        } else {
            searchTerm = sessionStorage.getItem('activeTaskSearch') || '';
        }

        if (searchTerm) {
            activeTaskSearchInput.value = searchTerm;
            handleActiveTaskSearch(searchTerm);
        }
    }

    if (sectionId === 'wd-reporting') {
        // --- NEW: Reset filter to clean slate ---
        currentReportFilter = null;

        const savedSearch = sessionStorage.getItem('reportingSearch');
        if (savedSearch) {
            reportingSearchInput.value = savedSearch;
        } else {
            // Clear search input if no saved search
            reportingSearchInput.value = '';
        }
        await handleReportingSearch();
    }

    // --- NEW: Material Stock Logic ---
    if (sectionId === 'wd-material-stock') {
        // This function lives in materialStock.js
        if (typeof populateMaterialStock === 'function') {
            await populateMaterialStock();
        } else {
            console.error("materialStock.js functions are not loaded.");
        }
    }

    if (sectionId === 'wd-settings') {
        populateSettingsForm();
    }
}

// --- Invoice Management Navigation ---
function showIMSection(sectionId) {
    // 1. Get User Credentials
    const userPos = (currentApprover?.Position || '').trim(); // Case sensitive check next
    const userRole = (currentApprover?.Role || '').toLowerCase();

    // 2. Define Permission Flags (Strict Logic)
    const isAdmin = userRole === 'admin';
    const isAccountingPos = userPos === 'Accounting'; // Case sensitive as per request usually, but let's be safe
    const isAccountsPos = userPos === 'Accounts';

    // "Admin with Accounting" (Has Everything)
    const isAccountingAdmin = isAdmin && isAccountingPos; // Strictly Admin + Accounting

    // "Admin with Accounts" (Has Payments)
    // Note: We allow AccountingAdmin to see payments too since they have "everything"
    const isAccountsAdmin = (isAdmin && isAccountsPos) || isAccountingAdmin;

    // Vacation delegate (replacement for Irwin) gets temporary Invoice Management access
    const isVacationDelegate = isVacationDelegateUser();
    const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    const canAccessFullIM = isAccountingAdmin || isVacationDelegate;
    const canAccessPayments = isAccountsAdmin; // Vacation delegate does NOT get Payments access
    // Finance/Financial report is read-only and restricted to Super Admin (Irwin) and the active Super Admin replacement.
    const canAccessFinanceReport = isSuperAdmin || isVacationDelegate;


    // 3. Strict Access Control Checks
    if (sectionId === 'im-invoice-entry' && !canAccessFullIM) {
        alert('Access Denied: Restricted to Admin & Accounting position.');
        return;
    }
    if (sectionId === 'im-batch-entry' && !canAccessFullIM) {
        alert('Access Denied: Restricted to Admin & Accounting position.');
        return;
    }
    if (sectionId === 'im-summary-note' && !canAccessFullIM) {
        alert('Access Denied: Restricted to Admin & Accounting position.');
        return;
    }

    if (sectionId === 'im-payments' && !canAccessPayments) {
        alert('Access Denied: Restricted to Admin & Accounts/Accounting position.');
        return;
    }

    if (sectionId === 'im-finance-report' && !canAccessFinanceReport) {
        alert('Access Denied: Restricted to Super Admin / Super Admin Replacement.');
        return;
    }

    // 4. Show/Hide Views
    imContentArea.querySelectorAll('.workdesk-section').forEach(section => section.classList.add('hidden'));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.remove('hidden');

    // 5. Sidebar Handling
    if (sectionId === 'im-invoice-entry') {
        if (imEntrySidebar) imEntrySidebar.classList.remove('hidden');
        if (imMainElement) imMainElement.classList.add('with-sidebar');
        populateActiveJobsSidebar();
    } else {
        if (imEntrySidebar) imEntrySidebar.classList.add('hidden');
        if (imMainElement) imMainElement.classList.remove('with-sidebar');
    }

    // 6. Section Specific Initializers
    if (sectionId === 'im-dashboard') {
        // STOP AUTOMATIC LOADING
        // populateInvoiceDashboard(false); <--- REMOVED

        // Show "Standby" Message instead
        const dbSection = document.getElementById('im-dashboard');
        dbSection.innerHTML = `
            <h1>Dashboard</h1>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; color: #777; text-align: center;">
                <i class="fa-solid fa-chart-column" style="font-size: 4rem; margin-bottom: 20px; color: #ccc;"></i>
                <h2 style="margin-bottom: 10px;">Dashboard Standby</h2>
                <p>To view heavy chart data, please <strong>Double-Click</strong> the "Dashboard" button in the sidebar.</p>
            </div>
        `;
    }

    if (sectionId === 'im-batch-entry') {
        const savedBatchSearch = sessionStorage.getItem('imBatchSearch');
        const savedBatchNoteSearch = sessionStorage.getItem('imBatchNoteSearch');
        if (savedBatchSearch) document.getElementById('im-batch-po-input').value = savedBatchSearch;
        else document.getElementById('im-batch-po-input').value = '';

        document.getElementById('im-batch-table-body').innerHTML = '';
        updateBatchCount();

        if (!imBatchGlobalAttentionChoices) {
            imBatchGlobalAttentionChoices = new Choices(document.getElementById('im-batch-global-attention'), {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateAttentionDropdown(imBatchGlobalAttentionChoices);
        } else populateAttentionDropdown(imBatchGlobalAttentionChoices);

        if (!imBatchNoteSearchChoices) {
            imBatchNoteSearchChoices = new Choices(document.getElementById('im-batch-note-search-select'), {
                searchEnabled: true,
                shouldSort: true,
                itemSelectText: '',
                removeItemButton: true,
                placeholder: true,
                placeholderValue: 'Search by Note...'
            });
        }


// Double-click copy shortcut: Batch Entry "Search by Note"
try {
    const noteSelectEl = document.getElementById('im-batch-note-search-select');
    if (noteSelectEl && imBatchNoteSearchChoices) {
        const choicesWrapper =
            (noteSelectEl.parentElement && noteSelectEl.parentElement.querySelector('.choices')) ||
            noteSelectEl.closest('.choices');

        const feedbackEl = choicesWrapper
            ? (choicesWrapper.querySelector('.choices__inner') || choicesWrapper)
            : noteSelectEl;

        if (choicesWrapper) {
            bindDblClickCopy(choicesWrapper, () => {
                // Prefer selected note labels
                try {
                    const selected = imBatchNoteSearchChoices.getValue();
                    if (Array.isArray(selected) && selected.length) {
                        return selected
                            .map(x => (x.label || x.value || ''))
                            .filter(Boolean)
                            .join(', ');
                    }
                    if (selected && typeof selected === 'object') {
                        return (selected.label || selected.value || '');
                    }
                } catch (e) { /* ignore */ }

                // Fallback: whatever user typed into the search box
                const inputEl = choicesWrapper.querySelector('input.choices__input');
                return inputEl ? inputEl.value : '';
            }, feedbackEl);
        }
    }
} catch (e) { /* ignore */ }

        populateNoteDropdown(imBatchNoteSearchChoices).then(() => {
            if (savedBatchNoteSearch) imBatchNoteSearchChoices.setChoiceByValue(savedBatchNoteSearch);
        });
    }

    if (sectionId === 'im-summary-note') {
        initializeNoteSuggestions();
        const savedPrevNote = sessionStorage.getItem('imSummaryPrevNote');
        const savedCurrNote = sessionStorage.getItem('imSummaryCurrNote');
        if (savedPrevNote) summaryNotePreviousInput.value = savedPrevNote;
        if (savedCurrNote) {
            summaryNoteCurrentInput.value = savedCurrNote;
            handleGenerateSummary();
        } else {
            summaryNotePrintArea.classList.add('hidden');
            if (summaryNoteCountDisplay) summaryNoteCountDisplay.textContent = '';
        }
    }

    if (sectionId === 'im-reporting') {
        // Date picker was removed from UI (it was not used by report logic),
        // so guard against null to avoid runtime errors.
        if (imDailyReportDateInput) imDailyReportDateInput.value = getTodayDateString();
        const savedSearch = sessionStorage.getItem('imReportingSearch');
        if (savedSearch) {
            imReportingSearchInput.value = savedSearch;
            populateInvoiceReporting(savedSearch);
        } else {
            imReportingContent.innerHTML = '<p>Please enter a search term and click Search.</p>';
            if (reportingCountDisplay) reportingCountDisplay.textContent = '';
            imReportingSearchInput.value = '';
            currentReportData = [];
        }
        populateSiteFilterDropdown();
        // Visibility rules (V5.5.3 update):
        // - CSV/Excel downloads: Only Super Admin (Irwin) OR the active Super Admin Vacation Delegate
        // - Print Preview/List: All Admins (and Accounting)
        const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
        const isSuperAdminDelegate = isVacationDelegateUser();

        const isAdminRole = (currentApprover?.Role || '').toLowerCase() === 'admin';
        const posLower = (currentApprover?.Position || '').toLowerCase();
        const isAccountingPos = posLower.includes('accounting') || posLower.includes('accounts') || posLower.includes('finance');

        const showReportBtns = (isSuperAdmin || isSuperAdminDelegate) && (window.innerWidth > 768);
        if (imReportingDownloadCSVButton) imReportingDownloadCSVButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDownloadDailyReportButton) imDownloadDailyReportButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDownloadWithAccountsReportButton) imDownloadWithAccountsReportButton.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imDailyReportDateInput) imDailyReportDateInput.style.display = showReportBtns ? 'inline-block' : 'none';
        if (imReportingDownloadExcelButton) imReportingDownloadExcelButton.style.display = showReportBtns ? 'inline-block' : 'none';

        const canPrintInvoiceReport = isAdminRole || isAccountingPos;
        if (imReportingPrintBtn) imReportingPrintBtn.disabled = !canPrintInvoiceReport;
    }

    if (sectionId === 'im-payments') {
        imPaymentsTableBody.innerHTML = '';
        invoicesToPay = {};
        updatePaymentsCount();
    }

    if (sectionId === 'im-finance-report') {
        imFinanceSearchPoInput.value = '';
        imFinanceResults.style.display = 'none';
        imFinanceNoResults.style.display = 'none';
        imFinanceAllPaymentsData = {};
        if (financeReportCountDisplay) financeReportCountDisplay.textContent = '';
    }
}

// --- User Settings ---

function populateSettingsForm() {
    if (!currentApprover) return;
    settingsMessage.textContent = '';
    settingsMessage.className = 'error-message';
    settingsPasswordInput.value = '';
    settingsNameInput.value = currentApprover.Name || '';
    settingsEmailInput.value = currentApprover.Email || '';
    settingsMobileInput.value = currentApprover.Mobile || '';
    settingsPositionInput.value = currentApprover.Position || '';
    settingsSiteInput.value = currentApprover.Site || '';
    settingsVacationCheckbox.checked = currentApprover.Vacation === true || currentApprover.Vacation === "Yes";
    settingsReturnDateInput.value = currentApprover.DateReturn || '';

    settingsReplacementNameInput.value = currentApprover.ReplacementName || '';
    settingsReplacementContactInput.value = currentApprover.ReplacementContact || '';
    settingsReplacementEmailInput.value = currentApprover.ReplacementEmail || '';

    settingsVacationDetailsContainer.classList.toggle('hidden', !settingsVacationCheckbox.checked);

    // Super Admin tools
    populateCelebrationSettingsForm();

}

function isCurrentUserSuperAdmin() {
    const name = (currentApprover?.Name || '').trim().toLowerCase();
    const role = (currentApprover?.Role || '').trim().toLowerCase();
    const pos = (currentApprover?.Position || '').trim().toLowerCase();
    return name === 'irwin' || role.includes('super') || pos.includes('super admin');
}

async function populateCelebrationSettingsForm() {
    if (!celebrationSettingsContainer) return;

    const allowed = isCurrentUserSuperAdmin();
    celebrationSettingsContainer.classList.toggle('hidden', !allowed);
    if (!allowed) return;

    // Load current config
    const raw = await fetchCelebrationConfig();
    const cfg = normalizeCelebrationConfig(raw);

    if (celebrationEnabledCheckbox) celebrationEnabledCheckbox.checked = !!cfg.enabled;
    if (celebrationTitleInput) celebrationTitleInput.value = cfg.title || '';
    if (celebrationSubtitleInput) celebrationSubtitleInput.value = cfg.subtitle || '';
    if (celebrationEmojiInput) celebrationEmojiInput.value = cfg.emoji || '🎉';
    if (celebrationStartDateInput) celebrationStartDateInput.value = cfg.startDate || '';
    if (celebrationEndDateInput) celebrationEndDateInput.value = cfg.endDate || '';
    if (celebrationShowModeSelect) celebrationShowModeSelect.value = cfg.showMode || 'every_login';
    if (celebrationSoundEnabledCheckbox) celebrationSoundEnabledCheckbox.checked = !!cfg.soundEnabled;
    if (celebrationSoundUrlInput) celebrationSoundUrlInput.value = cfg.soundUrl || '';

    if (celebrationSettingsMessage) {
        celebrationSettingsMessage.textContent = '';
        celebrationSettingsMessage.className = 'error-message';
    }
}

function readCelebrationConfigFromUI() {
    const cfg = {
        enabled: celebrationEnabledCheckbox?.checked === true,
        title: (celebrationTitleInput?.value || '').trim(),
        subtitle: (celebrationSubtitleInput?.value || '').trim(),
        emoji: (celebrationEmojiInput?.value || '🎉').trim(),
        startDate: celebrationStartDateInput?.value || '',
        endDate: celebrationEndDateInput?.value || '',
        showMode: celebrationShowModeSelect?.value || 'every_login',
        soundEnabled: celebrationSoundEnabledCheckbox?.checked === true,
        soundUrl: (celebrationSoundUrlInput?.value || '').trim(),
        soundVolume: 0.75,
        durationMs: 5200,
        version: String(Date.now()),
        updatedBy: currentApprover?.Name || '',
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    return normalizeCelebrationConfig(cfg);
}

async function saveCelebrationSettingsFromUI(disableOnly = false) {
    if (!isCurrentUserSuperAdmin()) return;

    if (!db || typeof db.ref !== 'function') {
        if (celebrationSettingsMessage) {
            celebrationSettingsMessage.textContent = 'Database is not ready. Please refresh and try again.';
        }
        return;
    }

    let cfg;
    if (disableOnly) {
        const raw = await fetchCelebrationConfig();
        cfg = normalizeCelebrationConfig(raw);
        cfg.enabled = false;
        cfg.version = String(Date.now());
        cfg.updatedBy = currentApprover?.Name || '';
        cfg.updatedAt = firebase.database.ServerValue.TIMESTAMP;
    } else {
        cfg = readCelebrationConfigFromUI();
    }

    try {
        await db.ref('system_settings/celebration_banner').set(cfg);

        if (celebrationSettingsMessage) {
            celebrationSettingsMessage.textContent = disableOnly ? 'Celebration banner turned off.' : 'Celebration banner saved.';
            celebrationSettingsMessage.className = 'success-message';
        }
    } catch (e) {
        if (celebrationSettingsMessage) {
            celebrationSettingsMessage.textContent = 'Failed to save: ' + (e?.message || e);
            celebrationSettingsMessage.className = 'error-message';
        }
    }
}

async function handleUpdateSettings(e) {
    e.preventDefault();
    if (!currentApprover || !currentApprover.key) {
        settingsMessage.textContent = 'Could not identify user. Please log in again.';
        settingsMessage.className = 'error-message';
        return;
    }

    const onVacation = settingsVacationCheckbox.checked;
    const updates = {
        Site: settingsSiteInput.value.trim(),
        Vacation: onVacation ? "Yes" : "",
        DateReturn: onVacation ? settingsReturnDateInput.value : '',
        ReplacementName: onVacation ? settingsReplacementNameInput.value.trim() : '',
        ReplacementContact: onVacation ? settingsReplacementContactInput.value.trim() : '',
        ReplacementEmail: onVacation ? settingsReplacementEmailInput.value.trim() : ''
    };
    let passwordChanged = false;
    const newPassword = settingsPasswordInput.value;
    if (newPassword) {
        if (newPassword.length < 6) {
            settingsMessage.textContent = 'Password must be at least 6 characters long.';
            settingsMessage.className = 'error-message';
            return;
        }
        updates.Password = newPassword;
        passwordChanged = true;
    }

    try {
        await db.ref(`approvers/${currentApprover.key}`).update(updates);
        currentApprover = {
            ...currentApprover,
            ...updates,
            Vacation: updates.Vacation === "Yes"
        };
        allApproversCache = null;
        allApproverData = null;
        allApproverDataCache = null;
        // Refresh dropdowns that use cached approver data (so Vacation updates show immediately).
        try {
            if (typeof attentionSelectChoices !== 'undefined' && attentionSelectChoices) await populateAttentionDropdown(attentionSelectChoices);
            if (typeof modifyTaskAttentionChoices !== 'undefined' && modifyTaskAttentionChoices) await populateAttentionDropdown(modifyTaskAttentionChoices);
            if (typeof imAttentionSelectChoices !== 'undefined' && imAttentionSelectChoices) await populateAttentionDropdown(imAttentionSelectChoices);
        } catch (refreshErr) {
            console.warn('Could not refresh attention dropdowns after settings update:', refreshErr);
        }

        settingsMessage.textContent = 'Settings updated successfully!';
        settingsMessage.className = 'success-message';
        settingsPasswordInput.value = '';
        if (passwordChanged) {
            alert('Password changed successfully! You will now be logged out.');
            handleLogout();
        } else {
            populateSettingsForm();
        }
    } catch (error) {
        console.error("Error updating settings:", error);
        settingsMessage.textContent = `Update failed: ${error?.message || error}`;
        settingsMessage.className = 'error-message';
    }
}

// --- Placeholder Clock Functions ---
function updateWorkdeskDateTime() {}
function updateDashboardDateTime() {}
function updateIMDateTime() {}

// ==========================================================================
// 7. WORKDESK LOGIC: DASHBOARD & CALENDAR
// ==========================================================================

// --- Helper: Check Task Completion ---
function isTaskComplete(task) {
    if (!task) return false;

    // 1. Special check for Job Entries (Invoice Type)
    if (task.source === 'job_entry' && task.for === 'Invoice') {
        if (task.remarks === 'Approved' || task.remarks === 'Rejected') {
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

// --- Dashboard Population ---

async function populateWorkdeskDashboard() {
    // 1. Populate the user's personal task list
    await populateActiveTasks();

    // SAFEGUARD: Only update count if element exists
    const activeCountEl = document.getElementById('db-active-tasks-count');
    if (activeCountEl) {
        activeCountEl.textContent = userActiveTasks.length;
    }

    // 2. Populate the admin's "all tasks" list
    await populateAdminCalendarTasks();

    // 3. Populate completed tasks count
    await ensureAllEntriesFetched();

    let completedJobTasks = allSystemEntries.filter(task =>
        (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name) && isTaskComplete(task)
    );

    let completedInvoiceTasks = [];
    const isAccounting = (currentApprover.Position || '').toLowerCase() === 'accounting';

    await ensureInvoiceDataFetched();

    if (allInvoiceData) {
        for (const poNumber in allInvoiceData) {
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                const inv = poInvoices[invoiceKey];
                    // Skip completed SRV Done items (never show in Active Tasks)
                    if (String(inv.status || '').trim() === 'SRV Done') continue;
                const invoiceTask = {
                    key: `${poNumber}_${invoiceKey}`,
                    source: 'invoice',
                    remarks: inv.status,
                    enteredBy: isAccounting ? currentApprover.Name : 'Irwin'
                };

                let shouldInclude = false;
                if (isAccounting) {
                    if (isTaskComplete(invoiceTask)) shouldInclude = true;
                } else {
                    if (inv.attention === currentApprover.Name && isTaskComplete(invoiceTask)) shouldInclude = true;
                }

                if (shouldInclude) completedInvoiceTasks.push(invoiceTask);
            }
        }
    }

    const totalCompleted = completedJobTasks.length + completedInvoiceTasks.length;

    // SAFEGUARD: Only update count if element exists
    const completedCountEl = document.getElementById('db-completed-tasks-count');
    if (completedCountEl) {
        completedCountEl.textContent = totalCompleted;
    }
}

// --- Calendar Logic (Month, Year, Day Views) ---

function renderWorkdeskCalendar() {
    if (!wdCalendarGrid || !wdCalendarMonthYear) return;

    wdCalendarGrid.innerHTML = `
        <div class="wd-calendar-day-name">Sun</div>
        <div class="wd-calendar-day-name">Mon</div>
        <div class="wd-calendar-day-name">Tue</div>
        <div class="wd-calendar-day-name">Wed</div>
        <div class="wd-calendar-day-name">Thu</div>
        <div class="wd-calendar-day-name">Fri</div>
        <div class="wd-calendar-day-name">Sat</div>
    `;

    wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const year = wdCurrentCalendarDate.getFullYear();
    const month = wdCurrentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const blankDay = document.createElement('div');
        blankDay.className = 'wd-calendar-day other-month';
        wdCalendarGrid.appendChild(blankDay);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'wd-calendar-day';
        dayCell.textContent = day;

        const thisDate = new Date(year, month, day);
        thisDate.setHours(0, 0, 0, 0);

        const dateYear = thisDate.getFullYear();
        const dateMonth = String(thisDate.getMonth() + 1).padStart(2, '0');
        const dateDay = String(thisDate.getDate()).padStart(2, '0');
        dayCell.dataset.date = `${dateYear}-${dateMonth}-${dateDay}`;

        if (thisDate.getTime() === today.getTime()) {
            dayCell.classList.add('today');
        }
        wdCalendarGrid.appendChild(dayCell);
    }
}

async function populateAdminCalendarTasks() {
    if (!currentApprover || (currentApprover.Role || '').toLowerCase() !== 'admin') {
        allAdminCalendarTasks = [];
        return;
    }

    console.log("Admin user detected, populating full calendar...");
    let allTasks = [];

    // 1. Get all active JOB_ENTRIES
    await ensureAllEntriesFetched();
    const activeJobTasks = allSystemEntries.filter(entry => !isTaskComplete(entry));
    allTasks = allTasks.concat(activeJobTasks);

    // 2. Get all active INVOICE_ENTRIES
    await ensureInvoiceDataFetched();
    const unassignedStatuses = ['Pending', 'Report', 'Original PO'];

    if (allInvoiceData && allPOData) {
        for (const poNumber in allInvoiceData) {
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                const inv = poInvoices[invoiceKey];
                    // Skip completed SRV Done items (never show in Active Tasks)
                    if (String(inv.status || '').trim() === 'SRV Done') continue;
                const isAssignedActive = isInvoiceTaskActive(inv);
                const isUnassignedActive = unassignedStatuses.includes(inv.status) && (!inv.attention || inv.attention === '');

                if (isAssignedActive || isUnassignedActive) {
                    const poDetails = (typeof getInvoicePurchaseOrderDetails === 'function')
                    ? await getInvoicePurchaseOrderDetails(poNumber)
                    : ((typeof allPOData !== 'undefined' && allPOData && allPOData[poNumber]) ? allPOData[poNumber] : {});
                    const transformedInvoice = {
                        key: `${poNumber}_${invoiceKey}`,
                        originalKey: invoiceKey,
                        originalPO: poNumber,
                        source: 'invoice',
                        for: 'Invoice',
                        ref: inv.invNumber || '',
                        po: poNumber,
                        amount: inv.invValue || '',
                        site: poDetails['Project ID'] || 'N/A',
                        group: 'N/A',
                        attention: inv.attention || '',
                        enteredBy: 'Irwin',
                        date: formatYYYYMMDD(inv.invoiceDate),
                        calendarDate: formatYYYYMMDD(inv.releaseDate) !== 'N/A' ? formatYYYYMMDD(inv.releaseDate) : formatYYYYMMDD(inv.invoiceDate),
                        remarks: inv.status,
                        timestamp: (inv.releaseDate || inv.invoiceDate) ? new Date(inv.releaseDate || inv.invoiceDate).getTime() : Date.now(),
                        invName: inv.invName || '',
                        vendorName: poDetails['Supplier Name'] || 'N/A',
                        note: inv.note || ''
                    };
                    allTasks.push(transformedInvoice);
                }
            }
        }
    }
    allAdminCalendarTasks = allTasks;
}

async function populateCalendarTasks() {
    if (!currentApprover) return;

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    let tasks = [];
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key));

    if (isAdmin) {
        tasks = allAdminCalendarTasks;
    } else {
        tasks = userActiveTasks;
    }

    // Desktop Workdesk should hide inventory tasks from the calendar (mobile unchanged)
    if (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop()) {
        tasks = tasks.filter(t => !INVENTORY_TYPES.includes(t.for));
    }

    const tasksByDate = new Map();
    tasks.forEach(task => {
        let taskDateStr = task.calendarDate || task.date;
        if (taskDateStr) {
            const inputDate = convertDisplayDateToInput(taskDateStr);
            if (inputDate) {
                if (!tasksByDate.has(inputDate)) {
                    tasksByDate.set(inputDate, []);
                }
                tasksByDate.get(inputDate).push(task);
            }
        }
    });

    document.querySelectorAll('.wd-calendar-day[data-date]').forEach(dayCell => {
        const date = dayCell.dataset.date;
        const oldBadge = dayCell.querySelector('.task-count-badge');
        if (oldBadge) oldBadge.remove();

        if (tasksByDate.has(date)) {
            const tasksForDay = tasksByDate.get(date);
            const count = tasksForDay.length;

            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'task-count-badge';
                badge.textContent = count;

                let badgeColorSet = false;
                if (isAdmin) {
                    const hasMyTask = tasksForDay.some(task => myTaskKeys.has(task.key));
                    if (!hasMyTask) {
                        badge.classList.add('admin-view-only');
                        badgeColorSet = true;
                    }
                }
                if (!badgeColorSet) {
                    const allPendingSignature = tasksForDay.every(task => task.remarks === 'Pending Signature');
                    if (allPendingSignature) {
                        badge.classList.add('status-pending-signature');
                        badgeColorSet = true;
                    }
                }
                dayCell.appendChild(badge);
            }
        }
    });
}

function renderYearView() {
    if (!wdCalendarYearGrid) return;

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const year = wdCurrentCalendarDate.getFullYear();
    const baseTaskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    const taskSource = (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop())
        ? baseTaskSource.filter(t => !INVENTORY_TYPES.includes(t.for))
        : baseTaskSource;
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key));

    const tasksByMonth = new Map();
    for (let i = 0; i < 12; i++) {
        tasksByMonth.set(i, []);
    }

    taskSource.forEach(task => {
        const taskDateStr = task.calendarDate || task.date;
        if (!taskDateStr) return;

        const taskDate = new Date(convertDisplayDateToInput(taskDateStr) + 'T00:00:00');
        if (taskDate.getFullYear() === year) {
            const monthIndex = taskDate.getMonth();
            tasksByMonth.get(monthIndex).push(task);
        }
    });

    wdCalendarYearGrid.innerHTML = '';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
        const monthCell = document.createElement('div');
        monthCell.className = 'wd-calendar-month-cell';
        monthCell.textContent = monthNames[i];
        monthCell.dataset.month = i;

        const tasksForThisMonth = tasksByMonth.get(i);
        const taskCount = tasksForThisMonth.length;

        if (taskCount > 0) {
            monthCell.classList.add('has-tasks');
            const badge = document.createElement('span');
            badge.className = 'month-task-count';
            badge.textContent = taskCount;

            let badgeColorSet = false;
            if (isAdmin) {
                const hasMyTask = tasksForThisMonth.some(task => myTaskKeys.has(task.key));
                if (!hasMyTask) {
                    monthCell.classList.add('admin-view-only');
                    badge.classList.add('admin-view-only');
                    badgeColorSet = true;
                }
            }
            if (!badgeColorSet) {
                const allPendingSignature = tasksForThisMonth.every(task => task.remarks === 'Pending Signature');
                if (allPendingSignature) {
                    monthCell.classList.add('status-pending-signature');
                    badge.classList.add('status-pending-signature');
                    badgeColorSet = true;
                }
            }
            monthCell.appendChild(badge);
        }
        wdCalendarYearGrid.appendChild(monthCell);
    }
}

function toggleCalendarView() {
    isYearView = !isYearView;

    wdCalendarGrid.classList.toggle('hidden', isYearView);
    wdCalendarYearGrid.classList.toggle('hidden', !isYearView);

    if (isYearView) {
        wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
        wdCalendarToggleBtn.textContent = 'Month View';
        renderYearView();
    } else {
        wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        wdCalendarToggleBtn.textContent = 'Year View';
        renderWorkdeskCalendar();
        populateCalendarTasks();
    }
}

function displayCalendarTasksForDay(date) {
    document.querySelectorAll('.wd-calendar-day.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    const selectedCell = document.querySelector(`.wd-calendar-day[data-date="${date}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const baseTaskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    const taskSource = (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop())
        ? baseTaskSource.filter(t => !INVENTORY_TYPES.includes(t.for))
        : baseTaskSource;

    const tasks = taskSource.filter(task => {
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date);
        return taskDate === date;
    });

    const friendlyDate = formatYYYYMMDD(date);

    if (tasks.length > 0) {
        wdCalendarTaskListTitle.textContent = `Task Details for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';

        tasks.forEach(task => {
            const li = document.createElement('li');

            let statusClass = '';
            const status = task.remarks || 'Pending';
            if (status === 'Pending Signature') statusClass = 'status-pending-signature';
            if (status === 'For SRV') statusClass = 'status-for-srv';
            li.className = statusClass;

            const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
            const subInfo = task.vendorName ? task.vendorName : `(Ref: ${task.ref || 'N/A'})`;

            const amountDisplay = (task.amount && parseFloat(task.amount) > 0) ?
                ` - QAR ${formatCurrency(task.amount)}` :
                ``;

            if (task.po) {
                li.dataset.po = task.po;
                li.classList.add('clickable-task');
                li.title = `PO: ${task.po}\nDouble-click to search in IM Reporting`;
            }

            const noteHTML = task.note ?
                `<span style="color: var(--iba-secondary-terracotta); font-style: italic; margin-top: 4px;">Note: ${task.note}</span>` :
                '';

            const jobTypeHTML = task.for ?
                `<span style="font-weight: 600; margin-top: 4px;">Job: ${task.for}</span>` :
                '';

            li.innerHTML = `
                <strong>${mainInfo}${amountDisplay}</strong>
                <span>${subInfo}</span>
                ${jobTypeHTML}
                <span style="font-weight: 600; margin-top: 4px;">Status: ${status}</span>
                ${noteHTML}
            `;
            wdCalendarTaskListUl.appendChild(li);
        });

    } else {
        wdCalendarTaskListTitle.textContent = `No active tasks for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';
    }
}

function showDayView(date) {
    try {
        const parts = date.split('-').map(Number);
        wdCurrentDayViewDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } catch (e) {
        console.error("Invalid date passed to showDayView:", date, e);
        return;
    }

    workdeskSections.forEach(section => {
        section.classList.add('hidden');
    });
    const dayViewSection = document.getElementById('wd-dayview');
    dayViewSection.classList.remove('hidden');

    const friendlyDate = formatYYYYMMDD(date);
    document.getElementById('wd-dayview-title').textContent = `Tasks for ${friendlyDate}`;
    const mobileSubtitle = document.getElementById('wd-dayview-mobile-date-subtitle');
    if (mobileSubtitle) {
        const todayStr = getTodayDateString();
        if (date === todayStr) {
            mobileSubtitle.textContent = 'Today';
        } else {
            const subtitleDate = new Date(date + 'T00:00:00');
            mobileSubtitle.textContent = subtitleDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    }
    generateDateScroller(date);

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const isCEO = document.body.classList.contains('is-ceo');
    const baseTaskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    const taskSource = (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop())
        ? baseTaskSource.filter(t => !INVENTORY_TYPES.includes(t.for))
        : baseTaskSource;

    const tasks = taskSource.filter(task => {
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date);
        return taskDate === date;
    });

    const taskListDiv = document.getElementById('wd-dayview-task-list');
    taskListDiv.innerHTML = '';

    if (tasks.length === 0) {
        taskListDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #555;">No tasks found for this day.</p>';
        return;
    }

    const myTaskKeys = new Set(userActiveTasks.map(t => t.key));

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'dayview-task-card';

        card.dataset.key = task.key;
        if (isCEO) {
            card.classList.add('ceo-clickable-day-card');
        }

        let borderColor = 'var(--iba-secondary-terracotta)';
        if (isAdmin && !myTaskKeys.has(task.key)) {
            borderColor = '#28a745';
        }
        card.style.borderLeft = `5px solid ${borderColor}`;

        if (isAdmin && task.po) {
            card.classList.add('admin-clickable-task');
            card.dataset.po = task.po;
            card.title = `Admin: Double-click to search for PO ${task.po} in IM Reporting`;
        }

        const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
        const amountDisplay = (task.amount && parseFloat(task.amount) > 0) ?
            ` - QAR ${formatCurrency(task.amount)}` :
            ``;

        const noteHTML = task.note ?
            `<div class="task-detail-item note"><span class="label">Note:</span> ${task.note}</div>` :
            '';

        card.innerHTML = `
            <strong>${mainInfo}${amountDisplay}</strong>
            <div class="task-details-grid">
                <div class="task-detail-item">
                    <span class="label">Vendor:</span> ${task.vendorName || 'N/A'}
                </div>
                <div class="task-detail-item">
                    <span class="label">Site:</span> ${task.site || 'N/A'}
                </div>
                <div class="task-detail-item">
                    <span class="label">Job:</span> ${task.for || 'N/A'}
                </div>
                <div class="task-detail-item status">
                    <span class="label">Status:</span> ${task.remarks || 'Pending'}
                </div>
                ${noteHTML}
            </div>
        `;
        taskListDiv.appendChild(card);
    });
}

function generateDateScroller(selectedDate) {
    const scrollerInner = document.getElementById('wd-dayview-date-scroller-inner');
    if (!scrollerInner) return;

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let html = '';

    const parts = selectedDate.split('-').map(Number);
    const centerDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    for (let i = -3; i <= 3; i++) {
        const currentDate = new Date(centerDate);
        currentDate.setUTCDate(centerDate.getUTCDate() + i);

        const dayNum = String(currentDate.getUTCDate()).padStart(2, '0');
        const dayInitial = days[currentDate.getUTCDay()];

        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;

        const isActive = (dateStr === selectedDate) ? 'active' : '';

        html += `
            <div class="day-scroller-item ${isActive}" data-date="${dateStr}">
                <span class="day-scroller-num">${dayNum}</span>
                <span class="day-scroller-char">${dayInitial}</span>
            </div>
        `;
    }

    scrollerInner.innerHTML = html;
    setTimeout(() => {
        const activeItem = scrollerInner.querySelector('.day-scroller-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest'
            });
        }
    }, 100);
}

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


// ==========================================================================
// Inventory "In Transit" printable PDF (opens print dialog; user can Save as PDF)
// - Only shown in Inventory context (desktop) to share pending in-transit items
// ==========================================================================
function updateInTransitReportButtonVisibility() {
    try {
        if (!wdInTransitReportBtn) return;
        const invCtx = (typeof isInventoryContext === 'function' && isInventoryContext());
        // Keep mobile UI unchanged (hide on small screens)
        const show = invCtx && !isMobileViewport();
        wdInTransitReportBtn.style.display = show ? 'inline-flex' : 'none';

        if (wdInTransitContactFilterSelect) {
            wdInTransitContactFilterSelect.style.display = show ? 'inline-flex' : 'none';
            if (show) {
                // Populate options when the control becomes visible.
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

        // Build a unique, cleaned list of contacts.
        const map = new Map(); // key(lower) -> display
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
            ...contacts.map(c => `<option value="${_escapeHtml(c)}">${_escapeHtml(c)}</option>`)
        ].join('');

        if (current && Array.from(wdInTransitContactFilterSelect.options).some(o => o.value === current)) {
            wdInTransitContactFilterSelect.value = current;
        }
    } catch (e) {
        // Silent failure to avoid breaking workdesk.
    }
}

function _escapeHtml(val) {
    const s = (val === null || val === undefined) ? '' : String(val);
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function printInventoryInTransitReport() {
    try {
        await ensureAllEntriesFetched(false);

        // Keep the dropdown options fresh (no refresh needed)
        if (typeof populateInTransitContactFilterOptions === 'function') {
            populateInTransitContactFilterOptions();
        }

        const inTransitAll = getInTransitTransferEntries();

        // Optional filter: Contact
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

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/invoiceentry-b15a8.firebasestorage.app/o/Files%2Fiba_logo.jpg?alt=media&token=d7376281-75e0-4f8b-b9c5-9911e4522f68";

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
                    <td>${_escapeHtml(controlId)}</td>
                    <td>${_escapeHtml(jobType)}</td>
                    <td>${_escapeHtml(product)}</td>
                    <td>${_escapeHtml(route)}</td>
                    <td style="text-align:right;">${_escapeHtml(ordered)}</td>
                    <td style="text-align:right;">${_escapeHtml(delivered)}</td>
                    <td>${_escapeHtml(ship)}</td>
                    <td>${_escapeHtml(arr)}</td>
                    <td>${_escapeHtml(contact)}</td>
                    <td><strong>${_escapeHtml(status)}</strong></td>
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
        .header .company { font-weight: 900; font-size: 16px; color:#003A5C; }
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
            <div class="company">ISMAIL BIN ALI TRADING &amp; CONT. CO. W.L.L</div>
            <h2>Inventory – In Transit Report</h2>
        </div>
    </div>

    <div class="meta">
        <div><strong>Generated:</strong> ${_escapeHtml(printDate)}</div>
        <div><strong>Contact:</strong> ${selectedContact ? _escapeHtml(selectedContact) : 'All'}</div>
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

    <script>
        // Auto-open print dialog (user can Save as PDF)
        window.onload = function () {
            try { window.focus(); window.print(); } catch (e) {}
        };
    </script>
</body>
</html>`;

        const printWin = window.open('', '_blank');
        if (!printWin) {
            alert('Popup blocked. Please allow popups to print the report.');
            return;
        }
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();

    } catch (error) {
        console.error("printInventoryInTransitReport error:", error);
        alert('Failed to generate the In Transit report.');
    }
}



// ==========================================================================
// UPDATED FUNCTION: renderReportingTable (Includes 'Usage' & Strict Sticker Logic)
// ==========================================================================
function renderReportingTable(entries) {
    reportingTableBody.innerHTML = '';

    const inventoryTypes = ['Transfer', 'Restock', 'Return', 'Usage'];
    const isInventoryReport = ((typeof isInventoryContext === 'function' && isInventoryContext()) || inventoryTypes.includes(currentReportFilter));

    const tableHead = document.querySelector('#reporting-printable-area table thead');

    if (isInventoryReport) {
        tableHead.innerHTML = `
            <tr>
                <th>Control ID</th><th>Product Name</th><th>Site Route</th>
                <th>Ordered Qty</th><th>Delivered Qty</th><th>Shipping Date</th>
                <th>Arrival Date</th><th>Contact</th><th>Status / Remarks</th>
            </tr>`;
    } else {
        tableHead.innerHTML = `
            <tr>
                <th>Job</th><th>Ref</th><th>Site</th><th>PO</th>
                <th>Vendor Name</th><th>Amount</th><th>Entered By</th>
                <th>Date Entered</th><th>Attention</th><th>Date Responded</th>
                <th>Status</th>
            </tr>`;
    }

    const totalRecords = Array.isArray(entries) ? entries.length : 0;
    const emptyColspan = isInventoryReport ? 9 : 11;

    if (!entries || totalRecords === 0) {
        if (document.getElementById('job-records-count-display')) {
            document.getElementById('job-records-count-display').textContent = `(Total Records: 0)`;
        }
        reportingTableBody.innerHTML = `<tr><td colspan="${emptyColspan}">No entries found.</td></tr>`;
        return;
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';

    // ---------------------------------------------------------
    // Inventory Mode: Group by Control ID (Collapsible)
    // ---------------------------------------------------------
    if (isInventoryReport) {
        // helper: safe group id for dataset lookups
        const makeSafeId = (str) => {
            const base = (str ?? '').toString().trim();
            const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '_');
            return (cleaned || 'NO_CONTROL_ID').slice(0, 60);
        };

        // preserve order of first appearance
        const groups = [];
        const groupMap = new Map(); // controlId -> groupObj

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

        // Update count display: show groups + records
        if (document.getElementById('job-records-count-display')) {
            document.getElementById('job-records-count-display').textContent =
                `(Groups: ${groups.length} | Records: ${totalRecords})`;
        }

        // Ensure click handler is attached once (for expand/collapse)
        if (reportingTableBody && !reportingTableBody.dataset.inventoryGroupToggleBound) {
            reportingTableBody.dataset.inventoryGroupToggleBound = '1';
            reportingTableBody.addEventListener('click', (e) => {
                const tr = e.target.closest('tr.inventory-group-row');
                if (!tr) return;

                // Do not toggle if user clicked a button/link inside (future-proof)
                if (e.target.closest('button, a, input, select, textarea, label')) return;

                const groupId = tr.dataset.groupId;
                if (!groupId) return;

                const expanded = tr.dataset.expanded === '1';

                // Accordion behavior: when opening one Control ID group, close all others
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
                    row.style.display = expanded ? 'none' : 'table-row';
                });

                tr.dataset.expanded = expanded ? '0' : '1';

                const icon = tr.querySelector('.group-toggle-icon');
                if (icon) icon.textContent = expanded ? '▶' : '▼';
            });
        }

        // helper: build a normal inventory row (used for both grouped + single)
        const buildInventoryRow = (entry) => {
            let statusColor = 'black';
            if (entry.remarks === 'Approved') statusColor = '#28a745';
            if (entry.remarks === 'Pending') statusColor = '#dc3545';
            if (entry.remarks === 'Rejected') statusColor = 'red';
            if (entry.remarks === 'Completed') statusColor = '#003A5C';

            const noteDisplay = entry.note ? `<br><small style="color:#666; font-style:italic;">${entry.note}</small>` : '';

            let actions = `<button class="print-btn waybill-btn" data-key="${entry.key}" style="padding:2px 6px; margin-right:5px; font-size:0.7rem; background:#6f42c1; color:white; border:none; border-radius:4px;" title="Print Waybill"><i class="fa-solid fa-print"></i></button>`;
            actions += `<button class="history-btn action-btn" onclick="showTransferHistory('${entry.key}')" style="padding:2px 6px; margin-right:5px; font-size:0.7rem; background:#17a2b8; color:white; border:none; border-radius:4px;" title="View History"><i class="fa-solid fa-clock-rotate-left"></i></button>`;
            if (isAdmin) {
                actions += `<button type="button" class="delete-btn transfer-delete-btn" data-key="${entry.key}" style="padding:2px 6px; font-size:0.7rem; border-radius:4px;">Del</button>`;
            }

            return `
                <td><strong>${entry.controlId || ''}</strong></td>
                <td>${entry.productName || ''}</td>
                <td>${entry.site || ''}</td>
                <td>${entry.orderedQty || 0}</td>
                <td>${entry.deliveredQty || 0}</td>
                <td>${entry.shippingDate || ''}</td>
                <td>${entry.arrivalDate || ''}</td>
                <td>${entry.contactName || ''}</td>
                <td>
                    <span style="color:${statusColor}; font-weight:bold;">${entry.remarks || 'Pending'}</span>
                    ${noteDisplay}
                    <div style="margin-top:5px;">${actions}</div>
                </td>
            `;
        };

        // Render groups (collapsed by default when multiple)
        groups.forEach(g => {
            const items = g.items || [];
            if (items.length <= 1) {
                const entry = items[0];
                const row = document.createElement('tr');
                row.setAttribute('data-key', entry.key);
                row.innerHTML = buildInventoryRow(entry);
                reportingTableBody.appendChild(row);
                return;
            }

            // summary info
            const uniqueProducts = Array.from(new Set(items.map(x => (x.productName || '').toString().trim()).filter(Boolean)));
            const productSummary = uniqueProducts.length === 1
                ? uniqueProducts[0]
                : `Multiple (${uniqueProducts.length})`;

            const uniqueSites = Array.from(new Set(items.map(x => (x.site || '').toString().trim()).filter(Boolean)));
            const siteSummary = uniqueSites.length === 1
                ? uniqueSites[0]
                : (uniqueSites.length > 1 ? `Multiple (${uniqueSites.length})` : '');

            const sumNum = (val) => {
                const n = parseFloat(val);
                return Number.isFinite(n) ? n : 0;
            };
            const totalOrdered = items.reduce((acc, x) => acc + sumNum(x.orderedQty), 0);
            const totalDelivered = items.reduce((acc, x) => acc + sumNum(x.deliveredQty), 0);

            // Group header row
            const groupRow = document.createElement('tr');
            groupRow.className = 'inventory-group-row';
            groupRow.dataset.groupId = g.groupId;
            groupRow.dataset.expanded = '0';

            groupRow.innerHTML = `
                <td>
                    <span class="group-toggle-icon">▶</span>
                    <strong>${g.displayCid}</strong>
                    <span class="group-count-badge">(${items.length})</span>
                </td>
                <td>${productSummary}</td>
                <td>${siteSummary}</td>
                <td>${totalOrdered}</td>
                <td>${totalDelivered}</td>
                <td></td>
                <td></td>
                <td></td>
                <td><span style="color:#003A5C; font-weight:700;">Grouped</span> <span style="color:#666;">(click to expand)</span></td>
            `;
            reportingTableBody.appendChild(groupRow);

            // Child rows (hidden by default)
            items.forEach(entry => {
                const child = document.createElement('tr');
                child.className = 'inventory-child-row';
                child.dataset.parent = g.groupId;
                child.style.display = 'none';
                child.setAttribute('data-key', entry.key);
                child.innerHTML = buildInventoryRow(entry);
                reportingTableBody.appendChild(child);
            });
        });

        return;
    }

    // ---------------------------------------------------------
    // Standard Job Records (No grouping changes)
    // ---------------------------------------------------------
    if (document.getElementById('job-records-count-display')) {
        document.getElementById('job-records-count-display').textContent = `(Total Records: ${totalRecords})`;
    }

    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', entry.key);

        const status = entry.remarks || 'Pending';
        let actions = `<button class="history-btn action-btn" onclick="event.stopPropagation(); showJobHistory('${entry.key}')" style="padding:2px 6px; font-size:0.7rem; background:#17a2b8; color:white; border:none; border-radius:4px;" title="View History"><i class="fa-solid fa-clock-rotate-left"></i></button>`;

        row.innerHTML = `
            <td>${entry.for || ''}</td>
            <td>${entry.ref || ''}</td>
            <td>${entry.site || ''}</td>
            <td>${entry.po || ''}</td>
            <td>${entry.vendorName || 'N/A'}</td>
            <td>${entry.amount || ''}</td>
            <td>${entry.enteredBy || ''}</td>
            <td>${entry.date || ''}</td>
            <td>${entry.attention || ''}</td>
            <td>${entry.dateResponded || ''}</td>
            <td>
                ${status}
                <div style="margin-top:5px;">${actions}</div>
            </td>
        `;

        reportingTableBody.appendChild(row);
    });
}

function filterAndRenderReport(baseEntries = []) {
    let filteredEntries = [...baseEntries];

    // 0. Inventory Mode: show ONLY inventory records in the Inventory clone.
//    Normal Workdesk (DESKTOP) hides inventory-related jobs. Mobile is unchanged.
    if (typeof isInventoryContext === 'function' && isInventoryContext()) {
        filteredEntries = filteredEntries.filter(entry => INVENTORY_TYPES.includes(entry.for));
    } else if (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop()) {
        filteredEntries = filteredEntries.filter(entry => !INVENTORY_TYPES.includes(entry.for));
    }

    // 1. Filter by Tab (Job Type)
    if (currentReportFilter && currentReportFilter !== 'All') {
        filteredEntries = filteredEntries.filter(entry => (entry.for || 'Other') === currentReportFilter);
    }

    // 2. Filter by Search Text
    const searchText = reportingSearchInput.value.toLowerCase();
    sessionStorage.setItem('reportingSearch', searchText);

    if (searchText) {
        filteredEntries = filteredEntries.filter(entry => {
            // Safe helper to check if a value contains the search text
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
                // Specific to Transfers
                check(entry.controlId) ||
                check(entry.productName) ||
                check(entry.contactName)
            );
        });
    }

    renderReportingTable(filteredEntries);
}

// ==========================================================================
// REPLACED FUNCTION: handleReportingSearch (Clean Start / Lazy Render)
// ==========================================================================
async function handleReportingSearch() {
    // Show loading initially
    reportingTableBody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px;">Loading categories...</td></tr>';

    try {
        // 1. Load All Data (Still required to build the buttons)
        await ensureAllEntriesFetched();
        await ensureInvoiceDataFetched(false);
        await reconcilePendingPRs();

        // 2. Build Tabs
        let baseEntries = allSystemEntries;
        if (typeof isInventoryContext === 'function' && isInventoryContext()) {
            baseEntries = allSystemEntries.filter(entry => INVENTORY_TYPES.includes(entry.for));
        } else if (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop()) {
            // Desktop Workdesk should hide inventory job records (mobile unchanged)
            baseEntries = allSystemEntries.filter(entry => !INVENTORY_TYPES.includes(entry.for));
        }

        const uniqueJobTypes = [...new Set(baseEntries.map(entry => entry.for || 'Other'))];
        uniqueJobTypes.sort();

        
        // Safety: if the previously-selected tab isn't available (e.g., desktop hides inventory tabs), reset.
        if (currentReportFilter && !uniqueJobTypes.includes(currentReportFilter)) {
            currentReportFilter = null;
        }
let tabsHTML = '';

        // --- CHANGE: Do NOT auto-select the first tab ---
        uniqueJobTypes.forEach(jobType => {
            const activeClass = (jobType === currentReportFilter) ? 'active' : '';
            tabsHTML += `<button class="${activeClass}" data-job-type="${jobType}">${jobType}</button>`;
        });

        const tabsContainer = document.getElementById('report-tabs');
        if (tabsContainer) tabsContainer.innerHTML = tabsHTML;

        // 3. Render Logic (The "Clean" Check)
        const savedSearch = sessionStorage.getItem('reportingSearch');

        // Condition A: If user typed in Search box, show results immediately
        if (savedSearch && savedSearch.trim() !== '') {
             filterAndRenderReport(baseEntries);
        }
        // Condition B: If user clicked a tab (Filter is active), show results
        else if (currentReportFilter && currentReportFilter !== 'All') {
             filterAndRenderReport(baseEntries);
        }
        // Condition C: CLEAN START (No Search, No Tab Clicked)
        else {
             reportingTableBody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 50px; color: #888;">
                        <i class="fa-solid fa-arrow-up" style="font-size: 2rem; margin-bottom: 15px; color: #00748C;"></i><br>
                        <strong style="font-size: 1.1rem; color: #333;">Select a Category above</strong><br>
                        <span>(e.g., IPC, Invoice, Transfer) to view records.</span>
                    </td>
                </tr>`;
             // Clear the count display
             if (reportingCountDisplay) reportingCountDisplay.textContent = '';
        }

    } catch (error) {
        console.error("Error loading reporting:", error);
        reportingTableBody.innerHTML = '<tr><td colspan="11" style="color:red; text-align:center;">Error loading data.</td></tr>';
    }
}

// ==========================================================================
// UPDATED FUNCTION: renderActiveTaskTable (Uses handleSRVDone)
// ==========================================================================
function renderActiveTaskTable(tasks) {
    var isMobile = window.innerWidth <= 768;
    if (isMobile) {
        if (typeof renderMobileActiveTasks === 'function') renderMobileActiveTasks(tasks);
        return;
    }

    activeTaskTableBody.innerHTML = '';

    // Filter by Hybrid Tabs
    var filteredTasks = tasks.filter(function(task) {
        var specialTypes = ['Transfer', 'Restock', 'Return', 'Usage'];
        var isSpecialTab = specialTypes.indexOf(currentActiveTaskFilter) !== -1;
        var taskIsSpecial = specialTypes.indexOf(task.for) !== -1;

        if (isSpecialTab) {
            return task.for === currentActiveTaskFilter;
        } else {
            return task.remarks === currentActiveTaskFilter && !taskIsSpecial;
        }
    });

    if (filteredTasks.length === 0) {
        activeTaskTableBody.innerHTML = '<tr><td colspan="10">No tasks found for "' + currentActiveTaskFilter + '".</td></tr>';
        return; 
    } 

    // Setup Headers
    var isTransferView = filteredTasks.length > 0 && ['Transfer', 'Restock', 'Return', 'Usage'].indexOf(filteredTasks[0].for) !== -1;
    var tableHead = document.querySelector('#wd-activetask table thead');

    if (isTransferView) {
        tableHead.innerHTML = 
            '<tr>' +
                '<th class="desktop-only">Control ID</th>' +
                '<th class="desktop-only">Product Name</th>' +
                '<th class="desktop-only">Details</th>' +
                '<th class="desktop-only">Movement</th>' +
                '<th class="desktop-only">Current Qty</th> <th class="desktop-only">Contact</th>' +
                '<th class="desktop-only">Status</th>' +
                '<th class="desktop-only">Action</th>' +
            '</tr>';
    } else {
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

    var isCEO = document.body.classList.contains('is-ceo');
    var userPos = (currentApprover.Position || '').toLowerCase();
    var userRole = (currentApprover.Role || '').toLowerCase();
    var isManager = userPos.indexOf('manager') !== -1 || 
                    userPos.indexOf('director') !== -1 || 
                    userPos.indexOf('ceo') !== -1 || 
                    userRole === 'admin'; 

    // --- Inventory Active Tasks: group by Control ID (accordion) ---
if (isTransferView) {
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

    const inInventoryContext = (typeof isInventoryContext === 'function' && isInventoryContext());

    const renderTransferRow = (task, { isChild = false } = {}) => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', task.key);
        row.classList.toggle('controlid-group-child', isChild);

        if (task.isUrgent === false) {
            row.style.opacity = '0.7';
            row.style.backgroundColor = '#f9f9f9';
        }

        let actionButtons = '<button class="transfer-action-btn" data-key="' + task.key + '" style="background-color: #17a2b8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">Action</button>';

        // Keep existing delete rule (admin-only and not in inventory clone)
        if (userRole === 'admin' && !inInventoryContext) {
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

        // Render with the same column order as before
        row.innerHTML =
            controlCell +
            '<td class="desktop-only">' + (task.vendorName || task.productName) + '</td>' +
            '<td class="desktop-only">' + (task.details || '') + '</td>' +
            '<td class="desktop-only">' + movement + '</td>' +
            '<td class="desktop-only" style="font-weight: bold; color: #003A5C;">' + displayQty + qtyLabel + '</td>' +
            '<td class="desktop-only">' + (task.contactName || task.requestor || '') + '</td>' +
            '<td class="desktop-only"><span style="color: ' + statusColor + '; font-weight: bold;">' + task.remarks + '</span></td>' +
            '<td class="desktop-only">' + actionButtons + '</td>';

        return row;
    };

    // Group tasks by Control ID (ref)
    const groups = new Map();
    filteredTasks.forEach(t => {
        const k = getControlKey(t);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
    });

    // Helpers for accordion (only one open at a time)
    const closeAllGroups = () => {
        document.querySelectorAll('#active-task-table-body tr.controlid-group-child').forEach(r => { r.style.display = 'none'; });
        document.querySelectorAll('#active-task-table-body tr.controlid-group-header').forEach(r => { r.classList.remove('open'); });
    };

    const openGroup = (groupId) => {
        document.querySelectorAll('#active-task-table-body tr.controlid-group-child[data-parent-group="' + groupId.replace(/"/g, '') + '"]').forEach(r => { r.style.display = 'table-row'; });
        const header = document.querySelector('#active-task-table-body tr.controlid-group-header[data-group-id="' + groupId.replace(/"/g, '') + '"]');
        if (header) header.classList.add('open');
    };

    // Render groups (sorted)
    const groupIds = Array.from(groups.keys()).sort((a, b) => String(a).localeCompare(String(b)));
    groupIds.forEach(groupId => {
        const items = groups.get(groupId) || [];
        if (items.length <= 1) {
            activeTaskTableBody.appendChild(renderTransferRow(items[0]));
            return;
        }

        // Summary line
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
        headerRow.setAttribute('data-group-id', groupId);

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

        // Accordion click behavior
        headerRow.addEventListener('click', () => {
            const isOpen = headerRow.classList.contains('open');
            closeAllGroups();
            if (!isOpen) openGroup(groupId);
        });

        activeTaskTableBody.appendChild(headerRow);

        // Child rows (hidden by default)
        items.forEach(item => {
            const childRow = renderTransferRow(item, { isChild: true });
            childRow.setAttribute('data-parent-group', groupId);
            childRow.style.display = 'none';
            activeTaskTableBody.appendChild(childRow);
        });
    });

    return; // prevent standard renderer
}

filteredTasks.forEach(function(task) {
        var row = document.createElement('tr');
        row.setAttribute('data-key', task.key);

        if (task.isUrgent === false) {
            row.style.opacity = '0.7';
            row.style.backgroundColor = '#f9f9f9';
        }

            // --- STANDARD ROW ---
            var isInvoiceFromIrwin = task.source === 'invoice' && task.enteredBy === 'Irwin';
            var invName = task.invName || '';
            var isClickable = (isInvoiceFromIrwin || (task.source === 'invoice' && invName)) &&
                              invName.trim() && invName.toLowerCase() !== 'nil';

            if (isClickable) row.classList.add('clickable-pdf');
            if (isCEO) row.title = "Click to open approval modal";
            else if (isClickable) row.title = "Click to open PDF";

            var displayAmount = task.amountPaid || task.amount || 0;

            row.innerHTML = 
                '<td class="desktop-only">' + (task.for || '') + '</td>' +
                '<td class="desktop-only">' + (task.ref || '') + '</td>' +
                '<td class="desktop-only">' + (task.po || '') + '</td>' +
                '<td class="desktop-only">' + (task.vendorName || 'N/A') + '</td>' +
                '<td class="desktop-only">' + formatCurrency(displayAmount) + '</td>' +
                '<td class="desktop-only">' + (task.site || '') + '</td>' +
                '<td class="desktop-only">' + (task.date || '') + '</td>' +
                '<td class="desktop-only">' + (task.note || '') + '</td>' +
                '<td class="desktop-only">' + (task.remarks || 'Pending') + '</td>';

            var actionsCell = document.createElement('td');
            actionsCell.className = "desktop-only";

            if (task.remarks === 'For Approval' && isManager) {
                var approveBtn = document.createElement('button');
                approveBtn.className = 'action-btn approve-btn';
                approveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                approveBtn.title = 'Approve';
                approveBtn.style.backgroundColor = '#28a745';
                approveBtn.style.color = 'white';
                approveBtn.style.marginRight = '5px';
                approveBtn.onclick = function(e) { e.stopPropagation(); handleDesktopApproval(task, 'Approved'); };
                
                var rejectBtn = document.createElement('button');
                rejectBtn.className = 'action-btn reject-btn';
                rejectBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                rejectBtn.title = 'Reject';
                rejectBtn.style.backgroundColor = '#dc3545';
                rejectBtn.style.color = 'white';
                rejectBtn.onclick = function(e) { e.stopPropagation(); handleDesktopApproval(task, 'Rejected'); };

                actionsCell.appendChild(approveBtn);
                actionsCell.appendChild(rejectBtn);

            } else if (isCEO) {
                actionsCell.innerHTML = '<button class="ceo-approve-btn" data-key="' + task.key + '">Make Approval</button>';
            } else {
                var actionsHTML = '';
                
		        // SRV Done is handled via the unified Active Task click listener (single source of truth).
		        if (task.remarks === 'For SRV' || task.remarks === 'Waiting Signature' || task.remarks === 'Waiting Approval') {
		            // 1. The Finish Button
		            actionsHTML += `<button class="srv-done-btn" data-key="${task.key}" style="margin-right: 5px;">SRV Done</button>`;
                    
                    // 2. The Edit Button (Process)
                    actionsHTML += `<button class="modify-btn" data-key="${task.key}">Process</button>`;
                } else {
                    actionsHTML = `<button class="modify-btn" data-key="${task.key}">Process</button>`;
                }
                actionsCell.innerHTML = actionsHTML;
            }
            row.appendChild(actionsCell);
        activeTaskTableBody.appendChild(row);
    });
}

// ==========================================================================
// UPDATED FUNCTION: populateActiveTasks (V5.3.4)
// FIX: "For SRV" is now STRICTLY Attention-based.
// It ignores the "All Sites" profile capability.
// ==========================================================================
async function populateActiveTasks() {
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
// Direct-attention + site-match helpers (for accurate UI triggers)
// Only tasks that are BOTH:
//   1) attention == current user (case-insensitive), AND
//   2) task site matches the user's site
// will be allowed to trigger blink/color/count.
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

        await ensureAllEntriesFetched();
        await ensureApproverDataCached(true);
        
        if (!isInventoryPage) {
            await ensureInvoiceDataFetched(false);
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
                if (entry.remarks === 'Pending Admin' || entry.remarks === 'Pending') return isMeOrDelegated(entry.approver);
                if (entry.remarks === 'Approved' || entry.remarks === 'In Transit') return isMeOrDelegated(entry.receiver);
                if (isMeOrDelegated(entry.attention)) return true;
                if (entry.attention === 'All' && (entry.site === currentUserSite || currentUserSite === 'All')) return true;
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
let isUrgent = isDirectAttentionForUser(task.attention) && isSiteMatchForUser(taskSiteForMatch);

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
               isSiteMatchForUser(taskSiteForMatch) &&
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

                    // [FIX 3] ATTENTION CHECK (Direct attention ONLY triggers UI)
// Visibility may still be granted by the blocks above, but
// blink/color/count is ONLY for direct attention + site match.
if (inv.attention === 'All') {
    shouldShow = true;
    isUrgent = false; // "All" = visible but NOT a direct action for a specific user
} 
else if (isDirectAttentionForUser(inv.attention)) {
    shouldShow = true;
    isUrgent = isSiteMatchForUser(poSite) && inv.status !== 'On Hold';
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
        // Desktop Workdesk: hide inventory tasks/jobs (Mobile unchanged)
        if (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop()) {
            userTasks = userTasks.filter(t => !INVENTORY_TYPES.includes(t.for));
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
        const totalTaskCount = userActiveTasks.length;
        const urgentCount = userActiveTasks.filter(t => t.isUrgent === true).length;

        if (activeTaskCountDisplay) {
            activeTaskCountDisplay.textContent = `(Action: ${urgentCount} | Records: ${totalTaskCount})`;
        }
        
        [wdActiveTaskBadge, imActiveTaskBadge, wdMobileNotifyBadge].forEach(badge => {
            if (badge) {
                badge.textContent = urgentCount;
                badge.style.display = urgentCount > 0 ? 'inline-block' : 'none';
            }
        });

        const wdActiveLink = document.querySelector('.wd-nav-activetask a');
        const imActiveLink = document.getElementById('im-activetask-button');
        const mobileActiveLink = document.getElementById('im-mobile-activetask-link');
        const targets = [wdActiveLink, imActiveLink, mobileActiveLink];

        targets.forEach(el => {
            if (el) {
                if (urgentCount > 0) el.classList.add('nav-pulse-active');
                else el.classList.remove('nav-pulse-active');
            }
        });

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
        tabText = '#ffffff';
        fontWeight = '800';
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
                 style="background-color: ${tabColor}; color: white; font-size: 0.7rem; margin-left: 5px;">
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

    let searchedTasks = userActiveTasks;
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

// ==========================================================================
// NEW FUNCTION: Handle SRV Done (Routes back to Sender)
// ==========================================================================
async function handleSRVDone(btn, key) {
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processing...';
    }

    try {
        // Make sure invoice data is available when dealing with invoice tasks
        if (typeof ensureInvoiceDataFetched === 'function') {
            await ensureInvoiceDataFetched(false);
        } else if (typeof ensureAllEntriesFetched === 'function') {
            await ensureAllEntriesFetched(false);
        }

        const keyStr = String(key || '').trim();
        const taskFromList = (Array.isArray(userActiveTasks)
            ? (userActiveTasks.find(t => t && String(t.key || '').trim() === keyStr) || {})
            : {});

        // Some invoice tasks come from invoice_tasks_by_user and should still be treated as invoice even if the key parsing fails.
        const isInvoiceDB = keyStr.includes('_') || (taskFromList && taskFromList.source === 'invoice');

        let sender = 'Accounting';
        let oldAttention = '';
        let poNumber = '';
        let invoiceKey = '';

        if (isInvoiceDB) {
            // Prefer explicit fields if available (avoids parsing edge cases)
            if (taskFromList && taskFromList.originalPO) poNumber = taskFromList.originalPO;
            if (taskFromList && taskFromList.originalKey) invoiceKey = taskFromList.originalKey;

            // Fallback: parse composite key
            if ((!poNumber || !invoiceKey) && keyStr.includes('_')) {
                const idx = keyStr.indexOf('_');
                poNumber = poNumber || keyStr.slice(0, idx);
                invoiceKey = invoiceKey || keyStr.slice(idx + 1);
            }

            poNumber = String(poNumber || '').trim().toUpperCase();
            const candidateInvoiceKey = String(invoiceKey || '').trim();

            // ------------------------------------------------------------------
            // IMPORTANT: Prevent "re-entering" / duplicating invoice entries.
            // If we update a non-existing path in Firebase, it CREATES a new record.
            // So we first resolve the REAL invoice entry key before updating.
            // ------------------------------------------------------------------
            const resolveInvoiceEntry = async () => {
                if (!poNumber) return { resolvedKey: null, invData: null };

                // 1) Direct key lookup
                if (candidateInvoiceKey) {
                    const directSnap = await invoiceDb.ref(`invoice_entries/${poNumber}/${candidateInvoiceKey}`).once('value');
                    if (directSnap.exists()) {
                        return { resolvedKey: candidateInvoiceKey, invData: directSnap.val() || {} };
                    }
                }

                // 2) Try cache / PO scan (match by invEntryID or invNumber)
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

                // Cache first
                const cacheBucket = (allInvoiceData && allInvoiceData[poNumber]) ? allInvoiceData[poNumber] : null;
                let best = pickBestMatch(cacheBucket);

                // If not found in cache, fetch PO branch and scan
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

            if (!resolvedKey) {
                throw new Error(`Invoice entry not found for PO ${poNumber}. (Prevented duplicate creation)`);
            }

            // Use the resolved key (this is what exists in invoice_entries)
            invoiceKey = resolvedKey;

            sender = (invData && (invData.enteredBy || invData.originEnteredBy)) || 'Accounting';
            oldAttention = (taskFromList.attention || (invData ? invData.attention : '') || '');

            // Update Invoice Entry (correct path)
            const updates = { status: 'SRV Done', attention: '', lastUpdated: firebase.database.ServerValue.TIMESTAMP };
            await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates);

            // Defensive cleanup: remove any lingering inbox copies for this invoice.
            // Remove both the candidate key and the resolved key (if different) to cover legacy inbox formats.
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
            } catch (_) { /* never block SRV Done */ }

            // Keep task lookup in sync (so tasks move/clear correctly)
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
            // Job Entry
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

    // =========================================================
    // 5. NEW TAB COLORING LOGIC (ADDED FOR V5.2.5 FIX)
    // =========================================================
    // This looks at ALL tasks (not just filtered ones) to color tabs
    // based on whether YOU are mentioned (Urgent) or just Site (Grey)
    
    var categories = ['Invoice', 'PR', 'Transfer', 'Site', 'Admin'];
    
    categories.forEach(function(cat) {
        var tabEl = document.getElementById('tab-' + cat.toLowerCase());
        if (!tabEl) return;

        // Find tasks belonging to this tab
        var tasksForTab = tasks.filter(function(t) {
            return t.for === cat || t.jobType === cat;
        });

        // Check if any of them are URGENT (Attention == You)
        // This 'isUrgent' flag comes from populateActiveTasks
        var hasUrgent = tasksForTab.some(function(t) { return t.isUrgent === true; });
        var hasAny = tasksForTab.length > 0;

        // Reset
        tabEl.classList.remove('blink-tab', 'tab-active-color', 'tab-grey');
        tabEl.style.opacity = '1';

        if (hasUrgent) {
            // Urgent: Color + Blink
            tabEl.classList.add('tab-active-color', 'blink-tab');
        } else if (hasAny) {
            // Not Urgent but has tasks: Grey
            tabEl.classList.add('tab-grey');
        } else {
            // Empty
            tabEl.style.opacity = '0.5';
        }
    });



function renderMobileActiveTasks(tasks) {
    const container = document.getElementById('active-task-mobile-view');
    const receiptContainer = document.getElementById('mobile-receipt-action-container');

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
    let filteredTasks = tasks;
    if (currentActiveTaskFilter !== 'All') {
        if (currentActiveTaskFilter === 'Other') {
            filteredTasks = tasks.filter(task => task.remarks !== 'For SRV' && task.remarks !== 'Pending Signature');
        } else {
            filteredTasks = tasks.filter(task => {
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

    // 5. Render Cards
    filteredTasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'mobile-task-card';
        let html = '';

        // --- A. INVENTORY CARD ---
        if (['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) {
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

            html += `
            <div class="mobile-card-header" style="border-left: 5px solid #17a2b8;">
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
                <div class="m-action-group">
                     <p style="font-size: 0.9rem; color: #333; margin-bottom:5px;"><strong>Status:</strong> <span style="color:#C3502F;">${task.remarks}</span></p>
                     <p style="font-size: 0.9rem; color: #555;"><strong>Details:</strong> ${task.details || 'N/A'}</p>
                </div>
            `;

            if (canApprove) {
                html += `
                <div class="m-btn-row" style="margin-top:15px;">
                    <button class="m-btn-approve trf-mobile-action" data-action="Approved" style="background-color: #17a2b8; width:100%; padding:12px; border-radius:8px; border:none; color:white; font-weight:bold;">
                        <i class="fa-solid fa-check"></i> Confirm / Approve
                    </button>
                    <button class="m-btn-reject trf-mobile-action" data-action="Rejected" style="background-color: #dc3545; width:100%; padding:12px; border-radius:8px; border:none; color:white; font-weight:bold;">
                        <i class="fa-solid fa-xmark"></i> Reject
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
        if (['Transfer', 'Restock', 'Return', 'Usage'].includes(task.for)) {
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
        dateResponded: formatDate(new Date())
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
        dateResponded: formatDate(new Date())
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
            await window.handleTransferAction(action);
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

function resetJobEntryForm(keepJobType = false) {
    const jobType = document.getElementById('job-for').value;

    // 1. Reset the actual form inputs
    document.getElementById('jobentry-form').reset();

    // 2. Restore Job Type if requested
    if (keepJobType) {
        document.getElementById('job-for').value = jobType;
    }

    // 3. CRITICAL: Switch Mode back to "ADD"
    currentlyEditingKey = null; // Forget the ID we were editing
    document.getElementById('standard-modal-title').textContent = 'Add New Job Entry';

    // 4. Toggle Buttons (Hide Update/Delete, Show Add)
    // We use classList to ensure we don't break the layout
    const addBtn = document.getElementById('add-job-button');
    const updateBtn = document.getElementById('update-job-button');
    const deleteBtn = document.getElementById('delete-job-button');

    if (addBtn) addBtn.classList.remove('hidden');
    if (updateBtn) updateBtn.classList.add('hidden');
    if (deleteBtn) deleteBtn.classList.add('hidden');

    // 5. Remove Highlight Visuals
    ['job-amount', 'job-po'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('highlight-field');
    });

    // 6. Reset Dropdowns (Choices.js)
    if (attentionSelectChoices) {
        if (attentionSelectChoices.disabled) attentionSelectChoices.enable();
        attentionSelectChoices.clearInput();
        attentionSelectChoices.removeActiveItems();
        // Repopulate to ensure list is clean
        populateAttentionDropdown(attentionSelectChoices);
    }

    if (siteSelectChoices) {
        siteSelectChoices.clearInput();
        siteSelectChoices.removeActiveItems();
    }

    // 7. Hide Transfer Fields (Just in case)
    const transferContainer = document.getElementById('transfer-fields-container');
    if (transferContainer) transferContainer.classList.add('hidden');

    document.querySelectorAll('.jobentry-form-2col .form-column').forEach(col => col.classList.remove('hidden'));

    // 8. Reset Search (Optional, keeps UI clean)
    const searchInput = document.getElementById('job-entry-search');
    if (searchInput) searchInput.value = '';
    sessionStorage.removeItem('jobEntrySearch');
}

// --- Helper: Toggle "Other" Input ---
function toggleJobOtherInput() {
    const select = document.getElementById('job-for');
    const otherInput = document.getElementById('job-other-specify');
    if (select.value === 'Other') {
        otherInput.classList.remove('hidden');
        otherInput.focus();
    } else {
        otherInput.classList.add('hidden');
        otherInput.value = ''; // Clear it if they switch back
    }
}
// Expose to global scope for HTML onchange
window.toggleJobOtherInput = toggleJobOtherInput;


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
        last_approver: currentApprover.Name
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
async function populateAttentionDropdown(choicesInstance, filterStatus = null, filterSite = null, allowOverrideSearch = false) {
    try {
        if (!choicesInstance) return;

        // 1. Fetch Data (if missing)
        if (!allApproverData) {
            const snapshot = await db.ref('approvers').once('value');
            allApproverData = snapshot.val();
        }
        const approvers = allApproverData;

        if (approvers) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // --- A. DEFINE RULES ---
            let validPositions = null;
            let checkSite = false;

            if (filterStatus) {
                const statusKey = (filterStatus || '').toString().trim();
                switch (statusKey) {
                    case 'For SRV':
                    case 'No Need SRV':
                        // Batch Entry rule: SRV should only suggest Site DC + Camp Boss (site-matched)
                        validPositions = ['Site DC', 'Camp Boss'];
                        checkSite = true; // Match User Site with PO Site
                        break;
                        
                    case 'For IPC':  // <--- ADDED THIS NEW RULE
                        validPositions = ['QS', 'Senior QS'];
                        checkSite = true; // Match User Site with PO Site
                        break;
                    
                    // For Approval and any other status should show ALL (no auto-filter)
                    case 'For Approval':
                        validPositions = null;
                        break;
                        
                    case 'CEO Approval':
                        validPositions = ['CEO'];
                        break;
                        
                    case 'Report':
                        // Report should suggest Accounts users (GIO first)
                        validPositions = ['Accounts', 'Account'];
                        break;
                        
                    default:
                        validPositions = null; // Everyone suggested
                        break;
                }
            }

            const isReportStatus = (String(filterStatus || '').trim().toLowerCase() === 'report');

            // --- B. PROCESS ALL USERS (Background Data) ---
            const allProcessedUsers = Object.values(approvers).map(approver => {
                if (!approver.Name) return null;

                const position = (approver.Position || '').trim();
                const userSite = (approver.Site || '').trim();

                // Vacation Logic
                const isOnVacation = approver.Vacation === true || approver.Vacation === "Yes";
                let isVacationActive = false;
                if (isOnVacation) {
                    if (!approver.DateReturn) {
                        isVacationActive = true;
                    } else {
                        try {
                            const returnDate = new Date(approver.DateReturn + 'T00:00:00Z');
                            if (!isNaN(returnDate) && returnDate >= today) isVacationActive = true;
                        } catch (e) {}
                    }
                }

                const name = approver.Name || 'No-Name';
                const siteLabel = approver.Site || 'No-Site';
                const newLabel = `${name} - ${position} - ${siteLabel}`;
                const displayLabel = isVacationActive ? `${newLabel} (On Vacation)` : newLabel;

                return {
                    value: approver.Name,
                    label: displayLabel,
                    position: position,
                    site: userSite,
                    customProperties: {
                        onVacation: isVacationActive,
                        returnDate: (approver.DateReturn ? formatYYYYMMDD(String(approver.DateReturn)).toUpperCase() : 'N/A'),
                        replacement: {
                            name: approver.ReplacementName || 'N/A',
                            contact: approver.ReplacementContact || 'N/A',
                            email: approver.ReplacementEmail || 'N/A'
                        }
                    }
                };
            }).filter(Boolean);

            // --- C. CREATE SUGGESTED LIST (Default View) ---
            const suggestedList = allProcessedUsers.filter(user => {
                const _nameUpper = String(user.value || '').trim().toUpperCase();
                if (isReportStatus && _nameUpper === 'GIO') return true;
                if (!validPositions) return true; 

                // Check Position
                const userPos = (user.position || '').toLowerCase();
                const isPosMatch = validPositions.some(role => {
                    const r = (role || '').toLowerCase();
                    if (r === 'admin') return userPos.includes('admin');
                    if (r === 'accounts' || r === 'account') return userPos.includes('account');
                    if (r === 'camp boss') return userPos.includes('camp') && userPos.includes('boss');
                    if (r === 'site dc') return userPos.includes('site') && userPos.includes('dc');
                    return userPos === r;
                });
                if (!isPosMatch) return false;

                // Check Site (For SRV & IPC)
                if (checkSite && filterSite) {
            // Match site by ID token (supports values like "181", "181 - Camp", etc.)
            const _siteId = (s) => String(s || '').trim().split(' ')[0].toLowerCase();
            const _siteMatch = (userSite, targetSite) => {
                const u = String(userSite || '').trim();
                const t = String(targetSite || '').trim();
                if (!u || !t) return false;
                const uId = _siteId(u);
                const tId = _siteId(t);
                if (uId && tId && uId === tId) return true;
                // Fallback: substring match either direction
                return u.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(u.toLowerCase());
            };
            if (!_siteMatch(user.site, filterSite)) return false;
        }
                return true;
            });

            // Sort lists
            suggestedList.sort((a, b) => {
                const aIsGIO = String(a.value || '').trim().toUpperCase() === 'GIO';
                const bIsGIO = String(b.value || '').trim().toUpperCase() === 'GIO';
                if (isReportStatus) {
                    if (aIsGIO && !bIsGIO) return -1;
                    if (!aIsGIO && bIsGIO) return 1;
                }
                return a.label.localeCompare(b.label);
            });
            allProcessedUsers.sort((a, b) => a.label.localeCompare(b.label));

            // Base Options
            const baseOptions = [
                { value: '', label: 'Select Attention', disabled: true, selected: true },
                { value: 'None', label: 'None (Clear Selection)' },
                { value: 'All', label: 'All (Send to Records)' }
            ];

            // --- D. INITIAL RENDER ---
            // Keep current selection visible even if it is outside the suggested list (override use-case)
            let selectedExtras = [];
            try {
                let selected = (typeof choicesInstance.getValue === 'function') ? choicesInstance.getValue(true) : null;
                if (selected && !Array.isArray(selected)) selected = [selected];
                if (Array.isArray(selected)) {
                    const suggestedValues = new Set(suggestedList.map(u => u.value));
                    const added = new Set();
                    selected.map(v => (v || '').toString().trim()).filter(v => v && v !== 'All' && v !== 'None').forEach(val => {
                        if (suggestedValues.has(val) || added.has(val)) return;
                        const found = allProcessedUsers.find(u => u.value === val);
                        if (found) {
                            selectedExtras.push({ value: found.value, label: found.label });
                        } else {
                            selectedExtras.push({ value: val, label: val });
                        }
                        added.add(val);
                    });
                }
            } catch (e) {}

            const initialChoices = [...baseOptions, ...selectedExtras, ...suggestedList];
            choicesInstance.clearChoices();
            choicesInstance.setChoices(initialChoices, 'value', 'label', true);

            // --- E. OVERRIDE SEARCH (Batch Entry Use-Case) ---
            // By default we keep Choices' own search behavior (search within the current suggested list).
            // When allowOverrideSearch = true, typing will search across ALL approvers (even if they don't match the auto-filter),
            // so you can select a temporary replacement without editing approver-site mappings.
            if (allowOverrideSearch && choicesInstance.passedElement && choicesInstance.passedElement.element) {
                const element = choicesInstance.passedElement.element;
                const outerEl = (choicesInstance.containerOuter && choicesInstance.containerOuter.element) ? choicesInstance.containerOuter.element : null;
                const _safeAddEvt = (t, evt, fn) => { try { if (t && typeof t.addEventListener === 'function') t.addEventListener(evt, fn); } catch (e) {} };
                const _safeRmEvt  = (t, evt, fn) => { try { if (t && typeof t.removeEventListener === 'function' && fn) t.removeEventListener(evt, fn); } catch (e) {} };


                // Helper: apply query safely without spamming re-renders
                const applySmartQuery = (rawQuery) => {
                    const query = (rawQuery || '').toString().toLowerCase().trim();
                    if (query === element._lastSmartQuery) return;
                    element._lastSmartQuery = query;

                    if (query.length > 0) {
                        const matches = allProcessedUsers.filter(u => (u.label || '').toLowerCase().includes(query));
                        // Keep base options + matches (full override search)
                        choicesInstance.setChoices([...baseOptions, ...matches], 'value', 'label', true);
                    } else {
                        // Reset to the default suggested list (plus any selected extras)
                        choicesInstance.setChoices(initialChoices, 'value', 'label', true);
                    }
                };

                // Cleanup any old listeners (avoid duplicates on repeated calls)
                _safeRmEvt(element,  'search',       element._smartSearchHandler);
                _safeRmEvt(outerEl,  'search',       element._smartSearchHandler);
                _safeRmEvt(element,  'hideDropdown', element._smartHideHandler);
                _safeRmEvt(outerEl,  'hideDropdown', element._smartHideHandler);
                _safeRmEvt(element,  'showDropdown', element._smartShowHandler);
                _safeRmEvt(outerEl,  'showDropdown', element._smartShowHandler);
if (element._smartSearchInputEl && element._smartSearchInputHandler) {
                    try { element._smartSearchInputEl.removeEventListener('input', element._smartSearchInputHandler); } catch (e) {}
                }

                // 1) Choices 'search' event (when supported)
                element._smartSearchHandler = function (event) {
                    const q = (event && event.detail && typeof event.detail.value !== 'undefined') ? event.detail.value : '';
                    applySmartQuery(q);
                };
                _safeAddEvt(element, 'search', element._smartSearchHandler);
                _safeAddEvt(outerEl, 'search', element._smartSearchHandler);

                // 2) Direct input listener (more reliable across versions)
                element._smartSearchInputHandler = function (e) {
                    const q = e && e.target ? e.target.value : '';
                    applySmartQuery(q);
                };

                const attachInputListener = () => {
                    try {
                        const outer = choicesInstance.containerOuter && choicesInstance.containerOuter.element;
                        if (!outer) return;
                        const inputEl = outer.querySelector('input.choices__input--cloned, input.choices__input');
                        if (!inputEl) return;
                        if (element._smartSearchInputEl && element._smartSearchInputHandler) {
                            try { element._smartSearchInputEl.removeEventListener('input', element._smartSearchInputHandler); } catch (e) {}
                        }
                        element._smartSearchInputEl = inputEl;
                        inputEl.addEventListener('input', element._smartSearchInputHandler);
                    } catch (e) {}
                };

                // Attach now + whenever dropdown opens
                element._smartShowHandler = function () { attachInputListener(); };
                _safeAddEvt(element, 'showDropdown', element._smartShowHandler);
                _safeAddEvt(outerEl, 'showDropdown', element._smartShowHandler);
                attachInputListener();

                // Reset list when dropdown closes (keeps system "default strict suggestions" next time)
                element._smartHideHandler = function () {
                    // Clear the search box if we can find it
                    try {
                        if (element._smartSearchInputEl) element._smartSearchInputEl.value = '';
                    } catch (e) {}
                    element._lastSmartQuery = '';
                    applySmartQuery('');
                };
                _safeAddEvt(element, 'hideDropdown', element._smartHideHandler);
                _safeAddEvt(outerEl, 'hideDropdown', element._smartHideHandler);
            }

        } else {
            choicesInstance.setChoices([{ value: '', label: 'No approvers found', disabled: true }]);
        }
    } catch (error) {
        console.error("Error populating attention:", error);
    }
}

// --- Helper: Populate Job Types Dynamically ---
function updateJobTypeDropdown() {
    const select = document.getElementById('job-for');
    if (!select) return;

    // 1. Default Types (Hardcoded)
    // ADD 'Return' TO THIS LIST
    const defaultTypes = new Set(['PR', 'Invoice', 'IPC', 'Payment', 'Transfer', 'Trip', 'Report', 'Return', 'Other']);

    // 2. Learn from History
    // (allSystemEntries is your cached list of all jobs)
    if (allSystemEntries && allSystemEntries.length > 0) {
        allSystemEntries.forEach(entry => {
            if (entry.for && entry.for.trim() !== '') {
                // If this type isn't in our default list, it's a custom one!
                defaultTypes.add(entry.for.trim());
            }
        });
    }

    // 3. Rebuild Options
    // Save current selection to restore it after rebuild
    const currentVal = select.value;

    select.innerHTML = '<option value="" disabled>Select a Type</option>';

    // Sort them alphabetically
    const sortedTypes = Array.from(defaultTypes).sort();

    sortedTypes.forEach(type => {
        if (type === 'Other') return; // Skip 'Other', we add it at the end manually
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        select.appendChild(opt);
    });

    // Always add 'Other' at the end
    const otherOpt = document.createElement('option');
    otherOpt.value = 'Other';
    otherOpt.textContent = '-- Other (Specify) --';
    otherOpt.style.fontWeight = 'bold';
    select.appendChild(otherOpt);

    // Restore selection if possible
    if (currentVal) select.value = currentVal;
}

async function populateSiteDropdown() {
    try {
        if (!siteSelectChoices) return;

        if (allSitesCache) {
            siteSelectChoices.setChoices(allSitesCache, 'value', 'label', true);
            return;
        }

        siteSelectChoices.setChoices([{
            value: '',
            label: 'Loading...',
            disabled: true,
            selected: true
        }], 'value', 'label', true);

        // We use the cached CSV content here (fetched in ensureInvoiceDataFetched)
        // If not loaded yet, we fetch it specifically now
        if (!allSitesCSVData) {
            console.log("Fetching Site.csv for WorkDesk dropdown from Firebase...");
            const url = await getFirebaseCSVUrl('Site.csv');
            if (url) {
                allSitesCSVData = await fetchAndParseSitesCSV(url);
                cacheTimestamps.sitesCSV = Date.now();
            }
        }

        const sites = allSitesCSVData;

        if (sites && sites.length > 0) {
            const siteOptions = sites
                .map(site => (site.site && site.description) ? {
                    value: site.site,
                    label: `${site.site} - ${site.description}`
                } : null)
                .filter(Boolean)
                .sort((a, b) => {
                    const numA = parseInt(a.value, 10);
                    const numB = parseInt(b.value, 10);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    return a.label.localeCompare(b.label);
                });

            const choiceList = [{
                value: '',
                label: 'Select a Site',
                disabled: true
            }].concat(siteOptions);
            allSitesCache = choiceList;
            siteSelectChoices.setChoices(allSitesCache, 'value', 'label', true);
        } else {
            siteSelectChoices.setChoices([{
                value: '',
                label: 'No sites found',
                disabled: true
            }]);
        }
    } catch (error) {
        console.error("Error populating site dropdown from CSV:", error);
        if (siteSelectChoices) siteSelectChoices.setChoices([{
            value: '',
            label: 'Error loading sites',
            disabled: true
        }]);
    }
}

// --- Table Rendering & Search ---

function renderJobEntryTable(entries) {
    jobEntryTableBody.innerHTML = '';

    if (!entries || entries.length === 0) {
        jobEntryTableBody.innerHTML = `<tr><td colspan="8">No pending entries found for your search.</td></tr>`;
        return;
    }

    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', entry.key);

        // Make row clickable for editing (unless it's a pure invoice task)
        if (entry.source !== 'invoice') {
            row.style.cursor = 'pointer';
        }

        // --- Attachment Display Logic ---
        let refDisplay = entry.ref || '';

        if (entry.attachmentName && entry.attachmentName.trim() !== '') {
            const val = entry.attachmentName.trim();

            // Smart Link Construction (Same as above)
            let fullPath;
            if (val.startsWith('http')) {
                fullPath = val;
            } else {
                fullPath = ATTACHMENT_BASE_PATH + encodeURIComponent(val);
            }

            // Smart Icon Detection
            let iconClass = "fa-paperclip";
            const lowerName = val.toLowerCase();

            if (lowerName.endsWith('.zip') || lowerName.endsWith('.rar')) iconClass = "fa-file-zipper";
            else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png')) iconClass = "fa-file-image";
            else if (lowerName.endsWith('.pdf')) iconClass = "fa-file-pdf";
            else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) iconClass = "fa-file-excel";

            // Add the clickable icon
            refDisplay += ` <a href="${fullPath}" target="_blank" style="color: #6f42c1; margin-left: 8px; text-decoration: none;" title="View Attachment" onclick="event.stopPropagation()"><i class="fa-solid ${iconClass}"></i></a>`;
        }
        // -------------------------------------

        row.innerHTML = `
            <td>${entry.for || ''}</td>
            <td>${refDisplay}</td> <td>${entry.po || ''}</td>
            <td>${entry.site || ''}</td>
            <td>${entry.group || ''}</td>
            <td>${entry.attention || ''}</td>
            <td>${entry.date || ''}</td>
            <td>${entry.remarks || 'Pending'}</td>
        `;
        jobEntryTableBody.appendChild(row);
    });
}

// ==========================================================================
// UPDATED FUNCTION: handleJobEntrySearch (Strict Inventory Filter)
// ==========================================================================
async function handleJobEntrySearch(searchTerm) {
    const searchText = (searchTerm || '').toLowerCase();
    sessionStorage.setItem('jobEntrySearch', searchText);

    jobEntryTableBody.innerHTML = '<tr><td colspan="8">Searching...</td></tr>';

    // --- INVENTORY CONTEXT ---
    const isInventoryPage = (typeof isInventoryContext === 'function') ? isInventoryContext() : false;

    try {
        await ensureAllEntriesFetched();

        // 1. FILTER: My Entries + Not Complete (Standard Logic)
        let filteredEntries = allSystemEntries.filter(entry =>
            entry.enteredBy === currentApprover.Name && !isTaskComplete(entry)
        );

        // 2. FILTER: Inventory Page Exclusive (Strict)
        if (isInventoryPage) {
            filteredEntries = filteredEntries.filter(entry => 
                INVENTORY_TYPES.includes(entry.for)
            );
        }

        // 3. FILTER: Search Text
        if (searchText) {
            filteredEntries = filteredEntries.filter(entry => {
                return (
                    (entry.for && entry.for.toLowerCase().includes(searchText)) ||
                    (entry.ref && entry.ref.toLowerCase().includes(searchText)) ||
                    (entry.site && entry.site.toLowerCase().includes(searchText)) ||
                    (entry.group && entry.group.toLowerCase().includes(searchText)) ||
                    (entry.attention && entry.attention.toLowerCase().includes(searchText)) ||
                    (entry.po && entry.po.toLowerCase().includes(searchText)) ||
                    // Allow searching by product name for transfers
                    (entry.productName && entry.productName.toLowerCase().includes(searchText)) 
                );
            });
        }

        renderJobEntryTable(filteredEntries);

    } catch (error) {
        console.error("Error during job entry search:", error);
        jobEntryTableBody.innerHTML = '<tr><td colspan="8">Error searching entries.</td></tr>';
    }
}

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

    // 4. Build Data Object
    const data = {
        for: jobType,
        ref: (formData.get('ref') || '').trim(),
        amount: formData.get('amount') || '',
        po: (formData.get('po') || '').trim(),
        site: formData.get('site'),
        group: formData.get('group'),
        attention: finalAttention,
        date: document.getElementById('job-date').value || formatDate(new Date()),
        
        remarks: status, // <--- Uses the new logic

        details: (formData.get('details') || '').trim(),
        calendarDate: (formData.get('calendarDate') || ''),
        productName: (document.getElementById('job-product-name')?.value || '').trim(),
        attachmentName: (document.getElementById('job-attachment').value || '').trim()
    };

    return data;
}

// =========================================================
// HANDLER: ADD NEW JOB ENTRY (Fully Updated)
// Includes: Smart Vendor Search & Smart Accounting Assign
// =========================================================
async function handleAddJobEntry(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btn-add-job');
    if (btn) btn.disabled = true;

    // 1. Collect Data from Form
    const jobData = getJobDataFromForm();
    if (!jobData) {
        if (btn) btn.disabled = false;
        return;
    }

    try {
        // 2.a Ensure Approver/Vacation data is fresh (so new entries route to the correct replacement)
        await ensureApproverDataCached(true);

        // 2. Ensure we have reference data (PO & Vendors)
        await ensureAllEntriesFetched(); 

        // =========================================================
        // LOGIC A: VENDOR RESOLUTION (System PO vs Manual Dropdown)
        // =========================================================
        let poMatch = null;
        if (jobData.po && allPOData && allPOData[jobData.po]) {
            poMatch = allPOData[jobData.po];
        }

        if (poMatch) {
            // SCENARIO 1: PO Found in System -> Use CSV Data
            jobData.vendorName = poMatch['Supplier Name'] || 'N/A';
            // Optional: If you track Vendor IDs in POVALUE2, add: jobData.vendorId = poMatch['Vendor ID'];
        } else {
            // SCENARIO 2: PO Not Found -> Use Manual Dropdown Data
            if (typeof jobManualVendorChoices !== 'undefined' && jobManualVendorChoices) {
                const manualValue = jobManualVendorChoices.getValue(true); // Expecting "ID|Name"
                
                if (manualValue && manualValue.includes('|')) {
                    const [vId, vName] = manualValue.split('|');
                    jobData.vendorName = vName;
                    jobData.vendorId = vId; // Save ID for future reference
                    jobData.isManualVendor = true; 
                } else if (manualValue) {
                    // Fallback if value isn't split correctly
                    jobData.vendorName = manualValue;
                }
            }

            // Final check: If it's an Invoice and still no vendor, warn user (Optional)
            if (jobData.for === 'Invoice' && (!jobData.vendorName || jobData.vendorName === 'N/A')) {
                console.warn("Saving Invoice without Vendor Name (PO not found and no manual selection).");
            }
        }

        // =========================================================
        // LOGIC B: STATUS & SMART ASSIGNMENT
        // =========================================================
        const isInvoiceJob = (jobData.for === 'Invoice');

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
        
        let currentUserName = 'Admin';
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
            currentUserName = currentUser.username;
        }
        jobData.createdBy = currentUserName;


        
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


async function handleDeleteJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) {
        alert("No entry selected for deletion.");
        return;
    }

    const userPositionLower = (currentApprover?.Position || '').toLowerCase();

    // --- SECURITY UPDATE: Strict check for "Irwin" ---
    if (userPositionLower !== 'accounting' || currentApprover.Name !== 'Irwin') {
        alert("Access Denied: Only the original Administrator (Irwin) can permanently delete entries.");
        return;
    }
    // ------------------------------------------------

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
    if(e) e.preventDefault(); // Safety check if 'e' exists
    
    if (!currentlyEditingKey) {
        alert("No entry selected for update.");
        return;
    }

    // 1. Disable button
    const btn = document.getElementById('update-job-btn');
    if(btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
    }

    // 2. Get Data
    // We assume this function exists in your system as per your previous code
    const jobData = typeof getJobDataFromForm === 'function' ? getJobDataFromForm() : null;

    // Fallback if getJobDataFromForm isn't available (Safety)
    if (!jobData) {
        // Try to grab manually if the helper function is missing
        console.warn("getJobDataFromForm not found, check your code.");
        if(btn) { btn.disabled = false; btn.textContent = 'Update'; }
        return; 
    }

    try { await ensureApproverDataCached(true); } catch (e) { /* ignore */ }

    // --- YOUR CUSTOM INVOICE LOGIC (Preserved) ---
    if (jobData.for === 'Invoice') {
        jobData.remarks = 'New Entry'; 
        // Set attention to current handler (Irwin or vacation replacement)
        const handler = getInvoiceHandlerName();
        jobData.attention = (typeof resolveVacationAssignee === 'function') ? resolveVacationAssignee(handler) : handler;
    }

    // 3. Validation
    if (!jobData.for || !jobData.site || !jobData.group) {
        alert('Please fill in Job, Site, and Group.');
        if(btn) { btn.disabled = false; btn.textContent = 'Update'; }
        return;
    }
    
    if (jobData.for !== 'Invoice' && !jobData.attention) {
        alert('Please select an Attention user.');
        if(btn) { btn.disabled = false; btn.textContent = 'Update'; }
        return;
    }

    try {
        await ensureAllEntriesFetched();
        const originalEntry = allSystemEntries.find(entry => entry.key === currentlyEditingKey);

        if (originalEntry) {
            // --- CRITICAL FIX START ---
            // We verify 'enteredBy' exists. If not, we fallback to 'System' or You.
            // This prevents the "values argument contains undefined" error.
            const currentUser = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover.Name : 'System';
            jobData.enteredBy = originalEntry.enteredBy || currentUser;
            
            jobData.timestamp = originalEntry.timestamp || firebase.database.ServerValue.TIMESTAMP;
            // --- CRITICAL FIX END ---
            
            // If the user didn't change the Date field manually, keep original
            if(!jobData.date) jobData.date = originalEntry.date;

            // Handle "Date Responded" Reset Logic
            if (jobData.attention !== originalEntry.attention) {
                jobData.dateResponded = null; 
            } else {
                if (typeof currentApprover !== 'undefined' && currentApprover.Name === jobData.attention && !originalEntry.dateResponded) {
                     // Format date safely
                     const today = new Date();
                     jobData.dateResponded = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, '0') + "-" + String(today.getDate()).padStart(2, '0');
                } else {
                    jobData.dateResponded = originalEntry.dateResponded || null;
                }
            }
        } else {
            // Fallback if original not found
             const currentUser = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover.Name : 'System';
             jobData.enteredBy = currentUser;
             jobData.timestamp = firebase.database.ServerValue.TIMESTAMP;
        }

        // 4. Update Database
        await db.ref(`job_entries/${currentlyEditingKey}`).update(jobData);

        // 5. Log History
        const updaterName = (typeof currentApprover !== 'undefined') ? currentApprover.Name : "System";
        const historyEntry = {
            action: "Updated",
            by: updaterName,
            timestamp: Date.now(),
            status: jobData.remarks || "Updated",
            note: `Updated Attention to: ${jobData.attention}`
        };
        await db.ref(`job_entries/${currentlyEditingKey}/history`).push(historyEntry);

        alert('Job Updated Successfully!');

        // 6. Refresh UI
        await ensureAllEntriesFetched(true);
        
        const currentSearch = sessionStorage.getItem('jobEntrySearch') || '';
        if(typeof handleJobEntrySearch === 'function') handleJobEntrySearch(currentSearch);
        if(typeof populateActiveTasks === 'function') populateActiveTasks();
        if (typeof closeStandardJobModal === 'function') closeStandardJobModal();

    } catch (error) {
        console.error("Error updating job:", error);
        alert('Failed to update. Check console for details.');
    } finally {
        if(btn) { btn.disabled = false; btn.textContent = 'Update'; }
    }
}

// ==========================================================================
// HELPER: Populate Form (Kept safe)
// ==========================================================================
function populateFormForEditing(key) {
    const entryData = allSystemEntries.find(entry => entry.key === key);
    if (!entryData) return;

    // --- 1. TRANSFER GROUP LOGIC ---
    if (['Transfer', 'Restock', 'Return', 'Usage'].includes(entryData.for)) {
        if (window.loadTransferForEdit) {
            window.loadTransferForEdit(entryData);
        } else {
            console.error("Transfer loader not found.");
        }
        return; 
    }

    // --- 2. STANDARD GROUP LOGIC ---
    openStandardJobModal('Edit', entryData);
}

// ==========================================================================
// HELPER: Nav Controls (Kept safe)
// ==========================================================================
function updateJobEntryNavControls() {
    if (navigationContextList.length > 0 && navigationContextIndex > -1) {
        jobEntryNavControls.classList.remove('hidden');
        navJobCounter.textContent = (navigationContextIndex + 1) + ' / ' + navigationContextList.length;
        navPrevJobButton.disabled = (navigationContextIndex === 0);
        navNextJobButton.disabled = (navigationContextIndex === navigationContextList.length - 1);
    } else {
        jobEntryNavControls.classList.add('hidden');
    }
}

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

            const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
            const isInvoice = (jobType === 'Invoice');
            const isIPCforQS = (jobType === 'IPC' && isQS);

            // Reset Attention Field based on type
            if (attentionSelectChoices) {
                attentionSelectChoices.enable();
                if (isInvoice) {
                    attentionSelectChoices.clearStore();
                    attentionSelectChoices.setChoices([{
                        value: '',
                        label: 'Auto-assigned to Accounting',
                        disabled: true,
                        selected: true
                    }], 'value', 'label', false);
                    attentionSelectChoices.disable();
                } else if (isIPCforQS) {
                    attentionSelectChoices.clearStore();
                    attentionSelectChoices.setChoices([{
                        value: 'All',
                        label: 'All',
                        selected: true
                    }], 'value', 'label', false);
                    attentionSelectChoices.disable();
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

function openModifyTaskModal(taskData) {
    if (!taskData) return;

    // 1. Set Keys & Identifiers
    modifyTaskKey.value = taskData.key;
    modifyTaskSource.value = taskData.source;
    modifyTaskOriginalPO.value = taskData.originalPO || '';
    modifyTaskOriginalKey.value = taskData.originalKey || '';
    
    document.getElementById('modify-task-originalAttention').value = taskData.attention || '';
    modifyTaskNote.value = taskData.note || '';

    // Identify User Role
    const userPos = (currentApprover.Position || '').toLowerCase();
    const isFinance = userPos.includes('finance');

    // 2. SMART AUTOMATION LOGIC
    // -------------------------------------------------

    // SCENARIO A: FINANCE USER (Status is "Report Approval" -> Send back to Creator)
    if (isFinance && (taskData.remarks === 'Report Approval')) {
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

    // Safety: do not assign tasks to vacationing users. If selected attention is on vacation,
    // automatically resolve to the replacement (if configured and active).
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
        // --- REPORT WORKFLOW LOGIC ---
        if (source === 'invoice' && originalPO && originalKey) {
            
            // 1. Finance Auto-Route Logic
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

            // 2. Execute Report Database Update
            // CRITICAL: Checks if function exists before calling
            if (typeof updateReportWorkflow === 'function') {
                await updateReportWorkflow(originalPO, originalKey, updates.status, currentApprover, updates.attention);
            } else {
                throw new Error("Helper function 'updateReportWorkflow' is missing from app.js!");
            }
        }
        // ----------------------------------

        if (source === 'job_entry') {
            await ensureAllEntriesFetched();
            const originalEntry = allSystemEntries.find(entry => entry.key === key);

            if (originalEntry && currentApprover.Name === (originalEntry.attention || '') && updates.attention === originalEntry.attention) {
                 updates.dateResponded = formatDate(new Date());
            } else if (updates.attention !== (originalEntry ? originalEntry.attention : '')) {
                 updates.dateResponded = null;
            }

            await db.ref(`job_entries/${key}`).update(updates);
            allSystemEntries = [];

        } else if (source === 'invoice' && originalPO && originalKey) {
            await invoiceDb.ref(`invoice_entries/${originalPO}/${originalKey}`).update(updates);

            if (!allInvoiceData) await ensureInvoiceDataFetched();
            const originalInvoice = (allInvoiceData && allInvoiceData[originalPO]) ? allInvoiceData[originalPO][originalKey] : {};
            const updatedInvoiceData = {
                ...originalInvoice,
                ...updates
            };

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
        // --- THIS ALERT SHOWS THE REAL REASON ---
        alert("Update Failed: " + error.message); 
    } finally {
        modifyTaskSaveBtn.disabled = false;
        modifyTaskSaveBtn.textContent = 'Confirm Action';
    }
}

// ==========================================================================
// 12. INVOICE MANAGEMENT: HELPERS (INBOX SYNC)
// ==========================================================================

function isInvoiceTaskActive(invoiceData) {
    if (!invoiceData) return false;

    // We REMOVED 'Approved' and 'Rejected' from this list.
    // Now, they are considered ACTIVE so they can be sent back to the sender.
    const inactiveStatuses = [
        'With Accounts',
        'SRV Done',
        'Paid',
        'On Hold',
        'CLOSED',
        'Cancelled'
    ];

    if (inactiveStatuses.includes(invoiceData.status)) {
        return false;
    }
    // Must have an attention person assigned
    return !!invoiceData.attention;
}




// -------------------------------------------------------------
// PO DETAILS RESOLVER (CSV allPOData + Firebase purchase_orders)
// Supports purchase_orders keyed by PO OR stored under push-ids with child "Po"/"PO".
// Canonical output keys: "Supplier Name", "Project ID", "Amount"
// -------------------------------------------------------------
const __invoicePOCache = new Map();

function __normalizePOKey(poNumber) {
    const po = String(poNumber || '').trim();
    if (!po) return '';
    return po.toUpperCase();
}

function __normalizePODetails(raw) {
    const d = raw || {};
    const supplier =
        d['Supplier Name'] || d['Supplier Name:'] || d['Supplier'] || d['Supplier:'] ||
        d['supplier name'] || d['supplier'] || d['SUPPLIER NAME'] || d['SUPPLIER'] || '';
    const projectId =
        d['Project ID'] || d['Project ID:'] || d['Project'] || d['Project:'] ||
        d['project id'] || d['PROJECT ID'] || '';
    const amount =
        d['Amount'] || d['amount'] || d.Amount || d.AMOUNT || '';

    // Return a merged object but ensure canonical keys exist
    return {
        ...d,
        'Supplier Name': supplier || d['Supplier Name'] || d['Supplier'] || '',
        'Project ID': projectId || d['Project ID'] || '',
        'Amount': amount || d['Amount'] || ''
    };
}

async function getInvoicePurchaseOrderDetails(poNumber) {
    const poKey = __normalizePOKey(poNumber);
    if (!poKey) return {};

    if (__invoicePOCache.has(poKey)) return __invoicePOCache.get(poKey);

    // 1) Memory (POVALUE2.csv -> allPOData)
    let details = (typeof allPOData !== 'undefined' && allPOData && allPOData[poKey]) ? allPOData[poKey] : null;

    // 2) Firebase RTDB fallback (invoiceentry-b15a8 / purchase_orders)
    if ((!details || Object.keys(details).length === 0) && typeof invoiceDb !== 'undefined' && invoiceDb) {
        try {
            // A) Direct key: purchase_orders/<PO>
            const directSnap = await invoiceDb.ref(`purchase_orders/${poKey}`).once('value');
            if (directSnap.exists()) details = directSnap.val();
        } catch (_) { /* ignore */ }

        // B) Query by child "Po" or "PO" if the records are stored under push-ids
        if (!details || Object.keys(details).length === 0) {
            const tryQuery = async (child, value) => {
                try {
                    const snap = await invoiceDb.ref('purchase_orders').orderByChild(child).equalTo(value).once('value');
                    if (snap.exists()) {
                        const obj = snap.val() || {};
                        const firstKey = Object.keys(obj)[0];
                        return firstKey ? obj[firstKey] : null;
                    }
                } catch (_) { /* ignore */ }
                return null;
            };

            details = await tryQuery('Po', poKey) ||
                      await tryQuery('PO', poKey) ||
                      await tryQuery('po', poKey) ||
                      null;

            // Some DBs store Po as number. Try numeric query too.
            if ((!details || Object.keys(details).length === 0) && /^\d+$/.test(poKey)) {
                const n = Number(poKey);
                details = await tryQuery('Po', n) || await tryQuery('PO', n) || await tryQuery('po', n) || details;
            }
        }
    }

    const normalized = __normalizePODetails(details || {});
    __invoicePOCache.set(poKey, normalized);
    return normalized;
}
async function ensurePORecordInInvoiceDb(poNumber) {
    try {
        if (!poNumber || typeof invoiceDb === 'undefined' || !invoiceDb) return;
        const po = String(poNumber).trim().toUpperCase();
        if (!po) return;

        // Avoid hammering the DB: only sync each PO once per session
        if (typeof ensuredPOInInvoiceDb !== 'undefined' && ensuredPOInInvoiceDb.has(po)) return;
        if (typeof ensuredPOInInvoiceDb !== 'undefined') ensuredPOInInvoiceDb.add(po);

        const mem = (allPOData && allPOData[po]) ? allPOData[po] : null;

        // Quick exit if we have nothing to sync
        if (!mem) {
            // Still check if an older record exists with colon-keys and normalize it once
            const snap = await invoiceDb.ref(`purchase_orders/${po}`).once('value');
            const existing = snap.val();
            if (existing && existing['Project ID:'] && !existing['Project ID']) {
                await invoiceDb.ref(`purchase_orders/${po}`).update({ 'Project ID': existing['Project ID:'] });
            }
            if (existing && existing['Supplier Name:'] && !existing['Supplier Name']) {
                await invoiceDb.ref(`purchase_orders/${po}`).update({ 'Supplier Name': existing['Supplier Name:'] });
            }
            if (existing && existing['Supplier'] && !existing['Supplier Name']) {
                await invoiceDb.ref(`purchase_orders/${po}`).update({ 'Supplier Name': existing['Supplier'] });
            }
            return;
        }

        const supplier = mem['Supplier Name'] || mem['Supplier Name:'] || mem['Supplier'] || mem['Supplier:'] || '';
        const projectId = mem['Project ID'] || mem['Project ID:'] || '';
        const amount = mem.Amount || mem['Amount'] || '';

        const ref = invoiceDb.ref(`purchase_orders/${po}`);
        const snap = await ref.once('value');
        const existing = snap.val();

        // Build minimal upsert payload (only what you asked for + safe extras)
        const upsert = {};
        if (!existing) upsert['PO'] = po;
        if (supplier) { upsert['Supplier Name'] = supplier; upsert['Supplier'] = supplier; }
        if (projectId) upsert['Project ID'] = projectId;
        if (amount && (!existing || !existing.Amount)) upsert['Amount'] = amount;
        if (!existing) upsert['IsManual'] = false;

        if (Object.keys(upsert).length > 0) {
            await ref.update(upsert);
        }
    } catch (err) {
        console.warn("PO auto-sync to purchase_orders failed:", err);
    }
}

async function updateInvoiceTaskLookup(poNumber, invoiceKey, invoiceData, oldAttention) {
    const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
    const newAttention = invoiceData.attention;
    const isTaskNowActive = isInvoiceTaskActive(invoiceData);

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

        const taskData = {
            // include these so Workdesk can route back correctly
            attention: newAttention,
            enteredBy: sender,

            ref: invoiceData.invNumber || '',
            po: poKey,

            // Save BOTH amounts
            amount: invoiceData.invValue || '', // Total Invoice Value
            amountPaid: invoiceData.amountPaid || '', // Actual Payment Amount

            date: invoiceData.invoiceDate || getTodayDateString(),
            releaseDate: invoiceData.releaseDate || '',
            status: invoiceData.status || 'Pending',
            vendorName: vendorName,
            site: site,
            invName: invoiceData.invName || '',
            note: invoiceData.note || ''
        };

        const safeNewAttentionKey = sanitizeFirebaseKey(newAttention);
        await invoiceDb.ref(`invoice_tasks_by_user/${safeNewAttentionKey}/${invoiceKey}`).set(taskData);
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

// ==========================================================================
// 13. INVOICE MANAGEMENT: SEARCH & DISPLAY
// ==========================================================================

function resetInvoiceForm() {
    // 1. --- AUTO-GENERATE NEXT ID ---
    // Instead of keeping the current value, we calculate the next sequence number fresh.
    let nextId = "INV-01"; // Default start
    
    if (typeof currentPO !== 'undefined' && currentPO && 
        typeof allInvoiceData !== 'undefined' && allInvoiceData && 
        allInvoiceData[currentPO]) {
        
        let maxNum = 0;
        const invoices = Object.values(allInvoiceData[currentPO]);
        
        invoices.forEach(inv => {
            if (inv.invEntryID) {
                // Extract number from "INV-XX"
                const num = parseInt(inv.invEntryID.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        // Generate next number (e.g., 40) and pad with zero if needed (01, 02.. 10)
        nextId = `INV-${String(maxNum + 1).padStart(2, '0')}`;
    }
    // -------------------------------

    // 2. Reset form
    imNewInvoiceForm.reset();
    
    // 3. Set the fresh ID and Dates
    imInvEntryIdInput.value = nextId; // <--- The correct new ID (e.g. INV-40)
    imReleaseDateInput.value = getTodayDateString();
    imInvoiceDateInput.value = getTodayDateString();

    // 4. Smart Filter Reset (Default to "For SRV")
    if (imAttentionSelectChoices) {
        imAttentionSelectChoices.clearInput();
        imAttentionSelectChoices.removeActiveItems();
        
        const defaultStatus = document.getElementById('im-status').value;
        let currentSite = null;
        if (typeof currentPO !== 'undefined' && currentPO && typeof allPOData !== 'undefined' && allPOData && allPOData[currentPO]) {
            currentSite = allPOData[currentPO]['Project ID'];
        }
        populateAttentionDropdown(imAttentionSelectChoices, defaultStatus, currentSite, true);
    }

    // 5. Navigation Logic (Show "New")
    const navControls = document.getElementById('im-nav-controls');
    const navCounter = document.getElementById('im-nav-counter');
    const btnPrev = document.getElementById('im-nav-prev');
    const btnNext = document.getElementById('im-nav-next');

    if (navControls) {
        if (typeof imNavigationList !== 'undefined' && imNavigationList.length > 0) {
            navControls.classList.remove('hidden');
            imNavigationIndex = imNavigationList.length;
            navCounter.textContent = `New`; // Indicator
            
            btnPrev.disabled = false;
            btnPrev.style.opacity = '1';

            btnNext.disabled = true;
            btnNext.style.opacity = '0.5';
        } else {
            navControls.classList.add('hidden');
            imNavigationIndex = -1;
        }
    }

    currentlyEditingInvoiceKey = null;
    imFormTitle.textContent = 'Add New Invoice for this PO';
    imAddInvoiceButton.classList.remove('hidden');
    imUpdateInvoiceButton.classList.add('hidden');

    // [NEW] HIDE DELETE BUTTON ON NEW ENTRY
    const delBtn = document.getElementById('im-delete-invoice-btn'); 
    if(delBtn) delBtn.classList.add('hidden');

    // 6. Apply Visual Highlights
    const inputs = imNewInvoiceForm.querySelectorAll('.input-required-highlight');
    inputs.forEach(el => el.classList.remove('input-required-highlight'));

    const mandatoryIds = ['im-inv-no', 'im-inv-value', 'im-invoice-date', 'im-status'];
    mandatoryIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('input-required-highlight');
    });

    const attnSelect = document.getElementById('im-attention');
    if (attnSelect) {
        const choicesInner = attnSelect.closest('.choices')?.querySelector('.choices__inner');
        if (choicesInner) {
            choicesInner.classList.add('input-required-highlight');
        }
    }
}

function openIMInvoiceEntryModal() {
    if (imInvoiceEntryModal) {
        imInvoiceEntryModal.classList.remove('hidden');
    }
}

function closeIMInvoiceEntryModal() {
    if (imInvoiceEntryModal) {
        imInvoiceEntryModal.classList.add('hidden');
    }
}

// =========================================================
// SEARCH PO HANDLER (FIXED: Uses Smart Fetcher)
// =========================================================
async function handlePOSearch(poNumberFromInput) {
    const poNumber = (poNumberFromInput || imPOSearchInput.value || imPOSearchInputBottom.value).trim().toUpperCase();

    if (!poNumber) {
        alert('Please enter a PO Number.');
        return;
    }

    sessionStorage.setItem('imPOSearch', poNumber);
    if (imPOSearchInput) imPOSearchInput.value = poNumber;
    if (imPOSearchInputBottom) imPOSearchInputBottom.value = poNumber;

    try {
        // --- THE FIX IS HERE ---
        // Old: await ensureAllEntriesFetched();  <-- This only checked CSV
        // New: await ensureInvoiceDataFetched(); <-- This checks CSV + Firebase DB
        if (!allPOData) await ensureInvoiceDataFetched(); 
        // -----------------------

        let poData = allPOData[poNumber];

        // Fallback: If not found in memory, force a DB check for this specific PO
        // (Just in case the list is huge and didn't load completely)
        if (!poData) {
            const snap = await invoiceDb.ref(`purchase_orders/${poNumber}`).once('value');
            if (snap.exists()) {
                poData = snap.val();
                allPOData[poNumber] = poData; // Save to memory
            }
        }

        // If STILL not found, show Manual Entry Modal
        if (!poData) {
            document.getElementById('manual-po-number').value = poNumber;
            document.getElementById('manual-supplier-id').value = '';
            document.getElementById('manual-vendor-name').value = '';
            document.getElementById('manual-po-amount').value = '';

            const modalSiteSelect = document.getElementById('manual-site-select');
            if (modalSiteSelect.options.length <= 1 && allSitesCSVData) {
                allSitesCSVData.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.site;
                    opt.textContent = `${s.site} - ${s.description}`;
                    modalSiteSelect.appendChild(opt);
                });
            }

            document.getElementById('im-manual-po-modal').classList.remove('hidden');
            return; 
        }

        // Found it! Proceed.
        proceedWithPOLoading(poNumber, poData);

    } catch (error) {
        console.error("Error searching for PO:", error);
        alert('An error occurred while searching for the PO.');
    }
}

// REPLACE THE EXISTING FUNCTION WITH THIS "QUERY" VERSION
async function proceedWithPOLoading(poNumber, poData) {
    // 1. Fetch Invoices for this PO (Standard Logic)
    const invoicesSnapshot = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
    const invoicesData = invoicesSnapshot.val();

    if (!allInvoiceData) allInvoiceData = {};
    allInvoiceData[poNumber] = invoicesData || {};

    currentPO = poNumber;
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const canViewAmounts = (isAdmin || isAccounting || isVacationDelegate);

    const poValueText = canViewAmounts ? (poData.Amount ? `QAR ${formatCurrency(poData.Amount)}` : 'N/A') : '---';
    const siteText = poData['Project ID'] || 'N/A';
    const vendorText = poData['Supplier Name'] || 'N/A';

    // Update UI text
    document.querySelectorAll('.im-po-no').forEach(el => el.textContent = poNumber);
    document.querySelectorAll('.im-po-site').forEach(el => el.textContent = siteText);
    document.querySelectorAll('.im-po-value').forEach(el => el.textContent = poValueText);
    document.querySelectorAll('.im-po-vendor').forEach(el => el.textContent = vendorText);

    // ============================================================
    // [FIX] SEARCH BY COLUMN "PO" (Query)
    // ============================================================
    const poRecordEl = document.querySelector('.im-po-record');
    if (poRecordEl) {
        poRecordEl.textContent = "Searching...";
        poRecordEl.style.color = "#ffeb3b"; // Yellow

        try {
            // 1. Prepare the search term (Remove 'PO-' to get just the digits, e.g. "62032")
            const searchVal = poNumber.replace(/[^0-9]/g, ''); 
            
            // 2. Perform the Query: "Look in 'records' where column 'PO' equals searchVal"
            // We check both String ("62032") and Number (62032) to be safe.
            const ref = progressDb.ref('records');
            
            console.log(`🔎 QUERYING: records.orderByChild('PO').equalTo("${searchVal}")`);

            let snapshot = await ref.orderByChild('PO').equalTo(searchVal).once('value');

            // If not found as a string, try as a number
            if (!snapshot.exists()) {
                console.log(`⚠️ String match failed. Trying Number: ${parseInt(searchVal)}`);
                snapshot = await ref.orderByChild('PO').equalTo(parseInt(searchVal)).once('value');
            }

            if (snapshot.exists()) {
                console.log("✅ MATCH FOUND!");
                poRecordEl.textContent = "Original in File";
                poRecordEl.style.color = "#90EE90"; // Green
            } else {
                console.warn(`❌ NO MATCH for PO column value: ${searchVal}`);
                poRecordEl.textContent = "None";
                poRecordEl.style.color = "#ffcccb"; // Red
            }

        } catch (error) {
            console.error("Query Error:", error);
            // If the error says "Index not defined", it means we need to add an index in Firebase Rules
            if (error.message.includes("index")) {
                 console.warn("⚠️ PERMISSION/INDEX ERROR: You might need to add '.indexOn': ['PO'] to your Firebase Rules for 'records'.");
            }
            poRecordEl.textContent = "Error";
            poRecordEl.style.color = "orange";
        }
    }
    // ============================================================

    const modalDetails = document.getElementById('im-modal-po-details');
    if(modalDetails) modalDetails.classList.remove('hidden');

    fetchAndDisplayInvoices(poNumber);
    if (imInvoiceFormTrigger) imInvoiceFormTrigger.classList.remove('hidden');
}

function fetchAndDisplayInvoices(poNumber) {
    const invoicesData = allInvoiceData[poNumber];

    let maxInvIdNum = 0;
    imInvoicesTableBody.innerHTML = '';
    currentPOInvoices = invoicesData || {};

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const canViewAmounts = (isAdmin || isAccounting || isVacationDelegate);

    let invoiceCount = 0;

    let totalInvValueSum = 0;
    let totalPaidWithRetention = 0;
    let totalPaidWithoutRetention = 0;

    if (invoicesData) {
        const invoices = Object.entries(invoicesData).map(([key, value]) => ({
            key,
            ...value
        }));
        invoiceCount = invoices.length;

        invoices.forEach(inv => {
            if (inv.invEntryID) {
                const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                if (!isNaN(idNum) && idNum > maxInvIdNum) {
                    maxInvIdNum = idNum;
                }
            }
        });

        // Sort Invoices
        invoices.sort((a, b) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));

        // --- NEW: CAPTURE NAVIGATION LIST ---
        imNavigationList = invoices.map(inv => inv.key);
        imNavigationIndex = -1; 
        // ------------------------------------

        invoices.forEach(inv => {

            // NEW FIXED CODE
            const currentInvValue = parseFloat(String(inv.invValue).replace(/,/g, '')) || 0;
            const currentAmtPaid = parseFloat(String(inv.amountPaid).replace(/,/g, '')) || 0;
            const noteText = (inv.note || '').toLowerCase();

            totalInvValueSum += currentInvValue;
            totalPaidWithRetention += currentAmtPaid;
       
            // EXCLUDE 'retention' AND 'delivery confirmed' from the running total
            if (!noteText.includes('retention')) {
                totalPaidWithoutRetention += currentAmtPaid;
            }

            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.setAttribute('data-key', inv.key);

            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';

            const invValueDisplay = canViewAmounts ? formatCurrency(inv.invValue) : '---';
            const amountPaidDisplay = canViewAmounts ? formatCurrency(inv.amountPaid) : '---';

            // --- Standard Invoice/SRV/Report Links (Using Base Paths) ---
            // IMPORTANT: Do not trim end spaces (they can be part of the actual SharePoint filename).
            const invPDFName = getSharePointPdfBaseName(inv.invName);
            const invPDFLink = invPDFName ?
                `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn">Invoice</a>` :
                '';

            const srvPDFName = getSharePointPdfBaseName(inv.srvName);
            const srvPDFLink = srvPDFName ?
                `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="action-btn srv-pdf-btn">SRV</a>` :
                '';

            const reportPDFName = getSharePointPdfBaseName(inv.reportName);
            const reportPDFLink = reportPDFName ?
                `<a href="${REPORT_BASE_PATH}${encodeURIComponent(reportPDFName)}.pdf" target="_blank" class="action-btn report-pdf-btn" style="background-color: #6f42c1; color: white;" title="View Report">Report</a>` :
                '';

            // [MODIFIED] Only show history button if there is ACTUAL history
            let historyBtn = '';
            const historyCount = inv.history ? Object.keys(inv.history).length : 0;
            
            if (historyCount > 1) {
                historyBtn = `<button type="button" class="history-btn action-btn" title="View Status History" onclick="event.stopPropagation(); showInvoiceHistory('${poNumber}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>`;
            }

            let deleteBtnHTML = '';
            if (currentApprover.Name === 'Irwin') {
                deleteBtnHTML = `<button class="delete-btn" data-key="${inv.key}">Delete</button>`;
            }

            // ADDED ${reportPDFLink} TO THE ROW BELOW
            row.innerHTML = `
                <td>${inv.invEntryID || ''}</td>
                <td>${inv.invNumber || ''}</td>
                <td>${invoiceDateDisplay}</td>
                <td>${invValueDisplay}</td>
                <td>${amountPaidDisplay}</td>
                <td>${inv.status || ''}</td>
                <td>${releaseDateDisplay}</td>
                <td><div class="action-btn-group">${invPDFLink} ${srvPDFLink} ${reportPDFLink} ${historyBtn} ${deleteBtnHTML}</div></td>
            `;
            imInvoicesTableBody.appendChild(row);
        });
        imExistingInvoicesContainer.classList.remove('hidden');
    } else {
        // Reset navigation list if no invoices
        imNavigationList = [];
        imNavigationIndex = -1;
        
        imInvoicesTableBody.innerHTML = '<tr><td colspan="8">No invoices have been entered for this PO yet.</td></tr>';
        imExistingInvoicesContainer.classList.remove('hidden');
    }

    if (existingInvoicesCountDisplay) {
        existingInvoicesCountDisplay.textContent = `Existing Invoices (${invoiceCount})`;
    }

    const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;
    imInvEntryIdInput.value = nextInvId;
    resetInvoiceForm();
    imNewInvoiceForm.classList.remove('hidden');
    if (imInvoiceFormTrigger) imInvoiceFormTrigger.classList.remove('hidden');

    const footer = document.getElementById('im-invoices-table-footer');
    if (footer) {
        const isAdminOrAccounting = isAdmin || isAccounting || isVacationDelegate;

        let finalTotalPaid = totalPaidWithoutRetention;

        if (Math.abs(totalPaidWithRetention - totalInvValueSum) < 0.01) {
            finalTotalPaid = totalPaidWithRetention;
        }

        document.getElementById('im-invoices-total-value').textContent = isAdminOrAccounting ? formatCurrency(totalInvValueSum) : '---';
        document.getElementById('im-invoices-total-paid').textContent = isAdminOrAccounting ? formatCurrency(finalTotalPaid) : '---';

        
        footer.style.display = invoiceCount > 0 ? '' : 'none';
    }

    if (pendingJobEntryDataForInvoice) {
        if (pendingJobEntryDataForInvoice.amount) {
            imInvValueInput.value = pendingJobEntryDataForInvoice.amount;
            imAmountPaidInput.value = pendingJobEntryDataForInvoice.amount;
        }
        if (pendingJobEntryDataForInvoice.ref) {
            document.getElementById('im-inv-no').value = pendingJobEntryDataForInvoice.ref;
        }
        if (pendingJobEntryDataForInvoice.date) {
            imInvoiceDateInput.value = convertDisplayDateToInput(pendingJobEntryDataForInvoice.date);
        }

        // --- ADD THESE LINES TO FIX THE STATUS ---
        imStatusSelect.value = 'Under Review'; 
        imStatusSelect.dispatchEvent(new Event('change')); 
        // ----------------------------------------

        pendingJobEntryDataForInvoice = null;
    }
}

// ==========================================================================
// 14. INVOICE MANAGEMENT: SIDEBAR & ACTIVE JOBS (UPDATED: GREEN APPROVALS)
// ==========================================================================

async function populateActiveJobsSidebar() {
    if (!imEntrySidebarList) return;

    // Refresh active tasks first
    await populateActiveTasks();

    // Filter tasks
    var tasksToDisplay = userActiveTasks;
	// Show ONLY Job Entries created under Job Entry -> "Invoice" (no invoice approval tasks, no other job types)
	var invoiceJobs = tasksToDisplay.filter(function(task) {
		return (task.source === 'job_entry' && task.for === 'Invoice');
	});

    // Update Header Count
    if (activeJobsSidebarCountDisplay) {
        activeJobsSidebarCountDisplay.textContent = 'Active Jobs (' + invoiceJobs.length + ')';
    }

    imEntrySidebarList.innerHTML = '';

    if (invoiceJobs.length === 0) {
        imEntrySidebarList.innerHTML = '<li class="im-sidebar-no-jobs" style="padding:10px; text-align:center; color:#888; font-size:0.8rem;">No active jobs.</li>';
        return;
    }

    invoiceJobs.forEach(function(job) {
        var li = document.createElement('li');
        li.className = 'im-sidebar-item';

        var status = job.remarks || job.status || 'Pending';
        
        // --- NEW COLOR LOGIC START ---
        var borderColor = '#fd7e14'; // Default Orange (Pending)
        var statusTextColor = '#666'; // Default Text Color

        if (status === 'New Entry') {
            borderColor = '#dc3545'; // RED (Urgent / New)
            statusTextColor = '#dc3545';
        } 
        else if (status === 'SRV Done') {
            borderColor = '#6c757d'; // GREY (Passive)
            statusTextColor = '#6c757d';
        }
        else if (status.includes('Approved') || status === 'CEO Approval') {
            borderColor = '#28a745'; // GREEN (Approved)
            statusTextColor = '#28a745';
        }

        // Apply the visual border color
        li.style.borderLeft = '4px solid ' + borderColor;
        // --- NEW COLOR LOGIC END ---

        // Store data for click handling
        li.dataset.po = job.po || '';
        li.dataset.key = job.key;
        li.dataset.ref = job.ref || '';
        li.dataset.amount = job.amount || '';
        li.dataset.date = job.date || '';
        li.dataset.source = job.source || '';
        li.dataset.originalKey = job.originalKey || '';
        li.dataset.originalPO = job.originalPO || '';

        // Truncate Vendor Name if too long
        var vendorDisplay = (job.vendorName || 'No Vendor');
        if (vendorDisplay.length > 20) vendorDisplay = vendorDisplay.substring(0, 18) + '...';

        // --- COMPACT HTML (With Status Color) ---
        var html = `
            <div class="im-compact-row">
                <span class="im-compact-po"><i class="fa-solid fa-file-invoice" style="margin-right:4px; opacity:0.7;"></i> ${job.po || 'N/A'}</span>
                <span class="im-compact-amount">${formatCurrency(job.amount)}</span>
            </div>
            <div class="im-compact-row">
                <span class="im-compact-vendor">${vendorDisplay}</span>
                <span class="im-compact-status" style="color: ${statusTextColor}; font-weight: bold;">${status}</span>
            </div>
        `;

        li.innerHTML = html;
        imEntrySidebarList.appendChild(li);
    });
}

// --- NEW: SEARCH LISTENER (Place this right after the function above) ---
const sidebarSearchInput = document.getElementById('im-sidebar-search');
if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const items = document.querySelectorAll('.im-sidebar-item');
        
        items.forEach(item => {
            const po = (item.dataset.po || '').toLowerCase();
            // Search by PO (you can add Vendor check too if you want: || item.innerText.toLowerCase().includes(term))
            if (po.includes(term)) {
                item.style.display = ''; // Show
            } else {
                item.style.display = 'none'; // Hide
            }
        });
    });
}

async function handleActiveJobClick(e) {
    const item = e.target.closest('.im-sidebar-item');
    if (!item) return;

    const {
        po,
        ref,
        amount,
        date,
        source,
        key,
        originalKey,
        originalPO
    } = item.dataset;

    if (!po) {
        alert("This job entry is missing a PO number and cannot be processed.");
        return;
    }

    jobEntryToUpdateAfterInvoice = source === 'job_entry' ? key : null;
    pendingJobEntryDataForInvoice = {
        po,
        ref,
        amount,
        date
    };

    // SCENARIO 1: It is an EXISTING INVOICE (This part was already working)
    if (source === 'invoice' && originalPO && originalKey) {
        jobEntryToUpdateAfterInvoice = null;
        pendingJobEntryDataForInvoice = null;

        try {
            await handlePOSearch(originalPO);
            setTimeout(() => {
                populateInvoiceFormForEditing(originalKey);
                imBackToActiveTaskButton.classList.remove('hidden');
            }, 200);
        } catch (error) {
            console.error("Error loading existing invoice task:", error);
            alert("Error loading this task. Please try searching for the PO manually.");
        }
        return;
    }

    // SCENARIO 2: It is a JOB ENTRY (e.g., "Pending")
    // [FIX APPLIED HERE]
    try {
        await handlePOSearch(po);
        imBackToActiveTaskButton.classList.remove('hidden');

        // --- NEW CODE: Force the modal to open ---
        setTimeout(() => {
            openIMInvoiceEntryModal(); 
        }, 150); // Small delay to allow data to populate first
        // ----------------------------------------

    } catch (error) {
        console.error("Error searching for PO from active job:", error);
        alert("Error searching for PO. Please try again manually.");
    }
}

// ==========================================================================
// 15. INVOICE MANAGEMENT: CRUD OPERATIONS
// ==========================================================================

function populateInvoiceFormForEditing(invoiceKey) {
    const invData = currentPOInvoices[invoiceKey];
    if (!invData) return;

    resetInvoiceForm();
    currentlyEditingInvoiceKey = invoiceKey;

    // --- NAVIGATION UI UPDATE (Preserved) ---
    if (typeof imNavigationList !== 'undefined' && imNavigationList.length > 0) {
        imNavigationIndex = imNavigationList.indexOf(invoiceKey);
        const navControls = document.getElementById('im-nav-controls');
        const navCounter = document.getElementById('im-nav-counter');
        const btnPrev = document.getElementById('im-nav-prev');
        const btnNext = document.getElementById('im-nav-next');

        if (navControls && imNavigationIndex > -1) {
            navControls.classList.remove('hidden');
            navCounter.textContent = `${imNavigationIndex + 1} / ${imNavigationList.length}`;
            btnPrev.disabled = (imNavigationIndex === 0);
            btnPrev.style.opacity = (imNavigationIndex === 0) ? '0.5' : '1';
            btnNext.disabled = false;
            btnNext.style.opacity = '1';
            btnNext.title = (imNavigationIndex === imNavigationList.length - 1) ? "Go to New Entry" : "Next Invoice";
        }
    }
    // ----------------------------

    // Populate Fields
    imInvEntryIdInput.value = invData.invEntryID || '';
    document.getElementById('im-inv-no').value = invData.invNumber || '';
    imInvoiceDateInput.value = normalizeDateForInput(invData.invoiceDate);
    
    // FORMAT ON LOAD
    imInvValueInput.value = formatFinanceNumber(invData.invValue);
    imAmountPaidInput.value = formatFinanceNumber(invData.amountPaid || '0');

    document.getElementById('im-inv-name').value = invData.invName || '';
    document.getElementById('im-srv-name').value = invData.srvName || '';
    
    // --- ADDED: Load Report Name ---
    document.getElementById('im-report-name').value = invData.reportName || ''; 
    // -------------------------------

    document.getElementById('im-details').value = invData.details || '';
    
    imReleaseDateInput.value = normalizeDateForInput(invData.releaseDate);
    imStatusSelect.value = invData.status || 'Under Review';
    document.getElementById('im-note').value = invData.note || '';

    // Dropdown Logic
    if (imAttentionSelectChoices) {
        let currentSite = null;
        if (currentPO && allPOData && allPOData[currentPO]) {
            currentSite = allPOData[currentPO]['Project ID'];
        }
        populateAttentionDropdown(imAttentionSelectChoices, invData.status, currentSite, true).then(() => {
            if (invData.attention) {
                imAttentionSelectChoices.setChoiceByValue(invData.attention);
            }
        });
    }

    // --- PRINT REPORT BUTTON LOGIC ---
    const printBtnContainer = document.getElementById('im-invoice-print-report-container');
    const printBtn = document.getElementById('btn-invoice-entry-print-report');
    
    const reportStatuses = ['Report', 'Report Approval', 'Report Approved'];
    const showPrintBtn = reportStatuses.includes(invData.status);

    if (printBtnContainer && printBtn) {
        if (showPrintBtn) {
            printBtnContainer.classList.remove('hidden');
            // Remove old listener (clone trick)
            const newBtn = printBtn.cloneNode(true);
            printBtn.parentNode.replaceChild(newBtn, printBtn);

            // Add Click Listener
            newBtn.addEventListener('click', async () => {
                if (!currentPO) { alert("PO Data missing."); return; }
                const poData = allPOData[currentPO] || {};
                
                await generateFinanceReport({
                    poNo: currentPO,
                    poValue: poData.Amount || 0,
                    site: poData['Project ID'] || '',
                    vendor: poData['Supplier Name'] || ''
                });
                
                // IMPORTANT: Ensure the final print button knows WHICH invoice key to lock
                const finalPrintBtn = document.getElementById('im-finance-print-report-btn');
                if (finalPrintBtn) {
                    const newFinalBtn = finalPrintBtn.cloneNode(true);
                    finalPrintBtn.parentNode.replaceChild(newFinalBtn, finalPrintBtn);
                    newFinalBtn.addEventListener('click', () => {
                        window.printFinalFinanceReport(currentPO, invoiceKey);
                    });
                }

                const reportModal = document.getElementById('im-finance-report-modal');
                if (reportModal) reportModal.classList.remove('hidden');
            });
        } else {
            printBtnContainer.classList.add('hidden');
        }
    }

    imFormTitle.textContent = `Editing Invoice: ${invData.invEntryID}`;
    imAddInvoiceButton.classList.add('hidden');
    imUpdateInvoiceButton.classList.remove('hidden');

    // [NEW] SHOW DELETE BUTTON ON EDIT
    const delBtn = document.getElementById('im-delete-invoice-btn'); 
    if(delBtn) delBtn.classList.remove('hidden');

    openIMInvoiceEntryModal();
    setTimeout(() => {
        const invNoInput = document.getElementById('im-inv-no');
        if (invNoInput) invNoInput.focus();
    }, 0);
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


    invoiceData.dateAdded = getTodayDateString();
    invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;
    
    // [SMART REFRESH] 1. Add Timestamp to record
    invoiceData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;

    // Track who created it (used for "return to sender" workflow)
    invoiceData.enteredBy = (typeof currentUserName !== 'undefined' && currentUserName) ? currentUserName : (currentApprover?.Name || '');

    // Persist vendor/site on the invoice record as a fallback (prevents N/A if PO lookup fails)
    const _poDetailsForInv = (allPOData && allPOData[currentPO]) ? allPOData[currentPO] : {};
    invoiceData.vendor_name = invoiceData.vendor_name || _poDetailsForInv['Supplier Name'] || _poDetailsForInv['Supplier Name:'] || '';
    invoiceData.site_name = invoiceData.site_name || _poDetailsForInv['Project ID'] || _poDetailsForInv['Project ID:'] || '';

    // Also keep a simple alias for older screens
    invoiceData.vendorName = invoiceData.vendorName || invoiceData.vendor_name;
    invoiceData.site = invoiceData.site || invoiceData.site_name;

    // Ensure this PO exists in invoiceDb/purchase_orders so tasks always have Vendor + Site
    if (typeof ensurePORecordInInvoiceDb === 'function') {
        await ensurePORecordInInvoiceDb(currentPO);
    }

    if (jobEntryToUpdateAfterInvoice) {
        const originJobEntry = allSystemEntries.find(entry => entry.key === jobEntryToUpdateAfterInvoice);
        if (originJobEntry) {
            invoiceData.originTimestamp = originJobEntry.timestamp;
            invoiceData.originEnteredBy = originJobEntry.enteredBy;
            invoiceData.originType = "Job Entry";
        }
    }

    // Clean up nulls
    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key];
    });

    try {
        const newRef = await invoiceDb.ref(`invoice_entries/${currentPO}`).push(invoiceData);
        const newKey = newRef.key;

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
                const updates = {
                    remarks: invoiceData.status,
                    dateResponded: formatDate(new Date())
                };
                await db.ref(`job_entries/${jobEntryToUpdateAfterInvoice}`).update(updates);
                jobEntryToUpdateAfterInvoice = null;
                await populateActiveJobsSidebar();

            } catch (updateError) {
                console.error("Error updating the original job entry:", updateError);
            }
        }

        allSystemEntries = [];
        fetchAndDisplayInvoices(currentPO);

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

    if (newStatus === 'With Accounts' && oldStatus !== 'With Accounts') {
        invoiceData.releaseDate = getTodayDateString();
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

                // IMPORTANT: never end the generated name with a space (even if vendor was shorter than the limit)
                invoiceData.srvName = normalizeNameText(`${formattedDate}-${currentPO}-${invEntryID}-${site}-${vendor}`);
                document.getElementById('im-srv-name').value = invoiceData.srvName;
            }
        } catch (error) {
            console.error("Could not generate SRV Name:", error);
            alert("Warning: Could not automatically generate the SRV Name.");
        }
    }

    // [SMART REFRESH] 1. Add Timestamp to record so we know when it changed
    invoiceData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;

// Ensure this PO exists in invoiceDb/purchase_orders so tasks always have Vendor + Site
if (typeof ensurePORecordInInvoiceDb === 'function') {
    await ensurePORecordInInvoiceDb(currentPO);
}


    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key];
    });

    try {
        // 1. Update the Invoice in the Invoice Database
        await invoiceDb.ref(`invoice_entries/${currentPO}/${currentlyEditingInvoiceKey}`).update(invoiceData);

        // [SMART REFRESH] 2. Log this update so "Smart Refresh" can find it
        if (typeof logRecentUpdate === 'function') {
            logRecentUpdate(currentPO);
        }

        // ============================================================
        // [START] JOB ENTRY SYNC FIX - AUTO COMPLETE JOB
        // ============================================================
        if (newStatus === "With Accounts" || newStatus === "Paid") {
            console.log("🔄 Syncing: Checking for linked Job Entries...");
            
            // 1. Identify the Job List (use cache or fetch fresh if empty)
            let jobsToSearch = (typeof allSystemEntries !== 'undefined') ? allSystemEntries : [];
            
            // Safety: If list is empty, fetch 'job_entries' directly from DB to ensure we find the match
            if (!jobsToSearch || jobsToSearch.length === 0) {
                const jobSnap = await firebase.database().ref('job_entries').once('value');
                const jobObj = jobSnap.val() || {};
                jobsToSearch = Object.entries(jobObj).map(([k, v]) => ({ ...v, key: k, source: 'job_entry' }));
            }

            // 2. Find the matching Job Entry (Matches PO + Invoice Number)
            const matchedJob = jobsToSearch.find(job => 
                job.source === 'job_entry' &&
                job.po === currentPO && 
                (job.ref === invoiceData.invNumber || job.ref === originalInvoiceData.invNumber)
            );

            // 3. Update the Job Entry if found
            if (matchedJob) {
                console.log(`✅ Found Job Entry ${matchedJob.key}. Updating status...`);
                const db = firebase.database(); // Ensure we have DB reference
                
                await db.ref(`job_entries/${matchedJob.key}`).update({
                    status: "Completed",        // <--- CRITICAL: Marks it as done
                    remarks: newStatus,         // Syncs "With Accounts"
                    dateResponded: new Date().toISOString().split('T')[0], // Marks today as response date
                    amount: invoiceData.invValue // Syncs amount if changed
                });
                
                // Log history so you know it happened
                await db.ref(`job_entries/${matchedJob.key}/history`).push({
                    action: "Auto-Sync",
                    by: "System",
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    note: `Status synced from Invoice Entry: ${newStatus}`
                });
            }
        }
        // ============================================================
        // [END] JOB ENTRY SYNC FIX
        // ============================================================

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

        allSystemEntries = [];
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
// 16. INVOICE MANAGEMENT: REPORTING ENGINE
// ==========================================================================

async function populateSiteFilterDropdown() {
    const siteFilterSelect = document.getElementById('im-reporting-site-filter');
    if (siteFilterSelect.options.length > 1) return;
    try {
        await ensureInvoiceDataFetched();
        const allSites = allSitesCSVData;
        if (!allSites) return;

        const sites = new Set();
        allSites.forEach(item => {
            if (item.site) {
                sites.add(item.site);
            }
        });

        const sortedSites = Array.from(sites).sort((a, b) => {
            const numA = parseInt(a, 10);
            const numB = parseInt(b, 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b);
        });

        while (siteFilterSelect.options.length > 1) {
            siteFilterSelect.remove(1);
        }
        sortedSites.forEach(site => {
            const option = document.createElement('option');
            option.value = site;
            option.textContent = site;
            siteFilterSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating site filter:", error);
    }
}

// ==========================================================================
// 16. INVOICE MANAGEMENT: REPORTING ENGINE (SORTED BY BALANCE)
// ==========================================================================

// --- STATE TRACKING VARIABLE ---
let imLastExpandedRowId = null;

async function populateInvoiceReporting(searchTerm = '', options = {}) {
    const openRow = document.querySelector('#im-reporting-content .detail-row:not(.hidden)');
    if (openRow) {
        imLastExpandedRowId = openRow.id;
    } else {
        imLastExpandedRowId = null;
    }

    sessionStorage.setItem('imReportingSearch', searchTerm);

    const silent = options && options.silent;

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    currentReportData = [];

    const isMobile = window.innerWidth <= 768;
    const desktopContainer = document.getElementById('im-reporting-content');
    const mobileContainer = document.getElementById('im-reporting-mobile-view');

    if (!silent) {
        if (isMobile) {
            if (mobileContainer) mobileContainer.innerHTML = `
            <div class="im-mobile-empty-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <h3>Searching...</h3>
                <p>Please wait a moment.</p>
            </div>`;
            if (desktopContainer) desktopContainer.innerHTML = '';
        } else {
            if (desktopContainer) desktopContainer.innerHTML = '<p>Searching... Please wait.</p>';
            if (mobileContainer) mobileContainer.innerHTML = '';
        }
    } else {
        // Silent refresh: avoid blanking the UI while we rebuild results
        if (reportingCountDisplay) reportingCountDisplay.textContent = '(Updating...)';
    }

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const monthFilter = document.getElementById('im-reporting-date-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;

    try {
        await ensureInvoiceDataFetched();

        const allPOs = allPOData;
        const allInvoicesByPO = allInvoiceData;
        const allEcommit = allEcommitDataProcessed;

        if (!allPOs || !allInvoicesByPO || !allEcommit) throw new Error("Data not loaded.");
        const searchText = searchTerm.toLowerCase();
        const processedPOData = [];

        const allUniquePOs = new Set([...Object.keys(allPOs), ...Object.keys(allInvoicesByPO), ...Object.keys(allEcommit)]);

        const filteredPONumbers = Array.from(allUniquePOs).filter(poNumber => {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            let hasNoteMatch = false;
            if (allInvoicesByPO[poNumber]) {
                hasNoteMatch = Object.values(allInvoicesByPO[poNumber]).some(inv => inv.note && inv.note.toLowerCase().includes(searchText));
            }

            const searchMatch = !searchText || poNumber.toLowerCase().includes(searchText) || vendor.toLowerCase().includes(searchText) || hasNoteMatch;
            const siteMatch = !siteFilter || site === siteFilter;
            return searchMatch && siteMatch;
        });

        for (const poNumber of filteredPONumbers) {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            const firebaseInvoices = allInvoicesByPO[poNumber] ? Object.entries(allInvoicesByPO[poNumber]).map(([key, value]) => ({
                key,
                ...value,
                source: 'firebase'
            })) : [];
            const firebasePackingSlips = new Set(firebaseInvoices.map(inv => String(inv.invNumber || '').trim().toLowerCase()).filter(Boolean));
            const ecommitInvoices = allEcommit[poNumber] || [];
            const filteredEcommitInvoices = ecommitInvoices.filter(inv => {
                const csvInvNum = String(inv.invNumber || '').trim().toLowerCase();
                return !csvInvNum || !firebasePackingSlips.has(csvInvNum);
            });

            let invoices = [...firebaseInvoices, ...filteredEcommitInvoices];

            // --- CALCULATE BALANCE FOR SORTING ---
            let totalInvSum = 0;
            invoices.forEach(inv => totalInvSum += parseFloat(inv.invValue) || 0);
            const poVal = parseFloat(poDetails.Amount) || 0;
            const balance = poVal - totalInvSum;

            // Filter Check: Negative Balance
            if (statusFilter === 'Negative Balance') {
                if (balance >= -0.01) continue;
            }

            // Invoice Sorting (Inner)
            invoices.sort((a, b) => {
                const dateA = new Date(a.invoiceDate || '2099-01-01');
                const dateB = new Date(b.invoiceDate || '2099-01-01');
                return (dateA - dateB) || (a.invNumber || '').localeCompare(b.invNumber || '');
            });

            invoices.forEach((inv, index) => {
                inv.invEntryID = `INV-${String(index + 1).padStart(2, '0')}`;
            });

            let calculatedTotalPaid = 0;
            let latestPaidDateObj = null;

            for (const inv of invoices) {
                if (inv.status === 'Paid') {
                    calculatedTotalPaid += parseFloat(inv.amountPaid) || 0;
                    if (inv.releaseDate) {
                        const d = new Date(normalizeDateForInput(inv.releaseDate));
                        if (!isNaN(d) && (!latestPaidDateObj || d > latestPaidDateObj)) latestPaidDateObj = d;
                    }
                }
            }

            const filteredInvoices = invoices.filter(inv => {
                if (statusFilter === 'Negative Balance') return true;
                const normRelease = normalizeDateForInput(inv.releaseDate);
                const dateMatch = !monthFilter || (normRelease && normRelease.startsWith(monthFilter));
                const statusMatch = !statusFilter || inv.status === statusFilter;
                return dateMatch && statusMatch;
            });

            if (filteredInvoices.length > 0) {
                processedPOData.push({
                    poNumber,
                    poDetails,
                    site,
                    vendor,
                    filteredInvoices,
                    balance, // Store balance here
                    paymentData: {
                        totalPaidAmount: calculatedTotalPaid || 'N/A',
                        datePaid: latestPaidDateObj ? formatDate(latestPaidDateObj) : 'N/A'
                    }
                });
            }
        }

        // --- SORT BY BALANCE (ASCENDING: Most Negative First) ---
        processedPOData.sort((a, b) => a.balance - b.balance);

        currentReportData = processedPOData;
        if (reportingCountDisplay) reportingCountDisplay.textContent = `(Found: ${currentReportData.length})`;

        if (isMobile) {
            buildMobileReportView(currentReportData);
        } else {
            buildDesktopReportView(currentReportData);
        }

    } catch (error) {
        console.error("Error generating report:", error);
        if (desktopContainer) desktopContainer.innerHTML = '<p>Error loading report.</p>';
    }
}

function buildMobileReportView(reportData) {
    const container = document.getElementById('im-reporting-mobile-view');
    if (!container) return;

    // --- PERMISSION CHECK ---
    const userRole = (currentApprover?.Role || '').toLowerCase();
    const userPos = (currentApprover?.Position || '').trim().toLowerCase();
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const canPrintSticker = (userRole === 'admin' && userPos === 'accounting');
    const canViewAmounts = (userRole === 'admin' || userPos === 'accounting' || isVacationDelegate);

    if (reportData.length === 0) {
        container.innerHTML = `<div class="im-mobile-empty-state"><i class="fa-solid fa-file-circle-question"></i><h3>No Results Found</h3><p>Try a different search.</p></div>`;
        return;
    }

    let mobileHTML = '';

    reportData.forEach((poData, poIndex) => {
        const { poNumber, site, vendor, poDetails, filteredInvoices, balance } = poData;
        const toggleId = `mobile-invoice-list-${poIndex}`;
        const balanceNum = balance !== undefined ? balance : ((parseFloat(poDetails.Amount) || 0) - filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.invValue) || 0), 0));

        let statusClass = 'status-progress';
        let balanceStyle = "";

        if (balanceNum < -0.01) {
            statusClass = 'status-pending'; balanceStyle = "color: #ff4d4d;";
        } else if (balanceNum > 0.01) {
            statusClass = 'status-open';
        } else {
            let allClose = filteredInvoices.length > 0;
            const closeStatuses = ['With Accounts', 'Paid', 'Epicore Value'];
            for (const inv of filteredInvoices) { if (!closeStatuses.includes(inv.status)) allClose = false; }
            if (allClose) statusClass = 'status-close';
        }

        const poValueDisplay = canViewAmounts ? `QAR ${formatCurrency(parseFloat(poDetails.Amount))}` : '---';
        const balanceDisplay = canViewAmounts ? `QAR ${formatCurrency(balanceNum)}` : '---';

        mobileHTML += `
            <div class="im-mobile-report-container">
                <div class="im-po-balance-card ${statusClass}" data-toggle-target="#${toggleId}" style="cursor: pointer;">
                    <div class="po-card-header">
                        <div><span class="po-card-vendor">${vendor}</span><h3 class="po-card-ponum">PO: ${poNumber}</h3></div>
                        <i class="fa-solid fa-chevron-down po-card-chevron"></i>
                    </div>
                    <div class="po-card-body">
                        <div class="po-card-grid">
                            <div><span class="po-card-label">Total PO Value</span><span class="po-card-value">${poValueDisplay}</span></div>
                            <div><span class="po-card-label">Balance</span><span class="po-card-value po-card-balance" style="${balanceStyle}">${balanceDisplay}</span></div>
                        </div>
                        <span class="po-card-site">Site: ${site}</span>
                    </div>
                </div>
                <div id="${toggleId}" class="hidden-invoice-list">
                    <div class="im-invoice-list-header"><h2>Transactions (${filteredInvoices.length})</h2></div>
                    <ul class="im-invoice-list">`;

        if (filteredInvoices.length === 0) {
            mobileHTML += `<li class="im-invoice-item-empty">No invoices recorded.</li>`;
        } else {
            filteredInvoices.forEach(inv => {
                const invValueDisplay = canViewAmounts ? `QAR ${formatCurrency(inv.invValue)}` : '---';
                const invDateDisplay = inv.invoiceDate ? formatYYYYMMDD(inv.invoiceDate) : '';
                const status = inv.status || 'Pending';

                let iconClass = 'pending';
                let iconChar = '<i class="fa-solid fa-clock"></i>';
                if (status === 'Paid' || status === 'With Accounts') { iconClass = 'paid'; iconChar = '<i class="fa-solid fa-check"></i>'; }

                let actionsHTML = '';
                
                // 1. Invoice PDF
                const cleanInv = getSharePointPdfBaseName(inv.invName);
                if (cleanInv) {
                    actionsHTML += `<a href="${PDF_BASE_PATH}${encodeURIComponent(cleanInv)}.pdf" target="_blank" class="im-tx-action-btn invoice-pdf-btn">INV</a>`;
                }
                
                // 2. SRV PDF
                const cleanSrv = getSharePointPdfBaseName(inv.srvName);
                if (cleanSrv) {
                    actionsHTML += `<a href="${SRV_BASE_PATH}${encodeURIComponent(cleanSrv)}.pdf" target="_blank" class="im-tx-action-btn srv-pdf-btn">SRV</a>`;
                }

                // 3. REPORT PDF (Mobile)
                const cleanRpt = getSharePointPdfBaseName(inv.reportName);
                if (cleanRpt) {
                    actionsHTML += `<a href="${REPORT_BASE_PATH}${encodeURIComponent(cleanRpt)}.pdf" target="_blank" class="im-tx-action-btn" style="background-color: #6f42c1; color: white;">RPT</a>`;
                }

                // 4. Sticker (Only if ESN exists)
                if (canPrintSticker && inv.esn) {
                    actionsHTML += `<button class="im-tx-action-btn" onclick="event.stopPropagation(); handlePrintSticker('${inv.key}', 'Invoice', '${poNumber}')" style="background-color: #28a745; border: none; cursor: pointer; color: white; margin-left: 4px; padding: 3px 8px; border-radius: 6px;" title="Print Sticker"><i class="fa-solid fa-qrcode"></i></button>`;
                }

                mobileHTML += `
                    <li class="im-invoice-item">
                        <div class="im-tx-icon ${iconClass}">${iconChar}</div>
                        <div class="im-tx-details">
                            <span class="im-tx-title">${inv.invNumber || 'No Inv#'}</span>
                            <span class="im-tx-subtitle">${inv.status}</span>
                            <span class="im-tx-date">Date: ${invDateDisplay}</span>
                        </div>
                        <div class="im-tx-amount">
                            <span class="im-tx-value ${iconClass}">${invValueDisplay}</span>
                            <div class="im-tx-actions">${actionsHTML}</div>
                        </div>
                    </li>`;
            });
        }
        mobileHTML += `</ul></div></div>`;
    });
    container.innerHTML = mobileHTML;
}

function buildDesktopReportView(reportData) {
    const container = document.getElementById('im-reporting-content');
    if (!container) return;

    // 1. Calculate Permissions
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;

    // Replacement (Vacation Delegate for Super Admin) should be able to view amounts + manage invoices
    // without gaining delete permissions.
    const canViewAmounts = (isAdmin || isAccounting || isVacationDelegate);
    const isAllowedUser = (isAdmin || isAccounting || isVacationDelegate);

    // --- Check if user can print stickers ---
    const canPrintSticker = (isAdmin && isAccounting); 

    if (reportData.length === 0) {
        container.innerHTML = '<p>No results found for your search criteria.</p>';
        return;
    }

    let tableHTML = `<table><thead><tr><th></th><th>PO</th><th>Site</th><th>Vendor</th><th>PO Value</th><th>SRV Balance</th></tr></thead><tbody>`;

    reportData.forEach(poData => {
        let totalInvValue = 0;
        let totalPaidWithRetention = 0;
        let totalPaidWithoutRetention = 0;
        let allWithAccounts = poData.filteredInvoices.length > 0;

        const detailRowId = `detail-${poData.poNumber}`;
        const isExpanded = (detailRowId === imLastExpandedRowId);
        const detailClass = isExpanded ? 'detail-row' : 'detail-row hidden';
        const buttonText = isExpanded ? '-' : '+';

        let nestedTableRows = '';

            poData.filteredInvoices.forEach(inv => {
                if (inv.status !== 'With Accounts') allWithAccounts = false;

                const invValue = parseFloat(inv.invValue) || 0;
                const amountPaid = parseFloat(inv.amountPaid) || 0;
                const noteText = (inv.note || '').toLowerCase();

                totalInvValue += invValue;
                totalPaidWithRetention += amountPaid;
                
                // EXCLUDE 'retention' AND 'delivery confirmed'
                if (!noteText.includes('retention')) {
                    totalPaidWithoutRetention += amountPaid;
                }

                const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
                const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
                const invValueDisplay = canViewAmounts ? formatCurrency(invValue) : '---';
                const amountPaidDisplay = canViewAmounts ? formatCurrency(amountPaid) : '---';

                // ============================================================
                // 1. GENERATE ACTION BUTTONS
                // ============================================================
                
                let actionButtonsHTML = '';

                if (inv.source !== 'ecommit' && isAllowedUser) {
                    
                    // --- A. Sanitize Names (Preserve end-spaces; they can be significant in SharePoint filenames) ---
                    const finalInvName = getSharePointPdfBaseName(inv.invName);
                    const finalSrvName = getSharePointPdfBaseName(inv.srvName);
                    const finalReportName = getSharePointPdfBaseName(inv.reportName);

                    // --- B. Create PDF Links ---
                    const invPDFLink = (finalInvName && finalInvName.toLowerCase() !== 'nil') ? 
                        `<a href="${PDF_BASE_PATH}${encodeURIComponent(finalInvName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn" onclick="event.stopPropagation();" title="View Invoice">Inv</a>` : '';
                    
                    const srvPDFLink = (finalSrvName && finalSrvName.toLowerCase() !== 'nil') ? 
                        `<a href="${SRV_BASE_PATH}${encodeURIComponent(finalSrvName)}.pdf" target="_blank" class="action-btn srv-pdf-btn" onclick="event.stopPropagation();" title="View SRV">SRV</a>` : '';
                    
                    const reportViewLink = (finalReportName && finalReportName.toLowerCase() !== 'nil') ? 
                        `<a href="${REPORT_BASE_PATH}${encodeURIComponent(finalReportName)}.pdf" target="_blank" class="action-btn" style="background-color: #6f42c1; color: white;" onclick="event.stopPropagation();" title="View Report PDF">Rpt</a>` : '';

                    // --- C. Create Tool Buttons (FIXED LINE IS HERE) ---
                    // We simply use the PO Number from the parent loop
                    let currentPO = poData.poNumber;

                    let historyBtn = (inv.history || inv.createdAt || inv.originTimestamp) ? 
                        `<button type="button" class="history-btn action-btn" onclick="event.stopPropagation(); showInvoiceHistory('${currentPO}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>` : '';
                    
                    let editBtn = `<button type="button" class="edit-inv-no-btn action-btn" data-po="${currentPO}" data-key="${inv.key}" data-current="${inv.invNumber || ''}"><i class="fa-solid fa-pen-to-square"></i></button>`;
                    
                    // --- D. Create Print Report Button ---
                    let printReportBtn = '';
                    if (inv.status === 'Report Approved') {
                        if (inv.reportPrinted) {
                            printReportBtn = `<button type="button" class="action-btn" style="background-color: #6c757d; color: white; cursor: not-allowed;" title="Locked"><i class="fa-solid fa-lock"></i> Locked</button>`;
                        } else {
                            printReportBtn = `<button type="button" class="action-btn" style="background-color: #00748C; color: white;" onclick="event.stopPropagation(); printFinalFinanceReport('${currentPO}', '${inv.key}')" title="Print Report"><i class="fa-solid fa-print"></i> Report</button>`;
                        }
                    }

                    // --- E. STICKER BUTTON ---
                    let stickerBtn = '';
                    if (typeof canPrintSticker !== 'undefined' && canPrintSticker && inv.esn) {
                         stickerBtn = `<button type="button" class="action-btn" style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px;" title="Print Sticker" onclick="event.stopPropagation(); handlePrintSticker('${inv.key}', 'Invoice', '${currentPO}')"><i class="fa-solid fa-qrcode"></i></button>`;
                    }

                    // --- F. FINAL COMBINATION ---
                    actionButtonsHTML = `<div class="action-btn-group">${editBtn} ${invPDFLink} ${srvPDFLink} ${reportViewLink} ${printReportBtn} ${historyBtn} ${stickerBtn}</div>`;
                
                } else if (inv.source === 'ecommit' && isAllowedUser) {
                    actionButtonsHTML = `<span style="font-size:0.8rem; color:#6f42c1; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-file-import"></i> Click to Import</span>`;
                }

                nestedTableRows += `<tr class="nested-invoice-row"
                                        data-po-number="${poData.poNumber}" data-invoice-key="${inv.key}" data-source="${inv.source}"
                                        data-inv-number="${inv.invNumber || ''}" data-inv-date="${inv.invoiceDate || ''}"
                                        data-release-date="${inv.releaseDate || ''}" data-inv-value="${inv.invValue || ''}"
                                        title="${inv.source === 'ecommit' ? 'Click to Import' : 'Click to Edit'}">
                    <td>${inv.invEntryID || ''}</td>
                    <td style="font-weight: bold; color: #00748C;">${inv.invNumber || ''}</td>
                    <td>${invoiceDateDisplay}</td> <td>${invValueDisplay}</td> <td>${amountPaidDisplay}</td>
                    <td>${releaseDateDisplay}</td> <td>${inv.status || ''}</td> <td>${inv.note || ''}</td>
                    <td>${actionButtonsHTML}</td>
                </tr>`;
            });

        let finalTotalPaid = totalPaidWithoutRetention;
        if (Math.abs(totalPaidWithRetention - totalInvValue) < 0.01) finalTotalPaid = totalPaidWithRetention;

        // ============================================================
        // [NEW] CALCULATE DIFFERENCE (Inv Value - Paid)
        // ============================================================
        const diffValue = totalInvValue - finalTotalPaid;
        const diffColor = (diffValue > 0.05) ? '#dc3545' : '#28a745'; // Red if Owed, Green if Paid
        const diffDisplay = canViewAmounts ? `<strong>QAR ${formatCurrency(diffValue)}</strong>` : '---';
        // ============================================================

        const totalInvValueDisplay = canViewAmounts ? `<strong>QAR ${formatCurrency(totalInvValue)}</strong>` : '---';
        const totalAmountPaidDisplay = canViewAmounts ? `<strong>QAR ${formatCurrency(finalTotalPaid)}</strong>` : '---';
        const poValueDisplay = canViewAmounts ? (poData.poDetails.Amount ? `QAR ${formatCurrency(poData.poDetails.Amount)}` : 'N/A') : '---';

        const balanceNum = poData.balance !== undefined ? poData.balance : ((parseFloat(poData.poDetails.Amount) || 0) - totalInvValue);
        const balanceDisplay = canViewAmounts ? `QAR ${formatCurrency(balanceNum)}` : '---';

        let highlightClass = '';
        if (canViewAmounts) {
            if (balanceNum < -0.01) {
                highlightClass = 'highlight-negative-balance';
            } else if (Math.abs(balanceNum) < 0.01) {
                if (allWithAccounts && Math.abs(finalTotalPaid - parseFloat(poData.poDetails.Amount)) < 0.01) highlightClass = 'highlight-fully-paid';
                else if (allWithAccounts) highlightClass = 'highlight-partial';
            } else if (balanceNum > 0.01) highlightClass = 'highlight-open-balance';
        }

        tableHTML += `<tr class="master-row ${highlightClass}" data-target="#${detailRowId}">
            <td><button class="expand-btn">${buttonText}</button></td>
            <td>${poData.poNumber}</td><td>${poData.site}</td><td>${poData.vendor}</td><td>${poValueDisplay}</td>
            <td style="${balanceNum < -0.01 ? 'color: red; font-weight: bold;' : ''}">${balanceDisplay}</td>
        </tr>`;

        // [UPDATED FOOTER] Added the Difference Column below
        tableHTML += `<tr id="${detailRowId}" class="${detailClass}"><td colspan="6"><div class="detail-content"><h4>Invoice Entries for PO ${poData.poNumber}</h4><table class="nested-invoice-table"><thead><tr><th>Inv. Entry</th><th>Inv. No.</th><th>Inv. Date</th><th>Inv. Value</th><th>Amt. Paid</th><th>Release Date</th><th>Status</th><th>Note</th><th>Action</th></tr></thead><tbody>${nestedTableRows}</tbody><tfoot><tr><td colspan="3" style="text-align: right;"><strong>TOTAL</strong></td><td>${totalInvValueDisplay}</td><td>${totalAmountPaidDisplay}</td><td style="color: ${diffColor};">${diffDisplay}</td><td colspan="3"></td></tr></tfoot></table></div></td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

// ==========================================================================
// 17. INVOICE MANAGEMENT: REPORTING ACTIONS
// ==========================================================================

function handleGeneratePrintReport() {
    if (currentReportData.length === 0) {
        alert("No data to print. Please run a search first.");
        return;
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    if (!isAdmin && !isAccounting) {
        alert("You do not have permission to print this report.");
        return;
    }

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;
    let title = "Invoice Records";
    if (siteFilter && !statusFilter) title = `Invoice Report for Site: ${siteFilter}`;
    if (statusFilter && !siteFilter) title = `Invoice Report - Status: ${statusFilter}`;
    if (siteFilter && statusFilter) title = `Invoice Report for Site: ${siteFilter} (Status: ${statusFilter})`;

    // --- NEW: INJECT LOGO ---
    const logoContainer = document.querySelector('.print-logo');
    if (logoContainer) {
        logoContainer.innerHTML = '<img src="https://firebasestorage.googleapis.com/v0/b/invoiceentry-b15a8.firebasestorage.app/o/Files%2Fiba_logo.jpg?alt=media&token=d7376281-75e0-4f8b-b9c5-9911e4522f68" style="height: 80px; width: auto;">';
    }
    // ------------------------
   
    imPrintReportTitle.textContent = title;
    imPrintReportDate.textContent = `Generated on: ${new Date().toLocaleString('en-GB')}`;

    let totalPOs = currentReportData.length;
    let totalReportValue = 0;
    let totalReportInvValue = 0;

    currentReportData.forEach(po => {
        totalReportValue += parseFloat(po.poDetails.Amount) || 0;
        po.filteredInvoices.forEach(inv => {
            totalReportInvValue += parseFloat(inv.invValue) || 0;
        });
    });

    const totalBalance = totalReportValue - totalReportInvValue;

    imPrintReportSummaryPOs.textContent = totalPOs;
    imPrintReportSummaryValue.textContent = `QAR ${formatCurrency(totalReportValue)}`;

    if (imPrintReportSummaryPaid) {
        const parentDiv = imPrintReportSummaryPaid.parentElement;
        if (parentDiv) {
            const labelSpan = parentDiv.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = 'Total Balance';
            }
            parentDiv.style.display = '';
        }
        imPrintReportSummaryPaid.textContent = `QAR ${formatCurrency(totalBalance)}`;
    }

    imPrintReportBody.innerHTML = '';

    currentReportData.forEach(po => {
        const poContainer = document.createElement('div');
        poContainer.className = 'print-po-container';

        let totalInvValue = 0;
        let totalAmountPaid = 0;

        po.filteredInvoices.forEach(inv => {
            totalInvValue += parseFloat(inv.invValue) || 0;
            totalAmountPaid += parseFloat(inv.amountPaid) || 0;
        });

        const poValueNum = parseFloat(po.poDetails.Amount) || 0;
        const balanceNum = poValueNum - totalInvValue;

        const poHeader = document.createElement('div');
        poHeader.className = 'print-po-header';

        poHeader.innerHTML = `
            <div class="po-header-item"><strong>PO:</strong> ${po.poNumber}</div>
            <div class="po-header-item"><strong>Site:</strong> ${po.site}</div>
            <div class="po-header-item"><strong>PO Value:</strong> QAR ${formatCurrency(poValueNum)}</div>
            <div class="po-header-item po-header-vendor"><strong>Vendor:</strong> ${po.vendor}</div>
            <div class="po-header-item"><strong>Balance:</strong> QAR ${formatCurrency(balanceNum)}</div>
        `;
        poContainer.appendChild(poHeader);

        let invoicesTableHTML = `
            <table class="print-invoice-table">
                <thead>
                    <tr>
                        <th>Inv. Entry</th>
                        <th>Inv. No.</th>
                        <th>Inv. Date</th>
                        <th>Inv. Value</th>
                        <th>Amt. Paid</th>
                        <th>Release Date</th>
                        <th>Status</th>
                        <th>Note</th>
                    </tr>
                </thead>
                <tbody>
        `;

        po.filteredInvoices.forEach(inv => {
            const invValue = parseFloat(inv.invValue) || 0;
            const status = inv.status || '';

            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';

            invoicesTableHTML += `
                <tr>
                    <td>${inv.invEntryID || ''}</td>
                    <td>${inv.invNumber || ''}</td>
                    <td>${invoiceDateDisplay}</td>
                    <td class="print-number">${formatCurrency(invValue)}</td>
                    <td class="print-number">${formatCurrency(inv.amountPaid)}</td>
                    <td>${releaseDateDisplay}</td>
                    <td>${status || ''}</td>
                    <td>${inv.note || ''}</td>
                </tr>
            `;
        });

        invoicesTableHTML += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="print-footer-label">PO Invoice Totals:</td>
                        <td class="print-number print-footer">${formatCurrency(totalInvValue)}</td>
                        <td class="print-number print-footer">${formatCurrency(totalAmountPaid)}</td>
                        <td colspan="3"></td>
                    </tr>
                </tfoot>
            </table>
        `;

        poContainer.innerHTML += invoicesTableHTML;
        imPrintReportBody.appendChild(poContainer);
    });

        // Ensure other print targets are hidden (prevents conflicts / blank prints)
    if (summaryNotePrintArea) summaryNotePrintArea.classList.add('hidden');
    const invoicePrintModal = document.getElementById('im-invoice-print-modal');
    if (invoicePrintModal) invoicePrintModal.classList.add('hidden');

    if (imReportingPrintableArea) imReportingPrintableArea.classList.remove('hidden');

    const cleanupAfterPrint = () => {
        // Restore the summary label back to its normal state
        if (imPrintReportSummaryPaid && imPrintReportSummaryPaid.parentElement) {
            const parentDiv = imPrintReportSummaryPaid.parentElement;
            const labelSpan = parentDiv.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = 'Total Amount Paid';
            }
            parentDiv.style.display = '';
            imPrintReportSummaryPaid.textContent = 'QAR 0.00';
        }

        if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
    };

    // Some browsers can open print before DOM paint; this avoids a blank preview.
    window.addEventListener('afterprint', cleanupAfterPrint, { once: true });
    requestAnimationFrame(() => window.print());
}


async function handleDownloadCSV() {
    const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    const isSuperAdminDelegate = isVacationDelegateUser();
    if (!(isSuperAdmin || isSuperAdminDelegate)) {
        alert("You do not have permission to download this report.");
        return;
    }
    if (currentReportData.length === 0) {
        alert("No data to download. Please perform a search first.");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["PO", "Site", "Vendor", "PO Value", "Total Paid Amount", "Last Paid Date", "invEntryID", "invNumber", "invoiceDate", "invValue", "amountPaid", "invName", "srvName", "attention", "releaseDate", "status", "note"];
    csvContent += headers.join(",") + "\r\n";
    currentReportData.forEach(po => {
        const totalPaidCSV = (po.paymentData.totalPaidAmount !== 'N/A' ? po.paymentData.totalPaidAmount : '');
        const datePaidCSV = (po.paymentData.datePaid !== 'N/A' ? po.paymentData.datePaid : '');
        po.filteredInvoices.forEach(inv => {
            const row = [po.poNumber, po.site, `"${(po.vendor || '').replace(/"/g, '""')}"`, po.poDetails.Amount || '0', totalPaidCSV, datePaidCSV, inv.invEntryID || '', `"${(inv.invNumber || '').replace(/"/g, '""')}"`, inv.invoiceDate || '', inv.invValue || '0', inv.amountPaid || '0', `"${(inv.invName || '').replace(/"/g, '""')}"`, `"${(inv.srvName || '').replace(/"/g, '""')}"`, inv.attention || '', inv.releaseDate || '', inv.status || '', `"${(inv.note || '').replace(/"/g, '""')}"`];
            csvContent += row.join(",") + "\r\n";
        });
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "invoice_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// 18. INVOICE MANAGEMENT: BATCH ENTRY
// ==========================================================================

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
                        const newLabel = `${name} - ${position} - ${site}`;
                        return {
                            value: name,
                            label: newLabel
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.label.localeCompare(b.label));
                approverListForSelect = [{
                    value: '',
                    label: 'Select Attention',
                    placeholder: true
                }, {
                    value: 'None',
                    label: 'None (Clear)'
                }, ...approverOptions];
            } else {
                approverListForSelect = [{
                    value: '',
                    label: 'No approvers found',
                    placeholder: true
                }];
            }
        } catch (error) {
            console.error("Error fetching approvers for select:", error);
            approverListForSelect = [{
                value: '',
                label: 'Error loading',
                placeholder: true
            }];
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

// Batch Entry: Keep the per-row Attention button text in sync with the underlying Choices/select value.
function updateBatchRowAttentionButton(row) {
    if (!row) return;
    const btn = row.querySelector('.batch-attention-btn');
    if (!btn) return;

    let val = '';
    try {
        if (row.choicesInstance && typeof row.choicesInstance.getValue === 'function') {
            val = row.choicesInstance.getValue(true) || '';
        } else {
            const sel = row.querySelector('select[name="attention"]');
            val = sel ? (sel.value || '') : '';
        }
    } catch (e) {
        val = '';
    }

    const label = (!val ? 'Select Attention' : (val === 'None' ? 'None (Clear)' : val));
    btn.textContent = label;
    btn.title = (!val ? 'Select Attention' : val);
}

// Batch Entry: Safely set the attention value on a row (supports Choices instance or plain select).
function setBatchRowAttentionValue(row, value, label = null) {
    if (!row) return;
    const val = (value || '').trim();
    const displayLabel = label || val;

    if (row.choicesInstance) {
        try {
            if (typeof row.choicesInstance.removeActiveItems === 'function') {
                row.choicesInstance.removeActiveItems();
            }
            if (!val) {
                // Clear
                if (typeof row.choicesInstance.setValue === 'function') row.choicesInstance.setValue([]);
            } else {
                // Ensure the choice exists before selecting (prevents "value not found" edge cases)
                if (typeof row.choicesInstance.setChoices === 'function') {
                    row.choicesInstance.setChoices([{ value: val, label: displayLabel }], 'value', 'label', false);
                }
                if (typeof row.choicesInstance.setValue === 'function') {
                    row.choicesInstance.setValue([val]);
                } else if (typeof row.choicesInstance.setChoiceByValue === 'function') {
                    row.choicesInstance.setChoiceByValue(val);
                }
            }
        } catch (e) {
            console.warn('Failed to set row attention via Choices, falling back to select.', e);
            const sel = row.querySelector('select[name="attention"]');
            if (sel) sel.value = val;
        }
    } else {
        const sel = row.querySelector('select[name="attention"]');
        if (sel) sel.value = val;
    }

    updateBatchRowAttentionButton(row);
}

// Batch Entry: Open the full-width modal Attention picker for a specific row.
async function openBatchAttentionPicker(row) {
    if (!imAttentionPickerModal || !imAttentionPickerSelect) return;
    imAttentionPickerActiveRow = row;

    // Lazily init Choices for the modal selector
    if (!imAttentionPickerChoices) {
        imAttentionPickerChoices = new Choices(imAttentionPickerSelect, {
            searchEnabled: true,
            shouldSort: false,
            itemSelectText: '',
            removeItemButton: true
        });
    }

    // Clear prior selection
    try {
        if (typeof imAttentionPickerChoices.removeActiveItems === 'function') imAttentionPickerChoices.removeActiveItems();
        if (typeof imAttentionPickerChoices.setValue === 'function') imAttentionPickerChoices.setValue([]);
    } catch (e) {}

    // Apply smart filter based on the row's status + site
    const statusEl = row ? row.querySelector('select[name="status"]') : null;
    const status = statusEl ? statusEl.value : null;
    const site = row ? (row.dataset.site || null) : null;
    await populateAttentionDropdown(imAttentionPickerChoices, status, site, true);

    // Preselect current value
    let currentVal = '';
    try {
        if (row && row.choicesInstance && typeof row.choicesInstance.getValue === 'function') {
            currentVal = row.choicesInstance.getValue(true) || '';
        } else {
            const sel = row ? row.querySelector('select[name="attention"]') : null;
            currentVal = sel ? (sel.value || '') : '';
        }
    } catch (e) {}

    if (currentVal) {
        try {
            if (typeof imAttentionPickerChoices.setValue === 'function') imAttentionPickerChoices.setValue([currentVal]);
        } catch (e) {}
    }

    // Show modal
    imAttentionPickerModal.classList.remove('hidden');

    // Focus search input for quick typing
    setTimeout(() => {
        const input = imAttentionPickerModal.querySelector('.choices__input--cloned');
        if (input) input.focus();
    }, 50);
}

function closeBatchAttentionPicker() {
    if (!imAttentionPickerModal) return;
    imAttentionPickerModal.classList.add('hidden');
    imAttentionPickerActiveRow = null;
}

function updateBatchCount() {
    if (batchCountDisplay) {
        const rows = batchTableBody.querySelectorAll('tr');
        batchCountDisplay.textContent = `Total in Batch: ${rows.length}`;
    }
}

async function handleAddPOToBatch() {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const poNumber = batchPOInput.value.trim().toUpperCase();
    if (!poNumber) {
        alert("Please enter a PO Number.");
        return;
    }

    sessionStorage.setItem('imBatchSearch', poNumber);
    sessionStorage.removeItem('imBatchNoteSearch');

    const batchTableBody = document.getElementById('im-batch-table-body');
    const existingRows = batchTableBody.querySelectorAll(`tr[data-po="${poNumber}"]`);
    let isExistingInvoice = false;
    existingRows.forEach(row => {
        if (!row.dataset.key) isExistingInvoice = true;
    });
    if (isExistingInvoice) {
        alert(`A new invoice for PO ${poNumber} is already in the batch list.`);
        return;
    }

    try {
        await ensureInvoiceDataFetched();
        const poData = allPOData[poNumber];
        if (!poData) {
            alert(`PO Number ${poNumber} not found.`);
            return;
        }
        const invoiceData = allInvoiceData[poNumber];

        let maxInvIdNum = 0;
        if (invoiceData) {
            Object.values(invoiceData).forEach(inv => {
                if (inv.invEntryID) {
                    const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                    if (!isNaN(idNum) && idNum > maxInvIdNum) {
                        maxInvIdNum = idNum;
                    }
                }
            });
        }
        const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;

        const site = normalizeNameText(poData['Project ID'] || 'N/A');
        const vendor = normalizeNameText(poData['Supplier Name'] || 'N/A');
        const row = document.createElement('tr');
        row.setAttribute('data-po', poNumber);
        row.setAttribute('data-site', site);
        row.setAttribute('data-vendor', vendor);
        row.setAttribute('data-next-invid', nextInvId);

        row.innerHTML = `
            <td>${poNumber} <span class="new-indicator">(New)</span></td>
            <td>${site}</td>
            <td>${vendor}</td>
            <td><input type="text" name="invNumber" class="batch-input"></td>
            <td><input type="text" name="invName" class="batch-input"></td>
            <td><input type="text" name="details" class="batch-input"></td>
            <td><input type="text" name="srvName" class="batch-input"></td>
            <td><input type="date" name="invoiceDate" class="batch-input" value="${getTodayDateString()}"></td>
            <td><input type="number" name="invValue" class="batch-input" step="0.01"></td>
            <td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="0"></td>
            <td class="batch-attention-cell">
                <select name="attention" class="batch-input batch-attention-select"></select>
                <button type="button" class="secondary-btn batch-attention-btn" title="Select Attention">Select Attention</button>
            </td>
            <td><select name="status" class="batch-input">
                <option value="For SRV">For SRV</option>
		<option value="No Need SRV">No Need SRV</option>
                <option value="Pending">Pending</option>
                <option value="For IPC">For IPC</option>
                <option value="Under Review">Under Review</option>
                <option value="CEO Approval">CEO Approval</option>
                <option value="Report">Report</option>
		<option value="Report Approval">Report Approval</option>
		<option value="Report Approved">Report Approved</option>
                <option value="With Accounts">With Accounts</option>
            </select></td>
            <td><input type="text" name="note" class="batch-input"></td>
            <td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>
        `;
        batchTableBody.appendChild(row);

        const attentionSelect = row.querySelector('select[name="attention"]');
        const statusSelect = row.querySelector('select[name="status"]');
        const noteInput = row.querySelector('input[name="note"]');

        await populateApproverSelect(attentionSelect);

       // 1. Initialize Choices Instance (Empty first)
const choices = new Choices(attentionSelect, {
    searchEnabled: true,
    shouldSort: false,
    itemSelectText: '',
    removeItemButton: true
});
row.choicesInstance = choices;

// 2. Apply Smart Filter immediately
// This looks at the default status (e.g. "For SRV") and the PO's Site
await populateAttentionDropdown(choices, statusSelect.value, site, true);

        // --- THE FIX IS HERE ---
        const globalAttnValue = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;
        if (globalAttnValue) {
            // Must pass as an array [value] to prevent library errors
            choices.setValue([globalAttnValue]);
        }
        // -----------------------

        if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
        if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;

        // Sync button label with current attention selection
        updateBatchRowAttentionButton(row);

        updateBatchCount();

        batchPOInput.value = '';
        batchPOInput.focus();
    } catch (error) {
        console.error("Error adding PO to batch:", error);
        alert('An error occurred while adding the PO.');
    }
}

async function addInvoiceToBatchTable(invData) {
    const batchTableBody = document.getElementById('im-batch-table-body');
    if (batchTableBody.querySelector(`tr[data-key="${invData.key}"]`)) return;

    const row = document.createElement('tr');
    row.setAttribute('data-po', invData.po);
    row.setAttribute('data-key', invData.key);
    row.setAttribute('data-site', normalizeNameText(invData.site));
    row.setAttribute('data-vendor', normalizeNameText(invData.vendor));

    row.innerHTML = `
        <td>${invData.po} <span class="existing-indicator">(Existing: ${invData.invEntryID})</span></td>
        <td>${normalizeNameText(invData.site)}</td>
        <td>${normalizeNameText(invData.vendor)}</td>
        <td><input type="text" name="invNumber" class="batch-input" value="${invData.invNumber || ''}"></td>
        <td><input type="text" name="invName" class="batch-input" value="${invData.invName || ''}"></td>
        <td><input type="text" name="details" class="batch-input" value="${invData.details || ''}"></td>
        <td><input type="text" name="srvName" class="batch-input" value="${invData.srvName || ''}"></td>
        <td><input type="date" name="invoiceDate" class="batch-input" value="${normalizeDateForInput(invData.invoiceDate) || ''}"></td>
        <td><input type="number" name="invValue" class="batch-input" step="0.01" value="${invData.invValue || ''}"></td>
        <td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="${invData.amountPaid || '0'}"></td>
        <td class="batch-attention-cell">
            <select name="attention" class="batch-input batch-attention-select"></select>
            <button type="button" class="secondary-btn batch-attention-btn" title="Select Attention">Select Attention</button>
        </td>
        <td><select name="status" class="batch-input">
            <option value="For SRV">For SRV</option>
	    <option value="No Need SRV">No Need SRV</option>
            <option value="Pending">Pending</option>
            <option value="For IPC">For IPC</option>
	    <option value="Under Review">Under Review</option>
            <option value="For Approval">For Approval</option>
	    <option value="In Process">In Process</option>
 	    <option value="Unresolved">Unresolved</option>
            <option value="CEO Approval">CEO Approval</option>
            <option value="Report">Report</option>
	    <option value="Report Approval">Report Approval</option>
	    <option value="Report Approved">Report Approved</option>
            <option value="With Accounts">With Accounts</option>
            <option value="On Hold">On Hold</option>
            <option value="CLOSED">CLOSED</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Original PO">Original PO</option>
        </select></td>
        <td><input type="text" name="note" class="batch-input" value="${invData.note || ''}"></td>
        <td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>
    `;

    batchTableBody.prepend(row); // Add to top of list

    const attentionSelect = row.querySelector('select[name="attention"]');
    const statusSelect = row.querySelector('select[name="status"]');
    const noteInput = row.querySelector('input[name="note"]');

    statusSelect.value = invData.status || 'For SRV';

    await populateApproverSelect(attentionSelect);

    // 1. Initialize Choices Instance
const choices = new Choices(attentionSelect, {
    searchEnabled: true,
    shouldSort: false,
    itemSelectText: '',
    removeItemButton: true
});
row.choicesInstance = choices;

// 2. Apply Smart Filter immediately
// uses invData.site which comes from the invoice/PO data
await populateAttentionDropdown(choices, statusSelect.value, invData.site, true);

    // --- FIX STARTS HERE ---
    const globalAttentionVal = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;

    if (globalAttentionVal) {
        // ERROR WAS HERE: It needs square brackets [] to be an array
        choices.setValue([globalAttentionVal]);
    } else if (invData.attention) {
        // This method handles strings automatically, so it was fine
        choices.setChoiceByValue(invData.attention);
    }
    // --- FIX ENDS HERE ---

    if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
    if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;

    // Sync button label with current attention selection
    updateBatchRowAttentionButton(row);

    updateBatchCount();
}

async function handleBatchGlobalSearch(searchType) {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const searchTerm = batchPOInput.value.trim();
    if (searchType === 'status' && !searchTerm) {
        alert(`Please enter a ${searchType} to search for.`);
        return;
    }

    let noteSearchTerm = '';
    if (searchType === 'note') {
        if (!imBatchNoteSearchChoices) {
            alert("Note search is not ready.");
            return;
        }
        noteSearchTerm = imBatchNoteSearchChoices.getValue(true);
        if (!noteSearchTerm) {
            alert("Please select a note from the dropdown to search.");
            return;
        }
    }

    const finalSearchTerm = (searchType === 'note') ? noteSearchTerm : searchTerm;

    if (searchType === 'status') {
        sessionStorage.setItem('imBatchSearch', searchTerm);
        sessionStorage.removeItem('imBatchNoteSearch');
    } else if (searchType === 'note') {
        sessionStorage.setItem('imBatchNoteSearch', noteSearchTerm);
        sessionStorage.removeItem('imBatchSearch');
    }

    if (!confirm(`This will scan all locally cached invoices.\n\nContinue searching for all invoices with ${searchType} "${finalSearchTerm}"?`)) return;

    batchPOInput.disabled = true;
    const originalPlaceholder = batchPOInput.placeholder;
    batchPOInput.placeholder = 'Searching local cache...';
    if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.disable();

    try {
        await ensureInvoiceDataFetched();
        const allPOs = allPOData,
            allInvoicesByPO = allInvoiceData;
        let invoicesFound = 0;
        const promises = [];
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber],
                poData = allPOs[poNumber] || {},
                site = poData['Project ID'] || 'N/A',
                vendor = poData['Supplier Name'] || 'N/A';
            for (const key in invoices) {
                const inv = invoices[key];
                let isMatch = false;

                if (searchType === 'status' && inv.status && inv.status.toLowerCase() === finalSearchTerm.toLowerCase()) isMatch = true;
                else if (searchType === 'note' && inv.note && inv.note === finalSearchTerm) isMatch = true;

                if (isMatch) {
                    invoicesFound++;
                    const invData = {
                        key,
                        po: poNumber,
                        site,
                        vendor,
                        ...inv
                    };
                    promises.push(addInvoiceToBatchTable(invData));
                }
            }
        }
        await Promise.all(promises);
        if (invoicesFound === 0) alert(`No invoices found with the ${searchType} "${finalSearchTerm}".`);
        else {
            alert(`Added ${invoicesFound} invoice(s) to the batch list.`);
        }
    } catch (error) {
        console.error("Error during global batch search:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        batchPOInput.disabled = false;
        batchPOInput.placeholder = originalPlaceholder;
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.enable();
    }
}

// =========================================================
// FIX: BATCH SAVE (With Crash Protection, Report Name, Cache Sync & Smart Refresh)
// =========================================================
async function handleSaveBatchInvoices() {
    const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
    if (rows.length === 0) {
        alert("There are no invoices to save.");
        return;
    }
    
    if (!confirm(`You are about to save/update ${rows.length} invoice(s). Continue?`)) return;

    // --- [CRITICAL] SAFE USER CHECK ---
    let currentUserName = 'Admin'; 
    try {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) {
            currentUserName = currentUser.username;
        } else if (window.currentUser && window.currentUser.username) {
            currentUserName = window.currentUser.username;
        }
    } catch (e) {
        console.warn("User not defined, saving as Admin.");
    }
    // --------------------------------------

    const savePromises = [];
    let newInvoicesCount = 0;
    let updatedInvoicesCount = 0;
    const notesTouchedThisBatch = new Set();

    // Helper: Generate SRV Name
    const getSrvName = (poNumber, site, vendor, invEntryID) => {
        const today = new Date(),
            yyyy = today.getFullYear(),
            mm = String(today.getMonth() + 1).padStart(2, '0'),
            dd = String(today.getDate()).padStart(2, '0');

        const safeSite = normalizeNameText(site || 'N/A');
        const safeVendorCandidate = truncateNameText(vendor || 'Vendor', 21);
        const safeVendor = safeVendorCandidate || 'Vendor';

        const invID = normalizeNameText(invEntryID || 'INV-XX');

        // IMPORTANT: never end the generated name with a space (no padding, only truncation + trim)
        return normalizeNameText(`${yyyy}${mm}${dd}-${poNumber}-${invID}-${safeSite}-${safeVendor}`);
    };

    // Helper: Generate Report Name
    const generateReportName = (po, id, vendor) => {
        const shortVendor = truncateNameText(vendor || 'Vendor', 15).replace(/[^a-zA-Z0-9 ]/g, "");
        return normalizeNameText(`${po}-${id}-${shortVendor}-Report`);
    };


    // Ensure we have base data before starting (prevents cache errors)
    if (typeof ensureInvoiceDataFetched === 'function') await ensureInvoiceDataFetched();

    // === START LOOP ===
    for (const row of rows) {
        const poNumber = row.dataset.po;
        const site = row.dataset.site;
        const existingKey = row.dataset.key;
        
        let vendor = row.dataset.vendor;
        let invEntryID = row.dataset.nextInvid;

        // Recover ID for existing entries
        if (existingKey) {
            const existingIDSpan = row.querySelector('span.existing-indicator');
            if (existingIDSpan) {
                const match = existingIDSpan.textContent.match(/\(Existing: (.*)\)/);
                if (match && match[1]) invEntryID = match[1];
            } else if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) {
                invEntryID = allInvoiceData[poNumber][existingKey].invEntryID;
            }
        }

        // 1. Build Data Object
        const invoiceData = {
            invNumber: row.querySelector('[name="invNumber"]').value,
            invName: row.querySelector('[name="invName"]').value,
            details: row.querySelector('[name="details"]') ? row.querySelector('[name="details"]').value : (row.querySelector('[name="description"]') ? row.querySelector('[name="description"]').value : ''),
            srvName: row.querySelector('[name="srvName"]').value,
            invoiceDate: row.querySelector('[name="invoiceDate"]').value,
            invValue: row.querySelector('[name="invValue"]').value,
            amountPaid: row.querySelector('[name="amountPaid"]').value,
            status: row.querySelector('[name="status"]').value,
            note: row.querySelector('[name="note"]').value,
            releaseDate: (typeof getTodayDateString === 'function') ? getTodayDateString() : new Date().toISOString().split('T')[0]
        };

        // Keep the Note cache updated so dropdowns can show new notes immediately
        try {
            const n = (invoiceData.note || '').replace(/\u00A0/g, ' ').trim();
            if (n) {
                if (typeof allUniqueNotes === 'undefined' || !allUniqueNotes) allUniqueNotes = new Set();
                allUniqueNotes.add(n);
                notesTouchedThisBatch.add(n);
            }
        } catch (_) { /* ignore */ }

        // 2. Handle Attention Field
        invoiceData.attention = row.choicesInstance ? row.choicesInstance.getValue(true) : row.querySelector('select[name="attention"]').value;
        if (invoiceData.attention === 'None') invoiceData.attention = '';
        if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') invoiceData.attention = '';

        // 3. Validation
        if (!invoiceData.invValue) {
            alert(`Invoice Value is required for PO ${poNumber}. Cannot proceed.`);
            return;
        }

        // 4. Auto-Generate Names if needed
        vendor = truncateNameText(vendor || '', 21) || 'Vendor';
        const srvNameLower = (invoiceData.srvName || '').toLowerCase();
        
        // Auto SRV Name
        if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
            invoiceData.srvName = getSrvName(poNumber, site, vendor, invEntryID);
        }

        // Auto Report Name
        if (invoiceData.status === 'Report Approved') {
            invoiceData.reportName = generateReportName(poNumber, invEntryID, vendor);
        }

        // [SMART REFRESH] 1. Add Timestamp to record
        invoiceData.lastUpdated = firebase.database.ServerValue.TIMESTAMP;

        // 5. SAVE & CACHE LOGIC
        if (existingKey) {
            // === UPDATE EXISTING ===
            invoiceData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
            invoiceData.updatedBy = currentUserName;
            const p = invoiceDb.ref(`invoice_entries/${poNumber}/${existingKey}`).update(invoiceData);
            savePromises.push(p);
            // Keep invoice_tasks_by_user in sync (prevents stale 'For Approval' tasks)
            const originalInvoice = (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) ? allInvoiceData[poNumber][existingKey] : {};
            const updatedFullData = { ...originalInvoice, ...invoiceData };
            savePromises.push(p.then(() => updateInvoiceTaskLookup(poNumber, existingKey, updatedFullData, originalInvoice.attention)));
            updatedInvoicesCount++;
            
            // [FIX] Immediate Local Cache Update
            if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) {
                Object.assign(allInvoiceData[poNumber][existingKey], invoiceData);
            }
        } else {
            // === CREATE NEW ===
            invoiceData.invEntryID = invEntryID;
            invoiceData.vendor_name = vendor;
            invoiceData.po_number = poNumber;
            invoiceData.site_name = site;
            invoiceData.enteredAt = firebase.database.ServerValue.TIMESTAMP;
            invoiceData.enteredBy = currentUserName;

            // Push to Firebase
            const newRef = invoiceDb.ref(`invoice_entries/${poNumber}`).push();
            const newKey = newRef.key; // Get the key synchronously
            const p = newRef.set(invoiceData);
            savePromises.push(p);
            // Keep invoice_tasks_by_user in sync for new invoices
            savePromises.push(p.then(() => updateInvoiceTaskLookup(poNumber, newKey, invoiceData, null)));
            newInvoicesCount++;

            // [FIX] Immediate Local Cache Creation
            // Ensure the structure exists
            if (!allInvoiceData) allInvoiceData = {};
            if (!allInvoiceData[poNumber]) allInvoiceData[poNumber] = {};

            // Insert into memory so Summary Note sees it immediately
            allInvoiceData[poNumber][newKey] = {
                ...invoiceData,
                key: newKey, // Important: Add the key to the object
                vendor_name: vendor,
                site_name: site
            };
        }

        // [SMART REFRESH] 2. Log this update so "Smart Refresh" can find it
        if (typeof logRecentUpdate === 'function') {
            logRecentUpdate(poNumber);
        }
    }

    // === FINALIZE ===
    try {
        await Promise.all(savePromises);

        // Refresh note dropdowns/suggestions once after the batch commit
        if (notesTouchedThisBatch.size > 0) {
            refreshNotePickers(Array.from(notesTouchedThisBatch)[notesTouchedThisBatch.size - 1]);
        }
        
        alert(`Batch Process Complete!\n\nNew Invoices: ${newInvoicesCount}\nUpdated Invoices: ${updatedInvoicesCount}`);
        
        // Clear UI
        document.getElementById('im-batch-table-body').innerHTML = '';
        if (typeof imBatchSearchModal !== 'undefined' && imBatchSearchModal) {
            imBatchSearchModal.classList.add('hidden');
        }
        
        // Refresh Task List (Visuals only)
        if (typeof loadActiveTasks === 'function') loadActiveTasks();

    } catch (error) {
        console.error("Batch Save Error:", error);
        alert("An error occurred while saving. Check console.");
    }
}

async function handleBatchModalPOSearch() {
    const modalPOSearchInput = document.getElementById('im-batch-modal-po-input');
    const modalResultsContainer = document.getElementById('im-batch-modal-results');
    const poNumber = modalPOSearchInput.value.trim().toUpperCase();
    
    if (!poNumber) return;
    
    modalResultsContainer.innerHTML = '<p>Searching...</p>';
    
    try {
        await ensureInvoiceDataFetched();
        const poData = allPOData[poNumber];
        const invoicesData = allInvoiceData[poNumber];
        
        if (!invoicesData) {
            modalResultsContainer.innerHTML = '<p>No invoices found for this PO.</p>';
            return;
        }
        
        const site = poData ? poData['Project ID'] || 'N/A' : 'N/A';
        const vendor = poData ? poData['Supplier Name'] || 'N/A' : 'N/A';
        
        // 1. Create Table Structure
        modalResultsContainer.innerHTML = ''; // Clear loading message
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th><input type="checkbox" id="modal-select-all"></th>
                    <th>Inv. Entry ID</th>
                    <th>Inv. No.</th>
                    <th>Inv. Value</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody id="batch-modal-tbody"></tbody>
        `;
        modalResultsContainer.appendChild(table);
        
        const tbody = table.querySelector('tbody');
        const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        
        // 2. Loop and Create Rows with Click Logic
        for (const [key, inv] of sortedInvoices) {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer'; // Visual cue
            
            const invDataString = encodeURIComponent(JSON.stringify({
                key,
                po: poNumber,
                site,
                vendor,
                ...inv
            }));
            
            tr.innerHTML = `
                <td style="text-align:center;">
                    <input type="checkbox" class="modal-inv-checkbox" data-invoice='${invDataString}'>
                </td>
                <td>${inv.invEntryID || ''}</td>
                <td>${inv.invNumber || ''}</td>
                <td>${formatCurrency(inv.invValue)}</td>
                <td>${inv.status || ''}</td>
            `;
            
            // 3. Add Click Event to the Row
            tr.addEventListener('click', (e) => {
                // If user clicked the checkbox directly, do nothing (let default behavior handle it)
                if (e.target.type === 'checkbox') return;
                
                // Otherwise, toggle the checkbox manually
                const checkbox = tr.querySelector('.modal-inv-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
            });
            
            tbody.appendChild(tr);
        }
        
        // 4. "Select All" Logic
        const selectAll = document.getElementById('modal-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                modalResultsContainer.querySelectorAll('.modal-inv-checkbox').forEach(chk => chk.checked = e.target.checked);
            });
        }
        
    } catch (error) {
        console.error("Error searching in batch modal:", error);
        modalResultsContainer.innerHTML = '<p>An error occurred.</p>';
    }
}
async function handleAddSelectedToBatch() {
    const selectedCheckboxes = document.getElementById('im-batch-modal-results').querySelectorAll('.modal-inv-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert("Please select at least one invoice.");
        return;
    }

    // Optional: Change button text briefly
    const addBtn = document.getElementById('im-batch-modal-add-selected-btn');
    if (addBtn) addBtn.textContent = "Adding...";

    try {
        const promises = [];
        for (const checkbox of selectedCheckboxes) {
            try {
                const invData = JSON.parse(decodeURIComponent(checkbox.dataset.invoice));
                promises.push(addInvoiceToBatchTable(invData));
            } catch (err) {
                console.error("Row error:", err);
            }
        }

        await Promise.all(promises);

        // --- SPEED WORKFLOW UPDATE ---
        const searchInput = document.getElementById('im-batch-modal-po-input');
        const resultsContainer = document.getElementById('im-batch-modal-results');

        // 1. Instantly clear the input box
        if (searchInput) {
            searchInput.value = '';
        }

        // 2. Clear the table and show a small "Ready" indicator
        // We keep this small so it doesn't distract you
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div style="padding: 15px; text-align: center; color: #28a745;">
                    <strong><i class="fa-solid fa-check"></i> Added ${selectedCheckboxes.length} invoice(s).</strong>
                    <p style="color: #777; margin-top: 5px; font-size: 0.9rem;">Ready for next PO...</p>
                </div>
            `;
        }

        // 3. AUTO-FOCUS: This puts the cursor back in the box immediately
        if (searchInput) {
            // Small delay ensures the UI update finishes before we grab focus
            setTimeout(() => {
                searchInput.focus();
            }, 50);
        }

    } catch (error) {
        console.error("Batch Error:", error);
        alert("Error adding batch.");
    } finally {
        // Reset button text
        if (addBtn) addBtn.textContent = "Add Selected to Batch";
    }
}

// ==========================================================================
// 19. INVOICE MANAGEMENT: SUMMARY NOTES
// ==========================================================================

async function initializeNoteSuggestions() {
    if (allUniqueNotes.size > 0) {
        noteSuggestionsDatalist.innerHTML = '';
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });
        return;
    }
    try {
        await ensureInvoiceDataFetched();
        noteSuggestionsDatalist.innerHTML = '';
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });
    } catch (error) {
        console.error("Error initializing note suggestions:", error);
    }
}

async function populateNoteDropdown(choicesInstance) {
    if (!choicesInstance) return;

    if (allUniqueNotes.size > 0) {
        const sortedNotes = Array.from(allUniqueNotes).sort();
        const noteOptions = sortedNotes.map(note => ({
            value: note,
            label: note
        }));

        choicesInstance.setChoices(
            [
                {
                    value: '',
                    label: 'Select a note to search...',
                    disabled: true
                },
                ...noteOptions
            ],
            'value',
            'label',
            true
        );
        return;
    }

    choicesInstance.setChoices([{
        value: '',
        label: 'Loading notes...',
        disabled: true
    }]);
    try {
        await ensureInvoiceDataFetched();

        const sortedNotes = Array.from(allUniqueNotes).sort();
        const noteOptions = sortedNotes.map(note => ({
            value: note,
            label: note
        }));

        choicesInstance.setChoices(
            [
                {
                    value: '',
                    label: 'Select a note to search...',
                    disabled: true
                },
                ...noteOptions
            ],
            'value',
            'label',
            true
        );
    } catch (error) {
        console.error("Error populating note dropdown:", error);
        choicesInstance.setChoices([{
            value: '',
            label: 'Error loading notes',
            disabled: true
        }]);
    }
}

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
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        // This variable holds the data from Ecost.csv
        const epicoreData = allEpicoreData;

        let previousPaymentTotal = 0;
        let currentPaymentTotal = 0;

        // Track the completion date for the Previous Summary note (when it reached With Accounts / Paid)
        let prevSummaryDateObj = null;
        const maybeSetPrevSummaryDate = (inv) => {
            try {
                const st = (inv?.status || '').toString().trim().toLowerCase();
                const isCompleted = (st === 'with accounts' || st === 'paid' || st === 'complete paid');
                if (!isCompleted) return;

                let d = null;

                // 1) Prefer releaseDate (used as the "moved to With Accounts / released" date in this system)
                if (inv?.releaseDate) {
                    const norm = normalizeDateForInput(inv.releaseDate);
                    if (norm) d = new Date(norm + 'T00:00:00');
                }

                // 2) Fallback to event timestamps if present
                if (!d && inv?.updatedAt) d = new Date(inv.updatedAt);
                if (!d && inv?.enteredAt) d = new Date(inv.enteredAt);
                if (!d && inv?.createdAt) d = new Date(inv.createdAt);
                if (!d && inv?.timestamp) d = new Date(inv.timestamp);

                // 3) Last fallback: invoiceDate
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

                // --- 1. Previous Payment Logic (FIXED) ---
                // Only sum if prevNote is NOT empty AND matches the invoice note
                if (prevNote !== "" && inv.note === prevNote) {
                    previousPaymentTotal += parseFloat(inv.invValue) || 0;
                    maybeSetPrevSummaryDate(inv);

                    if (!foundSrv && inv.srvName && inv.srvName.toLowerCase() !== 'nil' && inv.srvName.trim() !== '') {
                        srvNameForQR = inv.srvName;
                        foundSrv = true;
                    }
                }

                // --- 2. Current Payment Logic ---
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

        // QR Code Generation
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

        // Show date next to "Prev Summary" under the QR code (use the actual Previous Summary completion date)
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

            const poKey = inv.po.toUpperCase();

            // --- UPDATED DESCRIPTION FETCHING LOGIC ---
            // 1. Try Ecost.csv (Epicore) using PO Key
            // 2. If not found, use Invoice Details
            // 3. Fallback to empty string
            let rawDescription = (epicoreData && epicoreData[poKey]) ? epicoreData[poKey] : (inv.details || '');

            // Ensure it is a string
            rawDescription = String(rawDescription);

            let truncatedDescription = rawDescription;

            // Cut to 20 characters as requested
            if (rawDescription.length > 20) {
                truncatedDescription = rawDescription.substring(0, 20) + "...";
            }
            // ------------------------------------------

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

    // Mode: Send to Accounts
    // - forces Status = With Accounts
    // - copies SRV Name from the SRV field, else from Current Note
    if (sendToAccounts) {
        newGlobalStatus = 'With Accounts';
        if (!newGlobalSRV) {
            const currentNote = (summaryNoteCurrentInput && summaryNoteCurrentInput.value)
                ? summaryNoteCurrentInput.value.trim()
                : '';
            if (currentNote) newGlobalSRV = currentNote;
        }
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
                    invoiceDate: newInvoiceDate,
                    releaseDate: today
                };
                if (newGlobalStatus) {
                    updates.status = newGlobalStatus;
                    // Record a real timestamp when status changes (needed for "last 2 hours" reports)
                    if (newGlobalStatus !== originalStatus) {
                        updates.updatedAt = Date.now();
                    }
                }

                if (newGlobalSRV) {
                    updates.srvName = newGlobalSRV;
                }

                if (newGlobalStatus === 'With Accounts') updates.attention = '';

                updatePromises.push(invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates));
                localCacheUpdates.push({
                    po: poNumber,
                    key: invoiceKey,
                    data: updates
                });

                const updatedInvoiceData = {
                    ...originalInvoice,
                    ...updates
                };
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
            console.log("Local invoice cache updated surgically.");
        }

        alert("Changes saved successfully!");
    } catch (error) {
        console.error("Error updating summary changes:", error);
        alert("An error occurred while saving the changes.");
    } finally {
        summaryNoteUpdateBtn.textContent = "Update Changes";
        summaryNoteUpdateBtn.disabled = false;
        document.getElementById('summary-note-status-input').value = '';
        document.getElementById('summary-note-srv-input').value = '';
    }
}

// ==========================================================================
// 20. INVOICE MANAGEMENT: DASHBOARD (CHARTS)
// ==========================================================================

async function populateInvoiceDashboard(forceRefresh = false) {
    const dashboardSection = document.getElementById('im-dashboard');
    dashboardSection.innerHTML = `
        <h1>Dashboard</h1>
        <div class="im-dashboard-grid">
            <div class="im-chart-card">
                <h2>Top 5 Vendors</h2>
                <ul id="top-vendors-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card">
                <h2>Top 5 Project Sites</h2>
                <ul id="top-projects-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card">
                <h2>Top 5 Activities</h2>
                <ul id="top-activities-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card full-width-card">
                <div class="dashboard-chart-header">
                    <h2>Yearly Overview</h2>
                    <div class="dashboard-chart-controls">
                        <select id="im-yearly-chart-year-select"></select>
                        <button id="im-dashboard-refresh-btn" class="secondary-btn" title="Force refresh data"><i class="fa-solid fa-sync"></i></button>
                    </div>
                </div>
                <div class="im-chart-container-full">
                    <canvas id="imYearlyChartCanvas"></canvas>
                </div>
            </div>
        </div>
    `;

    const topVendorsList = document.getElementById('top-vendors-list');
    const topProjectsList = document.getElementById('top-projects-list');
    const topActivitiesList = document.getElementById('top-activities-list');
    const yearSelect = document.getElementById('im-yearly-chart-year-select');

    const showLoading = (list) => {
        if (list) list.innerHTML = '<li>Loading...</li>';
    };
    showLoading(topVendorsList);
    showLoading(topProjectsList);
    showLoading(topActivitiesList);

    try {
        const data = await ensureEcostDataFetched(forceRefresh);

        if (!data) {
            dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please try again later.</p>';
            return;
        }

        const yearlyData = {};
        const availableYears = new Set();

        data.forEach(row => {
            const year = row['Year'];
            if (year) {
                availableYears.add(year);
                if (!yearlyData[year]) {
                    yearlyData[year] = {
                        'Total Committed': Array(12).fill(0),
                        'Delivered Amount': Array(12).fill(0),
                        'Outstanding': Array(12).fill(0),
                    };
                }
                const month = row['Month'];
                if (month !== null) {
                    yearlyData[year]['Total Committed'][month] += row['Total Committed'];
                    yearlyData[year]['Delivered Amount'][month] += row['Delivered Amount'];
                    yearlyData[year]['Outstanding'][month] += row['Outstanding'];
                }
            }
        });

        const sortedYears = Array.from(availableYears).sort((a, b) => b - a);

        yearSelect.innerHTML = '';
        if (sortedYears.length === 0) {
            document.getElementById('imYearlyChartCanvas').style.display = 'none';
            yearSelect.innerHTML = '<option>No data</option>';
            topVendorsList.innerHTML = '<li>No data found.</li>';
            topProjectsList.innerHTML = '<li>No data found.</li>';
            topActivitiesList.innerHTML = '<li>No data found.</li>';
            return;
        }

        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        const updateTop5Lists = (selectedYear) => {
            const yearData = allEcostData.filter(row => row['Year'] === selectedYear);

            const getTop5 = (data, keyField, valueField) => {
                const aggregated = data.reduce((acc, row) => {
                    const key = row[keyField];
                    if (key) {
                        acc[key] = (acc[key] || 0) + row[valueField];
                    }
                    return acc;
                }, {});

                return Object.entries(aggregated)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5);
            };

            const renderTop5List = (listElement, data) => {
                if (!listElement) return;
                listElement.innerHTML = '';
                if (data.length === 0) {
                    listElement.innerHTML = '<li>No data found.</li>';
                    return;
                }
                data.forEach(([name, value]) => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="top5-name">${name || 'N/A'}</span>
                        <span class="top5-value">QAR ${formatCurrency(value)}</span>
                    `;
                    listElement.appendChild(li);
                });
            };

            renderTop5List(topVendorsList, getTop5(yearData, 'Vendor', 'Total Committed'));
            renderTop5List(topProjectsList, getTop5(yearData, 'Project #', 'Total Committed'));
            renderTop5List(topActivitiesList, getTop5(yearData, 'Activity Name', 'Total Committed'));
        };

        const renderYearlyChart = (selectedYear) => {
            const ctx = document.getElementById('imYearlyChartCanvas').getContext('2d');
            const dataForYear = yearlyData[selectedYear];

            if (imYearlyChart) {
                imYearlyChart.destroy();
            }

            const colors = {
                'Total Committed': 'rgba(54, 162, 235, 0.7)',
                'Delivered Amount': 'rgba(75, 192, 192, 0.7)',
                'Outstanding': 'rgba(255, 206, 86, 0.7)'
            };

            imYearlyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [
                        {
                            label: 'Total Committed',
                            data: dataForYear['Total Committed'],
                            backgroundColor: colors['Total Committed'],
                            borderColor: colors['Total Committed'],
                            borderWidth: 1
                        },
                        {
                            label: 'Delivered Amount',
                            data: dataForYear['Delivered Amount'],
                            backgroundColor: colors['Delivered Amount'],
                            borderColor: colors['Delivered Amount'],
                            borderWidth: 1
                        },
                        {
                            label: 'Outstanding',
                            data: dataForYear['Outstanding'],
                            backgroundColor: colors['Outstanding'],
                            borderColor: colors['Outstanding'],
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: 'rgba(230, 241, 255, 0.9)'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += `QAR ${formatCurrency(context.parsed.y)}`;
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: 'rgba(168, 178, 209, 0.7)'
                            },
                            grid: {
                                color: 'rgba(48, 63, 96, 0.5)'
                            }
                        },
                        y: {
                            ticks: {
                                callback: function (value) {
                                    if (value >= 1000000) return `QAR ${value / 1000000}M`;
                                    if (value >= 1000) return `QAR ${value / 1000}K`;
                                    return `QAR ${value}`;
                                },
                                color: 'rgba(168, 178, 209, 0.7)'
                            },
                            grid: {
                                color: 'rgba(48, 63, 96, 0.5)'
                            }
                        }
                    }
                }
            });
        };

        const initialYear = parseInt(sortedYears[0]);
        renderYearlyChart(initialYear);
        updateTop5Lists(initialYear);

        yearSelect.addEventListener('change', (e) => {
            const selectedYear = parseInt(e.target.value);
            renderYearlyChart(selectedYear);
            updateTop5Lists(selectedYear);
        });        const refreshBtn = document.getElementById('im-dashboard-refresh-btn');
        if (refreshBtn) {
            const run = async () => {
                alert('Forcing dashboard refresh... This may take a moment.');
                await populateInvoiceDashboard(true);
            };
            if (window.__attachRefreshCooldown) {
                window.__attachRefreshCooldown(refreshBtn, 'im-dashboard-refresh', run, 30);
            } else {
                refreshBtn.addEventListener('click', run);
            }
        }

    } catch (error) {
        console.error("Error populating invoice dashboard:", error);
        dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please check console for details.</p>';
    }
}

// ==========================================================================
// 21. INVOICE MANAGEMENT: PAYMENTS
// ==========================================================================

function updatePaymentModalTotal() {
    const modalResultsContainer = document.getElementById('im-payment-modal-results');
    const checkboxes = modalResultsContainer.querySelectorAll('.payment-modal-inv-checkbox:checked');

    const totalDisplay = document.getElementById('payment-modal-total-value');
    if (!totalDisplay) return;

    let totalSum = 0;
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        if (row) {
            const invValueCell = row.cells[2].textContent;
            const value = parseFloat(String(invValueCell).replace(/,/g, ''));
            if (!isNaN(value)) {
                totalSum += value;
            }
        }
    });
    totalDisplay.textContent = formatCurrency(totalSum);
}

async function handlePaymentModalPOSearch() {
    const poNumber = imPaymentModalPOInput.value.trim().toUpperCase();
    const totalDisplay = document.getElementById('payment-modal-total-value');

    // 1. Reset Total Display
    if (totalDisplay) totalDisplay.textContent = formatCurrency(0);

    if (!poNumber) {
        imPaymentModalResults.innerHTML = '<p>Please enter a PO Number.</p>';
        return;
    }
    
    imPaymentModalResults.innerHTML = '<p>Searching...</p>';

    try {
        await ensureInvoiceDataFetched();
        const invoicesData = allInvoiceData[poNumber];

        if (!invoicesData) {
             imPaymentModalResults.innerHTML = '<p>No invoices found for this PO.</p>';
             return;
        }

        // 2. Create Table Structure Programmatically
        imPaymentModalResults.innerHTML = ''; // Clear loading text
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th><input type="checkbox" id="payment-modal-select-all"></th>
                    <th>Inv. Entry ID</th>
                    <th>Inv. Value</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody id="payment-modal-tbody"></tbody>
        `;
        imPaymentModalResults.appendChild(table);
        const tbody = table.querySelector('tbody');

        const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        let resultsFound = false;

        // 3. Loop Through Invoices
        for (const [key, inv] of sortedInvoices) {
            // Filter: Only "With Accounts" AND not already in the payment list
            if (inv.status === 'With Accounts' && !invoicesToPay[key]) {
                resultsFound = true;
                
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer'; // Make the cursor look like a hand

                tr.innerHTML = `
                    <td style="text-align:center;">
                        <input type="checkbox" class="payment-modal-inv-checkbox" data-key='${key}' data-po='${poNumber}'>
                    </td>
                    <td>${inv.invEntryID || ''}</td>
                    <td>${formatCurrency(inv.invValue)}</td>
                    <td>${inv.status || ''}</td>
                `;

                // --- CLICK ROW LOGIC ---
                tr.addEventListener('click', (e) => {
                    // If user clicked the checkbox directly, do nothing (let default behavior work)
                    if (e.target.type === 'checkbox') return;

                    // Otherwise, find the checkbox and toggle it
                    const checkbox = tr.querySelector('.payment-modal-inv-checkbox');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        updatePaymentModalTotal(); // Recalculate Sum immediately
                    }
                });

                // Add Listener to Checkbox itself (for direct clicks)
                const checkbox = tr.querySelector('.payment-modal-inv-checkbox');
                checkbox.addEventListener('change', updatePaymentModalTotal);

                tbody.appendChild(tr);
            }
        }

        // 4. Handle Empty or Success States
        if (!resultsFound) {
            imPaymentModalResults.innerHTML = '<p>No invoices found for this PO with status "With Accounts" that haven\'t already been added.</p>';
        } else {
            // "Select All" Logic
            const selectAll = document.getElementById('payment-modal-select-all');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    const checkboxes = tbody.querySelectorAll('.payment-modal-inv-checkbox');
                    checkboxes.forEach(chk => chk.checked = e.target.checked);
                    updatePaymentModalTotal(); // Update Total
                });
            }
        }

    } catch (error) {
        console.error("Error searching in payment modal:", error);
        imPaymentModalResults.innerHTML = '<p>An error occurred while searching.</p>';
    }
}

async function handleAddSelectedToPayments() {
    const selectedCheckboxes = document.getElementById('im-payment-modal-results').querySelectorAll('.payment-modal-inv-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert("Please select at least one invoice to add.");
        return;
    }

    let addedCount = 0;

    if (!allInvoiceData) await ensureInvoiceDataFetched();
    if (!allPOData) await ensureAllEntriesFetched();

    selectedCheckboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        const po = checkbox.dataset.po;

        if (invoicesToPay[key]) return;

        const invData = (allInvoiceData[po] && allInvoiceData[po][key]) ? allInvoiceData[po][key] : null;

        if (invData) {
            invoicesToPay[key] = {
                ...invData,
                key,
                po,
                originalAttention: invData.attention
            };

            const poDetails = allPOData[po] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            const row = document.createElement('tr');
            row.setAttribute('data-key', key);
            row.setAttribute('data-po', po);

            row.innerHTML = `
                <td>${po}</td>
                <td>${site}</td>
                <td>${vendor}</td>
                <td>${invData.invEntryID || ''}</td>
                <td>
                    <input type="number" name="invValue" class="payment-input" step="0.01" value="${invData.invValue || ''}" readonly style="background-color: #f0f0f0;">
                </td>
                <td>
                    <input type="number" name="amountPaid" class="payment-input highlight-field" step="0.01" value="${invData.invValue || ''}">
                </td>
                <td>
                    <input type="date" name="releaseDate" class="payment-input" value="${getTodayDateString()}">
                </td>
                <td>${invData.status || ''}</td>
                <td><button type="button" class="delete-btn payment-remove-btn" title="Remove from list">&times;</button></td>
            `;

            imPaymentsTableBody.appendChild(row);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        updatePaymentsCount();

        const modal = document.getElementById('im-add-payment-modal');
        if (modal) modal.classList.add('hidden');

        document.getElementById('im-payment-modal-po-input').value = '';
        document.getElementById('im-payment-modal-results').innerHTML = '';
    } else {
        alert("The selected invoices are already in your payment list.");
    }
}

function updatePaymentsCount() {
    if (paymentsCountDisplay) {
        const rows = imPaymentsTableBody.querySelectorAll('tr');
        paymentsCountDisplay.textContent = `(Total to Pay: ${rows.length})`;
    }
}

async function handleSavePayments() {
    const rows = imPaymentsTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("There are no payments in the list to save.");
        return;
    }
    if (!confirm(`You are about to mark ${rows.length} invoice(s) as 'Paid'. This will update their status, Invoice Value, Amount To Paid, and Release Date. Continue?`)) {
        return;
    }

    const savePromises = [];
    const localCacheUpdates = [];
    let updatesMade = 0;

    for (const row of rows) {
        const invoiceKey = row.dataset.key;
        const poNumber = row.dataset.po;
        const originalInvoiceData = invoicesToPay[invoiceKey];

        if (!invoiceKey || !poNumber || !originalInvoiceData) {
            console.warn("Skipping row with missing data:", row);
            continue;
        }

        const invValueInput = row.querySelector('input[name="invValue"]');
        const amountPaidInput = row.querySelector('input[name="amountPaid"]');
        const releaseDateInput = row.querySelector('input[name="releaseDate"]');

        const newInvValue = parseFloat(invValueInput.value) || 0;
        const newAmountPaid = parseFloat(amountPaidInput.value) || 0;
        const newReleaseDate = releaseDateInput.value || getTodayDateString();

        const updates = {
            status: 'Paid',
            invValue: newInvValue,
            amountPaid: newAmountPaid,
            releaseDate: newReleaseDate
        };

        savePromises.push(
            invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates)
        );

        const updatedFullData = {
            ...originalInvoiceData,
            ...updates
        };
        savePromises.push(
            updateInvoiceTaskLookup(poNumber, invoiceKey, updatedFullData, originalInvoiceData.attention)
        );

        localCacheUpdates.push({
            po: poNumber,
            key: invoiceKey,
            data: updates
        });
        updatesMade++;
    }

    try {
        await Promise.all(savePromises);

        if (allInvoiceData) {
            for (const update of localCacheUpdates) {
                if (allInvoiceData[update.po] && allInvoiceData[update.po][update.key]) {
                    allInvoiceData[update.po][update.key] = {
                        ...allInvoiceData[update.po][update.key],
                        ...update.data
                    };
                }
            }
            console.log("Local invoice cache updated surgically.");
        }

        alert(`${updatesMade} payment(s) processed successfully! Invoices updated to 'Paid'.`);
        imPaymentsTableBody.innerHTML = '';
        invoicesToPay = {};
        updatePaymentsCount();
        allSystemEntries = [];
    } catch (error) {
        console.error("Error saving payments:", error);
        alert("An error occurred while saving payments. Some updates may have failed. Please check the data and try again.");
    }
}



// ==========================================================================
// 23. CEO APPROVAL & RECEIPT LOGIC
// ==========================================================================

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

        // --- NEW: GENERATE & SAVE ESN PERMANENTLY ---
        if (status === 'Approved') {
            const baseESN = await getNextSeriesNumber();
            const approverName = currentApprover.Name.split(' ')[0].toUpperCase();
            updates.esn = `${baseESN}/${approverName}`; // Save this string to Firebase!
        }
        // --------------------------------------------

        const processedTask = userActiveTasks.find(t => t.key === key);
        const originalAttention = processedTask ? (processedTask.attention || '') : '';

        if (source === 'job_entry') {
            await db.ref(`job_entries/${key}`).update(updates);
        } else if (source === 'invoice' && originalPO && originalKey) {
            await invoiceDb.ref(`invoice_entries/${originalPO}/${originalKey}`).update(updates);

            const updatedInvoiceData = { ...processedTask, ...updates };
            await updateInvoiceTaskLookup(originalPO, originalKey, updatedInvoiceData, originalAttention);
            updateLocalInvoiceCache(originalPO, originalKey, updates);

            if (window.logInvoiceHistory) {
                const historyNote = updates.esn ? `Approved (ESN: ${updates.esn})` : `Marked as ${status}`;
                await window.logInvoiceHistory(originalPO, originalKey, status, historyNote);
            }
        }

        // Update local memory so Receipt sees the new ESN immediately
        if (processedTask) {
            processedTask.status = status;
            processedTask.amountPaid = newAmountPaid;
            if(updates.esn) processedTask.esn = updates.esn; // Crucial!
            ceoProcessedTasks.push(processedTask);

            const taskIndex = userActiveTasks.findIndex(t => t.key === key);
            if (taskIndex > -1) userActiveTasks.splice(taskIndex, 1);
        }

        renderActiveTaskTable(userActiveTasks);

        const taskCount = userActiveTasks.length;
        if (activeTaskCountDisplay) activeTaskCountDisplay.textContent = `(Total Tasks: ${taskCount})`;
        [wdActiveTaskBadge, imActiveTaskBadge, wdMobileNotifyBadge].forEach(b => {
            if(b) { b.textContent = taskCount; b.style.display = taskCount > 0 ? 'inline-block' : 'none'; }
        });

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

    // --- NEW: DRAGGABLE MODALS LOGIC (FIXED V2 - TRANSFORM) ---
    const makeDraggable = (modal) => {
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
    const __versionText = `Version ${APP_VERSION}`;

    const __loginVersionEl = document.getElementById('app-version-display');
    if (__loginVersionEl) { __loginVersionEl.textContent = __versionText; }

    const __dashVersionEl = document.getElementById('dashboard-version-display');
    if (__dashVersionEl) { __dashVersionEl.textContent = __versionText; }

    const __mobileVersionEl = document.getElementById('mobile-version-display');
    if (__mobileVersionEl) { __mobileVersionEl.textContent = __versionText; }

document.querySelectorAll('.sidebar-version-display').forEach(el => {
        el.textContent = `Version ${APP_VERSION}`;
    });


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
            siteSelectChoices = new Choices(document.getElementById('job-site'), {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateSiteDropdown();
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
        const isMobile = window.innerWidth <= 768;
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
        ensureAllEntriesFetched().then(() => {
            filterAndRenderReport(allSystemEntries);
        });
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
                            shippingDate: val.shippingDate || '',
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

    // FIX: Tab Listener (Safe for Clean Start)
    reportTabsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            // 1. Check if there is an active tab first to avoid NULL error
            const currentActive = reportTabsContainer.querySelector('.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }

            // 2. Set the new active tab
            e.target.classList.add('active');
            currentReportFilter = e.target.getAttribute('data-job-type');

            ensureAllEntriesFetched().then(() => {
                filterAndRenderReport(allSystemEntries);
            });
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

        // 1. Define Roles strictly
        const userPos = (currentApprover?.Position || '').trim();
        const userRole = (currentApprover?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
        const isAccountingPos = userPos === 'Accounting';
        const isAccountsPos = userPos === 'Accounts';

        // 2. Define Access Groups
        const isAccountingAdmin = isAdmin && isAccountingPos; // Strictly Admin + Accounting
        const isAccountsAdmin = (isAdmin && isAccountsPos) || isAccountingAdmin; // Admin + Accounts (or Accounting)
        const isVacationDelegate = isVacationDelegateUser();

        const imNavLinks = imNav.querySelectorAll('li');

        imNavLinks.forEach(li => {
            const link = li.querySelector('a');
            if (!link) return;
            const section = link.dataset.section;

            li.style.display = ''; // Reset

            // Mobile link hiding on Desktop
            if (li.classList.contains('wd-nav-activetask-mobile')) {
                if (window.innerWidth > 768) {
                    li.style.display = 'none';
                    return;
                }
            }

            // --- STRICT MENU HIDING RULES ---

            // 1. Entry Group: Strictly Admin + Accounting
            if ((section === 'im-invoice-entry' || section === 'im-batch-entry' || section === 'im-summary-note') && !(isAccountingAdmin || isVacationDelegate)) {
                li.style.display = 'none';
            }

            // 2. Payments: Admin + Accounts (or Accounting)
            if (section === 'im-payments') {
                // Vacation delegate does NOT get Payments access
                if (!isAccountsAdmin) li.style.display = 'none';
                else link.classList.remove('hidden');
            }

            // 3. Finance Report: Only Super Admin (Irwin) and the active Super Admin Replacement
            if (section === 'im-finance-report' && !(isSuperAdmin || isVacationDelegate)) {
                li.style.display = 'none';
            }

            if (section === 'im-dashboard' && !(isAdmin || isVacationDelegate)) {
                li.style.display = 'none';
            }
        });

        document.getElementById('im-nav-workdesk').classList.remove('hidden');

        updateIMDateTime();
        if (imDateTimeInterval) clearInterval(imDateTimeInterval);
        imDateTimeInterval = setInterval(updateIMDateTime, 1000);

        showView('invoice-management');

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

    function handleIMAttentionChoice(event) {
        if (event.detail && event.detail.value && imAttentionSelectChoices) {
            const selectedValue = event.detail.value;
            const selectedChoice = imAttentionSelectChoices._store.choices.find(c => c.value === selectedValue);
            if (selectedChoice && selectedChoice.customProperties && selectedChoice.customProperties.onVacation === true) {
                vacationingUserName.textContent = selectedChoice.value;
                vacationReturnDate.textContent = selectedChoice.customProperties.returnDate || 'N/A';
                replacementNameDisplay.textContent = selectedChoice.customProperties.replacement.name;
                replacementContactDisplay.textContent = selectedChoice.customProperties.replacement.contact;
                replacementEmailDisplay.textContent = selectedChoice.customProperties.replacement.email;
                vacationModal.classList.remove('hidden');
            }
        }
    }

    if (imWorkdeskButton) {
        imWorkdeskButton.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
        });
    }
    if (imActiveTaskButton) {
        imActiveTaskButton.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
            setTimeout(() => {
                workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
                if (activeTaskLink) activeTaskLink.classList.add('active');
                showWorkdeskSection('wd-activetask');
            }, 100);
        });
    }

    if (wdImReportingLinkMobile) {
        wdImReportingLinkMobile.addEventListener('click', (e) => {
            e.preventDefault();
            invoiceManagementButton.click();
            setTimeout(() => {
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) {
                    imReportingLink.click();
                }
            }, 100);
        });
    }

    // NEW: Listener for the renamed Invoice Management mobile link
    if (imNavReportingLinkMobile) {
        imNavReportingLinkMobile.addEventListener('click', (e) => {
            e.preventDefault();
            // Ensure we are in IM view
            if (invoiceManagementView.classList.contains('hidden')) {
                invoiceManagementButton.click();
            }
            setTimeout(() => {
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) {
                    imReportingLink.click();
                }
            }, 100);
        });
    }

    if (imBackToWDDashboardLink) {
        imBackToWDDashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
            setTimeout(() => {
                const wdDashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
                if (wdDashboardLink) {
                    wdDashboardLink.click();
                }
            }, 100);
        });
    }

    imNav.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link || link.classList.contains('disabled') || link.parentElement.style.display === 'none' || link.id === 'im-workdesk-button' || link.id === 'im-activetask-button') return;
        e.preventDefault();
        const sectionId = link.getAttribute('data-section');
        if (sectionId) {
            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            showIMSection(sectionId);
        }
    });

    imPOSearchButton.addEventListener('click', () => handlePOSearch(imPOSearchInput.value));
    imPOSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePOSearch(imPOSearchInput.value);
        }
    });
    imPOSearchButtonBottom.addEventListener('click', () => handlePOSearch(imPOSearchInputBottom.value));
    if (imOpenInvoiceFormBtn) {
        imOpenInvoiceFormBtn.addEventListener('click', () => {
            if (!currentPO) {
                alert('Please search for a PO first.');
                return;
            }
            openIMInvoiceEntryModal();
        });
    }

    imPOSearchInputBottom.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePOSearch(imPOSearchInputBottom.value);
        }
    });

    if (imShowActiveJobsBtn) imShowActiveJobsBtn.addEventListener('click', () => {
        imEntrySidebar.classList.toggle('visible');
    });
    if (imEntrySidebarList) imEntrySidebarList.addEventListener('click', handleActiveJobClick);

    imAddInvoiceButton.addEventListener('click', handleAddInvoice);

// --- FIX: HANDLE ENTER KEY IN INVOICE FORM ---
if (imNewInvoiceForm) {
    imNewInvoiceForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Stop the form from refreshing or defaulting

        // Check if we are in "Edit Mode" (do we have a key?)
        if (currentlyEditingInvoiceKey) {
            // We are editing -> Trigger Update
            handleUpdateInvoice(e);
        } else {
            // We are adding -> Trigger Add
            handleAddInvoice(e);
        }
    });
}
// ---------------------------------------------


    imUpdateInvoiceButton.addEventListener('click', handleUpdateInvoice);
    imClearFormButton.addEventListener('click', () => {
        currentPO ? resetInvoiceForm() : resetInvoiceEntryPage();
        showIMSection('im-invoice-entry');
    });
    imBackToActiveTaskButton.addEventListener('click', () => {
        workdeskButton.click();
        setTimeout(() => {
            workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            workdeskNav.querySelector('a[data-section="wd-activetask"]').classList.add('active');
            showWorkdeskSection('wd-activetask');
        }, 100);
    });

    imInvoicesTableBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            handleDeleteInvoice(deleteBtn.getAttribute('data-key'));
            return;
        }
        const pdfLink = e.target.closest('a');
        if (pdfLink) return;
        const row = e.target.closest('tr');
        if (row) {
            populateInvoiceFormForEditing(row.getAttribute('data-key'));
        }
    });

 // ==========================================================================
// 1. REPORTING TABLE LISTENER (FIXED SYNTAX)
// ==========================================================================
if (imReportingContent) {
    imReportingContent.addEventListener('click', async (e) => {

        // 1. Handle Expand Button (Main PO Row)
        const expandBtn = e.target.closest('.expand-btn');
        if (expandBtn) {
            const masterRow = expandBtn.closest('.master-row');
            const detailRow = document.querySelector(masterRow.dataset.target);
            
            if (detailRow) {
                const isCurrentlyHidden = detailRow.classList.contains('hidden');

                // [NEW] Step A: Close ALL other open POs first
                if (isCurrentlyHidden) {
                    // Find all currently open detail rows
                    const allOpenDetails = document.querySelectorAll('.detail-row:not(.hidden)');
                    
                    allOpenDetails.forEach(row => {
                        // 1. Hide the row
                        row.classList.add('hidden');
                        
                        // 2. Reset the button text to "+"
                        // The button is in the row BEFORE the detail row (the master row)
                        const previousRow = row.previousElementSibling;
                        if (previousRow) {
                            const btn = previousRow.querySelector('.expand-btn');
                            if (btn) btn.textContent = '+';
                        }
                    });
                }

                // Step B: Toggle the clicked row
                if (isCurrentlyHidden) {
                    detailRow.classList.remove('hidden');
                    expandBtn.textContent = '-';
                } else {
                    detailRow.classList.add('hidden');
                    expandBtn.textContent = '+';
                }
            }
            return;
        }



// 1b. Handle Master Row Click (Toggle Expand/Collapse)
const masterRowClick = e.target.closest('tr.master-row');
if (masterRowClick) {
    const detailRow = document.querySelector(masterRowClick.dataset.target);
    const expandBtnInRow = masterRowClick.querySelector('.expand-btn');
    if (detailRow) {
        const isCurrentlyHidden = detailRow.classList.contains('hidden');

        // Close all other open POs when opening a new one (accordion behavior)
        if (isCurrentlyHidden) {
            const allOpenDetails = document.querySelectorAll('.detail-row:not(.hidden)');
            allOpenDetails.forEach(row => {
                row.classList.add('hidden');
                const previousRow = row.previousElementSibling;
                if (previousRow) {
                    const btn = previousRow.querySelector('.expand-btn');
                    if (btn) btn.textContent = '+';
                }
            });
        }

        // Toggle clicked PO
        if (isCurrentlyHidden) {
            detailRow.classList.remove('hidden');
            if (expandBtnInRow) expandBtnInRow.textContent = '-';
        } else {
            detailRow.classList.add('hidden');
            if (expandBtnInRow) expandBtnInRow.textContent = '+';
        }
    }
    return;
}
        // 2. Handle "Edit Inv No" Button
        const editInvBtn = e.target.closest('.edit-inv-no-btn');
        if (editInvBtn) {
            e.stopPropagation();
            const po = editInvBtn.dataset.po;
            const key = editInvBtn.dataset.key;
            const currentVal = editInvBtn.dataset.current;

            const newVal = prompt("Enter new Invoice Number:", currentVal);

            if (newVal !== null && newVal.trim() !== currentVal) {
                try {
                    await invoiceDb.ref(`invoice_entries/${po}/${key}`).update({
                        invNumber: newVal.trim()
                    });
                    if (allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) {
                        allInvoiceData[po][key].invNumber = newVal.trim();
                    }
                    alert("Invoice Number updated!");
                    const currentSearch = sessionStorage.getItem('imReportingSearch') || '';
                    populateInvoiceReporting(currentSearch);
                } catch (err) {
                    console.error(err);
                    alert("Error updating invoice number.");
                }
            }
            return;
        }

        // 3. Handle Row Click (Import or Edit)
        // ---------------------------------------------------------
        const invoiceRow = e.target.closest('.nested-invoice-row');
        if (invoiceRow) {

            // A. Permission Check
            const userPositionLower = (currentApprover?.Position || '').toLowerCase();
            if (userPositionLower !== 'accounting') return;

            // [NEW] B. Handle "Inv. No." Column (Index 1) Logic
            // ---------------------------------------------------
            const clickedCell = e.target.closest('td');
            
            // If clicking the 2nd column (Index 1)...
            if (clickedCell && clickedCell.cellIndex === 1) { 
                
                // CHECK: Is this a Double Click? (e.detail === 2)
                if (e.detail === 2) {
                    const textToCopy = clickedCell.innerText.trim();
                    if (textToCopy) {
                        // 1. Copy to Clipboard
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            // 2. Visual Feedback: Flash Green
                            const originalBg = clickedCell.style.backgroundColor;
                            clickedCell.style.backgroundColor = '#d4edda'; // Light Green
                            clickedCell.style.transition = 'background-color 0.3s';
                            
                            setTimeout(() => {
                                clickedCell.style.backgroundColor = originalBg;
                            }, 400);
                        }).catch(err => console.error('Copy failed', err));
                    }
                }
                
                // STOP HERE! Do not show the Import/Edit popup.
                return; 
            }
            // ---------------------------------------------------

            // C. Get Row Data
            const poNumber = invoiceRow.dataset.poNumber;
            const invoiceKey = invoiceRow.dataset.invoiceKey;
            const source = invoiceRow.dataset.source;

            if (!poNumber || !invoiceKey) return;

            // --- SCENARIO A: IMPORT FROM EPICORE (CSV) ---
            if (source === 'ecommit') {
                if (confirm(`Import this Epicore record to Invoice Entry?\n\nPO: ${poNumber}\nInv: ${invoiceRow.dataset.invNumber || 'N/A'}`)) {

                    imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                    imPOSearchInput.value = poNumber;

                    handlePOSearch(poNumber).then(() => {
                        setTimeout(() => {
                            const invNo = invoiceRow.dataset.invNumber;
                            const invDate = invoiceRow.dataset.invDate;
                            const releaseDate = invoiceRow.dataset.releaseDate;
                            const invValue = invoiceRow.dataset.invValue;

                            if (invNo) document.getElementById('im-inv-no').value = invNo;
                            if (invDate) document.getElementById('im-invoice-date').value = normalizeDateForInput(invDate);
                            if (releaseDate) document.getElementById('im-release-date').value = normalizeDateForInput(releaseDate);

                            if (invValue) {
                                document.getElementById('im-inv-value').value = invValue;
                                document.getElementById('im-amount-paid').value = invValue;
                            }

                            // Import Defaults
                            document.getElementById('im-status').value = 'Under Review';
                            document.getElementById('im-inv-name').value = 'Nil';
                            if (imAttentionSelectChoices) imAttentionSelectChoices.removeActiveItems();

                            currentlyEditingInvoiceKey = null;
                            imAddInvoiceButton.classList.remove('hidden');
                            imUpdateInvoiceButton.classList.add('hidden');
                            imFormTitle.textContent = `Importing Invoice: ${invNo || 'New'}`;

                            openIMInvoiceEntryModal();
                            setTimeout(() => {
                                const invNoInput = document.getElementById('im-inv-no');
                                if (invNoInput) invNoInput.focus();
                            }, 50); 
                        }, 500); 
                    });
                }
                return;
            }

            // --- SCENARIO B: EDIT EXISTING FIREBASE ENTRY ---
            if (confirm(`Do you want to edit this specific invoice entry?\n\nPO: ${poNumber}\nInvoice Key: ${invoiceKey}`)) {
                imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                imPOSearchInput.value = poNumber;

                // Ensure data is fetched before populating
                const fetchPromise = (typeof ensureInvoiceDataFetched === 'function') 
                                     ? ensureInvoiceDataFetched() 
                                     : Promise.resolve(); 

                fetchPromise.then(() => {
                    currentPO = poNumber;
                    if (allPOData && allPOData[poNumber]) {
                        proceedWithPOLoading(poNumber, allPOData[poNumber]).then(() => {
                            populateInvoiceFormForEditing(invoiceKey);
                            imBackToActiveTaskButton.classList.remove('hidden');
                        });
                    } else {
                        handlePOSearch(poNumber).then(() => {
                            setTimeout(() => {
                                populateInvoiceFormForEditing(invoiceKey);
                            }, 300);
                        });
                    }
                });
            }
            return;
        }
    });
}

    // Reporting Form Listeners
    if (imReportingForm) {
        imReportingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchTerm = imReportingSearchInput.value.trim();
            if (!searchTerm && !document.getElementById('im-reporting-site-filter').value && !document.getElementById('im-reporting-date-filter').value && !document.getElementById('im-reporting-status-filter').value) {
                document.getElementById('im-reporting-content').innerHTML = '<p style="color: red; font-weight: bold;">Please specify at least one search criteria.</p>';
                return;
            }
            populateInvoiceReporting(searchTerm);
        });
    }

    if (imReportingClearButton) {
        imReportingClearButton.addEventListener('click', () => {
            imReportingForm.reset();
            sessionStorage.removeItem('imReportingSearch');
            document.getElementById('im-reporting-content').innerHTML = '<p>Please enter a search term and click Search.</p>';
            currentReportData = [];
            if (reportingCountDisplay) reportingCountDisplay.textContent = '';
        });
    }

    if (imReportingDownloadCSVButton) imReportingDownloadCSVButton.addEventListener('click', handleDownloadCSV);
    if (imDownloadDailyReportButton) imDownloadDailyReportButton.addEventListener('click', handleDownloadDailyReport);
    if (imDownloadWithAccountsReportButton) imDownloadWithAccountsReportButton.addEventListener('click', handleDownloadWithAccountsReport);

    // Invoice Records "PREVIEW LIST" should open the preview modal (not direct print).
    // Printing is handled inside the modal (isolated print) to avoid conflicts with other reports.
    if (imReportingPrintBtn) {
        imReportingPrintBtn.addEventListener('click', () => {
            if (typeof window.openInvoicePrintPreview === 'function') {
                window.openInvoicePrintPreview();
            } else {
                alert('Print Preview is not available. Please reload the page.');
            }
        });
    }

    if (imStatusSelect) {
        imStatusSelect.addEventListener('change', async (e) => {
            const statusValue = e.target.value;
            
            // 1. Update Visuals
            imUpdateAttentionRequiredUI(statusValue);

            // 2. Clear if not needed
            if (imAttentionSelectChoices && (statusValue === 'Under Review' || statusValue === 'With Accounts')) {
                imAttentionSelectChoices.removeActiveItems();
            }
            if (imAttentionGroup) imAttentionGroup.classList.remove('im-invalid');

            // 3. --- TRIGGER SMART FILTER ---
            // Get the current PO Site
            let currentSite = null;
            if (currentPO && allPOData && allPOData[currentPO]) {
                currentSite = allPOData[currentPO]['Project ID'];
            }

            // Apply Filter
            if (imAttentionSelectChoices) {
                // Save current selection to try and keep it if valid
                const currentSelection = imAttentionSelectChoices.getValue(true);
                
                await populateAttentionDropdown(imAttentionSelectChoices, statusValue, currentSite, true);
                
                // If previous selection is still in the new list, re-select it
                if(currentSelection) {
                    imAttentionSelectChoices.setChoiceByValue(currentSelection);
                }
            }
        });
    }

    // Wire invoice field "invalid" UI (visual only; no logic changes)
    imWireInvoiceValidationUI();

    // --- 11. Modals, Settings & Misc Listeners ---

    if (settingsForm) settingsForm.addEventListener('submit', handleUpdateSettings);
if (settingsVacationCheckbox) {
    settingsVacationCheckbox.addEventListener('change', () => {
        const isChecked = settingsVacationCheckbox.checked;
        settingsVacationDetailsContainer.classList.toggle('hidden', !isChecked);
        if (!isChecked) {
            settingsReturnDateInput.value = '';
            settingsReplacementNameInput.value = '';
            settingsReplacementContactInput.value = '';
            settingsReplacementEmailInput.value = '';
        }
    });
}

// Celebration Settings (Super Admin only)
    if (celebrationPreviewBtn) {
        celebrationPreviewBtn.addEventListener('click', () => {
            try {
                const cfg = readCelebrationConfigFromUI();
                // Force preview even if disabled/date mismatch
                cfg.enabled = true;
                showCelebrationBannerFromConfig(cfg, { force: true });
            } catch (e) {
                console.log('Celebration preview failed:', e);
            }
        });
    }

    if (celebrationSaveBtn) {
        celebrationSaveBtn.addEventListener('click', async () => {
            await saveCelebrationSettingsFromUI(false);
        });
    }

    if (celebrationDisableBtn) {
        celebrationDisableBtn.addEventListener('click', async () => {
            await saveCelebrationSettingsFromUI(true);
            await populateCelebrationSettingsForm();
        });
    }

    if (calendarModalViewTasksBtn) {
        calendarModalViewTasksBtn.addEventListener('click', () => {
            const friendlyDate = calendarModalViewTasksBtn.dataset.friendlyDate;
            const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
            if (activeTaskLink) {
                document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
                activeTaskLink.classList.add('active');
                showWorkdeskSection('wd-activetask', friendlyDate);
            }
            document.getElementById('calendar-task-modal').classList.add('hidden');
        });
    }

    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close-btn')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    });

    if (batchClearBtn) batchClearBtn.addEventListener('click', () => {
        batchTableBody.innerHTML = '';
        batchPOInput.value = '';
        sessionStorage.removeItem('imBatchSearch');
        sessionStorage.removeItem('imBatchNoteSearch');
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.clearInput();
        if (imBatchGlobalAttentionChoices) imBatchGlobalAttentionChoices.clearInput();
        imBatchGlobalStatus.value = '';
        imBatchGlobalNote.value = '';
        updateBatchCount();
    });

    if (batchSearchStatusBtn) batchSearchStatusBtn.addEventListener('click', () => handleBatchGlobalSearch('status'));
    if (batchSearchNoteBtn) batchSearchNoteBtn.addEventListener('click', () => handleBatchGlobalSearch('note'));
    if (batchAddBtn) batchAddBtn.addEventListener('click', handleAddPOToBatch);
    if (batchSaveBtn) batchSaveBtn.addEventListener('click', handleSaveBatchInvoices);

    if (batchPOInput) {
        // UX: pressing Enter in the "Enter PO or Status" field should ONLY add a new PO row.
        // Searching by PO / Status should be done via the dedicated buttons.
        batchPOInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (batchAddBtn) batchAddBtn.click();
                else handleAddPOToBatch();
            }
        });
        batchPOInput.addEventListener('input', debounce((e) => {
            sessionStorage.setItem('imBatchSearch', e.target.value);
            sessionStorage.removeItem('imBatchNoteSearch');
        }, 500));
    }
    if (imBatchNoteSearchSelect) {
        imBatchNoteSearchSelect.addEventListener('change', () => {
            if (imBatchNoteSearchChoices) {
                const noteValue = imBatchNoteSearchChoices.getValue(true);
                if (noteValue) {
                    sessionStorage.setItem('imBatchNoteSearch', noteValue);
                    sessionStorage.removeItem('imBatchSearch');
                } else {
                    sessionStorage.removeItem('imBatchNoteSearch');
                }
            }
        });
    }

   if (batchTableBody) {
        // 1. DELETE BUTTON LISTENER (Fixed)
        batchTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('batch-remove-btn')) {
                const row = e.target.closest('tr');
                if (row) {
                    row.remove();
                    updateBatchCount();
                }
                return;
            }

            // Per-row Attention: open a full modal picker (avoids narrow dropdown in tight table)
            if (e.target.classList.contains('batch-attention-btn')) {
                const row = e.target.closest('tr');
                if (row) openBatchAttentionPicker(row);
                return;
            }
        });

        // 2. SMART FILTER LISTENER (Kept)
        batchTableBody.addEventListener('change', async (e) => {
            if (e.target.name === 'status') {
                const row = e.target.closest('tr');
                const newStatus = e.target.value;
                const site = row.dataset.site; 
                
                // Find the Choices instance for this row
                if (row.choicesInstance) {
                    const currentSelection = row.choicesInstance.getValue(true);
                    
                    // Apply Smart Filter
                    await populateAttentionDropdown(row.choicesInstance, newStatus, site, true);
                    
                    // Restore selection if valid
                    if(currentSelection) {
                        row.choicesInstance.setChoiceByValue(currentSelection);
                    }
                }

                // Keep the button label updated
                updateBatchRowAttentionButton(row);
            }
        });
    }

    // Batch Entry: Attention picker modal (per row)
    if (imAttentionPickerModal) {
        // Close on background click
        imAttentionPickerModal.addEventListener('click', (e) => {
            if (e.target === imAttentionPickerModal) {
                closeBatchAttentionPicker();
            }
        });

        if (imAttentionPickerCancelBtn) {
            imAttentionPickerCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeBatchAttentionPicker();
            });
        }

        if (imAttentionPickerCloseBtn) {
            imAttentionPickerCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeBatchAttentionPicker();
            });
        }

        if (imAttentionPickerApplyBtn) {
            imAttentionPickerApplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!imAttentionPickerActiveRow || !imAttentionPickerChoices) {
                    closeBatchAttentionPicker();
                    return;
                }

                const selectedVal = imAttentionPickerChoices.getValue(true) || '';
                setBatchRowAttentionValue(imAttentionPickerActiveRow, selectedVal);
                closeBatchAttentionPicker();
            });
        }

        // ESC key closes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !imAttentionPickerModal.classList.contains('hidden')) {
                closeBatchAttentionPicker();
            }
        });
    }

    // Locate this in the "Event Listeners" section of Part 6
    if (imBatchSearchExistingButton) {
        imBatchSearchExistingButton.addEventListener('click', () => {
            // 1. Show the modal
            if (imBatchSearchModal) imBatchSearchModal.classList.remove('hidden');

            // 2. FORCE RESET: This wipes out any old tables or success messages
            document.getElementById('im-batch-modal-results').innerHTML = '<p>Enter a PO number to see its invoices.</p>';

            // 3. Clear the input and focus it so you are ready to type the NEW PO immediately
            const inputField = document.getElementById('im-batch-modal-po-input');
            if (inputField) {
                inputField.value = '';
                setTimeout(() => inputField.focus(), 100);
            }
        });
    }
    // --- END MODIFIED ---

    // Locate this block in app.js
if (imBatchSearchModal) {
    const modalSearchBtn = document.getElementById('im-batch-modal-search-btn');
    const addSelectedBtn = document.getElementById('im-batch-modal-add-selected-btn');
    const modalPOInput = document.getElementById('im-batch-modal-po-input');

    // 1. Button Clicks
    if (modalSearchBtn) modalSearchBtn.addEventListener('click', handleBatchModalPOSearch);
    if (addSelectedBtn) addSelectedBtn.addEventListener('click', handleAddSelectedToBatch);

    // 2. Handle "Enter" inside the Input Field -> Triggers SEARCH
    if (modalPOInput) {
        modalPOInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (modalSearchBtn) modalSearchBtn.click();
            }
        });
    }

    // 3. [NEW] Handle "Enter" anywhere else -> Triggers ADD SELECTED
    document.addEventListener('keydown', (e) => {
        // Only run if this specific modal is visible
        if (e.key === 'Enter' && !imBatchSearchModal.classList.contains('hidden')) {
            
            // IGNORE if the user is typing in the search box (that runs Search)
            if (document.activeElement === modalPOInput) return;

            // IGNORE if the user is focused on a checkbox (Enter toggles check/uncheck)
            if (document.activeElement.type === 'checkbox') return;

            // Otherwise, trigger the "Add Selected" button
            e.preventDefault();
            if (addSelectedBtn) {
                // Visual feedback (optional press effect)
                addSelectedBtn.style.transform = "scale(0.95)";
                setTimeout(() => addSelectedBtn.style.transform = "scale(1)", 100);
                
                addSelectedBtn.click();
            }
        }
    });
}

    if (imBatchGlobalAttention) {
        imBatchGlobalAttention.addEventListener('change', () => {
            if (!imBatchGlobalAttentionChoices) return;
            const selectedValue = imBatchGlobalAttentionChoices.getValue(true);
            const valueToSet = selectedValue ? [selectedValue] : [];
            const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
            rows.forEach(row => {
                if (row.choicesInstance) {
                    row.choicesInstance.setValue(valueToSet);
                }
                updateBatchRowAttentionButton(row);
            });
        });
    }
    
if (imBatchGlobalStatus) {
    imBatchGlobalStatus.addEventListener('change', (e) => {
        const newValue = e.target.value;
        const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
        
        rows.forEach(async (row) => {
            // 1. Update the status dropdown value
            row.querySelector('select[name="status"]').value = newValue;

            // 2. Re-run the filter logic for this row
            if (row.choicesInstance) {
                const site = row.dataset.site; // Get site from row data
                const currentSelection = row.choicesInstance.getValue(true);

                // Apply filter (e.g., if "For SRV", show only Site DCs for this site)
                await populateAttentionDropdown(row.choicesInstance, newValue, site, true);

                // Restore previous selection if they are still allowed
                if (currentSelection) {
                    row.choicesInstance.setChoiceByValue(currentSelection);
                }
            }

            updateBatchRowAttentionButton(row);
        });
    });
}

    if (imBatchGlobalNote) {
        const updateNotes = (newValue) => {
            const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
            rows.forEach(row => {
                row.querySelector('input[name="note"]').value = newValue;
            });
        };
        imBatchGlobalNote.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateNotes(e.target.value);
            }
        });
        imBatchGlobalNote.addEventListener('blur', (e) => {
            updateNotes(e.target.value);
        });
    }    const refreshEntryBtn = document.getElementById('im-refresh-entry-button');
    if (refreshEntryBtn) {
        const run = async () => {
            alert("Refreshing all data from sources...");
            await ensureInvoiceDataFetched(true);
            await populateActiveTasks();
            alert("Data refreshed.");
            if (currentPO) handlePOSearch(currentPO);
        };
        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(refreshEntryBtn, 'im-refresh-entry', run, 30);
        } else {
            refreshEntryBtn.addEventListener('click', run);
        }
    }    const refreshBatchBtn = document.getElementById('im-refresh-batch-button');
    if (refreshBatchBtn) {
        const run = async () => {
            alert("Refreshing all data... Your current batch list will be cleared.");
            await ensureInvoiceDataFetched(true);
            document.getElementById('im-batch-table-body').innerHTML = '';
            updateBatchCount();
            alert("Data refreshed. Please add POs again.");
        };
        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(refreshBatchBtn, 'im-refresh-batch', run, 30);
        } else {
            refreshBatchBtn.addEventListener('click', run);
        }
    }    const refreshSummaryBtn = document.getElementById('im-refresh-summary-button');
    if (refreshSummaryBtn) {
        const run = async () => {
            alert("Refreshing all data...");
            await ensureInvoiceDataFetched(true);
            initializeNoteSuggestions();
            alert("Data refreshed.");
        };
        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(refreshSummaryBtn, 'im-refresh-summary', run, 30);
        } else {
            refreshSummaryBtn.addEventListener('click', run);
        }
    }
const refreshReportingBtn = document.getElementById('im-refresh-reporting-button');
    if (refreshReportingBtn) {
        const run = async () => {
            const originalText = refreshReportingBtn.innerHTML;
                        refreshReportingBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
                        refreshReportingBtn.disabled = true;

                        try {
                            console.log("Force refreshing Invoice Records data...");

                            // Force a full network fetch of the invoice datasets
                            await ensureInvoiceDataFetched(true);

                            // Re-populate Site dropdown in case new sites/manual POs were added
                            try { await populateSiteFilterDropdown(); } catch (_) {}

                            // Reload the current Invoice Records view (keeps your filters/search)
                            const searchTerm = (document.getElementById('im-reporting-search')?.value || '').trim();
                            const siteFilter = document.getElementById('im-reporting-site-filter')?.value || '';
                            const monthFilter = document.getElementById('im-reporting-date-filter')?.value || '';
                            const statusFilter = document.getElementById('im-reporting-status-filter')?.value || '';
                            const hasCriteria = !!(searchTerm || siteFilter || monthFilter || statusFilter);

                            if (hasCriteria) {
                                await populateInvoiceReporting(searchTerm);
                            } else {
                                document.getElementById('im-reporting-content').innerHTML = '<p>Please enter a search term and click Search.</p>';
                                currentReportData = [];
                                if (reportingCountDisplay) reportingCountDisplay.textContent = '';
                            }

                            alert("Invoice Records refreshed successfully.");

                        } catch (e) {
                            console.error(e);
                            alert("Error refreshing data.");
                        } finally {
                            refreshReportingBtn.innerHTML = originalText;
                            refreshReportingBtn.disabled = false;
                        }
        };

        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(refreshReportingBtn, 'im-refresh-reporting', run, 30);
        } else {
            refreshReportingBtn.addEventListener('click', run);
        }
    }


// NOTE: We no longer auto-force "With Accounts" or auto-copy SRV Name on Generate.
// Use the Update button prompt instead when you want to "Send to Accounts".
if (summaryNoteGenerateBtn) {
    summaryNoteGenerateBtn.addEventListener('click', handleGenerateSummary);
}

if (summaryNoteUpdateBtn) {
    summaryNoteUpdateBtn.addEventListener('click', async () => {
        // Two-mode update:
        // - Cancel = Normal Update only
        // - OK = Update & Send to Accounts (forces Status=With Accounts and copies SRV name)
        const sendToAccounts = confirm(
            "Update & Send to Accounts?\n\n" +
            "OK = Yes (Status: With Accounts + copy SRV Name)\n" +
            "Cancel = No (Normal Update only)"
        );
        await handleUpdateSummaryChanges(sendToAccounts);
    });
}

    if (summaryClearBtn) {
        summaryClearBtn.addEventListener('click', () => {
            summaryNotePreviousInput.value = '';
            summaryNoteCurrentInput.value = '';
            document.getElementById('summary-note-status-input').value = '';
            document.getElementById('summary-note-srv-input').value = '';
            document.getElementById('summary-note-custom-notes-input').value = '';
            snTableBody.innerHTML = '';
            summaryNotePrintArea.classList.add('hidden');
            if (summaryNoteCountDisplay) summaryNoteCountDisplay.textContent = '';
            sessionStorage.removeItem('imSummaryPrevNote');
            sessionStorage.removeItem('imSummaryCurrNote');
        });
    }

    if (summaryNoteCurrentInput) {
        summaryNoteCurrentInput.addEventListener('input', debounce((e) => {
            sessionStorage.setItem('imSummaryCurrNote', e.target.value);
        }, 500));
    }

    if (summaryNotePrintBtn) {
        summaryNotePrintBtn.addEventListener('click', () => {
            const customNotesInput = document.getElementById('summary-note-custom-notes-input');
            const notesPrintContent = document.getElementById('sn-print-notes-content');
            const notesPrintContainer = document.getElementById('sn-print-notes');

            if (customNotesInput && notesPrintContent && notesPrintContainer) {
                const notesText = customNotesInput.value.trim();
                notesPrintContent.textContent = notesText;

                if (notesText) {
                    notesPrintContainer.style.display = 'block';
                } else {
                    notesPrintContainer.style.display = 'none';
                }

                                if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
                if (summaryNotePrintArea) summaryNotePrintArea.classList.remove('hidden');

                const cleanupAfterPrint = () => {
                    if (summaryNotePrintArea) summaryNotePrintArea.classList.add('hidden');
                };

                window.addEventListener('afterprint', cleanupAfterPrint, { once: true });
                requestAnimationFrame(() => window.print());
} else {
                window.print();
            }
        });
    }

    // --- NEW: Previous Summary PDF Button ---
    if (summaryNotePrevPdfBtn) {
        summaryNotePrevPdfBtn.addEventListener('click', async () => {
            const prevNote = document.getElementById('summary-note-previous-input').value.trim();

            if (!prevNote) {
                alert("Please enter a 'Previous Note' to search for.");
                return;
            }

            summaryNotePrevPdfBtn.textContent = "Searching...";

            try {
                await ensureInvoiceDataFetched();

                let foundSrvName = null;
                let foundPo = null;

                // Scan all invoices to find the FIRST match for this note
                // We use a label to break out of both loops once found
                outerLoop:
                    for (const po in allInvoiceData) {
                        for (const key in allInvoiceData[po]) {
                            const inv = allInvoiceData[po][key];
                            // Check if note matches and we have a valid SRV name
                            if (inv.note === prevNote && inv.srvName && inv.srvName.toLowerCase() !== 'nil' && inv.srvName.trim() !== '') {
                                foundSrvName = inv.srvName;
                                foundPo = po;
                                break outerLoop; // Stop looking, we found one
                            }
                        }
                    }

                if (foundSrvName) {
                    const pdfUrl = buildSharePointPdfUrl(SRV_BASE_PATH, foundSrvName);
                    if (pdfUrl) window.open(pdfUrl, '_blank');
                } else {
                    alert(`No SRV document found for Previous Note: "${prevNote}"`);
                }

            } catch (e) {
                console.error("Error searching for Prev Summary:", e);
                alert("An error occurred while searching.");
            } finally {
                summaryNotePrevPdfBtn.innerHTML = '<i class="fa-regular fa-file-pdf"></i> Prev Summary';
            }
        });
    }

    if (imAddPaymentButton) {
        imAddPaymentButton.addEventListener('click', () => {
            imPaymentModalPOInput.value = '';
            imPaymentModalResults.innerHTML = '<p>Enter a PO number to see invoices ready for payment.</p>';
            imAddPaymentModal.classList.remove('hidden');
        });
    }
    if (imSavePaymentsButton) imSavePaymentsButton.addEventListener('click', handleSavePayments);
    if (imPaymentsTableBody) {
        imPaymentsTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('payment-remove-btn')) {
                const row = e.target.closest('tr');
                const key = row.dataset.key;
                if (key && invoicesToPay[key]) delete invoicesToPay[key];
                row.remove();
                updatePaymentsCount();
            }
        });
    }
    if (imPaymentModalSearchBtn) imPaymentModalSearchBtn.addEventListener('click', handlePaymentModalPOSearch);
    if (imPaymentModalPOInput) {
        imPaymentModalPOInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePaymentModalPOSearch();
            }
        });
    }
    if (imPaymentModalAddSelectedBtn) imPaymentModalAddSelectedBtn.addEventListener('click', handleAddSelectedToPayments);

    if (imFinanceSearchBtn) imFinanceSearchBtn.addEventListener('click', handleFinanceSearch);
    if (imFinanceClearBtn) imFinanceClearBtn.addEventListener('click', resetFinanceSearch);
    if (imFinanceSearchPoInput) {
        imFinanceSearchPoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleFinanceSearch();
            }
        });
    }
    if (imFinanceResults) imFinanceResults.addEventListener('click', handleFinanceActionClick);
    if (imFinancePrintReportBtn) imFinancePrintReportBtn.addEventListener('click', printFinanceReport);

    document.addEventListener('click', (e) => {
        const card = e.target.closest('.im-po-balance-card');
        if (card && card.dataset.toggleTarget) {
            const targetId = card.dataset.toggleTarget;
            const targetElement = document.querySelector(targetId);
            const icon = card.querySelector('.po-card-chevron');

            if (targetElement) {
                const isOpening = targetElement.classList.contains('hidden-invoice-list');

                if (isOpening) {
                    const allOpenLists = document.querySelectorAll('[id^="mobile-invoice-list-"]:not(.hidden-invoice-list)');
                    allOpenLists.forEach(listDiv => {
                        listDiv.classList.add('hidden-invoice-list');
                        const otherCard = document.querySelector(`[data-toggle-target="#${listDiv.id}"]`);
                        const otherIcon = otherCard ? otherCard.querySelector('.po-card-chevron') : null;
                        if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
                    });
                }

                targetElement.classList.toggle('hidden-invoice-list');
                if (icon) {
                    icon.style.transform = targetElement.classList.contains('hidden-invoice-list') ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            }
        }
    });

    // Mobile Search Modal Logic
    if (imMobileSearchBtn) {
        imMobileSearchBtn.addEventListener('click', () => {
            const desktopSearchInput = document.getElementById('im-reporting-search');
            const desktopSiteFilter = document.getElementById('im-reporting-site-filter');
            const desktopStatusFilter = document.getElementById('im-reporting-status-filter');
            const desktopDateFilter = document.getElementById('im-reporting-date-filter');

            const mobileSearchInput = document.getElementById('im-mobile-search-term');
            const mobileSiteFilter = document.getElementById('im-mobile-site-filter');
            const mobileStatusFilter = document.getElementById('im-mobile-status-filter');
            const mobileDateFilter = document.getElementById('im-mobile-date-filter');

            mobileSearchInput.value = desktopSearchInput.value;
            mobileSiteFilter.value = desktopSiteFilter.value;
            mobileStatusFilter.value = desktopStatusFilter.value;
            mobileDateFilter.value = desktopDateFilter.value;

            if (desktopSiteFilter.options.length > 1 && mobileSiteFilter.options.length <= 1) {
                mobileSiteFilter.innerHTML = desktopSiteFilter.innerHTML;
            }

            if (imMobileSearchModal) imMobileSearchModal.classList.remove('hidden');
        });
    }

    if (imMobileSearchCloseBtn) {
        imMobileSearchCloseBtn.addEventListener('click', () => {
            if (imMobileSearchModal) imMobileSearchModal.classList.add('hidden');
        });
    }

    if (imMobileSearchClearBtn) {
        imMobileSearchClearBtn.addEventListener('click', () => {
            document.getElementById('im-mobile-search-term').value = '';
            document.getElementById('im-mobile-site-filter').value = '';
            document.getElementById('im-mobile-status-filter').value = '';
            document.getElementById('im-mobile-date-filter').value = '';

            document.getElementById('im-reporting-search').value = '';
            document.getElementById('im-reporting-site-filter').value = '';
            document.getElementById('im-reporting-status-filter').value = '';
            document.getElementById('im-reporting-date-filter').value = '';

            sessionStorage.removeItem('imReportingSearch');
            currentReportData = [];

            const desktopContainer = document.getElementById('im-reporting-content');
            const mobileContainer = document.getElementById('im-reporting-mobile-view');

            if (desktopContainer) desktopContainer.innerHTML = '<p>Please enter a search term and click Search.</p>';
            if (mobileContainer) {
                mobileContainer.innerHTML = `
                    <div class="im-mobile-empty-state">
                        <i class="fa-solid fa-file-circle-question"></i>
                        <h3>No Results Found</h3>
                        <p>Use the search button to find a PO or Vendor.</p>
                    </div>`;
            }
            if (reportingCountDisplay) reportingCountDisplay.textContent = '(Found: 0)';
        });
    }

    if (imMobileSearchRunBtn) {
        imMobileSearchRunBtn.addEventListener('click', () => {
            const desktopSearchInput = document.getElementById('im-reporting-search');
            const mobileSearchInput = document.getElementById('im-mobile-search-term');

            desktopSearchInput.value = mobileSearchInput.value;
            document.getElementById('im-reporting-site-filter').value = document.getElementById('im-mobile-site-filter').value;
            document.getElementById('im-reporting-status-filter').value = document.getElementById('im-mobile-status-filter').value;
            document.getElementById('im-reporting-date-filter').value = document.getElementById('im-mobile-date-filter').value;

            sessionStorage.setItem('imReportingSearch', desktopSearchInput.value);
            populateInvoiceReporting(desktopSearchInput.value);

            if (imMobileSearchModal) imMobileSearchModal.classList.add('hidden');
        });
    }

    if (modifyTaskStatus) {
        modifyTaskStatus.addEventListener('change', (e) => {
            modifyTaskStatusOtherContainer.classList.toggle('hidden', e.target.value !== 'Other');
        });
    }
    if (modifyTaskSaveBtn) {
        modifyTaskSaveBtn.addEventListener('click', handleSaveModifiedTask);
    }

    if (ceoModalApproveBtn) ceoModalApproveBtn.addEventListener('click', () => handleCEOAction('Approved'));
    if (ceoModalRejectBtn) ceoModalRejectBtn.addEventListener('click', () => handleCEOAction('Rejected'));
    if (sendCeoApprovalReceiptBtn) sendCeoApprovalReceiptBtn.addEventListener('click', previewAndSendReceipt);
    if (mobileSendReceiptBtn) mobileSendReceiptBtn.addEventListener('click', previewAndSendReceipt);

    // --- NEW: Job Entry "View Attachment" Button Logic ---
    const jobAttachmentViewBtn = document.getElementById('job-attachment-view-btn');
    if (jobAttachmentViewBtn) {
        jobAttachmentViewBtn.addEventListener('click', () => {
            // 1. Get the filename from the input box
            const val = document.getElementById('job-attachment').value.trim();

            if (!val) {
                alert("Please paste a filename first.");
                return;
            }

            // 2. Smart Link Construction
            let fullPath;
            if (val.startsWith('http')) {
                // If they pasted a full link, use it as-is
                fullPath = val;
            } else {
                // If they just pasted "file.pdf", combine it with your specific path
                // encodeURIComponent ensures spaces become %20
                fullPath = ATTACHMENT_BASE_PATH + encodeURIComponent(val);
            }

            // 3. Open in new tab
            window.open(fullPath, '_blank');
        });
    }

    // ==========================================================================
    // NEW HELPERS: HISTORY TRACKING
    // ==========================================================================

    // 1. Log History to Firebase
    window.logInvoiceHistory = async function (poNumber, invoiceKey, newStatus, note = "") {
        if (!poNumber || !invoiceKey) return;

        const historyEntry = {
            status: newStatus,
            updatedBy: currentApprover ? currentApprover.Name : 'System',
            timestamp: Date.now(),
            note: note || ''
        };

        try {
            await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}/history`).push(historyEntry);
        } catch (e) {
            console.error("Failed to log history", e);
        }
    };

// =========================================================
// 2. VIEW HISTORY (WITH DURATION CALCULATION FIXED)
// =========================================================
window.showInvoiceHistory = async function (poNumber, invoiceKey) {
    const modal = document.getElementById('history-modal');
    const tbody = document.getElementById('history-table-body');
    const loader = document.getElementById('history-modal-loader');

    if (modal) modal.classList.remove('hidden');
    if (loader) loader.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';

    try {
        const snapshot = await invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}/history`).once('value');
        const historyData = [];

        snapshot.forEach(child => { historyData.push(child.val()); });

        // 1. Sort ASCENDING first (Oldest First) to calculate duration
        historyData.sort((a, b) => a.timestamp - b.timestamp);

        // 2. Calculate Duration
        historyData.forEach((entry, index) => {
            if (index === 0) {
                entry.durationDisplay = '-'; // First entry has no duration
            } else {
                const prevTime = historyData[index - 1].timestamp;
                const currTime = entry.timestamp;
                const diffMs = currTime - prevTime;

                // Math logic
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                if (diffDays > 0) entry.durationDisplay = `${diffDays}d ${diffHrs}h`;
                else if (diffHrs > 0) entry.durationDisplay = `${diffHrs}h ${diffMins}m`;
                else entry.durationDisplay = `${diffMins}m`;
            }
        });

        // 3. Reverse back to DESCENDING (Newest First) for display
        historyData.reverse();

        // --- SMART SEARCH FOR ESN (Keep existing logic) ---
        let sharedEsn = null;
        let sharedLink = null;
        for (const entry of historyData) {
            if (entry.esn && entry.pdfLink) {
                sharedEsn = entry.esn;
                sharedLink = entry.pdfLink;
                break;
            }
        }

        if (loader) loader.classList.add('hidden');

        if (historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
            return;
        }

        historyData.forEach((h) => {
            const dateObj = new Date(h.timestamp);
            const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // QR Logic
            let qrButton = '';
            let currentEsn = h.esn;
            let currentLink = h.pdfLink;

            if (!currentEsn && (h.action === 'Approved' || h.status === 'Approved') && sharedEsn) {
                currentEsn = sharedEsn;
                currentLink = sharedLink;
            }

            if (currentEsn && currentLink) {
                qrButton = `
                <button onclick="printHistorySticker('${currentEsn}', '${currentLink}')" 
                        class="action-btn" 
                        title="Print QR Sticker (${currentEsn})"
                        style="background-color: #6f42c1; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-left: 5px; cursor: pointer;">
                    <i class="fa-solid fa-qrcode"></i> Print
                </button>`;
            }

            // [MODIFIED] Added h.durationDisplay to the 4th column
            const row = `
            <tr>
                <td>
                    <strong>${h.action || h.status}</strong>
                    ${qrButton} <br>
                    <small style="color:#777">${h.note || ''}</small>
                </td>
                <td>${dateStr}</td>
                <td>${h.updatedBy || h.by || 'System'}</td>
                <td style="font-weight: bold; color: #00748C;">${h.durationDisplay}</td>
            </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        if (loader) loader.classList.add('hidden');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
};

    // --- NEW: Dashboard Double-Click Logic ---
    const dashboardNavLink = document.getElementById('im-dashboard-nav-link');
    if (dashboardNavLink) {
        dashboardNavLink.addEventListener('dblclick', (e) => {
            e.preventDefault();
            // Only load if we are currently IN the IM view
            if (!invoiceManagementView.classList.contains('hidden')) {
                // Visual Feedback
                const dbSection = document.getElementById('im-dashboard');
                dbSection.innerHTML = `
                    <h1>Dashboard</h1>
                    <div style="text-align: center; padding-top: 50px;">
                        <p>Loading data...</p>
                    </div>
                `;
                // Trigger the Load
                populateInvoiceDashboard(true);
            }
        });
    }


// =========================================================
// 3. PRINT HISTORY STICKER (MANAGER 1, 2, 3 LOGIC)
// =========================================================
window.printHistorySticker = function(esn, link) {
    if (!esn || !link) {
        alert("Error: ESN or Link missing for this record.");
        return;
    }

    // 1. ASK FOR POSITION
    const pos = prompt(
        "Select Sticker Position on A4 Paper:\n\n" +
        "1 - Manager 1 (Bottom LEFT)\n" +
        "2 - Manager 2 (Bottom CENTER)\n" +
        "3 - Manager 3 (Bottom RIGHT)", 
        "1"
    );

    if (!pos) return; // Cancelled

    // 2. DEFINE CSS POSITION
    let cssPosition = "";
    if (pos === "1") cssPosition = "bottom: 20mm; left: 20mm;"; // Manager 1
    else if (pos === "2") cssPosition = "bottom: 20mm; left: 50%; transform: translateX(-50%);"; // Manager 2
    else if (pos === "3") cssPosition = "bottom: 20mm; right: 20mm;"; // Manager 3
    else { alert("Invalid selection"); return; }

    const dateStr = new Date().toLocaleDateString('en-GB');

    // 3. OPEN PRINT WINDOW
    const printWin = window.open('', '', 'width=600,height=600');
    printWin.document.write(`
        <html>
        <head>
            <title>Print Sticker - ${esn}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
            <style>
                @page { size: A4; margin: 0; }
                body { margin: 0; padding: 0; width: 210mm; height: 297mm; position: relative; }
                
                #sticker-container {
                    position: absolute;
                    ${cssPosition} /* Applies the Manager 1/2/3 logic */
                    width: auto;
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    padding: 5px;
                    background: white;
                    border: 1px dashed #ccc; /* Helper border, remove if unwanted */
                }
                .main-box { text-align: center; padding-right: 5px; border-right: 1px solid #000; }
                .status-text { font-weight: 900; font-size: 14px; color: #28a745; margin-bottom: 2px; }
                .esn-text { font-family: monospace; font-weight: bold; font-size: 10px; margin-top: 2px; }
                .side-text { 
                    writing-mode: vertical-rl; 
                    text-orientation: mixed; 
                    font-size: 8px; 
                    font-weight: bold; 
                    margin-left: 5px;
                }
            </style>
        </head>
        <body>
            <div id="sticker-container">
                <div class="main-box">
                    <div class="status-text">APPROVED</div>
                    <div id="qrcode"></div>
                    <div class="esn-text">${esn}</div>
                </div>
                <div class="side-text">${dateStr}</div>
            </div>
            <script>
                new QRCode(document.getElementById("qrcode"), {
                    text: "${link}",
                    width: 80,
                    height: 80,
                    correctLevel: QRCode.CorrectLevel.M
                });
                // Wait for QR render then print
                setTimeout(() => { window.print(); window.close(); }, 500);
            <\/script>
        </body>
        </html>
    `);
    printWin.document.close();
};

    // --- Manual PO Entry Logic ---
    const manualSupplierIdInput = document.getElementById('manual-supplier-id');

    // 1. Auto-lookup Vendor Name when ID is typed
    if (manualSupplierIdInput) {
        manualSupplierIdInput.addEventListener('input', (e) => {
            const id = e.target.value.trim();
            const nameInput = document.getElementById('manual-vendor-name');

            if (allVendorsData && allVendorsData[id]) {
                nameInput.value = allVendorsData[id];
                nameInput.style.backgroundColor = "#d4edda"; // Green tint for success
            } else {
                nameInput.value = "";
                nameInput.style.backgroundColor = "#f9f9f9";
            }
        });
    }

   // =========================================================
// MANUAL PO SAVE (Corrected: Saves to 'invoiceDb' > 'purchase_orders')
// =========================================================
const saveManualPOBtn = document.getElementById('im-save-manual-po-btn');
if (saveManualPOBtn) {
    saveManualPOBtn.addEventListener('click', async () => {
        const po = document.getElementById('manual-po-number').value.trim().toUpperCase();
        const vendor = document.getElementById('manual-vendor-name').value;
        const site = document.getElementById('manual-site-select').value;
        const amount = document.getElementById('manual-po-amount').value;

        if (!vendor || !site || !amount) {
            alert("Please fill in all fields (Supplier ID, Site, Amount).");
            return;
        }

        const manualPOData = {
            'PO': po,
            'Supplier Name': vendor,
            'Project ID': site,
            'Amount': amount,
            'IsManual': true
        };

        // 1. UPDATE MEMORY IMMEDIATELY
        if (!allPOData) allPOData = {};
        allPOData[po] = manualPOData;

        // 2. SAVE TO FIREBASE PERMANENTLY (CORRECTED TARGET)
        try {
            saveManualPOBtn.textContent = "Saving...";
            
            // FIX: Use 'invoiceDb' (invoiceentry-b15a8) and 'purchase_orders' path
            await invoiceDb.ref(`purchase_orders/${po}`).set(manualPOData);
            
            // Close Modal and Proceed
            document.getElementById('im-manual-po-modal').classList.add('hidden');
            proceedWithPOLoading(po, manualPOData);
        } catch(e) {
            console.error("Error saving manual PO", e);
            alert("Could not save Manual PO to database.");
        } finally {
            saveManualPOBtn.textContent = "Save & Continue";
        }
    });
}

    window.showTransferHistory = async function (key) {
    const modal = document.getElementById('history-modal');
    const loader = document.getElementById('history-modal-loader');
    const tbody = document.getElementById('history-table-body');

    if (modal) modal.classList.remove('hidden');
    if (loader) loader.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';

    try {
        // 1. Get the entry
        const snapshot = await db.ref(`transfer_entries/${key}`).once('value');
        const entry = snapshot.val();

        if (!entry) throw new Error("Entry not found");

        const historyData = [];

        // 2. Parse History (array or object)
        if (entry.history) {
            if (Array.isArray(entry.history)) {
                historyData.push(...entry.history);
            } else {
                Object.values(entry.history).forEach(h => historyData.push(h));
            }
        }

        if (historyData.length === 0) {
            if (loader) loader.classList.add('hidden');
            tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
            return;
        }

        // 3. Sort ASC (oldest -> newest) to calculate duration
        historyData.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

        // 4. Duration calculation (same style as Invoice history)
        historyData.forEach((h, index) => {
            if (index === 0) {
                h.durationDisplay = '-';
            } else {
                const prevTs = Number(historyData[index - 1].timestamp) || 0;
                const currTs = Number(h.timestamp) || 0;
                const diffMs = Math.max(0, currTs - prevTs);

                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                if (diffDays > 0) h.durationDisplay = `${diffDays}d ${diffHrs}h`;
                else if (diffHrs > 0) h.durationDisplay = `${diffHrs}h ${diffMins}m`;
                else h.durationDisplay = `${diffMins}m`;
            }
        });

        // 5. Reverse to DESC for display
        historyData.reverse();

        if (loader) loader.classList.add('hidden');

        historyData.forEach((h) => {
            const dateObj = new Date(Number(h.timestamp) || Date.now());
            const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            const who = h.by || h.updatedBy || 'System';

            const row = `
                <tr>
                    <td><strong>${h.action || h.status || ''}</strong><br><small>${h.note || ''}</small></td>
                    <td>${dateStr}</td>
                    <td>${who}</td>
                    <td style="font-weight: bold; color: #00748C;">${h.durationDisplay || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        if (loader) loader.classList.add('hidden');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
};

    // ==========================================================================
    // FIXED HELPER: Reverse Stock (Undo a transaction)
    // ==========================================================================
    async function reverseStockInventory(id, qty, jobType, fromSite, toSite) {
        if (!id || !qty) return;

        // Sanitize Site Names
        const safeFrom = fromSite ? fromSite.replace(/[.#$[\]]/g, "_") : null;
        const safeTo = toSite ? toSite.replace(/[.#$[\]]/g, "_") : null;

        console.log(`Reversing Stock -> Type: ${jobType}, Qty: ${qty}, ID: ${id}`);

        try {
            let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
            if (!snapshot.exists()) {
                snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
            }

            if (snapshot.exists()) {
                const data = snapshot.val();
                const key = Object.keys(data)[0];
                const item = data[key];
                let sites = item.sites || {};
                const amount = parseFloat(qty);

                // --- REVERSAL LOGIC ---

                // A. USAGE or RETURN (Original: Deducted Source -> Reversal: ADD Source)
                if (jobType === 'Usage' || jobType === 'Return') {
                    if (safeFrom) {
                        let current = parseFloat(sites[safeFrom] || 0);
                        sites[safeFrom] = current + amount; // Add back to source
                    }
                }

                // B. RESTOCK (Original: Added Dest -> Reversal: DEDUCT Dest)
                else if (jobType === 'Restock') {
                    if (safeTo) {
                        let current = parseFloat(sites[safeTo] || 0);
                        sites[safeTo] = current - amount;
                        if (sites[safeTo] < 0) sites[safeTo] = 0;
                    }
                }

                // C. TRANSFER (Original: Moved Source->Dest -> Reversal: Move Dest->Source)
                else {
                    // Default to Transfer logic if type is missing
                    if (safeFrom && safeTo) {
                        let curFrom = parseFloat(sites[safeFrom] || 0);
                        let curTo = parseFloat(sites[safeTo] || 0);

                        sites[safeFrom] = curFrom + amount; // Return to source
                        sites[safeTo] = curTo - amount; // Remove from dest
                        if (sites[safeTo] < 0) sites[safeTo] = 0;
                    }
                }

                // Recalculate Global Total
                let newGlobalStock = 0;
                Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

                await db.ref(`material_stock/${key}`).update({
                    sites: sites,
                    stockQty: newGlobalStock,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });
                console.log("Stock Reversal Successful.");
            }
        } catch (error) {
            console.error("Stock reversal error:", error);
        }
    }

    // ==========================================================================
    // HANDLE DELETE -> PROMPTS FOR QTY -> CREATES RETURN -> REMOVES ORIGINAL
    // ==========================================================================
    async function handleDeleteTransferEntry(key) {
        await ensureAllEntriesFetched();
        const task = allSystemEntries.find(t => t.key === key);

        if (!task) {
            alert("Error: Task not found.");
            return;
        }

        const isCompleted = ['Completed', 'Received', 'SRV Done'].includes(task.remarks);

        // 1. PENDING TASK? Just Delete.
        if (!isCompleted) {
            if (confirm("Delete this pending request?")) {
                await db.ref(`transfer_entries/${key}`).remove();
                alert("Request deleted.");

                // Remove from local caches and refresh UI without reloading
                allSystemEntries = allSystemEntries.filter(t => t.key !== key);
                if (Array.isArray(userActiveTasks)) {
                    userActiveTasks = userActiveTasks.filter(t => t.key !== key);
                }

                if (typeof populateActiveTasks === 'function') {
                    populateActiveTasks();
                }

                // Respect current tab/search filters in Job Records
                if (typeof filterAndRenderReport === 'function' && document.getElementById('reporting-table-body')) {
                    filterAndRenderReport(allSystemEntries);
                } else if (typeof renderReportingTable === 'function' && document.getElementById('reporting-table-body')) {
                    renderReportingTable(allSystemEntries);
                }

            }
            return;
        }

        // 2. DETERMINE MAX QUANTITY
        // We can only return what was actually received (or ordered if not tracked)
        const maxQty = parseFloat(task.receivedQty || task.orderedQty || 0);

        if (maxQty <= 0) {
            alert("Error: This task has no quantity recorded to return.");
            return;
        }

        // 3. PROMPT USER FOR QUANTITY
        const returnQtyStr = prompt(
            `Creating Return Request for: ${task.productName}\n\nMax Quantity Available: ${maxQty}\n\nPlease enter the Quantity to Return:`,
            maxQty
        );

        // If user clicks Cancel, stop everything
        if (returnQtyStr === null) return;

        const returnQty = parseFloat(returnQtyStr);

        // 4. VALIDATE QUANTITY
        if (isNaN(returnQty) || returnQty <= 0) {
            alert("Invalid Quantity. Please enter a number greater than 0.");
            return;
        }
        if (returnQty > maxQty) {
            alert(`Error: You cannot return ${returnQty} because the original transaction was only for ${maxQty}.`);
            return;
        }

        // 5. DETERMINE LOCATIONS (Robust Site Fix)
        const origSource = task.fromSite || task.fromLocation || task.site || 'Main Store';
        const origDest = task.toSite || task.toLocation || 'Unknown';

        let retFrom = '';
        let retTo = '';
        let detailsMsg = '';

        if (task.jobType === 'Restock') {
            detailsMsg = `Reversal of Restock (${task.controlNumber})`;
            retFrom = origDest; // Deduct from where it is now
            retTo = 'Outside Supplier';
        } else if (task.jobType === 'Usage') {
            detailsMsg = `Reversal of Usage (${task.controlNumber})`;
            retFrom = origSource; // Usage occurred at source, return adds back to source
            retTo = origSource;
        } else if (task.jobType === 'Transfer') {
            detailsMsg = `Reversal of Transfer (${task.controlNumber})`;
            retFrom = origDest; // Currently at Destination
            retTo = origSource; // Return to Source
        } else {
            alert("Cannot reverse this transaction type.");
            return;
        }

        try {
            const currentUser = currentApprover ? currentApprover.Name : 'Unknown';
            const newRef = db.ref('transfer_entries').push();

            // 6. CREATE REVERSAL DATA
            const reversalData = {
                controlNumber: `RET-${task.controlNumber}`,
                jobType: 'Return',
                for: 'Return',
                productID: task.productID || task.productId,
                productName: task.productName,
                details: detailsMsg,

                // Swapped Locations
                fromSite: retFrom,
                toSite: retTo,
                fromLocation: retFrom,
                toLocation: retTo,

                // USER DEFINED QUANTITY
                requiredQty: returnQty,
                orderedQty: returnQty,

                requestor: currentUser,
                approver: task.approver,
                receiver: (task.jobType === 'Transfer') ? task.sourceContact : 'System',

                status: 'Pending Admin',
                remarks: 'Pending Admin',
                attention: task.approver,

                originalJobType: task.jobType,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                enteredBy: currentUser,
                history: [{
                    action: "Return Requested",
                    by: currentUser,
                    timestamp: Date.now(),
                    note: `Qty: ${returnQty}`
                }]
            };

            // 7. SAVE & DELETE OLD
            await newRef.set(reversalData);
            await db.ref(`transfer_entries/${key}`).remove();

            alert(`Return Request Created for ${returnQty} units! Sent to Approver.`);

            // Refresh
            allSystemEntries = allSystemEntries.filter(t => t.key !== key);
            if (typeof populateActiveTasks === 'function') populateActiveTasks();
            if (document.getElementById('reporting-table-body')) {
                if (typeof filterAndRenderReport === 'function') filterAndRenderReport(allSystemEntries);
                else renderReportingTable(allSystemEntries);
            }

        } catch (error) {
            console.error(error);
            alert("Failed to create return request.");
        }
    }

    // ==========================================================================
    // FIXED: Stock Inventory Update (Site-Specific)
    // ==========================================================================
    async function updateStockInventory(id, qty, action, siteName) {
        if (!id || !qty || !siteName) return;

        // Sanitize Site Name
        const safeSiteName = siteName.replace(/[.#$[\]]/g, "_");
        console.log(`Stock Update: ${action} ${qty} at ${safeSiteName} for ${id}`);

        try {
            let snapshot = await db.ref('material_stock').orderByChild('productID').equalTo(id).once('value');
            if (!snapshot.exists()) {
                snapshot = await db.ref('material_stock').orderByChild('productId').equalTo(id).once('value');
            }

            if (snapshot.exists()) {
                const data = snapshot.val();
                const key = Object.keys(data)[0];
                const item = data[key];
                let sites = item.sites || {};
                let currentSiteStock = parseFloat(sites[safeSiteName] || 0);
                const amount = parseFloat(qty);

                if (action === 'Deduct') {
                    currentSiteStock -= amount;
                    if (currentSiteStock < 0) currentSiteStock = 0;
                } else if (action === 'Add') {
                    currentSiteStock += amount;
                }

                sites[safeSiteName] = currentSiteStock;

                let newGlobalStock = 0;
                Object.values(sites).forEach(val => newGlobalStock += parseFloat(val) || 0);

                await db.ref(`material_stock/${key}`).update({
                    sites: sites,
                    stockQty: newGlobalStock,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });
            }
        } catch (error) {
            console.error("Stock update failed:", error);
        }
    }

    // A. OPEN MODAL (Handles both Add and Edit modes)
    window.openStandardJobModal = function (mode, entryData = null) {
        const modal = document.getElementById('standard-job-modal');
        const title = document.getElementById('standard-modal-title');

        // Get Buttons
        const addBtn = document.getElementById('add-job-button');
        const updateBtn = document.getElementById('update-job-button');
        const deleteBtn = document.getElementById('delete-job-button');

        // 1. ADD MODE
        if (mode === 'Add') {
            resetJobEntryForm(false); // Clean form
            title.textContent = "Add New Job Entry";

            // Show Add, Hide Update/Delete
            addBtn.classList.remove('hidden');
            updateBtn.classList.add('hidden');
            deleteBtn.classList.add('hidden');
        }
        // 2. EDIT MODE
        else if (mode === 'Edit' && entryData) {
            currentlyEditingKey = entryData.key;
            title.textContent = "Edit Job Entry";

            // Hide Add, Show Update
            addBtn.classList.add('hidden');
            updateBtn.classList.remove('hidden');

            // Check permission for Delete button
            const userPositionLower = (currentApprover?.Position || '').toLowerCase();
            if (userPositionLower === 'accounting' && currentApprover.Name === 'Irwin') {
                deleteBtn.classList.remove('hidden');
            } else {
                deleteBtn.classList.add('hidden');
            }

            // Populate Form Data
            document.getElementById('job-for').value = entryData.for || 'Other';
            // Handle "Other" Input Visibility
            if (!['PR', 'Invoice', 'IPC', 'Payment', 'Report', 'Transfer', 'Restock', 'Return', 'Usage'].includes(entryData.for)) {
                document.getElementById('job-for').value = 'Other';
                document.getElementById('job-other-specify').value = entryData.for;
                document.getElementById('job-other-specify').classList.remove('hidden');
            } else {
                document.getElementById('job-other-specify').classList.add('hidden');
            }

            document.getElementById('job-ref').value = entryData.ref || '';
            document.getElementById('job-po').value = entryData.po || '';
            document.getElementById('job-amount').value = entryData.amount || '';
            document.getElementById('job-attachment').value = entryData.attachmentName || '';
            document.getElementById('job-group').value = entryData.group || '';
            document.getElementById('job-status').value = (entryData.remarks === 'Pending') ? '' : entryData.remarks || '';

            if (siteSelectChoices) siteSelectChoices.setChoiceByValue(entryData.site || '');
            if (attentionSelectChoices) attentionSelectChoices.setChoiceByValue(entryData.attention || '');
        }

        modal.classList.remove('hidden');
    };

    // B. CLOSE MODAL
    window.closeStandardJobModal = function () {
        document.getElementById('standard-job-modal').classList.add('hidden');
        // Optional: clear form on close
        resetJobEntryForm(false);
    };

    // ==========================================================================
    // NEW: SHOW JOB HISTORY (IPC, PR, etc.)
    // ==========================================================================
    window.showJobHistory = async function (key) {
    const modal = document.getElementById('history-modal');
    const loader = document.getElementById('history-modal-loader');
    const tbody = document.getElementById('history-table-body');

    if (modal) modal.classList.remove('hidden');
    if (loader) loader.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';

    try {
        // 1. Get the entry
        const snapshot = await db.ref(`job_entries/${key}`).once('value');
        const entry = snapshot.val();

        if (!entry) throw new Error("Entry not found");

        const historyData = [];

        // 2. Parse History (array or object)
        if (entry.history) {
            if (Array.isArray(entry.history)) {
                historyData.push(...entry.history);
            } else {
                Object.values(entry.history).forEach(h => historyData.push(h));
            }
        }

        if (historyData.length === 0) {
            if (loader) loader.classList.add('hidden');
            tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
            return;
        }

        // 3. Sort ASC (oldest -> newest) to calculate duration between changes
        historyData.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

        // 4. Calculate Duration Display (same as Invoice history)
        historyData.forEach((h, index) => {
            if (index === 0) {
                h.durationDisplay = '-';
            } else {
                const prevTs = Number(historyData[index - 1].timestamp) || 0;
                const currTs = Number(h.timestamp) || 0;
                const diffMs = Math.max(0, currTs - prevTs);

                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                if (diffDays > 0) h.durationDisplay = `${diffDays}d ${diffHrs}h`;
                else if (diffHrs > 0) h.durationDisplay = `${diffHrs}h ${diffMins}m`;
                else h.durationDisplay = `${diffMins}m`;
            }
        });

        // 5. Reverse back to DESC for display (newest first)
        historyData.reverse();

        if (loader) loader.classList.add('hidden');

        historyData.forEach((h) => {
            const dateObj = new Date(Number(h.timestamp) || Date.now());
            const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            const who = h.by || h.updatedBy || h.updatedByName || 'System';

            const row = `
                <tr>
                    <td><strong>${h.action || h.status || ''}</strong><br><small>${h.note || ''}</small></td>
                    <td>${dateStr}</td>
                    <td>${who}</td>
                    <td style="font-weight: bold; color: #00748C;">${h.durationDisplay || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        if (loader) loader.classList.add('hidden');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
};

// =========================================================
// 3. SMART STICKER POSITIONING (SAFE STRINGS FIX)
// =========================================================
window.handlePrintSticker = async function(key, type, poNumber) {
    if (!key || !poNumber) {
        alert("Missing data for print.");
        return;
    }
    var safePO = poNumber.replace(/[.#$[\]]/g, '_');
    var recordKey = safePO + "_" + key;

    try {
        if (!allApproverData) {
            var snap = await db.ref('approvers').once('value');
            allApproverData = snap.val();
        }

        var snap = await db.ref('manager_approved/' + recordKey).once('value');
        var data = snap.val();
        var rawStickers = [];

        if (data) {
            ['1', '2', '3', 'ceo'].forEach(function(slot) {
                if (data['esn_' + slot]) {
                    rawStickers.push({
                        esn: data['esn_' + slot],
                        pdf: data['pdf_' + slot],
                        approverName: data['approver_' + slot] || 'Unknown',
                        date: data['date_' + slot],
                        isCeo: (slot === 'ceo')
                    });
                }
            });
        } else {
            // Fallback for Admin manual print (if no approval record)
            var invSnap = await invoiceDb.ref('invoice_entries/' + poNumber + '/' + key).once('value');
            var inv = invSnap.val();
            if (inv && inv.esn) {
                var safeEsn = inv.esn.replace(/[^a-zA-Z0-9]/g, '_');
                rawStickers.push({
                    esn: inv.esn,
                    pdf: "https://firebasestorage.googleapis.com/v0/b/invoiceentry-b15a8.firebasestorage.app/o/receipts%2F" + safeEsn + ".pdf?alt=media",
                    approverName: 'Admin',
                    date: new Date().toLocaleDateString('en-GB')
                });
            }
        }

        if (rawStickers.length === 0) {
            alert("No approval stickers found.");
            return;
        }

        var middleZone = []; // Managers
        var ceoZone = [];    // CEO

        rawStickers.forEach(function(sticker) {
            if (sticker.isCeo) {
                ceoZone.push(sticker);
                return;
            }
            // Group everyone else (Managers/COO/Finance) into the main row
            middleZone.push(sticker);
        });

        var finalStickers = [];

        // --- 1. CEO POSITION (Always Top Right) ---
        ceoZone.forEach(function(s) {
            // "Top Right above the right spot"
            s.cssPosition = "bottom: 60mm; right: 15%; transform: translateX(50%);"; 
            s.displayName = "CEO APPROVED";
            finalStickers.push(s);
        });

        // --- 2. MANAGER SMART POSITIONING ---
        var midCount = middleZone.length;
        
        middleZone.forEach(function(s, i) {
            var leftPercent = 50; // Default fallback

            if (midCount === 1) {
                // 1 Signature: Fall to the Right Spot (not middle)
                leftPercent = 85; 
            } 
            else if (midCount === 2) {
                // 2 Signatures: 1st Middle, 2nd Right
                if (i === 0) leftPercent = 50;
                if (i === 1) leftPercent = 85;
            } 
            else if (midCount === 3) {
                // 3 Signatures: Left, Middle, Right
                if (i === 0) leftPercent = 15;
                if (i === 1) leftPercent = 50;
                if (i === 2) leftPercent = 85;
            } 
            else if (midCount === 4) {
                // 4 Signatures: Left, Share Middle (40,60), Right
                if (i === 0) leftPercent = 15;
                if (i === 1) leftPercent = 38;
                if (i === 2) leftPercent = 62;
                if (i === 3) leftPercent = 85;
            }
            else {
                // 5+ Signatures: Distribute evenly
                leftPercent = 15 + (i * (70 / (midCount - 1)));
            }

            s.cssPosition = "bottom: 20mm; left: " + leftPercent + "%; transform: translateX(-50%);";
            s.displayName = "APPROVED";
            finalStickers.push(s);
        });

        proceedToPrintMulti(finalStickers);

    } catch (e) {
        console.error("Print Error:", e);
        alert("Error loading print data.");
    }
};
// =========================================================
// 4. PRINT RENDERER (SAFE STRINGS FIX)
// =========================================================
function proceedToPrintMulti(stickerList) {
    var htmlStickers = "";
    stickerList.forEach(function(s) {
        htmlStickers += createStickerHTML(s, s.cssPosition);
    });

    var printWindow = window.open('', '', 'width=1000,height=1200');
    
    var content = '<html><head><title>Multi-Sticker Print</title>';
    content += '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>';
    content += '<style>@page { size: A4; margin: 0; } body { margin: 0; padding: 0; width: 210mm; height: 297mm; position: relative; font-family: "Arial", sans-serif; } ';
    content += '.sticker-box { position: absolute; width: auto; padding: 4px; display: flex; flex-direction: row; align-items: center; background: white; z-index: 100; } ';
    content += '.main { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-right: 5px; border-right: 1px solid #000; } ';
    content += '.status { font-weight: 900; font-size: 12px; text-transform: uppercase; margin-bottom: 2px; color: #28a745; text-align: center; white-space: nowrap; } ';
    content += '.esn { font-weight: bold; font-size: 8px; margin-top: 2px; font-family: monospace; white-space: nowrap; color: #000; text-align: center; } ';
    content += '.side { width: 12px; display: flex; align-items: center; justify-content: center; writing-mode: vertical-rl; text-orientation: mixed; font-weight: bold; font-size: 8px; margin-left: 4px; height: 80px; color: #555; } ';
    content += '.qr-target { width: 70px; height: 70px; display: flex; justify-content: center; }';
    content += '</style></head><body>';
    content += htmlStickers;
    content += '<script>var boxes = document.querySelectorAll(".sticker-box"); boxes.forEach(function(box) { var link = box.dataset.link; var container = box.querySelector(".qr-target"); new QRCode(container, { text: link, width: 70, height: 70, correctLevel: QRCode.CorrectLevel.M }); }); setTimeout(function() { window.print(); }, 800);<\/script>';
    content += '</body></html>';

    printWindow.document.write(content);
    printWindow.document.close();
}

function createStickerHTML(data, cssPosition) {
    var title = data.displayName || "APPROVED";
    return '<div class="sticker-box" style="' + cssPosition + '" data-link="' + data.pdf + '">' +
           '<div class="main"><div class="status">' + title + '</div><div class="qr-target"></div><div class="esn">' + data.esn + '</div></div>' +
           '<div class="side">' + data.date + '</div></div>';
}

// --- Helper to actually open the window ---
function proceedToPrint(positionClass, roleLabel, esnDisplay, pdfLink, entry) {
    const isRejected = (entry.remarks === 'Rejected' || entry.status === 'Rejected');
    const statusText = isRejected ? "REJECTED" : roleLabel;
    const statusColor = isRejected ? "#D32F2F" : "#28a745";
    const dateStr = new Date().toLocaleDateString('en-GB');

    const printWindow = window.open('', '', 'width=1000,height=1200');
    printWindow.document.write(`
        <html>
        <head>
            <title>Sticker Print - ${esnDisplay}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
            <style>
                @page { size: A4; margin: 0; }
                body { 
                    margin: 0; padding: 0; 
                    width: 210mm; height: 297mm; 
                    position: relative; 
                    font-family: 'Arial', sans-serif;
                }
                
                #sticker {
                    position: absolute;
                    width: auto;
                    padding: 5px;
                    display: flex;
                    flex-direction: row;
                    box-sizing: border-box;
                    align-items: center;
                    background: white; 
                    z-index: 100;
                }

                .pos-bottom-left { bottom: 20mm; left: 20mm; }
                .pos-bottom-right { bottom: 20mm; right: 20mm; }
                .pos-bottom-center { bottom: 20mm; left: 50%; transform: translateX(-50%); }
                .pos-ceo-stack { bottom: 55mm; right: 20mm; }

                .main { text-align: center; padding-right: 2px; }
                .status { font-weight: 900; font-size: 16px; text-transform: uppercase; margin-bottom: 2px; color: ${statusColor}; }
                .esn { font-weight: bold; font-size: 9px; margin-top: 5px; font-family: monospace; white-space: nowrap; color: #000; }
                .side {
                    width: 15px; display: flex; align-items: center; justify-content: center;
                    writing-mode: vertical-rl; text-orientation: mixed; font-weight: bold;
                    font-size: 9px; margin: 0; height: 90px;
                }
                #qrcode { margin: 2px auto; }
                #qrcode img { display: block; margin: 0 auto; }
            </style>
        </head>
        <body>
            <div id="sticker" class="${positionClass}">
                <div class="main">
                    <div class="status">${statusText}</div>
                    <div id="qrcode"></div>
                    <div class="esn">${esnDisplay}</div>
                </div>
                <div class="side">${dateStr}</div>
            </div>
            <script>
                new QRCode(document.getElementById("qrcode"), {
                    text: "${pdfLink}",
                    width: 90, height: 90, correctLevel: QRCode.CorrectLevel.M
                });
                setTimeout(() => { window.print(); }, 700);
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// =========================================================
// HELPER: Save Approval to History List
// =========================================================
async function saveApprovalToList(po, key, esn, name, role) {
    try {
        await invoiceDb.ref(`invoice_entries/${po}/${key}/approvals`).push({
            esn: esn,
            approver: name,
            role: role || 'Approver',
            date: new Date().toLocaleDateString('en-GB'),
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    } catch (e) {
        console.error("Failed to save approval list:", e);
    }
}

// =========================================================
// NEW: INVENTORY BUTTON LOGIC (SAFE MODE)
// =========================================================
const inventoryButton = document.getElementById('inventory-button');

// 1. Handle "Inventory" Click
if (inventoryButton) {
    inventoryButton.addEventListener('click', async () => {
        // --- 1. MOBILE GUARD ---
        if (window.innerWidth <= 768) {
            console.log("Mobile detected: Redirecting to Standard WorkDesk");
            workdeskButton.click(); 
            return; 
        }

        if (!currentApprover) { handleLogout(); return; }

        // --- 2. IMMEDIATE UI SWITCH (THE FIX) ---
        // A. Enter Inventory Mode styling
        document.body.classList.add('inventory-mode');

        // B. Update Sidebar Text
        const wdUser = document.getElementById('wd-username');
        const wdId = document.getElementById('wd-user-identifier');
        if(wdUser) wdUser.textContent = currentApprover.Name;
        if(wdId) wdId.textContent = "Inventory Access";

        // C. PRE-EMPTIVE SECTION SWAP (Crucial Step)
        // Immediately hide all sections and show only Material Stock
        // This prevents the Dashboard from flashing while data loads
        document.querySelectorAll('.workdesk-section').forEach(el => el.classList.add('hidden'));
        const stockSection = document.getElementById('wd-material-stock');
        if (stockSection) stockSection.classList.remove('hidden');

        // D. Update Active Nav Link Visually
        document.querySelectorAll('#workdesk-nav a').forEach(el => el.classList.remove('active'));
        const stockLink = document.querySelector('a[data-section="wd-material-stock"]');
        if (stockLink) stockLink.classList.add('active');

        // E. Show the Main View
        showView('workdesk');

        // --- 3. LOAD DATA (Happens while user sees the empty stock table) ---
        console.log("Loading Inventory Data...");
        
        // Show a loading state in the table if possible (optional but good UX)
        const stockTableBody = document.getElementById('ms-table-body');
        if(stockTableBody) stockTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Loading Inventory Data...</td></tr>';

        if (typeof ensureInvoiceDataFetched === 'function') await ensureInvoiceDataFetched(false); 
        if (typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(false);
        if (typeof ensureApproverDataCached === 'function') await ensureApproverDataCached();

        if (typeof populateSiteDropdown === 'function') await populateSiteDropdown();
        
        if (!attentionSelectChoices) {
             const dummyEl = document.createElement('select');
             const tempChoices = new Choices(dummyEl);
             if (typeof populateAttentionDropdown === 'function') await populateAttentionDropdown(tempChoices);
        } else {
             if (typeof populateAttentionDropdown === 'function') await populateAttentionDropdown(attentionSelectChoices);
        }

        // --- 4. POPULATE THE TABLE ---
        // Now that data is ready, run the logic to fill the table
        if (typeof showWorkdeskSection === 'function') {
            // Pass 'wd-material-stock' to trigger the specific logic for that section
            await showWorkdeskSection('wd-material-stock');
        }
    });
}

// 2. Handle "Back to Dashboard" (Cleanup)
document.querySelectorAll('.back-to-main-dashboard').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault(); // Stop default jump
        
        // Remove the special class so WorkDesk goes back to normal next time
        document.body.classList.remove('inventory-mode');
        
        // Return to dashboard
        showView('dashboard');
    });
});

// 3. Handle Logout (Cleanup)
const mainLogout = document.getElementById('wd-logout-button');
if(mainLogout) {
    mainLogout.addEventListener('click', () => {
        document.body.classList.remove('inventory-mode');
        handleLogout();
    });
}

// --- Invoice Modal Navigation Listeners ---
const imNavPrev = document.getElementById('im-nav-prev');
const imNavNext = document.getElementById('im-nav-next');

if (imNavPrev) {
    imNavPrev.addEventListener('click', (e) => {
        e.preventDefault(); 
        
        // CASE 1: We are on "New Entry" (index == length)
        // Click Prev -> Go to last item
        if (imNavigationIndex === imNavigationList.length) {
            const lastKey = imNavigationList[imNavigationList.length - 1];
            populateInvoiceFormForEditing(lastKey);
        }
        // CASE 2: We are in the middle of the list
        // Click Prev -> Go to previous item
        else if (imNavigationIndex > 0) {
            const prevKey = imNavigationList[imNavigationIndex - 1];
            populateInvoiceFormForEditing(prevKey);
        }
    });
}

if (imNavNext) {
    imNavNext.addEventListener('click', (e) => {
        e.preventDefault(); 
        
        // CASE 1: Normal Next
        if (imNavigationIndex < imNavigationList.length - 1) {
            const nextKey = imNavigationList[imNavigationIndex + 1];
            populateInvoiceFormForEditing(nextKey);
        }
        // CASE 2: We are on the LAST existing item
        // Click Next -> Go to "New Entry"
        else if (imNavigationIndex === imNavigationList.length - 1) {
            resetInvoiceForm();
        }
    });
}

// --- SMART AUTO-FILL LOGIC (Value <-> Paid) ---
    if (imInvValueInput && imAmountPaidInput) {
        
        // 1. Typing in "Invoice Value" copies to "Amount Paid"
        imInvValueInput.addEventListener('input', () => {
            const val = imInvValueInput.value;
            if (val.trim() !== "") {
                imAmountPaidInput.value = val;
            }
        });

        // 2. Typing in "Amount Paid" FIRST sets "Invoice Value" to 0
        imAmountPaidInput.addEventListener('input', () => {
            // Only set to 0 if Invoice Value is currently empty
            // This prevents accidental wiping of existing values
            if (imInvValueInput.value.trim() === "") {
                imInvValueInput.value = "0";
            }
        });
    }

// Desktop Manager Finalize Button Listener
    const desktopMgrBtn = document.getElementById('desktop-finalize-btn');
    if (desktopMgrBtn) {
        // Remove any existing listener just in case, then add the new one
        const newBtn = desktopMgrBtn.cloneNode(true);
        desktopMgrBtn.parentNode.replaceChild(newBtn, desktopMgrBtn);
        newBtn.addEventListener('click', previewAndSendManagerReceipt);
    }

// --- JOB RECORDS CLEAR BUTTON LOGIC (WIPE CLEAN) ---
    const jobRecordsClearBtn = document.getElementById('reporting-clear-button');
    const jobRecordsInput = document.getElementById('reporting-search');
    const jobRecordsBody = document.getElementById('reporting-table-body');
    const jobRecordsCount = document.getElementById('reporting-count-display');

    if (jobRecordsClearBtn) {
        jobRecordsClearBtn.addEventListener('click', () => {
            // 1. Clear Input
            if (jobRecordsInput) {
                jobRecordsInput.value = '';
                jobRecordsInput.focus();
            }
            
            // 2. Clear Memory
            sessionStorage.removeItem('reportingSearch');
            // IMPORTANT: Reset the filter so no tab is "active" logic-wise until clicked again
            // (Optional: You might want to keep the tab highlighted but show empty data. 
            //  If you want to un-highlight tabs, add: 
            //  document.querySelectorAll('#report-tabs button').forEach(b => b.classList.remove('active')); )

            // 3. WIPE TABLE CLEAN
            if (jobRecordsBody) {
                jobRecordsBody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:30px; color:#888;">List cleared. Select a Category above to view records.</td></tr>';
            }

            // 4. Reset Count
            if (jobRecordsCount) {
                jobRecordsCount.textContent = '';
            }
            
            // We DO NOT call handleReportingSearch() here, because that would reload data.
        });
    }

    // --- ACTIVE TASK CLEAR BUTTON LOGIC (WIPE CLEAN) ---
    const activeTaskClearBtn = document.getElementById('active-task-clear-button');
    const activeTaskInput = document.getElementById('active-task-search');
    const activeTaskBody = document.getElementById('active-task-table-body');
    // Note: activeTaskCountDisplay usually shows TOTAL tasks in the pool, not just visible ones. 
    // If you want to hide that too, uncomment the reset line below.

    if (activeTaskClearBtn) {
        activeTaskClearBtn.addEventListener('click', () => {
            // 1. Clear Input
            if (activeTaskInput) {
                activeTaskInput.value = '';
            }

            // 2. Clear Memory
            sessionStorage.removeItem('activeTaskSearch');

            // 3. WIPE TABLE CLEAN
            if (activeTaskBody) {
                activeTaskBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px; color:#888;">List cleared. Click a Status Tab above to view tasks.</td></tr>';
            }
            
            // Optional: Un-highlight tabs so user knows they need to click one
            const activeFilters = document.getElementById('active-task-filters');
            if (activeFilters) {
                activeFilters.querySelectorAll('.active').forEach(btn => btn.classList.remove('active'));
            }
        });
    }

// =========================================================
// NUCLEAR FIX: REPORT WORKFLOW + RECEIPT UPLOAD
// =========================================================
window.updateReportWorkflow = async function(po, key, status, user, nextAttention) {
    if (!po || !key) return;

    try {
        const reportKey = `${po}_${key}`.replace(/[.#$[\]]/g, '_');
        const reportRef = db.ref(`Reports/${reportKey}`);
        const now = new Date().toLocaleDateString('en-GB');

        const snapshot = await reportRef.once('value');
        let reportData = snapshot.val() || {};

        // 1. PREPARED BY
        if (status === 'Report Approval' && !reportData.prepared_by) {
            let baseESN = "RPT-" + Math.floor(1000 + Math.random() * 9000);
            if (typeof window.getNextSeriesNumber === 'function') baseESN = await window.getNextSeriesNumber();
            else if (typeof getNextSeriesNumber === 'function') baseESN = await getNextSeriesNumber();
            
            await reportRef.update({
                po: po,
                inv_key: key,
                esn_base: baseESN,
                prepared_by: { name: user.Name, date: now, esn_full: `${baseESN}/${user.Name.split(' ')[0].toUpperCase()}` }
            });
            console.log("Report: Prepared By recorded.");
        }

        // 2. SITE APPROVAL
        const isFinance = user.Position.toLowerCase().includes('finance');
        const isAccounting = user.Position.toLowerCase().includes('accounting') || user.Position.toLowerCase().includes('accounts');
        
        if (status === 'Report Approval' && !isFinance && !isAccounting && reportData.prepared_by) {
            if (!reportData.site_approval) {
                await reportRef.child('site_approval').set({
                    name: user.Name,
                    date: now,
                    esn_full: `${reportData.esn_base}/${user.Name.split(' ')[0].toUpperCase()}`
                });
                console.log("Report: Site Approval recorded.");
            }
        }

        // 3. FINANCE APPROVAL (WITH RECEIPT UPLOAD)
        if (isFinance && reportData.prepared_by) {
            const financeESN = `${reportData.esn_base}/${user.Name.split(' ')[0].toUpperCase()}`;
            
            // A. Prepare File Paths
            const safeFilename = financeESN.replace(/[^a-zA-Z0-9]/g, '_');
            const bucketName = "invoiceentry-b15a8.firebasestorage.app";
            const storagePath = `receipts/${safeFilename}.html`; // Changed to .html for easy viewing
            const publicLink = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;

            // B. Generate Digital Receipt Content (Simple HTML)
            const receiptContent = `
                <html>
                <head><title>Digital Receipt</title><style>body{font-family:sans-serif;padding:20px;text-align:center;border:5px solid #00748C;margin:10px;border-radius:10px;}h1{color:#00748C;}.valid{color:green;font-weight:bold;font-size:1.2em;}</style></head>
                <body>
                    <h1>OFFICIAL RECEIPT</h1>
                    <p><strong>PO Number:</strong> ${po}</p>
                    <p><strong>ESN:</strong> ${financeESN}</p>
                    <p><strong>Status:</strong> <span class="valid">APPROVED BY FINANCE</span></p>
                    <p><strong>Date:</strong> ${now}</p>
                    <p><strong>Approver:</strong> ${user.Name}</p>
                    <hr>
                    <small>Ismail Bin Ali Trading & Cont. Co. W.L.L</small>
                </body>
                </html>
            `;

            // C. Upload to Firebase Storage
            // Note: We use 'storage' variable which is initialized in your app.js for 'invoiceApp'
            try {
                const storageRef = storage.ref(storagePath);
                await storageRef.putString(receiptContent, 'raw', { contentType: 'text/html' });
                console.log("Report: Digital Receipt Uploaded.");
            } catch (uploadErr) {
                console.error("Receipt Upload Failed:", uploadErr);
                // We continue even if upload fails, just to save the data
            }

            // D. Save Database Record
            await reportRef.child('finance_approval').set({
                name: user.Name,
                date: now,
                esn_full: financeESN,
                qr_link: publicLink
            });
            console.log("Report: Finance Approval recorded.");
        }
    } catch (err) {
        console.error("Report Workflow Error:", err);
        alert("Database Error: " + err.message);
    }
};
console.log("✅ Report Workflow Loaded (With Receipt Upload)");

    // =========================================================
    // FIX: CLOUD UPLOAD BUTTONS (OPEN SHAREPOINT FOLDERS)
    // =========================================================

    // 1. Define the specific Folder URLs
    const INVOICE_FOLDER_URL = "https://ibaqatar-my.sharepoint.com/my?id=%2Fpersonal%2Fdc%5Fiba%5Fcom%5Fqa%2FDocuments%2FDC%20Files%2FINVOICE&viewid=9f9468fa%2D5716%2D4b2c%2D9740%2Df52d4616d6a8";
    const SRV_FOLDER_URL = "https://ibaqatar-my.sharepoint.com/my?id=%2Fpersonal%2Fdc%5Fiba%5Fcom%5Fqa%2FDocuments%2FDC%20Files%2FSRV&viewid=9f9468fa%2D5716%2D4b2c%2D9740%2Df52d4616d6a8";
    const URL_REPORT = "https://ibaqatar-my.sharepoint.com/my?id=%2Fpersonal%2Fdc%5Fiba%5Fcom%5Fqa%2FDocuments%2FDC%20Files%2FReport&viewid=9f9468fa%2D5716%2D4b2c%2D9740%2Df52d4616d6a8";
    
    // 2. Invoice Cloud Button Listener
    const btnInvoiceCloud = document.getElementById('im-btn-view-invoice'); 
    if (btnInvoiceCloud) {
        // Remove any old listeners by cloning (optional safety step)
        const newBtn = btnInvoiceCloud.cloneNode(true);
        btnInvoiceCloud.parentNode.replaceChild(newBtn, btnInvoiceCloud);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Simply open the folder
            window.open(INVOICE_FOLDER_URL, '_blank');
        });
    }

    // 3. SRV Cloud Button Listener
    const btnSRVCloud = document.getElementById('im-btn-view-srv'); 
    if (btnSRVCloud) {
        // Remove any old listeners by cloning
        const newBtn = btnSRVCloud.cloneNode(true);
        btnSRVCloud.parentNode.replaceChild(newBtn, btnSRVCloud);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Simply open the folder
            window.open(SRV_FOLDER_URL, '_blank');
        });
    }

// 4. Report Cloud Button Listener (NEW)
    const btnReportCloud = document.getElementById('btn-open-report-drive'); 
    if (btnReportCloud) {
        const newBtn = btnReportCloud.cloneNode(true);
        btnReportCloud.parentNode.replaceChild(newBtn, btnReportCloud);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(URL_REPORT, '_blank');
        });
    }

// =========================================================
// START: FINANCE BATCH & PRINT LOGIC (Paste in app.js)
// =========================================================

// --- 1. CONFIGURATION ---
const FINANCE_APPROVER_NAME = "Mostafa"; // The user who manages Finance
// NOTE: Ensure 'currentUser' variable is available globally in your app.js

// --- 2. LOGIC TO SHOW/HIDE BUTTONS ---
// Call this function whenever you open the dashboard or modal
function updateFinanceUI(invoice) {
    // A. Show Batch Button on Dashboard if user is Finance
    const batchDiv = document.getElementById('financeBatchControls');
    if (batchDiv) {
        // Adjust 'currentUser' variable name based on your existing app code
        // Assuming global variable 'currentUser' or similar exists
        if (typeof currentUser !== 'undefined' && (currentUser.name === FINANCE_APPROVER_NAME || currentUser.role === "Admin")) {
            batchDiv.style.display = "flex"; 
        } else {
            batchDiv.style.display = "none";
        }
    }

    // B. Show Print Button in Modal
    const printBtn = document.getElementById('btn-admin-print-finance');
    if (printBtn && invoice) {
        let isApproved = invoice.status === "Report Approved";
        let isFinance = (typeof currentUser !== 'undefined' && (currentUser.name === FINANCE_APPROVER_NAME || currentUser.role === "Admin"));
        
        // Only show if Approved AND User is Finance
        if (isApproved && isFinance) {
            printBtn.style.display = "block";
            // Optional: Disable if already printed and not Admin
            if (invoice.reportPrinted && currentUser.role !== "Admin") {
                printBtn.disabled = true;
                printBtn.title = "Report already printed (Locked)";
            } else {
                printBtn.disabled = false;
            }
        } else {
            printBtn.style.display = "none";
        }
    }
}

// --- 3. BATCH FINALIZATION FUNCTION ---
function finalizeApprovedBatch() {
    if (confirm("Are you sure you want to finalize all 'Report Approved' items? This will generate the official QR codes.")) {
        
        const batchID = "BATCH-" + new Date().getTime().toString().substr(-6);
        const batchDate = new Date().toLocaleDateString();
        const timestamp = new Date().getTime();

        // Query Firebase for items in Mostafa's queue that are "Report Approved"
        firebase.database().ref('invoices')
            .orderByChild('attention')
            .equalTo(FINANCE_APPROVER_NAME)
            .once('value')
            .then(snapshot => {
                let updates = {};
                let count = 0;

                snapshot.forEach(child => {
                    let inv = child.val();
                    // Check logic: Must be 'Report Approved' AND waiting for batch
                    // You might need to add a flag 'readyForBatch' during the approval step
                    // Or just trust the status "Report Approved"
                    if (inv.status === "Report Approved") {
                        
                        // 1. Generate the Finance Signature Block
                        updates[child.key + '/finance_approval'] = {
                            name: FINANCE_APPROVER_NAME,
                            date: batchDate,
                            timestamp: timestamp,
                            batchID: batchID, // THE SHARED ID
                            esn: batchID      // VISUAL ESN
                        };

                        // 2. Move Task Forward (e.g. back to Sender/Prepared By)
                        let sender = inv.prepared_by_name || "Sender";
                        updates[child.key + '/attention'] = sender;
                        
                        // 3. Update Status to indicate it's done
                        updates[child.key + '/status'] = "Report Approved"; // Stays approved
                        updates[child.key + '/readyForPrint'] = true; 

                        count++;
                    }
                });

                if (count > 0) {
                    firebase.database().ref('invoices').update(updates).then(() => {
                        alert(`Batch Finalized! ${count} invoices sealed.\nBatch ID: ${batchID}`);
                        // Reload your table function here if it exists (e.g., loadActiveTasks())
                        if (typeof loadActiveTasks === 'function') loadActiveTasks(); 
                    });
                } else {
                    alert("No 'Report Approved' items found in your queue.");
                }
            });
    }
}


// =========================================================
// FINANCE INPUT FORMATTERS (Commas)
// =========================================================
window.formatCurrencyField = function(input) {
    if (!input.value || input.value.trim() === '') return;
    // Remove existing commas to get raw number
    let raw = input.value.replace(/,/g, '');
    let num = parseFloat(raw);
    if (!isNaN(num)) {
        // Format with commas and 2 decimal places
        input.value = num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
};

window.cleanCurrencyField = function(input) {
    if (!input.value) return;
    // Remove commas so user can edit raw number
    input.value = input.value.replace(/,/g, '');
    // Select all text for easy overwriting
    input.select();
};

// =========================================================
// AUTO-GENERATE REPORT NAME (On "Report Approved")
// =========================================================
// Renamed variable to 'reportAutoSelect' to fix initialization error
const reportAutoSelect = document.getElementById('im-status');

if (reportAutoSelect) {
    reportAutoSelect.addEventListener('change', function() {
        // 1. Check if the status is the trigger status
        if (this.value === "Report Approved") {
            
            // 2. Get Data from the modal
            // Use safe selection with optional chaining in case elements are missing
            const poElement = document.querySelector('#im-invoice-entry-modal .im-po-no');
            const vendorElement = document.querySelector('#im-invoice-entry-modal .im-po-vendor');
            const entryIdElement = document.getElementById('im-inv-entry-id');

            if (!poElement || !vendorElement || !entryIdElement) return;

            const poText = poElement.textContent.trim();
            const vendorText = vendorElement.textContent.trim();
            const entryId = entryIdElement.value.trim();

            // 3. Validation
            if (poText === "---" || poText === "" || entryId === "") return;

            // 4. Truncate Vendor Name (Max 17 Chars)
            const shortVendor = truncateNameText(vendorText, 17);

            // 5. Construct the String: PO-EntryID-Vendor-Report
            const generatedName = `${poText}-${entryId}-${shortVendor}-Report`;

            // 6. Set the value
            const reportNameInput = document.getElementById('im-report-name');
            if (reportNameInput) {
                reportNameInput.value = generatedName;

                // Visual Flash
                reportNameInput.style.backgroundColor = "#ffffcc"; 
                setTimeout(() => {
                    reportNameInput.style.backgroundColor = ""; 
                }, 500);
            }
        }
    });
}


// ==========================================================================
// 22. FINANCE REPORT (READ-ONLY)
// ==========================================================================

function handleFinanceSearch() {
    const poNo = imFinanceSearchPoInput.value.trim();
    if (!poNo) {
        alert('Please enter a PO No. to search');
        return;
    }

    paymentDb.ref('payments').orderByChild('poNo').equalTo(poNo).once('value')
        .then(snapshot => {
            imFinanceResults.style.display = 'block';
            imFinanceResultsBody.innerHTML = '';

            if (!snapshot.exists()) {
                imFinanceNoResults.style.display = 'block';
                if (financeReportCountDisplay) financeReportCountDisplay.textContent = '';
            } else {
                imFinanceNoResults.style.display = 'none';
                imFinanceAllPaymentsData = {};
                snapshot.forEach(childSnapshot => {
                    imFinanceAllPaymentsData[childSnapshot.key] = {
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    };
                });
                const payments = Object.values(imFinanceAllPaymentsData);
                if (financeReportCountDisplay) {
                    financeReportCountDisplay.textContent = `(Total Payments Found: ${payments.length})`;
                }
                showFinanceSearchResults(payments);
            }
        })
        .catch(error => console.error('Error searching payments:', error));
}

function showFinanceSearchResults(payments) {
    imFinanceResultsBody.innerHTML = '';
    if (payments.length === 0) return;

    const firstPayment = payments[0];
    const {
        site,
        vendor,
        vendorId,
        poNo,
        poValue
    } = firstPayment;

    const summaryHtml = `
        <table class="po-summary-table">
            <thead>
                <tr>
                    <th>Site</th>
                    <th>Vendor</th>
                    <th>Vendor ID</th>
                    <th>PO No.</th>
                    <th>PO Value</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${site || ''}</td>
                    <td>${vendor || ''}</td>
                    <td>${vendorId || ''}</td>
                    <td>${poNo || ''}</td>
                    <td>${formatFinanceNumber(poValue) || ''}</td>
                </tr>
            </tbody>
        </table>
    `;

    let totalCertified = 0;
    let totalRetention = 0;
    let totalPayment = 0;

    const paymentRowsHtml = payments.map(payment => `
        <tr>
            <td>${formatFinanceDate(payment.dateEntered) || ''}</td>
            <td>${payment.paymentNo || ''}</td>
            <td>${payment.chequeNo || ''}</td>
            <td>${formatFinanceNumber(payment.certifiedAmount) || ''}</td>
            <td>${formatFinanceNumber(payment.retention) || ''}</td>
            <td>${formatFinanceNumber(payment.payment) || ''}</td>
            <td>${formatFinanceDate(payment.datePaid) || ''}</td>
            <td>
                <button class="btn btn-sm btn-info me-2" data-action="report" data-id="${payment.id}">Print Preview</button>
            </td>
        </tr>
    `).join('');

    payments.forEach(payment => {
        totalCertified += parseFloat(payment.certifiedAmount) || 0;
        totalRetention += parseFloat(payment.retention) || 0;
        totalPayment += parseFloat(payment.payment) || 0;
    });

    const footerHtml = `
        <tfoot style="background-color: #e9ecef; font-weight: bold;">
            <tr>
                <td colspan="3" style="text-align: right;">Total:</td>
                <td>${formatFinanceNumber(totalCertified)}</td>
                <td>${formatFinanceNumber(totalRetention)}</td>
                <td>${formatFinanceNumber(totalPayment)}</td>
                <td colspan="2"></td>
            </tr>
        </tfoot>
    `;

    const detailsHtml = `
        <div class="payment-details-wrapper">
            <h6 class="payment-details-header">Invoice Entries for PO ${poNo}</h6>
            <div class="table-responsive">
                <table class="table payment-details-table">
                    <thead>
                        <tr>
                            <th>Date Entered</th>
                            <th>Payment No.</th>
                            <th>Cheque No.</th>
                            <th>Certified Amount</th>
                            <th>Retention</th>
                            <th>Payment</th>
                            <th>Date Paid</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentRowsHtml}
                    </tbody>
                    ${footerHtml} </table>
            </div>
        </div>
    `;

    imFinanceResultsBody.innerHTML = summaryHtml + detailsHtml;
}

function handleFinanceActionClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    const payment = imFinanceAllPaymentsData[id];

    if (!action || !id || !payment) return;

    if (action === 'report') {
        generateFinanceReport(payment);
    }
}

function resetFinanceSearch() {
    imFinanceSearchPoInput.value = '';
    imFinanceResults.style.display = 'none';
    imFinanceNoResults.style.display = 'none';
    imFinanceResultsBody.innerHTML = '';
    imFinanceAllPaymentsData = {};
    if (financeReportCountDisplay) financeReportCountDisplay.textContent = '';
}

async function generateFinanceReport(selectedPayment) {
    const poNo = selectedPayment.poNo;
    if (!poNo) return;
    try {
        const snapshot = await paymentDb.ref('payments').orderByChild('poNo').equalTo(poNo).once('value');
        if (!snapshot.exists()) {
            alert('No payments found for this PO No.');
            return;
        }
        const payments = [];
        snapshot.forEach(childSnapshot => {
            payments.push(childSnapshot.val());
        });
        payments.sort((a, b) => {
            const aNum = parseInt(String(a.paymentNo).replace('PVN-', ''));
            const bNum = parseInt(String(b.paymentNo).replace('PVN-', ''));
            return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
        });
        let totalCertified = 0,
            totalRetention = 0,
            totalPayment = 0,
            totalPrevPayment = 0;
        let allNotes = [];

        payments.forEach(payment => {
            const certified = parseFloat(payment.certifiedAmount || 0);
            const retention = parseFloat(payment.retention || 0);
            const paymentAmount = parseFloat(payment.payment || 0);

            totalCertified += certified;
            totalRetention += retention;
            totalPayment += paymentAmount;

            if (payment.datePaid && String(payment.datePaid).trim() !== '') {
                totalPrevPayment += paymentAmount;
            }
            if (payment.note && String(payment.note).trim() !== '') {
                allNotes.push(`${String(payment.note).trim()}`);
            }
        });

        const totalCommitted = parseFloat(selectedPayment.poValue || 0) - totalCertified;
        imReportDate.textContent = formatFinanceDateLong(new Date().toISOString());
        imReportPoNo.textContent = poNo;
        imReportProject.textContent = selectedPayment.site || '';
        imReportVendorId.textContent = selectedPayment.vendorId || '';
        imReportVendorName.textContent = selectedPayment.vendor || '';
        imReportTotalPoValue.textContent = formatFinanceNumber(selectedPayment.poValue);
        imReportTotalCertified.textContent = formatFinanceNumber(totalCertified);
        imReportTotalPrevPayment.textContent = formatFinanceNumber(totalPrevPayment);
        imReportTotalCommitted.textContent = formatFinanceNumber(totalCommitted);
        imReportTotalRetention.textContent = formatFinanceNumber(totalRetention);

        imReportTableBody.innerHTML = '';
        payments.forEach(payment => {
            const row = document.createElement('tr');
            const pvn = payment.paymentNo ? String(payment.paymentNo).replace('PVN-', '') : '';
            row.innerHTML = `
                <td>${pvn}</td>
                <td>${payment.chequeNo || ''}</td>
                <td>${formatFinanceNumber(payment.certifiedAmount)}</td>
                <td>${formatFinanceNumber(payment.retention)}</td>
                <td>${formatFinanceNumber(payment.payment)}</td>
                <td>${payment.datePaid ? formatFinanceDate(payment.datePaid) : ''}</td>`;
            imReportTableBody.appendChild(row);
        });

        imReportTotalCertifiedAmount.textContent = formatFinanceNumber(totalCertified);
        imReportTotalRetentionAmount.textContent = formatFinanceNumber(totalRetention);
        imReportTotalPaymentAmount.textContent = formatFinanceNumber(totalPayment);

        if (allNotes.length > 0) {
            imReportNotesContent.textContent = allNotes.join('\n');
            imReportNotesSection.style.display = 'block';
        } else {
            imReportNotesContent.textContent = '';
            imReportNotesSection.style.display = 'none';
        }

        imFinanceReportModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error generating finance report:', error);
    }
}

// [RENAMED] This handles the Read-Only modal print
function printReadOnlyReport() {
    window.print();
}


// =========================================================
// NEW FUNCTION: Print Finance Summary (Read-Only Report)
// =========================================================
function printFinanceReadOnlyReport() {
    // 1. Gather Data from the Modal Elements
    // (We use the same IDs that 'generateFinanceReport' populates)
    const poNo = document.getElementById('im-report-po-no').textContent;
    const vendor = document.getElementById('im-report-vendor-name').textContent;
    const site = document.getElementById('im-report-project').textContent;
    const date = document.getElementById('im-report-date').textContent;
    const notes = document.getElementById('im-report-notes-content').textContent;

    // Get the table content
    const tableBody = document.getElementById('im-report-table-body').innerHTML;
    
    // Get Totals
    const totalCert = document.getElementById('im-report-total-certified-amount').textContent;
    const totalRet = document.getElementById('im-report-total-retention-amount').textContent;
    const totalPay = document.getElementById('im-report-total-payment-amount').textContent;

    // 2. Build the Print Window HTML
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Finance Report - ${poNo}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #00748C; padding-bottom: 10px; }
                .header h2 { margin: 0; color: #00748C; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; font-size: 14px; }
                .info-item label { font-weight: bold; color: #555; display: block; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
                th { background-color: #f8f9fa; border: 1px solid #ddd; padding: 8px; text-align: left; }
                td { border: 1px solid #ddd; padding: 8px; }
                
                .totals-section { float: right; width: 300px; }
                .total-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
                .total-row.final { font-weight: bold; border-top: 2px solid #333; border-bottom: none; font-size: 16px; margin-top: 10px; padding-top: 10px; }
                
                .notes-box { margin-top: 50px; padding: 10px; background: #f9f9f9; border: 1px solid #eee; font-style: italic; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Payment History Report</h2>
                <p>Generated on: ${date}</p>
            </div>

            <div class="info-grid">
                <div class="info-item"><label>PO Number:</label> ${poNo}</div>
                <div class="info-item"><label>Vendor:</label> ${vendor}</div>
                <div class="info-item"><label>Site / Project:</label> ${site}</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Payment No</th>
                        <th>Cheque No</th>
                        <th>Certified</th>
                        <th>Retention</th>
                        <th>Payment</th>
                        <th>Date Paid</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableBody}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="total-row"><span>Total Certified:</span> <span>${totalCert}</span></div>
                <div class="total-row"><span>Total Retention:</span> <span>${totalRet}</span></div>
                <div class="total-row final"><span>Total Paid:</span> <span>${totalPay}</span></div>
            </div>

            ${notes ? `<div class="notes-box"><strong>Notes:</strong><br>${notes}</div>` : ''}

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}




// --- 4. PRINT REPORT FUNCTION (COMPLEX QR/STICKER) ---
// This handles the Sticker print from the main list
function printFinanceReport() {
    // Get the key from your modal's hidden input
    const keyElement = document.getElementById('modify-task-key');
    if (!keyElement) {
        // If this element doesn't exist, we might be in the read-only modal by mistake.
        // Fallback to simple print.
        window.print();
        return;
    }
    const key = keyElement.value;
    
    if (!key) { 
        // If no key found, fallback
        window.print(); 
        return;
    }
    
    firebase.database().ref('invoices/' + key).once('value').then(snapshot => {
        let inv = snapshot.val();
        
        if (!inv.finance_approval || !inv.finance_approval.batchID) {
            alert("Error: This report has not been finalized by Finance yet.");
            return;
        }

        // --- PREPARE DATA ---
        let prepLine = `${inv.date || ''} / ${inv.prepared_by_name || 'Sender'}`;
        
        // Site Manager: Date / ESN / Name
        let siteData = inv.site_approval || {};
        let siteLine = siteData.name ? `${siteData.date} / ${siteData.esn || ''} / ${siteData.name}` : "";

        // Finance: Date / ESN / Name
        let finData = inv.finance_approval || {};
        let finLine = finData.name ? `${finData.date} / ${finData.batchID} / ${finData.name}` : "";
        
        // QR Code Logic (Using Batch ID)
        let qrData = encodeURIComponent(finData.batchID);
        let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;
        let financeQRBlock = `<img src="${qrUrl}" style="width:70px; height:70px; display:block; margin: 0 auto 5px auto;">`;

        // --- OPEN PRINT WINDOW ---
        let printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Finance Report ${inv.po_number || ''}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .header { text-align: center; margin-bottom: 40px; }
                    .sig-container { display: flex; justify-content: space-between; margin-top: 100px; }
                    .sig-box { width: 30%; text-align: center; position: relative; }
                    .line { border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; font-size: 12px; }
                    .role-title { font-weight: bold; margin-top: 5px; }
                    .qr-holder { height: 75px; display: flex; align-items: flex-end; justify-content: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Financial Report Approval</h2>
                    <p>PO: ${inv.po_number || 'N/A'} | Vendor: ${inv.vendor_name || 'N/A'}</p>
                </div>
                
                <div style="margin-bottom: 50px;">
                    <p><strong>Status:</strong> ${inv.status}</p>
                    <p><strong>Amount:</strong> ${inv.invoice_amount || inv.amount || '0.00'}</p>
                </div>

                <div class="sig-container">
                    
                    <div class="sig-box">
                        <div class="qr-holder"></div>
                        <div class="line">${prepLine}</div>
                        <div class="role-title">Prepared By</div>
                    </div>

                    <div class="sig-box">
                        <div class="qr-holder"></div>
                        <div class="line">${siteLine}</div>
                        <div class="role-title">Site Approval</div>
                    </div>

                    <div class="sig-box">
                        <div class="qr-holder">${financeQRBlock}</div>
                        <div class="line">${finLine}</div>
                        <div class="role-title">Finance</div>
                    </div>

                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        // Lock the report
        if (currentUser.role !== "Admin") {
            firebase.database().ref('invoices/' + key).update({ reportPrinted: true });
        }
    });
}

    
// ==========================================================================
// MASTER EXPORT SECTION: 1-Hour & Special Reports
// ==========================================================================

// 1. DAILY ENTRY REPORT (Last 2 Hours)
async function handleDownloadDailyReport() {
    const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    const isSuperAdminDelegate = isVacationDelegateUser();
    if (!(isSuperAdmin || isSuperAdminDelegate)) {
        alert("You do not have permission to download this report.");
        return;
    }

    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

    try {
        await ensureInvoiceDataFetched(true);

        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for report.");

        let recentEntries = [];

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];

                // Normalize Event Timestamp (prefer status/update time; fallback to created time)
                let eventTime = inv.updatedAt || inv.enteredAt || inv.createdAt || inv.timestamp || 0;
                if (typeof eventTime === 'string') eventTime = new Date(eventTime).getTime();

                // Only include invoices that are Under Review in the last 2 hours
                const statusStr = (inv.status || '').toString().trim().toLowerCase();
                if (statusStr === 'under review' && (eventTime > twoHoursAgo)) {
                    recentEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?.['Project ID'] || 'N/A',
                        ...inv,
                        sortTime: eventTime
                    });
                }
            }
        }

        if (recentEntries.length === 0) {
            alert("No 'Under Review' invoices found in the last 2 hours.");
            return;
        }

        recentEntries.sort((a, b) => a.sortTime - b.sortTime);

        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Time", "PO", "Site", "Inv No", "Inv Name", "Inv Amount", "Amount Paid", "Status"];
        csvContent += headers.join(",") + "\r\n";

        recentEntries.forEach(entry => {
            let timeString = '';
            if (entry.sortTime) {
                const dateObj = new Date(entry.sortTime);
                if (!isNaN(dateObj.getTime())) {
                    timeString = dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }

            const row = [
                timeString,
                entry.po,
                entry.site,
                `"${(entry.invNumber || '').replace(/"/g, '""')}"`,
                `"${(entry.invName || '').replace(/"/g, '""')}"`,
                entry.invValue || '0',
                entry.amountPaid || '0',
                entry.status || ''
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `entry_report_last_2hrs_${timestampStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating report:", error);
        alert("An error occurred while generating the report.");
    }
}

// 2. WITH ACCOUNTS REPORT (Last 2 Hours)
async function handleDownloadWithAccountsReport() {
    const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    const isSuperAdminDelegate = isVacationDelegateUser();
    if (!(isSuperAdmin || isSuperAdminDelegate)) {
        alert("You do not have permission to download this report.");
        return;
    }


    // Setup Time Checker (Last 2 Hours)
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

    try {
        await ensureInvoiceDataFetched(true);

        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for report.");

        let recentEntries = [];

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];

                // Normalize Event Timestamp (prefer status/update time; fallback to created time)
                let eventTime = inv.updatedAt || inv.enteredAt || inv.createdAt || inv.timestamp || 0;
                if (typeof eventTime === 'string') eventTime = new Date(eventTime).getTime();

                // Only include if status is correct AND in the last 2 hours
                const statusStr = (inv.status || '').toString().trim().toLowerCase();
                if (statusStr === 'with accounts' && (eventTime > twoHoursAgo)) {
                    recentEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?.['Project ID'] || 'N/A',
                        ...inv,
                        sortTime: eventTime
                    });
                }
            }
        }

        if (recentEntries.length === 0) {
            alert("No 'With Accounts' invoices found in the last 2 hours.");
            return;
        }

        // Sort Ascending
        recentEntries.sort((a, b) => a.sortTime - b.sortTime);

        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Time", "PO", "Site", "Inv No", "SRV Name", "Inv Amount", "Amount Paid", "Status"];
        csvContent += headers.join(",") + "\r\n";

        recentEntries.forEach(entry => {
            let timeString = '';
            if (entry.sortTime) {
                const dateObj = new Date(entry.sortTime);
                if (!isNaN(dateObj.getTime())) {
                    timeString = dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }

            const row = [
                timeString,
                entry.po,
                entry.site,
                `"${(entry.invNumber || '').replace(/"/g, '""')}"`,
                `"${(entry.srvName || '').replace(/"/g, '""')}"`,
                entry.invValue || '0',
                entry.amountPaid || '0',
                entry.status || ''
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `with_accounts_report_${timestampStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating report:", error);
        alert("An error occurred while generating the report.");
    }
}

// 3. REPORT APPROVED EXPORT (Includes "Report Name")
// Logic: Last 2 Hours Only
window.downloadReportingTableToExcel = async function() {
    const btn = document.getElementById('im-reporting-download-btn');
    const originalText = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Checking recent...';
        btn.disabled = true;
    }

    try {
        const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
        const isSuperAdminDelegate = isVacationDelegateUser();
        if (!(isSuperAdmin || isSuperAdminDelegate)) {
            alert("You do not have permission to download this report.");
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        // 1. Time Filter: Last 2 Hours
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - TWO_HOURS_MS;

        // 2. Database Connection
        let targetDb = (typeof invoiceDb !== 'undefined') ? invoiceDb : firebase.database();

        // 3. Fetch Data
        const snapshot = await targetDb.ref('invoice_entries').once('value');
        
        if (!snapshot.exists()) {
            alert("No records found.");
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        // HEADER: Added "Report Name"
        csvContent += "Time,PO,Site,Inv No,Report Name,Inv Amount,Amount Paid,Status\n";

        let count = 0;
        
        snapshot.forEach(poSnap => {
            const poNumber = poSnap.key;
            if (poSnap.hasChildren() && typeof poSnap.val() === 'object') {
                poSnap.forEach(invSnap => {
                    const inv = invSnap.val();
                    if (!inv || typeof inv !== 'object') return;
                    
                    // --- FILTER 1: STATUS 'Report Approved' ---
                    if (inv.status !== 'Report Approved') return;

                    // --- FILTER 2: TIME (Last 2 Hours) ---
                    // Normalize to milliseconds since epoch (handles ISO strings and seconds timestamps)
                    let itemTime = inv.updatedAt || inv.enteredAt || inv.timestamp || 0;
                    if (typeof itemTime === 'string') {
                        const parsed = Date.parse(itemTime);
                        itemTime = isNaN(parsed) ? (parseInt(itemTime, 10) || 0) : parsed;
                    }
                    if (typeof itemTime === 'number' && itemTime > 0 && itemTime < 1e12) {
                        // likely seconds
                        itemTime = itemTime * 1000;
                    }
                    if (itemTime < cutoffTime) return; // Skip old items
                    
                    // --- DATA MAPPING ---
                    const time = (inv.invoiceDate || inv.date || '').substring(0, 10);
                    const site = (inv.site_name || inv.site || '').replace(/"/g, '""');
                    const invNo = (inv.invNumber || inv.invoice_number || '').replace(/"/g, '""');
                    
                    // THE NEW COLUMN
                    const reportName = (inv.reportName || '').replace(/"/g, '""');
                    
                    const invAmount = (inv.invValue || inv.amount || '0').toString().replace(/,/g, '');
                    const amountPaid = (inv.amountPaid || '0').toString().replace(/,/g, '');
                    const status = inv.status;

                    const row = `"${time}","${poNumber}","${site}","${invNo}","${reportName}","${invAmount}","${amountPaid}","${status}"`;
                    csvContent += row + "\n";
                    count++;
                });
            }
        });

        if (count === 0) {
            alert("No 'Report Approved' records found from the last 2 hours.");
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        // 4. Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `Invoice_Report_Approved_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Export Error:", error);
        alert("An error occurred. See console.");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};
    
// ==========================================================================
// MISSING FUNCTION: Handle Print for Job Records
// ==========================================================================
function handlePrintReportingTable() {
    // 1. Get the table rows from the Job Records table
    const tableBody = document.getElementById('wd-jobentry-table').querySelector('tbody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));

    if (rows.length === 0 || rows[0].innerText.includes('No entries')) {
        alert("No records to print.");
        return;
    }

    // 2. Build the Print Window Content
    let printHtml = `
        <html>
        <head>
            <title>Job Records Report</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
                h2 { text-align: center; color: #003A5C; margin-bottom: 5px; }
                p.date { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { background-color: #003A5C; color: white; padding: 6px; text-align: left; }
                td { border: 1px solid #ddd; padding: 5px; color: #333; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .status-approved { color: #28a745; font-weight: bold; }
                .status-rejected { color: #dc3545; font-weight: bold; }
                .status-pending { color: #ffc107; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>Job Records Report</h2>
            <p class="date">Generated on: ${new Date().toLocaleString()}</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Job</th>
                        <th>Ref</th>
                        <th>PO</th>
                        <th>Vendor</th>
                        <th>Amount</th>
                        <th>Site</th>
                        <th>Note</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // 3. Loop through rows and extract text
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length < 8) return; // Skip malformed rows

        // Note: We skip the last "Action" column (index 9)
        printHtml += `
            <tr>
                <td>${cols[0]?.innerText || ''}</td> <td>${cols[1]?.innerText || ''}</td> <td>${cols[2]?.innerText || ''}</td> <td>${cols[3]?.innerText || ''}</td> <td>${cols[4]?.innerText || ''}</td> <td>${cols[5]?.innerText || ''}</td> <td>${cols[6]?.innerText || ''}</td> <td>${cols[7]?.innerText || ''}</td> <td>${cols[8]?.innerHTML || ''}</td> </tr>
        `;
    });

    printHtml += `
                </tbody>
            </table>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    // 4. Open Print Window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
    } else {
        alert("Pop-up blocked. Please allow pop-ups to print.");
    }
}

// ==========================================
// [NEW] DELETE INVOICE HANDLER (UI-INSTANT + SAFE CACHE CLEANUP)
// ==========================================
const imDeleteInvoiceBtn = document.getElementById('im-delete-invoice-btn');
if (imDeleteInvoiceBtn) {
    imDeleteInvoiceBtn.addEventListener('click', async () => {
        if (!currentPO || !currentlyEditingInvoiceKey) {
            alert("Error: No invoice selected to delete.");
            return;
        }

        // --- SECURITY UPDATE: Strict check for "Irwin" ---
        if (currentApprover?.Name !== 'Irwin') {
            alert("Access Denied: Only the original Administrator (Irwin) can delete invoices.");
            return;
        }
        // ------------------------------------------------

        if (!confirm("⚠️ ARE YOU SURE?\n\nThis will permanently delete this invoice entry.\nThis action cannot be undone.")) {
            return;
        }

        const keyToDelete = currentlyEditingInvoiceKey;
        const invoiceToDelete =
            (currentPOInvoices && currentPOInvoices[keyToDelete]) ||
            (allInvoiceData && allInvoiceData[currentPO] && allInvoiceData[currentPO][keyToDelete]) ||
            null;

        try {
            // 1) Delete from main invoice entries
            await invoiceDb.ref(`invoice_entries/${currentPO}/${keyToDelete}`).remove();

            // 2) Remove from task lookups (if it was assigned anywhere)
            try {
                if (typeof removeInvoiceTaskFromUser === 'function' && invoiceToDelete) {
                    await removeInvoiceTaskFromUser(keyToDelete, invoiceToDelete);
                }
            } catch (taskErr) {
                console.warn("Invoice deleted but task lookup cleanup failed:", taskErr);
            }

            // 3) Local cache + UI cleanup so it disappears immediately (no manual refresh needed)
            removeFromLocalInvoiceCache(currentPO, keyToDelete);
            try { if (currentPOInvoices && currentPOInvoices[keyToDelete]) delete currentPOInvoices[keyToDelete]; } catch (_) { /* ignore */ }

            // Keep navigation list consistent
            try {
                if (Array.isArray(imNavigationList)) {
                    imNavigationList = imNavigationList.filter(k => k !== keyToDelete);
                    if (imNavigationIndex >= imNavigationList.length) imNavigationIndex = imNavigationList.length - 1;
                }
            } catch (_) { /* ignore */ }

            alert("Invoice deleted successfully.");

            // Close modal
            const modal = document.getElementById('im-new-invoice-modal');
            if (modal) modal.classList.add('hidden');

            // Refresh table from memory (already updated)
            fetchAndDisplayInvoices(currentPO);

            // Reset global variable
            currentlyEditingInvoiceKey = null;

        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete invoice. Please try again.");
        }
    });
}

// ==========================================================================
// SMART SYNC / SMART REFRESH REMOVED
// - Buttons removed from UI.
// - Background listeners removed.
// - These stubs remain only to avoid runtime errors in older flows.
// ==========================================================================

// No-op: older code paths may still call this.
async function logRecentUpdate(_poNumber) { return; }

// No-op: kept for backward compatibility (UI button removed).
window.refreshRecentData = async function(_hoursBack = 4, _options = {}) {
    return { changed: false, updatedPOs: [], removed: true };
};

// No-op: background smart sync removed.
window.startInvoiceSmartLiveSync = function startInvoiceSmartLiveSync() { return; };
window.stopInvoiceSmartLiveSync = function stopInvoiceSmartLiveSync() { return; };




// =========================================================
// INVOICE RECORDS: PROFESSIONAL PREVIEW & PRINT (IM-REPORTING)
// =========================================================

/**
 * Keeps the report markup + CSS in one place so the Preview and Print output are identical.
 * This ONLY affects the Invoice Records print preview/modal flow.
 */
const IM_INVOICE_REPORT_PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: Arial, sans-serif; font-size: 11px; }

  .im-invoice-report { width: 100%; }
  .im-invoice-report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    gap: 16px;
  }
  .im-invoice-report-company {
    font-size: 14pt;
    font-weight: 800;
    margin: 0;
    line-height: 1.15;
  }
  .im-invoice-report-title { text-align: right; }
  .im-invoice-report-title h2 { font-size: 18pt; margin: 0 0 4px 0; }
  .im-invoice-report-title p { font-size: 10pt; margin: 0; color: #333; }

  .im-invoice-report-summary {
    margin: 16px 0 18px;
    background: #eef3f6;
    border: 1px solid #cfd8e3;
    border-radius: 6px;
    padding: 12px 12px 14px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .im-invoice-report-summary h3 {
    margin: 0 0 12px 0;
    text-align: center;
    font-size: 12pt;
    border-bottom: 1px solid #c8d2de;
    padding-bottom: 8px;
  }
  .im-invoice-report-summary-grid {
    display: flex;
    justify-content: space-around;
    gap: 12px;
    align-items: center;
  }
  .im-invoice-report-summary-item { flex: 1; text-align: center; }
  .im-invoice-report-summary-item span { display: block; font-size: 10pt; color: #222; margin-bottom: 4px; }
  .im-invoice-report-summary-item strong { display: block; font-size: 14pt; }

  .im-invoice-po {
    border: 1px solid #b5b5b5;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 14px;
    page-break-inside: auto;
  }
  .im-invoice-po-header {
    background: #003A5C;
    color: #fff;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 1fr 1fr 1.6fr;
    grid-template-rows: auto auto;
    gap: 6px 18px;
    font-size: 10pt;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .im-invoice-po-header .poValue { text-align: right; }
  .im-invoice-po-header .vendor { grid-column: 1 / span 2; }
  .im-invoice-po-header .balance { text-align: right; }

  table.im-invoice-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  table.im-invoice-table thead { display: table-header-group; }
  table.im-invoice-table tfoot { display: table-footer-group; }
  table.im-invoice-table th,
  table.im-invoice-table td {
    border: 1px solid #cfcfcf;
    padding: 6px 6px;
    vertical-align: top;
  }
  table.im-invoice-table th {
    background: #e9ecef;
    font-weight: 800;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  table.im-invoice-table tbody tr:nth-child(even) td {
    background: #f9f9f9;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  table.im-invoice-table td.num,
  table.im-invoice-table th.num {
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    white-space: nowrap;
  }
  table.im-invoice-table td.date,
  table.im-invoice-table td.status { white-space: nowrap; }
  table.im-invoice-table td.note { word-break: break-word; }
  table.im-invoice-table tr { page-break-inside: avoid; }

  table.im-invoice-table tfoot td {
    border-top: 2px solid #000;
    font-weight: 800;
    background: #fff;
  }
  table.im-invoice-table tfoot td.label { text-align: right; }

  /* Safety: make sure UI controls never appear in print */
  button, input, select, .expand-btn, .action-btn { display: none !important; }
`;

const IM_INVOICE_REPORT_PREVIEW_CSS = `
  /* Scoped to the preview container so it never affects the rest of the app */
  #im-print-modal-body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
  #im-print-modal-body .im-invoice-report { width: 100%; }
  #im-print-modal-body .im-invoice-report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    gap: 16px;
  }
  #im-print-modal-body .im-invoice-report-company {
    font-size: 14pt;
    font-weight: 800;
    margin: 0;
    line-height: 1.15;
  }
  #im-print-modal-body .im-invoice-report-title { text-align: right; }
  #im-print-modal-body .im-invoice-report-title h2 { font-size: 18pt; margin: 0 0 4px 0; }
  #im-print-modal-body .im-invoice-report-title p { font-size: 10pt; margin: 0; color: #333; }

  #im-print-modal-body .im-invoice-report-summary {
    margin: 16px 0 18px;
    background: #eef3f6;
    border: 1px solid #cfd8e3;
    border-radius: 6px;
    padding: 12px 12px 14px;
  }
  #im-print-modal-body .im-invoice-report-summary h3 {
    margin: 0 0 12px 0;
    text-align: center;
    font-size: 12pt;
    border-bottom: 1px solid #c8d2de;
    padding-bottom: 8px;
  }
  #im-print-modal-body .im-invoice-report-summary-grid {
    display: flex;
    justify-content: space-around;
    gap: 12px;
    align-items: center;
  }
  #im-print-modal-body .im-invoice-report-summary-item { flex: 1; text-align: center; }
  #im-print-modal-body .im-invoice-report-summary-item span { display: block; font-size: 10pt; color: #222; margin-bottom: 4px; }
  #im-print-modal-body .im-invoice-report-summary-item strong { display: block; font-size: 14pt; }

  #im-print-modal-body .im-invoice-po {
    border: 1px solid #b5b5b5;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 14px;
  }
  #im-print-modal-body .im-invoice-po-header {
    background: #003A5C;
    color: #fff;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 1fr 1fr 1.6fr;
    grid-template-rows: auto auto;
    gap: 6px 18px;
    font-size: 10pt;
  }
  #im-print-modal-body .im-invoice-po-header .poValue { text-align: right; }
  #im-print-modal-body .im-invoice-po-header .vendor { grid-column: 1 / span 2; }
  #im-print-modal-body .im-invoice-po-header .balance { text-align: right; }

  #im-print-modal-body table.im-invoice-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  #im-print-modal-body table.im-invoice-table th,
  #im-print-modal-body table.im-invoice-table td {
    border: 1px solid #cfcfcf;
    padding: 6px 6px;
    vertical-align: top;
  }
  #im-print-modal-body table.im-invoice-table th {
    background: #e9ecef;
    font-weight: 800;
  }
  #im-print-modal-body table.im-invoice-table tbody tr:nth-child(even) td { background: #f9f9f9; }
  #im-print-modal-body table.im-invoice-table td.num,
  #im-print-modal-body table.im-invoice-table th.num {
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    white-space: nowrap;
  }
  #im-print-modal-body table.im-invoice-table td.date,
  #im-print-modal-body table.im-invoice-table td.status { white-space: nowrap; }
  #im-print-modal-body table.im-invoice-table td.note { word-break: break-word; }

  #im-print-modal-body table.im-invoice-table tfoot td {
    border-top: 2px solid #000;
    font-weight: 800;
    background: #fff;
  }
  #im-print-modal-body table.im-invoice-table tfoot td.label { text-align: right; }
`;

// Cache the last generated report so "Print Now" always prints what the user previewed.
window.__imInvoiceReportCache = window.__imInvoiceReportCache || { css: IM_INVOICE_REPORT_PRINT_CSS, html: '' };

function imEscapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function imGetInvoiceReportTitle() {
    // Match the legacy format used in the older PDF sample.
    return 'Invoice Records';
}

function imBuildInvoiceRecordsReportMarkup(reportData, { title, generatedOn } = {}) {
    const safeTitle = imEscapeHtml(title || 'Invoice Records');
    const generatedStr = imEscapeHtml(generatedOn || `Generated on: ${new Date().toLocaleString('en-GB')}`);

    // Totals (match the sample layout: PO Value vs Invoice Value => Balance)
    let totalPOs = reportData.length;
    let totalPOValue = 0;
    let totalInvoiceValue = 0;

    reportData.forEach(po => {
        totalPOValue += parseFloat(po?.poDetails?.Amount) || 0;
        (po?.filteredInvoices || []).forEach(inv => {
            totalInvoiceValue += parseFloat(inv?.invValue) || 0;
        });
    });

    const totalBalance = totalPOValue - totalInvoiceValue;

    let poBlocks = '';
    reportData.forEach(po => {
        const poNumber = imEscapeHtml(po?.poNumber || '');
        const site = imEscapeHtml(po?.site || '');
        const vendor = imEscapeHtml(po?.vendor || '');
        const poValueNum = parseFloat(po?.poDetails?.Amount) || 0;

        let poInvTotal = 0;
        let poPaidTotal = 0;

        let rows = '';
        (po?.filteredInvoices || []).forEach(inv => {
            const invEntry = imEscapeHtml(inv?.invEntryID || '');
            const invNo = imEscapeHtml(inv?.invNumber || '');
            const invValueNum = parseFloat(inv?.invValue) || 0;
            const amtPaidNum = parseFloat(inv?.amountPaid) || 0;
            const status = imEscapeHtml(inv?.status || '');
            const note = imEscapeHtml(inv?.note || '');

            poInvTotal += invValueNum;
            poPaidTotal += amtPaidNum;

            const releaseDateDisplay = inv?.releaseDate
                ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB')
                : '';
            const invoiceDateDisplay = inv?.invoiceDate
                ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB')
                : '';

            rows += `
              <tr>
                <td>${invEntry}</td>
                <td>${invNo}</td>
                <td class="date">${invoiceDateDisplay}</td>
                <td class="num">${formatCurrency(invValueNum)}</td>
                <td class="num">${formatCurrency(amtPaidNum)}</td>
                <td class="date">${releaseDateDisplay}</td>
                <td class="status">${status}</td>
                <td class="note">${note}</td>
              </tr>
            `;
        });

        const balanceNum = poValueNum - poInvTotal;

        poBlocks += `
          <div class="im-invoice-po">
            <div class="im-invoice-po-header">
              <div class="poNumber"><strong>PO:</strong> ${poNumber}</div>
              <div class="site"><strong>Site:</strong> ${site}</div>
              <div class="poValue"><strong>PO Value:</strong> QAR ${formatCurrency(poValueNum)}</div>

              <div class="vendor"><strong>Vendor:</strong> ${vendor}</div>
              <div class="balance"><strong>Balance:</strong> QAR ${formatCurrency(balanceNum)}</div>
            </div>

            <table class="im-invoice-table">
              <thead>
                <tr>
                  <th>Inv. Entry</th>
                  <th>Inv. No.</th>
                  <th class="date">Inv. Date</th>
                  <th class="num">Inv. Value</th>
                  <th class="num">Amt. Paid</th>
                  <th class="date">Release Date</th>
                  <th class="status">Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" class="label">PO Invoice Totals:</td>
                  <td class="num">${formatCurrency(poInvTotal)}</td>
                  <td class="num">${formatCurrency(poPaidTotal)}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
    });

    return `
      <div class="im-invoice-report">
        <div class="im-invoice-report-header">
          <h1 class="im-invoice-report-company">ISMAIL BIN ALI TRADING &amp; CONT. CO. W.L.L</h1>
          <div class="im-invoice-report-title">
            <h2>${safeTitle}</h2>
            <p>${generatedStr}</p>
          </div>
        </div>

        <div class="im-invoice-report-summary">
          <h3>Report Summary</h3>
          <div class="im-invoice-report-summary-grid">
            <div class="im-invoice-report-summary-item">
              <span>Total POs in Report</span>
              <strong>${totalPOs}</strong>
            </div>
            <div class="im-invoice-report-summary-item">
              <span>Total PO Value</span>
              <strong>QAR ${formatCurrency(totalPOValue)}</strong>
            </div>
            <div class="im-invoice-report-summary-item">
              <span>Total Balance</span>
              <strong>QAR ${formatCurrency(totalBalance)}</strong>
            </div>
          </div>
        </div>

        ${poBlocks}
      </div>
    `;
}

// 1) OPEN PREVIEW (Professional report preview in the modal)
window.openInvoicePrintPreview = function() {
    const modal = document.getElementById('im-invoice-print-modal');
    if (!modal) { alert('Error: Print Modal not found in HTML.'); return; }

    // Keep the existing "blank page" fix (modal must live under <body>)
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    if (!Array.isArray(currentReportData) || currentReportData.length === 0) {
        alert('No data to preview. Please run a search first.');
        return;
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAdmin && !isAccounting) {
        alert('You do not have permission to print this report.');
        return;
    }

    const modalBody = document.getElementById('im-print-modal-body');
    if (!modalBody) { alert('Error: Print modal body not found.'); return; }

    const title = imGetInvoiceReportTitle();
    const generatedOn = `Generated on: ${new Date().toLocaleString('en-GB')}`;

    const reportMarkup = imBuildInvoiceRecordsReportMarkup(currentReportData, { title, generatedOn });

    // Cache for Print Now
    window.__imInvoiceReportCache.html = reportMarkup;

    // Render preview (include styles so preview matches the printed output)
    modalBody.innerHTML = `<style>${IM_INVOICE_REPORT_PREVIEW_CSS}</style>${reportMarkup}`;

    modal.classList.remove('hidden');
};

// 2) PRINT NOW (Print exactly what is previewed, in an isolated iframe)
window.imPrintInvoiceList = function() {
    if (!window.__imInvoiceReportCache?.html) {
        // If user clicks Print without previewing, generate preview first (no UX change).
        if (typeof window.openInvoicePrintPreview === 'function') {
            window.openInvoicePrintPreview();
        }
        if (!window.__imInvoiceReportCache?.html) return;
    }

    const printDoc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice Records</title>
  <style>${window.__imInvoiceReportCache.css || IM_INVOICE_REPORT_PRINT_CSS}</style>
</head>
<body>
  ${window.__imInvoiceReportCache.html}
</body>
</html>`;

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(printDoc);
    doc.close();

    // Ensure layout is ready before printing.
    setTimeout(() => {
        try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } finally {
            setTimeout(() => {
                if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
            }, 800);
        }
    }, 150);
};



}); // END OF DOMCONTENTLOADED




