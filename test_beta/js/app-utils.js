// =================================================================================================
// js/app-utils.js
// Shared utility helpers moved out of app.js in v8.0.3.
// Cleanup only: function names and behavior are intentionally preserved.
// =================================================================================================

// Helper function to format numbers into financial format (e.g., 64,862.50)
function formatTableCurrency(val) {
    if (!val || val === '') return '';

    // Remove any existing commas just in case, then parse to float
    const num = parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(num)) return val; // If it's pure text somehow, just return the text

    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// SharePoint PDF filename handling
// Goal: always build links without any whitespace before ".pdf" and never end up with trailing spaces in the base name.
// Examples:
//   "12345-in-01-sample .pdf"  -> "12345-in-01-sample.pdf"
//   "....DISTRICT "            -> "....DISTRICT.pdf"
function normalizeNameText(value) {
    // Convert common non-breaking / special spaces to a normal space, then trim.
    return String(value ?? '')
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
        .trim();
}

function truncateNameText(value, maxLen) {
    const s = normalizeNameText(value);
    if (!maxLen || maxLen <= 0) return s;
    // IMPORTANT: do NOT pad. Only truncate, then trim again to remove a trailing space at the cut point.
    return (s.length > maxLen) ? s.substring(0, maxLen).trim() : s;
}

function getSharePointPdfBaseName(name) {
    const raw = normalizeNameText(name);
    const lower = raw.toLowerCase();
    if (!lower || lower === 'nil') return '';

    // Remove a trailing ".pdf" (case-insensitive), allowing accidental spaces before/after it.
    // Then normalize again so we never end up with "... .pdf" when we later append ".pdf".
    const noExt = raw.replace(/\s*\.pdf\s*$/i, '');
    return normalizeNameText(noExt);
}

// Build a safe SharePoint PDF URL or return null if name is blank/"nil".
function buildSharePointPdfUrl(basePath, name) {
    const baseName = getSharePointPdfBaseName(name);
    if (!baseName) return null;
    return `${basePath}${encodeURIComponent(baseName)}.pdf`;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Explicit window exposure keeps legacy inline handlers and other script files stable.
window.formatTableCurrency = formatTableCurrency;
window.normalizeNameText = normalizeNameText;
window.truncateNameText = truncateNameText;
window.getSharePointPdfBaseName = getSharePointPdfBaseName;
window.buildSharePointPdfUrl = buildSharePointPdfUrl;
window.escapeHtml = escapeHtml;
