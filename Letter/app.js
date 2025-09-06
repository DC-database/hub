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
  mobileModal: document.getElementById('mobile-modal'),
  mobileInput: document.getElementById('mobile-input'),
  verifyBtn: document.getElementById('verify-btn'),
  mobileError: document.getElementById('mobile-error'),
  unregisteredMessage: document.getElementById('unregistered-message'),
  whatsappBtn: document.getElementById('whatsapp-btn'),
  tryAgainBtn: document.getElementById('try-again-btn'),
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

let datePickerInstance = null; // To hold the flatpickr instance

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', function() {
  showMobileVerification();
  
  elements.verifyBtn.addEventListener('click', verifyMobile);
  elements.whatsappBtn.addEventListener('click', openWhatsApp);
  
  elements.mobileInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      elements.verifyBtn.click();
    }
  });

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

function showMobileVerification() {
  elements.mobileModal.style.display = 'flex';
  elements.appContainer.classList.add('hidden');
}

async function showApp() {
  elements.mobileModal.style.display = 'none';
  elements.appContainer.classList.remove('hidden');
  
  try {
    displayWelcomeMessage();
    await initializeForm();
    await displayRecentCodes();
    setDefaultDate();
    
    elements.submitBtn.addEventListener('touchstart', function() { this.classList.add('touch-active'); }, {passive: true});
    elements.submitBtn.addEventListener('touchend', function() { this.classList.remove('touch-active'); }, {passive: true});
  } catch (error) {
    console.error('Error initializing form:', error);
    showError('Failed to load form data. Please refresh the page.');
  }
}

// --- Mobile Verification (Firebase) ---
async function verifyMobile() {
  const mobileNumber = elements.mobileInput.value.trim();
  const fullMobile = '974' + mobileNumber;
  
  if (!mobileNumber) {
    showMobileError('Please enter your mobile number');
    return;
  }
  
  if (!/^[0-9]{7,8}$/.test(mobileNumber)) {
    showMobileError('Please enter a valid 7 or 8 digit mobile number');
    return;
  }
  
  setMobileLoadingState(true);
  
  try {
    const usersRef = db.ref('Users');
    const snapshot = await usersRef.orderByChild('Mob').equalTo(fullMobile).once('value');

    if (snapshot.exists()) {
      let userName = 'User'; 
      snapshot.forEach(childSnapshot => {
        userName = childSnapshot.val().Name; 
      });

      sessionStorage.setItem('verifiedMobile', fullMobile);
      sessionStorage.setItem('verifiedUserName', userName); 
      showApp();
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

// --- Autocomplete Data Fetching (Firebase) ---
async function initializeForm() {
  try {
    const [sites, documentClasses] = await Promise.all([
      fetchDataFromFirebase('Sites', 'Warehouse', 'Description'),
      fetchDataFromFirebase('Document Class', 'Ref', 'Description') 
    ]);
    
    convertToAutocomplete('site', sites);
    convertToAutocomplete('class', documentClasses);
    
    // Initialize flatpickr on the date input
    datePickerInstance = flatpickr("#dateSent", {
      altInput: true,
      altFormat: "d-M-Y", // Format for the user
      dateFormat: "Y-m-d", // Format for the actual input value
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
            return Object.values(data).map(item => `${item[codeKey]} - ${item[nameKey]}`);
        }
        return [];
    } catch (error) {
        console.error(`Error fetching ${node}:`, error);
        throw error;
    }
}


// --- Form Submission Logic ---
function handleFormSubmit(event) {
  event.preventDefault();
  if (document.activeElement) document.activeElement.blur();
  submitRequest();
}

async function submitRequest() {
  if (!validateForm()) return;
  if (!navigator.onLine) {
    showError('No internet connection. Please check your network and try again.');
    return;
  }

  setLoadingState(true);
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
        'Document Code': documentCode,
        'From': formData.from,
        'Site Name': formData.siteName,
        'Document Class': classCode,
        'Date Sent': formData.dateSent,
        'Sequence Number': newSequenceNumber,
        'Remarks': formData.remarks,
        'Submission Time': new Date().toISOString(),
        'Mobile Number': formData.mobile
    };
    
    await letterRecordsRef.push(newRecord);
    showCodeConfirmation(`Success! Code: ${documentCode}`);
    resetForm();
    await displayRecentCodes();

  } catch (error) {
    console.error('Firebase Submission Error:', error);
    handleError(error);
  } finally {
    setLoadingState(false);
  }
}

// --- UI Display Functions ---

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
    const letterRecordsRef = db.ref('Letter Records');
    const query = letterRecordsRef.orderByChild('Sequence Number').limitToLast(5);
    const snapshot = await query.once('value');

    if (snapshot.exists()) {
      const recentCodes = [];
      snapshot.forEach(child => {
        recentCodes.push(child.val());
      });
      
      listElement.innerHTML = '';
      recentCodes.reverse().forEach(record => {
        const li = document.createElement('li');
        
        const siteName = record['Site Name'] || 'N/A';
        const dateSent = record['Date Sent'];
        let formattedDate = dateSent;

        if (dateSent) {
            const parts = dateSent.split('-');
            if (parts.length === 3) {
                const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
                if (!isNaN(dateObj.getTime())) {
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    const monthAbbr = monthNames[dateObj.getMonth()];
                    const year = dateObj.getFullYear();
                    
                    formattedDate = `${day}-${monthAbbr}-${year}`;
                }
            }
        }

        li.innerHTML = `
          <strong>${record['Document Code']}</strong>
          <span>${siteName} : ${formattedDate}</span>
        `;
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


// --- Helper & UI Functions ---

function getFormData() {
  let siteNo = '', siteName = '';
  const siteMatch = elements.site.value.match(/^(\S+)\s*-\s*(.+)$/);
  if (siteMatch) [ , siteNo, siteName] = siteMatch;
  else siteName = elements.site.value;
  
  let docClass = '';
  const classMatch = elements.class.value.match(/^(\S+)\s*-\s*/);
  if (classMatch) [ , docClass] = classMatch;
  else docClass = elements.class.value;
  
  return {
    from: elements.from.value.trim().toUpperCase(),
    siteNo: siteNo,
    siteName: siteName,
    class: docClass,
    dateSent: elements.dateSent.value,
    remarks: elements.purpose.value,
    mobile: sessionStorage.getItem('verifiedMobile') || ''
  };
}

function setMobileLoadingState(isLoading) {
  elements.verifyBtn.disabled = isLoading;
  elements.verifyBtn.innerHTML = isLoading 
    ? '<i class="fas fa-spinner fa-spin"></i> Verifying...' 
    : '<i class="fas fa-check-circle"></i> Verify';
}

function showMobileError(message) {
  elements.mobileError.textContent = message;
  elements.mobileError.classList.remove('hidden');
  setTimeout(() => elements.mobileError.classList.add('hidden'), 5000);
}

function openWhatsApp() {
  const phone = '50992023';
  const message = 'Please register my mobile number for IBA Document System access. My number is: 974' + elements.mobileInput.value.trim();
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

function goBack() {
  sessionStorage.removeItem('verifiedUserName');
  sessionStorage.removeItem('verifiedMobile');
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

  input.addEventListener("click", function(e) {
    e.stopPropagation();
    showSuggestions(this.value);
  });
  
  input.addEventListener("input", function() {
    showSuggestions(this.value);
  });

  document.addEventListener("click", function(e) {
    closeAllLists(e.target);
  });
}


function setDefaultDate() {
  if (datePickerInstance) {
    datePickerInstance.setDate(new Date());
  }
}

function validateForm() {
  let isValid = true;
  document.querySelectorAll('.form-group input.error, .form-group select.error').forEach(el => el.classList.remove('error'));
  
  ['from', 'site', 'class', 'dateSent', 'purpose'].forEach(id => {
      const el = elements[id];
      if (!el.value.trim()) {
          el.classList.add('error');
          isValid = false;
      }
  });

  if (!isValid) {
    showError('Please fill all required fields.');
    const firstError = document.querySelector('.error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return isValid;
}

function setLoadingState(isLoading) {
  elements.submitBtn.disabled = isLoading;
  elements.submitBtn.innerHTML = isLoading 
    ? '<i class="fas fa-spinner fa-spin"></i> Processing...' 
    : '<i class="fas fa-paper-plane"></i> Generate Code';
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
  if (datePickerInstance) {
    datePickerInstance.clear();
  }
  setDefaultDate();
  elements.from.value = "IBA";
  elements.site.focus();
}


