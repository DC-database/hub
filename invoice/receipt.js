// =====================================
// receipt.js (Auto-Save Enabled)
// =====================================

// 1. Firebase Configuration
const invoiceFirebaseConfig = {
  apiKey: "AIzaSyB5_CCTk-dvr_Lsv0K2ScPwHJkkCY7VoAM",
  authDomain: "invoiceentry-b15a8.firebaseapp.com",
  databaseURL: "https://invoiceentry-b15a8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "invoiceentry-b15a8",
  storageBucket: "invoiceentry-b15a8.firebasestorage.app",
  messagingSenderId: "916998429537",
  appId: "1:916998429537:web:6f4635d6d6e1cb98bb0320",
  measurementId: "G-R409J22B97"
};

// Initialize Firebase
const invoiceApp = firebase.initializeApp(invoiceFirebaseConfig, 'invoiceEntry');
const storage = firebase.storage(invoiceApp);

// 2. Formatting Helper
function formatCurrency(value) {
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) return 'N/A';
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// 3. Main Logic
document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const receiptElement = document.getElementById('ceo-receipt-template');
    const approvedListEl = document.getElementById('receipt-approved-list');
    const rejectedListEl = document.getElementById('receipt-rejected-list');
    const approvedTotalEl = document.getElementById('receipt-approved-total');
    const rejectedTotalEl = document.getElementById('receipt-rejected-total');
    const approvedSection = document.getElementById('approved-section');
    const rejectedSection = document.getElementById('rejected-section');
    const titleEl = document.getElementById('receipt-title');
    const sendBtn = document.getElementById('send-whatsapp-btn');
    const statusText = document.getElementById('status-text');
    const versionEl = document.getElementById('receipt-version');
    const footerEsnEl = document.querySelector('#footer-esn span');
    const barcodeEl = document.getElementById('barcode');
    const footerDateEl = document.getElementById('footer-date');

    // 4. Retrieve Data
    const receiptDataString = localStorage.getItem('pendingReceiptData');
    if (!receiptDataString) {
        document.body.innerHTML = '<h1>Error</h1><p>No receipt data found. Please close this window and try again.</p>';
        return;
    }
    
    // Clear storage immediately to prevent duplicates
    localStorage.removeItem('pendingReceiptData');
    
    const receiptData = JSON.parse(receiptDataString);
    const { approvedTasks, rejectedTasks, seriesNo, appVersion } = receiptData;
    const isInventory = receiptData.isInventory || false;

    // 5. Populate UI
    if (receiptData.title) {
        titleEl.textContent = receiptData.title; 
    } else {
        titleEl.textContent = 'Authorize Approval'; 
    }

    if (versionEl && appVersion) {
        versionEl.textContent = appVersion;
    }

    // Build Lists
    let approvedHTML = '', approvedTotal = 0;
    let rejectedHTML = '', rejectedTotal = 0;

    // Approved Items
    approvedTasks.forEach((task, index) => {
        const vendor = (task.vendorName || 'N/A').substring(0, 10);
        const invId = task.invEntryID || task.ref || 'N/A';
        const amount = parseFloat(task.amountPaid) || 0;
        
        // Use movement string if available (for Transfers), else ID
        const detailText = task.movement ? task.movement : invId;
        
        approvedTotal += amount;
        
        const prefix = isInventory ? 'Qty' : 'QR';
        const displayAmount = isInventory ? amount : formatCurrency(amount);
        
        approvedHTML += `
            <div class="item">
                <span class="item-details">Ent ${index + 1} (${task.po} - ${vendor} - ${detailText}) ${prefix} ${displayAmount}</span>
                <span class="item-status status-approved">${task.status}</span>
            </div>
        `;
    });
    approvedListEl.innerHTML = approvedHTML;
    approvedTotalEl.textContent = isInventory ? `Total Items: ${approvedTotal}` : `QR ${formatCurrency(approvedTotal)}`;
    approvedSection.classList.toggle('hidden', approvedTasks.length === 0);

    // Rejected Items
    rejectedTasks.forEach((task, index) => {
        const vendor = (task.vendorName || 'N/A').substring(0, 10);
        const invId = task.invEntryID || task.ref || 'N/A';
        const amount = parseFloat(task.amountPaid) || 0;
        
        rejectedTotal += amount;

        const prefix = isInventory ? 'Qty' : 'QR';
        const displayAmount = isInventory ? amount : formatCurrency(amount);

        rejectedHTML += `
            <div class="item">
                <span class="item-details">Ent ${index + 1} (${task.po} - ${vendor} - ${invId}) ${prefix} ${displayAmount}</span>
                <span class="item-status status-rejected">${task.status}</span>
            </div>
        `;
    });
    rejectedListEl.innerHTML = rejectedHTML;
    rejectedTotalEl.textContent = isInventory ? `Total Items: ${rejectedTotal}` : `QR ${formatCurrency(rejectedTotal)}`;
    rejectedSection.classList.toggle('hidden', rejectedTasks.length === 0);

    // Footer Details
    footerEsnEl.textContent = seriesNo;
    footerDateEl.textContent = new Date().toLocaleDateString('en-GB');

    try {
        JsBarcode(barcodeEl, seriesNo, {
            format: "CODE128",
            displayValue: false, 
            height: 40,
            margin: 0
        });
    } catch (e) {
        console.error("Barcode error:", e);
    }

    // ============================================================
    // 6. AUTO-SAVE LOGIC (Runs automatically on load)
    // ============================================================
    let savedDownloadURL = null; 

    async function autoSaveReceipt() {
        statusText.textContent = 'Auto-saving Receipt to Database...';
        statusText.style.color = '#00748C';
        sendBtn.disabled = true; 
        sendBtn.style.opacity = '0.6';
        
        try {
            const options = { 
                margin: 0.1, 
                filename: `${seriesNo}.pdf`, 
                image: { type: 'jpeg', quality: 0.98 }, 
                html2canvas: { scale: 3, logging: false }, 
                jsPDF: { unit: 'in', format: [3.35, 8], orientation: 'portrait' } 
            };
            
            // Create PDF Blob
            const pdfBlob = await html2pdf().set(options).from(receiptElement).output('blob');
            
            // Upload to Firebase Storage
            const filename = `receipts/${seriesNo}.pdf`;
            const storageRef = storage.ref(filename);
            
            await storageRef.put(pdfBlob);
            savedDownloadURL = await storageRef.getDownloadURL();
            
            // Success State
            statusText.textContent = 'Receipt Saved! Ready to send.';
            statusText.style.color = 'green';
            sendBtn.disabled = false; 
            sendBtn.style.opacity = '1';
            
        } catch (error) {
            console.error("Auto-save failed:", error);
            statusText.textContent = 'Auto-save failed. Please check connection.';
            statusText.style.color = 'red';
            // Re-enable button so they can try clicking it manually to trigger save attempt
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
        }
    }

    // Trigger the save after a split second to ensure the HTML renders fully
    setTimeout(autoSaveReceipt, 500);

    // 7. WhatsApp Button Handler
    sendBtn.addEventListener('click', () => {
        // If auto-save failed or is still running, try saving again
        if (!savedDownloadURL) {
            autoSaveReceipt();
            return;
        }

        const typeLabel = receiptData.title || "Approval Receipt";
        const message = `${typeLabel}\nESN #: ${seriesNo}\n\nView Receipt: ${savedDownloadURL}`;
        const whatsappURL = `https://wa.me/?text=${encodeURIComponent(message)}`;
        
        window.open(whatsappURL, '_blank');
    });
});