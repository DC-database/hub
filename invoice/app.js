// --- 1. FIREBASE CONFIGURATION & 2. INITIALIZE FIREBASE ---
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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

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


// --- 3. DOM ELEMENT REFERENCES & 4. GLOBAL STATE ---
const PDF_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/INVOICE/";
const SRV_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/SRV/";
const views = { login: document.getElementById('login-view'), password: document.getElementById('password-view'), setup: document.getElementById('setup-view'), dashboard: document.getElementById('dashboard-view'), workdesk: document.getElementById('workdesk-view') };
const loginForm = document.getElementById('login-form'); const loginIdentifierInput = document.getElementById('login-identifier'); const loginError = document.getElementById('login-error');
const passwordForm = document.getElementById('password-form'); const passwordInput = document.getElementById('login-password'); const passwordUserIdentifier = document.getElementById('password-user-identifier'); const passwordError = document.getElementById('password-error');
const setupForm = document.getElementById('setup-form'); const setupEmailContainer = document.getElementById('setup-email-container'); const setupEmailInput = document.getElementById('setup-email'); const setupSiteContainer = document.getElementById('setup-site-container'); const setupSiteInput = document.getElementById('setup-site'); const setupPositionContainer = document.getElementById('setup-position-container'); const setupPositionInput = document.getElementById('setup-position'); const setupPasswordInput = document.getElementById('setup-password'); const setupError = document.getElementById('setup-error');
const dashboardUsername = document.getElementById('dashboard-username'); const datetimeElement = document.getElementById('datetime'); const logoutButton = document.getElementById('logout-button');
const workdeskButton = document.getElementById('workdesk-button'); const wdUsername = document.getElementById('wd-username'); const wdUserIdentifier = document.getElementById('wd-user-identifier'); const workdeskNav = document.getElementById('workdesk-nav'); const workdeskSections = document.querySelectorAll('.workdesk-section'); const wdLogoutButton = document.getElementById('wd-logout-button');
const jobEntryForm = document.getElementById('jobentry-form'); const jobForSelect = document.getElementById('job-for'); const jobDateInput = document.getElementById('job-date'); const jobEntrySearchInput = document.getElementById('job-entry-search'); const jobEntryTableWrapper = document.getElementById('job-entry-table-wrapper'); const jobEntryTableBody = document.getElementById('job-entry-table-body');
const jobEntryFormTitle = document.getElementById('jobentry-form-title');
const addJobButton = document.getElementById('add-job-button'); const updateJobButton = document.getElementById('update-job-button'); const clearJobButton = document.getElementById('clear-job-button');
const activeTaskTableBody = document.getElementById('active-task-table-body');
// --- (REMOVED) Task History DOM References ---
// const taskHistoryTableBody = document.getElementById('task-history-table-body'); 
// const taskHistorySearchInput = document.getElementById('task-history-search');
// --- (END REMOVAL) ---
const reportingTableBody = document.getElementById('reporting-table-body');
const workdeskDatetimeElement = document.getElementById('workdesk-datetime');
const activeTaskSearchInput = document.getElementById('active-task-search');
const reportingSearchInput = document.getElementById('reporting-search');
const reportTabsContainer = document.getElementById('report-tabs');
const printReportButton = document.getElementById('print-report-button');
const downloadWdReportButton = document.getElementById('download-wd-report-csv-button');
const dbActiveTasksCount = document.getElementById('db-active-tasks-count');
const dbCompletedTasksCount = document.getElementById('db-completed-tasks-count');
const dbSiteStatsContainer = document.getElementById('dashboard-site-stats');
const dbRecentTasksBody = document.getElementById('db-recent-tasks-body');
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

// ++ NEW: Settings vacation fields ++
const settingsVacationDetailsContainer = document.getElementById('settings-vacation-details-container');
const settingsReplacementNameInput = document.getElementById('settings-replacement-name');
const settingsReplacementContactInput = document.getElementById('settings-replacement-contact');
const settingsReplacementEmailInput = document.getElementById('settings-replacement-email');

// ++ NEW: Vacation Modal elements ++
const vacationModal = document.getElementById('vacation-replacement-modal');
const vacationModalTitle = document.getElementById('vacation-modal-title');
const vacationingUserName = document.getElementById('vacationing-user-name');
const vacationReturnDate = document.getElementById('vacation-return-date');
const replacementNameDisplay = document.getElementById('replacement-name-display');
const replacementContactDisplay = document.getElementById('replacement-contact-display');
const replacementEmailDisplay = document.getElementById('replacement-email-display');

// ++ NEW: Modify Task Modal elements ++
const modifyTaskModal = document.getElementById('modify-task-modal');
const modifyTaskForm = document.getElementById('modify-task-form');
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

// ++ NEW: Sidebar link to IM ++
const workdeskIMLinkContainer = document.getElementById('workdesk-im-link-container');
const workdeskIMLink = document.getElementById('workdesk-im-link');

// INVOICE MANAGEMENT REFERENCES
// ... (All your IM references remain the same, no changes needed here) ...
const invoiceManagementView = document.getElementById('invoice-management-view');
const imNav = document.getElementById('im-nav');
const imContentArea = document.getElementById('im-content-area');
const imMainElement = document.querySelector('#invoice-management-view .workdesk-main'); 
const invoiceManagementButton = document.getElementById('invoice-mgmt-button');
const imUsername = document.getElementById('im-username');
const imUserIdentifier = document.getElementById('im-user-identifier');
const imLogoutButton = document.getElementById('im-logout-button');
const imDatetimeElement = document.getElementById('im-datetime');
const imPOSearchInput = document.getElementById('im-po-search-input');
const imPOSearchButton = document.getElementById('im-po-search-button');
const imPOSearchInputBottom = document.getElementById('im-po-search-input-bottom');
const imPOSearchButtonBottom = document.getElementById('im-po-search-button-bottom');
const imPODetailsContainer = document.getElementById('im-po-details-container');
const imPONo = document.getElementById('im-po-no');
const imPOSite = document.getElementById('im-po-site');
const imPOValue = document.getElementById('im-po-value');
const imPOVendor = document.getElementById('im-po-vendor');
const imNewInvoiceForm = document.getElementById('im-new-invoice-form');
const imInvEntryIdInput = document.getElementById('im-inv-entry-id');
const imFormTitle = document.getElementById('im-form-title');
const imAttentionSelect = document.getElementById('im-attention');
const imAddInvoiceButton = document.getElementById('im-add-invoice-button');
const imUpdateInvoiceButton = document.getElementById('im-update-invoice-button');
const imClearFormButton = document.getElementById('im-clear-form-button');
const imBackToActiveTaskButton = document.getElementById('im-back-to-active-task-button');
const imExistingInvoicesContainer = document.getElementById('im-existing-invoices-container');
const imInvoicesTableBody = document.getElementById('im-invoices-table-body');
const imReportingForm = document.getElementById('im-reporting-form');
const imReportingContent = document.getElementById('im-reporting-content');
const imReportingSearchInput = document.getElementById('im-reporting-search');
const imReportingClearButton = document.getElementById('im-reporting-clear-button');
const imReportingDownloadCSVButton = document.getElementById('im-reporting-download-csv-button');
const imInvoiceDateInput = document.getElementById('im-invoice-date');
const imReleaseDateInput = document.getElementById('im-release-date');
const imDailyReportDateInput = document.getElementById('im-daily-report-date');
const imDownloadDailyReportButton = document.getElementById('im-download-daily-report-button');
const imDownloadWithAccountsReportButton = document.getElementById('im-download-with-accounts-report-button');
const imStatusSelect = document.getElementById('im-status');
const imInvValueInput = document.getElementById('im-inv-value');
const imAmountPaidInput = document.getElementById('im-amount-paid');
const imBatchSearchModal = document.getElementById('im-batch-search-modal');
const imBatchSearchExistingButton = document.getElementById('im-batch-search-existing-button');
const imWorkdeskButton = document.getElementById('im-workdesk-button');
const imActiveTaskButton = document.getElementById('im-activetask-button');
const imShowActiveJobsBtn = document.getElementById('im-show-active-jobs-btn');
const imEntrySidebar = document.getElementById('im-entry-sidebar');
const imEntrySidebarList = document.getElementById('im-entry-sidebar-list');
const imBatchNoteSearchSelect = document.getElementById('im-batch-note-search-select');
const imBatchGlobalAttention = document.getElementById('im-batch-global-attention');
const imBatchGlobalStatus = document.getElementById('im-batch-global-status');
const imBatchGlobalNote = document.getElementById('im-batch-global-note');
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
const imFinanceReportPrintableArea = document.getElementById('im-finance-report-printable-area');
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
const imReportingPrintBtn = document.getElementById('im-reporting-print-btn');
const imReportingPrintableArea = document.getElementById('im-reporting-printable-area');
const imPrintReportTitle = document.getElementById('im-print-report-title');
const imPrintReportDate = document.getElementById('im-print-report-date');
const imPrintReportSummaryPOs = document.getElementById('im-print-report-summary-pos');
const imPrintReportSummaryValue = document.getElementById('im-print-report-summary-value');
const imPrintReportSummaryPaid = document.getElementById('im-print-report-summary-paid');
const imPrintReportBody = document.getElementById('im-print-report-body');
const summaryNotePreviousInput = document.getElementById('summary-note-previous-input');
const summaryNoteCurrentInput = document.getElementById('summary-note-current-input');
const summaryNoteGenerateBtn = document.getElementById('summary-note-generate-btn');
const summaryNoteUpdateBtn = document.getElementById('summary-note-update-btn');
const summaryNotePrintBtn = document.getElementById('summary-note-print-btn');
const summaryNotePrintArea = document.getElementById('summary-note-printable-area');
const snDate = document.getElementById('sn-date');
const snVendorName = document.getElementById('sn-vendor-name');
const snPreviousPayment = document.getElementById('sn-previous-payment');
const snCurrentPayment = document.getElementById('sn-current-payment');
const snTableBody = document.getElementById('sn-table-body');
const snTotalInWords = document.getElementById('sn-total-in-words');
const snTotalNumeric = document.getElementById('sn-total-numeric');
const noteSuggestionsDatalist = document.getElementById('note-suggestions');

let currentApprover = null; let dateTimeInterval = null; let workdeskDateTimeInterval = null;
let siteSelectChoices = null; let attentionSelectChoices = null;
let currentlyEditingKey = null; let allJobEntries = []; let userJobEntries = [];
let userActiveTasks = [];
// let userTaskHistory = []; // --- (REMOVED) ---
let allSystemEntries = [];
let currentReportFilter = 'All';

// INVOICE MANAGEMENT STATE
let imDateTimeInterval = null;
let currentPO = null;
let imAttentionSelectChoices = null;
let imBatchGlobalAttentionChoices = null; 
let imBatchNoteSearchChoices = null; 
let modifyTaskAttentionChoices = null; 
let currentlyEditingInvoiceKey = null;
let currentPOInvoices = {};
let currentReportData = [];
let imStatusBarChart = null; 
let approverListForSelect = [];
let allUniqueNotes = new Set();
let invoicesToPay = {}; 

// ++ NEW: Finance Report State ++
let imFinanceAllPaymentsData = {};

// OPTIMIZED CACHE VARIABLES WITH TIMESTAMPS
let allPOData = null;
let allInvoiceData = null;
let allApproverData = null;
let allEpicoreData = null; 
let allSitesCSVData = null; 
let cacheTimestamps = {
  poData: 0,
  invoiceData: 0,
  approverData: 0,
  systemEntries: 0,
  epicoreData: 0, 
  sitesCSV: 0 
};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

// ++ NEW EFFICIENT CACHES FOR DROPDOWNS ++
let allApproversCache = null;
let allSitesCache = null;
let allApproverDataCache = null; // --- (NEW) Cache for user positions ---

// Global state variables to manage workflow between WorkDesk and Invoice Entry
let jobEntryToUpdateAfterInvoice = null;
let pendingJobEntryDataForInvoice = null;

// --- 5. HELPER FUNCTIONS ---
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
function normalizeMobile(mobile) { const digitsOnly = mobile.replace(/\D/g, ''); if (digitsOnly.length === 8) { return `974${digitsOnly}`; } return digitsOnly; }

// --- START OF FIX 3 ---
async function findApprover(identifier) {
    const isEmail = identifier.includes('@');
    const searchKey = isEmail ? 'Email' : 'Mobile';
    const searchValue = isEmail ? identifier : normalizeMobile(identifier);

    // If the global approver cache isn't filled, fill it once.
    if (!allApproverData) {
         console.log("Caching approvers list for the first time...");
         const snapshot = await db.ref('approvers').once('value');
         allApproverData = snapshot.val(); // Cache it
    }
    const approversData = allApproverData; // Use the cache

    if (!approversData) return null;
    for (const key in approversData) {
        const record = approversData[key];
        const dbValue = record[searchKey];
        if (dbValue) {
            if (isEmail) {
                if (dbValue.toLowerCase() === searchValue.toLowerCase()) {
                    return { key, ...record };
                }
            } else {
                const normalizedDbMobile = dbValue.replace(/\D/g, '');
                if (normalizedDbMobile === searchValue) {
                    return { key, ...record };
                }
            }
        }
    }
    return null;
}
// --- END OF FIX 3 ---

async function getApproverByKey(key) { try { const snapshot = await db.ref(`approvers/${key}`).once('value'); const approverData = snapshot.val(); if (approverData) { return { key, ...approverData }; } else { return null; } } catch (error) { console.error("Error fetching approver by key:", error); return null; } }
function updateDashboardDateTime() { const now = new Date(); const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }; datetimeElement.textContent = now.toLocaleDateString('en-GB', options); }
function updateWorkdeskDateTime() { const now = new Date(); const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }; const dateString = now.toLocaleDateString('en-GB', dateOptions); const timeString = now.toLocaleTimeString('en-GB', timeOptions); workdeskDatetimeElement.textContent = `${dateString} at ${timeString}`; }
function handleSuccessfulLogin() {
    if (currentApprover && currentApprover.key) {
        sessionStorage.setItem('approverKey', currentApprover.key);
    } else {
        console.error("Attempted to save login state but currentApprover or key is missing.");
        handleLogout();
        return;
    }

    dashboardUsername.textContent = `Welcome ${currentApprover.Name || currentApprover.Email}`;
    updateDashboardDateTime();
    if (dateTimeInterval) clearInterval(dateTimeInterval);
    dateTimeInterval = setInterval(updateDashboardDateTime, 1000);
    showView('dashboard');

    const financeReportButton = document.querySelector('a[href="https://ibaport.site/Finance/"]');
    if (financeReportButton) {
        // ++ MODIFIED: Show for "Accounts" or "Accounting"
        const userPositionLower = (currentApprover?.Position || '').toLowerCase();
        const isAccountsOrAccounting = userPositionLower === 'accounts' || userPositionLower === 'accounting';
        financeReportButton.classList.toggle('hidden', !isAccountsOrAccounting);
    }
}
function showWorkdeskSection(sectionId) {
    workdeskSections.forEach(section => { section.classList.add('hidden'); });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) { targetSection.classList.remove('hidden'); }

    // ++ ADDED: Restore search state on navigation ++
    if (sectionId === 'wd-dashboard') { populateWorkdeskDashboard(); }
    if (sectionId === 'wd-jobentry') {
        const savedSearch = sessionStorage.getItem('jobEntrySearch');
        if (savedSearch) {
            jobEntrySearchInput.value = savedSearch;
            handleJobEntrySearch(savedSearch);
        } else {
             jobEntryTableBody.innerHTML = '<tr><td colspan="8">Use the search bar to find your pending entries.</td></tr>';
             userJobEntries = [];
        }
    }
    if (sectionId === 'wd-activetask') {
        populateActiveTasks();
        const savedSearch = sessionStorage.getItem('activeTaskSearch');
        if (savedSearch) {
            activeTaskSearchInput.value = savedSearch;
            setTimeout(() => handleActiveTaskSearch(savedSearch), 200);
        }
    }
    // --- (REMOVED) Task History section logic ---
    // --- (END REMOVAL) ---
    if (sectionId === 'wd-reporting') {
        const savedSearch = sessionStorage.getItem('reportingSearch');
        if (savedSearch) {
            reportingSearchInput.value = savedSearch;
            handleReportingSearch();
        } else {
            reportingTableBody.innerHTML = '<tr><td colspan="11">Use the search bar and select a filter to see the report.</td></tr>';
        }
    }
    if (sectionId === 'wd-settings') { populateSettingsForm(); }
}
function formatDate(date) { const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const day = String(date.getDate()).padStart(2, '0'); const month = months[date.getMonth()]; const year = date.getFullYear(); return `${day}-${month}-${year}`; }

// --- UPDATED normalizeDateForInput TO HANDLE MORE FORMATS ---
function normalizeDateForInput(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) { return dateString; }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) { const parts = dateString.split('/'); const day = parts[0].padStart(2, '0'); const month = parts[1].padStart(2, '0'); const year = parts[2]; return `${year}-${month}-${day}`; }
    if (/^\d{2}-\d{2}-\d{2}$/.test(dateString)) { const parts = dateString.split('-'); const day = parts[0]; const month = parts[1]; const year = `20${parts[2]}`; return `${year}-${month}-${day}`; }
    const date = new Date(dateString);
    if (!isNaN(date)) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
    console.warn("Unrecognized date format:", dateString);
    return '';
}

function convertDisplayDateToInput(displayDate) {
    if (!displayDate || typeof displayDate !== 'string') return '';
    const parts = displayDate.split('-');
    if (parts.length !== 3) return '';
    const day = parts[0]; const year = parts[2];
    const monthMap = { "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12" };
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
    const number = parseFloat(value);
    if (isNaN(number)) {
        return 'N/A';
    }
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ++ NEW: Helper functions for Finance Report (copied from finance report app.js) ++
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
  const parts = String(dateStr).split('-');
  if (parts.length !== 3 || dateStr.length !== 10) { return dateStr; }
  try {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1; 
    const day = parseInt(parts[2], 10);
    const date = new Date(year, monthIndex, day);
    if (isNaN(date.getTime())) return dateStr;
    if (date.getDate() !== day || date.getMonth() !== monthIndex || date.getFullYear() !== year) { return dateStr; }
    const dayFormatted = date.getDate().toString().padStart(2, '0');
    const monthFormatted = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const yearFormatted = date.getFullYear();
    return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
  } catch (e) { return dateStr; }
}
function formatFinanceDateLong(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
// ++ END of new helper functions ++


function numberToWords(num) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const s = ['', 'Thousand', 'Million', 'Billion'];
    const number = parseFloat(num).toFixed(2);
    const [integerPart, fractionalPart] = number.split('.');
    function toWords(n) { if (n < 20) return a[n]; let digit = n % 10; return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : ''); }
    function convert(nStr) {
        if (nStr === '0') return 'Zero';
        let words = ''; let i = nStr.length;
        while (i > 0) {
            let chunk = nStr.substring(Math.max(0, i - 3), i);
            if (chunk !== '000') { let num = parseInt(chunk); words = (chunk.length === 3 && num < 100 ? 'and ' : '') + toWords(num % 100) + (num > 99 ? ' Hundred' + (num % 100 ? ' and ' : '') : '') + ' ' + s[(nStr.length - i) / 3] + ' ' + words; }
            i -= 3;
        }
        return words.trim().replace(/\s+/g, ' ');
    }
    let words = convert(integerPart);
    if (fractionalPart && parseInt(fractionalPart) > 0) { words += ' and ' + parseInt(fractionalPart) + '/100'; }
    return words.charAt(0).toUpperCase() + words.slice(1) + " Qatari Riyals Only";
}


// --- (NEW) Cache for user positions ---
async function ensureApproverDataCached() {
    if (allApproverDataCache) return; // Already cached
    const snapshot = await db.ref('approvers').once('value');
    allApproverDataCache = snapshot.val() || {};
    console.log("Approver data cached for position-matching.");
}
// --- (END NEW) ---


// --- START OF NEW HELPER FUNCTIONS (THE FIX) ---
// These are the "mail sorters" that will create your fast "inbox" lookup tables.

/**
 * (SMART HELPER 1 - UPDATED)
 * Keeps the 'invoice_tasks_by_user' (the "inbox") in sync.
 * This is the fix for INVOICE_ENTRIES.
 */
async function updateInvoiceTaskLookup(poNumber, invoiceKey, invoiceData, oldAttention) {
    const newAttention = invoiceData.attention;
    const newStatus = invoiceData.status;

    const activeStatuses = ['For SRV', 'For IPC', 'Report', 'Pending', 'Under Review']; 
    const isTaskActive = activeStatuses.includes(newStatus) && newAttention;

    // 1. Clean up the old task assignment
    if (oldAttention && oldAttention !== newAttention) {
        await invoiceDb.ref(`invoice_tasks_by_user/${oldAttention}/${invoiceKey}`).remove();
    }

    if (isTaskActive) {
        // 2. Task is active. Create/update the small lookup object.
        if (!allPOData) { 
            console.log("Loading PO Data cache to build task lookup...");
            const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
            allPOData = await fetchAndParseCSV(PO_DATA_URL);
        }
        const poDetails = (allPOData && allPOData[poNumber]) ? allPOData[poNumber] : {};

        const taskData = {
            po: poNumber,
            ref: invoiceData.invNumber || '',
            amount: invoiceData.invValue || '0',
            date: invoiceData.invoiceDate || invoiceData.dateAdded || getTodayDateString(),
            status: newStatus,
            vendorName: poDetails['Supplier Name'] || 'N/A',
            site: poDetails['Project ID'] || 'N/A',
            invName: invoiceData.invName || '',
            note: invoiceData.note || ''
        };

        // Write the task to the new user's "inbox"
        await invoiceDb.ref(`invoice_tasks_by_user/${newAttention}/${invoiceKey}`).set(taskData);

    } else {
        // 3. Task is NOT active. We must remove it from the user's "inbox".
        const userToRemove = newAttention || oldAttention;
        if (userToRemove) {
             await invoiceDb.ref(`invoice_tasks_by_user/${userToRemove}/${invoiceKey}`).remove();
        }
    }
}

/**
 * (SMART HELPER 2 - UPDATED)
 * Helper to remove a deleted invoice task from the user's "inbox".
 */
async function removeInvoiceTaskFromUser(invoiceKey, oldData) {
    if (!oldData || !oldData.attention) return; // No user to remove it from
    await invoiceDb.ref(`invoice_tasks_by_user/${oldData.attention}/${invoiceKey}`).remove();
}

/**
 * (SMART HELPER 3 - UPDATED with "Invoice" logic)
 * Keeps the 'job_tasks_by_user' (the "inbox") in sync.
 * This is the fix for JOB_ENTRIES.
 */
async function updateJobTaskLookup(jobKey, jobData, oldAttention) {
    await ensureApproverDataCached(); // Makes sure allApproverDataCache is loaded

    const newAttention = jobData.attention;
    
    // Build the task object
    const poDetails = (jobData.po && allPOData && allPOData[jobData.po]) ? allPOData[jobData.po] : {};
    const taskData = {
        for: jobData.for,
        ref: jobData.ref || '',
        po: jobData.po || '',
        amount: jobData.amount || '',
        date: jobData.date || getTodayDateString(),
        status: jobData.remarks || 'Pending',
        vendorName: poDetails['Supplier Name'] || 'N/A',
        site: jobData.site,
        note: jobData.note || ''
    };

    // --- (YOUR NEW LOGIC) ---
    // A set to store the names of all users who should have this task
    let usersWhoNeedTask = new Set();
    
    if (jobData.for === "Invoice") {
        // --- RULE 1: Job is "Invoice" ---
        // Disregard attention, find all "Accounting" positions
        if (!isTaskComplete(jobData)) { // Only if the task is active
            for (const key in allApproverDataCache) {
                const user = allApproverDataCache[key];
                
                // --- THIS IS THE FIX ---
                if (user.Position === "Accounting" && user.Name) {
                // --- END OF FIX ---
                    usersWhoNeedTask.add(user.Name);
                }
            }
        }
    } else {
        // --- RULE 2: Job is NOT "Invoice" ---
        // Use the original attention-based logic
        const isManuallyActive = !isTaskComplete(jobData) && newAttention;
        if (isManuallyActive) {
            usersWhoNeedTask.add(newAttention);
        }
    }
    // --- (END OF NEW LOGIC) ---

    // Now, determine who *used* to have this task so we can clean up
    let usersWhoHadTask = new Set();
    // 1. Add the original manual user
    if (oldAttention) {
        usersWhoHadTask.add(oldAttention);
    }
    // 2. Also add all Accounting users, in case the job *was* "Invoice"
    for (const key in allApproverDataCache) {
        const user = allApproverDataCache[key];
        // --- THIS IS THE FIX ---
        if (user.Position === "Accounting" && user.Name) {
        // --- END OF FIX ---
            usersWhoHadTask.add(user.Name);
        }
    }

    // --- Sync Logic ---
    // 1. Remove from everyone who *used* to have it but doesn't need it now
    for (const userName of usersWhoHadTask) {
        if (!usersWhoNeedTask.has(userName)) {
            await db.ref(`job_tasks_by_user/${userName}/${jobKey}`).remove();
        }
    }
    
    // 2. Add to everyone who *needs* it
    for (const userName of usersWhoNeedTask) {
        await db.ref(`job_tasks_by_user/${userName}/${jobKey}`).set(taskData);
    }
}


/**
 * (SMART HELPER 4 - UPDATED with "Invoice" logic)
 * Helper to remove a deleted job task from all inboxes.
 */
async function removeJobTaskFromUser(jobKey, oldData) {
    if (!oldData) return;
    
    await ensureApproverDataCached();
    
    let usersWhoHadTask = new Set();
    
    // 1. Get the manual user
    if (oldData.attention) {
        usersWhoHadTask.add(oldData.attention);
    }
    
    // 2. Get all Accounting users, in case it was an "Invoice" job
    if (oldData.for === "Invoice") {
         for (const key in allApproverDataCache) {
            const user = allApproverDataCache[key];
            // --- THIS IS THE FIX ---
            if (user.Position === "Accounting" && user.Name) {
            // --- END OF FIX ---
                usersWhoHadTask.add(user.Name);
            }
        }
    }
    
    // 3. Remove from all potential inboxes
    for (const userName of usersWhoHadTask) {
         await db.ref(`job_tasks_by_user/${userName}/${jobKey}`).remove();
    }
}
// --- END OF NEW HELPER FUNCTIONS ---


// ++ NEW: FETCH AND PARSE EPICORE CSV ++
async function fetchAndParseEpicoreCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { throw new Error(`Failed to fetch CSV: ${response.statusText}`); }
        const csvText = await response.text();
        const parseCsvRow = (rowStr) => {
            const values = []; let inQuote = false; let currentVal = ''; const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) { inQuote = !inQuote; } else if (char === ',' && !inQuote) { values.push(currentVal.trim().replace(/^"|"$/g, '')); currentVal = ''; } else { currentVal += char; }
            }
            values.push(currentVal.trim().replace(/^"|"$/g, ''));
            return values;
        };
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 1) { throw new Error("Epicore CSV is empty."); }
        const epicoreMap = {};
        for (let i = 0; i < lines.length; i++) { 
            const values = parseCsvRow(lines[i]);
            if (values.length > 3) { 
                const poKey = values[2] ? values[2].toUpperCase().trim() : null; 
                const description = values[3] || ''; 
                if (poKey) { epicoreMap[poKey] = description; }
            }
        }
        console.log(`Successfully fetched and parsed ${Object.keys(epicoreMap).length} entries from Epicore CSV.`);
        return epicoreMap;
    } catch (error) { console.error("Error fetching or parsing Epicore CSV:", error); alert("CRITICAL ERROR: Could not load Epicore data from GitHub."); return null; }
}


// --- *** SITE.CSV FIX (START) *** ---
// ++ NEW: FETCH AND PARSE SITES CSV ++
async function fetchAndParseSitesCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { throw new Error(`Failed to fetch Sites CSV: ${response.statusText}`); }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { throw new Error("Site.csv is empty or has no data rows."); }
        const parseCsvRow = (rowStr) => {
            const values = []; let inQuote = false; let currentVal = ''; const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) { inQuote = !inQuote; } else if (char === ',' && !inQuote) { values.push(currentVal.trim().replace(/^"|"$/g, '')); currentVal = ''; } else { currentVal += char; }
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
                if (site && description) { sitesData.push({ site, description }); }
            }
        }
        console.log(`Successfully fetched and parsed ${sitesData.length} sites from Site.csv.`);
        return sitesData;
    } catch (error) { console.error("Error fetching or parsing Site.csv:", error); alert("CRITICAL ERROR: Could not load Site data from GitHub."); return null; }
}
// --- *** SITE.CSV FIX (END) *** ---


// FETCH AND PARSE CSV FOR PO DATA
async function fetchAndParseCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) { throw new Error(`Failed to fetch CSV: ${response.statusText}`); }
        const csvText = await response.text();
        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { throw new Error("CSV is empty or has no data rows."); }
        const parseCsvRow = (rowStr) => {
            const values = []; let inQuote = false; let currentVal = ''; const cleanRowStr = rowStr.trim();
            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) { inQuote = !inQuote; } else if (char === ',' && !inQuote) { values.push(currentVal.trim()); currentVal = ''; } else { currentVal += char; }
            }
            values.push(currentVal.trim());
            return values.map(v => v.replace(/^"|"$/g, ''));
        };
        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        let poHeaderIndex = headers.findIndex(h => h.toLowerCase() === 'po number' || h.toLowerCase() === 'po' || h.toLowerCase() === 'po_number');
        if (poHeaderIndex === -1) { console.warn("Could not find 'PO Number' header. Assuming first column is the PO number."); poHeaderIndex = 0; }
        const poData = {};
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length !== headers.length) { console.warn(`Skipping malformed CSV row: ${lines[i]}`); continue; }
            const poKey = values[poHeaderIndex].toUpperCase();
            if (!poKey) continue;
            const poEntry = {};
            headers.forEach((header, index) => {
                if (header.toLowerCase() === 'amount') { poEntry[header] = values[index].replace(/,/g, '') || '0'; } else { poEntry[header] = values[index]; }
            });
            poData[poKey] = poEntry;
        }
        console.log(`Successfully fetched and parsed ${Object.keys(poData).length} POs from GitHub.`);
        return poData;
    } catch (error) { console.error("Error fetching or parsing PO CSV:", error); alert("CRITICAL ERROR: Could not load Purchase Order data from GitHub."); return null; }
}

// This function is still used by reporting, so we keep it.
async function ensureInvoiceDataFetched(forceRefresh = false) {
    const now = Date.now();
    const shouldUseCache = !forceRefresh &&
                          allPOData &&
                          allInvoiceData &&
                          allEpicoreData && // ++ NEW CHECK ++
                          allSitesCSVData && // ++ NEW CHECK FOR SITES ++
                          (now - cacheTimestamps.poData < CACHE_DURATION) &&
                          (now - cacheTimestamps.epicoreData < CACHE_DURATION) && // ++ NEW CHECK ++
                          (now - cacheTimestamps.sitesCSV < CACHE_DURATION); // ++ NEW CHECK FOR SITES ++


    if (shouldUseCache) {
        return;
    }

    try {
        const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
        const EPICORE_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/epicore.csv"; // ++ NEW ++
        const SITES_CSV_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/Site.csv"; // ++ NEW ++

        // --- (FIX) We only fetch invoice_entries if the cache is expired ---
        // Active Tasks no longer depends on this, but Reporting still does.
        console.log("Refreshing all caches (PO, Epicore, Sites, and Invoices)...");
        
        const [csvData, epicoreCsvData, sitesCsvData, invoiceSnapshot] = await Promise.all([ // ++ MODIFIED ++
            fetchAndParseCSV(PO_DATA_URL),
            fetchAndParseEpicoreCSV(EPICORE_DATA_URL), // ++ NEW ++
            fetchAndParseSitesCSV(SITES_CSV_URL), // ++ NEW ++
            invoiceDb.ref('invoice_entries').once('value'),
        ]);

        if (csvData === null || epicoreCsvData === null || sitesCsvData === null) { // ++ MODIFIED ++
            throw new Error("Failed to load PO, Epicore, or Site data from CSV.");
        }

        allPOData = csvData;
        allEpicoreData = epicoreCsvData; // ++ NEW ++
        allSitesCSVData = sitesCsvData; // ++ NEW ++
        allInvoiceData = invoiceSnapshot.val() || {};

        cacheTimestamps.poData = now;
        cacheTimestamps.epicoreData = now; // ++ NEW ++
        cacheTimestamps.sitesCSV = now; // ++ NEW ++
        cacheTimestamps.invoiceData = now;

        console.log("Invoice and GitHub CSV caches refreshed.");

        approverListForSelect = []; // Clear this here
        allApproversCache = null; // Clear Choices cache too
        
        // --- MODIFICATION (Req 3 & 4) ---
        // Repopulate allUniqueNotes from the fresh invoice data
        allUniqueNotes = new Set();
        if (allInvoiceData) {
            for (const po in allInvoiceData) {
                for (const invKey in allInvoiceData[po]) {
                    const invoice = allInvoiceData[po][invKey];
                    if (invoice.note && invoice.note.trim() !== '') {
                        allUniqueNotes.add(invoice.note.trim());
                    }
                }
            }
        }
        // --- END MODIFICATION ---


    } catch (error) {
        console.error("Failed to fetch and cache invoice data:", error);
        alert("Error: Could not load data from database.");
    }
}



// LOCAL CACHE UPDATE FUNCTIONS
function updateLocalInvoiceCache(poNumber, invoiceKey, updatedData) {
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        allInvoiceData[poNumber][invoiceKey] = {
            ...allInvoiceData[poNumber][invoiceKey],
            ...updatedData
        };
    }
}
function addToLocalInvoiceCache(poNumber, newInvoiceData, newKey) { // <-- Added newKey parameter
    if (!allInvoiceData) allInvoiceData = {};
    if (!allInvoiceData[poNumber]) {
        allInvoiceData[poNumber] = {};
    }
    if (newKey) { // Use the actual key if provided
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

// --- WORKDESK LOGIC ---

// --- (FIXED) ensureAllEntriesFetched ---
// This function is now ONLY used for Workdesk "Job Records" (formerly Reporting)
// It will ONLY fetch job_entries, as requested.
async function ensureAllEntriesFetched() {
    const now = Date.now();
    // Check if we have a cache and it's less than 30 mins old
    if (allSystemEntries.length > 0 && (now - cacheTimestamps.systemEntries < CACHE_DURATION)) {
        return; // Use the cache
    }
    
    // We must fetch PO data for vendor names
    if (!allPOData) {
         console.log("Loading PO Data cache for Workdesk Job Records...");
         const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
         allPOData = await fetchAndParseCSV(PO_DATA_URL);
    }
    
    console.log("Fetching all job_entries for Workdesk Job Records...");
    // Fetch ONLY job_entries
    const jobEntriesSnapshot = await db.ref('job_entries').orderByChild('timestamp').once('value');

    const jobEntriesData = jobEntriesSnapshot.val() || {};
    const purchaseOrdersData = allPOData || {};
    
    const processedJobEntries = Object.entries(jobEntriesData).map(([key, value]) => ({
        key,
        ...value,
        vendorName: (value.po && purchaseOrdersData[value.po]) ? purchaseOrdersData[value.po]['Supplier Name'] : 'N/A',
        source: 'job_entry'
    }));

    allSystemEntries = processedJobEntries; // Set the global cache
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    cacheTimestamps.systemEntries = now; // Update timestamp
    console.log(`Workdesk Job Records cache updated with ${allSystemEntries.length} job entries.`);
}


function isTaskComplete(task) {
    if (!task) return false;

    // --- (Req 1) MODIFIED: Define "completed" statuses for the active task sidebar ---
    // These are statuses that mean the task is no longer "active" for the user.
    const completedStatuses = [
        'CEO Approval', 
        'With Accounts', 
        'Under Review', 
        'SRV Done', 
        'Paid',
        'Report' // Added Report as a "complete" status
    ];

    if (task.source === 'invoice') {
        // If the task status is one of the completed ones, it's done.
        if (completedStatuses.includes(task.remarks)) {
            return true;
        }
        
        // Special case: If the current user entered it (Irwin), 
        // it's only "active" if it needs SRV/IPC.
        if (task.enteredBy === currentApprover?.Name) {
            const trackingStatuses = ['For SRV', 'For IPC'];
            if (trackingStatuses.includes(task.remarks)) {
                return false; // Still needs action from them
            }
            // If it's not For SRV/IPC, and not a completed status, 
            // it's also considered "done" for Irwin (e.g., "Pending")
            return true; 
        }
        // If it's assigned to someone else (e.g. current user), and not a completed status,
        // it remains active for them (e.g., 'For SRV', 'For IPC')
        return false;
    }
    
    if (task.source === 'job_entry') {
        // --- (Req 1) MODIFIED: Check job_entry statuses ---
        if (completedStatuses.includes(task.remarks)) {
            return true;
        }
        
        // --- *** START OF WORKFLOW FIX *** ---
        // A job_entry with type 'Invoice' is now considered "complete"
        // as soon as it has a dateResponded, regardless of the remarks.
        // This is set when the invoice is created from the task.
        if (task.for === 'Invoice') { 
            return !!task.dateResponded; 
        }
        // --- *** END OF WORKFLOW FIX *** ---

        if (task.for === 'IPC' && task.attention === 'All') { return true; }
    }

    // Generic completion check (might need refinement based on job type)
    return (task.amount && task.amount.trim() !== '' && task.po && task.po.trim() !== '');
}

function resetJobEntryForm(keepJobType = false) {
    const jobType = jobForSelect.value;
    jobEntryForm.reset();
    if (keepJobType) jobForSelect.value = jobType;
    currentlyEditingKey = null;
    ['job-amount', 'job-po'].forEach(id => document.getElementById(id).classList.remove('highlight-field'));
    if (siteSelectChoices) { siteSelectChoices.clearInput(); siteSelectChoices.removeActiveItems(); }
    if (attentionSelectChoices) { attentionSelectChoices.clearInput(); attentionSelectChoices.removeActiveItems(); attentionSelectChoices.enable(); }
    jobEntryFormTitle.textContent = 'Add New Job Entry';
    addJobButton.classList.remove('hidden');
    updateJobButton.classList.add('hidden');

    // ++ ADDED: Clear search on form clear ++
    jobEntrySearchInput.value = '';
    sessionStorage.removeItem('jobEntrySearch');
}

// --- *** ATTENTION DROPDOWN FIX APPLIED HERE (START) *** ---
// --- UPDATED, EFFICIENT populateAttentionDropdown with Vacation Logic ---
async function populateAttentionDropdown(choicesInstance) {
    try {
        if (!choicesInstance) return;

        // Use cached full approver data if available
        if (allApproversCache) {
            choicesInstance.setChoices(allApproversCache, 'value', 'label', true);
            return;
        }

        choicesInstance.setChoices([{ value: '', label: 'Loading...', disabled: true, selected: true }], 'value', 'label', true);

        // Ensure allApproverData is loaded if the cache is empty
        if (!allApproverData) {
            const snapshot = await db.ref('approvers').once('value');
            allApproverData = snapshot.val(); // Cache the full data object
        }
        const approvers = allApproverData;


        if (approvers) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

            const approverOptions = Object.values(approvers).map(approver => {
                if (!approver.Name) return null;

                const isOnVacation = approver.Vacation === true || approver.Vacation === "Yes";
                let isVacationActive = false;
                if (isOnVacation && approver.DateReturn) {
                    // Ensure date parsing is robust
                    try {
                        const returnDate = new Date(approver.DateReturn + 'T00:00:00Z'); // Assume UTC if no timezone
                         if (!isNaN(returnDate) && returnDate >= today) {
                            isVacationActive = true;
                        }
                    } catch (e) {
                         console.error(`Error parsing return date "${approver.DateReturn}" for ${approver.Name}:`, e);
                    }
                }

                // +++ START OF FIX: Combine fields for new label +++
                const name = approver.Name || 'No-Name';
                const position = approver.Position || 'No-Pos';
                const site = approver.Site || 'No-Site';
                const newLabel = `${name} - ${position} - ${site}`;

                // Check for vacation status to append to the new label
                const displayLabel = isVacationActive ? `${newLabel} (On Vacation)` : newLabel;
                // +++ END OF FIX +++

                return {
                    value: approver.Name, // The value saved to DB is still just the name
                    label: displayLabel,  // The new combined label for display and search
                    customProperties: { // Store full details for modal popup
                        onVacation: isVacationActive,
                        returnDate: approver.DateReturn,
                        replacement: {
                            name: approver.ReplacementName || 'N/A',
                            contact: approver.ReplacementContact || 'N/A',
                            email: approver.ReplacementEmail || 'N/A'
                        }
                    }
                };
            }).filter(Boolean); // Remove nulls

            const choiceList = [
                { value: '', label: 'Select Attention', disabled: true },
                { value: 'None', label: 'None (Clear Selection)' },
                ...approverOptions.sort((a,b) => a.label.localeCompare(b.label)) // Sort alphabetically
            ];

            allApproversCache = choiceList; // Cache the processed list for Choices.js
            choicesInstance.setChoices(allApproversCache, 'value', 'label', true);

        } else {
            choicesInstance.setChoices([{ value: '', label: 'No approvers found', disabled: true }]);
        }
    } catch (error) {
        console.error("Error populating attention dropdown:", error);
        if (choicesInstance) choicesInstance.setChoices([{ value: '', label: 'Error loading names', disabled: true }]);
    }
}
// --- *** ATTENTION DROPDOWN FIX APPLIED HERE (END) *** ---


// --- NEW, EFFICIENT populateSiteDropdown (CORRECTED) ---
async function populateSiteDropdown() {
    try {
        if (!siteSelectChoices) return;

        if (allSitesCache) {
            siteSelectChoices.setChoices(allSitesCache, 'value', 'label', true);
            return;
        }

        siteSelectChoices.setChoices([{ value: '', label: 'Loading...', disabled: true, selected: true }]);

        const snapshot = await db.ref('project_sites').once('value');
        const sites = snapshot.val();

        if (sites) {
            const siteOptions = Object.values(sites)
                .map(site => site.Warehouse && site.Description ? { value: site.Warehouse, label: `${site.Warehouse} - ${site.Description}` } : null)
                .filter(Boolean)
                //.sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically
                // --- MODIFICATION: Sort numerically by site number (value) ---
                .sort((a, b) => {
                    const numA = parseInt(a.value, 10);
                    const numB = parseInt(b.value, 10);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    // Fallback to string compare if not numbers
                    return a.label.localeCompare(b.label);
                });


            const choiceList = [{ value: '', label: 'Select a Site', disabled: true }].concat(siteOptions);

            allSitesCache = choiceList;
            siteSelectChoices.setChoices(allSitesCache, 'value', 'label', true);
        } else {
            siteSelectChoices.setChoices([{ value: '', label: 'No sites found', disabled: true }]);
        }
    } catch (error) {
        console.error("Error populating site dropdown:", error);
        if (siteSelectChoices) siteSelectChoices.setChoices([{ value: '', label: 'Error loading sites', disabled: true }]);
    }
}


function renderJobEntryTable(entries) {
    jobEntryTableBody.innerHTML = '';
    if (!entries || entries.length === 0) {
        jobEntryTableBody.innerHTML = `<tr><td colspan="8">No pending entries found for your search.</td></tr>`;
        return;
    }
    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', entry.key);
        if (entry.source !== 'invoice') {
            row.style.cursor = 'pointer';
        }
        row.innerHTML = `
            <td>${entry.for || ''}</td>
            <td>${entry.ref || ''}</td>
            <td>${entry.po || ''}</td>
            <td>${entry.site || ''}</td>
            <td>${entry.group || ''}</td>
            <td>${entry.attention || ''}</td>
            <td>${entry.date || ''}</td>
            <td>${entry.remarks || 'Pending'}</td>
        `;
        jobEntryTableBody.appendChild(row);
    });
}
async function handleJobEntrySearch(searchTerm) {
    const searchText = searchTerm.toLowerCase();
    sessionStorage.setItem('jobEntrySearch', searchText); // Save search term

    if (!searchText) {
        renderJobEntryTable([]);
        jobEntryTableBody.innerHTML = '<tr><td colspan="8">Use the search bar to find your pending entries.</td></tr>';
        return;
    }

    jobEntryTableBody.innerHTML = '<tr><td colspan="8">Searching...</td></tr>';

    try {
        // --- MODIFICATION: This now only fetches job_entries, which is correct for this section ---
        await ensureAllEntriesFetched();
        // ---
        
        userJobEntries = allSystemEntries.filter(entry => entry.enteredBy === currentApprover.Name && !isTaskComplete(entry));

        const filteredEntries = userJobEntries.filter(entry => {
            return (
                (entry.for && entry.for.toLowerCase().includes(searchText)) ||
                (entry.ref && entry.ref.toLowerCase().includes(searchText)) ||
                (entry.site && entry.site.toLowerCase().includes(searchText)) ||
                (entry.group && entry.group.toLowerCase().includes(searchText)) ||
                (entry.attention && entry.attention.toLowerCase().includes(searchText)) ||
                (entry.po && entry.po.toLowerCase().includes(searchText))
            );
        });
        renderJobEntryTable(filteredEntries);

    } catch (error) {
        console.error("Error during job entry search:", error);
        jobEntryTableBody.innerHTML = '<tr><td colspan="8">Error searching entries.</td></tr>';
    }
}
function getJobDataFromForm() {
    const formData = new FormData(jobEntryForm);
    const data = { for: formData.get('for'), ref: formData.get('ref') || '', amount: formData.get('amount') || '', po: formData.get('po') || '', site: formData.get('site'), group: formData.get('group'), attention: attentionSelectChoices.getValue(true), date: formatDate(new Date()) };
    return data;
}

// --- (MODIFIED) handleAddJobEntry ---
async function handleAddJobEntry(e) {
    e.preventDefault();
    const jobData = getJobDataFromForm();
    
    // --- (MODIFICATION) Check for "Invoice" job type ---
    const isInvoiceJob = jobData.for === 'Invoice';
    if (!jobData.for || !jobData.site || !jobData.group) {
        alert('Please fill in Job, Site, and Group.');
        return;
    }
    // --- THIS IS THE FIX ---
    // If it's an invoice job, attention is blank. If not, it's required.
    if (isInvoiceJob) {
        jobData.attention = ""; // Force attention to be blank for Invoice jobs
    } else if (!isInvoiceJob && !jobData.attention) { 
         alert('Please select an Attention user.'); 
         return; 
    }
    // --- END OF FIX ---

    if (jobData.for === 'IPC') {
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
        if (isQS) {
            jobData.remarks = 'Ready';
            if (!jobData.amount || !jobData.po) { alert('As a QS, IPC jobs require both an Amount and PO number.'); return; }
        } else {
            if (!jobData.po) { alert('For IPC jobs, a PO number is required.'); return; }
        }
        await ensureAllEntriesFetched(); // This is still needed for the duplicate check
        const duplicatePO = allSystemEntries.find(entry => entry.for === 'IPC' && entry.po && entry.po.trim() !== '' && entry.po === jobData.po);
        if (duplicatePO) {
            const message = `WARNING: An IPC for PO Number "${jobData.po}" already exists.\n\nPress OK if this is a new IPC for this PO.\nPress Cancel to check the "Job Records" section first.`;
            if (!confirm(message)) { return; }
        }
    }

    jobData.timestamp = Date.now();
    jobData.enteredBy = currentApprover.Name;
    try {
        const newRef = await db.ref('job_entries').push(jobData);
        // --- ADD THIS LINE (THE FIX) ---
        // This will now handle the new "Invoice" logic automatically
        await updateJobTaskLookup(newRef.key, jobData, null); // (jobKey, newData, oldAttention)
        // --- END OF ADDITION ---

        alert('Job Entry Added Successfully!');
        resetJobEntryForm();
        allSystemEntries = []; // Clear job_entries cache
    } catch (error) { console.error("Error adding job entry:", error); alert('Failed to add Job Entry. Please try again.'); }
}

// --- (MODIFIED) handleUpdateJobEntry ---
async function handleUpdateJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) { alert("No entry selected for update."); return; }
    const formData = new FormData(jobEntryForm);
    const jobData = { for: formData.get('for'), ref: formData.get('ref') || '', amount: formData.get('amount') || '', po: formData.get('po') || '', site: formData.get('site'), group: formData.get('group'), attention: attentionSelectChoices.getValue(true) };
    
    // --- (MODIFICATION) Check for "Invoice" job type ---
    const isInvoiceJob = jobData.for === 'Invoice';
    if (!jobData.for || !jobData.site || !jobData.group) {
        alert('Please fill in Job, Site, and Group.');
        return;
    }
    // --- THIS IS THE FIX ---
    if (isInvoiceJob) {
        jobData.attention = ""; // Force attention to be blank for Invoice jobs
    } else if (!isInvoiceJob && !jobData.attention) { 
         alert('Please select an Attention user.'); 
         return; 
    }
    // --- END OF FIX ---
    
    try {
        await ensureAllEntriesFetched(); // We need this to get the original entry
        const originalEntry = allSystemEntries.find(entry => entry.key === currentlyEditingKey);
        
        // --- ADD THIS LINE (THE FIX) ---
        const oldAttention = originalEntry ? originalEntry.attention : null;
        // --- END OF ADDITION ---
        
        if (originalEntry) { jobData.enteredBy = originalEntry.enteredBy; jobData.timestamp = originalEntry.timestamp; jobData.date = originalEntry.date; }
        if (originalEntry.for === 'IPC' && jobData.attention === 'All') { jobData.remarks = 'Ready'; }
        if (originalEntry && currentApprover.Name === originalEntry.attention && !originalEntry.dateResponded) { jobData.dateResponded = formatDate(new Date()); }
        
        await db.ref(`job_entries/${currentlyEditingKey}`).update(jobData);

        // --- ADD THIS LINE (THE FIX) ---
        // Merge original data with new data to pass to the helper
        const updatedFullJobData = {...originalEntry, ...jobData}; 
        await updateJobTaskLookup(currentlyEditingKey, updatedFullJobData, oldAttention);
        // --- END OF ADDITION ---

        alert('Job Entry Updated Successfully!');
        resetJobEntryForm();
        allSystemEntries = []; // Clear job_entries cache
        populateActiveTasks(); // This is now fast!
    } catch (error) { console.error("Error updating job entry:", error); alert('Failed to update Job Entry. Please try again.'); }
}
function populateFormForEditing(key) {
    // This needs to fetch from allSystemEntries, which is correct
    const entryData = allSystemEntries.find(entry => entry.key === key);
    if (!entryData || entryData.source === 'invoice') return;

    currentlyEditingKey = key;
    document.getElementById('job-for').value = entryData.for || '';
    document.getElementById('job-ref').value = entryData.ref || '';
    const amountInput = document.getElementById('job-amount');
    const poInput = document.getElementById('job-po');
    amountInput.value = entryData.amount || '';
    poInput.value = entryData.po || '';
    document.getElementById('job-group').value = entryData.group || '';
    siteSelectChoices.setChoiceByValue(entryData.site || '');
    
    // --- (FIX) Logic to handle "Invoice" job editing ---
    if (entryData.for === 'Invoice') {
        attentionSelectChoices.clearStore(); 
        attentionSelectChoices.setChoices([{ value: '', label: 'Auto-assigned to Accounting', disabled: true, selected: true }], 'value', 'label', false); 
        attentionSelectChoices.disable(); 
    } else {
        attentionSelectChoices.enable();
        populateAttentionDropdown(attentionSelectChoices).then(() => {
             attentionSelectChoices.setChoiceByValue(entryData.attention || '');
        });
    }
    // --- END OF FIX ---

    jobEntryFormTitle.textContent = 'Editing Job Entry';
    addJobButton.classList.add('hidden');
    updateJobButton.classList.remove('hidden');
    amountInput.classList.remove('highlight-field');
    poInput.classList.remove('highlight-field');
    window.scrollTo(0, 0);
}


// --- (REPLACED) EFFICIENT populateActiveTasks (Fixes BOTH invoice_entries and job_entries) ---
async function populateActiveTasks() {
    activeTaskTableBody.innerHTML = `<tr><td colspan="10">Loading tasks...</td></tr>`;
    if (!currentApprover || !currentApprover.Name) {
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Could not identify user.</td></tr>`;
        return;
    }

    try {
        const currentUserName = currentApprover.Name;
        const currentUserPosition = currentApprover.Position || ""; // Get user's position
        let userTasks = [];

        // --- PART 1: FETCH JOB_ENTRY TASKS (The New, FAST way) ---
        // This is fast because job_entries is small
        await ensureAllEntriesFetched(); // This downloads all job_entries
        
        // Now filter job_entries based on your new logic
        const activeJobEntries = allSystemEntries.filter(task => {
            if (isTaskComplete(task)) {
                return false; // Skip completed tasks
            }
            
            if (task.for === "Invoice") {
                // RULE 1: Job is "Invoice", check user position
                return currentUserPosition === "Accounting";
            } else {
                // RULE 2: Not "Invoice", check attention field
                return task.attention === currentUserName;
            }
        });
        userTasks.push(...activeJobEntries); // Add all matching job entries
        // --- END OF PART 1 ---


        // --- PART 2: FETCH INVOICE_ENTRY TASKS (The New, FAST way) ---
        // This is the second fast, targeted query to the invoice_tasks_by_user "inbox"
        const invoiceTaskSnapshot = await invoiceDb.ref(`invoice_tasks_by_user/${currentUserName}`).once('value');
        
        if (invoiceTaskSnapshot.exists()) {
            const tasksData = invoiceTaskSnapshot.val();
            // We need PO data for this part
            if (!allPOData) {
                 const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
                 allPOData = await fetchAndParseCSV(PO_DATA_URL);
            }
            
            for (const invoiceKey in tasksData) {
                const task = tasksData[invoiceKey];

                const transformedInvoice = {
                    key: `${task.po}_${invoiceKey}`, // Create the composite key for the table
                    originalKey: invoiceKey,
                    originalPO: task.po,
                    source: 'invoice',
                    for: 'Invoice',
                    ref: task.ref,
                    po: task.po,
                    amount: task.amount,
                    site: task.site,
                    group: 'N/A',
                    attention: currentUserName, // The task is here, so it's for this user
                    enteredBy: 'Irwin', // This is assumed, as in your original code
                    date: task.date ? formatDate(new Date(task.date + 'T00:00:00')) : 'N/A',
                    remarks: task.status,
                    timestamp: task.date ? new Date(task.date).getTime() : Date.now(),
                    invName: task.invName,
                    vendorName: task.vendorName,
                    note: task.note
                };
                userTasks.push(transformedInvoice);
            }
        }
        // --- END OF PART 2 ---

        // Store and render the combined list of tasks
        userActiveTasks = userTasks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderActiveTaskTable(userTasks); 

    } catch (error) {
        console.error("Error fetching active tasks:", error);
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Error loading tasks.</td></tr>`;
    }
}


// ++ MODIFIED: renderActiveTaskTable ++
function renderActiveTaskTable(tasks) {
    activeTaskTableBody.innerHTML = '';
    if (!tasks || tasks.length === 0) {
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">You have no active tasks.</td></tr>`;
        return;
    }
    tasks.forEach(task => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', task.key);

        const isInvoiceFromIrwin = task.source === 'invoice' && task.enteredBy === 'Irwin';

        // ++ MODIFIED: PDF link check for "Nil", "nil", and empty/blank strings ++
        const invName = task.invName || '';
        const isClickable = (isInvoiceFromIrwin || (task.source === 'invoice' && invName)) &&
                            invName.trim() &&
                            invName.toLowerCase() !== 'nil';

        if (isClickable) {
            row.classList.add('clickable-pdf');
        }

        // --- (FIX) "SRV Done" button logic ---
        // Allow for 'job_entry' OR 'invoice'
        const canSrvDone = task.source === 'invoice' || task.source === 'job_entry';
        const srvDoneDisabled = !canSrvDone ? 'disabled' : '';
        // --- END OF FIX ---
        
        // Build the action buttons
        const actionButtons = `
            <button class="srv-done-btn" data-key="${task.key}" ${srvDoneDisabled}>SRV Done</button>
            <button class="modify-btn" data-key="${task.key}">Modify</button>
        `;

        row.innerHTML = `
            <td>${task.for || ''}</td>
            <td>${task.ref || ''}</td>
            <td>${task.po || ''}</td>
            <td>${task.vendorName || 'N/A'}</td>
            <td>${formatCurrency(task.amount)}</td>
            <td>${task.site || ''}</td>
            <td>${task.group || ''}</td>
            <td>${task.date || ''}</td>
            <td>${task.remarks || 'Pending'}</td>
            <td>${actionButtons}</td>
        `;
        activeTaskTableBody.appendChild(row);
    });
}

// --- (REMOVED) Task History Functions ---
/*
function renderTaskHistoryTable(tasks) {
    // This function is no longer needed
}
async function handleTaskHistorySearch(searchTerm) {
    // This function is no longer needed
}
*/
// --- (END REMOVAL) ---

function renderReportingTable(entries) {
    reportingTableBody.innerHTML = '';
    if (!entries || entries.length === 0) { reportingTableBody.innerHTML = '<tr><td colspan="11">No entries found for the selected criteria.</td></tr>'; return; }
    entries.forEach(entry => {
        const status = isTaskComplete(entry) ? (entry.remarks || 'Completed') : (entry.remarks || 'Pending');
        const row = document.createElement('tr');
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
            <td>${entry.dateResponded || 'N/A'}</td>
            <td>${status}</td>
        `;
        reportingTableBody.appendChild(row);
    });
}
function filterAndRenderReport(baseEntries = []) {
    let filteredEntries = [...baseEntries];
    if (currentReportFilter !== 'All') { filteredEntries = filteredEntries.filter(entry => entry.for === currentReportFilter); }
    const searchText = reportingSearchInput.value.toLowerCase();
    sessionStorage.setItem('reportingSearch', searchText); // Save search term

    if (searchText) {
        filteredEntries = filteredEntries.filter(entry => {
            return ((entry.for && entry.for.toLowerCase().includes(searchText)) || (entry.ref && entry.ref.toLowerCase().includes(searchText)) || (entry.po && entry.po.toLowerCase().includes(searchText)) || (entry.amount && entry.amount.toString().includes(searchText)) || (entry.site && entry.site.toLowerCase().includes(searchText)) || (entry.attention && entry.attention.toLowerCase().includes(searchText)) || (entry.enteredBy && entry.enteredBy.toLowerCase().includes(searchText)) || (entry.date && entry.date.toLowerCase().includes(searchText)));
        });
    }
    renderReportingTable(filteredEntries);
}
async function populateWorkdeskDashboard() {
    await populateActiveTasks(); // This is now fast!
    dbActiveTasksCount.textContent = userActiveTasks.length;
    
    await ensureAllEntriesFetched(); // This is now just job_entries
    const myCompletedTasks = allSystemEntries.filter(task => (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name) && isTaskComplete(task));
    dbCompletedTasksCount.textContent = myCompletedTasks.length;
}

// ++ NEW: Function to open the Modify Task modal ++
function openModifyTaskModal(taskData) {
    if (!taskData) return;

    // Store all identifiers in the form's hidden fields
    modifyTaskKey.value = taskData.key;
    modifyTaskSource.value = taskData.source;
    modifyTaskOriginalPO.value = taskData.originalPO || '';
    modifyTaskOriginalKey.value = taskData.originalKey || '';

    // Set Attention
    if (modifyTaskAttentionChoices) {
        // --- (FIX) Logic to handle "Invoice" job editing ---
        if (taskData.source === 'job_entry' && taskData.for === 'Invoice') {
            modifyTaskAttentionChoices.clearStore(); 
            modifyTaskAttentionChoices.setChoices([{ value: '', label: 'Auto-assigned to Accounting', disabled: true, selected: true }], 'value', 'label', false); 
            modifyTaskAttentionChoices.disable(); 
        } else {
            modifyTaskAttentionChoices.enable();
            populateAttentionDropdown(modifyTaskAttentionChoices).then(() => {
                modifyTaskAttentionChoices.setChoiceByValue(taskData.attention || '');
            });
        }
        // --- END OF FIX ---
    }
// Set Status
    const currentStatus = taskData.remarks || 'Pending';
    const standardStatuses = ['For SRV', 'For IPC', 'Report'];
    if (standardStatuses.includes(currentStatus)) {
        modifyTaskStatus.value = currentStatus;
        modifyTaskStatusOtherContainer.classList.add('hidden');
        modifyTaskStatusOther.value = '';
    } else {
        // If it's a custom status, select "Other" and fill the text box
        modifyTaskStatus.value = 'Other';
        modifyTaskStatusOtherContainer.classList.remove('hidden');
        modifyTaskStatusOther.value = currentStatus;
    }

    // Set Note
    modifyTaskNote.value = taskData.note || ''; // 'note' was added to the task object

    modifyTaskModal.classList.remove('hidden');
}

// --- (MODIFIED) handleSaveModifiedTask ---
async function handleSaveModifiedTask() {
    const key = modifyTaskKey.value;
    const source = modifyTaskSource.value;
    const originalPO = modifyTaskOriginalPO.value;
    const originalKey = modifyTaskOriginalKey.value;

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

    const updates = {
        attention: modifyTaskAttentionChoices.getValue(true) || '',
        remarks: selectedStatus, // 'remarks' for job_entry
        status: selectedStatus,  // 'status' for invoice_entry
        note: modifyTaskNote.value.trim()
    };

    // --- (FIX) Logic for "Invoice" jobs ---
    const originalTaskData = userActiveTasks.find(t => (t.key === key) || (t.originalKey === originalKey));
    if (originalTaskData && originalTaskData.source === 'job_entry' && originalTaskData.for === 'Invoice') {
        updates.attention = ""; // Force blank attention for Invoice jobs
    }
    // --- END OF FIX ---


    // Clear attention if status is Under Review or With Accounts (like in invoice entry)
    if (updates.status === 'Under Review' || updates.status === 'With Accounts') {
        updates.attention = '';
    }

    modifyTaskSaveBtn.disabled = true;
    modifyTaskSaveBtn.textContent = 'Saving...';

    try {
        if (source === 'job_entry') {
            // This is a job entry, update the main DB
            await db.ref(`job_entries/${key}`).update({
                attention: updates.attention,
                remarks: updates.remarks,
                note: updates.note // Job entries didn't originally have 'note', this adds it
            });
            
            // --- ADD THIS LINE (THE FIX) ---
            const updatedJobData = {...originalTaskData, ...updates};
            await updateJobTaskLookup(key, updatedJobData, originalTaskData.attention);
            // --- END OF ADDITION ---

        } else if (source === 'invoice' && originalPO && originalKey) {
            // This is an invoice entry, update the invoice DB
            await invoiceDb.ref(`invoice_entries/${originalPO}/${originalKey}`).update({
                attention: updates.attention,
                status: updates.status,
                note: updates.note
            });
            
            // --- ADD THIS LINE (THE FIX) ---
            // Get original data from the local cache
            if (!allInvoiceData) await ensureInvoiceDataFetched(); // Ensure cache is warm
            const originalInvoice = (allInvoiceData && allInvoiceData[originalPO]) ? allInvoiceData[originalPO][originalKey] : {};
            const updatedInvoiceData = {...originalInvoice, ...updates}; // Merge
            await updateInvoiceTaskLookup(originalPO, originalKey, updatedInvoiceData, originalInvoice.attention);
            // --- END OF ADDITION ---

            // Also update the local cache
            updateLocalInvoiceCache(originalPO, originalKey, updates);
        } else {
            throw new Error("Invalid task source or missing keys.");
        }

        alert("Task updated successfully!");
        modifyTaskModal.classList.add('hidden');
        
        await populateActiveTasks(); // This is now fast!

    } catch (error) {
        console.error("Error updating task:", error);
        alert("Failed to update task. Please try again.");
    } finally {
        modifyTaskSaveBtn.disabled = false;
        modifyTaskSaveBtn.textContent = 'Save Changes';
    }
}


function handleActiveTaskSearch(searchTerm) {
    const searchText = searchTerm.toLowerCase();
    sessionStorage.setItem('activeTaskSearch', searchText); // Save search term

    if (!searchText) {
        renderActiveTaskTable(userActiveTasks);
        return;
    }
    const filteredTasks = userActiveTasks.filter(task => {
        return (
            (task.for && task.for.toLowerCase().includes(searchText)) ||
            (task.ref && task.ref.toLowerCase().includes(searchText)) ||
            (task.po && task.po.toLowerCase().includes(searchText)) ||
            (task.vendorName && task.vendorName.toLowerCase().includes(searchText)) ||
            (task.site && task.site.toLowerCase().includes(searchText)) ||
            (task.group && task.group.toLowerCase().includes(searchText)) ||
            (task.date && task.date.toLowerCase().includes(searchText))
        );
    });
    renderActiveTaskTable(filteredTasks);
}

async function handleReportingSearch() {
    const searchText = reportingSearchInput.value.toLowerCase();
    sessionStorage.setItem('reportingSearch', searchText); // Save search term

    if (!searchText) {
        renderReportingTable([]);
        return;
    }

    reportingTableBody.innerHTML = '<tr><td colspan="11">Searching report data...</td></tr>';
    try {
        await ensureAllEntriesFetched(); // This now correctly fetches ONLY job_entries
        
        // This admin-site logic is specific to your reporting needs
        const userSiteString = currentApprover.Site || '';
        const userSites = userSiteString.toLowerCase() === 'all' ? null : userSiteString.split(',').map(s => s.trim());
        const relevantEntries = allSystemEntries.filter(entry => {
            const isMySite = userSites === null || (entry.site && userSites.includes(entry.site));
            const isRelatedToMe = (entry.enteredBy === currentApprover.Name || entry.attention === currentApprover.Name);
            return isMySite || isRelatedToMe;
        });
        filterAndRenderReport(relevantEntries);
    } catch (error) {
        console.error("Error fetching all entries for reporting:", error);
        reportingTableBody.innerHTML = '<tr><td colspan="11">Error loading reporting data.</td></tr>';
    }
}
function handleDownloadWorkdeskCSV() {
    const table = document.querySelector("#reporting-printable-area table");
    if (!table) {
        alert("Report table not found.");
        return;
    }

    let csv = [];
    const headers = [];
    table.querySelectorAll("thead th").forEach(header => {
        headers.push(`"${header.innerText.replace(/"/g, '""')}"`);
    });
    csv.push(headers.join(","));

    table.querySelectorAll("tbody tr").forEach(row => {
        const rowData = [];
        row.querySelectorAll("td").forEach(cell => {
            rowData.push(`"${cell.innerText.replace(/"/g, '""')}"`);
        });
        csv.push(rowData.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "workdesk_job_records.csv"); // Renamed file
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// SETTINGS PAGE FUNCTIONS
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
    settingsVacationCheckbox.checked = currentApprover.Vacation === true || currentApprover.Vacation === "Yes"; // Handle boolean/string
    settingsReturnDateInput.value = currentApprover.DateReturn || '';

    // ++ ADDED: Populate replacement fields ++
    settingsReplacementNameInput.value = currentApprover.ReplacementName || '';
    settingsReplacementContactInput.value = currentApprover.ReplacementContact || '';
    settingsReplacementEmailInput.value = currentApprover.ReplacementEmail || '';

    settingsVacationDetailsContainer.classList.toggle('hidden', !settingsVacationCheckbox.checked);
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
        Vacation: onVacation ? "Yes" : "", // Store as Yes/empty string
        DateReturn: onVacation ? settingsReturnDateInput.value : '',
        // ++ ADDED: Save replacement fields ++
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
        // Update local state, converting Vacation back to boolean if needed for checks
        currentApprover = { ...currentApprover, ...updates, Vacation: updates.Vacation === "Yes" };
        allApproversCache = null; // Invalidate cache so it's refetched with new vacation info
        allApproverDataCache = null; // Invalidate position cache
        settingsMessage.textContent = 'Settings updated successfully!';
        settingsMessage.className = 'success-message';
        settingsPasswordInput.value = '';
        if (passwordChanged) {
            alert('Password changed successfully! You will now be logged out.');
            handleLogout();
        } else {
             populateSettingsForm(); // Re-populate to show saved state
        }
    } catch (error) {
        console.error("Error updating settings:", error);
        settingsMessage.textContent = 'An error occurred. Please try again.';
        settingsMessage.className = 'error-message';
    }
}

// --- INVOICE MANAGEMENT FUNCTIONS ---
function updateIMDateTime() {
    const now = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const dateString = now.toLocaleDateString('en-GB', dateOptions);
    const timeString = now.toLocaleTimeString('en-GB', timeOptions);
    if (imDatetimeElement) imDatetimeElement.textContent = `${dateString} at ${timeString}`;
}
function showIMSection(sectionId) {
    // ++ Access Control Check ++
    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    const userRoleLower = (currentApprover?.Role || '').toLowerCase();
    const isAccountingAdmin = userPositionLower === 'accounting' && userRoleLower === 'admin';
    const isAccountsOrAccounting = userPositionLower === 'accounts' || userPositionLower === 'accounting';
    const isAdmin = userRoleLower === 'admin'; // Use isAdmin for finance report
    
    // --- *** BUTTON ACCESS FIX (START) *** ---
    // --- *** CORRECTED: Check POSITION, not ROLE *** ---
    const isAccountingPosition = userPositionLower === 'accounting';
    
    // Show/hide daily report buttons based on 'accounting' POSITION
    const dailyReportContainer = document.querySelector('.daily-report-section');
    if (dailyReportContainer) {
        dailyReportContainer.style.display = isAccountingPosition ? 'flex' : 'none';
    }
    // Also hide the "Download Full Report" button
    if (imReportingDownloadCSVButton) {
        imReportingDownloadCSVButton.style.display = isAccountingPosition ? 'inline-block' : 'none';
    }
    // --- *** BUTTON ACCESS FIX (END) *** ---


    // ++ MODIFIED: Block access based on role
    if (sectionId === 'im-invoice-entry' && !isAccountingAdmin) { alert('Access Denied: Requires Accounting Admin position.'); return; }
    if (sectionId === 'im-batch-entry' && !isAccountingAdmin) { alert('Access Denied: Requires Accounting Admin position.'); return; }
    if (sectionId === 'im-summary-note' && !isAccountingAdmin) { alert('Access Denied: Requires Accounting Admin position.'); return; }
    if (sectionId === 'im-payments' && !isAccountsOrAccounting) { alert('Access Denied: Requires Accounts or Accounting position.'); return; }
    // ++ NEW: Block access for Finance Report
    if (sectionId === 'im-finance-report' && !isAdmin) { alert('Access Denied: Requires Admin role.'); return; }


    imContentArea.querySelectorAll('.workdesk-section').forEach(section => section.classList.add('hidden'));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.remove('hidden');

    // ++ NEW (Req 1 & 2): Show/Hide Active Jobs Sidebar AND manage main content class
    if (sectionId === 'im-invoice-entry') {
        if(imEntrySidebar) imEntrySidebar.classList.remove('hidden');
        if(imMainElement) imMainElement.classList.add('with-sidebar'); // Add class to main content
        populateActiveJobsSidebar(); // Populate the sidebar
    } else {
        if(imEntrySidebar) imEntrySidebar.classList.add('hidden'); // Hide on all other sections
        if(imMainElement) imMainElement.classList.remove('with-sidebar'); // Remove class from main content
    }


    if (sectionId === 'im-dashboard') { populateInvoiceDashboard(); }
    
    // --- *** START OF FIX (Search Persistence) *** ---
    if (sectionId === 'im-invoice-entry') { 
        // resetInvoiceEntryPage(); // <-- REMOVED THIS LINE
        
        // Restore search state
        const savedPOSearch = sessionStorage.getItem('imPOSearch');
        if (savedPOSearch) {
            imPOSearchInput.value = savedPOSearch;
            imPOSearchInputBottom.value = savedPOSearch;
            handlePOSearch(savedPOSearch); // This will repopulate the form and tables
        } else {
            // If no search is saved, THEN we reset the page
            resetInvoiceEntryPage();
        }
        
        if (imAttentionSelectChoices) { 
            populateAttentionDropdown(imAttentionSelectChoices); 
        } 
    }
    // --- *** END OF FIX *** ---
    
    // --- *** START OF FIX (Batch Note Persistence) *** ---
    if (sectionId === 'im-batch-entry') {
        const savedBatchSearch = sessionStorage.getItem('imBatchSearch');
        const savedBatchNoteSearch = sessionStorage.getItem('imBatchNoteSearch'); // <-- NEW
        const batchTableBody = document.getElementById('im-batch-table-body');
        
        if (savedBatchSearch) {
            document.getElementById('im-batch-po-input').value = savedBatchSearch;
        } else {
             document.getElementById('im-batch-po-input').value = '';
        }
        
        // Always clear the table when navigating to the section
        batchTableBody.innerHTML = '';

        if (!imBatchGlobalAttentionChoices) {
             imBatchGlobalAttentionChoices = new Choices(imBatchGlobalAttention, { searchEnabled: true, shouldSort: false, itemSelectText: '', });
             populateAttentionDropdown(imBatchGlobalAttentionChoices);
        } else {
             populateAttentionDropdown(imBatchGlobalAttentionChoices);
        }
        
        if (!imBatchNoteSearchChoices) {
            imBatchNoteSearchChoices = new Choices(imBatchNoteSearchSelect, {
                searchEnabled: true,
                shouldSort: true,
                itemSelectText: '',
                removeItemButton: true,
                placeholder: true,
                placeholderValue: 'Search by Note...'
            });
        }
        
        // Populate and then set the saved value
        populateNoteDropdown(imBatchNoteSearchChoices).then(() => {
            if (savedBatchNoteSearch) {
                imBatchNoteSearchChoices.setChoiceByValue(savedBatchNoteSearch);
            }
        });
    }
    // --- *** END OF FIX *** ---

    // --- MODIFICATION: Restore saved Summary Note search ---
    if (sectionId === 'im-summary-note') { 
        // summaryNotePrintArea.classList.add('hidden'); // Don't hide yet
        initializeNoteSuggestions(); 
        
        const savedPrevNote = sessionStorage.getItem('imSummaryPrevNote');
        const savedCurrNote = sessionStorage.getItem('imSummaryCurrNote');
        
        if (savedPrevNote) summaryNotePreviousInput.value = savedPrevNote;
        if (savedCurrNote) summaryNoteCurrentInput.value = savedCurrNote;

        // If a current note was saved, auto-generate the summary
        if (savedCurrNote) {
            handleGenerateSummary();
        } else {
            summaryNotePrintArea.classList.add('hidden');
        }
    }
    // --- END MODIFICATION ---

    if (sectionId === 'im-reporting') {
        imDailyReportDateInput.value = getTodayDateString();
        const savedSearch = sessionStorage.getItem('imReportingSearch');
        if (savedSearch) {
            imReportingSearchInput.value = savedSearch;
            populateInvoiceReporting(savedSearch);
        } else {
            imReportingContent.innerHTML = '<p>Please enter a search term and click Search.</p>';
            imReportingSearchInput.value = '';
            currentReportData = [];
        }
        populateSiteFilterDropdown();
    }
     // ++ NEW: Initialize Payments Section ++
    if (sectionId === 'im-payments') {
        imPaymentsTableBody.innerHTML = ''; // Clear table on view change
        invoicesToPay = {}; // Reset state
    }
    // ++ NEW: Initialize Finance Report Section ++
    if (sectionId === 'im-finance-report') {
        imFinanceSearchPoInput.value = '';
        imFinanceResults.style.display = 'none';
        imFinanceNoResults.style.display = 'none';
        imFinanceAllPaymentsData = {};
    }
}
function resetInvoiceForm() {
    const nextId = imInvEntryIdInput.value;
    imNewInvoiceForm.reset();
    imInvEntryIdInput.value = nextId;
    imReleaseDateInput.value = getTodayDateString();
    imInvoiceDateInput.value = getTodayDateString(); // ++ NEW: Set default date
    if (imAttentionSelectChoices) { imAttentionSelectChoices.clearInput(); imAttentionSelectChoices.removeActiveItems(); }
    currentlyEditingInvoiceKey = null;
    imFormTitle.textContent = 'Add New Invoice for this PO';
    imAddInvoiceButton.classList.remove('hidden');
    imUpdateInvoiceButton.classList.add('hidden');
}

// --- *** START OF FIX (Search Persistence) *** ---
function resetInvoiceEntryPage() {
    currentPO = null;
    currentPOInvoices = {};
    imPOSearchInput.value = '';
    imPOSearchInputBottom.value = ''; // ++ NEW (Req 1) ++
    imPODetailsContainer.classList.add('hidden');
    imNewInvoiceForm.classList.add('hidden');
    imExistingInvoicesContainer.classList.add('hidden');
    imInvoicesTableBody.innerHTML = '';
    imBackToActiveTaskButton.classList.add('hidden');
    
    // Clear the session storage for the PO search
    sessionStorage.removeItem('imPOSearch');
    
    resetInvoiceForm();
}
// --- *** END OF FIX *** ---

// --- MODIFIED handlePOSearch (Req 1) ---
async function handlePOSearch(poNumberFromInput) {
    // Determine the PO number to use (from top, bottom, or parameter)
    const poNumber = (poNumberFromInput || imPOSearchInput.value || imPOSearchInputBottom.value).trim().toUpperCase();
    
    if (!poNumber) {
        alert('Please enter a PO Number.');
        return;
    }

    // --- *** START OF FIX (Search Persistence) *** ---
    // Save the successful search term to session storage
    sessionStorage.setItem('imPOSearch', poNumber);
    // --- *** END OF FIX *** ---

    // Sync both search boxes
    imPOSearchInput.value = poNumber;
    imPOSearchInputBottom.value = poNumber;
    
    try {
        if (!allPOData) {
            console.log("Loading PO data from GitHub for the first time...");
            const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
            allPOData = await fetchAndParseCSV(PO_DATA_URL);
            if (!allPOData) {
                 alert("CRITICAL ERROR: Could not load PO data.");
                 return;
            }
        }

        const poData = allPOData[poNumber];
        if (!poData) {
            alert('PO Number not found in the database.');
            // --- *** START OF FIX (Search Persistence) *** ---
            // We call reset, which also clears the session storage
            resetInvoiceEntryPage();
            // --- *** END OF FIX *** ---
            return;
        }

        // --- THIS IS THE FIX ---
        // Instead of downloading ALL invoices, we ONLY download invoices for THIS PO.
        // This is fast and cheap.
        const invoicesSnapshot = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
        const invoicesData = invoicesSnapshot.val();

        if (!allInvoiceData) allInvoiceData = {};
        allInvoiceData[poNumber] = invoicesData || {}; // Add/update THIS PO in the cache
        // --- END OF FIX ---

        currentPO = poNumber;
        const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
        const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
        const poValueText = (isAdmin || isAccounting) ? (poData.Amount ? `QAR ${formatCurrency(poData.Amount)}` : 'N/A') : '---'; // Show value for Admin or Accounting
        const siteText = poData['Project ID'] || 'N/A';
        const vendorText = poData['Supplier Name'] || 'N/A';

        // --- MODIFICATION: Update ALL matching elements ---
        // This will now update both the top bar and the one above "Existing Invoices"
        document.querySelectorAll('.im-po-no').forEach(el => el.textContent = poNumber);
        document.querySelectorAll('.im-po-site').forEach(el => el.textContent = siteText);
        document.querySelectorAll('.im-po-value').forEach(el => el.textContent = poValueText);
        document.querySelectorAll('.im-po-vendor').forEach(el => el.textContent = vendorText);
        
        document.querySelectorAll('.im-po-details-container').forEach(el => el.classList.remove('hidden'));
        // --- END OF MODIFICATION ---

        fetchAndDisplayInvoices(poNumber);

    } catch (error) {
        console.error("Error searching for PO:", error);
        alert('An error occurred while searching for the PO.');
    }
}

function fetchAndDisplayInvoices(poNumber) {
    const invoicesData = allInvoiceData[poNumber];

    let maxInvIdNum = 0; // ++ NEW: For smart ID generation
    imInvoicesTableBody.innerHTML = '';
    currentPOInvoices = invoicesData || {};

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';


    if (invoicesData) {
        const invoices = Object.entries(invoicesData).map(([key, value]) => ({ key, ...value }));

        invoices.forEach(inv => {
            // ++ NEW: Logic to find highest existing ID
            if (inv.invEntryID) {
                const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                if (!isNaN(idNum) && idNum > maxInvIdNum) {
                    maxInvIdNum = idNum;
                }
            }
        });

        invoices.sort((a, b) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        invoices.forEach(inv => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.setAttribute('data-key', inv.key);
            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
             // Show values only for Admin or Accounting
            const invValueDisplay = (isAdmin || isAccounting) ? formatCurrency(inv.invValue) : '---';
            const amountPaidDisplay = (isAdmin || isAccounting) ? formatCurrency(inv.amountPaid) : '---';


            const invPDFName = inv.invName || '';
            const invPDFLink = (invPDFName.trim() && invPDFName.toLowerCase() !== 'nil')
                ? `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn">Invoice</a>`
                : '';

            const srvPDFName = inv.srvName || '';
            const srvPDFLink = (srvPDFName.trim() && srvPDFName.toLowerCase() !== 'nil')
                ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="action-btn srv-pdf-btn">SRV</a>`
                : '';

            row.innerHTML = `
                <td>${inv.invEntryID || ''}</td>
                <td>${inv.invNumber || ''}</td>
                <td>${invoiceDateDisplay}</td>
                <td>${invValueDisplay}</td>
                <td>${amountPaidDisplay}</td>
                <td>${inv.status || ''}</td>
                <td>${releaseDateDisplay}</td>
                <td><div class="action-btn-group">${invPDFLink} ${srvPDFLink} <button class="delete-btn" data-key="${inv.key}">Delete</button></div></td>
            `;
            imInvoicesTableBody.appendChild(row);
        });
        imExistingInvoicesContainer.classList.remove('hidden');
    } else {
        imInvoicesTableBody.innerHTML = '<tr><td colspan="8">No invoices have been entered for this PO yet.</td></tr>';
        imExistingInvoicesContainer.classList.remove('hidden');
    }
    // ++ UPDATED: Use smart ID generation
    const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;
    imInvEntryIdInput.value = nextInvId;
    resetInvoiceForm();
    imNewInvoiceForm.classList.remove('hidden');

    if (pendingJobEntryDataForInvoice) {
        if (pendingJobEntryDataForInvoice.amount) {
            imInvValueInput.value = pendingJobEntryDataForInvoice.amount;
            imAmountPaidInput.value = pendingJobEntryDataForInvoice.amount;
        }
        if (pendingJobEntryDataForInvoice.ref) { document.getElementById('im-inv-no').value = pendingJobEntryDataForInvoice.ref; }
        if (pendingJobEntryDataForInvoice.date) { imInvoiceDateInput.value = convertDisplayDateToInput(pendingJobEntryDataForInvoice.date); }
        pendingJobEntryDataForInvoice = null;
    }
}

// ++ NEW (Req 1): Populate the Active Jobs Sidebar ++
async function populateActiveJobsSidebar() {
    if (!imEntrySidebarList) return;

    // --- (Req 1) FIX: We must re-run populateActiveTasks to get the latest list ---
    // This function will now use the new, FAST query.
    await populateActiveTasks();
    const tasksToDisplay = userActiveTasks; // userActiveTasks is now fresh and fast
    // --- End FIX ---

    // Filter for "Invoice" tasks assigned to the current user
    const invoiceJobs = tasksToDisplay.filter(task => 
        (task.for === 'Invoice' || task.source === 'invoice') && // Check both types
        task.attention === currentApprover.Name
    );

    imEntrySidebarList.innerHTML = ''; // Clear previous list

    if (invoiceJobs.length === 0) {
        imEntrySidebarList.innerHTML = '<li class="im-sidebar-no-jobs">No active invoice jobs found.</li>';
        return;
    }

    invoiceJobs.forEach(job => {
        const li = document.createElement('li');
        li.className = 'im-sidebar-item';
        // Store all necessary data on the element
        li.dataset.key = job.key;
        li.dataset.po = job.po || '';
        li.dataset.ref = job.ref || '';
        li.dataset.amount = job.amount || '';
        li.dataset.date = job.date || '';
        li.dataset.source = job.source || ''; // 'job_entry' or 'invoice'
        li.dataset.originalKey = job.originalKey || ''; // For invoice source
        li.dataset.originalPO = job.originalPO || ''; // For invoice source
        
        li.innerHTML = `
            <span class="im-sidebar-po">PO: ${job.po || 'N/A'}</span>
            <span class="im-sidebar-vendor">${job.vendorName || 'No Vendor'}</span>
            <span class="im-sidebar-amount">QAR ${formatCurrency(job.amount)}</span>
        `;
        imEntrySidebarList.appendChild(li);
    });
}

// ++ NEW (Req 1): Handle clicking a job in the sidebar ++
async function handleActiveJobClick(e) {
    const item = e.target.closest('.im-sidebar-item');
    if (!item) return;

    const { po, ref, amount, date, source, key, originalKey, originalPO } = item.dataset;

    if (!po) {
        alert("This job entry is missing a PO number and cannot be processed.");
        return;
    }

    // This logic is triggered for BOTH job_entry and invoice sources
    // We store the key to update the task later
    jobEntryToUpdateAfterInvoice = source === 'job_entry' ? key : null; // Only store for job_entry
    // We store the data to pre-populate the form
    pendingJobEntryDataForInvoice = { po, ref, amount, date };

    // This block handles tasks that are ALREADY in the invoice_entries DB
    if (source === 'invoice' && originalPO && originalKey) {
        // If the task is already an invoice, we just load it for editing
        jobEntryToUpdateAfterInvoice = null; // No separate task to update
        pendingJobEntryDataForInvoice = null; // Don't pre-fill, just load
        
        try {
            await handlePOSearch(originalPO); // Load the PO
            // Wait a moment for search to complete, then populate
            setTimeout(() => {
                populateInvoiceFormForEditing(originalKey); // Populate form with existing data
                imBackToActiveTaskButton.classList.remove('hidden');
            }, 200);
        } catch (error) {
            console.error("Error loading existing invoice task:", error);
            alert("Error loading this task. Please try searching for the PO manually.");
        }
        return;
    }
    
    // This block handles tasks from the original job_entries DB
    try {
        // Load the PO. The 'fetchAndDisplayInvoices' function will
        // see 'pendingJobEntryDataForInvoice' and pre-populate the *new* invoice form
        await handlePOSearch(po); 
        imBackToActiveTaskButton.classList.remove('hidden');
    } catch (error) {
        console.error("Error searching for PO from active job:", error);
        alert("Error searching for PO. Please try again manually.");
    }
}


function populateInvoiceFormForEditing(invoiceKey) {
    const invData = currentPOInvoices[invoiceKey];
    if (!invData) return;
    resetInvoiceForm();
    currentlyEditingInvoiceKey = invoiceKey;
    imInvEntryIdInput.value = invData.invEntryID || '';
    document.getElementById('im-inv-no').value = invData.invNumber || '';
    imInvoiceDateInput.value = normalizeDateForInput(invData.invoiceDate);
    imInvValueInput.value = invData.invValue || '';
    imAmountPaidInput.value = invData.amountPaid || '0';
    document.getElementById('im-inv-name').value = invData.invName || '';
    document.getElementById('im-srv-name').value = invData.srvName || '';
    document.getElementById('im-details').value = invData.details || '';
    imReleaseDateInput.value = (invData.status === 'With Accounts' || invData.status === 'Paid') ? normalizeDateForInput(invData.releaseDate) : getTodayDateString(); // Keep date if With Accounts or Paid
    imStatusSelect.value = invData.status || 'For SRV';
    document.getElementById('im-note').value = invData.note || '';
    if (imAttentionSelectChoices && invData.attention) {
        imAttentionSelectChoices.setChoiceByValue(invData.attention);
    }
    imFormTitle.textContent = `Editing Invoice: ${invData.invEntryID}`;
    imAddInvoiceButton.classList.add('hidden');
    imUpdateInvoiceButton.classList.remove('hidden');
    imNewInvoiceForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); // Use scrollIntoView
}

// --- (MODIFIED) handleAddInvoice ---
async function handleAddInvoice(e) {
    e.preventDefault();
    if (!currentPO) { alert('No PO is loaded. Please search for a PO first.'); return; }
    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;
    // --- FIX: Clear attention if status is Under Review or With Accounts ---
    if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
    }
    // --- END FIX ---
    invoiceData.dateAdded = getTodayDateString();
    invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;

    if (!invoiceData.invName) {
        const site = document.getElementById('im-po-site').textContent;
        const po = document.getElementById('im-po-no').textContent;
        const invId = document.getElementById('im-inv-entry-id').value;
        let vendor = document.getElementById('im-po-vendor').textContent;
        if (vendor.length > 21) vendor = vendor.substring(0, 21);
        invoiceData.invName = `${site}-${po}-${invId}-${vendor}`;
    }

    // --- (Req 3) MODIFIED: Add invEntryID to srvName ---
    if (invoiceData.status === 'With Accounts' && !invoiceData.srvName) {
        const poDetails = allPOData[currentPO];
        if(poDetails) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}${mm}${dd}`;
            let vendor = poDetails['Supplier Name'] || '';
            if (vendor.length > 21) vendor = vendor.substring(0, 21);
            const site = poDetails['Project ID'] || 'N/A';
            // Add the invEntryID
            const invEntryID = invoiceData.invEntryID || 'INV-XX';
            invoiceData.srvName = `${formattedDate}-${currentPO}-${invEntryID}-${site}-${vendor}`;
        }
    }
    // --- End (Req 3) MODIFICATION ---

    Object.keys(invoiceData).forEach(key => { if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key]; });

    try {
        const newRef = await invoiceDb.ref(`invoice_entries/${currentPO}`).push(invoiceData); // <-- Get ref
        const newKey = newRef.key; // <-- Get key

        // --- ADD THIS LINE (THE FIX) ---
        await updateInvoiceTaskLookup(currentPO, newKey, invoiceData, null); // (po, key, newData, oldAttention)
        // --- END OF ADDITION ---

        alert('Invoice added successfully!');
        // Update local cache manually
        if (allInvoiceData && newKey) {
             if (!allInvoiceData[currentPO]) allInvoiceData[currentPO] = {};
             allInvoiceData[currentPO][newKey] = invoiceData;
             console.log("Local invoice cache updated for new entry.");
        }
        
        // --- MODIFICATION (Req 3 & 4) ---
        if (invoiceData.note && invoiceData.note.trim() !== '') {
            allUniqueNotes.add(invoiceData.note.trim());
        }
        // --- END MODIFICATION ---

        if (jobEntryToUpdateAfterInvoice) {
            try {
                const updates = { 
                    remarks: invoiceData.status, 
                    dateResponded: formatDate(new Date()) 
                };
                
                await db.ref(`job_entries/${jobEntryToUpdateAfterInvoice}`).update(updates);
                
                // --- ADD THIS LINE (THE FIX) ---
                // We must also update the job_entry's lookup table
                const originalJobEntry = userActiveTasks.find(t => t.key === jobEntryToUpdateAfterInvoice);
                if (originalJobEntry) {
                    const updatedJobData = {...originalJobEntry, ...updates};
                    await updateJobTaskLookup(jobEntryToUpdateAfterInvoice, updatedJobData, originalJobEntry.attention);
                }
                // --- END OF ADDITION ---
                
                jobEntryToUpdateAfterInvoice = null;
                await populateActiveJobsSidebar(); // This is now fast!

            } catch (updateError) {
                console.error("Error updating the original job entry:", updateError);
                alert("Invoice was added, but failed to update the original active task.");
            }
        }
        fetchAndDisplayInvoices(currentPO);
        allSystemEntries = []; // Clear system cache
    } catch (error) {
        console.error("Error adding invoice:", error);
        alert('Failed to add invoice. Please try again.');
    }
}

// --- (MODIFIED) handleUpdateInvoice ---
async function handleUpdateInvoice(e) {
    e.preventDefault();
    if (!currentPO || !currentlyEditingInvoiceKey) { alert('No invoice selected for update.'); return; }
    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;

    // --- FIX: Clear attention if status is Under Review or With Accounts ---
    if (invoiceData.status === 'Under Review' || invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
    }
    // --- END FIX ---

    const originalInvoiceData = currentPOInvoices[currentlyEditingInvoiceKey];
    
    // --- (Req 3) MODIFIED: Add invEntryID to srvName on update ---
    if (invoiceData.status === 'With Accounts' && (!originalInvoiceData || !originalInvoiceData.srvName)) {
        try {
            const poDetails = allPOData[currentPO];
            if (poDetails) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const formattedDate = `${yyyy}${mm}${dd}`;
                let vendor = poDetails['Supplier Name'] || '';
                if (vendor.length > 21) vendor = vendor.substring(0, 21);
                const site = poDetails['Project ID'] || 'N/A';
                // Use the invEntryID from the form data
                const invEntryID = invoiceData.invEntryID || 'INV-XX';
                invoiceData.srvName = `${formattedDate}-${currentPO}-${invEntryID}-${site}-${vendor}`;
                document.getElementById('im-srv-name').value = invoiceData.srvName;
            }
        } catch (error) { console.error("Could not generate SRV Name:", error); alert("Warning: Could not automatically generate the SRV Name."); }
    }
    // --- End (Req 3) MODIFICATION ---

    Object.keys(invoiceData).forEach(key => { if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key]; });

    try {
        await invoiceDb.ref(`invoice_entries/${currentPO}/${currentlyEditingInvoiceKey}`).update(invoiceData);

        // --- ADD THIS LINE (THE FIX) ---
        const oldAttn = originalInvoiceData ? originalInvoiceData.attention : null;
        await updateInvoiceTaskLookup(currentPO, currentlyEditingInvoiceKey, invoiceData, oldAttn);
        // --- END OF ADDITION ---

        alert('Invoice updated successfully!');
        updateLocalInvoiceCache(currentPO, currentlyEditingInvoiceKey, invoiceData);
        
        // --- MODIFICATION (Req 3 & 4) ---
        if (invoiceData.note && invoiceData.note.trim() !== '') {
            allUniqueNotes.add(invoiceData.note.trim());
        }
        // --- END MODIFICATION ---

        // --- (Req 1) FIX: Refresh sidebar in case status changed ---
        await populateActiveTasks(); // This is now fast!
        populateActiveJobsSidebar();
        // --- End FIX ---

        fetchAndDisplayInvoices(currentPO);
        allSystemEntries = []; // Clear system cache
    } catch (error) {
        console.error("Error updating invoice:", error);
        alert('Failed to update invoice. Please try again.');
    }
}

// --- (REPLACED) handleDeleteInvoice ---
async function handleDeleteInvoice(key) {
    if (!currentPO || !key) { alert("Could not identify the invoice to delete."); return; }
    
    // --- Get the old data BEFORE deleting ---
    const invoiceToDelete = currentPOInvoices[key];
    if (!invoiceToDelete) {
        alert("Error: Cannot find invoice data to delete. Please refresh.");
        return;
    }

    if (confirm("Are you sure you want to delete this invoice entry? This action cannot be undone.")) {
        try {
            // 1. Delete the main invoice
            await invoiceDb.ref(`invoice_entries/${currentPO}/${key}`).remove();
            
            // 2. --- CALL THE DELETE HELPER (THE FIX) ---
            await removeInvoiceTaskFromUser(key, invoiceToDelete);
            // --- END OF ADDITION ---
            
            alert("Invoice deleted successfully.");
            removeFromLocalInvoiceCache(currentPO, key);
            fetchAndDisplayInvoices(currentPO);
            
        } catch (error) {
            console.error("Error deleting invoice:", error);
            alert("Failed to delete the invoice. Please try again.");
        }
    }
}
// --- *** SITE.CSV FIX (START) *** ---
// ++ MODIFIED: populateSiteFilterDropdown to use Site.csv ++
async function populateSiteFilterDropdown() {
    const siteFilterSelect = document.getElementById('im-reporting-site-filter');
    if (siteFilterSelect.options.length > 1) return; // Already populated
    try {
        // Ensure Site.csv data is fetched (ensureInvoiceDataFetched handles caching)
        await ensureInvoiceDataFetched(); 
        
        const allSites = allSitesCSVData; // Use the cached Site.csv data
        if (!allSites) {
             console.warn("Site.csv data not available for site filter.");
             return;
        }
        
        const sites = new Set();
        allSites.forEach(item => {
            if (item.site) {
                sites.add(item.site);
            }
        });

        // --- MODIFICATION: Sort numerically by site number ---
        const sortedSites = Array.from(sites).sort((a, b) => {
            const numA = parseInt(a, 10);
            const numB = parseInt(b, 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b); // Fallback for non-numeric
        });

        // Clear existing options except the first one ("All Sites")
        while (siteFilterSelect.options.length > 1) {
            siteFilterSelect.remove(1);
        }
        sortedSites.forEach(site => {
            const option = document.createElement('option');
            option.value = site;
            option.textContent = site;
            siteFilterSelect.appendChild(option);
        });
    } catch(error) {
        console.error("Error populating site filter:", error);
    }
}
// --- *** SITE.CSV FIX (END) *** ---

// ++ FIX: Restore definition for populateInvoiceDashboard ++
async function populateInvoiceDashboard() {
    const dashboardSection = document.getElementById('im-dashboard');
    // Basic placeholder - replace with actual chart logic if needed later
    dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Dashboard analytics view is currently unavailable.</p>';
}

// --- *** MODIFIED populateInvoiceReporting *** ---
async function populateInvoiceReporting(searchTerm = '') {
    sessionStorage.setItem('imReportingSearch', searchTerm); // Save search term

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    currentReportData = [];
    imReportingContent.innerHTML = '<p>Searching... Please wait.</p>';

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const monthFilter = document.getElementById('im-reporting-date-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;

    try {
        // --- THIS IS THE KEY ---
        // This function no longer downloads all invoices by default.
        // We only call it *if* the cache is empty.
        await ensureInvoiceDataFetched();

        const allPOs = allPOData;
        const allInvoicesByPO = allInvoiceData;
        if (!allPOs || !allInvoicesByPO) {
             throw new Error("Required data (PO or Invoices) not loaded.");
        }
        const searchText = searchTerm.toLowerCase();

        let tableHTML = `<table><thead><tr><th></th><th>PO</th><th>Site</th><th>Vendor</th><th>Value</th><th>Total Paid Amount</th><th>Last Paid Date</th></tr></thead><tbody>`;
        let resultsFound = false;
        const processedPOData = [];

        const filteredPONumbers = Object.keys(allPOs).filter(poNumber => {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';
            const searchMatch = !searchText || poNumber.toLowerCase().includes(searchText) || vendor.toLowerCase().includes(searchText);
            const siteMatch = !siteFilter || site === siteFilter;
            return searchMatch && siteMatch;
        });

        for (const poNumber of filteredPONumbers) {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            let invoices = allInvoicesByPO[poNumber] ? Object.entries(allInvoicesByPO[poNumber]).map(([key, value]) => ({ key, ...value })) : []; // Map key into object

            // --- ** NEW PAID LOGIC ** ---
            let calculatedTotalPaid = 0;
            let latestPaidDate = null;
            let latestPaidDateObj = null;

            for (const inv of invoices) {
                if (inv.status === 'Paid') {
                    const payment = parseFloat(inv.amountPaid);
                    if (!isNaN(payment)) {
                        calculatedTotalPaid += payment;
                    }

                    const dateStr = inv.releaseDate;
                    if (dateStr) {
                         try {
                            const normalizedDate = normalizeDateForInput(dateStr) + 'T00:00:00';
                            const currentDate = new Date(normalizedDate);
                            
                            if (!isNaN(currentDate)) {
                                if (!latestPaidDateObj || currentDate.getTime() > latestPaidDateObj.getTime()) {
                                    latestPaidDateObj = currentDate;
                                }
                            }
                         } catch (e) { console.warn(`Could not parse date "${dateStr}" for PO ${poNumber}`); }
                    }
                }
            }
            if(latestPaidDateObj) {
                latestPaidDate = formatDate(latestPaidDateObj);
            }
            // --- ** END NEW PAID LOGIC ** ---


            const filteredInvoices = invoices.filter(inv => {
                const normalizedReleaseDate = normalizeDateForInput(inv.releaseDate);
                const dateMatch = !monthFilter || (normalizedReleaseDate && normalizedReleaseDate.startsWith(monthFilter));
                const statusMatch = !statusFilter || inv.status === statusFilter;
                return dateMatch && statusMatch;
            });

            if (filteredInvoices.length === 0) continue;
            resultsFound = true;

            const poReportData = { 
                poNumber, 
                poDetails, 
                site, 
                vendor, 
                filteredInvoices, 
                // --- ** MODIFIED: Use new calculated values ** ---
                paymentData: { 
                    totalPaidAmount: (calculatedTotalPaid > 0) ? calculatedTotalPaid : 'N/A', 
                    datePaid: latestPaidDate || 'N/A'
                } 
                // --- ** END MODIFICATION ** ---
            };
            processedPOData.push(poReportData);
        }

        currentReportData = processedPOData;

        if (!resultsFound) { imReportingContent.innerHTML = '<p>No results found for your search criteria.</p>'; }
        else {
            processedPOData.sort((a, b) => a.poNumber.localeCompare(b.poNumber));
            processedPOData.forEach(poData => {
                let totalInvValue = 0, totalAmountPaid = 0, allWithAccounts = poData.filteredInvoices.length > 0;
                const detailRowId = `detail-${poData.poNumber}`;
                let nestedTableRows = '';
                poData.filteredInvoices.sort((a, b) => {
                    const numA = parseInt((a.invEntryID || 'INV-0').split('-')[1] || 0);
                    const numB = parseInt((b.invEntryID || 'INV-0').split('-')[1] || 0);
                    return numA - numB;
                });
                poData.filteredInvoices.forEach(inv => {
                    if (inv.status !== 'With Accounts') allWithAccounts = false;
                    const invValue = parseFloat(inv.invValue) || 0, amountPaid = parseFloat(inv.amountPaid) || 0;
                    totalInvValue += invValue; totalAmountPaid += amountPaid;
                    const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
                    const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';

                    // Show values only for Admin or Accounting
                    const invValueDisplay = (isAdmin || isAccounting) ? formatCurrency(invValue) : '---';
                    const amountPaidDisplay = (isAdmin || isAccounting) ? formatCurrency(amountPaid) : '---';

                    let actionButtonsHTML = '';
                    // Show PDF links only for Admin or Accounting
                    if (isAdmin || isAccounting) {
                        const invPDFName = inv.invName || '';
                        const invPDFLink = (invPDFName.trim() && invPDFName.toLowerCase() !== 'nil')
                            ? `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn">Invoice</a>`
                            : '';

                        const srvPDFName = inv.srvName || '';
                        const srvPDFLink = (srvPDFName.trim() && srvPDFName.toLowerCase() !== 'nil')
                            ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="action-btn srv-pdf-btn">SRV</a>`
                            : '';

                        if (invPDFLink || srvPDFLink) actionButtonsHTML = `<div class="action-btn-group">${invPDFLink} ${srvPDFLink}</div>`;
                    }
                    
                    // --- ** MODIFIED: Add data-attributes to row for click-to-edit ** ---
                    nestedTableRows += `<tr class="nested-invoice-row" 
                                            data-po-number="${poData.poNumber}" 
                                            data-invoice-key="${inv.key}" 
                                            title="Click to edit this invoice">
                        <td>${inv.invEntryID || ''}</td>
                        <td>${inv.invNumber || ''}</td>
                        <td>${invoiceDateDisplay}</td>
                        <td>${invValueDisplay}</td>
                        <td>${amountPaidDisplay}</td>
                        <td>${releaseDateDisplay}</td>
                        <td>${inv.status || ''}</td>
                        <td>${inv.note || ''}</td>
                        <td>${actionButtonsHTML}</td>
                    </tr>`;
                    // --- ** END MODIFICATION ** ---
                });

                 // Show totals only for Admin or Accounting
                const totalInvValueDisplay = (isAdmin || isAccounting) ? `<strong>QAR ${formatCurrency(totalInvValue)}</strong>` : '---';
                const totalAmountPaidDisplay = (isAdmin || isAccounting) ? `<strong>QAR ${formatCurrency(totalAmountPaid)}</strong>` : '---';
                const poValueDisplay = (isAdmin || isAccounting) ? (poData.poDetails.Amount ? `QAR ${formatCurrency(poData.poDetails.Amount)}` : 'N/A') : '---';
                
                // --- ** MODIFIED: Use new payment data ** ---
                const totalPaidDisplay = (isAdmin || isAccounting) ? (poData.paymentData.totalPaidAmount !== 'N/A' ? `QAR ${formatCurrency(poData.paymentData.totalPaidAmount)}` : 'N/A') : '---';
                const datePaidDisplay = (isAdmin || isAccounting) ? poData.paymentData.datePaid : '---';
                // --- ** END MODIFICATION ** ---

                let highlightClass = '';
                 if (isAdmin || isAccounting) { // Only highlight for authorized users
                    const poValueNum = parseFloat(poData.poDetails.Amount) || 0, epsilon = 0.01;
                    if (allWithAccounts && poValueNum > 0) {
                        const isInvValueMatch = Math.abs(totalInvValue - poValueNum) < epsilon;
                        const isAmountPaidMatch = Math.abs(totalAmountPaid - poValueNum) < epsilon;
                        if (isInvValueMatch) highlightClass = isAmountPaidMatch ? 'highlight-fully-paid' : 'highlight-partial';
                    }
                }
                tableHTML += `<tr class="master-row ${highlightClass}" data-target="#${detailRowId}"><td><button class="expand-btn">+</button></td><td>${poData.poNumber}</td><td>${poData.site}</td><td>${poData.vendor}</td><td>${poValueDisplay}</td><td>${totalPaidDisplay}</td><td>${datePaidDisplay}</td></tr>`;
                tableHTML += `<tr id="${detailRowId}" class="detail-row hidden"><td colspan="7"><div class="detail-content"><h4>Invoice Entries for PO ${poData.poNumber}</h4><table class="nested-invoice-table"><thead><tr><th>Inv. Entry</th><th>Inv. No.</th><th>Inv. Date</th><th>Inv. Value</th><th>Amount To Paid</th><th>Release Date</th><th>Status</th><th>Note</th><th>Action</th></tr></thead><tbody>${nestedTableRows}</tbody><tfoot><tr><td colspan="3" style="text-align: right;"><strong>TOTAL</strong></td><td>${totalInvValueDisplay}</td><td>${totalAmountPaidDisplay}</td><td colspan="4"></td></tr></tfoot></table></div></td></tr>`;
            });
            tableHTML += `</tbody></table>`;
            imReportingContent.innerHTML = tableHTML;
        }
    } catch (error) {
        console.error("Error generating invoice report:", error);
        imReportingContent.innerHTML = '<p>An error occurred while generating the report. Check console for details.</p>';
    }
}
// --- *** END OF MODIFIED FUNCTION *** ---

// ++ NEW (Req 2): Generate data for professional print report ++
// --- *** START OF PRINT FIX *** ---
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

    // --- 1. Set Report Headers ---
    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;
    let title = "Invoice Summary Report";
    if (siteFilter && !statusFilter) title = `Invoice Report for Site: ${siteFilter}`;
    if (statusFilter && !siteFilter) title = `Invoice Report - Status: ${statusFilter}`;
    if (siteFilter && statusFilter) title = `Invoice Report for Site: ${siteFilter} (Status: ${statusFilter})`;
    
    imPrintReportTitle.textContent = title;
    imPrintReportDate.textContent = `Generated on: ${new Date().toLocaleString('en-GB')}`;

    // --- 2. Calculate Summaries ---
    let totalPOs = currentReportData.length;
    let totalReportValue = 0;
    let totalReportPaid = 0;

    currentReportData.forEach(po => {
        // Add PO Value
        totalReportValue += parseFloat(po.poDetails.Amount) || 0;
        // Add Total Paid Amount from our calculation
        if (po.paymentData.totalPaidAmount !== 'N/A') {
            totalReportPaid += parseFloat(po.paymentData.totalPaidAmount) || 0;
        }
    });

    imPrintReportSummaryPOs.textContent = totalPOs;
    imPrintReportSummaryValue.textContent = `QAR ${formatCurrency(totalReportValue)}`;
    imPrintReportSummaryPaid.textContent = `QAR ${formatCurrency(totalReportPaid)}`;

    // --- 3. Build Report Body ---
    imPrintReportBody.innerHTML = ''; // Clear previous report
    
    currentReportData.forEach(po => {
        const poContainer = document.createElement('div');
        poContainer.className = 'print-po-container';

        // PO Header
        const poHeader = document.createElement('div');
        poHeader.className = 'print-po-header';
        poHeader.innerHTML = `
            <div><strong>PO:</strong> ${po.poNumber}</div>
            <div><strong>Site:</strong> ${po.site}</div>
            <div><strong>Vendor:</strong> ${po.vendor}</div>
            <div><strong>PO Value:</strong> QAR ${formatCurrency(po.poDetails.Amount)}</div>
            <div><strong>Total Paid:</strong> QAR ${formatCurrency(po.paymentData.totalPaidAmount)}</div>
        `;
        poContainer.appendChild(poHeader);

        // Invoices Table
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
        
        let totalInvValue = 0;
        let totalAmountPaid = 0;

        po.filteredInvoices.forEach(inv => {
            const invValue = parseFloat(inv.invValue) || 0;
            const amountPaid = parseFloat(inv.amountPaid) || 0;
            totalInvValue += invValue;
            totalAmountPaid += amountPaid;

            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';

            invoicesTableHTML += `
                <tr>
                    <td>${inv.invEntryID || ''}</td>
                    <td>${inv.invNumber || ''}</td>
                    <td>${invoiceDateDisplay}</td>
                    <td class="print-number">${formatCurrency(invValue)}</td>
                    <td class="print-number">${formatCurrency(amountPaid)}</td>
                    <td>${releaseDateDisplay}</td>
                    <td>${inv.status || ''}</td>
                    <td>${inv.note || ''}</td>
                </tr>
            `;
        });

        // Add Footer Row for totals
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

    // --- 4. Trigger Print ---
    // Hide all other printable areas
    if (summaryNotePrintArea) summaryNotePrintArea.classList.add('hidden');
    
    // Show *this* printable area
    if (imReportingPrintableArea) imReportingPrintableArea.classList.remove('hidden');

    window.print();
    
    // Hide this printable area again after printing
    if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
}
// --- *** END OF PRINT FIX *** ---


async function handleDownloadCSV() {
    // --- *** BUTTON ACCESS FIX (START) *** ---
    // --- *** CORRECTED: Check POSITION, not ROLE *** ---
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
    // --- *** BUTTON ACCESS FIX (END) *** ---
        alert("You do not have permission to download this report.");
        return;
    }
    if (currentReportData.length === 0) { alert("No data to download. Please perform a search first."); return; }
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

// --- MODIFICATION (Req 2) ---
// Added 'invValue' to daily report
async function handleDownloadDailyReport() {
    // --- *** BUTTON ACCESS FIX (START) *** ---
    // --- *** CORRECTED: Check POSITION, not ROLE *** ---
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
    // --- *** BUTTON ACCESS FIX (END) *** ---
        alert("You do not have permission to download this report.");
        return;
    }
    const selectedDate = imDailyReportDateInput.value;
    if (!selectedDate) { alert("Please select a date."); return; }
    try {
        await ensureInvoiceDataFetched();
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;
        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for daily report.");
        const dailyEntries = [];
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                if (inv.dateAdded === selectedDate) dailyEntries.push({ po: poNumber, site: allPOs[poNumber]?.['Project ID'] || 'N/A', ...inv });
            }
        }
        if (dailyEntries.length === 0) { alert(`No new invoices were entered on ${selectedDate}.`); return; }
        let csvContent = "data:text/csv;charset=utf-8,";
        // Add 'Invoice Amount' to header
        const headers = ["PO", "Site", "invName", "Invoice Amount"];
        csvContent += headers.join(",") + "\r\n";
        dailyEntries.forEach(entry => { 
            // Add 'invValue' to the row
            const row = [entry.po, entry.site, `"${(entry.invName || '').replace(/"/g, '""')}"`, entry.invValue || '0'];
            csvContent += row.join(",") + "\r\n"; 
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `daily_invoice_entry_report_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) { console.error("Error generating daily report:", error); alert("An error occurred while generating the daily report."); }
}

// --- MODIFICATION (Req 2) ---
// Added 'invValue' to 'With Accounts' report
async function handleDownloadWithAccountsReport() {
    // --- *** BUTTON ACCESS FIX (START) *** ---
    // --- *** CORRECTED: Check POSITION, not ROLE *** ---
    const isAccountingPosition = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingPosition) {
    // --- *** BUTTON ACCESS FIX (END) *** ---
        alert("You do not have permission to download this report.");
        return;
    }
    const selectedDate = imDailyReportDateInput.value;
    if (!selectedDate) { alert("Please select a date."); return; }
    try {
        await ensureInvoiceDataFetched();
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;
        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for 'With Accounts' report.");
        const dailyEntries = [];
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                if (inv.status === 'With Accounts' && inv.releaseDate === selectedDate) dailyEntries.push({ po: poNumber, site: allPOs[poNumber]?.['Project ID'] || 'N/A', ...inv });
            }
        }
        if (dailyEntries.length === 0) { alert(`No invoices were moved to 'With Accounts' on ${selectedDate}.`); return; }
        let csvContent = "data:text/csv;charset=utf-8,";
        // Add 'Invoice Amount' to header
        const headers = ["PO", "Site", "srvName", "Invoice Amount"];
        csvContent += headers.join(",") + "\r\n";
        dailyEntries.forEach(entry => { 
            // Add 'invValue' to the row
            const row = [entry.po, entry.site, `"${(entry.srvName || '').replace(/"/g, '""')}"`, entry.invValue || '0'];
            csvContent += row.join(",") + "\r\n"; 
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `daily_with_accounts_report_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) { console.error("Error generating 'With Accounts' report:", error); alert("An error occurred while generating the report."); }
}
// --- END MODIFICATION (Req 2) ---


// BATCH INVOICE FUNCTIONS
// --- FIX: Updated populateApproverSelect for Batch ---
async function populateApproverSelect(selectElement) {
    // Ensure the global list is populated
    if (approverListForSelect.length === 0) {
        try {
            // await ensureInvoiceDataFetched(); // This is too slow here
            if (!allApproverData) { // If ensureInvoiceDataFetched didn't load it, load it now
                 const snapshot = await db.ref('approvers').once('value');
                 allApproverData = snapshot.val();
            }
            const approvers = allApproverData; // Use the cached full data
            if (approvers) {
                const approverOptions = Object.values(approvers)
                    .map(approver => {
                        // +++ START OF FIX: Combine fields for new label +++
                        if (!approver.Name) return null;
                        const name = approver.Name;
                        const position = approver.Position || 'No-Pos';
                        const site = approver.Site || 'No-Site';
                        const newLabel = `${name} - ${position} - ${site}`;
                        // +++ END OF FIX +++
                        return { value: name, label: newLabel }; // Value is still just the name
                    })
                    .filter(Boolean) // Remove nulls
                    .sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically
                approverListForSelect = [{ value: '', label: 'Select Attention', placeholder: true }, { value: 'None', label: 'None (Clear)' }, ...approverOptions];
            } else {
                 approverListForSelect = [{ value: '', label: 'No approvers found', placeholder: true }];
            }
        } catch (error) {
            console.error("Error fetching approvers for select:", error);
             approverListForSelect = [{ value: '', label: 'Error loading', placeholder: true }];
        }
    }

    // Populate the specific select element passed in
    selectElement.innerHTML = ''; // Clear existing options first
    approverListForSelect.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.placeholder) {
            option.disabled = true; // Make 'Select Attention' unselectable
            option.selected = true; // Ensure it's the default visible option
        }
        selectElement.appendChild(option);
    });
}
async function handleAddPOToBatch() {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const poNumber = batchPOInput.value.trim().toUpperCase();
    if (!poNumber) { alert("Please enter a PO Number."); return; }

    // --- MODIFICATION: Save search term ---
    sessionStorage.setItem('imBatchSearch', poNumber);
    sessionStorage.removeItem('imBatchNoteSearch'); // Clear note search
    // --- END MODIFICATION ---

    const batchTableBody = document.getElementById('im-batch-table-body');
    const existingRows = batchTableBody.querySelectorAll(`tr[data-po="${poNumber}"]`);
    let isExistingInvoice = false;
    existingRows.forEach(row => { if (!row.dataset.key) isExistingInvoice = true; });
    if (isExistingInvoice) { alert(`A new invoice for PO ${poNumber} is already in the batch list.`); return; }
    try {
        await ensureInvoiceDataFetched();
        const poData = allPOData[poNumber];
        if (!poData) { alert(`PO Number ${poNumber} not found.`); return; }
        const invoiceData = allInvoiceData[poNumber];

        // ++ UPDATED: Smart ID Generation for Batch
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
        // -- End of update

        const site = poData['Project ID'] || 'N/A';
        const vendor = poData['Supplier Name'] || 'N/A';
        const row = document.createElement('tr');
        row.setAttribute('data-po', poNumber); row.setAttribute('data-site', site); row.setAttribute('data-vendor', vendor); row.setAttribute('data-next-invid', nextInvId);

        // ++ UPDATED: Columns changed (Details removed, Inv. Name/SRV Name added) and default date
        row.innerHTML = `
            <td>${poNumber} <span class="new-indicator">(New)</span></td>
            <td>${site}</td>
            <td>${vendor}</td>
            <td><input type="text" name="invNumber" class="batch-input"></td>
            <td><input type="text" name="invName" class="batch-input"></td>
            <td><input type="text" name="srvName" class="batch-input"></td>
            <td><input type="date" name="invoiceDate" class="batch-input" value="${getTodayDateString()}"></td>
            <td><input type="number" name="invValue" class="batch-input" step="0.01"></td>
            <td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="0"></td>
            <td><select name="attention" class="batch-input"></select></td>
            <td><select name="status" class="batch-input">
                <option value="For SRV">For SRV</option>
                <option value="Pending">Pending</option>
                <option value="For IPC">For IPC</option>
                <option value="Under Review">Under Review</option>
                <option value="CEO Approval">CEO Approval</option>
                <option value="Report">Report</option>
                <option value="With Accounts">With Accounts</option>
            </select></td>
            <td><input type="text" name="note" class="batch-input"></td>
            <td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>
        `;
        batchTableBody.appendChild(row);

        const attentionSelect = row.querySelector('select[name="attention"]');
        const statusSelect = row.querySelector('select[name="status"]');
        const noteInput = row.querySelector('input[name="note"]');

        // --- FIX: Populate select FIRST, then initialize Choices ---
        await populateApproverSelect(attentionSelect); // Populate the raw select

        // Initialize Choices.js AFTER options are in the HTML
        const choices = new Choices(attentionSelect, {
            searchEnabled: true,
            shouldSort: false, // Keep original sort order
            itemSelectText: '',
            removeItemButton: true
        });
        row.choicesInstance = choices; // Store instance on the row

        // Now apply global value if it exists
        const globalAttnValue = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;
        if (globalAttnValue) {
            choices.setValue(globalAttnValue); // Use Choices API
        }
        // --- END FIX ---

        // --- FIX: Apply Global Status and Note values ---
        if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
        if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;
        // --- END FIX ---

        batchPOInput.value = ''; batchPOInput.focus();
    } catch (error) { console.error("Error adding PO to batch:", error); alert('An error occurred while adding the PO.'); }
}
async function addInvoiceToBatchTable(invData) {
    const batchTableBody = document.getElementById('im-batch-table-body');
    if (batchTableBody.querySelector(`tr[data-key="${invData.key}"]`)) return;
    const row = document.createElement('tr');
    row.setAttribute('data-po', invData.po); row.setAttribute('data-key', invData.key); row.setAttribute('data-site', invData.site); row.setAttribute('data-vendor', invData.vendor);

    // ++ UPDATED: Columns changed (Details removed, Inv. Name/SRV Name added)
    row.innerHTML = `
        <td>${invData.po} <span class="existing-indicator">(Existing: ${invData.invEntryID})</span></td>
        <td>${invData.site}</td>
        <td>${invData.vendor}</td>
        <td><input type="text" name="invNumber" class="batch-input" value="${invData.invNumber || ''}"></td>
        <td><input type="text" name="invName" class="batch-input" value="${invData.invName || ''}"></td>
        <td><input type="text" name="srvName" class="batch-input" value="${invData.srvName || ''}"></td>
        <td><input type="date" name="invoiceDate" class="batch-input" value="${normalizeDateForInput(invData.invoiceDate) || ''}"></td>
        <td><input type="number" name="invValue" class="batch-input" step="0.01" value="${invData.invValue || ''}"></td>
        <td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="${invData.amountPaid || '0'}"></td>
        <td><select name="attention" class="batch-input"></select></td>
        <td><select name="status" class="batch-input">
            <option value="For SRV">For SRV</option>
            <option value="Pending">Pending</option>
            <option value="For IPC">For IPC</option>
            <option value="Under Review">Under Review</option>
            <option value="CEO Approval">CEO Approval</option>
            <option value="Report">Report</option>
            <option value="With Accounts">With Accounts</option>
            <option value="On Hold">On Hold</option>
            <option value="CLOSED">CLOSED</option>
            <option value="Cancelled">Cancelled</option>
        </select></td>
        <td><input type="text" name="note" class="batch-input" value="${invData.note || ''}"></td>
        <td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>
    `;
    batchTableBody.prepend(row);
    const attentionSelect = row.querySelector('select[name="attention"]');
    const statusSelect = row.querySelector('select[name="status"]');
    const noteInput = row.querySelector('input[name="note"]');

    statusSelect.value = invData.status || 'For SRV';

    // --- FIX: Populate select FIRST, then initialize Choices ---
    await populateApproverSelect(attentionSelect); // Populate the raw select

    // Initialize Choices.js AFTER options are in the HTML
    const choices = new Choices(attentionSelect, {
        searchEnabled: true,
        shouldSort: false, // Keep original sort order
        itemSelectText: '',
        removeItemButton: true
    });
    row.choicesInstance = choices; // Store instance on the row

    // Now apply global or existing value
    const globalAttentionVal = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;
    if (globalAttentionVal) {
        choices.setValue(globalAttentionVal); // Use Choices API
    } else if (invData.attention) {
        choices.setChoiceByValue(invData.attention); // Set specific value if no global override
    }
    // --- END FIX ---

    // --- FIX: Apply Global Status and Note values ---
    if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
    if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;
    // --- END FIX ---
}

// --- *** START OF FIX (Batch Note Persistence) *** ---
async function handleBatchGlobalSearch(searchType) {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const searchTerm = batchPOInput.value.trim();
    if (searchType === 'status' && !searchTerm) {
        alert(`Please enter a ${searchType} to search for.`); return; 
    }
    
    let noteSearchTerm = '';
    if (searchType === 'note') {
        if (!imBatchNoteSearchChoices) { alert("Note search is not ready."); return; }
        noteSearchTerm = imBatchNoteSearchChoices.getValue(true);
        if (!noteSearchTerm) { alert("Please select a note from the dropdown to search."); return; }
    }
    
    const finalSearchTerm = (searchType === 'note') ? noteSearchTerm : searchTerm;

    // Save the search term that was used
    if (searchType === 'status') {
        sessionStorage.setItem('imBatchSearch', searchTerm);
        sessionStorage.removeItem('imBatchNoteSearch'); // Clear the other search
    } else if (searchType === 'note') {
        sessionStorage.setItem('imBatchNoteSearch', noteSearchTerm);
        sessionStorage.removeItem('imBatchSearch'); // Clear the other search
    }
    // --- *** END OF FIX *** ---
    
    if (!confirm(`This will scan all locally cached invoices.\n\nContinue searching for all invoices with ${searchType} "${finalSearchTerm}"?`)) return;
    
    batchPOInput.disabled = true; const originalPlaceholder = batchPOInput.placeholder; batchPOInput.placeholder = 'Searching local cache...';
    if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.disable();
    
    try {
        await ensureInvoiceDataFetched();
        const allPOs = allPOData, allInvoicesByPO = allInvoiceData;
        let invoicesFound = 0; const promises = [];
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber], poData = allPOs[poNumber] || {}, site = poData['Project ID'] || 'N/A', vendor = poData['Supplier Name'] || 'N/A';
            for (const key in invoices) {
                const inv = invoices[key]; let isMatch = false;
                
                if (searchType === 'status' && inv.status && inv.status.toLowerCase() === finalSearchTerm.toLowerCase()) isMatch = true;
                else if (searchType === 'note' && inv.note && inv.note === finalSearchTerm) isMatch = true; // Exact match for notes
                
                if (isMatch) { invoicesFound++; const invData = { key, po: poNumber, site, vendor, ...inv }; promises.push(addInvoiceToBatchTable(invData)); }
            }
        }
        await Promise.all(promises);
        if (invoicesFound === 0) alert(`No invoices found with the ${searchType} "${finalSearchTerm}".`);
        else { 
            alert(`Added ${invoicesFound} invoice(s) to the batch list.`); 
        }
    } catch (error) { console.error("Error during global batch search:", error); alert(`An error occurred: ${error.message}`); }
    finally { 
        batchPOInput.disabled = false; batchPOInput.placeholder = originalPlaceholder; 
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.enable();
    }
}

// --- (MODIFIED) handleSaveBatchInvoices ---
async function handleSaveBatchInvoices() {
    const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
    if (rows.length === 0) { alert("There are no invoices to save."); return; }
    if (!confirm(`You are about to save/update ${rows.length} invoice(s). Continue?`)) return;

    const savePromises = [];
    const localCacheUpdates = []; 
    let newInvoicesCount = 0, updatedInvoicesCount = 0;

    // --- (Req 3) MODIFIED: Add invEntryID to srvName helper ---
    const getSrvName = (poNumber, site, vendor, invEntryID) => {
        const today = new Date(), yyyy = today.getFullYear(), mm = String(today.getMonth() + 1).padStart(2, '0'), dd = String(today.getDate()).padStart(2, '0');
        if (vendor.length > 21) vendor = vendor.substring(0, 21);
        const invID = invEntryID || 'INV-XX'; // Fallback
        return `${yyyy}${mm}${dd}-${poNumber}-${invID}-${site}-${vendor}`;
    };
    // --- End (Req 3) MODIFICATION ---

    await ensureInvoiceDataFetched(); // Ensure allInvoiceData is present for lookup

    for (const row of rows) {
        const poNumber = row.dataset.po, site = row.dataset.site, existingKey = row.dataset.key; let vendor = row.dataset.vendor;
        let invEntryID = row.dataset.nextInvid; // For new invoices
        
        if (existingKey) {
            const existingIDSpan = row.querySelector('span.existing-indicator');
            if (existingIDSpan) {
                 const match = existingIDSpan.textContent.match(/\(Existing: (.*)\)/);
                 if (match && match[1]) invEntryID = match[1];
            }
        }

        const invoiceData = {
            invNumber: row.querySelector('[name="invNumber"]').value,
            invName: row.querySelector('[name="invName"]').value,
            srvName: row.querySelector('[name="srvName"]').value,
            invoiceDate: row.querySelector('[name="invoiceDate"]').value,
            invValue: row.querySelector('[name="invValue"]').value,
            amountPaid: row.querySelector('[name="amountPaid"]').value,
            status: row.querySelector('[name="status"]').value,
            note: row.querySelector('[name="note"]').value
        };

        invoiceData.releaseDate = getTodayDateString();
        invoiceData.attention = row.choicesInstance ? row.choicesInstance.getValue(true) : row.querySelector('select[name="attention"]').value;
        if (invoiceData.attention === 'None') invoiceData.attention = '';
        if (invoiceData.status === 'Under Review') invoiceData.attention = '';
        if (invoiceData.status === 'With Accounts') invoiceData.attention = '';
        if (!invoiceData.invValue) { alert(`Invoice Value is required for PO ${poNumber}. Cannot proceed.`); return; }
        if (vendor.length > 21) vendor = vendor.substring(0, 21);

        if (invoiceData.status === 'With Accounts' && !invoiceData.srvName) {
            invoiceData.srvName = getSrvName(poNumber, site, vendor, invEntryID);
        }

        let promise;
        let oldAttention = null;

        if (existingKey) {
            // --- ADD THIS (THE FIX) ---
            // Get the old attention before updating
            if (allInvoiceData[poNumber] && allInvoiceData[poNumber][existingKey]) {
                oldAttention = allInvoiceData[poNumber][existingKey].attention;
            }
            // --- END OF ADDITION ---

            promise = invoiceDb.ref(`invoice_entries/${poNumber}/${existingKey}`).update(invoiceData);
            
            // --- ADD THIS (THE FIX) ---
            // Add the task sync call to the promise list
            savePromises.push(updateInvoiceTaskLookup(poNumber, existingKey, invoiceData, oldAttention));
            // --- END OF ADDITION ---
            
            localCacheUpdates.push({ type: 'update', po: poNumber, key: existingKey, data: invoiceData });
            updatedInvoicesCount++;
        } else {
            invoiceData.invEntryID = invEntryID; // Use the pre-calculated nextInvId
            invoiceData.dateAdded = getTodayDateString();
            invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;
            if (!invoiceData.invName) {
                 invoiceData.invName = `${site}-${poNumber}-${invoiceData.invEntryID}-${vendor}`;
            }

            promise = invoiceDb.ref(`invoice_entries/${poNumber}`).push(invoiceData);
            newInvoicesCount++;

            // --- ADD THIS (THE FIX) ---
            // Add the task sync call, wrapped in a .then() to get the new key
            savePromises.push(
                promise.then(newRef => {
                    return updateInvoiceTaskLookup(poNumber, newRef.key, invoiceData, null); // oldAttention is null
                })
            );
            // --- END OF ADDITION ---

            localCacheUpdates.push({ type: 'add', po: poNumber, data: invoiceData, promise: promise });
        }
        // This promise is for the *write* operation, not the task sync
        savePromises.push(promise);
    }
    try {
        await Promise.all(savePromises);

        // --- NEW CACHE UPDATE LOGIC ---
        if (allInvoiceData) { 
            for (const update of localCacheUpdates) {
                if (update.type === 'update') {
                    if (!allInvoiceData[update.po]) allInvoiceData[update.po] = {};
                    if (!allInvoiceData[update.po][update.key]) allInvoiceData[update.po][update.key] = {};
                    allInvoiceData[update.po][update.key] = {
                        ...allInvoiceData[update.po][update.key],
                        ...update.data
                    };
                } else if (update.type === 'add') {
                    const newKey = update.promise.key;
                    if (newKey) {
                        if (!allInvoiceData[update.po]) allInvoiceData[update.po] = {};
                        allInvoiceData[update.po][newKey] = update.data;
                    }
                }
                
                if (update.data.note && update.data.note.trim() !== '') {
                    allUniqueNotes.add(update.data.note.trim());
                }
            }
            console.log("Local invoice cache updated surgically.");
        }
        // --- END FIX ---

        alert(`${newInvoicesCount} new invoice(s) created and ${updatedInvoicesCount} invoice(s) updated successfully!`);
        document.getElementById('im-batch-table-body').innerHTML = '';
        allSystemEntries = [];
    } catch (error) {
        console.error("Error saving batch invoices:", error);
        alert("An error occurred while saving. Please check the data and try again.");
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
        const poData = allPOData[poNumber], invoicesData = allInvoiceData[poNumber];
        if (!invoicesData) { modalResultsContainer.innerHTML = '<p>No invoices found for this PO.</p>'; return; }
        const site = poData ? poData['Project ID'] || 'N/A' : 'N/A', vendor = poData ? poData['Supplier Name'] || 'N/A' : 'N/A';
        let tableHTML = `<table><thead><tr><th><input type="checkbox" id="modal-select-all"></th><th>Inv. Entry ID</th><th>Inv. No.</th><th>Inv. Value</th><th>Status</th></tr></thead><tbody>`;
        const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        for (const [key, inv] of sortedInvoices) {
            const invDataString = encodeURIComponent(JSON.stringify({ key, po: poNumber, site, vendor, ...inv }));
            tableHTML += `<tr><td><input type="checkbox" class="modal-inv-checkbox" data-invoice='${invDataString}'></td><td>${inv.invEntryID || ''}</td><td>${inv.invNumber || ''}</td><td>${formatCurrency(inv.invValue)}</td><td>${inv.status || ''}</td></tr>`;
        }
        tableHTML += `</tbody></table>`;
        modalResultsContainer.innerHTML = tableHTML;
        document.getElementById('modal-select-all').addEventListener('change', (e) => { modalResultsContainer.querySelectorAll('.modal-inv-checkbox').forEach(chk => chk.checked = e.target.checked); });
    } catch (error) { console.error("Error searching in batch modal:", error); modalResultsContainer.innerHTML = '<p>An error occurred.</p>'; }
}
async function handleAddSelectedToBatch() {
    const selectedCheckboxes = document.getElementById('im-batch-modal-results').querySelectorAll('.modal-inv-checkbox:checked');
    if (selectedCheckboxes.length === 0) { alert("Please select at least one invoice."); return; }
    const promises = [];
    for (const checkbox of selectedCheckboxes) {
        const invData = JSON.parse(decodeURIComponent(checkbox.dataset.invoice));
        promises.push(addInvoiceToBatchTable(invData));
    }
    await Promise.all(promises);
    document.getElementById('im-batch-modal-po-input').value = '';
    document.getElementById('im-batch-modal-results').innerHTML = `<p>${selectedCheckboxes.length} invoice(s) were added to the batch. You can search for another PO.</p>`;
}

// --- MODIFICATION (Req 3 & 4) ---
// This function populates a datalist (<datalist>)
async function initializeNoteSuggestions() {
    const now = Date.now();
    
    // We will now ignore the timestamp and just check if the Set has been populated
    // This is because ensureInvoiceDataFetched() is now responsible for repopulating the Set
    if (allUniqueNotes.size > 0) {
        noteSuggestionsDatalist.innerHTML = '';
        // Convert Set to array, sort it, and then populate
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });
        return;
    }

    try {
        // This will populate allUniqueNotes if it's empty
        await ensureInvoiceDataFetched(); 
        
        noteSuggestionsDatalist.innerHTML = '';
        // Convert Set to array, sort it, and then populate
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

// --- NEW FUNCTION (Req 4) ---
// This function populates a Choices.js dropdown
async function populateNoteDropdown(choicesInstance) {
    if (!choicesInstance) return;

    // Check if the cache is already populated
    if (allUniqueNotes.size > 0) {
        const sortedNotes = Array.from(allUniqueNotes).sort();
        const noteOptions = sortedNotes.map(note => ({ value: note, label: note }));
        
        // Add a placeholder at the beginning
        choicesInstance.setChoices(
            [
                { value: '', label: 'Select a note to search...', placeholder: true },
                ...noteOptions
            ],
            'value',
            'label',
            true // true to replace all existing choices
        );
        return;
    }

    // If cache is empty, load data first
    choicesInstance.setChoices([{ value: '', label: 'Loading notes...', disabled: true }]);
    try {
        await ensureInvoiceDataFetched(); // This will populate allUniqueNotes
        
        const sortedNotes = Array.from(allUniqueNotes).sort();
        const noteOptions = sortedNotes.map(note => ({ value: note, label: note }));

        choicesInstance.setChoices(
            [
                { value: '', label: 'Select a note to search...', placeholder: true },
                ...noteOptions
            ],
            'value',
            'label',
            true
        );
    } catch (error) {
        console.error("Error populating note dropdown:", error);
        choicesInstance.setChoices([{ value: '', label: 'Error loading notes', disabled: true }]);
    }
}
// --- END MODIFICATION ---

// +++ MODIFIED: handleGenerateSummary +++
async function handleGenerateSummary() {
    // Helper function to get ordinal suffix (st, nd, rd, th)
    const getOrdinal = (n) => {
        if (isNaN(n) || n <= 0) return ''; // Handle invalid input
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const prevNote = summaryNotePreviousInput.value.trim(), currentNote = summaryNoteCurrentInput.value.trim();
    
    // --- MODIFICATION: Save search terms ---
    sessionStorage.setItem('imSummaryPrevNote', prevNote);
    sessionStorage.setItem('imSummaryCurrNote', currentNote);
    // --- END MODIFICATION ---

    if (!currentNote) { alert("Please enter a note for the 'Current Note' search."); return; }
    summaryNoteGenerateBtn.textContent = 'Generating...'; summaryNoteGenerateBtn.disabled = true;
    try {
        await ensureInvoiceDataFetched(); // Ensures allPOData, allInvoiceData, and allEpicoreData are loaded
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;
        const epicoreData = allEpicoreData; // Get the cached Epicore data

        let previousPaymentTotal = 0, currentPaymentTotal = 0, allCurrentInvoices = [];
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                if (inv.note) {
                    const vendorName = (allPOs[poNumber] && allPOs[poNumber]['Supplier Name']) ? allPOs[poNumber]['Supplier Name'] : 'N/A';
                    if (prevNote && inv.note === prevNote) previousPaymentTotal += parseFloat(inv.invValue) || 0;
                    if (inv.note === currentNote) {
                        const site = (allPOs[poNumber] && allPOs[poNumber]['Project ID']) ? allPOs[poNumber]['Project ID'] : 'N/A';
                        currentPaymentTotal += parseFloat(inv.invValue) || 0;
                        allCurrentInvoices.push({ po: poNumber, key: key, site, vendor: vendorName, ...inv });
                    }
                }
            }
        }
        if (allCurrentInvoices.length === 0) { alert(`No invoices found with the note: "${currentNote}"`); summaryNotePrintArea.classList.add('hidden'); return; }
        allCurrentInvoices.sort((a, b) => (a.site || '').localeCompare(b.site || ''));
        const vendorData = allPOs[allCurrentInvoices[0].po];
        snVendorName.textContent = vendorData ? vendorData['Supplier Name'] : 'N/A';
        const today = new Date();
        snDate.textContent = `Date: ${today.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).replace(/ /g, '-')}`;
        snPreviousPayment.textContent = `${formatCurrency(previousPaymentTotal)} Qatari Riyals`;
        snCurrentPayment.textContent = `${formatCurrency(currentPaymentTotal)} Qatari Riyals`;
        snTableBody.innerHTML = '';
        for (const inv of allCurrentInvoices) {
            const row = document.createElement('tr');
            row.setAttribute('data-po', inv.po); row.setAttribute('data-key', inv.key);

            // Get description from epicoreData or fallback to inv.details
            const poKey = inv.po.toUpperCase();
            const epicoreDescription = (epicoreData && epicoreData[poKey]) ? epicoreData[poKey] : (inv.details || '');

            // --- MODIFIED: Convert invEntryID to ordinal number ---
            let invCountDisplay = '';
            if (inv.invEntryID) {
                const match = inv.invEntryID.match(/INV-(\d+)/i); // Extract number after "INV-"
                if (match && match[1]) {
                    const num = parseInt(match[1], 10);
                    invCountDisplay = getOrdinal(num); // Convert to "1st", "2nd", etc.
                } else {
                    invCountDisplay = inv.invEntryID; // Fallback if format is unexpected
                }
            }
            // --- END MODIFICATION ---

            // --- MODIFIED row.innerHTML to use invCountDisplay ---
            row.innerHTML = `
                <td>${invCountDisplay}</td>
                <td>${inv.po}</td>
                <td>${inv.site}</td>
                <td><input type="text" class="summary-edit-input" name="details" value="${epicoreDescription}"></td>
                <td><input type="date" class="summary-edit-input" name="invoiceDate" value="${normalizeDateForInput(inv.invoiceDate) || ''}"></td>
                <td>${formatCurrency(inv.invValue)}</td>
            `;
            // --- END MODIFICATION ---
            snTableBody.appendChild(row);
        }
        snTotalNumeric.textContent = formatCurrency(currentPaymentTotal);
        snTotalInWords.textContent = numberToWords(currentPaymentTotal);
        summaryNotePrintArea.classList.remove('hidden');
    } catch (error) { console.error("Error generating summary:", error); alert("An error occurred. Please check the notes and try again."); }
    finally { summaryNoteGenerateBtn.textContent = 'Generate Summary'; summaryNoteGenerateBtn.disabled = false; }
}

// --- (MODIFIED) handleUpdateSummaryChanges ---
async function handleUpdateSummaryChanges() {
    const rows = snTableBody.querySelectorAll('tr');
    if (rows.length === 0) { alert("No data to update."); return; }
    if (!confirm("Are you sure you want to save the changes for all visible entries?")) return;
    summaryNoteUpdateBtn.textContent = "Updating..."; summaryNoteUpdateBtn.disabled = true;
    const newGlobalStatus = document.getElementById('summary-note-status-input').value, newGlobalSRV = document.getElementById('summary-note-srv-input').value.trim(), today = getTodayDateString();

    const updatePromises = [];
    const localCacheUpdates = []; 

    try {
        await ensureInvoiceDataFetched(); // Ensure allInvoiceData is loaded for lookup

        for (const row of rows) {
            const poNumber = row.dataset.po, invoiceKey = row.dataset.key;
            const newDetails = row.querySelector('input[name="details"]').value, newInvoiceDate = row.querySelector('input[name="invoiceDate"]').value;
            if (poNumber && invoiceKey) {
                const updates = { details: newDetails, invoiceDate: newInvoiceDate, releaseDate: today };
                if (newGlobalStatus) updates.status = newGlobalStatus;
                if (newGlobalSRV) updates.srvName = newGlobalSRV;
                if (newGlobalStatus === 'With Accounts') updates.attention = '';

                updatePromises.push(invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates));
                localCacheUpdates.push({ po: poNumber, key: invoiceKey, data: updates }); 
                
                // --- ADD THIS (THE FIX) ---
                // We must also update the lookup table
                const originalInvoice = (allInvoiceData && allInvoiceData[poNumber]) ? allInvoiceData[poNumber][invoiceKey] : {};
                const updatedInvoiceData = {...originalInvoice, ...updates};
                updatePromises.push(updateInvoiceTaskLookup(poNumber, invoiceKey, updatedInvoiceData, originalInvoice.attention));
                // --- END OF ADDITION ---
            }
        }
        await Promise.all(updatePromises);

        // --- NEW CACHE UPDATE LOGIC ---
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
        // --- END FIX ---

        alert("Changes saved successfully!");
    } catch (error) {
        console.error("Error updating summary changes:", error);
        alert("An error occurred while saving the changes.");
    }
    finally {
        summaryNoteUpdateBtn.textContent = "Update Changes";
        summaryNoteUpdateBtn.disabled = false;
        document.getElementById('summary-note-status-input').value = '';
        document.getElementById('summary-note-srv-input').value = '';
    }
}

// ++ NEW: Functions for Payments Section ++
async function handlePaymentModalPOSearch() {
    const poNumber = imPaymentModalPOInput.value.trim().toUpperCase();
    if (!poNumber) {
        imPaymentModalResults.innerHTML = '<p>Please enter a PO Number.</p>';
        return;
    }
    imPaymentModalResults.innerHTML = '<p>Searching...</p>';

    try {
        await ensureInvoiceDataFetched(); // Ensure latest data
        const poData = allPOData[poNumber];
        const invoicesData = allInvoiceData[poNumber];
        const site = poData ? poData['Project ID'] || 'N/A' : 'N/A';
        const vendor = poData ? poData['Supplier Name'] || 'N/A' : 'N/A';

        let resultsFound = false;
        let tableHTML = `<table><thead><tr><th><input type="checkbox" id="payment-modal-select-all"></th><th>Inv. Entry ID</th><th>Inv. Value</th><th>Status</th></tr></thead><tbody>`;

        if (invoicesData) {
            const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));

            for (const [key, inv] of sortedInvoices) {
                if (inv.status === 'With Accounts' && !invoicesToPay[key]) {
                    resultsFound = true;
                    tableHTML += `<tr>
                        <td><input type="checkbox" class="payment-modal-inv-checkbox" data-key='${key}' data-po='${poNumber}'></td>
                        <td>${inv.invEntryID || ''}</td>
                        <td>${formatCurrency(inv.invValue)}</td>
                        <td>${inv.status || ''}</td>
                    </tr>`;
                }
            }
        }

        if (!resultsFound) {
            imPaymentModalResults.innerHTML = '<p>No invoices found for this PO with status "With Accounts" that haven\'t already been added.</p>';
        } else {
            tableHTML += `</tbody></table>`;
            imPaymentModalResults.innerHTML = tableHTML;
            document.getElementById('payment-modal-select-all').addEventListener('change', (e) => {
                imPaymentModalResults.querySelectorAll('.payment-modal-inv-checkbox').forEach(chk => chk.checked = e.target.checked);
            });
        }
    } catch (error) {
        console.error("Error searching in payment modal:", error);
        imPaymentModalResults.innerHTML = '<p>An error occurred while searching.</p>';
    }
}
function handleAddSelectedToPayments() {
    const selectedCheckboxes = imPaymentModalResults.querySelectorAll('.payment-modal-inv-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        alert("Please select at least one invoice.");
        return;
    }

    selectedCheckboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        const poNumber = checkbox.dataset.po;

        const originalInvData = (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][key])
            ? allInvoiceData[poNumber][key]
            : null;

        if (!originalInvData) {
             console.warn(`Could not find invoice data in cache for key: ${key}, PO: ${poNumber}`);
             return; 
        }

        const invData = {
            key: key,
            po: poNumber,
            site: allPOData[poNumber]?.['Project ID'] || 'N/A',
            vendor: allPOData[poNumber]?.['Supplier Name'] || 'N/A',
            invEntryID: originalInvData.invEntryID || '',
            invValue: originalInvData.invValue || '0',
            currentAmountPaid: originalInvData.amountPaid || '0',
            status: originalInvData.status,
            attention: originalInvData.attention // --- ADD THIS to get oldAttention
        };

        if (!invoicesToPay[invData.key]) { 
            invoicesToPay[invData.key] = invData; 

            const row = document.createElement('tr');
            row.setAttribute('data-key', invData.key);
            row.setAttribute('data-po', invData.po); 

            row.innerHTML = `
                <td>${invData.po}</td>
                <td>${invData.site}</td>
                <td>${invData.vendor}</td>
                <td>${invData.invEntryID}</td>
                <td><input type="number" name="invValue" class="payment-input" step="0.01" value="${invData.invValue || '0'}"></td>
                <td><input type="number" name="amountPaid" class="payment-input" step="0.01" value="${invData.invValue || '0'}"></td> 
                <td><input type="date" name="releaseDate" class="payment-input" value="${getTodayDateString()}"></td>
                <td>${invData.status}</td>
                <td><button type="button" class="delete-btn payment-remove-btn">&times;</button></td>
            `;
            imPaymentsTableBody.appendChild(row);
        }
    });

    imAddPaymentModal.classList.add('hidden'); // Close the modal
}

// --- (MODIFIED) handleSavePayments ---
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
        const originalInvoiceData = invoicesToPay[invoiceKey]; // Get the original data

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
        
        // --- ADD THIS (THE FIX) ---
        // Pass the full updated data and the oldAttention to the helper
        // This will remove it from the user's inbox
        const updatedFullData = {...originalInvoiceData, ...updates};
        savePromises.push(
            updateInvoiceTaskLookup(poNumber, invoiceKey, updatedFullData, originalInvoiceData.attention)
        );
        // --- END OF ADDITION ---

        localCacheUpdates.push({ po: poNumber, key: invoiceKey, data: updates }); 
        updatesMade++;
    }

    try {
        await Promise.all(savePromises);

        // --- NEW CACHE UPDATE LOGIC ---
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
        // --- END FIX ---

        alert(`${updatesMade} payment(s) processed successfully! Invoices updated to 'Paid'.`);
        imPaymentsTableBody.innerHTML = ''; // Clear the table
        invoicesToPay = {}; // Reset the state
        allSystemEntries = []; // Clear system cache as statuses changed
    } catch (error) {
        console.error("Error saving payments:", error);
        alert("An error occurred while saving payments. Some updates may have failed. Please check the data and try again.");
    }
}


// ++ NEW: Functions for read-only Finance Report section ++
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
            } else {
                imFinanceNoResults.style.display = 'none';
                imFinanceAllPaymentsData = {};
                snapshot.forEach(childSnapshot => {
                    imFinanceAllPaymentsData[childSnapshot.key] = { id: childSnapshot.key, ...childSnapshot.val() };
                });
                showFinanceSearchResults(Object.values(imFinanceAllPaymentsData));
            }
        })
        .catch(error => console.error('Error searching payments:', error));
}

function showFinanceSearchResults(payments) {
    imFinanceResultsBody.innerHTML = '';
    if (payments.length === 0) return;

    const firstPayment = payments[0];
    const { site, vendor, vendorId, poNo, poValue } = firstPayment;

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
                </table>
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
        let totalCertified = 0, totalRetention = 0, totalPayment = 0, totalPrevPayment = 0;
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

function printFinanceReport() {
    // Just call the browser's print function. CSS will handle the rest.
    window.print();
}

// LOGOUT FUNCTION
function handleLogout() {
    sessionStorage.clear(); // Clear all session data on logout
    if (dateTimeInterval) clearInterval(dateTimeInterval);
    if (workdeskDateTimeInterval) clearInterval(workGdeskDateTimeInterval);
    if (imDateTimeInterval) clearInterval(imDateTimeInterval);
    location.reload();
}
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    const savedApproverKey = sessionStorage.getItem('approverKey');
    if (savedApproverKey) {
        currentApprover = await getApproverByKey(savedApproverKey);
        if (currentApprover) {
            console.log("Resuming session for:", currentApprover.Name);
            handleSuccessfulLogin();
        } else {
            console.log("Saved key found but no user data fetched, clearing session.");
            sessionStorage.removeItem('approverKey');
            showView('login');
        }
    } else {
        showView('login');
    }

    loginForm.addEventListener('submit', async (e) => { e.preventDefault(); loginError.textContent = ''; const identifier = loginIdentifierInput.value.trim(); try { const approver = await findApprover(identifier); if (!approver) { loginError.textContent = 'Access denied. Your email or mobile is not registered as an approver.'; return; } currentApprover = approver; if (!currentApprover.Password || currentApprover.Password === '') { const isEmailMissing = !currentApprover.Email, isSiteMissing = !currentApprover.Site, isPositionMissing = !currentApprover.Position; setupEmailContainer.classList.toggle('hidden', !isEmailMissing); setupSiteContainer.classList.toggle('hidden', !isSiteMissing); setupPositionContainer.classList.toggle('hidden', !isPositionMissing); setupEmailInput.required = isEmailMissing; setupSiteInput.required = isSiteMissing; setupPositionInput.required = isPositionMissing; showView('setup'); setupPasswordInput.focus(); } else { passwordUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile; showView('password'); passwordInput.focus(); } } catch (error) { console.error("Error checking approver:", error); loginError.textContent = 'An error occurred. Please try again.'; } });
    setupForm.addEventListener('submit', async (e) => { e.preventDefault(); setupError.textContent = ''; const newPassword = setupPasswordInput.value, finalEmail = currentApprover.Email || setupEmailInput.value.trim(), finalSite = currentApprover.Site || setupSiteInput.value.trim(), finalPosition = currentApprover.Position || setupPositionInput.value.trim(); if (!finalEmail.toLowerCase().endsWith('@iba.com.qa')) { setupError.textContent = 'Invalid email. Only @iba.com.qa addresses are allowed.'; return; } if (newPassword.length < 6) { setupError.textContent = 'Password must be at least 6 characters long.'; return; } try { const updates = { Password: newPassword, Email: finalEmail, Site: finalSite, Position: finalPosition }; await db.ref(`approvers/${currentApprover.key}`).update(updates); currentApprover = { ...currentApprover, ...updates }; handleSuccessfulLogin(); } catch (error) { console.error("Error during setup:", error); setupError.textContent = 'An error occurred while saving. Please try again.'; } });
    passwordForm.addEventListener('submit', (e) => { e.preventDefault(); passwordError.textContent = ''; const enteredPassword = passwordInput.value; if (enteredPassword === currentApprover.Password) { handleSuccessfulLogin(); } else { passwordError.textContent = 'Incorrect password. Please try again.'; passwordInput.value = ''; } });


    logoutButton.addEventListener('click', handleLogout);
    wdLogoutButton.addEventListener('click', handleLogout);
    imLogoutButton.addEventListener('click', handleLogout);
    workdeskButton.addEventListener('click', () => { if (!currentApprover) { handleLogout(); return; }
        wdUsername.textContent = currentApprover.Name || 'User';
        wdUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        // ++ MODIFIED: Show IM link for everyone ++
        workdeskIMLinkContainer.classList.remove('hidden');


        if (!siteSelectChoices) {
            siteSelectChoices = new Choices(document.getElementById('job-site'), { searchEnabled: true, shouldSort: false, itemSelectText: '', });
            populateSiteDropdown();
        }
        if (!attentionSelectChoices) {
            const attentionElement = document.getElementById('job-attention');
            attentionSelectChoices = new Choices(attentionElement, { searchEnabled: true, shouldSort: false, itemSelectText: '', });
            populateAttentionDropdown(attentionSelectChoices);
            // ++ UPDATED: Event listener for vacation modal with direct store lookup ++
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
        
        // --- (NEW) "Invoice" Job Logic for Attention field ---
        jobForSelect.addEventListener('change', (e) => { 
            const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs'; 
            const isInvoice = e.target.value === 'Invoice';
            
            if (isInvoice) {
                // --- (NEW) Logic for "Invoice" ---
                attentionSelectChoices.clearStore(); 
                attentionSelectChoices.setChoices([{ value: '', label: 'Auto-assigned to Accounting', disabled: true, selected: true }], 'value', 'label', false); 
                attentionSelectChoices.disable(); 
                // --- (END NEW) ---
            } else if (e.target.value === 'IPC' && isQS) { 
                attentionSelectChoices.clearStore(); 
                attentionSelectChoices.setChoices([{ value: 'All', label: 'All', selected: true }], 'value', 'label', false); 
                attentionSelectChoices.disable(); 
            } else if (attentionSelectChoices.disabled) { 
                attentionSelectChoices.enable(); 
                populateAttentionDropdown(attentionSelectChoices); // Repopulate
            } 
        });
        // --- (END NEW) ---

        // ++ NEW: Initialize Modify Task Modal Dropdown ++
        if (!modifyTaskAttentionChoices) {
            modifyTaskAttentionChoices = new Choices(modifyTaskAttention, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
            });
            populateAttentionDropdown(modifyTaskAttentionChoices); 
        }

        updateWorkdeskDateTime();
        if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
        workdeskDateTimeInterval = setInterval(updateWorkdeskDateTime, 1000);
        showView('workdesk');
        showWorkdeskSection('wd-dashboard');
    });

    // ++ ADDED: Event listener for new sidebar link ++
    workdeskIMLink.addEventListener('click', (e) => {
        e.preventDefault();
        invoiceManagementButton.click();
    });

    document.querySelector('#workdesk-view .workdesk-sidebar').addEventListener('click', (e) => { const link = e.target.closest('a'); if (!link || link.classList.contains('back-to-main-dashboard') || link.id === 'wd-logout-button' || link.id === 'workdesk-im-link') return; e.preventDefault(); if (link.hasAttribute('data-section')) { document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active')); link.classList.add('active'); showWorkdeskSection(link.getAttribute('data-section')); } });
    addJobButton.addEventListener('click', handleAddJobEntry);
    updateJobButton.addEventListener('click', handleUpdateJobEntry);
    clearJobButton.addEventListener('click', () => resetJobEntryForm(false));
    jobEntryTableBody.addEventListener('click', (e) => { const row = e.target.closest('tr'); if (row) { const key = row.getAttribute('data-key'); 
    // --- MODIFICATION ---
    // We must call ensureAllEntriesFetched to make sure allSystemEntries is populated for editing
    ensureAllEntriesFetched().then(() => {
        const entry = allSystemEntries.find(item => item.key === key); 
        if (key && entry && entry.source !== 'invoice') populateFormForEditing(key); 
    });
    // --- END MODIFICATION ---
    } });

    // --- (MODIFIED) activeTaskTableBody click listener (THE FIX) ---
    activeTaskTableBody.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        if (!row) return;

        const key = row.dataset.key;
        if (!key) return;
        
        // Find task in the fresh userActiveTasks list
        const taskData = userActiveTasks.find(entry => entry.key === key);
        if (!taskData) {
             alert("Could not find task details. The list may be out of date. Please refresh.");
             return;
        }


        // Handle "SRV Done" button click
        if (e.target.classList.contains('srv-done-btn')) {
            e.target.disabled = true; // Prevent double click
            e.target.textContent = 'Updating...';

            try {
                if (taskData.source === 'invoice') {
                    // This is an invoice entry from invoice DB
                    const updates = {
                        releaseDate: getTodayDateString(),
                        status: 'SRV Done'
                    };
                    await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update(updates);
                    
                    // --- ADD THIS LINE (THE FIX) ---
                    // Find the original invoice data to pass to the helper
                    if (!allInvoiceData) await ensureInvoiceDataFetched(); 
                    const originalInvoice = (allInvoiceData && allInvoiceData[taskData.originalPO]) ? allInvoiceData[taskData.originalPO][taskData.originalKey] : {};
                    const updatedInvoiceData = {...originalInvoice, ...updates};
                    await updateInvoiceTaskLookup(taskData.originalPO, taskData.originalKey, updatedInvoiceData, taskData.attention);
                    // --- END OF ADDITION ---

                } else if (taskData.source === 'job_entry') {
                    // This is a job entry from main DB
                    const updates = {
                        dateResponded: formatDate(new Date()),
                        remarks: 'SRV Done'
                    };
                    await db.ref(`job_entries/${taskData.key}`).update(updates);
                    
                    // --- ADD THIS LINE (THE FIX) ---
                    const updatedJobData = {...taskData, ...updates}; // Merge original task data with updates
                    await updateJobTaskLookup(taskData.key, updatedJobData, taskData.attention);
                    // --- END OF ADDITION ---
                }
                
                alert('Task status updated to "SRV Done".');
                
                await populateActiveTasks(); // This is now fast!

            } catch (error) {
                console.error("Error updating task status:", error);
                alert("Failed to update task status. Please try again.");
                e.target.disabled = false; // Re-enable button on error
                e.target.textContent = 'SRV Done';
            }
            return;
        }

        // Handle "Modify" button click
        if (e.target.classList.contains('modify-btn')) {
            openModifyTaskModal(taskData);
            return;
        }
        
        // --- *** START OF WORKFLOW FIX *** ---
        const userPositionLower = (currentApprover?.Position || '').toLowerCase();
        // --- (MODIFIED) Check for "Accounting" position ---
        const isAccountingPosition = userPositionLower === 'accounting';

        if (taskData.source === 'job_entry' && taskData.for === 'Invoice' && isAccountingPosition) {
        // --- *** END OF WORKFLOW/MODIFICATION *** ---
             if (!taskData.po) {
                alert("This job entry is missing a PO number and cannot be processed in Invoice Management.");
                return;
            }
            jobEntryToUpdateAfterInvoice = key;
            pendingJobEntryDataForInvoice = taskData;
            invoiceManagementButton.click();
            setTimeout(() => {
                imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                imPOSearchInput.value = taskData.po;
                imPOSearchButton.click();
                imBackToActiveTaskButton.classList.remove('hidden');
            }, 100);
            return;
        }

        // Handle clicking the row to open PDF
        if (taskData && taskData.source === 'invoice' && taskData.invName && taskData.invName.trim() && taskData.invName.toLowerCase() !== 'nil') {
            window.open(PDF_BASE_PATH + encodeURIComponent(taskData.invName) + ".pdf", '_blank');
        }
    });

    // ++ NEW: Modify Task Modal Listeners ++
    if (modifyTaskStatus) {
        modifyTaskStatus.addEventListener('change', (e) => {
            modifyTaskStatusOtherContainer.classList.toggle('hidden', e.target.value !== 'Other');
        });
    }
    if (modifyTaskSaveBtn) {
        modifyTaskSaveBtn.addEventListener('click', handleSaveModifiedTask);
    }

    activeTaskSearchInput.addEventListener('input', debounce((e) => handleActiveTaskSearch(e.target.value), 500));
    jobEntrySearchInput.addEventListener('input', debounce((e) => handleJobEntrySearch(e.target.value), 500));
    // --- (REMOVED) Task History listener ---
    // --- (END REMOVAL) ---
    reportingSearchInput.addEventListener('input', debounce(() => {
        ensureAllEntriesFetched().then(() => { // ensure job_entries are loaded
             filterAndRenderReport(allSystemEntries);
        });
    }, 500));
    
    // --- *** WORKDESK PRINT BUTTON FIX (START) *** ---
    printReportButton.addEventListener('click', () => {
        if (summaryNotePrintArea) summaryNotePrintArea.classList.add('hidden');
        if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
        if (imFinanceReportModal) imFinanceReportModal.classList.add('hidden');
        
        const wdPrintArea = document.getElementById('reporting-printable-area');
        if(wdPrintArea) {
            wdPrintArea.classList.add('printing');
            document.body.classList.add('workdesk-print-active'); 
        }

        window.print(); 

        setTimeout(() => {
            if(wdPrintArea) {
                wdPrintArea.classList.remove('printing');
                document.body.classList.remove('workdesk-print-active');
            }
        }, 1000);
    });
    // --- *** WORKDESK PRINT BUTTON FIX (END) *** ---
    
    downloadWdReportButton.addEventListener('click', handleDownloadWorkdeskCSV);
    reportTabsContainer.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { reportTabsContainer.querySelector('.active').classList.remove('active'); e.target.classList.add('active'); currentReportFilter = e.target.getAttribute('data-job-type'); 
    ensureAllEntriesFetched().then(() => { // ensure job_entries are loaded
        filterAndRenderReport(allSystemEntries); 
    });
    } });
    document.querySelectorAll('.back-to-main-dashboard').forEach(button => button.addEventListener('click', (e) => { e.preventDefault(); showView('dashboard'); }));

    invoiceManagementButton.addEventListener('click', async () => {
        if (!currentApprover) { handleLogout(); return; }
        imUsername.textContent = currentApprover.Name || 'User';
        imUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        if (imAttentionSelectChoices) {
            imAttentionSelect.removeEventListener('choice', handleIMAttentionChoice); 
            imAttentionSelectChoices.destroy();
        }
        imAttentionSelectChoices = new Choices(imAttentionSelect, { searchEnabled: true, shouldSort: false, itemSelectText: '' });
        await populateAttentionDropdown(imAttentionSelectChoices); 

        imAttentionSelect.addEventListener('choice', handleIMAttentionChoice); 

        const userPositionLower = (currentApprover.Position || '').toLowerCase();
        const userRoleLower = (currentApprover.Role || '').toLowerCase();
        const isAccountingAdmin = userPositionLower === 'accounting' && userRoleLower === 'admin';
        const isAccountsOrAccounting = userPositionLower === 'accounts' || userPositionLower === 'accounting';
        const isAdmin = userRoleLower === 'admin';
        const isAccountingPosition = userPositionLower === 'accounting';

        const imNavLinks = imNav.querySelectorAll('li');

        imNavLinks.forEach(li => {
            const link = li.querySelector('a');
             if (!link) return;
            const section = link.dataset.section;
            li.style.display = '';

            if (section === 'im-invoice-entry' || section === 'im-batch-entry' || section === 'im-summary-note') {
                if (!isAccountingAdmin) li.style.display = 'none';
            }
            if (section === 'im-payments') {
                if (isAccountsOrAccounting) {
                    link.classList.remove('hidden'); 
                } else {
                    li.style.display = 'none'; 
                }
            }
            if (section === 'im-finance-report') {
                if (!isAdmin) li.style.display = 'none';
            }
        });

        document.getElementById('im-nav-workdesk').classList.remove('hidden');
        document.getElementById('im-nav-activetask').classList.remove('hidden');

        imReportingDownloadCSVButton.style.display = isAccountingPosition ? 'inline-block' : 'none';
        imDownloadDailyReportButton.style.display = isAccountingPosition ? 'inline-block' : 'none';
        imDownloadWithAccountsReportButton.style.display = isAccountingPosition ? 'inline-block' : 'none';
        imDailyReportDateInput.style.display = isAccountingPosition ? 'inline-block' : 'none';

        imReportingPrintBtn.disabled = !isAccountingAdmin;


        updateIMDateTime();
        if (imDateTimeInterval) clearInterval(imDateTimeInterval);
        imDateTimeInterval = setInterval(updateIMDateTime, 1000);
        showView('invoice-management');
        if (window.innerWidth <= 768) {
            showIMSection('im-reporting'); // Default mobile view
            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            const reportingLink = imNav.querySelector('a[data-section="im-reporting"]');
            if (reportingLink) reportingLink.classList.add('active');
        } else {
            showIMSection('im-dashboard'); // Default desktop view
            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            const dashboardLink = imNav.querySelector('a[data-section="im-dashboard"]');
            if (dashboardLink) dashboardLink.classList.add('active');
        }
    });

    function handleIMAttentionChoice(event) {
        if (event.detail && event.detail.value && imAttentionSelectChoices) {
            const selectedValue = event.detail.value;
            const selectedChoice = imAttentionSelectChoices._store.choices.find(c => c.value === selectedValue); 

            if (selectedChoice) {
                 if (selectedChoice.customProperties && selectedChoice.customProperties.onVacation === true) { 
                    vacationingUserName.textContent = selectedChoice.value;
                    vacationReturnDate.textContent = selectedChoice.customProperties.returnDate || 'N/A';
                    replacementNameDisplay.textContent = selectedChoice.customProperties.replacement.name;
                    replacementContactDisplay.textContent = selectedChoice.customProperties.replacement.contact;
                    replacementEmailDisplay.textContent = selectedChoice.customProperties.replacement.email;
                    vacationModal.classList.remove('hidden');
                }
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

    imNav.addEventListener('click', (e) => { const link = e.target.closest('a'); if (!link || link.classList.contains('disabled') || link.parentElement.style.display === 'none' || link.id === 'im-workdesk-button' || link.id === 'im-activetask-button') return; e.preventDefault(); const sectionId = link.getAttribute('data-section'); if (sectionId) { imNav.querySelectorAll('a').forEach(a => a.classList.remove('active')); link.classList.add('active'); showIMSection(sectionId); } });
    
    imPOSearchButton.addEventListener('click', () => handlePOSearch(imPOSearchInput.value));
    imPOSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handlePOSearch(imPOSearchInput.value); } });
    imPOSearchButtonBottom.addEventListener('click', () => handlePOSearch(imPOSearchInputBottom.value));
    imPOSearchInputBottom.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handlePOSearch(imPOSearchInputBottom.value); } });

    if (imShowActiveJobsBtn) {
        imShowActiveJobsBtn.addEventListener('click', () => {
            imEntrySidebar.classList.toggle('visible');
        });
    }
    if (imEntrySidebarList) {
        imEntrySidebarList.addEventListener('click', handleActiveJobClick);
    }


    imAddInvoiceButton.addEventListener('click', handleAddInvoice);
    imUpdateInvoiceButton.addEventListener('click', handleUpdateInvoice);
    imClearFormButton.addEventListener('click', () => { currentPO ? resetInvoiceForm() : resetInvoiceEntryPage(); });
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
        if (pdfLink) {
            return;
        }
        const row = e.target.closest('tr');
        if (row) {
            populateInvoiceFormForEditing(row.getAttribute('data-key'));
        }
    });

    imReportingContent.addEventListener('click', (e) => { 
        const expandBtn = e.target.closest('.expand-btn'); 
        if (expandBtn) { 
            const masterRow = expandBtn.closest('.master-row'); 
            const detailRow = document.querySelector(masterRow.dataset.target); 
            if (detailRow) { 
                detailRow.classList.toggle('hidden'); 
                expandBtn.textContent = detailRow.classList.contains('hidden') ? '+' : '−'; 
            } 
            return; 
        }

        const invoiceRow = e.target.closest('.nested-invoice-row');
        if (invoiceRow) {
            const poNumber = invoiceRow.dataset.poNumber;
            const invoiceKey = invoiceRow.dataset.invoiceKey;
            
            if (!poNumber || !invoiceKey) {
                alert("Error: Could not find invoice details for this row.");
                return;
            }

            if (confirm(`Do you want to edit this invoice?\n\PO: ${poNumber}\nInvoice Key: ${invoiceKey}`)) {
                imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                setTimeout(() => {
                    handlePOSearch(poNumber).then(() => {
                        populateInvoiceFormForEditing(invoiceKey);
                    });
                }, 100); 
            }
            return; 
        }
    });

    imReportingForm.addEventListener('submit', (e) => { e.preventDefault(); const searchTerm = imReportingSearchInput.value.trim(); if (!searchTerm && !document.getElementById('im-reporting-site-filter').value && !document.getElementById('im-reporting-date-filter').value && !document.getElementById('im-reporting-status-filter').value) { imReportingContent.innerHTML = '<p style="color: red; font-weight: bold;">Please specify at least one search criteria.</p>'; return; } populateInvoiceReporting(searchTerm); });
    imReportingClearButton.addEventListener('click', () => { imReportingForm.reset(); sessionStorage.removeItem('imReportingSearch'); imReportingContent.innerHTML = '<p>Please enter a search term and click Search.</p>'; currentReportData = []; });
    imReportingDownloadCSVButton.addEventListener('click', handleDownloadCSV);
    imDownloadDailyReportButton.addEventListener('click', handleDownloadDailyReport);
    if(imDownloadWithAccountsReportButton) imDownloadWithAccountsReportButton.addEventListener('click', handleDownloadWithAccountsReport);
    if(imReportingPrintBtn) imReportingPrintBtn.addEventListener('click', handleGeneratePrintReport);

    
    imStatusSelect.addEventListener('change', (e) => {
        if (imAttentionSelectChoices) {
            if (e.target.value === 'CEO Approval') {
                imAttentionSelectChoices.setChoiceByValue('Mr. Hamad');
            } else if (e.target.value === 'Under Review') {
                imAttentionSelectChoices.removeActiveItems();
            }
        }
    });
    settingsForm.addEventListener('submit', handleUpdateSettings);
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

    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close-btn')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    });


    // Batch Entry Listeners
    const batchAddBtn = document.getElementById('im-batch-add-po-button'), batchSaveBtn = document.getElementById('im-batch-save-button'), batchTableBody = document.getElementById('im-batch-table-body'), batchPOInput = document.getElementById('im-batch-po-input'), batchSearchStatusBtn = document.getElementById('im-batch-search-by-status-button'), batchSearchNoteBtn = document.getElementById('im-batch-search-by-note-button');
    const batchClearBtn = document.getElementById('im-batch-clear-button');
    
    if(batchClearBtn) batchClearBtn.addEventListener('click', () => {
        batchTableBody.innerHTML = '';
        batchPOInput.value = '';
        sessionStorage.removeItem('imBatchSearch');
        sessionStorage.removeItem('imBatchNoteSearch'); 
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.clearInput();
        if (imBatchGlobalAttentionChoices) imBatchGlobalAttentionChoices.clearInput();
        imBatchGlobalStatus.value = '';
        imBatchGlobalNote.value = '';
    });

    if (batchSearchStatusBtn) batchSearchStatusBtn.addEventListener('click', () => handleBatchGlobalSearch('status'));
    if (batchSearchNoteBtn) batchSearchNoteBtn.addEventListener('click', () => handleBatchGlobalSearch('note'));
    if (batchAddBtn) batchAddBtn.addEventListener('click', handleAddPOToBatch);
    if (batchSaveBtn) batchSaveBtn.addEventListener('click', handleSaveBatchInvoices);
    
    if (batchPOInput) {
        batchPOInput.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                if(batchSearchStatusBtn) batchSearchStatusBtn.click(); 
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
        batchTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('batch-remove-btn')) {
                const row = e.target.closest('tr');
                if (row.choicesInstance) {
                    row.choicesInstance.destroy();
                }
                row.remove();
            }
        });
    }
    if (imBatchSearchExistingButton) imBatchSearchExistingButton.addEventListener('click', () => { if(imBatchSearchModal) imBatchSearchModal.classList.remove('hidden'); document.getElementById('im-batch-modal-results').innerHTML = '<p>Enter a PO number to see its invoices.</p>'; document.getElementById('im-batch-modal-po-input').value = ''; });
    if (imBatchSearchModal) {
        const modalSearchBtn = document.getElementById('im-batch-modal-search-btn'), addSelectedBtn = document.getElementById('im-batch-modal-add-selected-btn'), modalPOInput = document.getElementById('im-batch-modal-po-input');
        if(modalSearchBtn) modalSearchBtn.addEventListener('click', handleBatchModalPOSearch);
        if(addSelectedBtn) addSelectedBtn.addEventListener('click', handleAddSelectedToBatch);
        if (modalPOInput) modalPOInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (modalSearchBtn) modalSearchBtn.click(); } });
    }

    // Batch Global Field Listeners
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
            });
        });
    }
    if (imBatchGlobalStatus) {
        imBatchGlobalStatus.addEventListener('change', (e) => {
            const newValue = e.target.value;
            const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
            rows.forEach(row => {
                row.querySelector('select[name="status"]').value = newValue;
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
    }

    // Refresh Button Listeners
    const refreshEntryBtn = document.getElementById('im-refresh-entry-button');
    if (refreshEntryBtn) refreshEntryBtn.addEventListener('click', async () => { alert("Refreshing all data from sources..."); await ensureInvoiceDataFetched(true); alert("Data refreshed."); if (currentPO) handlePOSearch(currentPO); }); // Pass currentPO
    const refreshBatchBtn = document.getElementById('im-refresh-batch-button');
    if (refreshBatchBtn) refreshBatchBtn.addEventListener('click', async () => { alert("Refreshing all data... Your current batch list will be cleared."); await ensureInvoiceDataFetched(true); document.getElementById('im-batch-table-body').innerHTML = ''; alert("Data refreshed. Please add POs again."); });
    const refreshSummaryBtn = document.getElementById('im-refresh-summary-button');
    if (refreshSummaryBtn) refreshSummaryBtn.addEventListener('click', async () => { alert("Refreshing all data..."); await ensureInvoiceDataFetched(true); initializeNoteSuggestions(); alert("Data refreshed."); });
    const refreshReportingBtn = document.getElementById('im-refresh-reporting-button');
    if (refreshReportingBtn) {
        refreshReportingBtn.addEventListener('click', async () => {
            alert("Refreshing all data...");
            await ensureInvoiceDataFetched(true);
            await ensureAllEntriesFetched(true); // --- (NEW) Also refresh job_entries cache ---
            alert("Data refreshed. Please run your search again.");
            const searchTerm = imReportingSearchInput.value.trim();
            if (searchTerm || document.getElementById('im-reporting-site-filter').value || document.getElementById('im-reporting-date-filter').value) {
                // This is for IM reporting, so we call populateInvoiceReporting
                populateInvoiceReporting(searchTerm);
            }
        });
    }

    // Summary Note Listeners
    if(summaryNoteGenerateBtn) summaryNoteGenerateBtn.addEventListener('click', handleGenerateSummary);
    if(summaryNoteUpdateBtn) summaryNoteUpdateBtn.addEventListener('click', handleUpdateSummaryChanges);
    
    const summaryClearBtn = document.getElementById('summary-note-clear-btn');
    if (summaryClearBtn) {
        summaryClearBtn.addEventListener('click', () => {
            summaryNotePreviousInput.value = '';
            summaryNoteCurrentInput.value = '';
            document.getElementById('summary-note-status-input').value = '';
            document.getElementById('summary-note-srv-input').value = '';
            document.getElementById('summary-note-custom-notes-input').value = '';
            snTableBody.innerHTML = '';
            summaryNotePrintArea.classList.add('hidden');
            sessionStorage.removeItem('imSummaryPrevNote');
            sessionStorage.removeItem('imSummaryCurrNote');
        });
    }
    if (summaryNotePreviousInput) {
        summaryNotePreviousInput.addEventListener('input', debounce((e) => {
            sessionStorage.setItem('imSummaryPrevNote', e.target.value);
        }, 500));
    }
    if (summaryNoteCurrentInput) {
        summaryNoteCurrentInput.addEventListener('input', debounce((e) => {
            sessionStorage.setItem('imSummaryCurrNote', e.target.value);
        }, 500));
    }

    if(summaryNotePrintBtn) {
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

                window.print(); 

            } else {
                console.error("Could not find notes elements for printing.");
                window.print();
            }
        });
    }


    // ++ NEW: Payment Section Listeners ++
    if (imAddPaymentButton) {
        imAddPaymentButton.addEventListener('click', () => {
            imPaymentModalPOInput.value = '';
            imPaymentModalResults.innerHTML = '<p>Enter a PO number to see invoices ready for payment.</p>';
            imAddPaymentModal.classList.remove('hidden');
        });
    }
    if (imPaymentModalSearchBtn) {
        imPaymentModalSearchBtn.addEventListener('click', handlePaymentModalPOSearch);
    }
    if (imPaymentModalPOInput) {
        imPaymentModalPOInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePaymentModalPOSearch();
            }
        });
    }
    if (imPaymentModalAddSelectedBtn) {
        imPaymentModalAddSelectedBtn.addEventListener('click', handleAddSelectedToPayments);
    }
    if (imSavePaymentsButton) {
        imSavePaymentsButton.addEventListener('click', handleSavePayments);
    }
    if (imPaymentsTableBody) {
        imPaymentsTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('payment-remove-btn')) {
                const row = e.target.closest('tr');
                const key = row.dataset.key;
                if (key && invoicesToPay[key]) {
                    delete invoicesToPay[key]; 
                }
                row.remove(); 
            }
        });
    }

    // ++ NEW: Finance Report Listeners ++
    if (imFinanceSearchBtn) imFinanceSearchBtn.addEventListener('click', handleFinanceSearch);
    if (imFinanceClearBtn) imFinanceClearBtn.addEventListener('click', resetFinanceSearch);
    if (imFinanceSearchPoInput) imFinanceSearchPoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleFinanceSearch(); });
    if (imFinanceResultsBody) imFinanceResultsBody.addEventListener('click', handleFinanceActionClick);
    if (imFinancePrintReportBtn) imFinancePrintReportBtn.addEventListener('click', printFinanceReport);


}); // End DOMContentLoaded


// --- ONE-TIME MIGRATION FUNCTION ---
// This function will read all your old data and sort it into the new
// fast "inbox" tables (job_tasks_by_user and invoice_tasks_by_user).
// Run this function ONCE from the browser console after logging in.

async function runOneTimeMigration() {
    if (!confirm("WARNING:\nYou are about to run the one-time data migration script.\n\nThis will scan ALL jobs and invoices and build the new Active Task 'inbox' tables. This may take a few minutes and will perform a large number of database reads and writes.\n\nDo NOT close this window. Do NOT run this more than once.\n\nClick OK to proceed.")) {
        console.log("Migration cancelled by user.");
        return;
    }

    console.log("--- STARTING ONE-TIME MIGRATION ---");

    try {
        // --- Step 1: Fetch all required data one last time ---
        console.log("Fetching all PO Data from CSV...");
        const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
        allPOData = await fetchAndParseCSV(PO_DATA_URL);
        console.log("PO Data fetched.");

        console.log("Fetching all Approver Data...");
        await ensureApproverDataCached(); // This is now required for the job logic
        console.log("Approver Data fetched.");

        console.log("Fetching all job_entries...");
        const jobSnapshot = await db.ref('job_entries').once('value');
        const allJobs = jobSnapshot.val() || {};
        console.log(`Found ${Object.keys(allJobs).length} total job entries.`);
        
        console.log("Fetching all invoice_entries...");
        const invoiceSnapshot = await invoiceDb.ref('invoice_entries').once('value');
        const allInvoices = invoiceSnapshot.val() || {};
        console.log(`Found ${Object.keys(allInvoices).length} POs with invoices.`);

        let jobCount = 0;
        let invoiceCount = 0;

        // --- Step 2: Process all job_entries ---
        console.log("--- Processing job_entries... ---");
        for (const jobKey in allJobs) {
            const jobData = allJobs[jobKey];
            // We call your new helper. It will automatically check if the job is
            // "active" and sort it into the correct user's inbox.
            await updateJobTaskLookup(jobKey, jobData, null); // (jobKey, newData, oldAttention)
            jobCount++;
            if (jobCount % 100 === 0) {
                console.log(`...processed ${jobCount} jobs...`);
            }
        }
        console.log(`--- Finished processing ${jobCount} job_entries. ---`);

        // --- Step 3: Process all invoice_entries ---
        console.log("--- Processing invoice_entries... ---");
        for (const poNumber in allInvoices) {
            const invoicesForPO = allInvoices[poNumber];
            for (const invoiceKey in invoicesForPO) {
                const invoiceData = invoicesForPO[invoiceKey];
                // We call your new helper. It will automatically check if the invoice
                // is "active" and sort it into the correct user's inbox.
                await updateInvoiceTaskLookup(poNumber, invoiceKey, invoiceData, null); // (po, key, newData, oldAttention)
                invoiceCount++;
                if (invoiceCount % 100 === 0) {
                    console.log(`...processed ${invoiceCount} invoices...`);
                }
            }
        }
        console.log(`--- Finished processing ${invoiceCount} invoice_entries. ---`);

        console.log("--- MIGRATION COMPLETE! ---");
        alert("MIGRATION COMPLETE!\n\nAll active tasks from your old system are now in the new 'inboxes'.\n\nPlease refresh the app (Ctrl+R or Cmd+R) to see your Active Task list.");

    } catch (error) {
        console.error("--- MIGRATION FAILED ---", error);
        alert("MIGRATION FAILED. Check the console for the error message.");
    }
}