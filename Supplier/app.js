//
// ⚠️ PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ⚠️
//
const firebaseConfig = {
    apiKey: "AIzaSyCX7bGAkILc49hspEbjQ8h_tcGWnvRxjIA",
    authDomain: "invoice-inquiries.firebaseapp.com",
    projectId: "invoice-inquiries",
    storageBucket: "invoice-inquiries.firebasestorage.app",
    messagingSenderId: "885435969925",
    appId: "1:885435969925:web:dd0d99415dae5c32d7d4ec",
    measurementId: "G-4KF8BSEBXM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- UI Elements ---
const authContainer = document.getElementById('auth-container');
const loginFormContainer = document.getElementById('login-form-container');
const signupFormContainer = document.getElementById('signup-form-container');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authErrorEl = document.getElementById('auth-error');
const inquiryContainer = document.getElementById('inquiry-container');
const userCompanyNameEl = document.getElementById('user-company-name');
const signoutBtn = document.getElementById('signout-btn');
const pageTitleEl = document.getElementById('page-title');
const navSubmitInquiry = document.getElementById('nav-submit-inquiry');
const navViewInquiries = document.getElementById('nav-view-inquiries');
const submitInquiryView = document.getElementById('submit-inquiry-view');
const viewInquiriesView = document.getElementById('view-inquiries-view');
const inquiryForm = document.getElementById('inquiry-form');
const formMessageEl = document.getElementById('form-message');
const inquiriesTbody = document.getElementById('inquiries-tbody');
const noInquiriesMessage = document.getElementById('no-inquiries-message');
const addInquiryBtn = document.getElementById('add-inquiry-btn');
const projectNameInput = document.getElementById('project-name');
const siteSuggestionsContainer = document.getElementById('site-suggestions');
const bottomNavView = document.getElementById('bottom-nav-view');
const bottomNavSubmit = document.getElementById('bottom-nav-submit');
const bottomNavSignout = document.getElementById('bottom-nav-signout'); // <-- ADDED
let sitesData = [];

// --- REFACTORED NAVIGATION LOGIC ---
function showViewInquiriesPage() {
    viewInquiriesView.classList.remove('hidden');
    submitInquiryView.classList.add('hidden');
    
    // Sync sidebar and bottom nav active states
    navViewInquiries.classList.add('active');
    navSubmitInquiry.classList.remove('active');
    bottomNavView.classList.add('active');
    bottomNavSubmit.classList.remove('active');

    pageTitleEl.textContent = 'Manage Inquiries';
    fetchAndDisplayUserInquiries();
}

function showSubmitInquiryPage() {
    submitInquiryView.classList.remove('hidden');
    viewInquiriesView.classList.add('hidden');

    // Sync sidebar and bottom nav active states
    navSubmitInquiry.classList.add('active');
    navViewInquiries.classList.remove('active');
    bottomNavSubmit.classList.add('active');
    bottomNavView.classList.remove('active');

    pageTitleEl.textContent = 'Submit New Inquiry';
}

// Attach event listeners to all navigation controls
navViewInquiries.addEventListener('click', (e) => { e.preventDefault(); showViewInquiriesPage(); });
bottomNavView.addEventListener('click', (e) => { e.preventDefault(); showViewInquiriesPage(); });

navSubmitInquiry.addEventListener('click', (e) => { e.preventDefault(); showSubmitInquiryPage(); });
addInquiryBtn.addEventListener('click', () => showSubmitInquiryPage());
bottomNavSubmit.addEventListener('click', (e) => { e.preventDefault(); showSubmitInquiryPage(); });


// --- Page & View Management ---
function showInquiryPage(userData) {
    userCompanyNameEl.textContent = userData.companyName;
    authContainer.classList.add('hidden');
    inquiryContainer.classList.remove('hidden');
    showViewInquiriesPage(); // Set the initial view using the new function
    fetchSites();
}

function showAuthPage() {
    inquiryContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    sessionStorage.removeItem('loggedInUser');
    userCompanyNameEl.textContent = '';
}

// --- Helper Functions ---
function formatDate(dateInput) {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayOfMonth = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `(${dayName}) ${monthName}-${dayOfMonth}-${year}`;
}

// --- Data Fetching ---
function fetchSites() {
    database.ref('sites').once('value', snapshot => {
        if (snapshot.exists()) {
            const sitesObject = snapshot.val();
            sitesData = Object.keys(sitesObject).map(key => ({
                id: key,
                warehouse: sitesObject[key].warehouse || '',
                description: sitesObject[key].description || ''
            }));
        }
    }).catch(error => console.error("Firebase error on fetchSites:", error.message));
}

function fetchAndDisplayUserInquiries() {
    const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!user) return;

    const inquiriesRef = database.ref('inquiries');
    inquiriesTbody.innerHTML = '';
    noInquiriesMessage.classList.add('hidden');

    inquiriesRef.orderByChild('userId').equalTo(user.id).once('value', snapshot => {
        if (snapshot.exists()) {
            const inquiries = snapshot.val();
            const inquiriesArray = Object.values(inquiries).sort((a, b) => b.timestamp - a.timestamp);

            inquiriesArray.forEach(inquiry => {
                const row = inquiriesTbody.insertRow();
                const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'QAR' }).format(inquiry.invoiceAmount);
                const status = inquiry.status || 'Submitted';
                const submittedDate = formatDate(inquiry.timestamp);
                const attendedDate = formatDate(inquiry.attendedDate);

                row.innerHTML = `
                    <td>${submittedDate}</td>
                    <td>${inquiry.invoiceNumber || ''}</td>
                    <td>${formattedAmount}</td>
                    <td>${inquiry.projectName || ''}</td>
                    <td>${inquiry.notes || ''}</td>
                    <td>${inquiry.adminNotes || ''}</td>
                    <td>${attendedDate}</td>
                    <td><span class="status-button" data-status="${status}">${status}</span></td>
                `;
            });
        } else {
            noInquiriesMessage.classList.remove('hidden');
        }
    }).catch(error => {
        console.error("Error fetching inquiries:", error);
    });
}

// --- Authentication Logic ---
showSignupLink.addEventListener('click', (e) => { e.preventDefault(); loginFormContainer.classList.add('hidden'); signupFormContainer.classList.remove('hidden'); authErrorEl.textContent = ''; });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); signupFormContainer.classList.add('hidden'); loginFormContainer.classList.remove('hidden'); authErrorEl.textContent = ''; });

signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const companyName = document.getElementById('signup-company-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    authErrorEl.textContent = '';
    if (!companyName || !email || !password) {
        authErrorEl.textContent = 'All fields are required.';
        return;
    }
    database.ref('users').orderByChild('email').equalTo(email).once('value', snapshot => {
        if (snapshot.exists()) {
            authErrorEl.textContent = 'An account with this email already exists.';
        } else {
            const newUserRef = database.ref('users').push();
            const newUser = { id: newUserRef.key, companyName, email, password };
            newUserRef.set(newUser).then(() => {
                sessionStorage.setItem('loggedInUser', JSON.stringify(newUser));
                showInquiryPage(newUser);
                signupForm.reset();
            }).catch(error => { authErrorEl.textContent = `Signup failed: ${error.message}`; });
        }
    });
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    authErrorEl.textContent = '';
    database.ref('users').orderByChild('email').equalTo(email).once('value', snapshot => {
        if (snapshot.exists()) {
            const users = snapshot.val();
            const userId = Object.keys(users)[0];
            const userData = users[userId];
            if (userData.password === password) {
                const userToStore = { id: userId, companyName: userData.companyName, email: userData.email };
                sessionStorage.setItem('loggedInUser', JSON.stringify(userToStore));
                showInquiryPage(userToStore);
                loginForm.reset();
            } else {
                authErrorEl.textContent = 'Invalid email or password.';
            }
        } else {
            authErrorEl.textContent = 'Invalid email or password.';
        }
    }).catch(error => { authErrorEl.textContent = `Login failed: ${error.message}`; });
});

signoutBtn.addEventListener('click', showAuthPage);

// ADDED FOR MOBILE SIGN OUT
bottomNavSignout.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthPage();
});

// --- Inquiry Form Submission ---
inquiryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (user) {
        const inquiryData = {
            userId: user.id, userEmail: user.email, companyName: user.companyName,
            invoiceNumber: document.getElementById('invoice-number').value,
            invoiceAmount: parseFloat(document.getElementById('invoice-amount').value),
            dateSubmitted: document.getElementById('date-submitted').value,
            projectName: document.getElementById('project-name').value,
            notes: document.getElementById('notes').value,
            status: 'Submitted', timestamp: Date.now()
        };
        database.ref('inquiries').push(inquiryData).then(() => {
            formMessageEl.textContent = 'Inquiry submitted successfully!';
            inquiryForm.reset();
            setTimeout(() => {
                formMessageEl.textContent = '';
                showViewInquiriesPage();
            }, 2000);
        }).catch((error) => {
            formMessageEl.textContent = `Error: ${error.message}`;
        });
    } else {
        alert('Your session has expired. Please log in again.');
        showAuthPage();
    }
});

// --- Autocomplete Logic ---
projectNameInput.addEventListener('input', () => {
    const inputValue = projectNameInput.value.toLowerCase().trim();
    siteSuggestionsContainer.innerHTML = '';
    if (inputValue.length === 0 || sitesData.length === 0) {
        siteSuggestionsContainer.classList.add('hidden');
        return;
    }
    const filteredSites = sitesData.filter(site => {
        const warehouse = site.warehouse ? String(site.warehouse).toLowerCase() : '';
        const description = site.description ? String(site.description).toLowerCase() : '';
        return (warehouse + ' ' + description).toLowerCase().includes(inputValue);
    });
    if (filteredSites.length > 0) {
        siteSuggestionsContainer.classList.remove('hidden');
        filteredSites.forEach(site => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.classList.add('suggestion-item');
            suggestionDiv.textContent = `${site.warehouse} - ${site.description}`;
            suggestionDiv.addEventListener('click', () => {
                projectNameInput.value = suggestionDiv.textContent;
                siteSuggestionsContainer.classList.add('hidden');
            });
            siteSuggestionsContainer.appendChild(suggestionDiv);
        });
    } else {
        siteSuggestionsContainer.classList.add('hidden');
    }
});
document.addEventListener('click', (e) => {
    if (e.target !== projectNameInput && !siteSuggestionsContainer.contains(e.target)) {
        siteSuggestionsContainer.classList.add('hidden');
    }
});

// --- Initial Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (loggedInUser) {
        showInquiryPage(JSON.parse(loggedInUser));
    } else {
        showAuthPage();
    }
});