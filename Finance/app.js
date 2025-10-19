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
  mainApp: document.getElementById('mainApp'),
  logoutLink: document.getElementById('logoutLink'),
  userEmailDisplay: document.getElementById('userEmailDisplay'), // Added this

  // Form elements
  paymentForm: document.getElementById('paymentForm'),
  saveBtn: document.getElementById('saveBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  clearBtn: document.getElementById('clearBtn'),
  addNewPaymentBtn: document.getElementById('addNewPaymentBtn'),

  // Vendor elements
  vendorList: document.getElementById('vendorList'),
  vendorUploadForm: document.getElementById('vendorUploadForm'),

  // Section elements
  paymentSection: document.getElementById('paymentSection'),
  vendorSection: document.getElementById('vendorSection'),
  recordsSection: document.getElementById('recordsSection'),

  // Navigation elements
  paymentLink: document.getElementById('paymentLink'),
  vendorLink: document.getElementById('vendorLink'),
  recordsLink: document.getElementById('recordsLink'),

  // Import/Export elements
  importBtn: document.getElementById('importBtn'),
  paymentCsv: document.getElementById('paymentCsv'),
  overwriteData: document.getElementById('overwriteData'),

  // Search elements
  searchPoNo: document.getElementById('searchPoNo'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  noResultsAlert: document.getElementById('noResultsAlert'),
  searchResultsBody: document.getElementById('searchResultsBody'),
  addNewBtn: document.getElementById('addNewBtn'),

  // Form display elements
  paymentFormCard: document.getElementById('paymentFormCard'),
  formTitle: document.getElementById('formTitle'),

  // Delete elements
  deleteAllBtn: document.getElementById('deleteAllBtn'),
  downloadTemplateBtn: document.getElementById('downloadTemplateBtn'),
  confirmDelete: document.getElementById('confirmDelete'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),

  // Report elements
  reportModal: new bootstrap.Modal(document.getElementById('reportModal')),
  printReportBtn: document.getElementById('printReportBtn'),
  reportModalContent: document.getElementById('reportModal')
};

// Form fields
const fields = [
  'paymentNo', 'chequeNo', 'site', 'vendor', 'vendorId', 'poNo',
  'poValue', 'certifiedAmount', 'retention', 'payment', 'datePaid', 'note'
];

// Global variables
let editId = null;
let isEditing = false;
let vendorSearchTimeout = null;
let allPaymentsData = {}; // To store payment data for editing

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
  auth.onAuthStateChanged(user => {
    if (user) {
      // User is logged in
      elements.mainApp.style.display = 'block';
      elements.loginScreen.style.display = 'none';
      elements.userEmailDisplay.textContent = user.email; // Display email
      initializeApplication();
    } else {
      // User is logged out
      elements.mainApp.style.display = 'none';
      elements.loginScreen.style.display = 'flex';
      elements.userEmailDisplay.textContent = ''; // Clear email
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
      elements.loginBtn.textContent = 'Login';
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
  // Navigation
  elements.paymentLink.addEventListener('click', showPaymentSection);
  elements.vendorLink.addEventListener('click', showVendorSection);
  elements.recordsLink.addEventListener('click', showRecordsSection);
  elements.logoutLink.addEventListener('click', handleLogout);

  // Form submission
  elements.paymentForm.addEventListener('submit', handleFormSubmit);

  // Form buttons
  elements.cancelBtn.addEventListener('click', cancelEdit);
  elements.clearBtn.addEventListener('click', resetForm);
  elements.addNewPaymentBtn.addEventListener('click', addNewPaymentFromEdit);
  elements.addNewBtn.addEventListener('click', showAddNewForm);

  // Search functionality
  elements.searchBtn.addEventListener('click', searchPayments);
  elements.searchPoNo.addEventListener('keypress', e => { if (e.key === 'Enter') searchPayments(); });
  elements.clearSearchBtn.addEventListener('click', resetSearch);

  // Vendor autocomplete
  document.getElementById('vendor').addEventListener('input', handleVendorInput);
  document.getElementById('vendor').addEventListener('change', handleVendorSelection);

  // Calculation events
  document.getElementById('certifiedAmount').addEventListener('input', calculatePayment);
  document.getElementById('retention').addEventListener('input', calculatePayment);
  document.getElementById('retentionPercentage').addEventListener('input', calculateRetentionFromPercentage);
  document.getElementById('retentionBaseAmount').addEventListener('input', calculateRetentionFromPercentage);

  // NEW LOGIC: Auto-populate Base Amount from Certified Amount
  document.getElementById('certifiedAmount').addEventListener('input', (e) => {
    document.getElementById('retentionBaseAmount').value = e.target.value;
  });

  // NEW LOGIC: Use event delegation for dynamic Edit/Delete buttons
  elements.searchResultsBody.addEventListener('click', handleActionClick);

  // Import/Export
  elements.vendorUploadForm.addEventListener('submit', uploadVendorCSV);
  elements.importBtn.addEventListener('click', importPaymentCSV);
  elements.downloadTemplateBtn.addEventListener('click', downloadCSVTemplate);

  // Delete All
  elements.confirmDelete.addEventListener('change', toggleDeleteButton);
  elements.confirmDeleteBtn.addEventListener('click', deleteAllPayments);

  // Report
  elements.printReportBtn.addEventListener('click', printReport);
}

// ======================
// Navigation Functions
// ======================
function showPaymentSection(e) {
  e.preventDefault();
  elements.paymentSection.style.display = 'block';
  elements.vendorSection.style.display = 'none';
  elements.recordsSection.style.display = 'none';
  // Update active class for dropdown
  document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
  elements.paymentLink.classList.add('active');
  resetSearch();
}
function showVendorSection(e) {
  e.preventDefault();
  elements.paymentSection.style.display = 'none';
  elements.vendorSection.style.display = 'block';
  elements.recordsSection.style.display = 'none';
  // Update active class for dropdown
  document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
  elements.vendorLink.classList.add('active');
}
function showRecordsSection(e) {
  e.preventDefault();
  elements.paymentSection.style.display = 'none';
  elements.vendorSection.style.display = 'none';
  elements.recordsSection.style.display = 'block';
  // Update active class for dropdown
  document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
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

  elements.addNewBtn.disabled = false; // <-- MODIFICATION: Enable button

  paymentsRef.orderByChild('poNo').equalTo(poNo).once('value')
    .then(snapshot => {
      elements.searchResults.style.display = 'block';
      elements.searchResultsBody.innerHTML = '';

      if (!snapshot.exists()) {
        showNoResults(poNo);
      } else {
        // Clear previous data and store new data
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
  elements.paymentFormCard.style.display = 'none';
}

// MODIFIED: This function is completely rewritten for the new UI
function showSearchResults(payments) {
    elements.noResultsAlert.style.display = 'none';
    elements.searchResultsBody.innerHTML = '';

    if (payments.length === 0) return;

    // Assuming all payments share the same PO details
    const firstPayment = payments[0];
    const { site, vendor, vendorId, poNo, poValue } = firstPayment;

    // 1. Create the PO Summary Table (Top Level)
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
                    <td>${formatNumber(poValue) || ''}</td>
                </tr>
            </tbody>
        </table>
    `;

    // 2. Create the Payment Details Table (Bottom Level)
    const paymentRowsHtml = payments.map(payment => `
        <tr>
            <td>${payment.paymentNo || ''}</td>
            <td>${payment.chequeNo || ''}</td>
            <td>${formatNumber(payment.certifiedAmount) || ''}</td>
            <td>${formatNumber(payment.retention) || ''}</td>
            <td>${formatNumber(payment.payment) || ''}</td>
            <td>${formatDateShort(payment.datePaid) || ''}</td>
            <td>
                <button class="btn btn-sm btn-info me-2" data-action="report" data-id="${payment.id}">Report</button>
                <button class="btn btn-sm btn-secondary me-2" data-action="edit" data-id="${payment.id}">Edit</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-id="${payment.id}">Delete</button>
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

    // 3. Append both to the container
    elements.searchResultsBody.innerHTML = summaryHtml + detailsHtml;
}

// NEW: Handle clicks on dynamic action buttons
function handleActionClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    const payment = allPaymentsData[id];

    if (!action || !id || !payment) return;

    if (action === 'edit') {
        editPayment(id, payment);
    } else if (action === 'delete') {
        confirmDeletePayment(id);
    } else if (action === 'report') {
        generateReport(payment);
    }
}


function resetSearch() {
  elements.searchPoNo.value = '';
  elements.searchResults.style.display = 'none';
  elements.noResultsAlert.style.display = 'none';
  elements.paymentFormCard.style.display = 'none';
  allPaymentsData = {};
  elements.addNewBtn.disabled = true; // <-- MODIFICATION: Disable button
}

// ======================
// Form Functions
// ======================
function showAddNewForm() {
  resetForm();
  // Pre-fill form with data from the search if available
  const firstPaymentKey = Object.keys(allPaymentsData)[0];
  if(firstPaymentKey) {
      const p = allPaymentsData[firstPaymentKey];
      document.getElementById('site').value = p.site || '';
      document.getElementById('vendor').value = p.vendor || '';
      document.getElementById('vendorId').value = p.vendorId || '';
      document.getElementById('poNo').value = p.poNo || '';
      document.getElementById('poValue').value = p.poValue || '';
  } else {
     document.getElementById('poNo').value = elements.searchPoNo.value.trim();
  }

  elements.paymentFormCard.style.display = 'block';
  elements.formTitle.textContent = 'Add New Payment';
  isEditing = false;
  editId = null;
  // MODIFIED: Changed button text
  elements.saveBtn.textContent = 'Add';
  elements.addNewPaymentBtn.style.display = 'none';

  // NEW: Also highlight fields for "Add New"
  const fieldsToHighlight = ['certifiedAmount', 'retention', 'payment', 'datePaid', 'note'];
  fieldsToHighlight.forEach(fieldId => {
      document.getElementById(fieldId).classList.add('highlight-field');
  });

  // MODIFIED: Scroll the form into view
  elements.paymentFormCard.scrollIntoView({ behavior: 'smooth' });
}

function editPayment(id, payment) {
  editId = id;
  isEditing = true;

  fields.forEach(field => {
    document.getElementById(field).value = formatFieldValue(field, payment[field]) || '';
  });

  // Also populate base amount from certified amount
  document.getElementById('retentionBaseAmount').value = formatNumber(payment.certifiedAmount) || '';
  document.getElementById('retentionPercentage').value = '';

  elements.saveBtn.textContent = 'Update';
  elements.cancelBtn.style.display = 'inline-block';
  elements.addNewPaymentBtn.style.display = 'inline-block';
  elements.formTitle.textContent = 'Edit Payment';
  elements.paymentFormCard.style.display = 'block';

  // NEW LOGIC: Add highlight class to specific fields
  const fieldsToHighlight = ['certifiedAmount', 'retention', 'payment', 'datePaid', 'note'];
  fieldsToHighlight.forEach(fieldId => {
      document.getElementById(fieldId).classList.add('highlight-field');
  });

  // MODIFIED: Use scrollIntoView instead of scrolling to bottom
  elements.paymentFormCard.scrollIntoView({ behavior: 'smooth' });
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

  try {
    if (isEditing) {
      await paymentsRef.child(editId).update(paymentData);
      alert('Payment updated successfully!');
    } else {
      const nextNumber = await getNextAvailablePVNNumber(paymentData);
      paymentData.paymentNo = generatePaymentNumber(nextNumber);
      await paymentsRef.push(paymentData);
      alert('Payment added successfully!');
    }
    resetForm();
    searchPayments();
  } catch (error) { console.error('Error saving payment:', error); }
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
    const nextNumber = await getNextAvailablePVNNumber(paymentData);
    paymentData.paymentNo = generatePaymentNumber(nextNumber);
    paymentData.chequeNo = '';
    paymentData.datePaid = '';
    paymentData.note = ''; // Clear note for new payment
    calculatePayment();
    paymentData.payment = document.getElementById('payment').value.replace(/,/g, '');

    await paymentsRef.push(paymentData);
    alert('New payment added successfully!');
    resetForm();
    searchPayments();
  } catch (error) { console.error('Error adding new payment:', error); }
}

function resetForm() {
  document.getElementById('paymentForm').reset();
  editId = null;
  isEditing = false;
  // MODIFIED: Changed button text
  elements.saveBtn.textContent = 'Add';
  elements.cancelBtn.style.display = 'inline-block';
  elements.addNewPaymentBtn.style.display = 'none';
  elements.formTitle.textContent = 'Add Payment';

  // NEW LOGIC: Remove highlight class from all fields
  const fieldsToHighlight = ['certifiedAmount', 'retention', 'payment', 'datePaid', 'note'];
  fieldsToHighlight.forEach(fieldId => {
      document.getElementById(fieldId).classList.remove('highlight-field');
  });
}

function cancelEdit() {
  resetForm();
  elements.paymentFormCard.style.display = 'none';
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
// MODIFIED: Updated retention logic
function calculateRetentionFromPercentage() {
  const percentageInput = document.getElementById('retentionPercentage');
  const percentage = parseFloat(percentageInput.value) || 0;
  const baseAmount = parseFloat(document.getElementById('retentionBaseAmount').value.replace(/,/g, '')) || 0;
  const retentionInput = document.getElementById('retention');

  if (percentage > 0 && baseAmount > 0) {
    const calculatedRetention = (baseAmount * percentage) / 100;
    retentionInput.value = formatNumber(calculatedRetention);
  } else if (percentageInput.value.trim() === '') {
    // If percentage field is cleared, clear retention
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
// Import/Export & Delete Functions
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
    requiredFields.forEach(field => {
      fieldIndices[field] = headers.indexOf(field);
    });
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
      // Handle potential NaN if paymentNo is missing or malformed
      const aNum = parseInt(String(a.paymentNo).replace('PVN-', ''));
      const bNum = parseInt(String(b.paymentNo).replace('PVN-', ''));
      return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
    });
    let totalCertified = 0, totalRetention = 0, totalPayment = 0, totalPrevPayment = 0;
    let allNotes = []; // To store notes

    payments.forEach(payment => {
      const certified = parseFloat(payment.certifiedAmount || 0);
      const retention = parseFloat(payment.retention || 0);
      const paymentAmount = parseFloat(payment.payment || 0);

      totalCertified += certified;
      totalRetention += retention;
      totalPayment += paymentAmount;

      // MODIFIED: Changed this logic to check for datePaid
      if (payment.datePaid && String(payment.datePaid).trim() !== '') {
        totalPrevPayment += paymentAmount;
      }

      // *** CHANGED: Removed the hyphen and PVN prefix ***
      if (payment.note && String(payment.note).trim() !== '') {
        allNotes.push(`${String(payment.note).trim()}`);
      }
    });

    const totalCommitted = parseFloat(selectedPayment.poValue || 0) - totalCertified;
    document.getElementById('reportDate').textContent = formatDateLong(new Date().toISOString());
    document.getElementById('reportPoNo').textContent = poNo;
    document.getElementById('reportProject').textContent = selectedPayment.site || '';
    document.getElementById('reportVendorId').textContent = selectedPayment.vendorId || '';
    document.getElementById('reportVendorName').textContent = selectedPayment.vendor || '';
    document.getElementById('reportTotalPoValue').textContent = formatNumber(selectedPayment.poValue);
    document.getElementById('reportTotalCertified').textContent = formatNumber(totalCertified);
    document.getElementById('reportTotalPrevPayment').textContent = formatNumber(totalPrevPayment);
    document.getElementById('reportTotalCommitted').textContent = formatNumber(totalCommitted);
    document.getElementById('reportTotalRetention').textContent = formatNumber(totalRetention);
    const reportTableBody = document.getElementById('reportTableBody');
    reportTableBody.innerHTML = '';
    payments.forEach(payment => {
      const row = document.createElement('tr');
       // Handle potential NaN if paymentNo is missing or malformed
      const pvn = payment.paymentNo ? String(payment.paymentNo).replace('PVN-', '') : '';
      row.innerHTML = `<td>${pvn}</td><td>${payment.chequeNo || ''}</td><td>${formatNumber(payment.certifiedAmount)}</td><td>${formatNumber(payment.retention)}</td><td>${formatNumber(payment.payment)}</td><td>${payment.datePaid ? formatDateShort(payment.datePaid) : ''}</td>`;
      reportTableBody.appendChild(row);
    });
    document.getElementById('reportTotalCertifiedAmount').textContent = formatNumber(totalCertified);
    document.getElementById('reportTotalRetentionAmount').textContent = formatNumber(totalRetention);
    document.getElementById('reportTotalPaymentAmount').textContent = formatNumber(totalPayment);
    
    // NEW: Show/Hide Notes section
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

// ======================
// PRINT FUNCTION - FIXED
// ======================
function printReport() {
  // All the styling is already handled by the @media print
  // rules in styles.css. We just need to trigger the print dialog.
  window.print();
}

// ======================
// Utility Functions
// ======================
function getRelationshipKey(paymentData) {
  return `${paymentData.poNo}_${paymentData.site}_${paymentData.vendor}_${paymentData.vendorId}`.toLowerCase();
}

// MODIFIED: This function no longer pads with zeros
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
    // Handle potential NaN if paymentNo is missing or malformed
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
    return value; // Keep as YYYY-MM-DD for the input[type=date]
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
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    // Handle both YYYY-MM-DD and potential other formats gracefully
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    // GetDate() returns the day of the month from the local timezone.
    // We need to use UTC methods if the dateStr is just YYYY-MM-DD
    // to avoid timezone shifts.
    const parts = dateStr.split('-');
    if (parts.length === 3 && dateStr.length === 10) {
         // Assumes YYYY-MM-DD format
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        return `${day}/${month}/${year}`;
    }

    // Fallback for other date formats
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr; // Return original string if formatting fails
  }
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
    reader.onload = e => resolve(e.gtarget.result);
    reader.onerror = e => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}