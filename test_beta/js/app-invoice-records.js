/* ==========================================================================
   js/app-invoice-records.js
   Invoice Management reporting / records renderer.
   Version: 8.1.7

   Cleanup Phase:
   - Moved the Invoice Reporting / Invoice Records display renderer out of app.js.
   - Public function names and existing behavior are preserved.
   - No invoice save/update/delete logic, batch save logic, payment save logic,
     Firebase write paths, or inventory stock logic changed.
   ========================================================================== */

// --- DATE FORMATTER ---
function formatToDDMMMYY(dateStr) {
    if (!dateStr) return '---';
    const d = new Date(normalizeDateForInput(dateStr) + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}


// --- CORE REPORTING LOGIC ---

// #endregion BLOCK 17 — INVOICE TASK LOOKUP + INVOICE ENTRY MODAL


// =================================================================================================
// #region BLOCK 18 — INVOICE REPORTING, RECORDS, DEEP LINKS + SHARING
// Purpose: Invoice records/reporting, printout generation, totals, deep links, WhatsApp approval sharing.
// =================================================================================================


// 7.5.0 — mobile invoice records card helpers moved to js/app-mobile.js
// populateInvoiceReporting remains in app.js; the mobile renderer is loaded before app.js.

async function populateInvoiceReporting(searchTerm = '', options = {}) {
    const openCard = document.querySelector('#im-reporting-content .invoice-card.expanded');
    if (openCard) {
        imLastExpandedRowId = openCard.getAttribute('data-po-id');
    } else {
        imLastExpandedRowId = null;
    }

    sessionStorage.setItem('imReportingSearch', searchTerm);
    const silent = options && options.silent;
    const contentArea = document.getElementById('im-reporting-content');

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    
    const canViewAmounts = isAdmin || isAccounting || isVacationDelegate;
    const isAllowedUser = isAdmin || isAccounting || isVacationDelegate;
    const canPrintSticker = isAdmin && isAccounting;

    currentReportData = [];

    if (!silent) {
        contentArea.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</div>';
    }

    const siteFilter = document.getElementById('im-reporting-site-filter').value;
    const monthFilter = document.getElementById('im-reporting-month-filter').value;
    const yearFilter = document.getElementById('im-reporting-year-filter').value;
    const statusFilter = document.getElementById('im-reporting-status-filter').value;

    try {
        await ensureInvoiceDataFetched();

        const allPOs = allPOData;
        const allInvoicesByPO = allInvoiceData;
        const allEcommit = allEcommitDataProcessed;

        if (!allPOs || !allInvoicesByPO || !allEcommit) throw new Error("Data not loaded.");
        const searchText = searchTerm.toLowerCase();
        const processedPOData = [];

        const allUniquePOs = new Set([...Object.keys(allPOs), ...Object.keys(allInvoicesByPO), ...Object.keys(allEcommit)]);

        const filteredPONumbers = Array.from(allUniquePOs).filter(poNumber => {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            let hasNoteMatch = false;
            if (allInvoicesByPO[poNumber]) {
                hasNoteMatch = Object.values(allInvoicesByPO[poNumber]).some(inv => inv.note && inv.note.toLowerCase().includes(searchText));
            }

            let hasInvoiceNumberMatch = false;
            if (searchText) {
                if (allInvoicesByPO[poNumber]) {
                    hasInvoiceNumberMatch = Object.values(allInvoicesByPO[poNumber]).some(inv => {
                        const v = (inv && inv.invNumber != null) ? String(inv.invNumber) : '';
                        return v.toLowerCase().includes(searchText);
                    });
                }
                if (!hasInvoiceNumberMatch && allEcommit[poNumber]) {
                    hasInvoiceNumberMatch = (allEcommit[poNumber] || []).some(inv => {
                        const v = (inv && inv.invNumber != null) ? String(inv.invNumber) : '';
                        return v.toLowerCase().includes(searchText);
                    });
                }
            }

            const searchMatch = !searchText || poNumber.toLowerCase().includes(searchText) || vendor.toLowerCase().includes(searchText) || hasNoteMatch || hasInvoiceNumberMatch;
            const siteMatch = !siteFilter || (site.toLowerCase() === siteFilter.toLowerCase());
            return searchMatch && siteMatch;
        });

        for (const poNumber of filteredPONumbers) {
            const poDetails = allPOs[poNumber] || {};
            const site = poDetails['Project ID'] || 'N/A';
            const vendor = poDetails['Supplier Name'] || 'N/A';

            const firebaseInvoices = allInvoicesByPO[poNumber] ? Object.entries(allInvoicesByPO[poNumber]).map(([key, value]) => ({ key, ...value, source: 'firebase' })) : [];
            const firebasePackingSlips = new Set(firebaseInvoices.map(inv => String(inv.invNumber || '').trim().toLowerCase()).filter(Boolean));
            
            const ecommitInvoices = allEcommit[poNumber] || [];
            const filteredEcommitInvoices = ecommitInvoices.filter(inv => {
                const csvInvNum = String(inv.invNumber || '').trim().toLowerCase();
                return !csvInvNum || !firebasePackingSlips.has(csvInvNum);
            });

            // Check if PO is closed in POVALUE2.csv and update Ecommit status
            const isPoClosed = String(poDetails['Open']).trim().toLowerCase() === 'false';
            filteredEcommitInvoices.forEach(inv => {
                if (isPoClosed) {
                    inv.status = 'Epicor Closed';
                }
            });

            let invoices = [...firebaseInvoices, ...filteredEcommitInvoices];

            let totalInvSum = 0;
            invoices.forEach(inv => totalInvSum += parseFloat(inv.invValue) || 0);

            const poVal = parseFloat(poDetails.Amount) || 0;
            let balance = poVal - totalInvSum;
            if (poVal === 0) balance = 0;

            if (statusFilter === 'Negative Balance' && balance >= -0.01) continue;

            invoices.sort((a, b) => {
                const dateA = new Date(a.invoiceDate || '2099-01-01');
                const dateB = new Date(b.invoiceDate || '2099-01-01');
                return (dateA - dateB) || (a.invNumber || '').localeCompare(b.invNumber || '');
            });

            invoices.forEach((inv, index) => { inv.invEntryID = `INV-${String(index + 1).padStart(2, '0')}`; });

            const poMatchBySearch = !!searchText && poNumber.toLowerCase().includes(searchText);
            const vendorMatchBySearch = !!searchText && vendor.toLowerCase().includes(searchText);
            const noteMatchBySearch = !!searchText && invoices.some(i => (i.note || '').toLowerCase().includes(searchText));
            const invNumberMatchBySearch = !!searchText && invoices.some(i => String(i.invNumber || '').toLowerCase().includes(searchText));
            const restrictToInvoiceNumberMatches = !!searchText && !poMatchBySearch && !vendorMatchBySearch && !noteMatchBySearch && invNumberMatchBySearch;

            const filteredInvoices = invoices.filter(inv => {
                if (statusFilter === 'Negative Balance') {
                    if (restrictToInvoiceNumberMatches) return String(inv.invNumber || '').toLowerCase().includes(searchText);
                    return true;
                }
                
                let dateMatch = true;
                const rDate = inv.releaseDate || inv.invoiceDate || '';
                if (monthFilter || yearFilter) {
                    if (!rDate) { dateMatch = false; } 
                    else {
                        const [rYear, rMonth] = rDate.split('-');
                        if (monthFilter && rMonth !== monthFilter) dateMatch = false;
                        if (yearFilter && rYear !== yearFilter) dateMatch = false;
                    }
                }

                const statusMatch = !statusFilter || inv.status === statusFilter;
                const invNumMatch = !restrictToInvoiceNumberMatches || String(inv.invNumber || '').toLowerCase().includes(searchText);
                return dateMatch && statusMatch && invNumMatch;
            });

            if (filteredInvoices.length > 0) {
                processedPOData.push({ poNumber, poDetails, site, vendor, filteredInvoices, balance });
            }
        }

        processedPOData.sort((a, b) => a.balance - b.balance);
        currentReportData = processedPOData;

        if (document.getElementById('reporting-count-display')) {
            document.getElementById('reporting-count-display').textContent = `(Found: ${currentReportData.length})`;
        }

       if (currentReportData.length === 0) {
            if (typeof window.playSystemError === 'function') window.playSystemError();
            if (contentArea) contentArea.innerHTML = '<div class="loading-state">No records found for your search criteria.</div>';
            const sleekBar = document.getElementById('im-sleek-totals-bar');
            if (sleekBar) sleekBar.innerHTML = '<span>No records found.</span>';
            
            // Hide the Grand Total box when the table clears out
            const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
            if (grandTotalContainer) {
                grandTotalContainer.style.display = 'none';
                grandTotalContainer.innerHTML = '';
            }
            
            if (window.innerWidth <= 768 && typeof renderMobileInvoiceRecordsCards === 'function') {
                renderMobileInvoiceRecordsCards([], canViewAmounts);
            }
            return;
        }

        // GENERATE GRAND TOTALS
        let grandTotalPO = 0;
        let grandTotalInv = 0;
        currentReportData.forEach(poData => {
            grandTotalPO += (parseFloat(poData.poDetails?.Amount) || 0);
            poData.filteredInvoices.forEach(i => grandTotalInv += parseFloat(i.invValue) || 0);
        });
        let grandTotalBalance = grandTotalPO - grandTotalInv;

        const sleekBar = document.getElementById('im-sleek-totals-bar');
        if (sleekBar) {
            sleekBar.innerHTML = `
                <div><strong>${currentReportData.length}</strong> Records Found</div>
                <div>Total PO Value: <span class="highlight-val">QAR ${formatCurrency(grandTotalPO)}</span></div>
                <div>Total SRV: <span class="highlight-val">QAR ${formatCurrency(grandTotalInv)}</span></div>
                <div>Total Outstanding: <span class="outstanding-val" style="color: ${grandTotalBalance < 0 ? '#dc3545' : '#1e293b'}">QAR ${formatCurrency(grandTotalBalance)}</span></div>
            `;
        }

        // ================================================================
        // MOBILE / DESKTOP SPLIT 1
        // ================================================================
        const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);

        if (isMobile) {
            // 7.4.2: Mobile Invoice Records uses a dedicated PO card renderer.
            // Desktop table remains untouched below this mobile return.
            if (typeof renderMobileInvoiceRecordsCards === 'function') {
                renderMobileInvoiceRecordsCards(currentReportData, canViewAmounts);
            }

            // Keep the record count updated
            if (document.getElementById('reporting-count-display')) {
                document.getElementById('reporting-count-display').textContent = `(Found: ${currentReportData.length})`;
            }
            return; // <-- mobile path ends here
        }

        // ========================
        // DESKTOP RENDERING 1
        // ========================
        const desktopContent = document.getElementById('im-reporting-content');
        const mobileContainer = document.getElementById('im-reporting-mobile-view');
        if (desktopContent) desktopContent.classList.remove('hidden');
        if (mobileContainer) mobileContainer.classList.add('hidden');

        let html = '';
        currentReportData.forEach(poData => {
            let totalInvValue = 0;
            let totalPaidWithRetention = 0;
            let totalPaidWithoutRetention = 0;
            let allWithAccounts = poData.filteredInvoices.length > 0;

            let innerRows = '';
    
            poData.filteredInvoices.forEach(inv => {
                if (inv.status !== 'With Accounts') allWithAccounts = false;

                const invValue = parseFloat(inv.invValue) || 0;
                const amountPaid = parseFloat(inv.amountPaid) || 0;
                const invNoText = (inv.invNumber || '').toLowerCase();   // retention check on INV. NO.
                totalInvValue += invValue;
                totalPaidWithRetention += amountPaid;
                if (!invNoText.includes('retention')) totalPaidWithoutRetention += amountPaid;

                const releaseDateDisplay = formatToDDMMMYY(inv.releaseDate);
                const invoiceDateDisplay = formatToDDMMMYY(inv.invoiceDate);
        
                const invValueDisplay = canViewAmounts ? formatCurrency(invValue) : '---';
                const amountPaidDisplay = canViewAmounts ? formatCurrency(amountPaid) : '---';

                let actionButtonsHTML = '';
                if (inv.source !== 'ecommit' && isAllowedUser) {
                    const finalInvName = getSharePointPdfBaseName(inv.invName);
                    const finalSrvName = getSharePointPdfBaseName(inv.srvName);
                    const finalReportName = getSharePointPdfBaseName(inv.reportName);

                    const exactPdfUrl = (finalInvName && finalInvName.toLowerCase() !== 'nil') ? `${PDF_BASE_PATH}${encodeURIComponent(finalInvName)}.pdf` : '';

                    const invPDFLink = (finalInvName && finalInvName.toLowerCase() !== 'nil') ? `<a href="${exactPdfUrl}" target="_blank" class="action-btn invoice-pdf-btn" onclick="event.stopPropagation();" title="View Invoice">Inv</a>` : '';
                    const srvPDFLink = (finalSrvName && finalSrvName.toLowerCase() !== 'nil') ? `<a href="${SRV_BASE_PATH}${encodeURIComponent(finalSrvName)}.pdf" target="_blank" class="action-btn srv-pdf-btn" onclick="event.stopPropagation();" title="View SRV">SRV</a>` : '';
                    const reportViewLink = (finalReportName && finalReportName.toLowerCase() !== 'nil') ? `<a href="${REPORT_BASE_PATH}${encodeURIComponent(finalReportName)}.pdf" target="_blank" class="action-btn" style="background-color: #6f42c1; color: white;" onclick="event.stopPropagation();" title="View Report PDF">Rpt</a>` : '';

                    let historyBtn = (inv.history || inv.createdAt || inv.originTimestamp) ? `<button type="button" class="history-btn action-btn" onclick="event.stopPropagation(); showInvoiceHistory('${poData.poNumber}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>` : '';
                    let editBtn = `<button type="button" class="edit-inv-no-btn action-btn" data-po="${poData.poNumber}" data-key="${inv.key}" data-current="${inv.invNumber || ''}"><i class="fa-solid fa-pen-to-square"></i></button>`;
            
                    let printReportBtn = '';
                    if (inv.status === 'Report Approved') {
                        if (inv.reportPrinted) {
                            printReportBtn = `<button type="button" class="action-btn" style="background-color: #6c757d; color: white; cursor: not-allowed;" title="Locked"><i class="fa-solid fa-lock"></i> Locked</button>`;
                        } else {
                            printReportBtn = `<button type="button" class="action-btn" style="background-color: #00748C; color: white;" onclick="event.stopPropagation(); printFinalFinanceReport('${poData.poNumber}', '${inv.key}')" title="Print Report"><i class="fa-solid fa-print"></i> Report</button>`;
                        }
                    }

                    let stickerBtn = '';
                    if (canPrintSticker && inv.esn) {
                        stickerBtn = `<button type="button" class="action-btn" style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px;" title="Print Sticker" onclick="event.stopPropagation(); handlePrintSticker('${inv.key}', 'Invoice', '${poData.poNumber}')"><i class="fa-solid fa-qrcode"></i></button>`;
                    }

                    let waBtn = '';
                    if ((inv.status || '') === 'For Approval') {
                        waBtn = `<button type="button" class="action-btn" style="background-color:#25D366; color:#fff;" title="Send WhatsApp for Approval" onclick="event.stopPropagation(); window.imShareInvoiceForApprovalWhatsApp('${poData.poNumber}', '${inv.key}')"><i class="fa-brands fa-whatsapp"></i></button>`;
                    } else if ((inv.status || '') === 'For Inquiry') {
                        waBtn = `<button type="button" class="action-btn" style="background-color:#e2e8f0; color:#0f172a;" title="Inquire / Request Update via WhatsApp" onclick="event.stopPropagation(); window.imSendWhatsAppInquiry('${inv.invNumber || 'N/A'}', '${exactPdfUrl}')">
                            <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i><i class="fa-solid fa-question" style="font-size: 0.7em; margin-left: 2px; color: #00748C;"></i>
                        </button>`;
                    }

                    actionButtonsHTML = `<div class="modern-action-group" style="display:flex; gap:3px;">${editBtn} ${invPDFLink} ${srvPDFLink} ${reportViewLink} ${printReportBtn} ${historyBtn} ${stickerBtn} ${waBtn}</div>`;
                } else if ((inv.source || '').toLowerCase() === 'ecommit' && isAllowedUser) {
                    actionButtonsHTML = `<span style="font-size:0.8rem; color:#6f42c1; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-file-import"></i> Click to Import</span>`;
                }

                innerRows += `
                    <tr class="nested-invoice-row" 
                        data-po-number="${poData.poNumber}" 
                        data-invoice-key="${inv.key}" 
                        data-source="${inv.source}"
                        data-inv-number="${inv.invNumber || ''}" 
                        data-inv-date="${inv.invoiceDate || ''}"
                        data-release-date="${inv.releaseDate || ''}" 
                        data-inv-value="${inv.invValue || ''}"
                        title="${inv.source === 'ecommit' ? 'Click to Import' : 'Click to Edit'}"
                        style="cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: 0.2s;">
                        <td style="padding: 10px 5px; color: #64748b;">${inv.invEntryID || ''}</td>
                        <td style="padding: 10px 5px; font-weight: 700; color: #00748C;">${inv.invNumber || 'N/A'}</td>
                        <td style="padding: 10px 5px;">${invoiceDateDisplay}</td>
                        <td style="padding: 10px 5px; text-align: right; font-family: monospace; font-weight: 600; color: #334155;">${invValueDisplay}</td>
                        <td style="padding: 10px 5px; text-align: right; font-family: monospace; font-weight: 600; color: #334155;">${amountPaidDisplay}</td>
                        <td style="padding: 10px 5px;">${releaseDateDisplay}</td>
                        <td style="padding: 10px 5px;"><span class="status-badge" style="background: #e2e8f0; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #334155;">${inv.status || 'N/A'}</span></td>
                        <td style="padding: 10px 5px; color: #64748b; font-size: 12px;">${inv.note || ''}</td>
                        <td style="padding: 10px 5px;" class="actions">${actionButtonsHTML}</td>
                    </tr>
                `;
            });

            let finalTotalPaid = totalPaidWithoutRetention;
            if (Math.abs(totalPaidWithRetention - totalInvValue) < 0.01) finalTotalPaid = totalPaidWithRetention;

            const diffValue = totalInvValue - finalTotalPaid;
            const diffColor = (diffValue > 0.05) ? '#dc3545' : '#28a745'; 
    
            const diffDisplay = canViewAmounts ? `<strong>${formatCurrency(diffValue)}</strong>` : '---';
            const totalInvValueDisplay = canViewAmounts ? `<strong>${formatCurrency(totalInvValue)}</strong>` : '---';
            const totalAmountPaidDisplay = canViewAmounts ? `<strong>${formatCurrency(finalTotalPaid)}</strong>` : '---';
    
            const poValueDisplay = canViewAmounts ? (poData.poDetails.Amount ? `QAR ${formatCurrency(poData.poDetails.Amount)}` : 'N/A') : '---';
            const balanceDisplay = canViewAmounts ? `QAR ${formatCurrency(poData.balance)}` : '---';

            let highlightClass = '';
            if (canViewAmounts) {
                if (poData.balance < -0.01) highlightClass = 'highlight-negative-balance';
                else if (Math.abs(poData.balance) < 0.01) {
                    if (allWithAccounts && Math.abs(finalTotalPaid - parseFloat(poData.poDetails.Amount)) < 0.01) highlightClass = 'highlight-fully-paid';
                    else if (allWithAccounts) highlightClass = 'highlight-partial';
                } 
                else if (poData.balance > 0.01) highlightClass = 'highlight-open-balance';
            }

            const isExpanded = imLastExpandedRowId === poData.poNumber ? 'expanded' : '';

            html += `
                <div class="invoice-card ${highlightClass} ${isExpanded}" data-po-id="${poData.poNumber}" style="box-sizing: border-box; width: 100%; overflow: hidden;">
                    <div class="master-grid-row">
                        <div class="grid-cell" style="width: 40px; color:#00748C;"><i class="fa-solid fa-chevron-down"></i></div>
                        <div class="grid-cell" style="font-weight: 800;">${poData.poNumber}</div>
                        <div class="grid-cell">${poData.site}</div>
                        <div class="grid-cell">${poData.vendor}</div>
                        <div class="grid-cell" style="font-family: monospace;">${poValueDisplay}</div>
                        <div class="grid-cell" style="font-family: monospace;">${canViewAmounts ? 'QAR ' + formatCurrency(totalInvValue) : '---'}</div>
                        <div class="grid-cell" style="font-weight: 800; font-family: monospace; color: ${poData.balance < 0 ? '#ef4444' : '#1e293b'}">${balanceDisplay}</div>
                    </div>
            
                    <div class="detail-grid-row" style="padding: 15px 20px 25px 20px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; box-sizing: border-box; width: 100%;">
                        <div style="background: #fff; padding: 15px 20px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px rgba(0,0,0,0.02); box-sizing: border-box; width: 100%;">
                            <h4 style="margin: 0 0 15px 0; color: #0f172a; font-size: 15px;">Invoice Entries for PO ${poData.poNumber}</h4>
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 11px; text-transform: uppercase;">
                                        <th style="padding-bottom: 10px; padding-left: 5px;">Inv. Entry</th>
                                        <th style="padding-bottom: 10px; padding-left: 5px;">Inv. No.</th>
                                        <th style="padding-bottom: 10px; padding-left: 5px;">Inv. Date</th>
                                        <th style="padding-bottom: 10px; padding-left: 5px; text-align: right;">Inv. Value</th>
                                        <th style="padding-bottom: 10px; padding-left: 5px; text-align: right;">Amt. Paid</th>
                                        <th style="padding-bottom: 10px; padding-left: 5px;">Release Date</th>
                                        <th style="padding-bottom: 10px; padding-left: 5px;">Status</th>
                                        <th style="padding-bottom: 10px; padding-left: 5px;">Note</th>
                                        <th style="padding-bottom: 10px; padding-left: 5px;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>${innerRows}</tbody>
                                <tfoot>
                                    <tr style="border-top: 2px solid #cbd5e1; background-color: #f8fafc;">
                                        <td colspan="3" style="text-align: right; padding: 12px 5px; font-weight: 700; color: #475569;">TOTAL</td>
                                        <td style="text-align: right; font-family: monospace; padding: 12px 5px; font-weight: 800; color: #0f172a; font-size: 14px;">${totalInvValueDisplay}</td>
                                        <td style="text-align: right; font-family: monospace; padding: 12px 5px; font-weight: 800; color: #0f172a; font-size: 14px;">${totalAmountPaidDisplay}</td>
                                        <td style="color: ${diffColor}; font-family: monospace; padding: 12px 5px; font-weight: 800; font-size: 14px;">${diffDisplay}</td>
                                        <td colspan="3"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });

        contentArea.innerHTML = html;

        // POPULATE THE DEDICATED GRAND TOTAL CONTAINER
        const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
        if (grandTotalContainer) {
            if (canViewAmounts && currentReportData.length > 0) {
                grandTotalContainer.style.display = 'block';
                grandTotalContainer.style.width = '100%';
                grandTotalContainer.style.boxSizing = 'border-box';
                
                grandTotalContainer.innerHTML = `
                    <style>
                        @media (max-width: 768px) {
                            .summary-wrapper { flex-direction: column !important; align-items: flex-start !important; gap: 15px !important; padding: 15px !important; }
                            .summary-title-group { width: 100%; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; }
                            .summary-stats-group { flex-direction: column !important; width: 100%; gap: 12px !important; align-items: flex-start !important; }
                            .summary-stat-item { text-align: left !important; width: 100%; }
                        }
                    </style>

                    <div class="summary-wrapper" style="background: linear-gradient(to right, #003A5C, #00748C); border-radius: 12px; box-shadow: 0 8px 20px rgba(0, 58, 92, 0.15); display: flex; justify-content: space-between; align-items: center; padding: 22px 30px; margin-top: 25px; margin-bottom: 30px; width: 100%; box-sizing: border-box; color: white;">
                        
                        <div class="summary-title-group" style="display: flex; align-items: center; gap: 15px;">
                            <i class="fa-solid fa-calculator" style="font-size: 26px; color: #bae6fd;"></i>
                            <span style="font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">Search Results Summary</span>
                        </div>
                        
                        <div class="summary-stats-group" style="display: flex; gap: 40px; align-items: center;">
                            
                            <div class="summary-stat-item" style="display: flex; flex-direction: column; text-align: right; gap: 5px;">
                                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #e0f2fe; letter-spacing: 0.5px;">Total PO Value</span>
                                <span style="font-size: 16px; font-weight: 800; font-family: monospace;">QAR ${formatCurrency(grandTotalPO)}</span>
                            </div>
                            
                            <div class="summary-stat-item" style="display: flex; flex-direction: column; text-align: right; gap: 5px;">
                                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #e0f2fe; letter-spacing: 0.5px;">Total SRV</span>
                                <span style="font-size: 16px; font-weight: 800; font-family: monospace;">QAR ${formatCurrency(grandTotalInv)}</span>
                            </div>
                            
                            <div class="summary-stat-item" style="display: flex; flex-direction: column; text-align: right; gap: 5px;">
                                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #ffffff; letter-spacing: 0.5px;">Total Outstanding Balance</span>
                                <span style="font-size: 18px; font-weight: 900; font-family: monospace; color: #fde047;">QAR ${formatCurrency(grandTotalBalance)}</span>
                            </div>
                            
                        </div>
                    </div>
                `;
            } else {
                grandTotalContainer.style.display = 'none';
                grandTotalContainer.innerHTML = '';
            }
        }

       } catch (error) {
        console.error("Error generating report:", error);
        contentArea.innerHTML = '<div class="loading-state">Error loading report. Please try again.</div>';
    }
}

   	
// --- FORCE EXTERNAL LINK FOR FINANCIAL REPORT ---
document.addEventListener('click', function(e) {
    // Check if the clicked element is our Financial Report link
    const financeLink = e.target.closest('#im-finance-report-nav-link');
    
    if (financeLink) {
        // Stop the app's internal navigation from blocking this click
        e.stopPropagation(); 
        
        // The browser will now follow the href="https://ibaport.site/Epicore/" naturally
        console.log("Navigating to Epicore external site...");
    }
}, true); // The 'true' here makes this run BEFORE the app's other scripts



// --- PRINTING LOGIC (PROFESSIONAL GITHUB STYLE WITH FORCED COLORS & CORRECT LABELS) ---
window.generateGithubStylePrintout = function(isDetailed) {
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    if (!isAdmin && !isAccounting) {
        if (typeof window.playSystemError === 'function') window.playSystemError();
        return alert("Permission denied to print financial data.");
    }

    if (!currentReportData || currentReportData.length === 0) {
        if (typeof window.playSystemError === 'function') window.playSystemError();
        return alert("No records to print. Please search first.");
    }

    const formatForPrint = (dateStr) => {
        if (!dateStr) return '---';
        const d = new Date(normalizeDateForInput(dateStr) + 'T00:00:00');
        if (isNaN(d)) return dateStr;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    };

    let totalPOAmt = 0;
    let totalInvAmt = 0;

let rowsHtml = '';
currentReportData.forEach(poData => {
    const poVal = poData.poAmount || parseFloat(poData.poDetails?.Amount) || 0;
    totalPOAmt += poVal;
    
    let invVal = 0;
    let poTotalPaid = 0;
    poData.filteredInvoices.forEach(i => {
        invVal += parseFloat(i.invValue) || 0;
        // ONLY add to paid total if INV. NO. does NOT contain "retention"
        const invNoPrint = (i.invNumber || '').toLowerCase();
        if (!invNoPrint.includes('retention')) {
            poTotalPaid += parseFloat(i.amountPaid) || 0;
        }
    });
    totalInvAmt += invVal;

    let balance = poVal - invVal;

    if (isDetailed) {
            let invRows = poData.filteredInvoices.map(inv => `
                <tr class="detail-row">
                    <td style="color: #64748b;">${inv.invEntryID || '---'}</td>
                    <td><span style="color: #00748C; font-weight: 600;">${inv.invNumber || 'N/A'}</span></td>
                    <td>${formatForPrint(inv.invoiceDate)}</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 600;">${formatCurrency(inv.invValue)}</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 600;">${formatCurrency(inv.amountPaid)}</td>
                    <td>${formatForPrint(inv.releaseDate)}</td>
                    <td><span class="status-badge" style="background-color: #e2e8f0; color: #334155;">${inv.status || 'Pending'}</span></td>
                    <td style="color: #64748b; font-size: 11px;">${inv.note || '---'}</td>
                </tr>
            `).join('');

            // HERE ARE THE UPDATED LABELS YOU REQUESTED:
            let poSubtotalRow = `
                <tr class="detail-row" style="background-color: #f1f5f9;">
                    <td colspan="3" style="text-align: right; font-weight: 800; color: #475569; font-size: 11px; text-transform: uppercase;">Total Invoice Value:</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 800; color: #0f172a;">${formatCurrency(invVal)}</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 800; color: #0f172a;">${formatCurrency(poTotalPaid)}</td>
                    <td colspan="2" style="text-align: right; font-weight: 800; color: #475569; font-size: 11px; text-transform: uppercase;">Balance Payment:</td>
                    <td class="right-align" style="font-family: monospace; font-weight: 800; color: ${balance < 0 ? '#dc3545' : '#0f172a'};">${formatCurrency(balance)}</td>
                </tr>
            `;

            rowsHtml += `
                <tr class="master-row">
                    <td colspan="7">
                        <strong style="color: #003A5C; font-size: 13px;">PO: ${poData.poNumber}</strong> &nbsp;|&nbsp; 
                        Vendor: ${poData.vendor} &nbsp;|&nbsp; 
                        Site: ${poData.site}
                    </td>
                    <td class="right-align" style="font-family: monospace; color: #003A5C; font-size: 13px; font-weight: bold;">${formatCurrency(poVal)}</td>
                </tr>
                ${invRows}
                ${poSubtotalRow}
            `;
        } else {
            rowsHtml += `
                <tr class="master-row">
                    <td>${poData.poNumber}</td>
                    <td>${poData.vendor}</td>
                    <td>${poData.site}</td>
                    <td class="right-align" style="font-family: monospace;">${formatCurrency(poVal)}</td>
                    <td class="right-align" style="font-family: monospace;">${formatCurrency(invVal)}</td>
                    <td class="right-align" style="font-family: monospace; color: ${balance < 0 ? '#dc3545' : 'inherit'}">${formatCurrency(balance)}</td>
                </tr>
            `;
        }
    });

    const headerHTML = isDetailed 
        ? `<tr><th>Inv. Entry</th><th>Inv. No.</th><th>Inv. Date</th><th class="right-align">Inv. Value</th><th class="right-align">Amt. Paid</th><th>Release Date</th><th>Status</th><th>Note</th></tr>`
        : `<tr><th>PO Number</th><th>Vendor</th><th>Site</th><th class="right-align">PO Value (QAR)</th><th class="right-align">Total Inv (QAR)</th><th class="right-align">Balance (QAR)</th></tr>`;

    let totalBalance = totalPOAmt - totalInvAmt;

    const printHtml = `
        <!DOCTYPE html>
        <html><head><title>Invoice Records Report</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #1e293b; margin: 0; background: #fff;}
            .print-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #003A5C; padding-bottom: 12px; margin-bottom: 25px; }
            .print-header h2 { margin: 0; color: #003A5C; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .print-header p { margin: 0; color: #64748b; font-size: 13px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f8fafc; color: #475569; padding: 12px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; text-align: left; }
            td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; font-size: 12px; }
            .master-row td { background-color: #f1f5f9; font-weight: 700; color: #0f172a; border-top: 2px solid #cbd5e1; }
            .detail-row td { color: #334155; }
            .status-badge { font-size: 10px; padding: 3px 6px; border-radius: 12px; font-weight: 600; white-space: nowrap; }
            .right-align { text-align: right; }
            
            @media print { 
                body { padding: 0; } 
                * { 
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important; 
                    color-adjust: exact !important; 
                }
            }
        </style>
        </head><body>
            <div class="print-header">
                <h2>${isDetailed ? 'Detailed Report: POs & Invoices' : 'Summary Report: POs & Invoices'}</h2>
                <p>Generated on: ${new Date().toLocaleString()} &nbsp; | &nbsp; Records: ${currentReportData.length}</p>
            </div>
            <table>
                <thead>${headerHTML}</thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            
            <div class="print-summary-box" style="display: flex; justify-content: flex-end; margin-top: 25px; page-break-inside: avoid;">
                <div style="display: flex; gap: 20px; align-items: center; border: 2px solid #003A5C; border-radius: 8px; padding: 10px 20px; background-color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: #475569; font-weight: 800; text-transform: uppercase;">Grand Total PO Value:</span>
                        <span style="font-size: 14px; color: #0f172a; font-family: monospace; font-weight: 800;">QAR ${formatCurrency(totalPOAmt)}</span>
                    </div>
                    <div style="width: 2px; background: #cbd5e1; height: 16px;"></div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: #475569; font-weight: 800; text-transform: uppercase;">Grand Total SRV:</span>
                        <span style="font-size: 14px; color: #0f172a; font-family: monospace; font-weight: 800;">QAR ${formatCurrency(totalInvAmt)}</span>
                    </div>
                    <div style="width: 2px; background: #cbd5e1; height: 16px;"></div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: #003A5C; font-weight: 800; text-transform: uppercase;">Total Outstanding:</span>
                        <span style="font-size: 15px; color: #003A5C; font-family: monospace; font-weight: 800;">QAR ${formatCurrency(totalBalance)}</span>
                    </div>
                </div>
            </div>

        </body></html>
    `;

    const modal = document.getElementById('im-print-preview-modal');
    const iframe = document.getElementById('im-print-preview-iframe');
    
    if (modal && iframe) {
        modal.classList.remove('hidden');
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(printHtml);
        doc.close();
    } else {
        const win = window.open('', '_blank');
        win.document.write(printHtml);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    }
};

// --- FORCE GRAND TOTAL BOX TO HIDE ON CLEAR ---
document.addEventListener("DOMContentLoaded", () => {
    const myClearBtn = document.getElementById("clearAllBtn");
    
    if (myClearBtn) {
        myClearBtn.addEventListener("click", () => {
            const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
            if (grandTotalContainer) {
                grandTotalContainer.style.display = 'none';
                grandTotalContainer.innerHTML = '';
            }
        });
    }
});

// ==========================================================================
// 7.6.1: Invoice Records Totals Footer moved to js/app-invoice.js.
// ==========================================================================


// ==========================================================================
// 17. INVOICE MANAGEMENT: REPORTING ACTIONS
// ==========================================================================


// #endregion BLOCK 18 — INVOICE REPORTING, RECORDS, DEEP LINKS + SHARING


// =================================================================================================
// #region BLOCK 19 — PRINT REPORTS + CSV DOWNLOADS
// Moved to js/app-reporting-actions.js in v8.1.2 (cleanup only).
// Public functions preserved:
// - window.handleGeneratePrintReport
// - window.handleDownloadCSV
// =================================================================================================
// #endregion BLOCK 19 — PRINT REPORTS + CSV DOWNLOADS


// =================================================================================================
// #region BLOCK 20 — BATCH ENTRY + SUMMARY NOTES
// Purpose: Batch row attention picker, add PO/invoice to batch, batch global search, save batch invoices, note dropdowns, summary generation/update.
// =================================================================================================

