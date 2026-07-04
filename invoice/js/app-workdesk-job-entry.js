// ==========================================================================
// IBA SYSTEM - WorkDesk Job Entry UI Helpers
// Version: 10.1.6
// Purpose: Job Entry form reset/toggles, dropdown population, table/search UI, edit navigation.
// Note: Save/update/delete/write logic remains in app.js.
// ==========================================================================


function wdJobEntryIsInvoiceType(value) {
    return String(value || '').trim() === 'Invoice';
}

function wdJobEntryIsIPCApplicationType(value) {
    return String(value || '').trim() === 'IPC Application';
}

function wdJobEntryIsIPCProcessedType(value) {
    const raw = String(value || '').trim();
    return raw === 'IPC Processed' || raw === 'IPC';
}

function wdJobEntryToggleGroupCategory() {
    const isInvoice = wdJobEntryIsInvoiceType(jobForSelect ? jobForSelect.value : '');
    const groupContainer = document.getElementById('job-group-container') || (document.getElementById('job-group') ? document.getElementById('job-group').closest('.form-group') : null);
    const groupSelect = document.getElementById('job-group');

    if (groupContainer) groupContainer.classList.toggle('hidden', !isInvoice);
    if (!isInvoice && groupSelect) groupSelect.value = '';
}

function resetJobEntryForm(keepJobType = false) {
    const jobType = document.getElementById('job-for').value;

    // 1. Reset the actual form inputs
    document.getElementById('jobentry-form').reset();

    // 2. Restore Job Type if requested
    if (keepJobType) {
        document.getElementById('job-for').value = jobType;
    }

    // 3. CRITICAL: Switch Mode back to "ADD"
    currentlyEditingKey = null; // Forget the ID we were editing
    document.getElementById('standard-modal-title').textContent = 'Add New Job Entry';

    // 4. Toggle Buttons (Hide Update/Delete, Show Add)
    // We use classList to ensure we don't break the layout
    const addBtn = document.getElementById('add-job-button');
    const updateBtn = document.getElementById('update-job-button');
    const deleteBtn = document.getElementById('delete-job-button');

    if (addBtn) addBtn.classList.remove('hidden');
    if (updateBtn) updateBtn.classList.add('hidden');
    if (deleteBtn) deleteBtn.classList.add('hidden');

    // 5. Remove Highlight Visuals
    ['job-amount', 'job-po'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('highlight-field');
    });

    // 6. Reset Dropdowns (Choices.js)
    if (attentionSelectChoices) {
        if (attentionSelectChoices.disabled) attentionSelectChoices.enable();
        attentionSelectChoices.clearInput();
        attentionSelectChoices.removeActiveItems();
        // Repopulate to ensure list is clean
        populateAttentionDropdown(attentionSelectChoices);
    }

    if (siteSelectChoices) {
        siteSelectChoices.clearInput();
        siteSelectChoices.removeActiveItems();
    }

    // 7. Hide Transfer Fields (Just in case)
    const transferContainer = document.getElementById('transfer-fields-container');
    if (transferContainer) transferContainer.classList.add('hidden');

    document.querySelectorAll('.jobentry-form-2col .form-column').forEach(col => col.classList.remove('hidden'));

    // 8. Reset Search (Optional, keeps UI clean)
    const searchInput = document.getElementById('job-entry-search');
    if (searchInput) searchInput.value = '';
    sessionStorage.removeItem('jobEntrySearch');

    // Keep Invoice-only fields and Group/Category consistent with current Job Type
    if (typeof wdJobEntryToggleGroupCategory === 'function') wdJobEntryToggleGroupCategory();
    if (typeof toggleJobInvoiceFields === 'function') {
        // fire and forget
        toggleJobInvoiceFields();
    }
}

function toggleJobOtherInput() {
    const select = document.getElementById('job-for');
    const otherInput = document.getElementById('job-other-specify');
    if (select.value === 'Other') {
        otherInput.classList.remove('hidden');
        otherInput.focus();
    } else {
        otherInput.classList.add('hidden');
        otherInput.value = ''; // Clear it if they switch back
    }
}
// Expose to global scope for HTML onchange
window.toggleJobOtherInput = toggleJobOtherInput;

async function toggleJobInvoiceFields() {
    const isInvoice = (jobForSelect && jobForSelect.value === 'Invoice');
    if (typeof wdJobEntryToggleGroupCategory === 'function') wdJobEntryToggleGroupCategory();

    if (jobInvoiceFieldsContainer) {
        jobInvoiceFieldsContainer.classList.toggle('hidden', !isInvoice);
    }

    if (!isInvoice) {
        if (jobInvoiceDateInput) jobInvoiceDateInput.value = '';
        if (jobVendorNameInput) jobVendorNameInput.value = '';
        if (jobVendorIdInput) jobVendorIdInput.value = '';
        if (typeof hideJobVendorSuggest === 'function') hideJobVendorSuggest();
        return;
    }

    // Ensure vendors list is available for suggestions
    await ensureVendorsDataFetchedForJobEntry(false);
    buildJobVendorDatalistIfNeeded();
}

// Expose so HTML onchange can call it if needed
window.toggleJobInvoiceFields = toggleJobInvoiceFields;
window.wdJobEntryToggleGroupCategory = wdJobEntryToggleGroupCategory;
window.wdJobEntryIsInvoiceType = wdJobEntryIsInvoiceType;

function updateJobTypeDropdown() {
    const select = document.getElementById('job-for');
    if (!select) return;

    // 7.3.4: Separate WorkDesk job types from Inventory job types.
    // WorkDesk Add New Job should not show Transfer/Restock/Return/Usage.
    // Inventory context may still use the same modal shell, but it must show inventory types only.
    const inventoryTypes = new Set(['Transfer', 'Restock', 'Return', 'Usage']);
    const inInventory = (typeof isInventoryContext === 'function') ? isInventoryContext() : false;

    const defaultTypes = inInventory
        ? new Set(['Transfer', 'Restock', 'Return', 'Usage', 'Other'])
        : new Set(['PR', 'Invoice', 'IPC Application', 'IPC Processed', 'Payment', 'Trip', 'Report', 'Other']);

    // Learn from history, but keep the two families separated.
    if (allSystemEntries && allSystemEntries.length > 0) {
        allSystemEntries.forEach(entry => {
            const rawType = (entry.for || entry.jobType || '').toString().trim();
            if (!rawType) return;
            // 10.1.6: legacy plain IPC must not re-appear in Add New Job.
            // Show it under the new clear name only.
            const displayType = (rawType === 'IPC') ? 'IPC Processed' : rawType;

            const isInvType = inventoryTypes.has(displayType);
            if (inInventory) {
                if (isInvType) defaultTypes.add(displayType);
            } else {
                if (!isInvType) defaultTypes.add(displayType);
            }
        });
    }

    const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>Select a Type</option>';

    const sortedTypes = Array.from(defaultTypes)
        .filter(type => type && type !== 'Other')
        .sort((a, b) => a.localeCompare(b));

    sortedTypes.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        if (inventoryTypes.has(type)) {
            opt.style.fontWeight = 'bold';
            if (type === 'Transfer') opt.textContent = '↔ Transfer Stock';
            if (type === 'Restock') opt.textContent = '+ Restock';
            if (type === 'Return') opt.textContent = '↩ Return';
            if (type === 'Usage') opt.textContent = '✓ Usage';
        }
        select.appendChild(opt);
    });

    const otherOpt = document.createElement('option');
    otherOpt.value = 'Other';
    otherOpt.textContent = '-- Other (Specify) --';
    otherOpt.style.fontWeight = 'bold';
    select.appendChild(otherOpt);

    // Restore only if the option is still allowed in the current family.
    if (currentVal && Array.from(select.options).some(opt => opt.value === currentVal)) {
        select.value = currentVal;
    } else {
        select.value = '';
    }
}

async function populateSiteDropdown() {
    try {
        if (!siteSelectChoices) return;

        siteSelectChoices.setChoices([{
            value: '',
            label: 'Loading latest sites...',
            disabled: true,
            selected: true
        }], 'value', 'label', true);

        // 7.8.2: Always try to refresh Site.csv when opening the Add New Job modal.
        // This prevents the site dropdown from staying stuck on old local/jsDelivr cache.
        try {
            console.log("Refreshing latest Site.csv for WorkDesk dropdown...");
            const url = await getFirebaseCSVUrl('Site.csv');
            if (url) {
                const freshSites = await fetchAndParseSitesCSV(url);
                if (freshSites && freshSites.length) {
                    allSitesCSVData = freshSites;
                    allSitesCache = null;
                    cacheTimestamps.sitesCSV = Date.now();
                    try { setCache('cached_SITES', allSitesCSVData); } catch (_) {}
                }
            }
        } catch (refreshError) {
            console.warn('Site.csv live refresh failed. Falling back to cached site list if available.', refreshError);
        }

        const sites = allSitesCSVData;

        if (sites && sites.length > 0) {
            const siteOptions = sites
                .map(site => (site.site && site.description) ? {
                    value: site.site,
                    label: `${site.site} - ${site.description}`
                } : null)
                .filter(Boolean)
                .sort((a, b) => {
                    const numA = parseInt(a.value, 10);
                    const numB = parseInt(b.value, 10);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    return a.label.localeCompare(b.label);
                });

            const choiceList = [{
                value: '',
                label: 'Select a Site',
                disabled: true
            }].concat(siteOptions);
            allSitesCache = choiceList;
            siteSelectChoices.setChoices(allSitesCache, 'value', 'label', true);
        } else {
            siteSelectChoices.setChoices([{
                value: '',
                label: 'No sites found',
                disabled: true
            }]);
        }
    } catch (error) {
        console.error("Error populating site dropdown from CSV:", error);
        if (siteSelectChoices) siteSelectChoices.setChoices([{
            value: '',
            label: 'Error loading sites',
            disabled: true
        }]);
    }
}

function renderJobEntryTable(entries) {
    jobEntryTableBody.innerHTML = '';

    if (!entries || entries.length === 0) {
        jobEntryTableBody.innerHTML = `<tr><td colspan="8">No pending entries found for your search.</td></tr>`;
        return;
    }

    entries.forEach(entry => {
        const row = document.createElement('tr');
        row.setAttribute('data-key', entry.key);

        // Make row clickable for editing (unless it's a pure invoice task)
        if (entry.source !== 'invoice') {
            row.style.cursor = 'pointer';
        }

        // --- Attachment Display Logic ---
        let refDisplay = entry.ref || '';

        if (entry.attachmentName && entry.attachmentName.trim() !== '') {
            const val = entry.attachmentName.trim();

            // Smart Link Construction (Same as above)
            let fullPath;
            if (val.startsWith('http')) {
                fullPath = val;
            } else {
                fullPath = ATTACHMENT_BASE_PATH + encodeURIComponent(val);
            }

            // Smart Icon Detection
            let iconClass = "fa-paperclip";
            const lowerName = val.toLowerCase();

            if (lowerName.endsWith('.zip') || lowerName.endsWith('.rar')) iconClass = "fa-file-zipper";
            else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png')) iconClass = "fa-file-image";
            else if (lowerName.endsWith('.pdf')) iconClass = "fa-file-pdf";
            else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) iconClass = "fa-file-excel";

            // Add the clickable icon
            refDisplay += ` <a href="${fullPath}" target="_blank" style="color: #6f42c1; margin-left: 8px; text-decoration: none;" title="View Attachment" onclick="event.stopPropagation()"><i class="fa-solid ${iconClass}"></i></a>`;
        }
        // -------------------------------------

        row.innerHTML = `
            <td>${entry.for || ''}</td>
            <td>${refDisplay}</td> <td>${entry.po || ''}</td>
            <td>${entry.site || ''}</td>
            <td>${entry.group || ''}</td>
            <td>${entry.attention || ''}</td>
            <td>${entry.date || ''}</td>
            <td>${entry.remarks || 'Pending'}</td>
        `;
        jobEntryTableBody.appendChild(row);
    });
}

async function handleJobEntrySearch(searchTerm) {
    const searchText = (searchTerm || '').toLowerCase();
    sessionStorage.setItem('jobEntrySearch', searchText);

    jobEntryTableBody.innerHTML = '<tr><td colspan="8">Searching...</td></tr>';

    // --- INVENTORY CONTEXT ---
    const isInventoryPage = (typeof isInventoryContext === 'function') ? isInventoryContext() : false;

    try {
        await ensureAllEntriesFetched();

        // 1. FILTER: My Entries + Not Complete (Standard Logic)
        let filteredEntries = allSystemEntries.filter(entry =>
            entry.enteredBy === currentApprover.Name && !isTaskComplete(entry)
        );

        // 2. FILTER: Inventory Page Exclusive (Strict)
        if (isInventoryPage) {
            filteredEntries = filteredEntries.filter(entry => 
                INVENTORY_TYPES.includes(entry.for)
            );
        }

        // 3. FILTER: Search Text
        if (searchText) {
            filteredEntries = filteredEntries.filter(entry => {
                return (
                    (entry.for && entry.for.toLowerCase().includes(searchText)) ||
                    (entry.ref && entry.ref.toLowerCase().includes(searchText)) ||
                    (entry.site && entry.site.toLowerCase().includes(searchText)) ||
                    (entry.group && entry.group.toLowerCase().includes(searchText)) ||
                    (entry.attention && entry.attention.toLowerCase().includes(searchText)) ||
                    (entry.po && entry.po.toLowerCase().includes(searchText)) ||
                    // Allow searching by product name for transfers
                    (entry.productName && entry.productName.toLowerCase().includes(searchText)) 
                );
            });
        }

        renderJobEntryTable(filteredEntries);

    } catch (error) {
        console.error("Error during job entry search:", error);
        jobEntryTableBody.innerHTML = '<tr><td colspan="8">Error searching entries.</td></tr>';
    }
}

function populateFormForEditing(key) {
    const entryData = allSystemEntries.find(entry => entry.key === key);
    if (!entryData) return;

    // --- 1. TRANSFER GROUP LOGIC ---
    if (['Transfer', 'Restock', 'Return', 'Usage'].includes(entryData.for)) {
        if (window.loadTransferForEdit) {
            window.loadTransferForEdit(entryData);
        } else {
            console.error("Transfer loader not found.");
        }
        return; 
    }

    // --- 2. STANDARD GROUP LOGIC ---
    openStandardJobModal('Edit', entryData);
}

function updateJobEntryNavControls() {
    if (navigationContextList.length > 0 && navigationContextIndex > -1) {
        jobEntryNavControls.classList.remove('hidden');
        navJobCounter.textContent = (navigationContextIndex + 1) + ' / ' + navigationContextList.length;
        navPrevJobButton.disabled = (navigationContextIndex === 0);
        navNextJobButton.disabled = (navigationContextIndex === navigationContextList.length - 1);
    } else {
        jobEntryNavControls.classList.add('hidden');
    }
}
