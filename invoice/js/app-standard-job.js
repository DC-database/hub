/* ==========================================================================
   js/app-standard-job.js
   IBA WorkDesk standard job modal, job history, and approval sticker printing.
   Version: 11.0.4

   Cleanup Phase:
   - Moved Block 25 out of app.js.
   - Public function names and window bindings are preserved.
   - 11.0.4: Reception delete button now appears for their own initial-stage IPC Application / IPC Processed records.
   - No invoice save logic, batch save logic, Firebase path names, or inventory stock logic changed.
   ========================================================================== */

// =================================================================================================
// #region BLOCK 25 — STANDARD JOB MODAL + STICKER PRINTING
// Purpose: Standard job modal open/close, job history, sticker print renderer, approval history saver.
// =================================================================================================

    function wdStandardResetInvoiceGroupOptions() {
        const groupSelect = document.getElementById('job-group');
        if (!groupSelect) return;
        groupSelect.innerHTML = `
            <option value="" disabled selected>Select Group / Category</option>
            <option value="Normal">Normal</option>
            <option value="Logistic">Logistic</option>
            <option value="HSE">HSE</option>
        `;
    }

    function wdStandardEnsureInvoiceGroupValue(value) {
        const groupSelect = document.getElementById('job-group');
        const clean = String(value || '').trim();
        if (!groupSelect || !clean) return;
        const hasOption = Array.from(groupSelect.options).some(opt => opt.value === clean);
        if (!hasOption) {
            const opt = document.createElement('option');
            opt.value = clean;
            opt.textContent = `${clean} (legacy)`;
            groupSelect.appendChild(opt);
        }
        groupSelect.value = clean;
    }

    window.openStandardJobModal = function (mode, entryData = null) {
        const modal = document.getElementById('standard-job-modal');
        const title = document.getElementById('standard-modal-title');

        // 7.3.4: Rebuild the Job Type dropdown every time the modal opens,
        // so WorkDesk and Inventory do not share the same type list.
        if (typeof updateJobTypeDropdown === 'function') {
            updateJobTypeDropdown();
        }

        // Get Buttons
        const addBtn = document.getElementById('add-job-button');
        const updateBtn = document.getElementById('update-job-button');
        const deleteBtn = document.getElementById('delete-job-button');

        // 1. ADD MODE
        if (mode === 'Add') {
            resetJobEntryForm(false); // Clean form
            wdStandardResetInvoiceGroupOptions();
            title.textContent = "Add New Job Entry";

            // Show Add, Hide Update/Delete
            addBtn.classList.remove('hidden');
            updateBtn.classList.add('hidden');
            deleteBtn.classList.add('hidden');

            // Ensure Invoice-only fields are hidden by default
            if (typeof toggleJobInvoiceFields === 'function') {
                toggleJobInvoiceFields();
            }
        }
        // 2. EDIT MODE
        else if (mode === 'Edit' && entryData) {
            currentlyEditingKey = entryData.key;
            title.textContent = "Edit Job Entry";

            // Hide Add, Show Update
            addBtn.classList.add('hidden');
            updateBtn.classList.remove('hidden');

            // 8.7.3: make the Update button explicitly usable for Job Records edit mode.
            // This keeps Hafiz/original entry users from being blocked by an old disabled
            // state or a cached modal state after opening a record. Actual save validation
            // still happens inside handleUpdateJobEntry().
            updateBtn.disabled = false;
            updateBtn.removeAttribute('disabled');
            updateBtn.style.pointerEvents = 'auto';
            updateBtn.style.opacity = '1';
            updateBtn.textContent = 'Update Job';

            // Check permission for Delete button
            // - Irwin (Accounting) can delete any job entry (existing behavior)
            // - Reception can delete their own initial-stage Invoice New Entry.
            // - 11.0.4: Reception can also delete their own initial-stage
            //   IPC Application / IPC Processed records before completion/conversion.
            const userName = (currentApprover?.Name || '').trim();
            const userNameLower = String(userName || '').trim().toLowerCase();
            const userPositionLower = (currentApprover?.Position || '').toLowerCase();

            let canShowDelete = false;
            if (userName === 'Irwin' && userPositionLower === 'accounting') {
                canShowDelete = true;
            } else {
                const isReceptionUser = userNameLower.includes('hafiz') || userPositionLower.includes('reception');
                if (isReceptionUser) {
                    const jobType = String(entryData.for || entryData.jobType || '').trim().toLowerCase();
                    const creator = String(entryData.createdBy || entryData.enteredBy || entryData.requestor || '').trim().toLowerCase();
                    const remarks = String(entryData.remarks || entryData.status || '').trim().toLowerCase();
                    const hasResponded = !!entryData.dateResponded;
                    const creatorOk = (!creator) || creator === userNameLower || creator.includes('hafiz') || creator.includes('reception') || ['admin','system'].includes(creator);

                    if (creatorOk && !hasResponded) {
                        if (jobType === 'invoice' && ['new entry', 'pending', ''].includes(remarks)) {
                            canShowDelete = true;
                        } else if (jobType === 'ipc application' && ['pending', 'ipc issue', ''].includes(remarks)) {
                            canShowDelete = true;
                        } else if ((jobType === 'ipc processed' || jobType === 'ipc') && ['waiting invoice', 'pending', 'ipc', ''].includes(remarks)) {
                            canShowDelete = true;
                        }
                    }
                }
            }

            if (canShowDelete) deleteBtn.classList.remove('hidden');
            else deleteBtn.classList.add('hidden');

            // Populate Form Data
            wdStandardResetInvoiceGroupOptions();
            // 10.1.6: legacy plain IPC is now edited/saved as IPC Processed.
            const entryForRaw = String(entryData.for || entryData.jobType || '').trim();
            const entryForDisplay = (entryForRaw === 'IPC') ? 'IPC Processed' : (entryForRaw || 'Other');
            document.getElementById('job-for').value = entryForDisplay;
            // Handle "Other" Input Visibility
            if (!['PR', 'Invoice', 'IPC Application', 'IPC Processed', 'Payment', 'Report', 'Transfer', 'Restock', 'Return', 'Usage'].includes(entryForDisplay)) {
                document.getElementById('job-for').value = 'Other';
                document.getElementById('job-other-specify').value = entryForDisplay;
                document.getElementById('job-other-specify').classList.remove('hidden');
            } else {
                document.getElementById('job-other-specify').classList.add('hidden');
            }

            document.getElementById('job-ref').value = entryData.ref || '';
            document.getElementById('job-po').value = entryData.po || '';
            document.getElementById('job-amount').value = entryData.amount || '';
            document.getElementById('job-attachment').value = entryData.attachmentName || '';
            if (String(entryForDisplay || '').trim() === 'Invoice') {
                wdStandardEnsureInvoiceGroupValue(entryData.group || '');
            } else {
                const groupSelect = document.getElementById('job-group');
                if (groupSelect) groupSelect.value = '';
            }
            document.getElementById('job-status').value = (entryData.remarks === 'Pending') ? '' : entryData.remarks || '';
            const currentNoteInput = document.getElementById('job-current-note');
            if (currentNoteInput) currentNoteInput.value = entryData.note || entryData.details || entryData.currentNote || '';

            // Invoice-only: vendor + invoice date
            // 10.1.3: Non-Invoice records such as IPC must not show/carry invoice date.
            const isInvoiceJobEntry = String(entryForDisplay || '').trim() === 'Invoice';
            if (jobInvoiceDateInput) jobInvoiceDateInput.value = isInvoiceJobEntry ? (entryData.invoiceDate || '') : '';
            if (jobVendorNameInput) jobVendorNameInput.value = isInvoiceJobEntry ? (entryData.vendorName || '') : '';
            if (jobVendorIdInput) jobVendorIdInput.value = isInvoiceJobEntry ? (entryData.vendorId || '') : '';

            if (typeof toggleJobInvoiceFields === 'function') {
                toggleJobInvoiceFields();
            }

            if (siteSelectChoices) siteSelectChoices.setChoiceByValue(entryData.site || '');
            if (attentionSelectChoices) attentionSelectChoices.setChoiceByValue(entryData.attention || '');
        }

        modal.classList.remove('hidden');
    };

    // B. CLOSE MODAL
    window.closeStandardJobModal = function () {
        document.getElementById('standard-job-modal').classList.add('hidden');
        // Optional: clear form on close
        resetJobEntryForm(false);
    };

    // ==========================================================================
    // NEW: SHOW JOB HISTORY (IPC, PR, etc.)
    // ==========================================================================
    window.showJobHistory = async function (key) {
    const modal = document.getElementById('history-modal');
    const loader = document.getElementById('history-modal-loader');
    const tbody = document.getElementById('history-table-body');

    if (modal) modal.classList.remove('hidden');
    if (loader) loader.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';

    try {
        // 1. Get the entry
        const snapshot = await db.ref(`job_entries/${key}`).once('value');
        const entry = snapshot.val();

        if (!entry) throw new Error("Entry not found");

        const historyData = [];

        // 2. Parse History (array or object)
        if (entry.history) {
            if (Array.isArray(entry.history)) {
                historyData.push(...entry.history);
            } else {
                Object.values(entry.history).forEach(h => historyData.push(h));
            }
        }

        if (historyData.length === 0) {
            if (loader) loader.classList.add('hidden');
            tbody.innerHTML = '<tr><td colspan="4">No history recorded.</td></tr>';
            return;
        }

        // 3. Sort ASC (oldest -> newest) to calculate duration between changes
        historyData.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

        // 4. Calculate Duration Display (same as Invoice history)
        historyData.forEach((h, index) => {
            if (index === 0) {
                h.durationDisplay = '-';
            } else {
                const prevTs = Number(historyData[index - 1].timestamp) || 0;
                const currTs = Number(h.timestamp) || 0;
                const diffMs = Math.max(0, currTs - prevTs);

                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                if (diffDays > 0) h.durationDisplay = `${diffDays}d ${diffHrs}h`;
                else if (diffHrs > 0) h.durationDisplay = `${diffHrs}h ${diffMins}m`;
                else h.durationDisplay = `${diffMins}m`;
            }
        });

        // 5. Reverse back to DESC for display (newest first)
        historyData.reverse();

        if (loader) loader.classList.add('hidden');

        historyData.forEach((h) => {
            const dateObj = new Date(Number(h.timestamp) || Date.now());
            const dateStr = dateObj.toLocaleDateString('en-GB') + ' ' + dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            const who = h.by || h.updatedBy || h.updatedByName || 'System';

            const row = `
                <tr>
                    <td><strong>${h.action || h.status || ''}</strong><br><small>${h.note || ''}</small></td>
                    <td>${dateStr}</td>
                    <td>${who}</td>
                    <td style="font-weight: bold; color: #00748C;">${h.durationDisplay || '-'}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        if (loader) loader.classList.add('hidden');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
};

// =========================================================
// 3. SMART STICKER POSITIONING (SAFE STRINGS FIX)
// =========================================================
window.handlePrintSticker = async function(key, type, poNumber) {
    if (!key || !poNumber) {
        alert("Missing data for print.");
        return;
    }
    var safePO = poNumber.replace(/[.#$[\]]/g, '_');
    var recordKey = safePO + "_" + key;

    // 12.6.0 — Explicit sticker placement.
    var printPosition = prompt(
        "PRINT APPROVAL STICKER\n\n" +
        "1 = LEFT\n" +
        "2 = MIDDLE\n" +
        "3 = RIGHT\n" +
        "4 = AUTO (recommended for multiple stickers)",
        "4"
    );
    if (printPosition === null) return;
    printPosition = String(printPosition).trim();
    if (!["1", "2", "3", "4"].includes(printPosition)) {
        alert("Invalid choice. Enter 1, 2, 3, or 4.");
        return;
    }

    try {
        if (!allApproverData) {
            var snap = await db.ref('approvers').once('value');
            allApproverData = snap.val();
        }

        var snap = await db.ref('manager_approved/' + recordKey).once('value');
        var data = snap.val();
        var rawStickers = [];

        if (data) {
            ['1', '2', '3', 'ceo'].forEach(function(slot) {
                if (data['esn_' + slot]) {
                    rawStickers.push({
                        esn: data['esn_' + slot],
                        pdf: data['pdf_' + slot],
                        approverName: data['approver_' + slot] || 'Unknown',
                        date: data['date_' + slot],
                        isCeo: (slot === 'ceo')
                    });
                }
            });
        } else {
            // Fallback for Admin manual print (if no approval record)
            var invSnap = await invoiceDb.ref('invoice_entries/' + poNumber + '/' + key).once('value');
            var inv = invSnap.val();
            if (inv && inv.esn) {
                var safeEsn = inv.esn.replace(/[^a-zA-Z0-9]/g, '_');
                rawStickers.push({
                    esn: inv.esn,
                    pdf: "https://firebasestorage.googleapis.com/v0/b/invoiceentry-b15a8.firebasestorage.app/o/receipts%2F" + safeEsn + ".pdf?alt=media",
                    approverName: 'Admin',
                    date: new Date().toLocaleDateString('en-GB')
                });
            }
        }

        if (rawStickers.length === 0) {
            alert("No approval stickers found.");
            return;
        }

        // 12.6.0 — Determine PO and invoice sequence for the sticker.
        var invoiceRecord = null;
        var invoiceOrdinal = 1;
        try {
            var invSnap = await invoiceDb.ref('invoice_entries/' + poNumber + '/' + key).once('value');
            invoiceRecord = invSnap.val() || {};

            var allInvSnap = await invoiceDb.ref('invoice_entries/' + poNumber).once('value');
            var allInv = allInvSnap.val() || {};

            function getExplicitInvNumber(k, row) {
                var candidates = [
                    k,
                    row.invEntryID,
                    row.invoiceEntryID,
                    row.entryID,
                    row.invEntryNo,
                    row.invoiceEntryNo,
                    row.entryNo
                ];
                for (var n = 0; n < candidates.length; n++) {
                    var match = String(candidates[n] || '').match(/(?:^|[^A-Z0-9])INV[-_ ]?(\d+)(?:$|[^0-9])/i);
                    if (match) return parseInt(match[1], 10);
                }
                return null;
            }

            var explicitNo = getExplicitInvNumber(key, invoiceRecord);
            if (explicitNo !== null && explicitNo > 0) {
                invoiceOrdinal = explicitNo;
            } else {
                var rows = Object.keys(allInv).map(function(k) {
                    return { key: k, data: allInv[k] || {} };
                });

                rows.sort(function(a, b) {
                    var ad = Number(a.data.dateAdded || a.data.timestamp || a.data.enteredAt || 0);
                    var bd = Number(b.data.dateAdded || b.data.timestamp || b.data.enteredAt || 0);

                    if (ad && bd && ad !== bd) return ad - bd;
                    if (ad && !bd) return -1;
                    if (!ad && bd) return 1;

                    return String(a.key).localeCompare(String(b.key), undefined, { numeric: true });
                });

                var foundIndex = rows.findIndex(function(row) { return row.key === key; });
                if (foundIndex >= 0) invoiceOrdinal = foundIndex + 1;
            }
        } catch (ordinalError) {
            console.warn("Invoice sequence lookup failed; using 01.", ordinalError);
            invoiceOrdinal = 1;
        }

        var poDisplay = String(poNumber || 'N/A');
        var ordinalDisplay = String(invoiceOrdinal).padStart(2, '0');

        rawStickers.forEach(function(sticker) {
            sticker.poDisplay = poDisplay;
            sticker.invoiceOrdinal = ordinalDisplay;
        });

        var middleZone = []; // Managers
        var ceoZone = [];    // CEO

        rawStickers.forEach(function(sticker) {
            if (sticker.isCeo) {
                ceoZone.push(sticker);
                return;
            }
            // Group everyone else (Managers/COO/Finance) into the main row
            middleZone.push(sticker);
        });

        var finalStickers = [];

        // --- 1. CEO POSITION ---
        ceoZone.forEach(function(s, i) {
            if (printPosition === "1" || printPosition === "2" || printPosition === "3") {
                var ceoLeft = printPosition === "1" ? 16 : (printPosition === "2" ? 50 : 84);
                var ceoBottom = 20 + (i * 32);
                s.cssPosition = "bottom: " + ceoBottom + "mm; left: " + ceoLeft + "%; transform: translateX(-50%);";
            } else {
                s.cssPosition = "bottom: 60mm; right: 15%; transform: translateX(50%);";
            }
            s.displayName = "APPROVED";
            finalStickers.push(s);
        });

        // --- 2. MANAGER SMART POSITIONING ---
        var midCount = middleZone.length;
        
        middleZone.forEach(function(s, i) {
            var leftPercent = 50; // Default fallback

            if (midCount === 1) {
                // 1 Signature: Fall to the Right Spot (not middle)
                leftPercent = 85; 
            } 
            else if (midCount === 2) {
                // 2 Signatures: 1st Middle, 2nd Right
                if (i === 0) leftPercent = 50;
                if (i === 1) leftPercent = 85;
            } 
            else if (midCount === 3) {
                // 3 Signatures: Left, Middle, Right
                if (i === 0) leftPercent = 15;
                if (i === 1) leftPercent = 50;
                if (i === 2) leftPercent = 85;
            } 
            else if (midCount === 4) {
                // 4 Signatures: Left, Share Middle (40,60), Right
                if (i === 0) leftPercent = 15;
                if (i === 1) leftPercent = 38;
                if (i === 2) leftPercent = 62;
                if (i === 3) leftPercent = 85;
            }
            else {
                // 5+ Signatures: Distribute evenly
                leftPercent = 15 + (i * (70 / (midCount - 1)));
            }

            if (printPosition === "1" || printPosition === "2" || printPosition === "3") {
                var selectedLeft = printPosition === "1" ? 16 : (printPosition === "2" ? 50 : 84);
                // Explicit placement: stack multiple stickers vertically at the selected side.
                var selectedBottom = 20 + (i * 32);
                s.cssPosition = "bottom: " + selectedBottom + "mm; left: " + selectedLeft + "%; transform: translateX(-50%);";
            } else {
                s.cssPosition = "bottom: 20mm; left: " + leftPercent + "%; transform: translateX(-50%);";
            }
            s.displayName = "APPROVED";
            finalStickers.push(s);
        });

        proceedToPrintMulti(finalStickers);

    } catch (e) {
        console.error("Print Error:", e);
        alert("Error loading print data.");
    }
};
// =========================================================
// 4. PRINT RENDERER (SAFE STRINGS FIX)
// =========================================================
function proceedToPrintMulti(stickerList) {
    var htmlStickers = "";
    stickerList.forEach(function(s) {
        htmlStickers += createStickerHTML(s, s.cssPosition);
    });

    var printWindow = window.open('', '', 'width=1000,height=1200');
    if (!printWindow) {
        alert("Please allow pop-ups to print the approval.");
        return;
    }

    var content = '<html><head><title>Approval Print</title>';
    content += '<style>@page { size: A4; margin: 0; } body { margin: 0; padding: 0; width: 210mm; height: 297mm; position: relative; font-family: "Arial", sans-serif; } ';
    content += '.sticker-box { position: absolute; width: max-content; min-width: 48mm; padding: 2mm 3mm; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; z-index: 100; box-sizing: border-box; } ';
    content += '.main { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; } ';
    content += '.status { font-weight: 900; font-size: 8pt; text-transform: uppercase; margin: 0; color: #000; text-align: center; white-space: nowrap; font-family: "Courier New", monospace; } ';
    content += '.approved-word { color: #16803c; } ';
    content += '.po-part { color: #18324a; } ';
    content += '.count-part { color: #d22b2b; } ';
    content += '.esn { font-weight: bold; font-size: 8pt; margin-top: 1.5mm; font-family: "Courier New", monospace; white-space: nowrap; color: #000; text-align: center; } ';
    content += '.approval-divider { width: 80%; border-top: 0.4pt dashed #000; margin: 1.5mm 0 1mm; } ';
    content += '.side { width: auto; height: auto; display: block; font-weight: normal; font-size: 8pt; margin: 0; color: #000; font-family: "Courier New", monospace; text-align: center; writing-mode: horizontal-tb; }';
    content += '</style></head><body>';
    content += htmlStickers;
    content += '<script>setTimeout(function(){ window.print(); }, 150);<\/script>';
    content += '</body></html>';

    printWindow.document.write(content);
    printWindow.document.close();
}


function createStickerHTML(data, cssPosition) {
    var title = data.displayName || "APPROVED";
    var po = String(data.poDisplay || data.po || "N/A");
    var ordinal = String(data.invoiceOrdinal || "01").padStart(2, "0");

    function esc(v) {
        return String(v == null ? "" : v).replace(/[&<>"']/g, function(c) {
            return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c];
        });
    }

    var safeEsn = esc(data.esn || "");
    var safeDate = esc(data.date || new Date().toLocaleDateString("en-GB"));

    return '<div class="sticker-box" style="' + cssPosition + '">' +
           '<div class="main">' +
           '<div class="status"><span class="approved-word">' + esc(title) + '</span><span class="po-part">/' + esc(po) + '</span><span class="count-part">(' + esc(ordinal) + ')</span></div>' +
           '<div class="esn">' + safeEsn + '</div>' +
           '<div class="approval-divider"></div>' +
           '<div class="side">' + safeDate + '</div>' +
           '</div>' +
           '</div>';
}

// --- Helper to actually open the window ---
function proceedToPrint(positionClass, roleLabel, esnDisplay, pdfLink, entry) {
    const isRejected = (entry.remarks === 'Rejected' || entry.status === 'Rejected');
    const statusText = isRejected ? "REJECTED" : roleLabel;
    const statusColor = isRejected ? "#D32F2F" : "#28a745";
    const dateStr = new Date().toLocaleDateString('en-GB');

    const printWindow = window.open('', '', 'width=1000,height=1200');
    if (!printWindow) {
        alert("Please allow pop-ups to print the approval.");
        return;
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>Approval Print - ${String(esnDisplay || '').replace(/[<>&"]/g, '')}</title>
            <style>
                @page { size: A4; margin: 0; }
                body { margin: 0; padding: 0; width: 210mm; height: 297mm; position: relative; font-family: Arial, sans-serif; }
                #sticker {
                    position: absolute;
                    width: auto;
                    padding: 5px;
                    display: flex;
                    flex-direction: row;
                    box-sizing: border-box;
                    align-items: center;
                    background: white;
                    z-index: 100;
                }
                .pos-bottom-left { bottom: 20mm; left: 20mm; }
                .pos-bottom-right { bottom: 20mm; right: 20mm; }
                .pos-bottom-center { bottom: 20mm; left: 50%; transform: translateX(-50%); }
                .pos-ceo-stack { bottom: 55mm; right: 20mm; }
                .main { text-align: center; padding-right: 6px; border-right: 1px solid #000; }
                .status { font-weight: 900; font-size: 16px; text-transform: uppercase; margin-bottom: 3px; color: ${statusColor}; }
                .esn { font-weight: bold; font-size: 9px; margin-top: 2px; font-family: monospace; white-space: nowrap; color: #000; }
                .side {
                    width: 15px; display: flex; align-items: center; justify-content: center;
                    writing-mode: vertical-rl; text-orientation: mixed; font-weight: bold;
                    font-size: 9px; margin-left: 5px; height: 55px;
                }
            </style>
        </head>
        <body>
            <div id="sticker" class="${positionClass}">
                <div class="main">
                    <div class="status">${statusText}</div>
                    <div class="esn">${String(esnDisplay || '').replace(/[<>&"]/g, '')}</div>
                </div>
                <div class="side">${dateStr}</div>
            </div>
            <script>
                setTimeout(() => { window.print(); }, 150);
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


// =========================================================
// HELPER: Save Approval to History List
// =========================================================
async function saveApprovalToList(po, key, esn, name, role) {
    try {
        await invoiceDb.ref(`invoice_entries/${po}/${key}/approvals`).push({
            esn: esn,
            approver: name,
            role: role || 'Approver',
            date: new Date().toLocaleDateString('en-GB'),
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    } catch (e) {
        console.error("Failed to save approval list:", e);
    }
}

// =========================================================

// #endregion BLOCK 25 — STANDARD JOB MODAL + STICKER PRINTING
