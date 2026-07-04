// =================================================================================================
// FILE: js/app-im-event-wiring.js
// Version: 8.2.8
// Purpose: Invoice Management navigation/event wiring and attention vacation-choice UI.
// Safety: Moved intact from app.js. No save/update/delete logic intentionally changed.
// =================================================================================================

// =================================================================================================
// #region BLOCK 23 — INVOICE MANAGEMENT EVENT WIRING + ATTENTION CHOICE
// Purpose: IM attention selection and large modal/form event wiring block.
// =================================================================================================

    function handleIMAttentionChoice(event) {
        if (event.detail && event.detail.value && imAttentionSelectChoices) {
            const selectedValue = event.detail.value;
            const selectedChoice = imAttentionSelectChoices._store.choices.find(c => c.value === selectedValue);
            if (selectedChoice && selectedChoice.customProperties && selectedChoice.customProperties.onVacation === true) {
                vacationingUserName.textContent = selectedChoice.value;
                vacationReturnDate.textContent = selectedChoice.customProperties.returnDate || 'N/A';
                replacementNameDisplay.textContent = selectedChoice.customProperties.replacement.name;
                replacementContactDisplay.textContent = selectedChoice.customProperties.replacement.contact;
                replacementEmailDisplay.textContent = selectedChoice.customProperties.replacement.email;
                vacationModal.classList.remove('hidden');
            }
        }
    }

    if (imWorkdeskButton) {
        imWorkdeskButton.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
        });
    }
    if (imActiveTaskButton) {
        imActiveTaskButton.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
            setTimeout(() => {
                workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
                if (activeTaskLink) activeTaskLink.classList.add('active');
                showWorkdeskSection('wd-activetask');
            }, 100);
        });
    }

    if (wdImReportingLinkMobile) {
        wdImReportingLinkMobile.addEventListener('click', (e) => {
            e.preventDefault();

            // 7.3.7: Same mobile label, different module route.
            // Inventory mode: Reporting = Inventory Job Records.
            // Invoice mode: Reporting = Invoice Records.
            const inventoryMobileMode = (typeof isInventoryMobileModuleActive === 'function')
                ? isInventoryMobileModuleActive()
                : !!(document.body && document.body.classList.contains('inventory-mode'));

            if (inventoryMobileMode) {
                try { window.__ibaActiveModule = 'inventory'; } catch (_) {}
                if (document.body) document.body.classList.add('inventory-mode');
                if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('inventory');
                if (typeof syncMobileModuleSwitchers === 'function') syncMobileModuleSwitchers('inventory');

                // Make sure the shared Reporting screen is fed by inventory_entries only.
                currentReportFilter = null;
                try { sessionStorage.removeItem('reportingSearch'); } catch (_) {}

                document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
                const invReportingLink = workdeskNav.querySelector('a[data-section="wd-reporting"]');
                if (invReportingLink) invReportingLink.classList.add('active');
                showView('workdesk');
                showWorkdeskSection('wd-reporting');
                return;
            }

            try { window.__ibaActiveModule = 'invoice'; } catch (_) {}
            if (document.body) document.body.classList.remove('inventory-mode');
            if (typeof updateWorkdeskModuleRoutingUI === 'function') updateWorkdeskModuleRoutingUI('workdesk');
            if (typeof syncMobileModuleSwitchers === 'function') syncMobileModuleSwitchers('invoice');

            invoiceManagementButton.click();
            setTimeout(() => {
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) {
                    imReportingLink.click();
                }
            }, 100);
        });
    }

    // NEW: Listener for the renamed Invoice Management mobile link
    if (imNavReportingLinkMobile) {
        imNavReportingLinkMobile.addEventListener('click', (e) => {
            e.preventDefault();
            // Ensure we are in IM view
            if (invoiceManagementView.classList.contains('hidden')) {
                invoiceManagementButton.click();
            }
            setTimeout(() => {
                const imReportingLink = imNav.querySelector('a[data-section="im-reporting"]');
                if (imReportingLink) {
                    imReportingLink.click();
                }
            }, 100);
        });
    }

    if (imBackToWDDashboardLink) {
        imBackToWDDashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            workdeskButton.click();
            setTimeout(() => {
                const wdDashboardLink = workdeskNav.querySelector('a[data-section="wd-dashboard"]');
                if (wdDashboardLink) {
                    wdDashboardLink.click();
                }
            }, 100);
        });
    }

    imNav.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link || link.classList.contains('disabled') || link.parentElement.style.display === 'none' || link.id === 'im-workdesk-button' || link.id === 'im-activetask-button') return;
        e.preventDefault();
        const sectionId = link.getAttribute('data-section');
        if (sectionId) {
            imNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            showIMSection(sectionId);
        }
    });

    imPOSearchButton.addEventListener('click', () => handlePOSearch(imPOSearchInput.value));
    imPOSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePOSearch(imPOSearchInput.value);
        }
    });
    imPOSearchButtonBottom.addEventListener('click', () => handlePOSearch(imPOSearchInputBottom.value));
    if (imOpenInvoiceFormBtn) {
        imOpenInvoiceFormBtn.addEventListener('click', () => {
            if (!currentPO) {
                alert('Please search for a PO first.');
                return;
            }
            openIMInvoiceEntryModal();
        });
    }

    // --- Updated listeners for Batch Search Modal ---

// 1. Top Search Input
imPOSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handlePOSearch(imPOSearchInput.value);
    } else if (e.code === 'Space' || e.key === ' ') {
        // Space bar now adds the selected items to the batch
        e.preventDefault();
        handleAddSelectedToBatch();
    }
});

// REPLACE WITH THIS UPDATED BLOCK:
imPOSearchInputBottom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        // Still allows Enter to search
        e.preventDefault();
        handlePOSearch(imPOSearchInputBottom.value);
    } 
    else if (e.code === 'Space' || e.key === ' ') {
        // This makes the Spacebar run the "Add to Batch" function
        e.preventDefault(); // This stops a "space" from being typed in the box
        handleAddSelectedToBatch();
    }
});
    if (imShowActiveJobsBtn) imShowActiveJobsBtn.addEventListener('click', async () => {
        if (!imEntrySidebar) return;

        const isCurrentlyOpen = !imEntrySidebar.classList.contains('hidden') && imEntrySidebar.classList.contains('visible');
        const isSidebarLoaded = (typeof imIsActiveJobsSidebarLoaded === 'function') && imIsActiveJobsSidebarLoaded();

        // 10.3.5: If the standby sidebar is already visible but not loaded,
        // this first click should LOAD the records, not hide the panel.
        if (isCurrentlyOpen && isSidebarLoaded) {
            imEntrySidebar.classList.remove('visible');
            imEntrySidebar.classList.add('hidden');
            if (imMainElement) imMainElement.classList.remove('with-sidebar');
            return;
        }

        imEntrySidebar.classList.remove('hidden');
        imEntrySidebar.classList.add('visible');
        if (imMainElement) imMainElement.classList.add('with-sidebar');

        // Fetch only after the user asks to see Active Jobs.
        if (typeof populateActiveJobsSidebar === 'function') {
            await populateActiveJobsSidebar(false);
        }
    });
    if (imEntrySidebarList) imEntrySidebarList.addEventListener('click', handleActiveJobClick);

    imAddInvoiceButton.addEventListener('click', handleAddInvoice);

// --- FIX: HANDLE ENTER KEY IN INVOICE FORM ---
if (imNewInvoiceForm) {
    imNewInvoiceForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Stop the form from refreshing or defaulting

        // Check if we are in "Edit Mode" (do we have a key?)
        if (currentlyEditingInvoiceKey) {
            // We are editing -> Trigger Update
            handleUpdateInvoice(e);
        } else {
            // We are adding -> Trigger Add
            handleAddInvoice(e);
        }
    });
}
// ---------------------------------------------


    imUpdateInvoiceButton.addEventListener('click', handleUpdateInvoice);
    imClearFormButton.addEventListener('click', () => {
        currentPO ? resetInvoiceForm() : resetInvoiceEntryPage();
        showIMSection('im-invoice-entry');
    });
    imBackToActiveTaskButton.addEventListener('click', () => {
        workdeskButton.click();
        setTimeout(() => {
            workdeskNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            workdeskNav.querySelector('a[data-section="wd-activetask"]').classList.add('active');
            showWorkdeskSection('wd-activetask');
        }, 100);
    });

    imInvoicesTableBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            handleDeleteInvoice(deleteBtn.getAttribute('data-key'));
            return;
        }
        const pdfLink = e.target.closest('a');
        if (pdfLink) return;
        const row = e.target.closest('tr');
        if (row) {
            populateInvoiceFormForEditing(row.getAttribute('data-key'));
        }
    });

 // ==========================================================================
// 1. REPORTING TABLE LISTENER (FIXED SYNTAX)
// ==========================================================================
if (imReportingContent) {
    imReportingContent.addEventListener('click', async (e) => {

        // 1. Handle Expand Button (Main PO Row)
        const expandBtn = e.target.closest('.expand-btn');
        if (expandBtn) {
            const masterRow = expandBtn.closest('.master-row');
            const detailRow = document.querySelector(masterRow.dataset.target);
            
            if (detailRow) {
                const isCurrentlyHidden = detailRow.classList.contains('hidden');

                // [NEW] Step A: Close ALL other open POs first
                if (isCurrentlyHidden) {
                    // Find all currently open detail rows
                    const allOpenDetails = document.querySelectorAll('.detail-row:not(.hidden)');
                    
                    allOpenDetails.forEach(row => {
                        // 1. Hide the row
                        row.classList.add('hidden');
                        
                        // 2. Reset the button text to "+"
                        // The button is in the row BEFORE the detail row (the master row)
                        const previousRow = row.previousElementSibling;
                        if (previousRow) {
                            const btn = previousRow.querySelector('.expand-btn');
                            if (btn) btn.textContent = '+';
                        }
                    });
                }

                // Step B: Toggle the clicked row
                if (isCurrentlyHidden) {
                    detailRow.classList.remove('hidden');
                    expandBtn.textContent = '-';
                } else {
                    detailRow.classList.add('hidden');
                    expandBtn.textContent = '+';
                }
            }
            return;
        }



// 1b. Handle Master Row Click (Toggle Expand/Collapse)
const masterRowClick = e.target.closest('tr.master-row');
if (masterRowClick) {
    const detailRow = document.querySelector(masterRowClick.dataset.target);
    const expandBtnInRow = masterRowClick.querySelector('.expand-btn');
    if (detailRow) {
        const isCurrentlyHidden = detailRow.classList.contains('hidden');

        // Close all other open POs when opening a new one (accordion behavior)
        if (isCurrentlyHidden) {
            const allOpenDetails = document.querySelectorAll('.detail-row:not(.hidden)');
            allOpenDetails.forEach(row => {
                row.classList.add('hidden');
                const previousRow = row.previousElementSibling;
                if (previousRow) {
                    const btn = previousRow.querySelector('.expand-btn');
                    if (btn) btn.textContent = '+';
                }
            });
        }

        // Toggle clicked PO
        if (isCurrentlyHidden) {
            detailRow.classList.remove('hidden');
            if (expandBtnInRow) expandBtnInRow.textContent = '-';
        } else {
            detailRow.classList.add('hidden');
            if (expandBtnInRow) expandBtnInRow.textContent = '+';
        }
    }
    return;
}
        // 2. Handle "Edit Inv No" Button
        const editInvBtn = e.target.closest('.edit-inv-no-btn');
        if (editInvBtn) {
            e.stopPropagation();
            const po = editInvBtn.dataset.po;
            const key = editInvBtn.dataset.key;
            const currentVal = editInvBtn.dataset.current;
            const newVal = prompt("Enter new Invoice Number:", currentVal);
            if (newVal !== null && newVal.trim() !== currentVal) {
                try {
                    await invoiceDb.ref(`invoice_entries/${po}/${key}`).update({ invNumber: newVal.trim() });
                    if (allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) {
                        allInvoiceData[po][key].invNumber = newVal.trim();
                    }
                    alert("Invoice Number updated!");
                    const currentSearch = sessionStorage.getItem('imReportingSearch') || '';
                    
                    // Await the table re-render
                    await populateInvoiceReporting(currentSearch);
                    
                    // AUTO-SCROLL LOGIC: Find the newly sorted row and scroll to it
                    setTimeout(() => {
                        const editedRow = document.querySelector(`.nested-invoice-row[data-invoice-key="${key}"]`);
                        if (editedRow) {
                            editedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            // Optional: Flash the row green to indicate the active edit
                            const originalBg = editedRow.style.backgroundColor;
                            editedRow.style.backgroundColor = '#d4edda';
                            setTimeout(() => {
                                editedRow.style.backgroundColor = originalBg;
                            }, 2000);
                        }
                    }, 400);

                } catch (err) {
                    console.error(err);
                    alert("Error updating invoice number.");
                }
            }
            return;
        }


        // 3. Handle Row Click (Import or Edit)
        // ---------------------------------------------------------
const invoiceRow = e.target.closest('.nested-invoice-row');
        if (invoiceRow) {
            // A. Permission Check
            const userRoleLower = (currentApprover?.Role || '').toLowerCase();
            const userPositionLower = (currentApprover?.Position || '').toLowerCase();
            const isVacationDelegate = (typeof isVacationDelegateUser === 'function') ? isVacationDelegateUser() : false;
            const canEdit = userRoleLower === 'admin' || userPositionLower === 'accounting' || userPositionLower === 'accounts' || isVacationDelegate;
            
            if (!canEdit) return;

            // [NEW] B. Handle "Inv. No." Column (Index 1) Logic
            // ---------------------------------------------------
            const clickedCell = e.target.closest('td');
            
            // If clicking the 2nd column (Index 1)...
            if (clickedCell && clickedCell.cellIndex === 1) { 
                
                // CHECK: Is this a Double Click? (e.detail === 2)
                if (e.detail === 2) {
                    const textToCopy = clickedCell.innerText.trim();
                    if (textToCopy) {
                        // 1. Copy to Clipboard
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            // 2. Visual Feedback: Flash Green
                            const originalBg = clickedCell.style.backgroundColor;
                            clickedCell.style.backgroundColor = '#d4edda'; // Light Green
                            clickedCell.style.transition = 'background-color 0.3s';
                            
                            setTimeout(() => {
                                clickedCell.style.backgroundColor = originalBg;
                            }, 400);
                        }).catch(err => console.error('Copy failed', err));
                    }
                }
                
                // STOP HERE! Do not show the Import/Edit popup.
                return; 
            }
            // ---------------------------------------------------

            // C. Get Row Data
            const poNumber = invoiceRow.dataset.poNumber;
            const invoiceKey = invoiceRow.dataset.invoiceKey;
            const source = invoiceRow.dataset.source;

            if (!poNumber || !invoiceKey) return;

           // --- SCENARIO A: IMPORT FROM EPICORE (CSV) ---
    if ((source || '').toLowerCase() === 'ecommit') {
        
        // 1. Grab the glued data (checking multiple possible attribute names)
        const invNo = invoiceRow.dataset.invNumber || invoiceRow.dataset.packingSlip || '';
        let invValue = invoiceRow.dataset.invValue || invoiceRow.dataset.extendedCost || '';
        
        // Strip out any currency letters or commas from the CSV value just in case
        if (invValue) invValue = invValue.replace(/[^0-9.-]+/g, ""); 

        if (confirm(`Import this Epicore record to Invoice Entry?\n\nPO: ${poNumber}\nInv: ${invNo || 'N/A'}`)) {
            
            // 2. Navigate to Invoice Entry
            const invEntryNav = document.querySelector('#im-nav a[data-section="im-invoice-entry"]');
            if (invEntryNav) invEntryNav.click();
            
            // 3. Set the input and trigger the PO Search
            const poInput = document.getElementById('im-po-search-input');
            if (poInput) poInput.value = poNumber;
            if (typeof handlePOSearch === 'function') handlePOSearch(poNumber);
            
            // 4. THE BULLDOZER: Force data into inputs repeatedly to beat the form reset
            let attempts = 0;
            const forceInject = setInterval(() => {
                const invNoInput = document.getElementById('im-inv-no');
                const invValueInput = document.getElementById('im-inv-value');
                const amountPaidInput = document.getElementById('im-amount-paid');
                const statusSelect = document.getElementById('im-status');
                
                // Inject the values
                if (invNoInput) invNoInput.value = invNo;
                if (invValueInput) invValueInput.value = invValue;
                if (amountPaidInput) amountPaidInput.value = invValue;
                if (statusSelect) statusSelect.value = 'Under Review';
                
                // Open the Modal UI
                currentlyEditingInvoiceKey = null;
                const addBtn = document.getElementById('im-add-invoice-button');
                const updateBtn = document.getElementById('im-update-invoice-button');
                if (addBtn) addBtn.classList.remove('hidden');
                if (updateBtn) updateBtn.classList.add('hidden');
                
                const formTitle = document.getElementById('im-form-title');
                if (formTitle) formTitle.textContent = `Importing Invoice: ${invNo || 'New'}`;
                
                if (typeof openIMInvoiceEntryModal === 'function') {
                    openIMInvoiceEntryModal();
                }
                
                attempts++;
                // Stop fighting after 1.5 seconds and format the numbers nicely
                if (attempts > 15) {
                    clearInterval(forceInject);
                    if (typeof formatCurrencyField === 'function') {
                        if (invValueInput) formatCurrencyField(invValueInput);
                        if (amountPaidInput) formatCurrencyField(amountPaidInput);
                    }
                    if (invNoInput) invNoInput.focus();
                }
            }, 100);
        }
        return;
    }

			

            // --- SCENARIO B: EDIT EXISTING FIREBASE ENTRY ---
            if (confirm(`Do you want to edit this specific invoice entry?\n\nPO: ${poNumber}\nInvoice Key: ${invoiceKey}`)) {
                imNav.querySelector('a[data-section="im-invoice-entry"]').click();
                imPOSearchInput.value = poNumber;

                // Ensure data is fetched before populating
                const fetchPromise = (typeof ensureInvoiceDataFetched === 'function') 
                                     ? ensureInvoiceDataFetched() 
                                     : Promise.resolve(); 

                fetchPromise.then(() => {
                    currentPO = poNumber;
                    if (allPOData && allPOData[poNumber]) {
                        proceedWithPOLoading(poNumber, allPOData[poNumber]).then(() => {
                            populateInvoiceFormForEditing(invoiceKey);
                            imBackToActiveTaskButton.classList.remove('hidden');
                        });
                    } else {
                        handlePOSearch(poNumber).then(() => {
                            setTimeout(() => {
                                populateInvoiceFormForEditing(invoiceKey);
                            }, 300);
                        });
                    }
                });
            }
            return;
        }
    });
}

    // Reporting Form Listeners
    if (imReportingForm) {
        imReportingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchTerm = imReportingSearchInput.value.trim();
            if (!searchTerm && !document.getElementById('im-reporting-site-filter').value && !document.getElementById('im-reporting-date-filter').value && !document.getElementById('im-reporting-status-filter').value) {
                document.getElementById('im-reporting-content').innerHTML = '<p style="color: red; font-weight: bold;">Please specify at least one search criteria.</p>';
                imUpdateInvoiceRecordsTotals([]);
                return;
            }
            populateInvoiceReporting(searchTerm);
        });
    }

    if (imReportingClearButton) {
        imReportingClearButton.addEventListener('click', () => {
            imReportingForm.reset();
            sessionStorage.removeItem('imReportingSearch');
            document.getElementById('im-reporting-content').innerHTML = '<p>Please enter a PO, Vendor, or Invoice No. and click Search.</p>';
            currentReportData = [];
            if (reportingCountDisplay) reportingCountDisplay.textContent = '';
            imUpdateInvoiceRecordsTotals([]);
        });
    }

    if (imReportingDownloadCSVButton) imReportingDownloadCSVButton.addEventListener('click', handleDownloadCSV);
    if (imDownloadDailyReportButton) imDownloadDailyReportButton.addEventListener('click', handleDownloadDailyReport);
    if (imDownloadWithAccountsReportButton) imDownloadWithAccountsReportButton.addEventListener('click', handleDownloadWithAccountsReport);

    // Invoice Records "PREVIEW LIST" should open the preview modal (not direct print).
    // Printing is handled inside the modal (isolated print) to avoid conflicts with other reports.
    if (imReportingPrintBtn) {
        imReportingPrintBtn.addEventListener('click', () => {
            if (typeof window.openInvoicePrintPreview === 'function') {
                window.openInvoicePrintPreview();
            } else {
                alert('Print Preview is not available. Please reload the page.');
            }
        });
    }

   
if (imStatusSelect) {
    imStatusSelect.addEventListener('change', async (e) => {
        const statusValue = e.target.value;

        // 1. Update UI (visual required fields)
        imUpdateAttentionRequiredUI(statusValue);

        // 2. Clear attention if status does not require it
        if (imAttentionSelectChoices && (statusValue === 'Under Review' || statusValue === 'With Accounts')) {
            imAttentionSelectChoices.removeActiveItems();
        }
        if (imAttentionGroup) imAttentionGroup.classList.remove('im-invalid');

        // 3. Get current PO site (needed for site‑matching)
        let currentSite = null;
        if (currentPO && allPOData && allPOData[currentPO]) {
            currentSite = allPOData[currentPO]['Project ID'];
        }

        // 4. Apply normal dropdown filtering (already existing)
        if (imAttentionSelectChoices) {
            const currentSelection = imAttentionSelectChoices.getValue(true);
            await populateAttentionDropdown(imAttentionSelectChoices, statusValue, currentSite, true);
            if (currentSelection) {
                imAttentionSelectChoices.setChoiceByValue(currentSelection);
            }
        }

        // 5. AUTO‑ATTENTION LOGIC (new)
        if (imAttentionSelectChoices && currentPO) {
            await autoSetAttentionForStatus(statusValue, currentSite, imAttentionSelectChoices);
        }
    });
}

// Wire invoice field "invalid" UI (visual only; no logic changes)
imWireInvoiceValidationUI();

// --- 11. Modals, Settings & Misc Listeners ---


    if (settingsForm) settingsForm.addEventListener('submit', handleUpdateSettings);
if (settingsVacationCheckbox) {
    settingsVacationCheckbox.addEventListener('change', () => {
        const isChecked = settingsVacationCheckbox.checked;
        settingsVacationDetailsContainer.classList.toggle('hidden', !isChecked);
        if (!isChecked) {
            settingsReturnDateInput.value = '';
            settingsReplacementNameInput.value = '';
            settingsReplacementContactInput.value = '';
            settingsReplacementEmailInput.value = '';
        }
    });
}

// Celebration Settings (Super Admin only)
    if (celebrationPreviewBtn) {
        celebrationPreviewBtn.addEventListener('click', () => {
            try {
                const cfg = readCelebrationConfigFromUI();
                // Force preview even if disabled/date mismatch
                cfg.enabled = true;
                showCelebrationBannerFromConfig(cfg, { force: true });
            } catch (e) {
                console.log('Celebration preview failed:', e);
            }
        });
    }

    if (celebrationSaveBtn) {
        celebrationSaveBtn.addEventListener('click', async () => {
            await saveCelebrationSettingsFromUI(false);
        });
    }

    if (celebrationDisableBtn) {
        celebrationDisableBtn.addEventListener('click', async () => {
            await saveCelebrationSettingsFromUI(true);
            await populateCelebrationSettingsForm();
        });
    }

    if (calendarModalViewTasksBtn) {
        calendarModalViewTasksBtn.addEventListener('click', () => {
            const friendlyDate = calendarModalViewTasksBtn.dataset.friendlyDate;
            const activeTaskLink = workdeskNav.querySelector('a[data-section="wd-activetask"]');
            if (activeTaskLink) {
                document.querySelectorAll('#workdesk-nav a, .workdesk-footer-nav a').forEach(a => a.classList.remove('active'));
                activeTaskLink.classList.add('active');
                showWorkdeskSection('wd-activetask', friendlyDate);
            }
            document.getElementById('calendar-task-modal').classList.add('hidden');
        });
    }

    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close-btn')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    });

    if (batchClearBtn) batchClearBtn.addEventListener('click', () => {
        batchTableBody.innerHTML = '';
        batchPOInput.value = '';
        sessionStorage.removeItem('imBatchSearch');
        sessionStorage.removeItem('imBatchNoteSearch');
        if (imBatchNoteSearchChoices) imBatchNoteSearchChoices.clearInput();
        if (imBatchGlobalAttentionChoices) imBatchGlobalAttentionChoices.clearInput();
        imBatchGlobalStatus.value = '';
        imBatchGlobalNote.value = '';
        updateBatchCount();
    });

    if (batchSearchStatusBtn) batchSearchStatusBtn.addEventListener('click', () => handleBatchGlobalSearch('status'));
    if (batchSearchNoteBtn) batchSearchNoteBtn.addEventListener('click', () => handleBatchGlobalSearch('note'));
    if (batchAddBtn) batchAddBtn.addEventListener('click', handleAddPOToBatch);
    if (batchSaveBtn) batchSaveBtn.addEventListener('click', handleSaveBatchInvoices);

    if (batchPOInput) {
        // UX: pressing Enter in the "Enter PO or Status" field should ONLY add a new PO row.
        // Searching by PO / Status should be done via the dedicated buttons.
        batchPOInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (batchAddBtn) batchAddBtn.click();
                else handleAddPOToBatch();
            }
        });
        batchPOInput.addEventListener('input', debounce((e) => {
            sessionStorage.setItem('imBatchSearch', e.target.value);
            sessionStorage.removeItem('imBatchNoteSearch');
        }, 500));
    }
    if (imBatchNoteSearchSelect) {
        imBatchNoteSearchSelect.addEventListener('change', () => {
            if (imBatchNoteSearchChoices) {
                const noteValue = imBatchNoteSearchChoices.getValue(true);
                if (noteValue) {
                    sessionStorage.setItem('imBatchNoteSearch', noteValue);
                    sessionStorage.removeItem('imBatchSearch');
                } else {
                    sessionStorage.removeItem('imBatchNoteSearch');
                }
            }
        });
    }

   if (batchTableBody) {
        // 1. CLICK LISTENER (Delete, Attention, IPC, FIVE)
        batchTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('batch-remove-btn')) {
                // Looks for the new card container instead of a tr
                const row = e.target.closest('.batch-invoice-card') || e.target.closest('tr');
                if (row) {
                    row.remove();
                    updateBatchCount();
                }
                return;
            }

            // Per-row Attention: open a full modal picker
            if (e.target.classList.contains('batch-attention-btn')) {
                // Looks for the new card container instead of a tr
                const row = e.target.closest('.batch-invoice-card') || e.target.closest('tr');
                if (row) openBatchAttentionPicker(row);
                return;
            }

            // --- QUICK IPC BUTTON ---
            if (e.target.classList.contains('btn-quick-ipc')) {
                const card = e.target.closest('.batch-invoice-card');
                const po = card ? (card.dataset.po || '') : '';
                const invInput = card ? card.querySelector('input[name="invNumber"]') : null;
                if (invInput) {
                    invInput.value = po + '.IPC/';
                    invInput.focus();
                }
                return;
            }

            // --- QUICK FIVE BUTTON ---
            if (e.target.classList.contains('btn-quick-five')) {
                const card = e.target.closest('.batch-invoice-card');
                const invInput = card ? card.querySelector('input[name="invNumber"]') : null;
                if (invInput) {
                    invInput.value = 'FIVE-';
                    invInput.focus();
                }
                return;
            }
        });

        // 2. SMART FILTER & AUTO-ATTENTION LISTENER
        batchTableBody.addEventListener('change', async (e) => {
            if (e.target.name === 'status') {
                // Looks for the new card container instead of a tr
                const row = e.target.closest('.batch-invoice-card') || e.target.closest('tr');
                const newStatus = e.target.value;
                const site = row.dataset.site;

                // Find the Choices instance for this row
                if (row.choicesInstance) {
                    const currentSelection = row.choicesInstance.getValue(true);
                    
                    // Apply Smart Filter to update the dropdown options normally
                    await populateAttentionDropdown(row.choicesInstance, newStatus, site, true);
                    
                    // ==========================================
                    // --- NEW AUTO-ATTENTION LOGIC START ---
                    // ==========================================
                    let autoAttention = null;
                    const statusLower = (newStatus || '').toLowerCase();
                    
                    // Helper to safely find the exact formatted name from your database
                    const findName = (keyword) => {
                        if (!allApproverData) return keyword; // fallback
                        for (let user of Object.values(allApproverData)) {
                            let n = user.Name || '';
                            if (n.toLowerCase().includes(keyword.toLowerCase())) return n;
                        }
                        return keyword; 
                    };

                    if (statusLower === 'report') {
                        autoAttention = findName('gio');
                    } 
                    else if (statusLower === 'ceo approval') {
                        autoAttention = findName('hamad');
                    } 
                    // Checks for "In process" (or "For IPC" depending on what your dropdown says)
                    else if (statusLower === 'in process' || statusLower === 'for ipc') {
                        autoAttention = findName('ali');
                    } 
                   else if (statusLower === 'for srv') {
    // Get candidates as objects { name, position }
    let candidatesObj = [];
    if (allApproverData && site) {
        const siteId = (site || '').split('-')[0].trim().toLowerCase();
        if (siteId) {
            candidatesObj = getSiteMatchedAttentionCandidatesForSRV(siteId);
            // Filter out any invalid objects
            candidatesObj = candidatesObj.filter(c => c && c.name && c.name.trim().length > 0);
        }
    }
    // Extract names array for quick checks
    const candidateNames = candidatesObj.map(c => c.name);
    
    if (candidateNames.length === 1) {
        autoAttention = candidateNames[0];
    } else if (candidateNames.length > 1) {
        // Use the same showCandidatePicker (already handles objects)
        const selected = await new Promise((resolve) => {
            showCandidatePicker(candidatesObj, 'Select Person for SRV', (selectedName) => {
                resolve(selectedName);
            });
        });
        autoAttention = selected || findName('irwin');
    } else {
        autoAttention = findName('irwin');
    }
}

                    // Apply the Auto-Attention if a rule matched, otherwise restore previous selection
                    if (autoAttention) {
                        setBatchRowAttentionValue(row, autoAttention);
                    } else if (currentSelection) {
                        row.choicesInstance.setChoiceByValue(currentSelection);
                    }
                    // ==========================================
                    // --- NEW AUTO-ATTENTION LOGIC END ---
                    // ==========================================
                }
                
                // Keep the UI button label updated
                updateBatchRowAttentionButton(row);
            }
        });
    }
   
// Batch Entry: Attention picker modal (per row)
    if (imAttentionPickerModal) {
        // Close on background click
        imAttentionPickerModal.addEventListener('click', (e) => {
            if (e.target === imAttentionPickerModal) {
                closeBatchAttentionPicker();
            }
        });

        if (imAttentionPickerCancelBtn) {
            imAttentionPickerCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeBatchAttentionPicker();
            });
        }

        if (imAttentionPickerCloseBtn) {
            imAttentionPickerCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeBatchAttentionPicker();
            });
        }

        if (imAttentionPickerApplyBtn) {
            imAttentionPickerApplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!imAttentionPickerActiveRow || !imAttentionPickerChoices) {
                    closeBatchAttentionPicker();
                    return;
                }

                const selectedVal = imAttentionPickerChoices.getValue(true) || '';
                setBatchRowAttentionValue(imAttentionPickerActiveRow, selectedVal);
                closeBatchAttentionPicker();
            });
        }

        // ESC key closes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !imAttentionPickerModal.classList.contains('hidden')) {
                closeBatchAttentionPicker();
            }
        });
    }

    // Locate this in the "Event Listeners" section of Part 6
    if (imBatchSearchExistingButton) {
        imBatchSearchExistingButton.addEventListener('click', () => {
            // 1. Show the modal
            if (imBatchSearchModal) imBatchSearchModal.classList.remove('hidden');

            // 2. FORCE RESET: This wipes out any old tables or success messages
            document.getElementById('im-batch-modal-results').innerHTML = '<p>Enter a PO number to see its invoices.</p>';

            // 3. Clear the input and focus it so you are ready to type the NEW PO immediately
            const inputField = document.getElementById('im-batch-modal-po-input');
            if (inputField) {
                inputField.value = '';
                setTimeout(() => inputField.focus(), 100);
            }
        });
    }
    // --- END MODIFIED ---

    // Locate this block in app.js
if (imBatchSearchModal) {
    const modalSearchBtn = document.getElementById('im-batch-modal-search-btn');
    const addSelectedBtn = document.getElementById('im-batch-modal-add-selected-btn');
    const modalPOInput = document.getElementById('im-batch-modal-po-input');

    // 1. Button Clicks
    if (modalSearchBtn) modalSearchBtn.addEventListener('click', handleBatchModalPOSearch);
    if (addSelectedBtn) addSelectedBtn.addEventListener('click', handleAddSelectedToBatch);

    // 2. Handle "Enter" inside the Input Field -> Triggers SEARCH
    if (modalPOInput) {
        modalPOInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (modalSearchBtn) modalSearchBtn.click();
            }
        });
    }

    // 3. [NEW] Handle "Enter" anywhere else -> Triggers ADD SELECTED
    document.addEventListener('keydown', (e) => {
        // Only run if this specific modal is visible
        if (e.key === 'Enter' && !imBatchSearchModal.classList.contains('hidden')) {
            
            // IGNORE if the user is typing in the search box (that runs Search)
            if (document.activeElement === modalPOInput) return;

            // IGNORE if the user is focused on a checkbox (Enter toggles check/uncheck)
            if (document.activeElement.type === 'checkbox') return;

            // Otherwise, trigger the "Add Selected" button
            e.preventDefault();
            if (addSelectedBtn) {
                // Visual feedback (optional press effect)
                addSelectedBtn.style.transform = "scale(0.95)";
                setTimeout(() => addSelectedBtn.style.transform = "scale(1)", 100);
                
                addSelectedBtn.click();
            }
        }
    });
}

if (imBatchGlobalAttention) {
        imBatchGlobalAttention.addEventListener('change', () => {
            if (!imBatchGlobalAttentionChoices) return;
            const selectedValue = imBatchGlobalAttentionChoices.getValue(true);
            const valueToSet = selectedValue ? [selectedValue] : [];
            
            // 💡 FIX: Now targets the new cards instead of old table rows
            const cards = document.getElementById('im-batch-table-body').querySelectorAll('.batch-invoice-card');
            cards.forEach(card => {
                if (card.choicesInstance) {
                    if (selectedValue === 'None') {
                        card.choicesInstance.removeActiveItems(); // Clear if None
                    } else {
                        card.choicesInstance.setValue(valueToSet);
                    }
                }
                updateBatchRowAttentionButton(card);
            });
        });
    }
    
    if (imBatchGlobalStatus) {
        imBatchGlobalStatus.addEventListener('change', (e) => {
            const newValue = e.target.value;
            // 💡 FIX: Now targets the new cards instead of old table rows
            const cards = document.getElementById('im-batch-table-body').querySelectorAll('.batch-invoice-card');
            
            cards.forEach(async (card) => {
                // 1. Update the status dropdown value
                const statusSelect = card.querySelector('select[name="status"]');
                if (statusSelect) statusSelect.value = newValue;

                // 2. Re-run the filter logic for this card
                if (card.choicesInstance) {
                    const site = card.dataset.site; // Get site from card data
                    const currentSelection = card.choicesInstance.getValue(true);

                    // Apply filter (e.g., if "For SRV", show only Site DCs for this site)
                    await populateAttentionDropdown(card.choicesInstance, newValue, site, true);

                    // Restore previous selection if they are still allowed
                    if (currentSelection) {
                        card.choicesInstance.setChoiceByValue(currentSelection);
                    }
                }

                updateBatchRowAttentionButton(card);
            });
        });
    }

    if (imBatchGlobalNote) {
        const updateNotes = (newValue) => {
            // 💡 FIX: Now targets the new cards instead of old table rows
            const cards = document.getElementById('im-batch-table-body').querySelectorAll('.batch-invoice-card');
            cards.forEach(card => {
                const noteInput = card.querySelector('input[name="note"]');
                if (noteInput) noteInput.value = newValue;
            });
        };
        imBatchGlobalNote.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateNotes(e.target.value);
            }
        });
        imBatchGlobalNote.addEventListener('blur', (e) => {
            updateNotes(e.target.value);
        });
    }

    const refreshEntryBtn = document.getElementById('im-refresh-entry-button');
    if (refreshEntryBtn) {
        const run = async () => {
            alert("Refreshing all data from sources...");
            await ensureInvoiceDataFetched(true);
            await populateActiveTasks();
            alert("Data refreshed.");
            if (currentPO) handlePOSearch(currentPO);
        };
        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(refreshEntryBtn, 'im-refresh-entry', run, 30);
        } else {
            refreshEntryBtn.addEventListener('click', run);
        }
    }

    const refreshBatchBtn = document.getElementById('im-refresh-batch-button');
    if (refreshBatchBtn) {
        const run = async () => {
            alert("Refreshing all data... Your current batch list will be cleared.");
            await ensureInvoiceDataFetched(true);
            document.getElementById('im-batch-table-body').innerHTML = '';
            updateBatchCount();
            alert("Data refreshed. Please add POs again.");
        };
        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(refreshBatchBtn, 'im-refresh-batch', run, 30);
        } else {
            refreshBatchBtn.addEventListener('click', run);
        }
    }

    const refreshSummaryBtn = document.getElementById('im-refresh-summary-button');
    if (refreshSummaryBtn) {
        const run = async () => {
            alert("Refreshing all data...");
            await ensureInvoiceDataFetched(true);
            initializeNoteSuggestions();
            alert("Data refreshed.");
        };
        if (window.__attachRefreshCooldown) {
            window.__attachRefreshCooldown(refreshSummaryBtn, 'im-refresh-summary', run, 30);
        } else {
            refreshSummaryBtn.addEventListener('click', run);
        }
    }

// NOTE: We no longer auto-force "With Accounts" or auto-copy SRV Name on Generate.
// Use the Update button prompt instead when you want to "Send to Accounts".
if (summaryNoteGenerateBtn) {
    summaryNoteGenerateBtn.addEventListener('click', handleGenerateSummary);
}

if (summaryNoteUpdateBtn) {
    summaryNoteUpdateBtn.addEventListener('click', async () => {
        // Two-mode update:
        // - Cancel = Normal Update only
        // - OK = Update & Send to Accounts (forces Status=With Accounts and copies SRV name)
        const sendToAccounts = confirm(
            "Update & Send to Accounts?\n\n" +
            "OK = Yes (Status: With Accounts + copy SRV Name)\n" +
            "Cancel = No (Normal Update only)"
        );
        await handleUpdateSummaryChanges(sendToAccounts);
    });
}

    if (summaryClearBtn) {
        summaryClearBtn.addEventListener('click', () => {
            summaryNotePreviousInput.value = '';
            summaryNoteCurrentInput.value = '';
            document.getElementById('summary-note-status-input').value = '';
            document.getElementById('summary-note-srv-input').value = '';
            document.getElementById('summary-note-custom-notes-input').value = '';
            snTableBody.innerHTML = '';
            summaryNotePrintArea.classList.add('hidden');
            if (summaryNoteCountDisplay) summaryNoteCountDisplay.textContent = '';
            sessionStorage.removeItem('imSummaryPrevNote');
            sessionStorage.removeItem('imSummaryCurrNote');
        });
    }

    if (summaryNoteCurrentInput) {
        summaryNoteCurrentInput.addEventListener('input', debounce((e) => {
            sessionStorage.setItem('imSummaryCurrNote', e.target.value);
        }, 500));
    }

// --- 3. DYNAMIC PRINT FOOTER ---
if (summaryNotePrintBtn) {
    summaryNotePrintBtn.addEventListener('click', () => {
        // 1. Create or find the print footer
        let printFooter = document.getElementById('dynamic-print-footer');
        if (!printFooter) {
            printFooter = document.createElement('div');
            printFooter.id = 'dynamic-print-footer';
            document.body.appendChild(printFooter);
        }
        
        // 2. Build the Footer Text
        const vendorName = snVendorName ? snVendorName.textContent.trim() : '';
        const d = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dateStr = `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`; 
        
        // Example: "Capital Trading 22-Apr-2026"
        printFooter.innerText = `${vendorName} ${dateStr}`;
        
        // 3. Open Print Window
        window.print();
    });
}

    // --- NEW: Previous Summary PDF Button ---
    if (summaryNotePrevPdfBtn) {
        summaryNotePrevPdfBtn.addEventListener('click', async () => {
            const prevNote = document.getElementById('summary-note-previous-input').value.trim();

            if (!prevNote) {
                alert("Please enter a 'Previous Note' to search for.");
                return;
            }

            summaryNotePrevPdfBtn.textContent = "Searching...";

            try {
                await ensureInvoiceDataFetched();

                let foundSrvName = null;
                let foundPo = null;

                // Scan all invoices to find the FIRST match for this note
                // We use a label to break out of both loops once found
                outerLoop:
                    for (const po in allInvoiceData) {
                        for (const key in allInvoiceData[po]) {
                            const inv = allInvoiceData[po][key];
                            // Check if note matches and we have a valid SRV name
                            if (inv.note === prevNote && inv.srvName && inv.srvName.toLowerCase() !== 'nil' && inv.srvName.trim() !== '') {
                                foundSrvName = inv.srvName;
                                foundPo = po;
                                break outerLoop; // Stop looking, we found one
                            }
                        }
                    }

                if (foundSrvName) {
                    const pdfUrl = buildSharePointPdfUrl(SRV_BASE_PATH, foundSrvName);
                    if (pdfUrl) window.open(pdfUrl, '_blank');
                } else {
                    alert(`No SRV document found for Previous Note: "${prevNote}"`);
                }

            } catch (e) {
                console.error("Error searching for Prev Summary:", e);
                alert("An error occurred while searching.");
            } finally {
                summaryNotePrevPdfBtn.innerHTML = '<i class="fa-regular fa-file-pdf"></i> Prev Summary';
            }
        });
    }

    if (imAddPaymentButton) {
        imAddPaymentButton.addEventListener('click', () => {
            imPaymentModalPOInput.value = '';
            imPaymentModalResults.innerHTML = '<p>Enter a PO number to see invoices ready for payment.</p>';
            imAddPaymentModal.classList.remove('hidden');
        });
    }
    if (imSavePaymentsButton) imSavePaymentsButton.addEventListener('click', handleSavePayments);
    if (imPaymentsTableBody) {
        imPaymentsTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('payment-remove-btn')) {
                const row = e.target.closest('tr');
                const key = row.dataset.key;
                if (key && invoicesToPay[key]) delete invoicesToPay[key];
                row.remove();
                updatePaymentsCount();
            }
        });
    }
    if (imPaymentModalSearchBtn) imPaymentModalSearchBtn.addEventListener('click', handlePaymentModalPOSearch);
    if (imPaymentModalPOInput) {
        imPaymentModalPOInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePaymentModalPOSearch();
            }
        });
    }
    if (imPaymentModalAddSelectedBtn) imPaymentModalAddSelectedBtn.addEventListener('click', handleAddSelectedToPayments);

    if (imFinancePrintReportBtn) imFinancePrintReportBtn.addEventListener('click', printFinanceReport);

    document.addEventListener('click', (e) => {
        const card = e.target.closest('.im-po-balance-card');
        if (card && card.dataset.toggleTarget) {
            const targetId = card.dataset.toggleTarget;
            const targetElement = document.querySelector(targetId);
            const icon = card.querySelector('.po-card-chevron');

            if (targetElement) {
                const isOpening = targetElement.classList.contains('hidden-invoice-list');

                if (isOpening) {
                    const allOpenLists = document.querySelectorAll('[id^="mobile-invoice-list-"]:not(.hidden-invoice-list)');
                    allOpenLists.forEach(listDiv => {
                        listDiv.classList.add('hidden-invoice-list');
                        const otherCard = document.querySelector(`[data-toggle-target="#${listDiv.id}"]`);
                        const otherIcon = otherCard ? otherCard.querySelector('.po-card-chevron') : null;
                        if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
                    });
                }

                targetElement.classList.toggle('hidden-invoice-list');
                if (icon) {
                    icon.style.transform = targetElement.classList.contains('hidden-invoice-list') ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            }
        }
    });

    // Mobile Search Modal Logic
    if (imMobileSearchBtn) {
        imMobileSearchBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof imOpenMobileInvoiceSearchModal === 'function') await imOpenMobileInvoiceSearchModal();
        });
    }

    if (imMobileSearchCloseBtn) {
        imMobileSearchCloseBtn.addEventListener('click', () => {
            if (typeof imCloseMobileInvoiceSearchModal === 'function') imCloseMobileInvoiceSearchModal();
            else if (imMobileSearchModal) imMobileSearchModal.classList.add('hidden');
        });
    }

    if (imMobileSearchClearBtn) {
        imMobileSearchClearBtn.addEventListener('click', () => {
            const idsToClear = [
                'im-mobile-search-term', 'im-mobile-site-filter', 'im-mobile-status-filter', 'im-mobile-date-filter',
                'im-reporting-search', 'im-reporting-site-filter', 'im-reporting-status-filter', 'im-reporting-month-filter', 'im-reporting-year-filter'
            ];
            idsToClear.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            sessionStorage.removeItem('imReportingSearch');
            currentReportData = [];

            const desktopContainer = document.getElementById('im-reporting-content');
            const mobileContainer = document.getElementById('im-reporting-mobile-view');

            if (desktopContainer) desktopContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-magnifying-glass"></i> <span style="margin-left: 8px;">Enter a search term and click Search to load data.</span></div>';
            if (mobileContainer) mobileContainer.innerHTML = imMobileInvoiceEmptyState('No Results Found', 'Use the Search button to find a PO, Vendor, or Invoice No.');
            const grandTotalContainer = document.getElementById('im-reporting-grand-total-container');
            if (grandTotalContainer) {
                grandTotalContainer.style.display = 'none';
                grandTotalContainer.innerHTML = '';
            }
            if (reportingCountDisplay) reportingCountDisplay.textContent = '(Found: 0)';
        });
    }

    if (imMobileSearchRunBtn) {
        imMobileSearchRunBtn.addEventListener('click', () => {
            // Sync desktop filters with mobile modal values so the existing invoice search engine is reused safely.
            const desktopSearch = document.getElementById('im-reporting-search');
            const mobileSearch = document.getElementById('im-mobile-search-term');
            const desktopSite = document.getElementById('im-reporting-site-filter');
            const mobileSite = document.getElementById('im-mobile-site-filter');
            const desktopStatus = document.getElementById('im-reporting-status-filter');
            const mobileStatus = document.getElementById('im-mobile-status-filter');
            const desktopMonth = document.getElementById('im-reporting-month-filter');
            const mobileDate = document.getElementById('im-mobile-date-filter');

            if (desktopSearch && mobileSearch) desktopSearch.value = mobileSearch.value.trim();
            if (desktopSite && mobileSite) desktopSite.value = mobileSite.value;
            if (desktopStatus && mobileStatus) desktopStatus.value = mobileStatus.value;
            if (desktopMonth && mobileDate) desktopMonth.value = mobileDate.value;

            sessionStorage.setItem('imReportingSearch', desktopSearch?.value || '');

            if (typeof imCloseMobileInvoiceSearchModal === 'function') imCloseMobileInvoiceSearchModal();
            else {
                const modal = document.getElementById('im-mobile-search-modal');
                if (modal) modal.classList.add('hidden');
            }

            if (typeof populateInvoiceReporting === 'function') {
                populateInvoiceReporting(desktopSearch?.value || '');
            } else {
                console.warn('populateInvoiceReporting not found');
            }
        });
    }

    // 7.4.5: Mobile Invoice Records inline search panel.
    // The mobile view now uses visible inline filters instead of a modal so it cannot get mixed with desktop search.
    if (!window.__ibaMobileInvoiceInlineSearchBound) {
        window.__ibaMobileInvoiceInlineSearchBound = true;
        document.addEventListener('click', async (e) => {
            const runBtn = e.target.closest('#im-mobile-inline-run-btn');
            if (!runBtn) return;
            const reportingSection = document.getElementById('im-reporting');
            const isReportingVisible = reportingSection && !reportingSection.classList.contains('hidden');
            const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
            const inventoryMode = (typeof isInventoryMobileModuleActive === 'function') ? isInventoryMobileModuleActive() : document.body.classList.contains('inventory-mode');
            if (!isMobile || !isReportingVisible || inventoryMode) return;
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof imRunMobileInlineInvoiceSearch === 'function') await imRunMobileInlineInvoiceSearch();
        }, true);

        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest('#im-mobile-inline-edit-btn, #im-mobile-inline-collapsed-summary');
            if (!editBtn) return;
            const reportingSection = document.getElementById('im-reporting');
            const isReportingVisible = reportingSection && !reportingSection.classList.contains('hidden');
            const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
            const inventoryMode = (typeof isInventoryMobileModuleActive === 'function') ? isInventoryMobileModuleActive() : document.body.classList.contains('inventory-mode');
            if (!isMobile || !isReportingVisible || inventoryMode) return;
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof imSetMobileInvoiceSearchCollapsed === 'function') imSetMobileInvoiceSearchCollapsed(false);
        }, true);

        document.addEventListener('click', (e) => {
            const clearBtn = e.target.closest('#im-mobile-inline-clear-btn');
            if (!clearBtn) return;
            const reportingSection = document.getElementById('im-reporting');
            const isReportingVisible = reportingSection && !reportingSection.classList.contains('hidden');
            const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
            const inventoryMode = (typeof isInventoryMobileModuleActive === 'function') ? isInventoryMobileModuleActive() : document.body.classList.contains('inventory-mode');
            if (!isMobile || !isReportingVisible || inventoryMode) return;
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof imClearMobileInlineInvoiceSearch === 'function') imClearMobileInlineInvoiceSearch();
        }, true);
    }

    // 7.4.3: Mobile invoice records search safety net.
    // On mobile, any visible Search button in Invoice Records should open the modal,
    // not run the desktop table search directly.
    if (!window.__ibaMobileInvoiceSearchDelegated) {
        window.__ibaMobileInvoiceSearchDelegated = true;
        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('#im-mobile-search-btn, #im-reporting-search-btn');
            if (!btn) return;
            const reportingSection = document.getElementById('im-reporting');
            const isReportingVisible = reportingSection && !reportingSection.classList.contains('hidden');
            const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
            const inventoryMode = (typeof isInventoryMobileModuleActive === 'function') ? isInventoryMobileModuleActive() : document.body.classList.contains('inventory-mode');
            if (!isMobile || !isReportingVisible || inventoryMode) return;

            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof imOpenMobileInvoiceSearchModal === 'function') await imOpenMobileInvoiceSearchModal();
        }, true);

        const reportingForm = document.getElementById('im-reporting-form');
        if (reportingForm) {
            reportingForm.addEventListener('submit', async (e) => {
                const reportingSection = document.getElementById('im-reporting');
                const isReportingVisible = reportingSection && !reportingSection.classList.contains('hidden');
                const isMobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : ((window.innerWidth || 0) <= 900);
                const inventoryMode = (typeof isInventoryMobileModuleActive === 'function') ? isInventoryMobileModuleActive() : document.body.classList.contains('inventory-mode');
                if (!isMobile || !isReportingVisible || inventoryMode) return;

                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                if (typeof imOpenMobileInvoiceSearchModal === 'function') await imOpenMobileInvoiceSearchModal();
            }, true);
        }
    }

    if (modifyTaskStatus) {
        modifyTaskStatus.addEventListener('change', (e) => {
            modifyTaskStatusOtherContainer.classList.toggle('hidden', e.target.value !== 'Other');
            if (typeof wdApplyIPCModifyTaskAutomation === 'function') wdApplyIPCModifyTaskAutomation();
            if (typeof wdToggleModifyTaskInvoiceConvertFields === 'function') wdToggleModifyTaskInvoiceConvertFields();
        });
    }
    if (modifyTaskSaveBtn) {
        modifyTaskSaveBtn.addEventListener('click', handleSaveModifiedTask);
    }

    if (ceoModalApproveBtn) ceoModalApproveBtn.addEventListener('click', () => handleCEOAction('Approved'));
    if (ceoModalRejectBtn) ceoModalRejectBtn.addEventListener('click', () => handleCEOAction('Rejected'));
    if (sendCeoApprovalReceiptBtn) sendCeoApprovalReceiptBtn.addEventListener('click', previewAndSendReceipt);
    if (mobileSendReceiptBtn) mobileSendReceiptBtn.addEventListener('click', previewAndSendReceipt);

    // --- NEW: Job Entry "View Attachment" Button Logic ---
    const jobAttachmentViewBtn = document.getElementById('job-attachment-view-btn');
    if (jobAttachmentViewBtn) {
        jobAttachmentViewBtn.addEventListener('click', () => {
            // 1. Get the filename from the input box
            const val = document.getElementById('job-attachment').value.trim();

            if (!val) {
                alert("Please paste a filename first.");
                return;
            }

            // 2. Smart Link Construction
            let fullPath;
            if (val.startsWith('http')) {
                // If they pasted a full link, use it as-is
                fullPath = val;
            } else {
                // If they just pasted "file.pdf", combine it with your specific path
                // encodeURIComponent ensures spaces become %20
                fullPath = ATTACHMENT_BASE_PATH + encodeURIComponent(val);
            }

            // 3. Open in new tab
            window.open(fullPath, '_blank');
        });
    }

    // ==========================================================================
    // NEW HELPERS: HISTORY TRACKING
    // ==========================================================================

    // 1. Log History to Firebase

// #endregion BLOCK 23 — INVOICE MANAGEMENT EVENT WIRING + ATTENTION CHOICE
