/* ==========================================================================
   js/app-workdesk-dashboard.js
   IBA WorkDesk dashboard, calendar/day view, and clean Job Records CSV export.
   Version: 8.1.4

   Cleanup Phase:
   - Moved Block 12 dashboard/calendar helpers out of app.js.
   - Public function names and existing behavior are preserved.
   - No invoice save logic, batch save logic, Firebase write paths, or inventory stock logic changed.
   ========================================================================== */

// =================================================================================================
// #region BLOCK 12 — WORKDESK DASHBOARD, CALENDAR + REPORTS
// Purpose: WorkDesk dashboard counts, admin/user calendar, month/year/day view, clean job-records CSV export.
// =================================================================================================

// --- Dashboard Population ---

async function populateWorkdeskDashboard() {
    // 1. Populate the user's personal task list
    await populateActiveTasks();

    // SAFEGUARD: Only update count if element exists
    const activeCountEl = document.getElementById('db-active-tasks-count');
    if (activeCountEl) {
        activeCountEl.textContent = userActiveTasks.length;
    }

    // 2. Populate the admin's "all tasks" list
    await populateAdminCalendarTasks();

    // 3. Populate completed tasks count
    await ensureAllEntriesFetched();

    let completedJobTasks = allSystemEntries.filter(task =>
        (task.enteredBy === currentApprover.Name || task.attention === currentApprover.Name) && isTaskComplete(task)
    );

    let completedInvoiceTasks = [];
    const isAccounting = (currentApprover.Position || '').toLowerCase() === 'accounting';

    await ensureInvoiceDataFetched();

    if (allInvoiceData) {
        for (const poNumber in allInvoiceData) {
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                const inv = poInvoices[invoiceKey];
                    // Skip completed SRV Done items (never show in Active Tasks)
                    if (String(inv.status || '').trim() === 'SRV Done') continue;
                const invoiceTask = {
                    key: `${poNumber}_${invoiceKey}`,
                    source: 'invoice',
                    remarks: inv.status,
                    enteredBy: isAccounting ? currentApprover.Name : 'Irwin'
                };

                let shouldInclude = false;
                if (isAccounting) {
                    if (isTaskComplete(invoiceTask)) shouldInclude = true;
                } else {
                    if (inv.attention === currentApprover.Name && isTaskComplete(invoiceTask)) shouldInclude = true;
                }

                if (shouldInclude) completedInvoiceTasks.push(invoiceTask);
            }
        }
    }

    const totalCompleted = completedJobTasks.length + completedInvoiceTasks.length;

    // SAFEGUARD: Only update count if element exists
    const completedCountEl = document.getElementById('db-completed-tasks-count');
    if (completedCountEl) {
        completedCountEl.textContent = totalCompleted;
    }
}

// --- Calendar Logic (Month, Year, Day Views) ---

function renderWorkdeskCalendar() {
    if (!wdCalendarGrid || !wdCalendarMonthYear) return;

    wdCalendarGrid.innerHTML = `
        <div class="wd-calendar-day-name">Sun</div>
        <div class="wd-calendar-day-name">Mon</div>
        <div class="wd-calendar-day-name">Tue</div>
        <div class="wd-calendar-day-name">Wed</div>
        <div class="wd-calendar-day-name">Thu</div>
        <div class="wd-calendar-day-name">Fri</div>
        <div class="wd-calendar-day-name">Sat</div>
    `;

    wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const year = wdCurrentCalendarDate.getFullYear();
    const month = wdCurrentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const blankDay = document.createElement('div');
        blankDay.className = 'wd-calendar-day other-month';
        wdCalendarGrid.appendChild(blankDay);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'wd-calendar-day';
        dayCell.textContent = day;

        const thisDate = new Date(year, month, day);
        thisDate.setHours(0, 0, 0, 0);

        const dateYear = thisDate.getFullYear();
        const dateMonth = String(thisDate.getMonth() + 1).padStart(2, '0');
        const dateDay = String(thisDate.getDate()).padStart(2, '0');
        dayCell.dataset.date = `${dateYear}-${dateMonth}-${dateDay}`;

        if (thisDate.getTime() === today.getTime()) {
            dayCell.classList.add('today');
        }
        wdCalendarGrid.appendChild(dayCell);
    }
}

async function populateAdminCalendarTasks() {
    if (!currentApprover || (currentApprover.Role || '').toLowerCase() !== 'admin') {
        allAdminCalendarTasks = [];
        return;
    }

    console.log("Admin user detected, populating full calendar...");
    let allTasks = [];

    // 1. Get all active JOB_ENTRIES
    await ensureAllEntriesFetched();
    const activeJobTasks = allSystemEntries.filter(entry => !isTaskComplete(entry));
    allTasks = allTasks.concat(activeJobTasks);

    // 2. Get all active INVOICE_ENTRIES
    await ensureInvoiceDataFetched();
    const unassignedStatuses = ['Pending', 'Report', 'Original PO'];

    if (allInvoiceData && allPOData) {
        for (const poNumber in allInvoiceData) {
            const poInvoices = allInvoiceData[poNumber];
            for (const invoiceKey in poInvoices) {
                const inv = poInvoices[invoiceKey];
                    // Skip completed SRV Done items (never show in Active Tasks)
                    if (String(inv.status || '').trim() === 'SRV Done') continue;
                const isAssignedActive = isInvoiceTaskActive(inv);
                const isUnassignedActive = unassignedStatuses.includes(inv.status) && (!inv.attention || inv.attention === '');

                if (isAssignedActive || isUnassignedActive) {
                    const poDetails = (typeof getInvoicePurchaseOrderDetails === 'function')
                    ? await getInvoicePurchaseOrderDetails(poNumber)
                    : ((typeof allPOData !== 'undefined' && allPOData && allPOData[poNumber]) ? allPOData[poNumber] : {});
                    const transformedInvoice = {
                        key: `${poNumber}_${invoiceKey}`,
                        originalKey: invoiceKey,
                        originalPO: poNumber,
                        source: 'invoice',
                        for: 'Invoice',
                        ref: inv.invNumber || '',
                        po: poNumber,
                        amount: inv.invValue || '',
                        site: poDetails['Project ID'] || 'N/A',
                        group: 'N/A',
                        attention: inv.attention || '',
                        enteredBy: 'Irwin',
                        date: formatYYYYMMDD(inv.invoiceDate),
                        calendarDate: formatYYYYMMDD(inv.releaseDate) !== 'N/A' ? formatYYYYMMDD(inv.releaseDate) : formatYYYYMMDD(inv.invoiceDate),
                        remarks: inv.status,
                        timestamp: (inv.releaseDate || inv.invoiceDate) ? new Date(inv.releaseDate || inv.invoiceDate).getTime() : Date.now(),
                        invName: inv.invName || '',
                        vendorName: poDetails['Supplier Name'] || 'N/A',
                        note: inv.note || ''
                    };
                    allTasks.push(transformedInvoice);
                }
            }
        }
    }
    allAdminCalendarTasks = allTasks;
}

async function populateCalendarTasks() {
    if (!currentApprover) return;

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    let tasks = [];
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key));

    if (isAdmin) {
        tasks = allAdminCalendarTasks;
    } else {
        tasks = userActiveTasks;
    }

    // Desktop Workdesk should hide inventory tasks from the calendar (mobile unchanged)
    if (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop()) {
        tasks = tasks.filter(t => !INVENTORY_TYPES.includes(t.for));
    }

    const tasksByDate = new Map();
    tasks.forEach(task => {
        let taskDateStr = task.calendarDate || task.date;
        if (taskDateStr) {
            const inputDate = convertDisplayDateToInput(taskDateStr);
            if (inputDate) {
                if (!tasksByDate.has(inputDate)) {
                    tasksByDate.set(inputDate, []);
                }
                tasksByDate.get(inputDate).push(task);
            }
        }
    });

    document.querySelectorAll('.wd-calendar-day[data-date]').forEach(dayCell => {
        const date = dayCell.dataset.date;
        const oldBadge = dayCell.querySelector('.task-count-badge');
        if (oldBadge) oldBadge.remove();

        if (tasksByDate.has(date)) {
            const tasksForDay = tasksByDate.get(date);
            const count = tasksForDay.length;

            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'task-count-badge';
                badge.textContent = count;

                let badgeColorSet = false;
                if (isAdmin) {
                    const hasMyTask = tasksForDay.some(task => myTaskKeys.has(task.key));
                    if (!hasMyTask) {
                        badge.classList.add('admin-view-only');
                        badgeColorSet = true;
                    }
                }
                if (!badgeColorSet) {
                    const allPendingSignature = tasksForDay.every(task => task.remarks === 'Pending Signature');
                    if (allPendingSignature) {
                        badge.classList.add('status-pending-signature');
                        badgeColorSet = true;
                    }
                }
                dayCell.appendChild(badge);
            }
        }
    });
}

function renderYearView() {
    if (!wdCalendarYearGrid) return;

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const year = wdCurrentCalendarDate.getFullYear();
    const baseTaskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    const taskSource = (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop())
        ? baseTaskSource.filter(t => !INVENTORY_TYPES.includes(t.for))
        : baseTaskSource;
    const myTaskKeys = new Set(userActiveTasks.map(task => task.key));

    const tasksByMonth = new Map();
    for (let i = 0; i < 12; i++) {
        tasksByMonth.set(i, []);
    }

    taskSource.forEach(task => {
        const taskDateStr = task.calendarDate || task.date;
        if (!taskDateStr) return;

        const taskDate = new Date(convertDisplayDateToInput(taskDateStr) + 'T00:00:00');
        if (taskDate.getFullYear() === year) {
            const monthIndex = taskDate.getMonth();
            tasksByMonth.get(monthIndex).push(task);
        }
    });

    wdCalendarYearGrid.innerHTML = '';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
        const monthCell = document.createElement('div');
        monthCell.className = 'wd-calendar-month-cell';
        monthCell.textContent = monthNames[i];
        monthCell.dataset.month = i;

        const tasksForThisMonth = tasksByMonth.get(i);
        const taskCount = tasksForThisMonth.length;

        if (taskCount > 0) {
            monthCell.classList.add('has-tasks');
            const badge = document.createElement('span');
            badge.className = 'month-task-count';
            badge.textContent = taskCount;

            let badgeColorSet = false;
            if (isAdmin) {
                const hasMyTask = tasksForThisMonth.some(task => myTaskKeys.has(task.key));
                if (!hasMyTask) {
                    monthCell.classList.add('admin-view-only');
                    badge.classList.add('admin-view-only');
                    badgeColorSet = true;
                }
            }
            if (!badgeColorSet) {
                const allPendingSignature = tasksForThisMonth.every(task => task.remarks === 'Pending Signature');
                if (allPendingSignature) {
                    monthCell.classList.add('status-pending-signature');
                    badge.classList.add('status-pending-signature');
                    badgeColorSet = true;
                }
            }
            monthCell.appendChild(badge);
        }
        wdCalendarYearGrid.appendChild(monthCell);
    }
}

function toggleCalendarView() {
    isYearView = !isYearView;

    wdCalendarGrid.classList.toggle('hidden', isYearView);
    wdCalendarYearGrid.classList.toggle('hidden', !isYearView);

    if (isYearView) {
        wdCalendarMonthYear.textContent = wdCurrentCalendarDate.getFullYear();
        wdCalendarToggleBtn.textContent = 'Month View';
        renderYearView();
    } else {
        wdCalendarMonthYear.textContent = wdCurrentCalendarDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        wdCalendarToggleBtn.textContent = 'Year View';
        renderWorkdeskCalendar();
        populateCalendarTasks();
    }
}

function displayCalendarTasksForDay(date) {
    document.querySelectorAll('.wd-calendar-day.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    const selectedCell = document.querySelector(`.wd-calendar-day[data-date="${date}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const baseTaskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    const taskSource = (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop())
        ? baseTaskSource.filter(t => !INVENTORY_TYPES.includes(t.for))
        : baseTaskSource;

    const tasks = taskSource.filter(task => {
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date);
        return taskDate === date;
    });

    const friendlyDate = formatYYYYMMDD(date);

    if (tasks.length > 0) {
        wdCalendarTaskListTitle.textContent = `Task Details for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';

        tasks.forEach(task => {
            const li = document.createElement('li');

            let statusClass = '';
            const status = task.remarks || 'Pending';
            if (status === 'Pending Signature') statusClass = 'status-pending-signature';
            if (status === 'For SRV') statusClass = 'status-for-srv';
            li.className = statusClass;

            const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
            const subInfo = task.vendorName ? task.vendorName : `(Ref: ${task.ref || 'N/A'})`;

            const amountDisplay = (task.amount && parseFloat(task.amount) > 0) ?
                ` - QAR ${formatCurrency(task.amount)}` :
                ``;

            if (task.po) {
                li.dataset.po = task.po;
                li.classList.add('clickable-task');
                li.title = `PO: ${task.po}\nDouble-click to search in IM Reporting`;
            }

            const noteHTML = task.note ?
                `<span style="color: var(--iba-secondary-terracotta); font-style: italic; margin-top: 4px;">Note: ${task.note}</span>` :
                '';

            const jobTypeHTML = task.for ?
                `<span style="font-weight: 600; margin-top: 4px;">Job: ${task.for}</span>` :
                '';

            li.innerHTML = `
                <strong>${mainInfo}${amountDisplay}</strong>
                <span>${subInfo}</span>
                ${jobTypeHTML}
                <span style="font-weight: 600; margin-top: 4px;">Status: ${status}</span>
                ${noteHTML}
            `;
            wdCalendarTaskListUl.appendChild(li);
        });

    } else {
        wdCalendarTaskListTitle.textContent = `No active tasks for ${friendlyDate}`;
        wdCalendarTaskListUl.innerHTML = '';
    }
}

function showDayView(date) {
    try {
        const parts = date.split('-').map(Number);
        wdCurrentDayViewDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } catch (e) {
        console.error("Invalid date passed to showDayView:", date, e);
        return;
    }

    workdeskSections.forEach(section => {
        section.classList.add('hidden');
    });
    const dayViewSection = document.getElementById('wd-dayview');
    dayViewSection.classList.remove('hidden');

    const friendlyDate = formatYYYYMMDD(date);
    document.getElementById('wd-dayview-title').textContent = `Tasks for ${friendlyDate}`;
    const mobileSubtitle = document.getElementById('wd-dayview-mobile-date-subtitle');
    if (mobileSubtitle) {
        const todayStr = getTodayDateString();
        if (date === todayStr) {
            mobileSubtitle.textContent = 'Today';
        } else {
            const subtitleDate = new Date(date + 'T00:00:00');
            mobileSubtitle.textContent = subtitleDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    }
    generateDateScroller(date);

    const isAdmin = (currentApprover.Role || '').toLowerCase() === 'admin';
    const isCEO = document.body.classList.contains('is-ceo');
    const baseTaskSource = isAdmin ? allAdminCalendarTasks : userActiveTasks;
    const taskSource = (typeof shouldExcludeInventoryFromWorkdeskDesktop === 'function' && shouldExcludeInventoryFromWorkdeskDesktop())
        ? baseTaskSource.filter(t => !INVENTORY_TYPES.includes(t.for))
        : baseTaskSource;

    const tasks = taskSource.filter(task => {
        const taskDate = convertDisplayDateToInput(task.calendarDate || task.date);
        return taskDate === date;
    });

    const taskListDiv = document.getElementById('wd-dayview-task-list');
    taskListDiv.innerHTML = '';

    if (tasks.length === 0) {
        taskListDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #555;">No tasks found for this day.</p>';
        return;
    }

    const myTaskKeys = new Set(userActiveTasks.map(t => t.key));

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'dayview-task-card';

        card.dataset.key = task.key;
        if (isCEO) {
            card.classList.add('ceo-clickable-day-card');
        }

        let borderColor = 'var(--iba-secondary-terracotta)';
        if (isAdmin && !myTaskKeys.has(task.key)) {
            borderColor = '#28a745';
        }
        card.style.borderLeft = `5px solid ${borderColor}`;

        if (isAdmin && task.po) {
            card.classList.add('admin-clickable-task');
            card.dataset.po = task.po;
            card.title = `Admin: Double-click to search for PO ${task.po} in IM Reporting`;
        }

        const mainInfo = task.po ? `PO: ${task.po}` : (task.ref || 'General Task');
        const amountDisplay = (task.amount && parseFloat(task.amount) > 0) ?
            ` - QAR ${formatCurrency(task.amount)}` :
            ``;

        const noteHTML = task.note ?
            `<div class="task-detail-item note"><span class="label">Note:</span> ${task.note}</div>` :
            '';

        card.innerHTML = `
            <strong>${mainInfo}${amountDisplay}</strong>
            <div class="task-details-grid">
                <div class="task-detail-item">
                    <span class="label">Vendor:</span> ${task.vendorName || 'N/A'}
                </div>
                <div class="task-detail-item">
                    <span class="label">Site:</span> ${task.site || 'N/A'}
                </div>
                <div class="task-detail-item">
                    <span class="label">Job:</span> ${task.for || 'N/A'}
                </div>
                <div class="task-detail-item status">
                    <span class="label">Status:</span> ${task.remarks || 'Pending'}
                </div>
                ${noteHTML}
            </div>
        `;
        taskListDiv.appendChild(card);
    });
}

function generateDateScroller(selectedDate) {
    const scrollerInner = document.getElementById('wd-dayview-date-scroller-inner');
    if (!scrollerInner) return;

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let html = '';

    const parts = selectedDate.split('-').map(Number);
    const centerDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    for (let i = -3; i <= 3; i++) {
        const currentDate = new Date(centerDate);
        currentDate.setUTCDate(centerDate.getUTCDate() + i);

        const dayNum = String(currentDate.getUTCDate()).padStart(2, '0');
        const dayInitial = days[currentDate.getUTCDay()];

        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;

        const isActive = (dateStr === selectedDate) ? 'active' : '';

        html += `
            <div class="day-scroller-item ${isActive}" data-date="${dateStr}">
                <span class="day-scroller-num">${dayNum}</span>
                <span class="day-scroller-char">${dayInitial}</span>
            </div>
        `;
    }

    scrollerInner.innerHTML = html;
    setTimeout(() => {
        const activeItem = scrollerInner.querySelector('.day-scroller-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest'
            });
        }
    }, 100);
}

// ==========================================================================
// FIX: Clean Excel Download (Removes Buttons before saving)
// ==========================================================================
function handleDownloadWorkdeskCSV() {
    const originalTable = document.querySelector("#reporting-printable-area table");
    if (!originalTable) {
        alert("Report table not found.");
        return;
    }

    // 1. Clone the table so we don't mess up the actual screen
    const tableClone = originalTable.cloneNode(true);

    // 2. REMOVE ALL BUTTONS & ICONS FROM THE CLONE
    // This strips out the "Print", "History", "Del" text
    const junk = tableClone.querySelectorAll('button, .action-btn, .waybill-btn, .history-btn, .delete-btn, i');
    junk.forEach(el => el.remove());

    // 3. Generate CSV from the CLEAN clone
    let csv = [];
    const rows = tableClone.querySelectorAll("tr");

    for (let i = 0; i < rows.length; i++) {
        const row = [],
            cols = rows[i].querySelectorAll("td, th");

        for (let j = 0; j < cols.length; j++) {
            // Clean up extra whitespace left behind by removed buttons
            // .trim() removes spaces from start/end
            let cleanText = cols[j].innerText.replace(/\s+/g, ' ').trim();

            // Escape double quotes for CSV format
            row.push('"' + cleanText.replace(/"/g, '""') + '"');
        }
        csv.push(row.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "job_records.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// #endregion BLOCK 12 — WORKDESK DASHBOARD, CALENDAR + REPORTS
