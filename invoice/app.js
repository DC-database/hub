// --- 1. FIREBASE CONFIGURATION & 2. INITIALIZE FIREBASE ---
const firebaseConfig = { apiKey: "AIzaSyBH3MgLP2wEdxaSWaGK0r8MN0f3doR5Z3U", authDomain: "ibainvoice-57cf4.firebaseapp.com", databaseURL: "https://ibainvoice-57cf4-default-rtdb.firebaseio.com", projectId: "ibainvoice-57cf4", storageBucket: "ibainvoice-57cf4.appspot.com", messagingSenderId: "170378572965", appId: "1:170378572965:web:dd29f69279d9ecf858094c", measurementId: "G-LD4B2RBSDV" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- 3. DOM ELEMENT REFERENCES & 4. GLOBAL STATE ---
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
function handleSuccessfulLogin() { dashboardUsername.textContent = `Welcome ${currentApprover.Name || currentApprover.Email}`; updateDashboardDateTime(); if(dateTimeInterval) clearInterval(dateTimeInterval); dateTimeInterval = setInterval(updateDashboardDateTime, 1000); showView('dashboard'); }
function showWorkdeskSection(sectionId) {
    workdeskSections.forEach(section => { section.classList.add('hidden'); });
    const targetSection = document.getElementById(sectionId);
    if(targetSection) { targetSection.classList.remove('hidden'); }
    if (sectionId === 'wd-dashboard') { populateWorkdeskDashboard(); }
    if(sectionId === 'wd-jobentry') { fetchAndDisplayJobEntries(); }
    if (sectionId === 'wd-activetask') { populateActiveTasks(); }
    if (sectionId === 'wd-taskhistory') { populateTaskHistory(); }
    if (sectionId === 'wd-reporting') { populateReporting(); }
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
    console.warn("Unrecognized date format:", dateString);
    return '';
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


// --- WORKDESK LOGIC ---
async function ensureAllEntriesFetched() {
    const [jobEntriesSnapshot, invoiceEntriesSnapshot, poSnapshot] = await Promise.all([
        db.ref('job_entries').orderByChild('timestamp').once('value'),
        db.ref('invoice_entries').once('value'),
        db.ref('purchase_orders').once('value')
    ]);

    const jobEntriesData = jobEntriesSnapshot.val() || {};
    const processedJobEntries = Object.entries(jobEntriesData).map(([key, value]) => ({ 
        key, 
        ...value,
        source: 'job_entry' 
    }));

    const invoiceEntriesData = invoiceEntriesSnapshot.val() || {};
    const purchaseOrdersData = poSnapshot.val() || {};
    const processedInvoiceEntries = [];

    for (const poNumber in invoiceEntriesData) {
        const invoices = invoiceEntriesData[poNumber];
        const site = purchaseOrdersData[poNumber]?.['Project ID'] || 'N/A';

        for (const invoiceKey in invoices) {
            const invoice = invoices[invoiceKey];
            
            if (!invoice.attention || invoice.attention.trim() === '') {
                continue;
            }

            const normalizedDate = normalizeDateForInput(invoice.releaseDate);
            
            const transformedInvoice = {
                key: `${poNumber}_${invoice.invEntryID || invoiceKey}`,
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
        const completedStatuses = ['CEO Approval', 'With Accounts'];
        return completedStatuses.includes(task.remarks);
    }
    
    if (task.for === 'Invoice' && task.source === 'job_entry') { return !!task.dateResponded; }
    if (task.for === 'IPC' && task.attention === 'All') { return true; }
    return (task.amount && task.amount.trim() !== '' && task.po && task.po.trim() !== '');
}

function resetJobEntryForm(keepJobType = false) {
    const jobType = jobForSelect.value;
    jobEntryForm.reset();
    if(keepJobType) jobForSelect.value = jobType;
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
        choicesInstance.setChoices([{ value: '', label: 'Loading...', disabled: true, selected: true }]);
        const snapshot = await db.ref('approvers').once('value');
        const approvers = snapshot.val();
        if (approvers) {
            const approverOptions = Object.values(approvers).map(approver => approver.Name ? { value: approver.Name, label: approver.Name } : null).filter(Boolean);
            choicesInstance.setChoices([{ value: '', label: 'Select Attention', disabled: true }].concat(approverOptions), 'value', 'label', true);
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
        userJobEntries = allSystemEntries.filter(entry => entry.enteredBy === currentApprover.Name && !isTaskComplete(entry));
        renderJobEntryTable(userJobEntries);
    } catch (error) { console.error("Error fetching job entries:", error); jobEntryTableBody.innerHTML = `<tr><td colspan="8">Error loading data.</td></tr>`; }
}
function handleJobEntrySearch(searchTerm) {
    const searchText = searchTerm.toLowerCase();
    if (!searchText) { renderJobEntryTable(userJobEntries); return; }
    const filteredEntries = userJobEntries.filter(entry => { return ( (entry.for && entry.for.toLowerCase().includes(searchText)) || (entry.ref && entry.ref.toLowerCase().includes(searchText)) || (entry.site && entry.site.toLowerCase().includes(searchText)) || (entry.group && entry.group.toLowerCase().includes(searchText)) || (entry.attention && entry.attention.toLowerCase().includes(searchText)) ); });
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
        const actionButton = task.source === 'invoice' 
            ? `<button class="respond-btn" data-key="${task.key}" disabled title="Status is managed in Invoice Management">View in IM</button>` 
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
        const userSiteString = currentApprover.Site || '';

        let siteFilteredHistory;
        if (userSiteString.toLowerCase() === 'all') {
            siteFilteredHistory = allSystemEntries;
        } else {
            const userSites = userSiteString.split(',').map(s => s.trim());
            siteFilteredHistory = allSystemEntries.filter(task => userSites.includes(task.site));
        }

        userTaskHistory = siteFilteredHistory.filter(task => {
            const isRelatedToMe = (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name);
            return isRelatedToMe && isTaskComplete(task);
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
    reportingTableBody.innerHTML = '<tr><td colspan="10">Loading all entries...</td></tr>';
    try {
        await ensureAllEntriesFetched();
        handleReportingSearch();
    } catch (error) { console.error("Error fetching all entries for reporting:", error); reportingTableBody.innerHTML = '<tr><td colspan="10">Error loading reporting data.</td></tr>'; }
}
function renderReportingTable(entries) {
    reportingTableBody.innerHTML = '';
    if (!entries || entries.length === 0) { reportingTableBody.innerHTML = '<tr><td colspan="10">No entries found for the selected criteria.</td></tr>'; return; }
    entries.forEach(entry => {
        const status = isTaskComplete(entry) ? (entry.remarks || 'Completed') : (entry.remarks || 'Pending');
        const row = document.createElement('tr');
        row.innerHTML = `<td>${entry.for || ''}</td><td>${entry.ref || ''}</td><td>${entry.po || ''}</td><td>${entry.amount || ''}</td><td>${entry.site || ''}</td><td>${entry.attention || ''}</td><td>${entry.enteredBy || ''}</td><td>${entry.date || ''}</td><td>${entry.dateResponded || 'N/A'}</td><td>${status}</td>`;
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
        const chartContainer = document.createElement('div');
        chartContainer.className = 'site-performance-chart';

        for (const site in siteStats) {
            const stats = siteStats[site];
            const total = stats.completed + stats.pending;
            const completedPercent = total > 0 ? (stats.completed / total) * 100 : 0;
            const pendingPercent = total > 0 ? (stats.pending / total) * 100 : 0;
            
            const barContainer = document.createElement('div');
            barContainer.className = 'chart-bar-container';

            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.title = `${site}: ${stats.completed} Completed, ${stats.pending} Pending`;

            const completedSegment = document.createElement('div');
            completedSegment.className = 'bar-segment-completed';
            completedSegment.style.height = `${completedPercent}%`;
            if (completedPercent > 10) completedSegment.textContent = stats.completed;

            const pendingSegment = document.createElement('div');
            pendingSegment.className = 'bar-segment-pending';
            pendingSegment.style.height = `${pendingPercent}%`;
            if (pendingPercent > 10) pendingSegment.textContent = stats.pending;

            bar.appendChild(completedSegment);
            bar.appendChild(pendingSegment);

            const label = document.createElement('div');
            label.className = 'chart-label';
            label.textContent = site;

            barContainer.appendChild(bar);
            barContainer.appendChild(label);
            chartContainer.appendChild(barContainer);
        }
        dbSiteStatsContainer.appendChild(chartContainer);

        const legend = document.createElement('div');
        legend.className = 'chart-legend';
        legend.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background-color: #28a745;"></div>
                <span>Completed</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: #ffc107;"></div>
                <span>Pending</span>
            </div>
        `;
        dbSiteStatsContainer.appendChild(legend);
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
function handleRespondClick(e) {
    if (!e.target.classList.contains('respond-btn')) return;
    const key = e.target.getAttribute('data-key');
    if (!key) return;
    
    const taskData = allSystemEntries.find(entry => entry.key === key);
    if (!taskData || taskData.source === 'invoice') return;

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
    let siteFilteredEntries;

    if (userSiteString.toLowerCase() === 'all') {
        siteFilteredEntries = allSystemEntries;
    } else {
        const userSites = userSiteString.split(',').map(s => s.trim());
        siteFilteredEntries = allSystemEntries.filter(entry => userSites.includes(entry.site));
    }
    
    filterAndRenderReport(siteFilteredEntries); 
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

// --- INVOICE MANAGEMENT FUNCTIONS ---
function updateIMDateTime() {
    const now = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const dateString = now.toLocaleDateString('en-GB', dateOptions);
    const timeString = now.toLocaleTimeString('en-GB', timeOptions);
    if(imDatetimeElement) imDatetimeElement.textContent = `${dateString} at ${timeString}`;
}
function showIMSection(sectionId) {
    const invoiceEntryLink = imNav.querySelector('a[data-section="im-invoice-entry"]');
    if (sectionId === 'im-invoice-entry' && invoiceEntryLink.classList.contains('disabled')) {
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
    if(sectionId === 'im-invoice-entry'){
        resetInvoiceEntryPage();
    }
    if (sectionId === 'im-reporting') {
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
        currentPO = poNumber;
        imPONo.textContent = poNumber;
        imPOSite.textContent = poData['Project ID'] || 'N/A';
        imPOValue.textContent = poData.Amount ? `QAR ${formatCurrency(poData.Amount)}` : 'N/A';
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
            row.innerHTML = `
                <td>${inv.invEntryID || ''}</td>
                <td>${inv.invNumber || ''}</td>
                <td>${invoiceDateDisplay}</td>
                <td>${formatCurrency(inv.invValue)}</td>
                <td>${formatCurrency(inv.amountPaid)}</td>
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
}
function populateInvoiceFormForEditing(invoiceKey) {
    const invData = currentPOInvoices[invoiceKey];
    if (!invData) return;
    resetInvoiceForm();
    currentlyEditingInvoiceKey = invoiceKey;
    imInvEntryIdInput.value = invData.invEntryID || '';
    document.getElementById('im-inv-no').value = invData.invNumber || '';
    imInvoiceDateInput.value = normalizeDateForInput(invData.invoiceDate);
    document.getElementById('im-inv-value').value = invData.invValue || '';
    document.getElementById('im-amount-paid').value = invData.amountPaid || '0';
    document.getElementById('im-inv-name').value = invData.invName || '';
    document.getElementById('im-srv-name').value = invData.srvName || '';
    
    if (invData.status === 'With Accounts') {
        imReleaseDateInput.value = normalizeDateForInput(invData.releaseDate);
    } else {
        imReleaseDateInput.value = getTodayDateString();
    }

    document.getElementById('im-status').value = invData.status || 'For SRV';
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
    invoiceData.attention = imAttentionSelectChoices.getValue(true);

    Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === null || invoiceData[key] === undefined) {
            delete invoiceData[key];
        }
    });

    try {
        await db.ref(`invoice_entries/${currentPO}`).push(invoiceData);
        alert('Invoice added successfully!');
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
    invoiceData.attention = imAttentionSelectChoices.getValue(true);

    if (invoiceData.status === 'With Accounts') {
        invoiceData.attention = '';
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
    currentReportData = [];
    imReportingContent.innerHTML = '<p>Searching... Please wait.</p>';

    // Get filter values from the new dropdowns
    const filterColumn = document.getElementById('im-reporting-filter-column').value;
    const filterCondition = document.getElementById('im-reporting-filter-condition').value;

    try {
        const [poSnapshot, invoiceSnapshot] = await Promise.all([
            db.ref('purchase_orders').once('value'),
            db.ref('invoice_entries').once('value')
        ]);
        const allPOs = poSnapshot.val() || {};
        const allInvoicesByPO = invoiceSnapshot.val() || {};
        
        const searchText = searchTerm.toLowerCase();
        
        // Filter POs based on search text. If no text, include all.
        const filteredPOs = Object.keys(allPOs).filter(poNumber => {
            if (!searchText) return true; // Include all if search is empty
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
            
            // Apply the column filter if one is selected
            if (filterColumn !== 'none' && invoices.length > 0) {
                invoices = invoices.filter(inv => {
                    const value = inv[filterColumn];
                    const isEmpty = value === null || value === undefined || String(value).trim() === '';

                    if (filterCondition === 'is-empty') {
                        return isEmpty;
                    }
                    if (filterCondition === 'is-not-empty') {
                        return !isEmpty;
                    }
                    return true; // Should not happen, but good practice
                });
            }

            if (invoices.length === 0) continue; // Skip this PO if it has no matching invoices after filtering

            resultsFound = true; // We found at least one PO with matching invoices

            const poDataForCSV = {
                poNumber: poNumber,
                site: poDetails['Project ID'] || 'N/A',
                vendor: poDetails['Supplier Name'] || 'N/A',
                poValue: poDetails.Amount || '0',
                invoices: []
            };

            const detailRowId = `detail-${poNumber}`;

            tableHTML += `
                <tr class="master-row" data-target="#${detailRowId}">
                    <td><button class="expand-btn">+</button></td>
                    <td>${poNumber}</td>
                    <td>${poDataForCSV.site}</td>
                    <td>${poDataForCSV.vendor}</td>
                    <td>${poDetails.Amount ? `QAR ${formatCurrency(poDetails.Amount)}` : 'N/A'}</td>
                </tr>
            `;

            let totalInvValue = 0;
            let totalAmountPaid = 0;
            let nestedTableRows = '';

            invoices.forEach(inv => {
                const invValue = parseFloat(inv.invValue) || 0;
                const amountPaid = parseFloat(inv.amountPaid) || 0;
                totalInvValue += invValue;
                totalAmountPaid += amountPaid;
                const normalizedReleaseDate = normalizeDateForInput(inv.releaseDate);
                const releaseDateDisplay = normalizedReleaseDate ? new Date(normalizedReleaseDate + 'T00:00:00').toLocaleDateString('en-GB') : '';
                const normalizedInvoiceDate = normalizeDateForInput(inv.invoiceDate);
                const invoiceDateDisplay = normalizedInvoiceDate ? new Date(normalizedInvoiceDate + 'T00:00:00').toLocaleDateString('en-GB') : '';

                nestedTableRows += `
                    <tr>
                        <td>${inv.invEntryID || ''}</td>
                        <td>${inv.invNumber || ''}</td>
                        <td>${invoiceDateDisplay}</td>
                        <td>${inv.status || ''}</td>
                        <td>${releaseDateDisplay}</td>
                        <td>${formatCurrency(invValue)}</td>
                        <td>${formatCurrency(amountPaid)}</td>
                        <td>${inv.note || ''}</td>
                    </tr>
                `;
                poDataForCSV.invoices.push({ ...inv, invoiceDateDisplay, releaseDateDisplay });
            });
            currentReportData.push(poDataForCSV);

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
                                        <th>Status</th>
                                        <th>Release Date</th>
                                        <th>Inv. Value</th>
                                        <th>Amount Paid</th>
                                        <th>Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${nestedTableRows}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="5" style="text-align: right;"><strong>TOTAL</strong></td>
                                        <td><strong>QAR ${formatCurrency(totalInvValue)}</strong></td>
                                        <td><strong>QAR ${formatCurrency(totalAmountPaid)}</strong></td>
                                        <td></td>
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
            imReportingContent.innerHTML = '<p>No results found for your search and filter criteria.</p>';
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


// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    showView('login');
    loginForm.addEventListener('submit', async (e) => { e.preventDefault(); loginError.textContent = ''; const identifier = loginIdentifierInput.value.trim(); try { const approver = await findApprover(identifier); if (!approver) { loginError.textContent = 'Access denied. Your email or mobile is not registered as an approver.'; return; } currentApprover = approver; if (!currentApprover.Password || currentApprover.Password === '') { const isEmailMissing = !currentApprover.Email; const isSiteMissing = !currentApprover.Site; const isPositionMissing = !currentApprover.Position; setupEmailContainer.classList.toggle('hidden', !isEmailMissing); setupSiteContainer.classList.toggle('hidden', !isSiteMissing); setupPositionContainer.classList.toggle('hidden', !isPositionMissing); setupEmailInput.required = isEmailMissing; setupSiteInput.required = isSiteMissing; setupPositionInput.required = isPositionMissing; showView('setup'); setupPasswordInput.focus(); } else { passwordUserIdentifier.textContent = currentApprover.Email || currentApprover.Mobile; showView('password'); passwordInput.focus(); } } catch (error) { console.error("Error checking approver:", error); loginError.textContent = 'An error occurred. Please try again.'; } });
    setupForm.addEventListener('submit', async (e) => { e.preventDefault(); setupError.textContent = ''; const newPassword = setupPasswordInput.value; const finalEmail = currentApprover.Email || setupEmailInput.value.trim(); const finalSite = currentApprover.Site || setupSiteInput.value.trim(); const finalPosition = currentApprover.Position || setupPositionInput.value.trim(); if (!finalEmail.toLowerCase().endsWith('@iba.com.qa')) { setupError.textContent = 'Invalid email. Only @iba.com.qa addresses are allowed.'; return; } if (newPassword.length < 6) { setupError.textContent = 'Password must be at least 6 characters long.'; return; } try { const updates = { Password: newPassword, Email: finalEmail, Site: finalSite, Position: finalPosition }; await db.ref(`approvers/${currentApprover.key}`).update(updates); currentApprover = { ...currentApprover, ...updates }; handleSuccessfulLogin(); } catch (error) { console.error("Error during setup:", error); setupError.textContent = 'An error occurred while saving. Please try again.'; } });
    passwordForm.addEventListener('submit', (e) => { e.preventDefault(); passwordError.textContent = ''; const enteredPassword = passwordInput.value; if (enteredPassword === currentApprover.Password) { handleSuccessfulLogin(); } else { passwordError.textContent = 'Incorrect password. Please try again.'; passwordInput.value = ''; } });
    function handleLogout() { if(dateTimeInterval) clearInterval(dateTimeInterval); if(workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval); if(imDateTimeInterval) clearInterval(imDateTimeInterval); location.reload(); }
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
        if(workdeskDateTimeInterval) clearInterval(workdeskDateTimeInterval);
        workdeskDateTimeInterval = setInterval(updateWorkdeskDateTime, 1000);
        showView('workdesk');
        showWorkdeskSection('wd-dashboard');
    });

    workdeskNav.addEventListener('click', (e) => { const link = e.target.closest('a'); if (!link) return; e.preventDefault(); const sectionId = link.getAttribute('data-section'); if (sectionId) { workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active')); link.classList.add('active'); showWorkdeskSection(sectionId); } });
    addJobButton.addEventListener('click', handleAddJobEntry);
    updateJobButton.addEventListener('click', handleUpdateJobEntry);
    clearJobButton.addEventListener('click', (e) => resetJobEntryForm(false));
    jobEntrySearchInput.addEventListener('input', (e) => handleJobEntrySearch(e.target.value));
    jobEntryTableBody.addEventListener('click', (e) => { 
        const row = e.target.closest('tr'); 
        if (!row) return; 
        const key = row.getAttribute('data-key'); 
        const entry = allSystemEntries.find(item => item.key === key);
        if (key && entry && entry.source !== 'invoice') {
            populateFormForEditing(key); 
        }
    });
    activeTaskTableBody.addEventListener('click', handleRespondClick);
    jobForSelect.addEventListener('change', (e) => {
        const isQS = currentApprover && currentApprover.Position && currentApprover.Position.toLowerCase() === 'qs';
        if (e.target.value === 'IPC' && isQS) {
            attentionSelectChoices.clearStore();
            attentionSelectChoices.setChoices([{ value: 'All', label: 'All', selected: true }], 'value', 'label', false);
            attentionSelectChoices.disable();
        } else {
            if(attentionSelectChoices.disabled) {
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
        if(e.target.tagName === 'BUTTON') {
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
        if (!imAttentionSelectChoices) {
            imAttentionSelectChoices = new Choices(imAttentionSelect, {
                searchEnabled: true, shouldSort: false, itemSelectText: '',
            });
            populateAttentionDropdown(imAttentionSelectChoices);
        }
        const invoiceEntryLink = imNav.querySelector('a[data-section="im-invoice-entry"]');
        const isAccounts = currentApprover.Position && currentApprover.Position.toLowerCase() === 'accounts';
        const isAdmin = currentApprover.Role && currentApprover.Role.toLowerCase() === 'admin';
        if (isAccounts || isAdmin) {
            invoiceEntryLink.classList.remove('disabled');
        } else {
            invoiceEntryLink.classList.add('disabled');
        }
        updateIMDateTime();
        if(imDateTimeInterval) clearInterval(imDateTimeInterval);
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
        document.getElementById('im-reporting-filter-column').value = 'none';
        imReportingContent.innerHTML = '<p>Click Search to load all data, or enter a term to narrow your results.</p>';
        currentReportData = [];
    });
    
    imReportingDownloadCSVButton.addEventListener('click', handleDownloadCSV);
});