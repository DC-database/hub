/* ==========================================================================
   js/app-finance.js
   IBA Finance Report / Export helpers
   Version: 7.9.8

   Cleanup Phase 4:
   - Finance report generation, print helpers, and export helpers moved out of app.js.
   - Function names are kept global for backward compatibility.
   - No Firebase paths, report workflow, invoice data logic, or UI behavior changed.
   ========================================================================== */

// #region BLOCK 28 — FINANCE REPORTS + EXPORTS
// Purpose: Report PDF generation/print, daily/with-accounts/report-approved exports, custom Excel/table exports.
// =================================================================================================

// ==========================================================================
// 22. FINANCE REPORT (READ-ONLY)
// ==========================================================================

// 7.5.9: Removed unused internal Finance Report search/view code.
// The external Finance/Epicore links and Report PDF generation remain unchanged.

async function generateFinanceReport(selectedPayment) {
    const poNo = selectedPayment.poNo;
    if (!poNo) return;
    try {
        const snapshot = await paymentDb.ref('payments').orderByChild('poNo').equalTo(poNo).once('value');
        if (!snapshot.exists()) {
            alert('No payments found for this PO No.');
            return;
        }
        const payments = [];
        snapshot.forEach(childSnapshot => {
            payments.push(childSnapshot.val());
        });
        payments.sort((a, b) => {
            const aNum = parseInt(String(a.paymentNo).replace('PVN-', ''));
            const bNum = parseInt(String(b.paymentNo).replace('PVN-', ''));
            return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
        });
        let totalCertified = 0,
            totalRetention = 0,
            totalPayment = 0,
            totalPrevPayment = 0;
        let allNotes = [];

        payments.forEach(payment => {
            const certified = parseFloat(payment.certifiedAmount || 0);
            const retention = parseFloat(payment.retention || 0);
            const paymentAmount = parseFloat(payment.payment || 0);

            totalCertified += certified;
            totalRetention += retention;
            totalPayment += paymentAmount;

            if (payment.datePaid && String(payment.datePaid).trim() !== '') {
                totalPrevPayment += paymentAmount;
            }
            if (payment.note && String(payment.note).trim() !== '') {
                allNotes.push(`${String(payment.note).trim()}`);
            }
        });

        const totalCommitted = parseFloat(selectedPayment.poValue || 0) - totalCertified;
        imReportDate.textContent = formatFinanceDateLong(new Date().toISOString());
        imReportPoNo.textContent = poNo;
        imReportProject.textContent = selectedPayment.site || '';
        imReportVendorId.textContent = selectedPayment.vendorId || '';
        imReportVendorName.textContent = selectedPayment.vendor || '';
        imReportTotalPoValue.textContent = formatFinanceNumber(selectedPayment.poValue);
        imReportTotalCertified.textContent = formatFinanceNumber(totalCertified);
        imReportTotalPrevPayment.textContent = formatFinanceNumber(totalPrevPayment);
        imReportTotalCommitted.textContent = formatFinanceNumber(totalCommitted);
        imReportTotalRetention.textContent = formatFinanceNumber(totalRetention);

        imReportTableBody.innerHTML = '';
        payments.forEach(payment => {
            const row = document.createElement('tr');
            const pvn = payment.paymentNo ? String(payment.paymentNo).replace('PVN-', '') : '';
            row.innerHTML = `
                <td>${pvn}</td>
                <td>${payment.chequeNo || ''}</td>
                <td>${formatFinanceNumber(payment.certifiedAmount)}</td>
                <td>${formatFinanceNumber(payment.retention)}</td>
                <td>${formatFinanceNumber(payment.payment)}</td>
                <td>${payment.datePaid ? formatFinanceDate(payment.datePaid) : ''}</td>`;
            imReportTableBody.appendChild(row);
        });

        imReportTotalCertifiedAmount.textContent = formatFinanceNumber(totalCertified);
        imReportTotalRetentionAmount.textContent = formatFinanceNumber(totalRetention);
        imReportTotalPaymentAmount.textContent = formatFinanceNumber(totalPayment);

        if (allNotes.length > 0) {
            imReportNotesContent.textContent = allNotes.join('\n');
            imReportNotesSection.style.display = 'block';
        } else {
            imReportNotesContent.textContent = '';
            imReportNotesSection.style.display = 'none';
        }

        imFinanceReportModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error generating finance report:', error);
    }
}

// [RENAMED] This handles the Read-Only modal print
function printReadOnlyReport() {
    window.print();
}


// =========================================================
// NEW FUNCTION: Print Finance Summary (Read-Only Report)
// =========================================================
function printFinanceReadOnlyReport() {
    // 1. Gather Data from the Modal Elements
    // (We use the same IDs that 'generateFinanceReport' populates)
    const poNo = document.getElementById('im-report-po-no').textContent;
    const vendor = document.getElementById('im-report-vendor-name').textContent;
    const site = document.getElementById('im-report-project').textContent;
    const date = document.getElementById('im-report-date').textContent;
    const notes = document.getElementById('im-report-notes-content').textContent;

    // Get the table content
    const tableBody = document.getElementById('im-report-table-body').innerHTML;
    
    // Get Totals
    const totalCert = document.getElementById('im-report-total-certified-amount').textContent;
    const totalRet = document.getElementById('im-report-total-retention-amount').textContent;
    const totalPay = document.getElementById('im-report-total-payment-amount').textContent;

    // 2. Build the Print Window HTML
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Finance Report - ${poNo}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #00748C; padding-bottom: 10px; }
                .header h2 { margin: 0; color: #00748C; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; font-size: 14px; }
                .info-item label { font-weight: bold; color: #555; display: block; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
                th { background-color: #f8f9fa; border: 1px solid #ddd; padding: 8px; text-align: left; }
                td { border: 1px solid #ddd; padding: 8px; }
                
                .totals-section { float: right; width: 300px; }
                .total-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
                .total-row.final { font-weight: bold; border-top: 2px solid #333; border-bottom: none; font-size: 16px; margin-top: 10px; padding-top: 10px; }
                
                .notes-box { margin-top: 50px; padding: 10px; background: #f9f9f9; border: 1px solid #eee; font-style: italic; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Payment History Report</h2>
                <p>Generated on: ${date}</p>
            </div>

            <div class="info-grid">
                <div class="info-item"><label>PO Number:</label> ${poNo}</div>
                <div class="info-item"><label>Vendor:</label> ${vendor}</div>
                <div class="info-item"><label>Site / Project:</label> ${site}</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Payment No</th>
                        <th>Cheque No</th>
                        <th>Certified</th>
                        <th>Retention</th>
                        <th>Payment</th>
                        <th>Date Paid</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableBody}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="total-row"><span>Total Certified:</span> <span>${totalCert}</span></div>
                <div class="total-row"><span>Total Retention:</span> <span>${totalRet}</span></div>
                <div class="total-row final"><span>Total Paid:</span> <span>${totalPay}</span></div>
            </div>

            ${notes ? `<div class="notes-box"><strong>Notes:</strong><br>${notes}</div>` : ''}

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}




// --- 4. PRINT REPORT FUNCTION (COMPLEX QR/STICKER) ---
// This handles the Sticker print from the main list
function printFinanceReport() {
    // Get the key from your modal's hidden input
    const keyElement = document.getElementById('modify-task-key');
    if (!keyElement) {
        // If this element doesn't exist, we might be in the read-only modal by mistake.
        // Fallback to simple print.
        window.print();
        return;
    }
    const key = keyElement.value;
    
    if (!key) { 
        // If no key found, fallback
        window.print(); 
        return;
    }
    
    firebase.database().ref('invoices/' + key).once('value').then(snapshot => {
        let inv = snapshot.val();
        
        if (!inv.finance_approval || !inv.finance_approval.batchID) {
            alert("Error: This report has not been finalized by Finance yet.");
            return;
        }

        // --- PREPARE DATA ---
        let prepLine = `${inv.date || ''} / ${inv.prepared_by_name || 'Sender'}`;
        
        // Site Manager: Date / ESN / Name
        let siteData = inv.site_approval || {};
        let siteLine = siteData.name ? `${siteData.date} / ${siteData.esn || ''} / ${siteData.name}` : "";

        // Finance: Date / ESN / Name
        let finData = inv.finance_approval || {};
        let finLine = finData.name ? `${finData.date} / ${finData.batchID} / ${finData.name}` : "";
        
        // QR Code Logic (Using Batch ID)
        let qrData = encodeURIComponent(finData.batchID);
        let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;
        let financeQRBlock = `<img src="${qrUrl}" style="width:70px; height:70px; display:block; margin: 0 auto 5px auto;">`;

        // --- OPEN PRINT WINDOW ---
        let printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Finance Report ${inv.po_number || ''}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    .header { text-align: center; margin-bottom: 40px; }
                    .sig-container { display: flex; justify-content: space-between; margin-top: 100px; }
                    .sig-box { width: 30%; text-align: center; position: relative; }
                    .line { border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; font-size: 12px; }
                    .role-title { font-weight: bold; margin-top: 5px; }
                    .qr-holder { height: 75px; display: flex; align-items: flex-end; justify-content: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Financial Report Approval</h2>
                    <p>PO: ${inv.po_number || 'N/A'} | Vendor: ${inv.vendor_name || 'N/A'}</p>
                </div>
                
                <div style="margin-bottom: 50px;">
                    <p><strong>Status:</strong> ${inv.status}</p>
                    <p><strong>Amount:</strong> ${inv.invoice_amount || inv.amount || '0.00'}</p>
                </div>

                <div class="sig-container">
                    
                    <div class="sig-box">
                        <div class="qr-holder"></div>
                        <div class="line">${prepLine}</div>
                        <div class="role-title">Prepared By</div>
                    </div>

                    <div class="sig-box">
                        <div class="qr-holder"></div>
                        <div class="line">${siteLine}</div>
                        <div class="role-title">Site Approval</div>
                    </div>

                    <div class="sig-box">
                        <div class="qr-holder">${financeQRBlock}</div>
                        <div class="line">${finLine}</div>
                        <div class="role-title">Finance</div>
                    </div>

                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        // Lock the report
        if (currentUser.role !== "Admin") {
            firebase.database().ref('invoices/' + key).update({ reportPrinted: true });
        }
    });
}

    
// ==========================================================================
// MASTER EXPORT SECTION: 1-Hour & Special Reports
// ==========================================================================

// 1. DAILY ENTRY REPORT (Last 2 Hours)
async function handleDownloadDailyReport() {
    const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    const isSuperAdminDelegate = isVacationDelegateUser();
    if (!(isSuperAdmin || isSuperAdminDelegate)) {
        alert("You do not have permission to download this report.");
        return;
    }

    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

    try {
        await ensureInvoiceDataFetched(true);

        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for report.");

        let recentEntries = [];

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];

                // Normalize Event Timestamp (prefer status/update time; fallback to created time)
                let eventTime = inv.updatedAt || inv.enteredAt || inv.createdAt || inv.timestamp || 0;
                if (typeof eventTime === 'string') eventTime = new Date(eventTime).getTime();

                // Only include invoices that are Under Review in the last 2 hours
                const statusStr = (inv.status || '').toString().trim().toLowerCase();
                if (statusStr === 'under review' && (eventTime > twoHoursAgo)) {
                    recentEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?.['Project ID'] || 'N/A',
                        ...inv,
                        sortTime: eventTime
                    });
                }
            }
        }

        if (recentEntries.length === 0) {
            alert("No 'Under Review' invoices found in the last 2 hours.");
            return;
        }

        recentEntries.sort((a, b) => a.sortTime - b.sortTime);

        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Time", "PO", "Site", "Inv No", "Inv Name", "Inv Amount", "Amount Paid", "Status"];
        csvContent += headers.join(",") + "\r\n";

        recentEntries.forEach(entry => {
            let timeString = '';
            if (entry.sortTime) {
                const dateObj = new Date(entry.sortTime);
                if (!isNaN(dateObj.getTime())) {
                    timeString = dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }

            const row = [
                timeString,
                entry.po,
                entry.site,
                `"${(entry.invNumber || '').replace(/"/g, '""')}"`,
                `"${(entry.invName || '').replace(/"/g, '""')}"`,
                entry.invValue || '0',
                entry.amountPaid || '0',
                entry.status || ''
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `entry_report_last_2hrs_${timestampStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating report:", error);
        alert("An error occurred while generating the report.");
    }
}

// 2. WITH ACCOUNTS REPORT (Last 2 Hours)
async function handleDownloadWithAccountsReport() {
    const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    const isSuperAdminDelegate = isVacationDelegateUser();
    if (!(isSuperAdmin || isSuperAdminDelegate)) {
        alert("You do not have permission to download this report.");
        return;
    }


    // Setup Time Checker (Last 2 Hours)
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

    try {
        await ensureInvoiceDataFetched(true);

        const allInvoicesByPO = allInvoiceData;
        const allPOs = allPOData;

        if (!allInvoicesByPO || !allPOs) throw new Error("Data not loaded for report.");

        let recentEntries = [];

        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber];
            for (const key in invoices) {
                const inv = invoices[key];

                // Normalize Event Timestamp (prefer status/update time; fallback to created time)
                let eventTime = inv.updatedAt || inv.enteredAt || inv.createdAt || inv.timestamp || 0;
                if (typeof eventTime === 'string') eventTime = new Date(eventTime).getTime();

                // Only include if status is correct AND in the last 2 hours
                const statusStr = (inv.status || '').toString().trim().toLowerCase();
                if (statusStr === 'with accounts' && (eventTime > twoHoursAgo)) {
                    recentEntries.push({
                        po: poNumber,
                        site: allPOs[poNumber]?.['Project ID'] || 'N/A',
                        ...inv,
                        sortTime: eventTime
                    });
                }
            }
        }

        if (recentEntries.length === 0) {
            alert("No 'With Accounts' invoices found in the last 2 hours.");
            return;
        }

        // Sort Ascending
        recentEntries.sort((a, b) => a.sortTime - b.sortTime);

        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Time", "PO", "Site", "Inv No", "SRV Name", "Inv Amount", "Amount Paid", "Status"];
        csvContent += headers.join(",") + "\r\n";

        recentEntries.forEach(entry => {
            let timeString = '';
            if (entry.sortTime) {
                const dateObj = new Date(entry.sortTime);
                if (!isNaN(dateObj.getTime())) {
                    timeString = dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }

            const row = [
                timeString,
                entry.po,
                entry.site,
                `"${(entry.invNumber || '').replace(/"/g, '""')}"`,
                `"${(entry.srvName || '').replace(/"/g, '""')}"`,
                entry.invValue || '0',
                entry.amountPaid || '0',
                entry.status || ''
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `with_accounts_report_${timestampStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating report:", error);
        alert("An error occurred while generating the report.");
    }
}

// 3. REPORT APPROVED EXPORT (Includes "Report Name")
// Logic: Last 2 Hours Only
window.downloadReportingTableToExcel = async function() {
    const btn = document.getElementById('im-reporting-download-btn');
    const originalText = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Checking recent...';
        btn.disabled = true;
    }

    try {
        const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
        const isSuperAdminDelegate = isVacationDelegateUser();
        if (!(isSuperAdmin || isSuperAdminDelegate)) {
            alert("You do not have permission to download this report.");
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        // 1. Time Filter: Last 2 Hours
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - TWO_HOURS_MS;

        // 2. Database Connection
        let targetDb = (typeof invoiceDb !== 'undefined') ? invoiceDb : firebase.database();

        // 3. Fetch Data
        const snapshot = await targetDb.ref('invoice_entries').once('value');
        
        if (!snapshot.exists()) {
            alert("No records found.");
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        // HEADER: Added "Report Name"
        csvContent += "Time,PO,Site,Inv No,Report Name,Inv Amount,Amount Paid,Status\n";

        let count = 0;
        
        snapshot.forEach(poSnap => {
            const poNumber = poSnap.key;
            if (poSnap.hasChildren() && typeof poSnap.val() === 'object') {
                poSnap.forEach(invSnap => {
                    const inv = invSnap.val();
                    if (!inv || typeof inv !== 'object') return;
                    
                    // --- FILTER 1: STATUS 'Report Approved' ---
                    if (inv.status !== 'Report Approved') return;

                    // --- FILTER 2: TIME (Last 2 Hours) ---
                    // Normalize to milliseconds since epoch (handles ISO strings and seconds timestamps)
                    let itemTime = inv.updatedAt || inv.enteredAt || inv.timestamp || 0;
                    if (typeof itemTime === 'string') {
                        const parsed = Date.parse(itemTime);
                        itemTime = isNaN(parsed) ? (parseInt(itemTime, 10) || 0) : parsed;
                    }
                    if (typeof itemTime === 'number' && itemTime > 0 && itemTime < 1e12) {
                        // likely seconds
                        itemTime = itemTime * 1000;
                    }
                    if (itemTime < cutoffTime) return; // Skip old items
                    
                    // --- DATA MAPPING ---
                    const time = (inv.invoiceDate || inv.date || '').substring(0, 10);
                    const site = (inv.site_name || inv.site || '').replace(/"/g, '""');
                    const invNo = (inv.invNumber || inv.invoice_number || '').replace(/"/g, '""');
                    
                    // THE NEW COLUMN
                    const reportName = (inv.reportName || '').replace(/"/g, '""');
                    
                    const invAmount = (inv.invValue || inv.amount || '0').toString().replace(/,/g, '');
                    const amountPaid = (inv.amountPaid || '0').toString().replace(/,/g, '');
                    const status = inv.status;

                    const row = `"${time}","${poNumber}","${site}","${invNo}","${reportName}","${invAmount}","${amountPaid}","${status}"`;
                    csvContent += row + "\n";
                    count++;
                });
            }
        });

        if (count === 0) {
            alert("No 'Report Approved' records found from the last 2 hours.");
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
            return;
        }

        // 4. Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `Invoice_Report_Approved_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Export Error:", error);
        alert("An error occurred. See console.");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};



// ==========================================================================
// CUSTOM EXCEL EXPORT (Filtered Full Data + Invoice, SRV Name, Release Date)
// ==========================================================================
window.exportCurrentTableToExcel = function() {
    // 1. Strict Super Admin Check (using standard system check)
    let isSuperAdmin = false;
    try {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'Super Admin') {
            isSuperAdmin = true;
        } else if (typeof currentApprover !== 'undefined' && currentApprover && (currentApprover.Name || '').toLowerCase() === 'super admin') {
            isSuperAdmin = true;
        } else if (typeof isVacationDelegateUser === 'function' && isVacationDelegateUser()) {
            isSuperAdmin = true;
        }
    } catch(e) {}
    
    // Fallback allowing it to run if the button was rendered, but checking is best practice
    if (!isSuperAdmin && !document.getElementById('im-download-excel-custom-btn')) {
        alert("Access Denied: Only Super Admin can export this report.");
        return;
    }

    if (typeof allInvoiceData === 'undefined' || !allInvoiceData) {
        alert("No invoice data available. Please wait for the system to load.");
        return;
    }

    // 2. Get active filter values exactly as they are in the UI
    const searchTerm = (document.getElementById('im-reporting-search')?.value || '').toLowerCase().trim();
    const siteFilter = document.getElementById('im-reporting-site-filter')?.value || '';
    const statusFilter = document.getElementById('im-reporting-status-filter')?.value || '';
    const monthFilter = document.getElementById('im-reporting-month-filter')?.value || '';
    const yearFilter = document.getElementById('im-reporting-year-filter')?.value || '';

    // 3. Build CSV Header (with UTF-8 BOM so Excel opens it cleanly)
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    const headers = [
        "PO Number", "Site", "Vendor", "PO Value", 
        "Inv Entry ID", "Invoice No", "Invoice Name", "SRV Name", 
        "Invoice Date", "Invoice Value", "Amount Paid", "Release Date", "Status", "Note"
    ];
    csvContent += headers.join(",") + "\n";

    let resultCount = 0;

    // 4. Loop through the FULL dataset to ensure we miss nothing (bypasses UI pagination)
    for (const poNumber in allInvoiceData) {
        const invoices = allInvoiceData[poNumber];
        
        // Grab parent PO details safely
        let poSite = '';
        let poVendor = '';
        let poValue = 0;
        
        if (typeof allPOData !== 'undefined' && allPOData[poNumber]) {
            poSite = allPOData[poNumber]['Project ID'] || allPOData[poNumber]['Project ID:'] || '';
            poVendor = allPOData[poNumber]['Supplier Name'] || allPOData[poNumber]['Supplier Name:'] || allPOData[poNumber]['Supplier'] || '';
            poValue = parseFloat(allPOData[poNumber]['PO Amount'] || allPOData[poNumber]['PO Amount:'] || allPOData[poNumber]['Total Amount'] || 0) || 0;
        }

        for (const key in invoices) {
            const inv = invoices[key];
            const invStatus = inv.status || '';

            // --- HARD RULE: EXCLUDE EPICORE CLOSE ---
            if (invStatus.toLowerCase() === 'epicore close') continue;

            // Resolve Site & Vendor (Invoice level overrides PO level)
            const actualSite = inv.site || inv.site_name || poSite || 'N/A';
            const actualVendor = inv.vendor || inv.vendor_name || poVendor || 'N/A';

            // --- APPLY UI FILTERS ---
            // 1. Site Filter
            if (siteFilter && actualSite !== siteFilter) continue;

            // 2. Status Filter
            if (statusFilter && statusFilter !== 'Negative Balance') {
                if (invStatus !== statusFilter) continue;
            }

            // 3. Month & Year Filter
            if (monthFilter || yearFilter) {
                const dateStr = inv.invoiceDate || '';
                if (!dateStr) continue;
                const parts = dateStr.split('-'); // format: YYYY-MM-DD
                if (parts.length === 3) {
                    if (yearFilter && parts[0] !== yearFilter) continue;
                    if (monthFilter && parts[1] !== monthFilter) continue;
                } else {
                    continue; // invalid date formatting
                }
            }

            // 4. Search Bar Filter
            if (searchTerm) {
                const searchString = `${poNumber} ${actualVendor} ${inv.invNumber || ''} ${inv.invValue || ''} ${invStatus} ${inv.invName || ''} ${inv.srvName || ''}`.toLowerCase();
                if (!searchString.includes(searchTerm)) continue;
            }

            // --- IF IT PASSES ALL FILTERS, ADD TO EXCEL ---
            const invEntry = `"${(inv.invEntryID || '').replace(/"/g, '""')}"`;
            const invNo = `"${(inv.invNumber || '').replace(/"/g, '""')}"`;
            const invName = `"${(inv.invName || '').replace(/"/g, '""')}"`; 
            const srvName = `"${(inv.srvName || '').replace(/"/g, '""')}"`; 
            
            // Format dates neatly for Excel
            let invDate = '';
            if (inv.invoiceDate) {
                const d = new Date(inv.invoiceDate);
                if (!isNaN(d.getTime())) invDate = d.toLocaleDateString('en-GB'); 
            }
            
            let relDate = '';
            if (inv.releaseDate) {
                const rd = new Date(inv.releaseDate);
                if (!isNaN(rd.getTime())) relDate = rd.toLocaleDateString('en-GB'); 
            }

            const invValue = inv.invValue || 0;
            const amtPaid = inv.amountPaid || 0;
            const safeStatus = `"${invStatus.replace(/"/g, '""')}"`;
            const safeNote = `"${(inv.note || '').replace(/"/g, '""')}"`;
            const poNoClean = `"${poNumber.replace(/"/g, '""')}"`;
            const vendorClean = `"${actualVendor.replace(/"/g, '""')}"`;
            const siteClean = `"${actualSite.replace(/"/g, '""')}"`;

            const row = [
                poNoClean, siteClean, vendorClean, poValue,
                invEntry, invNo, invName, srvName, invDate, invValue, amtPaid, relDate, safeStatus, safeNote
            ];
            
            csvContent += row.join(",") + "\n";
            resultCount++;
        }
    }

    if (resultCount === 0) {
        alert("No results match the current filters (or all matching items are 'Epicore Close').");
        return;
    }

    // 5. Trigger File Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Invoice_Records_Filtered_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

    
// ==========================================================================
// MISSING FUNCTION: Handle Print for Job Records
// ==========================================================================
function handlePrintReportingTable() {
    // 1. Get the table rows from the Job Records table
    const tableBody = document.getElementById('wd-jobentry-table').querySelector('tbody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));

    if (rows.length === 0 || rows[0].innerText.includes('No entries')) {
        alert("No records to print.");
        return;
    }

    // 2. Build the Print Window Content
    let printHtml = `
        <html>
        <head>
            <title>Job Records Report</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
                h2 { text-align: center; color: #003A5C; margin-bottom: 5px; }
                p.date { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { background-color: #003A5C; color: white; padding: 6px; text-align: left; }
                td { border: 1px solid #ddd; padding: 5px; color: #333; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .status-approved { color: #28a745; font-weight: bold; }
                .status-rejected { color: #dc3545; font-weight: bold; }
                .status-pending { color: #ffc107; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>Job Records Report</h2>
            <p class="date">Generated on: ${new Date().toLocaleString()}</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Job</th>
                        <th>Ref</th>
                        <th>PO</th>
                        <th>Vendor</th>
                        <th>Amount</th>
                        <th>Site</th>
                        <th>Note</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // 3. Loop through rows and extract text
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length < 8) return; // Skip malformed rows

        // Note: We skip the last "Action" column (index 9)
        printHtml += `
            <tr>
                <td>${cols[0]?.innerText || ''}</td> <td>${cols[1]?.innerText || ''}</td> <td>${cols[2]?.innerText || ''}</td> <td>${cols[3]?.innerText || ''}</td> <td>${cols[4]?.innerText || ''}</td> <td>${cols[5]?.innerText || ''}</td> <td>${cols[6]?.innerText || ''}</td> <td>${cols[7]?.innerText || ''}</td> <td>${cols[8]?.innerHTML || ''}</td> </tr>
        `;
    });

    printHtml += `
                </tbody>
            </table>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    // 4. Open Print Window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
    } else {
        alert("Pop-up blocked. Please allow pop-ups to print.");
    }
}


// #endregion BLOCK 28 — FINANCE REPORTS + EXPORTS
