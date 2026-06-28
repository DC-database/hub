/* ==========================================================================
   js/app-ui-shortcuts.js
   IBA UI shortcuts, audio toggle UI, quick invoice buttons, WhatsApp inquiry,
   and invoice amount input formatters.
   Version: 8.1.0

   Cleanup Phase:
   - Moved Block 30 out of app.js.
   - Event names, public window functions, and existing behavior are preserved.
   - No Firebase paths, invoice save logic, or form data logic changed.
   ========================================================================== */

// =================================================================================================
// #region BLOCK 30 — UI SHORTCUTS, AUDIO TOGGLE + QUICK BUTTONS
// Purpose: Keyboard shortcuts, deletion collection, audio UI toggle, quick IPC buttons, WhatsApp inquiry, double-click copy, comma formatter.
// =================================================================================================

// --- GLOBAL SHORTCUT FOR BATCH ENTRY ---
document.addEventListener('keydown', (e) => {
    // 1. Check if the "Batch Search Modal" is currently open
    const batchModal = document.getElementById('im-batch-search-modal');
    if (batchModal && !batchModal.classList.contains('hidden')) {
        
        // 2. If Space bar is pressed
        if (e.code === 'Space' || e.key === ' ') {
            
            // 3. Safety: If the user is actually TYPING in the search box, 
            // let them type a space. If not typing, then "Add to Batch".
            if (document.activeElement.id !== 'im-batch-modal-po-input') {
                e.preventDefault();
                handleAddSelectedToBatch();
            }
        }
    }
});



window.imAddToDeletionCollection = async function(poNumber) {
    try {
        const searchVal = poNumber.replace(/[^0-9]/g, '');
        // Note: ensure progressDb is initialized in this file
        const ref = progressDb.ref('records');
        
        let snapshot = await ref.orderByChild('PO').equalTo(searchVal).once('value');
        if (!snapshot.exists()) {
            snapshot = await ref.orderByChild('PO').equalTo(parseInt(searchVal)).once('value');
        }

        if (snapshot.exists()) {
            const key = Object.keys(snapshot.val())[0];
            const recordData = snapshot.val()[key];

            // Add to localStorage so the PO Site can see it later
            let selectedPOs = {};
            try {
                selectedPOs = JSON.parse(localStorage.getItem('selectedPOs') || '{}');
            } catch (e) { selectedPOs = {}; }

            selectedPOs[key] = recordData;
            localStorage.setItem('selectedPOs', JSON.stringify(selectedPOs));

            // Update Button UI
            const btn = document.getElementById('im-po-collect-btn');
            if (btn) {
                btn.innerHTML = `<i class="fa-solid fa-check"></i> Added to List`;
                btn.style.background = "#059669";
                btn.disabled = true;
            }
        }
    } catch (error) {
        console.error("Collection Error:", error);
    }
};

// ======================================================================
// SETTINGS PAGE: AUDIO TOGGLE UI UPDATER
// ======================================================================
// Attached to 'window' so the HTML file can always find it!
window.handleAudioUIUpdate = function() {
    // 1. Trigger the master switch
    window.toggleSystemAudio(); 
    
    // 2. Update the button visuals
    const btn = document.getElementById('audio-toggle-btn');
    if (btn) {
        if (window.isAudioMuted) {
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Muted';
            btn.style.backgroundColor = '#f44336'; // Turns red when muted
            btn.style.color = 'white';
            btn.style.borderColor = '#f44336';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Enabled';
            btn.style.backgroundColor = ''; // Resets to your default
            btn.style.color = '';
            btn.style.borderColor = '';
        }
    }
};

// 3. Make sure the button shows the correct state when you first open the Settings page
document.addEventListener('DOMContentLoaded', () => {
    if (window.isAudioMuted) {
        const btn = document.getElementById('audio-toggle-btn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Muted';
            btn.style.backgroundColor = '#f44336';
            btn.style.color = 'white';
            btn.style.borderColor = '#f44336';
        }
    }
});

// --- SMART INJECTOR: IPC & FIVE BUTTONS FOR SINGLE INVOICE MODAL (V4 - SMART COUNT) ---
document.addEventListener('click', function(e) {
    // Short delay to let the modal fully open
    setTimeout(() => {
        // Find the specific invoice number input for this modal
        const invInput = document.getElementById('im-inv-no');

        if (invInput && invInput.closest('#im-invoice-entry-modal')) {
            // Check if buttons are already there to prevent duplicates
            if (!document.getElementById('smart-quick-fill-group')) {
                
                // 1. Create a "Row" wrapper so the input and buttons sit on the same line
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'display: flex; gap: 5px; width: 100%; align-items: stretch;';
                
                // 2. Move the text box inside our new wrapper
                invInput.parentNode.insertBefore(wrapper, invInput);
                wrapper.appendChild(invInput);
                
                // 3. Create the tiny buttons
                const btnGroup = document.createElement('div');
                btnGroup.id = 'smart-quick-fill-group';
                btnGroup.style.cssText = 'display: flex; gap: 4px; flex-shrink: 0;';
                
                btnGroup.innerHTML = `
                    <button type="button" id="btn-smart-ipc" tabindex="-1" title="Generate IPC" style="padding: 0 8px; font-size: 10px; font-weight: 800; background: #003A5C; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        IPC
                    </button>
                    <button type="button" id="btn-smart-five" tabindex="-1" title="Append to PO" style="padding: 0 8px; font-size: 10px; font-weight: 800; background: #00748C; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        FIVE
                    </button>
                `;

                // 4. Put the buttons right next to the text box
                wrapper.appendChild(btnGroup);

                // --- HELPER FUNCTION: RELIABLY FIND THE PO NUMBER ---
                const getActivePo = () => {
                    const poSpan = document.querySelector('#im-invoice-entry-modal .im-po-no');
                    if (poSpan && poSpan.textContent && poSpan.textContent !== '---') {
                        return poSpan.textContent.trim();
                    }
                    return null;
                };

                // --- 1. IPC BUTTON LOGIC (WITH DEEP SEARCH COUNTER) ---
                document.getElementById('btn-smart-ipc').addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const activePo = getActivePo();
                    if (!activePo) return alert("Could not detect PO Number from the modal.");

                    let count = 0;
                    let foundData = false;
                    
// DEEP SEARCH: Look through your system's data arrays to find the real count
    if (typeof allInvoiceData !== 'undefined' && allInvoiceData[activePo]) {
        // This is the main database array where invoices are actually stored!
        count = Object.keys(allInvoiceData[activePo]).length;
        foundData = true;
    }
    else if (typeof allInvoicesByPO !== 'undefined' && allInvoicesByPO[activePo]) {
        count = Object.keys(allInvoicesByPO[activePo]).length;
        foundData = true;
    } 
    else if (typeof allInvoices !== 'undefined' && Array.isArray(allInvoices)) {
        count = allInvoices.filter(inv => String(inv.poNumber) === String(activePo) || String(inv.PONumber) === String(activePo)).length;
        foundData = true;
    }
    else if (typeof invoiceRecords !== 'undefined' && Array.isArray(invoiceRecords)) {
        count = invoiceRecords.filter(inv => String(inv.poNumber) === String(activePo)).length;
        foundData = true;
    }
    else if (typeof currentReportData !== 'undefined' && Array.isArray(currentReportData)) {
        // Wait, currentReportData is a structured array. We need to check inside filteredInvoices.
        const poData = currentReportData.find(data => String(data.poNumber) === String(activePo));
        if (poData && poData.filteredInvoices) {
            count = poData.filteredInvoices.length;
            foundData = true;
        }
    }
                    
                    // FALLBACK: If we can't find the array, just ask you so it never fails!
                    if (!foundData) {
                        const manualCount = prompt(`Could not auto-count existing invoices for PO ${activePo}.\nHow many invoices currently exist for this PO?`, "0");
                        if (manualCount !== null) {
                            count = parseInt(manualCount, 10) || 0;
                        } else {
                            return; // You clicked cancel
                        }
                    }
                    
                    // Add 1 to the count and format it (e.g. 03)
                    const nextNum = String(count + 1).padStart(2, '0');
                    invInput.value = `${activePo}.IPC/${nextNum}`;
                    invInput.focus();
                });

                // --- 2. FIVE BUTTON LOGIC ---
                document.getElementById('btn-smart-five').addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const activePo = getActivePo();
                    if (!activePo) return alert("Could not detect PO Number from the modal.");

                    const currentVal = invInput.value.trim();
                    if (currentVal.startsWith(activePo + '.')) return; 
                    
                    invInput.value = `${activePo}.${currentVal}`;
                    invInput.focus();
                });
            }
        }
    }, 150); 
});

// Function to send a WhatsApp inquiry with the Invoice PDF link
window.imSendWhatsAppInquiry = function(invoiceNo, pdfUrl) {
    if (!pdfUrl || pdfUrl === 'undefined' || pdfUrl === '') {
        alert("No PDF link found for this invoice. Please ensure the file was uploaded.");
        if (typeof soundError !== 'undefined') soundError.play();
        return;
    }

    // Defaulting to 974 for local numbers, adjust if needed
    const phone = prompt("Enter the WhatsApp number to send this inquiry to (include country code):", "974");
    if (!phone) return;

    // Constructing the message with the PDF link instead of the approval page
    const message = `Hello, I would like to inquire or request an update regarding Invoice #${invoiceNo}.\n\nYou can review the invoice document here:\n${pdfUrl}`;
    
    const encodedMessage = encodeURIComponent(message);
    const waLink = `https://wa.me/${phone}?text=${encodedMessage}`;
    
    window.open(waLink, '_blank');
}

// --- SMART DOUBLE-CLICK TO COPY (INVOICE NAME & SRV NAME) ---
document.addEventListener('dblclick', async (e) => {
    // Check if the thing you double-clicked is an input box named 'invName' or 'srvName'
    if (e.target.tagName === 'INPUT' && (e.target.name === 'invName' || e.target.name === 'srvName')) {
        
        const textToCopy = e.target.value.trim();
        
        if (textToCopy) {
            try {
                // 1. Copy the text to the computer's clipboard
                await navigator.clipboard.writeText(textToCopy);
                
                // 2. Select the text visually so it looks "grabbed"
                e.target.select();
                
                // 3. Flash the background green for half a second as visual proof!
                const originalBg = e.target.style.backgroundColor;
                const originalColor = e.target.style.color;
                const originalTransition = e.target.style.transition;
                
                e.target.style.transition = 'background-color 0.2s ease, color 0.2s ease';
                e.target.style.backgroundColor = '#4ade80'; // Bright Green
                e.target.style.color = '#023020';           // Dark Green Text
                
                setTimeout(() => {
                    e.target.style.backgroundColor = originalBg;
                    e.target.style.color = originalColor;
                    
                    // Remove the transition style after it finishes so it doesn't mess with hover effects
                    setTimeout(() => { e.target.style.transition = originalTransition; }, 200);
                }, 400);
                
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        }
    }
});


// --- SMART COMMA FORMATTER (INVOICE VALUE & AMOUNT PAID) ---

// When you click OUTSIDE the box, format it beautifully (10,035.00)
document.addEventListener('focusout', (e) => {
    if (e.target.name === 'invValue' || e.target.name === 'amountPaid') {
        let val = e.target.value.replace(/,/g, ''); // Temporarily strip existing commas
        if (val && !isNaN(val)) {
            e.target.value = parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }
});

// When you click INSIDE the box to edit, remove the commas so typing is easy!
document.addEventListener('focusin', (e) => {
    if (e.target.name === 'invValue' || e.target.name === 'amountPaid') {
        let val = e.target.value.replace(/,/g, ''); 
        if (val) {
            e.target.value = val;
        }
    }
});



// #endregion BLOCK 30 — UI SHORTCUTS, AUDIO TOGGLE + QUICK BUTTONS