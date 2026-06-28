// js/app-reporting-actions.js
// Moved from app.js in v8.1.2 (cleanup only).
// Purpose: Invoice reporting print report and CSV export helpers.
// Public functions preserved:
// - handleGeneratePrintReport
// - handleDownloadCSV

// #region BLOCK 19 — PRINT REPORTS + CSV DOWNLOADS
// Purpose: Generate print report, cleanup, CSV export, approver select.
// =================================================================================================

function handleGeneratePrintReport() {
    if (currentReportData.length === 0) {
        alert("No data to print. Please run a search first.");
        return;
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';

    if (!isAdmin && !isAccounting) {
        alert("You do not have permission to print this report.");
        return;
    }

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;
    let title = "Invoice Records";
    if (siteFilter && !statusFilter) title = `Invoice Report for Site: ${siteFilter}`;
    if (statusFilter && !siteFilter) title = `Invoice Report - Status: ${statusFilter}`;
    if (siteFilter && statusFilter) title = `Invoice Report for Site: ${siteFilter} (Status: ${statusFilter})`;

    // --- NEW: INJECT LOGO ---
    const logoContainer = document.querySelector('.print-logo');
    if (logoContainer) {
        logoContainer.innerHTML = '<img src="https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/logo%20(1).png style="height: 80px; width: auto;">';
    }
    // ------------------------
   
    imPrintReportTitle.textContent = title;
    imPrintReportDate.textContent = `Generated on: ${new Date().toLocaleString('en-GB')}`;

    let totalPOs = currentReportData.length;
    let totalReportValue = 0;
    let totalReportInvValue = 0;

    currentReportData.forEach(po => {
        totalReportValue += parseFloat(po.poDetails.Amount) || 0;
        po.filteredInvoices.forEach(inv => {
            totalReportInvValue += parseFloat(inv.invValue) || 0;
        });
    });

    const totalBalance = totalReportValue - totalReportInvValue;

    imPrintReportSummaryPOs.textContent = totalPOs;
    imPrintReportSummaryValue.textContent = `QAR ${formatCurrency(totalReportValue)}`;

    if (imPrintReportSummaryPaid) {
        const parentDiv = imPrintReportSummaryPaid.parentElement;
        if (parentDiv) {
            const labelSpan = parentDiv.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = 'Total Balance';
            }
            parentDiv.style.display = '';
        }
        imPrintReportSummaryPaid.textContent = `QAR ${formatCurrency(totalBalance)}`;
    }

    imPrintReportBody.innerHTML = '';

    currentReportData.forEach(po => {
        const poContainer = document.createElement('div');
        poContainer.className = 'print-po-container';

        let totalInvValue = 0;
        let totalAmountPaid = 0;

        po.filteredInvoices.forEach(inv => {
            totalInvValue += parseFloat(inv.invValue) || 0;
            totalAmountPaid += parseFloat(inv.amountPaid) || 0;
        });

const poValueNum = parseFloat(po.poDetails.Amount) || 0;
        let balanceNum = poValueNum - totalInvValue;
        if (poValueNum === 0) {
            balanceNum = 0;
        }

        const poHeader = document.createElement('div');
        poHeader.className = 'print-po-header';

        poHeader.innerHTML = `
            <div class="po-header-item"><strong>PO:</strong> ${po.poNumber}</div>
            <div class="po-header-item"><strong>Site:</strong> ${po.site}</div>
            <div class="po-header-item"><strong>PO Value:</strong> QAR ${formatCurrency(poValueNum)}</div>
            <div class="po-header-item po-header-vendor"><strong>Vendor:</strong> ${po.vendor}</div>
            <div class="po-header-item"><strong>Balance:</strong> QAR ${formatCurrency(balanceNum)}</div>
        `;
        poContainer.appendChild(poHeader);

        let invoicesTableHTML = `
            <table class="print-invoice-table">
                <thead>
                    <tr>
                        <th>Inv. Entry</th>
                        <th>Inv. No.</th>
                        <th>Inv. Date</th>
                        <th>Inv. Value</th>
                        <th>Amt. Paid</th>
                        <th>Release Date</th>
                        <th>Status</th>
                        <th>Note</th>
                    </tr>
                </thead>
                <tbody>
        `;

        po.filteredInvoices.forEach(inv => {
            const invValue = parseFloat(inv.invValue) || 0;
            const status = inv.status || '';

            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : '';

            invoicesTableHTML += `
                <tr>
                    <td>${inv.invEntryID || ''}</td>
                    <td>${inv.invNumber || ''}</td>
                    <td>${invoiceDateDisplay}</td>
                    <td class="print-number">${formatCurrency(invValue)}</td>
                    <td class="print-number">${formatCurrency(inv.amountPaid)}</td>
                    <td>${releaseDateDisplay}</td>
                    <td>${status || ''}</td>
                    <td>${inv.note || ''}</td>
                </tr>
            `;
        });

        invoicesTableHTML += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="print-footer-label">PO Invoice Totals:</td>
                        <td class="print-number print-footer">${formatCurrency(totalInvValue)}</td>
                        <td class="print-number print-footer">${formatCurrency(totalAmountPaid)}</td>
                        <td colspan="3"></td>
                    </tr>
                </tfoot>
            </table>
        `;

        poContainer.innerHTML += invoicesTableHTML;
        imPrintReportBody.appendChild(poContainer);
    });

        // Ensure other print targets are hidden (prevents conflicts / blank prints)
    if (summaryNotePrintArea) summaryNotePrintArea.classList.add('hidden');
    const invoicePrintModal = document.getElementById('im-invoice-print-modal');
    if (invoicePrintModal) invoicePrintModal.classList.add('hidden');

    if (imReportingPrintableArea) imReportingPrintableArea.classList.remove('hidden');

    const cleanupAfterPrint = () => {
        // Restore the summary label back to its normal state
        if (imPrintReportSummaryPaid && imPrintReportSummaryPaid.parentElement) {
            const parentDiv = imPrintReportSummaryPaid.parentElement;
            const labelSpan = parentDiv.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = 'Total Amount Paid';
            }
            parentDiv.style.display = '';
            imPrintReportSummaryPaid.textContent = 'QAR 0.00';
        }

        if (imReportingPrintableArea) imReportingPrintableArea.classList.add('hidden');
    };

    // Some browsers can open print before DOM paint; this avoids a blank preview.
    window.addEventListener('afterprint', cleanupAfterPrint, { once: true });
    requestAnimationFrame(() => window.print());
}


async function handleDownloadCSV() {
    const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    const isSuperAdminDelegate = isVacationDelegateUser();
    if (!(isSuperAdmin || isSuperAdminDelegate)) {
        alert("You do not have permission to download this report.");
        return;
    }
    if (currentReportData.length === 0) {
        alert("No data to download. Please perform a search first.");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["PO", "Site", "Vendor", "PO Value", "Total Paid Amount", "Last Paid Date", "invEntryID", "invNumber", "invoiceDate", "invValue", "amountPaid", "invName", "srvName", "attention", "releaseDate", "status", "note"];
    csvContent += headers.join(",") + "\r\n";
    currentReportData.forEach(po => {
        const totalPaidCSV = (po.paymentData.totalPaidAmount !== 'N/A' ? po.paymentData.totalPaidAmount : '');
        const datePaidCSV = (po.paymentData.datePaid !== 'N/A' ? po.paymentData.datePaid : '');
        po.filteredInvoices.forEach(inv => {
            const row = [po.poNumber, po.site, `"${(po.vendor || '').replace(/"/g, '""')}"`, po.poDetails.Amount || '0', totalPaidCSV, datePaidCSV, inv.invEntryID || '', `"${(inv.invNumber || '').replace(/"/g, '""')}"`, inv.invoiceDate || '', inv.invValue || '0', inv.amountPaid || '0', `"${(inv.invName || '').replace(/"/g, '""')}"`, `"${(inv.srvName || '').replace(/"/g, '""')}"`, inv.attention || '', inv.releaseDate || '', inv.status || '', `"${(inv.note || '').replace(/"/g, '""')}"`];
            csvContent += row.join(",") + "\r\n";
        });
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "invoice_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// ==========================================================================
// 18. INVOICE MANAGEMENT: BATCH ENTRY (Clean & Refactored Card Layout)
// ==========================================================================

// --------------------------------------------------------------------------
// SECTION A: UI HELPER FUNCTIONS (Dropdowns & Counters)
// --------------------------------------------------------------------------


// #endregion BLOCK 19 — PRINT REPORTS + CSV DOWNLOADS

// Explicitly preserve legacy global access used by existing event wiring / inline handlers.
try {
    window.handleGeneratePrintReport = handleGeneratePrintReport;
    window.handleDownloadCSV = handleDownloadCSV;
} catch (_) { /* ignore */ }
