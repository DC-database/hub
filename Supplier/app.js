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

// --- Autocomplete UI Elements ---
const projectNameInput = document.getElementById('project-name');
const siteSuggestionsContainer = document.getElementById('site-suggestions');

// --- Session Management & UI Functions ---
let sitesData = []; // Variable to store site data for autocomplete

// Function to fetch sites from Firebase
function fetchSites() {
    console.log("1. Attempting to fetch site data from Firebase...");
    database.ref('site').once('value', snapshot => {
        if (snapshot.exists()) {
            // Convert the object of objects to an array
            const sitesObject = snapshot.val();
            sitesData = Object.keys(sitesObject).map(key => {
                return {
                    id: key,
                    warehouse: sitesObject[key].warehouse || '',
                    description: sitesObject[key].description || ''
                };
            });
            console.log("2. SUCCESS: Site data loaded successfully.", sitesData);
        } else {
            console.warn("2. FAILED: No data found at the '/site' path in your database.");
            sitesData = [];
        }
    }).catch(error => {
        console.error("2. FAILED WITH ERROR: Firebase blocked the request.", error.message);
        sitesData = [];
    });
}

// Function to show the main inquiry page
function showInquiryPage(userData) {
    userCompanyNameEl.textContent = userData.companyName;
    authContainer.classList.add('hidden');
    inquiryContainer.classList.remove('hidden');
    fetchSites(); // Fetch site data after the user logs in
}

// Function to show the authentication page
function showAuthPage() {
    inquiryContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    sessionStorage.removeItem('loggedInUser');
    userCompanyNameEl.textContent = '';
}

// --- Form Toggling ---
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginFormContainer.classList.add('hidden');
    signupFormContainer.classList.remove('hidden');
    authErrorEl.textContent = '';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupFormContainer.classList.add('hidden');
    loginFormContainer.classList.remove('hidden');
    authErrorEl.textContent = '';
});

// --- ORIGINAL (WORKING) Authentication Logic ---
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
            setTimeout(() => { formMessageEl.textContent = ''; }, 4000);
        }).catch((error) => { formMessageEl.textContent = `Error: ${error.message}`; });
    } else {
        formMessageEl.textContent = 'Your session has expired. Please log in again.';
        setTimeout(showAuthPage, 3000);
    }
});

// --- Enhanced Autocomplete Logic ---
projectNameInput.addEventListener('input', () => {
    const inputValue = projectNameInput.value.toLowerCase().trim();
    siteSuggestionsContainer.innerHTML = ''; 
    console.log(`3. User typed: "${inputValue}". Filtering data...`);

    if (inputValue.length === 0 || sitesData.length === 0) {
        siteSuggestionsContainer.classList.add('hidden');
        return;
    }

    const filteredSites = sitesData.filter(site => {
        const warehouse = site.warehouse ? String(site.warehouse).toLowerCase() : '';
        const description = site.description ? String(site.description).toLowerCase() : '';
        const combinedText = `${warehouse} ${description}`.toLowerCase();
        
        return warehouse.includes(inputValue) || 
               description.includes(inputValue) || 
               combinedText.includes(inputValue);
    });
    
    console.log(`4. Found ${filteredSites.length} matching sites.`);

    if (filteredSites.length > 0) {
        siteSuggestionsContainer.classList.remove('hidden');
        filteredSites.forEach(site => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.classList.add('suggestion-item');
            
            // Format the display text as "Warehouse - Description"
            const displayText = `${site.warehouse} - ${site.description}`;
            suggestionDiv.textContent = displayText;
            
            // Store the original data as a data attribute
            suggestionDiv.dataset.warehouse = site.warehouse;
            suggestionDiv.dataset.description = site.description;
            
            suggestionDiv.addEventListener('click', () => {
                // Set the input value to the formatted text
                projectNameInput.value = displayText;
                siteSuggestionsContainer.classList.add('hidden');
            });
            siteSuggestionsContainer.appendChild(suggestionDiv);
        });
    } else {
        siteSuggestionsContainer.classList.add('hidden');
    }
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (e.target !== projectNameInput && !siteSuggestionsContainer.contains(e.target)) {
        siteSuggestionsContainer.classList.add('hidden');
    }
});

// Keyboard navigation for suggestions
projectNameInput.addEventListener('keydown', (e) => {
    const suggestions = siteSuggestionsContainer.querySelectorAll('.suggestion-item');
    if (!suggestions.length) return;
    
    const activeSuggestion = siteSuggestionsContainer.querySelector('.suggestion-item.active');
    let index = -1;
    
    if (activeSuggestion) {
        index = Array.from(suggestions).indexOf(activeSuggestion);
        activeSuggestion.classList.remove('active');
    }
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        index = (index + 1) % suggestions.length;
        suggestions[index].classList.add('active');
        suggestions[index].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        index = (index - 1 + suggestions.length) % suggestions.length;
        suggestions[index].classList.add('active');
        suggestions[index].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && activeSuggestion) {
        e.preventDefault();
        activeSuggestion.click();
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