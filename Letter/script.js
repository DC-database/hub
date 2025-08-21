// Google Apps Script URL
const scriptURL = 'https://script.google.com/macros/s/AKfycbywp9mieNbeMYSP2FvhRf3lAoLIHTngdUh86uLAzjJXcvLpP-De4GBcnnze4Ej8-ubvFA/exec';

// DOM Elements
const elements = {
  mobileModal: document.getElementById('mobile-modal'),
  mobileInput: document.getElementById('mobile-input'),
  verifyBtn: document.getElementById('verify-btn'),
  mobileError: document.getElementById('mobile-error'),
  unregisteredMessage: document.getElementById('unregistered-message'),
  whatsappBtn: document.getElementById('whatsapp-btn'),
  appContainer: document.querySelector('.app-container'),
  form: document.getElementById('document-form'),
  from: document.getElementById('from'),
  site: document.getElementById('site'),
  class: document.getElementById('class'),
  dateSent: document.getElementById('dateSent'),
  purpose: document.getElementById('purpose'),
  submitBtn: document.getElementById('submit-btn'),
  successMessage: document.getElementById('success-message'),
  goBackBtn: document.getElementById('go-back-btn')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  showMobileVerification();
  
  elements.verifyBtn.addEventListener('click', verifyMobile);
  elements.whatsappBtn.addEventListener('click', openWhatsApp);
  
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
    await initializeForm();
    setDefaultDate();
    
    elements.submitBtn.addEventListener('touchstart', function(e) {
      this.classList.add('touch-active');
    }, {passive: true});
    
    elements.submitBtn.addEventListener('touchend', function(e) {
      this.classList.remove('touch-active');
    }, {passive: true});
  } catch (error) {
    console.error('Error initializing form:', error);
    showError('Failed to load form data. Please refresh the page.');
  }
}

function verifyMobile() {
  const mobile = '974' + elements.mobileInput.value.trim();
  
  if (!elements.mobileInput.value.trim()) {
    showMobileError('Please enter your mobile number');
    return;
  }
  
  if (!/^[0-9]{7,8}$/.test(elements.mobileInput.value.trim())) {
    showMobileError('Please enter a valid 7 or 8 digit mobile number');
    return;
  }
  
  setMobileLoadingState(true);
  
  fetch(`${scriptURL}?action=verifyMobile&mobile=${encodeURIComponent(mobile)}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === 'ok') {
        if (data.registered) {
          sessionStorage.setItem('verifiedMobile', mobile);
          showApp();
        } else {
          elements.unregisteredMessage.classList.remove('hidden');
          elements.verifyBtn.classList.add('hidden');
        }
      } else {
        showMobileError(data.message || 'Verification failed');
      }
    })
    .catch(error => {
      showMobileError('Network error. Please try again.');
      console.error('Error:', error);
    })
    .finally(() => setMobileLoadingState(false));
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
  setTimeout(() => {
    elements.mobileError.classList.add('hidden');
  }, 5000);
}

function openWhatsApp() {
  const phone = '50992023';
  const message = 'Please register my mobile number for IBA Document System access. My number is: 974' + elements.mobileInput.value.trim();
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

function goBack() {
  sessionStorage.removeItem('verifiedMobile');
  
  // Check if on mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Mobile - redirect to external URL
    window.location.href = 'https://dc-database.github.io/003/';
  } else {
    // Desktop - try to open local file
    try {
      // First try direct file access
      window.location.href = 'portal.html';
      
      // Fallback after short delay if the first attempt fails
      setTimeout(() => {
        window.history.back();
      }, 100);
    } catch (e) {
      window.history.back();
    }
  }
}

async function initializeForm() {
  try {
    const [sites, documentClasses] = await Promise.all([
      fetchSites(),
      fetchDocumentClasses()
    ]);
    
    convertToAutocomplete('site', sites.map(site => `${site.no} - ${site.name}`));
    convertToAutocomplete('class', documentClasses.map(docClass => `${docClass.code} - ${docClass.name}`));
    
    elements.form.addEventListener('submit', handleFormSubmit);
    elements.submitBtn.addEventListener('click', handleFormSubmit);
  } catch (error) {
    console.error('Error initializing form:', error);
    throw error;
  }
}

async function fetchSites() {
  try {
    const response = await fetch(`${scriptURL}?action=getSites`);
    const data = await response.json();
    
    if (data.status === 'ok' && data.sites) {
      return data.sites;
    } else {
      throw new Error(data.message || 'Failed to fetch sites');
    }
  } catch (error) {
    console.error('Error fetching sites:', error);
    throw error;
  }
}

async function fetchDocumentClasses() {
  try {
    const response = await fetch(`${scriptURL}?action=getDocumentClasses`);
    const data = await response.json();
    
    if (data.status === 'ok' && data.documentClasses) {
      return data.documentClasses;
    } else {
      throw new Error(data.message || 'Failed to fetch document classes');
    }
  } catch (error) {
    console.error('Error fetching document classes:', error);
    throw error;
  }
}

function convertToAutocomplete(elementId, items) {
  const input = document.getElementById(elementId);
  const originalSelect = input.cloneNode(true);
  originalSelect.id = `${elementId}-select`;
  originalSelect.classList.add('hidden');
  input.parentNode.insertBefore(originalSelect, input.nextSibling);
  
  input.addEventListener('input', function() {
    const val = this.value.trim();
    closeAllLists();
    
    if (!val) {
      originalSelect.value = '';
      return;
    }
    
    const filteredItems = items.filter(item => 
      item.toLowerCase().includes(val.toLowerCase())
    );
    
    if (filteredItems.length === 0) {
      originalSelect.value = '';
      return;
    }
    
    const list = document.createElement('div');
    list.setAttribute('id', `${elementId}-autocomplete-list`);
    list.setAttribute('class', 'autocomplete-items');
    this.parentNode.appendChild(list);
    
    filteredItems.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.innerHTML = item;
      itemElement.addEventListener('click', function() {
        input.value = item;
        originalSelect.value = item;
        closeAllLists();
      });
      list.appendChild(itemElement);
    });
  });
  
  document.addEventListener('click', function(e) {
    if (e.target !== input) {
      closeAllLists();
    }
  });
}

function closeAllLists() {
  const items = document.getElementsByClassName('autocomplete-items');
  for (let i = 0; i < items.length; i++) {
    items[i].parentNode.removeChild(items[i]);
  }
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  elements.dateSent.value = today;
}

function handleFormSubmit(event) {
  event.preventDefault();
  
  if (document.activeElement) {
    document.activeElement.blur();
  }
  
  submitRequest();
}

function submitRequest() {
  if (!validateForm()) {
    return;
  }

  if (!navigator.onLine) {
    showError('No internet connection. Please check your network and try again.');
    return;
  }

  const formData = getFormData();
  setLoadingState(true);

  const timeout = 30000;
  
  const fetchPromise = fetch(`${scriptURL}?${new URLSearchParams(formData)}`, {
    method: 'POST',
  });
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timeout. Please try again.'));
    }, timeout);
  });

  Promise.race([fetchPromise, timeoutPromise])
    .then(handleResponse)
    .catch(error => {
      if (error.message === 'Request timeout. Please try again.') {
        showError(error.message);
      } else {
        handleError(error);
      }
    })
    .finally(() => setLoadingState(false));
}

function validateForm() {
  document.querySelectorAll('.form-group input, .form-group select').forEach(el => {
    el.classList.remove('error');
  });

  let isValid = true;

  if (!elements.from.value.trim()) {
    elements.from.classList.add('error');
    isValid = false;
  }

  if (!elements.site.value) {
    elements.site.classList.add('error');
    isValid = false;
  }

  if (!elements.class.value) {
    elements.class.classList.add('error');
    isValid = false;
  }

  if (!elements.dateSent.value) {
    elements.dateSent.classList.add('error');
    isValid = false;
  }

  if (!elements.purpose.value.trim()) {
    elements.purpose.classList.add('error');
    isValid = false;
  }

  if (!isValid) {
    showError('Please fill all required fields.');
    const firstError = document.querySelector('.error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return isValid;
}

function getFormData() {
  let siteNo = '';
  let siteName = '';
  
  const siteMatch = elements.site.value.match(/^(\S+)\s*-\s*(.+)$/);
  if (siteMatch) {
    siteNo = siteMatch[1];
    siteName = siteMatch[2];
  } else {
    siteName = elements.site.value;
  }
  
  let docClass = '';
  const classMatch = elements.class.value.match(/^(\S+)\s*-\s*/);
  if (classMatch) {
    docClass = classMatch[1];
  } else {
    docClass = elements.class.value;
  }
  
  return {
    action: 'add',
    from: elements.from.value.trim().toUpperCase(),
    siteNo: encodeURIComponent(siteNo),
    siteName: encodeURIComponent(siteName),
    class: encodeURIComponent(docClass),
    dateSent: encodeURIComponent(elements.dateSent.value),
    remarks: encodeURIComponent(elements.purpose.value),
    mobile: sessionStorage.getItem('verifiedMobile') || ''
  };
}

function setLoadingState(isLoading) {
  elements.submitBtn.disabled = isLoading;
  elements.submitBtn.innerHTML = isLoading 
    ? '<i class="fas fa-spinner fa-spin"></i> Processing...' 
    : '<i class="fas fa-paper-plane"></i> Generate Code';
}

function handleResponse(response) {
  return response.json()
    .then(data => {
      if (data.status === 'ok') {
        const cleanMessage = data.message.replace('Ace” ', '');
        showCodeConfirmation(cleanMessage);
        resetForm();
      } else {
        showError(data.message || 'An error occurred while processing your request.');
      }
    });
}

function handleError(error) {
  console.error('Error:', error);
  showError('Network error. Please try again later.');
}

function showCodeConfirmation(message) {
  const code = message.includes('Code: ') 
    ? message.split('Code: ')[1] 
    : message;
  
  const codeHTML = `
    <div class="code-display">
      <div class="code-header">
        <i class="fas fa-check-circle"></i> Your Document Code
      </div>
      <div class="code-value">${code}</div>
      <div class="code-explanation">
        This code has been generated and recorded in the system.
      </div>
      <button class="copy-btn" onclick="copyToClipboard('${code}')">
        <i class="fas fa-copy"></i> Copy Code
      </button>
    </div>
  `;
  
  elements.successMessage.innerHTML = codeHTML;
  elements.successMessage.classList.remove('hidden');
  elements.successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
};

function showError(message) {
  elements.successMessage.innerHTML = `
    <div class="error-message">
      <i class="fas fa-exclamation-circle"></i> ${message}
    </div>
  `;
  
  elements.successMessage.classList.remove('hidden');
  elements.successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  setTimeout(() => {
    elements.successMessage.classList.add('hidden');
  }, 5000);
}

function resetForm() {
  elements.form.reset();
  setDefaultDate();
  elements.from.value = "IBA";
  elements.from.focus();
}