/* 17.0.5 patch 183 (martin): ONE PO card everywhere (assistant "Where is my invoice?"
 * on PC + phone, the invoice detail, phone Invoice Records, Finance).
 *   Card : PO No. big | "N Invoices" pill (+ Finance pill) / Vendor / Site / PO value | Invoiced | Balance
 *   Rows : oldest first, 3 lines: n, invoice no., amount to pay
 *                                 Inv date dd/Mmm/yy, INV / SRV links
 *                                 dot + status · who since dd/Mmm/yy (With Accounts = Fin, Paid = date only)
 * No "QAR" (everyone knows it is riyal). Tapping the card top opens / closes its invoice list. */
(function () {
    'use strict';
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    // 07-Nov-26 -> 07/Nov/26 (martin: dd/Mmm/yy in the tracker)
    function slash(v) {
        var s = String(v == null ? '' : v).trim();
        if (!s) return '';
        if (!/^\d{1,2}[-\/ ][A-Za-z]{3}/.test(s) && typeof window.ibaDay === 'function') { try { s = String(window.ibaDay(s) || s); } catch (_) {} }
        return s.replace(/^(\d{1,2})[- ]([A-Za-z]{3})[A-Za-z]*[- ](\d{2,4})/, function (m, d, mo, y) { return (d.length < 2 ? '0' + d : d) + '/' + mo + '/' + (y.length === 4 ? y.slice(2) : y); });
    }
    function noQar(v) { return String(v == null ? '' : v).replace(/^\s*QAR\s*/i, ''); }
    // colour of a status: proc blue, apv orange, acc pink, paid green, stop red
    function toneOf(status) {
        var s = String(status || '').toLowerCase();
        if (/^paid/.test(s)) return 'paid';
        if (/with accounts/.test(s)) return 'acc';
        if (/hold|reject|cancel|return/.test(s)) return 'stop';
        if (/approv|ceo|management/.test(s)) return 'apv';
        return 'proc';
    }
    function fig(lbl, val, cls) { return '<div class="' + (cls || '') + '"><span class="iba-u-lbl">' + lbl + '</span><b>' + esc(noQar(val)) + '</b></div>'; }
    /* o: { po, vendor, site, siteName, poValue, invoiced, balance, count, open, fin (html), rows (html), foot (html), noPill, cls } */
    function card(o) {
        o = o || {};
        var n = Number(o.count) || 0;
        var pills = (o.fin || '') + (!o.noPill && n ? '<button type="button" class="iba-u-cnt" data-u-toggle aria-expanded="' + (o.open ? 'true' : 'false') + '">' + n + ' Invoice' + (n === 1 ? '' : 's') + ' <i class="fa-solid fa-chevron-down"></i></button>' : '');
        var figs = (o.poValue || o.invoiced || o.balance) ? '<div class="iba-u-fig">' + fig('PO value', o.poValue || '—') + fig('Invoiced', o.invoiced || '—') + fig('Balance', o.balance || '—', 'is-bal') + '</div>' : '';
        return '<div class="iba-u-po' + (o.open ? ' is-open' : '') + (o.cls ? ' ' + o.cls : '') + '" data-u-po="' + esc(o.po) + '">' +
            '<div class="iba-u-top"' + (!o.noPill && n ? ' data-u-toggle' : '') + '><div class="iba-u-pono-w"><span class="iba-u-lbl">PO No.</span><span class="iba-u-pono">' + esc(o.po) + '</span></div>' + (pills ? '<div class="iba-u-pills">' + pills + '</div>' : '') + '</div>' +
            (o.vendor ? '<div class="iba-u-ven-w"><span class="iba-u-lbl">Vendor</span><span class="iba-u-ven">' + esc(o.vendor) + '</span></div>' : '') +
            (o.site ? '<div class="iba-u-site"><i class="fa-solid fa-location-dot"></i> Site ' + esc(o.site) + (o.siteName ? ' <span>· ' + esc(o.siteName) + '</span>' : '') + '</div>' : '') +
            figs +
            (o.rows ? '<div class="iba-u-list"><div class="iba-u-lh"><span>Invoice · date</span><span>To pay · files</span></div>' + o.rows + '</div>' : '') +
            (o.foot || '') + '</div>';
    }
    /* r: { n, no, amt, invDate, links:[{lbl, href}], status, tone, who, since, attrs, urgent (html) } */
    function row(r) {
        r = r || {};
        var tone = r.tone || toneOf(r.status);
        var links = (r.links || []).filter(function (l) { return l && l.href; }).map(function (l) { return '<a class="iba-u-lk" href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.lbl) + '</a>'; }).join('');
        var tail = '';
        if (tone === 'paid') tail = r.since ? ' · ' + esc(slash(r.since)) : '';
        else if (r.who || r.since) tail = ' · ' + (r.who ? '<span class="iba-u-who">' + esc(r.who) + '</span> ' : '') + (r.since ? 'since ' + esc(slash(r.since)) : '');
        return '<div class="iba-u-inv"' + (r.attrs || '') + '>' +
            '<span class="iba-u-n">' + esc(r.n) + '</span><span class="iba-u-no">' + esc(r.no || '—') + '</span><span class="iba-u-amt">' + esc(noQar(r.amt || '')) + '</span>' +
            '<span class="iba-u-d">' + (r.invDate ? 'Inv date <b>' + esc(slash(r.invDate)) + '</b>' : '') + (r.urgent || '') + '</span><span class="iba-u-links">' + links + '</span>' +
            '<span class="iba-u-stl"><i class="iba-u-dot is-' + tone + '"></i><span class="iba-u-stn is-' + tone + '">' + esc(r.status || '') + '</span><span>' + tail + '</span></span></div>';
    }
    // open / close a card's invoice list (Finance pill and links have their own job)
    document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('[data-fin-open], .iba-u-lk')) return;
        var tg = t.closest('[data-u-toggle]');
        if (!tg) return;
        var c = tg.closest('.iba-u-po');
        if (!c) return;
        e.preventDefault();
        var open = !c.classList.contains('is-open');
        c.classList.toggle('is-open', open);
        var b = c.querySelector('.iba-u-cnt');
        if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
    }, true);
    window.ibaPoCard = { card: card, row: row, slash: slash, toneOf: toneOf, noQar: noQar, esc: esc };
})();
