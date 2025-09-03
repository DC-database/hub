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
const inquiryContainer = document.getElementById('inquiry-container');
const loginFormContainer = document.getElementById('login-form-container');
const signupFormContainer = document.getElementById('signup-form-container');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const inquiryForm = document.getElementById('inquiry-form');
const signoutBtn = document.getElementById('signout-btn');
const userCompanyNameEl = document.getElementById('user-company-name');
const authErrorEl = document.getElementById('auth-error');
const formMessageEl = document.getElementById('form-message');

const navSubmitInquiry = document.getElementById('nav-submit-inquiry');
const navViewInquiries = document.getElementById('nav-view-inquiries');
const submitInquiryView = document.getElementById('submit-inquiry-view');
const viewInquiriesView = document.getElementById('view-inquiries-view');
const inquiriesTbody = document.getElementById('inquiries-tbody');
const noInquiriesMessage = document.getElementById('no-inquiries-message');

const projectNameInput = document.getElementById('project-name');
const siteSuggestionsContainer = document.getElementById('site-suggestions');

let sitesData = [];

// --- NEW Date Formatting Helper Function ---
function formatDate(dateInput) {
    if (!dateInput) return ''; // Return empty string if date is null, undefined, or empty

    const date = new Date(dateInput);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        return ''; 
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayOfMonth = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `(${dayName}) ${monthName}-${dayOfMonth}-${year}`;
}


// Function to fetch sites from Firebase
function fetchSites() {
    database.ref('sites').once('value', snapshot => {
        if (snapshot.exists()) {
            const sitesObject = snapshot.val();
            sitesData = Object.keys(sitesObject).map(key => ({
                id: key,
                warehouse: sitesObject[key].warehouse || '',
                description: sitesObject[key].description || ''
            }));
        } else {
            console.warn("No data found at the '/sites' path.");
            sitesData = [];
        }
    }).catch(error => console.error("Firebase error on fetchSites:", error.message));
}

// --- UPDATED FUNCTION ---
// Now uses the new formatDate helper
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
                
                // Use the new date formatter
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
                    <td><span class="status-button">${status}</span></td>
                `;
            });
        } else {
            noInquiriesMessage.classList.remove('hidden');
        }
    }).catch(error => {
        console.error("Error fetching inquiries:", error);
        inquiriesTbody.innerHTML = `<tr><td colspan="8" style="color:var(--error-color);">Error loading inquiries.</td></tr>`;
    });
}

// Function to show the main inquiry page
function showInquiryPage(userData) {
    userCompanyNameEl.textContent = userData.companyName;
    authContainer.classList.add('hidden');
    inquiryContainer.classList.remove('hidden');
    navSubmitInquiry.click(); 
    fetchSites();
}

// Function to show the authentication page
function showAuthPage() {
    inquiryContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    sessionStorage.removeItem('loggedInUser');
    userCompanyNameEl.textContent = '';
}

// Tab Navigation Logic
navSubmitInquiry.addEventListener('click', () => {
    submitInquiryView.classList.remove('hidden');
    viewInquiriesView.classList.add('hidden');
    navSubmitInquiry.classList.add('active');
    navViewInquiries.classList.remove('active');
});

navViewInquiries.addEventListener('click', () => {
    viewInquiriesView.classList.remove('hidden');
    submitInquiryView.classList.add('hidden');
    navViewInquiries.classList.add('active');
    navSubmitInquiry.classList.remove('active');
    fetchAndDisplayUserInquiries();
});

// Authentication Logic (unchanged)
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

// Inquiry Form Submission (unchanged)
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
            formMessageEl.classList.remove('error-message');
            formMessageEl.classList.add('success-message');
            inquiryForm.reset();
            setTimeout(() => { 
                formMessageEl.textContent = ''; 
                navViewInquiries.click();
            }, 2000);
        }).catch((error) => { 
            formMessageEl.textContent = `Error: ${error.message}`;
            formMessageEl.classList.add('error-message');
            formMessageEl.classList.remove('success-message');
        });
    } else {
        formMessageEl.textContent = 'Your session has expired. Please log in again.';
        formMessageEl.classList.add('error-message');
        formMessageEl.classList.remove('success-message');
        setTimeout(showAuthPage, 3000);
    }
});

// Autocomplete Logic (unchanged)
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
        const combinedText = `${warehouse} ${description}`;
        return warehouse.includes(inputValue) || description.includes(inputValue) || combinedText.includes(inputValue);
    });
    if (filteredSites.length > 0) {
        siteSuggestionsContainer.classList.remove('hidden');
        filteredSites.forEach(site => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.classList.add('suggestion-item');
            const displayText = `${site.warehouse} - ${site.description}`;
            suggestionDiv.textContent = displayText;
            suggestionDiv.dataset.warehouse = site.warehouse;
            suggestionDiv.dataset.description = site.description;
            suggestionDiv.addEventListener('click', () => {
                projectNameInput.value = displayText;
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
projectNameInput.addEventListener('keydown', (e) => {
    const suggestions = siteSuggestionsContainer.querySelectorAll('.suggestion-item');
    if (!suggestions.length) return;
    const activeSuggestion = siteSuggestionsContainer.querySelector('.suggestion-item.active');
    let index = activeSuggestion ? Array.from(suggestions).indexOf(activeSuggestion) : -1;
    if (activeSuggestion) activeSuggestion.classList.remove('active');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        index = (index + 1) % suggestions.length;
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        index = (index - 1 + suggestions.length) % suggestions.length;
    } else if (e.key === 'Enter' && activeSuggestion) {
        e.preventDefault();
        activeSuggestion.click();
        return;
    } else { return; }
    suggestions[index].classList.add('active');
    suggestions[index].scrollIntoView({ block: 'nearest' });
});

// Initial Page Load
document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = sessionStorage.getItem('loggedInUser'); 
    if (loggedInUser) {
        showInquiryPage(JSON.parse(loggedInUser));
    } else {
        showAuthPage();
    }
});