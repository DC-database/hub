// =================================================================================================
// IBA System v8.2.9
// DOM REFERENCES / PAGE ELEMENT MAP
// Moved out of app.js in v8.2.9 (cleanup only).
// Purpose: Login, dashboard, WorkDesk, Invoice Management, Batch Entry, Payments, Reporting, mobile/modals DOM constants.
// Public helper names are preserved for existing modules and event handlers.
// =================================================================================================

// #region BLOCK 08 — DOM REFERENCES / PAGE ELEMENT MAP
// Purpose: Login, dashboard, WorkDesk, Invoice Management, Batch Entry, Payments, Reporting, mobile/modals DOM constants.
// =================================================================================================

// ==========================================================================
// 5. DOM ELEMENT REFERENCES
// ==========================================================================

// --- Main Views ---
const views = {
    login: document.getElementById('login-view'),
    password: document.getElementById('password-view'),
    setup: document.getElementById('setup-view'),
    dashboard: document.getElementById('dashboard-view'),
    workdesk: document.getElementById('workdesk-view')
};

// --- Login & Setup Forms ---
const loginForm = document.getElementById('login-form');
const loginIdentifierInput = document.getElementById('login-identifier');
const desktopLoginPasswordInput = document.getElementById('login-password-desktop');
const loginError = document.getElementById('login-error');
const passwordForm = document.getElementById('password-form');
const passwordInput = document.getElementById('login-password');
const passwordUserIdentifier = document.getElementById('password-user-identifier');
const passwordError = document.getElementById('password-error');
const setupForm = document.getElementById('setup-form');
const setupEmailContainer = document.getElementById('setup-email-container');
const setupEmailInput = document.getElementById('setup-email');
const setupSiteContainer = document.getElementById('setup-site-container');
const setupSiteInput = document.getElementById('setup-site');
const setupPositionContainer = document.getElementById('setup-position-container');
const setupPositionInput = document.getElementById('setup-position');
const setupPasswordInput = document.getElementById('setup-password');
const setupError = document.getElementById('setup-error');

// --- Main Dashboard & Workdesk Navigation ---
const dashboardUsername = document.getElementById('dashboard-username');
const datetimeElement = document.getElementById('datetime');
const logoutButton = document.getElementById('logout-button');
const workdeskButton = document.getElementById('workdesk-button');
const wdUsername = document.getElementById('wd-username');
const wdUserIdentifier = document.getElementById('wd-user-identifier');
const workdeskNav = document.getElementById('workdesk-nav');
const workdeskSections = document.querySelectorAll('.workdesk-section');
const wdLogoutButton = document.getElementById('wd-logout-button');
const workdeskDatetimeElement = document.getElementById('workdesk-datetime');
const workdeskIMLinkContainer = document.getElementById('workdesk-im-link-container');
const workdeskIMLink = document.getElementById('workdesk-im-link');
const wdHelpLink = document.getElementById('wd-help-link');
const invHelpLink = document.getElementById('inv-help-link');

// --- Workdesk: Job Entry ---
const jobEntryForm = document.getElementById('jobentry-form');
const jobForSelect = document.getElementById('job-for');
const jobDateInput = document.getElementById('job-date');
// Invoice-only fields inside the standard job modal
const jobInvoiceFieldsContainer = document.getElementById('job-invoice-fields');
const jobInvoiceDateInput = document.getElementById('job-invoice-date');
const jobGroupContainer = document.getElementById('job-group-container');
const jobVendorNameInput = document.getElementById('job-vendor-name');
const jobVendorIdInput = document.getElementById('job-vendor-id');
const jobVendorNameList = document.getElementById('job-vendor-name-list');
const jobVendorSuggestBox = document.getElementById('job-vendor-suggest-box');
// Invoice Management: Manual PO vendor autocomplete box
const manualVendorSuggestBox = document.getElementById('manual-vendor-suggest-box');
const jobEntrySearchInput = document.getElementById('job-entry-search');
const jobEntryTableWrapper = document.getElementById('job-entry-table-wrapper');
const jobEntryTableBody = document.getElementById('job-entry-table-body');
const jobEntryFormTitle = document.getElementById('standard-modal-title');
const deleteJobButton = document.getElementById('delete-job-button');
const jobEntryNavControls = document.getElementById('jobentry-nav-controls');
const navPrevJobButton = document.getElementById('nav-prev-job');
const navNextJobButton = document.getElementById('nav-next-job');
const navJobCounter = document.getElementById('nav-job-counter');
const addJobButton = document.getElementById('add-job-button');
const updateJobButton = document.getElementById('update-job-button');
const clearJobButton = document.getElementById('clear-job-button');

// --- Workdesk: Active Tasks ---
const activeTaskTableBody = document.getElementById('active-task-table-body');
const activeTaskFilters = document.getElementById('active-task-filters');
const activeTaskSearchInput = document.getElementById('active-task-search');
const activeTaskCountDisplay = document.getElementById('active-task-count-display');
const dbActiveTasksCount = document.getElementById('db-active-tasks-count');
const activeTaskClearButton = document.getElementById('active-task-clear-button');
const activeTaskCardLink = document.getElementById('db-active-tasks-card-link'); // Dashboard card

// --- Workdesk: Calendar & Day View ---
const wdCalendarGrid = document.getElementById('wd-calendar-grid');
const wdCalendarMonthYear = document.getElementById('wd-calendar-month-year');
const wdCalendarPrevBtn = document.getElementById('wd-calendar-prev');
const wdCalendarNextBtn = document.getElementById('wd-calendar-next');
const wdCalendarTaskListTitle = document.getElementById('wd-calendar-task-list-title');
const wdCalendarTaskListUl = document.getElementById('wd-calendar-task-list-ul');
const wdCalendarToggleBtn = document.getElementById('wd-calendar-toggle-view');
const wdCalendarYearGrid = document.getElementById('wd-calendar-year-grid');
const dayViewBackBtn = document.getElementById('wd-dayview-back-btn');
const dayViewPrevBtn = document.getElementById('wd-dayview-prev-btn');
const dayViewNextBtn = document.getElementById('wd-dayview-next-btn');
const dayViewTaskList = document.getElementById('wd-dayview-task-list');
const mobileMenuBtn = document.getElementById('wd-dayview-mobile-menu-btn');
const mobileNotifyBtn = document.getElementById('wd-dayview-mobile-notify-btn');
const mobileLogoutBtn = document.getElementById('wd-dayview-mobile-logout-btn-new');
const dateScroller = document.getElementById('wd-dayview-date-scroller-inner');
const calendarModalViewTasksBtn = document.getElementById('calendar-modal-view-tasks-btn');

// --- Workdesk: Reporting & Stats ---
const reportingTableBody = document.getElementById('reporting-table-body');
const reportingSearchInput = document.getElementById('reporting-search');
const reportTabsContainer = document.getElementById('report-tabs');
const printReportButton = document.getElementById('print-report-button');
const downloadWdReportButton = document.getElementById('download-wd-report-csv-button');
const wdInTransitReportBtn = document.getElementById('wd-inventory-intransit-report-btn');
const wdInTransitContactFilterSelect = document.getElementById('wd-inventory-intransit-contact-filter');
const dbCompletedTasksCount = document.getElementById('db-completed-tasks-count');
const dbSiteStatsContainer = document.getElementById('dashboard-site-stats');
const dbRecentTasksBody = document.getElementById('db-recent-tasks-body');
const jobRecordsCountDisplay = document.getElementById('job-records-count-display');

// --- Workdesk: Settings ---
const settingsForm = document.getElementById('settings-form');
const settingsNameInput = document.getElementById('settings-name');
const settingsEmailInput = document.getElementById('settings-email');
const settingsMobileInput = document.getElementById('settings-mobile');
const settingsPositionInput = document.getElementById('settings-position');
const settingsSiteInput = document.getElementById('settings-site');
const settingsPasswordInput = document.getElementById('settings-password');
const settingsVacationCheckbox = document.getElementById('settings-vacation');
const settingsReturnDateInput = document.getElementById('settings-return-date');
const settingsMessage = document.getElementById('settings-message');
const settingsVacationDetailsContainer = document.getElementById('settings-vacation-details-container');
const settingsReplacementNameInput = document.getElementById('settings-replacement-name');
const settingsReplacementContactInput = document.getElementById('settings-replacement-contact');
const settingsReplacementEmailInput = document.getElementById('settings-replacement-email');

// --- Workdesk: Super Admin Celebration Banner Settings ---
const celebrationSettingsContainer = document.getElementById('celebration-settings-container');
const celebrationEnabledCheckbox = document.getElementById('celebration-enabled');
const celebrationTitleInput = document.getElementById('celebration-title-input');
const celebrationSubtitleInput = document.getElementById('celebration-subtitle-input');
const celebrationEmojiInput = document.getElementById('celebration-emoji-input');
const celebrationStartDateInput = document.getElementById('celebration-start-date');
const celebrationEndDateInput = document.getElementById('celebration-end-date');
const celebrationShowModeSelect = document.getElementById('celebration-show-mode');
const celebrationSoundEnabledCheckbox = document.getElementById('celebration-sound-enabled');
const celebrationSoundUrlInput = document.getElementById('celebration-sound-url');
const celebrationSaveBtn = document.getElementById('celebration-save-btn');
const celebrationDisableBtn = document.getElementById('celebration-disable-btn');
const celebrationPreviewBtn = document.getElementById('celebration-preview-btn');
const celebrationSettingsMessage = document.getElementById('celebration-settings-message');



// --- Invoice Management (IM) Common ---
const invoiceManagementView = document.getElementById('invoice-management-view');
const imNav = document.getElementById('im-nav');
const imContentArea = document.getElementById('im-content-area');
const imMainElement = document.querySelector('#invoice-management-view .workdesk-main');
const invoiceManagementButton = document.getElementById('invoice-mgmt-button');
const imUsername = document.getElementById('im-username');
const imUserIdentifier = document.getElementById('im-user-identifier');
const imLogoutButton = document.getElementById('im-logout-button');
const imDatetimeElement = document.getElementById('im-datetime');
const imWorkdeskButton = document.getElementById('im-workdesk-button');
const imActiveTaskButton = document.getElementById('im-activetask-button');
const imBackToWDDashboardLink = document.getElementById('im-back-to-wd-dashboard-link'); // Mobile

// --- IM: Invoice Entry ---
const imPOSearchInput = document.getElementById('im-po-search-input');
const imPOSearchButton = document.getElementById('im-po-search-button');
const imPOSearchInputBottom = document.getElementById('im-po-search-input-bottom');
const imPOSearchButtonBottom = document.getElementById('im-po-search-button-bottom');
const imPODetailsContainer = document.getElementById('im-po-details-container');
const imNewInvoiceForm = document.getElementById('im-new-invoice-form');
const imInvoiceEntryModal = document.getElementById('im-invoice-entry-modal');
const imInvoiceFormTrigger = document.getElementById('im-invoice-form-trigger');
const imOpenInvoiceFormBtn = document.getElementById('im-open-invoice-form-btn');
const imInvEntryIdInput = document.getElementById('im-inv-entry-id');
const imFormTitle = document.getElementById('im-form-title');
const imAttentionSelect = document.getElementById('im-attention');
const imAddInvoiceButton = document.getElementById('im-add-invoice-button');
const imUpdateInvoiceButton = document.getElementById('im-update-invoice-button');
const imClearFormButton = document.getElementById('im-clear-form-button');
const imBackToActiveTaskButton = document.getElementById('im-back-to-active-task-button');
const imExistingInvoicesContainer = document.getElementById('im-existing-invoices-container');
const imInvoicesTableBody = document.getElementById('im-invoices-table-body');
const imInvoiceDateInput = document.getElementById('im-invoice-date');
const imReleaseDateInput = document.getElementById('im-release-date');
const imStatusSelect = document.getElementById('im-status');
const imInvValueInput = document.getElementById('im-inv-value');
const imAmountPaidInput = document.getElementById('im-amount-paid');
const existingInvoicesCountDisplay = document.getElementById('existing-invoices-count-display');
const imEntrySidebar = document.getElementById('im-entry-sidebar');
const imEntrySidebarList = document.getElementById('im-entry-sidebar-list');
const imShowActiveJobsBtn = document.getElementById('im-show-active-jobs-btn');
const activeJobsSidebarCountDisplay = document.getElementById('active-jobs-sidebar-count-display');



// =============================================================
// IM: Invoice Entry – UI helpers (visual only; does NOT change logic)
// =============================================================
const imAttentionGroup = document.getElementById('im-attention-group');

// imIsAttentionRequiredForStatus moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// imUpdateAttentionRequiredUI moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// imClearInvoiceInvalidUI moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// imMarkInvoiceInvalidUI moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// Clear invalid visuals as user types/changes (keeps the UI clean)
// imWireInvoiceValidationUI moved to js/app-attention-validation.js in v8.2.3 (cleanup only).
// --- IM: Batch Entry ---
const batchTableBody = document.getElementById('im-batch-table-body');
const batchClearBtn = document.getElementById('im-batch-clear-button');
const batchCountDisplay = document.getElementById('batch-count-display');
const imBatchSearchExistingButton = document.getElementById('im-batch-search-existing-button');
const imBatchSearchModal = document.getElementById('im-batch-search-modal');
const imBatchNoteSearchSelect = document.getElementById('im-batch-note-search-select');
const imBatchGlobalAttention = document.getElementById('im-batch-global-attention');
const imBatchGlobalStatus = document.getElementById('im-batch-global-status');
const imBatchGlobalNote = document.getElementById('im-batch-global-note');
const batchAddBtn = document.getElementById('im-batch-add-po-button');
const batchSaveBtn = document.getElementById('im-batch-save-button');
const batchPOInput = document.getElementById('im-batch-po-input');
const batchSearchStatusBtn = document.getElementById('im-batch-search-by-status-button');
const batchSearchNoteBtn = document.getElementById('im-batch-search-by-note-button');

// Batch Entry: Per-row Attention picker (modal)
const imAttentionPickerModal = document.getElementById('im-attention-picker-modal');
const imAttentionPickerSelect = document.getElementById('im-attention-picker-select');
const imAttentionPickerApplyBtn = document.getElementById('im-attention-picker-apply');
const imAttentionPickerCancelBtn = document.getElementById('im-attention-picker-cancel');
const imAttentionPickerCloseBtn = document.getElementById('im-attention-picker-close');

let imAttentionPickerChoices = null;
let imAttentionPickerActiveRow = null;

// --- IM: Payments ---
const paymentsNavLink = document.getElementById('payments-nav-link');
const imPaymentsSection = document.getElementById('im-payments');
const imAddPaymentButton = document.getElementById('im-add-payment-button');
const imPaymentsTableBody = document.getElementById('im-payments-table-body');
const imSavePaymentsButton = document.getElementById('im-save-payments-button');
const imAddPaymentModal = document.getElementById('im-add-payment-modal');
const imPaymentModalPOInput = document.getElementById('im-payment-modal-po-input');
const imPaymentModalSearchBtn = document.getElementById('im-payment-modal-search-btn');
const imPaymentModalResults = document.getElementById('im-payment-modal-results');
const imPaymentModalAddSelectedBtn = document.getElementById('im-payment-modal-add-selected-btn');
const paymentsCountDisplay = document.getElementById('payments-count-display');

// --- IM: Reporting & Finance ---
const imReportingForm = document.getElementById('im-reporting-form');
const imReportingContent = document.getElementById('im-reporting-content');
const imReportingSearchInput = document.getElementById('im-reporting-search');
const imReportingClearButton = document.getElementById('im-reporting-clear-button');
const imReportingDownloadCSVButton = document.getElementById('im-reporting-download-csv-button');
const imReportingPrintBtn = document.getElementById('im-reporting-print-btn');
const imReportingPrintableArea = document.getElementById('im-reporting-printable-area');
const imDailyReportDateInput = document.getElementById('im-daily-report-date');
const imDownloadDailyReportButton = document.getElementById('im-download-daily-report-button');
const imDownloadWithAccountsReportButton = document.getElementById('im-download-with-accounts-report-button');
const imReportingDownloadExcelButton = document.getElementById('im-reporting-download-btn');
const reportingCountDisplay = document.getElementById('reporting-count-display');
// Print Report Elements
const imPrintReportTitle = document.getElementById('im-print-report-title');
const imPrintReportDate = document.getElementById('im-print-report-date');
const imPrintReportSummaryPOs = document.getElementById('im-print-report-summary-pos');
const imPrintReportSummaryValue = document.getElementById('im-print-report-summary-value');
const imPrintReportSummaryPaid = document.getElementById('im-print-report-summary-paid');
const imPrintReportBody = document.getElementById('im-print-report-body');

// --- IM: Finance Report (Admin) ---
const imFinanceReportNavLink = document.getElementById('im-finance-report-nav-link');
const imFinanceReportModal = document.getElementById('im-finance-report-modal');
const imFinancePrintReportBtn = document.getElementById('im-finance-print-report-btn');
// Finance Modal Details
const imReportDate = document.getElementById('im-reportDate');
const imReportPoNo = document.getElementById('im-reportPoNo');
const imReportProject = document.getElementById('im-reportProject');
const imReportVendorId = document.getElementById('im-reportVendorId');
const imReportVendorName = document.getElementById('im-reportVendorName');
const imReportTotalPoValue = document.getElementById('im-reportTotalPoValue');
const imReportTotalCertified = document.getElementById('im-reportTotalCertified');
const imReportTotalPrevPayment = document.getElementById('im-reportTotalPrevPayment');
const imReportTotalCommitted = document.getElementById('im-reportTotalCommitted');
const imReportTotalRetention = document.getElementById('im-reportTotalRetention');
const imReportTableBody = document.getElementById('im-reportTableBody');
const imReportTotalCertifiedAmount = document.getElementById('im-reportTotalCertifiedAmount');
const imReportTotalRetentionAmount = document.getElementById('im-reportTotalRetentionAmount');
const imReportTotalPaymentAmount = document.getElementById('im-reportTotalPaymentAmount');
const imReportNotesSection = document.getElementById('im-reportNotesSection');
const imReportNotesContent = document.getElementById('im-reportNotesContent');

// --- IM: Summary Note ---
const summaryNotePreviousInput = document.getElementById('summary-note-previous-input');
const summaryNoteCurrentInput = document.getElementById('summary-note-current-input');
const summaryNoteGenerateBtn = document.getElementById('summary-note-generate-btn');
const summaryNoteUpdateBtn = document.getElementById('summary-note-update-btn');
const summaryNotePrevPdfBtn = document.getElementById('summary-note-prev-pdf-btn'); // <--- ADD THIS
const summaryNotePrintBtn = document.getElementById('summary-note-print-btn');
const summaryNotePrintArea = document.getElementById('summary-note-printable-area');
const snDate = document.getElementById('sn-date');
const snPrevSummaryDate = document.getElementById('sn-prev-summary-date');
const snVendorName = document.getElementById('sn-vendor-name');
const snPreviousPayment = document.getElementById('sn-previous-payment');
const snCurrentPayment = document.getElementById('sn-current-payment');
const snTableBody = document.getElementById('sn-table-body');
const snTotalInWords = document.getElementById('sn-total-in-words');
const snTotalNumeric = document.getElementById('sn-total-numeric');
const noteSuggestionsDatalist = document.getElementById('note-suggestions');
const summaryNoteCountDisplay = document.getElementById('summary-note-count-display');
const summaryClearBtn = document.getElementById('summary-note-clear-btn');

// --- Modals & Mobile Elements ---
const ceoApprovalModal = document.getElementById('ceo-approval-modal');
const ceoModalDetails = document.getElementById('ceo-modal-details');
const ceoModalAmount = document.getElementById('ceo-modal-amount');
const ceoModalNote = document.getElementById('ceo-modal-note');
const ceoModalApproveBtn = document.getElementById('ceo-modal-approve-btn');
const ceoModalRejectBtn = document.getElementById('ceo-modal-reject-btn');
const sendCeoApprovalReceiptBtn = document.getElementById('send-ceo-approval-receipt-btn');

const vacationModal = document.getElementById('vacation-replacement-modal');
const vacationingUserName = document.getElementById('vacationing-user-name');
const vacationReturnDate = document.getElementById('vacation-return-date');
const replacementNameDisplay = document.getElementById('replacement-name-display');
const replacementContactDisplay = document.getElementById('replacement-contact-display');
const replacementEmailDisplay = document.getElementById('replacement-email-display');

const modifyTaskModal = document.getElementById('modify-task-modal');
const modifyTaskAttention = document.getElementById('modify-task-attention');
const modifyTaskStatus = document.getElementById('modify-task-status');
const modifyTaskStatusOtherContainer = document.getElementById('modify-task-status-other-container');
const modifyTaskStatusOther = document.getElementById('modify-task-status-other');
const modifyTaskNote = document.getElementById('modify-task-note');
const modifyTaskSaveBtn = document.getElementById('modify-task-save-btn');
const modifyTaskKey = document.getElementById('modify-task-key');
const modifyTaskSource = document.getElementById('modify-task-source');
const modifyTaskOriginalPO = document.getElementById('modify-task-originalPO');
const modifyTaskOriginalKey = document.getElementById('modify-task-originalKey');

// Mobile Search & Misc
const imMobileSearchBtn = document.getElementById('im-mobile-search-btn');
const imMobileSearchModal = document.getElementById('im-mobile-search-modal');
const imMobileSearchRunBtn = document.getElementById('im-mobile-search-run-btn');
const imMobileSearchClearBtn = document.getElementById('im-mobile-search-clear-btn');
const imMobileSearchCloseBtn = document.querySelector('[data-modal-id="im-mobile-search-modal"]');
const wdImReportingLinkMobile = document.getElementById('wd-im-reporting-link-mobile');
const imNavReportingLinkMobile = document.getElementById('im-nav-reporting-link-mobile'); // New Selector
const mobileSendReceiptBtn = document.getElementById('mobile-send-receipt-btn');
const mobileActiveTaskLogoutBtn = document.getElementById('mobile-activetask-logout-btn');
const imMobileActiveTaskLink = document.getElementById('im-mobile-activetask-link');
const mobileActiveTaskRefreshBtn = document.getElementById('mobile-activetask-refresh-btn');
const mobileLoginForm = document.getElementById('mobile-login-form');

// --- Badges ---
const wdActiveTaskBadge = document.getElementById('wd-active-task-badge');
const imActiveTaskBadge = document.getElementById('im-active-task-badge');
const wdMobileNotifyBadge = document.getElementById('wd-mobile-notify-badge');
const imMobileNavBadge = document.getElementById('im-mobile-nav-badge');

// ======================================================================
// INVENTORY PHASE 1/2 helper functions moved to js/app-inventory.js in 7.5.4.
// The main app keeps badge updates here, while inventory context/type/record helpers
// now live in the Inventory JS foundation file.
// ======================================================================

function setBadgeState(badge, count) {
    if (!badge) return;
    const safeCount = Number(count || 0);
    badge.textContent = safeCount;
    badge.style.display = safeCount > 0 ? 'inline-block' : 'none';
}

function setPulseState(el, active) {
    if (!el) return;
    if (active) el.classList.add('nav-pulse-active');
    else el.classList.remove('nav-pulse-active');
}

function updateActiveTaskModuleBadges(urgentCount, totalTaskCount, moduleName) {
    const isInventoryModule = moduleName === 'inventory';
    const count = Number(urgentCount || 0);

    const wdActiveLink = document.querySelector('.wd-nav-activetask a');
    const imActiveLink = document.getElementById('im-activetask-button');
    const mobileActiveLink = document.getElementById('im-mobile-activetask-link');

    if (isInventoryModule) {
        // Inventory lives in the WorkDesk shell for now, but its badge must count
        // only inventory transfer/usage/return/restock tasks.
        setBadgeState(wdActiveTaskBadge, count);
        setBadgeState(wdMobileNotifyBadge, count);
        setPulseState(wdActiveLink, count > 0);

        // Avoid leaking inventory badge/pulse into Invoice Management.
        setBadgeState(imActiveTaskBadge, 0);
        setBadgeState(imMobileNavBadge, 0);
        setPulseState(imActiveLink, false);
        setPulseState(mobileActiveLink, false);
        return;
    }

    // Normal WorkDesk / Invoice mode must ignore inventory tasks. Both existing
    // WorkDesk and Invoice active task badges keep using the non-inventory count.
    setBadgeState(wdActiveTaskBadge, count);
    setBadgeState(wdMobileNotifyBadge, count);
    setBadgeState(imActiveTaskBadge, count);
    setBadgeState(imMobileNavBadge, count);

    setPulseState(wdActiveLink, count > 0);
    setPulseState(imActiveLink, count > 0);
    setPulseState(mobileActiveLink, count > 0);
}






// #endregion BLOCK 08 — DOM REFERENCES / PAGE ELEMENT MAP
