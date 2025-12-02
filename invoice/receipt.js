// This is the entire content for receipt.js

// 1. Firebase Configuration for the INVOICE app (where storage is)
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
// Initialize ONLY the invoice app
const invoiceApp = firebase.initializeApp(invoiceFirebaseConfig, 'invoiceEntry');
const storage = firebase.storage(invoiceApp);

// 2. Helper function to format currency
function formatCurrency(value) {
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) return 'N/A';
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// 3. Main function to load and display data
document.addEventListener('DOMContentLoaded', () => {
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

    // *** ADD NEW DOM ELEMENTS ***
    const footerEsnEl = document.querySelector('#footer-esn span');
    const barcodeEl = document.getElementById('barcode');
    const footerDateEl = document.getElementById('footer-date');


    // 4. Get data from localStorage
    const receiptDataString = localStorage.getItem('pendingReceiptData');
    if (!receiptDataString) {
        document.body.innerHTML = '<h1>Error</h1><p>No receipt data found. Please go back and try again.</p>';
        return;
    }
    
    // Clear the data so it can't be reused
    localStorage.removeItem('pendingReceiptData');
    
    const receiptData = JSON.parse(receiptDataString);
    const { approvedTasks, rejectedTasks, seriesNo, appVersion } = receiptData;

    // New Code
if (receiptData.title) {
    titleEl.textContent = receiptData.title; // Uses "Manager Approval" if passed
} else {
    titleEl.textContent = 'Authorize Approval'; // Default to CEO
}
    if (versionEl && appVersion) {
        versionEl.textContent = appVersion;
    }

    let approvedHTML = '';
    let approvedTotal = 0;
    let rejectedHTML = '';
    let rejectedTotal = 0;

    // Build Approved List
    approvedTasks.forEach((task, index) => {
        const vendor = (task.vendorName || 'N/A').substring(0, 10);
        const invId = task.invEntryID || task.ref || 'N/A';
        const amount = parseFloat(task.amountPaid) || 0;
        approvedTotal += amount;
        
        // *** FIX: Changed to single-line content to match screenshot format ***
        approvedHTML += `
            <div class="item">
                <span class="item-details">Ent ${index + 1} (${task.po} - ${vendor} - ${invId}) QR ${formatCurrency(amount)}</span>
                <span class="item-status status-approved">${task.status}</span>
            </div>
        `;
    });
    approvedListEl.innerHTML = approvedHTML;
    approvedTotalEl.textContent = `QR ${formatCurrency(approvedTotal)}`;
    approvedSection.classList.toggle('hidden', approvedTasks.length === 0);

    // Build Rejected List
    rejectedTasks.forEach((task, index) => {
        const vendor = (task.vendorName || 'N/A').substring(0, 10);
        const invId = task.invEntryID || task.ref || 'N/A';
        const amount = parseFloat(task.amountPaid) || 0;
        rejectedTotal += amount;

        // *** FIX: Changed to single-line content to match screenshot format ***
        rejectedHTML += `
            <div class="item">
                <span class="item-details">Ent ${index + 1} (${task.po} - ${vendor} - ${invId}) QR ${formatCurrency(amount)}</span>
                <span class="item-status status-rejected">${task.status}</span>
            </div>
        `;
    });
    rejectedListEl.innerHTML = rejectedHTML;
    rejectedTotalEl.textContent = `QR ${formatCurrency(rejectedTotal)}`;
    rejectedSection.classList.toggle('hidden', rejectedTasks.length === 0);

    // *** ADD NEW POPULATION CODE ***
    footerEsnEl.textContent = seriesNo;
    footerDateEl.textContent = new Date().toLocaleDateString('en-GB');

    // Generate the barcode
    try {
        JsBarcode(barcodeEl, seriesNo, {
            format: "CODE128",
            displayValue: false, // Don't show the text value below the barcode
            height: 40,
            margin: 0
        });
    } catch (e) {
        console.error("Barcode generation failed:", e);
        const barcodeContainer = document.getElementById('receipt-footer');
        if(barcodeContainer) barcodeContainer.innerHTML = "<p>Error generating barcode.</p>";
    }
    // --- *** END OF NEW CODE *** ---


    // 6. Add click listener for the send button (no change to this part)
    sendBtn.addEventListener('click', async () => {
        sendBtn.disabled = true;
        statusText.textContent = 'Generating PDF...';

        try {
            
            // --- *** FIX: Updated PDF margins and width options *** ---
            const options = { 
                margin: 0.1, // Adjusted margin
                filename: `${seriesNo}.pdf`, 
                image: { type: 'jpeg', quality: 0.98 }, 
                html2canvas: { scale: 3, logging: false }, // Scale to 3x resolution
                jsPDF: { unit: 'in', format: [3.35, 8], orientation: 'portrait' } 
            };
            // --- *** END OF FIX *** ---
            
            const pdfBlob = await html2pdf().set(options).from(receiptElement).output('blob');

            // 7. Upload PDF to Firebase Storage
            sendBtn.textContent = 'Uploading...';
            const filename = `receipts/${seriesNo}.pdf`;
            const storageRef = storage.ref(filename);
            const snapshot = await storageRef.put(pdfBlob);
            const downloadURL = await snapshot.ref.getDownloadURL();

            // 8. Build and Open WhatsApp
            statusText.textContent = 'Opening WhatsApp...';
            
            const message = `Authorize Approval\nESN #: ${seriesNo}\n\nView Receipt: ${downloadURL}`;
            const encodedMessage = encodeURIComponent(message);
            
            const whatsappURL = `https://wa.me/?text=${encodedMessage}`;

            window.open(whatsappURL, '_blank');
            statusText.textContent = 'Ready to send!';
            sendBtn.textContent = 'Send Again';
            sendBtn.disabled = false;
            
        } catch (error) {
            console.error("Error sending receipt:\s", error);
            statusText.textContent = 'Error. Check console.';
            sendBtn.disabled = false;
        }
    });
});