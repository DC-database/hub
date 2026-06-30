// js/app-batch-entry-ui.js
// Version 9.4.2 — Batch Entry UI/search helpers + invoice theme contrast cleanup.
// Cleanup only: public function names preserved; save/write logic remains in app.js.

function updateBatchRowAttentionButton(row) {
    if (!row) return;
    const btn = row.querySelector('.batch-attention-btn');
    if (!btn) return;

    let val = '';
    try {
        if (row.choicesInstance && typeof row.choicesInstance.getValue === 'function') {
            val = row.choicesInstance.getValue(true) || '';
        } else {
            const sel = row.querySelector('select[name="attention"]');
            val = sel ? (sel.value || '') : '';
        }
    } catch (e) {
        val = '';
    }

    const label = (!val ? 'Select Attention' : (val === 'None' ? 'None (Clear)' : val));
    btn.textContent = label;
    btn.title = (!val ? 'Select Attention' : val);
}


function setBatchRowAttentionValue(row, value, label = null) {
    if (!row) return;
    const val = (value || '').trim();
    const displayLabel = label || val;

    if (row.choicesInstance) {
        try {
            if (typeof row.choicesInstance.removeActiveItems === 'function') row.choicesInstance.removeActiveItems();
            if (!val) {
                if (typeof row.choicesInstance.setValue === 'function') row.choicesInstance.setValue([]);
            } else {
                if (typeof row.choicesInstance.setChoices === 'function') {
                    row.choicesInstance.setChoices([{ value: val, label: displayLabel }], 'value', 'label', false);
                }
                if (typeof row.choicesInstance.setValue === 'function') {
                    row.choicesInstance.setValue([val]);
                } else if (typeof row.choicesInstance.setChoiceByValue === 'function') {
                    row.choicesInstance.setChoiceByValue(val);
                }
            }
        } catch (e) {
            console.warn('Failed to set row attention via Choices, falling back to select.', e);
            const sel = row.querySelector('select[name="attention"]');
            if (sel) sel.value = val;
        }
    } else {
        const sel = row.querySelector('select[name="attention"]');
        if (sel) sel.value = val;
    }
    updateBatchRowAttentionButton(row);
}


async function openBatchAttentionPicker(row) {
    if (!imAttentionPickerModal || !imAttentionPickerSelect) return;
    imAttentionPickerActiveRow = row;

    if (!imAttentionPickerChoices) {
        imAttentionPickerChoices = new Choices(imAttentionPickerSelect, {
            searchEnabled: true, shouldSort: false, itemSelectText: '', removeItemButton: true
        });
    }

    try {
        if (typeof imAttentionPickerChoices.removeActiveItems === 'function') imAttentionPickerChoices.removeActiveItems();
        if (typeof imAttentionPickerChoices.setValue === 'function') imAttentionPickerChoices.setValue([]);
    } catch (e) {}

    const statusEl = row ? row.querySelector('select[name="status"]') : null;
    const status = statusEl ? statusEl.value : null;
    const site = row ? (row.dataset.site || null) : null;
    await populateAttentionDropdown(imAttentionPickerChoices, status, site, true);

    let currentVal = '';
    try {
        if (row && row.choicesInstance && typeof row.choicesInstance.getValue === 'function') {
            currentVal = row.choicesInstance.getValue(true) || '';
        } else {
            const sel = row ? row.querySelector('select[name="attention"]') : null;
            currentVal = sel ? (sel.value || '') : '';
        }
    } catch (e) {}

    if (currentVal) {
        try { if (typeof imAttentionPickerChoices.setValue === 'function') imAttentionPickerChoices.setValue([currentVal]); } catch (e) {}
    }

    imAttentionPickerModal.classList.remove('hidden');
    setTimeout(() => {
        const input = imAttentionPickerModal.querySelector('.choices__input--cloned');
        if (input) input.focus();
    }, 50);
}


function closeBatchAttentionPicker() {
    if (!imAttentionPickerModal) return;
    imAttentionPickerModal.classList.add('hidden');
    imAttentionPickerActiveRow = null;
}


function updateBatchCount() {
    if (batchCountDisplay) {
        // UPDATED: Now targets the new Card Divs instead of table rows
        const cards = document.getElementById('im-batch-table-body').querySelectorAll('.batch-invoice-card');
        batchCountDisplay.textContent = `Total in Batch: ${cards.length}`;
    }
}


// --------------------------------------------------------------------------
// SECTION B: ROW / CARD GENERATION LOGIC
// --------------------------------------------------------------------------

// Generates a NEW Invoice Card

async function handleAddPOToBatch() {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const poNumber = batchPOInput.value.trim().toUpperCase();
    if (!poNumber) {
        alert("Please enter a PO Number.");
        return;
    }

    sessionStorage.setItem('imBatchSearch', poNumber);
    sessionStorage.removeItem('imBatchNoteSearch');

    const batchTableBody = document.getElementById('im-batch-table-body');
    const existingRows = batchTableBody.querySelectorAll(`.batch-invoice-card[data-po="${poNumber}"]`);
    let isExistingInvoice = false;
    existingRows.forEach(row => { if (!row.dataset.key) isExistingInvoice = true; });
    
    if (isExistingInvoice) {
        alert(`A new invoice for PO ${poNumber} is already in the batch list.`);
        return;
    }

    try {
        await ensureInvoiceDataFetched();

        let poData = null;
        try {
            poData = (typeof getInvoicePurchaseOrderDetails === 'function')
                ? await getInvoicePurchaseOrderDetails(poNumber)
                : ((allPOData && allPOData[poNumber]) ? allPOData[poNumber] : null);
        } catch (_) {
            poData = (allPOData && allPOData[poNumber]) ? allPOData[poNumber] : null;
        }

        if (!poData || Object.keys(poData).length === 0) {
            alert(`PO Number ${poNumber} not found.`);
            return;
        }
        
        const invoiceData = allInvoiceData[poNumber];
        let maxInvIdNum = 0;
        if (invoiceData) {
            Object.values(invoiceData).forEach(inv => {
                if (inv.invEntryID) {
                    const idNum = parseInt(inv.invEntryID.replace('INV-', ''));
                    if (!isNaN(idNum) && idNum > maxInvIdNum) maxInvIdNum = idNum;
                }
            });
        }
        const nextInvId = `INV-${String(maxInvIdNum + 1).padStart(2, '0')}`;

        const site = normalizeNameText(poData['Project ID'] || poData['Project ID:'] || 'N/A');
        const vendor = normalizeNameText(poData['Supplier Name'] || poData['Supplier Name:'] || poData['Supplier'] || poData['Supplier:'] || 'N/A');
        
        const row = document.createElement('div');
        row.className = 'batch-invoice-card';
        row.setAttribute('data-po', poNumber);
        row.setAttribute('data-site', site);
        row.setAttribute('data-vendor', vendor);
        row.setAttribute('data-next-invid', nextInvId);

        row.innerHTML = `
            <div class="batch-card-header" style="background: linear-gradient(135deg, #073d2b 0%, #116045 68%, #1c7a59 100%) !important; border-bottom: 4px solid #d8fae9 !important; padding: 12px 15px !important; display: flex !important; flex-wrap: nowrap !important; gap: 15px !important; align-items: flex-end !important; overflow-x: auto !important; overflow-y: hidden !important;">
                
                <div title="PO Number" style="color: #ffffff !important; font-weight: 800 !important; font-size: 1.05rem !important; white-space: nowrap !important; margin-bottom: 6px !important; flex: 0 0 auto !important;">
                    <i class="fa-solid fa-hashtag"></i> ${poNumber} <span style="color: #d8fae9 !important; font-size: 0.75rem !important;">(New)</span>
                </div>

                <div title="Site" style="color: #ffffff !important; font-weight: 800 !important; font-size: 1.05rem !important; white-space: nowrap !important; margin-bottom: 6px !important; flex: 0 0 auto !important;">
                    <i class="fa-solid fa-location-dot"></i> ${site}
                </div>

                <div title="Vendor" style="color: #ffffff !important; font-weight: 800 !important; font-size: 1.05rem !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; flex: 0 1 180px !important; max-width: 250px !important; margin-bottom: 6px !important;">
                    <i class="fa-solid fa-building"></i> ${vendor}
                </div>

                <div style="display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 195px !important; min-width: 130px !important;">
                    <label style="color: white !important; font-weight: 600 !important; font-size: 0.75rem !important; display: flex !important; justify-content: space-between !important; align-items: center !important; margin: 0 !important; white-space: nowrap !important;">Inv No. 
                        <div style="display: flex !important; gap: 3px !important;">
                            <button type="button" class="btn-quick-ipc" data-po="${poNumber}" style="padding: 2px 4px !important; font-size: 8px !important; font-weight: bold !important; background: #0b4b35 !important; color: white !important; border: none !important; border-radius: 3px !important; cursor: pointer !important;">IPC</button>
                            <button type="button" class="btn-quick-five" data-po="${poNumber}" style="padding: 2px 4px !important; font-size: 8px !important; font-weight: bold !important; background: #1c7a59 !important; color: white !important; border: none !important; border-radius: 3px !important; cursor: pointer !important;">FIVE</button>
                        </div>
                    </label>
                    <input type="text" name="invNumber" class="batch-input" style="padding: 0 8px !important; border: none !important; border-radius: 4px !important; font-weight: bold !important; color: #023020 !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; height: 32px !important;">
                </div>

                <div style="display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 195px !important; min-width: 130px !important; position: relative !important;">
                    <label style="color: white !important; font-weight: 600 !important; font-size: 0.75rem !important; margin: 0 !important; white-space: nowrap !important;">Attention</label>
                    <div style="position: absolute !important; width: 0 !important; height: 0 !important; overflow: hidden !important; visibility: hidden !important;">
                        <select name="attention" class="batch-input batch-attention-select"></select>
                    </div>
                    <button type="button" class="secondary-btn batch-attention-btn" title="Select Attention" style="width: 100% !important; height: 32px !important; padding: 0 8px !important; margin: 0 !important; color: #023020 !important; background: white !important; border: none !important; border-radius: 4px !important; font-weight: bold !important; text-align: left !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; cursor: pointer !important; display: block !important;">Select Attention</button>
                </div>

                <div style="display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 195px !important; min-width: 130px !important;">
                    <label style="color: white !important; font-weight: 600 !important; font-size: 0.75rem !important; margin: 0 !important; white-space: nowrap !important;">Status</label>
                    <select name="status" class="batch-input" style="padding: 0 6px !important; border: none !important; border-radius: 4px !important; font-weight: bold !important; color: #023020 !important; width: 100% !important; margin: 0 !important; height: 32px !important; font-size: 0.85rem !important; cursor: pointer !important;">
                        <option value="For SRV">For SRV</option>
                        <option value="No Need SRV">No Need SRV</option>
                        <option value="Pending">Pending</option>
                        <option value="For IPC">For IPC</option>
                        <option value="Under Review">Under Review</option>
                        <option value="CEO Approval">CEO Approval</option>
                        <option value="Report">Report</option>
                        <option value="Report Approval">Report Approval</option>
                        <option value="Report Approved">Report Approved</option>
                        <option value="With Accounts">With Accounts</option>
                    </select>
                </div>

                <div style="display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 195px !important; min-width: 130px !important;">
                    <label style="color: white !important; font-weight: 600 !important; font-size: 0.75rem !important; margin: 0 !important; white-space: nowrap !important;">Note</label>
                    <input type="text" name="note" class="batch-input" style="padding: 0 8px !important; border: none !important; border-radius: 4px !important; font-weight: bold !important; color: #023020 !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; height: 32px !important;">
                </div>

                <div style="display: flex !important; align-items: flex-end !important; flex: 0 0 auto !important;">
                    <button type="button" class="delete-btn batch-remove-btn" title="Remove from Batch" style="background-color: #dc3545 !important; color: white !important; border: none !important; padding: 0 12px !important; border-radius: 4px !important; height: 32px !important; display: flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important;"><i class="fa-solid fa-trash"></i></button>
                </div>

            </div>

 <div class="batch-card-body" style="padding: 12px 15px !important;">
            <div class="batch-input-grid" style="display: flex !important; flex-wrap: nowrap !important; gap: 8px !important; overflow-x: auto !important; align-items: flex-start !important;">
                
                <div style="flex: 0 0 18%; min-width: 130px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Invoice Name</label><input type="text" name="invName" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;"></div>
                
                <div style="flex: 0 0 18%; min-width: 130px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">SRV Name</label><input type="text" name="srvName" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;"></div>
                
                <div style="flex: 0 0 12%; min-width: 90px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Description</label><input type="text" name="details" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;"></div>
                
                <div style="flex: 0 0 11%; min-width: 90px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Invoice Date</label><input type="date" name="invoiceDate" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 4px !important;" value="${typeof getTodayDateString === 'function' ? getTodayDateString() : new Date().toISOString().split('T')[0]}"></div>
                
                <div style="flex: 0 0 11%; min-width: 80px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Invoice Value</label><input type="text" name="invValue" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;"></div>
                
                <div style="flex: 0 0 11%; min-width: 80px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Amount Paid</label><input type="text" name="amountPaid" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;" value="0.00"></div>
                
                <div style="flex: 0 0 11%; min-width: 90px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Release Date</label><input type="date" name="releaseDate" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 4px !important;" value="${typeof getTodayDateString === 'function' ? getTodayDateString() : new Date().toISOString().split('T')[0]}"></div>
            
            </div>
        </div>
        `;
        
        batchTableBody.appendChild(row);

        const attnBtn = row.querySelector('.batch-attention-btn');
        if (attnBtn) {
            attnBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof openBatchAttentionPicker === 'function') openBatchAttentionPicker(row);
            });
        }

        const attentionSelect = row.querySelector('select[name="attention"]');
        const statusSelect = row.querySelector('select[name="status"]');
        const noteInput = row.querySelector('input[name="note"]');

        await populateApproverSelect(attentionSelect);

        const choices = new Choices(attentionSelect, {
            searchEnabled: true, shouldSort: false, itemSelectText: '', removeItemButton: true
        });
        row.choicesInstance = choices;
        await populateAttentionDropdown(choices, statusSelect.value, site, true);

        const globalAttnValue = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;
        if (globalAttnValue) choices.setValue([globalAttnValue]);

        if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
        if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;

        updateBatchRowAttentionButton(row);
        updateBatchCount();

        batchPOInput.value = '';
        batchPOInput.focus();
    } catch (error) {
        console.error("Error adding PO to batch:", error);
        alert('An error occurred while adding the PO.');
    }
}

// Generates an EXISTING Invoice Card

async function addInvoiceToBatchTable(invData) {
    const batchTableBody = document.getElementById('im-batch-table-body');
    if (batchTableBody.querySelector(`.batch-invoice-card[data-key="${invData.key}"]`)) return;

    let resolvedSite = normalizeNameText(invData.site || invData.site_name || invData.siteName || '');
    let resolvedVendor = normalizeNameText(invData.vendor || invData.vendor_name || invData.vendorName || '');
    
    const isNA = (v) => {
        const s = String(v || '').trim().toLowerCase();
        return (!s || s === 'n/a' || s === 'na' || s === 'null' || s === 'undefined');
    };

    if ((isNA(resolvedSite) || isNA(resolvedVendor)) && typeof getInvoicePurchaseOrderDetails === 'function') {
        try {
            const poDetails = await getInvoicePurchaseOrderDetails(invData.po);
            if (isNA(resolvedSite)) resolvedSite = normalizeNameText(poDetails['Project ID'] || poDetails['Project ID:'] || resolvedSite || 'N/A');
            if (isNA(resolvedVendor)) resolvedVendor = normalizeNameText(poDetails['Supplier Name'] || poDetails['Supplier Name:'] || poDetails['Supplier'] || resolvedVendor || 'N/A');
        } catch (_) {}
    }

    if (isNA(resolvedSite)) resolvedSite = 'N/A';
    if (isNA(resolvedVendor)) resolvedVendor = 'N/A';

    const row = document.createElement('div');
    row.className = 'batch-invoice-card';
    row.setAttribute('data-po', invData.po);
    row.setAttribute('data-key', invData.key);
    row.setAttribute('data-site', resolvedSite);
    row.setAttribute('data-vendor', resolvedVendor);

    row.innerHTML = `
        <div class="batch-card-header" style="background: linear-gradient(135deg, #073d2b 0%, #116045 68%, #1c7a59 100%) !important; border-bottom: 4px solid #d8fae9 !important; padding: 12px 15px !important; display: flex !important; flex-wrap: nowrap !important; gap: 15px !important; align-items: flex-end !important; overflow-x: auto !important; overflow-y: hidden !important;">
            
            <div title="PO Number" style="color: #ffffff !important; font-weight: 800 !important; font-size: 1.05rem !important; white-space: nowrap !important; margin-bottom: 6px !important; flex: 0 0 auto !important;">
                <i class="fa-solid fa-hashtag"></i> ${invData.po} <span class="existing-indicator" style="color: #d8fae9 !important; font-size: 0.75rem !important;">(Existing: ${invData.invEntryID})</span>
            </div>

            <div title="Site" style="color: #ffffff !important; font-weight: 800 !important; font-size: 1.05rem !important; white-space: nowrap !important; margin-bottom: 6px !important; flex: 0 0 auto !important;">
                <i class="fa-solid fa-location-dot"></i> ${resolvedSite}
            </div>

            <div title="Vendor" style="color: #ffffff !important; font-weight: 800 !important; font-size: 1.05rem !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; flex: 0 1 180px !important; max-width: 250px !important; margin-bottom: 6px !important;">
                <i class="fa-solid fa-building"></i> ${resolvedVendor}
            </div>
            
            <div style="display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 195px !important; min-width: 130px !important;">
                <label style="color: white !important; font-weight: 600 !important; font-size: 0.75rem !important; display: flex !important; justify-content: space-between !important; align-items: flex-end !important; margin: 0 !important; white-space: nowrap !important; height: 14px !important; line-height: 14px !important;">
                    <span>Inv No.</span>
                    <div style="display: flex !important; gap: 3px !important; height: 14px !important;">
                        <button type="button" class="btn-quick-ipc" style="height: 14px !important; line-height: 14px !important; padding: 0 4px !important; font-size: 8px !important; font-weight: bold !important; background: #0b4b35 !important; color: white !important; border: none !important; border-radius: 2px !important; cursor: pointer !important; margin: 0 !important; box-sizing: border-box !important;">IPC</button>
                        <button type="button" class="btn-quick-five" style="height: 14px !important; line-height: 14px !important; padding: 0 4px !important; font-size: 8px !important; font-weight: bold !important; background: #1c7a59 !important; color: white !important; border: none !important; border-radius: 2px !important; cursor: pointer !important; margin: 0 !important; box-sizing: border-box !important;">FIVE</button>
                    </div>
                </label>
                <input type="text" name="invNumber" class="batch-input" value="${invData.invNumber || ''}" style="padding: 0 8px !important; border: none !important; border-radius: 4px !important; font-weight: bold !important; color: #023020 !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; height: 32px !important;">
            </div>

            <div style="display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 195px !important; min-width: 130px !important; position: relative !important;">
                <label style="color: white !important; font-weight: 600 !important; font-size: 0.75rem !important; margin: 0 !important; white-space: nowrap !important;">Attention</label>
                <div style="position: absolute !important; width: 0 !important; height: 0 !important; overflow: hidden !important; visibility: hidden !important;">
                    <select name="attention" class="batch-input batch-attention-select"></select>
                </div>
                <button type="button" class="secondary-btn batch-attention-btn" title="Select Attention" style="width: 100% !important; height: 32px !important; padding: 0 8px !important; margin: 0 !important; color: #023020 !important; background: white !important; border: none !important; border-radius: 4px !important; font-weight: bold !important; text-align: left !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; cursor: pointer !important; display: block !important;">Select Attention</button>
            </div>

            <div style="display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 195px !important; min-width: 130px !important;">
                <label style="color: white !important; font-weight: 600 !important; font-size: 0.75rem !important; margin: 0 !important; white-space: nowrap !important;">Status</label>
                <select name="status" class="batch-input" style="padding: 0 6px !important; border: none !important; border-radius: 4px !important; font-weight: bold !important; color: #023020 !important; width: 100% !important; margin: 0 !important; height: 32px !important; font-size: 0.85rem !important; cursor: pointer !important;">
                    <option value="For SRV">For SRV</option>
                    <option value="No Need SRV">No Need SRV</option>
                    <option value="Pending">Pending</option>
                    <option value="For IPC">For IPC</option>
                    <option value="Under Review">Under Review</option>
                    <option value="For Approval">For Approval</option>
                    <option value="In Process">In Process</option>
                    <option value="Unresolved">Unresolved</option>
                    <option value="CEO Approval">CEO Approval</option>
                    <option value="Report">Report</option>
                    <option value="Report Approval">Report Approval</option>
                    <option value="Report Approved">Report Approved</option>
                    <option value="With Accounts">With Accounts</option>
                    <option value="On Hold">On Hold</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Original PO">Original PO</option>
                </select>
            </div>

            <div style="display: flex !important; flex-direction: column !important; gap: 4px !important; flex: 1 1 195px !important; min-width: 130px !important;">
                <label style="color: white !important; font-weight: 600 !important; font-size: 0.75rem !important; margin: 0 !important; white-space: nowrap !important;">Note</label>
                <input type="text" name="note" class="batch-input" value="${invData.note || ''}" style="padding: 0 8px !important; border: none !important; border-radius: 4px !important; font-weight: bold !important; color: #023020 !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; height: 32px !important;">
            </div>

            <div style="display: flex !important; align-items: flex-end !important; flex: 0 0 auto !important;">
                <button type="button" class="delete-btn batch-remove-btn" title="Remove from Batch" style="background-color: #dc3545 !important; color: white !important; border: none !important; padding: 0 12px !important; border-radius: 4px !important; height: 32px !important; display: flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important;"><i class="fa-solid fa-trash"></i></button>
            </div>

        </div>

<div class="batch-card-body" style="padding: 12px 15px !important;">
            <div class="batch-input-grid" style="display: flex !important; flex-wrap: nowrap !important; gap: 8px !important; overflow-x: auto !important; align-items: flex-start !important;">
                
                <div style="flex: 0 0 18%; min-width: 130px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Invoice Name</label><input type="text" name="invName" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;" value="${invData.invName || ''}"></div>
                
                <div style="flex: 0 0 18%; min-width: 130px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">SRV Name</label><input type="text" name="srvName" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;" value="${invData.srvName || ''}"></div>
                
                <div style="flex: 0 0 12%; min-width: 90px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Description</label><input type="text" name="details" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;" value="${invData.details || ''}"></div>
                
                <div style="flex: 0 0 11%; min-width: 90px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Invoice Date</label><input type="date" name="invoiceDate" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 4px !important;" value="${(typeof normalizeDateForInput === 'function' ? normalizeDateForInput(invData.invoiceDate) : invData.invoiceDate) || ''}"></div>
                
                <div style="flex: 0 0 11%; min-width: 80px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Invoice Value</label><input type="text" name="invValue" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;" value="${invData.invValue ? parseFloat(String(invData.invValue).replace(/,/g, '')).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}"></div>
                
                <div style="flex: 0 0 11%; min-width: 80px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Amount Paid</label><input type="text" name="amountPaid" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 8px !important;" value="${invData.amountPaid ? parseFloat(String(invData.amountPaid).replace(/,/g, '')).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}"></div>
                
                <div style="flex: 0 0 11%; min-width: 90px;"><label style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 0.75rem !important; white-space: nowrap !important; display: block !important; margin-bottom: 4px !important;">Release Date</label><input type="date" name="releaseDate" class="batch-input" style="width: 100% !important; height: 40px !important; box-sizing: border-box !important; padding: 0 4px !important;" value="${invData.releaseDate || (typeof getTodayDateString === 'function' ? getTodayDateString() : new Date().toISOString().split('T')[0])}"></div>
            
            </div>
        </div>
    `;

    batchTableBody.prepend(row);

    const attnBtn = row.querySelector('.batch-attention-btn');
    if (attnBtn) {
        attnBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof openBatchAttentionPicker === 'function') openBatchAttentionPicker(row);
        });
    }

    const attentionSelect = row.querySelector('select[name="attention"]');
    const statusSelect = row.querySelector('select[name="status"]');
    const noteInput = row.querySelector('input[name="note"]');

    statusSelect.value = invData.status || 'For SRV';
    await populateApproverSelect(attentionSelect);

    const choices = new Choices(attentionSelect, {
        searchEnabled: true, shouldSort: false, itemSelectText: '', removeItemButton: true
    });
    row.choicesInstance = choices;
    await populateAttentionDropdown(choices, statusSelect.value, resolvedSite, true);

    const globalAttentionVal = imBatchGlobalAttentionChoices ? imBatchGlobalAttentionChoices.getValue(true) : null;
    if (globalAttentionVal) {
        choices.setValue([globalAttentionVal]);
    } else if (invData.attention) {
        choices.setChoiceByValue(invData.attention);
    }

    if (imBatchGlobalStatus.value) statusSelect.value = imBatchGlobalStatus.value;
    if (imBatchGlobalNote.value) noteInput.value = imBatchGlobalNote.value;

    updateBatchRowAttentionButton(row);
    updateBatchCount();
}


// --------------------------------------------------------------------------
// SECTION C: BATCH SEARCH & SAVE LOGIC
// --------------------------------------------------------------------------


async function handleBatchGlobalSearch(searchType) {
    const batchPOInput = document.getElementById('im-batch-po-input');
    const searchTerm = batchPOInput.value.trim();
    if (searchType === 'status' && !searchTerm) {
        alert(`Please enter a ${searchType} to search for.`);
        return;
    }

    let noteSearchTerm = '';
    if (searchType === 'note') {
        if (!imBatchNoteSearchChoices) { alert("Note search is not ready."); return; }
        noteSearchTerm = imBatchNoteSearchChoices.getValue(true);
        if (!noteSearchTerm) { alert("Please select a note from the dropdown to search."); return; }
    }

    const finalSearchTerm = (searchType === 'note') ? noteSearchTerm : searchTerm;

    if (searchType === 'status') {
        sessionStorage.setItem('imBatchSearch', searchTerm);
        sessionStorage.removeItem('imBatchNoteSearch');
    } else if (searchType === 'note') {
        sessionStorage.setItem('imBatchNoteSearch', noteSearchTerm);
        sessionStorage.removeItem('imBatchSearch');
    }

    if (!confirm(`This will scan all locally cached invoices.\n\nContinue searching for all invoices with ${searchType} "${finalSearchTerm}"?`)) return;

    batchPOInput.disabled = true;
    const originalPlaceholder = batchPOInput.placeholder;
    batchPOInput.placeholder = 'Searching local cache...';
    if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.disable();

    try {
        await ensureInvoiceDataFetched();
        const allPOs = allPOData, allInvoicesByPO = allInvoiceData;
        let invoicesFound = 0;
        const promises = [];
        for (const poNumber in allInvoicesByPO) {
            const invoices = allInvoicesByPO[poNumber], poData = allPOs[poNumber] || {};
            for (const key in invoices) {
                const inv = invoices[key];
                const site = normalizeNameText(inv.site || inv.site_name || inv.siteName || poData['Project ID'] || poData['Project ID:'] || 'N/A');
                const vendor = normalizeNameText(inv.vendor || inv.vendor_name || inv.vendorName || poData['Supplier Name'] || poData['Supplier Name:'] || poData['Supplier'] || poData['Supplier:'] || 'N/A');
                
                let isMatch = false;
                if (searchType === 'status' && inv.status && inv.status.toLowerCase() === finalSearchTerm.toLowerCase()) isMatch = true;
                else if (searchType === 'note' && inv.note && inv.note === finalSearchTerm) isMatch = true;

                if (isMatch) {
                    invoicesFound++;
                    promises.push(addInvoiceToBatchTable({ key, po: poNumber, site, vendor, ...inv }));
                }
            }
        }
        await Promise.all(promises);
        if (invoicesFound === 0) alert(`No invoices found with the ${searchType} "${finalSearchTerm}".`);
        else alert(`Added ${invoicesFound} invoice(s) to the batch list.`);
    } catch (error) {
        console.error("Error during global batch search:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        batchPOInput.disabled = false;
        batchPOInput.placeholder = originalPlaceholder;
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.enable();
    }
}



async function handleBatchModalPOSearch() {
    const modalPOSearchInput = document.getElementById('im-batch-modal-po-input');
    const modalResultsContainer = document.getElementById('im-batch-modal-results');
    const poNumber = modalPOSearchInput.value.trim().toUpperCase();
    
    if (!poNumber) return;
    modalResultsContainer.innerHTML = '<p>Searching...</p>';
    
    try {
        await ensureInvoiceDataFetched();
        const poData = allPOData[poNumber];
        const invoicesData = allInvoiceData[poNumber];
        
        if (!invoicesData) {
            modalResultsContainer.innerHTML = '<p>No invoices found for this PO.</p>';
            return;
        }
        
        const site = poData ? poData['Project ID'] || 'N/A' : 'N/A';
        const vendor = poData ? poData['Supplier Name'] || 'N/A' : 'N/A';
        
        modalResultsContainer.innerHTML = ''; 
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th><input type="checkbox" id="modal-select-all"></th>
                    <th>Inv. Entry ID</th>
                    <th>Inv. No.</th>
                    <th>Inv. Value</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody id="batch-modal-tbody"></tbody>
        `;
        modalResultsContainer.appendChild(table);
        
        const tbody = table.querySelector('tbody');
        const sortedInvoices = Object.entries(invoicesData).sort(([, a], [, b]) => (a.invEntryID || '').localeCompare(b.invEntryID || ''));
        
        for (const [key, inv] of sortedInvoices) {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer'; 
            tr.setAttribute('tabindex', '0'); 
            
            const invDataString = encodeURIComponent(JSON.stringify({ key, po: poNumber, site, vendor, ...inv }));
            
            tr.innerHTML = `
                <td style="text-align:center;">
                    <input type="checkbox" class="modal-inv-checkbox" data-invoice='${invDataString}' tabindex="-1">
                </td>
                <td>${inv.invEntryID || ''}</td>
                <td>${inv.invNumber || ''}</td>
                <td>${formatCurrency(inv.invValue)}</td>
                <td>${inv.status || ''}</td>
            `;
            
            tr.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                const checkbox = tr.querySelector('.modal-inv-checkbox');
                if (checkbox) checkbox.checked = !checkbox.checked;
            });

            tr.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault(); 
                    const checkbox = tr.querySelector('.modal-inv-checkbox');
                    if (checkbox) checkbox.checked = !checkbox.checked;
                }
                if (e.key === 'ArrowDown') { e.preventDefault(); if (tr.nextElementSibling) tr.nextElementSibling.focus(); }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (tr.previousElementSibling) tr.previousElementSibling.focus();
                    else modalPOSearchInput.focus();
                }
                if (e.key === 'Enter') { e.preventDefault(); document.getElementById('im-batch-modal-add-selected-btn').click(); }
            });

            tr.addEventListener('focus', () => { tr.style.backgroundColor = '#eaf8f1'; tr.style.outline = '2px solid #116045'; });
            tr.addEventListener('blur', () => { tr.style.backgroundColor = ''; tr.style.outline = 'none'; });
            
            tbody.appendChild(tr);
        }
        
        const selectAll = document.getElementById('modal-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                modalResultsContainer.querySelectorAll('.modal-inv-checkbox').forEach(chk => chk.checked = e.target.checked);
            });
        }

        setTimeout(() => { const firstRow = tbody.querySelector('tr'); if (firstRow) firstRow.focus(); }, 100);
        
    } catch (error) {
        console.error("Error searching in batch modal:", error);
        modalResultsContainer.innerHTML = '<p>An error occurred.</p>';
    }
}


async function handleAddSelectedToBatch() {
    const selectedCheckboxes = document.getElementById('im-batch-modal-results').querySelectorAll('.modal-inv-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
        alert("Please select at least one invoice.");
        return;
    }

    const addBtn = document.getElementById('im-batch-modal-add-selected-btn');
    if (addBtn) addBtn.textContent = "Adding...";

    try {
        const promises = [];
        for (const checkbox of selectedCheckboxes) {
            try {
                const invData = JSON.parse(decodeURIComponent(checkbox.dataset.invoice));
                promises.push(addInvoiceToBatchTable(invData));
            } catch (err) { console.error("Row error:", err); }
        }

        await Promise.all(promises);

        const searchInput = document.getElementById('im-batch-modal-po-input');
        const resultsContainer = document.getElementById('im-batch-modal-results');

        if (searchInput) searchInput.value = '';
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div style="padding: 15px; text-align: center; color: #28a745;">
                    <strong><i class="fa-solid fa-check"></i> Added ${selectedCheckboxes.length} invoice(s).</strong>
                    <p style="color: #777; margin-top: 5px; font-size: 0.9rem;">Ready for next PO...</p>
                </div>
            `;
        }

        if (searchInput) setTimeout(() => { searchInput.focus(); }, 50);

    } catch (error) {
        console.error("Batch Error:", error);
        alert("Error adding batch.");
    } finally {
        if (addBtn) addBtn.textContent = "Add Selected to Batch";
    }
}

// ==========================================================================
// 19. INVOICE MANAGEMENT: SUMMARY NOTES
// ==========================================================================


async function initializeNoteSuggestions() {
    if (allUniqueNotes.size > 0) {
        noteSuggestionsDatalist.innerHTML = '';
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });
        return;
    }
    try {
        await ensureInvoiceDataFetched();
        noteSuggestionsDatalist.innerHTML = '';
        const sortedNotes = Array.from(allUniqueNotes).sort();
        sortedNotes.forEach(note => {
            const option = document.createElement('option');
            option.value = note;
            noteSuggestionsDatalist.appendChild(option);
        });
    } catch (error) {
        console.error("Error initializing note suggestions:", error);
    }
}


async function populateNoteDropdown(choicesInstance) {
    if (!choicesInstance) return;

    if (allUniqueNotes.size > 0) {
        const sortedNotes = Array.from(allUniqueNotes).sort();
        const noteOptions = sortedNotes.map(note => ({
            value: note,
            label: note
        }));

        choicesInstance.setChoices(
            [
                {
                    value: '',
                    label: 'Select a note to search...',
                    disabled: true
                },
                ...noteOptions
            ],
            'value',
            'label',
            true
        );
        return;
    }

    choicesInstance.setChoices([{
        value: '',
        label: 'Loading notes...',
        disabled: true
    }]);
    try {
        await ensureInvoiceDataFetched();

        const sortedNotes = Array.from(allUniqueNotes).sort();
        const noteOptions = sortedNotes.map(note => ({
            value: note,
            label: note
        }));

        choicesInstance.setChoices(
            [
                {
                    value: '',
                    label: 'Select a note to search...',
                    disabled: true
                },
                ...noteOptions
            ],
            'value',
            'label',
            true
        );
    } catch (error) {
        console.error("Error populating note dropdown:", error);
        choicesInstance.setChoices([{
            value: '',
            label: 'Error loading notes',
            disabled: true
        }]);
    }
}


// --- SMART SRV AUTO-FILLER ---

function autoFillSummarySrvIfWithAccounts() {
    const statusInput = document.getElementById('summary-note-status-input');
    const srvInput = document.getElementById('summary-note-srv-input');
    const vendorEl = document.getElementById('sn-vendor-name');

    if (statusInput && statusInput.value === 'With Accounts' && srvInput && vendorEl) {
        const vendorName = vendorEl.textContent.trim();
        
        if (vendorName && vendorName !== 'N/A') {
            const d = new Date();
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const dateStr = `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
            
            // 1. Cut the vendor name at 23 characters and clean up the edges
            let shortVendor = vendorName.length > 23 ? vendorName.substring(0, 23).trim() : vendorName;
            
            // 2. Instantly fill the box with the shortened name!
            srvInput.value = `${shortVendor} ${dateStr}`; 
        }
    }
}

// Watch for manual dropdown changes
document.addEventListener('change', (e) => {
    if (e.target.id === 'summary-note-status-input') {
        autoFillSummarySrvIfWithAccounts();
    }
});

