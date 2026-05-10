// ======================
// Application Version
// ======================
const APP_VERSION = "v5.7 (Vendor CSV Auto-Fill + Vendor/Site Search)";

// ======================
// Firebase Configuration
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyAt0fLWcfgGAWV4yiu4mfhc3xQ5ycolgnU",
  authDomain: "payment-report-23bda.firebaseapp.com",
  projectId: "payment-report-23bda",
  storageBucket: "payment-report-23bda.appspot.com",
  messagingSenderId: "575646169000",
  appId: "1:575646169000:web:e7c4a9222ffe7753138f9d",
  measurementId: "G-X4WBLDGLHQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const paymentsRef = database.ref('payments');
const vendorsRef = database.ref('vendors');

// ======================
// DOM Elements
// ======================
const elements = {
  // Auth elements
  loginScreen: document.getElementById('loginScreen'),
  loginForm: document.getElementById('loginForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  loginBtn: document.getElementById('loginBtn'),
  loginError: document.getElementById('loginError'),
  loginVersionDisplay: document.getElementById('loginVersionDisplay'),
  
  // Dashboard & Nav
  mainApp: document.getElementById('mainApp'),
  logoutLink: document.getElementById('logoutLink'),
  userEmailDisplay: document.getElementById('userEmailDisplay'),
  versionDisplay: document.getElementById('versionDisplay'),
  paymentLink: document.getElementById('paymentLink'),
  vendorLink: document.getElementById('vendorLink'),
  recordsLink: document.getElementById('recordsLink'),
  
  // Sections
  paymentSection: document.getElementById('paymentSection'),
  vendorSection: document.getElementById('vendorSection'),
  recordsSection: document.getElementById('recordsSection'),

  // Search
  searchPoNo: document.getElementById('searchPoNo'),
  searchBtn: document.getElementById('searchBtn'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  searchResults: document.getElementById('searchResults'),
  searchResultsBody: document.getElementById('searchResultsBody'),
  noResultsAlert: document.getElementById('noResultsAlert'),
  addNewBtn: document.getElementById('addNewBtn'),

  // Form & Modals
  paymentForm: document.getElementById('paymentForm'),
  saveBtn: document.getElementById('saveBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  clearBtn: document.getElementById('clearBtn'),
  addNewPaymentBtn: document.getElementById('addNewPaymentBtn'),
  
  // Initialize Modals using Bootstrap API
  paymentModal: new bootstrap.Modal(document.getElementById('paymentModal')),
  reportModal: new bootstrap.Modal(document.getElementById('reportModal')),
  
  // Vendors & Import
  vendorList: document.getElementById('vendorList'),
  vendorIdList: document.getElementById('vendorIdList'),
  vendorUploadForm: document.getElementById('vendorUploadForm'),
  importBtn: document.getElementById('importBtn'),
  paymentCsv: document.getElementById('paymentCsv'),
  overwriteData: document.getElementById('overwriteData'),
  downloadTemplateBtn: document.getElementById('downloadTemplateBtn'),
  
  // Delete
  deleteAllBtn: document.getElementById('deleteAllBtn'),
  confirmDelete: document.getElementById('confirmDelete'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  
  // Reports
  printReportBtn: document.getElementById('printReportBtn')
};

// Form fields configuration
const fields = [
  'paymentNo', 'chequeNo', 'site', 'vendor', 'vendorId', 'poNo',
  'poValue', 'certifiedAmount', 'retention', 'payment', 'datePaid', 'note'
];

// Global variables
let editId = null;
let isEditing = false;
let vendorSearchTimeout = null;
let allPaymentsData = {}; 
let currentSearchMode = 'po'; // 'po' or 'vendor'

// ======================
// Initialization
// ======================
document.addEventListener('DOMContentLoaded', function() {
  setupAuthListeners();
});

// ======================
// Auth Functions
// ======================
function setupAuthListeners() {
  elements.loginVersionDisplay.textContent = APP_VERSION;
  auth.onAuthStateChanged(user => {
    if (user) {
      elements.mainApp.style.display = 'block';
      elements.loginScreen.style.display = 'none';
      elements.userEmailDisplay.textContent = user.email;
      elements.versionDisplay.textContent = APP_VERSION;
      initializeApplication();
    } else {
      elements.mainApp.style.display = 'none';
      elements.loginScreen.style.display = 'flex';
      elements.userEmailDisplay.textContent = '';
    }
  });
  elements.loginForm.addEventListener('submit', handleLogin);
}

function handleLogin(e) {
  e.preventDefault();
  const email = elements.loginEmail.value;
  const password = elements.loginPassword.value;

  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = 'Logging in...';
  elements.loginError.style.display = 'none';

  auth.signInWithEmailAndPassword(email, password)
    .catch(error => {
      elements.loginError.textContent = error.message;
      elements.loginError.style.display = 'block';
    })
    .finally(() => {
      elements.loginBtn.disabled = false;
      elements.loginBtn.textContent = 'Sign In';
    });
}

function handleLogout(e) {
  e.preventDefault();
  auth.signOut().catch(error => console.error('Logout Error:', error));
}

function initializeApplication() {
  setupEventListeners();
  loadVendorsIfNeeded();
  resetForm();
  resetSearch();
  setupSearchModeListeners();
}

// ======================
// Search Mode Setup
// ======================
function setupSearchModeListeners() {
    const searchByPo = document.getElementById('modePo');
    const searchByVendor = document.getElementById('modeVendor');
    
    if (searchByPo) {
        searchByPo.addEventListener('change', () => {
            currentSearchMode = 'po';
            elements.searchPoNo.placeholder = 'Enter PO Number to search...';
            resetSearch();
        });
    }
    
    if (searchByVendor) {
        searchByVendor.addEventListener('change', () => {
            currentSearchMode = 'vendor';
            elements.searchPoNo.placeholder = 'Enter Vendor Name or Site (min 3 letters)...';
            resetSearch();
        });
    }
}

// ======================
// Event Listeners Setup
// ======================
function setupEventListeners() {
  // Navigation (Sidebar)
  elements.paymentLink.addEventListener('click', showPaymentSection);
  elements.vendorLink.addEventListener('click', showVendorSection);
  elements.recordsLink.addEventListener('click', showRecordsSection);
  elements.logoutLink.addEventListener('click', handleLogout);

  // Search
  elements.searchBtn.addEventListener('click', searchPayments);
  elements.searchPoNo.addEventListener('keypress', e => { if (e.key === 'Enter') searchPayments(); });
  elements.clearSearchBtn.addEventListener('click', resetSearch);
  
  // Main Action Button (Open Modal)
  elements.addNewBtn.addEventListener('click', showAddNewForm);

  // Form actions inside Modal
  elements.paymentForm.addEventListener('submit', handleFormSubmit);
  elements.cancelBtn.addEventListener('click', cancelEdit);
  elements.clearBtn.addEventListener('click', resetForm);
  elements.addNewPaymentBtn.addEventListener('click', addNewPaymentFromEdit);

  // Dynamic Table Actions (Edit/Delete/Report)
  elements.searchResultsBody.addEventListener('click', handleActionClick);

  // Inputs - Logic for auto-calculations
  document.getElementById('vendor').addEventListener('input', handleVendorNameInput);
  document.getElementById('vendor').addEventListener('change', handleVendorNameChange);
  document.getElementById('vendor').addEventListener('blur', handleVendorNameBlur);
  document.getElementById('vendorId').addEventListener('input', handleVendorIdInput);
  document.getElementById('vendorId').addEventListener('change', handleVendorIdChange);
  document.getElementById('vendorId').addEventListener('blur', handleVendorIdBlur);
  document.getElementById('certifiedAmount').addEventListener('input', calculatePayment);
  document.getElementById('retention').addEventListener('input', calculatePayment);
  document.getElementById('retentionPercentage').addEventListener('input', calculateRetentionFromPercentage);
  document.getElementById('retentionBaseAmount').addEventListener('input', calculateRetentionFromPercentage);
  
  // Auto-fill base amount from Certified Amount
  document.getElementById('certifiedAmount').addEventListener('input', (e) => {
    document.getElementById('retentionBaseAmount').value = e.target.value;
  });

  // Tools & Imports
  elements.vendorUploadForm.addEventListener('submit', uploadVendorCSV);
  elements.importBtn.addEventListener('click', importPaymentCSV);
  elements.downloadTemplateBtn.addEventListener('click', downloadCSVTemplate);
  elements.confirmDelete.addEventListener('change', toggleDeleteButton);
  elements.confirmDeleteBtn.addEventListener('click', deleteAllPayments);
  elements.printReportBtn.addEventListener('click', printReport);
}

// ======================
// Navigation Functions
// ======================
function showPaymentSection(e) {
    if(e) e.preventDefault();
    elements.paymentSection.style.display = 'block';
    elements.vendorSection.style.display = 'none';
    elements.recordsSection.style.display = 'none';
    
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    elements.paymentLink.classList.add('active');
}
function showVendorSection(e) {
  if(e) e.preventDefault();
  elements.paymentSection.style.display = 'none';
  elements.vendorSection.style.display = 'block';
  elements.recordsSection.style.display = 'none';
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  elements.vendorLink.classList.add('active');
}
function showRecordsSection(e) {
  if(e) e.preventDefault();
  elements.paymentSection.style.display = 'none';
  elements.vendorSection.style.display = 'none';
  elements.recordsSection.style.display = 'block';
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  elements.recordsLink.classList.add('active');
}

// ======================
// Search Functions
// ======================
async function searchPayments() {
    const searchTerm = elements.searchPoNo.value.trim();
    
    if (!searchTerm) {
        alert('Please enter a search term');
        return;
    }
    
    if (currentSearchMode === 'po') {
        await searchByPoNumber(searchTerm);
    } else {
        await searchByVendorOrSite(searchTerm);
    }
}

async function searchByPoNumber(poNo) {
    paymentsRef.orderByChild('poNo').equalTo(poNo).once('value')
        .then(snapshot => {
            elements.searchResults.style.display = 'block';
            elements.searchResultsBody.innerHTML = '';

            if (!snapshot.exists()) {
                showNoResults(poNo);
                elements.addNewBtn.disabled = false;
            } else {
                allPaymentsData = {};
                snapshot.forEach(childSnapshot => {
                    allPaymentsData[childSnapshot.key] = { id: childSnapshot.key, ...childSnapshot.val() };
                });
                showSearchResults(Object.values(allPaymentsData));
                elements.addNewBtn.disabled = false;
            }
        })
        .catch(error => console.error('Error searching payments:', error));
}

async function searchByVendorOrSite(keyword) {
    if (keyword.length < 3) {
        alert('Please enter at least 3 characters for vendor/site search');
        return;
    }
    
    const searchTermLower = keyword.toLowerCase();
    
    try {
        const snapshot = await paymentsRef.once('value');
        
        if (!snapshot.exists()) {
            showNoResultsForVendorSearch(keyword);
            return;
        }
        
        const poGroups = new Map();
        
        snapshot.forEach(childSnapshot => {
            const payment = childSnapshot.val();
            const poNo = payment.poNo;
            
            if (!poNo) return;
            
            const vendorMatch = payment.vendor && payment.vendor.toLowerCase().includes(searchTermLower);
            const siteMatch = payment.site && payment.site.toLowerCase().includes(searchTermLower);
            
            if (vendorMatch || siteMatch) {
                if (!poGroups.has(poNo)) {
                    poGroups.set(poNo, {
                        poNo: poNo,
                        site: payment.site || '',
                        vendor: payment.vendor || '',
                        vendorId: payment.vendorId || '',
                        poValue: payment.poValue || '0',
                        paymentIds: [childSnapshot.key]
                    });
                } else {
                    poGroups.get(poNo).paymentIds.push(childSnapshot.key);
                }
            }
        });
        
        if (poGroups.size === 0) {
            showNoResultsForVendorSearch(keyword);
            return;
        }
        
        showVendorSearchPopup(Array.from(poGroups.values()), keyword);
        
    } catch (error) {
        console.error('Error searching by vendor/site:', error);
        alert('Error performing search. Please try again.');
    }
}

function showVendorSearchPopup(matches, keyword) {
    const modalElement = document.getElementById('vendorSearchModal');
    const modal = new bootstrap.Modal(modalElement);
    const tbody = document.getElementById('vendorSearchResultsBody');
    const keywordSpan = document.getElementById('vendorSearchKeyword');
    
    keywordSpan.textContent = keyword;
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No matching records found</td></tr>';
    } else {
        matches.forEach(match => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => {
                elements.searchPoNo.value = match.poNo;
                modal.hide();
                const originalMode = currentSearchMode;
                currentSearchMode = 'po';
                searchByPoNumber(match.poNo);
                currentSearchMode = originalMode;
                const searchByPoRadio = document.getElementById('searchByPo');
                if (searchByPoRadio) searchByPoRadio.checked = true;
                elements.searchPoNo.placeholder = 'Enter PO Number to search...';
            });
            
            row.innerHTML = `
                <td class="fw-bold">${escapeHtml(match.vendor)}</td>
                <td><span class="badge bg-primary">${escapeHtml(match.poNo)}</span></td>
                <td>${escapeHtml(match.site)}</td>
                <td class="text-end fw-bold text-success">${formatNumber(match.poValue)}</td>
                <td><i class="bi bi-arrow-right-circle text-primary"></i></td>
            `;
            tbody.appendChild(row);
        });
    }
    
    modal.show();
}

function showNoResults(poNo) {
  elements.noResultsAlert.style.display = 'block';
}

function showNoResultsForVendorSearch(keyword) {
    elements.searchResults.style.display = 'block';
    elements.searchResultsBody.innerHTML = `
        <div class="alert alert-warning border-0 shadow-sm">
            <i class="bi bi-exclamation-triangle me-2"></i> 
            No records found matching "${escapeHtml(keyword)}" in Vendor Name or Site.
        </div>
    `;
    elements.noResultsAlert.style.display = 'none';
    allPaymentsData = {};
    elements.addNewBtn.disabled = true;
}

function showSearchResults(payments) {
    elements.noResultsAlert.style.display = 'none';
    elements.searchResultsBody.innerHTML = '';
    if (payments.length === 0) return;

    payments.sort((a, b) => {
        return new Date(a.dateEntered) - new Date(b.dateEntered);
    });
    
    const latestPayment = payments[payments.length - 1];
    const { site, vendor, vendorId, poNo, poValue } = latestPayment;

    const summaryHtml = `
        <div class="card mb-4 bg-white border-0 shadow-sm">
            <div class="card-body p-0">
                <table class="table po-summary-table mb-0">
                    <thead class="bg-light">
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
                            <td class="fw-bold text-primary">${site || ''}</td>
                            <td>${vendor || ''}</td>
                            <td>${vendorId || ''}</td>
                            <td>${poNo || ''}</td>
                            <td class="fw-bold">${formatNumber(poValue) || ''}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const paymentRowsHtml = payments.map(payment => `
        <tr>
            <td class="text-muted small">${formatDate(payment.dateEntered) || ''}</td>
            <td class="fw-bold">${payment.paymentNo || ''}</td>
            <td>${payment.chequeNo || '-'}</td>
            <td class="text-end font-monospace">${formatNumber(payment.certifiedAmount) || ''}</td>
            <td class="text-end font-monospace text-danger">${formatNumber(payment.retention) || ''}</td>
            <td class="text-end font-monospace fw-bold text-success">${formatNumber(payment.payment) || ''}</td>
            <td>${formatDate(payment.datePaid) || ''}</td>
            <td class="text-end">
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-info rounded-start" data-action="report" data-id="${payment.id}" title="Print Report"><i class="bi bi-printer"></i></button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${payment.id}" title="Edit"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger rounded-end" data-action="delete" data-id="${payment.id}" title="Delete"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    const detailsHtml = `
        <div class="card border-0 shadow-sm">
            <div class="card-header bg-white">
                 <i class="bi bi-list-check me-2"></i>Payment History
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table payment-details-table mb-0 table-hover">
                        <thead class="bg-light">
                            <tr>
                                <th>Date Ent.</th>
                                <th>Pay No.</th>
                                <th>Cheque</th>
                                <th class="text-end">Certified</th>
                                <th class="text-end">Retention</th>
                                <th class="text-end">Net Pay</th>
                                <th>Date Paid</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paymentRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    elements.searchResultsBody.innerHTML = summaryHtml + detailsHtml;
}

function handleActionClick(e) {
    const target = e.target.closest('button');
    if (!target) return;
    
    const action = target.dataset.action;
    const id = target.dataset.id;
    
    if (action && id) {
        if (action === 'edit') {
            if (allPaymentsData && allPaymentsData[id]) {
                editPayment(id, allPaymentsData[id]);
            } else {
                paymentsRef.child(id).once('value').then(snapshot => {
                    if (snapshot.exists()) {
                        editPayment(id, snapshot.val());
                    }
                });
            }
        } 
        else if (action === 'delete') {
            confirmDeletePayment(id);
        }
        else if (action === 'report') {
            if (allPaymentsData && allPaymentsData[id]) {
                generateReport(allPaymentsData[id]);
            } else {
                paymentsRef.child(id).once('value').then(snapshot => {
                    if (snapshot.exists()) {
                        generateReport(snapshot.val());
                    }
                });
            }
        }
    }
}

function resetSearch() {
  elements.searchPoNo.value = '';
  elements.searchResults.style.display = 'none';
  elements.noResultsAlert.style.display = 'none';
  allPaymentsData = {};
  elements.addNewBtn.disabled = true; 
}

// ======================
// Form & Modal Functions
// ======================

function showAddNewForm() {
  resetForm();
  
  const firstPaymentKey = Object.keys(allPaymentsData)[0];
  if(firstPaymentKey) {
      const p = allPaymentsData[firstPaymentKey];
      document.getElementById('site').value = p.site || '';
      document.getElementById('vendor').value = p.vendor || '';
      document.getElementById('vendorId').value = p.vendorId || '';
      document.getElementById('poNo').value = p.poNo || '';
      const sorted = Object.values(allPaymentsData).sort((a,b) => new Date(a.dateEntered) - new Date(b.dateEntered));
      document.getElementById('poValue').value = sorted[sorted.length-1].poValue || '';
  } else {
     document.getElementById('poNo').value = elements.searchPoNo.value.trim();
  }

  document.getElementById('paymentModalLabel').textContent = 'Add New Payment';
  isEditing = false;
  editId = null;
  elements.saveBtn.textContent = 'Save Record';
  elements.addNewPaymentBtn.style.display = 'none';

  const fieldsToHighlight = ['certifiedAmount', 'retention', 'payment', 'datePaid', 'note'];
  fieldsToHighlight.forEach(fieldId => {
      document.getElementById(fieldId).classList.add('highlight-field');
  });

  elements.paymentModal.show();
}

function editPayment(id, payment) {
  editId = id;
  isEditing = true;

  fields.forEach(field => {
    document.getElementById(field).value = formatFieldValue(field, payment[field]) || '';
  });

  document.getElementById('retentionBaseAmount').value = formatNumber(payment.certifiedAmount) || '';
  document.getElementById('retentionPercentage').value = '';

  elements.saveBtn.textContent = 'Update Record';
  elements.addNewPaymentBtn.style.display = 'inline-block';
  document.getElementById('paymentModalLabel').textContent = 'Edit Payment';

  const fieldsToHighlight = ['certifiedAmount', 'retention', 'payment', 'datePaid', 'note'];
  fieldsToHighlight.forEach(fieldId => {
      document.getElementById(fieldId).classList.add('highlight-field');
  });

  elements.paymentModal.show();
}

function handleFormSubmit(e) {
  e.preventDefault();
  savePayment();
}

async function savePayment() {
  calculatePayment();

  const paymentData = {};
  fields.forEach(field => {
    const value = document.getElementById(field).value;
    paymentData[field] = ['poValue', 'certifiedAmount', 'retention', 'payment'].includes(field)
      ? value.replace(/,/g, '')
      : value;
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  paymentData.dateEntered = `${year}-${month}-${day}`;

  try {
    if (isEditing) {
      await paymentsRef.child(editId).update(paymentData);
      alert('Payment updated successfully!');
    } else {
      if (!paymentData.paymentNo) {
        const nextNumber = await getNextAvailablePVNNumber(paymentData);
        paymentData.paymentNo = generatePaymentNumber(nextNumber);
      }
      
      await paymentsRef.push(paymentData);
      alert('Payment added successfully!');
    }
    
    elements.paymentModal.hide();
    resetForm();
    searchPayments();
  } catch (error) { 
      console.error('Error saving payment:', error); 
      alert('Error saving data: ' + error.message);
  }
}

async function addNewPaymentFromEdit() {
  if (!isEditing) return;

  const paymentData = {};
  fields.forEach(field => {
    const value = document.getElementById(field).value;
    paymentData[field] = ['poValue', 'certifiedAmount', 'retention', 'payment'].includes(field)
      ? value.replace(/,/g, '')
      : value;
  });

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    paymentData.dateEntered = `${year}-${month}-${day}`;
      
    if (!paymentData.paymentNo) {
        const nextNumber = await getNextAvailablePVNNumber(paymentData);
        paymentData.paymentNo = generatePaymentNumber(nextNumber);
    }
      
    paymentData.chequeNo = ''; 
    paymentData.datePaid = '';
    paymentData.note = ''; 
    
    calculatePayment();
    paymentData.payment = document.getElementById('payment').value.replace(/,/g, '');

    await paymentsRef.push(paymentData);
    alert('New payment added successfully!');
    elements.paymentModal.hide(); 
    resetForm();
    searchPayments();
  } catch (error) { console.error('Error adding new payment:', error); }
}

function resetForm() {
  document.getElementById('paymentForm').reset();
  document.getElementById('note').value = ''; 
  editId = null;
  isEditing = false;
  elements.saveBtn.textContent = 'Save Record';
  elements.addNewPaymentBtn.style.display = 'none';
  document.getElementById('paymentModalLabel').textContent = 'Add New Payment';
  document.getElementById('datePaid').value = '';

  const fieldsToHighlight = ['certifiedAmount', 'retention', 'payment', 'datePaid', 'note'];
  fieldsToHighlight.forEach(fieldId => {
      document.getElementById(fieldId).classList.remove('highlight-field');
  });
}

function cancelEdit() {
    elements.paymentModal.hide();
    resetForm();
}

// ======================
// Vendor Functions
// ======================

const VENDORS_CSV_URL = 'https://raw.githubusercontent.com/DC-database/Hub/main/Vendors.csv';
const VENDOR_SUGGESTION_LIMIT = 50;

let vendorsCache = [];
let vendorsByName = new Map();
let vendorsById = new Map();
let vendorsLoaded = false;
let vendorsLoadPromise = null;

function loadVendorsIfNeeded() {
  if (vendorsLoaded) return Promise.resolve();
  if (vendorsLoadPromise) return vendorsLoadPromise;

  vendorsLoadPromise = (async () => {
    try {
      const csvVendors = await fetchVendorsFromCsvUrl(VENDORS_CSV_URL);
      if (!Array.isArray(csvVendors) || csvVendors.length === 0) throw new Error('CSV vendor list is empty');
      vendorsCache = csvVendors;
      buildVendorIndexes(vendorsCache);
      vendorsLoaded = true;
    } catch (err) {
      console.warn('Vendors.csv load failed; falling back to Firebase vendors list.', err);
      try {
        const snapshot = await vendorsRef.once('value');
        const list = [];
        if (snapshot.exists()) {
          snapshot.forEach(childSnapshot => {
            const v = childSnapshot.val();
            if (v && v.name && v.id) {
              list.push({ name: String(v.name).trim(), id: String(v.id).trim() });
            }
          });
        }
        vendorsCache = list;
        buildVendorIndexes(vendorsCache);
        vendorsLoaded = true;
      } catch (err2) {
        console.error('Failed to load vendors from Firebase as well.', err2);
        vendorsCache = [];
        buildVendorIndexes(vendorsCache);
        vendorsLoaded = true;
      }
    }
  })().finally(() => { vendorsLoadPromise = null; });

  return vendorsLoadPromise;
}

function buildVendorIndexes(list) {
  vendorsByName = new Map();
  vendorsById = new Map();
  (list || []).forEach(v => {
    const name = String(v?.name || '').trim();
    const id = String(v?.id || '').trim();
    if (!name || !id) return;
    vendorsByName.set(name.toLowerCase(), { name, id });
    vendorsById.set(id.toLowerCase(), { name, id });
  });
}

async function fetchVendorsFromCsvUrl(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseVendorCsv(text);
}

function parseVendorCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => String(h || '').trim());

  const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name');
  const idIndex = headers.findIndex(h => {
    const k = h.toLowerCase();
    return k === 'supplier id' || k === 'supplierid' || k === 'supplier_id';
  });

  if (nameIndex === -1 || idIndex === -1) {
    throw new Error('Invalid Vendors.csv headers. Expected: "Name" and "Supplier ID".');
  }

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const name = String(row[nameIndex] ?? '').trim();
    const id = String(row[idIndex] ?? '').trim();
    if (name && id) out.push({ name, id });
  }
  return out;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inQuotes) {
      if (c === '"') {
        const next = s[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (c === '\n') {
      row.push(field);
      const isEmptyRow = row.every(v => String(v || '').trim() === '');
      if (!isEmptyRow) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += c;
  }

  row.push(field);
  const isEmptyRow = row.every(v => String(v || '').trim() === '');
  if (!isEmptyRow) rows.push(row);

  return rows;
}

function updateVendorNameDatalist(query) {
  const dl = elements.vendorList;
  if (!dl) return;
  dl.innerHTML = '';
  const q = String(query || '').trim().toLowerCase();
  if (!q) return;

  const matches = (vendorsCache || [])
    .filter(v => String(v.name || '').toLowerCase().includes(q))
    .slice(0, VENDOR_SUGGESTION_LIMIT);

  matches.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.dataset.vendorId = v.id;
    dl.appendChild(opt);
  });
}

function updateVendorIdDatalist(query) {
  const dl = elements.vendorIdList;
  if (!dl) return;
  dl.innerHTML = '';
  const q = String(query || '').trim().toLowerCase();
  if (!q) return;

  const matches = (vendorsCache || [])
    .filter(v => String(v.id || '').toLowerCase().includes(q))
    .slice(0, VENDOR_SUGGESTION_LIMIT);

  matches.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.dataset.vendorName = v.name;
    dl.appendChild(opt);
  });
}

function handleVendorNameInput() {
  clearTimeout(vendorSearchTimeout);
  vendorSearchTimeout = setTimeout(() => {
    loadVendorsIfNeeded().then(() => {
      const vendorInput = document.getElementById('vendor');
      const vendorIdInput = document.getElementById('vendorId');
      const value = String(vendorInput.value || '');

      updateVendorNameDatalist(value);

      const exact = vendorsByName.get(value.trim().toLowerCase());
      if (exact) {
        vendorIdInput.value = exact.id;
      } else if (value.trim() === '') {
        vendorIdInput.value = '';
      }
    });
  }, 150);
}

function handleVendorNameChange() {
  loadVendorsIfNeeded().then(() => {
    const vendorInput = document.getElementById('vendor');
    const vendorIdInput = document.getElementById('vendorId');
    const value = String(vendorInput.value || '').trim();

    const exact = vendorsByName.get(value.toLowerCase());
    if (exact) vendorIdInput.value = exact.id;
  });
}

function handleVendorNameBlur() {
  if (elements.vendorList) elements.vendorList.innerHTML = '';
}

function handleVendorIdInput() {
  clearTimeout(vendorSearchTimeout);
  vendorSearchTimeout = setTimeout(() => {
    loadVendorsIfNeeded().then(() => {
      const vendorInput = document.getElementById('vendor');
      const vendorIdInput = document.getElementById('vendorId');
      const value = String(vendorIdInput.value || '');

      updateVendorIdDatalist(value);

      const exact = vendorsById.get(value.trim().toLowerCase());
      if (exact) {
        vendorInput.value = exact.name;
      }
    });
  }, 150);
}

function handleVendorIdChange() {
  loadVendorsIfNeeded().then(() => {
    const vendorInput = document.getElementById('vendor');
    const vendorIdInput = document.getElementById('vendorId');
    const value = String(vendorIdInput.value || '').trim();

    const exact = vendorsById.get(value.toLowerCase());
    if (exact) vendorInput.value = exact.name;
  });
}

function handleVendorIdBlur() {
  if (elements.vendorIdList) elements.vendorIdList.innerHTML = '';
}

async function uploadVendorCSV(e) {
  e.preventDefault();
  const file = document.getElementById('vendorCsv')?.files?.[0];
  if (!file) return;

  try {
    const content = await readFileAsText(file);
    const parsed = parseVendorCsv(content);

    if (!parsed || parsed.length === 0) {
      alert('No vendors found in the CSV file.');
      return;
    }

    await vendorsRef.remove();
    const uploadPromises = parsed.map(v => vendorsRef.push({ name: v.name, id: v.id }));
    await Promise.all(uploadPromises);

    vendorsCache = parsed;
    buildVendorIndexes(vendorsCache);
    vendorsLoaded = true;

    alert('Vendors uploaded successfully!');
    elements.vendorUploadForm.reset();
  } catch (error) {
    console.error('Error uploading vendors:', error);
    alert('Invalid CSV format. Please ensure it has "Name" and "Supplier ID" columns.');
  }
}

// ======================
// Calculation Functions
// ======================
function calculateRetentionFromPercentage() {
  const percentageInput = document.getElementById('retentionPercentage');
  const percentage = parseFloat(percentageInput.value) || 0;
  const baseAmount = parseFloat(document.getElementById('retentionBaseAmount').value.replace(/,/g, '')) || 0;
  const retentionInput = document.getElementById('retention');

  if (percentage > 0 && baseAmount > 0) {
    const calculatedRetention = (baseAmount * percentage) / 100;
    retentionInput.value = formatNumber(calculatedRetention);
  } else if (percentageInput.value.trim() === '') {
    retentionInput.value = '';
  }
  calculatePayment();
}

function calculatePayment() {
  const certifiedAmount = parseFloat(document.getElementById('certifiedAmount').value.replace(/,/g, '')) || 0;
  const retention = parseFloat(document.getElementById('retention').value.replace(/,/g, '')) || 0;
  const payment = certifiedAmount - retention;
  document.getElementById('payment').value = formatNumber(payment);
}

// ======================
// Import/Export & Delete
// ======================
async function importPaymentCSV() {
  const file = elements.paymentCsv.files[0];
  if (!file) {
    alert('Please select a CSV file to import');
    return;
  }
  const shouldOverwrite = elements.overwriteData.checked;
  try {
    const content = await readFileAsText(file);
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const requiredFields = ['Payment No.', 'Cheque No.', 'Site', 'Vendor', 'Vendor ID', 'PO No.', 'PO Value', 'Certified Amount', 'Retention', 'Payment', 'Date Paid', 'Note'];
    const missingFields = requiredFields.filter(field => !headers.includes(field));
    if (missingFields.length > 0) {
      alert(`CSV is missing required fields: ${missingFields.join(', ')}`);
      return;
    }
    const fieldIndices = {};
    requiredFields.forEach(field => { fieldIndices[field] = headers.indexOf(field); });
    
    if (headers.includes('Date Entered')) {
        fieldIndices['Date Entered'] = headers.indexOf('Date Entered');
    }

    const paymentsToImport = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length < headers.length) continue;
      const paymentData = {
        paymentNo: values[fieldIndices['Payment No.']],
        chequeNo: values[fieldIndices['Cheque No.']],
        site: values[fieldIndices['Site']],
        vendor: values[fieldIndices['Vendor']],
        vendorId: values[fieldIndices['Vendor ID']],
        poNo: values[fieldIndices['PO No.']],
        poValue: values[fieldIndices['PO Value']],
        certifiedAmount: values[fieldIndices['Certified Amount']],
        retention: values[fieldIndices['Retention']],
        payment: values[fieldIndices['Payment']],
        datePaid: values[fieldIndices['Date Paid']],
        note: values[fieldIndices['Note']] || ''
      };
      
      if (fieldIndices['Date Entered'] !== undefined) {
          paymentData.dateEntered = values[fieldIndices['Date Entered']];
      }
      
      paymentsToImport.push(paymentData);
    }
    if (paymentsToImport.length === 0) {
      alert('No valid payment records found in the CSV file');
      return;
    }
    elements.importBtn.disabled = true;
    elements.importBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Importing...';
    if (shouldOverwrite) {
      await paymentsRef.remove();
    }
    const importPromises = paymentsToImport.map(payment => paymentsRef.push(payment));
    await Promise.all(importPromises);
    alert(`Successfully imported ${paymentsToImport.length} payment records`);
    document.getElementById('importForm').reset();
  } catch (error) {
    console.error('Error importing payments:', error);
  } finally {
    elements.importBtn.disabled = false;
    elements.importBtn.textContent = 'Import';
  }
}

function downloadCSVTemplate() {
  const headers = ['Payment No.', 'Cheque No.', 'Site', 'Vendor', 'Vendor ID', 'PO No.', 'PO Value', 'Certified Amount', 'Retention', 'Payment', 'Date Paid', 'Note'];
  let csvContent = headers.join(',') + '\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'payment_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function confirmDeletePayment(id) {
  if (confirm('Are you sure you want to delete this payment?')) {
    deletePayment(id);
  }
}

function deletePayment(id) {
  paymentsRef.child(id).remove()
    .then(() => {
      alert('Payment deleted successfully!');
      searchPayments();
    })
    .catch(error => console.error('Error deleting payment:', error));
}

function toggleDeleteButton() {
  elements.confirmDeleteBtn.disabled = !elements.confirmDelete.checked;
}

function deleteAllPayments() {
  paymentsRef.remove()
    .then(() => {
      alert('All payment records have been deleted successfully!');
      const modal = bootstrap.Modal.getInstance(document.getElementById('deleteAllModal'));
      modal.hide();
      elements.confirmDelete.checked = false;
      elements.confirmDeleteBtn.disabled = true;
    })
    .catch(error => console.error('Error deleting all payments:', error));
}

// ======================
// Report Functions (UPDATED)
// ======================
async function generateReport(selectedPayment) {
  const poNo = selectedPayment.poNo;
  if (!poNo) return;
  try {
    const snapshot = await paymentsRef.orderByChild('poNo').equalTo(poNo).once('value');
    if (!snapshot.exists()) {
      alert('No payments found for this PO No.');
      return;
    }
    
    // Collect all payments for this PO
    const allPayments = [];
    snapshot.forEach(childSnapshot => {
      const payment = childSnapshot.val();
      payment.id = childSnapshot.key;
      allPayments.push(payment);
    });
    
    // Sort by PVN number (ascending)
    allPayments.sort((a, b) => {
      const aNum = parseInt(String(a.paymentNo).replace('PVN-', ''));
      const bNum = parseInt(String(b.paymentNo).replace('PVN-', ''));
      return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
    });
    
    // Find index of selected payment (or fallback to date order)
    let selectedIndex = -1;
    for (let i = 0; i < allPayments.length; i++) {
      // Compare by Firebase key or paymentNo+date
      if (allPayments[i].id === selectedPayment.id) {
        selectedIndex = i;
        break;
      }
    }
    // If not found by ID, try by paymentNo (shouldn't happen, but safe)
    if (selectedIndex === -1) {
      const selectedPVN = parseInt(String(selectedPayment.paymentNo).replace('PVN-', ''));
      for (let i = 0; i < allPayments.length; i++) {
        const pvn = parseInt(String(allPayments[i].paymentNo).replace('PVN-', ''));
        if (pvn === selectedPVN) {
          selectedIndex = i;
          break;
        }
      }
    }
    // If still not found, default to all payments (should not happen)
    if (selectedIndex === -1) selectedIndex = allPayments.length - 1;
    
    // Take only payments up to and including the selected payment
    const payments = allPayments.slice(0, selectedIndex + 1);
    
    // Latest payment among the filtered set (the selected payment itself)
    const latestPayment = payments[payments.length - 1];
    
    let totalCertified = 0, totalRetention = 0, totalPayment = 0, totalPrevPayment = 0;
    let allNotes = [];
    
    payments.forEach((payment, index) => {
      const certified = parseFloat(payment.certifiedAmount || 0);
      const retention = parseFloat(payment.retention || 0);
      const paymentAmount = parseFloat(payment.payment || 0);
      
      totalCertified += certified;
      totalRetention += retention;
      totalPayment += paymentAmount;
      
      // Previous payment total = sum of all payments BEFORE this one
      if (index < payments.length - 1) {
        totalPrevPayment += paymentAmount;
      }
      
      if (payment.note && String(payment.note).trim() !== '') {
        allNotes.push(String(payment.note).trim());
      }
    });
    
    const totalCommitted = parseFloat(latestPayment.poValue || 0) - totalCertified;
    
    // Update report UI
    document.getElementById('reportDate').textContent = formatDateLong(new Date().toISOString());
    document.getElementById('reportPoNo').textContent = poNo;
    document.getElementById('reportProject').textContent = latestPayment.site || '';
    document.getElementById('reportVendorId').textContent = latestPayment.vendorId || '';
    
    let vName = latestPayment.vendor || '';
    if (vName.length > 27) vName = vName.substring(0, 27);
    document.getElementById('reportVendorName').textContent = vName;
    
    document.getElementById('reportTotalPoValue').textContent = formatNumber(latestPayment.poValue);
    document.getElementById('reportTotalCertified').textContent = formatNumber(totalCertified);
    document.getElementById('reportTotalPrevPayment').textContent = formatNumber(totalPrevPayment);
    document.getElementById('reportTotalCommitted').textContent = formatNumber(totalCommitted);
    document.getElementById('reportTotalRetention').textContent = formatNumber(totalRetention);
    
    const reportTableBody = document.getElementById('reportTableBody');
    reportTableBody.innerHTML = '';
    payments.forEach(payment => {
      const row = document.createElement('tr');
      const pvn = payment.paymentNo ? String(payment.paymentNo).replace('PVN-', '') : '';
      row.innerHTML = `
        <td>${pvn}</td>
        <td>${payment.chequeNo || ''}</td>
        <td>${formatNumber(payment.certifiedAmount)}</td>
        <td>${formatNumber(payment.retention)}</td>
        <td>${formatNumber(payment.payment)}</td>
        <td>${payment.datePaid ? formatDate(payment.datePaid) : ''}</td>
      `;
      reportTableBody.appendChild(row);
    });
    
    document.getElementById('reportTotalCertifiedAmount').textContent = formatNumber(totalCertified);
    document.getElementById('reportTotalRetentionAmount').textContent = formatNumber(totalRetention);
    document.getElementById('reportTotalPaymentAmount').textContent = formatNumber(totalPayment);
    
    const reportNotesSection = document.getElementById('reportNotesSection');
    const reportNotesContent = document.getElementById('reportNotesContent');
    if (allNotes.length > 0) {
      reportNotesContent.textContent = allNotes.join('\n');
      reportNotesSection.style.display = 'block';
    } else {
      reportNotesContent.textContent = '';
      reportNotesSection.style.display = 'none';
    }
    
    elements.reportModal.show();
  } catch (error) {
    console.error('Error generating report:', error);
    alert('Error generating report: ' + error.message);
  }
}

function printReport() {
  window.print();
}

// ======================
// Utility Functions
// ======================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function getRelationshipKey(paymentData) {
  return `${paymentData.poNo}_${paymentData.site}_${paymentData.vendor}_${paymentData.vendorId}`.toLowerCase();
}

function generatePaymentNumber(number) {
  return `PVN-${String(number)}`;
}

async function getNextAvailablePVNNumber(paymentData) {
  const relationshipKey = getRelationshipKey(paymentData);
  const snapshot = await paymentsRef.once('value');
  const payments = [];
  snapshot.forEach(childSnapshot => {
    const payment = childSnapshot.val();
    if (getRelationshipKey(payment) === relationshipKey) {
      payments.push({ id: childSnapshot.key, ...payment });
    }
  });
  const pvnNumbers = payments.map(p => {
    const num = parseInt(String(p.paymentNo).replace('PVN-', ''));
    return isNaN(num) ? 0 : num;
  }).sort((a, b) => a - b);
  let nextNumber = 1;
  for (const num of pvnNumbers) {
    if (num === nextNumber) {
      nextNumber++;
    } else if (num > nextNumber) {
      return nextNumber;
    }
  }
  return nextNumber;
}

function formatFieldValue(field, value) {
  if (value === undefined || value === null || value === '') return '';
  if (['poValue', 'certifiedAmount', 'retention', 'payment'].includes(field)) {
    return formatNumber(value);
  }
  if (field === 'datePaid') {
    return value; 
  }
  return value;
}

function formatNumber(value) {
  if (value === undefined || value === null || value === '') return '';
  const num = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(num) ? value : num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  if (!dateStr || String(dateStr).trim() === '') return '';

  let date;
  const parts = String(dateStr).split('-'); 

  if (parts.length === 3 && parts[0].length === 4) {
    try {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1; 
      const day = parseInt(parts[2], 10);

      const tempDate = new Date(year, monthIndex, day);
      if (!isNaN(tempDate.getTime()) && tempDate.getDate() === day && tempDate.getMonth() === monthIndex && tempDate.getFullYear() === year) {
        date = tempDate;
      }
    } catch (e) {}
  }
  if (!date) {
    date = new Date(dateStr);
  }
  if (isNaN(date.getTime())) {
    return dateStr; 
  }
  
  let currentYear = date.getFullYear();
  if (currentYear < 2000 && currentYear > 1900) {
    date.setFullYear(currentYear + 100);
  }
  
  const dayFormatted = date.getDate().toString().padStart(2, '0');
  const monthName = date.toLocaleString('default', { month: 'short' });
  const monthFormatted = monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
  const yearFormatted = date.getFullYear(); 
  
  return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}