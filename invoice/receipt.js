// =====================================
// [File 3] receipt.js
// =====================================

// This is the entire content for receipt.js

// 1. Firebase Configuration for the INVOICE app (where storage is)
// [3.a] invoiceFirebaseConfig
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
// [3.b] invoiceApp
const invoiceApp = firebase.initializeApp(invoiceFirebaseConfig, 'invoiceEntry');
// [3.c] storage
const storage = firebase.storage(invoiceApp);

// 2. Helper function to format currency
// [3.d] formatCurrency
function formatCurrency(value) {
    // [3.e] number
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) return 'N/A';
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// 3. Main function to load and display data
document.addEventListener('DOMContentLoaded', () => {
    // [3.f] receiptElement
    const receiptElement = document.getElementById('ceo-receipt-template');
    // [3.g] approvedListEl
    const approvedListEl = document.getElementById('receipt-approved-list');
    // [3.h] rejectedListEl
    const rejectedListEl = document.getElementById('receipt-rejected-list');
    // [3.i] approvedTotalEl
    const approvedTotalEl = document.getElementById('receipt-approved-total');
    // [3.j] rejectedTotalEl
    const rejectedTotalEl = document.getElementById('receipt-rejected-total');
    // [3.k] approvedSection
    const approvedSection = document.getElementById('approved-section');
    // [3.l] rejectedSection
    const rejectedSection = document.getElementById('rejected-section');
    // [3.m] titleEl
    const titleEl = document.getElementById('receipt-title');
    // [3.n] sendBtn
    const sendBtn = document.getElementById('send-whatsapp-btn');
    // [3.o] statusText
    const statusText = document.getElementById('status-text');
    // [3.p] versionEl
    const versionEl = document.getElementById('receipt-version');

    // *** ADD NEW DOM ELEMENTS ***
    // [3.q] footerEsnEl
    const footerEsnEl = document.querySelector('#footer-esn span');
    // [3.r] barcodeEl
    const barcodeEl = document.getElementById('barcode');
    // [3.s] footerDateEl
    const footerDateEl = document.getElementById('footer-date');


    // 4. Get data from localStorage
    // [3.t] receiptDataString
    const receiptDataString = localStorage.getItem('pendingReceiptData');
    if (!receiptDataString) {
        document.body.innerHTML = '<h1>Error</h1><p>No receipt data found. Please go back and try again.</p>';
        return;
    }
    
    // Clear the data so it can't be reused
    localStorage.removeItem('pendingReceiptData');
    
    // [3.u] receiptData
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

    // [3.v] approvedHTML
    let approvedHTML = '';
    // [3.w] approvedTotal
    let approvedTotal = 0;
    // [3.x] rejectedHTML
    let rejectedHTML = '';
    // [3.y] rejectedTotal
    let rejectedTotal = 0;

    // Build Approved List
    approvedTasks.forEach((task, index) => {
        // [3.z] vendor
        const vendor = (task.vendorName || 'N/A').substring(0, 10);
        // [3.aa] invId
        const invId = task.invEntryID || task.ref || 'N/A';
        // [3.ab] amount
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
        // [3.ac] vendor
        const vendor = (task.vendorName || 'N/A').substring(0, 10);
        // [3.ad] invId
        const invId = task.invEntryID || task.ref || 'N/A';
        // [3.ae] amount
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
        // [3.af] barcodeContainer
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
            // [3.ag] options
            const options = { 
                margin: 0.1, // Adjusted margin
                filename: `${seriesNo}.pdf`, 
                image: { type: 'jpeg', quality: 0.98 }, 
                html2canvas: { scale: 3, logging: false }, // Scale to 3x resolution
                jsPDF: { unit: 'in', format: [3.35, 8], orientation: 'portrait' } 
            };
            // --- *** END OF FIX *** ---
            
            // [3.ah] pdfBlob
            const pdfBlob = await html2pdf().set(options).from(receiptElement).output('blob');

            // 7. Upload PDF to Firebase Storage
            sendBtn.textContent = 'Uploading...';
            // [3.ai] filename
            const filename = `receipts/${seriesNo}.pdf`;
            // [3.aj] storageRef
            const storageRef = storage.ref(filename);
            // [3.ak] snapshot
            const snapshot = await storageRef.put(pdfBlob);
            // [3.al] downloadURL
            const downloadURL = await snapshot.ref.getDownloadURL();

            // 8. Build and Open WhatsApp
            statusText.textContent = 'Opening WhatsApp...';
            
            // [3.am] message
            const message = `Authorize Approval\nESN #: ${seriesNo}\n\nView Receipt: ${downloadURL}`;
            // [3.an] encodedMessage
            const encodedMessage = encodeURIComponent(message);
            
            // [3.ao] whatsappURL
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