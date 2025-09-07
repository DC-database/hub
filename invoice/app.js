let currentSearchedSite = '';
// Firebase configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDtEp9HL7MfOlnrCI-MWuTY4k6vuGTMCIs",
  authDomain: "invoice-ac1bc.firebaseapp.com",
  projectId: "invoice-ac1bc",
  storageBucket: "invoice-ac1bc.appspot.com",
  messagingSenderId: "345752448964",
  appId: "1:345752448964:web:e57f43e36ad3aa11efbe91",
  measurementId: "G-H23T739E19"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Enhanced device detection with touch support
function detectDeviceType() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    document.body.classList.toggle('touch-device', isTouchDevice);
}

// Environment detection
const isLocal = window.location.protocol === 'file:' || 
                window.location.hostname === 'localhost' || 
                window.location.hostname.endsWith('.local');

// Path configurations
const PDF_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/INVOICE/";
const SRV_BASE_PATH = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/SRV/";

// Application state
let records = [];
let payments = []; // New state variable
let activeFilter = 'all';
let isLoading = false;
let currentYear = '2025';
let currentFilteredRecords = null;
let isViewingSelected = false;
let selectedRecords = [];
let pendingPaymentRecords = []; // New variable to hold records for payment modal

// Chart instances
let statusPieChart = null;
let statusBarChart = null;
let overdueBarChart = null;

function isDarkColor(color) {
    // Convert hex to RGB
    let r, g, b;
    if (color.match(/^rgb/)) {
        const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
        r = rgb[1];
        g = rgb[2];
        b = rgb[3];
    } else {
        // Hex to RGB conversion
        const hex = color.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5; // Returns true for dark colors
}

// DOM Cache
const domCache = {
    mobileMenu: null,
    siteSearchTerm: null,
    searchTerm: null,
    releaseDateFilter: null,
    pettyCashSearchTerm: null,
    reportSearchTerm: null,
    reportType: null,
    reportStatusFilter: null,
    connectBtn: null,
    statusIndicator: null,
    connectionStatus: null,
    fileInfo: null,
    recordsTable: null,
    siteRecordsTable: null,
    reportTable: null,
    pettyCashTable: null,
    invoicePaymentsTable: null, // New DOM element
    loadingOverlay: null,
    authMessage: null,
    uploadStatus: null,
    manageStatus: null,
    emailInput: null,
    passwordInput: null,
    loginBtn: null,
    logoutBtn: null,
    uploadBtn: null,
    clearDataBtn: null,
    loggedInAs: null,
    currentYearDisplay: null,
    recordCount: null,
    lastUpdated: null,
    includeNotes: null,
    overdueSRVCard: null,
    overdueIPCCard: null,
    statusPieChartContainer: null,
    statusBarChartContainer: null
};

// Initialize DOM cache
function cacheDOM() {
    domCache.mobileMenu = document.getElementById('mobileMenu');
    domCache.siteSearchTerm = document.getElementById('siteSearchTerm');
    domCache.searchTerm = document.getElementById('searchTerm');
    domCache.releaseDateFilter = document.getElementById('releaseDateFilter');
    domCache.pettyCashSearchTerm = document.getElementById('pettyCashSearchTerm');
    domCache.reportSearchTerm = document.getElementById('reportSearchTerm');
    domCache.reportType = document.getElementById('reportType');
    domCache.reportStatusFilter = document.getElementById('reportStatusFilter');
    domCache.connectBtn = document.getElementById('connectBtn');
    domCache.statusIndicator = document.getElementById('statusIndicator');
    domCache.connectionStatus = document.getElementById('connectionStatus');
    domCache.fileInfo = document.getElementById('fileInfo');
    domCache.recordsTable = document.getElementById('recordsTable');
    domCache.siteRecordsTable = document.getElementById('siteRecordsTable');
    domCache.reportTable = document.getElementById('reportTable');
    domCache.pettyCashTable = document.getElementById('pettyCashTable');
    domCache.invoicePaymentsTable = document.getElementById('invoicePaymentsTable'); // New cache
    domCache.loadingOverlay = document.getElementById('loadingOverlay');
    domCache.authMessage = document.getElementById('authMessage');
    domCache.uploadStatus = document.getElementById('uploadStatus');
    domCache.manageStatus = document.getElementById('manageStatus');
    domCache.emailInput = document.getElementById('emailInput');
    domCache.passwordInput = document.getElementById('passwordInput');
    domCache.loginBtn = document.getElementById('loginBtn');
    domCache.logoutBtn = document.getElementById('logoutBtn');
    domCache.uploadBtn = document.getElementById('uploadBtn');
    domCache.clearDataBtn = document.getElementById('clearDataBtn');
    domCache.loggedInAs = document.getElementById('loggedInAs');
    domCache.currentYearDisplay = document.getElementById('currentYearDisplay');
    domCache.recordCount = document.getElementById('recordCount');
    domCache.lastUpdated = document.getElementById('lastUpdated');
    domCache.includeNotes = document.getElementById('includeNotes');
    domCache.overdueSRVCard = document.querySelector('.overdue-card.srv');
    domCache.overdueIPCCard = document.querySelector('.overdue-card.ipc');
    domCache.statusPieChartContainer = document.getElementById('statusPieChart').parentElement;
    domCache.statusBarChartContainer = document.getElementById('statusBarChart').parentElement;
}

// Mobile detection
function isMobileDevice() {
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0)) &&
        window.innerWidth <= 768;
}

// Mobile menu functions
function toggleMobileMenu() {
    domCache.mobileMenu.classList.toggle('show');
    document.body.style.overflow = domCache.mobileMenu.classList.contains('show') ? 'hidden' : '';
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    domCache.mobileMenu.classList.remove('show');
    document.body.style.overflow = '';
    
    if (sectionId === 'pettyCashSection') {
        updateNoteSuggestions();
    }
    
    if (sectionId === 'statementSection') {
        updateVendorSuggestions();
        updateSiteSuggestions();
    }
    
    // Clear filters when switching to invoice section
    if (sectionId === 'invoiceSection') {
        domCache.searchTerm.value = '';
        domCache.releaseDateFilter.value = '';
        activeFilter = 'all';
        refreshTable(); // Make table empty by default
    }
    
    if (sectionId === 'mainPageSection') {
        searchSiteRecords();
    }

    if (sectionId === 'invoicePaymentsSection') {
        loadPaymentsFromFirebase().then(() => {
            refreshPaymentsTable(); // Make table empty by default
        });
    }
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (sectionId === 'mainPageSection') {
        document.querySelector('.menu-item.main-page').classList.add('active');
    } else if (sectionId === 'invoiceSection') {
        document.querySelector('.menu-item:nth-child(2)').classList.add('active');
    } else if (sectionId === 'invoicePaymentsSection') {
        document.querySelector('.menu-item.payments').classList.add('active');
    } else if (sectionId === 'statementSection') {
        // No separate menu item for statement section, it's part of Invoice Tracker flow
    } else if (sectionId === 'pettyCashSection') {
        // No separate menu item for petty cash section
    } else if (sectionId === 'dataManagementSection') {
        document.querySelector('.menu-item.admin').classList.add('active');
    }
}

// View PDF file
function viewPDF(fileName) {
    if (!fileName) {
        alert("No PDF file linked to this record.");
        return;
    }
    
    window.open(`${PDF_BASE_PATH}${encodeURIComponent(fileName)}`, '_blank');
}

// View SRV file
function viewSRV(fileName) {
    if (!fileName) {
        alert("No SRV file linked to this record.");
        return;
    }
    
    window.open(`${SRV_BASE_PATH}${encodeURIComponent(fileName)}`, '_blank');
}

// Loading overlay functions
function showLoading() {
    isLoading = true;
    domCache.loadingOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideLoading() {
    isLoading = false;
    domCache.loadingOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

// Status progress calculation
function getStatusPercentage(status) {
    const statusProgress = {
        'Open': 0,
        'For SRV': 10,
        'For IPC': 25,
        'No Invoice': 25,
        'Report': 25,
        'Under Review': 50,
        'CEO Approval': 75,
        'With Accounts': 100
    };
    return statusProgress[status] || 0;
}

// Connection status
function updateConnectionStatus(connected) {
    if (connected) {
        if (domCache.statusIndicator) domCache.statusIndicator.className = 'status-indicator connected';
        if (domCache.connectionStatus) domCache.connectionStatus.textContent = `Connected to: Firebase (${currentYear})`;
        if (domCache.connectBtn) domCache.connectBtn.innerHTML = `<i class="fas fa-sync-alt"></i> <span class="btn-text">Data Updated (${currentYear})</span>`;
    } else {
        if (domCache.statusIndicator) domCache.statusIndicator.className = 'status-indicator disconnected';
        if (domCache.connectionStatus) domCache.connectionStatus.textContent = 'Not connected to data source';
        if (domCache.connectBtn) domCache.connectBtn.innerHTML = `<i class="fas fa-sync-alt"></i> <span class="btn-text">Refresh Data</span>`;
    }
    
    updateFileInfo();
}

// Data processing
function processCSVData(data) {
    return data.map(item => ({
        entryDate: item['Entered Date'] || new Date().toISOString().split('T')[0],
        site: item['Site'] || '',
        poNumber: item['PO Number'] || '',
        poValue: item['PO Value'] || '',
        vendor: item['Vendor'] || '',
        invoiceNumber: item['Invoice Number'] || '',
        value: item['Value'] || '',
        details: item['Details'] || '',
        releaseDate: item['Release Date'] || '',
        status: item['Status'] || 'For SRV',
        fileName: item['FileName'] || '',
        note: item['Note'] || item['Notes'] || item['Description'] || '',
        lastUpdated: new Date().toISOString()
    }));
}

function migrateStatus(records) {
    return records.map(record => {
        if (record.status === 'Under Process') {
            record.status = 'CEO Approval';
        }
        return record;
    });
}

// Firebase Functions
function login() {
    const email = domCache.emailInput.value;
    const password = domCache.passwordInput.value;
    
    if (!email || !password) {
        domCache.authMessage.textContent = 'Please enter both email and password';
        return;
    }
    
    showLoading();
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            hideLoading();
            domCache.authMessage.textContent = '';
            updateAuthUI(true, email);
            loadFromFirebase();
        })
        .catch((error) => {
            hideLoading();
            domCache.authMessage.textContent = error.message;
        });
}

function logout() {
    auth.signOut().then(() => {
        updateAuthUI(false);
        records = [];
        updateUI();
        checkOverdueProgression();
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}

function updateAuthUI(isLoggedIn, email = null) {
    if (isLoggedIn) {
        domCache.loginBtn.style.display = 'none';
        domCache.logoutBtn.style.display = 'block';
        domCache.uploadBtn.disabled = false;
        domCache.clearDataBtn.disabled = false;
        domCache.loggedInAs.textContent = `Logged in as: ${email}`;
    } else {
        domCache.loginBtn.style.display = 'block';
        domCache.logoutBtn.style.display = 'none';
        domCache.uploadBtn.disabled = true;
        domCache.clearDataBtn.disabled = true;
        domCache.loggedInAs.textContent = 'Not logged in';
        domCache.emailInput.value = '';
        domCache.passwordInput.value = '';
    }
}

function loadFromFirebase() {
    showLoading();
    
    const recordsRef = database.ref(`records/${currentYear}`);
    
    return recordsRef.once('value')
        .then((snapshot) => {
            const data = snapshot.val();
            if (data) {
                records = Object.values(data);
                records = migrateStatus(records);
                updateNoteSuggestions();
                updateVendorSuggestions();
                updateSiteSuggestions();
                updateUI();
                checkOverdueProgression();
                updateConnectionStatus(true);
                
                // Update data info
                domCache.currentYearDisplay.textContent = currentYear;
                domCache.recordCount.textContent = records.length;
                domCache.lastUpdated.textContent = new Date().toLocaleString();
                
                // Initialize charts only, don't show table
                initializeCharts();
                initializeOverdueChart();
                domCache.siteRecordsTable.style.display = 'none';
            } else {
                records = [];
                updateConnectionStatus(false);
                
                // Update data info
                domCache.currentYearDisplay.textContent = currentYear;
                domCache.recordCount.textContent = '0';
                domCache.lastUpdated.textContent = 'Never';
                
                // Clear charts and table
                if (statusPieChart) statusPieChart.destroy();
                if (statusBarChart) statusBarChart.destroy();
                if (overdueBarChart) overdueBarChart.destroy();
                domCache.siteRecordsTable.style.display = 'none';
            }
            hideLoading();
        })
        .catch((error) => {
            console.error('Error loading data from Firebase:', error);
            updateConnectionStatus(false);
            hideLoading();
            throw error;
        });
}

function loadPaymentsFromFirebase(showLoader = true) {
    if (showLoader) showLoading();
    const paymentsRef = database.ref('invoicePayments');
    return paymentsRef.once('value').then(snapshot => { // Return promise for chaining
        const data = snapshot.val();
        payments = data ? Object.values(data) : [];
        if (showLoader) hideLoading();
    }).catch(error => {
        console.error('Error loading payments from Firebase:', error);
        if (showLoader) hideLoading();
    });
}

function uploadCSV() {
    const fileInput = document.getElementById('csvFileInput');
    const year = document.querySelector('input[name="uploadYear"]:checked').value;
    const file = fileInput.files[0];
    
    if (!file) {
        domCache.uploadStatus.textContent = 'Please select a CSV file';
        domCache.uploadStatus.className = 'upload-status error';
        return;
    }
    
    showLoading();
    domCache.uploadStatus.textContent = 'Processing file...';
    domCache.uploadStatus.className = 'upload-status';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvData = e.target.result;
        
        Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data.length === 0) {
                    domCache.uploadStatus.textContent = 'No valid data found in CSV';
                    domCache.uploadStatus.className = 'upload-status error';
                    hideLoading();
                    return;
                }
                
                const processedData = processCSVData(results.data);
                const migratedData = migrateStatus(processedData);
                
                // Save to Firebase
                const recordsRef = database.ref(`records/${year}`);
                
                // Convert array to object with keys
                const recordsObj = {};
                migratedData.forEach((record, index) => {
                    recordsObj[index] = record;
                });
                
                recordsRef.set(recordsObj)
                    .then(() => {
                        domCache.uploadStatus.textContent = `Successfully uploaded ${migratedData.length} records to Firebase (${year})`;
                        domCache.uploadStatus.className = 'upload-status success';
                        hideLoading();
                        
                        // Reload data if current year matches
                        if (currentYear === year) {
                            loadFromFirebase();
                        }
                    })
                    .catch((error) => {
                        domCache.uploadStatus.textContent = `Error uploading data: ${error.message}`;
                        domCache.uploadStatus.className = 'upload-status error';
                        hideLoading();
                    });
            },
            error: (error) => {
                domCache.uploadStatus.textContent = `Error parsing CSV: ${error.message}`;
                domCache.uploadStatus.className = 'upload-status error';
                hideLoading();
            }
        });
    };
    
    reader.readAsText(file);
}

function downloadTemplate() {
    // Create template CSV content
    const headers = [
        'Entered Date', 'Site', 'PO Number', 'PO Value', 'Vendor', 
        'Invoice Number', 'Value', 'Details', 'Release Date', 
        'Status', 'FileName', 'Note'
    ].join(',');
    
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearFirebaseData() {
    const year = document.querySelector('input[name="manageYear"]:checked').value;
    
    if (!confirm(`Are you sure you want to clear all ${year} data? This cannot be undone.`)) {
        return;
    }
    
    showLoading();
    domCache.manageStatus.textContent = 'Clearing data...';
    domCache.manageStatus.className = 'upload-status';
    
    const recordsRef = database.ref(`records/${year}`);
    
    recordsRef.remove()
        .then(() => {
            domCache.manageStatus.textContent = `Successfully cleared ${year} data`;
            domCache.manageStatus.className = 'upload-status success';
            hideLoading();
            
            // Clear local data if current year matches
            if (currentYear === year) {
                records = [];
                updateUI();
                checkOverdueProgression();
            }
        })
        .catch((error) => {
            domCache.manageStatus.textContent = `Error clearing data: ${error.message}`;
            domCache.manageStatus.className = 'upload-status error';
            hideLoading();
        });
}

function updateFileInfo() {
    const timestamp = new Date().toLocaleString();
    let infoHTML = `<strong>Data Source:</strong> Firebase (${currentYear})<br>`;
    infoHTML += `<strong>Last Updated:</strong> ${timestamp}<br>`;
    infoHTML += `<strong>Records Loaded:</strong> ${records.length}`;
    
    if (domCache.fileInfo) { domCache.fileInfo.innerHTML = infoHTML; }
}

// Optimized UI updates
function updateUI() {
    updateConnectionStatus(true);
    updateFileInfo();
}

// Helper function to standardize invoice numbers for matching
function normalizeInvoiceNumber(inv) {
    const val = String(inv || '').trim().toLowerCase();
    // Treat common "empty" values (like '', 'n/a', '-') as the same thing
    if (val === '' || val === 'n/a' || val === '-' || val === 'na') {
        return ''; // Return a single, standard "empty" value
    }
    return String(inv).trim(); // Otherwise, return the actual invoice number
}

// Table functions
function refreshTable(filteredRecords = []) {
    const tableBody = document.querySelector('#recordsTable tbody');
    tableBody.innerHTML = '';
    
    const displayRecords = filteredRecords;
    currentFilteredRecords = displayRecords;

    // Create a set of paid invoice identifiers for quick lookup
    const paidInvoices = new Set();
    if (payments && payments.length > 0) {
        payments.forEach(payment => {
            if (payment.paymentEntries) {
                Object.values(payment.paymentEntries).forEach(entry => {
                    const poToUse = String(entry.originalPoNumber || payment.poNumber || '').trim();
                    if (!poToUse) return; // Skip if no PO number

                    // Normalize the invoice number for consistent matching
                    const normalizedInvoice = normalizeInvoiceNumber(entry.invoiceNumber);

                    // Identifier 1: Using the exact PO number
                    const exactIdentifier = [
                        String(payment.site || '').trim(),
                        poToUse,
                        String(payment.vendor || '').trim(),
                        normalizedInvoice
                    ].join('-');
                    paidInvoices.add(exactIdentifier);

                    // Identifier 2: Using only the integer part of the PO number
                    const integerPO = parseInt(poToUse, 10);
                    if (!isNaN(integerPO) && String(integerPO) !== poToUse) {
                         const integerIdentifier = [
                            String(payment.site || '').trim(),
                            String(integerPO),
                            String(payment.vendor || '').trim(),
                            normalizedInvoice
                        ].join('-');
                        paidInvoices.add(integerIdentifier);
                    }
                });
            }
        });
    }
    
    if (displayRecords.length > 0) {
        domCache.recordsTable.style.display = 'table';
    } else {
        domCache.recordsTable.style.display = 'none';
        return;
    }
    
    domCache.recordsTable.style.display = 'table';
    
    displayRecords.forEach((record, index) => {
        const percentage = getStatusPercentage(record.status);
        const statusSteps = {
            'Open': 0, 'For SRV': 1, 'For IPC': 2, 'No Invoice': 2, 'Report': 2,
            'Under Review': 3, 'CEO Approval': 4, 'With Accounts': 5
        };
        const currentStep = statusSteps[record.status] || 0;
        
        const row = document.createElement('tr');

        // Normalize the record's invoice number before checking for a match
        const recordIdentifier = [
            String(record.site || '').trim(),
            String(record.poNumber || '').trim(),
            String(record.vendor || '').trim(),
            normalizeInvoiceNumber(record.invoiceNumber)
        ].join('-');
        
        if (paidInvoices.has(recordIdentifier)) {
            row.classList.add('paid-row');
        }

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatDate(record.entryDate)}</td>
            <td>${record.site || '-'}</td>
            <td>${record.poNumber || '-'}</td>
            <td>${record.vendor || '-'}</td>
            <td>${record.invoiceNumber || '-'}</td>
            <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
            <td>${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
            <td class="status-cell">
                <div class="step-progress-container">
                    <div class="step-progress" data-percentage="${percentage}">
                        <div class="step step-1 ${currentStep > 1 ? 'active' : ''} ${currentStep === 1 ? 'current' : ''}"></div>
                        <div class="step-connector ${currentStep > 1 ? 'active' : ''}"></div>
                        <div class="step step-2 ${currentStep > 2 ? 'active' : ''} ${currentStep === 2 ? 'current' : ''}"></div>
                        <div class="step-connector ${currentStep > 2 ? 'active' : ''}"></div>
                        <div class="step step-3 ${currentStep > 3 ? 'active' : ''} ${currentStep === 3 ? 'current' : ''}"></div>
                        <div class="step-connector ${currentStep > 3 ? 'active' : ''}"></div>
                        <div class="step step-4 ${currentStep > 4 ? 'active' : ''} ${currentStep === 4 ? 'current' : ''}"></div>
                        <div class="step-connector ${currentStep > 4 ? 'active' : ''}"></div>
                        <div class="step step-5 ${currentStep > 5 ? 'active' : ''} ${currentStep === 5 ? 'current' : ''}"></div>
                    </div>
                    <div class="step-labels">
                        <span class="step-label">SRV</span>
                        <span class="step-label">IPC/Report</span>
                        <span class="step-label">Review</span>
                        <span class="step-label">CEO</span>
                        <span class="step-label">Accounts</span>
                    </div>
                    <div class="status-tooltip">${record.status} - ${percentage}%</div>
                </div>
            </td>
            <td class="action-btns">
                <button class="btn btn-inv ${!record.fileName ? 'disabled' : ''}" 
                    onclick="viewPDF('${record.fileName || ''}')" 
                    ${!record.fileName ? 'disabled' : ''}>
                    <i class="fas fa-file-pdf"></i> INV
                </button>
                <button class="btn btn-srv ${!record.details ? 'disabled' : ''}" 
                    onclick="viewSRV('${record.details || ''}')" 
                    ${!record.details ? 'disabled' : ''}>
                    <i class="fas fa-file-alt"></i> SRV
                </button>
            
                <button class="btn btn-primary" 
                    onclick='openWhatsAppModal(${JSON.stringify({ 
                        site: record.site||"", 
                        poNumber: record.poNumber||"", 
                        vendor: record.vendor||"", 
                        value: record.value||"", 
                        fileName: record.fileName||"", 
                        invoiceNumber: record.invoiceNumber||"", 
                        status: record.status||"" 
                    })}, "approval")'>
                    <i class="fab fa-whatsapp"></i> Approval
                </button>
    
            </td>
        `;
        
        // Touch handling variables
        let touchTimer;
        let isLongPress = false;
        
        // Touch start - start timer for long press
        row.addEventListener('touchstart', function(e) {
            if (isMobileDevice()) {
                isLongPress = false;
                touchTimer = setTimeout(() => {
                    isLongPress = true;
                    showInvoicePreview(record);
                }, 500); // 500ms for long press
            }
        });
        
        // Touch end - clear timer if not long press
        row.addEventListener('touchend', function(e) {
            if (isMobileDevice()) {
                if (touchTimer) clearTimeout(touchTimer);
                if (!isLongPress && !e.target.closest('.action-btns')) {
                    // Handle single tap for selection
                    this.classList.toggle('selected-row');
                }
                isLongPress = false;
            }
        });
        
        // Touch move - cancel long press if user moves finger
        row.addEventListener('touchmove', function(e) {
            if (isMobileDevice()) {
                if (touchTimer) clearTimeout(touchTimer);
                isLongPress = false;
            }
        });
        
        // Prevent default touch behavior to avoid conflicts
        row.addEventListener('touchcancel', function(e) {
            if (isMobileDevice()) {
                if (touchTimer) clearTimeout(touchTimer);
                isLongPress = false;
            }
        });
        
        // Keep double click for desktop preview
        if (!isMobileDevice()) {
            row.addEventListener('dblclick', function(e) {
                if (!e.target.closest('.action-btns')) {
                    showInvoicePreview(record);
                }
            });
        }
        
        // Keep single click for desktop selection
        row.addEventListener('click', function(e) {
            if (!isMobileDevice() && !e.target.closest('.action-btns')) {
                this.classList.toggle('selected-row');
                e.stopPropagation();
            }
        });
        
        tableBody.appendChild(row);
    });
    
    setupResponsiveElements();
}


// Helper function to get selected records from tracker
function getSelectedTrackerRecords() {
    const selectedRows = document.querySelectorAll('#recordsTable tbody tr.selected-row');
    const selectedRecords = [];
    
    selectedRows.forEach(row => {
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);
        if (currentFilteredRecords && rowIndex < currentFilteredRecords.length) {
            selectedRecords.push(currentFilteredRecords[rowIndex]);
        }
    });
    
    return selectedRecords;
}

// Search and filter
function searchRecords() {
    if (isViewingSelected && selectedRecords.length > 0) {
        renderTable(selectedRecords);
        return;
    }
    const term = domCache.searchTerm.value.toLowerCase();
    const releaseDateInput = domCache.releaseDateFilter.value;
    
    if (!term && !releaseDateInput && activeFilter === 'all') {
        refreshTable();
        return;
    }
    
    let filtered = records;
    
    if (term) {
        filtered = filtered.filter(record =>
            (record.site && record.site.toLowerCase().includes(term)) ||
            (record.poNumber && String(record.poNumber).toLowerCase().includes(term)) ||
            (record.vendor && record.vendor.toLowerCase().includes(term)) ||
            (record.invoiceNumber && record.invoiceNumber.toLowerCase().includes(term)) ||
            (record.details && record.details.toLowerCase().includes(term)) ||
            (record.fileName && record.fileName.toLowerCase().includes(term)) ||
            (record.note && record.note.toLowerCase().includes(term))
        );
    }
    
    if (activeFilter !== 'all') {
        filtered = filtered.filter(record => record.status === activeFilter);
    }
    
    if (releaseDateInput) {
        const filterDate = parseReleaseDate(releaseDateInput);
        filtered = filtered.filter(record => {
            if (!record.releaseDate) return false;
            const recordDate = parseReleaseDate(record.releaseDate);
            return recordDate.toDateString() === filterDate.toDateString();
        });
    }
    
    refreshTable(filtered);
}

function filterRecords(status) {
    activeFilter = status;
    
    // Update active state on filter pills
    document.querySelectorAll('#invoiceFilterContainer .filter-pill').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    searchRecords();
}

function clearSearch() {
    // Clear search inputs
    domCache.searchTerm.value = '';
    domCache.releaseDateFilter.value = '';
    
    // Reset filter to 'All'
    activeFilter = 'all';
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.status === 'all');
    });
    
    refreshTable();
    
    // Reset selection states
    isViewingSelected = false;
    selectedRecords = [];
    
    // Show toast message
    showToast('Search cleared');
}

function clearDate() {
    domCache.releaseDateFilter.value = '';
    searchRecords();
}

// Main Dashboard Functions
function initializeCharts(filteredRecords = null) {
    // Always use all records for the charts, excluding specific statuses
    const excludedStatuses = ['With Accounts', 'Closed', 'Cancelled', 'No Invoice'];
    const chartRecords = records.filter(record => !excludedStatuses.includes(record.status));
    
    // Only initialize charts if their containers are visible
    if (domCache.statusPieChartContainer.style.display !== 'none') {
        // Prepare data for pie chart
        const statusCounts = {};
        chartRecords.forEach(record => {
            statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
        });
        
        const statusLabels = Object.keys(statusCounts);
        const statusData = Object.values(statusCounts);
        const total = statusData.reduce((a, b) => a + b, 0);
        
        // Vibrant unique colors for each status
        const backgroundColors = statusLabels.map(status => {
            const statusColors = {
                'For SRV': '#4E79A7', // Blue
                'For IPC': '#F28E2B', // Orange
                'Under Review': '#E15759', // Red
                'CEO Approval': '#76B7B2', // Teal
                'Open': '#59A14F', // Green
                'Pending': '#EDC948', // Yellow
                'Report': '#B07AA1', // Purple
                'No Invoice': '#FF9DA7', // Pink
                'With Accounts': '#9C755F' // Brown
            };
            return statusColors[status] || '#BAB0AC'; // Default color
        });

        // Pie Chart
        const pieCtx = document.getElementById('statusPieChart').getContext('2d');
        if (statusPieChart) statusPieChart.destroy();
        statusPieChart = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusData,
                    backgroundColor: backgroundColors,
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 20,
                            boxWidth: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Invoice Status Distribution',
                        font: {
                            size: 16
                        },
                        padding: {
                            bottom: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: {
                        formatter: (value, ctx) => {
                            const percentage = ((value / total) * 100).toFixed(1) + '%';
                            return percentage;
                        },
                        color: function(context) {
                            const bgColor = context.dataset.backgroundColor[context.dataIndex];
                            return isDarkColor(bgColor) ? '#fff' : '#333';
                        },
                        font: {
                            weight: 'bold',
                            size: 12
                        },
                        anchor: 'center',
                        align: 'center',
                        display: function(context) {
                            return true; // Always show labels
                        },
                        textShadowBlur: 3,
                        textShadowColor: 'rgba(0,0,0,0.5)'
                    }
                },
                cutout: '50%',
                animation: {
                    animateScale: true,
                    animateRotate: true
                },
                onClick: function(evt, elements) {
        if (elements.length > 0) {
            const clickedIndex = elements[0].index;
            const status = statusLabels[clickedIndex];
            filterRecordsByStatus(status);
        }
    }
            },
            plugins: [ChartDataLabels]
        });
    }
    
    if (domCache.statusBarChartContainer.style.display !== 'none') {
        // Prepare data for horizontal bar chart
        const statusCounts = {};
        chartRecords.forEach(record => {
            statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
        });
        
        const statusLabels = Object.keys(statusCounts);
        const statusData = Object.values(statusCounts);
        
        // Same vibrant colors as pie chart for consistency
        const backgroundColors = statusLabels.map(status => {
            const statusColors = {
                'For SRV': '#4E79A7',
                'For IPC': '#F28E2B',
                'Under Review': '#E15759',
                'CEO Approval': '#76B7B2',
                'Open': '#59A14F',
                'Pending': '#EDC948',
                'Report': '#B07AA1',
                'No Invoice': '#FF9DA7',
                'With Accounts': '#9C755F'
            };
            return statusColors[status] || '#BAB0AC';
        });
        
        // Horizontal Bar Chart
        const barCtx = document.getElementById('statusBarChart').getContext('2d');
        if (statusBarChart) statusBarChart.destroy();
        statusBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: statusLabels,
                datasets: [{
                    label: 'Count',
                    data: statusData,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // This makes the bar chart horizontal
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Invoice Count by Status',
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.raw || 0;
                                return `${label}: ${value}`;
                            }
                        }
                    }
                },
                onClick: function(evt, elements) {
        if (elements.length > 0) {
            const clickedIndex = elements[0].index;
            const status = statusLabels[clickedIndex];
            filterRecordsByStatus(status);
        }
    }
            }
        });
    }
}

function initializeOverdueChart(filteredRecords = null) {
    const displayRecords = filteredRecords || records;
    
    // Filter only overdue SRV and IPC records
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const overdueRecords = displayRecords.filter(record => {
        if (!record.releaseDate || !['For SRV', 'For IPC'].includes(record.status)) return false;
        
        try {
            const releaseDate = parseReleaseDate(record.releaseDate);
            const workingDaysPassed = getWorkingDays(releaseDate, today);
            return workingDaysPassed >= 7;
        } catch (e) {
            console.error('Error processing record:', record, e);
            return false;
        }
    });
    
    // Group by site and calculate overdue days
    const siteOverdueData = {};
    
    overdueRecords.forEach(record => {
        if (!record.site) return;
        
        const releaseDate = parseReleaseDate(record.releaseDate);
        const workingDaysPassed = getWorkingDays(releaseDate, today);
        
        if (!siteOverdueData[record.site]) {
            siteOverdueData[record.site] = {
                srvCount: 0,
                ipcCount: 0,
                maxDays: 0,
                totalDays: 0,
                recordCount: 0
            };
        }
        
        if (record.status === 'For SRV') {
            siteOverdueData[record.site].srvCount++;
        } else if (record.status === 'For IPC') {
            siteOverdueData[record.site].ipcCount++;
        }
        
        siteOverdueData[record.site].totalDays += workingDaysPassed;
        siteOverdueData[record.site].recordCount++;
        if (workingDaysPassed > siteOverdueData[record.site].maxDays) {
            siteOverdueData[record.site].maxDays = workingDaysPassed;
        }
    });
    
    // Prepare data for chart
    const sites = Object.keys(siteOverdueData).sort();
    const srvData = sites.map(site => siteOverdueData[site].srvCount);
    const ipcData = sites.map(site => siteOverdueData[site].ipcCount);
    const avgDaysData = sites.map(site => 
        Math.round(siteOverdueData[site].totalDays / siteOverdueData[site].recordCount)
    );
    
    // Create or update chart
    const ctx = document.getElementById('overdueBarChart').getContext('2d');
    
    if (overdueBarChart) {
        overdueBarChart.data.labels = sites;
        overdueBarChart.data.datasets[0].data = srvData;
        overdueBarChart.data.datasets[1].data = ipcData;
        overdueBarChart.data.datasets[2].data = avgDaysData;
        overdueBarChart.update();
        return;
    }
    
    overdueBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sites,
            datasets: [
                {
                    label: 'Overdue SRV',
                    data: srvData,
                    backgroundColor: '#4e73df',
                    borderColor: '#4e73df',
                    borderWidth: 1
                },
                {
                    label: 'Overdue IPC',
                    data: ipcData,
                    backgroundColor: '#1cc88a',
                    borderColor: '#1cc88a',
                    borderWidth: 1
                },
                {
                    label: 'Avg Days Overdue',
                    data: avgDaysData,
                    backgroundColor: '#f6c23e',
                    borderColor: '#f6c23e',
                    borderWidth: 1,
                    type: 'line',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Overdue Items'
                    }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Average Days Overdue'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Overdue Invoice by Site',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            const site = context[0].label;
                            const data = siteOverdueData[site];
                            return [
                                `Max Days Overdue: ${data.maxDays}`,
                                `Avg Days Overdue: ${Math.round(data.totalDays / data.recordCount)}`
                            ];
                        }
                    }
                }
            },
            onClick: function(evt, elements) {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    const site = this.data.labels[clickedIndex];
                    const datasetIndex = elements[0].datasetIndex;
                    const status = datasetIndex === 0 ? 'For SRV' : datasetIndex === 1 ? 'For IPC' : null;
                    
                    if (status) {
                        domCache.siteSearchTerm.value = site;
                        filterSiteTableOnly(site, status);
                    } else {
                        domCache.siteSearchTerm.value = site;
                        searchSiteRecords();
                    }
                }
            }
        }
    });
}

function filterSiteTableOnly(site, status) {
    let filtered = records.filter(record => 
        record.status !== 'With Accounts' && 
        record.status !== 'Closed' && 
        record.status !== 'Cancelled'
    );
    
    if (site) {
        filtered = filtered.filter(record => 
            record.site && record.site.toLowerCase().includes(site.toLowerCase())
        );
    }
    
    if (status) {
        filtered = filtered.filter(record => record.status === status);
        
        if (status === 'For SRV' || status === 'For IPC') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            filtered = filtered.filter(record => {
                if (!record.releaseDate) return false;
                try {
                    const releaseDate = parseReleaseDate(record.releaseDate);
                    const workingDaysPassed = getWorkingDays(releaseDate, today);
                    return workingDaysPassed >= 7;
                } catch (e) {
                    console.error('Error processing record:', record, e);
                    return false;
                }
            });
        }
    }
    
    currentFilteredRecords = filtered;
    refreshSiteTable(filtered);
    domCache.siteRecordsTable.style.display = filtered.length > 0 ? 'table' : 'none';
}

function searchSiteRecords() {
    currentSearchedSite = domCache.siteSearchTerm.value.trim();
    const term = domCache.siteSearchTerm.value.toLowerCase();
    let filtered = records.filter(record => record.status !== 'With Accounts' && record.status !== 'Closed' && record.status !== 'Cancelled');
    
    if (term) {
        filtered = filtered.filter(record => 
            record.site && record.site.toLowerCase().includes(term)
        );
    }
    
    // Show all charts for general search
    domCache.statusPieChartContainer.style.display = 'block';
    domCache.statusBarChartContainer.style.display = 'block';
    document.getElementById('overdueBarChart').parentElement.style.display = 'block';
    
    currentFilteredRecords = filtered;
    refreshSiteTable(filtered);
    initializeCharts(filtered);
    initializeOverdueChart(filtered);
    domCache.siteRecordsTable.style.display = term ? 'table' : 'none';
}

function filterSiteRecords(status, fromOverdue = false) {
    const term = domCache.siteSearchTerm.value.toLowerCase();
    let filtered = records.filter(record => record.status !== 'With Accounts' && record.status !== 'Closed' && record.status !== 'Cancelled');
    
    if (term) {
        filtered = filtered.filter(record => 
            record.site && record.site.toLowerCase().includes(term)
        );
    }
    
    if (status !== 'all') {
        filtered = filtered.filter(record => record.status === status);
        
        if (status === 'For SRV' || status === 'For IPC') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            filtered = filtered.filter(record => {
                if (!record.releaseDate) return false;
                try {
                    const releaseDate = parseReleaseDate(record.releaseDate);
                    const workingDaysPassed = getWorkingDays(releaseDate, today);
                    return workingDaysPassed >= 7;
                } catch (e) {
                    console.error('Error processing record:', record, e);
                    return false;
                }
            });
        }
    }
    
    // Control chart visibility based on whether it's from overdue cards
    if (fromOverdue) {
        // Hide status charts when viewing overdue items from cards
        domCache.statusPieChartContainer.style.display = 'none';
        domCache.statusBarChartContainer.style.display = 'none';
        // Show overdue chart
        document.getElementById('overdueBarChart').parentElement.style.display = 'block';
    } else {
        // Show all charts for other cases
        domCache.statusPieChartContainer.style.display = 'block';
        domCache.statusBarChartContainer.style.display = 'block';
        document.getElementById('overdueBarChart').parentElement.style.display = 'block';
    }
    
    currentFilteredRecords = filtered;
    refreshSiteTable(filtered);
    initializeCharts(filtered);
    initializeOverdueChart(filtered);
    domCache.siteRecordsTable.style.display = filtered.length > 0 ? 'table' : 'none';
}
// Robust date parser for ISO (YYYY-MM-DD) and D/M/Y or D-M-Y
function parseReleaseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const str = String(value).trim();
    // ISO format 2025-08-27
    let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    // D/M/Y or D-M-Y
    m = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
        return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }
    // Fallback
    return new Date(str);
}
function getWorkingDays(startDate, endDate) {
    let count = 0;
    const current = (startDate instanceof Date) ? new Date(startDate) : parseReleaseDate(startDate);
    current.setHours(0, 0, 0, 0);
    const end = (endDate instanceof Date) ? new Date(endDate) : parseReleaseDate(endDate);
    end.setHours(0, 0, 0, 0);
    
    if (current.getTime() === end.getTime()) {
        return 0;
    }
    
    while (current < end) {
        const day = current.getDay();
        if (day !== 5) { // Skip Friday (Qatar weekend)
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function refreshSiteTable(filteredRecords = null) {
    const tableBody = document.querySelector('#siteRecordsTable tbody');
    tableBody.innerHTML = '';
    
    const displayRecords = filteredRecords || records.filter(record => record.status !== 'With Accounts');
    currentFilteredRecords = displayRecords;
    
    if (displayRecords.length === 0) {
        domCache.siteRecordsTable.style.display = 'none';
        return;
    }
    
    domCache.siteRecordsTable.style.display = 'table';
    
    displayRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'row-checkbox';
        
        const firstCell = document.createElement('td');
        firstCell.appendChild(checkbox);
        
        row.appendChild(firstCell);
        row.innerHTML += `
            <td>${index + 1}</td>
            <td>${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
            <td>${record.site || '-'}</td>
            <td>${formatPoNumber(record.poNumber)}</td>
            <td>${record.vendor || '-'}</td>
            <td>${record.invoiceNumber || '-'}</td>
            <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
            <td><span class="status-badge ${getStatusClass(record.status)}">${record.status}</span></td>
            <td>${record.note || '-'}</td>
        `;
        
        // Mobile-specific touch handling
        if (isMobileDevice()) {
            let touchStartTime;
            let touchMoved = false;
            
            // Handle checkbox touch specifically
            checkbox.addEventListener('touchstart', function(e) {
                e.stopPropagation(); // Prevent row touch handlers
                touchMoved = false;
                touchStartTime = Date.now();
            });
            
            checkbox.addEventListener('touchmove', function() {
                touchMoved = true;
            });
            
            checkbox.addEventListener('touchend', function(e) {
                if (!touchMoved && (Date.now() - touchStartTime) < 200) {
                    // Simple tap - toggle checkbox
                    this.checked = !this.checked;
                    e.preventDefault(); // Prevent double-tap zoom
                }
            });
            
            // For row touches (non-checkbox areas)
            row.addEventListener('touchstart', function(e) {
                if (!e.target.closest('input[type="checkbox"]')) {
                    touchStartTime = Date.now();
                    touchMoved = false;
                }
            });
            
            row.addEventListener('touchmove', function(e) {
                if (!e.target.closest('input[type="checkbox"]')) {
                    touchMoved = true;
                }
            });
            
            row.addEventListener('touchend', function(e) {
                if (!e.target.closest('input[type="checkbox"]') && 
                    !touchMoved && 
                    (Date.now() - touchStartTime) < 200) {
                    // Simple tap on row - show preview
                    showDashboardRecordPreview(record);
                    e.preventDefault();
                }
            });
        }
        
        // Keep desktop double-click behavior
        if (!isMobileDevice()) {
            row.addEventListener('dblclick', function(e) {
                if (!e.target.closest('input[type="checkbox"]')) {
                    showDashboardRecordPreview(record);
                }
            });
        }
        
        tableBody.appendChild(row);
    });
    
    setupResponsiveElements();
}

function showDashboardRecordPreview(record) {
    document.getElementById('dashboardPreviewVendor').textContent = record.vendor || '-';    
    document.getElementById('dashboardPreviewPoNumber').textContent = formatPoNumber(record.poNumber);
    document.getElementById('dashboardPreviewInvoiceNumber').textContent = record.invoiceNumber || '-';
    document.getElementById('dashboardPreviewAmount').textContent = record.value ? formatNumber(record.value) : '-';
    document.getElementById('dashboardPreviewStatus').textContent = record.status || '-';
    document.getElementById('dashboardPreviewNotes').textContent = record.note || '-';
    
    const statusSteps = {
        'Open': 0,
        'For SRV': 1,
        'For IPC': 2,
        'No Invoice': 2,
        'Report': 2,
        'Under Review': 3,
        'CEO Approval': 4,
        'With Accounts': 5
    };
    const currentStep = statusSteps[record.status] || 0;
    
    document.querySelectorAll('#dashboardPreviewModal .step').forEach((step, index) => {
        step.classList.remove('current');
        if (index < currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    if (currentStep > 0) {
        const currentStepElement = document.querySelector(`#dashboardPreviewModal .step-${currentStep}`);
        if (currentStepElement) {
            currentStepElement.classList.add('current');
        }
    }
    
    document.querySelectorAll('#dashboardPreviewModal .step-connector').forEach((connector, index) => {
        if (index < currentStep - 1) {
            connector.classList.add('active');
        } else {
            connector.classList.remove('active');
        }
    });
    
    const requestUpdateBtn = document.getElementById('dashboardRequestUpdateBtn');
    if (requestUpdateBtn) {
        requestUpdateBtn.onclick = () => {
            closeDashboardPreview(); // Close the dashboard preview modal
            openWhatsAppModal(record, 'update'); // Open the WhatsApp modal in 'update' mode
        };
    }
    
    document.getElementById('dashboardPreviewModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function viewInInvoiceTracker(poNumber) {
    // Switch to invoice section
    showSection('invoiceSection');
    
    // Set the search term to the PO number
    domCache.searchTerm.value = formatPoNumber(poNumber);
    
    // Trigger the search
    searchRecords();
    
    // Close the preview modal
    closeDashboardPreview();
}

function closeDashboardPreview() {
    document.getElementById('dashboardPreviewModal').style.display = 'none';
    document.body.style.overflow = '';
}

function clearSiteSearch() {
    domCache.siteSearchTerm.value = '';
    // Show all charts when clearing search
    domCache.statusPieChartContainer.style.display = 'block';
    domCache.statusBarChartContainer.style.display = 'block';
    document.getElementById('overdueBarChart').parentElement.style.display = 'block';
    searchSiteRecords();
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatNumber(value) {
    return parseFloat(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatPoNumber(po) {
    if (!po) return '-';
    // Use parseFloat to handle decimals correctly, avoiding truncation.
    const num = parseFloat(String(po).trim());
    return isNaN(num) ? po : num;
}

function getStatusClass(status) {
    const statusClasses = {
        'For SRV': 'status-srv',
        'Report': 'status-report',
        'Under Review': 'status-review',
        'Pending': 'status-pending',
        'With Accounts': 'status-accounts',
        'CEO Approval': 'status-process',
        'For IPC': 'status-ipc',
        'No Invoice': 'status-Invoice',
        'Open': 'status-Open'
    };
    return statusClasses[status] || '';
}

function clearReportSearch() {
    domCache.reportSearchTerm.value = '';
    domCache.reportType.value = 'po';
    domCache.reportStatusFilter.value = 'all';
    document.getElementById('reportHeader').innerHTML = '';
    domCache.reportTable.style.display = 'none';
    document.getElementById('poTotal').textContent = '0.00';
    document.getElementById('grandTotal').textContent = '0.00';
    document.getElementById('accountsTotal').textContent = '0.00';
    document.getElementById('balanceTotal').textContent = '0.00';
    document.querySelector('#reportTable tbody').innerHTML = '';
}

function clearPettyCashSearch() {
    domCache.pettyCashSearchTerm.value = '';
    document.getElementById('pettyCashTotal').textContent = '0.00';
    document.getElementById('pettyCashCount').textContent = '0';
    domCache.pettyCashTable.style.display = 'none';
    document.getElementById('pettyCashTableTotal').textContent = '0.00';
    document.querySelector('#pettyCashTable tbody').innerHTML = '';
}

// Report functions
function generateReport() {
    const reportType = domCache.reportType.value;
    const searchTerm = domCache.reportSearchTerm.value.trim();
    const statusFilter = domCache.reportStatusFilter.value;
    const includeNotes = domCache.includeNotes.checked;
    
    if (!searchTerm) {
        alert('Please enter a search term');
        return;
    }
    
    let filteredRecords = [];
    let headerText = '';
    
    switch(reportType) {
        case 'po':
            filteredRecords = records.filter(record => 
                record.poNumber && String(record.poNumber).toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (filteredRecords.length > 0) {
                headerText = `PO: ${formatPoNumber(filteredRecords[0].poNumber)}<br>
                    Vendor: ${filteredRecords[0].vendor || 'N/A'}<br>
                    Site: ${filteredRecords[0].site || 'N/A'}<br>
                    Note: ${filteredRecords[0].note || 'N/A'}`;
            }
            document.getElementById('poTotalContainer').style.display = 'flex';
            break;
            
        case 'vendor':
            filteredRecords = records.filter(record => 
                record.vendor && record.vendor.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (filteredRecords.length > 0) {
                headerText = `Vendor: ${filteredRecords[0].vendor}<br>
                    Records: ${filteredRecords.length}`;
            }
            document.getElementById('poTotalContainer').style.display = 'none';
            break;
            
        case 'site':
            filteredRecords = records.filter(record => 
                record.site && record.site.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (filteredRecords.length > 0) {
                headerText = `Site: ${filteredRecords[0].site}<br>
                    Records: ${filteredRecords.length}`;
            }
            document.getElementById('poTotalContainer').style.display = 'none';
            break;
    }
    
    if (statusFilter !== 'all') {
        filteredRecords = filteredRecords.filter(record => record.status === statusFilter);
    }
    
    if (filteredRecords.length === 0) {
        alert('No records found matching your search criteria');
        return;
    }
    
    const invoiceTotal = filteredRecords
        .reduce((sum, record) => sum + (parseFloat(record.value) || 0), 0);
        
    const poTotal = reportType === 'po' && filteredRecords.length > 0 ? 
        parseFloat(filteredRecords[0].poValue) || 0 : 0;
    
    const withAccountsTotal = filteredRecords
        .filter(record => record.status === 'With Accounts')
        .reduce((sum, record) => sum + (parseFloat(record.value) || 0), 0);
    
    const balance = invoiceTotal - withAccountsTotal;

    document.getElementById('reportHeader').innerHTML = headerText;
    document.getElementById('poTotal').textContent = formatNumber(poTotal);
    document.getElementById('grandTotal').textContent = formatNumber(invoiceTotal);
    document.getElementById('accountsTotal').textContent = formatNumber(withAccountsTotal);
    document.getElementById('balanceTotal').textContent = formatNumber(balance);
    
    const reportTableBody = document.querySelector('#reportTable tbody');
    reportTableBody.innerHTML = '';
    
    filteredRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatPoNumber(record.poNumber)}</td>
            <td>${record.vendor || '-'}</td>
            <td>${record.invoiceNumber || '-'}</td>
            <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
            <td>${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
            <td><span class="status-badge ${getStatusClass(record.status)}">${record.status}</span></td>
            <td class="notes-column">${includeNotes ? (record.note || '-') : ''}</td>
        `;
        
        // Add click handler to navigate to invoice tracker
        row.addEventListener('click', function() {
            if (record.poNumber) {
                showSection('invoiceSection');
                domCache.searchTerm.value = formatPoNumber(record.poNumber);
                searchRecords();
            }
        });
        
        reportTableBody.appendChild(row);
    });
    
    // Show/hide notes column based on checkbox
    document.querySelectorAll('#reportTable .notes-column').forEach(col => {
        col.style.display = includeNotes ? '' : 'none';
    });
    
    document.getElementById('reportTotalAmount').textContent = formatNumber(invoiceTotal);
    domCache.reportTable.style.display = 'table';
}

// NOTE SUGGESTIONS FUNCTIONALITY
function updateNoteSuggestions() {
    try {
        const noteSuggestions = document.getElementById('noteSuggestions');
        if (!noteSuggestions) return;
        
        noteSuggestions.innerHTML = '';
        
        const allNotes = records
            .filter(record => record.note && record.note.trim() !== '')
            .map(record => record.note.trim());
        
        const uniqueNotes = [...new Set(allNotes)].sort();
        
        uniqueNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestions.appendChild(option);
        });
    } catch (error) {
        console.error('Error updating note suggestions:', error);
    }
}

// Vendor suggestions functionality
function updateVendorSuggestions() {
    try {
        const vendorSuggestions = document.getElementById('vendorSuggestions');
        if (!vendorSuggestions) return;
        
        vendorSuggestions.innerHTML = '';
        
        const allVendors = records
            .filter(record => record.vendor && record.vendor.trim() !== '')
            .map(record => record.vendor.trim());
        
        const uniqueVendors = [...new Set(allVendors)].sort();
        
        uniqueVendors.forEach(vendor => {
            const option = document.createElement('option');
            option.value = vendor;
            vendorSuggestions.appendChild(option);
        });
    } catch (error) {
        console.error('Error updating vendor suggestions:', error);
    }
}

// Site suggestions functionality
function updateSiteSuggestions() {
    try {
        const siteSuggestions = document.getElementById('siteSuggestions');
        const siteSuggestionsMain = document.getElementById('siteSuggestionsMain');
        if (!siteSuggestions || !siteSuggestionsMain) return;
        
        siteSuggestions.innerHTML = '';
        siteSuggestionsMain.innerHTML = '';
        
        const allSites = records
            .filter(record => record.site && record.site.trim() !== '')
            .map(record => record.site.trim());
        
        const uniqueSites = [...new Set(allSites)].sort();
        
        uniqueSites.forEach(site => {
            const option = document.createElement('option');
            option.value = site;
            siteSuggestions.appendChild(option);
            siteSuggestionsMain.appendChild(option.cloneNode(true));
        });
    } catch (error) {
        console.error('Error updating site suggestions:', error);
    }
}

function generatePettyCashReport() {
    const searchTerm = domCache.pettyCashSearchTerm.value.trim();
    
    if (!searchTerm) {
        alert('Please enter a search term for the notes field');
        return;
    }
    
    const filteredRecords = records.filter(record => 
        record.note && record.note.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filteredRecords.length === 0) {
        alert('No petty cash records found matching your search criteria');
        return;
    }
    
    const totalValue = filteredRecords
        .reduce((sum, record) => sum + (parseFloat(record.value) || 0), 0);
    
    document.getElementById('pettyCashTotal').textContent = formatNumber(totalValue);
    document.getElementById('pettyCashCount').textContent = filteredRecords.length;
    
    const pettyCashTableBody = document.querySelector('#pettyCashTable tbody');
    pettyCashTableBody.innerHTML = '';
    
    filteredRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatPoNumber(record.poNumber)}</td>
            <td>${record.site || '-'}</td>
            <td>${record.vendor || '-'}</td>
            <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
            <td><span class="status-badge ${getStatusClass(record.status)}">${record.status}</span></td>
        `;
        
        // Add click handler to navigate to invoice tracker
        row.addEventListener('click', function() {
            if (record.poNumber) {
                showSection('invoiceSection');
                domCache.searchTerm.value = formatPoNumber(record.poNumber);
                searchRecords();
            }
        });
        
        pettyCashTableBody.appendChild(row);
    });
    
    document.getElementById('pettyCashTableTotal').textContent = formatNumber(totalValue);
    domCache.pettyCashTable.style.display = 'table';
    
    if (window.innerWidth <= 768) {
        document.getElementById('pettyCashSection').scrollIntoView({ behavior: 'smooth' });
    }
}

// Print functions
function printReport() {
    // Create a print window
    const printWindow = window.open('', '_blank');
    
    // Get the report content
    const reportSection = document.getElementById('statementSection');
    const reportContent = reportSection.cloneNode(true);
    
    
    // Normalize status cells so printing shows the text (avoid white-on-white badge styles)
    try {
        const badgeNodes = reportContent.querySelectorAll('.compact-table .status-badge');
        badgeNodes.forEach(badge => {
            const td = badge.closest('td');
            if (td) td.textContent = badge.textContent || '';
        });
    } catch (e) { /* no-op */ }
// Remove elements we don't want to print
    const elementsToRemove = reportContent.querySelectorAll('.report-controls, .report-actions, .back-btn');
    elementsToRemove.forEach(el => el.remove());
    
    // Create print styles
    const printStyles = `
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
            th { background-color: #f2f2f2; }
            .numeric { text-align: right; }
            .status-badge { padding: 4px 8px; border-radius: 4px; color: #000; background: transparent; border: 1px solid #ccc; }
            .financial-summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
            .financial-summary div { margin-bottom: 10px; }
            @page { size: auto; margin: 10mm; }
            @media print {
                body { padding: 0; margin: 0; }
                .financial-summary { page-break-inside: avoid; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
            }
        </style>
    `;
    
    // Write the content to the print window
    printWindow.document.write(`
        <html>
            <head>
                <title>Statement of Account</title>
                ${printStyles}
            </head>
            <body>
                <h2 style="text-align: center;">Statement of Account</h2>
                <p style="text-align: center; margin-bottom: 20px;">Generated on: ${new Date().toLocaleString()}</p>
                ${reportContent.innerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// Add these new functions to your app.js

function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('#siteRecordsTable tbody input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
}

function getSelectedRecords() {
    const checkboxes = document.querySelectorAll('#siteRecordsTable tbody input[type="checkbox"]:checked');
    const selectedRecords = [];
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        const recordIndex = parseInt(row.cells[1].textContent) - 1; // Get ID from the second cell (index 1)
        if (currentFilteredRecords && recordIndex >= 0 && recordIndex < currentFilteredRecords.length) {
            selectedRecords.push(currentFilteredRecords[recordIndex]);
        }
    });
    return selectedRecords;
}

function printSelectedDashboardResults() {
    const selectedRecords = getSelectedRecords();
    
    if (selectedRecords.length === 0) {
        alert('Please select at least one record to print');
        return;
    }
    
    // Get the most common status from selected records
    const statusCounts = {};
    selectedRecords.forEach(record => {
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
    });
    const mostCommonStatus = Object.keys(statusCounts).reduce((a, b) => 
        statusCounts[a] > statusCounts[b] ? a : b
    );

    // Create a print window
    const printWindow = window.open('', '_blank');
    
    // Create the table HTML
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
                <tr>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">ID</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Release Date</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Site</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">PO</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Vendor</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Invoice</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white; text-align: right;">Amount</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Status</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Note</th>
                </tr>
            </thead>
            <tbody>`;
    
    // Add rows for selected records
    selectedRecords.forEach((record, index) => {
        tableHTML += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.site || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${formatPoNumber(record.poNumber)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.vendor || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.invoiceNumber || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${record.value ? formatNumber(record.value) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.status || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.note || '-'}</td>
            </tr>`;
    });
    
    tableHTML += `</tbody></table>`;
    
    // Get the search term for the title
    const searchTerm = domCache.siteSearchTerm.value;
    const title = searchTerm ? `Invoice Dashboard Results - Search: "${searchTerm}"` : 'Invoice Dashboard Results';
    
    // Write the content to the print window
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #4a6fa5; text-align: center; }
                    h2 { color: #4a6fa5; text-align: center; margin-top: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 8px; border: 1px solid #ddd; }
                    th { background-color: #4a6fa5; color: white; }
                    .numeric { text-align: right; }
                    @page { size: auto; margin: 10mm; }
                    @media print {
                        body { padding: 0; margin: 0; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <p style="text-align: center; margin-bottom: 5px;">Generated on: ${new Date().toLocaleString()}</p>
                <h2>Selected Records For: ${mostCommonStatus}</h2>
                <p style="text-align: center; margin-bottom: 20px; font-weight: bold;">Records: ${selectedRecords.length}</p>
                ${tableHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}



function printPettyCashReport() {
    // Create a print window
    const printWindow = window.open('', '_blank');
    
    // Get the petty cash content
    const pettyCashSection = document.getElementById('pettyCashSection');
    const pettyCashContent = pettyCashSection.cloneNode(true);
    
    // Remove elements we don't want to print
    const elementsToRemove = pettyCashContent.querySelectorAll('.report-controls, .report-actions, .back-btn');
    elementsToRemove.forEach(el => el.remove());
    
    // Create print styles
    const printStyles = `
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
            th { background-color: #f2f2f2; }
            .numeric { text-align: right; }
            .status-badge { padding: 4px 8px; border-radius: 4px; color: #000; background: transparent; border: 1px solid #ccc; }
            .financial-summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
            .financial-summary div { margin-bottom: 10px; }
            @page { size: auto; margin: 10mm; }
            @media print {
                body { padding: 0; margin: 0; }
                .financial-summary { page-break-inside: avoid; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
            }
        </style>
    `;
    
    // Get the search term for the report title
    const searchTerm = domCache.pettyCashSearchTerm.value;
    const title = searchTerm ? `Petty Cash Report - Search: "${searchTerm}"` : 'Petty Cash Report';
    
    // Write the content to the print window
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                ${printStyles}
            </head>
            <body>
                <h2 style="text-align: center;">${title}</h2>
                <p style="text-align: center; margin-bottom: 20px;">Generated on: ${new Date().toLocaleString()}</p>
                ${pettyCashContent.innerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// Invoice Preview Functions
function showInvoicePreview(record) {
    document.getElementById('previewVendor').textContent = record.vendor || '-';    
    document.getElementById('previewPoNumber').textContent = formatPoNumber(record.poNumber);
    document.getElementById('previewInvoiceNumber').textContent = record.invoiceNumber || '-';
    document.getElementById('previewAmount').textContent = record.value ? formatNumber(record.value) : '-';
    document.getElementById('previewStatus').textContent = record.status || '-';
    document.getElementById('previewReleaseDate').textContent = record.releaseDate ? formatDate(record.releaseDate) : '-';
    document.getElementById('previewNotes').textContent = record.note || '-';
    
    const statusSteps = {
        'Open': 0,
        'For SRV': 1,
        'For IPC': 2,
        'No Invoice': 2,
        'Report': 2,
        'Under Review': 3,
        'CEO Approval': 4,
        'With Accounts': 5
    };
    const currentStep = statusSteps[record.status] || 0;
    
    document.querySelectorAll('#invoicePreviewModal .step').forEach((step, index) => {
        step.classList.remove('current');
        if (index < currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    if (currentStep > 0) {
        const currentStepElement = document.querySelector(`#invoicePreviewModal .step-${currentStep}`);
        if (currentStepElement) {
            currentStepElement.classList.add('current');
        }
    }
    
    document.querySelectorAll('#invoicePreviewModal .step-connector').forEach((connector, index) => {
        if (index < currentStep - 1) {
            connector.classList.add('active');
        } else {
            connector.classList.remove('active');
        }
    });
    
    // Setup for Request Update button
    const requestUpdateBtn = document.getElementById('requestUpdateBtn');
    if (requestUpdateBtn) {
        requestUpdateBtn.onclick = () => {
            closeInvoicePreview(); // Close current modal
            openWhatsAppModal(record, 'update'); // Open the other modal for update request
        };
    }
    
    document.getElementById('invoicePreviewModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeInvoicePreview() {
    document.getElementById('invoicePreviewModal').style.display = 'none';
    document.body.style.overflow = '';
}

// Share functions
function shareReportViaWhatsApp() {
    const reportHeader = document.getElementById('reportHeader').textContent;
    const totalAmount = document.getElementById('grandTotal').textContent;
    
    let message = `*Report Summary*\n\n`;
    message += `${reportHeader}\n\n`;
    message += `*Total Amount:* ${totalAmount}\n\n`;
    message += `Generated from IBA Trading Invoice Management System`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = '+97450992023';
    
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
}

function sharePettyCashViaWhatsApp() {
    const totalAmount = document.getElementById('pettyCashTotal').textContent;
    const recordCount = document.getElementById('pettyCashCount').textContent;
    const searchTerm = domCache.pettyCashSearchTerm.value;
    
    let message = `*Petty Cash Summary*\n\n`;
    message += `Search Term: ${searchTerm}\n`;
    message += `Records Found: ${recordCount}\n`;
    message += `Total Amount: ${totalAmount}\n\n`;
    message += `Generated from IBA Trading Invoice Management System`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = '+97450992023';
    
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
}

// Responsive setup
function setupResponsiveElements() {
    detectDeviceType();
    const screenWidth = window.innerWidth;
    
    // Reset all hidden columns first
    document.querySelectorAll('#recordsTable th, #recordsTable td, #siteRecordsTable th, #siteRecordsTable td').forEach(el => {
        el.style.display = '';
    });
    
    // Records table responsiveness
    if (screenWidth <= 400) {
        document.querySelectorAll('#recordsTable th:nth-child(2), #recordsTable td:nth-child(2), #recordsTable th:nth-child(4), #recordsTable td:nth-child(4), #recordsTable th:nth-child(6), #recordsTable td:nth-child(6), #recordsTable th:nth-child(8), #recordsTable td:nth-child(8)').forEach(el => {
            el.style.display = 'none';
        });
    } else if (screenWidth <= 576) {
        document.querySelectorAll('#recordsTable th:nth-child(2), #recordsTable td:nth-child(2), #recordsTable th:nth-child(3), #recordsTable td:nth-child(3), #recordsTable th:nth-child(7), #recordsTable td:nth-child(7), #recordsTable th:nth-child(8), #recordsTable td:nth-child(8)').forEach(el => {
            el.style.display = 'none';
        });
    } else if (screenWidth <= 768) {
        document.querySelectorAll('#recordsTable th:nth-child(2), #recordsTable td:nth-child(2), #recordsTable th:nth-child(3), #recordsTable td:nth-child(3), #recordsTable th:nth-child(7), #recordsTable td:nth-child(7), #recordsTable th:nth-child(8), #recordsTable td:nth-child(8)').forEach(el => {
            el.style.display = 'none';
        });
        
        // Site records table responsiveness - Updated for mobile view
        document.querySelectorAll('#siteRecordsTable th:nth-child(2), #siteRecordsTable td:nth-child(2), #siteRecordsTable th:nth-child(5), #siteRecordsTable td:nth-child(5), #siteRecordsTable th:nth-child(6), #siteRecordsTable td:nth-child(6), #siteRecordsTable th:nth-child(7), #siteRecordsTable td:nth-child(7), #siteRecordsTable th:nth-child(9), #siteRecordsTable td:nth-child(9)').forEach(el => {
            el.style.display = 'none';
        });
    } else if (screenWidth <= 992) {
        document.querySelectorAll('#recordsTable th:nth-child(3), #recordsTable td:nth-child(3), #recordsTable th:nth-child(8), #recordsTable td:nth-child(8)').forEach(el => {
            el.style.display = 'none';
        });
    }
    
    // Extra small screens
    if (screenWidth <= 480) {
        document.querySelectorAll('#siteRecordsTable th:nth-child(4), #siteRecordsTable td:nth-child(4), #siteRecordsTable th:nth-child(5), #siteRecordsTable td:nth-child(5), #siteRecordsTable th:nth-child(6), #siteRecordsTable td:nth-child(6), #siteRecordsTable th:nth-child(7), #siteRecordsTable td:nth-child(7), #siteRecordsTable th:nth-child(9), #siteRecordsTable td:nth-child(9)').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// Overdue progression check
function checkOverdueProgression() {
    const overdueSRV = [];
    const overdueIPC = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    records.forEach(record => {
        if (!record.releaseDate || 
            record.status === 'With Accounts' || 
            record.status === 'Closed' || 
            record.status === 'Cancelled') return;
        
        try {
            const releaseDate = parseReleaseDate(record.releaseDate);
            const workingDaysPassed = getWorkingDays(releaseDate, today);
            
            if (record.status === 'For SRV' && workingDaysPassed >= 7) {
                overdueSRV.push(record);
            }
            if (record.status === 'For IPC' && workingDaysPassed >= 7) {
                overdueIPC.push(record);
            }
        } catch (e) {
            console.error('Error processing record:', record, e);
        }
    });

    document.getElementById('overdueSRVCount').textContent = overdueSRV.length;
    document.getElementById('overdueIPCCount').textContent = overdueIPC.length;
}

// Dashboard Print Function
function printDashboardResults() {
    // Create a print window
    const printWindow = window.open('', '_blank');
    
    // Get the current filtered records or all records if no filter is applied
    const displayRecords = currentFilteredRecords || records.filter(record => record.status !== 'With Accounts');
    
    if (displayRecords.length === 0) {
        alert('No records to print');
        return;
    }
    
    // Determine the status filter being applied
    let statusFilter = 'All Statuses';
    const activeFilterBtn = document.querySelector('.filter-pill.active');
    if (activeFilterBtn && activeFilterBtn.dataset.status !== 'all') {
        statusFilter = activeFilterBtn.textContent;
    }
    
    // Create the table HTML
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
                <tr>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">ID</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Release Date</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Site</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">PO</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Vendor</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Invoice</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white; text-align: right;">Amount</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Status</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Note</th>
                </tr>
            </thead>
            <tbody>`;
    
    // Add rows
    displayRecords.forEach((record, index) => {
        tableHTML += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.site || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${formatPoNumber(record.poNumber)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.vendor || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.invoiceNumber || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${record.value ? formatNumber(record.value) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.status || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.note || '-'}</td>
            </tr>`;
    });
    
    tableHTML += `</tbody></table>`;
    
    // Get the search term for the title
    const searchTerm = domCache.siteSearchTerm.value;
    const title = searchTerm ? `Invoice Dashboard Results - Search: "${searchTerm}"` : 'Invoice Dashboard Results';
    
    // Write the content to the print window
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #4a6fa5; text-align: center; }
                    h2 { color: #4a6fa5; text-align: center; margin-top: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 8px; border: 1px solid #ddd; }
                    th { background-color: #4a6fa5; color: white; }
                    .numeric { text-align: right; }
                    @page { size: auto; margin: 10mm; }
                    @media print {
                        body { padding: 0; margin: 0; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <p style="text-align: center; margin-bottom: 5px;">Generated on: ${new Date().toLocaleString()}</p>
                <h2>Selected Records For: ${statusFilter}</h2>
                <p style="text-align: center; margin-bottom: 20px;">Records: ${displayRecords.length}</p>
                ${tableHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    cacheDOM();
    detectDeviceType();
    updateConnectionStatus(false);
    updateAuthUI(false);
    
    // Automatically load data on initial load
    const connectBtn = domCache.connectBtn;
    const originalHTML = connectBtn.innerHTML;
    
    connectBtn.disabled = true;
    connectBtn.innerHTML = `<div class="corporate-spinner" style="width: 20px; height: 20px; display: inline-block; margin-right: 10px;"></div> Loading...`;
    
    // Check if user is already logged in and load data
    auth.onAuthStateChanged((user) => {
        if (user) {
            updateAuthUI(true, user.email);
            loadFromFirebase().then(() => {
                loadPaymentsFromFirebase(false); // Load payments data in the background
            }).finally(() => {
                if (connectBtn) connectBtn.disabled = false;
                if (connectBtn) connectBtn.innerHTML = originalHTML;
            });
        } else {
            updateAuthUI(false);
            loadFromFirebase().then(() => {
                loadPaymentsFromFirebase(false); // Also load here for non-authed view
            }).finally(() => {
                if (connectBtn) connectBtn.disabled = false;
                if (connectBtn) connectBtn.innerHTML = originalHTML;
            });
        }
    });
    
    window.addEventListener('resize', setupResponsiveElements);
    
    if (domCache.connectBtn) domCache.connectBtn.addEventListener('click', async function() {
        const btn = this;
        const originalHTML = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = `<div class="corporate-spinner" style="width: 20px; height: 20px; display: inline-block; margin-right: 10px;"></div> Loading...`;
        
        try {
            await loadFromFirebase();
        } catch (error) {
            console.error('Error loading data:', error);
            updateConnectionStatus(false);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    });
    
    // Add click handlers for overdue cards
    domCache.overdueSRVCard.addEventListener('click', function() {
        filterSiteRecords('For SRV', true);
    });
    
    domCache.overdueIPCCard.addEventListener('click', function() {
        filterSiteRecords('For IPC', true);
    });
    
    document.querySelectorAll('.mobile-menu input[name="dataSource"], input[name="uploadYear"], input[name="manageYear"]').forEach(radio => {
        radio.addEventListener('change', async function() {
            currentYear = this.value;
            const connectBtn = domCache.connectBtn;
            const originalHTML = connectBtn.innerHTML;
            
            records = [];
            domCache.recordsTable.style.display = 'none';
            domCache.siteRecordsTable.style.display = 'none';
            connectBtn.disabled = true;
            connectBtn.innerHTML = `<div class="corporate-spinner" style="width: 20px; height: 20px; display: inline-block; margin-right: 10px;"></div> Loading ${currentYear} Data...`;
            
            try {
                await loadFromFirebase();
            } catch (error) {
                console.error('Error loading data:', error);
                updateConnectionStatus(false);
            } finally {
                if (connectBtn) connectBtn.disabled = false;
                if (connectBtn) connectBtn.innerHTML = originalHTML;
            }
        });
    });
    
    domCache.searchTerm.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchRecords();
        }
    });
    
    domCache.reportSearchTerm.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            generateReport();
        }
    });
    
    domCache.pettyCashSearchTerm.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            generatePettyCashReport();
        }
    });
    
    domCache.siteSearchTerm.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchSiteRecords();
        }
    });
    
    document.getElementById('paymentsSearchTerm').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchPayments();
        }
    });

    domCache.includeNotes.addEventListener('change', function() {
        // When the checkbox changes, regenerate the report if one is already displayed
        if (document.querySelector('#reportTable tbody').children.length > 0) {
            generateReport();
        }
    });
});

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    const modal = document.getElementById('invoicePreviewModal');
    const dashboardModal = document.getElementById('dashboardPreviewModal');
    const paymentModal = document.getElementById('addPaymentModal');
    const editPaymentModal = document.getElementById('editPaymentModal');
    
    if (event.target === modal) {
        closeInvoicePreview();
    }
    
    if (event.target === dashboardModal) {
        closeDashboardPreview();
    }

    if (event.target === paymentModal) {
        closeAddPaymentModal();
    }
    
    if (event.target === editPaymentModal) {
        closeEditPaymentModal();
    }
});

function handleSiteTableClick(record) {
    if (record.status === 'Closed' || record.status === 'Cancelled') return;
    showSection('invoiceSection');
    domCache.searchTerm.value = formatPoNumber(record.poNumber) || '';
    searchRecords();
}

function filterRecordsByStatus(status) {
    let site = currentSearchedSite.toLowerCase();
    const filtered = records.filter(r =>
        r.status === status &&
        r.site.toLowerCase().includes(site)
    );
    refreshSiteTable(filtered);
}
function viewSelectedInTracker() {
    const selectedRecords = getSelectedRecords();
    
    if (selectedRecords.length === 0) {
        alert('Please select at least one record to view');
        return;
    }
    
    // Switch to invoice section
    showSection('invoiceSection');
    
    // Clear any existing search/filter
    domCache.searchTerm.value = '';
    domCache.releaseDateFilter.value = '';
    activeFilter = 'all';
    
    // Update the UI to show selected records
    currentFilteredRecords = selectedRecords;
    refreshTable(selectedRecords);
    
    // Scroll to the table if on mobile
    if (window.innerWidth <= 768) {
        domCache.recordsTable.scrollIntoView({ behavior: 'smooth' });
    }
}
// Collection functionality
let invoiceCollection = [];

function addToCollection() {
    const selectedRecords = getSelectedRecords();
    
    if (selectedRecords.length === 0) {
        alert('Please select at least one record to add to collection');
        return;
    }
    
    // Add only records that aren't already in the collection
    selectedRecords.forEach(record => {
        if (!invoiceCollection.some(item => item.poNumber === record.poNumber && 
                                          item.invoiceNumber === record.invoiceNumber)) {
            invoiceCollection.push(record);
        }
    });
    
    // Show success message
    showToast(`${selectedRecords.length} item(s) added to collection. Total: ${invoiceCollection.length}`);
}

// Update viewCollection to handle both sources
function viewCollection() {
    if (invoiceCollection.length === 0) {
        alert('Your collection is empty. Please add some items first.');
        return;
    }

    // Update the collection table
    const tableBody = document.querySelector('#collectionTable tbody');
    tableBody.innerHTML = '';
    
    let totalAmount = 0;
    
    // Group by PO number for better organization
    const poGroups = {};
    invoiceCollection.forEach(record => {
        const poKey = record.poNumber || 'No PO';
        if (!poGroups[poKey]) {
            poGroups[poKey] = [];
        }
        poGroups[poKey].push(record);
    });
    
    let rowIndex = 1;
    
    // Sort PO groups alphabetically
    const sortedPoKeys = Object.keys(poGroups).sort();
    
    sortedPoKeys.forEach(poKey => {
        // Add PO header row if it's not "No PO"
        if (poKey !== 'No PO') {
            const headerRow = document.createElement('tr');
            headerRow.className = 'po-header-row';
            headerRow.innerHTML = `
                <td colspan="9">
                    <strong>PO: ${formatPoNumber(poKey)}</strong>
                </td>
            `;
            tableBody.appendChild(headerRow);
        }
        
        // Add records for this PO
        poGroups[poKey].forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${rowIndex++}</td>
                <td>${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
                <td>${record.site || '-'}</td>
                <td>${formatPoNumber(record.poNumber)}</td>
                <td>${record.vendor || '-'}</td>
                <td>${record.invoiceNumber || '-'}</td>
                <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
                <td><span class="status-badge ${getStatusClass(record.status)}">${record.status}</span></td>
                <td>${record.note || '-'}</td>
            `;
            
            row.addEventListener('click', function() {
                showInvoicePreview(record);
            });
            
            tableBody.appendChild(row);
            
            // Calculate total amount
            totalAmount += parseFloat(record.value) || 0;
        });
    });
    
    // Update collection info
    document.getElementById('collectionCount').textContent = invoiceCollection.length;
    document.getElementById('collectionTotalAmount').textContent = formatNumber(totalAmount);
    
    // Show the modal
    document.getElementById('collectionModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Scroll to top of the table
    document.querySelector('.table-responsive').scrollTop = 0;
}

function closeCollectionModal() {
    document.getElementById('collectionModal').style.display = 'none';
    document.body.style.overflow = '';
}

function clearCollection() {
    if (confirm('Are you sure you want to clear your collection? This cannot be undone.')) {
        invoiceCollection = [];
        closeCollectionModal();
        showToast('Collection cleared successfully');
    }
}

function printCollection() {
    if (invoiceCollection.length === 0) {
        alert('Your collection is empty. Nothing to print.');
        return;
    }
    
    // Create a print window
    const printWindow = window.open('', '_blank');
    
    // Create the table HTML
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
                <tr>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">ID</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Release Date</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Site</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">PO</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Vendor</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Invoice</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white; text-align: right;">Amount</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Status</th>
                    <th style="padding: 8px; border: 1px solid #ddd; background-color: #4a6fa5; color: white;">Note</th>
                </tr>
            </thead>
            <tbody>`;
    
    // Calculate total amount
    let totalAmount = 0;
    
    // Add rows for collection items
    invoiceCollection.forEach((record, index) => {
        tableHTML += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.site || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${formatPoNumber(record.poNumber)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.vendor || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.invoiceNumber || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${record.value ? formatNumber(record.value) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.status || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${record.note || '-'}</td>
            </tr>`;
        
        totalAmount += parseFloat(record.value) || 0;
    });
    
    tableHTML += `</tbody>
        <tfoot>
            <tr>
                <td colspan="6" style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-align: right;">Total</td>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-align: right;">${formatNumber(totalAmount)}</td>
                <td colspan="2" style="padding: 8px; border: 1px solid #ddd;"></td>
            </tr>
        </tfoot>
    </table>`;
    
    // Write the content to the print window
    printWindow.document.write(`
        <html>
            <head>
                <title>Invoice Collection Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #4a6fa5; text-align: center; }
                    h2 { color: #4a6fa5; text-align: center; margin-top: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 8px; border: 1px solid #ddd; }
                    th { background-color: #4a6fa5; color: white; }
                    .numeric { text-align: right; }
                    @page { size: auto; margin: 10mm; }
                    @media print {
                        body { padding: 0; margin: 0; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                    }
                </style>
            </head>
            <body>
                <h1>Invoice Collection Report</h1>
                <p style="text-align: center; margin-bottom: 5px;">Generated on: ${new Date().toLocaleString()}</p>
                <p style="text-align: center; margin-bottom: 20px; font-weight: bold;">Total Items: ${invoiceCollection.length}</p>
                ${tableHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// Helper function to show toast messages
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Get selected records from the tracker table
function getSelectedTrackerRecords() {
    const rows = document.querySelectorAll('#recordsTable tbody tr');
    const selectedRecords = [];
    
    rows.forEach((row, index) => {
        // We'll use visual selection (highlighted row) for tracker selection
        if (row.classList.contains('selected-row')) {
            if (currentFilteredRecords && index < currentFilteredRecords.length) {
                selectedRecords.push(currentFilteredRecords[index]);
            }
        }
    });
    
    return selectedRecords;
}

// Add to collection from tracker
function addToCollectionFromTracker() {
    const selectedRows = document.querySelectorAll('#recordsTable tbody tr.selected-row');
    const selectedRecords = [];
    
    selectedRows.forEach(row => {
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);
        if (currentFilteredRecords && rowIndex < currentFilteredRecords.length) {
            selectedRecords.push(currentFilteredRecords[rowIndex]);
        }
    });
    
    if (selectedRecords.length === 0) {
        alert('Please select at least one record (click on a row) to add to collection');
        return;
    }
    
    // Add only records that aren't already in the collection
    selectedRecords.forEach(record => {
        if (!invoiceCollection.some(item => 
            item.poNumber === record.poNumber && 
            item.invoiceNumber === record.invoiceNumber)) {
            invoiceCollection.push(record);
        }
    });
    
    // Show success message
    showToast(`${selectedRecords.length} item(s) added to collection. Total: ${invoiceCollection.length}`);
}

// REFACTORED: openAddPaymentModal
function openAddPaymentModal() {
    const selected = getSelectedTrackerRecords();
    if (selected.length === 0) {
        alert('Please select at least one invoice to add a payment entry.');
        return;
    }

    pendingPaymentRecords = selected;
    const paymentList = document.getElementById('paymentInvoiceList');
    paymentList.innerHTML = '';
    
    let totalValue = 0;
    
    pendingPaymentRecords.forEach((record, index) => {
        const li = document.createElement('li');
        const value = parseFloat(record.value) || 0;
        li.textContent = `${index + 1}. PO: ${formatPoNumber(record.poNumber)} / INV: ${record.invoiceNumber || 'N/A'} — Amount: ${formatNumber(value)}`;
        paymentList.appendChild(li);
        totalValue += value;
    });

    document.getElementById('paymentTotalAmount').value = formatNumber(totalValue);
    document.getElementById('datePaidInput').valueAsDate = new Date(); // Set default date
    document.getElementById('addPaymentModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// REFACTORED: closeAddPaymentModal
function closeAddPaymentModal() {
    document.getElementById('addPaymentModal').style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('datePaidInput').value = '';
    pendingPaymentRecords = [];
}

// REFACTORED & FIXED: addPaymentEntry
async function addPaymentEntry() {
    const datePaid = document.getElementById('datePaidInput').value.trim();

    if (!datePaid) {
        alert('Please select a payment date for this batch.');
        return;
    }
    
    if (pendingPaymentRecords.length === 0) {
        alert('No records selected for payment.');
        return;
    }

    showLoading();
    
    const paymentsRef = database.ref('invoicePayments');
    let successCount = 0;
    let errorCount = 0;

    for (const record of pendingPaymentRecords) {
        try {
            const originalPo = record.poNumber;
            const formattedPo = formatPoNumber(record.poNumber);
            const paymentKey = `${record.site}-${formattedPo}-${record.vendor}`.replace(/[.#$/[\]]/g, '_');
            const recordRef = paymentsRef.child(paymentKey);

            // Using a transaction to safely read and update the payment count
            const { committed, snapshot } = await recordRef.transaction(currentData => {
                if (currentData === null) {
                    // This is the first payment (P1)
                    return {
                        site: record.site || '',
                        poNumber: formattedPo,
                        vendor: record.vendor || '',
                        paymentEntries: {
                            [new Date().getTime()]: {
                                paymentNumber: 'P1',
                                amountPaid: parseFloat(record.value) || 0,
                                datePaid: datePaid,
                                invoiceNumber: record.invoiceNumber || '',
                                originalPoNumber: originalPo, // Store the original PO for matching
                                timestamp: new Date().toISOString()
                            }
                        }
                    };
                } else {
                    // This is a subsequent payment
                    const paymentCount = currentData.paymentEntries ? Object.keys(currentData.paymentEntries).length : 0;
                    const nextPaymentNum = `P${paymentCount + 1}`;
                    
                    if (!currentData.paymentEntries) {
                        currentData.paymentEntries = {};
                    }
                    
                    currentData.paymentEntries[new Date().getTime()] = {
                        paymentNumber: nextPaymentNum,
                        amountPaid: parseFloat(record.value) || 0,
                        datePaid: datePaid,
                        invoiceNumber: record.invoiceNumber || '',
                        originalPoNumber: originalPo, // Store the original PO for matching
                        timestamp: new Date().toISOString()
                    };
                    return currentData;
                }
            });

            if (committed) {
                successCount++;
            } else {
                console.log(`Transaction for PO ${formattedPo} was aborted.`);
                errorCount++;
            }
        } catch (error) {
            console.error('Firebase Transaction Failed!', error);
            alert(`An error occurred while saving payment for PO: ${formatPoNumber(record.poNumber)}. Check the console for details.`);
            errorCount++;
        }
    }

    hideLoading();
    showToast(`${successCount} payment entries added. ${errorCount > 0 ? `${errorCount} failed.` : ''}`);
    closeAddPaymentModal();
    
    // Refresh the payments table with the latest data
    loadPaymentsFromFirebase();
}

// New function to search the payments table
function searchPayments() {
    const term = document.getElementById('paymentsSearchTerm').value.toLowerCase();
    const filtered = payments.filter(payment =>
        (payment.site && payment.site.toLowerCase().includes(term)) ||
        (payment.poNumber && String(payment.poNumber).toLowerCase().includes(term)) ||
        (payment.vendor && payment.vendor.toLowerCase().includes(term)) ||
        (payment.paymentEntries && Object.values(payment.paymentEntries).some(entry => 
            (entry.paymentNumber && entry.paymentNumber.toLowerCase().includes(term))
        ))
    );
    refreshPaymentsTable(filtered);
}

function clearPaymentsSearch() {
    document.getElementById('paymentsSearchTerm').value = '';
    refreshPaymentsTable(); // Resets to empty
}

// REFACTORED: refreshPaymentsTable to implement the new grouped layout
function refreshPaymentsTable(filteredPayments = []) {
    const tableBody = document.querySelector('#invoicePaymentsTable tbody');
    tableBody.innerHTML = '';
    
    const displayPayments = filteredPayments;
    
    if (displayPayments.length === 0) {
        domCache.invoicePaymentsTable.style.display = 'none';
        return;
    }
    
    domCache.invoicePaymentsTable.style.display = 'table';

    displayPayments.forEach(payment => {
        const po = formatPoNumber(payment.poNumber);
        // Main Group Row
        const groupRow = document.createElement('tr');
        groupRow.className = 'payment-group-row';
        groupRow.innerHTML = `
            <td>
                <button class="toggle-details-btn" data-target="details-${po}">
                    <i class="fas fa-plus"></i>
                </button>
            </td>
            <td>${po || '-'}</td>
            <td>${payment.site || '-'}</td>
            <td>${payment.vendor || '-'}</td>
        `;
        tableBody.appendChild(groupRow);

        // Hidden Details Row
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'payment-details-row';
        detailsRow.id = `details-${po}`;
        
        let totalPaid = 0;
        let detailsHtml = `
            <td colspan="4">
                <table class="payment-details-table">
                    <thead>
                        <tr>
                            <th>Payment No.</th>
                            <th>Amount Paid</th>
                            <th>Date Paid</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        if (payment.paymentEntries) {
            const sortedEntryKeys = Object.keys(payment.paymentEntries).sort();
            sortedEntryKeys.forEach(entryKey => {
                const entry = payment.paymentEntries[entryKey];
                const paymentKey = `${payment.site}-${po}-${payment.vendor}`.replace(/[.#$/[\]]/g, '_');
                const onclickAction = `openEditPaymentModal(${JSON.stringify(paymentKey)}, ${JSON.stringify(entryKey)}, ${JSON.stringify(entry)})`;
                totalPaid += parseFloat(entry.amountPaid) || 0;
                
                detailsHtml += `
                    <tr>
                        <td>${entry.paymentNumber || '-'}</td>
                        <td>${entry.amountPaid ? formatNumber(entry.amountPaid) : '-'}</td>
                        <td>${entry.datePaid ? formatDate(entry.datePaid) : '-'}</td>
                        <td class="action-btns">
                            <button class="btn btn-primary" style="padding: 6px 10px; font-size: 14px;" onclick='${onclickAction}'>
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>`;
            });
        }
        
        detailsHtml += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td class="total-row" style="text-align:right; font-weight:bold;">TOTAL</td>
                            <td class="total-row" style="font-weight:bold;">${formatNumber(totalPaid)}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </td>`;
        
        detailsRow.innerHTML = detailsHtml;
        tableBody.appendChild(detailsRow);
    });

    // Add event listeners to toggle buttons
    document.querySelectorAll('.toggle-details-btn').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const detailsRow = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (detailsRow.style.display === 'table-row') {
                detailsRow.style.display = 'none';
                icon.classList.remove('fa-minus');
                icon.classList.add('fa-plus');
            } else {
                detailsRow.style.display = 'table-row';
                icon.classList.remove('fa-plus');
                icon.classList.add('fa-minus');
            }
        });
    });
}


// NEW: Functions for editing payments
function openEditPaymentModal(paymentKey, entryKey, entryData) {
    document.getElementById('editPaymentKey').value = paymentKey;
    document.getElementById('editPaymentEntryKey').value = entryKey;
    
    const parentPayment = payments.find(p => `${p.site}-${formatPoNumber(p.poNumber)}-${p.vendor}`.replace(/[.#$/[\]]/g, '_') === paymentKey);
    const identifier = `${entryData.paymentNumber} for PO ${parentPayment ? formatPoNumber(parentPayment.poNumber) : 'N/A'}`;
    document.getElementById('editPaymentIdentifier').textContent = identifier;

    document.getElementById('editPaymentNumberInput').value = entryData.paymentNumber;
    document.getElementById('editAmountPaidInput').value = entryData.amountPaid;
    document.getElementById('editDatePaidInput').value = entryData.datePaid;
    
    document.getElementById('editPaymentModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeEditPaymentModal() {
    document.getElementById('editPaymentModal').style.display = 'none';
    document.body.style.overflow = '';
}

function savePaymentUpdate() {
    const paymentKey = document.getElementById('editPaymentKey').value;
    const entryKey = document.getElementById('editPaymentEntryKey').value;
    const newAmount = document.getElementById('editAmountPaidInput').value;
    const newDate = document.getElementById('editDatePaidInput').value;
    
    if (!paymentKey || !entryKey || !newAmount || !newDate) {
        alert('All fields are required.');
        return;
    }
    
    showLoading();

    const entryRef = database.ref(`invoicePayments/${paymentKey}/paymentEntries/${entryKey}`);
    
    entryRef.update({
        amountPaid: parseFloat(newAmount),
        datePaid: newDate
    }).then(() => {
        hideLoading();
        showToast('Payment updated successfully!');
        closeEditPaymentModal();
        loadPaymentsFromFirebase();
    }).catch(error => {
        hideLoading();
        showToast('Error updating payment: ' + error.message);
        console.error('Update error:', error);
    });
}

// === Approval/Approver Feature (Injected) ===
let approvers = [];
let pendingWhatsAppRecord = null;

function loadApprovers() {
  return database.ref('Approver').once('value').then(snap => {
    const data = snap.val() || {};
    approvers = Object.values(data).map(x => {
      const name    = (x.Name || x.name || '').toString().trim();
      const pos     = (x.Position || x.position || '').toString().trim();
      const mobile  = (x['Mobile Number'] || x.Mobile || x.mobile || '').toString().replace(/\D/g,'');
      const email   = (x.Email || x.email || '').toString().trim();
      return { name, position: pos, mobile, email };
    }).filter(a => a.name && a.mobile);
    console.log(`Approvers loaded: ${approvers.length}`);
  }).catch(err => {
    console.error('Approver load error:', err);
    approvers = [];
  });
}

function openWhatsAppModal(rec, type) {
  pendingWhatsAppRecord = rec;
  const el = (id) => document.getElementById(id);
  
  const modal = el('approvalModal');
  const titleEl = modal.querySelector('h2');
  const sendBtn = el('sendApprovalBtn');

  if (type === 'approval') {
      titleEl.textContent = 'Send Approval via WhatsApp';
      sendBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Send via WhatsApp';
      sendBtn.onclick = () => sendWhatsAppMessage('approval');
  } else if (type === 'update') {
      titleEl.textContent = 'Request Update via WhatsApp';
      sendBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Send Request';
      sendBtn.onclick = () => sendWhatsAppMessage('update');
  }


  if (el('apprSite'))   el('apprSite').textContent   = rec.site || '-';
  if (el('apprPO'))     el('apprPO').textContent     = formatPoNumber(rec.poNumber);
  if (el('apprVendor')) el('apprVendor').textContent = rec.vendor || '-';
  if (el('apprAmount')) el('apprAmount').textContent = rec.value ? formatNumber(rec.value) : '-';

  const sel = el('approverSelect');
  if (sel) {
    sel.innerHTML = '<option value="">— Select person —</option>';
  }

  loadApprovers().then(() => {
    if (!sel) return;
    if (!approvers || approvers.length === 0) {
      sel.options[0].textContent = 'No contacts found (upload in Data Management)';
      return;
    }
    approvers.forEach((a, idx) => {
      const opt = document.createElement('option');
      opt.value = (a.mobile || '').toString().replace(/\D/g,'');
      opt.textContent = `${a.name} — ${a.position}`;
      sel.appendChild(opt);
    });
  });

  if (modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
}


function closeApprovalModal() {
  const modal = document.getElementById('approvalModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  const msg = document.getElementById('approvalMessage');
  if (msg) msg.value = '';
  pendingWhatsAppRecord = null;
}

function sendWhatsAppMessage(type) {
  if (!pendingWhatsAppRecord) return;
  const sel = document.getElementById('approverSelect');
  const msgExtra = (document.getElementById('approvalMessage')?.value || '').trim();

  const waNumber = (sel && sel.value ? sel.value : '').replace(/\D/g,'');
  if (!waNumber) { alert('Please choose a person to send to.'); return; }
  
  const r = pendingWhatsAppRecord;
  
  let messageHeader = (type === 'approval')
        ? `*Invoice Approval Request*\n\n`
        : `*Invoice Status Update Request*\n\n`;
  
  let message = messageHeader;
  message += `Site: ${r.site || 'N/A'}\n`;
  message += `PO: ${formatPoNumber(r.poNumber) || 'N/A'}\n`;
  message += `Vendor: ${r.vendor || 'N/A'}\n`;
  message += `Amount: ${r.value ? formatNumber(r.value) : 'N/A'}\n`;
  if (r.status) message += `Status: ${r.status}\n`;

  if (r.fileName) {
    const pdfUrl = `${PDF_BASE_PATH}${encodeURIComponent(r.fileName)}`;
    message += `\nInvoice PDF: ${pdfUrl}\n`;
  }

  if (msgExtra) message += `\nNote: ${msgExtra}\n`;
  message += `\nSent from IBA Invoice Status Tracker`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${waNumber}?text=${encodedMessage}`, '_blank');
  closeApprovalModal();
}


function downloadApproverTemplate() {
  const headers = ['Name','Position','Mobile Number','Email'].join(',');
  const blob = new Blob([headers], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'approver_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function uploadApproverCSV() {
  const file = document.getElementById('approverCsvInput').files[0];
  const status = document.getElementById('approverUploadStatus');
  if (!file) { if (status) { status.textContent = 'Please select an Approver CSV file'; status.className = 'upload-status error'; } return; }
  if (typeof showLoading === 'function') showLoading();
  if (status) { status.textContent = 'Processing Approver CSV...'; status.className = 'upload-status'; }

  const reader = new FileReader();
  reader.onload = (e) => {
    Papa.parse(e.target.result, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data || [];
        if (rows.length === 0) { if (status) { status.textContent = 'No valid rows in CSV'; status.className = 'upload-status error'; } if (typeof hideLoading === 'function') hideLoading(); return; }
        const obj = {};
        rows.forEach((r, i) => {
          const rec = {
            Name: (r['Name'] || '').toString().trim(),
            Position: (r['Position'] || '').toString().trim(),
            'Mobile Number': (r['Mobile Number'] || r['Mobile'] || '').toString().replace(/\D/g,''),
            Email: (r['Email'] || '').toString().trim()
          };
          if (rec.Name && rec['Mobile Number']) obj[i] = rec;
        });
        database.ref('Approver').set(obj).then(()=>{
          if (status) { status.textContent = `Uploaded ${Object.keys(obj).length} approver(s) to Firebase`; status.className = 'upload-status success'; }
          if (typeof hideLoading === 'function') hideLoading();
          loadApprovers();
        }).catch(err=>{
          if (status) { status.textContent = `Error uploading approvers: ${err.message}`; status.className = 'upload-status error'; }
          if (typeof hideLoading === 'function') hideLoading();
        });
      },
      error: (error) => {
        if (status) { status.textContent = `Error parsing CSV: ${error.message}`; status.className = 'upload-status error'; }
        if (typeof hideLoading === 'function') hideLoading();
      }
    });
  };
  reader.readAsText(file);
}


// --- Bottom App Nav wiring ---
function handleBottomNav(btn) {
  const target = btn.getAttribute('data-target');
  if (!target) return;
  if (typeof showSection === 'function') showSection(target);
  document.querySelectorAll('.bottom-app-nav .nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // sync with hamburger
  const map = {
    mainPageSection: '.mobile-menu .menu-item.main-page, .menu-item.main-page',
    invoiceSection: '.mobile-menu .menu-item[data-section="invoiceSection"], .menu-item[data-section="invoiceSection"]',
    statementSection: '.mobile-menu .menu-item[data-section="statementSection"], .menu-item[data-section="statementSection"]',
    invoicePaymentsSection: '.mobile-menu .menu-item.payments, .menu-item.payments'
  };
  document.querySelectorAll('.mobile-menu .menu-item, .menu-item').forEach(mi => mi.classList.remove('active'));
  if (map[target]) {
    const el = document.querySelector(map[target]);
    if (el) el.classList.add('active');
  }
}

// Keep bottom nav active state if other code calls showSection
(function(){
  if (typeof showSection !== 'function') return;
  const orig = showSection;
  window.showSection = function(sectionId){
    orig(sectionId);
    const btn = document.querySelector(`.bottom-app-nav .nav-btn[data-target="${sectionId}"]`);
    if (btn){
      document.querySelectorAll('.bottom-app-nav .nav-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    }
  };
})();

function openIPCFromBottom(){
  document.querySelectorAll('.bottom-app-nav .nav-btn').forEach(b=>b.classList.remove('active'));
  const ipcBtn = Array.from(document.querySelectorAll('.bottom-app-nav .nav-btn span')).find(s=>s.textContent.trim()==='IPC');
  if(ipcBtn) ipcBtn.parentElement.classList.add('active');
  window.open('https://ibaport.site/IPC/', '_blank');
}