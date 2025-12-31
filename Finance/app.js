// ======================
// Application Version
// ======================
const APP_VERSION = "v5.1 (Final Complete)";

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
  addNewBtn: document.getElementById('addNewBtn'), // The main Add button on top

  // Form & Modals
  paymentForm: document.getElementById('paymentForm'),
  saveBtn: document.getElementById('saveBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  clearBtn: document.getElementById('clearBtn'),
  addNewPaymentBtn: document.getElementById('addNewPaymentBtn'), // "Save as New" button inside modal
  
  // Initialize Modals using Bootstrap API
  paymentModal: new bootstrap.Modal(document.getElementById('paymentModal')),
  reportModal: new bootstrap.Modal(document.getElementById('reportModal')),
  
  // Vendors & Import
  vendorList: document.getElementById('vendorList'),
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
      // User is logged in
      elements.mainApp.style.display = 'block';
      elements.loginScreen.style.display = 'none';
      elements.userEmailDisplay.textContent = user.email;
      elements.versionDisplay.textContent = APP_VERSION;
      initializeApplication();
    } else {
      // User is logged out
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
  resetForm();
  resetSearch();
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
  document.getElementById('vendor').addEventListener('input', handleVendorInput);
  document.getElementById('vendor').addEventListener('change', handleVendorSelection);
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
    
    // Update active class on Sidebar
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
function searchPayments() {
  const poNo = elements.searchPoNo.value.trim();
  if (!poNo) {
    alert('Please enter a PO No. to search');
    return;
  }
  
  // Enable the "New Payment" button now that we have a PO context
  elements.addNewBtn.disabled = false; 

  paymentsRef.orderByChild('poNo').equalTo(poNo).once('value')
    .then(snapshot => {
      elements.searchResults.style.display = 'block';
      elements.searchResultsBody.innerHTML = '';

      if (!snapshot.exists()) {
        showNoResults(poNo);
      } else {
        // Store data for local access (editing)
        allPaymentsData = {};
        snapshot.forEach(childSnapshot => {
            allPaymentsData[childSnapshot.key] = { id: childSnapshot.key, ...childSnapshot.val() };
        });
        showSearchResults(Object.values(allPaymentsData));
      }
    })
    .catch(error => console.error('Error searching payments:', error));
}

function showNoResults(poNo) {
  elements.noResultsAlert.style.display = 'block';
}

function showSearchResults(payments) {
    elements.noResultsAlert.style.display = 'none';
    elements.searchResultsBody.innerHTML = '';
    if (payments.length === 0) return;

    // Sort chronologically (Oldest to Newest) based on dateEntered
    payments.sort((a, b) => {
        return new Date(a.dateEntered) - new Date(b.dateEntered);
    });
    
    // Get latest payment for Header details (Correct PO Value)
    const latestPayment = payments[payments.length - 1];
    const { site, vendor, vendorId, poNo, poValue } = latestPayment;

    // 1. Header Table (PO Summary)
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

    // 2. Detail Rows
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

// Global click handler for dynamic buttons (Edit, Delete, Report)
function handleActionClick(e) {
    const target = e.target.closest('button');
    if (!target) return;
    
    const action = target.dataset.action;
    const id = target.dataset.id;
    const payment = allPaymentsData[id];
    
    if (!action || !id || !payment) return;

    if (action === 'edit') editPayment(id, payment);
    else if (action === 'delete') confirmDeletePayment(id);
    else if (action === 'report') generateReport(payment);
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

// Opens the Modal in "Add Mode"
function showAddNewForm() {
  resetForm();
  
  // Pre-fill logic based on search results
  const firstPaymentKey = Object.keys(allPaymentsData)[0];
  if(firstPaymentKey) {
      const p = allPaymentsData[firstPaymentKey];
      document.getElementById('site').value = p.site || '';
      document.getElementById('vendor').value = p.vendor || '';
      document.getElementById('vendorId').value = p.vendorId || '';
      document.getElementById('poNo').value = p.poNo || '';
      // Use latest PO Value from sorted data
      const sorted = Object.values(allPaymentsData).sort((a,b) => new Date(a.dateEntered) - new Date(b.dateEntered));
      document.getElementById('poValue').value = sorted[sorted.length-1].poValue || '';
  } else {
     document.getElementById('poNo').value = elements.searchPoNo.value.trim();
  }

  // UI Updates for Modal
  document.getElementById('paymentModalLabel').textContent = 'Add New Payment';
  isEditing = false;
  editId = null;
  elements.saveBtn.textContent = 'Save Record';
  elements.addNewPaymentBtn.style.display = 'none';

  // Highlight input fields
  const fieldsToHighlight = ['certifiedAmount', 'retention', 'payment', 'datePaid', 'note'];
  fieldsToHighlight.forEach(fieldId => {
      document.getElementById(fieldId).classList.add('highlight-field');
  });

  // OPEN MODAL
  elements.paymentModal.show();
}

// Opens the Modal in "Edit Mode"
function editPayment(id, payment) {
  editId = id;
  isEditing = true;

  fields.forEach(field => {
    document.getElementById(field).value = formatFieldValue(field, payment[field]) || '';
  });

  // Logic for Retention Base
  document.getElementById('retentionBaseAmount').value = formatNumber(payment.certifiedAmount) || '';
  document.getElementById('retentionPercentage').value = '';

  elements.saveBtn.textContent = 'Update Record';
  elements.addNewPaymentBtn.style.display = 'inline-block';
  document.getElementById('paymentModalLabel').textContent = 'Edit Payment';

  const fieldsToHighlight = ['certifiedAmount', 'retention', 'payment', 'datePaid', 'note'];
  fieldsToHighlight.forEach(fieldId => {
      document.getElementById(fieldId).classList.add('highlight-field');
  });

  // OPEN MODAL
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
    // Remove commas for numeric fields
    paymentData[field] = ['poValue', 'certifiedAmount', 'retention', 'payment'].includes(field)
      ? value.replace(/,/g, '')
      : value;
  });

  // ============================================================
  // DATE LOGIC UPDATE:
  // 1. Always set 'dateEntered' to NOW (for both Add and Update)
  // 2. Do NOT auto-fill 'datePaid' (User will enter manually)
  // ============================================================
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // accurately track when this specific record was touched
  paymentData.dateEntered = `${year}-${month}-${day}`;

  try {
    if (isEditing) {
      // Update existing
      await paymentsRef.child(editId).update(paymentData);
      alert('Payment updated successfully!');
    } else {
      // Create new
      // Generate PVN if empty
      if (!paymentData.paymentNo) {
        const nextNumber = await getNextAvailablePVNNumber(paymentData);
        paymentData.paymentNo = generatePaymentNumber(nextNumber);
      }
      
      // We no longer force datePaid to be today. If it's empty, it stays empty.
      
      await paymentsRef.push(paymentData);
      alert('Payment added successfully!');
    }
    
    elements.paymentModal.hide(); // Hide modal
    resetForm();
    searchPayments(); // Refresh list
  } catch (error) { 
      console.error('Error saving payment:', error); 
      alert('Error saving data: ' + error.message);
  }
}

// "Save as New" button logic (Cloning an existing record)
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
    // Set Date Ent. to today (System Audit)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    paymentData.dateEntered = `${year}-${month}-${day}`;
      
    if (!paymentData.paymentNo) {
        const nextNumber = await getNextAvailablePVNNumber(paymentData);
        paymentData.paymentNo = generatePaymentNumber(nextNumber);
    }
      
    // Clear specific fields for the new copy
    paymentData.chequeNo = ''; 
    paymentData.datePaid = ''; // DATE LOGIC UPDATE: Clear date paid for manual entry
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

  // DATE LOGIC UPDATE:
  // Keep Date Paid BLANK for manual entry
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
function handleVendorInput() {
  clearTimeout(vendorSearchTimeout);
  vendorSearchTimeout = setTimeout(searchVendors, 300);
}

function handleVendorSelection() {
  const selectedValue = this.value;
  const selectedOption = Array.from(elements.vendorList.options).find(o => o.value.toLowerCase() === selectedValue.toLowerCase());
  if (selectedOption) {
    document.getElementById('vendorId').value = selectedOption.dataset.vendorId;
  } else {
    document.getElementById('vendorId').value = '';
  }
}

function searchVendors() {
  const vendorName = document.getElementById('vendor').value.trim().toLowerCase();
  if (vendorName.length < 1) {
    elements.vendorList.innerHTML = '';
    return;
  }
  vendorsRef.orderByChild('name').once('value', snapshot => {
    elements.vendorList.innerHTML = '';
    if (snapshot.exists()) {
      snapshot.forEach(childSnapshot => {
        const vendor = childSnapshot.val();
        if (vendor.name.toLowerCase().includes(vendorName)) {
          const option = document.createElement('option');
          option.value = vendor.name;
          option.dataset.vendorId = vendor.id;
          elements.vendorList.appendChild(option);
        }
      });
    }
  }).catch(error => console.error('Error fetching vendors:', error));
}

async function uploadVendorCSV(e) {
  e.preventDefault();
  const file = document.getElementById('vendorCsv').files[0];
  if (!file) return;
  try {
    const content = await readFileAsText(file);
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    if (headers.length < 2 || !headers.includes('Name') || !headers.includes('Supplier ID')) {
      alert('Invalid CSV format. Please ensure it has "Name" and "Supplier ID" columns.');
      return;
    }
    const nameIndex = headers.indexOf('Name');
    const idIndex = headers.indexOf('Supplier ID');
    await vendorsRef.remove();
    const uploadPromises = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      const values = lines[i].split(',');
      const name = values[nameIndex].trim();
      const id = values[idIndex].trim();
      if (name && id) {
        uploadPromises.push(vendorsRef.push({ name: name, id: id }));
      }
    }
    await Promise.all(uploadPromises);
    alert('Vendors uploaded successfully!');
    elements.vendorUploadForm.reset();
  } catch (error) {
    console.error('Error uploading vendors:', error);
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
// Report Functions
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
    const payments = [];
    snapshot.forEach(childSnapshot => {
      payments.push(childSnapshot.val());
    });
    
    payments.sort((a, b) => {
      const aNum = parseInt(String(a.paymentNo).replace('PVN-', ''));
      const bNum = parseInt(String(b.paymentNo).replace('PVN-', ''));
      return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
    });

    const latestPayment = payments[payments.length - 1]; 

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

    const totalCommitted = parseFloat(latestPayment.poValue || 0) - totalCertified;

    document.getElementById('reportDate').textContent = formatDateLong(new Date().toISOString());
    document.getElementById('reportPoNo').textContent = poNo;
    document.getElementById('reportProject').textContent = latestPayment.site || '';
    document.getElementById('reportVendorId').textContent = latestPayment.vendorId || '';
    
    // ==========================================
    // TRUNCATE LOGIC: Limit Vendor Name to 27 chars
    // ==========================================
    let vName = latestPayment.vendor || '';
    if (vName.length > 27) {
        vName = vName.substring(0, 27); 
    }
    document.getElementById('reportVendorName').textContent = vName;
    // ==========================================

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
      row.innerHTML = `<td>${pvn}</td><td>${payment.chequeNo || ''}</td><td>${formatNumber(payment.certifiedAmount)}</td><td>${formatNumber(payment.retention)}</td><td>${formatNumber(payment.payment)}</td><td>${payment.datePaid ? formatDate(payment.datePaid) : ''}</td>`;
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
  }
}

function printReport() {
  window.print();
}

// ======================
// Utility Functions
// ======================
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