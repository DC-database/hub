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



function markInvoiceReportDataDirty(reason = '') {
    try {
        window.__imInvoiceReportingDirty = true;
        window.__imInvoiceReportingDirtyReason = reason || 'Invoice data changed';
    } catch (_) {}
}

function getInvoiceReportingSearchTermForRefresh() {
    try {
        const searchInput = document.getElementById('im-reporting-search');
        const fromInput = searchInput ? String(searchInput.value || '').trim() : '';
        if (fromInput) return fromInput;
        return String(sessionStorage.getItem('imReportingSearch') || '').trim();
    } catch (_) {
        return '';
    }
}

async function refreshInvoiceReportDataBeforeCsvIfNeeded() {
    // 9.8.9: CSV export must not use stale currentReportData after Batch Entry
    // global updates. Refresh only when the system knows invoice records changed.
    if (!window.__imInvoiceReportingDirty) return;

    const previousButtonText = (() => {
        try {
            const btn = document.getElementById('download-csv-btn') || document.getElementById('downloadCSVBtn');
            if (btn) {
                const oldText = btn.textContent;
                btn.textContent = 'Refreshing...';
                btn.disabled = true;
                return { btn, oldText };
            }
        } catch (_) {}
        return null;
    })();

    try {
        if (typeof ensureInvoiceDataFetched === 'function') {
            await ensureInvoiceDataFetched(true);
        }
        if (typeof populateInvoiceReporting === 'function') {
            await populateInvoiceReporting(getInvoiceReportingSearchTermForRefresh(), { silent: true });
        }
        window.__imInvoiceReportingDirty = false;
        window.__imInvoiceReportingDirtyReason = '';
    } finally {
        if (previousButtonText && previousButtonText.btn) {
            previousButtonText.btn.textContent = previousButtonText.oldText;
            previousButtonText.btn.disabled = false;
        }
    }
}

function imCsvText(value) {
    const s = String(value == null ? '' : value).replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return `"${s}"`;
}

function imCsvNormalizeStatus(value) {
    return String(value == null ? '' : value).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function imCsvStatusMatches(currentStatus, selectedStatus) {
    const selected = imCsvNormalizeStatus(selectedStatus);
    if (!selected) return true;
    // Exact normalized match only. This prevents Report Approved from matching Report,
    // and SRV Done from matching For SRV, while tolerating accidental case/spacing.
    return imCsvNormalizeStatus(currentStatus) === selected;
}

function imCsvGetPoDetails(poNumber) {
    try {
        return (allPOData && allPOData[poNumber]) ? allPOData[poNumber] : {};
    } catch (_) {
        return {};
    }
}

function imCsvGetPoSite(poNumber, inv) {
    const poDetails = imCsvGetPoDetails(poNumber);
    return String(
        poDetails['Project ID'] || poDetails['Project ID:'] ||
        inv.site_name || inv.siteName || inv.site ||
        inv.projectId || inv.project_id || 'N/A'
    ).trim() || 'N/A';
}

function imCsvGetPoVendor(poNumber, inv) {
    const poDetails = imCsvGetPoDetails(poNumber);
    return String(
        poDetails['Supplier Name'] || poDetails['Supplier Name:'] || poDetails.Supplier ||
        inv.vendor_name || inv.vendorName || inv.vendor ||
        inv.supplierName || inv.supplier_name || 'N/A'
    ).trim() || 'N/A';
}

function imCsvDateFilterMatches(inv, monthFilter, yearFilter) {
    if (!monthFilter && !yearFilter) return true;
    const rDate = String(inv.releaseDate || inv.invoiceDate || '').trim();
    if (!rDate) return false;
    const normalized = (typeof normalizeDateForInput === 'function') ? normalizeDateForInput(rDate) : rDate;
    const parts = String(normalized || '').split('-');
    if (parts.length < 2) return false;
    const rYear = parts[0];
    const rMonth = parts[1];
    if (monthFilter && rMonth !== monthFilter) return false;
    if (yearFilter && rYear !== yearFilter) return false;
    return true;
}

function imCsvSearchMatches(poNumber, vendor, inv, searchTerm) {
    const q = String(searchTerm || '').trim().toLowerCase();
    if (!q) return true;
    return String(poNumber || '').toLowerCase().includes(q) ||
        String(vendor || '').toLowerCase().includes(q) ||
        String(inv.invNumber || '').toLowerCase().includes(q) ||
        String(inv.note || '').toLowerCase().includes(q);
}

function buildFreshInvoiceRowsForCsv() {
    const siteFilter = String(document.getElementById('im-reporting-site-filter')?.value || '').trim();
    const monthFilter = String(document.getElementById('im-reporting-month-filter')?.value || '').trim();
    const yearFilter = String(document.getElementById('im-reporting-year-filter')?.value || '').trim();
    const statusFilter = String(document.getElementById('im-reporting-status-filter')?.value || '').trim();
    const searchTerm = getInvoiceReportingSearchTermForRefresh();

    if (!statusFilter || statusFilter === 'Negative Balance') return null;
    if (!allInvoiceData) return [];

    const rows = [];
    Object.entries(allInvoiceData || {}).forEach(([poNumber, invoicesByKey]) => {
        if (!invoicesByKey || typeof invoicesByKey !== 'object') return;
        const poDetails = imCsvGetPoDetails(poNumber);
        Object.entries(invoicesByKey).forEach(([key, rawInv]) => {
            const inv = rawInv || {};
            if (!imCsvStatusMatches(inv.status, statusFilter)) return;

            const site = imCsvGetPoSite(poNumber, inv);
            if (siteFilter && site.toLowerCase() !== siteFilter.toLowerCase()) return;
            if (!imCsvDateFilterMatches(inv, monthFilter, yearFilter)) return;

            const vendor = imCsvGetPoVendor(poNumber, inv);
            if (!imCsvSearchMatches(poNumber, vendor, inv, searchTerm)) return;

            rows.push({
                poNumber,
                key,
                site,
                vendor,
                poDetails,
                inv: { key, ...inv }
            });
        });
    });

    rows.sort((a, b) => {
        const poCompare = String(a.poNumber || '').localeCompare(String(b.poNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
        if (poCompare) return poCompare;
        const da = String(a.inv.invoiceDate || a.inv.releaseDate || '9999-12-31');
        const db = String(b.inv.invoiceDate || b.inv.releaseDate || '9999-12-31');
        return da.localeCompare(db) || String(a.inv.invNumber || '').localeCompare(String(b.inv.invNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
    });

    return rows;
}

function downloadInvoiceCsvRows(rows, filename = 'invoice_report.csv') {
    const headers = ["PO", "Site", "Vendor", "PO Value", "Total Paid Amount", "Last Paid Date", "invEntryID", "invNumber", "invoiceDate", "invValue", "amountPaid", "invName", "srvName", "attention", "releaseDate", "status", "note"];
    const csvLines = [headers.join(',')];

    rows.forEach(row => {
        const poDetails = row.poDetails || {};
        const inv = row.inv || {};
        const values = [
            row.poNumber,
            row.site,
            row.vendor,
            poDetails.Amount || '0',
            '',
            '',
            inv.invEntryID || '',
            inv.invNumber || '',
            inv.invoiceDate || '',
            inv.invValue || '0',
            inv.amountPaid || '0',
            inv.invName || '',
            inv.srvName || '',
            inv.attention || '',
            inv.releaseDate || '',
            inv.status || '',
            inv.note || ''
        ];
        csvLines.push(values.map(imCsvText).join(','));
    });

    const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
}

async function handleDownloadCSV() {
    const isSuperAdmin = ((currentApprover?.Name || '').trim().toLowerCase() === SUPER_ADMIN_NAME.toLowerCase());
    const isSuperAdminDelegate = isVacationDelegateUser();
    if (!(isSuperAdmin || isSuperAdminDelegate)) {
        alert("You do not have permission to download this report.");
        return;
    }

    try {
        // 9.9.0: CSV export always refreshes invoice_entries first when a status filter is selected.
        // This avoids old currentReportData and exports directly from the current Firebase invoice_entries source.
        if (typeof ensureInvoiceDataFetched === 'function') {
            await ensureInvoiceDataFetched(true);
        }

        const freshRows = buildFreshInvoiceRowsForCsv();
        if (Array.isArray(freshRows)) {
            if (freshRows.length === 0) {
                alert("No data to download for the selected status/filter.");
                return;
            }
            downloadInvoiceCsvRows(freshRows, 'invoice_report.csv');
            try {
                window.__imInvoiceReportingDirty = false;
                window.__imInvoiceReportingDirtyReason = '';
            } catch (_) {}
            return;
        }

        await refreshInvoiceReportDataBeforeCsvIfNeeded();
    } catch (error) {
        console.error('CSV refresh failed:', error);
        alert('Could not refresh the latest invoice data for CSV. Please try again.');
        return;
    }

    if (currentReportData.length === 0) {
        alert("No data to download. Please perform a search first.");
        return;
    }

    const rows = [];
    currentReportData.forEach(po => {
        po.filteredInvoices.forEach(inv => {
            rows.push({
                poNumber: po.poNumber,
                site: po.site,
                vendor: po.vendor,
                poDetails: po.poDetails || {},
                inv
            });
        });
    });

    if (rows.length === 0) {
        alert("No data to download. Please perform a search first.");
        return;
    }
    downloadInvoiceCsvRows(rows, 'invoice_report.csv');
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
    window.markInvoiceReportDataDirty = markInvoiceReportDataDirty;
    window.refreshInvoiceReportDataBeforeCsvIfNeeded = refreshInvoiceReportDataBeforeCsvIfNeeded;
} catch (_) { /* ignore */ }
