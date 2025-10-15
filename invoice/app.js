// --- 1. FIREBASE CONFIGURATION & 2. INITIALIZE FIREBASE ---
const firebaseConfig = { apiKey: "AIzaSyBH3MgLP2wEdxaSWaGK0r8MN0f3doR5Z3U", authDomain: "ibainvoice-57cf4.firebaseapp.com", databaseURL: "https://ibainvoice-57cf4-default-rtdb.firebaseio.com", projectId: "ibainvoice-57cf4", storageBucket: "ibainvoice-57cf4.appspot.com", messagingSenderId: "170378572965", appId: "1:170378572965:web:dd29f69279d9ecf858094c", measurementId: "G-LD4B2RBSDV" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

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
const dbPendingEntriesCount = document.getElementById('db-pending-entries-count');
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
const settingsReturnDateContainer = document.getElementById('settings-return-date-container');
const settingsReturnDateInput = document.getElementById('settings-return-date');
const settingsMessage = document.getElementById('settings-message');

// +++ INVOICE MANAGEMENT REFERENCES +++
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
const imStatusSelect = document.getElementById('im-status');
const imInvValueInput = document.getElementById('im-inv-value');
const imAmountPaidInput = document.getElementById('im-amount-paid');

// +++ SUMMARY NOTE REFERENCES +++
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

// +++ INVOICE MANAGEMENT STATE +++
let imDateTimeInterval = null;
let currentPO = null;
let imAttentionSelectChoices = null;
let currentlyEditingInvoiceKey = null;
let currentPOInvoices = {};
let currentReportData = [];
let imBarChart = null; // To hold the Chart.js instance
let approverListForSelect = []; // For batch entry select elements
let allUniqueNotes = new Set(); // For summary note suggestions

// NEW: Global state variables to manage the new workflow between WorkDesk Active Task and Invoice Entry
let jobEntryToUpdateAfterInvoice = null; // Stores the key of the job entry to update
let pendingJobEntryDataForInvoice = null; // Stores the data to pre-fill the invoice form

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
function updateDashboardDateTime() { const now = new Date(); const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }; datetimeElement.textContent = now.toLocaleDateString('en-GB', options); }
function updateWorkdeskDateTime() { const now = new Date(); const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }; const dateString = now.toLocaleDateString('en-GB', dateOptions); const timeString = now.toLocaleTimeString('en-GB', timeOptions); workdeskDatetimeElement.textContent = `${dateString} at ${timeString}`; }
function handleSuccessfulLogin() { dashboardUsername.textContent = `Welcome ${currentApprover.Name || currentApprover.Email}`; updateDashboardDateTime(); if (dateTimeInterval) clearInterval(dateTimeInterval); dateTimeInterval = setInterval(updateDashboardDateTime, 1000); showView('dashboard'); }
function showWorkdeskSection(sectionId) {
    workdeskSections.forEach(section => { section.classList.add('hidden'); });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) { targetSection.classList.remove('hidden'); }
    if (sectionId === 'wd-dashboard') { populateWorkdeskDashboard(); }
    if (sectionId === 'wd-jobentry') { fetchAndDisplayJobEntries(); }
    if (sectionId === 'wd-activetask') { populateActiveTasks(); }
    if (sectionId === 'wd-taskhistory') { populateTaskHistory(); }
    if (sectionId === 'wd-reporting') { populateReporting(); }
    if (sectionId === 'wd-settings') { populateSettingsForm(); }
}
function formatDate(date) { const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const day = String(date.getDate()).padStart(2, '0'); const month = months[date.getMonth()]; const year = date.getFullYear(); return `${day}-${month}-${year}`; }

function normalizeDateForInput(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    if (/^\d{2}-\d{2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-');
        const day = parts[0];
        const month = parts[1];
        const year = `20${parts[2]}`;
        return `${year}-${month}-${day}`;
    }
    // Handle format "14-Oct-2025"
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
    const parts = displayDate.split('-'); // e.g., ["14", "Oct", "2025"]
    if (parts.length !== 3) return '';

    const day = parts[0];
    const year = parts[2];
    const monthMap = {
        "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
        "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
    };
    const month = monthMap[parts[1]];

    if (!month) return ''; // Invalid month name

    return `${year}-${month}-${day}`; // "2025-10-14"
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
        return '0.00';
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


// --- WORKDESK LOGIC ---
async function ensureAllEntriesFetched() {
    const [jobEntriesSnapshot, invoiceEntriesSnapshot, poSnapshot] = await Promise.all([
        db.ref('job_entries').orderByChild('timestamp').once('value'),
        db.ref('invoice_entries').once('value'),
        db.ref('purchase_orders').once('value')
    ]);

    const jobEntriesData = jobEntriesSnapshot.val() || {};
    const purchaseOrdersData = poSnapshot.val() || {};

    const processedJobEntries = Object.entries(jobEntriesData).map(([key, value]) => ({
        key,
        ...value,
        vendorName: (value.po && purchaseOrdersData[value.po]) ? purchaseOrdersData[value.po]['Supplier Name'] : 'N/A',
        source: 'job_entry'
    }));


    const invoiceEntriesData = invoiceEntriesSnapshot.val() || {};
    const processedInvoiceEntries = [];

    for (const poNumber in invoiceEntriesData) {
        const invoices = invoiceEntriesData[poNumber];
        const site = purchaseOrdersData[poNumber]?.['Project ID'] || 'N/A';
        const vendorName = purchaseOrdersData[poNumber]?.['Supplier Name'] || 'N/A';

        for (const invoiceKey in invoices) {
            const invoice = invoices[invoiceKey];

            if (!invoice.attention || invoice.attention.trim() === '') {
                continue;
            }

            const normalizedDate = normalizeDateForInput(invoice.releaseDate);

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

    if (task.source === 'invoice') {
        const completedStatuses = ['CEO Approval', 'With Accounts', 'Under Review']; // 'Under Review' is now a completed step for the user
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
}
async function populateAttentionDropdown(choicesInstance) {
    try {
        if (!choicesInstance) return;
        choicesInstance.setChoices([{ value: '', label: 'Loading...', disabled: true, selected: true }], 'value', 'label', true);
        const snapshot = await db.ref('approvers').once('value');
        const approvers = snapshot.val();
        if (approvers) {
            const approverOptions = Object.values(approvers).map(approver => approver.Name ? { value: approver.Name, label: approver.Name } : null).filter(Boolean);
            const choiceList = [
                { value: '', label: 'Select Attention', disabled: true },
                { value: 'None', label: 'None (Clear Selection)' },
                ...approverOptions
            ];
            choicesInstance.setChoices(choiceList, 'value', 'label', true);
        } else { choicesInstance.setChoices([{ value: '', label: 'No approvers found', disabled: true }]); }
    } catch (error) { console.error("Error populating attention dropdown:", error); if (choicesInstance) choicesInstance.setChoices([{ value: '', label: 'Error loading names', disabled: true }]); }
}
async function populateSiteDropdown() {
    try {
        if (!siteSelectChoices) return;
        siteSelectChoices.setChoices([{ value: '', label: 'Loading...', disabled: true, selected: true }]);
        const snapshot = await db.ref('project_sites').once('value');
        const sites = snapshot.val();
        if (sites) {
            const siteOptions = Object.values(sites).map(site => site.Warehouse && site.Description ? { value: site.Warehouse, label: `${site.Warehouse} - ${site.Description}` } : null).filter(Boolean);
            siteSelectChoices.setChoices([{ value: '', label: 'Select a Site', disabled: true }].concat(siteOptions), 'value', 'label', true);
        } else { siteSelectChoices.setChoices([{ value: '', label: 'No sites found', disabled: true }]); }
    } catch (error) { console.error("Error populating site dropdown:", error); if (siteSelectChoices) siteSelectChoices.setChoices([{ value: '', label: 'Error loading sites', disabled: true }]); }
}
function renderJobEntryTable(entries) {
    jobEntryTableBody.innerHTML = '';
    if (!entries || entries.length === 0) {
        jobEntryTableBody.innerHTML = `<tr><td colspan="8">No pending entries found.</td></tr>`;
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
async function fetchAndDisplayJobEntries() {
    jobEntryTableBody.innerHTML = `<tr><td colspan="8">Loading entries...</td></tr>`;
    try {
        await ensureAllEntriesFetched();
        // Show only job entries in this section
        userJobEntries = allSystemEntries.filter(entry => entry.source === 'job_entry' && entry.enteredBy === currentApprover.Name && !isTaskComplete(entry));
        renderJobEntryTable(userJobEntries);
    } catch (error) { console.error("Error fetching job entries:", error); jobEntryTableBody.innerHTML = `<tr><td colspan="8">Error loading data.</td></tr>`; }
}
function handleJobEntrySearch(searchTerm) {
    const searchText = searchTerm.toLowerCase();
    if (!searchText) { renderJobEntryTable(userJobEntries); return; }
    const filteredEntries = userJobEntries.filter(entry => { return ((entry.for && entry.for.toLowerCase().includes(searchText)) || (entry.ref && entry.ref.toLowerCase().includes(searchText)) || (entry.site && entry.site.toLowerCase().includes(searchText)) || (entry.group && entry.group.toLowerCase().includes(searchText)) || (entry.attention && entry.attention.toLowerCase().includes(searchText))); });
    renderJobEntryTable(filteredEntries);
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
        fetchAndDisplayJobEntries();
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
        fetchAndDisplayJobEntries();
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
async function populateActiveTasks() {
    activeTaskTableBody.innerHTML = '<tr><td colspan="8">Loading tasks...</td></tr>';
    if (!currentApprover || !currentApprover.Name) { activeTaskTableBody.innerHTML = '<tr><td colspan="8">Could not identify user.</td></tr>'; return; }
    try {
        await ensureAllEntriesFetched();
        userActiveTasks = allSystemEntries.filter(task => task.attention === currentApprover.Name && !isTaskComplete(task));
        renderActiveTaskTable(userActiveTasks);
    } catch (error) { console.error("Error fetching active tasks:", error); activeTaskTableBody.innerHTML = '<tr><td colspan="8">Error loading tasks.</td></tr>'; }
}
function renderActiveTaskTable(tasks) {
    activeTaskTableBody.innerHTML = '';
    if (!tasks || tasks.length === 0) {
        activeTaskTableBody.innerHTML = '<tr><td colspan="8">You have no active tasks.</td></tr>';
        return;
    }
    tasks.forEach(task => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', task.key); // Set data-key on the row itself

        const isInvoiceFromIrwin = task.source === 'invoice' && task.enteredBy === 'Irwin';
        if (isInvoiceFromIrwin || (task.source === 'invoice' && task.invName)) {
            row.classList.add('clickable-pdf');
        }

        const actionButton = isInvoiceFromIrwin
            ? `<button class="respond-btn" data-key="${task.key}">Respond</button>` // Make it respondable
            : `<button class="respond-btn" data-key="${task.key}">Respond</button>`;
        
        row.innerHTML = `
            <td>${task.for || ''}</td>
            <td>${task.ref || ''}</td>
            <td>${task.po || ''}</td>
            <td>${task.site || ''}</td>
            <td>${task.group || ''}</td>
            <td>${task.date || ''}</td>
            <td>${task.remarks || 'Pending'}</td>
            <td>${actionButton}</td>
        `;
        activeTaskTableBody.appendChild(row);
    });
}
async function populateTaskHistory() {
    taskHistoryTableBody.innerHTML = '<tr><td colspan="9">Loading history...</td></tr>';
    if (!currentApprover || !currentApprover.Name) { taskHistoryTableBody.innerHTML = '<tr><td colspan="9">Could not identify user.</td></tr>'; return; }
    try {
        await ensureAllEntriesFetched();

        // New, stricter filter for personal history
        userTaskHistory = allSystemEntries.filter(task => {
            const isRelatedToMe = (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name);
            return isTaskComplete(task) && isRelatedToMe;
        });

        renderTaskHistoryTable(userTaskHistory);
    } catch (error) { console.error("Error fetching task history:", error); taskHistoryTableBody.innerHTML = '<tr><td colspan="9">Error loading task history.</td></tr>'; }
}
function renderTaskHistoryTable(tasks) {
    taskHistoryTableBody.innerHTML = '';
    if (!tasks || tasks.length === 0) { taskHistoryTableBody.innerHTML = '<tr><td colspan="9">You have no completed tasks in your history.</td></tr>'; return; }
    tasks.forEach(task => {
        const row = document.createElement('tr');
        const remarks = task.remarks || 'Completed';
        row.innerHTML = `<td>${task.for || ''}</td><td>${task.ref || ''}</td><td>${task.amount || ''}</td><td>${task.po || ''}</td><td>${task.site || ''}</td><td>${task.group || ''}</td><td>${task.date || ''}</td><td>${task.dateResponded || 'N/A'}</td><td>${remarks}</td>`;
        taskHistoryTableBody.appendChild(row);
    });
}
async function populateReporting() {
    reportingTableBody.innerHTML = '<tr><td colspan="11">Loading all entries...</td></tr>';
    try {
        await ensureAllEntriesFetched();
        handleReportingSearch();
    } catch (error) { console.error("Error fetching all entries for reporting:", error); reportingTableBody.innerHTML = '<tr><td colspan="11">Error loading reporting data.</td></tr>'; }
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
    if (searchText) {
        filteredEntries = filteredEntries.filter(entry => {
            return ((entry.for && entry.for.toLowerCase().includes(searchText)) || (entry.ref && entry.ref.toLowerCase().includes(searchText)) || (entry.po && entry.po.toLowerCase().includes(searchText)) || (entry.amount && entry.amount.toString().includes(searchText)) || (entry.site && entry.site.toLowerCase().includes(searchText)) || (entry.attention && entry.attention.toLowerCase().includes(searchText)) || (entry.enteredBy && entry.enteredBy.toLowerCase().includes(searchText)) || (entry.date && entry.date.toLowerCase().includes(searchText)));
        });
    }
    renderReportingTable(filteredEntries);
}
async function populateWorkdeskDashboard() {
    await ensureAllEntriesFetched();
    const myActiveTasks = allSystemEntries.filter(task => task.attention === currentApprover.Name && !isTaskComplete(task));
    const myPendingEntries = allSystemEntries.filter(task => task.enteredBy === currentApprover.Name && !isTaskComplete(task));
    const myCompletedTasks = allSystemEntries.filter(task => (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name) && isTaskComplete(task));
    const myRelatedEntries = allSystemEntries.filter(task => task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name);

    dbActiveTasksCount.textContent = myActiveTasks.length;
    dbPendingEntriesCount.textContent = myPendingEntries.length;
    dbCompletedTasksCount.textContent = myCompletedTasks.length;

    const siteStats = {};
    myRelatedEntries.forEach(entry => {
        if (!entry.site) return;
        if (!siteStats[entry.site]) { siteStats[entry.site] = { completed: 0, pending: 0 }; }
        if (isTaskComplete(entry)) { siteStats[entry.site].completed++; } else { siteStats[entry.site].pending++; }
    });

    dbSiteStatsContainer.innerHTML = '';
    if (Object.keys(siteStats).length === 0) {
        dbSiteStatsContainer.innerHTML = '<p>No data available for your sites yet.</p>';
    } else {
        const siteCardsGrid = document.createElement('div');
        siteCardsGrid.className = 'site-cards-grid';

        for (const site in siteStats) {
            const stats = siteStats[site];
            const total = stats.completed + stats.pending;
            const completionPercentage = total > 0 ? (stats.completed / total) * 100 : 0;

            const card = document.createElement('div');
            card.className = 'site-performance-card';
            card.innerHTML = `
                <div class="card-header">
                    <h3 class="card-title">${site}</h3>
                    <div class="card-completion-percent">${completionPercentage.toFixed(0)}% Complete</div>
                </div>
                <div class="card-total">
                    <div class="card-total-value">${total}</div>
                    <span class="card-total-label">Total Tasks</span>
                </div>
                <div class="progress-bar-track">
                    <div class="progress-bar-fill" style="width: ${completionPercentage}%;"></div>
                </div>
                <div class="card-stats-breakdown">
                    <div class="stat-item completed">
                        <span class="stat-value">${stats.completed}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                    <div class="stat-item pending">
                        <span class="stat-value">${stats.pending}</span>
                        <span class="stat-label">Pending</span>
                    </div>
                </div>
            `;
            siteCardsGrid.appendChild(card);
        }
        dbSiteStatsContainer.appendChild(siteCardsGrid);
    }

    dbRecentTasksBody.innerHTML = '';
    if (myActiveTasks.length === 0) {
        dbRecentTasksBody.innerHTML = '<tr><td colspan="5">No recent active tasks.</td></tr>';
    } else {
        myActiveTasks.slice(0, 5).forEach(task => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${task.for}</td><td>${task.ref}</td><td>${task.site}</td><td>${task.enteredBy}</td><td>${task.date}</td>`;
            dbRecentTasksBody.appendChild(row);
        });
    }
}
async function handleRespondClick(e) {
    const key = e.target.getAttribute('data-key');
    if (!key) return;

    const taskData = allSystemEntries.find(entry => entry.key === key);
    if (!taskData) return;

    // NEW WORKFLOW: Redirect "Invoice" for "Irwin" to Invoice Entry
    if (taskData.source === 'job_entry' && taskData.for === 'Invoice' && taskData.attention === 'Irwin') {
        if (!taskData.po) {
            alert("This job entry is missing a PO number and cannot be processed in Invoice Management.");
            return;
        }
        // 1. Store data for later
        jobEntryToUpdateAfterInvoice = key;
        pendingJobEntryDataForInvoice = taskData;

        // 2. Switch views
        invoiceManagementButton.click(); // Simulates user clicking the main button
        
        // Use a short timeout to ensure the view is rendered before manipulating its content
        setTimeout(() => {
            imNav.querySelector('a[data-section="im-invoice-entry"]').click(); // Clicks the nav link
            
            // 3. Auto-search
            imPOSearchInput.value = taskData.po;
            imPOSearchButton.click();
        }, 100); 

        return; // Stop further execution of this function
    }
    
    // Automated response for tasks that came from the Invoice Entry module
    if (taskData.source === 'invoice') {
        const updates = {
            releaseDate: getTodayDateString(),
            status: 'SRV Done'
        };
        try {
            await db.ref(`invoice_entries/${taskData.originalPO}/${taskData.originalKey}`).update(updates);
            alert('Task status updated to "SRV Done".');
            populateActiveTasks(); // Refresh the active tasks list
        } catch (error) {
            console.error("Error updating invoice status:", error);
            alert("Failed to update invoice status. Please try again.");
        }
        return; 
    }

    // Automated response for "Invoice" tasks CREATED BY "Irwin"
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
    
    // Default logic for all other job_entry tasks (e.g., IPC for QS)
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
function handleActiveTaskSearch(searchTerm) { const searchText = searchTerm.toLowerCase(); if (!searchText) { renderActiveTaskTable(userActiveTasks); return; } const filteredTasks = userActiveTasks.filter(task => { return ((task.for && task.for.toLowerCase().includes(searchText)) || (task.ref && task.ref.toLowerCase().includes(searchText)) || (task.site && task.site.toLowerCase().includes(searchText)) || (task.group && task.group.toLowerCase().includes(searchText)) || (task.date && task.date.toLowerCase().includes(searchText))); }); renderActiveTaskTable(filteredTasks); }
function handleTaskHistorySearch(searchTerm) { const searchText = searchTerm.toLowerCase(); if (!searchText) { renderTaskHistoryTable(userTaskHistory); return; } const filteredHistory = userTaskHistory.filter(task => { return ((task.for && task.for.toLowerCase().includes(searchText)) || (task.ref && task.ref.toLowerCase().includes(searchText)) || (task.amount && task.amount.toString().includes(searchText)) || (task.po && task.po.toLowerCase().includes(searchText)) || (task.site && task.site.toLowerCase().includes(searchText)) || (task.group && task.group.toLowerCase().includes(searchText)) || (task.date && task.date.toLowerCase().includes(searchText))); }); renderTaskHistoryTable(filteredHistory); }
function handleReportingSearch() {
    const userSiteString = currentApprover.Site || '';
    const userSites = userSiteString.toLowerCase() === 'all' ? null : userSiteString.split(',').map(s => s.trim());

    const relevantEntries = allSystemEntries.filter(entry => {
        const isMySite = userSites === null || (entry.site && userSites.includes(entry.site));
        const isRelatedToMe = (entry.enteredBy === currentApprover.Name || entry.attention === currentApprover.Name);
        return isMySite || isRelatedToMe;
    });

    filterAndRenderReport(relevantEntries);
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

// --- NEW SETTINGS PAGE FUNCTIONS ---

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

    if (settingsVacationCheckbox.checked) {
        settingsReturnDateContainer.classList.remove('hidden');
    } else {
        settingsReturnDateContainer.classList.add('hidden');
    }
}

async function handleUpdateSettings(e) {
    e.preventDefault();
    if (!currentApprover || !currentApprover.key) {
        settingsMessage.textContent = 'Could not identify user. Please log in again.';
        settingsMessage.className = 'error-message';
        return;
    }

    const updates = {};
    let passwordChanged = false;

    updates.Site = settingsSiteInput.value.trim();
    updates.Vacation = settingsVacationCheckbox.checked;
    updates.DateReturn = settingsVacationCheckbox.checked ? settingsReturnDateInput.value : '';

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

        currentApprover = { ...currentApprover, ...updates };

        settingsMessage.textContent = 'Settings updated successfully!';
        settingsMessage.className = 'success-message';
        settingsPasswordInput.value = '';

        if (passwordChanged) {
            alert('Password changed successfully! You will now be logged out.');
            location.reload();
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
    if (sectionId === 'im-invoice-entry' && invoiceEntryLink.classList.contains('disabled')) {
        alert('You do not have permission to access this section.');
        return;
    }
    if (sectionId === 'im-batch-entry' && batchEntryLink.classList.contains('disabled')) {
        alert('You do not have permission to access this section.');
        return;
    }

    imContentArea.querySelectorAll('.workdesk-section').forEach(section => {
        section.classList.add('hidden');
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    if (sectionId === 'im-dashboard') {
        populateInvoiceDashboard();
    }
    if (sectionId === 'im-invoice-entry') {
        resetInvoiceEntryPage();
        if (imAttentionSelectChoices) {
            populateAttentionDropdown(imAttentionSelectChoices);
        }
    }
     if (sectionId === 'im-batch-entry') {
        document.getElementById('im-batch-table-body').innerHTML = '';
        document.getElementById('im-batch-po-input').value = '';
    }
    if (sectionId === 'im-summary-note') {
        summaryNotePrintArea.classList.add('hidden');
        initializeNoteSuggestions();
    }
    if (sectionId === 'im-reporting') {
        imDailyReportDateInput.value = getTodayDateString();
        imReportingContent.innerHTML = '<p>Click Search to load all data, or enter a term to narrow your results.</p>';
        imReportingSearchInput.value = '';
        currentReportData = [];
    }
}
function resetInvoiceForm() {
    const nextId = imInvEntryIdInput.value;
    imNewInvoiceForm.reset();
    imInvEntryIdInput.value = nextId;
    imReleaseDateInput.value = getTodayDateString();

    if (imAttentionSelectChoices) {
        imAttentionSelectChoices.clearInput();
        imAttentionSelectChoices.removeActiveItems();
    }

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
    resetInvoiceForm();
}
async function handlePOSearch() {
    const poNumber = imPOSearchInput.value.trim().toUpperCase();
    if (!poNumber) {
        alert('Please enter a PO Number.');
        return;
    }
    try {
        const poSnapshot = await db.ref(`purchase_orders/${poNumber}`).once('value');
        const poData = poSnapshot.val();
        if (!poData) {
            alert('PO Number not found in the database.');
            resetInvoiceEntryPage();
            return;
        }

        const isUserRole = currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'user';

        currentPO = poNumber;
        imPONo.textContent = poNumber;
        imPOSite.textContent = poData['Project ID'] || 'N/A';
        imPOValue.textContent = isUserRole ? '---' : (poData.Amount ? `QAR ${formatCurrency(poData.Amount)}` : 'N/A');
        imPOVendor.textContent = poData['Supplier Name'] || 'N/A';
        imPODetailsContainer.classList.remove('hidden');
        await fetchAndDisplayInvoices(poNumber);
    } catch (error) {
        console.error("Error searching for PO:", error);
        alert('An error occurred while searching for the PO.');
    }
}
async function fetchAndDisplayInvoices(poNumber) {
    const invoicesRef = db.ref(`invoice_entries/${poNumber}`);
    const invoiceSnapshot = await invoicesRef.once('value');
    const invoicesData = invoiceSnapshot.val();
    let invoiceCount = 0;
    imInvoicesTableBody.innerHTML = '';
    currentPOInvoices = invoicesData || {};
    
    const isUserRole = currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'user';

    if (invoicesData) {
        const invoices = Object.entries(invoicesData).map(([key, value]) => ({ key, ...value }));
        invoiceCount = invoices.length;
        invoices.sort((a, b) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        invoices.forEach(inv => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.setAttribute('data-key', inv.key);
            const normalizedReleaseDate = normalizeDateForInput(inv.releaseDate);
            const releaseDateDisplay = normalizedReleaseDate ? new Date(normalizedReleaseDate + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            const normalizedInvoiceDate = normalizeDateForInput(inv.invoiceDate);
            const invoiceDateDisplay = normalizedInvoiceDate ? new Date(normalizedInvoiceDate + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            
            const invValueDisplay = isUserRole ? '---' : formatCurrency(inv.invValue);
            const amountPaidDisplay = isUserRole ? '---' : formatCurrency(inv.amountPaid);

            row.innerHTML = `
                <td>${inv.invEntryID || ''}</td>
                <td>${inv.invNumber || ''}</td>
                <td>${invoiceDateDisplay}</td>
                <td>${invValueDisplay}</td>
                <td>${amountPaidDisplay}</td>
                <td>${inv.status || ''}</td>
                <td>${releaseDateDisplay}</td>
                <td><button class="delete-btn" data-key="${inv.key}">Delete</button></td>
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

    // NEW: Check for pending data from WorkDesk and pre-fill the form
    if (pendingJobEntryDataForInvoice) {
        if (pendingJobEntryDataForInvoice.amount) {
            imInvValueInput.value = pendingJobEntryDataForInvoice.amount;
            imAmountPaidInput.value = pendingJobEntryDataForInvoice.amount; // Also fill amount paid
        }
        if (pendingJobEntryDataForInvoice.ref) {
            document.getElementById('im-inv-no').value = pendingJobEntryDataForInvoice.ref;
        }
        if (pendingJobEntryDataForInvoice.date) {
            imInvoiceDateInput.value = convertDisplayDateToInput(pendingJobEntryDataForInvoice.date);
        }
        // Clear the state variable so it's not used again
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
    document.getElementById('im-details').value = invData.details || ''; // Populate new field

    if (invData.status === 'With Accounts') {
        imReleaseDateInput.value = normalizeDateForInput(invData.releaseDate);
    } else {
        imReleaseDateInput.value = getTodayDateString();
    }

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
    if (!currentPO) {
        alert('No PO is loaded. Please search for a PO first.');
        return;
    }
    const formData = new FormData(imNewInvoiceForm);
    const invoiceData = Object.fromEntries(formData.entries());
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;
    invoiceData.dateAdded = getTodayDateString(); 
    invoiceData.createdAt = firebase.database.ServerValue.TIMESTAMP;

    // --- Automatic Invoice Name Logic ---
    if (!invoiceData.invName) {
        const site = document.getElementById('im-po-site').textContent;
        const po = document.getElementById('im-po-no').textContent;
        const invId = document.getElementById('im-inv-entry-id').value;
        let vendor = document.getElementById('im-po-vendor').textContent;

        if (vendor.length > 21) {
            vendor = vendor.substring(0, 21);
        }
        invoiceData.invName = `${site}-${po}-${invId}-${vendor}`;
    }
    
    // --- Automatic SRV Name Logic on Create ---
    if (invoiceData.status === 'With Accounts' && !invoiceData.srvName) {
        const poSnapshot = await db.ref(`purchase_orders/${currentPO}`).once('value');
        const poDetails = poSnapshot.val();
        if(poDetails) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}${mm}${dd}`;
            let vendor = poDetails['Supplier Name'] || '';
            if (vendor.length > 21) { vendor = vendor.substring(0, 21); }
            const site = poDetails['Project ID'] || 'N/A';
            invoiceData.srvName = `${formattedDate}-${currentPO}-${site}-${vendor}`;
        }
    }


    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) {
            delete invoiceData[key];
        }
    });

    try {
        await db.ref(`invoice_entries/${currentPO}`).push(invoiceData);
        alert('Invoice added successfully!');

        if (jobEntryToUpdateAfterInvoice) {
            try {
                const updates = {
                    remarks: invoiceData.status,
                    dateResponded: formatDate(new Date())
                };
                await db.ref(`job_entries/${jobEntryToUpdateAfterInvoice}`).update(updates);
                console.log(`Job entry ${jobEntryToUpdateAfterInvoice} updated successfully.`);

                jobEntryToUpdateAfterInvoice = null;
            } catch (updateError) {
                console.error("Error updating the original job entry:", updateError);
                alert("Invoice was added, but failed to update the original active task.");
            }
        }

        await fetchAndDisplayInvoices(currentPO);
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
    let attentionValue = imAttentionSelectChoices.getValue(true);
    invoiceData.attention = (attentionValue === 'None') ? '' : attentionValue;

    if (invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
    }

    // --- NEW SRV NAME LOGIC ON UPDATE ---
    const originalInvoiceData = currentPOInvoices[currentlyEditingInvoiceKey];
    if (invoiceData.status === 'With Accounts' && (!originalInvoiceData || !originalInvoiceData.srvName)) {
        try {
            const poSnapshot = await db.ref(`purchase_orders/${currentPO}`).once('value');
            const poDetails = poSnapshot.val();
            if (poDetails) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const formattedDate = `${yyyy}${mm}${dd}`;

                let vendor = poDetails['Supplier Name'] || '';
                if (vendor.length > 21) {
                    vendor = vendor.substring(0, 21);
                }
                const site = poDetails['Project ID'] || 'N/A';
                
                invoiceData.srvName = `${formattedDate}-${currentPO}-${site}-${vendor}`;
                document.getElementById('im-srv-name').value = invoiceData.srvName;
            }
        } catch (error) {
            console.error("Could not generate SRV Name:", error);
            alert("Warning: Could not automatically generate the SRV Name due to an error.");
        }
    }

    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) {
            delete invoiceData[key];
        }
    });

    try {
        await db.ref(`invoice_entries/${currentPO}/${currentlyEditingInvoiceKey}`).update(invoiceData);
        alert('Invoice updated successfully!');
        await fetchAndDisplayInvoices(currentPO);
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
    const confirmed = confirm("Are you sure you want to delete this invoice entry? This action cannot be undone.");
    if (confirmed) {
        try {
            await db.ref(`invoice_entries/${currentPO}/${key}`).remove();
            alert("Invoice deleted successfully.");
            await fetchAndDisplayInvoices(currentPO);
        } catch (error) {
            console.error("Error deleting invoice:", error);
            alert("Failed to delete the invoice. Please try again.");
        }
    }
}
async function populateInvoiceReporting(searchTerm = '') {
    const isUserRole = currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'user';
    const isAdmin = currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'admin';
    currentReportData = [];
    imReportingContent.innerHTML = '<p>Searching... Please wait.</p>';

    try {
        const [poSnapshot, invoiceSnapshot] = await Promise.all([
            db.ref('purchase_orders').once('value'),
            db.ref('invoice_entries').once('value')
        ]);
        const allPOs = poSnapshot.val() || {};
        const allInvoicesByPO = invoiceSnapshot.val() || {};

        const searchText = searchTerm.toLowerCase();

        const filteredPOs = Object.keys(allPOs).filter(poNumber => {
            if (!searchText) return true;
            const po = allPOs[poNumber];
            return poNumber.toLowerCase().includes(searchText) ||
                (po['Project ID'] && po['Project ID'].toLowerCase().includes(searchText)) ||
                (po['Supplier Name'] && po['Supplier Name'].toLowerCase().includes(searchText));
        });

        if (filteredPOs.length === 0) {
            imReportingContent.innerHTML = '<p>No results found for your search.</p>';
            return;
        }

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>PO</th>
                        <th>Site</th>
                        <th>Vendor</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let resultsFound = false;

        for (const poNumber of filteredPOs) {
            const poDetails = allPOs[poNumber] || {};
            let invoices = allInvoicesByPO[poNumber] ? Object.values(allInvoicesByPO[poNumber]) : [];

            if (invoices.length === 0) continue;

            resultsFound = true;

            let allInvoicesCompleted = invoices.length > 0;
            const completedStatuses = ['CEO Approval', 'With Accounts'];

            const poDataForCSV = {
                poNumber: poNumber,
                site: poDetails['Project ID'] || 'N/A',
                vendor: poDetails['Supplier Name'] || 'N/A',
                poValue: poDetails.Amount || '0',
                invoices: []
            };

            const detailRowId = `detail-${poNumber}`;

            let totalInvValue = 0;
            let totalAmountPaid = 0;
            let nestedTableRows = '';

            invoices.forEach(inv => {
                if (!completedStatuses.includes(inv.status)) {
                    allInvoicesCompleted = false;
                }

                const invValue = parseFloat(inv.invValue) || 0;
                const amountPaid = parseFloat(inv.amountPaid) || 0;
                totalInvValue += invValue;
                totalAmountPaid += amountPaid;
                const normalizedReleaseDate = normalizeDateForInput(inv.releaseDate);
                const releaseDateDisplay = normalizedReleaseDate ? new Date(normalizedReleaseDate + 'T00:00:00').toLocaleDateString('en-GB') : '';
                const normalizedInvoiceDate = normalizeDateForInput(inv.invoiceDate);
                const invoiceDateDisplay = normalizedInvoiceDate ? new Date(normalizedInvoiceDate + 'T00:00:00').toLocaleDateString('en-GB') : '';

                const invValueDisplay = isUserRole ? '---' : formatCurrency(invValue);
                const amountPaidDisplay = isUserRole ? '---' : formatCurrency(amountPaid);
                
                let actionButtonsHTML = '';
                if (isAdmin) {
                    const invPDF = inv.invName ? `<a href="${PDF_BASE_PATH}${encodeURIComponent(inv.invName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn">Invoice</a>` : '';
                    const srvPDF = inv.srvName ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(inv.srvName)}.pdf" target="_blank" class="action-btn srv-pdf-btn">SRV</a>` : '';
                    if (invPDF || srvPDF) {
                       actionButtonsHTML = `<div class="action-btn-group">${invPDF} ${srvPDF}</div>`;
                    }
                }

                nestedTableRows += `
                    <tr>
                        <td>${inv.invEntryID || ''}</td>
                        <td>${inv.invNumber || ''}</td>
                        <td>${invoiceDateDisplay}</td>
                        <td>${invValueDisplay}</td>
                        <td>${amountPaidDisplay}</td>
                        <td>${releaseDateDisplay}</td>
                        <td>${inv.status || ''}</td>
                        <td>${inv.note || ''}</td>
                        <td>${actionButtonsHTML}</td>
                    </tr>
                `;
                poDataForCSV.invoices.push({ ...inv, invoiceDateDisplay, releaseDateDisplay });
            });
            currentReportData.push(poDataForCSV);

            const totalInvValueDisplay = isUserRole ? '---' : `<strong>QAR ${formatCurrency(totalInvValue)}</strong>`;
            const totalAmountPaidDisplay = isUserRole ? '---' : `<strong>QAR ${formatCurrency(totalAmountPaid)}</strong>`;
            const poValueDisplay = isUserRole ? '---' : (poDetails.Amount ? `QAR ${formatCurrency(poDetails.Amount)}` : 'N/A');
            const highlightClass = allInvoicesCompleted ? 'highlight-complete' : '';

            tableHTML += `
                <tr class="master-row ${highlightClass}" data-target="#${detailRowId}">
                    <td><button class="expand-btn">+</button></td>
                    <td>${poNumber}</td>
                    <td>${poDataForCSV.site}</td>
                    <td>${poDataForCSV.vendor}</td>
                    <td>${poValueDisplay}</td>
                </tr>
            `;

            tableHTML += `
                <tr id="${detailRowId}" class="detail-row hidden">
                    <td colspan="5">
                        <div class="detail-content">
                            <h4>Invoice Entries for PO ${poNumber}</h4>
                            <table class="nested-invoice-table">
                                <thead>
                                    <tr>
                                        <th>Inv. Entry</th>
                                        <th>Inv. No.</th>
                                        <th>Inv. Date</th>
                                        <th>Inv. Value</th>
                                        <th>Amount Paid</th>
                                        <th>Release Date</th>
                                        <th>Status</th>
                                        <th>Note</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${nestedTableRows}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3" style="text-align: right;"><strong>TOTAL</strong></td>
                                        <td>${totalInvValueDisplay}</td>
                                        <td>${totalAmountPaidDisplay}</td>
                                        <td colspan="4"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </td>
                </tr>
            `;
        }

        tableHTML += `</tbody></table>`;

        if (!resultsFound) {
            imReportingContent.innerHTML = '<p>No results found for your search criteria.</p>';
        } else {
            imReportingContent.innerHTML = tableHTML;
        }

    } catch (error) {
        console.error("Error generating invoice report:", error);
        imReportingContent.innerHTML = '<p>An error occurred while generating the report.</p>';
    }
}
async function handleDownloadCSV() {
    if (currentReportData.length === 0) {
        alert("No data to download. Please perform a search to generate a report first.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["PO", "Site", "Vendor", "PO Value", "invEntryID", "invNumber", "invoiceDate", "invValue", "amountPaid", "invName", "srvName", "attention", "releaseDate", "status", "note"];
    csvContent += headers.join(",") + "\r\n";

    currentReportData.forEach(po => {
        po.invoices.forEach(inv => {
            const row = [
                po.poNumber,
                po.site,
                `"${(po.vendor || '').replace(/"/g, '""')}"`,
                po.poValue,
                inv.invEntryID || '',
                `"${(inv.invNumber || '').replace(/"/g, '""')}"`,
                inv.invoiceDate || '',
                inv.invValue || '0',
                inv.amountPaid || '0',
                `"${(inv.invName || '').replace(/"/g, '""')}"`,
                `"${(inv.srvName || '').replace(/"/g, '""')}"`,
                inv.attention || '',
                inv.releaseDate || '',
                inv.status || '',
                `"${(inv.note || '').replace(/"/g, '""')}"`
            ];
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

// --- INVOICE DASHBOARD FUNCTION ---
async function populateInvoiceDashboard() {
    const totalPOCountEl = document.getElementById('im-total-po-count');
    const totalInvoiceCountEl = document.getElementById('im-total-invoice-count');
    const poPendingCountEl = document.getElementById('im-po-pending-invoice-count');
    const recentInvoicesBody = document.getElementById('im-recent-invoices-body');
    const statusGridEl = document.getElementById('im-status-grid');

    const isUserRole = currentApprover && currentApprover.Role && currentApprover.Role.toLowerCase() === 'user';

    try {
        const [poSnapshot, invoiceSnapshot] = await Promise.all([
            db.ref('purchase_orders').once('value'),
            db.ref('invoice_entries').once('value')
        ]);
        const allPOs = poSnapshot.val() || {};
        const allInvoicesByPO = invoiceSnapshot.val() || {};

        let totalPOCount2025 = 0;
        let totalInvoiceCount2025 = 0;
        let poWithInvoice2025 = new Set();
        const allTimeStatusCounts = {};
        const recentInvoices = [];

        for (const poNumber in allPOs) {
            if (poNumber.startsWith('5') || (allPOs[poNumber] && allPOs[poNumber].date && allPOs[poNumber].date.startsWith('2025'))) {
                 totalPOCount2025++;
            }
        }
        
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                const is2025 = (inv.invoiceDate && inv.invoiceDate.startsWith('2025')) || (inv.releaseDate && inv.releaseDate.startsWith('2025'));
                
                if (is2025) {
                    totalInvoiceCount2025++;
                    poWithInvoice2025.add(poNumber);

                     const releaseDateStr = normalizeDateForInput(inv.releaseDate);
                     recentInvoices.push({
                        po: poNumber,
                        vendor: allPOs[poNumber]?.['Supplier Name'] || 'N/A',
                        value: inv.invValue,
                        status: inv.status || 'N/A',
                        releaseDate: releaseDateStr ? new Date(releaseDateStr) : null,
                        releaseDateDisplay: releaseDateStr ? new Date(releaseDateStr).toLocaleDateString('en-GB') : 'N/A'
                    });
                }
                const status = inv.status || 'Pending';
                allTimeStatusCounts[status] = (allTimeStatusCounts[status] || 0) + 1;
            }
        }

        totalPOCountEl.textContent = totalPOCount2025;
        totalInvoiceCountEl.textContent = totalInvoiceCount2025;
        poPendingCountEl.textContent = totalPOCount2025 - poWithInvoice2025.size;

        recentInvoices.sort((a, b) => (b.releaseDate || 0) - (a.releaseDate || 0));
        recentInvoicesBody.innerHTML = '';
        if (recentInvoices.length > 0) {
            recentInvoices.slice(0, 5).forEach(inv => {
                const row = document.createElement('tr');
                const invValueDisplay = isUserRole ? '---' : `QAR ${formatCurrency(inv.value)}`;
                row.innerHTML = `
                    <td>${inv.po}</td>
                    <td>${inv.vendor}</td>
                    <td>${invValueDisplay}</td>
                    <td>${inv.status}</td>
                    <td>${inv.releaseDateDisplay}</td>
                `;
                recentInvoicesBody.appendChild(row);
            });
        } else {
             recentInvoicesBody.innerHTML = '<tr><td colspan="5">No invoice activity found for 2025.</td></tr>';
        }

        const statusColors = { "For SRV": "#17a2b8", "Pending": "#ffc107", "For IPC": "#fd7e14", "Under Review": "#6f42c1", "CEO Approval": "#007bff", "With Accounts": "#28a745" };
        const chartLabels = Object.keys(allTimeStatusCounts).sort(); 
        const chartData = chartLabels.map(label => allTimeStatusCounts[label]);
        const chartColors = chartLabels.map(label => statusColors[label] || '#6c757d');

        statusGridEl.innerHTML = '';
        chartLabels.forEach(label => {
            const card = document.createElement('div');
            card.className = 'im-status-card';
            card.style.borderColor = statusColors[label] || '#6c757d';
            card.innerHTML = `
                <div class="card-value">${allTimeStatusCounts[label]}</div>
                <div class="card-label">${label}</div>
            `;
            statusGridEl.appendChild(card);
        });

        const ctx = document.getElementById('im-bar-chart').getContext('2d');
        if (imBarChart) imBarChart.destroy();
        
        imBarChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Invoice Count',
                    data: chartData,
                    backgroundColor: chartColors,
                    borderColor: '#f8f9fa',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });

    } catch (error) {
        console.error("Error populating Invoice Dashboard:", error);
    }
}


async function handleDownloadDailyReport() {
    const selectedDate = imDailyReportDateInput.value;
    if (!selectedDate) {
        alert("Please select a date to generate the report.");
        return;
    }

    try {
        const invoiceSnapshot = await db.ref('invoice_entries').once('value');
        const allInvoicesByPO = invoiceSnapshot.val() || {};
        const poSnapshot = await db.ref('purchase_orders').once('value');
        const allPOs = poSnapshot.val() || {};

        const dailyEntries = [];

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                if (inv.dateAdded === selectedDate) {
                    dailyEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?.['Project ID'] || 'N/A',
                        vendor: allPOs[poNumber]?.['Supplier Name'] || 'N/A',
                        ...inv
                    });
                }
            }
        }

        if (dailyEntries.length === 0) {
            alert(`No new invoices were entered on ${selectedDate}.`);
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["PO", "Site", "Vendor", "invEntryID", "invNumber", "invoiceDate", "invValue", "amountPaid", "invName", "srvName", "attention", "releaseDate", "status", "note", "dateAdded"];
        csvContent += headers.join(",") + "\r\n";

        dailyEntries.forEach(entry => {
            const row = [
                entry.po,
                entry.site,
                `"${(entry.vendor || '').replace(/"/g, '""')}"`,
                entry.invEntryID || '',
                `"${(entry.invNumber || '').replace(/"/g, '""')}"`,
                entry.invoiceDate || '',
                entry.invValue || '0',
                entry.amountPaid || '0',
                `"${(entry.invName || '').replace(/"/g, '""')}"`,
                `"${(entry.srvName || '').replace(/"/g, '""')}"`,
                entry.attention || '',
                entry.releaseDate || '',
                entry.status || '',
                `"${(entry.note || '').replace(/"/g, '""')}"`,
                entry.dateAdded || ''
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `daily_invoice_entry_report_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating daily report:", error);
        alert("An error occurred while generating the daily report.");
    }
}

// --- NEW BATCH INVOICE FUNCTIONS ---

async function populateApproverSelect(selectElement) {
    if (approverListForSelect.length === 0) {
        try {
            const snapshot = await db.ref('approvers').once('value');
            const approvers = snapshot.val();
            if (approvers) {
                const approverOptions = Object.values(approvers)
                    .map(approver => approver.Name ? { value: approver.Name, label: approver.Name } : null)
                    .filter(Boolean)
                    .sort((a, b) => a.label.localeCompare(b.label)); 
                approverListForSelect = [
                    { value: '', label: 'Select Attention' },
                    { value: 'None', label: 'None (Clear)' },
                    ...approverOptions
                ];
            }
        } catch (error) {
            console.error("Error fetching approvers for select:", error);
        }
    }
    
    selectElement.innerHTML = '';
    approverListForSelect.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        selectElement.appendChild(option);
    });
}

async function handleAddPOToBatch() {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const poNumber = batchPOInput.value.trim().toUpperCase();
    if (!poNumber) return;

    const batchTableBody = document.getElementById('im-batch-table-body');
    const existingRows = batchTableBody.querySelectorAll(`tr[data-po="${poNumber}"]`);
    if (existingRows.length > 0) {
        alert(`PO ${poNumber} is already in the batch list.`);
        return;
    }

    try {
        const poSnapshot = await db.ref(`purchase_orders/${poNumber}`).once('value');
        const poData = poSnapshot.val();
        if (!poData) {
            alert(`PO Number ${poNumber} not found.`);
            return;
        }

        const invoiceSnapshot = await db.ref(`invoice_entries/${poNumber}`).once('value');
        const invoiceCount = invoiceSnapshot.exists() ? Object.keys(invoiceSnapshot.val()).length : 0;
        const nextInvId = `INV-${String(invoiceCount + 1).padStart(2, '0')}`;
        
        const site = poData['Project ID'] || 'N/A';
        const vendor = poData['Supplier Name'] || 'N/A';

        const row = document.createElement('tr');
        row.setAttribute('data-po', poNumber);
        row.setAttribute('data-site', site);
        row.setAttribute('data-vendor', vendor);
        row.setAttribute('data-next-invid', nextInvId);

        row.innerHTML = `
            <td>${poNumber}</td>
            <td>${site}</td>
            <td>${vendor}</td>
            <td><input type="text" name="invNumber" class="batch-input"></td>
            <td><input type="text" name="details" class="batch-input"></td>
            <td><input type="date" name="invoiceDate" class="batch-input"></td>
            <td><input type="number" name="invValue" class="batch-input" step="0.01"></td>
            <td><input type="number" name="amountPaid" class="batch-input" step="0.01" value="0"></td>
            <td><select name="attention" class="batch-input"></select></td>
            <td>
                <select name="status" class="batch-input">
                    <option value="For SRV">For SRV</option>
                    <option value="Pending">Pending</option>
                    <option value="For IPC">For IPC</option>
                    <option value="Under Review">Under Review</option>
                    <option value="CEO Approval">CEO Approval</option>
                    <option value="With Accounts">With Accounts</option>
                </select>
            </td>
            <td><input type="text" name="note" class="batch-input"></td>
            <td><button type="button" class="delete-btn batch-remove-btn">&times;</button></td>
        `;
        
        batchTableBody.appendChild(row);
        
        const attentionSelect = row.querySelector('select[name="attention"]');
        await populateApproverSelect(attentionSelect);

        batchPOInput.value = '';
        batchPOInput.focus();

    } catch (error) {
        console.error("Error adding PO to batch:", error);
        alert('An error occurred while adding the PO.');
    }
}

async function handleSaveBatchInvoices() {
    const batchTableBody = document.getElementById('im-batch-table-body');
    const rows = batchTableBody.querySelectorAll('tr');

    if (rows.length === 0) {
        alert("There are no invoices to save.");
        return;
    }

    const confirmed = confirm(`Are you sure you want to save ${rows.length} new invoice(s)?`);
    if (!confirmed) return;

    const invoicePromises = [];

    for (const row of rows) {
        const poNumber = row.dataset.po;
        const site = row.dataset.site;
        let vendor = row.dataset.vendor;

        const invoiceData = {
            invEntryID: row.dataset.nextInvid,
            invNumber: row.querySelector('[name="invNumber"]').value,
            details: row.querySelector('[name="details"]').value,
            invoiceDate: row.querySelector('[name="invoiceDate"]').value,
            invValue: row.querySelector('[name="invValue"]').value,
            amountPaid: row.querySelector('[name="amountPaid"]').value,
            attention: row.querySelector('[name="attention"]').value,
            status: row.querySelector('[name="status"]').value,
            note: row.querySelector('[name="note"]').value,
            releaseDate: getTodayDateString(), // Auto-set release date
            dateAdded: getTodayDateString(),
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        if (invoiceData.attention === 'None') invoiceData.attention = '';
        if (invoiceData.status === 'With Accounts') invoiceData.attention = '';
        if (!invoiceData.invValue) {
            alert(`Invoice Value is required for PO ${poNumber}.`);
            return;
        }

        if (vendor.length > 21) {
            vendor = vendor.substring(0, 21);
        }
        invoiceData.invName = `${site}-${poNumber}-${invoiceData.invEntryID}-${vendor}`;

        if (invoiceData.status === 'With Accounts') {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}${mm}${dd}`;
            invoiceData.srvName = `${formattedDate}-${poNumber}-${site}-${vendor}`;
        }
        
        const promise = db.ref(`invoice_entries/${poNumber}`).push(invoiceData);
        invoicePromises.push(promise);
    }

    try {
        await Promise.all(invoicePromises);
        alert(`${rows.length} invoice(s) saved successfully!`);
        batchTableBody.innerHTML = '';
    } catch (error) {
        console.error("Error saving batch invoices:", error);
        alert("An error occurred while saving the invoices. Please check the data and try again.");
    }
}

// --- SUMMARY NOTE FUNCTIONS ---
async function initializeNoteSuggestions() {
    if (allUniqueNotes.size > 0) return; // Already initialized

    try {
        const snapshot = await db.ref('invoice_entries').once('value');
        const allInvoices = snapshot.val();
        if (allInvoices) {
            for (const po in allInvoices) {
                for (const invKey in allInvoices[po]) {
                    const invoice = allInvoices[po][invKey];
                    if (invoice.note) {
                        allUniqueNotes.add(invoice.note);
                    }
                }
            }
        }
        
        noteSuggestionsDatalist.innerHTML = '';
        allUniqueNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });

    } catch (error) {
        console.error("Error initializing note suggestions:", error);
    }
}

async function handleGenerateSummary() {
    const prevNote = summaryNotePreviousInput.value.trim();
    const currentNote = summaryNoteCurrentInput.value.trim();

    if (!currentNote) {
        alert("Please enter a note for the 'Current Note' search.");
        return;
    }

    summaryNoteGenerateBtn.textContent = 'Generating...';
    summaryNoteGenerateBtn.disabled = true;

    try {
        const [invoiceSnapshot, poSnapshot] = await Promise.all([
            db.ref('invoice_entries').once('value'),
            db.ref('purchase_orders').once('value')
        ]);
        const allInvoicesByPO = invoiceSnapshot.val() || {};
        const allPOs = poSnapshot.val() || {};
        
        let previousPaymentTotal = 0;
        let currentPaymentTotal = 0;
        let allCurrentInvoices = [];
        
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];
                if (inv.note) {
                    if (prevNote && inv.note === prevNote) {
                        previousPaymentTotal += parseFloat(inv.invValue) || 0;
                    }
                    if (inv.note === currentNote) {
                        const site = (allPOs[poNumber] && allPOs[poNumber]['Project ID']) ? allPOs[poNumber]['Project ID'] : 'N/A';
                        currentPaymentTotal += parseFloat(inv.invValue) || 0;
                        allCurrentInvoices.push({ po: poNumber, key: key, site: site, ...inv });
                    }
                }
            }
        }
        
        if (allCurrentInvoices.length === 0) {
            alert(`No invoices found with the note: "${currentNote}"`);
            summaryNotePrintArea.classList.add('hidden');
            return;
        }

        // Sort by Billing Site
        allCurrentInvoices.sort((a, b) => (a.site || '').localeCompare(b.site || ''));

        const firstPO = allCurrentInvoices[0].po;
        const vendorData = allPOs[firstPO];
        snVendorName.textContent = vendorData ? vendorData['Supplier Name'] : 'N/A';
        
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        snDate.textContent = `Date: ${today.toLocaleDateString('en-GB', options).replace(/ /g, '-')}`;

        snPreviousPayment.textContent = `${formatCurrency(previousPaymentTotal)} Qatari Riyals`;
        snCurrentPayment.textContent = `${formatCurrency(currentPaymentTotal)} Qatari Riyals`;

        snTableBody.innerHTML = '';
        
        for (const inv of allCurrentInvoices) {
            const row = document.createElement('tr');
            row.setAttribute('data-po', inv.po);
            row.setAttribute('data-key', inv.key);
            row.innerHTML = `
                <td>${inv.invEntryID || '1st'}</td>
                <td>${inv.po}</td>
                <td>${inv.site}</td>
                <td><input type="text" class="summary-edit-input" name="details" value="${inv.details || ''}"></td>
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

async function handleUpdateSummaryChanges() {
    const rows = snTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("No data to update.");
        return;
    }

    const confirmed = confirm("Are you sure you want to save the changes to Bill Description and Bill Date for all visible entries?");
    if (!confirmed) return;
    
    summaryNoteUpdateBtn.textContent = "Updating...";
    summaryNoteUpdateBtn.disabled = true;

    const updatePromises = [];
    try {
        rows.forEach(row => {
            const poNumber = row.dataset.po;
            const invoiceKey = row.dataset.key;
            
            const newDetails = row.querySelector('input[name="details"]').value;
            const newInvoiceDate = row.querySelector('input[name="invoiceDate"]').value;

            if (poNumber && invoiceKey) {
                const updates = {
                    details: newDetails,
                    invoiceDate: newInvoiceDate
                };
                const promise = db.ref(`invoice_entries/${poNumber}/${invoiceKey}`).update(updates);
                updatePromises.push(promise);
            }
        });

        await Promise.all(updatePromises);
        alert("Changes saved successfully!");

    } catch (error) {
        console.error("Error updating summary changes:", error);
        alert("An error occurred while saving the changes.");
    } finally {
        summaryNoteUpdateBtn.textContent = "Update Changes";
        summaryNoteUpdateBtn.disabled = false;
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    showView('login');
    loginForm.addEventListener('submit', async (e) => { e.preventDefault(); loginError.textContent = ''; const identifier = loginIdentifierInput.value.trim(); try { const approver = await findApprover(identifier); if (!approver) { loginError.textContent = 'Access denied. Your email or mobile is not registered as an approver.'; return; } currentApprover = approver; if (!currentApprover.Password || currentApprover.Password === '') { const isEmailMissing = !currentApprover.Email; const isSiteMissing = !currentApprover.Site; const isPositionMissing = !currentApprover.Position; setupEmailContainer.classList.toggle('hidden', !isEmailMissing); setupSiteContainer.classList.toggle('hidden', !isSiteMissing); setupPositionContainer.classList.toggle('hidden', !isPositionMissing); setupEmailInput.required = isEmailMissing; setupSiteInput.required = isSiteMissing; setupPositionInput.required = isPositionMissing; showView('setup'); setupPasswordInput.focus(); } else { passwordUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile; showView('password'); passwordInput.focus(); } } catch (error) { console.error("Error checking approver:", error); loginError.textContent = 'An error occurred. Please try again.'; } });
    setupForm.addEventListener('submit', async (e) => { e.preventDefault(); setupError.textContent = ''; const newPassword = setupPasswordInput.value; const finalEmail = currentApprover.Email || setupEmailInput.value.trim(); const finalSite = currentApprover.Site || setupSiteInput.value.trim(); const finalPosition = currentApprover.Position || setupPositionInput.value.trim(); if (!finalEmail.toLowerCase().endsWith('@iba.com.qa')) { setupError.textContent = 'Invalid email. Only @iba.com.qa addresses are allowed.'; return; } if (newPassword.length < 6) { setupError.textContent = 'Password must be at least 6 characters long.'; return; } try { const updates = { Password: newPassword, Email: finalEmail, Site: finalSite, Position: finalPosition }; await db.ref(`approvers/${currentApprover.key}`).update(updates); currentApprover = { ...currentApprover, ...updates }; handleSuccessfulLogin(); } catch (error) { console.error("Error during setup:", error); setupError.textContent = 'An error occurred while saving. Please try again.'; } });
    passwordForm.addEventListener('submit', (e) => { e.preventDefault(); passwordError.textContent = ''; const enteredPassword = passwordInput.value; if (enteredPassword === currentApprover.Password) { handleSuccessfulLogin(); } else { passwordError.textContent = 'Incorrect password. Please try again.'; passwordInput.value = ''; } });
    function handleLogout() { if (dateTimeInterval) clearInterval(dateTimeInterval); if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval); if (imDateTimeInterval) clearInterval(imDateTimeInterval); location.reload(); }
    logoutButton.addEventListener('click', handleLogout);
    wdLogoutButton.addEventListener('click', handleLogout);

    workdeskButton.addEventListener('click', () => {
        wdUsername.textContent = currentApprover.Name || 'User';
        wdUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;
        if (!siteSelectChoices) {
            siteSelectChoices = new Choices(document.getElementById('job-site'), { searchEnabled: true, shouldSort: false, itemSelectText: '', });
            populateSiteDropdown();
        }
        if (!attentionSelectChoices) {
            attentionSelectChoices = new Choices(document.getElementById('job-attention'), { searchEnabled: true, shouldSort: false, itemSelectText: '', });
            populateAttentionDropdown(attentionSelectChoices);
        }
        updateWorkdeskDateTime();
        if (workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
        workdeskDateTimeInterval = setInterval(updateWorkdeskDateTime, 1000);
        showView('workdesk');
        showWorkdeskSection('wd-dashboard');
    });

    document.querySelector('#workdesk-view .workdesk-sidebar').addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link || link.classList.contains('back-to-main-dashboard')) return;
        if (link.id === 'wd-logout-button') return;

        e.preventDefault();

        if (link.hasAttribute('data-section')) {
            const allNavLinks = document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a');
            allNavLinks.forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            const sectionId = link.getAttribute('data-section');
            showWorkdeskSection(sectionId);
        }
    });

    addJobButton.addEventListener('click', handleAddJobEntry);
    updateJobButton.addEventListener('click', handleUpdateJobEntry);
    clearJobButton.addEventListener('click', (e) => resetJobEntryForm(false));
    jobEntryTableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const key = row.getAttribute('data-key');
        const entry = allSystemEntries.find(item => item.key === key);
        if (key && entry && entry.source !== 'invoice') {
            populateFormForEditing(key);
        }
    });

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
        if (task && task.source === 'invoice' && task.invName) {
            const pdfUrl = PDF_BASE_PATH + encodeURIComponent(task.invName) + ".pdf";
            window.open(pdfUrl, '_blank');
        }
    });

    jobForSelect.addEventListener('change', (e) => {
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
        if (e.target.value === 'IPC' && isQS) {
            attentionSelectChoices.clearStore();
            attentionSelectChoices.setChoices([{ value: 'All', label: 'All', selected: true }], 'value', 'label', false);
            attentionSelectChoices.disable();
        } else {
            if (attentionSelectChoices.disabled) {
                attentionSelectChoices.enable();
                resetJobEntryForm(true);
            }
        }
    });
    activeTaskSearchInput.addEventListener('input', (e) => handleActiveTaskSearch(e.target.value));
    taskHistorySearchInput.addEventListener('input', (e) => handleTaskHistorySearch(e.target.value));
    reportingSearchInput.addEventListener('input', handleReportingSearch);
    printReportButton.addEventListener('click', () => window.print());
    downloadWdReportButton.addEventListener('click', handleDownloadWorkdeskCSV);
    reportTabsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            reportTabsContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentReportFilter = e.target.getAttribute('data-job-type');
            handleReportingSearch();
        }
    });
    document.querySelectorAll('.back-to-main-dashboard').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            showView('dashboard');
        });
    });

    // +++ INVOICE MANAGEMENT LISTENERS +++
    invoiceManagementButton.addEventListener('click', () => {
        imUsername.textContent = currentApprover.Name || 'User';
        imUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile;

        if (imAttentionSelectChoices) {
            imAttentionSelectChoices.destroy();
        }
        imAttentionSelectChoices = new Choices(imAttentionSelect, {
            searchEnabled: true, shouldSort: false, itemSelectText: '',
        });
        populateAttentionDropdown(imAttentionSelectChoices);

        const invoiceEntryLink = imNav.querySelector('a[data-section="im-invoice-entry"]');
        const batchEntryLink = document.getElementById('batch-entry-nav-link');
        const isAccounting = currentApprover.Position && currentApprover.Position.toLowerCase() === 'accounting';
        const isAdmin = currentApprover.Role && currentApprover.Role.toLowerCase() === 'admin';

        if (isAccounting || isAdmin) {
            invoiceEntryLink.classList.remove('disabled');
            if(batchEntryLink) batchEntryLink.classList.remove('disabled');
        } else {
            invoiceEntryLink.classList.add('disabled');
            if(batchEntryLink) batchEntryLink.classList.add('disabled');
        }

        updateIMDateTime();
        if (imDateTimeInterval) clearInterval(imDateTimeInterval);
        imDateTimeInterval = setInterval(updateIMDateTime, 1000);
        showView('invoice-management');
        showIMSection('im-dashboard');
        imNav.querySelector('a.active').classList.remove('active');
        imNav.querySelector('a[data-section="im-dashboard"]').classList.add('active');
    });

    imNav.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        e.preventDefault();
        if (link.classList.contains('disabled')) return;
        const sectionId = link.getAttribute('data-section');
        if (sectionId) {
            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            showIMSection(sectionId);
        }
    });

    imLogoutButton.addEventListener('click', handleLogout);
    imPOSearchButton.addEventListener('click', handlePOSearch);
    imPOSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePOSearch();
        }
    });
    imAddInvoiceButton.addEventListener('click', handleAddInvoice);
    imUpdateInvoiceButton.addEventListener('click', handleUpdateInvoice);
    imClearFormButton.addEventListener('click', () => {
        if (currentPO) {
            resetInvoiceForm();
        } else {
            resetInvoiceEntryPage();
        }
    });
    imInvoicesTableBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const key = deleteBtn.getAttribute('data-key');
            if (key) {
                handleDeleteInvoice(key);
            }
            return;
        }

        const row = e.target.closest('tr');
        if (!row) return;
        const key = row.getAttribute('data-key');
        if (key) {
            populateInvoiceFormForEditing(key);
        }
    });

    imReportingContent.addEventListener('click', (e) => {
        const expandBtn = e.target.closest('.expand-btn');
        if (!expandBtn) return;

        const masterRow = expandBtn.closest('.master-row');
        const targetId = masterRow.dataset.target;
        const detailRow = document.querySelector(targetId);

        if (detailRow) {
            const isHidden = detailRow.classList.contains('hidden');
            if (isHidden) {
                detailRow.classList.remove('hidden');
                expandBtn.textContent = '−';
            } else {
                detailRow.classList.add('hidden');
                expandBtn.textContent = '+';
            }
        }
    });

    imReportingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = imReportingSearchInput.value.trim();
        populateInvoiceReporting(searchTerm);
    });

    imReportingClearButton.addEventListener('click', () => {
        imReportingSearchInput.value = '';
        imReportingContent.innerHTML = '<p>Click Search to load all data, or enter a term to narrow your results.</p>';
        currentReportData = [];
    });

    imReportingDownloadCSVButton.addEventListener('click', handleDownloadCSV);
    imDownloadDailyReportButton.addEventListener('click', handleDownloadDailyReport);
    
    imStatusSelect.addEventListener('change', (e) => {
        if (e.target.value === 'CEO Approval') {
            if (imAttentionSelectChoices) {
                imAttentionSelectChoices.setChoiceByValue('Mr. Hamad');
            }
        }
    });
    
    imInvValueInput.addEventListener('input', (e) => {
        imAmountPaidInput.value = e.target.value;
    });

    settingsForm.addEventListener('submit', handleUpdateSettings);

    settingsVacationCheckbox.addEventListener('change', () => {
        if (settingsVacationCheckbox.checked) {
            settingsReturnDateContainer.classList.remove('hidden');
        } else {
            settingsReturnDateContainer.classList.add('hidden');
            settingsReturnDateInput.value = ''; // Clear date when unchecked
        }
    });

    // +++ BATCH INVOICE LISTENERS +++
    const batchAddBtn = document.getElementById('im-batch-add-po-button');
    const batchSaveBtn = document.getElementById('im-batch-save-button');
    const batchTableBody = document.getElementById('im-batch-table-body');
    const batchPOInput = document.getElementById('im-batch-po-input');

    if (batchAddBtn) batchAddBtn.addEventListener('click', handleAddPOToBatch);
    if (batchSaveBtn) batchSaveBtn.addEventListener('click', handleSaveBatchInvoices);
    if (batchPOInput) batchPOInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAddPOToBatch(); }
    });
    if (batchTableBody) {
        batchTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('batch-remove-btn')) {
                e.target.closest('tr').remove();
            }
        });
        batchTableBody.addEventListener('input', (e) => {
            if (e.target.getAttribute('name') === 'invValue') {
                const row = e.target.closest('tr');
                if (row) {
                    const amountPaidInput = row.querySelector('[name="amountPaid"]');
                    if (amountPaidInput) amountPaidInput.value = e.target.value;
                }
            }
        });
    }

    // +++ SUMMARY NOTE LISTENERS +++
    if(summaryNoteGenerateBtn) summaryNoteGenerateBtn.addEventListener('click', handleGenerateSummary);
    if(summaryNoteUpdateBtn) summaryNoteUpdateBtn.addEventListener('click', handleUpdateSummaryChanges);
    if(summaryNotePrintBtn) summaryNotePrintBtn.addEventListener('click', () => window.print());

});