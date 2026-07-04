// ==========================================================================
// IBA APP 8.2.2 - Invoice Entry Search / Modal / Form Loader
// Moved from app.js without changing logic.
// ==========================================================================

function resetInvoiceForm() {
    // 1. --- AUTO-GENERATE NEXT ID ---
    // Instead of keeping the current value, we calculate the next sequence number fresh.
    let nextId = "INV-01"; // Default start
    
    if (typeof currentPO !== 'undefined' && currentPO && 
        typeof allInvoiceData !== 'undefined' && allInvoiceData && 
        allInvoiceData[currentPO]) {
        
        let maxNum = 0;
        const invoices = Object.values(allInvoiceData[currentPO]);
        
        invoices.forEach(inv => {
            if (inv.invEntryID) {
                // Extract number from "INV-XX"
                const num = parseInt(inv.invEntryID.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        // Generate next number (e.g., 40) and pad with zero if needed (01, 02.. 10)
        nextId = `INV-${String(maxNum + 1).padStart(2, '0')}`;
    }
    // -------------------------------

    // 2. Reset form
    imNewInvoiceForm.reset();
    
    // 3. Set the fresh ID and Dates
    imInvEntryIdInput.value = nextId; // <--- The correct new ID (e.g. INV-40)
    imReleaseDateInput.value = getTodayDateString();
    imInvoiceDateInput.value = getTodayDateString();

    // 4. Smart Filter Reset (Default to "For SRV")
    if (imAttentionSelectChoices) {
        imAttentionSelectChoices.clearInput();
        imAttentionSelectChoices.removeActiveItems();
        
        const defaultStatus = document.getElementById('im-status').value;
        let currentSite = null;
        if (typeof currentPO !== 'undefined' && currentPO && typeof allPOData !== 'undefined' && allPOData && allPOData[currentPO]) {
            currentSite = allPOData[currentPO]['Project ID'];
        }
        populateAttentionDropdown(imAttentionSelectChoices, defaultStatus, currentSite, true);
    }

    // 5. Navigation Logic (Show "New")
    const navControls = document.getElementById('im-nav-controls');
    const navCounter = document.getElementById('im-nav-counter');
    const btnPrev = document.getElementById('im-nav-prev');
    const btnNext = document.getElementById('im-nav-next');

    if (navControls) {
        if (typeof imNavigationList !== 'undefined' && imNavigationList.length > 0) {
            navControls.classList.remove('hidden');
            imNavigationIndex = imNavigationList.length;
            navCounter.textContent = `New`; // Indicator
            
            btnPrev.disabled = false;
            btnPrev.style.opacity = '1';

            btnNext.disabled = true;
            btnNext.style.opacity = '0.5';
        } else {
            navControls.classList.add('hidden');
            imNavigationIndex = -1;
        }
    }

    currentlyEditingInvoiceKey = null;
    imFormTitle.textContent = 'Add New Invoice for this PO';
    imAddInvoiceButton.classList.remove('hidden');
    imUpdateInvoiceButton.classList.add('hidden');

    // [NEW] HIDE DELETE BUTTON ON NEW ENTRY
    const delBtn = document.getElementById('im-delete-invoice-btn'); 
    if(delBtn) delBtn.classList.add('hidden');

    // 6. Apply Visual Highlights
    const inputs = imNewInvoiceForm.querySelectorAll('.input-required-highlight');
    inputs.forEach(el => el.classList.remove('input-required-highlight'));

    const mandatoryIds = ['im-inv-no', 'im-inv-value', 'im-invoice-date', 'im-status'];
    mandatoryIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('input-required-highlight');
    });

    const attnSelect = document.getElementById('im-attention');
    if (attnSelect) {
        const choicesInner = attnSelect.closest('.choices')?.querySelector('.choices__inner');
        if (choicesInner) {
            choicesInner.classList.add('input-required-highlight');
        }
    }
}

function ensureIMInvoiceEntryModalIsGlobal() {
    const modal = document.getElementById('im-invoice-entry-modal');
    if (!modal) return null;

    // 8.0.9: Keep the Invoice Entry popup out of the Invoice Entry card/section.
    // This makes it behave like the Batch Entry Search PO modal: centered and
    // draggable against the full browser viewport, including over the side menu.
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }
    modal.dataset.imGlobalModal = '1';
    return modal;
}

function resetIMInvoiceEntryModalPosition() {
    const modal = ensureIMInvoiceEntryModalIsGlobal();
    const container = modal?.querySelector('.modal-container');
    if (!container) return;

    container.classList.remove('im-user-positioned');
    container.style.removeProperty('--im-modal-left');
    container.style.removeProperty('--im-modal-top');
    container.style.removeProperty('--im-modal-width');
    container.style.transform = 'none';
}

function keepIMInvoiceEntryModalInsideViewport() {
    const modal = ensureIMInvoiceEntryModalIsGlobal();
    if (!modal) return;

    const container = modal.querySelector('.modal-container');
    const content = modal.querySelector('.modal-content');

    // Reset any previous scroll state so the modal header/close button is always reachable.
    requestAnimationFrame(() => {
        modal.scrollTop = 0;
        if (container) container.scrollTop = 0;
        if (content) content.scrollTop = 0;

        // If the user previously dragged the modal and the viewport changed,
        // keep the saved position inside the visible screen.
        if (container && container.classList.contains('im-user-positioned')) {
            clampIMInvoiceEntryModalPosition();
        }
    });
}

function clampIMInvoiceEntryModalPosition() {
    const modal = ensureIMInvoiceEntryModalIsGlobal();
    const container = modal?.querySelector('.modal-container');
    if (!modal || !container || !container.classList.contains('im-user-positioned')) return;

    const rect = container.getBoundingClientRect();
    const gap = 8;
    // 8.7.8: allow the Invoice Entry popup to slide over the left menu or the
    // right active-jobs panel while keeping a safe grab area visible onscreen.
    const visibleGrip = Math.min(260, Math.max(180, rect.width * 0.22));
    const minLeft = Math.min(gap, -(rect.width - visibleGrip));
    const maxLeft = Math.max(gap, window.innerWidth - visibleGrip);
    const minTop = gap;
    const maxTop = Math.max(gap, window.innerHeight - 76);
    const currentLeft = parseFloat(container.style.getPropertyValue('--im-modal-left')) || rect.left;
    const currentTop = parseFloat(container.style.getPropertyValue('--im-modal-top')) || rect.top;
    const nextLeft = Math.min(Math.max(currentLeft, minLeft), maxLeft);
    const nextTop = Math.min(Math.max(currentTop, minTop), maxTop);

    container.style.setProperty('--im-modal-left', `${nextLeft}px`);
    container.style.setProperty('--im-modal-top', `${nextTop}px`);
}

function initIMInvoiceEntryModalDrag() {
    const modal = ensureIMInvoiceEntryModalIsGlobal();
    const container = modal?.querySelector('.modal-container');
    const header = modal?.querySelector('.modal-header');
    if (!modal || !container || !header || header.dataset.imDragReady === '1') return;

    header.dataset.imDragReady = '1';
    header.classList.add('im-modal-drag-handle');
    modal.classList.add('im-draggable-modal');

    header.addEventListener('pointerdown', (e) => {
        // Keep header buttons/close/navigation clickable; drag only from blank/header/title area.
        if (e.target.closest('button, a, input, select, textarea, .modal-close-btn')) return;
        if (e.button !== undefined && e.button !== 0) return;

        const rect = container.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = rect.left;
        const startTop = rect.top;
        const gap = 8;

        container.classList.add('im-user-positioned');
        container.style.setProperty('--im-modal-left', `${startLeft}px`);
        container.style.setProperty('--im-modal-top', `${startTop}px`);
        container.style.setProperty('--im-modal-width', `${rect.width}px`);
        document.body.classList.add('im-modal-is-dragging');

        try { header.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();

        const onMove = (moveEvent) => {
            // 8.7.8: do not trap the popup inside the Invoice Entry card/container.
            // Keep enough of the header visible so the user can always drag it back.
            const visibleGrip = Math.min(260, Math.max(180, rect.width * 0.22));
            const minLeft = Math.min(gap, -(rect.width - visibleGrip));
            const maxLeft = Math.max(gap, window.innerWidth - visibleGrip);
            const minTop = gap;
            const maxTop = Math.max(gap, window.innerHeight - 76);
            const nextLeft = Math.min(Math.max(startLeft + (moveEvent.clientX - startX), minLeft), maxLeft);
            const nextTop = Math.min(Math.max(startTop + (moveEvent.clientY - startY), minTop), maxTop);
            container.style.setProperty('--im-modal-left', `${nextLeft}px`);
            container.style.setProperty('--im-modal-top', `${nextTop}px`);
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
            document.body.classList.remove('im-modal-is-dragging');
            try { header.releasePointerCapture(e.pointerId); } catch (_) {}
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
    });
}

function openIMInvoiceEntryModal() {
    const modal = ensureIMInvoiceEntryModalIsGlobal() || imInvoiceEntryModal;
    if (modal) {
        const wasHidden = modal.classList.contains('hidden');
        if (wasHidden) resetIMInvoiceEntryModalPosition();
        modal.classList.remove('hidden');
        initIMInvoiceEntryModalDrag();
        keepIMInvoiceEntryModalInsideViewport();
    }
}

function closeIMInvoiceEntryModal() {
    const modal = document.getElementById('im-invoice-entry-modal') || imInvoiceEntryModal;
    if (modal) {
        modal.classList.add('hidden');
    }
}

window.addEventListener('resize', () => {
    clampIMInvoiceEntryModalPosition();
});

// =========================================================
// SEARCH PO HANDLER (FIXED: Uses Smart Fetcher)
// =========================================================
async function handlePOSearch(poNumberFromInput) {
    const poNumber = (poNumberFromInput || imPOSearchInput.value || imPOSearchInputBottom.value).trim().toUpperCase();

    if (!poNumber) {
        alert('Please enter a PO Number.');
        return;
    }

    sessionStorage.setItem('imPOSearch', poNumber);
    if (imPOSearchInput) imPOSearchInput.value = poNumber;
    if (imPOSearchInputBottom) imPOSearchInputBottom.value = poNumber;

    try {
        // --- THE FIX IS HERE ---
        // Old: await ensureAllEntriesFetched();  <-- This only checked CSV
        // New: await ensureInvoiceDataFetched(); <-- This checks CSV + Firebase DB
        if (!allPOData) await ensureInvoiceDataFetched(); 
        // -----------------------

        let poData = allPOData[poNumber];

        // Fallback: If not found in memory, force a DB check for this specific PO
        // (Just in case the list is huge and didn't load completely)
        if (!poData) {
        const snap = await invoiceDb.ref(`purchase_orders/${poNumber}`).once('value');
        if (snap.exists()) {
            poData = snap.val();
            allPOData[poNumber] = poData; // Save to memory
            window.playSystemSuccess();   // <--- FOUND IN FIREBASE (SUCCESS)
        } else {
            window.playSystemError();     // <--- NOT FOUND IN FIREBASE (ERROR)
        }
    } else {
        window.playSystemSuccess();       // <--- ALREADY FOUND IN CACHE (SUCCESS)
    }
        // If STILL not found, show Manual Entry Modal
        if (!poData) {
            const manualPONoEl = document.getElementById('manual-po-number');
            const manualSupplierIdEl = document.getElementById('manual-supplier-id');
            const manualVendorNameEl = document.getElementById('manual-vendor-name');
            const manualPOAmountEl = document.getElementById('manual-po-amount');

            if (manualPONoEl) manualPONoEl.value = poNumber;
            if (manualSupplierIdEl) manualSupplierIdEl.value = '';
            if (manualVendorNameEl) manualVendorNameEl.value = '';
            if (manualPOAmountEl) manualPOAmountEl.value = '';

            // Ensure vendor list is available for name suggestions (Manual PO)
            try {
                if (typeof ensureVendorsDataFetchedForJobEntry === 'function') {
                    const emptyVendors = (typeof allVendorsData === 'undefined' || !allVendorsData || !Object.keys(allVendorsData).length);
                    if (emptyVendors) {
                        try { await ensureVendorsDataFetchedForJobEntry(false); } catch (_) {}
                    }
                }
                if (typeof buildJobVendorDatalistIfNeeded === 'function') {
                    try { buildJobVendorDatalistIfNeeded(); } catch (_) {}
                }
                if (typeof buildManualVendorDatalistIfNeeded === 'function') {
                    try { buildManualVendorDatalistIfNeeded(); } catch (_) {}
                }
            } catch (_) {}

            // -------------------------------------------------------------
            // SMART PREFILL (from WorkDesk -> Invoice Job Entry)
            // If this PO search is coming from a Job Entry (Invoice), reuse
            // the Vendor + Vendor ID + Site that were already captured there.
            // This reduces Manual PO to mainly entering the PO Value.
            // -------------------------------------------------------------
            let __prefillSite = '';
            try {
                const pending = (typeof pendingJobEntryDataForInvoice !== 'undefined') ? pendingJobEntryDataForInvoice : null;
                const pendingPO = pending ? String(pending.po || '').trim().toUpperCase() : '';
                if (pending && pendingPO && pendingPO === String(poNumber || '').trim().toUpperCase()) {
                    // Ensure vendor map is available so we can resolve Name <-> ID
                    if (typeof ensureVendorsDataFetchedForJobEntry === 'function') {
                        try { await ensureVendorsDataFetchedForJobEntry(false); } catch(_){}
                    }
                    if (typeof buildJobVendorDatalistIfNeeded === 'function') {
                        try { buildJobVendorDatalistIfNeeded(); } catch(_){}
                    }

                    let vName = String(pending.vendorName || '').trim();
                    let vId = String(pending.vendorId || '').trim();

                    // Fill missing side if possible
                    if (vId && (!vName || vName === 'N/A') && typeof allVendorsData !== 'undefined' && allVendorsData && allVendorsData[vId]) {
                        vName = String(allVendorsData[vId] || '').trim();
                    }
                    if (vName && !vId && typeof getVendorIdByName === 'function') {
                        const idByName = getVendorIdByName(vName);
                        if (idByName) vId = String(idByName).trim();
                    }

                    if (manualSupplierIdEl && vId) manualSupplierIdEl.value = vId;
                    if (manualVendorNameEl && vName) manualVendorNameEl.value = vName;

                    __prefillSite = String(pending.site || '').trim();
                }
            } catch (e) {
                // Best-effort only
            }

            const modalSiteSelect = document.getElementById('manual-site-select');
            if (modalSiteSelect) {
                // store prefill on dataset so it survives option building
                modalSiteSelect.dataset.prefillSite = __prefillSite || '';
            }

            if (modalSiteSelect.options.length <= 1 && allSitesCSVData) {
                allSitesCSVData.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.site;
                    opt.textContent = `${s.site} - ${s.description}`;
                    modalSiteSelect.appendChild(opt);
                });
            }

            // Apply site prefill after options exist
            try {
                const pre = modalSiteSelect?.dataset?.prefillSite;
                if (pre) {
                    modalSiteSelect.value = pre;
                }
            } catch(_){}

            const manualModal = document.getElementById('im-manual-po-modal');
            if (manualModal) manualModal.classList.remove('hidden');

            // Focus PO value (most common missing piece when coming from Job Entry)
            setTimeout(() => {
                if (manualPOAmountEl) manualPOAmountEl.focus();
            }, 0);

            return; 
        }

        // Found it! Proceed.
        proceedWithPOLoading(poNumber, poData);

    } catch (error) {
        console.error("Error searching for PO:", error);
        alert('An error occurred while searching for the PO.');
    }
}

// REPLACE THE EXISTING FUNCTION WITH THIS "QUERY" VERSION
async function proceedWithPOLoading(poNumber, poData) {
    // Standard Loading Logic
    const invoicesSnapshot = await invoiceDb.ref(`invoice_entries/${poNumber}`).once('value');
    const invoicesData = invoicesSnapshot.val();
    if (!allInvoiceData) allInvoiceData = {};
    allInvoiceData[poNumber] = invoicesData || {};

    currentPO = poNumber;
    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const canViewAmounts = (isAdmin || isAccounting || isVacationDelegate);

    // Update UI Labels
    document.querySelectorAll('.im-po-no').forEach(el => el.textContent = poNumber);
    document.querySelectorAll('.im-po-site').forEach(el => el.textContent = poData['Project ID'] || 'N/A');
    document.querySelectorAll('.im-po-value').forEach(el => el.textContent = canViewAmounts ? `QAR ${formatCurrency(poData.Amount)}` : '---');
    document.querySelectorAll('.im-po-vendor').forEach(el => el.textContent = poData['Supplier Name'] || 'N/A');



// ============================================================
    // PO RECORDS SEARCH & BUTTON LOGIC
    // ============================================================
    const poRecordEl = document.querySelector('.im-po-record');
    const modalDeletionBtn = document.getElementById('im-modal-deletion-list-btn');

    const setPoRecordStatus = (status, label, iconClass) => {
        if (!poRecordEl) return;
        poRecordEl.className = `im-po-record im-po-record-status im-po-record-status-${status}`;
        poRecordEl.innerHTML = `<i class="${iconClass}"></i> <span>${escapeHtml(label)}</span>`;
    };

    if (poRecordEl) {
        setPoRecordStatus('checking', 'Checking PO file...', 'fa-solid fa-circle-notch fa-spin');

        // Remove the old inline add button and reset the modal folder action on every new PO search.
        document.getElementById('im-po-collect-btn')?.remove();
        if (modalDeletionBtn) {
            modalDeletionBtn.classList.add('hidden');
            modalDeletionBtn.classList.remove('im-po-file-action-btn--active');
            modalDeletionBtn.onclick = null;
        }

        try {
            const searchVal = poNumber.replace(/[^0-9]/g, '');
            const ref = progressDb.ref('records');

            // Perform the indexed search. This stays lightweight because it queries the PO child only.
            let snapshot = await ref.orderByChild('PO').equalTo(searchVal).once('value');
            if (!snapshot.exists()) {
                snapshot = await ref.orderByChild('PO').equalTo(parseInt(searchVal, 10)).once('value');
            }

            if (snapshot.exists()) {
                // Attention state: this PO has an original file record. Make it obvious.
                setPoRecordStatus('found', 'Original PO in File', 'fa-solid fa-folder-open');

                const collectBtn = document.createElement('button');
                collectBtn.id = 'im-po-collect-btn';
                collectBtn.type = 'button';
                collectBtn.className = 'im-po-collect-btn';
                collectBtn.title = 'Original PO is in file — add to deletion list';
                collectBtn.innerHTML = `<i class="fa-solid fa-folder-minus"></i> Add to Deletion List`;
                collectBtn.onclick = () => window.imAddToDeletionCollection(poNumber);
                poRecordEl.parentElement.appendChild(collectBtn);

                if (modalDeletionBtn) {
                    modalDeletionBtn.classList.remove('hidden');
                    modalDeletionBtn.classList.add('im-po-file-action-btn--active');
                    modalDeletionBtn.title = 'Original PO is in file — add to deletion list';
                    modalDeletionBtn.onclick = () => window.imAddToDeletionCollection(poNumber);
                }

            } else {
                setPoRecordStatus('none', 'No PO file found', 'fa-regular fa-circle');
            }
        } catch (error) {
            console.error("Query Error:", error);
            setPoRecordStatus('error', 'PO file check error', 'fa-solid fa-triangle-exclamation');
        }
    }

    // Final UI Display
    document.getElementById('im-modal-po-details')?.classList.remove('hidden');
    fetchAndDisplayInvoices(poNumber);
    document.getElementById('im-invoice-form-trigger')?.classList.remove('hidden');
}



function fetchAndDisplayInvoices(poNumber) {
    const invoicesData = allInvoiceData[poNumber];

    let maxInvIdNum = 0;
    imInvoicesTableBody.innerHTML = '';
    currentPOInvoices = invoicesData || {};

    const isAdmin = (currentApprover?.Role || '').toLowerCase() === 'admin';
    const isAccounting = (currentApprover?.Position || '').toLowerCase() === 'accounting';
    const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
    const canViewAmounts = (isAdmin || isAccounting || isVacationDelegate);

    let invoiceCount = 0;

    let totalInvValueSum = 0;
    let totalPaidWithRetention = 0;
    let totalPaidWithoutRetention = 0;

    if (invoicesData) {
        const invoices = Object.entries(invoicesData).map(([key, value]) => ({
            key,
            ...value
        }));
        invoiceCount = invoices.length;

        invoices.forEach(inv => {
            if (inv.invEntryID) {
                const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                if (!isNaN(idNum) && idNum > maxInvIdNum) {
                    maxInvIdNum = idNum;
                }
            }
        });

        // Sort Invoices
        invoices.sort((a, b) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));

        // --- NEW: CAPTURE NAVIGATION LIST ---
        imNavigationList = invoices.map(inv => inv.key);
        imNavigationIndex = -1; 
        // ------------------------------------

        invoices.forEach(inv => {

            // NEW FIXED CODE
const currentInvValue = parseFloat(String(inv.invValue).replace(/,/g, '')) || 0;
const currentAmtPaid = parseFloat(String(inv.amountPaid).replace(/,/g, '')) || 0;
const invNoText = (inv.invNumber || '').toLowerCase();  // ← CHANGED from inv.note to inv.invNumber
totalInvValueSum += currentInvValue;
totalPaidWithRetention += currentAmtPaid;

// EXCLUDE 'retention' from the running total based on INV. NO.
if (!invNoText.includes('retention')) {  // ← CHANGED variable name
    totalPaidWithoutRetention += currentAmtPaid;
}

            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.setAttribute('data-key', inv.key);

            const releaseDateDisplay = inv.releaseDate ? new Date(normalizeDateForInput(inv.releaseDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';
            const invoiceDateDisplay = inv.invoiceDate ? new Date(normalizeDateForInput(inv.invoiceDate) + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A';

            const invValueDisplay = canViewAmounts ? formatCurrency(inv.invValue) : '---';
            const amountPaidDisplay = canViewAmounts ? formatCurrency(inv.amountPaid) : '---';

            // --- Standard Invoice/SRV/Report Links (Using Base Paths) ---
            // IMPORTANT: Do not trim end spaces (they can be part of the actual SharePoint filename).
            const invPDFName = getSharePointPdfBaseName(inv.invName);
            const invPDFLink = invPDFName ?
                `<a href="${PDF_BASE_PATH}${encodeURIComponent(invPDFName)}.pdf" target="_blank" class="action-btn invoice-pdf-btn">Invoice</a>` :
                '';

            const srvPDFName = getSharePointPdfBaseName(inv.srvName);
            const srvPDFLink = srvPDFName ?
                `<a href="${SRV_BASE_PATH}${encodeURIComponent(srvPDFName)}.pdf" target="_blank" class="action-btn srv-pdf-btn">SRV</a>` :
                '';

            const reportPDFName = getSharePointPdfBaseName(inv.reportName);
            const reportPDFLink = reportPDFName ?
                `<a href="${REPORT_BASE_PATH}${encodeURIComponent(reportPDFName)}.pdf" target="_blank" class="action-btn report-pdf-btn" style="background-color: #6f42c1; color: white;" title="View Report">Report</a>` :
                '';

            // [MODIFIED] Only show history button if there is ACTUAL history
            let historyBtn = '';
            const historyCount = inv.history ? Object.keys(inv.history).length : 0;
            
            if (historyCount > 1) {
                historyBtn = `<button type="button" class="history-btn action-btn" title="View Status History" onclick="event.stopPropagation(); showInvoiceHistory('${poNumber}', '${inv.key}')"><i class="fa-solid fa-clock-rotate-left"></i></button>`;
            }

            let deleteBtnHTML = '';
            if (currentApprover.Name === 'Irwin') {
                deleteBtnHTML = `<button class="delete-btn" data-key="${inv.key}">Delete</button>`;
            }

            // ADDED ${reportPDFLink} TO THE ROW BELOW
            row.innerHTML = `
                <td>${inv.invEntryID || ''}</td>
                <td>${inv.invNumber || ''}</td>
                <td>${invoiceDateDisplay}</td>
                <td>${invValueDisplay}</td>
                <td>${amountPaidDisplay}</td>
                <td>${inv.status || ''}</td>
                <td>${releaseDateDisplay}</td>
                <td><div class="action-btn-group">${invPDFLink} ${srvPDFLink} ${reportPDFLink} ${historyBtn} ${deleteBtnHTML}</div></td>
            `;
            imInvoicesTableBody.appendChild(row);
        });
        imExistingInvoicesContainer.classList.remove('hidden');
    } else {
        // Reset navigation list if no invoices
        imNavigationList = [];
        imNavigationIndex = -1;
        
        imInvoicesTableBody.innerHTML = '<tr><td colspan="8">No invoices have been entered for this PO yet.</td></tr>';
        imExistingInvoicesContainer.classList.remove('hidden');
    }

    if (existingInvoicesCountDisplay) {
        existingInvoicesCountDisplay.textContent = `Existing Invoices (${invoiceCount})`;
    }

    const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;
    imInvEntryIdInput.value = nextInvId;
    resetInvoiceForm();
    imNewInvoiceForm.classList.remove('hidden');
    if (imInvoiceFormTrigger) imInvoiceFormTrigger.classList.remove('hidden');

    const footer = document.getElementById('im-invoices-table-footer');
    if (footer) {
        const isAdminOrAccounting = isAdmin || isAccounting || isVacationDelegate;

        let finalTotalPaid = totalPaidWithoutRetention;

        if (Math.abs(totalPaidWithRetention - totalInvValueSum) < 0.01) {
            finalTotalPaid = totalPaidWithRetention;
        }

        document.getElementById('im-invoices-total-value').textContent = isAdminOrAccounting ? formatCurrency(totalInvValueSum) : '---';
        document.getElementById('im-invoices-total-paid').textContent = isAdminOrAccounting ? formatCurrency(finalTotalPaid) : '---';

        
        footer.style.display = invoiceCount > 0 ? '' : 'none';
    }

    if (pendingJobEntryDataForInvoice) {
        if (pendingJobEntryDataForInvoice.amount) {
            imInvValueInput.value = pendingJobEntryDataForInvoice.amount;
            imAmountPaidInput.value = pendingJobEntryDataForInvoice.amount;
        }
        if (pendingJobEntryDataForInvoice.ref) {
            document.getElementById('im-inv-no').value = pendingJobEntryDataForInvoice.ref;
        }
        // Prefer the explicit Invoice Date captured in Job Entry (Invoice job)
        const __jobInvDateRaw = pendingJobEntryDataForInvoice.invoiceDate || pendingJobEntryDataForInvoice.date;
        if (__jobInvDateRaw) {
            const __s = String(__jobInvDateRaw).trim();
            // Job Entry uses <input type="date"> so it is already YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(__s)) {
                imInvoiceDateInput.value = __s;
            } else {
                imInvoiceDateInput.value = convertDisplayDateToInput(__s);
            }
        }

        // --- ADD THESE LINES TO FIX THE STATUS ---
        imStatusSelect.value = 'Under Review'; 
        imStatusSelect.dispatchEvent(new Event('change')); 
        // ----------------------------------------

        pendingJobEntryDataForInvoice = null;
    }
}

// ==========================================================================
// 14. INVOICE MANAGEMENT: SIDEBAR & ACTIVE JOBS (UPDATED: GREEN APPROVALS)
// ==========================================================================

// 10.3.4: Lightweight, on-demand loader for Invoice Entry Active Jobs.
// It reads only WorkDesk job_entries where for = "Invoice" instead of calling
// populateActiveTasks(), which can download broader WorkDesk + invoice queues.
let imActiveJobsSidebarLoaded = false;
let imActiveJobsSidebarLoading = false;
let imActiveJobsSidebarCache = [];
function imIsActiveJobsSidebarLoaded() { return !!imActiveJobsSidebarLoaded; }
window.imIsActiveJobsSidebarLoaded = imIsActiveJobsSidebarLoaded;

function imSidebarEscapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function imNormalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function imAttentionMentionsName(attentionVal, nameVal) {
    const attention = imNormalizeText(attentionVal);
    const name = imNormalizeText(nameVal);
    if (!attention || !name) return false;
    if (attention === name) return true;
    if (['all', 'site', 'accounting', 'accounts', 'finance', 'none'].includes(attention)) return false;

    const parts = attention
        .split(/\s*(?:,|;|\/|\||&|\+|->|➔|\band\b|\bor\b)\s*/i)
        .map(v => v.trim())
        .filter(Boolean);
    if (parts.includes(name)) return true;

    const nameParts = name.split(/\s+/).filter(Boolean);
    if (nameParts.length >= 2 && nameParts.every(part => attention.includes(part))) return true;

    return false;
}

function imInvoiceJobBelongsToCurrentUser(job) {
    const currentName = String(currentApprover?.Name || '').trim();
    if (!currentName) return false;

    if (imAttentionMentionsName(job.attention, currentName)) return true;

    const delegatedFromNames = (typeof getDelegatorsForReplacement === 'function')
        ? getDelegatorsForReplacement(currentName)
        : [];
    return delegatedFromNames.some(name => imAttentionMentionsName(job.attention, name));
}

function imInvoiceJobIsEntryStage(job) {
    const status = String(job.remarks || job.status || '').trim();
    const normalized = status.toLowerCase();

    // The side panel is for WorkDesk Invoice Job Entries that still need invoice entry.
    // Once converted to Under Review / For SRV / With Accounts, it belongs to the normal
    // invoice workflow and must no longer be pulled here.
    if (!normalized || normalized === 'pending' || normalized === 'new entry') return true;
    return false;
}

function imGetInvoiceJobCategory(job) {
    const raw = String(job.group || job.category || '').trim();
    if (!raw) return '';

    const lower = raw.toLowerCase();
    if (lower === 'normal') return 'Normal';
    if (lower === 'hse') return 'HSE';
    if (lower === 'logistic' || lower === 'logistics') return 'Logistic';

    // Keep old records visible as their legacy value instead of breaking them.
    return raw;
}

function setActiveJobsSidebarStandby(message) {
    if (activeJobsSidebarCountDisplay) {
        activeJobsSidebarCountDisplay.textContent = 'Active Jobs';
    }
    if (imEntrySidebarList) {
        imEntrySidebarList.innerHTML = '<li class="im-sidebar-no-jobs" style="padding:10px; text-align:center; color:#d8fae9; font-size:0.8rem;">' +
            imSidebarEscapeHTML(message || 'Click Active Jobs or search to load invoice job entries.') +
            '</li>';
    }
}
window.setActiveJobsSidebarStandby = setActiveJobsSidebarStandby;

async function fetchInvoiceEntrySidePanelJobs(forceRefresh = false) {
    if (!forceRefresh && imActiveJobsSidebarLoaded && Array.isArray(imActiveJobsSidebarCache)) {
        return imActiveJobsSidebarCache.slice();
    }

    // 10.3.9: Restore the proven working source for Invoice Entry Active Jobs.
    // The 10.3.7/10.3.8 job_entry_inbox optimization was too strict and could show
    // an empty panel even when Active Task had pending New Entry records. This loader
    // reads only WorkDesk Invoice Job Entries, not full invoice_entries, so it remains
    // lighter than the old broad Active Task loader while restoring the visible list.
    const byKey = new Map();
    const sourcePaths = ['job_entries', 'Job_Entries'];

    for (const path of sourcePaths) {
        try {
            const snap = await db.ref(path).orderByChild('for').equalTo('Invoice').once('value');
            const raw = snap.val() || {};

            Object.entries(raw).forEach(([key, value]) => {
                const job = { key, ...(value || {}), source: 'job_entry' };
                if (!imInvoiceJobIsEntryStage(job)) return;
                if (!imInvoiceJobBelongsToCurrentUser(job)) return;
                if (typeof isTaskComplete === 'function' && isTaskComplete(job)) return;

                // Prefer already-saved manual Vendor/Site fields. Do not fetch POVALUE2 here;
                // this side panel must stay limited to active WorkDesk Invoice job entries.
                if (!job.vendorName && job.po && allPOData && allPOData[job.po]) {
                    job.vendorName = allPOData[job.po]['Supplier Name'] || allPOData[job.po]['Supplier Name:'] || '';
                }

                job.group = imGetInvoiceJobCategory(job);
                job.remarks = String(job.remarks || job.status || 'New Entry').trim() || 'New Entry';
                job.status = job.remarks;
                job.jobRecordDateEntered = job.jobRecordDateEntered || job.date || '';
                job.dateEntered = job.dateEntered || job.date || '';
                byKey.set(job.key || key, job);
            });

            // Lowercase job_entries is the normal source. Uppercase is only a safety fallback.
            if (byKey.size > 0) break;
        } catch (error) {
            console.warn('Active Jobs side panel source read failed for', path, error);
        }
    }

    const jobs = Array.from(byKey.values());
    if (typeof wdActiveTaskCompareQueue === 'function') {
        jobs.sort(wdActiveTaskCompareQueue);
    } else {
        jobs.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
    }

    imActiveJobsSidebarCache = jobs;
    imActiveJobsSidebarLoaded = true;
    return jobs.slice();
}

function renderActiveJobsSidebar(invoiceJobs) {
    if (!imEntrySidebarList) return;

    if (activeJobsSidebarCountDisplay) {
        activeJobsSidebarCountDisplay.textContent = 'Active Jobs (' + invoiceJobs.length + ')';
    }

    imEntrySidebarList.innerHTML = '';

    if (invoiceJobs.length === 0) {
        imEntrySidebarList.innerHTML = '<li class="im-sidebar-no-jobs" style="padding:10px; text-align:center; color:#888; font-size:0.8rem;">No active invoice job entries.</li>';
        return;
    }

    invoiceJobs.forEach(function(job) {
        var li = document.createElement('li');
        li.className = 'im-sidebar-item';

        var status = job.remarks || job.status || 'New Entry';
        var borderColor = '#fd7e14';
        var statusTextColor = '#666';

        if (status === 'New Entry') {
            borderColor = '#dc3545';
            statusTextColor = '#dc3545';
        } else if (status === 'Pending') {
            borderColor = '#fd7e14';
            statusTextColor = '#fd7e14';
        }

        li.style.borderLeft = '4px solid ' + borderColor;

        li.dataset.po = job.po || '';
        li.dataset.key = job.key;
        li.dataset.ref = job.ref || '';
        li.dataset.amount = job.amount || '';
        li.dataset.date = job.date || '';
        li.dataset.source = job.source || 'job_entry';
        li.dataset.originalKey = job.originalKey || '';
        li.dataset.originalPO = job.originalPO || '';
        li.dataset.vendorName = job.vendorName || '';
        li.dataset.vendorId = job.vendorId || '';
        li.dataset.site = job.site || '';
        li.dataset.invoiceDate = job.invoiceDate || '';
        li.dataset.category = job.group || '';

        var vendorDisplay = (job.vendorName || 'No Vendor');
        if (vendorDisplay.length > 20) vendorDisplay = vendorDisplay.substring(0, 18) + '...';

        var category = imGetInvoiceJobCategory(job);
        var categoryChip = category
            ? `<span class="im-compact-category" style="display:inline-flex; align-items:center; border-radius:999px; padding:2px 7px; font-size:0.68rem; font-weight:800; background:#e8fff4; color:#08734f; border:1px solid rgba(8,115,79,0.18); margin-left:6px; white-space:nowrap;">${imSidebarEscapeHTML(category)}</span>`
            : '';

        var html = `
            <div class="im-compact-row">
                <span class="im-compact-po"><i class="fa-solid fa-file-invoice" style="margin-right:4px; opacity:0.7;"></i> ${imSidebarEscapeHTML(job.po || 'N/A')}</span>
                <span class="im-compact-amount">${formatCurrency(job.amount)}</span>
            </div>
            <div class="im-compact-row" style="align-items:flex-start;">
                <span class="im-compact-vendor">${imSidebarEscapeHTML(vendorDisplay)}</span>
            </div>
            <div class="im-compact-row" style="justify-content:flex-start; margin-top:3px;">
                <span class="im-compact-status" style="color: ${statusTextColor}; font-weight: bold; display:inline-flex; align-items:center; gap:4px;">${imSidebarEscapeHTML(status)}${categoryChip}</span>
            </div>
        `;

        li.innerHTML = html;
        imEntrySidebarList.appendChild(li);
    });
}

async function populateActiveJobsSidebar(forceRefresh = false) {
    if (!imEntrySidebarList) return;
    if (imActiveJobsSidebarLoading) return;

    imActiveJobsSidebarLoading = true;
    if (activeJobsSidebarCountDisplay) activeJobsSidebarCountDisplay.textContent = 'Active Jobs (loading...)';
    imEntrySidebarList.innerHTML = '<li class="im-sidebar-no-jobs" style="padding:10px; text-align:center; color:#d8fae9; font-size:0.8rem;">Loading active invoice job entries...</li>';

    try {
        const invoiceJobs = await fetchInvoiceEntrySidePanelJobs(forceRefresh);
        renderActiveJobsSidebar(invoiceJobs);
        const searchValue = String(document.getElementById('im-sidebar-search')?.value || '').trim();
        if (searchValue) filterActiveJobsSidebarItems(searchValue);
    } catch (error) {
        console.error('Active Jobs side panel failed to load:', error);
        if (activeJobsSidebarCountDisplay) activeJobsSidebarCountDisplay.textContent = 'Active Jobs';
        imEntrySidebarList.innerHTML = '<li class="im-sidebar-no-jobs" style="padding:10px; text-align:center; color:#ffdddd; font-size:0.8rem;">Could not load active jobs. Please try again.</li>';
    } finally {
        imActiveJobsSidebarLoading = false;
    }
}

function filterActiveJobsSidebarItems(termValue) {
    const term = String(termValue || '').toLowerCase().trim();
    const items = document.querySelectorAll('.im-sidebar-item');

    items.forEach(item => {
        const po = (item.dataset.po || '').toLowerCase();
        const vendor = (item.dataset.vendorName || '').toLowerCase();
        const category = (item.dataset.category || '').toLowerCase();
        const text = (item.innerText || '').toLowerCase();
        item.style.display = (!term || po.includes(term) || vendor.includes(term) || category.includes(term) || text.includes(term)) ? '' : 'none';
    });
}

// --- ACTIVE JOBS SEARCH: restore immediate working behavior ---
const sidebarSearchInput = document.getElementById('im-sidebar-search');
if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('focus', async () => {
        if (!imActiveJobsSidebarLoaded && typeof populateActiveJobsSidebar === 'function') {
            await populateActiveJobsSidebar(false);
        }
    });

    sidebarSearchInput.addEventListener('input', async (e) => {
        if (!imActiveJobsSidebarLoaded && typeof populateActiveJobsSidebar === 'function') {
            await populateActiveJobsSidebar(false);
        }
        filterActiveJobsSidebarItems(e.target.value);
    });
}

function imInvoiceEntrySectionIsVisible() {
    const section = document.getElementById('im-invoice-entry');
    if (!section) return false;
    return !section.classList.contains('hidden') && section.offsetParent !== null;
}

function imAutoLoadActiveJobsWhenInvoiceEntryVisible() {
    if (!imEntrySidebarList || imActiveJobsSidebarLoaded || imActiveJobsSidebarLoading) return;
    if (!imInvoiceEntrySectionIsVisible()) return;
    if (typeof populateActiveJobsSidebar === 'function') {
        populateActiveJobsSidebar(false);
    }
}
window.imAutoLoadActiveJobsWhenInvoiceEntryVisible = imAutoLoadActiveJobsWhenInvoiceEntryVisible;

// Load the side panel when Invoice Entry is actually opened, not on the whole app start.
// This restores the old "see it right away" behavior while avoiding unrelated page loads.
const imInvoiceEntrySectionForSidebar = document.getElementById('im-invoice-entry');
if (imInvoiceEntrySectionForSidebar && typeof MutationObserver !== 'undefined') {
    const imInvoiceEntryObserver = new MutationObserver(() => {
        setTimeout(imAutoLoadActiveJobsWhenInvoiceEntryVisible, 150);
    });
    imInvoiceEntryObserver.observe(imInvoiceEntrySectionForSidebar, { attributes: true, attributeFilter: ['class', 'style'] });
}
setTimeout(imAutoLoadActiveJobsWhenInvoiceEntryVisible, 500);
document.addEventListener('click', (event) => {
    if (event.target && event.target.closest && event.target.closest('[data-section="im-invoice-entry"], .im-nav-invoice-entry a')) {
        setTimeout(imAutoLoadActiveJobsWhenInvoiceEntryVisible, 350);
    }
});

function imInvalidateActiveJobsSidebarCache() {
    imActiveJobsSidebarLoaded = false;
    imActiveJobsSidebarCache = [];
}
window.imInvalidateActiveJobsSidebarCache = imInvalidateActiveJobsSidebarCache;

async function handleActiveJobClick(e) {
    const item = e.target.closest('.im-sidebar-item');
    if (!item) return;

    const {
        po,
        ref,
        amount,
        date,
        source,
        key,
        originalKey,
        originalPO,
        vendorName,
        vendorId,
        site,
        invoiceDate
    } = item.dataset;

    if (!po) {
        alert("This job entry is missing a PO number and cannot be processed.");
        return;
    }

    jobEntryToUpdateAfterInvoice = source === 'job_entry' ? key : null;
    pendingJobEntryDataForInvoice = {
        po,
        ref,
        amount,
        date,
        vendorName,
        vendorId,
        site,
        invoiceDate
    };

    // --- STEP 1: MEMORIZE THE RECEPTION HISTORY ---
    if (source === 'job_entry') {
        window.importedJobHistory = [
            { 
                status: "Job Created (WorkDesk)", 
                date: date || new Date().toISOString(), 
                updatedBy: "Reception" 
            }
        ];
    } else {
        window.importedJobHistory = null; // Clear if it's not a new job
    }
    // ----------------------------------------------

    // SCENARIO 1: It is an EXISTING INVOICE (This part was already working)
    if (source === 'invoice' && originalPO && originalKey) {
        jobEntryToUpdateAfterInvoice = null;
        pendingJobEntryDataForInvoice = null;

        try {
            await handlePOSearch(originalPO);
            setTimeout(() => {
                populateInvoiceFormForEditing(originalKey);
                imBackToActiveTaskButton.classList.remove('hidden');
            }, 200);
        } catch (error) {
            console.error("Error loading existing invoice task:", error);
            alert("Error loading this task. Please try searching for the PO manually.");
        }
        return;
    }

    // SCENARIO 2: It is a JOB ENTRY (e.g., "Pending")
    // [FIX APPLIED HERE]
    try {
        await handlePOSearch(po);
        imBackToActiveTaskButton.classList.remove('hidden');

        // --- Force the modal to open as a global floating popup ---
        setTimeout(() => {
            openIMInvoiceEntryModal();
        }, 150); // Small delay to allow data to populate first
        // ---------------------------------------------------------

    } catch (error) {
        console.error("Error searching for PO from active job:", error);
        alert("Error searching for PO. Please try again manually.");
    }
}

// ==========================================================================
// 15. INVOICE MANAGEMENT: CRUD OPERATIONS
// ==========================================================================

function populateInvoiceFormForEditing(invoiceKey) {
    const invData = currentPOInvoices[invoiceKey];
    if (!invData) return;

    resetInvoiceForm();
    currentlyEditingInvoiceKey = invoiceKey;

    // --- NAVIGATION UI UPDATE (Preserved) ---
    if (typeof imNavigationList !== 'undefined' && imNavigationList.length > 0) {
        imNavigationIndex = imNavigationList.indexOf(invoiceKey);
        const navControls = document.getElementById('im-nav-controls');
        const navCounter = document.getElementById('im-nav-counter');
        const btnPrev = document.getElementById('im-nav-prev');
        const btnNext = document.getElementById('im-nav-next');

        if (navControls && imNavigationIndex > -1) {
            navControls.classList.remove('hidden');
            navCounter.textContent = `${imNavigationIndex + 1} / ${imNavigationList.length}`;
            btnPrev.disabled = (imNavigationIndex === 0);
            btnPrev.style.opacity = (imNavigationIndex === 0) ? '0.5' : '1';
            btnNext.disabled = false;
            btnNext.style.opacity = '1';
            btnNext.title = (imNavigationIndex === imNavigationList.length - 1) ? "Go to New Entry" : "Next Invoice";
        }
    }
    // ----------------------------

    // Populate Fields
    imInvEntryIdInput.value = invData.invEntryID || '';
    document.getElementById('im-inv-no').value = invData.invNumber || '';
    imInvoiceDateInput.value = normalizeDateForInput(invData.invoiceDate);
    
    // FORMAT ON LOAD
    imInvValueInput.value = formatFinanceNumber(invData.invValue);
    imAmountPaidInput.value = formatFinanceNumber(invData.amountPaid || '0');

    document.getElementById('im-inv-name').value = invData.invName || '';
    document.getElementById('im-srv-name').value = invData.srvName || '';
    
    // --- ADDED: Load Report Name ---
    document.getElementById('im-report-name').value = invData.reportName || ''; 
    // -------------------------------

    document.getElementById('im-details').value = invData.details || '';
    
    imReleaseDateInput.value = normalizeDateForInput(invData.releaseDate);
    imStatusSelect.value = invData.status || 'Under Review';
    document.getElementById('im-note').value = invData.note || '';

    // Dropdown Logic
    if (imAttentionSelectChoices) {
        let currentSite = null;
        if (currentPO && allPOData && allPOData[currentPO]) {
            currentSite = allPOData[currentPO]['Project ID'];
        }
        populateAttentionDropdown(imAttentionSelectChoices, invData.status, currentSite, true).then(() => {
            if (invData.attention) {
                imAttentionSelectChoices.setChoiceByValue(invData.attention);
            }
        });
    }

    // --- PRINT REPORT BUTTON LOGIC ---
    const printBtnContainer = document.getElementById('im-invoice-print-report-container');
    const printBtn = document.getElementById('btn-invoice-entry-print-report');
    
    const reportStatuses = ['Report', 'Report Approval', 'Report Approved'];
    const showPrintBtn = reportStatuses.includes(invData.status);

    if (printBtnContainer && printBtn) {
        if (showPrintBtn) {
            printBtnContainer.classList.remove('hidden');
            // Remove old listener (clone trick)
            const newBtn = printBtn.cloneNode(true);
            printBtn.parentNode.replaceChild(newBtn, printBtn);

            // Add Click Listener
            newBtn.addEventListener('click', async () => {
                if (!currentPO) { alert("PO Data missing."); return; }
                const poData = allPOData[currentPO] || {};
                
                await generateFinanceReport({
                    poNo: currentPO,
                    poValue: poData.Amount || 0,
                    site: poData['Project ID'] || '',
                    vendor: poData['Supplier Name'] || ''
                });
                
                // IMPORTANT: Ensure the final print button knows WHICH invoice key to lock
                const finalPrintBtn = document.getElementById('im-finance-print-report-btn');
                if (finalPrintBtn) {
                    const newFinalBtn = finalPrintBtn.cloneNode(true);
                    finalPrintBtn.parentNode.replaceChild(newFinalBtn, finalPrintBtn);
                    newFinalBtn.addEventListener('click', () => {
                        window.printFinalFinanceReport(currentPO, invoiceKey);
                    });
                }

                const reportModal = document.getElementById('im-finance-report-modal');
                if (reportModal) reportModal.classList.remove('hidden');
            });
        } else {
            printBtnContainer.classList.add('hidden');
        }
    }

    imFormTitle.textContent = `Editing Invoice: ${invData.invEntryID}`;
    imAddInvoiceButton.classList.add('hidden');
    imUpdateInvoiceButton.classList.remove('hidden');

    // [NEW] SHOW DELETE BUTTON ON EDIT
    const delBtn = document.getElementById('im-delete-invoice-btn'); 
    if(delBtn) delBtn.classList.remove('hidden');

    openIMInvoiceEntryModal();
    setTimeout(() => {
        const invNoInput = document.getElementById('im-inv-no');
        if (invNoInput) invNoInput.focus();
    }, 0);
}
