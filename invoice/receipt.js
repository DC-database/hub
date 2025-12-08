// =====================================
// receipt.js (V7.2 - Layout Fix)
// =====================================

// 1. CONFIG
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

if (!firebase.apps.length) {
    firebase.initializeApp(invoiceFirebaseConfig);
}
const storage = firebase.storage();

// 2. HELPERS
function formatCurrency(value) {
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) return 'N/A';
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 3. MAIN LOGIC
document.addEventListener('DOMContentLoaded', async () => {
    const receiptDataString = localStorage.getItem('pendingReceiptData');
    if (!receiptDataString) {
        document.body.innerHTML = '<h1>Error</h1><p>No data found.</p>';
        return;
    }

    const receiptData = JSON.parse(receiptDataString);
    const { approvedTasks, rejectedTasks, seriesNo } = receiptData;
    const isInventory = receiptData.isInventory || false;

    // A. Setup Text UI
    document.getElementById('receipt-title').textContent = receiptData.title || 'Authorize Approval';
    document.getElementById('footer-date').textContent = new Date().toLocaleDateString('en-GB');
    document.querySelector('#footer-esn span').textContent = seriesNo;

    // B. GENERATE QR CODE
    const safeFilename = seriesNo.replace(/[^a-zA-Z0-9]/g, '_'); 
    const bucketName = "invoiceentry-b15a8.firebasestorage.app"; 
    const finalPdfUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/receipts%2F${safeFilename}.pdf?alt=media`;

    const qrContainer = document.getElementById('receipt-qr-code');
    if (qrContainer) {
        qrContainer.innerHTML = ''; 
        new QRCode(qrContainer, {
            text: finalPdfUrl,
            width: 100, // Slightly bigger for clarity
            height: 100,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.M
        });
    }

    // C. Populate Tables (New Vertical Layout)
    const populateList = (tasks, sectionId, listId, totalId) => {
        const section = document.getElementById(sectionId);
        const listEl = document.getElementById(listId);
        const totalEl = document.getElementById(totalId);

        if (tasks.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';

        let html = '', total = 0;
        tasks.forEach((task, idx) => {
            const amt = parseFloat(task.amountPaid) || 0;
            total += amt;
            // Increased limit to 20 chars since we have a full line now
            const vendor = (task.vendorName || 'N/A').substring(0, 20);
            const invNum = task.invNumber || task.ref || task.invEntryID || 'N/A';
            const poNum = task.po || 'N/A';
            const valDisplay = isInventory ? amt : formatCurrency(amt);

            // --- CHANGED LAYOUT TO STACK VERTICALLY ---
            html += `
                <div class="item">
                    <div class="item-details">
                        <div class="line-po"><strong>${idx+1}. PO:</strong> ${poNum}</div>
                        <div class="line-inv">Inv: <strong>${invNum}</strong></div>
                        <div class="line-vendor">${vendor}</div>
                    </div>
                    <div class="item-status ${sectionId.includes('approved') ? 'status-approved' : 'status-rejected'}">
                        ${valDisplay}
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = html;
        totalEl.textContent = isInventory ? total : `QR ${formatCurrency(total)}`;
    };

    populateList(approvedTasks, 'approved-section', 'receipt-approved-list', 'receipt-approved-total');
    populateList(rejectedTasks, 'rejected-section', 'receipt-rejected-list', 'receipt-rejected-total');

    // D. Auto-Save PDF
    const sendBtn = document.getElementById('send-whatsapp-btn');
    const statusText = document.getElementById('status-text');
    let savedDownloadURL = null;

    async function autoSaveReceipt() {
        statusText.textContent = 'Auto-saving Receipt...';
        statusText.style.color = '#fff';
        sendBtn.disabled = true;

        try {
            const element = document.getElementById('ceo-receipt-template');
            
            const opt = { 
                margin: 0, 
                filename: `${safeFilename}.pdf`, 
                image: { type: 'jpeg', quality: 0.98 }, 
                html2canvas: { 
                    scale: 3, 
                    scrollY: 0, 
                    useCORS: true,
                    letterRendering: true // Helps with text kerning
                }, 
                jsPDF: { unit: 'in', format: [3.6, 8], orientation: 'portrait' } 
            };

            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            const storagePath = `receipts/${safeFilename}.pdf`; 
            const storageRef = storage.ref(storagePath);
            await storageRef.put(pdfBlob);
            savedDownloadURL = await storageRef.getDownloadURL();

            statusText.textContent = 'Receipt Ready!';
            statusText.style.color = '#90EE90'; 
            sendBtn.disabled = false;
        } catch (error) {
            console.error(error);
            statusText.textContent = 'Auto-save failed.';
            statusText.style.color = '#ff6b6b';
        }
    }

    setTimeout(autoSaveReceipt, 1500);

    sendBtn.addEventListener('click', () => {
        if(savedDownloadURL) {
            const msg = `Approval Receipt\nESN: ${seriesNo}\nLink: ${savedDownloadURL}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        } else { alert("Please wait for auto-save."); }
    });
});