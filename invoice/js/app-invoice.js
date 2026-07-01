/* ==========================================================================
   js/app-invoice.js
   IBA Invoice Management helpers
   Version: 8.0.2

   Cleanup Phase 2:
   - Invoice Records professional preview/print helpers moved out of app.js.
   - Function names and window exports are preserved for backward compatibility.
   - No Firebase paths, invoice data logic, or UI behavior changed.
   ========================================================================== */



// =========================================================
// INVOICE TASK ACTIVITY HELPER (INBOX SYNC)
// =========================================================
// This helper is used by app.js when saving invoice/batch entries and when
// cleaning invoice active-task inboxes. Keep it global for backward
// compatibility with the existing non-module script loading.
function isInvoiceTaskActive(invoiceData) {
    if (!invoiceData) return false;

    const status = String(invoiceData.status || invoiceData.remarks || '').trim();
    const normalized = status.toLowerCase();

    // These statuses should not create/keep personal invoice task inbox items.
    // 9.8.6: On Hold remains an active waiting queue, so it must stay indexed
    // for WorkDesk Dashboard / Active Task status tabs.
    const inactiveStatuses = new Set([
        'under review',
        'with accounts',
        'srv done',
        'paid',
        'closed',
        'cancelled',
        'canceled',
        'completed'
    ]);

    if (!status) return false;
    return !inactiveStatuses.has(normalized);
}

window.isInvoiceTaskActive = isInvoiceTaskActive;


// =========================================================
// INVOICE RECORDS TOTALS FOOTER / EMPTY STATE HELPER
// =========================================================
// Used by app.js when Invoice Records search/clear returns no rows.
// Keep this global because the legacy app.js still calls it directly.
function imUpdateInvoiceRecordsTotals(reportData) {
    const data = Array.isArray(reportData) ? reportData : [];
    const sleekBar = document.getElementById('im-sleek-totals-bar');
    const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');

    if (!data.length) {
        if (sleekBar) sleekBar.innerHTML = '<span>No records found.</span>';
        if (grandTotalContainer) {
            grandTotalContainer.style.display = 'none';
            grandTotalContainer.innerHTML = '';
        }
        return;
    }

    let grandTotalPO = 0;
    let grandTotalInv = 0;
    data.forEach(poData => {
        grandTotalPO += parseFloat(poData?.poDetails?.Amount) || 0;
        (poData?.filteredInvoices || []).forEach(inv => {
            grandTotalInv += parseFloat(inv?.invValue) || 0;
        });
    });
    const grandTotalBalance = grandTotalPO - grandTotalInv;
    const money = (typeof formatCurrency === 'function')
        ? formatCurrency
        : (value) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (sleekBar) {
        sleekBar.innerHTML = `
            <div><strong>${data.length}</strong> Records Found</div>
            <div>Total PO Value: <span class="highlight-val">QAR ${money(grandTotalPO)}</span></div>
            <div>Total SRV: <span class="highlight-val">QAR ${money(grandTotalInv)}</span></div>
            <div>Total Outstanding: <span class="outstanding-val" style="color: ${grandTotalBalance < 0 ? '#dc3545' : '#1e293b'}">QAR ${money(grandTotalBalance)}</span></div>
        `;
    }

    // The main report renderer builds the full grand-total card itself.
    // This helper only guarantees the container is visible/hidden safely.
    if (grandTotalContainer && !grandTotalContainer.innerHTML.trim()) {
        grandTotalContainer.style.display = 'none';
    }
}

window.imUpdateInvoiceRecordsTotals = imUpdateInvoiceRecordsTotals;

// =========================================================
// INVOICE RECORDS: PROFESSIONAL PREVIEW & PRINT (IM-REPORTING)
// =========================================================

/**
 * Keeps the report markup + CSS in one place so the Preview and Print output are identical.
 * This ONLY affects the Invoice Records print preview/modal flow.
 */
const IM_INVOICE_REPORT_PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: Arial, sans-serif; font-size: 11px; }

  .im-invoice-report { width: 100%; }
  .im-invoice-report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    gap: 16px;
  }
  .im-invoice-report-company {
    font-size: 14pt;
    font-weight: 800;
    margin: 0;
    line-height: 1.15;
  }
  .im-invoice-report-title { text-align: right; }
  .im-invoice-report-title h2 { font-size: 18pt; margin: 0 0 4px 0; }
  .im-invoice-report-title p { font-size: 10pt; margin: 0; color: #333; }

  .im-invoice-report-summary {
    margin: 16px 0 18px;
    background: #eef3f6;
    border: 1px solid #cfd8e3;
    border-radius: 6px;
    padding: 12px 12px 14px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .im-invoice-report-summary h3 {
    margin: 0 0 12px 0;
    text-align: center;
    font-size: 12pt;
    border-bottom: 1px solid #c8d2de;
    padding-bottom: 8px;
  }
  .im-invoice-report-summary-grid {
    display: flex;
    justify-content: space-around;
    gap: 12px;
    align-items: center;
  }
  .im-invoice-report-summary-item { flex: 1; text-align: center; }
  .im-invoice-report-summary-item span { display: block; font-size: 10pt; color: #222; margin-bottom: 4px; }
  .im-invoice-report-summary-item strong { display: block; font-size: 14pt; }

  .im-invoice-po {
    border: 1px solid #b5b5b5;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 14px;
    page-break-inside: auto;
  }
  .im-invoice-po-header {
    background: #003A5C;
    color: #fff;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 1fr 1fr 1.6fr;
    grid-template-rows: auto auto;
    gap: 6px 18px;
    font-size: 10pt;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .im-invoice-po-header .poValue { text-align: right; }
  .im-invoice-po-header .vendor { grid-column: 1 / span 2; }
  .im-invoice-po-header .balance { text-align: right; }

  table.im-invoice-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  table.im-invoice-table thead { display: table-header-group; }
  table.im-invoice-table tfoot { display: table-footer-group; }
  table.im-invoice-table th,
  table.im-invoice-table td {
    border: 1px solid #cfcfcf;
    padding: 6px 6px;
    vertical-align: top;
  }
  table.im-invoice-table th {
    background: #e9ecef;
    font-weight: 800;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  table.im-invoice-table tbody tr:nth-child(even) td {
    background: #f9f9f9;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  table.im-invoice-table td.num,
  table.im-invoice-table th.num {
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    white-space: nowrap;
  }
  table.im-invoice-table td.date,
  table.im-invoice-table td.status { white-space: nowrap; }
  table.im-invoice-table td.note { word-break: break-word; }
  table.im-invoice-table tr { page-break-inside: avoid; }

  table.im-invoice-table tfoot td {
    border-top: 2px solid #000;
    font-weight: 800;
    background: #fff;
  }
  table.im-invoice-table tfoot td.label { text-align: right; }

  /* Safety: make sure UI controls never appear in print */
  button, input, select, .expand-btn, .action-btn { display: none !important; }
`;

const IM_INVOICE_REPORT_PREVIEW_CSS = `
  /* Scoped to the preview container so it never affects the rest of the app */
  #im-print-modal-body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
  #im-print-modal-body .im-invoice-report { width: 100%; }
  #im-print-modal-body .im-invoice-report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    gap: 16px;
  }
  #im-print-modal-body .im-invoice-report-company {
    font-size: 14pt;
    font-weight: 800;
    margin: 0;
    line-height: 1.15;
  }
  #im-print-modal-body .im-invoice-report-title { text-align: right; }
  #im-print-modal-body .im-invoice-report-title h2 { font-size: 18pt; margin: 0 0 4px 0; }
  #im-print-modal-body .im-invoice-report-title p { font-size: 10pt; margin: 0; color: #333; }

  #im-print-modal-body .im-invoice-report-summary {
    margin: 16px 0 18px;
    background: #eef3f6;
    border: 1px solid #cfd8e3;
    border-radius: 6px;
    padding: 12px 12px 14px;
  }
  #im-print-modal-body .im-invoice-report-summary h3 {
    margin: 0 0 12px 0;
    text-align: center;
    font-size: 12pt;
    border-bottom: 1px solid #c8d2de;
    padding-bottom: 8px;
  }
  #im-print-modal-body .im-invoice-report-summary-grid {
    display: flex;
    justify-content: space-around;
    gap: 12px;
    align-items: center;
  }
  #im-print-modal-body .im-invoice-report-summary-item { flex: 1; text-align: center; }
  #im-print-modal-body .im-invoice-report-summary-item span { display: block; font-size: 10pt; color: #222; margin-bottom: 4px; }
  #im-print-modal-body .im-invoice-report-summary-item strong { display: block; font-size: 14pt; }

  #im-print-modal-body .im-invoice-po {
    border: 1px solid #b5b5b5;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 14px;
  }
  #im-print-modal-body .im-invoice-po-header {
    background: #003A5C;
    color: #fff;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 1fr 1fr 1.6fr;
    grid-template-rows: auto auto;
    gap: 6px 18px;
    font-size: 10pt;
  }
  #im-print-modal-body .im-invoice-po-header .poValue { text-align: right; }
  #im-print-modal-body .im-invoice-po-header .vendor { grid-column: 1 / span 2; }
  #im-print-modal-body .im-invoice-po-header .balance { text-align: right; }

  #im-print-modal-body table.im-invoice-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  #im-print-modal-body table.im-invoice-table th,
  #im-print-modal-body table.im-invoice-table td {
    border: 1px solid #cfcfcf;
    padding: 6px 6px;
    vertical-align: top;
  }
  #im-print-modal-body table.im-invoice-table th {
    background: #e9ecef;
    font-weight: 800;
  }
  #im-print-modal-body table.im-invoice-table tbody tr:nth-child(even) td { background: #f9f9f9; }
  #im-print-modal-body table.im-invoice-table td.num,
  #im-print-modal-body table.im-invoice-table th.num {
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    white-space: nowrap;
  }
  #im-print-modal-body table.im-invoice-table td.date,
  #im-print-modal-body table.im-invoice-table td.status { white-space: nowrap; }
  #im-print-modal-body table.im-invoice-table td.note { word-break: break-word; }

  #im-print-modal-body table.im-invoice-table tfoot td {
    border-top: 2px solid #000;
    font-weight: 800;
    background: #fff;
  }
  #im-print-modal-body table.im-invoice-table tfoot td.label { text-align: right; }
`;

// Cache the last generated report so "Print Now" always prints what the user previewed.
window.__imInvoiceReportCache = window.__imInvoiceReportCache || { css: IM_INVOICE_REPORT_PRINT_CSS, html: '' };

function imEscapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function imGetInvoiceReportTitle() {
    // Match the legacy format used in the older PDF sample.
    return 'Invoice Records';
}

function imBuildInvoiceRecordsReportMarkup(reportData, { title, generatedOn } = {}) {
    const safeTitle = imEscapeHtml(title || 'Invoice Records');
    const generatedStr = imEscapeHtml(generatedOn || `Generated on: ${new Date().toLocaleString('en-GB')}`);

    // Totals (match the sample layout: PO Value vs Invoice Value => Balance)
    let totalPOs = reportData.length;
    let totalPOValue = 0;
    let totalInvoiceValue = 0;

    reportData.forEach(po => {
        totalPOValue += parseFloat(po?.poDetails?.Amount) || 0;
        (po?.filteredInvoices || []).forEach(inv => {
            totalInvoiceValue += parseFloat(inv?.invValue) || 0;
        });
    });

    const totalBalance = totalPOValue - totalInvoiceValue;

    let poBlocks = '';
    reportData.forEach(po => {
        const poNumber = imEscapeHtml(po?.poNumber || '');
        const site = imEscapeHtml(po?.site || '');
        const vendor = imEscapeHtml(po?.vendor || '');
        const poValueNum = parseFloat(po?.poDetails?.Amount) || 0;

        let poInvTotal = 0;
        let poPaidTotal = 0;

        let rows = '';
        (po?.filteredInvoices || []).forEach(inv => {
            const invEntry = imEscapeHtml(inv?.invEntryID || '');
            const invNo = imEscapeHtml(inv?.invNumber || '');
            const invValueNum = parseFloat(inv?.invValue) || 0;
            const amtPaidNum = parseFloat(inv?.amountPaid) || 0;
            const status = imEscapeHtml(inv?.status || '');
            const note = imEscapeHtml(inv?.note || '');

            poInvTotal += invValueNum;
            poPaidTotal += amtPaidNum;

            const releaseDateDisplay = inv?.releaseDate
                ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB')
                : '';
            const invoiceDateDisplay = inv?.invoiceDate
                ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB')
                : '';

            rows += `
              <tr>
                <td>${invEntry}</td>
                <td>${invNo}</td>
                <td class="date">${invoiceDateDisplay}</td>
                <td class="num">${formatCurrency(invValueNum)}</td>
                <td class="num">${formatCurrency(amtPaidNum)}</td>
                <td class="date">${releaseDateDisplay}</td>
                <td class="status">${status}</td>
                <td class="note">${note}</td>
              </tr>
            `;
});

        let balanceNum = poValueNum - poInvTotal;
        if (poValueNum === 0) {
            balanceNum = 0;
        }

        poBlocks += `
            <div class="im-invoice-po">



            <div class="im-invoice-po-header">
              <div class="poNumber"><strong>PO:</strong> ${poNumber}</div>
              <div class="site"><strong>Site:</strong> ${site}</div>
              <div class="poValue"><strong>PO Value:</strong> QAR ${formatCurrency(poValueNum)}</div>

              <div class="vendor"><strong>Vendor:</strong> ${vendor}</div>
              <div class="balance"><strong>Balance:</strong> QAR ${formatCurrency(balanceNum)}</div>
            </div>

            <table class="im-invoice-table">
              <thead>
                <tr>
                  <th>Inv. Entry</th>
                  <th>Inv. No.</th>
                  <th class="date">Inv. Date</th>
                  <th class="num">Inv. Value</th>
                  <th class="num">Amt. Paid</th>
                  <th class="date">Release Date</th>
                  <th class="status">Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" class="label">PO Invoice Totals:</td>
                  <td class="num">${formatCurrency(poInvTotal)}</td>
                  <td class="num">${formatCurrency(poPaidTotal)}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
    });

    return `
      <div class="im-invoice-report">
        <div class="im-invoice-report-header">
          <h1 class="im-invoice-report-company">ISMAIL BIN ALI TRADING &amp; CONT. CO. W.L.L</h1>
          <div class="im-invoice-report-title">
            <h2>${safeTitle}</h2>
            <p>${generatedStr}</p>
          </div>
        </div>

        <div class="im-invoice-report-summary">
          <h3>Report Summary</h3>
          <div class="im-invoice-report-summary-grid">
            <div class="im-invoice-report-summary-item">
              <span>Total POs in Report</span>
              <strong>${totalPOs}</strong>
            </div>
            <div class="im-invoice-report-summary-item">
              <span>Total PO Value</span>
              <strong>QAR ${formatCurrency(totalPOValue)}</strong>
            </div>
            <div class="im-invoice-report-summary-item">
              <span>Total Balance</span>
              <strong>QAR ${formatCurrency(totalBalance)}</strong>
            </div>
          </div>
        </div>

        ${poBlocks}
      </div>
    `;
}

// 1) OPEN PREVIEW (Professional report preview in the modal)
window.openInvoicePrintPreview = function() {
    const modal = document.getElementById('im-invoice-print-modal');
    if (!modal) { alert('Error: Print Modal not found in HTML.'); return; }

    // Keep the existing "blank page" fix (modal must live under <body>)
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    if (!Array.isArray(currentReportData) || currentReportData.length === 0) {
        alert('No data to preview. Please run a search first.');
        return;
    }

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    if (!isAdmin && !isAccounting) {
        alert('You do not have permission to print this report.');
        return;
    }

    const modalBody = document.getElementById('im-print-modal-body');
    if (!modalBody) { alert('Error: Print modal body not found.'); return; }

    const title = imGetInvoiceReportTitle();
    const generatedOn = `Generated on: ${new Date().toLocaleString('en-GB')}`;

    const reportMarkup = imBuildInvoiceRecordsReportMarkup(currentReportData, { title, generatedOn });

    // Cache for Print Now
    window.__imInvoiceReportCache.html = reportMarkup;

    // Render preview (include styles so preview matches the printed output)
    modalBody.innerHTML = `<style>${IM_INVOICE_REPORT_PREVIEW_CSS}</style>${reportMarkup}`;

    modal.classList.remove('hidden');
};

// 2) PRINT NOW (Print exactly what is previewed, in an isolated iframe)
window.imPrintInvoiceList = function() {
    if (!window.__imInvoiceReportCache?.html) {
        // If user clicks Print without previewing, generate preview first (no UX change).
        if (typeof window.openInvoicePrintPreview === 'function') {
            window.openInvoicePrintPreview();
        }
        if (!window.__imInvoiceReportCache?.html) return;
    }

    const printDoc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice Records</title>
  <style>${window.__imInvoiceReportCache.css || IM_INVOICE_REPORT_PRINT_CSS}</style>
</head>
<body>
  ${window.__imInvoiceReportCache.html}
</body>
</html>`;

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(printDoc);
    doc.close();

    // Ensure layout is ready before printing.
    setTimeout(() => {
        try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } finally {
            setTimeout(() => {
                if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
            }, 800);
        }
    }, 150);
};



/* ==========================================================================
   Cleanup Phase 7 — Delete Invoice + Smart Sync Stubs
   Moved from app.js in v8.0.2.
   Function names and legacy window exports are preserved.
   No Firebase paths, delete logic, or invoice data behavior changed.
   ========================================================================== */

// =================================================================================================
// #region BLOCK 29 — DELETE INVOICE + RECENT SYNC STUBS + INVOICE RECORDS PRINT PREVIEW
// Purpose: Delete invoice handler, disabled live-sync stubs, professional invoice records preview and print.
// =================================================================================================

// ==========================================
// [NEW] DELETE INVOICE HANDLER (UI-INSTANT + SAFE CACHE CLEANUP)
// ==========================================
const imDeleteInvoiceBtn = document.getElementById('im-delete-invoice-btn');
if (imDeleteInvoiceBtn) {
    imDeleteInvoiceBtn.addEventListener('click', async () => {
        if (!currentPO || !currentlyEditingInvoiceKey) {
            alert("Error: No invoice selected to delete.");
            return;
        }

        // --- SECURITY UPDATE: Strict check for "Irwin" ---
        if (currentApprover?.Name !== 'Irwin') {
            alert("Access Denied: Only the original Administrator (Irwin) can delete invoices.");
            return;
        }
        // ------------------------------------------------

        if (!confirm("⚠️ ARE YOU SURE?\n\nThis will permanently delete this invoice entry.\nThis action cannot be undone.")) {
            return;
        }

        const keyToDelete = currentlyEditingInvoiceKey;
        const invoiceToDelete =
            (currentPOInvoices && currentPOInvoices[keyToDelete]) ||
            (allInvoiceData && allInvoiceData[currentPO] && allInvoiceData[currentPO][keyToDelete]) ||
            null;

        try {
            // 1) Delete from main invoice entries
            await invoiceDb.ref(`invoice_entries/${currentPO}/${keyToDelete}`).remove();

            // 2) Remove from task lookups (if it was assigned anywhere)
            try {
                if (typeof removeInvoiceTaskFromUser === 'function' && invoiceToDelete) {
                    await removeInvoiceTaskFromUser(keyToDelete, invoiceToDelete);
                }
            } catch (taskErr) {
                console.warn("Invoice deleted but task lookup cleanup failed:", taskErr);
            }

            // 3) Local cache + UI cleanup so it disappears immediately (no manual refresh needed)
            removeFromLocalInvoiceCache(currentPO, keyToDelete);
            try { if (currentPOInvoices && currentPOInvoices[keyToDelete]) delete currentPOInvoices[keyToDelete]; } catch (_) { /* ignore */ }

            // Keep navigation list consistent
            try {
                if (Array.isArray(imNavigationList)) {
                    imNavigationList = imNavigationList.filter(k => k !== keyToDelete);
                    if (imNavigationIndex >= imNavigationList.length) imNavigationIndex = imNavigationList.length - 1;
                }
            } catch (_) { /* ignore */ }

            alert("Invoice deleted successfully.");

            // Close modal
            const modal = document.getElementById('im-new-invoice-modal');
            if (modal) modal.classList.add('hidden');

            // Refresh table from memory (already updated)
            fetchAndDisplayInvoices(currentPO);

            // Reset global variable
            currentlyEditingInvoiceKey = null;

        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete invoice. Please try again.");
        }
    });
}

// ==========================================================================
// SMART SYNC / SMART REFRESH REMOVED
// - Buttons removed from UI.
// - Background listeners removed.
// - These stubs remain only to avoid runtime errors in older flows.
// ==========================================================================

// No-op: older code paths may still call this.
async function logRecentUpdate(_poNumber) { return; }

// No-op: kept for backward compatibility (UI button removed).
window.refreshRecentData = async function(_hoursBack = 4, _options = {}) {
    return { changed: false, updatedPOs: [], removed: true };
};

// No-op: background smart sync removed.
window.startInvoiceSmartLiveSync = function startInvoiceSmartLiveSync() { return; };
window.stopInvoiceSmartLiveSync = function stopInvoiceSmartLiveSync() { return; };




// =========================================================
// INVOICE RECORDS: PROFESSIONAL PREVIEW & PRINT (IM-REPORTING)
// Moved to js/app-invoice.js in v7.9.5 to reduce app.js size.
// Public functions preserved:
// - window.openInvoicePrintPreview
// - window.imPrintInvoiceList
// =========================================================

// #endregion BLOCK 29 — DELETE INVOICE + RECENT SYNC STUBS + INVOICE RECORDS PRINT PREVIEW