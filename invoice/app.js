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

// Payments DB
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
const taskHistoryTableBody = document.getElementById('task-history-table-body');
const reportingTableBody = document.getElementById('reporting-table-body');
const workdeskDatetimeElement = document.getElementById('workdesk-datetime');
const activeTaskSearchInput = document.getElementById('active-task-search');
const taskHistorySearchInput = document.getElementById('task-history-search');
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

// ++ NEW: Sidebar link to IM ++
const workdeskIMLinkContainer = document.getElementById('workdesk-im-link-container');
const workdeskIMLink = document.getElementById('workdesk-im-link');

// INVOICE MANAGEMENT REFERENCES
const invoiceManagementView = document.getElementById('invoice-management-view');
const imNav = document.getElementById('im-nav');
const imContentArea = document.getElementById('im-content-area');
const invoiceManagementButton = document.getElementById('invoice-mgmt-button');
const imUsername = document.getElementById('im-username');
const imUserIdentifier = document.getElementById('im-user-identifier');
const imLogoutButton = document.getElementById('im-logout-button');
const imDatetimeElement = document.getElementById('im-datetime');
const imPOSearchInput = document.getElementById('im-po-search-input');
const imPOSearchButton = document.getElementById('im-po-search-button');
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

let currentApprover = null; let dateTimeInterval = null; let workdeskDateTimeInterval = null;
let siteSelectChoices = null; let attentionSelectChoices = null;
let currentlyEditingKey = null; let allJobEntries = []; let userJobEntries = [];
let userActiveTasks = [];
let userTaskHistory = [];
let allSystemEntries = [];
let currentReportFilter = 'All';

// INVOICE MANAGEMENT STATE
let imDateTimeInterval = null;
let currentPO = null;
let imAttentionSelectChoices = null;
let currentlyEditingInvoiceKey = null;
let currentPOInvoices = {};
let currentReportData = [];
let imStatusBarChart = null;
let approverListForSelect = [];
let allUniqueNotes = new Set();

// OPTIMIZED CACHE VARIABLES WITH TIMESTAMPS
let allPOData = null;
let allInvoiceData = null;
let allApproverData = null;
let cacheTimestamps = {
  poData: 0,
  invoiceData: 0,
  approverData: 0,
  systemEntries: 0
};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

// ++ NEW EFFICIENT CACHES FOR DROPDOWNS ++
let allApproversCache = null;
let allSitesCache = null;

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
async function findApprover(identifier) { const isEmail = identifier.includes('@'); const searchKey = isEmail ? 'Email' : 'Mobile'; const searchValue = isEmail ? identifier : normalizeMobile(identifier); const snapshot = await db.ref('approvers').once('value'); const approversData = snapshot.val(); if (!approversData) return null; for (const key in approversData) { const record = approversData[key]; const dbValue = record[searchKey]; if (dbValue) { if (isEmail) { if (dbValue.toLowerCase() === searchValue.toLowerCase()) { return { key, ...record }; } } else { const normalizedDbMobile = dbValue.replace(/\D/g, ''); if (normalizedDbMobile === searchValue) { return { key, ...record }; } } } } return null; }
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
        const isAdmin = currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'admin';
        financeReportButton.classList.toggle('hidden', !isAdmin);
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
            // The populate function will render the table, so we need to filter after it's done.
            // A better way is to make render function separate and call it. For now, a small timeout works.
            setTimeout(() => handleActiveTaskSearch(savedSearch), 200);
        }
    }
    if (sectionId === 'wd-taskhistory') {
        const savedSearch = sessionStorage.getItem('taskHistorySearch');
        if (savedSearch) {
            taskHistorySearchInput.value = savedSearch;
            handleTaskHistorySearch(savedSearch);
        } else {
            taskHistoryTableBody.innerHTML = '<tr><td colspan="9">Use the search bar to find history.</td></tr>';
            userTaskHistory = [];
        }
    }
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
    
    // YYYY-MM-DD (already correct)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    
    // DD/MM/YYYY (from CSV)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const parts = dateString.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }

    // DD-MM-YY (old format)
    if (/^\d{2}-\d{2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-');
        const day = parts[0];
        const month = parts[1];
        const year = `20${parts[2]}`;
        return `${year}-${month}-${day}`;
    }
    
    // Try parsing with Date object as a fallback
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
        "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
        "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
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
    const number = parseFloat(value);
    if (isNaN(number)) {
        return 'N/A';
    }
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function numberToWords(num) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const s = ['', 'Thousand', 'Million', 'Billion'];

    const number = parseFloat(num).toFixed(2);
    const [integerPart, fractionalPart] = number.split('.');

    function toWords(n) {
        if (n < 20) return a[n];
        let digit = n % 10;
        return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
    }

    function convert(nStr) {
        if (nStr === '0') return 'Zero';
        let words = '';
        let i = nStr.length;
        while (i > 0) {
            let chunk = nStr.substring(Math.max(0, i - 3), i);
            if (chunk !== '000') {
                let num = parseInt(chunk);
                words = (chunk.length === 3 && num < 100 ? 'and ' : '') + toWords(num % 100) + (num > 99 ? ' Hundred' + (num % 100 ? ' and ' : '') : '') + ' ' + s[(nStr.length - i) / 3] + ' ' + words;
            }
            i -= 3;
        }
        return words.trim().replace(/\s+/g, ' ');
    }

    let words = convert(integerPart);
    if (fractionalPart && parseInt(fractionalPart) > 0) {
        words += ' and ' + parseInt(fractionalPart) + '/100';
    }

    return words.charAt(0).toUpperCase() + words.slice(1) + " Qatari Riyals Only";
}

// FETCH AND PARSE CSV FOR PO DATA
async function fetchAndParseCSV(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' }); 
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        
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
                if (char === '"' && (i === 0 || cleanRowStr[i-1] !== '\\')) {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());
            return values.map(v => v.replace(/^"|"$/g, ''));
        };

        const headers = parseCsvRow(lines[0]).map(h => h.trim());
        let poHeaderIndex = headers.findIndex(h => h.toLowerCase() === 'po number' || h.toLowerCase() === 'po' || h.toLowerCase() === 'po_number');
        if (poHeaderIndex === -1) {
            console.warn("Could not find 'PO Number' header. Assuming first column is the PO number.");
            poHeaderIndex = 0; 
        }
        
        const poData = {};
        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvRow(lines[i]);
            if (values.length !== headers.length) {
                console.warn(`Skipping malformed CSV row: ${lines[i]}`);
                continue;
            }
            const poKey = values[poHeaderIndex].toUpperCase();
            if (!poKey) continue;
            
            const poEntry = {};
            headers.forEach((header, index) => {
                if (header.toLowerCase() === 'amount') {
                     poEntry[header] = values[index].replace(/,/g, '') || '0';
                } else {
                     poEntry[header] = values[index];
                }
            });
            poData[poKey] = poEntry;
        }
        
        console.log(`Successfully fetched and parsed ${Object.keys(poData).length} POs from GitHub.`);
        return poData;
        
    } catch (error) {
        console.error("Error fetching or parsing PO CSV:", error);
        alert("CRITICAL ERROR: Could not load Purchase Order data from GitHub.");
        return null;
    }
}

// This function is still used by reporting, so we keep it, but it's now more efficient.
async function ensureInvoiceDataFetched(forceRefresh = false) {
    const now = Date.now();
    const shouldUseCache = !forceRefresh && 
                          allPOData && 
                          allInvoiceData &&
                          (now - cacheTimestamps.poData < CACHE_DURATION);

    if (shouldUseCache) {
        return;
    }

    try {
        const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";

        const [csvData, invoiceSnapshot] = await Promise.all([
            fetchAndParseCSV(PO_DATA_URL),
            invoiceDb.ref('invoice_entries').once('value'),
        ]);
        
        if (csvData === null) {
            throw new Error("Failed to load PO data from CSV.");
        }
        
        allPOData = csvData;
        allInvoiceData = invoiceSnapshot.val() || {};
        
        cacheTimestamps.poData = now;
        cacheTimestamps.invoiceData = now;
        
        console.log("Invoice cache refreshed for reporting.");
        
        approverListForSelect = [];
        allUniqueNotes = new Set();

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
function addToLocalInvoiceCache(poNumber, newInvoiceData) {
    if (!allInvoiceData) allInvoiceData = {};
    if (!allInvoiceData[poNumber]) {
        allInvoiceData[poNumber] = {};
    }
    const newKey = `temp_${Date.now()}`;
    allInvoiceData[poNumber][newKey] = newInvoiceData;
}
function removeFromLocalInvoiceCache(poNumber, invoiceKey) {
    if (allInvoiceData && allInvoiceData[poNumber] && allInvoiceData[poNumber][invoiceKey]) {
        delete allInvoiceData[poNumber][invoiceKey];
    }
}

// --- WORKDESK LOGIC ---
// This function remains for reporting but is no longer used by high-traffic pages.
async function ensureAllEntriesFetched() {
    if (allSystemEntries.length > 0) {
        return;
    }
    await ensureInvoiceDataFetched(); 
    const [jobEntriesSnapshot] = await Promise.all([
        db.ref('job_entries').orderByChild('timestamp').once('value'),
    ]);

    const jobEntriesData = jobEntriesSnapshot.val() || {};
    const purchaseOrdersData = allPOData || {};
    const invoiceEntriesData = allInvoiceData || {};

    const processedJobEntries = Object.entries(jobEntriesData).map(([key, value]) => ({
        key,
        ...value,
        vendorName: (value.po && purchaseOrdersData[value.po]) ? purchaseOrdersData[value.po]['Supplier Name'] : 'N/A',
        source: 'job_entry'
    }));
    const processedInvoiceEntries = [];
    for (const poNumber in invoiceEntriesData) {
        const invoices = invoiceEntriesData[poNumber];
        const site = purchaseOrdersData[poNumber]?.['Project ID'] || 'N/A';
        const vendorName = purchaseOrdersData[poNumber]?.['Supplier Name'] || 'N/A';
        for (const invoiceKey in invoices) {
            const invoice = invoices[invoiceKey];
            const isTrackableStatus = invoice.status === 'For SRV' || invoice.status === 'For IPC';
            if (!isTrackableStatus && (!invoice.attention || invoice.attention.trim() === '')) {
                continue;
            }
            const normalizedDate = normalizeDateForInput(invoice.dateAdded || invoice.releaseDate);
            const transformedInvoice = {
                key: `${poNumber}_${invoice.invEntryID || invoiceKey}`,
                originalKey: invoiceKey,
                originalPO: poNumber,
                for: 'Invoice',
                ref: invoice.invNumber || '',
                po: poNumber,
                amount: invoice.invValue || '',
                site: site,
                group: 'N/A',
                attention: invoice.attention,
                enteredBy: 'Irwin',
                date: normalizedDate ? formatDate(new Date(normalizedDate + 'T00:00:00')) : 'N/A',
                dateResponded: 'N/A',
                remarks: invoice.status || 'Pending',
                timestamp: normalizedDate ? new Date(normalizedDate).getTime() : Date.now(),
                invName: invoice.invName || '',
                vendorName: vendorName,
                source: 'invoice'
            };
            processedInvoiceEntries.push(transformedInvoice);
        }
    }
    allSystemEntries = [...processedJobEntries, ...processedInvoiceEntries];
    allSystemEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function isTaskComplete(task) {
    if (!task) return false;
    if (task.source === 'invoice' && task.enteredBy === currentApprover.Name) {
        const trackingStatuses = ['For SRV', 'For IPC'];
        if(trackingStatuses.includes(task.remarks)) {
            return false;
        }
    }
    if (task.source === 'invoice') {
        const completedStatuses = ['CEO Approval', 'With Accounts', 'Under Review', 'SRV Done'];
        return completedStatuses.includes(task.remarks);
    }
    if (task.for === 'Invoice' && task.source === 'job_entry') { return !!task.dateResponded; }
    if (task.for === 'IPC' && task.attention === 'All') { return true; }
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
        
        const snapshot = await db.ref('approvers').once('value');
        const approvers = snapshot.val();
        allApproverData = approvers; // Cache the full data object

        if (approvers) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

            const approverOptions = Object.values(approvers).map(approver => {
                if (!approver.Name) return null;

                const isOnVacation = approver.Vacation === true || approver.Vacation === "Yes";
                let isVacationActive = false;
                if (isOnVacation && approver.DateReturn) {
                    const returnDate = new Date(approver.DateReturn + 'T00:00:00');
                    if (!isNaN(returnDate) && returnDate >= today) {
                        isVacationActive = true;
                    }
                }
                
                return {
                    value: approver.Name,
                    label: isVacationActive ? `${approver.Name} (On Vacation)` : approver.Name,
                    disabled: isVacationActive,
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
                ...approverOptions
            ];
            
            allApproversCache = choiceList; 
            choicesInstance.setChoices(allApproversCache, 'value', 'label', true);

        } else { 
            choicesInstance.setChoices([{ value: '', label: 'No approvers found', disabled: true }]); 
        }
    } catch (error) { 
        console.error("Error populating attention dropdown:", error); 
        if (choicesInstance) choicesInstance.setChoices([{ value: '', label: 'Error loading names', disabled: true }]); 
    }
}

// --- NEW, EFFICIENT populateSiteDropdown ---
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
            const siteOptions = Object.values(sites).map(site => site.Warehouse && site.Description ? { value: site.Warehouse, label: `${site.Warehouse} - ${site.Description}` } : null).filter(Boolean);
            
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
        await ensureAllEntriesFetched(); 
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
async function handleAddJobEntry(e) {
    e.preventDefault();
    const jobData = getJobDataFromForm();
    if (!jobData.for || !jobData.site || !jobData.group || !jobData.attention) { alert('Please fill in all required fields (Job, Site, Group, Attention).'); return; }

    if (jobData.for === 'IPC') {
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
        if (isQS) {
            jobData.remarks = 'Ready';
            if (!jobData.amount || !jobData.po) { alert('As a QS, IPC jobs require both an Amount and PO number.'); return; }
        } else {
            if (!jobData.po) { alert('For IPC jobs, a PO number is required.'); return; }
        }
        allSystemEntries = []; // Clear cache to refetch for duplicate check
        await ensureAllEntriesFetched();
        const duplicatePO = allSystemEntries.find(entry => entry.for === 'IPC' && entry.po && entry.po.trim() !== '' && entry.po === jobData.po);
        if (duplicatePO) {
            const message = `WARNING: An IPC for PO Number "${jobData.po}" already exists.\n\nPress OK if this is a new IPC for this PO.\nPress Cancel to check the Reporting section first.`;
            if (!confirm(message)) { return; }
        }
    }

    jobData.timestamp = Date.now();
    jobData.enteredBy = currentApprover.Name;
    try {
        await db.ref('job_entries').push(jobData);
        alert('Job Entry Added Successfully!');
        resetJobEntryForm();
        allSystemEntries = [];
    } catch (error) { console.error("Error adding job entry:", error); alert('Failed to add Job Entry. Please try again.'); }
}
async function handleUpdateJobEntry(e) {
    e.preventDefault();
    if (!currentlyEditingKey) { alert("No entry selected for update."); return; }
    const formData = new FormData(jobEntryForm);
    const jobData = { for: formData.get('for'), ref: formData.get('ref') || '', amount: formData.get('amount') || '', po: formData.get('po') || '', site: formData.get('site'), group: formData.get('group'), attention: attentionSelectChoices.getValue(true) };
    if (!jobData.for || !jobData.site || !jobData.group || !jobData.attention) { alert('Please fill in all required fields (Job, Site, Group, Attention).'); return; }
    try {
        const originalEntry = allSystemEntries.find(entry => entry.key === currentlyEditingKey);
        if (originalEntry) { jobData.enteredBy = originalEntry.enteredBy; jobData.timestamp = originalEntry.timestamp; jobData.date = originalEntry.date; }
        if (originalEntry.for === 'IPC' && jobData.attention === 'All') { jobData.remarks = 'Ready'; }
        if (originalEntry && currentApprover.Name === originalEntry.attention && !originalEntry.dateResponded) { jobData.dateResponded = formatDate(new Date()); }
        await db.ref(`job_entries/${currentlyEditingKey}`).update(jobData);
        alert('Job Entry Updated Successfully!');
        resetJobEntryForm();
        allSystemEntries = [];
        populateActiveTasks();
    } catch (error) { console.error("Error updating job entry:", error); alert('Failed to update Job Entry. Please try again.'); }
}
function populateFormForEditing(key) {
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
    attentionSelectChoices.setChoiceByValue(entryData.attention || '');
    jobEntryFormTitle.textContent = 'Editing Job Entry';
    addJobButton.classList.add('hidden');
    updateJobButton.classList.remove('hidden');
    amountInput.classList.remove('highlight-field');
    poInput.classList.remove('highlight-field');
    window.scrollTo(0, 0);
}

// --- (FIXED) EFFICIENT populateActiveTasks ---
async function populateActiveTasks() {
    activeTaskTableBody.innerHTML = `<tr><td colspan="10">Loading tasks...</td></tr>`;
    if (!currentApprover || !currentApprover.Name) { 
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Could not identify user.</td></tr>`; 
        return; 
    }
    
    try {
        if (!allPOData) {
            const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
            allPOData = await fetchAndParseCSV(PO_DATA_URL);
            if (!allPOData) throw new Error("Could not load PO data for WorkDesk");
        }
        
        const jobSnapshot = await db.ref('job_entries')
                                    .orderByChild('attention')
                                    .equalTo(currentApprover.Name)
                                    .once('value');
        
        const invoiceSnapshot = await invoiceDb.ref('invoice_entries').once('value');

        const jobEntriesData = jobSnapshot.val() || {};
        const allInvoiceEntries = invoiceSnapshot.val() || {};
        const purchaseOrdersData = allPOData;
        const currentUserName = currentApprover.Name;

        let userTasks = [];

        for (const key in jobEntriesData) {
            const task = { 
                key, 
                ...jobEntriesData[key],
                vendorName: (jobEntriesData[key].po && purchaseOrdersData[jobEntriesData[key].po]) ? purchaseOrdersData[jobEntriesData[key].po]['Supplier Name'] : 'N/A',
                source: 'job_entry' 
            };
            if (!isTaskComplete(task)) {
                userTasks.push(task);
            }
        }
        
        for (const poNumber in allInvoiceEntries) {
            const invoices = allInvoiceEntries[poNumber];
            const site = purchaseOrdersData[poNumber]?.['Project ID'] || 'N/A';
            const vendorName = purchaseOrdersData[poNumber]?.['Supplier Name'] || 'N/A';

            for (const invoiceKey in invoices) {
                const invoice = invoices[invoiceKey];
                
                if (invoice.attention !== currentUserName) {
                    continue; 
                }
                
                const isTrackableStatus = invoice.status === 'For SRV' || invoice.status === 'For IPC';
                if (!isTrackableStatus && (!invoice.attention || invoice.attention.trim() === '')) {
                    continue;
                }

                const normalizedDate = normalizeDateForInput(invoice.dateAdded || invoice.releaseDate);
                const transformedInvoice = {
                    key: `${poNumber}_${invoice.invEntryID || invoiceKey}`,
                    originalKey: invoiceKey,
                    originalPO: poNumber,
                    for: 'Invoice',
                    ref: invoice.invNumber || '',
                    po: poNumber,
                    amount: invoice.invValue || '',
                    site: site,
                    group: 'N/A',
                    attention: invoice.attention,
                    enteredBy: 'Irwin',
                    date: normalizedDate ? formatDate(new Date(normalizedDate + 'T00:00:00')) : 'N/A',
                    dateResponded: 'N/A',
                    remarks: invoice.status || 'Pending',
                    timestamp: normalizedDate ? new Date(normalizedDate).getTime() : Date.now(),
                    invName: invoice.invName || '',
                    vendorName: vendorName,
                    source: 'invoice'
                };
                
                if (!isTaskComplete(transformedInvoice)) {
                    userTasks.push(transformedInvoice);
                }
            }
        }

        userActiveTasks = userTasks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        allSystemEntries = userActiveTasks; 

        renderActiveTaskTable(userActiveTasks);
    
    } catch (error) { 
        console.error("Error fetching active tasks:", error); 
        activeTaskTableBody.innerHTML = `<tr><td colspan="10">Error loading tasks.</td></tr>`; 
    }
}


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

        const actionButton = isInvoiceFromIrwin
            ? `<button class="respond-btn" data-key="${task.key}">Respond</button>`
            : `<button class="respond-btn" data-key="${task.key}">Respond</button>`;

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
            <td>${actionButton}</td>
        `;
        activeTaskTableBody.appendChild(row);
    });
}
function renderTaskHistoryTable(tasks) {
    taskHistoryTableBody.innerHTML = '';
    if (!tasks || tasks.length === 0) { taskHistoryTableBody.innerHTML = '<tr><td colspan="9">No completed tasks found for your search.</td></tr>'; return; }
    tasks.forEach(task => {
        const row = document.createElement('tr');
        const remarks = task.remarks || 'Completed';
        row.innerHTML = `<td>${task.for || ''}</td><td>${task.ref || ''}</td><td>${task.amount || ''}</td><td>${task.po || ''}</td><td>${task.site || ''}</td><td>${task.group || ''}</td><td>${task.date || ''}</td><td>${task.dateResponded || 'N/A'}</td><td>${remarks}</td>`;
        taskHistoryTableBody.appendChild(row);
    });
}
async function handleTaskHistorySearch(searchTerm) {
    const searchText = searchTerm.toLowerCase();
    sessionStorage.setItem('taskHistorySearch', searchText); // Save search term

    if (!searchText) {
        renderTaskHistoryTable([]);
        return;
    }
    taskHistoryTableBody.innerHTML = '<tr><td colspan="9">Searching history...</td></tr>';
    try {
        allSystemEntries = []; // Clear cache
        await ensureAllEntriesFetched();
        const personalHistory = allSystemEntries.filter(task => {
            const isRelatedToMe = (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name);
            return isTaskComplete(task) && isRelatedToMe;
        });
        const filteredHistory = personalHistory.filter(task => {
            return (
                (task.for && task.for.toLowerCase().includes(searchText)) ||
                (task.ref && task.ref.toLowerCase().includes(searchText)) ||
                (task.amount && task.amount.toString().includes(searchText)) ||
                (task.po && task.po.toLowerCase().includes(searchText)) ||
                (task.site && task.site.toLowerCase().includes(searchText)) ||
                (task.group && task.group.toLowerCase().includes(searchText)) ||
                (task.date && task.date.toLowerCase().includes(searchText))
            );
        });
        renderTaskHistoryTable(filteredHistory);
    } catch (error) {
        console.error("Error fetching task history:", error);
        taskHistoryTableBody.innerHTML = '<tr><td colspan="9">Error loading task history.</td></tr>';
    }
}
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
    await populateActiveTasks(); 
    dbActiveTasksCount.textContent = userActiveTasks.length;
    allSystemEntries = [];
    await ensureAllEntriesFetched();
    const myCompletedTasks = allSystemEntries.filter(task => (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name) && isTaskComplete(task));
    dbCompletedTasksCount.textContent = myCompletedTasks.length;

}
async function handleRespondClick(e) {
    const key = e.target.getAttribute('data-key');
    if (!key) return;

    const taskData = allSystemEntries.find(entry => entry.key === key);
    if (!taskData) return;

    if (taskData.source === 'job_entry' && taskData.for === 'Invoice' && taskData.attention === 'Irwin') {
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

    if (taskData.source === 'invoice') {
        const updates = {
            releaseDate: getTodayDateString(),
            status: 'SRV Done'
        };
        try {
            await invoiceDb.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update(updates);
            alert('Task status updated to "SRV Done".');
            populateActiveTasks();
        } catch (error) {
            console.error("Error updating invoice status:", error);
            alert("Failed to update invoice status. Please try again.");
        }
        return;
    }

    if (taskData.source === 'job_entry' && taskData.enteredBy === 'Irwin' && taskData.for === 'Invoice') {
        const updates = {
            dateResponded: formatDate(new Date()),
            remarks: 'SRV Done'
        };
        try {
            await db.ref(`job_entries/${key}`).update(updates);
            alert('Task status updated to "SRV Done".');
            populateActiveTasks();
        } catch (error) {
            console.error("Error updating task status:", error);
            alert("Failed to update task status. Please try again.");
        }
        return;
    }

    const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
    workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    document.querySelector('a[data-section="wd-jobentry"]').classList.add('active');
    showWorkdeskSection('wd-jobentry');
    populateFormForEditing(key);
    if (taskData.for === 'IPC' && isQS) {
        attentionSelectChoices.clearStore();
        attentionSelectChoices.setChoices([{ value: 'All', label: 'All', selected: true }], 'value', 'label', false);
        attentionSelectChoices.disable();
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
        allSystemEntries = []; // Clear cache
        await ensureAllEntriesFetched();
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
    link.setAttribute("download", "workdesk_report.csv");
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
    settingsVacationCheckbox.checked = currentApprover.Vacation || false;
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
        Vacation: onVacation,
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
        currentApprover = { ...currentApprover, ...updates }; // Update local state
        allApproversCache = null; // Invalidate cache so it's refetched with new vacation info
        settingsMessage.textContent = 'Settings updated successfully!';
        settingsMessage.className = 'success-message';
        settingsPasswordInput.value = '';
        if (passwordChanged) {
            alert('Password changed successfully! You will now be logged out.');
            handleLogout();
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
    const invoiceEntryLink = imNav.querySelector('a[data-section="im-invoice-entry"]');
    const batchEntryLink = imNav.querySelector('a[data-section="im-batch-entry"]');
    const summaryNoteLink = imNav.querySelector('a[data-section="im-summary-note"]');

    if (sectionId === 'im-invoice-entry' && invoiceEntryLink.classList.contains('disabled')) { alert('You do not have permission to access this section.'); return; }
    if (sectionId === 'im-batch-entry' && batchEntryLink.classList.contains('disabled')) { alert('You do not have permission to access this section.'); return; }
    if (sectionId === 'im-summary-note' && summaryNoteLink && summaryNoteLink.classList.contains('disabled')) { alert('You do not have permission to access this section.'); return; }

    imContentArea.querySelectorAll('.workdesk-section').forEach(section => section.classList.add('hidden'));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.remove('hidden');
    
    if (sectionId === 'im-dashboard') { populateInvoiceDashboard(); }
    if (sectionId === 'im-invoice-entry') { resetInvoiceEntryPage(); if (imAttentionSelectChoices) { populateAttentionDropdown(imAttentionSelectChoices, true); } }
    if (sectionId === 'im-batch-entry') { document.getElementById('im-batch-table-body').innerHTML = ''; document.getElementById('im-batch-po-input').value = ''; }
    if (sectionId === 'im-summary-note') { summaryNotePrintArea.classList.add('hidden'); initializeNoteSuggestions(); }
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
}
function resetInvoiceForm() {
    const nextId = imInvEntryIdInput.value;
    imNewInvoiceForm.reset();
    imInvEntryIdInput.value = nextId;
    imReleaseDateInput.value = getTodayDateString();
    if (imAttentionSelectChoices) { imAttentionSelectChoices.clearInput(); imAttentionSelectChoices.removeActiveItems(); }
    currentlyEditingInvoiceKey = null;
    imFormTitle.textContent = 'Add New Invoice for this PO';
    imAddInvoiceButton.classList.remove('hidden');
    imUpdateInvoiceButton.classList.add('hidden');
}
function resetInvoiceEntryPage() {
    currentPO = null;
    currentPOInvoices = {};
    imPOSearchInput.value = '';
    imPODetailsContainer.classList.add('hidden');
    imNewInvoiceForm.classList.add('hidden');
    imExistingInvoicesContainer.classList.add('hidden');
    imInvoicesTableBody.innerHTML = '';
    imBackToActiveTaskButton.classList.add('hidden');
    resetInvoiceForm();
}

// --- NEW, EFFICIENT handlePOSearch ---
async function handlePOSearch() {
    const poNumber = imPOSearchInput.value.trim().toUpperCase();
    if (!poNumber) {
        alert('Please enter a PO Number.');
        return;
    }
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
            resetInvoiceEntryPage();
            return;
        }

        const invoicesSnapshot = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
        const invoicesData = invoicesSnapshot.val();

        if (!allInvoiceData) allInvoiceData = {};
        allInvoiceData[poNumber] = invoicesData || {};

        currentPO = poNumber;
        imPONo.textContent = poNumber;
        imPOSite.textContent = poData['Project ID'] || 'N/A';
        
        const isAdmin = currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'admin';
        imPOValue.textContent = !isAdmin ? '---' : (poData.Amount ? `QAR ${formatCurrency(poData.Amount)}` : 'N/A');
        imPOVendor.textContent = poData['Supplier Name'] || 'N/A';
        imPODetailsContainer.classList.remove('hidden');
        
        fetchAndDisplayInvoices(poNumber); 

    } catch (error) {
        console.error("Error searching for PO:", error);
        alert('An error occurred while searching for the PO.');
    }
}

function fetchAndDisplayInvoices(poNumber) {
    const invoicesData = allInvoiceData[poNumber];
    
    let invoiceCount = 0;
    imInvoicesTableBody.innerHTML = '';
    currentPOInvoices = invoicesData || {};

    const isAdmin = currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'admin';

    if (invoicesData) {
        const invoices = Object.entries(invoicesData).map(([key, value]) => ({ key, ...value }));
        invoiceCount = invoices.length;
        invoices.sort((a, b) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        invoices.forEach(inv => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.setAttribute('data-key', inv.key);
            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            const invValueDisplay = !isAdmin ? '---' : formatCurrency(inv.invValue);
            const amountPaidDisplay = !isAdmin ? '---' : formatCurrency(inv.amountPaid);
            
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
    const nextInvId = `INV-${String(invoiceCount + 1).padStart(2, '0')}`;
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
    imReleaseDateInput.value = (invData.status === 'With Accounts') ? normalizeDateForInput(invData.releaseDate) : getTodayDateString();
    imStatusSelect.value = invData.status || 'For SRV';
    document.getElementById('im-note').value = invData.note || '';
    if (imAttentionSelectChoices && invData.attention) {
        imAttentionSelectChoices.setChoiceByValue(invData.attention);
    }
    imFormTitle.textContent = `Editing Invoice: ${invData.invEntryID}`;
    imAddInvoiceButton.classList.add('hidden');
    imUpdateInvoiceButton.classList.remove('hidden');
    window.scrollTo(0, imNewInvoiceForm.offsetTop);
}
async function handleAddInvoice(e) {
    e.preventDefault();
    if (!currentPO) { alert('No PO is loaded. Please search for a PO first.'); return; }
    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;
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
            invoiceData.srvName = `${formattedDate}-${currentPO}-${site}-${vendor}`;
        }
    }
    Object.keys(invoiceData).forEach(key => { if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key]; });

    try {
        await invoiceDb.ref(`invoice_entries/${currentPO}`).push(invoiceData);
        alert('Invoice added successfully!');
        addToLocalInvoiceCache(currentPO, invoiceData);
        if (jobEntryToUpdateAfterInvoice) {
            try {
                const updates = { remarks: invoiceData.status, dateResponded: formatDate(new Date()) };
                await db.ref(`job_entries/${jobEntryToUpdateAfterInvoice}`).update(updates);
                jobEntryToUpdateAfterInvoice = null;
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
async function handleUpdateInvoice(e) {
    e.preventDefault();
    if (!currentPO || !currentlyEditingInvoiceKey) { alert('No invoice selected for update.'); return; }
    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;
    if (invoiceData.status === 'With Accounts') invoiceData.attention = '';

    const originalInvoiceData = currentPOInvoices[currentlyEditingInvoiceKey];
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
                invoiceData.srvName = `${formattedDate}-${currentPO}-${site}-${vendor}`;
                document.getElementById('im-srv-name').value = invoiceData.srvName;
            }
        } catch (error) { console.error("Could not generate SRV Name:", error); alert("Warning: Could not automatically generate the SRV Name."); }
    }
    Object.keys(invoiceData).forEach(key => { if (invoiceData[key] === null || invoiceData[key] === undefined) delete invoiceData[key]; });

    try {
        await invoiceDb.ref(`invoice_entries/${currentPO}/${currentlyEditingInvoiceKey}`).update(invoiceData);
        alert('Invoice updated successfully!');
        updateLocalInvoiceCache(currentPO, currentlyEditingInvoiceKey, invoiceData);
        fetchAndDisplayInvoices(currentPO);
        allSystemEntries = []; // Clear system cache
    } catch (error) {
        console.error("Error updating invoice:", error);
        alert('Failed to update invoice. Please try again.');
    }
}
async function handleDeleteInvoice(key) {
    if (!currentPO || !key) { alert("Could not identify the invoice to delete."); return; }
    if (confirm("Are you sure you want to delete this invoice entry? This action cannot be undone.")) {
        try {
            await invoiceDb.ref(`invoice_entries/${currentPO}/${key}`).remove();
            alert("Invoice deleted successfully.");
            removeFromLocalInvoiceCache(currentPO, key);
            fetchAndDisplayInvoices(currentPO);
        } catch (error) {
            console.error("Error deleting invoice:", error);
            alert("Failed to delete the invoice. Please try again.");
        }
    }
}
async function populateSiteFilterDropdown() {
    const siteFilterSelect = document.getElementById('im-reporting-site-filter');
    if (siteFilterSelect.options.length > 1) return;
    try {
        await ensureInvoiceDataFetched(); 
        const allPOs = allPOData;
        const sites = new Set();
        for (const poNumber in allPOs) {
            if (allPOs[poNumber]['Project ID']) sites.add(allPOs[poNumber]['Project ID']);
        }
        const sortedSites = Array.from(sites).sort();
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

// --- UPDATED AND FIXED populateInvoiceReporting ---
async function populateInvoiceReporting(searchTerm = '') {
    sessionStorage.setItem('imReportingSearch', searchTerm); // Save search term

    const isAdmin = (currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'admin');
    currentReportData = [];
    imReportingContent.innerHTML = '<p>Searching... Please wait.</p>';

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const monthFilter = document.getElementById('im-reporting-date-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;

    try {
        await ensureInvoiceDataFetched(); 
        
        const allPOs = allPOData;
        const allInvoicesByPO = allInvoiceData;
        const searchText = searchTerm.toLowerCase();
        
        let tableHTML = `<table><thead><tr><th></th><th>PO</th><th>Site</th><th>Vendor</th><th>Value</th><th>Total Paid Amount</th><th>Date Paid</th></tr></thead><tbody>`;
        let resultsFound = false;
        const paymentPromises = [];
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
            
            let invoices = allInvoicesByPO[poNumber] ? Object.values(allInvoicesByPO[poNumber]) : [];

            const filteredInvoices = invoices.filter(inv => {
                const normalizedReleaseDate = normalizeDateForInput(inv.releaseDate);
                const dateMatch = !monthFilter || (normalizedReleaseDate && normalizedReleaseDate.startsWith(monthFilter));
                const statusMatch = !statusFilter || inv.status === statusFilter;
                return dateMatch && statusMatch;
            });

            if (filteredInvoices.length === 0) continue;
            resultsFound = true;

            const poReportData = { poNumber, poDetails, site, vendor, filteredInvoices, paymentData: { totalPaidAmount: 'N/A', datePaid: 'N/A' } };
            processedPOData.push(poReportData);

            const paymentPromise = paymentDb.ref('payments').orderByChild('poNo').equalTo(poNumber).once('value').then(paymentSnapshot => {
                const paymentEntries = paymentSnapshot.val();
                let calculatedTotalPaid = 0;
                let latestDate = null;
                if (paymentEntries) {
                    for (const key in paymentEntries) {
                        const entry = paymentEntries[key];
                        const payment = parseFloat(entry.payment);
                        const dateStr = entry.datePaid;
                        if (dateStr && dateStr.trim() !== '' && !isNaN(payment)) {
                            calculatedTotalPaid += payment;
                            let currentDate = null;
                            try {
                                if (dateStr.includes('/')) { const parts = dateStr.split('/'); currentDate = new Date(parts[2], parts[1] - 1, parts[0]); }
                                else if (dateStr.includes('-')) { currentDate = new Date(dateStr + 'T00:00:00'); }
                            } catch (e) { console.warn(`Could not parse date "${dateStr}" for PO ${poNumber}`); }
                            if (currentDate && !isNaN(currentDate)) { if (!latestDate || currentDate.getTime() > latestDate.getTime()) latestDate = currentDate; }
                        }
                    }
                }
                poReportData.paymentData.totalPaidAmount = (calculatedTotalPaid > 0) ? calculatedTotalPaid : 'N/A';
                poReportData.paymentData.datePaid = latestDate ? formatDate(latestDate) : 'N/A';
            });
            paymentPromises.push(paymentPromise);
        }

        await Promise.all(paymentPromises);
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
                    const invValueDisplay = !isAdmin ? '---' : formatCurrency(invValue), amountPaidDisplay = !isAdmin ? '---' : formatCurrency(amountPaid);
                    let actionButtonsHTML = '';
                    if (isAdmin) {
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
                    nestedTableRows += `<tr><td>${inv.invEntryID || ''}</td><td>${inv.invNumber || ''}</td><td>${invoiceDateDisplay}</td><td>${invValueDisplay}</td><td>${amountPaidDisplay}</td><td>${releaseDateDisplay}</td><td>${inv.status || ''}</td><td>${inv.note || ''}</td><td>${actionButtonsHTML}</td></tr>`;
                });
                const totalInvValueDisplay = !isAdmin ? '---' : `<strong>QAR ${formatCurrency(totalInvValue)}</strong>`, totalAmountPaidDisplay = !isAdmin ? '---' : `<strong>QAR ${formatCurrency(totalAmountPaid)}</strong>`;
                const poValueDisplay = !isAdmin ? '---' : (poData.poDetails.Amount ? `QAR ${formatCurrency(poData.poDetails.Amount)}` : 'N/A');
                const totalPaidDisplay = isAdmin ? (poData.paymentData.totalPaidAmount !== 'N/A' ? `QAR ${formatCurrency(poData.paymentData.totalPaidAmount)}` : 'N/A') : '---';
                const datePaidDisplay = isAdmin ? poData.paymentData.datePaid : '---';
                let highlightClass = '';
                const poValueNum = parseFloat(poData.poDetails.Amount) || 0, epsilon = 0.01;
                if (allWithAccounts && poValueNum > 0) {
                    const isInvValueMatch = Math.abs(totalInvValue - poValueNum) < epsilon;
                    const isAmountPaidMatch = Math.abs(totalAmountPaid - poValueNum) < epsilon;
                    if (isInvValueMatch) highlightClass = isAmountPaidMatch ? 'highlight-fully-paid' : 'highlight-partial';
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

async function handleDownloadCSV() {
    const isAccountingAdmin = (currentApprover.Role || '').toLowerCase() === 'admin' && (currentApprover.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingAdmin) {
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
async function populateInvoiceDashboard() {
    const dashboardSection = document.getElementById('im-dashboard');
    if(dashboardSection.querySelector('canvas')) dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Dashboard analytics view is currently unavailable.</p>';
}
async function handleDownloadDailyReport() {
    const isAccountingAdmin = (currentApprover.Role || '').toLowerCase() === 'admin' && (currentApprover.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingAdmin) {
        alert("You do not have permission to download this report.");
        return;
    }
    const selectedDate = imDailyReportDateInput.value;
    if (!selectedDate) { alert("Please select a date."); return; }
    try {
        await ensureInvoiceDataFetched();
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;
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
        const headers = ["PO", "Site", "invName"];
        csvContent += headers.join(",") + "\r\n";
        dailyEntries.forEach(entry => { csvContent += [entry.po, entry.site, `"${(entry.invName || '').replace(/"/g, '""')}"`].join(",") + "\r\n"; });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `daily_invoice_entry_report_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) { console.error("Error generating daily report:", error); alert("An error occurred while generating the daily report."); }
}
async function handleDownloadWithAccountsReport() {
    const isAccountingAdmin = (currentApprover.Role || '').toLowerCase() === 'admin' && (currentApprover.Position || '').toLowerCase() === 'accounting';
    if (!isAccountingAdmin) {
        alert("You do not have permission to download this report.");
        return;
    }
    const selectedDate = imDailyReportDateInput.value;
    if (!selectedDate) { alert("Please select a date."); return; }
    try {
        await ensureInvoiceDataFetched();
        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;
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
        const headers = ["PO", "Site", "srvName"];
        csvContent += headers.join(",") + "\r\n";
        dailyEntries.forEach(entry => { csvContent += [entry.po, entry.site, `"${(entry.srvName || '').replace(/"/g, '""')}"`].join(",") + "\r\n"; });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `daily_with_accounts_report_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) { console.error("Error generating 'With Accounts' report:", error); alert("An error occurred while generating the report."); }
}

// BATCH INVOICE FUNCTIONS
async function populateApproverSelect(selectElement) {
    if (approverListForSelect.length === 0) {
        try {
            await ensureInvoiceDataFetched();
            const approvers = allApproverData;
            if (approvers) {
                const approverOptions = Object.values(approvers).map(approver => approver.Name ? { value: approver.Name, label: approver.Name } : null).filter(Boolean).sort((a, b) => a.label.localeCompare(b.label));
                approverListForSelect = [{ value: '', label: 'Select Attention' }, { value: 'None', label: 'None (Clear)' }, ...approverOptions];
            }
        } catch (error) { console.error("Error fetching approvers for select:", error); }
    }
    selectElement.innerHTML = '';
    approverListForSelect.forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.label; selectElement.appendChild(option); });
}
async function handleAddPOToBatch() {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const poNumber = batchPOInput.value.trim().toUpperCase();
    if (!poNumber) { alert("Please enter a PO Number."); return; }
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
        const invoiceCount = invoiceData ? Object.keys(invoiceData).length : 0;
        const nextInvId = `INV-${String(invoiceCount + 1).padStart(2, '0')}`;
        const site = poData['Project ID'] || 'N/A';
        const vendor = poData['Supplier Name'] || 'N/A';
        const row = document.createElement('tr');
        row.setAttribute('data-po', poNumber); row.setAttribute('data-site', site); row.setAttribute('data-vendor', vendor); row.setAttribute('data-next-invid', nextInvId);
        row.innerHTML = `<td>${poNumber} <span class="new-indicator">(New)</span></td><td>${site}</td><td>${vendor}</td><td><input type="text" name="invNumber" class="batch-input"></td><td><input type="text" name="details" class="batch-input"></td><td><input type="date" name="invoiceDate" class="batch-input"></td><td><input type="number" name="invValue" class="batch-input" step="0.01"></td><td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="0"></td><td><select name="attention" class="batch-input"></select></td><td><select name="status" class="batch-input"><option value="For SRV">For SRV</option><option value="Pending">Pending</option><option value="For IPC">For IPC</option><option value="Under Review">Under Review</option><option value="CEO Approval">CEO Approval</option><option value="Report">Report</option><option value="With Accounts">With Accounts</option></select></td><td><input type="text" name="note" class="batch-input"></td><td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>`;
        batchTableBody.appendChild(row);
        const attentionSelect = row.querySelector('select[name="attention"]');
        setTimeout(() => { const choices = new Choices(attentionSelect, { searchEnabled: true, shouldSort: false, itemSelectText: '', removeItemButton: true }); populateApproverSelect(choices); }, 0);
        batchPOInput.value = ''; batchPOInput.focus();
    } catch (error) { console.error("Error adding PO to batch:", error); alert('An error occurred while adding the PO.'); }
}
async function addInvoiceToBatchTable(invData) {
    const batchTableBody = document.getElementById('im-batch-table-body');
    if (batchTableBody.querySelector(`tr[data-key="${invData.key}"]`)) return;
    const row = document.createElement('tr');
    row.setAttribute('data-po', invData.po); row.setAttribute('data-key', invData.key); row.setAttribute('data-site', invData.site); row.setAttribute('data-vendor', invData.vendor);
    row.innerHTML = `<td>${invData.po} <span class="existing-indicator">(Existing: ${invData.invEntryID})</span></td><td>${invData.site}</td><td>${invData.vendor}</td><td><input type="text" name="invNumber" class="batch-input" value="${invData.invNumber || ''}"></td><td><input type="text" name="details" class="batch-input" value="${invData.details || ''}"></td><td><input type="date" name="invoiceDate" class="batch-input" value="${normalizeDateForInput(invData.invoiceDate) || ''}"></td><td><input type="number" name="invValue" class="batch-input" step="0.01" value="${invData.invValue || ''}"></td><td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="${invData.amountPaid || '0'}"></td><td><select name="attention" class="batch-input"></select></td><td><select name="status" class="batch-input"><option value="For SRV">For SRV</option><option value="Pending">Pending</option><option value="For IPC">For IPC</option><option value="Under Review">Under Review</option><option value="CEO Approval">CEO Approval</option><option value="Report">Report</option><option value="With Accounts">With Accounts</option><option value="On Hold">On Hold</option><option value="CLOSED">CLOSED</option><option value="Cancelled">Cancelled</option></select></td><td><input type="text" name="note" class="batch-input" value="${invData.note || ''}"></td><td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>`;
    batchTableBody.prepend(row);
    const attentionSelect = row.querySelector('select[name="attention"]');
    const statusSelect = row.querySelector('select[name="status"]');
    statusSelect.value = invData.status || 'For SRV';
    return new Promise(async (resolve) => { setTimeout(async () => { try { const choices = new Choices(attentionSelect, { searchEnabled: true, shouldSort: false, itemSelectText: '', removeItemButton: true }); await populateApproverSelect(choices); if (invData.attention) choices.setChoiceByValue(invData.attention); } catch (e) { console.error("Error init Choices.js in batch table:", e); } finally { resolve(); } }, 0); });
}
async function handleBatchGlobalSearch(searchType) {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const searchTerm = batchPOInput.value.trim();
    if (!searchTerm) { alert(`Please enter a ${searchType} to search for.`); return; }
    if (!confirm(`This will scan all locally cached invoices.\n\nContinue searching for all invoices with ${searchType} "${searchTerm}"?`)) return;
    batchPOInput.disabled = true; const originalPlaceholder = batchPOInput.placeholder; batchPOInput.placeholder = 'Searching local cache...';
    try {
        await ensureInvoiceDataFetched(); 
        const allPOs = allPOData, allInvoicesByPO = allInvoiceData;
        let invoicesFound = 0; const promises = [];
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber], poData = allPOs[poNumber] || {}, site = poData['Project ID'] || 'N/A', vendor = poData['Supplier Name'] || 'N/A';
            for (const key in invoices) {
                const inv = invoices[key]; let isMatch = false;
                const searchLower = searchTerm.toLowerCase();
                if (searchType === 'status' && inv.status && inv.status.toLowerCase() === searchLower) isMatch = true;
                else if (searchType === 'note' && inv.note && inv.note.toLowerCase() === searchLower) isMatch = true;
                if (isMatch) { invoicesFound++; const invData = { key, po: poNumber, site, vendor, ...inv }; promises.push(addInvoiceToBatchTable(invData)); }
            }
        }
        await Promise.all(promises);
        if (invoicesFound === 0) alert(`No invoices found with the ${searchType} "${searchTerm}".`);
        else { alert(`Added ${invoicesFound} invoice(s) to the batch list.`); batchPOInput.value = ''; }
    } catch (error) { console.error("Error during global batch search:", error); alert(`An error occurred: ${error.message}`); }
    finally { batchPOInput.disabled = false; batchPOInput.placeholder = originalPlaceholder; }
}
async function handleSaveBatchInvoices() {
    const rows = document.getElementById('im-batch-table-body').querySelectorAll('tr');
    if (rows.length === 0) { alert("There are no invoices to save."); return; }
    if (!confirm(`You are about to save/update ${rows.length} invoice(s). Continue?`)) return;
    const savePromises = []; let newInvoicesCount = 0, updatedInvoicesCount = 0;
    for (const row of rows) {
        const poNumber = row.dataset.po, site = row.dataset.site, existingKey = row.dataset.key; let vendor = row.dataset.vendor;
        const invoiceData = { invNumber: row.querySelector('[name="invNumber"]').value, details: row.querySelector('[name="details"]').value, invoiceDate: row.querySelector('[name="invoiceDate"]').value, invValue: row.querySelector('[name="invValue"]').value, amountPaid: row.querySelector('[name="amountPaid"]').value, status: row.querySelector('[name="status"]').value, note: row.querySelector('[name="note"]').value };
        invoiceData.releaseDate = getTodayDateString();
        const attentionSelect = row.querySelector('.choices select[name="attention"]');
        invoiceData.attention = attentionSelect && attentionSelect.choices ? attentionSelect.choices.getValue(true) : row.querySelector('select[name="attention"]').value;
        if (invoiceData.attention === 'None') invoiceData.attention = '';
        if (invoiceData.status === 'With Accounts') invoiceData.attention = '';
        if (!invoiceData.invValue) { alert(`Invoice Value is required for PO ${poNumber}. Cannot proceed.`); return; }
        if (vendor.length > 21) vendor = vendor.substring(0, 21);
        let promise;
        if (existingKey) { promise = invoiceDb.ref(`invoice_entries/${poNumber}/${existingKey}`).update(invoiceData); updatedInvoicesCount++; }
        else {
            invoiceData.invEntryID = row.dataset.nextInvid;
            invoiceData.dateAdded = getTodayDateString();
            invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;
            invoiceData.invName = `${site}-${poNumber}-${invoiceData.invEntryID}-${vendor}`;
            if (invoiceData.status === 'With Accounts') {
                const today = new Date(), yyyy = today.getFullYear(), mm = String(today.getMonth() + 1).padStart(2, '0'), dd = String(today.getDate()).padStart(2, '0');
                invoiceData.srvName = `${yyyy}${mm}${dd}-${poNumber}-${site}-${vendor}`;
            }
            promise = invoiceDb.ref(`invoice_entries/${poNumber}`).push(invoiceData); newInvoicesCount++;
        }
        savePromises.push(promise);
    }
    try {
        await Promise.all(savePromises);
        alert(`${newInvoicesCount} new invoice(s) created and ${updatedInvoicesCount} invoice(s) updated successfully!`);
        document.getElementById('im-batch-table-body').innerHTML = ''; allSystemEntries = [];
    } catch (error) { console.error("Error saving batch invoices:", error); alert("An error occurred while saving. Please check the data and try again."); }
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

// SUMMARY NOTE FUNCTIONS
async function initializeNoteSuggestions() {
    if (allUniqueNotes.size > 0) return;
    try {
        await ensureInvoiceDataFetched(); 
        const allInvoices = allInvoiceData;
        if (allInvoices) { for (const po in allInvoices) { for (const invKey in allInvoices[po]) { if (allInvoices[po][invKey].note) allUniqueNotes.add(allInvoices[po][invKey].note); } } }
        noteSuggestionsDatalist.innerHTML = '';
        allUniqueNotes.forEach(note => { const option = document.createElement('option'); option.value = note; noteSuggestionsDatalist.appendChild(option); });
    } catch (error) { console.error("Error initializing note suggestions:", error); }
}
async function handleGenerateSummary() {
    const prevNote = summaryNotePreviousInput.value.trim(), currentNote = summaryNoteCurrentInput.value.trim();
    if (!currentNote) { alert("Please enter a note for the 'Current Note' search."); return; }
    summaryNoteGenerateBtn.textContent = 'Generating...'; summaryNoteGenerateBtn.disabled = true;
    try {
        await ensureInvoiceDataFetched(); 
        const allInvoicesByPO = allInvoiceData, allPOs = allPOData;
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
            row.innerHTML = `<td>${inv.po}</td><td>${inv.site}</td><td><input type="text" class="summary-edit-input" name="details" value="${inv.details || ''}"></td><td><input type="date" class="summary-edit-input" name="invoiceDate" value="${normalizeDateForInput(inv.invoiceDate) || ''}"></td><td>${formatCurrency(inv.invValue)}</td>`;
            snTableBody.appendChild(row);
        }
        snTotalNumeric.textContent = formatCurrency(currentPaymentTotal);
        snTotalInWords.textContent = numberToWords(currentPaymentTotal);
        summaryNotePrintArea.classList.remove('hidden');
    } catch (error) { console.error("Error generating summary:", error); alert("An error occurred. Please check the notes and try again."); }
    finally { summaryNoteGenerateBtn.textContent = 'Generate Summary'; summaryNoteGenerateBtn.disabled = false; }
}
async function handleUpdateSummaryChanges() {
    const rows = snTableBody.querySelectorAll('tr');
    if (rows.length === 0) { alert("No data to update."); return; }
    if (!confirm("Are you sure you want to save the changes for all visible entries?")) return;
    summaryNoteUpdateBtn.textContent = "Updating..."; summaryNoteUpdateBtn.disabled = true;
    const newGlobalStatus = document.getElementById('summary-note-status-input').value, newGlobalSRV = document.getElementById('summary-note-srv-input').value.trim(), today = getTodayDateString();
    const updatePromises = [];
    try {
        rows.forEach(row => {
            const poNumber = row.dataset.po, invoiceKey = row.dataset.key;
            const newDetails = row.querySelector('input[name="details"]').value, newInvoiceDate = row.querySelector('input[name="invoiceDate"]').value;
            if (poNumber && invoiceKey) {
                const updates = { details: newDetails, invoiceDate: newInvoiceDate, releaseDate: today };
                if (newGlobalStatus) updates.status = newGlobalStatus;
                if (newGlobalSRV) updates.srvName = newGlobalSRV;
                if (newGlobalStatus === 'With Accounts') updates.attention = '';
                updatePromises.push(invoiceDb.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates));
            }
        });
        await Promise.all(updatePromises);
        alert("Changes saved successfully!");
    } catch (error) { console.error("Error updating summary changes:", error); alert("An error occurred while saving the changes."); }
    finally { summaryNoteUpdateBtn.textContent = "Update Changes"; summaryNoteUpdateBtn.disabled = false; document.getElementById('summary-note-status-input').value = ''; document.getElementById('summary-note-srv-input').value = ''; }
}

// LOGOUT FUNCTION
function handleLogout() {
    sessionStorage.clear(); // Clear all session data on logout
    if (dateTimeInterval) clearInterval(dateTimeInterval);
    if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
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
        
        // ++ ADDED: Show IM link in sidebar for Accounting ++
        if (currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'accounting') {
            workdeskIMLinkContainer.classList.remove('hidden');
        } else {
            workdeskIMLinkContainer.classList.add('hidden');
        }

        if (!siteSelectChoices) { 
            siteSelectChoices = new Choices(document.getElementById('job-site'), { searchEnabled: true, shouldSort: false, itemSelectText: '', }); 
            populateSiteDropdown(); 
        } 
        if (!attentionSelectChoices) { 
            const attentionElement = document.getElementById('job-attention');
            attentionSelectChoices = new Choices(attentionElement, { searchEnabled: true, shouldSort: false, itemSelectText: '', }); 
            populateAttentionDropdown(attentionSelectChoices); 
            // ++ ADDED: Event listener for vacation modal ++
            attentionElement.addEventListener('choice', (event) => {
                const choice = event.detail.choice;
                // ++ MODIFIED: Fixed typo from onBacation to onVacation ++
                if(choice.customProperties && choice.customProperties.onVacation) {
                    vacationingUserName.textContent = choice.value;
                    vacationReturnDate.textContent = choice.customProperties.returnDate || 'N/A';
                    replacementNameDisplay.textContent = choice.customProperties.replacement.name;
                    replacementContactDisplay.textContent = choice.customProperties.replacement.contact;
                    replacementEmailDisplay.textContent = choice.customProperties.replacement.email;
                    vacationModal.classList.remove('hidden');
                }
            });
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
    jobEntryTableBody.addEventListener('click', (e) => { const row = e.target.closest('tr'); if (row) { const key = row.getAttribute('data-key'); const entry = allSystemEntries.find(item => item.key === key); if (key && entry && entry.source !== 'invoice') populateFormForEditing(key); } });
    
    activeTaskTableBody.addEventListener('click', (e) => { 
        const row = e.target.closest('tr'); 
        if (!row) return; 
        if (e.target.classList.contains('respond-btn')) { 
            handleRespondClick(e); 
            return; 
        } 
        const key = row.dataset.key; 
        if (!key) return; 
        const task = allSystemEntries.find(entry => entry.key === key); 
        
        // ++ MODIFIED: PDF link check for "Nil", "nil", and empty/blank strings ++
        if (task && task.source === 'invoice' && task.invName && task.invName.trim() && task.invName.toLowerCase() !== 'nil') {
            window.open(PDF_BASE_PATH + encodeURIComponent(task.invName) + ".pdf", '_blank'); 
        }
    });

    jobForSelect.addEventListener('change', (e) => { const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs'; if (e.target.value === 'IPC' && isQS) { attentionSelectChoices.clearStore(); attentionSelectChoices.setChoices([{ value: 'All', label: 'All', selected: true }], 'value', 'label', false); attentionSelectChoices.disable(); } else if (attentionSelectChoices.disabled) { attentionSelectChoices.enable(); resetJobEntryForm(true); } });
    activeTaskSearchInput.addEventListener('input', debounce((e) => handleActiveTaskSearch(e.target.value), 500));
    jobEntrySearchInput.addEventListener('input', debounce((e) => handleJobEntrySearch(e.target.value), 500));
    taskHistorySearchInput.addEventListener('input', debounce((e) => handleTaskHistorySearch(e.target.value), 500));
    reportingSearchInput.addEventListener('input', debounce(() => filterAndRenderReport(allSystemEntries), 500));
    printReportButton.addEventListener('click', () => window.print());
    downloadWdReportButton.addEventListener('click', handleDownloadWorkdeskCSV);
    reportTabsContainer.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { reportTabsContainer.querySelector('.active').classList.remove('active'); e.target.classList.add('active'); currentReportFilter = e.target.getAttribute('data-job-type'); filterAndRenderReport(allSystemEntries); } });
    document.querySelectorAll('.back-to-main-dashboard').forEach(button => button.addEventListener('click', (e) => { e.preventDefault(); showView('dashboard'); }));
    
    invoiceManagementButton.addEventListener('click', async () => { 
        if (!currentApprover) { handleLogout(); return; } 
        imUsername.textContent = currentApprover.Name || 'User'; 
        imUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile; 
        
        if (imAttentionSelectChoices) imAttentionSelectChoices.destroy(); 
        imAttentionSelectChoices = new Choices(imAttentionSelect, { searchEnabled: true, shouldSort: false, itemSelectText: '' }); 
        populateAttentionDropdown(imAttentionSelectChoices); 
        
        const userRole = (currentApprover.Role || '').toLowerCase();
        const userPosition = (currentApprover.Position || '').toLowerCase();
        
        const isAccountingAdmin = userRole === 'admin' && userPosition === 'accounting';
        const isAccounting = userPosition === 'accounting';

        imNav.querySelector('a[data-section="im-invoice-entry"]').classList.toggle('disabled', !isAccountingAdmin); 
        document.getElementById('batch-entry-nav-link').classList.toggle('disabled', !isAccountingAdmin); 
        const summaryNoteLink = imNav.querySelector('a[data-section="im-summary-note"]'); 
        if (summaryNoteLink) summaryNoteLink.classList.toggle('disabled', !isAccountingAdmin); 
        
        document.getElementById('im-nav-workdesk').classList.toggle('hidden', !isAccounting);
        document.getElementById('im-nav-activetask').classList.toggle('hidden', !isAccounting);
        
        imReportingDownloadCSVButton.disabled = !isAccountingAdmin;
        imDownloadDailyReportButton.disabled = !isAccountingAdmin;
        imDownloadWithAccountsReportButton.disabled = !isAccountingAdmin;
        
        updateIMDateTime(); 
        if (imDateTimeInterval) clearInterval(imDateTimeInterval); 
        imDateTimeInterval = setInterval(updateIMDateTime, 1000); 
        showView('invoice-management'); 
        if (window.innerWidth <= 768) { 
            showIMSection('im-reporting'); 
            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active')); 
            const reportingLink = imNav.querySelector('a[data-section="im-reporting"]'); 
            if (reportingLink) reportingLink.classList.add('active'); 
        } else { 
            showIMSection('im-dashboard'); 
            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active')); 
            const dashboardLink = imNav.querySelector('a[data-section="im-dashboard"]'); 
            if (dashboardLink) dashboardLink.classList.add('active'); 
        } 
    });

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

    imNav.addEventListener('click', (e) => { const link = e.target.closest('a'); if (!link || link.classList.contains('disabled') || link.id === 'im-workdesk-button' || link.id === 'im-activetask-button') return; e.preventDefault(); const sectionId = link.getAttribute('data-section'); if (sectionId) { imNav.querySelectorAll('a').forEach(a => a.classList.remove('active')); link.classList.add('active'); showIMSection(sectionId); } });
    imPOSearchButton.addEventListener('click', handlePOSearch);
    imPOSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handlePOSearch(); } });
    imAddInvoiceButton.addEventListener('click', handleAddInvoice);
    imUpdateInvoiceButton.addEventListener('click', handleUpdateInvoice);
    imClearFormButton.addEventListener('click', () => { currentPO ? resetInvoiceForm() : resetInvoiceEntryPage(); });
    imBackToActiveTaskButton.addEventListener('click', () => { showView('workdesk'); workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active')); workdeskNav.querySelector('a[data-section="wd-activetask"]').classList.add('active'); showWorkdeskSection('wd-activetask'); });
    
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

    imReportingContent.addEventListener('click', (e) => { const expandBtn = e.target.closest('.expand-btn'); if (expandBtn) { const masterRow = expandBtn.closest('.master-row'); const detailRow = document.querySelector(masterRow.dataset.target); if (detailRow) { detailRow.classList.toggle('hidden'); expandBtn.textContent = detailRow.classList.contains('hidden') ? '+' : '−'; } } });
    imReportingForm.addEventListener('submit', (e) => { e.preventDefault(); const searchTerm = imReportingSearchInput.value.trim(); if (!searchTerm && !document.getElementById('im-reporting-site-filter').value && !document.getElementById('im-reporting-date-filter').value && !document.getElementById('im-reporting-status-filter').value) { imReportingContent.innerHTML = '<p style="color: red; font-weight: bold;">Please specify at least one search criteria.</p>'; return; } populateInvoiceReporting(searchTerm); });
    imReportingClearButton.addEventListener('click', () => { imReportingForm.reset(); sessionStorage.removeItem('imReportingSearch'); imReportingContent.innerHTML = '<p>Please enter a search term and click Search.</p>'; currentReportData = []; });
    imReportingDownloadCSVButton.addEventListener('click', handleDownloadCSV);
    imDownloadDailyReportButton.addEventListener('click', handleDownloadDailyReport);
    if(imDownloadWithAccountsReportButton) imDownloadWithAccountsReportButton.addEventListener('click', handleDownloadWithAccountsReport);
    imStatusSelect.addEventListener('change', (e) => { if (e.target.value === 'CEO Approval' && imAttentionSelectChoices) imAttentionSelectChoices.setChoiceByValue('Mr. Hamad'); });
    imInvValueInput.addEventListener('input', (e) => { imAmountPaidInput.value = e.target.value; });
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

    // ++ NEW: Universal modal close button listener ++
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close-btn')) {
            const modalId = e.target.dataset.modalId || e.target.closest('.modal-overlay').id;
            if (modalId) {
                document.getElementById(modalId).classList.add('hidden');
            }
        }
    });

    const batchAddBtn = document.getElementById('im-batch-add-po-button'), batchSaveBtn = document.getElementById('im-batch-save-button'), batchTableBody = document.getElementById('im-batch-table-body'), batchPOInput = document.getElementById('im-batch-po-input'), batchSearchStatusBtn = document.getElementById('im-batch-search-by-status-button'), batchSearchNoteBtn = document.getElementById('im-batch-search-by-note-button');
    if (batchSearchStatusBtn) batchSearchStatusBtn.addEventListener('click', () => handleBatchGlobalSearch('status'));
    if (batchSearchNoteBtn) batchSearchNoteBtn.addEventListener('click', () => handleBatchGlobalSearch('note'));
    if (batchAddBtn) batchAddBtn.addEventListener('click', handleAddPOToBatch);
    if (batchSaveBtn) batchSaveBtn.addEventListener('click', handleSaveBatchInvoices);
    if (batchPOInput) batchPOInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); if(batchSearchStatusBtn) batchSearchStatusBtn.click(); } });
    if (batchTableBody) {
        batchTableBody.addEventListener('click', (e) => { if (e.target.classList.contains('batch-remove-btn')) { const row = e.target.closest('tr'); const choicesEl = row.querySelector('.choices'); if (choicesEl && choicesEl.choices) choicesEl.choices.destroy(); row.remove(); } });
        batchTableBody.addEventListener('input', (e) => { if (e.target.getAttribute('name') === 'invValue') { const row = e.target.closest('tr'); if (row) { const amountPaidInput = row.querySelector('[name="amountPaid"]'); if (amountPaidInput) amountPaidInput.value = e.target.value; } } });
    }
    if (imBatchSearchExistingButton) imBatchSearchExistingButton.addEventListener('click', () => { if(imBatchSearchModal) imBatchSearchModal.classList.remove('hidden'); document.getElementById('im-batch-modal-results').innerHTML = '<p>Enter a PO number to see its invoices.</p>'; document.getElementById('im-batch-modal-po-input').value = ''; });
    if (imBatchSearchModal) {
        const modalSearchBtn = document.getElementById('im-batch-modal-search-btn'), addSelectedBtn = document.getElementById('im-batch-modal-add-selected-btn'), modalPOInput = document.getElementById('im-batch-modal-po-input');
        if(modalSearchBtn) modalSearchBtn.addEventListener('click', handleBatchModalPOSearch);
        if(addSelectedBtn) addSelectedBtn.addEventListener('click', handleAddSelectedToBatch);
        if (modalPOInput) modalPOInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (modalSearchBtn) modalSearchBtn.click(); } });
    }
    const refreshEntryBtn = document.getElementById('im-refresh-entry-button');
    if (refreshEntryBtn) refreshEntryBtn.addEventListener('click', async () => { alert("Refreshing all data from sources..."); await ensureInvoiceDataFetched(true); alert("Data refreshed."); if (currentPO) handlePOSearch(); });
    const refreshBatchBtn = document.getElementById('im-refresh-batch-button');
    if (refreshBatchBtn) refreshBatchBtn.addEventListener('click', async () => { alert("Refreshing all data... Your current batch list will be cleared."); await ensureInvoiceDataFetched(true); document.getElementById('im-batch-table-body').innerHTML = ''; alert("Data refreshed. Please add POs again."); });
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
    if(summaryNoteGenerateBtn) summaryNoteGenerateBtn.addEventListener('click', handleGenerateSummary);
    if(summaryNoteUpdateBtn) summaryNoteUpdateBtn.addEventListener('click', handleUpdateSummaryChanges);
    if(summaryNotePrintBtn) summaryNotePrintBtn.addEventListener('click', () => window.print());
});