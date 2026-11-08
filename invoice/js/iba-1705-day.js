/* ==========================================================================
   js/iba-1705-day.js — 17.0.5 patch 157
   One date look for invoice dates on cards: 07-Nov-26 (dd-Mon-yy).
   Saved invoice dates come in several shapes (2026-11-07, 07/11/2026,
   07-11-26, 07-11-2026, 07.11.2026, 7-Nov-2026, timestamps). The browser
   reads "07-11-26" as 11 July, so day-first numbers are read here by hand.
   window.ibaDay(v)    -> '07-Nov-26' ('' if empty, the text itself if unknown)
   window.ibaDayISO(v) -> '2026-11-07' ('' if unknown)
   ========================================================================== */
(function () {
    'use strict';
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const p2 = (n) => String(n).padStart(2, '0');
    function fromMs(ms) {
        try {
            const s = new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Qatar' });
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        } catch (_) {}
        const d = new Date(ms);
        return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    }
    function ok(y, m, d) { return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? y + '-' + p2(m) + '-' + p2(d) : ''; }
    function yr(y) { y = String(y); return y.length === 2 ? '20' + y : y; }
    function iso(v) {
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'number' || /^\d{9,}$/.test(String(v).trim())) {
            let n = Number(v);
            if (!n) return '';
            if (n < 1e11) n *= 1000;
            return fromMs(n);
        }
        if (v instanceof Date) return isNaN(v) ? '' : fromMs(v.getTime());
        const t = String(v).trim();
        let m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:$|[T\s])/);
        if (m) return ok(m[1], +m[2], +m[3]);
        m = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})(?:$|\s)/);
        if (m) return ok(yr(m[3]), +m[2], +m[1]);
        m = t.match(/^(\d{1,2})[-\/.\s]+([A-Za-z]{3})[A-Za-z]*\.?[-\/.,\s]+(\d{2}|\d{4})(?:$|\s)/);
        if (m) { const mi = MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()); if (mi !== -1) return ok(yr(m[3]), mi + 1, +m[1]); }
        m = t.match(/^([A-Za-z]{3})[A-Za-z]*\.?[-\/.\s]+(\d{1,2}),?[-\/.\s]+(\d{4})(?:$|\s)/);
        if (m) { const mi = MON.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()); if (mi !== -1) return ok(m[3], mi + 1, +m[2]); }
        const d = Date.parse(t);
        return Number.isFinite(d) ? fromMs(d) : '';
    }
    function day(v) {
        if (v === null || v === undefined || v === '') return '';
        const s = iso(v);
        if (!s) return String(v);
        return s.slice(8, 10) + '-' + MON[Number(s.slice(5, 7)) - 1] + '-' + s.slice(2, 4);
    }
    window.ibaDay = day;
    window.ibaDayISO = iso;
})();
