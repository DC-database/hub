const firebaseConfig = {
  apiKey: "AIzaSyCX7bGAkILc49hspEbjQ8h_tcGWnvRxjIA",
  authDomain: "invoice-inquiries.firebaseapp.com",
  databaseURL: "https://invoice-inquiries-default-rtdb.firebaseio.com", 
  projectId: "invoice-inquiries",
  storageBucket: "invoice-inquiries.appspot.com",
  messagingSenderId: "885435969925",
  appId: "1:885435969925:web:dd0d99415dae5c32d7d4ec"
};

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// --- UI Elements ---
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const signOutBtn = document.getElementById('sign-out-btn');

// Desktop Nav
const navInquiriesDesktop = document.getElementById('nav-inquiries-desktop');
const navArchiveDesktop = document.getElementById('nav-archive-desktop');
const navUploadCsvDesktop = document.getElementById('nav-upload-csv-desktop');
// Mobile Nav
const navInquiriesMobile = document.getElementById('nav-inquiries-mobile');
const navArchiveMobile = document.getElementById('nav-archive-mobile');
const navUploadCsvMobile = document.getElementById('nav-upload-csv-mobile');

// Views
const inquiriesView = document.getElementById('inquiries-view');
const archiveView = document.getElementById('archive-view');
const uploadCsvView = document.getElementById('upload-csv-view');

// Inquiries Table
const inquiriesTableBody = document.getElementById('inquiries-table-body');
const searchBox = document.getElementById('search-box');
const noResultsMessage = document.getElementById('no-results-message');

// Archive Table
const archiveTableBody = document.getElementById('archive-table-body');
const noArchiveMessage = document.getElementById('no-archive-message');

// CSV Uploader
const csvFileInput = document.getElementById('csv-file-input');
const fileInputLabel = document.getElementById('file-input-label');
const uploadBtn = document.getElementById('upload-btn');
const statusMessage = document.getElementById('status-message');

// Modal
const updateModal = document.getElementById('update-modal');
const updateForm = document.getElementById('update-form');
const updateNotesTextarea = document.getElementById('update-notes');
const cancelUpdateBtn = document.getElementById('cancel-update-btn');

// --- Global State ---
let allInquiries = [];
let currentSort = { column: 'dateSubmitted', order: 'desc' };
let inquiriesRef, inquiriesListener;

// --- Authentication Logic ---
auth.onAuthStateChanged(user => {
    if (user) {
        loginContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        attachDatabaseListener();
    } else {
        dashboardContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        detachDatabaseListener();
        allInquiries = [];
        updateDisplay();
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    loginError.textContent = '';
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            loginError.textContent = 'Invalid email or password.';
        });
});

signOutBtn.addEventListener('click', () => { auth.signOut(); });

// --- Navigation Logic ---
function switchToView(viewName) {
    inquiriesView.classList.add('hidden');
    archiveView.classList.add('hidden');
    uploadCsvView.classList.add('hidden');

    const allNavButtons = [navInquiriesDesktop, navArchiveDesktop, navUploadCsvDesktop, navInquiriesMobile, navArchiveMobile, navUploadCsvMobile];
    allNavButtons.forEach(btn => btn.classList.remove('active'));
    
    if (viewName === 'inquiries') {
        inquiriesView.classList.remove('hidden');
        navInquiriesDesktop.classList.add('active');
        navInquiriesMobile.classList.add('active');
    } else if (viewName === 'archive') {
        archiveView.classList.remove('hidden');
        navArchiveDesktop.classList.add('active');
        navArchiveMobile.classList.add('active');
    } else if (viewName === 'upload') {
        uploadCsvView.classList.remove('hidden');
        navUploadCsvDesktop.classList.add('active');
        navUploadCsvMobile.classList.add('active');
    }
}
navInquiriesDesktop.addEventListener('click', () => switchToView('inquiries'));
navInquiriesMobile.addEventListener('click', () => switchToView('inquiries'));
navArchiveDesktop.addEventListener('click', () => switchToView('archive'));
navArchiveMobile.addEventListener('click', () => switchToView('archive'));
navUploadCsvDesktop.addEventListener('click', () => switchToView('upload'));
navUploadCsvMobile.addEventListener('click', () => switchToView('upload'));

// --- Database Logic ---
function attachDatabaseListener() {
    inquiriesRef = database.ref('inquiries');
    inquiriesListener = inquiriesRef.on('value', (snapshot) => {
        const inquiriesArray = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            for (const key in data) {
                inquiriesArray.push({ id: key, ...data[key] });
            }
        }
        allInquiries = inquiriesArray;
        updateDisplay();
    });
}
function detachDatabaseListener() {
    if (inquiriesRef && inquiriesListener) {
        inquiriesRef.off('value', inquiriesListener);
    }
}

// --- Event Delegation for Table Buttons ---
document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target) return;
    const inquiryId = target.dataset.id;
    if (!inquiryId) return;

    if (target.classList.contains('btn-update')) {
        const currentNotes = allInquiries.find(inq => inq.id === inquiryId)?.adminNotes || '';
        openUpdateModal(inquiryId, currentNotes);
    }
    if (target.classList.contains('btn-close')) {
        closeInquiry(inquiryId);
    }
    if (target.classList.contains('btn-reopen')) {
        reopenInquiry(inquiryId);
    }
    if (target.classList.contains('btn-delete')) {
        deleteInquiry(inquiryId);
    }
});

// --- Inquiry Actions ---
function closeInquiry(inquiryId) {
    database.ref('inquiries/' + inquiryId).update({ status: 'Closed' });
}
function reopenInquiry(inquiryId) {
    database.ref('inquiries/' + inquiryId).update({ status: 'Updated' });
}
function deleteInquiry(inquiryId) {
    const isConfirmed = confirm("Are you sure you want to permanently delete this inquiry? This action cannot be undone.");
    if (isConfirmed) {
        database.ref('inquiries/' + inquiryId).remove()
            .then(() => {
                console.log(`Inquiry ${inquiryId} has been deleted.`);
            })
            .catch((error) => {
                console.error("Error deleting inquiry: ", error);
            });
    }
}

// --- Modal Logic ---
updateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inquiryId = updateForm.dataset.id;
    const newNotes = updateNotesTextarea.value;
    const attendedDate = new Date().toISOString().split('T')[0];
    database.ref('inquiries/' + inquiryId).update({
        adminNotes: newNotes,
        attendedDate: attendedDate,
        status: 'Updated'
    }).then(() => closeUpdateModal());
});
function openUpdateModal(inquiryId, currentNotes) {
    updateForm.dataset.id = inquiryId;
    updateNotesTextarea.value = currentNotes;
    updateModal.classList.remove('hidden');
}
function closeUpdateModal() {
    updateModal.classList.add('hidden');
}
cancelUpdateBtn.addEventListener('click', closeUpdateModal);
updateModal.addEventListener('click', (e) => {
    if (e.target === updateModal) closeUpdateModal();
});


// --- UI & Data Display ---
function updateDisplay() {
    const openInquiries = allInquiries.filter(inq => inq.status !== 'Closed');
    const closedInquiries = allInquiries.filter(inq => inq.status === 'Closed');
    
    const sortedOpenInquiries = sortData(openInquiries);
    const filteredOpenInquiries = filterData(sortedOpenInquiries);
    
    renderInquiriesTable(filteredOpenInquiries);
    renderArchiveTable(closedInquiries);
    updateSortHeaders();
}
function renderInquiriesTable(data) {
    inquiriesTableBody.innerHTML = '';
    noResultsMessage.style.display = data.length === 0 ? 'block' : 'none';
    data.forEach(inquiry => {
        const row = document.createElement('tr');
        if (inquiry.status === 'Closed') {
            row.classList.add('status-closed');
        }
        const formattedAmount = parseFloat(inquiry.invoiceAmount).toLocaleString('en-US', { style: 'currency', currency: 'QAR' });
        const buttonDisabled = inquiry.status === 'Closed' ? 'disabled' : '';
        row.innerHTML = `
            <td>${inquiry.projectName || ''}</td>
            <td>${inquiry.companyName || ''}</td>
            <td>${formattedAmount}</td>
            <td>${inquiry.dateSubmitted || ''}</td>
            <td class="note-cell" title="${inquiry.notes || ''}">${inquiry.notes || ''}</td>
            <td class="note-cell" title="${inquiry.adminNotes || ''}">${inquiry.adminNotes || ''}</td>
            <td>${inquiry.attendedDate || 'N/A'}</td>
            <td class="actions-cell">
                <button class="btn-update" data-id="${inquiry.id}" ${buttonDisabled}>Update</button>
                <button class="btn-close" data-id="${inquiry.id}" ${buttonDisabled}>Close</button>
                <button class="btn-delete" data-id="${inquiry.id}" ${buttonDisabled}>Delete</button>
            </td>`;
        inquiriesTableBody.appendChild(row);
    });
}
function renderArchiveTable(data) {
    archiveTableBody.innerHTML = '';
    noArchiveMessage.style.display = data.length === 0 ? 'block' : 'none';
    data.sort((a,b) => (b.attendedDate ? new Date(b.attendedDate).getTime() : 0) - (a.attendedDate ? new Date(a.attendedDate).getTime() : 0) );
    data.forEach(inquiry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${inquiry.projectName || ''}</td>
            <td>${inquiry.companyName || ''}</td>
            <td>${parseFloat(inquiry.invoiceAmount).toLocaleString('en-US', { style: 'currency', currency: 'QAR' })}</td>
            <td>${inquiry.dateSubmitted || ''}</td>
            <td class="note-cell" title="${inquiry.notes || ''}">${inquiry.notes || ''}</td>
            <td class="note-cell" title="${inquiry.adminNotes || ''}">${inquiry.adminNotes || ''}</td>
            <td>${inquiry.attendedDate || 'N/A'}</td>
            <td><button class="btn-reopen" data-id="${inquiry.id}">Re-open</button></td>`;
        archiveTableBody.appendChild(row);
    });
}

// --- Filtering & Sorting ---
function filterData(data) {
    const searchTerm = searchBox.value.toLowerCase();
    if (!searchTerm) return data;
    return data.filter(inquiry => 
        (inquiry.companyName || '').toLowerCase().includes(searchTerm) ||
        (inquiry.projectName || '').toLowerCase().includes(searchTerm) ||
        (inquiry.invoiceNumber || '').toLowerCase().includes(searchTerm)
    );
}
function sortData(data) {
    const { column, order } = currentSort;
    return [...data].sort((a, b) => {
        let aVal = a[column] || '';
        let bVal = b[column] || '';
        if (column === 'invoiceAmount') { aVal = parseFloat(aVal); bVal = parseFloat(bVal); } 
        else if (column === 'dateSubmitted') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime(); } 
        else { aVal = aVal.toString().toLowerCase(); bVal = bVal.toString().toLowerCase(); }
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
}
function updateSortHeaders() {
    document.querySelectorAll('#inquiries-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.column === currentSort.column) {
            th.classList.add(`sort-${currentSort.order}`);
        }
    });
}
searchBox.addEventListener('input', updateDisplay);
document.querySelectorAll('#inquiries-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.column;
        if (!column) return;
        if (currentSort.column === column) { currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc'; } 
        else { currentSort.column = column; currentSort.order = 'asc'; }
        updateDisplay();
    });
});

// --- CSV Upload Logic ---
uploadBtn.addEventListener('click', handleCsvUpload);
csvFileInput.addEventListener('change', () => {
    if (csvFileInput.files.length > 0) {
        const fileName = csvFileInput.files[0].name;
        document.getElementById('file-input-label').querySelector('span').textContent = fileName;
        document.getElementById('file-input-label').classList.add('file-selected');
        updateStatusMessage('File selected. Click upload to proceed.', 'info');
    }
});
function handleCsvUpload() {
    const file = csvFileInput.files[0];
    if (!file) {
        updateStatusMessage('Please choose a CSV file first.', 'error');
        return;
    }
    updateStatusMessage('Parsing CSV file...', 'info');
    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => uploadCsvToFirebase(results.data),
        error: (error) => updateStatusMessage(`Error parsing file: ${error.message}`, 'error')
    });
}
function uploadCsvToFirebase(data) {
    if (!data || data.length === 0) {
        updateStatusMessage('CSV file is empty or invalid.', 'error');
        return;
    }
    updateStatusMessage(`Uploading ${data.length} records...`, 'info');
    const sitesRef = database.ref('sites');
    const dataToUpload = {};
    let validRecordCount = 0;
    data.forEach(row => {
        const warehouse = row.Warehouse;
        const description = row.Description;
        if (warehouse && description) {
            const newKey = sitesRef.push().key;
            dataToUpload[newKey] = { warehouse, description, timestamp: Date.now() };
            validRecordCount++;
        }
    });
    if (validRecordCount === 0) {
        updateStatusMessage('No valid records found. Make sure CSV has "Warehouse" and "Description" columns.', 'error');
        return;
    }
    sitesRef.update(dataToUpload)
        .then(() => {
            updateStatusMessage(`Successfully uploaded ${validRecordCount} sites!`, 'success');
            csvFileInput.value = '';
            document.getElementById('file-input-label').querySelector('span').textContent = 'Choose a file...';
            document.getElementById('file-input-label').classList.remove('file-selected');
        })
        .catch(error => updateStatusMessage(`Error uploading to Firebase: ${error.message}`, 'error'));
}
function updateStatusMessage(message, type) {
    document.getElementById('status-message').textContent = message;
    document.getElementById('status-message').className = type;
}