/* ==========================================================================
   js/app-report-workflow.js
   IBA report workflow, receipt upload, cloud folder buttons, finance batch,
   currency inputs, and report-name auto generation.
   Version: 8.1.1

   Cleanup Phase:
   - Moved Block 27 out of app.js.
   - Public function names and existing behavior are preserved.
   - No Firebase paths, invoice save logic, or report approval logic changed.
   ========================================================================== */

(function () {
    'use strict';

    // =================================================================================================
    // #region BLOCK 27 — REPORT WORKFLOW, RECEIPT UPLOAD + FINANCE BATCH
    // Purpose: Report workflow update, receipt upload, finance UI batch visibility/finalization, currency inputs, report-name auto generation.
    // =================================================================================================

    // =========================================================
    // NUCLEAR FIX: REPORT WORKFLOW + RECEIPT UPLOAD
    // =========================================================
    window.updateReportWorkflow = async function(po, key, status, user, nextAttention) {
        if (!po || !key) return;

        try {
            const reportKey = `${po}_${key}`.replace(/[.#$[\]]/g, '_');
            const reportRef = db.ref(`Reports/${reportKey}`);
            const now = new Date().toLocaleDateString('en-GB');

            const snapshot = await reportRef.once('value');
            let reportData = snapshot.val() || {};

            // 1. PREPARED BY
            if (status === 'Report Approval' && !reportData.prepared_by) {
                let baseESN = "RPT-" + Math.floor(1000 + Math.random() * 9000);
                if (typeof window.getNextSeriesNumber === 'function') baseESN = await window.getNextSeriesNumber();
                else if (typeof getNextSeriesNumber === 'function') baseESN = await getNextSeriesNumber();
                
                await reportRef.update({
                    po: po,
                    inv_key: key,
                    esn_base: baseESN,
                    prepared_by: { name: user.Name, date: now, esn_full: `${baseESN}/${user.Name.split(' ')[0].toUpperCase()}` }
                });
                console.log("Report: Prepared By recorded.");
            }

            // 2. SITE APPROVAL
            const isFinance = user.Position.toLowerCase().includes('finance');
            const isAccounting = user.Position.toLowerCase().includes('accounting') || user.Position.toLowerCase().includes('accounts');
            
            if (status === 'Report Approval' && !isFinance && !isAccounting && reportData.prepared_by) {
                if (!reportData.site_approval) {
                    await reportRef.child('site_approval').set({
                        name: user.Name,
                        date: now,
                        esn_full: `${reportData.esn_base}/${user.Name.split(' ')[0].toUpperCase()}`
                    });
                    console.log("Report: Site Approval recorded.");
                }
            }

            // 3. FINANCE APPROVAL (WITH RECEIPT UPLOAD)
            if (isFinance && reportData.prepared_by) {
                const financeESN = `${reportData.esn_base}/${user.Name.split(' ')[0].toUpperCase()}`;
                
                // A. Prepare File Paths
                const safeFilename = financeESN.replace(/[^a-zA-Z0-9]/g, '_');
                const bucketName = "invoiceentry-b15a8.firebasestorage.app";
                const storagePath = `receipts/${safeFilename}.html`; // Changed to .html for easy viewing
                const publicLink = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;

                // B. Generate Digital Receipt Content (Simple HTML)
                const receiptContent = `
                    <html>
                    <head><title>Digital Receipt</title><style>body{font-family:sans-serif;padding:20px;text-align:center;border:5px solid #00748C;margin:10px;border-radius:10px;}h1{color:#00748C;}.valid{color:green;font-weight:bold;font-size:1.2em;}</style></head>
                    <body>
                        <h1>OFFICIAL RECEIPT</h1>
                        <p><strong>PO Number:</strong> ${po}</p>
                        <p><strong>ESN:</strong> ${financeESN}</p>
                        <p><strong>Status:</strong> <span class="valid">APPROVED BY FINANCE</span></p>
                        <p><strong>Date:</strong> ${now}</p>
                        <p><strong>Approver:</strong> ${user.Name}</p>
                        <hr>
                        <small>Ismail Bin Ali Trading & Cont. Co. W.L.L</small>
                    </body>
                    </html>
                `;

                // C. Upload to Firebase Storage
                // Note: We use 'storage' variable which is initialized in your app.js for 'invoiceApp'
                try {
                    const storageRef = storage.ref(storagePath);
                    await storageRef.putString(receiptContent, 'raw', { contentType: 'text/html' });
                    console.log("Report: Digital Receipt Uploaded.");
                } catch (uploadErr) {
                    console.error("Receipt Upload Failed:", uploadErr);
                    // We continue even if upload fails, just to save the data
                }

                // D. Save Database Record
                await reportRef.child('finance_approval').set({
                    name: user.Name,
                    date: now,
                    esn_full: financeESN,
                    qr_link: publicLink
                });
                console.log("Report: Finance Approval recorded.");
            }
        } catch (err) {
            console.error("Report Workflow Error:", err);
            alert("Database Error: " + err.message);
        }
    };
    console.log("✅ Report Workflow Loaded (With Receipt Upload)");

    // =========================================================
    // FIX: CLOUD UPLOAD BUTTONS (OPEN SHAREPOINT FOLDERS)
    // =========================================================

    // 1. Define the specific Folder URLs
    const INVOICE_FOLDER_URL = "https://ibaqatar-my.sharepoint.com/my?id=%2Fpersonal%2Fdc%5Fiba%5Fcom%5Fqa%2FDocuments%2FDC%20Files%2FINVOICE&viewid=9f9468fa%2D5716%2D4b2c%2D9740%2Df52d4616d6a8";
    const SRV_FOLDER_URL = "https://ibaqatar-my.sharepoint.com/my?id=%2Fpersonal%2Fdc%5Fiba%5Fcom%5Fqa%2FDocuments%2FDC%20Files%2FSRV&viewid=9f9468fa%2D5716%2D4b2c%2D9740%2Df52d4616d6a8";
    const URL_REPORT = "https://ibaqatar-my.sharepoint.com/my?id=%2Fpersonal%2Fdc%5Fiba%5Fcom%5Fqa%2FDocuments%2FDC%20Files%2FReport&viewid=9f9468fa%2D5716%2D4b2c%2D9740%2Df52d4616d6a8";
    
    function wireCloudButton(buttonId, targetUrl) {
        const btn = document.getElementById(buttonId);
        if (!btn || !btn.parentNode) return;

        // Remove any old listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(targetUrl, '_blank');
        });
    }

    function initReportCloudButtons() {
        wireCloudButton('im-btn-view-invoice', INVOICE_FOLDER_URL);
        wireCloudButton('im-btn-view-srv', SRV_FOLDER_URL);
        wireCloudButton('btn-open-report-drive', URL_REPORT);
    }

    // =========================================================
    // START: FINANCE BATCH & PRINT LOGIC (Paste in app.js)
    // =========================================================

    // --- 1. CONFIGURATION ---
    const FINANCE_APPROVER_NAME = "Mostafa"; // The user who manages Finance
    // NOTE: Ensure 'currentUser' variable is available globally in your app.js

    // --- 2. LOGIC TO SHOW/HIDE BUTTONS ---
    // Call this function whenever you open the dashboard or modal
    function updateFinanceUI(invoice) {
        // A. Show Batch Button on Dashboard if user is Finance
        const batchDiv = document.getElementById('financeBatchControls');
        if (batchDiv) {
            // Adjust 'currentUser' variable name based on your existing app code
            // Assuming global variable 'currentUser' or similar exists
            if (typeof currentUser !== 'undefined' && (currentUser.name === FINANCE_APPROVER_NAME || currentUser.role === "Admin")) {
                batchDiv.style.display = "flex"; 
            } else {
                batchDiv.style.display = "none";
            }
        }

        // B. Show Print Button in Modal
        const printBtn = document.getElementById('btn-admin-print-finance');
        if (printBtn && invoice) {
            let isApproved = invoice.status === "Report Approved";
            let isFinance = (typeof currentUser !== 'undefined' && (currentUser.name === FINANCE_APPROVER_NAME || currentUser.role === "Admin"));
            
            // Only show if Approved AND User is Finance
            if (isApproved && isFinance) {
                printBtn.style.display = "block";
                // Optional: Disable if already printed and not Admin
                if (invoice.reportPrinted && currentUser.role !== "Admin") {
                    printBtn.disabled = true;
                    printBtn.title = "Report already printed (Locked)";
                } else {
                    printBtn.disabled = false;
                }
            } else {
                printBtn.style.display = "none";
            }
        }
    }
    window.updateFinanceUI = updateFinanceUI;

    // --- 3. BATCH FINALIZATION FUNCTION ---
    function finalizeApprovedBatch() {
        if (confirm("Are you sure you want to finalize all 'Report Approved' items? This will generate the official QR codes.")) {
            
            const batchID = "BATCH-" + new Date().getTime().toString().substr(-6);
            const batchDate = new Date().toLocaleDateString();
            const timestamp = new Date().getTime();

            // Query Firebase for items in Mostafa's queue that are "Report Approved"
            firebase.database().ref('invoices')
                .orderByChild('attention')
                .equalTo(FINANCE_APPROVER_NAME)
                .once('value')
                .then(snapshot => {
                    let updates = {};
                    let count = 0;

                    snapshot.forEach(child => {
                        let inv = child.val();
                        // Check logic: Must be 'Report Approved' AND waiting for batch
                        // You might need to add a flag 'readyForBatch' during the approval step
                        // Or just trust the status "Report Approved"
                        if (inv.status === "Report Approved") {
                            
                            // 1. Generate the Finance Signature Block
                            updates[child.key + '/finance_approval'] = {
                                name: FINANCE_APPROVER_NAME,
                                date: batchDate,
                                timestamp: timestamp,
                                batchID: batchID, // THE SHARED ID
                                esn: batchID      // VISUAL ESN
                            };

                            // 2. Move Task Forward (e.g. back to Sender/Prepared By)
                            let sender = inv.prepared_by_name || "Sender";
                            updates[child.key + '/attention'] = sender;
                            
                            // 3. Update Status to indicate it's done
                            updates[child.key + '/status'] = "Report Approved"; // Stays approved
                            updates[child.key + '/readyForPrint'] = true; 

                            count++;
                        }
                    });

                    if (count > 0) {
                        firebase.database().ref('invoices').update(updates).then(() => {
                            alert(`Batch Finalized! ${count} invoices sealed.\nBatch ID: ${batchID}`);
                            // Reload your table function here if it exists (e.g., loadActiveTasks())
                            if (typeof loadActiveTasks === 'function') loadActiveTasks(); 
                        });
                    } else {
                        alert("No 'Report Approved' items found in your queue.");
                    }
                });
        }
    }
    window.finalizeApprovedBatch = finalizeApprovedBatch;

    // =========================================================
    // FINANCE INPUT FORMATTERS (Commas)
    // =========================================================
    window.formatCurrencyField = function(input) {
        if (!input.value || input.value.trim() === '') return;
        // Remove existing commas to get raw number
        let raw = input.value.replace(/,/g, '');
        let num = parseFloat(raw);
        if (!isNaN(num)) {
            // Format with commas and 2 decimal places
            input.value = num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
    };

    window.cleanCurrencyField = function(input) {
        if (!input.value) return;
        // Remove commas so user can edit raw number
        input.value = input.value.replace(/,/g, '');
        // Select all text for easy overwriting
        input.select();
    };

    // =========================================================
    // AUTO-GENERATE REPORT NAME (On "Report Approved")
    // =========================================================
    function initReportNameAutoGeneration() {
        // Renamed variable to 'reportAutoSelect' to fix initialization error
        const reportAutoSelect = document.getElementById('im-status');

        if (reportAutoSelect) {
            reportAutoSelect.addEventListener('change', function() {
                // 1. Check if the status is the trigger status
                if (this.value === "Report Approved") {
                    
                    // 2. Get Data from the modal
                    // Use safe selection with optional chaining in case elements are missing
                    const poElement = document.querySelector('#im-invoice-entry-modal .im-po-no');
                    const vendorElement = document.querySelector('#im-invoice-entry-modal .im-po-vendor');
                    const entryIdElement = document.getElementById('im-inv-entry-id');

                    if (!poElement || !vendorElement || !entryIdElement) return;

                    const poText = poElement.textContent.trim();
                    const vendorText = vendorElement.textContent.trim();
                    const entryId = entryIdElement.value.trim();

                    // 3. Validation
                    if (poText === "---" || poText === "" || entryId === "") return;

                    // 4. Truncate Vendor Name (Max 17 Chars)
                    const shortVendor = truncateNameText(vendorText, 17);

                    // 5. Construct the String: PO-EntryID-Vendor-Report
                    const generatedName = `${poText}-${entryId}-${shortVendor}-Report`;

                    // 6. Set the value
                    const reportNameInput = document.getElementById('im-report-name');
                    if (reportNameInput) {
                        reportNameInput.value = generatedName;

                        // Visual Flash
                        reportNameInput.style.backgroundColor = "#ffffcc"; 
                        setTimeout(() => {
                            reportNameInput.style.backgroundColor = ""; 
                        }, 500);
                    }
                }
            });
        }
    }

    function runWhenReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    runWhenReady(() => {
        initReportCloudButtons();
        initReportNameAutoGeneration();
    });

    // #endregion BLOCK 27 — REPORT WORKFLOW, RECEIPT UPLOAD + FINANCE BATCH
})();
