document.addEventListener('DOMContentLoaded', () => {
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
    const authContainer = document.getElementById('auth-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const loginForm = document.getElementById('login-form');
    const authErrorEl = document.getElementById('auth-error');
    const signoutBtn = document.getElementById('signout-btn');
    const userEmailDisplay = document.getElementById('user-email-display');
    const pageTitleEl = document.getElementById('page-title');

    // Sidebar Navigation
    const navLinks = {
        inquiries: document.getElementById('nav-inquiries'),
        archive: document.getElementById('nav-archive'),
        upload: document.getElementById('nav-upload-csv')
    };

    // Bottom Mobile Navigation
    const bottomNavLinks = {
        inquiries: document.getElementById('bottom-nav-inquiries'),
        archive: document.getElementById('bottom-nav-archive'),
        upload: document.getElementById('bottom-nav-upload-csv')
    };

    const views = {
        inquiries: document.getElementById('inquiries-view'),
        archive: document.getElementById('archive-view'),
        upload: document.getElementById('upload-csv-view')
    };
    
    const inquiriesTableBody = document.getElementById('inquiries-table-body');
    const archiveTableBody = document.getElementById('archive-table-body');
    const searchBox = document.getElementById('search-box');
    const noResultsMessage = document.getElementById('no-results-message');
    const noArchiveMessage = document.getElementById('no-archive-message');

    const csvFileInput = document.getElementById('csv-file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const statusMessage = document.getElementById('status-message');
    
    const updateModal = document.getElementById('update-modal');
    const updateForm = document.getElementById('update-form');
    const updateNotesTextarea = document.getElementById('update-notes');
    const cancelUpdateBtn = document.getElementById('cancel-update-btn');

    // --- Global State ---
    let allInquiries = [];
    let inquiriesRef, inquiriesListener;

    // --- Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            authContainer.classList.add('hidden');
            dashboardContainer.classList.remove('hidden');
            userEmailDisplay.textContent = user.email;
            attachDatabaseListener();
            switchToView('inquiries');
        } else {
            dashboardContainer.classList.add('hidden');
            authContainer.classList.remove('hidden');
            detachDatabaseListener();
            userEmailDisplay.textContent = '';
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        authErrorEl.textContent = '';
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => { authErrorEl.textContent = 'Invalid email or password.'; });
    });

    signoutBtn.addEventListener('click', () => auth.signOut());

    // --- Navigation ---
    function switchToView(viewName) {
        // Hide all views
        Object.values(views).forEach(view => view.classList.add('hidden'));
        // Deactivate all nav links (sidebar and bottom)
        Object.values(navLinks).forEach(link => link.classList.remove('active'));
        Object.values(bottomNavLinks).forEach(link => link.classList.remove('active'));

        if (views[viewName] && navLinks[viewName] && bottomNavLinks[viewName]) {
            // Show the correct view
            views[viewName].classList.remove('hidden');
            // Activate the correct links in both navs
            navLinks[viewName].classList.add('active');
            bottomNavLinks[viewName].classList.add('active');
            // Update page title
            pageTitleEl.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
        }
    }
    // Attach listeners to sidebar links
    navLinks.inquiries.addEventListener('click', (e) => { e.preventDefault(); switchToView('inquiries'); });
    navLinks.archive.addEventListener('click', (e) => { e.preventDefault(); switchToView('archive'); });
    navLinks.upload.addEventListener('click', (e) => { e.preventDefault(); switchToView('upload'); });

    // Attach listeners to bottom nav links
    bottomNavLinks.inquiries.addEventListener('click', (e) => { e.preventDefault(); switchToView('inquiries'); });
    bottomNavLinks.archive.addEventListener('click', (e) => { e.preventDefault(); switchToView('archive'); });
    bottomNavLinks.upload.addEventListener('click', (e) => { e.preventDefault(); switchToView('upload'); });

    // --- Database Logic ---
    function attachDatabaseListener() {
        inquiriesRef = database.ref('inquiries');
        inquiriesListener = inquiriesRef.on('value', snapshot => {
            const inquiriesArray = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const key in data) {
                    inquiriesArray.push({ id: key, ...data[key] });
                }
            }
            allInquiries = inquiriesArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            updateDisplay();
        });
    }

    function detachDatabaseListener() {
        if (inquiriesRef && inquiriesListener) inquiriesRef.off('value', inquiriesListener);
    }

    // --- Main Display & Filtering Logic ---
    function updateDisplay() {
        const searchTerm = searchBox.value.toLowerCase();
        const openInquiries = allInquiries.filter(inq => inq.status !== 'Closed');
        const closedInquiries = allInquiries.filter(inq => inq.status === 'Closed');

        const filteredOpen = openInquiries.filter(inq => 
            (inq.companyName || '').toLowerCase().includes(searchTerm) ||
            (inq.projectName || '').toLowerCase().includes(searchTerm)
        );
        
        renderInquiriesTable(filteredOpen);
        renderArchiveTable(closedInquiries);
    }
    searchBox.addEventListener('input', updateDisplay);

    // --- Table Rendering ---
    function renderInquiriesTable(data) {
        inquiriesTableBody.innerHTML = '';
        noResultsMessage.classList.toggle('hidden', data.length > 0);
        data.forEach(inquiry => {
            const status = inquiry.status || 'New';
            const row = `
                <tr>
                    <td data-label="Project / Site">${inquiry.projectName || ''}</td>
                    <td data-label="Company">${inquiry.companyName || ''}</td>
                    <td data-label="Amount">${parseFloat(inquiry.invoiceAmount || 0).toLocaleString('en-US', { style: 'currency', currency: 'QAR' })}</td>
                    <td data-label="Date Submitted">${new Date(inquiry.timestamp).toLocaleDateString()}</td>
                    <td data-label="Last Update">${inquiry.adminNotes || 'N/A'}</td>
                    <td data-label="Status"><span class="status-pill ${status.toLowerCase()}">${status}</span></td>
                    <td data-label="Actions" class="actions-cell">
                        <button class="actions-button btn-update" data-id="${inquiry.id}">Update</button>
                        <button class="actions-button btn-close" data-id="${inquiry.id}">Close</button>
                        <button class="actions-button btn-danger btn-delete" data-id="${inquiry.id}">Delete</button>
                    </td>
                </tr>`;
            inquiriesTableBody.innerHTML += row;
        });
    }

    function renderArchiveTable(data) {
        archiveTableBody.innerHTML = '';
        noArchiveMessage.classList.toggle('hidden', data.length > 0);
        data.forEach(inquiry => {
            const row = `
                <tr>
                    <td data-label="Project / Site">${inquiry.projectName || ''}</td>
                    <td data-label="Company">${inquiry.companyName || ''}</td>
                    <td data-label="Amount">${parseFloat(inquiry.invoiceAmount || 0).toLocaleString('en-US', { style: 'currency', currency: 'QAR' })}</td>
                    <td data-label="Date Closed">${inquiry.attendedDate ? new Date(inquiry.attendedDate).toLocaleDateString() : 'N/A'}</td>
                    <td data-label="Last Update">${inquiry.adminNotes || 'N/A'}</td>
                    <td data-label="Status"><span class="status-pill closed">Closed</span></td>
                    <td data-label="Actions" class="actions-cell">
                        <button class="actions-button btn-reopen" data-id="${inquiry.id}">Re-open</button>
                    </td>
                </tr>`;
            archiveTableBody.innerHTML += row;
        });
    }

    // --- Inquiry Actions (Update, Close, Re-open, Delete) ---
    document.addEventListener('click', event => {
        const target = event.target;
        const inquiryId = target.dataset.id;
        if (!inquiryId) return;

        if (target.classList.contains('btn-update')) {
            const currentNotes = allInquiries.find(inq => inq.id === inquiryId)?.adminNotes || '';
            openUpdateModal(inquiryId, currentNotes);
        }
        if (target.classList.contains('btn-close')) {
            database.ref('inquiries/' + inquiryId).update({
                status: 'Closed',
                attendedDate: new Date().toISOString().split('T')[0],
                adminNotes: 'Approved & Forwarded to Accounts'
            });
        }
        if (target.classList.contains('btn-reopen')) {
            database.ref('inquiries/' + inquiryId).update({ status: 'Updated' });
        }
        if (target.classList.contains('btn-delete')) {
            if (confirm("Are you sure you want to permanently delete this inquiry?")) {
                database.ref('inquiries/' + inquiryId).remove();
            }
        }
    });

    // --- Modal Logic ---
    function openUpdateModal(inquiryId, currentNotes) {
        updateForm.dataset.id = inquiryId;
        updateNotesTextarea.value = currentNotes;
        updateModal.classList.remove('hidden');
    }
    function closeUpdateModal() {
        updateModal.classList.add('hidden');
    }
    updateForm.addEventListener('submit', e => {
        e.preventDefault();
        const inquiryId = updateForm.dataset.id;
        database.ref('inquiries/' + inquiryId).update({
            adminNotes: updateNotesTextarea.value,
            attendedDate: new Date().toISOString().split('T')[0],
            status: 'Updated'
        }).then(closeUpdateModal);
    });
    cancelUpdateBtn.addEventListener('click', closeUpdateModal);

    // --- CSV Upload Logic ---
    uploadBtn.addEventListener('click', () => {
        const file = csvFileInput.files[0];
        if (!file) { updateStatusMessage('Please choose a CSV file first.', 'error'); return; }
        updateStatusMessage('Parsing CSV...', 'info');
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: (results) => uploadCsvToFirebase(results.data),
            error: (err) => updateStatusMessage(`Error parsing file: ${err.message}`, 'error')
        });
    });

    function uploadCsvToFirebase(data) {
        if (!data || data.length === 0) { updateStatusMessage('CSV file is empty or invalid.', 'error'); return; }
        updateStatusMessage(`Uploading ${data.length} records...`, 'info');
        const sitesRef = database.ref('sites');
        const dataToUpload = {};
        let validRecordCount = 0;
        data.forEach(row => {
            if (row.Warehouse && row.Description) {
                const newKey = sitesRef.push().key;
                dataToUpload[newKey] = { warehouse: row.Warehouse, description: row.Description };
                validRecordCount++;
            }
        });
        if (validRecordCount === 0) { updateStatusMessage('No valid records found in CSV.', 'error'); return; }
        sitesRef.update(dataToUpload)
            .then(() => updateStatusMessage(`Successfully uploaded ${validRecordCount} sites!`, 'success'))
            .catch(error => updateStatusMessage(`Firebase error: ${error.message}`, 'error'));
    }

    function updateStatusMessage(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = type; // Use this for styling success/error/info messages
    }
});