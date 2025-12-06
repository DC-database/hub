// =====================================
// receipt.js (V6.1 - Hide Rejected Fix)
// =====================================

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

const invoiceApp = firebase.initializeApp(invoiceFirebaseConfig, 'invoiceEntry');
const storage = firebase.storage(invoiceApp);

function formatCurrency(value) {
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) return 'N/A';
    return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

document.addEventListener('DOMContentLoaded', async () => {
    const receiptDataString = localStorage.getItem('pendingReceiptData');
    if (!receiptDataString) {
        document.body.innerHTML = '<h1>Error</h1><p>No data found.</p>';
        return;
    }
    localStorage.removeItem('pendingReceiptData');
    
    const receiptData = JSON.parse(receiptDataString);
    const { approvedTasks, rejectedTasks, seriesNo } = receiptData;
    const isInventory = receiptData.isInventory || false;

    document.getElementById('receipt-title').textContent = receiptData.title || 'Authorize Approval';
    document.getElementById('footer-date').textContent = new Date().toLocaleDateString('en-GB');
    document.querySelector('#footer-esn span').textContent = seriesNo;

    try {
        const cleanESN = seriesNo.replace(/[^a-zA-Z0-9-]/g, ""); 
        JsBarcode("#barcode", cleanESN, { format: "CODE128", displayValue: false, height: 40, margin: 0 });
    } catch (e) {}

    const populateList = (tasks, sectionId, listId, totalId) => {
        const section = document.getElementById(sectionId);
        const listEl = document.getElementById(listId);
        const totalEl = document.getElementById(totalId);
        
        // --- FIX: Hide the ENTIRE section if no items ---
        if (tasks.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';
        
        let html = '', total = 0;
        tasks.forEach((task, idx) => {
            const amt = parseFloat(task.amountPaid) || 0;
            total += amt;
            const vendor = (task.vendorName || 'N/A').substring(0, 15);
            const invNum = task.invNumber || task.ref || task.invEntryID || 'N/A';
            const poNum = task.po || 'N/A';
            const valDisplay = isInventory ? amt : formatCurrency(amt);
            
            html += `
                <div class="item">
                    <span class="item-details">${idx+1}. PO:${poNum} - <strong>Inv:${invNum}</strong> - ${vendor}</span>
                    <span class="item-status ${sectionId.includes('approved') ? 'status-approved' : 'status-rejected'}">${valDisplay}</span>
                </div>
            `;
        });
        listEl.innerHTML = html;
        totalEl.textContent = isInventory ? total : `QR ${formatCurrency(total)}`;
    };

    // Pass the Section ID ('approved-section', 'rejected-section') to toggle visibility
    populateList(approvedTasks, 'approved-section', 'receipt-approved-list', 'receipt-approved-total');
    populateList(rejectedTasks, 'rejected-section', 'receipt-rejected-list', 'receipt-rejected-total');

    // Auto-Save
    const sendBtn = document.getElementById('send-whatsapp-btn');
    const statusText = document.getElementById('status-text');
    let savedDownloadURL = null; 

    async function autoSaveReceipt() {
        statusText.textContent = 'Auto-saving Receipt...';
        statusText.style.color = '#00748C';
        sendBtn.disabled = true; 
        
        try {
            const safeName = seriesNo.replace(/[^a-zA-Z0-9]/g, '_');
            const element = document.getElementById('ceo-receipt-template');
            const opt = { margin: 0.1, filename: `${safeName}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 3 }, jsPDF: { unit: 'in', format: [3.35, 8], orientation: 'portrait' } };
            
            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            const filename = `receipts/${safeName}.pdf`;
            const storageRef = storage.ref(filename);
            await storageRef.put(pdfBlob);
            savedDownloadURL = await storageRef.getDownloadURL();
            
            statusText.textContent = 'Receipt Saved!';
            statusText.style.color = 'green';
            sendBtn.disabled = false; 
        } catch (error) {
            console.error(error);
            statusText.textContent = 'Auto-save failed.';
        }
    }
    
    setTimeout(autoSaveReceipt, 1000);

    sendBtn.addEventListener('click', () => {
        if(savedDownloadURL) {
            const msg = `Approval Receipt\nESN: ${seriesNo}\nLink: ${savedDownloadURL}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        } else { alert("Please wait for auto-save."); }
    });
});