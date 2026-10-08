// =================================================================================================
// IBA WorkDesk — Core Shared Helpers
// Version 7.5.2
//
// Purpose:
//   Second safe JavaScript split from app.js.
//   This file owns shared, low-risk helper functions used by WorkDesk, Invoice, Inventory, and mobile.
//
// Important:
//   Load this BEFORE js/app-mobile.js and app.js.
//   Functions are normal top-level declarations so existing legacy code can call them globally.
// =================================================================================================

window.IBA_CORE_VERSION = '7.5.2';

// --------------------------------------------------------------------------
// QUICK COPY SHORTCUTS
// Double-click supported fields to copy their current value to clipboard.
// --------------------------------------------------------------------------

function fallbackCopyText(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        console.error('Fallback copy failed', e);
        return false;
    }
}

async function copyTextToClipboard(text, feedbackEl) {
    if (!text) return false;

    const doFeedback = () => {
        if (!feedbackEl) return;
        const originalBg = feedbackEl.style.backgroundColor;
        feedbackEl.style.backgroundColor = '#d4edda'; // Light green flash
        feedbackEl.style.transition = 'background-color 0.3s';
        setTimeout(() => {
            feedbackEl.style.backgroundColor = originalBg;
        }, 450);
    };

    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            doFeedback();
            return true;
        }
    } catch (e) {
        // Ignore and fall back
    }

    const ok = fallbackCopyText(text);
    if (ok) doFeedback();
    return ok;
}

function bindDblClickCopy(el, getTextFn, feedbackEl) {
    if (!el) return;
    if (el.dataset && el.dataset.dblcopyBound === '1') return;
    if (el.dataset) el.dataset.dblcopyBound = '1';

    el.addEventListener('dblclick', (e) => {
        const raw = (typeof getTextFn === 'function')
            ? getTextFn()
            : (el.value !== undefined ? el.value : (el.innerText || el.textContent || ''));

        const text = (raw || '').toString().trim();
        if (!text) return;

        e.preventDefault();

        try {
            if (typeof el.focus === 'function') el.focus();
            if (typeof el.select === 'function') el.select();
        } catch (err) { /* ignore */ }

        copyTextToClipboard(text, feedbackEl || el);
    });
}

function normalizeMobile(mobile) {
    const digitsOnly = mobile.replace(/\D/g, '');
    if (digitsOnly.length === 8) {
        return `974${digitsOnly}`;
    }
    return digitsOnly;
}
function formatDate(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}
function formatYYYYMMDD(dateString) {
    if (!dateString) return 'N/A';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;

    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2];

    const month = months[monthIndex];
    if (!month) return dateString;

    return `${day}-${month}-${year}`;
}
function normalizeDateForInput(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const parts = dateString.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    if (/^\d{2}-\d{2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-');
        const day = parts[0];
        const month = parts[1];
        const year = `20${parts[2]}`;
        return `${year}-${month}-${day}`;
    }
    const date = new Date(dateString);
    if (!isNaN(date)) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    console.warn("Unrecognized date format:", dateString);
    return '';
}
function convertDisplayDateToInput(displayDate) {
    if (!displayDate || typeof displayDate !== 'string') return '';
    const parts = displayDate.split('-');
    if (parts.length !== 3) return '';
    const day = parts[0];
    const year = parts[2];
    const monthMap = {
        "Jan": "01",
        "Feb": "02",
        "Mar": "03",
        "Apr": "04",
        "May": "05",
        "Jun": "06",
        "Jul": "07",
        "Aug": "08",
        "Sep": "09",
        "Oct": "10",
        "Nov": "11",
        "Dec": "12"
    };
    const month = monthMap[parts[1]];
    if (!month) return '';
    return `${year}-${month}-${day}`;
}
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function formatCurrency(value) {
    if (typeof value === 'number') {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    const number = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(number)) {
        return 'N/A';
    }
    return number.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function formatFinanceNumber(value) {
    if (value === undefined || value === null || value === '') return '';
    const num = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? value : num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function formatFinanceDate(dateStr) {
    if (!dateStr || String(dateStr).trim() === '') return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return dateStr;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const utcDate = new Date(Date.UTC(year, month, day));

        const dayFormatted = utcDate.getUTCDate().toString().padStart(2, '0');
        const monthFormatted = utcDate.toLocaleString('default', {
            month: 'short',
            timeZone: 'UTC'
        }).toUpperCase();
        const yearFormatted = utcDate.getUTCFullYear();
        return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
    }
    const dayFormatted = date.getUTCDate().toString().padStart(2, '0');
    const monthFormatted = date.toLocaleString('default', {
        month: 'short',
        timeZone: 'UTC'
    }).toUpperCase();
    const yearFormatted = date.getUTCFullYear();
    return `${dayFormatted}-${monthFormatted}-${yearFormatted}`;
}
function formatFinanceDateLong(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const month = date.toLocaleString('default', {
        month: 'long'
    });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function numberToWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  const n = parseFloat(String(num).replace(/,/g, ''));
  if (!isFinite(n)) return '';

  const fixed = n.toFixed(2);
  const [intStr, fracStr] = fixed.split('.');

  function twoDigits(x) {
    if (x < 20) return a[x];
    const tens = Math.floor(x / 10);
    const ones = x % 10;
    return b[tens] + (ones ? ' ' + a[ones] : '');
  }

  function threeDigits(x) {
    const hundreds = Math.floor(x / 100);
    const rem = x % 100;
    let out = '';

    if (hundreds) {
      out += a[hundreds] + ' Hundred';
      if (rem) out += ' and ' + twoDigits(rem);
    } else if (rem) {
      out += twoDigits(rem);
    }
    return out.trim();
  }

  let words = '';
  let s = intStr;
  let scaleIndex = 0;

  if (parseInt(s, 10) === 0) {
    words = 'Zero';
  } else {
    const parts = [];
    while (s.length > 0) {
      const chunkStr = s.slice(-3);
      s = s.slice(0, -3);
      const chunkNum = parseInt(chunkStr, 10);

      if (chunkNum) {
        const chunkWords = threeDigits(chunkNum);
        const scale = scales[scaleIndex];
        parts.push((chunkWords + (scale ? ' ' + scale : '')).trim());
      }
      scaleIndex++;
    }
    words = parts.reverse().join(' ').trim();
  }

  // Keep the existing decimal style
  if (fracStr && parseInt(fracStr, 10) > 0) {
    words += ' and ' + fracStr + '/100';
  }

  return words.charAt(0).toUpperCase() + words.slice(1) + ' Qatari Riyals Only';
}


function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}