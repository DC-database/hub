/* 17.0.5 patch 99: "Month to Payments" - every invoice still With Accounts whose
 * With Accounts (release) date falls in the picked month + year goes into the
 * Payments list in one go, then you mark them Paid as usual.
 * Uses the Payments page's own With Accounts pocket (no invoice_entries read).
 * Only for people who can open Payments. PC only. */
(function () {
    'use strict';
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function money(v) { var n = Number(v) || 0; return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function allowed() {
        try { return typeof canCurrentUserAccessPayments === 'function' && canCurrentUserAccessPayments() && !document.body.classList.contains('iba-mobile-ui') && !document.body.classList.contains('iba-phone'); } catch (_) { return false; }
    }
    function iso(v) { try { return typeof paymentDateISO === 'function' ? paymentDateISO(v) : ''; } catch (_) { return ''; } }
    function inCart(id) { try { return !!(invoicesToPay && invoicesToPay[id]); } catch (_) { return false; } }
    async function pocket() {
        if (typeof paymentEnsureReadyIndexLoaded === 'function') { try { await paymentEnsureReadyIndexLoaded(); } catch (_) {} }
        try { return typeof paymentReadyItemsSnapshot === 'function' ? paymentReadyItemsSnapshot() : []; } catch (_) { return []; }
    }
    // with accounts invoices of that month: { items, inList, noDate }
    async function pick(year, month) {
        var all = await pocket();
        var pre = year + '-' + String(month).padStart(2, '0') + '-';
        var items = [], inList = 0, noDate = 0;
        all.forEach(function (it) {
            var d = iso(it.releaseDate);
            if (!d) { noDate++; return; }
            if (d.indexOf(pre) !== 0) return;
            if (inCart(it.id)) { inList++; return; }
            items.push(it);
        });
        items.sort(function (a, b) { return String(a.supplierName).localeCompare(String(b.supplierName)) || String(a.po).localeCompare(String(b.po)); });
        return { items: items, inList: inList, noDate: noDate, total: all.length };
    }
    // 17.0.5 p100: paid date = With Accounts date + 1 day, never a Friday (Thursday -> Saturday)
    function paidDateFor(rel) {
        var d = iso(rel); if (!d) return '';
        var p = d.split('-').map(Number);
        var t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1));
        if (t.getUTCDay() === 5) t.setUTCDate(t.getUTCDate() + 1);
        return t.toISOString().slice(0, 10);
    }
    // 17.0.5 p101: Finance column (window.ibaFinPay, read only): Date Paid + cheque of
    // the first Finance payment on the PO dated on/after the With Accounts date
    var fin = {}; // item id -> hit
    function finOn() { return !!(window.ibaFinPay && window.ibaFinPay.canUse()); }
    function useFin() { return false; } // 17.0.5 p103: tick removed, paid date is always release + 1 day
    function capToday(d) { var t = typeof paymentToday === 'function' ? paymentToday() : ''; return d && t && d > t ? t : d; }
    function canEditDate() { try { return typeof paymentCanCurrentUserEditPaidDate !== 'function' || paymentCanCurrentUserEditPaidDate(); } catch (_) { return true; } }
    function chosenPaid(it) {
        if (!canEditDate()) return typeof paymentToday === 'function' ? paymentToday() : '';
        var h = fin[it.id]; return capToday((useFin() && h && h.datePaid) ? h.datePaid : paidDateFor(it.releaseDate));
    }
    function paintPaid() {
        if (!last) return;
        last.items.forEach(function (it) {
            var tr = document.querySelector('#iba-pm-pop tr[data-pm-id="' + (window.CSS && CSS.escape ? CSS.escape(it.id) : it.id) + '"]');
            var td = tr && tr.querySelector('.iba-pm-pd'); if (!td) return;
            var pd = chosenPaid(it);
            td.textContent = pd && typeof paymentDisplayDate === 'function' ? paymentDisplayDate(pd) : pd;
            td.classList.toggle('is-fin', !!(useFin() && fin[it.id]));
        });
    }
    async function finCheck(r) {
        fin = {};
        var pos = []; r.items.forEach(function (it) { if (pos.indexOf(it.po) === -1) pos.push(it.po); });
        var lists = {}, i = 0;
        async function worker() { while (i < pos.length) { var po = pos[i++]; try { lists[po] = await window.ibaFinPay.forPo(po); } catch (_) { lists[po] = []; } } }
        await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
        if (last !== r) return;
        var nHit = 0;
        r.items.forEach(function (it) {
            var h = window.ibaFinPay.match(lists[it.po] || [], it.releaseDate);
            if (h) { fin[it.id] = h; nHit++; }
            var tr = document.querySelector('#iba-pm-pop tr[data-pm-id="' + (window.CSS && CSS.escape ? CSS.escape(it.id) : it.id) + '"]');
            var td = tr && tr.querySelector('.iba-pm-fin'); if (!td) return;
            td.innerHTML = h ? '<span class="is-hit">paid ' + esc(typeof paymentDisplayDate === 'function' ? paymentDisplayDate(h.datePaid) : h.datePaid) + '</span>' + (h.cheque ? '<small>Chq ' + esc(h.cheque) + '</small>' : '') : ((lists[it.po] || []).length ? '<small>no payment after it</small>' : '<small>—</small>');
        });
        void nHit;
    }
    function close() { var o = $('iba-pm-pop'); if (o) o.remove(); }
    function open() {
        if (!allowed()) { alert('Month to Payments is for people who can open Payments (on the PC).'); return; }
        close();
        var now = new Date(), y0 = now.getFullYear();
        var years = []; for (var y = y0; y >= y0 - 3; y--) years.push(y);
        var wrap = document.createElement('div');
        wrap.id = 'iba-pm-pop';
        wrap.className = 'iba-pb-layer';
        wrap.innerHTML = '<div class="iba-pb-box iba-watch-box iba-pm-box" role="dialog" aria-modal="true" aria-labelledby="iba-pm-t">' +
            '<div class="iba-pb-head"><b id="iba-pm-t"><i class="fa-solid fa-calendar-check"></i> Month to Payments</b>' +
            '<button type="button" class="iba-watch-x" data-pm-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<p class="iba-pm-hint">Every invoice still <b>With Accounts</b> whose With Accounts date is in this month goes into the payment list. Paid date = the day after its With Accounts date (never a Friday). Nothing is marked Paid until you press Mark as Paid.</p>' +
            '<div class="iba-pm-pick"><label>Month<select id="iba-pm-m">' + MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i === now.getMonth() ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></label>' +
            '<label>Year<select id="iba-pm-y">' + years.map(function (y) { return '<option>' + y + '</option>'; }).join('') + '</select></label></div>' +
            '<div id="iba-pm-out" class="iba-pm-out"></div>' +
            '<div class="iba-pm-acts"><button type="button" class="iba-trk-btn" data-pm-close>Cancel</button><button type="button" class="iba-trk-btn is-main" id="iba-pm-add" disabled>Add to payment list</button></div>' +
            '</div>';
        document.body.appendChild(wrap);
        wrap.addEventListener('click', function (e) {
            if (e.target === wrap || (e.target.closest && e.target.closest('[data-pm-close]'))) return close();
            if (e.target.closest && e.target.closest('#iba-pm-add')) return add();
        });
        wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
        $('iba-pm-m').addEventListener('change', show);
        $('iba-pm-y').addEventListener('change', show);
        show();
    }
    var last = null;
    async function show() {
        var out = $('iba-pm-out'), btn = $('iba-pm-add');
        if (!out) return;
        var m = Number($('iba-pm-m').value), y = Number($('iba-pm-y').value);
        out.innerHTML = '<p class="iba-pm-note"><i class="fa-solid fa-spinner fa-spin"></i> Looking…</p>';
        btn.disabled = true;
        var r = await pick(y, m);
        if (Number($('iba-pm-m') && $('iba-pm-m').value) !== m || Number($('iba-pm-y').value) !== y) return;
        last = r;
        var lbl = MONTHS[m - 1] + ' ' + y;
        var sum = r.items.reduce(function (s, it) { return s + (Number(it.amountPaid) || Number(it.invoiceValue) || 0); }, 0);
        var vend = {}; r.items.forEach(function (it) { vend[String(it.supplierName || '').toLowerCase()] = 1; });
        var extra = (r.inList ? '<p class="iba-pm-note">' + r.inList + ' of ' + lbl + ' already in the payment list (left as they are).</p>' : '') +
            (r.noDate ? '<p class="iba-pm-note">' + r.noDate + ' With Accounts invoice' + (r.noDate === 1 ? ' has' : 's have') + ' no With Accounts date, so no month (not added).</p>' : '');
        if (!r.items.length) {
            out.innerHTML = '<p class="iba-pm-empty">No invoice With Accounts in ' + esc(lbl) + ' left to add.</p>' + extra;
            btn.textContent = 'Add to payment list';
            return;
        }
        out.innerHTML = '<div class="iba-pm-sum"><div><b>' + r.items.length + '</b><span>invoices</span></div><div><b>' + Object.keys(vend).length + '</b><span>vendors</span></div><div class="is-amt"><b>' + money(sum) + '</b><span>QAR</span></div></div>' +
            '<div class="iba-pm-list"><table><thead><tr><th>With Accounts</th><th>Paid date</th><th>PO</th><th>Vendor</th><th>Invoice</th><th class="is-n">QAR</th>' + (finOn() ? '<th>Finance</th>' : '') + '</tr></thead><tbody>' +
            r.items.map(function (it) {
                var pd = chosenPaid(it); return '<tr data-pm-id="' + esc(it.id) + '"><td>' + esc(typeof paymentDisplayDate === 'function' ? paymentDisplayDate(it.releaseDate) : it.releaseDate) + '</td><td class="iba-pm-pd">' + esc(pd && typeof paymentDisplayDate === 'function' ? paymentDisplayDate(pd) : pd) + '</td><td>' + esc(it.po) + '</td><td>' + esc(it.supplierName) + '</td><td>' + esc(it.invoiceNo || it.invEntryID || '') + '</td><td class="is-n">' + money(it.amountPaid || it.invoiceValue) + '</td>' + (finOn() ? '<td class="iba-pm-fin"><i class="fa-solid fa-spinner fa-spin"></i></td>' : '') + '</tr>';
            }).join('') + '</tbody></table></div>' + extra;
        btn.disabled = false;
        if (finOn()) finCheck(r);
        btn.textContent = 'Add ' + r.items.length + ' to payment list';
    }
    async function add() {
        if (!last || !last.items.length) return;
        var items = last.items;
        if (typeof window.ibaOpenShellPage === 'function') { try { await window.ibaOpenShellPage('im-payments'); } catch (_) {} }
        try { if (typeof restorePaymentCart === 'function') restorePaymentCart(); } catch (_) {}
        var today = typeof paymentToday === 'function' ? paymentToday() : '';
        var n = 0;
        items.forEach(function (it) {
            if (inCart(it.id)) return;
            invoicesToPay[it.id] = Object.assign({}, it, { releaseDate: typeof paymentWithAccountsDateValue === 'function' ? paymentWithAccountsDateValue(it) : it.releaseDate, paidDate: chosenPaid(it) || today || it.paidDate });
            n++;
        });
        try { if (typeof persistPaymentCart === 'function') persistPaymentCart(); } catch (_) {}
        try { if (typeof renderPaymentsCart === 'function') renderPaymentsCart(); } catch (_) {}
        close();
        try { if (typeof window.ibaToast === 'function') window.ibaToast(n + ' invoices added to the payment list'); } catch (_) {}
    }
    // a "By month" button next to Search Invoices on the Payments page
    function addButton() {
        var s = $('im-add-payment-button');
        if (!s || $('iba-pm-btn') || !allowed()) return;
        var b = document.createElement('button');
        b.type = 'button'; b.id = 'iba-pm-btn'; b.className = 'secondary-btn';
        b.innerHTML = '<i class="fa-solid fa-calendar-check"></i> By month';
        b.title = 'Add every With Accounts invoice of one month';
        b.addEventListener('click', open);
        s.parentNode.insertBefore(b, s);
    }
    // 17.0.5 p105: no extra button. Rows added before the +1 day rule got today as the
    // paid date; when the Payments page shows, those rows (paid date = today, With Accounts
    // date known) are set to the rule once. Dates picked by hand on other days are kept.
    function fixOld() {
        if (!canEditDate()) return;
        var items = []; try { items = typeof paymentCartItems === 'function' ? paymentCartItems() : []; } catch (_) {}
        var today = '', n = 0, seen = 0;
        try { today = paymentToday(); } catch (_) { return; }
        items.forEach(function (it) {
            var row = invoicesToPay[it.id]; if (!row || row.pdChecked) return;
            row.pdChecked = 1; seen++;
            var cur = ''; try { cur = paymentDateISO(row.paidDate); } catch (_) {}
            var d = capToday(paidDateFor(row.releaseDate));
            if (cur === today && d && d !== cur) { row.paidDate = d; n++; }
        });
        if (n) try { if (typeof window.ibaToast === 'function') window.ibaToast(n + ' paid dates set to With Accounts date + 1 day'); } catch (_) {}
        if (!seen) return;
        try { if (typeof persistPaymentCart === 'function') persistPaymentCart(); } catch (_) {}
        try { if (typeof renderPaymentsCart === 'function') renderPaymentsCart(); } catch (_) {}
    }
    document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-im-jump="im-payments"], [data-nav-key="im-payments"], [data-section="im-payments"]');
        if (t) setTimeout(addButton, 300);
    }, true);
    setInterval(function () { var p = $('im-payments'); if (p && p.offsetParent) { if (!$('iba-pm-btn')) addButton(); fixOld(); } }, 3000);
    window.ibaPayMonth = { allowed: allowed, open: open, pick: pick, paidDateFor: paidDateFor };
})();
