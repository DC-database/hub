// js/app-vacation.js
// IBA WorkDesk vacation delegation helpers.
// Moved from app.js in v8.0.5 cleanup only. Function names are preserved.

// --- Vacation Delegation Helpers (Super Admin Replacement) ---
// When SUPER_ADMIN_NAME enables Vacation in Settings and sets ReplacementName,
// that replacement user is granted temporary Invoice Management access (except Delete, which remains Irwin-only).
const SUPER_ADMIN_NAME = "Irwin";

function getCachedApproversData() {
    return (typeof allApproverDataCache !== 'undefined' && allApproverDataCache) ? allApproverDataCache : allApproverData;
}

// Safe accessor used by Direct Messages.
// Some packages missed this helper which caused the DM user list to be empty.
function getApproversDataSafe() {
    try {
        const d = getCachedApproversData();
        if (d && typeof d === 'object') return d;
    } catch (_) { /* ignore */ }
    return {};
}

function getActiveVacationConfig() {
    const approversData = getCachedApproversData();
    if (!approversData) return null;

    for (const key in approversData) {
        const a = approversData[key];
        if (!a) continue;
        const name = (a.Name || '').trim();
        if (!name || name.toLowerCase() !== SUPER_ADMIN_NAME.toLowerCase()) continue;

        const vacationVal = a.Vacation;
        const onVacation = vacationVal === true || vacationVal === "Yes" || (typeof vacationVal === 'string' && vacationVal.toLowerCase() === 'yes');
        if (!onVacation) return null;

        const replacementName = (a.ReplacementName || '').trim();
        if (!replacementName) return null;

        const returnStr = (a.DateReturn || '').trim();
        let returnDate = null;
        if (returnStr) {
            const d = new Date(returnStr);
            if (!isNaN(d)) {
                d.setHours(23, 59, 59, 999);
                returnDate = d;
            }
        }

        // Auto-disable after return date (no DB write; just treated as inactive)
        const now = new Date();
        if (returnDate && now > returnDate) return null;

        return { superAdminKey: key, replacementName, returnDateStr: returnStr || '' };
    }
    return null;
}

function isVacationDelegateUser() {
    const vac = getActiveVacationConfig();
    if (!vac || !currentApprover) return false;
    const currentName = (currentApprover.Name || '').trim();
    return currentName && currentName.toLowerCase() === vac.replacementName.toLowerCase();
}

// getInvoiceHandlerName moved to js/app-invoice.js (7.6.1)

// --- General Vacation Delegation (All Users) ---
// Any user can enable Vacation in Settings and set ReplacementName + (optional) DateReturn.
// When active, tasks assigned to the vacationing user will:
//  - route to the replacement at creation/update time (where possible), and
//  - appear in the replacement's Active Tasks list even if already assigned to the vacationing user.
function _normName(v) { return String(v || '').trim().toLowerCase(); }

function _parseReturnDate(dateStr) {
    const s = String(dateStr || '').trim();
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d)) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

function getActiveVacationByName(name) {
    const approversData = getCachedApproversData();
    const target = _normName(name);
    if (!approversData || !target) return null;

    for (const key in approversData) {
        const a = approversData[key];
        if (!a) continue;
        const aName = _normName(a.Name);
        if (!aName || aName !== target) continue;

        const vacationVal = a.Vacation;
        const onVacation = vacationVal === true || vacationVal === "Yes" || (typeof vacationVal === 'string' && vacationVal.toLowerCase() === 'yes');
        if (!onVacation) return null;

        const replacementName = String(a.ReplacementName || '').trim();
        if (!replacementName) return null;

        const returnDate = _parseReturnDate(a.DateReturn || '');
        const now = new Date();
        if (returnDate && now > returnDate) return null;

        return {
            key,
            name: (a.Name || '').trim(),
            replacementName,
            returnDateStr: String(a.DateReturn || '').trim()
        };
    }
    return null;
}

function resolveVacationAssignee(name) {
    const n = String(name || '').trim();
    if (!n) return n;
    // Do not rewrite special buckets
    const lower = n.toLowerCase();
    if (lower === 'all' || lower === 'accounting') return n;

    const vac = getActiveVacationByName(n);
    return (vac && vac.replacementName) ? vac.replacementName : n;
}

function getDelegatorsForReplacement(replacementName) {
    const approversData = getCachedApproversData();
    const target = _normName(replacementName);
    const delegators = [];
    if (!approversData || !target) return delegators;

    const now = new Date();

    for (const key in approversData) {
        const a = approversData[key];
        if (!a) continue;

        const rep = _normName(a.ReplacementName);
        if (!rep || rep !== target) continue;

        const vacationVal = a.Vacation;
        const onVacation = vacationVal === true || vacationVal === "Yes" || (typeof vacationVal === 'string' && vacationVal.toLowerCase() === 'yes');
        if (!onVacation) continue;

        const returnDate = _parseReturnDate(a.DateReturn || '');
        if (returnDate && now > returnDate) continue;

        const fromName = String(a.Name || '').trim();
        if (fromName) delegators.push(fromName);
    }
    return delegators;
}
