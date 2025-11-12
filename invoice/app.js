// --- ADD THIS LINE AT THE VERY TOP OF APP.JS ---
const APP_VERSION = "3.1.1"; // You can change "1.1.0" to any version you want

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
const deleteJobButton = document.getElementById('delete-job-button'); // <-- CHANGE 2.1
const jobEntryNavControls = document.getElementById('jobentry-nav-controls'); // <-- ADD THIS
const navPrevJobButton = document.getElementById('nav-prev-job'); // <-- ADD THIS
const navNextJobButton = document.getElementById('nav-next-job'); // <-- ADD THIS
const navJobCounter = document.getElementById('nav-job-counter'); // <-- ADD THIS
const addJobButton = document.getElementById('add-job-button'); const updateJobButton = document.getElementById('update-job-button'); const clearJobButton = document.getElementById('clear-job-button');
const activeTaskTableBody = document.getElementById('active-task-table-body');
const activeTaskFilters = document.getElementById('active-task-filters');

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

// ++ NEW: Calendar DOM References ++ (CHANGE 1.1)
const wdCalendarGrid = document.getElementById('wd-calendar-grid');
const wdCalendarMonthYear = document.getElementById('wd-calendar-month-year');
const wdCalendarPrevBtn = document.getElementById('wd-calendar-prev');
const wdCalendarNextBtn = document.getElementById('wd-calendar-next');
const wdCalendarTaskListTitle = document.getElementById('wd-calendar-task-list-title');
const wdCalendarTaskListUl = document.getElementById('wd-calendar-task-list-ul');
const wdCalendarToggleBtn = document.getElementById('wd-calendar-toggle-view');
const wdCalendarYearGrid = document.getElementById('wd-calendar-year-grid');
// -- End Calendar DOM References --

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
const batchTableBody = document.getElementById('im-batch-table-body'); // <-- ADD THIS LINE
const batchClearBtn = document.getElementById('im-batch-clear-button'); // <-- ADD THIS LINE
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
// Finance Report Modal Content IDs
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
const imReportTotalCertifiedAmount = document.getElementById('im-reportTotalCertifiedAmount'); // <-- CHANGE 3.1
const imReportTotalRetentionAmount = document.getElementById('im-reportTotalRetentionAmount'); // <-- CHANGE 3.2
const imReportTotalPaymentAmount = document.getElementById('im-reportTotalPaymentAmount'); // <-- CHANGE 3.3
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

// SUMMARY NOTE REFERENCES
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

// --- (NEW) DOM Refs for Item Counts & Badges ---
const activeTaskCountDisplay = document.getElementById('active-task-count-display');
const jobRecordsCountDisplay = document.getElementById('job-records-count-display');
const existingInvoicesCountDisplay = document.getElementById('existing-invoices-count-display');
const activeJobsSidebarCountDisplay = document.getElementById('active-jobs-sidebar-count-display');
const batchCountDisplay = document.getElementById('batch-count-display');
const summaryNoteCountDisplay = document.getElementById('summary-note-count-display');
const reportingCountDisplay = document.getElementById('reporting-count-display');
const paymentsCountDisplay = document.getElementById('payments-count-display');
const financeReportCountDisplay = document.getElementById('finance-report-count-display');
const wdActiveTaskBadge = document.getElementById('wd-active-task-badge');
const imActiveTaskBadge = document.getElementById('im-active-task-badge');
const wdMobileNotifyBadge = document.getElementById('wd-mobile-notify-badge'); // <-- ADD THIS LINE
const activeTaskCardLink = document.getElementById('db-active-tasks-card-link');
// --- (END NEW) ---

let currentApprover = null; let dateTimeInterval = null; let workdeskDateTimeInterval = null;
let siteSelectChoices = null; let attentionSelectChoices = null;
let currentlyEditingKey = null; let allJobEntries = []; let userJobEntries = [];
let userActiveTasks = [];
let allAdminCalendarTasks = [];


// let userTaskHistory = []; // --- (REMOVED) ---
let allSystemEntries = [];
let navigationContextList = []; // <-- ADD THIS LINE
let navigationContextIndex = -1; // <-- ADD THIS LINE
let currentReportFilter = 'All';
let currentActiveTaskFilter = 'All'; //
let wdCurrentCalendarDate = new Date();
let isYearView = false;
let wdCurrentDayViewDate = null; // <-- ADD THIS LINE

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

// ++ NEW: Dashboard CSV Data State ++
const ECOST_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/Ecost.csv";
let allEcostData = null;
let ecostDataTimestamp = 0;
let imYearlyChart = null; // To hold the chart instance

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
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours cache

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
function updateDashboardDateTime() { 
    // Content removed
}
function updateWorkdeskDateTime() { 
    // Content removed
}


// --- (NEW) Helper Functions for Counts ---
function updateBatchCount() {
    if (batchCountDisplay) {
        const rows = batchTableBody.querySelectorAll('tr');
        batchCountDisplay.textContent = `Total in Batch: ${rows.length}`;
    }
}
function updatePaymentsCount() {
    if (paymentsCountDisplay) {
        const rows = imPaymentsTableBody.querySelectorAll('tr');
        paymentsCountDisplay.textContent = `(Total to Pay: ${rows.length})`;
    }
}
// --- (END NEW) ---

function handleSuccessfulLogin() {
    if (currentApprover && currentApprover.key) {
        sessionStorage.setItem('approverKey', currentApprover.key);
    } else {
        console.error("Attempted to save login state but currentApprover or key is missing.");
        handleLogout();
        return;
    }

    // --- *** NEW MOBILE REDIRECT *** ---
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        // On mobile, skip the Welcome Screen and go directly to WorkDesk
        workdeskButton.click(); 
    } else {
        // On desktop, show the Welcome Screen
        showView('dashboard');
    }
    // --- *** END OF MOBILE REDIRECT *** ---

// --- === ADD THIS BLOCK === ---
    // Toggle admin-specific UI elements
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    document.body.classList.toggle('is-admin', isAdmin);
    // --- === END OF ADDITION === ---

    const financeReportButton = document.querySelector('a[href="https://ibaport.site/Finance/"]');
    if (financeReportButton) {
        // ++ MODIFIED: Show for "Accounts" or "Accounting"
        const userPositionLower = (currentApprover?.Position || '').toLowerCase();
        const isAccountsOrAccounting = userPositionLower === 'accounts' || userPositionLower === 'accounting';
        financeReportButton.classList.toggle('hidden', !isAccountsOrAccounting);
    }
}

// [REPLACE this entire function around line 1032]

// NEW SIGNATURE: Added 'async' and 'newSearchTerm' parameter
async function showWorkdeskSection(sectionId, newSearchTerm = null) {
    workdeskSections.forEach(section => { section.classList.add('hidden'); });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) { targetSection.classList.remove('hidden'); }

    // ++ ADDED: Restore search state on navigation ++
    if (sectionId === 'wd-dashboard') { 
        await populateWorkdeskDashboard(); // Added await
        
        // --- *** MODIFIED: Render BOTH views *** ---
        renderWorkdeskCalendar(); 
        renderYearView(); // Also render the year view data
        await populateCalendarTasks(); // Added await
        // --- *** END MODIFICATION *** ---

        // --- CALENDAR LIST FIX: Always show *today's* tasks on load ---
        const today = new Date(); 
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`; 
        
        displayCalendarTasksForDay(todayStr);
    }
    
    if (sectionId === 'wd-jobentry') {
        
        // --- *** THIS IS THE FIX *** ---
        // If we are NOT in the middle of editing a job,
        // reset the form to the default "Add New Job" state.
        if (!currentlyEditingKey) {
            resetJobEntryForm(false);
        }
        // --- *** END OF FIX *** ---

        const savedSearch = sessionStorage.getItem('jobEntrySearch');
        if (savedSearch) {
            jobEntrySearchInput.value = savedSearch;
        }
        await handleJobEntrySearch(jobEntrySearchInput.value); // Added await
    }
    
    if (sectionId === 'wd-activetask') {
        // *** THIS IS THE KEY FIX ***
        // 1. Await the population. This fills userActiveTasks and sets filter to "All".
        await populateActiveTasks(); 

        // 2. Decide what to search for.
        let searchTerm = '';
        if (newSearchTerm !== null) {
            // A new search is being forced (from the calendar).
            searchTerm = newSearchTerm;
        } else {
            // No new search, fall back to session storage.
            searchTerm = sessionStorage.getItem('activeTaskSearch') || '';
        }

        // 3. Apply the search.
        if (searchTerm) {
            activeTaskSearchInput.value = searchTerm;
            // No timeout needed, data is already loaded.
            handleActiveTaskSearch(searchTerm); 
        }
    }
    
    if (sectionId === 'wd-reporting') {
        const savedSearch = sessionStorage.getItem('reportingSearch');
        if (savedSearch) {
            reportingSearchInput.value = savedSearch;
        }
         await handleReportingSearch(); // Added await
    }

    if (sectionId === 'wd-settings') { populateSettingsForm(); }
}

function formatDate(date) { const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const day = String(date.getDate()).padStart(2, '0'); const month = months[date.getMonth()]; const year = date.getFullYear(); return `${day}-${month}-${year}`; }

// --- THIS IS THE NEW TIMEZONE-SAFE FUNCTION ---
function formatYYYYMMDD(dateString) { // dateString is "YYYY-MM-DD"
    if (!dateString) return 'N/A';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const parts = dateString.split('-'); // ["YYYY", "MM", "DD"]
    if (parts.length !== 3) return dateString; // fallback
    
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1; // "MM" is 1-indexed
    const day = parts[2];
    
    const month = months[monthIndex];
    if (!month) return dateString; // fallback
    
    return `${day}-${month}-${year}`; // "DD-Mmm-YYYY"
}
// --- END OF NEW FUNCTION ---

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
    if (typeof value === 'number') {
         return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    // This line removes commas (e.g., "6,000.00") before parsing
    const number = parseFloat(String(value).replace(/,/g, ''));
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

// --- CHANGE 4.1: Updated Date Formatting Function ---
function formatFinanceDate(dateStr) {
  if (!dateStr || String(dateStr).trim() === '') return '';
  
  // Try parsing the date string
  const date = new Date(dateStr);
  
  // Check for invalid date
  if (isNaN(date.getTime())) {
    return dateStr; // Return original string if invalid
  }

  // Check if the input string might have been a timezone-local time
  // and correct for it if it looks like a YYYY-MM-DD string
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      const day = parseInt(parts[2], 10);
      const utcDate = new Date(Date.UTC(year, month, day));
      
      const dayFormatted = utcDate.getUTCDate().toString().padStart(2, '0');
      const monthFormatted = utcDate.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
      const yearFormatted = utcDate.getUTCFullYear();
      return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
  }

  // Fallback for other valid date formats
  const dayFormatted = date.getUTCDate().toString().padStart(2, '0');
  const monthFormatted = date.toLocaleString('default', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const yearFormatted = date.getUTCFullYear();
  
  return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
}
// --- END CHANGE 4.1 ---

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

// [ADD THIS ENTIRE NEW FUNCTION]

// ++ NEW: Generates the 7-day mobile scroller ++
function generateDateScroller(selectedDate) { // selectedDate is "YYYY-MM-DD"
    const scrollerInner = document.getElementById('wd-dayview-date-scroller-inner');
    if (!scrollerInner) return;

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let html = '';

    // Create date object from string, ensuring it's treated as local/UTC
    const parts = selectedDate.split('-').map(Number);
    const centerDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    for (let i = -3; i <= 3; i++) {
        const currentDate = new Date(centerDate);
        currentDate.setUTCDate(centerDate.getUTCDate() + i);

        const dayNum = String(currentDate.getUTCDate()).padStart(2, '0');
        const dayInitial = days[currentDate.getUTCDay()];
        
        // Format this date back to YYYY-MM-DD
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

    // Scroll the active item into view
    setTimeout(() => {
        const activeItem = scrollerInner.querySelector('.day-scroller-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, 100);
}



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

// --- (FIX) RE-ADDING INVOICE HELPER FUNCTIONS ---
// These functions are required for the invoice "inbox" system to work.

/**
 * (SMART HELPER 1 - FOR INVOICES)
 * Checks if an invoice task is "active" (i.e., needs to be in someone's inbox).
 */
function isInvoiceTaskActive(invoiceData) {
    if (!invoiceData) return false;

    // Statuses that are "completed" or "pending admin" and thus NOT active for a user
    const inactiveStatuses = [
        'CEO Approval', 
        'With Accounts', 
        'Under Review', 
        'SRV Done', 
        'Paid',
        // 'Report', // <-- REMOVED
        'On Hold',
        'CLOSED',
        'Cancelled',
        // 'Original PO' // <-- REMOVED
    ];

    // If the status is in the inactive list, it's not an active task.
    if (inactiveStatuses.includes(invoiceData.status)) {
        return false;
    }

    // If the status is "Pending", "For SRV", "For IPC", etc., 
    // it's only active if it's assigned to a specific person.
    return !!invoiceData.attention; 
}

/**
 * (SMART HELPER 2 - FOR INVOICES)
 * Keeps the 'invoice_tasks_by_user' (the "inbox") in sync.
 */
async function updateInvoiceTaskLookup(poNumber, invoiceKey, invoiceData, oldAttention) {
    
    // --- *** START OF FIREBASE PATH FIX *** ---
    // Replaces invalid characters (like ".") with an underscore for the DB path
    const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
    // --- *** END OF FIREBASE PATH FIX *** ---

    const newAttention = invoiceData.attention;

    // 1. Determine if the new task is "active"
    const isTaskNowActive = isInvoiceTaskActive(invoiceData);

    // 2. If the task is active, add it to the new user's inbox
    if (isTaskNowActive && newAttention) {
        // Get PO details for the inbox
        const poDetails = (poNumber && allPOData && allPOData[poNumber]) ? allPOData[poNumber] : {};
        
        const taskData = {
            ref: invoiceData.invNumber || '',
            po: poNumber,
            amount: invoiceData.invValue || '',
            date: invoiceData.invoiceDate || getTodayDateString(),
            releaseDate: invoiceData.releaseDate || '', // <-- ADD THIS LINE
            status: invoiceData.status || 'Pending',
            vendorName: poDetails['Supplier Name'] || 'N/A',
            site: poDetails['Project ID'] || 'N/A',
            invName: invoiceData.invName || '',
            note: invoiceData.note || ''
        };
        
        // --- *** APPLY FIX HERE *** ---
        const safeNewAttentionKey = sanitizeFirebaseKey(newAttention);
        await invoiceDb.ref(`invoice_tasks_by_user/${safeNewAttentionKey}/${invoiceKey}`).set(taskData);
        // --- *** END OF FIX *** ---
    }

    // 3. Clean up the old user's inbox
    // If the attention changed, OR if the task is no longer active, remove from old user
    if (oldAttention && (oldAttention !== newAttention || !isTaskNowActive)) {
        // --- *** APPLY FIX HERE *** ---
        const safeOldAttentionKey = sanitizeFirebaseKey(oldAttention);
        await invoiceDb.ref(`invoice_tasks_by_user/${safeOldAttentionKey}/${invoiceKey}`).remove();
        // --- *** END OF FIX *** ---
    }
}

/**
 * (SMART HELPER 3 - FOR INVOICES)
 * Helper to remove a deleted invoice task from all inboxes.
 */
async function removeInvoiceTaskFromUser(invoiceKey, oldData) {
    if (!oldData || !oldData.attention) {
        return; // No one to remove it from
    }
    
    // --- *** START OF FIREBASE PATH FIX *** ---
    const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
    const safeOldAttentionKey = sanitizeFirebaseKey(oldData.attention);
    // --- *** END OF FIREBASE PATH FIX *** ---

    await invoiceDb.ref(`invoice_tasks_by_user/${safeOldAttentionKey}/${invoiceKey}`).remove();
}
// --- (FIX) END OF RE-ADDED FUNCTIONS ---


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
// --- *** SITE.CSV FIX (END) ---



// [Replace this entire function]

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
        
        // Find PO Number header (for invoices)
        let poHeaderIndex = headers.findIndex(h => h.toLowerCase() === 'po number' || h.toLowerCase() === 'po' || h.toLowerCase() === 'po_number');
        if (poHeaderIndex === -1) { poHeaderIndex = 1; } // Assume Col B if not found

        // --- *** THIS IS THE FIX *** ---
        // Find ReqNum header (for PRs)
        let refHeaderIndex = headers.findIndex(h => h.toLowerCase() === 'reqnum'); // Look for "ReqNum"
        if (refHeaderIndex === -1) { refHeaderIndex = 0; } // Assume Col A if not found
        // --- *** END OF FIX *** ---

        const poDataByPO = {}; // Original map, keyed by PO Number
        const poDataByRef = {}; // New map, keyed by Ref (which is ReqNum)

        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length !== headers.length) { console.warn(`Skipping malformed CSV row: ${lines[i]}`); continue; }

            const poKey = values[poHeaderIndex].toUpperCase();
            const refKey = values[refHeaderIndex]; // Get the Ref key (from Col A, "ReqNum")

            const poEntry = {};
            headers.forEach((header, index) => {
                if (header.toLowerCase() === 'amount') { poEntry[header] = values[index].replace(/,/g, '') || '0'; } else { poEntry[header] = values[index]; }
            });

            if (poKey) {
                poDataByPO[poKey] = poEntry;
            }
            if (refKey) {
                // This now correctly saves the row data using the ReqNum as the key
                poDataByRef[refKey] = poEntry;
            }
        }
        
        console.log(`Successfully parsed ${Object.keys(poDataByPO).length} POs and ${Object.keys(poDataByRef).length} Refs from GitHub.`);
        // Return both maps
        return { poDataByPO, poDataByRef };

    } catch (error) { console.error("Error fetching or parsing PO CSV:", error); alert("CRITICAL ERROR: Could not load Purchase Order data from GitHub."); return null; }
}

// ++ NEW: FETCH AND PARSE Ecost.csv FOR DASHBOARD ++
async function fetchAndParseEcostCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch Ecost CSV: ${response.statusText}`);
        }
        const csvText = await response.text();

        const lines = csvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error("Ecost CSV is empty or has no data rows.");
        }

        // More robust CSV parser
        const parseCsvRow = (rowStr) => {
            const values = [];
            let inQuote = false;
            let currentVal = '';
            const cleanRowStr = rowStr.trim();

            for (let i = 0; i < cleanRowStr.length; i++) {
                const char = cleanRowStr[i];
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) {
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

        // Check for required headers
        const requiredHeaders = ['Order Date', 'Project #', 'Name', 'Line Amount', 'Delivered Amount', 'Outstanding', 'Activity Name'];
        for (const h of requiredHeaders) {
            if (typeof headerMap[h] === 'undefined') {
                console.warn(`Ecost CSV is missing expected header: ${h}`);
            }
        }
        
        // Use indices
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

            // --- *** THIS IS THE NEW FIX for DD-MM-YY *** ---
            const orderDateStr = values[dateIndex];
            let orderDate = null;
            let year = null;
            let month = null;

            if (orderDateStr && orderDateStr.includes('-')) {
                const parts = orderDateStr.split('-'); // e.g., ["21", "10", "23"]
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const monthIndex = parseInt(parts[1], 10) - 1; // Month is 0-indexed
                    let fullYear = parseInt(parts[2], 10);
                    
                    if (fullYear < 100) {
                        fullYear += 2000; // Convert "23" to "2023"
                    }
                    
                    orderDate = new Date(Date.UTC(fullYear, monthIndex, day)); // Use UTC to avoid timezone issues
                }
            }
            
            // Fallback for other date formats (e.g., ISO or mm/dd/yyyy)
            if (!orderDate || isNaN(orderDate)) {
                orderDate = new Date(orderDateStr);
            }
            // --- *** END OF FIX *** ---
            
            // Final check if date is valid
            if (orderDate && !isNaN(orderDate)) {
                 // Check if the date is in the future relative to the *client's* clock
                const now = new Date();
                if (orderDate > now) {
                    // This data point is in the future, skip it for calculations
                    continue; 
                }
                year = orderDate.getFullYear();
                month = orderDate.getMonth(); // 0-11
            } else {
                 // If date is invalid, skip this row
                 continue;
            }

            processedData.push({
                'Order Date': orderDate,
                'Year': year,
                'Month': month,
                'Project #': values[projectIndex],
                'Vendor': values[vendorIndex], // Renamed
                'Total Committed': parseFloat(values[lineAmountIndex].replace(/,/g, '')) || 0, // Renamed and parsed
                'Delivered Amount': parseFloat(values[deliveredIndex].replace(/,/g, '')) || 0, // Parsed
                'Outstanding': parseFloat(values[outstandingIndex].replace(/,/g, '')) || 0, // Parsed
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


// ++ NEW: Cache function for Ecost data ++
async function ensureEcostDataFetched(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && allEcostData && (now - ecostDataTimestamp < CACHE_DURATION)) {
        return allEcostData;
    }
    
    console.log("Fetching Ecost.csv data...");
    allEcostData = await fetchAndParseEcostCSV(ECOST_DATA_URL);
    if (allEcostData) {
        ecostDataTimestamp = now;
        console.log("Ecost.csv data cached.");
    }
    return allEcostData;
}

// [Replace this entire function]

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

        // --- *** THIS IS THE FIX *** ---
        // The fetchAndParseCSV function now returns an object { poDataByPO, poDataByRef }.
        // We must correctly assign BOTH maps to the global scope.
        allPOData = csvData.poDataByPO;
        // This function was missing the line below, which broke the Job Records page.
        // We don't use poDataByRef here, but we must set it for the *other* function.
        const purchaseOrdersDataByRef = csvData.poDataByRef || {};
        // --- *** END OF FIX *** ---

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

// --- *** NEW CALENDAR FUNCTIONS (CHANGE 1.5) *** ---
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
    `; // Clear previous days and add headers

    wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const year = wdCurrentCalendarDate.getFullYear();
    const month = wdCurrentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday...
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 1. Add blank days for the start of the month
    for (let i = 0; i < firstDay; i++) {
        const blankDay = document.createElement('div');
        blankDay.className = 'wd-calendar-day other-month';
        wdCalendarGrid.appendChild(blankDay);
    }

    // 2. Add all days for the current month
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'wd-calendar-day';
        dayCell.textContent = day;

        const thisDate = new Date(year, month, day);
        thisDate.setHours(0, 0, 0, 0); // Normalize thisDate

        // dayCell.dataset.date = thisDate.toISOString().split('T')[0]; // Store YYYY-MM-DD <-- OLD BUGGY LINE

        // --- CALENDAR TIMEZONE FIX ---
        // Manually construct YYYY-MM-DD from the local date components
        // to avoid the toISOString() timezone shift.
        const dateYear = thisDate.getFullYear();
        const dateMonth = String(thisDate.getMonth() + 1).padStart(2, '0');
        const dateDay = String(thisDate.getDate()).padStart(2, '0');
        dayCell.dataset.date = `${dateYear}-${dateMonth}-${dateDay}`;
        // --- END OF FIX ---

        if (thisDate.getTime() === today.getTime()) {
            dayCell.classList.add('today');
        }
        wdCalendarGrid.appendChild(dayCell);
    }
}

async function populateCalendarTasks() {
    if (!currentApprover) return;

    // --- *** THIS IS THE NEW LOGIC *** ---
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    let tasks = [];
    
    // Create a Set of the current user's personal task keys for quick lookup
    // userActiveTasks is already populated by populateWorkdeskDashboard
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key)); 

    if (isAdmin) {
        // Admins see ALL active tasks on their calendar
        // allAdminCalendarTasks is also populated by populateWorkdeskDashboard
        tasks = allAdminCalendarTasks;
    } else {
        // Regular users see ONLY their tasks
        tasks = userActiveTasks;
    }
    // --- *** END OF NEW LOGIC *** ---

    // 2. Create a map of tasks by date
    const tasksByDate = new Map();
    tasks.forEach(task => {
        // --- MODIFICATION: Use 'calendarDate', fallback to 'date' ---
        let taskDateStr = task.calendarDate || task.date; // e.g., "08-Nov-2025"
        // --- END MODIFICATION ---
        
        // Convert "DD-Mmm-YYYY" to "YYYY-MM-DD"
        if (taskDateStr) {
            const inputDate = convertDisplayDateToInput(taskDateStr); // e.g., "2025-11-08"
            if (inputDate) {
                if (!tasksByDate.has(inputDate)) {
                    tasksByDate.set(inputDate, []);
                }
                tasksByDate.get(inputDate).push(task);
            }
        }
    });

    // 3. Add COUNT BADGES to the calendar
    document.querySelectorAll('.wd-calendar-day[data-date]').forEach(dayCell => {
        const date = dayCell.dataset.date;
        
        // Clear old badges
        const oldBadge = dayCell.querySelector('.task-count-badge');
        if (oldBadge) oldBadge.remove();

        // Add new badge if tasks exist
        if (tasksByDate.has(date)) {
            const tasksForDay = tasksByDate.get(date);
            const count = tasksForDay.length;

            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'task-count-badge';
                badge.textContent = count;

                // --- *** MODIFIED COLOR-CODING LOGIC *** ---
                let badgeColorSet = false;
                
                // 1. Check for Admin "View Only" (Green)
                if (isAdmin) {
                    const hasMyTask = tasksForDay.some(task => myTaskKeys.has(task.key));
                    if (!hasMyTask) {
                        badge.classList.add('admin-view-only'); // Green
                        badgeColorSet = true;
                    }
                }

                // 2. If not Green, check for "Pending Signature" (Yellow)
                if (!badgeColorSet) {
                    const allPendingSignature = tasksForDay.every(task => task.remarks === 'Pending Signature');
                    if (allPendingSignature) {
                        badge.classList.add('status-pending-signature'); // Yellow
                        badgeColorSet = true;
                    }
                }
                
                // 3. If no other color set, it remains default red (terracotta)
                // --- *** END OF MODIFICATION *** ---

                dayCell.appendChild(badge);
            }
        }
    });
}

function displayCalendarTasksForDay(date) { // date is "2025-11-09"
    // 1. Highlight selected day
    document.querySelectorAll('.wd-calendar-day.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    const selectedCell = document.querySelector(`.wd-calendar-day[data-date="${date}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }

    // --- *** THIS IS THE NEW LOGIC *** ---
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;

// 2. Find tasks for this day from the correct source
            const tasks = taskSource.filter(task => {
                // --- THIS IS THE FIX: Filter by 'calendarDate' or fallback to 'date' ---
                const taskDate = convertDisplayDateToInput(task.calendarDate || task.date); 
                return taskDate === date;
            });
    // --- *** END OF NEW LOGIC *** ---

    // 3. Display tasks in the list
    const friendlyDate = formatYYYYMMDD(date);
    
    if (tasks.length > 0) {
        wdCalendarTaskListTitle.textContent = `Task Details for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';
        
        tasks.forEach(task => {
            const li = document.createElement('li');
            
            // Add status class based on remarks
            let statusClass = '';
            const status = task.remarks || 'Pending';
            if (status === 'Pending Signature') statusClass = 'status-pending-signature';
            if (status === 'For SRV') statusClass = 'status-for-srv';
            li.className = statusClass;

            const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
            const subInfo = task.vendorName ? task.vendorName : `(Ref: ${task.ref || 'N/A'})`;
            
            const amountDisplay = (task.amount && parseFloat(task.amount) > 0) 
                ? ` - QAR ${formatCurrency(task.amount)}` 
                : ``;

            // --- *** ADD THIS NEW BLOCK *** ---
            // If the task has a PO number, make it clickable
            if (task.po) {
                li.dataset.po = task.po; // Store the PO number
                li.classList.add('clickable-task');
                li.title = `PO: ${task.po}\nDouble-click to search in IM Reporting`;
            }
            // --- *** END OF NEW BLOCK *** ---

            // --- *** MODIFICATION: Add Job Type and Note *** ---
            const noteHTML = task.note 
                ? `<span style="color: var(--iba-secondary-terracotta); font-style: italic; margin-top: 4px;">Note: ${task.note}</span>` 
                : '';

            const jobTypeHTML = task.for
                ? `<span style="font-weight: 600; margin-top: 4px;">Job: ${task.for}</span>`
                : '';

            li.innerHTML = `
                <strong>${mainInfo}${amountDisplay}</strong>
                <span>${subInfo}</span>
                ${jobTypeHTML}
                <span style="font-weight: 600; margin-top: 4px;">Status: ${status}</span>
                ${noteHTML}
            `;
            // --- *** END OF MODIFICATION *** ---
            
            wdCalendarTaskListUl.appendChild(li);
        });

    } else {
        wdCalendarTaskListTitle.textContent = `No active tasks for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';
    }
}

// --- *** END OF CALENDAR FUNCTIONS (CHANGE 1.5) *** ---

// --- *** NEW: 'Double-click' listener for Day View TASK CARDS *** ---
    const dayViewTaskList = document.getElementById('wd-dayview-task-list');
    if (dayViewTaskList) {
        dayViewTaskList.addEventListener('dblclick', (e) => {
            // 1. Only work for Admins
            if ((currentApprover?.Role || '').toLowerCase() !== 'admin') return;

            // 2. Find the card that was clicked
            const taskCard = e.target.closest('.admin-clickable-task');
            if (!taskCard) return; // Didn't click a clickable card

            // 3. Get the PO number from the card's data
            const poNumber = taskCard.dataset.po;
            if (!poNumber) return; // No PO number on this task

            // 4. All checks passed, redirect to IM Reporting
            if (confirm(`Redirect to Invoice Management and search Reporting for PO "${poNumber}"?`)) {
                // Click the main Invoice Management button
                invoiceManagementButton.click();

                // Wait for IM view to load, then switch to reporting
                setTimeout(() => {
                    // Set the search input's value to the PO
                    imReportingSearchInput.value = poNumber;
                    
                    // Save the search term to session storage
                    sessionStorage.setItem('imReportingSearch', poNumber);
                    
                    // Click the "Reporting" tab
                    const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                    if (imReportingLink) {
                        imReportingLink.click();
                        // The showIMSection function will automatically use the saved
                        // search term to run the report.
                    }
                }, 150); // 150ms delay to ensure view is loaded
            }
        });
    }
    // --- *** END OF NEW LISTENER *** ---


// [REPLACE the old showDayView function with this one]

// --- *** NEW: FUNCTION TO SHOW DAY VIEW (with Mobile UI) *** ---
function showDayView(date) { // date is "2025-11-09"
    try {
        const parts = date.split('-').map(Number);
        wdCurrentDayViewDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } catch (e) {
        console.error("Invalid date passed to showDayView:", date, e);
        return; // Stop if the date is bad
    }

    // 1. Hide all main sections
    workdeskSections.forEach(section => {
        section.classList.add('hidden');
    });

    // 2. Show the Day View section
    const dayViewSection = document.getElementById('wd-dayview');
    dayViewSection.classList.remove('hidden');

    // 3. Set the title (for desktop)
    const friendlyDate = formatYYYYMMDD(date);
    document.getElementById('wd-dayview-title').textContent = `Tasks for ${friendlyDate}`;

    // --- *** NEW MOBILE UI POPULATION *** ---
    // a. Set the mobile subtitle
    const mobileSubtitle = document.getElementById('wd-dayview-mobile-date-subtitle');
    if (mobileSubtitle) {
        const todayStr = getTodayDateString(); // "YYYY-MM-DD"
        if (date === todayStr) {
            mobileSubtitle.textContent = 'Today';
        } else {
            // Format as "Monday, 10 November"
            const subtitleDate = new Date(date + 'T00:00:00'); // Treat as local
            mobileSubtitle.textContent = subtitleDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    }

    // b. Generate the 7-day scroller
    generateDateScroller(date);
    // --- *** END OF NEW MOBILE UI *** ---


    // 4. Get the correct tasks
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;

    const tasks = taskSource.filter(task => {
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date); 
        return taskDate === date;
    });

    // 5. Populate the task list
    const taskListDiv = document.getElementById('wd-dayview-task-list');
    taskListDiv.innerHTML = ''; // Clear old tasks

    if (tasks.length === 0) {
        taskListDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #555;">No tasks found for this day.</p>';
        return;
    }

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'dayview-task-card';

        // --- NEW: Color-code border for "My Task" vs "Other Task" ---
        const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
        let borderColor = 'var(--iba-secondary-terracotta)'; // Default to Red ("mine")
        
        if (isAdmin && task.attention !== currentApprover.Name) {
            borderColor = '#28a745'; // Green ("not mine")
        }
        
        card.style.borderLeft = `5px solid ${borderColor}`;
        // --- END OF NEW BLOCK ---

        // *** THIS IS THE CORRECTED BLOCK ***
        if (isAdmin && task.po) {
            card.classList.add('admin-clickable-task'); 
            card.dataset.po = task.po; // <-- This line was missing
            card.title = `Admin: Double-click to search for PO ${task.po} in IM Reporting`; // <-- This line was missing
        }
        // *** END OF CORRECTION ***

        const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
        const amountDisplay = (task.amount && parseFloat(task.amount) > 0) 
            ? ` - QAR ${formatCurrency(task.amount)}` 
            : ``;
        
        const noteHTML = task.note 
            ? `<div class="task-detail-item note"><span class="label">Note:</span> ${task.note}</div>` 
            : '';

        // --- *** MODIFICATION TO MATCH MOCKUP *** ---
        // The mockup shows "Job:", "Vendor:", "Site:", "Status:"
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
        // --- *** END OF MODIFICATION *** ---
        
        taskListDiv.appendChild(card);
    });
}
// --- END OF displayCalendarTasksForDay ---

// --- *** NEW FUNCTION: Populate Admin-View Calendar *** ---
async function populateAdminCalendarTasks() {
    if (!currentApprover || (currentApprover.Role || '').toLowerCase() !== 'admin') {
        allAdminCalendarTasks = []; // Not an admin, keep it empty
        return;
    }

    console.log("Admin user detected, populating full calendar...");
    let allTasks = [];
    let processedInvoiceKeys = new Set(); // Prevent duplicates

    // 1. Get all active JOB_ENTRIES
    await ensureAllEntriesFetched(); // Gets all job_entries into allSystemEntries
    const activeJobTasks = allSystemEntries.filter(entry => !isTaskComplete(entry));
    allTasks = allTasks.concat(activeJobTasks);

    // 2. Get all active INVOICE_ENTRIES
    await ensureInvoiceDataFetched(); // Gets all invoices into allInvoiceData
    
    // --- *** THIS IS THE FIX (Part A) *** ---
    // These are the statuses that are active even if unassigned
    const unassignedStatuses = ['Pending', 'Report', 'Original PO'];
    // --- *** END OF FIX (Part A) *** ---

    if (allInvoiceData && allPOData) {
        for (const poNumber in allInvoiceData) {
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                const inv = poInvoices[invoiceKey];
                
                // --- *** THIS IS THE FIX (Part B) *** ---
                // An invoice is "active" for the admin calendar if it's:
                // 1. Active AND assigned to someone (isInvoiceTaskActive = true)
                // OR
                // 2. Has one of the special statuses AND is unassigned
                const isAssignedActive = isInvoiceTaskActive(inv);
                const isUnassignedActive = unassignedStatuses.includes(inv.status) && (!inv.attention || inv.attention === '');

                if (isAssignedActive || isUnassignedActive) {
                // --- *** END OF FIX (Part B) *** ---
                
                    // It's an active invoice task. Transform it.
                    const poDetails = allPOData[poNumber] || {};
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
                        enteredBy: 'Irwin', // Assumed

                        // --- THIS IS THE FIX ---
                        // 'date' (for the table) ALWAYS uses invoiceDate
                        date: formatYYYYMMDD(inv.invoiceDate), 
                        // 'calendarDate' (for the calendar) uses releaseDate, OR falls back to invoiceDate
                        calendarDate: formatYYYYMMDD(inv.releaseDate) !== 'N/A' ? formatYYYYMMDD(inv.releaseDate) : formatYYYYMMDD(inv.invoiceDate),
                        remarks: inv.status,
                        // 'timestamp' (for sorting) MUST also use the releaseDate
                        timestamp: (inv.releaseDate || inv.invoiceDate) ? new Date(inv.releaseDate || inv.invoiceDate).getTime() : Date.now(), 
                        // --- END OF FIX ---

                        invName: inv.invName || '',
                        vendorName: poDetails['Supplier Name'] || 'N/A',
                        note: inv.note || ''
                    };
                    allTasks.push(transformedInvoice);
                }
            }
        }
    }
    
    allAdminCalendarTasks = allTasks; // Set the global admin list
    console.log(`Admin calendar populated with ${allAdminCalendarTasks.length} total active tasks.`);
}
// --- *** NEW FUNCTION: RENDER YEAR VIEW (with Admin Color Logic) *** ---
function renderYearView() {
    if (!wdCalendarYearGrid) return;

    // --- *** START OF NEW LOGIC *** ---
    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const year = wdCurrentCalendarDate.getFullYear();
    
    // 1. Get the correct list of tasks to display
    const taskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    
    // 2. Get the user's personal task keys
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key));

    // 3. Create a map of tasks grouped by month (0-11)
    const tasksByMonth = new Map();
    for (let i = 0; i < 12; i++) {
        tasksByMonth.set(i, []); // Initialize empty arrays for all 12 months
    }

    taskSource.forEach(task => {
        // --- MODIFICATION: Use 'calendarDate', fallback to 'date' ---
        const taskDateStr = task.calendarDate || task.date;
        // --- END MODIFICATION ---

        if (!taskDateStr) return;
        
        const taskDate = new Date(convertDisplayDateToInput(taskDateStr) + 'T00:00:00');
        if (taskDate.getFullYear() === year) {
            const monthIndex = taskDate.getMonth();
            tasksByMonth.get(monthIndex).push(task);
        }
    });
    // --- *** END OF NEW LOGIC *** ---


    // 4. Render the 12 month cells
    wdCalendarYearGrid.innerHTML = '';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 0; i < 12; i++) { // i = 0 (Jan), 1 (Feb), etc.
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

            // --- *** MODIFIED COLOR-CODING LOGIC (for Year View) *** ---
            let badgeColorSet = false;
            
            // 1. Check for Admin "View Only" (Green)
            if (isAdmin) {
                const hasMyTask = tasksForThisMonth.some(task => myTaskKeys.has(task.key));
                
                if (!hasMyTask) {
                    monthCell.classList.add('admin-view-only'); // Light green cell
                    badge.classList.add('admin-view-only'); // Solid green badge
                    badgeColorSet = true;
                }
            }

            // 2. If not Green, check for "Pending Signature" (Yellow)
            if (!badgeColorSet) {
                const allPendingSignature = tasksForThisMonth.every(task => task.remarks === 'Pending Signature');
                if (allPendingSignature) {
                    monthCell.classList.add('status-pending-signature'); // New class for yellow cell
                    badge.classList.add('status-pending-signature'); // New class for yellow badge
                    badgeColorSet = true;
                }
            }
            // 3. If no other color set, it remains default red
            // --- *** END OF MODIFICATION *** ---

            monthCell.appendChild(badge);
        }
        wdCalendarYearGrid.appendChild(monthCell);
    }
}
// --- *** NEW FUNCTION: TOGGLE CALENDAR VIEW *** ---
function toggleCalendarView() {
    isYearView = !isYearView; // Flip the state
    
    wdCalendarGrid.classList.toggle('hidden', isYearView);
    wdCalendarYearGrid.classList.toggle('hidden', !isYearView);
    
    if (isYearView) {
        // Switched TO Year View
        wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
        wdCalendarToggleBtn.textContent = 'Month View';
        renderYearView(); // Re-render year view with fresh data
    } else {
        // Switched TO Month View
        wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        wdCalendarToggleBtn.textContent = 'Year View';
        renderWorkdeskCalendar(); // Re-render month view
        populateCalendarTasks(); // Re-add badges to month view
    }
}


// [Replace this entire function]

// --- (MODIFIED) ensureAllEntriesFetched ---
// This function will now fetch job_entries AND PO data if the cache is old.
async function ensureAllEntriesFetched(forceRefresh = false) {
    const now = Date.now();
    // Check if we have a cache and it's less than 24 hours old
    if (!forceRefresh && allSystemEntries.length > 0 && (now - cacheTimestamps.systemEntries < CACHE_DURATION)) {
        return; // Use the cache
    }
    
    console.log("Loading PO Data cache for Workdesk...");
    const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
    
    // Fetch both PO and Ref maps from the CSV
    const { poDataByPO, poDataByRef } = await fetchAndParseCSV(PO_DATA_URL) || {};
    allPOData = poDataByPO; // This is the original map, keyed by PO
    const purchaseOrdersDataByRef = poDataByRef || {}; // This is the new map, keyed by Ref
    const purchaseOrdersDataByPO = allPOData || {};
    
    
    console.log("Fetching all job_entries for Workdesk...");
    // Fetch ONLY job_entries
    const jobEntriesSnapshot = await db.ref('job_entries').orderByChild('timestamp').once('value');

    const jobEntriesData = jobEntriesSnapshot.val() || {};
    
    const processedJobEntries = [];
    const updatesToFirebase = {}; // To store the PRs we need to update

    Object.entries(jobEntriesData).forEach(([key, value]) => {
        let entry = { key, ...value, source: 'job_entry' };

        // --- *** PR ENRICHMENT LOGIC (THE FIX) *** ---
        // Always try to find a match for any PR that has a Ref number.
        if (entry.for === 'PR' && entry.ref) {
            const trimmedRef = entry.ref.trim();
            const csvMatch = purchaseOrdersDataByRef[trimmedRef];

            if (csvMatch) {
                // We found a match in the CSV.
                const newPO = csvMatch['PO'] || '';
                const newVendor = csvMatch['Supplier Name'] || 'N/A';
                
                // --- THIS IS THE DATE FORMATTING FIX ---
                const rawDate = csvMatch['Order Date'] || '';
                const normalizedDate = normalizeDateForInput(rawDate); // Convert "19-10-25" to "2025-10-19"
                const newDate = formatYYYYMMDD(normalizedDate);     // Convert "2025-10-19" to "19-Oct-2025"
                // --- END OF FIX ---

                // 1. Always update the local 'entry' object for the current view.
                entry.po = newPO;
                entry.vendorName = newVendor;
                entry.dateResponded = (newDate === 'N/A' ? '' : newDate); // Use the formatted date
                entry.remarks = 'PO Ready'; // <-- ALWAYS set status to "PO Ready" for display

                // 2. Check if this is a "Pending" PR that needs to be auto-updated in Firebase.
                // We check the original value (value.remarks) not the one we just changed (entry.remarks)
                if (value.remarks === 'Pending') {
                    const newAmount = csvMatch['Amount'] || '';
                    const newAttention = csvMatch['Buyer Name'] || '';

                    // Prepare an object to update Firebase
                    updatesToFirebase[key] = {
                        po: newPO,
                        vendorName: newVendor, // Also save vendorName to DB
                        amount: newAmount,
                        attention: newAttention,
                        dateResponded: (newDate === 'N/A' ? '' : newDate), // Save formatted date
                        remarks: 'PO Ready' // Save the new status
                    };
                }
            }
        }
        // --- *** END OF PR FIX *** ---

        // This adds the vendor name to all other tasks for the reporting table
        if (!entry.vendorName && entry.po && purchaseOrdersDataByPO[entry.po]) {
            entry.vendorName = purchaseOrdersDataByPO[entry.po]['Supplier Name'] || 'N/A';
        }

        processedJobEntries.push(entry);
    });

    // --- NEW: Push all updates to Firebase in one go ---
    if (Object.keys(updatesToFirebase).length > 0) {
        console.log(`Auto-updating ${Object.keys(updatesToFirebase).length} PRs from CSV...`);
        try {
            await db.ref('job_entries').update(updatesToFirebase);
            console.log("Firebase auto-update successful!");
        } catch (error) {
            console.error("Failed to auto-update PRs in Firebase:", error);
        }
    }
    // --- END NEW ---

    allSystemEntries = processedJobEntries; // Set the global cache
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    cacheTimestamps.systemEntries = now; // Update timestamp
    console.log(`Workdesk Job Records cache updated with ${allSystemEntries.length} job entries.`);
}


// [REPLACE this entire function around line 1307]

function isTaskComplete(task) {
    if (!task) return false;

    // --- *** THIS IS THE NEW LOGIC (THE FIX) *** ---
    // A job_entry of type "Invoice" is a special case.
    // It is ONLY complete if it has a dateResponded.
    // This check must come BEFORE the "attention === 'All'" check.
    if (task.source === 'job_entry' && task.for === 'Invoice') {
        // It's an invoice job. It is only "complete" if it has a response date.
        // Since we cleared the date on update, this will be false (active).
        return !!task.dateResponded; 
    }
    // --- *** END OF NEW LOGIC *** ---


    // Define "completed" statuses
    const completedStatuses = [
        'CEO Approval', 
        'With Accounts', 
        'Under Review', 
        'SRV Done', 
        'Paid',
        'CLOSED',
        'Cancelled',
    ];

    // Check for invoice_entry source (from IM module)
    if (task.source === 'invoice') {
        if (completedStatuses.includes(task.remarks)) {
            return true;
        }
        if (task.enteredBy === currentApprover?.Name) {
            const trackingStatuses = ['For SRV', 'For IPC'];
            if (trackingStatuses.includes(task.remarks)) {
                return false; // Still needs action from them
            }
            return true; 
        }
        return false;
    }
    
    // Check for job_entry source
    if (task.source === 'job_entry') {
        // Now that the "Invoice" check is done, this line is safe.
        // This makes "IPC" jobs with "All" (that aren't Invoices) be marked as complete.
        if (task.attention === 'All') return true;

        if (completedStatuses.includes(task.remarks)) {
            return true;
        }
        if (task.for === 'PR' && task.remarks === 'PO Ready') {
            return true;
        }
        
        // We already handled "Invoice", so we just check other types
        if (task.for !== 'PR' && task.dateResponded) { 
            return true;
        }
    }
    
    return false; // If no other rule matches, it's not complete
}

// [REPLACE this entire function around line 1354]

function resetJobEntryForm(keepJobType = false) {
    const jobType = jobForSelect.value;
    jobEntryForm.reset(); // This resets <select id="job-for"> to ""
    
    if (keepJobType) {
         jobForSelect.value = jobType;
    }

    currentlyEditingKey = null;
    ['job-amount', 'job-po'].forEach(id => document.getElementById(id).classList.remove('highlight-field'));
    
    // --- *** THIS IS THE FIX *** ---
    // 1. Re-enable the "Attention" dropdown if it was disabled
    if (attentionSelectChoices.disabled) {
        attentionSelectChoices.enable();
    }
    
    // 2. Clear any lingering selections (like "Auto-assigned")
    attentionSelectChoices.clearInput();
    attentionSelectChoices.removeActiveItems();
    
    // 3. Repopulate it with the full list of approvers
    populateAttentionDropdown(attentionSelectChoices);
    
    // 4. Reset the Site dropdown
    if (siteSelectChoices) {
        siteSelectChoices.clearInput();
        siteSelectChoices.removeActiveItems();
    }
    // --- *** END OF FIX *** ---

    jobEntryFormTitle.textContent = 'Add New Job Entry';
    addJobButton.classList.remove('hidden');
    updateJobButton.classList.add('hidden');
    deleteJobButton.classList.add('hidden'); 
    
    addJobButton.disabled = false;
    addJobButton.textContent = 'Add';

    if (jobEntryNavControls) jobEntryNavControls.classList.add('hidden');
    navigationContextList = [];
    navigationContextIndex = -1;

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
                { value: 'All', label: 'All (Send to Records)' }, // <-- ADD THIS LINE
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

        siteSelectChoices.setChoices([{ value: '', label: 'Loading...', disabled: true, selected: true }], 'value', 'label', true);

        const snapshot = await db.ref('project_sites').once('value');
        const sites = snapshot.val();

        if (sites) {
            const siteOptions = Object.values(sites)
                .map(site => site.Warehouse && site.Description ? { value: site.Warehouse, label: `${site.Warehouse} - ${site.Description}` } : null)
                .filter(Boolean)
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
// --- *** JOB ENTRY FETCH FIX (START) *** ---
async function handleJobEntrySearch(searchTerm) {
    const searchText = (searchTerm || '').toLowerCase();
    sessionStorage.setItem('jobEntrySearch', searchText); // Save search term

    jobEntryTableBody.innerHTML = '<tr><td colspan="8">Searching...</td></tr>';

    try {
        // Fetch all job_entries
        await ensureAllEntriesFetched();
        
        // Filter for entries entered by the current user that are NOT complete
        userJobEntries = allSystemEntries.filter(entry => 
            entry.enteredBy === currentApprover.Name && !isTaskComplete(entry)
        );

        let filteredEntries = userJobEntries;
        
        // Apply search filter if one is provided
        if (searchText) {
            filteredEntries = userJobEntries.filter(entry => {
                return (
                    (entry.for && entry.for.toLowerCase().includes(searchText)) ||
                    (entry.ref && entry.ref.toLowerCase().includes(searchText)) ||
                    (entry.site && entry.site.toLowerCase().includes(searchText)) ||
                    (entry.group && entry.group.toLowerCase().includes(searchText)) ||
                    (entry.attention && entry.attention.toLowerCase().includes(searchText)) ||
                    (entry.po && entry.po.toLowerCase().includes(searchText))
                );
            });
        }
        
        renderJobEntryTable(filteredEntries);

    } catch (error) {
        console.error("Error during job entry search:", error);
        jobEntryTableBody.innerHTML = '<tr><td colspan="8">Error searching entries.</td></tr>';
    }
}
// [Replace this entire function]

function getJobDataFromForm() {
    const formData = new FormData(jobEntryForm);
    const data = {
        for: formData.get('for'),
        ref: (formData.get('ref') || '').trim(), // <-- ADDED .trim()
        amount: formData.get('amount') || '',
        po: (formData.get('po') || '').trim(), // <-- ADDED .trim()
        site: formData.get('site'),
        group: formData.get('group'),
        attention: attentionSelectChoices.getValue(true),
        date: formatDate(new Date()),
        remarks: (formData.get('status') || 'Pending').trim() // <-- ADDED .trim()
    };
    return data;
}

// --- (MODIFIED) handleAddJobEntry ---
async function handleAddJobEntry(e) {
    e.preventDefault();
addJobButton.disabled = true;
    addJobButton.textContent = 'Adding...';
    const jobData = getJobDataFromForm();
    
    // --- (MODIFICATION) Check for "Invoice" job type ---
    const isInvoiceJob = jobData.for === 'Invoice';
    if (!jobData.for || !jobData.site || !jobData.group) {
        alert('Please fill in Job, Site, and Group.');
        return;
    }
    if (!isInvoiceJob && !jobData.attention) { // Attention is only required if NOT an "Invoice" job
         alert('Please select an Attention user.'); 
         return; 
    }
    // --- (END MODIFICATION) ---

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
        // --- (REMOVED) `updateJobTaskLookup` call ---

        alert('Job Entry Added Successfully!');
        
        // --- *** JOB ENTRY FETCH FIX (START) *** ---
        await ensureAllEntriesFetched(true); // Force refresh cache
        handleJobEntrySearch(jobEntrySearchInput.value); // Re-run search
        resetJobEntryForm();
        // --- *** JOB ENTRY FETCH FIX (END) *** ---
        
    } catch (error) { 
        console.error("Error adding job entry:", error); 
        alert('Failed to add Job Entry. Please try again.'); 
        
        // === ADD THESE TWO LINES ===
        addJobButton.disabled = false; // Re-enable on error
        addJobButton.textContent = 'Add';
        // === END OF ADDITION ===
    }
}

// [ADD this entire function back into app.js, around line 1493]

// --- *** NEW DELETE FUNCTION (CHANGE 2.3) *** ---
async function handleDeleteJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) {
        alert("No entry selected for deletion.");
        return;
    }

    // Double-check user permission (although button is hidden, this is safer)
    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    if (userPositionLower !== 'accounting') {
        alert("You do not have permission to delete entries.");
        return;
    }

    if (!confirm("Are you sure you want to permanently delete this job entry? This action cannot be undone.")) {
        return;
    }

    try {
        // Delete from Firebase
        await db.ref(`job_entries/${currentlyEditingKey}`).remove();

        alert('Job Entry Deleted Successfully!');
        
        // Force refresh all caches
        await ensureAllEntriesFetched(true); 
        
        // Re-run the search for the pending entries table
        handleJobEntrySearch(jobEntrySearchInput.value); 
        
        // Reset the form
        resetJobEntryForm();
        
        // Refresh the active tasks list as well
        populateActiveTasks(); 

    } catch (error) {
        console.error("Error deleting job entry:", error);
        alert('Failed to delete Job Entry. Please try again.');
    }
}
// --- *** END CHANGE 2.3 *** ---

// [REPLACE this entire function around line 1445]

async function handleUpdateJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) { alert("No entry selected for update."); return; }
    const formData = new FormData(jobEntryForm);
    
    // 1. Get data from form
    const jobData = { 
        for: formData.get('for'), 
        ref: (formData.get('ref') || '').trim(), 
        amount: formData.get('amount') || '', 
        po: (formData.get('po') || '').trim(), 
        site: formData.get('site'), 
        group: formData.get('group'), 
        attention: attentionSelectChoices.getValue(true) || '', // Add fallback
        remarks: (formData.get('status') || 'Pending').trim() 
    };
    
    // If the job type is "Invoice", forcefully clear the attention
    if (jobData.for === 'Invoice') {
        jobData.attention = '';
    }

    const isInvoiceJob = jobData.for === 'Invoice';
    if (!jobData.for || !jobData.site || !jobData.group) {
        alert('Please fill in Job, Site, and Group.');
        return;
    }
    if (!isInvoiceJob && !jobData.attention) { // Attention is only required if NOT an "Invoice" job
         alert('Please select an Attention user.'); 
         return; 
    }
    
    try {
        await ensureAllEntriesFetched(); // Get the original entry
        const originalEntry = allSystemEntries.find(entry => entry.key === currentlyEditingKey);
                
        if (originalEntry) { 
            // 2. Copy over non-form data
            jobData.enteredBy = originalEntry.enteredBy; 
            jobData.timestamp = originalEntry.timestamp; 
            jobData.date = originalEntry.date; 

            // --- *** NEW, SIMPLIFIED LOGIC AS YOU REQUESTED *** ---
            let newDateResponded = originalEntry.dateResponded || null; // Start with the old value

            // CASE 1: Is this the "attention" person completing their own task?
            if (currentApprover.Name === (originalEntry.attention || '') && 
                !originalEntry.dateResponded && // and it's not already completed
                jobData.for !== 'Invoice' && // and it's not an invoice
                jobData.attention === (originalEntry.attention || '')) // and they didn't change the attention
            {
                // This is the *only* case where we ADD a completion date
                newDateResponded = formatDate(new Date());
            } 
            // CASE 2: Is this any other update? (Changing job type, changing attention, etc.)
            else {
                // We must check if the form data is different from the original data.
                const hasChanged = (
                    jobData.for !== originalEntry.for ||
                    jobData.ref !== (originalEntry.ref || '') ||
                    jobData.amount !== (originalEntry.amount || '') ||
                    jobData.po !== (originalEntry.po || '') ||
                    jobData.site !== originalEntry.site ||
                    jobData.group !== originalEntry.group ||
                    jobData.attention !== (originalEntry.attention || '') ||
                    jobData.remarks !== originalEntry.remarks
                );
                
                if (hasChanged) {
                    // An edit was made. This task must be reactivated.
                    newDateResponded = null; // This will delete the date from Firebase
                }
                // If nothing changed, newDateResponded just keeps its original value
            }
            
            jobData.dateResponded = newDateResponded;
            // --- *** END OF NEW LOGIC *** ---
            
        } else {
            jobData.dateResponded = null;
        }

        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
        if (jobData.for === 'IPC' && jobData.attention === 'All' && isQS) {
            jobData.remarks = 'Ready';
        }
        
        // This update saves jobData, including jobData.dateResponded = null
        await db.ref(`job_entries/${currentlyEditingKey}`).update(jobData); 

        alert('Job Entry Updated Successfully!');
        
        await ensureAllEntriesFetched(true); // Force refresh cache
        handleJobEntrySearch(jobEntrySearchInput.value); // Re-run search
        resetJobEntryForm(); // This will now correctly unlock the form
        
        populateActiveTasks(); // Re-fetch all tasks
    } catch (error) { 
        console.error("Error updating job entry:", error); 
        alert('Failed to update Job Entry. Please try again.'); 
    }
}
// --- *** END CHANGE 2.3 *** ---

// [REPLACE this entire function around line 1515]

// [REPLACE this entire function around line 1515]

function populateFormForEditing(key) {
    // This needs to fetch from allSystemEntries, which is correct
    const entryData = allSystemEntries.find(entry => entry.key === key);
    if (!entryData || entryData.source === 'invoice') return;

    currentlyEditingKey = key;
    
    // --- *** THIS IS THE FIX (START) *** ---
    // 1. We set the job value first
    const jobForInput = document.getElementById('job-for');
    jobForInput.value = entryData.for || '';
    
    // 2. We manually trigger the 'change' event
    //    This will force the "Attention" dropdown to unlock itself
    //    based on the *correct* job type ("IPC" in your example).
    jobForInput.dispatchEvent(new Event('change'));
    // --- *** THIS IS THE FIX (END) *** ---

    document.getElementById('job-ref').value = entryData.ref || '';
    const amountInput = document.getElementById('job-amount');
    const poInput = document.getElementById('job-po');
    amountInput.value = entryData.amount || '';
    poInput.value = entryData.po || '';
    document.getElementById('job-group').value = entryData.group || '';
    siteSelectChoices.setChoiceByValue(entryData.site || '');
    
    // 3. We set the "Attention" value *after* the dropdown has been unlocked
    attentionSelectChoices.setChoiceByValue(entryData.attention || '');

    document.getElementById('job-status').value = (entryData.remarks === 'Pending') ? '' : entryData.remarks || '';
    jobEntryFormTitle.textContent = 'Editing Job Entry';
    addJobButton.classList.add('hidden');
    updateJobButton.classList.remove('hidden');

    const userPositionLower = (currentApprover?.Position || '').toLowerCase();
    if (userPositionLower === 'accounting') {
        deleteJobButton.classList.remove('hidden');
    } else {
        deleteJobButton.classList.add('hidden');
    }

    amountInput.classList.remove('highlight-field');
    poInput.classList.remove('highlight-field');
    window.scrollTo(0, 0);
}

// [Find and replace this entire function, around line 1511]

function updateJobEntryNavControls() {
    if (navigationContextList.length > 0 && navigationContextIndex > -1) {
        // Show controls
        jobEntryNavControls.classList.remove('hidden');
        
        // --- THIS IS THE FIX ---
        // We are using simple quotes (+) instead of backticks (`)
        // This avoids any regex confusion.
        navJobCounter.textContent = (navigationContextIndex + 1) + ' / ' + navigationContextList.length;
        // --- END OF FIX ---

        // Enable/disable buttons at the start or end of the list
        navPrevJobButton.disabled = (navigationContextIndex === 0);
        navNextJobButton.disabled = (navigationContextIndex === navigationContextList.length - 1);
    } else {
        // Hide controls
        jobEntryNavControls.classList.add('hidden');
    }
}

// [REPLACE this entire function around line 1555]

// --- (MODIFIED) populateActiveTasks ---
// Fetches job_entries directly and invoice_entries from the inbox.
async function populateActiveTasks() {
    activeTaskTableBody.innerHTML = `<tr><td colspan="10">Loading tasks...</td></tr>`;
    if (!currentApprover || !currentApprover.Name) {
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Could not identify user.</td></tr>`;
        return;
    }

    try {
        const currentUserName = currentApprover.Name;
        const userPositionLower = (currentApprover?.Position || '').toLowerCase();

        // --- *** LOGIC AS PER YOUR REQUEST *** ---
        const isAccounting = userPositionLower === 'accounting'; // Strict check
        const isQS = userPositionLower === 'qs'; // Check for QS
        const isProcurement = userPositionLower === 'procurement';
        // --- *** END OF LOGIC *** ---

        let userTasks = [];
        let pulledInvoiceKeys = new Set(); 

        // --- PART 1: FETCH JOB_ENTRY TASKS ---
        await ensureAllEntriesFetched(); 
        await ensureApproverDataCached();
        
        const jobTasks = allSystemEntries.filter(entry => {
            // 1. Check if the task is complete.
            //    Our new isTaskComplete() will correctly see the
            //    updated "Invoice" task as ACTIVE (it returns false).
            if (isTaskComplete(entry)) return false; 

            // 2. Logic for "Invoice" jobs
            if (entry.for === 'Invoice') {
                return isAccounting; // Only shows for "Accounting"
            }

            // 3. Logic for "PR" jobs
            if (entry.for === 'PR') {
                if (isProcurement) return true; // Show to Procurement
                if (entry.attention === currentUserName) return true; // Show to Attention
                return false;
            }

            // --- *** THIS IS YOUR NEW "IPC" to "QS" RULE *** ---
            // 4. Logic for "IPC" jobs
            if (entry.for === 'IPC') {
                // Only show if the user is a QS AND the task is for them
                return isQS && entry.attention === currentUserName;
            }
            // --- *** END OF NEW RULE *** ---
            
            // 5. Logic for all *other* job types
            return entry.attention === currentUserName;
        });

        // Add vendorName to job_entries tasks (it's already there from ensureAllEntriesFetched)
        userTasks = jobTasks.map(task => ({ ...task, source: 'job_entry' }));
        // --- END OF PART 1 ---


        // --- PART 2: FETCH INVOICE_ENTRY TASKS (From IM Module) ---
        const sanitizeFirebaseKey = (key) => key.replace(/[.#$[\]]/g, '_');
        const safeCurrentUserName = sanitizeFirebaseKey(currentUserName);
        const invoiceTaskSnapshot = await invoiceDb.ref(`invoice_tasks_by_user/${safeCurrentUserName}`).once('value');
        
        if (invoiceTaskSnapshot.exists()) {
            const tasksData = invoiceTaskSnapshot.val();
            for (const invoiceKey in tasksData) {
                const task = tasksData[invoiceKey];
                pulledInvoiceKeys.add(invoiceKey); 

                const transformedInvoice = {
                    key: `${task.po}_${invoiceKey}`,
                    originalKey: invoiceKey,
                    originalPO: task.po,
                    source: 'invoice',
                    for: 'Invoice',
                    ref: task.ref,
                    po: task.po,
                    amount: task.amount,
                    site: task.site,
                    group: 'N/A',
                    attention: currentUserName,
                    enteredBy: 'Irwin', 
                    date: formatYYYYMMDD(task.date),
                    calendarDate: formatYYYYMMDD(task.releaseDate) !== 'N/A' ? formatYYYYMMDD(task.releaseDate) : formatYYYYMMDD(task.date),
                    remarks: task.status,
                    timestamp: (task.releaseDate || task.date) ? new Date(task.releaseDate || task.date).getTime() : Date.now(), 
                    invName: task.invName,
                    vendorName: (task.po && allPOData && allPOData[task.po]) ? (allPOData[task.po]['Supplier Name'] || 'N/A') : 'N/A',
                    note: task.note
                };
                userTasks.push(transformedInvoice);
            }
        }
        // --- END OF PART 2 ---

        // --- PART 3: Scan ALL invoices for "Accounting" (for unassigned) ---
        if (isAccounting) {
            await ensureInvoiceDataFetched(); 
            const statusesToPull = ['Pending', 'Report', 'Original PO'];

            if (allInvoiceData && allPOData) {
                for (const poNumber in allInvoiceData) {
                    const poInvoices = allInvoiceData[poNumber];
                    for (const invoiceKey in poInvoices) {
                        if (pulledInvoiceKeys.has(invoiceKey)) continue;
                        const inv = poInvoices[invoiceKey];

                        if (inv && statusesToPull.includes(inv.status) && (!inv.attention || inv.attention === '')) {
                            const poDetails = allPOData[poNumber] || {};
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
                            userTasks.push(transformedInvoice);
                        }
                    }
                }
            }
        }
        // --- END OF PART 3 ---

        // Store and render the combined list of tasks
        userActiveTasks = userTasks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Update task count and badge
        const taskCount = userActiveTasks.length;
        if (activeTaskCountDisplay) {
            activeTaskCountDisplay.textContent = `(Total Tasks: ${taskCount})`;
        }
        [wdActiveTaskBadge, imActiveTaskBadge, wdMobileNotifyBadge].forEach(badge => {
            if (badge) {
                badge.textContent = taskCount;
                badge.style.display = taskCount > 0 ? 'inline-block' : 'none';
            }
        });

        // Generate dynamic tabs
        const uniqueStatuses = [...new Set(userActiveTasks.map(task => task.remarks || 'Pending'))];
        uniqueStatuses.sort(); 
        let tabsHTML = '<button class="active" data-status-filter="All">All Tasks</button>';
        uniqueStatuses.forEach(status => {
            tabsHTML += `<button data-status-filter="${status}">${status}</button>`;
        });
        activeTaskFilters.innerHTML = tabsHTML;
        currentActiveTaskFilter = 'All';
        
        renderActiveTaskTable(userTasks); 

    } catch (error) {
        console.error("Error fetching active tasks:", error);
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Error loading tasks.</td></tr>`;
    }
}
// --- *** MOBILE VIEW FIX (START) *** ---
// ++ MODIFIED: renderActiveTaskTable ++
// [Replace this entire function around line 1668]

function renderActiveTaskTable(tasks) {
    activeTaskTableBody.innerHTML = '';
    
    // --- THIS IS THE NEW FILTER LOGIC ---
    let filteredTasks = tasks;
    if (currentActiveTaskFilter !== 'All') {
        if (currentActiveTaskFilter === 'Other') {
            // "Other" includes everything NOT "For SRV" or "Pending Signature"
            filteredTasks = tasks.filter(task => 
                task.remarks !== 'For SRV' && 
                task.remarks !== 'Pending Signature'
            );
        } else {
            // This filters for "For SRV" or "Pending Signature"
            filteredTasks = tasks.filter(task => task.remarks === currentActiveTaskFilter);
        }
    }
    // --- END OF NEW FILTER LOGIC ---

    if (!filteredTasks || filteredTasks.length === 0) {
        if (tasks.length === 0) {
            // The main list is empty
            activeTaskTableBody.innerHTML = `<tr><td colspan="10">You have no active tasks.</td></tr>`;
        } else {
            // The main list has items, but the filter has no matches
            activeTaskTableBody.innerHTML = `<tr><td colspan="10">No tasks found for the filter "${currentActiveTaskFilter}".</td></tr>`;
        }
        return;
    }

    filteredTasks.forEach(task => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', task.key);

        const isInvoiceFromIrwin = task.source === 'invoice' && task.enteredBy === 'Irwin';

        const invName = task.invName || '';
        const isClickable = (isInvoiceFromIrwin || (task.source === 'invoice' && invName)) &&
                            invName.trim() &&
                            invName.toLowerCase() !== 'nil';

        if (isClickable) {
            row.classList.add('clickable-pdf');
        }

        // --- *** THIS IS THE FIX *** ---
        let srvDoneDisabled = '';
        if (task.source !== 'invoice') {
            srvDoneDisabled = 'disabled title="Only invoice tasks can be marked SRV Done"';
        } else if (task.remarks === 'Report') {
            srvDoneDisabled = 'disabled title="Cannot mark \'Report\' status as SRV Done"';
        } else if (task.remarks === 'Original PO') {
            srvDoneDisabled = 'disabled title="Cannot mark \'Original PO\' status as SRV Done"';
        }
        // --- *** END OF FIX *** ---
        
        const actionButtons = `
            <button class="srv-done-btn" data-key="${task.key}" ${srvDoneDisabled}>SRV Done</button>
            <button class="modify-btn" data-key="${task.key}">Edit Action</button>
        `;

        const poMobile = `<td class="mobile-only" data-label="PO">${task.po || ''}</td>`;
        const vendorMobile = `<td class="mobile-only" data-label="Vendor Name">${task.vendorName || 'N/A'}</td>`;
        const amountMobile = `<td class="mobile-only" data-label="Invoice Amount">${formatCurrency(task.amount)}</td>`;
        const siteMobile = `<td class="mobile-only" data-label="Site">${task.site || 'N/A'}</td>`;
        
        const desktopColumns = `
            <td class="desktop-only">${task.for || ''}</td>
            <td class="desktop-only">${task.ref || ''}</td>
            <td class="desktop-only">${task.po || ''}</td>
            <td class="desktop-only">${task.vendorName || 'N/A'}</td>
            <td class="desktop-only">${formatCurrency(task.amount)}</td>
            <td class="desktop-only">${task.site || ''}</td>
            <td class="desktop-only">${task.group || ''}</td>
            <td class="desktop-only">${task.date || ''}</td>
            <td class="desktop-only">${task.remarks || 'Pending'}</td>
            <td class="desktop-only">${actionButtons}</td>
        `;

        row.innerHTML = poMobile + vendorMobile + amountMobile + siteMobile + desktopColumns;

        row.querySelectorAll('.mobile-only').forEach(cell => {
             cell.addEventListener('click', () => {
                const taskData = userActiveTasks.find(entry => entry.key === task.key);
                if (!taskData) {
                     alert("Could not find task details. The list may be out of date. Please refresh.");
                     return;
                }
                openModifyTaskModal(taskData);
            });
        });

        activeTaskTableBody.appendChild(row);
    });
}

// --- *** MOBILE VIEW FIX (END) *** ---


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
    
    // --- (NEW) Update Count ---
    const count = entries.length;
    if (jobRecordsCountDisplay) {
        jobRecordsCountDisplay.textContent = `(Total Records: ${count})`;
    }
    // --- (END NEW) ---
    
    if (!entries || count === 0) { 
        reportingTableBody.innerHTML = '<tr><td colspan="11">No entries found for the selected criteria.</td></tr>'; 
        return; 
    }
    
    entries.forEach(entry => {
        const status = isTaskComplete(entry) ? (entry.remarks || 'Completed') : (entry.remarks || 'Pending');
        const row = document.createElement('tr');
	
	row.setAttribute('data-key', entry.key); // <-- ADD THIS LINE
        const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin'; // <-- ADD THIS LINE
        if (isAdmin) row.classList.add('admin-clickable-row'); // <-- ADD THIS LINE

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

// [Replace this entire function]

async function populateWorkdeskDashboard() {
    // 1. Populate the user's personal task list (for the card)
    await populateActiveTasks(); 
    dbActiveTasksCount.textContent = userActiveTasks.length;

    // 2. Populate the admin's "all tasks" list (for the calendar)
    await populateAdminCalendarTasks();

    // 3. Populate completed tasks count
    await ensureAllEntriesFetched(); // This gets all job_entries
    
    // --- THIS IS THE FIX ---

    // Count completed job_entries (this is the original logic, it works for all users)
    let completedJobTasks = allSystemEntries.filter(task => 
        (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name) && isTaskComplete(task)
    );

    let completedInvoiceTasks = [];
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    // We must check for completed invoices for ALL users.
    await ensureInvoiceDataFetched(); // This gets all invoice_entries

    if (allInvoiceData) {
        if (isAccounting) {
            // --- Logic for "Accounting" ---
            // Count all invoices they "own" (as the "Irwin" user)
            for (const poNumber in allInvoiceData) {
                const poInvoices = allInvoiceData[poNumber];
                for (const invoiceKey in poInvoices) {
                    const inv = poInvoices[invoiceKey];
                    const invoiceTask = {
                        key: `${poNumber}_${invoiceKey}`,
                        source: 'invoice',
                        remarks: inv.status,
                        enteredBy: currentApprover.Name // Assume they are the owner
                    };
                    if (isTaskComplete(invoiceTask)) {
                        completedInvoiceTasks.push(invoiceTask);
                    }
                }
            }
        } else {
            // --- Logic for "User" (non-Accounting) ---
            // Count all invoices that were ASSIGNED to them and are now complete.
            for (const poNumber in allInvoiceData) {
                const poInvoices = allInvoiceData[poNumber];
                for (const invoiceKey in poInvoices) {
                    const inv = poInvoices[invoiceKey];
                    
                    // Check if the task was assigned to this user
                    if (inv.attention === currentApprover.Name) {
                        const invoiceTask = {
                            key: `${poNumber}_${invoiceKey}`,
                            source: 'invoice',
                            remarks: inv.status,
                            // This task is assigned to them, not entered by them
                            enteredBy: 'Irwin' // (or whoever enters invoices)
                        };
                        
                        // isTaskComplete() will return true if the status is "SRV Done", "Paid", etc.
                        if (isTaskComplete(invoiceTask)) {
                            completedInvoiceTasks.push(invoiceTask);
                        }
                    }
                }
            }
        }
    }
    
    // The total is the sum of both lists
    const totalCompleted = completedJobTasks.length + completedInvoiceTasks.length;
    dbCompletedTasksCount.textContent = totalCompleted;
    // --- END OF FIX ---
}

// [Replace this entire function]

// ++ NEW: Function to open the Modify Task modal ++
function openModifyTaskModal(taskData) {
    if (!taskData) return;

    // Store all identifiers in the form's hidden fields
    modifyTaskKey.value = taskData.key;
    modifyTaskSource.value = taskData.source;
    modifyTaskOriginalPO.value = taskData.originalPO || '';
    modifyTaskOriginalKey.value = taskData.originalKey || '';

    // --- *** THIS IS THE FIX (Part 1) *** ---
    // We store the *original* attention value before the user changes it.
    document.getElementById('modify-task-originalAttention').value = taskData.attention || '';
    // --- *** END OF FIX *** ---

    // Set Attention dropdown to the current value
    if (modifyTaskAttentionChoices) {
        modifyTaskAttentionChoices.setChoiceByValue(taskData.attention || '');
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

// [Replace this entire function]

// --- (MODIFIED) handleSaveModifiedTask ---
async function handleSaveModifiedTask() {
    const key = modifyTaskKey.value;
    const source = modifyTaskSource.value;
    const originalPO = modifyTaskOriginalPO.value;
    const originalKey = modifyTaskOriginalKey.value;

    // --- *** THIS IS THE FIX (Part 2) *** ---
    // Read the original attention value that we saved in the hidden field.
    const originalAttention = document.getElementById('modify-task-originalAttention').value;
    // --- *** END OF FIX *** ---

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
        remarks: selectedStatus, // 'remarks' for job_entry
        status: selectedStatus,  // 'status' for invoice_entry
        note: modifyTaskNote.value.trim()
    };

    if (updates.status === 'Under Review' || updates.status === 'With Accounts') {
        updates.attention = '';
    }

    modifyTaskSaveBtn.disabled = true;
    modifyTaskSaveBtn.textContent = 'Saving...';

    try {
        if (source === 'job_entry') {
            // This is a job entry, update the main DB
            await ensureAllEntriesFetched(); 
            const originalEntry = allSystemEntries.find(entry => entry.key === key);

            const newAttention = updates.attention;
            const oldAttention = originalEntry ? originalEntry.attention : '';

            if (originalEntry && currentApprover.Name === oldAttention && newAttention === oldAttention) {
                updates.dateResponded = formatDate(new Date());
            } else if (newAttention !== oldAttention) {
                updates.dateResponded = null; 
            } else {
                updates.dateResponded = originalEntry ? originalEntry.dateResponded : null;
            }

            await db.ref(`job_entries/${key}`).update({
                attention: updates.attention,
                remarks: updates.remarks,
                note: updates.note,
                dateResponded: updates.dateResponded 
            });
            
            // Invalidate the cache so it's forced to refetch
            allSystemEntries = []; 

        } else if (source === 'invoice' && originalPO && originalKey) {
            // This is an invoice entry, update the invoice DB
            await invoiceDb.ref(`invoice_entries/${originalPO}/${originalKey}`).update({
                attention: updates.attention,
                status: updates.status,
                note: updates.note
            });
            
            // Get original data from the local cache (this is just for merging)
            if (!allInvoiceData) await ensureInvoiceDataFetched(); 
            const originalInvoice = (allInvoiceData && allInvoiceData[originalPO]) ? allInvoiceData[originalPO][originalKey] : {};
            const updatedInvoiceData = {...originalInvoice, ...updates}; 
            
            // --- *** THIS IS THE FIX (Part 3) *** ---
            // We pass the *correct* originalAttention, not the stale one from the cache.
            await updateInvoiceTaskLookup(originalPO, originalKey, updatedInvoiceData, originalAttention);
            // --- *** END OF FIX *** ---

            // Also update the local cache
            updateLocalInvoiceCache(originalPO, originalKey, updates);
        } else {
            throw new Error("Invalid task source or missing keys.");
        }

        alert("Task updated successfully!");
        modifyTaskModal.classList.add('hidden');
        
        await populateActiveTasks(); // Re-fetch all tasks

    } catch (error) {
        console.error("Error updating task:", error);
        alert("Failed to update task. Please try again.");
    } finally {
        modifyTaskSaveBtn.disabled = false;
        modifyTaskSaveBtn.textContent = 'Save Changes';
    }
}


// [Replace this entire function around line 1876]

function handleActiveTaskSearch(searchTerm) {
    const searchText = searchTerm.toLowerCase();
    sessionStorage.setItem('activeTaskSearch', searchText); // Save search term

    // 1. Apply text search first
    let searchedTasks = userActiveTasks;
    if (searchText) {
        searchedTasks = userActiveTasks.filter(task => {
            return (
                (task.for && task.for.toLowerCase().includes(searchText)) ||
                (task.ref && task.ref.toLowerCase().includes(searchText)) ||
                (task.po && task.po.toLowerCase().includes(searchText)) ||
                (task.vendorName && task.vendorName.toLowerCase().includes(searchText)) ||
                (task.site && task.site.toLowerCase().includes(searchText)) ||
                (task.group && task.group.toLowerCase().includes(searchText)) ||
                (task.date && task.date.toLowerCase().includes(searchText)) ||
                // --- THIS IS THE FIX ---
                // It now also searches the hidden calendarDate (which uses releaseDate)
                (task.calendarDate && task.calendarDate.toLowerCase().includes(searchText))
                // --- END OF FIX ---
            );
        });
    }
    
    // 2. Pass the SEARCHED list to render, which will then apply the STATUS filter
    renderActiveTaskTable(searchedTasks);
}

// [Replace this entire function]

// --- *** WORKDESK REPORTING FIX (MODIFIED) *** ---
async function handleReportingSearch() {
    const searchText = reportingSearchInput.value.toLowerCase();
    sessionStorage.setItem('reportingSearch', searchText); // Save search term

    reportingTableBody.innerHTML = '<tr><td colspan="11">Searching report data...</td></tr>';
    try {
        await ensureAllEntriesFetched(); // This now correctly fetches ONLY job_entries
        
        // This admin-site logic is specific to your reporting needs
        const userSiteString = currentApprover.Site || '';
        const userSites = userSiteString.toLowerCase() === 'all' ? null : userSiteString.split(',').map(s => s.trim());
        
        // 1. Get all entries relevant to this user
        const relevantEntries = allSystemEntries.filter(entry => {
            const isMySite = userSites === null || (entry.site && userSites.includes(entry.site));
            const isRelatedToMe = (entry.enteredBy === currentApprover.Name || entry.attention === currentApprover.Name);
            return isMySite || isRelatedToMe;
        });

        // --- *** NEW DYNAMIC TAB LOGIC *** ---
        const reportTabs = document.getElementById('report-tabs');
        if (reportTabs) {
            // 2. Get all unique job types from the user's relevant entries
            const uniqueJobTypes = [...new Set(relevantEntries.map(entry => entry.for || 'Other'))];
            uniqueJobTypes.sort(); // Sort them alphabetically

            // 3. Build the new tab HTML
            let tabsHTML = '<button class="active" data-job-type="All">All Jobs</button>';
            uniqueJobTypes.forEach(jobType => {
                // We use the 'jobType' for both the data-attribute and the button text
                tabsHTML += `<button data-job-type="${jobType}">${jobType}</button>`;
            });

            // 4. Update the DOM
            reportTabs.innerHTML = tabsHTML;

            // 5. Ensure the global filter state is valid
            // If the old filter (e.g., "Trip") doesn't exist in the new tabs, reset to "All"
            if (!uniqueJobTypes.includes(currentReportFilter) && currentReportFilter !== 'All') {
                currentReportFilter = 'All';
            }
            
            // 6. Set the active class on the correct tab
            reportTabs.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            
            const activeTabButton = reportTabs.querySelector(`button[data-job-type="${currentReportFilter}"]`);
            if (activeTabButton) {
                activeTabButton.classList.add('active');
            } else {
                // Fallback just in case
                const allJobsButton = reportTabs.querySelector('button[data-job-type="All"]');
                if (allJobsButton) {
                    allJobsButton.classList.add('active');
                }
                currentReportFilter = 'All'; // Reset the filter
            }
        }
        // --- *** END OF NEW LOGIC *** ---

        // 7. Render the table with the (now relevant) entries
        filterAndRenderReport(relevantEntries);

    } catch (error) {
        console.error("Error fetching all entries for reporting:", error);
        reportingTableBody.innerHTML = '<tr><td colspan="11">Error loading reporting data.</td></tr>';
    }
}
// --- *** WORKDESK REPORTING FIX (END) *** ---


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
    // Content removed
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
        // --- *** MOBILE VIEW FIX (START) *** ---
        // Also check window width
        const isMobile = window.innerWidth <= 768;
        dailyReportContainer.style.display = (isAccountingPosition && !isMobile) ? 'flex' : 'none';
        // --- *** MOBILE VIEW FIX (END) *** ---
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


    if (sectionId === 'im-dashboard') { populateInvoiceDashboard(false); }
    
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
    // --- *** END OF FIX ---
    
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
        updateBatchCount(); // (NEW) Update Count

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
            if (summaryNoteCountDisplay) summaryNoteCountDisplay.textContent = ''; // Clear count
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
            if (reportingCountDisplay) reportingCountDisplay.textContent = ''; // Clear count
            imReportingSearchInput.value = '';
            currentReportData = [];
        }
        populateSiteFilterDropdown();
    }
     // ++ NEW: Initialize Payments Section ++
    if (sectionId === 'im-payments') {
        imPaymentsTableBody.innerHTML = ''; // Clear table on view change
        invoicesToPay = {}; // Reset state
        updatePaymentsCount(); // (NEW) Update Count
    }
    // ++ NEW: Initialize Finance Report Section ++
    if (sectionId === 'im-finance-report') {
        imFinanceSearchPoInput.value = '';
        imFinanceResults.style.display = 'none';
        imFinanceNoResults.style.display = 'none';
        imFinanceAllPaymentsData = {};
        if (financeReportCountDisplay) financeReportCountDisplay.textContent = ''; // Clear count
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
    
    // --- (NEW) Clear Count ---
    if (existingInvoicesCountDisplay) {
        existingInvoicesCountDisplay.textContent = 'Existing Invoices (0)';
    }
    // --- (END NEW) ---
    
    resetInvoiceForm();
}
// --- *** END OF FIX ---

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
    // --- *** END OF FIX ---

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

    let invoiceCount = 0; // --- (NEW) Count ---
    
    // *** MODIFICATION: ADDED THESE TWO LINES ***
    let totalInvValueSum = 0;
    let totalAmountPaidSum = 0;
    // *** END OF MODIFICATION ***

    if (invoicesData) {
        const invoices = Object.entries(invoicesData).map(([key, value]) => ({ key, ...value }));
        invoiceCount = invoices.length; // --- (NEW) Count ---

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
            
            // *** MODIFICATION: ADDED THESE TWO LINES ***
            totalInvValueSum += parseFloat(inv.invValue) || 0;
            totalAmountPaidSum += parseFloat(inv.amountPaid) || 0;
            // *** END OF MODIFICATION ***

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
    
    // --- (NEW) Update Count ---
    if (existingInvoicesCountDisplay) {
        existingInvoicesCountDisplay.textContent = `Existing Invoices (${invoiceCount})`;
    }
    // --- (END NEW) ---
    
    // ++ UPDATED: Use smart ID generation
    const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;
    imInvEntryIdInput.value = nextInvId;
    resetInvoiceForm();
    imNewInvoiceForm.classList.remove('hidden');

    // *** MODIFICATION: ADDED THIS BLOCK TO UPDATE FOOTER ***
    const footer = document.getElementById('im-invoices-table-footer');
    if (footer) {
        // *** ADDED ADMIN/ACCOUNTING CHECK ***
        const isAdminOrAccounting = isAdmin || isAccounting;
        document.getElementById('im-invoices-total-value').textContent = isAdminOrAccounting ? formatCurrency(totalInvValueSum) : '---';
        document.getElementById('im-invoices-total-paid').textContent = isAdminOrAccounting ? formatCurrency(totalAmountPaidSum) : '---';
        // *** END ADMIN/ACCOUNTING CHECK ***

        // Show footer only if there are invoices
        footer.style.display = invoiceCount > 0 ? '' : 'none';
    }
    // *** END OF MODIFICATION ***

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
    // This function will now fetch job_entries directly (slower)
    await populateActiveTasks();
    const tasksToDisplay = userActiveTasks; // userActiveTasks is now fresh
    // --- End FIX ---

    // Filter for "Invoice" tasks assigned to the current user
    const invoiceJobs = tasksToDisplay.filter(task => {
        // --- MODIFIED LOGIC ---
        // A task is an "invoice job" if:
        // 1. It's from `invoice_entries` (source === 'invoice') AND assigned to the current user
        // 2. It's from `job_entries` (source === 'job_entry'), its type is 'Invoice', AND the current user's position is 'Accounting'
        if (task.source === 'invoice' && task.attention === currentApprover.Name) {
            return true;
        }
        if (task.source === 'job_entry' && task.for === 'Invoice' && (currentApprover?.Position || '').toLowerCase() === 'accounting') {
            return true;
        }
        return false;
    });

    // --- (NEW) Update Count ---
    const count = invoiceJobs.length;
    if (activeJobsSidebarCountDisplay) {
        activeJobsSidebarCountDisplay.textContent = `Your Active Invoice Jobs (${count})`;
    }
    // --- (END NEW) ---

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
    imReleaseDateInput.value = normalizeDateForInput(invData.releaseDate);
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
    // --- *** START OF SRV "NIL" FIX *** ---
    const srvNameLower = (invoiceData.srvName || '').toLowerCase();
    if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
    // --- *** END OF SRV "NIL" FIX *** ---
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
                
                // --- (REMOVED) `updateJobTaskLookup` call ---
                
                jobEntryToUpdateAfterInvoice = null;
                await populateActiveJobsSidebar(); // Re-fetch all tasks

            } catch (updateError) {
                console.error("Error updating the original job entry:", updateError);
                alert("Invoice was added, but failed to update the original active task.");
            }
        }
allSystemEntries = [];
        fetchAndDisplayInvoices(currentPO);
        
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
// --- *** NEW AUTOMATION LOGIC *** ---
    const newStatus = invoiceData.status;
    const oldStatus = originalInvoiceData ? originalInvoiceData.status : '';

    // If the status was just changed TO "With Accounts", set releaseDate to today
    if (newStatus === 'With Accounts' && oldStatus !== 'With Accounts') {
        invoiceData.releaseDate = getTodayDateString();
    }
    // --- *** END OF NEW LOGIC *** ---
    
    // --- (Req 3) MODIFIED: Add invEntryID to srvName on update ---
    // --- *** START OF SRV "NIL" FIX *** ---
    // Only run auto-generation if:
    // 1. Status is "With Accounts"
    // 2. srvName is NOT "nil" (case-insensitive)
    // 3. srvName is empty (it was not "nil" and not filled with something else)
    const srvNameLower = (invoiceData.srvName || '').toLowerCase();
    if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
    // --- *** END OF SRV "NIL" FIX *** ---
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

	allSystemEntries = []; // Clear system cache

        // --- *** NEW FIX: Refresh the entire section *** ---
        // This will reload the sidebar and the current PO search
        showIMSection('im-invoice-entry');
        // --- *** END OF NEW FIX *** ---
        
        // We still call this to ensure the table updates in the background
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

// [Replace the entire function around line 2244]

// ++ MODIFIED: To accept forceRefresh and add a refresh button ++
async function populateInvoiceDashboard(forceRefresh = false) {
    const dashboardSection = document.getElementById('im-dashboard');
    // Clear previous content and add the new structure from chart.zip's index.html
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

    // Helper function to show loading
    const showLoading = (list) => {
        if (list) list.innerHTML = '<li>Loading...</li>';
    };
    showLoading(topVendorsList);
    showLoading(topProjectsList);
    showLoading(topActivitiesList);

    try {
        // --- *** THIS IS THE FIX *** ---
        // It now uses forceRefresh (which is 'false' by default)
        const data = await ensureEcostDataFetched(forceRefresh); 
        // --- *** END OF FIX *** ---

        if (!data) {
            dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please try again later.</p>';
            return;
        }

        // --- 1. Process Data & Get Available Years ---
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
                const month = row['Month']; // 0-11
                if (month !== null) {
                    yearlyData[year]['Total Committed'][month] += row['Total Committed'];
                    yearlyData[year]['Delivered Amount'][month] += row['Delivered Amount'];
                    yearlyData[year]['Outstanding'][month] += row['Outstanding'];
                }
            }
        });

        const sortedYears = Array.from(availableYears).sort((a, b) => b - a);

        // --- 2. Populate Year Selector ---
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

        // --- 3. Helper to update Top 5s ---
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

        // --- 4. Render Chart Function (as Bar Chart) ---
        const renderYearlyChart = (selectedYear) => {
            const ctx = document.getElementById('imYearlyChartCanvas').getContext('2d');
            const dataForYear = yearlyData[selectedYear];

            if (imYearlyChart) {
                imYearlyChart.destroy();
            }

            const colors = {
                'Total Committed': 'rgba(54, 162, 235, 0.7)', // Blue
                'Delivered Amount': 'rgba(75, 192, 192, 0.7)', // Green/Teal
                'Outstanding': 'rgba(255, 206, 86, 0.7)' // Yellow
            };

            imYearlyChart = new Chart(ctx, {
                type: 'bar', // Changed to bar chart
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
                                color: 'rgba(230, 241, 255, 0.9)' // Light text for legend
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
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
                                color: 'rgba(168, 178, 209, 0.7)' // Light text for x-axis labels
                            },
                            grid: {
                                color: 'rgba(48, 63, 96, 0.5)' // Dim grid lines
                            }
                        },
                        y: {
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) return `QAR ${value / 1000000}M`;
                                    if (value >= 1000) return `QAR ${value / 1000}K`;
                                    return `QAR ${value}`;
                                },
                                color: 'rgba(168, 178, 209, 0.7)' // Light text for y-axis labels
                            },
                             grid: {
                                color: 'rgba(48, 63, 96, 0.5)' // Dim grid lines
                            }
                        }
                    }
                }
            });
        };

        // --- 5. Initial Render and Event Listener ---
        const initialYear = parseInt(sortedYears[0]);
        renderYearlyChart(initialYear);
        updateTop5Lists(initialYear);

        yearSelect.addEventListener('change', (e) => {
            const selectedYear = parseInt(e.target.value);
            renderYearlyChart(selectedYear);
            updateTop5Lists(selectedYear);
        });

        // --- ADDED EVENT LISTENER FOR REFRESH BUTTON ---
        const refreshBtn = document.getElementById('im-dashboard-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                alert('Forcing dashboard refresh... This may take a moment.');
                populateInvoiceDashboard(true); // Pass 'true' to force refresh
            });
        }
        // --- END OF ADDED LISTENER ---

    } catch (error) {
        console.error("Error populating invoice dashboard:", error);
        dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please check console for details.</p>';
    }
}


// [REPLACE this entire function in app.js]

// NEW HELPER 1: Builds the new mobile card UI, supporting multiple POs
function buildMobileReportView(reportData) {
    const container = document.getElementById('im-reporting-mobile-view');
    if (!container) return;

    // Get permissions
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const canViewAmounts = isAdmin || isAccounting;

    if (reportData.length === 0) {
        container.innerHTML = `
            <div class="im-mobile-empty-state">
                <i class="fa-solid fa-file-circle-question"></i>
                <h3>No Results Found</h3>
                <p>No POs matched your search criteria. Try a different search.</p>
            </div>
        `;
        return;
    }

    let mobileHTML = '';
    
    // --- THIS IS THE "OPTION A" (Vertical List) LAYOUT ---
    reportData.forEach((poData, poIndex) => {
        const { poNumber, site, vendor, poDetails, filteredInvoices } = poData;
        const toggleId = `mobile-invoice-list-${poIndex}`;
        
        let statusClass = 'status-pending'; // Default color
        let totalInvValue = 0; // For card logic

        if (filteredInvoices.length > 0 && canViewAmounts) {
            const poValueNum = parseFloat(poDetails.Amount) || 0;
            totalInvValue = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.invValue) || 0), 0);
            
            const epsilon = 0.01;
            const isFullyMatched = poValueNum > 0 && (Math.abs(totalInvValue - poValueNum) < epsilon);
            const hasPaidInvoices = filteredInvoices.some(inv => inv.status === 'Paid');

            if (isFullyMatched) {
                statusClass = 'status-complete'; // Yellow-ish
            } else if (hasPaidInvoices || totalInvValue > 0) {
                statusClass = 'status-progress'; // Blue-ish
            }
            // If totalInvValue is 0 and no paid invoices, it stays 'status-pending'
        }
        
        const poValueDisplay = canViewAmounts ? `QAR ${formatCurrency(poDetails.Amount)}` : '---';
        
        // This is the main "PO Card"
        mobileHTML += `
            <div class="im-mobile-report-container">
                <div class="im-po-balance-card ${statusClass}" 
                     data-toggle-target="#${toggleId}" 
                     style="cursor: pointer;">
                    
                    <div class="po-card-header">
                        <div>
                            <span class="po-card-vendor">${vendor}</span>
                            <h3 class="po-card-ponum">PO: ${poNumber}</h3>
                        </div>
                        <i class="fa-solid fa-chevron-down po-card-chevron"></i>
                    </div>

                    <div class="po-card-body">
                        <span class="po-card-label">Total PO Value</span>
                        <span class="po-card-value">${poValueDisplay}</span>
                        <span class="po-card-site">Site: ${site}</span>
                    </div>
                </div>

                <div id="${toggleId}" class="hidden-invoice-list"> 
                    <div class="im-invoice-list-header">
                        <h2>Transactions (${filteredInvoices.length})</h2>
                    </div>
                    <ul class="im-invoice-list">
        `;

        if (filteredInvoices.length === 0) {
            mobileHTML += '<li class="im-invoice-item-empty">No invoices found for this PO.</li>';
        } else {
            // Sort invoices by Entry ID
            filteredInvoices.sort((a, b) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
            
            filteredInvoices.forEach(inv => {
                const invValueDisplay = canViewAmounts ? `QAR ${formatCurrency(inv.invValue)}` : '---';
                const releaseDateDisplay = inv.releaseDate ? formatYYYYMMDD(inv.releaseDate) : '';

                // --- *** PDF LINKS ADDED HERE *** ---
                let actionsHTML = '';
                if (isAdmin || isAccounting) {
                    const invPDFName = inv.invName || '';
                    const invPDFLink = (invPDFName.trim() && invPDFName.toLowerCase() !== 'nil')
                        ? `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="im-tx-action-btn invoice-pdf-btn">Invoice</a>`
                        : '';
                    const srvPDFName = inv.srvName || '';
                    const srvPDFLink = (srvPDFName.trim() && srvPDFName.toLowerCase() !== 'nil')
                        ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="im-tx-action-btn srv-pdf-btn">SRV</a>`
                        : '';
                    if (invPDFLink || srvPDFLink) {
                        actionsHTML = `<div class="im-tx-actions">${invPDFLink} ${srvPDFLink}</div>`;
                    }
                }
                // --- *** END OF PDF LINKS *** ---

                // Determine transaction icon and color
                let iconClass, amountClass;
                if ((inv.status || '').toLowerCase() === 'paid') {
                    iconClass = 'fa-solid fa-check';
                    amountClass = 'paid'; // Green
                } else if ((inv.status || '').toLowerCase() === 'with accounts') {
                    iconClass = 'fa-solid fa-file-invoice-dollar';
                    amountClass = 'pending'; // Red
                } else {
                    iconClass = 'fa-solid fa-hourglass-half';
                    amountClass = 'pending'; // Red
                }

                mobileHTML += `
                    <li class="im-invoice-item">
                        <div class="im-tx-icon ${amountClass}">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="im-tx-details">
                            <span class="im-tx-title">${inv.invEntryID || 'Invoice'}</span>
                            <span class="im-tx-subtitle">${inv.status || 'N/A'}</span>
                            <span class="im-tx-date">${releaseDateDisplay}</span>
                        </div>
                        <div class="im-tx-amount">
                            <span class="im-tx-value ${amountClass}">${invValueDisplay}</span>
                            ${actionsHTML}
                            </div>
                    </li>
                `;
            });
        }

        mobileHTML += `</ul></div></div>`;
    });
    
    container.innerHTML = mobileHTML;
}

// [REPLACE this entire function]

// NEW HELPER 2: This is your *existing* logic, moved into its own function
function buildDesktopReportView(reportData) {
    const container = document.getElementById('im-reporting-content');
    if (!container) return;

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    if (reportData.length === 0) {
        container.innerHTML = '<p>No results found for your search criteria.</p>';
        return;
    }

    let tableHTML = `<table><thead><tr><th></th><th>PO</th><th>Site</th><th>Vendor</th><th>Value</th><th>Total Paid Amount</th><th>Last Paid Date</th></tr></thead><tbody>`;

    reportData.sort((a, b) => a.poNumber.localeCompare(b.poNumber));
    reportData.forEach(poData => {
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

            const invValueDisplay = (isAdmin || isAccounting) ? formatCurrency(invValue) : '---';
            const amountPaidDisplay = (isAdmin || isAccounting) ? formatCurrency(amountPaid) : '---';

            let actionButtonsHTML = '';
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
        });

        const totalInvValueDisplay = (isAdmin || isAccounting) ? `<strong>QAR ${formatCurrency(totalInvValue)}</strong>` : '---';
        const totalAmountPaidDisplay = (isAdmin || isAccounting) ? `<strong>QAR ${formatCurrency(totalAmountPaid)}</strong>` : '---';
        const poValueDisplay = (isAdmin || isAccounting) ? (poData.poDetails.Amount ? `QAR ${formatCurrency(poData.poDetails.Amount)}` : 'N/A') : '---';
        
        const totalPaidDisplay = (isAdmin || isAccounting) ? (poData.paymentData.totalPaidAmount !== 'N/A' ? `QAR ${formatCurrency(poData.paymentData.totalPaidAmount)}` : 'N/A') : '---';
        const datePaidDisplay = (isAdmin || isAccounting) ? poData.paymentData.datePaid : '---';

        let highlightClass = '';
         if (isAdmin || isAccounting) {
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
    container.innerHTML = tableHTML;
}

// [REPLACE this entire function]

// THIS IS THE MODIFIED MAIN FUNCTION
async function populateInvoiceReporting(searchTerm = '') {
    sessionStorage.setItem('imReportingSearch', searchTerm);

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    currentReportData = []; // Clear previous report data
    
    // --- (NEW) Mobile/Desktop View Check ---
    const isMobile = window.innerWidth <= 768;
    const desktopContainer = document.getElementById('im-reporting-content');
    const mobileContainer = document.getElementById('im-reporting-mobile-view');
    
    if (isMobile) {
        if (mobileContainer) mobileContainer.innerHTML = `
            <div class="im-mobile-empty-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <h3>Searching...</h3>
                <p>Please wait a moment.</p>
            </div>
        `;
        if (desktopContainer) desktopContainer.innerHTML = ''; // Clear desktop view
    } else {
        if (desktopContainer) desktopContainer.innerHTML = '<p>Searching... Please wait.</p>';
        if (mobileContainer) mobileContainer.innerHTML = ''; // Clear mobile view
    }
    // --- (END NEW) ---

    // --- THIS IS THE FIX ---
    // Read values from the *desktop* form, which is now synced by the modal
    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const monthFilter = document.getElementById('im-reporting-date-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;
    // --- END OF FIX ---


    try {
        await ensureInvoiceDataFetched();

        const allPOs = allPOData;
        const allInvoicesByPO = allInvoiceData;
        if (!allPOs || !allInvoicesByPO) {
             throw new Error("Required data (PO or Invoices) not loaded.");
        }
        const searchText = searchTerm.toLowerCase();

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

            let invoices = allInvoicesByPO[poNumber] ? Object.entries(allInvoicesByPO[poNumber]).map(([key, value]) => ({ key, ...value })) : [];

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
                paymentData: { 
                    totalPaidAmount: (calculatedTotalPaid > 0) ? calculatedTotalPaid : 'N/A', 
                    datePaid: latestPaidDate || 'N/A'
                } 
            };
            processedPOData.push(poReportData);
        }

        currentReportData = processedPOData;
        
        const count = currentReportData.length;
        if (reportingCountDisplay) {
            // *** THIS IS THE MODIFICATION ***
            reportingCountDisplay.textContent = `(Found: ${count})`;
        }

        // --- (NEW) Call the correct render function ---
        if (isMobile) {
            buildMobileReportView(currentReportData);
        } else {
            buildDesktopReportView(currentReportData);
        }
        // --- (END NEW) ---

    } catch (error) {
        console.error("Error generating invoice report:", error);
        if (desktopContainer) desktopContainer.innerHTML = '<p>An error occurred while generating the report. Check console for details.</p>';
        if (mobileContainer) mobileContainer.innerHTML = '<p>An error occurred while generating the report. Check console for details.</p>';
    }
}

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
        row.setAttribute('data-po', poNumber); row.setAttribute('data-site', site); row.setAttribute
('data-vendor', vendor); row.setAttribute('data-next-invid', nextInvId);

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
        
        updateBatchCount(); // (NEW) Update Count

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
	    <option value="Original PO">Original PO</option>
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
    
    updateBatchCount(); // (NEW) Update Count
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

        // --- *** START OF SRV "NIL" FIX *** ---
        const srvNameLower = (invoiceData.srvName || '').toLowerCase();
        if (invoiceData.status === 'With Accounts' && srvNameLower !== 'nil' && srvNameLower.trim() === '') {
        // --- *** END OF SRV "NIL" FIX *** ---
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
                    // Store the key in the local cache update object for later
                    const newKey = newRef.key;
                    const cacheUpdate = localCacheUpdates.find(upd => upd.promise === promise);
                    if (cacheUpdate) cacheUpdate.newKey = newKey; 
                    
                    return updateInvoiceTaskLookup(poNumber, newKey, invoiceData, null); // oldAttention is null
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
                    // Use the newKey stored from the promise's .then() block
                    const newKey = update.newKey;
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
        
        // --- THIS IS THE FIX ---
        // This line clears the table after the success alert.
        document.getElementById('im-batch-table-body').innerHTML = ''; 
        updateBatchCount(); // (NEW) Update Count
        // -----------------------
        
        allSystemEntries = []; // This clears the *other* cache
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
                // --- THIS IS THE FIX (LOCATION 1) ---
                { value: '', label: 'Select a note to search...', disabled: true },
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
                // --- THIS IS THE FIX (LOCATION 2) ---
                { value: '', label: 'Select a note to search...', disabled: true },
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
        
        // --- (NEW) Update Count ---
        const count = allCurrentInvoices.length;
        if (summaryNoteCountDisplay) {
            summaryNoteCountDisplay.textContent = `(Total Items: ${count})`;
        }
        // --- (END NEW) ---
        
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
                
                // --- *** START OF SRV "NIL" FIX *** ---
                // Only update srvName if newGlobalSRV is not empty.
                // This will respect "nil" or any other value if the input is blank.
                if (newGlobalSRV) {
                    updates.srvName = newGlobalSRV;
                }
                // --- *** END OF SRV "NIL" FIX *** ---
                
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
    
    updatePaymentsCount(); // (NEW) Update Count
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
        updatePaymentsCount(); // (NEW) Update Count
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
                if (financeReportCountDisplay) financeReportCountDisplay.textContent = ''; // (NEW) Clear Count
            } else {
                imFinanceNoResults.style.display = 'none';
                imFinanceAllPaymentsData = {};
                snapshot.forEach(childSnapshot => {
                    imFinanceAllPaymentsData[childSnapshot.key] = { id: childSnapshot.key, ...childSnapshot.val() };
                });
                const payments = Object.values(imFinanceAllPaymentsData);
                // --- (NEW) Update Count ---
                if (financeReportCountDisplay) {
                    financeReportCountDisplay.textContent = `(Total Payments Found: ${payments.length})`;
                }
                // --- (END NEW) ---
                showFinanceSearchResults(payments);
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

    // --- *** START CHANGE 3.4 (Finance Report Totals) *** ---
    let totalCertified = 0;
    let totalRetention = 0;
    let totalPayment = 0;
    // --- *** END CHANGE 3.4 *** ---

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

    // --- *** START CHANGE 3.4 (Finance Report Totals) *** ---
    // Calculate totals from the 'payments' array
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
    // --- *** END CHANGE 3.4 *** ---

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
    if (financeReportCountDisplay) financeReportCountDisplay.textContent = ''; // (NEW) Clear Count
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
    
    // --- THIS IS THE FIX ---
    // The variable was misspelled as "workGdeskDateTimeInterval"
    if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
    if (imDateTimeInterval) clearInterval(imDateTimeInterval); // <-- This one
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
    // --- ADD THIS LINE ---
    if(document.getElementById('app-version-display')) {
        document.getElementById('app-version-display').textContent = `Version ${APP_VERSION}`;
    }
    // --- END OF ADDITION ---

    // --- *** ADD THIS NEW BLOCK *** ---
    const sidebarVersionDisplays = document.querySelectorAll('.sidebar-version-display');
    sidebarVersionDisplays.forEach(el => {
        el.textContent = `Version ${APP_VERSION}`;
    });
    // --- *** END OF NEW BLOCK *** ---

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
    // (Original was not async)
    workdeskButton.addEventListener('click', async () => { // ADD async
        if (!currentApprover) { handleLogout(); return; }
        wdUsername.textContent = currentApprover.Name || 'User';
        wdUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;
// --- === ADD THIS LINE === ---

        document.body.classList.toggle('is-admin', (currentApprover?.Role || '').toLowerCase() === 'admin');
        // --- === END OF ADDITION === ---
        // ++ MODIFIED: Show IM link for everyone ++
        workdeskIMLinkContainer.classList.remove('hidden');
        wdCurrentCalendarDate = new Date();

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
        await showWorkdeskSection('wd-dashboard'); // ADD await
    });
    // ++ ADDED: Event listener for new sidebar link ++
    workdeskIMLink.addEventListener('click', (e) => {
        e.preventDefault();
        invoiceManagementButton.click();
    });

  // --- *** WORKDESK NAV FIX (START) *** ---
    document.querySelector('#workdesk-view .workdesk-sidebar').addEventListener('click', async (e) => { // ADD async
        const link = e.target.closest('a'); 
        if (!link || link.classList.contains('back-to-main-dashboard') || link.id === 'wd-logout-button' || link.id === 'workdesk-im-link') return; 
        e.preventDefault(); 
        if (link.hasAttribute('data-section')) { 
            
            document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active')); 
            link.classList.add('active'); 
            
            // --- *** TYPO FIX: Changed showWorkdEskSection to showWorkdeskSection *** ---
            await showWorkdeskSection(link.getAttribute('data-section'), null); 
        } 
    });
    // --- *** WORKDESK NAV FIX (END) ---
    
    addJobButton.addEventListener('click', handleAddJobEntry);
    updateJobButton.addEventListener('click', handleUpdateJobEntry);
    clearJobButton.addEventListener('click', () => resetJobEntryForm(false));
    deleteJobButton.addEventListener('click', handleDeleteJobEntry); // <-- CHANGE 2.5
    
    jobEntryTableBody.addEventListener('click', (e) => { const row = e.target.closest('tr'); if (row) { const key = row.getAttribute('data-key'); 

// --- ADD THIS BLOCK ---
        // This is a click from the local pending table, not the records table.
        // We must clear the navigation context.
        if (jobEntryNavControls) jobEntryNavControls.classList.add('hidden');
        navigationContextList = [];
        navigationContextIndex = -1;
        // --- END OF ADD BLOCK ---

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
        // --- (NEW) Prevent clicks if it's on the mobile row ---
        if (e.target.closest('.mobile-only')) {
            return;
        }
        // --- (END NEW) ---
        
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
                    
                    // --- (REMOVED) `updateJobTaskLookup` call ---
                }
                
                alert('Task status updated to "SRV Done".');
                
                await populateActiveTasks(); // Re-fetch all tasks

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

        // --- *** NEW FIX: Handle clicking "PR", "IPC", etc. to edit them *** ---
        if (taskData.source === 'job_entry' && taskData.for !== 'Invoice') {
            // Find the "Job Entry" link in the sidebar and click it
            const jobEntryLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
            if (jobEntryLink) {
                jobEntryLink.click(); // This will switch the view
            }
            
            // We must call ensureAllEntriesFetched to make sure allSystemEntries is populated for editing
            await ensureAllEntriesFetched();
            
            // Populate the form in the (now visible) Job Entry section
            populateFormForEditing(taskData.key);
            return;
        }
        // --- *** END OF NEW FIX *** ---

        // Handle clicking the row to open PDF (for invoice source only)
        if (taskData && taskData.source === 'invoice' && taskData.invName && taskData.invName.trim() && taskData.invName.toLowerCase() !== 'nil') {
            window.open(PDF_BASE_PATH + encodeURIComponent(taskData.invName) + ".pdf", '_blank');
        }
    });

   
// --- *** MODIFIED CALENDAR LISTENERS *** ---
    if (wdCalendarPrevBtn) {
        wdCalendarPrevBtn.addEventListener('click', () => {
            if (isYearView) {
                // In Year View, move by one year
                wdCurrentCalendarDate.setFullYear(wdCurrentCalendarDate.getFullYear() - 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
                renderYearView(); // Re-render year view
            } else {
                // In Month View, move by one month
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
                // In Year View, move by one year
                wdCurrentCalendarDate.setFullYear(wdCurrentCalendarDate.getFullYear() + 1);
                wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
                renderYearView(); // Re-render year view
            } else {
                // In Month View, move by one month
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

    // --- *** THIS IS THE FIX: ADD THIS NEW 'CLICK' LISTENER *** ---
    if (wdCalendarGrid) {
        wdCalendarGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('.wd-calendar-day');
            // Check if it's a valid day cell
            if (dayCell && !dayCell.classList.contains('other-month')) {
                const date = dayCell.dataset.date;
                if (date) {
                    // This is the function that highlights the day and updates the list
                    displayCalendarTasksForDay(date);
                }
            }
        });
    }
    // --- *** END OF NEW BLOCK *** ---

    // --- *** NEW: 'Double-click' listener for Day View *** ---
    if (wdCalendarGrid) {
        wdCalendarGrid.addEventListener('dblclick', (e) => {
            // 1. Disable on mobile - --- *** THIS CHECK IS NOW REMOVED *** ---
            // const isMobile = window.innerWidth <= 768;
            // if (isMobile) return; 

            const dayCell = e.target.closest('.wd-calendar-day');
            if (dayCell && !dayCell.classList.contains('other-month')) {
                
                // 2. Check if the day has tasks
                const taskBadge = dayCell.querySelector('.task-count-badge');
                if (taskBadge) {
                    const date = dayCell.dataset.date;
                    if (date) {
                        // 3. Call the new Day View function
                        showDayView(date);
                    }
                }
            }
        });
    }
    // --- *** END OF NEW LISTENER *** ---
// --- *** NEW: 'Back' button for Day View *** ---
    const dayViewBackBtn = document.getElementById('wd-dayview-back-btn');
    if (dayViewBackBtn) {
        dayViewBackBtn.addEventListener('click', () => {
            // This just clicks the "Dashboard" link in the sidebar
            const dashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
            if (dashboardLink) {
                dashboardLink.click();
            }
        });
    }
    // --- *** END OF NEW LISTENER *** ---


// --- *** NEW: Day View Prev/Next Buttons *** ---
    const dayViewPrevBtn = document.getElementById('wd-dayview-prev-btn');
    const dayViewNextBtn = document.getElementById('wd-dayview-next-btn');

    const navigateDayView = (direction) => {
        if (!wdCurrentDayViewDate) return;

        // Add/subtract one day (in UTC)
        wdCurrentDayViewDate.setUTCDate(wdCurrentDayViewDate.getUTCDate() + direction);

        // Format back to "YYYY-MM-DD"
        const year = wdCurrentDayViewDate.getUTCFullYear();
        const month = String(wdCurrentDayViewDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(wdCurrentDayViewDate.getUTCDate()).padStart(2, '0');
        const newDateString = `${year}-${month}-${day}`;

        // Refresh the view
        showDayView(newDateString);
    };

    if (dayViewPrevBtn) {
        dayViewPrevBtn.addEventListener('click', () => navigateDayView(-1));
    }
    if (dayViewNextBtn) {
        dayViewNextBtn.addEventListener('click', () => navigateDayView(1));
    }
    // --- *** END OF NEW LISTENERS *** ---


// [ADD THIS NEW BLOCK inside the DOMContentLoaded listener]

    // --- *** NEW: Mobile Day View Listeners *** ---
    const mobileMenuBtn = document.getElementById('wd-dayview-mobile-menu-btn');
    const mobileNotifyBtn = document.getElementById('wd-dayview-mobile-notify-btn');
    const mobileLogoutBtn = document.getElementById('wd-dayview-mobile-logout-btn-new');
    const dateScroller = document.getElementById('wd-dayview-date-scroller-inner');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            // This just clicks the original "Back to Calendar" button
            const backBtn = document.getElementById('wd-dayview-back-btn');
            if (backBtn) backBtn.click();
        });
    }

    if (mobileNotifyBtn) {
    mobileNotifyBtn.addEventListener('click', () => {
        // --- THIS IS THE CHANGE ---
        const taskCount = userActiveTasks.length;
        if (taskCount > 0) {
            alert(`Reminder: You still have ${taskCount} active task(s).`);
        } else {
            alert("You have no active tasks.");
        }
        // --- END OF CHANGE ---
    });
}

    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', () => {
            handleLogout();
        });
    }

    if (dateScroller) {
        dateScroller.addEventListener('click', (e) => {
            const dayItem = e.target.closest('.day-scroller-item');
            if (dayItem && dayItem.dataset.date) {
                // Remove 'active' from old item
                const oldActive = dateScroller.querySelector('.day-scroller-item.active');
                if (oldActive) oldActive.classList.remove('active');
                
                // Add 'active' to new item
                dayItem.classList.add('active');
                
                // Load the new day's tasks
                showDayView(dayItem.dataset.date);
            }
        });
    }
    // --- *** END OF NEW MOBILE LISTENERS *** ---

// --- *** NEW: 'Enter' key listener for Active Task (Conditional) *** ---
    document.addEventListener('keydown', (e) => {
        // 1. Check if it was the 'Enter' key
        if (e.key !== 'Enter') return;

        // 2. Check that we are on the WorkDesk Dashboard
        const dashboardSection = document.getElementById('wd-dashboard');
        if (!dashboardSection || dashboardSection.classList.contains('hidden')) {
            return; // Not on the dashboard, do nothing
        }
        
        // 3. Check that we are on desktop
        const isMobile = window.innerWidth <= 768;
        if (isMobile) return;

        // 4. Find the currently selected day
        const selectedDay = document.querySelector('.wd-calendar-day.selected');
        if (!selectedDay) return; // No day is selected

        // 5. Check if the selected day has a task badge
        const taskBadge = selectedDay.querySelector('.task-count-badge');
        if (!taskBadge) {
            return; // No tasks on this day, do nothing
        }

        // --- *** THIS IS THE FIX *** ---
        // 6. Check if the badge is 'admin-view-only' (green)
        if (taskBadge.classList.contains('admin-view-only')) {
            return; // It's a green badge, so Enter does nothing
        }
        // --- *** END OF FIX *** ---

        // --- All conditions passed, now we navigate ---
        e.preventDefault(); // Stop 'Enter' from doing anything else

        const date = selectedDay.dataset.date; // "YYYY-MM-DD"
        if (!date) return;
        
        const friendlyDate = formatYYYYMMDD(date); // "DD-Mmm-YYYY"
        const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
        
        if (activeTaskLink) {
            // Click the "Active Task" nav link
            activeTaskLink.click();
            
            // Force the section to filter by our friendly date
            setTimeout(() => {
                // This will redirect, paste the date, and run the search.
                showWorkdeskSection('wd-activetask', friendlyDate);
            }, 50);
        }
    });
    // --- *** END OF NEW LISTENER ---

    // --- (NEW) Click listener for WorkDesk Dashboard Card ---
    if (activeTaskCardLink) {
        activeTaskCardLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Find the 'Active Task' link in the nav and click it
            const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
            if (activeTaskLink) {
                activeTaskLink.click();
            }
        });
    }
    // --- (END NEW) ---

    // ++ NEW: Modify Task Modal Listeners ++
    if (modifyTaskStatus) {
        modifyTaskStatus.addEventListener('change', (e) => {
            modifyTaskStatusOtherContainer.classList.toggle('hidden', e.target.value !== 'Other');
        });
    }
    if (modifyTaskSaveBtn) {
        modifyTaskSaveBtn.addEventListener('click', handleSaveModifiedTask);
    }


  // [REPLACE this entire block around line 3574]

    jobForSelect.addEventListener('change', (e) => { 
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs'; 
        const jobType = e.target.value;
        const isInvoice = (jobType === 'Invoice');
        const isIPCforQS = (jobType === 'IPC' && isQS);

        if (isInvoice) {
            // Logic for "Invoice" - disable dropdown
            attentionSelectChoices.clearStore(); 
            attentionSelectChoices.setChoices([{ value: '', label: 'Auto-assigned to Accounting', disabled: true, selected: true }], 'value', 'label', false); 
            attentionSelectChoices.disable(); 

        } else if (isIPCforQS) { 
            // Logic for "IPC" for a QS user - disable dropdown
            attentionSelectChoices.clearStore(); 
            attentionSelectChoices.setChoices([{ value: 'All', label: 'All', selected: true }], 'value', 'label', false); 
            attentionSelectChoices.disable(); 

        } else {
            // --- *** THIS IS THE NEW FIX *** ---
            // This is for ALL OTHER job types (PR, Trip, Other, IPC for non-QS, or "")
            // We must *always* re-enable and repopulate the list,
            // in case it was previously locked by the "Invoice" selection.
            attentionSelectChoices.enable(); 
            populateAttentionDropdown(attentionSelectChoices);
            // --- *** END OF FIX *** ---
        } 
    });


    activeTaskSearchInput.addEventListener('input', debounce((e) => handleActiveTaskSearch(e.target.value), 500));
// === ADD THIS NEW LISTENER START ===
if (activeTaskFilters) {
    activeTaskFilters.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            // Update the active button style
            activeTaskFilters.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            
            // Set the global filter
            currentActiveTaskFilter = e.target.dataset.statusFilter;
            
            // Re-run the search/filter logic
            handleActiveTaskSearch(activeTaskSearchInput.value);
        }
    });
}

    jobEntrySearchInput.addEventListener('input', debounce((e) => handleJobEntrySearch(e.target.value), 500));
    // --- (REMOVED) Task History listener ---
    // --- (END REMOVAL) ---
    reportingSearchInput.addEventListener('input', debounce(() => {
        ensureAllEntriesFetched().then(() => { // ensure job_entries are loaded
             filterAndRenderReport(allSystemEntries);
        });
    }, 500));
    
// --- ADD THIS NEW BLOCK START ---
    reportingTableBody.addEventListener('click', async (e) => {
        const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
        // Only admins can use this feature
        if (!isAdmin) return;

        const row = e.target.closest('tr');
        if (!row) return;

        const key = row.dataset.key;
        if (!key) return;

        // Find the task from the cache
        await ensureAllEntriesFetched();
        const entryData = allSystemEntries.find(entry => entry.key === key);
        
        // We can only edit job_entry tasks, not invoice tasks
        if (!entryData || entryData.source === 'invoice') {
            alert("This task cannot be edited from here. (It may be an invoice task).");
            return;
        }

        if (confirm("Do you want to move this job back to the Job Entry form for editing?")) {
            
// --- ADD THIS NEW BLOCK START ---
            // 1. Get all visible row keys from the CURRENT table
            navigationContextList = [];
            const allVisibleRows = reportingTableBody.querySelectorAll('tr');
            allVisibleRows.forEach(visibleRow => {
                const rowKey = visibleRow.dataset.key;
                if (rowKey) {
                    navigationContextList.push(rowKey);
                }
            });

            // 2. Find the index of the clicked row
            navigationContextIndex = navigationContextList.indexOf(key);
            // --- ADD THIS NEW BLOCK END ---

// 1. Switch to the Job Entry tab
            const jobEntryLink = workdeskNav.querySelector('a[data-section="wd-jobentry"]');
            if (jobEntryLink) {
                // This will switch the view and update the active tab
                jobEntryLink.click();
            }
            
            // 2. Populate the form
            // We wait a moment for the section to become visible
            setTimeout(() => {
                populateFormForEditing(key);
            }, 100);
        }
    });
    // --- ADD THIS NEW BLOCK END ---


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

        // ++ NEW: Hide Dashboard if not Admin
        if (section === 'im-dashboard') {
            if (!isAdmin) li.style.display = 'none';
        }
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
    // *** The faulty line that tried to find 'im-nav-activetask' has been removed from here ***

    // --- *** MOBILE VIEW FIX (START) *** ---
    // Hide/Show IM reporting buttons based on role AND screen size
    const isMobile = window.innerWidth <= 768;
    const showReportBtns = isAccountingPosition && !isMobile;
    
    imReportingDownloadCSVButton.style.display = showReportBtns ? 'inline-block' : 'none';
    imDownloadDailyReportButton.style.display = showReportBtns ? 'inline-block' : 'none';
    imDownloadWithAccountsReportButton.style.display = showReportBtns ? 'inline-block' : 'none';
    imDailyReportDateInput.style.display = showReportBtns ? 'inline-block' : 'none';
    // --- *** MOBILE VIEW FIX (END) *** ---

    imReportingPrintBtn.disabled = !isAccountingAdmin;


    updateIMDateTime();
    if (imDateTimeInterval) clearInterval(imDateTimeInterval); // <-- This one
    imDateTimeInterval = setInterval(updateIMDateTime, 1000);
    showView('invoice-management');
    
    // ++ NEW: Logic to select default IM section
    let defaultSection = 'im-reporting'; // Default for non-admins
    let defaultLink = imNav.querySelector('a[data-section="im-reporting"]');

    if (isAdmin) {
        defaultSection = 'im-dashboard'; // Default for Admins
        defaultLink = imNav.querySelector('a[data-section="im-dashboard"]');
    }
    
    // --- *** MOBILE VIEW FIX (START) *** ---
    // On mobile, always default to reporting
    if (isMobile) {
    // --- *** MOBILE VIEW FIX (END) *** ---
        defaultSection = 'im-reporting';
        defaultLink = imNav.querySelector('a[data-section="im-reporting"]');
    }
    
    imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    if (defaultLink) {
        defaultLink.classList.add('active');
    } else {
         // Fallback if default link is hidden (e.g. admin on mobile)
         const firstVisibleLink = imNav.querySelector('li:not([style*="display: none"]) a');
         if(firstVisibleLink) {
             firstVisibleLink.classList.add('active');
             defaultSection = firstVisibleLink.dataset.section || 'im-reporting';
         }
    }
    showIMSection(defaultSection);
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

// --- (NEW) Listener for WorkDesk mobile "Reporting" link ---
    const wdImReportingLinkMobile = document.getElementById('wd-im-reporting-link-mobile');
    if (wdImReportingLinkMobile) {
        wdImReportingLinkMobile.addEventListener('click', (e) => {
            e.preventDefault();
            // Programmatically click the main IM button
            invoiceManagementButton.click();
            // Wait for IM view to load, then click its reporting tab
            setTimeout(() => {
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) {
                    imReportingLink.click();
                }
            }, 100);
        });
    }
    // --- (END NEW) ---

// --- *** NEW: Listener for IM mobile "Dashboard" link *** ---
    const imBackToWDDashboardLink = document.getElementById('im-back-to-wd-dashboard-link');
    if (imBackToWDDashboardLink) {
        imBackToWDDashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Programmatically click the main WorkDesk button
            workdeskButton.click();
            // Wait for WorkDesk view to load, then click its dashboard tab
            setTimeout(() => {
                const wdDashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
                if (wdDashboardLink) {
                    wdDashboardLink.click();
                }
            }, 100);
        });
    }
    // --- *** END OF NEW LISTENER *** ---

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
    imClearFormButton.addEventListener('click', () => { 
        currentPO ? resetInvoiceForm() : resetInvoiceEntryPage(); 
        
        // --- *** NEW FIX: Refresh the entire section *** ---
        showIMSection('im-invoice-entry');
        // --- *** END OF NEW FIX *** ---
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
            
            // --- *** THIS IS THE FIX *** ---
            // 1. Get the user's position
            const userPositionLower = (currentApprover?.Position || '').toLowerCase();
            
            // 2. Check if they are 'accounting'
            if (userPositionLower !== 'accounting') {
                // If not accounting, do nothing. The row is not clickable for them.
                return; 
            }
            // --- *** END OF FIX *** ---

            const poNumber = invoiceRow.dataset.poNumber;
            const invoiceKey = invoiceRow.dataset.invoiceKey;
            
            if (!poNumber || !invoiceKey) {
                alert("Error: Could not find invoice details for this row.");
                return;
            }

            // 3. If they are Accounting, proceed with the edit prompt
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
    imReportingClearButton.addEventListener('click', () => { imReportingForm.reset(); sessionStorage.removeItem('imReportingSearch'); imReportingContent.innerHTML = '<p>Please enter a search term and click Search.</p>'; currentReportData = []; if (reportingCountDisplay) reportingCountDisplay.textContent = ''; });
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

    // --- *** MODAL NOTIFICATION FIX (Button Listener) *** ---
    const calendarModalViewTasksBtn = document.getElementById('calendar-modal-view-tasks-btn');
    if (calendarModalViewTasksBtn) {
        calendarModalViewTasksBtn.addEventListener('click', () => { // No async needed here
            const friendlyDate = calendarModalViewTasksBtn.dataset.friendlyDate;
            
            // 1. Find the "Active Task" link
            const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
            if (activeTaskLink) {
                
                // 2. Manually update the nav UI
                document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active')); 
                activeTaskLink.classList.add('active'); 
                
                // 3. Call showWorkdeskSection directly with the new search term
                // This will await the data load AND THEN apply the filter.
                showWorkdeskSection('wd-activetask', friendlyDate); 
            }
            
            // 4. Hide the modal
            document.getElementById('calendar-task-modal').classList.add('hidden');
        });
    }
    // --- *** END OF FIX *** ---

    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close-btn')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    });


    // Batch Entry Listeners
const batchAddBtn = document.getElementById('im-batch-add-po-button'), batchSaveBtn = document.getElementById('im-batch-save-button'), batchPOInput = document.getElementById('im-batch-po-input'), batchSearchStatusBtn = document.getElementById('im-batch-search-by-status-button'), batchSearchNoteBtn = document.getElementById('im-batch-search-by-note-button');
    
    if(batchClearBtn) batchClearBtn.addEventListener('click', () => {
        batchTableBody.innerHTML = '';
        batchPOInput.value = '';
        sessionStorage.removeItem('imBatchSearch');
        sessionStorage.removeItem('imBatchNoteSearch'); 
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.clearInput();
        if (imBatchGlobalAttentionChoices) imBatchGlobalAttentionChoices.clearInput();
        imBatchGlobalStatus.value = '';
        imBatchGlobalNote.value = '';
        updateBatchCount(); // (NEW) Update Count
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
                updateBatchCount(); // (NEW) Update Count
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
    if (refreshEntryBtn) refreshEntryBtn.addEventListener('click', async () => { alert("Refreshing all data from sources..."); await ensureInvoiceDataFetched(true); await populateActiveTasks(); alert("Data refreshed."); if (currentPO) handlePOSearch(currentPO); }); // Pass currentPO
    const refreshBatchBtn = document.getElementById('im-refresh-batch-button');
    if (refreshBatchBtn) refreshBatchBtn.addEventListener('click', async () => { alert("Refreshing all data... Your current batch list will be cleared."); await ensureInvoiceDataFetched(true); document.getElementById('im-batch-table-body').innerHTML = ''; updateBatchCount(); alert("Data refreshed. Please add POs again."); });
    const refreshSummaryBtn = document.getElementById('im-refresh-summary-button');
    if (refreshSummaryBtn) refreshSummaryBtn.addEventListener('click', async () => { alert("Refreshing all data..."); await ensureInvoiceDataFetched(true); initializeNoteSuggestions(); alert("Data refreshed."); });
    const refreshReportingBtn = document.getElementById('im-refresh-reporting-button');
    if (refreshReportingBtn) {
        refreshReportingBtn.addEventListener('click', async () => {
            alert("Refreshing all data...");
            await ensureInvoiceDataFetched(true);
            alert("Data refreshed. Please run your search again.");
            const searchTerm = imReportingSearchInput.value.trim();
            if (searchTerm || document.getElementById('im-reporting-site-filter').value || document.getElementById('im-reporting-date-filter').value) {
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
            if (summaryNoteCountDisplay) summaryNoteCountDisplay.textContent = ''; // (NEW) Clear Count
            sessionStorage.removeItem('imSummaryPrevNote');
            sessionStorage.removeItem('imSummaryCurrNote');
        });
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
    if (imSavePaymentsButton) {
        imSavePaymentsButton.addEventListener('click', handleSavePayments);
    }
    if (imPaymentsTableBody) {
        imPaymentsTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('payment-remove-btn')) {
                const row = e.target.closest('tr');
                const key = row.dataset.key;
                if (key && invoicesToPay[key]) {
                    delete invoicesToPay[key]; // Remove from state
                }
                row.remove(); // Remove from DOM
                updatePaymentsCount(); // (NEW) Update Count
            }
        });
    }
    if (imPaymentModalSearchBtn) {
        imPaymentModalSearchBtn.addEventListener('click', handlePaymentModalPOSearch);
    }
    if (imPaymentModalPOInput) {
        imPaymentModalPOInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handlePaymentModalPOSearch(); }
        });
    }
    if (imPaymentModalAddSelectedBtn) {
        imPaymentModalAddSelectedBtn.addEventListener('click', handleAddSelectedToPayments);
    }

    // ++ NEW: Finance Report Listeners ++
    if (imFinanceSearchBtn) imFinanceSearchBtn.addEventListener('click', handleFinanceSearch);
    if (imFinanceClearBtn) imFinanceClearBtn.addEventListener('click', resetFinanceSearch);
    if (imFinanceSearchPoInput) {
        imFinanceSearchPoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleFinanceSearch(); }
        });
    }
    if (imFinanceResults) {
        imFinanceResults.addEventListener('click', handleFinanceActionClick);
    }
    if (imFinancePrintReportBtn) {
        imFinancePrintReportBtn.addEventListener('click', printFinanceReport);
    }

// --- ADD THIS NEW BLOCK START ---
    if (navPrevJobButton) {
        navPrevJobButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (navigationContextIndex > 0) {
                navigationContextIndex--; // Move to previous index
                const prevKey = navigationContextList[navigationContextIndex];
                await ensureAllEntriesFetched(); // Make sure data is cached
                populateFormForEditing(prevKey);
                updateJobEntryNavControls();
            }
        });
    }

    if (navNextJobButton) {
        navNextJobButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (navigationContextIndex < navigationContextList.length - 1) {
                navigationContextIndex++; // Move to next index
                const nextKey = navigationContextList[navigationContextIndex];
                await ensureAllEntriesFetched(); // Make sure data is cached
                populateFormForEditing(nextKey);
                updateJobEntryNavControls();
            }
        });
    }
// ... (right before the final closing '});')

    // --- *** NEW: Active Task Clear Button *** ---
    const activeTaskClearButton = document.getElementById('active-task-clear-button');
    if (activeTaskClearButton) {
        activeTaskClearButton.addEventListener('click', () => {
            activeTaskSearchInput.value = '';
            sessionStorage.removeItem('activeTaskSearch');
            // Re-run the search with an empty term.
            // This will use the full userActiveTasks list and apply the 'currentActiveTaskFilter'.
            handleActiveTaskSearch(''); 
        });
    }
    // --- *** END OF NEW LISTENER *** ---

// --- *** ADDED LISTENERS FOR YEAR VIEW *** ---
    if (wdCalendarToggleBtn) {
        wdCalendarToggleBtn.addEventListener('click', toggleCalendarView);
    }

    if (wdCalendarYearGrid) {
        wdCalendarYearGrid.addEventListener('dblclick', (e) => {
            const monthCell = e.target.closest('.wd-calendar-month-cell');
            if (!monthCell) return;

            const monthIndex = parseInt(monthCell.dataset.month, 10);
            if (isNaN(monthIndex)) return;

            // Set the global date to this month
            wdCurrentCalendarDate.setMonth(monthIndex);
            
            // Toggle back to the month view
            toggleCalendarView();

            // Display tasks for the first day of that month
            const firstDay = new Date(wdCurrentCalendarDate.getFullYear(), monthIndex, 1);
            // --- CALENDAR TIMEZONE FIX ---
            const dateYear = firstDay.getFullYear();
            const dateMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
            const dateDay = String(firstDay.getDate()).padStart(2, '0');
            const firstDayStr = `${dateYear}-${dateMonth}-${dateDay}`;
            // --- END OF FIX ---
            displayCalendarTasksForDay(firstDayStr);
        });
    }

// --- *** NEW: Double-click listener for calendar task list *** ---
    if (wdCalendarTaskListUl) {
        wdCalendarTaskListUl.addEventListener('dblclick', (e) => {
            const taskItem = e.target.closest('li.clickable-task');
            
            // Check if the item is clickable and has a PO number
            if (!taskItem || !taskItem.dataset.po) {
                return;
            }

            const poNumber = taskItem.dataset.po;
            
            // 1. Click the main Invoice Management button
            invoiceManagementButton.click();

            // 2. Wait for the IM view to load, then switch to reporting
            setTimeout(() => {
                // 3. Set the search input's value
                imReportingSearchInput.value = poNumber;
                
                // 4. Save the search term to session storage
                sessionStorage.setItem('imReportingSearch', poNumber);
                
                // 5. Click the "Reporting" tab
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) {
                    imReportingLink.click();
                    // The showIMSection function will automatically use the saved
                    // search term to run the report.
                }
            }, 150); // 150ms delay to ensure view is loaded
        });
    }
    // --- *** END OF NEW LISTENER *** ---

/// [REPLACE the old click listener for .im-po-balance-card]

// NEW LISTENER FOR MOBILE REPORT TOGGLE (with Accordion Logic)
document.addEventListener('click', (e) => {
    const card = e.target.closest('.im-po-balance-card');
    if (card && card.dataset.toggleTarget) {
        const targetId = card.dataset.toggleTarget; // e.g., "#mobile-invoice-list-1"
        const targetElement = document.querySelector(targetId); // The div to toggle
        const icon = card.querySelector('.po-card-chevron');
        
        if (targetElement) {
            // --- NEW ACCORDION LOGIC ---
            // Check if we are about to open this card
            const isOpening = targetElement.classList.contains('hidden-invoice-list');
            
            // 1. If we are opening this card, close all others first.
            if (isOpening) {
                // *** THIS IS THE FIX ***
                // Select all DIVs that are open (don't have the hidden class)
                const allOpenLists = document.querySelectorAll('[id^="mobile-invoice-list-"]:not(.hidden-invoice-list)');
                
                allOpenLists.forEach(listDiv => {
                    // We don't need to check for equality, as this list (targetElement)
                    // is NOT in allOpenLists (it has the hidden class).
                    // So we can just close all of them.
                    
                    listDiv.classList.add('hidden-invoice-list');
                    
                    // Also reset its corresponding icon
                    const otherCard = document.querySelector(`[data-toggle-target="#${listDiv.id}"]`);
                    const otherIcon = otherCard ? otherCard.querySelector('.po-card-chevron') : null;
                    if (otherIcon) {
                        otherIcon.style.transform = 'rotate(0deg)';
                    }
                });
                // *** END OF FIX ***
            }

            // 2. Toggle the clicked card
            targetElement.classList.toggle('hidden-invoice-list');
            
            // 3. Toggle the icon
            if (icon) {
                icon.style.transform = targetElement.classList.contains('hidden-invoice-list') ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }
    }
});
// [REPLACE this entire block, from line 4284 to 4340]

// --- *** NEW: IM MOBILE REPORTING MODAL LISTENERS (with Logout Fix) *** ---
const imMobileSearchBtn = document.getElementById('im-mobile-search-btn');
const imMobileSearchModal = document.getElementById('im-mobile-search-modal');
const imMobileSearchRunBtn = document.getElementById('im-mobile-search-run-btn');
const imMobileSearchClearBtn = document.getElementById('im-mobile-search-clear-btn');
const imMobileSearchCloseBtn = document.querySelector('[data-modal-id="im-mobile-search-modal"]');

// Search Form Inputs (Desktop)
const desktopSearchInput = document.getElementById('im-reporting-search');
const desktopSiteFilter = document.getElementById('im-reporting-site-filter');
const desktopStatusFilter = document.getElementById('im-reporting-status-filter');
const desktopDateFilter = document.getElementById('im-reporting-date-filter');

// Search Form Inputs (Mobile Modal)
const mobileSearchInput = document.getElementById('im-mobile-search-term');
const mobileSiteFilter = document.getElementById('im-mobile-site-filter');
const mobileStatusFilter = document.getElementById('im-mobile-status-filter');
const mobileDateFilter = document.getElementById('im-mobile-date-filter');

// 1. Open the search modal
if (imMobileSearchBtn) {
    imMobileSearchBtn.addEventListener('click', () => {
        // *** FAULTY LOGOUT FIX REMOVED ***

        // Sync mobile form WITH desktop form
        mobileSearchInput.value = desktopSearchInput.value;
        mobileSiteFilter.value = desktopSiteFilter.value;
        mobileStatusFilter.value = desktopStatusFilter.value;
        mobileDateFilter.value = desktopDateFilter.value;
        
        // --- THIS IS THE FIX ---
        // Copy the site options from desktop to mobile
        if (desktopSiteFilter.options.length > 1 && mobileSiteFilter.options.length <= 1) {
            mobileSiteFilter.innerHTML = desktopSiteFilter.innerHTML;
        }
        // --- END OF FIX ---

        if (imMobileSearchModal) {
            imMobileSearchModal.classList.remove('hidden');
        }
    });
}

// 2. Close the search modal
if (imMobileSearchCloseBtn) {
    imMobileSearchCloseBtn.addEventListener('click', () => {
        if (imMobileSearchModal) {
            imMobileSearchModal.classList.add('hidden');
        }
    });
}

// 3. Clear the search modal form
if (imMobileSearchClearBtn) {
    imMobileSearchClearBtn.addEventListener('click', () => {
        // Clear mobile form
        mobileSearchInput.value = '';
        mobileSiteFilter.value = '';
        mobileStatusFilter.value = '';
        mobileDateFilter.value = '';
        
        // ALSO clear desktop form
        desktopSearchInput.value = '';
        desktopSiteFilter.value = '';
        desktopStatusFilter.value = '';
        desktopDateFilter.value = '';
        
        // Clear session storage
        sessionStorage.removeItem('imReportingSearch');
        
        // --- THIS IS THE FIX ---
        // Manually clear the report data and UI
        currentReportData = [];
        const desktopContainer = document.getElementById('im-reporting-content');
        const mobileContainer = document.getElementById('im-reporting-mobile-view');
        const emptyStateHTML = `
            <div class="im-mobile-empty-state">
                <i class="fa-solid fa-file-circle-question"></i>
                <h3>No Results Found</h3>
                <p>Use the search button to find a PO or Vendor.</p>
            </div>
        `;
        
        if (desktopContainer) desktopContainer.innerHTML = '<p>Please enter a search term and click Search.</p>';
        if (mobileContainer) mobileContainer.innerHTML = emptyStateHTML;
        if (reportingCountDisplay) reportingCountDisplay.textContent = '(Found: 0)'; // Modified text
        // --- END OF FIX ---
    });
}

// 4. Run the search from the modal
if (imMobileSearchRunBtn) {
    imMobileSearchRunBtn.addEventListener('click', () => {
        // *** FAULTY LOGOUT FIX REMOVED ***

        // Sync desktop form FROM mobile form
        desktopSearchInput.value = mobileSearchInput.value;
        desktopSiteFilter.value = mobileSiteFilter.value;
        desktopStatusFilter.value = mobileStatusFilter.value;
        desktopDateFilter.value = mobileDateFilter.value;
        
        // Save to session storage
        sessionStorage.setItem('imReportingSearch', desktopSearchInput.value);
        
        // Run the search
        populateInvoiceReporting(desktopSearchInput.value);
        
        // Hide the modal
        if (imMobileSearchModal) {
            imMobileSearchModal.classList.add('hidden');
        }
    });
}
// --- *** END OF NEW MOBILE LISTENERS *** ---
}); // END OF DOMCONTENTLOADED
