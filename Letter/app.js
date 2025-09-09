// IMPORTANT: This script uses the Firebase Modular SDK (v9+).
// Make sure your index.html includes the compat libraries for this code to work as-is.

// Your provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDuiAFUGfraypOe_Ytrvp2SL5MEeAMRh1Q",
  authDomain: "letter-64b85.firebaseapp.com",
  databaseURL: "https://letter-64b85-default-rtdb.firebaseio.com",
  projectId: "letter-64b85",
  storageBucket: "letter-64b85.firebasestorage.app",
  messagingSenderId: "931954127691",
  appId: "1:931954127691:web:7af38c0a71685af4c26ece",
  measurementId: "G-QVBLJ20X09"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DOM Elements
const elements = {
  // Mobile Modal
  mobileModal: document.getElementById('mobile-modal'),
  mobileInput: document.getElementById('mobile-input'),
  verifyBtn: document.getElementById('verify-btn'),
  mobileError: document.getElementById('mobile-error'),
  unregisteredMessage: document.getElementById('unregistered-message'),
  whatsappBtn: document.getElementById('whatsapp-btn'),
  tryAgainBtn: document.getElementById('try-again-btn'),
  loginMessage: document.getElementById('login-message'),

  // Password Login Modal
  passwordModal: document.getElementById('password-modal'),
  passwordInput: document.getElementById('password-input'),
  loginBtn: document.getElementById('login-btn'),
  passwordError: document.getElementById('password-error'),
  passwordWelcomeName: document.getElementById('password-welcome-name'),

  // Set New Password Modal
  setPasswordModal: document.getElementById('set-password-modal'),
  newPasswordInput: document.getElementById('new-password-input'),
  confirmPasswordInput: document.getElementById('confirm-password-input'),
  setPasswordBtn: document.getElementById('set-password-btn'),
  setPasswordError: document.getElementById('set-password-error'),
  setPasswordWelcomeName: document.getElementById('set-password-welcome-name'),
  
  // App Container
  appContainer: document.querySelector('.app-container'),
  form: document.getElementById('document-form'),
  from: document.getElementById('from'),
  site: document.getElementById('site'),
  class: document.getElementById('class'),
  dateSent: document.getElementById('dateSent'),
  purpose: document.getElementById('purpose'),
  submitBtn: document.getElementById('submit-btn'),
  successMessage: document.getElementById('success-message'),
  goBackBtn: document.getElementById('go-back-btn'),
  recentCodesList: document.getElementById('recent-codes-list'),
  welcomeMessage: document.getElementById('welcome-message')
};

let datePickerInstance = null;
let currentUserData = null; // To hold user object
let currentUserKey = null; // To hold user's Firebase key for updates

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', function() {
  showMobileVerification();
  
  // Mobile verification listeners
  elements.verifyBtn.addEventListener('click', verifyMobile);
  elements.mobileInput.addEventListener('keyup', handleEnter(elements.verifyBtn));
  
  // Password login listeners
  elements.loginBtn.addEventListener('click', verifyPassword);
  elements.passwordInput.addEventListener('keyup', handleEnter(elements.loginBtn));

  // Set new password listeners
  elements.setPasswordBtn.addEventListener('click', setNewPassword);
  elements.newPasswordInput.addEventListener('keyup', handleEnter(elements.setPasswordBtn));
  elements.confirmPasswordInput.addEventListener('keyup', handleEnter(elements.setPasswordBtn));
  
  // Other listeners
  elements.whatsappBtn.addEventListener('click', openWhatsApp);
  elements.tryAgainBtn.addEventListener('click', function(event) {
    event.preventDefault();
    elements.unregisteredMessage.classList.add('hidden');
    elements.verifyBtn.classList.remove('hidden');
    elements.mobileInput.value = '';
    elements.mobileInput.focus();
  });
  if (elements.goBackBtn) {
    elements.goBackBtn.addEventListener('click', goBack);
  }
});

// Helper for 'Enter' key press
function handleEnter(button) {
  return function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      button.click();
    }
  };
}

function showMobileVerification() {
  elements.mobileModal.style.display = 'flex';
  elements.passwordModal.style.display = 'none';
  elements.setPasswordModal.style.display = 'none';
  elements.appContainer.classList.add('hidden');
}

async function showApp() {
  elements.mobileModal.style.display = 'none';
  elements.passwordModal.style.display = 'none';
  elements.setPasswordModal.style.display = 'none';
  elements.appContainer.classList.remove('hidden');
  
  try {
    displayWelcomeMessage();
    await initializeForm();
    await displayRecentCodes();
    setDefaultDate();
  } catch (error) {
    console.error('Error initializing form:', error);
    showError('Failed to load form data. Please refresh the page.');
  }
}

// --- Step 1: Mobile Verification ---
async function verifyMobile() {
  const mobileNumber = elements.mobileInput.value.trim();
  const fullMobile = '974' + mobileNumber;
  
  if (!/^[0-9]{7,8}$/.test(mobileNumber)) {
    return showMobileError('Please enter a valid 7 or 8 digit mobile number');
  }
  
  setMobileLoadingState(true);
  
  try {
    const usersRef = db.ref('Users');
    const snapshot = await usersRef.orderByChild('Mob').equalTo(fullMobile).once('value');

    if (snapshot.exists()) {
      snapshot.forEach(childSnapshot => {
        currentUserKey = childSnapshot.key; // Get the user's unique Firebase key
        currentUserData = childSnapshot.val(); // Get the user's data object
      });

      sessionStorage.setItem('verifiedUserName', currentUserData.Name);
      elements.mobileModal.style.display = 'none';

      // Check if password exists
      if (currentUserData.Password && currentUserData.Password.length > 0) {
        // User has a password, ask for it
        elements.passwordWelcomeName.textContent = currentUserData.Name;
        elements.passwordModal.style.display = 'flex';
        elements.passwordInput.focus();
      } else {
        // First-time login, ask to set a password
        elements.setPasswordWelcomeName.textContent = currentUserData.Name;
        elements.setPasswordModal.style.display = 'flex';
        elements.newPasswordInput.focus();
      }

    } else {
      elements.unregisteredMessage.classList.remove('hidden');
      elements.verifyBtn.classList.add('hidden');
    }
  } catch (error) {
    showMobileError('Network error. Please try again.');
    console.error('Firebase Error:', error);
  } finally {
    setMobileLoadingState(false);
  }
}

// --- Step 2a: Login with Existing Password ---
function verifyPassword() {
  const enteredPassword = elements.passwordInput.value;
  if (!enteredPassword) {
    return showPasswordError('Please enter your password.');
  }

  if (enteredPassword === currentUserData.Password) {
    sessionStorage.setItem('verifiedMobile', '974' + elements.mobileInput.value.trim());
    showApp(); // Success!
  } else {
    // --- THIS IS THE ONLY LINE THAT CHANGED ---
    showPasswordError('Incorrect password. Please ensure CAPS LOCK is on and try again.');
  }
}

// --- Step 2b: Set a New Password ---
async function setNewPassword() {
    const newPassword = elements.newPasswordInput.value;
    const confirmPassword = elements.confirmPasswordInput.value;

    if (!newPassword || !confirmPassword) {
        return showSetPasswordError('Please fill both password fields.');
    }
    if (newPassword.length < 6) {
        return showSetPasswordError('Password must be at least 6 characters long.');
    }
    if (newPassword !== confirmPassword) {
        return showSetPasswordError('Passwords do not match.');
    }

    setLoadingState(true, elements.setPasswordBtn, "Saving...");

    try {
        const userRef = db.ref(`Users/${currentUserKey}`);
        await userRef.update({ Password: newPassword });

        // Password set, ask user to log in again
        elements.setPasswordModal.style.display = 'none';
        elements.mobileInput.value = '';
        elements.passwordInput.value = '';
        elements.newPasswordInput.value = '';
        elements.confirmPasswordInput.value = ''; // Corrected a small typo here
        showMobileVerification();
        showLoginMessage('Password created successfully! Please log in now.');

    } catch (error) {
        console.error('Error saving password:', error);
        showSetPasswordError('Could not save password. Please try again.');
    } finally {
        setLoadingState(false, elements.setPasswordBtn, "Save Password");
    }
}


// --- Autocomplete & Form Logic (No changes needed here) ---
async function initializeForm() {
    try {
        const [sites, documentClasses] = await Promise.all([
            fetchDataFromFirebase('Sites', 'Warehouse', 'Description'),
            fetchDataFromFirebase('Document Class', 'Ref', 'Description')
        ]);
        convertToAutocomplete('site', sites);
        convertToAutocomplete('class', documentClasses);
        datePickerInstance = flatpickr("#dateSent", {
            altInput: true,
            altFormat: "d-M-Y",
            dateFormat: "Y-m-d",
        });
        elements.form.addEventListener('submit', (e) => e.preventDefault());
        elements.submitBtn.addEventListener('click', handleFormSubmit);
    } catch (error) {
        console.error('Error initializing form:', error);
        throw error;
    }
}
async function fetchDataFromFirebase(node, codeKey, nameKey) {
    try {
        const snapshot = await db.ref(node).once('value');
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Handle both array-like and object structures
            if (Array.isArray(data)) {
                 return data.filter(item => item).map(item => `${item[codeKey]} - ${item[nameKey]}`);
            }
            return Object.values(data).map(item => `${item[codeKey]} - ${item[nameKey]}`);
        }
        return [];
    } catch (error) {
        console.error(`Error fetching ${node}:`, error);
        throw error;
    }
}
function handleFormSubmit(event) {
  event.preventDefault();
  if (document.activeElement) document.activeElement.blur();
  submitRequest();
}
async function submitRequest() {
  if (!validateForm()) return;
  setLoadingState(true, elements.submitBtn, "Processing...");
  const formData = getFormData();
  try {
    const siteCode = formData.siteNo;
    const classCode = formData.class;
    const year = new Date().getFullYear().toString().substring(2);
    const letterRecordsRef = db.ref('Letter Records');
    const lastRecordQuery = letterRecordsRef.orderByChild('Sequence Number').limitToLast(1);
    const snapshot = await lastRecordQuery.once('value');
    let lastSequenceNumber = 0;
    if (snapshot.exists()) {
      snapshot.forEach(childSnapshot => {
        lastSequenceNumber = childSnapshot.val()['Sequence Number'];
      });
    }
    if (typeof lastSequenceNumber !== 'number') {
        lastSequenceNumber = 0;
    }
    const newSequenceNumber = lastSequenceNumber + 1;
    const paddedSequence = String(newSequenceNumber).padStart(4, '0');
    const documentCode = `${formData.from}-${siteCode}-${classCode}-${year}-${paddedSequence}`;
    const newRecord = {
        'Document Code': documentCode, 'From': formData.from, 'Site Name': formData.siteName,
        'Document Class': classCode, 'Date Sent': formData.dateSent, 'Sequence Number': newSequenceNumber,
        'Remarks': formData.remarks, 'Submission Time': new Date().toISOString(), 'Mobile Number': formData.mobile
    };
    await letterRecordsRef.push(newRecord);
    showCodeConfirmation(`Success! Code: ${documentCode}`);
    resetForm();
    await displayRecentCodes();
  } catch (error) {
    console.error('Firebase Submission Error:', error);
    handleError(error);
  } finally {
    setLoadingState(false, elements.submitBtn, "Generate Code");
  }
}

// --- UI & Helper Functions ---
function displayWelcomeMessage() {
    const userName = sessionStorage.getItem('verifiedUserName');
    if (userName && elements.welcomeMessage) {
        elements.welcomeMessage.innerHTML = `Welcome, <strong>${userName}</strong>`;
        elements.welcomeMessage.classList.remove('hidden');
    }
}
async function displayRecentCodes() {
  const listElement = elements.recentCodesList;
  if (!listElement) return;
  listElement.innerHTML = '<li>Loading recent codes...</li>';
  try {
    const query = db.ref('Letter Records').orderByChild('Sequence Number').limitToLast(5);
    const snapshot = await query.once('value');
    if (snapshot.exists()) {
      const recentCodes = [];
      snapshot.forEach(child => { recentCodes.push(child.val()); });
      listElement.innerHTML = '';
      recentCodes.reverse().forEach(record => {
        const li = document.createElement('li');
        const siteName = record['Site Name'] || 'N/A';
        const dateSent = record['Date Sent'];
        let formattedDate = dateSent;
        if (dateSent) {
            const dateObj = new Date(dateSent);
            if (!isNaN(dateObj.getTime())) {
                formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${dateObj.toLocaleString('default', { month: 'short' })}-${dateObj.getFullYear()}`;
            }
        }
        li.innerHTML = `<strong>${record['Document Code']}</strong><span>${siteName} : ${formattedDate}</span>`;
        listElement.appendChild(li);
      });
    } else {
      listElement.innerHTML = '<li>No codes have been generated yet.</li>';
    }
  } catch (error) {
    console.error('Error fetching recent codes:', error);
    listElement.innerHTML = '<li>Could not load recent codes.</li>';
  }
}
function getFormData() {
  let siteNo = '', siteName = '';
  const siteMatch = elements.site.value.match(/^(\S+)\s*-\s*(.+)$/);
  if (siteMatch) [ , siteNo, siteName] = siteMatch; else siteName = elements.site.value;
  let docClass = '';
  const classMatch = elements.class.value.match(/^(\S+)\s*-\s*/);
  if (classMatch) [ , docClass] = classMatch; else docClass = elements.class.value;
  return {
    from: elements.from.value.trim().toUpperCase(), siteNo, siteName, class: docClass,
    dateSent: elements.dateSent.value, remarks: elements.purpose.value,
    mobile: sessionStorage.getItem('verifiedMobile') || ''
  };
}
function setMobileLoadingState(isLoading) {
  elements.verifyBtn.disabled = isLoading;
  elements.verifyBtn.innerHTML = isLoading ? '<i class="fas fa-spinner fa-spin"></i> Verifying...' : '<i class="fas fa-arrow-right"></i> Continue';
}
function showMobileError(message) {
  elements.mobileError.textContent = message;
  elements.mobileError.classList.remove('hidden');
  setTimeout(() => elements.mobileError.classList.add('hidden'), 4000);
}
function showPasswordError(message) {
  elements.passwordError.textContent = message;
  elements.passwordError.classList.remove('hidden');
  setTimeout(() => elements.passwordError.classList.add('hidden'), 4000);
}
function showSetPasswordError(message) {
  elements.setPasswordError.textContent = message;
  elements.setPasswordError.classList.remove('hidden');
  setTimeout(() => elements.setPasswordError.classList.add('hidden'), 4000);
}
function showLoginMessage(message) {
    elements.loginMessage.textContent = message;
    elements.loginMessage.classList.remove('hidden');
    setTimeout(() => elements.loginMessage.classList.add('hidden'), 5000);
}
function openWhatsApp() {
  const phone = '50992023';
  const message = 'Please register my mobile number for IBA Document System access. My number is: 974' + elements.mobileInput.value.trim();
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}
function goBack() {
  sessionStorage.clear();
  window.location.reload(); 
}
function convertToAutocomplete(elementId, items) {
  const input = document.getElementById(elementId);
  if (!input) return;
  const closeAllLists = (elmnt) => {
    const autocompleteItems = document.getElementsByClassName("autocomplete-items");
    for (let i = 0; i < autocompleteItems.length; i++) {
      if (elmnt !== autocompleteItems[i] && elmnt !== input) {
        autocompleteItems[i].parentNode.removeChild(autocompleteItems[i]);
      }
    }
  };
  const showSuggestions = (filter = '') => {
    closeAllLists();
    const suggestionsContainer = document.createElement("DIV");
    suggestionsContainer.setAttribute("id", input.id + "autocomplete-list");
    suggestionsContainer.setAttribute("class", "autocomplete-items");
    input.parentNode.appendChild(suggestionsContainer);
    items.forEach(item => {
      if (item.toUpperCase().includes(filter.toUpperCase())) {
        const suggestionDiv = document.createElement("DIV");
        suggestionDiv.innerHTML = item;
        suggestionDiv.addEventListener("click", function() {
            input.value = this.innerText;
            closeAllLists();
        });
        suggestionsContainer.appendChild(suggestionDiv);
      }
    });
  };
  input.addEventListener("click", function(e) { e.stopPropagation(); showSuggestions(this.value); });
  input.addEventListener("input", function() { showSuggestions(this.value); });
  document.addEventListener("click", function(e) { closeAllLists(e.target); });
}
function setDefaultDate() {
  if (datePickerInstance) { datePickerInstance.setDate(new Date()); }
}
function validateForm() {
  let isValid = true;
  document.querySelectorAll('.form-group input.error, .form-group select.error').forEach(el => el.classList.remove('error'));
  ['from', 'site', 'class', 'dateSent', 'purpose'].forEach(id => {
      const el = elements[id];
      if (!el.value.trim()) { el.classList.add('error'); isValid = false; }
  });
  if (!isValid) { showError('Please fill all required fields.'); }
  return isValid;
}
function setLoadingState(isLoading, button, loadingText) {
  const originalText = button.getAttribute('data-original-text') || button.innerHTML;
  if (isLoading) {
    if (!button.getAttribute('data-original-text')) {
      button.setAttribute('data-original-text', originalText);
    }
    button.disabled = isLoading;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
  } else {
    button.disabled = isLoading;
    button.innerHTML = originalText;
    button.removeAttribute('data-original-text');
  }
}
function handleError(error) {
  console.error('Error:', error);
  showError(error.message || 'A network error occurred. Please try again.');
}
function showCodeConfirmation(message) {
  const code = message.split('Code: ')[1] || message;
  elements.successMessage.innerHTML = `
    <div class="code-display">
      <div class="code-header"><i class="fas fa-check-circle"></i> Your Document Code</div>
      <div class="code-value">${code}</div>
      <p class="code-explanation">This code has been recorded in the database.</p>
      <button class="copy-btn" onclick="copyToClipboard('${code}')"><i class="fas fa-copy"></i> Copy Code</button>
    </div>`;
  elements.successMessage.classList.remove('hidden');
  elements.successMessage.scrollIntoView({ behavior: 'smooth' });
}
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i> Copy Code';
        btn.classList.remove('copied');
      }, 2000);
    }
  }).catch(err => console.error('Failed to copy: ', err));
};
function showError(message) {
  elements.successMessage.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${message}</div>`;
  elements.successMessage.classList.remove('hidden');
  elements.successMessage.scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => elements.successMessage.classList.add('hidden'), 5000);
}
function resetForm() {
  elements.form.reset();
  if (datePickerInstance) { datePickerInstance.clear(); }
  setDefaultDate();
  elements.from.value = "IBA";
  elements.site.focus();
}